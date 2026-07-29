"""Step 3 — the Publisher interface.

Every platform implements the same three methods: validate() and preview() are real and
usable today (no external API calls, just connection/payload checks and a human-readable
summary). publish() is a deliberate placeholder — wiring it to the real GitHub/WordPress/
Shopify APIs is future work (see the module docstring in ../publish_service.py for what's
left).

A registry (not a switch statement) maps a platform name to its publisher class.
"""
from .base import Publisher
from .github import GitHubPublisher
from .wordpress import WordPressPublisher
from .shopify import ShopifyPublisher

PUBLISHERS: dict[str, type[Publisher]] = {
    "github": GitHubPublisher,
    "wordpress": WordPressPublisher,
    "shopify": ShopifyPublisher,
}


def get_publisher(platform: str, connection=None) -> Publisher:
    cls = PUBLISHERS.get(platform)
    if not cls:
        raise ValueError(f"No publisher registered for platform '{platform}'. "
                         f"Known platforms: {', '.join(PUBLISHERS)}")
    return cls(connection=connection)


__all__ = ["Publisher", "GitHubPublisher", "WordPressPublisher", "ShopifyPublisher",
          "PUBLISHERS", "get_publisher"]
