from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi.security import OAuth2PasswordBearer
import os
import jwt
from jwt import PyJWKClient
import bcrypt
from datetime import datetime, timedelta
from urllib.parse import urlencode, quote
import secrets
import hashlib
import smtplib
import threading
from email.mime.text import MIMEText
from email.utils import formataddr
import httpx

import database, models, schemas
from pydantic import BaseModel

router = APIRouter(prefix="/api/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "fallback_secret_key_for_raftra_dev")
# Refuse to run silently with a guessable signing key — a weak secret lets anyone forge login tokens.
if SECRET_KEY in ("fallback_secret_key_for_raftra_dev", "dev_secret_change_me_in_production",
                  "super_secret_jwt_key_here", "change_me_generate_a_strong_random_value", ""):
    print("WARNING: JWT_SECRET_KEY is weak/default. Set a strong random value "
          "(python -c \"import secrets; print(secrets.token_urlsafe(64))\") before production.")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8005")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

RESET_TOKEN_EXPIRE_MINUTES = 30

def _bcrypt_safe(password: str) -> bytes:
    # bcrypt only uses the first 72 bytes of a password; anything longer raises in
    # bcrypt 4.x+. Truncate to 72 bytes so hashing/verifying never errors.
    return password.encode("utf-8")[:72]

def verify_password(plain_password, hashed_password):
    # Use bcrypt directly (passlib 1.7.x is incompatible with bcrypt 4.x/5.x).
    if not hashed_password:
        return False
    try:
        return bcrypt.checkpw(_bcrypt_safe(plain_password), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        # Hash isn't a valid bcrypt hash (e.g. a legacy plaintext seed row).
        return False

def get_password_hash(password):
    return bcrypt.hashpw(_bcrypt_safe(password), bcrypt.gensalt()).decode("utf-8")

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

def _client_ip(request: Request = None):
    """Best-effort client IP, honouring a proxy's X-Forwarded-For header."""
    if request is None:
        return None
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip()
    return request.client.host if request.client else None

def _log_auth_event(db: Session, event_type: str, user: models.User = None,
                    email: str = None, detail: str = None, request: Request = None):
    """Record an account activity event (register / login / password reset) for auditing.
    Never breaks the request if logging fails."""
    try:
        db.add(models.AuthEvent(
            user_id=user.id if user else None,
            email=email or (user.email if user else None),
            event_type=event_type,
            detail=detail,
            ip_address=_client_ip(request),
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to log auth event ({event_type}): {e}")

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
def register(user_in: schemas.UserCreate, request: Request, db: Session = Depends(database.get_db)):
    # Normalize email so 'A@x.com' and 'a@x.com' are treated as the same account.
    email = user_in.email.strip().lower()
    # Check if user exists (case-insensitive)
    existing_user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pwd = get_password_hash(user_in.password)
    user = models.User(
        email=email,
        username=user_in.username,
        first_name=user_in.first_name,
        last_name=user_in.last_name,
        hashed_password=hashed_pwd,
        is_active=True,
        role=user_in.role or "brand",
        # clerk_id can be left blank or used as a random string since we removed clerk
        clerk_id=f"custom_{email}"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _log_auth_event(db, "register", user=user, detail=f"role={user.role}", request=request)

    if user_in.role == "creator":
        from celery_app import process_creator_profile
        process_creator_profile.delay(user.id, user_in.category, user_in.price)
    
    access_token = create_access_token(data={"sub": str(user.id), "role": user_in.role})
    return {"access_token": access_token, "token_type": "bearer", "user": {"id": user.id, "email": user.email}}

@router.post("/login")
def login(user_in: schemas.UserLogin, request: Request, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(
        (models.User.email == user_in.identifier) | (models.User.username == user_in.identifier)
    ).first()
    if not user or not user.hashed_password:
        _log_auth_event(db, "login_failed", email=user_in.identifier, detail="no such account", request=request)
        raise HTTPException(status_code=401, detail="Incorrect email/username or password")

    if not verify_password(user_in.password, user.hashed_password):
        _log_auth_event(db, "login_failed", user=user, detail="wrong password", request=request)
        raise HTTPException(status_code=401, detail="Incorrect email/username or password")

    _log_auth_event(db, "login", user=user, detail=f"role={user.role}", request=request)
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

# ---------------------------------------------------------------------------
# Social login (Google) — server-side authorization-code flow.
# Works for both roles: the chosen role ('brand' or 'creator') is carried in a
# signed, short-lived state token. Existing users keep their stored role.
# ---------------------------------------------------------------------------

def _create_oauth_state(role: str) -> str:
    payload = {
        "purpose": "oauth_state",
        "role": role if role in ("brand", "creator") else "brand",
        "nonce": secrets.token_urlsafe(8),
        "exp": datetime.utcnow() + timedelta(minutes=10),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def _decode_oauth_state(state: str) -> str:
    try:
        payload = jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("purpose") != "oauth_state":
            raise ValueError("wrong purpose")
        return payload.get("role", "brand")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

def _login_redirect_error(message: str) -> RedirectResponse:
    return RedirectResponse(f"{FRONTEND_URL}/login?error={quote(message)}")

def _get_or_create_oauth_user(db: Session, email: str, first_name: str, last_name: str, provider: str, role: str):
    # Normalize so a social login matches an existing account regardless of email case.
    # Returns (user, created) so callers can tell a brand-new signup from a returning login.
    email = email.strip().lower()
    user = db.query(models.User).filter(func.lower(models.User.email) == email).first()
    if user:
        return user, False
    user = models.User(
        email=email,
        username=email.split("@")[0],
        first_name=first_name or "User",
        last_name=last_name or "",
        hashed_password=None,
        is_active=True,
        role=role,
        auth_provider=provider,
        clerk_id=f"{provider}_{email}",
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    if role == "creator":
        try:
            from celery_app import process_creator_profile
            process_creator_profile.delay(user.id, None, None)
        except Exception as e:
            print(f"Could not queue creator profile task: {e}")
    return user, True

def _finish_oauth_login(user: models.User) -> RedirectResponse:
    access_token = create_access_token(data={"sub": str(user.id), "role": user.role})
    params = urlencode({"token": access_token, "role": user.role})
    return RedirectResponse(f"{FRONTEND_URL}/auth/callback?{params}")

# ----- Google -----

@router.get("/oauth/google/authorize")
def google_authorize(role: str = "brand"):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google login is not configured (GOOGLE_CLIENT_ID missing)")
    params = urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": f"{BACKEND_URL}/api/auth/oauth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "state": _create_oauth_state(role),
        "prompt": "select_account",
    })
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")

@router.get("/oauth/google/callback")
async def google_callback(state: str, request: Request, code: str = None, error: str = None, db: Session = Depends(database.get_db)):
    if error or not code:
        return _login_redirect_error(error or "Google login was cancelled")
    role = _decode_oauth_state(state)

    async with httpx.AsyncClient() as client:
        token_res = await client.post("https://oauth2.googleapis.com/token", data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": f"{BACKEND_URL}/api/auth/oauth/google/callback",
            "grant_type": "authorization_code",
        })
        if token_res.status_code != 200:
            print(f"Google token exchange failed: {token_res.text}")
            return _login_redirect_error("Google login failed. Please try again.")
        access_token = token_res.json().get("access_token")

        userinfo_res = await client.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if userinfo_res.status_code != 200:
            return _login_redirect_error("Could not fetch your Google profile.")
        info = userinfo_res.json()

    email = info.get("email")
    if not email or not info.get("email_verified", False):
        return _login_redirect_error("Your Google account has no verified email.")

    user, created = _get_or_create_oauth_user(db, email, info.get("given_name", ""), info.get("family_name", ""), "google", role)
    if created:
        _log_auth_event(db, "register", user=user, detail=f"role={user.role} via google", request=request)
    _log_auth_event(db, "login", user=user, detail=f"role={user.role} via google", request=request)
    return _finish_oauth_login(user)

# ---------------------------------------------------------------------------
# Forgot / reset password (works for both brand and creator accounts)
# ---------------------------------------------------------------------------

def _send_email(to_email: str, subject: str, body: str):
    smtp_host = os.getenv("SMTP_HOST")
    if not smtp_host:
        # Dev fallback: no SMTP configured, log the email server-side.
        print(f"[DEV EMAIL] To: {to_email}\nSubject: {subject}\n{body}")
        return
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER", "")
    smtp_password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("SMTP_FROM", smtp_user)
    # Sender shown to the user, e.g. "raftra.ai" instead of a raw email address.
    from_name = os.getenv("SMTP_FROM_NAME", "raftra.ai")
    # Replies go to a no-reply address rather than the sending mailbox.
    reply_to = os.getenv("SMTP_REPLY_TO", "no-reply@raftra.ai")

    msg = MIMEText(body)
    msg["Subject"] = subject
    msg["From"] = formataddr((from_name, from_email))
    msg["To"] = to_email
    msg["Reply-To"] = reply_to

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.starttls()
        if smtp_user:
            server.login(smtp_user, smtp_password)
        server.sendmail(from_email, [to_email], msg.as_string())

def _send_email_safe(to_email: str, subject: str, body: str):
    """Wrapper for background sending: never raises (the HTTP response already went out)."""
    try:
        _send_email(to_email, subject, body)
    except Exception as e:
        print(f"Failed to send email to {to_email}: {e}")

@router.post("/forgot-password")
def forgot_password(req: schemas.ForgotPasswordRequest, request: Request, db: Session = Depends(database.get_db)):
    # Match the account case-insensitively (emails are stored lowercase).
    user = db.query(models.User).filter(func.lower(models.User.email) == req.email.strip().lower()).first()
    if user:
        token = secrets.token_urlsafe(32)
        user.reset_token_hash = hashlib.sha256(token.encode()).hexdigest()
        user.reset_token_expires = datetime.utcnow() + timedelta(minutes=RESET_TOKEN_EXPIRE_MINUTES)
        # Record the request in the SAME commit as the token, to save a DB round-trip.
        db.add(models.AuthEvent(user_id=user.id, email=user.email,
                                event_type="password_reset_requested", ip_address=_client_ip(request)))
        db.commit()

        reset_link = f"{FRONTEND_URL}/reset-password?token={token}"
        # Fire the email off in a detached thread so the HTTP response returns immediately
        # instead of waiting on the SMTP connect/TLS/login (which can take several seconds).
        threading.Thread(
            target=_send_email_safe,
            args=(
                user.email,
                "Reset your raftra.ai password",
                f"Hi {user.first_name or 'there'},\n\n"
                f"We received a request to reset your raftra.ai password.\n"
                f"Click the link below to choose a new password (valid for {RESET_TOKEN_EXPIRE_MINUTES} minutes):\n\n"
                f"{reset_link}\n\n"
                f"If you didn't request this, you can safely ignore this email.\n\n"
                f"This is an automated message — please do not reply.",
            ),
            daemon=True,
        ).start()
    else:
        # No account for this email — still record the attempt (outside the fast success path).
        _log_auth_event(db, "password_reset_requested", email=req.email, request=request)

    # Same response whether or not the email exists, to avoid account enumeration.
    return {"message": "If an account exists for that email, a password reset link has been sent."}

@router.post("/reset-password")
def reset_password(req: schemas.ResetPasswordRequest, request: Request, db: Session = Depends(database.get_db)):
    pw = req.new_password
    if len(pw) < 8:
        raise HTTPException(status_code=400, detail="Please use a password with at least 8 characters.")
    if len(pw) > 64:
        raise HTTPException(status_code=400, detail="Please use a password no longer than 64 characters.")

    token_hash = hashlib.sha256(req.token.encode()).hexdigest()
    user = db.query(models.User).filter(models.User.reset_token_hash == token_hash).first()
    if not user or not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")

    user.hashed_password = get_password_hash(req.new_password)
    user.reset_token_hash = None
    user.reset_token_expires = None
    db.commit()
    _log_auth_event(db, "password_reset", user=user, request=request)

    return {"message": "Password updated successfully. You can now sign in."}
