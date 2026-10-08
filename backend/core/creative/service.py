"""CreativeService — orchestrates analyze → optimize → generate → persist.

Sits between the API layer and the providers so that neither the routes nor the frontend
know anything provider-specific. Swapping FLUX for something else touches only
core/providers/; swapping the analyzer touches only analyzer.py.

The row is created and its id returned BEFORE generation starts. The previous endpoint fired
a background task and returned nothing identifiable, so the frontend had no handle to poll,
regenerate from, or attach a variation to — results could only be discovered over WebSocket.
"""
from __future__ import annotations

import asyncio
import datetime
import os
import random

# Ceiling on the brand-context lookup. It grounds the creative but is not required for one,
# so it may add latency up to this point and no further.
# The Postgres half: profile, brand kit and brand graph. Worth waiting for - it is the
# brand. Measured at 13s cold on a live workspace, near-instant once cached.
_BRAND_FACTS_TIMEOUT_SEC = 30.0
# The vector half: knowledge-base excerpts. Supplementary, and it loads the embedding
# model on first use, so it gets a short budget and is dropped if it overruns.
_BRAND_VECTOR_TIMEOUT_SEC = 6.0
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


def _fetch_image_bytes(url: str) -> bytes:
    """The generated image as bytes, whatever form the provider returned it in.

    Providers disagree: Pollinations hands back an https URL, Gemini a base64 data: URI, and
    the local disk path is relative. All three have to end up as bytes for the overlay.
    """
    import base64
    import httpx

    if not url:
        return b""
    if url.startswith("data:"):
        _, _, payload = url.partition(",")
        return base64.b64decode(payload)
    if url.startswith("/"):
        from pathlib import Path
        from core.providers.kenburns_video import MEDIA_ROOT
        local = Path(MEDIA_ROOT) / url.replace("/api/generated/", "", 1)
        return local.read_bytes() if local.is_file() else b""
    r = httpx.get(url, timeout=30, follow_redirects=True)
    return r.content if r.status_code == 200 else b""


def _brand_facts_for(workspace_id):
    """Palette and brand name for the overlay. Never raises: the overlay has defaults."""
    if not workspace_id:
        return {}
    try:
        from core.rag import brand_facts
        return brand_facts(workspace_id) or {}
    except Exception:
        return {}


try:
    from core.creative.overlay import OverlayUnavailable as _OverlayUnavailable
except Exception:                                    # pragma: no cover - import-time safety
    class _OverlayUnavailable(RuntimeError):
        pass

try:
    from core.creative.compose import NoScreenFound as _NoScreenFound
except Exception:                                    # pragma: no cover - import-time safety
    class _NoScreenFound(RuntimeError):
        pass


class CreativeService:
    """One generation request, start to finish."""

    async def plan(self, *, workspace_id: int, prompt: str, media_type: str = "image",
                   platform: Optional[str] = None, placement: Optional[str] = None,
                   reference_image_url: str = "", options: Optional[dict] = None,
                   input_method: str = "") -> CreativeSpec:
        """Analyze only — no generation, no DB write. Powers the prompt-preview panel so the
        user can inspect and edit the optimized prompt before spending a generation."""
        options = options or {}
        # Brand grounding, fetched in two halves with separate budgets.
        #
        # This was one call behind one 8s timeout. Measured on a live workspace that
        # call takes 41s: 13s for the Postgres half (profile, brand kit, brand graph -
        # 11.5KB of real brand knowledge) and 28s for the vector half, which loads the
        # local embedding model to return a single passage. The timeout therefore fired
        # on EVERY request and discarded BOTH halves, so the analyser was told nothing
        # about the brand no matter how complete the kit was. That is why generated
        # images ignored it.
        #
        # The facts half IS the brand, so it is waited for properly and cached per
        # workspace (only the first request pays). The vector half is supplementary and
        # bounded tightly - if it is slow we generate from the kit rather than nothing.
        brand = ""
        try:
            from core.brand_context import brand_facts_context
            brand = await asyncio.wait_for(
                asyncio.to_thread(brand_facts_context, workspace_id),
                timeout=_BRAND_FACTS_TIMEOUT_SEC)
        except asyncio.TimeoutError:
            print(f"creative: brand facts slower than {_BRAND_FACTS_TIMEOUT_SEC}s; "
                  f"analysing without them.")
        except Exception:
            pass   # knowledge base offline - analyse without it rather than fail

        try:
            from core.brand_context import brand_excerpts
            # The retrieval query is the user's own brief plus the identity terms, not
            # the identity terms alone. A fixed query returned the same voice/colour
            # passages for every request, so the part of the kit that mattered to this
            # brief was never pulled in. The suffix keeps voice and identity in range.
            brand_query = (prompt or "").strip()[:240]
            brand_query = (f"{brand_query} brand voice and visual identity"
                           if brand_query else "brand voice and visual identity")
            extra = await asyncio.wait_for(
                asyncio.to_thread(brand_excerpts, workspace_id, brand_query),
                timeout=_BRAND_VECTOR_TIMEOUT_SEC)
            if extra:
                brand = f"{brand}\n\n{extra}" if brand else extra
        except asyncio.TimeoutError:
            print(f"creative: brand excerpts slower than {_BRAND_VECTOR_TIMEOUT_SEC}s; "
                  f"using the brand kit alone.")
        except Exception:
            pass

        spec = await analyze(prompt, media_type=media_type, platform=platform,
                             placement=placement, reference_image_url=reference_image_url,
                             brand_context=brand, input_method=input_method)
        # Ask for a green screen only when a screenshot exists to replace it with.
        #
        # Requesting one otherwise would be strictly worse: the creative would ship with a
        # blank green rectangle where the product should be. `screenshot_url` comes from the
        # caller; the reference image is the fallback, since a user who supplied one for a
        # device shot is supplying exactly this.
        shot = (options.get("screenshot_url") or "").strip() or reference_image_url
        if shot:
            from .compose import wants_green_screen
            device = wants_green_screen(spec)
            if device:
                spec.screen_device = device

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

        # One seed per run, chosen here and logged, so a generation someone likes can be
        # reproduced. Previously each provider invented its own internally and threw it
        # away, which made a good result a one-off: the same prompt would never return the
        # same picture again.
        seed = random.randint(1, 1_000_000_000)

        await log("Media Generator", f"Generating the {spec.aspect_ratio} creative "
                                     f"via {provider_name} (seed {seed})...")
        async def _make(name: str) -> str:
            return await _image_provider(name).generate_image(
                prompts["image_prompt"],
                aspect_ratio=prompts["aspect_ratio"],
                negative_prompt=prompts["negative_prompt"],
                image_url=spec.reference_image_url or None,
                seed=seed,
            )

        # Walk the provider chain, best first, instead of trying one and then only the
        # keyless floor.
        #
        # The old shape was: routed provider, and on any failure retry flux_schnell.
        # That assumed Pollinations always works. It no longer does - anonymous callers
        # now get HTTP 402 on most requests - so once Hugging Face credits ran out the
        # chain was 402 then 402 and every generation produced nothing, even when
        # another provider was configured. A provider that answers a hard refusal is
        # also put on cooldown so the next generation does not pay for the same round
        # trip again.
        from agents.creative_nodes.router import (
            image_provider_chain, mark_exhausted, is_hard_refusal, exhausted_reason)

        chain = [provider_name] + [n for n in image_provider_chain() if n != provider_name]
        failures = []
        for candidate in chain:
            skip = exhausted_reason(candidate)
            if skip and candidate != chain[-1]:
                failures.append(f"{candidate}: skipped ({skip})")
                continue
            try:
                image_url = await _make(candidate)
                provider_name = candidate
                await log("Media Generator", f"Image generated on {candidate}.", "completed")
                break
            except Exception as e:
                detail = str(e)
                failures.append(f"{candidate}: {detail[:120]}")
                if is_hard_refusal(detail):
                    mark_exhausted(candidate, detail)
                await log("Media Generator",
                          f"{candidate} refused ({detail[:90]}); trying the next provider.",
                          "running")

        if not image_url:
            # Name every provider and why it refused. A generic 'generation failed' sent
            # the user looking for a bug in the prompt when the real answer is that no
            # image provider on this deployment is funded.
            error = ("Image generation failed - no image provider is currently usable. "
                     + " | ".join(failures)
                     + ". Fix: enable billing on the Gemini API key and set "
                       "GEMINI_IMAGE_ENABLED=true (best quality), or top up "
                       "HUGGINGFACE_API_KEY, or set OPENAI_API_KEY.")
            await log("Media Generator", error, "failed")

        # Draw the ad's words on, as real text.
        #
        # The prompt no longer asks the image model for any lettering (optimizer appends an
        # explicit no-text line and leaves a named empty region), because image models
        # cannot type - they paint letter-shaped pixels and misspell every word. The copy
        # the analyser already produced is composited here instead, correctly spelled.
        #
        # Never fatal. A creative without its headline is still a creative; one that failed
        # to generate is not. Any failure here keeps the plain image.
        # Put the customer's real screenshot on the generated device screen, before any copy
        # goes over the top. The prompt asked for a flat green panel precisely so this can
        # replace it; a UI the model invented would be misspelled in every label.
        if image_url and spec.media_type == "image" and getattr(spec, "screen_device", ""):
            shot_url = (prompts.get("screenshot_url")
                        or spec.reference_image_url or "").strip()
            if shot_url:
                try:
                    from core.creative import compose as _compose
                    base = await asyncio.to_thread(_fetch_image_bytes, image_url)
                    shot = await asyncio.to_thread(_fetch_image_bytes, shot_url)
                    if base and shot:
                        merged = await asyncio.to_thread(
                            _compose.composite_screenshot, base, shot)
                        from storage import store_bytes
                        image_url = store_bytes(
                            merged, "creative.png", "image/png",
                            workspace_id=workspace_id, category="creatives")
                        await log("Media Generator",
                                  "Screenshot composited onto the device screen.",
                                  "completed")
                except _NoScreenFound as e:
                    # The model did not produce a usable green panel this run. The plain
                    # image is still a valid creative, so say why and carry on.
                    print(f"creative: screenshot not composited - {e}")
                except Exception as e:
                    print(f"creative: compositing failed ({type(e).__name__}: {e}); "
                          f"keeping the generated screen.")

        if image_url and spec.media_type == "image":
            try:
                from core.creative import overlay as _overlay
                ov = _overlay.build_overlay_spec(spec, _brand_facts_for(workspace_id))
                if _overlay.has_copy(ov):
                    raw = await asyncio.wait_for(
                        asyncio.to_thread(_fetch_image_bytes, image_url), timeout=30)
                    if raw:
                        composed = await asyncio.to_thread(_overlay.render_overlay, raw, ov)
                        from storage import store_bytes
                        image_url = store_bytes(
                            composed, "creative.png", "image/png",
                            workspace_id=workspace_id, category="creatives")
                        await log("Media Generator",
                                  "Headline and call to action rendered onto the creative.",
                                  "completed")
            except _OverlayUnavailable as e:
                # No font on this host. Say so once, plainly - silently shipping a creative
                # with no copy on it looks like the feature is broken.
                print(f"creative: overlay skipped - {e}")
            except Exception as e:
                print(f"creative: overlay failed ({type(e).__name__}: {e}); "
                      f"keeping the plain image.")

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
                #
                # `or type(e).__name__` because some exceptions carry no message at all, and
                # a cancelled task is one of them: a real run stored the reason as
                # "Video generation failed: " with nothing after the colon, which tells the
                # user precisely as much as saying nothing would have.
                reason = str(e) or type(e).__name__
                error = (error + " | " if error else "") + f"Video generation failed: {reason}"
                await log("Video Agent", f"Could not render the video: {e}", "failed")

        with SessionLocal() as db:
            asset = db.query(models.AdAsset).filter(models.AdAsset.id == creative_id).first()
            if not asset:
                return
            # The provider that actually produced the asset, which after a fallback is not
            # the one create_row stored.
            asset.provider = provider_name
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
                # What was REQUESTED. Without it the poller cannot tell "an image ad, which
                # correctly has no video" from "a video ad whose video step failed" — both
                # arrive as status=completed with an image_url and no video_url, so the
                # second was silently shown as a finished image and the user saw a video ad
                # with no video and no explanation.
                "media_type": a.media_type,
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
