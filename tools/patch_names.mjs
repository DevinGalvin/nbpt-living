// In-place nameFixes patch: re-applies towns/<id>/map.mjs `nameFixes` to the
// town's built world.json — so binding a POI-node name onto its building
// footprint (which is what makes HEROES and search find it) never needs the
// heavy full rebuild, and never needs the town's raw OSM download to be present
// in this tree. build_world.mjs runs the identical rule, so the two can't drift.
//
// Idempotent by construction: stamping the same name onto the same footprint
// twice is a no-op. Misses are reported the same way build_world reports them.
//
// Run: node tools/patch_names.mjs   (or TOWN=beverly node tools/patch_names.mjs)

import { readFile, writeFile } from 'node:fs/promises';
import { loadTown } from './lib/town.mjs';

// same point-in-ring test build_world.mjs uses (flat [x,y,…] rings)
function pointInRing(x, y, p) {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const T = await loadTown();
const fixes = T.map.nameFixes ?? [];
if (!fixes.length) { console.log(`towns/${T.id}/map.mjs has no nameFixes — nothing to patch.`); process.exit(0); }

const url = new URL('world.json', T.publicDir);
const world = JSON.parse(await readFile(url, 'utf8'));
let hit = 0, missed = 0, already = 0;
for (const f of fixes) {
  const b = world.buildings.find((bb) => pointInRing(f.x, f.y, bb.p));
  if (!b) { console.warn('NAME_FIX missed:', f); missed++; continue; }
  if (b.n === f.n) already++; else { b.n = f.n; hit++; }
}
await writeFile(url, JSON.stringify(world));
console.log(`Patched nameFixes into towns/${T.id}/public/world.json: ${hit} stamped, ${already} already correct, ${missed} missed.`);
