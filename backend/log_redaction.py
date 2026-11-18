"""Keep credentials out of the access log.

uvicorn's access logger writes the full request line, query string included:

    self.access_logger.info('%s - "%s %s HTTP/%s" %d',
                            client_addr, method,
                            get_path_with_query_string(scope),   # <- args[2]
                            http_version, status)

Nothing in this repository configured that logger, so every query parameter was printed
verbatim. The Google sign-in callback carries both a single-use authorization `code` and
the signed `state` JWT, so a completed sign-in put a live credential into the log - seen
twice while working on this, in logs that get copied into terminals, tickets and bug
reports.

A logging.Filter is the right tool rather than middleware: the line is written by uvicorn
itself, after the response leaves the application, so middleware never sees it.

Scope is deliberately narrow. Only values of named-sensitive query parameters are
replaced; the path, method, status and every other parameter stay intact, so the log is
still useful for debugging. Nothing in a request body or a header is touched here -
neither is logged today, and widening this to cover them would be a different change.
"""
from __future__ import annotations

import logging

REDACTED = "REDACTED"

# Lower-cased. Deliberately not a substring match on "key" or "id": `workspace_id` and
# `monkey` are not secrets, and over-redaction makes a log useless in its own way.
SENSITIVE_PARAMS = frozenset({
    "code",             # OAuth authorization code - single use, but live until exchanged
    "state",            # this app signs a JWT into it (purpose, role, nonce, exp)
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "client_secret",
    "api_key",
    "apikey",
    "secret",
    "password",
    "passwd",
    "pwd",
    "signature",
    "sig",
    "session",
    "auth",
})


def redact_query_string(value: str) -> str:
    """Replace the values of sensitive parameters in a path?query string.

    Returns the input unchanged when there is no query string, so the common case costs
    one `in` test. Malformed pairs are left exactly as they are rather than guessed at.
    """
    if not value or "?" not in value:
        return value
    path, _, query = value.partition("?")
    if not query:
        return value
    out = []
    for pair in query.split("&"):
        key, eq, val = pair.partition("=")
        if eq and val and key.strip().lower() in SENSITIVE_PARAMS:
            out.append("%s=%s" % (key, REDACTED))
        else:
            out.append(pair)
    return "%s?%s" % (path, "&".join(out))


class QueryStringRedactionFilter(logging.Filter):
    """Rewrites sensitive query-string values on a log record before it is formatted.

    Every string argument is scanned rather than only args[2]. uvicorn's HTTP and
    WebSocket paths build their records differently, and a filter that hard-codes one
    position silently stops working when the other is used or when the format changes.
    A filter must never raise - a logging failure during a request would be far worse
    than an unredacted line - so anything unexpected leaves the record untouched.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            args = record.args
            if isinstance(args, tuple) and args:
                changed = False
                new = []
                for a in args:
                    if isinstance(a, str) and "?" in a:
                        r = redact_query_string(a)
                        changed = changed or (r != a)
                        new.append(r)
                    else:
                        new.append(a)
                if changed:
                    record.args = tuple(new)
            elif isinstance(record.msg, str) and "?" in record.msg and not args:
                record.msg = redact_query_string(record.msg)
        except Exception:
            pass
        return True


def install(logger_names: tuple[str, ...] = ("uvicorn.access",)) -> list[str]:
    """Attach the filter, skipping any logger that already has one.

    Called from main.py at import. uvicorn configures its loggers in Config.__init__,
    before it imports the application, so a filter added here is not overwritten.
    Returns the loggers it attached to, for the caller to report.
    """
    attached = []
    for name in logger_names:
        logger = logging.getLogger(name)
        if any(isinstance(f, QueryStringRedactionFilter) for f in logger.filters):
            continue
        logger.addFilter(QueryStringRedactionFilter())
        attached.append(name)
    return attached
