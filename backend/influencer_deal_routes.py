"""
Brand <-> creator deals.

Ported from the build where this was written, with authorisation added. The original version
had no authentication on any route: /api/deals/{id}/release took no token and checked no
ownership, so anyone could release a deal by guessing an integer, and
/api/deals/creator/{handle} returned any creator's deal history to anyone who asked. Every
route here is behind get_current_user and checks that the caller is actually a party to the
deal - the brand through workspace ownership, the creator through their own influencer row.

Scope note: this is the deal record only. No money moves anywhere in this file. escrow_locked_at
and paid_at stay null because nothing has been charged - the payment path is a later phase, and
writing those columns now would make an unpaid deal look funded.
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
def _clean_handle(value: str) -> str:
    return (value or "").replace("@", "").strip().lower()


def _owned_workspace(workspace_id: int, db: Session, user: models.User) -> models.Workspace:
    ws = db.query(models.Workspace).filter(
        models.Workspace.id == workspace_id,
        models.Workspace.user_id == user.id,
    ).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


def _deal_as_brand(deal_id: int, db: Session, user: models.User) -> models.InfluencerDeal:
    """The deal, but only if this user owns the workspace that raised it. A 404 rather than a
    403 for someone else's deal, so the endpoint does not confirm which ids exist."""
    deal = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    owns = db.query(models.Workspace).filter(
        models.Workspace.id == deal.workspace_id,
        models.Workspace.user_id == user.id,
    ).first()
    if not owns:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


def _my_handles(db: Session, user: models.User) -> set:
    """Handles belonging to the signed-in creator. A creator may act only on their own deals."""
    rows = db.query(models.Influencer).filter(models.Influencer.user_id == user.id).all()
    return {_clean_handle(r.handle) for r in rows if r.handle}


def _serialise(deal: models.InfluencerDeal) -> dict:
    return {
        "id": deal.id,
        "workspace_id": deal.workspace_id,
        "brand_name": deal.brand_name,
        "influencer_handle": deal.influencer_handle,
        "influencer_name": deal.influencer_name,
        "amount": deal.amount,
        "deliverables": deal.deliverables,
        "status": deal.status,
        "created_at": deal.created_at.isoformat() if deal.created_at else None,
        "brand_released_at": deal.brand_released_at.isoformat() if deal.brand_released_at else None,
    }


def send_creator_release_email(creator_email: str, creator_name: str, brand_name: str,
                               brand_whatsapp: str, amount: float, token: str):
    """Tells the creator the brand approved the work and gives them the verification token.

    Deliberately does not say funds were released or held: no payment is taken anywhere in
    this flow yet, and the payout is arranged by hand. Set the real wording once the payment
    path exists.
    """
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_pass = os.getenv("SMTP_PASS", "")
    sender_email = os.getenv("SMTP_FROM", smtp_user or "notifications@raftra.ai")

    subject = f"{brand_name} approved your deliverables - verification token inside"
    body = f"""Hi {creator_name},

{brand_name} has reviewed your campaign deliverables and approved them.

DEAL DETAILS
- Brand: {brand_name}
- Brand contact: {brand_whatsapp}
- Agreed amount: Rs {amount:,.0f}

YOUR VERIFICATION TOKEN
{token}

WHAT HAPPENS NEXT
Send this token to Team Raftra along with proof of the approved deliverables, and they will
arrange your payout. Payment is handled by the team directly - it is not automated yet, so
please keep this email until the transfer reaches you.

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
        # No SMTP configured. Say so plainly rather than reporting a send that never happened.
        print(f"[deals] SMTP not configured - release email NOT sent to {creator_email}. "
              f"Token: {token}")


# ---------------------------------------------------------------------------- routes
@router.post("/propose")
def propose_deal(req: DealProposeRequest, db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    """Brand offers terms to a creator. The brand's identity comes from the workspace it owns,
    never from the request body - the original accepted a brand_name from the client."""
    ws = _owned_workspace(req.workspace_id, db, current_user)

    handle = _clean_handle(req.influencer_handle)
    if not handle:
        raise HTTPException(status_code=400, detail="A creator handle is required.")
    if req.amount is None or req.amount <= 0:
        raise HTTPException(status_code=400, detail="Enter an amount greater than zero.")

    deal = models.InfluencerDeal(
        workspace_id=ws.id,
        brand_name=ws.name,
        brand_email=current_user.email,
        brand_whatsapp=req.brand_whatsapp,
        influencer_handle=handle,
        influencer_name=req.influencer_name or "Creator",
        influencer_email=req.influencer_email,
        influencer_phone=req.influencer_phone,
        amount=req.amount,
        deliverables=req.deliverables,
        status="pending",
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)
    return {"status": "success", "deal": _serialise(deal)}


@router.post("/{deal_id}/accept")
def accept_deal(deal_id: int, db: Session = Depends(database.get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    """The creator accepts the terms. Only the creator named on the deal may do this; the
    original let any caller accept any deal by id."""
    deal = db.query(models.InfluencerDeal).filter(models.InfluencerDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if _clean_handle(deal.influencer_handle) not in _my_handles(db, current_user):
        raise HTTPException(status_code=404, detail="Deal not found")
    if deal.status != "pending":
        raise HTTPException(status_code=409, detail=f"This deal is already {deal.status}.")

    # Status only. The original also stamped escrow_locked_at here, which claimed funds were
    # held at the moment a creator said yes - before any payment existed.
    deal.status = "active"
    db.commit()
    db.refresh(deal)
    return {"status": "success", "message": "Deal accepted.", "deal": _serialise(deal)}


@router.get("/brand/{workspace_id}")
def get_brand_deals(workspace_id: int, db: Session = Depends(database.get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    _owned_workspace(workspace_id, db, current_user)
    deals = db.query(models.InfluencerDeal).filter(
        models.InfluencerDeal.workspace_id == workspace_id
    ).order_by(models.InfluencerDeal.created_at.desc()).all()
    return [_serialise(d) for d in deals]


@router.get("/mine")
def get_my_deals(db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    """The signed-in creator's own deals. Replaces /creator/{handle}, which took a handle from
    the URL and returned that creator's deals to anybody."""
    handles = _my_handles(db, current_user)
    if not handles:
        return []
    deals = db.query(models.InfluencerDeal).filter(
        models.InfluencerDeal.influencer_handle.in_(list(handles))
    ).order_by(models.InfluencerDeal.created_at.desc()).all()
    return [_serialise(d) for d in deals]


@router.post("/{deal_id}/release")
def release_deal_payment(deal_id: int, req: Optional[DealReleaseRequest] = None,
                         background_tasks: BackgroundTasks = None,
                         db: Session = Depends(database.get_db),
                         current_user: models.User = Depends(auth.get_current_user)):
    """The brand confirms the deliverables are approved and issues the creator's verification
    token. Only the brand that raised the deal can do this, and only once the creator has
    accepted - the original allowed an unauthenticated caller to release any deal at any stage.

    This records approval; it does not transfer money. Payout is arranged by hand until the
    payment path exists.
    """
    deal = _deal_as_brand(deal_id, db, current_user)
    if deal.status not in ("active", "delivered"):
        raise HTTPException(status_code=409,
                            detail="The creator has not accepted this deal yet.")

    token = deal.brand_release_token or f"RAFTRA-VERIFIED-{secrets.token_hex(4).upper()}"
    deal.brand_release_token = token
    deal.status = "delivered"
    deal.brand_released_at = datetime.datetime.utcnow()
    if req and req.brand_whatsapp:
        deal.brand_whatsapp = req.brand_whatsapp
    db.commit()
    db.refresh(deal)

    creator_email = deal.influencer_email
    if creator_email:
        args = (creator_email, deal.influencer_name or "Creator", deal.brand_name,
                deal.brand_whatsapp or "Contact Team Raftra", deal.amount, token)
        if background_tasks:
            background_tasks.add_task(send_creator_release_email, *args)
        else:
            send_creator_release_email(*args)

    return {
        "status": "success",
        "message": "Deliverables approved. Verification token issued to the creator.",
        "token": token,
        "emailed": bool(creator_email),
        "deal": _serialise(deal),
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
    """"Request Expert Advice" from the Creator Marketplace.

    The form posted to /api/v1/workspaces/influencer/expert-inquiry, a path that has never
    existed on this backend, so every submission 404'd while the UI showed a thank-you
    screen. Deliberately unauthenticated: the marketplace page is reachable logged out, and
    turning a lead away for having no account defeats the point of the form.

    Emailed to the team rather than stored: there is no table for enquiries and no screen
    that would read one, so a row nobody looks at would be worse than an inbox.
    """
    if not body.name.strip() or "@" not in body.email:
        raise HTTPException(status_code=400, detail="A name and a valid email are required.")

    to_addr = os.getenv("SMTP_FROM") or os.getenv("SMTP_USER")
    if not to_addr:
        # Accepted anyway - the visitor should not see a failure caused by our config.
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
