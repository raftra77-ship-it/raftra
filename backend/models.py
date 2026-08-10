from sqlalchemy import Boolean, Column, Integer, String, Float, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
import datetime
try:
    from pgvector.sqlalchemy import Vector
except ImportError:
    from sqlalchemy import JSON as Vector
from database import Base

class AgentMemory(Base):
    __tablename__ = "agent_memories"

    id = Column(Integer, primary_key=True, index=True)
    agent_type = Column(String) # CREATIVE, SEO, etc
    content = Column(String)
    embedding = Column(Vector(1536)) # OpenAI embedding dimension
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    workspace = relationship("Workspace")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=True)
    email = Column(String, unique=True, index=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    hashed_password = Column(String)
    is_active = Column(Boolean, default=True)
    role = Column(String, default="brand") # 'brand', 'creator'
    clerk_id = Column(String, unique=True, index=True, nullable=True) # Added for Clerk Auth
    
    # Subscriptions / Payments
    payment_status = Column(String, default="pending")  # pending, paid, cancelled
    razorpay_customer_id = Column(String, unique=True, nullable=True)
    billing_balance = Column(Float, default=0.0)
    unlocked_nodes = Column(String, default="")  # Comma separated list of active/purchased nodes: "studio,campaign,seo,analytics,social,influencer"

    transactions = relationship("Transaction", back_populates="owner")
    workspaces = relationship("Workspace", back_populates="user")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float)
    currency = Column(String, default="inr") # Razorpay default INR
    razorpay_order_id = Column(String, unique=True, nullable=True)
    razorpay_payment_id = Column(String, unique=True, nullable=True)
    status = Column(String)  # created, paid, failed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    owner_id = Column(Integer, ForeignKey("users.id"))
    owner = relationship("User", back_populates="transactions")

class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    company_url = Column(String, nullable=True)
    brand_logo = Column(String, nullable=True)
    brand_color = Column(String, nullable=True)
    brand_voice = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="workspaces")

    integrations = relationship("Integration", back_populates="workspace", cascade="all, delete-orphan")
    campaigns = relationship("Campaign", back_populates="workspace", cascade="all, delete-orphan")
    ad_assets = relationship("AdAsset", back_populates="workspace", cascade="all, delete-orphan")
    seo_audits = relationship("SEOAudit", back_populates="workspace", cascade="all, delete-orphan")
    social_posts = relationship("SocialPost", back_populates="workspace", cascade="all, delete-orphan")
    influencers = relationship("Influencer", back_populates="workspace", cascade="all, delete-orphan")
    agent_tasks = relationship("AgentTask", back_populates="workspace", cascade="all, delete-orphan")
    brand_profile = relationship("BrandProfile", back_populates="workspace", uselist=False, cascade="all, delete-orphan")
    subscription = relationship("Subscription", back_populates="workspace", uselist=False, cascade="all, delete-orphan")

class Plan(Base):
    __tablename__ = "plans"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True) # Free, Starter, Growth, Agency
    price_inr = Column(Float)
    features = Column(JSON) # e.g. {"max_campaigns": 5, "ai_generation": true}
    
class Subscription(Base):
    __tablename__ = "subscriptions"
    
    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    plan_id = Column(Integer, ForeignKey("plans.id"))
    razorpay_subscription_id = Column(String, nullable=True)
    status = Column(String, default="active") # active, past_due, canceled
    current_period_end = Column(DateTime, nullable=True)
    
    usage_campaigns = Column(Integer, default=0)
    usage_ai_generations = Column(Integer, default=0)
    
    workspace = relationship("Workspace", back_populates="subscription")
    plan = relationship("Plan")

class BrandProfile(Base):
    __tablename__ = "brand_profiles"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    typography = Column(JSON, nullable=True)  # e.g., {"primary": "Inter", "headings": "Outfit"}
    color_palette = Column(JSON, nullable=True) # e.g., ["#FFFFFF", "#030303", "#5A52FF"]
    brand_guidelines_summary = Column(String, nullable=True) # Summarized context from Scraping
    target_audience = Column(String, nullable=True)
    is_onboarded = Column(Boolean, default=False)
    
    workspace = relationship("Workspace", back_populates="brand_profile")

class Integration(Base):
    __tablename__ = "integrations"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String)  # META, GOOGLE, TIKTOK, LINKEDIN
    composio_entity_id = Column(String, nullable=True) # Composio Entity identifier
    status = Column(String, default="ACTIVE")  # ACTIVE, DISCONNECTED

    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    workspace = relationship("Workspace", back_populates="integrations")

class Campaign(Base):
    __tablename__ = "campaigns"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String)
    status = Column(String)  # DRAFT, PENDING_REVIEW, ACTIVE, PAUSED
    roas = Column(Float, default=0.0)
    metrics = Column(JSON, nullable=True)

    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    workspace = relationship("Workspace", back_populates="campaigns")

class AdAsset(Base):
    __tablename__ = "ad_assets"

    id = Column(Integer, primary_key=True, index=True)
    headline = Column(String)
    body_text = Column(String)
    cta = Column(String)
    type = Column(String)  # Facebook Static, LinkedIn Text, etc.
    image_url = Column(String, nullable=True)
    video_url = Column(String, nullable=True)
    audio_url = Column(String, nullable=True)
    status = Column(String)  # pending_review, approved, rejected
    parent_id = Column(Integer, ForeignKey("ad_assets.id"), nullable=True)
    suggested_edits = Column(JSON, nullable=True)

    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    workspace = relationship("Workspace", back_populates="ad_assets")

class SEOAudit(Base):
    __tablename__ = "seo_audits"

    id = Column(Integer, primary_key=True, index=True)
    score = Column(Integer)
    keywords_data = Column(JSON, nullable=True)
    recommendation = Column(String)
    status = Column(String)  # COMPLETED, RUNNING
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    workspace = relationship("Workspace", back_populates="seo_audits")

class SocialPost(Base):
    __tablename__ = "social_posts"

    id = Column(Integer, primary_key=True, index=True)
    platform = Column(String)  # TWITTER, LINKEDIN, TIKTOK
    caption = Column(String)
    media_url = Column(String, nullable=True)
    scheduled_for = Column(String, nullable=True)
    status = Column(String)  # draft, scheduled, published

    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    workspace = relationship("Workspace", back_populates="social_posts")

class Influencer(Base):
    __tablename__ = "influencers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    handle = Column(String)
    platform = Column(String)
    fit_score = Column(Integer)
    success_rate = Column(Integer)
    niche = Column(String)
    base_rate = Column(Float, default=0.0)
    status = Column(String, default="available")  # available, proposed, collaborating
    
    recent_posts = Column(JSON, nullable=True) # list of {url, type}
    recent_collabs = Column(JSON, nullable=True) # list of brand names
    recent_reviews = Column(JSON, nullable=True) # list of {author, text}

    user_id = Column(Integer, ForeignKey("users.id"))
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)
    workspace = relationship("Workspace", back_populates="influencers")

class AgentTask(Base):
    __tablename__ = "agent_tasks"

    id = Column(Integer, primary_key=True, index=True)
    agent_type = Column(String)  # CREATIVE, ADOPS, SEO, ANALYST, SOCIAL, INFLUENCER
    status = Column(String)  # RUNNING, IDLE, ACTION_REQUIRED
    logs = Column(JSON, nullable=True)  # List of log entries
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    workspace = relationship("Workspace", back_populates="agent_tasks")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_type = Column(String)  # 'brand', 'influencer', 'system'
    content = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    delivered_at = Column(DateTime, nullable=True)
    read_at = Column(DateTime, nullable=True)
    file_url = Column(String, nullable=True)

    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    influencer_id = Column(Integer, ForeignKey("influencers.id"))
    
    workspace = relationship("Workspace")
    influencer = relationship("Influencer")

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String)
    message = Column(String)
    type = Column(String) # 'chat', 'system', 'payment', 'agent'
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    action_url = Column(String, nullable=True)

    user = relationship("User")

class InfluencerDeal(Base):
    """Tracks a finalized brand↔creator deal."""
    __tablename__ = "influencer_deals"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)
    brand_name = Column(String)              # e.g. "Demo Brand"
    brand_email = Column(String, nullable=True)
    influencer_handle = Column(String, index=True)  # e.g. "samairaa.r" (no @)
    influencer_name = Column(String)
    influencer_email = Column(String, nullable=True)
    influencer_phone = Column(String, nullable=True)  # sent via email after release
    amount = Column(Float)
    deliverables = Column(String)
    status = Column(String, default="pending")  # pending|active|delivered|paid
    brand_release_token = Column(String, nullable=True)  # generated on brand release
    brand_whatsapp = Column(String, nullable=True)
    escrow_locked_at = Column(DateTime, nullable=True)
    brand_released_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class CreatorPayoutRequest(Base):
    """Creator submits proof to claim escrow payout."""
    __tablename__ = "creator_payout_requests"

    id = Column(Integer, primary_key=True, index=True)
    creator_handle = Column(String, index=True)    # e.g. "samairaa.r"
    creator_name = Column(String)
    deal_id = Column(Integer, ForeignKey("influencer_deals.id"), nullable=True)
    screenshot_url = Column(String, nullable=True) # Cloudinary / upload URL
    token_submitted = Column(String, nullable=True) # token from brand email
    # Bank / UPI details
    bank_account_holder = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    account_number = Column(String, nullable=True)
    ifsc_code = Column(String, nullable=True)
    upi_id = Column(String, nullable=True)
    # Review
    status = Column(String, default="submitted")  # submitted|under_review|approved|rejected|paid
    admin_note = Column(String, nullable=True)
    payout_ref = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    deal = relationship("InfluencerDeal")

class PostedDeal(Base):
    """Tracks a broadcast deal posted by a brand for creators to discover and apply."""
    __tablename__ = "posted_deals"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)
    brand_name = Column(String, default="Aura Premium")
    brand_logo = Column(String, nullable=True)
    brand_url = Column(String, nullable=True)
    campaign_name = Column(String)
    product_name = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    objective = Column(String, nullable=True)
    platform = Column(String, default="Instagram")
    creator_category = Column(String, default="All")
    niche = Column(String, default="Lifestyle")
    location = Column(String, default="India")
    creators_required = Column(Integer, default=1)
    follower_range = Column(String, nullable=True)
    engagement_range = Column(String, nullable=True)
    content_style = Column(String, nullable=True)
    language = Column(String, default="English / Hindi")
    audience_requirements = Column(String, nullable=True)
    deliverables_json = Column(Text, nullable=True)  # JSON string of deliverables
    total_budget = Column(Float, default=50000.0)
    budget_per_creator = Column(Float, default=15000.0)
    allow_negotiation = Column(Boolean, default=True)
    application_deadline = Column(String, nullable=True)
    campaign_start = Column(String, nullable=True)
    deliverable_deadline = Column(String, nullable=True)
    campaign_end = Column(String, nullable=True)
    status = Column(String, default="ACTIVE")  # DRAFT | ACTIVE | REVIEWING | IN_PROGRESS | COMPLETED | CLOSED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class DealApplication(Base):
    """Tracks a creator's application to a posted brand deal."""
    __tablename__ = "deal_applications"

    id = Column(Integer, primary_key=True, index=True)
    deal_id = Column(Integer, ForeignKey("posted_deals.id"))
    workspace_id = Column(Integer, nullable=True)
    creator_handle = Column(String, index=True)  # e.g. "samairaa.r"
    creator_name = Column(String)
    creator_avatar = Column(String, nullable=True)
    creator_followers = Column(String, nullable=True)
    creator_engagement = Column(String, nullable=True)
    creator_location = Column(String, nullable=True)
    match_score = Column(Integer, default=94)
    proposal_text = Column(Text, nullable=True)
    proposed_price = Column(Float, default=15000.0)
    availability_date = Column(String, nullable=True)
    estimated_delivery_days = Column(Integer, default=7)
    status = Column(String, default="SUBMITTED")  # SUBMITTED | SHORTLISTED | NEGOTIATION | ACCEPTED | CONFIRMED | DECLINED
    final_price = Column(Float, nullable=True)
    final_deliverables = Column(Text, nullable=True)
    final_delivery_days = Column(Integer, nullable=True)
    usage_rights = Column(String, default="30 Days Digital Rights")
    revisions_allowed = Column(Integer, default=1)
    cashout_requested = Column(Boolean, default=False)
    cashout_status = Column(String, nullable=True)  # REQUESTED | VERIFYING | APPROVED | PROCESSING | PAID
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    deal = relationship("PostedDeal")

class DealDeliverableSubmission(Base):
    """Tracks individual deliverable submissions and approvals for a deal application."""
    __tablename__ = "deal_deliverable_submissions"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("deal_applications.id"))
    deal_id = Column(Integer, ForeignKey("posted_deals.id"))
    title = Column(String)  # e.g. "Instagram Reel"
    submission_type = Column(String, default="video")  # video | image | file | url
    content_url = Column(String, nullable=True)
    caption = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    due_date = Column(String, nullable=True)
    status = Column(String, default="PENDING")  # PENDING | SUBMITTED | UNDER_REVIEW | REVISION_REQUESTED | RESUBMITTED | APPROVED
    revision_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class PostedDealNotification(Base):
    """Tracks in-app notifications for posted deals, applications, and payouts."""
    __tablename__ = "posted_deal_notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_type = Column(String)  # "creator" or "brand"
    recipient_handle = Column(String, nullable=True)
    workspace_id = Column(Integer, nullable=True)
    title = Column(String)
    message = Column(String)
    deal_id = Column(Integer, nullable=True)
    application_id = Column(Integer, nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
