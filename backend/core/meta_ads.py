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
import json
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


# ----------------------------------------------------------------------------- reads
def _minor_to_major(v):
    """Meta returns budgets in the currency's minor unit (paise/cents). Convert to major."""
    try:
        return round(int(v) / 100.0, 2) if v is not None else None
    except (ValueError, TypeError):
        return None


async def list_campaigns(conn) -> list:
    """All campaigns on the connected ad account, with their status + budgets."""
    if not conn.ad_account_id:
        raise RuntimeError("No Meta ad account selected.")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{GRAPH}/act_{conn.ad_account_id}/campaigns", params={
            "fields": "id,name,objective,status,effective_status,daily_budget,lifetime_budget,created_time",
            "limit": 100,
            "access_token": conn.access_token,
        })
    if r.status_code != 200:
        raise RuntimeError(f"Could not list campaigns: {r.status_code} {r.text[:200]}")
    out = []
    for c in r.json().get("data", []):
        out.append({
            "id": c.get("id"),
            "name": c.get("name"),
            "objective": c.get("objective"),
            "status": c.get("status"),
            "effective_status": c.get("effective_status"),
            "daily_budget": _minor_to_major(c.get("daily_budget")),
            "lifetime_budget": _minor_to_major(c.get("lifetime_budget")),
            "created_time": c.get("created_time"),
        })
    return out


def _extract_action(rows, types) -> float:
    for a in (rows or []):
        if a.get("action_type") in types:
            try:
                return float(a.get("value", 0))
            except (ValueError, TypeError):
                return 0.0
    return 0.0


def _extract_roas(row) -> float:
    """ROAS from Meta's purchase_roas, falling back to purchase value / spend."""
    pr = row.get("purchase_roas")
    if isinstance(pr, list) and pr:
        try:
            return round(float(pr[0].get("value", 0)), 2)
        except (ValueError, TypeError):
            pass
    spend = float(row.get("spend", 0) or 0)
    val = _extract_action(row.get("action_values"), ("purchase", "omni_purchase"))
    return round(val / spend, 2) if spend > 0 else 0.0


async def fetch_insights(conn, date_preset="last_7d") -> dict:
    """Per-campaign performance for the account, keyed by campaign_id. Real numbers only —
    if Meta returns nothing for a campaign (no delivery yet), it simply won't appear."""
    if not conn.ad_account_id:
        raise RuntimeError("No Meta ad account selected.")
    fields = ("campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,reach,"
              "frequency,actions,action_values,purchase_roas")
    async with httpx.AsyncClient(timeout=40) as client:
        r = await client.get(f"{GRAPH}/act_{conn.ad_account_id}/insights", params={
            "level": "campaign",
            "fields": fields,
            "date_preset": date_preset,
            "limit": 200,
            "access_token": conn.access_token,
        })
    if r.status_code != 200:
        raise RuntimeError(f"Could not fetch insights: {r.status_code} {r.text[:200]}")
    out = {}
    for row in r.json().get("data", []):
        cid = row.get("campaign_id")
        spend = float(row.get("spend", 0) or 0)
        purchases = int(_extract_action(row.get("actions"), ("purchase", "omni_purchase")))
        out[cid] = {
            "campaign_id": cid,
            "campaign_name": row.get("campaign_name"),
            "spend": round(spend, 2),
            "impressions": int(float(row.get("impressions", 0) or 0)),
            "clicks": int(float(row.get("clicks", 0) or 0)),
            "ctr": round(float(row.get("ctr", 0) or 0), 3),
            "cpc": round(float(row.get("cpc", 0) or 0), 2),
            "cpm": round(float(row.get("cpm", 0) or 0), 2),
            "reach": int(float(row.get("reach", 0) or 0)),
            "frequency": round(float(row.get("frequency", 0) or 0), 2),
            "purchases": purchases,
            "roas": _extract_roas(row),
            "date_preset": date_preset,
        }
    return out


async def list_pages(conn) -> list:
    """Facebook Pages the user manages (needed to run an ad)."""
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{GRAPH}/me/accounts", params={
            "fields": "id,name",
            "access_token": conn.access_token,
        })
    if r.status_code != 200:
        raise RuntimeError(f"Could not list pages: {r.status_code} {r.text[:200]}")
    return [{"id": p.get("id"), "name": p.get("name")} for p in r.json().get("data", [])]


# ---------------------------------------------------------------------------- writes
async def set_campaign_status(conn, campaign_id: str, status: str) -> dict:
    """Pause (kill) or re-activate a campaign. status in {PAUSED, ACTIVE}."""
    status = (status or "").upper()
    if status not in ("PAUSED", "ACTIVE"):
        raise RuntimeError("status must be PAUSED or ACTIVE")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{GRAPH}/{campaign_id}", data={
            "status": status,
            "access_token": conn.access_token,
        })
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Could not update campaign status: {r.status_code} {r.text[:200]}")
    return {"campaign_id": campaign_id, "status": status}


async def update_campaign_budget(conn, campaign_id: str, daily_budget_major: float) -> dict:
    """Set a campaign's daily budget. Amount is in major currency units (e.g. rupees)."""
    minor = int(round(float(daily_budget_major) * 100))
    if minor <= 0:
        raise RuntimeError("Budget must be greater than zero.")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{GRAPH}/{campaign_id}", data={
            "daily_budget": minor,
            "access_token": conn.access_token,
        })
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Could not update budget: {r.status_code} {r.text[:200]}")
    return {"campaign_id": campaign_id, "daily_budget": round(minor / 100.0, 2)}


async def upload_ad_image(conn, image_bytes: bytes, filename="creative.jpg") -> str:
    """Upload an image to the ad account; returns its image_hash for use in a creative."""
    if not conn.ad_account_id:
        raise RuntimeError("No Meta ad account selected.")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{GRAPH}/act_{conn.ad_account_id}/adimages",
            data={"access_token": conn.access_token},
            files={"filename": (filename, image_bytes)},
        )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Image upload failed: {r.status_code} {r.text[:200]}")
    for _, v in (r.json().get("images") or {}).items():
        if v.get("hash"):
            return v["hash"]
    raise RuntimeError("Image upload returned no hash.")


# Conservative optimization goals: OFFSITE_CONVERSIONS needs a pixel + promoted_object, so we
# default sales/leads to LINK_CLICKS which works without extra setup. The user can refine in Meta.
_OPT_GOAL_MAP = {
    "OUTCOME_TRAFFIC": "LINK_CLICKS",
    "OUTCOME_SALES": "LINK_CLICKS",
    "OUTCOME_LEADS": "LINK_CLICKS",
    "OUTCOME_ENGAGEMENT": "POST_ENGAGEMENT",
    "OUTCOME_AWARENESS": "REACH",
}


async def create_ad(conn, campaign_id, page_id, headline, primary_text, link_url,
                    cta="LEARN_MORE", image_hash=None, image_url=None,
                    daily_budget_major=200.0, country="IN", meta_objective="OUTCOME_TRAFFIC") -> dict:
    """Create ad set + creative + ad under an existing campaign — everything PAUSED so it
    never spends until the user activates it in Meta. Accepts a Creative Studio image_url
    or an uploaded image_hash. Targeting is intentionally minimal (single country) so it
    works without a pixel; refine in Meta Ads Manager."""
    if not page_id:
        raise RuntimeError("A Facebook Page is required to create an ad.")
    if not conn.ad_account_id:
        raise RuntimeError("No Meta ad account selected.")
    acct = f"act_{conn.ad_account_id}"
    opt_goal = _OPT_GOAL_MAP.get(meta_objective, "LINK_CLICKS")
    minor = int(round(float(daily_budget_major) * 100))
    async with httpx.AsyncClient(timeout=60) as client:
        adset = await client.post(f"{GRAPH}/{acct}/adsets", data={
            "name": f"{headline or 'Raftra'} — Ad Set",
            "campaign_id": campaign_id,
            "daily_budget": minor,
            "billing_event": "IMPRESSIONS",
            "optimization_goal": opt_goal,
            "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
            "targeting": json.dumps({"geo_locations": {"countries": [country]}}),
            "status": "PAUSED",
            "access_token": conn.access_token,
        })
        if adset.status_code not in (200, 201):
            raise RuntimeError(f"Ad set create failed: {adset.status_code} {adset.text[:250]}")
        adset_id = adset.json().get("id")

        link_data = {
            "message": primary_text or "",
            "link": link_url or "https://facebook.com",
            "name": headline or "",
            "call_to_action": {"type": cta, "value": {"link": link_url or "https://facebook.com"}},
        }
        if image_hash:
            link_data["image_hash"] = image_hash
        elif image_url:
            link_data["picture"] = image_url
        creative = await client.post(f"{GRAPH}/{acct}/adcreatives", data={
            "name": f"{headline or 'Raftra'} — Creative",
            "object_story_spec": json.dumps({"page_id": page_id, "link_data": link_data}),
            "access_token": conn.access_token,
        })
        if creative.status_code not in (200, 201):
            raise RuntimeError(f"Creative create failed: {creative.status_code} {creative.text[:250]}")
        creative_id = creative.json().get("id")

        ad = await client.post(f"{GRAPH}/{acct}/ads", data={
            "name": f"{headline or 'Raftra'} — Ad",
            "adset_id": adset_id,
            "creative": json.dumps({"creative_id": creative_id}),
            "status": "PAUSED",
            "access_token": conn.access_token,
        })
        if ad.status_code not in (200, 201):
            raise RuntimeError(f"Ad create failed: {ad.status_code} {ad.text[:250]}")
        ad_id = ad.json().get("id")
    return {"adset_id": adset_id, "creative_id": creative_id, "ad_id": ad_id}
