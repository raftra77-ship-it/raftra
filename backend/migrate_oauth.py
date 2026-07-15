"""One-off migration: add social-login and password-reset columns to users.

Run once: python migrate_oauth.py
"""
import os
from dotenv import load_dotenv

# Load backend/.env regardless of the directory the script is run from.
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from sqlalchemy import text
from database import engine

STATEMENTS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP",
]

if __name__ == "__main__":
    with engine.begin() as conn:
        for stmt in STATEMENTS:
            conn.execute(text(stmt))
            print(f"OK: {stmt}")
    print("Migration complete.")
