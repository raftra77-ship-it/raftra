"""
Market & search-trend ingestion, on a four-weekly cadence.

Three real sources, each optional, and the report says which ones answered:

* Search interest - SerpApi's Google Trends engine when SERPAPI_KEY is set, otherwise
  pytrends (free, unofficial, rate-limited). Either yields a 0-100 interest index per
  keyword for a region, which is what makes one keyword worth a campaign and another not.
* Creator video references - YouTube Data API v3 (10k free units/day). Real Shorts and
  reviews in the category, so a video brief can point at a format that already works
  rather than describing one in the abstract.
* Copy hooks - an LLM, given the keyword scores and the video titles above. This is the
  only generated part, and it is generated FROM the fetched data, not instead of it.

Nothing here fabricates a trend. With no source configured, `build_trend_report` raises,
because an empty radar is honest and a made-up one is not.
"""
import os
import re
from datetime import date, timedelta
from typing import List, Optional

import httpx

_TIMEOUT = 45

# Search intent buckets. A keyword's bucket decides what creative it deserves: a
# high-intent query wants an offer and a product shot, a lifestyle one wants a story.
INTENT_BUCKETS = ("high_intent", "utility", "lifestyle", "core")

_HIGH_INTENT_RE = re.compile(
    r"\b(buy|price|cheap|best|top|deal|offer|discount|near me|online|sale|vs|review)\b", re.I)
_UTILITY_RE = re.compile(
    r"\b(how to|what is|guide|fix|setup|install|charge|use|works?|meaning|difference)\b", re.I)
_LIFESTYLE_RE = re.compile(
    r"\b(aesthetic|setup|travel|gift|style|routine|desk|outfit|ideas?)\b", re.I)


def classify_intent(keyword: str, is_seed: bool = False) -> str:
    """Which bucket a keyword falls in. Seeds are 'core' unless they read as something
    sharper - the category term itself is the demand baseline, not an intent."""
    k = keyword or ""
    if _HIGH_INTENT_RE.search(k):
        return "high_intent"
    if _UTILITY_RE.search(k):
        return "utility"
    if _LIFESTYLE_RE.search(k):
        return "lifestyle"
    return "core" if is_seed else "utility"


class TrendSourceError(RuntimeError):
    """No configured source could answer."""


def is_configured() -> bool:
    return bool(os.getenv("SERPAPI_KEY") or os.getenv("YOUTUBE_API_KEY") or _pytrends_available())


def _pytrends_available() -> bool:
    try:
        import pytrends  # noqa: F401
        return True
    except ImportError:
        return False


# ---------------------------------------------------------------- search interest

async def _serpapi_trends(client: httpx.AsyncClient, keywords: List[str],
                          region: str) -> List[dict]:
    """Google Trends via SerpApi. Batched five at a time, which is Trends' own limit -
    asking for more silently drops the tail rather than erroring."""
    key = os.getenv("SERPAPI_KEY")
    if not key:
        return []
    out: List[dict] = []
    for i in range(0, len(keywords), 5):
        batch = keywords[i:i + 5]
        r = await client.get("https://serpapi.com/search", params={
            "engine": "google_trends", "q": ",".join(batch), "geo": region.upper(),
            "data_type": "TIMESERIES", "date": "today 3-m", "api_key": key,
        })
        if r.status_code != 200:
            continue
        series = (r.json().get("interest_over_time") or {}).get("timeline_data") or []
        totals: dict = {}
        for point in series:
            for entry in point.get("values") or []:
                name = entry.get("query") or ""
                try:
                    value = int(entry.get("extracted_value") or 0)
                except (TypeError, ValueError):
                    continue
                totals.setdefault(name, []).append(value)
        for name, values in totals.items():
            if values:
                out.append({"keyword": name, "score": round(sum(values) / len(values)),
                            "source": "SerpApi Google Trends"})
    return out


def _pytrends_interest(keywords: List[str], region: str) -> List[dict]:
    """Google Trends via pytrends. Synchronous and blocking, so the caller runs it in a
    thread; unofficial, so a failure here is expected rather than exceptional."""
    try:
        from pytrends.request import TrendReq
    except ImportError:
        return []
    out: List[dict] = []
    try:
        pt = TrendReq(hl="en-US", tz=330)
        for i in range(0, len(keywords), 5):
            batch = keywords[i:i + 5]
            pt.build_payload(batch, timeframe="today 3-m", geo=region.upper())
            frame = pt.interest_over_time()
            if frame is None or frame.empty:
                continue
            for name in batch:
                if name in frame.columns:
                    out.append({"keyword": name, "score": int(round(float(frame[name].mean()))),
                                "source": "Google Trends (pytrends)"})
    except Exception as e:
        print("[market_trends] pytrends failed: %s" % e)
    return out


# ---------------------------------------------------------------- creator videos

async def fetch_creator_videos(client: httpx.AsyncClient, query: str, region: str,
                               limit: int = 6) -> List[dict]:
    """Recent, popular videos in the category via YouTube Data API v3.

    Restricted to the last 120 days: a three-year-old review is not a format signal, and
    the whole point of this list is to show what is landing now.
    """
    key = os.getenv("YOUTUBE_API_KEY")
    if not key or not query.strip():
        return []
    after = (date.today() - timedelta(days=120)).isoformat() + "T00:00:00Z"
    r = await client.get("https://www.googleapis.com/youtube/v3/search", params={
        "part": "snippet", "q": query, "type": "video", "order": "viewCount",
        "publishedAfter": after, "regionCode": region.upper(), "maxResults": limit,
        "key": key,
    })
    if r.status_code != 200:
        print("[market_trends] YouTube API returned %s: %s" % (r.status_code, r.text[:200]))
        return []
    out = []
    for item in (r.json().get("items") or []):
        vid = (item.get("id") or {}).get("videoId")
        snip = item.get("snippet") or {}
        if not vid:
            continue
        out.append({
            "title": snip.get("title", ""),
            "channel": snip.get("channelTitle", ""),
            "published_at": (snip.get("publishedAt") or "")[:10],
            "url": "https://www.youtube.com/watch?v=" + vid,
            "thumbnail": ((snip.get("thumbnails") or {}).get("medium") or {}).get("url", ""),
        })
    return out


# ---------------------------------------------------------------- keyword seeds

def seed_keywords(brand_name: str, categories: List[str], extra: Optional[List[str]] = None,
                  limit: int = 12) -> List[str]:
    """Keywords to measure, built from the brand's own product categories.

    Deliberately derived rather than asked for: the categories already came out of the
    brand's site during onboarding, so the radar tracks the brand's actual market instead
    of whatever a user happened to type.
    """
    seeds: List[str] = []
    for cat in (categories or [])[:5]:
        base = re.sub(r"\s+", " ", str(cat or "")).strip().lower()
        if not base or len(base) < 3:
            continue
        seeds.extend([base, "best " + base, base + " price", base + " online"])
    for e in (extra or []):
        e = str(e or "").strip().lower()
        if e:
            seeds.append(e)
    if not seeds and brand_name:
        seeds = [brand_name.strip().lower()]

    ordered, seen = [], set()
    for s in seeds:
        if s not in seen:
            seen.add(s)
            ordered.append(s)
    return ordered[:limit]


# ---------------------------------------------------------------- hooks

_HOOK_PROMPT = """You are a direct-response copywriter.

Below are search keywords with a 0-100 interest index for one market, and the video
formats currently winning attention in that category.

Return ONLY JSON, no code fence:
{
  "headline": "",
  "summary": "",
  "keywords": [{"keyword": "", "score": 0, "bucket": "", "hook": ""}],
  "winning_patterns": [],
  "creative_formats": []
}

Rules:
- Return one entry in "keywords" for EVERY keyword given, keeping its score and bucket
  exactly as supplied. Add a "hook": one line of ad copy that answers that search intent.
- "winning_patterns": what the video titles have in common as a format, in plain language.
- "creative_formats": producible formats for this brand, each one sentence.
- Ground everything in the data below. Do not invent keywords or metrics.

DATA:
"""


async def generate_hooks(llm, brand_name: str, region: str, keywords: List[dict],
                         videos: List[dict]) -> dict:
    """Copy hooks and format patterns, generated from the fetched data. {} on any failure -
    the report still ships with its real keyword scores and video list."""
    import json
    if not keywords and not videos:
        return {}
    payload = ["BRAND: %s" % (brand_name or "the brand"), "MARKET: %s" % region.upper(), "", "KEYWORDS:"]
    payload += ["- %s | score %s | bucket %s" % (k["keyword"], k["score"], k.get("bucket", "core"))
                for k in keywords]
    if videos:
        payload += ["", "TRENDING VIDEOS:"]
        payload += ["- %s (%s, %s)" % (v["title"], v["channel"], v["published_at"]) for v in videos]
    try:
        raw = await llm.generate_text("\n".join([_HOOK_PROMPT] + payload),
                                      system_prompt="You are a precise copywriter. You output JSON only.")
    except Exception as e:
        print("[market_trends] hook generation failed: %s" % e)
        return {}
    blob = re.search(r"\{.*\}", raw or "", re.S)
    if not blob:
        return {}
    try:
        data = json.loads(blob.group(0))
    except json.JSONDecodeError:
        return {}
    return data if isinstance(data, dict) else {}


# ---------------------------------------------------------------- the report

async def build_trend_report(llm, brand_name: str, categories: List[str], region: str = "IN",
                             extra_keywords: Optional[List[str]] = None) -> dict:
    """One four-weekly market report for a workspace.

    Raises TrendSourceError when no source is configured, so the scheduler records a real
    failure instead of writing an empty report that looks like a quiet market.
    """
    if not is_configured():
        raise TrendSourceError(
            "No trend source configured. Set SERPAPI_KEY (or install pytrends) for search "
            "interest, and YOUTUBE_API_KEY for creator video references.")

    keywords = seed_keywords(brand_name, categories, extra_keywords)
    if not keywords:
        raise TrendSourceError(
            "No product categories on the brand profile yet - run brand onboarding first so "
            "the radar knows which market to measure.")

    scored: List[dict] = []
    sources: List[str] = []

    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        if os.getenv("SERPAPI_KEY"):
            scored = await _serpapi_trends(client, keywords, region)
            if scored:
                sources.append("SerpApi Google Trends")

        if not scored and _pytrends_available():
            import asyncio
            scored = await asyncio.to_thread(_pytrends_interest, keywords, region)
            if scored:
                sources.append("Google Trends (pytrends)")

        video_query = (categories[0] if categories else brand_name) or brand_name
        videos = await fetch_creator_videos(client, video_query, region)
        if videos:
            sources.append("YouTube Data API v3")

    if not scored and not videos:
        raise TrendSourceError(
            "Every configured trend source returned nothing for %s in %s." % (video_query, region.upper()))

    seed_set = {c.strip().lower() for c in (categories or [])}
    for row in scored:
        row["bucket"] = classify_intent(row["keyword"], is_seed=row["keyword"].lower() in seed_set)
    scored.sort(key=lambda r: r.get("score") or 0, reverse=True)

    generated = await generate_hooks(llm, brand_name, region, scored, videos) if llm else {}

    # Hooks are merged onto the measured rows by keyword, so a model that drops or invents
    # a keyword cannot change the scores - the numbers stay exactly as fetched.
    hooks_by_kw = {str(k.get("keyword", "")).lower(): str(k.get("hook", ""))
                   for k in (generated.get("keywords") or []) if isinstance(k, dict)}
    for row in scored:
        row["hook"] = hooks_by_kw.get(row["keyword"].lower(), "")

    today = date.today()
    return {
        "report_title": generated.get("headline") or ("%s market radar - %s" % (
            (categories[0] if categories else brand_name) or "Market", today.strftime("%b %Y"))),
        "summary": generated.get("summary") or "",
        "region": region.upper(),
        "period_start": today - timedelta(days=90),
        "period_end": today,
        "strategic_keywords": scored,
        "winning_patterns": [str(p) for p in (generated.get("winning_patterns") or [])][:8],
        "creative_formats": [str(f) for f in (generated.get("creative_formats") or [])][:8],
        "creator_video_refs": videos,
        "sources": sources,
    }
