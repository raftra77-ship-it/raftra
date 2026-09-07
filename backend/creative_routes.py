"""Creative Studio API.

Additive: the existing POST /api/agents/{workspace_id}/creative and its LangGraph pipeline
are untouched, so nothing that works today stops working. These routes expose the
spec-driven path with a real creative_id, a pollable job status, and an editable optimized
prompt — none of which the old fire-and-forget endpoint could provide.

Authorisation reuses the same pattern as every other route here: auth.get_current_user plus
an explicit Workspace.user_id check, so a creative can only ever be read or written by the
workspace that owns it.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import auth, database, models
from agents.creative_nodes.router import router_decision_engine
from core.creative import optimizer, platforms
from core.creative.service import service
from core import tenancy

router = APIRouter(prefix="/api/creative", tags=["creative"])

_MAX_PROMPT_CHARS = 2000


def _require_workspace(workspace_id: int, db: Session, user: models.User) -> models.Workspace:
    ws = db.query(models.Workspace).filter(
        models.Workspace.id == workspace_id, tenancy.visible_workspace(user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


class GenerateBody(BaseModel):
    workspace_id: int
    prompt: str = Field(min_length=1, max_length=_MAX_PROMPT_CHARS)
    type: str = "image"                       # image | video
    platform: Optional[str] = None
    placement: Optional[str] = None
    reference_image: Optional[str] = None     # URL or data: URL from the upload endpoint
    # Lets the user run an edited optimized prompt instead of the generated one.
    optimized_prompt_override: Optional[str] = None
    options: dict = Field(default_factory=dict)


class VariationBody(BaseModel):
    workspace_id: int
    kind: str = "minimal"                     # luxury | minimal | energetic | ugc | ...


def _media_type(value: str) -> str:
    v = (value or "image").strip().lower()
    return "video" if v.startswith("video") else "image"


@router.get("/platforms")
def get_platforms(current_user: models.User = Depends(auth.get_current_user)):
    """One source of truth for the platform picker, so the UI cannot drift from what the
    backend will actually render."""
    return {"platforms": platforms.list_platforms()}


@router.get("/templates")
def creative_templates(workspace_id: int, db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """Creative frameworks, grounded in this workspace's own brand kit.

    Two things were wrong with the hardcoded version this replaces. It carried invented
    performance numbers - "3.4% Avg CTR", "5.2% Avg CTR" - which no workspace had ever
    measured and nothing in the schema tracks, so they were presented as evidence while
    being decoration. And the descriptions named a specific brand's products ("Ambrane
    product", "22.5W Power Delivery") regardless of whose workspace was open.

    The frameworks themselves are legitimate: PAS, before/after, unboxing and urgency are
    standard direct-response structures, not invented. So they stay - but described in
    terms of THIS brand's categories and USPs, and with no metric attached unless the
    workspace has actually generated assets to count.
    """
    ws = (db.query(models.Workspace)
            .filter(models.Workspace.id == workspace_id,
                    tenancy.visible_workspace(current_user)).first())
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")

    bp = (db.query(models.BrandProfile)
            .filter(models.BrandProfile.workspace_id == workspace_id).first())
    guidelines = (bp.guidelines if bp else None) or {}
    categories = [str(c) for c in (guidelines.get("categories") or []) if str(c).strip()]
    usps_raw = guidelines.get("usps") or ""
    usps = [u.lstrip("- ").strip() for u in str(usps_raw).splitlines() if u.strip()]

    product = categories[0] if categories else (ws.name or "your product")
    usp = usps[0] if usps else ""
    brand = ws.name or "your brand"

    generated = (db.query(models.AdAsset)
                   .filter(models.AdAsset.workspace_id == workspace_id).count())

    frameworks = [
        {"key": "pas", "name": "Problem-Agitate-Solution (PAS)",
         "desc": "Open on the pain your buyer already feels, make it concrete, then show "
                 "%s as the fix." % product},
        {"key": "before_after", "name": "Before vs After Showcase",
         "desc": "Show the situation without %s beside the situation with it. Strongest "
                 "when the difference is visible in one frame." % product},
        {"key": "unboxing", "name": "Unboxing & First Reaction",
         "desc": "UGC-style first look at %s. Reads as a real person's opinion rather than "
                 "an ad, which is what carries it on Reels and Shorts." % product},
        {"key": "urgency", "name": "Flash Sale & Urgency Trigger",
         "desc": "A dated offer on %s with the deadline visible in the first frame. Use for "
                 "retargeting, not cold traffic." % product},
        {"key": "proof", "name": "Proof & Credibility",
         "desc": ("Lead with %s." % usp) if usp else
                 "Lead with a checkable claim - a certification, a warranty, a test result."},
        {"key": "scenario", "name": "Scenario / Use-Case Series",
         "desc": "One everyday moment per creative, each ending on %s. Builds a repeatable "
                 "series rather than a single ad." % brand},
    ]

    return {
        "frameworks": frameworks,
        # Honest, workspace-real context instead of a fabricated per-framework CTR.
        "assets_generated": generated,
        "brand_grounded": bool(categories or usps),
        "note": "" if (categories or usps) else
                "Run Sync Knowledge Graph so these frameworks can reference your own "
                "products and USPs instead of generic wording.",
    }


@router.post("/analyze")
async def analyze_only(body: GenerateBody, db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """Prompt preview: returns the spec and the optimized prompt WITHOUT generating.

    Free-tier friendly by design — the user can inspect and edit the interpretation before
    spending an image generation on it.
    """
    _require_workspace(body.workspace_id, db, current_user)
    spec = await service.plan(
        workspace_id=body.workspace_id, prompt=body.prompt, media_type=_media_type(body.type),
        platform=body.platform, placement=body.placement,
        reference_image_url=body.reference_image or "", options=body.options)
    prompts = optimizer.build_prompts(spec)
    return {"success": True, "creative_spec": spec.summary(),
            "optimized_prompt": prompts["image_prompt"],
            "negative_prompt": prompts["negative_prompt"],
            "aspect_ratio": prompts["aspect_ratio"],
            "clarifying_question": spec.clarifying_question}


@router.post("/generate")
async def generate(body: GenerateBody, background: BackgroundTasks,
                   db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    """Analyze, plan, persist, then generate in the background.

    Returns creative_id immediately so the caller can poll /jobs/{id}; generation itself may
    take 20-60s (image provider, then ffmpeg for video), which is far too long to hold a
    request open.
    """
    _require_workspace(body.workspace_id, db, current_user)
    media_type = _media_type(body.type)

    spec = await service.plan(
        workspace_id=body.workspace_id, prompt=body.prompt, media_type=media_type,
        platform=body.platform, placement=body.placement,
        reference_image_url=body.reference_image or "", options=body.options)

    prompts = optimizer.build_prompts(spec)
    # An edited prompt from the preview panel wins over the generated one.
    if body.optimized_prompt_override:
        prompts["image_prompt"] = body.optimized_prompt_override[:_MAX_PROMPT_CHARS]

    provider_name = router_decision_engine("conversion", body.prompt)["image_provider"]
    creative_id = service.create_row(workspace_id=body.workspace_id, spec=spec,
                                     prompts=prompts, provider=provider_name)
    background.add_task(service.run, creative_id, spec, prompts, provider_name,
                        body.workspace_id)

    return {"success": True, "creative_id": creative_id, "type": media_type,
            "status": "processing",
            "original_prompt": spec.original_prompt,
            "optimized_prompt": prompts["image_prompt"],
            "negative_prompt": prompts["negative_prompt"],
            "creative_spec": spec.summary(),
            "aspect_ratio": prompts["aspect_ratio"],
            "provider": provider_name,
            "clarifying_question": spec.clarifying_question,
            "poll_url": f"/api/creative/jobs/{creative_id}?workspace_id={body.workspace_id}"}


@router.get("/jobs/{creative_id}")
def job_status(creative_id: int, workspace_id: int, db: Session = Depends(database.get_db),
               current_user: models.User = Depends(auth.get_current_user)):
    """Poll a generation. 404 rather than 403 for someone else's asset, so the endpoint does
    not confirm that an id exists in another workspace."""
    _require_workspace(workspace_id, db, current_user)
    data = service.get(creative_id, workspace_id)
    if not data:
        raise HTTPException(status_code=404, detail="Creative not found.")
    return {"success": True, **data}


@router.post("/{creative_id}/variation")
async def make_variation(creative_id: int, body: VariationBody, background: BackgroundTasks,
                         db: Session = Depends(database.get_db),
                         current_user: models.User = Depends(auth.get_current_user)):
    """A named variation of an existing creative.

    Edits the stored spec rather than re-analysing the prompt, so "more minimal" changes the
    styling and provably keeps the same subject. Linked via the AdAsset.parent_id column that
    already existed.
    """
    _require_workspace(body.workspace_id, db, current_user)
    parent = service.load_spec(creative_id, body.workspace_id)
    if not parent:
        raise HTTPException(status_code=404,
                            detail="No stored creative specification for that creative.")

    spec = parent.variation(body.kind)
    prompts = optimizer.build_prompts(spec)
    provider_name = router_decision_engine("conversion", spec.original_prompt or "")["image_provider"]
    new_id = service.create_row(workspace_id=body.workspace_id, spec=spec, prompts=prompts,
                                provider=provider_name, parent_id=creative_id)
    background.add_task(service.run, new_id, spec, prompts, provider_name, body.workspace_id)
    return {"success": True, "creative_id": new_id, "parent_id": creative_id,
            "kind": body.kind, "status": "processing",
            "optimized_prompt": prompts["image_prompt"],
            "creative_spec": spec.summary(),
            "poll_url": f"/api/creative/jobs/{new_id}?workspace_id={body.workspace_id}"}
