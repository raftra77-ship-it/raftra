/**
 * Real Google Drive integration.
 *
 * Uses Google Identity Services (GIS) for OAuth and the Drive REST API v3 for
 * reading folders/files. Only requires VITE_GOOGLE_CLIENT_ID — no Picker key.
 */

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const TOKEN_KEY = 'gdrive_access_token';
const TOKEN_EXP_KEY = 'gdrive_token_expiry';

export interface DriveFolder {
  id: string;
  name: string;
  path: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  webViewLink?: string;
}

export class DriveError extends Error {}

export function isDriveConfigured(): boolean {
  return typeof CLIENT_ID === 'string' && CLIENT_ID.length > 0;
}

/** Injects the GIS script once and resolves when google.accounts is ready. */
let gisPromise: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;

  gisPromise = new Promise<void>((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) return resolve();

    const existing = document.querySelector(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new DriveError('Could not load Google sign-in.')));
      return;
    }

    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new DriveError('Could not load Google sign-in. Check your network connection.'));
    document.head.appendChild(script);
  });

  return gisPromise;
}

function cachedToken(): string | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expiry = sessionStorage.getItem(TOKEN_EXP_KEY);
  if (!token || !expiry) return null;
  // Treat as expired 60s early so a request never races the boundary.
  if (Date.now() > Number(expiry) - 60_000) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXP_KEY);
    return null;
  }
  return token;
}

export function hasValidToken(): boolean {
  return cachedToken() !== null;
}

/**
 * Opens the real Google consent screen and resolves with an access token.
 * Reuses a cached token when one is still valid.
 */
export function getAccessToken(): Promise<string> {
  if (!isDriveConfigured()) {
    throw new DriveError(
      'Google Drive is not configured. Add VITE_GOOGLE_CLIENT_ID to your .env file and restart the dev server.'
    );
  }

  const cached = cachedToken();
  if (cached) return Promise.resolve(cached);

  return loadGis().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const client = (window as any).google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPE,
          callback: (response: any) => {
            if (response.error) {
              reject(new DriveError(response.error_description || 'Google denied the authorization request.'));
              return;
            }
            sessionStorage.setItem(TOKEN_KEY, response.access_token);
            sessionStorage.setItem(TOKEN_EXP_KEY, String(Date.now() + Number(response.expires_in) * 1000));
            resolve(response.access_token);
          },
          error_callback: (err: any) => {
            reject(
              new DriveError(
                err?.type === 'popup_closed'
                  ? 'Authorization window was closed before sign-in finished.'
                  : 'Google sign-in failed.'
              )
            );
          }
        });
        client.requestAccessToken();
      })
  );
}

export function disconnectDrive(): void {
  const token = sessionStorage.getItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_EXP_KEY);
  if (token && (window as any).google?.accounts?.oauth2) {
    (window as any).google.accounts.oauth2.revoke(token, () => {});
  }
}

async function driveFetch(path: string, token: string): Promise<any> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.status === 401 || res.status === 403) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXP_KEY);
    throw new DriveError('Google Drive access expired. Please reconnect.');
  }
  if (!res.ok) {
    throw new DriveError(`Google Drive request failed (${res.status}).`);
  }
  return res.json();
}

/** Lists the user's real Drive folders, most recently modified first. */
export async function listFolders(token: string, limit = 10): Promise<DriveFolder[]> {
  const params = new URLSearchParams({
    q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
    fields: 'files(id, name)',
    orderBy: 'modifiedTime desc',
    pageSize: String(limit)
  });
  const data = await driveFetch(`files?${params}`, token);
  return (data.files || []).map((f: any) => ({ id: f.id, name: f.name, path: `/${f.name}` }));
}

/** Lists real image files, optionally scoped to one folder. */
export async function listImageFiles(token: string, folderId?: string, limit = 24): Promise<DriveFile[]> {
  const clauses = ["mimeType contains 'image/'", 'trashed = false'];
  if (folderId) clauses.push(`'${folderId}' in parents`);

  const params = new URLSearchParams({
    q: clauses.join(' and '),
    fields: 'files(id, name, mimeType, size, imageMediaMetadata(width, height), webViewLink)',
    orderBy: 'modifiedTime desc',
    pageSize: String(limit)
  });

  const data = await driveFetch(`files?${params}`, token);
  return (data.files || []).map((f: any) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    sizeBytes: f.size ? Number(f.size) : null,
    width: f.imageMediaMetadata?.width ?? null,
    height: f.imageMediaMetadata?.height ?? null,
    webViewLink: f.webViewLink
  }));
}

/**
 * Downloads file bytes and returns an object URL so the real image renders.
 * Drive's thumbnailLink cannot be used directly — it needs the auth header.
 */
export async function fetchFileObjectUrl(fileId: string, token: string): Promise<string> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new DriveError(`Could not download file (${res.status}).`);
  return URL.createObjectURL(await res.blob());
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mimeToFormat(mimeType: string): 'PNG' | 'JPG' | 'WEBP' | 'SVG' {
  if (mimeType.includes('png')) return 'PNG';
  if (mimeType.includes('webp')) return 'WEBP';
  if (mimeType.includes('svg')) return 'SVG';
  return 'JPG';
}
