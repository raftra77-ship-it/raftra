"""
The vector index, behind one interface, over two backends.

Why this module exists. The retrieval half of the RAG pipeline was wired only to Qdrant,
and Qdrant is not deployed: QDRANT_URL is http://localhost:6333, it appears only in the
local docker-compose, and `requirements-deploy.txt` reasonably omits the embedding model
too. Every call therefore raised, `rag.retrieve()` caught it and returned [], and the
deployed product answered every "insight-grounded" question from the brand kit alone. The
competitor ad vault and the trend reports were being written to Postgres on schedule and
never retrieved semantically even once.

Postgres is the one store guaranteed to be up — it holds everything else — and pgvector
0.8.2 is already installed on this project's Supabase instance, with the `pgvector` driver
already in both requirements files. So pgvector is the default, and Qdrant stays available
for anyone who wants it (VECTOR_BACKEND=qdrant).

Both backends present the same payload shape, so callers do not branch: a hit is
{content, type, score, **meta}. `type` rather than `kind` because that is the key the
Qdrant payloads already used and what rag.build_context() reads.
"""
import os
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

# 'pgvector' (default) or 'qdrant'. The default is the backend that works without extra
# infrastructure; Qdrant is opt-in precisely because it currently runs nowhere.
BACKEND = (os.getenv("VECTOR_BACKEND") or "pgvector").strip().lower()
if BACKEND not in ("pgvector", "qdrant"):
    print(f"[vector_store] unknown VECTOR_BACKEND {BACKEND!r}, falling back to pgvector")
    BACKEND = "pgvector"


# ---------------------------------------------------------------- pgvector


def _pg_upsert(workspace_id: int, kind: str, texts: List[dict],
               replace: bool, retain_days: Optional[int]) -> int:
    import models
    from database import SessionLocal
    from core.embeddings import embed_passage, EMBEDDING_MODEL_NAME, EMBEDDING_DIM

    db = SessionLocal()
    try:
        scope = (db.query(models.KnowledgeChunk)
                   .filter(models.KnowledgeChunk.workspace_id == workspace_id,
                           models.KnowledgeChunk.kind == kind,
                           models.KnowledgeChunk.model == EMBEDDING_MODEL_NAME))
        if replace:
            scope.delete(synchronize_session=False)
        elif retain_days:
            cutoff = datetime.utcnow() - timedelta(days=retain_days)
            scope.filter(models.KnowledgeChunk.indexed_at < cutoff).delete(synchronize_session=False)

        rows = []
        for t in texts:
            content = (t.get("content") or "").strip()
            if not content:
                continue
            rows.append(models.KnowledgeChunk(
                workspace_id=workspace_id, kind=kind, content=content,
                embedding=embed_passage(content),
                model=EMBEDDING_MODEL_NAME, dim=EMBEDDING_DIM,
                meta=t.get("meta") or {}, indexed_at=datetime.utcnow(),
            ))
        if rows:
            db.add_all(rows)
        db.commit()
        return len(rows)
    finally:
        db.close()


def _pg_search(workspace_id: int, query: str, kinds: List[str], limit: int) -> List[dict]:
    import models
    from database import SessionLocal
    from core.embeddings import embed_query, EMBEDDING_MODEL_NAME

    vec = embed_query(query)
    db = SessionLocal()
    try:
        q = (db.query(models.KnowledgeChunk,
                      models.KnowledgeChunk.embedding.cosine_distance(vec).label("dist"))
               .filter(models.KnowledgeChunk.workspace_id == workspace_id,
                       # Same-model only. This is what lets 384-dim and 768-dim rows share
                       # the table without ever being compared to each other.
                       models.KnowledgeChunk.model == EMBEDDING_MODEL_NAME))
        if kinds:
            q = q.filter(models.KnowledgeChunk.kind.in_(kinds))
        hits = q.order_by("dist").limit(limit).all()
        out = []
        for row, dist in hits:
            # Cosine distance is 0 (identical) to 2 (opposite); report similarity so the
            # number means the same thing as Qdrant's score.
            out.append({"content": row.content, "type": row.kind,
                        "score": round(1.0 - float(dist), 4), **(row.meta or {})})
        return out
    finally:
        db.close()


def _pg_stats(workspace_id: int) -> dict:
    import models
    from database import SessionLocal
    from sqlalchemy import func
    from core.embeddings import EMBEDDING_MODEL_NAME

    db = SessionLocal()
    try:
        rows = (db.query(models.KnowledgeChunk.kind, func.count().label("n"))
                  .filter(models.KnowledgeChunk.workspace_id == workspace_id,
                          models.KnowledgeChunk.model == EMBEDDING_MODEL_NAME)
                  .group_by(models.KnowledgeChunk.kind).all())
        return {"total": sum(r.n for r in rows), "by_kind": {r.kind: r.n for r in rows}}
    finally:
        db.close()


# ---------------------------------------------------------------- qdrant


def _qd_upsert(workspace_id: int, kind: str, texts: List[dict],
               replace: bool, retain_days: Optional[int]) -> int:
    from database import qdrant_client
    from qdrant_client.models import PointStruct, Filter, FieldCondition, MatchValue, Range
    from core.embeddings import embed_passage, ensure_collection, COLLECTION_NAME

    ensure_collection(qdrant_client)
    scope = [FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id)),
             FieldCondition(key="type", match=MatchValue(value=kind))]
    if replace:
        qdrant_client.delete(collection_name=COLLECTION_NAME, points_selector=Filter(must=scope))
    elif retain_days:
        cutoff = int((datetime.utcnow() - timedelta(days=retain_days)).timestamp())
        qdrant_client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=Filter(must=scope + [FieldCondition(key="indexed_ts", range=Range(lt=cutoff))]))

    now = datetime.utcnow()
    stamp = {"indexed_at": now.isoformat(), "indexed_ts": int(now.timestamp())}
    points = [
        PointStruct(id=str(uuid.uuid4()), vector=embed_passage(t["content"]),
                    payload={"workspace_id": workspace_id, "type": kind,
                             "content": t["content"], **stamp, **(t.get("meta") or {})})
        for t in texts if (t.get("content") or "").strip()
    ]
    if points:
        qdrant_client.upsert(collection_name=COLLECTION_NAME, points=points)
    return len(points)


def _qd_search(workspace_id: int, query: str, kinds: List[str], limit: int) -> List[dict]:
    from database import qdrant_client
    from qdrant_client.models import Filter, FieldCondition, MatchValue, MatchAny
    from core.embeddings import embed_query, ensure_collection, COLLECTION_NAME

    ensure_collection(qdrant_client)
    must = [FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id))]
    if kinds:
        must.append(FieldCondition(key="type", match=MatchAny(any=list(kinds))))
    res = qdrant_client.query_points(
        collection_name=COLLECTION_NAME, query=embed_query(query),
        query_filter=Filter(must=must), limit=limit, with_payload=True).points
    return [{**(p.payload or {}), "score": round(float(p.score), 4)} for p in res]


def _qd_stats(workspace_id: int) -> dict:
    from database import qdrant_client
    from qdrant_client.models import Filter, FieldCondition, MatchValue
    from core.embeddings import COLLECTION_NAME

    f = Filter(must=[FieldCondition(key="workspace_id", match=MatchValue(value=workspace_id))])
    total = qdrant_client.count(collection_name=COLLECTION_NAME, count_filter=f, exact=True).count
    return {"total": total, "by_kind": {}}


# ---------------------------------------------------------------- public API


def upsert(workspace_id: int, kind: str, texts: List[dict],
           replace: bool = False, retain_days: Optional[int] = None) -> int:
    """Index passages for one workspace and kind. Returns how many were written.

    Never raises. A vector store that is down must not lose the relational rows the caller
    already committed — that was the original contract in intel_sync and it is kept here.
    """
    if not texts:
        return 0
    try:
        fn = _pg_upsert if BACKEND == "pgvector" else _qd_upsert
        return fn(workspace_id, kind, texts, replace, retain_days)
    except Exception as e:
        print(f"[vector_store:{BACKEND}] indexing {kind} failed for workspace {workspace_id}: {e}")
        return 0


def search(workspace_id: int, query: str, kinds: List[str], limit: int = 5) -> List[dict]:
    """Semantic search within ONE workspace, restricted to the given kinds.

    The workspace filter is applied by this module and is not a caller argument that can be
    omitted — that is what keeps one tenant's ad vault out of another's answers.
    """
    try:
        fn = _pg_search if BACKEND == "pgvector" else _qd_search
        return fn(workspace_id, query, kinds, limit)
    except Exception as e:
        print(f"[vector_store:{BACKEND}] retrieval failed for workspace {workspace_id}: {e}")
        return []


def stats(workspace_id: int) -> dict:
    """Indexed-chunk counts, for the knowledge-base status surface."""
    try:
        fn = _pg_stats if BACKEND == "pgvector" else _qd_stats
        return fn(workspace_id)
    except Exception as e:
        print(f"[vector_store:{BACKEND}] stats failed for workspace {workspace_id}: {e}")
        return {"total": 0, "by_kind": {}}
