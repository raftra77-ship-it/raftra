from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
import database, auth, models
from pydantic import BaseModel

# Import our workspace pipelines
from agents.creative_studio import run_creative_pipeline
from agents.campaign_manager import run_campaign_pipeline
from agents.seo_geo import run_seo_pipeline
from agents.analytics import run_analytics_pipeline
from agents.social_hub import run_social_pipeline
from agents.influencers import run_influencer_pipeline

router = APIRouter(prefix="/api/agents", tags=["agents"])

class CreativeTrigger(BaseModel):
    target_product: str
    concept_strategy: str

class CampaignTrigger(BaseModel):
    platform: str
    campaign_name: str
    objective: str
    budget: float

class SEOTrigger(BaseModel):
    target_url: str

class AnalyticsTrigger(BaseModel):
    query_message: str

class SocialTrigger(BaseModel):
    platform: str
    caption_topic: str

class InfluencerTrigger(BaseModel):
    creator_id: int
    creator_name: str

@router.post("/{workspace_id}/creative")
async def trigger_creative(workspace_id: int, request: CreativeTrigger, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user)):
    background_tasks.add_task(
        run_creative_pipeline,
        workspace_id=workspace_id,
        brand_url="aura.com",
        target_product=request.target_product,
        concept_strategy=request.concept_strategy
    )
    return {"status": "success", "message": "Creative Studio agent pipeline triggered."}

@router.post("/{workspace_id}/campaign")
async def trigger_campaign(workspace_id: int, request: CampaignTrigger, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user)):
    background_tasks.add_task(
        run_campaign_pipeline,
        workspace_id=workspace_id,
        platform=request.platform,
        campaign_name=request.campaign_name,
        objective=request.objective,
        budget=request.budget
    )
    return {"status": "success", "message": "Campaign Manager agent pipeline triggered."}

@router.post("/{workspace_id}/seo")
async def trigger_seo(workspace_id: int, request: SEOTrigger, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user)):
    background_tasks.add_task(
        run_seo_pipeline,
        workspace_id=workspace_id,
        target_url=request.target_url
    )
    return {"status": "success", "message": "SEO & GEO agent pipeline triggered."}

@router.post("/{workspace_id}/analytics")
async def trigger_analytics(workspace_id: int, request: AnalyticsTrigger, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user)):
    background_tasks.add_task(
        run_analytics_pipeline,
        workspace_id=workspace_id,
        query_message=request.query_message
    )
    return {"status": "success", "message": "Analytics agent pipeline triggered."}

@router.post("/{workspace_id}/social")
async def trigger_social(workspace_id: int, request: SocialTrigger, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user)):
    background_tasks.add_task(
        run_social_pipeline,
        workspace_id=workspace_id,
        platform=request.platform,
        caption_topic=request.caption_topic
    )
    return {"status": "success", "message": "Social Hub agent pipeline triggered."}

@router.post("/{workspace_id}/influencer")
async def trigger_influencer(workspace_id: int, request: InfluencerTrigger, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user)):
    background_tasks.add_task(
        run_influencer_pipeline,
        workspace_id=workspace_id,
        creator_id=request.creator_id,
        creator_name=request.creator_name
    )
    return {"status": "success", "message": "Influencer Marketplace agent pipeline triggered."}
