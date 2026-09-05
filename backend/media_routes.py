"""Generic authenticated file upload.

This module existed but was never included in main.py, so POST /api/media/upload 404'd for
everyone. The one caller is the creator portal's payout-proof screenshot, and the failure
was invisible there: the fetch error was swallowed by a console.warn and the local
`blob:` URL was submitted to the payouts endpoint instead. A reviewer then received a proof
URL that resolves to nothing outside the creator's own browser, while the creator had been
told a human was reviewing their screenshot.

Storage goes to Supabase when it is configured and to the mounted uploads directory when it
is not - the same directory Creative Studio's reference images already use. The previous
implementation only knew about Supabase, and storage.py answered with a fabricated
https://mock.raftra.com/... URL whenever the keys were missing.
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File

import auth
import models
from storage import supabase, upload_file_to_supabase

router = APIRouter(prefix="/api/media", tags=["media"])

MAX_FILE_SIZE = 25 * 1024 * 1024

# Extension -> the magic bytes that must actually be present. Trusting the extension, or the
# client-supplied content type, lets "proof.png" contain anything at all. Mirrors the
# allowlist in workspace_routes.upload_asset, plus PDF for documents.
_SIGNATURES = {
    ".png":  [b"\x89PNG\r\n\x1a\n"],
    ".jpg":  [b"\xff\xd8\xff"],
    ".jpeg": [b"\xff\xd8\xff"],
    ".webp": [b"RIFF"],
    ".gif":  [b"GIF87a", b"GIF89a"],
    ".pdf":  [b"%PDF-"],
}


@router.post("/upload")
async def upload_media(file: UploadFile = File(...),
                       current_user: models.User = Depends(auth.get_current_user)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in _SIGNATURES:
        raise HTTPException(status_code=400, detail=(
            f"Unsupported file type '{ext or 'unknown'}'. Allowed: "
            f"{', '.join(sorted(_SIGNATURES))}."))

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail=(
            f"File is {len(content) // 1024 // 1024}MB; the limit is "
            f"{MAX_FILE_SIZE // 1024 // 1024}MB."))
    if not any(content.startswith(sig) for sig in _SIGNATURES[ext]):
        raise HTTPException(status_code=400, detail=(
            f"That file is not a valid {ext.lstrip('.').upper()} file - its contents do not "
            "match its extension."))

    folder = f"{current_user.role}s/{current_user.id}"

    if supabase:
        await file.seek(0)
        try:
            return {"status": "success", "url": await upload_file_to_supabase(file, folder=folder)}
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Upload failed: {e}")

    # Local disk, served by the /api/generated/uploads mount in main.py. A UUID name means
    # nothing user-controlled reaches the filesystem and two people uploading "proof.png"
    # cannot overwrite each other.
    from core.providers.kenburns_video import MEDIA_ROOT

    upload_dir = MEDIA_ROOT / "uploads" / folder
    upload_dir.mkdir(parents=True, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    (upload_dir / stored_name).write_bytes(content)

    return {"status": "success",
            "url": f"/api/generated/uploads/{folder}/{stored_name}",
            "filename": file.filename,
            "size": len(content)}
