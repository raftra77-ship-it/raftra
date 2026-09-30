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
#
# nano_banana (Gemini 2.5 Flash Image) is first on quality: it is the model that produces
# genuinely usable ad creative. hf_flux is a good second. flux_schnell (Pollinations) is
# keyless and is the floor, not a choice - it is heavily compressed and, as of this writing,
# rate-limits anonymous callers to 402 most of the time.
_IMAGE_PREFERENCE = ("nano_banana", "hf_flux", "gpt_image", "flux_schnell")


# Providers that answered "no credit" / "quota exceeded" recently.
#
# A depleted key is still a PRESENT key, so _configured() keeps saying yes and the router
# kept choosing a provider that refuses every single call. Each attempt costs a real round
# trip - measured at 1.5-20s before the fallback even starts - on every generation. Once a
# provider says it is out, believe it for a while.
_EXHAUSTED: dict = {}
_COOLDOWN_SEC = 900.0     # 15 minutes: long enough to stop burning time, short enough that
                          # topping up a key is noticed without restarting the server.

# The errors that mean "this will not work until you pay", as opposed to a transient blip.
_HARD_REFUSAL = ("402", "429", "quota", "credit", "billing", "payment required",
                 "resource_exhausted", "insufficient")


def is_hard_refusal(error_text: str) -> bool:
    low = (error_text or "").lower()
    return any(k in low for k in _HARD_REFUSAL)


def mark_exhausted(name: str, reason: str = "") -> None:
    """Remember that this provider is out of credit, so the chain skips it for a while."""
    import time
    _EXHAUSTED[name] = (time.time() + _COOLDOWN_SEC, (reason or "")[:200])


def exhausted_reason(name: str):
    """Why this provider is being skipped, or None if it is not."""
    import time
    hit = _EXHAUSTED.get(name)
    if not hit:
        return None
    if time.time() >= hit[0]:
        _EXHAUSTED.pop(name, None)
        return None
    return hit[1] or "recently returned a credit/quota error"


def image_provider_chain() -> list:
    """Every usable provider, best first, skipping ones known to be out of credit.

    The generation path used to fall back from the routed provider to flux_schnell and
    nowhere else, so a workspace whose HF credits had run out produced nothing once
    Pollinations also started refusing - even if another provider was configured and
    working. Returning the whole chain lets generation use the best one that actually
    answers.
    """
    chain = [n for n in _IMAGE_PREFERENCE if _configured(n) and not exhausted_reason(n)]
    if not chain:
        # Everything is either unconfigured or cooling down. Try the keyless floor anyway:
        # a cooldown is a heuristic, and refusing to attempt anything is worse than one
        # wasted request.
        chain = ["flux_schnell"]
    return chain


def best_image_provider() -> str:
    return image_provider_chain()[0]


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
