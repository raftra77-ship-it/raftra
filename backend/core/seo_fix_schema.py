"""The single, platform-independent SEO fix payload.

Generated ONCE per apply-fixes request, from whichever Metadata / Structured Data
recommendations the user has actually approved (or edited) for that audit. Every platform
adapter (core/seo_adapters.py) consumes this exact same object and only translates it into
that platform's own write calls — no adapter ever calls an LLM or invents a value.

The LLM's role is intentionally narrow: it only ever fills `title` / `meta_description`
text. Everything else here is derived deterministically:
  - canonical: the audit's own target_url (a self-referencing canonical, never guessed)
  - open_graph / twitter: reuse the same generated title/description, never separately
    invented copy
  - schema_jsonld: built by core/seo_jsonld.py straight from the workspace's real
    name/url/logo — no LLM involved at all
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


class OpenGraphFix(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: str = "website"


class TwitterCardFix(BaseModel):
    card: str = "summary_large_image"
    title: Optional[str] = None
    description: Optional[str] = None


class UniversalSeoFix(BaseModel):
    title: Optional[str] = None
    meta_description: Optional[str] = None
    canonical: Optional[str] = None
    open_graph: Optional[OpenGraphFix] = None
    twitter: Optional[TwitterCardFix] = None
    schema_jsonld: Optional[dict] = None
    # Which approved recommendation strings this object actually covers — carried through
    # so callers can report exactly what was applied (PR body, success message, etc.).
    applied_fixes: list[str] = []

    def is_empty(self) -> bool:
        return not any([self.title, self.meta_description, self.canonical,
                        self.open_graph, self.twitter, self.schema_jsonld])


async def generate_universal_seo_fix(*, current_title: str, target_url: str, brand_context: str,
                                      workspace_name: Optional[str], workspace_url: Optional[str],
                                      workspace_logo: Optional[str],
                                      approved_fixes: list[str]) -> UniversalSeoFix:
    """Build the universal fix from a list of already-approved recommendation strings
    (e.g. "Metadata: Add a self-referencing canonical tag."). Each field is only populated
    if a matching recommendation was actually approved — never applies more than the user
    approved."""
    text = " ".join(approved_fixes).lower()
    wants_title = "title" in text
    wants_description = "meta description" in text
    wants_canonical = "canonical" in text
    wants_og = "open graph" in text
    wants_schema = "json-ld" in text or "schema" in text

    fix = UniversalSeoFix(applied_fixes=list(approved_fixes))

    if wants_title or wants_description:
        import json as _json
        import re as _re
        from core.providers.llm_providers import GeminiProvider
        system = ("You write concise, compelling on-page SEO metadata. Return ONLY a JSON "
                  'object: {"title": "<=60 characters", "meta_description": "120-155 characters"}. '
                  "No prose, no markdown fences.")
        prompt = (f"Brand / page context:\n{brand_context}\n\nCurrent page title: {current_title}\n\n"
                  "Approved fixes to address:\n" + "\n".join(f"- {f}" for f in approved_fixes) +
                  "\n\nWrite the title and meta description as JSON.")
        out = (await GeminiProvider().generate_text(prompt=prompt, system_prompt=system)).strip()
        out = _re.sub(r"^```[a-zA-Z0-9]*\n", "", out)
        out = _re.sub(r"\n```\s*$", "", out)
        try:
            d = _json.loads(out)
        except Exception:
            d = {}
        if wants_title:
            fix.title = (d.get("title") or "").strip()[:60] or None
        if wants_description:
            fix.meta_description = (d.get("meta_description") or "").strip()[:160] or None

    if wants_canonical and target_url:
        fix.canonical = target_url

    if wants_og and (fix.title or fix.meta_description):
        fix.open_graph = OpenGraphFix(title=fix.title, description=fix.meta_description)
        fix.twitter = TwitterCardFix(title=fix.title, description=fix.meta_description)

    if wants_schema and workspace_name and workspace_url:
        import json as _json
        from core.seo_jsonld import build_organization_jsonld
        fix.schema_jsonld = _json.loads(build_organization_jsonld(workspace_name, workspace_url, workspace_logo))

    return fix
