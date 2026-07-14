// In-place manual-features patch: re-runs towns/<id>/map.mjs manualFeatures()
// against the town's built world.json — so hand-added geometry (the Greasy Pole
// walkway, Pavilion Beach sand) never needs the heavy full rebuild. map.mjs
// hooks must be idempotent: build_world.mjs runs the same hook, and this patch
// may run repeatedly.
//
// Run: node tools/patch_features.mjs   (or TOWN=gloucester node tools/patch_features.mjs)

import { readFile, writeFile } from 'node:fs/promises';
import { loadTown } from './lib/town.mjs';

const T = await loadTown();
if (!T.map.manualFeatures) {
  console.log(`towns/${T.id}/map.mjs has no manualFeatures() — nothing to patch.`);
  process.exit(0);
}
const url = new URL('world.json', T.publicDir);
const world = JSON.parse(await readFile(url, 'utf8'));
const before = { polys: world.polys.length, pois: world.pois?.length ?? 0, labels: world.labels?.length ?? 0 };
T.map.manualFeatures({ world, px: T.px, PX_PER_M: T.PX_PER_M });
await writeFile(url, JSON.stringify(world));
console.log(`Patched manualFeatures into towns/${T.id}/public/world.json:`);
console.log(`  polys ${before.polys} → ${world.polys.length}, pois ${before.pois} → ${world.pois?.length ?? 0}, labels ${before.labels} → ${world.labels?.length ?? 0}`);
