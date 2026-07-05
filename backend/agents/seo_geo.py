import asyncio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from core.websocket import manager

class SEOState(TypedDict):
    workspace_id: int
    target_url: str
    logs: List[str]
    current_node: str
    status: str
    audit_score: int

async def crawler_node(state: SEOState) -> SEOState:
    state["current_node"] = "Crawler"
    msg = f"Crawling targets page indexes for: {state['target_url']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Crawler", "running")
    await asyncio.sleep(1.0)
    return state

async def keyword_intelligence_node(state: SEOState) -> SEOState:
    state["current_node"] = "Keyword Intelligence"
    msg = "Auditing organic query rankings and competitor gaps..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "thinking")
    await manager.broadcast_node_update("seo_geo", "Keyword Intelligence", "running")
    await asyncio.sleep(1.0)
    return state

async def entity_optimization_node(state: SEOState) -> SEOState:
    state["current_node"] = "Entity Optimization"
    msg = "Mapping semantic tags to boost LLM citations index..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "running")
    await manager.broadcast_node_update("seo_geo", "Entity Optimization", "running")
    await asyncio.sleep(1.0)
    return state

async def visibility_audit_node(state: SEOState) -> SEOState:
    state["current_node"] = "Visibility Audit"
    msg = "Evaluating visibility index across ChatGPT, Claude, and Gemini engines..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("SEO Agent", msg, "completed")
    await manager.broadcast_node_update("seo_geo", "Visibility Audit", "completed")
    state["audit_score"] = 84
    state["status"] = "completed"
    return state

workflow = StateGraph(SEOState)

workflow.add_node("crawler", crawler_node)
workflow.add_node("keyword_intelligence", keyword_intelligence_node)
workflow.add_node("entity_optimization", entity_optimization_node)
workflow.add_node("visibility_audit", visibility_audit_node)

workflow.set_entry_point("crawler")
workflow.add_edge("crawler", "keyword_intelligence")
workflow.add_edge("keyword_intelligence", "entity_optimization")
workflow.add_edge("entity_optimization", "visibility_audit")
workflow.add_edge("visibility_audit", END)

seo_graph = workflow.compile()

async def run_seo_pipeline(workspace_id: int, target_url: str):
    initial_state = {
        "workspace_id": workspace_id,
        "target_url": target_url,
        "logs": [],
        "current_node": "init",
        "status": "queued",
        "audit_score": 0
    }
    await manager.broadcast_agent_log("SEO Agent", "Initializing SEO + GEO pipeline...", "queued")
    result = await seo_graph.ainvoke(initial_state)
    return result
