from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
import auth, models
from storage import upload_file_to_supabase

router = APIRouter(prefix="/api/media", tags=["media"])

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "mp4", "pdf"}
MAX_FILE_SIZE = 50 * 1024 * 1024 # 50 MB

@router.post("/upload")
async def upload_media(file: UploadFile = File(...), current_user: models.User = Depends(auth.get_current_user)):
    # Validate extension
    file_ext = file.filename.split(".")[-1].lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")
        
    # Validation size (by reading)
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB")
        
    # Reset file cursor after read
    await file.seek(0)
    
    # Upload to Supabase Storage
    try:
        # Determine folder based on user role
        folder = f"{current_user.role}s/{current_user.id}"
        public_url = await upload_file_to_supabase(file, folder=folder)
        return {"status": "success", "url": public_url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
