from .base import Publisher


class WordPressPublisher(Publisher):
    """Architecture-only for now, same as GitHub and Shopify — no external API is called.
    preview()/validate() describe what publish() would do once wired to the real client
    (core/wordpress_connect.py already has a working publish_markdown() to reuse — see the
    TODO on publish() below for exactly how that wiring will look).
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
            "existing_post_id": payload.get("post_id"),  # from page-mapping, if resolved — reference only
            "title": self._draft_title(payload),
            "body_preview": self._draft_body(payload),
        }

    # publish() is inherited from Publisher — architecture-only preview for now. TODO (real
    # publishing): call core/wordpress_connect.publish_markdown(self.connection,
    # title=self._draft_title(payload), body=self._draft_body(payload)) — that client
    # already exists and is used by the /wordpress/{id}/publish-draft endpoint.

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
