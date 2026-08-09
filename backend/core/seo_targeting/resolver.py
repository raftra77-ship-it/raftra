"""TargetResolver — turns "issue X on page Y" into an addressable location, or refuses.

The GitHub resolver replaces `target = target or pages[0]`
(connector_routes.gh_apply_seo_fixes). Two things changed:

  * The page is matched by URL against the real repository scan, and a page that cannot be
    matched is an error, not an excuse to edit the first file in the list.
  * The file that OWNS the metadata is resolved separately from the file that renders the
    page. In Next.js those are usually different (page.tsx vs layout.tsx); in a Vite/React
    SPA the page component never owns <head> at all — index.html or a Helmet does. The old
    code conflated the two, which is how <meta> tags reached the bottom of a .jsx module.

Resolution reads candidate files before deciding, because a path alone cannot tell you
which mechanism is in play — `app/page.tsx` may or may not export `metadata`. Files are
fetched through an injected async reader so this is testable without a GitHub connection.
"""
from __future__ import annotations

import re
from typing import Awaitable, Callable, Optional

from .change_plan import Mechanism, TargetLocation, TargetType

# (path) -> file contents, or None when the path does not exist.
ReadFile = Callable[[str], Awaitable[Optional[str]]]

_METADATA_EXPORT_RE = re.compile(
    r"export\s+(?:const|async\s+function|function)\s+(?:metadata|generateMetadata)\b")
_HELMET_RE = re.compile(r"<\s*Helmet[\s>]|from\s+['\"]react-helmet(?:-async)?['\"]")
_NEXT_HEAD_RE = re.compile(r"from\s+['\"]next/head['\"]")
_HEAD_ELEMENT_RE = re.compile(r"<head\b[^>]*>", re.IGNORECASE)


class ResolutionError(Exception):
    """Raised when no safe target exists. Carries candidates so the UI can show the choice
    rather than a dead end."""

    def __init__(self, message: str, candidates: Optional[list[str]] = None):
        super().__init__(message)
        self.message = message
        self.candidates = candidates or []


def _normalize_url(url: Optional[str]) -> str:
    if not url:
        return "/"
    from urllib.parse import urlsplit
    path = urlsplit(url).path or "/"
    path = "/" + path.strip("/")
    return path if path != "//" else "/"


def match_page(pages: list[dict], page_url: Optional[str]) -> dict:
    """The scanned page entry for this URL.

    Mirrors connector_routes._match_page_to_audit's contract for WordPress: an unmatched
    page raises instead of defaulting, because applying one page's fixes to another is the
    exact failure being designed out.
    """
    usable = [p for p in (pages or []) if p.get("file_path") and p.get("type") == "page"]
    if not usable:
        raise ResolutionError("The repository scan found no editable page files.")

    wanted = _normalize_url(page_url)
    for p in usable:
        if _normalize_url(p.get("url")) == wanted:
            return p

    # A single-page project is unambiguous even when the URL does not literally match —
    # there is only one page it could possibly be.
    if len(usable) == 1:
        return usable[0]

    raise ResolutionError(
        f"No scanned page matches {wanted}. The audit targeted a URL this repository does "
        "not appear to serve, so nothing was changed.",
        candidates=[f"{p.get('url')} -> {p['file_path']}" for p in usable[:10]],
    )


async def resolve_github_target(
    *,
    framework: str,
    pages: list[dict],
    page_url: Optional[str],
    target_type: TargetType,
    read_file: ReadFile,
) -> TargetLocation:
    """Which file, and which mechanism, actually controls `target_type` for this page."""
    page = match_page(pages, page_url)
    page_path = page["file_path"]

    if target_type in (TargetType.H1, TargetType.IMAGE_ALT):
        # Body content lives in the page component itself, not in a head owner.
        return TargetLocation(
            platform="github", resource_kind="file", resource_id=page_path,
            resource_label=page_path, mechanism=Mechanism.UNKNOWN, confidence=0.9,
            reason=f"{target_type.value} is page body content, rendered by {page_path}.",
        )

    fw = (framework or "Unknown").lower()
    if fw.startswith("next"):
        return await _resolve_next(page, page_path, pages, read_file)
    if fw.startswith("astro"):
        return await _resolve_astro(page_path, read_file)
    if fw in ("vite", "react", "gatsby"):
        return await _resolve_spa(page_path, pages, read_file, framework)
    if fw.startswith("html"):
        return await _resolve_plain_html(page_path, read_file)
    return await _resolve_unknown(page_path, pages, read_file)


# --- Next.js -----------------------------------------------------------------------------

async def _resolve_next(page: dict, page_path: str, pages: list[dict],
                        read_file: ReadFile) -> TargetLocation:
    """App Router prefers the page's own `export const metadata`; if the page has none, the
    nearest layout owns it. Pages Router uses next/head inside the component."""
    src = await read_file(page_path)

    if src and _METADATA_EXPORT_RE.search(src):
        return TargetLocation(
            platform="github", resource_kind="file", resource_id=page_path,
            resource_label=page_path, mechanism=Mechanism.NEXT_METADATA_EXPORT,
            selector="export const metadata", confidence=0.95,
            reason=f"{page_path} exports its own `metadata` object.",
        )
    if src and _NEXT_HEAD_RE.search(src):
        return TargetLocation(
            platform="github", resource_kind="file", resource_id=page_path,
            resource_label=page_path, mechanism=Mechanism.NEXT_HEAD_COMPONENT,
            selector="<Head>", confidence=0.9,
            reason=f"{page_path} renders metadata through next/head.",
        )

    # No metadata on the page itself — find the nearest ancestor layout.
    layouts = [p["file_path"] for p in pages if p.get("type") == "layout"]
    page_dir = page_path.rsplit("/", 1)[0] if "/" in page_path else ""
    nearest = sorted(
        [lp for lp in layouts if page_dir.startswith(lp.rsplit("/", 1)[0])],
        key=lambda lp: len(lp), reverse=True,
    )
    if len(nearest) == 1 or (nearest and len(nearest[0]) > len(nearest[1] if len(nearest) > 1 else "")):
        owner = nearest[0]
        layout_src = await read_file(owner)
        has_export = bool(layout_src and _METADATA_EXPORT_RE.search(layout_src))
        return TargetLocation(
            platform="github", resource_kind="file", resource_id=owner,
            resource_label=owner, mechanism=Mechanism.NEXT_METADATA_EXPORT,
            selector="export const metadata", confidence=0.85 if has_export else 0.8,
            reason=(f"{page_path} defines no metadata, so the nearest layout {owner} owns it"
                    + (" (it already exports `metadata`)." if has_export else
                       " (a `metadata` export will be added).")),
        )
    if nearest:
        raise ResolutionError(
            f"{page_path} defines no metadata and several layouts could own it.",
            candidates=nearest,
        )
    raise ResolutionError(
        f"{page_path} defines no `metadata` export and no layout was found to own it. "
        "Add a metadata export to the page manually, then re-run.",
        candidates=[page_path],
    )


# --- Astro --------------------------------------------------------------------------------

async def _resolve_astro(page_path: str, read_file: ReadFile) -> TargetLocation:
    src = await read_file(page_path)
    if src and _HEAD_ELEMENT_RE.search(src):
        return TargetLocation(
            platform="github", resource_kind="file", resource_id=page_path,
            resource_label=page_path, mechanism=Mechanism.HTML_HEAD, confidence=0.9,
            reason=f"{page_path} renders its own <head>.",
        )
    raise ResolutionError(
        f"{page_path} has no <head> of its own — an Astro layout almost certainly owns it. "
        "Automatic apply stopped rather than editing the wrong file.",
        candidates=[page_path],
    )


# --- Vite / React / Gatsby SPA --------------------------------------------------------------

async def _resolve_spa(page_path: str, pages: list[dict], read_file: ReadFile,
                       framework: str) -> TargetLocation:
    """In an SPA the page component almost never owns <head>.

    This is the case the old code got wrong: it handed `src/pages/Home.jsx` to an HTML
    modifier, found no </head>, and appended raw tags to the end of the module. Here the
    real owners are considered explicitly, and a genuine tie stops the apply.
    """
    src = await read_file(page_path)
    page_has_helmet = bool(src and _HELMET_RE.search(src))

    index_html = next((p for p in ("index.html", "public/index.html")
                       if any(x.get("file_path") == p for x in pages)), None)
    if index_html is None:
        for candidate in ("index.html", "public/index.html"):
            if await read_file(candidate) is not None:
                index_html = candidate
                break

    if page_has_helmet:
        # The page controls its own head via Helmet — unambiguous and per-page, which is
        # strictly better than a shared index.html that applies site-wide.
        return TargetLocation(
            platform="github", resource_kind="file", resource_id=page_path,
            resource_label=page_path, mechanism=Mechanism.REACT_HELMET,
            selector="<Helmet>", confidence=0.9,
            reason=f"{page_path} manages its own metadata with react-helmet.",
        )

    # Does some OTHER component own metadata for the whole app? If so, editing index.html
    # would be overridden at runtime — a silent no-op the user would report as "it lied".
    helmet_owners = [p["file_path"] for p in pages
                     if p.get("file_path", "").endswith((".jsx", ".tsx"))
                     and p["file_path"] != page_path]
    found_owners = []
    for cand in helmet_owners[:12]:
        c = await read_file(cand)
        if c and _HELMET_RE.search(c):
            found_owners.append(cand)

    if found_owners and index_html:
        raise ResolutionError(
            "Multiple possible metadata owners detected. Automatic apply stopped rather "
            "than picking one — a tag written to index.html would be overwritten at runtime "
            "by the Helmet component.",
            candidates=[index_html] + found_owners,
        )
    if found_owners:
        raise ResolutionError(
            f"Metadata appears to be managed by a Helmet component, but {page_path} is not "
            "it and there is no index.html to fall back on.",
            candidates=found_owners,
        )
    if index_html:
        html = await read_file(index_html)
        if html and _HEAD_ELEMENT_RE.search(html):
            return TargetLocation(
                platform="github", resource_kind="file", resource_id=index_html,
                resource_label=index_html, mechanism=Mechanism.HTML_HEAD, confidence=0.85,
                reason=(f"{framework} app with no per-page metadata component; {index_html} "
                        "owns the document <head>. Note this is site-wide, not per-page."),
            )
    raise ResolutionError(
        f"Could not find anything that owns <head> for {page_path} in this {framework} "
        "project (no Helmet component and no index.html with a <head>).",
        candidates=[page_path],
    )


# --- plain HTML / unknown --------------------------------------------------------------------

async def _resolve_plain_html(page_path: str, read_file: ReadFile) -> TargetLocation:
    src = await read_file(page_path)
    if src is None:
        raise ResolutionError(f"Could not read {page_path} from the repository.")
    if not _HEAD_ELEMENT_RE.search(src):
        raise ResolutionError(
            f"{page_path} has no <head> element, so there is nowhere valid to place a "
            "metadata tag. It may be a fragment included by another template.",
            candidates=[page_path],
        )
    return TargetLocation(
        platform="github", resource_kind="file", resource_id=page_path,
        resource_label=page_path, mechanism=Mechanism.HTML_HEAD, confidence=0.95,
        reason=f"{page_path} is a static HTML page with its own <head>.",
    )


async def _resolve_unknown(page_path: str, pages: list[dict],
                           read_file: ReadFile) -> TargetLocation:
    """Framework detection failed. Only proceed if the mapped file itself has a <head>;
    otherwise stop, because there is no convention to fall back on."""
    src = await read_file(page_path)
    if src and _HEAD_ELEMENT_RE.search(src):
        return TargetLocation(
            platform="github", resource_kind="file", resource_id=page_path,
            resource_label=page_path, mechanism=Mechanism.HTML_HEAD, confidence=0.8,
            reason=f"Framework unknown, but {page_path} contains a real <head>.",
        )
    raise ResolutionError(
        "The repository's framework could not be identified and the mapped page file has "
        "no <head>, so the metadata owner is unknown. Automatic apply stopped.",
        candidates=[page_path],
    )
