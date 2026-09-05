"""One-off: encrypt connector credentials that were stored before encryption existed.

New and updated rows are encrypted automatically by models.EncryptedString. Rows written
earlier are still plaintext — readable, but plaintext. This rewrites them in place.

    cd backend
    python scripts/encrypt_existing_tokens.py --dry-run   # report only
    python scripts/encrypt_existing_tokens.py             # apply

Safe to re-run: already-encrypted values carry an "enc:v1:" marker and are skipped.
Requires TOKEN_ENCRYPTION_KEY to be set to the same key the app uses.
"""
import os
import sys
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import text                      # noqa: E402
from database import SessionLocal                # noqa: E402
from core.crypto import encrypt, _PREFIX, _fernet  # noqa: E402

TARGETS = [
    ("search_console_connections", ["refresh_token", "access_token"]),
    ("github_connections",         ["access_token"]),
    ("meta_ads_connections",       ["access_token"]),
    ("google_ads_connections",     ["access_token", "refresh_token"]),
    ("shopify_connections",        ["access_token"]),
    ("wordpress_connections",      ["app_password", "access_token"]),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="report what would change")
    args = ap.parse_args()

    if _fernet is None:
        sys.exit("TOKEN_ENCRYPTION_KEY is not set — nothing would be encrypted. Set it first.")

    db = SessionLocal()
    total = 0
    try:
        for table, cols in TARGETS:
            exists = db.execute(text("SELECT to_regclass(:t)"), {"t": table}).scalar()
            if not exists:
                print(f"{table:30} (no such table, skipped)")
                continue
            for col in cols:
                rows = db.execute(text(
                    f"SELECT id, {col} FROM {table} "
                    f"WHERE {col} IS NOT NULL AND {col} <> '' AND {col} NOT LIKE :pfx"
                ), {"pfx": _PREFIX + "%"}).fetchall()
                if not rows:
                    print(f"{table}.{col:16} already encrypted / empty")
                    continue
                print(f"{table}.{col:16} {len(rows)} plaintext row(s)"
                      + (" — would encrypt" if args.dry_run else " — encrypting"))
                if not args.dry_run:
                    for rid, val in rows:
                        db.execute(text(f"UPDATE {table} SET {col} = :v WHERE id = :i"),
                                   {"v": encrypt(val), "i": rid})
                total += len(rows)
        if args.dry_run:
            db.rollback()
            print(f"\nDry run: {total} value(s) would be encrypted. Re-run without --dry-run to apply.")
        else:
            db.commit()
            print(f"\nDone: {total} value(s) encrypted.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
