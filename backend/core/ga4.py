"""
Google Analytics 4 (GA4) traffic reader.

Reuses the same per-workspace Google OAuth connection as Search Console (see
core.search_console) — one "Connect Google" grants both. Reads real traffic:
active users, sessions, page views, and the channels driving them.

Requires (founder, one-time):
  - The scope https://www.googleapis.com/auth/analytics.readonly on the OAuth
    consent screen (already added alongside the Search Console scope).
  - A GA4 property the connected account can access; its numeric Property ID is
    entered in the UI (Admin → Property Settings → "PROPERTY ID").
"""
import datetime
from googleapiclient.discovery import build

from core.search_console import credentials_from_connection


def _service(conn):
    return build("analyticsdata", "v1beta", credentials=credentials_from_connection(conn), cache_discovery=False)


def fetch_traffic(conn, days: int = 28) -> dict:
    """Traffic totals + the channels driving it, for the last `days` days."""
    if not conn.ga4_property_id:
        raise RuntimeError("No GA4 property selected.")
    svc = _service(conn)
    end = datetime.date.today()
    start = end - datetime.timedelta(days=days)
    prop = f"properties/{conn.ga4_property_id}"

    # 1) Headline totals.
    totals_resp = svc.properties().runReport(property=prop, body={
        "dateRanges": [{"startDate": start.isoformat(), "endDate": end.isoformat()}],
        "metrics": [{"name": "activeUsers"}, {"name": "sessions"}, {"name": "screenPageViews"}],
    }).execute()
    trow = (totals_resp.get("rows") or [{}])
    tvals = trow[0].get("metricValues", []) if trow else []
    totals = {
        "active_users": int(tvals[0]["value"]) if len(tvals) > 0 else 0,
        "sessions": int(tvals[1]["value"]) if len(tvals) > 1 else 0,
        "page_views": int(tvals[2]["value"]) if len(tvals) > 2 else 0,
    }

    # 2) Sessions broken down by acquisition channel.
    ch_resp = svc.properties().runReport(property=prop, body={
        "dateRanges": [{"startDate": start.isoformat(), "endDate": end.isoformat()}],
        "dimensions": [{"name": "sessionDefaultChannelGroup"}],
        "metrics": [{"name": "sessions"}, {"name": "activeUsers"}],
        "orderBys": [{"metric": {"metricName": "sessions"}, "desc": True}],
        "limit": 10,
    }).execute()
    channels = []
    for r in ch_resp.get("rows", []):
        keys = r.get("dimensionValues", [])
        vals = r.get("metricValues", [])
        channels.append({
            "channel": keys[0]["value"] if keys else "(other)",
            "sessions": int(vals[0]["value"]) if len(vals) > 0 else 0,
            "users": int(vals[1]["value"]) if len(vals) > 1 else 0,
        })

    return {"totals": totals, "channels": channels, "range_days": days}
