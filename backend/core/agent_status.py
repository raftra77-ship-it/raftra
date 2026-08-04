"""
Real agent-run tracking.

Pipelines call record_agent_task() at the start and end of a run so the dashboard can
show ACTUAL agent activity (from the agent_tasks table) instead of hardcoded progress
bars. One row is kept per (workspace, agent_type) and updated in place, so the dashboard
always reflects the latest state of each agent.
"""
import datetime


# Friendly display names + which dashboard agents each pipeline maps to.
AGENT_LABELS = {
    "CREATIVE": "Creative Studio Agent",
    "ONBOARDING": "Brand Intelligence Agent",
    "SEO": "SEO Agent",
    "GEO": "GEO Agent",
    "SOCIAL": "Social Media Agent",
    "ANALYST": "Analytics Agent",
    "CAMPAIGN": "Campaign Manager Agent",
    "CONTENT": "Content Agent",
    "INFLUENCER": "Influencer Agent",
}


def record_agent_task(workspace_id: int, agent_type: str, status: str, summary: str = None,
                      stage: str = None, target_url: str = None, reset: bool = False):
    """Upsert one agent_tasks row for this workspace+agent. Never raises - dashboard
    tracking must never break a pipeline.

    stage: append this node name to the stages_done trail (for the Running-state progress
    checklist). target_url/reset: only meaningful on the first call of a new run - reset
    clears the previous run's stages_done and stamps a fresh started_at."""
    if not workspace_id:
        return
    try:
        from database import SessionLocal
        import models
        with SessionLocal() as db:
            task = (
                db.query(models.AgentTask)
                .filter(models.AgentTask.workspace_id == workspace_id, models.AgentTask.agent_type == agent_type)
                .first()
            )
            if not task:
                task = models.AgentTask(workspace_id=workspace_id, agent_type=agent_type, logs={})
                db.add(task)
            task.status = status  # RUNNING | COMPLETED | FAILED | CANCELLED
            task.updated_at = datetime.datetime.utcnow()
            logs = dict(task.logs or {})
            if reset:
                logs["stages_done"] = []
                logs["current_stage"] = None
                logs["started_at"] = datetime.datetime.utcnow().isoformat()
            if target_url is not None:
                logs["target_url"] = target_url
            if stage is not None:
                stages_done = list(logs.get("stages_done") or [])
                if stage not in stages_done:
                    stages_done.append(stage)
                logs["stages_done"] = stages_done
                logs["current_stage"] = stage
            if summary is not None:
                logs["summary"] = summary
            logs["last_status"] = status
            logs["updated_at"] = datetime.datetime.utcnow().isoformat()
            task.logs = logs
            db.commit()
    except Exception as e:
        print(f"record_agent_task failed ({agent_type}/{status}): {e}")


def get_agent_task(workspace_id: int, agent_type: str) -> dict | None:
    """Read-only status query for one workspace+agent, for the run-status API."""
    if not workspace_id:
        return None
    try:
        from database import SessionLocal
        import models
        with SessionLocal() as db:
            task = (
                db.query(models.AgentTask)
                .filter(models.AgentTask.workspace_id == workspace_id, models.AgentTask.agent_type == agent_type)
                .first()
            )
            if not task:
                return None
            return {"status": task.status, "logs": task.logs or {}}
    except Exception as e:
        print(f"get_agent_task failed ({agent_type}): {e}")
        return None


# ---------------------------------------------------------------- single-flight registry
# In-memory, process-local map of the live asyncio.Task backing each (workspace, agent_type)
# run. Used to enforce "only one audit running at a time" and to support Cancel. Self-heals
# after a server restart via reconcile_stale_running (a DB row stuck at RUNNING with no
# live task behind it gets marked FAILED instead of blocking forever).
_RUNNING_TASKS: dict = {}


def register_task(workspace_id: int, agent_type: str, task) -> None:
    _RUNNING_TASKS[(workspace_id, agent_type)] = task


def is_running(workspace_id: int, agent_type: str) -> bool:
    task = _RUNNING_TASKS.get((workspace_id, agent_type))
    return bool(task and not task.done())


def cancel_task(workspace_id: int, agent_type: str) -> bool:
    task = _RUNNING_TASKS.get((workspace_id, agent_type))
    if not task or task.done():
        return False
    task.cancel()
    return True


def reconcile_all_stale_running() -> None:
    """Call once at process startup. Every RUNNING row is necessarily stale at this point -
    the in-memory _RUNNING_TASKS registry above is process-local and always empty on a fresh
    boot, so nothing can legitimately still be running. Without this, a workspace whose audit
    was mid-flight when the server last restarted shows "Running..." the instant its page is
    opened - indistinguishable from the pipeline auto-starting - until that workspace's first
    status poll happens to trigger the lazy per-(workspace, agent_type) check in
    reconcile_stale_running() below. Fixing all of them up front closes that window entirely."""
    try:
        from database import SessionLocal
        import models
        with SessionLocal() as db:
            stale = db.query(models.AgentTask).filter(models.AgentTask.status == "RUNNING").all()
            for task in stale:
                task.status = "FAILED"
                task.updated_at = datetime.datetime.utcnow()
                logs = dict(task.logs or {})
                logs["summary"] = "Interrupted (server restarted mid-run)."
                task.logs = logs
            if stale:
                db.commit()
                print(f"[agent_status] Reconciled {len(stale)} stale RUNNING task(s) from a previous server run.")
    except Exception as e:
        print(f"reconcile_all_stale_running failed: {e}")


def reconcile_stale_running(workspace_id: int, agent_type: str) -> None:
    """If the DB says RUNNING but no live in-memory task backs it (e.g. the server
    restarted mid-run), mark it FAILED so it doesn't block new runs forever."""
    info = get_agent_task(workspace_id, agent_type)
    if info and info.get("status") == "RUNNING" and not is_running(workspace_id, agent_type):
        record_agent_task(workspace_id, agent_type, "FAILED", "Interrupted (server restarted mid-run).")
