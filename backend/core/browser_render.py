"""
Headless-browser rendering: computed styles and a screenshot of a brand's page.

Why this exists when the crawler already works. Everything the CSS extractor reads is
*source* - the stylesheets a site ships. That misses two things a browser knows and a text
fetch cannot:

  * COMPUTED styles. A modern storefront resolves `var(--color-primary)` through three
    layers of theme overrides, media queries and JS-injected variables. The shipped CSS may
    declare a dozen candidate values; only the browser knows which one the header button
    actually ended up painted with.
  * A SCREENSHOT. There is no other way to give a vision model what the page looks like.

STRICTLY OPTIONAL, and that is a design requirement rather than a nicety. Playwright is a
heavy dependency with a separate ~150MB browser download, and it will not be present in
every deployment. Every function here returns an empty result instead of raising when
Playwright is missing, the browser is not installed, or the page fails to render - so
onboarding degrades to the existing Firecrawl/httpx path and produces exactly what it did
before. Nothing that works today can break because this file is unavailable.
"""
import asyncio
import os
from typing import Optional

# Rendering a hostile or merely enormous page must not hang onboarding.
NAV_TIMEOUT_MS = int(os.getenv("RENDER_NAV_TIMEOUT_MS", "25000"))
SETTLE_MS = int(os.getenv("RENDER_SETTLE_MS", "1200"))
VIEWPORT = {"width": 1440, "height": 900}
_UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
       "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")


def is_available() -> bool:
    """True when Playwright is importable AND rendering is not disabled by env."""
    if os.getenv("DISABLE_BROWSER_RENDER", "").strip().lower() in ("1", "true", "yes", "on"):
        return False
    try:
        import playwright  # noqa: F401
        return True
    except ImportError:
        return False


# The script runs inside the page. It reports what the browser resolved, which is the whole
# point - these are values no amount of stylesheet parsing can produce.
_COLLECT_JS = """
() => {
  const out = { vars: {}, fonts: {}, swatches: [] };

  // 1) CSS custom properties as the browser resolved them on :root.
  const rootStyle = getComputedStyle(document.documentElement);
  for (const name of Array.from(rootStyle)) {
    if (name.startsWith('--')) {
      const v = rootStyle.getPropertyValue(name).trim();
      if (v) out.vars[name] = v.slice(0, 120);
    }
  }

  // 2) The fonts actually painted, weighted by how much text uses them.
  const counts = {};
  const textNodes = document.querySelectorAll('h1,h2,h3,p,a,button,span,li,div');
  let scanned = 0;
  for (const el of textNodes) {
    if (scanned++ > 800) break;
    const t = (el.textContent || '').trim();
    if (!t) continue;
    const cs = getComputedStyle(el);
    const fam = (cs.fontFamily || '').split(',')[0].replace(/["']/g, '').trim();
    if (!fam) continue;
    const tag = el.tagName.toLowerCase();
    const isHeading = tag === 'h1' || tag === 'h2' || tag === 'h3';
    const key = fam + '|' + (isHeading ? 'heading' : 'body');
    counts[key] = (counts[key] || 0) + Math.min(t.length, 200);
  }
  out.fonts = counts;

  // 3) Colours as painted on the elements that carry brand identity: the primary buttons
  //    and links a visitor is meant to click. A CTA's resolved background is the single
  //    most reliable brand colour on any page.
  const cta = document.querySelectorAll(
    'button, a[class*="btn"], a[class*="button"], [class*="cta"], [role="button"], header a');
  let n = 0;
  for (const el of cta) {
    if (n++ > 120) break;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.width < 24 || r.height < 12) continue;   // icons and hidden nodes
    out.swatches.push({
      bg: cs.backgroundColor, fg: cs.color,
      border: cs.borderTopColor,
      area: Math.round(r.width * r.height),
      tag: el.tagName.toLowerCase()
    });
  }
  return out;
}
"""


async def render(url: str, screenshot: bool = True, full_page: bool = False) -> dict:
    """Render `url` in headless Chromium.

    Returns {"html", "computed", "screenshot", "error"} - every key always present, with
    empty values when rendering could not happen. Never raises: the caller treats a failed
    render as "no extra information", not as an error worth failing onboarding over.
    """
    blank = {"html": "", "computed": {}, "screenshot": None, "error": ""}
    if not url:
        return {**blank, "error": "no url"}
    if not is_available():
        return {**blank, "error": "playwright not installed"}

    try:
        from playwright.async_api import async_playwright
    except ImportError as e:
        return {**blank, "error": "playwright import failed: %s" % e}

    browser = None
    try:
        async with async_playwright() as pw:
            try:
                browser = await pw.chromium.launch(
                    headless=True,
                    args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"])
            except Exception as e:
                # Playwright installed but `playwright install chromium` never run.
                return {**blank, "error": "chromium unavailable: %s" % str(e)[:160]}

            ctx = await browser.new_context(
                viewport=VIEWPORT, user_agent=_UA,
                ignore_https_errors=True,
                # Deterministic rendering: an animated hero mid-transition produces a
                # different screenshot and different computed colours on every run.
                reduced_motion="reduce",
            )
            page = await ctx.new_page()
            page.set_default_timeout(NAV_TIMEOUT_MS)

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=NAV_TIMEOUT_MS)
            except Exception as e:
                await browser.close()
                return {**blank, "error": "navigation failed: %s" % str(e)[:160]}

            # networkidle regularly never fires on sites with analytics beacons or chat
            # widgets polling forever, so it is best-effort with a short budget and a
            # fixed settle after it. Waiting is for webfonts and hero images to paint.
            try:
                await page.wait_for_load_state("networkidle", timeout=6000)
            except Exception:
                pass
            await page.wait_for_timeout(SETTLE_MS)

            result = dict(blank)
            try:
                result["html"] = await page.content()
            except Exception:
                pass
            try:
                result["computed"] = await page.evaluate(_COLLECT_JS)
            except Exception as e:
                result["error"] = "computed styles failed: %s" % str(e)[:120]
            if screenshot:
                try:
                    # JPEG, not PNG: this is fed to a vision model, where a 200KB JPEG and a
                    # 2MB PNG are read identically but cost very different upload time.
                    result["screenshot"] = await page.screenshot(
                        type="jpeg", quality=72, full_page=full_page)
                except Exception as e:
                    result["error"] = (result["error"] + "; screenshot failed: %s"
                                       % str(e)[:120]).strip("; ")

            await browser.close()
            return result

    except Exception as e:
        if browser:
            try:
                await browser.close()
            except Exception:
                pass
        return {**blank, "error": "render failed: %s" % str(e)[:200]}


def _css_colour_to_hex(value: str) -> str:
    """'rgb(255, 81, 5)' / 'rgba(...)' -> '#ff5105'. '' for transparent or unparseable."""
    from core.brand_kit import _norm_hex
    v = (value or "").strip().lower()
    if not v or v in ("transparent", "none", "inherit", "currentcolor"):
        return ""
    # Fully transparent paints nothing, whatever its RGB claims to be.
    import re as _re
    m = _re.match(r"rgba\(\s*[\d.]+[,\s]+[\d.]+[,\s]+[\d.]+[,\s/]+([\d.]+)\s*\)", v)
    if m and float(m.group(1)) < 0.1:
        return ""
    return _norm_hex(v)


def computed_color_tokens(computed: dict, limit: int = 6) -> list:
    """Brand colour tokens from what the browser actually PAINTED.

    The ordering here is the whole value of this function, and the obvious version of it is
    wrong. Reading :root custom properties first looks right - they carry names and roles -
    but a real storefront resolves 100-370 of them, nearly all belonging to Bootstrap,
    Shopify theme frameworks and marketing plugins. Tested against live sites, that
    approach returned `Bs Info Text Emphasis` and `Unloq Post Order Voucher` as brand
    colours, and never surfaced the actual brand colour at all.

    A declared variable is a claim; paint is evidence. So painted CTA and link fills lead,
    ranked by how much screen area they cover, and :root variables are used only to NAME a
    colour that is genuinely painted. A variable nothing paints is dead theme config.
    """
    from core.brand_kit import _role_for, _pretty, is_brand_colour
    from collections import Counter

    # hex -> the most role-descriptive variable name that resolves to it.
    named: dict = {}
    for name, raw in (computed.get("vars") or {}).items():
        hex_code = _css_colour_to_hex(raw)
        if not hex_code:
            continue
        low = name.lower()
        if not any(k in low for k in ("color", "colour", "brand", "accent", "primary",
                                      "secondary", "bg", "background", "surface", "text", "fg")):
            continue
        # Prefer a name that states a brand role over a generic one, so a colour that is
        # both --bs-blue and --brand-primary is reported as the latter.
        strong = any(k in low for k in ("brand", "primary", "accent", "cta"))
        if hex_code not in named or (strong and not named[hex_code][1]):
            named[hex_code] = (name, strong)

    areas: Counter = Counter()
    for sw in (computed.get("swatches") or []):
        hex_code = _css_colour_to_hex(sw.get("bg", ""))
        if hex_code and is_brand_colour(hex_code):
            areas[hex_code] += int(sw.get("area") or 0)

    out, seen = [], set()
    for hex_code, area in areas.most_common(limit * 2):
        if hex_code in seen:
            continue
        seen.add(hex_code)
        var_name = named.get(hex_code, (None, False))[0]
        out.append({
            "name": _pretty(var_name) if var_name else ("CTA Fill" if not out
                                                        else "Interactive %d" % (len(out) + 1)),
            "hex": hex_code,
            "role": (_role_for(var_name) + " (painted)") if var_name
                    else "Buttons & links (as painted)",
            "source": "computed-cta",
        })
        if len(out) >= limit:
            break

    # Only if the page paints no qualifying CTA at all - a text-only or image-only landing
    # page - fall back to variables that at least name themselves as brand colours.
    if not out:
        for hex_code, (name, strong) in named.items():
            if not strong or not is_brand_colour(hex_code):
                continue
            out.append({"name": _pretty(name), "hex": hex_code,
                        "role": _role_for(name), "source": "computed-var"})
            if len(out) >= limit:
                break

    return out


def computed_typography(computed: dict) -> dict:
    """Display and body faces, chosen by how much text is actually set in each.

    Beats parsing @font-face: a site can ship six faces and use two. This reports the two
    it uses.
    """
    from core.brand_kit import _GENERIC_FONTS

    heading = _dominant_font(computed, "heading")
    body = _dominant_font(computed, "body")
    out = {}
    if heading:
        out["display"] = heading
    # Only report a body face when it differs from the display one - "display: Outfit,
    # body: Outfit" is noise dressed up as a finding.
    if body and body.lower() != (heading or "").lower():
        out["body"] = body
    return {k: v for k, v in out.items() if v.lower() not in _GENERIC_FONTS}


def _dominant_font(computed: dict, kind: str) -> str:
    """The most-used font family for 'heading' or 'body', by characters painted."""
    from core.brand_kit import _GENERIC_FONTS
    best, best_n = "", 0
    for key, n in (computed.get("fonts") or {}).items():
        if "|" not in key:
            continue
        fam, k = key.rsplit("|", 1)
        if k != kind or not fam or fam.lower() in _GENERIC_FONTS:
            continue
        if n > best_n:
            best, best_n = fam, n
    return best
