#!/usr/bin/env node
// Verify every 🏛 discovery marker in a town stands on ground a kid can actually
// reach: not in the ocean, not inside a building, not on top of a pond.
//
//   node tools/check_markers.mjs gloucester
//   node tools/check_markers.mjs            # every town that ships markers
//
// WHY THIS EXISTS. The first six Newburyport markers were placed by eyeballing
// coordinates and two of them were wrong — one inside the Joppa Flats Education
// Center, one floating in Frog Pond. The obvious fix was to probe the running game
// (index.isWaterAt / isBlocked / buildingTopAt), but that is a trap: the collision
// grid is only built for STREAMED chunks, so a probe of anywhere the player is not
// standing reports garbage, and a backgrounded tab (which throttles rAF, so nothing
// streams at all) reports EVERYTHING as blocked. Reading world.json straight off
// disk has none of that: it is the same data the game loads, it covers the whole
// map at once, and it gives the same answer every time.
//
// Note `island` and `pier` are NOT failures — an island is land, and the piers are
// walkable decks (Gloucester's greasy pole is a deliberate walkable set-piece).

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WET = new Set(['ocean', 'water', 'pool']);

// even-odd point-in-polygon over the flat [x0,y0,x1,y1,…] arrays world.json uses
function inPoly(x, y, p) {
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// world.json stores building outlines the same flat way
function inBuilding(x, y, b) {
  return inPoly(x, y, b.p);
}

async function loadMarkers(town) {
  const f = join(ROOT, 'src/towns', town, 'history.ts');
  if (!existsSync(f)) return null;
  // the marker files are plain data; pull the fields out rather than transpiling TS
  const src = readFileSync(f, 'utf8');
  const out = [];
  // Tolerate any fields between z and title (icon:, q:, whatever comes next) — the
  // first version anchored title directly after z, so adding `icon:` made this match
  // NOTHING and the checker reported "all clear" for a file it had not read.
  const re = /id:\s*'([^']+)',\s*x:\s*(-?\d+),\s*z:\s*(-?\d+),[\s\S]{0,120}?title:\s*'((?:[^'\\]|\\.)*)'/g;
  let m;
  while ((m = re.exec(src))) out.push({ id: m[1], x: +m[2], z: +m[3], title: m[4].replace(/\\'/g, "'") });
  // A history.ts that parses to zero markers is a BROKEN PARSER, not a clean town.
  // Fail loudly: silent success is the worst possible outcome for a safety check.
  if (!out.length) {
    console.error(`\n${town}: history.ts exists but NO markers parsed — the marker regex is stale. Fix it before trusting any result.`);
    process.exit(2);
  }
  return out;
}

async function checkTown(town) {
  const markers = await loadMarkers(town);
  if (!markers || !markers.length) return null;
  const wf = join(ROOT, 'towns', town, 'public/world.json');
  if (!existsSync(wf)) {
    console.log(`\n${town}: no built world.json — run build-world first`);
    return { town, fails: [], skipped: true };
  }
  const w = JSON.parse(readFileSync(wf, 'utf8'));
  const wet = w.polys.filter((p) => WET.has(p.k));
  const islands = w.polys.filter((p) => p.k === 'island');
  const piers = w.polys.filter((p) => p.k === 'pier');

  // A marker over water is fine if it is standing on something: an island, a pier
  // deck, or a BRIDGE. Newburyport's chain-bridge plaque is mid-river on purpose —
  // without this the checker "fixes" a marker that was right all along.
  const onRoad = (x, y) => (w.roads || []).some((r) => {
    const p = r.p;
    for (let i = 0; i < p.length - 2; i += 2) {
      const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3];
      const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
      const t = l2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2)) : 0;
      const cx = ax + t * dx - x, cy = ay + t * dy - y;
      if (cx * cx + cy * cy <= 60 * 60) return true;
    }
    return false;
  });

  const fails = [];
  for (const mk of markers) {
    const reasons = [];
    if (wet.some((p) => inPoly(mk.x, mk.z, p.p))
      && !islands.some((p) => inPoly(mk.x, mk.z, p.p))
      && !piers.some((p) => inPoly(mk.x, mk.z, p.p))
      && !onRoad(mk.x, mk.z)) reasons.push('IN WATER');
    const hit = w.buildings.find((b) => inBuilding(mk.x, mk.z, b));
    if (hit) reasons.push('INSIDE A BUILDING');
    // two plaques closer than the 54px pickup radius fight over the READ button
    const near = markers.find((o) => o !== mk && Math.hypot(o.x - mk.x, o.z - mk.z) < 120);
    if (near) reasons.push(`TOO CLOSE TO ${near.id}`);
    if (reasons.length) fails.push({ ...mk, reasons });
  }

  // nearest spot that is dry, outside every building, and clear of other plaques —
  // spiralled outward so the suggestion stays as close to the real site as possible
  const clear = (x, y) => {
    if (wet.some((p) => inPoly(x, y, p.p))
      && !islands.some((p) => inPoly(x, y, p.p))
      && !piers.some((p) => inPoly(x, y, p.p))) return false;
    if (w.buildings.some((b) => inBuilding(x, y, b))) return false;
    return true;
  };
  const suggest = (mk) => {
    for (let r = 40; r <= 900; r += 20) {
      for (let a = 0; a < 48; a++) {
        const th = (a / 48) * Math.PI * 2;
        const x = Math.round(mk.x + Math.cos(th) * r), y = Math.round(mk.z + Math.sin(th) * r);
        if (!clear(x, y)) continue;
        if (markers.some((o) => o !== mk && Math.hypot(o.x - x, o.z - y) < 120)) continue;
        return { x, z: y, moved: r };
      }
    }
    return null;
  };

  console.log(`\n${town}: ${markers.length} markers, ${fails.length} problem${fails.length === 1 ? '' : 's'}`);
  for (const f of fails) {
    const s = suggest(f);
    console.log(`  ✗ ${f.id.padEnd(20)} (${f.x}, ${f.z})  ${f.reasons.join(' + ')}`
      + (s ? `\n      → try x: ${s.x}, z: ${s.z}  (${s.moved}px away)` : '\n      → no clear ground within 900px — pick a new site'));
  }
  if (!fails.length) console.log('  ✓ all clear');
  return { town, fails };
}

const only = process.argv[2];
const towns = only ? [only] : readdirSync(join(ROOT, 'src/towns')).filter((d) => existsSync(join(ROOT, 'src/towns', d, 'history.ts')));
let bad = 0;
for (const t of towns) {
  const r = await checkTown(t);
  if (r && !r.skipped) bad += r.fails.length;
}
process.exit(bad ? 1 : 0);
