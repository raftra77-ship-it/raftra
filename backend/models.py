from sqlalchemy import Boolean, Column, Integer, String, Float, ForeignKey, DateTime, JSON, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import text
import datetime
from pgvector.sqlalchemy import Vector
from database import Base
from core.crypto import EncryptedString

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
    auth_provider = Column(String, nullable=True) # 'google', 'github', None for email/password
    reset_token_hash = Column(String, nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    
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
    purpose = Column(String, default="subscription")  # subscription, topup
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

    # Who created it. No longer the access predicate - that is tenant membership - but kept
    # because a number of queries read it and "who set this up" stays useful.
    user_id = Column(Integer, ForeignKey("users.id"))
    user = relationship("User", back_populates="workspaces")

    # The organisation this brand belongs to. Everything in the workspace is reachable by
    # any member of this tenant, which is what makes an agency with several people possible.
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=True, index=True)
    tenant = relationship("Tenant", back_populates="workspaces")

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
    # The rest of the brand guidelines the vault shows - USPs, personality, slogan,
    # competitive position, tone, product categories, geographies, key messages. Held as
    # JSON rather than a column each: the set is editorial and grows, and none of it is
    # queried on, only read back whole for the screen and the agents.
    guidelines = Column(JSON, nullable=True)

    # Design tokens, kept beside color_palette rather than replacing it. color_palette is a
    # bare list of hexes that half the codebase already reads; color_tokens is the same
    # colours with the name and role the site's own CSS variables gave them, which is what
    # a brief needs ("use the CTA colour", not "use the second hex").
    color_tokens = Column(JSON, nullable=True)   # [{name, hex, role, source}]
    logos = Column(JSON, nullable=True)          # [{type, url, format, variant}]

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
    name = Column(String, nullable=True)
    objective = Column(String, nullable=True)
    budget = Column(Float, default=0.0)              # lifetime/total budget entered by the user
    daily_budget = Column(Float, nullable=True)      # daily budget (Meta uses minor units internally)
    status = Column(String)  # DRAFT, PENDING_REVIEW, APPROVED, PUBLISHED_DEMO, PAUSED
    roas = Column(Float, default=0.0)
    meta_campaign_id = Column(String, nullable=True) # id of the campaign created on Meta
    metrics = Column(JSON, nullable=True)            # everything structured: strategy, reviews, rules, activity, analytics
    # ── versioning: all versions of one campaign share a version_group; version increments ──
    version = Column(Integer, default=1)
    version_group = Column(String, nullable=True, index=True)

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
    status = Column(String)  # pending_review, approved, rejected — REVIEW state, set by humans
    parent_id = Column(Integer, ForeignKey("ad_assets.id"), nullable=True)
    suggested_edits = Column(JSON, nullable=True)

    # --- Creative Studio generation metadata (core/creative/) --------------------------
    # generation_status is deliberately separate from `status` above: that column is the
    # human review state (pending_review/approved/rejected) and existing queries filter on
    # it, so overloading it with processing/completed/failed would break them.
    generation_status = Column(String, nullable=True)   # processing | completed | failed
    original_prompt = Column(Text, nullable=True)       # exactly what the user typed
    optimized_prompt = Column(Text, nullable=True)      # what the provider actually received
    creative_spec = Column(JSON, nullable=True)         # CreativeSpec — the source of truth
    platform = Column(String, nullable=True)
    placement = Column(String, nullable=True)
    aspect_ratio = Column(String, nullable=True)
    media_type = Column(String, nullable=True)          # image | video
    provider = Column(String, nullable=True)            # which ImageProvider/VideoProvider ran
    model = Column(String, nullable=True)
    reference_image_url = Column(String, nullable=True)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

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

class InfluencerDeal(Base):
    """A finalized brand-creator deal. The table already existed in the database, migrated
    but unused: this branch had no model and no routes for it, so the marketplace UI called
    /api/deals/* and got 404s. Column names and the status vocabulary match the existing
    table exactly - nothing here is a new migration."""
    __tablename__ = "influencer_deals"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)
    brand_name = Column(String)
    brand_email = Column(String, nullable=True)
    influencer_handle = Column(String, index=True)   # stored without the leading @
    influencer_name = Column(String)
    influencer_email = Column(String, nullable=True)
    influencer_phone = Column(String, nullable=True)
    amount = Column(Float)
    deliverables = Column(String)
    status = Column(String, default="pending")       # pending | active | delivered | paid
    brand_release_token = Column(String, nullable=True)
    brand_whatsapp = Column(String, nullable=True)
    # Written only when money genuinely moves. Nothing sets escrow_locked_at or paid_at yet -
    # there is no payment path - so they stay null rather than implying funds are held.
    escrow_locked_at = Column(DateTime, nullable=True)
    brand_released_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class PostedDeal(Base):
    """A campaign brief a brand broadcasts for creators to discover and apply to."""
    __tablename__ = "posted_deals"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), nullable=True)
    brand_name = Column(String)
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
    deliverables_json = Column(Text, nullable=True)
    total_budget = Column(Float, default=0.0)
    budget_per_creator = Column(Float, default=0.0)
    allow_negotiation = Column(Boolean, default=True)
    application_deadline = Column(String, nullable=True)
    campaign_start = Column(String, nullable=True)
    deliverable_deadline = Column(String, nullable=True)
    campaign_end = Column(String, nullable=True)
    status = Column(String, default="ACTIVE")  # DRAFT|ACTIVE|REVIEWING|IN_PROGRESS|COMPLETED|CLOSED
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class DealApplication(Base):
    """A creator's application to a posted brief, through to agreed final terms."""
    __tablename__ = "deal_applications"

    id = Column(Integer, primary_key=True, index=True)
    deal_id = Column(Integer, ForeignKey("posted_deals.id"))
    workspace_id = Column(Integer, nullable=True)
    creator_handle = Column(String, index=True)
    creator_name = Column(String)
    creator_avatar = Column(String, nullable=True)
    creator_followers = Column(String, nullable=True)
    creator_engagement = Column(String, nullable=True)
    creator_location = Column(String, nullable=True)
    match_score = Column(Integer, default=0)
    proposal_text = Column(Text, nullable=True)
    proposed_price = Column(Float, default=0.0)
    availability_date = Column(String, nullable=True)
    estimated_delivery_days = Column(Integer, default=7)
    status = Column(String, default="SUBMITTED")  # SUBMITTED|SHORTLISTED|NEGOTIATION|ACCEPTED|CONFIRMED|DECLINED|COMPLETED
    final_price = Column(Float, nullable=True)
    final_deliverables = Column(Text, nullable=True)
    final_delivery_days = Column(Integer, nullable=True)
    usage_rights = Column(String, default="30 Days Digital Rights")
    revisions_allowed = Column(Integer, default=1)
    cashout_requested = Column(Boolean, default=False)
    cashout_status = Column(String, nullable=True)  # REQUESTED|VERIFYING|APPROVED|PROCESSING|PAID
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    deal = relationship("PostedDeal")


class DealDeliverableSubmission(Base):
    """One deliverable on an application, and the brand's review of it."""
    __tablename__ = "deal_deliverable_submissions"

    id = Column(Integer, primary_key=True, index=True)
    application_id = Column(Integer, ForeignKey("deal_applications.id"))
    deal_id = Column(Integer, ForeignKey("posted_deals.id"))
    title = Column(String)
    submission_type = Column(String, default="video")  # video|image|file|url
    content_url = Column(String, nullable=True)
    caption = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    due_date = Column(String, nullable=True)
    status = Column(String, default="PENDING")  # PENDING|SUBMITTED|UNDER_REVIEW|REVISION_REQUESTED|RESUBMITTED|APPROVED
    revision_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class PostedDealNotification(Base):
    """In-app notifications for briefs, applications and payouts."""
    __tablename__ = "posted_deal_notifications"

    id = Column(Integer, primary_key=True, index=True)
    recipient_type = Column(String)             # "creator" | "brand"
    recipient_handle = Column(String, nullable=True)
    workspace_id = Column(Integer, nullable=True)
    title = Column(String)
    message = Column(String)
    deal_id = Column(Integer, nullable=True)
    application_id = Column(Integer, nullable=True)
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class CreatorPayoutRequest(Base):
    """A creator claiming payment for approved work, with the bank details to pay it to."""
    __tablename__ = "creator_payout_requests"

    id = Column(Integer, primary_key=True, index=True)
    creator_handle = Column(String, index=True)
    creator_name = Column(String)
    deal_id = Column(Integer, ForeignKey("influencer_deals.id"), nullable=True)
    screenshot_url = Column(String, nullable=True)
    token_submitted = Column(String, nullable=True)
    bank_account_holder = Column(String, nullable=True)
    bank_name = Column(String, nullable=True)
    account_number = Column(String, nullable=True)
    ifsc_code = Column(String, nullable=True)
    upi_id = Column(String, nullable=True)
    status = Column(String, default="submitted")  # submitted|under_review|approved|rejected|paid
    admin_note = Column(String, nullable=True)
    payout_ref = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    reviewed_at = Column(DateTime, nullable=True)

    deal = relationship("InfluencerDeal")


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

class ContentDraft(Base):
    __tablename__ = "content_drafts"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    title = Column(String)
    body = Column(String)            # full generated article (markdown)
    content_type = Column(String, default="blog")  # blog, landing_page, faq, etc.
    target_keyword = Column(String, nullable=True)
    status = Column(String, default="pending_review")  # pending_review, approved, rejected, published
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    workspace = relationship("Workspace")

class AuthEvent(Base):
    """Activity/audit log for account security events so admins can see when a
    user registered, logged in, or changed their password."""
    __tablename__ = "auth_events"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    email = Column(String, nullable=True, index=True)      # stored for readability even if the user is later deleted
    event_type = Column(String, index=True)                # register | login | login_failed | password_reset_requested | password_reset
    detail = Column(String, nullable=True)                 # e.g. "role=brand", "invalid password"
    ip_address = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    user = relationship("User")


class SearchConsoleConnection(Base):
    """Per-workspace Google Search Console connection. Stores a long-lived refresh
    token that mints short-lived access tokens for reading search performance."""
    __tablename__ = "search_console_connections"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    connected_email = Column(String, nullable=True)
    site_url = Column(String, nullable=True)        # selected GSC property, e.g. https://site.com/
    refresh_token = Column(EncryptedString, nullable=True)   # long-lived; mints access tokens
    access_token = Column(EncryptedString, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    scopes = Column(String, nullable=True)
    # The single "Connect Google" grant covers GA4 too (see core/search_console.py SCOPES),
    # so the selected GA4 property lives on this same connection rather than a second row.
    ga4_property_id = Column(String, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)  # last time Search Console data was pulled
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class GitHubConnection(Base):
    """Per-workspace GitHub connection used to apply approved changes to the site's
    repo (commit content/SEO files as a pull request). One connection per workspace.

    The access token is encrypted at rest (see core/crypto.EncryptedString).
    """
    __tablename__ = "github_connections"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    access_token = Column(EncryptedString, nullable=True)
    login = Column(String, nullable=True)            # GitHub username
    repo_full_name = Column(String, nullable=True)   # "owner/repo"
    default_branch = Column(String, nullable=True)
    last_synced_at = Column(DateTime, nullable=True)  # last time this connection's data (repo/branch) was refreshed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class RepositoryMapping(Base):
    """Result of automatically scanning a connected GitHub repository right after it's
    selected (see publishing/repo_scanner.py, triggered from connector_routes.gh_select_repo).
    Stores the detected framework and a page-by-page file mapping so a future Platform
    Converter can resolve a page path like "/about" to a real file path like
    "src/app/about/page.tsx" without re-scanning. One row per workspace — re-scanning
    overwrites it. Purely a read-only scan result: nothing here ever modifies the repo.
    """
    __tablename__ = "repository_mappings"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    repo_full_name = Column(String, nullable=True)
    default_branch = Column(String, nullable=True)
    framework = Column(String, default="Unknown")
    pages = Column(JSON, nullable=True)          # list of {url, file_path, type, editable, metadata_location}
    pages_count = Column(Integer, default=0)     # count of type == "page" (route pages only, not layouts/assets)
    truncated = Column(Boolean, default=False)   # GitHub's tree API truncates very large repos
    status = Column(String, default="pending")   # pending | scanning | ready | failed
    error = Column(String, nullable=True)
    scanned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    workspace = relationship("Workspace")


class MetaAdsConnection(Base):
    """Per-workspace Meta (Facebook/Instagram) Ads connection. Stores an access token
    plus the selected ad account so campaigns can be created against it."""
    __tablename__ = "meta_ads_connections"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    access_token = Column(EncryptedString, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    connected_name = Column(String, nullable=True)   # connected Meta user
    ad_account_id = Column(String, nullable=True)    # selected act_ id (without prefix)
    # Every ad creative must be attributed to a Facebook Page — an ad cannot be created
    # without one, so this is required before publishing (not just nice to have).
    page_id = Column(String, nullable=True)
    page_name = Column(String, nullable=True)
    # Default destination URL for ads; falls back to the workspace's company_url.
    default_link_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class GoogleAdsConnection(Base):
    """Per-workspace Google Ads connection. Google access tokens are short-lived (~1hr), so
    unlike Meta's long-lived token we store a refresh_token and mint access tokens on demand."""
    __tablename__ = "google_ads_connections"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    access_token = Column(EncryptedString, nullable=True)
    refresh_token = Column(EncryptedString, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    connected_email = Column(String, nullable=True)   # connected Google account
    customer_id = Column(String, nullable=True)       # selected Google Ads customer id (digits only)
    # Manager (MCC) id to act through, or NULL when the connected Google account can reach
    # customer_id directly. NULL is the normal case for a customer connecting their own
    # account: sending our manager id there would make Google reject the call unless they
    # had first linked their account under our manager.
    login_customer_id = Column(String, nullable=True)
    # True when the SELECTED customer_id is itself a manager (MCC). Campaigns cannot be
    # created inside one, so the UI has to warn before publish rather than after.
    customer_is_manager = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ShopifyConnection(Base):
    """Per-workspace Shopify store connection used to publish approved content as a
    blog article. Articles are created UNPUBLISHED so a human still presses publish.

    The access token is encrypted at rest (see core/crypto.EncryptedString).
    """
    __tablename__ = "shopify_connections"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    shop_domain = Column(String, nullable=True)      # "my-store.myshopify.com"
    shop_name = Column(String, nullable=True)
    access_token = Column(EncryptedString, nullable=True)
    blog_id = Column(Integer, nullable=True)         # selected blog to publish into
    last_synced_at = Column(DateTime, nullable=True)  # last time this connection's data (blogs/pages) was refreshed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ShopifyThemeDraft(Base):
    """A duplicated (unpublished) Shopify theme used as the safe place to apply theme-level
    SEO fixes — the live theme (`live_theme_id`, stored only for reference) is never
    written to. One draft per workspace; creating a new one replaces it.

    Theme ids are stored as strings even though Shopify's REST API returns them as numbers:
    they're identifiers we only ever interpolate into URLs, never do arithmetic on, and
    modern Shopify resource ids routinely exceed Postgres's 32-bit INTEGER range.
    """
    __tablename__ = "shopify_theme_drafts"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    live_theme_id = Column(String, nullable=True)
    live_theme_name = Column(String, nullable=True)
    draft_theme_id = Column(String, nullable=True)
    draft_theme_name = Column(String, nullable=True)
    status = Column(String, default="pending")   # pending | duplicating | ready | failed
    assets_copied = Column(Integer, default=0)
    assets_total = Column(Integer, default=0)
    error = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    workspace = relationship("Workspace")


class WordPressConnection(Base):
    """Per-workspace WordPress connection, in one of two flavours (see `auth_type`):

      - "app_password": a self-hosted site, driven with an Application Password (WP 5.6+)
        over Basic auth against the site's own /wp-json/.
      - "wpcom_oauth": a WordPress.com-hosted site. Those serve no /wp-json/ and have no
        Application Passwords screen, so they are driven with an OAuth bearer token against
        the public-api.wordpress.com wp/v2 proxy (see core/wpcom_oauth.py).

    Both speak the same wp/v2 shape, so core/wordpress_connect.py drives them with one set
    of functions. Posts are created as DRAFTS so a human still presses publish.

    The application password / access token are encrypted at rest (see core/crypto).
    """
    __tablename__ = "wordpress_connections"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    site_url = Column(String, nullable=True)         # "https://example.com"
    site_name = Column(String, nullable=True)
    username = Column(String, nullable=True)
    app_password = Column(EncryptedString, nullable=True)
    display_name = Column(String, nullable=True)     # connected WP user
    last_synced_at = Column(DateTime, nullable=True)  # last time this connection's data (pages) was refreshed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # --- how this connection authenticates. Defaults to app_password so every row that
    # existed before WordPress.com support keeps working untouched.
    auth_type = Column(String, nullable=False, default="app_password")
    access_token = Column(EncryptedString, nullable=True)      # wpcom_oauth only (no expiry, no refresh token)
    wpcom_site_id = Column(String, nullable=True)     # wpcom_oauth only — numeric blog id
    api_base = Column(String, nullable=True)          # wpcom_oauth only — pinned wp/v2 root

    # --- automation. When true, approving a recommendation applies it to the live site
    # immediately, instead of waiting for a manual "Apply SEO fixes" click.
    auto_apply = Column(Boolean, default=False)
    seo_plugin = Column(String, nullable=True)        # "yoast" | "rankmath" | None, cached at connect


class WordPressRevision(Base):
    """A snapshot of one WordPress page taken immediately BEFORE Raftra wrote to it.

    GitHub gets a pull request and Shopify writes are reversible in its admin, but a
    WordPress REST write lands on the live page instantly with no review step of its own.
    This table is therefore the only rollback path, and it is what makes unattended
    auto-apply safe to offer at all: every write is undoable to the exact previous bytes.
    """
    __tablename__ = "wordpress_revisions"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), index=True)
    page_id = Column(Integer)                        # the WordPress page this snapshot is of
    page_title = Column(String, nullable=True)       # label for the undo button
    prev_title = Column(String, nullable=True)       # exact pre-write values
    prev_content = Column(String, nullable=True)
    prev_meta = Column(JSON, nullable=True)          # SEO-plugin meta we overwrote, if any
    applied_fixes = Column(JSON, nullable=True)      # what was applied, for the UI
    auto = Column(Boolean, default=False)            # written by auto-apply vs a manual click
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    reverted_at = Column(DateTime, nullable=True)    # set once undone; never reused after


class PageMapping(Base):
    """Maps one crawled page (by path) to its target location on a specific connected
    platform, so the publishing layer knows exactly where a fix should land once real
    publishing is implemented. One row per (workspace, platform, page_path).

    This is populated by publishing/page_mapping.py — PageMappingService. It reuses the
    existing crawler output (the audit's target_url) rather than crawling again.
    """
    __tablename__ = "page_mappings"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"))
    platform = Column(String)                  # "github" | "wordpress" | "shopify"
    page_path = Column(String)                 # e.g. "/", "/about" — relative to the crawled site
    page_url = Column(String, nullable=True)   # full URL, if known
    target_ref = Column(String, nullable=True)   # GitHub file path | WP post/page id | Shopify page/article id
    target_type = Column(String, nullable=True)  # "file" | "post" | "page" | "article"
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    workspace = relationship("Workspace")


class ScheduledTask(Base):
    """A recurring agent run, as configured in the Marketing Calendar.

    The calendar used to keep schedules in React state, so they vanished on refresh and
    nothing ever ran. Cadence is stored as plain fields rather than a cron string: the UI
    only offers hourly/daily/weekly/monthly, and next_run_at is easier to trust when the
    arithmetic behind it is readable.
    """
    __tablename__ = "scheduled_tasks"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), index=True)
    name = Column(String, nullable=False)
    agent = Column(String, nullable=False)          # creative | campaign | seo | geo | ...
    cadence = Column(String, nullable=False, default="daily")
    hour = Column(Integer, default=9)               # UTC
    minute = Column(Integer, default=0)
    weekday = Column(Integer, nullable=True)        # 0=Mon, weekly only
    day_of_month = Column(Integer, nullable=True)   # monthly only
    prompt = Column(Text, nullable=True)            # what the agent is asked to do
    enabled = Column(Boolean, default=True)

    # Outcome of the most recent run, shown in the calendar so a failing schedule is
    # visible without digging through logs.
    last_run_at = Column(DateTime, nullable=True)
    last_status = Column(String, nullable=True)     # success | failed
    last_message = Column(String, nullable=True)
    next_run_at = Column(DateTime, nullable=True, index=True)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class CompetitorReport(Base):
    """A saved competitor analysis, so Market Intelligence has something to show on load.

    Without this the research endpoint answered once and the result died with the component's
    state - the section would be empty again on every refresh, which is what made it look
    like it had no data source. Keyed by workspace + competitor so re-running a competitor
    refreshes its report instead of stacking duplicates.
    """
    __tablename__ = "competitor_reports"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), index=True)

    competitor = Column(String, nullable=False)     # as typed
    site_url = Column(String, nullable=True)        # what was actually read

    positioning = Column(Text, nullable=True)
    audience = Column(Text, nullable=True)
    tone = Column(String, nullable=True)
    offers = Column(JSON, default=list)
    hooks = Column(JSON, default=list)
    ctas = Column(JSON, default=list)
    notes = Column(Text, nullable=True)

    # The pages the analysis was drawn from, kept so every claim above stays checkable.
    sources = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow)


class BrandEvent(Base):
    """A date the brand wants to plan campaigns around - a sale, a launch, a festival.

    The Marketing Calendar let you add these and kept them in React state, so every custom
    event disappeared on refresh. The built-in Indian retail dates stay in the frontend as a
    fixed reference; this table holds what the user adds.
    """
    __tablename__ = "brand_events"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), index=True)
    name = Column(String, nullable=False)
    event_date = Column(DateTime, nullable=False)   # the day it happens
    category = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class CompetitorAd(Base):
    """One active ad of a competitor's, as read from the Meta Ad Library on the
    fortnightly sync.

    Separate from CompetitorReport, which analyses a rival's own website. That answers
    "what do they say they are"; this answers "what are they paying to say right now",
    and only the second one carries days_active - the fatigue signal that separates a
    proven creative from one the rival already killed.

    `source` is stored per row rather than assumed, because the official Meta API covers
    commercial ads in EU/EEA countries only and everywhere else the rows come from a
    third-party collector. The UI shows it, so nothing is ever passed off as first-party
    Meta data when it is not.
    """
    __tablename__ = "competitor_ads"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), index=True)

    competitor_name = Column(String, nullable=False, index=True)
    external_id = Column(String, nullable=True, index=True)   # the ad's id at the source
    ad_title = Column(String, nullable=True)
    ad_copy = Column(Text, nullable=True)
    snapshot_url = Column(String, nullable=True)              # the ad in Meta's Ad Library
    platforms = Column(JSON, default=list)                    # facebook | instagram | ...

    offers = Column(JSON, default=dict)     # {"code","percent_off","flat_off","perks"}
    started_at = Column(DateTime, nullable=True)
    days_active = Column(Integer, nullable=True)

    country = Column(String, default="IN")
    source = Column(String, default="Meta Ad Library API")
    synced_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)


class CompetitorAdStrategy(Base):
    """The strategy read over one competitor's ad set - one row per workspace+competitor,
    replaced on each sync so the screen shows the current picture rather than a pile of
    historical analyses."""
    __tablename__ = "competitor_ad_strategies"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), index=True)
    competitor_name = Column(String, nullable=False, index=True)

    summary = Column(Text, nullable=True)
    offer_strategy = Column(Text, nullable=True)
    evergreen_winners = Column(JSON, default=list)
    fatiguing = Column(JSON, default=list)
    blue_ocean = Column(JSON, default=dict)      # {"title","rationale","actions"}
    red_ocean = Column(JSON, default=dict)
    recommended_formats = Column(JSON, default=list)

    ads_analysed = Column(Integer, default=0)
    country = Column(String, default="IN")
    synced_at = Column(DateTime, default=datetime.datetime.utcnow)


class MarketTrendReport(Base):
    """A four-weekly search + creator-video read on the brand's category.

    Reports are kept rather than overwritten: the value of a radar is the comparison
    between this month and last, so `period_end` orders them and old ones stay readable.
    """
    __tablename__ = "market_trend_reports"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), index=True)

    report_title = Column(String, nullable=False)
    summary = Column(Text, nullable=True)
    region = Column(String, default="IN")
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True, index=True)

    strategic_keywords = Column(JSON, default=list)   # [{keyword, score, bucket, hook}]
    winning_patterns = Column(JSON, default=list)
    creative_formats = Column(JSON, default=list)
    creator_video_refs = Column(JSON, default=list)   # [{title, channel, url, ...}]

    # Which APIs actually answered. Shown in the UI so a thin report is legibly a thin
    # report rather than a thin market.
    sources = Column(JSON, default=list)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class SyncRun(Base):
    """One execution of a scheduled external sync, successful or not.

    Without this the fortnightly and four-weekly jobs are invisible: the UI cannot say
    when data was last refreshed, and a job that has been failing for a month looks
    identical to a market with no news.
    """
    __tablename__ = "sync_runs"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), index=True)
    kind = Column(String, nullable=False, index=True)   # competitor_ads | market_trends
    status = Column(String, nullable=False)             # success | failed | skipped
    message = Column(String, nullable=True)
    items = Column(Integer, default=0)
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)


class MediaAsset(Base):
    """One image belonging to a workspace's Asset Vault.

    The vault's UI has always understood four sources - generated, scraped, gdrive, device -
    but only `generated` had anywhere to live (ad_assets). A brand's own product photography
    and banners, and anything imported from Drive, existed in React state and vanished on
    refresh. This is where the other three persist.

    Deliberately separate from ad_assets: that table is a generated creative with a prompt,
    provider, review status and campaign lineage. These are source material, and giving them
    the same row would leave two thirds of both tables permanently null.
    """
    __tablename__ = "media_assets"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), index=True)

    category = Column(String, index=True)     # product_shots | lifestyle | banners | logos
    source = Column(String, index=True)       # scraped | gdrive | device | generated
    filename = Column(String, nullable=False)
    # Where it lives now. For a scraped asset this is the brand's own CDN URL - we link
    # rather than copy, so the vault never serves a stale duplicate of a product shot the
    # brand has since replaced.
    storage_url = Column(String, nullable=False)
    source_url = Column(String, nullable=True)   # the page/file it came from
    alt_text = Column(String, nullable=True)     # the site's own description, when it had one

    mime_type = Column(String, nullable=True)
    file_format = Column(String, nullable=True)  # PNG | JPG | WEBP | SVG
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    file_size_kb = Column(Float, nullable=True)

    tags = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow, index=True)


class Tenant(Base):
    """An organisation. The unit that owns brands and pays the bill.

    Before this, a workspace belonged to one user, so "customer" and "person" were the same
    row - an agency could not put two people on one brand without sharing a password. A
    tenant sits above workspaces so several people can work across several brands.

    UUID rather than a serial: tenant ids travel in URLs and API payloads, and sequential
    integers advertise how many customers exist and invite enumeration.
    """
    __tablename__ = "tenants"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=text("NOW()"))

    members = relationship("TenantMember", back_populates="tenant",
                           cascade="all, delete-orphan")
    workspaces = relationship("Workspace", back_populates="tenant")


class TenantMember(Base):
    """A person's membership of an organisation, and what they may do in it.

    Membership - not workspace.user_id - is what every RLS policy resolves against now, so
    adding a row here is the whole act of giving a colleague access to every brand in the
    org. Removing it revokes that access everywhere at once.
    """
    __tablename__ = "tenant_members"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"),
                       primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"),
                     primary_key=True, index=True)
    # owner: billing and deletion. admin: manage members. member: use the workspaces.
    role = Column(String, nullable=False, default="member")
    created_at = Column(DateTime, server_default=text("NOW()"))

    tenant = relationship("Tenant", back_populates="members")
    user = relationship("User")
