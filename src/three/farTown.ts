import * as THREE from 'three';
import type { WorldData } from '../world/types';
import type { Terrain } from '../world/terrain';
import { CHUNK } from '../world/index';
import { STYLE, pick, hash32 } from '../world/style';
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
