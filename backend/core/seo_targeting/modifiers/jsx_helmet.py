"""Mechanism.REACT_HELMET — edit the tags inside a <Helmet> block.

Helmet children look like HTML but are JSX, which changes three things that matter:

  * Tags must be self-closed (`<meta ... />`). Emitting `<meta ...>` is a syntax error, so
    the html_head renderer cannot be reused directly.
  * An attribute may be an expression (`content={description}`) rather than a literal.
    Replacing that with a string would silently delete a binding, so those are refused.
  * Edits must stay inside the <Helmet> element. A `<title>` elsewhere in the component is
    ordinary markup, not metadata, and rewriting it would change the visible page.

Only the first <Helmet> block is considered; a component rendering several conditionally is
ambiguous and refused rather than guessed at.
"""
from __future__ import annotations

import difflib
import re
from typing import Optional

from ..change_plan import ChangeAction, ChangePlan, TargetType
from .base import ModResult, Occurrence

_HELMET_OPEN_RE = re.compile(r"<\s*Helmet(?:\s[^>]*?)?>", re.IGNORECASE)
_HELMET_CLOSE_RE = re.compile(r"<\s*/\s*Helmet\s*>", re.IGNORECASE)
_HELMET_SELF_CLOSING_RE = re.compile(r"<\s*Helmet(?:\s[^>]*?)?/\s*>", re.IGNORECASE)

_TITLE_RE = re.compile(r"<title\s*>(.*?)</title\s*>", re.IGNORECASE | re.DOTALL)
_ATTR_LITERAL_RE = re.compile(r"""\b(content|href)\s*=\s*(["'])(.*?)\2""", re.IGNORECASE | re.DOTALL)
_ATTR_EXPR_RE = re.compile(r"""\b(content|href)\s*=\s*\{""", re.IGNORECASE)

# Same identity mapping as html_head: the enum value is internal, the DOM attribute is what
# React renders. Writing name="meta_description" would produce a tag no crawler reads.
_ATTR_NAME = {
    TargetType.META_DESCRIPTION: "description",
    TargetType.ROBOTS_META: "robots",
}


def _attr_name(t: TargetType) -> str:
    return _ATTR_NAME.get(t, t.value)


def supports(t: TargetType) -> bool:
    return t.is_head_tag and t is not TargetType.JSON_LD


def _finder_for(t: TargetType) -> Optional[re.Pattern]:
    if t is TargetType.TITLE:
        return _TITLE_RE
    if t is TargetType.CANONICAL:
        return re.compile(r"<link\b(?=[^>]*\brel\s*=\s*[\"']\s*canonical\s*[\"'])[^>]*/?\s*>",
                          re.IGNORECASE)
    key = "property" if t.value.startswith("og:") else "name"
    val = re.escape(_attr_name(t))
    return re.compile(rf"<meta\b(?=[^>]*\b{key}\s*=\s*[\"']{val}[\"'])[^>]*/?\s*>", re.IGNORECASE)


def _render(t: TargetType, value: str) -> str:
    """JSX-safe. Braces and quotes inside JSX text/attributes must be escaped as entities —
    a bare `{` opens an expression and breaks the build."""
    v = (value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
              .replace('"', "&quot;").replace("{", "&#123;").replace("}", "&#125;"))
    if t is TargetType.TITLE:
        return f"<title>{v}</title>"
    if t is TargetType.CANONICAL:
        return f'<link rel="canonical" href="{v}" />'
    if t.value.startswith("og:"):
        return f'<meta property="{t.value}" content="{v}" />'
    return f'<meta name="{_attr_name(t)}" content="{v}" />'


def find_helmet_span(src: str) -> Optional[tuple[int, int]]:
    """(inner_start, inner_end) of the first <Helmet> element's children."""
    opens = list(_HELMET_OPEN_RE.finditer(src))
    real_opens = [m for m in opens if not _HELMET_SELF_CLOSING_RE.fullmatch(m.group(0))]
    if not real_opens:
        return None
    open_m = real_opens[0]
    close_m = _HELMET_CLOSE_RE.search(src, open_m.end())
    if not close_m:
        return None
    return open_m.end(), close_m.start()


def count_helmets(src: str) -> int:
    return len([m for m in _HELMET_OPEN_RE.finditer(src)
                if not _HELMET_SELF_CLOSING_RE.fullmatch(m.group(0))])


def inspect(src: str, target_type: TargetType) -> list[Occurrence]:
    span = find_helmet_span(src)
    finder = _finder_for(target_type)
    if not span or not finder:
        return []
    inner_start, inner_end = span
    body = src[inner_start:inner_end]
    out: list[Occurrence] = []
    for m in finder.finditer(body):
        raw = m.group(0)
        if target_type is TargetType.TITLE:
            value = (m.group(1) or "").strip()
            # A JSX expression child ({title}) is a binding, not a literal.
            value = None if value.startswith("{") else value
        elif _ATTR_EXPR_RE.search(raw):
            value = None
        else:
            am = _ATTR_LITERAL_RE.search(raw)
            value = am.group(3).strip() if am else None
        out.append(Occurrence(start=inner_start + m.start(), end=inner_start + m.end(),
                              value=value, raw=raw))
    return out


def _indent_at(src: str, pos: int) -> str:
    line_start = src.rfind("\n", 0, pos) + 1
    ws = re.match(r"[ \t]*", src[line_start:pos])
    return ws.group(0) if ws else "      "


def _diff(before: str, after: str, path: str) -> str:
    return "".join(difflib.unified_diff(
        before.splitlines(keepends=True), after.splitlines(keepends=True),
        fromfile=f"a/{path}", tofile=f"b/{path}", n=3))


def apply(src: str, plan: ChangePlan, *, path: str = "file") -> ModResult:
    t = plan.target_type
    if not supports(t):
        return ModResult(ok=False, reason=(
            f"{t.value} is not something a <Helmet> block manages here."))

    proposed = (plan.proposed_value or "").strip()
    if not proposed:
        return ModResult(ok=True, changed=False, action="noop",
                         reason="No proposed value — nothing to write.")

    n_helmets = count_helmets(src)
    if n_helmets == 0:
        return ModResult(ok=False, reason=(
            "No <Helmet> block found in this file, so there is nowhere to place the tag. "
            "The metadata owner was probably resolved incorrectly."))
    if n_helmets > 1:
        return ModResult(ok=False, occurrences=n_helmets, reason=(
            f"This component renders {n_helmets} <Helmet> blocks. Which one wins depends on "
            "runtime conditions, so choosing automatically is unsafe."))

    span = find_helmet_span(src)
    if not span:
        return ModResult(ok=False, reason="<Helmet> is opened but never closed.")

    occurrences = inspect(src, t)

    if len(occurrences) > 1 and plan.action is not ChangeAction.CONSOLIDATE:
        return ModResult(ok=False, occurrences=len(occurrences),
                         candidates=[o.raw[:120] for o in occurrences],
                         reason=(f"{len(occurrences)} existing {t.value} tags inside <Helmet>. "
                                 "Consolidating is destructive, so this needs human review."))

    if occurrences:
        occ = occurrences[0]
        if occ.value is None:
            return ModResult(ok=False, occurrences=1, reason=(
                f"The existing {t.value} uses a JSX expression ({occ.raw[:60]}), so its value "
                "comes from a variable. Replacing it with a literal would drop that binding."))
        if occ.value == proposed:
            return ModResult(ok=True, changed=False, action="noop", current_value=occ.value,
                             occurrences=1, reason=f"{t.value} already matches.")
        out = src[: occ.start] + _render(t, proposed) + src[occ.end:]
        return ModResult(ok=True, content=out, changed=True, action="update",
                         current_value=occ.value, occurrences=1,
                         reason=f"Updated {t.value} inside <Helmet>.",
                         diff=_diff(src, out, path))

    _, inner_end = span
    indent = _indent_at(src, inner_end) or "      "
    out = src[:inner_end] + f"{indent}  {_render(t, proposed)}\n{indent}" + src[inner_end:]
    return ModResult(ok=True, content=out, changed=True, action="insert", current_value=None,
                     reason=f"Inserted {t.value} into <Helmet>.",
                     diff=_diff(src, out, path))
