"""Row Level Security: enforce tenant isolation in the database, not just the app.

Revision ID: d47b2e8135ac
Revises: c31f4a90b7e2
Create Date: 2026-09-05

Until now isolation was entirely application-level: every route called
`_require_workspace()` and every query carried a `workspace_id` filter written by hand.
That works right up until one query forgets, and then a tenant reads another tenant's
brand kit with no error anywhere. RLS turns that class of bug into zero rows.

HOW THIS WORKS, because the obvious approach silently does nothing:

  RLS is bypassed for superusers, and this backend connects to Supabase as `postgres`.
  Policies written against a superuser connection look correct in the schema and enforce
  nothing at all - strictly worse than no RLS, because it reads as protection.

  So the request path switches role inside its transaction:

      SET LOCAL ROLE raftra_app;              -- non-superuser => RLS applies
      SET LOCAL app.user_id = '<id>';         -- who the policies filter for

  `SET LOCAL` is scoped to the transaction and reverts on commit/rollback, so a pooled
  connection can never leak one request's identity into the next. `raftra_app` is NOLOGIN:
  nothing ever connects as it, we only switch into it, so there is no new password to
  manage or rotate.

  Background work (agents, schedulers, Celery - 41 direct SessionLocal() call sites) does
  NOT switch role, so it keeps running as `postgres` and bypasses RLS. That is deliberate:
  those jobs legitimately act across every workspace, they already scope their own queries
  by workspace_id, and they carry no end-user input. The untrusted surface is HTTP, and
  that is the surface this covers.

  `current_setting('app.user_id', true)` returns NULL when unset, and every policy compares
  against it, so a session that forgets to set it sees nothing rather than everything.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd47b2e8135ac'
down_revision: Union[str, Sequence[str], None] = 'c31f4a90b7e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

APP_ROLE = "raftra_app"

# Tables keyed by workspace. The tenant test is "does this workspace belong to the current
# user", so each policy joins back to workspaces rather than trusting workspace_id alone.
WORKSPACE_TABLES = [
    "ad_assets", "agent_memories", "agent_tasks", "brand_events", "brand_profiles",
    "campaigns", "chat_messages", "competitor_ad_strategies", "competitor_ads",
    "competitor_reports", "content_drafts", "deal_applications", "github_connections",
    "google_ads_connections", "influencer_deals", "influencers", "integrations",
    "market_trend_reports", "meta_ads_connections", "page_mappings",
    "posted_deal_notifications", "posted_deals", "repository_mappings", "scheduled_tasks",
    "search_console_connections", "seo_audits", "shopify_connections",
    "shopify_theme_drafts", "social_posts", "subscriptions", "sync_runs",
    "wordpress_connections", "wordpress_revisions",
]

# Tables keyed directly by the owning user.
USER_TABLES = ["workspaces", "notifications", "auth_events"]

# Deliberately left without RLS:
#   users, plans            - login must read users before any identity exists, and plans
#                             are global reference data.
#   transactions            - keyed to users but read only through payment webhooks that
#                             run as the worker role.
#   creator_payout_requests, deal_deliverable_submissions
#                           - creator-facing, reached by unauthenticated creators through
#                             capability links; they have no workspace owner to filter on.

_CURRENT_USER = "NULLIF(current_setting('app.user_id', true), '')::int"


def _ensure_protected_tables_exist() -> list:
    """Create any table this revision protects that the chain has not built yet.

    Every table below is in models.py, but only some are created by an earlier revision -
    the rest existed because models.Base.metadata.create_all() runs at main.py import and
    had already made them on the deployed database. On an empty one the loops below hit
    `relation "agent_memories" does not exist` and the whole chain stopped, so
    `alembic upgrade head` could not build a database from scratch.

    Creating them here rather than skipping them is deliberate. A skip would leave the
    table to be created later by create_all, with no RLS on it and no error anywhere -
    a table silently outside tenant isolation is a worse outcome than a failed migration.
    Everything this revision names must end up protected, so anything missing is built
    first, from the same metadata create_all uses, which keeps one definition of each table.

    Returns the tables it had to create, for the log line below. On the deployed database
    that list is empty and this function does nothing at all.
    """
    import models                                   # noqa: F401  (registers the metadata)
    from database import Base

    bind = op.get_bind()
    insp = sa.inspect(bind)
    missing = [t for t in (WORKSPACE_TABLES + USER_TABLES) if not insp.has_table(t)]
    if not missing:
        return []

    # agent_memories and knowledge_chunks carry pgvector columns. Supabase ships the
    # extension; it just has to be enabled, the same way f61a9c204db3 enables pgcrypto.
    if any(t in missing for t in ("agent_memories", "knowledge_chunks")):
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # checkfirst, and sorted_tables order, so foreign keys land after their targets.
    for table in Base.metadata.sorted_tables:
        if table.name in missing:
            table.create(bind=bind, checkfirst=True)
    return missing


def upgrade() -> None:
    # 1) The role we switch into. NOLOGIN: it is a permission set, not an account.
    op.execute(
        "DO $$ BEGIN "
        "  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '%s') THEN "
        "    CREATE ROLE %s NOLOGIN; "
        "  END IF; "
        "END $$;" % (APP_ROLE, APP_ROLE)
    )
    op.execute("GRANT USAGE ON SCHEMA public TO %s" % APP_ROLE)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %s" % APP_ROLE)
    op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %s" % APP_ROLE)
    # Tables added by later migrations must not silently become unreadable.
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public "
               "GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %s" % APP_ROLE)
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public "
               "GRANT USAGE, SELECT ON SEQUENCES TO %s" % APP_ROLE)

    # The connecting user must be able to assume the role.
    op.execute("GRANT %s TO CURRENT_USER" % APP_ROLE)

    # Nothing below can protect a table that is not there yet.
    _created = _ensure_protected_tables_exist()
    if _created:
        print("[rls] created %d table(s) the chain had not built yet: %s"
              % (len(_created), ", ".join(sorted(_created))))

    # 2) Workspace-scoped tables.
    for table in WORKSPACE_TABLES:
        op.execute("ALTER TABLE %s ENABLE ROW LEVEL SECURITY" % table)
        # FORCE so the table owner is subject to its own policies too - without this, a
        # connection that happens to own the table quietly skips every rule below.
        op.execute("ALTER TABLE %s FORCE ROW LEVEL SECURITY" % table)
        op.execute(
            "CREATE POLICY tenant_isolation ON %s "
            "USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = %s)) "
            "WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = %s))"
            % (table, _CURRENT_USER, _CURRENT_USER)
        )

    # 3) User-scoped tables.
    for table in USER_TABLES:
        op.execute("ALTER TABLE %s ENABLE ROW LEVEL SECURITY" % table)
        op.execute("ALTER TABLE %s FORCE ROW LEVEL SECURITY" % table)
        op.execute(
            "CREATE POLICY tenant_isolation ON %s "
            "USING (user_id = %s) WITH CHECK (user_id = %s)"
            % (table, _CURRENT_USER, _CURRENT_USER)
        )


def downgrade() -> None:
    for table in WORKSPACE_TABLES + USER_TABLES:
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON %s" % table)
        op.execute("ALTER TABLE %s NO FORCE ROW LEVEL SECURITY" % table)
        op.execute("ALTER TABLE %s DISABLE ROW LEVEL SECURITY" % table)

    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public "
               "REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM %s" % APP_ROLE)
    op.execute("ALTER DEFAULT PRIVILEGES IN SCHEMA public "
               "REVOKE USAGE, SELECT ON SEQUENCES FROM %s" % APP_ROLE)
    op.execute("REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %s" % APP_ROLE)
    op.execute("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %s" % APP_ROLE)
    op.execute("REVOKE USAGE ON SCHEMA public FROM %s" % APP_ROLE)
    op.execute("DROP ROLE IF EXISTS %s" % APP_ROLE)
