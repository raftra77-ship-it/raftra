"""Publishing foundation layer.

Sits ONE step after the existing SEO/GEO audit pipeline (core/seo_scoring.py,
agents/seo_geo.py, workspace_routes.py) and never modifies it. This package prepares
already-generated audit recommendations for future publishing to GitHub, WordPress and
Shopify. Architecture only — no external platform API is called anywhere in this package.

Flow:
    audit JSON (existing)
        -> schema.normalize_audit()        generic, platform-independent recommendations
        -> converters.get_converter(...)   platform-specific payload shape
        -> publish_service.PublishService  orchestrates detection + conversion (read-only)
        -> page_mapping.PageMappingService.discover()   architecture only — no platform
                                            implemented yet, raises NotImplementedError
        -> publishers.get_publisher(...)   validate() / preview() are real for all three;
                                            publish() just returns the same preview, wrapped
                                            as "ready_for_publish", for all three
"""
