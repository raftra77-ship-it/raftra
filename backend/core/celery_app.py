import os
from dotenv import load_dotenv

load_dotenv()
from celery import Celery

# Initialize Celery app
# For Upstash Redis, the REDIS_URL will start with 'rediss://'
redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")

celery_app = Celery(
    "raftra_worker",
    broker=redis_url,
    backend=redis_url,
    broker_use_ssl={"ssl_cert_reqs": "CERT_NONE"} if "rediss://" in redis_url else None,
    redis_backend_use_ssl={"ssl_cert_reqs": "CERT_NONE"} if "rediss://" in redis_url else None
)

# Optional configuration, see the application user guide.
celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)

# Import tasks here so Celery can discover them
# import backend.tasks.social_tasks
# import backend.tasks.crawler_tasks
import agents.creative_tasks
