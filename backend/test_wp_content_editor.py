"""Tests for contextual WordPress content editing (core/wp_content_editor.py).

These cover the deterministic half — outline parsing, target location, validation and
splicing. The AI planning step is deliberately not exercised here: the whole point of the
design is that the model's output is just data, so every safety property can be tested by
feeding plans in directly.

Run: pytest test_wp_content_editor.py -v
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from core.wp_content_editor import (  # noqa: E402
    EditOperation, EditTarget, apply_operations, locate, outline, unplanned_fixes,
)

PAGE = (
    "<!-- wp:heading {\"level\":1} --><h1>DSA Mastery Hub</h1><!-- /wp:heading -->\n\n"
    "<!-- wp:paragraph --><p>Welcome to our platform for learning algorithms.</p><!-- /wp:paragraph -->\n\n"
    "<!-- wp:heading --><h2>Binary Trees</h2><!-- /wp:heading -->\n\n"
    "<!-- wp:paragraph --><p>A binary tree has at most two children per node.</p><!-- /wp:paragraph -->\n\n"
    "<!-- wp:image --><figure><img src=\"/tree.png\" alt=\"tree\"/></figure><!-- /wp:image -->\n\n"
    "<!-- wp:heading --><h2>Sorting</h2><!-- /wp:heading -->\n\n"
    "<!-- wp:paragraph --><p>Quicksort runs in n log n on average.</p><!-- /wp:paragraph -->"
)


def op(action, ident, content="", position="replace", ttype="paragraph", existing=None, fix="f"):
    return EditOperation(
        action=action, position=position, content=content, fix=fix, reason="test",
        target=EditTarget(type=ttype, identifier=ident, existing_content=existing),
    )


# ─────────────────────────────────────────────────────────────── outline / parsing

def test_outline_finds_every_top_level_node_with_block_wrappers():
    nodes = outline(PAGE)
    assert [n["tag"] for n in nodes] == ["h1", "p", "h2", "p", "figure", "h2", "p"]
    # The span must include the Gutenberg wrapper, or a replace orphans the closing comment.
    assert nodes[0]["html"].startswith("<!-- wp:heading")
    assert nodes[0]["html"].endswith("<!-- /wp:heading -->")


def test_outline_handles_plain_html_without_blocks():
    nodes = outline("<h2>Alpha</h2><p>Beta gamma.</p>")
    assert [n["tag"] for n in nodes] == ["h2", "p"]
    assert nodes[0]["html"] == "<h2>Alpha</h2>"


# ─────────────────────────────────────────────────────────────── test case 1: modify H1

def test_replace_existing_h1_in_place():
    r = apply_operations(PAGE, [op("replace", "DSA Mastery Hub", "<h1>Master Data Structures &amp; Algorithms</h1>", ttype="heading")])
    assert not r["manual_review"]
    assert "Master Data Structures &amp; Algorithms" in r["content"]
    assert "<h1>DSA Mastery Hub</h1>" not in r["content"]
    assert r["content"].count("<h1") == 1          # still exactly one H1
    assert "Quicksort runs in n log n" in r["content"]   # unrelated content untouched


def test_refuses_to_add_a_second_h1():
    r = apply_operations(PAGE, [op("insert", "Sorting", "<h1>Another Title</h1>", position="after", ttype="heading")])
    assert not r["applied"]
    assert "second H1" in r["manual_review"][0]["error"]


# ─────────────────────────────────────────────── test case 2: improve a paragraph

def test_improve_existing_paragraph_only_touches_that_paragraph():
    before = PAGE
    r = apply_operations(PAGE, [op(
        "replace", "Welcome to our platform for learning algorithms.",
        "<p>Welcome to DSA Mastery Hub, where developers practise real interview problems.</p>")])
    assert not r["manual_review"]
    assert "practise real interview problems" in r["content"]
    assert "Welcome to our platform for learning algorithms." not in r["content"]
    # everything else byte-identical
    for keep in ["<h2>Binary Trees</h2>", "<h2>Sorting</h2>", '<img src="/tree.png" alt="tree"/>',
                 "<p>Quicksort runs in n log n on average.</p>"]:
        assert keep in r["content"], keep
    assert len(r["content"]) != len(before)


# ─────────────────────────────────────────────── test case 3: add a new H2 section

def test_insert_new_section_after_the_related_heading():
    new = "<h2>Binary Search Trees</h2>\n<p>A BST keeps keys ordered for O(log n) lookup.</p>"
    r = apply_operations(PAGE, [op("insert", "A binary tree has at most two children per node.",
                                   new, position="after")])
    assert not r["manual_review"]
    c = r["content"]
    # Landed next to Binary Trees, not at the top or bottom of the page.
    assert c.index("Binary Search Trees") > c.index("Binary Trees")
    assert c.index("Binary Search Trees") < c.index("<h2>Sorting</h2>")
    assert c.strip().endswith("<!-- /wp:paragraph -->")   # page tail unchanged


# ─────────────────────────────────────────────── test case 4: add an internal link

def test_add_internal_link_rewrites_only_the_chosen_paragraph():
    r = apply_operations(PAGE, [op(
        "replace", "Quicksort runs in n log n on average.",
        '<p>Quicksort runs in n log n on average — see our <a href="/sorting">sorting guide</a>.</p>')])
    assert not r["manual_review"]
    assert '<a href="/sorting">sorting guide</a>' in r["content"]
    assert r["content"].count("<a ") == 1
    assert "A binary tree has at most two children per node." in r["content"]


# ─────────────────────────────────────────────── test case 5: replace a section

def test_replace_section_keeps_surrounding_nodes():
    r = apply_operations(PAGE, [op("replace", "Sorting", "<h2>Sorting Algorithms</h2>", ttype="heading")])
    assert not r["manual_review"]
    assert "<h2>Sorting Algorithms</h2>" in r["content"]
    assert "<h1>DSA Mastery Hub</h1>" in r["content"]
    assert '<img src="/tree.png" alt="tree"/>' in r["content"]


def test_delete_removes_only_the_target():
    r = apply_operations(PAGE, [op("delete", "Quicksort runs in n log n on average.")])
    assert not r["manual_review"]
    assert "Quicksort" not in r["content"]
    assert "<h2>Sorting</h2>" in r["content"]


# ─────────────────────────────────────────────── test case 6: multiple changes

def test_multiple_operations_all_land_correctly():
    ops = [
        op("replace", "DSA Mastery Hub", "<h1>Master DSA</h1>", ttype="heading", fix="Improve H1"),
        op("insert", "A binary tree has at most two children per node.",
           "<h2>Binary Search Trees</h2>\n<p>Ordered keys give O(log n) lookup.</p>",
           position="after", fix="Add BST section"),
        op("replace", "Quicksort runs in n log n on average.",
           '<p>Quicksort averages n log n — see our <a href="/sorting">guide</a>.</p>', fix="Add internal link"),
    ]
    r = apply_operations(PAGE, ops)
    assert not r["manual_review"]
    assert len(r["applied"]) == 3
    c = r["content"]
    assert "<h1>Master DSA</h1>" in c and "Binary Search Trees" in c and 'href="/sorting"' in c
    assert c.count("<h1") == 1
    assert '<img src="/tree.png" alt="tree"/>' in c        # untouched throughout
    # reported in document order so the preview reads top-to-bottom
    assert [a["fix"] for a in r["applied"]] == ["Improve H1", "Add BST section", "Add internal link"]


def test_two_operations_on_the_same_node_second_goes_to_manual_review():
    ops = [
        op("replace", "Sorting", "<h2>Sorting Algorithms</h2>", ttype="heading", fix="A"),
        op("replace", "Sorting", "<h2>All About Sorting</h2>", ttype="heading", fix="B"),
    ]
    r = apply_operations(PAGE, ops)
    assert len(r["applied"]) == 1
    assert len(r["manual_review"]) == 1
    assert "same part of the page" in r["manual_review"][0]["error"]


# ─────────────────────────────────────────────── test case 7: no confident target

def test_missing_target_goes_to_manual_review_not_a_guess():
    before = PAGE
    r = apply_operations(PAGE, [op("replace", "Graph Traversal Algorithms", "<h2>Graphs</h2>", ttype="heading")])
    assert r["content"] == before            # nothing written at all
    assert not r["applied"]
    assert "could not find" in r["manual_review"][0]["error"]


def test_ambiguous_target_is_refused():
    dup = "<p>Read more.</p><p>Something else.</p><p>Read more.</p>"
    r = apply_operations(dup, [op("replace", "Read more.", "<p>Read our guide.</p>")])
    assert r["content"] == dup
    assert "appears 2 times" in r["manual_review"][0]["error"]


def test_empty_content_for_replace_is_refused():
    r = apply_operations(PAGE, [op("replace", "Sorting", "", ttype="heading")])
    assert not r["applied"]
    assert "no replacement content" in r["manual_review"][0]["error"]


# ─────────────────────────────────────── test case 8: page changed after the audit

def test_stale_target_detected_when_page_changed_underneath():
    stale = op("replace", "Sorting", "<h2>Sorting Algorithms</h2>", ttype="heading",
               existing="Sorting Algorithms And Their Complexity Classes")
    r = apply_operations(PAGE, [stale])
    assert not r["applied"]
    assert "changed since" in r["manual_review"][0]["error"]


def test_matching_existing_content_passes_the_staleness_check():
    ok = op("replace", "Sorting", "<h2>Sorting Algorithms</h2>", ttype="heading", existing="Sorting")
    r = apply_operations(PAGE, [ok])
    assert not r["manual_review"]
    assert "<h2>Sorting Algorithms</h2>" in r["content"]


# ─────────────────────────────────────────────────────────── misc safety

def test_locate_prefers_exact_match_over_partial():
    nodes = outline("<h2>Trees</h2><h2>Binary Trees</h2>")
    node, err = locate(nodes, EditTarget(type="heading", identifier="Trees"))
    assert err is None and node["text"] == "Trees"


def test_unplanned_fixes_reports_what_the_model_skipped():
    ops = [op("replace", "Sorting", "<h2>X</h2>", fix="Improve the H1")]
    missing = unplanned_fixes(["Improve the H1", "Add an FAQ section"], ops)
    assert missing == ["Add an FAQ section"]


def test_applied_entries_carry_before_and_after_for_the_diff():
    r = apply_operations(PAGE, [op("replace", "Sorting", "<h2>Sorting Algorithms</h2>", ttype="heading")])
    a = r["applied"][0]
    assert "<h2>Sorting</h2>" in a["before"]
    assert a["after"] == "<h2>Sorting Algorithms</h2>"
    assert a["target_tag"] == "h2"
