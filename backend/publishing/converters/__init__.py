"""Step 2 — Platform Converter architecture.

Each converter receives the SAME list[GenericRecommendation] (see ../schema.py) and
translates it into that platform's own payload shape. No converter calls an external API —
that is the Publisher's job (../publishers), and publish() there is still a placeholder.

A registry (not a switch statement, per the "keep it modular" requirement) maps a platform
name to its converter class.
"""
from .base import PlatformConverter
from .github import GitHubConverter
from .wordpress import WordPressConverter
from .shopify import ShopifyConverter

CONVERTERS: dict[str, type[PlatformConverter]] = {
    "github": GitHubConverter,
    "wordpress": WordPressConverter,
    "shopify": ShopifyConverter,
}


def get_converter(platform: str) -> PlatformConverter:
    cls = CONVERTERS.get(platform)
    if not cls:
        raise ValueError(f"No converter registered for platform '{platform}'. "
                         f"Known platforms: {', '.join(CONVERTERS)}")
    return cls()


__all__ = ["PlatformConverter", "GitHubConverter", "WordPressConverter", "ShopifyConverter",
          "CONVERTERS", "get_converter"]
