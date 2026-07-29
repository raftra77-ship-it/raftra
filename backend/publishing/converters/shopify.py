from .base import PlatformConverter
from ..schema import GenericRecommendation

# Generic `target` -> a Shopify field reference. "metafield:<namespace>.<key>" entries are
# illustrative (Shopify's standard SEO metafield namespace) — the exact namespace/key is a
# real-publishing concern, not a foundation one.
TARGET_TO_SHOPIFY_FIELD = {
    "meta.title": "metafield:global.title_tag",
    "meta.description": "metafield:global.description_tag",
    "meta.canonical": "metafield:seo.canonical_url",
    "meta.og_tags": "metafield:seo.og_tags",
    "structured_data.json_ld": "metafield:seo.json_ld",
    "structured_data.organization": "metafield:seo.json_ld",
    "structured_data.faq_page": "metafield:seo.json_ld",
    "structured_data.product": "metafield:seo.json_ld",
    "content.headings": "body_html",
    "content.lists": "body_html",
    "content.body": "body_html",
    "content.internal_links": "body_html",
    "content.image_alt": "metafield:seo.image_alt",
}


class ShopifyConverter(PlatformConverter):
    """Recommendation -> a proposed Shopify page/blog-article field update. `resource_id`
    is left unresolved (None) — the Page Mapping Service fills it in once a page has been
    mapped to a real Shopify page/article id. Articles are created UNPUBLISHED by
    convention (see models.ShopifyConnection) so a human always presses publish.
    """

    platform_name = "shopify"

    def convert_one(self, rec: GenericRecommendation) -> dict:
        return {
            "platform": "shopify",
            "recommendation_id": rec.id,
            "page": rec.page,
            "resource_type": "page",  # or "blog_article" once the mapping says otherwise
            "resource_id": None,      # resolved later via PageMappingService.resolve_target()
            "field": TARGET_TO_SHOPIFY_FIELD.get(rec.target, "body_html"),
            "current_value": rec.current_value,
            "new_value": rec.new_value,
            "description": rec.reasoning,
            "priority": rec.priority,
            "delivery_mechanism": "unpublished_draft",  # never published directly — a human presses publish
        }
