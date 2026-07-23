"""Evidence-based SEO & GEO scoring.

Design rule (from the audit spec): every point awarded or deducted must be traceable to
something actually measured on the page. Nothing is estimated and nothing is invented.
Anything we cannot verify is reported as status="not_verified" and EXCLUDED from the
score (the total is re-normalised over the verified categories) rather than guessed.

The LLM never produces the numbers — it only narrates the evidence produced here.
"""
from __future__ import annotations

import json
import re
from urllib.parse import urlparse, urljoin

try:
    from bs4 import BeautifulSoup
except Exception:  # pragma: no cover - bs4 is in requirements
    BeautifulSoup = None

GENERIC_ANCHORS = {"click here", "here", "read more", "more", "learn more", "link", "this",
                   "continue", "read", "see more", "details"}


# --------------------------------------------------------------------------- helpers

def _cat(name, max_points, score, reason, evidence, recommendations, impact="Medium",
         status="verified"):
    """One scored category. `score` is None when status == 'not_verified'."""
    return {
        "name": name,
        "max": max_points,
        "score": None if status == "not_verified" else round(score, 1),
        "status": status,
        "reason": reason,
        "evidence": evidence,
        "recommendations": recommendations,
        "expected_impact": impact,
    }


def _soup(html: str):
    if not html or BeautifulSoup is None:
        return None
    try:
        return BeautifulSoup(html, "html.parser")
    except Exception:
        return None


def _jsonld_blocks(soup) -> list:
    blocks = []
    if not soup:
        return blocks
    for tag in soup.find_all("script", attrs={"type": re.compile("ld\\+json", re.I)}):
        raw = tag.string or tag.get_text() or ""
        try:
            data = json.loads(raw.strip())
            blocks.extend(data if isinstance(data, list) else [data])
        except Exception:
            continue
    return blocks


def _schema_types(blocks) -> set:
    types = set()
    def walk(node):
        if isinstance(node, dict):
            t = node.get("@type")
            if isinstance(t, str):
                types.add(t)
            elif isinstance(t, list):
                types.update(x for x in t if isinstance(x, str))
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
    walk(blocks)
    return types


def _meta(soup, name=None, prop=None) -> str:
    if not soup:
        return ""
    attrs = {"name": name} if name else {"property": prop}
    tag = soup.find("meta", attrs=attrs)
    return (tag.get("content") or "").strip() if tag else ""


# --------------------------------------------------------------------------- SEO

def score_seo(url: str, html: str, markdown: str, metrics: dict, signals: dict) -> dict:
    """metrics = output of analyze_markdown(); signals = https/robots/sitemap/status info."""
    soup = _soup(html)
    host = (urlparse(url).netloc or "").lower().replace("www.", "")
    cats = []

    # ---- 1. Content (20)
    wc = metrics.get("word_count", 0)
    h1, h2, h3 = metrics.get("h1_count", 0), metrics.get("h2_count", 0), metrics.get("h3plus_count", 0)
    ev, rec, pts = [], [], 0.0
    if wc >= 800:
        pts += 8; ev.append(f"Word count {wc} (>=800) → 8/8")
    elif wc >= 300:
        pts += 5; ev.append(f"Word count {wc} (300-799) → 5/8")
        rec.append("Expand the page past 800 words of substantive content.")
    else:
        ev.append(f"Word count {wc} (<300 = thin content) → 0/8")
        rec.append(f"Thin content: only {wc} words. Expand to 800+ words.")
    if h1 == 1:
        pts += 4; ev.append("Exactly one H1 → 4/4")
    else:
        ev.append(f"H1 count = {h1} (should be exactly 1) → 0/4")
        rec.append(f"Page has {h1} H1 tags; use exactly one.")
    if h2 >= 2:
        pts += 4; ev.append(f"{h2} H2 sections → 4/4")
    elif h2 == 1:
        pts += 2; ev.append("1 H2 section → 2/4")
        rec.append("Add more H2 sections to structure the content.")
    else:
        ev.append("No H2 sections → 0/4")
        rec.append("Add H2 subheadings to give the page a clear structure.")
    top = metrics.get("top_keywords", []) or []
    title_txt = (soup.title.get_text() if (soup and soup.title) else "").lower()
    h1_txt = (soup.find("h1").get_text().lower() if (soup and soup.find("h1")) else "")
    if top:
        term = top[0]["term"]
        if term in title_txt or term in h1_txt:
            pts += 4; ev.append(f"Top term '{term}' appears in title/H1 (topical focus) → 4/4")
        else:
            pts += 1; ev.append(f"Top term '{term}' NOT in title/H1 → 1/4")
            rec.append(f"Align the title/H1 with the page's dominant term ('{term}').")
    else:
        ev.append("No keyword signal extracted → 0/4")
    cats.append(_cat("Content", 20, pts, f"{wc} words, {h1} H1 / {h2} H2, heading + topical checks",
                     ev, rec, "High" if pts < 12 else "Medium"))

    # ---- 2. Metadata (15)
    ev, rec, pts = [], [], 0.0
    title = (soup.title.get_text().strip() if (soup and soup.title) else "")
    desc = _meta(soup, name="description")
    canonical = soup.find("link", attrs={"rel": re.compile("canonical", re.I)}) if soup else None
    og = [p for p in ("og:title", "og:description", "og:image") if _meta(soup, prop=p)]
    if title and 30 <= len(title) <= 65:
        pts += 5; ev.append(f"Title present, {len(title)} chars (30-65 ideal) → 5/5")
    elif title:
        pts += 3; ev.append(f"Title present but {len(title)} chars (outside 30-65) → 3/5")
        rec.append(f"Rewrite the title to 30-65 chars (currently {len(title)}).")
    else:
        ev.append("No <title> tag → 0/5")
        rec.append("Add a descriptive, keyword-led title tag.")
    if desc and 70 <= len(desc) <= 160:
        pts += 5; ev.append(f"Meta description present, {len(desc)} chars → 5/5")
    elif desc:
        pts += 3; ev.append(f"Meta description present but {len(desc)} chars (70-160 ideal) → 3/5")
        rec.append(f"Adjust the meta description to 70-160 chars (currently {len(desc)}).")
    else:
        ev.append("No meta description → 0/5")
        rec.append("Add a compelling 70-160 char meta description.")
    if canonical:
        pts += 2.5; ev.append("Canonical link present → 2.5/2.5")
    else:
        ev.append("No canonical link → 0/2.5")
        rec.append("Add a self-referencing canonical tag.")
    if len(og) == 3:
        pts += 2.5; ev.append("All 3 core Open Graph tags present → 2.5/2.5")
    elif og:
        pts += 1; ev.append(f"Only {len(og)}/3 Open Graph tags ({', '.join(og)}) → 1/2.5")
        rec.append("Complete the Open Graph tags (title, description, image).")
    else:
        ev.append("No Open Graph tags → 0/2.5")
        rec.append("Add Open Graph tags for social/AI preview accuracy.")
    cats.append(_cat("Metadata", 15, pts, "Title, description, canonical and Open Graph checks",
                     ev, rec, "High" if pts < 9 else "Medium"))

    # ---- 3. Technical SEO (20)
    ev, rec, pts = [], [], 0.0
    if signals.get("https"):
        pts += 4; ev.append("Served over HTTPS → 4/4")
    else:
        ev.append("Not served over HTTPS → 0/4")
        rec.append("Serve the site over HTTPS.")
    r = signals.get("robots_txt") or {}
    if r.get("found"):
        pts += 4; ev.append(f"robots.txt found (HTTP {r.get('status')}) → 4/4")
        if r.get("disallow_all"):
            pts -= 2; ev.append("robots.txt contains 'Disallow: /' → -2 (blocks crawling)")
            rec.append("robots.txt disallows crawling of the whole site — remove that rule.")
    else:
        ev.append("robots.txt NOT found → 0/4")
        rec.append("Add a robots.txt that allows crawling and points to the sitemap.")
    s = signals.get("sitemap") or {}
    if s.get("found"):
        pts += 4; ev.append(f"sitemap.xml found (HTTP {s.get('status')}) → 4/4")
    else:
        ev.append("sitemap.xml NOT found → 0/4")
        rec.append("Publish an XML sitemap and submit it in Search Console.")
    robots_meta = _meta(soup, name="robots").lower()
    if "noindex" in robots_meta:
        ev.append(f"meta robots = '{robots_meta}' (NOINDEX) → 0/4")
        rec.append("Page is set to noindex — remove it so the page can rank.")
    else:
        pts += 4; ev.append("Page is indexable (no noindex directive) → 4/4")
    status = signals.get("status_code")
    if status == 200:
        pts += 4; ev.append(f"Returns HTTP {status} with no redirect chain issues → 4/4")
    elif status:
        pts += 2; ev.append(f"Returns HTTP {status} → 2/4")
        rec.append(f"Page returns HTTP {status}; it should return 200.")
    else:
        ev.append("HTTP status not captured → 0/4")
    cats.append(_cat("Technical SEO", 20, max(pts, 0), "HTTPS, robots.txt, sitemap, indexability, status",
                     ev, rec, "Critical" if pts < 10 else "Medium"))

    # ---- 4. Performance (15) — requires field/lab data we do not collect
    psi = signals.get("psi") or {}
    if psi:
        ev, rec, pts = [], [], 0.0
        for key, label, good in (("lcp", "LCP", 2.5), ("fcp", "FCP", 1.8), ("cls", "CLS", 0.1)):
            v = psi.get(key)
            if v is None:
                continue
            ok = v <= good
            pts += 5 if ok else 2
            ev.append(f"{label} = {v} (target <= {good}) → {'5' if ok else '2'}/5")
            if not ok:
                rec.append(f"Improve {label} (currently {v}, target <= {good}).")
        cats.append(_cat("Performance", 15, min(pts, 15), "Core Web Vitals from PageSpeed data", ev, rec, "High"))
    else:
        cats.append(_cat(
            "Performance", 15, None,
            "No Core Web Vitals source connected (PageSpeed/CrUX not integrated)",
            ["LCP: Not Verified", "FCP: Not Verified", "CLS: Not Verified",
             "Excluded from the score rather than estimated."],
            ["Connect PageSpeed Insights/CrUX to score performance with real data."],
            "High", status="not_verified"))

    # ---- 5. Accessibility (10)
    ev, rec, pts = [], [], 0.0
    imgs = metrics.get("image_count", 0)
    missing = metrics.get("images_missing_alt", 0)
    if imgs == 0:
        pts += 2.5; ev.append("No images on the page (nothing to fail alt-text) → 2.5/5")
    elif missing == 0:
        pts += 5; ev.append(f"All {imgs} images have alt text → 5/5")
    else:
        ratio = 1 - (missing / imgs)
        pts += 5 * ratio
        ev.append(f"{imgs - missing}/{imgs} images have alt text → {round(5*ratio,1)}/5")
        rec.append(f"Add alt text to {missing} image(s).")
    sem = [t for t in ("header", "nav", "main", "footer", "article", "section")
           if soup and soup.find(t)]
    if len(sem) >= 3:
        pts += 3; ev.append(f"Semantic HTML present ({', '.join(sem)}) → 3/3")
    elif sem:
        pts += 1.5; ev.append(f"Limited semantic HTML ({', '.join(sem)}) → 1.5/3")
        rec.append("Use more semantic landmarks (header/nav/main/footer).")
    else:
        ev.append("No semantic landmark elements → 0/3")
        rec.append("Wrap content in semantic HTML5 landmarks.")
    inputs = soup.find_all("input") if soup else []
    labels = soup.find_all("label") if soup else []
    aria = soup.find_all(attrs={"aria-label": True}) if soup else []
    if not inputs:
        pts += 2; ev.append("No form inputs to label → 2/2")
    elif labels or aria:
        pts += 2; ev.append(f"{len(inputs)} inputs with {len(labels)} labels / {len(aria)} aria-labels → 2/2")
    else:
        ev.append(f"{len(inputs)} form inputs with no labels or aria-labels → 0/2")
        rec.append("Add <label> or aria-label to every form input.")
    ev.append("Colour contrast: Not Verified (needs rendered-page analysis)")
    cats.append(_cat("Accessibility", 10, pts, "Alt text, semantic HTML, form labelling", ev, rec))

    # ---- 6. Internal Linking (10)
    ev, rec, pts = [], [], 0.0
    il, el = metrics.get("internal_links", 0), metrics.get("external_links", 0)
    if il >= 10:
        pts += 5; ev.append(f"{il} internal links → 5/5")
    elif il >= 3:
        pts += 3; ev.append(f"{il} internal links (10+ preferred) → 3/5")
        rec.append("Add more internal links to key pages.")
    else:
        ev.append(f"Only {il} internal links → 0/5")
        rec.append("Very weak internal linking — link to your main pages.")
    anchors = [(a.get_text() or "").strip().lower() for a in (soup.find_all("a") if soup else [])]
    anchors = [a for a in anchors if a]
    generic = [a for a in anchors if a in GENERIC_ANCHORS]
    if anchors:
        gr = len(generic) / len(anchors)
        if gr <= 0.1:
            pts += 3; ev.append(f"{len(generic)}/{len(anchors)} generic anchors ({gr:.0%}) → 3/3")
        else:
            pts += 1; ev.append(f"{len(generic)}/{len(anchors)} generic anchors ({gr:.0%}) → 1/3")
            rec.append("Replace generic anchors ('click here', 'read more') with descriptive text.")
    else:
        ev.append("No anchors found → 0/3")
    if soup and soup.find("nav"):
        pts += 2; ev.append("Navigation element present → 2/2")
    else:
        pts += 1; ev.append("No <nav> element detected → 1/2")
        rec.append("Wrap primary navigation in a <nav> element.")
    ev.append("Orphan pages: Not Verified (needs a full-site crawl)")
    cats.append(_cat("Internal Linking", 10, pts, f"{il} internal / {el} external links, anchor quality",
                     ev, rec))

    # ---- 7. Structured Data (10)
    ev, rec, pts = [], [], 0.0
    blocks = _jsonld_blocks(soup)
    types = _schema_types(blocks)
    if blocks:
        pts += 3; ev.append(f"{len(blocks)} JSON-LD block(s) found → 3/3")
    else:
        ev.append("No JSON-LD structured data → 0/3")
        rec.append("Add JSON-LD structured data (start with Organization).")
    if types & {"Organization", "WebSite", "LocalBusiness"}:
        pts += 3; ev.append(f"Identity schema present ({', '.join(sorted(types & {'Organization','WebSite','LocalBusiness'}))}) → 3/3")
    else:
        ev.append("No Organization/WebSite schema → 0/3")
        rec.append("Add Organization schema (name, url, logo, sameAs).")
    rich = types & {"FAQPage", "BreadcrumbList", "Article", "Product", "SoftwareApplication", "Course"}
    if rich:
        pts += 4; ev.append(f"Rich-result schema present ({', '.join(sorted(rich))}) → 4/4")
    else:
        ev.append("No FAQ/Breadcrumb/Article/Product/SoftwareApplication/Course schema → 0/4")
        rec.append("Add schema matching the page type (FAQPage, Article, Product, SoftwareApplication…).")
    cats.append(_cat("Structured Data", 10, pts, f"Detected schema types: {', '.join(sorted(types)) or 'none'}",
                     ev, rec, "High" if pts < 5 else "Medium"))

    return _finalise("SEO", cats)


# --------------------------------------------------------------------------- GEO

def score_geo(url: str, html: str, markdown: str, metrics: dict, signals: dict,
              llm_recall: dict | None = None) -> dict:
    soup = _soup(html)
    md = markdown or ""
    low = md.lower()
    cats = []

    blocks = _jsonld_blocks(soup)
    types = _schema_types(blocks)
    title = (soup.title.get_text().strip() if (soup and soup.title) else "")
    desc = _meta(soup, name="description")

    # ---- 1. AI Readability (20)
    ev, rec, pts = [], [], 0.0
    if title and desc:
        pts += 5; ev.append("Title + meta description both present (AI can state what this is) → 5/5")
    elif title or desc:
        pts += 2.5; ev.append("Only one of title/meta description present → 2.5/5")
        rec.append("Provide both a descriptive title and meta description.")
    else:
        ev.append("Neither title nor meta description → 0/5")
        rec.append("Add a title and meta description that state what the product is.")
    h1 = soup.find("h1").get_text().strip() if (soup and soup.find("h1")) else ""
    if len(h1) >= 15:
        pts += 5; ev.append(f"Descriptive H1 present ('{h1[:50]}') → 5/5")
    elif h1:
        pts += 2; ev.append(f"H1 very short ('{h1}') → 2/5")
        rec.append("Make the H1 explicitly describe the product/offering.")
    else:
        ev.append("No H1 → 0/5")
        rec.append("Add an H1 that names the product and its purpose.")
    bullets = len(re.findall(r"(?m)^\s*[-*]\s+\S", md))
    if bullets >= 5:
        pts += 5; ev.append(f"{bullets} bullet points (features are scannable) → 5/5")
    elif bullets:
        pts += 2; ev.append(f"Only {bullets} bullet points → 2/5")
        rec.append("List key features as bullets so AI can extract them.")
    else:
        ev.append("No bullet lists → 0/5")
        rec.append("Add a bulleted feature list.")
    audience = [w for w in ("for teams", "for developers", "for businesses", "designed for",
                            "built for", "who is it for", "ideal for", "for students") if w in low]
    if audience:
        pts += 5; ev.append(f"Audience signal found ({audience[0]}) → 5/5")
    else:
        ev.append("No explicit 'who it's for' statement → 0/5")
        rec.append("State plainly who the product is for ('built for X').")
    cats.append(_cat("AI Readability", 20, pts, "Can an AI state what this is, who it's for, and its features",
                     ev, rec, "High"))

    # ---- 2. Content Structure (20)
    ev, rec, pts = [], [], 0.0
    h2, h3 = metrics.get("h2_count", 0), metrics.get("h3plus_count", 0)
    if h2 >= 3:
        pts += 5; ev.append(f"{h2} H2 sections → 5/5")
    elif h2:
        pts += 2.5; ev.append(f"{h2} H2 sections → 2.5/5")
        rec.append("Break the page into more clearly-titled sections.")
    else:
        ev.append("No H2 sections → 0/5")
        rec.append("Add H2 section headings.")
    if h3 >= 2:
        pts += 5; ev.append(f"{h3} H3+ subsections (clear hierarchy) → 5/5")
    else:
        pts += 2; ev.append(f"{h3} H3+ subsections → 2/5")
        rec.append("Add sub-headings for a deeper, more parseable hierarchy.")
    if bullets := len(re.findall(r"(?m)^\s*[-*]\s+\S", md)):
        pts += 5; ev.append(f"{bullets} list items → 5/5")
    else:
        ev.append("No lists → 0/5")
        rec.append("Use lists — AI extracts them far more reliably than prose.")
    has_faq = ("faq" in low or "frequently asked" in low
               or bool(re.search(r"(?m)^#{2,}\s*(what|how|why|who|can|does|is)\b.*\?", md, re.I)))
    if has_faq:
        pts += 5; ev.append("FAQ / question-style headings detected → 5/5")
    else:
        ev.append("No FAQ or question-style sections → 0/5")
        rec.append("Add an FAQ section with question-style headings.")
    cats.append(_cat("Content Structure", 20, pts, "Headings, lists, tables and FAQ structure", ev, rec, "High"))

    # ---- 3. AI Citation Readiness (20)
    ev, rec, pts = [], [], 0.0
    stats = re.findall(r"\b\d+(?:\.\d+)?\s?(?:%|percent|x|million|billion|users|customers)\b", low)
    if len(stats) >= 3:
        pts += 5; ev.append(f"{len(stats)} quotable statistics found → 5/5")
    elif stats:
        pts += 2.5; ev.append(f"{len(stats)} statistic(s) found → 2.5/5")
        rec.append("Add more concrete, citable numbers.")
    else:
        ev.append("No statistics/numbers to cite → 0/5")
        rec.append("Add concrete stats — AI engines preferentially cite specific figures.")
    definitions = len(re.findall(r"\b(is a|is an|refers to|means that|is the)\b", low))
    if definitions >= 3:
        pts += 5; ev.append(f"{definitions} definition-style statements → 5/5")
    elif definitions:
        pts += 2.5; ev.append(f"{definitions} definition-style statement(s) → 2.5/5")
        rec.append("Add clear 'X is a …' definition sentences.")
    else:
        ev.append("No definition-style sentences → 0/5")
        rec.append("Define your product/category in a single quotable sentence.")
    paras = [p for p in re.split(r"\n\s*\n", md) if len(p.split()) > 5]
    short = [p for p in paras if len(p.split()) <= 80]
    if paras and len(short) / len(paras) >= 0.6:
        pts += 5; ev.append(f"{len(short)}/{len(paras)} paragraphs are concise (<=80 words) → 5/5")
    elif paras:
        pts += 2; ev.append(f"Only {len(short)}/{len(paras)} paragraphs are concise → 2/5")
        rec.append("Shorten paragraphs — concise blocks are easier to quote.")
    else:
        ev.append("No prose paragraphs detected → 0/5")
    if metrics.get("external_links", 0) >= 2:
        pts += 5; ev.append(f"{metrics.get('external_links')} outbound citations → 5/5")
    else:
        ev.append(f"{metrics.get('external_links', 0)} outbound citations → 0/5")
        rec.append("Cite authoritative external sources to raise trust signals.")
    cats.append(_cat("AI Citation Readiness", 20, pts, "Stats, definitions, concise blocks and sources",
                     ev, rec, "High"))

    # ---- 4. Authority Signals (20)
    ev, rec, pts = [], [], 0.0
    hrefs = " ".join((a.get("href") or "").lower() for a in (soup.find_all("a") if soup else []))
    checks = [
        ("About page", ("about",), 4),
        ("Contact info", ("contact", "mailto:"), 4),
        ("Documentation", ("docs", "documentation", "/help", "support"), 4),
        ("Blog", ("blog", "news", "articles"), 4),
    ]
    for label, needles, worth in checks:
        if any(n in hrefs or n in low for n in needles):
            pts += worth; ev.append(f"{label} link found → {worth}/{worth}")
        else:
            ev.append(f"No {label} link → 0/{worth}")
            rec.append(f"Add a {label.lower()} — it is a standard trust signal for AI engines.")
    social = [s for s in ("linkedin.com", "twitter.com", "x.com", "github.com", "facebook.com")
              if s in hrefs]
    if social:
        pts += 4; ev.append(f"Social/company profiles linked ({', '.join(social)}) → 4/4")
    else:
        ev.append("No social/company profile links → 0/4")
        rec.append("Link your official profiles (LinkedIn/GitHub/X) for entity confirmation.")
    cats.append(_cat("Authority Signals", 20, pts, "About, contact, docs, blog and profile links", ev, rec))

    # ---- 5. Structured Knowledge (20)
    ev, rec, pts = [], [], 0.0
    if blocks:
        pts += 5; ev.append(f"{len(blocks)} JSON-LD block(s) → 5/5")
    else:
        ev.append("No JSON-LD → 0/5")
        rec.append("Add JSON-LD — this is how AI engines read entity facts.")
    if "Organization" in types:
        pts += 5; ev.append("Organization schema present → 5/5")
    else:
        ev.append("No Organization schema → 0/5")
        rec.append("Add Organization schema (name, url, logo, description).")
    if types & {"SoftwareApplication", "Product", "Course", "Service"}:
        pts += 5; ev.append(f"Offering schema present ({', '.join(sorted(types & {'SoftwareApplication','Product','Course','Service'}))}) → 5/5")
    else:
        ev.append("No Product/SoftwareApplication/Course schema → 0/5")
        rec.append("Describe your offering with Product or SoftwareApplication schema.")
    has_sameas = any("sameAs" in json.dumps(b) for b in blocks) if blocks else False
    if has_sameas or "FAQPage" in types:
        pts += 5; ev.append("sameAs links and/or FAQPage schema present → 5/5")
    else:
        ev.append("No sameAs links or FAQPage schema → 0/5")
        rec.append("Add sameAs profile links and FAQPage schema to disambiguate the entity.")
    cats.append(_cat("Structured Knowledge", 20, pts, f"Schema detected: {', '.join(sorted(types)) or 'none'}",
                     ev, rec, "High"))

    result = _finalise("GEO", cats)
    if llm_recall:
        result["llm_recall"] = {
            "brand_recognised": llm_recall.get("brand_recognised"),
            "model_response": llm_recall.get("llm_recall"),
            "note": "Measured by directly querying an AI model — not an estimate.",
        }
    return result


# --------------------------------------------------------------------------- totals

def _finalise(label: str, cats: list) -> dict:
    verified = [c for c in cats if c["status"] == "verified"]
    unverified = [c for c in cats if c["status"] != "verified"]
    earned = sum(c["score"] for c in verified)
    vmax = sum(c["max"] for c in verified)
    score100 = round((earned / vmax) * 100, 1) if vmax else 0.0
    parts = " + ".join(f"{c['name']} {c['score']}/{c['max']}" for c in verified)
    formula = f"{label} = ({parts}) = {round(earned,1)}/{vmax} → {score100}/100"
    if unverified:
        formula += (f"  [excluded as Not Verified: "
                    f"{', '.join(c['name'] + ' (' + str(c['max']) + 'pts)' for c in unverified)}]")
    return {
        "label": label,
        "categories": cats,
        "earned_points": round(earned, 1),
        "verified_max": vmax,
        "score_100": score100,
        "formula": formula,
        "not_verified": [c["name"] for c in unverified],
    }


def build_audit(url: str, html: str, markdown: str, metrics: dict, signals: dict,
                llm_recall: dict | None = None) -> dict:
    """Full evidence-based audit: SEO + GEO + overall + priority matrix."""
    seo = score_seo(url, html, markdown, metrics, signals)
    geo = score_geo(url, html, markdown, metrics, signals, llm_recall)
    overall = round((seo["score_100"] + geo["score_100"]) / 2, 1)

    issues = []
    for section in (seo, geo):
        for c in section["categories"]:
            if c["status"] != "verified" or not c["recommendations"]:
                continue
            pct = (c["score"] / c["max"]) if c["max"] else 1
            sev = "Critical" if pct < 0.4 else "High" if pct < 0.6 else "Medium" if pct < 0.85 else "Low"
            for r in c["recommendations"]:
                issues.append({"severity": sev, "area": f"{section['label']} · {c['name']}",
                               "issue": r, "impact": c["expected_impact"]})
    order = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    issues.sort(key=lambda i: order.get(i["severity"], 4))

    return {
        "target_url": url,
        "seo": seo,
        "geo": geo,
        "overall_health": overall,
        "overall_formula": f"Overall = (SEO {seo['score_100']} + GEO {geo['score_100']}) / 2 = {overall}/100",
        "priority_issues": issues,
        "top_5_issues": issues[:5],
    }
