import { Game } from './game/Game';
import { Terrain } from './world/terrain';
import type { WorldData } from './world/types';

// Build stamp (injected by Vite — see vite.config.ts). Lets you confirm which
// source commit is live: open the console, or read `window.__build`.
declare const __BUILD__: string;
declare const __PAYLOAD_BYTES__: number;
(window as unknown as { __build?: string }).__build = __BUILD__;
console.info(`Clipper Town — build ${__BUILD__}`);

// Repeat-visit/offline cache: sw.js serves world.json, heights.bin and the hashed
// bundle cache-first from a per-build cache (see public/sw.js). The registration
// URL carries the build stamp so each deploy refreshes the cache exactly once.
// Relative path: under /salem/ this registers /salem/sw.js scoped to /salem/.
if ('serviceWorker' in navigator && !(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
  navigator.serviceWorker.register(`sw.js?v=${__BUILD__}`).catch(() => {});
  // a deploy landing mid-session: offer the refresh instead of leaving the player
  // one build behind until their next visit (the SW activates immediately)
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) { hadController = true; return; }   // first install, not an update
    const t = document.createElement('div');
    t.textContent = '✨ Updated — tap to reload the town';
    t.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:90;'
      + 'background:rgba(30,22,40,0.95);color:#f3f1e8;border:1px solid rgba(232,196,79,0.6);'
      + 'border-radius:12px;padding:11px 17px;font:600 13px system-ui,sans-serif;cursor:pointer;'
      + 'box-shadow:0 6px 20px rgba(0,0,0,0.4)';
    t.addEventListener('click', () => location.reload());
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 15000);
  });
}


// Streamed fetch with byte progress. Streams report DECOMPRESSED bytes, which is
// why the expected total is baked in at build time (__PAYLOAD_BYTES__, vite.config)
// rather than read from Content-Length (that's the gzipped size).
async function fetchBytes(url: string, onBytes: (n: number) => void): Promise<Uint8Array> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  if (!res.body) {
    const buf = new Uint8Array(await res.arrayBuffer());
    onBytes(buf.length);
    return buf;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    onBytes(value.length);
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}

async function boot() {
  // single-file share builds inline the map + terrain as globals
  const inline = window as unknown as { __NBPT_WORLD__?: WorldData; __NBPT_HEIGHTS__?: string };
  // First-visit download progress on the loading card. Repeat visits stream from the
  // service-worker cache in milliseconds, so the counter barely flashes.
  const sub = document.querySelector('#loading .sub');
  const subText = sub?.textContent ?? '';
  let got = 0;
  const onBytes = (n: number) => {
    got += n;
    if (!sub) return;
    sub.textContent = __PAYLOAD_BYTES__ > 0
      ? `Loading the town \u00b7 ${Math.min(99, Math.round((got / __PAYLOAD_BYTES__) * 100))}%`
      : `Loading the town \u00b7 ${(got / 1048576).toFixed(1)} MB`;
  };
  const [world, terrain] = await Promise.all([
    inline.__NBPT_WORLD__
      ? Promise.resolve(inline.__NBPT_WORLD__)
      : fetchBytes('world.json', onBytes).then((b) => JSON.parse(new TextDecoder().decode(b)) as WorldData),
    inline.__NBPT_HEIGHTS__
      ? Promise.resolve(Terrain.fromBase64(inline.__NBPT_HEIGHTS__))
      : fetchBytes('heights.bin', onBytes)
          .then((b) => Terrain.fromBuffer(b.buffer as ArrayBuffer))
          .catch((err) => { console.warn('terrain unavailable, world will be flat:', err); return new Terrain(); })
  ]);
  if (sub) sub.textContent = subText; // restore the flavor line while the world meshes build
  new Game(world, terrain); // debug hooks live on window.nbpt (see Game ctor)
}

boot().catch((err) => {
  console.error(err);
  const el = document.querySelector('#loading .sub');
  if (el) el.textContent = 'FAILED TO LOAD — SEE CONSOLE';
});
