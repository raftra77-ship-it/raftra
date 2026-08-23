"""
Creator payout requests: a creator submits proof of approved work plus the account to pay,
and someone at Raftra reviews it.

Ported with substantial changes, because the original was the most exposed of the three
routers. It had no authentication anywhere, which meant:

  * GET /api/payouts/admin/all returned every payout request ever made - including
    bank account numbers and IFSC codes - to any anonymous caller.
  * POST /api/payouts/{id}/approve executed a real Razorpay transfer, unauthenticated, and
    fell back to paying a hardcoded 10,000 when no deal was linked to the request.
  * GET /api/payouts/creator/{handle} handed any creator's payout history, with their bank
    details, to anyone who knew their handle.

Here every route requires a signed-in user, creators can only see and file their own
requests, and the review routes are gated behind an explicit "admin" role. That role is not
granted by anything in this codebase today, so those endpoints answer 403 until someone
deliberately sets it - which is the intended state while payouts are still arranged by hand.

No money moves in this file. Approving a request records the decision; the transfer itself is
made deliberately, outside the app.
"""
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import auth
import database
import models

router = APIRouter(prefix="/api/payouts", tags=["payouts"])


class PayoutSubmitRequest(BaseModel):
    creator_handle: str
    creator_name: Optional[str] = "Creator"
    deal_id: Optional[int] = None
    screenshot_url: Optional[str] = None
    token_submitted: Optional[str] = None
    bank_account_holder: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None


class PayoutReviewRequest(BaseModel):
    admin_note: Optional[str] = None


def _clean_handle(value: str) -> str:
    return (value or "").replace("@", "").strip().lower()


def _my_handles(db: Session, user: models.User) -> set:
    rows = db.query(models.Influencer).filter(models.Influencer.user_id == user.id).all()
    return {_clean_handle(r.handle) for r in rows if r.handle}


def _require_admin(user: models.User):
    if (user.role or "") != "admin":
        raise HTTPException(status_code=403, detail="Payout review is restricted.")


def _mask_account(number: Optional[str]) -> Optional[str]:
    """Never echo a full account number back, even to its owner - it only needs to be
    recognisable, and the response travels through logs and browser history."""
    if not number:
        return None
    digits = str(number).strip()
    return f"****{digits[-4:]}" if len(digits) > 4 else "****"


def _serialise(p: models.CreatorPayoutRequest, include_bank: bool = False) -> dict:
    out = {
        "id": p.id,
        "creator_handle": p.creator_handle,
        "creator_name": p.creator_name,
        "deal_id": p.deal_id,
        "status": p.status,
        "admin_note": p.admin_note,
        "payout_ref": p.payout_ref,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "reviewed_at": p.reviewed_at.isoformat() if p.reviewed_at else None,
        "account_number": _mask_account(p.account_number),
        "upi_id": p.upi_id,
    }
    if include_bank:
        out.update({
            "bank_account_holder": p.bank_account_holder,
            "bank_name": p.bank_name,
            "ifsc_code": p.ifsc_code,
        })
    return out


@router.post("/submit")
def submit_payout_request(req: PayoutSubmitRequest, db: Session = Depends(database.get_db),
                          current_user: models.User = Depends(auth.get_current_user)):
    """A creator claims payment for work a brand has approved."""
    handle = _clean_handle(req.creator_handle)
    if handle not in _my_handles(db, current_user):
        raise HTTPException(status_code=403,
                            detail="You can only request payment for your own profile.")
    if not (req.account_number or req.upi_id):
        raise HTTPException(status_code=400,
                            detail="Add a UPI id or a bank account to be paid into.")

    # Link the request to a deal only when that deal is genuinely this creator's. The original
    # matched on either the token or the handle, so a token from someone else's deal would do.
    linked = None
    if req.deal_id:
        linked = db.query(models.InfluencerDeal).filter(
            models.InfluencerDeal.id == req.deal_id,
            models.InfluencerDeal.influencer_handle == handle,
        ).first()
    elif req.token_submitted:
        linked = db.query(models.InfluencerDeal).filter(
            models.InfluencerDeal.brand_release_token == req.token_submitted.strip(),
            models.InfluencerDeal.influencer_handle == handle,
        ).first()

    payout = models.CreatorPayoutRequest(
        creator_handle=handle,
        creator_name=req.creator_name or current_user.first_name or "Creator",
        deal_id=linked.id if linked else None,
        screenshot_url=req.screenshot_url,
        token_submitted=req.token_submitted,
        bank_account_holder=req.bank_account_holder,
        bank_name=req.bank_name,
        account_number=req.account_number,
        ifsc_code=req.ifsc_code,
        upi_id=req.upi_id,
        status="submitted",
    )
    db.add(payout)
    db.commit()
    db.refresh(payout)
    return {
        "status": "success",
        "message": "Payment request submitted. The Raftra team will review it and arrange "
                   "the transfer.",
        "payout": _serialise(payout),
    }


@router.get("/mine")
def get_my_payouts(db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    """The signed-in creator's own requests. Replaces /creator/{handle}."""
    handles = _my_handles(db, current_user)
    if not handles:
        return []
    rows = db.query(models.CreatorPayoutRequest).filter(
        models.CreatorPayoutRequest.creator_handle.in_(list(handles))
    ).order_by(models.CreatorPayoutRequest.created_at.desc()).all()
    return [_serialise(p) for p in rows]


@router.get("/admin/all")
def get_all_payout_requests(db: Session = Depends(database.get_db),
                            current_user: models.User = Depends(auth.get_current_user)):
    _require_admin(current_user)
    rows = db.query(models.CreatorPayoutRequest).order_by(
        models.CreatorPayoutRequest.created_at.desc()).all()
    return [_serialise(p, include_bank=True) for p in rows]


@router.post("/{payout_id}/approve")
def approve_payout_request(payout_id: int, req: Optional[PayoutReviewRequest] = None,
                           db: Session = Depends(database.get_db),
                           current_user: models.User = Depends(auth.get_current_user)):
    """Record that a payout was approved.

    Deliberately does NOT transfer money. The original called initiate_razorpay_payout from
    an unauthenticated endpoint, using a hardcoded 10,000 when no deal was linked, and
    reported a "90% net" disbursement that no commission decision backs. Transfers are made
    by hand until the payout path is built properly.
    """
    _require_admin(current_user)
    payout = db.query(models.CreatorPayoutRequest).filter(
        models.CreatorPayoutRequest.id == payout_id).first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout request not found")
    if payout.status in ("approved", "paid"):
        raise HTTPException(status_code=409, detail=f"Already {payout.status}.")

    amount = None
    if payout.deal_id:
        deal = db.query(models.InfluencerDeal).filter(
            models.InfluencerDeal.id == payout.deal_id).first()
        if deal:
            amount = deal.amount

    payout.status = "approved"
    payout.admin_note = (req.admin_note if req and req.admin_note
                         else "Approved for manual transfer.")
    payout.reviewed_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(payout)
    return {
        "status": "success",
        "message": "Approved. Make the transfer, then mark it paid.",
        "payout": _serialise(payout),
        "deal_amount": amount,
    }


@router.post("/{payout_id}/reject")
def reject_payout_request(payout_id: int, req: PayoutReviewRequest,
                          db: Session = Depends(database.get_db),
                          current_user: models.User = Depends(auth.get_current_user)):
    _require_admin(current_user)
    payout = db.query(models.CreatorPayoutRequest).filter(
        models.CreatorPayoutRequest.id == payout_id).first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout request not found")

    payout.status = "rejected"
    payout.admin_note = req.admin_note or "Proof could not be verified."
    payout.reviewed_at = datetime.datetime.utcnow()
    db.commit()
    return {"status": "success", "message": "Request rejected.", "payout_id": payout.id}


@router.post("/{payout_id}/mark-paid")
def mark_payout_paid(payout_id: int, req: Optional[PayoutReviewRequest] = None,
                     db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Close the loop after a transfer has actually been made, so 'paid' means paid rather
    than 'an endpoint was called'."""
    _require_admin(current_user)
    payout = db.query(models.CreatorPayoutRequest).filter(
        models.CreatorPayoutRequest.id == payout_id).first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout request not found")
    if payout.status != "approved":
        raise HTTPException(status_code=409, detail="Approve the request first.")

    payout.status = "paid"
    payout.payout_ref = (req.admin_note or "").strip() or payout.payout_ref
    payout.reviewed_at = datetime.datetime.utcnow()
    if payout.deal_id:
        deal = db.query(models.InfluencerDeal).filter(
            models.InfluencerDeal.id == payout.deal_id).first()
        if deal:
            deal.status = "paid"
            deal.paid_at = datetime.datetime.utcnow()
    db.commit()
    return {"status": "success", "message": "Marked paid.", "payout_id": payout.id}
