"""Specialist package prices, so a quote can change without a deploy.

Revision ID: e9b3c7d150af
Revises: d8e1f4a60b27
Create Date: 2026-11-26

The five Social Hub specialist packages live in the page: each has an icon component, a
colour and a list of what it automates, none of which belong in a database. Their prices
were in there too - "Starting from Rs 25,000/month" was a string in a React component - so
changing what a customer is quoted meant a code change and a frontend deploy.

This table holds only the price, keyed by the slug the page already gives each package
(social, seo, paid_ads, influencer, cro). It is deliberately NOT seeded: an empty table
means every package shows the figure built into the page, so applying this migration
changes nothing on screen until an admin sets a row. That is the safe default for a table
that decides what prospects are told a service costs.

No RLS, like `plans`: this is global reference data, the same for every brand, and the
marketplace page that reads it is reachable logged out. d47b2e8135ac's ALTER DEFAULT
PRIVILEGES already grants the application role access to tables created after it.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'e9b3c7d150af'
down_revision: Union[str, Sequence[str], None] = 'd8e1f4a60b27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # checkfirst in spirit: create_all may already have made this on a database that ran
    # the app before this migration, and re-running must not fail.
    if sa.inspect(op.get_bind()).has_table("specialist_package_prices"):
        return
    op.create_table(
        'specialist_package_prices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('price_label', sa.String(), nullable=False),
        sa.Column('base_price', sa.Integer(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
    )
    op.create_index(op.f('ix_specialist_package_prices_id'),
                    'specialist_package_prices', ['id'], unique=False)
    op.create_index(op.f('ix_specialist_package_prices_slug'),
                    'specialist_package_prices', ['slug'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_specialist_package_prices_slug'),
                  table_name='specialist_package_prices')
    op.drop_index(op.f('ix_specialist_package_prices_id'),
                  table_name='specialist_package_prices')
    op.drop_table('specialist_package_prices')
