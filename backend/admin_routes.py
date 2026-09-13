"""Admin console API.

The admin page called /api/auth/users, which does not exist, and its "Add User" button only
appended a row to local state - so the page showed an empty user list and a user that was never
created. Everything here requires role == "admin". Nothing in the app grants that role; it is
set deliberately with backend/scripts/grant_admin.py by someone with server access.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

import auth
import database
import models

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_admin(user: models.User) -> None:
    if (user.role or "") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required.")


@router.get("/me")
def admin_me(current_user: models.User = Depends(auth.get_current_user)):
    return {"is_admin": (current_user.role or "") == "admin", "email": current_user.email}


@router.get("/users")
def list_users(db: Session = Depends(database.get_db),
               current_user: models.User = Depends(auth.get_current_user)):
    require_admin(current_user)
    rows = db.query(models.User).order_by(models.User.id.desc()).all()
    return [{
        "id": u.id,
        "email": u.email,
        "name": " ".join(filter(None, [u.first_name, u.last_name])) or None,
        "role": u.role,
        "is_active": bool(u.is_active),
        "payment_status": u.payment_status,
    } for u in rows]


@router.get("/summary")
def summary(db: Session = Depends(database.get_db),
            current_user: models.User = Depends(auth.get_current_user)):
    require_admin(current_user)

    def counts(column):
        return {k or "unknown": n for k, n in db.query(column, func.count()).group_by(column).all()}

    return {
        "users_by_role": counts(models.User.role),
        "payouts_by_status": counts(models.CreatorPayoutRequest.status),
        "direct_deals_by_status": counts(models.InfluencerDeal.status),
        "posted_deals_by_status": counts(models.PostedDeal.status),
        "collab_payment_requests": db.query(func.count(models.DealApplication.id))
                                     .filter(models.DealApplication.cashout_requested.is_(True)).scalar() or 0,
    }
