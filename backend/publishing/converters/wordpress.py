from .base import PlatformConverter
from ..schema import GenericRecommendation

# Generic `target` -> a WordPress field reference. "meta:<key>" fields are illustrative
# (an SEO plugin's custom fields, e.g. Yoast/RankMath) — the exact key is a real-publishing
# concern, not a foundation one. "site:<key>" targets are site-wide, not per-post.
TARGET_TO_WP_FIELD = {
    "meta.title": "meta:seo_title",
    "meta.description": "meta:seo_description",
    "meta.canonical": "meta:canonical_url",
    "meta.og_tags": "meta:og_tags",
    "structured_data.json_ld": "meta:json_ld_schema",
    "structured_data.organization": "meta:json_ld_schema",
    "structured_data.faq_page": "meta:json_ld_schema",
    "structured_data.product": "meta:json_ld_schema",
    "content.headings": "content",
    "content.lists": "content",
    "content.body": "content",
    "content.internal_links": "content",
    "content.image_alt": "media:alt_text",
    "technical.robots_txt": "site:robots_txt",
    "technical.sitemap": "site:sitemap",
}


class WordPressConverter(PlatformConverter):
    """Recommendation -> a proposed WordPress post/page field update. `post_id` is left
    unresolved (None) — the Page Mapping Service fills it in once a page has been mapped to
    a real WP post/page id. Posts are still created/edited as DRAFTS by convention (see
    models.WordPressConnection) so a human always presses publish.
    """

    platform_name = "wordpress"

    def convert_one(self, rec: GenericRecommendation) -> dict:
        return {
            "platform": "wordpress",
            "recommendation_id": rec.id,
            "page": rec.page,
            "post_id": None,  # resolved later via PageMappingService.resolve_target()
            "field": TARGET_TO_WP_FIELD.get(rec.target, "content"),
            "current_value": rec.current_value,
            "new_value": rec.new_value,
            "description": rec.reasoning,
            "priority": rec.priority,
            "delivery_mechanism": "draft",  # never published directly — a human presses publish
        }
