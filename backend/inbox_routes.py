"""Brand <-> creator messaging, stored and delivered for real.

Both chat screens used to keep conversations in each browser's localStorage and relay frames
through an unauthenticated /ws/chat/{room} socket keyed "ws{workspace}_{handle}" - a guessable
room anyone could join. Nothing was stored, so a message sent while the other side was offline
was simply lost, and the creator inbox opened on a scripted "Demo Brand" conversation.

Here every message is a ChatMessage row, readable only by the brand's organisation and the
creator who owns the handle, and pushed live over the authenticated /ws socket.
"""
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

import auth
import database
import models
from core import tenancy
from core.chat_policy import contact_violation, policy_detail
from core.marketplace import (clean_handle, deal_json, influencer_for_handle, message_json,
                              push, thread_user_ids)

router = APIRouter(prefix="/api/inbox", tags=["inbox"])

_MAX_LEN = 4000


class SendBody(BaseModel):
    content: str
    creator_name: Optional[str] = None


def _owned_workspace(workspace_id: int, db: Session, user: models.User) -> models.Workspace:
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id,
                                           tenancy.visible_workspace(user)).first()
    if not ws:
        raise HTTPException(status_code=403, detail="Workspace access denied")
    return ws


def _checked_content(body: SendBody) -> str:
    content = (body.content or "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Write a message first.")
    if len(content) > _MAX_LEN:
        raise HTTPException(status_code=400, detail=f"Keep messages under {_MAX_LEN} characters.")
    what = contact_violation(content)
    if what:
        raise HTTPException(status_code=422, detail=policy_detail(what))
    return content


def _mark_read(db: Session, rows, from_sender: str) -> None:
    now = datetime.datetime.utcnow()
    changed = False
    for m in rows:
        if m.sender_type == from_sender and m.read_at is None:
            m.read_at = now
            changed = True
    if changed:
        db.commit()


# ------------------------------------------------------------------------------ brand side
@router.get("/brand/{workspace_id}/threads")
def brand_threads(workspace_id: int, db: Session = Depends(database.get_db),
                  current_user: models.User = Depends(auth.get_current_user)):
    """This brand's conversations, newest first, with unread creator messages counted."""
    ws = _owned_workspace(workspace_id, db, current_user)
    rows = (db.query(models.ChatMessage)
              .filter(models.ChatMessage.workspace_id == ws.id)
              .order_by(models.ChatMessage.created_at.desc()).all())
    threads: dict = {}
    for m in rows:
        t = threads.get(m.influencer_id)
        if t is None:
            t = threads[m.influencer_id] = {"influencer_id": m.influencer_id,
                                            "last_message": message_json(m, ws.name), "unread": 0}
        if m.sender_type == "influencer" and m.read_at is None:
            t["unread"] += 1
    if not threads:
        return []
    infs = {i.id: i for i in db.query(models.Influencer)
            .filter(models.Influencer.id.in_(list(threads))).all()}
    out = []
    for inf_id, t in threads.items():
        inf = infs.get(inf_id)
        if not inf or not clean_handle(inf.handle):
            continue
        out.append({**t, "handle": clean_handle(inf.handle), "name": inf.name or clean_handle(inf.handle),
                    "has_account": bool(inf.user_id)})
    return out


@router.get("/brand/{workspace_id}/creator/{handle}")
def brand_thread(workspace_id: int, handle: str, db: Session = Depends(database.get_db),
                 current_user: models.User = Depends(auth.get_current_user)):
    """One conversation with a creator, plus every direct deal between them. Opening it marks the
    creator's messages read."""
    ws = _owned_workspace(workspace_id, db, current_user)
    h = clean_handle(handle)
    if not h:
        raise HTTPException(status_code=400, detail="A creator handle is required.")
    inf = influencer_for_handle(db, h)
    messages = []
    if inf:
        rows = (db.query(models.ChatMessage)
                  .filter(models.ChatMessage.workspace_id == ws.id,
                          models.ChatMessage.influencer_id == inf.id)
                  .order_by(models.ChatMessage.created_at.asc()).all())
        _mark_read(db, rows, "influencer")
        messages = [message_json(m, ws.name) for m in rows]
    deals = (db.query(models.InfluencerDeal)
               .filter(models.InfluencerDeal.workspace_id == ws.id,
                       models.InfluencerDeal.influencer_handle == h)
               .order_by(models.InfluencerDeal.created_at.desc()).all())
    return {
        "creator": {"handle": h, "name": (inf.name if inf else None) or h,
                    "influencer_id": inf.id if inf else None,
                    "has_account": bool(inf and inf.user_id)},
        "messages": messages,
        "deals": [deal_json(d) for d in deals],
    }


@router.post("/brand/{workspace_id}/creator/{handle}")
async def brand_send(workspace_id: int, handle: str, body: SendBody,
                     db: Session = Depends(database.get_db),
                     current_user: models.User = Depends(auth.get_current_user)):
    ws = _owned_workspace(workspace_id, db, current_user)
    content = _checked_content(body)
    inf = influencer_for_handle(db, handle, body.creator_name, create=True)
    if inf is None:
        raise HTTPException(status_code=400, detail="A creator handle is required.")
    m = models.ChatMessage(workspace_id=ws.id, influencer_id=inf.id, sender_type="brand",
                           content=content, delivered_at=datetime.datetime.utcnow())
    db.add(m)
    db.commit()
    db.refresh(m)
    out = message_json(m, ws.name)
    await push(thread_user_ids(db, ws, inf), {"type": "chat_message", "message": out})
    return out


# ---------------------------------------------------------------------------- creator side
def _me(db: Session, user: models.User):
    infs = db.query(models.Influencer).filter(models.Influencer.user_id == user.id).all()
    return infs, [i.id for i in infs], {clean_handle(i.handle) for i in infs if clean_handle(i.handle)}


def _creator_may_contact(db: Session, workspace_id: int, ids, handles) -> bool:
    """A creator can talk to a brand that has talked to them, proposed to them, or whose brief
    they applied to - not message any workspace on the platform by id."""
    if ids and db.query(models.ChatMessage.id).filter(
            models.ChatMessage.workspace_id == workspace_id,
            models.ChatMessage.influencer_id.in_(ids)).first():
        return True
    if handles and db.query(models.InfluencerDeal.id).filter(
            models.InfluencerDeal.workspace_id == workspace_id,
            models.InfluencerDeal.influencer_handle.in_(list(handles))).first():
        return True
    if handles and db.query(models.DealApplication.id).filter(
            models.DealApplication.workspace_id == workspace_id,
            models.DealApplication.creator_handle.in_(list(handles))).first():
        return True
    return False


@router.get("/creator/threads")
def creator_threads(db: Session = Depends(database.get_db),
                    current_user: models.User = Depends(auth.get_current_user)):
    infs, ids, handles = _me(db, current_user)
    threads: dict = {}

    if ids:
        rows = (db.query(models.ChatMessage)
                  .filter(models.ChatMessage.influencer_id.in_(ids))
                  .order_by(models.ChatMessage.created_at.desc()).all())
        for m in rows:
            t = threads.get(m.workspace_id)
            if t is None:
                t = threads[m.workspace_id] = {"workspace_id": m.workspace_id,
                                               "last_message": message_json(m), "unread": 0}
            if m.sender_type == "brand" and m.read_at is None:
                t["unread"] += 1

    pending: dict = {}
    if handles:
        for d in db.query(models.InfluencerDeal).filter(
                models.InfluencerDeal.influencer_handle.in_(list(handles))).all():
            threads.setdefault(d.workspace_id, {"workspace_id": d.workspace_id,
                                                "last_message": None, "unread": 0})
            if d.status == "pending":
                pending[d.workspace_id] = pending.get(d.workspace_id, 0) + 1
        # Brands whose brief this creator applied to, so the conversation can be started.
        for (ws_id,) in db.query(models.DealApplication.workspace_id).filter(
                models.DealApplication.creator_handle.in_(list(handles)),
                models.DealApplication.workspace_id.isnot(None)).distinct().all():
            threads.setdefault(ws_id, {"workspace_id": ws_id, "last_message": None, "unread": 0})

    if not threads:
        return []
    workspaces = {w.id: w for w in db.query(models.Workspace)
                  .filter(models.Workspace.id.in_(list(threads))).all()}
    out = []
    for ws_id, t in threads.items():
        w = workspaces.get(ws_id)
        if not w:
            continue
        out.append({**t, "brand_name": w.name, "brand_logo": w.brand_logo,
                    "pending_deals": pending.get(ws_id, 0)})
    out.sort(key=lambda t: (t["last_message"] or {}).get("created_at") or "", reverse=True)
    return out


@router.get("/creator/{workspace_id}")
def creator_thread(workspace_id: int, db: Session = Depends(database.get_db),
                   current_user: models.User = Depends(auth.get_current_user)):
    infs, ids, handles = _me(db, current_user)
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    # 404 rather than 403 for a brand this creator has no relationship with, so the route does
    # not confirm which workspace ids exist.
    if not ws or not _creator_may_contact(db, workspace_id, ids, handles):
        raise HTTPException(status_code=404, detail="Conversation not found")
    rows = []
    if ids:
        rows = (db.query(models.ChatMessage)
                  .filter(models.ChatMessage.workspace_id == ws.id,
                          models.ChatMessage.influencer_id.in_(ids))
                  .order_by(models.ChatMessage.created_at.asc()).all())
        _mark_read(db, rows, "brand")
    deals = []
    if handles:
        deals = (db.query(models.InfluencerDeal)
                   .filter(models.InfluencerDeal.workspace_id == ws.id,
                           models.InfluencerDeal.influencer_handle.in_(list(handles)))
                   .order_by(models.InfluencerDeal.created_at.desc()).all())
    return {
        "brand": {"workspace_id": ws.id, "name": ws.name, "logo": ws.brand_logo},
        "messages": [message_json(m, ws.name) for m in rows],
        "deals": [deal_json(d) for d in deals],
        "can_message": bool(handles),
    }


@router.post("/creator/{workspace_id}")
async def creator_send(workspace_id: int, body: SendBody, db: Session = Depends(database.get_db),
                       current_user: models.User = Depends(auth.get_current_user)):
    infs, ids, handles = _me(db, current_user)
    if not handles:
        raise HTTPException(status_code=409,
                            detail="Add your Instagram handle in Profile Setup before messaging brands.")
    ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if not ws or not _creator_may_contact(db, workspace_id, ids, handles):
        raise HTTPException(status_code=404, detail="Conversation not found")
    content = _checked_content(body)
    inf = next(i for i in infs if clean_handle(i.handle))
    m = models.ChatMessage(workspace_id=ws.id, influencer_id=inf.id, sender_type="influencer",
                           content=content, delivered_at=datetime.datetime.utcnow())
    db.add(m)
    db.commit()
    db.refresh(m)
    out = message_json(m, ws.name)
    await push(thread_user_ids(db, ws, inf), {"type": "chat_message", "message": out})
    return out
