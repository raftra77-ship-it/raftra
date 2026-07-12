from dotenv import load_dotenv
load_dotenv()
import database
from sqlalchemy import text

stmt = 'ALTER TABLE influencers ADD COLUMN base_rate FLOAT DEFAULT 0.0;'
with database.engine.begin() as conn:
    try:
        conn.execute(text(stmt))
        print('Added base_rate column')
    except Exception as e:
        print(f'Error: {e}')
