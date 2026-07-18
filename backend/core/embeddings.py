"""
Shared embedding + Qdrant collection helpers.

Both the write path (onboarding) and the read path (generation) must use the SAME
model and dimensions, or similarity search is meaningless. Keeping that in one
module is what guarantees it.
"""
import os
from qdrant_client.models import Distance, VectorParams

# bge-small-en-v1.5 outputs 384-dimensional vectors. The collection MUST match this;
# an earlier version of this code wrote hardcoded 1536-dim placeholder vectors, so a
# collection created back then is the wrong size and has to be recreated.
EMBEDDING_MODEL_NAME = "BAAI/bge-small-en-v1.5"
EMBEDDING_DIM = 384
COLLECTION_NAME = "brand_knowledge"

# BGE retrieval works noticeably better when the *query* (not the stored passages)
# carries this instruction prefix. Recommended by the model authors.
BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

_model = None


def get_embedding_model():
    """Load the model once per process. Constructing it per request costs seconds and
    hundreds of MB, which is why this is a module-level singleton."""
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(EMBEDDING_MODEL_NAME)
    return _model


def embed_passage(text: str) -> list[float]:
    """Embed content being stored in the knowledge base."""
    return get_embedding_model().encode(text or "").tolist()


def embed_query(text: str) -> list[float]:
    """Embed a search query (adds the BGE query instruction prefix)."""
    return get_embedding_model().encode(BGE_QUERY_PREFIX + (text or "")).tolist()


def ensure_collection(client) -> None:
    """
    Create the collection if missing. Nothing else in the codebase creates it, so
    upsert/search would otherwise fail with 404 against a non-existent collection.

    If it exists with the wrong vector size (e.g. 1536 from the old placeholder
    vectors), raise loudly rather than letting every write fail one by one.
    """
    existing = {c.name for c in client.get_collections().collections}
    if COLLECTION_NAME not in existing:
        client.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=EMBEDDING_DIM, distance=Distance.COSINE),
        )
        return

    info = client.get_collection(COLLECTION_NAME)
    size = info.config.params.vectors.size
    if size != EMBEDDING_DIM:
        raise RuntimeError(
            f"Qdrant collection '{COLLECTION_NAME}' has vector size {size}, but "
            f"{EMBEDDING_MODEL_NAME} produces {EMBEDDING_DIM}. It was likely created for the "
            f"old 1536-dim placeholder vectors. Recreate it and re-index: "
            f"client.delete_collection('{COLLECTION_NAME}') then re-run onboarding."
        )
