// Patches public/world.json's `landmarks` array in place from tools/salem_landmarks.mjs,
// without re-running the full (heavy) world build. Idempotent — overwrites landmarks each run.
// Run: node tools/patch_landmarks.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { SALEM_LM } from './salem_landmarks.mjs';

const url = new URL('../public/world.json', import.meta.url);
const world = JSON.parse(await readFile(url));
world.landmarks = SALEM_LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
await writeFile(url, JSON.stringify(world));
console.log(`Patched world.json — ${world.landmarks.length} landmarks: ${world.landmarks.map((l) => l.id).join(', ')}`);
