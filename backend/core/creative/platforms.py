"""Centralised platform → format configuration.

Deliberately deterministic data, not an LLM call. Asking a model "what aspect ratio is an
Instagram Story" wastes a round trip and can hallucinate; these are published, stable specs.
The analyzer only decides WHICH platform/placement applies — the numbers come from here.

Extend by adding to _PLATFORMS. Nothing else needs to change: the optimizer, the providers
and the API all read through resolve().
"""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class Placement(BaseModel):
    key: str
    label: str
    aspect_ratio: str
    max_duration: int          # seconds; 0 when the placement is image-only
    notes: str = ""


class PlatformConfig(BaseModel):
    key: str
    label: str
    default_placement: str
    placements: dict[str, Placement]


def _p(key: str, label: str, ratio: str, max_duration: int = 0, notes: str = "") -> Placement:
    return Placement(key=key, label=label, aspect_ratio=ratio,
                     max_duration=max_duration, notes=notes)


_PLATFORMS: dict[str, PlatformConfig] = {
    "instagram": PlatformConfig(
        key="instagram", label="Instagram", default_placement="feed",
        placements={
            "feed": _p("feed", "Feed", "4:5", 60, "4:5 occupies the most vertical space in-feed."),
            "square": _p("square", "Feed (square)", "1:1", 60),
            "story": _p("story", "Story", "9:16", 60, "Keep text clear of the top/bottom 250px UI."),
            "reels": _p("reels", "Reels", "9:16", 90),
        }),
    "facebook": PlatformConfig(
        key="facebook", label="Facebook", default_placement="feed",
        placements={
            "feed": _p("feed", "Feed", "1:1", 240),
            "story": _p("story", "Story", "9:16", 120),
            "reels": _p("reels", "Reels", "9:16", 90),
        }),
    "tiktok": PlatformConfig(
        key="tiktok", label="TikTok", default_placement="feed",
        placements={"feed": _p("feed", "In-Feed", "9:16", 60, "Native, unpolished UGC style outperforms studio polish.")}),
    "youtube": PlatformConfig(
        key="youtube", label="YouTube", default_placement="video",
        placements={
            "video": _p("video", "In-stream", "16:9", 60),
            "shorts": _p("shorts", "Shorts", "9:16", 60),
        }),
    "linkedin": PlatformConfig(
        key="linkedin", label="LinkedIn", default_placement="feed",
        placements={"feed": _p("feed", "Feed", "1:1", 30, "Professional tone; avoid hard-sell visuals.")}),
    "google_ads": PlatformConfig(
        key="google_ads", label="Google Ads", default_placement="display",
        placements={
            "display": _p("display", "Display", "1.91:1", 0, "Responsive display; keep text minimal."),
            "square": _p("square", "Display (square)", "1:1", 0),
        }),
    "website": PlatformConfig(
        key="website", label="Website", default_placement="hero",
        placements={"hero": _p("hero", "Hero banner", "16:9", 0)}),
    "other": PlatformConfig(
        key="other", label="Other", default_placement="square",
        placements={"square": _p("square", "Square", "1:1", 30)}),
}

# Ratios the image providers can actually render (core/providers/image_providers.py
# _RATIO_DIMENSIONS). A placement outside this set is snapped to the nearest supported one
# rather than silently handed to a provider that will square it.
_RENDERABLE = {"16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1.0, "4:5": 0.8,
               "5:4": 1.25, "4:3": 4 / 3, "3:4": 0.75, "21:9": 21 / 9}


def _parse_ratio(ratio: str) -> Optional[float]:
    try:
        w, h = ratio.split(":")
        return float(w) / float(h)
    except Exception:
        return None


def nearest_renderable(ratio: str) -> str:
    """Snap an arbitrary ratio to one the image pipeline can actually produce."""
    if ratio in _RENDERABLE:
        return ratio
    value = _parse_ratio(ratio)
    if value is None:
        return "1:1"
    return min(_RENDERABLE.items(), key=lambda kv: abs(kv[1] - value))[0]


def normalise_platform(name: Optional[str]) -> str:
    key = (name or "").strip().lower().replace(" ", "_").replace("-", "_")
    aliases = {"ig": "instagram", "insta": "instagram", "fb": "facebook",
               "google": "google_ads", "googleads": "google_ads", "adwords": "google_ads",
               "yt": "youtube", "shorts": "youtube", "web": "website", "site": "website"}
    key = aliases.get(key, key)
    return key if key in _PLATFORMS else "other"


def resolve(platform: Optional[str], placement: Optional[str] = None,
            media_type: str = "image") -> Placement:
    """The placement to generate for. Falls back to the platform default, and for video
    skips placements that cannot carry video at all."""
    cfg = _PLATFORMS[normalise_platform(platform)]
    key = (placement or "").strip().lower()
    chosen = cfg.placements.get(key) or cfg.placements[cfg.default_placement]

    if media_type == "video" and chosen.max_duration == 0:
        video_capable = [p for p in cfg.placements.values() if p.max_duration > 0]
        if video_capable:
            chosen = video_capable[0]

    return chosen.model_copy(update={"aspect_ratio": nearest_renderable(chosen.aspect_ratio)})


def clamp_duration(platform: Optional[str], placement: Optional[str], seconds: int) -> int:
    """Never plan a clip longer than the placement accepts."""
    spec = resolve(platform, placement, media_type="video")
    limit = spec.max_duration or 30
    return max(2, min(int(seconds or 5), limit))


def list_platforms() -> list[dict]:
    """For the frontend's platform picker — one source of truth, so the UI cannot drift
    from what the backend will actually do."""
    return [
        {"key": c.key, "label": c.label, "default_placement": c.default_placement,
         "placements": [{"key": p.key, "label": p.label, "aspect_ratio": p.aspect_ratio,
                         "max_duration": p.max_duration} for p in c.placements.values()]}
        for c in _PLATFORMS.values()
    ]
