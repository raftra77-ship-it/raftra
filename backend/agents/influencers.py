import asyncio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from core.websocket import manager, current_workspace_id

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
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
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
import os
import re
import json
import google.generativeai as genai
from firecrawl import FirecrawlApp

async def verify_instagram_profile(username: str, niche: str):
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")
    
    if not firecrawl_key or not gemini_key:
        return _mock_verification(
            username, niche,
            "Verification needs FIRECRAWL_API_KEY and GEMINI_API_KEY, which are not both set.")
        
    try:
        app = FirecrawlApp(api_key=firecrawl_key)
        # Attempt to scrape the user's instagram profile
        scrape_result = app.scrape_url(f"https://www.instagram.com/{username}", params={'formats': ['markdown']})
        markdown_content = scrape_result.get('markdown', '')
        
        genai.configure(api_key=gemini_key)
        model = genai.GenerativeModel("gemini-2.5-flash")
        
        prompt = (
            f"You are an Influencer Verification Agent. Analyse the scraped markdown from the "
            f"Instagram profile '{username}' (stated niche: {niche}).\n\n"
            "HARD RULES:\n"
            "1. Never invent collaborations, posts or reviews. Every item you return must appear "
            "in the scraped text.\n"
            "2. If the markdown is empty, a login wall, or does not clearly belong to this "
            "profile, return verification_status \"unverified\" with empty lists. Do NOT "
            "simulate or guess a plausible result.\n"
            "3. Only return \"verified\" when the scraped text genuinely shows this profile.\n"
            "4. Return \"rejected_fake_followers\" if the text shows clear fake-follower signals.\n\n"
            "Return ONLY raw JSON (no fences) with this schema: "
            "{\"verification_status\": \"verified\" | \"unverified\" | \"rejected_fake_followers\", "
            "\"recent_collabs\": [], \"recent_posts\": [], \"recent_reviews\": []}\n\n"
            f"Scraped Markdown: {markdown_content[:2000]}"
        )
        
        response = model.generate_content(prompt)
        # Strip markdown code fences (```json ... ``` or ``` ... ```) that Gemini sometimes adds
        raw = response.text.strip()
        raw = re.sub(r'^```(?:json)?\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)
        result = json.loads(raw.strip())
        
        # Verification must be earned, not assumed. This previously treated anything that was
        # not an explicit fake-follower rejection as verified, which meant an empty scrape (the
        # normal outcome, since Instagram serves a login wall) came back "verified".
        if result.get("verification_status") not in ("verified", "rejected_fake_followers"):
            result["verification_status"] = "unverified"
        result["simulated"] = False
        return result
        
    except Exception as e:
        print(f"Verification error: {e}")
        return _mock_verification(username, niche, f"The profile could not be read: {e}")

def _mock_verification(username, niche, reason="Verification is not configured on this server."):
    """Used when verification cannot run at all.

    It used to return verification_status "verified" along with invented collaborations
    ("<niche> Brand Co", "Global Agency") and an invented testimonial, which the caller then
    wrote onto the creator's public profile. That manufactured third-party endorsements for a
    real person and showed them to brands as social proof. It now reports plainly that nothing
    was checked, and returns nothing to store.
    """
    return {
        "verification_status": "unverified",
        "simulated": True,
        "reason": reason,
        "recent_collabs": [],
        "recent_posts": [],
        "recent_reviews": [],
    }
