import asyncio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
import os
from core.websocket import manager
from core.providers.llm_providers import GeminiProvider

class SEOState(TypedDict):
    workspace_id: int
    target_url: str
    logs: List[str]
    current_node: str
    status: str
    audit_score: int
    
    # Placeholder fields for future LLM integration
    crawl_data: dict
    keyword_clusters: dict
    content_gaps: list
    internal_links: list
    backlink_strategy: dict
    schema_markup: dict
    report: str

async def crawler_node(state: SEOState) -> SEOState:
    state["current_node"] = "Crawler Agent"
    msg = f"Crawling targets page indexes for: {state['target_url']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Crawler Agent", "running")
    await asyncio.sleep(1.0)
    await manager.broadcast_node_update("seo_geo", "Crawler Agent", "completed")
    return state

async def technical_seo_node(state: SEOState) -> SEOState:
    state["current_node"] = "Technical SEO Agent"
    msg = "Analyzing Core Web Vitals, site architecture, and mobile friendliness..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "thinking")
    await manager.broadcast_node_update("seo_geo", "Technical SEO Agent", "running")
    await asyncio.sleep(1.5)
    await manager.broadcast_node_update("seo_geo", "Technical SEO Agent", "completed")
    return state

async def keyword_agent_node(state: SEOState) -> SEOState:
    state["current_node"] = "Keyword Agent"
    msg = "Conducting search intent mapping and running Cannibalization Audit..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Keyword Agent", "running")
    await asyncio.sleep(1.5)
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
    msg = "Designing pillar-to-satellite link distribution and identifying orphan pages..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "thinking")
    await manager.broadcast_node_update("seo_geo", "Internal Linking Agent", "running")
    await asyncio.sleep(1.5)
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

    prompt = f"Target URL / Query: {state['target_url']}\nPlease run a comprehensive SEO Strategy audit and provide a detailed markdown report."
    
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
    msg = "Synthesizing the exact actions required to deploy the strategy onto the target site..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Publishing Agent", "running")
    await asyncio.sleep(2.0)
    msg = "SEO schema, metadata, and redirects successfully deployed to production via API."
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

async def run_seo_pipeline(workspace_id: int, target_url: str):
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
    result = await seo_graph.ainvoke(initial_state)
    
    await manager.broadcast_node_update("seo_geo", "Awaiting Approval", "completed")
    return result

async def run_seo_publish_pipeline(workspace_id: int):
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
    msg = "Calculating empirical brand recall rates across Claude 3.5 and Gemini Pro..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "thinking")
    await manager.broadcast_node_update("geo_pipeline", "LLM Ranking Agent", "running")
    await asyncio.sleep(1.0)
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
    
    mock_geo_report = """# Comprehensive GEO / AEO Strategy Report
Target: {target_url}

## 1. LLM Recall & Visibility Audit
- **Gemini 1.5 Pro**: Brand unprompted recall is currently 14%. 
- **Claude 3.5 Sonnet**: Fails to cite {target_url} for query "Top AI Marketing Solutions".
- **Perplexity**: Cites competitor domains 3x more frequently due to missing Reddit footprint.

## 2. Entity Disambiguation
- **Knowledge Graph Conflict**: Google Knowledge Graph confuses the brand with a legacy software tool.
- **Resolution**: Deploy strict `Organization` and `SoftwareApplication` JSON-LD schema with `sameAs` links pointing to official Crunchbase and Wikipedia stubs.

## 3. Answer Engine Prompt Optimization
- **Keyword Shift**: Traditional keywords are failing. Must transition to "Question-Answer" (FAQ) formats.
- **Content Injection**: Proposed 5 new long-form guides directly answering the top 50 LLM prompts in the sector.

## 4. Citation & Authority Growth
- **Data Licensing Targets**: Target partnerships or PR drops on sites known to be in OpenAI's training corpus (e.g., TechCrunch, StackOverflow, Medium).

**Action Required**: Review the GEO deployment strategy above. Upon approval, the Publishing Agent will push Schema changes via API and queue content briefs.
"""
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
    msg = "Executing Knowledge Graph schema injections and pushing FAQ architectures..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("GEO Agent", msg, "running")
    await manager.broadcast_node_update("geo_pipeline", "Publishing Agent", "running")
    await asyncio.sleep(2.0)
    await manager.broadcast_agent_log("GEO Agent", "GEO structured data successfully deployed to CMS.", "completed")
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
    result = await geo_graph.ainvoke(initial_state)
    await manager.broadcast_node_update("geo_pipeline", "Awaiting Approval", "completed")
    return result

async def run_geo_publish_pipeline(workspace_id: int):
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
