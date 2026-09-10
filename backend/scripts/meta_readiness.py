"""
Meta Ads production-readiness check.

Everything here is read-only. It answers "can this workspace actually publish a campaign
that spends money", which is a different question from "is the connector wired up" — the
connector can be perfectly healthy while the ad account has no payment method and the app
is still in Development mode.

Run it again after each change in the Meta dashboards; the checks that are still failing
are the ones left to do.

    python -m scripts.meta_readiness            # workspace 4
    python -m scripts.meta_readiness --ws 12
"""
import argparse
import asyncio
import hashlib
import hmac
import os
import sys
import warnings

warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import httpx

GRAPH = "https://graph.facebook.com/v23.0"
# The five the OAuth flow requests (core/meta_ads.SCOPES). Publishing needs all of them:
# ads_management to create, ads_read to report, business_management for the owning
# business, and the two pages_* to attach the Page an ad is published as.
REQUIRED_SCOPES = {"ads_management", "ads_read", "business_management",
                   "pages_show_list", "pages_read_engagement"}


def _line(ok, label, detail=""):
    print(f"  [{'PASS' if ok else 'TODO'}] {label:<34} {detail}")
    return bool(ok)


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ws", type=int, default=4)
    args = ap.parse_args()

    import models
    from database import SessionLocal

    app_id = os.getenv("META_APP_ID", "")
    app_sec = os.getenv("META_APP_SECRET", "")
    if not (app_id and app_sec):
        print("META_APP_ID / META_APP_SECRET are not set — nothing to check.")
        return 1

    db = SessionLocal()
    conn = (db.query(models.MetaAdsConnection)
              .filter(models.MetaAdsConnection.workspace_id == args.ws).first())
    db.close()
    if not conn or not conn.access_token:
        print(f"Workspace {args.ws} has no Meta connection. Connect it in the dashboard first.")
        return 1

    tok = conn.access_token
    acct = conn.ad_account_id
    page = conn.page_id
    proof = hmac.new(app_sec.encode(), tok.encode(), hashlib.sha256).hexdigest()
    results = []

    print(f"\nMeta readiness — workspace {args.ws}, app {app_id}\n")
    async with httpx.AsyncClient(timeout=30) as c:
        # ---- token + granted permissions
        r = await c.get(f"{GRAPH}/debug_token",
                        params={"input_token": tok, "access_token": f"{app_id}|{app_sec}"})
        d = (r.json() or {}).get("data", {})
        results.append(_line(d.get("is_valid"), "access token valid",
                             f"type={d.get('type')} expires_at={d.get('expires_at')}"))
        granted = set(d.get("scopes") or [])
        missing = REQUIRED_SCOPES - granted
        results.append(_line(not missing, "all publish scopes granted",
                             "missing: " + ", ".join(sorted(missing)) if missing else "5/5"))

        # ---- ad account
        if not acct:
            results.append(_line(False, "ad account selected", "none chosen yet"))
        else:
            r = await c.get(f"{GRAPH}/act_{acct}", params={
                "access_token": tok, "appsecret_proof": proof,
                "fields": "name,account_status,disable_reason,currency,funding_source,"
                          "funding_source_details,is_prepay_account,business"})
            a = r.json() or {}
            results.append(_line(a.get("account_status") == 1, "ad account active",
                                 f"{a.get('name')} status={a.get('account_status')} "
                                 f"disable_reason={a.get('disable_reason')}"))
            # THE usual blocker: an account with no funding source can hold a campaign but
            # can never deliver it.
            fs = a.get("funding_source") or a.get("funding_source_details")
            results.append(_line(bool(fs), "payment method attached",
                                 str(fs)[:60] if fs else "NO funding_source — ads cannot spend"))
            # ads_management on a live app requires the account's business to be verified.
            results.append(_line(bool(a.get("business")), "owned by a Business",
                                 str(a.get("business", ""))[:60] or "not in a Business Manager"))

        # ---- page
        if not page:
            results.append(_line(False, "Facebook Page selected", "none chosen yet"))
        else:
            r = await c.get(f"{GRAPH}/{page}", params={
                "access_token": tok, "appsecret_proof": proof, "fields": "name,is_published"})
            p = r.json() or {}
            results.append(_line(p.get("is_published"), "Page published",
                                 f"{p.get('name')} is_published={p.get('is_published')}"))

        # ---- app configuration that App Review checks
        r = await c.get(f"{GRAPH}/{app_id}", params={
            "access_token": f"{app_id}|{app_sec}",
            "fields": "name,privacy_policy_url,terms_of_service_url,app_domains"})
        app = r.json() or {}
        results.append(_line(bool(app.get("privacy_policy_url")), "privacy policy URL set",
                             app.get("privacy_policy_url", "") or "required for App Review"))
        results.append(_line(bool(app.get("terms_of_service_url")), "terms URL set",
                             app.get("terms_of_service_url", "") or "required for App Review"))
        results.append(_line(bool(app.get("app_domains")), "app domains set",
                             ", ".join(app.get("app_domains") or []) or
                             "empty — set it to your frontend domain"))

    print(f"\n  {sum(1 for x in results if x)}/{len(results)} ready")
    print("""
  Two things this script CANNOT see, because Meta exposes no API for them:
    - whether the app is in Development or Live mode
    - whether Advanced Access for ads_management has passed App Review
  In Development mode the scopes above are granted to anyone holding a role on the app,
  which is why they read PASS here while an external customer would still be refused.
  Check both at: https://developers.facebook.com/apps/%s/app-review/permissions/
""" % app_id)
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
