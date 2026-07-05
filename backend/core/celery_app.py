import os
from celery import Celery

# Initialize Celery app
celery_app = Celery(
    "raftra_worker",
    broker=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.getenv("REDIS_URL", "redis://localhost:6379/0"),
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
