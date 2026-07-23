"""
Meta (Facebook) Ads connector via the Marketing API.

Capabilities:
  - OAuth connect (returns a long-lived user token).
  - List the ad accounts the user can manage.
  - Publish a campaign to a real ad account — created in PAUSED status so it never
    spends money until the user activates it in Meta Ads Manager.

Requires (founder, one-time, at developers.facebook.com):
  - A Meta app with the Marketing API product → META_APP_ID + META_APP_SECRET.
  - OAuth redirect URI registered: {BACKEND_URL}/api/connectors/meta/callback
  - In Development mode this works immediately for the app admin's own ad account;
    App Review (ads_management) is only needed to let other users connect.
"""
import os
import datetime
import httpx

GRAPH = "https://graph.facebook.com/v19.0"
META_APP_ID = os.getenv("META_APP_ID", "")
META_APP_SECRET = os.getenv("META_APP_SECRET", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8005")
REDIRECT_URI = f"{BACKEND_URL}/api/connectors/meta/callback"
SCOPES = "ads_management,ads_read"

# Map our internal objective names to Meta's ODAX campaign objectives.
_OBJECTIVE_MAP = {
    "conversions": "OUTCOME_SALES",
    "sales": "OUTCOME_SALES",
    "traffic": "OUTCOME_TRAFFIC",
    "leads": "OUTCOME_LEADS",
    "lead generation": "OUTCOME_LEADS",
    "awareness": "OUTCOME_AWARENESS",
    "brand awareness": "OUTCOME_AWARENESS",
    "engagement": "OUTCOME_ENGAGEMENT",
}


def is_configured() -> bool:
    return bool(META_APP_ID and META_APP_SECRET)


def build_authorize_url(state: str) -> str:
    from urllib.parse import urlencode
    params = urlencode({
        "client_id": META_APP_ID,
        "redirect_uri": REDIRECT_URI,
        "state": state,
        "scope": SCOPES,
        "response_type": "code",
    })
    return f"https://www.facebook.com/v19.0/dialog/oauth?{params}"


async def exchange_code(code: str) -> dict:
    """Exchange the code for a short-lived token, then upgrade to a long-lived one."""
    async with httpx.AsyncClient(timeout=30) as client:
        short = await client.get(f"{GRAPH}/oauth/access_token", params={
            "client_id": META_APP_ID,
            "client_secret": META_APP_SECRET,
            "redirect_uri": REDIRECT_URI,
            "code": code,
        })
        if short.status_code != 200:
            raise RuntimeError(f"Meta token exchange failed: {short.status_code} {short.text[:200]}")
        short_token = short.json().get("access_token")
        # Upgrade to a long-lived (~60 day) token.
        long = await client.get(f"{GRAPH}/oauth/access_token", params={
            "grant_type": "fb_exchange_token",
            "client_id": META_APP_ID,
            "client_secret": META_APP_SECRET,
            "fb_exchange_token": short_token,
        })
    data = long.json() if long.status_code == 200 else {"access_token": short_token, "expires_in": 3600}
    return {"access_token": data.get("access_token", short_token), "expires_in": data.get("expires_in", 5184000)}


async def fetch_user_name(token: str) -> str:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{GRAPH}/me", params={"fields": "name", "access_token": token})
    return r.json().get("name", "") if r.status_code == 200 else ""


async def list_ad_accounts(token: str) -> list:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{GRAPH}/me/adaccounts", params={
            "fields": "account_id,name,account_status,currency",
            "access_token": token,
        })
    if r.status_code != 200:
        raise RuntimeError(f"Could not list ad accounts: {r.status_code} {r.text[:200]}")
    out = []
    for a in r.json().get("data", []):
        out.append({
            "account_id": a.get("account_id"),
            "name": a.get("name") or a.get("account_id"),
            "currency": a.get("currency"),
            "active": a.get("account_status") == 1,
        })
    return out


async def publish_campaign(conn, name: str, objective: str) -> dict:
    """Create a campaign on the connected ad account, in PAUSED status (no spend).
    Returns {'campaign_id', 'meta_objective', 'url'}."""
    if not conn.ad_account_id:
        raise RuntimeError("No Meta ad account selected.")
    meta_objective = _OBJECTIVE_MAP.get((objective or "").strip().lower(), "OUTCOME_TRAFFIC")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{GRAPH}/act_{conn.ad_account_id}/campaigns", data={
            "name": name or "Raftra Campaign",
            "objective": meta_objective,
            "status": "PAUSED",                 # never auto-spend
            "special_ad_categories": "[]",
            "access_token": conn.access_token,
        })
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Meta campaign create failed: {r.status_code} {r.text[:300]}")
    cid = r.json().get("id")
    return {
        "campaign_id": cid,
        "meta_objective": meta_objective,
        "url": f"https://adsmanager.facebook.com/adsmanager/manage/campaigns?act={conn.ad_account_id}&selected_campaign_ids={cid}",
    }
