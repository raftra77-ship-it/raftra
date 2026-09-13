"""
Creator payout requests: a creator asks to be paid for approved work, with the account to pay
into, and someone at Raftra reviews it and records the transfer.

A request must point at work that is genuinely payable - a direct deal the brand approved
("delivered") or a posted-deal collaboration the brand completed. The earlier version accepted
a free-text token with no link to anything, so a request could be filed for work that did not
exist, and the admin desk had no amount to check it against.

Every route requires a signed-in user; creators see and file only their own requests, and the
review routes require role == "admin" (granted only by backend/scripts/grant_admin.py).

No money moves in this file. Approving records the decision; "paid" is recorded only with the
reference of a transfer that was actually made.
"""
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import auth
import database
import models
from core.marketplace import announce_deal, clean_handle, push, record_deal_event

router = APIRouter(prefix="/api/payouts", tags=["payouts"])


class PayoutSubmitRequest(BaseModel):
    creator_handle: str
    creator_name: Optional[str] = "Creator"
    deal_id: Optional[int] = None
    application_id: Optional[int] = None
    screenshot_url: Optional[str] = None
    token_submitted: Optional[str] = None
    bank_account_holder: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None


class PayoutReviewRequest(BaseModel):
    admin_note: Optional[str] = None
    payout_ref: Optional[str] = None


def _my_handles(db: Session, user: models.User) -> set:
    rows = db.query(models.Influencer).filter(models.Influencer.user_id == user.id).all()
    return {clean_handle(r.handle) for r in rows if r.handle}


def _require_admin(user: models.User):
    if (user.role or "") != "admin":
        raise HTTPException(status_code=403, detail="Payout review is restricted to admins.")


def _mask_account(number: Optional[str]) -> Optional[str]:
    """Never echo a full account number back to the creator - it only needs to be recognisable,
    and the response travels through logs and browser history. Admins get the full number,
    because they make the transfer."""
    if not number:
        return None
    digits = str(number).strip()
    return f"****{digits[-4:]}" if len(digits) > 4 else "****"


def _context(db: Session, p: models.CreatorPayoutRequest) -> dict:
    if p.deal_id:
        deal = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.id == p.deal_id).first()
        if deal:
            token = (p.token_submitted or "").strip()
            return {
                "kind": "deal", "brand_name": deal.brand_name,
                "title": f"{deal.brand_name} — {deal.deliverables}",
                "amount": deal.amount, "work_status": deal.status,
                "token_matches": (token == (deal.brand_release_token or "")) if token else None,
            }
    if p.application_id:
        app = db.query(models.DealApplication).filter(models.DealApplication.id == p.application_id).first()
        if app:
            brief = db.query(models.PostedDeal).filter(models.PostedDeal.id == app.deal_id).first()
            brand = brief.brand_name if brief else "Brand"
            return {
                "kind": "collab", "brand_name": brand,
                "title": f"{brand} — {brief.campaign_name if brief else 'Campaign'}",
                "amount": app.final_price if app.final_price is not None else app.proposed_price,
                "work_status": app.status, "token_matches": None,
            }
    return {"kind": "unlinked", "brand_name": None, "title": "Not linked to any deal",
            "amount": None, "work_status": None, "token_matches": None}


def _serialise(db: Session, p: models.CreatorPayoutRequest, admin: bool = False) -> dict:
    ctx = _context(db, p)
    out = {
        "id": p.id,
        "creator_handle": p.creator_handle,
        "creator_name": p.creator_name,
        "deal_id": p.deal_id,
        "application_id": p.application_id,
        "status": p.status,
        "amount": ctx["amount"],
        "context": ctx,
        "admin_note": p.admin_note,
        "payout_ref": p.payout_ref,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "reviewed_at": p.reviewed_at.isoformat() if p.reviewed_at else None,
        "account_number": p.account_number if admin else _mask_account(p.account_number),
        "upi_id": p.upi_id,
    }
    if admin:
        out.update({
            "bank_account_holder": p.bank_account_holder,
            "bank_name": p.bank_name,
            "ifsc_code": p.ifsc_code,
            "screenshot_url": p.screenshot_url,
            "token_submitted": p.token_submitted,
        })
    return out


def _creator_user_ids(db: Session, handle: str) -> set:
    return {r.user_id for r in db.query(models.Influencer).filter(
        models.Influencer.user_id.isnot(None)).all()
        if clean_handle(r.handle) == clean_handle(handle)}


async def _notify_creator(db: Session, p: models.CreatorPayoutRequest) -> None:
    await push(_creator_user_ids(db, p.creator_handle),
               {"type": "payout_update", "payout": _serialise(db, p)})


def _payout(db: Session, payout_id: int) -> models.CreatorPayoutRequest:
    p = db.query(models.CreatorPayoutRequest).filter(models.CreatorPayoutRequest.id == payout_id).first()
    if not p:
        raise HTTPException(status_code=404, detail="Payout request not found")
    return p


def _application_for(db: Session, p: models.CreatorPayoutRequest):
    if not p.application_id:
        return None
    return db.query(models.DealApplication).filter(models.DealApplication.id == p.application_id).first()


# ---------------------------------------------------------------------------- creator
@router.post("/submit")
def submit_payout_request(req: PayoutSubmitRequest, db: Session = Depends(database.get_db),
                          current_user: models.User = Depends(auth.get_current_user)):
    """A creator claims payment for approved work."""
    handles = _my_handles(db, current_user)
    handle = clean_handle(req.creator_handle)
    if handle not in handles:
        raise HTTPException(status_code=403, detail="You can only request payment for your own profile.")
    has_upi = bool((req.upi_id or "").strip())
    has_bank = bool((req.account_number or "").strip() and (req.ifsc_code or "").strip())
    if not (has_upi or has_bank):
        raise HTTPException(status_code=400,
                            detail="Add a UPI ID, or a bank account number with its IFSC code.")
    if bool(req.deal_id) == bool(req.application_id):
        raise HTTPException(status_code=400, detail="Choose the one piece of work this payment is for.")

    open_request = db.query(models.CreatorPayoutRequest).filter(
        models.CreatorPayoutRequest.status != "rejected",
        (models.CreatorPayoutRequest.deal_id == req.deal_id) if req.deal_id
        else (models.CreatorPayoutRequest.application_id == req.application_id)).first()
    if open_request:
        raise HTTPException(status_code=409,
                            detail=f"Payment for this work was already requested (status: {open_request.status}).")

    app = None
    if req.deal_id:
        deal = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.id == req.deal_id).first()
        if not deal or clean_handle(deal.influencer_handle) not in handles:
            raise HTTPException(status_code=404, detail="Deal not found")
        if deal.status != "delivered":
            raise HTTPException(status_code=409,
                                detail="The brand has not approved this work yet." if deal.status == "active"
                                else f"This deal is {deal.status}, so it cannot be paid.")
    else:
        app = db.query(models.DealApplication).filter(models.DealApplication.id == req.application_id).first()
        if not app or clean_handle(app.creator_handle) not in handles:
            raise HTTPException(status_code=404, detail="Collaboration not found")
        if app.status != "COMPLETED":
            raise HTTPException(status_code=409, detail="The brand has not marked this campaign complete yet.")

    payout = models.CreatorPayoutRequest(
        creator_handle=handle,
        creator_name=req.creator_name or current_user.first_name or "Creator",
        deal_id=req.deal_id,
        application_id=req.application_id,
        screenshot_url=req.screenshot_url,
        token_submitted=(req.token_submitted or "").strip() or None,
        bank_account_holder=req.bank_account_holder,
        bank_name=req.bank_name,
        account_number=(req.account_number or "").strip() or None,
        ifsc_code=(req.ifsc_code or "").strip().upper() or None,
        upi_id=(req.upi_id or "").strip() or None,
        status="submitted",
    )
    db.add(payout)
    if app is not None:
        app.cashout_requested = True
        app.cashout_status = "REQUESTED"
    db.commit()
    db.refresh(payout)
    return {
        "status": "success",
        "message": "Payment request submitted. The Raftra team will review it and make the transfer.",
        "payout": _serialise(db, payout),
    }


@router.get("/mine")
def get_my_payouts(db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    handles = _my_handles(db, current_user)
    if not handles:
        return []
    rows = db.query(models.CreatorPayoutRequest).filter(
        models.CreatorPayoutRequest.creator_handle.in_(list(handles))
    ).order_by(models.CreatorPayoutRequest.created_at.desc()).all()
    return [_serialise(db, p) for p in rows]


# ---------------------------------------------------------------------------- admin
@router.get("/admin/all")
def get_all_payout_requests(status: Optional[str] = None, db: Session = Depends(database.get_db),
                            current_user: models.User = Depends(auth.get_current_user)):
    _require_admin(current_user)
    q = db.query(models.CreatorPayoutRequest)
    if status:
        q = q.filter(models.CreatorPayoutRequest.status == status)
    rows = q.order_by(models.CreatorPayoutRequest.created_at.desc()).all()
    return [_serialise(db, p, admin=True) for p in rows]


@router.post("/{payout_id}/approve")
async def approve_payout_request(payout_id: int, req: Optional[PayoutReviewRequest] = None,
                                 db: Session = Depends(database.get_db),
                                 current_user: models.User = Depends(auth.get_current_user)):
    """Record that the request checks out and a transfer should be made. Transfers nothing."""
    _require_admin(current_user)
    payout = _payout(db, payout_id)
    if payout.status not in ("submitted", "under_review"):
        raise HTTPException(status_code=409, detail=f"This request is already {payout.status}.")
    payout.status = "approved"
    payout.admin_note = (req.admin_note if req and req.admin_note else "Approved for transfer.")
    payout.reviewed_at = datetime.datetime.utcnow()
    app = _application_for(db, payout)
    if app is not None:
        app.cashout_status = "APPROVED"
    db.commit()
    db.refresh(payout)
    await _notify_creator(db, payout)
    return {"status": "success", "message": "Approved. Make the transfer, then mark it paid.",
            "payout": _serialise(db, payout, admin=True)}


@router.post("/{payout_id}/reject")
async def reject_payout_request(payout_id: int, req: PayoutReviewRequest,
                                db: Session = Depends(database.get_db),
                                current_user: models.User = Depends(auth.get_current_user)):
    _require_admin(current_user)
    payout = _payout(db, payout_id)
    if payout.status == "paid":
        raise HTTPException(status_code=409, detail="This request was already paid.")
    note = (req.admin_note or "").strip()
    if not note:
        raise HTTPException(status_code=400, detail="Tell the creator why the request was rejected.")
    payout.status = "rejected"
    payout.admin_note = note
    payout.reviewed_at = datetime.datetime.utcnow()
    app = _application_for(db, payout)
    if app is not None:
        # The creator can correct the details and request again.
        app.cashout_requested = False
        app.cashout_status = None
    db.commit()
    db.refresh(payout)
    await _notify_creator(db, payout)
    return {"status": "success", "message": "Request rejected.", "payout": _serialise(db, payout, admin=True)}


@router.post("/{payout_id}/mark-paid")
async def mark_payout_paid(payout_id: int, req: PayoutReviewRequest,
                           db: Session = Depends(database.get_db),
                           current_user: models.User = Depends(auth.get_current_user)):
    """Close the loop after a transfer has actually been made, with its reference, so "paid"
    means paid rather than "an endpoint was called"."""
    _require_admin(current_user)
    payout = _payout(db, payout_id)
    if payout.status != "approved":
        raise HTTPException(status_code=409, detail="Approve the request first.")
    ref = (req.payout_ref or req.admin_note or "").strip()
    if not ref:
        raise HTTPException(status_code=400,
                            detail="Enter the transfer reference (UTR or UPI transaction id).")

    now = datetime.datetime.utcnow()
    payout.status = "paid"
    payout.payout_ref = ref
    payout.reviewed_at = now
    deal = msg = inf = None
    if payout.deal_id:
        deal = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.id == payout.deal_id).first()
        if deal:
            deal.status = "paid"
            deal.paid_at = now
            msg, inf = record_deal_event(db, deal, "paid")
    app = _application_for(db, payout)
    if app is not None:
        app.cashout_status = "PAID"
    db.commit()
    db.refresh(payout)
    if deal is not None:
        db.refresh(deal)
        await announce_deal(db, deal, msg, inf)
    await _notify_creator(db, payout)
    return {"status": "success", "message": "Marked paid.", "payout": _serialise(db, payout, admin=True)}
