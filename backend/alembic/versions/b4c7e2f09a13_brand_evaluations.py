"""Brand consistency evaluations: scored history of generated assets against the vault.

Revision ID: b4c7e2f09a13
Revises: a7d2e05f9c14
Create Date: 2026-10-17

Generated creatives were never checked against the brand they were generated for. This is
where that check is recorded - one row per evaluation run, never updated in place, so a
changed verdict can be traced to the brand being edited (profile_fingerprint), the rule set
changing (criteria_version) or a different model being used (models_used).

RLS follows the shape a7d2e05f9c14 established: every workspace-scoped table routes through
app_my_workspace_ids(), rather than pasting the membership subquery in again. The default
privileges granted in d47b2e8135ac already cover raftra_app on new tables in this schema,
so no further GRANT is needed here.

ON DELETE CASCADE on both foreign keys: an evaluation describes an asset belonging to a
workspace, and has no meaning once either is gone.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b4c7e2f09a13'
down_revision: Union[str, Sequence[str], None] = 'a7d2e05f9c14'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'brand_evaluations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workspace_id', sa.Integer(), nullable=False),
        sa.Column('ad_asset_id', sa.Integer(), nullable=True),
        sa.Column('media_type', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('overall_score', sa.Integer(), nullable=True),
        sa.Column('dimension_scores', sa.JSON(), nullable=True),
        sa.Column('violations', sa.JSON(), nullable=True),
        sa.Column('unknowns', sa.JSON(), nullable=True),
        sa.Column('profile_fingerprint', sa.String(), nullable=True),
        sa.Column('criteria_version', sa.String(), nullable=True),
        sa.Column('models_used', sa.JSON(), nullable=True),
        sa.Column('tiers_run', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ad_asset_id'], ['ad_assets.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_brand_evaluations_workspace_id', 'brand_evaluations',
                    ['workspace_id'])
    op.create_index('ix_brand_evaluations_ad_asset_id', 'brand_evaluations',
                    ['ad_asset_id'])
    op.create_index('ix_brand_evaluations_status', 'brand_evaluations', ['status'])
    op.create_index('ix_brand_evaluations_profile_fingerprint', 'brand_evaluations',
                    ['profile_fingerprint'])
    op.create_index('ix_brand_evaluations_created_at', 'brand_evaluations', ['created_at'])

    # The read the API actually makes: the latest evaluation for one asset.
    op.create_index('ix_brand_evaluations_asset_created', 'brand_evaluations',
                    ['ad_asset_id', 'created_at'])

    op.execute("ALTER TABLE brand_evaluations ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE brand_evaluations FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON brand_evaluations "
        "USING (workspace_id IN (SELECT app_my_workspace_ids())) "
        "WITH CHECK (workspace_id IN (SELECT app_my_workspace_ids()))")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON brand_evaluations")
    op.drop_table('brand_evaluations')
