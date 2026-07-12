import os
from supabase import create_client, Client
from fastapi import UploadFile, HTTPException
import uuid

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_BUCKET = os.getenv("SUPABASE_BUCKET", "raftra-media")

supabase: Client = None

if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"Warning: Failed to initialize Supabase client: {e}")

async def upload_file_to_supabase(file: UploadFile, folder: str = "general") -> str:
    if not supabase:
        print("Warning: Supabase not configured. Simulating upload.")
        return f"https://mock.raftra.com/storage/{folder}/{file.filename}"
        
    try:
        file_ext = file.filename.split(".")[-1]
        unique_filename = f"{folder}/{uuid.uuid4()}.{file_ext}"
        
        file_bytes = await file.read()
        
        # Ensure bucket exists
        # (In production, usually created manually or via migrations, but we check/upload)
        res = supabase.storage.from_(SUPABASE_BUCKET).upload(
            file=file_bytes,
            path=unique_filename,
            file_options={"content-type": file.content_type}
        )
        
        # Get public URL
        public_url = supabase.storage.from_(SUPABASE_BUCKET).get_public_url(unique_filename)
        return public_url
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload file to Supabase: {str(e)}")

def get_signed_url(path: str, expires_in: int = 3600) -> str:
    if not supabase:
        return path
    try:
        res = supabase.storage.from_(SUPABASE_BUCKET).create_signed_url(path, expires_in)
        return res.get("signedURL", path)
    except Exception as e:
        return path
