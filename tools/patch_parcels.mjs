// In-place assessor patch: re-applies data/<town>/raw/parcels.json (from
// tools/fetch_parcels.mjs) to the built world.json — storeys and kinds from the
// town's own records — without the full rebuild. build_world.mjs runs the
// identical overlay (tools/lib/parcels.mjs). One caveat vs the bake: explicit
// OSM building:levels tags are not known here, so a bake is the canonical
// result; this is for checking the overlay quickly.
//
// Run: TOWN=swansea node tools/patch_parcels.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { loadTown } from './lib/town.mjs';
import { overlayParcels } from './lib/parcels.mjs';

const T = await loadTown();
const url = new URL('world.json', T.publicDir);
const world = JSON.parse(await readFile(url, 'utf8'));
const pj = JSON.parse(await readFile(new URL('parcels.json', T.rawDir), 'utf8'));

function ringArea(p) { let a = 0; for (let i = 0, n = p.length / 2; i < n; i++) { const j = (i + 1) % n; a += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; } return a / 2; }
function centroid(p) { let x = 0, y = 0, n = p.length / 2; for (let i = 0; i < p.length; i += 2) { x += p[i]; y += p[i + 1]; } return [x / n, y / n]; }
function pointInRing(x, y, p) { let inside = false; for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) { const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; }

const stats = overlayParcels(world, pj.parcels, T.px, T.PX_PER_M, { ringArea, centroid, pointInRing });
await writeFile(url, JSON.stringify(world));
console.log(`Assessor overlay (${pj.source}) patched into towns/${T.id}/public/world.json:`, stats);
