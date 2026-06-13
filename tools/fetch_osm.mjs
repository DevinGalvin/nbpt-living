// Fetch raw OpenStreetMap data for NBPT Living — ALL of Newburyport.
// Saves to data/raw/overpass.json. Run: npm run fetch-osm
//
// Data © OpenStreetMap contributors, ODbL — openstreetmap.org/copyright

import { mkdir, writeFile } from 'node:fs/promises';

// S, W, N, E — the whole city plus its river frame: Maudslay State Park, the
// Artichoke Reservoir, Turkey Hill, Common Pasture, Scotland Road, the I-95
// Whittier Bridge, Chain Bridge/Deer Island, Moseley Woods, Storey Ave, the
// full Merrimack with the Salisbury/Amesbury banks, downtown through Joppa,
// the causeway, airport, and Plum Island point to lighthouse.
const BBOX = [42.763, -70.955, 42.84, -70.795];
const bbox = BBOX.join(',');

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
  await mkdir(new URL('../data/raw/', import.meta.url), { recursive: true });
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
      const out = new URL('../data/raw/overpass.json', import.meta.url);
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
