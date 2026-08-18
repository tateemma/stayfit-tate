/* Minimal IndexedDB wrapper — no external dependencies, works fully offline. */

const DB_NAME = 'gym-tracker-db';
const DB_VERSION = 2;
let _dbPromise = null;

function openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('bodyLogs')) {
        const store = db.createObjectStore('bodyLogs', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('photos')) {
        const store = db.createObjectStore('photos', { keyPath: 'id' });
        store.createIndex('date', 'date', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('habitLogs')) {
        db.createObjectStore('habitLogs', { keyPath: 'date' });
      }
    };
    req.onsuccess = (e) => {
      const db = e.target.result;
      // If another tab/window later needs a newer schema version, close this
      // connection immediately so that tab's upgrade isn't blocked forever.
      db.onversionchange = () => { db.close(); _dbPromise = null; };
      resolve(db);
    };
    req.onerror = (e) => reject(e.target.error);
    req.onblocked = () => {
      console.warn('IndexedDB upgrade blocked — another open tab of this app needs to be closed/refreshed.');
    };
  });
  return _dbPromise;
}

function tx(storeName, mode) {
  return openDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  async put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = (e) => reject(e.target.error);
    });
  },
  async get(storeName, key) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  },
  async getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  },
  async delete(storeName, key) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  },
  async clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }
};

// ---- Convenience helpers ----

async function getSetting(key, fallback) {
  const row = await DB.get('settings', key);
  return row ? row.value : fallback;
}
async function setSetting(key, value) {
  return DB.put('settings', { key, value });
}

function uid() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

async function getAllSessions() {
  const rows = await DB.getAll('sessions');
  return rows.sort((a, b) => a.date < b.date ? 1 : -1);
}

async function getSessionByDate(dateStr) {
  const rows = await DB.getAll('sessions');
  return rows.find(r => r.date === dateStr) || null;
}

async function saveSession(session) {
  if (!session.id) session.id = uid();
  return DB.put('sessions', session);
}

async function getAllBodyLogs() {
  const rows = await DB.getAll('bodyLogs');
  return rows.sort((a, b) => a.date < b.date ? -1 : 1);
}

async function saveBodyLog(entry) {
  if (!entry.id) entry.id = uid();
  return DB.put('bodyLogs', entry);
}

async function getAllPhotos() {
  const rows = await DB.getAll('photos');
  return rows.sort((a, b) => a.date < b.date ? -1 : 1);
}

async function savePhoto(entry) {
  if (!entry.id) entry.id = uid();
  return DB.put('photos', entry);
}

async function deletePhoto(id) {
  return DB.delete('photos', id);
}

// Habits are tracked per calendar date, independent of workout sessions.
async function getHabitLog(dateStr) {
  return DB.get('habitLogs', dateStr);
}

async function saveHabitLog(dateStr, habits) {
  return DB.put('habitLogs', { date: dateStr, habits });
}

async function getAllHabitLogs() {
  return DB.getAll('habitLogs');
}

function startOfWeek(date) {
  // Monday-start week
  const d = new Date(date);
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diff = (dow === 0 ? -6 : 1 - dow);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function getWeekHabitCounts(referenceDate = new Date()) {
  const monday = startOfWeek(referenceDate);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  const logs = await getAllHabitLogs();
  const byDate = {};
  logs.forEach(l => { byDate[l.date] = l.habits; });
  const counts = {};
  HABITS.forEach(hb => { counts[hb.id] = 0; });
  dates.forEach(dateStr => {
    const habits = byDate[dateStr];
    if (!habits) return;
    HABITS.forEach(hb => { if (habits[hb.id]) counts[hb.id]++; });
  });
  return { counts, dates };
}
