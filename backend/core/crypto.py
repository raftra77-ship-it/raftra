"""Encryption at rest for stored third-party credentials.

Every connector row holds a credential that can act on a customer's behalf until it is
revoked — a Google Ads refresh token mints access tokens indefinitely, a Meta long-lived
token runs for ~60 days, a WordPress application password never expires. Read access to
the database therefore meant the ability to spend a customer's ad budget or publish to
their site. These columns are now encrypted with Fernet (AES-128-CBC + HMAC), so a dump
of the table is inert without TOKEN_ENCRYPTION_KEY.

Generate a key once and set it as TOKEN_ENCRYPTION_KEY (keep it OUT of the repo):

    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

Rotation: put the new key first in a comma-separated TOKEN_ENCRYPTION_KEY. Values are
written with the first key and read with any of them, so old rows keep decrypting until
they are next written. Drop the retired key once scripts/encrypt_existing_tokens.py has
been re-run.
"""
import os
import logging

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from sqlalchemy import String, TypeDecorator

log = logging.getLogger(__name__)

_PREFIX = "enc:v1:"   # marks a value as encrypted, so plaintext rows written before this
                      # change still read back correctly instead of raising.


def _load_fernet():
    raw = (os.getenv("TOKEN_ENCRYPTION_KEY") or "").strip()
    if not raw:
        log.warning(
            "TOKEN_ENCRYPTION_KEY is not set — connector tokens (Google Ads refresh "
            "tokens, Meta access tokens, WordPress app passwords) are being stored in "
            "PLAINTEXT. Set it before connecting any real customer account."
        )
        return None
    keys = [k.strip() for k in raw.split(",") if k.strip()]
    try:
        return MultiFernet([Fernet(k) for k in keys])
    except Exception as e:
        raise RuntimeError(
            f"TOKEN_ENCRYPTION_KEY is not a valid Fernet key ({e}). Generate one with: "
            'python -c "from cryptography.fernet import Fernet; '
            'print(Fernet.generate_key().decode())"'
        ) from e


_fernet = _load_fernet()


def encrypt(value):
    """Plaintext -> 'enc:v1:<ciphertext>'. Passes through when no key is configured."""
    if value is None or value == "":
        return value
    if _fernet is None or str(value).startswith(_PREFIX):
        return value
    return _PREFIX + _fernet.encrypt(str(value).encode()).decode()


def decrypt(value):
    """Inverse of encrypt(). Rows written before this change are returned unchanged."""
    if value is None or value == "":
        return value
    s = str(value)
    if not s.startswith(_PREFIX):
        return s          # legacy plaintext row — readable until it is next written
    if _fernet is None:
        raise RuntimeError(
            "This row is encrypted but TOKEN_ENCRYPTION_KEY is not set. Restore the key; "
            "without it the stored credential cannot be recovered."
        )
    try:
        return _fernet.decrypt(s[len(_PREFIX):].encode()).decode()
    except InvalidToken as e:
        raise RuntimeError(
            "Could not decrypt a stored credential — TOKEN_ENCRYPTION_KEY does not match "
            "the key it was written with. If you rotated keys, keep the previous one in "
            "the comma-separated list."
        ) from e


class EncryptedString(TypeDecorator):
    """Transparent at-rest encryption for a String column.

    Encrypts on the way to the database and decrypts on the way out, so callers keep
    using the attribute exactly as before — no changes at any call site.
    """
    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return encrypt(value)

    def process_result_value(self, value, dialect):
        return decrypt(value)
