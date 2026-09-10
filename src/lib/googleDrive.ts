/**
 * Google Drive, through this workspace's server-side connector.
 *
 * This file used to do the OAuth itself with Google Identity Services: it asked for an
 * access token in the page, kept it in sessionStorage and called the Drive REST API from
 * the browser. Two things were wrong with that.
 *
 *  - The grant died with the tab. The token expired inside an hour and nothing was stored
 *    server-side, so there was no connection to show in the Integrations Hub, nothing a
 *    scheduled sync could use, and a fresh consent popup every session.
 *  - The import saved Drive's `webViewLink` as the asset's URL. That link is an HTML viewer
 *    page behind a Google login, not an image, so every asset imported from Drive rendered
 *    as a broken image in the vault, in Creative Studio and on the editor canvas.
 *
 * The connector at /api/connectors/gdrive holds the refresh token and, on import, downloads
 * the bytes into this platform's own storage. Everything here is a call to it.
 */

export interface DriveFolder {
  id: string;
  name: string;
}

export interface DriveFile {
  id: string;
  name: string;
  mime_type: string;
  format: string | null;
  size_bytes: number | null;
  width: number | null;
  height: number | null;
  web_view_link?: string;
  /** False for files the vault cannot take (a PSD, or something over the size cap). */
  importable: boolean;
}

export interface DriveStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  folder_id: string | null;
  folder_name: string | null;
  last_import_at: string | null;
}

export interface DriveImportResult {
  imported: number;
  skipped: number;
  failed: { id: string; name?: string; reason: string }[];
}

export class DriveError extends Error {}

function authHeaders(): Record<string, string> {
  const t = localStorage.getItem('token');
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function call(path: string, init?: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await fetch(`/api/connectors/gdrive${path}`, {
      ...init,
      headers: { ...authHeaders(), ...(init?.body ? { 'Content-Type': 'application/json' } : {}), ...(init?.headers || {}) },
    });
  } catch {
    throw new DriveError('Could not reach the server. Please try again.');
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    // The connector phrases its own errors for the person who clicked the button
    // ("Google Drive access has expired or was revoked. Reconnect Drive."), so pass them
    // through rather than replacing them with a generic failure.
    throw new DriveError((data && data.detail) || `Google Drive request failed (${res.status}).`);
  }
  return data;
}

export function getStatus(workspaceId: number): Promise<DriveStatus> {
  return call(`/${workspaceId}/status`);
}

/** Returns Google's consent URL. The caller sends the browser there. */
export async function getAuthorizeUrl(workspaceId: number): Promise<string> {
  const d = await call(`/${workspaceId}/authorize`);
  if (!d?.url) throw new DriveError('Could not start the Google Drive connection.');
  return d.url;
}

export async function listFolders(workspaceId: number): Promise<DriveFolder[]> {
  const d = await call(`/${workspaceId}/folders`);
  return Array.isArray(d?.folders) ? d.folders : [];
}

export async function listImageFiles(workspaceId: number, folderId?: string): Promise<DriveFile[]> {
  const q = folderId ? `?folder_id=${encodeURIComponent(folderId)}` : '';
  const d = await call(`/${workspaceId}/files${q}`);
  return Array.isArray(d?.files) ? d.files : [];
}

/** Remembers the folder being browsed so the picker reopens where it was left. */
export function setDefaultFolder(workspaceId: number, folderId?: string, folderName?: string): Promise<any> {
  return call(`/${workspaceId}/folder`, {
    method: 'POST',
    body: JSON.stringify({ folder_id: folderId ?? null, folder_name: folderName ?? null }),
  });
}

/**
 * Copies the chosen files into the Asset Vault. The server downloads each one and stores
 * the bytes, so the resulting assets render anywhere in the platform and survive both a
 * reload and disconnecting Drive.
 */
export function importFiles(workspaceId: number, fileIds: string[], category = 'lifestyle'): Promise<DriveImportResult> {
  return call(`/${workspaceId}/import`, {
    method: 'POST',
    body: JSON.stringify({ file_ids: fileIds, category }),
  });
}

export function disconnectDrive(workspaceId: number): Promise<any> {
  return call(`/${workspaceId}/disconnect`, { method: 'POST' });
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
