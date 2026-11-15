from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import database, auth, models
from pydantic import BaseModel
from core.websocket import manager
from core import tenancy

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatMessageCreate(BaseModel):
    influencer_id: int
    content: str
    file_url: str = None

class ChatMessageResponse(BaseModel):
    """The wire shape of one message.

    Every nullable column is Optional, which it was not. `read_at: datetime = None`
    annotates the type as datetime and merely defaults to None - Pydantic v2 validates the
    value it is actually given, so a row with read_at NULL raised ResponseValidationError
    and the endpoint answered 500. Unread is the normal state of a message, and file_url is
    NULL on every message without an attachment, so GET /api/chat/{ws}/{influencer} failed
    for brands and creators alike, independently of any permission problem. created_at is
    optional for the same reason: the column is nullable in the database.
    """
    id: int
    sender_type: Optional[str] = None
    content: Optional[str] = None
    created_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    read_at: Optional[datetime] = None
    file_url: Optional[str] = None

    class Config:
        from_attributes = True

def _authorise_conversation(db: Session, user: models.User, workspace_id: int,
                            influencer_id: int) -> str:
    """Who is this caller in this one conversation, or 403.

    A conversation is the pair (workspace_id, influencer_id). Exactly two parties may see
    it: the brand side that owns the workspace, and the creator who owns that influencer
    profile. Returns the caller's sender_type; "admin" may read but is not a participant
    and must never be able to speak as either side.

    Written as a single function with no fall-through because the previous version was an
    `if role == "brand" / elif role == "creator"` with no `else`: a caller whose role was
    neither - an admin, or any role added later - skipped both checks and read the
    conversation unconditionally. Deny is now the default, and every branch is explicit.
    """
    if user.role == "brand":
        ws = db.query(models.Workspace).filter(
            models.Workspace.id == workspace_id,
            tenancy.visible_workspace(user)).first()
        if ws:
            return "brand"
    elif user.role == "creator":
        inf = db.query(models.Influencer).filter(
            models.Influencer.id == influencer_id,
            models.Influencer.user_id == user.id).first()
        if inf:
            return "influencer"
    elif user.role == "admin":
        return "admin"
    raise HTTPException(status_code=403, detail="Not authorized")


@router.get("/{workspace_id}/{influencer_id}", response_model=List[ChatMessageResponse])
def get_chat_history(workspace_id: int, influencer_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    _authorise_conversation(db, current_user, workspace_id, influencer_id)

    messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.workspace_id == workspace_id,
        models.ChatMessage.influencer_id == influencer_id
    ).order_by(models.ChatMessage.created_at.asc()).all()
    
    return messages

@router.post("/{workspace_id}/send", response_model=ChatMessageResponse)
async def send_message(workspace_id: int, msg: ChatMessageCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # The same authorisation the history endpoint uses, so the two can never disagree.
    # The previous version's `else` treated every non-brand role as the creator, which
    # meant an admin posting a message was recorded as the influencer having said it.
    sender_type = _authorise_conversation(db, current_user, workspace_id,
                                          msg.influencer_id)
    if sender_type == "admin":
        raise HTTPException(status_code=403,
                            detail="An administrator cannot post as a participant.")


    chat_msg = models.ChatMessage(
        workspace_id=workspace_id,
        influencer_id=msg.influencer_id,
        sender_type=sender_type,
        content=msg.content,
        file_url=msg.file_url,
        delivered_at=datetime.utcnow() # Assume delivered to server
    )
    db.add(chat_msg)
    db.commit()
    db.refresh(chat_msg)

    # Deliver only to the two participants: the workspace's owning brand user and
    # the creator who owns this influencer. Never broadcast a private chat to all.
    participant_ids = set()
    ws_owner = db.query(models.Workspace).filter(models.Workspace.id == workspace_id).first()
    if ws_owner:
        participant_ids.add(ws_owner.user_id)
    inf = db.query(models.Influencer).filter(models.Influencer.id == msg.influencer_id).first()
    if inf and inf.user_id:
        participant_ids.add(inf.user_id)

    await manager.broadcast_chat_message({
        "id": chat_msg.id,
        "workspace_id": workspace_id,
        "influencer_id": chat_msg.influencer_id,
        "sender_type": sender_type,
        "content": chat_msg.content,
        "file_url": chat_msg.file_url,
        "created_at": chat_msg.created_at.isoformat()
    }, user_ids=participant_ids)

    return chat_msg

@router.post("/read/{message_id}")
async def mark_message_read(message_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    """Mark one message read. Only a participant in its conversation may do so.

    This had no authorisation of any kind: it loaded the message by id and wrote read_at,
    so any signed-in account could stamp a read receipt on any message in the system and,
    by the 404-versus-200 difference, enumerate which message ids exist. The conversation
    check below is the same one the other two endpoints use.
    """
    msg = db.query(models.ChatMessage).filter(models.ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")

    role_here = _authorise_conversation(db, current_user, msg.workspace_id,
                                        msg.influencer_id)
    if role_here == "admin":
        raise HTTPException(status_code=403,
                            detail="An administrator cannot mark a message read.")

    msg.read_at = datetime.utcnow()
    db.commit()
    
    # In a real app we would broadcast a read receipt back
    return {"status": "success"}
