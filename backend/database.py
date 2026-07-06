import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@127.0.0.1:5433/raftra_db")

try:
    if "postgresql" in DATABASE_URL:
        engine = create_engine(DATABASE_URL, connect_args={"connect_timeout": 3})
        # Test connection
        conn = engine.connect()
        conn.close()
        print("Connected to PostgreSQL successfully.")
    else:
        raise ValueError("Not PostgreSQL url configuration")
except Exception as e:
    print(f"Warning: Failed to connect to PostgreSQL ({e}). Falling back to local SQLite database.")
    DATABASE_URL = "sqlite:///./raftra.db"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# Dependency for FastAPI
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

