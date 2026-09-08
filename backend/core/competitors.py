"""
Competitor research from public sources.

There is no general API for a competitor's paid ads: Meta's Ad Library API only returns
political and social-issue ads outside the EU, and Google's Ads Transparency Center has no
API at all. Rather than fake an ad library, this reads what IS public - the competitor's own
site and what search turns up about them - and has the model extract positioning, offers,
hooks and CTAs from that text.

The rule that keeps it honest: every field must be traceable to the fetched text. The model
is told to return empty rather than guess, and the sources it read are returned alongside
the analysis so the UI can show where each claim came from.

Uses only keys the project already has: TAVILY_API_KEY (search), FIRECRAWL_API_KEY (scrape,
optional - falls back to a direct fetch) and GEMINI_API_KEY (extraction).
"""
import json
import os
import re
from typing import Optional

import httpx

_UA = "Mozilla/5.0 (compatible; RaftraBot/1.0)"
_PAGE_CHARS = 6000
_TIMEOUT = 30


def _html_to_text(html: str) -> str:
    """Crude but dependency-free HTML -> text, matching the onboarding crawler's approach."""
    html = re.sub(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    for ent, ch in [("&amp;", "&"), ("&nbsp;", " "), ("&quot;", '"'), ("&#39;", "'"),
                    ("&lt;", "<"), ("&gt;", ">")]:
        html = html.replace(ent, ch)
    return re.sub(r"\s+", " ", html).strip()


async def _resolve_site(client: httpx.AsyncClient, competitor: str) -> Optional[str]:
    """A bare brand name has to become a URL before anything can be read. Tavily's top result
    for "<name> official site" is that lookup; an input that already looks like a URL is
    used as-is."""
    value = (competitor or "").strip()
    if not value:
        return None
    if value.startswith(("http://", "https://")):
        return value
    if "." in value and " " not in value:
        return "https://" + value

    key = os.getenv("TAVILY_API_KEY")
    if not key:
        return None
    try:
        r = await client.post("https://api.tavily.com/search",
                              json={"api_key": key, "query": f"{value} official website",
                                    "max_results": 3})
        if r.status_code != 200:
            return None
        for item in (r.json().get("results") or []):
            url = item.get("url")
            if url:
                return url
    except Exception as e:
        print(f"[competitors] site lookup failed for {value!r}: {e}")
    return None


# Interstitials a bare request gets served instead of the site. Short, and they look like
# real content to a length check, which is how an error page reached the model as source.
_BLOCK_MARKERS = (
    "there was a problem loading this website",
    "enable javascript and cookies to continue",
    "checking your browser",
    "attention required",
    "access denied",
    "just a moment",
)


def _looks_blocked(text: str) -> bool:
    t = (text or "").strip().lower()
    return len(t) < 400 or any(m in t for m in _BLOCK_MARKERS)


async def _firecrawl_page(client: httpx.AsyncClient, url: str) -> str:
    """Read one page through Firecrawl, which renders JS and clears the interstitials.

    Already configured for onboarding, so this needs no new key. Any failure returns "" and
    the caller falls back to the direct fetch.
    """
    key = os.getenv("FIRECRAWL_API_KEY")
    if not key:
        return ""
    try:
        r = await client.post(
            "https://api.firecrawl.dev/v1/scrape",
            headers={"Authorization": f"Bearer {key}"},
            json={"url": url, "formats": ["markdown"], "onlyMainContent": True},
            timeout=60,
        )
        if r.status_code != 200:
            return ""
        return ((r.json().get("data") or {}).get("markdown") or "")[:20000]
    except Exception as e:
        print(f"Firecrawl scrape failed for {url}: {e}")
        return ""


async def _read_site(client: httpx.AsyncClient, url: str) -> str:
    """Firecrawl markdown when a key is set (renders JS, so SPA storefronts work), else a
    plain fetch of the HTML."""
    key = os.getenv("FIRECRAWL_API_KEY")
    if key:
        try:
            r = await client.post("https://api.firecrawl.dev/v1/scrape",
                                  headers={"Authorization": f"Bearer {key}",
                                           "Content-Type": "application/json"},
                                  json={"url": url, "formats": ["markdown"]})
            if r.status_code == 200:
                md = (r.json().get("data") or {}).get("markdown") or ""
                if md.strip():
                    return md[:_PAGE_CHARS]
        except Exception as e:
            print(f"[competitors] firecrawl failed for {url}: {e}")
    try:
        r = await client.get(url)
        if r.status_code == 200:
            return _html_to_text(r.text)[:_PAGE_CHARS]
    except Exception as e:
        print(f"[competitors] direct fetch failed for {url}: {e}")
    return ""


async def _search_context(client: httpx.AsyncClient, competitor: str) -> list:
    """What the wider web says about how this brand markets itself. Returns the raw results
    so their urls can be shown as sources."""
    key = os.getenv("TAVILY_API_KEY")
    if not key:
        return []
    try:
        r = await client.post("https://api.tavily.com/search",
                              json={"api_key": key,
                                    "query": f"{competitor} marketing campaign positioning offers reviews",
                                    "max_results": 5})
        if r.status_code != 200:
            return []
        return r.json().get("results") or []
    except Exception as e:
        print(f"[competitors] search failed for {competitor}: {e}")
        return []


_EXTRACTION_PROMPT = """You are analysing a competitor for a marketing team, using ONLY the source text supplied below.

Return a single JSON object, no prose and no code fences, with exactly these keys:
{
  "positioning": "one or two sentences on how this brand positions itself",
  "audience": "who they appear to target",
  "tone": "the tone their copy uses",
  "offers": ["current offers, discounts or guarantees actually mentioned"],
  "hooks": ["angles or claims they lead with, quoted or closely paraphrased"],
  "ctas": ["calls to action that appear in the text"],
  "notes": "anything a marketer should know, or what the sources did not reveal"
}

Rules:
- Every item must be supported by the source text. If the text does not show something, use an empty array or an empty string.
- Do NOT invent metrics, ad spend, ROAS, engagement rates or ad counts. None of that is in the sources.
- Keep each array to at most 5 short items.
"""


_DISCOVERY_PROMPT = """Name the companies that compete with the brand described below.

Return a single JSON object, no prose and no code fences:
{"competitors": ["Brand A", "Brand B"]}

Rules:
- Real companies only, named as a customer would know them. No descriptions, no URLs.
- They must sell to the same buyers in the same market as the brand described.
- At most 6. Fewer is better than padding the list.
- If the description is too thin to name anyone with confidence, return {"competitors": []}.
  An empty list is a correct answer; a plausible-sounding guess is not.
"""


async def discover_competitors(brand_name: str, categories: Optional[list] = None,
                               region: str = "", context: str = "",
                               limit: int = 5) -> list:
    """Candidate rival names for a brand that has not named any itself.

    The competitor ad sync could only run for a workspace where someone had already typed
    competitor names, so a brand that had onboarded from its URL and nothing else got a
    permanently skipped report. This produces the starting list.

    Search-grounded when TAVILY_API_KEY is set. Without it, the model is asked from the
    brand's own profile text, which is weaker - so the caller is told which happened and the
    names are stored as ordinary rows the user can correct or delete.

    Returns [] rather than raising: no competitors is a reportable outcome, not an error.
    """
    from core.providers.llm_providers import GeminiProvider

    brand_name = (brand_name or "").strip()
    if not brand_name:
        return []

    cats = ", ".join(str(c) for c in (categories or [])[:8])
    grounding = ""
    key = os.getenv("TAVILY_API_KEY")
    if key:
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT, headers={"User-Agent": _UA}) as client:
                r = await client.post("https://api.tavily.com/search",
                                      json={"api_key": key,
                                            "query": "%s competitors alternatives %s %s"
                                                     % (brand_name, cats, region),
                                            "max_results": 6})
                if r.status_code == 200:
                    grounding = "\n".join(
                        "%s - %s" % (x.get("title", ""), (x.get("content") or "")[:300])
                        for x in (r.json().get("results") or []))
        except Exception as e:
            print("[competitors] discovery search failed for %s: %s" % (brand_name, e))

    described = "Brand: %s\nCategories: %s\nMarket: %s\n%s" % (
        brand_name, cats or "unknown", region or "unknown", (context or "")[:1500])
    if grounding:
        described += "\n\nSearch results about this brand's market:\n" + grounding[:4000]

    try:
        raw = await GeminiProvider().generate_text(
            _DISCOVERY_PROMPT + described,
            system_prompt="You are a market analyst. You output JSON only.",
            # Generous for a list of six names because the 2.5 models' thinking tokens are
            # drawn from this same budget: at 400 the answer came back truncated
            # mid-array ('{"competitors": ["GeeksforGeeks", "LeetCode",'), which fails to
            # parse and is indistinguishable from the model declining to name anyone.
            max_output_tokens=1500)
    except Exception as e:
        print("[competitors] discovery failed for %s: %s" % (brand_name, e))
        return []

    try:
        data = json.loads(re.sub(r"^```(?:json)?|```$", "", (raw or "").strip(), flags=re.M))
    except Exception:
        return []

    out, seen = [], {brand_name.lower()}
    for name in (data.get("competitors") or []):
        n = str(name).strip()
        # Guard against the model returning the brand itself, blanks or a sentence.
        if not n or len(n) > 60 or n.lower() in seen:
            continue
        seen.add(n.lower())
        out.append(n)
        if len(out) >= limit:
            break
    return out


async def analyze_competitor(competitor: str) -> dict:
    """Research one competitor. Raises ValueError when nothing readable could be found, so
    the caller can report that plainly instead of returning an empty shell."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=_TIMEOUT,
                                 headers={"User-Agent": _UA}) as client:
        site_url = await _resolve_site(client, competitor)
        page_text = ""
        if site_url:
            # Firecrawl first: the direct fetch is routinely served an interstitial by
            # Cloudflare-fronted storefronts, which is most of them.
            page_text = await _firecrawl_page(client, site_url)
            if _looks_blocked(page_text):
                page_text = await _read_site(client, site_url)
            if _looks_blocked(page_text):
                page_text = ""
        results = await _search_context(client, competitor)

    search_text = "\n\n".join(
        f"[{r.get('url')}]\n{(r.get('content') or '')[:900]}" for r in results if r.get("content")
    )
    if not page_text and not search_text:
        # Two different failures, and the fix differs, so they get different messages.
        # Neither names TAVILY_API_KEY: server configuration is not something the person
        # typing a competitor's name can act on.
        if site_url:
            raise ValueError(
                f"{site_url} could not be read. The site blocks automated readers, or its "
                "content only appears after scripts run. Try a specific page on that site, "
                "such as their products or about page.")
        raise ValueError(
            f"Could not work out which website '{competitor}' is. Enter the full address, "
            "like example.com.")

    sources = []
    if site_url and page_text:
        sources.append({"url": site_url, "kind": "website"})
    for r in results:
        if r.get("url"):
            sources.append({"url": r["url"], "kind": "search", "title": r.get("title") or ""})

    source_block = ""
    if page_text:
        source_block += f"--- {competitor} website ({site_url}) ---\n{page_text}\n\n"
    if search_text:
        source_block += f"--- search results about {competitor} ---\n{search_text}\n"

    from core.providers.llm_providers import GeminiProvider
    from core.providers.base import LLMProviderError
    try:
        raw = await GeminiProvider().generate_text(
            f"{_EXTRACTION_PROMPT}\n\nSOURCE TEXT:\n{source_block[:14000]}",
            system_prompt="You are a precise competitive-research analyst.")
    except LLMProviderError as e:
        raise ValueError(f"Could not analyse the sources: {e}")

    # Models occasionally wrap JSON in fences despite instructions.
    cleaned = re.sub(r"^```(?:json)?|```$", "", (raw or "").strip(), flags=re.M).strip()
    try:
        data = json.loads(cleaned)
    except Exception:
        match = re.search(r"\{.*\}", cleaned, re.S)
        if not match:
            raise ValueError("The analysis did not come back in a readable form.")
        data = json.loads(match.group(0))

    def _list(key):
        value = data.get(key)
        return [str(v) for v in value][:5] if isinstance(value, list) else []

    # A model handed thin or unreadable source text returns every field blank. Answering 200
    # with that produces a confident, empty report, so say what happened instead.
    if not any([str(data.get("positioning") or "").strip(),
                _list("offers"), _list("hooks"), _list("ctas")]):
        raise ValueError(
            "Could not read enough from this competitor to analyse. The site may block "
            "automated readers - try their full URL, or set TAVILY_API_KEY so search "
            "results can be used as a second source.")

    return {
        "competitor": competitor,
        "site_url": site_url,
        "positioning": str(data.get("positioning") or ""),
        "audience": str(data.get("audience") or ""),
        "tone": str(data.get("tone") or ""),
        "offers": _list("offers"),
        "hooks": _list("hooks"),
        "ctas": _list("ctas"),
        "notes": str(data.get("notes") or ""),
        "sources": sources,
    }
