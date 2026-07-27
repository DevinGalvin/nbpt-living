// Fetch raw OpenStreetMap data for the selected town's bbox (towns/<id>/town.json).
// Saves to data/<town>/raw/overpass.json. Run: npm run fetch-osm  (or TOWN=salem ...)
//
// Big/dense frames can 504 every Overpass mirror as one query (Beverly did) —
// set OSM_TILES=2x3 (rows x cols) to split the SEARCH into a grid of sub-bboxes
// fetched sequentially and merged. Output geometry is always clipped to the FULL
// town bbox (`out geom` takes a clip bbox independent of the search bbox), so a
// way found from two tiles emits identical full-frame geometry and merging can
// safely dedupe by element id. Default 1x1 = the original single query.
//
// Data © OpenStreetMap contributors, ODbL — openstreetmap.org/copyright

import { mkdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { loadTown } from './lib/town.mjs';

const T = await loadTown();
// S, W, N, E — the whole town plus its natural frame (rivers, parks, barrier
// beaches); the frame notes for each town live next to its bbox in town.json.
const FULL = [T.BBOX.s, T.BBOX.w, T.BBOX.n, T.BBOX.e].join(',');

// Ways are clipped to the (full) bbox; relations are fetched with FULL geometry so
// their rings assemble exactly (the Merrimack water relation spans far beyond the
// bbox — clipped fragments don't stitch reliably, full rings do).
// Keep the resource ask modest: schedulers DEFER queries whose requested
// timeout/maxsize exceed your per-IP quota, and the HTTP gateway 504s at ~5min
// while the query is still queued — a huge ask makes every mirror "time out"
// even when the query itself would run in seconds. Tiles need small asks.
// Pause between tiles. A city-sized frame needs MANY tiles (Boston runs 8x8),
// and Overpass starts returning 429 well before the tiles themselves are a
// problem — the limit is request RATE, not query size. Raise OSM_DELAY for a
// long run; the 2 s default keeps every existing town's fetch as it was.
const DELAY = Number(process.env.OSM_DELAY || 2000);
const TIMEOUT = Number(process.env.OSM_TIMEOUT || 180);
const MAXSIZE = Number(process.env.OSM_MAXSIZE || 268435456); // 256 MB
const buildQuery = (search) => `
[out:json][timeout:${TIMEOUT}][maxsize:${MAXSIZE}];
(
  way["highway"](${search});
  way["railway"~"^(rail|light_rail)$"](${search});
  way["building"](${search});
  way["natural"~"^(water|wetland|beach|sand|coastline|wood|scrub|grassland|shoal|tree_row)$"](${search});
  way["leisure"="swimming_pool"](${search});
  way["barrier"~"^(fence|hedge|wall|retaining_wall)$"](${search});
  node["natural"="tree"](${search});
  way["landuse"~"^(grass|forest|meadow|cemetery|recreation_ground|village_green|orchard|farmland|retail|commercial)$"](${search});
  way["leisure"~"^(park|pitch|playground|garden|track|golf_course|nature_reserve|dog_park|stadium)$"](${search});
  way["man_made"~"^(pier|breakwater|groyne)$"](${search});
  way["aeroway"](${search});
  node["aeroway"](${search});
  way["power"~"^(line|minor_line)$"](${search});
  node["power"~"^(pole|tower)$"](${search});
  way["place"="square"](${search});
  way["amenity"~"^(parking|fountain|marketplace)$"](${search});
  node["amenity"](${search});
  node["shop"](${search});
  node["tourism"](${search});
  node["historic"](${search});
  node["leisure"](${search});
  node["man_made"="lighthouse"](${search});
);
out geom(${FULL});
(
  relation["building"](${search});
  relation["natural"~"^(water|wetland)$"](${search});
  relation["leisure"~"^(park|garden|stadium)$"](${search});
);
out geom;
`;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

// A city-sized fetch is 64 sequential tiles, and losing tile 50 throws away the
// whole run. Rate limits are TEMPORARY, so sweep the endpoint list repeatedly
// with a growing backoff instead of giving up after one pass.
const ROUNDS = Number(process.env.OSM_ROUNDS || 4);

async function fetchOne(query, label) {
  let lastErr;
  for (let round = 0; round < ROUNDS; round++) {
    if (round) {
      const wait = 30000 * round;   // 30 s, 60 s, 90 s — 429s clear on their own
      console.warn(`[${label}] all endpoints failed; waiting ${wait / 1000}s (round ${round + 1}/${ROUNDS})`);
      await new Promise((ok) => setTimeout(ok, wait));
    }
    for (const url of ENDPOINTS) {
      try {
        console.log(`[${label}] Querying ${url} ...`);
        const t0 = Date.now();
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'NBPT-Living-MapBuilder/0.1 (one-time prototype data pull; respects usage policy)',
            'Accept': 'application/json'
          },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout((TIMEOUT + 60) * 1000)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
        const text = await res.text();
        const json = JSON.parse(text); // validate
        console.log(`[${label}] OK in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${(text.length / 1e6).toFixed(1)} MB, ${json.elements.length} elements`);
        return json;
      } catch (err) {
        console.warn(`[${label}] Failed: ${err.message}`);
        lastErr = err;
      }
    }
  }
  throw lastErr;
}

async function run() {
  await mkdir(T.rawDir, { recursive: true });
  const [rows, cols] = (process.env.OSM_TILES || '1x1').split('x').map(Number);
  const dLat = (T.BBOX.n - T.BBOX.s) / rows;
  const dLon = (T.BBOX.e - T.BBOX.w) / cols;

  // Elements STREAM to disk as each tile lands; only the seen-key set is held.
  // A fine tiling of a city (Boston runs 8x8) merges to ~400 MB — building that
  // as one `JSON.stringify` string, on top of every element still live in a Map,
  // exhausts the heap. Output is byte-identical to the old whole-object write:
  // the key order {version, generator, osm3s, elements} is Overpass's own, and
  // first-occurrence-wins dedupe is unchanged.
  const seen = new Set();   // "type/id" — tiles emit identical copies of a shared way
  const out = createWriteStream(new URL('overpass.json', T.rawDir));
  const write = (s) => new Promise((ok) => { if (!out.write(s)) out.once('drain', ok); else ok(); });
  let started = false, first = true, bytes = 0;
  const counts = {};

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = [
        T.BBOX.s + r * dLat, T.BBOX.w + c * dLon,
        T.BBOX.s + (r + 1) * dLat, T.BBOX.w + (c + 1) * dLon
      ].join(',');
      const label = rows * cols === 1 ? 'full' : `tile ${r * cols + c + 1}/${rows * cols}`;
      const json = await fetchOne(buildQuery(tile), label);
      if (!started) {
        const head = `{"version":${JSON.stringify(json.version ?? 0.6)},`
          + `"generator":${JSON.stringify(json.generator ?? 'Overpass API')},`
          + `"osm3s":${JSON.stringify(json.osm3s ?? {})},"elements":[`;
        await write(head); bytes += head.length; started = true;
      }
      let fresh = 0;
      for (const el of json.elements) {
        const key = `${el.type}/${el.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const s = (first ? '' : ',') + JSON.stringify(el);
        await write(s); bytes += s.length; first = false; fresh++;
        counts[el.type] = (counts[el.type] || 0) + 1;
      }
      console.log(`[${label}] +${fresh} new elements (${(bytes / 1e6).toFixed(1)} MB written, ${seen.size} total)`);
      if (rows * cols > 1) await new Promise((ok) => setTimeout(ok, DELAY)); // be polite between tiles
    }
  }

  await write(']}'); bytes += 2;
  await new Promise((ok) => out.end(ok));
  console.log(`Merged ${(bytes / 1e6).toFixed(1)} MB`);
  console.log('Element counts:', counts);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
