"""Guards the crawl -> synthesis -> extraction character budgets.

These three limits live in two modules and are easy to change independently. When they
drift out of order the failure is silent and expensive: the crawler pays to fetch pages
that are then truncated away before the model ever reads them, and the brand kit comes back
thin for no visible reason. That is exactly what was happening at 5 pages x 3000 chars fed
through an 8000-character cap.

Run: python -m pytest test_extraction_budgets.py
"""
from agents.creative_nodes.onboarding_graph import (
    _MAX_KB_PAGES, _PER_PAGE_CHARS, _SYNTHESIS_CHARS, _extract_internal_links,
    _looks_like_error_page, _score_link,
)
from core.brand_kit import _EXTRACTION_CHARS


def test_synthesis_holds_the_whole_crawl():
    """Nothing the crawler fetched may be dropped before synthesis."""
    assert _SYNTHESIS_CHARS >= _MAX_KB_PAGES * _PER_PAGE_CHARS


def test_extractor_holds_the_whole_synthesis():
    """...nor between synthesis and the extraction prompt."""
    assert _EXTRACTION_CHARS >= _SYNTHESIS_CHARS


def test_brand_pages_outrank_boilerplate():
    """The page budget must go to pages that describe the brand.

    Boilerplate is listed first here on purpose: that is the order a real site's header
    links it, and taking links in document order is what this ranking replaced.
    """
    html = """
    <a href="/login">Login</a><a href="/cart">Cart</a>
    <a href="/privacy-policy">Privacy</a><a href="/terms">Terms</a>
    <a href="/about-us">About</a><a href="/products">Products</a>
    <a href="/pricing">Pricing</a>
    """
    picked = _extract_internal_links(html, "https://example.com", 3)
    assert picked == [
        "https://example.com/about-us",
        "https://example.com/products",
        "https://example.com/pricing",
    ]


def test_boilerplate_scores_below_content():
    assert _score_link("https://x.com/about-us") > _score_link("https://x.com/privacy-policy")
    assert _score_link("https://x.com/products") > _score_link("https://x.com/login")


def test_every_guidelines_section_has_a_producer():
    """Each section the Brand Guidelines screen renders must have something that writes it.

    'Visual Design & Brand Identity' was rendered for every brand and written by nothing,
    so it was permanently blank; business_model was the mirror image, extracted and stored
    but never displayed. Both are silent failures - the screen looks fine, it is just
    empty - so the mapping is pinned here.
    """
    from core.brand_kit import BrandKit, kit_to_guidelines

    # A kit with every field populated: whatever the UI renders must appear in the output.
    kit = BrandKit(
        overview="o", mission="m", positioning="p", business_model="b",
        visual_identity="v", product_categories=["c"], usps=["u"], benefits=["f"],
        personality=["pe"], tone_of_voice=["t"], key_messages=["k"],
    )
    produced = set(kit_to_guidelines(kit))

    # Mirrors SECTION_TITLES in BrandKnowledgeBase.tsx.
    rendered = {"overview", "usps", "features", "slogan", "personality", "visual",
                "competitive", "business_model", "tone"}
    assert rendered <= produced, f"sections with no producer: {sorted(rendered - produced)}"


def test_error_pages_are_not_brand_content():
    """Firecrawl returns HTTP 200 for a scrape that fetched a 404, so the body of an error
    page could be stored and synthesised as if it described the brand."""
    assert _looks_like_error_page("Not Found")
    assert _looks_like_error_page("404 - the page you requested does not exist. Go home.")
    assert _looks_like_error_page("Internal Server Error")


def test_real_pages_are_not_mistaken_for_errors():
    """The check only judges short bodies, so genuine copy survives even when it uses the
    same words."""
    assert not _looks_like_error_page(
        "About us. " + ("We build tools for growth teams. " * 40) + "404 errors are handled."
    )
    assert not _looks_like_error_page("Our premium footwear collection for every occasion.")
