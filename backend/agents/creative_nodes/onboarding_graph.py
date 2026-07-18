import asyncio
from typing import TypedDict, List, Optional
from langgraph.graph import StateGraph, END

# Assuming `manager` from core.websocket is used to broadcast logs
from core.websocket import manager
import os
import httpx
from core.providers.llm_providers import GeminiProvider
from core.providers.base import LLMProviderError

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

def _html_to_text(html: str) -> str:
    """Crude but dependency-free HTML -> text: drop scripts/styles/tags, collapse whitespace."""
    import re
    html = re.sub(r"(?is)<(script|style|noscript|svg|head)[^>]*>.*?</\1>", " ", html)
    html = re.sub(r"(?s)<[^>]+>", " ", html)
    # Decode the handful of entities that matter for prose
    for ent, ch in [("&amp;", "&"), ("&nbsp;", " "), ("&quot;", '"'), ("&#39;", "'"), ("&lt;", "<"), ("&gt;", ">")]:
        html = html.replace(ent, ch)
    return re.sub(r"\s+", " ", html).strip()


async def brand_intelligence_node(state: OnboardingState) -> OnboardingState:
    """
    Scrapes the brand URL. Prefers Firecrawl (clean markdown) when a key is set,
    otherwise falls back to fetching the page directly and extracting its text —
    so onboarding produces real brand content even with no external API keys.
    """
    msg = f"Initiating Brand Intelligence Agent for {state['brand_url']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Brand Intelligence", msg, "running")

    scraped_text = ""
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
            # Never store the error text as content - it would be embedded into the
            # knowledge base as if it were brand information. Fall through instead.
            print(f"Firecrawl scrape failed: {e}")

    if not scraped_text and state['brand_url']:
        # Fallback: fetch the page directly and extract its text.
        msg = f"Fetching {state['brand_url']} directly (no Firecrawl key or Firecrawl failed)..."
        await manager.broadcast_agent_log("Brand Intelligence", msg, "thinking")
        try:
            url = state['brand_url']
            if not url.startswith(("http://", "https://")):
                url = "https://" + url
            async with httpx.AsyncClient(follow_redirects=True, timeout=20) as client:
                res = await client.get(url, headers={"User-Agent": "Mozilla/5.0 (compatible; RaftraBot/1.0)"})
                if res.status_code == 200:
                    scraped_text = _html_to_text(res.text)[:4000]
        except Exception as e:
            print(f"Direct fetch failed: {e}")

    if not scraped_text:
        await manager.broadcast_agent_log("Brand Intelligence", "Could not extract any content from the brand URL - the knowledge base will be limited for this workspace.", "failed")
        scraped_text = "No content extracted."

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
    
    # Gemini: the only provider with a configured key (OPENROUTER_API_KEY is empty).
    llm = GeminiProvider()
    prompt = f"Analyze the following scraped content and summarize the brand's tone, audience, and key value propositions in 3 sentences:\n\n{state['scraped_content']}"
    try:
        summary = await llm.generate_text(prompt, system_prompt="You are a brand strategist.")
    except LLMProviderError as e:
        # A fabricated brand summary would be embedded into the knowledge base and
        # silently poison every downstream agent, so fail instead.
        await manager.broadcast_agent_log("Brand Strategist", f"Brand analysis failed: {e}", "failed")
        raise

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
        
    # Persist the brand context to the knowledge base so generation can retrieve it.
    try:
        from database import qdrant_client
        from qdrant_client.models import PointStruct
        from core.embeddings import embed_passage, ensure_collection, COLLECTION_NAME
        import uuid

        ensure_collection(qdrant_client)

        content_to_embed = state.get("scraped_content", "")
        # Fallback to empty string if no content is scraped to avoid crash
        if not content_to_embed:
            content_to_embed = "Empty workspace context"

        # Re-indexing should REPLACE this workspace's knowledge, not pile new points on
        # top of stale ones (otherwise old "No content extracted" placeholders linger).
        from qdrant_client.models import Filter, FieldCondition, MatchValue
        try:
            qdrant_client.delete(
                collection_name=COLLECTION_NAME,
                points_selector=Filter(must=[FieldCondition(key="workspace_id", match=MatchValue(value=state["workspace_id"]))]),
            )
        except Exception as del_err:
            print(f"Qdrant cleanup (non-fatal): {del_err}")

        qdrant_client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                PointStruct(
                    id=str(uuid.uuid4()),
                    vector=embed_passage(content_to_embed),
                    payload={"workspace_id": state["workspace_id"], "content": content_to_embed, "type": "onboarding_scrape"}
                )
            ]
        )
    except Exception as e:
        # Previously this only printed, so onboarding reported success while the
        # knowledge base stayed empty - and every later generation had no context.
        print(f"Qdrant persist error: {e}")
        await manager.broadcast_agent_log("System", f"Brand onboarding failed: could not save knowledge base ({e})", "failed")
        raise

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
    from core.agent_status import record_agent_task
    record_agent_task(workspace_id, "ONBOARDING", "RUNNING", f"Analyzing {brand_url}")
    try:
        result = await onboarding_graph.ainvoke(initial_state)
        record_agent_task(workspace_id, "ONBOARDING", "COMPLETED", "Brand profile & knowledge base built")
        return result
    except Exception as e:
        record_agent_task(workspace_id, "ONBOARDING", "FAILED", str(e)[:120])
        raise
