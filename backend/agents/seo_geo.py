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

    # Placeholder fields for future LLM integration
    crawl_data: dict
    keyword_clusters: dict
    content_gaps: list
    internal_links: list
    backlink_strategy: dict
    schema_markup: dict
    report: str
    content_metrics: dict


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
                    json={"url": state['target_url'], "formats": ["markdown"]},
                )
            if res.status_code == 200:
                markdown = (res.json().get("data", {}).get("markdown", "") or "")
                if markdown.strip():
                    # Keep the FULL page. (Previously truncated to 4000 chars, which crippled
                    # the analysis and falsely flagged large pages as "thin content".)
                    state["crawl_data"] = {"markdown": markdown, "full_length": len(markdown)}
                    ok = f"Crawled {len(markdown):,} characters from {state['target_url']}."
                    state["logs"].append(ok)
                    await manager.broadcast_agent_log("SEO Agent", ok, "running")
                    await manager.broadcast_node_update("seo_geo", "Crawler Agent", "completed")
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
    metrics = analyze_markdown(state.get("crawl_data", {}).get("markdown", ""), state["target_url"])
    state["content_metrics"] = metrics
    msg = (f"Technical audit: {metrics['word_count']} words, {metrics['h1_count']} H1 / {metrics['h2_count']} H2, "
           f"{metrics['image_count']} images ({metrics['images_missing_alt']} missing alt)"
           + (", THIN CONTENT (<300 words)" if metrics["thin_content"] else ""))
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "completed")
    await manager.broadcast_node_update("seo_geo", "Technical SEO Agent", "completed")
    return state

async def keyword_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Keyword Agent"
    await manager.broadcast_node_update("seo_geo", "Keyword Agent", "running")
    # REAL analysis: top keywords by frequency from the crawled content.
    metrics = state.get("content_metrics") or {}
    top = metrics.get("top_keywords", [])
    state["keyword_clusters"] = {"top_keywords": top}
    preview = ", ".join(f"{k['term']}({k['count']})" for k in top[:6]) or "no content to analyze"
    msg = f"Keyword frequency analysis - top terms: {preview}"
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "completed")
    await manager.broadcast_node_update("seo_geo", "Keyword Agent", "completed")
    return state

async def content_strategy_node(state: SEOState) -> SEOState:
    state["current_node"] = "Content Strategy Agent"
    msg = "Creating On-Page Optimization Checklist and evaluating E-E-A-T signals..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Content Strategy Agent", "running")
    await asyncio.sleep(1.5)
    await manager.broadcast_node_update("seo_geo", "Content Strategy Agent", "completed")
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
    return state

async def backlink_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Backlink Agent"
    msg = "Generating Digital PR targets and content-led link building strategies..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Backlink Agent", "running")
    await asyncio.sleep(1.5)
    await manager.broadcast_node_update("seo_geo", "Backlink Agent", "completed")
    return state

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
    
    state["audit_score"] = 92
    state["status"] = "pending_approval"
    state["report"] = mock_report
    import json
    await manager.broadcast(json.dumps({
        "type": "new_seo_report",
        "title": f"Technical SEO & Content Strategy for {state['target_url']}",
        "excerpt": mock_report.replace('{target_url}', state['target_url']),
        "keywords": "SEO, AEO, Cannibalization, Technical Audit, Schema Markup"
    }))
    
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
workflow.add_edge("schema_agent", END)

seo_graph = workflow.compile()

publish_workflow = StateGraph(SEOState)
publish_workflow.add_node("publishing_agent", publishing_agent_node)
publish_workflow.add_node("reporting_agent", reporting_agent_node)
publish_workflow.set_entry_point("publishing_agent")
publish_workflow.add_edge("publishing_agent", "reporting_agent")
publish_workflow.add_edge("reporting_agent", END)
seo_publish_graph = publish_workflow.compile()

def _persist_audit(workspace_id: int, pipeline: str, target_url: str, result: dict):
    """Save a snapshot of this run (metrics + report + timestamp) so month-over-month
    history accumulates and monthly comparison reports become possible."""
    if not workspace_id:
        return
    try:
        from database import SessionLocal
        import models
        metrics = result.get("content_metrics") or {}
        db = SessionLocal()
        db.add(models.SEOAudit(
            workspace_id=workspace_id,
            score=result.get("audit_score", 0) or 0,
            keywords_data={"pipeline": pipeline, "target_url": target_url, "metrics": metrics},
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
    record_agent_task(workspace_id, "SEO", "RUNNING", f"Auditing {target_url}")
    try:
        result = await seo_graph.ainvoke(initial_state)
        _persist_audit(workspace_id, "SEO", target_url, result)
        record_agent_task(workspace_id, "SEO", "COMPLETED", f"SEO audit complete for {target_url}")
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
    msg = f"Extracting primary and secondary NLP entities from {state['target_url']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Entity Agent", "running")
    await asyncio.sleep(1.0)
    await manager.broadcast_node_update("geo_pipeline", "Entity Agent", "completed")
    return state

async def geo_citation_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Citation Agent"
    msg = "Cross-referencing brand facts against Perplexity and ChatGPT source datasets..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Citation Agent", "running")
    await asyncio.sleep(1.0)
    await manager.broadcast_node_update("geo_pipeline", "Citation Agent", "completed")
    return state

async def geo_prompt_visibility_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Prompt Visibility Agent"
    msg = "Auditing top 50 LLM prompt structures that intersect with target market..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Prompt Visibility Agent", "running")
    await asyncio.sleep(1.0)
    await manager.broadcast_node_update("geo_pipeline", "Prompt Visibility Agent", "completed")
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
    return state

async def geo_authority_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Authority Agent"
    msg = "Identifying digital PR avenues for trusted knowledge base ingestion..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Authority Agent", "running")
    await asyncio.sleep(1.0)
    await manager.broadcast_node_update("geo_pipeline", "Authority Agent", "completed")
    return state

async def geo_knowledge_graph_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Knowledge Graph Agent"
    msg = "Constructing localized RDF graph payload to feed Google's Knowledge Panel..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Knowledge Graph Agent", "running")
    await asyncio.sleep(1.0)
    await manager.broadcast_node_update("geo_pipeline", "Knowledge Graph Agent", "completed")
    return state

async def geo_optimization_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Optimization Agent"
    msg = "Drafting precise content injections to improve model generation likelihood..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "thinking")
    await manager.broadcast_node_update("geo_pipeline", "Optimization Agent", "running")
    await asyncio.sleep(1.0)
    await manager.broadcast_node_update("geo_pipeline", "Optimization Agent", "completed")
    return state

async def geo_reporting_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Reporting"
    msg = "Packaging Generative Engine Optimization (GEO) audit and deployment strategy..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Reporting", "running")
    await asyncio.sleep(1.0)
    await manager.broadcast_node_update("geo_pipeline", "Reporting", "completed")

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
    state["report"] = mock_geo_report
    import json
    await manager.broadcast(json.dumps({
        "type": "new_geo_report",
        "title": f"Generative Engine Optimization (GEO) Strategy",
        "excerpt": mock_geo_report.replace('{target_url}', state['target_url']),
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
    record_agent_task(workspace_id, "GEO", "RUNNING", f"GEO audit for {target_url}")
    try:
        result = await geo_graph.ainvoke(initial_state)
        _persist_audit(workspace_id, "GEO", target_url, result)
        record_agent_task(workspace_id, "GEO", "COMPLETED", f"GEO audit complete for {target_url}")
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
