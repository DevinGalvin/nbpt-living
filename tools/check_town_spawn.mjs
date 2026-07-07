// Guard: every town must drop the player at its HEART — a real, named, curated
// landmark (Market Square, Essex St Mall, Ellis Square), never an anonymous
// coordinate. Beverly once dropped players a mile out at Lynch Park instead of
// downtown; this makes "the most memorable part of town" a checked contract,
// not a hope. Fails the build if a town's town.json `spawn.landmark` is missing
// or names a landmark that isn't in its world.json, or if the nudge flings the
// drop far outside that landmark. See docs/TOWNS.md + src/towns/types.ts.
// Runs at the front of `npm run build:all` (CI runs that on every deploy).
import { readFileSync, readdirSync } from 'node:fs';

const TOL = 500;   // px the drop may sit beyond the landmark's own radius (fine-tuning onto walkable ground)
let bad = false;

for (const town of readdirSync('towns')) {
  let cfg, world;
  try { cfg = JSON.parse(readFileSync(`towns/${town}/town.json`, 'utf8')); }
  catch { console.error(`✗ ${town}: towns/${town}/town.json missing or unparseable`); bad = true; continue; }
  try { world = JSON.parse(readFileSync(`towns/${town}/public/world.json`, 'utf8')); }
  catch { console.error(`✗ ${town}: towns/${town}/public/world.json missing — run \`TOWN=${town} npm run map\` first`); bad = true; continue; }

  const spawn = cfg.spawn;
  if (!spawn || typeof spawn.landmark !== 'string') {
    console.error(`✗ ${town}: town.json needs "spawn": { "landmark": "<id>" } — the town's heart (see docs/TOWNS.md)`);
    bad = true;
    continue;
  }

  const lm = (world.landmarks || []).find((l) => l.id === spawn.landmark);
  if (!lm) {
    const ids = (world.landmarks || []).map((l) => l.id).join(', ');
    console.error(`✗ ${town}: spawn.landmark "${spawn.landmark}" is not a landmark in world.json. Available: ${ids}`);
    bad = true;
    continue;
  }

  const dx = spawn.dx ?? 0, dz = spawn.dz ?? 0;
  const off = Math.hypot(dx, dz);
  if (off > (lm.r || 0) + TOL) {
    console.error(`✗ ${town}: spawn nudge (${dx},${dz}) is ${Math.round(off)}px from "${lm.name}" (r=${lm.r}) — that's not "at" the landmark anymore. Pick a closer heart or trim the nudge.`);
    bad = true;
    continue;
  }

  console.log(`${town}: drops at ${lm.name} — ${lm.sub} ✓`);
}

if (bad) process.exit(1);
