// ─── Google Drive API v3 service (fetch only, no SDK) ───────────────────────
//
// Uses the Google Identity Services (GIS) library loaded via <script> in
// index.html.  The library is only 8 KB gzipped and provides the OAuth2 token
// popup – everything else (API calls) is plain fetch.
//
// Token lifecycle
//   • GIS issues short-lived access tokens (1 h).
//   • We store { token, expiresAt, user } in localStorage so the UI survives
//     a page refresh without a full re-login.
//   • On expiry we call requestAccessToken() again (silent if the account is
//     still active in the browser session, otherwise shows a popup).

// ── Types exposed to consumers ────────────────────────────────────────────────

export interface DriveUser {
  name: string;
  email: string;
  avatar: string;
}

export interface DriveFileMeta {
  id: string;
  name: string;
  modifiedTime: string;
}

// ── Internal state ────────────────────────────────────────────────────────────

const STORAGE_KEY = 'bracer_drive_auth';
const DRIVE_API   = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API  = 'https://www.googleapis.com/upload/drive/v3';

interface StoredAuth {
  token: string;
  expiresAt: number;   // Date.now() ms
  user: DriveUser;
}

let _clientId   = '';
let _tokenClient: google.accounts.oauth2.TokenClient | null = null;
let _stored: StoredAuth | null = null;

// Resolve / reject for the in-flight token request
let _tokenResolve: ((token: string) => void) | null = null;
let _tokenReject:  ((err: Error) => void)    | null = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: StoredAuth = JSON.parse(raw);
    if (Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

function saveStored(auth: StoredAuth) {
  _stored = auth;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
}

function clearStored() {
  _stored = null;
  localStorage.removeItem(STORAGE_KEY);
}

async function driveHeaders(): Promise<Record<string, string>> {
  const token = await ensureToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function ensureToken(): Promise<string> {
  // Use cached token if still valid (with 60 s buffer)
  if (_stored && Date.now() < _stored.expiresAt - 60_000) {
    return _stored.token;
  }
  // Otherwise request a fresh token
  return requestFreshToken();
}

function requestFreshToken(): Promise<string> {
  if (!_tokenClient) throw new Error('Drive not initialised – call initGoogleAuth first.');
  return new Promise((resolve, reject) => {
    _tokenResolve = resolve;
    _tokenReject  = reject;
    _tokenClient!.requestAccessToken({ prompt: '' });
  });
}

async function fetchUserInfo(token: string): Promise<DriveUser> {
  const res = await fetch(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) throw new Error('Failed to fetch user info');
  const d = await res.json();
  return { name: d.name ?? d.email, email: d.email, avatar: d.picture ?? '' };
}

async function driveJson<T = unknown>(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const headers = { ...(await driveHeaders()), ...extraHeaders };
  const res = await fetch(`${DRIVE_API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Drive API ${method} ${path} → ${res.status}: ${text}`);
  }
  // 204 No Content
  if (res.status === 204) return undefined as unknown as T;
  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Must be called once on app start (after the GIS script has loaded).
 * Restores a cached session if one exists.
 */
export async function initGoogleAuth(clientId: string): Promise<void> {
  _clientId = clientId;
  _stored   = loadStored();

  await waitForGis();

  _tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/drive.file openid email profile',
    callback: (resp) => {
      if (resp.error || !resp.access_token) {
        _tokenReject?.(new Error(resp.error_description ?? resp.error ?? 'Token error'));
        _tokenReject = null;
        return;
      }
      const expiresAt = Date.now() + (Number(resp.expires_in) - 30) * 1_000;

      // If we already have user info (refresh), keep it
      if (_stored) {
        const refreshed: StoredAuth = { ..._stored, token: resp.access_token, expiresAt };
        saveStored(refreshed);
        _tokenResolve?.(resp.access_token);
        _tokenResolve = null;
        return;
      }

      // First sign-in: fetch user info then resolve
      fetchUserInfo(resp.access_token).then((user) => {
        const auth: StoredAuth = { token: resp.access_token, expiresAt, user };
        saveStored(auth);
        _tokenResolve?.(resp.access_token);
        _tokenResolve = null;
      }).catch((err) => {
        _tokenReject?.(err);
        _tokenReject = null;
      });
    },
  });
}

function waitForGis(): Promise<void> {
  return new Promise((resolve, reject) => {
    const maxWait = 8_000;
    const start   = Date.now();
    const check = () => {
      if (typeof google !== 'undefined' && google?.accounts?.oauth2) {
        resolve();
      } else if (Date.now() - start > maxWait) {
        reject(new Error('Google Identity Services script not loaded.'));
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

/** Opens the Google account picker and returns the signed-in user. */
export async function signIn(): Promise<DriveUser> {
  if (!_tokenClient) throw new Error('Call initGoogleAuth first.');
  // Force account picker on first sign-in
  await new Promise<string>((resolve, reject) => {
    _tokenResolve = resolve;
    _tokenReject  = reject;
    _tokenClient!.requestAccessToken({ prompt: 'consent' });
  });
  // _stored is set by the callback via fetchUserInfo
  if (!_stored) throw new Error('Sign-in failed – no stored auth.');
  return _stored.user;
}

/** Revokes the token and clears local state. */
export function signOut(): void {
  if (_stored?.token) {
    google.accounts.oauth2.revoke(_stored.token, () => {});
  }
  clearStored();
}

/** Returns the current access token, or null if not authenticated. */
export function getAccessToken(): string | null {
  if (_stored && Date.now() < _stored.expiresAt - 60_000) return _stored.token;
  return null;
}

/** Returns stored user info without making a network call. */
export function getStoredUser(): DriveUser | null {
  return _stored?.user ?? null;
}

/** Returns true if we have a valid (non-expired) token. */
export function isAuthenticated(): boolean {
  return getAccessToken() !== null;
}

// ── Drive file operations ─────────────────────────────────────────────────────

/** Finds or creates a folder and returns its Drive file ID. */
export async function ensureFolder(name: string, parentId?: string): Promise<string> {
  // Search for an existing folder with the same name under parentId
  const conditions = [
    `name='${name}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `trashed=false`,
  ];
  if (parentId) conditions.push(`'${parentId}' in parents`);

  const q = encodeURIComponent(conditions.join(' and '));
  const result = await driveJson<{ files: { id: string }[] }>(
    'GET',
    `/files?q=${q}&fields=files(id)&spaces=drive`,
  );

  if (result.files.length > 0) return result.files[0].id;

  // Create it
  const meta: Record<string, unknown> = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) meta.parents = [parentId];
  const created = await driveJson<{ id: string }>('POST', '/files', meta);
  return created.id;
}

/**
 * Uploads (or updates) a file in Drive.
 * Uses multipart upload so metadata + content go in a single request.
 * Returns the file ID.
 */
export async function uploadFile(
  name: string,
  content: string,
  folderId: string,
  existingFileId?: string,
): Promise<string> {
  const token  = await ensureToken();
  const boundary = `bracer_${Date.now()}`;
  const metaJson = JSON.stringify(
    existingFileId ? {} : { name, parents: [folderId] },
  );

  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metaJson,
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    content,
    `--${boundary}--`,
  ].join('\r\n');

  const url = existingFileId
    ? `${UPLOAD_API}/files/${existingFileId}?uploadType=multipart`
    : `${UPLOAD_API}/files?uploadType=multipart`;

  const res = await fetch(url, {
    method: existingFileId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const data = await res.json() as { id: string };
  return data.id;
}

/** Downloads a file's content by its Drive file ID. */
export async function downloadFile(fileId: string): Promise<string> {
  const token = await ensureToken();
  const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Download failed (${res.status}): ${fileId}`);
  return res.text();
}

/** Finds a file by name in a folder. Returns its ID or null. */
export async function findFile(name: string, folderId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${name}' and '${folderId}' in parents and trashed=false`,
  );
  const result = await driveJson<{ files: { id: string }[] }>(
    'GET',
    `/files?q=${q}&fields=files(id)&spaces=drive`,
  );
  return result.files[0]?.id ?? null;
}

/** Lists files in a Drive folder. */
export async function listFiles(folderId: string): Promise<DriveFileMeta[]> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const result = await driveJson<{ files: DriveFileMeta[] }>(
    'GET',
    `/files?q=${q}&fields=files(id,name,modifiedTime)&spaces=drive`,
  );
  return result.files;
}

/** Deletes a file permanently from Drive. */
export async function deleteFile(fileId: string): Promise<void> {
  await driveJson('DELETE', `/files/${fileId}`);
}

// ── GIS type shim (global declared by the GIS script) ────────────────────────

declare global {
  // eslint-disable-next-line no-var
  var google: {
    accounts: {
      oauth2: {
        initTokenClient(config: {
          client_id: string;
          scope: string;
          callback: (resp: {
            access_token: string;
            expires_in: string | number;
            error?: string;
            error_description?: string;
          }) => void;
        }): google.accounts.oauth2.TokenClient;
        revoke(token: string, callback: () => void): void;
      };
    };
  };
  namespace google.accounts.oauth2 {
    interface TokenClient {
      requestAccessToken(options?: { prompt?: string }): void;
    }
  }
}
