"""
Monthly automation: run the SEO + GEO audit pipeline for every workspace on its
own, so reports "generate themselves" instead of only running when a user clicks.

Uses APScheduler's AsyncIOScheduler (in-process) rather than Celery beat, so it
needs no Redis broker - it runs inside the FastAPI event loop. The pipelines it
calls (run_seo_pipeline / run_geo_pipeline) are the real ones: they crawl the
site, compute real metrics / run the LLM recall probe, save the report, and
record agent status. If no client is connected, the WebSocket broadcasts simply
no-op and the results are still persisted.
"""
import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

_scheduler: AsyncIOScheduler | None = None

# Space audits out so a burst of workspaces doesn't hammer the LLM/crawler quota
# all at once (the free Gemini tier is per-day, per-model).
_DELAY_BETWEEN_WORKSPACES_SEC = 20


async def run_monthly_audits():
    """Iterate every workspace that has a site URL and run SEO + GEO for it."""
    from database import SessionLocal
    import models

    with SessionLocal() as db:
        workspaces = db.query(models.Workspace).filter(models.Workspace.company_url.isnot(None)).all()
        # Materialise (id, url) now so we don't hold the session across long awaits.
        targets = [(w.id, w.company_url) for w in workspaces if (w.company_url or "").strip()]

    print(f"[scheduler] Monthly audit run starting for {len(targets)} workspace(s).")
    from agents.seo_geo import run_seo_pipeline, run_geo_pipeline

    for ws_id, url in targets:
        for label, runner in (("SEO", run_seo_pipeline), ("GEO", run_geo_pipeline)):
            try:
                await runner(ws_id, url)
            except Exception as e:
                # One workspace failing must never stop the rest of the run.
                print(f"[scheduler] {label} audit failed for workspace {ws_id} ({url}): {e}")
        await asyncio.sleep(_DELAY_BETWEEN_WORKSPACES_SEC)

    print("[scheduler] Monthly audit run complete.")


def start_scheduler():
    """Start the monthly scheduler. Safe to call once at app startup."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    _scheduler = AsyncIOScheduler(timezone="UTC")
    # 06:00 UTC on the 1st of every month.
    _scheduler.add_job(
        run_monthly_audits,
        CronTrigger(day=1, hour=6, minute=0),
        id="monthly_seo_geo_audits",
        replace_existing=True,
        misfire_grace_time=3600,
        coalesce=True,
        max_instances=1,
    )
    _scheduler.start()
    print("[scheduler] Monthly SEO/GEO audit scheduler started (1st of month, 06:00 UTC).")
    return _scheduler
