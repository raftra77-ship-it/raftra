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
from core import tenancy

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
                    tenancy.visible_workspace(current_user)).first())
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


def _source_states(db: Session, workspace_id: int, meta: Optional[dict],
                   google: Optional[dict]) -> dict:
    """Connection state for every source the Growth section can show.

    Only meta and google were reported here, so the component's ga4/gsc/shopify indicators
    fell back to its own optimistic defaults and painted themselves connected. GA4 and
    Search Console share one Google grant - the row is the Search Console connection, and
    GA4 counts as live only once a property has actually been chosen on it.
    """
    def _row(model):
        try:
            return db.query(model).filter(model.workspace_id == workspace_id).first()
        except Exception as e:
            # Same encrypted-credential caveat as the connector helpers above.
            print("[analytics] %s unreadable for ws %s: %s" % (model.__name__, workspace_id, e))
            return None

    gsc_conn = _row(models.SearchConsoleConnection)
    shop_conn = _row(models.ShopifyConnection)
    meta_conn = _row(models.MetaAdsConnection)
    gads_conn = _row(models.GoogleAdsConnection)

    # Read `connected` from the connection row, not from whether the insights call parsed.
    # _meta_totals/_google_totals return None both when nothing is linked AND when a linked
    # account could not be read - a Google Ads customer that is a manager (MCC) holds no
    # campaigns, so its metrics query always fails - which reported a genuinely connected
    # account as disconnected. This module's contract is that those are different problems.
    meta_linked = bool(meta_conn and getattr(meta_conn, "ad_account_id", None))
    gads_linked = bool(gads_conn and getattr(gads_conn, "customer_id", None))

    gsc_ok = bool(gsc_conn and getattr(gsc_conn, "refresh_token", None)
                  and getattr(gsc_conn, "site_url", None))
    ga4_ok = bool(gsc_conn and getattr(gsc_conn, "refresh_token", None)
                  and getattr(gsc_conn, "ga4_property_id", None))
    shop_ok = bool(shop_conn and getattr(shop_conn, "shop_domain", None))

    return {
        "meta": {"connected": meta_linked,
                 "has_data": bool(meta and (meta["spend"] or meta["revenue"]))},
        "google": {"connected": gads_linked,
                   "has_data": bool(google and (google["spend"] or google["revenue"]))},
        # These three have no metrics wired into this endpoint yet, so has_data stays False.
        # Reporting the connection honestly is still better than the component assuming it.
        "ga4": {"connected": ga4_ok, "has_data": False},
        "gsc": {"connected": gsc_ok, "has_data": False},
        "shopify": {"connected": shop_ok, "has_data": False},
    }


# Application states that mean the brand has actually committed money to a creator.
_COMMITTED_DEAL_STATES = ("ACCEPTED", "CONFIRMED", "COMPLETED")


def _influencer_totals(db: Session, workspace_id: int, days: int) -> dict:
    """Real creator spend for this workspace, from finalized deal applications.

    This is the one channel the product measures itself rather than reading from an ad
    platform, and it was the only one the component filled with invented profiles. What is
    genuinely known is who was booked and what they were paid; per-creator REVENUE is not
    tracked anywhere, so no ROAS is returned and the caller must not compute one.
    """
    since = datetime.utcnow() - timedelta(days=days)
    try:
        rows = (db.query(models.DealApplication)
                  .filter(models.DealApplication.workspace_id == workspace_id,
                          models.DealApplication.status.in_(_COMMITTED_DEAL_STATES),
                          models.DealApplication.created_at >= since)
                  .order_by(models.DealApplication.created_at.desc())
                  .all())
    except Exception as e:
        print("[analytics] influencer read failed for ws %s: %s" % (workspace_id, e))
        return {"spend": 0.0, "creators": [], "booked": 0}

    creators, spend = [], 0.0
    for r in rows:
        price = float(r.final_price if r.final_price is not None else (r.proposed_price or 0))
        spend += price
        creators.append({
            "handle": r.creator_handle,
            "name": r.creator_name,
            "avatar": r.creator_avatar,
            "followers": r.creator_followers,
            "engagement": r.creator_engagement,
            "cost": round(price, 2),
            "status": r.status,
            # Explicit so the UI never fills a ROAS column with something plausible.
            "revenue_tracked": False,
        })
    creators.sort(key=lambda c: c["cost"], reverse=True)
    return {"spend": round(spend, 2), "creators": creators[:6], "booked": len(rows)}


def _channel_rows(meta: Optional[dict], google: Optional[dict], influencer: dict) -> List[dict]:
    """The channel table. Every row is a source this product can actually measure.

    The component listed six channels including Email Marketing and Direct/Referral with
    figures behind them; nothing in this codebase ingests either, so they are not returned.
    `revenue_tracked` lets the UI render spend for a channel whose return genuinely is not
    measured, instead of printing a ROAS it cannot support.
    """
    rows: List[dict] = []
    for name, totals in (("Meta Ads", meta), ("Google Ads", google)):
        if totals is None:
            rows.append({"name": name, "connected": False, "spend": 0, "revenue": 0,
                         "roas": 0, "orders": 0, "revenue_tracked": True})
        else:
            rows.append({
                "name": name, "connected": True,
                "spend": round(totals["spend"], 2),
                "revenue": round(totals["revenue"], 2),
                "roas": round(_safe_div(totals["revenue"], totals["spend"]), 2),
                "orders": int(totals["orders"]),
                "revenue_tracked": True,
            })

    rows.append({
        "name": "Influencer / UGC",
        # "Connected" here means the brand has actually booked creators, which is what the
        # row has to show; there is no external account to link for this channel.
        "connected": influencer["booked"] > 0,
        "spend": influencer["spend"],
        "revenue": 0,
        "roas": 0,
        "orders": 0,
        "booked": influencer["booked"],
        "revenue_tracked": False,
    })
    return rows


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

    sources = _source_states(db, workspace_id, meta, google)
    # Creator spend is measured by this product, not by an ad platform, so it is available
    # whether or not Meta/Google are linked.
    influencer = _influencer_totals(db, workspace_id, int(timeframe.rstrip("D")))

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
            # Creator bookings are still real even with no ad platform linked, so the
            # channel table and the influencer list are not blanked out here.
            "channels": _channel_rows(None, None, influencer),
            "influencers": influencer["creators"],
            "influencer_spend": influencer["spend"],
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

    return {
        "timeframe": timeframe,
        "sources": sources,
        "series": series,
        "kpis": kpis,
        "channels": _channel_rows(meta, google, influencer),
        "influencers": influencer["creators"],
        "influencer_spend": influencer["spend"],
        "note": "" if any(s["has_data"] for s in sources.values())
                else "Connected, but no delivery data in this window yet.",
    }
