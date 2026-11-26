"""Admin console API.

The admin page called /api/auth/users, which does not exist, and its "Add User" button only
appended a row to local state - so the page showed an empty user list and a user that was never
created. Everything here requires role == "admin". Nothing in the app grants that role; it is
set deliberately with backend/scripts/grant_admin.py by someone with server access.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
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


# ------------------------------------------------------------ specialist package prices

class SpecialistPriceBody(BaseModel):
    price_label: str
    base_price: Optional[int] = None


@router.put("/specialist-packages/{slug}")
def set_specialist_price(slug: str, body: SpecialistPriceBody,
                         db: Session = Depends(database.get_db),
                         current_user: models.User = Depends(auth.get_current_user)):
    """Set what a Social Hub specialist package is quoted at, without a deploy.

    Admin only: this is what prospects are told a service costs. Upserts by slug, so the
    same call creates the override or changes it.
    """
    require_admin(current_user)
    label = (body.price_label or "").strip()
    if not label:
        raise HTTPException(status_code=400, detail="price_label is required.")

    row = (db.query(models.SpecialistPackagePrice)
             .filter(models.SpecialistPackagePrice.slug == slug).first())
    if row is None:
        row = models.SpecialistPackagePrice(slug=slug)
        db.add(row)
    row.price_label = label
    row.base_price = body.base_price
    db.commit()
    db.refresh(row)
    return {"success": True, "package": {"slug": row.slug, "price_label": row.price_label,
                                         "base_price": row.base_price}}


@router.delete("/specialist-packages/{slug}")
def clear_specialist_price(slug: str, db: Session = Depends(database.get_db),
                           current_user: models.User = Depends(auth.get_current_user)):
    """Drop an override, so the package goes back to the figure built into the page."""
    require_admin(current_user)
    row = (db.query(models.SpecialistPackagePrice)
             .filter(models.SpecialistPackagePrice.slug == slug).first())
    if row is None:
        raise HTTPException(status_code=404, detail="No override set for that package.")
    db.delete(row)
    db.commit()
    return {"success": True, "cleared": slug}
