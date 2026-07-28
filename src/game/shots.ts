import { townKey } from './saves';

// 📸 Discovery photos.
//
// When a kid finds a history marker we grab the actual frame they were looking at
// and keep it as the picture on their card. It is not stock art — it is *their*
// photo of the thing they walked to, which is the whole point: the collection is a
// record of places they went, not a set of pictures we shipped.
//
// STORED IN INDEXEDDB, not localStorage. These are real photographs: a card is 520
// CSS px wide on a DPR-2 phone, so a usable image is ~1000px across, which is 60–100 KB
// of JPEG. localStorage caps around 5 MB and is shared by EVERY town on the origin —
// twelve towns of thirty markers would blow it apart, and the first version's answer
// to that was a 384 px capture at quality 0.62 that upscaled into mush on the card.
// IndexedDB has room to store the photo at the size it is actually displayed.
//
// Reads stay synchronous for callers: `primeShots()` loads the town's photos into an
// in-memory cache once at startup, and `loadShot()` reads that. Writes go to both.

const DB = 'clippertown-shots';
const STORE = 'shots';
const LEGACY_PREFIX = townKey('shot-');      // where photos lived before IndexedDB

const cache = new Map<string, string>();
let dbp: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);      // private mode / blocked — fall back to no photos
    } catch {
      resolve(null);
    }
  });
  return dbp;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore | null> {
  return open().then((db) => {
    if (!db) return null;
    try { return db.transaction(STORE, mode).objectStore(STORE); } catch { return null; }
  });
}

// Load this town's photos into memory, and carry over anything the old
// localStorage build saved so nobody loses an album they already earned.
export async function primeShots(ids: string[]): Promise<void> {
  const store = await tx('readonly');
  if (store) {
    await Promise.all(ids.map((id) => new Promise<void>((resolve) => {
      const r = store.get(townKey('shot-') + id);
      r.onsuccess = () => { if (typeof r.result === 'string') cache.set(id, r.result); resolve(); };
      r.onerror = () => resolve();
    })));
  }
  for (const id of ids) {
    if (cache.has(id)) continue;
    try {
      const old = localStorage.getItem(LEGACY_PREFIX + id);
      if (old) { cache.set(id, old); void saveShot(id, old); localStorage.removeItem(LEGACY_PREFIX + id); }
    } catch { /* private mode */ }
  }
}

export function loadShot(id: string): string | null {
  return cache.get(id) || null;
}

// Best-effort: a full disk drops the picture, never the discovery. The card falls
// back to the marker's icon and the kid never learns anything went wrong.
export function saveShot(id: string, dataUrl: string): boolean {
  cache.set(id, dataUrl);
  void tx('readwrite').then((store) => { try { store?.put(dataUrl, townKey('shot-') + id); } catch { /* full */ } });
  return true;
}

export function clearShots(ids: string[]) {
  for (const id of ids) {
    cache.delete(id);
    try { localStorage.removeItem(LEGACY_PREFIX + id); } catch { /* fine */ }
  }
  void tx('readwrite').then((store) => {
    if (!store) return;
    for (const id of ids) { try { store.delete(townKey('shot-') + id); } catch { /* fine */ } }
  });
}
