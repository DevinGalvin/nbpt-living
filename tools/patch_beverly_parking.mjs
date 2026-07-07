// Apply the Cummings Center parking polygons from towns/beverly/map.mjs to the
// committed towns/beverly/public/world.json IN PLACE — Beverly has no local raw
// OSM (data/beverly/raw is absent), so a full `build-world` can't run here. This
// mirrors what build_world's manualFeatures() hook would add, then re-sorts the
// poly list by the same key build_world uses so paint order (z, then area) is
// identical to a real rebuild. Idempotent: prior runs are tagged and replaced.
//
//   node tools/patch_beverly_parking.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { cummingsParking } from '../towns/beverly/map.mjs';

const PATH = new URL('../towns/beverly/public/world.json', import.meta.url);
const TAG = 'cummings-parking';

const ringArea = (p) => {
  let a = 0;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) a += p[j] * p[i + 1] - p[i] * p[j + 1];
  return a / 2;
};

const world = JSON.parse(readFileSync(PATH, 'utf8'));
const before = world.polys.length;
world.polys = world.polys.filter((p) => p.man !== TAG);
for (const p of cummingsParking) world.polys.push({ ...p, man: TAG });
// same final ordering as build_world.mjs: ascending z, then larger area first
world.polys.sort((a, b) => (a.z - b.z) || (Math.abs(ringArea(b.p)) - Math.abs(ringArea(a.p))));
writeFileSync(PATH, JSON.stringify(world));
console.log(`patched: ${before} -> ${world.polys.length} polys (+${cummingsParking.length} Cummings parking)`);
