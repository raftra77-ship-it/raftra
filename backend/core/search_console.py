"""
Google Search Console integration.

Two real capabilities, both of which directly move a site toward "showing up in
Google":
  1. Read the site's real search performance (top queries, clicks, impressions,
     average position) via the Search Analytics API.
  2. Submit a sitemap so Google discovers/indexes the site's pages.

We store a per-workspace OAuth refresh token (see models.SearchConsoleConnection)
and mint short-lived access tokens from it on demand.

Requires (founder, one-time, in Google Cloud Console):
  - The OAuth consent screen must list the scope
    https://www.googleapis.com/auth/webmasters and add the founder as a test user.
  - The redirect URI  {BACKEND_URL}/api/connectors/search-console/callback
    must be registered on the OAuth client.
  - The connecting Google account must own/have access to a *verified* Search
    Console property for the site.
"""
import os
import datetime
import httpx

# One "Connect Google" grants both capabilities:
#  - webmasters: read Search Console analytics AND submit sitemaps (the .readonly
#    variant can't submit sitemaps, which is half the point here).
#  - analytics.readonly: read GA4 traffic (users/sessions/channels).
GSC_SCOPE = "https://www.googleapis.com/auth/webmasters"
GA4_SCOPE = "https://www.googleapis.com/auth/analytics.readonly"
SCOPES = [GSC_SCOPE, GA4_SCOPE]

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8005")
TOKEN_URI = "https://oauth2.googleapis.com/token"

REDIRECT_URI = f"{BACKEND_URL}/api/connectors/search-console/callback"


def is_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def build_authorize_url(state: str) -> str:
    from urllib.parse import urlencode
    params = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "state": state,
        # offline + consent so Google returns a refresh_token (not just an access token).
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
    })
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"


async def exchange_code(code: str) -> dict:
    """Exchange the authorization code for tokens. Returns the raw token dict."""
    async with httpx.AsyncClient() as client:
        res = await client.post(TOKEN_URI, data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
        })
    if res.status_code != 200:
        raise RuntimeError(f"Google token exchange failed: {res.status_code} {res.text[:300]}")
    return res.json()


async def fetch_userinfo(access_token: str) -> dict:
    async with httpx.AsyncClient() as client:
        res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
    return res.json() if res.status_code == 200 else {}


# --- Authenticated API calls (run in a threadpool by the caller; googleapiclient is sync) ---

def credentials_from_connection(conn):
    """Build Google OAuth credentials from a stored connection, refreshing the
    access token if needed and writing the refreshed token back onto `conn`.
    Shared by both the Search Console and GA4 clients."""
    from google.oauth2.credentials import Credentials
    from google.auth.transport.requests import Request

    creds = Credentials(
        token=conn.access_token,
        refresh_token=conn.refresh_token,
        token_uri=TOKEN_URI,
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
    )
    # Refresh if we have no access token or it's expired.
    if not creds.valid:
        creds.refresh(Request())
        conn.access_token = creds.token
        if creds.expiry:
            conn.token_expiry = creds.expiry
    return creds


def _service(conn):
    """Build a Search Console API client from a stored connection."""
    from googleapiclient.discovery import build
    return build("searchconsole", "v1", credentials=credentials_from_connection(conn), cache_discovery=False)


def list_sites(conn) -> list:
    """Return the GSC properties this account can access, e.g. ['https://site.com/']."""
    svc = _service(conn)
    resp = svc.sites().list().execute()
    return [
        e["siteUrl"] for e in resp.get("siteEntry", [])
        if e.get("permissionLevel") != "siteUnverifiedUser"
    ]


def fetch_search_analytics(conn, days: int = 28, row_limit: int = 25) -> dict:
    """Top search queries for the connected site over the last `days` days."""
    svc = _service(conn)
    end = datetime.date.today()
    start = end - datetime.timedelta(days=days)
    resp = svc.searchanalytics().query(
        siteUrl=conn.site_url,
        body={
            "startDate": start.isoformat(),
            "endDate": end.isoformat(),
            "dimensions": ["query"],
            "rowLimit": row_limit,
        },
    ).execute()

    rows = []
    for r in resp.get("rows", []):
        rows.append({
            "query": (r.get("keys") or [""])[0],
            "clicks": r.get("clicks", 0),
            "impressions": r.get("impressions", 0),
            "ctr": round(r.get("ctr", 0) * 100, 2),          # percent
            "position": round(r.get("position", 0), 1),
        })
    totals = {
        "clicks": sum(x["clicks"] for x in rows),
        "impressions": sum(x["impressions"] for x in rows),
    }
    return {"rows": rows, "totals": totals, "range_days": days}


def submit_sitemap(conn, sitemap_url: str) -> None:
    """Submit a sitemap so Google discovers the site's pages (request indexing)."""
    svc = _service(conn)
    svc.sitemaps().submit(siteUrl=conn.site_url, feedpath=sitemap_url).execute()


def inspect_url(conn, page_url: str) -> dict:
    """Ask Google whether a specific page is indexed and how it sees it."""
    svc = _service(conn)
    resp = svc.urlInspection().index().inspect(
        body={"inspectionUrl": page_url, "siteUrl": conn.site_url}
    ).execute()
    result = resp.get("inspectionResult", {}).get("indexStatusResult", {})
    return {
        "coverage_state": result.get("coverageState"),
        "verdict": result.get("verdict"),
        "last_crawl": result.get("lastCrawlTime"),
        "google_canonical": result.get("googleCanonical"),
    }
