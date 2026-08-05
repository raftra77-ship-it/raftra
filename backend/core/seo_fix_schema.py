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
    # Set only when a Structured Data recommendation was approved but a full, honest schema
    # couldn't be produced (missing real data) or couldn't be produced at all (e.g. FAQPage
    # requested but no real Q&A content exists on the page) — surfaced to the user instead of
    # silently shipping a fabricated or wrong-type schema.
    schema_note: Optional[str] = None
    # Which approved recommendation strings this object actually covers — carried through
    # so callers can report exactly what was applied (PR body, success message, etc.).
    applied_fixes: list[str] = []

    def is_empty(self) -> bool:
        return not any([self.title, self.meta_description, self.canonical,
                        self.open_graph, self.twitter, self.schema_jsonld])


async def generate_universal_seo_fix(*, current_title: str, target_url: str, brand_context: str,
                                      workspace_name: Optional[str], workspace_url: Optional[str],
                                      workspace_logo: Optional[str],
                                      approved_fixes: list[str],
                                      page_content: Optional[str] = None) -> UniversalSeoFix:
    """Build the universal fix from a list of already-approved recommendation strings
    (e.g. "Metadata: Add a self-referencing canonical tag."). Each field is only populated
    if a matching recommendation was actually approved — never applies more than the user
    approved.

    `page_content` is the real crawled/current HTML for the page being fixed, when the
    caller has it (GitHub's scanned file, WordPress's current page content). It's used ONLY
    to extract real FAQ question/answer text already present on the page for FAQPage schema
    — never to invent content. Pass None when no specific page applies (e.g. Shopify's
    site-wide theme fix), and page-specific schema types fall back to an explanatory note
    instead of a guess."""
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

    if wants_schema:
        _apply_schema_fix(fix, text=text, current_title=current_title, target_url=target_url,
                          workspace_name=workspace_name, workspace_url=workspace_url,
                          workspace_logo=workspace_logo, page_content=page_content)

    return fix


def _detect_schema_type(text: str, has_faq_content: bool) -> str:
    """Which @type the approved recommendation text actually asked for.

    - An explicit "Organization" mention always wins — never silently swapped for a
      content-sniffed type, since the user's approved wording was specific.
    - Exactly one other type named ("FAQPage", "Article", "Product", "SoftwareApplication")
      -> that type.
    - "Product" and "SoftwareApplication" named together (the real recommendation text
      "Describe your offering with Product or SoftwareApplication schema") -> both types.
    - Three or more type names together, or none at all, means the recommendation is
      generic (e.g. "Add schema matching the page type (FAQPage, Article, Product,
      SoftwareApplication...)" lists all four without picking one, or "Add JSON-LD - this
      is how AI engines read entity facts" names none) -> infer FAQPage only if the page
      genuinely has real FAQ content, otherwise fall back to Organization.
    """
    named = {
        "Organization": "organization" in text,
        "FAQPage": "faqpage" in text,
        "Article": "article" in text,
        "Product": "product" in text,
        "SoftwareApplication": "softwareapplication" in text,
    }
    present = [k for k, v in named.items() if v]

    if "Organization" in present:
        return "Organization"
    if len(present) == 1:
        return present[0]
    if set(present) == {"Product", "SoftwareApplication"}:
        return "Product+SoftwareApplication"
    # 0 types named, or 3+ named together (the generic "matching the page type" wording).
    return "FAQPage" if has_faq_content else "Organization"


def _apply_schema_fix(fix: UniversalSeoFix, *, text: str, current_title: str, target_url: str,
                      workspace_name: Optional[str], workspace_url: Optional[str],
                      workspace_logo: Optional[str], page_content: Optional[str]) -> None:
    """Detects which @type the approved recommendation actually asked for and builds ONLY
    that type, from real data — never Organization-by-default for a request that named a
    different type. Mutates `fix.schema_jsonld` / `fix.schema_note`."""
    import json as _json
    from core import seo_jsonld

    faq_pairs = seo_jsonld.extract_faq_pairs(page_content) if page_content else []
    target_type = _detect_schema_type(text, has_faq_content=bool(faq_pairs))
    # The real headline/name to use: prefer a title freshly generated in this same call
    # (also approved), otherwise the page's existing real title — never invented.
    real_title = (fix.title or current_title or "").strip()

    if target_type == "FAQPage":
        if faq_pairs:
            fix.schema_jsonld = _json.loads(seo_jsonld.build_faqpage_jsonld(faq_pairs))
            return
        fix.schema_note = ("FAQPage schema was requested, but no real question/answer content "
                          "was found on the page — add an actual FAQ section first, then re-run "
                          "the audit. Nothing was generated rather than inventing questions.")
        return

    if target_type == "Article":
        if not real_title:
            fix.schema_note = ("Article schema was requested, but there's no real page title to use "
                              "as the headline — approve a Title fix too, or set one manually, then retry.")
            return
        fix.schema_jsonld = _json.loads(seo_jsonld.build_article_jsonld(
            real_title, target_url, workspace_name, workspace_url))
        fix.schema_note = "Generated without author/datePublished/image — no real source for those exists yet."
        return

    if target_type == "Product+SoftwareApplication":
        if not workspace_name:
            fix.schema_note = "Product/SoftwareApplication schema requested, but no workspace name is set to use as the product name."
            return
        fix.schema_jsonld = _json.loads(seo_jsonld.build_multi_type_jsonld(
            ["Product", "SoftwareApplication"], workspace_name, target_url or workspace_url or "", fix.meta_description))
        fix.schema_note = ("Recommendation named both Product and SoftwareApplication with no way to tell "
                          "which one actually applies, so both types were included. Price/offers/"
                          "applicationCategory omitted — no real source for those exists yet.")
        return

    if target_type == "SoftwareApplication":
        if not workspace_name:
            fix.schema_note = "SoftwareApplication schema requested, but no workspace name is set to use as the name."
            return
        fix.schema_jsonld = _json.loads(seo_jsonld.build_software_application_jsonld(
            workspace_name, target_url or workspace_url or "", fix.meta_description))
        fix.schema_note = "Generated without applicationCategory/operatingSystem/offers — no real source for those exists yet."
        return

    if target_type == "Product":
        if not workspace_name:
            fix.schema_note = "Product schema requested, but no workspace name is set to use as the product name."
            return
        fix.schema_jsonld = _json.loads(seo_jsonld.build_product_jsonld(
            workspace_name, target_url or workspace_url or "", fix.meta_description))
        fix.schema_note = "Generated without price/offers/brand/sku — no real source for those exists yet."
        return

    # target_type == "Organization" — matches "Add JSON-LD structured data (start with
    # Organization)" / "Add Organization schema" exactly, and is the safe fallback for the
    # fully generic "matching the page type" recommendation when no page-specific signal
    # was found.
    if workspace_name and workspace_url:
        fix.schema_jsonld = _json.loads(seo_jsonld.build_organization_jsonld(
            workspace_name, workspace_url, workspace_logo))
    else:
        fix.schema_note = "Organization schema requested, but the workspace has no name/URL set to build it from."
