"""Thin, read-only route exposing the publishing foundation (backend/publishing/) so it can
be exercised end-to-end without touching the existing audit pipeline or UI. Reuses the same
SEOAudit rows the existing /seo/audit-report endpoint already reads (workspace_routes.py) —
does not re-crawl, re-score, or call any external platform API.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

import database, models, auth
from publishing.publish_service import PublishService, CONNECTION_MODELS
from publishing.page_mapping import PageMappingService
from publishing.publishers import get_publisher

router = APIRouter(prefix="/api/workspaces", tags=["publishing"])


def _require_workspace(workspace_id: int, db: Session, current_user: models.User):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id,
                                           models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


@router.get("/{workspace_id}/publish-preview")
def publish_preview(workspace_id: int, pipeline: str = "SEO", platform: Optional[str] = None,
                    approved_only: bool = False, db: Session = Depends(database.get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    """Foundation-only preview: takes the latest SEO or GEO audit for this workspace, runs it
    through PublishService, and returns {"status": "ready_for_publish", "platform": ...,
    "convertedPayload": [...]}. No external API is called — see PublishService's docstring
    for what real publishing still needs."""
    _require_workspace(workspace_id, db, current_user)
    if pipeline not in ("SEO", "GEO"):
        raise HTTPException(status_code=400, detail="pipeline must be SEO or GEO")

    row = (db.query(models.SEOAudit)
           .filter(models.SEOAudit.workspace_id == workspace_id)
           .order_by(models.SEOAudit.created_at.desc())
           .all())
    row = next((r for r in row if (r.keywords_data or {}).get("pipeline") == pipeline
               and (r.keywords_data or {}).get("audit")), None)
    if not row:
        raise HTTPException(status_code=404, detail=f"No completed {pipeline} audit yet for this workspace.")

    kd = row.keywords_data or {}
    service = PublishService(db)
    result = service.prepare(
        workspace_id, kd.get("audit") or {}, pipeline=pipeline, audit_id=row.id,
        platform=platform, approved_only=approved_only, decisions=kd.get("decisions"),
    )
    return result


@router.get("/{workspace_id}/publish-platforms")
def publish_platforms(workspace_id: int, db: Session = Depends(database.get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    """Which platforms this workspace has a usable connection for, per PublishService's own
    readiness check (same one prepare() uses to auto-detect a platform)."""
    _require_workspace(workspace_id, db, current_user)
    service = PublishService(db)
    return {"connected_platforms": service.detect_connected_platforms(workspace_id)}


def _get_connection(db: Session, workspace_id: int, platform: str):
    model = CONNECTION_MODELS.get(platform)
    if not model:
        raise HTTPException(status_code=400, detail=f"Unknown platform '{platform}'.")
    conn = db.query(model).filter(model.workspace_id == workspace_id).first()
    if not conn:
        raise HTTPException(status_code=400, detail=f"{platform.capitalize()} is not connected for this workspace.")
    return conn


class DiscoverBody(BaseModel):
    page_url: str


@router.post("/{workspace_id}/publish-discover/{platform}")
async def publish_discover(workspace_id: int, platform: str, body: DiscoverBody,
                           db: Session = Depends(database.get_db),
                           current_user: models.User = Depends(auth.get_current_user)):
    """Would call the platform's own API to find which existing page/post/file a crawled
    page corresponds to, and store the result. Architecture only — no platform is
    implemented yet (see page_mapping.py's empty _DISCOVERERS registry), so this currently
    always responds 400 rather than guessing."""
    _require_workspace(workspace_id, db, current_user)
    conn = _get_connection(db, workspace_id, platform)
    service = PageMappingService(db)
    try:
        mapping = await service.discover(workspace_id, platform, conn, body.page_url)
    except NotImplementedError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not mapping:
        return {"found": False}
    return {"found": True, "page_path": mapping.page_path, "target_ref": mapping.target_ref,
            "target_type": mapping.target_type, "page_url": mapping.page_url}


class PublishBody(BaseModel):
    payload: dict  # one item from /publish-preview's convertedPayload


@router.post("/{workspace_id}/publish/{platform}")
async def publish_now(workspace_id: int, platform: str, body: PublishBody,
                      db: Session = Depends(database.get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    """Calls the platform's publisher. Architecture only for all three platforms right
    now — no external API is called; returns the same preview wrapped as
    "ready_for_publish". Once a platform's publish() is wired to a real API call, this
    route becomes the real, external write — the frontend should only call it after the
    user has explicitly approved the recommendation and confirmed they want to send it to
    this platform."""
    _require_workspace(workspace_id, db, current_user)
    conn = _get_connection(db, workspace_id, platform)
    try:
        publisher = get_publisher(platform, connection=conn)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return await publisher.publish(body.payload)
