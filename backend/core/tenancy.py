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
    tenant = models.Tenant(name=name)
    db.add(tenant)
    db.flush()                      # populates tenant.id from the server default
    db.add(models.TenantMember(tenant_id=tenant.id, user_id=user.id, role="owner"))
    db.commit()
    return tenant.id
