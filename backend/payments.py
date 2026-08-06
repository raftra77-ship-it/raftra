import razorpay
import os
import logging
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
import jwt

import auth, database, models, schemas

logger = logging.getLogger("raftra.payments")

router = APIRouter(prefix="/api/payments", tags=["payments"])

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "test_key")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "test_secret")

# Initialize Razorpay Client
client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

SUBSCRIPTION_PRICE_INR = 2000.0

# billing_balance is tracked in USD-equivalent credits (see BrandDashboard.tsx), but
# Razorpay always charges in INR. This must match the $1 = ₹83 rate hardcoded on the
# frontend (BrandDashboard.tsx), which is what amount_inr was derived from.
USD_TO_INR_RATE = 83


def get_optional_user(token: str = Depends(auth.oauth2_scheme), db: Session = Depends(database.get_db)):
    """Same as auth.get_current_user, but returns None instead of raising when
    no token is present (the /pricing checkout page is reachable while logged out)."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            return None
    except Exception:
        return None
    return db.query(models.User).filter(models.User.id == int(user_id)).first()


class CreateOrderRequest(BaseModel):
    purpose: str = "subscription"  # "subscription" | "topup"
    amount_inr: Optional[float] = None  # required for topup; ignored for subscription
    email: Optional[str] = None  # used only when the caller isn't authenticated


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    email: Optional[str] = None


@router.post("/create-order")
def create_order(
    payload: CreateOrderRequest,
    db: Session = Depends(database.get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    user = current_user
    if user is None:
        if not payload.email:
            raise HTTPException(status_code=401, detail="Authentication required")
        user = db.query(models.User).filter(models.User.email == payload.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

    if payload.purpose == "topup":
        if not payload.amount_inr or payload.amount_inr <= 0:
            raise HTTPException(status_code=400, detail="amount_inr is required for topup orders")
        amount_rupees = payload.amount_inr
    else:
        amount_rupees = SUBSCRIPTION_PRICE_INR

    order_amount_paise = int(round(amount_rupees * 100))

    try:
        order = client.order.create(dict(
            amount=order_amount_paise,
            currency="INR",
            receipt=f"{payload.purpose}_{user.id}_{int(datetime.utcnow().timestamp())}",
            payment_capture=1,
            notes={"purpose": payload.purpose, "user_id": str(user.id)},
        ))
    except Exception as e:
        logger.error(f"Razorpay order creation failed for user {user.id}: {e}")
        raise HTTPException(status_code=502, detail="Unable to start payment. Please try again.")

    # Persist the order server-side (amount + purpose) so verify-payment can trust
    # what was actually charged instead of whatever the client claims afterwards.
    tx = models.Transaction(
        amount=amount_rupees,
        currency="inr",
        purpose=payload.purpose,
        razorpay_order_id=order["id"],
        status="created",
        owner_id=user.id,
    )
    db.add(tx)
    db.commit()

    return {"id": order["id"], "amount": order["amount"], "currency": order["currency"]}


@router.post("/verify-payment")
def verify_payment(payload: VerifyPaymentRequest, db: Session = Depends(database.get_db)):
    tx = db.query(models.Transaction).filter(
        models.Transaction.razorpay_order_id == payload.razorpay_order_id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Order not found")

    if tx.status == "paid":
        # Already processed — respond the same way so a duplicate client call is harmless.
        user = tx.owner
        return {"status": "success", "balance": user.billing_balance, "payment_status": user.payment_status}

    try:
        client.utility.verify_payment_signature({
            'razorpay_order_id': payload.razorpay_order_id,
            'razorpay_payment_id': payload.razorpay_payment_id,
            'razorpay_signature': payload.razorpay_signature,
        })
    except Exception as e:
        logger.warning(f"Razorpay signature verification failed for order {payload.razorpay_order_id}: {e}")
        tx.status = "failed"
        db.commit()
        raise HTTPException(status_code=400, detail="Payment verification failed")

    user = tx.owner
    tx.razorpay_payment_id = payload.razorpay_payment_id
    tx.status = "paid"

    if tx.purpose == "topup":
        user.billing_balance += tx.amount / USD_TO_INR_RATE
    else:
        user.payment_status = "paid"

    db.commit()
    db.refresh(user)

    logger.info(f"Payment verified for user {user.id}: purpose={tx.purpose} amount={tx.amount}")

    return {"status": "success", "balance": user.billing_balance, "payment_status": user.payment_status}


@router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(database.get_db)):
    # Verify signature
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "test_secret")
    webhook_signature = request.headers.get("X-Razorpay-Signature")
    payload = await request.body()

    try:
        client.utility.verify_webhook_signature(payload.decode('utf-8'), webhook_signature, webhook_secret)
    except Exception as e:
        logger.warning(f"Razorpay webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    data = await request.json()
    event = data.get("event")

    # Handle subscription events
    if event == "subscription.charged":
        sub_id = data['payload']['subscription']['entity']['id']
        sub = db.query(models.Subscription).filter(models.Subscription.razorpay_subscription_id == sub_id).first()
        if sub:
            sub.status = "active"
            sub.current_period_end = datetime.fromtimestamp(data['payload']['subscription']['entity']['current_end'])
            # Reset usage limits
            sub.usage_campaigns = 0
            sub.usage_ai_generations = 0
            db.commit()
    elif event == "subscription.halted" or event == "subscription.cancelled":
        sub_id = data['payload']['subscription']['entity']['id']
        sub = db.query(models.Subscription).filter(models.Subscription.razorpay_subscription_id == sub_id).first()
        if sub:
            sub.status = "canceled"
            db.commit()

    return {"status": "success"}
