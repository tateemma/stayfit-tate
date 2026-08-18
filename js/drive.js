/* Google Drive backup — loaded lazily, only when the user taps "Connect / Backup".
   Uses Google Identity Services for sign-in (no backend) and plain fetch()
   against the Drive REST API. Files are stored in the app's private
   "appDataFolder" (hidden folder only this app can see/read — nothing shows
   up cluttering the user's normal Drive). Requires a Google Cloud OAuth
   Client ID pasted into Settings — see README.md for the one-time setup. */

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const BACKUP_FILENAME = 'gym-tracker-backup.json';

let _tokenClient = null;
let _accessToken = null;
let _tokenExpiresAt = 0;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

async function ensureGisLoaded() {
  if (!navigator.onLine) throw new Error('No internet connection — Drive backup needs to be online.');
  await loadScript('https://accounts.google.com/gsi/client');
}

async function driveSignIn(clientId) {
  await ensureGisLoaded();
  return new Promise((resolve, reject) => {
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error));
        _accessToken = resp.access_token;
        _tokenExpiresAt = Date.now() + (resp.expires_in * 1000);
        resolve(_accessToken);
      }
    });
    _tokenClient.requestAccessToken();
  });
}

async function getValidToken(clientId) {
  if (_accessToken && Date.now() < _tokenExpiresAt - 30000) return _accessToken;
  return driveSignIn(clientId);
}

async function driveApiFetch(url, options, clientId) {
  const token = await getValidToken(clientId);
  const res = await fetch(url, {
    ...options,
    headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Drive API error ${res.status}: ${text}`);
  }
  return res;
}

async function findBackupFileId(clientId) {
  const url = 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
    q: `name='${BACKUP_FILENAME}' and trashed=false`,
    spaces: 'appDataFolder',
    fields: 'files(id,name,modifiedTime)'
  });
  const res = await driveApiFetch(url, { method: 'GET' }, clientId);
  const data = await res.json();
  return data.files && data.files.length ? data.files[0] : null;
}

async function buildBackupPayload() {
  const [sessions, bodyLogs, photos, habitLogs] = await Promise.all([
    getAllSessions(), getAllBodyLogs(), getAllPhotos(), getAllHabitLogs()
  ]);
  const scheduleRow = await DB.get('settings', 'schedule');
  const cardioRow = await DB.get('settings', 'cardioDefaults');
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    sessions, bodyLogs, photos, habitLogs,
    schedule: scheduleRow ? scheduleRow.value : null,
    cardioDefaults: cardioRow ? cardioRow.value : null
  };
}

async function backupToDrive(clientId, onProgress) {
  onProgress && onProgress('Signing in…');
  await getValidToken(clientId);
  onProgress && onProgress('Preparing backup…');
  const payload = await buildBackupPayload();
  const json = JSON.stringify(payload);

  onProgress && onProgress('Checking for existing backup…');
  const existing = await findBackupFileId(clientId);

  const metadata = { name: BACKUP_FILENAME, mimeType: 'application/json' };
  if (!existing) metadata.parents = ['appDataFolder'];

  onProgress && onProgress('Uploading…');
  if (existing) {
    await driveApiFetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existing.id}?uploadType=media`,
      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: json },
      clientId
    );
  } else {
    const boundary = '-------gymtracker' + Date.now();
    const body =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n` +
      `--${boundary}--`;
    await driveApiFetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
      clientId
    );
  }
  onProgress && onProgress('Backup complete.');
  return { sessions: payload.sessions.length, bodyLogs: payload.bodyLogs.length, photos: payload.photos.length };
}

async function restoreFromDrive(clientId, onProgress) {
  onProgress && onProgress('Signing in…');
  await getValidToken(clientId);
  onProgress && onProgress('Looking for backup…');
  const existing = await findBackupFileId(clientId);
  if (!existing) throw new Error('No backup found in Google Drive yet.');

  onProgress && onProgress('Downloading…');
  const res = await driveApiFetch(
    `https://www.googleapis.com/drive/v3/files/${existing.id}?alt=media`,
    { method: 'GET' },
    clientId
  );
  const payload = await res.json();

  onProgress && onProgress('Restoring locally…');
  await DB.clear('sessions');
  await DB.clear('bodyLogs');
  await DB.clear('photos');
  await DB.clear('habitLogs');
  for (const s of payload.sessions || []) await DB.put('sessions', s);
  for (const b of payload.bodyLogs || []) await DB.put('bodyLogs', b);
  for (const p of payload.photos || []) await DB.put('photos', p);
  for (const hl of payload.habitLogs || []) await DB.put('habitLogs', hl);
  if (payload.schedule) await setSetting('schedule', payload.schedule);
  if (payload.cardioDefaults) await setSetting('cardioDefaults', payload.cardioDefaults);

  onProgress && onProgress('Restore complete.');
  return { sessions: (payload.sessions || []).length, bodyLogs: (payload.bodyLogs || []).length, photos: (payload.photos || []).length };
}
