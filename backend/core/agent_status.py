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
    "SOCIAL": "Social Media Agent",
    "ANALYST": "Analytics Agent",
    "CAMPAIGN": "Campaign Manager Agent",
    "INFLUENCER": "Influencer Agent",
}


def record_agent_task(workspace_id: int, agent_type: str, status: str, summary: str = None):
    """Upsert one agent_tasks row for this workspace+agent. Never raises - dashboard
    tracking must never break a pipeline."""
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
            task.status = status  # RUNNING | COMPLETED | FAILED
            task.updated_at = datetime.datetime.utcnow()
            logs = dict(task.logs or {})
            if summary is not None:
                logs["summary"] = summary
            logs["last_status"] = status
            logs["updated_at"] = datetime.datetime.utcnow().isoformat()
            task.logs = logs
            db.commit()
    except Exception as e:
        print(f"record_agent_task failed ({agent_type}/{status}): {e}")
