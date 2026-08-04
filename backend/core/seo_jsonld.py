"""Deterministic JSON-LD builder — Organization schema built directly from the workspace's own
real fields (name, company_url, brand_logo). No LLM involved: schema facts must never be
invented, so this only ever emits what's actually in the database."""
import json


def build_organization_jsonld(name: str, url: str, logo: str | None = None) -> str:
    url = url.strip()
    if url and not url.lower().startswith(("http://", "https://")):
        url = f"https://{url}"
    data = {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": name,
        "url": url,
    }
    if logo:
        data["logo"] = logo
    return json.dumps(data, indent=2)
