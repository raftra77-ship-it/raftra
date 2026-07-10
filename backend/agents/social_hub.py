import asyncio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
import os
from core.websocket import manager
from core.providers.llm_providers import GeminiProvider

class SocialState(TypedDict):
    workspace_id: int
    platform: str
    caption_topic: str
    logs: List[str]
    current_node: str
    status: str
    generated_post: str

async def social_planner_node(state: SocialState) -> SocialState:
    state["current_node"] = "Content Planner"
    msg = f"Planning post sequence matching topic: {state['caption_topic']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Social Agent", msg, "running")
    await manager.broadcast_node_update("social_hub", "Content Planner", "running")
    await asyncio.sleep(1.0)
    return state

async def caption_agent_node(state: SocialState) -> SocialState:
    state["current_node"] = "Caption Agent"
    msg = f"Drafting engaging caption matching brand voice for channel {state['platform']} using LLM..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Social Agent", msg, "thinking")
    await manager.broadcast_node_update("social_hub", "Caption Agent", "running")
    
    try:
        with open("prompts/social-media-manager.md", "r", encoding="utf-8") as f:
            system_prompt = f.read()
    except Exception:
        system_prompt = "You are an expert Social Media Manager."

    prompt = f"Platform: {state['platform']}\nTopic/Instruction: {state['caption_topic']}\nPlease write a highly engaging social media post based on this."
    
    try:
        llm = GeminiProvider()
        response = await llm.generate_text(prompt=prompt, system_prompt=system_prompt)
        state["generated_post"] = response.strip()
    except Exception as e:
        print(f"LLM Error in social_hub: {e}")
        state["generated_post"] = f"{state['caption_topic']}. Consolidating 20 marketing nodes into one with Raftra Growth OS. #GrowthOps"
        
    return state

async def scheduler_node(state: SocialState) -> SocialState:
    state["current_node"] = "Scheduler"
    msg = "Setting publish schedules to active queue buffers..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Social Agent", msg, "completed")
    await manager.broadcast_node_update("social_hub", "Scheduler", "completed")
    state["status"] = "completed"
    return state

workflow = StateGraph(SocialState)

workflow.add_node("planner", social_planner_node)
workflow.add_node("caption", caption_agent_node)
workflow.add_node("scheduler", scheduler_node)

workflow.set_entry_point("planner")
workflow.add_edge("planner", "caption")
workflow.add_edge("caption", "scheduler")
workflow.add_edge("scheduler", END)

social_graph = workflow.compile()

async def run_social_pipeline(workspace_id: int, platform: str, caption_topic: str):
    initial_state = {
        "workspace_id": workspace_id,
        "platform": platform,
        "caption_topic": caption_topic,
        "logs": [],
        "current_node": "init",
        "status": "queued",
        "generated_post": ""
    }
    await manager.broadcast_agent_log("Social Agent", "Initializing Social Hub pipeline...", "queued")
    result = await social_graph.ainvoke(initial_state)
    return result
