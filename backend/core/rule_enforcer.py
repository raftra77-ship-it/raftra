"""
Enforces each campaign's own Optimization Rules against live Meta performance.

The rules editor ("Auto-kill bad ads", a CPA limit, a frequency cap) wrote
metrics["optimization"] and absolutely nothing read it: no job compared a CPA to the limit
and no code path paused anything. The screen said "Configured" and promised "safety limits
applied once ads are live", so a user could set "kill if CPA over ₹500", believe their spend
was capped, and have nothing at all standing behind it. This is the missing half.

OFF BY DEFAULT (ENABLE_RULE_ENFORCEMENT), like every other unattended job here. Pausing
someone's live advertising without them present is a real action with real consequences, so
it takes a deliberate decision per deployment — and a dev machine pointed at the production
database must never quietly pause a customer's campaigns.

Two deliberate limits on what it will touch:
  * Only campaigns this product started (metrics.delivery.meta.status == ACTIVE). A campaign
    someone runs by hand in Ads Manager is theirs, not ours to pause.
  * Only when that campaign's own auto_kill is on. A CPA limit with the toggle off is a
    target the user wants to watch, not permission to stop their ads.

The breach test itself lives in core.campaign_optimizer.rule_breaches, shared with the
recommendations feed, so what the user is told and what happens automatically cannot drift
apart.
"""
import os
from datetime import datetime


def enabled() -> bool:
    """Unattended pausing is opt-in; anything but an explicit truthy value keeps it off."""
    return os.getenv("ENABLE_RULE_ENFORCEMENT", "false").strip().lower() in ("1", "true", "yes", "on")


async def enforce_workspace(workspace_id: int, db) -> dict:
    """Check one workspace's live campaigns against their rules. Returns a small report.

    Never raises: this runs unattended, and one workspace with a revoked token must not stop
    the others from being checked.
    """
    import models
    from core import meta_ads as meta
    from core.campaign_optimizer import rule_breaches

    out = {"workspace_id": workspace_id, "checked": 0, "paused": [], "errors": []}
    conn = (db.query(models.MetaAdsConnection)
              .filter(models.MetaAdsConnection.workspace_id == workspace_id).first())
    if not conn or not conn.access_token or not conn.ad_account_id:
        return out
    if getattr(conn, "auth_error", None):
        out["errors"].append("Meta connection needs reconnecting")
        return out

    # Campaigns this product published for real AND started. Anything else is out of scope.
    candidates = []
    for row in (db.query(models.Campaign)
                  .filter(models.Campaign.workspace_id == workspace_id,
                          models.Campaign.meta_campaign_id.isnot(None)).all()):
        m = row.metrics or {}
        rules = m.get("optimization") or {}
        if not rules.get("auto_kill"):
            continue
        if ((m.get("delivery") or {}).get("meta") or {}).get("status") != "ACTIVE":
            continue
        candidates.append((row, rules))
    if not candidates:
        return out

    try:
        insights = await meta.fetch_insights(conn, date_preset="last_7d")
    except Exception as e:
        out["errors"].append(f"Could not read Meta insights: {e}")
        return out

    for row, rules in candidates:
        cid = str(row.meta_campaign_id)
        m = insights.get(cid)
        if not m:
            continue                      # no delivery reported in the window
        out["checked"] += 1
        reasons = rule_breaches(m, rules)
        if not reasons:
            continue
        why = "; ".join(reasons)
        try:
            await meta.set_campaign_status(conn, cid, "PAUSED")
        except Exception as e:
            out["errors"].append(f"campaign {row.id}: could not pause: {e}")
            continue

        meta_metrics = dict(row.metrics or {})
        delivery = dict(meta_metrics.get("delivery") or {})
        delivery["meta"] = {"status": "PAUSED", "at": datetime.utcnow().isoformat(),
                            "by": "rule_enforcement", "reason": why}
        meta_metrics["delivery"] = delivery
        # Written to the campaign's own activity trail so the pause is explainable later —
        # finding an ad stopped with no recorded reason is its own kind of broken.
        entries = list(meta_metrics.get("activity") or [])
        entries.append({"at": datetime.utcnow().isoformat(),
                        "text": f"Paused automatically — {why}"})
        meta_metrics["activity"] = entries[-50:]
        row.metrics = meta_metrics
        out["paused"].append({"campaign_id": row.id, "meta_campaign_id": cid, "reason": why})

    if out["paused"]:
        db.commit()
    return out


async def run_rule_enforcement() -> dict:
    """Every workspace with a Meta connection. Called by the scheduler."""
    from database import SessionLocal
    import models

    db = SessionLocal()
    report = {"workspaces": 0, "paused": 0, "errors": []}
    try:
        ids = [w.workspace_id for w in db.query(models.MetaAdsConnection).all()]
        for wid in ids:
            try:
                res = await enforce_workspace(wid, db)
            except Exception as e:
                report["errors"].append(f"workspace {wid}: {e}")
                continue
            report["workspaces"] += 1
            report["paused"] += len(res["paused"])
            report["errors"].extend(res["errors"])
            for p in res["paused"]:
                print(f"[rule_enforcement] paused campaign {p['campaign_id']} "
                      f"(meta {p['meta_campaign_id']}): {p['reason']}")
    finally:
        db.close()
    return report
