import * as THREE from 'three';
import type { WorldData } from '../world/types';
import type { Terrain } from '../world/terrain';
import { CHUNK } from '../world/index';
import { STYLE, TREES, pick, hash32 } from '../world/style';
import { buildingDims, wallHexFor, ringAreaM2 } from './decor';

// The town beyond the chunk ring. Detailed chunks reach a few hundred metres; past
// them the ground carries on as the whole-map impostor but the buildings stopped, and
// the fog was set close to hide it. This is every building in the town as a plain
// extruded box in its own wall and roof colour, and every wood as a canopy slab, one
// mesh per chunk cell, drawn only where the detailed chunk is NOT loaded — so the fog
// can sit twice as far out and a skyline stands in the haze. Same seed as the detailed
// builder, so the colours agree when a box is swapped for the real thing.
//
// Built LAZILY: sorting thirteen thousand buildings into cells is instant, but
// triangulating them all took a second at load, so each cell's mesh is built on its
// first frame within reach, a couple of cells a frame, nearest first.

const SKIP = new Set(['tank', 'light', 'wtower', 'ship']);
const REACH = 7000;          // cells further than this from the player are not built yet
const PER_TICK = 2;

interface Cell { bIdx: number[]; pIdx: number[]; mesh: THREE.Mesh | null; built: boolean; cx: number; cz: number; loaded: boolean }
interface PolyTris { all: THREE.Vector2[]; tops: number[]; tris: number[][]; ring: THREE.Vector2[]; holes: THREE.Vector2[][]; H: number }
type Sink = { pos: number[]; nor: number[]; col: number[] };

let mat: THREE.MeshLambertMaterial | null = null;
const tmp = new THREE.Color();

export class FarTown {
  private cells = new Map<string, Cell>();
  private polyCache = new Map<number, PolyTris | null>();
  private leaf: THREE.Color;

  constructor(private world: WorldData, private terrain: Terrain, private scene: THREE.Scene) {
    if (!mat) mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    // the canopy colour, a shade lighter than the near trees: at the horizon a wood is
    // its sunlit top, and a dark slab there reads as a black bar
    this.leaf = new THREE.Color(TREES.deciduous[0]).lerp(new THREE.Color(TREES.pine), 0.3).multiplyScalar(1.02);
    const cellAt = (x: number, z: number) => {
      const kx = Math.floor(x / CHUNK), kz = Math.floor(z / CHUNK);
      const key = kx + ',' + kz;
      let c = this.cells.get(key);
      if (!c) { c = { bIdx: [], pIdx: [], mesh: null, built: false, cx: (kx + 0.5) * CHUNK, cz: (kz + 0.5) * CHUNK, loaded: false }; this.cells.set(key, c); }
      return c;
    };
    world.buildings.forEach((b, idx) => {
      if (SKIP.has(b.k) || b.p.length < 6) return;
      let cx = 0, cz = 0; const n = b.p.length / 2;
      for (let i = 0; i < n; i++) { cx += b.p[i * 2]; cz += b.p[i * 2 + 1]; }
      cellAt(cx / n, cz / n).bIdx.push(idx);
    });
    world.polys.forEach((poly, pi) => {
      if (poly.k !== 'wood' && poly.k !== 'scrub') return;
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (let i = 0; i < poly.p.length; i += 2) {
        x0 = Math.min(x0, poly.p[i]); x1 = Math.max(x1, poly.p[i]); z0 = Math.min(z0, poly.p[i + 1]); z1 = Math.max(z1, poly.p[i + 1]);
      }
      for (let kz = Math.floor(z0 / CHUNK); kz <= Math.floor(z1 / CHUNK); kz++)
        for (let kx = Math.floor(x0 / CHUNK); kx <= Math.floor(x1 / CHUNK); kx++) cellAt((kx + 0.5) * CHUNK, (kz + 0.5) * CHUNK).pIdx.push(pi);
    });
  }

  /** a detailed chunk came (true) or went (false): the far cell hides or shows */
  setLoaded(key: string, loaded: boolean) {
    const c = this.cells.get(key);
    if (!c) return;
    c.loaded = loaded;
    if (c.mesh) c.mesh.visible = !loaded;
  }

  /** build every unbuilt cell within reach of (px, pz) right now — for the load, before the first frame */
  buildAround(px: number, pz: number) {
    for (const [key, c] of this.cells) {
      if (c.built) continue;
      if (Math.hypot(c.cx - px, c.cz - pz) < REACH) this.build(c, key);
    }
  }

  /** build a couple of the nearest unbuilt cells within reach; call once a frame */
  tick(px: number, pz: number) {
    let n = 0;
    const todo: { c: Cell; key: string; d: number }[] = [];
    for (const [key, c] of this.cells) {
      if (c.built) continue;
      const d = Math.hypot(c.cx - px, c.cz - pz);
      if (d < REACH) todo.push({ c, key, d });
    }
    if (!todo.length) return;
    todo.sort((a, b) => a.d - b.d);
    for (const { c, key } of todo) {
      this.build(c, key);
      if (++n >= PER_TICK) break;
    }
  }

  private build(c: Cell, key: string) {
    c.built = true;
    const sink: Sink = { pos: [], nor: [], col: [] };
    for (const idx of c.bIdx) this.box(idx, sink);
    const [kx, kz] = key.split(',').map(Number);
    for (const pi of c.pIdx) this.wood(pi, kx, kz, sink);
    if (!sink.pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(sink.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(sink.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(sink.col, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat!);
    mesh.matrixAutoUpdate = false;
    mesh.visible = !c.loaded;
    c.mesh = mesh;
    this.scene.add(mesh);
  }

  private box(idx: number, s: Sink) {
    const b = this.world.buildings[idx];
    const n = b.p.length / 2;
    let cx = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += b.p[i * 2]; cz += b.p[i * 2 + 1]; }
    cx /= n; cz /= n;
    const { eave } = buildingDims(b, ringAreaM2(b.p));
    const g = this.terrain.heightAt(cx, cz) + (b.my ?? 0);
    const top = g + eave + 2;
    tmp.set(wallHexFor(b, idx));
    const wr = tmp.r, wg = tmp.g, wb = tmp.b;
    const isBrick = b.k === 'commercial' || b.k === 'civic';
    tmp.set(pick(isBrick ? STYLE.building.roofsCommercial : STYLE.building.roofs, idx));
    const rr = tmp.r, rg = tmp.g, rb = tmp.b;
    const v: THREE.Vector2[] = [];
    for (let i = 0; i < n; i++) v.push(new THREE.Vector2(b.p[i * 2], b.p[i * 2 + 1]));
    if (THREE.ShapeUtils.isClockWise(v)) v.reverse();
    for (let i = 0; i < n; i++) {
      const a = v[i], c = v[(i + 1) % n];
      const ex = c.x - a.x, ez = c.y - a.y, len = Math.hypot(ex, ez);
      if (len < 0.5) continue;
      const nx = ez / len, nz = -ex / len;
      const shade = 0.78 + 0.22 * Math.max(0, nx * 0.35 + nz * 0.85);
      const r = wr * shade, gg = wg * shade, bb = wb * shade;
      s.pos.push(a.x, g, a.y, c.x, g, c.y, c.x, top, c.y, a.x, g, a.y, c.x, top, c.y, a.x, top, a.y);
      for (let k = 0; k < 6; k++) { s.nor.push(nx, 0, nz); s.col.push(r, gg, bb); }
    }
    let tris: number[][];
    try { tris = THREE.ShapeUtils.triangulateShape(v, []); } catch { tris = []; }
    for (const [i0, i1, i2] of tris) {
      s.pos.push(v[i0].x, top, v[i0].y, v[i1].x, top, v[i1].y, v[i2].x, top, v[i2].y);
      for (let k = 0; k < 3; k++) { s.nor.push(0, 1, 0); s.col.push(rr, rg, rb); }
    }
    // a pitched roof on the houses and the small blocks, so the stand-in reads as a
    // building and not a crate: a hip over the footprint's oriented box, ridge along
    // the long axis. Big flat-roofed blocks keep their flat top.
    const pitched = b.k === 'house' || b.k === 'shed' || b.k === 'church' || (n <= 6 && ringAreaM2(b.p) < 260);
    if (pitched) {
      // the long axis: the longest edge's direction
      let bx = 1, bz = 0, bl = -1;
      for (let i = 0; i < n; i++) { const a = v[i], c = v[(i + 1) % n]; const l = Math.hypot(c.x - a.x, c.y - a.y); if (l > bl) { bl = l; bx = (c.x - a.x) / l; bz = (c.y - a.y) / l; } }
      let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
      for (const q of v) { const u = q.x * bx + q.y * bz, w = -q.x * bz + q.y * bx; u0 = Math.min(u0, u); u1 = Math.max(u1, u); w0 = Math.min(w0, w); w1 = Math.max(w1, w); }
      const W = w1 - w0, L = u1 - u0;
      if (W > 6 && L > 6) {
        const rise = Math.min(W * 0.45, 22);
        const hip = Math.min(W * 0.5, L * 0.45);
        const wm = (w0 + w1) / 2, ridgeY = top + rise;
        const P = (u: number, w: number): [number, number] => [u * bx - w * bz, u * bz + w * bx];
        const c00 = P(u0, w0), c10 = P(u1, w0), c11 = P(u1, w1), c01 = P(u0, w1);
        const r0 = P(u0 + hip, wm), r1 = P(u1 - hip, wm);
        const face = (pts: [number, number][], ys: number[], nx: number, nz: number, shade: number) => {
          // a fan from the first point
          for (let i = 1; i + 1 < pts.length; i++) {
            s.pos.push(pts[0][0], ys[0], pts[0][1], pts[i][0], ys[i], pts[i][1], pts[i + 1][0], ys[i + 1], pts[i + 1][1]);
            for (let k = 0; k < 3; k++) { s.nor.push(nx, 0.7, nz); s.col.push(rr * shade, rg * shade, rb * shade); }
          }
        };
        // the two long slopes (trapezoids) and the two hip ends (triangles)
        face([c00, c10, r1, r0], [top, top, ridgeY, ridgeY], bz, -bx, 0.78 + 0.22 * Math.max(0, bz * 0.35 - bx * 0.85));
        face([c11, c01, r0, r1], [top, top, ridgeY, ridgeY], -bz, bx, 0.78 + 0.22 * Math.max(0, -bz * 0.35 + bx * 0.85));
        face([c01, c00, r0], [top, top, ridgeY], -bx, -bz, 0.8 + 0.2 * Math.max(0, -bx * 0.35 - bz * 0.85));
        face([c10, c11, r1], [top, top, ridgeY], bx, bz, 0.8 + 0.2 * Math.max(0, bx * 0.35 + bz * 0.85));
      }
    }
  }

  // a wood polygon is triangulated once and shared by every cell it crosses; each cell
  // takes the triangles and edges whose centre falls inside it
  private woodTris(pi: number): PolyTris | null {
    const hit = this.polyCache.get(pi);
    if (hit !== undefined) return hit;
    const poly = this.world.polys[pi];
    const H = poly.k === 'wood' ? 20 : 9;
    const ring: THREE.Vector2[] = [];
    for (let i = 0; i < poly.p.length; i += 2) ring.push(new THREE.Vector2(poly.p[i], poly.p[i + 1]));
    if (ring.length < 3) { this.polyCache.set(pi, null); return null; }
    if (THREE.ShapeUtils.isClockWise(ring)) ring.reverse();
    const holes: THREE.Vector2[][] = (poly.h ?? []).map((h) => {
      const r: THREE.Vector2[] = [];
      for (let i = 0; i < h.length; i += 2) r.push(new THREE.Vector2(h[i], h[i + 1]));
      if (!THREE.ShapeUtils.isClockWise(r)) r.reverse();
      return r;
    });
    const all = ring.concat(...holes);
    const tops = all.map((v, i) => this.terrain.heightAt(v.x, v.y) + H * (0.85 + (hash32(pi, i, 5) % 100) / 330));
    let tris: number[][];
    try { tris = THREE.ShapeUtils.triangulateShape(ring, holes); } catch { tris = []; }
    const out = { all, tops, tris, ring, holes, H };
    this.polyCache.set(pi, out);
    return out;
  }

  private wood(pi: number, kx: number, kz: number, s: Sink) {
    const t = this.woodTris(pi);
    if (!t) return;
    const inCell = (x: number, z: number) => Math.floor(x / CHUNK) === kx && Math.floor(z / CHUNK) === kz;
    const leaf = this.leaf;
    for (const [i0, i1, i2] of t.tris) {
      const a = t.all[i0], b = t.all[i1], c = t.all[i2];
      if (!inCell((a.x + b.x + c.x) / 3, (a.y + b.y + c.y) / 3)) continue;
      s.pos.push(a.x, t.tops[i0], a.y, b.x, t.tops[i1], b.y, c.x, t.tops[i2], c.y);
      for (const k of [i0, i1, i2]) {
        const j = 0.86 + (hash32(pi, k, 9) % 100) / 360;
        s.nor.push(0, 1, 0); s.col.push(leaf.r * j, leaf.g * j, leaf.b * j);
      }
    }
    const sides = (r: THREE.Vector2[], base: number) => {
      for (let i = 0; i < r.length; i++) {
        const a = r[i], b = r[(i + 1) % r.length];
        if (!inCell((a.x + b.x) / 2, (a.y + b.y) / 2)) continue;
        const ex = b.x - a.x, ez = b.y - a.y, len = Math.hypot(ex, ez);
        if (len < 0.5) continue;
        const nx = ez / len, nz = -ex / len;
        const ya = this.terrain.heightAt(a.x, a.y), yb = this.terrain.heightAt(b.x, b.y);
        const ta = t.tops[base + i], tb = t.tops[base + (i + 1) % r.length];
        s.pos.push(a.x, ya, a.y, b.x, yb, b.y, b.x, tb, b.y, a.x, ya, a.y, b.x, tb, b.y, a.x, ta, a.y);
        const sh = 0.72 + 0.18 * Math.max(0, nx * 0.35 + nz * 0.85);
        for (let k = 0; k < 6; k++) { s.nor.push(nx, 0, nz); s.col.push(leaf.r * sh, leaf.g * sh, leaf.b * sh); }
      }
    };
    sides(t.ring, 0);
    let base = t.ring.length;
    for (const h of t.holes) { sides(h, base); base += h.length; }
  }
}
