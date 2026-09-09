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

def tenant_prefix(workspace_id=None, user_id=None, category: str = "assets") -> str:
    """The owning prefix every stored object must sit under.

    Object storage has no row-level security: a bucket is a flat namespace, and the only
    thing that makes one tenant's files separable from another's is the path. Without a
    prefix you cannot apply a per-tenant storage policy, cannot delete a tenant's media
    when they leave, and cannot tell from an object who it belongs to.

    Shape is `w<workspace_id>/<category>/` for workspace-owned media and `u<user_id>/...`
    for anything owned by a person rather than a brand (a creator's payout proof belongs to
    the creator, who may have no workspace at all). The `w`/`u` sigil keeps the two ranges
    from ever colliding, which bare integers would.
    """
    category = "".join(ch for ch in (category or "assets") if ch.isalnum() or ch in "-_") or "assets"
    if workspace_id is not None:
        return f"w{int(workspace_id)}/{category}"
    if user_id is not None:
        return f"u{int(user_id)}/{category}"
    raise ValueError("A stored object must belong to a workspace or a user.")


async def upload_file_to_supabase(file: UploadFile, folder: str = None,
                                  workspace_id=None, user_id=None,
                                  category: str = "assets") -> str:
    """Store a file under its owner's prefix and return its URL.

    `folder` is still accepted for callers that already compute their own path, but passing
    a workspace_id or user_id is preferred: the prefix is then derived here, so a new caller
    cannot forget it and drop a tenant's file into a shared namespace.
    """
    if not supabase:
        # Used to "simulate" the upload by returning https://mock.raftra.com/... - a URL that
        # resolves to nothing. The caller stored it as if the file were saved, so the failure
        # only showed up later as a broken image. Fail here instead.
        raise HTTPException(
            status_code=503,
            detail="File storage is not configured on this server (SUPABASE_URL and "
                   "SUPABASE_KEY are unset), so uploads cannot be saved.")

    if folder is None:
        folder = tenant_prefix(workspace_id=workspace_id, user_id=user_id, category=category)

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

def store_bytes(content: bytes, filename: str, content_type: str,
                workspace_id=None, user_id=None, category: str = "assets") -> str:
    """Store raw bytes and return a URL that renders in an <img>.

    The Drive importer needs this: it holds the file's bytes, not an UploadFile, and the
    thing it must not do is store Google's own link. A Drive `webViewLink` points at an
    HTML viewer page behind a Google login, so an asset imported that way was a broken
    image everywhere the vault was used.

    Supabase when it is configured, the mounted uploads directory when it is not - the same
    two paths media_routes.upload_media uses, so imported files live beside uploaded ones.
    """
    ext = ("." + filename.rsplit(".", 1)[-1].lower()) if "." in filename else ""
    if len(ext) > 6 or not ext[1:].isalnum():
        # Fall back to the declared type rather than trusting an odd filename.
        ext = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
               "image/gif": ".gif", "image/svg+xml": ".svg"}.get(content_type, ".bin")
    prefix = tenant_prefix(workspace_id=workspace_id, user_id=user_id, category=category)
    stored_name = f"{prefix}/{uuid.uuid4().hex}{ext}"

    if supabase:
        try:
            supabase.storage.from_(SUPABASE_BUCKET).upload(
                file=content, path=stored_name,
                file_options={"content-type": content_type or "application/octet-stream"})
            return supabase.storage.from_(SUPABASE_BUCKET).get_public_url(stored_name)
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not store the file: {e}")

    from pathlib import Path
    from core.providers.kenburns_video import MEDIA_ROOT

    target = Path(MEDIA_ROOT) / "uploads" / stored_name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return f"/api/generated/uploads/{stored_name}"


def get_signed_url(path: str, expires_in: int = 3600) -> str:
    if not supabase:
        return path
    try:
        res = supabase.storage.from_(SUPABASE_BUCKET).create_signed_url(path, expires_in)
        return res.get("signedURL", path)
    except Exception as e:
        return path
