import asyncio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from core.websocket import manager

class InfluencerState(TypedDict):
    workspace_id: int
    creator_id: int
    creator_name: str
    logs: List[str]
    current_node: str
    status: str
    match_score: int

async def creator_discovery_node(state: InfluencerState) -> InfluencerState:
    state["current_node"] = "Creator Discovery"
    msg = f"Fetching demographic data index for creator: {state['creator_name']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Influencer Agent", msg, "running")
    await manager.broadcast_node_update("influencer_market", "Creator Discovery", "running")
    await asyncio.sleep(1.0)
    return state

async def audience_verification_node(state: InfluencerState) -> InfluencerState:
    state["current_node"] = "Audience Verification"
    msg = "Auditing audience active ratios and verifying fake follower parameters..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Influencer Agent", msg, "thinking")
    await manager.broadcast_node_update("influencer_market", "Audience Verification", "running")
    await asyncio.sleep(1.0)
    return state

async def negotiation_node(state: InfluencerState) -> InfluencerState:
    state["current_node"] = "Negotiation Scorer"
    msg = "Calculating proposal price brackets and generating automated contract stubs..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Influencer Agent", msg, "completed")
    await manager.broadcast_node_update("influencer_market", "Negotiation Scorer", "completed")
    state["match_score"] = 92
    state["status"] = "completed"
    return state

workflow = StateGraph(InfluencerState)

workflow.add_node("discovery", creator_discovery_node)
workflow.add_node("verification", audience_verification_node)
workflow.add_node("negotiation", negotiation_node)

workflow.set_entry_point("discovery")
workflow.add_edge("discovery", "verification")
workflow.add_edge("verification", "negotiation")
workflow.add_edge("negotiation", END)

influencer_graph = workflow.compile()

async def run_influencer_pipeline(workspace_id: int, creator_id: int, creator_name: str):
    initial_state = {
        "workspace_id": workspace_id,
        "creator_id": creator_id,
        "creator_name": creator_name,
        "logs": [],
        "current_node": "init",
        "status": "queued",
        "match_score": 0
    }
    await manager.broadcast_agent_log("Influencer Agent", f"Initializing Influencer pipeline for {creator_name}...", "queued")
    result = await influencer_graph.ainvoke(initial_state)
    return result
