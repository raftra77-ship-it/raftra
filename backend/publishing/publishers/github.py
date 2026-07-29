from .base import Publisher


class GitHubPublisher(Publisher):
    platform_name = "github"

    def validate(self, payload: dict) -> dict:
        errors = []
        if not self.connection or not getattr(self.connection, "access_token", None):
            errors.append("GitHub is not connected for this workspace.")
        if not self.connection or not getattr(self.connection, "repo_full_name", None):
            errors.append("No repository selected.")
        if not payload.get("file_path"):
            errors.append("No file path resolved for this page yet (page mapping needed).")
        return {"valid": not errors, "errors": errors}

    def preview(self, payload: dict) -> dict:
        return {
            "platform": "github",
            "would_create": "pull_request",
            "repo": getattr(self.connection, "repo_full_name", None),
            "branch": getattr(self.connection, "default_branch", None) or "main",
            "file_path": payload.get("file_path"),
            "change_type": payload.get("change_type"),
            "commit_message": payload.get("commit_message"),
            "summary": payload.get("description"),
        }

    # publish() is inherited from Publisher — architecture-only preview for now. Override
    # here later with the real commit+PR call (core/github_connect.py already has one).
