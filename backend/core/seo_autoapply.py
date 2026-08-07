"""Auto-apply: push an approved SEO recommendation to the live site immediately.

The approval gate is deliberately unchanged. connector_routes._get_approved_fixes() still
decides what may be written, and it only ever returns recommendations a human explicitly
approved or edited. Auto-apply removes the second manual step (pressing "Apply SEO fixes"),
not the review — nothing here can write a fix nobody approved.

Opt-in per connection via wordpress_connections.auto_apply, and it runs as a FastAPI
background task so approving a recommendation still returns instantly. Every failure is
swallowed and reported as a notification: a site being unreachable must never make the
user's approval request fail.
"""
import datetime


def _notify(db, user_id: int, title: str, message: str, action_url: str | None = None):
    import models
    db.add(models.Notification(user_id=user_id, title=title, message=message,
                               type="agent", action_url=action_url))
    db.commit()


async def apply_wordpress_after_approval(workspace_id: int, user_id: int):
    """Apply currently-approved fixes to the workspace's WordPress site, if auto-apply is on.

    Safe to call after every approval: it no-ops when there is no connection, when
    auto-apply is off, or when the approved set produces no actual change to the page.
    """
    from database import SessionLocal
    import models

    with SessionLocal() as db:
        conn = db.query(models.WordPressConnection).filter(
            models.WordPressConnection.workspace_id == workspace_id
        ).first()
        if not conn or not conn.auto_apply:
            return
        if not (conn.app_password or conn.access_token):
            return

        # Imported here rather than at module scope: connector_routes imports a lot of
        # connector modules, and this keeps that off the critical import path.
        from connector_routes import apply_wp_seo_fixes
        from fastapi import HTTPException

        try:
            result = await apply_wp_seo_fixes(workspace_id, db, dry_run=False,
                                              require_same_site=True)
        except HTTPException as e:
            # 409/422 are the ordinary "nothing to do yet" cases — one approved
            # recommendation is often not enough to change the page on its own. Those are
            # not worth interrupting the user over.
            if e.status_code == 409 and "connected to" in str(e.detail):
                # Site mismatch — the user needs to know, because otherwise auto-apply
                # looks silently broken when it is actually refusing to do the wrong thing.
                _notify(db, user_id, "Auto-apply skipped — wrong site", str(e.detail))
                return
            if e.status_code in (409, 422):
                print(f"[autoapply] workspace {workspace_id}: nothing to apply ({e.detail})")
                return
            _notify(db, user_id, "Auto-apply failed",
                    f"Could not apply the approved SEO fix to your WordPress site: {e.detail}")
            return
        except Exception as e:
            print(f"[autoapply] workspace {workspace_id} failed: {e}")
            _notify(db, user_id, "Auto-apply failed",
                    f"Could not apply the approved SEO fix to your WordPress site: {e}")
            return

        conn.last_synced_at = datetime.datetime.utcnow()
        db.commit()
        _notify(db, user_id, "SEO fix applied automatically",
                result.get("message") or "Applied the approved SEO fix to your WordPress site.",
                action_url=result.get("edit_url"))
        print(f"[autoapply] workspace {workspace_id}: {result.get('message')}")
