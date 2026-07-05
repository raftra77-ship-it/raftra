import stripe
import os
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
import database, models, schemas

router = APIRouter(prefix="/api/payments", tags=["payments"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
DOMAIN = "http://localhost:5173"  # React dev server

@router.post("/create-checkout-session")
def create_checkout_session(email: str):
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            customer_email=email,
            line_items=[
                {
                    'price_data': {
                        'currency': 'usd',
                        'unit_amount': 2000, # $20.00
                        'product_data': {
                            'name': 'Raftra Premium Subscription',
                        },
                    },
                    'quantity': 1,
                },
            ],
            mode='payment',
            success_url=DOMAIN + '/dashboard?success=true',
            cancel_url=DOMAIN + '/dashboard?canceled=true',
        )
        return {"id": checkout_session.id, "url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/webhook")
async def stripe_webhook(request: Request, stripe_signature: str = Header(None), db: Session = Depends(database.get_db)):
    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload, stripe_signature, webhook_secret
        )
    except ValueError as e:
        # Invalid payload
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        raise HTTPException(status_code=400, detail="Invalid signature")

    # Handle the checkout.session.completed event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        customer_email = session.get("customer_email")
        
        # Update user payment status in DB
        if customer_email:
            user = db.query(models.User).filter(models.User.email == customer_email).first()
            if user:
                user.payment_status = "paid"
                # Record transaction
                tx = models.Transaction(
                    amount=session.get("amount_total", 0) / 100.0,
                    currency=session.get("currency", "usd"),
                    stripe_charge_id=session.get("payment_intent"),
                    status="succeeded",
                    owner_id=user.id
                )
                db.add(tx)
                db.commit()

    return {"status": "success"}
