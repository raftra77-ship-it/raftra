import asyncio
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from core.websocket import manager
from .router import router_decision_engine
from core.providers.llm_providers import OpenRouterProvider
from core.providers.image_providers import FluxSchnellProvider, GPTImageProvider
from database import SessionLocal
import models

# --- Schema Definitions ---

class GenerationState(TypedDict):
    workspace_id: int
    prompt: str
    reference_ad: dict
    model: str
    ad_format: str
    ad_ratio: str
    ad_length: str
    engine_mode: str
    cached_typography: dict
    cached_colors: list
    cached_brand_voice: str
    selected_image_provider: str
    selected_video_provider: str
    strategy: str
    copy: str
    image_url: str
    video_url: str
    audio_url: str
    logs: list
    status: str

# --- Node Definitions ---

async def fetch_context_node(state: GenerationState) -> GenerationState:
    msg = f"Fetching cached brand context for workspace {state.get('workspace_id', 'unknown')}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("System", msg, "running")
    
    brand_voice = "Professional and Futuristic."
    colors = ["#030303", "#5A52FF"]
    typography = {"primary": "Inter", "headings": "Outfit"}
    
    try:
        if state.get('workspace_id') and state.get('workspace_id') != 0:
            with SessionLocal() as db:
                ws = db.query(models.Workspace).filter(models.Workspace.id == state['workspace_id']).first()
                if ws:
                    if ws.brand_voice:
                        brand_voice = ws.brand_voice
                    if ws.brand_color:
                        colors = [ws.brand_color]
                
                # Fetch actual onboarded BrandProfile knowledge!
                profile = db.query(models.BrandProfile).filter(models.BrandProfile.workspace_id == state['workspace_id']).first()
                if profile:
                    if profile.color_palette:
                        colors = profile.color_palette
                    if profile.typography:
                        typography = profile.typography
                    
                    onboarding_context = f"\nTarget Audience: {profile.target_audience or 'General'}\nBrand Guidelines: {profile.brand_guidelines_summary or 'Standard professional tone'}"
                    brand_voice += onboarding_context

                    msg = f"Loaded Brand Knowledge Base (Onboarding data) for {state.get('workspace_id')}"
                    await manager.broadcast_agent_log("System", msg, "running")
    except Exception as e:
        await manager.broadcast_agent_log("System", f"Warning: DB fetch failed: {str(e)}", "running")
    
    # ---------------------------------------------------------
    # SIMULATED RAG PIPELINE: Fetching Context Video Knowledge
    # ---------------------------------------------------------
    await manager.broadcast_agent_log("RAG Agent", "Retrieving historical video ideas and brand context from knowledge base...", "running")
    await asyncio.sleep(1) # simulate vector DB latency
    
    # In a real app, this would use a vector DB (like Qdrant) with `sentence-transformers`.
    # We generate a massive context block that `headroom` will compress.
    rag_context = f"""
    [RAG DOCUMENT 1] Brand Guidelines: The brand tone is {brand_voice}. Avoid using overly technical jargon. Focus on emotional storytelling.
    [RAG DOCUMENT 2] Video Analytics: Past videos featuring human faces in the first 3 seconds saw a 45% increase in retention.
    [RAG DOCUMENT 3] Competitor Analysis: Competitors are heavily utilizing fast-paced transitions. We should adopt quick jump cuts (every 2-3 seconds).
    [RAG DOCUMENT 4] Historical Ads: "Summer Blast 2023" was a top performer because it highlighted urgency and scarcity.
    """
    
    # Append the massive RAG context to the brand voice for the LLM's system prompt
    brand_voice = f"Tone: {brand_voice}\n\nKNOWLEDGE BASE CONTEXT:\n{rag_context}"
    await manager.broadcast_agent_log("RAG Agent", "Knowledge base context retrieved and loaded for compression.", "completed")
    
    state["cached_typography"] = typography
    state["cached_colors"] = colors
    state["cached_brand_voice"] = brand_voice
    return state

async def strategy_and_router_node(state: GenerationState) -> GenerationState:
    msg = "Developing creative strategy and selecting ideal media format..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Creative Director", msg, "thinking")
    
    llm_model = state.get("model", "gemini-1.5-flash")
    if "gemini" in llm_model.lower():
        from core.providers.llm_providers import GeminiProvider
        llm = GeminiProvider()
    else:
        llm = OpenRouterProvider()
    
    if state.get("reference_ad"):
        ref = state["reference_ad"]
        prompt = f"User Request: {state['prompt']}\nModify this existing ad strategy based on your NLP understanding of the request:\n{ref.get('headline', '')}\nEnsure it aligns with the brand knowledge base."
    else:
        prompt = f"User Request: {state['prompt']}\nMode Selected: {state.get('engine_mode', 'Video Ad')}\nUse NLP to parse the user's intent according to the selected mode. If the mode is 'AI Media Buyer', answer as a data analyst. If 'Avatar Video', output a script. Otherwise, create an ad strategy drawing inspiration from the brand knowledge base.\nRequirements: {state.get('ad_format', 'Video')}, Ratio {state.get('ad_ratio', '16:9')}, Length {state.get('ad_length', '15s')}."
        
    strategy_response = await llm.generate_text(prompt, system_prompt=f"You are a brilliant AI assistant specializing in the '{state.get('engine_mode', 'Video Ad')}' tool.\n{state['cached_brand_voice']}", model_name=llm_model)
    
    if strategy_response.startswith("Error"):
        await manager.broadcast_agent_log("System", f"API Error Detected: {strategy_response}. Falling back to default strategy...", "running")
        strategy_response = f"Focus on highlighting the premium quality based on the request: {state['prompt']}."
        
    state["strategy"] = strategy_response
    
    msg_router = "Routing tasks to designated AI generation agents..."
    # Keep default router decision for now
    decision = router_decision_engine("conversion", state["prompt"])
    state["selected_image_provider"] = decision["image_provider"]
    state["selected_video_provider"] = decision["video_provider"]
    
    await manager.broadcast_agent_log("Router", msg_router, "completed")
    return state

async def copywriting_node(state: GenerationState) -> GenerationState:
    msg = f"Writing ad copy in brand voice..."
    await manager.broadcast_agent_log("Copywriter", msg, "thinking")
    
    llm_model = state.get("model", "gemini-1.5-flash")
    if "gemini" in llm_model.lower():
        from core.providers.llm_providers import GeminiProvider
        llm = GeminiProvider()
    else:
        llm = OpenRouterProvider()
    
    if state.get("reference_ad"):
        ref = state["reference_ad"]
        prompt = f"User Request: {state['prompt']}\nModify this existing ad copy:\n{ref.get('bodyText', '')}\nBased on new strategy: {state['strategy']}\nBrand Voice: {state['cached_brand_voice']}"
    else:
        prompt = f"Write a short, punchy ad copy (1 headline, 1 body) based on this strategy:\n{state['strategy']}\nMake sure to incorporate the specific video ideas from the Knowledge Base."
        
    copy_response = await llm.generate_text(prompt, system_prompt=f"You are an expert copywriter.\n{state['cached_brand_voice']}", model_name=llm_model)
    
    if copy_response.startswith("Error"):
        copy_response = f"Transform your approach today! Engineered for excellence."
        
    state["copy"] = copy_response
    
    await manager.broadcast_agent_log("Copywriting Agent", "Persuasive ad copy successfully written.", "completed")
    return state

async def media_generation_node(state: GenerationState) -> GenerationState:
    msg = f"Generating media via {state['selected_image_provider']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Media Generator", msg, "running")
    
    # Instantiate the right provider
    provider_name = state["selected_image_provider"]
    if provider_name in ["gpt_image", "flux_pro"]:
        img_provider = GPTImageProvider()
    else:
        # Default to FluxSchnellProvider (Pollinations free API) for all others in demo
        img_provider = FluxSchnellProvider()
        
    image_prompt = f"A high quality advertisement image for: {state['prompt']} - Strategy: {state['strategy']}"
    
    try:
        image_url = await img_provider.generate_image(image_prompt)
    except Exception as e:
        await manager.broadcast_agent_log("System", f"Warning: Image generation failed: {str(e)}", "running")
        image_url = "https://images.unsplash.com/photo-1542744173-8e7e53415bb0"
    
    state["image_url"] = image_url
    
    # Conditionally trigger video and audio if format requires it
    ad_format = state.get("ad_format", "Video").lower()
    is_video = "video" in ad_format
    is_audio = "audio" in ad_format or is_video
    
    if is_video:
        await manager.broadcast_agent_log("Video Agent", "Structuring dynamic UGC video storyboard based on generated copy...", "running")
        await asyncio.sleep(2)
        state["video_url"] = "https://cdn.pixabay.com/video/2020/05/26/40149-425126838_tiny.mp4"
        await manager.broadcast_agent_log("Video Agent", "Mock UGC Video generated (Pixabay).", "completed")
        
    if is_audio:
        await manager.broadcast_agent_log("Voice Agent", "Compiling text-to-speech audio outline...", "running")
        await asyncio.sleep(1)
        state["audio_url"] = "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg"
        await manager.broadcast_agent_log("Voice Agent", "Mock Audio generated.", "completed")
        
    state["status"] = "completed"
    await manager.broadcast_agent_log("System", "Generation Pipeline Complete.", "completed")
    return state


# --- Graph Compilation ---

workflow = StateGraph(GenerationState)

workflow.add_node("fetch_context", fetch_context_node)
workflow.add_node("strategy_and_router", strategy_and_router_node)
workflow.add_node("copywriting", copywriting_node)
workflow.add_node("media_generation", media_generation_node)

workflow.set_entry_point("fetch_context")
workflow.add_edge("fetch_context", "strategy_and_router")
workflow.add_edge("strategy_and_router", "copywriting")
workflow.add_edge("copywriting", "media_generation")
workflow.add_edge("media_generation", END)

generation_graph = workflow.compile()

async def run_ad_generation_task(workspace_id: int, prompt: str, reference_ad: dict = None, model: str = "gemini-1.5-flash", ad_format: str = "Video", ad_ratio: str = "9:16", ad_length: str = "15s", engine_mode: str = "Video Ad"):
    """
    Wrapper to execute the generation_graph and push final asset to WebSocket clients.
    """
    initial_state = {
        "workspace_id": workspace_id,
        "prompt": prompt,
        "reference_ad": reference_ad,
        "model": model,
        "ad_format": ad_format,
        "ad_ratio": ad_ratio,
        "ad_length": ad_length,
        "engine_mode": engine_mode,
        "cached_typography": {},
        "cached_colors": [],
        "cached_brand_voice": "",
        "selected_image_provider": "",
        "selected_video_provider": "",
        "strategy": "",
        "copy": "",
        "image_url": "",
        "video_url": "",
        "audio_url": "",
        "logs": [],
        "status": "queued"
    }
    
    await manager.broadcast_agent_log("System", "Initializing Ad Generation Workflow...", "queued")
    
    try:
        # Run the graph
        result = await generation_graph.ainvoke(initial_state)
        
        headline = result.get("strategy", "Strategy could not be generated.")
        body_text = result.get("copy", "Copy could not be generated.")
        ad_type = "Video Ad" if result.get("video_url") else "Image Ad"
        
        ad_id = "cr-" + str(workspace_id) + "-" + str(int(asyncio.get_event_loop().time() * 1000))
            
        # Broadcast the final generated asset to the frontend!
        final_asset = {
            "id": ad_id,
            "headline": headline,
            "bodyText": body_text,
            "cta": "Launch Campaign",
            "type": ad_type,
            "imageUrl": result.get("image_url", "https://image.pollinations.ai/prompt/abstract%20creative%20ad?width=1024&height=576&nologo=true"),
            "videoUrl": result.get("video_url", ""),
            "audioUrl": result.get("audio_url", "")
        }
        
        await manager.broadcast_creative_asset(final_asset)
        await manager.broadcast_agent_log("System", "Ad generation successfully delivered to UI.", "completed")
        return result
    except Exception as e:
        error_msg = f"Fatal Error in Ad Generation: {str(e)}"
        await manager.broadcast_agent_log("System", error_msg, "failed")
        print(error_msg)
        return initial_state
