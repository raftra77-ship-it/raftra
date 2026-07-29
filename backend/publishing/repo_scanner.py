"""Repository Scanner — runs automatically right after a GitHub repository is selected
(connector_routes.gh_select_repo), using the existing GitHub connection. Read-only: fetches
the repo's file tree, detects the framework, and builds a page-by-page file mapping. It
never modifies files, never commits, and never opens a pull request — that stays entirely
out of scope here (see publishing/publishers/github.py for where real publishing eventually
lives).

The stored RepositoryMapping is what a future GitHubConverter will use to resolve a page
like "/about" to a real file path like "src/app/about/page.tsx" instead of leaving
file_path as None (see PageMappingService in this same package for the existing, currently
platform-agnostic mapping layer this feeds into).
"""
from __future__ import annotations

import datetime
import json
import re
from typing import Optional

from sqlalchemy.orm import Session

import models
from core import github_connect as gh

FRAMEWORKS = ("Next.js", "Astro", "Gatsby", "Vite", "React", "HTML/CSS", "Unknown")


class RepositoryScanner:
    """Scans one connected GitHub repo and stores the result on `models.RepositoryMapping`.
    One row per workspace — re-scanning overwrites it."""

    def __init__(self, db: Session):
        self.db = db

    async def scan(self, workspace_id: int, connection) -> models.RepositoryMapping:
        row = self._get_or_create(workspace_id, connection.repo_full_name)
        row.status = "scanning"
        row.error = None
        self.db.commit()
        try:
            tree = await gh.get_repo_tree(connection.access_token, connection.repo_full_name,
                                          connection.default_branch or "main")
            paths = [t["path"] for t in tree["tree"] if t["type"] == "blob"]
            package_json = await self._read_package_json(connection, paths)
            framework = self._detect_framework(paths, package_json)
            pages = self._build_page_mapping(paths, framework)

            row.framework = framework
            row.default_branch = connection.default_branch or "main"
            row.pages = pages
            row.pages_count = sum(1 for p in pages if p["type"] == "page")
            row.truncated = tree["truncated"]
            row.scanned_at = datetime.datetime.utcnow()
            row.status = "ready"
        except Exception as e:
            row.status = "failed"
            row.error = str(e)
        self.db.commit()
        self.db.refresh(row)
        return row

    def get_mapping(self, workspace_id: int) -> Optional[models.RepositoryMapping]:
        return self.db.query(models.RepositoryMapping).filter_by(workspace_id=workspace_id).first()

    def _get_or_create(self, workspace_id: int, repo_full_name: str) -> models.RepositoryMapping:
        row = self.get_mapping(workspace_id)
        if not row:
            row = models.RepositoryMapping(workspace_id=workspace_id, repo_full_name=repo_full_name)
            self.db.add(row)
        else:
            row.repo_full_name = repo_full_name
        self.db.commit()
        self.db.refresh(row)
        return row

    async def _read_package_json(self, connection, paths: list[str]) -> Optional[dict]:
        if "package.json" not in paths:
            return None
        content = await gh.get_file_content(connection.access_token, connection.repo_full_name,
                                            "package.json", connection.default_branch or "main")
        if not content:
            return None
        try:
            return json.loads(content)
        except Exception:
            return None

    # ---- framework detection -----------------------------------------------------------

    def _detect_framework(self, paths: list[str], package_json: Optional[dict]) -> str:
        deps: dict = {}
        if package_json:
            deps.update(package_json.get("dependencies") or {})
            deps.update(package_json.get("devDependencies") or {})

        def has_config(*names: str) -> bool:
            return any(p in names for p in paths)

        if "next" in deps or has_config("next.config.js", "next.config.mjs", "next.config.ts"):
            return "Next.js"
        if "astro" in deps or has_config("astro.config.mjs", "astro.config.ts", "astro.config.js"):
            return "Astro"
        if "gatsby" in deps or has_config("gatsby-config.js", "gatsby-config.ts"):
            return "Gatsby"
        if "vite" in deps or has_config("vite.config.js", "vite.config.ts"):
            return "Vite"
        if "react" in deps:
            return "React"
        if any(re.search(r"(^|/)index\.html$", p) for p in paths):
            return "HTML/CSS"
        return "Unknown"

    # ---- page mapping ---------------------------------------------------------------

    def _build_page_mapping(self, paths: list[str], framework: str) -> list[dict]:
        pages: list[dict] = []
        if framework == "Next.js":
            pages.extend(self._scan_next_app_router(paths))
            pages.extend(self._scan_next_pages_router(paths))
        elif framework == "Astro":
            pages.extend(self._scan_convention_pages(paths, "src/pages", (".astro", ".md", ".mdx")))
        elif framework == "Gatsby":
            pages.extend(self._scan_convention_pages(paths, "src/pages", (".js", ".jsx", ".tsx")))
        elif framework in ("Vite", "React"):
            pages.extend(self._scan_convention_pages(paths, "src/pages", (".jsx", ".tsx", ".js")))
        elif framework == "HTML/CSS":
            pages.extend(self._scan_html_pages(paths))

        pages.extend(self._scan_special_files(paths))
        return pages

    _NEXT_PAGE_RE = re.compile(r"^(?:src/)?app/(.*/)?page\.(tsx|jsx|ts|js)$")
    _NEXT_LAYOUT_RE = re.compile(r"^(?:src/)?app/(.*/)?layout\.(tsx|jsx|ts|js)$")

    def _scan_next_app_router(self, paths: list[str]) -> list[dict]:
        out = []
        for path in paths:
            m = self._NEXT_PAGE_RE.match(path)
            if m:
                out.append({"url": self._app_router_url(m.group(1)), "file_path": path,
                           "type": "page", "editable": True, "metadata_location": path})
                continue
            m2 = self._NEXT_LAYOUT_RE.match(path)
            if m2:
                out.append({"url": None, "file_path": path, "type": "layout",
                           "editable": True, "metadata_location": None})
        return out

    @staticmethod
    def _app_router_url(dir_part: Optional[str]) -> str:
        """Next.js App Router: directory segments become the URL; route groups like
        "(marketing)" are stripped since they don't appear in the real URL."""
        if not dir_part:
            return "/"
        segments = [s for s in dir_part.strip("/").split("/")
                   if s and not (s.startswith("(") and s.endswith(")"))]
        return "/" + "/".join(segments) if segments else "/"

    _NEXT_PAGES_RE = re.compile(r"^(?:src/)?pages/((?!_app|_document|api/).*)\.(tsx|jsx|ts|js)$")

    def _scan_next_pages_router(self, paths: list[str]) -> list[dict]:
        out = []
        for path in paths:
            m = self._NEXT_PAGES_RE.match(path)
            if not m:
                continue
            rel = m.group(1)
            url = "/" if rel == "index" else "/" + re.sub(r"/index$", "", rel)
            out.append({"url": url, "file_path": path, "type": "page",
                       "editable": True, "metadata_location": path})
        return out

    def _scan_convention_pages(self, paths: list[str], base_dir: str, extensions: tuple) -> list[dict]:
        """Shared "src/pages/**" file-based-routing convention used by Astro, Gatsby, and
        commonly by plain Vite/React projects that adopt the same layout."""
        out = []
        for path in paths:
            if not path.startswith(base_dir + "/") or not any(path.endswith(ext) for ext in extensions):
                continue
            rel = path[len(base_dir) + 1:]
            for ext in extensions:
                if rel.endswith(ext):
                    rel = rel[: -len(ext)]
                    break
            url = "/" if rel == "index" else "/" + re.sub(r"/index$", "", rel)
            out.append({"url": url, "file_path": path, "type": "page",
                       "editable": True, "metadata_location": path})
        return out

    def _scan_html_pages(self, paths: list[str]) -> list[dict]:
        out = []
        for path in paths:
            if "node_modules/" in path or not path.endswith(".html"):
                continue
            rel = path[: -len(".html")]
            url = "/" if rel == "index" else "/" + re.sub(r"/index$", "", rel)
            out.append({"url": url, "file_path": path, "type": "page",
                       "editable": True, "metadata_location": path})
        return out

    def _scan_special_files(self, paths: list[str]) -> list[dict]:
        """SEO-relevant files that matter regardless of framework, plus a summary marker
        for the static-assets directory (kept as one entry, not every individual asset)."""
        out = []
        special = {
            "sitemap.xml": "sitemap", "public/sitemap.xml": "sitemap",
            "robots.txt": "robots", "public/robots.txt": "robots",
        }
        for path, ftype in special.items():
            if path in paths:
                out.append({"url": None, "file_path": path, "type": ftype,
                           "editable": False, "metadata_location": None})
        if any(p.startswith("public/") for p in paths):
            out.append({"url": None, "file_path": "public", "type": "assets_dir",
                       "editable": False, "metadata_location": None})
        elif any(p.startswith("static/") for p in paths):
            out.append({"url": None, "file_path": "static", "type": "assets_dir",
                       "editable": False, "metadata_location": None})
        return out
