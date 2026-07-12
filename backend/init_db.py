import os
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine, text
from database import engine
import models

def init_db():
    print("Initializing Database...")
    try:
        with engine.connect() as conn:
            print("Enabling pgvector extension...")
            # Supabase Postgres needs vector extension enabled
            conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            conn.commit()
            print("pgvector extension enabled.")
            
        print("Creating tables...")
        # Create all tables defined in models.py
        models.Base.metadata.create_all(bind=engine)
        print("Database schemas created successfully!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    init_db()
