"""
Competitor ad ingestion from the Meta Ad Library, on a fortnightly cadence.

What is actually available, because this is the part that gets over-promised:

* Meta's official Ad Library API (`/ads_archive`) returns EVERY active ad - commercial
  included - only when `ad_reached_countries` is an EU member state, because the DSA
  requires it there. Everywhere else (India included) the API is limited to
  `ad_type=POLITICAL_AND_ISSUE_ADS`. The Ad Library *website* shows commercial ads for
  every country; the API does not.
* So a brand selling in India cannot lawfully pull a rival's commercial creatives from the
  official API. The options are an EU country code (if the rival runs there), or a
  third-party collector such as an Apify actor, which is what the spec listed as the
  alternative and what `APIFY_TOKEN` enables here.

This module implements both paths and reports which one produced the rows, so nothing in
the UI is ever presented as "from Meta" when it came from a scraper - or, worse,
fabricated because neither source was configured. When nothing is configured it raises;
it never invents ads.
"""
import os
import re
from datetime import datetime, timezone
from typing import List, Optional

import httpx

GRAPH_VERSION = os.getenv("META_GRAPH_VERSION", "v23.0")
GRAPH = "https://graph.facebook.com/" + GRAPH_VERSION
_TIMEOUT = 45

# The countries where /ads_archive returns commercial ads (EU + EEA, per the DSA).
EU_COUNTRIES = {
    "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE",
    "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
    "IS", "LI", "NO",
}

_FIELDS = ",".join([
    "id", "page_id", "page_name", "ad_creation_time", "ad_delivery_start_time",
    "ad_delivery_stop_time", "ad_creative_bodies", "ad_creative_link_titles",
    "ad_creative_link_descriptions", "ad_creative_link_captions", "ad_snapshot_url",
    "publisher_platforms", "languages", "target_locations",
])


class AdLibraryError(RuntimeError):
    """Raised when no configured source can answer - never swallowed into empty results,
    because "this competitor runs no ads" and "we could not look" are different answers."""


def official_api_available(country: str) -> bool:
    """True when /ads_archive will return commercial ads for this country."""
    return (country or "").strip().upper() in EU_COUNTRIES


def _token() -> Optional[str]:
    return (os.getenv("META_AD_LIBRARY_TOKEN") or os.getenv("META_ACCESS_TOKEN") or "").strip() or None


def is_configured() -> bool:
    return bool(_token() or os.getenv("APIFY_TOKEN"))


# ---------------------------------------------------------------- offer parsing

# Discount codes are how a rival's offer strategy actually shows up in ad copy, and they
# are the one thing in an ad that is unambiguous enough to extract with a regex.
_CODE_RE = re.compile(r"\b(?:code|coupon|promo)\s*[:\-]?\s*([A-Z0-9]{3,15})\b", re.I)
_PERCENT_RE = re.compile(r"\b(\d{1,2})\s*%\s*(?:extra\s*)?(?:off|discount)\b", re.I)
_FLAT_RE = re.compile(r"(?:flat|save|get)\s*(?:rs\.?|inr|₹|\$|€|£)\s?(\d{2,6})\b", re.I)
_FREE_RE = re.compile(r"\bfree\s+(shipping|delivery|gift|trial|returns)\b", re.I)


def extract_offers(text: str) -> dict:
    """Offer signals in one ad's copy: {"code", "percent_off", "flat_off", "perks"}."""
    text = text or ""
    code = _CODE_RE.search(text)
    percent = _PERCENT_RE.search(text)
    flat = _FLAT_RE.search(text)
    perks = sorted({m.group(1).lower() for m in _FREE_RE.finditer(text)})
    return {
        "code": code.group(1).upper() if code else "",
        "percent_off": int(percent.group(1)) if percent else None,
        "flat_off": int(flat.group(1)) if flat else None,
        "perks": perks,
    }


def _parse_ts(value: str) -> Optional[datetime]:
    if not value:
        return None
    raw = str(value).replace("Z", "+00:00")
    try:
        dt = datetime.fromisoformat(raw)
    except ValueError:
        try:
            dt = datetime.strptime(str(value)[:10], "%Y-%m-%d")
        except ValueError:
            return None
    return dt.replace(tzinfo=None) if dt.tzinfo is None else dt.astimezone(timezone.utc).replace(tzinfo=None)


def days_active(start: Optional[datetime], stop: Optional[datetime]) -> Optional[int]:
    """How long an ad has been running. This is the fatigue signal: a creative still live
    after 60 days is a proven winner the rival keeps paying for, and one dead inside a
    week lost. Without it a list of ads says nothing about what works."""
    if not start:
        return None
    end = stop or datetime.utcnow()
    return max(0, (end - start).days)


# ---------------------------------------------------------------- official API

async def _fetch_official(client: httpx.AsyncClient, competitor: str, country: str,
                          limit: int) -> List[dict]:
    token = _token()
    if not token:
        return []
    params = {
        "access_token": token,
        "ad_reached_countries": "['%s']" % country.upper(),
        "search_terms": competitor,
        "ad_active_status": "ACTIVE",
        "ad_type": "ALL" if official_api_available(country) else "POLITICAL_AND_ISSUE_ADS",
        "fields": _FIELDS,
        "limit": min(limit, 100),
    }
    r = await client.get(GRAPH + "/ads_archive", params=params)
    if r.status_code != 200:
        detail = ""
        try:
            detail = (r.json().get("error") or {}).get("message", "")
        except Exception:
            detail = r.text[:200]
        raise AdLibraryError("Meta Ad Library API returned %s: %s" % (r.status_code, detail))

    rows = []
    for ad in (r.json().get("data") or [])[:limit]:
        bodies = ad.get("ad_creative_bodies") or []
        titles = ad.get("ad_creative_link_titles") or []
        start = _parse_ts(ad.get("ad_delivery_start_time"))
        stop = _parse_ts(ad.get("ad_delivery_stop_time"))
        copy_text = "\n".join(bodies)
        rows.append({
            "external_id": str(ad.get("id") or ""),
            "competitor_name": ad.get("page_name") or competitor,
            "ad_title": (titles[0] if titles else "")[:300],
            "ad_copy": copy_text[:4000],
            "snapshot_url": ad.get("ad_snapshot_url") or "",
            "platforms": ad.get("publisher_platforms") or [],
            "started_at": start,
            "days_active": days_active(start, stop),
            "offers": extract_offers(copy_text + " " + " ".join(titles)),
            "source": "Meta Ad Library API",
        })
    return rows


# ---------------------------------------------------------------- Apify fallback

async def _fetch_apify(client: httpx.AsyncClient, competitor: str, country: str,
                       limit: int) -> List[dict]:
    """Run an Apify Meta-Ads actor synchronously and map its items onto our shape.

    Actor output schemas differ between actors and change between versions, so every field
    is read through a list of plausible keys rather than one. A missing field yields an
    empty value; it never guesses.
    """
    token = os.getenv("APIFY_TOKEN")
    actor = os.getenv("APIFY_META_ADS_ACTOR", "apify~facebook-ads-scraper")
    if not token:
        return []

    url = "https://api.apify.com/v2/acts/%s/run-sync-get-dataset-items" % actor
    payload = {"startUrls": [{"url": "https://www.facebook.com/ads/library/?active_status=active"
                                     "&ad_type=all&country=%s&q=%s" % (country.upper(), competitor)}],
               "maxItems": limit, "country": country.upper(), "searchTerms": [competitor]}
    r = await client.post(url, params={"token": token}, json=payload, timeout=180)
    if r.status_code not in (200, 201):
        raise AdLibraryError("Apify actor %s returned %s: %s" % (actor, r.status_code, r.text[:200]))

    def pick(item: dict, *keys):
        for k in keys:
            v = item.get(k)
            if v not in (None, "", [], {}):
                return v
        return ""

    rows = []
    for item in (r.json() or [])[:limit]:
        if not isinstance(item, dict):
            continue
        body = pick(item, "adText", "body", "text", "ad_creative_body", "description")
        if isinstance(body, dict):
            body = body.get("text", "")
        title = pick(item, "title", "adTitle", "headline", "linkTitle")
        start = _parse_ts(str(pick(item, "startDate", "startDateFormatted",
                                   "ad_delivery_start_time", "startedRunningOn")))
        stop = _parse_ts(str(pick(item, "endDate", "ad_delivery_stop_time")))
        copy_text = str(body or "")
        rows.append({
            "external_id": str(pick(item, "adArchiveId", "adId", "id")),
            "competitor_name": str(pick(item, "pageName", "advertiser", "page_name")) or competitor,
            "ad_title": str(title)[:300],
            "ad_copy": copy_text[:4000],
            "snapshot_url": str(pick(item, "adLibraryUrl", "url", "snapshotUrl")),
            "platforms": pick(item, "publisherPlatform", "platforms") or [],
            "started_at": start,
            "days_active": days_active(start, stop),
            "offers": extract_offers(copy_text + " " + str(title)),
            "source": "Apify (%s)" % actor,
        })
    return rows


async def fetch_competitor_ads(competitor: str, country: str = "IN",
                               limit: int = 25) -> List[dict]:
    """Active ads for one competitor, from whichever configured source can answer.

    Order is deliberate: the official API first because it is the authoritative source and
    free, Apify only when the official route cannot cover this country. Raises
    AdLibraryError when neither is configured, so a caller can tell "nothing configured"
    from "this rival has no live ads".
    """
    competitor = (competitor or "").strip()
    if not competitor:
        raise AdLibraryError("No competitor given.")
    if not is_configured():
        raise AdLibraryError(
            "No ad source configured. Set META_AD_LIBRARY_TOKEN (returns commercial ads for "
            "EU/EEA countries only) and/or APIFY_TOKEN for non-EU markets such as India.")

    errors: List[str] = []
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        if _token():
            try:
                rows = await _fetch_official(client, competitor, country, limit)
                if rows:
                    return rows
                if official_api_available(country):
                    # The API answered for a country where it does cover commercial ads,
                    # and returned nothing. That is a real "no active ads", not a gap.
                    return []
                errors.append(
                    "the official API returns only political/issue ads for %s" % country.upper())
            except AdLibraryError as e:
                errors.append(str(e))

        if os.getenv("APIFY_TOKEN"):
            try:
                return await _fetch_apify(client, competitor, country, limit)
            except AdLibraryError as e:
                errors.append(str(e))

    raise AdLibraryError("Could not read ads for '%s' in %s: %s"
                         % (competitor, country.upper(), "; ".join(errors) or "no source answered"))


# ---------------------------------------------------------------- strategy analysis

_STRATEGY_PROMPT = """You are a paid-social strategist. Below are a competitor's currently
active Meta ads, each with how many days it has been running.

Return ONLY JSON, no code fence:
{
  "summary": "",
  "evergreen_winners": [],
  "fatiguing": [],
  "offer_strategy": "",
  "blue_ocean": {"title": "", "rationale": "", "actions": []},
  "red_ocean": {"title": "", "rationale": "", "actions": []},
  "recommended_formats": []
}

Rules:
- "evergreen_winners": ads running 45+ days - the rival keeps paying for these, so treat
  them as proven. "fatiguing": ads under 10 days old that repeat an older angle.
- "blue_ocean" is an angle NONE of these ads occupies. "red_ocean" is the crowded claim
  the brand must still defend. Both must cite what is actually in the ads below.
- Every "actions" entry is one producible creative brief, not a platitude.
- If the ads are too few or too thin to support a field, return "" or [].

ADS:
"""


async def analyse_ads(llm, brand_name: str, ads: List[dict]) -> dict:
    """Turn raw ads into the strategy read the Market Intelligence screen shows.

    Returns {} when there is nothing to analyse - the caller shows the raw ad list rather
    than a strategy invented from three ads.
    """
    import json
    if not ads:
        return {}
    lines = []
    for a in ads[:40]:
        offer = a.get("offers") or {}
        bits = []
        if offer.get("code"):
            bits.append("code %s" % offer["code"])
        if offer.get("percent_off"):
            bits.append("%s%% off" % offer["percent_off"])
        if offer.get("perks"):
            bits.append("free " + "/".join(offer["perks"]))
        lines.append("- [%s] %s days active | %s | %s%s"
                     % (a.get("competitor_name", ""), a.get("days_active", "?"),
                        (a.get("ad_title") or "")[:80],
                        (a.get("ad_copy") or "").replace("\n", " ")[:220],
                        (" | offers: " + ", ".join(bits)) if bits else ""))

    raw = await llm.generate_text(
        _STRATEGY_PROMPT + "\n".join(lines) + "\n\nThe brand commissioning this is: " + (brand_name or "the brand"),
        system_prompt="You are a precise paid-social strategist. You output JSON only.")
    blob = re.search(r"\{.*\}", raw or "", re.S)
    if not blob:
        return {}
    try:
        data = json.loads(blob.group(0))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}
