"""Re-embed knowledge chunks that were written by a different embedding provider.

Why this exists
---------------
`knowledge_chunks` holds every workspace's retrievable brand knowledge, and a search only
ever compares rows whose `model` matches the provider the running process selected. That
guard is correct - a 384-dim bge vector and a 768-dim Gemini vector are not comparable -
but it fails silently: a workspace indexed by the other provider returns zero rows, and
every caller above reports "no brand knowledge" rather than "wrong index".

Measured on production before this ran: workspace 4 held exactly one brand chunk, written
by bge-small on a developer machine. The deployed API embeds with gemini-embedding-001, so
that chunk was invisible and every creative generated for the brand was grounded in the
Postgres brand facts alone.

The content is already in the table, so repairing it is a re-embed, not a re-crawl: read
`content`, embed it with the active provider, insert a new row. The stale rows are left
alone - they cost a little storage, they are never compared against the active model, and
keeping them means this script has nothing to undo if the provider is switched back.

Usage
-----
    python -m scripts.reembed_knowledge                  # dry run, every workspace
    python -m scripts.reembed_knowledge --apply          # write
    python -m scripts.reembed_knowledge --workspace 4 --apply

Set EMBEDDING_PROVIDER to the provider you are repairing TOWARDS. Running it with the
wrong provider selected would faithfully index everything into the half you are trying to
get away from, so the active model is printed first and --apply refuses without it.
"""
import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--apply", action="store_true",
                    help="actually write rows; without it nothing is changed")
    ap.add_argument("--workspace", type=int, default=None,
                    help="limit to one workspace id")
    ap.add_argument("--kind", default=None,
                    help="limit to one kind (onboarding_scrape, competitor_ad, market_trend)")
    ap.add_argument("--force-all", action="store_true",
                    help="also re-embed where the active model can already reach that "
                         "workspace/kind (by default those are left alone)")
    args = ap.parse_args()

    import models
    from database import SessionLocal
    from core.embeddings import embed_passage, EMBEDDING_MODEL_NAME, EMBEDDING_DIM

    print(f"active model : {EMBEDDING_MODEL_NAME} ({EMBEDDING_DIM} dims)")
    print(f"mode         : {'APPLY - writing rows' if args.apply else 'dry run'}")

    db = SessionLocal()
    try:
        q = db.query(models.KnowledgeChunk).filter(
            models.KnowledgeChunk.model != EMBEDDING_MODEL_NAME)
        if args.workspace is not None:
            q = q.filter(models.KnowledgeChunk.workspace_id == args.workspace)
        if args.kind:
            q = q.filter(models.KnowledgeChunk.kind == args.kind)
        stale = q.order_by(models.KnowledgeChunk.workspace_id,
                           models.KnowledgeChunk.id).all()

        if not stale:
            print("\nNothing to do: every chunk in scope is already under the active model.")
            return 0

        # Content already present under the active model. Re-running this script must not
        # keep appending duplicates of the same passage, and a partial run that was
        # interrupted has to be resumable.
        done = q.session.query(models.KnowledgeChunk.workspace_id,
                               models.KnowledgeChunk.kind,
                               models.KnowledgeChunk.content).filter(
            models.KnowledgeChunk.model == EMBEDDING_MODEL_NAME).all()
        already = {(w, k, c) for w, k, c in done}

        todo = [r for r in stale if (r.workspace_id, r.kind, r.content) not in already]
        skipped = len(stale) - len(todo)

        # A workspace/kind the active model can ALREADY reach is not broken, and the stale
        # rows beside it are almost always an older crawl of the same site rather than
        # content that is missing. Copying those across would not repair retrieval, it
        # would dilute a working index with superseded passages. Measured: workspace 12
        # holds 12 reachable chunks from a recent crawl plus 12 unreachable ones from an
        # earlier run. Only the genuinely unreachable are repaired unless --force-all.
        reachable = {(w, k) for w, k, _ in done}
        if not args.force_all:
            covered = sorted({(r.workspace_id, r.kind) for r in todo
                              if (r.workspace_id, r.kind) in reachable})
            todo = [r for r in todo if (r.workspace_id, r.kind) not in reachable]
            for w, k in covered:
                print(f"  skipping ws {w} {k}: already reachable under the active model "
                      f"(--force-all to re-embed anyway)")

        by_ws: dict = {}
        for r in todo:
            by_ws.setdefault(r.workspace_id, {}).setdefault(r.kind, 0)
            by_ws[r.workspace_id][r.kind] += 1

        print(f"\nstale rows in scope : {len(stale)}")
        print(f"already re-embedded : {skipped} (same workspace/kind/content exists)")
        print(f"to re-embed         : {len(todo)}")
        for ws_id in sorted(by_ws):
            detail = ", ".join(f"{n} {k}" for k, n in sorted(by_ws[ws_id].items()))
            print(f"  ws {ws_id}: {detail}")

        if not args.apply:
            print("\nDry run - nothing written. Re-run with --apply.")
            return 0
        if not todo:
            return 0

        written = failed = 0
        for r in todo:
            try:
                vec = embed_passage(r.content)
            except Exception as e:
                failed += 1
                print(f"  ws {r.workspace_id} chunk {r.id}: embed failed: {e}")
                continue
            db.add(models.KnowledgeChunk(
                workspace_id=r.workspace_id, kind=r.kind, content=r.content,
                embedding=vec, model=EMBEDDING_MODEL_NAME, dim=EMBEDDING_DIM,
                meta=r.meta or {},
            ))
            written += 1
            # Commit per row: an embedding call can fail part way through a long run, and
            # the rows already paid for should survive it.
            db.commit()

        print(f"\nwritten: {written}   failed: {failed}")
        return 1 if failed else 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
