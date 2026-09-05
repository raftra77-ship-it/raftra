"""Media Asset Vault: persist scraped, Drive-imported and uploaded brand assets.

Revision ID: e58c1d3f7a92
Revises: d47b2e8135ac
Create Date: 2026-09-05

The Asset Vault UI already understood four sources (generated, scraped, gdrive, device) but
only `generated` had storage. A brand's own product photography and banners, and anything
imported from Google Drive, lived in React state and were gone on refresh. This is where
the other three persist.

RLS is applied to match every other tenant table - the policy shape is the one established
in d47b2e8135ac, and the default privileges granted there mean raftra_app can already read
and write this table without further grants.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e58c1d3f7a92'
down_revision: Union[str, Sequence[str], None] = 'd47b2e8135ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_CURRENT_USER = "NULLIF(current_setting('app.user_id', true), '')::int"


def upgrade() -> None:
    op.create_table(
        'media_assets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('workspace_id', sa.Integer(), nullable=True),
        sa.Column('category', sa.String(), nullable=True),
        sa.Column('source', sa.String(), nullable=True),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('storage_url', sa.String(), nullable=False),
        sa.Column('source_url', sa.String(), nullable=True),
        sa.Column('alt_text', sa.String(), nullable=True),
        sa.Column('mime_type', sa.String(), nullable=True),
        sa.Column('file_format', sa.String(), nullable=True),
        sa.Column('width', sa.Integer(), nullable=True),
        sa.Column('height', sa.Integer(), nullable=True),
        sa.Column('file_size_kb', sa.Float(), nullable=True),
        sa.Column('tags', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_media_assets_workspace_id', 'media_assets', ['workspace_id'])
    op.create_index('ix_media_assets_category', 'media_assets', ['category'])
    op.create_index('ix_media_assets_source', 'media_assets', ['source'])
    op.create_index('ix_media_assets_created_at', 'media_assets', ['created_at'])

    # Re-harvesting a site replaces its scraped rows, so this index carries the lookup that
    # deletion uses as well as the vault's own category filter.
    op.create_index('ix_media_assets_ws_source', 'media_assets', ['workspace_id', 'source'])

    op.execute("ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE media_assets FORCE ROW LEVEL SECURITY")
    op.execute(
        "CREATE POLICY tenant_isolation ON media_assets "
        "USING (workspace_id IN (SELECT id FROM workspaces WHERE user_id = %s)) "
        "WITH CHECK (workspace_id IN (SELECT id FROM workspaces WHERE user_id = %s))"
        % (_CURRENT_USER, _CURRENT_USER)
    )


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON media_assets")
    op.drop_table('media_assets')
