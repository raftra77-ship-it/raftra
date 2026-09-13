"""Measurable page signals for the SEO and GEO pipelines.

Everything here is computed from the crawled HTML and markdown — no LLM, no network, no
estimation — so it can be recomputed and checked by hand against the page. It exists because
several pipeline nodes were named for work they did not do: "Content Review" evaluated no
content, "Online Presence" checked no presence, "Knowledge Presence" built no knowledge graph.
These are the functions that let those nodes mean what they say.

Deliberately separate from core/seo_scoring.py. That module turns signals into a score with a
fixed category weighting; these are the raw findings, which the nodes also report on their own
(a report that says "no author byline" is useful even where the scorecard has no points for it).
"""
import json
import re
from urllib.parse import urlparse

from core.seo_scoring import _soup, _jsonld_blocks, _schema_types

# Domains whose citation genuinely carries weight for E-E-A-T, as opposed to any outbound link.
# Kept short and uncontroversial on purpose: a long, arguable list would turn a measurement
# into an opinion, and the point of this module is that every finding is checkable.
_AUTHORITATIVE = (
    ".gov", ".edu", ".ac.", "wikipedia.org", "who.int", "nih.gov", "nature.com",
    "sciencedirect.com", "ieee.org", "acm.org", "arxiv.org", "reuters.com", "bbc.co.uk",
    "iso.org", "w3.org", "rfc-editor.org", "statista.com",
)

_SOCIAL = ("linkedin.com", "twitter.com", "x.com", "github.com", "facebook.com",
           "instagram.com", "youtube.com", "crunchbase.com")


def _hrefs(soup) -> list:
    return [(a.get("href") or "").strip() for a in (soup.find_all("a") if soup else [])]


def content_signals(html: str, markdown: str) -> dict:
    """E-E-A-T and readability facts about the page body.

    "Experience, Expertise, Authoritativeness, Trust" is usually discussed as a vibe. The
    parts of it that are actually observable in a document are: who wrote this, when was it
    written or updated, what does it cite, and can a person read a sentence of it without
    running out of breath. Those are what this measures; it does not attempt to score the
    rest, and the caller reports the gaps rather than guessing at a number for them.
    """
    soup = _soup(html)
    md = markdown or ""
    out = {
        "author": None, "author_source": None,
        "published": None, "modified": None,
        "authoritative_citations": [], "outbound_domains": [],
        "avg_sentence_words": 0.0, "long_sentence_ratio": 0.0, "sentences": 0,
        "has_faq_block": False, "list_items": 0, "tables": 0,
    }

    if soup:
        # Author, in the three places a CMS actually puts it.
        for getter, label in (
            (lambda: (soup.find("meta", attrs={"name": re.compile("^author$", re.I)}) or {}).get("content"), "meta[name=author]"),
            (lambda: (soup.find("meta", attrs={"property": "article:author"}) or {}).get("content"), "article:author"),
            (lambda: (lambda t: t.get_text(strip=True) if t else None)(soup.find(attrs={"rel": "author"})), "rel=author"),
        ):
            try:
                v = getter()
            except Exception:
                v = None
            if v and str(v).strip():
                out["author"], out["author_source"] = str(v).strip()[:120], label
                break
        if not out["author"]:
            for block in _jsonld_blocks(soup):
                a = block.get("author") if isinstance(block, dict) else None
                if isinstance(a, dict) and a.get("name"):
                    out["author"], out["author_source"] = str(a["name"])[:120], "JSON-LD author"
                    break
                if isinstance(a, str) and a.strip():
                    out["author"], out["author_source"] = a.strip()[:120], "JSON-LD author"
                    break

        for key, prop in (("published", "article:published_time"), ("modified", "article:modified_time")):
            tag = soup.find("meta", attrs={"property": prop})
            if tag and tag.get("content"):
                out[key] = str(tag["content"])[:40]
        if not out["published"]:
            t = soup.find("time")
            if t and t.get("datetime"):
                out["published"] = str(t["datetime"])[:40]

        hrefs = [h for h in _hrefs(soup) if h.startswith("http")]
        domains, authoritative = set(), []
        for h in hrefs:
            host = (urlparse(h).netloc or "").lower()
            if not host:
                continue
            domains.add(host)
            if any(k in host for k in _AUTHORITATIVE) and host not in authoritative:
                authoritative.append(host)
        out["outbound_domains"] = sorted(domains)[:40]
        out["authoritative_citations"] = authoritative[:15]

        out["tables"] = len(soup.find_all("table"))
        out["list_items"] = len(soup.find_all("li"))
        text_low = soup.get_text(" ", strip=True).lower()
        out["has_faq_block"] = ("faq" in text_low or "frequently asked" in text_low
                                or "FAQPage" in _schema_types(_jsonld_blocks(soup)))

    # Readability, from prose only — links reduced to their anchor text and URLs dropped, the
    # same normalisation analyze_markdown() uses, so sentence length is not skewed by a wall
    # of href characters.
    prose = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", md)
    prose = re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", prose)
    prose = re.sub(r"https?://\S+", " ", prose)
    prose = re.sub(r"(?m)^#{1,6}\s+", "", prose)
    sentences = [s.strip() for s in re.split(r"[.!?]+[\s\n]", prose) if len(s.strip()) > 1]
    if sentences:
        lengths = [len(re.findall(r"[a-zA-Z][a-zA-Z'-]*", s)) for s in sentences]
        lengths = [n for n in lengths if n]
        if lengths:
            out["sentences"] = len(lengths)
            out["avg_sentence_words"] = round(sum(lengths) / len(lengths), 1)
            # 25+ words is the point at which plain-language guidance (and every answer
            # engine's extraction) starts struggling to pull a clean statement out.
            out["long_sentence_ratio"] = round(sum(1 for n in lengths if n >= 25) / len(lengths), 2)
    return out


def authority_signals(html: str, markdown: str, url: str) -> dict:
    """Trust surfaces a reader or an answer engine looks for: about, contact, docs, blog,
    official profiles. Same needles core/seo_scoring.py scores with, returned as findings so
    the Online Presence node can say which ones are missing instead of only a number."""
    soup = _soup(html)
    hrefs = " ".join(h.lower() for h in _hrefs(soup))
    low = (markdown or "").lower()
    found, missing = {}, []
    for label, needles in (("about", ("about",)), ("contact", ("contact", "mailto:")),
                           ("docs", ("docs", "documentation", "/help", "support")),
                           ("blog", ("blog", "news", "articles")),
                           ("pricing", ("pricing", "plans")),
                           ("privacy", ("privacy", "terms"))):
        hit = any(n in hrefs or n in low for n in needles)
        found[label] = hit
        if not hit:
            missing.append(label)
    profiles = sorted({s for s in _SOCIAL if s in hrefs})
    return {"found": found, "missing": missing, "profiles": profiles,
            "has_contact_email": "mailto:" in hrefs}


def build_jsonld(url: str, brand_name: str, description: str, html: str,
                 profiles: list = None) -> dict:
    """The Organization + WebSite JSON-LD this page is missing, ready to paste.

    Deterministic, not model-written: a schema block is a factual claim about the business
    and Google penalises structured data that disagrees with the page. It is assembled from
    the site's own URL, the brand profile and the profile links found on the page, and it
    reports which types the page already declares so the caller never tells someone to add
    markup that is present.
    """
    soup = _soup(html)
    existing = sorted(_schema_types(_jsonld_blocks(soup)))
    host = (urlparse(url).netloc or "").replace("www.", "")
    name = (brand_name or host or "").strip() or host
    org = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": name,
        "url": url,
    }
    if description:
        org["description"] = description.strip()[:300]
    if profiles:
        # sameAs is how an answer engine confirms that this Organization and the LinkedIn /
        # GitHub / X account with the same name are one entity rather than three.
        org["sameAs"] = [p if p.startswith("http") else f"https://{p}" for p in profiles][:8]
    site = {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": name,
        "url": url,
    }
    missing = [t for t in ("Organization", "WebSite") if t not in existing]
    return {
        "existing_types": existing,
        "missing_types": missing,
        "jsonld": json.dumps([org, site], indent=2, ensure_ascii=False),
        "ready_to_paste": bool(missing),
    }
