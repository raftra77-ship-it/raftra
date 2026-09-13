"""Fetching a page without Firecrawl, and reading robots.txt the way a crawler does.

Two things the audit pipelines were getting wrong.

1. When Firecrawl had no key, was out of credits, or failed twice, the SEO pipeline carried
   on in "simulation" and the GEO pipeline carried on with an empty page. Both then scored
   that empty page and saved it as a completed audit - SEO 8/100, GEO 2/100, with every
   category "verified" at zero. A plain HTTP fetch of the same URL almost always works: most
   sites serve their title, meta tags, JSON-LD and body copy in the initial HTML. That is the
   fallback now, and a run only fails when both routes return nothing readable.

2. robots.txt was read with one regex: any `Disallow: /` line anywhere in the file set
   `disallow_all`. Real files scope rules per user-agent - ambraneindia.com disallows `/`
   for GPTBot, ClaudeBot, CCBot and Nutch while allowing everyone else - and the audit
   reported that as the whole site blocking crawlers, with a deduction and a "remove that
   rule" recommendation. Rules are now evaluated per agent with the standard library's
   parser, which also answers a GEO question nothing was asking: which AI crawlers are
   allowed to read this page at all.
"""
import re
from urllib.parse import quote, urljoin, urlparse
from urllib.robotparser import RobotFileParser

BROWSER_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
              "(KHTML, like Gecko) Chrome/126.0 Safari/537.36")

SEARCH_AGENTS = ("Googlebot", "Bingbot")

# (user-agent token, what it is, kind). "answer" crawlers fetch a page so a live answer can
# cite it; "training" crawlers collect pages for model training, which is what later lets a
# model recall the brand unprompted. Blocking training crawlers is a legitimate business
# choice, so it is weighted less and reported as a trade-off rather than as a mistake.
AI_CRAWLERS = (
    ("OAI-SearchBot", "ChatGPT search", "answer"),
    ("ChatGPT-User", "ChatGPT browsing", "answer"),
    ("PerplexityBot", "Perplexity", "answer"),
    ("Claude-SearchBot", "Claude search", "answer"),
    ("GPTBot", "OpenAI model training", "training"),
    ("ClaudeBot", "Anthropic model training", "training"),
    ("Google-Extended", "Gemini model training", "training"),
    ("CCBot", "Common Crawl (used to train many models)", "training"),
    ("Applebot-Extended", "Apple Intelligence training", "training"),
)


def robots_access(robots_body: str, url: str) -> dict:
    """Which crawlers robots.txt lets fetch `url`.

    blocks_search         True when the page is disallowed for * or for Googlebot/Bingbot -
                          the only case that genuinely stops the page being indexed.
    blocked_search_agents which of those are blocked.
    blocked_agents        every agent named in its own group that is disallowed this path.
    ai_crawlers           per-agent verdicts for AI_CRAWLERS.
    """
    rp = RobotFileParser()
    rp.parse((robots_body or "").splitlines())

    def allowed(agent: str) -> bool:
        try:
            return rp.can_fetch(agent, url)
        except Exception:
            return True

    blocked_search = [a for a in ("*",) + SEARCH_AGENTS if not allowed(a)]
    ai = [{"agent": a, "label": label, "kind": kind, "allowed": allowed(a)}
          for a, label, kind in AI_CRAWLERS]

    path = quote(urlparse(url).path or "/")
    named = set()
    for entry in getattr(rp, "entries", None) or []:
        try:
            if not entry.allowance(path):
                named.update(ua for ua in entry.useragents if ua != "*")
        except Exception:
            continue

    return {
        "blocks_search": bool(blocked_search),
        "blocked_search_agents": blocked_search,
        "blocked_agents": sorted(named, key=str.lower),
        "ai_crawlers": ai,
    }


async def fetch_page(url: str, timeout: float = 30.0) -> dict:
    """GET the page as a browser would. Raises on transport errors, HTTP >= 400 and non-HTML."""
    import httpx

    headers = {
        # python-httpx's default User-Agent is refused outright by a number of CDNs.
        "User-Agent": BROWSER_UA,
        "Accept": "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    async with httpx.AsyncClient(timeout=timeout, follow_redirects=True, headers=headers) as client:
        r = await client.get(url)
    if r.status_code >= 400:
        raise RuntimeError(f"HTTP {r.status_code}")
    ctype = (r.headers.get("content-type") or "").lower()
    if ctype and "html" not in ctype:
        raise RuntimeError(f"not an HTML page ({ctype.split(';')[0]})")
    return {"html": r.text, "status_code": r.status_code, "final_url": str(r.url),
            "redirect_count": len(r.history)}


# ------------------------------------------------------------------ HTML -> markdown

_SKIP = ("script", "style", "noscript", "svg", "template", "iframe", "canvas", "object",
         "button", "select", "option", "textarea", "input")
_HEADINGS = {"h1", "h2", "h3", "h4", "h5", "h6"}
_CONTAINERS = {"html", "body", "div", "section", "article", "main", "header", "ul", "ol",
               "table", "thead", "tbody", "tfoot", "tr", "dl", "figure", "blockquote", "form",
               "details", "center"}
# Descendants that make any element (including custom elements) a block container.
_BLOCK_CONTENT = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "section", "article",
                  "ul", "ol", "li", "table"]
# What turns an <a> into a card link whose inside keeps its own structure.
_CARD_CONTENT = _BLOCK_CONTENT + ["img"]


def _abs(base: str, href: str) -> str:
    href = (href or "").strip()
    if not href or href.startswith(("#", "mailto:", "tel:", "javascript:", "data:")):
        return href
    return urljoin(base, href) if base else href


def _inline(el, base: str) -> str:
    from bs4 import Comment, NavigableString

    parts = []
    for node in el.children:
        if isinstance(node, Comment):
            continue
        if isinstance(node, NavigableString):
            parts.append(str(node))
        elif node.name == "a":
            text = _inline(node, base).strip()
            href = _abs(base, node.get("href"))
            parts.append(f"[{text}]({href})" if href else text)
        elif node.name == "img":
            src = node.get("src") or node.get("data-src") or ""
            parts.append(f"![{(node.get('alt') or '').strip()}]({_abs(base, src)})")
        elif node.name == "br":
            parts.append(" ")
        else:
            parts.append(" " + _inline(node, base) + " ")
    return re.sub(r"\s+", " ", "".join(parts))


def _blocks(el, base: str, out: list) -> None:
    from bs4 import Comment, NavigableString

    for node in el.children:
        if isinstance(node, Comment):
            continue
        if isinstance(node, NavigableString):
            text = re.sub(r"\s+", " ", str(node)).strip()
            if text:
                out.append(text)
            continue
        name = node.name
        if name in _HEADINGS:
            text = _inline(node, base).strip()
            if text:
                out.append("#" * int(name[1]) + " " + text)
        elif name == "li":
            text = _inline(node, base).strip()
            if text:
                out.append("- " + text)
        elif name == "a":
            href = _abs(base, node.get("href"))
            if node.find(_CARD_CONTENT) is not None:
                # A card link wrapping a heading or image: keep the structure inside it, and
                # count the link once without repeating its text.
                _blocks(node, base, out)
                if href:
                    out.append(f"[]({href})")
            else:
                text = _inline(node, base).strip()
                if text or href:
                    out.append(f"[{text}]({href})" if href else text)
        elif name == "img":
            src = node.get("src") or node.get("data-src") or ""
            out.append(f"![{(node.get('alt') or '').strip()}]({_abs(base, src)})")
        elif name in _CONTAINERS or node.find(_BLOCK_CONTENT) is not None:
            # Custom elements (Shopify's <product-card>, <slider-component>) and any wrapper
            # holding headings or paragraphs are containers too. Flattening them lost every
            # heading and link inside: ambraneindia.com's five H1s came out as zero.
            _blocks(node, base, out)
        else:
            text = _inline(node, base).strip()
            if text:
                out.append(text)


def html_to_markdown(html: str, base_url: str = "") -> str:
    """Markdown close enough to Firecrawl's for analyze_markdown(): headings as #, list items
    as "- ", links as [text](url), images as ![alt](src).

    Navigation, footers and sidebars are dropped the way Firecrawl's main-content mode drops
    them, so word counts and link counts describe the page body rather than the menu. A
    <header> is dropped only when it holds no H1, because article templates often put the
    page's H1 inside one.
    """
    from bs4 import BeautifulSoup

    try:
        soup = BeautifulSoup(html or "", "lxml")
    except Exception:
        soup = BeautifulSoup(html or "", "html.parser")
    for tag in soup.find_all(_SKIP):
        tag.decompose()
    if soup.head:
        soup.head.decompose()
    for tag in soup.find_all(("nav", "footer", "aside")):
        tag.decompose()
    for tag in soup.find_all("header"):
        if not tag.find("h1"):
            tag.decompose()

    # The whole body rather than just <main>: storefront themes put the page's H1 in the
    # header, outside <main>, and reading only <main> reported ambraneindia.com as having none.
    root = soup.body or soup
    out: list = []
    _blocks(root, base_url, out)
    return "\n\n".join(out)


# A browser-extension or blocked-embed notice that a rendering crawler captures from an
# iframe. On ambraneindia.com it put "blocked" in the top three keywords of both audits and
# added a stray "# ambraneindia.com is blocked" heading.
_BLOCKED_NOTICE = re.compile(
    r"(has been blocked by an extension|requests to the server have been blocked|"
    r"err_blocked_by_client|try disabling your extensions|"
    r"^\W*[\w.-]+\.[a-z]{2,}\s+is blocked\W*$)",
    re.I)


def clean_markdown(md: str) -> str:
    lines = [line for line in (md or "").splitlines()
             if not (len(line) < 160 and _BLOCKED_NOTICE.search(line.strip()))]
    return re.sub(r"\n{3,}", "\n\n", "\n".join(lines))
