"""
Google Ads API connector.

Uses the Google Ads REST API directly via httpx (same pattern as meta_ads.py) rather than the
official google-ads Python client library, to avoid its heavy gRPC dependency and match this
codebase's existing style.

Requires (founder, one-time):
  - A Google Cloud OAuth client (can reuse the one already used for GOOGLE_CLIENT_ID/SECRET)
    with the https://www.googleapis.com/auth/adwords scope added on its consent screen, and
    this redirect URI registered: {BACKEND_URL}/api/connectors/google-ads/callback
  - A Google Ads developer token (Manager account -> Tools & Settings -> API Center).
    Test Account access works immediately against a designated test account; Basic Access
    (needed for a real customer account) requires Google's review (~5 business days).
  - The Manager (MCC) account's Customer ID, used as the login-customer-id header on every call.

NOT YET LIVE-TESTED end to end: unlike the Meta connector, this has not been exercised against
a real Google Ads account, since Basic Access approval is pending at the time this was written.
The REST contract below follows Google's documented Ads API shape; verify against a real/test
account once access is granted, and treat error messages as the first debugging signal.
"""
import os
import datetime
import httpx

API_VERSION = "v22"
GOOGLE_ADS_HOST = f"https://googleads.googleapis.com/{API_VERSION}"
TOKEN_URI = "https://oauth2.googleapis.com/token"

CLIENT_ID = os.getenv("GOOGLE_ADS_CLIENT_ID", "")
CLIENT_SECRET = os.getenv("GOOGLE_ADS_CLIENT_SECRET", "")
DEVELOPER_TOKEN = os.getenv("GOOGLE_ADS_DEVELOPER_TOKEN", "")
LOGIN_CUSTOMER_ID = os.getenv("GOOGLE_ADS_LOGIN_CUSTOMER_ID", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8005")
REDIRECT_URI = f"{BACKEND_URL}/api/connectors/google-ads/callback"
SCOPE = "https://www.googleapis.com/auth/adwords"

# Conservative bidding defaults that work without a conversion-tracking setup. Conversions-style
# objectives still use Maximize Clicks until the caller confirms conversion tracking exists -
# Maximize Conversions with no conversion data configured is a common source of API errors.
_OBJECTIVE_TO_BIDDING = {
    "traffic": "MAXIMIZE_CLICKS",
    "awareness": "MAXIMIZE_CLICKS",
    "brand awareness": "MAXIMIZE_CLICKS",
    "engagement": "MAXIMIZE_CLICKS",
}


def is_configured() -> bool:
    return bool(CLIENT_ID and CLIENT_SECRET and DEVELOPER_TOKEN)


def build_authorize_url(state: str) -> str:
    from urllib.parse import urlencode
    params = urlencode({
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": SCOPE,
        "state": state,
        # offline + consent so Google returns a refresh_token (needed since access tokens
        # expire in ~1 hour and there's no user present to re-consent on every call).
        "access_type": "offline",
        "prompt": "consent",
    })
    return f"https://accounts.google.com/o/oauth2/v2/auth?{params}"


async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(TOKEN_URI, data={
            "code": code,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
        })
    if r.status_code != 200:
        raise RuntimeError(f"Google Ads token exchange failed: {r.status_code} {r.text[:300]}")
    return r.json()


async def fetch_user_email(access_token: str) -> str:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get("https://www.googleapis.com/oauth2/v3/userinfo",
                             headers={"Authorization": f"Bearer {access_token}"})
    return r.json().get("email", "") if r.status_code == 200 else ""


async def _ensure_access_token(conn) -> str:
    """Refresh the access token if missing/near-expiry, persisting the new token + expiry onto
    the connection object. Caller (the route handler) is responsible for db.commit()."""
    if (conn.access_token and conn.token_expiry
            and conn.token_expiry > datetime.datetime.utcnow() + datetime.timedelta(minutes=2)):
        return conn.access_token
    if not conn.refresh_token:
        raise RuntimeError("Google Ads connection has no refresh token - reconnect required.")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(TOKEN_URI, data={
            "refresh_token": conn.refresh_token,
            "client_id": CLIENT_ID,
            "client_secret": CLIENT_SECRET,
            "grant_type": "refresh_token",
        })
    if r.status_code != 200:
        raise RuntimeError(f"Could not refresh Google Ads token: {r.status_code} {r.text[:300]}")
    data = r.json()
    conn.access_token = data["access_token"]
    conn.token_expiry = datetime.datetime.utcnow() + datetime.timedelta(seconds=int(data.get("expires_in", 3600)))
    return conn.access_token


def _headers(access_token: str) -> dict:
    lcid = (LOGIN_CUSTOMER_ID or "").replace("-", "")
    h = {
        "Authorization": f"Bearer {access_token}",
        "developer-token": DEVELOPER_TOKEN,
        "Content-Type": "application/json",
    }
    if lcid:
        h["login-customer-id"] = lcid
    return h


def _micros_to_major(v):
    try:
        return round(int(v) / 1_000_000, 2) if v is not None else None
    except (TypeError, ValueError):
        return None


async def _search(conn, customer_id: str, query: str, token_override: str = None) -> list:
    token = token_override or await _ensure_access_token(conn)
    async with httpx.AsyncClient(timeout=40) as client:
        r = await client.post(
            f"{GOOGLE_ADS_HOST}/customers/{customer_id}/googleAds:search",
            headers=_headers(token),
            json={"query": query},
        )
    if r.status_code != 200:
        raise RuntimeError(f"Google Ads query failed: {r.status_code} {r.text[:400]}")
    return r.json().get("results", [])


async def list_accessible_customers(conn) -> list:
    """Every Google Ads customer account this OAuth user can reach (typically the accounts
    under the connected Manager/MCC account)."""
    token = await _ensure_access_token(conn)
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{GOOGLE_ADS_HOST}/customers:listAccessibleCustomers",
                             headers=_headers(token))
    if r.status_code != 200:
        raise RuntimeError(f"Could not list accessible customers: {r.status_code} {r.text[:300]}")
    customer_ids = [rn.split("/")[-1] for rn in r.json().get("resourceNames", [])]
    out = []
    for cid in customer_ids:
        name = cid
        try:
            rows = await _search(conn, cid,
                "SELECT customer.descriptive_name, customer.currency_code FROM customer LIMIT 1",
                token_override=token)
            if rows:
                name = rows[0]["customer"].get("descriptiveName") or cid
        except Exception:
            pass  # a single account failing to resolve a display name isn't fatal
        out.append({"customer_id": cid, "name": name})
    return out


async def list_campaigns(conn) -> list:
    if not conn.customer_id:
        raise RuntimeError("No Google Ads customer account selected.")
    rows = await _search(conn, conn.customer_id,
        "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, "
        "campaign_budget.amount_micros, campaign_budget.resource_name FROM campaign "
        "ORDER BY campaign.id DESC LIMIT 50")
    out = []
    for row in rows:
        c = row.get("campaign", {})
        budget = row.get("campaignBudget", {})
        out.append({
            "id": c.get("id"),
            "name": c.get("name"),
            "status": c.get("status"),
            "channel_type": c.get("advertisingChannelType"),
            "daily_budget": _micros_to_major(budget.get("amountMicros")),
            "budget_resource_name": budget.get("resourceName"),
        })
    return out


async def publish_campaign(conn, name: str, objective: str, daily_budget_major: float = 200.0) -> dict:
    """Create a campaign on the connected customer account, in PAUSED status (no spend).
    Two-step mutate: a standalone campaign budget, then the campaign itself."""
    if not conn.customer_id:
        raise RuntimeError("No Google Ads customer account selected.")
    token = await _ensure_access_token(conn)
    customer_id = conn.customer_id
    micros = int(round(float(daily_budget_major) * 1_000_000))

    async with httpx.AsyncClient(timeout=40) as client:
        budget_res = await client.post(
            f"{GOOGLE_ADS_HOST}/customers/{customer_id}/campaignBudgets:mutate",
            headers=_headers(token),
            json={"operations": [{"create": {
                "name": f"{name or 'Raftra Campaign'} - Budget - {int(datetime.datetime.utcnow().timestamp())}",
                "amountMicros": str(micros),
                "deliveryMethod": "STANDARD",
            }}]},
        )
        if budget_res.status_code not in (200, 201):
            raise RuntimeError(f"Budget create failed: {budget_res.status_code} {budget_res.text[:400]}")
        budget_resource = budget_res.json()["results"][0]["resourceName"]

        bidding = _OBJECTIVE_TO_BIDDING.get((objective or "").strip().lower(), "MAXIMIZE_CONVERSIONS")
        bidding_field = "maximizeClicks" if bidding == "MAXIMIZE_CLICKS" else "maximizeConversions"
        campaign_body = {
            "name": name or "Raftra Campaign",
            "status": "PAUSED",              # never auto-spend
            "advertisingChannelType": "SEARCH",
            "campaignBudget": budget_resource,
            bidding_field: {},
            "networkSettings": {
                "targetGoogleSearch": True,
                "targetSearchNetwork": True,
                "targetContentNetwork": False,
                "targetPartnerSearchNetwork": False,
            },
        }
        camp_res = await client.post(
            f"{GOOGLE_ADS_HOST}/customers/{customer_id}/campaigns:mutate",
            headers=_headers(token),
            json={"operations": [{"create": campaign_body}]},
        )
    if camp_res.status_code not in (200, 201):
        raise RuntimeError(f"Campaign create failed: {camp_res.status_code} {camp_res.text[:400]}")
    resource_name = camp_res.json()["results"][0]["resourceName"]
    campaign_id = resource_name.split("/")[-1]
    return {
        "campaign_id": campaign_id,
        "url": f"https://ads.google.com/aw/campaigns?campaignId={campaign_id}&ocid={customer_id}",
    }


async def set_campaign_status(conn, campaign_id: str, status: str) -> dict:
    """Pause (kill) or re-activate a campaign. status in {PAUSED, ENABLED}."""
    status = (status or "").upper()
    if status not in ("PAUSED", "ENABLED"):
        raise RuntimeError("status must be PAUSED or ENABLED")
    token = await _ensure_access_token(conn)
    resource_name = f"customers/{conn.customer_id}/campaigns/{campaign_id}"
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{GOOGLE_ADS_HOST}/customers/{conn.customer_id}/campaigns:mutate",
            headers=_headers(token),
            json={"operations": [{
                "update": {"resourceName": resource_name, "status": status},
                "updateMask": "status",
            }]},
        )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Could not update campaign status: {r.status_code} {r.text[:300]}")
    return {"campaign_id": campaign_id, "status": status}


async def update_campaign_budget(conn, budget_resource_name: str, daily_budget_major: float) -> dict:
    """Note: unlike Meta, the budget lives on a separate CampaignBudget resource, not the
    campaign itself - the caller needs that resource name (from list_campaigns), not the
    campaign id."""
    token = await _ensure_access_token(conn)
    minor = int(round(float(daily_budget_major) * 1_000_000))
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{GOOGLE_ADS_HOST}/customers/{conn.customer_id}/campaignBudgets:mutate",
            headers=_headers(token),
            json={"operations": [{
                "update": {"resourceName": budget_resource_name, "amountMicros": str(minor)},
                "updateMask": "amount_micros",
            }]},
        )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Could not update budget: {r.status_code} {r.text[:300]}")
    return {"daily_budget": round(minor / 1_000_000, 2)}


async def fetch_insights(conn, date_range: str = "LAST_7_DAYS") -> dict:
    """Per-campaign performance for the account, keyed by campaign_id. Real numbers only."""
    if not conn.customer_id:
        raise RuntimeError("No Google Ads customer account selected.")
    query = (
        "SELECT campaign.id, campaign.name, metrics.impressions, metrics.clicks, "
        "metrics.cost_micros, metrics.ctr, metrics.average_cpc, metrics.conversions, "
        "metrics.conversions_value "
        f"FROM campaign WHERE segments.date DURING {date_range}"
    )
    rows = await _search(conn, conn.customer_id, query)
    out = {}
    for row in rows:
        c = row.get("campaign", {})
        m = row.get("metrics", {})
        cid = c.get("id")
        cost = _micros_to_major(m.get("costMicros")) or 0.0
        conv_value = float(m.get("conversionsValue", 0) or 0)
        out[cid] = {
            "campaign_id": cid,
            "campaign_name": c.get("name"),
            "impressions": int(m.get("impressions", 0) or 0),
            "clicks": int(m.get("clicks", 0) or 0),
            "cost": cost,
            "ctr": round(float(m.get("ctr", 0) or 0) * 100, 2),
            "avg_cpc": _micros_to_major(m.get("averageCpc")),
            "conversions": float(m.get("conversions", 0) or 0),
            "roas": round(conv_value / cost, 2) if cost > 0 else 0.0,
        }
    return out
