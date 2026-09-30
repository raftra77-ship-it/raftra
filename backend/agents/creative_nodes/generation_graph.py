import asyncio
import os
import re
from typing import TypedDict, List
from langgraph.graph import StateGraph, END
from core.websocket import manager, current_workspace_id
from .router import router_decision_engine
from core.providers.llm_providers import OpenRouterProvider, GeminiProvider
from core.providers.base import LLMProviderError
from core.providers.image_providers import (FluxSchnellProvider, GPTImageProvider,
                                            HFFluxSchnellProvider, NanoBananaProvider)
from database import SessionLocal
import models

# The brief handed to the art-director LLM call before any image provider runs - upgrades a
# raw ad request into a fully-specified commercial ad-photography scene (hero subject, premium
# lighting, clean negative space for headline/CTA, no text/logos so the image works as pure
# creative behind overlaid copy).
# The model the creative pipeline asks for when the caller does not pin one.
#
# This was "gemini-2.0-flash" in four places - an id Google retired, which 404s. Every
# generation therefore opened with a request that could not succeed, and because the
# fallback loop re-learned that on each of the three LLM calls, it cost three wasted round
# trips per generation. Kept as one constant so the next retirement is a one-line change.
_DEFAULT_LLM_MODEL = os.getenv("CREATIVE_LLM_MODEL", "gemini-flash-latest")

# Ceiling on the optional vector-retrieval step. Generation must never wait longer than this
# for context it is designed to work without.
_VECTOR_SEARCH_TIMEOUT_SEC = float(os.getenv("VECTOR_SEARCH_TIMEOUT_SEC", "8"))


def _brand_visual_brief(workspace_id) -> str:
    """What the Brand Knowledge vault knows about how this brand looks, as prompt text.

    Visual facts only. An image model cannot act on tone of voice or a messaging framework,
    and stuffing prose into a diffusion prompt is what made an earlier version of this
    pipeline produce pictures unrelated to the request. Products and technologies ARE
    included, because naming a real product line is what makes generated creative look like
    this brand's catalogue rather than stock photography.

    Returns "" for a workspace with no knowledge, so behaviour is unchanged there.
    """
    if not workspace_id or workspace_id == 0:
        return ""
    try:
        from core.rag import brand_facts
        f = brand_facts(workspace_id) or {}
    except Exception as e:
        print(f"image brief: brand facts unavailable for ws {workspace_id}: {e}")
        return ""

    bits = []
    if f.get("name"):
        bits.append(f"The brand is {f['name']}.")
    guidelines_visual = ""
    try:
        import models
        from database import SessionLocal
        with SessionLocal() as db:
            bp = (db.query(models.BrandProfile)
                    .filter(models.BrandProfile.workspace_id == workspace_id).first())
            guidelines_visual = ((bp.guidelines or {}).get("visual") or "") if bp else ""
    except Exception:
        pass
    if guidelines_visual:
        bits.append(f"Its visual language: {guidelines_visual[:320]}")

    # Real product names and technologies, which is what stops the image being stock.
    products, technologies = [], []
    for cat in (f.get("catalogue") or [])[:4]:
        products.extend([str(p) for p in (cat.get("products") or [])[:3]])
        technologies.extend([str(t) for t in (cat.get("technologies") or [])[:3]])

    # Fallback for brands onboarded before the structured catalogue existed. Their named
    # products are not lost, they are just parenthesised inside the category strings -
    # "Collections (Nike 24.7 Collection, Moon Shoe, Vomero 18, Air Max)". Reading the
    # category list verbatim handed the model one long string it then truncated mid-name,
    # so the distinctive names never survived into the prompt while the generic head of
    # the string ("Footwear", "Apparel") always did. Pull the names out instead.
    categories = [str(c) for c in (f.get("categories") or [])]
    category_names = []
    for c in categories:
        head, _, tail = c.partition("(")
        if head.strip():
            category_names.append(head.strip())
        for item in tail.rstrip(")").split(","):
            item = item.strip()
            if item:
                products.append(item)

    # Longest-first: "Pegasus Premium" identifies the brand far better than "Shoes" does,
    # and the budget below is small enough that ordering decides what survives.
    products = sorted(dict.fromkeys(p for p in products if p), key=len, reverse=True)

    def _fit(items, budget):
        """Whole items up to a character budget - never a truncated product name."""
        out, used = [], 0
        for item in items:
            if used + len(item) + 2 > budget:
                continue
            out.append(item)
            used += len(item) + 2
        return out

    if category_names:
        bits.append("Categories: " + ", ".join(_fit(category_names, 120)) + ".")
    if products:
        bits.append("Named products in its catalogue (use one of these as the hero subject "
                    "when it fits the request): " + ", ".join(_fit(products, 260)) + ".")
    if technologies:
        bits.append("Named technologies/materials: "
                    + ", ".join(_fit(list(dict.fromkeys(technologies)), 180)) + ".")

    if f.get("positioning"):
        bits.append(f"Positioning: {f['positioning'][:200]}")
    personality = f.get("personality")
    if personality:
        as_text = personality if isinstance(personality, str) else ", ".join(str(p) for p in personality)
        bits.append(f"It should feel: {as_text[:140]}.")

    if not bits:
        return ""
    return ("\n\nBRAND GROUNDING (make the image look like it belongs to THIS brand's own "
            "catalogue and art direction; never render the brand name or a logo as text):\n"
            + " ".join(bits))


CREATIVE_DIRECTOR_PROMPT = """You are an award-winning Creative Director specializing in high-converting commercial advertising.

Create a premium advertisement-quality image.

User Request:
{user_prompt}
{brand_brief}
HOW TO USE THE BRAND FACTS ABOVE (when present):
- They describe a REAL brand with a REAL catalogue. Use them to decide what the hero
  subject actually is: its product type, its materials, its construction, its colourway,
  the setting that brand's own photography uses.
- When the request describes a product type and the catalogue lists a NAMED product of that
  type, make that named product the hero subject and say its name in the scene description.
  "the Vomero 18 road-running shoe, engineered mesh upper, visible air-cushioned midsole"
  beats "a running shoe". A generic subject when a named one was available is the exact
  failure this section exists to prevent.
- Carry the named technologies and materials into the description of the subject itself -
  they are what makes it look like this brand's product rather than any competitor's.
- "Avoid brand names" further down means do not RENDER the wordmark, logo or any lettering
  as graphics in the image. It does NOT mean ignore these facts. Let them shape the
  subject and the art direction; just never draw the name.
- If a brand fact contradicts the User Request, the User Request wins.

CRITICAL — the User Request above is the source of truth:
- Preserve every explicit subject, object, color, setting, and style choice the user stated.
  Never substitute or drop a detail they specifically asked for.
- If the user named an art style (e.g. illustration, cartoon, flat design, watercolor,
  minimalist, 3D render, anime), use THAT style instead of photorealistic photography.
  Only default to photorealistic commercial photography when the user did not specify a style.
- If the user explicitly asked for visible text, words, or a slogan in the image, keep that
  instruction. Only exclude on-image text when the user did not ask for it.
- Everything below is polish to apply AROUND the user's request — it must never replace or
  override what they specifically asked for.

Requirements:

Elevate the user's request into a visually stunning commercial advertisement in the style
established above.

The image should look like it was designed by a professional advertising agency.

Use cinematic composition, premium lighting, realistic shadows (or the stylistic equivalent for
non-photorealistic styles), rich colors, modern styling, and professional marketing aesthetics.

The image must have:
- One clear hero subject (as described by the user)
- Strong focal point
- Premium production quality for the chosen style
- Rich, cohesive color grading
- High visual impact
- Balanced composition

Reserve clean negative space:
- Top area for headline
- Bottom area for CTA
- Keep these areas visually clean without distracting objects

Unless the user explicitly requested them, avoid:
- Logos
- Watermarks
- Buttons
- UI elements
- Brand names

The image should feel suitable for:
- Facebook Ads
- Instagram Ads
- Google Display Ads
- LinkedIn Ads
- Landing pages

Style:
Award-winning creative direction
Sharp focus
Ultra detailed
Premium quality
(Photorealistic, studio-lit, 8K commercial photography — unless the user's request specifies a
different art style, in which case follow that style at the same quality bar.)"""

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
    # ---------------------------------------------------------
    # Brand grounding.
    #
    # Postgres first: the onboarding pipeline stores the scraped brand summary, audience,
    # palette and typography on brand_profiles, and that is available in every environment.
    # Qdrant is then layered on when it happens to be reachable - it is not deployed, and
    # its embedding model is excluded from the deploy image, so it must never be the only
    # source or generation runs with no brand context at all.
    # ---------------------------------------------------------
    await manager.broadcast_agent_log("RAG Agent", "Loading brand context...", "running")

    context_parts: list[str] = []
    sources: list[str] = []

    try:
        from database import SessionLocal
        from models import Workspace, BrandProfile

        db = SessionLocal()
        try:
            ws_id = state.get("workspace_id")
            ws = db.query(Workspace).filter(Workspace.id == ws_id).first()
            bp = db.query(BrandProfile).filter(BrandProfile.workspace_id == ws_id).first()

            if ws and ws.name:
                context_parts.append(f"Brand: {ws.name}")
            if ws and ws.company_url:
                context_parts.append(f"Website: {ws.company_url}")
            if bp and bp.brand_guidelines_summary:
                context_parts.append(f"Brand guidelines:\n{bp.brand_guidelines_summary}")
            if bp and bp.target_audience:
                context_parts.append(f"Target audience: {bp.target_audience}")
            if bp and bp.color_palette:
                context_parts.append(f"Brand palette: {bp.color_palette}")
            if bp and bp.typography:
                context_parts.append(f"Typography: {bp.typography}")
            if context_parts:
                sources.append("brand profile")
        finally:
            db.close()
    except Exception as e:
        print(f"Brand profile lookup failed: {e}")

    # Optional enrichment. Any failure here is expected in the current deployment and must
    # not discard the Postgres context gathered above.
    try:
        from core import vector_store

        query_text = f"{state.get('prompt', '')} {state.get('strategy', '')}"

        # Bounded, and off the event loop.
        #
        # vector_store.search is synchronous and, on the local embedding backend, loads
        # sentence-transformers - which contacts huggingface.co to revalidate the model
        # even when the weights are already cached. With no DNS for that host it retries
        # with exponential backoff, and this "optional enrichment" measured 166 SECONDS,
        # 57% of a 288-second generation, for context the pipeline is explicitly written to
        # work without. A timeout is the honest fix: this step may help, it may never block.
        def _search():
            return vector_store.search(state.get("workspace_id"), query_text, [], 3)

        # kinds=[] means every kind this workspace has indexed — the brand scrape, the
        # competitor ad vault and the trend reports are all fair context for a generation.
        raw_hits = await asyncio.wait_for(
            asyncio.to_thread(_search), timeout=_VECTOR_SEARCH_TIMEOUT_SEC)
        hits = [h.get("content", "") for h in (raw_hits or []) if h.get("content")]
        if hits:
            for idx, h in enumerate(hits):
                context_parts.append(f"[RELATED {idx + 1}] {h}")
            sources.append(f"{len(hits)} vector match(es)")
    except asyncio.TimeoutError:
        print(f"Knowledge-base enrichment skipped: slower than "
              f"{_VECTOR_SEARCH_TIMEOUT_SEC}s; generating from the brand profile alone.")
    except Exception as e:
        # Logged, never surfaced into the prompt: an error string pasted in there reads to
        # the model as a fact about the brand.
        print(f"Knowledge-base enrichment unavailable: {e}")

    if context_parts:
        # Only attach the section when there is something in it. The old code always
        # appended a heading, so the model received "KNOWLEDGE BASE CONTEXT:" followed by
        # a sentence explaining that retrieval had failed.
        brand_voice = f"Tone: {brand_voice}\n\nBRAND CONTEXT:\n" + "\n\n".join(context_parts)
        await manager.broadcast_agent_log(
            "RAG Agent", f"Brand context loaded from {' + '.join(sources)}.", "completed")
    else:
        brand_voice = f"Tone: {brand_voice}"
        await manager.broadcast_agent_log(
            "RAG Agent",
            "No brand context found - run onboarding for this workspace to ground creative in the brand.",
            "completed")
    
    state["cached_typography"] = typography
    state["cached_colors"] = colors
    state["cached_brand_voice"] = brand_voice
    return state

async def strategy_and_router_node(state: GenerationState) -> GenerationState:
    msg = "Developing creative strategy and selecting ideal media format..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Creative Director", msg, "thinking")
    
    llm_model = state.get("model") or _DEFAULT_LLM_MODEL
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
    
    llm_model = state.get("model") or _DEFAULT_LLM_MODEL
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

def _seconds_from_length(ad_length: str) -> int:
    """"15s" / "30" / "1m" -> seconds. The UI stores a label, ffmpeg needs a number."""
    text = (ad_length or "").strip().lower()
    m = re.search(r"(\d+)", text)
    if not m:
        return 5
    value = int(m.group(1))
    if "m" in text and "s" not in text:
        value *= 60
    return max(2, min(value, 30))


async def media_generation_node(state: GenerationState) -> GenerationState:
    msg = f"Generating media via {state['selected_image_provider']}..."
    state["logs"].append(msg)
    await manager.broadcast_agent_log("Media Generator", msg, "running")
    
    # Instantiate the right provider.
    #
    # IMAGE_PROVIDER pins one explicitly; otherwise the best available free option is used.
    # Order matters: real FLUX.1-schnell via Hugging Face follows prompts far more closely
    # than Pollinations (a keyless proxy), so it wins whenever a token is configured.
    # NanoBananaProvider (Gemini 2.5 Flash Image) is built and ready — it needs billing on
    # the Gemini key, since the free tier has 0 image quota.
    provider_name = (os.getenv("IMAGE_PROVIDER") or state["selected_image_provider"] or "").lower()
    if provider_name in ("gpt_image", "flux_pro"):
        img_provider = GPTImageProvider()
    elif provider_name in ("nano_banana", "gemini"):
        img_provider = NanoBananaProvider()
    elif provider_name in ("hf_flux", "flux_schnell_hf"):
        img_provider = HFFluxSchnellProvider()
    elif os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_TOKEN"):
        img_provider = HFFluxSchnellProvider()
    else:
        img_provider = FluxSchnellProvider()   # Pollinations — keyless last resort
        
    # Build a FOCUSED visual prompt. Previously the full marketing strategy (prose) was
    # appended here - an image model can't use prose, it latches onto scattered words, so
    # the picture looked unrelated to the request. Use a "creative director" LLM call to
    # turn the request into a premium, poster-quality visual scene description instead.
    llm_model = state.get("model") or _DEFAULT_LLM_MODEL
    art_llm = GeminiProvider() if "gemini" in llm_model.lower() else OpenRouterProvider()
    brand_colors = state.get("cached_colors") or []
    color_hint = f" Incorporate brand colors {', '.join(brand_colors[:3])}." if brand_colors else ""
    # Everything the Brand Knowledge vault knows about how this brand LOOKS.
    #
    # Up to three hex codes was the entire brand signal reaching image generation - no
    # products, no visual language, no positioning - which is why generated creative came
    # back generic for a workspace with a fully populated vault. The brief below is
    # deliberately visual-only: an image model cannot use tone of voice or messaging, and
    # padding the prompt with prose is what made earlier versions latch onto stray words.
    brand_brief = _brand_visual_brief(state.get("workspace_id"))
    try:
        # 60 words / 150 tokens was too tight: a detailed request had to be summarised to fit,
        # and summarising is exactly where the user's specific subjects, colours and style
        # cues got dropped — which reads as "the image ignored my prompt". Diffusion models
        # handle long prompts fine (FLUX takes up to ~512 tokens), so give it room and tell
        # the model to ENRICH rather than condense.
        image_prompt = await art_llm.generate_text(
            # brand_brief goes INSIDE the template now, directly under the user request.
            # Appended at the end it sat after "everything below is polish ... must never
            # replace" and after "avoid: brand names", so the art director dutifully
            # discarded it: a live test produced a prompt containing no product name, no
            # technology and no colourway from a fully populated vault.
            CREATIVE_DIRECTOR_PROMPT.format(user_prompt=state['prompt'],
                                            brand_brief=brand_brief)
            + color_hint,
            system_prompt="You are an art director writing prompts for an image-generation model. "
                          "Output ONLY the final image prompt itself (one paragraph, 60-150 words) - "
                          "no labels, no headers, no marketing copy, no text-overlay instructions. "
                          "Keep every concrete noun, colour, material, setting and style word from "
                          "the user's request verbatim, and add visual detail around them. Never "
                          "summarise away a detail the user specified.",
            model_name=llm_model,
            max_output_tokens=400,
        )
        image_prompt = image_prompt.strip().strip('"')
        # If the art-director step somehow drops the request entirely (empty/refusal), fall
        # back to the user's own words rather than sending a generic scene to the model.
        if len(image_prompt) < 20:
            image_prompt = state.get("prompt", "advertisement")
    except LLMProviderError:
        # Fall back to the raw request (still the subject) rather than the strategy essay.
        image_prompt = state.get("prompt", "advertisement")
    # Light quality suffix only - must not re-impose a style or strip text the user asked for,
    # since CREATIVE_DIRECTOR_PROMPT above already decided style/text based on the user's request.
    # "no text" is only added when the user's own prompt didn't ask for visible text/words/a
    # slogan; otherwise appending it here would silently undo that decision.
    wants_text = bool(re.search(r"\b(text|word|words|slogan|caption|headline|title|written|says?|reads?)\b",
                                 state.get("prompt", ""), re.IGNORECASE))
    no_text_clause = "" if wants_text else ", no text,"
    image_prompt = f"{image_prompt}. High detail, sharp focus{no_text_clause} no watermarks."

    try:
        image_url = await img_provider.generate_image(image_prompt, aspect_ratio=state.get("ad_ratio", "16:9"))
    except Exception as e:
        # Previously this substituted a hardcoded Unsplash photo — the same picture for every
        # failed generation, indistinguishable from a real result. Retry on the keyless
        # provider instead, which at least renders the user's actual prompt, and only give up
        # if that fails too.
        await manager.broadcast_agent_log(
            "System", f"{type(img_provider).__name__} failed ({e}); retrying on the keyless provider.", "running")
        try:
            image_url = await FluxSchnellProvider().generate_image(
                image_prompt, aspect_ratio=state.get("ad_ratio", "16:9"))
        except Exception as e2:
            await manager.broadcast_agent_log("System", f"Image generation failed: {e2}", "failed")
            image_url = ""
    
    state["image_url"] = image_url
    
    # Conditionally trigger video and audio if format requires it
    ad_format = state.get("ad_format", "Video").lower()
    is_video = "video" in ad_format
    is_audio = "audio" in ad_format or is_video
    
    if is_video:
        # Ken Burns FIRST, ahead of stock. Animating the image we just generated is the only
        # option here that is guaranteed to match the brief — stock b-roll is merely keyword-
        # adjacent, and the keyless sample clip (Big Buck Bunny et al) matches nothing at all
        # while also hiding the generated image, since the UI renders <video> over <img>.
        from core.providers.kenburns_video import KenBurnsVideoProvider, is_available as ffmpeg_available
        from core.providers.video_providers import PixabayVideoProvider, PexelsVideoProvider, SampleVideoProvider
        from core.providers.base import VideoProviderError
        state["video_url"] = ""
        ad_ratio = state.get("ad_ratio", "9:16")
        duration = _seconds_from_length(state.get("ad_length", "15s"))

        if ffmpeg_available() and state.get("image_url"):
            await manager.broadcast_agent_log(
                "Video Agent", "Animating the generated creative into a video...", "running")
            try:
                state["video_url"] = await KenBurnsVideoProvider().generate_video(
                    image_url=state["image_url"], prompt=state["prompt"],
                    duration=duration, ad_ratio=ad_ratio,
                    # So the rendered file lands under this tenant's prefix rather than in
                    # a directory shared by every workspace.
                    workspace_id=state.get("workspace_id"))
                await manager.broadcast_agent_log(
                    "Video Agent", "Video rendered from your generated creative.", "completed")
            except VideoProviderError as e:
                await manager.broadcast_agent_log(
                    "Video Agent", f"Could not animate the creative ({e}); falling back to stock.", "running")

        # Stock b-roll: only reached when ffmpeg is unavailable or rendering failed.
        if not state["video_url"]:
            await manager.broadcast_agent_log("Video Agent", "Sourcing a video clip for the ad...", "running")
            for provider in (PixabayVideoProvider(), PexelsVideoProvider()):
                try:
                    state["video_url"] = await provider.generate_video(
                        image_url=state["image_url"], prompt=state["prompt"], ad_ratio=ad_ratio)
                    await manager.broadcast_agent_log("Video Agent", "Relevant video clip sourced (stock b-roll).", "completed")
                    break
                except VideoProviderError:
                    continue
        if not state["video_url"]:
            # Nothing else worked: a rotating keyless sample clip, which matches nothing.
            state["video_url"] = await SampleVideoProvider().generate_video(image_url=state["image_url"], prompt=state["prompt"])
            await manager.broadcast_agent_log(
                "Video Agent",
                "Using an unrelated sample clip — install ffmpeg to animate your own creative, "
                "or add PIXABAY_API_KEY for content-matched footage.", "completed")

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

async def run_ad_generation_task(workspace_id: int, prompt: str, reference_ad: dict = None, model: str = "", ad_format: str = "Video", ad_ratio: str = "9:16", ad_length: str = "15s", engine_mode: str = "Video Ad"):
    """
    Wrapper to execute the generation_graph and push final asset to WebSocket clients.
    """
    current_workspace_id.set(workspace_id)  # scope all broadcasts in this task to this workspace
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
