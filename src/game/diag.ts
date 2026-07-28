// Did the last session CRASH, or was it closed?
//
// Boston runs a phone out of memory and iOS Safari answers by killing the tab — silently,
// with no error and no console. From the outside it looks exactly like the page reloading
// itself, which is why "it breaks after ten seconds" was all anyone could report. Nothing
// on the desktop reproduces it: the whole question is JSC's allocator and Safari's tab
// ceiling, and neither exists in a browser you can attach a profiler to on a Mac.
//
// So the phone reports for itself. On load we write a SENTINEL and keep it fed with the
// live numbers; on a clean exit we clear it. A session that starts and finds a sentinel
// still sitting there was killed rather than closed — and the sentinel says which town it
// was, how long it had survived, and how much it was holding at the end.
//
// ⚠️ Clearing on `pagehide` is deliberate, and it is what keeps this honest. iOS discards
// BACKGROUNDED tabs as a matter of routine — that is not the bug, and counting it would
// bury the real signal in noise. `pagehide` fires when you switch away, so a routine
// background purge clears the sentinel and never reports. Only a kill while the page is
// actually in front is recorded. (`beforeunload` is unreliable on mobile Safari; `pagehide`
// is the one that fires.)
//
// Retire the whole file once the world format goes binary and Boston fits.

const ALIVE = 'nbpt-alive';       // written while playing, cleared on a clean exit
const LAST = 'nbpt-last-crash';   // the post-mortem, kept for the next session to read

export type DiagStats = { chunks: number; texMB: number; geoMB: number };
export type CrashRecord = {
  town: string; secs: number; chunks: number; texMB: number; geoMB: number; ua: string; at: number;
};

const read = (k: string): CrashRecord | null => {
  try { const s = localStorage.getItem(k); return s ? JSON.parse(s) as CrashRecord : null; } catch { return null; }
};
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const drop = (k: string) => { try { localStorage.removeItem(k); } catch { /* private mode */ } };

// Heap, where the browser will say. Chrome only — Safari does not expose it at all, which
// is why the sentinel carries chunk and texture counts instead of asking for a number iOS
// will never give.
export function heapMB(): number {
  const m = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return m ? Math.round(m.usedJSHeapSize / 1048576) : 0;
}

// Start watching. Returns the previous session's post-mortem if it was killed, else null.
//
// Two known limits, both of which fail SAFE — they can only lose a crash report, never
// invent one. Two tabs of the same town share one origin and therefore one sentinel, so
// closing either clears it; and a second call here would orphan the first heartbeat, which
// the guard below prevents. A false "exited clean" costs us a data point; a false "CRASHED"
// would send someone chasing a bug that never happened.
let watching = false;
export function startCrashWatch(town: string, sample: () => DiagStats): CrashRecord | null {
  if (watching) return read(LAST);
  watching = true;
  const stale = read(ALIVE);
  if (stale) { write(LAST, stale); drop(ALIVE); }

  const t0 = Date.now();
  const beat = () => {
    const s = sample();
    write(ALIVE, {
      town, secs: Math.round((Date.now() - t0) / 1000),
      chunks: s.chunks, texMB: s.texMB, geoMB: s.geoMB,
      ua: navigator.userAgent.slice(0, 120), at: Date.now(),
    } satisfies CrashRecord);
  };
  beat();
  // 5 s: often enough to place a crash within a few seconds of what it was doing, rare
  // enough that a synchronous localStorage write is never in anyone's way.
  const timer = window.setInterval(beat, 5000);
  addEventListener('pagehide', () => { clearInterval(timer); drop(ALIVE); });

  return stale;
}

export function lastCrash(): CrashRecord | null { return read(LAST); }

// `?diag` — an on-screen readout, so a phone can be measured without a cable and a Mac.
// Safari's Web Inspector needs both; this needs a URL.
export function mountDiagOverlay(town: string, sample: () => DiagStats, crash: CrashRecord | null) {
  const el = document.createElement('div');
  // sits above the credits/controls strip, which runs along the very bottom on a phone
  el.style.cssText = 'position:fixed;left:8px;bottom:52px;z-index:99999;font:11px/1.45 ui-monospace,Menlo,monospace;'
    + 'background:rgba(12,16,14,0.88);color:#d8e6dc;padding:7px 9px;border-radius:8px;white-space:pre;'
    + 'pointer-events:none;max-width:62vw;border:1px solid rgba(200,164,74,0.45)';
  document.body.appendChild(el);
  const t0 = Date.now();
  const tick = () => {
    const s = sample();
    const h = heapMB();
    el.textContent = `${town}  ${Math.round((Date.now() - t0) / 1000)}s\n`
      + `chunks ${s.chunks}\n`
      + `tex    ${s.texMB} MB\n`
      + `geo    ${s.geoMB} MB\n`
      + (h ? `heap   ${h} MB\n` : 'heap   n/a (Safari)\n')
      + (crash
        ? `\nLAST RUN CRASHED\n${crash.town} died at ${crash.secs}s\nchunks ${crash.chunks} · tex ${crash.texMB} MB`
        : '\nlast run exited clean');
  };
  tick();
  setInterval(tick, 500);
}
