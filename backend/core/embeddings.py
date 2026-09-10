"""
Shared embedding + Qdrant collection helpers.

Both the write path (onboarding) and the read path (generation) must use the SAME
model and dimensions, or similarity search is meaningless. Keeping that in one
module is what guarantees it.

Two providers, because the local one cannot ship to production. `sentence-transformers`
pulls torch (~490MB) and the API runs on a 512MB instance, so requirements-deploy.txt
deliberately omits it — which meant `get_embedding_model()` raised ImportError there,
`rag.retrieve()` swallowed it, and every deployed "insight-grounded" answer quietly fell
back to brand-kit-only. The competitor ad vault and trend reports were being written to
Postgres and never retrieved semantically at all.

`gemini` uses the hosted embedding endpoint: no torch, no model download, and
google-generativeai is already a deploy dependency. `local` keeps bge-small for offline
work and is still the default when it is installed, so existing local collections and
their 384-dim vectors keep working untouched.

The collection name carries the provider's identity for exactly that reason. Vectors from
different models are not comparable, so writing Gemini's 768-dim output into the 384-dim
`brand_knowledge` collection would either error or (worse, if dims happened to match)
return confident nonsense. Separate collections mean switching provider re-indexes into a
clean namespace instead of corrupting the old one.
"""
import math
import os
from qdrant_client.models import Distance, VectorParams

# bge-small-en-v1.5 outputs 384-dimensional vectors. The collection MUST match this;
# an earlier version of this code wrote hardcoded 1536-dim placeholder vectors, so a
# collection created back then is the wrong size and has to be recreated.
_LOCAL_MODEL_NAME = "BAAI/bge-small-en-v1.5"
_LOCAL_DIM = 384

# gemini-embedding-001 — the model this project's key actually serves. (text-embedding-004
# is gone: embedContent 404s for it, and ListModels offers only the gemini-embedding-*
# family.) It takes a task_type that distinguishes storing a passage from searching with a
# query, which is the hosted equivalent of the BGE prefix below.
#
# It returns 3072 dims by default and supports Matryoshka truncation to a few documented
# widths. 768 is requested deliberately: a quarter of the storage and no measurable loss at
# this corpus size, and it matches the width most vector tooling assumes.
_GEMINI_MODEL_NAME = "models/gemini-embedding-001"
_GEMINI_DIM = 768


def _local_available() -> bool:
    """Whether sentence-transformers can actually be imported in this process.

    Checked by import machinery rather than a try/except around model construction, so
    provider selection costs nothing and does not download a model as a side effect.
    """
    try:
        import importlib.util
        return importlib.util.find_spec("sentence_transformers") is not None
    except Exception:
        return False


def _select_provider() -> str:
    """`EMBEDDING_PROVIDER` wins when set; otherwise prefer local, fall back to Gemini.

    Preferring local keeps every existing development machine on the same vectors it
    already has indexed. Production has no sentence-transformers and lands on Gemini.
    """
    explicit = (os.getenv("EMBEDDING_PROVIDER") or "").strip().lower()
    if explicit in ("local", "gemini"):
        return explicit
    if _local_available():
        return "local"
    return "gemini"


EMBEDDING_PROVIDER = _select_provider()

if EMBEDDING_PROVIDER == "gemini":
    EMBEDDING_MODEL_NAME = _GEMINI_MODEL_NAME
    EMBEDDING_DIM = _GEMINI_DIM
    # Suffixed, so it can never be confused with a 384-dim local collection.
    COLLECTION_NAME = "brand_knowledge_gemini_768"
else:
    EMBEDDING_MODEL_NAME = _LOCAL_MODEL_NAME
    EMBEDDING_DIM = _LOCAL_DIM
    # Unchanged name: existing local collections stay valid.
    COLLECTION_NAME = "brand_knowledge"

# BGE retrieval works noticeably better when the *query* (not the stored passages)
# carries this instruction prefix. Recommended by the model authors.
BGE_QUERY_PREFIX = "Represent this sentence for searching relevant passages: "

_model = None
_gemini_ready = False


def get_embedding_model():
    """Load the local model once per process. Constructing it per request costs seconds and
    hundreds of MB, which is why this is a module-level singleton.

    Returns None under the Gemini provider — there is no local model to preload. Callers
    that only warm the cache (main.py's startup preload) can ignore the return value.
    """
    global _model
    if EMBEDDING_PROVIDER == "gemini":
        return None
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer(_LOCAL_MODEL_NAME)
    return _model


def _configure_gemini():
    """Configure the client once. Raises if no key is set, rather than returning a zero
    vector — a silent zero vector would be indexed and then match everything equally."""
    global _gemini_ready
    if _gemini_ready:
        return
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise RuntimeError(
            "EMBEDDING_PROVIDER is 'gemini' but GEMINI_API_KEY is not set, so the knowledge "
            "base cannot be embedded. Set the key, or install sentence-transformers and set "
            "EMBEDDING_PROVIDER=local."
        )
    import google.generativeai as genai
    genai.configure(api_key=key)
    _gemini_ready = True


def _gemini_embed(text: str, task_type: str) -> list[float]:
    _configure_gemini()
    import google.generativeai as genai
    r = genai.embed_content(model=_GEMINI_MODEL_NAME, content=text or " ",
                            task_type=task_type, output_dimensionality=_GEMINI_DIM)
    vec = list(r["embedding"] if isinstance(r, dict) else r.embedding)
    if len(vec) != EMBEDDING_DIM:
        # Guards against a model revision changing width underneath us: better to fail the
        # one write than to put a mis-sized vector into the collection.
        raise RuntimeError(f"{_GEMINI_MODEL_NAME} returned {len(vec)} dims, expected {EMBEDDING_DIM}.")
    # Truncating below the native 3072 leaves the vector off the unit sphere. Cosine
    # distance would not care, but re-normalising keeps the stored vectors well-formed for
    # any metric and matches what Google documents for the truncated widths.
    norm = math.sqrt(sum(v * v for v in vec))
    return [v / norm for v in vec] if norm else vec


def embed_passage(text: str) -> list[float]:
    """Embed content being stored in the knowledge base."""
    if EMBEDDING_PROVIDER == "gemini":
        return _gemini_embed(text, "retrieval_document")
    return get_embedding_model().encode(text or "").tolist()


def embed_query(text: str) -> list[float]:
    """Embed a search query.

    Both providers mark the text as a query rather than a passage — Gemini through
    task_type, bge through the instruction prefix — which is what keeps a short question
    comparable to the longer passages it is searching.
    """
    if EMBEDDING_PROVIDER == "gemini":
        return _gemini_embed(text, "retrieval_query")
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
            f"{EMBEDDING_MODEL_NAME} (provider '{EMBEDDING_PROVIDER}') produces {EMBEDDING_DIM}. "
            f"Either it was created for the old 1536-dim placeholder vectors, or the embedding "
            f"provider changed without re-indexing. Recreate it and re-index: "
            f"client.delete_collection('{COLLECTION_NAME}') then re-run onboarding."
        )
