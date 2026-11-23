"""Provider selection is what split the index, so it is the part worth pinning down.

The failure it caused was not an error anywhere. A developer machine with
sentence-transformers installed selected `local` and wrote 384-dim bge vectors; the
deployed API has no sentence-transformers, selected `gemini`, filtered on
`model == gemini-embedding-001` and found nothing. Retrieval returned [] and every caller
above it reported the workspace as having no brand knowledge.

The rule these tests hold in place: an unconfigured process picks what PRODUCTION picks,
so anything indexed locally is readable by the deploy. `local` stays available, but you
have to ask for it.
"""
import importlib

import pytest

import core.embeddings as emb


@pytest.fixture
def env(monkeypatch):
    """A process with neither variable set, and no opinion about local availability."""
    monkeypatch.delenv("EMBEDDING_PROVIDER", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    return monkeypatch


def test_explicit_local_wins_even_with_a_gemini_key(env):
    env.setenv("EMBEDDING_PROVIDER", "local")
    env.setenv("GEMINI_API_KEY", "key")
    assert emb._select_provider() == "local"


def test_explicit_gemini_wins_even_when_local_is_installed(env):
    env.setenv("EMBEDDING_PROVIDER", "gemini")
    env.setattr(emb, "_local_available", lambda: True)
    assert emb._select_provider() == "gemini"


def test_a_key_selects_gemini_even_when_local_is_installed(env):
    """The regression. This machine can run bge and used to choose it, which is exactly
    how rows were written that the deploy could not read."""
    env.setenv("GEMINI_API_KEY", "key")
    env.setattr(emb, "_local_available", lambda: True)
    assert emb._select_provider() == "gemini"


def test_no_key_falls_back_to_local_when_available(env):
    env.setattr(emb, "_local_available", lambda: True)
    assert emb._select_provider() == "local"


def test_no_key_and_no_local_still_reports_gemini(env):
    """So the failure is a clear 'GEMINI_API_KEY is not set' at embed time rather than an
    ImportError from a model that was never going to be there."""
    env.setattr(emb, "_local_available", lambda: False)
    assert emb._select_provider() == "gemini"


def test_an_unrecognised_value_is_ignored_rather_than_obeyed(env):
    """A typo must not silently select a provider: it falls through to the normal rule."""
    env.setenv("EMBEDDING_PROVIDER", "openai")
    env.setenv("GEMINI_API_KEY", "key")
    assert emb._select_provider() == "gemini"


def test_model_name_and_dim_agree_with_the_selected_provider():
    """The search filter is `model == EMBEDDING_MODEL_NAME` and the stored width is
    EMBEDDING_DIM. If those two ever disagree with the provider, every row written is
    unreadable by the process that wrote it."""
    importlib.reload(emb)
    if emb.EMBEDDING_PROVIDER == "gemini":
        assert emb.EMBEDDING_MODEL_NAME == "models/gemini-embedding-001"
        assert emb.EMBEDDING_DIM == 768
    else:
        assert emb.EMBEDDING_MODEL_NAME == "BAAI/bge-small-en-v1.5"
        assert emb.EMBEDDING_DIM == 384
