// Fetch raw OpenStreetMap data for the selected town's bbox (towns/<id>/town.json).
// Saves to data/<town>/raw/overpass.json. Run: npm run fetch-osm  (or TOWN=salem ...)
//
// Data © OpenStreetMap contributors, ODbL — openstreetmap.org/copyright

import { mkdir, writeFile } from 'node:fs/promises';
import { loadTown } from './lib/town.mjs';

const T = await loadTown();
// S, W, N, E — the whole town plus its natural frame (rivers, parks, barrier
// beaches); the frame notes for each town live next to its bbox in town.json.
const bbox = [T.BBOX.s, T.BBOX.w, T.BBOX.n, T.BBOX.e].join(',');

// Ways are clipped to the bbox; relations are fetched with FULL geometry so their
// rings assemble exactly (the Merrimack water relation spans far beyond the bbox —
// clipped fragments don't stitch reliably, full rings do).
const query = `
[out:json][timeout:300][maxsize:1073741824];
(
  way["highway"](${bbox});
  way["railway"="rail"](${bbox});
  way["building"](${bbox});
  way["natural"~"^(water|wetland|beach|sand|coastline|wood|scrub|grassland|shoal|tree_row)$"](${bbox});
  way["leisure"="swimming_pool"](${bbox});
  way["barrier"~"^(fence|hedge|wall|retaining_wall)$"](${bbox});
  node["natural"="tree"](${bbox});
  way["landuse"~"^(grass|forest|meadow|cemetery|recreation_ground|village_green|orchard|farmland|retail|commercial)$"](${bbox});
  way["leisure"~"^(park|pitch|playground|garden|track|golf_course|nature_reserve|dog_park)$"](${bbox});
  way["man_made"~"^(pier|breakwater|groyne)$"](${bbox});
  way["aeroway"](${bbox});
  node["aeroway"](${bbox});
  way["power"~"^(line|minor_line)$"](${bbox});
  node["power"~"^(pole|tower)$"](${bbox});
  way["place"="square"](${bbox});
  way["amenity"~"^(parking|fountain|marketplace)$"](${bbox});
  node["amenity"](${bbox});
  node["shop"](${bbox});
  node["tourism"](${bbox});
  node["historic"](${bbox});
  node["leisure"](${bbox});
  node["man_made"="lighthouse"](${bbox});
);
out geom(${bbox});
(
  relation["building"](${bbox});
  relation["natural"~"^(water|wetland)$"](${bbox});
  relation["leisure"~"^(park|garden)$"](${bbox});
);
out geom;
`;

const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

async function run() {
  await mkdir(T.rawDir, { recursive: true });
  let lastErr;
  for (const url of ENDPOINTS) {
    try {
      console.log(`Querying ${url} ...`);
      const t0 = Date.now();
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'NBPT-Living-MapBuilder/0.1 (one-time prototype data pull; respects usage policy)',
          'Accept': 'application/json'
        },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(320_000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const text = await res.text();
      const json = JSON.parse(text); // validate
      const counts = {};
      for (const el of json.elements) counts[el.type] = (counts[el.type] || 0) + 1;
      const out = new URL('overpass.json', T.rawDir);
      await writeFile(out, text);
      console.log(`OK in ${((Date.now() - t0) / 1000).toFixed(1)}s — ${(text.length / 1e6).toFixed(1)} MB`);
      console.log('Element counts:', counts);
      return;
    } catch (err) {
      console.warn(`Failed: ${err.message}`);
      lastErr = err;
    }
  }
  throw lastErr;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
