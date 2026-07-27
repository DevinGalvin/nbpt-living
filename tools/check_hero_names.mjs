// Hero-name safety check — run BEFORE adding anything to HEROES in
// src/three/decor.ts.
//
//   TOWN=boston node tools/check_hero_names.mjs             # names on >1 footprint
//   TOWN=boston node tools/check_hero_names.mjs "Trinity Church"   # check one name
//
// WHY: HEROES is keyed by the building's OSM `name`, and the renderer runs the
// builder on EVERY footprint carrying that name. A hero written for one famous
// building will also be stamped onto every namesake in frame — in a city that is
// a real hazard, not a hypothetical one. Boston's frame holds a dozen "Trinity
// Church"-class collisions plus whole chains of branch libraries, fire stations
// and T stations sharing a name.
//
// It also prints each footprint's size, because the usual tell is that one
// candidate is the landmark and the others are a garage or a rowhouse: the
// Charlestown build once rendered USS Cassin Young as a 5.5-storey HOUSE.
//
// If a name collides, do NOT key a hero on it — give the real building a unique
// name via `nameFixes` in towns/<id>/map.mjs first.

import { readFile } from 'node:fs/promises';
import { loadTown } from './lib/town.mjs';

const T = await loadTown();
const world = JSON.parse(await readFile(new URL('world.json', T.publicDir), 'utf8'));
const want = process.argv.slice(2).find((a) => !a.startsWith('--'));

const areaOf = (p) => {
  let a = 0;
  for (let i = 0, n = p.length / 2; i < n; i++) {
    const j = (i + 1) % n;
    a += p[i * 2] * p[j * 2 + 1] - p[j * 2] * p[i * 2 + 1];
  }
  return Math.abs(a) / 2 / (T.PX_PER_M * T.PX_PER_M);   // m²
};
const centroid = (p) => {
  let x = 0, y = 0, n = p.length / 2;
  for (let i = 0; i < n; i++) { x += p[i * 2]; y += p[i * 2 + 1]; }
  return [Math.round(x / n), Math.round(y / n)];
};

const byName = new Map();
for (const b of world.buildings) {
  if (!b.n) continue;
  if (!byName.has(b.n)) byName.set(b.n, []);
  byName.get(b.n).push(b);
}

if (want) {
  const hits = byName.get(want);
  if (!hits) {
    console.log(`"${want}" — NO footprint carries this name in ${T.id}'s world.json.`);
    console.log('A hero keyed on it would never render. Check the exact OSM spelling.');
    process.exit(1);
  }
  console.log(`"${want}" — ${hits.length} footprint${hits.length > 1 ? 's' : ''}:`);
  for (const b of hits) {
    const [x, y] = centroid(b.p);
    console.log(`   ${areaOf(b.p).toFixed(0).padStart(7)} m²  at ${x},${y}  k=${b.k} lv=${b.lv}`);
  }
  console.log(hits.length === 1
    ? '\nSAFE — exactly one footprint. A hero keyed on this name hits only it.'
    : '\nUNSAFE — a hero keyed on this name renders on ALL of the above.\nGive the real one a unique name via nameFixes in towns/<id>/map.mjs first.');
  process.exit(hits.length === 1 ? 0 : 1);
}

const dups = [...byName.entries()].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length);
console.log(`${T.id}: ${byName.size} distinct building names, ${dups.length} of them on more than one footprint.\n`);
for (const [name, list] of dups.slice(0, 60)) {
  const areas = list.map((b) => areaOf(b.p)).sort((a, b) => b - a);
  console.log(`${String(list.length).padStart(3)}x  ${name}`);
  console.log(`      areas m²: ${areas.map((a) => a.toFixed(0)).join(', ')}`);
}
if (dups.length > 60) console.log(`\n… and ${dups.length - 60} more.`);
console.log('\nNone of the above is safe to key a HERO on as-is.');
