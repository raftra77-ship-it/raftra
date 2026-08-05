from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
import database, models, schemas, auth
import datetime
from payments import initiate_razorpay_payout

router = APIRouter(prefix="/api/payouts", tags=["payouts"])

class PayoutSubmitRequest(schemas.BaseModel):
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

class PayoutReviewRequest(schemas.BaseModel):
    admin_note: Optional[str] = None

@router.post("/submit")
def submit_payout_request(req: PayoutSubmitRequest, db: Session = Depends(database.get_db)):
    clean_handle = req.creator_handle.replace("@", "").strip().lower()
    
    # Check if a deal exists matching handle / token
    linked_deal = None
    if req.deal_id:
        linked_deal = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.id == req.deal_id).first()
    elif req.token_submitted:
        linked_deal = db.query(models.InfluencerDeal).filter(
            (models.InfluencerDeal.brand_release_token == req.token_submitted.strip()) |
            (models.InfluencerDeal.influencer_handle == clean_handle)
        ).first()

    payout_req = models.CreatorPayoutRequest(
        creator_handle=clean_handle,
        creator_name=req.creator_name,
        deal_id=linked_deal.id if linked_deal else req.deal_id,
        screenshot_url=req.screenshot_url,
        token_submitted=req.token_submitted,
        bank_account_holder=req.bank_account_holder,
        bank_name=req.bank_name,
        account_number=req.account_number,
        ifsc_code=req.ifsc_code,
        upi_id=req.upi_id,
        status="submitted"
    )
    db.add(payout_req)
    db.commit()
    db.refresh(payout_req)

    return {
        "status": "success",
        "message": "Payout proof submitted successfully! Team Raftra auditors will verify within 15-30 minutes.",
        "payout": {
            "id": payout_req.id,
            "creator_handle": payout_req.creator_handle,
            "status": payout_req.status,
            "created_at": payout_req.created_at.isoformat() if payout_req.created_at else None
        }
    }

@router.get("/creator/{handle}")
def get_creator_payouts(handle: str, db: Session = Depends(database.get_db)):
    clean_handle = handle.replace("@", "").strip().lower()
    payouts = db.query(models.CreatorPayoutRequest).filter(
        models.CreatorPayoutRequest.creator_handle == clean_handle
    ).order_by(models.CreatorPayoutRequest.created_at.desc()).all()
    return payouts

@router.get("/admin/all")
def get_all_payout_requests(db: Session = Depends(database.get_db)):
    payouts = db.query(models.CreatorPayoutRequest).order_by(models.CreatorPayoutRequest.created_at.desc()).all()
    return payouts

@router.post("/{payout_id}/approve")
def approve_payout_request(payout_id: int, req: Optional[PayoutReviewRequest] = None, db: Session = Depends(database.get_db)):
    payout = db.query(models.CreatorPayoutRequest).filter(models.CreatorPayoutRequest.id == payout_id).first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout request not found")

    deal_amount = 10000.0  # default fallback deal amount
    if payout.deal_id:
        deal = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.id == payout.deal_id).first()
        if deal:
            deal_amount = deal.amount
            deal.status = "paid"
            deal.paid_at = datetime.datetime.utcnow()

    bank_details = {
        "accountHolder": payout.bank_account_holder,
        "bankName": payout.bank_name,
        "accountNumber": payout.account_number,
        "ifscCode": payout.ifsc_code,
        "upiId": payout.upi_id
    }

    # Trigger Razorpay Payout transfer
    payout_result = initiate_razorpay_payout(payout.id, payout.creator_name, bank_details, deal_amount)

    payout.status = "paid"
    payout.payout_ref = payout_result.get("payout_ref", f"pout_{payout.id}")
    payout.admin_note = req.admin_note if req and req.admin_note else "Approved by Team Raftra Admin"
    payout.reviewed_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(payout)

    return {
        "status": "success",
        "message": "Payout approved & Razorpay transfer executed successfully!",
        "payout_id": payout.id,
        "amount_disbursed": deal_amount * 0.9,
        "payout_ref": payout.payout_ref
    }

@router.post("/{payout_id}/reject")
def reject_payout_request(payout_id: int, req: PayoutReviewRequest, db: Session = Depends(database.get_db)):
    payout = db.query(models.CreatorPayoutRequest).filter(models.CreatorPayoutRequest.id == payout_id).first()
    if not payout:
        raise HTTPException(status_code=404, detail="Payout request not found")

    payout.status = "rejected"
    payout.admin_note = req.admin_note or "Verification proof invalid or token mismatched."
    payout.reviewed_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(payout)

    return {"status": "success", "message": "Payout request rejected.", "payout_id": payout.id}
