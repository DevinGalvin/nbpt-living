// In-place landmark patch: rewrites world.landmarks in the town's built
// world.json from towns/<id>/map.mjs — so landmark curation never needs the
// heavy full rebuild (and the two can never disagree: map.mjs is the single
// source of truth for both this patch and build_world.mjs).
//
// Run: node tools/patch_landmarks.mjs   (or TOWN=salem node tools/patch_landmarks.mjs)

import { readFile, writeFile } from 'node:fs/promises';
import { loadTown } from './lib/town.mjs';

const T = await loadTown();
const url = new URL('world.json', T.publicDir);
const world = JSON.parse(await readFile(url, 'utf8'));
world.landmarks = T.map.landmarks?.({ px: T.px, PX_PER_M: T.PX_PER_M }) ?? [];
await writeFile(url, JSON.stringify(world));
console.log(`Patched ${world.landmarks.length} landmarks into towns/${T.id}/public/world.json:`);
console.log(' ', world.landmarks.map((l) => l.id).join(', '));
