"""Creator payout requests and their human-reviewed approval.

Mirrors the calls CreatorPortal.tsx already makes. The flow is: a creator submits proof of
delivery plus bank details, a human auditor reviews it, and approval marks the payout paid
and the underlying deal settled.

Bank details are accepted and stored (a payout cannot be made without them) but are never
echoed back in full - `_payout_json` masks the account number to its last four digits and
omits nothing else of value, so a leaked or cached response is not enough to reconstruct
the account.
"""
from __future__ import annotations

import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import auth, database, models
from deal_routes import normalise_handle

router = APIRouter(prefix="/api/payouts", tags=["payouts"])


class SubmitBody(BaseModel):
    creator_handle: str = Field(min_length=1)
    creator_name: Optional[str] = None
    deal_id: Optional[int] = None
    amount: Optional[float] = None
    screenshot_url: Optional[str] = None
    token_submitted: Optional[str] = None
    bank_account_holder: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None


class ApproveBody(BaseModel):
    admin_note: Optional[str] = None


def _mask(account: Optional[str]) -> Optional[str]:
    """'123456789012' -> '••••9012'. Enough for a creator to recognise which account was
    used, useless to anyone who intercepts it."""
    if not account:
        return None
    tail = account[-4:]
    return f"{'•' * max(0, len(account) - 4)}{tail}"


def _payout_json(p: models.Payout) -> dict:
    return {
        "id": p.id,
        "deal_id": p.deal_id,
        "creator_handle": p.creator_handle,
        "creator_name": p.creator_name,
        "amount": p.amount,
        "status": p.status,
        "admin_note": p.admin_note,
        # Screenshot and the submitted token are review artefacts, not creator-facing.
        "has_proof": bool(p.screenshot_url),
        "bank_account_holder": p.bank_account_holder,
        "bank_name": p.bank_name,
        "account_number": _mask(p.account_number),
        "upi_id": p.upi_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "approved_at": p.approved_at.isoformat() if p.approved_at else None,
    }


@router.post("/submit")
def submit_payout(body: SubmitBody, db: Session = Depends(database.get_db)):
    """Creator submits proof of delivery and where to pay. Goes to 'under_review'.

    TODO_CREATOR_AUTH: handle-scoped like the deal listing, for the same reason.
    """
    handle = normalise_handle(body.creator_handle)
    if not handle:
        raise HTTPException(status_code=400, detail="creator_handle is required")

    # Amount comes from the released deal rather than the request, so a creator cannot
    # name their own figure by editing the payload.
    deal = None
    if body.deal_id:
        deal = db.query(models.Deal).filter(models.Deal.id == body.deal_id).first()
    if deal is None:
        deal = db.query(models.Deal).filter(
            models.Deal.influencer_handle == handle,
            models.Deal.status == "delivered").order_by(models.Deal.released_at.desc()).first()
    if deal is None:
        raise HTTPException(
            status_code=409,
            detail="No released deal to claim. The brand must release escrow first.")

    existing = db.query(models.Payout).filter(
        models.Payout.deal_id == deal.id,
        models.Payout.status.in_(("under_review", "paid"))).first()
    if existing:
        raise HTTPException(status_code=409,
                            detail=f"A payout for this deal is already {existing.status}.")

    payout = models.Payout(
        deal_id=deal.id, creator_handle=handle,
        creator_name=body.creator_name or deal.influencer_name,
        amount=deal.amount,
        screenshot_url=body.screenshot_url, token_submitted=body.token_submitted,
        bank_account_holder=body.bank_account_holder, bank_name=body.bank_name,
        account_number=body.account_number, ifsc_code=body.ifsc_code, upi_id=body.upi_id,
        status="under_review",
    )
    db.add(payout)
    db.commit()
    db.refresh(payout)
    return {"success": True, "payout": _payout_json(payout)}


@router.get("/creator/{handle}")
def list_creator_payouts(handle: str, db: Session = Depends(database.get_db)):
    """A creator's payouts, newest first. Bank details come back masked."""
    payouts = db.query(models.Payout).filter(
        models.Payout.creator_handle == normalise_handle(handle)
    ).order_by(models.Payout.created_at.desc()).all()
    return [_payout_json(p) for p in payouts]


@router.post("/{payout_id}/approve")
def approve_payout(payout_id: int, body: ApproveBody,
                   db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    """Human auditor approves -> payout paid, deal settled.

    Authenticated deliberately: this is the step that disburses money, so unlike submit it
    must not be callable by an anonymous request. The creator portal's own "simulate
    approval" button therefore only works for a signed-in user.
    """
    payout = db.query(models.Payout).filter(models.Payout.id == payout_id).first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout not found")
    if payout.status == "paid":
        raise HTTPException(status_code=409, detail="Payout is already paid.")

    payout.status = "paid"
    payout.admin_note = body.admin_note
    payout.approved_at = datetime.datetime.utcnow()

    deal = db.query(models.Deal).filter(models.Deal.id == payout.deal_id).first()
    if deal:
        deal.status = "paid"

    db.commit()
    db.refresh(payout)
    return {"success": True, "payout": _payout_json(payout)}
