"""Step 6 — the Publish Service.

Orchestrates the whole foundation layer for one audit:

    Audit JSON (existing, unmodified)
        -> normalize_audit()            generic recommendations (schema.py)
        -> detect connected platform    reads the existing connection models
        -> get_converter(platform)      platform-specific payload (converters/)
        -> attach page targets          via PageMappingService (page_mapping.py)
        -> return {"status": "ready_for_publish", "platform": ..., "convertedPayload": ...}

No external API is called from prepare() itself — that stays a pure, read-only preview.
WordPress now has a real, working publish() (publishing/publishers/wordpress.py, reusing
core/wordpress_connect.py) and real page-mapping discovery (PageMappingService.discover()).
GitHub and Shopify are still `status: "not_implemented"` placeholders for both.

What's left for REAL publishing on GitHub / Shopify (WordPress is done):
    1. PageMappingService needs a discoverer for each: walk the GitHub repo tree for a file
       matching the page slug; list Shopify pages/articles and match by handle. Register
       each in page_mapping.py's `_DISCOVERERS` dict — same pattern as `_discover_wordpress`.
    2. Publisher.publish() needs the actual write call: GitHub (create branch, commit file
       change, open PR); Shopify (create an unpublished page/article).
    3. A review/approval gate before publish() is called for real (today, `approved_only`
       exists on prepare()/normalize_audit(), but nothing yet requires it before a route
       calls publish() — see publishing_routes.py).
    4. Retry/error handling and a persisted publish-attempt log (who/when/what/result) —
       WordPress's publish() currently returns errors inline but doesn't log attempts.
"""
from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

import models
from .schema import normalize_audit
from .converters import get_converter
from .page_mapping import PageMappingService

# workspace_id -> connection model, keyed by platform. A dict lookup instead of a large
# if/elif chain, per the "avoid switch statements" requirement.
CONNECTION_MODELS = {
    "github": models.GitHubConnection,
    "wordpress": models.WordPressConnection,
    "shopify": models.ShopifyConnection,
}

# How each connection type proves it's actually usable (not just a row with nulls).
CONNECTION_READY_CHECK = {
    "github": lambda c: bool(c.access_token and c.repo_full_name),
    "wordpress": lambda c: bool(c.app_password and c.site_url),
    "shopify": lambda c: bool(c.access_token and c.shop_domain),
}


class PublishService:
    def __init__(self, db: Session):
        self.db = db
        self.page_mapping = PageMappingService(db)

    def _get_connection(self, workspace_id: int, platform: str):
        model = CONNECTION_MODELS.get(platform)
        if not model:
            return None
        return self.db.query(model).filter(model.workspace_id == workspace_id).first()

    def is_platform_connected(self, workspace_id: int, platform: str) -> bool:
        conn = self._get_connection(workspace_id, platform)
        check = CONNECTION_READY_CHECK.get(platform)
        return bool(conn and check and check(conn))

    def detect_connected_platforms(self, workspace_id: int) -> list[str]:
        """Every platform this workspace has a usable connection for, in a stable order."""
        return [p for p in CONNECTION_MODELS if self.is_platform_connected(workspace_id, p)]

    def _attach_page_targets(self, workspace_id: int, platform: str, payload: list[dict]) -> list[dict]:
        """Fills in file_path / post_id / resource_id from PageMappingService — still None
        when no mapping exists yet, which is the honest, expected state today."""
        key_by_platform = {"github": "file_path", "wordpress": "post_id", "shopify": "resource_id"}
        target_key = key_by_platform.get(platform)
        if not target_key:
            return payload
        for item in payload:
            item[target_key] = self.page_mapping.resolve_target(workspace_id, platform, item.get("page"))
        return payload

    def prepare(self, workspace_id: int, audit: dict, *, pipeline: str, audit_id: int,
               platform: Optional[str] = None, approved_only: bool = False,
               decisions: Optional[dict] = None) -> dict:
        """Input: one audit's JSON (as already stored on SEOAudit.keywords_data["audit"]),
        plus that same row's `decisions` dict (SEOAudit.keywords_data["decisions"]) if the
        caller wants approval state carried through. Output: the converted, platform-shaped
        payload — ready to hand to a Publisher's preview()/validate() (and, once
        implemented, publish()). Never calls an external API.
        """
        target_platform = platform or (self.detect_connected_platforms(workspace_id) or [None])[0]
        if not target_platform:
            return {"status": "no_platform_connected", "platform": None, "convertedPayload": None}

        recommendations = normalize_audit(
            audit, pipeline=pipeline, audit_id=audit_id,
            decisions=decisions, approved_only=approved_only,
        )
        if not recommendations:
            return {"status": "no_recommendations", "platform": target_platform, "convertedPayload": []}

        converter = get_converter(target_platform)
        payload = converter.convert(recommendations)
        payload = self._attach_page_targets(workspace_id, target_platform, payload)

        return {"status": "ready_for_publish", "platform": target_platform, "convertedPayload": payload}
