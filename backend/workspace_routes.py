from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import database, models, schemas, auth
from core import tenancy
import asyncio
import datetime
import os
from core import meta_ads as meta, google_ads as gads

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])

@router.get("", response_model=List[schemas.WorkspaceResponse])
def get_workspaces(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    workspaces = db.query(models.Workspace).filter(tenancy.visible_workspace(current_user)).all()
    return workspaces

@router.get("/onboarding-state")
def onboarding_state(db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Where this user should land after logging in, decided server-side.

    The client used to answer this itself with "does /api/workspaces return anything" -
    which is not the same question. A workspace row is created before the onboarding crawl
    finishes, and BrandDashboard also creates one lazily, so "has a workspace" was true for
    people who had never completed onboarding and false for people who had. The stored
    is_onboarded flag was written by the crawl and then read by nothing except a badge, so
    a user who finished onboarding could still be sent back through it on the next login.

    Returning both facts from one endpoint also keeps login to a single round trip, which
    is the other half of the complaint: the client previously fetched the workspace list and
    then would have needed a second call for the profile.
    """
    workspaces = (db.query(models.Workspace)
                    .filter(tenancy.visible_workspace(current_user))
                    .order_by(models.Workspace.id.asc()).all())
    if not workspaces:
        return {"has_workspace": False, "is_onboarded": False, "workspace_id": None,
                "next": "onboarding"}

    ws_ids = [w.id for w in workspaces]
    onboarded = (db.query(models.BrandProfile)
                   .filter(models.BrandProfile.workspace_id.in_(ws_ids),
                           models.BrandProfile.is_onboarded.is_(True))
                   .first())
    return {
        "has_workspace": True,
        "is_onboarded": bool(onboarded),
        # The onboarded workspace when there is one, so the dashboard opens on a brand that
        # actually has a kit rather than whichever row happens to sort first.
        "workspace_id": (onboarded.workspace_id if onboarded else workspaces[0].id),
        "next": "dashboard" if onboarded else "onboarding",
    }


@router.get("/discover")
def discover_brands(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    workspaces = db.query(models.Workspace).all()
    return [{"id": w.id, "name": w.name} for w in workspaces]

from pydantic import BaseModel as _OnboardingBase


class OnboardingSetup(_OnboardingBase):
    name: Optional[str] = None
    company_url: Optional[str] = None
    brand_color: Optional[str] = None
    brand_voice: Optional[str] = None


@router.post("/setup")
def setup_workspace(body: OnboardingSetup, db: Session = Depends(database.get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    """Finish onboarding in a single request: find-or-create the workspace, then lock it.

    The wizard used to do this in four awaited calls - list workspaces, create one, list
    again to learn the id, then mark onboarded. Against a remote database each of those is
    a second or more, which was most of the wait between clicking Initialize and seeing the
    dashboard. They are one transaction's worth of work, so they are now one request.

    Idempotent: an account that already has a workspace keeps it and is simply marked
    onboarded, which is what re-running the wizard should do.
    """
    from agents.seo_geo import normalize_target_url

    ws = (db.query(models.Workspace)
            .filter(tenancy.visible_workspace(current_user))
            .order_by(models.Workspace.id.asc()).first())

    created = False
    if not ws:
        name = (body.name or "").strip() or "My Workspace"
        url = normalize_target_url(body.company_url or "") or (body.company_url or None)
        ws = models.Workspace(name=name, company_url=url, brand_color=body.brand_color,
                              brand_voice=body.brand_voice, user_id=current_user.id)
        db.add(ws)
        db.flush()          # assigns ws.id inside this transaction, no extra round trip
        created = True

    bp = (db.query(models.BrandProfile)
            .filter(models.BrandProfile.workspace_id == ws.id).first())
    if not bp:
        bp = models.BrandProfile(workspace_id=ws.id)
        db.add(bp)
    bp.is_onboarded = True
    db.commit()

    return {"status": "success", "workspace_id": ws.id, "is_onboarded": True,
            "created": created, "company_url": ws.company_url}


@router.post("/{workspace_id}/complete-onboarding")
async def complete_onboarding(workspace_id: int,
                              db: Session = Depends(database.get_db),
                              current_user: models.User = Depends(auth.get_current_user)):
    """Mark this workspace's onboarding finished, and enrich it in the background.

    Nothing in the wizard's path ever wrote is_onboarded. The only writer was the crawl in
    onboarding_graph, reached solely through /reindex - and the wizard instead called
    /api/agents/onboard, which runs that pipeline with workspace_id=0, so the flag (and the
    whole brand profile) was written against a workspace that does not exist. The real
    workspace stayed is_onboarded=False forever, and because login correctly routes on that
    flag, every single login sent the user back through the wizard.

    Completing the wizard is what "onboarded" means to the user, so the flag is committed
    here and now. The crawl still runs, but only to enrich the profile: it is queued as a
    background task against the REAL workspace id, and if it fails the user stays onboarded
    rather than being trapped in the wizard by a scrape they cannot influence.
    """
    ws = _require_workspace(workspace_id, db, current_user)

    bp = (db.query(models.BrandProfile)
            .filter(models.BrandProfile.workspace_id == workspace_id).first())
    if not bp:
        bp = models.BrandProfile(workspace_id=workspace_id)
        db.add(bp)
    bp.is_onboarded = True
    db.commit()

    # Deliberately does NOT start the crawl. Two earlier attempts both put it in front of
    # the user: BackgroundTasks runs before the request coroutine finishes (~13s), and
    # asyncio.create_task still stalled the response (~4s) because the pipeline blocks the
    # loop as soon as it starts. Enrichment is a separate concern from "this user is
    # onboarded", so the client fires the existing /reindex route for it and does not wait.
    # That keeps this endpoint what it should be: one indexed write.
    return {"status": "success", "workspace_id": workspace_id, "is_onboarded": True,
            "company_url": ws.company_url}


@router.post("", response_model=schemas.WorkspaceResponse)
def create_workspace(ws: schemas.WorkspaceCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    from agents.seo_geo import normalize_target_url
    new_ws = models.Workspace(
        name=ws.name,
        # Normalized on the way in so a stray space typed at onboarding never reaches
        # the crawler later as "https:// example.com" (HTTP 400).
        company_url=normalize_target_url(ws.company_url) or ws.company_url,
        brand_logo=ws.brand_logo,
        brand_color=ws.brand_color,
        brand_voice=ws.brand_voice,
        user_id=current_user.id
    )
    db.add(new_ws)
    db.commit()
    db.refresh(new_ws)
    return new_ws

from pydantic import BaseModel as _WorkspaceBase


class WorkspaceUpdate(_WorkspaceBase):
    name: Optional[str] = None
    company_url: Optional[str] = None
    brand_logo: Optional[str] = None
    brand_color: Optional[str] = None
    brand_voice: Optional[str] = None


@router.patch("/{workspace_id}", response_model=schemas.WorkspaceResponse)
def update_workspace(workspace_id: int, body: WorkspaceUpdate,
                     db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Edit a workspace's brand settings.

    There was no update route at all, so the Settings screen's "Save Settings" button had
    nothing to call - it showed "Settings saved successfully!" and the edits were lost on
    the next reload.
    """
    ws = _require_workspace(workspace_id, db, current_user)

    data = body.model_dump(exclude_unset=True)
    if "name" in data:
        name = (data["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="A workspace needs a name.")
        data["name"] = name
    if data.get("company_url"):
        # Same normalisation as create, so a pasted URL with a stray space does not reach
        # the crawler as an invalid address later.
        from agents.seo_geo import normalize_target_url
        data["company_url"] = normalize_target_url(data["company_url"]) or data["company_url"]

    for k, v in data.items():
        setattr(ws, k, v)
    db.commit()
    db.refresh(ws)
    return ws


class BrandProfileUpdate(_WorkspaceBase):
    brand_guidelines_summary: Optional[str] = None
    target_audience: Optional[str] = None
    color_palette: Optional[List[str]] = None
    # Editable for the same reason the palette is: the crawl's read of a site's CSS
    # variables is a starting point, and a designer correcting a role or dropping a
    # mis-detected logo must not be forced to re-run onboarding to do it.
    color_tokens: Optional[List[dict]] = None
    logos: Optional[List[dict]] = None
    typography: Optional[dict] = None
    guidelines: Optional[dict] = None


def _brand_profile_json(ws, bp) -> dict:
    """Merges the workspace's own brand fields with the scraped profile. The Knowledge Vault
    needs both: name/url/voice/colour live on the workspace, while the summary, audience,
    palette and typography come from onboarding's crawl."""
    return {
        "name": ws.name,
        "url": ws.company_url,
        "brand_voice": ws.brand_voice,
        "brand_color": ws.brand_color,
        "brand_guidelines_summary": (bp.brand_guidelines_summary if bp else None),
        "target_audience": (bp.target_audience if bp else None),
        "color_palette": (bp.color_palette if bp else None) or [],
        # The same colours with the name and role the site's own CSS variables gave them,
        # plus the logo files found in its markup. Both are empty for workspaces onboarded
        # before extraction existed, and the vault falls back accordingly.
        "color_tokens": (bp.color_tokens if bp else None) or [],
        "logos": (bp.logos if bp else None) or [],
        "typography": (bp.typography if bp else None) or {},
        "guidelines": (bp.guidelines if bp else None) or {},
        "is_onboarded": bool(bp.is_onboarded) if bp else False,
    }


@router.delete("/{workspace_id}")
def delete_workspace(workspace_id: int, db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Delete a workspace and everything scoped to it.

    Same schema-driven sweep as delete-account: the child tables pointing at workspaces.id
    are found from the mapper registry rather than a hand-written list, so a table added
    later does not quietly break this with a foreign-key error.
    """
    _require_workspace(workspace_id, db, current_user)

    # Refuse to remove the last one: the whole dashboard is keyed on having a workspace,
    # and an account with none lands on a permanently empty screen.
    remaining = (db.query(models.Workspace)
                   .filter(tenancy.visible_workspace(current_user)).count())
    if remaining <= 1:
        raise HTTPException(status_code=400,
                            detail="This is your only workspace, so it cannot be deleted.")

    for model in [m.class_ for m in models.Base.registry.mappers]:
        col = getattr(model, "workspace_id", None)
        if col is not None and model is not models.Workspace:
            db.query(model).filter(col == workspace_id).delete(synchronize_session=False)

    db.query(models.Workspace).filter(models.Workspace.id == workspace_id)      .delete(synchronize_session=False)
    db.commit()
    return {"status": "deleted"}


@router.get("/{workspace_id}/brand-profile")
def get_brand_profile(workspace_id: int, db: Session = Depends(database.get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    """What onboarding actually learned about this brand.

    brand_profiles has been written by the onboarding crawl and read by the agents since the
    start, but nothing ever exposed it over HTTP - which is why the Brand Knowledge vault
    showed five paragraphs about a fictional power-bank company instead.
    """
    ws = _require_workspace(workspace_id, db, current_user)
    bp = (db.query(models.BrandProfile)
            .filter(models.BrandProfile.workspace_id == workspace_id).first())
    return _brand_profile_json(ws, bp)


@router.patch("/{workspace_id}/brand-profile")
def update_brand_profile(workspace_id: int, body: BrandProfileUpdate,
                         db: Session = Depends(database.get_db),
                         current_user: models.User = Depends(auth.get_current_user)):
    """Edit what the agents are told about this brand. The crawl's guess is a starting point,
    not the final word, so this is editable rather than read-only."""
    ws = _require_workspace(workspace_id, db, current_user)
    bp = (db.query(models.BrandProfile)
            .filter(models.BrandProfile.workspace_id == workspace_id).first())
    if not bp:
        bp = models.BrandProfile(workspace_id=workspace_id)
        db.add(bp)

    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(bp, k, v)
    db.commit()
    db.refresh(bp)
    return _brand_profile_json(ws, bp)


@router.post("/{workspace_id}/reindex")
def reindex_workspace(workspace_id: int, req: schemas.ReindexRequest, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    
    # Update initial values immediately
    from agents.seo_geo import normalize_target_url
    clean_url = normalize_target_url(req.url) or req.url
    ws.company_url = clean_url
    ws.brand_voice = req.tone
    db.commit()

    # Fire off the onboarding background task to actually scrape and update the knowledge base
    from agents.creative_nodes.onboarding_graph import run_onboarding_pipeline
    background_tasks.add_task(run_onboarding_pipeline, workspace_id, clean_url)
    
    return {"status": "success", "message": "Knowledge Graph re-indexing started."}


# Friendly names for the point `type` payload written into the vector store.
_KB_TYPE_LABELS = {
    "onboarding_scrape": "Brand & onboarding context",
    "seo": "SEO audit context",
    "geo": "GEO audit context",
    "campaign": "Campaign context",
    "content": "Generated content",
}


@router.get("/{workspace_id}/knowledge/stats")
def knowledge_stats(workspace_id: int, db: Session = Depends(database.get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    """Real vector-store stats for this workspace's knowledge base — actual point counts
    from Qdrant, grouped by source type. Fails open (available=False) if Qdrant or the
    collection isn't reachable, so the dashboard never crashes."""
    _require_workspace(workspace_id, db, current_user)

    from core.embeddings import COLLECTION_NAME, EMBEDDING_MODEL_NAME, EMBEDDING_DIM
    base = {
        "available": False,
        "collection": COLLECTION_NAME,
        "embedding_model": EMBEDDING_MODEL_NAME,
        "dimensions": EMBEDDING_DIM,
        "total_vectors": 0,
        "stores": [],
    }
    try:
        from database import qdrant_client
        from qdrant_client.models import Filter, FieldCondition, MatchValue

        # Collection may not exist yet (no one has indexed anything).
        names = {c.name for c in qdrant_client.get_collections().collections}
        if COLLECTION_NAME not in names:
            base["available"] = True
            return base

        ws_filter = Filter(must=[FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id))])
        total = qdrant_client.count(collection_name=COLLECTION_NAME, count_filter=ws_filter, exact=True).count

        # Tally points by their `type` payload, and collect each page's source URL
        # (scroll payload only — no vectors pulled).
        by_type: dict[str, int] = {}
        srcs_by_type: dict[str, list] = {}
        next_page = None
        for _ in range(50):  # safety cap: up to 50 * 256 points
            points, next_page = qdrant_client.scroll(
                collection_name=COLLECTION_NAME, scroll_filter=ws_filter,
                with_payload=["type", "source_url"], with_vectors=False, limit=256, offset=next_page,
            )
            for p in points:
                pl = p.payload or {}
                t = pl.get("type") or "other"
                by_type[t] = by_type.get(t, 0) + 1
                su = pl.get("source_url")
                if su:
                    lst = srcs_by_type.setdefault(t, [])
                    if su not in lst:
                        lst.append(su)
            if not next_page:
                break

        stores = [
            {"type": t, "name": _KB_TYPE_LABELS.get(t, t.replace("_", " ").title()),
             "vectors": n, "sources": srcs_by_type.get(t, [])[:25]}
            for t, n in sorted(by_type.items(), key=lambda kv: -kv[1])
        ]
        base.update({"available": True, "total_vectors": total, "stores": stores})
        return base
    except Exception as e:
        print(f"knowledge_stats: Qdrant unavailable for ws {workspace_id}: {e}")
        return base


def _require_workspace(workspace_id: int, db: Session, current_user: models.User):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


def _looks_like_real_topic(topic: str) -> bool:
    """Reject obvious junk (random key-mashing like 'fgg', 'asdfgh') before spending an
    LLM call. Not a spell-checker — just enough to catch nonsense."""
    import re as _re
    t = (topic or "").strip()
    if len(t) < 4:
        return False
    words = _re.findall(r"[A-Za-z][A-Za-z'-]*", t)
    if not words:
        return False
    # At least one word must look word-like: >=3 letters AND contain a vowel.
    return any(len(w) >= 3 and _re.search(r"[aeiou]", w.lower()) for w in words)


@router.post("/{workspace_id}/content/generate")
async def generate_content(workspace_id: int, req: schemas.ContentGenerateRequest, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Kick off content generation. Produces a ContentDraft (pending_review) grounded in the brand KB."""
    _require_workspace(workspace_id, db, current_user)
    if not _looks_like_real_topic(req.topic):
        raise HTTPException(status_code=422, detail="Please enter a real topic or keyword (a few words describing what to write about).")
    from agents.content_studio import run_content_generation
    background_tasks.add_task(run_content_generation, workspace_id, req.topic, req.content_type or "blog")
    return {"status": "success", "message": "Content generation started. It will appear in the review queue when ready."}


@router.get("/{workspace_id}/content")
def list_content(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """List content drafts for the human-review queue."""
    _require_workspace(workspace_id, db, current_user)
    drafts = db.query(models.ContentDraft).filter(models.ContentDraft.workspace_id == workspace_id).order_by(models.ContentDraft.id.desc()).all()
    return {"drafts": [
        {"id": d.id, "title": d.title, "body": d.body, "content_type": d.content_type,
         "target_keyword": d.target_keyword, "status": d.status,
         "created_at": d.created_at.isoformat() if d.created_at else None}
        for d in drafts
    ]}


@router.post("/{workspace_id}/content/{draft_id}/review")
def review_content(workspace_id: int, draft_id: int, req: schemas.ContentReviewRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Human review action: approve, reject, or publish a content draft."""
    _require_workspace(workspace_id, db, current_user)
    draft = db.query(models.ContentDraft).filter(models.ContentDraft.id == draft_id, models.ContentDraft.workspace_id == workspace_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    action = (req.action or "").lower()
    mapping = {"approve": "approved", "reject": "rejected", "publish": "published"}
    if action not in mapping:
        raise HTTPException(status_code=400, detail="action must be approve, reject or publish")
    draft.status = mapping[action]
    db.commit()
    return {"status": "success", "draft_id": draft_id, "new_status": draft.status}


@router.post("/{workspace_id}/content/{draft_id}/edit")
def edit_content(workspace_id: int, draft_id: int, req: schemas.ContentEditRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Let the human edit a draft's title/body (and reset it to pending_review so the
    edited version is re-approved before it can be sent to a site)."""
    _require_workspace(workspace_id, db, current_user)
    draft = db.query(models.ContentDraft).filter(models.ContentDraft.id == draft_id, models.ContentDraft.workspace_id == workspace_id).first()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    if req.title is not None and req.title.strip():
        draft.title = req.title.strip()
    if req.body is not None:
        draft.body = req.body
    # An edited draft goes back to pending so the new version is reviewed, not the old one.
    draft.status = "pending_review"
    db.commit()
    return {"status": "success", "draft_id": draft_id, "new_status": draft.status}


@router.get("/{workspace_id}/agents")
def list_agent_tasks(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Real agent activity for this workspace, from the agent_tasks table (populated by
    pipelines as they run). Powers the dashboard's 'AI Agents' panel with live data."""
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")

    from core.agent_status import AGENT_LABELS
    tasks = db.query(models.AgentTask).filter(models.AgentTask.workspace_id == workspace_id).all()
    by_type = {t.agent_type: t for t in tasks}

    agents = []
    for agent_type, label in AGENT_LABELS.items():
        t = by_type.get(agent_type)
        if t:
            logs = t.logs or {}
            agents.append({
                "type": agent_type,
                "name": label,
                "status": t.status,                       # RUNNING | COMPLETED | FAILED
                "summary": logs.get("summary", ""),
                "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            })
        else:
            # Agent that has never run yet in this workspace.
            agents.append({"type": agent_type, "name": label, "status": "IDLE", "summary": "", "updated_at": None})
    return {"agents": agents}


@router.get("/{workspace_id}/recent-actions")
def recent_actions(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Recent REAL outputs the agents produced (generated ads, SEO audits, social posts,
    campaigns) - replaces the dashboard's hardcoded 'Recent AI Actions' list."""
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")

    actions = []
    # Generated ad creatives (no created_at column, so id is the recency proxy)
    for a in db.query(models.AdAsset).filter(models.AdAsset.workspace_id == workspace_id).order_by(models.AdAsset.id.desc()).limit(5).all():
        actions.append({"sort": a.id, "type": "creative", "title": "Generated Ad Creative", "detail": (a.headline or "")[:90]})
    # SEO audits (has created_at)
    for s in db.query(models.SEOAudit).filter(models.SEOAudit.workspace_id == workspace_id).order_by(models.SEOAudit.created_at.desc()).limit(3).all():
        actions.append({"sort": int(s.created_at.timestamp()) if s.created_at else s.id, "type": "seo", "title": f"SEO Audit (score {s.score})", "detail": (s.recommendation or "")[:90]})
    # Social posts
    for p in db.query(models.SocialPost).filter(models.SocialPost.workspace_id == workspace_id).order_by(models.SocialPost.id.desc()).limit(3).all():
        actions.append({"sort": p.id, "type": "social", "title": f"{p.platform} Post Drafted", "detail": (p.caption or "")[:90]})
    # Campaigns
    for c in db.query(models.Campaign).filter(models.Campaign.workspace_id == workspace_id).order_by(models.Campaign.id.desc()).limit(3).all():
        actions.append({"sort": c.id, "type": "campaign", "title": f"Campaign ({c.platform})", "detail": f"Status: {c.status}"})
    # Content drafts
    for d in db.query(models.ContentDraft).filter(models.ContentDraft.workspace_id == workspace_id).order_by(models.ContentDraft.id.desc()).limit(3).all():
        actions.append({"sort": int(d.created_at.timestamp()) if d.created_at else d.id, "type": "content", "title": f"Content: {d.title[:50]}", "detail": f"{d.content_type} - {d.status}"})

    actions.sort(key=lambda x: x["sort"], reverse=True)
    return {"actions": [{k: v for k, v in a.items() if k != "sort"} for a in actions[:8]]}


@router.get("/{workspace_id}/dashboard/metrics")
def get_dashboard_metrics(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
        
    # Calculate real data from db
    from sqlalchemy.sql import func
    
    # Ad Spend & ROAS
    campaigns = db.query(models.Campaign).filter(models.Campaign.workspace_id == workspace_id).all()
    total_spend = sum(c.budget for c in campaigns if c.status != 'DRAFT')
    avg_roas = sum(c.roas for c in campaigns if c.status != 'DRAFT') / (len([c for c in campaigns if c.status != 'DRAFT']) or 1)
    
    # SEO/GEO Score
    audits = db.query(models.SEOAudit).filter(models.SEOAudit.workspace_id == workspace_id).order_by(models.SEOAudit.created_at.desc()).all()
    seo_score = audits[0].score if audits else 0
    geo_visibility = seo_score * 0.9 if seo_score else 0 # Mock calculation for GEO based on SEO

    # Active Agents
    agents = db.query(models.AgentTask).filter(models.AgentTask.workspace_id == workspace_id, models.AgentTask.status == "RUNNING").count()

    return {
        "recent_quarter_spend": total_spend,
        "roas": round(avg_roas, 2),
        "seo_score": seo_score,
        "geo_visibility_score": round(geo_visibility, 1),
        "active_ai_agents": agents,
    }

# The /dashboard/organic and /dashboard/paid endpoints were removed here. Both returned a
# hardcoded dictionary - 15,400 organic sessions, 88 GEO visibility, $4,500 ad spend, 3.4
# ROAS - and then passed those invented figures to an LLM for a "recommendation", so the
# advice was reasoning about numbers no one had measured. Nothing in the app called either
# one. Real equivalents already exist: /dashboard/metrics reads campaigns and audits from
# the database, and the GA4 and Search Console panels read the connected accounts.

# Campaigns
@router.get("/{workspace_id}/campaigns", response_model=List[schemas.CampaignResponse])
def get_campaigns(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    campaigns = db.query(models.Campaign).filter(models.Campaign.workspace_id == workspace_id).all()
    return campaigns

def _get_campaign_or_404(workspace_id: int, campaign_id: int, db: Session) -> "models.Campaign":
    camp = db.query(models.Campaign).filter(
        models.Campaign.id == campaign_id, models.Campaign.workspace_id == workspace_id
    ).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return camp


@router.get("/{workspace_id}/campaigns/{campaign_id}", response_model=schemas.CampaignResponse)
def get_campaign(workspace_id: int, campaign_id: int, db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    """One campaign including its full generated strategy (in `metrics`)."""
    _require_workspace(workspace_id, db, current_user)
    return _get_campaign_or_404(workspace_id, campaign_id, db)


@router.post("/{workspace_id}/campaigns/{campaign_id}/approve")
def approve_campaign(workspace_id: int, campaign_id: int, db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Human approves the AI strategy. From here the approved strategy is the single source of
    truth — creatives and ad setup stay locked until this happens."""
    _require_workspace(workspace_id, db, current_user)
    camp = _get_campaign_or_404(workspace_id, campaign_id, db)
    import datetime as _dt
    camp.status = "APPROVED"
    m = dict(camp.metrics or {})
    m["status"] = "approved"
    m["approved_at"] = _dt.datetime.utcnow().isoformat()
    if not camp.version_group:
        camp.version_group = f"vg-{workspace_id}-{camp.id}"
    m = _append_activity(m, "Strategy approved")
    camp.metrics = m
    db.commit()
    return {"status": "success", "campaign_id": camp.id, "new_status": camp.status,
            "message": "Strategy approved — it is now the source of truth for creatives and ad setup."}


@router.post("/{workspace_id}/campaigns/{campaign_id}/ad-setup")
def campaign_ad_setup(workspace_id: int, campaign_id: int, req: schemas.AdSetupRequest,
                      db: Session = Depends(database.get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    """Connect / launch a platform for this campaign. Real Meta + Google API keys are not wired
    yet, so this records a clearly-flagged MOCK setup — enough to exercise the whole flow."""
    _require_workspace(workspace_id, db, current_user)
    camp = _get_campaign_or_404(workspace_id, campaign_id, db)

    # The rule: nothing downstream may populate until the strategy is approved.
    if (camp.status or "").upper() != "APPROVED":
        raise HTTPException(status_code=409, detail="Approve the strategy first — ad setup is locked until then.")

    platform = (req.platform or "").lower()
    if platform not in ("meta", "google"):
        raise HTTPException(status_code=400, detail="platform must be 'meta' or 'google'")
    action = (req.action or "").lower()

    import datetime as _dt
    m = dict(camp.metrics or {})
    key = f"{platform}_setup"
    setup = dict(m.get(key) or {})

    if action == "connect":
        setup.update({"connected": True, "mock": True,
                      "account": f"Mock {platform.title()} Ad Account",
                      "connected_at": _dt.datetime.utcnow().isoformat()})
    elif action == "disconnect":
        setup.update({"connected": False, "launched": False})
    elif action == "launch":
        if not setup.get("connected"):
            raise HTTPException(status_code=409, detail=f"Connect {platform.title()} first.")
        setup.update({"launched": True, "mock": True,
                      "launched_at": _dt.datetime.utcnow().isoformat()})
    else:
        raise HTTPException(status_code=400, detail="action must be 'connect', 'disconnect' or 'launch'")

    m[key] = setup
    camp.metrics = m
    db.commit()
    return {"status": "success", "platform": platform, "action": action, "mock": True, "setup": setup}


async def _launch_meta_ad(camp, spec: dict, conn, req, db: Session, workspace_id: int) -> dict:
    """Build a complete, PAUSED Meta ad (campaign + ad set + creative + ad) on
    Facebook and Instagram from the campaign's approved strategy.

    Creating only a campaign — which is what this used to do — produces a shell
    with nothing inside it, so it can never deliver even once activated. The
    creative comes from the publish request when the user picked one in the UI,
    otherwise from the strategy the agent generated.
    """
    meta_spec = (spec.get("meta") or {}) if isinstance(spec.get("meta"), dict) else {}

    image_url = (req.image_url if req else None) or spec.get("image_url")
    headline = (req.headline if req else None) or meta_spec.get("headline") or camp.name
    primary_text = (req.primary_text if req else None) or meta_spec.get("primary_text") or ""
    cta = (req.cta if req else None) or meta_spec.get("cta") or "LEARN_MORE"

    # Destination: explicit → the connection's default → the workspace's site.
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    link_url = ((req.link_url if req else None)
                or conn.default_link_url
                or (ws.company_url if ws else None))
    if not link_url:
        raise RuntimeError(
            "No destination URL. Set one on the Meta connection or add your website "
            "to the workspace — an ad with nowhere to click cannot be created."
        )

    if not conn.page_id:
        raise RuntimeError(
            "No Facebook Page selected. Pick the Page to publish as in the Meta "
            "setup step — Meta cannot create an ad without one."
        )

    # Meta's CTA enum is upper snake case; the strategy may phrase it as "Learn more".
    cta_enum = str(cta).strip().upper().replace(" ", "_").replace("-", "_")

    return await meta.launch(
        conn,
        name=camp.name or "Raftra Campaign",
        objective=camp.objective or "traffic",
        page_id=conn.page_id,
        headline=headline,
        primary_text=primary_text,
        link_url=link_url,
        cta=cta_enum,
        image_url=image_url,
        daily_budget_major=camp.daily_budget or camp.budget or 200.0,
        country=(req.country if req and req.country else None) or "IN",
        platforms=(req.meta_placements if req and req.meta_placements else ["facebook", "instagram"]),
    )


def _resolve_google_payload(camp, spec: dict, db: Session, workspace_id: int) -> dict:
    """Collapse the approved strategy into the exact fields a Google Search campaign needs.

    Precedence is always: the Step 5 platform review (`google_review`, what the user edited) →
    the strategy's own `google` block → the flat back-compat keys the older setup screens
    wrote. An edited headline must beat the AI's original, so the review always wins.
    """
    review = spec.get("google_review") if isinstance(spec.get("google_review"), dict) else {}
    g = spec.get("google") if isinstance(spec.get("google"), dict) else {}

    def first_list(*candidates):
        for c in candidates:
            if isinstance(c, (list, tuple)) and len(c):
                return list(c)
        return []

    def first_text(*candidates):
        for c in candidates:
            if isinstance(c, str) and c.strip():
                return c.strip()
        return ""

    # Google needs a DAILY budget, but the strategy allocates a total across the run. An
    # explicit daily figure wins; otherwise divide the Google share by the campaign duration.
    days = spec.get("duration_days") or 15
    try:
        days = max(1, int(days))
    except (TypeError, ValueError):
        days = 15
    google_share = ((spec.get("budget_split") or {}).get("google") or {}).get("amount")
    daily_budget = None
    for candidate, is_total in ((review.get("daily_budget"), False), (review.get("budget"), True),
                                (google_share, True), (camp.daily_budget, False)):
        try:
            value = float(candidate)
        except (TypeError, ValueError):
            continue
        if value > 0:
            daily_budget = value / days if is_total else value
            break
    if not daily_budget:
        daily_budget = 200.0

    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    final_url = first_text(review.get("landing_page"), review.get("tracking_url"),
                           spec.get("landing_page"), ws.company_url if ws else "")

    sitelinks, callouts, ext_warnings = gads.parse_extensions(
        first_list(review.get("extensions"), g.get("extensions")))

    return {
        "name": first_text(review.get("campaign_name"), camp.name) or "Raftra Campaign",
        "objective": camp.objective or "",
        "headlines": first_list(review.get("headlines"), g.get("headlines"), spec.get("google_headlines")),
        "descriptions": first_list(review.get("descriptions"), g.get("descriptions"),
                                   spec.get("google_descriptions")),
        "keywords": first_list(review.get("keywords"), g.get("keywords"), spec.get("top_keywords")),
        "final_url": final_url,
        "sitelinks": sitelinks,
        "callouts": callouts,
        "daily_budget_major": round(daily_budget, 2),
        "geo_locations": (spec.get("geo_targeting") or {}).get("locations") or [],
        "duration_days": days,
        "campaign_type": first_text(review.get("campaign_type"), spec.get("google_campaign_type")) or "Search",
        "_extension_warnings": ext_warnings,
    }


async def _launch_google_ad(camp, spec: dict, conn, db: Session, workspace_id: int) -> dict:
    """Build a complete, PAUSED Google Search campaign from the approved strategy.

    Creating only a campaign + budget — which is what this used to do — produces a shell with
    no ad group, keywords or ad inside it, so it can never deliver even once activated.
    """
    payload = _resolve_google_payload(camp, spec, db, workspace_id)
    extension_warnings = payload.pop("_extension_warnings", [])
    result = await gads.launch(conn, **payload)
    if extension_warnings:
        result["warnings"] = extension_warnings + list(result.get("warnings") or [])
    return result


@router.post("/{workspace_id}/campaigns/{campaign_id}/publish")
async def publish_campaign(workspace_id: int, campaign_id: int,
                     req: Optional[schemas.PublishCampaignRequest] = None,
                     db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Final publish to the chosen platforms. Uses the real Meta/Google Ads connection already
    linked to this workspace when one exists (real ad account selected); otherwise falls back to
    a simulated (DEMO) publish for that platform, and the response says so explicitly."""
    _require_workspace(workspace_id, db, current_user)
    camp = _get_campaign_or_404(workspace_id, campaign_id, db)
    # PUBLISHED covers a real publish, PUBLISHED_DEMO a simulated one — both may be
    # re-published (e.g. adding Google after Meta already went out), so accept either.
    if (camp.status or "").upper() not in ("APPROVED", "PUBLISHED", "PUBLISHED_DEMO"):
        raise HTTPException(status_code=409, detail="Approve the strategy before publishing.")

    wanted = [p.lower() for p in ((req.platforms if req and req.platforms else None) or ["meta", "google"])]
    bad = [p for p in wanted if p not in ("meta", "google")]
    if bad:
        raise HTTPException(status_code=400, detail=f"Unknown platform(s): {', '.join(bad)}")

    m = dict(camp.metrics or {})
    missing = [p for p in wanted if not (m.get(f"{p}_setup") or {}).get("launched")]
    if missing:
        raise HTTPException(status_code=409,
                            detail=f"Complete the {', '.join(p.title() for p in missing)} setup before publishing.")

    import datetime as _dt, random as _rand
    ids = dict(m.get("campaign_ids") or {})
    modes = dict(m.get("published_modes") or {})
    urls = dict(m.get("campaign_urls") or {})
    meta_error = None      # why a connected Meta account still fell back to demo
    google_error = None    # why a connected Google account did not publish at all
    google_warnings = []

    meta_conn = db.query(models.MetaAdsConnection).filter(models.MetaAdsConnection.workspace_id == workspace_id).first()
    gads_conn = db.query(models.GoogleAdsConnection).filter(models.GoogleAdsConnection.workspace_id == workspace_id).first()

    for p in wanted:
        # Already published on a previous call — keep the existing id/mode rather than creating
        # a duplicate. A Google campaign that only ever went out in DEMO mode is the one
        # exception: it may be re-published for real once the account is connected.
        if p in ids and not (p == "google" and modes.get(p) == "demo"):
            continue
        if p == "meta" and meta_conn and meta_conn.access_token and meta_conn.ad_account_id:
            try:
                result = await _launch_meta_ad(camp, m, meta_conn, req, db, workspace_id)
                ids[p] = result["campaign_id"]
                urls[p] = result.get("url")
                modes[p] = "real"
                m = _append_activity(
                    m, f"Meta ad live on {', '.join(result.get('placements') or ['facebook'])} "
                       f"(ad {result.get('ad_id')}, PAUSED)")
                if result.get("warning"):
                    m = _append_activity(m, result["warning"])
                m.setdefault("meta_objects", {})[str(result["campaign_id"])] = {
                    k: result.get(k) for k in ("adset_id", "creative_id", "ad_id", "placements")
                }
                continue
            except Exception as e:
                # A CONNECTED account that fails must NOT be demoted to a mock id. Reporting
                # MOCK-META-... as success is how a broken publish went unnoticed: the API
                # said status=success while nothing existed in Ads Manager. Leave Meta
                # unpublished and let the caller surface the real reason — same contract
                # the Google branch below already follows.
                meta_error = getattr(e, "detail", None) or str(e)
                m = _append_activity(m, f"Meta publish failed: {meta_error}")
                continue
        elif p == "google" and gads_conn and gads_conn.refresh_token and gads_conn.customer_id:
            try:
                result = await _launch_google_ad(camp, m, gads_conn, db, workspace_id)
                ids[p] = result["campaign_id"]
                urls[p] = result.get("url")
                modes[p] = "real"
                google_warnings = list(result.get("warnings") or [])
                m = _append_activity(
                    m, f"Google Search campaign live (campaign {result['campaign_id']}, "
                       f"ad group {result.get('ad_group_id')}, ad {result.get('ad_id')}, "
                       f"{len(result.get('keywords') or [])} keywords, PAUSED)")
                for w in google_warnings:
                    m = _append_activity(m, f"Google: {w}")
                m.setdefault("google_objects", {})[str(result["campaign_id"])] = {
                    k: result.get(k) for k in (
                        "customer_id", "campaign_name", "campaign_status", "campaign_budget_id",
                        "ad_group_id", "ad_id", "keywords", "assets", "final_url", "daily_budget",
                        "headlines", "descriptions", "geo_target_constants", "warnings")
                }
                continue
            except gads.GoogleAdsValidationError as e:
                google_error = ("Google Ads rejected the approved content before anything was "
                                "created: " + " ".join(e.problems))
            except Exception as e:
                google_error = getattr(e, "message", None) or str(e)
            # A connected account that fails is NOT quietly demoted to demo — reporting a
            # mock id as a publish is how a broken launch goes unnoticed for weeks. Leave
            # Google unpublished and let the caller surface the reason.
            m = _append_activity(m, f"Google Ads publish failed: {google_error}")
            continue
        # No real connection for this platform — mock external campaign id (DEMO mode).
        ids[p] = (f"MOCK-META-{_rand.randint(10**11, 10**12 - 1)}" if p == "meta"
                  else f"MOCK-GADS-{_rand.randint(100, 999)}-{_rand.randint(1000, 9999)}-{_rand.randint(1000, 9999)}")
        modes[p] = "demo"

    # Only platforms that actually produced a campaign count as published. A connected Google
    # account that errored is deliberately absent here, so a campaign is never recorded as
    # published to a platform it never reached.
    succeeded = [p for p in wanted if p in ids]
    published = list(dict.fromkeys((m.get("published_platforms") or []) + succeeded))

    if not succeeded:
        # Nothing went out. Leave the campaign editable (status untouched, so the 7-step flow
        # stays where it was) but persist the activity trail explaining why.
        camp.metrics = m
        db.commit()
        raise HTTPException(status_code=502,
                            detail=(meta_error or google_error
                                    or "Publish failed — nothing was created."))

    if not camp.version_group:
        camp.version_group = f"vg-{workspace_id}-{camp.id}"
    if any(modes.get(p) == "real" for p in succeeded) and camp.meta_campaign_id is None and modes.get("meta") == "real":
        camp.meta_campaign_id = ids.get("meta")
    overall_mode = "real" if all(modes.get(p) == "real" for p in succeeded) else ("mixed" if any(modes.get(p) == "real" for p in succeeded) else "demo")
    # A genuinely real publish must not be labelled DEMO. This was hardcoded to
    # PUBLISHED_DEMO, so a live Meta campaign still rendered as "Published (demo) — nothing
    # was sent to a real ad account", contradicting the REAL pill beside it. Assigned after
    # overall_mode exists; "mixed" stays DEMO because one platform did not go out for real.
    camp.status = "PUBLISHED" if overall_mode == "real" else "PUBLISHED_DEMO"
    m["published_at"] = _dt.datetime.utcnow().isoformat()
    m["published_mode"] = overall_mode
    m["published_modes"] = modes
    m["published_platforms"] = published
    m["campaign_ids"] = ids
    m["campaign_urls"] = urls
    label = ", ".join(f"{p.title()} ({modes.get(p)})" for p in succeeded)
    m = _append_activity(m, f"Published to {label}")
    camp.metrics = m
    db.commit()
    real_names = [p.title() for p in succeeded if modes.get(p) == "real"]
    demo_names = [p.title() for p in succeeded if modes.get(p) == "demo"]
    parts = []
    if real_names:
        placements = (m.get("meta_objects", {}).get(str(ids.get("meta")), {}) or {}).get("placements")
        where = f" on {' + '.join(p.title() for p in placements)}" if placements else ""
        parts.append(f"Created a real PAUSED ad on {' & '.join(real_names)}{where} — activate it there to start spending.")
    if demo_names:
        parts.append(f"Published to {' & '.join(demo_names)} in DEMO mode — connect that ad account to publish for real.")
    if meta_error:
        # Meta is now absent from `succeeded` when it fails, so this states plainly that
        # nothing was created rather than implying a partial result.
        parts.append(f"Meta was connected but the publish failed, so nothing was created "
                     f"there: {meta_error}")
    if google_error:
        parts.append(f"Google Ads was connected but the publish failed, so nothing was created "
                     f"there: {google_error}")
    if google_warnings:
        parts.append(" ".join(google_warnings))
    return {"status": "success", "campaign_id": camp.id, "mode": overall_mode, "new_status": camp.status,
            "version": camp.version, "platforms": wanted, "published_platforms": published,
            "campaign_ids": ids, "campaign_urls": urls, "published_modes": modes,
            "meta_objects": m.get("meta_objects", {}), "meta_error": meta_error,
            "google_objects": m.get("google_objects", {}), "google_error": google_error,
            "google_warnings": google_warnings,
            "message": " ".join(parts)}


# ─────────────────────────────────────────── campaign helpers + persisted endpoints
def _append_activity(m: dict, label: str, keep: int = 40) -> dict:
    import datetime as _dt
    log = list(m.get("activity") or [])
    log.insert(0, {"label": label, "at": _dt.datetime.utcnow().isoformat()})
    m["activity"] = log[:keep]
    return m


def _is_published(camp) -> bool:
    # Matches PUBLISHED (at least one real platform) and PUBLISHED_DEMO (simulated).
    # Comparing only to the demo value would leave a real publish editable, letting a
    # live campaign's strategy be changed after it shipped.
    return (camp.status or "").upper().startswith("PUBLISHED")


@router.post("/{workspace_id}/campaigns/{campaign_id}/platforms")
def campaign_platforms(workspace_id: int, campaign_id: int, body: schemas.PlatformsBody,
                       db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """Save which platforms this campaign targets (Meta / Google / both)."""
    _require_workspace(workspace_id, db, current_user)
    camp = _get_campaign_or_404(workspace_id, campaign_id, db)
    if (camp.status or "").upper() not in ("APPROVED",):
        raise HTTPException(status_code=409, detail="Approve the strategy first.")
    m = dict(camp.metrics or {})
    m["platforms"] = {"meta": bool(body.meta), "google": bool(body.google)}
    camp.metrics = m
    db.commit()
    return {"status": "success", "platforms": m["platforms"]}


def _save_review(workspace_id, campaign_id, key, data, db, current_user, label):
    _require_workspace(workspace_id, db, current_user)
    camp = _get_campaign_or_404(workspace_id, campaign_id, db)
    if _is_published(camp):
        raise HTTPException(status_code=409, detail="This campaign is published — create a new version to edit it.")
    m = dict(camp.metrics or {})
    m[key] = data
    m = _append_activity(m, label)
    camp.metrics = m
    db.commit()
    return {"status": "success", key: data}


@router.post("/{workspace_id}/campaigns/{campaign_id}/meta-review")
def save_meta_review(workspace_id: int, campaign_id: int, body: schemas.ReviewBody,
                     db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Persist the edited Meta review (campaign name, objective, audience, budget, placements,
    CTA, landing page, tracking URL, creative). Read only after publish."""
    return _save_review(workspace_id, campaign_id, "meta_review", body.data, db, current_user, "Meta review saved")


@router.post("/{workspace_id}/campaigns/{campaign_id}/google-review")
def save_google_review(workspace_id: int, campaign_id: int, body: schemas.ReviewBody,
                       db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """Persist the edited Google review (campaign type, keywords, headlines, descriptions,
    extensions, landing page, budget, tracking URL). Read only after publish."""
    return _save_review(workspace_id, campaign_id, "google_review", body.data, db, current_user, "Google review saved")


@router.post("/{workspace_id}/campaigns/{campaign_id}/optimization")
def save_optimization(workspace_id: int, campaign_id: int, body: schemas.OptimizationBody,
                      db: Session = Depends(database.get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    """Auto-kill / CPA / frequency / creative-rotation / refresh-interval. Read-only once published."""
    _require_workspace(workspace_id, db, current_user)
    camp = _get_campaign_or_404(workspace_id, campaign_id, db)
    if _is_published(camp):
        raise HTTPException(status_code=409, detail="Optimization rules are locked after publishing.")
    m = dict(camp.metrics or {})
    m["optimization"] = body.data
    m = _append_activity(m, "Optimization rules updated")
    camp.metrics = m
    db.commit()
    return {"status": "success", "optimization": body.data}


def _clone_campaign(src, *, version: int, version_group: str, status: str = "PENDING_REVIEW"):
    """A fresh Campaign row copying the source's strategy/reviews/rules but clearing published
    state — used by create-version and duplicate."""
    import copy
    m = copy.deepcopy(src.metrics or {})
    for k in ("published_at", "published_mode", "published_modes", "published_platforms",
              "campaign_ids", "campaign_urls", "meta_objects", "google_objects",
              "meta_setup", "google_setup", "analytics"):
        m.pop(k, None)
    m["activity"] = []
    return models.Campaign(
        workspace_id=src.workspace_id, platform=src.platform, name=src.name,
        objective=src.objective, budget=src.budget, daily_budget=src.daily_budget,
        status=status, roas=0.0, metrics=m, version=version, version_group=version_group,
    )


@router.post("/{workspace_id}/campaigns/{campaign_id}/create-version")
def create_version(workspace_id: int, campaign_id: int, db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    """Duplicate a published campaign into the next version (V2, V3…) as an editable APPROVED
    draft, keeping the previous version read-only. Same version_group ties them together."""
    _require_workspace(workspace_id, db, current_user)
    camp = _get_campaign_or_404(workspace_id, campaign_id, db)
    vg = camp.version_group or f"vg-{workspace_id}-{camp.id}"
    if not camp.version_group:
        camp.version_group = vg
    latest = (db.query(models.Campaign)
              .filter(models.Campaign.version_group == vg)
              .order_by(models.Campaign.version.desc()).first())
    next_version = (latest.version if latest else camp.version or 1) + 1
    # New version starts APPROVED so its Select Platforms / reviews are immediately editable
    # (the strategy is inherited and already approved).
    new = _clone_campaign(camp, version=next_version, version_group=vg, status="APPROVED")
    new.metrics = _append_activity(new.metrics, f"Version {next_version} created from v{camp.version}")
    db.add(new); db.commit(); db.refresh(new)
    return {"status": "success", "campaign_id": new.id, "version": new.version, "version_group": vg}


@router.post("/{workspace_id}/campaigns/{campaign_id}/duplicate")
def duplicate_campaign(workspace_id: int, campaign_id: int, db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """Copy a campaign into a brand-new campaign (its own version_group, Version 1, editable draft)."""
    _require_workspace(workspace_id, db, current_user)
    camp = _get_campaign_or_404(workspace_id, campaign_id, db)
    new = _clone_campaign(camp, version=1, version_group=None, status="APPROVED")
    new.name = f"{camp.name} (copy)" if camp.name else "Campaign (copy)"
    db.add(new); db.commit(); db.refresh(new)
    new.version_group = f"vg-{workspace_id}-{new.id}"
    new.metrics = _append_activity(new.metrics or {}, "Duplicated into a new campaign")
    db.commit()
    return {"status": "success", "campaign_id": new.id, "version": 1}


@router.get("/{workspace_id}/campaigns/{campaign_id}/analytics")
def campaign_analytics(workspace_id: int, campaign_id: int, db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """Realistic MOCK analytics for a published campaign (no external API). Deterministic per
    campaign so numbers are stable across reloads. Replace with real Meta/Google insights later."""
    _require_workspace(workspace_id, db, current_user)
    camp = _get_campaign_or_404(workspace_id, campaign_id, db)
    m = dict(camp.metrics or {})
    import random as _rand
    rng = _rand.Random(campaign_id * 7919 + 13)          # stable seed
    budget = float(camp.budget or m.get("total_budget") or 40000)
    platforms = m.get("published_platforms") or [p for p, on in (m.get("platforms") or {}).items() if on] or ["meta", "google"]
    spend = round(budget * rng.uniform(0.55, 0.92), 2)
    cpm = rng.uniform(90, 260)                            # ₹ per 1000 impressions
    impressions = int(spend / cpm * 1000)
    reach = int(impressions * rng.uniform(0.5, 0.72))
    ctr = round(rng.uniform(1.4, 4.6), 2)
    clicks = int(impressions * ctr / 100)
    conversions = max(1, int(clicks * rng.uniform(0.02, 0.06)))
    cpa = round(spend / conversions, 2) if conversions else 0.0
    roas = round(rng.uniform(1.6, 4.8), 2)               # realistic return on ad spend
    revenue = round(spend * roas, 2)

    def _split(total, base):
        a = round(total * base, 2); return a, round(total - a, 2)
    meta_share = 0.62 if len(platforms) > 1 else (1.0 if "meta" in platforms else 0.0)
    m_spend, g_spend = _split(spend, meta_share)
    m_conv, g_conv = _split(conversions, meta_share)

    kws = (m.get("top_keywords") or (m.get("google_review") or {}).get("keywords") or
           ["online course", "learn coding", "interview prep", "dsa practice", "placement guide"])[:6]
    top_keywords = [{"keyword": k, "clicks": int(clicks * rng.uniform(0.05, 0.22)),
                     "ctr": round(rng.uniform(1.8, 6.2), 2), "conversions": max(0, int(conversions * rng.uniform(0.05, 0.2)))}
                    for k in kws]
    recs = []
    if roas >= 2.5: recs.append({"action": "Increase Budget", "why": f"ROAS {roas}× is well above target — scale to capture more volume.", "severity": "good"})
    if ctr < 2.0: recs.append({"action": "Rotate Creative", "why": f"CTR {ctr}% is soft — refresh the creative to fight fatigue.", "severity": "warn"})
    if cpa > budget * 0.05: recs.append({"action": "Pause Campaign", "why": f"CPA ₹{cpa} is high relative to budget — pause or tighten targeting.", "severity": "critical"})
    if not recs: recs.append({"action": "Keep Running", "why": "Delivery is healthy and on-target.", "severity": "good"})

    return {
        "campaign_id": campaign_id, "name": camp.name, "version": camp.version,
        "status": camp.status, "published": _is_published(camp),
        "demo": True, "budget": budget, "platforms": platforms,
        "totals": {"impressions": impressions, "reach": reach, "clicks": clicks, "ctr": ctr,
                   "conversions": conversions, "cpa": cpa, "spend": spend, "roas": roas, "revenue": revenue},
        "meta_performance": {"spend": m_spend, "conversions": int(m_conv), "roas": round(roas * rng.uniform(0.9, 1.15), 2)} if "meta" in platforms else None,
        "google_performance": {"spend": g_spend, "conversions": int(g_conv), "roas": round(roas * rng.uniform(0.85, 1.1), 2)} if "google" in platforms else None,
        "top_keywords": top_keywords,
        "best_creative": {"image_url": m.get("image_url"), "ctr": round(ctr * rng.uniform(1.1, 1.5), 2), "label": "Best performing creative"},
        "recommendations": recs,
    }


@router.post("/{workspace_id}/campaigns/{campaign_id}/toggle")
def toggle_campaign(workspace_id: int, campaign_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    camp = db.query(models.Campaign).filter(models.Campaign.id == campaign_id, models.Campaign.workspace_id == workspace_id).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Campaign not found")
    camp.status = "paused" if camp.status == "active" else "active"
    db.commit()
    return {"status": "success", "new_status": camp.status}

# Creative Assets
# ---------------------------------------------------------------------------------------
# Generated ad images are stored in ad_assets.image_url. Providers that answer with bytes
# (Hugging Face, any OpenAI-compatible b64_json response) get encoded as a data: URI and
# saved verbatim, so a single row can hold well over a megabyte of base64. Returning those
# inline made GET /creatives a multi-megabyte response that the dashboard re-downloaded on
# every load and the browser could never cache.
#
# The list endpoint now hands back a URL pointing at the image instead. <img src> cannot
# carry the Authorization header the rest of the API uses, so the URL is signed: the (already
# authenticated) list call mints an HMAC over workspace, asset and a digest of the bytes.
# That keeps sequential asset ids from being enumerable, and the digest makes the URL change
# whenever the image does, so caching it forever is safe.
_IMAGE_URL_TTL = "public, max-age=31536000, immutable"


def _image_digest(data_uri: str) -> str:
    """md5 of the stored text. Not a security property - the HMAC below is - but md5 is what
    Postgres can compute in-database, which lets the list query hash the image without
    selecting it."""
    import hashlib
    return hashlib.md5(data_uri.encode()).hexdigest()


def _sign_image(workspace_id: int, asset_id: int, digest: str) -> str:
    import hmac, hashlib
    return hmac.new(auth.SECRET_KEY.encode(), f"{workspace_id}:{asset_id}:{digest}".encode(),
                    hashlib.sha256).hexdigest()[:32]


def _signed_image_url(workspace_id: int, asset_id: int, digest: str) -> str:
    sig = _sign_image(workspace_id, asset_id, digest)
    return f"/api/workspaces/{workspace_id}/creatives/{asset_id}/image?v={digest}&k={sig}"


def _public_image_url(asset) -> Optional[str]:
    """A data: URI becomes a signed URL; anything already a plain URL is passed through.
    For a single already-loaded asset (save/detail responses); the list endpoint uses the
    column-level query below so the blob never leaves the database."""
    url = asset.image_url or ""
    if not url.startswith("data:"):
        return asset.image_url
    return _signed_image_url(asset.workspace_id, asset.id, _image_digest(url))


from pydantic import BaseModel as _CompetitorBase


class CompetitorBody(_CompetitorBase):
    competitor: str


def _competitor_json(r) -> dict:
    return {
        "id": r.id,
        "competitor": r.competitor,
        "site_url": r.site_url,
        "positioning": r.positioning or "",
        "audience": r.audience or "",
        "tone": r.tone or "",
        "offers": r.offers or [],
        "hooks": r.hooks or [],
        "ctas": r.ctas or [],
        "notes": r.notes or "",
        "sources": r.sources or [],
        "researched_at": (r.updated_at or r.created_at).isoformat() if (r.updated_at or r.created_at) else None,
    }


@router.get("/{workspace_id}/competitors")
def list_competitors(workspace_id: int, db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Every competitor researched for this workspace, newest first."""
    _require_workspace(workspace_id, db, current_user)
    rows = (db.query(models.CompetitorReport)
              .filter(models.CompetitorReport.workspace_id == workspace_id)
              .order_by(models.CompetitorReport.updated_at.desc())
              .all())
    return [_competitor_json(r) for r in rows]


@router.post("/{workspace_id}/competitors/analyze")
async def analyze_competitor_route(workspace_id: int, body: CompetitorBody,
                                   db: Session = Depends(database.get_db),
                                   current_user: models.User = Depends(auth.get_current_user)):
    """Live competitor research from public sources - the competitor's own site plus search.

    Deliberately NOT an ad library: Meta's Ad Library API only returns political and
    social-issue ads outside the EU and Google has no Transparency Center API, so there is no
    lawful feed of a rival's commercial creatives to read. This reports what the public web
    actually shows, and returns its sources so every claim can be checked.
    """
    _require_workspace(workspace_id, db, current_user)
    name = (body.competitor or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Enter a competitor name or website.")

    from core.competitors import analyze_competitor
    try:
        data = await analyze_competitor(name)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Competitor research failed: {e}")

    # Re-researching a competitor updates its report rather than adding a second one, so the
    # list stays one row per rival however often it is refreshed.
    from sqlalchemy import func as _func
    from datetime import datetime as _datetime
    row = (db.query(models.CompetitorReport)
             .filter(models.CompetitorReport.workspace_id == workspace_id,
                     _func.lower(models.CompetitorReport.competitor) == name.lower())
             .first())
    if not row:
        row = models.CompetitorReport(workspace_id=workspace_id, competitor=name)
        db.add(row)

    row.site_url = data.get("site_url")
    row.positioning = data.get("positioning") or ""
    row.audience = data.get("audience") or ""
    row.tone = data.get("tone") or ""
    row.offers = data.get("offers") or []
    row.hooks = data.get("hooks") or []
    row.ctas = data.get("ctas") or []
    row.notes = data.get("notes") or ""
    row.sources = data.get("sources") or []
    row.updated_at = _datetime.utcnow()
    db.commit()
    db.refresh(row)
    return _competitor_json(row)


@router.delete("/{workspace_id}/competitors/{report_id}")
def delete_competitor(workspace_id: int, report_id: int, db: Session = Depends(database.get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    _require_workspace(workspace_id, db, current_user)
    row = (db.query(models.CompetitorReport)
             .filter(models.CompetitorReport.id == report_id,
                     models.CompetitorReport.workspace_id == workspace_id)
             .first())
    if not row:
        raise HTTPException(status_code=404, detail="Competitor report not found")
    db.delete(row)
    db.commit()
    return {"status": "deleted"}


@router.get("/{workspace_id}/creatives/{asset_id}/image")
def get_creative_image(workspace_id: int, asset_id: int, v: str, k: str,
                       db: Session = Depends(database.get_db)):
    """Serve one generated image's bytes. Authorised by the signature in the query string
    rather than a bearer token, because this URL is loaded by <img src>."""
    import base64, hmac as _hmac
    from fastapi import Response

    asset = db.query(models.AdAsset).filter(models.AdAsset.id == asset_id,
                                            models.AdAsset.workspace_id == workspace_id).first()
    if not asset or not (asset.image_url or "").startswith("data:"):
        raise HTTPException(status_code=404, detail="No stored image for this asset")

    digest = _image_digest(asset.image_url)
    # compare_digest on both halves: `v` must match the current bytes (so a stale URL for a
    # replaced image 404s instead of serving the wrong picture) and `k` must be our signature.
    if not (_hmac.compare_digest(v, digest)
            and _hmac.compare_digest(k, _sign_image(workspace_id, asset_id, digest))):
        raise HTTPException(status_code=404, detail="No stored image for this asset")

    header, _, payload = asset.image_url.partition(",")
    media_type = header[5:].split(";")[0] or "image/png"   # strip the leading "data:"
    try:
        content = base64.b64decode(payload)
    except Exception:
        raise HTTPException(status_code=500, detail="Stored image is not valid base64")
    return Response(content=content, media_type=media_type,
                    headers={"Cache-Control": _IMAGE_URL_TTL})


@router.get("/{workspace_id}/creatives", response_model=List[schemas.AdAssetResponse])
def get_creatives(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    # Deliberately column-level rather than db.query(AdAsset): selecting the whole row pulls
    # every base64 image_url out of the database, which for this table is ~9MB of traffic per
    # call even though none of it reaches the response. Postgres hashes the blob in place and
    # only the hash comes back.
    from sqlalchemy import case, func
    is_data = models.AdAsset.image_url.like("data:%")
    rows = (
        db.query(
            models.AdAsset.id,
            models.AdAsset.headline,
            models.AdAsset.body_text,
            models.AdAsset.cta,
            models.AdAsset.type,
            models.AdAsset.video_url,
            models.AdAsset.status,
            case((is_data, None), else_=models.AdAsset.image_url).label("plain_url"),
            case((is_data, func.md5(models.AdAsset.image_url)), else_=None).label("digest"),
        )
        .filter(models.AdAsset.workspace_id == workspace_id)
        .order_by(models.AdAsset.id.desc())
        .all()
    )

    return [
        schemas.AdAssetResponse(
            id=r.id,
            headline=r.headline,
            body_text=r.body_text,
            cta=r.cta,
            type=r.type,
            video_url=r.video_url,
            status=r.status,
            image_url=(_signed_image_url(workspace_id, r.id, r.digest) if r.digest else r.plain_url),
        )
        for r in rows
    ]

@router.post("/{workspace_id}/creatives/save", response_model=schemas.AdAssetResponse)
def save_creative(workspace_id: int, asset: schemas.AdAssetCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    
    new_asset = models.AdAsset(
        workspace_id=workspace_id,
        headline=asset.headline,
        body_text=asset.body_text,
        cta=asset.cta,
        type=asset.type,
        image_url=asset.image_url,
        video_url=asset.video_url,
        # Was hardcoded "approved", so a design saved from the Studio as a *draft* came back
        # as an approved library asset. Constrained to the states the review flow knows.
        status=(asset.status if asset.status in ("approved", "pending_review", "rejected")
                else "approved"),
    )
    db.add(new_asset)
    db.commit()
    db.refresh(new_asset)
    return new_asset

# Reference images for the Creative Studio. Stored per workspace under the same
# generated_media tree the rendered videos use, and served by the mount in main.py.
_UPLOAD_MAX_BYTES = 10 * 1024 * 1024
# Extension -> the magic bytes that must actually be present. Trusting the extension (or the
# client-supplied content-type) alone lets "logo.png" contain anything at all.
_UPLOAD_SIGNATURES = {
    ".png":  [b"\x89PNG\r\n\x1a\n"],
    ".jpg":  [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
    ".webp": [b"RIFF"],
    ".gif":  [b"GIF87a", b"GIF89a"],
}


@router.post("/{workspace_id}/upload")
async def upload_asset(workspace_id: int, file: UploadFile = File(...), db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Store a reference image and return a URL the generation pipeline can actually read.

    The previous version wrote the client-supplied filename straight into an `uploads/`
    directory that was never mounted, so the returned URL always 404'd, two users uploading
    "logo.png" overwrote each other, and a crafted name could escape the directory. It also
    accepted any file of any size with no validation.
    """
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")

    import uuid as _uuid
    from pathlib import Path as _Path

    ext = _Path(file.filename or "").suffix.lower()
    if ext not in _UPLOAD_SIGNATURES:
        raise HTTPException(status_code=400, detail=(
            f"Unsupported file type '{ext or 'unknown'}'. Allowed: "
            f"{', '.join(sorted(_UPLOAD_SIGNATURES))}."))

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > _UPLOAD_MAX_BYTES:
        raise HTTPException(status_code=413, detail=(
            f"File is {len(content) // 1024 // 1024}MB; the limit is "
            f"{_UPLOAD_MAX_BYTES // 1024 // 1024}MB."))
    if not any(content.startswith(sig) for sig in _UPLOAD_SIGNATURES[ext]):
        raise HTTPException(status_code=400, detail=(
            f"That file is not a valid {ext.lstrip('.').upper()} image — its contents do not "
            "match its extension."))

    # UUID name: no collisions between workspaces, and nothing user-controlled ends up in a
    # filesystem path. Scoped per workspace so assets stay separable.
    from core.providers.kenburns_video import MEDIA_ROOT
    upload_dir = MEDIA_ROOT / "uploads" / str(workspace_id)
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{_uuid.uuid4().hex}{ext}"
    (upload_dir / stored_name).write_bytes(content)

    return {"status": "success",
            "url": f"/api/generated/uploads/{workspace_id}/{stored_name}",
            "filename": file.filename, "size": len(content)}

@router.delete("/{workspace_id}/creatives/{asset_id}")
def delete_creative(workspace_id: int, asset_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
        
    asset = db.query(models.AdAsset).filter(models.AdAsset.id == asset_id, models.AdAsset.workspace_id == workspace_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ad asset not found")
        
    db.delete(asset)
    db.commit()
    return {"status": "success", "message": "Ad deleted from library"}


# SEO audits
@router.get("/{workspace_id}/seo", response_model=List[schemas.SEOAuditResponse])
def get_seo_audits(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    audits = db.query(models.SEOAudit).filter(models.SEOAudit.workspace_id == workspace_id).all()
    return audits


@router.get("/{workspace_id}/seo/latest-audit")
def latest_audit(workspace_id: int, db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    """Read-only: the most recent run's structured audit (SEO/GEO scores, category
    breakdown, top issues) for the dashboard. Nothing is computed here — it just returns
    what the pipeline already produced."""
    _require_workspace(workspace_id, db, current_user)
    rows = (db.query(models.SEOAudit)
              .filter(models.SEOAudit.workspace_id == workspace_id)
              .order_by(models.SEOAudit.created_at.desc()).all())

    # SEO and GEO are stored as SEPARATE audit rows, each carrying only its own section
    # ("audit": {"seo": ...} or {"geo": ...}). This used to return the single newest row
    # with an audit on it, so whichever pipeline ran last was shown and the other was
    # invisible - a workspace that had run both saw only one, which is what "the audit
    # results are not coming as expected" looks like from the dashboard.
    #
    # Both are now merged into one response, each from its own most recent run, so the two
    # halves can be months apart and still both appear (with their own timestamps).
    def _newest(pipeline: str):
        for r in rows:
            kd = r.keywords_data or {}
            audit = kd.get("audit") or {}
            if kd.get("pipeline", "SEO") == pipeline and audit.get(pipeline.lower()):
                return r
        return None

    seo_row, geo_row = _newest("SEO"), _newest("GEO")
    if not seo_row and not geo_row:
        return {"has_audit": False, "target_url": None, "created_at": None, "audit": None}

    newest = max([r for r in (seo_row, geo_row) if r],
                 key=lambda r: r.created_at or datetime.datetime.min)
    merged = {}
    for row, key in ((seo_row, "seo"), (geo_row, "geo")):
        if not row:
            continue
        audit = (row.keywords_data or {}).get("audit") or {}
        if audit.get(key):
            merged[key] = audit[key]
        # Shared, non-pipeline-specific sections come from whichever row is newer.
        for shared in ("target_url", "priority_issues", "top_5_issues", "real_keywords"):
            if row is newest and audit.get(shared) is not None:
                merged[shared] = audit[shared]

    kd_newest = newest.keywords_data or {}
    return {
        "has_audit": True,
        "target_url": kd_newest.get("target_url"),
        "created_at": newest.created_at.isoformat() if newest.created_at else None,
        # Per-pipeline timestamps, because the two halves are independent runs and a stale
        # GEO score beside a fresh SEO one should be legible as stale.
        "seo_run_at": seo_row.created_at.isoformat() if seo_row and seo_row.created_at else None,
        "geo_run_at": geo_row.created_at.isoformat() if geo_row and geo_row.created_at else None,
        "audit": merged or None,
    }


@router.get("/{workspace_id}/seo/comparison")
def seo_comparison(workspace_id: int, pipeline: str = "SEO",
                   db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    """Month-over-month comparison: deltas between the two most recent stored runs
    (SEO on-page metrics, or GEO AI-visibility). This is what powers the monthly report."""
    _require_workspace(workspace_id, db, current_user)
    audits = (db.query(models.SEOAudit)
                .filter(models.SEOAudit.workspace_id == workspace_id)
                .order_by(models.SEOAudit.created_at.desc()).all())
    runs = [a for a in audits if (a.keywords_data or {}).get("pipeline", "SEO") == pipeline]

    if not runs:
        return {"pipeline": pipeline, "runs_available": 0,
                "message": "No runs recorded yet — run the pipeline to start tracking."}

    current = runs[0]
    previous = runs[1] if len(runs) > 1 else None
    cur_m = (current.keywords_data or {}).get("metrics", {}) or {}
    prev_m = ((previous.keywords_data or {}).get("metrics", {}) or {}) if previous else {}

    # (metric key, human label, which direction is an improvement)
    fields = [
        ("word_count", "Word count", "higher"),
        ("images_missing_alt", "Images missing alt-text", "lower"),
        ("internal_links", "Internal links", "higher"),
        ("external_links", "External links", "higher"),
        ("h1_count", "H1 tags", "neutral"),
        ("thin_content", "Thin content", "flag"),
    ]
    changes = []
    for key, label, better in fields:
        cv = cur_m.get(key)
        if cv is None:
            continue
        pv = prev_m.get(key) if previous else None
        entry = {"metric": label, "current": cv, "previous": pv, "better_when": better}
        if isinstance(cv, (int, float)) and isinstance(pv, (int, float)) and not isinstance(cv, bool):
            delta = cv - pv
            entry["delta"] = delta
            improved = (delta > 0 and better == "higher") or (delta < 0 and better == "lower")
            worsened = (delta > 0 and better == "lower") or (delta < 0 and better == "higher")
            entry["direction"] = "improved" if improved else ("worsened" if worsened else "same")
        changes.append(entry)

    ai_visibility = None
    if pipeline == "GEO":
        ai_visibility = {
            "current_recognised": cur_m.get("brand_recognised"),
            "previous_recognised": prev_m.get("brand_recognised") if previous else None,
            "current_recall": cur_m.get("llm_recall"),
        }

    return {
        "pipeline": pipeline,
        "target_url": (current.keywords_data or {}).get("target_url"),
        "runs_available": len(runs),
        # Some early runs were recorded in demo mode. Pass the flag through so the UI can mark
        # them: a demo score sitting unlabelled next to real crawls reads as a real result.
        "current_run": {"date": current.created_at, "score": current.score,
                        "demo": bool((current.keywords_data or {}).get("demo"))},
        "previous_run": ({"date": previous.created_at, "score": previous.score,
                          "demo": bool((previous.keywords_data or {}).get("demo"))}
                         if previous else None),
        "changes": changes,
        "ai_visibility": ai_visibility,
        "note": None if previous else "Only one run so far — the comparison fills in on the next run.",
    }


# ---------------------------------------------------------------- unified audit report
# SEO and GEO stay two independent pipelines (separate trigger buttons, separate single-
# flight state, separate scoring) — but they render into ONE combined report: this is the
# read model that report reads. Never create a second report container on the frontend;
# these endpoints all feed the same existing modal.

from agents.seo_geo import SEO_STAGES, GEO_STAGES  # noqa: E402
import datetime as _dt
from pydantic import BaseModel as _BaseModel


@router.get("/{workspace_id}/seo/run-status")
def seo_run_status(workspace_id: int, pipeline: str = "SEO", db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    """Live state of one pipeline's current run: idle / queued / running / completed /
    failed / cancelled, plus its stage checklist. Backed by the AgentTask row (updated as
    each real graph node completes) — not a fabricated timer."""
    _require_workspace(workspace_id, db, current_user)
    if pipeline not in ("SEO", "GEO"):
        raise HTTPException(status_code=400, detail="pipeline must be SEO or GEO")
    from core.agent_status import get_agent_task, is_running, reconcile_stale_running
    reconcile_stale_running(workspace_id, pipeline)
    task = get_agent_task(workspace_id, pipeline)
    stages = SEO_STAGES if pipeline == "SEO" else GEO_STAGES

    if not task:
        return {"status": "idle", "stages": stages, "stages_done": [], "current_stage": None,
                "started_at": None, "target_url": None, "running": False}

    logs = task.get("logs") or {}
    raw_status = task.get("status") or "idle"
    running = raw_status == "RUNNING" and is_running(workspace_id, pipeline)
    status_map = {"RUNNING": "running" if running else "failed", "COMPLETED": "completed",
                 "FAILED": "failed", "CANCELLED": "cancelled"}
    return {
        "status": status_map.get(raw_status, "idle"),
        "running": running,
        "stages": stages,
        "stages_done": logs.get("stages_done") or [],
        "current_stage": logs.get("current_stage"),
        "started_at": logs.get("started_at"),
        "target_url": logs.get("target_url"),
        "summary": logs.get("summary"),
    }


class PreflightBody(_BaseModel):
    target_url: str


@router.post("/{workspace_id}/seo/preflight")
async def seo_preflight(workspace_id: int, body: PreflightBody,
                        db: Session = Depends(database.get_db),
                        current_user: models.User = Depends(auth.get_current_user)):
    """Cheap reachability + gate check BEFORE spending a crawl.

    Without this the only feedback loop was: run the pipeline, wait ~40s for Firecrawl and
    the LLM, then discover the URL served a login page or a host 404. Those pages answer
    HTTP 200 and score like any other page, so the user got a plausible-looking audit of
    something that was not their site. One HTTP request up front turns that into an
    immediate, specific message.

    Deliberately advisory: it returns a verdict, it does not start or block anything. The
    caller decides, so a slow-but-valid site is never made unauditable by this check.
    """
    _require_workspace(workspace_id, db, current_user)
    import httpx
    from agents.seo_geo import detect_gate_page

    # normalize_target_url strips whitespace anywhere in the value, not just the ends:
    # a stored company_url like " ambraneindia.com" otherwise reaches the crawler as
    # "https:// ambraneindia.com" and is rejected with HTTP 400.
    from agents.seo_geo import normalize_target_url
    url = normalize_target_url(body.target_url)
    if not url:
        return {"ok": False, "code": "EMPTY_URL",
                "message": "Enter the website address you want audited."}
    from urllib.parse import urlsplit
    parts = urlsplit(url)
    if not parts.netloc or "." not in parts.netloc:
        return {"ok": False, "code": "INVALID_URL", "url": url,
                "message": f"'{body.target_url}' is not a valid website address."}

    # Retried because a single transient failure here is costly: this check gates the
    # whole audit, so one DNS blip or dropped connection tells the user their perfectly
    # live site is offline. Transport errors only - an HTTP status is a real answer and
    # is handled below, so retrying it would just be slow.
    r = None
    last_exc: Exception | None = None
    for attempt in range(3):
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True,
                                         headers={"User-Agent": "RaftraSEOBot/1.0"}) as c:
                r = await c.get(url)
            break
        except httpx.TransportError as e:
            last_exc = e
            if attempt < 2:
                await asyncio.sleep(0.5 * (attempt + 1))  # 0.5s, then 1s
        except Exception as e:
            last_exc = e
            break  # not a transport problem; retrying won't help

    if r is None:
        return {"ok": False, "code": "UNREACHABLE", "url": url,
                "message": f"Could not reach {parts.netloc}. Check the address is correct "
                           f"and the site is publicly online. ({type(last_exc).__name__})"}

    if r.status_code >= 400:
        return {"ok": False, "code": "HTTP_ERROR", "url": url, "status": r.status_code,
                "message": f"{parts.netloc} returned HTTP {r.status_code}. Audit a page that "
                           "loads successfully."}

    gate = detect_gate_page(str(r.url), r.text, r.text)
    if gate.get("is_gate"):
        return {"ok": False, "code": "NOT_PUBLIC", "url": url, "final_url": str(r.url),
                "markers": gate.get("markers", []),
                "message": ("That address serves a login, placeholder or 'not deployed' page "
                            "to visitors, not your real content. Make the site public (or "
                            "audit a page that is) — auditing this would score the "
                            "placeholder, not your site.")}

    return {"ok": True, "url": url, "final_url": str(r.url),
            "redirected": len(r.history) > 0}


@router.post("/{workspace_id}/seo/cancel")
def seo_cancel_run(workspace_id: int, pipeline: str = "SEO", db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    """Cancel the in-flight audit for this pipeline, if one is running."""
    _require_workspace(workspace_id, db, current_user)
    if pipeline not in ("SEO", "GEO"):
        raise HTTPException(status_code=400, detail="pipeline must be SEO or GEO")
    from core.agent_status import cancel_task
    ok = cancel_task(workspace_id, pipeline)
    if not ok:
        raise HTTPException(status_code=409, detail="No audit is currently running for this pipeline.")
    return {"status": "success", "message": "Cancelling the audit…"}


def _latest_pipeline_row(rows: list, pipeline: str):
    return next((r for r in rows if (r.keywords_data or {}).get("pipeline") == pipeline
                and (r.keywords_data or {}).get("audit")), None)


def _audit_row_view(r) -> Optional[dict]:
    if not r:
        return None
    kd = r.keywords_data or {}
    return {"id": r.id, "target_url": kd.get("target_url"),
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "audit": kd.get("audit"), "decisions": kd.get("decisions") or {},
            "duration_seconds": kd.get("duration_seconds"),
            # The full LLM-written narrative strategy report for this run (the theoretical,
            # plain-language explanation) — the structured scores above are the "what",
            # this is the "why it matters and what to do about it".
            "narrative_report": r.recommendation}


@router.get("/{workspace_id}/seo/audit-report")
def audit_report(workspace_id: int, db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    """The ONE combined Website Audit Report — merges the latest SEO audit row and the
    latest GEO audit row (each scored independently by its own pipeline) into a single
    read model. This is the only audit report surface in the app; it is read-only —
    approval lives per-recommendation via the decision endpoint below, never on the report
    itself."""
    _require_workspace(workspace_id, db, current_user)
    rows = (db.query(models.SEOAudit)
              .filter(models.SEOAudit.workspace_id == workspace_id)
              .order_by(models.SEOAudit.created_at.desc()).all())
    seo_data = _audit_row_view(_latest_pipeline_row(rows, "SEO"))
    geo_data = _audit_row_view(_latest_pipeline_row(rows, "GEO"))

    seo_score = seo_data["audit"]["seo"]["score_100"] if seo_data else None
    geo_score = geo_data["audit"]["geo"]["score_100"] if geo_data else None
    if seo_score is not None and geo_score is not None:
        overall = round((seo_score + geo_score) / 2, 1)
    else:
        overall = seo_score if seo_score is not None else geo_score

    target_url = (seo_data or {}).get("target_url") or (geo_data or {}).get("target_url")
    dates = [d["created_at"] for d in (seo_data, geo_data) if d and d.get("created_at")]
    generated_at = max(dates) if dates else None

    # Merge priority issues from both pipelines, tagging each with where it came from so the
    # frontend knows which audit_id to POST a decision against.
    priority_issues = []
    for pipeline_key, data in (("SEO", seo_data), ("GEO", geo_data)):
        if not data:
            continue
        decisions = data.get("decisions") or {}
        for it in (data["audit"].get("priority_issues") or []):
            key = f"{it.get('area')}::{it.get('issue')}"
            dec = decisions.get(key) or {}
            priority_issues.append({**it, "pipeline": pipeline_key, "audit_id": data["id"], "key": key,
                                    "decision": dec.get("decision"), "edited_text": dec.get("edited_text")})
    order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    priority_issues.sort(key=lambda i: order.get(i.get("severity"), 4))

    # The two halves are fetched INDEPENDENTLY (latest SEO row, latest GEO row), so nothing
    # guarantees they describe the same page or the same run. In practice they diverged
    # badly: an SEO audit of a Shopify password gate was averaged with a two-week-old GEO
    # audit of an entirely different site, producing a combined "Overall Health" that
    # described neither. Detect the mismatch and let the client render them apart.
    from urllib.parse import urlsplit

    def _host_path(u):
        p = urlsplit(u or "")
        return (p.netloc.lower().removeprefix("www."), (p.path or "/").rstrip("/") or "/")

    seo_url = (seo_data or {}).get("target_url")
    geo_url = (geo_data or {}).get("target_url")
    mismatch = bool(seo_data and geo_data and _host_path(seo_url) != _host_path(geo_url))

    # Materially different ages mean one half is stale even when the URLs agree.
    stale_days = None
    if seo_data and geo_data and seo_data.get("created_at") and geo_data.get("created_at"):
        try:
            import datetime as _d
            a = _d.datetime.fromisoformat(seo_data["created_at"])
            b = _d.datetime.fromisoformat(geo_data["created_at"])
            stale_days = round(abs((a - b).total_seconds()) / 86400, 1)
        except Exception:
            stale_days = None

    return {
        "has_audit": bool(seo_data or geo_data),
        "target_url": target_url,
        "generated_at": generated_at,
        # A combined score across two different URLs is meaningless arithmetic, so it is
        # withheld rather than shown as a real number.
        "overall_health": None if mismatch else overall,
        "seo": seo_data,
        "geo": geo_data,
        "priority_issues": priority_issues,
        # --- provenance, so the UI can show WHICH page and WHEN for each half ---
        "seo_target_url": seo_url,
        "geo_target_url": geo_url,
        "seo_generated_at": (seo_data or {}).get("created_at"),
        "geo_generated_at": (geo_data or {}).get("created_at"),
        "url_mismatch": mismatch,
        "age_gap_days": stale_days,
        "stale_half": ("GEO" if (stale_days or 0) >= 1 and seo_data and geo_data
                       and (seo_data.get("created_at") or "") > (geo_data.get("created_at") or "")
                       else "SEO" if (stale_days or 0) >= 1 else None),
    }


@router.get("/{workspace_id}/seo/audit-history")
def audit_history(workspace_id: int, limit: int = 20, db: Session = Depends(database.get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    """Compact combined history — one row per day a run happened, showing whichever
    SEO/GEO score was captured that day. Clicking a row loads that day's audits into the
    same report (never a new report card)."""
    _require_workspace(workspace_id, db, current_user)
    rows = (db.query(models.SEOAudit)
              .filter(models.SEOAudit.workspace_id == workspace_id)
              .order_by(models.SEOAudit.created_at.desc()).all())
    buckets: dict = {}
    durations = {"SEO": [], "GEO": []}
    for r in rows:
        kd = r.keywords_data or {}
        if not kd.get("audit") or not r.created_at:
            continue
        day = r.created_at.date().isoformat()
        b = buckets.setdefault(day, {"date": day, "target_url": kd.get("target_url"), "status": "COMPLETED"})
        pipeline = kd.get("pipeline")
        if pipeline == "SEO" and "seo_id" not in b:
            b["seo_id"] = r.id
            b["seo_score"] = kd["audit"]["seo"]["score_100"]
        elif pipeline == "GEO" and "geo_id" not in b:
            b["geo_id"] = r.id
            b["geo_score"] = kd["audit"]["geo"]["score_100"]
        if pipeline in durations and kd.get("duration_seconds"):
            durations[pipeline].append(kd["duration_seconds"])
    out = sorted(buckets.values(), key=lambda b: b["date"], reverse=True)[:limit]
    # Real historical average per pipeline (last 5 runs) — used for the Running state's
    # "estimated time remaining", never a fabricated number.
    avg_duration = {p: round(sum(d[:5]) / len(d[:5]), 1) for p, d in durations.items() if d}
    return {"runs": out, "avg_duration_seconds": avg_duration}


@router.get("/{workspace_id}/seo/audits/{audit_id}")
def get_seo_audit_by_id(workspace_id: int, audit_id: int, db: Session = Depends(database.get_db),
                        current_user: models.User = Depends(auth.get_current_user)):
    """Fetch one specific past audit (for opening an Audit History row) — same per-pipeline
    shape used inside the combined report, so the frontend can compose a historical view by
    fetching the SEO id and/or GEO id from that day's history bucket."""
    _require_workspace(workspace_id, db, current_user)
    row = db.query(models.SEOAudit).filter(models.SEOAudit.id == audit_id,
                                            models.SEOAudit.workspace_id == workspace_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Audit not found")
    data = _audit_row_view(row)
    pipeline = (row.keywords_data or {}).get("pipeline")
    return {**data, "pipeline": pipeline}


@router.delete("/{workspace_id}/seo/audits/{audit_id}")
def delete_seo_audit(workspace_id: int, audit_id: int, db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Delete one past audit run (from Audit History, or the current report).

    Idempotent by design. The client deletes a DAY, which can mean two rows (an SEO id and
    a GEO id) taken from a report snapshot that may be seconds out of date — a re-run, a
    prior delete, or a stale open tab all leave it holding an id that no longer exists.
    404-ing there surfaced "Could not delete: Audit not found" even when the user's intent
    (that audit should be gone) was already satisfied. DELETE on an absent resource is
    conventionally a success, so report it as one and say which case it was.
    """
    _require_workspace(workspace_id, db, current_user)
    row = db.query(models.SEOAudit).filter(models.SEOAudit.id == audit_id,
                                            models.SEOAudit.workspace_id == workspace_id).first()
    if not row:
        return {"status": "success", "deleted": False,
                "message": "That audit was already removed."}
    db.delete(row)
    db.commit()
    return {"status": "success", "deleted": True, "message": "Audit deleted."}


class RecommendationDecisionBody(_BaseModel):
    issue_key: str          # stable key for the issue within this audit (area + issue text)
    decision: str           # "approved" | "edited" | "rejected"
    edited_text: Optional[str] = None


@router.post("/{workspace_id}/seo/audits/{audit_id}/decision")
def set_recommendation_decision(workspace_id: int, audit_id: int, body: RecommendationDecisionBody,
                                background: BackgroundTasks,
                                db: Session = Depends(database.get_db),
                                current_user: models.User = Depends(auth.get_current_user)):
    """Approve / Edit / Reject ONE recommendation inside the combined report. This is the
    only place approval lives — the audit report itself stays read-only. Approved/edited
    decisions surface in the Publishing Queue.

    If the workspace's WordPress connection has auto_apply on, approving here also pushes
    the fix to the live site in the background (see core/seo_autoapply.py). The gate is
    still this endpoint: auto-apply removes the second manual click, not the review."""
    _require_workspace(workspace_id, db, current_user)
    if body.decision not in ("approved", "edited", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be approved, edited or rejected")
    row = db.query(models.SEOAudit).filter(models.SEOAudit.id == audit_id,
                                            models.SEOAudit.workspace_id == workspace_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Audit not found")
    kd = dict(row.keywords_data or {})
    decisions = dict(kd.get("decisions") or {})
    decisions[body.issue_key] = {"decision": body.decision, "edited_text": body.edited_text,
                                 "decided_at": _dt.datetime.utcnow().isoformat()}
    kd["decisions"] = decisions
    row.keywords_data = kd
    db.commit()
    if body.decision in ("approved", "edited"):
        # Stages the change and notifies; the live write still needs the user to confirm
        # the before/after in the WordPress panel. See core/seo_autoapply.py.
        from core.seo_autoapply import prepare_wordpress_after_approval
        background.add_task(prepare_wordpress_after_approval, workspace_id, current_user.id)
    return {"status": "success", "decisions": decisions}


@router.get("/{workspace_id}/publishing-queue")
def publishing_queue(workspace_id: int, db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    """Approved/edited recommendations from the CURRENT SEO + GEO audits.

    The docstring always said "latest", but the loop ran over every audit ever recorded.
    Approvals are permanent, so a fix approved weeks ago against a different site kept
    surfacing here — e.g. "Add a robots.txt" and "Publish an XML sitemap" from a 28 July
    audit of another domain, both of which the current audit measures as already present.
    Applying those would write stale fixes, for the wrong site, onto a live platform.

    Three guards now:
      1. only the latest SEO row and latest GEO row are considered;
      2. an approval whose finding is absent from that audit is dropped as `resolved` —
         the issue was fixed or the page changed since it was approved;
      3. anything whose audit URL differs from the current target is flagged rather than
         listed silently.
    """
    _require_workspace(workspace_id, db, current_user)
    rows = (db.query(models.SEOAudit)
              .filter(models.SEOAudit.workspace_id == workspace_id)
              .order_by(models.SEOAudit.created_at.desc()).all())

    current_rows = [r for r in (_latest_pipeline_row(rows, "SEO"),
                                _latest_pipeline_row(rows, "GEO")) if r is not None]
    current_url = next(((r.keywords_data or {}).get("target_url") for r in current_rows
                        if (r.keywords_data or {}).get("target_url")), None)

    def _host_path(u):
        from urllib.parse import urlsplit
        p = urlsplit(u or "")
        return (p.netloc.lower().removeprefix("www."), (p.path or "/").rstrip("/") or "/")

    items, resolved, stale_urls = [], [], set()
    for r in current_rows:
        kd = r.keywords_data or {}
        decisions = kd.get("decisions") or {}
        audit = kd.get("audit") or {}
        issues = audit.get("priority_issues") or audit.get("top_5_issues") or []
        by_key = {f"{it.get('area')}::{it.get('issue')}": it for it in issues}
        row_url = kd.get("target_url")
        off_target = bool(current_url and row_url and
                          _host_path(row_url) != _host_path(current_url))
        if off_target:
            stale_urls.add(row_url)
        for key, d in decisions.items():
            if d.get("decision") not in ("approved", "edited"):
                continue
            src = by_key.get(key)
            entry = {
                "audit_id": r.id,
                "pipeline": kd.get("pipeline"),
                "target_url": row_url,
                "area": (src or {}).get("area") or key.rsplit("::", 1)[0],
                "issue": d.get("edited_text") or (src or {}).get("issue") or key.rsplit("::", 1)[-1],
                "decision": d.get("decision"),
                "decided_at": d.get("decided_at"),
                "off_target": off_target,
            }
            # No matching finding in the audit this approval belongs to -> already handled.
            (items if src else resolved).append(entry)

    items.sort(key=lambda x: x.get("decided_at") or "", reverse=True)
    resolved.sort(key=lambda x: x.get("decided_at") or "", reverse=True)
    return {
        "items": items,
        "target_url": current_url,
        # Approved once, but the finding is gone from the current audit. Surfaced separately
        # so the user can see they were dropped rather than silently losing them.
        "resolved": resolved,
        "stale_target_urls": sorted(stale_urls),
    }


# Social posts
@router.get("/{workspace_id}/social", response_model=List[schemas.SocialPostResponse])
def get_social_posts(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    posts = db.query(models.SocialPost).filter(models.SocialPost.workspace_id == workspace_id).all()
    return posts

# Influencers
@router.get("/{workspace_id}/influencers", response_model=List[schemas.InfluencerResponse])
def get_influencers(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    # For marketplace, return all influencers globally so brands can discover them
    influencers = db.query(models.Influencer).all()
    return influencers

# Creators reach the marketplace UI from three places: this table, a bundled JSON file, and a
# Google Sheet sync. Only rows in this table have the numeric id that chat messages and deals
# are keyed on, so anyone arriving from the sheet or the file could be browsed but never
# transacted with. This imports them, matched on handle, so the rest of the marketplace can
# reference them.
class ImportCreator(_CompetitorBase):
    name: str
    handle: str
    platform: Optional[str] = "instagram"
    niche: Optional[str] = None
    base_rate: Optional[float] = 0.0
    fit_score: Optional[int] = None
    success_rate: Optional[int] = None


class ImportCreatorsBody(_CompetitorBase):
    creators: List[ImportCreator]


def _normalise_handle(value: str) -> str:
    return (value or "").strip().lstrip("@").lower()


@router.post("/{workspace_id}/influencers/import")
def import_influencers(workspace_id: int, body: ImportCreatorsBody,
                       db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    """Upsert marketplace creators by handle. Idempotent: re-importing the same sheet updates
    the catalogue fields rather than creating duplicates."""
    _require_workspace(workspace_id, db, current_user)

    incoming = body.creators or []
    if not incoming:
        return {"created": 0, "updated": 0, "skipped": 0, "ids": {}}
    if len(incoming) > 200:
        raise HTTPException(status_code=413, detail="Import at most 200 creators per request.")

    # One pass over existing rows keyed by normalised handle. Rows with a blank handle (a
    # creator who signed up but never set one) must not match anything.
    existing = {}
    for row in db.query(models.Influencer).all():
        key = _normalise_handle(row.handle)
        if key:
            existing.setdefault(key, row)

    created = updated = skipped = 0
    ids = {}

    for item in incoming:
        handle = _normalise_handle(item.handle)
        if not handle or not (item.name or "").strip():
            skipped += 1
            continue

        row = existing.get(handle)
        if row:
            # Catalogue fields follow the source; user_id and status belong to the creator's
            # own account and lifecycle, so they are never overwritten by an import.
            row.name = item.name or row.name
            row.platform = item.platform or row.platform
            row.niche = item.niche or row.niche
            if item.base_rate:
                row.base_rate = item.base_rate
            if item.fit_score is not None:
                row.fit_score = item.fit_score
            if item.success_rate is not None:
                row.success_rate = item.success_rate
            updated += 1
        else:
            row = models.Influencer(
                name=item.name.strip(),
                handle=handle,
                platform=item.platform or "instagram",
                niche=item.niche,
                base_rate=item.base_rate or 0.0,
                fit_score=item.fit_score,
                success_rate=item.success_rate,
                status="available",
                # Left global rather than owned by the importing workspace: the marketplace
                # listing returns every influencer so any brand can discover them.
                workspace_id=None,
            )
            db.add(row)
            existing[handle] = row
            created += 1

    db.commit()

    for handle, row in existing.items():
        if row.id:
            ids[handle] = row.id

    return {"created": created, "updated": updated, "skipped": skipped, "ids": ids}


@router.get("/{workspace_id}/influencers/{influencer_id}/chat")
def get_chat_history(workspace_id: int, influencer_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    messages = db.query(models.ChatMessage).filter(models.ChatMessage.workspace_id == workspace_id, models.ChatMessage.influencer_id == influencer_id).order_by(models.ChatMessage.created_at.asc()).all()
    return messages

from pydantic import BaseModel
class ChatMessageCreate(BaseModel):
    content: str
    sender_type: str

class VerifyCreatorRequest(BaseModel):
    username: str
    niche: str
    base_rate: float

@router.post("/influencer/me/verify")
async def verify_creator_profile(req: VerifyCreatorRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    inf = db.query(models.Influencer).filter(models.Influencer.user_id == current_user.id).first()
    if not inf:
        # Create a new influencer profile automatically if none exists
        inf = models.Influencer(
            user_id=current_user.id,
            name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email.split('@')[0],
            niche=req.niche,
            platform="instagram",
            handle=req.username,
            fit_score=95,
            success_rate=90
        )
        db.add(inf)
        db.commit()
        db.refresh(inf)
        
    from agents.influencers import verify_instagram_profile
    result = await verify_instagram_profile(req.username, req.niche)
    
    # The details the creator typed are theirs and are saved either way. Collaborations, posts
    # and reviews are only stored when they were genuinely read from the profile: writing a
    # simulated result here is what put invented brand endorsements on a real creator's card.
    inf.handle = req.username
    inf.niche = req.niche
    inf.base_rate = req.base_rate
    if result.get("verification_status") == "verified" and not result.get("simulated"):
        inf.recent_collabs = result.get("recent_collabs", []) or []
        inf.recent_posts = result.get("recent_posts", []) or []
        inf.recent_reviews = result.get("recent_reviews", []) or []
    db.commit()
    db.refresh(inf)
        
    return {
        "status": "success",
        # Passed through so the portal can say what actually happened rather than showing a
        # verified badge for a check that never ran.
        "verification_status": result.get("verification_status", "unverified"),
        "simulated": bool(result.get("simulated")),
        "reason": result.get("reason"),
        "data": result,
        "influencer": {
            "id": inf.id,
            "name": inf.name,
            "handle": inf.handle,
            "niche": inf.niche,
            "platform": inf.platform,
            "base_rate": inf.base_rate,
            "recent_posts": inf.recent_posts or [],
            "recent_collabs": inf.recent_collabs or [],
            "recent_reviews": inf.recent_reviews or []
        }
    }


@router.post("/{workspace_id}/influencers/{influencer_id}/chat")
async def send_chat_message(workspace_id: int, influencer_id: int, msg: ChatMessageCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    
    new_msg = models.ChatMessage(
        workspace_id=workspace_id,
        influencer_id=influencer_id,
        sender_type=msg.sender_type,
        content=msg.content
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    
    from core.websocket import manager
    # Deliver only to the two participants: the workspace owner and this influencer's user.
    participant_ids = {ws.user_id}
    inf = db.query(models.Influencer).filter(models.Influencer.id == influencer_id).first()
    if inf and inf.user_id:
        participant_ids.add(inf.user_id)
    await manager.broadcast_chat_message({
        "workspace_id": workspace_id,
        "workspace_name": ws.name,
        "influencer_id": influencer_id,
        "sender_type": new_msg.sender_type,
        "content": new_msg.content,
        "created_at": new_msg.created_at.isoformat()
    }, user_ids=participant_ids)
    return new_msg

@router.get("/influencer/me", response_model=schemas.InfluencerResponse)
def get_my_influencer(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    inf = db.query(models.Influencer).filter(models.Influencer.user_id == current_user.id).first()
    if not inf:
        # follower_count/engagement_rate are not columns on Influencer, and passing them
        # raised a TypeError that surfaced as a 500 on this endpoint for every creator who
        # did not already have a row - i.e. all of them on first load. The portal caught
        # the failure silently and fell back to its hardcoded placeholder card, which is
        # why every creator appeared as the same person.
        inf = models.Influencer(
            user_id=current_user.id,
            name=f"{current_user.first_name or ''} {current_user.last_name or ''}".strip() or current_user.email.split('@')[0],
            niche="",
            platform="instagram",
            handle="",
        )
        db.add(inf)
        db.commit()
        db.refresh(inf)
    return inf

@router.post("/influencer/me/profile", response_model=schemas.InfluencerResponse)
def update_my_influencer_profile(data: schemas.InfluencerProfileUpdate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    inf = db.query(models.Influencer).filter(models.Influencer.user_id == current_user.id).first()
    if not inf:
        raise HTTPException(status_code=404, detail="Influencer profile not found")
    
    if data.recent_posts is not None:
        inf.recent_posts = data.recent_posts
    if data.recent_collabs is not None:
        inf.recent_collabs = data.recent_collabs
    if data.recent_reviews is not None:
        inf.recent_reviews = data.recent_reviews
    if data.base_rate is not None:
        inf.base_rate = data.base_rate
        
    db.commit()
    db.refresh(inf)
    return inf

@router.get("/influencer/me/chats")
def get_my_chats(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    inf = db.query(models.Influencer).filter(models.Influencer.user_id == current_user.id).first()
    if not inf:
        return []
    messages = db.query(models.ChatMessage).filter(models.ChatMessage.influencer_id == inf.id).order_by(models.ChatMessage.created_at.asc()).all()
    return [{
        "id": msg.id,
        "workspace_id": msg.workspace_id,
        "workspace_name": msg.workspace.name if msg.workspace else "Brand",
        "influencer_id": msg.influencer_id,
        "sender_type": msg.sender_type,
        "content": msg.content,
        "created_at": msg.created_at.isoformat()
    } for msg in messages]

@router.post("/influencer/me/chats/{workspace_id}")
async def send_my_chat(workspace_id: int, msg: ChatMessageCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    inf = db.query(models.Influencer).filter(models.Influencer.user_id == current_user.id).first()
    if not inf:
        raise HTTPException(status_code=404, detail="Influencer profile not found")
    
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    ws_name = ws.name if ws else "Brand"

    new_msg = models.ChatMessage(
        workspace_id=workspace_id,
        influencer_id=inf.id,
        sender_type="influencer",
        content=msg.content
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    
    from core.websocket import manager
    # Deliver only to the two participants: this influencer's user and the workspace owner.
    participant_ids = {current_user.id}
    if ws and ws.user_id:
        participant_ids.add(ws.user_id)
    await manager.broadcast_chat_message({
        "workspace_id": workspace_id,
        "workspace_name": ws_name,
        "influencer_id": inf.id,
        "sender_type": new_msg.sender_type,
        "content": new_msg.content,
        "created_at": new_msg.created_at.isoformat()
    }, user_ids=participant_ids)
    return new_msg

# Metrics endpoint
# Campaign statuses that mean the campaign was actually launched somewhere, and the subset
# of those that are running right now. models.Campaign stores these uppercase, but rows
# written by older code and by platform syncs are inconsistent, so comparisons upper() first.
_LIVE_CAMPAIGN_STATUSES = {"ACTIVE", "PUBLISHED", "PUBLISHED_DEMO"}
_LAUNCHED_CAMPAIGN_STATUSES = _LIVE_CAMPAIGN_STATUSES | {"PAUSED"}


@router.get("/{workspace_id}/metrics")
def get_workspace_metrics(workspace_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")

    campaigns = db.query(models.Campaign).filter(models.Campaign.workspace_id == workspace_id).all()
    seo_audits = db.query(models.SEOAudit).filter(models.SEOAudit.workspace_id == workspace_id).all()

    total_budget = sum(c.budget or 0 for c in campaigns)
    avg_roas = (sum(c.roas or 0 for c in campaigns) / len(campaigns)) if campaigns else 0.0
    # SEO/GEO scores are independent of campaigns. This used to sit behind an early return
    # for workspaces with no campaigns, which reported 0% SEO visibility to any workspace
    # that had run audits but never built a campaign.
    avg_seo = (sum(a.score or 0 for a in seo_audits) / len(seo_audits)) if seo_audits else 0

    # Campaign health = share of launched campaigns that are currently running. The previous
    # version counted `c.status == 'active'` - a lowercase literal no row ever holds - so
    # this tile read 0% in every workspace regardless of what was actually running.
    statuses = [(c.status or "").upper() for c in campaigns]
    launched = [s for s in statuses if s in _LAUNCHED_CAMPAIGN_STATUSES]
    live = [s for s in launched if s in _LIVE_CAMPAIGN_STATUSES]
    health = int(round(len(live) / len(launched) * 100)) if launched else 0

    return {
        "revenue": int(total_budget * avg_roas),
        "roas": round(avg_roas, 1),
        "seoVisibility": int(avg_seo),
        "aiVisibility": int(avg_seo * 0.85),
        "campaignHealth": health,
        # Counts behind the health percentage, so the dashboard can say what it is a share
        # of instead of captioning the tile "Optimal".
        "campaignsLive": len(live),
        "campaignsLaunched": len(launched),
        "growthScore": min(100, int((health + int(avg_seo) + int(avg_roas * 10)) / 3)),
    }

from pydantic import BaseModel
class AnalyticsQuery(BaseModel):
    message: str

@router.post("/{workspace_id}/analytics/query")
def query_analytics(workspace_id: int, query: AnalyticsQuery, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, tenancy.visible_workspace(current_user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    msg = query.message.lower()
    if "conversion" in msg or "drop" in msg:
        explanation = "Conversions dropped 12% on Meta Campaign cp-1. Analysis: CPA rose to $28.40 due to static creative fatigue. Suggestion: Transfer 15% budget to Google Search Ads immediately."
    elif "fatigue" in msg:
        explanation = "Creative fatigue is active on Facebook Static Adset 4. Analysis: Average frequency reached 4.8x. Suggestion: Swap Concept A headline with variant B."
    else:
        explanation = "Analytics summary compiled. Analysis: Core channels indicate high target conversions. ROAS sits strong at 4.0x. Suggestion: Scale Google Ads limits by 14%."
    return {"sender": "claude", "text": explanation}
