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
# `adwords` alone is enough to run the Ads API, but fetch_user_email() below reads
# oauth2/v3/userinfo, which is gated on openid+email. Without them that call 401s and
# returns "", so a fully connected account rendered as "Google Ads connected ·" with a
# dangling separator and no address — indistinguishable from a half-finished connection.
SCOPE = "https://www.googleapis.com/auth/adwords openid email"

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


def _headers(access_token: str, login_customer_id: str = None) -> dict:
    """Headers for one Google Ads API call.

    login-customer-id is ONLY sent when this connection reaches its account *through* a
    manager. It tells Google "act as this manager", and Google then requires that manager
    to have access to the target customer — so sending our own manager id for every tenant
    made every customer's account unreachable unless they first linked it under us.

    Customers returned by listAccessibleCustomers are reachable directly by the
    authenticating user, so their connections store login_customer_id = None and the
    header is omitted: the customer's own OAuth grant is what authorises the call, and
    they can revoke it from their Google account at any time.
    """
    h = {
        "Authorization": f"Bearer {access_token}",
        "developer-token": DEVELOPER_TOKEN,
        "Content-Type": "application/json",
    }
    lcid = (login_customer_id or "").replace("-", "")
    if lcid:
        h["login-customer-id"] = lcid
    return h


def _conn_lcid(conn) -> str:
    """The manager id this connection must act through, or None for direct access."""
    return getattr(conn, "login_customer_id", None) or None


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
            headers=_headers(token, _conn_lcid(conn)),
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
                             headers=_headers(token, _conn_lcid(conn)))
    if r.status_code != 200:
        raise RuntimeError(f"Could not list accessible customers: {r.status_code} {r.text[:300]}")
    customer_ids = [rn.split("/")[-1] for rn in r.json().get("resourceNames", [])]
    out = []
    for cid in customer_ids:
        name, is_manager = cid, False
        try:
            # customer.manager is the only reliable way to tell a manager (MCC) apart from
            # an ad account. Campaigns cannot exist inside a manager, so selecting one is
            # always a mistake — and the picker lists both side by side.
            rows = await _search(conn, cid,
                "SELECT customer.descriptive_name, customer.currency_code, customer.manager "
                "FROM customer LIMIT 1",
                token_override=token)
            if rows:
                cust = rows[0]["customer"]
                name = cust.get("descriptiveName") or cid
                is_manager = bool(cust.get("manager"))
        except Exception:
            pass  # a single account failing to resolve a display name isn't fatal
        out.append({"customer_id": cid, "name": name, "manager": is_manager})
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
            headers=_headers(token, _conn_lcid(conn)),
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
            headers=_headers(token, _conn_lcid(conn)),
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
            headers=_headers(token, _conn_lcid(conn)),
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
            headers=_headers(token, _conn_lcid(conn)),
            json={"operations": [{
                "update": {"resourceName": budget_resource_name, "amountMicros": str(minor)},
                "updateMask": "amount_micros",
            }]},
        )
    if r.status_code not in (200, 201):
        raise RuntimeError(f"Could not update budget: {r.status_code} {r.text[:300]}")
    return {"daily_budget": round(minor / 1_000_000, 2)}


# ───────────────────────────────────────────────── full Search launch (campaign → ad → assets)
#
# publish_campaign() above creates a campaign shell only. Everything below builds the whole
# hierarchy a Search campaign needs to actually deliver once a human enables it:
#
#   CampaignBudget → Campaign → AdGroup → Keywords → ResponsiveSearchAd → Sitelinks → Callouts
#
# Google enforces hard limits on every asset. We validate the entire payload BEFORE the first
# mutate, because Google Ads has no transaction across services: a headline rejected at step 5
# would otherwise leave an orphaned campaign + budget behind.

RSA_HEADLINE_MAX = 30
RSA_DESCRIPTION_MAX = 90
RSA_MIN_HEADLINES = 3       # Google rejects a responsive search ad with fewer
RSA_MAX_HEADLINES = 15
RSA_MIN_DESCRIPTIONS = 2
RSA_MAX_DESCRIPTIONS = 4
KEYWORD_TEXT_MAX = 80
KEYWORD_WORD_MAX = 10
SITELINK_TEXT_MAX = 25
SITELINK_DESC_MAX = 35
CALLOUT_TEXT_MAX = 25


class GoogleAdsValidationError(Exception):
    """The approved strategy cannot produce a valid Search campaign. Raised before any API
    call is made, and carries every problem at once so the user fixes them in one pass rather
    than discovering them one failed publish at a time."""

    def __init__(self, problems):
        self.problems = list(problems)
        super().__init__(" ".join(self.problems))


class GoogleAdsApiError(Exception):
    """A Google Ads API call failed. `.message` is already phrased for the user."""

    def __init__(self, message: str, status_code: int = None, codes=None):
        self.message = message
        self.status_code = status_code
        self.codes = list(codes or [])
        super().__init__(message)


# Google returns enum names like "DEVELOPER_TOKEN_NOT_APPROVED" buried in a GoogleAdsFailure.
# Raw enums are useless to whoever clicked Publish, so map the ones that actually happen.
_ERROR_HINTS = {
    "DEVELOPER_TOKEN_NOT_APPROVED":
        "Your Google Ads developer token is not approved for production accounts. Apply for "
        "Basic Access in your manager account under Tools & Settings → API Center.",
    "DEVELOPER_TOKEN_PROHIBITED":
        "This developer token cannot be used with this account. Check that the token belongs to "
        "the manager account set as GOOGLE_ADS_LOGIN_CUSTOMER_ID.",
    "CUSTOMER_NOT_ENABLED":
        "That Google Ads account is not active (it may be closed, suspended, or missing billing).",
    "USER_PERMISSION_DENIED":
        "The connected Google account cannot access this Ads account. Confirm it is linked under "
        "your manager account and reconnect.",
    "NOT_ADS_USER":
        "The connected Google account has no Google Ads profile.",
    "CUSTOMER_NOT_FOUND":
        "That Google Ads customer account no longer exists. Pick a different account.",
    "INVALID_CUSTOMER_ID":
        "The selected Google Ads customer id is malformed. Re-select the account.",
    "AUTHENTICATION_ERROR":
        "Google rejected the stored credentials. Disconnect and reconnect Google Ads.",
    "OAUTH_TOKEN_EXPIRED":
        "The Google Ads authorisation expired. Disconnect and reconnect Google Ads.",
    "RESOURCE_EXHAUSTED":
        "Google Ads is rate-limiting this account. Wait a few minutes and publish again.",
    "QUOTA_ERROR":
        "The Google Ads API quota for this developer token is exhausted. Try again later.",
    "BUDGET_AMOUNT_TOO_SMALL":
        "The daily budget is below the minimum Google allows for this account's currency.",
    "DUPLICATE_NAME":
        "A campaign or budget with this name already exists in the account. Rename the campaign.",
    "STRING_TOO_LONG":
        "One of the text assets exceeds the Google Ads character limit.",
    "INVALID_URL":
        "The landing page URL is not a valid destination Google will accept.",
    "SERVICE_DISABLED":
        "The Google Ads API is not enabled on the Google Cloud project behind this OAuth client.",
}


def _friendly_error(resp, action: str) -> "GoogleAdsApiError":
    """Turn a failed Google Ads REST response into an error a user can act on."""
    codes, messages = [], []
    try:
        payload = resp.json()
    except Exception:
        payload = {}
    err = (payload or {}).get("error") or {}
    for detail in err.get("details") or []:
        for e in detail.get("errors") or []:
            msg = (e.get("message") or "").strip()
            if msg:
                messages.append(msg)
            for value in (e.get("errorCode") or {}).values():
                if isinstance(value, str):
                    codes.append(value)
    if not messages and err.get("message"):
        messages.append(err["message"])
    if not messages:
        messages.append((resp.text or "")[:200] or f"HTTP {resp.status_code}")

    hint = next((_ERROR_HINTS[c] for c in codes if c in _ERROR_HINTS), None)
    if not hint:
        blob = " ".join(codes + messages).upper()
        hint = next((v for k, v in _ERROR_HINTS.items() if k in blob), None)

    detail = messages[0]
    if len(messages) > 1:
        detail += f" (+{len(messages) - 1} more)"
    text = f"{action} failed: {detail}"
    if hint:
        text += f" — {hint}"
    return GoogleAdsApiError(text, status_code=resp.status_code, codes=codes)


def parse_keyword(raw):
    """Normalise one approved keyword into (text, match_type).

    Match type may be explicit (``{"text": ..., "match_type": "EXACT"}``) or encoded in the
    conventional Google Ads Editor punctuation the strategy tends to produce:
    ``[shoes]`` = exact, ``"shoes"`` = phrase, bare = broad.
    """
    match_type = ""
    if isinstance(raw, dict):
        text = str(raw.get("text") or raw.get("keyword") or raw.get("term") or "").strip()
        match_type = str(raw.get("match_type") or raw.get("matchType") or "").strip().upper()
        if match_type not in ("EXACT", "PHRASE", "BROAD"):
            match_type = ""
    else:
        text = str(raw or "").strip()

    if not text:
        return None
    if not match_type:
        if text.startswith("[") and text.endswith("]"):
            match_type, text = "EXACT", text[1:-1].strip()
        elif text.startswith('"') and text.endswith('"'):
            match_type, text = "PHRASE", text[1:-1].strip()
        else:
            match_type = "BROAD"
    else:
        text = text.strip('[]"').strip()
    return (text, match_type) if text else None


def parse_extensions(items):
    """Split the strategy's flat ``extensions`` list into sitelinks and callouts.

    The strategy agent emits prefixed strings ("Sitelink: Free Shipping", "Callout: 24/7
    Support"), so the prefix is the only type signal available. Anything unprefixed is treated
    as a callout when it fits the callout limit; whatever can't be classified is returned as a
    warning rather than dropped, so the publish result can say what was skipped.
    """
    sitelinks, callouts, warnings = [], [], []
    for raw in items or []:
        if isinstance(raw, dict):
            kind = str(raw.get("type") or "").strip().lower()
            text = str(raw.get("text") or raw.get("link_text") or raw.get("value") or "").strip()
            url = str(raw.get("url") or raw.get("final_url") or "").strip() or None
            if not text:
                continue
            if kind.startswith("sitelink"):
                sitelinks.append({"text": text, "url": url,
                                  "description": str(raw.get("description") or "").strip() or None})
            else:
                callouts.append(text)
            continue

        s = str(raw or "").strip()
        if not s:
            continue
        label, _, rest = s.partition(":")
        label_l = label.strip().lower()
        rest = rest.strip()
        if label_l.startswith("sitelink") and rest:
            # The strategy writes "Sitelink: Start Practice - Try real coding challenges",
            # packing the link text and its description around a dash. Google stores those as
            # separate fields with very different limits (linkText 25, description 35), so
            # treating the whole string as link text makes every sitelink fail validation.
            link_text, sep, description = rest.partition(" - ")
            sitelinks.append({"text": link_text.strip() if sep else rest,
                              "description": description.strip() if sep else None,
                              "url": None})
        elif label_l.startswith("callout") and rest:
            callouts.append(rest)
        elif len(s) <= CALLOUT_TEXT_MAX:
            callouts.append(s)
        else:
            warnings.append(f'Extension "{s[:40]}…" has no Sitelink:/Callout: prefix and is too '
                            f'long for a callout ({len(s)}/{CALLOUT_TEXT_MAX}) — skipped.')
    return sitelinks, callouts, warnings


def _valid_url(url: str) -> bool:
    from urllib.parse import urlparse
    try:
        parts = urlparse(str(url or "").strip())
    except Exception:
        return False
    return parts.scheme in ("http", "https") and bool(parts.netloc)


def validate_search_payload(*, headlines, descriptions, keywords, final_url,
                            sitelinks, callouts, daily_budget_major) -> dict:
    """Check everything Google will check, before anything is created.

    Two severities, split by whether the campaign can still be built:

      * **problems** stop the publish (raised as GoogleAdsValidationError, all at once, each
        naming the offending field and value) — too few usable headlines or descriptions, no
        valid landing page, no budget. Nothing is created.
      * **warnings** are individual assets that were skipped — one over-long headline out of
        twelve, a duplicate, an oversized callout. Google caps these anyway, so dropping the
        offender and publishing the valid remainder beats failing the whole campaign over a
        single character. Every skip is reported, never silent.

    Returns the cleaned payload plus those warnings.
    """
    problems, warnings = [], []

    clean_headlines = [str(h).strip() for h in (headlines or []) if str(h).strip()]
    clean_descriptions = [str(d).strip() for d in (descriptions or []) if str(d).strip()]

    def usable(values, limit, kind):
        """Drop the over-long and the duplicated, saying exactly what went and why."""
        out, seen = [], set()
        for i, v in enumerate(values):
            if len(v) > limit:
                warnings.append(f'{kind} {i + 1} skipped — {len(v)}/{limit} characters: "{v}".')
                continue
            if v.casefold() in seen:
                warnings.append(f'Duplicate {kind.lower()} skipped — "{v}".')
                continue
            seen.add(v.casefold())
            out.append(v)
        return out

    fitting_headlines = usable(clean_headlines, RSA_HEADLINE_MAX, "Headline")
    fitting_descriptions = usable(clean_descriptions, RSA_DESCRIPTION_MAX, "Description")

    if len(fitting_headlines) < RSA_MIN_HEADLINES:
        problems.append(f"A responsive search ad needs at least {RSA_MIN_HEADLINES} headlines of "
                        f"{RSA_HEADLINE_MAX} characters or fewer — only {len(fitting_headlines)} of "
                        f"the {len(clean_headlines)} approved headlines qualify.")
    if len(fitting_descriptions) < RSA_MIN_DESCRIPTIONS:
        problems.append(f"A responsive search ad needs at least {RSA_MIN_DESCRIPTIONS} descriptions "
                        f"of {RSA_DESCRIPTION_MAX} characters or fewer — only "
                        f"{len(fitting_descriptions)} of the {len(clean_descriptions)} approved "
                        f"descriptions qualify.")

    # Keep the first N — Google caps the ad, and the strategy often generates more.
    final_headlines = fitting_headlines[:RSA_MAX_HEADLINES]
    final_descriptions = fitting_descriptions[:RSA_MAX_DESCRIPTIONS]

    parsed, seen_keywords = [], set()
    for raw in keywords or []:
        item = parse_keyword(raw)
        if not item:
            continue
        text, match_type = item
        if len(text) > KEYWORD_TEXT_MAX:
            warnings.append(f'Keyword skipped — {len(text)}/{KEYWORD_TEXT_MAX} characters: "{text[:40]}…".')
            continue
        if len(text.split()) > KEYWORD_WORD_MAX:
            warnings.append(f'Keyword skipped — more than {KEYWORD_WORD_MAX} words: "{text}".')
            continue
        key = (text.casefold(), match_type)
        if key in seen_keywords:
            continue          # silently de-duplicated; a repeat is not worth reporting
        seen_keywords.add(key)
        parsed.append({"text": text, "match_type": match_type})

    if not _valid_url(final_url):
        problems.append(f'Landing page "{final_url or "(empty)"}" is not a valid http(s) URL. '
                        f"Set one on the campaign or add your website to the workspace.")

    try:
        budget = float(daily_budget_major)
    except (TypeError, ValueError):
        budget = 0.0
    if budget <= 0:
        problems.append(f"Daily budget must be greater than zero (got {daily_budget_major!r}).")

    clean_sitelinks, clean_callouts = [], []
    for sl in sitelinks or []:
        text = str(sl.get("text") or "").strip()
        if not text:
            continue
        if len(text) > SITELINK_TEXT_MAX:
            warnings.append(f'Sitelink skipped — link text is {len(text)}/{SITELINK_TEXT_MAX} '
                            f'characters: "{text}".')
            continue
        url = sl.get("url") or final_url
        if not _valid_url(url):
            continue          # falls back to the campaign URL, which is validated above
        description = str(sl.get("description") or "").strip()
        if description and len(description) > SITELINK_DESC_MAX:
            warnings.append(f'Sitelink "{text}" kept, but its description is '
                            f'{len(description)}/{SITELINK_DESC_MAX} characters and was dropped.')
            description = ""
        clean_sitelinks.append({"text": text, "url": url, "description": description or None})
    for text in callouts or []:
        text = str(text).strip()
        if not text:
            continue
        if len(text) > CALLOUT_TEXT_MAX:
            warnings.append(f'Callout skipped — {len(text)}/{CALLOUT_TEXT_MAX} characters: "{text}".')
            continue
        clean_callouts.append(text)

    if problems:
        raise GoogleAdsValidationError(problems)

    return {
        "headlines": final_headlines,
        "descriptions": final_descriptions,
        "keywords": parsed,
        "final_url": str(final_url).strip(),
        "sitelinks": clean_sitelinks,
        "callouts": clean_callouts,
        "daily_budget_major": budget,
        "warnings": warnings,
        "dropped_headlines": len(fitting_headlines) - len(final_headlines),
        "dropped_descriptions": len(fitting_descriptions) - len(final_descriptions),
    }


async def _mutate(client, token, lcid, customer_id: str, service: str, operations: list, action: str) -> list:
    """One mutate against a Google Ads service. Raises a user-facing GoogleAdsApiError."""
    r = await client.post(
        f"{GOOGLE_ADS_HOST}/customers/{customer_id}/{service}:mutate",
        headers=_headers(token, lcid),
        json={"operations": operations},
    )
    if r.status_code not in (200, 201):
        raise _friendly_error(r, action)
    return r.json().get("results", [])


async def _remove_quietly(client, token, lcid, customer_id: str, service: str, resource_names: list):
    """Best-effort cleanup so a failed launch leaves nothing behind. Never raises: the caller is
    already reporting the original failure, and a cleanup error would mask it."""
    for rn in [x for x in resource_names if x]:
        try:
            await client.post(
                f"{GOOGLE_ADS_HOST}/customers/{customer_id}/{service}:mutate",
                headers=_headers(token, lcid), json={"operations": [{"remove": rn}]})
        except Exception:
            pass


async def _resolve_geo_targets(client, token, lcid, customer_id: str, locations: list) -> tuple:
    """Map plain location names ("Mumbai", "India") onto geo target constants.

    Best effort by design: geo targeting is a refinement, not a precondition for a valid
    campaign, so an unresolvable place name becomes a warning instead of failing the publish.
    """
    names = [str(x).strip() for x in (locations or []) if str(x).strip()]
    if not names:
        return [], []
    try:
        r = await client.post(
            f"{GOOGLE_ADS_HOST}/geoTargetConstants:suggest",
            headers=_headers(token, lcid),
            json={"locale": "en", "countryCode": "IN", "locationNames": {"names": names[:20]}},
        )
        if r.status_code != 200:
            return [], [f"Geo targeting skipped — Google could not resolve the locations "
                        f"({', '.join(names)}). The campaign targets all locations."]
        suggestions = r.json().get("geoTargetConstantSuggestions", [])
    except Exception as e:
        return [], [f"Geo targeting skipped — {e}. The campaign targets all locations."]

    resolved, matched = [], set()
    for s in suggestions:
        const = (s.get("geoTargetConstant") or {})
        rn, status = const.get("resourceName"), const.get("status")
        if rn and status == "ENABLED" and rn not in resolved:
            resolved.append(rn)
            matched.add(str(s.get("searchTerm") or const.get("name") or "").casefold())

    warnings = []
    unmatched = [n for n in names if n.casefold() not in matched]
    if unmatched and resolved:
        warnings.append(f"Geo targeting could not resolve: {', '.join(unmatched)}.")
    elif not resolved:
        warnings.append(f"Geo targeting skipped — none of {', '.join(names)} matched a Google "
                        f"location. The campaign targets all locations.")
    return resolved, warnings


async def launch(conn, *, name: str, objective: str = "", headlines, descriptions, keywords,
                 final_url: str, sitelinks=None, callouts=None, daily_budget_major: float = 200.0,
                 geo_locations=None, duration_days: int = None,
                 campaign_type: str = "Search") -> dict:
    """Create a complete, PAUSED Search campaign from the approved strategy.

    Builds CampaignBudget → Campaign → AdGroup → Keywords → ResponsiveSearchAd → Sitelinks →
    Callouts. Prefer this over publish_campaign(), which creates a campaign with nothing inside
    it and therefore can never deliver.

    The campaign is always created PAUSED and is never enabled here — activating it (and
    therefore starting spend) stays a deliberate human action inside Google Ads.
    """
    if not conn.customer_id:
        raise GoogleAdsApiError("No Google Ads customer account selected.")

    # None for a directly-authorised account; a manager id only when we must act through one.
    lcid = _conn_lcid(conn)

    warnings = []
    sitelinks = list(sitelinks or [])
    callouts = list(callouts or [])

    if (campaign_type or "Search").strip().lower() != "search":
        warnings.append(
            f'The approved strategy asks for a "{campaign_type}" campaign, but only Search '
            f"campaigns can be built through the API today — a Search campaign was created "
            f"instead. Change the type inside Google Ads if that is wrong.")

    # Validate everything first: Google has no cross-service transaction, so a late rejection
    # would otherwise strand a half-built campaign in the account.
    clean = validate_search_payload(
        headlines=headlines, descriptions=descriptions, keywords=keywords, final_url=final_url,
        sitelinks=sitelinks, callouts=callouts, daily_budget_major=daily_budget_major)

    warnings.extend(clean.get("warnings") or [])
    if clean["dropped_headlines"]:
        warnings.append(f"{clean['dropped_headlines']} extra headline(s) were not used — Google "
                        f"allows at most {RSA_MAX_HEADLINES} per responsive search ad.")
    if clean["dropped_descriptions"]:
        warnings.append(f"{clean['dropped_descriptions']} extra description(s) were not used — "
                        f"Google allows at most {RSA_MAX_DESCRIPTIONS} per responsive search ad.")
    if not clean["keywords"]:
        warnings.append("No valid keywords were found in the approved strategy, so the ad group "
                        "has none. A Search campaign will not serve without keywords.")

    token = await _ensure_access_token(conn)
    customer_id = conn.customer_id
    micros = int(round(clean["daily_budget_major"] * 1_000_000))
    stamp = int(datetime.datetime.utcnow().timestamp())
    campaign_name = (name or "Raftra Campaign").strip()[:255]

    budget_rn = campaign_rn = None
    async with httpx.AsyncClient(timeout=60) as client:
        results = await _mutate(client, token, lcid, customer_id, "campaignBudgets", [{"create": {
            "name": f"{campaign_name} - Budget - {stamp}",
            "amountMicros": str(micros),
            "deliveryMethod": "STANDARD",
            "explicitlyShared": False,
        }}], "Creating the campaign budget")
        budget_rn = results[0]["resourceName"]

        try:
            campaign_body = {
                "name": f"{campaign_name} - {stamp}",
                "status": "PAUSED",                 # never auto-spend
                "advertisingChannelType": "SEARCH",
                "campaignBudget": budget_rn,
                "networkSettings": {
                    "targetGoogleSearch": True,
                    "targetSearchNetwork": True,
                    "targetContentNetwork": False,
                    "targetPartnerSearchNetwork": False,
                },
            }
            # Bidding: Maximize Clicks is TargetSpend in the API. Everything else falls back to
            # Manual CPC, which is the only strategy that never depends on conversion tracking
            # the workspace may not have set up yet.
            if _OBJECTIVE_TO_BIDDING.get((objective or "").strip().lower()) == "MAXIMIZE_CLICKS":
                campaign_body["targetSpend"] = {}
            else:
                campaign_body["manualCpc"] = {"enhancedCpcEnabled": False}

            today = datetime.date.today()
            campaign_body["startDate"] = today.strftime("%Y-%m-%d")
            if duration_days and int(duration_days) > 0:
                campaign_body["endDate"] = (today + datetime.timedelta(days=int(duration_days))).strftime("%Y-%m-%d")

            results = await _mutate(client, token, lcid, customer_id, "campaigns",
                                    [{"create": campaign_body}], "Creating the campaign")
            campaign_rn = results[0]["resourceName"]
            campaign_id = campaign_rn.split("/")[-1]

            # Geo targeting (best effort — never blocks the launch).
            geo_rns, geo_warnings = await _resolve_geo_targets(client, token, lcid, customer_id, geo_locations)
            warnings.extend(geo_warnings)
            if geo_rns:
                try:
                    await _mutate(client, token, lcid, customer_id, "campaignCriteria",
                                  [{"create": {"campaign": campaign_rn,
                                               "location": {"geoTargetConstant": rn}}} for rn in geo_rns],
                                  "Applying geo targeting")
                except GoogleAdsApiError as e:
                    warnings.append(f"Geo targeting was not applied — {e.message}")

            cpc_bid = max(100_000, min(50_000_000, int(micros * 0.1)))
            results = await _mutate(client, token, lcid, customer_id, "adGroups", [{"create": {
                "name": f"{campaign_name} - Ad Group",
                "campaign": campaign_rn,
                "status": "ENABLED",           # the PAUSED campaign above is what stops delivery
                "type": "SEARCH_STANDARD",
                "cpcBidMicros": str(cpc_bid),
            }}], "Creating the ad group")
            ad_group_rn = results[0]["resourceName"]
            ad_group_id = ad_group_rn.split("/")[-1]

            keyword_resources = []
            if clean["keywords"]:
                results = await _mutate(client, token, lcid, customer_id, "adGroupCriteria", [
                    {"create": {"adGroup": ad_group_rn, "status": "ENABLED",
                                "keyword": {"text": k["text"], "matchType": k["match_type"]}}}
                    for k in clean["keywords"]
                ], "Creating keywords")
                keyword_resources = [
                    {"resource_name": r["resourceName"], "text": k["text"], "match_type": k["match_type"]}
                    for r, k in zip(results, clean["keywords"])
                ]

            results = await _mutate(client, token, lcid, customer_id, "adGroupAds", [{"create": {
                "adGroup": ad_group_rn,
                "status": "ENABLED",
                "ad": {
                    "finalUrls": [clean["final_url"]],
                    "responsiveSearchAd": {
                        "headlines": [{"text": h} for h in clean["headlines"]],
                        "descriptions": [{"text": d} for d in clean["descriptions"]],
                    },
                },
            }}], "Creating the responsive search ad")
            ad_group_ad_rn = results[0]["resourceName"]
            ad_id = ad_group_ad_rn.split("~")[-1]

            # Sitelinks and callouts are refinements: a failure here is reported, not fatal,
            # because the campaign underneath is already valid and complete.
            created_assets = {"sitelinks": [], "callouts": []}
            if clean["sitelinks"]:
                try:
                    # Only linkText is sent. Google requires description1 and description2 to be
                    # set together, and the strategy supplies a single description line, so
                    # sending it would fail the whole asset — the sitelink itself is what
                    # matters, and it is created correctly.
                    results = await _mutate(client, token, lcid, customer_id, "assets", [
                        {"create": {"finalUrls": [sl["url"]],
                                    "sitelinkAsset": {"linkText": sl["text"]}}}
                        for sl in clean["sitelinks"]
                    ], "Creating sitelink assets")
                    asset_rns = [r["resourceName"] for r in results]
                    await _mutate(client, token, lcid, customer_id, "campaignAssets", [
                        {"create": {"campaign": campaign_rn, "asset": rn, "fieldType": "SITELINK"}}
                        for rn in asset_rns
                    ], "Linking sitelinks to the campaign")
                    created_assets["sitelinks"] = [
                        {"resource_name": rn, "text": sl["text"]}
                        for rn, sl in zip(asset_rns, clean["sitelinks"])
                    ]
                except GoogleAdsApiError as e:
                    warnings.append(f"Sitelinks were not created — {e.message}")

            if clean["callouts"]:
                try:
                    results = await _mutate(client, token, lcid, customer_id, "assets", [
                        {"create": {"calloutAsset": {"calloutText": text}}}
                        for text in clean["callouts"]
                    ], "Creating callout assets")
                    asset_rns = [r["resourceName"] for r in results]
                    await _mutate(client, token, lcid, customer_id, "campaignAssets", [
                        {"create": {"campaign": campaign_rn, "asset": rn, "fieldType": "CALLOUT"}}
                        for rn in asset_rns
                    ], "Linking callouts to the campaign")
                    created_assets["callouts"] = [
                        {"resource_name": rn, "text": text}
                        for rn, text in zip(asset_rns, clean["callouts"])
                    ]
                except GoogleAdsApiError as e:
                    warnings.append(f"Callouts were not created — {e.message}")

        except Exception:
            # Anything that got created before the failure is removed, so a retry starts clean
            # instead of piling half-built campaigns into the account.
            await _remove_quietly(client, token, lcid, customer_id, "campaigns", [campaign_rn])
            await _remove_quietly(client, token, lcid, customer_id, "campaignBudgets", [budget_rn])
            raise

    return {
        "customer_id": customer_id,
        "campaign_id": campaign_id,
        "campaign_resource_name": campaign_rn,
        "campaign_name": campaign_body["name"],
        "campaign_status": "PAUSED",
        "campaign_budget_id": budget_rn.split("/")[-1],
        "campaign_budget_resource_name": budget_rn,
        "daily_budget": round(micros / 1_000_000, 2),
        "ad_group_id": ad_group_id,
        "ad_group_resource_name": ad_group_rn,
        "ad_id": ad_id,
        "ad_group_ad_resource_name": ad_group_ad_rn,
        "headlines": clean["headlines"],
        "descriptions": clean["descriptions"],
        "final_url": clean["final_url"],
        "keywords": keyword_resources,
        "assets": created_assets,
        "geo_target_constants": geo_rns,
        "warnings": warnings,
        "url": f"https://ads.google.com/aw/campaigns?campaignId={campaign_id}&ocid={customer_id}",
    }


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
