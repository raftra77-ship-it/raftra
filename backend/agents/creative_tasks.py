import asyncio
from core.celery_app import celery_app
from agents.creative_nodes.onboarding_graph import run_onboarding_pipeline
from agents.creative_nodes.generation_graph import generation_graph

@celery_app.task
def task_brand_onboarding(workspace_id: int, brand_url: str, brand_logo: str = None):
    """
    Celery task to run the Brand Onboarding workflow asynchronously.
    """
    # Since run_onboarding_pipeline is async, we need an event loop
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(
        run_onboarding_pipeline(workspace_id, brand_url, brand_logo)
    )
    return result

@celery_app.task
def task_generate_ad_creative(workspace_id: int, campaign_goal: str, request_text: str):
    """
    Celery task to run the Ad Generation workflow asynchronously.
    """
    initial_state = {
        "workspace_id": workspace_id,
        "campaign_goal": campaign_goal,
        "request_text": request_text,
        "cached_typography": {},
        "cached_colors": [],
        "cached_brand_voice": "",
        "selected_image_provider": "",
        "selected_video_provider": "",
        "strategy": "",
        "copy": "",
        "image_url": "",
        "video_url": "",
        "logs": [],
        "status": "queued"
    }
    
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(
        generation_graph.ainvoke(initial_state)
    )
    return result
