"""
Optional monthly automation: run the SEO + GEO audit pipeline for every workspace
on a schedule.

OFF BY DEFAULT. An audit must only ever start because a user clicked "Run SEO
Pipeline" / "Run GEO Pipeline" — a pipeline that starts on its own burns crawler
and LLM quota, and shows the user a report they never asked for (and, mid-run, a
pipeline graph lighting up on a page they just opened). Set
ENABLE_MONTHLY_AUDITS=true only if you deliberately want unattended monthly runs.

Uses APScheduler's AsyncIOScheduler (in-process) rather than Celery beat, so it
needs no Redis broker - it runs inside the FastAPI event loop. The pipelines it
calls (run_seo_pipeline / run_geo_pipeline) are the real ones: they crawl the
site, compute real metrics / run the LLM recall probe, save the report, and
record agent status. If no client is connected, the WebSocket broadcasts simply
no-op and the results are still persisted.
"""
import asyncio
import os
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

_scheduler: AsyncIOScheduler | None = None

# Space audits out so a burst of workspaces doesn't hammer the LLM/crawler quota
# all at once (the free Gemini tier is per-day, per-model).
_DELAY_BETWEEN_WORKSPACES_SEC = 20


def is_enabled() -> bool:
    """Unattended audits are opt-in. Anything other than an explicit truthy value
    keeps the "only runs when the user clicks" guarantee."""
    return os.getenv("ENABLE_MONTHLY_AUDITS", "false").strip().lower() in ("1", "true", "yes", "on")


async def run_monthly_audits():
    """Iterate every workspace that has a site URL and run SEO + GEO for it."""
    from database import SessionLocal
    import models
    from core.agent_status import is_running, register_task, reconcile_stale_running

    with SessionLocal() as db:
        workspaces = db.query(models.Workspace).filter(models.Workspace.company_url.isnot(None)).all()
        # Materialise (id, url) now so we don't hold the session across long awaits.
        targets = [(w.id, w.company_url) for w in workspaces if (w.company_url or "").strip()]

    print(f"[scheduler] Monthly audit run starting for {len(targets)} workspace(s).")
    from agents.seo_geo import run_seo_pipeline, run_geo_pipeline

    for ws_id, url in targets:
        for label, runner in (("SEO", run_seo_pipeline), ("GEO", run_geo_pipeline)):
            try:
                # Go through the same single-flight registry the trigger endpoint uses.
                # Without this a scheduled run is invisible to is_running(), so a user
                # clicking Run at the same moment starts a *second* concurrent audit on
                # the same workspace, and the run-status endpoint reports the scheduled
                # run as "failed" (it maps RUNNING with no live task to failed).
                reconcile_stale_running(ws_id, label)
                if is_running(ws_id, label):
                    print(f"[scheduler] {label} already running for workspace {ws_id}; skipping.")
                    continue
                task = asyncio.create_task(runner(ws_id, url))
                register_task(ws_id, label, task)
                await task
            except Exception as e:
                # One workspace failing must never stop the rest of the run.
                print(f"[scheduler] {label} audit failed for workspace {ws_id} ({url}): {e}")
        await asyncio.sleep(_DELAY_BETWEEN_WORKSPACES_SEC)

    print("[scheduler] Monthly audit run complete.")


def start_scheduler():
    """Start the monthly scheduler if it is explicitly enabled. Safe to call once at
    app startup; a no-op (returning None) when unattended audits are off."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    if not is_enabled():
        print("[scheduler] Monthly SEO/GEO audits are DISABLED (ENABLE_MONTHLY_AUDITS is not set). "
              "Audits run only when a user clicks Run SEO/GEO Pipeline.")
        return None

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
