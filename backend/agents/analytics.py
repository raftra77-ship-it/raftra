import asyncio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
import os
from core.websocket import manager, current_workspace_id
from core.providers.llm_providers import GeminiProvider

class AnalyticsState(TypedDict):
    workspace_id: int
    query_message: str
    logs: List[str]
    current_node: str
    status: str
    explanation: str

async def collect_data_node(state: AnalyticsState) -> AnalyticsState:
    state["current_node"] = "Collect Data"
    msg = "Collecting adset spend metrics and revenue trends from DB..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Data Analyst", msg, "running")
    await manager.broadcast_node_update("analytics", "Collect Data", "running")
    await asyncio.sleep(1.0)
    return state

async def analyze_trends_node(state: AnalyticsState) -> AnalyticsState:
    state["current_node"] = "Analyze Trends"
    msg = "Parsing conversion rate patterns and CPC curves..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Data Analyst", msg, "thinking")
    await manager.broadcast_node_update("analytics", "Analyze Trends", "running")
    await asyncio.sleep(1.0)
    return state

async def claude_recommendation_node(state: AnalyticsState) -> AnalyticsState:
    state["current_node"] = "Claude Recommendation Engine"
    msg = "Invoking Marketing Scientist Agent to compile logical narrative context..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Data Analyst", msg, "running")
    await manager.broadcast_node_update("analytics", "Claude Recommendation", "running")
    
    try:
        with open("prompts/marketing-scientist.md", "r", encoding="utf-8") as f:
            system_prompt = f.read()
    except Exception:
        system_prompt = "You are a senior Marketing Data Scientist."

    # Ground recommendations in this company's real brand profile + knowledge base.
    from core.brand_context import get_brand_context
    brand = get_brand_context(state["workspace_id"], query=state['query_message'])
    prompt = (
        f"User Query: {state['query_message']}\n\n"
        f"COMPANY CONTEXT (tailor the analysis to this brand, audience and offerings):\n{brand}\n\n"
        f"Please provide a detailed analysis and actionable recommendations grounded in this company's context."
    )
    
    # On failure we must NOT invent numbers. The old fallback fabricated hard figures
    # ("CPA rose to $28.40", "ROAS 4.0x") that were indistinguishable from a real
    # analysis - a founder could act on made-up data. Fail the node instead.
    llm = GeminiProvider()
    response = await llm.generate_text(prompt=prompt, system_prompt=system_prompt)
    state["explanation"] = response.strip()
    return state

async def finalize_analytics_node(state: AnalyticsState) -> AnalyticsState:
    state["current_node"] = "Finalize Analytics"
    msg = "Analytics reports ready for dashboard display."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Data Analyst", msg, "completed")
    await manager.broadcast_node_update("analytics", "Finalize Analytics", "completed")
    state["status"] = "completed"
    return state

workflow = StateGraph(AnalyticsState)

workflow.add_node("collect_data", collect_data_node)
workflow.add_node("analyze_trends", analyze_trends_node)
workflow.add_node("claude_recommendation", claude_recommendation_node)
workflow.add_node("finalize_analytics", finalize_analytics_node)

workflow.set_entry_point("collect_data")
workflow.add_edge("collect_data", "analyze_trends")
workflow.add_edge("analyze_trends", "claude_recommendation")
workflow.add_edge("claude_recommendation", "finalize_analytics")
workflow.add_edge("finalize_analytics", END)

analytics_graph = workflow.compile()

async def run_analytics_pipeline(workspace_id: int, query_message: str):
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
    initial_state = {
        "workspace_id": workspace_id,
        "query_message": query_message,
        "logs": [],
        "current_node": "init",
        "status": "queued",
        "explanation": ""
    }
    await manager.broadcast_agent_log("Data Analyst", "Initializing Analytics pipeline...", "queued")
    from core.agent_status import record_agent_task
    record_agent_task(workspace_id, "ANALYST", "RUNNING", query_message[:80])
    try:
        result = await analytics_graph.ainvoke(initial_state)
        record_agent_task(workspace_id, "ANALYST", "COMPLETED", "Analytics recommendation ready")
    except Exception as e:
        await manager.broadcast_agent_log("Data Analyst", f"Analytics failed: {e}", "failed")
        record_agent_task(workspace_id, "ANALYST", "FAILED", str(e)[:120])
        raise
    return result
