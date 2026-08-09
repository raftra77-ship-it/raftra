"""CreativeSpec -> provider-specific prompt. Deterministic; no LLM call.

The analyzer already spent one model call turning the user's sentence into structured fields.
Re-asking a model to turn those fields back into a sentence would be a second call that adds
latency, cost and a fresh chance to drop a detail. Assembly is mechanical, so code does it.

Frontends never see any of this — they send a spec-shaped request and get an asset back. All
provider-specific phrasing lives here and in the providers themselves.
"""
from __future__ import annotations

from .spec import BASE_NEGATIVES, CreativeSpec

# Order matters: image models weight earlier tokens more heavily, so the concrete subject
# leads and stylistic polish trails.
_IMAGE_FIELD_ORDER = (
    ("", "subject_line"),
    ("in ", "environment"),
    ("", "composition"),
    ("", "camera_angle"),
    ("", "lighting"),
    ("", "color_direction"),
    ("", "mood"),
    ("", "style"),
)


def _clean(value: str) -> str:
    return " ".join((value or "").split()).strip(" .,")


def build_image_prompt(spec: CreativeSpec) -> str:
    """One paragraph, subject first, polish last."""
    parts: list[str] = []
    for prefix, field in _IMAGE_FIELD_ORDER:
        raw = spec.subject_line() if field == "subject_line" else getattr(spec, field, "")
        text = _clean(raw)
        if text:
            parts.append(f"{prefix}{text}")

    prompt = ", ".join(parts)

    # Ad creative needs somewhere to put the headline; only say so when the layout does not
    # already describe it, to avoid repeating the same instruction twice.
    if "negative space" not in prompt.lower():
        prompt += ", clean negative space reserved for a headline"

    # Diffusion models render words poorly. Only ask for text when the user actually did.
    if spec.text_in_image and spec.headline:
        prompt += f', with the words "{_clean(spec.headline)}" rendered clearly'

    prompt += ", high detail, sharp focus, professional advertising photography"
    return prompt


def build_negative_prompt(spec: CreativeSpec) -> str:
    """Baseline artefacts plus anything the analyzer flagged, de-duplicated, order preserved."""
    terms = list(BASE_NEGATIVES) + [t for t in (spec.negative_prompt or []) if t]
    if not spec.text_in_image:
        # Unrequested lettering is the single most common way an ad creative is ruined.
        terms += ["text", "words", "letters", "captions", "logos"]
    seen, out = set(), []
    for t in terms:
        key = _clean(t).lower()
        if key and key not in seen:
            seen.add(key)
            out.append(_clean(t))
    return ", ".join(out)


def build_video_motion_prompt(spec: CreativeSpec) -> str:
    """Motion description for a real video model. Ken Burns ignores this (it derives motion
    from the still), but Kling/Wan/Veo consume it, so it is built from the same spec."""
    if not spec.video:
        return _clean(spec.subject_line())
    bits = [_clean(spec.subject_line())]
    for field in ("camera_motion", "subject_motion"):
        text = _clean(getattr(spec.video, field, ""))
        if text:
            bits.append(text)
    if _clean(spec.mood):
        bits.append(_clean(spec.mood))
    return ", ".join(bits)


def build_prompts(spec: CreativeSpec) -> dict:
    """Everything a provider needs, derived in one pass."""
    return {
        "image_prompt": build_image_prompt(spec),
        "negative_prompt": build_negative_prompt(spec),
        "video_prompt": build_video_motion_prompt(spec) if spec.media_type == "video" else "",
        "aspect_ratio": spec.aspect_ratio,
        "duration": spec.video.duration if spec.video else 0,
    }
