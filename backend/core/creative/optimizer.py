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


_HEX_RE = re.compile(r"#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b")
# Typeface instructions. An image model cannot set type, and where it tries it produces the
# malformed lettering the negative prompt then has to fight.
_FONT_RE = re.compile(
    r",?\s*(?:with|in|using)?\s*(?:a|the)?\s*[A-Za-z0-9 ]{0,24}?"
    r"\b(?:font|typeface|typography)\b[^,.]*", re.IGNORECASE)


# The colour words _hex_to_words can produce. Used to spot a design-token label sitting
# immediately in front of one.
_COLOUR_WORDS = (
    r"(?:near-white|near-black|light grey|dark grey|mid grey|"
    r"(?:pale |deep |vivid )?(?:red|orange|amber|green|teal|sky blue|blue|violet|magenta))"
)
# "Accent Color", "Bg Primary", "Text Primary", "Color Primary 500" - one to three
# capitalised words that are plainly a token name, when a colour word follows them.
_TOKEN_LABEL_RE = re.compile(
    r"\b(?:[A-Z][A-Za-z0-9]*\s+){0,2}"
    # Tertiary/Muted/Subtle/Inverse are as common in design systems as Primary, and leaving
    # them out let "Bg Tertiary near-white" through while "Bg Primary near-white" was caught.
    r"(?:Color|Colour|Primary|Secondary|Tertiary|Quaternary|Accent|Bg|Background|Surface|"
    r"Foreground|Text|Muted|Subtle|Inverse|Neutral|Base|Brand)\s+"
    # Design systems number their shades ("Color Primary 500"), and the digits sit between
    # the label and the colour, so the label has to tolerate one before the lookahead.
    r"(?:\d{2,4}\s+)?"
    r"(?=" + _COLOUR_WORDS + r")",
)

# The same labels, but trailing and parenthesised: "near-white (Bg Primary)".
#
# _TOKEN_LABEL_RE only matches a label that PRECEDES the colour, which is how the brand kit
# stores it. The analyzer frequently reorders it into a parenthetical instead, and that form
# slipped through - so a three-shade neutral palette reached the model as "near-white
# (Bg Primary), near-white (Bg Secondary), near-white (Bg Tertiary)": the same colour three
# times, each made unique by a CSS variable name that means nothing to an image model.
_PAREN_TOKEN_RE = re.compile(
    r"\s*\(\s*(?:[A-Z][A-Za-z0-9]*[\s-]+)*"
    r"(?:Color|Colour|Primary|Secondary|Tertiary|Quaternary|Accent|Bg|Background|Surface|"
    r"Foreground|Text|Muted|Subtle|Inverse|Neutral|Base|Brand)"
    r"(?:[\s-]+[A-Za-z0-9]+)*\s*\)",
    re.I,
)


def _hex_to_words(hex_code: str) -> str:
    """A colour a diffusion model can actually act on.

    Brand design tokens arrive as hex, and the analyzer faithfully writes them into the
    visual fields - a live prompt contained "#38bdf8 for key elements and text in #212529,
    set against a background of #ffffff or #f8f9fa". None of that means anything to an image
    model: it tokenises "38bdf8" as noise and spends attention on it. Naming the colour keeps
    the brand's actual palette in the picture while giving the model something it understands.
    """
    h = hex_code.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    try:
        r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    except ValueError:
        return ""
    import colorsys
    hue, light, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    if light > 0.92:
        return "near-white"
    if light < 0.10:
        return "near-black"
    if sat < 0.12:
        return "light grey" if light > 0.6 else "dark grey" if light < 0.4 else "mid grey"
    names = [(0.04, "red"), (0.11, "orange"), (0.18, "amber"), (0.30, "green"),
             (0.46, "teal"), (0.56, "sky blue"), (0.70, "blue"), (0.80, "violet"),
             (0.92, "magenta"), (1.01, "red")]
    base = next(n for edge, n in names if hue <= edge)
    if light > 0.72:
        return f"pale {base}"
    if light < 0.28:
        return f"deep {base}"
    return f"vivid {base}" if sat > 0.65 else base


def _clean(value: str) -> str:
    """Normalise whitespace, and remove what an image model cannot use.

    Hex codes become colour names; typeface instructions are dropped entirely. Both were
    being passed through verbatim from the brand's design tokens, adding length and noise to
    a prompt whose subject already competes for attention.
    """
    text = " ".join((value or "").split())
    text = _HEX_RE.sub(lambda m: _hex_to_words(m.group(0)) or "", text)
    text = _FONT_RE.sub("", text)
    # Design-token LABELS, now that the hex beside them has become a colour name. The brand
    # kit stores tokens as name+hex ("Bg Primary #f8f9fa"), and the analyzer carries the name
    # across too, leaving "a palette dominated by Bg Primary near-white, Text Primary dark
    # grey". The label is the name of a CSS variable - it describes nothing visual and only
    # competes for the model's attention.
    text = _TOKEN_LABEL_RE.sub("", text)
    text = _PAREN_TOKEN_RE.sub("", text)
    # The substitutions can leave doubled separators behind.
    text = re.sub(r"\s*,\s*(,\s*)+", ", ", text)
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip(" .,")


# Words that carry no visual meaning, so repeating them is harmless and they must not make a
# clause look "already covered".
_STOPWORDS = {
    "a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "with", "its",
    "is", "are", "be", "as", "by", "from", "that", "this", "it", "into", "over", "under",
}


def _adds_something(clause: str, seen: set) -> bool:
    """True when `clause` contributes words the prompt does not already have.

    visual_concept comes back as a complete sentence - subject, setting and action - and the
    fields after it describe the same picture from different angles, so most of their words
    are already present. Measured on a live spec: 'dawn' three times, 'wet city streets'
    twice, and the brand-specific subject reduced to 20 of 84 words. Diffusion models spread
    attention across the whole prompt, so those repeats actively cost the subject its weight.
    A clause is kept only when at least half its meaningful words are new.
    """
    words = [w.strip(".,").lower() for w in clause.split()]
    meaningful = [w for w in words if len(w) > 2 and w not in _STOPWORDS]
    if not meaningful:
        return False
    fresh = [w for w in meaningful if w not in seen]
    return len(fresh) * 2 >= len(meaningful)


def build_image_prompt(spec: CreativeSpec) -> str:
    """One paragraph, subject first, polish last, each idea stated once."""
    parts: list[str] = []
    seen: set = set()
    for prefix, field in _IMAGE_FIELD_ORDER:
        raw = spec.subject_line() if field == "subject_line" else getattr(spec, field, "")
        text = _clean(raw)
        if not text:
            continue
        # The subject always leads; everything after it has to earn its place.
        if field != "subject_line" and not _adds_something(text, seen):
            continue
        # mood / style / color_direction come back as comma-separated attribute lists, and a
        # clause can clear the threshold above while still repeating individual items
        # ("energetic" in mood and again in style). Dropping the repeats keeps the useful
        # half of the clause instead of discarding it whole.
        if field in ("mood", "style", "color_direction", "composition"):
            # `seen` is only updated after a field is appended, so it catches repeats
            # ACROSS fields but not within one. A palette arriving as
            # "near-white, near-white, near-white, dark grey" therefore survived intact and
            # weighted the prompt three times toward one colour. `local` closes that.
            local: set = set()
            kept = []
            for item in (i.strip() for i in text.split(",")):
                key = item.lower()
                if not item or key in seen or key in local:
                    continue
                local.add(key)
                kept.append(item)
            if not kept:
                continue
            text = ", ".join(kept)
        parts.append(f"{prefix}{text}")
        seen.update(w.strip(".,").lower() for w in text.split())
        seen.update(i.strip().lower() for i in text.split(","))

    prompt = ", ".join(parts)

    # Ad creative needs somewhere to put the headline, and the empty area has to land in a
    # PREDICTABLE place or the copy layer cannot rely on it.
    #
    # This used to say "clean negative space reserved for a headline". Two problems. The
    # side was unstated, so the empty area wandered between generations and text could not
    # be composited blind. And naming "a headline" invites the model to write one - the very
    # thing it cannot spell. Naming a concrete side and saying nothing about text fixes both.
    if "negative space" not in prompt.lower() and "empty" not in prompt.lower():
        prompt += (", the subject positioned on the right of the frame, "
                   "the left third of the frame clean and completely empty")

    # Diffusion models render words poorly. Only ask for text when the user actually did.
    if spec.text_in_image and spec.headline:
        prompt += f', with the words "{_clean(spec.headline)}" rendered clearly'

    prompt += ", high detail, sharp focus, professional advertising photography"

    # The no-text instruction, stated positively and last.
    #
    # Text suppression used to live only in the negative prompt, which two of the three
    # providers never receive: Pollinations has no such parameter and Gemini's payload drops
    # it. So on those providers nothing suppressed lettering at all, and the model filled
    # every surface it read as a screen, sign or label with invented glyphs.
    #
    # Stated positively on purpose. "Without any text" puts the word "text" in the prompt,
    # and diffusion models frequently render the nouns inside a negation.
    if not spec.text_in_image:
        prompt += (". No text, no letters, no numbers, no words, no logos, no watermarks "
                   "and no badges anywhere in the image")
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
