# -*- coding: utf-8 -*-
"""Re-generate campaign creatives that are still Pollinations hotlinks.

Campaigns created before the Creative Studio pipeline was wired into campaign_graph store
`https://image.pollinations.ai/prompt/<the prompt>` in metrics.image_url. That is not an
image this product holds — it is a link to a free service that renders the picture on demand.
It works today, and it stops working whenever that service does, changes its URL scheme, or
rate-limits the referrer. It is also the lower-quality provider: measured against the router's
choice on one prompt, 768x768 / 52KB versus 1024x1024 / 846KB.

This regenerates each one through the same path new campaigns use — service.plan for brand
context, the optimizer for the prompt and negative prompt, the routed provider — and stores
the bytes, so the campaign owns its creative.

Deliberately careful, because it rewrites rows in a live workspace:

  * Only touches metrics.image_url, and only when it currently points at pollinations.ai.
    Anything already stored, empty, or from another source is skipped untouched.
  * The previous URL is kept in metrics.image_url_previous, so a bad regeneration is
    recoverable without a database restore.
  * A failure on one campaign leaves that row exactly as it was and moves on.
  * Resumable: rows already converted no longer match, so re-running continues where it
    stopped rather than redoing work.

Usage:
    python scripts/backfill_campaign_creatives.py --workspace 4 [--limit N] [--dry-run]
"""
import argparse
import asyncio
import base64
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

import database
import models


def _is_hotlink(url: str) -> bool:
    return bool(url) and "pollinations.ai" in url


async def _regenerate(workspace_id: int, campaign) -> str:
    """One campaign's creative, through the pipeline new campaigns use. Returns a stored URL."""
    from core.creative.service import service as creative_service, _image_provider
    from core.creative import optimizer as creative_optimizer
    from agents.creative_nodes.router import router_decision_engine
    from storage import store_bytes

    m = campaign.metrics or {}
    brief = (f"{campaign.name or 'Ad campaign'}. "
             f"{m.get('objective') or campaign.objective or ''} campaign "
             f"for {str(m.get('audience') or '')[:300]}.")

    cspec = await creative_service.plan(workspace_id=workspace_id, prompt=brief,
                                        media_type="image", platform="facebook",
                                        placement="feed")
    prompts = creative_optimizer.build_prompts(cspec)
    provider = router_decision_engine("conversion", brief)["image_provider"]
    url = await _image_provider(provider).generate_image(
        prompts["image_prompt"],
        aspect_ratio=prompts["aspect_ratio"],
        negative_prompt=prompts["negative_prompt"],
    )
    if not url:
        raise RuntimeError("provider returned no image")
    if url.startswith("data:"):
        header, _, b64 = url.partition(",")
        content_type = header.split(";")[0].replace("data:", "") or "image/png"
        raw = base64.b64decode(b64)
        url = store_bytes(raw, f"campaign-creative.{content_type.split('/')[-1]}",
                          content_type, workspace_id=workspace_id, category="creatives")
    return url


async def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--workspace", type=int, required=True)
    ap.add_argument("--limit", type=int, default=0, help="0 = all")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    db = database.SessionLocal()
    rows = (db.query(models.Campaign)
              .filter(models.Campaign.workspace_id == args.workspace)
              .order_by(models.Campaign.id).all())
    matching = [c for c in rows if _is_hotlink((c.metrics or {}).get("image_url", ""))]
    targets = matching[:args.limit] if args.limit else matching

    # Reports the real backlog and what this run will attempt separately — printing only
    # len(targets) made a --limit 2 run announce "2 still hotlinked" out of 36, which reads
    # as the job being finished when it has barely started.
    print("workspace %s: %d campaigns, %d still hotlinked, %d in this run"
          % (args.workspace, len(rows), len(matching), len(targets)))
    if args.dry_run:
        for c in targets:
            print("  would regenerate id=%-4s %s" % (c.id, (c.name or "")[:50]))
        db.close()
        return 0
    if not targets:
        print("nothing to do.")
        db.close()
        return 0

    ok = failed = 0
    t0 = time.time()
    for i, camp in enumerate(targets, 1):
        old = (camp.metrics or {}).get("image_url", "")
        try:
            new_url = await _regenerate(args.workspace, camp)
            m = dict(camp.metrics or {})
            m["image_url"] = new_url
            m["image_url_previous"] = old          # recoverable without a restore
            camp.metrics = m
            db.commit()
            ok += 1
            print("  [%2d/%2d] id=%-4s OK   %s" % (i, len(targets), camp.id, new_url[:64]))
        except Exception as e:
            db.rollback()
            failed += 1
            print("  [%2d/%2d] id=%-4s FAIL %s  (left unchanged)"
                  % (i, len(targets), camp.id, str(e)[:90]))
        # Courtesy gap so a burst does not trip the provider's rate limit and turn the
        # remainder of the run into failures.
        await asyncio.sleep(2)

    print("\ndone in %.0fs — %d regenerated, %d left unchanged" % (time.time() - t0, ok, failed))
    db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
