from dotenv import load_dotenv
load_dotenv()
import database, models
from sqlalchemy import text

statements = [
    "ALTER TABLE ad_assets ADD COLUMN audio_url VARCHAR",
    "ALTER TABLE ad_assets ADD COLUMN parent_id INTEGER REFERENCES ad_assets(id)",
    "ALTER TABLE ad_assets ADD COLUMN suggested_edits JSON",
    "ALTER TABLE users ADD COLUMN category VARCHAR",
    "ALTER TABLE users ADD COLUMN price FLOAT"
]

with database.engine.begin() as conn:
    for stmt in statements:
        try:
            conn.execute(text(stmt))
            print(f"Executed: {stmt}")
        except Exception as e:
            print(f"Ignored: {e}")
