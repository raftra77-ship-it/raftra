"""Step 6 — Page Mapping service.

When a platform is connected later, publishing a fix needs to know where a crawled page
actually lives on that platform:
    /about  ->  GitHub file path        (e.g. "content/about.md")
             |  WordPress page id       (e.g. 42)
             |  Shopify page id         (e.g. "gid://shopify/Page/123")

This service only reads/writes the `PageMapping` table (models.py). It does NOT crawl —
the page path comes from the audit's own `target_url`, which is already the output of the
existing Firecrawl-based crawler (agents/seo_geo.py).

Architecture only for now, per spec: no platform's discovery actually calls an external API
yet. `discover()` raises NotImplementedError for every platform (see the empty
`_DISCOVERERS` registry below) rather than guessing a target_ref. TODO (real publishing):
add one entry per platform once its discovery is implemented — e.g. for WordPress, reuse
core/wordpress_connect.py's real REST client to look up a page/post by slug; for GitHub,
walk the repo tree; for Shopify, list pages/articles and match by handle.
"""
from __future__ import annotations

import datetime
from typing import Optional
from urllib.parse import urlparse

from sqlalchemy.orm import Session

import models

# platform -> async (connection, slug) -> {"id", "type", "link"} | None. Registry instead of
# a switch statement; a platform "goes real" by adding one entry here plus a discoverer
# function, without changing discover() itself.
_DISCOVERERS: dict = {}


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
        None. Never fabricates a target_ref; a None here means "not mapped yet"."""
        path = self.path_from_url(page_url)
        row = self.get_mapping(workspace_id, platform, path)
        return row.target_ref if row else None

    async def discover(self, workspace_id: int, platform: str, connection,
                       page_url: Optional[str]) -> Optional[models.PageMapping]:
        """Would call the platform's real read API to find the target_ref for a page, and
        store the result. Architecture only right now — no platform is implemented (see
        _DISCOVERERS above), so this always raises NotImplementedError rather than guessing.
        """
        handler = _DISCOVERERS.get(platform)
        if not handler:
            raise NotImplementedError(
                f"Page discovery for '{platform}' is not implemented yet — architecture only."
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
