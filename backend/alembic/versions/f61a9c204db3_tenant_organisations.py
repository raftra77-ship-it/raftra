"""Real multi-user organisations: tenants, membership, and tenant-scoped RLS.

Revision ID: f61a9c204db3
Revises: e58c1d3f7a92
Create Date: 2026-09-06

Until now a workspace was owned by exactly one user (workspaces.user_id), so "tenant" and
"person" were the same thing. That makes the product unusable for the case it is sold into:
an agency with several people working across several brands. There was no way to add a
colleague to a workspace without sharing a login.

This introduces the missing layer:

    tenants          an organisation
    tenant_members   which users belong to it, and in what role
    workspaces.tenant_id   which organisation a brand belongs to

Access control moves from "this workspace's user_id is me" to "I am a member of this
workspace's tenant", which is the whole point - a second member of the org sees the same
brands without anything being re-shared.

BACKFILL IS BEHAVIOUR-PRESERVING. Every existing user gets a personal tenant and is made
its owner; their workspaces are attached to it. On day one every tenant has exactly one
member, so nobody's visibility changes by a single row. Multi-user is then an invite away
rather than a migration away.

workspaces.user_id is deliberately KEPT. It is read in a number of places, and it remains
meaningful as "who created this workspace"; it is simply no longer the access predicate.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'f61a9c204db3'
down_revision: Union[str, Sequence[str], None] = 'e58c1d3f7a92'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CURRENT_USER = "NULLIF(current_setting('app.user_id', true), '')::int"

# Every table whose isolation predicate has to move from user-ownership to org-membership.
# Same list as the RLS migration that established these policies (d47b2e8135ac), plus
# media_assets from e58c1d3f7a92.
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

# A workspace this user can reach through org membership. Used by every policy below.
_MY_WORKSPACES = (
    "SELECT w.id FROM workspaces w "
    "JOIN tenant_members m ON m.tenant_id = w.tenant_id "
    "WHERE m.user_id = %s" % _CURRENT_USER
)


def upgrade() -> None:
    # pgcrypto for gen_random_uuid(). Supabase has it, but a bare Postgres may not.
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")

    op.create_table(
        'tenants',
        sa.Column('id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'tenant_members',
        sa.Column('tenant_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        # owner: billing and deletion. admin: manage members. member: use the workspaces.
        sa.Column('role', sa.String(), nullable=False, server_default='member'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('tenant_id', 'user_id'),
    )
    op.create_index('ix_tenant_members_user_id', 'tenant_members', ['user_id'])

    op.add_column('workspaces',
                  sa.Column('tenant_id', sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index('ix_workspaces_tenant_id', 'workspaces', ['tenant_id'])
    op.create_foreign_key('fk_workspaces_tenant', 'workspaces', 'tenants',
                          ['tenant_id'], ['id'])

    # ---- Backfill: one personal tenant per user, owner membership, workspaces attached ----
    #
    # Tenant and membership are created in ONE statement, keyed on users.id. An earlier
    # version inserted the tenants first and then joined membership back on the generated
    # NAME - which silently cross-produced for two users who happened to share one ("Test
    # User" x2), putting each of them in the other's organisation. A name is not an
    # identifier; the only safe key here is the user id.
    #
    # `created_by` is a temporary column carrying that key through the CTE. It is dropped
    # immediately afterwards, so it never becomes part of the schema.
    op.add_column('tenants', sa.Column('created_by', sa.Integer(), nullable=True))
    op.execute("""
        WITH new_tenants AS (
            INSERT INTO tenants (id, name, created_by)
            SELECT gen_random_uuid(),
                   COALESCE(NULLIF(TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')), ''),
                            u.username, u.email, 'Workspace ' || u.id),
                   u.id
            FROM users u
            WHERE NOT EXISTS (SELECT 1 FROM tenant_members m WHERE m.user_id = u.id)
            RETURNING id, created_by
        )
        INSERT INTO tenant_members (tenant_id, user_id, role)
        SELECT id, created_by, 'owner' FROM new_tenants
    """)
    op.drop_column('tenants', 'created_by')
    op.execute("""
        UPDATE workspaces w
        SET tenant_id = m.tenant_id
        FROM tenant_members m
        WHERE m.user_id = w.user_id AND w.tenant_id IS NULL
    """)

    # ---- Policies now resolve through membership rather than direct ownership ----
    for table in WORKSPACE_TABLES:
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON %s" % table)
        op.execute(
            "CREATE POLICY tenant_isolation ON %s "
            "USING (workspace_id IN (%s)) WITH CHECK (workspace_id IN (%s))"
            % (table, _MY_WORKSPACES, _MY_WORKSPACES)
        )

    # workspaces itself: reachable when the user belongs to its tenant. The user_id fallback
    # keeps a workspace readable if its tenant_id were ever left null by a failed backfill,
    # so a bad migration cannot lock someone out of their own data.
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON workspaces")
    op.execute(
        "CREATE POLICY tenant_isolation ON workspaces "
        "USING (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = {u}) "
        "       OR (tenant_id IS NULL AND user_id = {u})) "
        "WITH CHECK (tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = {u}) "
        "       OR (tenant_id IS NULL AND user_id = {u}))".format(u=_CURRENT_USER)
    )

    # The two org tables need their own policies, or raftra_app cannot read the membership
    # the policies above depend on.
    for tbl, pred in (
        ("tenants", "id IN (SELECT tenant_id FROM tenant_members WHERE user_id = %s)" % _CURRENT_USER),
        ("tenant_members", "user_id = {u} OR tenant_id IN (SELECT tenant_id FROM tenant_members WHERE user_id = {u})".format(u=_CURRENT_USER)),
    ):
        op.execute("ALTER TABLE %s ENABLE ROW LEVEL SECURITY" % tbl)
        op.execute("ALTER TABLE %s FORCE ROW LEVEL SECURITY" % tbl)
        op.execute("CREATE POLICY tenant_isolation ON %s USING (%s) WITH CHECK (%s)"
                   % (tbl, pred, pred))

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON tenants, tenant_members TO raftra_app")


def downgrade() -> None:
    # Restore the direct-ownership policies from d47b2e8135ac.
    owned = ("SELECT id FROM workspaces WHERE user_id = %s" % _CURRENT_USER)
    for table in WORKSPACE_TABLES:
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON %s" % table)
        op.execute("CREATE POLICY tenant_isolation ON %s "
                   "USING (workspace_id IN (%s)) WITH CHECK (workspace_id IN (%s))"
                   % (table, owned, owned))
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON workspaces")
    op.execute("CREATE POLICY tenant_isolation ON workspaces "
               "USING (user_id = {u}) WITH CHECK (user_id = {u})".format(u=_CURRENT_USER))

    for tbl in ("tenants", "tenant_members"):
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON %s" % tbl)

    op.drop_constraint('fk_workspaces_tenant', 'workspaces', type_='foreignkey')
    op.drop_index('ix_workspaces_tenant_id', table_name='workspaces')
    op.drop_column('workspaces', 'tenant_id')
    op.drop_table('tenant_members')
    op.drop_table('tenants')
