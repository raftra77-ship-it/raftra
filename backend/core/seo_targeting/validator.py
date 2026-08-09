"""Pre-publish validation. A failure here blocks the write — nothing is published on the
assumption that a modifier behaved.

These checks run against the FINAL content, after every plan for a file has been applied, so
they catch interaction bugs a single modifier cannot see: two plans that each insert a valid
tag but together produce two <title> elements, or a JSX edit that balanced its own braces
while unbalancing the file.
"""
from __future__ import annotations

import json
import re

from pydantic import BaseModel, Field

from .change_plan import Mechanism


class ValidationResult(BaseModel):
    ok: bool = True
    errors: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)

    def fail(self, msg: str) -> "ValidationResult":
        self.ok = False
        self.errors.append(msg)
        return self

    def warn(self, msg: str) -> "ValidationResult":
        self.warnings.append(msg)
        return self


_TITLE_RE = re.compile(r"<title\b[^>]*>.*?</title>", re.IGNORECASE | re.DOTALL)
_DESC_RE = re.compile(r"<meta\b(?=[^>]*\bname\s*=\s*[\"']description[\"'])[^>]*>", re.IGNORECASE)
_CANON_RE = re.compile(r"<link\b(?=[^>]*\brel\s*=\s*[\"']\s*canonical\s*[\"'])[^>]*>", re.IGNORECASE)
_JSONLD_RE = re.compile(
    r"<script\b[^>]*\btype\s*=\s*[\"']application/ld\+json[\"'][^>]*>(.*?)</script>",
    re.IGNORECASE | re.DOTALL)
_HEAD_OPEN = re.compile(r"<head\b[^>]*>", re.IGNORECASE)
_HEAD_CLOSE = re.compile(r"</head\s*>", re.IGNORECASE)


def validate(content: str, mechanism: Mechanism, *, path: str = "file") -> ValidationResult:
    r = ValidationResult()
    if not content or not content.strip():
        return r.fail(f"{path}: the modified file is empty.")

    if mechanism is Mechanism.HTML_HEAD:
        _validate_html(content, path, r)
    elif mechanism in (Mechanism.NEXT_METADATA_EXPORT, Mechanism.NEXT_HEAD_COMPONENT,
                       Mechanism.REACT_HELMET):
        _validate_js(content, path, r, mechanism)
    return r


def _validate_html(content: str, path: str, r: ValidationResult) -> None:
    if not _HEAD_OPEN.search(content) or not _HEAD_CLOSE.search(content):
        r.fail(f"{path}: <head> is missing or unclosed after modification.")
        return

    head_start = _HEAD_OPEN.search(content).end()
    head_end = _HEAD_CLOSE.search(content, head_start).start()
    head = content[head_start:head_end]

    for label, rx in (("<title>", _TITLE_RE), ("meta description", _DESC_RE),
                      ("canonical link", _CANON_RE)):
        n = len(rx.findall(content))
        if n > 1:
            r.fail(f"{path}: {n} {label} elements after modification — exactly one is allowed.")

    # Head tags must actually be in <head>; a description in <body> is ignored by crawlers.
    for label, rx in (("meta description", _DESC_RE), ("canonical link", _CANON_RE)):
        for m in rx.finditer(content):
            if not (head_start <= m.start() < head_end):
                r.fail(f"{path}: a {label} was placed outside <head>.")
    if _TITLE_RE.search(content) and not _TITLE_RE.search(head):
        r.fail(f"{path}: <title> is outside <head>.")

    for m in _JSONLD_RE.finditer(content):
        try:
            json.loads(m.group(1))
        except Exception as e:
            r.fail(f"{path}: JSON-LD block is not valid JSON ({e}).")


_PAIRS = (("{", "}"), ("(", ")"), ("[", "]"))


def _validate_js(content: str, path: str, r: ValidationResult, mechanism: Mechanism) -> None:
    """Cheap structural checks. This is not a parser — it catches the damage a bad splice
    does (unbalanced delimiters, a broken Helmet element), not every syntax error."""
    stripped = _strip_js_strings_and_comments(content)
    for open_c, close_c in _PAIRS:
        if stripped.count(open_c) != stripped.count(close_c):
            r.fail(f"{path}: unbalanced '{open_c}{close_c}' after modification "
                   f"({stripped.count(open_c)} vs {stripped.count(close_c)}) — the edit would "
                   "not compile.")

    if mechanism is Mechanism.REACT_HELMET:
        opens = len(re.findall(r"<\s*Helmet(?:\s[^>]*?)?>", content))
        selfclose = len(re.findall(r"<\s*Helmet(?:\s[^>]*?)?/\s*>", content))
        closes = len(re.findall(r"<\s*/\s*Helmet\s*>", content))
        if opens - selfclose != closes:
            r.fail(f"{path}: <Helmet> elements are unbalanced after modification.")
        # A raw brace inside a JSX attribute opens an expression and breaks the build.
        for m in re.finditer(r"""\b(?:content|href)\s*=\s*"([^"]*)\"""", content):
            if "{" in m.group(1) or "}" in m.group(1):
                r.fail(f"{path}: an unescaped brace in a JSX attribute value would break the build.")

    if mechanism is Mechanism.NEXT_METADATA_EXPORT:
        if len(re.findall(r"export\s+const\s+metadata\b", content)) > 1:
            r.fail(f"{path}: more than one `metadata` export after modification.")


def _strip_js_strings_and_comments(src: str) -> str:
    """Blank out string literals and comments so delimiter counting isn't fooled by a
    '}' inside a message or a URL containing '//'."""
    out = []
    i, n = 0, len(src)
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
                    i += 1
                    break
                i += 1
            out.append('""')
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "/":
            nl = src.find("\n", i)
            i = n if nl == -1 else nl
            continue
        if c == "/" and i + 1 < n and src[i + 1] == "*":
            end = src.find("*/", i)
            i = n if end == -1 else end + 2
            continue
        out.append(c)
        i += 1
    return "".join(out)
