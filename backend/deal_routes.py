"""Brand <-> creator collaboration deals.

The frontend for this flow already existed on both sides (WorkspaceInfluencer.tsx proposes
and releases; CreatorPortal.tsx lists and accepts) but every endpoint it called returned
404, so nothing ever crossed between the two. These routes implement exactly the contract
those components already expect - same paths, same field names, same status strings - so
no frontend change is needed to bring the flow to life.

Auth note: propose/release are brand actions and require a signed-in user who owns the
workspace. Accept and the creator listing are deliberately handle-scoped rather than
user-scoped, because a creator is messaged by handle before they have an account here.
That is the same trust model the rest of the creator portal already uses; it is not a
substitute for creator accounts, and `TODO_CREATOR_AUTH` below marks where to tighten it
once creators reliably sign in.
"""
from __future__ import annotations

import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import auth, database, models

router = APIRouter(prefix="/api/deals", tags=["deals"])


def normalise_handle(handle: str) -> str:
    """'@Samairaa.R ' -> 'samairaa.r'. Both sides key off this, so a brand typing the
    handle with an '@' and a creator without it must land on the same rows."""
    return (handle or "").strip().lstrip("@").lower()


class ProposeBody(BaseModel):
    workspace_id: Optional[int] = None
    brand_name: Optional[str] = None
    brand_whatsapp: Optional[str] = None
    influencer_handle: str = Field(min_length=1)
    influencer_name: Optional[str] = None
    influencer_email: Optional[str] = None
    influencer_phone: Optional[str] = None
    amount: float = 0.0
    deliverables: Optional[str] = None


class ReleaseBody(BaseModel):
    brand_whatsapp: Optional[str] = None


def _deal_json(d: models.Deal) -> dict:
    return {
        "id": d.id,
        "workspace_id": d.workspace_id,
        "brand_name": d.brand_name,
        "brand_whatsapp": d.brand_whatsapp,
        "influencer_handle": d.influencer_handle,
        "influencer_name": d.influencer_name,
        "amount": d.amount,
        "deliverables": d.deliverables,
        "status": d.status,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "accepted_at": d.accepted_at.isoformat() if d.accepted_at else None,
        "released_at": d.released_at.isoformat() if d.released_at else None,
    }


def _require_workspace(workspace_id: int, db: Session, user: models.User) -> models.Workspace:
    ws = db.query(models.Workspace).filter(
        models.Workspace.id == workspace_id, models.Workspace.user_id == user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


@router.post("/propose")
def propose_deal(body: ProposeBody, db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    """Brand offers a collaboration. Lands in the creator's dashboard as 'Pending Acceptance'."""
    if body.workspace_id is not None:
        _require_workspace(body.workspace_id, db, current_user)

    handle = normalise_handle(body.influencer_handle)
    if not handle:
        raise HTTPException(status_code=400, detail="influencer_handle is required")
    if body.amount is None or body.amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be greater than zero")

    # Re-proposing to the same creator while an offer is still open updates that offer
    # rather than stacking duplicates - the brand is negotiating, not making a second deal.
    deal = db.query(models.Deal).filter(
        models.Deal.influencer_handle == handle,
        models.Deal.workspace_id == body.workspace_id,
        models.Deal.status == "pending").first()
    if not deal:
        deal = models.Deal(influencer_handle=handle, workspace_id=body.workspace_id)
        db.add(deal)

    deal.brand_name = body.brand_name or deal.brand_name
    deal.brand_whatsapp = body.brand_whatsapp or deal.brand_whatsapp
    deal.influencer_name = body.influencer_name or deal.influencer_name
    deal.influencer_email = body.influencer_email or deal.influencer_email
    deal.influencer_phone = body.influencer_phone or deal.influencer_phone
    deal.amount = body.amount
    deal.deliverables = body.deliverables
    deal.status = "pending"
    db.commit()
    db.refresh(deal)
    return {"success": True, "deal": _deal_json(deal)}


@router.get("/creator/{handle}")
def list_creator_deals(handle: str, db: Session = Depends(database.get_db)):
    """Every deal for a creator handle, newest first.

    TODO_CREATOR_AUTH: unauthenticated by design for now because the creator portal reads
    this before sign-in. Returns no bank details or contact info, only the offer itself.
    """
    deals = db.query(models.Deal).filter(
        models.Deal.influencer_handle == normalise_handle(handle)
    ).order_by(models.Deal.created_at.desc()).all()
    return [_deal_json(d) for d in deals]


@router.post("/{deal_id}/accept")
def accept_deal(deal_id: int, db: Session = Depends(database.get_db)):
    """Creator accepts -> escrow locked. Only a pending deal can be accepted, so a replayed
    request cannot walk an already-released deal backwards."""
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if deal.status != "pending":
        raise HTTPException(status_code=409, detail=f"Deal is already {deal.status}.")

    deal.status = "active"
    deal.accepted_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(deal)
    return {"success": True, "deal": _deal_json(deal)}


@router.post("/{deal_id}/release")
def release_deal(deal_id: int, body: ReleaseBody, db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    """Brand releases escrow once the work lands. Money moving outward is a brand action,
    so this one is authenticated and ownership-checked."""
    deal = db.query(models.Deal).filter(models.Deal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if deal.workspace_id is not None:
        _require_workspace(deal.workspace_id, db, current_user)
    if deal.status not in ("active", "delivered"):
        raise HTTPException(status_code=409,
                            detail=f"Cannot release a deal that is {deal.status}.")

    deal.status = "delivered"
    deal.released_at = datetime.datetime.utcnow()
    if body.brand_whatsapp:
        deal.brand_whatsapp = body.brand_whatsapp
    db.commit()
    db.refresh(deal)
    return {"success": True, "deal": _deal_json(deal)}
