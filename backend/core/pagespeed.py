"""Core Web Vitals via Google PageSpeed Insights.

This is what turns the audit's "Performance" category from "Not Verified" into a real,
evidence-backed score. If the API is unavailable we return None so the auditor keeps
reporting Performance as Not Verified rather than estimating it.

PAGESPEED_API_KEY is optional — the API works without a key but is heavily rate-limited,
so set one (Google Cloud → APIs & Services → Credentials → API key) for reliable runs.
"""
import os
from typing import Optional

ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"


def _audit_value(audits: dict, key: str, divide_by: float = 1.0) -> Optional[float]:
    node = (audits or {}).get(key) or {}
    val = node.get("numericValue")
    if val is None:
        return None
    try:
        return round(float(val) / divide_by, 3)
    except (TypeError, ValueError):
        return None


async def fetch_core_web_vitals(url: str, strategy: str = "mobile") -> Optional[dict]:
    """Return {lcp, fcp, cls, tbt, performance_score, strategy, source} or None.

    LCP/FCP are returned in seconds, CLS unitless — matching the thresholds the
    auditor scores against.
    """
    import httpx

    params = {"url": url, "strategy": strategy, "category": "performance"}
    key = (os.getenv("PAGESPEED_API_KEY") or "").strip()
    if key:
        params["key"] = key

    try:
        # Lighthouse runs server-side and genuinely takes a while.
        async with httpx.AsyncClient(timeout=90.0) as client:
            res = await client.get(ENDPOINT, params=params)
        if res.status_code != 200:
            print(f"PageSpeed: HTTP {res.status_code} for {url}: {res.text[:160]}")
            return None
        data = res.json()
    except Exception as e:
        print(f"PageSpeed request failed for {url}: {e}")
        return None

    lh = data.get("lighthouseResult") or {}
    audits = lh.get("audits") or {}
    perf = ((lh.get("categories") or {}).get("performance") or {}).get("score")

    result = {
        "lcp": _audit_value(audits, "largest-contentful-paint", 1000.0),   # ms -> s
        "fcp": _audit_value(audits, "first-contentful-paint", 1000.0),     # ms -> s
        "cls": _audit_value(audits, "cumulative-layout-shift"),
        "tbt": _audit_value(audits, "total-blocking-time"),                # ms
        "performance_score": round(perf * 100) if isinstance(perf, (int, float)) else None,
        "strategy": strategy,
        "source": "PageSpeed Insights (Lighthouse lab data)",
    }
    # If none of the three scored metrics came back, treat it as unavailable so the
    # auditor reports "Not Verified" instead of scoring against missing data.
    if result["lcp"] is None and result["fcp"] is None and result["cls"] is None:
        return None
    return result
