"""
Google Drive integration: browse the brand's Drive and import images into the Asset Vault.

Why this exists as a server-side connector rather than the browser flow that preceded it.
`src/lib/googleDrive.ts` asked Google for an access token in the page, listed files with it
and imported them - but the token lived in sessionStorage and expired within the hour, so
there was no connection to speak of: nothing to show in the Integrations Hub, nothing a
scheduled sync could use, and a fresh consent popup every session.

More importantly, the import stored Drive's `webViewLink` as the asset URL. That link is an
HTML viewer page behind a Google login, not an image, so every asset imported from Drive
rendered as a broken image in the vault, in Creative Studio and on the editor canvas. The
fix is to fetch the bytes and put them in our own storage, which is what import_files does.

Set-up (one-time, Google Cloud Console):
  - Add scope https://www.googleapis.com/auth/drive.readonly to the OAuth consent screen.
  - Register redirect URI {BACKEND_URL}/api/connectors/gdrive/callback on the OAuth client.
  - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are shared with the Search Console connector.
"""
import os
import datetime
from typing import List, Optional
from urllib.parse import urlencode

import httpx

SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8005")
TOKEN_URI = "https://oauth2.googleapis.com/token"
API = "https://www.googleapis.com/drive/v3"

REDIRECT_URI = f"{BACKEND_URL}/api/connectors/gdrive/callback"

# Only formats a browser will render, and only what the vault can show. A Drive folder full
# of PSDs or RAW files would otherwise import as unopenable rows.
IMPORTABLE_MIME = {
    "image/png": "PNG",
    "image/jpeg": "JPG",
    "image/jpg": "JPG",
    "image/webp": "WEBP",
    "image/gif": "GIF",
    "image/svg+xml": "SVG",
}

# Refuse anything absurd before downloading it; Drive reports the size up front.
MAX_FILE_BYTES = 25 * 1024 * 1024


class DriveError(Exception):
    """Something Google told us, phrased for the person who clicked the button."""


def is_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)


def build_authorize_url(state: str) -> str:
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode({
        "client_id": GOOGLE_CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "state": state,
        # offline + consent so Google returns a refresh_token, which is the whole point of
        # moving this server-side: the connection outlives the browser tab.
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
    })


async def exchange_code(code: str) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(TOKEN_URI, data={
            "code": code,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "redirect_uri": REDIRECT_URI,
            "grant_type": "authorization_code",
        })
    if res.status_code != 200:
        raise DriveError("Google rejected the sign-in: %s" % res.text[:300])
    return res.json()


async def fetch_userinfo(access_token: str) -> dict:
    async with httpx.AsyncClient(timeout=20) as client:
        res = await client.get("https://www.googleapis.com/oauth2/v3/userinfo",
                               headers={"Authorization": "Bearer %s" % access_token})
    return res.json() if res.status_code == 200 else {}


async def _access_token(conn, db=None) -> str:
    """A valid access token for this connection, refreshing when it has expired.

    The refreshed token is written back onto `conn` so the next call reuses it; the caller
    commits. Without the write-back every request would spend a round trip re-refreshing.
    """
    now = datetime.datetime.utcnow()
    if conn.access_token and conn.token_expiry and conn.token_expiry > now + datetime.timedelta(seconds=60):
        return conn.access_token
    if not conn.refresh_token:
        raise DriveError("Google Drive is not connected for this workspace.")

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(TOKEN_URI, data={
            "refresh_token": conn.refresh_token,
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "grant_type": "refresh_token",
        })
    if res.status_code != 200:
        # A revoked grant is the common case and is worth saying plainly, because the fix
        # is to reconnect rather than to retry.
        raise DriveError("Google Drive access has expired or was revoked. Reconnect Drive.")
    data = res.json()
    conn.access_token = data.get("access_token")
    conn.token_expiry = now + datetime.timedelta(seconds=int(data.get("expires_in", 3600)))
    if db is not None:
        db.commit()
    return conn.access_token


async def _get(path: str, token: str, params: dict = None) -> dict:
    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.get("%s/%s" % (API, path), params=params or {},
                               headers={"Authorization": "Bearer %s" % token})
    if res.status_code in (401, 403):
        raise DriveError("Google refused that request. Reconnect Drive and try again.")
    if res.status_code != 200:
        raise DriveError("Google Drive request failed (%s)." % res.status_code)
    return res.json()


async def list_folders(conn, db=None, limit: int = 50) -> List[dict]:
    token = await _access_token(conn, db)
    data = await _get("files", token, {
        "q": "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        "fields": "files(id, name)",
        "orderBy": "modifiedTime desc",
        "pageSize": max(1, min(limit, 200)),
        # Shared drives are where a brand's asset library usually lives, so include them.
        "supportsAllDrives": "true",
        "includeItemsFromAllDrives": "true",
    })
    return [{"id": f["id"], "name": f.get("name") or "Untitled folder"}
            for f in data.get("files", [])]


async def list_images(conn, db=None, folder_id: Optional[str] = None,
                      limit: int = 50) -> List[dict]:
    token = await _access_token(conn, db)
    clauses = ["mimeType contains 'image/'", "trashed = false"]
    if folder_id:
        # Quote-escaped: a folder id comes from the client and is interpolated into Drive's
        # query language.
        clauses.append("'%s' in parents" % folder_id.replace("'", "\\'"))
    data = await _get("files", token, {
        "q": " and ".join(clauses),
        "fields": "files(id, name, mimeType, size, imageMediaMetadata(width, height), webViewLink)",
        "orderBy": "modifiedTime desc",
        "pageSize": max(1, min(limit, 200)),
        "supportsAllDrives": "true",
        "includeItemsFromAllDrives": "true",
    })
    out = []
    for f in data.get("files", []):
        meta = f.get("imageMediaMetadata") or {}
        mime = f.get("mimeType") or ""
        out.append({
            "id": f["id"],
            "name": f.get("name") or "image",
            "mime_type": mime,
            "format": IMPORTABLE_MIME.get(mime),
            "size_bytes": int(f["size"]) if f.get("size") else None,
            "width": meta.get("width"),
            "height": meta.get("height"),
            "web_view_link": f.get("webViewLink"),
            # Told to the UI rather than discovered at import time, so a file that cannot be
            # brought in is visibly not selectable instead of failing halfway through.
            "importable": mime in IMPORTABLE_MIME
                          and (not f.get("size") or int(f["size"]) <= MAX_FILE_BYTES),
        })
    return out


async def download(conn, file_id: str, db=None) -> bytes:
    """The file's actual bytes. This is what makes an imported asset render."""
    token = await _access_token(conn, db)
    async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
        res = await client.get("%s/files/%s" % (API, file_id),
                               params={"alt": "media", "supportsAllDrives": "true"},
                               headers={"Authorization": "Bearer %s" % token})
    if res.status_code in (401, 403):
        raise DriveError("Google refused the download. Reconnect Drive and try again.")
    if res.status_code != 200:
        raise DriveError("Could not download that file from Drive (%s)." % res.status_code)
    if len(res.content) > MAX_FILE_BYTES:
        raise DriveError("That file is larger than %dMB." % (MAX_FILE_BYTES // 1024 // 1024))
    return res.content
