from dotenv import load_dotenv
load_dotenv()
import database, models
from sqlalchemy import text

statements = [
    "ALTER TABLE influencers ADD COLUMN recent_posts JSON",
    "ALTER TABLE influencers ADD COLUMN recent_collabs JSON",
    "ALTER TABLE influencers ADD COLUMN recent_reviews JSON",
    "ALTER TABLE influencers DROP COLUMN reel_link_1",
    "ALTER TABLE influencers DROP COLUMN reel_link_2",
    "ALTER TABLE influencers DROP COLUMN custom_review"
]

with database.engine.begin() as conn:
    for stmt in statements:
        try:
            conn.execute(text(stmt))
            print(f"Executed: {stmt}")
        except Exception as e:
            print(f"Ignored: {e}")
