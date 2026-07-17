import asyncio
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END

# Assuming `manager` from core.websocket is used to broadcast logs
from core.websocket import manager
import os
import httpx
from core.providers.llm_providers import OpenRouterProvider

# --- Schema Definitions ---

class OnboardingState(TypedDict):
    workspace_id: int
    brand_url: str
    brand_logo: Optional[str]
    guidelines_url: Optional[str]
    # Intermediate state
    scraped_content: str
    vision_insights: dict
    # Final structured outputs for DB
    typography: dict
    color_palette: list
    brand_guidelines_summary: str
    target_audience: str
    logs: List[str]
    status: str

# --- Node Definitions ---

async def brand_intelligence_node(state: OnboardingState) -> OnboardingState:
    """
    Scrapes the brand URL using Firecrawl/Crawl4AI.
    """
    msg = f"Initiating Brand Intelligence Agent for {state['brand_url']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Brand Intelligence", msg, "running")
    
    scraped_text = "No content extracted."
    firecrawl_key = os.getenv("FIRECRAWL_API_KEY")
    tavily_key = os.getenv("TAVILY_API_KEY")

    if firecrawl_key and state['brand_url']:
        msg = f"Scraping brand content from {state['brand_url']} via Firecrawl..."
        await manager.broadcast_agent_log("Brand Intelligence", msg, "thinking")
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "https://api.firecrawl.dev/v1/scrape",
                    headers={"Authorization": f"Bearer {firecrawl_key}", "Content-Type": "application/json"},
                    json={"url": state['brand_url'], "formats": ["markdown"]}
                )
                if res.status_code == 200:
                    data = res.json()
                    scraped_text = data.get("data", {}).get("markdown", "")[:4000] # Limit size
        except Exception as e:
            scraped_text = f"Scraping failed: {e}"

    if tavily_key:
        msg = f"Searching for brand and competitors using Tavily..."
        await manager.broadcast_agent_log("Brand Intelligence", msg, "thinking")
        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    "https://api.tavily.com/search",
                    json={"api_key": tavily_key, "query": f"Brand information and competitors for {state['brand_url']}"}
                )
                if res.status_code == 200:
                    tavily_data = res.json()
                    results = "\n".join([r.get("content", "") for r in tavily_data.get("results", [])])
                    scraped_text += "\n\nSearch Context:\n" + results[:2000]
        except Exception as e:
            pass

    state["scraped_content"] = scraped_text
    return state

async def vision_analysis_node(state: OnboardingState) -> OnboardingState:
    """
    Passes images/logo to Vision Models (Qwen2.5-VL / Florence-2).
    """
    msg = "Initiating Vision Analysis on Brand Assets..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Vision Agent", msg, "running")
    
    # TODO: Implement Vision API/Local model call here to extract colors and layout
    await asyncio.sleep(1.0)
    
    state["vision_insights"] = {
        "primary_color": "#030303",
        "secondary_color": "#5A52FF",
        "font_family_heading": "Outfit",
        "font_family_body": "Inter"
    }
    return state

async def synthesis_and_persistence_node(state: OnboardingState) -> OnboardingState:
    """
    Synthesizes the scraped data using LLM and saves to Postgres & Qdrant.
    """
    msg = "Synthesizing brand profile and caching to PostgreSQL and Qdrant..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("System", msg, "running")
    
    llm = OpenRouterProvider()
    prompt = f"Analyze the following scraped content and summarize the brand's tone, audience, and key value propositions in 3 sentences:\n\n{state['scraped_content']}"
    summary = await llm.generate_text(prompt, system_prompt="You are a brand strategist.")
    
    if summary.startswith("Error"):
        summary = "Premium AI Marketing Platform. Tone: Professional, Futuristic."
    
    state["typography"] = {"heading": state.get("vision_insights", {}).get("font_family_heading", "Inter")}
    state["color_palette"] = [state.get("vision_insights", {}).get("primary_color", "#030303")]
    state["brand_guidelines_summary"] = summary
    state["target_audience"] = "Growth marketers, startup founders."
    state["status"] = "completed"
    
    # Save to PostgreSQL
    from database import SessionLocal
    from models import Workspace, BrandProfile
    
    db = SessionLocal()
    try:
        ws = db.query(Workspace).filter(Workspace.id == state["workspace_id"]).first()
        if ws:
            ws.brand_voice = summary
            bp = db.query(BrandProfile).filter(BrandProfile.workspace_id == state["workspace_id"]).first()
            if not bp:
                bp = BrandProfile(workspace_id=state["workspace_id"])
                db.add(bp)
            bp.typography = state["typography"]
            bp.color_palette = state["color_palette"]
            bp.brand_guidelines_summary = summary
            bp.target_audience = state["target_audience"]
            bp.is_onboarded = True
            db.commit()
    except Exception as e:
        db.rollback()
        print(f"PostgreSQL persist error: {e}")
    finally:
        db.close()
        
    # Save to Qdrant (Simulated embedding for now)
    try:
        from database import qdrant_client
        from qdrant_client.models import PointStruct
        import uuid
        
        from sentence_transformers import SentenceTransformer
        
        # Load the BGE model to generate real embeddings
        model = SentenceTransformer("BAAI/bge-small-en-v1.5")
        
        content_to_embed = state.get("scraped_content", "")
        # Fallback to empty string if no content is scraped to avoid crash
        if not content_to_embed:
            content_to_embed = "Empty workspace context"
            
        embedding = model.encode(content_to_embed).tolist()

        qdrant_client.upsert(
            collection_name="brand_knowledge",
            points=[
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embedding,
                    payload={"workspace_id": state["workspace_id"], "content": content_to_embed, "type": "onboarding_scrape"}
                )
            ]
        )
    except Exception as e:
        print(f"Qdrant persist error: {e}")

    await manager.broadcast_agent_log("System", "Brand Onboarding Complete. Profile Cached.", "completed")
    return state

# --- Graph Compilation ---

workflow = StateGraph(OnboardingState)

workflow.add_node("brand_intelligence", brand_intelligence_node)
workflow.add_node("vision_analysis", vision_analysis_node)
workflow.add_node("synthesis_and_persistence", synthesis_and_persistence_node)

workflow.set_entry_point("brand_intelligence")
workflow.add_edge("brand_intelligence", "vision_analysis")
workflow.add_edge("vision_analysis", "synthesis_and_persistence")
workflow.add_edge("synthesis_and_persistence", END)

onboarding_graph = workflow.compile()

async def run_onboarding_pipeline(workspace_id: int, brand_url: str, brand_logo: str = None):
    initial_state = {
        "workspace_id": workspace_id,
        "brand_url": brand_url,
        "brand_logo": brand_logo,
        "guidelines_url": None,
        "scraped_content": "",
        "vision_insights": {},
        "typography": {},
        "color_palette": [],
        "brand_guidelines_summary": "",
        "target_audience": "",
        "logs": [],
        "status": "queued"
    }
    result = await onboarding_graph.ainvoke(initial_state)
    return result
