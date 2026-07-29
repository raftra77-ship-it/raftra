from .base import Publisher


class ShopifyPublisher(Publisher):
    platform_name = "shopify"

    def validate(self, payload: dict) -> dict:
        errors = []
        if not self.connection or not getattr(self.connection, "access_token", None):
            errors.append("Shopify is not connected for this workspace.")
        if not self.connection or not getattr(self.connection, "shop_domain", None):
            errors.append("No Shopify store connected.")
        if not payload.get("resource_id"):
            errors.append("No page/article id resolved for this page yet (page mapping needed).")
        return {"valid": not errors, "errors": errors}

    def preview(self, payload: dict) -> dict:
        return {
            "platform": "shopify",
            "would_create": "unpublished_draft",
            "shop_domain": getattr(self.connection, "shop_domain", None),
            "resource_type": payload.get("resource_type"),
            "resource_id": payload.get("resource_id"),
            "field": payload.get("field"),
            "summary": payload.get("description"),
        }

    # publish() is inherited from Publisher — architecture-only preview for now. Override
    # here later with the real unpublished-article/page call (core/shopify_connect.py
    # already has one).
