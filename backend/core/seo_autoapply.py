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


async def prepare_wordpress_after_approval(workspace_id: int, user_id: int):
    """Auto-apply, staged: PREPARE the change and tell the user it is ready to confirm.

    Deliberately a dry run. Auto-apply removes the busywork of remembering to open the panel
    and press Apply — it does not remove the human's final say over a live write to their
    site. The user reviews a per-change before/after in the WordPress panel and confirms
    there, at which point the real write (and its snapshot) happens.

    Safe to call after every approval: no-ops when there is no connection, when auto-apply is
    off, or when the approved set produces no actual change to the page.
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
            preview = await apply_wp_seo_fixes(workspace_id, db, dry_run=True,
                                               require_same_site=True)
        except HTTPException as e:
            if e.status_code == 409 and "connected to" in str(e.detail):
                # Site mismatch — the user needs to know, because otherwise auto-apply
                # looks silently broken when it is actually refusing to do the wrong thing.
                _notify(db, user_id, "Auto-apply skipped — wrong site", str(e.detail))
                return
            if e.status_code in (409, 422):
                print(f"[autoapply] workspace {workspace_id}: nothing to prepare ({e.detail})")
                return
            _notify(db, user_id, "Auto-apply could not prepare the change",
                    f"Could not prepare the approved SEO fix for your WordPress site: {e.detail}")
            return
        except Exception as e:
            print(f"[autoapply] workspace {workspace_id} failed: {e}")
            _notify(db, user_id, "Auto-apply could not prepare the change",
                    f"Could not prepare the approved SEO fix for your WordPress site: {e}")
            return

        changes = preview.get("content_changes") or []
        needs_review = preview.get("manual_review") or []
        page = (preview.get("page") or {}).get("title") or "your page"
        if not changes and not preview.get("plugin_meta") and not needs_review:
            return

        # Name the individual changes: "3 changes ready" with a list is reviewable, whereas
        # "changes are ready" tells the user nothing about what is about to touch their site.
        lines = [f"{i}. {c.get('fix') or c.get('reason') or c.get('action')}"
                 for i, c in enumerate(changes, 1)]
        summary = f"{len(changes)} change(s) ready for '{page}'."
        if lines:
            summary += "\n" + "\n".join(lines)
        if needs_review:
            summary += f"\n{len(needs_review)} could not be placed automatically and need manual review."
        summary += "\nOpen the WordPress panel to review the before/after and confirm."

        conn.last_synced_at = datetime.datetime.utcnow()
        db.commit()
        _notify(db, user_id, "SEO changes ready to review", summary)
        print(f"[autoapply] workspace {workspace_id}: prepared {len(changes)} change(s), awaiting confirmation")


# Back-compat alias: the previous name described the old immediate-write behaviour.
apply_wordpress_after_approval = prepare_wordpress_after_approval
