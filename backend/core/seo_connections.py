"""Everything the SEO and GEO pipelines can learn from this workspace's connected accounts.

Both pipelines used to reach into Search Console in one place only — the SEO keyword node —
and ignore every other connection the workspace had. GA4 was never read, the GSC index status
of the audited page was never checked even though the connection that answers it was already
authorised, and the publishing node guessed at whether a site connector existed. So an audit
of a site with three live integrations was scored almost entirely from the page's own HTML.

This gathers all of it once, before the graph runs, and hands each node its slice.

Two rules hold throughout:

  * Nothing here raises. An audit must not fail because one integration's token expired, and
    a pipeline that dies at the fifth node leaves the user with nothing at all. Every section
    degrades to {"connected": False, "message": "<why>"} and the nodes report that verbatim.

  * A missing connection is never silently replaced with an estimate. "Not connected" and
    "connected but zero traffic" are different facts about a business and the report says
    which one it is — the same discipline core/seo_scoring.py applies with Not Verified.
"""
import asyncio
import datetime


def _empty(msg: str, **extra) -> dict:
    return {"connected": False, "message": msg, **extra}


async def _search_console(db, models, workspace_id: int, target_url: str) -> dict:
    from core import search_console as gsc

    conn = (db.query(models.SearchConsoleConnection)
              .filter(models.SearchConsoleConnection.workspace_id == workspace_id).first())
    if not conn or not conn.refresh_token:
        return _empty("Connect Google Search Console to see the real queries, impressions and "
                      "index status behind this page.")
    if not conn.site_url:
        return _empty("Search Console is connected but no property is selected — choose one to "
                      "pull this site's search performance.")

    out = {"connected": True, "message": None, "site_url": conn.site_url,
           "queries": [], "totals": {}, "pages": [], "countries": [], "devices": [],
           "index_status": None, "errors": []}

    # Queries and site-wide totals. fetch_overview already batches the breakdowns and ends its
    # window 3 days back, because Search Console lags and a window ending today reports zeros
    # for a perfectly healthy site.
    try:
        overview = await asyncio.to_thread(gsc.fetch_overview, conn, 28, 15)
        out.update({
            "totals": overview.get("totals") or {},
            "queries": overview.get("queries") or [],
            "pages": overview.get("pages") or [],
            "countries": overview.get("countries") or [],
            "devices": overview.get("devices") or [],
            "range_days": overview.get("range_days"),
            "start_date": overview.get("start_date"),
            "end_date": overview.get("end_date"),
        })
    except Exception as e:
        out["errors"].append(f"Search Console performance unavailable: {str(e)[:160]}")

    # Whether Google has actually indexed the exact page being audited. This is the single
    # most consequential fact in an SEO audit and nothing was asking for it: every on-page
    # recommendation is worthless while the URL sits outside the index, and that is invisible
    # from the HTML no matter how carefully it is parsed.
    try:
        out["index_status"] = await asyncio.to_thread(gsc.inspect_url, conn, target_url)
    except Exception as e:
        out["errors"].append(f"URL inspection unavailable: {str(e)[:160]}")

    # The performance of this specific URL, picked out of the site-wide page breakdown, so a
    # page-level audit can talk about the page rather than the domain.
    norm = (target_url or "").rstrip("/")
    out["this_page"] = next(
        (p for p in out.get("pages") or [] if str(p.get("key", "")).rstrip("/") == norm), None)

    try:
        conn.last_synced_at = datetime.datetime.utcnow()
        db.commit()          # also persists any access token refreshed during these calls
    except Exception:
        db.rollback()
    return out


async def _ga4(db, models, workspace_id: int) -> dict:
    from core import ga4

    conn = (db.query(models.SearchConsoleConnection)
              .filter(models.SearchConsoleConnection.workspace_id == workspace_id).first())
    # GA4 rides on the same Google grant as Search Console (one consent screen, both scopes),
    # so the property id lives on that row rather than on a connection of its own.
    if not conn or not conn.refresh_token:
        return _empty("Connect Google to read GA4 traffic alongside search performance.")
    if not getattr(conn, "ga4_property_id", None):
        return _empty("Google is connected but no GA4 property is selected.")
    try:
        traffic = await asyncio.to_thread(ga4.fetch_traffic, conn, 28)
        return {"connected": True, "message": None,
                "property_id": conn.ga4_property_id, "traffic": traffic}
    except Exception as e:
        return _empty(f"GA4 traffic unavailable: {str(e)[:160]}",
                      property_id=conn.ga4_property_id)


def _site(db, models, workspace_id: int) -> dict:
    """Which site connector could actually apply the fixes this audit recommends.

    The publishing node asserted "no site connector is wired up yet" unconditionally, which
    was wrong for any workspace that had connected one. Whether a change can be applied is a
    fact about the workspace, so it gets looked up rather than assumed.
    """
    for kind, model, label in (
        ("github", models.GitHubConnection, "GitHub"),
        ("wordpress", models.WordPressConnection, "WordPress"),
        ("shopify", models.ShopifyConnection, "Shopify"),
    ):
        try:
            row = db.query(model).filter(model.workspace_id == workspace_id).first()
        except Exception:
            continue
        if not row:
            continue
        token = getattr(row, "access_token", None) or getattr(row, "app_password", None)
        if not token:
            continue
        target = (getattr(row, "repo_full_name", None) or getattr(row, "shop_domain", None)
                  or getattr(row, "site_url", None) or label)
        return {"connected": True, "message": None, "kind": kind, "label": label, "target": target}
    return _empty("Connect GitHub, WordPress or Shopify to apply these changes automatically. "
                  "Nothing is published without one.")


async def gather(workspace_id: int, target_url: str) -> dict:
    """Read every integration this audit can use. Never raises; see module docstring."""
    if not workspace_id:
        return {"search_console": _empty("No workspace."), "ga4": _empty("No workspace."),
                "site": _empty("No workspace.")}
    from database import SessionLocal
    import models

    db = SessionLocal()
    try:
        # Sequential rather than gathered: these are blocking Google client calls dispatched
        # to threads, and they share one SQLAlchemy Session, which is not safe to use from
        # several threads at once. The whole set costs a few seconds against a pipeline that
        # already spends far longer crawling.
        sc = await _search_console(db, models, workspace_id, target_url)
        ga = await _ga4(db, models, workspace_id)
        site = _site(db, models, workspace_id)
        return {"search_console": sc, "ga4": ga, "site": site}
    except Exception as e:
        msg = f"Could not read connected accounts: {str(e)[:160]}"
        return {"search_console": _empty(msg), "ga4": _empty(msg), "site": _empty(msg)}
    finally:
        db.close()


def summary_line(connections: dict) -> str:
    """One line naming what this audit was able to read, for the activity log."""
    bits = []
    sc = connections.get("search_console") or {}
    ga = connections.get("ga4") or {}
    site = connections.get("site") or {}
    if sc.get("connected"):
        t = sc.get("totals") or {}
        bits.append(f"Search Console ({t.get('clicks', 0)} clicks / "
                    f"{t.get('impressions', 0)} impressions, 28d)")
    if ga.get("connected"):
        tot = ((ga.get("traffic") or {}).get("totals") or {})
        bits.append(f"GA4 ({tot.get('sessions', 0)} sessions, 28d)")
    if site.get("connected"):
        bits.append(f"{site.get('label')} ({site.get('target')})")
    return ("Connected data in this audit: " + "; ".join(bits)) if bits else (
        "No analytics or site connections are linked — this audit is based on the page's own "
        "HTML only.")
