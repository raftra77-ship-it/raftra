from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import models, schemas, database
from typing import List, Optional
import json
import datetime

router = APIRouter(prefix="/api/posted-deals", tags=["Posted Deals"])

# Helper to compute brand fit match score
def calculate_match_score(deal: models.PostedDeal, creator_niche: str = "", creator_followers: str = "") -> int:
    score = 75
    deal_niche = (deal.niche or "").lower()
    c_niche = (creator_niche or "").lower()
    if deal_niche in c_niche or c_niche in deal_niche:
        score += 15
    if deal.platform == "Instagram":
        score += 5
    return min(score, 98)

# 1. Create a new posted deal (Brand side)
@router.post("/create")
def create_posted_deal(req: schemas.PostedDealCreate, db: Session = Depends(database.get_db)):
    deal = models.PostedDeal(
        workspace_id=req.workspace_id or 1,
        brand_name=req.brand_name or "Aura Premium",
        brand_logo=req.brand_logo,
        brand_url=req.brand_url or "aura.com",
        campaign_name=req.campaign_name,
        product_name=req.product_name,
        description=req.description,
        objective=req.objective or "Brand Awareness & UGC",
        platform=req.platform or "Instagram",
        creator_category=req.creator_category or "All",
        niche=req.niche or "Lifestyle",
        location=req.location or "India",
        creators_required=req.creators_required or 1,
        follower_range=req.follower_range or "10k - 100k",
        engagement_range=req.engagement_range or "2% - 10%",
        content_style=req.content_style or "Authentic UGC",
        language=req.language or "English / Hindi",
        audience_requirements=req.audience_requirements,
        deliverables_json=req.deliverables_json or json.dumps([{"type": "Reel", "quantity": 1, "duration": "30s"}]),
        total_budget=req.total_budget or 50000.0,
        budget_per_creator=req.budget_per_creator or 15000.0,
        allow_negotiation=req.allow_negotiation if req.allow_negotiation is not None else True,
        application_deadline=req.application_deadline or "2026-08-30",
        campaign_start=req.campaign_start or "2026-09-01",
        deliverable_deadline=req.deliverable_deadline or "2026-09-15",
        campaign_end=req.campaign_end or "2026-09-30",
        status="ACTIVE"
    )
    db.add(deal)
    db.commit()
    db.refresh(deal)

    # Broadcast notification to all active creators
    notif = models.PostedDealNotification(
        recipient_type="creator",
        recipient_handle="all",
        workspace_id=deal.workspace_id,
        title="🔔 New Brand Deal",
        message=f"A campaign matching your profile has been posted: {deal.campaign_name} (₹{deal.budget_per_creator:,.0f} Est. Payout)",
        deal_id=deal.id
    )
    db.add(notif)
    db.commit()

    return {"status": "success", "deal": deal}

# 2. Get all deals posted by brand workspace
@router.get("/brand/{workspace_id}")
def get_brand_posted_deals(workspace_id: int, db: Session = Depends(database.get_db)):
    deals = db.query(models.PostedDeal).filter(models.PostedDeal.workspace_id == workspace_id).order_by(models.PostedDeal.created_at.desc()).all()
    result = []
    for d in deals:
        apps = db.query(models.DealApplication).filter(models.DealApplication.deal_id == d.id).all()
        shortlisted_count = len([a for a in apps if a.status == "SHORTLISTED"])
        accepted_count = len([a for a in apps if a.status in ["ACCEPTED", "CONFIRMED"]])
        result.append({
            "id": d.id,
            "workspace_id": d.workspace_id,
            "brand_name": d.brand_name,
            "campaign_name": d.campaign_name,
            "product_name": d.product_name,
            "description": d.description,
            "objective": d.objective,
            "platform": d.platform,
            "creator_category": d.creator_category,
            "niche": d.niche,
            "location": d.location,
            "creators_required": d.creators_required,
            "total_budget": d.total_budget,
            "budget_per_creator": d.budget_per_creator,
            "deliverables_json": d.deliverables_json,
            "application_deadline": d.application_deadline,
            "status": d.status,
            "applications_count": len(apps),
            "shortlisted_count": shortlisted_count,
            "accepted_count": accepted_count,
            "created_at": d.created_at
        })
    return result

# 3. Discover deals for creators
@router.get("/discover")
def discover_brand_deals(handle: Optional[str] = None, niche: Optional[str] = None, db: Session = Depends(database.get_db)):
    deals = db.query(models.PostedDeal).filter(models.PostedDeal.status == "ACTIVE").order_by(models.PostedDeal.created_at.desc()).all()
    result = []
    clean_handle = handle.replace("@", "").strip() if handle else "samairaa.r"
    for d in deals:
        match_score = calculate_match_score(d, niche or "")
        # Check if creator already applied
        existing_app = None
        if clean_handle:
            existing_app = db.query(models.DealApplication).filter(
                models.DealApplication.deal_id == d.id,
                models.DealApplication.creator_handle == clean_handle
            ).first()
        result.append({
            "id": d.id,
            "brand_name": d.brand_name,
            "brand_logo": d.brand_logo,
            "brand_url": d.brand_url,
            "campaign_name": d.campaign_name,
            "product_name": d.product_name,
            "description": d.description,
            "objective": d.objective,
            "platform": d.platform,
            "niche": d.niche,
            "location": d.location,
            "match_score": match_score,
            "budget_per_creator": d.budget_per_creator,
            "deliverables_json": d.deliverables_json,
            "application_deadline": d.application_deadline,
            "has_applied": existing_app is not None,
            "application_status": existing_app.status if existing_app else None
        })
    return result

# 4. Get single deal details
@router.get("/{deal_id}")
def get_deal_details(deal_id: int, db: Session = Depends(database.get_db)):
    deal = db.query(models.PostedDeal).filter(models.PostedDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")
    return deal

# 5. Apply to deal (Creator side)
@router.post("/{deal_id}/apply")
def apply_to_deal(deal_id: int, req: schemas.DealApplicationCreate, db: Session = Depends(database.get_db)):
    deal = db.query(models.PostedDeal).filter(models.PostedDeal.id == deal_id).first()
    if not deal:
        raise HTTPException(status_code=404, detail="Deal not found")

    clean_handle = req.creator_handle.replace("@", "").strip()

    # Check if already applied
    existing = db.query(models.DealApplication).filter(
        models.DealApplication.deal_id == deal_id,
        models.DealApplication.creator_handle == clean_handle
    ).first()
    if existing:
        return {"status": "success", "message": "Application updated", "application": existing}

    app = models.DealApplication(
        deal_id=deal_id,
        workspace_id=deal.workspace_id,
        creator_handle=clean_handle,
        creator_name=req.creator_name,
        creator_avatar=req.creator_avatar or "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
        creator_followers=req.creator_followers or "18.8k",
        creator_engagement=req.creator_engagement or "6.8%",
        creator_location=req.creator_location or "Delhi, India",
        match_score=calculate_match_score(deal),
        proposal_text=req.proposal_text,
        proposed_price=req.proposed_price,
        availability_date=req.availability_date or "Immediate",
        estimated_delivery_days=req.estimated_delivery_days or 7,
        status="SUBMITTED"
    )
    db.add(app)
    db.commit()
    db.refresh(app)

    # Notify Brand
    notif = models.PostedDealNotification(
        recipient_type="brand",
        workspace_id=deal.workspace_id,
        title="🔔 New Creator Application",
        message=f"{req.creator_name} (@{clean_handle}) applied to '{deal.campaign_name}' (Requested: ₹{req.proposed_price:,.0f})",
        deal_id=deal_id,
        application_id=app.id
    )
    db.add(notif)
    db.commit()

    return {"status": "success", "message": "Application submitted successfully!", "application": app}

# 6. Get applications for a deal (Brand side)
@router.get("/{deal_id}/applications")
def get_deal_applications(deal_id: int, db: Session = Depends(database.get_db)):
    apps = db.query(models.DealApplication).filter(models.DealApplication.deal_id == deal_id).order_by(models.DealApplication.created_at.desc()).all()
    return apps

# 7. Update application status (Brand side: Shortlist / Accept / Decline)
@router.post("/applications/{application_id}/status")
def update_application_status(application_id: int, req: schemas.ApplicationStatusUpdate, db: Session = Depends(database.get_db)):
    app = db.query(models.DealApplication).filter(models.DealApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app.status = req.status
    db.commit()

    # Notify Creator
    msg = f"Your application status for '{app.deal.campaign_name}' is now {req.status}."
    if req.status == "SHORTLISTED":
        msg = f"🎉 You've been shortlisted for '{app.deal.campaign_name}'!"
    elif req.status == "ACCEPTED":
        msg = f"🎉 Your application was ACCEPTED for '{app.deal.campaign_name}'! Please finalize the deal terms."
    
    notif = models.PostedDealNotification(
        recipient_type="creator",
        recipient_handle=app.creator_handle,
        workspace_id=app.workspace_id,
        title=f"Application {req.status.capitalize()}",
        message=msg,
        deal_id=app.deal_id,
        application_id=app.id
    )
    db.add(notif)
    db.commit()

    return {"status": "success", "application": app}

# 8. Finalize deal terms (Price, Deliverables, Delivery Days, Usage Rights)
@router.post("/applications/{application_id}/finalize")
def finalize_deal_terms(application_id: int, req: schemas.DealFinalizeRequest, db: Session = Depends(database.get_db)):
    app = db.query(models.DealApplication).filter(models.DealApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app.final_price = req.final_price
    app.final_deliverables = req.final_deliverables
    app.final_delivery_days = req.final_delivery_days
    app.usage_rights = req.usage_rights or "30 Days Digital Rights"
    app.revisions_allowed = req.revisions_allowed or 1
    app.status = "CONFIRMED"

    # Also update deal status to IN_PROGRESS
    deal = db.query(models.PostedDeal).filter(models.PostedDeal.id == app.deal_id).first()
    if deal:
        deal.status = "IN_PROGRESS"

    # Automatically generate Deliverables list items if not existing
    deliverable_titles = [d.strip() for d in req.final_deliverables.split(",") if d.strip()]
    if not deliverable_titles:
        deliverable_titles = ["Instagram Reel", "Instagram Story #1", "Instagram Story #2"]
    
    for title in deliverable_titles:
        existing_sub = db.query(models.DealDeliverableSubmission).filter(
            models.DealDeliverableSubmission.application_id == application_id,
            models.DealDeliverableSubmission.title == title
        ).first()
        if not existing_sub:
            sub = models.DealDeliverableSubmission(
                application_id=application_id,
                deal_id=app.deal_id,
                title=title,
                status="PENDING",
                due_date="2026-08-30"
            )
            db.add(sub)

    db.commit()

    return {"status": "success", "message": "Deal terms finalized and confirmed!", "application": app}

# 9. Submit Deliverable (Creator side)
@router.post("/applications/{application_id}/submissions")
def submit_deliverable(application_id: int, req: schemas.DeliverableSubmissionCreate, db: Session = Depends(database.get_db)):
    app = db.query(models.DealApplication).filter(models.DealApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    sub = db.query(models.DealDeliverableSubmission).filter(
        models.DealDeliverableSubmission.application_id == application_id,
        models.DealDeliverableSubmission.title == req.title
    ).first()

    if not sub:
        sub = models.DealDeliverableSubmission(
            application_id=application_id,
            deal_id=app.deal_id,
            title=req.title
        )
        db.add(sub)

    sub.submission_type = req.submission_type or "video"
    sub.content_url = req.content_url
    sub.caption = req.caption
    sub.notes = req.notes
    sub.status = "UNDER_REVIEW"
    db.commit()

    # Notify Brand
    notif = models.PostedDealNotification(
        recipient_type="brand",
        workspace_id=app.workspace_id,
        title="📹 Deliverable Submitted",
        message=f"{app.creator_name} submitted '{req.title}' for review.",
        deal_id=app.deal_id,
        application_id=application_id
    )
    db.add(notif)
    db.commit()

    return {"status": "success", "message": "Deliverable submitted for review!", "submission": sub}

# 10. Get Submissions for an application
@router.get("/applications/{application_id}/submissions")
def get_deliverable_submissions(application_id: int, db: Session = Depends(database.get_db)):
    subs = db.query(models.DealDeliverableSubmission).filter(
        models.DealDeliverableSubmission.application_id == application_id
    ).all()
    return subs

# 11. Review Deliverable (Brand side: Approve / Request Revision)
@router.post("/submissions/{submission_id}/review")
def review_deliverable_submission(submission_id: int, req: schemas.SubmissionReviewRequest, db: Session = Depends(database.get_db)):
    sub = db.query(models.DealDeliverableSubmission).filter(models.DealDeliverableSubmission.id == submission_id).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Submission not found")

    sub.status = req.status
    if req.status == "REVISION_REQUESTED":
        sub.revision_reason = req.revision_reason or "Please revise as requested."

    db.commit()

    # Notify Creator
    app = db.query(models.DealApplication).filter(models.DealApplication.id == sub.application_id).first()
    if app:
        msg = f"Your deliverable '{sub.title}' was APPROVED!" if req.status == "APPROVED" else f"Revision requested for '{sub.title}': {req.revision_reason}"
        notif = models.PostedDealNotification(
            recipient_type="creator",
            recipient_handle=app.creator_handle,
            workspace_id=app.workspace_id,
            title=f"Deliverable {req.status.capitalize()}",
            message=msg,
            deal_id=sub.deal_id,
            application_id=app.id
        )
        db.add(notif)
        db.commit()

    return {"status": "success", "submission": sub}

# 12. Complete Campaign (Brand side)
@router.post("/applications/{application_id}/complete")
def complete_deal_campaign(application_id: int, db: Session = Depends(database.get_db)):
    app = db.query(models.DealApplication).filter(models.DealApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app.status = "COMPLETED"
    deal = db.query(models.PostedDeal).filter(models.PostedDeal.id == app.deal_id).first()
    if deal:
        deal.status = "COMPLETED"

    db.commit()

    # Notify Creator that cashout is available
    notif = models.PostedDealNotification(
        recipient_type="creator",
        recipient_handle=app.creator_handle,
        workspace_id=app.workspace_id,
        title="🎉 Campaign Completed!",
        message=f"Campaign '{app.deal.campaign_name}' has been marked completed. Payout of ₹{app.final_price or app.proposed_price:,.0f} is now available for cashout!",
        deal_id=app.deal_id,
        application_id=application_id
    )
    db.add(notif)
    db.commit()

    return {"status": "success", "message": "Campaign completed!", "application": app}

# 13. Creator Payout / Cashout Request
@router.post("/applications/{application_id}/payout")
def request_deal_payout(application_id: int, db: Session = Depends(database.get_db)):
    app = db.query(models.DealApplication).filter(models.DealApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    app.cashout_requested = True
    app.cashout_status = "REQUESTED"
    db.commit()

    notif = models.PostedDealNotification(
        recipient_type="brand",
        workspace_id=app.workspace_id,
        title="💳 Payout Requested",
        message=f"{app.creator_name} (@{app.creator_handle}) requested cashout for ₹{app.final_price or app.proposed_price:,.0f}.",
        deal_id=app.deal_id,
        application_id=application_id
    )
    db.add(notif)
    db.commit()

    return {"status": "success", "message": "Payout request submitted! Raftra admin will verify and release funds.", "cashout_status": "REQUESTED"}

# 14. Get Creator Applications (Creator side)
@router.get("/creator/applications/{handle}")
def get_creator_applications(handle: str, db: Session = Depends(database.get_db)):
    clean_handle = handle.replace("@", "").strip()
    apps = db.query(models.DealApplication).filter(models.DealApplication.creator_handle == clean_handle).order_by(models.DealApplication.created_at.desc()).all()
    result = []
    for a in apps:
        deal = db.query(models.PostedDeal).filter(models.PostedDeal.id == a.deal_id).first()
        result.append({
            "id": a.id,
            "deal_id": a.deal_id,
            "campaign_name": deal.campaign_name if deal else "Brand Campaign",
            "brand_name": deal.brand_name if deal else "Brand",
            "proposed_price": a.proposed_price,
            "final_price": a.final_price,
            "status": a.status,
            "cashout_requested": a.cashout_requested,
            "cashout_status": a.cashout_status,
            "created_at": a.created_at
        })
    return result

# 15. Get Notifications
@router.get("/notifications")
def get_notifications(recipient_type: str = "creator", handle: Optional[str] = None, workspace_id: Optional[int] = 1, db: Session = Depends(database.get_db)):
    query = db.query(models.PostedDealNotification).filter(models.PostedDealNotification.recipient_type == recipient_type)
    if recipient_type == "creator" and handle:
        clean_handle = handle.replace("@", "").strip()
        query = query.filter((models.PostedDealNotification.recipient_handle == clean_handle) | (models.PostedDealNotification.recipient_handle == "all"))
    elif recipient_type == "brand":
        query = query.filter(models.PostedDealNotification.workspace_id == (workspace_id or 1))
    
    notifs = query.order_by(models.PostedDealNotification.created_at.desc()).limit(20).all()
    return notifs
