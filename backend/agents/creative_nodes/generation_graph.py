import asyncio
import os
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from core.websocket import manager
from .router import router_decision_engine
from core.providers.llm_providers import OpenRouterProvider, GeminiProvider
from core.providers.base import LLMProviderError
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
    # REAL RAG PIPELINE: Fetching Context from Qdrant Knowledge Base
    # ---------------------------------------------------------
    await manager.broadcast_agent_log("RAG Agent", "Retrieving historical ideas and brand context from Qdrant knowledge base...", "running")
    
    rag_context = ""
    try:
        from database import qdrant_client
        from core.embeddings import embed_query, ensure_collection, COLLECTION_NAME
        from qdrant_client.models import Filter, FieldCondition, MatchValue

        ensure_collection(qdrant_client)
        query_text = f"{state.get('prompt', '')} {state.get('strategy', '')}"

        # query_points (not the removed .search) and filter by workspace server-side, so
        # the limit applies to this workspace's points rather than the global top matches.
        response = qdrant_client.query_points(
            collection_name=COLLECTION_NAME,
            query=embed_query(query_text),
            query_filter=Filter(must=[
                FieldCondition(key="workspace_id", match=MatchValue(value=state.get("workspace_id")))
            ]),
            limit=3,
        )
        for idx, r in enumerate(response.points):
            rag_context += f"\n[KNOWLEDGE {idx+1}] {r.payload.get('content', '')}"

        if not rag_context:
            rag_context = "No specific onboarding scraped knowledge found for this workspace in Qdrant."
    except Exception as e:
        # Never put the error text into rag_context: it gets pasted into the LLM prompt
        # as if it were brand knowledge. Log it and continue with no context instead.
        print(f"Qdrant retrieval failed: {e}")
        await manager.broadcast_agent_log("RAG Agent", f"Knowledge base unavailable, continuing without brand context: {e}", "failed")
        rag_context = "No brand knowledge available (retrieval failed)."
        
    
    # Append the massive RAG context to the brand voice for the LLM's system prompt
    brand_voice = f"Tone: {brand_voice}\n\nQDRANT KNOWLEDGE BASE CONTEXT:\n{rag_context}"
    await manager.broadcast_agent_log("RAG Agent", "Knowledge base context retrieved from Qdrant.", "completed")
    
    state["cached_typography"] = typography
    state["cached_colors"] = colors
    state["cached_brand_voice"] = brand_voice
    return state

async def strategy_and_router_node(state: GenerationState) -> GenerationState:
    msg = "Developing creative strategy and selecting ideal media format..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Creative Director", msg, "thinking")
    
    llm_model = state.get("model", "gemini-2.0-flash")
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
        
    try:
        # max_output_tokens bounds worst-case latency; the brevity instruction keeps the
        # model from padding out a "strategy" into an essay in the first place (an earlier
        # unconstrained call returned 8,500 characters for what should be a short brief).
        strategy_response = await llm.generate_text(
            prompt,
            system_prompt=f"You are a brilliant AI assistant specializing in the '{state.get('engine_mode', 'Video Ad')}' tool.\n{state['cached_brand_voice']}\nRespond in at most 3 concise sentences (under 80 words total). No preamble.",
            model_name=llm_model,
            max_output_tokens=300,
        )
    except LLMProviderError as e:
        # Surface the failure instead of substituting invented copy: a fabricated
        # "strategy" is indistinguishable from a real one and hides outages.
        await manager.broadcast_agent_log("System", f"Generation failed: {e}", "failed")
        raise

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
    
    llm_model = state.get("model", "gemini-2.0-flash")
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
        
    try:
        # Same reasoning as the strategy call above: an earlier run returned 6,544
        # characters for "1 headline, 1 body" - the cap plus explicit format keeps
        # this to something that is actually usable as ad copy.
        copy_response = await llm.generate_text(
            prompt,
            system_prompt=f"You are an expert copywriter.\n{state['cached_brand_voice']}\nRespond with exactly one headline (under 12 words) then one body sentence (under 35 words). No labels, no extra commentary.",
            model_name=llm_model,
            max_output_tokens=150,
        )
    except LLMProviderError as e:
        # Don't substitute invented ad copy - the user would have no way to tell it
        # apart from generated output.
        await manager.broadcast_agent_log("Copywriter", f"Copy generation failed: {e}", "failed")
        raise

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
        
    # Build a FOCUSED visual prompt. Previously the full marketing strategy (prose) was
    # appended here - an image model can't use prose, it latches onto scattered words, so
    # the picture looked unrelated to the request. Use a short "art director" LLM call to
    # turn the request into a clean visual scene description instead.
    llm_model = state.get("model", "gemini-2.0-flash")
    art_llm = GeminiProvider() if "gemini" in llm_model.lower() else OpenRouterProvider()
    brand_colors = state.get("cached_colors") or []
    color_hint = f" Incorporate brand colors {', '.join(brand_colors[:3])}." if brand_colors else ""
    try:
        image_prompt = await art_llm.generate_text(
            f"Ad request: {state['prompt']}\n"
            f"Write ONE concise image-generation prompt (under 40 words) describing the visual "
            f"scene for this ad's creative: subject, setting, and style only.{color_hint}",
            system_prompt="You are an art director writing prompts for an image model. Output only the image prompt itself - no labels, no marketing copy, no text-overlay instructions.",
            model_name=llm_model,
            max_output_tokens=100,
        )
        image_prompt = image_prompt.strip().strip('"')
    except LLMProviderError:
        # Fall back to the raw request (still the subject) rather than the strategy essay.
        image_prompt = state.get("prompt", "advertisement")
    # Style/safety suffix so results look like ad creative and avoid garbled text overlays.
    image_prompt = f"{image_prompt}. Commercial advertising photography, high detail, sharp focus, no text."

    try:
        image_url = await img_provider.generate_image(image_prompt, aspect_ratio=state.get("ad_ratio", "16:9"))
    except Exception as e:
        await manager.broadcast_agent_log("System", f"Warning: Image generation failed: {str(e)}", "running")
        image_url = "https://images.unsplash.com/photo-1542744173-8e7e53415bb0"
    
    state["image_url"] = image_url
    
    # Conditionally trigger video and audio if format requires it
    ad_format = state.get("ad_format", "Video").lower()
    is_video = "video" in ad_format
    is_audio = "audio" in ad_format or is_video
    
    if is_video:
        # Real per-prompt video needs an external service. We use Pexels (free API) to
        # fetch a relevant, DIFFERENT stock clip per ad. Never fall back to a single
        # hardcoded clip: it's identical every run and, since the UI renders <video>
        # over <img>, it hides the unique generated image - the "same video" bug.
        from core.providers.video_providers import PixabayVideoProvider, PexelsVideoProvider, SampleVideoProvider
        from core.providers.base import VideoProviderError
        # Try whichever stock-video key is configured for a RELEVANT clip: Pixabay first
        # (instant free key), then Pexels. If neither key is set, fall back to a random
        # working sample clip so a (different) video always shows - never a single fixed one.
        state["video_url"] = ""
        await manager.broadcast_agent_log("Video Agent", "Sourcing a video clip for the ad...", "running")
        for provider in (PixabayVideoProvider(), PexelsVideoProvider()):
            try:
                state["video_url"] = await provider.generate_video(
                    image_url=state["image_url"],
                    prompt=state["prompt"],
                    ad_ratio=state.get("ad_ratio", "9:16"),
                )
                await manager.broadcast_agent_log("Video Agent", "Relevant video clip sourced (stock b-roll).", "completed")
                break
            except VideoProviderError:
                continue
        if not state["video_url"]:
            # No stock-video key configured: use a rotating keyless sample clip.
            state["video_url"] = await SampleVideoProvider().generate_video(image_url=state["image_url"], prompt=state["prompt"])
            await manager.broadcast_agent_log("Video Agent", "Using a sample video clip (add PIXABAY_API_KEY for content-matched footage).", "completed")

    if is_audio:
        await manager.broadcast_agent_log("Voice Agent", "Compiling text-to-speech audio outline...", "running")
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

async def run_ad_generation_task(workspace_id: int, prompt: str, reference_ad: dict = None, model: str = "gemini-2.0-flash", ad_format: str = "Video", ad_ratio: str = "9:16", ad_length: str = "15s", engine_mode: str = "Video Ad"):
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

    from core.agent_status import record_agent_task
    record_agent_task(workspace_id, "CREATIVE", "RUNNING", f"Generating: {prompt[:80]}")

    try:
        # Run the graph
        result = await generation_graph.ainvoke(initial_state)
        
        headline = result.get("strategy", "Strategy could not be generated.")
        body_text = result.get("copy", "Copy could not be generated.")
        ad_type = "Video Ad" if result.get("video_url") else "Image Ad"
        
        ad_id = "cr-" + str(workspace_id) + "-" + str(int(asyncio.get_event_loop().time() * 1000))
            
        # Save to database
        db_id = 0
        try:
            from database import SessionLocal
            import models
            db = SessionLocal()
            new_asset = models.AdAsset(
                workspace_id=workspace_id,
                headline=headline[:255] if headline else "Generated Headline",
                body_text=body_text,
                cta="Launch Campaign",
                type=ad_type,
                image_url=result.get("image_url"),
                video_url=result.get("video_url"),
                audio_url=result.get("audio_url"),
                status="approved"
            )
            db.add(new_asset)
            db.commit()
            db.refresh(new_asset)
            db_id = new_asset.id
        except Exception as e:
            print(f"Failed to save AdAsset to DB: {e}")
            if 'db' in locals(): db.rollback()
        finally:
            if 'db' in locals(): db.close()

        # Broadcast the final generated asset to the frontend!
        final_asset = {
            "id": db_id or ad_id,
            "workspace_id": workspace_id,
            "headline": headline,
            "bodyText": body_text,
            "cta": "Launch Campaign",
            "type": ad_type,
            "imageUrl": result.get("image_url", "https://image.pollinations.ai/prompt/abstract%20creative%20ad?width=1024&height=576&nologo=true"),
            "videoUrl": result.get("video_url", ""),
            "audioUrl": result.get("audio_url", "")
        }

        # broadcast_creative_asset takes only `asset` - passing workspace_id positionally
        # here raised a TypeError on every run, after all the real generation work had
        # already completed, so the finished ad never reached the frontend.
        await manager.broadcast_creative_asset(final_asset)
        await manager.broadcast_agent_log("System", "Ad generation successfully delivered to UI.", "completed")
        record_agent_task(workspace_id, "CREATIVE", "COMPLETED", f"Generated ad: {(headline or '')[:80]}")
        return result
    except Exception as e:
        await manager.broadcast_agent_log("System", f"Pipeline Failed: {str(e)}", "failed")
        print(f"Error in creative pipeline: {e}")
        record_agent_task(workspace_id, "CREATIVE", "FAILED", str(e)[:120])
        return initial_state
