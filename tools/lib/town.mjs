// Per-town config loader — the single seam for every map-pipeline tool.
// Town selection: --town=<id> argv or TOWN env var, default 'nbpt'.
//
// towns/<id>/town.json  = identity + geodesy (origin, bbox, projection)
// towns/<id>/map.mjs    = curation data + hooks (landmarks, spot fixes, QA)
// towns/<id>/public/    = the town's built payload (world.json, heights.bin)
// data/<id>/raw/        = fetched source data (overpass.json, heights.json)

import { readFileSync } from 'node:fs';

export async function loadTown() {
  const arg = process.argv.find((a) => a.startsWith('--town='));
  const id = (arg ? arg.slice('--town='.length) : process.env.TOWN) || 'nbpt';
  const root = new URL(`../../towns/${id}/`, import.meta.url);
  let cfg;
  try {
    cfg = JSON.parse(readFileSync(new URL('town.json', root), 'utf8'));
  } catch (e) {
    throw new Error(`No town config at towns/${id}/town.json — known towns live under towns/. (${e.message})`);
  }

  const PX_PER_M = cfg.pxPerMeter ?? 8;
  // Degree lengths derived from the origin latitude (standard meridian-arc series).
  // town.json may pin exact values (mPerDegLat/mPerDegLon) so that regenerating an
  // already-shipped world.json stays byte-stable against its historical constants.
  const phi = (cfg.origin.lat * Math.PI) / 180;
  const M_PER_DEG_LAT = cfg.mPerDegLat
    ?? 111132.92 - 559.82 * Math.cos(2 * phi) + 1.175 * Math.cos(4 * phi) - 0.0023 * Math.cos(6 * phi);
  const M_PER_DEG_LON = cfg.mPerDegLon
    ?? 111412.84 * Math.cos(phi) - 93.5 * Math.cos(3 * phi) + 0.118 * Math.cos(5 * phi);

  const px = (lat, lon) => [
    Math.round((lon - cfg.origin.lon) * M_PER_DEG_LON * PX_PER_M),
    Math.round((cfg.origin.lat - lat) * M_PER_DEG_LAT * PX_PER_M)
  ];
  const pxToLat = (y) => cfg.origin.lat - y / (M_PER_DEG_LAT * PX_PER_M);
  const pxToLon = (x) => cfg.origin.lon + x / (M_PER_DEG_LON * PX_PER_M);

  const map = await import(new URL('map.mjs', root));

  console.log(`[town] ${id} — ${cfg.worldName}`);
  return {
    id, cfg, map,
    PX_PER_M, M_PER_DEG_LAT, M_PER_DEG_LON,
    ORIGIN: cfg.origin, BBOX: cfg.bbox,
    px, pxToLat, pxToLon,
    rawDir: new URL(`../../data/${id}/raw/`, import.meta.url),
    publicDir: new URL('public/', root)
  };
}
