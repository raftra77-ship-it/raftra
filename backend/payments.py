import razorpay
import os
import hmac
import hashlib
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
import database, models, schemas

router = APIRouter(prefix="/api/payments", tags=["payments"])

RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "test_key")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "test_secret")

# Initialize Razorpay Client
client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

@router.post("/create-order")
def create_order(email: str, db: Session = Depends(database.get_db)):
    try:
        user = db.query(models.User).filter(models.User.email == email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Create order for INR 2000 (amount is in paise)
        order_amount = 200000 
        order_currency = 'INR'
        
        order = client.order.create(dict(
            amount=order_amount,
            currency=order_currency,
            receipt=f"receipt_{user.id}",
            payment_capture=1
        ))

        return {"id": order["id"], "amount": order["amount"], "currency": order["currency"]}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/verify-payment")
async def verify_payment(request: Request, db: Session = Depends(database.get_db)):
    data = await request.json()
    
    razorpay_payment_id = data.get('razorpay_payment_id')
    razorpay_order_id = data.get('razorpay_order_id')
    razorpay_signature = data.get('razorpay_signature')
    email = data.get('email')

    try:
        # Verify Signature
        client.utility.verify_payment_signature({
            'razorpay_order_id': razorpay_order_id,
            'razorpay_payment_id': razorpay_payment_id,
            'razorpay_signature': razorpay_signature
        })
        
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.payment_status = "paid"
            # Record transaction
            tx = models.Transaction(
                amount=2000.0,
                currency="inr",
                razorpay_order_id=razorpay_order_id,
                razorpay_payment_id=razorpay_payment_id,
                status="paid",
                owner_id=user.id
            )
            db.add(tx)
            db.commit()
            return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Signature verification failed")

@router.post("/webhook")
async def razorpay_webhook(request: Request, db: Session = Depends(database.get_db)):
    # Verify signature
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "test_secret")
    webhook_signature = request.headers.get("X-Razorpay-Signature")
    payload = await request.body()
    
    try:
        client.utility.verify_webhook_signature(payload.decode('utf-8'), webhook_signature, webhook_secret)
    except Exception as e:
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
