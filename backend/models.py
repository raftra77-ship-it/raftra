from sqlalchemy import Boolean, Column, Integer, String, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
import datetime
from database import Base

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
    
    # Subscriptions / Payments
    payment_status = Column(String, default="pending")  # pending, paid, cancelled
    stripe_customer_id = Column(String, unique=True, nullable=True)
    billing_balance = Column(Float, default=0.0)
    unlocked_nodes = Column(String, default="")  # Comma separated list of active/purchased nodes: "studio,campaign,seo,analytics,social,influencer"

    transactions = relationship("Transaction", back_populates="owner")
    workspaces = relationship("Workspace", back_populates="user")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Float)
    currency = Column(String, default="usd")
    stripe_charge_id = Column(String, unique=True)
    status = Column(String)  # succeeded, failed
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
    access_token = Column(String, nullable=True)
    account_id = Column(String, nullable=True)
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
    status = Column(String)  # pending_review, approved, rejected

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

    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    influencer_id = Column(Integer, ForeignKey("influencers.id"))
    
    workspace = relationship("Workspace")
    influencer = relationship("Influencer")
