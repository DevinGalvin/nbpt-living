// Landmark candidate finder — the honest way to build a town's fast-travel
// roster. Reads the BUILT world.json and prints named features that are
// genuinely inside the town, each with a coordinate that is genuinely on the
// feature. Paste the winners into towns/<id>/map.mjs.
//
//   TOWN=rockport node tools/landmark_candidates.mjs [--all] [--min <m2>]
//
// This exists because two traps cost real time on Marblehead:
//
//   1. "In the bbox" is NOT "in the town". A town's bbox deliberately reaches
//      into its neighbours for framing — Marblehead's contains Salem's entire
//      witch-museum district. Every candidate here is point-in-polygon tested
//      against the town's OWN municipal boundary (world.towns, from
//      fetch_boundaries).
//   2. A crescent polygon's CENTROID can fall outside it. Two Marblehead
//      beaches centroided into the open ocean. Polys here get a
//      pole-of-inaccessibility style interior point (grid search maximising
//      distance to the nearest edge), then that point is re-checked against the
//      poly and against water.
//
// Nothing is guessed: if a feature isn't named in OSM it will not appear, and
// you should NOT invent a coordinate for it (add it via manualBuildings or fix
// OSM instead).
import { readFile } from 'node:fs/promises';
import { loadTown } from './lib/town.mjs';

const T = await loadTown();
const world = JSON.parse(await readFile(new URL('world.json', T.publicDir), 'utf8'));
const ALL = process.argv.includes('--all');
const MIN_M2 = Number((process.argv.find((a, i) => process.argv[i - 1] === '--min') ?? 0)) || 0;

const ringHas = (x, y, pts) => {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const polyHas = (x, y, p) => {
  if (!ringHas(x, y, p.p)) return false;
  if (p.h) for (const h of p.h) if (ringHas(x, y, h)) return false;
  return true;
};
const centroid = (p) => {
  let x = 0, y = 0; const n = p.length / 2;
  for (let i = 0; i < p.length; i += 2) { x += p[i]; y += p[i + 1]; }
  return [Math.round(x / n), Math.round(y / n)];
};
const areaOf = (p) => {
  let a = 0;
  for (let i = 0; i < p.length; i += 2) { const j = (i + 2) % p.length; a += p[i] * p[j + 1] - p[j] * p[i + 1]; }
  return Math.abs(a / 2);
};

// the town's own outline (name match against the town config)
const self = (world.towns || []).find((t) => t.n === T.cfg.name)
  || (world.towns || []).find((t) => T.cfg.name.startsWith(t.n));
if (!self) {
  console.error(`✗ no boundary for "${T.cfg.name}" in world.towns — run fetch_boundaries + rebuild first.`);
  process.exit(1);
}
const inTown = (x, y) => self.p.some((r) => ringHas(x, y, r));
const wet = (x, y) => (world.polys || []).some((p) => (p.k === 'ocean' || p.k === 'water') && polyHas(x, y, p));

// a point actually ON the polygon, as far from any edge as a coarse grid finds
function interiorPoint(p) {
  const pts = p.p;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    x0 = Math.min(x0, pts[i]); x1 = Math.max(x1, pts[i]);
    y0 = Math.min(y0, pts[i + 1]); y1 = Math.max(y1, pts[i + 1]);
  }
  const edgeD2 = (x, y) => {
    let m = Infinity;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i], ay = pts[i + 1], ex = pts[i + 2] - ax, ey = pts[i + 3] - ay;
      const l2 = ex * ex + ey * ey || 1;
      let t = ((x - ax) * ex + (y - ay) * ey) / l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      m = Math.min(m, (ax + ex * t - x) ** 2 + (ay + ey * t - y) ** 2);
    }
    return m;
  };
  let best = null, bd = -1;
  const N = 36;
  for (let i = 1; i < N; i++) for (let j = 1; j < N; j++) {
    const x = x0 + ((x1 - x0) * i) / N, y = y0 + ((y1 - y0) * j) / N;
    if (!polyHas(x, y, p)) continue;
    const d = edgeD2(x, y);
    if (d > bd) { bd = d; best = [Math.round(x), Math.round(y)]; }
  }
  return best ?? centroid(pts);
}

const rows = [];
const seen = new Set();
const push = (r) => { const k = r.name + '|' + r.kind; if (!seen.has(k)) { seen.add(k); rows.push(r); } };

for (const p of world.polys || []) {
  if (!p.n) continue;
  const m2 = Math.round(areaOf(p.p) / (T.PX_PER_M * T.PX_PER_M));
  if (m2 < MIN_M2) continue;
  const pt = interiorPoint(p);
  if (!inTown(pt[0], pt[1])) continue;
  push({ name: p.n, kind: 'poly:' + p.k, x: pt[0], y: pt[1], m2, note: wet(pt[0], pt[1]) ? 'IN WATER' : '' });
}
for (const b of world.buildings || []) {
  if (!b.n) continue;
  const c = centroid(b.p);
  if (!inTown(c[0], c[1])) continue;
  push({ name: b.n, kind: 'bldg', x: c[0], y: c[1], m2: Math.round(areaOf(b.p) / (T.PX_PER_M * T.PX_PER_M)), note: '' });
}
for (const p of world.pois || []) {
  if (!p.n || !inTown(p.x, p.y)) continue;
  push({ name: p.n, kind: 'poi:' + p.k, x: p.x, y: p.y, m2: 0, note: '' });
}
for (const l of world.labels || []) {
  if (!l.t || !inTown(l.x, l.y)) continue;
  push({ name: l.t, kind: 'label:' + l.k, x: l.x, y: l.y, m2: 0, note: '' });
}

const INTERESTING = /^(poly:(park|sand|grass|cemetery|reserve|water|playground|pitch|wood)|poi:(historic|museum|attraction|lighthouse|artwork|viewpoint|memorial)|label:(area|water))/;
const out = rows
  .filter((r) => ALL || INTERESTING.test(r.kind) || r.kind === 'bldg')
  .sort((a, b) => b.m2 - a.m2 || a.name.localeCompare(b.name));

console.log(`# ${T.cfg.name} — ${out.length} named features inside the municipal boundary`);
console.log('# name | kind | x,y (safe interior point) | area m² | flags');
for (const r of out) {
  console.log(`${r.name.slice(0, 44).padEnd(45)} ${r.kind.padEnd(16)} ${String(r.x).padStart(7)},${String(r.y).padStart(7)}  ${String(r.m2).padStart(8)}  ${r.note}`);
}
