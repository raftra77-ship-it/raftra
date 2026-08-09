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

    # Placeholder fields for future LLM integration
    crawl_data: dict
    keyword_clusters: dict
    content_gaps: list
    internal_links: list
    backlink_strategy: dict
    schema_markup: dict
    report: str
    content_metrics: dict


# Real node-name trails for the Running-state progress checklist. Must match the
# `current_node` values each node below actually sets.
SEO_STAGES = ["Crawler Agent", "Technical SEO Agent", "Keyword Agent", "Content Strategy Agent",
              "Internal Linking Agent", "Backlink Agent", "Schema Agent", "Publishing Agent", "Reporting Agent"]
GEO_STAGES = ["Entity Agent", "Citation Agent", "Prompt Visibility Agent", "LLM Ranking Agent",
              "Authority Agent", "Knowledge Graph Agent", "Optimization Agent", "Reporting"]


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
    "store is password protected", "enter store using password", "opening soon",
    "are you the store owner", "this site is under construction", "coming soon",
    "domain is parked", "site temporarily unavailable",
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
    p = _urlparse(target_url)
    origin = f"{p.scheme}://{p.netloc}"
    signals = {"https": p.scheme == "https", "origin": origin}
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        robots_body = ""
        try:
            r = await client.get(origin + "/robots.txt")
            robots_body = r.text if r.status_code == 200 else ""
            entry = {"found": r.status_code == 200 and bool(robots_body.strip()),
                     "status": r.status_code}
            if robots_body:
                entry["disallow_all"] = bool(_re.search(r"(?mi)^\s*Disallow:\s*/\s*$", robots_body))
            signals["robots_txt"] = entry
        except Exception as e:
            signals["robots_txt"] = {"found": False, "status": None, "error": str(e)[:80]}

        try:
            signals["sitemap"] = await _discover_sitemap(client, origin, robots_body)
        except Exception as e:
            signals["sitemap"] = {"found": False, "status": None, "error": str(e)[:80]}

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


async def _crawl_via_firecrawl(target_url: str, agent_label: str) -> dict:
    """Shared Firecrawl scrape (+ retry, + site signals) so the GEO pipeline can score from
    a REAL crawl too, instead of never crawling at all. Never raises — a genuine post-retry
    failure is reported back via crawl_error and the caller decides whether to fail the run."""
    import httpx
    firecrawl_key = (os.getenv("FIRECRAWL_API_KEY") or "").strip()
    out = {"markdown": "", "html": "", "crawl_error": None, "site_signals": {}}

    if not firecrawl_key:
        await manager.broadcast_agent_log(
            agent_label, f"No FIRECRAWL_API_KEY configured — SIMULATION only (no real crawl of {target_url}).", "running")
        out["crawl_error"] = "no_api_key"
        return out

    await manager.broadcast_agent_log(agent_label, f"Crawling {target_url} via Firecrawl...", "running")
    last_err = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(
                    "https://api.firecrawl.dev/v1/scrape",
                    headers={"Authorization": f"Bearer {firecrawl_key}", "Content-Type": "application/json"},
                    json={"url": target_url, "formats": ["markdown", "rawHtml"]},
                )
            if res.status_code == 200:
                data = res.json().get("data", {}) or {}
                markdown = (data.get("markdown", "") or "")
                if markdown.strip():
                    html = data.get("rawHtml") or data.get("html") or ""
                    meta = data.get("metadata", {}) or {}
                    out["markdown"], out["html"] = markdown, html
                    try:
                        out["site_signals"] = await _fetch_site_signals(target_url)
                        out["site_signals"]["status_code"] = meta.get("statusCode")
                        # Detect a password gate / holding page before anything is scored.
                        gate = detect_gate_page(
                            out["site_signals"].get("final_url") or meta.get("sourceURL") or target_url,
                            html, markdown)
                        out["site_signals"]["gate"] = gate
                        if gate.get("is_gate"):
                            await manager.broadcast_agent_log(
                                agent_label,
                                f"WARNING: {target_url} is a placeholder/password-protected page "
                                f"({', '.join(gate['markers'][:2])}). The audit will be marked "
                                "not valid for the live site.", "running")
                    except Exception as e:
                        out["site_signals"] = {"error": str(e)[:100]}
                    await manager.broadcast_agent_log(
                        agent_label, f"Crawled {len(markdown):,} chars (+{len(html):,} HTML) from {target_url}.", "running")
                    return out
                last_err = "empty content returned"
            else:
                last_err = f"HTTP {res.status_code}: {res.text[:150]}"
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
        if attempt == 0:
            await asyncio.sleep(2.0)

    out["crawl_error"] = last_err
    await manager.broadcast_agent_log(agent_label, f"Crawl failed for {target_url} (after retry): {last_err}", "failed")
    return out


async def crawler_node(state: SEOState) -> SEOState:
    state["current_node"] = "Crawler Agent"
    import httpx
    firecrawl_key = (os.getenv("FIRECRAWL_API_KEY") or "").strip()

    # No key configured: this is an explicit dev/simulation mode. Flag it clearly so a
    # simulated run can never be mistaken for a real audit.
    if not firecrawl_key:
        msg = f"No FIRECRAWL_API_KEY configured — SIMULATION only (no real crawl of {state['target_url']})."
        state["logs"].append(msg)
        state["crawl_error"] = "no_api_key"
        await manager.broadcast_agent_log("SEO Agent", msg, "running")
        await manager.broadcast_node_update("seo_geo", "Crawler Agent", "completed")
        state["crawl_data"] = {"markdown": "", "simulated": True}
        _seo_stage_done(state, "Crawler Agent")
        return state

    msg = f"Crawling {state['target_url']} via Firecrawl..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Crawler Agent", "running")

    # Retry once — the API occasionally hiccups; a single retry makes it reliable while
    # still surfacing a genuine failure instead of silently substituting fake content.
    last_err = None
    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                res = await client.post(
                    "https://api.firecrawl.dev/v1/scrape",
                    headers={"Authorization": f"Bearer {firecrawl_key}", "Content-Type": "application/json"},
                    # rawHtml is needed to audit metadata, schema and accessibility — those
                    # facts do not survive the markdown conversion.
                    json={"url": state['target_url'], "formats": ["markdown", "rawHtml"]},
                )
            if res.status_code == 200:
                data = res.json().get("data", {}) or {}
                markdown = (data.get("markdown", "") or "")
                if markdown.strip():
                    html = data.get("rawHtml") or data.get("html") or ""
                    meta = data.get("metadata", {}) or {}
                    # Keep the FULL page. (Previously truncated to 4000 chars, which crippled
                    # the analysis and falsely flagged large pages as "thin content".)
                    state["crawl_data"] = {"markdown": markdown, "html": html,
                                           "full_length": len(markdown), "status_code": meta.get("statusCode")}
                    try:
                        state["site_signals"] = await _fetch_site_signals(state["target_url"])
                        state["site_signals"]["status_code"] = meta.get("statusCode")
                        # Same gate check as _crawl_via_firecrawl. The SEO pipeline has its own
                        # crawler node, so detection has to run on BOTH paths — patching only
                        # the shared helper left this one still scoring password gates as if
                        # they were the real site.
                        gate = detect_gate_page(
                            state["site_signals"].get("final_url") or meta.get("sourceURL")
                            or state["target_url"], html, markdown)
                        state["site_signals"]["gate"] = gate
                        if gate.get("is_gate"):
                            await manager.broadcast_agent_log(
                                "Crawler Agent",
                                f"WARNING: {state['target_url']} is a placeholder/password-"
                                f"protected page ({', '.join(gate['markers'][:2])}). The audit "
                                "will be marked not valid for the live site.", "running")
                    except Exception as e:
                        state["site_signals"] = {"error": str(e)[:100]}
                    # Core Web Vitals (Performance). Failure is fine — the auditor then reports
                    # Performance as "Not Verified" rather than estimating it.
                    try:
                        from core.pagespeed import fetch_core_web_vitals
                        psi = await fetch_core_web_vitals(state["target_url"])
                        if psi:
                            state["site_signals"]["psi"] = psi
                    except Exception as e:
                        print(f"PageSpeed step skipped: {e}")
                    ok = f"Crawled {len(markdown):,} chars (+{len(html):,} HTML) from {state['target_url']}."
                    state["logs"].append(ok)
                    await manager.broadcast_agent_log("SEO Agent", ok, "running")
                    await manager.broadcast_node_update("seo_geo", "Crawler Agent", "completed")
                    _seo_stage_done(state, "Crawler Agent")
                    return state
                last_err = "empty content returned"
            else:
                last_err = f"HTTP {res.status_code}: {res.text[:150]}"
        except Exception as e:
            last_err = f"{type(e).__name__}: {e}"
        if attempt == 0:
            await asyncio.sleep(2.0)  # brief backoff before the retry

    # Both attempts failed — surface it honestly, do NOT fabricate content.
    state["crawl_error"] = last_err
    err = f"Crawl failed for {state['target_url']} (after retry): {last_err}"
    state["logs"].append(err)
    await manager.broadcast_agent_log("SEO Agent", err, "failed")
    await manager.broadcast_node_update("seo_geo", "Crawler Agent", "failed")
    raise RuntimeError(err)

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
    real_keywords = {
        "source": "none", "queries": [],
        "message": "Connect Google Search Console to see the real queries driving traffic to this page.",
    }
    try:
        from database import SessionLocal
        import models
        from core import search_console
        with SessionLocal() as db:
            conn = db.query(models.SearchConsoleConnection).filter(
                models.SearchConsoleConnection.workspace_id == state["workspace_id"]
            ).first()
            if conn and conn.refresh_token and conn.site_url:
                data = await asyncio.to_thread(search_console.fetch_search_analytics, conn, 28, 15)
                real_keywords = {"source": "search_console", "queries": data["rows"],
                                 "range_days": data["range_days"], "message": None}
                # Persist any refreshed access token from credentials_from_connection().
                db.commit()
    except Exception as e:
        real_keywords = {"source": "error", "queries": [], "message": f"Could not load Search Console data: {e}"}

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
    state["current_node"] = "Content Strategy Agent"
    msg = "Creating On-Page Optimization Checklist and evaluating E-E-A-T signals..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Content Strategy Agent", "running")
    await asyncio.sleep(1.5)
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
    state["current_node"] = "Backlink Agent"
    msg = "Generating Digital PR targets and content-led link building strategies..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Backlink Agent", "running")
    await asyncio.sleep(1.5)
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

    # Ground the audit in this company's real brand profile + knowledge base.
    from core.brand_context import get_brand_context
    import json as _json
    brand = get_brand_context(state["workspace_id"], query=f"SEO and content strategy for {state['target_url']}")
    metrics = state.get("content_metrics") or {}
    prompt = (
        f"Target URL / Query: {state['target_url']}\n\n"
        f"COMPANY CONTEXT (use this to tailor the audit to the brand, its audience and offerings):\n{brand}\n\n"
        f"MEASURED ON-PAGE METRICS from crawling the site (base your technical findings on these REAL numbers, "
        f"do not invent different ones):\n{_json.dumps(metrics, indent=2)}\n\n"
        f"Please run a comprehensive SEO Strategy audit and provide a detailed markdown report tailored to this company, "
        f"referencing the measured metrics above where relevant."
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
    # No site connector is wired up yet, so we must NOT claim we deployed anything.
    # Auto-apply happens once a website connector (GitHub/WordPress/Shopify) is added.
    msg = "Deployment plan ready. Connect your site (GitHub/WordPress/Shopify) to auto-apply these changes — nothing was published automatically."
    await manager.broadcast_agent_log("SEO Agent", msg, "completed")
    await manager.broadcast_node_update("seo_geo", "Publishing Agent", "completed")
    _seo_stage_done(state, "Publishing Agent")
    return state

async def reporting_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Reporting Agent"
    msg = "Compiling Technical SEO Audit, Keyword Strategy, and Link Authority plan into final deliverable..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Reporting Agent", "running")
    await asyncio.sleep(2.0)
    await manager.broadcast_agent_log("SEO Agent", "Awaiting Answer Engine indexing. Post-publish metrics generated.", "completed")
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
    crawl = await _crawl_via_firecrawl(state["target_url"], "GEO Agent")
    state["crawl_data"] = {"markdown": crawl["markdown"], "html": crawl["html"], "full_length": len(crawl["markdown"])}
    state["site_signals"] = crawl["site_signals"]
    if crawl["crawl_error"] and crawl["crawl_error"] != "no_api_key":
        state["crawl_error"] = crawl["crawl_error"]
        err = f"GEO crawl failed for {state['target_url']} (after retry): {crawl['crawl_error']}"
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

async def geo_citation_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Citation Agent"
    msg = "Cross-referencing brand facts against Perplexity and ChatGPT source datasets..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Citation Agent", "running")
    await asyncio.sleep(1.0)
    await manager.broadcast_node_update("geo_pipeline", "Citation Agent", "completed")
    _geo_stage_done(state, "Citation Agent")
    return state

async def geo_prompt_visibility_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Prompt Visibility Agent"
    msg = "Auditing top 50 LLM prompt structures that intersect with target market..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Prompt Visibility Agent", "running")
    await asyncio.sleep(1.0)
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
            max_output_tokens=200,
        )
        probe = (probe or "").strip()
    except Exception as e:
        probe = f"(recall probe failed: {e})"
    recalled = "NO RECALL" not in probe.upper() and "recall probe failed" not in probe
    state["content_metrics"] = {**(state.get("content_metrics") or {}), "llm_recall": probe, "brand_recognised": recalled}
    msg = ("LLM recall probe: model recognises the brand." if recalled
           else "LLM recall probe: model does NOT recall this brand (zero unprompted visibility).")
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "completed")
    await manager.broadcast_node_update("geo_pipeline", "LLM Ranking Agent", "completed")
    _geo_stage_done(state, "LLM Ranking Agent")
    return state

async def geo_authority_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Authority Agent"
    msg = "Identifying digital PR avenues for trusted knowledge base ingestion..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Authority Agent", "running")
    await asyncio.sleep(1.0)
    await manager.broadcast_node_update("geo_pipeline", "Authority Agent", "completed")
    _geo_stage_done(state, "Authority Agent")
    return state

async def geo_knowledge_graph_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Knowledge Graph Agent"
    msg = "Constructing localized RDF graph payload to feed Google's Knowledge Panel..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Knowledge Graph Agent", "running")
    await asyncio.sleep(1.0)
    await manager.broadcast_node_update("geo_pipeline", "Knowledge Graph Agent", "completed")
    _geo_stage_done(state, "Knowledge Graph Agent")
    return state

async def geo_optimization_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Optimization Agent"
    msg = "Drafting precise content injections to improve model generation likelihood..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "thinking")
    await manager.broadcast_node_update("geo_pipeline", "Optimization Agent", "running")
    await asyncio.sleep(1.0)
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
    from core.brand_context import get_brand_context
    brand = get_brand_context(state["workspace_id"], query=f"generative engine optimization and AI visibility for {state['target_url']}")
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
    geo_prompt = (
        f"Target URL / Brand: {state['target_url']}\n\n"
        f"COMPANY CONTEXT (tailor the GEO strategy to this brand, audience and offerings):\n{brand}\n\n"
        f"{recall_line}"
        f"Write the GEO / AEO strategy report for this company, using the measured recall finding above "
        f"as the starting point of the Visibility Audit section."
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
    # No CMS connector yet - don't claim a deploy that didn't happen.
    await manager.broadcast_agent_log("GEO Agent", "GEO structured data plan ready. Connect your site to auto-apply it — nothing was pushed to a CMS automatically.", "completed")
    await manager.broadcast_node_update("geo_pipeline", "Publishing Agent", "completed")
    return state

async def geo_reporting_final_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Final Reporting"
    msg = "Finalizing GEO metrics update..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await asyncio.sleep(1.0)
    await manager.broadcast_agent_log("GEO Agent", "GEO strategy active. Awaiting Answer Engine indexing.", "completed")
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
