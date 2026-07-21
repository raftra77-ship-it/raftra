from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List
import database, auth, models
from pydantic import BaseModel
from core.websocket import manager

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    type: str
    read: bool
    created_at: datetime
    action_url: str = None
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[NotificationResponse])
def get_notifications(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    notifications = db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id
    ).order_by(models.Notification.created_at.desc()).limit(50).all()
    return notifications

@router.post("/read/{notification_id}")
def mark_read(notification_id: int, db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    notif = db.query(models.Notification).filter(
        models.Notification.id == notification_id,
        models.Notification.user_id == current_user.id
    ).first()
    
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
        
    notif.read = True
    db.commit()
    return {"status": "success"}

@router.post("/read-all")
def mark_all_read(db: Session = Depends(database.get_db), current_user: models.User = Depends(auth.get_current_user)):
    db.query(models.Notification).filter(
        models.Notification.user_id == current_user.id,
        models.Notification.read == False
    ).update({"read": True})
    db.commit()
    return {"status": "success"}

async def create_and_dispatch_notification(db: Session, user_id: int, title: str, message: str, type: str, action_url: str = None):
    new_notif = models.Notification(
        user_id=user_id,
        title=title,
        message=message,
        type=type,
        action_url=action_url
    )
    db.add(new_notif)
    db.commit()
    db.refresh(new_notif)
    
    # Deliver only to the user the notification belongs to.
    await manager.broadcast_notification({
        "id": new_notif.id,
        "title": new_notif.title,
        "message": new_notif.message,
        "type": new_notif.type,
        "created_at": new_notif.created_at.isoformat(),
        "action_url": new_notif.action_url
    }, user_id=user_id)
    return new_notif
