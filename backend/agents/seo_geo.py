import asyncio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
import os
from core.websocket import manager, current_workspace_id
from core.providers.llm_providers import GeminiProvider

class SEOState(TypedDict):
    workspace_id: int
    target_url: str
    logs: List[str]
    current_node: str
    status: str
    audit_score: int
    crawl_error: str
    site_signals: dict
    audit: dict

    crawl_data: dict
    keyword_clusters: dict
    content_gaps: list
    internal_links: list
    backlink_strategy: dict
    schema_markup: dict
    report: str
    content_metrics: dict

    # Findings from the nodes that now measure something. These MUST be declared here: a
    # LangGraph state is a TypedDict and only declared keys survive a node returning — a node
    # can set state["geo_citations"], read it back within its own body, and have it silently
    # dropped from the result the graph hands back. That is exactly what happened on the first
    # end-to-end run: every probe logged a correct finding and the persisted audit got none of
    # them, because the keys were not declared here.
    connections: dict           # gathered Search Console / GA4 / site-connector data
    brand: str                  # brand voice, audience and KB excerpts, gathered once per run
    ga4: dict
    index_status: dict          # Google's own verdict on the audited URL
    content_signals: dict       # E-E-A-T + readability
    authority_signals: dict     # about / contact / docs / blog / profiles
    geo_citations: dict          # what an answer engine would cite
    geo_prompt_visibility: dict  # named in N of M buyer-intent answers
    geo_optimizations: dict      # paste-ready copy written against the findings


# Real node-name trails for the Running-state progress checklist. Must match the
# `current_node` values each node below actually sets.
SEO_STAGES = ["Crawler Agent", "Technical SEO Agent", "Keyword Agent", "Content Strategy Agent",
              "Internal Linking Agent", "Backlink Agent", "Schema Agent", "Publishing Agent", "Reporting Agent"]
GEO_STAGES = ["Entity Agent", "Citation Agent", "Prompt Visibility Agent", "LLM Ranking Agent",
              "Authority Agent", "Knowledge Graph Agent", "Optimization Agent", "Reporting"]


def normalize_target_url(raw: str) -> str:
    """Make a stored/typed site address safe to hand to Firecrawl and httpx.

    A URL can never legally contain raw whitespace, but the value reaching here comes
    from the workspace's company_url (typed at onboarding), so it can carry a stray
    space - e.g. " ambraneindia.com", which the frontend turns into
    "https:// ambraneindia.com". Firecrawl rejects that with HTTP 400 BAD_REQUEST, so
    the whole audit fails on what looks to the user like a live site. Strip every
    whitespace character rather than just the ends, then add the scheme if it's absent.
    """
    cleaned = "".join((raw or "").split())
    if not cleaned:
        return ""
    if not cleaned.lower().startswith(("http://", "https://")):
        cleaned = "https://" + cleaned
    return cleaned


def _seo_stage_done(state: "SEOState", node_label: str) -> None:
    from core.agent_status import record_agent_task
    record_agent_task(state["workspace_id"], "SEO", "RUNNING", stage=node_label)


def _geo_stage_done(state: "SEOState", node_label: str) -> None:
    from core.agent_status import record_agent_task
    record_agent_task(state["workspace_id"], "GEO", "RUNNING", stage=node_label)


import re as _re
from urllib.parse import urlparse as _urlparse

# Common words to ignore in keyword frequency analysis.
_SEO_STOP = set("""the a an and or but of to in on for with as at by from is are was were be been being this that these those it its
your you we our their his her they them he she i me my mine will would can could should may might must have has had do does did not
no yes if then than so such into over under about more most some any all each other which who whom whose what when where why how""".split())


def analyze_markdown(md: str, target_url: str) -> dict:
    """Compute REAL on-page SEO metrics from the crawled markdown (no LLM, no guessing)."""
    md = md or ""

    # Headings (markdown '#'..'######')
    h1 = len(_re.findall(r"(?m)^#\s+\S", md))
    h2 = len(_re.findall(r"(?m)^##\s+\S", md))
    h3plus = len(_re.findall(r"(?m)^#{3,}\s+\S", md))

    # Links: [text](href)   Images: ![alt](src)
    links = _re.findall(r"(?<!!)\[[^\]]*\]\(([^)]+)\)", md)
    images = _re.findall(r"!\[([^\]]*)\]\(([^)]+)\)", md)

    # For word/keyword analysis, keep only visible prose: drop image syntax, replace
    # [text](url) with just its anchor text, and strip bare URLs - so link targets like
    # 'https', 'onrender' don't pollute the keyword frequencies.
    text_only = _re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", md)
    text_only = _re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text_only)
    text_only = _re.sub(r"https?://\S+", " ", text_only)
    words = _re.findall(r"[a-zA-Z][a-zA-Z'-]{1,}", text_only)
    word_count = len(words)
    host = (_urlparse(target_url).netloc or "").lower().replace("www.", "")
    internal = [l for l in links if host and host in l.lower()] + [l for l in links if l.startswith("/") or l.startswith("#")]
    external = [l for l in links if l.startswith("http") and (not host or host not in l.lower())]
    images_missing_alt = sum(1 for alt, _src in images if not alt.strip())

    # Top keywords by frequency (excluding stop words)
    freq = {}
    for w in words:
        lw = w.lower()
        if len(lw) > 3 and lw not in _SEO_STOP:
            freq[lw] = freq.get(lw, 0) + 1
    top_keywords = sorted(freq.items(), key=lambda kv: kv[1], reverse=True)[:12]

    return {
        "word_count": word_count,
        "h1_count": h1,
        "h2_count": h2,
        "h3plus_count": h3plus,
        "internal_links": len(internal),
        "external_links": len(external),
        "image_count": len(images),
        "images_missing_alt": images_missing_alt,
        "top_keywords": [{"term": t, "count": c} for t, c in top_keywords],
        "thin_content": word_count < 300,
    }

# Sitemap locations to try when robots.txt does not declare one. /sitemap.xml alone is not
# enough: Shopify serves /sitemap.xml as 404 and publishes /sitemap_index.xml instead, which
# made the audit report "no sitemap" for sites that plainly had one.
_SITEMAP_CANDIDATES = ("/sitemap.xml", "/sitemap_index.xml", "/sitemap-index.xml",
                       "/sitemap1.xml", "/wp-sitemap.xml")


async def _discover_sitemap(client, origin: str, robots_body: str) -> dict:
    """Find the sitemap the way a crawler does: trust robots.txt's own `Sitemap:` line
    first (it is authoritative), then fall back to the conventional filenames."""
    declared = _re.findall(r"(?mi)^\s*Sitemap:\s*(\S+)", robots_body or "")
    for url in declared:
        try:
            r = await client.get(url)
            if r.status_code == 200 and r.text.strip():
                return {"found": True, "status": r.status_code, "url": url,
                        "source": "declared in robots.txt"}
        except Exception:
            continue
    for path in _SITEMAP_CANDIDATES:
        try:
            r = await client.get(origin + path)
            if r.status_code == 200 and r.text.strip():
                return {"found": True, "status": r.status_code, "url": origin + path,
                        "source": "conventional path"}
        except Exception:
            continue
    return {"found": False, "status": 404,
            "checked": list(declared) + [origin + p for p in _SITEMAP_CANDIDATES]}


# Text that means "this is not the real site yet" — a Shopify password gate, a holding page,
# or a parked domain. Auditing one of these produces a page full of genuine-looking but
# useless findings ("thin content, add an H1, add Organization schema") about a page the
# owner cannot edit, and a score that describes the placeholder rather than the business.
_GATE_MARKERS = (
    # Storefront / holding pages
    "store is password protected", "enter store using password", "opening soon",
    "are you the store owner", "this site is under construction", "coming soon",
    "domain is parked", "site temporarily unavailable",
    # Auth walls. The crawler is always logged OUT, so a private or unlaunched site serves
    # its LOGIN page — and that scores like any other page: thin content, no H1, no schema.
    # A WordPress.com site set to Private returned a full 30-something/100 describing the
    # sign-in screen, which is indistinguishable from a real audit unless we name it.
    "log in to wordpress.com", "login to wordpress.com", "this site is private",
    "private site", "you need to be logged in", "please log in to continue",
    "sign in to continue", "login required", "members only",
    # Host "nothing deployed here" pages, which answer 200 far more often than 404.
    "no deployment found", "site not found", "there isn't a github pages site here",
    "this page could not be found", "404 not found",
)


def detect_gate_page(final_url: str, html: str, text: str) -> dict:
    """Is the crawled page a placeholder rather than the real site?"""
    blob = f"{text or ''} {html or ''}".lower()
    hits = [m for m in _GATE_MARKERS if m in blob]
    path = (_urlparse(final_url or "").path or "").lower()
    if path.rstrip("/").endswith("/password") or path == "/password":
        hits.append("redirected to a /password gate")
    if not hits:
        return {"is_gate": False}
    return {
        "is_gate": True, "markers": hits, "final_url": final_url,
        "reason": ("The crawled URL is a placeholder/password-protected page, not the live "
                   "site. Findings from it describe the placeholder, not your content."),
    }


async def _fetch_site_signals(target_url: str) -> dict:
    """Measure site-level facts used by the audit (HTTPS, robots.txt, sitemap, redirects,
    indexability headers). Everything here is an observed HTTP result — never assumed."""
    import httpx
    from core.page_fetch import BROWSER_UA, robots_access
    p = _urlparse(target_url)
    origin = f"{p.scheme}://{p.netloc}"
    signals = {"https": p.scheme == "https", "origin": origin}
    # A browser User-Agent: several CDNs answer python-httpx with 403, which made robots.txt
    # and the sitemap look missing on sites that serve both.
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True,
                                 headers={"User-Agent": BROWSER_UA}) as client:
        robots_body = ""
        try:
            r = await client.get(origin + "/robots.txt")
            robots_body = r.text if r.status_code == 200 else ""
            entry = {"found": r.status_code == 200 and bool(robots_body.strip()),
                     "status": r.status_code}
            if robots_body:
                # Evaluated per user-agent. The regex this replaced set disallow_all for any
                # `Disallow: /` anywhere in the file, so a group scoped to GPTBot or Nutch was
                # reported as the whole site blocking search engines.
                access = robots_access(robots_body, target_url)
                entry["disallow_all"] = access["blocks_search"]
                entry["blocked_search_agents"] = access["blocked_search_agents"]
                entry["blocked_agents"] = access["blocked_agents"]
                entry["ai_crawlers"] = access["ai_crawlers"]
            entry["checked"] = True
            signals["robots_txt"] = entry
        except Exception as e:
            # `checked: False` rather than `found: False`. These are different facts and
            # scoring them the same is what made audits of one site swing by 20 points:
            # a timed-out fetch was reported as "robots.txt NOT found → 0/4" with a
            # recommendation to add one, on sites that already had a valid robots.txt.
            # Origins that sleep (Render/Heroku free tiers) fail this way constantly.
            signals["robots_txt"] = {"found": False, "checked": False,
                                     "status": None, "error": str(e)[:80]}

        try:
            sm = await _discover_sitemap(client, origin, robots_body)
            if isinstance(sm, dict):
                sm.setdefault("checked", True)
            signals["sitemap"] = sm
        except Exception as e:
            signals["sitemap"] = {"found": False, "checked": False,
                                  "status": None, "error": str(e)[:80]}

        # The audit previously credited "no redirect chain issues" without ever observing the
        # chain, and read only <meta name="robots"> — so an X-Robots-Tag: noindex served in
        # the HTTP headers was invisible.
        try:
            r = await client.get(target_url)
            signals["final_url"] = str(r.url)
            signals["redirect_count"] = len(r.history)
            signals["redirect_chain"] = [
                {"status": h.status_code, "from": str(h.url),
                 "to": h.headers.get("location")} for h in r.history]
            signals["x_robots_tag"] = r.headers.get("x-robots-tag")
        except Exception as e:
            signals["redirect_error"] = str(e)[:80]
    return signals


async def _firecrawl_scrape(target_url: str) -> tuple:
    """(page, None) from Firecrawl, or (None, reason). One retry — the API occasionally
    hiccups. rawHtml is requested because metadata, schema and accessibility facts do not
    survive the markdown conversion."""
    import httpx
    key = (os.getenv("FIRECRAWL_API_KEY") or "").strip()
    if not key:
        return None, "FIRECRAWL_API_KEY is not set"
    last_err = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(
                    "https://api.firecrawl.dev/v1/scrape",
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={"url": target_url, "formats": ["markdown", "rawHtml"]},
                )
            if res.status_code == 200:
                data = res.json().get("data", {}) or {}
                markdown = data.get("markdown", "") or ""
                if markdown.strip():
                    meta = data.get("metadata", {}) or {}
                    return {"markdown": markdown, "html": data.get("rawHtml") or data.get("html") or "",
                            "status_code": meta.get("statusCode"), "final_url": meta.get("sourceURL")}, None
                last_err = "empty content returned"
            else:
                last_err = f"HTTP {res.status_code}: {res.text[:150]}"
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
        if attempt == 0:
            await asyncio.sleep(2.0)
    return None, last_err


async def _crawl_page(target_url: str, agent_label: str) -> dict:
    """The one crawl both pipelines use: Firecrawl, then a direct fetch, then an honest failure.

    There used to be two copies of the Firecrawl call (this helper for GEO, an inline one in
    crawler_node for SEO) and neither had a fallback. With no key the SEO pipeline ran in
    "simulation" and the GEO pipeline carried on with an empty page, and both scored that
    empty page and saved it as a finished audit - SEO 8/100 and GEO 2/100, every category
    "verified" at zero. A plain fetch of the same URL almost always works, so it is tried
    before giving up, and when both fail `crawl_error` is set so the caller fails the run
    instead of persisting a score for a page nobody read.

    Never raises.
    """
    from core.page_fetch import clean_markdown, fetch_page, html_to_markdown
    from core.seo_scoring import html_is_scorable

    out = {"markdown": "", "html": "", "crawl_error": None, "site_signals": {},
           "source": None, "status_code": None, "final_url": None}

    await manager.broadcast_agent_log(agent_label, f"Crawling {target_url}...", "running")
    page, fc_err = await _firecrawl_scrape(target_url)
    if page:
        out.update(page)
        out["source"] = "Firecrawl"
    else:
        await manager.broadcast_agent_log(
            agent_label, f"Firecrawl unavailable ({fc_err}) — fetching the page directly instead.", "running")
        try:
            direct = await fetch_page(target_url)
            out["html"] = direct["html"]
            out["markdown"] = html_to_markdown(direct["html"], direct["final_url"])
            out["status_code"] = direct["status_code"]
            out["final_url"] = direct["final_url"]
            out["source"] = "Direct HTTP fetch (JavaScript not rendered)"
        except Exception as e:
            out["crawl_error"] = f"Firecrawl: {fc_err}; direct fetch: {str(e)[:120]}"

    if not out["crawl_error"] and not out["markdown"].strip() and not html_is_scorable(out["html"]):
        out["crawl_error"] = (f"Firecrawl: {fc_err or 'no content'}; direct fetch returned no "
                              f"readable content (the page may need JavaScript to render)")
    if out["crawl_error"]:
        await manager.broadcast_agent_log(agent_label, f"Crawl failed for {target_url}: {out['crawl_error']}", "failed")
        return out

    out["markdown"] = clean_markdown(out["markdown"])
    try:
        signals = await _fetch_site_signals(target_url)
        signals["status_code"] = out["status_code"]
        signals["crawl_source"] = out["source"]
        if fc_err:
            signals["firecrawl_error"] = fc_err
        # Detect a password gate / holding page before anything is scored.
        gate = detect_gate_page(signals.get("final_url") or out["final_url"] or target_url,
                                out["html"], out["markdown"])
        signals["gate"] = gate
        if gate.get("is_gate"):
            await manager.broadcast_agent_log(
                agent_label,
                f"WARNING: {target_url} is a placeholder/password-protected page "
                f"({', '.join(gate['markers'][:2])}). The audit will be marked "
                "not valid for the live site.", "running")
        out["site_signals"] = signals
    except Exception as e:
        out["site_signals"] = {"error": str(e)[:100], "status_code": out["status_code"],
                               "crawl_source": out["source"]}

    await manager.broadcast_agent_log(
        agent_label,
        f"Crawled {len(out['markdown']):,} chars (+{len(out['html']):,} HTML) from {target_url} "
        f"via {out['source']}.", "running")
    return out


async def crawler_node(state: SEOState) -> SEOState:
    state["current_node"] = "Crawler Agent"
    await manager.broadcast_node_update("seo_geo", "Crawler Agent", "running")

    crawl = await _crawl_page(state["target_url"], "SEO Agent")
    if crawl["crawl_error"]:
        # Surface it honestly - never score, or save, a page that was not read.
        state["crawl_error"] = crawl["crawl_error"]
        err = f"Crawl failed for {state['target_url']}: {crawl['crawl_error']}"
        state["logs"].append(err)
        await manager.broadcast_node_update("seo_geo", "Crawler Agent", "failed")
        raise RuntimeError(err)

    # Keep the FULL page. (Previously truncated to 4000 chars, which crippled the analysis and
    # falsely flagged large pages as "thin content".)
    state["crawl_data"] = {"markdown": crawl["markdown"], "html": crawl["html"],
                           "full_length": len(crawl["markdown"]),
                           "status_code": crawl["status_code"], "source": crawl["source"]}
    state["site_signals"] = crawl["site_signals"]

    # Core Web Vitals (Performance). Failure is fine — the auditor reports Performance as
    # "Not Verified" with the reason, rather than estimating it.
    try:
        from core.pagespeed import fetch_core_web_vitals_detailed
        psi, psi_error = await fetch_core_web_vitals_detailed(state["target_url"])
        if psi:
            state["site_signals"]["psi"] = psi
        elif psi_error:
            state["site_signals"]["psi_error"] = psi_error
    except Exception as e:
        print(f"PageSpeed step skipped: {e}")
        state["site_signals"]["psi_error"] = f"PageSpeed step failed ({type(e).__name__})"

    ok = (f"Crawled {len(crawl['markdown']):,} chars (+{len(crawl['html']):,} HTML) from "
          f"{state['target_url']} via {crawl['source']}.")
    state["logs"].append(ok)
    await manager.broadcast_node_update("seo_geo", "Crawler Agent", "completed")
    _seo_stage_done(state, "Crawler Agent")
    return state

async def technical_seo_node(state: SEOState) -> SEOState:
    state["current_node"] = "Technical SEO Agent"
    await manager.broadcast_node_update("seo_geo", "Technical SEO Agent", "running")
    # REAL analysis: compute on-page metrics from the crawled content.
    crawl = state.get("crawl_data", {}) or {}
    metrics = analyze_markdown(crawl.get("markdown", ""), state["target_url"])
    state["content_metrics"] = metrics

    # Evidence-based scoring: every point is derived from a real measurement. Anything we
    # cannot measure is marked "Not Verified" and excluded rather than estimated.
    try:
        from core.seo_scoring import build_seo_audit
        audit = build_seo_audit(
            url=state["target_url"],
            html=crawl.get("html", "") or "",
            markdown=crawl.get("markdown", "") or "",
            metrics=metrics,
            signals=state.get("site_signals", {}) or {},
        )
        state["audit"] = audit
        state["audit_score"] = int(round(audit["seo"]["score_100"]))
        await manager.broadcast_agent_log(
            "SEO Agent",
            f"Scored SEO {audit['seo']['score_100']}/100 from measured evidence (not estimated).", "running")
    except Exception as e:
        print(f"Scoring failed: {e}")
        state["audit"] = {"error": str(e)[:200]}

    msg = (f"Technical audit: {metrics['word_count']} words, {metrics['h1_count']} H1 / {metrics['h2_count']} H2, "
           f"{metrics['image_count']} images ({metrics['images_missing_alt']} missing alt)"
           + (", THIN CONTENT (<300 words)" if metrics["thin_content"] else ""))
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "completed")
    await manager.broadcast_node_update("seo_geo", "Technical SEO Agent", "completed")
    _seo_stage_done(state, "Technical SEO Agent")
    return state

async def keyword_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Keyword Agent"
    await manager.broadcast_node_update("seo_geo", "Keyword Agent", "running")
    # On-page term frequency (what the page itself talks about) - kept as-is, it's what the
    # Content category's title/H1 topical-focus check uses.
    metrics = state.get("content_metrics") or {}
    top = metrics.get("top_keywords", [])
    state["keyword_clusters"] = {"top_keywords": top}

    # REAL keyword intelligence: what people actually search to find this site, pulled from
    # Search Console when connected - genuine search demand (clicks/impressions/position),
    # not a guess derived from the page's own wording. Degrades honestly when not connected
    # rather than fabricating volumes.
    # Read from the single gather done before the graph ran, rather than opening a second
    # Search Console session here. This node used to make its own call while the pipeline's
    # other GSC needs (index status, page performance) went unmet entirely — one round of
    # OAuth refresh and one set of API calls now serves every node that needs them.
    sc = (state.get("connections") or {}).get("search_console") or {}
    if sc.get("connected"):
        real_keywords = {"source": "search_console", "queries": sc.get("queries") or [],
                         "range_days": sc.get("range_days"), "site_url": sc.get("site_url"),
                         "totals": sc.get("totals") or {}, "message": None}
        if sc.get("errors"):
            real_keywords["message"] = "; ".join(sc["errors"])
    else:
        real_keywords = {"source": "none", "queries": [],
                         "message": sc.get("message") or
                         "Connect Google Search Console to see the real queries driving traffic to this page."}

    # GA4 sits on the same Google grant and was never read by this pipeline at all. Search
    # Console says what people searched to arrive; GA4 says what happened once they did.
    ga = (state.get("connections") or {}).get("ga4") or {}
    state["ga4"] = ga
    if state.get("audit") is not None and isinstance(state.get("audit"), dict):
        state["audit"]["ga4"] = ga

    state["keyword_clusters"]["real_search_queries"] = real_keywords
    if state.get("audit"):
        state["audit"]["real_keywords"] = real_keywords

    on_page_preview = ", ".join(f"{k['term']}({k['count']})" for k in top[:6]) or "no content to analyze"
    if real_keywords["source"] == "search_console":
        gsc_preview = ", ".join(q["query"] for q in real_keywords["queries"][:5]) or "no queries yet"
        msg = f"Real search queries (Search Console): {gsc_preview}. On-page terms: {on_page_preview}"
    else:
        msg = f"On-page term frequency only (Search Console not connected) — top terms: {on_page_preview}"
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "completed")
    await manager.broadcast_node_update("seo_geo", "Keyword Agent", "completed")
    _seo_stage_done(state, "Keyword Agent")
    return state

async def content_strategy_node(state: SEOState) -> SEOState:
    """Content Review — the E-E-A-T and readability facts, plus how this page really performs.

    This node logged "Creating On-Page Optimization Checklist and evaluating E-E-A-T signals"
    and then slept for 1.5 seconds. It now evaluates them: who wrote the page, when it was
    published or updated, what it cites, how long its sentences run — and, when Search Console
    is connected, whether Google has actually indexed it and what it earns.

    The index check matters more than everything else here combined. Every on-page
    recommendation in this audit is worthless while the URL sits outside Google's index, and
    that fact is invisible in the HTML no matter how carefully it is parsed.
    """
    state["current_node"] = "Content Strategy Agent"
    await manager.broadcast_node_update("seo_geo", "Content Strategy Agent", "running")
    crawl = state.get("crawl_data", {}) or {}

    from core.seo_signals import content_signals
    signals = content_signals(crawl.get("html", "") or "", crawl.get("markdown", "") or "")
    state["content_signals"] = signals

    parts = []
    parts.append(f"author: {signals['author']} ({signals['author_source']})" if signals["author"]
                 else "no author byline (E-E-A-T: unattributed content)")
    parts.append(f"published {signals['published']}" if signals["published"]
                 else "no published/updated date")
    parts.append(f"{len(signals['authoritative_citations'])} authoritative citations"
                 if signals["authoritative_citations"] else "no citations to authoritative sources")
    if signals["sentences"]:
        parts.append(f"avg sentence {signals['avg_sentence_words']} words, "
                     f"{int(signals['long_sentence_ratio'] * 100)}% over 25 words")

    # Search Console: real demand and real index state for this exact URL.
    sc = (state.get("connections") or {}).get("search_console") or {}
    if sc.get("connected"):
        idx = sc.get("index_status") or {}
        if idx.get("coverage_state"):
            state["index_status"] = idx
            parts.append(f"Google index: {idx.get('coverage_state')}"
                         + (f" (verdict {idx.get('verdict')})" if idx.get("verdict") else ""))
        page = sc.get("this_page")
        if page:
            parts.append(f"this URL earns {page.get('clicks', 0)} clicks / "
                         f"{page.get('impressions', 0)} impressions, avg position "
                         f"{page.get('position', 0)} (28d)")
        elif sc.get("pages"):
            parts.append("this URL does not appear in the site's top Search Console pages (28d)")
    else:
        parts.append(sc.get("message") or "Search Console not connected")

    msg = "Content review: " + "; ".join(parts)
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "completed")
    await manager.broadcast_node_update("seo_geo", "Content Strategy Agent", "completed")
    _seo_stage_done(state, "Content Strategy Agent")
    return state

async def internal_linking_node(state: SEOState) -> SEOState:
    state["current_node"] = "Internal Linking Agent"
    await manager.broadcast_node_update("seo_geo", "Internal Linking Agent", "running")
    # REAL analysis: link counts from the crawled content.
    metrics = state.get("content_metrics") or {}
    il, el = metrics.get("internal_links", 0), metrics.get("external_links", 0)
    msg = f"Link audit: {il} internal, {el} external" + (" - very few internal links (weak site structure)" if il < 3 else "")
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "completed")
    await manager.broadcast_node_update("seo_geo", "Internal Linking Agent", "completed")
    _seo_stage_done(state, "Internal Linking Agent")
    return state

async def backlink_agent_node(state: SEOState) -> SEOState:
    """Backlink Check — and an honest account of what cannot be checked.

    This is the one node whose name the product cannot currently deliver on. Inbound links
    require a crawler with its own index (Ahrefs, Majestic, Moz, Semrush); the Search Console
    API exposes no links endpoint at all — Google shows that report in its UI only — so no
    combination of connected accounts here can produce a referring-domain count.

    It previously claimed to be "Generating Digital PR targets and content-led link building
    strategies" while sleeping. It now reports the outbound half, which IS measured from the
    crawl, and names the missing provider instead of implying the inbound half was checked —
    the same contract keyword_agent_node uses when Search Console is absent.
    """
    state["current_node"] = "Backlink Agent"
    await manager.broadcast_node_update("seo_geo", "Backlink Agent", "running")
    signals = state.get("content_signals") or {}
    cites = signals.get("authoritative_citations") or []
    domains = signals.get("outbound_domains") or []

    state["backlink_strategy"] = {
        "inbound": {
            "source": "none",
            "message": ("Referring domains need a backlink data provider (Ahrefs, Majestic, "
                        "Moz or Semrush). The Search Console API does not expose links, so "
                        "no inbound link data is included in this audit."),
        },
        "outbound": {
            "source": "crawl",
            "domains": domains,
            "authoritative": cites,
        },
    }
    msg = (f"Outbound links: {len(domains)} distinct domains, "
           f"{len(cites)} authoritative ({', '.join(cites[:3]) or 'none'}). "
           f"Inbound links NOT measured — no backlink provider is connected.")
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "completed")
    await manager.broadcast_node_update("seo_geo", "Backlink Agent", "completed")
    _seo_stage_done(state, "Backlink Agent")
    return state

def _scorecard_markdown(audit: dict) -> str:
    """Deterministic scorecard rendered straight from the computed audit — no LLM, so the
    published numbers can never be fabricated or drift. Works for a combined audit (both
    seo+geo) or a single-pipeline audit (seo-only or geo-only)."""
    if not audit or ("seo" not in audit and "geo" not in audit):
        return ""
    lines = ["## Scorecard (computed from measured evidence)", ""]
    for key in ("seo", "geo"):
        sec = audit.get(key) or {}
        if not sec:
            continue
        lines.append(f"**{sec['label']} Score: {sec['score_100']}/100**")
        for c in sec.get("categories", []):
            val = "Not Verified" if c.get("status") != "verified" else f"{c['score']}/{c['max']}"
            lines.append(f"- {c['name']}: {val}")
        lines.append("")
        lines.append(f"_Formula:_ `{sec.get('formula','')}`")
        lines.append("")
    if "overall_health" in audit:
        lines.append(f"**Overall Website Health: {audit.get('overall_health')}/100**")
    top = audit.get("top_5_issues") or []
    if top:
        lines.append("")
        lines.append("**Top 5 Issues**")
        for i, it in enumerate(top, 1):
            lines.append(f"{i}. **[{it['severity']}]** {it['area']} — {it['issue']}")
    return "\n".join(lines)


async def schema_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Schema Agent"
    msg = "Generating comprehensive SEO & AEO Strategy Report using LLM..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Schema Agent", "running")

    try:
        with open("prompts/seo-specialist.md", "r", encoding="utf-8") as f:
            system_prompt = f.read()
    except Exception:
        system_prompt = "You are an expert SEO Specialist."

    # The prompt file is written as an AGENT spec (tools:, maxTurns, a "Tools & Scripts"
    # section listing .py scripts). Fed to a plain one-shot LLM, the model role-plays running
    # those tools and leaks fake terminal output (<execute_bash>, WebFetch(...), print(...)) into
    # the customer-facing report. Neutralize that framing here.
    system_prompt += (
        "\n\n---\nCRITICAL OUTPUT RULES (these override everything above):\n"
        "You are a one-shot report writer with NO tools, NO shell, NO web access, and NO ability "
        "to run scripts or commands. Ignore every reference above to tools, .py scripts, MCP "
        "integrations, WebFetch, or Bash. Do NOT emit anything that looks like running a command "
        "(no <execute_bash>, no WebFetch(...), no <tool_code>, no print(...)), and do NOT fabricate "
        "tool or command output. Base all findings ONLY on the metrics and context provided in the "
        "user message, and reply with ONLY the final, clean Markdown strategy report."
    )

    # Ground the audit in this company's real brand profile + knowledge base. Read from the
    # single gather done before the graph ran (see run_seo_pipeline) rather than retrieving
    # it again here: get_brand_context is blocking — Postgres plus a vector search — and was
    # being awaited-less inside this async node, stalling the event loop mid-run. Falls back
    # to a direct fetch so the node still works if invoked outside the pipeline.
    import json as _json
    brand = state.get("brand")
    if not brand:
        from core.brand_context import get_brand_context
        brand = await asyncio.to_thread(
            get_brand_context, state["workspace_id"], f"SEO and content strategy for {state['target_url']}"
        )
    metrics = state.get("content_metrics") or {}
    # The model has no clock, so it invents one: a report generated on 31 August was dated
    # "October 26, 2026". Hand it the real date.
    import datetime as _dtm
    audit_date = _dtm.date.today().strftime("%B %d, %Y")

    # Everything the recommendation stages actually measured, handed to the model that
    # writes the strategy report.
    #
    # This prompt used to carry the brand context and `content_metrics` and nothing else, so
    # the report was written blind to the audit's own findings: the Keyword stage's real
    # Search Console queries, the Content stage's E-E-A-T and readability signals, the
    # Backlink stage's outbound citations, Google's index verdict and the scored categories
    # were all computed, persisted, shown in the scorecard — and never seen by the model
    # asked to turn them into strategy. That is why recommendations read as generic SEO
    # advice rather than advice about this site.
    #
    # Each entry is the node that produced it, so a finding can be traced back to its stage.
    # Volumes are trimmed: the model needs the shape of the evidence, not every row, and the
    # deterministic scorecard is prepended to the report separately for the exact numbers.
    audit = state.get("audit") or {}
    keywords = state.get("keyword_clusters") or {}
    real_q = (keywords.get("real_search_queries") or {})
    findings = {
        "keyword_stage": {
            "on_page_top_terms": (keywords.get("top_keywords") or [])[:10],
            "real_search_queries": {
                "source": real_q.get("source"),
                "message": real_q.get("message"),
                "totals": real_q.get("totals"),
                "queries": (real_q.get("queries") or [])[:15],
            },
        },
        "content_stage": state.get("content_signals") or {},
        "internal_linking_stage": {"links": (state.get("internal_links") or [])[:15]},
        "backlink_stage": state.get("backlink_strategy") or {},
        "index_status": state.get("index_status") or {},
        "analytics": state.get("ga4") or {},
        "scored_categories": (audit.get("seo") or {}).get("categories") or [],
        "priority_issues": (audit.get("priority_issues") or [])[:15],
    }

    prompt = (
        f"AUDIT DATE: {audit_date} (use exactly this date wherever the report shows a date)\n\n"
        f"Target URL / Query: {state['target_url']}\n\n"
        f"COMPANY CONTEXT (use this to tailor the audit to the brand, its audience and offerings):\n{brand}\n\n"
        f"MEASURED ON-PAGE METRICS from crawling the site (base your technical findings on these REAL numbers, "
        f"do not invent different ones):\n{_json.dumps(metrics, indent=2)}\n\n"
        f"MEASURED FINDINGS from each audit stage — these are this run's real results. Judge every one of them "
        f"against the COMPANY CONTEXT above: whether the queries this site wins are the ones its stated audience "
        f"would search, whether its content serves that audience, and which issues matter most given what this "
        f"company actually sells. Where a field says the data source is missing or not connected, say so plainly "
        f"and do not substitute an estimate:\n{_json.dumps(findings, indent=2, default=str)[:12000]}\n\n"
        f"Please run a comprehensive SEO Strategy audit and provide a detailed markdown report tailored to this company, "
        f"referencing the measured metrics and stage findings above where relevant. Prioritise recommendations by their "
        f"impact on this company's stated audience and offering, not by generic SEO importance."
    )

    try:
        llm = GeminiProvider()
        response = await llm.generate_text(prompt=prompt, system_prompt=system_prompt)
        mock_report = response.strip()
    except Exception as e:
        print(f"LLM Error in seo_geo: {e}")
        mock_report = f"# Comprehensive SEO & AEO Strategy Report\nTarget: {state['target_url']}\n[LLM Generation Failed]"

    # audit_score was already set from the real computed score in technical_seo_node —
    # do NOT overwrite it with a hardcoded number. Prepend the deterministic scorecard so
    # the report's headline numbers are guaranteed correct regardless of the narrative.
    state["status"] = "pending_approval"
    scorecard = _scorecard_markdown(state.get("audit") or {})
    state["report"] = (scorecard + "\n\n---\n\n" + mock_report) if scorecard else mock_report
    import json
    await manager.broadcast(json.dumps({
        "type": "new_seo_report",
        "title": f"Technical SEO & Content Strategy for {state['target_url']}",
        "excerpt": state["report"].replace('{target_url}', state['target_url']),
        "keywords": "SEO, AEO, Cannibalization, Technical Audit, Schema Markup"
    }))
    await manager.broadcast_node_update("seo_geo", "Schema Agent", "completed")
    _seo_stage_done(state, "Schema Agent")
    return state

async def publishing_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Publishing Agent"
    msg = "Preparing the schema, metadata, and redirect changes as a ready-to-apply plan..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Publishing Agent", "running")
    # Nothing is ever published from here — the plan is prepared and a human applies it.
    # What changed is that whether a connector EXISTS is now looked up rather than asserted:
    # this told every workspace "no site connector is wired up yet", including the ones that
    # had connected GitHub, WordPress or Shopify and were being told to go connect it again.
    site = (state.get("connections") or {}).get("site") or {}
    if site.get("connected"):
        msg = (f"Deployment plan ready. {site.get('label')} is connected ({site.get('target')}), "
               f"so these changes can be applied from the approval step — nothing was published "
               f"automatically.")
    else:
        msg = ("Deployment plan ready. " + (site.get("message") or
               "Connect GitHub, WordPress or Shopify to auto-apply these changes.")
               + " Nothing was published automatically.")
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "completed")
    await manager.broadcast_node_update("seo_geo", "Publishing Agent", "completed")
    _seo_stage_done(state, "Publishing Agent")
    return state

async def reporting_agent_node(state: SEOState) -> SEOState:
    """Final summary of what was measured, and on what evidence.

    Replaces a 2-second sleep followed by "Awaiting Answer Engine indexing. Post-publish
    metrics generated." — a sentence describing two things that had not happened: nothing was
    published, so there were no post-publish metrics, and no answer engine had been asked to
    index anything. It now closes the run with the real score, the real issue counts and the
    list of data sources the audit was actually able to read.
    """
    state["current_node"] = "Reporting Agent"
    await manager.broadcast_node_update("seo_geo", "Reporting Agent", "running")

    audit = state.get("audit") or {}
    section = audit.get("seo") or {}
    issues = audit.get("priority_issues") or []
    sev = {}
    for i in issues:
        sev[i.get("severity")] = sev.get(i.get("severity"), 0) + 1
    breakdown = ", ".join(f"{n} {s.lower()}" for s, n in
                          sorted(sev.items(), key=lambda kv: {"Critical": 0, "High": 1,
                                                              "Medium": 2, "Low": 3}.get(kv[0], 4)))
    head = (f"SEO report ready: {section.get('score_100', state.get('audit_score', 0))}/100 "
            f"from {len(section.get('categories') or [])} measured categories"
            + (f"; {len(issues)} prioritised issues ({breakdown})" if issues else "; no issues found"))
    if section.get("not_verified"):
        head += f". Not verified: {', '.join(section['not_verified'])}"
    state["logs"].append(head)
    await manager.broadcast_agent_log("SEO Agent", head, "running")

    from core.seo_connections import summary_line
    sources = summary_line(state.get("connections") or {})
    state["logs"].append(sources)
    await manager.broadcast_agent_log("SEO Agent", sources, "completed")
    await manager.broadcast_node_update("seo_geo", "Reporting Agent", "completed")
    _seo_stage_done(state, "Reporting Agent")

    state["status"] = "completed"
    return state

workflow = StateGraph(SEOState)

workflow.add_node("crawler_agent", crawler_node)
workflow.add_node("technical_seo", technical_seo_node)
workflow.add_node("keyword_agent", keyword_agent_node)
workflow.add_node("content_strategy", content_strategy_node)
workflow.add_node("internal_linking", internal_linking_node)
workflow.add_node("backlink_agent", backlink_agent_node)
workflow.add_node("schema_agent", schema_agent_node)
workflow.add_node("publishing_agent", publishing_agent_node)
workflow.add_node("reporting_agent", reporting_agent_node)

workflow.set_entry_point("crawler_agent")
workflow.add_edge("crawler_agent", "technical_seo")
workflow.add_edge("technical_seo", "keyword_agent")
workflow.add_edge("keyword_agent", "content_strategy")
workflow.add_edge("content_strategy", "internal_linking")
workflow.add_edge("internal_linking", "backlink_agent")
workflow.add_edge("backlink_agent", "schema_agent")
workflow.add_edge("schema_agent", "publishing_agent")
workflow.add_edge("publishing_agent", "reporting_agent")
workflow.add_edge("reporting_agent", END)

seo_graph = workflow.compile()

publish_workflow = StateGraph(SEOState)
publish_workflow.add_node("publishing_agent", publishing_agent_node)
publish_workflow.add_node("reporting_agent", reporting_agent_node)
publish_workflow.set_entry_point("publishing_agent")
publish_workflow.add_edge("publishing_agent", "reporting_agent")
publish_workflow.add_edge("reporting_agent", END)
seo_publish_graph = publish_workflow.compile()

def _persist_audit(workspace_id: int, pipeline: str, target_url: str, result: dict, duration_seconds: float = None):
    """Save a snapshot of this run (metrics + report + timestamp) so month-over-month
    history accumulates and monthly comparison reports become possible."""
    if not workspace_id:
        return
    try:
        from database import SessionLocal
        import models
        metrics = result.get("content_metrics") or {}
        kd = {"pipeline": pipeline, "target_url": target_url, "metrics": metrics}
        if duration_seconds is not None:
            kd["duration_seconds"] = round(duration_seconds, 1)
        # Also store the already-computed structured audit (scores/categories/issues) so the
        # dashboard can render it directly instead of re-parsing the report markdown.
        audit = result.get("audit")
        if isinstance(audit, dict) and ("seo" in audit or "geo" in audit):
            kd["audit"] = audit

        # The findings the pipeline nodes measured, kept beside the score. Without this they
        # existed only inside the report markdown, which means nothing can chart them, compare
        # them month over month, or re-render them without parsing prose back into numbers.
        for key in ("content_signals", "authority_signals", "geo_citations",
                    "geo_prompt_visibility", "schema_markup", "index_status"):
            value = result.get(key)
            if value:
                kd[key] = value
        # Which integrations this run could actually read, minus their payloads — a later
        # comparison needs to know whether a metric moved or a connection simply dropped.
        conns = result.get("connections") or {}
        if conns:
            kd["connections"] = {
                name: {"connected": bool((conns.get(name) or {}).get("connected")),
                       "message": (conns.get(name) or {}).get("message")}
                for name in ("search_console", "ga4", "site")
            }
            sc = conns.get("search_console") or {}
            if sc.get("connected"):
                kd["connections"]["search_console"]["totals"] = sc.get("totals") or {}
                kd["connections"]["search_console"]["site_url"] = sc.get("site_url")
            ga = conns.get("ga4") or {}
            if ga.get("connected"):
                kd["connections"]["ga4"]["totals"] = ((ga.get("traffic") or {}).get("totals") or {})
        db = SessionLocal()
        db.add(models.SEOAudit(
            workspace_id=workspace_id,
            score=result.get("audit_score", 0) or 0,
            keywords_data=kd,
            recommendation=(result.get("report") or "")[:20000],
            status="COMPLETED",
        ))
        db.commit()
        db.close()
    except Exception as e:
        print(f"Failed to persist {pipeline} audit for ws {workspace_id}: {e}")

async def run_seo_pipeline(workspace_id: int, target_url: str):
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
    target_url = normalize_target_url(target_url)
    initial_state = {
        "workspace_id": workspace_id,
        "target_url": target_url,
        "logs": [],
        "current_node": "init",
        "status": "queued",
        "audit_score": 0,
        "crawl_data": {},
        "keyword_clusters": {},
        "content_gaps": [],
        "internal_links": [],
        "backlink_strategy": {},
        "schema_markup": {},
        "report": ""
    }
    await manager.broadcast_agent_log("SEO Agent", "Initializing Marketing SEO Specialist pipeline...", "queued")
    from core.agent_status import record_agent_task
    import datetime as _dt
    start_time = _dt.datetime.utcnow()
    record_agent_task(workspace_id, "SEO", "RUNNING", f"Auditing {target_url}", reset=True, target_url=target_url)

    # Read every connected account once, before the graph starts. Gathering here rather than
    # inside the nodes means one OAuth refresh per run instead of one per node, and it means
    # a node can report "Search Console says this page is not indexed" without each node
    # having to know how to talk to Google.
    from core.seo_connections import gather, summary_line
    initial_state["connections"] = await gather(workspace_id, target_url)
    intro = summary_line(initial_state["connections"])
    initial_state["logs"].append(intro)
    await manager.broadcast_agent_log("SEO Agent", intro, "running")

    # The workspace's own strategy — brand voice, target audience, guidelines and the
    # relevant knowledge-base excerpts — gathered once here for the same reason connections
    # are: one retrieval per run rather than one per node. Only schema_agent_node fetched it
    # before, on its own, so eight of the nine SEO nodes audited the site with no idea what
    # the brand sells or who it sells to. It is blocking work (Postgres + vector search), so
    # it runs in a thread rather than stalling the event loop.
    from core.brand_context import get_brand_context
    initial_state["brand"] = await asyncio.to_thread(
        get_brand_context, workspace_id, f"SEO and content strategy for {target_url}"
    )

    try:
        result = await seo_graph.ainvoke(initial_state)
        duration = (_dt.datetime.utcnow() - start_time).total_seconds()
        _persist_audit(workspace_id, "SEO", target_url, result, duration_seconds=duration)
        record_agent_task(workspace_id, "SEO", "COMPLETED", f"SEO audit complete for {target_url}")
    except asyncio.CancelledError:
        record_agent_task(workspace_id, "SEO", "CANCELLED", "Audit cancelled.")
        raise
    except Exception as e:
        record_agent_task(workspace_id, "SEO", "FAILED", str(e)[:120])
        raise

    await manager.broadcast_node_update("seo_geo", "Awaiting Approval", "completed")
    return result

async def run_seo_publish_pipeline(workspace_id: int):
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
    # Retrieve state from DB or memory in a real app. We mock it here.
    initial_state = {
        "workspace_id": workspace_id,
        "target_url": "approved_url",
        "logs": [],
        "current_node": "Publishing Agent",
        "status": "approved",
        "audit_score": 92,
        "crawl_data": {},
        "keyword_clusters": {},
        "content_gaps": [],
        "internal_links": [],
        "backlink_strategy": {},
        "schema_markup": {},
        "report": ""
    }
    await manager.broadcast_agent_log("SEO Agent", "Human approval received. Commencing publishing sequence.", "running")
    result = await seo_publish_graph.ainvoke(initial_state)

    # Broadcast final completion
    await manager.broadcast_node_update("seo_geo", "Pipeline", "completed")
    return result

# ---------------- GEO PIPELINE ----------------

async def geo_entity_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Entity Agent"
    await manager.broadcast_node_update("geo_pipeline", "Entity Agent", "running")
    # REAL crawl (previously this pipeline never fetched the page at all, so GEO scoring
    # had nothing to measure). Same Firecrawl source as SEO, kept as a separate call so a
    # crawl failure in one pipeline never blocks the other.
    crawl = await _crawl_page(state["target_url"], "GEO Agent")
    state["crawl_data"] = {"markdown": crawl["markdown"], "html": crawl["html"],
                           "full_length": len(crawl["markdown"]), "source": crawl["source"]}
    state["site_signals"] = crawl["site_signals"]
    # No "no_api_key" exemption any more: that exemption is what let a GEO run with nothing
    # crawled go on to score an empty page and save GEO 2/100 as a finished audit.
    if crawl["crawl_error"]:
        state["crawl_error"] = crawl["crawl_error"]
        err = f"GEO crawl failed for {state['target_url']}: {crawl['crawl_error']}"
        state["logs"].append(err)
        await manager.broadcast_node_update("geo_pipeline", "Entity Agent", "failed")
        raise RuntimeError(err)
    state["content_metrics"] = analyze_markdown(crawl["markdown"], state["target_url"])
    msg = f"Extracted {state['content_metrics']['word_count']} words of primary/secondary NLP entities from {state['target_url']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Entity Agent", "completed")
    _geo_stage_done(state, "Entity Agent")
    return state

def _brand_label(state: SEOState) -> str:
    """The brand's own name, for deciding whether an answer actually named it.

    The workspace name is used only when it is actually this site's name, which takes two
    checks. It must not be a placeholder — the default "<user>'s Workspace" would otherwise be
    searched for in model answers, where it can never appear, dragging every visibility score
    to zero. And the workspace's own company_url must match the domain being audited: a
    workspace called "DSA" auditing ambraneindia.com is a real case from testing, and passing
    "DSA" as the brand meant the probes asked about one company and scored the answers for
    another. The domain is the reliable identifier, so it is always kept either way.
    """
    from urllib.parse import urlparse as _u
    host = (_u(state["target_url"]).netloc or "").replace("www.", "").lower()
    try:
        from database import SessionLocal
        import models
        with SessionLocal() as db:
            ws = (db.query(models.Workspace)
                    .filter(models.Workspace.id == state["workspace_id"]).first())
            name = (getattr(ws, "name", "") or "").strip()
            own = (_u(getattr(ws, "company_url", "") or "").netloc or "").replace("www.", "").lower()
            if (name and len(name) > 2 and "workspace" not in name.lower()
                    and own and host and (own == host or own.endswith("." + host)
                                          or host.endswith("." + own))):
                return name
    except Exception:
        pass
    return host


async def geo_citation_agent_node(state: SEOState) -> SEOState:
    """AI Mentions — what an answer engine would cite as a source about this brand.

    The claim this node used to log was "Cross-referencing brand facts against Perplexity and
    ChatGPT source datasets", which described an integration that does not exist, during a
    one-second sleep. There is no Perplexity or OpenAI credential in this product, so the
    honest version asks the model it does have, and every result says which model answered.
    """
    state["current_node"] = "Citation Agent"
    await manager.broadcast_node_update("geo_pipeline", "Citation Agent", "running")
    from core.geo_probes import probe_citations

    brand = _brand_label(state)
    result = await probe_citations(state["target_url"], brand)
    state["geo_citations"] = result

    if not result["ok"]:
        msg = f"Citation probe could not run: {result.get('error')}"
    elif not result["knows_brand"]:
        msg = (f"{result['model']} has no knowledge of this brand and could name no sources "
               f"for it — there is nothing for an answer engine to cite yet.")
    else:
        msg = (f"{result['model']} would cite {len(result['sources'])} source(s): "
               f"{', '.join(result['sources'][:4]) or 'none named'}. "
               + ("The brand's own site is among them."
                  if result["cites_own_site"] else
                  "The brand's own site is NOT among them — answers about it would be sourced "
                  "from third parties."))
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "completed")
    await manager.broadcast_node_update("geo_pipeline", "Citation Agent", "completed")
    _geo_stage_done(state, "Citation Agent")
    return state


async def geo_prompt_visibility_agent_node(state: SEOState) -> SEOState:
    """AI Visibility — ask the questions a buyer would ask, count how often the brand appears.

    The previous log line, "Auditing top 50 LLM prompt structures that intersect with target
    market", was emitted during a one-second sleep in which no prompt was written and no model
    was called. This runs a real probe: buyer-intent prompts for this category, answered in
    one pass, checked for whether the brand is named. That percentage is the closest thing GEO
    has to a rank, and it is now measured rather than described.

    Five prompts, not fifty — each one costs a model call and a user is waiting on this. The
    number is reported alongside the result so nobody reads 40% as a bigger sample than it is.
    """
    state["current_node"] = "Prompt Visibility Agent"
    await manager.broadcast_node_update("geo_pipeline", "Prompt Visibility Agent", "running")
    from core.geo_probes import probe_prompt_visibility

    # Seed the category from what the brand already ranks for in Search Console where it is
    # connected: real queries from real people beat a category inferred from the domain.
    sc = (state.get("connections") or {}).get("search_console") or {}
    queries = [q.get("key") for q in (sc.get("queries") or [])[:5] if q.get("key")]
    category = (", ".join(queries) if queries else "")
    brand = _brand_label(state)

    result = await probe_prompt_visibility(state["target_url"], brand, category)
    state["geo_prompt_visibility"] = result

    if not result["ok"]:
        msg = f"Prompt visibility probe could not run: {result.get('error')}"
    else:
        src = (f" Prompts were derived from this site's real Search Console queries ({category})."
               if queries else " Search Console is not connected, so prompts were derived from the site itself.")
        msg = (f"AI visibility: named in {result['mentioned_in']} of {result['total']} "
               f"buyer-intent answers ({result['visibility_pct']}%) from {result['model']}." + src)
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "completed")
    await manager.broadcast_node_update("geo_pipeline", "Prompt Visibility Agent", "completed")
    _geo_stage_done(state, "Prompt Visibility Agent")
    return state

async def geo_llm_ranking_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "LLM Ranking Agent"
    await manager.broadcast_node_update("geo_pipeline", "LLM Ranking Agent", "running")
    # REAL recall probe: actually ask the model what it knows about the brand. This is a
    # genuine GEO signal (does an answer engine recognise / recall this brand?).
    url = state["target_url"]
    try:
        llm = GeminiProvider()
        probe = await llm.generate_text(
            prompt=f"What do you know about the brand/company at {url}? "
                   f"If you don't recognise it, say exactly 'NO RECALL'. Otherwise summarise what you know in 2 sentences.",
            system_prompt="You are an AI answer engine. Answer only from your own training knowledge - do not guess or fabricate.",
            # The max_output_tokens=200 that was here made this probe unreliable in a way that
            # read as a finding. gemini-2.5-flash spends that budget on thinking tokens before
            # emitting any text, so the reply came back truncated or empty — and an empty reply
            # contains no "NO RECALL", so `recalled` evaluated True and the audit reported that
            # the model recognised a brand it had said nothing about. Two sentences need no cap.
        )
        probe = (probe or "").strip()
    except Exception as e:
        probe = f"(recall probe failed: {e})"
    # An empty reply is not recall. Without the `probe.strip()` term, a blank or blocked
    # response contains no "NO RECALL" and so counted as the model recognising the brand —
    # the audit's most quotable finding, asserted from nothing.
    recalled = bool(probe.strip()) and "NO RECALL" not in probe.upper() and "recall probe failed" not in probe

    # Reconcile with the citation probe rather than contradicting it. These are two differently
    # framed questions to a nondeterministic model, and a real run produced "does NOT recall
    # this brand" in the same report as "would cite ambraneindia.com, en.wikipedia.org,
    # timesofindia.indiatimes.com, gadgets360.com". Naming four genuine third-party sources is
    # recall, whatever the other prompt returned, so that evidence wins and the report says on
    # what basis — rather than printing both claims and leaving the reader to pick.
    cit = state.get("geo_citations") or {}
    citation_evidence = bool(cit.get("ok") and cit.get("knows_brand") and cit.get("sources"))
    if not recalled and citation_evidence:
        msg = (f"LLM recall probe: the direct question returned no recall, but the citation "
               f"probe named {len(cit['sources'])} real sources for this brand "
               f"({', '.join(cit['sources'][:3])}), so the model does hold knowledge of it. "
               f"Treating the brand as recognised on that evidence.")
        recalled = True
    elif recalled:
        msg = "LLM recall probe: model recognises the brand."
    else:
        msg = "LLM recall probe: model does NOT recall this brand (zero unprompted visibility)."

    state["content_metrics"] = {**(state.get("content_metrics") or {}),
                                "llm_recall": probe, "brand_recognised": recalled,
                                "recall_from_citations": bool(not probe.strip() or citation_evidence)}
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "completed")
    await manager.broadcast_node_update("geo_pipeline", "LLM Ranking Agent", "completed")
    _geo_stage_done(state, "LLM Ranking Agent")
    return state

async def geo_authority_agent_node(state: SEOState) -> SEOState:
    """Online Presence — the trust surfaces that are actually on the site.

    Was "Identifying digital PR avenues for trusted knowledge base ingestion" over a
    one-second sleep. Digital PR avenues are not something this product can identify; what it
    can do is check, from the page it just crawled, which trust surfaces an answer engine
    looks for are present — about, contact, docs, blog, pricing, policies, official profiles —
    and name the ones that are missing.
    """
    state["current_node"] = "Authority Agent"
    await manager.broadcast_node_update("geo_pipeline", "Authority Agent", "running")
    from core.seo_signals import authority_signals

    crawl = state.get("crawl_data", {}) or {}
    sig = authority_signals(crawl.get("html", "") or "", crawl.get("markdown", "") or "",
                            state["target_url"])
    state["authority_signals"] = sig
    present = [k for k, v in sig["found"].items() if v]
    msg = (f"Trust surfaces present: {', '.join(present) or 'none'}. "
           f"Missing: {', '.join(sig['missing']) or 'none'}. "
           f"Official profiles linked: {', '.join(sig['profiles']) or 'none'}.")
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "completed")
    await manager.broadcast_node_update("geo_pipeline", "Authority Agent", "completed")
    _geo_stage_done(state, "Authority Agent")
    return state


async def geo_knowledge_graph_agent_node(state: SEOState) -> SEOState:
    """Knowledge Presence — build the JSON-LD the page is missing.

    The old line promised a "localized RDF graph payload to feed Google's Knowledge Panel",
    which is not a thing that can be fed to Google and was not being constructed anyway. What
    genuinely helps is the markup the page lacks: an Organization and WebSite block naming the
    entity and linking its official profiles, so an answer engine can tell that this site, that
    LinkedIn page and that GitHub org are one company.

    Assembled deterministically rather than written by the model. Structured data is a factual
    claim about a business, and markup that disagrees with the page is penalised — so it is
    built from the site's own URL, the workspace's brand profile and the profile links found
    during the crawl, and it never recommends adding a type the page already declares.
    """
    state["current_node"] = "Knowledge Graph Agent"
    await manager.broadcast_node_update("geo_pipeline", "Knowledge Graph Agent", "running")
    from core.seo_signals import build_jsonld

    crawl = state.get("crawl_data", {}) or {}
    profiles = (state.get("authority_signals") or {}).get("profiles") or []
    description = ""
    try:
        # Deliberately its own narrow retrieval rather than state["brand"]: this needs a
        # one-line description of the company for the JSON-LD `description` field, not the
        # run's full strategy context. Moved onto a thread because get_brand_context is
        # blocking (Postgres + vector search) and this is an async node.
        from core.brand_context import get_brand_context
        description = (await asyncio.to_thread(
            get_brand_context, state["workspace_id"],
            "one sentence describing what this company does") or "")[:300]
    except Exception:
        description = ""

    kg = build_jsonld(state["target_url"], _brand_label(state), description,
                      crawl.get("html", "") or "", profiles)
    # Populates a state field that has been initialised and then left empty since this
    # pipeline was written, so the report and the approval step have something to carry.
    state["schema_markup"] = kg

    if kg["missing_types"]:
        msg = (f"Knowledge graph: page declares {', '.join(kg['existing_types']) or 'no schema types'}. "
               f"Generated ready-to-paste JSON-LD for {', '.join(kg['missing_types'])}"
               + (f", linking {len(profiles)} official profile(s) via sameAs." if profiles else
                  ". No official profiles were found to link via sameAs — add them to confirm the entity."))
    else:
        msg = (f"Knowledge graph: page already declares {', '.join(kg['existing_types'])} — "
               f"no Organization/WebSite markup needs adding.")
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "completed")
    await manager.broadcast_node_update("geo_pipeline", "Knowledge Graph Agent", "completed")
    _geo_stage_done(state, "Knowledge Graph Agent")
    return state


async def geo_optimization_agent_node(state: SEOState) -> SEOState:
    """AI Recommendations — paste-ready content, written against this audit's measurements.

    The node did claim to be "drafting precise content injections"; it just slept instead. It
    now drafts them, and the difference that matters is the grounding: the model is handed the
    measured findings from the four nodes before it — recall, citations, visibility rate,
    missing trust surfaces, word count — and told to write only about those. A blank prompt
    returns generic best practice that would read identically for any site on the internet.
    """
    state["current_node"] = "Optimization Agent"
    await manager.broadcast_node_update("geo_pipeline", "Optimization Agent", "running")
    from core.geo_probes import draft_optimizations

    m = state.get("content_metrics") or {}
    cit = state.get("geo_citations") or {}
    vis = state.get("geo_prompt_visibility") or {}
    auth = state.get("authority_signals") or {}
    kg = state.get("schema_markup") or {}
    findings = "\n".join(filter(None, [
        f"- Page length: {m.get('word_count', 0)} words, "
        f"{m.get('h1_count', 0)} H1 / {m.get('h2_count', 0)} H2.",
        f"- Model recall: {'recognises the brand' if m.get('brand_recognised') else 'does NOT recall this brand'}.",
        (f"- Citations: model would cite {len(cit.get('sources') or [])} source(s); "
         f"own site {'included' if cit.get('cites_own_site') else 'not included'}."
         if cit.get("ok") else None),
        (f"- Buyer-intent visibility: named in {vis.get('mentioned_in')} of {vis.get('total')} "
         f"answers ({vis.get('visibility_pct')}%). Prompts: "
         f"{'; '.join(vis.get('prompts') or [])[:400]}" if vis.get("ok") else None),
        (f"- Missing trust surfaces: {', '.join(auth.get('missing') or []) or 'none'}."
         if auth else None),
        (f"- Structured data missing: {', '.join(kg.get('missing_types') or []) or 'none'}."
         if kg else None),
    ]))

    brand = ""
    try:
        # Off the event loop for the same reason as the other nodes: get_brand_context is a
        # blocking Postgres + vector-search call and this is an async node.
        from core.brand_context import get_brand_context
        brand = await asyncio.to_thread(
            get_brand_context, state["workspace_id"],
            f"AI answer-engine visibility for {state['target_url']}"
        )
    except Exception:
        brand = ""

    result = await draft_optimizations(state["target_url"], brand, findings)
    state["geo_optimizations"] = result
    state["content_gaps"] = findings.splitlines()

    msg = (f"Drafted paste-ready content for the measured gaps ({len(result['markdown'])} chars)."
           if result.get("ok") else
           f"Could not draft content injections: {result.get('error')}")
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "completed")
    await manager.broadcast_node_update("geo_pipeline", "Optimization Agent", "completed")
    _geo_stage_done(state, "Optimization Agent")
    return state

async def geo_reporting_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Reporting"
    msg = "Packaging Generative Engine Optimization (GEO) audit and deployment strategy..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Reporting", "running")

    # Evidence-based GEO scoring, from the REAL crawl done in geo_entity_agent_node — this
    # pipeline no longer just probes LLM recall, it computes a real, independently-verified
    # GEO score the same way the SEO pipeline computes its own (never blended together).
    crawl = state.get("crawl_data", {}) or {}
    metrics = state.get("content_metrics") or {}
    try:
        from core.seo_scoring import build_geo_audit
        llm_recall = {"llm_recall": metrics.get("llm_recall"), "brand_recognised": metrics.get("brand_recognised")}
        audit = build_geo_audit(
            url=state["target_url"],
            html=crawl.get("html", "") or "",
            markdown=crawl.get("markdown", "") or "",
            metrics=metrics,
            signals=state.get("site_signals", {}) or {},
            llm_recall=llm_recall,
        )
        state["audit"] = audit
        state["audit_score"] = int(round(audit["geo"]["score_100"]))
        await manager.broadcast_agent_log(
            "GEO Agent", f"Scored GEO {audit['geo']['score_100']}/100 from measured evidence (not estimated).", "running")
    except Exception as e:
        print(f"GEO scoring failed: {e}")
        state["audit"] = {"error": str(e)[:200]}

    await manager.broadcast_node_update("geo_pipeline", "Reporting", "completed")
    _geo_stage_done(state, "Reporting")

    state["status"] = "pending_approval"

    # Generate a REAL, brand-grounded GEO report via the LLM (was a hardcoded mock).
    # Its own retrieval rather than state["brand"] on purpose: the run-level gather asks for
    # positioning and audience, this asks for AI-visibility material, and the two return
    # different knowledge-base excerpts. Moved onto a thread because get_brand_context is
    # blocking (Postgres + vector search) and this is an async node — it was stalling the
    # event loop, and every other broadcast on this worker with it.
    from core.brand_context import get_brand_context
    brand = await asyncio.to_thread(
        get_brand_context, state["workspace_id"],
        f"generative engine optimization and AI visibility for {state['target_url']}"
    )
    geo_system = (
        "You are a Generative Engine Optimization (GEO/AEO) specialist. You improve how a brand "
        "is represented and cited by AI answer engines (ChatGPT, Gemini, Perplexity, Claude). "
        "Produce a concise, actionable markdown report with these sections: "
        "1) LLM Recall & Visibility Audit, 2) Entity Disambiguation (JSON-LD schema), "
        "3) Answer Engine Prompt Optimization (FAQ/Q&A), 4) Citation & Authority Growth. "
        "Base it on the company context; do not invent specific metrics you cannot know - "
        "frame findings and recommendations qualitatively."
    )
    _m = state.get("content_metrics") or {}
    recall_line = ""
    if "llm_recall" in _m:
        recall_line = (
            f"MEASURED LLM RECALL (we actually queried an AI model about this brand):\n"
            f"- Brand recognised by the model: {_m.get('brand_recognised')}\n"
            f"- Model's response: {_m.get('llm_recall')}\n\n"
        )

    # Everything the four probe nodes measured, handed to the narrative so it argues from this
    # site's numbers instead of restating GEO best practice. Previously only the recall line
    # reached here, because the other nodes produced nothing to pass on.
    _vis = state.get("geo_prompt_visibility") or {}
    _cit = state.get("geo_citations") or {}
    _auth = state.get("authority_signals") or {}
    _sc = (state.get("connections") or {}).get("search_console") or {}
    measured = []
    if _vis.get("ok"):
        measured.append(
            f"MEASURED AI VISIBILITY ({_vis['model']}): the brand was named in "
            f"{_vis['mentioned_in']} of {_vis['total']} buyer-intent answers "
            f"({_vis['visibility_pct']}%). Prompts asked: " + "; ".join(_vis.get("prompts") or []))
    if _cit.get("ok"):
        measured.append(
            f"MEASURED CITATIONS: model {'knows' if _cit['knows_brand'] else 'does NOT know'} this "
            f"brand; sources it would cite: {', '.join(_cit.get('sources') or []) or 'none'}; "
            f"own site cited: {_cit.get('cites_own_site')}")
    if _auth:
        measured.append(f"MEASURED TRUST SURFACES: missing {', '.join(_auth.get('missing') or []) or 'none'}; "
                        f"profiles linked: {', '.join(_auth.get('profiles') or []) or 'none'}")
    if _sc.get("connected"):
        t = _sc.get("totals") or {}
        measured.append(
            f"SEARCH CONSOLE (28d, real): {t.get('clicks', 0)} clicks, {t.get('impressions', 0)} "
            f"impressions, avg position {t.get('position', 0)}. Top queries: "
            + ", ".join(q.get("key", "") for q in (_sc.get("queries") or [])[:8]))
    measured_block = ("\n\n".join(measured) + "\n\n") if measured else ""

    import datetime as _dtm
    geo_prompt = (
        f"AUDIT DATE: {_dtm.date.today().strftime('%B %d, %Y')} (use exactly this date wherever "
        f"the report shows a date)\n\n"
        f"Target URL / Brand: {state['target_url']}\n\n"
        f"COMPANY CONTEXT (tailor the GEO strategy to this brand, audience and offerings):\n{brand}\n\n"
        f"{recall_line}{measured_block}"
        f"Write the GEO / AEO strategy report for this company. Build the Visibility Audit "
        f"section from the measured findings above — quote those real numbers rather than "
        f"describing what could be measured — and do not introduce metrics that are not listed."
    )
    try:
        llm = GeminiProvider()
        mock_geo_report = (await llm.generate_text(prompt=geo_prompt, system_prompt=geo_system)).strip()
    except Exception as e:
        print(f"LLM Error in GEO reporting: {e}")
        mock_geo_report = f"# GEO / AEO Strategy Report\nTarget: {state['target_url']}\n\n[Report generation failed: {e}]"
    # Prepend the deterministic scorecard so the report's headline GEO number is guaranteed
    # correct regardless of the narrative (same pattern as the SEO pipeline's schema_agent_node).
    scorecard = _scorecard_markdown(state.get("audit") or {})
    state["report"] = (scorecard + "\n\n---\n\n" + mock_geo_report) if scorecard else mock_geo_report

    # The two deliverables the probe nodes produced are appended verbatim, after the narrative.
    # They are the parts of this report someone can act on without rewriting anything, and
    # neither survives a round trip through the model — the JSON-LD because a regenerated copy
    # is no longer guaranteed to match the page, the drafted copy because it is already final.
    kg = state.get("schema_markup") or {}
    if kg.get("ready_to_paste"):
        state["report"] += (
            f"\n\n---\n\n## Structured data to add\n\n"
            f"This page declares {', '.join(kg.get('existing_types') or []) or 'no schema types'}. "
            f"Paste this into the `<head>` to add {', '.join(kg.get('missing_types') or [])}:\n\n"
            f"```html\n<script type=\"application/ld+json\">\n{kg.get('jsonld')}\n</script>\n```")
    opt = state.get("geo_optimizations") or {}
    if opt.get("ok") and opt.get("markdown"):
        state["report"] += ("\n\n---\n\n## Content to add, written against this audit\n\n"
                            + opt["markdown"])

    import json
    await manager.broadcast(json.dumps({
        "type": "new_geo_report",
        "title": f"Generative Engine Optimization (GEO) Strategy",
        "excerpt": state["report"].replace('{target_url}', state['target_url']),
        "keywords": "GEO, AEO, Perplexity, Gemini, Citation Audit, Entities"
    }))

    return state

async def geo_publishing_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Publishing Agent"
    msg = "Preparing Knowledge Graph schema and FAQ structured data as a ready-to-apply plan..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Publishing Agent", "running")
    # Nothing is pushed from here. Whether a CMS connector exists is looked up rather than
    # denied outright — the same correction made in the SEO publishing node, which told every
    # workspace to go and connect the site it had already connected.
    from core.seo_connections import gather
    site = (state.get("connections") or await gather(state["workspace_id"],
                                                     state.get("target_url") or "")).get("site") or {}
    state["connections"] = state.get("connections") or {"site": site}
    if site.get("connected"):
        done = (f"GEO structured data plan ready. {site.get('label')} is connected "
                f"({site.get('target')}), so it can be applied from here — nothing was pushed "
                f"automatically.")
    else:
        done = ("GEO structured data plan ready. " + (site.get("message") or
                "Connect GitHub, WordPress or Shopify to auto-apply it.")
                + " Nothing was pushed to a CMS automatically.")
    state["logs"].append(done)
    await manager.broadcast_agent_log("GEO Agent", done, "completed")
    await manager.broadcast_node_update("geo_pipeline", "Publishing Agent", "completed")
    return state

async def geo_reporting_final_agent_node(state: SEOState) -> SEOState:
    """Closes the approval run. Was a 1-second sleep followed by "GEO strategy active.
    Awaiting Answer Engine indexing." — asserting both that a strategy had been activated and
    that an answer engine had been asked to index something, neither of which happened. There
    is no submission step to an answer engine; models pick a site up on their own schedule."""
    state["current_node"] = "Final Reporting"
    kg = state.get("schema_markup") or {}
    msg = ("GEO plan approved and recorded"
           + (f"; structured data prepared for {', '.join(kg.get('missing_types') or [])}."
              if kg.get("missing_types") else ".")
           + " Answer engines re-read a site on their own schedule — there is no index request "
             "to submit, so changes surface over the following weeks.")
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "completed")
    return state

geo_workflow = StateGraph(SEOState)
geo_workflow.add_node("geo_entity_agent", geo_entity_agent_node)
geo_workflow.add_node("geo_citation_agent", geo_citation_agent_node)
geo_workflow.add_node("geo_prompt_visibility", geo_prompt_visibility_agent_node)
geo_workflow.add_node("geo_llm_ranking", geo_llm_ranking_agent_node)
geo_workflow.add_node("geo_authority", geo_authority_agent_node)
geo_workflow.add_node("geo_knowledge_graph", geo_knowledge_graph_agent_node)
geo_workflow.add_node("geo_optimization", geo_optimization_agent_node)
geo_workflow.add_node("geo_reporting", geo_reporting_agent_node)

geo_workflow.set_entry_point("geo_entity_agent")
geo_workflow.add_edge("geo_entity_agent", "geo_citation_agent")
geo_workflow.add_edge("geo_citation_agent", "geo_prompt_visibility")
geo_workflow.add_edge("geo_prompt_visibility", "geo_llm_ranking")
geo_workflow.add_edge("geo_llm_ranking", "geo_authority")
geo_workflow.add_edge("geo_authority", "geo_knowledge_graph")
geo_workflow.add_edge("geo_knowledge_graph", "geo_optimization")
geo_workflow.add_edge("geo_optimization", "geo_reporting")
geo_workflow.add_edge("geo_reporting", END)

geo_graph = geo_workflow.compile()

geo_publish_workflow = StateGraph(SEOState)
geo_publish_workflow.add_node("geo_publishing_agent", geo_publishing_agent_node)
geo_publish_workflow.add_node("geo_reporting_final_agent", geo_reporting_final_agent_node)
geo_publish_workflow.set_entry_point("geo_publishing_agent")
geo_publish_workflow.add_edge("geo_publishing_agent", "geo_reporting_final_agent")
geo_publish_workflow.add_edge("geo_reporting_final_agent", END)
geo_publish_graph = geo_publish_workflow.compile()

async def run_geo_pipeline(workspace_id: int, target_url: str):
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
    target_url = normalize_target_url(target_url)
    initial_state = {
        "workspace_id": workspace_id,
        "target_url": target_url,
        "logs": [],
        "current_node": "init",
        "status": "queued",
        "audit_score": 0,
        "crawl_data": {},
        "keyword_clusters": {},
        "content_gaps": [],
        "internal_links": [],
        "backlink_strategy": {},
        "schema_markup": {},
        "report": ""
    }
    await manager.broadcast_agent_log("GEO Agent", "Initializing Generative Engine Optimization pipeline...", "queued")
    from core.agent_status import record_agent_task
    import datetime as _dt
    start_time = _dt.datetime.utcnow()
    record_agent_task(workspace_id, "GEO", "RUNNING", f"GEO audit for {target_url}", reset=True, target_url=target_url)

    # GEO read no connected account at all before this. Search Console is as relevant here as
    # it is to SEO — the queries a brand already wins are the questions an answer engine is
    # being asked in its own words, and the Prompt Visibility probe uses them as its starting
    # point rather than inventing a category from the domain name.
    from core.seo_connections import gather, summary_line
    initial_state["connections"] = await gather(workspace_id, target_url)
    intro = summary_line(initial_state["connections"])
    initial_state["logs"].append(intro)
    await manager.broadcast_agent_log("GEO Agent", intro, "running")

    # Same single gather as the SEO pipeline — see run_seo_pipeline. It matters more here:
    # every GEO probe asks a model what it knows about this brand, and the brand's own
    # positioning and audience are what those answers should be judged against.
    from core.brand_context import get_brand_context
    initial_state["brand"] = await asyncio.to_thread(
        get_brand_context, workspace_id, f"brand positioning and audience for {target_url}"
    )

    try:
        result = await geo_graph.ainvoke(initial_state)
        duration = (_dt.datetime.utcnow() - start_time).total_seconds()
        _persist_audit(workspace_id, "GEO", target_url, result, duration_seconds=duration)
        record_agent_task(workspace_id, "GEO", "COMPLETED", f"GEO audit complete for {target_url}")
    except asyncio.CancelledError:
        record_agent_task(workspace_id, "GEO", "CANCELLED", "Audit cancelled.")
        raise
    except Exception as e:
        record_agent_task(workspace_id, "GEO", "FAILED", str(e)[:120])
        raise
    await manager.broadcast_node_update("geo_pipeline", "Awaiting Approval", "completed")
    return result

async def run_geo_publish_pipeline(workspace_id: int):
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
    initial_state = {
        "workspace_id": workspace_id,
        "target_url": "approved_url",
        "logs": [],
        "current_node": "Publishing Agent",
        "status": "approved",
        "audit_score": 90,
        "crawl_data": {},
        "keyword_clusters": {},
        "content_gaps": [],
        "internal_links": [],
        "backlink_strategy": {},
        "schema_markup": {},
        "report": ""
    }
    await manager.broadcast_agent_log("GEO Agent", "Human approval received. Commencing GEO deployment.", "running")
    result = await geo_publish_graph.ainvoke(initial_state)
    await manager.broadcast_node_update("geo_pipeline", "Pipeline", "completed")
    return result
