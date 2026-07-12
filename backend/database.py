import os
from dotenv import load_dotenv
load_dotenv()

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment.")

try:
    # Supabase uses connection pooling, sometimes requires SSL
    engine = create_engine(
        DATABASE_URL, 
        pool_pre_ping=True, 
        pool_size=20, 
        max_overflow=40,
        pool_timeout=30,
        pool_recycle=1800
    )
    print("Connected to PostgreSQL (Supabase) successfully.")
except Exception as e:
    print(f"Error connecting to database: {e}")
    raise e

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Qdrant Database Setup
from qdrant_client import QdrantClient
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")

qdrant_client = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY)

def get_qdrant_client():
    return qdrant_client

