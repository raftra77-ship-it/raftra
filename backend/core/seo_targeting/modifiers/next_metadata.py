"""Mechanism.NEXT_METADATA_EXPORT — edit `export const metadata = {...}` in place.

Next.js App Router pages declare metadata as a plain object literal, so the correct fix for
"missing meta description" is adding a `description` key to that object — NOT injecting a
<meta> tag, which Next would never render and which would be dead code in a .tsx module.

Editing JS without a JS parser is only safe if the code refuses whenever it is unsure, so
this module is deliberately conservative:

  * It brace-matches the object rather than regex-matching key/value pairs, and it tracks
    string and comment state while doing so, so a `}` inside "a } brace" or a comment does
    not terminate the object early.
  * It only edits keys it can locate at a known depth. A key whose value is a template
    literal, a function call, a spread or a variable reference is left alone and reported —
    replacing `description: getDesc()` with a string literal would silently drop behaviour.
  * A file with two `metadata` exports is refused outright.

Everything outside the replaced value survives byte-for-byte.
"""
from __future__ import annotations

import difflib
import json
import re
from typing import Optional

from ..change_plan import ChangeAction, ChangePlan, TargetType
from .base import ModResult, Occurrence

# `export const metadata = {` / `export const metadata: Metadata = {`
_EXPORT_RE = re.compile(
    r"export\s+const\s+metadata\s*(?::\s*[A-Za-z_$][\w$.<>\[\]|\s]*?)?\s*=\s*\{")
# generateMetadata() returns metadata dynamically — a different shape we do not edit.
_GENERATE_RE = re.compile(r"export\s+(?:async\s+)?function\s+generateMetadata\b")

# Which key in the metadata object each SEO property maps to. Nested paths are real Next.js
# structure (alternates.canonical, openGraph.title), not an invention.
_KEY_PATH: dict[TargetType, tuple[str, ...]] = {
    TargetType.TITLE: ("title",),
    TargetType.META_DESCRIPTION: ("description",),
    TargetType.CANONICAL: ("alternates", "canonical"),
    TargetType.ROBOTS_META: ("robots",),
    TargetType.OG_TITLE: ("openGraph", "title"),
    TargetType.OG_DESCRIPTION: ("openGraph", "description"),
    TargetType.OG_TYPE: ("openGraph", "type"),
    TargetType.TWITTER_CARD: ("twitter", "card"),
    TargetType.TWITTER_TITLE: ("twitter", "title"),
    TargetType.TWITTER_DESCRIPTION: ("twitter", "description"),
}


def supports(target_type: TargetType) -> bool:
    return target_type in _KEY_PATH


def _match_braces(src: str, open_idx: int) -> Optional[int]:
    """Index of the `}` matching the `{` at open_idx, skipping strings and comments."""
    depth = 0
    i = open_idx
    n = len(src)
    while i < n:
        c = src[i]
        if c in "\"'`":
            quote = c
            i += 1
            while i < n:
                if src[i] == "\\":
                    i += 2
                    continue
                if src[i] == quote:
                    break
                i += 1
        elif c == "/" and i + 1 < n and src[i + 1] == "/":
            i = src.find("\n", i)
            if i == -1:
                return None
        elif c == "/" and i + 1 < n and src[i + 1] == "*":
            i = src.find("*/", i)
            if i == -1:
                return None
            i += 1
        elif c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return None


def _top_level_keys(src: str, inner_start: int, inner_end: int) -> dict[str, tuple[int, int, int]]:
    """Keys directly inside an object body -> (key_start, value_start, value_end).

    value_end is exclusive and stops at the comma or closing brace that ends the value,
    computed with the same string/comment-aware scan used for braces.
    """
    out: dict[str, tuple[int, int, int]] = {}
    i = inner_start
    depth = 0
    n = inner_end
    key_re = re.compile(r"""(['"]?)([A-Za-z_$][\w$]*)\1\s*:""")
    while i < n:
        c = src[i]
        if c in "\"'`":
            quote = c
            i += 1
            while i < n:
                if src[i] == "\\":
                    i += 2
                    continue
                if src[i] == quote:
                    break
                i += 1
            i += 1
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            i = src.find("\n", i)
            if i == -1:
                break
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            i = src.find("*/", i) + 2
            continue
        if c in "{[(":
            depth += 1
            i += 1
            continue
        if c in "}])":
            depth -= 1
            i += 1
            continue
        if depth == 0:
            m = key_re.match(src, i)
            if m:
                v_start = m.end()
                while v_start < n and src[v_start] in " \t\n\r":
                    v_start += 1
                v_end = _value_end(src, v_start, n)
                out[m.group(2)] = (m.start(), v_start, v_end)
                i = v_end
                continue
        i += 1
    return out


def _value_end(src: str, start: int, limit: int) -> int:
    i = start
    depth = 0
    while i < limit:
        c = src[i]
        if c in "\"'`":
            quote = c
            i += 1
            while i < limit:
                if src[i] == "\\":
                    i += 2
                    continue
                if src[i] == quote:
                    break
                i += 1
            i += 1
            continue
        if c in "{[(":
            depth += 1
        elif c in "}])":
            if depth == 0:
                return i
            depth -= 1
        elif c == "," and depth == 0:
            return i
        i += 1
    return limit


_STRING_LITERAL_RE = re.compile(r"""^(['"])(.*)\1$""", re.DOTALL)


def _literal_value(raw: str) -> Optional[str]:
    """The string a value expression represents, or None when it is not a plain literal."""
    m = _STRING_LITERAL_RE.match(raw.strip())
    if not m:
        return None
    return m.group(2).encode().decode("unicode_escape") if "\\" in m.group(2) else m.group(2)


def _js_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def _indent_of(src: str, pos: int) -> str:
    line_start = src.rfind("\n", 0, pos) + 1
    ws = re.match(r"[ \t]*", src[line_start:pos])
    return ws.group(0) if ws else "  "


def _diff(before: str, after: str, path: str) -> str:
    return "".join(difflib.unified_diff(
        before.splitlines(keepends=True), after.splitlines(keepends=True),
        fromfile=f"a/{path}", tofile=f"b/{path}", n=3))


def _find_metadata_object(src: str) -> tuple[int, int, int]:
    """(export_start, inner_start, inner_end) of the metadata object literal."""
    matches = list(_EXPORT_RE.finditer(src))
    if len(matches) > 1:
        raise ValueError("This file declares `metadata` more than once — refusing to guess "
                         "which one controls the page.")
    if not matches:
        raise LookupError("no metadata export")
    m = matches[0]
    open_idx = m.end() - 1
    close_idx = _match_braces(src, open_idx)
    if close_idx is None:
        raise ValueError("The `metadata` object literal is not closed — the file may be "
                         "malformed or use syntax this editor does not understand.")
    return m.start(), open_idx + 1, close_idx


def inspect(src: str, target_type: TargetType) -> list[Occurrence]:
    """The existing value of this property inside the metadata object, if it is a literal."""
    if not supports(target_type):
        return []
    try:
        _, inner_start, inner_end = _find_metadata_object(src)
    except (LookupError, ValueError):
        return []
    path = _KEY_PATH[target_type]
    keys = _top_level_keys(src, inner_start, inner_end)
    if path[0] not in keys:
        return []
    _, v_start, v_end = keys[path[0]]
    if len(path) == 1:
        raw = src[v_start:v_end].strip()
        return [Occurrence(start=v_start, end=v_end, value=_literal_value(raw), raw=raw)]
    # Nested: descend one level into e.g. openGraph { ... }
    if src[v_start] != "{":
        return []
    nested_close = _match_braces(src, v_start)
    if nested_close is None:
        return []
    nested = _top_level_keys(src, v_start + 1, nested_close)
    if path[1] not in nested:
        return []
    _, nv_start, nv_end = nested[path[1]]
    raw = src[nv_start:nv_end].strip()
    return [Occurrence(start=nv_start, end=nv_end, value=_literal_value(raw), raw=raw)]


def apply(src: str, plan: ChangePlan, *, path: str = "file") -> ModResult:
    t = plan.target_type
    if not supports(t):
        return ModResult(ok=False, reason=(
            f"{t.value} has no place in a Next.js metadata object — it is not part of the "
            "Metadata API surface."))

    proposed = (plan.proposed_value or "").strip()
    if not proposed:
        return ModResult(ok=True, changed=False, action="noop",
                         reason="No proposed value — nothing to write.")

    try:
        export_start, inner_start, inner_end = _find_metadata_object(src)
    except ValueError as e:
        return ModResult(ok=False, reason=str(e))
    except LookupError:
        if _GENERATE_RE.search(src):
            return ModResult(ok=False, reason=(
                "This page builds metadata in `generateMetadata()`, which is code rather "
                "than a literal. Editing it automatically could change behaviour, so it "
                "needs a human."))
        return _insert_new_export(src, plan, proposed, path)

    key_path = _KEY_PATH[t]
    occurrences = inspect(src, t)

    if occurrences:
        occ = occurrences[0]
        if occ.value is None:
            return ModResult(ok=False, current_value=None, occurrences=1, reason=(
                f"`{'.'.join(key_path)}` is set to an expression ({occ.raw[:60]}), not a "
                "string literal. Overwriting it could drop logic, so this needs a human."))
        if occ.value == proposed:
            return ModResult(ok=True, changed=False, action="noop", current_value=occ.value,
                             occurrences=1,
                             reason=f"`{'.'.join(key_path)}` already matches the proposed value.")
        if plan.action is ChangeAction.NOOP:
            return ModResult(ok=True, changed=False, action="noop", current_value=occ.value)
        out = src[: occ.start] + _js_string(proposed) + src[occ.end:]
        return ModResult(ok=True, content=out, changed=True, action="update",
                         current_value=occ.value, occurrences=1,
                         reason=f"Updated `{'.'.join(key_path)}` in the metadata export.",
                         diff=_diff(src, out, path))

    # Key absent — insert it, creating the parent object when the path is nested.
    keys = _top_level_keys(src, inner_start, inner_end)
    if len(key_path) == 1:
        out = _insert_key(src, inner_start, inner_end, key_path[0], _js_string(proposed))
        return ModResult(ok=True, content=out, changed=True, action="insert",
                         current_value=None,
                         reason=f"Added `{key_path[0]}` to the metadata export.",
                         diff=_diff(src, out, path))

    parent, child = key_path
    if parent in keys:
        _, v_start, _ = keys[parent]
        if src[v_start] != "{":
            return ModResult(ok=False, reason=(
                f"`{parent}` is not an object literal, so `{child}` cannot be added to it "
                "safely."))
        nested_close = _match_braces(src, v_start)
        if nested_close is None:
            return ModResult(ok=False, reason=f"`{parent}` object is not closed.")
        out = _insert_key(src, v_start + 1, nested_close, child, _js_string(proposed))
    else:
        block = "{ " + f"{child}: {_js_string(proposed)}" + " }"
        out = _insert_key(src, inner_start, inner_end, parent, block)
    return ModResult(ok=True, content=out, changed=True, action="insert", current_value=None,
                     reason=f"Added `{'.'.join(key_path)}` to the metadata export.",
                     diff=_diff(src, out, path))


def _insert_key(src: str, inner_start: int, inner_end: int, key: str, value_src: str) -> str:
    """Append `key: value` as the last entry of an object body, matching its indentation."""
    body = src[inner_start:inner_end]
    indent = _indent_of(src, inner_end)
    entry_indent = indent + "  " if "\n" in body else " "

    stripped = body.rstrip()
    trailing = body[len(stripped):]
    needs_comma = bool(stripped.strip()) and not stripped.rstrip().endswith(",")

    if "\n" in body:
        new_body = stripped + ("," if needs_comma else "") + f"\n{entry_indent}{key}: {value_src},"
        new_body += trailing if trailing.strip("\n\r\t ") == "" and "\n" in trailing else f"\n{indent}"
    else:
        new_body = stripped + ("," if needs_comma else "") + f" {key}: {value_src} "
    return src[:inner_start] + new_body + src[inner_end:]


def _insert_new_export(src: str, plan: ChangePlan, proposed: str, path: str) -> ModResult:
    """No metadata export at all — create one below the imports.

    Placed after the final top-level import so it never lands inside a component body, and
    only when the file has no `metadata` identifier already (a local variable of that name
    would collide with the export).
    """
    if re.search(r"\bmetadata\b", src):
        return ModResult(ok=False, reason=(
            "This file already uses the name `metadata` but does not export it as a Next.js "
            "metadata object. Adding an export could collide, so this needs a human."))

    key_path = _KEY_PATH[plan.target_type]
    if len(key_path) == 1:
        body = f"  {key_path[0]}: {_js_string(proposed)},"
    else:
        body = f"  {key_path[0]}: {{ {key_path[1]}: {_js_string(proposed)} }},"
    block = "export const metadata = {\n" + body + "\n};\n"

    imports = list(re.finditer(r"^\s*import\s.+?$", src, re.MULTILINE))
    if imports:
        at = imports[-1].end()
        out = src[:at] + "\n\n" + block.rstrip("\n") + src[at:]
    else:
        out = block + "\n" + src
    return ModResult(ok=True, content=out, changed=True, action="insert", current_value=None,
                     reason="Created a `metadata` export (the file had none).",
                     diff=_diff(src, out, path))
