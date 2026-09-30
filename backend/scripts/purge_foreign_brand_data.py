"""Remove knowledge a workspace inherited from a DIFFERENT brand.

A workspace can be re-pointed at a new website (Settings, or Sync Knowledge Graph with a
new URL). Until recently the re-crawl only ADDED, so everything the previous domain
produced stayed: its scraped images, the vector chunks describing them, and the workspace
name typed for it. The result is a workspace whose website says one brand and whose assets,
embeddings and name say another - which then reaches every agent, including image
generation.

`reindex_workspace` now purges on a domain change, so this is a repair for workspaces that
drifted before that existed.

Entirely domain-driven: nothing here knows or names a particular brand. What counts as
"foreign" is decided by comparing each row's own source URL against the workspace's current
company_url.

    python scripts/purge_foreign_brand_data.py <workspace_id> [--apply]

Without --apply it reports and changes nothing.
"""
import argparse
import os
import sys
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402
load_dotenv()

import database  # noqa: E402
import models  # noqa: E402


def registrable(url: str) -> str:
    """Host without www, for comparing two URLs as 'the same brand'."""
    raw = (url or "").strip()
    if not raw:
        return ""
    if "//" not in raw:
        raw = "https://" + raw
    host = (urlparse(raw).netloc or "").lower().split(":")[0]
    return host[4:] if host.startswith("www.") else host


def main(workspace_id: int, apply: bool) -> None:
    with database.SessionLocal() as db:
        ws = db.query(models.Workspace).get(workspace_id)
        if not ws:
            print(f"workspace {workspace_id} not found")
            return

        current = registrable(ws.company_url)
        print(f"  workspace {ws.id}: name={ws.name!r}  url={ws.company_url!r}")
        print(f"  current domain: {current or '(none)'}")
        if not current:
            print("  no company_url - cannot decide what is foreign. Nothing done.")
            return

        # --- scraped assets whose source is a different domain
        assets = (db.query(models.MediaAsset)
                    .filter(models.MediaAsset.workspace_id == workspace_id,
                            models.MediaAsset.source == "scraped").all())
        foreign = [a for a in assets
                   if registrable(a.source_url or a.storage_url) != current]
        kept = len(assets) - len(foreign)

        by_domain = {}
        for a in foreign:
            d = registrable(a.source_url or a.storage_url) or "(unknown)"
            by_domain[d] = by_domain.get(d, 0) + 1

        print(f"\n  scraped assets      : {len(assets)}")
        print(f"    from this domain  : {kept}  (kept)")
        print(f"    from other domains: {len(foreign)}  (remove)")
        for d, n in sorted(by_domain.items(), key=lambda kv: -kv[1]):
            print(f"       {d}: {n}")

        # Uploaded/generated assets are the user's own files and are never touched.
        others = (db.query(models.MediaAsset)
                    .filter(models.MediaAsset.workspace_id == workspace_id,
                            models.MediaAsset.source != "scraped").count())
        print(f"    user uploads      : {others}  (never touched)")

        # --- the vector chunks describing those assets
        chunks = (db.query(models.KnowledgeChunk)
                    .filter(models.KnowledgeChunk.workspace_id == workspace_id,
                            models.KnowledgeChunk.kind == "media_asset").count())
        print(f"\n  media_asset chunks  : {chunks}  (remove - they describe the removed images)")

        # --- a name that belongs to the old brand.
        # Not renamed to a guess here: extraction sets it from the site's own content on the
        # next sync. Cleared only when it plainly does not match the current domain.
        name = (ws.name or "").strip().lower()
        stale_name = bool(name) and name not in current and current.split(".")[0] not in name
        print(f"  workspace name      : {ws.name!r} -> "
              f"{'stale, will be cleared for extraction to set' if stale_name else 'consistent, kept'}")

        if not apply:
            print("\n  DRY RUN - nothing changed. Re-run with --apply to perform it.")
            return

        for a in foreign:
            db.delete(a)
        (db.query(models.KnowledgeChunk)
           .filter(models.KnowledgeChunk.workspace_id == workspace_id,
                   models.KnowledgeChunk.kind == "media_asset")
           .delete(synchronize_session=False))
        if stale_name:
            ws.name = ""
            ws.brand_color = None
        db.commit()
        print(f"\n  DONE: removed {len(foreign)} asset(s) and {chunks} chunk(s).")
        print("  Run Sync Knowledge Graph to repopulate from the current website.")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("workspace_id", type=int)
    p.add_argument("--apply", action="store_true")
    a = p.parse_args()
    main(a.workspace_id, a.apply)
