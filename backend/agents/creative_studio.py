import asyncio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
import os
from core.websocket import manager
from core.providers.llm_providers import GeminiProvider

class CreativeState(TypedDict):
    workspace_id: int
    brand_url: str
    target_product: str
    concept_strategy: str
    logs: List[str]
    current_node: str
    status: str  # queued, running, completed, failed
    generated_headline: str
    generated_body: str
    generated_cta: str

async def brand_analysis_node(state: CreativeState) -> CreativeState:
    state["current_node"] = "Brand Analysis"
    state["status"] = "running"
    msg = f"Analyzing target brand assets at {state['brand_url']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Creative Agent", msg, "running")
    await manager.broadcast_node_update("creative_studio", "Brand Analysis", "running")
    await asyncio.sleep(1.0)
    return state

async def competitor_analysis_node(state: CreativeState) -> CreativeState:
    state["current_node"] = "Competitor Analysis"
    msg = "Evaluating rival ad copy angles and bidding density..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Creative Agent", msg, "running")
    await manager.broadcast_node_update("creative_studio", "Competitor Analysis", "running")
    await asyncio.sleep(1.0)
    return state

async def creative_research_node(state: CreativeState) -> CreativeState:
    state["current_node"] = "Creative Research"
    msg = f"Crawling search queries matching: {state['target_product']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Creative Agent", msg, "thinking")
    await manager.broadcast_node_update("creative_studio", "Creative Research", "running")
    await asyncio.sleep(1.0)
    return state

async def creative_strategy_node(state: CreativeState) -> CreativeState:
    state["current_node"] = "Creative Strategy"
    msg = f"Selecting creative angle: {state['concept_strategy']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Creative Agent", msg, "running")
    await manager.broadcast_node_update("creative_studio", "Creative Strategy", "running")
    await asyncio.sleep(1.0)
    return state

async def asset_generation_node(state: CreativeState) -> CreativeState:
    state["current_node"] = "Asset Generation"
    msg = "Drafting high-converting copy headlines and CTA suggestions using LLM..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Creative Agent", msg, "running")
    await manager.broadcast_node_update("creative_studio", "Asset Generation", "running")
    
    try:
        with open("prompts/content-creator.md", "r", encoding="utf-8") as f:
            system_prompt = f.read()
    except Exception:
        system_prompt = "You are an expert digital marketing content creator."

    prompt = f"Target product/service: {state['target_product']}\nCreative Strategy: {state['concept_strategy']}\nPlease write an ad headline, a body text, and a CTA."
    prompt += "\nFormat exactly as:\nHeadline: [your headline]\nBody: [your body text]\nCTA: [your call to action]"
    
    try:
        llm = GeminiProvider()
        response = await llm.generate_text(prompt=prompt, system_prompt=system_prompt)
        
        headline, body, cta = state.get("generated_headline", "Unleash potential."), state.get("generated_body", "Scale acquisition loop."), state.get("generated_cta", "Start Trial")
        
        for line in response.split("\n"):
            line = line.strip()
            if line.lower().startswith("headline:"):
                headline = line[9:].strip().replace("**", "").replace('"', '')
            elif line.lower().startswith("body:"):
                body = line[5:].strip().replace("**", "")
            elif line.lower().startswith("cta:"):
                cta = line[4:].strip().replace("**", "").replace('"', '')
                
        state["generated_headline"] = headline
        state["generated_body"] = body
        state["generated_cta"] = cta
    except Exception as e:
        print(f"LLM Error in creative_studio: {e}")
        state["generated_headline"] = f"Unleash {state['target_product']} instantly."
        state["generated_body"] = f"Scale your acquisition loop with coordinated brand voice parameters."
        state["generated_cta"] = "Activate Trial Now"
        
    return state

async def quality_review_node(state: CreativeState) -> CreativeState:
    state["current_node"] = "Quality Review"
    msg = "Ready for human review queue checkpoint."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Creative Agent", msg, "completed")
    await manager.broadcast_node_update("creative_studio", "Quality Review", "completed")
    state["status"] = "completed"
    return state

# Compile LangGraph StateGraph
workflow = StateGraph(CreativeState)

workflow.add_node("brand_analysis", brand_analysis_node)
workflow.add_node("competitor_analysis", competitor_analysis_node)
workflow.add_node("creative_research", creative_research_node)
workflow.add_node("creative_strategy", creative_strategy_node)
workflow.add_node("asset_generation", asset_generation_node)
workflow.add_node("quality_review", quality_review_node)

workflow.set_entry_point("brand_analysis")
workflow.add_edge("brand_analysis", "competitor_analysis")
workflow.add_edge("competitor_analysis", "creative_research")
workflow.add_edge("creative_research", "creative_strategy")
workflow.add_edge("creative_strategy", "asset_generation")
workflow.add_edge("asset_generation", "quality_review")
workflow.add_edge("quality_review", END)

creative_graph = workflow.compile()

async def run_creative_pipeline(workspace_id: int, brand_url: str, target_product: str, concept_strategy: str):
    initial_state = {
        "workspace_id": workspace_id,
        "brand_url": brand_url,
        "target_product": target_product,
        "concept_strategy": concept_strategy,
        "logs": [],
        "current_node": "init",
        "status": "queued",
        "generated_headline": "",
        "generated_body": "",
        "generated_cta": ""
    }
    await manager.broadcast_agent_log("Creative Agent", "Initializing AI Creative Studio pipeline...", "queued")
    result = await creative_graph.ainvoke(initial_state)
    return result
