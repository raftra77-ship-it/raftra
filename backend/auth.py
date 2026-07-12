from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from fastapi.security import OAuth2PasswordBearer
import os
import jwt
from jwt import PyJWKClient
from passlib.context import CryptContext
from datetime import datetime, timedelta

import database, models, schemas
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback_secret_key_for_raftra_dev")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=7) # 7 days refresh
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(database.get_db)):
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

@router.post("/register")
def register(user_in: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # Check if user exists
    existing_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    hashed_pwd = get_password_hash(user_in.password)
    user = models.User(
        email=user_in.email,
        username=user_in.username,
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        hashed_password=hashed_pwd,
        is_active=True,
        # clerk_id can be left blank or used as a random string since we removed clerk
        clerk_id=f"custom_{user_in.email}" 
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    if user_in.role == "creator":
        from celery_app import process_creator_profile
        process_creator_profile.delay(user.id, user_in.category, user_in.price)
    
    access_token = create_access_token(data={"sub": str(user.id), "role": user_in.role})
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": user.id, "email": user.email}}

@router.post("/login")
def login(user_in: schemas.UserLogin, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(
        (models.User.email == user_in.identifier) | (models.User.username == user_in.identifier)
    ).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Incorrect email/username or password")
    
    if not verify_password(user_in.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email/username or password")
        
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    return {"access_token": access_token, "token_type": "bearer", "role": user.role, "user": {"id": user.id, "email": user.email}}

# Keep the billing endpoints from original auth.py
class TopUpRequest(BaseModel):
    amount: float

class UnlockNodeRequest(BaseModel):
    node_name: str
    price: float

@router.get("/billing")
def get_billing(current_user: models.User = Depends(get_current_user)):
    return {
        "balance": current_user.billing_balance,
        "unlocked_nodes": [n.strip() for n in current_user.unlocked_nodes.split(",") if n.strip()]
    }

@router.post("/billing/topup")
def topup_billing(request: TopUpRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    current_user.billing_balance += request.amount
    db.commit()
    db.refresh(current_user)
    return {
        "status": "success",
        "balance": current_user.billing_balance
    }

@router.post("/billing/unlock-node")
def unlock_node(request: UnlockNodeRequest, db: Session = Depends(database.get_db), current_user: models.User = Depends(get_current_user)):
    if current_user.billing_balance < request.price:
        raise HTTPException(status_code=400, detail="Insufficient funds in billing balance.")
    current_user.billing_balance -= request.price
    nodes = [n.strip() for n in current_user.unlocked_nodes.split(",") if n.strip()]
    if request.node_name not in nodes:
        nodes.append(request.node_name)
    current_user.unlocked_nodes = ",".join(nodes)
    db.commit()
    db.refresh(current_user)
    return {
        "status": "success",
        "balance": current_user.billing_balance,
        "unlocked_nodes": nodes
    }

@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user
