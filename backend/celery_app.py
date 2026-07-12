import os
from celery import Celery

# Supabase Postgres URL (if needed by workers)
DATABASE_URL = os.getenv("DATABASE_URL")

# Upstash Serverless Redis
REDIS_URL = os.getenv("REDIS_URL", "rediss://default:password@xxxx.upstash.io:6379")

# Celery requires ssl_cert_reqs parameter for rediss://
if REDIS_URL.startswith("rediss://") and "ssl_cert_reqs=" not in REDIS_URL:
    delimiter = "&" if "?" in REDIS_URL else "?"
    CELERY_BROKER_URL = f"{REDIS_URL}{delimiter}ssl_cert_reqs=CERT_NONE"
else:
    CELERY_BROKER_URL = REDIS_URL

celery_app = Celery(
    "raftra_worker",
    broker=CELERY_BROKER_URL,
    backend=CELERY_BROKER_URL
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    # Upstash recommendations for Celery:
    broker_pool_limit=None,
    broker_connection_timeout=30,
)

@celery_app.task
def dummy_agent_task(task_id: int):
    print(f"Executing task {task_id}")
    return True

@celery_app.task
def process_creator_profile(user_id: int, category: str, price: float):
    # This task will be picked up by the worker to verify social, detect fake followers, etc.
    from database import SessionLocal
    from models import Influencer, User
    
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user: return
        
        # Simulated extraction of recent reels/views and follower count
        # In production, this would call Firecrawl or an external API
        influencer = Influencer(
            user_id=user.id,
            name=f"{user.first_name} {user.last_name}",
            handle=user.username,
            platform="INSTAGRAM",
            niche=category or "General",
            base_rate=price or 0.0,
            fit_score=95,
            success_rate=88,
            recent_posts=[
                {"url": "https://instagram.com/p/mock1", "type": "video", "reach": 15000},
                {"url": "https://instagram.com/p/mock2", "type": "image", "reach": 8000}
            ],
            recent_collabs=["MockBrand1", "MockBrand2"],
            status="available"
        )
        db.add(influencer)
        db.commit()
    except Exception as e:
        db.rollback()
        db.close()

from celery.schedules import crontab

# Celery Beat Schedule
celery_app.conf.beat_schedule = {
    'optimize-ads-every-hour': {
        'task': 'celery_app.auto_optimize_ads',
        'schedule': crontab(minute=0, hour='*'),
    },
}

@celery_app.task
def auto_optimize_ads():
    from database import SessionLocal
    from models import Campaign, AdAsset
    import httpx
    
    db = SessionLocal()
    try:
        # Fetch active campaigns
        campaigns = db.query(Campaign).filter(Campaign.status == 'active').all()
        for campaign in campaigns:
            # Simulate fetching metrics from Meta/Google Ads
            # If CTR drops or frequency is too high
            fatigue_detected = True # Simulated detection
            
            if fatigue_detected:
                # Find an approved ad asset for this workspace that isn't currently used
                backup_asset = db.query(AdAsset).filter(
                    AdAsset.workspace_id == campaign.workspace_id,
                    AdAsset.status == 'approved'
                ).first()
                
                if backup_asset:
                    print(f"Rotating creative for campaign {campaign.id} to asset {backup_asset.id}")
                    # In production, make API call to Meta/Google to update campaign
                    # Log the change
                    
    except Exception as e:
        print(f"Auto-optimization failed: {e}")
    finally:
        db.close()
