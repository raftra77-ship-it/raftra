"""Brand intelligence pipeline: design tokens, competitor ad vault, market-trend radar.

Revision ID: c31f4a90b7e2
Revises: a9cac0df4345
Create Date: 2026-09-04

Adds:
  * brand_profiles.color_tokens / .logos - named design tokens and logo assets, which the
    crawl now extracts but had nowhere to live.
  * competitor_ads + competitor_ad_strategies - the fortnightly Meta Ad Library sync.
  * market_trend_reports - the four-weekly search + creator-video radar.
  * sync_runs - one row per scheduled sync, so a job failing for a month is visible rather
    than looking like a quiet market.

Every table carries workspace_id, indexed: it is both the tenancy boundary and the only
access path any query uses.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'c31f4a90b7e2'
down_revision: Union[str, Sequence[str], None] = 'a9cac0df4345'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('brand_profiles', sa.Column('color_tokens', sa.JSON(), nullable=True))
    op.add_column('brand_profiles', sa.Column('logos', sa.JSON(), nullable=True))

    op.create_table(
        'competitor_ads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workspace_id', sa.Integer(), nullable=True),
        sa.Column('competitor_name', sa.String(), nullable=False),
        sa.Column('external_id', sa.String(), nullable=True),
        sa.Column('ad_title', sa.String(), nullable=True),
        sa.Column('ad_copy', sa.Text(), nullable=True),
        sa.Column('snapshot_url', sa.String(), nullable=True),
        sa.Column('platforms', sa.JSON(), nullable=True),
        sa.Column('offers', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('days_active', sa.Integer(), nullable=True),
        sa.Column('country', sa.String(), nullable=True),
        sa.Column('source', sa.String(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_competitor_ads_workspace_id', 'competitor_ads', ['workspace_id'])
    op.create_index('ix_competitor_ads_competitor_name', 'competitor_ads', ['competitor_name'])
    op.create_index('ix_competitor_ads_external_id', 'competitor_ads', ['external_id'])
    op.create_index('ix_competitor_ads_synced_at', 'competitor_ads', ['synced_at'])

    op.create_table(
        'competitor_ad_strategies',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workspace_id', sa.Integer(), nullable=True),
        sa.Column('competitor_name', sa.String(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('offer_strategy', sa.Text(), nullable=True),
        sa.Column('evergreen_winners', sa.JSON(), nullable=True),
        sa.Column('fatiguing', sa.JSON(), nullable=True),
        sa.Column('blue_ocean', sa.JSON(), nullable=True),
        sa.Column('red_ocean', sa.JSON(), nullable=True),
        sa.Column('recommended_formats', sa.JSON(), nullable=True),
        sa.Column('ads_analysed', sa.Integer(), nullable=True),
        sa.Column('country', sa.String(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_competitor_ad_strategies_workspace_id', 'competitor_ad_strategies',
                    ['workspace_id'])
    op.create_index('ix_competitor_ad_strategies_competitor_name', 'competitor_ad_strategies',
                    ['competitor_name'])

    op.create_table(
        'market_trend_reports',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workspace_id', sa.Integer(), nullable=True),
        sa.Column('report_title', sa.String(), nullable=False),
        sa.Column('summary', sa.Text(), nullable=True),
        sa.Column('region', sa.String(), nullable=True),
        sa.Column('period_start', sa.DateTime(), nullable=True),
        sa.Column('period_end', sa.DateTime(), nullable=True),
        sa.Column('strategic_keywords', sa.JSON(), nullable=True),
        sa.Column('winning_patterns', sa.JSON(), nullable=True),
        sa.Column('creative_formats', sa.JSON(), nullable=True),
        sa.Column('creator_video_refs', sa.JSON(), nullable=True),
        sa.Column('sources', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_market_trend_reports_workspace_id', 'market_trend_reports', ['workspace_id'])
    op.create_index('ix_market_trend_reports_period_end', 'market_trend_reports', ['period_end'])

    op.create_table(
        'sync_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workspace_id', sa.Integer(), nullable=True),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('message', sa.String(), nullable=True),
        sa.Column('items', sa.Integer(), nullable=True),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('finished_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_sync_runs_workspace_id', 'sync_runs', ['workspace_id'])
    op.create_index('ix_sync_runs_kind', 'sync_runs', ['kind'])


def downgrade() -> None:
    op.drop_table('sync_runs')
    op.drop_table('market_trend_reports')
    op.drop_table('competitor_ad_strategies')
    op.drop_table('competitor_ads')
    op.drop_column('brand_profiles', 'logos')
    op.drop_column('brand_profiles', 'color_tokens')
