"""Platform adapters — each function takes the SAME UniversalSeoFix and translates it into
one platform's own write mechanics. No adapter calls an LLM or invents a value; they only
place fields where each platform actually exposes them.

Platform capability differs, and each adapter is honest about it rather than faking support:
  - GitHub:    full <head> control (it's a raw file) -> every field can be written.
  - Shopify:   title/meta_description go through the Page metafields API (the real SEO
               fields Shopify exposes); canonical/OG/twitter/schema need actual <head>
               control, which only the theme's layout/theme.liquid has.
  - WordPress: only the post title is a real head-affecting field via REST without a
               plugin. JSON-LD is the one exception — a <script type="application/ld+json">
               is valid anywhere in the DOM, so it's embedded in the content. Everything
               else (meta_description/canonical/OG/twitter) needs a specific SEO plugin's
               field, whose presence we can't assume, so those are reported as skipped
               rather than silently written somewhere that won't take effect.
"""
from __future__ import annotations
import json
import re
from html import escape as _esc

from .seo_fix_schema import UniversalSeoFix

_START = "<!-- raftra:seo:start -->"
_END = "<!-- raftra:seo:end -->"


def _build_tag_block(fix: UniversalSeoFix, include_description: bool = True) -> list[str]:
    tags = []
    if fix.canonical:
        tags.append(f'<link rel="canonical" href="{_esc(fix.canonical)}">')
    if include_description and fix.meta_description:
        tags.append(f'<meta name="description" content="{_esc(fix.meta_description)}">')
    if fix.open_graph:
        if fix.open_graph.title:
            tags.append(f'<meta property="og:title" content="{_esc(fix.open_graph.title)}">')
        if fix.open_graph.description:
            tags.append(f'<meta property="og:description" content="{_esc(fix.open_graph.description)}">')
        tags.append(f'<meta property="og:type" content="{_esc(fix.open_graph.type)}">')
    if fix.twitter:
        tags.append(f'<meta name="twitter:card" content="{_esc(fix.twitter.card)}">')
        if fix.twitter.title:
            tags.append(f'<meta name="twitter:title" content="{_esc(fix.twitter.title)}">')
        if fix.twitter.description:
            tags.append(f'<meta name="twitter:description" content="{_esc(fix.twitter.description)}">')
    if fix.schema_jsonld:
        tags.append(f'<script type="application/ld+json">\n{json.dumps(fix.schema_jsonld, indent=2)}\n</script>')
    return tags


def _inject_block(html: str, tags: list[str]) -> str:
    if not tags:
        return html
    block = _START + "\n" + "\n".join(tags) + "\n" + _END
    if _START in html:
        return re.sub(re.escape(_START) + r".*?" + re.escape(_END), block, html, flags=re.DOTALL)
    idx = html.lower().rfind("</head>")
    if idx == -1:
        return html.rstrip() + "\n" + block  # no <head> found — append at the end rather than drop it
    return html[:idx] + block + "\n" + html[idx:]


def apply_to_html(html: str, fix: UniversalSeoFix) -> str:
    """GitHub adapter: a raw HTML/template file has full <head> control, so every field applies."""
    if fix.title:
        if re.search(r"<title>.*?</title>", html, re.IGNORECASE | re.DOTALL):
            html = re.sub(r"<title>.*?</title>", f"<title>{_esc(fix.title)}</title>",
                          html, count=1, flags=re.IGNORECASE | re.DOTALL)
        else:
            idx = html.lower().find("</head>")
            if idx != -1:
                html = html[:idx] + f"<title>{_esc(fix.title)}</title>\n" + html[idx:]
    return _inject_block(html, _build_tag_block(fix, include_description=True))


def apply_to_wordpress(current_title: str, current_content: str, fix: UniversalSeoFix) -> dict:
    """WordPress adapter. Returns {title, content, skipped} — `skipped` lists fields this
    adapter could not apply for real (no plugin assumed), so the caller can be honest about it."""
    title = fix.title or current_title
    content = current_content
    if fix.schema_jsonld:
        block = (f'{_START}\n<script type="application/ld+json">\n'
                 f'{json.dumps(fix.schema_jsonld, indent=2)}\n</script>\n{_END}')
        if _START in content:
            content = re.sub(re.escape(_START) + r".*?" + re.escape(_END), block, content, flags=re.DOTALL)
        else:
            content = content.rstrip() + "\n\n" + block
    skipped = [name for name, val in (
        ("meta_description", fix.meta_description), ("canonical", fix.canonical),
        ("open_graph", fix.open_graph), ("twitter", fix.twitter),
    ) if val]
    return {"title": title, "content": content, "skipped": skipped}


def apply_to_shopify_page(fix: UniversalSeoFix) -> dict:
    """Shopify adapter (Page metafields) — the two fields Shopify's Page API exposes."""
    return {"seo_title": fix.title, "meta_description": fix.meta_description}


def apply_to_shopify_theme(theme_html: str, fix: UniversalSeoFix) -> str:
    """Shopify adapter (layout/theme.liquid <head>) — canonical/OG/twitter/schema, the fields
    that need real <head> control. title/meta_description are deliberately excluded here:
    those already go through apply_to_shopify_page()/the Page metafields API, which Shopify's
    own theme already renders into <title>/<meta name="description"> — injecting them again
    here would just create a duplicate, conflicting tag."""
    return _inject_block(theme_html, _build_tag_block(fix, include_description=False))
