from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import database, models, schemas, auth
import os

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

@router.get("", response_model=List[schemas.WorkspaceResponse])
def get_workspaces(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    workspaces = db.query(models.Workspace).filter(models.Workspace.user_id == current_user.id).all()
    return workspaces

@router.get("/discover")
def discover_brands(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    workspaces = db.query(models.Workspace).all()
    return [{"id": w.id, "name": w.name} for w in workspaces]

@router.post("", response_model=schemas.WorkspaceResponse)
def create_workspace(ws: schemas.WorkspaceCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    new_ws = models.Workspace(
        name=ws.name,
        company_url=ws.company_url,
        brand_logo=ws.brand_logo,
        brand_color=ws.brand_color,
        brand_voice=ws.brand_voice,
        user_id=current_user.id
    )
    db.add(new_ws)
    db.commit()
    db.refresh(new_ws)
    return new_ws

@router.post("/{workspace_id}/reindex")
def reindex_workspace(workspace_id: int, req: schemas.ReindexRequest, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    
    # Update initial values immediately
    ws.company_url = req.url
    ws.brand_voice = req.tone
    db.commit()
    
    # Fire off the onboarding background task to actually scrape and update the knowledge base
    from agents.creative_nodes.onboarding_graph import run_onboarding_pipeline
    background_tasks.add_task(run_onboarding_pipeline, workspace_id, req.url)
    
    return {"status": "success", "message": "Knowledge Graph re-indexing started."}

def _require_workspace(workspace_id: int, db: Session, current_user: models.User):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


def _looks_like_real_topic(topic: str) -> bool:
    """Reject obvious junk (random key-mashing like 'fgg', 'asdfgh') before spending an
    LLM call. Not a spell-checker — just enough to catch nonsense."""
    import re as _re
    t = (topic or "").strip()
    if len(t) < 4:
        return False
    words = _re.findall(r"[A-Za-z][A-Za-z'-]*", t)
    if not words:
        return False
    # At least one word must look word-like: >=3 letters AND contain a vowel.
    return any(len(w) >= 3 and _re.search(r"[aeiou]", w.lower()) for w in words)


@router.post("/{workspace_id}/content/generate")
async def generate_content(workspace_id: int, req: schemas.ContentGenerateRequest, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Kick off content generation. Produces a ContentDraft (pending_review) grounded in the brand KB."""
    _require_workspace(workspace_id, db, current_user)
    if not _looks_like_real_topic(req.topic):
        raise HTTPException(status_code=422, detail="Please enter a real topic or keyword (a few words describing what to write about).")
    from agents.content_studio import run_content_generation
    background_tasks.add_task(run_content_generation, workspace_id, req.topic, req.content_type or "blog")
    return {"status": "success", "message": "Content generation started. It will appear in the review queue when ready."}


@router.get("/{workspace_id}/content")
def list_content(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """List content drafts for the human-review queue."""
    _require_workspace(workspace_id, db, current_user)
    drafts = db.query(models.ContentDraft).filter(models.ContentDraft.workspace_id == workspace_id).order_by(models.ContentDraft.id.desc()).all()
    return {"drafts": [
        {"id": d.id, "title": d.title, "body": d.body, "content_type": d.content_type,
         "target_keyword": d.target_keyword, "status": d.status,
         "created_at": d.created_at.isoformat() if d.created_at else None}
        for d in drafts
    ]}


@router.post("/{workspace_id}/content/{draft_id}/review")
def review_content(workspace_id: int, draft_id: int, req: schemas.ContentReviewRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Human review action: approve, reject, or publish a content draft."""
    _require_workspace(workspace_id, db, current_user)
    draft = db.query(models.ContentDraft).filter(models.ContentDraft.id == draft_id, models.ContentDraft.workspace_id == workspace_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    action = (req.action or "").lower()
    mapping = {"approve": "approved", "reject": "rejected", "publish": "published"}
    if action not in mapping:
        raise HTTPException(status_code=400, detail="action must be approve, reject or publish")
    draft.status = mapping[action]
    db.commit()
    return {"status": "success", "draft_id": draft_id, "new_status": draft.status}


@router.post("/{workspace_id}/content/{draft_id}/edit")
def edit_content(workspace_id: int, draft_id: int, req: schemas.ContentEditRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Let the human edit a draft's title/body (and reset it to pending_review so the
    edited version is re-approved before it can be sent to a site)."""
    _require_workspace(workspace_id, db, current_user)
    draft = db.query(models.ContentDraft).filter(models.ContentDraft.id == draft_id, models.ContentDraft.workspace_id == workspace_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if req.title is not None and req.title.strip():
        draft.title = req.title.strip()
    if req.body is not None:
        draft.body = req.body
    # An edited draft goes back to pending so the new version is reviewed, not the old one.
    draft.status = "pending_review"
    db.commit()
    return {"status": "success", "draft_id": draft_id, "new_status": draft.status}


@router.get("/{workspace_id}/agents")
def list_agent_tasks(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Real agent activity for this workspace, from the agent_tasks table (populated by
    pipelines as they run). Powers the dashboard's 'AI Agents' panel with live data."""
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")

    from core.agent_status import AGENT_LABELS
    tasks = db.query(models.AgentTask).filter(models.AgentTask.workspace_id == workspace_id).all()
    by_type = {t.agent_type: t for t in tasks}

    agents = []
    for agent_type, label in AGENT_LABELS.items():
        t = by_type.get(agent_type)
        if t:
            logs = t.logs or {}
            agents.append({
                "type": agent_type,
                "name": label,
                "status": t.status,                       # RUNNING | COMPLETED | FAILED
                "summary": logs.get("summary", ""),
                "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            })
        else:
            # Agent that has never run yet in this workspace.
            agents.append({"type": agent_type, "name": label, "status": "IDLE", "summary": "", "updated_at": None})
    return {"agents": agents}


@router.get("/{workspace_id}/recent-actions")
def recent_actions(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Recent REAL outputs the agents produced (generated ads, SEO audits, social posts,
    campaigns) - replaces the dashboard's hardcoded 'Recent AI Actions' list."""
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")

    actions = []
    # Generated ad creatives (no created_at column, so id is the recency proxy)
    for a in db.query(models.AdAsset).filter(models.AdAsset.workspace_id == workspace_id).order_by(models.AdAsset.id.desc()).limit(5).all():
        actions.append({"sort": a.id, "type": "creative", "title": "Generated Ad Creative", "detail": (a.headline or "")[:90]})
    # SEO audits (has created_at)
    for s in db.query(models.SEOAudit).filter(models.SEOAudit.workspace_id == workspace_id).order_by(models.SEOAudit.created_at.desc()).limit(3).all():
        actions.append({"sort": int(s.created_at.timestamp()) if s.created_at else s.id, "type": "seo", "title": f"SEO Audit (score {s.score})", "detail": (s.recommendation or "")[:90]})
    # Social posts
    for p in db.query(models.SocialPost).filter(models.SocialPost.workspace_id == workspace_id).order_by(models.SocialPost.id.desc()).limit(3).all():
        actions.append({"sort": p.id, "type": "social", "title": f"{p.platform} Post Drafted", "detail": (p.caption or "")[:90]})
    # Campaigns
    for c in db.query(models.Campaign).filter(models.Campaign.workspace_id == workspace_id).order_by(models.Campaign.id.desc()).limit(3).all():
        actions.append({"sort": c.id, "type": "campaign", "title": f"Campaign ({c.platform})", "detail": f"Status: {c.status}"})
    # Content drafts
    for d in db.query(models.ContentDraft).filter(models.ContentDraft.workspace_id == workspace_id).order_by(models.ContentDraft.id.desc()).limit(3).all():
        actions.append({"sort": int(d.created_at.timestamp()) if d.created_at else d.id, "type": "content", "title": f"Content: {d.title[:50]}", "detail": f"{d.content_type} - {d.status}"})

    actions.sort(key=lambda x: x["sort"], reverse=True)
    return {"actions": [{k: v for k, v in a.items() if k != "sort"} for a in actions[:8]]}


@router.get("/{workspace_id}/dashboard/metrics")
def get_dashboard_metrics(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
        
    # Calculate real data from db
    from sqlalchemy.sql import func
    
    # Ad Spend & ROAS
    campaigns = db.query(models.Campaign).filter(models.Campaign.workspace_id == workspace_id).all()
    total_spend = sum(c.budget for c in campaigns if c.status != 'DRAFT')
    avg_roas = sum(c.roas for c in campaigns if c.status != 'DRAFT') / (len([c for c in campaigns if c.status != 'DRAFT']) or 1)
    
    # SEO/GEO Score
    audits = db.query(models.SEOAudit).filter(models.SEOAudit.workspace_id == workspace_id).order_by(models.SEOAudit.created_at.desc()).all()
    seo_score = audits[0].score if audits else 0
    geo_visibility = seo_score * 0.9 if seo_score else 0 # Mock calculation for GEO based on SEO

    # Active Agents
    agents = db.query(models.AgentTask).filter(models.AgentTask.workspace_id == workspace_id, models.AgentTask.status == "RUNNING").count()

    return {
        "recent_quarter_spend": total_spend,
        "roas": round(avg_roas, 2),
        "seo_score": seo_score,
        "geo_visibility_score": round(geo_visibility, 1),
        "active_ai_agents": agents,
    }

@router.get("/{workspace_id}/dashboard/organic")
async def get_organic_dashboard(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws: raise HTTPException(status_code=403, detail="Workspace access denied")
    
    # In production, query GA4, GSC, Firecrawl data from Qdrant/PostgreSQL
    data = {
        "seo_traffic": 15400,
        "keyword_growth": "+24%",
        "geo_visibility": 88,
        "citation_count": 142,
        "entity_authority": 92
    }
    
    from core.providers.llm_providers import OpenRouterProvider
    llm = OpenRouterProvider()
    claude_prompt = f"Analyze this organic growth data and provide a 2 sentence recommendation for SEO:\n{data}"
    claude_response = await llm.generate_text(claude_prompt)
    
    data["claude_recommendation"] = claude_response
    return data

@router.get("/{workspace_id}/dashboard/paid")
async def get_paid_dashboard(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws: raise HTTPException(status_code=403, detail="Workspace access denied")
    
    data = {
        "ad_spend": 4500.00,
        "roas": 3.4,
        "ctr": 2.1,
        "conversions": 340,
        "influencer_performance": "High"
    }
    
    from core.providers.llm_providers import OpenRouterProvider
    llm = OpenRouterProvider()
    claude_prompt = f"Analyze this paid growth data and provide a 2 sentence recommendation for ad optimization and budget:\n{data}"
    claude_response = await llm.generate_text(claude_prompt)
    
    data["claude_recommendation"] = claude_response
    return data

# Campaigns
@router.get("/{workspace_id}/campaigns", response_model=List[schemas.CampaignResponse])
def get_campaigns(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    campaigns = db.query(models.Campaign).filter(models.Campaign.workspace_id == workspace_id).all()
    return campaigns

def _get_campaign_or_404(workspace_id: int, campaign_id: int, db: Session) -> "models.Campaign":
    camp = db.query(models.Campaign).filter(
        models.Campaign.id == campaign_id, models.Campaign.workspace_id == workspace_id
    ).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return camp


@router.get("/{workspace_id}/campaigns/{campaign_id}", response_model=schemas.CampaignResponse)
def get_campaign(workspace_id: int, campaign_id: int, db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    """One campaign including its full generated strategy (in `metrics`)."""
    _require_workspace(workspace_id, db, current_user)
    return _get_campaign_or_404(workspace_id, campaign_id, db)


@router.post("/{workspace_id}/campaigns/{campaign_id}/approve")
def approve_campaign(workspace_id: int, campaign_id: int, db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Human approves the AI strategy. From here the approved strategy is the single source of
    truth — creatives and ad setup stay locked until this happens."""
    _require_workspace(workspace_id, db, current_user)
    camp = _get_campaign_or_404(workspace_id, campaign_id, db)
    import datetime as _dt
    camp.status = "APPROVED"
    m = dict(camp.metrics or {})
    m["status"] = "approved"
    m["approved_at"] = _dt.datetime.utcnow().isoformat()
    camp.metrics = m
    db.commit()
    return {"status": "success", "campaign_id": camp.id, "new_status": camp.status,
            "message": "Strategy approved — it is now the source of truth for creatives and ad setup."}


@router.post("/{workspace_id}/campaigns/{campaign_id}/ad-setup")
def campaign_ad_setup(workspace_id: int, campaign_id: int, req: schemas.AdSetupRequest,
                      db: Session = Depends(database.get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    """Connect / launch a platform for this campaign. Real Meta + Google API keys are not wired
    yet, so this records a clearly-flagged MOCK setup — enough to exercise the whole flow."""
    _require_workspace(workspace_id, db, current_user)
    camp = _get_campaign_or_404(workspace_id, campaign_id, db)

    # The rule: nothing downstream may populate until the strategy is approved.
    if (camp.status or "").upper() != "APPROVED":
        raise HTTPException(status_code=409, detail="Approve the strategy first — ad setup is locked until then.")

    platform = (req.platform or "").lower()
    if platform not in ("meta", "google"):
        raise HTTPException(status_code=400, detail="platform must be 'meta' or 'google'")
    action = (req.action or "").lower()

    import datetime as _dt
    m = dict(camp.metrics or {})
    key = f"{platform}_setup"
    setup = dict(m.get(key) or {})

    if action == "connect":
        setup.update({"connected": True, "mock": True,
                      "account": f"Mock {platform.title()} Ad Account",
                      "connected_at": _dt.datetime.utcnow().isoformat()})
    elif action == "disconnect":
        setup.update({"connected": False, "launched": False})
    elif action == "launch":
        if not setup.get("connected"):
            raise HTTPException(status_code=409, detail=f"Connect {platform.title()} first.")
        setup.update({"launched": True, "mock": True,
                      "launched_at": _dt.datetime.utcnow().isoformat()})
    else:
        raise HTTPException(status_code=400, detail="action must be 'connect', 'disconnect' or 'launch'")

    m[key] = setup
    camp.metrics = m
    db.commit()
    return {"status": "success", "platform": platform, "action": action, "mock": True, "setup": setup}


@router.post("/{workspace_id}/campaigns/{campaign_id}/publish")
def publish_campaign(workspace_id: int, campaign_id: int,
                     req: Optional[schemas.PublishCampaignRequest] = None,
                     db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Final publish to the chosen platforms. Simulated (DEMO) until real Meta/Google credentials
    exist — the response says so explicitly rather than implying anything went live."""
    _require_workspace(workspace_id, db, current_user)
    camp = _get_campaign_or_404(workspace_id, campaign_id, db)
    if (camp.status or "").upper() not in ("APPROVED", "PUBLISHED_DEMO"):
        raise HTTPException(status_code=409, detail="Approve the strategy before publishing.")

    wanted = [p.lower() for p in ((req.platforms if req and req.platforms else None) or ["meta", "google"])]
    bad = [p for p in wanted if p not in ("meta", "google")]
    if bad:
        raise HTTPException(status_code=400, detail=f"Unknown platform(s): {', '.join(bad)}")

    m = dict(camp.metrics or {})
    missing = [p for p in wanted if not (m.get(f"{p}_setup") or {}).get("launched")]
    if missing:
        raise HTTPException(status_code=409,
                            detail=f"Complete the {', '.join(p.title() for p in missing)} setup before publishing.")

    import datetime as _dt
    published = list(dict.fromkeys((m.get("published_platforms") or []) + wanted))
    camp.status = "PUBLISHED_DEMO"
    m["published_at"] = _dt.datetime.utcnow().isoformat()
    m["published_mode"] = "demo"
    m["published_platforms"] = published
    camp.metrics = m
    db.commit()
    names = " & ".join(p.title() for p in wanted)
    return {"status": "success", "campaign_id": camp.id, "mode": "demo", "new_status": camp.status,
            "platforms": wanted, "published_platforms": published,
            "message": f"Published to {names} in DEMO mode — nothing was sent to a real ad account (API keys not configured)."}


@router.post("/{workspace_id}/campaigns/{campaign_id}/toggle")
def toggle_campaign(workspace_id: int, campaign_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id, models.Campaign.workspace_id == workspace_id).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    camp.status = "paused" if camp.status == "active" else "active"
    db.commit()
    return {"status": "success", "new_status": camp.status}

# Creative Assets
@router.get("/{workspace_id}/creatives", response_model=List[schemas.AdAssetResponse])
def get_creatives(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    assets = db.query(models.AdAsset).filter(models.AdAsset.workspace_id == workspace_id).order_by(models.AdAsset.id.desc()).all()
    return assets

@router.post("/{workspace_id}/creatives/save", response_model=schemas.AdAssetResponse)
def save_creative(workspace_id: int, asset: schemas.AdAssetCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    
    new_asset = models.AdAsset(
        workspace_id=workspace_id,
        headline=asset.headline,
        body_text=asset.body_text,
        cta=asset.cta,
        type=asset.type,
        image_url=asset.image_url,
        video_url=asset.video_url,
        status="approved"
    )
    db.add(new_asset)
    db.commit()
    db.refresh(new_asset)
    return new_asset

@router.post("/{workspace_id}/upload")
async def upload_asset(workspace_id: int, file: UploadFile = File(...), db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    
    # In production, upload to S3/GCS. For now, we simulate an upload by saving it locally in a temp dir or just returning success.
    upload_dir = "uploads"
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, file.filename)
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
        
    # Return a simulated public URL (could be local static route in real app)
    return {"status": "success", "url": f"/uploads/{file.filename}", "filename": file.filename}

@router.delete("/{workspace_id}/creatives/{asset_id}")
def delete_creative(workspace_id: int, asset_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
        
    asset = db.query(models.AdAsset).filter(models.AdAsset.id == asset_id, models.AdAsset.workspace_id == workspace_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ad asset not found")
        
    db.delete(asset)
    db.commit()
    return {"status": "success", "message": "Ad deleted from library"}


# SEO audits
@router.get("/{workspace_id}/seo", response_model=List[schemas.SEOAuditResponse])
def get_seo_audits(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    audits = db.query(models.SEOAudit).filter(models.SEOAudit.workspace_id == workspace_id).all()
    return audits


@router.get("/{workspace_id}/seo/latest-audit")
def latest_audit(workspace_id: int, db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    """Read-only: the most recent run's structured audit (SEO/GEO scores, category
    breakdown, top issues) for the dashboard. Nothing is computed here — it just returns
    what the pipeline already produced."""
    _require_workspace(workspace_id, db, current_user)
    rows = (db.query(models.SEOAudit)
              .filter(models.SEOAudit.workspace_id == workspace_id)
              .order_by(models.SEOAudit.created_at.desc()).all())
    latest_with_audit = next((r for r in rows if (r.keywords_data or {}).get("audit")), None)
    if not latest_with_audit:
        return {"has_audit": False, "target_url": None, "created_at": None, "audit": None}
    kd = latest_with_audit.keywords_data or {}
    return {
        "has_audit": True,
        "target_url": kd.get("target_url"),
        "created_at": latest_with_audit.created_at.isoformat() if latest_with_audit.created_at else None,
        "audit": kd.get("audit"),
    }


@router.get("/{workspace_id}/seo/comparison")
def seo_comparison(workspace_id: int, pipeline: str = "SEO",
                   db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    """Month-over-month comparison: deltas between the two most recent stored runs
    (SEO on-page metrics, or GEO AI-visibility). This is what powers the monthly report."""
    _require_workspace(workspace_id, db, current_user)
    audits = (db.query(models.SEOAudit)
                .filter(models.SEOAudit.workspace_id == workspace_id)
                .order_by(models.SEOAudit.created_at.desc()).all())
    runs = [a for a in audits if (a.keywords_data or {}).get("pipeline", "SEO") == pipeline]

    if not runs:
        return {"pipeline": pipeline, "runs_available": 0,
                "message": "No runs recorded yet — run the pipeline to start tracking."}

    current = runs[0]
    previous = runs[1] if len(runs) > 1 else None
    cur_m = (current.keywords_data or {}).get("metrics", {}) or {}
    prev_m = ((previous.keywords_data or {}).get("metrics", {}) or {}) if previous else {}

    # (metric key, human label, which direction is an improvement)
    fields = [
        ("word_count", "Word count", "higher"),
        ("images_missing_alt", "Images missing alt-text", "lower"),
        ("internal_links", "Internal links", "higher"),
        ("external_links", "External links", "higher"),
        ("h1_count", "H1 tags", "neutral"),
        ("thin_content", "Thin content", "flag"),
    ]
    changes = []
    for key, label, better in fields:
        cv = cur_m.get(key)
        if cv is None:
            continue
        pv = prev_m.get(key) if previous else None
        entry = {"metric": label, "current": cv, "previous": pv, "better_when": better}
        if isinstance(cv, (int, float)) and isinstance(pv, (int, float)) and not isinstance(cv, bool):
            delta = cv - pv
            entry["delta"] = delta
            improved = (delta > 0 and better == "higher") or (delta < 0 and better == "lower")
            worsened = (delta > 0 and better == "lower") or (delta < 0 and better == "higher")
            entry["direction"] = "improved" if improved else ("worsened" if worsened else "same")
        changes.append(entry)

    ai_visibility = None
    if pipeline == "GEO":
        ai_visibility = {
            "current_recognised": cur_m.get("brand_recognised"),
            "previous_recognised": prev_m.get("brand_recognised") if previous else None,
            "current_recall": cur_m.get("llm_recall"),
        }

    return {
        "pipeline": pipeline,
        "target_url": (current.keywords_data or {}).get("target_url"),
        "runs_available": len(runs),
        "current_run": {"date": current.created_at, "score": current.score},
        "previous_run": {"date": previous.created_at, "score": previous.score} if previous else None,
        "changes": changes,
        "ai_visibility": ai_visibility,
        "note": None if previous else "Only one run so far — the comparison fills in on the next run.",
    }


# Social posts
@router.get("/{workspace_id}/social", response_model=List[schemas.SocialPostResponse])
def get_social_posts(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    posts = db.query(models.SocialPost).filter(models.SocialPost.workspace_id == workspace_id).all()
    return posts

# Influencers
@router.get("/{workspace_id}/influencers", response_model=List[schemas.InfluencerResponse])
def get_influencers(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    # For marketplace, return all influencers globally so brands can discover them
    influencers = db.query(models.Influencer).all()
    return influencers

@router.get("/{workspace_id}/influencers/{influencer_id}/chat")
def get_chat_history(workspace_id: int, influencer_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    messages = db.query(models.ChatMessage).filter(models.ChatMessage.workspace_id == workspace_id, models.ChatMessage.influencer_id == influencer_id).order_by(models.ChatMessage.created_at.asc()).all()
    return messages

from pydantic import BaseModel
class ChatMessageCreate(BaseModel):
    content: str
    sender_type: str

class VerifyCreatorRequest(BaseModel):
    username: str
    niche: str
    base_rate: float

@router.post("/influencer/me/verify")
async def verify_creator_profile(req: VerifyCreatorRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    inf = db.query(models.Influencer).filter(models.Influencer.user_id == current_user.id).first()
    if not inf:
        # Create a new influencer profile automatically if none exists
        inf = models.Influencer(
            user_id=current_user.id,
            name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email.split('@')[0],
            niche=req.niche,
            platform="instagram",
            handle=req.username,
            fit_score=95,
            success_rate=90
        )
        db.add(inf)
        db.commit()
        db.refresh(inf)
        
    from agents.influencers import verify_instagram_profile
    result = await verify_instagram_profile(req.username, req.niche)
    
    if result.get("verification_status") == "verified":
        inf.handle = req.username
        inf.niche = req.niche
        inf.base_rate = req.base_rate
        inf.recent_collabs = result.get("recent_collabs", [])
        inf.recent_posts = result.get("recent_posts", [])
        inf.recent_reviews = result.get("recent_reviews", [])
        db.commit()
        db.refresh(inf)
        
    return {
        "status": "success",
        "data": result,
        "influencer": {
            "id": inf.id,
            "name": inf.name,
            "handle": inf.handle,
            "niche": inf.niche,
            "platform": inf.platform,
            "base_rate": inf.base_rate,
            "recent_posts": inf.recent_posts or [],
            "recent_collabs": inf.recent_collabs or [],
            "recent_reviews": inf.recent_reviews or []
        }
    }


@router.post("/{workspace_id}/influencers/{influencer_id}/chat")
async def send_chat_message(workspace_id: int, influencer_id: int, msg: ChatMessageCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    
    new_msg = models.ChatMessage(
        workspace_id=workspace_id,
        influencer_id=influencer_id,
        sender_type=msg.sender_type,
        content=msg.content
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    
    from core.websocket import manager
    # Deliver only to the two participants: the workspace owner and this influencer's user.
    participant_ids = {ws.user_id}
    inf = db.query(models.Influencer).filter(models.Influencer.id == influencer_id).first()
    if inf and inf.user_id:
        participant_ids.add(inf.user_id)
    await manager.broadcast_chat_message({
        "workspace_id": workspace_id,
        "workspace_name": ws.name,
        "influencer_id": influencer_id,
        "sender_type": new_msg.sender_type,
        "content": new_msg.content,
        "created_at": new_msg.created_at.isoformat()
    }, user_ids=participant_ids)
    return new_msg

@router.get("/influencer/me", response_model=schemas.InfluencerResponse)
def get_my_influencer(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    inf = db.query(models.Influencer).filter(models.Influencer.user_id == current_user.id).first()
    if not inf:
        inf = models.Influencer(
            user_id=current_user.id,
            name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email.split('@')[0],
            niche="",
            platform="instagram",
            handle="",
            follower_count=0,
            engagement_rate=0.0
        )
        db.add(inf)
        db.commit()
        db.refresh(inf)
    return inf

@router.post("/influencer/me/profile", response_model=schemas.InfluencerResponse)
def update_my_influencer_profile(data: schemas.InfluencerProfileUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    inf = db.query(models.Influencer).filter(models.Influencer.user_id == current_user.id).first()
    if not inf:
        raise HTTPException(status_code=404, detail="Influencer profile not found")
    
    if data.recent_posts is not None:
        inf.recent_posts = data.recent_posts
    if data.recent_collabs is not None:
        inf.recent_collabs = data.recent_collabs
    if data.recent_reviews is not None:
        inf.recent_reviews = data.recent_reviews
    if data.base_rate is not None:
        inf.base_rate = data.base_rate
        
    db.commit()
    db.refresh(inf)
    return inf

@router.get("/influencer/me/chats")
def get_my_chats(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    inf = db.query(models.Influencer).filter(models.Influencer.user_id == current_user.id).first()
    if not inf:
        return []
    messages = db.query(models.ChatMessage).filter(models.ChatMessage.influencer_id == inf.id).order_by(models.ChatMessage.created_at.asc()).all()
    return [{
        "id": msg.id,
        "workspace_id": msg.workspace_id,
        "workspace_name": msg.workspace.name if msg.workspace else "Brand",
        "influencer_id": msg.influencer_id,
        "sender_type": msg.sender_type,
        "content": msg.content,
        "created_at": msg.created_at.isoformat()
    } for msg in messages]

@router.post("/influencer/me/chats/{workspace_id}")
async def send_my_chat(workspace_id: int, msg: ChatMessageCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    inf = db.query(models.Influencer).filter(models.Influencer.user_id == current_user.id).first()
    if not inf:
        raise HTTPException(status_code=404, detail="Influencer profile not found")
    
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    ws_name = ws.name if ws else "Brand"

    new_msg = models.ChatMessage(
        workspace_id=workspace_id,
        influencer_id=inf.id,
        sender_type="influencer",
        content=msg.content
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    
    from core.websocket import manager
    # Deliver only to the two participants: this influencer's user and the workspace owner.
    participant_ids = {current_user.id}
    if ws and ws.user_id:
        participant_ids.add(ws.user_id)
    await manager.broadcast_chat_message({
        "workspace_id": workspace_id,
        "workspace_name": ws_name,
        "influencer_id": inf.id,
        "sender_type": new_msg.sender_type,
        "content": new_msg.content,
        "created_at": new_msg.created_at.isoformat()
    }, user_ids=participant_ids)
    return new_msg

# Metrics endpoint
@router.get("/{workspace_id}/metrics")
def get_workspace_metrics(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    
    campaigns = db.query(models.Campaign).filter(models.Campaign.workspace_id == workspace_id).all()
    seo_audits = db.query(models.SEOAudit).filter(models.SEOAudit.workspace_id == workspace_id).all()
    
    if not campaigns:
        return {
            "revenue": 0,
            "roas": 0.0,
            "seoVisibility": 0,
            "aiVisibility": 0,
            "campaignHealth": 0,
            "growthScore": 0
        }
    
    total_budget = sum(c.budget for c in campaigns)
    avg_roas = sum(c.roas for c in campaigns) / len(campaigns) if campaigns else 0.0
    avg_seo = sum(a.score for a in seo_audits) / len(seo_audits) if seo_audits else 0
    active_count = sum(1 for c in campaigns if c.status == 'active')
    health = int((active_count / len(campaigns)) * 100) if campaigns else 0
    
    return {
        "revenue": int(total_budget * avg_roas),
        "roas": round(avg_roas, 1),
        "seoVisibility": int(avg_seo) if avg_seo else 0,
        "aiVisibility": int(avg_seo * 0.85) if avg_seo else 0,
        "campaignHealth": health,
        "growthScore": min(100, int((health + int(avg_seo) + int(avg_roas * 10)) / 3)) if campaigns else 0
    }

from pydantic import BaseModel
class AnalyticsQuery(BaseModel):
    message: str

@router.post("/{workspace_id}/analytics/query")
def query_analytics(workspace_id: int, query: AnalyticsQuery, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    msg = query.message.lower()
    if "conversion" in msg or "drop" in msg:
        explanation = "Conversions dropped 12% on Meta Campaign cp-1. Analysis: CPA rose to $28.40 due to static creative fatigue. Suggestion: Transfer 15% budget to Google Search Ads immediately."
    elif "fatigue" in msg:
        explanation = "Creative fatigue is active on Facebook Static Adset 4. Analysis: Average frequency reached 4.8x. Suggestion: Swap Concept A headline with variant B."
    else:
        explanation = "Analytics summary compiled. Analysis: Core channels indicate high target conversions. ROAS sits strong at 4.0x. Suggestion: Scale Google Ads limits by 14%."
    return {"sender": "claude", "text": explanation}
