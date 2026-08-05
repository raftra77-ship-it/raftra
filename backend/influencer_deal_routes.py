from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List, Optional
import database, models, schemas, auth
import datetime
import secrets
import smtplib
from email.message import EmailMessage
import os

router = APIRouter(prefix="/api/deals", tags=["deals"])

class DealProposeRequest(schemas.BaseModel):
    workspace_id: Optional[int] = 1
    brand_name: Optional[str] = "Brand Partner"
    brand_email: Optional[str] = "brand@raftra.ai"
    brand_whatsapp: Optional[str] = "9876543210"
    influencer_handle: str  # e.g. "uttarakhandyb.digital" or "@uttarakhandyb.digital"
    influencer_name: Optional[str] = "Creator"
    influencer_email: Optional[str] = None
    influencer_phone: Optional[str] = None
    amount: float
    deliverables: str

class DealAcceptRequest(schemas.BaseModel):
    deal_id: int

class DealReleaseRequest(schemas.BaseModel):
    brand_whatsapp: Optional[str] = None

def send_creator_release_email(creator_email: str, creator_name: str, brand_name: str, brand_whatsapp: str, amount: float, token: str):
    """Sends email to creator with verification token and brand contact number."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    sender_email = os.getenv("SMTP_FROM", smtp_user or "notifications@raftra.ai")

    subject = f"✨ Payment Released & Verification Token: ₹{amount:,.0f} from {brand_name}"
    body = f"""Hi {creator_name},

Great news! {brand_name} has approved your campaign deliverables and released the funds into Raftra Escrow Vault.

📋 DEAL DETAILS:
- Brand Partner: {brand_name}
- Brand Contact Number: {brand_whatsapp}
- Approved Payout Amount: ₹{amount:,.0f}

🔑 YOUR VERIFICATION TOKEN:
{token}

📲 INSTRUCTIONS TO CLAIM PAYOUT:
1. Log in to your Raftra Creator Dashboard (https://raftra.ai)
2. Go to the "Payment Setup" tab.
3. Paste the Verification Token ({token}) and upload a screenshot proof of deliverable approval.
4. Team Raftra Auditors will review and disburse your 90% net payout directly to your bank account / UPI.

Best regards,
Team Raftra Escrow Support
"""

    if smtp_user and smtp_pass:
        try:
            msg = EmailMessage()
            msg['Subject'] = subject
            msg['From'] = sender_email
            msg['To'] = creator_email
            msg.set_content(body)

            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            print(f"Release Email sent successfully to {creator_email}")
        except Exception as e:
            print(f"Failed to send email to {creator_email}: {e}")
    else:
        print(f"[DEV MOCK EMAIL DISPATCH] To: {creator_email}\nSubject: {subject}\nBody:\n{body}\n{'='*50}")

@router.post("/propose")
def propose_deal(req: DealProposeRequest, db: Session = Depends(database.get_db)):
    clean_handle = req.influencer_handle.replace("@", "").strip().lower()
    
    deal = models.InfluencerDeal(
        workspace_id=req.workspace_id,
        brand_name=req.brand_name,
        brand_email=req.brand_email,
        brand_whatsapp=req.brand_whatsapp,
        influencer_handle=clean_handle,
        influencer_name=req.influencer_name,
        influencer_email=req.influencer_email,
        influencer_phone=req.influencer_phone,
        amount=req.amount,
        deliverables=req.deliverables,
        status="pending"
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    return {"status": "success", "deal": {
        "id": deal.id,
        "brand_name": deal.brand_name,
        "influencer_handle": deal.influencer_handle,
        "amount": deal.amount,
        "deliverables": deal.deliverables,
        "status": deal.status,
        "created_at": deal.created_at.isoformat() if deal.created_at else None
    }}

@router.post("/{deal_id}/accept")
def accept_deal(deal_id: int, db: Session = Depends(database.get_db)):
    deal = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
        
    deal.status = "active"
    deal.escrow_locked_at = datetime.datetime.utcnow()
    db.commit()
    db.refresh(deal)
    return {"status": "success", "message": "Deal accepted and Escrow funds locked!", "deal_id": deal.id}

@router.get("/brand/{workspace_id}")
def get_brand_deals(workspace_id: int, db: Session = Depends(database.get_db)):
    deals = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.workspace_id == workspace_id).order_by(models.InfluencerDeal.created_at.desc()).all()
    return deals

@router.get("/creator/{handle}")
def get_creator_deals(handle: str, db: Session = Depends(database.get_db)):
    clean_handle = handle.replace("@", "").strip().lower()
    deals = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.influencer_handle == clean_handle).order_by(models.InfluencerDeal.created_at.desc()).all()
    return deals

@router.post("/{deal_id}/release")
def release_deal_payment(deal_id: int, req: Optional[DealReleaseRequest] = None, background_tasks: BackgroundTasks = None, db: Session = Depends(database.get_db)):
    deal = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    token = f"RAFTRA-VERIFIED-{secrets.token_hex(4).upper()}"
    deal.brand_release_token = token
    deal.status = "delivered"
    deal.brand_released_at = datetime.datetime.utcnow()
    if req and req.brand_whatsapp:
        deal.brand_whatsapp = req.brand_whatsapp
        
    db.commit()
    db.refresh(deal)

    # Email notification to creator
    creator_email = deal.influencer_email or "creator@raftra.ai"
    creator_name = deal.influencer_name or "Creator"
    brand_whatsapp = deal.brand_whatsapp or "Contact Team Raftra"
    
    if background_tasks:
        background_tasks.add_task(send_creator_release_email, creator_email, creator_name, deal.brand_name, brand_whatsapp, deal.amount, token)
    else:
        send_creator_release_email(creator_email, creator_name, deal.brand_name, brand_whatsapp, deal.amount, token)

    return {
        "status": "success",
        "message": "Payment released by Brand. Verification token sent via Email to creator!",
        "token": token,
        "brand_contact_number": brand_whatsapp
    }
