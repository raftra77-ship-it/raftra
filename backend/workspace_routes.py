from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
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

# Campaigns
@router.get("/{workspace_id}/campaigns", response_model=List[schemas.CampaignResponse])
def get_campaigns(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    campaigns = db.query(models.Campaign).filter(models.Campaign.workspace_id == workspace_id).all()
    return campaigns

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
    await manager.broadcast_chat_message({
        "workspace_id": workspace_id,
        "workspace_name": ws.name,
        "influencer_id": influencer_id,
        "sender_type": new_msg.sender_type,
        "content": new_msg.content,
        "created_at": new_msg.created_at.isoformat()
    })
    return new_msg

@router.get("/influencer/me", response_model=schemas.InfluencerResponse)
def get_my_influencer(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    inf = db.query(models.Influencer).filter(models.Influencer.user_id == current_user.id).first()
    if not inf:
        raise HTTPException(status_code=404, detail="Influencer profile not found")
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
    await manager.broadcast_chat_message({
        "workspace_id": workspace_id,
        "workspace_name": ws_name,
        "influencer_id": inf.id,
        "sender_type": new_msg.sender_type,
        "content": new_msg.content,
        "created_at": new_msg.created_at.isoformat()
    })
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
