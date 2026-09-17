"""Razorpay payments: Pro subscription checkout and credit top-ups.

Flow: POST /create-order records a Transaction (amount and purpose decided HERE, never by
the client) -> Razorpay Checkout in the browser -> POST /verify-payment checks the signature
and applies the purchase. The `payment.captured` / `order.paid` webhooks apply the same
purchase independently, so a customer who pays and closes the tab before the browser calls
verify-payment is still credited.

Production rules this module enforces:
* No default keys or secrets. A missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET answers 503
  ("payments are not configured") instead of calling Razorpay with placeholder credentials,
  and a missing RAZORPAY_WEBHOOK_SECRET refuses webhooks - with a guessable default secret,
  anyone could sign a forged event.
* Applying a purchase is idempotent (one conditional UPDATE), so verify-payment and the webhook (or two
  verify calls) racing on one order credit it exactly once.
* The public key id the browser opens Checkout with comes from this server, so the frontend
  can never pair a test key with a live secret or the other way round.
"""
import json
import logging
import os
from datetime import datetime
from typing import Optional

import jwt
import razorpay
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

import auth, database, models

logger = logging.getLogger("raftra.payments")

router = APIRouter(prefix="/api/payments", tags=["payments"])

SUBSCRIPTION_PRICE_INR = float(os.getenv("SUBSCRIPTION_PRICE_INR", "2000"))

# billing_balance is tracked in USD-equivalent credits (see BrandDashboard.tsx), but
# Razorpay always charges in INR. This must match the $1 = ₹83 rate hardcoded on the
# frontend (BrandDashboard.tsx), which is what amount_inr was derived from.
USD_TO_INR_RATE = 83

# Razorpay's own minimum is ₹1. The maximum is ours: a typo'd or tampered amount should be
# refused here, not discovered on a card statement.
MIN_TOPUP_INR = 1.0
MAX_TOPUP_INR = float(os.getenv("MAX_TOPUP_INR", "500000"))

_PLACEHOLDERS = {"", "test_key", "test_secret", "rzp_test_placeholder"}


def _keys():
    key_id = (os.getenv("RAZORPAY_KEY_ID") or "").strip()
    secret = (os.getenv("RAZORPAY_KEY_SECRET") or "").strip()
    if key_id in _PLACEHOLDERS or secret in _PLACEHOLDERS:
        return None, None
    return key_id, secret


def _client() -> razorpay.Client:
    key_id, secret = _keys()
    if not key_id:
        raise HTTPException(status_code=503,
                            detail="Payments are not configured on the server. Please contact support.")
    return razorpay.Client(auth=(key_id, secret))


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


def _apply_paid(db: Session, order_id: str, payment_id: Optional[str], source: str) -> Optional[models.Transaction]:
    """Mark the order paid and grant what was bought - once.

    verify-payment and the webhook routinely arrive together for one order, and Razorpay can
    deliver a webhook more than once. A read-then-write check lets two of them both see
    "created" and both grant the credit. Instead the status flip is one conditional UPDATE:
    the database lets exactly one caller change "created"/"failed" to "paid", and only that
    caller grants. The balance is incremented in SQL for the same reason. Returns the
    transaction (paid either now or earlier), or None if the order is unknown.
    """
    tx = (db.query(models.Transaction)
            .filter(models.Transaction.razorpay_order_id == order_id).first())
    if not tx:
        return None

    won = (db.query(models.Transaction)
             .filter(models.Transaction.id == tx.id, models.Transaction.status != "paid")
             .update({models.Transaction.status: "paid"}, synchronize_session=False))
    if not won:
        db.commit()
        db.refresh(tx)
        return tx

    if payment_id:
        (db.query(models.Transaction)
           .filter(models.Transaction.id == tx.id, models.Transaction.razorpay_payment_id.is_(None))
           .update({models.Transaction.razorpay_payment_id: payment_id}, synchronize_session=False))
    if tx.purpose == "topup":
        (db.query(models.User).filter(models.User.id == tx.owner_id)
           .update({models.User.billing_balance:
                    func.coalesce(models.User.billing_balance, 0) + tx.amount / USD_TO_INR_RATE},
                   synchronize_session=False))
    else:
        (db.query(models.User).filter(models.User.id == tx.owner_id)
           .update({models.User.payment_status: "paid"}, synchronize_session=False))
    db.commit()
    db.refresh(tx)
    logger.info("Payment applied via %s: order=%s user=%s purpose=%s amount=%s",
                source, order_id, tx.owner_id, tx.purpose, tx.amount)
    return tx


@router.get("/config")
def payments_config():
    """Whether checkout can run, and the public key id to open it with."""
    key_id, _ = _keys()
    return {"enabled": bool(key_id), "key_id": key_id or None,
            "mode": ("live" if key_id.startswith("rzp_live_") else "test") if key_id else None}


@router.post("/create-order")
def create_order(
    payload: CreateOrderRequest,
    db: Session = Depends(database.get_db),
    current_user: Optional[models.User] = Depends(get_optional_user),
):
    client = _client()
    key_id, _ = _keys()

    if payload.purpose not in ("subscription", "topup"):
        raise HTTPException(status_code=400, detail="Unknown payment purpose.")

    user = current_user
    if user is None:
        # The logged-out pricing page can buy the subscription for an existing account by
        # email. Top-ups change a balance, so they require the account to be signed in.
        if payload.purpose != "subscription" or not payload.email:
            raise HTTPException(status_code=401, detail="Please sign in to continue.")
        user = (db.query(models.User)
                  .filter(models.User.email == payload.email.strip().lower()).first())
        if not user:
            raise HTTPException(status_code=404, detail="No account found for that email.")

    if payload.purpose == "topup":
        amount_rupees = round(float(payload.amount_inr or 0), 2)
        if not (MIN_TOPUP_INR <= amount_rupees <= MAX_TOPUP_INR):
            raise HTTPException(status_code=400,
                                detail=f"Top-up amount must be between ₹{MIN_TOPUP_INR:,.0f} and ₹{MAX_TOPUP_INR:,.0f}.")
    else:
        amount_rupees = SUBSCRIPTION_PRICE_INR

    order_amount_paise = int(round(amount_rupees * 100))

    try:
        order = client.order.create(dict(
            amount=order_amount_paise,
            currency="INR",
            # Razorpay caps receipt at 40 characters.
            receipt=f"{payload.purpose[:3]}_{user.id}_{int(datetime.utcnow().timestamp())}"[:40],
            payment_capture=1,
            notes={"purpose": payload.purpose, "user_id": str(user.id)},
        ))
    except Exception as e:
        # print as well as log: this logger has no handler configured, so the reason for a
        # failed checkout never reached the server output - which is how revoked keys went
        # unnoticed.
        print(f"[payments] Razorpay order creation failed for user {user.id}: {e}")
        logger.error(f"Razorpay order creation failed for user {user.id}: {e}")
        if "authentication failed" in str(e).lower():
            # Our credentials are wrong, not the customer's card: retrying cannot help.
            raise HTTPException(status_code=503,
                                detail="Payments are temporarily unavailable. Please contact support.")
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

    return {"id": order["id"], "amount": order["amount"], "currency": order["currency"],
            # The browser opens Checkout with this key, so key and secret are always a pair.
            "key_id": key_id}


@router.post("/verify-payment")
def verify_payment(payload: VerifyPaymentRequest, db: Session = Depends(database.get_db)):
    client = _client()
    tx = db.query(models.Transaction).filter(
        models.Transaction.razorpay_order_id == payload.razorpay_order_id
    ).first()
    if not tx:
        raise HTTPException(status_code=404, detail="Order not found")

    try:
        client.utility.verify_payment_signature({
            'razorpay_order_id': payload.razorpay_order_id,
            'razorpay_payment_id': payload.razorpay_payment_id,
            'razorpay_signature': payload.razorpay_signature,
        })
    except Exception as e:
        print(f"[payments] signature verification failed for order {payload.razorpay_order_id}: {e}")
        logger.warning(f"Razorpay signature verification failed for order {payload.razorpay_order_id}: {e}")
        # Not marked failed: an invalid signature proves nothing about the real payment, and
        # anyone holding the order id could otherwise flip a genuine order to "failed".
        raise HTTPException(status_code=400, detail="Payment verification failed")

    tx = _apply_paid(db, payload.razorpay_order_id, payload.razorpay_payment_id, "verify-payment")
    user = tx.owner
    db.refresh(user)
    return {"status": "success", "balance": user.billing_balance, "payment_status": user.payment_status}


@router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(database.get_db)):
    webhook_secret = (os.getenv("RAZORPAY_WEBHOOK_SECRET") or "").strip()
    if webhook_secret in _PLACEHOLDERS:
        # Refuse rather than verify against a guessable secret. Razorpay retries non-2xx
        # deliveries, so events are not lost while this is being configured.
        logger.error("Razorpay webhook received but RAZORPAY_WEBHOOK_SECRET is not set.")
        raise HTTPException(status_code=503, detail="Webhook not configured")

    body = await request.body()
    signature = request.headers.get("X-Razorpay-Signature") or ""
    try:
        razorpay.Utility(None).verify_webhook_signature(body.decode("utf-8"), signature, webhook_secret)
    except Exception as e:
        logger.warning(f"Razorpay webhook signature verification failed: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        data = json.loads(body)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    event = data.get("event") or ""
    entity = lambda kind: (((data.get("payload") or {}).get(kind) or {}).get("entity") or {})

    # From here on, a malformed or unrelated event is acknowledged with 200. A 5xx would make
    # Razorpay retry it for 24 hours and eventually disable the webhook.
    try:
        if event in ("payment.captured", "order.paid"):
            payment = entity("payment")
            order_id = payment.get("order_id") or entity("order").get("id")
            if order_id:
                if not _apply_paid(db, order_id, payment.get("id"), f"webhook:{event}"):
                    logger.info("Webhook %s for unknown order %s ignored", event, order_id)
        elif event == "payment.failed":
            order_id = entity("payment").get("order_id")
            tx = (db.query(models.Transaction)
                    .filter(models.Transaction.razorpay_order_id == order_id).first()) if order_id else None
            # A failed attempt does not close the order - the customer can retry on it - so
            # only an order that never succeeded is marked.
            if tx and tx.status == "created":
                tx.status = "failed"
                db.commit()
        elif event == "subscription.charged":
            sub_entity = entity("subscription")
            sub = db.query(models.Subscription).filter(
                models.Subscription.razorpay_subscription_id == sub_entity.get("id")).first()
            if sub:
                sub.status = "active"
                if sub_entity.get("current_end"):
                    sub.current_period_end = datetime.utcfromtimestamp(sub_entity["current_end"])
                sub.usage_campaigns = 0
                sub.usage_ai_generations = 0
                db.commit()
        elif event in ("subscription.halted", "subscription.cancelled"):
            sub = db.query(models.Subscription).filter(
                models.Subscription.razorpay_subscription_id == entity("subscription").get("id")).first()
            if sub:
                sub.status = "canceled"
                db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        logger.exception("Razorpay webhook %s could not be applied: %s", event, e)
        # This one IS worth a retry: the event was genuine, applying it failed (e.g. DB down).
        raise HTTPException(status_code=500, detail="Webhook processing failed")

    return {"status": "success"}


@router.get("/transactions")
def list_transactions(db: Session = Depends(database.get_db),
                      current_user: models.User = Depends(auth.get_current_user)):
    """This account's real payment history, newest first.

    The billing screen listed four invoices as a fixture - fixed dates, fixed amounts,
    fixed invoice numbers - with a Download button that alerted "Downloading invoice ...".
    Transactions have been recorded here since Razorpay was wired up; nothing read them.
    """
    rows = (db.query(models.Transaction)
              .filter(models.Transaction.owner_id == current_user.id)
              .order_by(models.Transaction.created_at.desc())
              .limit(50)
              .all())
    return [{
        "id": t.id,
        "amount": t.amount,
        "currency": (t.currency or "inr").upper(),
        "purpose": t.purpose,
        "status": t.status,
        "payment_id": t.razorpay_payment_id,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    } for t in rows]
