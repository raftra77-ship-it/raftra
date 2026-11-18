"""The access log must not carry credentials.

The case that matters is the Google OAuth callback: it arrives with a live `code` and a
signed `state` JWT in the query string, and uvicorn logs the request line verbatim. These
tests pin both the string rewriting and the logging.Filter that applies it, including the
real record shape uvicorn produces.
"""
import logging

import pytest

from log_redaction import (REDACTED, QueryStringRedactionFilter, install,
                           redact_query_string)

# The shape uvicorn's h11 implementation emits, verified against its source:
#   access_logger.info('%s - "%s %s HTTP/%s" %d', client, method, path_qs, version, status)
UVICORN_FMT = '%s - "%s %s HTTP/%s" %d'

REAL_CALLBACK = (
    "/api/auth/oauth/google/callback"
    "?state=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJwdXJwb3NlIjoib2F1dGhfc3RhdGUifQ.sig"
    "&iss=https://accounts.google.com"
    "&code=4/0AUn6Hd_wQXy1fU_P5SR-hICBD0MbiVwLJl2nZlKUmJgxH74ldHxZaljP0sBNa5FD4KcWgA"
    "&scope=email+profile&authuser=0&prompt=none"
)


# ------------------------------------------------------------------ the rewriting

def test_the_real_callback_loses_its_code_and_state():
    out = redact_query_string(REAL_CALLBACK)
    assert "4/0AUn6Hd_wQXy1fU" not in out, "the authorization code survived"
    assert "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" not in out, "the state JWT survived"
    assert "code=%s" % REDACTED in out
    assert "state=%s" % REDACTED in out


def test_the_rest_of_the_line_is_untouched():
    out = redact_query_string(REAL_CALLBACK)
    assert out.startswith("/api/auth/oauth/google/callback?")
    assert "iss=https://accounts.google.com" in out
    assert "scope=email+profile" in out
    assert "authuser=0" in out
    assert "prompt=none" in out


def test_a_path_without_a_query_string_is_returned_unchanged():
    for p in ("/api/workspaces", "/health", "", "/api/chat/4/12"):
        assert redact_query_string(p) == p


@pytest.mark.parametrize("param", [
    "code", "state", "token", "access_token", "refresh_token", "id_token",
    "client_secret", "api_key", "secret", "password", "signature", "session",
])
def test_every_named_parameter_is_redacted(param):
    assert redact_query_string("/x?%s=sensitive" % param) == "/x?%s=%s" % (param, REDACTED)


def test_matching_is_case_insensitive():
    assert redact_query_string("/x?CODE=abc") == "/x?CODE=%s" % REDACTED
    assert redact_query_string("/x?Access_Token=abc") == "/x?Access_Token=%s" % REDACTED


def test_ordinary_parameters_are_left_alone():
    """Over-redaction makes a log useless in a different way, so this is pinned too."""
    q = "/api/creative/jobs/187?workspace_id=4&monkey=1&keyboard=x&page=2"
    assert redact_query_string(q) == q


def test_an_empty_value_is_not_rewritten():
    assert redact_query_string("/x?code=") == "/x?code="


def test_a_valueless_flag_is_not_rewritten():
    assert redact_query_string("/x?code&b=2") == "/x?code&b=2"


def test_only_the_first_question_mark_splits_the_query():
    out = redact_query_string("/x?code=a?b&z=1")
    assert out == "/x?code=%s&z=1" % REDACTED


# ------------------------------------------------------------------ the filter

def _record(*args):
    return logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1,
                             UVICORN_FMT, args, None)


def test_the_filter_rewrites_a_real_uvicorn_record():
    rec = _record("127.0.0.1:54623", "GET", REAL_CALLBACK, "1.1", 307)
    assert QueryStringRedactionFilter().filter(rec) is True
    line = rec.getMessage()
    assert "4/0AUn6Hd_wQXy1fU" not in line
    assert "code=%s" % REDACTED in line
    assert "state=%s" % REDACTED in line
    # the parts an operator actually needs are still there
    assert "127.0.0.1:54623" in line and "GET" in line and "307" in line


def test_the_filter_leaves_an_ordinary_record_completely_alone():
    rec = _record("127.0.0.1:1", "GET", "/api/workspaces", "1.1", 200)
    before = rec.args
    QueryStringRedactionFilter().filter(rec)
    assert rec.args is before, "args were rebuilt for a record with nothing to redact"


def test_the_filter_never_raises_on_an_odd_record():
    """A logging failure mid-request would be worse than an unredacted line."""
    for args in (None, (), ("only-one",), (object(), 5), "not-a-tuple"):
        rec = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1,
                                "%s", args, None)
        assert QueryStringRedactionFilter().filter(rec) is True


def test_the_filter_finds_the_path_wherever_it_sits():
    """uvicorn's HTTP and WebSocket paths build records differently; the filter scans
    every string argument rather than trusting one position."""
    rec = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1,
                            "%s %s", ("/ws?token=supersecret", "accepted"), None)
    QueryStringRedactionFilter().filter(rec)
    assert "supersecret" not in rec.getMessage()


# ------------------------------------------------------------------ installation

def test_install_attaches_once_and_is_idempotent():
    name = "test.redaction.install"
    logging.getLogger(name).filters.clear()
    assert install((name,)) == [name]
    assert install((name,)) == [], "a second install added a duplicate filter"
    assert sum(isinstance(f, QueryStringRedactionFilter)
               for f in logging.getLogger(name).filters) == 1
    logging.getLogger(name).filters.clear()


def test_an_installed_filter_redacts_what_the_logger_emits(caplog):
    name = "test.redaction.emit"
    logger = logging.getLogger(name)
    logger.filters.clear()
    install((name,))
    with caplog.at_level(logging.INFO, logger=name):
        logger.info(UVICORN_FMT, "127.0.0.1:1", "GET", REAL_CALLBACK, "1.1", 307)
    text = caplog.text
    assert "4/0AUn6Hd_wQXy1fU" not in text
    assert REDACTED in text
    logger.filters.clear()
