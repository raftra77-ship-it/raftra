"""Provider routing.

Previously this keyword-matched onto providers that mostly do not exist:

    elif "realism" in request_text or "product" in request_text:
        image_provider = "flux_pro"      # -> GPTImageProvider -> OPENAI_API_KEY unset -> raises

media_generation_node catches that failure and substitutes a hardcoded Unsplash photo, so
ANY prompt containing "product" or "realism" — which is most ad briefs — silently returned
the same stock image every time, no matter what the user asked for.

Now routing only ever names a provider that is actually implemented AND configured. An
unavailable preference degrades to the best working option instead of to a failure.
"""
from __future__ import annotations

import os


def _configured(name: str) -> bool:
    """Is this provider usable right now? Mirrors the checks each provider makes itself."""
    if name == "gpt_image":
        return bool(os.getenv("OPENAI_API_KEY"))
    if name == "hf_flux":
        return bool(os.getenv("HUGGINGFACE_API_KEY") or os.getenv("HF_TOKEN"))
    if name == "nano_banana":
        # Gemini image generation needs billing; only trust an explicit opt-in.
        return bool(os.getenv("GEMINI_API_KEY")) and os.getenv("GEMINI_IMAGE_ENABLED") == "true"
    if name == "flux_schnell":
        return True     # Pollinations is keyless, so it is always available as a floor
    return False


# Best first. Everything here is implemented in core/providers/image_providers.py.
_IMAGE_PREFERENCE = ("hf_flux", "nano_banana", "gpt_image", "flux_schnell")


def best_image_provider() -> str:
    for name in _IMAGE_PREFERENCE:
        if _configured(name):
            return name
    return "flux_schnell"


def router_decision_engine(campaign_goal: str, request_text: str) -> dict:
    """Choose the image/video provider for this request.

    Keyword hints are still honoured — text-heavy creative genuinely does better on a model
    with strong typography — but a hint is only followed when that provider can actually run.
    """
    text = (request_text or "").lower()

    preferred = None
    reason = "Best available configured provider."
    if any(k in text for k in ("typography", "text heavy", "text-heavy", "poster with text")):
        # gpt-image renders legible words far better than FLUX/Pollinations.
        preferred = "gpt_image"
        reason = "Text-heavy creative routed to the strongest typography model."
    elif any(k in text for k in ("edit", "retouch", "modify this")):
        preferred = "gpt_image"
        reason = "Edit request routed to an image-editing capable model."

    if preferred and _configured(preferred):
        image_provider = preferred
    else:
        image_provider = best_image_provider()
        if preferred:
            reason = (f"{preferred} is not configured; using {image_provider} instead.")

    # Video: Ken Burns animates the generated still and needs no key, so it is the floor.
    # A real text-to-video provider slots in here once one is configured.
    video_provider = "kenburns"

    return {"image_provider": image_provider, "video_provider": video_provider,
            "reasoning": reason}
