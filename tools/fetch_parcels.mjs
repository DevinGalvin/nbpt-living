// Fetch the town's ASSESSOR PARCELS from MassGIS (Level 3 standardized parcels:
// every taxable lot as a polygon, joined to the assessor's database — storeys,
// style, use code, year built). This is the ground truth Overture's ML height
// can only guess at: "STORIES 2 / Colonial" is what the town itself says about
// the house, and build_world.mjs overlays it onto every footprint (see
// tools/lib/parcels.mjs). Saves data/<town>/raw/parcels.json.
//
// town.json: "massgisTownIds": [292, 273, …] — the MassGIS town IDs whose parcels
// fall in the frame (Swansea is 292; neighbours in frame ride along so their
// houses are right too; Rhode Island has no MassGIS and simply keeps the ML).
// Find an ID: the bucket lists as L3_SHP_M<id>_<NAME>.zip.
//
// Run: TOWN=swansea node tools/fetch_parcels.mjs   (needs internet: MassGIS S3;
// CI runs it in build-world.yml). Data: MassGIS / Commonwealth of Massachusetts,
// free for any use with attribution.

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { createWriteStream, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import shapefile from 'shapefile';
import proj4 from 'proj4';
import { loadTown } from './lib/town.mjs';

const T = await loadTown();
const IDS = T.cfg.massgisTownIds || [];
if (!IDS.length) { console.log(`towns/${T.id}/town.json has no massgisTownIds — no parcels to fetch.`); process.exit(0); }

const BUCKET = 'https://s3.us-east-1.amazonaws.com/download.massgis.digital.mass.gov';
const rawDir = fileURLToPath(T.rawDir);
const tmp = `${rawDir}l3tmp/`;
await mkdir(tmp, { recursive: true });

// MassGIS ships NAD83 Massachusetts Mainland State Plane (metres); the .prj is
// WKT proj4 reads directly. WGS84 for the output, like everything else in raw/.
const B = T.BBOX;
const inFrame = (lon, lat) => lon >= B.w && lon <= B.e && lat >= B.s && lat <= B.n;

const out = [];
let kept = 0, dropped = 0;
for (const id of IDS) {
  const mid = `M${String(id).padStart(3, '0')}`;
  // the bucket names the zip with the town in CAPS; list the prefix to find it
  const list = await (await fetch(`${BUCKET}/?list-type=2&prefix=shapefiles/l3parcels/L3_SHP_${mid}_`)).text();
  const key = (list.match(/<Key>([^<]+\.zip)<\/Key>/) || [])[1];
  if (!key) { console.warn(`no MassGIS L3 package for ${mid} — skipped`); continue; }
  const zip = `${tmp}${mid}.zip`;
  console.log(`Fetching ${key} …`);
  const res = await fetch(`${BUCKET}/${key}`);
  if (!res.ok) { console.warn(`  ${res.status} — skipped`); continue; }
  await pipeline(Readable.fromWeb(res.body), createWriteStream(zip));
  const dir = `${tmp}${mid}/`;
  await rm(dir, { recursive: true, force: true });
  execFileSync('unzip', ['-o', '-q', zip, '-d', dir]);
  // the zip holds one folder; inside: <mid>TaxPar_*.shp (+ .prj) and <mid>Assess_*.dbf
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}${e.name}/`) : [`${d}${e.name}`]);
  const files = walk(dir);
  const shp = files.find((f) => /TaxPar[^/]*\.shp$/i.test(f));
  const dbf = files.find((f) => /Assess[^/]*\.dbf$/i.test(f));
  const prj = files.find((f) => /TaxPar[^/]*\.prj$/i.test(f));
  if (!shp || !dbf || !prj) { console.warn(`  package layout unexpected (${files.length} files) — skipped`); continue; }
  const toWgs = proj4(execFileSync('cat', [prj], { encoding: 'utf8' }).trim(), 'EPSG:4326');
  // assessor rows by LOC_ID (several rows per lot for condos — keep the first with a building)
  const assess = new Map();
  const src = await shapefile.openDbf(dbf);
  for (let r = await src.read(); !r.done; r = await src.read()) {
    const v = r.value, st = Number(v.STORIES) || 0;
    const prev = assess.get(v.LOC_ID);
    if (!prev || (st > 0 && !(Number(prev.STORIES) > 0))) assess.set(v.LOC_ID, v);
  }
  const s2 = await shapefile.open(shp);
  for (let f = await s2.read(); !f.done; f = await s2.read()) {
    const g = f.value.geometry, a = assess.get(f.value.properties.LOC_ID);
    if (!g || !a) { dropped++; continue; }
    const polys = g.type === 'MultiPolygon' ? g.coordinates : [g.coordinates];
    for (const poly of polys) {
      // outer ring only (holes in a tax lot are other lots — they carry their own row)
      const ring = [];
      let last = null;
      for (const [x, y] of poly[0]) {
        const [lon, lat] = toWgs.forward([x, y]);
        // 2 m simplification: lot lines are surveyed to the centimetre and we only
        // need to know which lot a building's centroid is in
        if (last && Math.hypot((lon - last[0]) * 83000, (lat - last[1]) * 111000) < 2) continue;
        ring.push(+lon.toFixed(6), +lat.toFixed(6));
        last = [lon, lat];
      }
      if (ring.length < 6) { dropped++; continue; }
      let cx = 0, cy = 0; for (let i = 0; i < ring.length; i += 2) { cx += ring[i]; cy += ring[i + 1]; }
      cx /= ring.length / 2; cy /= ring.length / 2;
      if (!inFrame(cx, cy)) { dropped++; continue; }
      out.push({
        r: ring,
        st: Number(a.STORIES) || 0,                       // storeys as assessed (1, 1.5, 1.75, 2, 2.5 …)
        sty: (a.STYLE || '').trim(),                      // "Colonial", "Ranch", "Cape Cod", "Raised Ranch", "Strip Stores" …
        use: String(a.USE_CODE || '').trim(),             // MA DOR use code: 101 single-family, 3xx commercial, 4xx industrial, 9xx exempt
        yb: Number(a.YEAR_BUILT) || 0,
        town: id,
      });
      kept++;
    }
  }
  console.log(`  ${mid}: ${kept} parcels in frame so far`);
}
await rm(tmp, { recursive: true, force: true });
await writeFile(new URL('parcels.json', T.rawDir), JSON.stringify({ source: 'MassGIS Level 3 standardized assessors parcels', towns: IDS, parcels: out }));
console.log(`Saved data/${T.id}/raw/parcels.json — ${kept} parcels (${dropped} skipped: no assessor row, tiny, or out of frame)`);
