import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

router = APIRouter(prefix="/api/media", tags=["media"])

ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "mp4", "pdf"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "")

if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
    try:
        import cloudinary
        import cloudinary.uploader
        cloudinary.config(
            cloud_name=CLOUDINARY_CLOUD_NAME,
            api_key=CLOUDINARY_API_KEY,
            api_secret=CLOUDINARY_API_SECRET,
            secure=True
        )
    except Exception as e:
        print(f"Cloudinary config error: {e}")

@router.post("/upload")
async def upload_media(file: UploadFile = File(...)):
    # Validate extension
    filename = file.filename or "upload.png"
    file_ext = filename.split(".")[-1].lower() if "." in filename else "png"
    if file_ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB")

    await file.seek(0)

    # 1. Try Cloudinary upload if configured
    if CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET:
        try:
            import cloudinary.uploader
            res = cloudinary.uploader.upload(file.file, folder="raftra_proofs")
            return {"status": "success", "url": res.get("secure_url")}
        except Exception as e:
            print(f"Cloudinary upload failed, falling back to local storage: {e}")
            await file.seek(0)

    # 2. Fallback to local static uploads directory
    uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    
    unique_filename = f"{uuid.uuid4().hex}_{filename}"
    file_path = os.path.join(uploads_dir, unique_filename)
    
    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    local_url = f"/uploads/{unique_filename}"
    return {"status": "success", "url": local_url}

