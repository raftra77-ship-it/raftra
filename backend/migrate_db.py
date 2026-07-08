from dotenv import load_dotenv
load_dotenv()

import database
from sqlalchemy import text

statements = [
    "ALTER TABLE users ADD COLUMN payment_status VARCHAR DEFAULT 'pending'",
    "ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR UNIQUE",
    "ALTER TABLE users ADD COLUMN billing_balance FLOAT DEFAULT 0.0",
    "ALTER TABLE users ADD COLUMN unlocked_nodes VARCHAR DEFAULT ''"
]

for stmt in statements:
    try:
        with database.engine.begin() as conn:
            conn.execute(text(stmt))
    except Exception as e:
        print(f"Error on {stmt}: {e}")

print("Migration successful.")
