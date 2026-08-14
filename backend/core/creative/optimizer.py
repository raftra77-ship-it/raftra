"""CreativeSpec -> provider-specific prompt. Deterministic; no LLM call.

The analyzer already spent one model call turning the user's sentence into structured fields.
Re-asking a model to turn those fields back into a sentence would be a second call that adds
latency, cost and a fresh chance to drop a detail. Assembly is mechanical, so code does it.

Frontends never see any of this — they send a spec-shaped request and get an asset back. All
provider-specific phrasing lives here and in the providers themselves.
"""
from __future__ import annotations

import re

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


# Style adjectives that consume prompt budget without telling a video model what should
# MOVE. "cinematic" does not describe a physical change over time; "rotates clockwise"
# does. Stripped unless the user explicitly asked for that look.
_EMPTY_STYLE_WORDS = re.compile(
    r"\b(cinematic|stunning|epic|masterpiece|beautiful|gorgeous|breathtaking|"
    r"high[- ]quality|award[- ]winning|ultra[- ]detailed|8k|4k)\b", re.IGNORECASE)


def _strip_empty_style(text: str) -> str:
    return _clean(_EMPTY_STYLE_WORDS.sub("", text or "").replace("  ", " "))


def build_video_motion_prompt(spec: CreativeSpec) -> str:
    """Motion-first, sectioned prompt for a real image-to-video model.

    Structured rather than prose because a single sentence gives the model no ordering and
    no separation between what the subject does and what the camera does — which is how a
    request for a walking woman becomes a still frame with a slow zoom. Sections are
    ordered by importance so a provider with a prompt limit truncates the least critical
    material (environment, continuity) rather than the main action.

    IMPORTANT: only providers advertising `supports_prompt_motion = True` consume this.
    KenBurnsVideoProvider ignores the prompt entirely and is unaffected by this function.
    """
    plan = spec.video
    if not plan:
        return _clean(spec.subject_line())

    subject = _clean(spec.subject or spec.product or spec.subject_line())
    sections: list[str] = [f"SUBJECT:\n{subject}"]

    primary = _clean(plan.effective_primary())
    if primary:
        sections.append(f"PRIMARY ACTION:\n{primary}")
        sections.append(f"SUBJECT MOTION:\n{primary}. The action continues throughout the "
                        f"clip rather than occurring in a single frame.")
    if _clean(plan.camera_motion):
        sections.append(f"CAMERA MOTION:\n{_clean(plan.camera_motion)}")
    if _clean(plan.environment_motion):
        sections.append(f"ENVIRONMENT MOTION:\n{_clean(plan.environment_motion)}")
    if _clean(plan.secondary_motion):
        sections.append(f"SECONDARY MOTION:\n{_clean(plan.secondary_motion)}")

    beats = plan.build_timeline()
    if beats:
        lines = "\n".join(f"{b.start:g}-{b.end:g}s: {_clean(b.action)}" for b in beats)
        sections.append(f"TIMELINE:\n{lines}")

    # Continuity last: important, but the least damaging thing to lose to truncation.
    continuity = [f"Preserve the subject's exact appearance, proportions and colours "
                  f"across every frame."]
    if spec.reference_image_url:
        continuity.append("Use the reference image as the exact visual source; animate the "
                          "subject itself rather than panning or zooming the still.")
    if spec.product:
        continuity.append(f"Preserve the {_clean(spec.product)}'s shape, materials, logo and "
                          "branding exactly. Do not redesign, duplicate or morph it.")
    sections.append("CONTINUITY:\n" + " ".join(continuity))

    # Style is included only when the user actually asked for a look, and never in place
    # of motion instructions.
    style = _strip_empty_style(spec.style)
    if style:
        sections.append(f"STYLE:\n{style}")

    sections.append(f"MOTION INTENSITY:\n{plan.motion_intensity}")
    return "\n\n".join(sections)


# Anti-static constraints. Kept OUT of the main prompt and passed separately, because a
# provider without negative-prompt support would otherwise read "static image" as a
# request for one.
ANTI_STATIC_NEGATIVES = [
    "static image", "still photograph", "minimal motion", "digital zoom only",
    "frozen subject", "frozen background", "subject not performing the requested action",
    "no camera movement",
]


def build_video_negative_prompt(spec: CreativeSpec) -> str:
    """Scene-specific negatives for video. Generic artefact terms plus the failure modes
    that matter for THIS subject — a person needs anatomy protection, a product needs
    geometry protection, and they are not interchangeable."""
    terms = list(ANTI_STATIC_NEGATIVES)
    blob = f"{spec.subject} {spec.product} {spec.original_prompt}".lower()

    if re.search(r"\b(person|woman|man|model|people|runner|hand|face|child)\b", blob):
        terms += ["face distortion", "extra limbs", "deformed hands",
                  "unnatural gait", "identity change", "body morphing"]
    if spec.product or re.search(r"\b(bottle|shoe|phone|product|can|jar|pack)\b", blob):
        terms += ["product deformation", "logo distortion", "colour change",
                  "duplicated product", "shape morphing"]
    if re.search(r"\b(car|vehicle|truck|bike|motorbike)\b", blob):
        terms += ["wheel deformation", "floating vehicle", "vehicle morphing",
                  "incorrect reflections"]

    terms += ["flickering", "warping", "unstable background", "sudden camera jumps"]
    seen, out = set(), []
    for t in terms:
        k = t.lower().strip()
        if k and k not in seen:
            seen.add(k)
            out.append(t)
    return ", ".join(out)


# Marketing jargon that is meaningless to a stock-footage search index. Querying these
# returns phone mockups and screen recordings rather than the subject — searching
# "instagram story coffee brand" finds Instagram UI, not coffee.
_STOCK_NOISE = {
    "ad", "ads", "advert", "advertisement", "campaign", "promo", "promotional", "marketing",
    "instagram", "facebook", "tiktok", "youtube", "linkedin", "reel", "reels", "story",
    "stories", "post", "feed", "shorts", "banner", "creative", "brand", "branding",
    "premium", "luxury", "modern", "professional", "high", "quality", "make", "create",
    "generate", "video", "image", "photo", "shot", "my", "our", "your", "the", "a", "an",
    "for", "with", "and", "of", "on", "in", "to", "at", "is", "this", "that", "from",
}


def build_stock_query(spec: CreativeSpec, max_terms: int = 4) -> str:
    """Search terms for a stock-footage provider (Pixabay/Pexels).

    Derived from the SPEC rather than the raw prompt. The raw sentence is full of platform
    and marketing words that describe the deliverable, not the picture — a stock index only
    understands the subject. `visual_concept`/`subject`/`environment` are exactly the fields
    that describe what is on screen, so they are what gets searched.

    Falls back through product -> original prompt so a sparse spec still yields something.
    """
    sources = [spec.subject, spec.product, spec.visual_concept, spec.environment]
    if not any((s or "").strip() for s in sources):
        sources = [spec.original_prompt]

    seen, terms = set(), []
    for source in sources:
        for raw in re.findall(r"[a-zA-Z]{3,}", (source or "").lower()):
            if raw in _STOCK_NOISE or raw in seen:
                continue
            seen.add(raw)
            terms.append(raw)
            if len(terms) >= max_terms:
                return " ".join(terms)
    return " ".join(terms) or "business technology"


def build_prompts(spec: CreativeSpec) -> dict:
    """Everything a provider needs, derived in one pass."""
    if spec.media_type == "video":
        # Fill any motion layer the analyzer left blank, inferred from the actual action
        # rather than a generic default. See core/creative/motion.py.
        from .motion import infer_motion
        spec.video = infer_motion(spec)
    return {
        "image_prompt": build_image_prompt(spec),
        "negative_prompt": build_negative_prompt(spec),
        "video_prompt": build_video_motion_prompt(spec) if spec.media_type == "video" else "",
        "video_negative_prompt": (build_video_negative_prompt(spec)
                                  if spec.media_type == "video" else ""),
        "motion_intensity": (spec.video.motion_intensity if spec.video else "medium"),
        # Consumed by PixabayVideoProvider / PexelsVideoProvider when stock footage is the
        # chosen motion source. Ignored by Ken Burns, which needs no query.
        "stock_query": build_stock_query(spec),
        "aspect_ratio": spec.aspect_ratio,
        "duration": spec.video.duration if spec.video else 0,
    }
