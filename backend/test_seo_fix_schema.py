"""Tests for the Structured Data schema-type fix in core/seo_fix_schema.py + core/seo_jsonld.py.

Run with: pytest test_seo_fix_schema.py -v

These tests deliberately avoid any recommendation text containing "title" or "meta
description" so generate_universal_seo_fix() never takes its LLM branch — schema
generation itself is 100% deterministic, so it can be tested without mocking Gemini.
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from core.seo_fix_schema import generate_universal_seo_fix  # noqa: E402


def run(coro):
    return asyncio.run(coro)


WORKSPACE = dict(workspace_name="DSA Helper", workspace_url="https://dsahelper.onrender.com/",
                 workspace_logo=None, target_url="https://dsahelper.onrender.com/",
                 current_title="DSA Helper", brand_context="Coding practice platform.")


def test_organization_schema_generated_when_approved():
    fix = run(generate_universal_seo_fix(
        **WORKSPACE,
        approved_fixes=["Structured Data: Add JSON-LD structured data (start with Organization)."],
    ))
    assert fix.schema_jsonld is not None
    assert fix.schema_jsonld["@type"] == "Organization"
    assert fix.schema_jsonld["name"] == "DSA Helper"
    assert fix.schema_jsonld["url"] == "https://dsahelper.onrender.com/"
    assert fix.schema_note is None


def test_organization_schema_missing_workspace_data_reports_note_not_fabrication():
    fix = run(generate_universal_seo_fix(
        **{**WORKSPACE, "workspace_name": None, "workspace_url": None},
        approved_fixes=["Structured Data: Add Organization schema (name, url, logo, sameAs)."],
    ))
    assert fix.schema_jsonld is None
    assert fix.schema_note is not None
    assert "workspace" in fix.schema_note.lower()


def test_faqpage_schema_generated_from_real_page_content():
    html = """
    <html><body>
      <h2>What is DSA Helper?</h2>
      <p>DSA Helper is a platform for practicing data structures and algorithms.</p>
      <h2>How do I get started?</h2>
      <p>Sign up and pick a topic from the dashboard.</p>
    </body></html>
    """
    fix = run(generate_universal_seo_fix(
        **WORKSPACE,
        approved_fixes=["Structured Data: Add sameAs profile links and FAQPage schema to disambiguate the entity."],
        page_content=html,
    ))
    assert fix.schema_jsonld is not None
    assert fix.schema_jsonld["@type"] == "FAQPage"
    questions = [q["name"] for q in fix.schema_jsonld["mainEntity"]]
    assert "What is DSA Helper?" in questions
    assert "How do I get started?" in questions
    # Real extracted answer, not invented.
    first = fix.schema_jsonld["mainEntity"][0]["acceptedAnswer"]["text"]
    assert "practicing data structures" in first


def test_faqpage_schema_not_fabricated_when_no_faq_content_exists():
    html = "<html><body><h2>Pricing</h2><p>See our plans below.</p></body></html>"
    fix = run(generate_universal_seo_fix(
        **WORKSPACE,
        approved_fixes=["Structured Data: Add sameAs profile links and FAQPage schema to disambiguate the entity."],
        page_content=html,
    ))
    assert fix.schema_jsonld is None
    assert fix.schema_note is not None
    assert "no real question/answer content" in fix.schema_note.lower() or "faq" in fix.schema_note.lower()


def test_faqpage_schema_none_when_no_page_content_available():
    # e.g. Shopify's site-wide theme flow, which has no single page's content.
    fix = run(generate_universal_seo_fix(
        **WORKSPACE,
        approved_fixes=["Structured Data: Add sameAs profile links and FAQPage schema to disambiguate the entity."],
        page_content=None,
    ))
    assert fix.schema_jsonld is None
    assert fix.schema_note is not None


def test_product_schema_has_no_invented_price():
    fix = run(generate_universal_seo_fix(
        **WORKSPACE,
        approved_fixes=["Structured Knowledge: Describe your offering with Product or SoftwareApplication schema."],
    ))
    assert fix.schema_jsonld is not None
    assert set(fix.schema_jsonld["@type"]) == {"Product", "SoftwareApplication"}
    assert "offers" not in fix.schema_jsonld
    assert "price" not in fix.schema_jsonld
    assert fix.schema_note is not None and "price" in fix.schema_note.lower()


def test_softwareapplication_schema_explicit_type():
    fix = run(generate_universal_seo_fix(
        **WORKSPACE,
        approved_fixes=["Structured Data: Add a SoftwareApplication schema for this tool."],
    ))
    assert fix.schema_jsonld is not None
    assert fix.schema_jsonld["@type"] == "SoftwareApplication"
    assert "applicationCategory" not in fix.schema_jsonld
    assert "offers" not in fix.schema_jsonld


def test_article_schema_has_no_invented_author_or_date():
    fix = run(generate_universal_seo_fix(
        **WORKSPACE,
        approved_fixes=["Structured Data: Add Article schema for this blog post."],
    ))
    assert fix.schema_jsonld is not None
    assert fix.schema_jsonld["@type"] == "Article"
    assert fix.schema_jsonld["headline"] == "DSA Helper"  # real current_title, not invented
    assert "author" not in fix.schema_jsonld
    assert "datePublished" not in fix.schema_jsonld
    assert "image" not in fix.schema_jsonld
    assert fix.schema_note is not None and "author" in fix.schema_note.lower()


def test_article_schema_reports_insufficient_data_when_no_title():
    fix = run(generate_universal_seo_fix(
        **{**WORKSPACE, "current_title": ""},
        approved_fixes=["Structured Data: Add Article schema for this blog post."],
    ))
    assert fix.schema_jsonld is None
    assert fix.schema_note is not None and "headline" in fix.schema_note.lower()


def test_schema_not_generated_when_not_approved():
    """The core regression this whole fix is for: only APPROVED Structured Data
    recommendations should trigger schema generation — approving something else (e.g. a
    Metadata fix) must not also produce a schema."""
    fix = run(generate_universal_seo_fix(
        **WORKSPACE,
        approved_fixes=["Metadata: Add a self-referencing canonical tag."],
    ))
    assert fix.schema_jsonld is None
    assert fix.schema_note is None
    assert fix.canonical == WORKSPACE["target_url"]  # the approved fix WAS applied — just not schema


def test_schema_generation_ignores_unapproved_recommendations():
    """Simulates the real bug scenario: the audit lists a FAQPage-worthy recommendation,
    but only the generic JSON-LD one was actually approved. Only Organization should be
    produced — approving one Structured Data item must not pull in a different item's type."""
    fix = run(generate_universal_seo_fix(
        **WORKSPACE,
        approved_fixes=["Structured Data: Add JSON-LD structured data (start with Organization)."],
        page_content="<html><body><h2>What is this?</h2><p>An FAQ answer.</p></body></html>",
    ))
    assert fix.schema_jsonld["@type"] == "Organization"


if __name__ == "__main__":
    tests = [v for k, v in list(globals().items()) if k.startswith("test_")]
    passed = failed = 0
    for t in tests:
        try:
            t()
            print(f"PASS  {t.__name__}")
            passed += 1
        except AssertionError as e:
            print(f"FAIL  {t.__name__}: {e}")
            failed += 1
    print(f"\n{passed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
