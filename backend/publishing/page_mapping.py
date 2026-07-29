"""Step 5 — Page Mapping service.

When a platform is connected later, publishing a fix needs to know where a crawled page
actually lives on that platform:
    /about  ->  GitHub file path        (e.g. "content/about.md")
             |  WordPress page id       (e.g. 42)
             |  Shopify page id         (e.g. "gid://shopify/Page/123")

This service only reads/writes the `PageMapping` table (models.py). It does NOT crawl —
the page path comes from the audit's own `target_url`, which is already the output of the
existing Firecrawl-based crawler (agents/seo_geo.py).

Real discovery — actually calling a platform's read API to find the target_ref — is wired
for WordPress only right now (via core/wordpress_connect.find_page_by_slug, the same real
client the existing `/wordpress/{id}/publish-draft` endpoint already uses). GitHub and
Shopify discovery are not implemented yet; `discover()` raises NotImplementedError for them
rather than guessing, same principle as the rest of this package.
"""
from __future__ import annotations

import datetime
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy.orm import Session

import models
from core import wordpress_connect as wp


async def _discover_wordpress(connection, slug: str) -> Optional[dict]:
    return await wp.find_page_by_slug(connection, slug)


# platform -> async (connection, slug) -> {"id", "type", "link"} | None. Registry instead of
# a switch statement; new platforms add one entry here plus a discoverer function.
_DISCOVERERS = {
    "wordpress": _discover_wordpress,
}


class PageMappingService:
    """Resolves / stores which platform-specific resource a crawled page maps to."""

    def __init__(self, db: Session):
        self.db = db

    @staticmethod
    def path_from_url(url: Optional[str]) -> str:
        if not url:
            return "/"
        return urlparse(url).path or "/"

    @staticmethod
    def slug_from_path(page_path: str) -> Optional[str]:
        """"/about/" -> "about"; "/" -> None (the homepage has no slug to search by — see
        `discover()`'s docstring for why that's left unmapped rather than guessed)."""
        segments = [s for s in (page_path or "").strip("/").split("/") if s]
        return segments[-1] if segments else None

    def get_mapping(self, workspace_id: int, platform: str, page_path: str) -> Optional[models.PageMapping]:
        return (self.db.query(models.PageMapping)
                .filter(models.PageMapping.workspace_id == workspace_id,
                       models.PageMapping.platform == platform,
                       models.PageMapping.page_path == page_path)
                .first())

    def list_mappings(self, workspace_id: int, platform: Optional[str] = None) -> list[models.PageMapping]:
        q = self.db.query(models.PageMapping).filter(models.PageMapping.workspace_id == workspace_id)
        if platform:
            q = q.filter(models.PageMapping.platform == platform)
        return q.all()

    def upsert_mapping(self, workspace_id: int, platform: str, page_path: str, *,
                       page_url: Optional[str] = None, target_ref: Optional[str] = None,
                       target_type: Optional[str] = None) -> models.PageMapping:
        row = self.get_mapping(workspace_id, platform, page_path)
        now = datetime.datetime.utcnow()
        if row:
            if page_url is not None:
                row.page_url = page_url
            if target_ref is not None:
                row.target_ref = target_ref
            if target_type is not None:
                row.target_type = target_type
            row.last_synced_at = now
        else:
            row = models.PageMapping(
                workspace_id=workspace_id, platform=platform, page_path=page_path,
                page_url=page_url, target_ref=target_ref, target_type=target_type,
                last_synced_at=now,
            )
            self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return row

    def resolve_target(self, workspace_id: int, platform: str, page_url: Optional[str]) -> Optional[str]:
        """Best-effort, read-only, no API calls — returns a stored mapping's target_ref, or
        None. Never fabricates a target_ref; a None here means "not mapped yet" (call
        `discover()` to actually try to resolve it)."""
        path = self.path_from_url(page_url)
        row = self.get_mapping(workspace_id, platform, path)
        return row.target_ref if row else None

    async def discover(self, workspace_id: int, platform: str, connection,
                       page_url: Optional[str]) -> Optional[models.PageMapping]:
        """Actually calls the platform's real read API to find the target_ref for a page,
        and stores the result. Only WordPress is implemented (see _DISCOVERERS above).

        Homepage ("/") is intentionally never auto-discovered: WordPress's REST API doesn't
        expose which page is set as the static front page without extra plugin support, so
        guessing would risk silently mapping to the wrong resource. It stays unmapped until
        an explicit mapping is stored via `upsert_mapping()`.
        """
        handler = _DISCOVERERS.get(platform)
        if not handler:
            raise NotImplementedError(
                f"Real page discovery for '{platform}' is not implemented yet. "
                f"Implemented: {', '.join(_DISCOVERERS)}."
            )
        path = self.path_from_url(page_url)
        slug = self.slug_from_path(path)
        if not slug:
            return None
        result = await handler(connection, slug)
        if not result:
            return None
        return self.upsert_mapping(
            workspace_id, platform, path,
            page_url=result.get("link") or page_url,
            target_ref=str(result["id"]), target_type=result["type"],
        )
