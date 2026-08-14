"""CreativeService — orchestrates analyze → optimize → generate → persist.

Sits between the API layer and the providers so that neither the routes nor the frontend
know anything provider-specific. Swapping FLUX for something else touches only
core/providers/; swapping the analyzer touches only analyzer.py.

The row is created and its id returned BEFORE generation starts. The previous endpoint fired
a background task and returned nothing identifiable, so the frontend had no handle to poll,
regenerate from, or attach a variation to — results could only be discovered over WebSocket.
"""
from __future__ import annotations

import datetime
import os
from typing import Optional

import models
from database import SessionLocal

from . import optimizer
from .analyzer import analyze
from .spec import CreativeSpec

# Image providers, keyed by the names agents/creative_nodes/router.py emits.
_IMAGE_PROVIDERS = {
    "hf_flux": "HFFluxSchnellProvider",
    "nano_banana": "NanoBananaProvider",
    "gpt_image": "GPTImageProvider",
    "flux_schnell": "FluxSchnellProvider",
}


def _image_provider(name: str):
    from core.providers import image_providers as ip
    cls = getattr(ip, _IMAGE_PROVIDERS.get(name, "FluxSchnellProvider"), ip.FluxSchnellProvider)
    return cls()


def _video_provider(name: str):
    """Pick the video source. Set VIDEO_PROVIDER in .env to switch; no code change needed.

        kenburns  (default) animates the image WE generated. Always on-prompt, but the
                  motion is camera-only — a slow zoom or pan over a still.
        sample    the original keyless behaviour: a random public test clip
                  (Big Buck Bunny / Jellyfish / Sintel). Real, obvious motion and needs
                  no key, but it is fixed stock footage with NO relationship to the
                  prompt — the same clip shows up for a coffee ad and a car ad.
        stock     keyword-matched stock footage via Pixabay/Pexels. Real motion AND
                  topically relevant, but needs a free PIXABAY_API_KEY / PEXELS_API_KEY
                  and it is generic footage, not your product.

    All three are free. Paid image-to-video providers slot in here the same way.
    """
    choice = (os.getenv("VIDEO_PROVIDER") or name or "kenburns").strip().lower()

    if choice == "sample":
        from core.providers.video_providers import SampleVideoProvider
        return SampleVideoProvider()
    if choice in ("stock", "pixabay", "pexels"):
        from core.providers.video_providers import PixabayVideoProvider, PexelsVideoProvider
        return PexelsVideoProvider() if choice == "pexels" else PixabayVideoProvider()
    from core.providers.kenburns_video import KenBurnsVideoProvider
    return KenBurnsVideoProvider()


class CreativeService:
    """One generation request, start to finish."""

    async def plan(self, *, workspace_id: int, prompt: str, media_type: str = "image",
                   platform: Optional[str] = None, placement: Optional[str] = None,
                   reference_image_url: str = "", options: Optional[dict] = None) -> CreativeSpec:
        """Analyze only — no generation, no DB write. Powers the prompt-preview panel so the
        user can inspect and edit the optimized prompt before spending a generation."""
        options = options or {}
        brand = ""
        try:
            from core.brand_context import get_brand_context
            brand = get_brand_context(workspace_id, query="brand voice and visual identity")
        except Exception:
            brand = ""   # knowledge base offline — analyse without it rather than fail

        spec = await analyze(prompt, media_type=media_type, platform=platform,
                             placement=placement, reference_image_url=reference_image_url,
                             brand_context=brand)
        # Caller-supplied overrides win: these come from explicit UI controls.
        if options.get("style"):
            spec.style = options["style"]
        if options.get("duration") and spec.video:
            spec.video.duration = int(options["duration"])
            spec.apply_platform_defaults()
        return spec

    def create_row(self, *, workspace_id: int, spec: CreativeSpec, prompts: dict,
                   provider: str, parent_id: Optional[int] = None) -> int:
        """Persist the pending creative and return its id immediately."""
        with SessionLocal() as db:
            asset = models.AdAsset(
                workspace_id=workspace_id,
                headline=(spec.headline or spec.product or "Generated creative")[:255],
                body_text=spec.primary_text or "",
                cta=spec.cta or "",
                type=("Video Ad" if spec.media_type == "video" else "Image Ad"),
                status="pending_review",
                generation_status="processing",
                original_prompt=spec.original_prompt,
                optimized_prompt=prompts["image_prompt"],
                creative_spec=spec.model_dump(),
                platform=spec.platform, placement=spec.placement,
                aspect_ratio=spec.aspect_ratio, media_type=spec.media_type,
                provider=provider, model=os.getenv("CREATIVE_ANALYZER_MODEL", "gemini-2.5-flash"),
                reference_image_url=spec.reference_image_url or None,
                parent_id=parent_id,
                created_at=datetime.datetime.utcnow(),
            )
            db.add(asset)
            db.commit()
            db.refresh(asset)
            return asset.id

    async def run(self, creative_id: int, spec: CreativeSpec, prompts: dict,
                  provider_name: str, workspace_id: Optional[int] = None) -> None:
        """Generate the asset, update the row, and push the result to the UI.

        The WebSocket broadcasts are not optional decoration: the Creative Studio renders
        generated assets from `broadcast_creative_asset`, exactly as run_ad_generation_task
        has always done. Without them a generation completes correctly in the database and
        nothing whatsoever appears on screen — which reads as "it isn't generating".
        """
        from core.websocket import manager, current_workspace_id
        if workspace_id:
            current_workspace_id.set(workspace_id)   # scope broadcasts to this workspace

        async def log(agent: str, msg: str, status: str = "running"):
            try:
                await manager.broadcast_agent_log(agent, msg, status)
            except Exception:
                pass   # a dead socket must never fail the generation

        image_url, video_url, error = "", "", None
        await log("Media Generator", f"Generating the {spec.aspect_ratio} creative "
                                     f"via {provider_name}...")
        try:
            img = _image_provider(provider_name)
            image_url = await img.generate_image(
                prompts["image_prompt"],
                aspect_ratio=prompts["aspect_ratio"],
                negative_prompt=prompts["negative_prompt"],
                image_url=spec.reference_image_url or None,
            )
            await log("Media Generator", "Image generated.", "completed")
        except Exception as e:
            error = f"Image generation failed: {e}"
            await log("Media Generator", error, "failed")

        if spec.media_type == "video" and image_url:
            await log("Video Agent", "Animating the generated creative into a video...")
            try:
                vid = _video_provider("kenburns")
                caps = type(vid).capabilities()

                # Send each provider only what it can actually use. Ken Burns and the stock
                # providers do not interpret a motion prompt, so handing them the sectioned
                # one would just be a long string they hash or keyword-search.
                if caps["supports_prompt_motion"]:
                    video_prompt = prompts.get("video_prompt") or prompts["image_prompt"]
                else:
                    video_prompt = prompts.get("stock_query") or prompts["image_prompt"]

                extra = {}
                if caps["supports_negative_prompt"] and prompts.get("video_negative_prompt"):
                    extra["negative_prompt"] = prompts["video_negative_prompt"]

                if os.getenv("CREATIVE_DEBUG_PROMPTS", "").lower() in ("1", "true", "yes"):
                    print(f"\n[creative.debug] provider={caps['provider']} caps={caps}")
                    print(f"[creative.debug] motion_intensity="
                          f"{prompts.get('motion_intensity')}")
                    print(f"[creative.debug] --- VIDEO PROMPT (compiled) ---\n"
                          f"{prompts.get('video_prompt')}")
                    print(f"[creative.debug] --- NEGATIVE PROMPT ---\n"
                          f"{prompts.get('video_negative_prompt')}")
                    print(f"[creative.debug] --- ACTUALLY SENT ---\n{video_prompt}\n")

                video_url = await vid.generate_video(
                    image_url=image_url, prompt=video_prompt,
                    duration=prompts["duration"] or 5, ad_ratio=prompts["aspect_ratio"],
                    **extra)
                await log("Video Agent", "Video rendered from your generated creative.", "completed")
            except Exception as e:
                # An image without motion is still a usable creative — report the video
                # failure but do not throw the whole generation away.
                error = (error + " | " if error else "") + f"Video generation failed: {e}"
                await log("Video Agent", f"Could not render the video: {e}", "failed")

        with SessionLocal() as db:
            asset = db.query(models.AdAsset).filter(models.AdAsset.id == creative_id).first()
            if not asset:
                return
            asset.image_url = image_url or None
            asset.video_url = video_url or None
            asset.error_message = error
            succeeded = bool(image_url) and (spec.media_type != "video" or bool(video_url))
            asset.generation_status = "completed" if succeeded else (
                "completed" if image_url else "failed")
            db.commit()
            payload = {
                "id": asset.id, "workspace_id": asset.workspace_id,
                "headline": asset.headline, "bodyText": asset.body_text, "cta": asset.cta,
                "type": asset.type,
                "imageUrl": asset.image_url or "", "videoUrl": asset.video_url or "",
                "audioUrl": "",
            }

        if image_url or video_url:
            try:
                await manager.broadcast_creative_asset(payload)
            except Exception as e:
                print(f"[creative.service] broadcast failed: {e}")
            await log("System", "Ad generation successfully delivered to UI.", "completed")
        else:
            await log("System", error or "Generation produced no asset.", "failed")

        try:
            from core.agent_status import record_agent_task
            record_agent_task(workspace_id, "CREATIVE",
                              "COMPLETED" if (image_url or video_url) else "FAILED",
                              f"Generated: {(spec.original_prompt or '')[:80]}")
        except Exception:
            pass

    def get(self, creative_id: int, workspace_id: int) -> Optional[dict]:
        """Job/status read. Scoped by workspace so one workspace cannot read another's asset."""
        with SessionLocal() as db:
            a = db.query(models.AdAsset).filter(
                models.AdAsset.id == creative_id,
                models.AdAsset.workspace_id == workspace_id).first()
            if not a:
                return None
            return {
                "creative_id": a.id,
                "status": a.generation_status or "completed",
                "type": a.media_type or ("video" if a.video_url else "image"),
                "original_prompt": a.original_prompt,
                "optimized_prompt": a.optimized_prompt,
                "creative_spec": a.creative_spec,
                "asset_url": a.video_url or a.image_url,
                "image_url": a.image_url,
                "video_url": a.video_url,
                "platform": a.platform,
                "aspect_ratio": a.aspect_ratio,
                "provider": a.provider,
                "parent_id": a.parent_id,
                "headline": a.headline,
                "primary_text": a.body_text,
                "cta": a.cta,
                "error": a.error_message,
                "created_at": a.created_at.isoformat() if a.created_at else None,
            }

    def load_spec(self, creative_id: int, workspace_id: int) -> Optional[CreativeSpec]:
        """Rehydrate the stored spec — the basis for regenerate and variations, so neither
        has to re-ask the model what the user meant."""
        with SessionLocal() as db:
            a = db.query(models.AdAsset).filter(
                models.AdAsset.id == creative_id,
                models.AdAsset.workspace_id == workspace_id).first()
            if not a or not a.creative_spec:
                return None
            try:
                return CreativeSpec(**a.creative_spec)
            except Exception:
                return None


service = CreativeService()
