"""Mechanism.HTML_HEAD — minimal, idempotent edits to a real <head> in an HTML file.

Replaces the behaviour in core/seo_adapters._inject_block(), which had two defects this
module exists to remove:

  1. It only de-duplicated against its own `<!-- raftra:seo:start -->` sentinel, so a page
     that already carried a hand-written <meta name="description"> got a SECOND one on the
     first run. Here every tag is located by what it *is* (name/property/rel), regardless of
     who wrote it, so an existing tag is updated in place.
  2. With no </head> it appended the block to the end of the file. Here a missing <head> is
     a hard failure: no <head> means this is not an HTML_HEAD target and the resolver picked
     wrong. Appending raw tags to a JSX module is how metadata ended up at the bottom of
     src/pages/Home.jsx.

Edits are offset splices against the string handed in, so formatting, comments and
everything outside the touched tag survive byte-for-byte.
"""
from __future__ import annotations

import difflib
import json
import re
from html import escape as _esc
from typing import Optional

from ..change_plan import ChangeAction, ChangePlan, TargetType
from .base import ModResult, Occurrence

# --- how each property is written, and how it is found again ---------------------------
# `finder` matches an existing tag anywhere in the document; `render` builds a fresh one.
# Both are keyed on the property's real identity (rel/name/property), never on our sentinel.

_TITLE_RE = re.compile(r"<title\b[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)


def _meta_re(attr: str, value: str) -> re.Pattern:
    """A <meta> whose `attr` equals `value`, with the attributes in either order —
    <meta name="x" content="y"> and <meta content="y" name="x"> are the same tag."""
    v = re.escape(value)
    return re.compile(
        rf"<meta\b(?=[^>]*\b{attr}\s*=\s*[\"']{v}[\"'])[^>]*>",
        re.IGNORECASE,
    )


_LINK_CANONICAL_RE = re.compile(
    r"<link\b(?=[^>]*\brel\s*=\s*[\"']\s*canonical\s*[\"'])[^>]*>", re.IGNORECASE
)
_JSONLD_RE = re.compile(
    r"<script\b[^>]*\btype\s*=\s*[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
    re.IGNORECASE | re.DOTALL,
)
_CONTENT_ATTR_RE = re.compile(r"\bcontent\s*=\s*([\"'])(.*?)\1", re.IGNORECASE | re.DOTALL)
_HREF_ATTR_RE = re.compile(r"\bhref\s*=\s*([\"'])(.*?)\1", re.IGNORECASE | re.DOTALL)


def _finder_for(t: TargetType) -> Optional[re.Pattern]:
    if t is TargetType.TITLE:
        return _TITLE_RE
    if t is TargetType.CANONICAL:
        return _LINK_CANONICAL_RE
    if t is TargetType.JSON_LD:
        return _JSONLD_RE
    if t is TargetType.META_DESCRIPTION:
        return _meta_re("name", "description")
    if t is TargetType.ROBOTS_META:
        return _meta_re("name", "robots")
    if t.value.startswith("og:"):
        return _meta_re("property", t.value)
    if t.value.startswith("twitter:"):
        return _meta_re("name", t.value)
    return None


# The TargetType enum value is our internal identifier; the HTML attribute is what actually
# goes in the document. They differ for the two properties whose enum name is qualified
# ("meta_description" -> description, "robots_meta" -> robots). Rendering the enum value
# directly writes <meta name="meta_description">, which no crawler reads and which
# _finder_for() then fails to match — so every run re-inserts and duplicates pile up.
_HTML_ATTR_NAME = {
    TargetType.META_DESCRIPTION: "description",
    TargetType.ROBOTS_META: "robots",
}


def _html_attr_name(t: TargetType) -> str:
    return _HTML_ATTR_NAME.get(t, t.value)


def _render(t: TargetType, value: str) -> str:
    if t is TargetType.TITLE:
        return f"<title>{_esc(value)}</title>"
    if t is TargetType.CANONICAL:
        return f'<link rel="canonical" href="{_esc(value)}">'
    if t is TargetType.JSON_LD:
        # value is already-serialised JSON; embed verbatim so it stays valid.
        return f'<script type="application/ld+json">\n{value}\n</script>'
    if t.value.startswith("og:"):
        return f'<meta property="{t.value}" content="{_esc(value)}">'
    return f'<meta name="{_html_attr_name(t)}" content="{_esc(value)}">'


def _extract_value(t: TargetType, raw: str, match: re.Match) -> Optional[str]:
    if t is TargetType.TITLE:
        return (match.group(1) or "").strip()
    if t is TargetType.JSON_LD:
        return (match.group(1) or "").strip()
    if t is TargetType.CANONICAL:
        m = _HREF_ATTR_RE.search(raw)
        return m.group(2).strip() if m else None
    m = _CONTENT_ATTR_RE.search(raw)
    return m.group(2).strip() if m else None


# --- head location ----------------------------------------------------------------------

_HEAD_OPEN_RE = re.compile(r"<head\b[^>]*>", re.IGNORECASE)
_HEAD_CLOSE_RE = re.compile(r"</head\s*>", re.IGNORECASE)


def find_head_span(html: str) -> Optional[tuple[int, int]]:
    """(inner_start, inner_end) of the <head> element, or None when there isn't one."""
    open_m = _HEAD_OPEN_RE.search(html)
    close_m = _HEAD_CLOSE_RE.search(html, open_m.end() if open_m else 0)
    if not open_m or not close_m:
        return None
    return open_m.end(), close_m.start()


def inspect(html: str, target_type: TargetType) -> list[Occurrence]:
    """Every existing instance of this property, wherever it sits in the document.

    Deliberately scans the WHOLE document, not just <head>: a stray duplicate
    <meta name="description"> in <body> still counts as a duplicate to a crawler, and
    reporting it is more useful than silently adding a third.
    """
    finder = _finder_for(target_type)
    if not finder:
        return []
    out: list[Occurrence] = []
    for m in finder.finditer(html):
        raw = m.group(0)
        out.append(Occurrence(start=m.start(), end=m.end(),
                              value=_extract_value(target_type, raw, m), raw=raw))
    return out


def _indent_at(html: str, pos: int) -> str:
    line_start = html.rfind("\n", 0, pos) + 1
    ws = re.match(r"[ \t]*", html[line_start:pos])
    return ws.group(0) if ws else "  "


def _diff(before: str, after: str, path: str) -> str:
    return "".join(difflib.unified_diff(
        before.splitlines(keepends=True), after.splitlines(keepends=True),
        fromfile=f"a/{path}", tofile=f"b/{path}", n=3,
    ))


def apply(html: str, plan: ChangePlan, *, path: str = "file") -> ModResult:
    """Perform the minimal edit for one property. Never appends outside <head>."""
    t = plan.target_type
    if _finder_for(t) is None:
        return ModResult(ok=False, reason=f"{t.value} is not an HTML head property.")

    proposed = plan.proposed_value
    if t is TargetType.JSON_LD and isinstance(proposed, (dict, list)):
        proposed = json.dumps(proposed, indent=2)
    proposed = (proposed or "").strip()
    if not proposed:
        return ModResult(ok=True, changed=False, action="noop",
                         reason="No proposed value — nothing to write.")

    occurrences = inspect(html, t)
    current = occurrences[0].value if occurrences else None

    # --- Duplicates: never add another. Consolidating is a real edit, so it is only done
    #     when explicitly planned; otherwise this is a review item.
    if len(occurrences) > 1 and plan.action is not ChangeAction.CONSOLIDATE:
        return ModResult(
            ok=False, occurrences=len(occurrences), current_value=current,
            reason=(f"{len(occurrences)} existing <{t.value}> tags found. Consolidating is a "
                    "destructive edit, so this needs human review rather than an automatic write."),
            candidates=[o.raw[:120] for o in occurrences],
        )

    # --- Idempotency: already correct -> do nothing. Running twice must not churn the file.
    if current is not None and current.strip() == proposed:
        return ModResult(ok=True, changed=False, action="noop", current_value=current,
                         occurrences=len(occurrences),
                         reason=f"{t.value} already matches the proposed value.")

    new_tag = _render(t, proposed)

    if occurrences and plan.action is ChangeAction.CONSOLIDATE:
        # Keep the first, drop the rest — splice back-to-front so earlier offsets stay valid.
        out = html
        for occ in sorted(occurrences[1:], key=lambda o: o.start, reverse=True):
            out = out[: occ.start] + out[occ.end:]
        first = occurrences[0]
        out = out[: first.start] + new_tag + out[first.end:]
        return ModResult(ok=True, content=out, changed=True, action="consolidate",
                         current_value=current, occurrences=len(occurrences),
                         reason=f"Collapsed {len(occurrences)} duplicate {t.value} tags into one.",
                         diff=_diff(html, out, path))

    if occurrences:
        occ = occurrences[0]
        out = html[: occ.start] + new_tag + html[occ.end:]
        return ModResult(ok=True, content=out, changed=True, action="update",
                         current_value=current, occurrences=1,
                         reason=f"Updated the existing {t.value}.",
                         diff=_diff(html, out, path))

    # --- Insert. Only ever inside <head>, immediately before </head>.
    span = find_head_span(html)
    if not span:
        return ModResult(
            ok=False, reason=(
                "No <head> element in this file, so an HTML head tag cannot be inserted. "
                "This usually means the target was resolved to the wrong file — a component "
                "or template does not own the document head."),
        )
    _, inner_end = span
    # Insert on its own line ABOVE </head>, reusing the closing tag's own indentation so the
    # result is consistent no matter how many tags are added in one batch. Splicing directly
    # at inner_end instead consumes the whitespace that indents </head>, which left it at
    # column 0 and gave each successive tag a different indent — ugly in a PR diff.
    line_start = html.rfind("\n", 0, inner_end) + 1
    closing_indent = html[line_start:inner_end]
    if closing_indent.strip() == "":
        # </head> sits on its own line: put the tag on the line before it, one level deeper.
        out = html[:line_start] + f"{closing_indent}  {new_tag}\n" + html[line_start:]
    else:
        # </head> shares a line with content — break before it rather than reflow that line.
        indent = _indent_at(html, inner_end) or "  "
        out = html[:inner_end] + f"\n{indent}  {new_tag}\n{indent}" + html[inner_end:]
    return ModResult(ok=True, content=out, changed=True, action="insert",
                     current_value=None, occurrences=0,
                     reason=f"Inserted {t.value} into <head>.",
                     diff=_diff(html, out, path))
