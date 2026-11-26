"""Let a brand create a workspace while RLS is enforcing.

Revision ID: d8e1f4a60b27
Revises: c9f3a1b47de2
Create Date: 2026-11-26

With the policies from a7d2e05f9c14 genuinely applied, POST /api/workspaces fails:

    new row violates row-level security policy for table "workspaces"

a7d2e05f9c14 gave the table asymmetric clauses - WITH CHECK tests the incoming row's own
columns, while USING resolves membership through the helper:

    USING      (id IN (SELECT app_my_workspace_ids()))
    WITH CHECK (tenant_id IN (SELECT app_my_tenant_ids())
                OR (tenant_id IS NULL AND user_id = app_current_user_id()))

The policy is FOR ALL, so USING is also applied to an INSERT's RETURNING output.
app_my_workspace_ids() is STABLE and reads `workspaces`, so within the inserting statement
it evaluates against a snapshot taken before the row existed; the new id is not in its
result and the row cannot be returned. Measured: a plain INSERT succeeds and
`INSERT ... RETURNING id` does not. SQLAlchemy always emits RETURNING for an autoincrement
primary key, so every workspace creation through the ORM 500s - the first thing a new brand
does after signing up.

The fix is to state USING the way WITH CHECK already does, on the row's own columns. For
this one table no self-query is needed: tenant_id and user_id ARE columns of `workspaces`,
so membership can be read straight off the candidate row. That removes the snapshot
dependency without widening what is visible - the two expressions now describe the same set
of rows, which is also easier to reason about than the asymmetric pair.

app_my_workspace_ids() is deliberately left in place. Roughly 35 other policies resolve
`workspace_id IN (SELECT app_my_workspace_ids())`, and for those the function reads a
DIFFERENT table than the one being written, so no snapshot problem arises. `workspaces` was
the only self-referential case.

NOT fixed here, because it is a design decision rather than a defect with one safe answer:
`tenant_members` has only `tenant_id IN (SELECT app_my_tenant_ids())`, and that function
reads tenant_members, so the FIRST member of a tenant can never be inserted
(core/tenancy.py:77). Simply permitting `user_id = app_current_user_id()` would let any
account add itself to any tenant. It needs either a privileged bootstrap path or an
"is this tenant empty" test behind a SECURITY DEFINER function.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'd8e1f4a60b27'
down_revision: Union[str, Sequence[str], None] = 'c9f3a1b47de2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_ROW_OWN_COLUMNS = ("tenant_id IN (SELECT app_my_tenant_ids()) "
                    "OR (tenant_id IS NULL AND user_id = app_current_user_id())")


def upgrade() -> None:
    # ALTER rather than DROP + CREATE: the table is never left without a policy, so a
    # concurrent request cannot slip through an unguarded window mid-migration.
    op.execute("ALTER POLICY tenant_isolation ON workspaces USING (%s)" % _ROW_OWN_COLUMNS)


def downgrade() -> None:
    op.execute("ALTER POLICY tenant_isolation ON workspaces "
               "USING (id IN (SELECT app_my_workspace_ids()))")
