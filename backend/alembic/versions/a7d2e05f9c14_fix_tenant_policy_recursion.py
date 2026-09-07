"""Break the RLS recursion on tenant_members, and route every policy through one function.

Revision ID: a7d2e05f9c14
Revises: f61a9c204db3
Create Date: 2026-09-06

f61a9c204db3 gave tenant_members a policy that reads tenant_members:

    user_id = <me> OR tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = <me>)

Evaluating that policy requires reading the table, which applies the policy, which requires
reading the table. Postgres detects it and refuses:

    infinite recursion detected in policy for relation "tenant_members"

That took out every request, because all the workspace policies resolve membership.

The fix is the standard one: a SECURITY DEFINER function. It executes as its owner rather
than the caller, so the read inside it is not subject to RLS and the cycle cannot form.
Every policy now calls it, which also makes the rule easier to reason about - there is one
definition of "workspaces I can see" instead of the same subquery pasted into 35 policies.

Marked STABLE so Postgres evaluates it once per statement rather than per row, and given an
empty search_path so the function body cannot be hijacked by a caller's search_path.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a7d2e05f9c14'
down_revision: Union[str, Sequence[str], None] = 'f61a9c204db3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

WORKSPACE_TABLES = [
    "ad_assets", "agent_memories", "agent_tasks", "brand_events", "brand_profiles",
    "campaigns", "chat_messages", "competitor_ad_strategies", "competitor_ads",
    "competitor_reports", "content_drafts", "deal_applications", "github_connections",
    "google_ads_connections", "influencer_deals", "influencers", "integrations",
    "market_trend_reports", "media_assets", "meta_ads_connections", "page_mappings",
    "posted_deal_notifications", "posted_deals", "repository_mappings", "scheduled_tasks",
    "search_console_connections", "seo_audits", "shopify_connections",
    "shopify_theme_drafts", "social_posts", "subscriptions", "sync_runs",
    "wordpress_connections", "wordpress_revisions",
]


def upgrade() -> None:
    op.execute("""
        CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS integer
        LANGUAGE sql STABLE
        SET search_path = ''
        AS $$ SELECT NULLIF(current_setting('app.user_id', true), '')::int $$;
    """)

    # SECURITY DEFINER: runs as the function owner, so this read bypasses RLS and the
    # policy on tenant_members cannot recurse into itself.
    op.execute("""
        CREATE OR REPLACE FUNCTION app_my_tenant_ids() RETURNS SETOF uuid
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public
        AS $$ SELECT tenant_id FROM tenant_members WHERE user_id = app_current_user_id() $$;
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION app_my_workspace_ids() RETURNS SETOF integer
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public
        AS $$
          SELECT id FROM workspaces
          WHERE tenant_id IN (SELECT app_my_tenant_ids())
             -- A workspace whose tenant_id was never backfilled stays reachable by its
             -- creator, so one missed row cannot lock someone out of their own brand.
             OR (tenant_id IS NULL AND user_id = app_current_user_id())
        $$;
    """)

    op.execute("GRANT EXECUTE ON FUNCTION app_current_user_id(), app_my_tenant_ids(), "
               "app_my_workspace_ids() TO raftra_app")

    for table in WORKSPACE_TABLES:
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON %s" % table)
        op.execute(
            "CREATE POLICY tenant_isolation ON %s "
            "USING (workspace_id IN (SELECT app_my_workspace_ids())) "
            "WITH CHECK (workspace_id IN (SELECT app_my_workspace_ids()))" % table)

    op.execute("DROP POLICY IF EXISTS tenant_isolation ON workspaces")
    op.execute(
        "CREATE POLICY tenant_isolation ON workspaces "
        "USING (id IN (SELECT app_my_workspace_ids())) "
        "WITH CHECK (tenant_id IN (SELECT app_my_tenant_ids()) "
        "            OR (tenant_id IS NULL AND user_id = app_current_user_id()))")

    op.execute("DROP POLICY IF EXISTS tenant_isolation ON tenants")
    op.execute("CREATE POLICY tenant_isolation ON tenants "
               "USING (id IN (SELECT app_my_tenant_ids())) "
               "WITH CHECK (id IN (SELECT app_my_tenant_ids()))")

    # The one that was recursing. Reading through the function means a member can see who
    # else is in their org, without the table's own policy consulting the table.
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON tenant_members")
    op.execute("CREATE POLICY tenant_isolation ON tenant_members "
               "USING (tenant_id IN (SELECT app_my_tenant_ids())) "
               "WITH CHECK (tenant_id IN (SELECT app_my_tenant_ids()))")


def downgrade() -> None:
    inline = ("SELECT w.id FROM workspaces w "
              "JOIN tenant_members m ON m.tenant_id = w.tenant_id "
              "WHERE m.user_id = NULLIF(current_setting('app.user_id', true), '')::int")
    for table in WORKSPACE_TABLES:
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON %s" % table)
        op.execute("CREATE POLICY tenant_isolation ON %s "
                   "USING (workspace_id IN (%s)) WITH CHECK (workspace_id IN (%s))"
                   % (table, inline, inline))
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON tenant_members")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON tenants")
    op.execute("DROP FUNCTION IF EXISTS app_my_workspace_ids()")
    op.execute("DROP FUNCTION IF EXISTS app_my_tenant_ids()")
    op.execute("DROP FUNCTION IF EXISTS app_current_user_id()")
