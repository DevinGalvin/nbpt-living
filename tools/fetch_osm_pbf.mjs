// ⚠️⚠️  UNVERIFIED — THIS TOOL HAS NEVER BEEN RUN END TO END.  ⚠️⚠️
//
// It was written for Boston on the documented assumption that "Overpass cannot
// serve Boston, even tiled".  That assumption turned out to be WRONG: a dense
// downtown Boston tile came back from Overpass in 2.3 s, and Boston ships from
// tools/fetch_osm.mjs at OSM_TILES=6x6.  This file was finished but never
// exercised, because the PBF it needs never finished downloading.
//
// So: treat it as a DESIGN SKETCH, not a working tool.  Before relying on it,
// run it against a town that already has a known-good overpass.json (Charlestown
// is small) and diff the two element-for-element.  Do not assume it is correct
// because it looks finished.
//
// Kept rather than deleted because the road may be needed for a frame Overpass
// really cannot serve, and because the two contract details below are the part
// that is easy to get wrong and expensive to rediscover.
//
// Fetch raw OpenStreetMap data for the selected town from a LOCAL Geofabrik
// `.osm.pbf` extract, clipped with osmium.  Run:
//
//   PBF=/path/to/massachusetts-latest.osm.pbf TOWN=boston node tools/fetch_osm_pbf.mjs
//
// Why this exists: Overpass cannot serve a city the size of Boston even tiled —
// raw OSM for it is 150-250 MB and a 2x2 tiling of *Salisbury* already drew a
// 429.  For every town that Overpass CAN serve, keep using tools/fetch_osm.mjs;
// this is the same contract by another road.
//
// THE CONTRACT (identical to fetch_osm.mjs, because build_world.mjs cannot tell
// the two apart): writes data/<town>/raw/overpass.json as {elements:[...]} in
// Overpass `out geom` shape —
//   node      → {type,id,lat,lon,tags}
//   way       → {type,id,tags,geometry:[{lat,lon}|null,...]}
//   relation  → {type,id,tags,members:[{type,ref,role,geometry:[{lat,lon}]}]}
// Two details of that shape are load-bearing and easy to get wrong:
//   1. WAY geometry is CLIPPED to the town bbox, with `null` standing in for
//      each vertex outside it.  build_world's runsOf() splits a way into runs on
//      exactly those nulls, so a road crossing the frame draws only its inside
//      portion.  osmium extract keeps complete ways (nodes outside the box
//      included), so we re-introduce the nulls ourselves.
//   2. RELATION member geometry is NOT clipped.  Rings must assemble exactly;
//      clipped fragments don't stitch reliably, full rings do.  (This is why the
//      Overpass query fetches relations with `out geom` and no clip bbox.)
//
// Memory: everything streams.  Node locations and way geometry live in growable
// typed-array pools, not JS objects, and the output is written through a stream
// rather than built as one 300 MB string — a Boston-sized frame peaks around
// 300 MB RSS instead of exhausting a 16 GB machine.
//
// Data (c) OpenStreetMap contributors, ODbL - openstreetmap.org/copyright

import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, stat, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadTown } from './lib/town.mjs';

const T = await loadTown();
const PBF = process.env.PBF;
if (!PBF) {
  console.error('Set PBF=/path/to/<region>-latest.osm.pbf (Geofabrik). See the header of this file.');
  process.exit(1);
}
await stat(PBF).catch(() => { console.error(`No such PBF: ${PBF}`); process.exit(1); });

const { s: S, w: W, n: N, e: E } = T.BBOX;

// The tag set below mirrors tools/fetch_osm.mjs's Overpass query EXACTLY. If you
// add a tag there, add it here, or the two roads stop producing the same town.
const FILTERS = [
  'w/highway',
  'w/railway=rail',
  'w/building',
  'w/natural=water,wetland,beach,sand,coastline,wood,scrub,grassland,shoal,tree_row',
  'w/leisure=swimming_pool',
  'w/barrier=fence,hedge,wall,retaining_wall',
  'n/natural=tree',
  'w/landuse=grass,forest,meadow,cemetery,recreation_ground,village_green,orchard,farmland,retail,commercial',
  'w/leisure=park,pitch,playground,garden,track,golf_course,nature_reserve,dog_park',
  'w/man_made=pier,breakwater,groyne',
  'w/aeroway',
  'n/aeroway',
  'w/power=line,minor_line',
  'n/power=pole,tower',
  'w/place=square',
  'w/amenity=parking,fountain,marketplace',
  'n/amenity',
  'n/shop',
  'n/tourism',
  'n/historic',
  'n/leisure',
  'n/man_made=lighthouse',
  'r/building',
  'r/natural=water,wetland',
  'r/leisure=park,garden'
];

const workDir = new URL(`../data/${T.id}/work/`, import.meta.url);
await mkdir(workDir, { recursive: true });
await mkdir(T.rawDir, { recursive: true });
const wpath = (f) => fileURLToPath(new URL(f, workDir));

function run(cmd, args, label) {
  return new Promise((ok, fail) => {
    console.log(`[${label}] ${cmd} ${args.join(' ')}`);
    const t0 = Date.now();
    const p = spawn(cmd, args, { stdio: ['ignore', 'inherit', 'inherit'] });
    p.on('error', fail);
    p.on('close', (code) => {
      if (code !== 0) return fail(new Error(`${label} exited ${code}`));
      console.log(`[${label}] done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      ok();
    });
  });
}

// ── 1. clip to the town bbox ────────────────────────────────────────────────
// --strategy=smart keeps ways whole (all their nodes, even outside the box) and
// completes multipolygon relations — which is exactly what the contract needs:
// unclipped rings for relations, and enough vertices to clip ways ourselves.
await run('osmium', [
  'extract', '--overwrite', '--strategy=smart',
  '-b', `${W},${S},${E},${N}`,
  '-o', wpath('bbox.osm.pbf'), PBF
], 'extract');

// ── 2. keep only the tags the world builder reads ───────────────────────────
// Referenced nodes/ways are kept by default (no -R), so way and relation
// geometry stays resolvable.
await run('osmium', [
  'tags-filter', '--overwrite',
  '-o', wpath('tagged.osm.pbf'), wpath('bbox.osm.pbf'), ...FILTERS
], 'tags-filter');

// ── 3. to line-oriented XML so we can stream it ─────────────────────────────
await run('osmium', [
  'cat', '--overwrite', '-f', 'osm',
  '-o', wpath('tagged.osm'), wpath('tagged.osm.pbf')
], 'cat');

// ── 4. stream the XML into the Overpass shape ───────────────────────────────
const XML_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unesc = (s) => s.includes('&')
  ? s.replace(/&(?:#(\d+)|#x([0-9a-fA-F]+)|(\w+));/g, (m, d, h, nm) =>
      d ? String.fromCodePoint(+d) : h ? String.fromCodePoint(parseInt(h, 16)) : (XML_ENT[nm] ?? m))
  : s;
const attr = (line, name) => {
  const i = line.indexOf(` ${name}="`);
  if (i < 0) return null;
  const a = i + name.length + 3;
  const b = line.indexOf('"', a);
  return b < 0 ? null : line.slice(a, b);
};

// Node location pool. OSM ids exceed 2^32, so ids ride in a Float64Array
// (exact to 2^53). osmium writes nodes in ascending id order, which makes the
// pool a sorted index we can binary-search without ever sorting it.
let nCap = 1 << 20, nLen = 0;
let nId = new Float64Array(nCap), nLat = new Float64Array(nCap), nLon = new Float64Array(nCap);
function pushNode(id, lat, lon) {
  if (nLen === nCap) {
    nCap *= 2;
    const gi = new Float64Array(nCap); gi.set(nId); nId = gi;
    const ga = new Float64Array(nCap); ga.set(nLat); nLat = ga;
    const go = new Float64Array(nCap); go.set(nLon); nLon = go;
  }
  nId[nLen] = id; nLat[nLen] = lat; nLon[nLen] = lon; nLen++;
}
let nodesSorted = true;
function findNode(id) {
  let lo = 0, hi = nLen - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1, v = nId[mid];
    if (v === id) return mid;
    if (v < id) lo = mid + 1; else hi = mid - 1;
  }
  return -1;
}

// Way geometry pool: one flat lat/lon run per way, addressed by offset+length.
const wayOff = new Map();           // way id → [offset, pointCount]
let gCap = 1 << 22, gLen = 0;
let gLat = new Float64Array(gCap), gLon = new Float64Array(gCap);
function reserve(k) {
  if (gLen + k <= gCap) return;
  while (gLen + k > gCap) gCap *= 2;
  const a = new Float64Array(gCap); a.set(gLat); gLat = a;
  const b = new Float64Array(gCap); b.set(gLon); gLon = b;
}

const inBox = (lat, lon) => lat >= S && lat <= N && lon >= W && lon <= E;

const out = createWriteStream(fileURLToPath(new URL('overpass.json', T.rawDir)));
const write = (s) => new Promise((ok) => { if (!out.write(s)) out.once('drain', ok); else ok(); });

await write(`{"version":0.6,"generator":"osmium ${'via fetch_osm_pbf.mjs'}","elements":[`);
let first = true;
const counts = { node: 0, way: 0, relation: 0 };
const emit = async (obj) => {
  await write((first ? '' : ',') + JSON.stringify(obj));
  first = false;
  counts[obj.type]++;
};

// Streaming state machine. osmium's XML writer emits one element per line when
// it has no children, and open/child/close lines when it does — handle both.
let cur = null;   // {kind, id, tags, refs[], members[]}

async function closeCur() {
  if (!cur) return;
  const { kind, id, tags, refs, members } = cur;
  cur = null;
  if (kind === 'way') {
    // Stash geometry for the relations that will reference it (relations always
    // follow ways in an OSM file), then emit if the way is tagged.
    reserve(refs.length);
    const off = gLen;
    let kept = 0;
    for (const r of refs) {
      const i = findNode(r);
      if (i < 0) continue;
      gLat[gLen] = nLat[i]; gLon[gLen] = nLon[i]; gLen++; kept++;
    }
    wayOff.set(id, [off, kept]);
    if (tags) {
      // CONTRACT detail 1: clip to the bbox with nulls (see header).
      const geometry = new Array(kept);
      for (let i = 0; i < kept; i++) {
        const la = gLat[off + i], lo = gLon[off + i];
        geometry[i] = inBox(la, lo) ? { lat: la, lon: lo } : null;
      }
      if (geometry.some(Boolean)) await emit({ type: 'way', id, tags, geometry });
    }
  } else if (kind === 'relation') {
    if (!tags) return;
    // CONTRACT detail 2: member geometry is NOT clipped (see header).
    const outMembers = [];
    for (const m of members) {
      if (m.type !== 'way') { outMembers.push(m); continue; }
      const g = wayOff.get(m.ref);
      if (!g) { outMembers.push(m); continue; }
      const [off, len] = g;
      const geometry = new Array(len);
      for (let i = 0; i < len; i++) geometry[i] = { lat: gLat[off + i], lon: gLon[off + i] };
      outMembers.push({ ...m, geometry });
    }
    await emit({ type: 'relation', id, tags, members: outMembers });
  }
}

const rl = createInterface({
  input: createReadStream(wpath('tagged.osm')),
  crlfDelay: Infinity
});

let lines = 0;
for await (const raw of rl) {
  const line = raw.trimStart();
  if (++lines % 5_000_000 === 0) console.log(`  ...${(lines / 1e6).toFixed(0)}M lines`);
  if (line.charCodeAt(0) !== 60 /* '<' */) continue;

  if (line.startsWith('<node')) {
    await closeCur();
    const id = Number(attr(line, 'id'));
    const lat = Number(attr(line, 'lat')), lon = Number(attr(line, 'lon'));
    if (!Number.isFinite(id) || !Number.isFinite(lat)) continue;
    if (nLen && id < nId[nLen - 1]) nodesSorted = false;
    pushNode(id, lat, lon);
    // A node carrying tags is a POI element in its own right. Self-closing =>
    // untagged (geometry only); otherwise its <tag> lines follow.
    if (!line.endsWith('/>')) cur = { kind: 'node', id, lat, lon, tags: null };
    continue;
  }
  if (line.startsWith('<way')) {
    await closeCur();
    cur = { kind: 'way', id: Number(attr(line, 'id')), tags: null, refs: [], members: [] };
    if (line.endsWith('/>')) await closeCur();
    continue;
  }
  if (line.startsWith('<relation')) {
    await closeCur();
    cur = { kind: 'relation', id: Number(attr(line, 'id')), tags: null, refs: [], members: [] };
    if (line.endsWith('/>')) await closeCur();
    continue;
  }
  if (!cur) continue;

  if (line.startsWith('<nd')) { cur.refs.push(Number(attr(line, 'ref'))); continue; }
  if (line.startsWith('<member')) {
    cur.members.push({
      type: attr(line, 'type'),
      ref: Number(attr(line, 'ref')),
      role: unesc(attr(line, 'role') ?? '')
    });
    continue;
  }
  if (line.startsWith('<tag')) {
    (cur.tags ??= {})[unesc(attr(line, 'k'))] = unesc(attr(line, 'v'));
    continue;
  }
  if (line.startsWith('</node')) {
    // Tagged node: emit as a POI. Untagged ones are pure geometry and stay out
    // of the element list, exactly as Overpass leaves them out.
    if (cur.kind === 'node') {
      const { id, lat, lon, tags } = cur;
      cur = null;
      if (tags && inBox(lat, lon)) await emit({ type: 'node', id, lat, lon, tags });
    }
    continue;
  }
  if (line.startsWith('</way') || line.startsWith('</relation')) { await closeCur(); continue; }
}
await closeCur();

await write(']}');
await new Promise((ok) => out.end(ok));

if (!nodesSorted) {
  console.error('\nFATAL: node ids were NOT ascending in the XML, so the binary-search');
  console.error('index is invalid and way geometry would be silently wrong. Re-run with');
  console.error('`osmium sort` inserted before the `cat` step.');
  process.exit(1);
}

const bytes = (await stat(fileURLToPath(new URL('overpass.json', T.rawDir)))).size;
console.log(`\nWrote ${(bytes / 1e6).toFixed(1)} MB to data/${T.id}/raw/overpass.json`);
console.log('Element counts:', counts);
console.log(`(nodes indexed: ${nLen.toLocaleString()}, way geometries: ${wayOff.size.toLocaleString()})`);
await rm(wpath('tagged.osm'), { force: true });   // the big intermediate; pbfs stay for re-runs
