from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
import database, auth, models
from pydantic import BaseModel
from typing import Optional
import schemas

# Import our workspace pipelines
from agents.creative_nodes.generation_graph import run_ad_generation_task
from agents.creative_nodes.onboarding_graph import run_onboarding_pipeline
from agents.campaign_manager import run_campaign_pipeline
from agents.seo_geo import run_seo_pipeline, run_seo_publish_pipeline, run_geo_pipeline, run_geo_publish_pipeline
from agents.analytics import run_analytics_pipeline
from agents.social_hub import run_social_pipeline
from agents.influencers import run_influencer_pipeline

router = APIRouter(prefix="/api/agents", tags=["agents"])

class OnboardTrigger(BaseModel):
    brand_url: str

class CreativeTrigger(BaseModel):
    prompt: str
    reference_ad: Optional[dict] = None
    model: str = "gemini-1.5-flash"
    ad_format: str = "Video"
    ad_ratio: str = "9:16"
    ad_length: str = "15s"
    engine_mode: str = "Video Ad"

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

@router.post("/onboard")
async def trigger_onboarding(request: OnboardTrigger):
    try:
        # Await the execution inline so we can return the exact scraped brand data to the frontend
        result = await run_onboarding_pipeline(workspace_id=0, brand_url=request.brand_url)
        return {
            "status": "success", 
            "data": {
                "typography": result.get("typography", {}),
                "colors": result.get("color_palette", []),
                "tone": result.get("brand_guidelines_summary", "Professional"),
                "audience": result.get("target_audience", "")
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{workspace_id}/creative")
async def trigger_creative(workspace_id: int, request: CreativeTrigger, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user)):
    background_tasks.add_task(
        run_ad_generation_task,
        workspace_id=workspace_id,
        prompt=request.prompt,
        reference_ad=request.reference_ad,
        model=request.model,
        ad_format=request.ad_format,
        ad_ratio=request.ad_ratio,
        ad_length=request.ad_length,
        engine_mode=request.engine_mode
    )
    return {"message": "Creative chat workflow triggered", "prompt": request.prompt}

@router.post("/{workspace_id}/campaign")
async def trigger_campaign(workspace_id: int, request: schemas.CampaignAgentTrigger, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user)):
    from agents.creative_nodes.campaign_graph import run_campaign_planning_task
    background_tasks.add_task(
        run_campaign_planning_task,
        workspace_id=workspace_id,
        prompt=request.prompt,
        model=request.model
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

@router.post("/{workspace_id}/seo/publish")
async def trigger_seo_publish(workspace_id: int, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user)):
    background_tasks.add_task(
        run_seo_publish_pipeline,
        workspace_id=workspace_id
    )
    return {"status": "success", "message": "SEO Publishing sequence triggered."}

@router.post("/{workspace_id}/geo")
async def trigger_geo(workspace_id: int, request: SEOTrigger, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user)):
    background_tasks.add_task(
        run_geo_pipeline,
        workspace_id=workspace_id,
        target_url=request.target_url
    )
    return {"status": "success", "message": "GEO agent pipeline triggered."}

@router.post("/{workspace_id}/geo/publish")
async def trigger_geo_publish(workspace_id: int, background_tasks: BackgroundTasks, current_user: models.User = Depends(auth.get_current_user)):
    background_tasks.add_task(
        run_geo_publish_pipeline,
        workspace_id=workspace_id
    )
    return {"status": "success", "message": "GEO Publishing sequence triggered."}

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
