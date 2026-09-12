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

Every write here creates PAUSED objects. Activation is always a separate,
deliberate call (set_campaign_status), because an ACTIVE object spends money.
"""
import os
import json
import hmac
import base64
import hashlib
import datetime
import httpx

# Pinned via env so a Graph deprecation is a config change, not a code change.
# Meta retires a version roughly two years after release, and calls to a retired
# version fail outright — check developers.facebook.com/docs/graph-api/changelog
# before bumping. v19.0 (Jan 2024) is past its normal support window.
GRAPH_VERSION = os.getenv("META_GRAPH_VERSION", "v23.0")
GRAPH = f"https://graph.facebook.com/{GRAPH_VERSION}"
META_APP_ID = os.getenv("META_APP_ID", "")
META_APP_SECRET = os.getenv("META_APP_SECRET", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8005")
REDIRECT_URI = f"{BACKEND_URL}/api/connectors/meta/callback"
# ads_* alone is not enough. Creating an ad requires a Page, and:
#   pages_show_list      — /me/accounts, i.e. letting the user pick their Page
#   pages_read_engagement— reading that Page (and its linked Instagram account)
#   business_management  — resolving assets owned by a Business Portfolio
# Without pages_show_list the Page picker returns nothing, so no ad can ever
# be built. Adding a scope invalidates existing tokens — users must reconnect.
#
# Deliberately NOT requested: pages_manage_ads. It is a real permission, but it
# is not available to an app whose use case is "Create & manage ads with
# Marketing API", and requesting it makes the OAuth dialog fail outright with
# "Invalid Scopes" for anyone with a developer role on the app. It is also
# unnecessary here: ads_management covers creating the ad, and the Page is
# attached via object_story_spec.page_id, which only needs the connecting user
# to hold an admin/advertiser role on that Page.
#
# The valid set depends on the app's configured use cases, so it is env-tunable
# rather than hardcoded — a rejected scope is a config problem, not a code one.
SCOPES = os.getenv(
    "META_OAUTH_SCOPES",
    "ads_management,ads_read,business_management,pages_show_list,pages_read_engagement",
)

# Refuse any single ad set above this daily budget, in major units (rupees/dollars).
# Guards against a typo turning 500 into 50000 on someone's real card.
MAX_DAILY_BUDGET = float(os.getenv("META_MAX_DAILY_BUDGET", "20000"))

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


class MetaError(RuntimeError):
    """A Graph API failure carrying Meta's own diagnostics.

    Meta puts the message a human can act on in `error_user_msg`, not `message`
    — `message` is often just "Invalid parameter". Callers that only surface
    str(e) still get the useful text because it is passed to super().
    """

    def __init__(self, detail, *, title=None, code=None, subcode=None,
                 fbtrace_id=None, status=None, blame=None):
        super().__init__(detail)
        self.detail = detail
        self.title = title
        self.code = code
        self.subcode = subcode
        self.fbtrace_id = fbtrace_id
        self.status = status
        self.blame = blame

    def as_dict(self) -> dict:
        return {
            "error": self.detail, "title": self.title, "code": self.code,
            "subcode": self.subcode, "fbtrace_id": self.fbtrace_id,
            "blame_fields": self.blame, "http_status": self.status,
        }


def is_configured() -> bool:
    return bool(META_APP_ID and META_APP_SECRET)


def _proof(token: str) -> str:
    """appsecret_proof: an HMAC of the token keyed by the app secret.

    It proves the caller also holds the secret, so a token leaked on its own
    cannot be used to spend a customer's budget. Optional until you enable
    "Require app secret" in app settings — we always send it.
    """
    if not (META_APP_SECRET and token):
        return ""
    return hmac.new(META_APP_SECRET.encode(), token.encode(), hashlib.sha256).hexdigest()


def _auth(token: str) -> dict:
    """Auth params for any Graph call."""
    params = {"access_token": token}
    proof = _proof(token)
    if proof:
        params["appsecret_proof"] = proof
    return params


def _check(resp, what: str):
    """Raise MetaError with Meta's own wording, or return the parsed body."""
    try:
        body = resp.json()
    except Exception:
        body = {}

    if resp.status_code in (200, 201) and "error" not in body:
        _warn_on_quota(resp)
        return body

    err = body.get("error") or {}
    detail = err.get("error_user_msg") or err.get("message") or resp.text[:300]
    raise MetaError(
        f"{what}: {detail}",
        title=err.get("error_user_title"),
        code=err.get("code"),
        subcode=err.get("error_subcode"),
        fbtrace_id=err.get("fbtrace_id"),
        status=resp.status_code,
        blame=(err.get("error_data") or {}).get("blame_field_specs"),
    )


def _warn_on_quota(resp):
    """Meta reports rate-limit usage in a header and only throttles near 100%.
    Logging it early turns a mystery outage into a predictable one."""
    raw = resp.headers.get("x-business-use-case-usage")
    if not raw:
        return
    try:
        for entries in json.loads(raw).values():
            for e in entries:
                peak = max(e.get("call_count", 0), e.get("total_cputime", 0), e.get("total_time", 0))
                if peak >= 75:
                    print(f"[meta] rate limit at {peak}% ({e.get('type')}). "
                          f"Blocked for ~{e.get('estimated_time_to_regain_access', 0)} min.")
    except Exception:
        pass  # header shape varies between versions; never fail a request over it


def build_authorize_url(state: str) -> str:
    from urllib.parse import urlencode
    params = urlencode({
        "client_id": META_APP_ID,
        "redirect_uri": REDIRECT_URI,
        "state": state,
        "scope": SCOPES,
        "response_type": "code",
    })
    return f"https://www.facebook.com/{GRAPH_VERSION}/dialog/oauth?{params}"


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
        r = await client.get(f"{GRAPH}/me", params={"fields": "name", **_auth(token)})
    return r.json().get("name", "") if r.status_code == 200 else ""


async def check_funding(conn) -> dict:
    """Can the selected ad account actually spend?

    `ready_to_publish` only ever meant "token + ad account + Page", which is enough to CREATE
    a (paused) campaign but not to run one: an account with no payment method accepts the
    campaign and then never delivers a single impression. This asks the account itself.

    Returns {"ok": True|False|None, "detail": str, "token_invalid": bool}. ok=None means we
    could not tell (network, permissions) and must not be shown as either answer.
    """
    if not (conn and conn.access_token and conn.ad_account_id):
        return {"ok": None, "detail": "No ad account selected.", "token_invalid": False}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(f"{GRAPH}/act_{conn.ad_account_id}", params={
                "fields": "account_status,disable_reason,funding_source,funding_source_details",
                **_auth(conn.access_token)})
        d = r.json() if r.content else {}
    except Exception as e:
        return {"ok": None, "detail": f"Could not reach Meta: {e}", "token_invalid": False}

    if r.status_code != 200:
        err = d.get("error") or {}
        # 190 = the access token is expired or revoked. Only a reconnect fixes that.
        return {"ok": None, "detail": err.get("message") or f"Meta returned HTTP {r.status_code}",
                "token_invalid": err.get("code") == 190}

    if d.get("account_status") not in (1, None):
        return {"ok": False, "token_invalid": False,
                "detail": f"The ad account is not active (status {d.get('account_status')}, "
                          f"reason {d.get('disable_reason')}). Resolve it in Meta Ads Manager."}
    if not (d.get("funding_source") or d.get("funding_source_details")):
        return {"ok": False, "token_invalid": False,
                "detail": "The ad account has no payment method, so campaigns can be created "
                          "but will never deliver. Add one in Meta Billing & payments."}
    return {"ok": True, "detail": "Payment method on file.", "token_invalid": False}


async def list_ad_accounts(token: str) -> list:
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{GRAPH}/me/adaccounts", params={
            "fields": "account_id,name,account_status,currency",
            **_auth(token),
        })
    body = _check(r, "Could not list ad accounts")
    out = []
    for a in body.get("data", []):
        out.append({
            "account_id": a.get("account_id"),
            "name": a.get("name") or a.get("account_id"),
            "currency": a.get("currency"),
            "active": a.get("account_status") == 1,
        })
    return out


async def publish_campaign(conn, name: str, objective: str) -> dict:
    """Create a campaign on the connected ad account, in PAUSED status (no spend).
    Returns {'campaign_id', 'meta_objective', 'url'}.

    NOTE: a campaign on its own contains no ad set, creative or ad, so it can
    never deliver — not even once activated. Use create_ad() to put a real ad
    inside it, or call launch() which does both.
    """
    if not conn.ad_account_id:
        raise RuntimeError("No Meta ad account selected.")
    meta_objective = _OBJECTIVE_MAP.get((objective or "").strip().lower(), "OUTCOME_TRAFFIC")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{GRAPH}/act_{conn.ad_account_id}/campaigns", data={
            "name": name or "Raftra Campaign",
            "objective": meta_objective,
            "status": "PAUSED",                 # never auto-spend
            "special_ad_categories": "[]",
            # Required by Meta whenever a campaign carries no campaign-level budget, which is
            # our case: create_ad() puts daily_budget on the AD SET. Omitting it fails with
            # "You must specify True or False in the field is_adset_budget_sharing_enabled".
            #
            # false deliberately. True lets Meta move up to 20% of an ad set's budget to other
            # ad sets in the campaign — a silent reallocation of the user's money they never
            # asked for. With false, each ad set spends exactly the budget shown in the UI.
            "is_adset_budget_sharing_enabled": "false",
            **_auth(conn.access_token),
        })
    cid = _check(r, "Meta campaign create failed").get("id")
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
            **_auth(conn.access_token),
        })
    body = _check(r, "Could not list campaigns")
    out = []
    for c in body.get("data", []):
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
            **_auth(conn.access_token),
        })
    body = _check(r, "Could not fetch insights")
    out = {}
    for row in body.get("data", []):
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
            **_auth(conn.access_token),
        })
    body = _check(r, "Could not list pages")
    return [{"id": p.get("id"), "name": p.get("name")} for p in body.get("data", [])]


# ---------------------------------------------------------------------------- writes
async def set_campaign_status(conn, campaign_id: str, status: str) -> dict:
    """Pause (kill) or re-activate a campaign. status in {PAUSED, ACTIVE}.

    Activating a campaign is NOT enough on its own: an ad only delivers when the
    ad, its ad set and its campaign are all ACTIVE. See activate_ad().
    """
    status = (status or "").upper()
    if status not in ("PAUSED", "ACTIVE"):
        raise RuntimeError("status must be PAUSED or ACTIVE")
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{GRAPH}/{campaign_id}", data={
            "status": status,
            **_auth(conn.access_token),
        })
    _check(r, "Could not update campaign status")
    return {"campaign_id": campaign_id, "status": status}


async def activate_ad(conn, ad_id: str) -> dict:
    """Set an ad live, including its parents.

    Flipping only the ad (or only the campaign) leaves it undelivered while
    looking active in the UI — the classic "I published it and nothing
    happened". Parents are set first so the ad is never briefly live under a
    paused parent.
    """
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{GRAPH}/{ad_id}", params={
            "fields": "id,name,adset_id,campaign_id", **_auth(conn.access_token)})
        ad = _check(r, "Could not read ad")

        for obj_id in (ad.get("campaign_id"), ad.get("adset_id"), ad_id):
            if not obj_id:
                continue
            rr = await client.post(f"{GRAPH}/{obj_id}", data={
                "status": "ACTIVE", **_auth(conn.access_token)})
            _check(rr, f"Could not activate {obj_id}")

        after = await client.get(f"{GRAPH}/{ad_id}", params={
            "fields": "id,name,status,effective_status", **_auth(conn.access_token)})
    result = _check(after, "Could not re-read ad")
    # A newly activated ad sits in review for minutes to ~24h before delivering.
    result["note"] = "Live. PENDING_REVIEW is normal for a new ad, not an error."
    return result


async def update_campaign_budget(conn, campaign_id: str, daily_budget_major: float) -> dict:
    """Set a campaign's daily budget. Amount is in major currency units (e.g. rupees)."""
    amount = float(daily_budget_major)
    if amount <= 0:
        raise RuntimeError("Budget must be greater than zero.")
    if amount > MAX_DAILY_BUDGET:
        raise RuntimeError(
            f"Daily budget {amount:g} exceeds the server limit of {MAX_DAILY_BUDGET:g}. "
            f"Raise META_MAX_DAILY_BUDGET if this is intentional."
        )
    minor = int(round(amount * 100))
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(f"{GRAPH}/{campaign_id}", data={
            "daily_budget": minor,
            **_auth(conn.access_token),
        })
    _check(r, "Could not update budget")
    return {"campaign_id": campaign_id, "daily_budget": round(minor / 100.0, 2)}


async def upload_ad_image(conn, image_bytes: bytes, filename="creative.jpg") -> str:
    """Upload an image to the ad account; returns its image_hash for use in a creative."""
    if not conn.ad_account_id:
        raise RuntimeError("No Meta ad account selected.")
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{GRAPH}/act_{conn.ad_account_id}/adimages",
            data=_auth(conn.access_token),
            files={"filename": (filename, image_bytes)},
        )
    body = _check(r, "Image upload failed")
    for _, v in (body.get("images") or {}).items():
        if v.get("hash"):
            return v["hash"]
    raise RuntimeError("Image upload returned no hash.")


async def resolve_image_hash(conn, image_hash=None, image_url=None):
    """Turn whatever creative we have into an image_hash owned by the ad account.

    Meta can fetch a bare `picture` URL itself, but only if it is publicly
    reachable — localhost, signed or expiring URLs are not, and Instagram
    placements reject them outright. Uploading the bytes once removes the whole
    class of "works on Facebook, blank on Instagram" failures.
    """
    if image_hash:
        return image_hash
    if not image_url:
        return None

    if image_url.startswith("data:"):
        # Browser upload: data:image/png;base64,AAAA...
        _, _, b64 = image_url.partition(",")
        try:
            raw = base64.b64decode(b64)
        except Exception as e:
            raise RuntimeError(f"Could not decode the uploaded image: {e}")
        return await upload_ad_image(conn, raw, filename="creative.png")

    async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
        r = await client.get(image_url)
    if r.status_code != 200 or not r.content:
        raise RuntimeError(f"Could not download the creative from {image_url[:80]} (HTTP {r.status_code}).")

    # Meta infers the file type from the FILENAME EXTENSION and rejects anything without a
    # recognised one ("The type of file is not supported"). Deriving the name from the URL
    # path is unreliable: a Pollinations URL ends in the URL-encoded prompt, so the name came
    # out as "a%20steaming%20cup%20of%20coffee" with no extension at all. Trust the served
    # content-type instead, and sniff the magic bytes when the header is missing or generic.
    content_type = (r.headers.get("content-type") or "").split(";")[0].strip().lower()
    ext = {"image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg",
           "image/webp": "webp", "image/gif": "gif"}.get(content_type)
    if not ext:
        head = r.content[:12]
        if head.startswith(b"\x89PNG\r\n\x1a\n"):
            ext = "png"
        elif head.startswith(b"\xff\xd8\xff"):
            ext = "jpg"
        elif head[:4] == b"RIFF" and head[8:12] == b"WEBP":
            ext = "webp"
        elif head.startswith((b"GIF87a", b"GIF89a")):
            ext = "gif"
        else:
            raise RuntimeError(
                f"The creative at {image_url[:60]}… is not a recognised image "
                f"(content-type {content_type or 'unknown'}). Meta only accepts "
                "PNG, JPEG, WEBP or GIF.")
    return await upload_ad_image(conn, r.content, filename=f"creative.{ext}")


async def get_page_instagram(conn, page_id):
    """The Instagram account linked to a Page, or None.

    Instagram placements run through the Page's connected IG account. Passing
    it explicitly as instagram_actor_id makes delivery predictable; without a
    linked account, Instagram placements silently do not serve.
    """
    async with httpx.AsyncClient(timeout=20) as client:
        r = await client.get(f"{GRAPH}/{page_id}", params={
            "fields": "instagram_business_account{id,username},connected_instagram_account{id,username}",
            **_auth(conn.access_token),
        })
    if r.status_code != 200:
        return None
    body = r.json()
    acct = body.get("instagram_business_account") or body.get("connected_instagram_account")
    return str(acct["id"]) if acct and acct.get("id") else None


# Conservative optimization goals: OFFSITE_CONVERSIONS needs a pixel + promoted_object, so we
# default sales/leads to LINK_CLICKS which works without extra setup. The user can refine in Meta.
_OPT_GOAL_MAP = {
    "OUTCOME_TRAFFIC": "LINK_CLICKS",
    "OUTCOME_SALES": "LINK_CLICKS",
    "OUTCOME_LEADS": "LINK_CLICKS",
    "OUTCOME_ENGAGEMENT": "POST_ENGAGEMENT",
    "OUTCOME_AWARENESS": "REACH",
}


def build_targeting(countries=None, age_min=None, age_max=None,
                    genders=None, platforms=None) -> dict:
    """Targeting spec. Country-only still works (the previous behaviour); the
    rest are optional so existing callers are unaffected."""
    spec = {"geo_locations": {"countries": list(countries or ["IN"])}}
    if age_min:
        spec["age_min"] = max(18, int(age_min))       # Meta's floor is 18
    if age_max:
        spec["age_max"] = min(65, int(age_max))
    # Omitting `genders` means all. [1] male, [2] female — sending both is the
    # same as omitting, so only set it when it actually narrows the audience.
    if genders and len(genders) == 1:
        spec["genders"] = [int(g) for g in genders]
    if platforms:
        spec["publisher_platforms"] = list(platforms)
    return spec


async def _delete_quietly(client, conn, ids):
    """Best-effort cleanup of a half-built ad. Everything is PAUSED so nothing
    can spend; losing the original error to a cleanup failure would be worse."""
    for obj_id in [i for i in reversed(ids) if i]:
        try:
            await client.post(f"{GRAPH}/{obj_id}", data={"status": "DELETED", **_auth(conn.access_token)})
        except Exception as e:
            print(f"[meta cleanup] could not delete {obj_id}: {e}")


async def create_ad(conn, campaign_id, page_id, headline, primary_text, link_url,
                    cta="LEARN_MORE", image_hash=None, image_url=None,
                    daily_budget_major=200.0, country="IN", meta_objective="OUTCOME_TRAFFIC",
                    age_min=None, age_max=None, genders=None, platforms=None,
                    instagram_actor_id=None) -> dict:
    """Create ad set + creative + ad under an existing campaign — everything PAUSED so it
    never spends until the user activates it in Meta. Accepts a Creative Studio image_url
    or an uploaded image_hash.

    These are three dependent writes with no transaction: a failure on the
    creative leaves an orphan ad set behind. Anything created before the failure
    is deleted so a retry does not litter the account.
    """
    if not page_id:
        raise RuntimeError("A Facebook Page is required to create an ad.")
    if not conn.ad_account_id:
        raise RuntimeError("No Meta ad account selected.")

    budget = float(daily_budget_major)
    if budget <= 0:
        raise RuntimeError("Daily budget must be greater than zero.")
    if budget > MAX_DAILY_BUDGET:
        raise RuntimeError(
            f"Daily budget {budget:g} exceeds the server limit of {MAX_DAILY_BUDGET:g}. "
            f"Raise META_MAX_DAILY_BUDGET if this is intentional."
        )

    acct = f"act_{conn.ad_account_id}"
    opt_goal = _OPT_GOAL_MAP.get(meta_objective, "LINK_CLICKS")
    minor = int(round(budget * 100))
    targeting = build_targeting([country] if country else None, age_min, age_max, genders, platforms)

    adset_id = creative_id = ad_id = None
    async with httpx.AsyncClient(timeout=60) as client:
        try:
            adset = await client.post(f"{GRAPH}/{acct}/adsets", data={
                "name": f"{headline or 'Raftra'} — Ad Set",
                "campaign_id": campaign_id,
                "daily_budget": minor,
                "billing_event": "IMPRESSIONS",
                "optimization_goal": opt_goal,
                "bid_strategy": "LOWEST_COST_WITHOUT_CAP",
                "targeting": json.dumps(targeting),
                "status": "PAUSED",
                **_auth(conn.access_token),
            })
            adset_id = _check(adset, "Ad set create failed").get("id")

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

            story = {"page_id": page_id, "link_data": link_data}
            if instagram_actor_id:
                story["instagram_actor_id"] = instagram_actor_id

            creative = await client.post(f"{GRAPH}/{acct}/adcreatives", data={
                "name": f"{headline or 'Raftra'} — Creative",
                "object_story_spec": json.dumps(story),
                # Opt out of Advantage+ creative enhancements so the ad that runs
                # is the one the user reviewed — Meta otherwise reserves the right
                # to restyle copy, crop images and add overlays.
                "degrees_of_freedom_spec": json.dumps({
                    "creative_features_spec": {"standard_enhancements": {"enroll_status": "OPT_OUT"}}
                }),
                **_auth(conn.access_token),
            })
            creative_id = _check(creative, "Creative create failed").get("id")

            ad = await client.post(f"{GRAPH}/{acct}/ads", data={
                "name": f"{headline or 'Raftra'} — Ad",
                "adset_id": adset_id,
                "creative": json.dumps({"creative_id": creative_id}),
                "status": "PAUSED",
                **_auth(conn.access_token),
            })
            ad_id = _check(ad, "Ad create failed").get("id")
        except Exception:
            await _delete_quietly(client, conn, [ad_id, creative_id, adset_id])
            raise

    return {"adset_id": adset_id, "creative_id": creative_id, "ad_id": ad_id}


async def launch(conn, name, objective, page_id, headline, primary_text, link_url,
                 cta="LEARN_MORE", image_hash=None, image_url=None,
                 daily_budget_major=200.0, country="IN",
                 platforms=("facebook", "instagram"), **targeting_kwargs) -> dict:
    """Campaign + ad set + creative + ad in one call, all PAUSED, on Facebook
    and Instagram by default.

    Prefer this over publish_campaign() for anything a user will actually run:
    publish_campaign alone produces an empty campaign that can never deliver,
    because a campaign with no ad inside it has nothing to show.
    """
    if not page_id:
        raise RuntimeError(
            "Select the Facebook Page to publish as before launching — Meta cannot "
            "create an ad without one."
        )

    # Upload the creative first. Doing this before the campaign exists means a
    # bad image fails with nothing to clean up.
    resolved_hash = await resolve_image_hash(conn, image_hash=image_hash, image_url=image_url)
    if not resolved_hash:
        raise RuntimeError("Select or upload a creative image before launching.")

    wanted = list(platforms or ["facebook"])
    instagram_actor_id = None
    if "instagram" in wanted:
        instagram_actor_id = await get_page_instagram(conn, page_id)
        if not instagram_actor_id:
            # Better to run on Facebook than to fail the whole launch, but the
            # caller needs to know Instagram was dropped rather than assume it ran.
            wanted = [p for p in wanted if p != "instagram"]

    camp = await publish_campaign(conn, name=name, objective=objective)
    try:
        ad = await create_ad(
            conn, campaign_id=camp["campaign_id"], page_id=page_id,
            headline=headline, primary_text=primary_text, link_url=link_url,
            cta=cta, image_hash=resolved_hash,
            daily_budget_major=daily_budget_major, country=country,
            meta_objective=camp["meta_objective"], platforms=wanted,
            instagram_actor_id=instagram_actor_id, **targeting_kwargs,
        )
    except Exception:
        # Roll the empty campaign back too, so a failed launch leaves nothing behind.
        async with httpx.AsyncClient(timeout=30) as client:
            await _delete_quietly(client, conn, [camp["campaign_id"]])
        raise

    return {
        **camp, **ad,
        "status": "PAUSED",
        "placements": wanted,
        "instagram_connected": bool(instagram_actor_id),
        "warning": None if instagram_actor_id or "instagram" not in (platforms or []) else (
            "Instagram placement was skipped: no Instagram account is linked to this "
            "Facebook Page. Link one in Meta Business Suite to run on Instagram."
        ),
    }
