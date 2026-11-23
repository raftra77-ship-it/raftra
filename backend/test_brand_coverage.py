"""Brand-extraction coverage: does the system know what it actually obtained?

The defect these tests pin down was not a crash. Onboarding set `is_onboarded = True` at
the end of the pipeline unconditionally and recorded the agent task as
COMPLETED - "Brand profile & knowledge base built" - whatever the crawl returned. Measured
on production across nine workspaces:

  * six held no logo, no palette and no typography, and every one was flagged onboarded;
  * two of those (one a real, reachable site) had crawled ZERO pages and still reported
    a completed run;
  * the only field populated on every workspace was `brand_voice` - the one the model
    synthesises rather than extracts.

So the system could not tell a brand it had read from a brand it had invented, and neither
could the user. `coverage()` is the answer to "what do we actually hold", kept pure so it
can be asserted on without a database, and `extraction_status()` turns it into the one word
the agent log and the API report.
"""
import pytest

from core.brand_kit import (COVERAGE_FIELDS, COVERAGE_USABLE_MIN, coverage,
                            extraction_status)

FULL = dict(
    logos=[{"url": "https://x/logo.svg"}],
    color_tokens=[{"name": "Primary", "hex": "#111111"}],
    typography={"heading": "Inter"},
    brand_voice="Confident, direct",
    target_audience="Runners in metros",
    guidelines={"usps": ["Cushioning"]},
)


def test_a_full_kit_scores_every_dimension():
    cov = coverage(**FULL)
    assert cov["score"] == cov["total"] == len(COVERAGE_FIELDS)
    assert cov["missing"] == []
    assert cov["usable"] is True
    assert extraction_status(cov, source_pages=12) == "complete"


def test_the_production_failure_mode_voice_only_is_not_usable():
    """Six of nine production workspaces looked exactly like this and were reported as
    successfully onboarded."""
    cov = coverage(logos=[], color_palette=[], color_tokens=None, typography={},
                   brand_voice="Confident, direct", target_audience="", guidelines={})
    assert cov["score"] == 1
    assert cov["usable"] is False
    assert set(cov["missing"]) == {"logo", "colors", "typography", "audience", "guidelines"}


def test_zero_pages_is_unreachable_not_merely_empty():
    """A site we could not read is a different problem, with a different fix, from a site
    we read and learned nothing from. Workspaces 18 and 19 were the first kind and were
    reported as the success case."""
    cov = coverage(brand_voice="Bold")
    assert extraction_status(cov, source_pages=0) == "unreachable"
    assert extraction_status(cov, source_pages=3) == "empty"


def test_a_partial_kit_is_reported_as_partial():
    """Workspace 4 - a real crawl of a real site that found everything except a logo."""
    cov = coverage(**{**FULL, "logos": []})
    assert cov["missing"] == ["logo"]
    assert cov["usable"] is True
    assert extraction_status(cov, source_pages=1) == "partial"


@pytest.mark.parametrize("empty", [None, "", "   ", [], {}, "null", "[]", "{}"])
def test_the_shapes_an_empty_json_column_actually_takes(empty):
    """These are not hypothetical: the JSON columns in this table have held every one of
    them, depending on which writer last touched the row."""
    cov = coverage(logos=empty, color_palette=empty, color_tokens=empty,
                   typography=empty, brand_voice=empty, target_audience=empty,
                   guidelines=empty if isinstance(empty, dict) else {})
    assert cov["score"] == 0
    assert cov["usable"] is False


def test_either_colour_shape_counts():
    """color_tokens is the richer shape and color_palette the older flat list. A workspace
    holding only the old one still has colours and must not be told to go and add some."""
    old_shape = coverage(color_palette=["#111111", "#eeeeee"])
    assert old_shape["fields"]["colors"] is True


def test_guidelines_tone_satisfies_voice_when_the_workspace_column_is_empty():
    """Voice is stored in two places depending on the pipeline version that wrote it."""
    cov = coverage(brand_voice=None, guidelines={"tone": "Warm, plain-spoken"})
    assert cov["fields"]["voice"] is True


def test_not_available_is_absence_not_content():
    """The extractor writes a sentinel sentence when a source says nothing. Counting it as
    a filled field is how a kit of placeholders would report as complete."""
    from core.brand_kit import NOT_AVAILABLE
    cov = coverage(brand_voice=NOT_AVAILABLE, target_audience=NOT_AVAILABLE)
    assert cov["fields"]["voice"] is False
    assert cov["fields"]["audience"] is False


def test_the_usable_threshold_is_the_documented_one():
    """Guards the constant itself: a kit at the bar must pass and one below it must fail,
    so the threshold cannot drift without this failing."""
    at_bar = coverage(brand_voice="Bold", target_audience="Runners",
                      guidelines={"usps": ["x"]})
    assert at_bar["score"] == COVERAGE_USABLE_MIN
    assert at_bar["usable"] is True

    below = coverage(brand_voice="Bold", target_audience="Runners")
    assert below["score"] == COVERAGE_USABLE_MIN - 1
    assert below["usable"] is False


# ---------------------------------------------------------------- the entry-point guard

@pytest.mark.parametrize("url", ["https://hdh", "https://bdh", "https://12345678"])
def test_the_three_hosts_that_became_unusable_production_workspaces(url):
    from core.brand_kit import is_crawlable_host
    assert is_crawlable_host(url) is False


@pytest.mark.parametrize("url", ["https://nike.in", "https://dsahelper.onrender.com",
                                 "https://www.rasova.com", "https://sub.domain.co.uk/p?x=1"])
def test_every_real_production_url_still_passes(url):
    """The guard must not cost anyone a workspace they could legitimately have had."""
    from core.brand_kit import is_crawlable_host
    assert is_crawlable_host(url) is True


@pytest.mark.parametrize("url", ["http://localhost:3000", "https://127.0.0.1",
                                 "https://192.168.1.1", ""])
def test_loopback_and_ip_literals_are_not_brand_sites(url):
    from core.brand_kit import is_crawlable_host
    assert is_crawlable_host(url) is False
