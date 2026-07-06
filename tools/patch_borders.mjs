// In-place town-borders patch: bakes world.towns + world.signs into the town's
// built world.json from data/<town>/raw/boundaries.json (fetched by
// tools/fetch_boundaries.mjs, usually via the fetch-data CI workflow) — no full
// world rebuild needed. Idempotent: re-running replaces both sections.
//
// Run: node tools/patch_borders.mjs   (or TOWN=salem …)

import { readFile, writeFile } from 'node:fs/promises';
import { loadTown } from './lib/town.mjs';
import { bakeBorders } from './lib/borders.mjs';

const T = await loadTown();
const worldUrl = new URL('world.json', T.publicDir);
const world = JSON.parse(await readFile(worldUrl, 'utf8'));
const boundaries = JSON.parse(await readFile(new URL('boundaries.json', T.rawDir), 'utf8'));

const { towns, signs } = bakeBorders(world, boundaries, T.px);
world.towns = towns;
world.signs = signs;
await writeFile(worldUrl, JSON.stringify(world));

const perTown = {};
for (const s of signs) perTown[s.n] = (perTown[s.n] || 0) + 1;
console.log(`Patched towns/${T.id}/public/world.json:`);
console.log(`  municipalities: ${towns.map((t) => `${t.n}(${t.p.length} ring${t.p.length > 1 ? 's' : ''})`).join(', ')}`);
console.log(`  welcome signs: ${signs.length} — ${Object.entries(perTown).map(([n, c]) => `${n}: ${c}`).join(', ')}`);
