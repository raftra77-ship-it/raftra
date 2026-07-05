import asyncio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from core.websocket import manager

class CampaignState(TypedDict):
    workspace_id: int
    platform: str
    campaign_name: str
    objective: str
    budget: float
    logs: List[str]
    current_node: str
    status: str

async def account_connection_node(state: CampaignState) -> CampaignState:
    state["current_node"] = "Account Connection"
    msg = f"Connecting to sandbox credentials for platform {state['platform']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Performance Marketer", msg, "running")
    await manager.broadcast_node_update("campaign_manager", "Account Connection", "running")
    await asyncio.sleep(1.0)
    return state

async def campaign_planning_node(state: CampaignState) -> CampaignState:
    state["current_node"] = "Campaign Planning"
    msg = f"Structuring ad groups with target objective: {state['objective']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Performance Marketer", msg, "thinking")
    await manager.broadcast_node_update("campaign_manager", "Campaign Planning", "running")
    await asyncio.sleep(1.0)
    return state

async def audience_research_node(state: CampaignState) -> CampaignState:
    state["current_node"] = "Audience Research"
    msg = "Analyzing high-intent keywords and matching demographics..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Performance Marketer", msg, "running")
    await manager.broadcast_node_update("campaign_manager", "Audience Research", "running")
    await asyncio.sleep(1.0)
    return state

async def budget_optimization_node(state: CampaignState) -> CampaignState:
    state["current_node"] = "Budget Optimization"
    msg = f"Calculating optimal bid rules with total budget cap: ${state['budget']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Performance Marketer", msg, "running")
    await manager.broadcast_node_update("campaign_manager", "Budget Optimization", "running")
    await asyncio.sleep(1.0)
    return state

async def creative_assignment_node(state: CampaignState) -> CampaignState:
    state["current_node"] = "Creative Assignment"
    msg = "Linking generated copywriting templates to active campaigns..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Performance Marketer", msg, "running")
    await manager.broadcast_node_update("campaign_manager", "Creative Assignment", "running")
    await asyncio.sleep(1.0)
    return state

async def human_approval_node(state: CampaignState) -> CampaignState:
    state["current_node"] = "Human Approval"
    msg = "Awaiting verification checkpoints check..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Performance Marketer", msg, "completed")
    await manager.broadcast_node_update("campaign_manager", "Human Approval", "completed")
    state["status"] = "completed"
    return state

workflow = StateGraph(CampaignState)

workflow.add_node("account_connection", account_connection_node)
workflow.add_node("campaign_planning", campaign_planning_node)
workflow.add_node("audience_research", audience_research_node)
workflow.add_node("budget_optimization", budget_optimization_node)
workflow.add_node("creative_assignment", creative_assignment_node)
workflow.add_node("human_approval", human_approval_node)

workflow.set_entry_point("account_connection")
workflow.add_edge("account_connection", "campaign_planning")
workflow.add_edge("campaign_planning", "audience_research")
workflow.add_edge("audience_research", "budget_optimization")
workflow.add_edge("budget_optimization", "creative_assignment")
workflow.add_edge("creative_assignment", "human_approval")
workflow.add_edge("human_approval", END)

campaign_graph = workflow.compile()

async def run_campaign_pipeline(workspace_id: int, platform: str, campaign_name: str, objective: str, budget: float):
    initial_state = {
        "workspace_id": workspace_id,
        "platform": platform,
        "campaign_name": campaign_name,
        "objective": objective,
        "budget": budget,
        "logs": [],
        "current_node": "init",
        "status": "queued"
    }
    await manager.broadcast_agent_log("Performance Marketer", "Initializing Campaign Manager pipeline...", "queued")
    result = await campaign_graph.ainvoke(initial_state)
    return result
