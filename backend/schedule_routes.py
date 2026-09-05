"""Recurring agent runs — the backend behind the Marketing Calendar.

The calendar was entirely client-side: schedules lived in React state and disappeared on
refresh, and "Task triggered and executed successfully!" was an alert, not an outcome.
This gives it somewhere to live and something that actually runs.

Two execution paths, deliberately:

  * "Run now" goes through FastAPI's BackgroundTasks, so it works on the current
    deployment with no Redis and no worker process.
  * Recurring runs are driven by POST /api/schedules/tick, which claims and executes
    whatever is due. Point a Render Cron Job (or any external pinger) at it every five
    minutes. Celery Beat would need Redis plus two more always-on services, which the
    free tier will not run — this keeps recurring schedules working without that.

The tick endpoint is authenticated with SCHEDULER_TICK_SECRET rather than a user token,
because no user is present when a cron fires.
"""
from __future__ import annotations

import os
import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Header
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

import auth
import database
import models

router = APIRouter(prefix="/api", tags=["schedules"])

# Agents a schedule may run. Anything outside this list is rejected rather than stored,
# so a typo cannot sit in the table failing silently every night.
# Only agents with a runner in run_schedule_now() below. "analytics", "social" and
# "influencer" were listed here too, so a schedule could be created for them and would
# then fail on every run with "has no scheduled runner yet" - accepted at create time,
# broken at run time.
RUNNABLE_AGENTS = {"creative", "campaign", "seo", "geo"}

CADENCES = {"hourly", "daily", "weekly", "monthly"}


# ----------------------------------------------------------------- schemas
class ScheduleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    agent: str
    cadence: str = "daily"
    hour: int = Field(default=9, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    weekday: Optional[int] = Field(default=None, ge=0, le=6)     # 0=Mon, weekly only
    day_of_month: Optional[int] = Field(default=None, ge=1, le=28)  # monthly only
    prompt: Optional[str] = None
    enabled: bool = True


class ScheduleUpdate(BaseModel):
    name: Optional[str] = None
    cadence: Optional[str] = None
    hour: Optional[int] = Field(default=None, ge=0, le=23)
    minute: Optional[int] = Field(default=None, ge=0, le=59)
    weekday: Optional[int] = Field(default=None, ge=0, le=6)
    day_of_month: Optional[int] = Field(default=None, ge=1, le=28)
    prompt: Optional[str] = None
    enabled: Optional[bool] = None


class ScheduleOut(BaseModel):
    id: int
    workspace_id: int
    name: str
    agent: str
    cadence: str
    hour: int
    minute: int
    weekday: Optional[int]
    day_of_month: Optional[int]
    prompt: Optional[str]
    enabled: bool
    last_run_at: Optional[datetime.datetime]
    last_status: Optional[str]
    last_message: Optional[str]
    next_run_at: Optional[datetime.datetime]

    class Config:
        from_attributes = True


# ----------------------------------------------------------------- helpers
def _own_workspace(workspace_id: int, db: Session, user: models.User) -> models.Workspace:
    ws = (db.query(models.Workspace)
            .filter(models.Workspace.id == workspace_id,
                    models.Workspace.user_id == user.id)
            .first())
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


def compute_next_run(s: models.ScheduledTask, after: datetime.datetime | None = None) -> datetime.datetime:
    """First occurrence strictly after `after` (default: now), in UTC.

    Deliberately simple arithmetic rather than a cron parser: the UI only offers hourly,
    daily, weekly and monthly, and a dependency-free calculation is easier to reason about
    when a schedule silently stops firing.
    """
    now = after or datetime.datetime.utcnow()

    if s.cadence == "hourly":
        nxt = now.replace(minute=s.minute or 0, second=0, microsecond=0)
        if nxt <= now:
            nxt += datetime.timedelta(hours=1)
        return nxt

    nxt = now.replace(hour=s.hour or 0, minute=s.minute or 0, second=0, microsecond=0)

    if s.cadence == "daily":
        if nxt <= now:
            nxt += datetime.timedelta(days=1)
        return nxt

    if s.cadence == "weekly":
        target = s.weekday if s.weekday is not None else 0
        delta = (target - nxt.weekday()) % 7
        nxt += datetime.timedelta(days=delta)
        if nxt <= now:
            nxt += datetime.timedelta(days=7)
        return nxt

    if s.cadence == "monthly":
        dom = s.day_of_month or 1
        nxt = nxt.replace(day=min(dom, 28))
        if nxt <= now:
            nxt = (nxt.replace(day=1) + datetime.timedelta(days=32)).replace(day=min(dom, 28),
                                                                             hour=s.hour or 0,
                                                                             minute=s.minute or 0,
                                                                             second=0, microsecond=0)
        return nxt

    return now + datetime.timedelta(days=1)


def run_schedule_now(schedule_id: int) -> None:
    """Execute one schedule's agent and record the outcome.

    Runs in a background thread with its own session, so it must never raise into the
    caller — a failed run is recorded on the row and surfaced in the UI instead.
    """
    db = database.SessionLocal()
    try:
        s = db.query(models.ScheduledTask).filter(models.ScheduledTask.id == schedule_id).first()
        if not s:
            return
        ws = db.query(models.Workspace).filter(models.Workspace.id == s.workspace_id).first()
        prompt = s.prompt or f"Scheduled run: {s.name}"

        try:
            # Every runner below is async. Called without a loop they return a coroutine
            # that is never awaited, so the run does nothing and is still recorded as a
            # success - which is how three of these could be broken without anyone noticing.
            if s.agent == "campaign":
                import asyncio
                from agents.creative_nodes.campaign_graph import run_campaign_planning_task
                asyncio.run(run_campaign_planning_task(workspace_id=s.workspace_id,
                                                       prompt=prompt,
                                                       model="gemini-2.5-flash"))
            elif s.agent == "creative":
                # run_creative_task does not exist, so this used to fail on the import. Goes
                # through the same service Creative Studio's own generate endpoint uses -
                # agents.creative_studio.run_creative_pipeline is the older graph, and it
                # only broadcasts log lines: it writes no AdAsset, so a scheduled run would
                # report success and leave nothing behind.
                import asyncio
                from agents.creative_nodes.router import router_decision_engine
                from core.creative import optimizer
                from core.creative.service import service as creative_service

                async def _generate() -> None:
                    spec = await creative_service.plan(workspace_id=s.workspace_id,
                                                       prompt=prompt, media_type="image")
                    prompts = optimizer.build_prompts(spec)
                    provider = router_decision_engine("conversion", prompt)["image_provider"]
                    creative_id = creative_service.create_row(workspace_id=s.workspace_id,
                                                              spec=spec, prompts=prompts,
                                                              provider=provider)
                    await creative_service.run(creative_id, spec, prompts, provider,
                                               s.workspace_id)

                asyncio.run(_generate())
            elif s.agent in ("seo", "geo"):
                # There is no run_seo_geo_pipeline; the module exposes one entry point per
                # pipeline, so this used to fail on the import every time.
                import asyncio
                from agents.seo_geo import run_seo_pipeline, run_geo_pipeline
                target = (ws.company_url if ws else "") or ""
                if not target:
                    raise RuntimeError("This workspace has no website set, so there is nothing to audit.")
                runner = run_seo_pipeline if s.agent == "seo" else run_geo_pipeline
                asyncio.run(runner(s.workspace_id, target))
            else:
                raise RuntimeError(f"'{s.agent}' has no scheduled runner yet")

            s.last_status = "success"
            s.last_message = "Completed."
        except Exception as e:  # noqa: BLE001 - recorded, not raised
            s.last_status = "failed"
            s.last_message = str(e)[:400]

        s.last_run_at = datetime.datetime.utcnow()
        s.next_run_at = compute_next_run(s)
        db.commit()

        # Tell the owner what happened. An unattended run that failed at 07:00 is invisible
        # otherwise - the only trace was a status column nobody was watching.
        try:
            from notification_routes import create_notification
            owner_id = ws.user_id if ws else None
            if owner_id:
                if s.last_status == "success":
                    create_notification(
                        db, owner_id,
                        title=f"{s.name} finished",
                        message=f"The scheduled {s.agent} run completed.",
                        type="agent",
                        action_url="/dashboard?tab=scheduler")
                else:
                    create_notification(
                        db, owner_id,
                        title=f"{s.name} failed",
                        message=s.last_message or f"The scheduled {s.agent} run did not complete.",
                        type="agent",
                        action_url="/dashboard?tab=scheduler")
        except Exception as e:  # noqa: BLE001 - a notification must never fail the run
            print(f"[scheduler] could not write notification for schedule {schedule_id}: {e}")
    finally:
        db.close()


# ----------------------------------------------------------------- routes
@router.get("/workspaces/{workspace_id}/schedules", response_model=List[ScheduleOut])
def list_schedules(workspace_id: int, db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    _own_workspace(workspace_id, db, current_user)
    return (db.query(models.ScheduledTask)
              .filter(models.ScheduledTask.workspace_id == workspace_id)
              .order_by(models.ScheduledTask.created_at.desc())
              .all())


@router.post("/workspaces/{workspace_id}/schedules", response_model=ScheduleOut)
def create_schedule(workspace_id: int, body: ScheduleCreate,
                    db: Session = Depends(database.get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    _own_workspace(workspace_id, db, current_user)
    if body.agent not in RUNNABLE_AGENTS:
        raise HTTPException(status_code=400,
                            detail=f"Unknown agent '{body.agent}'. One of: {', '.join(sorted(RUNNABLE_AGENTS))}.")
    if body.cadence not in CADENCES:
        raise HTTPException(status_code=400,
                            detail=f"Unknown cadence '{body.cadence}'. One of: {', '.join(sorted(CADENCES))}.")

    s = models.ScheduledTask(workspace_id=workspace_id, **body.model_dump())
    s.next_run_at = compute_next_run(s)
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.patch("/workspaces/{workspace_id}/schedules/{schedule_id}", response_model=ScheduleOut)
def update_schedule(workspace_id: int, schedule_id: int, body: ScheduleUpdate,
                    db: Session = Depends(database.get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    _own_workspace(workspace_id, db, current_user)
    s = (db.query(models.ScheduledTask)
           .filter(models.ScheduledTask.id == schedule_id,
                   models.ScheduledTask.workspace_id == workspace_id).first())
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")

    data = body.model_dump(exclude_unset=True)
    if "cadence" in data and data["cadence"] not in CADENCES:
        raise HTTPException(status_code=400, detail=f"Unknown cadence '{data['cadence']}'.")
    for k, v in data.items():
        setattr(s, k, v)
    s.next_run_at = compute_next_run(s)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/workspaces/{workspace_id}/schedules/{schedule_id}")
def delete_schedule(workspace_id: int, schedule_id: int,
                    db: Session = Depends(database.get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    _own_workspace(workspace_id, db, current_user)
    s = (db.query(models.ScheduledTask)
           .filter(models.ScheduledTask.id == schedule_id,
                   models.ScheduledTask.workspace_id == workspace_id).first())
    if s:
        db.delete(s)
        db.commit()
    return {"status": "success"}


@router.post("/workspaces/{workspace_id}/schedules/{schedule_id}/run")
def run_schedule(workspace_id: int, schedule_id: int, background_tasks: BackgroundTasks,
                 db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    """Run one schedule immediately. Needs no Redis — the agent runs in-process."""
    _own_workspace(workspace_id, db, current_user)
    s = (db.query(models.ScheduledTask)
           .filter(models.ScheduledTask.id == schedule_id,
                   models.ScheduledTask.workspace_id == workspace_id).first())
    if not s:
        raise HTTPException(status_code=404, detail="Schedule not found")
    background_tasks.add_task(run_schedule_now, s.id)
    return {"status": "success", "message": f"{s.name} started. Its result appears here when it finishes."}


@router.post("/schedules/tick")
def tick(background_tasks: BackgroundTasks,
         x_scheduler_secret: str = Header(default=""),
         db: Session = Depends(database.get_db)):
    """Run everything that is due. Call every ~5 minutes from a cron job.

    Not user-authenticated: a cron has no session. Guarded by SCHEDULER_TICK_SECRET, and
    refuses to run at all while that is unset rather than leaving an open trigger endpoint.
    """
    secret = os.getenv("SCHEDULER_TICK_SECRET", "")
    if not secret:
        raise HTTPException(status_code=503,
                            detail="SCHEDULER_TICK_SECRET is not set, so scheduled runs are disabled.")
    if x_scheduler_secret != secret:
        raise HTTPException(status_code=403, detail="Bad scheduler secret")

    now = datetime.datetime.utcnow()
    due = (db.query(models.ScheduledTask)
             .filter(models.ScheduledTask.enabled.is_(True),
                     models.ScheduledTask.next_run_at <= now)
             .all())

    # Push next_run_at forward before running, so a slow run cannot be picked up twice by
    # an overlapping tick.
    started = []
    for s in due:
        s.next_run_at = compute_next_run(s, after=now)
        started.append({"id": s.id, "name": s.name, "agent": s.agent})
    db.commit()

    for s in due:
        background_tasks.add_task(run_schedule_now, s.id)

    return {"status": "success", "started": started, "count": len(started)}


# ------------------------------------------------------- brand events (calendar)
class EventCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    event_date: datetime.date
    category: Optional[str] = None


class EventOut(BaseModel):
    id: int
    name: str
    event_date: datetime.date
    category: Optional[str]

    class Config:
        from_attributes = True


@router.get("/retail-calendar")
def retail_calendar(within_days: int = 180):
    """Festivals and retail moments a brand should plan around, with lead times.

    Served from the backend rather than the three dates that were hardcoded in the
    calendar component, so the campaign agents can see them too (core.brand_context).
    Unauthenticated: these are public facts about the calendar, not tenant data.
    """
    from core import retail_calendar as rc
    return {
        "region": "IN",
        "upcoming": rc.upcoming(within_days=within_days),
        "covered_years": rc.COVERED_YEARS,
    }


@router.get("/workspaces/{workspace_id}/events", response_model=List[EventOut])
def list_events(workspace_id: int, db: Session = Depends(database.get_db),
                current_user: models.User = Depends(auth.get_current_user)):
    """Dates this brand is planning around, soonest first."""
    _own_workspace(workspace_id, db, current_user)
    return (db.query(models.BrandEvent)
              .filter(models.BrandEvent.workspace_id == workspace_id)
              .order_by(models.BrandEvent.event_date.asc())
              .all())


@router.post("/workspaces/{workspace_id}/events", response_model=EventOut)
def create_event(workspace_id: int, body: EventCreate,
                 db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    _own_workspace(workspace_id, db, current_user)
    ev = models.BrandEvent(
        workspace_id=workspace_id,
        name=body.name.strip(),
        # Stored as a datetime at midnight: the column is a DateTime and the countdown the
        # UI shows only needs day resolution.
        event_date=datetime.datetime.combine(body.event_date, datetime.time.min),
        category=(body.category or "").strip() or None,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


@router.delete("/workspaces/{workspace_id}/events/{event_id}")
def delete_event(workspace_id: int, event_id: int,
                 db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    _own_workspace(workspace_id, db, current_user)
    ev = (db.query(models.BrandEvent)
            .filter(models.BrandEvent.id == event_id,
                    models.BrandEvent.workspace_id == workspace_id).first())
    if not ev:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(ev)
    db.commit()
    return {"status": "success"}
