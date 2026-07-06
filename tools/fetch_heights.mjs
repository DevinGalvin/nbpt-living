// Fetch real building heights for the town bbox from the Overture Maps buildings
// theme (merges OSM + Microsoft ML + Esri; ODbL-compatible). Saves compact rows to
// data/raw/heights.json: [lon, lat, height_m|null, num_floors|null] per feature
// (lon/lat = footprint centroid). build_world.mjs overlays these onto buildings
// whose lv would otherwise be a guess (no OSM building:levels tag).
//
// Needs the `duckdb` CLI (brew install duckdb) — queries the release GeoParquet
// straight off S3, no download of the full dataset.
//
// Run: node tools/fetch_heights.mjs
//
// Data © Overture Maps Foundation / OpenStreetMap contributors / Microsoft / Esri.

import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { loadTown } from './lib/town.mjs';

const T = await loadTown();
const RELEASE = '2026-06-17.0';
const BBOX = T.BBOX; // per-town, from towns/<id>/town.json

const sql = `
INSTALL httpfs; LOAD httpfs; INSTALL spatial; LOAD spatial;
SET s3_region='us-west-2';
SELECT ST_X(ST_Centroid(geometry)) AS lon,
       ST_Y(ST_Centroid(geometry)) AS lat,
       height,
       num_floors
FROM read_parquet('s3://overturemaps-us-west-2/release/${RELEASE}/theme=buildings/type=building/*', hive_partitioning=1)
WHERE bbox.xmin >= ${BBOX.w} AND bbox.xmax <= ${BBOX.e}
  AND bbox.ymin >= ${BBOX.s} AND bbox.ymax <= ${BBOX.n}
  AND (height IS NOT NULL OR num_floors IS NOT NULL);
`;

console.log(`Querying Overture ${RELEASE} buildings for bbox`, BBOX, '…');
const out = execFileSync('duckdb', ['-json', '-c', sql], {
  encoding: 'utf8',
  maxBuffer: 512 * 1024 * 1024,
  timeout: 15 * 60 * 1000,
});
const rows = JSON.parse(out || '[]');

// compact: 6dp lon/lat (~0.1 m), 1dp height
const features = rows.map((r) => [
  +r.lon.toFixed(6),
  +r.lat.toFixed(6),
  r.height == null ? null : +r.height.toFixed(1),
  r.num_floors ?? null,
]);

await mkdir(T.rawDir, { recursive: true });
await writeFile(
  new URL('heights.json', T.rawDir),
  JSON.stringify({ release: RELEASE, bbox: BBOX, cols: ['lon', 'lat', 'height_m', 'num_floors'], features }),
);

const withH = features.filter((f) => f[2] != null).length;
const withF = features.filter((f) => f[3] != null).length;
console.log(`Saved data/${T.id}/raw/heights.json: ${features.length} features (${withH} with height, ${withF} with num_floors)`);
