import asyncio
import re
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END

# Assuming `manager` from core.websocket is used to broadcast logs
from core.websocket import manager, current_workspace_id
import os
import httpx
from core.providers.llm_providers import GeminiProvider
from core.providers.base import LLMProviderError
from core import browser_render

# --- Schema Definitions ---

class OnboardingState(TypedDict):
    workspace_id: int
    brand_url: str
    brand_logo: Optional[str]
    guidelines_url: Optional[str]
    # Intermediate state
    scraped_content: str
    scraped_pages: List[dict]   # up to 5 crawled pages: [{"url": str, "content": str}]
    vision_insights: dict
    screenshot: Optional[bytes]   # headless-browser JPEG, fed to the vision pass
    # Final structured outputs for DB
    typography: dict
    color_palette: list
    brand_kit: dict        # core.brand_kit.BrandKit as a dict - USPs, mission, personas...
    brand_facts: dict      # founded year / published rating, when the site states them
    brand_guidelines_summary: str
    target_audience: str
    logs: List[str]
    status: str

# --- Node Definitions ---

def _html_to_text(html: str) -> str:
    """Crude but dependency-free HTML -> text: drop scripts/styles/tags, collapse whitespace."""
    import re
    html = re.sub(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    # Decode the handful of entities that matter for prose
    for ent, ch in [("&amp;", "&"), ("&nbsp;", " "), ("&quot;", '"'), ("&#39;", "'"), ("&lt;", "<"), ("&gt;", ">")]:
        html = html.replace(ent, ch)
    return re.sub(r"\s+", " ", html).strip()


# Shallow crawl config: homepage + up to (MAX-1) same-domain pages.
_MAX_KB_PAGES = 5
_PER_PAGE_CHARS = 3000
_UA = "Mozilla/5.0 (compatible; RaftraBot/1.0)"

# A page has to be worth embedding. Error bodies are the trap: a crawler that renders
# JavaScript returns the site's 404 page as ordinary content, and once embedded a stub
# like "Not Found" scores against every query and crowds real brand content out of the
# top-k results. It also lands in scraped_content, so the LLM synthesizes the brand
# profile partly from error text.
_MIN_PAGE_WORDS = 20

_ERROR_PAGE_OPENER_RE = re.compile(
    r"^\s*(?:error\s*)?(?:\d{3}\b\s*[-:|]?\s*)?"
    r"(not found|page not found|forbidden|unauthorized|access denied|bad request|"
    r"internal server error|service unavailable|gateway time-?out|too many requests)",
    re.I,
)


def _is_useful_page(text: str) -> bool:
    """True if `text` looks like real page content rather than an error or empty shell."""
    stripped = _html_to_text(text or "")
    words = stripped.split()
    if len(words) < _MIN_PAGE_WORDS:
        return False
    # Wordier error pages ("404 - Page Not Found. The page you requested...") clear the
    # word count, so also reject anything that *opens* with an error phrase and is short
    # enough that it can't plausibly be real content too.
    if len(words) < 60 and _ERROR_PAGE_OPENER_RE.match(stripped):
        return False
    return True


def _extract_internal_links(html: str, base_url: str, limit: int) -> list:
    """Same-domain content links found on the page — used for a shallow crawl."""
    import re, urllib.parse
    base_host = (urllib.parse.urlparse(base_url).netloc or "").lower().replace("www.", "")
    base_norm = base_url.rstrip("/")
    seen, out = set(), []
    for m in re.finditer(r'href=["\']([^"\']+)["\']', html or "", re.I):
        href = m.group(1).strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absu = urllib.parse.urljoin(base_url, href)
        pu = urllib.parse.urlparse(absu)
        if pu.scheme not in ("http", "https"):
            continue
        if (pu.netloc or "").lower().replace("www.", "") != base_host:
            continue
        clean = pu._replace(fragment="").geturl()
        if clean.rstrip("/") == base_norm or clean in seen:
            continue
        if re.search(r"\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|css|js|mp4|woff2?)(\?|$)", clean, re.I):
            continue
        seen.add(clean)
        out.append(clean)
        if len(out) >= limit:
            break
    return out


async def _firecrawl_crawl(client, url: str, limit: int, key: str) -> list:
    """Crawl a site via Firecrawl's /v1/crawl endpoint — renders JavaScript (works on SPAs)
    and returns up to `limit` pages in one job. Returns [{'url','content'}]; [] on any failure
    so the caller can fall back to the direct link-crawl."""
    headers = {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    try:
        start = await client.post(
            "https://api.firecrawl.dev/v1/crawl",
            headers=headers,
            json={"url": url, "limit": limit, "scrapeOptions": {"formats": ["markdown"]}},
        )
        if start.status_code not in (200, 201):
            print(f"Firecrawl crawl start failed: {start.status_code} {start.text[:150]}")
            return []
        j = start.json()
        crawl_id = j.get("id") or (j["url"].rstrip("/").split("/")[-1] if j.get("url") else None)
        if not crawl_id:
            return []
        # Crawl is async on Firecrawl's side — poll until it finishes (bounded).
        for _ in range(20):  # ~ up to 80s
            await asyncio.sleep(4)
            poll = await client.get(f"https://api.firecrawl.dev/v1/crawl/{crawl_id}",
                                    headers={"Authorization": f"Bearer {key}"})
            if poll.status_code != 200:
                continue
            pj = poll.json()
            status = pj.get("status")
            if status == "completed":
                out = []
                # Scan the whole result set rather than the first `limit` entries: if the
                # crawl surfaced error pages early, we still want `limit` good ones.
                for d in (pj.get("data") or []):
                    md = (d.get("markdown") or "").strip()
                    meta = d.get("metadata") or {}
                    src = meta.get("sourceURL") or meta.get("url") or url
                    # Firecrawl passes the origin's status through, and returns a 404 body
                    # as markdown just as happily as a real page — so check both.
                    status = meta.get("statusCode")
                    if status not in (None, 200, "200"):
                        print(f"Firecrawl: skipping {src} (HTTP {status})")
                        continue
                    if not _is_useful_page(md):
                        print(f"Firecrawl: skipping {src} (error page or near-empty)")
                        continue
                    out.append({"url": src, "content": md[:_PER_PAGE_CHARS]})
                    if len(out) >= limit:
                        break
                return out
            if status in ("failed", "cancelled"):
                print(f"Firecrawl crawl {status}")
                return []
        print("Firecrawl crawl did not finish in time; falling back to direct crawl.")
        return []
    except Exception as e:
        print(f"Firecrawl crawl error: {e}")
        return []


async def brand_intelligence_node(state: OnboardingState) -> OnboardingState:
    """
    Scrapes the brand URL. Prefers Firecrawl (clean markdown) when a key is set,
    otherwise falls back to fetching the page directly and extracting its text —
    so onboarding produces real brand content even with no external API keys.
    """
    msg = f"Initiating Brand Intelligence Agent for {state['brand_url']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Brand Intelligence", msg, "running")

    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    tavily_key = os.getenv("TAVILY_API_KEY")

    raw_url = (state.get("brand_url") or "").strip()
    url = raw_url if raw_url.startswith(("http://", "https://")) else ("https://" + raw_url if raw_url else "")

    async def _fetch_text(client, target: str, want_html: bool = False):
        """Return (text, html). Firecrawl markdown when a key is set, else a direct fetch."""
        html = ""
        text = ""
        if want_html or not firecrawl_key:
            try:
                r = await client.get(target)
                if r.status_code == 200:
                    html = r.text
                    text = _html_to_text(html)
            except Exception as e:
                print(f"Direct fetch failed for {target}: {e}")
        if firecrawl_key:
            try:
                fr = await client.post(
                    "https://api.firecrawl.dev/v1/scrape",
                    headers={"Authorization": f"Bearer {firecrawl_key}", "Content-Type": "application/json"},
                    json={"url": target, "formats": ["markdown"]},
                )
                if fr.status_code == 200:
                    md = fr.json().get("data", {}).get("markdown", "")
                    if md:
                        text = md  # prefer clean markdown for the stored content
            except Exception as e:
                print(f"Firecrawl scrape failed for {target}: {e}")
        return text, html

    pages: List[dict] = []
    if url:
        async with httpx.AsyncClient(follow_redirects=True, timeout=30, headers={"User-Agent": _UA}) as client:
            # 1) Preferred: Firecrawl crawl — renders JavaScript (handles SPAs) and returns
            #    up to _MAX_KB_PAGES pages in one job.
            if firecrawl_key:
                await manager.broadcast_agent_log("Brand Intelligence", f"Crawling {url} via Firecrawl (up to {_MAX_KB_PAGES} pages, JS-rendered)...", "thinking")
                pages = await _firecrawl_crawl(client, url, _MAX_KB_PAGES, firecrawl_key)
                if pages:
                    await manager.broadcast_agent_log("Brand Intelligence", f"Firecrawl returned {len(pages)} page(s).", "thinking")

            # 2) Fallback (no key, or Firecrawl returned nothing): fetch the homepage HTML and
            #    follow up to (MAX-1) same-domain links directly (no JS rendering).
            if not pages:
                await manager.broadcast_agent_log("Brand Intelligence", f"Scraping {url} directly...", "thinking")
                home_text, home_html = await _fetch_text(client, url, want_html=True)
                if home_text:
                    pages.append({"url": url, "content": home_text[:_PER_PAGE_CHARS]})
                links = _extract_internal_links(home_html, url, _MAX_KB_PAGES - 1)
                if links:
                    await manager.broadcast_agent_log("Brand Intelligence", f"Crawling {len(links)} more page(s) on the site...", "thinking")
                for link in links:
                    page_text, _ = await _fetch_text(client, link)
                    if page_text and len(page_text.split()) > 20:  # skip near-empty pages
                        pages.append({"url": link, "content": page_text[:_PER_PAGE_CHARS]})

            # 3) Optional external search context (Tavily) as one extra entry.
            if tavily_key:
                await manager.broadcast_agent_log("Brand Intelligence", "Adding competitor/search context via Tavily...", "thinking")
                try:
                    tv = await client.post(
                        "https://api.tavily.com/search",
                        json={"api_key": tavily_key, "query": f"Brand information and competitors for {url}"},
                    )
                    if tv.status_code == 200:
                        results = "\n".join([r.get("content", "") for r in tv.json().get("results", [])])
                        if results.strip():
                            pages.append({"url": "web-search:tavily", "content": results[:2000]})
                except Exception:
                    pass

    if not pages:
        await manager.broadcast_agent_log("Brand Intelligence", "Could not extract any content from the brand URL - the knowledge base will be limited for this workspace.", "failed")
        state["scraped_pages"] = []
        state["scraped_content"] = "No content extracted."
        return state

    await manager.broadcast_agent_log("Brand Intelligence", f"Extracted {len(pages)} page(s) into the knowledge base.", "completed")
    state["scraped_pages"] = pages
    # Aggregate for the LLM synthesis step (it reads scraped_content).
    state["scraped_content"] = "\n\n".join(f"[{p['url']}]\n{p['content']}" for p in pages)[:8000]
    return state

# Font stacks every site declares, which say nothing about the brand.
_GENERIC_FONTS = {"inherit", "initial", "unset", "sans-serif", "serif", "monospace",
                  "system-ui", "-apple-system", "blinkmacsystemfont", "segoe ui",
                  "helvetica", "helvetica neue", "arial", "roboto", "ui-sans-serif",
                  "ui-serif", "ui-monospace", "cursive", "fantasy", "emoji", "math"}


def _is_brand_colour(hex_code: str) -> bool:
    """True for colours with enough saturation to be a choice rather than a neutral.

    Replaces a hand-written blocklist, which caught #ffffff and #cccccc but happily passed
    #f2f2f2 and #7b7b7b through as brand colours.
    """
    import colorsys
    try:
        r, g, b = (int(hex_code[i:i + 2], 16) / 255 for i in (1, 3, 5))
    except ValueError:
        return False
    _, lightness, saturation = colorsys.rgb_to_hls(r, g, b)
    # Near-grey, or so light/dark that the hue is invisible.
    return saturation >= 0.2 and 0.08 <= lightness <= 0.92


def _extract_palette(html: str, limit: int = 5) -> list:
    """Brand colours from the page's own CSS, most-used first.

    Deliberately not a vision model: the hex codes a site actually ships are a better source
    than guessing at a screenshot, and this needs no extra API.
    """
    import re as _re
    from collections import Counter

    counts = Counter()
    for h in _re.findall(r"#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b", html or ""):
        h = h.lower()
        # Expand #abc to #aabbcc so the two spellings count as one colour.
        if len(h) == 4:
            h = "#" + "".join(ch * 2 for ch in h[1:])
        if _is_brand_colour(h):
            counts[h] += 1

    # A colour used once is usually incidental - a stray icon fill or one inline style.
    return [h for h, n in counts.most_common(limit) if n >= 2]


def _extract_typography(html: str) -> dict:
    """Heading and body fonts, from Google Fonts links first and font-family rules after."""
    import re as _re

    named = []
    for href in _re.findall(r'href="([^"]*fonts\.googleapis\.com[^"]*)"', html or "", _re.I):
        for fam in _re.findall(r"family=([^&:\"]+)", href):
            named.append(fam.replace("+", " ").split(",")[0].strip())

    for decl in _re.findall(r"font-family\s*:\s*([^;}\"']+)", html or "", _re.I):
        for part in decl.split(","):
            name = part.strip().strip("'\"")
            if name and name.lower() not in _GENERIC_FONTS and len(name) < 40 \
                    and not name.startswith("var(") and not name.startswith("--"):
                named.append(name)
                break

    seen, ordered = set(), []
    for n in named:
        if n.lower() not in seen:
            seen.add(n.lower())
            ordered.append(n)

    if not ordered:
        return {}
    out = {"heading": ordered[0]}
    if len(ordered) > 1:
        out["body"] = ordered[1]
    return out


def _extract_founded(text: str, html: str = "", brand_name: str = "") -> str:
    """The year the brand says it started, or "" when the site does not say.

    Deliberately strict. An earlier version accepted any "since YYYY" and picked up 2018
    from a customer review on stuffcool.com - "has been my go-to place ... since 2018" -
    which would have been stored as the company's founding year and shown in the header.
    """
    import re as _re
    from datetime import datetime as _dt

    this_year = _dt.utcnow().year
    # Liquid/Handlebars blocks are template source, not statements the brand is making.
    blob = _re.sub(r"\{\{.*?\}\}|\{%.*?%\}", " ", f"{text} {html}", flags=_re.S)

    def _ok(year_str: str) -> bool:
        try:
            year = int(year_str)
        except ValueError:
            return False
        return 1800 <= year <= this_year

    # 1) An explicit claim about a company. Reviewers do not write these about themselves.
    for m in _re.finditer(r"(?:established|founded|incorporated)(?:\s+in)?\s*[:\-]?\s*((?:19|20)\d{2})",
                          blob, _re.I):
        if _ok(m.group(1)):
            return m.group(1)

    # 2) "<Brand>, since YYYY" - the brand's own name immediately in front is what separates
    #    a company claim from a customer's anecdote.
    if brand_name:
        near = _re.escape(brand_name.strip())
        for pat in (rf"{near}[^.]{{0,30}}?\b(?:since|est\.?)\s*[:\-]?\s*((?:19|20)\d{{2}})",
                    rf"\b(?:since|est\.?)\s*((?:19|20)\d{{2}})[^.]{{0,20}}?{near}"):
            m = _re.search(pat, blob, _re.I)
            if m and _ok(m.group(1)):
                return m.group(1)

    # 3) "(c) 2015-2026" - the first year of a range is the founding claim. A lone copyright
    #    year is skipped: it tracks the current year and says nothing about when they began.
    m = _re.search(r"(?:©|&copy;|copyright)\s*\D{0,20}((?:19|20)\d{2})\s*[-–—]\s*(?:19|20)\d{2}",
                   blob, _re.I)
    if m and _ok(m.group(1)):
        return m.group(1)

    return ""


def _extract_rating(text: str, html: str = "") -> dict:
    """A published customer rating: {"value", "count", "scale"}, or {} when absent."""
    import json as _json
    import re as _re

    # 1) schema.org aggregateRating, in JSON-LD or microdata. This is the number the brand
    #    publishes for search engines, so it is the one they stand behind.
    for block in _re.findall(r"<script[^>]+application/ld\+json[^>]*>(.*?)</script>", html or "",
                             _re.S | _re.I):
        try:
            data = _json.loads(block.strip())
        except Exception:
            continue

        stack = [data]
        while stack:
            node = stack.pop()
            if isinstance(node, list):
                stack.extend(node)
                continue
            if not isinstance(node, dict):
                continue
            agg = node.get("aggregateRating")
            if isinstance(agg, dict) and agg.get("ratingValue"):
                try:
                    value = float(str(agg["ratingValue"]).replace(",", "."))
                except (TypeError, ValueError):
                    continue
                best = float(str(agg.get("bestRating") or 5).replace(",", ".") or 5)
                if 0 < value <= best:
                    count = agg.get("ratingCount") or agg.get("reviewCount")
                    return {"value": round(value, 1),
                            "count": int(count) if str(count or "").isdigit() else None,
                            "scale": int(best)}
            stack.extend(v for v in node.values() if isinstance(v, (dict, list)))

    # 2) A visible "4.8 out of 5" / "4.8/5" / "4.8 stars".
    #
    # Two traps, both found by running this against real storefronts:
    #   * Shopify themes ship unrendered Liquid - "{{ ...all_reviews_rating | round: 1 }}
    #     out of 5 stars" - and the 5 in "out of 5 stars" was read as the rating. Template
    #     blocks are stripped before matching.
    #   * A whole number is rejected. "5 stars" is a widget label or a filter option; a
    #     published aggregate is 4.8, and requiring the decimal drops the false positives
    #     without losing real ratings.
    cleaned = _re.sub(r"\{\{.*?\}\}|\{%.*?%\}", " ", text or "", flags=_re.S)
    m = _re.search(r"(?<!out of )(?<!/)\b([0-5][.,]\d)\s*(?:/\s*5|out of\s*5|stars?\b|★)",
                   cleaned, _re.I)
    if m:
        try:
            value = float(m.group(1).replace(",", "."))
        except ValueError:
            return {}
        if 0 < value <= 5:
            return {"value": round(value, 1), "count": None, "scale": 5}

    return {}


async def _style_source(client, url: str, max_sheets: int = 3):
    """The homepage HTML, and that HTML plus its first few stylesheets concatenated.

    Single-page apps - which most modern sites are - ship a homepage with no colours in it
    at all; everything is in a linked bundle. Reading the HTML alone returned nothing for
    two of the three sites this was tested against.

    Returns (html, combined). The homepage is handed back separately because logos live in
    the markup: searching the concatenated bundle for <img class="logo"> would trawl
    megabytes of CSS for tags that can only be in the HTML.
    """
    import re as _re
    from urllib.parse import urljoin

    try:
        r = await client.get(url)
        if r.status_code != 200:
            return "", ""
        html = r.text
    except Exception as e:
        print(f"Style fetch failed for {url}: {e}")
        return "", ""

    parts = [html]
    hrefs = _re.findall(r'<link[^>]+rel=["\']?stylesheet["\']?[^>]*>', html, _re.I)
    sheets = []
    for tag in hrefs:
        m = _re.search(r'href=["\']([^"\']+)["\']', tag, _re.I)
        if m:
            sheets.append(urljoin(url, m.group(1)))

    for href in sheets[:max_sheets]:
        try:
            sr = await client.get(href)
            if sr.status_code == 200:
                # Capped: bundles run to megabytes and the palette is near the top.
                parts.append(sr.text[:400000])
        except Exception:
            continue

    return html, "\n".join(parts)


async def vision_analysis_node(state: OnboardingState) -> OnboardingState:
    """Read the brand's colours and fonts out of its own homepage.

    This announced "Initiating Vision Analysis on Brand Assets", slept a second, and
    returned #030303 / #5A52FF / Outfit / Inter - the same four values for every brand,
    with a TODO where the vision call was meant to be. Those constants were then written to
    brand_profiles and read by the creative agents as though they were the brand's.
    """
    msg = "Reading brand colours, typography and logos from the site..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Brand Style", msg, "running")

    url = state.get("brand_url") or state.get("company_url") or ""
    palette, typography, colour_tokens, logos = [], {}, [], []
    source = ""

    if url:
        try:
            from core.brand_kit import (extract_color_tokens, extract_typography as _kit_type,
                                        extract_logos, hero_color_tokens)
            async with httpx.AsyncClient(follow_redirects=True, timeout=25,
                                         headers={"User-Agent": _UA}) as client:
                home_html, source = await _style_source(client, url)
                if source:
                    # Named CSS variables first, frequency second - see core/brand_kit.
                    colour_tokens = extract_color_tokens(source)
                    typography = _kit_type(source)
                if home_html:
                    logos = extract_logos(home_html, url)
                    # Then the colours that exist only as pixels. A brand's most
                    # recognisable colour is often the grade of its hero photograph or the
                    # finish of a product render, and never appears as a hex in any
                    # stylesheet - the CSS pass above is structurally unable to see those.
                    # Declared tokens still rank first: they carry a stated role, while a
                    # clustered colour is an average of a photograph.
                    try:
                        hero = await hero_color_tokens(client, home_html, url)
                        known = {t["hex"] for t in colour_tokens}
                        colour_tokens += [h for h in hero if h["hex"] not in known]
                        if hero:
                            await manager.broadcast_agent_log(
                                "Brand Style",
                                f"Clustered {len(hero)} colour(s) out of the hero imagery.",
                                "thinking")
                    except Exception as img_err:
                        # Optional enrichment: a slow CDN must not cost us the CSS tokens.
                        print(f"Hero image clustering failed for {url}: {img_err}")
                palette = [t["hex"] for t in colour_tokens]
        except Exception as e:
            print(f"Style extraction failed for {url}: {e}")

    # Headless render, LAST and entirely optional. Everything above already produced a
    # usable kit from shipped CSS and imagery; this only adds what a browser knows and a
    # text fetch cannot - which var() a theme actually resolved to, which of six shipped
    # faces is really used, what the CTA is painted, and a screenshot for the vision pass.
    #
    # Ordered last and wrapped so that a missing Playwright, an uninstalled Chromium or a
    # page that will not render changes nothing about the result. Computed values are
    # PREPENDED when found: the browser's answer outranks a guess from source.
    if url and browser_render.is_available():
        try:
            await manager.broadcast_agent_log(
                "Brand Style", "Rendering the page in a headless browser for computed styles...",
                "thinking")
            rendered = await browser_render.render(url, screenshot=True)
            if rendered.get("error"):
                print(f"[onboarding] browser render note for {url}: {rendered['error']}")

            computed = rendered.get("computed") or {}
            if computed:
                computed_tokens = browser_render.computed_color_tokens(computed)
                if computed_tokens:
                    known = {t["hex"] for t in computed_tokens}
                    colour_tokens = computed_tokens + [t for t in colour_tokens
                                                       if t["hex"] not in known]
                    palette = [t["hex"] for t in colour_tokens]
                computed_fonts = browser_render.computed_typography(computed)
                if computed_fonts:
                    typography = computed_fonts
                await manager.broadcast_agent_log(
                    "Brand Style",
                    f"Browser reported {len(computed_tokens)} computed colour(s)"
                    + (f" and {', '.join(computed_fonts.values())}" if computed_fonts else ""),
                    "thinking")

            # Held in state for the vision pass in synthesis; never persisted as-is.
            if rendered.get("screenshot"):
                state["screenshot"] = rendered["screenshot"]
        except Exception as e:
            print(f"[onboarding] headless render skipped for {url}: {e}")

    # Both fall back to the original readers if the token pass found nothing, so a site
    # that ships neither CSS variables nor a Google Fonts link is no worse off than before.
    if not palette and source:
        palette = _extract_palette(source)
    if not typography and source:
        typography = _extract_typography(source)

    # The same fetched source yields two facts the brand publishes about itself.
    founded, rating = "", {}
    if source:
        import re as _re2
        plain = _re2.sub(r"\s+", " ", _re2.sub(r"(?s)<[^>]+>", " ", source))
        founded = _extract_founded(plain, source, brand_name=state.get("brand_name") or "")
        rating = _extract_rating(plain, source)

    state["vision_insights"] = {"palette": palette, "typography": typography,
                                "colour_tokens": colour_tokens, "logos": logos,
                                "founded": founded, "rating": rating}

    if palette or typography or logos:
        found = []
        if palette:
            found.append(f"{len(palette)} colour(s)")
        if typography:
            found.append(", ".join(typography.values()))
        if logos:
            found.append(f"{len(logos)} logo asset(s)")
        await manager.broadcast_agent_log("Brand Style", f"Found {' and '.join(found)}.", "completed")
    else:
        # Said plainly, because the Brand Knowledge vault will show these as missing and the
        # user needs to know it is because nothing was detected, not because it broke.
        await manager.broadcast_agent_log(
            "Brand Style",
            "No brand colours or fonts could be read from the site. You can set them by hand "
            "in Brand Knowledge.", "completed")

    return state

async def synthesis_and_persistence_node(state: OnboardingState) -> OnboardingState:
    """
    Synthesizes the scraped data using LLM and saves to Postgres & Qdrant.
    """
    msg = "Synthesizing brand profile and caching to PostgreSQL and Qdrant..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("System", msg, "running")
    
    # Gemini: the only provider with a configured key (OPENROUTER_API_KEY is empty).
    llm = GeminiProvider()

    # One structured pass over the crawl, validated against core.brand_kit.BrandKit, rather
    # than the two loose fields this used to ask for. The Brand Knowledge screen has always
    # had panels for USPs, mission, personality, positioning and tone; nothing filled them,
    # so every brand's vault showed one paragraph and seven empty sections. The schema lets
    # a field come back empty, which is what keeps a thin site from producing a fabricated
    # mission statement just to fill the panel.
    from core.brand_kit import (extract_brand_kit, extract_brand_kit_with_vision,
                                kit_to_guidelines, BrandKit)

    kit = BrandKit()
    # When the headless render produced a screenshot, the extractor also LOOKS at the page.
    # Personality, tone and whether the brand reads premium or value are visible in the
    # design and absent from the markup; the prompt is explicit that facts still come from
    # the copy, so the image informs judgement without being able to invent a warranty.
    # extract_brand_kit_with_vision degrades to the text path on its own when there is no
    # screenshot or the provider has no vision method.
    shot = state.get("screenshot")
    try:
        if shot:
            await manager.broadcast_agent_log(
                "Brand Strategist", "Reading the page copy and its rendered design...", "thinking")
            kit = await extract_brand_kit_with_vision(llm, state["scraped_content"], shot)
        else:
            kit = await extract_brand_kit(llm, state["scraped_content"])
    except LLMProviderError as e:
        # A fabricated brand summary would be embedded into the knowledge base and
        # silently poison every downstream agent, so fail instead.
        await manager.broadcast_agent_log("Brand Strategist", f"Brand analysis failed: {e}", "failed")
        raise
    except ValueError as e:
        # The model answered but not in the agreed shape. Degrade to the overview-only path
        # instead of failing onboarding outright: colours, fonts, logos and the knowledge
        # base are all still worth persisting.
        await manager.broadcast_agent_log(
            "Brand Strategist", f"Structured extraction did not validate ({e}); keeping the summary only.",
            "thinking")
        try:
            raw = await llm.generate_text(
                "In 3 sentences, describe this brand's tone, positioning and value "
                "propositions, then a final sentence naming who it sells to.\n\n"
                + state["scraped_content"],
                system_prompt="You are a brand strategist.")
            kit = BrandKit(overview=(raw or "").strip())
        except LLMProviderError:
            raise

    summary = kit.overview or ""
    audience = kit.audience_summary or ""
    state["brand_kit"] = kit.model_dump()

    insights = state.get("vision_insights", {}) or {}
    # Stored under guidelines so the hero can show "Est. 2019" and a rating when the site
    # publishes them, and show neither when it does not.
    facts = {}
    if insights.get("founded"):
        facts["founded"] = insights["founded"]
    if insights.get("rating"):
        facts["rating"] = insights["rating"]
    state["brand_facts"] = facts
    # Empty rather than defaulted: Brand Knowledge shows these as missing and offers an edit,
    # which is more useful than every workspace sharing one palette and one font.
    state["typography"] = insights.get("typography") or {}
    state["color_palette"] = insights.get("palette") or []
    state["brand_guidelines_summary"] = summary
    state["target_audience"] = audience
    state["status"] = "completed"
    
    # Save to PostgreSQL
    from database import SessionLocal
    from models import Workspace, BrandProfile
    
    db = SessionLocal()
    try:
        ws = db.query(Workspace).filter(Workspace.id == state["workspace_id"]).first()
        if ws:
            ws.brand_voice = summary
            # The workspace's own accent, used by headers and chips that never load the full
            # brand profile. Only set when the crawl found one and the user has not chosen.
            if not (ws.brand_color or "").strip() and state["color_palette"]:
                ws.brand_color = state["color_palette"][0]
            if not (ws.brand_logo or "").strip():
                first_logo = next((l.get("url") for l in (insights.get("logos") or [])
                                   if l.get("url")), None)
                if first_logo:
                    ws.brand_logo = first_logo
            bp = db.query(BrandProfile).filter(BrandProfile.workspace_id == state["workspace_id"]).first()
            if not bp:
                bp = BrandProfile(workspace_id=state["workspace_id"])
                db.add(bp)
            bp.typography = state["typography"]
            bp.color_palette = state["color_palette"]
            bp.color_tokens = insights.get("colour_tokens") or []
            bp.logos = insights.get("logos") or []
            # Merged, not replaced: everything else under guidelines is user-written and a
            # re-crawl must not wipe it. kit_to_guidelines omits its own empty fields, so a
            # thinner second crawl cannot blank out what a richer first one found - or what
            # a user typed by hand.
            existing = dict(bp.guidelines or {})
            existing.update(kit_to_guidelines(kit))
            existing.update(state.get("brand_facts") or {})
            bp.guidelines = existing
            bp.brand_guidelines_summary = summary
            bp.target_audience = state["target_audience"]
            bp.is_onboarded = True
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"PostgreSQL persist error: {e}")
    finally:
        db.close()
        
    # Persist the brand context to the knowledge base so generation can retrieve it.
    try:
        from database import qdrant_client
        from qdrant_client.models import PointStruct
        from core.embeddings import embed_passage, ensure_collection, COLLECTION_NAME
        import uuid

        ensure_collection(qdrant_client)

        content_to_embed = state.get("scraped_content", "")
        # Fallback to empty string if no content is scraped to avoid crash
        if not content_to_embed:
            content_to_embed = "Empty workspace context"

        # Re-indexing should REPLACE this workspace's knowledge, not pile new points on
        # top of stale ones (otherwise old "No content extracted" placeholders linger).
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        try:
            qdrant_client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=Filter(must=[FieldCondition(key="workspace_id", match=MatchValue(value=state["workspace_id"]))]),
            )
        except Exception as del_err:
            print(f"Qdrant cleanup (non-fatal): {del_err}")

        # Store one vector PER crawled page (better retrieval than one giant blob).
        crawled = [p for p in (state.get("scraped_pages") or []) if (p.get("content") or "").strip()]
        if crawled:
            points = [
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embed_passage(p["content"]),
                    payload={"workspace_id": state["workspace_id"], "content": p["content"],
                             "type": "onboarding_scrape", "source_url": p.get("url", "")},
                )
                for p in crawled
            ]
        else:
            points = [PointStruct(
                id=str(uuid.uuid4()),
                vector=embed_passage(content_to_embed),
                payload={"workspace_id": state["workspace_id"], "content": content_to_embed, "type": "onboarding_scrape"},
            )]
        qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
    except Exception as e:
        # Previously this only printed, so onboarding reported success while the
        # knowledge base stayed empty - and every later generation had no context.
        print(f"Qdrant persist error: {e}")
        await manager.broadcast_agent_log("System", f"Brand onboarding failed: could not save knowledge base ({e})", "failed")
        raise

    await manager.broadcast_agent_log("System", "Brand Onboarding Complete. Profile Cached.", "completed")
    return state

# --- Graph Compilation ---

workflow = StateGraph(OnboardingState)

workflow.add_node("brand_intelligence", brand_intelligence_node)
workflow.add_node("vision_analysis", vision_analysis_node)
workflow.add_node("synthesis_and_persistence", synthesis_and_persistence_node)

workflow.set_entry_point("brand_intelligence")
workflow.add_edge("brand_intelligence", "vision_analysis")
workflow.add_edge("vision_analysis", "synthesis_and_persistence")
workflow.add_edge("synthesis_and_persistence", END)

onboarding_graph = workflow.compile()

async def run_onboarding_pipeline(workspace_id: int, brand_url: str, brand_logo: str = None):
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
    initial_state = {
        "workspace_id": workspace_id,
        "brand_url": brand_url,
        "brand_logo": brand_logo,
        "guidelines_url": None,
        "scraped_content": "",
        "scraped_pages": [],
        "vision_insights": {},
        "typography": {},
        "color_palette": [],
        "brand_guidelines_summary": "",
        "target_audience": "",
        "logs": [],
        "status": "queued"
    }
    from core.agent_status import record_agent_task
    record_agent_task(workspace_id, "ONBOARDING", "RUNNING", f"Analyzing {brand_url}")
    try:
        result = await onboarding_graph.ainvoke(initial_state)
        record_agent_task(workspace_id, "ONBOARDING", "COMPLETED", "Brand profile & knowledge base built")
        return result
    except Exception as e:
        record_agent_task(workspace_id, "ONBOARDING", "FAILED", str(e)[:120])
        raise
