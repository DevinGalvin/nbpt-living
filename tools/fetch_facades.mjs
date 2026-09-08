// Automatic storefront facades from Mapillary (CC BY-SA 4.0 street-level photos).
//
//   MAPILLARY_TOKEN=... node tools/fetch_facades.mjs [--town=nbpt] [--dry] [--limit=N] [--radius=4000]
//   node tools/fetch_facades.mjs --mock=path/to/mock.json      (offline: a fake image list + local JPEGs)
//   --only="Fowle's"   one business; --dry lists walls without fetching
//
// For every business the map names (shop-like POIs within --radius px of the origin)
// plus towns/<id>/facades/targets.json ({ name, at: [x, z], widthM?, floors? } for the
// ones the map does not name), find the building, the wall the door is on, then the
// Mapillary photo that looks at that wall most squarely from the street; project the
// wall's corners into the photo from the camera's position, heading and lens; pull
// the wall flat; pack every tile into towns/<id>/public/facades.png with facades.json
// beside it, and write towns/<id>/facades/ATTRIBUTION.md crediting each photographer.
// The game does the rest (src/three/facades.ts). Re-run whenever coverage improves.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { PNG } from 'pngjs';
import jpeg from 'jpeg-js';
import { loadTown } from './lib/town.mjs';
import { wallFor, project, facing, alongRight, rectify, pack } from './lib/facade_geom.mjs';

const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const T = await loadTown();
const world = JSON.parse(readFileSync(new URL('world.json', T.publicDir), 'utf8'));
const KINDS = new Set(['shop', 'restaurant', 'cafe', 'fast_food', 'pub', 'bar', 'bank', 'pharmacy', 'ice_cream', 'theatre', 'cinema', 'gallery', 'hotel', 'guest_house', 'bakery', 'books', 'clothes', 'gift']);
const RADIUS = Number(args.radius || 4000);
const LIMIT = Number(args.limit || 1e9);
const CAM_UP = 1.6;               // a phone or a dash cam, metres above the road
const FLOOR_M = 3.75;             // the ground floor of a shop block
const facadesDir = new URL(`../towns/${T.id}/facades/`, import.meta.url);

// ---- the targets
const targets = [];
for (const p of world.pois) if (p.n && KINDS.has(p.k) && Math.hypot(p.x, p.y) < RADIUS) targets.push({ name: p.n, x: p.x, z: p.y });
const extraPath = new URL('targets.json', facadesDir);
if (existsSync(extraPath)) for (const t of JSON.parse(readFileSync(extraPath, 'utf8'))) targets.push({ name: t.name, x: t.at[0], z: t.at[1], widthM: t.widthM, floors: t.floors });
const seen = new Set(); const uniq = targets.filter((t) => { const k = t.name.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return !args.only || k === String(args.only).toLowerCase(); });
console.log(`[facades] ${uniq.length} businesses to try`);

// ---- host building + wall
function hostFor(x, z) {
  let best = -1, bd = 80 * 80;
  world.buildings.forEach((b, i) => {
    const r = b.p; let inside = false;
    for (let a = 0, c = r.length - 2; a < r.length; c = a, a += 2) { const xi = r[a], zi = r[a + 1], xj = r[c], zj = r[c + 1]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside; }
    if (inside) { best = i; bd = 0; return; }
    if (bd === 0) return;
    for (let a = 0; a + 3 < r.length; a += 2) { const ax = r[a], az = r[a + 1], bx = r[a + 2], bz = r[a + 3]; const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); const d = (ax + dx * t - x) ** 2 + (az + dz * t - z) ** 2; if (d < bd) { bd = d; best = i; } }
  });
  return best;
}

// ---- Mapillary
const token = process.env.MAPILLARY_TOKEN;
const mock = args.mock ? JSON.parse(readFileSync(args.mock, 'utf8')) : null;
if (!mock && !token && !args.dry) { console.error('MAPILLARY_TOKEN is not set: get a free token at mapillary.com/developer and export it. --dry lists the targets without it.'); process.exit(2); }
const curl = (url, out) => { const a = ['-sS', '-L', '-m', '60', url]; if (out) a.push('-o', out); return execFileSync('curl', a, { maxBuffer: 64 << 20 }); };
function imagesNear(lat, lon) {
  if (mock) return mock.images;
  const dLat = 45 / T.M_PER_DEG_LAT, dLon = 45 / T.M_PER_DEG_LON;
  const url = `https://graph.mapillary.com/images?access_token=${token}&fields=id,computed_geometry,computed_compass_angle,camera_parameters,camera_type,width,height,thumb_2048_url,captured_at,is_pano,creator&bbox=${lon - dLon},${lat - dLat},${lon + dLon},${lat + dLat}&limit=100`;
  const res = JSON.parse(curl(url).toString());
  return res.data || [];
}

// ---- go
const tiles = [], items = [], credits = [];
mkdirSync(facadesDir, { recursive: true });
let tried = 0;
for (const t of uniq) {
  if (tried >= LIMIT) break;
  const bi = hostFor(t.x, t.z);
  if (bi < 0) { console.log(`  ${t.name}: no building within 80 px`); continue; }
  const b = world.buildings[bi];
  const wall = wallFor(b.p, t.x, t.z);
  if (!wall) continue;
  tried++;
  const lat = T.pxToLat(wall.mz), lon = T.pxToLon(wall.mx);
  const floors = t.floors ?? 1;
  const topM = floors === 'all' ? Math.max(FLOOR_M, (b.lv || 2) * 3.2) : FLOOR_M;
  // the face in metres about the wall's middle: east along x, north against z
  const half = Math.min(wall.len, (t.widthM ?? 14) * T.PX_PER_M) / 2 / T.PX_PER_M;
  // along the face the way the street sees it: the viewer's right, so the tile's left is their left
  const R = alongRight(wall);
  const s = ((t.x - wall.mx) * R.east + (t.z - wall.mz) * -R.north) / T.PX_PER_M;   // the door along the face
  const c0 = Math.max(-wall.len / 2 / T.PX_PER_M + half, Math.min(wall.len / 2 / T.PX_PER_M - half, s));
  const pt = (along, up) => ({ east: R.east * along, north: R.north * along, up });
  const corners = [pt(c0 - half, topM), pt(c0 + half, topM), pt(c0 + half, 0), pt(c0 - half, 0)];   // tl tr br bl, seen from outside
  if (args.dry) { console.log(`  ${t.name}: wall ${Math.round(wall.len / 8)} m at ${lat.toFixed(5)},${lon.toFixed(5)} facing ${Math.round(Math.atan2(wall.nx, -wall.nz) * 180 / Math.PI)}°`); continue; }
  let best = null;
  for (const im of imagesNear(lat, lon)) {
    if (im.is_pano || (im.camera_type && im.camera_type !== 'perspective')) continue;
    const [ilon, ilat] = im.computed_geometry?.coordinates || [];
    if (ilon === undefined) continue;
    const cam = { east: (ilon - lon) * T.M_PER_DEG_LON, north: (ilat - lat) * T.M_PER_DEG_LAT, up: CAM_UP, heading: im.computed_compass_angle ?? 0,
      focal: im.camera_parameters?.[0] ?? 0.8, k1: im.camera_parameters?.[1] ?? 0, k2: im.camera_parameters?.[2] ?? 0, w: im.width, h: im.height };
    // on the street side of the wall, six to forty metres off, looking at it
    const side = cam.east * wall.nx + cam.north * -wall.nz;
    if (side < 3) continue;
    const dist = Math.hypot(cam.east, cam.north);
    if (dist < 5 || dist > 40) continue;
    const face = facing(cam, wall);
    if (face < 0.55) continue;
    const q = corners.map((c) => project(cam, c));
    if (q.some((p) => !p)) continue;
    const m = 8;
    if (q.some((p) => p.u < m || p.u > cam.w - m || p.v < m || p.v > cam.h - m)) continue;
    const width = Math.hypot(q[1].u - q[0].u, q[1].v - q[0].v);
    if (width < 140) continue;
    const age = im.captured_at ? (Date.now() - im.captured_at) / 3.15e10 : 5;
    const score = face * Math.min(1, width / 600) / (1 + Math.abs(dist - 14) / 12) / (1 + age * 0.08);
    if (!best || score > best.score) best = { im, q, score, width, dist, face };
  }
  if (!best) { console.log(`  ${t.name}: no usable photo`); continue; }
  const file = new URL(`cache/${best.im.id}.jpg`, facadesDir);
  mkdirSync(new URL('cache/', facadesDir), { recursive: true });
  if (!existsSync(file)) { const out = fileURLToPath(file); if (mock) execFileSync('cp', [mock.jpegFor?.[best.im.id] || mock.jpeg, out]); else curl(best.im.thumb_2048_url, out); }
  const src = jpeg.decode(readFileSync(file), { useTArray: true, formatAsRGBA: true });
  // the thumb is scaled from the original: scale the projected quad to the decoded size
  const sx = src.width / best.im.width, sy = src.height / best.im.height;
  const quad = best.q.map((p) => ({ x: p.u * sx, y: p.v * sy }));
  const tw = 512, th = floors === 'all' ? 512 : 256;
  tiles.push(rectify(src, quad, tw, th));
  items.push({ name: t.name, widthM: half * 2, floors, at: t.at });
  credits.push({ name: t.name, id: best.im.id, creator: best.im.creator?.username || 'a Mapillary contributor', captured: best.im.captured_at ? new Date(best.im.captured_at).toISOString().slice(0, 10) : '' });
  console.log(`  ${t.name}: image ${best.im.id}, ${Math.round(best.dist)} m off, face ${best.face.toFixed(2)}, ${Math.round(best.width)} px wide`);
}
if (args.dry || !tiles.length) { console.log(args.dry ? '[facades] dry run' : '[facades] nothing fetched'); process.exit(0); }

// ---- the atlas
const { size, at } = pack(tiles);
const png = new PNG({ width: size, height: size });
png.data.fill(0);
tiles.forEach((tl, i) => { for (let y = 0; y < tl.height; y++) for (let x = 0; x < tl.width; x++) { const si = (y * tl.width + x) * 4, di = ((at[i].v + y) * size + at[i].u + x) * 4; png.data[di] = tl.data[si]; png.data[di + 1] = tl.data[si + 1]; png.data[di + 2] = tl.data[si + 2]; png.data[di + 3] = 255; } });
writeFileSync(new URL('facades.png', T.publicDir), PNG.sync.write(png));
const manifest = { atlas: 'facades.png', size, items: items.map((it, i) => ({ ...it, u: at[i].u, v: at[i].v, w: tiles[i].width, h: tiles[i].height })) };
writeFileSync(new URL('facades.json', T.publicDir), JSON.stringify(manifest, null, 2));
writeFileSync(new URL('ATTRIBUTION.md', facadesDir), '# Storefront photos\n\nStreet-level photos from Mapillary, licensed CC BY-SA 4.0 (https://www.mapillary.com/legal). Each is credited here and in the game\'s attribution line.\n\n' + credits.map((c) => `- ${c.name}: Mapillary image ${c.id} by ${c.creator}${c.captured ? ', ' + c.captured : ''} — https://www.mapillary.com/app/?pKey=${c.id}`).join('\n') + '\n');
console.log(`[facades] ${tiles.length} facades → ${size}² atlas, towns/${T.id}/public/facades.{png,json}, credits in towns/${T.id}/facades/ATTRIBUTION.md`);
