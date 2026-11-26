"""Who may reach a workspace.

One definition, used by every route. Before this the rule was written out inline at 29 call
sites as `Workspace.user_id == current_user.id`, which is a rule that cannot be changed
without finding all 29 - and is exactly the kind of thing that gets missed when a new route
is added, producing a route that quietly ignores tenancy.

The rule itself moved with the introduction of organisations (migration f61a9c204db3):
access is no longer "you created this workspace" but "you belong to the organisation that
owns it". That is what lets a second person at an agency see the same brands.

This mirrors the Postgres RLS policy deliberately. The policy is the real boundary - it
holds even if a query here forgets a filter - but matching it in the ORM means a user gets
an honest 403 rather than a confusing empty result.
"""
from sqlalchemy import or_

import database
import models


def visible_workspace(current_user):
    """A SQLAlchemy predicate for the workspaces this user may reach.

    Use as: db.query(models.Workspace).filter(models.Workspace.id == wid,
                                              tenancy.visible_workspace(user)).first()

    The second clause is a deliberate fallback: a workspace whose tenant_id is somehow null
    (a backfill that did not reach it, a row written by older code) stays reachable by its
    creator. Without it, one missed row would lock someone out of their own brand, which is
    a worse failure than the narrow over-permission it allows.
    """
    member_tenants = (
        # Correlated subquery rather than a join, so this composes into any existing filter.
        models.TenantMember.__table__.select()
        .with_only_columns(models.TenantMember.tenant_id)
        .where(models.TenantMember.user_id == current_user.id)
        .scalar_subquery()
    )
    return or_(
        models.Workspace.tenant_id.in_(member_tenants),
        models.Workspace.user_id == current_user.id,
    )


def visible_workspace_ids(db, current_user):
    """The ids themselves, for the places that filter a child table directly."""
    rows = (db.query(models.Workspace.id)
              .filter(visible_workspace(current_user)).all())
    return [r[0] for r in rows]


def user_tenant_ids(db, current_user):
    """Organisations this user belongs to."""
    rows = (db.query(models.TenantMember.tenant_id)
              .filter(models.TenantMember.user_id == current_user.id).all())
    return [r[0] for r in rows]


def ensure_personal_tenant(db, user):
    """Give a user an organisation of their own if they have none, and return it.

    Every user needs a tenant before they can own a workspace, and signup predates this
    concept - so rather than a migration-only backfill, this runs on demand. Idempotent.
    """
    existing = (db.query(models.TenantMember)
                  .filter(models.TenantMember.user_id == user.id).first())
    if existing:
        return existing.tenant_id

    name = (" ".join(filter(None, [getattr(user, "first_name", None),
                                   getattr(user, "last_name", None)])).strip()
            or getattr(user, "username", None) or getattr(user, "email", None)
            or ("Workspace %s" % user.id))
    # These two inserts run on their own short-lived session, not on `db`.
    #
    # Both tables carry symmetric RLS clauses - USING and WITH CHECK are each
    # `IN (SELECT app_my_tenant_ids())` - so a row may only be written for a tenant the
    # caller ALREADY belongs to. The first membership of a brand-new tenant is by
    # definition not one of those, so under RLS this function fails on its own first
    # statement: "new row violates row-level security policy for table "tenants"".
    #
    # Relaxing the policies would be the worse fix. Neither table has an owner column, so
    # the only predicate available on the candidate row is `user_id =
    # app_current_user_id()` - and that would let any account insert itself into ANY
    # tenant, and so read every brand that tenant owns. A policy that permits the
    # bootstrap necessarily permits the attack, because they are the same statement.
    #
    # Resetting the role on `db` instead is not safe either: enter_tenant_scope sets it
    # with SET LOCAL, which reverts on the commit below, so the rest of the request would
    # continue as the session user with RLS off entirely.
    #
    # A separate session is contained. It never calls enter_tenant_scope, so it is
    # `postgres` - the same deliberate bypass that background jobs already run under (see
    # database.py) - and it is closed before this returns. Nothing written here is
    # caller-supplied: the tenant is new, and the single member is the authenticated user
    # themselves, so there is no target for a caller to redirect.
    boot = database.SessionLocal()
    try:
        tenant = models.Tenant(name=name)
        boot.add(tenant)
        boot.flush()                # populates tenant.id from the server default
        boot.add(models.TenantMember(tenant_id=tenant.id, user_id=user.id, role="owner"))
        boot.commit()
        tenant_id = tenant.id
    except Exception:
        boot.rollback()
        raise
    finally:
        boot.close()

    # Deliberately NO db.commit() here. `db` carries this request's tenant scope, and
    # enter_tenant_scope set it with SET LOCAL - which reverts on commit, leaving every
    # later statement in the request running as the session user with RLS switched off.
    # test_tenant_bootstrap caught exactly that: after an earlier version of this function
    # committed, the caller could read another organisation's rows.
    #
    # Committing is not needed anyway. Postgres defaults to READ COMMITTED, so each
    # statement takes a fresh snapshot: the caller's next query sees the rows the boot
    # session just committed, and app_my_tenant_ids() re-evaluates against them.
    return tenant_id
