// Fetch municipal boundaries (OSM admin_level=8 relations) that intersect the
// selected town's bbox — the data behind town borders in-game: the "Entering
// Salisbury" banner and the roadside "Welcome to…" signs. Relations are fetched
// with FULL geometry (their rings extend beyond the bbox; clipped fragments
// don't stitch reliably, full rings do). Saves data/<town>/raw/boundaries.json.
//
// NEIGHBOURHOODS: some towns in the set are not municipalities. Charlestown is a
// Boston neighbourhood — OSM relation 4033666, tagged boundary=place +
// place=suburb (from the BPDA neighbourhood boundaries), with no admin_level at
// all. A town opts into the place layer in its town.json:
//
//   "boundaries": { "includePlaces": true, "exclude": ["Boston"] }
//
// `includePlaces` also fetches boundary=place suburbs/neighbourhoods in frame,
// and emits them BEFORE the administrative relations, because the runtime's
// "which town am I in" test takes the first ring that contains the player — the
// more specific boundary has to win. `exclude` drops relations by name: for a
// neighbourhood town the containing city is not a border-crossing entity (you
// are always inside Boston, and its city line runs along the same Somerville
// and Everett borders, which would double every welcome sign).
// Without this, towns/<id>/map.mjs's landmark roster has no boundary to check
// against and tools/landmark_candidates.mjs hard-fails.
//
// Run: node tools/fetch_boundaries.mjs   (or TOWN=salem …)
// NOTE: needs open internet (Overpass) — runs in CI via .github/workflows/fetch-data.yml.
//
// Data © OpenStreetMap contributors, ODbL — openstreetmap.org/copyright

import { mkdir, writeFile } from 'node:fs/promises';
import { loadTown } from './lib/town.mjs';

const T = await loadTown();
const bbox = [T.BBOX.s, T.BBOX.w, T.BBOX.n, T.BBOX.e].join(',');
const B = T.cfg.boundaries || {};
const EXCLUDE = new Set(B.exclude || []);

const query = `
[out:json][timeout:180][maxsize:536870912];
(
  relation["boundary"="administrative"]["admin_level"="8"](${bbox});
${B.includePlaces ? `  relation["boundary"="place"]["place"~"^(suburb|neighbourhood|quarter|borough)$"](${bbox});\n` : ''});
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
    // Send the same headers as tools/fetch_osm.mjs. Without them overpass-api.de
    // answers 406 Not Acceptable EVERY time, so this tool has silently been
    // riding its fallback endpoints (which are slower and rate-limit harder).
    const res = await fetch(ep, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'NBPT-Living-MapBuilder/0.1 (one-time prototype data pull; respects usage policy)',
        'Accept': 'application/json'
      },
      body: 'data=' + encodeURIComponent(query)
    });
    if (!res.ok) { console.warn(`  ${res.status} ${res.statusText}`); continue; }
    json = await res.json();
    break;
  } catch (e) {
    console.warn(`  failed: ${e.message}`);
  }
}
if (!json) { console.error('All Overpass endpoints failed.'); process.exit(1); }

// Drop excluded names, then order specific-before-general: boundary=place
// (neighbourhoods) ahead of admin_level=8 (municipalities), so the runtime's
// first-ring-wins town test resolves to the neighbourhood a player is standing in.
const isPlace = (r) => r.tags?.boundary === 'place';
const dropped = [];
const kept = (json.elements || []).filter((r) => {
  const n = r.tags?.name;
  if (n && EXCLUDE.has(n)) { dropped.push(n); return false; }
  return true;
});
kept.sort((a, b) => (isPlace(a) ? 0 : 1) - (isPlace(b) ? 0 : 1));
json.elements = kept;

const label = (r) => `${r.tags?.name}${isPlace(r) ? ` (${r.tags.place})` : ''}`;
const names = kept.filter((r) => r.tags?.name).map(label);
await mkdir(T.rawDir, { recursive: true });
await writeFile(new URL('boundaries.json', T.rawDir), JSON.stringify(json));
console.log(`Saved data/${T.id}/raw/boundaries.json — ${names.length} boundaries: ${names.join(', ')}`);
if (dropped.length) console.log(`  excluded by town.json: ${dropped.join(', ')}`);
