from .base import PlatformConverter
from ..schema import GenericRecommendation

# Generic action -> the kind of change this becomes once it's a real commit. Kept separate
# from `action` itself so GitHub's vocabulary (commit/PR oriented) doesn't leak back into
# the platform-independent schema.
ACTION_TO_CHANGE_TYPE = {
    "update_metadata": "metadata_update",
    "update_content": "content_update",
    "add_structured_data": "structured_data_insert",
    "update_technical_config": "config_update",
}


class GitHubConverter(PlatformConverter):
    """Recommendation -> a proposed file change description. `file_path` is intentionally
    left unresolved here (None) — resolving "which file in the repo represents this page"
    is the Page Mapping Service's job (../page_mapping.py), applied after conversion by
    PublishService, not the converter's. This keeps the converter a pure, platform-shape
    transform with no database access.
    """

    platform_name = "github"

    def convert_one(self, rec: GenericRecommendation) -> dict:
        return {
            "platform": "github",
            "recommendation_id": rec.id,
            "page": rec.page,
            "file_path": None,  # resolved later via PageMappingService.resolve_target()
            "change_type": ACTION_TO_CHANGE_TYPE.get(rec.action, "content_update"),
            "target": rec.target,
            "current_value": rec.current_value,
            "new_value": rec.new_value,
            "commit_message": f"[{rec.pipeline}] {rec.reasoning}"[:120],
            "description": rec.reasoning,
            "priority": rec.priority,
            "delivery_mechanism": "pull_request",  # approved content lands as a PR, never a direct push
        }
