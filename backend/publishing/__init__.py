"""Publishing foundation layer.

Sits ONE step after the existing SEO/GEO audit pipeline (core/seo_scoring.py,
agents/seo_geo.py, workspace_routes.py) and never modifies it. This package prepares
already-generated audit recommendations for publishing to GitHub, WordPress and Shopify.

Flow:
    audit JSON (existing)
        -> schema.normalize_audit()        generic, platform-independent recommendations
        -> converters.get_converter(...)   platform-specific payload shape
        -> publish_service.PublishService  orchestrates detection + conversion (read-only)
        -> page_mapping.PageMappingService.discover()   real API lookup, WordPress only
        -> publishers.get_publisher(...)   validate() / preview() work for all three;
                                            publish() is REAL for WordPress (creates a
                                            draft post via core/wordpress_connect.py) and
                                            still a placeholder for GitHub/Shopify
"""
