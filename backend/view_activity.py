"""View the user activity log — who registered, logged in, or reset their password.

The app records these events in the `auth_events` table. This script prints the
most recent events and also writes them to `activity_log.csv` (open it in Excel).

Usage (run from the backend folder):
    python view_activity.py                     # last 100 events, all types
    python view_activity.py --type login        # only successful logins
    python view_activity.py --type password_reset
    python view_activity.py --email user@x.com  # only that person
    python view_activity.py --limit 500         # show more rows

Event types: register | login | login_failed | password_reset_requested | password_reset
Timestamps are in UTC.
"""
import os
import csv
import argparse
import warnings

# Hide unrelated library warnings (e.g. qdrant version check) so the output stays clean.
warnings.filterwarnings("ignore")

from dotenv import load_dotenv

# Load backend/.env no matter which folder you run this from.
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

from sqlalchemy import text
from database import engine
import models  # ensures the auth_events table can be created if it doesn't exist yet

# Make sure the table exists so the script works even before the backend restarts.
models.Base.metadata.create_all(bind=engine)

CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "activity_log.csv")


def main():
    ap = argparse.ArgumentParser(description="View the user auth activity log.")
    ap.add_argument("--type", help="filter by event_type (login, register, password_reset, ...)")
    ap.add_argument("--email", help="filter by email address")
    ap.add_argument("--limit", type=int, default=100, help="max rows to show (default 100)")
    args = ap.parse_args()

    conditions, params = [], {}
    if args.type:
        conditions.append("event_type = :etype")
        params["etype"] = args.type
    if args.email:
        conditions.append("lower(email) = lower(:email)")
        params["email"] = args.email
    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    params["lim"] = args.limit

    sql = text(f"""
        SELECT created_at, event_type, email, ip_address, detail
        FROM auth_events
        {where}
        ORDER BY created_at DESC
        LIMIT :lim
    """)

    with engine.connect() as conn:
        rows = conn.execute(sql, params).fetchall()

    if not rows:
        print("No activity recorded yet — this is normal, not an error.")
        print("The log is simply empty because nobody has signed in or reset a")
        print("password since logging was turned on. Sign in through the app once,")
        print("then run this script again and you'll see the entry here.")
        return

    # Console table
    print(f"\n{'Time (UTC)':<20} {'Event':<26} {'Email':<32} {'IP':<16} Detail")
    print("-" * 114)
    for created_at, event_type, email, ip, detail in rows:
        t = created_at.strftime("%Y-%m-%d %H:%M:%S") if created_at else ""
        print(f"{t:<20} {str(event_type):<26} {str(email or ''):<32} {str(ip or ''):<16} {detail or ''}")
    print(f"\n{len(rows)} event(s), newest first.")

    # CSV export (open in Excel)
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["time_utc", "event_type", "email", "ip_address", "detail"])
        for created_at, event_type, email, ip, detail in rows:
            t = created_at.strftime("%Y-%m-%d %H:%M:%S") if created_at else ""
            writer.writerow([t, event_type, email, ip, detail])
    print(f"Saved a spreadsheet copy to: {CSV_PATH}")


if __name__ == "__main__":
    main()
