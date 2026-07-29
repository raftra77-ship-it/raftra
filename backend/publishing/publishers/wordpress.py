from .base import Publisher
from core import wordpress_connect as wp


class WordPressPublisher(Publisher):
    """The one platform with a real publish() so far. Reuses core/wordpress_connect.py —
    the same real, working client the existing `/wordpress/{id}/publish-draft` endpoint
    already uses for content drafts — rather than a new WordPress client.

    Design choice: publish() creates a NEW draft post describing the suggested change; it
    never edits the live page in place. This matches the guarantee already documented on
    models.WordPressConnection ("Posts are created as DRAFTS so a human still presses
    publish") and sidesteps the fact that we don't know which custom SEO-plugin meta key (if
    any) a given site uses for title/meta description — writing to a guessed meta key on an
    arbitrary site would be exactly the kind of fabrication this whole package avoids.
    """

    platform_name = "wordpress"

    def validate(self, payload: dict) -> dict:
        errors = []
        if not self.connection or not getattr(self.connection, "app_password", None):
            errors.append("WordPress is not connected for this workspace.")
        if not self.connection or not getattr(self.connection, "site_url", None):
            errors.append("No WordPress site URL configured.")
        return {"valid": not errors, "errors": errors}

    def preview(self, payload: dict) -> dict:
        return {
            "platform": "wordpress",
            "would_create": "draft_post",
            "site_url": getattr(self.connection, "site_url", None),
            "existing_post_id": payload.get("post_id"),  # from page-mapping discovery, if resolved — reference only
            "title": self._draft_title(payload),
            "body_preview": self._draft_body(payload),
        }

    async def publish(self, payload: dict) -> dict:
        check = self.validate(payload)
        if not check["valid"]:
            return {"status": "error", "platform": "wordpress", "message": "; ".join(check["errors"])}
        try:
            result = await wp.publish_markdown(
                self.connection, title=self._draft_title(payload), body=self._draft_body(payload),
            )
        except Exception as e:
            return {"status": "error", "platform": "wordpress", "message": f"Could not create the WordPress draft: {e}"}
        return {
            "status": "published_as_draft",
            "platform": "wordpress",
            "post_id": result["post_id"],
            "edit_url": result["edit_url"],
            "message": "Created a draft post with the suggested change. Review it in WordPress, "
                      "then manually apply it to the live page.",
        }

    @staticmethod
    def _draft_title(payload: dict) -> str:
        return f"[SEO Fix] {payload.get('page', '/')} — {payload.get('field', 'update')}"[:120]

    @staticmethod
    def _draft_body(payload: dict) -> str:
        lines = [
            f"**Page:** {payload.get('page', '/')}",
            f"**Field:** {payload.get('field', '')}",
            "",
            f"**Suggested change:** {payload.get('description', '')}",
        ]
        if payload.get("current_value"):
            lines.append(f"\n**Current value:** {payload['current_value']}")
        if payload.get("new_value"):
            lines.append(f"\n**New value:** {payload['new_value']}")
        if payload.get("post_id"):
            lines.append(f"\n_This page was matched to existing WordPress post/page id "
                         f"{payload['post_id']} via page-mapping discovery._")
        return "\n".join(lines)
