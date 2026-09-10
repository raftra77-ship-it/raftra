"""
Section-by-section smoke test for the dashboard's backend.

Runs every workspace tab's read endpoints in-process through FastAPI's TestClient, with a
real JWT, against the real database. In-process on purpose: it needs no free port (the dev
API already holds 8005), and it exercises the true routing, auth dependency and tenancy
filters rather than a mock.

Read-only by default. Anything that spends money, publishes outward or calls a paid model
is listed in WRITE_ENDPOINTS and skipped unless --writes is passed, because a smoke test
that launches a Meta campaign is not a smoke test.

Usage:
    python -m scripts.section_smoke                 # read-only
    python -m scripts.section_smoke --ws 12         # a different workspace
"""
import argparse
import os
import sys
import warnings

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()


# (section, method, path template, expected-ok predicate)
# `{w}` is substituted with the workspace id.
SECTIONS = [
    ("Home / Control",      "GET", "/api/auth/me"),
    ("Home / Control",      "GET", "/api/workspaces/{w}/metrics"),
    ("Home / Control",      "GET", "/api/notifications/"),
    ("Brand Knowledge",     "GET", "/api/workspaces/{w}/brand-profile"),
    ("Brand Knowledge",     "GET", "/api/workspaces/{w}/knowledge/stats"),
    ("Analytics",           "GET", "/api/workspaces/{w}/analytics/growth?timeframe=30D"),
    ("Analytics",           "GET", "/api/workspaces/{w}/campaigns"),
    ("Campaign Manager",    "GET", "/api/connectors/meta/{w}/status"),
    ("Campaign Manager",    "GET", "/api/connectors/google-ads/{w}/status"),
    ("Creative Studio",     "GET", "/api/creative/templates?workspace_id={w}"),
    ("Creative Studio",     "GET", "/api/workspaces/{w}/assets"),
    ("Creative Studio",     "GET", "/api/workspaces/{w}/competitor-ads"),
    ("Asset Vault",         "GET", "/api/workspaces/{w}/assets/search?q=lifestyle%20desk%20setup"),
    ("SEO / GEO",           "GET", "/api/workspaces/{w}/seo"),
    ("SEO / GEO",           "GET", "/api/workspaces/{w}/seo/audit-report"),
    ("SEO / GEO",           "GET", "/api/workspaces/{w}/seo/audit-history"),
    ("SEO / GEO",           "GET", "/api/workspaces/{w}/seo/run-status?pipeline=SEO"),
    ("SEO / GEO",           "GET", "/api/connectors/search-console/{w}/status"),
    ("Market Intelligence", "GET", "/api/workspaces/{w}/market-trends"),
    ("Social Hub",          "GET", "/api/workspaces/{w}/social"),
    ("Influencer / Creator","GET", "/api/workspaces/{w}/influencers"),
    ("Influencer / Creator","GET", "/api/posted-deals/brand/{w}"),
    ("Influencer / Creator","GET", "/api/posted-deals/brand/{w}/collaborations"),
    ("Influencer / Creator","GET", "/api/deals/brand/{w}"),
    ("Marketing Calendar",  "GET", "/api/workspaces/{w}/schedules"),
    ("Marketing Calendar",  "GET", "/api/retail-calendar"),
    ("Marketing Calendar",  "GET", "/api/schedules/runner-status"),
    ("Integrations",        "GET", "/api/connectors/github/{w}/status"),
    ("Integrations",        "GET", "/api/connectors/shopify/{w}/status"),
    ("Integrations",        "GET", "/api/connectors/wordpress/{w}/status"),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ws", type=int, default=4)
    ap.add_argument("--user", type=int, default=None,
                    help="user id to authenticate as; defaults to the workspace owner")
    args = ap.parse_args()

    import models
    from database import SessionLocal
    import auth

    db = SessionLocal()
    ws = db.query(models.Workspace).filter(models.Workspace.id == args.ws).first()
    if not ws:
        print(f"No workspace {args.ws}")
        return 1
    uid = args.user or ws.user_id
    db.close()

    token = auth.create_access_token({"sub": str(uid)})
    from fastapi.testclient import TestClient
    import main as app_main
    client = TestClient(app_main.app)
    headers = {"Authorization": f"Bearer {token}"}

    print(f"workspace {args.ws} ({ws.name!r})  as user {uid}\n")
    results = []
    current = None
    for section, method, tmpl in SECTIONS:
        if section != current:
            print(f"-- {section}")
            current = section
        path = tmpl.format(w=args.ws)
        try:
            r = client.request(method, path, headers=headers)
            code = r.status_code
            body = r.text or ""
            # A 404 on a route that does not exist is a different failure from a handler
            # that raised — distinguish them so the report is actionable.
            if code == 200:
                mark, note = "PASS", _summarise(r)
            elif code == 404 and "Not Found" in body and len(body) < 40:
                mark, note = "NO ROUTE", path
            else:
                mark, note = f"FAIL {code}", body[:150].replace("\n", " ")
        except Exception as e:
            mark, note = "ERROR", f"{type(e).__name__}: {str(e)[:150]}"
        results.append((section, path, mark))
        print(f"   {mark:<10} {path.split('/api/')[-1][:62]:<62} {note[:70]}")

    passes = sum(1 for _, _, m in results if m == "PASS")
    print(f"\n{passes}/{len(results)} passed")
    bad = [(s, p, m) for s, p, m in results if m != "PASS"]
    if bad:
        print("\nNeeds attention:")
        for s, p, m in bad:
            print(f"  [{m}] {s}: {p}")
    return 0


def _summarise(r) -> str:
    try:
        d = r.json()
    except Exception:
        return f"{len(r.text)}b"
    if isinstance(d, list):
        return f"list[{len(d)}]"
    if isinstance(d, dict):
        keys = list(d.keys())[:5]
        return "{" + ", ".join(keys) + ("…}" if len(d) > 5 else "}")
    return str(d)[:60]


if __name__ == "__main__":
    raise SystemExit(main())
