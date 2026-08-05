"""Deterministic builders for whole SITE-LEVEL files (robots.txt, sitemap.xml) — distinct
from core/seo_jsonld.py's PAGE-LEVEL tag builders. These are real, standard file formats
built only from data the repo scan and workspace already have (the site's own domain, and
the pages the scanner actually discovered) — nothing here is invented per-request text.
"""
from __future__ import annotations


def _normalize_base(base_url: str) -> str:
    base = (base_url or "").strip().rstrip("/")
    if base and not base.lower().startswith(("http://", "https://")):
        base = f"https://{base}"
    return base


def build_robots_txt(base_url: str) -> str:
    """Standard, permissive robots.txt pointing at the site's own sitemap — the boilerplate
    every "add a robots.txt" recommendation is asking for. No content here is invented; the
    only variable part is the real site URL."""
    base = _normalize_base(base_url)
    lines = ["User-agent: *", "Allow: /"]
    if base:
        lines += ["", f"Sitemap: {base}/sitemap.xml"]
    return "\n".join(lines) + "\n"


def build_sitemap_xml(base_url: str, routes: list[str]) -> str:
    """A real XML sitemap built ONLY from routes the repository scanner actually discovered
    (publishing/repo_scanner.py) — never a guessed or invented URL list. `routes` are the
    site-relative paths from RepositoryMapping.pages (e.g. "/", "/about")."""
    base = _normalize_base(base_url)
    seen = []
    for r in routes:
        r = (r or "/").strip()
        url = f"{base}{r}" if base else r
        if url not in seen:
            seen.append(url)
    body = "\n".join(f"  <url><loc>{u}</loc></url>" for u in seen)
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
           f"{body}\n"
           "</urlset>\n")
