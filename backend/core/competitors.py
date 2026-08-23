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


async def analyze_competitor(competitor: str) -> dict:
    """Research one competitor. Raises ValueError when nothing readable could be found, so
    the caller can report that plainly instead of returning an empty shell."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=_TIMEOUT,
                                 headers={"User-Agent": _UA}) as client:
        site_url = await _resolve_site(client, competitor)
        page_text = await _read_site(client, site_url) if site_url else ""
        results = await _search_context(client, competitor)

    search_text = "\n\n".join(
        f"[{r.get('url')}]\n{(r.get('content') or '')[:900]}" for r in results if r.get("content")
    )
    if not page_text and not search_text:
        # Without TAVILY_API_KEY a bare brand name cannot be resolved to a site at all, so
        # say which input actually works rather than leaving the user guessing.
        hint = ("Enter the full website address (example.com) — "
                "brand-name lookup needs TAVILY_API_KEY, which is not set."
                if not os.getenv("TAVILY_API_KEY")
                else "Try the full website address.")
        raise ValueError(f"Nothing readable was found for '{competitor}'. {hint}")

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
