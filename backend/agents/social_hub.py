import asyncio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
import os
from core.websocket import manager, current_workspace_id
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

    # Ground the post in this company's real brand voice + knowledge base.
    from core.brand_context import get_brand_context
    brand = get_brand_context(state["workspace_id"], query=state['caption_topic'])
    prompt = (
        f"Platform: {state['platform']}\nTopic/Instruction: {state['caption_topic']}\n\n"
        f"COMPANY BRAND CONTEXT (match this voice, audience and messaging):\n{brand}\n\n"
        f"Please write a highly engaging social media post that fits this brand."
    )
    
    # Don't substitute a canned post on failure - it would be posted as if the AI
    # wrote it for this brand. Let the failure propagate so the run is marked failed.
    llm = GeminiProvider()
    response = await llm.generate_text(prompt=prompt, system_prompt=system_prompt)
    state["generated_post"] = response.strip()
    return state

async def scheduler_node(state: SocialState) -> SocialState:
    state["current_node"] = "Scheduler"
    # Persist the generated post as a draft instead of discarding it. It was
    # previously generated and thrown away; now it's saved for human review.
    # No social account is connected yet, so we save as 'draft', not 'published'.
    saved = False
    try:
        from database import SessionLocal
        import models
        with SessionLocal() as db:
            post = models.SocialPost(
                platform=(state.get("platform") or "").upper(),
                caption=state.get("generated_post", ""),
                status="draft",
                workspace_id=state["workspace_id"],
            )
            db.add(post)
            db.commit()
            saved = True
    except Exception as e:
        print(f"Failed to save SocialPost: {e}")

    msg = ("Post saved as a draft for review. Connect a social account to schedule or publish it."
           if saved else "Post generated (could not be saved as a draft).")
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
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
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
    from core.agent_status import record_agent_task
    record_agent_task(workspace_id, "SOCIAL", "RUNNING", f"{platform}: {caption_topic[:70]}")
    try:
        result = await social_graph.ainvoke(initial_state)
        record_agent_task(workspace_id, "SOCIAL", "COMPLETED", f"{platform} post generated")
    except Exception as e:
        await manager.broadcast_agent_log("Social Agent", f"Social post generation failed: {e}", "failed")
        record_agent_task(workspace_id, "SOCIAL", "FAILED", str(e)[:120])
        raise
    return result
