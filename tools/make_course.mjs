// Course-authoring helper: finds a rideable route between waypoints along the real
// road graph and emits the race.ts Course fields (gates + RDP route). The recipe's
// manual segment-stitching kept producing orientation mistakes — a shortest-path
// walk over shared OSM intersection vertices can't get those wrong.
//
//   node tools/make_course.mjs x1,y1 x2,y2 [x3,y3 ...]
//
// First point = start, last = finish, middles = vias. Prints route length, a gate
// list (route corners > ~25° plus ~2600px spacing on straights), and the RDP(35)
// route polyline — paste into COURSES, then hand-tune gates in preview.

import { readFile } from 'node:fs/promises';

const world = JSON.parse(await readFile(new URL('../public/world.json', import.meta.url), 'utf8'));
const RIDEABLE = new Set(['primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street', 'primary_link', 'secondary_link', 'tertiary_link', 'trunk', 'trunk_link', 'motorway_link']);

// graph over exact vertex coords — OSM ways share intersection nodes, so equal
// px coords = a real junction
const nodes = new Map();          // "x,y" -> { x, y, adj: [ [key, dist], ... ] }
const keyOf = (x, y) => `${x},${y}`;
function addNode(x, y) {
  const k = keyOf(x, y);
  let n = nodes.get(k);
  if (!n) nodes.set(k, (n = { x, y, adj: [] }));
  return k;
}
for (const r of world.roads) {
  if (!RIDEABLE.has(r.c)) continue;
  const p = r.p;
  for (let i = 2; i < p.length; i += 2) {
    const a = addNode(p[i - 2], p[i - 1]);
    const b = addNode(p[i], p[i + 1]);
    const d = Math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]);
    nodes.get(a).adj.push([b, d]);
    nodes.get(b).adj.push([a, d]);
  }
}
console.error(`road graph: ${nodes.size} nodes`);

function nearestNode(x, y) {
  let best = null, bd = Infinity;
  for (const [k, n] of nodes) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bd) { bd = d; best = k; }
  }
  return { key: best, off: Math.sqrt(bd) };
}

// binary-heap Dijkstra
function shortestPath(fromKey, toKey) {
  const dist = new Map([[fromKey, 0]]);
  const prev = new Map();
  const heap = [[0, fromKey]];
  const up = (i) => { while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const down = (i) => { for (;;) { let m = i; const l = i * 2 + 1, r = l + 1; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } };
  const seen = new Set();
  while (heap.length) {
    const [d, k] = heap[0];
    heap[0] = heap[heap.length - 1]; heap.pop(); if (heap.length) down(0);
    if (seen.has(k)) continue;
    seen.add(k);
    if (k === toKey) break;
    for (const [nk, w] of nodes.get(k).adj) {
      const nd = d + w;
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd); prev.set(nk, k);
        heap.push([nd, nk]); up(heap.length - 1);
      }
    }
  }
  if (!dist.has(toKey)) return null;
  const path = [toKey];
  while (path[path.length - 1] !== fromKey) path.push(prev.get(path[path.length - 1]));
  path.reverse();
  return { path, len: dist.get(toKey) };
}

function rdp(pts, eps) {
  const n = pts.length;
  if (n <= 2) return pts;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = pts[a][0], ay = pts[a][1], dx = pts[b][0] - ax, dy = pts[b][1] - ay;
    const L2 = dx * dx + dy * dy || 1;
    let worst = -1, wd = eps * eps;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i][0] - ax, py = pts[i][1] - ay;
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) / L2));
      const ex = px - t * dx, ey = py - t * dy;
      const d = ex * ex + ey * ey;
      if (d > wd) { wd = d; worst = i; }
    }
    if (worst >= 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

const wps = process.argv.slice(2).map((s) => s.split(',').map(Number));
if (wps.length < 2) { console.error('usage: node tools/make_course.mjs x1,y1 x2,y2 [vias...]'); process.exit(1); }

let full = [];
let totalLen = 0;
for (let i = 1; i < wps.length; i++) {
  const A = nearestNode(wps[i - 1][0], wps[i - 1][1]);
  const B = nearestNode(wps[i][0], wps[i][1]);
  if (A.off > 400 || B.off > 400) console.error(`⚠ waypoint ${i} snaps ${Math.round(Math.max(A.off, B.off))}px to the road graph`);
  const sp = shortestPath(A.key, B.key);
  if (!sp) { console.error(`NO PATH between waypoint ${i - 1} and ${i}`); process.exit(1); }
  totalLen += sp.len;
  const seg = sp.path.map((k) => { const n = nodes.get(k); return [n.x, n.y]; });
  full = full.length ? full.concat(seg.slice(1)) : seg;
}

const route = rdp(full, 35);
// gates: strong corners (>25°) + ~2600px pacing on the straights; the finish is the last
const gates = [];
let acc = 0;
for (let i = 1; i < route.length - 1; i++) {
  const [ax, ay] = route[i - 1], [bx, by] = route[i], [cx, cy] = route[i + 1];
  // long straight legs (RDP leaves no vertices there) still pace arches every ~2600px
  const legLen = Math.hypot(bx - ax, by - ay);
  let along = 0;
  while (acc + (legLen - along) > 2600) {
    const step = 2600 - acc;
    along += step;
    const f = along / legLen;
    gates.push([Math.round(ax + (bx - ax) * f), Math.round(ay + (by - ay) * f)]);
    acc = 0;
  }
  acc += legLen - along;
  const a1 = Math.atan2(by - ay, bx - ax), a2 = Math.atan2(cy - by, cx - bx);
  let dAng = Math.abs(a2 - a1);
  if (dAng > Math.PI) dAng = 2 * Math.PI - dAng;
  const corner = dAng > 0.44 && acc > 700;             // > ~25° and not right on top of the last gate
  if (corner) { gates.push([bx, by]); acc = 0; }
}
gates.push(route[route.length - 1]);

const est = totalLen / 530;
console.log(`// length ${Math.round(totalLen)}px ≈ ${(totalLen / 8 / 1609.34).toFixed(1)} mi ≈ ${Math.round(est)}s at bike speed`);
console.log(`start: { x: ${route[0][0]}, z: ${route[0][1]} },`);
console.log('gates: [');
for (const [x, y] of gates) console.log(`  [${x}, ${y}],`);
console.log('],');
console.log(`route: [${route.map((p) => p.join(', ')).join(', ')}],`);
console.log(`// route pts: ${route.length}, gates: ${gates.length}`);
