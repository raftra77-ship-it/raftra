"""Shared pieces of the brand <-> creator marketplace.

Who a handle is, who sits on each side of a conversation, how a deal is described, and how
both sides are told that something changed. Kept in core/ because inbox_routes and
influencer_deal_routes both need it and neither should import the other.

Identity rule: a creator is their handle. A brand can message or propose to a handle before
that creator has a Raftra account; the conversation is stored against a marketplace
Influencer row for the handle, and moves to the creator's own row when they claim the handle
(workspace_routes.verify_creator_profile).
"""
import datetime
import json
from typing import Optional, Set, Tuple

from sqlalchemy import func

import models


def clean_handle(value) -> str:
    return (value or "").replace("@", "").strip().lower()


def iso(dt) -> Optional[str]:
    return dt.isoformat() if dt else None


def influencer_for_handle(db, handle, name: Optional[str] = None, create: bool = False):
    """The Influencer row that stands for a handle.

    Prefers the row a creator account has claimed, then any marketplace row with that handle,
    and - only when asked - creates an unclaimed row so a brand can reach a creator who has not
    signed up yet.
    """
    h = clean_handle(handle)
    if not h:
        return None
    rows = (db.query(models.Influencer)
              .filter(func.lower(func.replace(models.Influencer.handle, "@", "")) == h)
              .order_by(models.Influencer.id).all())
    claimed = [r for r in rows if r.user_id]
    if claimed:
        return claimed[0]
    if rows:
        return rows[0]
    if not create:
        return None
    inf = models.Influencer(name=(name or h), handle=h, platform="instagram", niche="",
                            status="available")
    db.add(inf)
    db.flush()
    return inf


def brand_user_ids(db, workspace) -> Set[int]:
    """Everyone who works on this brand: the owner and every member of its organisation. A
    reply sent to the owner only would never reach a colleague handling the creator."""
    ids: Set[int] = set()
    if workspace is None:
        return ids
    if workspace.user_id:
        ids.add(workspace.user_id)
    if getattr(workspace, "tenant_id", None):
        ids.update(r[0] for r in db.query(models.TenantMember.user_id)
                   .filter(models.TenantMember.tenant_id == workspace.tenant_id).all())
    return ids


def thread_user_ids(db, workspace, influencer) -> Set[int]:
    ids = brand_user_ids(db, workspace)
    if influencer is not None and influencer.user_id:
        ids.add(influencer.user_id)
    return ids


def message_json(m, workspace_name: Optional[str] = None) -> dict:
    return {
        "id": m.id,
        "workspace_id": m.workspace_id,
        "workspace_name": workspace_name,
        "influencer_id": m.influencer_id,
        "sender_type": m.sender_type,
        "content": m.content,
        "created_at": iso(m.created_at),
        "read_at": iso(m.read_at),
    }


def deal_json(d) -> dict:
    """Only ever returned to the two parties of the deal, so the verification code is included:
    the brand issued it and the creator needs it to request payment."""
    return {
        "id": d.id,
        "workspace_id": d.workspace_id,
        "brand_name": d.brand_name,
        "influencer_handle": d.influencer_handle,
        "influencer_name": d.influencer_name,
        "amount": d.amount,
        "deliverables": d.deliverables,
        "status": d.status,
        "created_at": iso(d.created_at),
        "brand_released_at": iso(d.brand_released_at),
        "paid_at": iso(d.paid_at),
        "verification_token": d.brand_release_token if d.status in ("delivered", "paid") else None,
    }


def record_deal_event(db, deal, event: str) -> Tuple["models.ChatMessage", "models.Influencer"]:
    """Put a deal change into the conversation as a system message, so the thread is the one
    place both sides read what was proposed, accepted, approved or paid."""
    inf = influencer_for_handle(db, deal.influencer_handle, deal.influencer_name, create=True)
    msg = models.ChatMessage(
        workspace_id=deal.workspace_id,
        influencer_id=inf.id,
        sender_type="system",
        content=json.dumps({"type": "deal_event", "event": event, "deal_id": deal.id,
                            "amount": deal.amount, "deliverables": deal.deliverables}),
        delivered_at=datetime.datetime.utcnow(),
    )
    db.add(msg)
    db.flush()
    return msg, inf


async def push(user_ids, payload: dict) -> None:
    """Deliver an event over the authenticated /ws socket to exactly these users."""
    from core.websocket import manager
    ids = {i for i in (user_ids or set()) if i}
    if ids:
        await manager.send_to_users(json.dumps(payload, default=str), ids)


async def announce_deal(db, deal, message=None, influencer=None) -> None:
    ws = db.query(models.Workspace).filter(models.Workspace.id == deal.workspace_id).first()
    inf = influencer or influencer_for_handle(db, deal.influencer_handle)
    ids = thread_user_ids(db, ws, inf)
    if message is not None:
        await push(ids, {"type": "chat_message", "message": message_json(message, ws.name if ws else None)})
    await push(ids, {"type": "deal_update", "deal": deal_json(deal)})
