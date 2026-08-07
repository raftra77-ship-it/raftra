from sqlalchemy import Boolean, Column, Integer, String, Float, ForeignKey, DateTime, JSON
from sqlalchemy.orm import relationship
import datetime
from pgvector.sqlalchemy import Vector
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
    refresh_token = Column(String, nullable=True)   # long-lived; mints access tokens
    access_token = Column(String, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    scopes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class GitHubConnection(Base):
    """Per-workspace GitHub connection used to apply approved changes to the site's
    repo (commit content/SEO files as a pull request). One connection per workspace.

    NOTE: the access token is stored as-is; in production encrypt it at rest.
    """
    __tablename__ = "github_connections"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    access_token = Column(String, nullable=True)
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
    access_token = Column(String, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    connected_name = Column(String, nullable=True)   # connected Meta user
    ad_account_id = Column(String, nullable=True)    # selected act_ id (without prefix)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class GoogleAdsConnection(Base):
    """Per-workspace Google Ads connection. Google access tokens are short-lived (~1hr), so
    unlike Meta's long-lived token we store a refresh_token and mint access tokens on demand."""
    __tablename__ = "google_ads_connections"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    access_token = Column(String, nullable=True)
    refresh_token = Column(String, nullable=True)
    token_expiry = Column(DateTime, nullable=True)
    connected_email = Column(String, nullable=True)   # connected Google account
    customer_id = Column(String, nullable=True)       # selected Google Ads customer id (digits only)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ShopifyConnection(Base):
    """Per-workspace Shopify store connection used to publish approved content as a
    blog article. Articles are created UNPUBLISHED so a human still presses publish.

    NOTE: the access token is stored as-is; in production encrypt it at rest.
    """
    __tablename__ = "shopify_connections"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    shop_domain = Column(String, nullable=True)      # "my-store.myshopify.com"
    shop_name = Column(String, nullable=True)
    access_token = Column(String, nullable=True)
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

    NOTE: the application password / access token are stored as-is; in production encrypt
    them at rest.
    """
    __tablename__ = "wordpress_connections"

    id = Column(Integer, primary_key=True, index=True)
    workspace_id = Column(Integer, ForeignKey("workspaces.id"), unique=True)
    site_url = Column(String, nullable=True)         # "https://example.com"
    site_name = Column(String, nullable=True)
    username = Column(String, nullable=True)
    app_password = Column(String, nullable=True)
    display_name = Column(String, nullable=True)     # connected WP user
    last_synced_at = Column(DateTime, nullable=True)  # last time this connection's data (pages) was refreshed
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # --- how this connection authenticates. Defaults to app_password so every row that
    # existed before WordPress.com support keeps working untouched.
    auth_type = Column(String, nullable=False, default="app_password")
    access_token = Column(String, nullable=True)      # wpcom_oauth only (no expiry, no refresh token)
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
