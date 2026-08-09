"""CreativeSpec — the structured intermediate representation.

The old pipeline went `user prompt -> one giant prompt string`, which cannot be inspected,
edited, diffed or varied: to make "the same ad but more minimal" you had to re-ask the model
and hope. Here the spec is the source of truth, provider prompts are *derived* from it, and a
variation is a small edit to a few fields rather than a fresh guess.

Everything is optional with a sane default. The analyzer fills what the user actually said
and leaves the rest to defaults — inventing a brand name or audience the user never mentioned
is worse than leaving it blank, because it ends up rendered into the image.
"""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field

from . import platforms


class VideoPlan(BaseModel):
    duration: int = 5
    camera_motion: str = "slow push-in"
    subject_motion: str = ""
    voiceover: str = ""
    scenes: list[dict] = Field(default_factory=list)   # [{duration, visual, camera, motion, text}]


class CreativeSpec(BaseModel):
    """One advertising creative, fully described before any provider is called."""

    # --- what it is about (from the user; blank when they did not say) ---
    product: str = ""
    brand: str = ""
    objective: str = "awareness"          # awareness | consideration | conversion
    audience: str = ""

    # --- where it runs (resolved deterministically via platforms.py) ---
    platform: str = "other"
    placement: str = ""
    media_type: str = "image"             # image | video
    aspect_ratio: str = "1:1"

    # --- how it looks ---
    visual_concept: str = ""              # the single most important field for the image model
    subject: str = ""
    environment: str = ""
    composition: str = "product centred with clean negative space for a headline"
    camera_angle: str = "eye level"
    lighting: str = "soft natural light"
    color_direction: str = ""
    mood: str = ""
    style: str = "premium commercial photography"

    # --- ad copy (a creative is not just a picture) ---
    headline: str = ""
    primary_text: str = ""
    cta: str = ""
    creative_angle: str = ""
    # True only when the user explicitly asked for words rendered INSIDE the image. Diffusion
    # models render text badly, so this stays off unless asked for.
    text_in_image: bool = False

    video: Optional[VideoPlan] = None
    negative_prompt: list[str] = Field(default_factory=list)

    # --- provenance ---
    original_prompt: str = ""
    reference_image_url: str = ""
    # Set when the analyzer could not determine something that materially changes the output.
    clarifying_question: str = ""
    assumptions: list[str] = Field(default_factory=list)

    def apply_platform_defaults(self) -> "CreativeSpec":
        """Resolve platform/placement to a real aspect ratio and clamp video duration.

        Runs AFTER the analyzer so the model never has to know pixel specs — it only names
        the platform, and the published numbers come from platforms.py.
        """
        self.platform = platforms.normalise_platform(self.platform)
        placement = platforms.resolve(self.platform, self.placement, self.media_type)
        self.placement = placement.key
        self.aspect_ratio = placement.aspect_ratio
        if self.media_type == "video":
            if self.video is None:
                self.video = VideoPlan()
            self.video.duration = platforms.clamp_duration(
                self.platform, self.placement, self.video.duration)
        return self

    def subject_line(self) -> str:
        """The concrete thing being shown. visual_concept is authoritative; subject/product
        are fallbacks so a sparse spec still produces something on-brief."""
        for candidate in (self.visual_concept, self.subject, self.product, self.original_prompt):
            if candidate and candidate.strip():
                return candidate.strip()
        return "a premium advertising photograph"

    def variation(self, kind: str) -> "CreativeSpec":
        """A named variation. Edits a few style fields and leaves the subject alone —
        "more minimal" must not change WHAT is being advertised.
        """
        out = self.model_copy(deep=True)
        presets = {
            "luxury":   dict(style="ultra-premium editorial photography", lighting="dramatic low-key side lighting",
                             mood="refined, aspirational", composition="tight hero crop with generous negative space"),
            "minimal":  dict(style="minimalist studio photography", lighting="flat even softbox lighting",
                             mood="calm, uncluttered", environment="seamless plain backdrop",
                             composition="single centred subject, large empty margins"),
            "energetic": dict(style="bold high-contrast commercial photography", lighting="hard directional light with vivid rim highlights",
                              mood="dynamic, high-energy", color_direction="saturated punchy colours"),
            "ugc":      dict(style="candid smartphone photo, natural and unpolished", lighting="available indoor light",
                             mood="authentic, relatable", composition="slightly off-centre handheld framing"),
            "different_background": dict(environment="a clearly different setting from the original, same subject"),
            "different_position":   dict(composition="subject repositioned to the opposite third of the frame"),
        }
        for field, value in presets.get(kind, {}).items():
            setattr(out, field, value)
        out.assumptions = list(out.assumptions) + [f"Variation: {kind}"]
        return out

    def summary(self) -> dict:
        """What the UI shows in the "AI interpretation" panel."""
        return {
            "product": self.product, "brand": self.brand, "objective": self.objective,
            "audience": self.audience, "platform": self.platform, "placement": self.placement,
            "media_type": self.media_type, "aspect_ratio": self.aspect_ratio,
            "visual_concept": self.visual_concept, "style": self.style,
            "lighting": self.lighting, "composition": self.composition, "mood": self.mood,
            "headline": self.headline, "primary_text": self.primary_text, "cta": self.cta,
            "text_in_image": self.text_in_image,
            "video": self.video.model_dump() if self.video else None,
            "negative_prompt": self.negative_prompt,
            "assumptions": self.assumptions,
            "clarifying_question": self.clarifying_question,
        }


# Artefacts that make a generated image unusable as an ad. Merged with anything the analyzer
# adds, so a spec always carries a baseline even when the model returns none.
BASE_NEGATIVES = [
    "watermark", "signature", "stock photo watermark", "blurry", "low resolution",
    "jpeg artifacts", "distorted proportions", "deformed hands", "extra limbs",
    "malformed text", "gibberish text", "duplicated product", "cluttered background",
]
