// Fetch municipal boundaries (OSM admin_level=8 relations) that intersect the
// selected town's bbox — the data behind town borders in-game: the "Entering
// Salisbury" banner and the roadside "Welcome to…" signs. Relations are fetched
// with FULL geometry (their rings extend beyond the bbox; clipped fragments
// don't stitch reliably, full rings do). Saves data/<town>/raw/boundaries.json.
//
// Run: node tools/fetch_boundaries.mjs   (or TOWN=salem …)
// NOTE: needs open internet (Overpass) — runs in CI via .github/workflows/fetch-data.yml.
//
// Data © OpenStreetMap contributors, ODbL — openstreetmap.org/copyright

import { mkdir, writeFile } from 'node:fs/promises';
import { loadTown } from './lib/town.mjs';

const T = await loadTown();
const bbox = [T.BBOX.s, T.BBOX.w, T.BBOX.n, T.BBOX.e].join(',');

const query = `
[out:json][timeout:180][maxsize:536870912];
relation["boundary"="administrative"]["admin_level"="8"](${bbox});
out geom;
`;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

let json = null;
for (const ep of ENDPOINTS) {
  try {
    console.log(`Fetching municipal boundaries from ${ep} …`);
    const res = await fetch(ep, { method: 'POST', body: 'data=' + encodeURIComponent(query) });
    if (!res.ok) { console.warn(`  ${res.status} ${res.statusText}`); continue; }
    json = await res.json();
    break;
  } catch (e) {
    console.warn(`  failed: ${e.message}`);
  }
}
if (!json) { console.error('All Overpass endpoints failed.'); process.exit(1); }

const names = (json.elements || []).map((r) => r.tags?.name).filter(Boolean).sort();
await mkdir(T.rawDir, { recursive: true });
await writeFile(new URL('boundaries.json', T.rawDir), JSON.stringify(json));
console.log(`Saved data/${T.id}/raw/boundaries.json — ${names.length} municipalities: ${names.join(', ')}`);
