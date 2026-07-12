from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
import database, auth, models
import os
import httpx

router = APIRouter(prefix="/api/integrations", tags=["integrations"])

@router.get("/oauth/google/callback")
async def google_oauth_callback(code: str, state: str, db: Session = Depends(database.get_db)):
    # In a real scenario, state contains the workspace_id and we exchange the code for tokens
    try:
        workspace_id = int(state)
        # Mock token exchange
        ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")
        # In a real app we would store tokens securely
        return {"status": "success", "message": "Google Ads connected successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

@router.get("/oauth/meta/callback")
async def meta_oauth_callback(code: str, state: str, db: Session = Depends(database.get_db)):
    try:
        workspace_id = int(state)
        ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found")
        return {"status": "success", "message": "Meta Ads connected successfully"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid state parameter")

@router.post("/publish")
async def publish_ad(workspace_id: int, ad_id: int, platform: str, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ad = db.query(models.AdAsset).filter(models.AdAsset.id == ad_id, models.AdAsset.workspace_id == workspace_id).first()
    if not ad:
        raise HTTPException(status_code=404, detail="Ad not found")
    
    # In production, this would make an API call to Meta Graph API or Google Ads API
    # to create the ad creative and associate it with a campaign.
    # For now, we simulate success and update the status.
    ad.status = "published"
    db.commit()
    
    return {"status": "success", "message": f"Ad {ad_id} published to {platform} successfully"}
