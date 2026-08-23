"""
Posted deals: a brand broadcasts a campaign brief, creators apply, terms are agreed,
deliverables are submitted and reviewed, and the campaign completes.

Ported from the build where this was written, with authorisation added throughout. The
original had no authentication on any of its fifteen routes, which meant anyone could read
another brand's applicant list, shortlist or confirm applications they had nothing to do
with, approve their own deliverables, or mark a campaign complete. Its creator-facing routes
took a handle straight from the URL - /creator/applications/{handle} returned any creator's
history to any caller, and /discover fell back to a hardcoded handle when none was supplied.

Here, brand actions require ownership of the workspace behind the deal, and creator actions
require that the handle belongs to the signed-in user. Nothing in this file moves money.
"""
import datetime
import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import auth
import database
import models

router = APIRouter(prefix="/api/posted-deals", tags=["Posted Deals"])


# ---------------------------------------------------------------------------- request bodies
class PostedDealCreate(BaseModel):
    workspace_id: int
    campaign_name: str
    product_name: Optional[str] = None
    description: Optional[str] = None
    objective: Optional[str] = None
    platform: Optional[str] = "Instagram"
    creator_category: Optional[str] = "All"
    niche: Optional[str] = "Lifestyle"
    location: Optional[str] = "India"
    creators_required: Optional[int] = 1
    follower_range: Optional[str] = None
    engagement_range: Optional[str] = None
    content_style: Optional[str] = None
    language: Optional[str] = None
    audience_requirements: Optional[str] = None
    deliverables_json: Optional[str] = None
    total_budget: Optional[float] = 0.0
    budget_per_creator: Optional[float] = 0.0
    allow_negotiation: Optional[bool] = True
    application_deadline: Optional[str] = None
    campaign_start: Optional[str] = None
    deliverable_deadline: Optional[str] = None
    campaign_end: Optional[str] = None
    brand_logo: Optional[str] = None
    brand_url: Optional[str] = None


class DealApplicationCreate(BaseModel):
    creator_handle: str
    creator_name: str
    creator_avatar: Optional[str] = None
    creator_followers: Optional[str] = None
    creator_engagement: Optional[str] = None
    creator_location: Optional[str] = None
    proposal_text: Optional[str] = None
    proposed_price: float
    availability_date: Optional[str] = None
    estimated_delivery_days: Optional[int] = 7


class ApplicationStatusUpdate(BaseModel):
    status: str


class DealFinalizeRequest(BaseModel):
    final_price: float
    final_deliverables: str
    final_delivery_days: Optional[int] = None
    usage_rights: Optional[str] = None
    revisions_allowed: Optional[int] = None


class DeliverableSubmissionCreate(BaseModel):
    title: str
    submission_type: Optional[str] = "video"
    content_url: Optional[str] = None
    caption: Optional[str] = None
    notes: Optional[str] = None


class SubmissionReviewRequest(BaseModel):
    status: str
    revision_reason: Optional[str] = None


_APPLICATION_STATUSES = {"SUBMITTED", "SHORTLISTED", "NEGOTIATION", "ACCEPTED",
                         "CONFIRMED", "DECLINED", "COMPLETED"}
_REVIEW_STATUSES = {"APPROVED", "REVISION_REQUESTED", "UNDER_REVIEW"}


# ---------------------------------------------------------------------------- helpers
def _clean_handle(value: str) -> str:
    return (value or "").replace("@", "").strip().lower()


def _my_handles(db: Session, user: models.User) -> set:
    rows = db.query(models.Influencer).filter(models.Influencer.user_id == user.id).all()
    return {_clean_handle(r.handle) for r in rows if r.handle}


def _owned_workspace(workspace_id: int, db: Session, user: models.User) -> models.Workspace:
    ws = db.query(models.Workspace).filter(
        models.Workspace.id == workspace_id,
        models.Workspace.user_id == user.id,
    ).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


def _brand_owns_deal(deal_id: int, db: Session, user: models.User) -> models.PostedDeal:
    deal = db.query(models.PostedDeal).filter(models.PostedDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    owns = db.query(models.Workspace).filter(
        models.Workspace.id == deal.workspace_id,
        models.Workspace.user_id == user.id,
    ).first()
    if not owns:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal


def _brand_owns_application(application_id: int, db: Session,
                            user: models.User) -> models.DealApplication:
    app = db.query(models.DealApplication).filter(
        models.DealApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    _brand_owns_deal(app.deal_id, db, user)
    return app


def _creator_owns_application(application_id: int, db: Session,
                              user: models.User) -> models.DealApplication:
    app = db.query(models.DealApplication).filter(
        models.DealApplication.id == application_id).first()
    if not app or _clean_handle(app.creator_handle) not in _my_handles(db, user):
        raise HTTPException(status_code=404, detail="Application not found")
    return app


def _notify(db: Session, **kwargs):
    db.add(models.PostedDealNotification(**kwargs))


def _match_score(deal: models.PostedDeal, creator_niche: str = "") -> int:
    score = 75
    deal_niche = (deal.niche or "").lower()
    c_niche = (creator_niche or "").lower()
    if deal_niche and c_niche and (deal_niche in c_niche or c_niche in deal_niche):
        score += 15
    if deal.platform == "Instagram":
        score += 5
    return min(score, 98)


def _deal_summary(d: models.PostedDeal, db: Session) -> dict:
    apps = db.query(models.DealApplication).filter(
        models.DealApplication.deal_id == d.id).all()
    return {
        "id": d.id, "workspace_id": d.workspace_id, "brand_name": d.brand_name,
        "campaign_name": d.campaign_name, "product_name": d.product_name,
        "description": d.description, "objective": d.objective, "platform": d.platform,
        "creator_category": d.creator_category, "niche": d.niche, "location": d.location,
        "creators_required": d.creators_required, "total_budget": d.total_budget,
        "budget_per_creator": d.budget_per_creator, "deliverables_json": d.deliverables_json,
        "application_deadline": d.application_deadline, "status": d.status,
        "applications_count": len(apps),
        "shortlisted_count": len([a for a in apps if a.status == "SHORTLISTED"]),
        "accepted_count": len([a for a in apps if a.status in ("ACCEPTED", "CONFIRMED")]),
        "created_at": d.created_at,
    }


# ---------------------------------------------------------------------------- brand: briefs
@router.post("/create")
def create_posted_deal(req: PostedDealCreate, db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """Post a campaign brief. The brand's name comes from the workspace it is posted under -
    the original took brand_name from the request body and defaulted it to "Aura Premium"."""
    ws = _owned_workspace(req.workspace_id, db, current_user)
    if not (req.campaign_name or "").strip():
        raise HTTPException(status_code=400, detail="Give the campaign a name.")

    deal = models.PostedDeal(
        workspace_id=ws.id,
        brand_name=ws.name,
        brand_logo=req.brand_logo,
        brand_url=req.brand_url or ws.company_url,
        campaign_name=req.campaign_name.strip(),
        product_name=req.product_name,
        description=req.description,
        objective=req.objective,
        platform=req.platform or "Instagram",
        creator_category=req.creator_category or "All",
        niche=req.niche or "Lifestyle",
        location=req.location or "India",
        creators_required=req.creators_required or 1,
        follower_range=req.follower_range,
        engagement_range=req.engagement_range,
        content_style=req.content_style,
        language=req.language or "English / Hindi",
        audience_requirements=req.audience_requirements,
        deliverables_json=req.deliverables_json or json.dumps(
            [{"type": "Reel", "quantity": 1}]),
        total_budget=req.total_budget or 0.0,
        budget_per_creator=req.budget_per_creator or 0.0,
        allow_negotiation=True if req.allow_negotiation is None else req.allow_negotiation,
        application_deadline=req.application_deadline,
        campaign_start=req.campaign_start,
        deliverable_deadline=req.deliverable_deadline,
        campaign_end=req.campaign_end,
        status="ACTIVE",
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)

    _notify(db, recipient_type="creator", recipient_handle="all", workspace_id=deal.workspace_id,
            title="New brand deal",
            message=f"{deal.brand_name} posted '{deal.campaign_name}'.",
            deal_id=deal.id)
    db.commit()
    return {"status": "success", "deal": _deal_summary(deal, db)}


@router.get("/brand/{workspace_id}")
def get_brand_posted_deals(workspace_id: int, db: Session = Depends(database.get_db),
                           current_user: models.User = Depends(auth.get_current_user)):
    _owned_workspace(workspace_id, db, current_user)
    deals = db.query(models.PostedDeal).filter(
        models.PostedDeal.workspace_id == workspace_id
    ).order_by(models.PostedDeal.created_at.desc()).all()
    return [_deal_summary(d, db) for d in deals]


# ---------------------------------------------------------------------------- creator: browse
@router.get("/discover")
def discover_brand_deals(niche: Optional[str] = None, db: Session = Depends(database.get_db),
                         current_user: models.User = Depends(auth.get_current_user)):
    """Open briefs, marked with whether this creator has already applied. The original read
    the handle from a query parameter and fell back to a hardcoded creator when it was
    missing; here it comes from the signed-in account."""
    handles = _my_handles(db, current_user)
    deals = db.query(models.PostedDeal).filter(
        models.PostedDeal.status == "ACTIVE"
    ).order_by(models.PostedDeal.created_at.desc()).all()

    result = []
    for d in deals:
        existing = None
        if handles:
            existing = db.query(models.DealApplication).filter(
                models.DealApplication.deal_id == d.id,
                models.DealApplication.creator_handle.in_(list(handles)),
            ).first()
        result.append({
            "id": d.id, "brand_name": d.brand_name, "brand_logo": d.brand_logo,
            "brand_url": d.brand_url, "campaign_name": d.campaign_name,
            "product_name": d.product_name, "description": d.description,
            "objective": d.objective, "platform": d.platform, "niche": d.niche,
            "location": d.location, "match_score": _match_score(d, niche or ""),
            "budget_per_creator": d.budget_per_creator,
            "deliverables_json": d.deliverables_json,
            "application_deadline": d.application_deadline,
            "has_applied": existing is not None,
            "application_status": existing.status if existing else None,
        })
    return result


@router.get("/mine")
def get_my_applications(db: Session = Depends(database.get_db),
                        current_user: models.User = Depends(auth.get_current_user)):
    """The signed-in creator's applications. Replaces /creator/applications/{handle}, which
    returned any creator's history to anyone who knew their handle."""
    handles = _my_handles(db, current_user)
    if not handles:
        return []
    apps = db.query(models.DealApplication).filter(
        models.DealApplication.creator_handle.in_(list(handles))
    ).order_by(models.DealApplication.created_at.desc()).all()

    out = []
    for a in apps:
        deal = db.query(models.PostedDeal).filter(models.PostedDeal.id == a.deal_id).first()
        out.append({
            "id": a.id, "deal_id": a.deal_id,
            "campaign_name": deal.campaign_name if deal else "Brand campaign",
            "brand_name": deal.brand_name if deal else "Brand",
            "proposed_price": a.proposed_price, "final_price": a.final_price,
            "final_deliverables": a.final_deliverables, "status": a.status,
            "cashout_requested": a.cashout_requested, "cashout_status": a.cashout_status,
            "created_at": a.created_at,
        })
    return out


# ---------------------------------------------------------------------------- notifications
@router.get("/notifications")
def get_notifications(recipient_type: str = "creator", workspace_id: Optional[int] = None,
                      db: Session = Depends(database.get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    """Scoped to the caller. The original took the handle or workspace from the query string,
    so any caller could read anyone's notifications."""
    query = db.query(models.PostedDealNotification).filter(
        models.PostedDealNotification.recipient_type == recipient_type)

    if recipient_type == "creator":
        handles = _my_handles(db, current_user)
        if not handles:
            return []
        query = query.filter(
            (models.PostedDealNotification.recipient_handle.in_(list(handles)))
            | (models.PostedDealNotification.recipient_handle == "all"))
    else:
        owned = db.query(models.Workspace.id).filter(
            models.Workspace.user_id == current_user.id).all()
        owned_ids = [w[0] for w in owned]
        if workspace_id is not None:
            if workspace_id not in owned_ids:
                raise HTTPException(status_code=403, detail="Workspace access denied")
            owned_ids = [workspace_id]
        if not owned_ids:
            return []
        query = query.filter(models.PostedDealNotification.workspace_id.in_(owned_ids))

    return query.order_by(models.PostedDealNotification.created_at.desc()).limit(20).all()


# Declared before /{deal_id}: FastAPI matches in definition order, so a literal path
# registered after a dynamic one never gets reached - /notifications was being parsed
# as a deal id and failing with a 422.
@router.get("/{deal_id}")
def get_deal_details(deal_id: int, db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """A single brief. Open briefs are visible to any signed-in user - that is the point of a
    marketplace listing - but anything not ACTIVE is only visible to the brand behind it."""
    deal = db.query(models.PostedDeal).filter(models.PostedDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    if deal.status != "ACTIVE":
        _brand_owns_deal(deal_id, db, current_user)
    return _deal_summary(deal, db)


@router.post("/{deal_id}/apply")
def apply_to_deal(deal_id: int, req: DealApplicationCreate,
                  db: Session = Depends(database.get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    """Apply as yourself. The original accepted whatever handle the body carried, so one
    creator could apply in another's name."""
    deal = db.query(models.PostedDeal).filter(models.PostedDeal.id == deal_id).first()
    if not deal or deal.status != "ACTIVE":
        raise HTTPException(status_code=404, detail="Deal not found")

    handle = _clean_handle(req.creator_handle)
    if handle not in _my_handles(db, current_user):
        raise HTTPException(status_code=403,
                            detail="You can only apply with your own creator profile.")

    existing = db.query(models.DealApplication).filter(
        models.DealApplication.deal_id == deal_id,
        models.DealApplication.creator_handle == handle,
    ).first()
    if existing:
        return {"status": "success", "message": "You have already applied to this deal.",
                "application_id": existing.id}

    app = models.DealApplication(
        deal_id=deal_id, workspace_id=deal.workspace_id,
        creator_handle=handle, creator_name=req.creator_name,
        creator_avatar=req.creator_avatar, creator_followers=req.creator_followers,
        creator_engagement=req.creator_engagement, creator_location=req.creator_location,
        match_score=_match_score(deal), proposal_text=req.proposal_text,
        proposed_price=req.proposed_price,
        availability_date=req.availability_date,
        estimated_delivery_days=req.estimated_delivery_days or 7,
        status="SUBMITTED",
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    _notify(db, recipient_type="brand", workspace_id=deal.workspace_id,
            title="New creator application",
            message=f"{req.creator_name} (@{handle}) applied to '{deal.campaign_name}'.",
            deal_id=deal_id, application_id=app.id)
    db.commit()
    return {"status": "success", "message": "Application submitted.", "application_id": app.id}


# ---------------------------------------------------------------------------- brand: review
@router.get("/{deal_id}/applications")
def get_deal_applications(deal_id: int, db: Session = Depends(database.get_db),
                          current_user: models.User = Depends(auth.get_current_user)):
    _brand_owns_deal(deal_id, db, current_user)
    return db.query(models.DealApplication).filter(
        models.DealApplication.deal_id == deal_id
    ).order_by(models.DealApplication.created_at.desc()).all()


@router.post("/applications/{application_id}/status")
def update_application_status(application_id: int, req: ApplicationStatusUpdate,
                              db: Session = Depends(database.get_db),
                              current_user: models.User = Depends(auth.get_current_user)):
    app = _brand_owns_application(application_id, db, current_user)
    status = (req.status or "").upper()
    if status not in _APPLICATION_STATUSES:
        raise HTTPException(status_code=400, detail=f"Unknown status '{req.status}'.")

    app.status = status
    deal_name = app.deal.campaign_name if app.deal else "the campaign"
    message = {
        "SHORTLISTED": f"You have been shortlisted for '{deal_name}'.",
        "ACCEPTED": f"Your application for '{deal_name}' was accepted. Terms come next.",
        "DECLINED": f"Your application for '{deal_name}' was not taken forward.",
    }.get(status, f"Your application for '{deal_name}' is now {status}.")

    _notify(db, recipient_type="creator", recipient_handle=app.creator_handle,
            workspace_id=app.workspace_id, title=f"Application {status.lower()}",
            message=message, deal_id=app.deal_id, application_id=app.id)
    db.commit()
    return {"status": "success", "application_id": app.id, "application_status": app.status}


@router.post("/applications/{application_id}/finalize")
def finalize_deal_terms(application_id: int, req: DealFinalizeRequest,
                        db: Session = Depends(database.get_db),
                        current_user: models.User = Depends(auth.get_current_user)):
    """Agree final terms and open a deliverable row per item, which is what the review loop
    later works through."""
    app = _brand_owns_application(application_id, db, current_user)
    if req.final_price is None or req.final_price <= 0:
        raise HTTPException(status_code=400, detail="Enter an amount greater than zero.")

    app.final_price = req.final_price
    app.final_deliverables = req.final_deliverables
    app.final_delivery_days = req.final_delivery_days
    app.usage_rights = req.usage_rights or "30 Days Digital Rights"
    app.revisions_allowed = req.revisions_allowed or 1
    app.status = "CONFIRMED"

    deal = db.query(models.PostedDeal).filter(models.PostedDeal.id == app.deal_id).first()
    if deal:
        deal.status = "IN_PROGRESS"

    titles = [t.strip() for t in (req.final_deliverables or "").split(",") if t.strip()]
    for title in titles:
        exists = db.query(models.DealDeliverableSubmission).filter(
            models.DealDeliverableSubmission.application_id == application_id,
            models.DealDeliverableSubmission.title == title,
        ).first()
        if not exists:
            db.add(models.DealDeliverableSubmission(
                application_id=application_id, deal_id=app.deal_id,
                title=title, status="PENDING",
                due_date=deal.deliverable_deadline if deal else None,
            ))

    _notify(db, recipient_type="creator", recipient_handle=app.creator_handle,
            workspace_id=app.workspace_id, title="Terms confirmed",
            message=f"Terms agreed for '{deal.campaign_name if deal else 'the campaign'}': "
                    f"Rs {req.final_price:,.0f}.",
            deal_id=app.deal_id, application_id=app.id)
    db.commit()
    return {"status": "success", "message": "Terms confirmed.", "application_id": app.id}


# ---------------------------------------------------------------------------- deliverables
@router.post("/applications/{application_id}/submissions")
def submit_deliverable(application_id: int, req: DeliverableSubmissionCreate,
                       db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """Creator submits one deliverable for review."""
    app = _creator_owns_application(application_id, db, current_user)

    sub = db.query(models.DealDeliverableSubmission).filter(
        models.DealDeliverableSubmission.application_id == application_id,
        models.DealDeliverableSubmission.title == req.title,
    ).first()
    if not sub:
        sub = models.DealDeliverableSubmission(
            application_id=application_id, deal_id=app.deal_id, title=req.title)
        db.add(sub)

    sub.submission_type = req.submission_type or "video"
    sub.content_url = req.content_url
    sub.caption = req.caption
    sub.notes = req.notes
    sub.status = "UNDER_REVIEW"

    _notify(db, recipient_type="brand", workspace_id=app.workspace_id,
            title="Deliverable submitted",
            message=f"{app.creator_name} submitted '{req.title}' for review.",
            deal_id=app.deal_id, application_id=application_id)
    db.commit()
    db.refresh(sub)
    return {"status": "success", "message": "Submitted for review.", "submission_id": sub.id}


@router.get("/applications/{application_id}/submissions")
def get_deliverable_submissions(application_id: int, db: Session = Depends(database.get_db),
                                current_user: models.User = Depends(auth.get_current_user)):
    """Visible to both parties, and to nobody else."""
    app = db.query(models.DealApplication).filter(
        models.DealApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    if _clean_handle(app.creator_handle) not in _my_handles(db, current_user):
        _brand_owns_deal(app.deal_id, db, current_user)
    return db.query(models.DealDeliverableSubmission).filter(
        models.DealDeliverableSubmission.application_id == application_id).all()


@router.post("/submissions/{submission_id}/review")
def review_deliverable_submission(submission_id: int, req: SubmissionReviewRequest,
                                  db: Session = Depends(database.get_db),
                                  current_user: models.User = Depends(auth.get_current_user)):
    """Brand approves a deliverable or asks for a revision."""
    sub = db.query(models.DealDeliverableSubmission).filter(
        models.DealDeliverableSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")
    app = _brand_owns_application(sub.application_id, db, current_user)

    status = (req.status or "").upper()
    if status not in _REVIEW_STATUSES:
        raise HTTPException(status_code=400, detail=f"Unknown review status '{req.status}'.")

    sub.status = status
    if status == "REVISION_REQUESTED":
        if not (req.revision_reason or "").strip():
            raise HTTPException(status_code=400,
                                detail="Say what needs changing when requesting a revision.")
        sub.revision_reason = req.revision_reason.strip()

    message = (f"'{sub.title}' was approved." if status == "APPROVED"
               else f"Revision requested on '{sub.title}': {sub.revision_reason}")
    _notify(db, recipient_type="creator", recipient_handle=app.creator_handle,
            workspace_id=app.workspace_id, title=f"Deliverable {status.lower()}",
            message=message, deal_id=sub.deal_id, application_id=app.id)
    db.commit()
    return {"status": "success", "submission_id": sub.id, "submission_status": sub.status}


@router.post("/applications/{application_id}/complete")
def complete_deal_campaign(application_id: int, db: Session = Depends(database.get_db),
                           current_user: models.User = Depends(auth.get_current_user)):
    """Close the campaign once every deliverable is approved. The original marked it complete
    on request, without checking the deliverables - which is the check a payout later hangs
    off, so it cannot be taken on trust."""
    app = _brand_owns_application(application_id, db, current_user)

    subs = db.query(models.DealDeliverableSubmission).filter(
        models.DealDeliverableSubmission.application_id == application_id).all()
    outstanding = [s.title for s in subs if s.status != "APPROVED"]
    if outstanding:
        raise HTTPException(
            status_code=409,
            detail="Approve every deliverable first. Still open: " + ", ".join(outstanding))

    app.status = "COMPLETED"
    deal = db.query(models.PostedDeal).filter(models.PostedDeal.id == app.deal_id).first()
    if deal:
        deal.status = "COMPLETED"

    amount = app.final_price or app.proposed_price or 0
    _notify(db, recipient_type="creator", recipient_handle=app.creator_handle,
            workspace_id=app.workspace_id, title="Campaign completed",
            message=f"'{deal.campaign_name if deal else 'The campaign'}' is complete. "
                    f"You can request payment of Rs {amount:,.0f}.",
            deal_id=app.deal_id, application_id=application_id)
    db.commit()
    return {"status": "success", "message": "Campaign completed.", "application_id": app.id}


@router.post("/applications/{application_id}/payout")
def request_deal_payout(application_id: int, db: Session = Depends(database.get_db),
                        current_user: models.User = Depends(auth.get_current_user)):
    """Creator asks to be paid for a completed campaign. This records the request; it does
    not move money - payouts are arranged by the team."""
    app = _creator_owns_application(application_id, db, current_user)
    if app.status != "COMPLETED":
        raise HTTPException(status_code=409,
                            detail="This campaign has not been marked complete yet.")
    if app.cashout_requested:
        return {"status": "success", "message": "Payment was already requested.",
                "cashout_status": app.cashout_status}

    app.cashout_requested = True
    app.cashout_status = "REQUESTED"
    amount = app.final_price or app.proposed_price or 0
    _notify(db, recipient_type="brand", workspace_id=app.workspace_id,
            title="Payment requested",
            message=f"{app.creator_name} (@{app.creator_handle}) requested payment of "
                    f"Rs {amount:,.0f}.",
            deal_id=app.deal_id, application_id=application_id)
    db.commit()
    return {"status": "success", "message": "Payment requested.", "cashout_status": "REQUESTED"}
