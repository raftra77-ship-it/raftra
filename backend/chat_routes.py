from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
import database, auth, models
from pydantic import BaseModel
from core.websocket import manager

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatMessageCreate(BaseModel):
    influencer_id: int
    content: str
    file_url: str = None

class ChatMessageResponse(BaseModel):
    id: int
    sender_type: str
    content: str
    created_at: datetime
    delivered_at: datetime = None
    read_at: datetime = None
    file_url: str = None
    
    class Config:
        from_attributes = True

@router.get("/{workspace_id}/{influencer_id}", response_model=List[ChatMessageResponse])
def get_chat_history(workspace_id: int, influencer_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Security: check if user owns workspace or is the influencer
    if current_user.role == "brand":
        ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
        if not ws:
            raise HTTPException(status_code=403, detail="Not authorized")
    elif current_user.role == "creator":
        inf = db.query(models.Influencer).filter(models.Influencer.id == influencer_id, models.Influencer.user_id == current_user.id).first()
        if not inf:
            raise HTTPException(status_code=403, detail="Not authorized")
            
    messages = db.query(models.ChatMessage).filter(
        models.ChatMessage.workspace_id == workspace_id,
        models.ChatMessage.influencer_id == influencer_id
    ).order_by(models.ChatMessage.created_at.asc()).all()
    
    return messages

@router.post("/{workspace_id}/send", response_model=ChatMessageResponse)
async def send_message(workspace_id: int, msg: ChatMessageCreate, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    # Determine sender type
    if current_user.role == "brand":
        ws = db.query(models.Workspace).filter(models.Workspace.id == workspace_id, models.Workspace.user_id == current_user.id).first()
        if not ws: raise HTTPException(status_code=403, detail="Not authorized")
        sender_type = "brand"
    else:
        inf = db.query(models.Influencer).filter(models.Influencer.id == msg.influencer_id, models.Influencer.user_id == current_user.id).first()
        if not inf: raise HTTPException(status_code=403, detail="Not authorized")
        sender_type = "influencer"
        
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
    
    # Broadcast via websocket
    await manager.broadcast_chat_message({
        "id": chat_msg.id,
        "workspace_id": workspace_id,
        "influencer_id": chat_msg.influencer_id,
        "sender_type": sender_type,
        "content": chat_msg.content,
        "file_url": chat_msg.file_url,
        "created_at": chat_msg.created_at.isoformat()
    })
    
    return chat_msg

@router.post("/read/{message_id}")
async def mark_message_read(message_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    msg = db.query(models.ChatMessage).filter(models.ChatMessage.id == message_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
        
    msg.read_at = datetime.utcnow()
    db.commit()
    
    # In a real app we would broadcast a read receipt back
    return {"status": "success"}
