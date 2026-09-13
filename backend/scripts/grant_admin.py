"""Grant or revoke the admin role for one account.

Admin can read every creator's bank details and record payouts as paid, so nothing in the app
hands it out. Run this from the backend directory with the production DATABASE_URL loaded:

    python scripts/grant_admin.py you@company.com
    python scripts/grant_admin.py you@company.com --revoke

Revoking returns the account to the role it had before (brand or creator) when that can be
inferred - a creator profile means creator, otherwise brand.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

import models  # noqa: E402
from database import SessionLocal  # noqa: E402


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    revoke = "--revoke" in sys.argv
    if len(args) != 1:
        print(__doc__)
        return 2
    email = args[0].strip().lower()

    with SessionLocal() as db:
        user = db.query(models.User).filter(models.User.email.ilike(email)).first()
        if not user:
            print(f"No account with email {email}.")
            return 1
        if revoke:
            if user.role != "admin":
                print(f"{user.email} is not an admin (role: {user.role}).")
                return 0
            is_creator = db.query(models.Influencer).filter(models.Influencer.user_id == user.id).first()
            user.role = "creator" if is_creator else "brand"
            db.commit()
            print(f"Revoked admin from {user.email}; role is now {user.role}.")
            return 0
        if user.role == "admin":
            print(f"{user.email} is already an admin.")
            return 0
        previous = user.role
        user.role = "admin"
        db.commit()
        print(f"Granted admin to {user.email} (was {previous}). They must sign in again for the "
              f"new role to be in their token.")
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
