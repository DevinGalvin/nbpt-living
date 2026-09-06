import * as THREE from 'three';
import type { WorldData } from '../world/types';
import type { Terrain } from '../world/terrain';
import { CHUNK } from '../world/index';
import { STYLE, TREES, pick, hash32 } from '../world/style';
import { buildingDims, wallHexFor, ringAreaM2 } from './decor';

// The town beyond the chunk ring. Detailed chunks reach a few hundred metres; past
// them the ground carries on as the whole-map impostor but the buildings stopped, and
// the fog was set close to hide it. This is every building in the town as a plain
// extruded box in its own wall and roof colour, one mesh per chunk cell, drawn only
// where the detailed chunk is NOT loaded — so the fog can sit twice as far out and a
// skyline stands in the haze. Thirteen thousand buildings come to ~150k triangles,
// built once at load. Same seed as the detailed builder, so the colours agree when
// a box is swapped for the real thing.

const SKIP = new Set(['tank', 'light', 'wtower', 'ship']);
let mat: THREE.MeshLambertMaterial | null = null;
const tmp = new THREE.Color();

export function buildFarTown(world: WorldData, terrain: Terrain): Map<string, THREE.Mesh> {
  if (!mat) mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const cells = new Map<string, { pos: number[]; nor: number[]; col: number[] }>();
  world.buildings.forEach((b, idx) => {
    if (SKIP.has(b.k) || b.p.length < 6) return;
    let cx = 0, cz = 0; const n = b.p.length / 2;
    for (let i = 0; i < n; i++) { cx += b.p[i * 2]; cz += b.p[i * 2 + 1]; }
    cx /= n; cz /= n;
    const key = Math.floor(cx / CHUNK) + ',' + Math.floor(cz / CHUNK);
    let cell = cells.get(key);
    if (!cell) { cell = { pos: [], nor: [], col: [] }; cells.set(key, cell); }
    const areaM2 = ringAreaM2(b.p);
    const { eave } = buildingDims(b, areaM2);
    const g = terrain.heightAt(cx, cz) + (b.my ?? 0);
    const top = g + eave + (b.k === 'house' ? 8 : 2);   // a house has a roof over its eave
    tmp.set(wallHexFor(b, idx));
    const wr = tmp.r, wg = tmp.g, wb = tmp.b;
    const isBrick = b.k === 'commercial' || b.k === 'civic';
    tmp.set(pick(isBrick ? STYLE.building.roofsCommercial : STYLE.building.roofs, idx));
    const rr = tmp.r, rg = tmp.g, rb = tmp.b;
    // walls: one quad per footprint edge, shaded by its facing like the detailed walls
    const v: THREE.Vector2[] = [];
    for (let i = 0; i < n; i++) v.push(new THREE.Vector2(b.p[i * 2], b.p[i * 2 + 1]));
    // ensure a consistent winding for the roof triangulation
    if (THREE.ShapeUtils.isClockWise(v)) v.reverse();
    for (let i = 0; i < n; i++) {
      const a = v[i], c = v[(i + 1) % n];
      const ex = c.x - a.x, ez = c.y - a.y, len = Math.hypot(ex, ez);
      if (len < 0.5) continue;
      const nx = ez / len, nz = -ex / len;
      const shade = 0.78 + 0.22 * Math.max(0, nx * 0.35 + nz * 0.85);
      const r = wr * shade, gg = wg * shade, bb = wb * shade;
      // two triangles, outward-facing
      cell.pos.push(a.x, g, a.y, c.x, g, c.y, c.x, top, c.y, a.x, g, a.y, c.x, top, c.y, a.x, top, a.y);
      for (let k = 0; k < 6; k++) { cell.nor.push(nx, 0, nz); cell.col.push(r, gg, bb); }
    }
    let tris: number[][];
    try { tris = THREE.ShapeUtils.triangulateShape(v, []); } catch { tris = []; }
    for (const [i0, i1, i2] of tris) {
      cell.pos.push(v[i0].x, top, v[i0].y, v[i1].x, top, v[i1].y, v[i2].x, top, v[i2].y);
      for (let k = 0; k < 3; k++) { cell.nor.push(0, 1, 0); cell.col.push(rr, rg, rb); }
    }
  });
  // The woods, as canopy slabs: every wood and scrub polygon extruded to canopy height,
  // its top lifted per vertex with the ground and jittered so it is not a plateau, its
  // sides in shade. From beyond the ring a forest IS a green mass with a dark edge; the
  // slab costs a few triangles per polygon where the trees themselves would cost millions.
  const cellFor = (x: number, z: number) => {
    const key = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
    let cell = cells.get(key);
    if (!cell) { cell = { pos: [], nor: [], col: [] }; cells.set(key, cell); }
    return cell;
  };
  const leaf = new THREE.Color(TREES.deciduous[0]).lerp(new THREE.Color(TREES.pine), 0.45).multiplyScalar(0.92);
  world.polys.forEach((poly, pi) => {
    if (poly.k !== 'wood' && poly.k !== 'scrub') return;
    const H = poly.k === 'wood' ? 26 : 12;
    const ring: THREE.Vector2[] = [];
    for (let i = 0; i < poly.p.length; i += 2) ring.push(new THREE.Vector2(poly.p[i], poly.p[i + 1]));
    if (ring.length < 3) return;
    if (THREE.ShapeUtils.isClockWise(ring)) ring.reverse();
    const holes: THREE.Vector2[][] = (poly.h ?? []).map((h) => {
      const r: THREE.Vector2[] = [];
      for (let i = 0; i < h.length; i += 2) r.push(new THREE.Vector2(h[i], h[i + 1]));
      if (!THREE.ShapeUtils.isClockWise(r)) r.reverse();
      return r;
    });
    const all = ring.concat(...holes);
    const topY = (v: THREE.Vector2, i: number) => terrain.heightAt(v.x, v.y) + H * (0.85 + (hash32(pi, i, 5) % 100) / 330);
    const tops = all.map(topY);
    let tris: number[][];
    try { tris = THREE.ShapeUtils.triangulateShape(ring, holes); } catch { return; }
    for (const [i0, i1, i2] of tris) {
      const a = all[i0], b = all[i1], c = all[i2];
      const cell = cellFor((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3);
      cell.pos.push(a.x, tops[i0], a.y, b.x, tops[i1], b.y, c.x, tops[i2], c.y);
      for (const k of [i0, i1, i2]) {
        const j = 0.86 + (hash32(pi, k, 9) % 100) / 360;
        cell.nor.push(0, 1, 0); cell.col.push(leaf.r * j, leaf.g * j, leaf.b * j);
      }
    }
    // the shaded sides, along the outer ring and each hole
    const sides = (r: THREE.Vector2[], base: number) => {
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        const ex = b.x - a.x, ez = b.y - a.y, len = Math.hypot(ex, ez);
        if (len < 0.5) continue;
        const nx = ez / len, nz = -ex / len;
        const ya = terrain.heightAt(a.x, a.y), yb = terrain.heightAt(b.x, b.y);
        const ta = tops[base + i], tb = tops[base + (i + 1) % r.length];
        const cell = cellFor((a.x + b.x) / 2, (a.y + b.y) / 2);
        cell.pos.push(a.x, ya, a.y, b.x, yb, b.y, b.x, tb, b.y, a.x, ya, a.y, b.x, tb, b.y, a.x, ta, a.y);
        const sh = 0.55 + 0.2 * Math.max(0, nx * 0.35 + nz * 0.85);
        for (let k = 0; k < 6; k++) { cell.nor.push(nx, 0, nz); cell.col.push(leaf.r * sh, leaf.g * sh, leaf.b * sh); }
      }
    };
    sides(ring, 0);
    let base = ring.length;
    for (const h of holes) { sides(h, base); base += h.length; }
  });

  const out = new Map<string, THREE.Mesh>();
  for (const [key, c] of cells) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(c.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(c.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c.col, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.matrixAutoUpdate = false;
    out.set(key, mesh);
  }
  return out;
}
