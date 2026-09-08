// 🐕 The hang watchdog. A frozen picture with the HUD alive and no error is a main thread
// that never came back — an infinite loop somewhere in a frame — and nothing on the main
// thread can report that, because nothing on it runs again. A Worker can. The frame posts
// a phase label at every step ('life.cyclists', 'chunks', 'render'…); the worker keeps the
// last one and, after 2.5 s of silence while the page is in front, writes it to IndexedDB
// (workers have no localStorage). The next load reads it back: `?diag` shows LAST HANG.
//
// postMessage from a hung main thread still delivers — the message is queued before the
// loop it never leaves. That is the whole trick.

const DB = 'nbpt-watchdog', STORE = 'hang';
export type HangRecord = { phase: string; frame: number; px: number; pz: number; secs: number; at: number; ua: string };

let worker: Worker | null = null;
let lastPhase = '';
let frame = 0;
let lastHang: HangRecord | null = null;
let hidden = false;

const WORKER_SRC = `
let last = { phase: 'boot', frame: 0, px: 0, pz: 0, at: Date.now(), t0: Date.now() }, hidden = false, wrote = false;
onmessage = (e) => {
  const m = e.data;
  if (m.hidden !== undefined) { hidden = m.hidden; return; }
  last = { ...last, ...m, at: Date.now() };
  wrote = false;
};
setInterval(() => {
  if (hidden || wrote) return;
  const silent = Date.now() - last.at;
  if (silent < 2500) return;
  wrote = true;
  const req = indexedDB.open('${DB}', 1);
  req.onupgradeneeded = () => req.result.createObjectStore('${STORE}');
  req.onsuccess = () => {
    const db = req.result;
    const tx = db.transaction('${STORE}', 'readwrite');
    tx.objectStore('${STORE}').put({ phase: last.phase, frame: last.frame, px: last.px, pz: last.pz, secs: Math.round((last.at - last.t0) / 1000), at: last.at, ua: navigator.userAgent.slice(0, 120) }, 'last');
    tx.oncomplete = () => db.close();
  };
}, 500);
`;

export function startWatchdog() {
  if (worker || typeof Worker === 'undefined' || typeof indexedDB === 'undefined') return;
  try {
    worker = new Worker(URL.createObjectURL(new Blob([WORKER_SRC], { type: 'text/javascript' })));
  } catch { worker = null; return; }
  // a backgrounded tab stops its frames on purpose; that is not a hang
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; worker?.postMessage({ hidden }); });
  // read the previous run's verdict, then clear it
  try {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(STORE, 'readwrite');
      const get = tx.objectStore(STORE).get('last');
      get.onsuccess = () => {
        if (get.result) {
          lastHang = get.result as HangRecord;
          console.warn('[nbpt] previous session HUNG (main thread stopped answering) at phase', lastHang.phase, lastHang);
          tx.objectStore(STORE).delete('last');
        }
      };
      tx.oncomplete = () => db.close();
    };
  } catch { /* private mode */ }
}

/** the frame says where it is; only a change is posted, so this is cheap to call often */
export function phase(p: string) {
  if (p === lastPhase || !worker) return;
  lastPhase = p;
  worker.postMessage({ phase: p, frame });
}

/** once a frame, with where the kid stands */
export function heartbeat(px: number, pz: number) {
  frame++;
  lastPhase = 'frame-end';
  worker?.postMessage({ phase: 'frame-end', frame, px: Math.round(px), pz: Math.round(pz) });
}

export function previousHang(): HangRecord | null { return lastHang; }
