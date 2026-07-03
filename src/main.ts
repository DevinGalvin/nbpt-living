import { Game } from './game/Game';
import { Terrain } from './world/terrain';
import type { WorldData } from './world/types';

// Build stamp (injected by Vite — see vite.config.ts). Lets you confirm which
// source commit is live: open the console, or read `window.__build`.
declare const __BUILD__: string;
(window as unknown as { __build?: string }).__build = __BUILD__;
console.info(`Clipper Town — build ${__BUILD__}`);

// Repeat-visit/offline cache: sw.js serves world.json, heights.bin and the hashed
// bundle cache-first from a per-build cache (see public/sw.js). The registration
// URL carries the build stamp so each deploy refreshes the cache exactly once.
// Relative path: under /salem/ this registers /salem/sw.js scoped to /salem/.
if ('serviceWorker' in navigator && !(import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
  navigator.serviceWorker.register(`sw.js?v=${__BUILD__}`).catch(() => {});
}


async function boot() {
  // single-file share builds inline the map + terrain as globals
  const inline = window as unknown as { __NBPT_WORLD__?: WorldData; __NBPT_HEIGHTS__?: string };
  const [world, terrain] = await Promise.all([
    inline.__NBPT_WORLD__
      ? Promise.resolve(inline.__NBPT_WORLD__)
      : fetch('world.json').then((r) => r.json() as Promise<WorldData>),
    inline.__NBPT_HEIGHTS__
      ? Promise.resolve(Terrain.fromBase64(inline.__NBPT_HEIGHTS__))
      : Terrain.load('heights.bin')
  ]);
  new Game(world, terrain); // debug hooks live on window.nbpt (see Game ctor)
}

boot().catch((err) => {
  console.error(err);
  const el = document.querySelector('#loading .sub');
  if (el) el.textContent = 'FAILED TO LOAD — SEE CONSOLE';
});
