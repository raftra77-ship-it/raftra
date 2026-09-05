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
from datetime import datetime, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

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


def intel_syncs_enabled() -> bool:
    """The external intelligence syncs - competitor ads every 2 weeks, market trends every
    4 - are opt-in for the same reason audits are: they spend third-party API quota
    (Meta/Apify, SerpApi, YouTube) on every onboarded workspace, whether or not anyone is
    looking. Both can always be run on demand from Market Intelligence."""
    return os.getenv("ENABLE_INTEL_SYNCS", "false").strip().lower() in ("1", "true", "yes", "on")


# --------------------------------------------------------- user-created schedules

def schedules_enabled() -> bool:
    """ON by default, unlike the other jobs here.

    The distinction that matters: the monthly audits and the intelligence syncs run against
    EVERY workspace whether or not anyone asked, so they are opt-in. A ScheduledTask exists
    only because a user went to the Marketing Calendar and created it - running it is the
    entire point, and a schedule that silently never fires is worse than no feature.
    """
    return os.getenv("DISABLE_SCHEDULED_TASKS", "").strip().lower() not in ("1", "true", "yes", "on")


async def run_due_schedules():
    """Execute every ScheduledTask whose next_run_at has passed.

    This is the same work POST /api/schedules/tick does, run in-process. That endpoint has
    always existed and been correct, but it needs an external cron to call it and refuses
    to run at all unless SCHEDULER_TICK_SECRET is set - neither of which was true, so every
    schedule a user created sat in the table and never fired. The HTTP endpoint stays for
    deployments that prefer driving this from a real cron.

    next_run_at is advanced BEFORE the work starts, so a run that outlasts the interval
    cannot be claimed twice by the following tick.
    """
    import datetime
    from database import SessionLocal
    import models
    from schedule_routes import compute_next_run, run_schedule_now

    now = datetime.datetime.utcnow()
    with SessionLocal() as db:
        due = (db.query(models.ScheduledTask)
                 .filter(models.ScheduledTask.enabled.is_(True),
                         models.ScheduledTask.next_run_at.isnot(None),
                         models.ScheduledTask.next_run_at <= now)
                 .all())
        if not due:
            return
        claimed = []
        for s in due:
            s.next_run_at = compute_next_run(s, after=now)
            claimed.append((s.id, s.name))
        db.commit()

    print("[scheduler] running %d due schedule(s): %s"
          % (len(claimed), ", ".join(n for _, n in claimed)))
    for sid, name in claimed:
        try:
            # run_schedule_now is synchronous and does its own DB session and status
            # recording, so it goes to a thread rather than blocking the event loop.
            await asyncio.to_thread(run_schedule_now, sid)
        except Exception as e:
            # One failing schedule must not stop the rest of the tick.
            print("[scheduler] schedule %s (%s) failed: %s" % (sid, name, e))


def start_scheduler():
    """Start the background schedulers that are explicitly enabled. Safe to call once at
    app startup; returns None when nothing is enabled."""
    global _scheduler
    if _scheduler is not None:
        return _scheduler

    audits, intel, schedules = is_enabled(), intel_syncs_enabled(), schedules_enabled()
    if not audits:
        print("[scheduler] Monthly SEO/GEO audits are DISABLED (ENABLE_MONTHLY_AUDITS is not set). "
              "Audits run only when a user clicks Run SEO/GEO Pipeline.")
    if not intel:
        print("[scheduler] Competitor-ad and market-trend syncs are DISABLED "
              "(ENABLE_INTEL_SYNCS is not set). They run only when a user clicks Sync now.")
    if not schedules:
        print("[scheduler] Marketing Calendar schedules are DISABLED "
              "(DISABLE_SCHEDULED_TASKS is set) - nothing a user schedules will run.")
    if not (audits or intel or schedules):
        return None

    _scheduler = AsyncIOScheduler(timezone="UTC")

    if schedules:
        # Every 5 minutes: fine-grained enough that an hourly schedule fires close to its
        # minute, cheap enough that a quiet workspace costs one indexed query per tick.
        _scheduler.add_job(
            run_due_schedules,
            IntervalTrigger(minutes=5),
            id="user_scheduled_tasks",
            replace_existing=True,
            misfire_grace_time=600,
            coalesce=True,
            max_instances=1,
        )
        print("[scheduler] Marketing Calendar schedules are ACTIVE (checked every 5 minutes).")

    if audits:
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
        print("[scheduler] Monthly SEO/GEO audit scheduler started (1st of month, 06:00 UTC).")

    if intel:
        from core.intel_sync import run_all_competitor_ad_syncs, run_all_market_trend_syncs

        # Interval rather than cron: the cadences the spec asks for are "every 2 weeks" and
        # "every 4 weeks", and a cron day-of-month rule drifts against that in every month
        # that is not 28 days long. The first run is deferred by an hour so a redeploy does
        # not fire both syncs for every workspace the moment the process boots.
        first = datetime.utcnow() + timedelta(hours=1)
        _scheduler.add_job(
            run_all_competitor_ad_syncs,
            IntervalTrigger(weeks=2, start_date=first),
            id="biweekly_competitor_ad_sync",
            replace_existing=True,
            misfire_grace_time=6 * 3600,
            coalesce=True,
            max_instances=1,
        )
        _scheduler.add_job(
            run_all_market_trend_syncs,
            IntervalTrigger(weeks=4, start_date=first + timedelta(hours=2)),
            id="four_weekly_market_trend_sync",
            replace_existing=True,
            misfire_grace_time=6 * 3600,
            coalesce=True,
            max_instances=1,
        )
        print("[scheduler] Intelligence syncs started (competitor ads every 2 weeks, "
              "market trends every 4 weeks; first run ~1h from boot).")

    _scheduler.start()
    return _scheduler
