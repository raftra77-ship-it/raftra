"""Relationships between the things Brand Knowledge already extracts.

Extraction produces good records - personas, product categories, differentiators - but they
sit side by side with nothing joining them, and the joins it does attempt are free text that
does not match. Observed on live data:

    persona "Pre-Game Athlete"   categories ['Nike 24.7', 'Training & Gym']
    catalogue                    'Pre-Game & Performance Apparel (Nike 24.7)'

Same thing, never connected. And on a workspace whose personas came back with no categories
at all, the link is still recoverable from the USP audience text ("Beginner coders,
students" against the persona "Aspiring Software Developers / Beginners").

So an agent asked "what should we promote to runners, and what should we say" had the
answer sitting in the vault in three pieces and no way to assemble it. This module does the
assembly. It is pure resolution over stored records - no model call, no new storage, nothing
to re-extract - so it works on every brand already in the database.

Matching is token overlap with a floor, not exact string equality: extraction writes the
same idea two ways, and requiring equality is what made the existing category lists dead
weight. The floor is deliberately not low - a wrong link is worse than a missing one here,
because it would put the wrong product in front of the wrong audience.
"""
import re
from typing import List

# Words that carry no distinguishing meaning for a brand's own vocabulary, so matching on
# them would link almost everything to everything.
_STOP = {
    "and", "or", "the", "a", "an", "of", "for", "with", "to", "in", "on", "at", "by",
    "all", "new", "our", "your", "their", "who", "that", "this", "those", "these",
    "collection", "collections", "products", "product", "range", "seeking", "looking",
    "individuals", "people", "users", "customers", "those", "other", "others", "more",
}


def _stem(word: str) -> str:
    """Crudest possible stem, enough to make a plural match its singular.

    Extraction writes "Pre-Game Athlete" as a persona and "Athletes and active fitness
    enthusiasts" as the audience of the differentiator meant for them. Exact tokens never
    matched those, so the single most useful link in the graph - which product story to lead
    with for a segment - came back empty on real data.
    """
    for suffix in ("ies", "es", "s"):
        if len(word) > 4 and word.endswith(suffix):
            return word[: -len(suffix)] + ("y" if suffix == "ies" else "")
    return word


def _tokens(text) -> set:
    """Meaningful lowercase stems from any stored value (string or list)."""
    if isinstance(text, (list, tuple)):
        text = " ".join(str(t) for t in text)
    words = re.split(r"[^a-z0-9]+", str(text or "").lower())
    return {_stem(w) for w in words if len(w) > 2 and w not in _STOP}


def _overlap(a: set, b: set) -> float:
    """Share of the SMALLER set that both have in common.

    Deliberately not Jaccard: "Running" against "Running & Trail Footwear" is a real match
    even though one side is far longer, and Jaccard would score that low enough to discard.
    """
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


# A single shared token out of a two-token phrase is 0.5, which is the weakest link worth
# keeping. Below that the matches observed were coincidental ("performance" appearing in
# both an apparel category and a running persona).
_MIN_MATCH = 0.5

# Differentiator audiences are prose, not labels: "Athletes and active fitness enthusiasts"
# against the persona "Pre-Game Athlete" shares exactly one meaningful stem out of four, and
# that is a genuine match rather than a coincidence - the descriptive words around the noun
# dilute the score without adding ambiguity. A lower floor here recovers the single most
# useful edge in the graph (which product story to lead with for a segment), and the risk is
# bounded because unrelated audiences share no stems at all: the same persona scores 0.0
# against "Mobile app e-commerce shoppers in India".
_MIN_AUDIENCE_MATCH = 0.25


def build_graph(facts: dict) -> dict:
    """Resolve persona <-> category <-> product/technology <-> differentiator links.

    `facts` is core.rag.brand_facts output. Returns plain dicts so this can be serialised,
    logged, or handed to a prompt without any further conversion.
    """
    catalogue = facts.get("catalogue") or []
    usps = facts.get("structured_usps") or []
    personas = facts.get("target_audiences") or []
    jobs = facts.get("jobs_to_be_done") or []

    cat_tokens = [(c, _tokens(c.get("name"))) for c in catalogue]
    usp_tokens = [(u, _tokens(u.get("audience"))) for u in usps]

    out: List[dict] = []
    for p in personas:
        # Everything the persona says about itself, in one bag: its name, its stated need,
        # and any categories extraction did manage to attach.
        hints = _tokens(p.get("persona")) | _tokens(p.get("categories")) | _tokens(p.get("need"))

        matched_cats = []
        for cat, ctoks in cat_tokens:
            score = _overlap(hints, ctoks)
            if score >= _MIN_MATCH:
                matched_cats.append((score, cat))
        matched_cats.sort(key=lambda s: -s[0])

        # A single-category brand has nothing to disambiguate.
        #
        # On a site with one catalogue entry ("DSA Topic Modules") every persona wants that
        # entry by definition, yet token overlap scored it 0.33 and dropped it - leaving
        # every persona with no products at all, which is plainly wrong rather than merely
        # cautious. With one or two categories there is no wrong answer to pick, so the
        # cautious rule stops applying.
        if not matched_cats and len(catalogue) <= 2:
            matched_cats = [(0.0, c) for c in catalogue]

        matched_usps = []
        for usp, utoks in usp_tokens:
            score = _overlap(hints, utoks)
            if score >= _MIN_AUDIENCE_MATCH:
                matched_usps.append((score, usp))
        matched_usps.sort(key=lambda s: -s[0])

        products, technologies = [], []
        for _, cat in matched_cats:
            products.extend(str(x) for x in (cat.get("products") or []))
            technologies.extend(str(x) for x in (cat.get("technologies") or []))

        matched_jobs = [j for j in jobs
                        if _overlap(hints, _tokens(j.get("situation")) | _tokens(j.get("problem")))
                        >= _MIN_MATCH]

        out.append({
            "persona": p.get("persona", ""),
            "need": p.get("need", ""),
            "objections": p.get("objections") or [],
            "messaging_angle": p.get("messaging_angle", ""),
            "hook": p.get("hook", ""),
            "categories": [c.get("name") for _, c in matched_cats],
            "products": list(dict.fromkeys(products))[:12],
            "technologies": list(dict.fromkeys(technologies))[:8],
            "differentiators": [
                {"name": u.get("name"), "benefit": u.get("benefit"),
                 "angle": u.get("messaging_angle"),
                 "source": (u.get("evidence") or {}).get("source_url", "")}
                for _, u in matched_usps
            ],
            "jobs": [{"problem": j.get("problem"), "answer": j.get("brand_response")}
                     for j in matched_jobs],
        })

    # Categories no persona claimed, and personas nothing was found for. Both are useful
    # signals about the knowledge itself rather than the brand: they say where extraction
    # is thin, which is exactly what a quality report should surface.
    claimed = {c for row in out for c in row["categories"]}
    return {
        "personas": out,
        "unmatched_categories": [c.get("name") for c in catalogue if c.get("name") not in claimed],
        "personas_without_products": [r["persona"] for r in out if not r["products"]],
    }


def format_graph(graph: dict) -> str:
    """The graph as prompt text, so agents can read the relationships directly."""
    rows = graph.get("personas") or []
    if not rows:
        return ""
    lines = ["AUDIENCE -> OFFER MAP (who to sell what to, and how to say it):"]
    for r in rows:
        if not (r["products"] or r["differentiators"] or r["categories"]):
            continue
        bits = [f"- {r['persona']}"]
        if r["need"]:
            bits.append(f"needs: {r['need']}")
        if r["categories"]:
            bits.append("categories: " + ", ".join(r["categories"][:4]))
        if r["products"]:
            bits.append("promote: " + ", ".join(r["products"][:6]))
        if r["technologies"]:
            bits.append("proof: " + ", ".join(r["technologies"][:4]))
        if r["differentiators"]:
            bits.append("lead with: " + "; ".join(
                d["name"] for d in r["differentiators"][:3] if d.get("name")))
        if r["messaging_angle"]:
            bits.append(f"angle: {r['messaging_angle']}")
        if r["objections"]:
            bits.append("objections to answer: " + "; ".join(str(o) for o in r["objections"][:3]))
        lines.append(" | ".join(bits))
    return "\n".join(lines) if len(lines) > 1 else ""
