// Clipper Town service worker — repeat visits load from disk, and the game works
// offline once it's been opened. Cache-first for the heavy immutable assets
// (world.json, heights.bin, the hash-named JS, icons); navigations go network-first
// with a cache fallback so a deploy is picked up promptly but offline still boots.
//
// Versioning: main.ts registers `sw.js?v=<build sha>`. A new deploy changes that
// URL → the browser installs this file as a NEW worker → new cache name → activate
// purges the old caches. So world.json is re-downloaded exactly once per deploy.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = `clipper-${VERSION}`;
const CACHEABLE = /\.(js|css|json|bin|png|svg|jpg|webp|webmanifest|woff2?)$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // analytics/leaderboard untouched

  // navigations: fresh HTML when online (it names the current bundle), cached when not
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req)) || Response.error();
      }
    })());
    return;
  }

  if (!CACHEABLE.test(url.pathname)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());
});
