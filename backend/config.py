"""One place that decides which database this process talks to.

On 2026-11-15 a local dev server was started against backend/.env, which holds the
production Supabase DSN. Importing main.py runs create_all() and 46 ALTER/UPDATE/POLICY
statements at module level, so starting the dev server executed DDL against production.
Nothing in the codebase distinguished development from production: there was one .env,
loaded by `load_dotenv()` with no path, found by walking up from the current directory.

This module is the fix. It resolves the environment explicitly, loads config files by
absolute path rather than by proximity, and REFUSES to hand back a remote database URL
outside production. The refusal happens at import, before SQLAlchemy is configured and
long before any connection is attempted.

Resolution order for APP_ENV, most explicit first:

    1. APP_ENV                  - set it deliberately
    2. RENDER                   - Render sets this on every instance; production
    3. pytest in sys.modules    - a test run, so the loopback rule applies
    4. nothing                  - raise. Guessing is what caused the incident.

Config files are layered: backend/.env supplies API keys and other shared settings, and
backend/.env.development overrides it for development. Layering is a convenience, not the
safety mechanism - the loopback check below is, and it holds even when .env.development is
missing or a variable is forgotten.
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent

LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1", "[::1]"}
LOCAL_ENVS = {"development", "test"}
VALID_ENVS = {"development", "test", "production"}


def _app_env_from_files() -> str:
    """Read APP_ENV out of the config files without loading them.

    APP_ENV decides WHICH file to load, so it cannot simply be read back from the loaded
    environment - that is circular. A developer who writes APP_ENV=development into
    backend/.env.development and then runs uvicorn by hand would otherwise be told
    APP_ENV is not set, which is both wrong and confusing. So scan the two candidate
    files for that one key, cheaply and without side effects.
    """
    for name in (".env.development", ".env.test", ".env"):
        path = BACKEND_DIR / name
        if not path.is_file():
            continue
        try:
            for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
                line = line.strip()
                if line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                if key.strip() == "APP_ENV":
                    return value.strip().strip('"').strip("'").lower()
        except OSError:
            continue
    return ""


def _resolve_app_env() -> str:
    explicit = (os.getenv("APP_ENV") or "").strip().lower()
    if explicit:
        if explicit not in VALID_ENVS:
            raise RuntimeError(
                "APP_ENV is %r, which is not one of %s."
                % (explicit, ", ".join(sorted(VALID_ENVS)))
            )
        return explicit

    # Render sets RENDER=true on every instance. main.py already treats it as the
    # production signal, so this is a fact about the host, not an inference.
    if os.getenv("RENDER"):
        return "production"

    from_file = _app_env_from_files()
    if from_file:
        if from_file not in VALID_ENVS:
            raise RuntimeError(
                "APP_ENV in the env files is %r, which is not one of %s."
                % (from_file, ", ".join(sorted(VALID_ENVS)))
            )
        return from_file

    # A pytest run. The suites already require a loopback DSN of their own; this keeps
    # them working without asking every developer to export APP_ENV first.
    if "pytest" in sys.modules:
        return "test"

    raise RuntimeError(
        "APP_ENV is not set, and this is not a Render instance or a pytest run.\n"
        "Set it deliberately - this module will not guess which database to use:\n"
        "    APP_ENV=development   local work, loopback database only\n"
        "    APP_ENV=test          test run, loopback database only\n"
        "    APP_ENV=production    deployed instance\n"
        "A missing APP_ENV used to mean 'fall back to backend/.env', which holds the "
        "production DSN. That is the failure this check exists to prevent."
    )


def _load_env_files(app_env: str) -> list[str]:
    """Layer the config files, HIGHEST precedence first, with override=False throughout.

    python-dotenv with override=False leaves a key alone once it is set, so loading in
    descending order of precedence gives:

        real environment  >  .env.<app_env>  >  .env

    Reading .env.development first is what makes it win over .env, and keeping
    override=False everywhere is what stops either file from clobbering a variable a
    developer or a launcher set deliberately on the command line.
    """
    loaded = []
    for name in (".env.%s" % app_env, ".env"):
        path = BACKEND_DIR / name
        if path.is_file():
            load_dotenv(path, override=False)
            loaded.append(name)
    return loaded


def _host_of(url: str) -> str:
    try:
        return (urlsplit(url).hostname or "").strip()
    except ValueError:
        return ""


def _db_name_of(url: str) -> str:
    try:
        return urlsplit(url).path.lstrip("/") or "?"
    except ValueError:
        return "?"


@dataclass(frozen=True)
class Settings:
    app_env: str
    database_url: str
    env_files: tuple[str, ...]

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def db_host(self) -> str:
        return _host_of(self.database_url)

    @property
    def db_name(self) -> str:
        return _db_name_of(self.database_url)

    def describe(self) -> str:
        """Safe to print: host and database name only, never credentials."""
        return "%s -> %s/%s" % (self.app_env, self.db_host or "?", self.db_name)


def _build() -> Settings:
    app_env = _resolve_app_env()
    env_files = _load_env_files(app_env)

    database_url = (os.getenv("DATABASE_URL") or "").strip()
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL is not set (APP_ENV=%s, loaded: %s).\n"
            "For local work, create backend/.env.development from "
            "backend/.env.development.example and point DATABASE_URL at a database on "
            "127.0.0.1. There is no default and no fallback."
            % (app_env, ", ".join(env_files) or "no files")
        )

    host = _host_of(database_url)
    if app_env in LOCAL_ENVS and host not in LOOPBACK_HOSTS:
        raise RuntimeError(
            "Refusing to start.\n"
            "  APP_ENV      = %s\n"
            "  DATABASE_URL -> host %r, database %r\n"
            "\n"
            "Outside production this process may only talk to a database on 127.0.0.1, "
            "localhost or ::1. The host above is remote - this is very probably "
            "backend/.env, which holds the production Supabase DSN.\n"
            "\n"
            "Importing main.py runs create_all() and 46 schema statements at import, so "
            "starting against a remote database executes DDL on it. That happened once; "
            "this check is why it will not happen again.\n"
            "\n"
            "Point DATABASE_URL at a local database (backend/.env.development), or set "
            "APP_ENV=production if this really is the deployed instance."
            % (app_env, host or "(unparseable)", _db_name_of(database_url))
        )

    return Settings(app_env=app_env, database_url=database_url,
                    env_files=tuple(env_files))


settings = _build()
