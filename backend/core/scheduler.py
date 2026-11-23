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

# How often the intelligence jobs ASK whether a sync is owed - not how often they sync.
# Kept under Render's fifteen-minute idle timeout so a free-tier process polls at least
# once before it is put to sleep; the due-ness check in core.intel_sync is what stops a
# frequent poll turning into a frequent sync.
_INTEL_POLL_MINUTES = int(os.getenv("INTEL_POLL_MINUTES", "10"))


RULE_ENFORCEMENT_MINUTES = int(os.getenv("RULE_ENFORCEMENT_MINUTES", "30"))


def rule_enforcement_enabled() -> bool:
    """Whether saved Optimization Rules actually pause campaigns. Opt-in: see
    core/rule_enforcer.py for why unattended pausing is not on by default."""
    return os.getenv("ENABLE_RULE_ENFORCEMENT", "false").strip().lower() in ("1", "true", "yes", "on")


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
    """The external intelligence syncs - market trends every 2 weeks, competitor ads every 4.

    On by default: the product promises both reports keep themselves current once a brand
    URL is set, and defaulting to off meant a workspace that had onboarded correctly still
    showed empty reports until someone found the Sync now button. They spend third-party
    API quota (Meta/Apify, SerpApi, YouTube) per onboarded workspace, so ENABLE_INTEL_SYNCS
    can still be set to false to turn them off - the reports remain runnable on demand.
    """
    return os.getenv("ENABLE_INTEL_SYNCS", "true").strip().lower() in ("1", "true", "yes", "on")


# --------------------------------------------------------- user-created schedules

# How often due schedules are checked. Fine-grained enough that an hourly schedule fires
# close to its minute, cheap enough that a quiet workspace costs one indexed query per
# tick. Exported so the API reports the interval it is actually running, rather than a
# number written separately in the UI that can drift away from this one.
SCHEDULE_TICK_MINUTES = 5


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
        _scheduler.add_job(
            run_due_schedules,
            IntervalTrigger(minutes=SCHEDULE_TICK_MINUTES),
            id="user_scheduled_tasks",
            replace_existing=True,
            misfire_grace_time=600,
            coalesce=True,
            max_instances=1,
        )
        print("[scheduler] Marketing Calendar schedules are ACTIVE "
              "(checked every %d minutes)." % SCHEDULE_TICK_MINUTES)

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
        from core.intel_sync import (run_all_competitor_ad_syncs, run_all_market_trend_syncs,
                                     AD_SYNC_DAYS, TREND_SYNC_DAYS)

        # These two jobs POLL; they do not themselves keep the cadence. Each run asks the
        # database which workspaces are owed a sync (intel_sync.is_due) and skips the rest.
        #
        # The trigger used to carry the cadence directly - IntervalTrigger(days=15) from a
        # start_date of boot+3h - which quietly made process uptime the schedule. This
        # scheduler uses APScheduler's default in-memory job store, so a restart forgets
        # when a job last fired and re-arms it relative to the new boot. Render's free tier
        # sleeps the process after fifteen idle minutes, so the competitor-ad job needed
        # three unbroken hours just to fire once and fifteen unbroken days to fire twice:
        # in production it did not attempt a single run between 2026-09-25 and 2026-11-03.
        #
        # Cadences are the product's, not inferred: market trends every 30 days, competitor
        # ads every 15. An earlier comment here argued the reverse — that trends move faster
        # than a rival's creative rotation, so trends deserved the shorter slot — and swapped
        # them on that reasoning. That is backwards for this product: a competitor's live ad
        # set is the thing that changes week to week and is worth catching early, while a
        # market trend report is a slower, broader read. They now live in one place,
        # core.intel_sync, because the UI quotes the same numbers back to the user.
        #
        # The poll window is deliberately shorter than Render's fifteen-minute idle timeout.
        # A longer one would reintroduce the same bug in miniature: a free-tier process that
        # sleeps before the first poll fires never syncs at all. The old hour-long deferral
        # was there to stop a redeploy stampeding every workspace at once; that job now
        # belongs to the due-ness check, which only returns workspaces genuinely overdue, so
        # a few minutes is enough to keep boot quiet. The two are staggered so they never
        # share a window.
        first = datetime.utcnow() + timedelta(minutes=5)
        _scheduler.add_job(
            run_all_market_trend_syncs,
            IntervalTrigger(minutes=_INTEL_POLL_MINUTES, start_date=first),
            id="monthly_market_trend_sync",
            replace_existing=True,
            misfire_grace_time=6 * 3600,
            coalesce=True,
            max_instances=1,
        )
        _scheduler.add_job(
            run_all_competitor_ad_syncs,
            IntervalTrigger(minutes=_INTEL_POLL_MINUTES, start_date=first + timedelta(minutes=2)),
            id="fortnightly_competitor_ad_sync",
            replace_existing=True,
            misfire_grace_time=6 * 3600,
            coalesce=True,
            max_instances=1,
        )
        print("[scheduler] Intelligence syncs started (market trends every %d days, "
              "competitor ads every %d days; due-check every %dm, first check ~5m from boot)."
              % (TREND_SYNC_DAYS, AD_SYNC_DAYS, _INTEL_POLL_MINUTES))

    # Campaign Optimization Rules enforcement. Opt-in for the same reason the audits are:
    # this one PAUSES live advertising without the user present, so it must be a deliberate
    # decision per deployment rather than something a dev machine does to production data.
    if rule_enforcement_enabled():
        from core.rule_enforcer import run_rule_enforcement

        _scheduler.add_job(
            run_rule_enforcement,
            IntervalTrigger(minutes=RULE_ENFORCEMENT_MINUTES,
                            start_date=datetime.utcnow() + timedelta(minutes=2)),
            id="campaign_rule_enforcement",
            replace_existing=True,
            misfire_grace_time=600,
            coalesce=True,
            max_instances=1,
        )
        print("[scheduler] Campaign rule enforcement is ACTIVE (every %d minutes). Campaigns "
              "started from this app whose own auto-kill limits are breached will be paused."
              % RULE_ENFORCEMENT_MINUTES)
    else:
        print("[scheduler] Campaign rule enforcement is DISABLED (ENABLE_RULE_ENFORCEMENT is "
              "not set). Optimization Rules are saved but nothing pauses an ad automatically.")

    _scheduler.start()
    return _scheduler
