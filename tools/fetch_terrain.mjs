// Fetch real elevation for the NBPT Living world from AWS Terrain Tiles
// (terrarium encoding, USGS 3DEP-derived; public bucket, no key needed) and
// resample onto the game grid. Sea-level water bodies from world.json are
// flattened to below sea level so the DEM's bank bleed and unmapped islands
// can't poke through the flat water plane. Output: public/heights.bin
//   header (32 bytes): int32 magic 'NBPT', int32 spacing(px), int32 w, int32 h,
//                      float64 x0(px), float64 y0(px)  [little-endian]
//   then w*h Int16 heights in DECIMETERS, row-major from (x0, y0).
// Terrain tiles: https://registry.opendata.aws/terrain-tiles/

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { PNG } from 'pngjs';
import { loadTown } from './lib/town.mjs';

const T = await loadTown();
const { PX_PER_M } = T;
const Z = 14;
const SPACING = 64; // px between samples (8 m) ≈ source resolution at z14

const world = JSON.parse(await readFile(new URL('world.json', T.publicDir), 'utf8'));
const b = world.meta.bounds;
const MARGIN = 1024;
const x0 = Math.floor((b.minX - MARGIN) / SPACING) * SPACING;
const y0 = Math.floor((b.minY - MARGIN) / SPACING) * SPACING;
const x1 = Math.ceil((b.maxX + MARGIN) / SPACING) * SPACING;
const y1 = Math.ceil((b.maxY + MARGIN) / SPACING) * SPACING;
const W = (x1 - x0) / SPACING + 1;
const H = (y1 - y0) / SPACING + 1;
console.log(`grid ${W} x ${H} (${((W * H * 2) / 1e6).toFixed(1)} MB), spacing ${SPACING}px = ${SPACING / PX_PER_M}m`);

const pxToLat = T.pxToLat;
const pxToLon = T.pxToLon;

const lonToTileX = (lon) => ((lon + 180) / 360) * 2 ** Z;
const latToTileY = (lat) => {
  const r = (lat * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * 2 ** Z;
};

// figure out the tile range
const lat0 = pxToLat(y0), lat1 = pxToLat(y1), lon0 = pxToLon(x0), lon1 = pxToLon(x1);
const tx0 = Math.floor(lonToTileX(lon0)), tx1 = Math.floor(lonToTileX(lon1));
const ty0 = Math.floor(latToTileY(lat0)), ty1 = Math.floor(latToTileY(lat1));
console.log(`tiles z${Z}: x ${tx0}-${tx1}, y ${ty0}-${ty1} (${(tx1 - tx0 + 1) * (ty1 - ty0 + 1)} tiles)`);

await mkdir(new URL('../data/terrain/', import.meta.url), { recursive: true });
const tiles = new Map();
for (let ty = ty0; ty <= ty1; ty++) {
  for (let tx = tx0; tx <= tx1; tx++) {
    const cachePath = new URL(`../data/terrain/${Z}-${tx}-${ty}.png`, import.meta.url);
    let buf;
    if (existsSync(cachePath)) {
      buf = await readFile(cachePath);
    } else {
      const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`;
      process.stdout.write(`fetch ${tx},${ty} ... `);
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      buf = Buffer.from(await res.arrayBuffer());
      await writeFile(cachePath, buf);
      console.log('ok');
    }
    tiles.set(`${tx},${ty}`, PNG.sync.read(buf));
  }
}

// terrarium: h = (R*256 + G + B/256) - 32768, meters
function elevAt(lat, lon) {
  const fx = lonToTileX(lon), fy = latToTileY(lat);
  const tx = Math.floor(fx), ty = Math.floor(fy);
  const png = tiles.get(`${tx},${ty}`);
  if (!png) return 0;
  const px = Math.min(255, Math.max(0, Math.floor((fx - tx) * 256)));
  const py = Math.min(255, Math.max(0, Math.floor((fy - ty) * 256)));
  const i = (py * 256 + px) * 4;
  return png.data[i] * 256 + png.data[i + 1] + png.data[i + 2] / 256 - 32768;
}

const hgrid = new Float64Array(W * H);
for (let gy = 0; gy < H; gy++) {
  for (let gx = 0; gx < W; gx++) {
    let h = elevAt(pxToLat(y0 + gy * SPACING), pxToLon(x0 + gx * SPACING));
    if (!Number.isFinite(h)) h = 0;
    hgrid[gy * W + gx] = Math.max(-2, Math.min(60, h)); // clamp: tidal flats to ridge tops
  }
}

// ---- water mask ----
// The z14 DEM bleeds bank elevation into rivers, and islands the OSM water
// polys treat as open water (Carr/Eagle Island) keep their full height — so
// blue-painted terrain rises out of the flat water plane. Flatten every
// sea-level water body (10th-percentile interior height <= 1 m) to -1 m.
// Elevated basins (frog pond etc.) keep their height: the global water plane
// is already hidden inside their terrain, and sinking them would dig craters.

// grid sample indices covered by the poly: even-odd scanline over all rings,
// so island holes stay unmasked
function coveredSamples(poly) {
  const rings = [poly.p, ...(poly.h || [])];
  let minY = Infinity, maxY = -Infinity;
  for (const r of rings) for (let i = 1; i < r.length; i += 2) {
    if (r[i] < minY) minY = r[i];
    if (r[i] > maxY) maxY = r[i];
  }
  const out = [];
  const gy0 = Math.max(0, Math.ceil((minY - y0) / SPACING));
  const gy1 = Math.min(H - 1, Math.floor((maxY - y0) / SPACING));
  for (let gy = gy0; gy <= gy1; gy++) {
    const sy = y0 + gy * SPACING;
    const xs = [];
    for (const r of rings) {
      for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
        const yi = r[i + 1], yj = r[j + 1];
        if ((yi > sy) !== (yj > sy)) xs.push(r[i] + ((sy - yi) * (r[j] - r[i])) / (yj - yi));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const ga = Math.max(0, Math.ceil((xs[k] - x0) / SPACING));
      const gb = Math.min(W - 1, Math.floor((xs[k + 1] - x0) / SPACING));
      for (let gx = ga; gx <= gb; gx++) out.push(gy * W + gx);
    }
  }
  return out;
}

let flattened = 0, clamped = 0, elevated = 0;
for (const poly of world.polys) {
  if (poly.k !== 'water' && poly.k !== 'ocean') continue;
  const idx = coveredSamples(poly);
  if (!idx.length) continue;
  const sorted = idx.map((i) => hgrid[i]).sort((a, b) => a - b);
  if (sorted[Math.floor(sorted.length * 0.1)] > 1) { elevated++; continue; }
  flattened++;
  for (const i of idx) if (hgrid[i] > -1) { hgrid[i] = -1; clamped++; }
}
console.log(`water mask: flattened ${flattened} water bodies (${clamped} samples), kept ${elevated} elevated basins`);

const out = Buffer.alloc(32 + W * H * 2);
out.writeInt32LE(0x4e425054, 0); // 'NBPT'
out.writeInt32LE(SPACING, 4);
out.writeInt32LE(W, 8);
out.writeInt32LE(H, 12);
out.writeDoubleLE(x0, 16);
out.writeDoubleLE(y0, 24);

let min = Infinity, max = -Infinity;
for (let i = 0; i < W * H; i++) {
  const h = hgrid[i];
  if (h < min) min = h;
  if (h > max) max = h;
  out.writeInt16LE(Math.round(h * 10), 32 + i * 2);
}
console.log(`elevation range: ${min.toFixed(1)}m .. ${max.toFixed(1)}m`);

// QA: known spots (per-town, towns/<id>/map.mjs)
for (const q of T.map.qaElevationSpots ?? []) console.log(`  ${q.name}: ${elevAt(q.lat, q.lon).toFixed(1)}m`);

await writeFile(new URL('heights.bin', T.publicDir), out);
console.log(`Wrote towns/${T.id}/public/heights.bin — ${(out.length / 1e6).toFixed(2)} MB`);
