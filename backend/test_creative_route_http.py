"""POST /api/creative/generate over real HTTP, authenticated.

The unit tests in test_copy_validation.py prove the rules. These prove the ROUTE applies
them: that a placeholder is refused with 422 before any model or provider is touched, that a
real brief still gets through, and that no_copy reaches the stored specification.

Authentication is supplied by overriding the route's own dependencies rather than by posting
credentials, so nothing here needs a password or a live session. The database dependency is
overridden too - these tests must not reach Supabase.
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import creative_routes
import models
from core.creative.spec import CreativeSpec


class _FakeUser:
    id = 1
    email = "tester@example.test"
    role = "brand"


@pytest.fixture
def client(monkeypatch):
    """A client for the creative router alone, with auth and the DB stubbed out."""
    import auth
    import database

    app = FastAPI()
    app.include_router(creative_routes.router)
    app.dependency_overrides[auth.get_current_user] = lambda: _FakeUser()
    app.dependency_overrides[database.get_db] = lambda: None

    # The route calls this directly rather than through Depends, so it is patched here.
    monkeypatch.setattr(creative_routes, "_require_workspace",
                        lambda ws_id, db, user: models.Workspace(id=ws_id, name="DSA"))
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def spy(monkeypatch):
    """Records whether the expensive stages ran. A 422 must reach none of them."""
    calls = {"plan": 0, "create_row": 0, "run": 0, "analyze": 0}

    async def fake_plan(**kw):
        calls["plan"] += 1
        return CreativeSpec(media_type=kw.get("media_type", "image"),
                            original_prompt=kw.get("prompt", ""),
                            headline="Ace your next coding interview",
                            cta="Start Practicing Now",
                            no_copy=bool((kw.get("options") or {}).get("no_copy")))

    def fake_create_row(**kw):
        calls["create_row"] += 1
        calls["spec"] = kw["spec"]
        return 4242

    async def fake_run(*a, **kw):
        calls["run"] += 1

    async def fake_analyze(*a, **kw):
        calls["analyze"] += 1
        return CreativeSpec()

    monkeypatch.setattr(creative_routes.service, "plan", fake_plan)
    monkeypatch.setattr(creative_routes.service, "create_row", fake_create_row)
    monkeypatch.setattr(creative_routes.service, "run", fake_run)
    monkeypatch.setattr("core.creative.analyzer.analyze", fake_analyze)
    return calls


def _post(client, prompt, **extra):
    body = {"workspace_id": 4, "prompt": prompt, "type": "image"}
    body.update(extra)
    return client.post("/api/creative/generate", json=body)


# ------------------------------------------------------------------ rejection

@pytest.mark.parametrize("prompt", [
    "Brand Knowledge Generation",
    "brand knowledge generation",
    "   Brand   Knowledge   Generation   ",
    "Generate fresh ad variants.",
    "Generate fresh ad variants",
    "GENERATE FRESH AD VARIANTS.",
])
def test_placeholder_prompts_return_422(client, spy, prompt):
    r = _post(client, prompt)
    assert r.status_code == 422, r.text
    assert "placeholder" in r.json()["detail"].lower()


@pytest.mark.parametrize("prompt", ["Brand Knowledge Generation", "Generate fresh ad variants."])
def test_a_rejected_request_never_reaches_the_analyser_or_a_provider(client, spy, prompt):
    """The point of guarding at the route: a contentless prompt must cost nothing."""
    assert _post(client, prompt).status_code == 422
    assert spy["plan"] == 0, "service.plan ran for a placeholder prompt"
    assert spy["analyze"] == 0, "the analyser ran for a placeholder prompt"
    assert spy["create_row"] == 0, "a row was created for a placeholder prompt"
    assert spy["run"] == 0, "generation was scheduled for a placeholder prompt"


# ------------------------------------------------------------------ acceptance

@pytest.mark.parametrize("prompt", [
    "Instagram post promoting our DSA interview prep course",
    "Joy.",
    "Brand knowledge generation for our winter range",
    "Generate fresh ad variants for the Diwali sale",
    "make an instagram story ad for my coffee brand",
    "test",
    "generate",
])
def test_real_briefs_are_accepted(client, spy, prompt):
    """Including the two that merely CONTAIN a placeholder phrase, and the one-word brief
    that a person genuinely typed in production."""
    r = _post(client, prompt)
    assert r.status_code == 200, r.text
    assert r.json()["creative_id"] == 4242
    assert spy["plan"] == 1 and spy["create_row"] == 1 and spy["run"] == 1


def test_an_empty_prompt_is_still_rejected_by_the_schema(client, spy):
    """Unchanged behaviour: min_length=1 on the field. Confirms the new guard did not
    displace the existing validation."""
    assert _post(client, "").status_code == 422
    assert spy["plan"] == 0


# ------------------------------------------------------------------ no_copy

def test_no_copy_is_accepted_and_reaches_the_stored_spec(client, spy):
    r = _post(client, "A clean product shot on a dark desk", options={"no_copy": True})
    assert r.status_code == 200, r.text
    assert spy["spec"].no_copy is True, "no_copy did not reach the specification that is stored"


def test_no_copy_defaults_to_false_when_absent(client, spy):
    assert _post(client, "An ad for our course").status_code == 200
    assert spy["spec"].no_copy is False


@pytest.mark.parametrize("value", ["true", "1", "yes"])
def test_no_copy_accepts_string_truth_from_a_json_client(client, spy, value):
    assert _post(client, "A clean plate", options={"no_copy": value}).status_code == 200
    assert spy["spec"].no_copy is True


def test_unrelated_options_do_not_set_no_copy(client, spy):
    assert _post(client, "An ad", options={"style": "luxury"}).status_code == 200
    assert spy["spec"].no_copy is False


# ------------------------------------------------------------------ contract

def test_the_success_payload_still_carries_its_existing_fields(client, spy):
    """Preserve existing API contracts: this phase added fields, it must not remove any."""
    r = _post(client, "An ad for our DSA course")
    body = r.json()
    for key in ("success", "creative_id", "type", "status", "original_prompt",
                "optimized_prompt", "negative_prompt", "creative_spec", "aspect_ratio",
                "provider", "poll_url"):
        assert key in body, f"{key} disappeared from the generate response"
