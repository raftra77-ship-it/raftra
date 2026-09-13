"""
Brand <-> creator direct deals.

Lifecycle, and who may move it:

    pending   --creator accepts-->  active   --brand approves the work-->  delivered
    pending   --creator declines--> declined
    pending   --brand withdraws-->  cancelled
    delivered --admin marks the payout paid (payout_routes)-->  paid

Every route checks the caller is a party to the deal - the brand through its workspace, the
creator through their own handle. Each transition is also written into the pair's
conversation as a system message and pushed to both sides live, so the chat thread is the
single place a deal is read. The brand chat used to "accept the deal as the influencer" on the
brand's own screen and then announce a Razorpay escrow payment that never happened; neither
exists here.

Scope note: no money moves in this file. escrow_locked_at stays null because nothing is
charged; paid_at is written only when an admin records a real transfer.
"""
import datetime
import os
import secrets
import smtplib
from email.message import EmailMessage
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import auth
import database
import models
from core import tenancy
from core.marketplace import announce_deal, clean_handle, deal_json, record_deal_event

router = APIRouter(prefix="/api/deals", tags=["deals"])

# Used when composing plain-text enquiry emails.
NEWLINE = chr(10)


# ---------------------------------------------------------------------------- request bodies
class DealProposeRequest(BaseModel):
    workspace_id: int
    influencer_handle: str
    influencer_name: Optional[str] = "Creator"
    influencer_email: Optional[str] = None
    influencer_phone: Optional[str] = None
    amount: float
    deliverables: str
    brand_whatsapp: Optional[str] = None


class DealReleaseRequest(BaseModel):
    brand_whatsapp: Optional[str] = None


# ---------------------------------------------------------------------------- helpers
def _owned_workspace(workspace_id: int, db: Session, user: models.User) -> models.Workspace:
    ws = db.query(models.Workspace).filter(
        models.Workspace.id == workspace_id,
        tenancy.visible_workspace(user),
    ).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


def _deal_as_brand(deal_id: int, db: Session, user: models.User) -> models.InfluencerDeal:
    """The deal, but only if this user can reach the workspace that raised it. A 404 rather than
    a 403 for someone else's deal, so the endpoint does not confirm which ids exist."""
    deal = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    owns = db.query(models.Workspace).filter(
        models.Workspace.id == deal.workspace_id,
        tenancy.visible_workspace(user),
    ).first()
    if not owns:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


def _my_handles(db: Session, user: models.User) -> set:
    rows = db.query(models.Influencer).filter(models.Influencer.user_id == user.id).all()
    return {clean_handle(r.handle) for r in rows if r.handle}


def _deal_as_creator(deal_id: int, db: Session, user: models.User) -> models.InfluencerDeal:
    deal = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.id == deal_id).first()
    if not deal or clean_handle(deal.influencer_handle) not in _my_handles(db, user):
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


def send_creator_release_email(creator_email: str, creator_name: str, brand_name: str,
                               brand_whatsapp: str, amount: float, token: str):
    """Tells the creator the brand approved the work and gives them the verification code.

    Deliberately does not say funds were released or held: no payment is taken anywhere in
    this flow, and the payout is arranged by the Raftra team.
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    sender_email = os.getenv("SMTP_FROM", smtp_user or "notifications@raftra.ai")

    subject = f"{brand_name} approved your deliverables - request your payment on Raftra"
    body = f"""Hi {creator_name},

{brand_name} has reviewed your campaign deliverables and approved them.

DEAL DETAILS
- Brand: {brand_name}
- Agreed amount: Rs {amount:,.0f}

YOUR VERIFICATION CODE
{token}

WHAT HAPPENS NEXT
Open Payment Setup in your Raftra creator dashboard, choose this deal and add the account to
be paid into. The Raftra team reviews the request and makes the transfer.

Team Raftra
"""

    if smtp_user and smtp_pass:
        try:
            msg = EmailMessage()
            msg["Subject"] = subject
            msg["From"] = sender_email
            msg["To"] = creator_email
            msg.set_content(body)
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            print(f"[deals] release email sent to {creator_email}")
        except Exception as e:
            print(f"[deals] failed to email {creator_email}: {e}")
    else:
        print(f"[deals] SMTP not configured - release email NOT sent to {creator_email}.")


# ---------------------------------------------------------------------------- routes
@router.post("/propose")
async def propose_deal(req: DealProposeRequest, db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """Brand offers terms to a creator. The brand's identity comes from the workspace, never from
    the request body."""
    ws = _owned_workspace(req.workspace_id, db, current_user)

    handle = clean_handle(req.influencer_handle)
    if not handle:
        raise HTTPException(status_code=400, detail="A creator handle is required.")
    if req.amount is None or req.amount <= 0:
        raise HTTPException(status_code=400, detail="Enter an amount greater than zero.")
    deliverables = (req.deliverables or "").strip()
    if not deliverables:
        raise HTTPException(status_code=400, detail="Describe the deliverables you are paying for.")

    open_offer = db.query(models.InfluencerDeal).filter(
        models.InfluencerDeal.workspace_id == ws.id,
        models.InfluencerDeal.influencer_handle == handle,
        models.InfluencerDeal.status == "pending").first()
    if open_offer:
        raise HTTPException(status_code=409,
                            detail="A proposal to this creator is already waiting for an answer. "
                                   "Withdraw it before sending a new one.")

    deal = models.InfluencerDeal(
        workspace_id=ws.id,
        brand_name=ws.name,
        brand_email=current_user.email,
        brand_whatsapp=req.brand_whatsapp,
        influencer_handle=handle,
        influencer_name=req.influencer_name or handle,
        influencer_email=req.influencer_email,
        influencer_phone=req.influencer_phone,
        amount=req.amount,
        deliverables=deliverables,
        status="pending",
    )
    db.add(deal)
    db.flush()
    msg, inf = record_deal_event(db, deal, "proposed")
    db.commit()
    db.refresh(deal)
    await announce_deal(db, deal, msg, inf)
    return {"status": "success", "deal": deal_json(deal)}


@router.post("/{deal_id}/accept")
async def accept_deal(deal_id: int, db: Session = Depends(database.get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    """The creator accepts the terms. Only the creator named on the deal may do this."""
    deal = _deal_as_creator(deal_id, db, current_user)
    if deal.status != "pending":
        raise HTTPException(status_code=409, detail=f"This deal is already {deal.status}.")
    deal.status = "active"
    msg, inf = record_deal_event(db, deal, "accepted")
    db.commit()
    db.refresh(deal)
    await announce_deal(db, deal, msg, inf)
    return {"status": "success", "message": "Deal accepted.", "deal": deal_json(deal)}


@router.post("/{deal_id}/decline")
async def decline_deal(deal_id: int, db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    deal = _deal_as_creator(deal_id, db, current_user)
    if deal.status != "pending":
        raise HTTPException(status_code=409, detail=f"This deal is already {deal.status}.")
    deal.status = "declined"
    msg, inf = record_deal_event(db, deal, "declined")
    db.commit()
    db.refresh(deal)
    await announce_deal(db, deal, msg, inf)
    return {"status": "success", "message": "Deal declined.", "deal": deal_json(deal)}


@router.post("/{deal_id}/cancel")
async def cancel_deal(deal_id: int, db: Session = Depends(database.get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    """The brand withdraws a proposal the creator has not answered yet. Once accepted, the deal
    is an agreement and is not withdrawn from one side."""
    deal = _deal_as_brand(deal_id, db, current_user)
    if deal.status != "pending":
        raise HTTPException(status_code=409,
                            detail=f"Only a proposal still waiting for the creator can be withdrawn "
                                   f"(this one is {deal.status}).")
    deal.status = "cancelled"
    msg, inf = record_deal_event(db, deal, "cancelled")
    db.commit()
    db.refresh(deal)
    await announce_deal(db, deal, msg, inf)
    return {"status": "success", "message": "Proposal withdrawn.", "deal": deal_json(deal)}


@router.get("/brand/{workspace_id}")
def get_brand_deals(workspace_id: int, db: Session = Depends(database.get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    _owned_workspace(workspace_id, db, current_user)
    deals = db.query(models.InfluencerDeal).filter(
        models.InfluencerDeal.workspace_id == workspace_id
    ).order_by(models.InfluencerDeal.created_at.desc()).all()
    return [deal_json(d) for d in deals]


@router.get("/mine")
def get_my_deals(db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    """The signed-in creator's own deals."""
    handles = _my_handles(db, current_user)
    if not handles:
        return []
    deals = db.query(models.InfluencerDeal).filter(
        models.InfluencerDeal.influencer_handle.in_(list(handles))
    ).order_by(models.InfluencerDeal.created_at.desc()).all()
    return [deal_json(d) for d in deals]


@router.post("/{deal_id}/release")
async def release_deal_payment(deal_id: int, req: Optional[DealReleaseRequest] = None,
                               background_tasks: BackgroundTasks = None,
                               db: Session = Depends(database.get_db),
                               current_user: models.User = Depends(auth.get_current_user)):
    """The brand confirms the delivered work is approved and issues the creator's verification
    code, which lets the creator request payment. Records approval; transfers nothing."""
    deal = _deal_as_brand(deal_id, db, current_user)
    if deal.status not in ("active", "delivered"):
        raise HTTPException(status_code=409,
                            detail="Only an accepted deal can be approved "
                                   f"(this one is {deal.status}).")

    first_release = deal.status == "active"
    token = deal.brand_release_token or f"RAFTRA-VERIFIED-{secrets.token_hex(4).upper()}"
    deal.brand_release_token = token
    deal.status = "delivered"
    deal.brand_released_at = deal.brand_released_at or datetime.datetime.utcnow()
    if req and req.brand_whatsapp:
        deal.brand_whatsapp = req.brand_whatsapp
    msg = inf = None
    if first_release:
        msg, inf = record_deal_event(db, deal, "approved")
    db.commit()
    db.refresh(deal)
    if first_release:
        await announce_deal(db, deal, msg, inf)

    creator_email = deal.influencer_email
    if creator_email and first_release:
        args = (creator_email, deal.influencer_name or "Creator", deal.brand_name,
                deal.brand_whatsapp or "", deal.amount, token)
        if background_tasks:
            background_tasks.add_task(send_creator_release_email, *args)
        else:
            send_creator_release_email(*args)

    return {
        "status": "success",
        "message": "Work approved. The creator can now request payment.",
        "token": token,
        "emailed": bool(creator_email and first_release),
        "deal": deal_json(deal),
    }


# ----------------------------------------------------------------- expert enquiry
class ExpertInquiry(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    websiteUrl: Optional[str] = ""
    instaPage: Optional[str] = ""
    campaignGoal: Optional[str] = ""
    budget: Optional[str] = ""
    notes: Optional[str] = ""


@router.post("/expert-inquiry")
def expert_inquiry(body: ExpertInquiry, background_tasks: BackgroundTasks):
    """"Request Expert Advice" from the Creator Marketplace. Deliberately unauthenticated: the
    marketplace page is reachable logged out. Emailed to the team rather than stored."""
    if not body.name.strip() or "@" not in body.email:
        raise HTTPException(status_code=400, detail="A name and a valid email are required.")

    to_addr = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER")
    if not to_addr:
        print("[expert-inquiry] SMTP not configured; enquiry not delivered:", body.model_dump())
        return {"status": "success", "message": "Thanks - our team will be in touch."}

    def _send() -> None:
        try:
            lines = [
                "Name: " + body.name,
                "Email: " + body.email,
                "Phone: " + (body.phone or ""),
                "Website: " + (body.websiteUrl or ""),
                "Instagram: " + (body.instaPage or ""),
                "Goal: " + (body.campaignGoal or ""),
                "Budget: " + (body.budget or ""),
                "",
                "Notes:",
                body.notes or "(none)",
            ]
            msg = EmailMessage()
            msg["Subject"] = "Expert advice request - " + body.name
            msg["From"] = os.getenv("SMTP_FROM", to_addr)
            msg["To"] = to_addr
            msg["Reply-To"] = body.email
            msg.set_content(NEWLINE.join(lines))
            host = os.getenv("SMTP_HOST", "smtp.gmail.com")
            port = int(os.getenv("SMTP_PORT", "587"))
            with smtplib.SMTP(host, port, timeout=20) as srv:
                srv.starttls()
                srv.login(os.getenv("SMTP_USER", ""), os.getenv("SMTP_PASSWORD", ""))
                srv.send_message(msg)
        except Exception as e:  # noqa: BLE001 - the visitor is not shown our mail problems
            print("[expert-inquiry] delivery failed:", e)

    background_tasks.add_task(_send)
    return {"status": "success", "message": "Thanks - our team will be in touch within 24 hours."}
