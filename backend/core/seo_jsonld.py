"""Deterministic JSON-LD builders — one function per schema.org @type, each built only from
real, already-known data (workspace fields, the audit's own target_url, or text actually
found on the crawled page). No LLM involved anywhere in this file: schema facts must never
be invented. A field with no real source is omitted from the output rather than guessed —
callers report that omission to the user instead of silently shipping a fabricated value.
"""
from __future__ import annotations
import json
import re


def _normalize_url(url: str) -> str:
    url = (url or "").strip()
    if url and not url.lower().startswith(("http://", "https://")):
        url = f"https://{url}"
    return url


def build_organization_jsonld(name: str, url: str, logo: str | None = None) -> str:
    data = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": name,
        "url": _normalize_url(url),
    }
    if logo:
        data["logo"] = logo
    return json.dumps(data, indent=2)


def build_product_jsonld(name: str, url: str, description: str | None = None) -> str:
    """Product schema WITHOUT price/offers/brand/sku — we have no real source for any of
    those (no pricing/inventory data anywhere in this codebase), so they're omitted rather
    than invented. Callers should tell the user those fields need to be added manually."""
    data = {
        "@context": "https://schema.org",
        "@type": "Product",
        "name": name,
        "url": _normalize_url(url),
    }
    if description:
        data["description"] = description
    return json.dumps(data, indent=2)


def build_software_application_jsonld(name: str, url: str, description: str | None = None) -> str:
    """SoftwareApplication WITHOUT applicationCategory/operatingSystem/offers — no real
    source for any of those exists in the workspace/audit data."""
    data = {
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": name,
        "url": _normalize_url(url),
    }
    if description:
        data["description"] = description
    return json.dumps(data, indent=2)


def build_article_jsonld(headline: str, url: str, publisher_name: str | None = None,
                         publisher_url: str | None = None) -> str:
    """Article WITHOUT author/datePublished/image — none of those exist anywhere in this
    codebase's data (no author tracking, no publish-date field, no article image field), so
    they're omitted. `publisher` is included only if real workspace name/url are available."""
    data = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": headline[:110],  # Google's practical headline limit
        "mainEntityOfPage": _normalize_url(url),
    }
    if publisher_name and publisher_url:
        data["publisher"] = {"@type": "Organization", "name": publisher_name, "url": _normalize_url(publisher_url)}
    return json.dumps(data, indent=2)


def build_multi_type_jsonld(types: list[str], name: str, url: str, description: str | None = None) -> str:
    """Used when the recommendation genuinely names two possible types ("Product or
    SoftwareApplication schema") and there's no real content signal to pick one — schema.org
    supports an array for @type, which is more honest than guessing a single wrong type."""
    data = {
        "@context": "https://schema.org",
        "@type": types,
        "name": name,
        "url": _normalize_url(url),
    }
    if description:
        data["description"] = description
    return json.dumps(data, indent=2)


def build_faqpage_jsonld(qa_pairs: list[dict]) -> str | None:
    """FAQPage built ONLY from real question/answer pairs actually found on the page
    (see extract_faq_pairs below). Returns None if there are no real pairs to use — an
    FAQPage schema with invented questions would misrepresent the page to search engines,
    so we never generate one without real content."""
    if not qa_pairs:
        return None
    data = {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "mainEntity": [
            {
                "@type": "Question",
                "name": qa["question"],
                "acceptedAnswer": {"@type": "Answer", "text": qa["answer"]},
            }
            for qa in qa_pairs
        ],
    }
    return json.dumps(data, indent=2)


_QUESTION_WORDS = ("what", "how", "why", "who", "can", "does", "is", "are", "when", "where", "which", "should")


def extract_faq_pairs(html: str, limit: int = 10) -> list[dict]:
    """Real extraction, not generation: finds heading tags that read as a question (ends in
    '?', or starts with a question word) and pairs each with the very next block of text as
    the answer. If the page has no such content, returns [] — the caller must not invent a
    fallback FAQ."""
    try:
        from bs4 import BeautifulSoup
    except Exception:
        return []
    if not html:
        return []
    soup = BeautifulSoup(html, "html.parser")
    pairs = []
    for heading in soup.find_all(re.compile(r"^h[2-6]$")):
        q = heading.get_text(strip=True)
        if not q:
            continue
        looks_like_question = q.rstrip().endswith("?") or q.strip().lower().split(" ")[0] in _QUESTION_WORDS
        if not looks_like_question:
            continue
        # The answer is the next sibling element with real text (skip empty/whitespace nodes).
        answer = ""
        node = heading.find_next_sibling()
        while node is not None and not answer:
            text = node.get_text(strip=True) if hasattr(node, "get_text") else ""
            if text:
                answer = text
                break
            node = node.find_next_sibling()
        if q and answer:
            pairs.append({"question": q, "answer": answer[:500]})
        if len(pairs) >= limit:
            break
    return pairs
