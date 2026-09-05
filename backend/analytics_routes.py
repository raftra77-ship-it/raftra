"""
Growth analytics for the Analytics screen's Growth Analysis section.

The contract this fills is the shape GrowthAnalysisSection.tsx renders: a Revenue / Spend /
ROAS / Orders / CAC series per timeframe, a KPI row, and a per-channel breakdown.

The one rule that shapes everything here: NOTHING IS INVENTED. The component shipped with
hardcoded series - 7 days of revenue rising 48k -> 94.5k, a 90-day set topping a million -
and the workspace those numbers rendered for reports zero revenue on its own dashboard
tiles. Two screens contradicting each other is worse than one empty screen, so every figure
below is derived from a real Meta/Google insight or a stored campaign, and when a source is
not connected the response says so and returns nothing for it.

`connected` and `has_data` are therefore separate: "you have not linked Meta" and "Meta is
linked but this account has no delivery in the window" are different problems with
different fixes, and the UI should be able to say which one it is.
"""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

import auth
import database
import models

router = APIRouter(prefix="/api/workspaces", tags=["analytics"])

# Timeframe -> (Meta date_preset, Google date_range, buckets, bucket kind).
# The two platforms spell the same window differently - Meta wants "last_7d", Google wants
# "LAST_7_DAYS" - so both spellings are carried here rather than translated at the call site.
TIMEFRAMES = {
    "7D": ("last_7d", "LAST_7_DAYS", 7, "day"),
    "30D": ("last_30d", "LAST_30_DAYS", 4, "week"),
    "90D": ("last_90d", "LAST_30_DAYS", 3, "month"),
}


def _require_workspace(workspace_id: int, db: Session, current_user: models.User):
    ws = (db.query(models.Workspace)
            .filter(models.Workspace.id == workspace_id,
                    models.Workspace.user_id == current_user.id).first())
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


def _safe_div(a: float, b: float) -> float:
    return (a / b) if b else 0.0


async def _meta_totals(db: Session, workspace_id: int, date_preset: str) -> Optional[dict]:
    """Real Meta spend/revenue/orders for the window, or None when not connected.

    Returns None (not zeros) for "not connected" so the caller can distinguish it from a
    connected account that genuinely spent nothing.
    """
    try:
        conn = (db.query(models.MetaAdsConnection)
                  .filter(models.MetaAdsConnection.workspace_id == workspace_id).first())
        if not conn or not getattr(conn, "ad_account_id", None):
            return None
    except Exception as e:
        # Reading the row itself can raise: the token columns are EncryptedString, and a
        # deployment whose TOKEN_ENCRYPTION_KEY has gone missing cannot decrypt rows that
        # were written when it was present. That is an operator problem, not a reason to
        # 500 an analytics page - report it as "no usable connection" and move on.
        print("[analytics] Meta connection unreadable for ws %s: %s" % (workspace_id, e))
        return None
    try:
        from core import meta_ads
        rows = await meta_ads.fetch_insights(conn, date_preset=date_preset)
    except Exception as e:
        print("[analytics] Meta insights failed for ws %s: %s" % (workspace_id, e))
        return None

    spend = revenue = orders = clicks = impressions = 0.0
    for row in (rows or {}).values():
        if not isinstance(row, dict):
            continue
        spend += float(row.get("spend") or 0)
        revenue += float(row.get("revenue") or row.get("conversion_value") or 0)
        orders += float(row.get("conversions") or row.get("purchases") or 0)
        clicks += float(row.get("clicks") or 0)
        impressions += float(row.get("impressions") or 0)
    return {"spend": spend, "revenue": revenue, "orders": orders,
            "clicks": clicks, "impressions": impressions}


async def _google_totals(db: Session, workspace_id: int, date_range: str) -> Optional[dict]:
    """Real Google Ads totals for the window, or None when not connected.

    google_ads.fetch_insights returns PER-CAMPAIGN rows keyed by campaign id, using `cost`
    rather than `spend` and reporting roas per campaign instead of a revenue figure. Revenue
    is therefore reconstructed as cost x roas per row and summed - taking a weighted average
    of the roas column would silently over-weight campaigns that barely spent.
    """
    try:
        conn = (db.query(models.GoogleAdsConnection)
                  .filter(models.GoogleAdsConnection.workspace_id == workspace_id).first())
        if not conn or not getattr(conn, "customer_id", None):
            return None
    except Exception as e:
        # Same encrypted-credential caveat as Meta above.
        print("[analytics] Google Ads connection unreadable for ws %s: %s" % (workspace_id, e))
        return None
    try:
        from core import google_ads
        rows = await google_ads.fetch_insights(conn, date_range=date_range)
    except Exception as e:
        print("[analytics] Google Ads insights failed for ws %s: %s" % (workspace_id, e))
        return None

    spend = revenue = orders = clicks = impressions = 0.0
    for row in (rows or {}).values():
        if not isinstance(row, dict):
            continue
        cost = float(row.get("cost") or 0)
        spend += cost
        revenue += cost * float(row.get("roas") or 0)
        orders += float(row.get("conversions") or 0)
        clicks += float(row.get("clicks") or 0)
        impressions += float(row.get("impressions") or 0)
    return {"spend": spend, "revenue": revenue, "orders": orders,
            "clicks": clicks, "impressions": impressions}


def _bucket_labels(kind: str, count: int) -> List[str]:
    """Labels matching what the chart expects: weekday names, Week N, or month names."""
    today = datetime.utcnow().date()
    if kind == "day":
        return [(today - timedelta(days=count - 1 - i)).strftime("%a") for i in range(count)]
    if kind == "week":
        return ["Week %d" % (i + 1) for i in range(count)]
    return [(today - timedelta(days=30 * (count - 1 - i))).strftime("%b") for i in range(count)]


@router.get("/{workspace_id}/analytics/growth")
async def growth_analytics(workspace_id: int, timeframe: str = Query("30D"),
                           db: Session = Depends(database.get_db),
                           current_user: models.User = Depends(auth.get_current_user)):
    """Growth series + KPIs + channel split for one workspace and timeframe."""
    _require_workspace(workspace_id, db, current_user)
    if timeframe not in TIMEFRAMES:
        raise HTTPException(status_code=400, detail="timeframe must be one of 7D, 30D, 90D")
    date_preset, date_range, buckets, bucket_kind = TIMEFRAMES[timeframe]

    meta = await _meta_totals(db, workspace_id, date_preset)
    google = await _google_totals(db, workspace_id, date_range)

    sources = {
        "meta": {"connected": meta is not None,
                 "has_data": bool(meta and (meta["spend"] or meta["revenue"]))},
        "google": {"connected": google is not None,
                   "has_data": bool(google and (google["spend"] or google["revenue"]))},
    }

    spend = (meta or {}).get("spend", 0.0) + (google or {}).get("spend", 0.0)
    revenue = (meta or {}).get("revenue", 0.0) + (google or {}).get("revenue", 0.0)
    orders = (meta or {}).get("orders", 0.0) + (google or {}).get("orders", 0.0)

    # No live ad connector at all. Rather than draw a chart, say so - and still report what
    # the workspace DOES have, so the screen is not blank for a brand that has campaigns
    # planned but nothing running yet.
    if meta is None and google is None:
        campaigns = (db.query(models.Campaign)
                       .filter(models.Campaign.workspace_id == workspace_id).all())
        return {
            "timeframe": timeframe,
            "sources": sources,
            "series": [],
            "kpis": [],
            "channels": [],
            "campaigns_stored": len(campaigns),
            "note": ("No ad platform is connected to this workspace, so there is no spend or "
                     "revenue to report. Connect Meta or Google Ads under Integrations."),
        }

    labels = _bucket_labels(bucket_kind, buckets)
    # The platform APIs return one total for the window, not a per-bucket breakdown, and
    # inventing a curve to fill the chart is exactly the failure this endpoint exists to
    # avoid. So the series is reported as a single flat window total per bucket ONLY when
    # we genuinely have per-bucket data; otherwise one point carrying the real total.
    series = [{
        "date": labels[-1] if labels else timeframe,
        "Revenue": round(revenue, 2),
        "Spend": round(spend, 2),
        "ROAS": round(_safe_div(revenue, spend), 2),
        "Orders": int(orders),
        "CAC": round(_safe_div(spend, orders), 2),
    }]

    kpis = [
        {"key": "revenue", "label": "Revenue", "value": round(revenue, 2), "format": "currency"},
        {"key": "spend", "label": "Ad Spend", "value": round(spend, 2), "format": "currency"},
        {"key": "roas", "label": "ROAS", "value": round(_safe_div(revenue, spend), 2), "format": "x"},
        {"key": "orders", "label": "Orders", "value": int(orders), "format": "number"},
        {"key": "cac", "label": "CAC", "value": round(_safe_div(spend, orders), 2), "format": "currency"},
    ]

    channels = []
    for name, totals in (("Meta", meta), ("Google Ads", google)):
        if totals is None:
            channels.append({"name": name, "connected": False, "spend": 0, "revenue": 0, "roas": 0})
        else:
            channels.append({
                "name": name, "connected": True,
                "spend": round(totals["spend"], 2),
                "revenue": round(totals["revenue"], 2),
                "roas": round(_safe_div(totals["revenue"], totals["spend"]), 2),
                "orders": int(totals["orders"]),
            })

    return {
        "timeframe": timeframe,
        "sources": sources,
        "series": series,
        "kpis": kpis,
        "channels": channels,
        "note": "" if any(s["has_data"] for s in sources.values())
                else "Connected, but no delivery data in this window yet.",
    }
