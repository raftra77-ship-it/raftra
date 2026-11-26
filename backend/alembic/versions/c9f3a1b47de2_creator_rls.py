"""Creator-side RLS: give creators a way in, without widening anything for brands.

Revision ID: c9f3a1b47de2
Revises: b4c7e2f09a13
Create Date: 2026-11-15

a7d2e05f9c14 routed every policy through `workspace_id IN (SELECT app_my_workspace_ids())`.
That is correct for brands and total denial for creators: a creator owns no workspace, so
app_my_workspace_ids() returns the empty set and every row of every creator-facing table is
filtered away. Measured on production - creator users 27 and 28 both resolve to 0
workspaces - which is why `/deals/mine` returns [], `/payouts/submit` answers 403 "You can
only request payment for your own profile", `/discover` shows an empty marketplace to a
signed-in creator while working signed-out, and the creator half of the chat is silent. The
single chat_messages row in production is the whole history of the feature.

A second, separate failure: deal_deliverable_submissions, creator_payout_requests, payouts
and users have RLS ENABLED with ZERO policies, which is deny-all for every role RLS applies
to. d47b2e8135ac deliberately left them out ("creator-facing, reached by unauthenticated
creators through capability links; they have no workspace owner to filter on"), intending
RLS to stay OFF. Supabase's `ensure_rls` event trigger - rls_auto_enable(), owned by
postgres, present in data.sql but created by no migration - fires on ddl_command_end for
every CREATE TABLE in public and enables RLS without adding a policy. The intent was "no
RLS"; the result was "deny everything".

What this migration does NOT do: it does not alter, relax or remove a single brand
predicate. Every policy below keeps `workspace_id IN (SELECT app_my_workspace_ids())`
verbatim and adds OR-arms beside it. A brand's visibility is byte-identical afterwards.

The creator's identity comes from influencers.user_id. Most creator-facing tables do not
carry a user id at all - they join by handle string (influencer_handle, creator_handle) -
so the handle comparison has to match what Python does. core/marketplace.py:21 is

    clean_handle(v) = v.replace("@", "").strip().lower()

and app_norm_handle() below is its exact SQL equivalent. A policy that compared raw strings
would silently fail to match '@Handle ' against 'handle'.

Helper functions are SECURITY DEFINER for the same reason a7d2e05f9c14 made its own:
executing as the owner means the read inside is not itself subject to RLS, so a policy on
influencers cannot recurse into the function that resolves which influencers are mine.
STABLE so the planner evaluates them once per statement rather than per row.

Reversible: downgrade() restores the exact workspace-only policies a7d2e05f9c14 created and
drops every function introduced here.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'c9f3a1b47de2'
down_revision: Union[str, Sequence[str], None] = 'b4c7e2f09a13'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

APP_ROLE = "raftra_app"

# The brand arm, repeated verbatim from a7d2e05f9c14 so a reader can see it is unchanged.
WS = "workspace_id IN (SELECT app_my_workspace_ids())"

# Tables that ensure_rls enabled without a policy, i.e. that currently deny everybody.
# RLS is enabled here explicitly as well, so the migration reaches the same end state on a
# database that has no such trigger - a developer's local Postgres, for instance, where
# these tables have RLS off rather than on-and-empty.
#
# plans and transactions are on this list even though d47b2e8135ac deliberately left them
# without RLS ("plans are global reference data", "transactions ... read only through
# payment webhooks"). The trigger overrode that intent, and the result is visible:
# GET /api/payments/transactions (payments.py:316) authenticates with get_current_user, so
# it runs as raftra_app, and with no policy the billing history is empty for everyone.
# Leaving them off the list is not an option either - the guard at the end of this
# migration would then abort the upgrade on production, where they are already enabled.
POLICYLESS = ["deal_deliverable_submissions", "creator_payout_requests", "users",
              "plans", "transactions"]


def _policy(table: str, using: str, check: str = None) -> None:
    """Replace one tenant_isolation policy. check defaults to using."""
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON %s" % table)
    op.execute("CREATE POLICY tenant_isolation ON %s USING (%s) WITH CHECK (%s)"
               % (table, using, check if check is not None else using))


def _reconcile_missing_columns() -> dict:
    """Add every column models.py declares that no revision ever created.

    The chain and the models drifted apart years ago: tables were created by revisions,
    but columns were added by models.Base.metadata.create_all() at main.py import, which
    adds nothing to a table that already exists - so in practice they arrived through
    main.py's own light-migration pass instead. On the deployed database the columns are
    simply there. On an empty one they are not, and the policies below reference them:
    this revision's app_my_influencer_ids() reads influencers.user_id, a column
    89da7f6b7d19 never creates, so the chain stopped here with
    `column "user_id" does not exist`.

    Here, in the LAST revision, is the safe place for this. Every table exists by now, and
    every op.add_column anywhere in the chain has already run (brand_profiles.color_tokens
    and .logos in c31f4a90b7e2, tenants.created_by in f61a9c204db3), so nothing this adds
    can collide with a later step. Doing it earlier would race those three.

    Added nullable whatever the model says: rows already in the table have no value for a
    column being introduced, and a revision cannot invent one. That matches what create_all
    leaves behind on the deployed database, which is the shape this has to reproduce.

    Returns {table: [columns]} for the log line. On the deployed database it is empty.
    """
    import models                                   # noqa: F401  (registers the metadata)
    from database import Base

    bind = op.get_bind()
    insp = sa.inspect(bind)

    # Tables first. d47b2e8135ac builds the ones it protects, but this revision also
    # policies tables deliberately left outside workspace RLS - deal_deliverable_
    # submissions and creator_payout_requests, reached by creators through capability
    # links - so those have no earlier creator. knowledge_chunks is pgvector-backed,
    # hence the extension, enabled the same way f61a9c204db3 enables pgcrypto.
    missing_tables = [t for t in Base.metadata.sorted_tables if not insp.has_table(t.name)]
    if any(t.name in ("agent_memories", "knowledge_chunks") for t in missing_tables):
        op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    for table in missing_tables:
        table.create(bind=bind, checkfirst=True)
    if missing_tables:
        print("[migration] created %d table(s) no revision ever created: %s"
              % (len(missing_tables), ", ".join(sorted(t.name for t in missing_tables))))
        insp = sa.inspect(bind)

    added = {}
    for table in Base.metadata.sorted_tables:
        if not insp.has_table(table.name):
            continue
        have = {col["name"] for col in insp.get_columns(table.name)}
        for column in table.columns:
            if column.name in have:
                continue
            op.add_column(table.name, sa.Column(column.name, column.type, nullable=True))
            added.setdefault(table.name, []).append(column.name)
    return added


def upgrade() -> None:
    # Nothing below can reference a column that was never created.
    _added = _reconcile_missing_columns()
    if _added:
        _n = sum(len(v) for v in _added.values())
        print("[migration] added %d column(s) no revision ever created: %s"
              % (_n, "; ".join("%s(%s)" % (t, ", ".join(cs))
                              for t, cs in sorted(_added.items()))))

    # ---------------------------------------------------------------- helper functions

    # Exactly core/marketplace.py clean_handle(). IMMUTABLE so it can be used in an index
    # later if handle lookups ever need one; empty search_path so the body cannot be
    # hijacked through a caller's path.
    op.execute("""
        CREATE OR REPLACE FUNCTION app_norm_handle(h text) RETURNS text
        LANGUAGE sql IMMUTABLE
        SET search_path = ''
        AS $$ SELECT lower(btrim(replace(coalesce(h, ''), '@', ''))) $$;
    """)

    # Admin is a database-visible fact, not just a Python one. require_admin() in
    # admin_routes.py gates the HTTP layer, but under RLS the admin was denied exactly like
    # everyone else - scripts/grant_admin.py exists to let an admin read creators' bank
    # details, and deny-all made that impossible. Returns false when app.user_id is unset,
    # so an unscoped connection gains nothing from it.
    op.execute("""
        CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public
        AS $$ SELECT EXISTS (
                 SELECT 1 FROM users
                 WHERE id = app_current_user_id() AND role = 'admin') $$;
    """)

    # Gates the public-marketplace arm below. Without it, `status = 'ACTIVE'` is true for
    # every caller, and a brand can read a competitor's live briefs - campaign name,
    # product, budget, requirements. The regression suite caught exactly that
    # (test_brand_a_cannot_see_brand_b[posted_deals]) before this function existed.
    op.execute("""
        CREATE OR REPLACE FUNCTION app_is_creator() RETURNS boolean
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public
        AS $$ SELECT EXISTS (
                 SELECT 1 FROM users
                 WHERE id = app_current_user_id() AND role = 'creator') $$;
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION app_my_influencer_ids() RETURNS SETOF integer
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public
        AS $$ SELECT id FROM influencers WHERE user_id = app_current_user_id() $$;
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION app_my_handles() RETURNS SETOF text
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public
        AS $$ SELECT app_norm_handle(handle) FROM influencers
              WHERE user_id = app_current_user_id()
                AND handle IS NOT NULL AND btrim(handle) <> '' $$;
    """)

    # Resolved in a SECURITY DEFINER function rather than inline in the policy: an inline
    # subquery over deal_applications would make that table's own policy run inside this
    # one, on every row.
    op.execute("""
        CREATE OR REPLACE FUNCTION app_my_application_ids() RETURNS SETOF integer
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public
        AS $$ SELECT id FROM deal_applications
              WHERE app_norm_handle(creator_handle) IN (SELECT app_my_handles()) $$;
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION app_workspace_application_ids() RETURNS SETOF integer
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public
        AS $$ SELECT id FROM deal_applications
              WHERE workspace_id IN (SELECT app_my_workspace_ids()) $$;
    """)

    op.execute("""
        CREATE OR REPLACE FUNCTION app_my_applied_deal_ids() RETURNS SETOF integer
        LANGUAGE sql STABLE SECURITY DEFINER
        SET search_path = public
        AS $$ SELECT DISTINCT deal_id FROM deal_applications
              WHERE deal_id IS NOT NULL
                AND app_norm_handle(creator_handle) IN (SELECT app_my_handles()) $$;
    """)

    op.execute("GRANT EXECUTE ON FUNCTION app_norm_handle(text), app_is_admin(), "
               "app_is_creator(), app_my_influencer_ids(), app_my_handles(), "
               "app_my_application_ids(), app_workspace_application_ids(), "
               "app_my_applied_deal_ids() TO %s" % APP_ROLE)

    # ---------------------------------------------------------------- the four that were
    # RLS-on-with-no-policy, i.e. denying everybody. FORCE so the table owner is bound by
    # the policy too, matching every other table a7d2e05f9c14 touched.
    for table in POLICYLESS:
        op.execute("ALTER TABLE IF EXISTS %s ENABLE ROW LEVEL SECURITY" % table)
        op.execute("ALTER TABLE IF EXISTS %s FORCE ROW LEVEL SECURITY" % table)

    # ---------------------------------------------------------------- policies

    # The creator's own row, by the one real user link in this schema.
    _policy("influencers",
            "%s OR user_id = app_current_user_id() OR app_is_admin()" % WS)

    # Creators accept and decline their own deals; the handle is the only link.
    _policy("influencer_deals",
            "%s OR app_norm_handle(influencer_handle) IN (SELECT app_my_handles()) "
            "OR app_is_admin()" % WS)

    _policy("deal_applications",
            "%s OR app_norm_handle(creator_handle) IN (SELECT app_my_handles()) "
            "OR app_is_admin()" % WS)

    # Asymmetric on purpose, and gated twice.
    #
    # A brief with status ACTIVE is the public marketplace - that is what /discover
    # (posted_deal_routes.py:305) serves. But "public" means public *to creators*: an
    # ungated `status = 'ACTIVE'` is also true for a rival brand, which would hand Brand A
    # Brand B's live campaign briefs. app_is_creator() closes that. DRAFT, REVIEWING,
    # IN_PROGRESS, COMPLETED and CLOSED stay workspace-only for everyone.
    #
    # WITH CHECK omits both creator arms, so a creator can read a brief and never create,
    # alter or delete one.
    _policy("posted_deals",
            "%s OR (app_is_creator() AND (status = 'ACTIVE' "
            "                             OR id IN (SELECT app_my_applied_deal_ids()))) "
            "OR app_is_admin()" % WS,
            "%s OR app_is_admin()" % WS)

    _policy("chat_messages",
            "%s OR influencer_id IN (SELECT app_my_influencer_ids()) "
            "OR app_is_admin()" % WS)

    # Notifications travel in both directions, so a workspace-only predicate breaks the
    # creator half of several flows at once. Submitting a deliverable raises a notification
    # addressed to the brand, and with only the brand arm that INSERT failed with
    # "new row violates row-level security policy for table posted_deal_notifications" -
    # the creator's submission was rejected by a side effect, not by the submission itself.
    #
    # Three creator arms: notifications addressed to me, and notifications attached to an
    # application or a deal I am party to. The last two are what let a creator raise one
    # for the brand. A creator can therefore also read brand-addressed notifications about
    # their own deal, which is information they are already a party to.
    _policy("posted_deal_notifications",
            "%s OR (recipient_type = 'creator' "
            "       AND app_norm_handle(recipient_handle) IN (SELECT app_my_handles())) "
            "OR application_id IN (SELECT app_my_application_ids()) "
            "OR deal_id IN (SELECT app_my_applied_deal_ids()) "
            "OR app_is_admin()" % WS)

    # No workspace column at all: reached through its application, from either side.
    _policy("deal_deliverable_submissions",
            "application_id IN (SELECT app_my_application_ids()) "
            "OR application_id IN (SELECT app_workspace_application_ids()) "
            "OR app_is_admin()")

    # Bank details. The creator who owns the handle, and admin, and nobody else - brands
    # included, which is the existing intent of scripts/grant_admin.py.
    _policy("creator_payout_requests",
            "app_norm_handle(creator_handle) IN (SELECT app_my_handles()) "
            "OR app_is_admin()")

    # Production has this deny-all today, so self-only is strictly a loosening and cannot
    # regress anything. Login is unaffected either way: auth.py reads the user at line 161,
    # before enter_tenant_scope at line 166, so that lookup still runs unscoped.
    _policy("users", "id = app_current_user_id() OR app_is_admin()")

    # Your own payments, and nobody else's. The webhook and verify-payment paths take no
    # user dependency, so they never enter tenant scope and keep writing as the connection
    # role; this policy governs the one authenticated reader, GET /api/payments/transactions.
    _policy("transactions", "owner_id = app_current_user_id() OR app_is_admin()")

    # Global reference data: the price list. Readable by anyone who is signed in - the
    # pricing and checkout pages need it - and writable only by an administrator, which is
    # the asymmetry a plain "RLS off" could not express.
    _policy("plans", "true", "app_is_admin()")

    # Not a creator change: a brand table that was left out by accident.
    #
    # a7d2e05f9c14 gave the workspace policy to github_connections, google_ads_connections,
    # meta_ads_connections, search_console_connections, shopify_connections and
    # wordpress_connections - every connector except this one. GoogleDriveConnection sits
    # beside them in the same table at connector_routes.py:307, carries the same
    # workspace_id FK, and is read at connector_routes.py:1768 from a route that
    # authenticates with get_current_user and therefore runs as raftra_app. With RLS
    # enabled by the trigger and no policy, that read returns nothing and the Drive
    # connector reports itself disconnected no matter what is stored.
    #
    # The access model is not being invented here: it is the identical predicate its six
    # siblings already use, so this restores the intent of a7d2e05f9c14 rather than
    # extending it. No creator arm - Drive is brand-side only.
    op.execute("ALTER TABLE IF EXISTS google_drive_connections ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE IF EXISTS google_drive_connections FORCE ROW LEVEL SECURITY")
    _policy("google_drive_connections", "%s OR app_is_admin()" % WS)

    # payouts exists in production (from data.sql) but in no migration and in no SQLAlchemy
    # model - nothing in the application reads or writes it. Guarded so this migration runs
    # on databases that do not have it. Admin-only: inventing creator access to a table no
    # code uses would be widening exposure for no benefit.
    op.execute("""
        DO $$ BEGIN
          IF to_regclass('public.payouts') IS NOT NULL THEN
            EXECUTE 'ALTER TABLE payouts ENABLE ROW LEVEL SECURITY';
            EXECUTE 'ALTER TABLE payouts FORCE ROW LEVEL SECURITY';
            EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON payouts';
            EXECUTE 'CREATE POLICY tenant_isolation ON payouts '
                    'USING (app_is_admin()) WITH CHECK (app_is_admin())';
          END IF;
        END $$;
    """)

    # ---------------------------------------------------------------- guard for next time
    # ensure_rls will keep enabling RLS on every new table in public and will keep not
    # writing a policy, which is indistinguishable from a working table until someone
    # notices their feature returns nothing. This turns the next occurrence into a failed
    # migration instead of a silent outage. It cannot be fixed by altering the trigger:
    # it is owned by postgres, created outside this repository, and part of the Supabase
    # project rather than the application.
    #
    # One table is a known exception. `deals` is RLS-enabled-with-no-policy on production
    # and has no SQLAlchemy model, no query, no FK from any application code - the only
    # thing pointing at it is payouts.deal_id, and payouts is an orphan too. With no
    # reader there is no access model to derive, so a predicate here would be a guess.
    # It is named explicitly rather than matched by a pattern, so the guard still fires
    # for any table that becomes deny-all from here on, and so this list is the thing
    # someone has to delete when `deals` is finally dropped or adopted.
    op.execute("""
        DO $$
        DECLARE offenders text;
        BEGIN
          SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO offenders
          FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
            AND c.relname NOT IN ('alembic_version', 'deals')
            AND NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid);
          IF offenders IS NOT NULL THEN
            RAISE EXCEPTION
              'RLS is enabled with no policy on: %. That is deny-all for raftra_app. '
              'Add a policy, or disable RLS on the table deliberately.', offenders;
          END IF;
        END $$;
    """)


def downgrade() -> None:
    """Restore exactly what a7d2e05f9c14 created, and undo the rest.

    One asymmetry worth knowing. The policies on the POLICYLESS tables are dropped but
    their RLS is left ENABLED, because that is precisely the state production was in
    before this migration ran - the ensure_rls trigger had switched it on and nobody had
    written a policy. Disabling it here would hand back something *less* protected than
    what was found, which is the wrong direction for a rollback to move in.

    On a database that never had the trigger - a developer's local Postgres, where these
    tables started with RLS off - a downgrade therefore leaves them enabled and
    policy-less, i.e. deny-all. That is deliberate and recoverable with
    `ALTER TABLE <t> DISABLE ROW LEVEL SECURITY`, but it is not a byte-perfect restore of
    a pre-trigger database, and a reviewer should not expect one.
    """
    for table in ("influencers", "influencer_deals", "deal_applications", "posted_deals",
                  "chat_messages", "posted_deal_notifications",
                  "google_drive_connections"):
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON %s" % table)
        op.execute("CREATE POLICY tenant_isolation ON %s "
                   "USING (%s) WITH CHECK (%s)" % (table, WS, WS))

    for table in POLICYLESS:
        op.execute("DROP POLICY IF EXISTS tenant_isolation ON %s" % table)
    op.execute("""
        DO $$ BEGIN
          IF to_regclass('public.payouts') IS NOT NULL THEN
            EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON payouts';
          END IF;
        END $$;
    """)

    op.execute("DROP FUNCTION IF EXISTS app_my_applied_deal_ids()")
    op.execute("DROP FUNCTION IF EXISTS app_workspace_application_ids()")
    op.execute("DROP FUNCTION IF EXISTS app_my_application_ids()")
    op.execute("DROP FUNCTION IF EXISTS app_my_handles()")
    op.execute("DROP FUNCTION IF EXISTS app_my_influencer_ids()")
    op.execute("DROP FUNCTION IF EXISTS app_is_creator()")
    op.execute("DROP FUNCTION IF EXISTS app_is_admin()")
    op.execute("DROP FUNCTION IF EXISTS app_norm_handle(text)")
