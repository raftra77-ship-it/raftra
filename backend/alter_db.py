from dotenv import load_dotenv
load_dotenv()
import database, models
from sqlalchemy import text

statements = [
    "ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'brand'",
    "ALTER TABLE influencers ADD COLUMN user_id INTEGER REFERENCES users(id)"
]

with database.engine.begin() as conn:
    for stmt in statements:
        try:
            conn.execute(text(stmt))
            print(f"Executed: {stmt}")
        except Exception as e:
            print(f"Ignored: {e}")
