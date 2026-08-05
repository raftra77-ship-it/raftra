from pydantic import BaseModel, EmailStr
from typing import Optional, List, Any
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    role: Optional[str] = "brand"
    category: Optional[str] = None
    price: Optional[float] = None

class UserLogin(BaseModel):
    identifier: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: EmailStr
    is_active: bool
    payment_status: str
    role: str

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str
    role: Optional[str] = None

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class OAuthRequest(BaseModel):
    code: str

# Workspace & Agent schemas
class WorkspaceCreate(BaseModel):
    name: str
    company_url: Optional[str] = None
    brand_logo: Optional[str] = None
    brand_color: Optional[str] = None
    brand_voice: Optional[str] = None

class ReindexRequest(BaseModel):
    url: str
    tone: str

class WorkspaceResponse(BaseModel):
    id: int
    name: str
    company_url: Optional[str]
    brand_logo: Optional[str]
    brand_color: Optional[str]
    brand_voice: Optional[str]
    created_at: datetime
    user_id: int

    class Config:
        from_attributes = True

class CampaignCreate(BaseModel):
    platform: str
    name: str
    objective: str
    budget: float

class CampaignAgentTrigger(BaseModel):
    prompt: str
    model: str = "gemini-2.0-flash"

class CampaignResponse(BaseModel):
    id: int
    platform: str
    name: str
    objective: str
    budget: float
    status: str
    roas: float
    metrics: Optional[Any] = None

    class Config:
        from_attributes = True

class AdAssetCreate(BaseModel):
    headline: str
    body_text: str
    cta: str
    type: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    audio_url: Optional[str] = None

class AdAssetResponse(BaseModel):
    id: int
    headline: str
    body_text: str
    cta: str
    type: str
    image_url: Optional[str] = None
    video_url: Optional[str] = None
    status: str

    class Config:
        from_attributes = True

class SEOAuditCreate(BaseModel):
    score: int
    keywords_data: Optional[Any] = None
    recommendation: str
    status: str

class SEOAuditResponse(BaseModel):
    id: int
    score: int
    keywords_data: Optional[Any] = None
    recommendation: str
    status: str
    created_at: datetime

    class Config:
        from_attributes = True

class SocialPostCreate(BaseModel):
    platform: str
    caption: str
    scheduled_for: Optional[str] = None

class SocialPostResponse(BaseModel):
    id: int
    platform: str
    caption: str
    media_url: Optional[str] = None
    scheduled_for: Optional[str] = None
    status: str

    class Config:
        from_attributes = True

class InfluencerResponse(BaseModel):
    id: int
    name: str
    handle: Optional[str] = None
    platform: str
    fit_score: Optional[int] = 0
    success_rate: Optional[int] = 0
    niche: Optional[str] = None
    status: Optional[str] = "available"
    base_rate: Optional[float] = 0.0
    recent_posts: Optional[Any] = None
    recent_collabs: Optional[Any] = None
    recent_reviews: Optional[Any] = None

    class Config:
        from_attributes = True

class InfluencerProfileUpdate(BaseModel):
    base_rate: Optional[float] = None
    recent_posts: Optional[Any] = None
    recent_collabs: Optional[Any] = None
    recent_reviews: Optional[Any] = None

    class Config:
        from_attributes = True

class AgentTaskResponse(BaseModel):
    id: int
    agent_type: str
    status: str
    logs: Optional[Any] = None
    updated_at: datetime

    class Config:
        from_attributes = True

# ── Deal Schemas ──────────────────────────────────────────────────────────────

class DealPropose(BaseModel):
    workspace_id: Optional[int] = None
    brand_name: str
    brand_email: Optional[str] = None
    influencer_handle: str   # no @, e.g. "samairaa.r"
    influencer_name: str
    influencer_email: Optional[str] = None
    influencer_phone: Optional[str] = None
    amount: float
    deliverables: str

class DealResponse(BaseModel):
    id: int
    workspace_id: Optional[int]
    brand_name: str
    influencer_handle: str
    influencer_name: str
    amount: float
    deliverables: str
    status: str
    brand_release_token: Optional[str]
    escrow_locked_at: Optional[datetime]
    brand_released_at: Optional[datetime]
    paid_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True

# ── Payout Schemas ────────────────────────────────────────────────────────────

class PayoutSubmit(BaseModel):
    creator_handle: str       # no @
    creator_name: str
    deal_id: Optional[int] = None
    screenshot_url: Optional[str] = None
    token_submitted: Optional[str] = None
    bank_account_holder: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    upi_id: Optional[str] = None

class PayoutResponse(BaseModel):
    id: int
    creator_handle: str
    creator_name: str
    deal_id: Optional[int]
    screenshot_url: Optional[str]
    token_submitted: Optional[str]
    bank_account_holder: Optional[str]
    bank_name: Optional[str]
    account_number: Optional[str]
    ifsc_code: Optional[str]
    upi_id: Optional[str]
    status: str
    admin_note: Optional[str]
    payout_ref: Optional[str]
    created_at: datetime
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True
