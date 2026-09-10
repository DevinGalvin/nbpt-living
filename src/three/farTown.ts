import * as THREE from 'three';
import type { WorldData } from '../world/types';
import type { Terrain } from '../world/terrain';
import { CHUNK } from '../world/index';
import { STYLE, TREES, pick, hash32 } from '../world/style';
import { buildingDims, wallHexFor, ringAreaM2 } from './decor';
import { brickTex, clapboardTex, shingleTex, texMean } from './textures';

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
type Sink = { pos: number[]; nor: number[]; col: number[]; wall: number[] };

let mat: THREE.MeshLambertMaterial | null = null;
const tmp = new THREE.Color();

export class FarTown {
  private cells = new Map<string, Cell>();
  private polyCache = new Map<number, PolyTris | null>();
  private leaf: THREE.Color;

  // the trees of a far cell, when the tier can afford them (a desktop): the town is
  // full of trees, and a horizon of bare green with boxes on it read as unrendered
  constructor(private world: WorldData, private terrain: Terrain, private scene: THREE.Scene,
              private treesOf?: (key: string) => { x: number; y: number; r: number; bush?: boolean; reed?: boolean }[],
              // the road bridges: a deck's polyline, width and height function, so the far
              // town carries a span at any distance — the Gillis Bridge used to stop dead at
              // the edge of the detailed chunks and hang in the air
              private decksOf?: () => { pts: number[]; w: number; yAt: (x: number, z: number) => number; piers?: { x: number; z: number; footY: number; topY: number }[] }[]) {
    if (!mat) {
      mat = new THREE.MeshLambertMaterial({ vertexColors: true });
      // A far stand-in is a flat-toned box, and a flat-toned box on the horizon reads
      // as unbuilt scenery — the pale commercial blocks across the river look like
      // blank crates. Give the WALL faces (attribute wall = 1; piers, deck fascias,
      // wood edges and roofs are 0) a storey line every 2.75 m and a base-to-eave
      // gradient. No extra triangles. The band is faded out by its own screen-space
      // footprint, so it never turns into moire where a block is a few pixels wide.
      mat.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader
          .replace('#include <common>', '#include <common>\nattribute float wall;\nvarying float vWall;\nvarying vec3 vWallW;')
          .replace('#include <project_vertex>', '#include <project_vertex>\nvWall = wall;\nvWallW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
        sh.fragmentShader = sh.fragmentShader
          .replace('#include <common>', '#include <common>\nvarying float vWall;\nvarying vec3 vWallW;')
          .replace('#include <color_fragment>', `#include <color_fragment>
{
  float w = vWall;
  if (w > 0.5) {
    // one storey line every 22 px (2.75 m), fading out where a block is only a few
    // pixels wide and the band would turn into moire. Distance, not fwidth: fwidth
    // needs GL_OES_standard_derivatives in a GLSL ES 1.00 shader, and without it the
    // whole term silently evaluated to nothing.
    float fade = 1.0 - smoothstep(4500.0, 9500.0, distance(cameraPosition, vWallW));
    float band = 0.5 + 0.5 * cos(vWallW.y * (6.2832 / 22.0));
    diffuseColor.rgb *= mix(1.0, 0.82 + 0.18 * band, fade * 0.9);
  }
}`);
      };
    }
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
    const sink: Sink = { pos: [], nor: [], col: [], wall: [] };
    for (const idx of c.bIdx) this.box(idx, sink);
    const [kx, kz] = key.split(',').map(Number);
    for (const pi of c.pIdx) this.wood(pi, kx, kz, sink);
    // a cell's trees are a garnish: if the planter throws for a cell at the map's edge, the
    // cell still gets its boxes and woods
    if (this.treesOf) { try { this.trees(key, sink); } catch { /* boxes and woods only */ } }
    if (this.decksOf) { try { this.decks(kx, kz, sink); } catch { /* no far deck */ } }
    if (!sink.pos.length) return;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(sink.pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(sink.nor, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(sink.col, 3));
    geo.setAttribute('wall', new THREE.Float32BufferAttribute(sink.wall, 1));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, mat!);
    mesh.matrixAutoUpdate = false;
    mesh.visible = !c.loaded;
    c.mesh = mesh;
    this.scene.add(mesh);
  }

  // a far tree: a four-sided crown on a stub of trunk, six triangles. Real and street
  // trees only, capped, so a cell costs about what one detailed house does
  private trees(key: string, s: Sink) {
    const list = this.treesOf!(key);
    let n = 0;
    const leaf = this.leaf;
    for (const t of list) {
      if (t.bush || t.reed || t.r < 7) continue;
      if (++n > 220) break;
      const g = this.terrain.heightAt(t.x, t.y);
      const r = t.r * 1.1, base = g + t.r * 0.9, top = base + r * 1.5;
      const j = 0.88 + (hash32(Math.round(t.x), Math.round(t.y), 3) % 100) / 400;
      const P: [number, number][] = [[t.x - r, t.y], [t.x, t.y + r], [t.x + r, t.y], [t.x, t.y - r]];
      for (let i = 0; i < 4; i++) {
        const a = P[i], b = P[(i + 1) % 4];
        const nx = (a[0] + b[0]) / 2 - t.x, nz = (a[1] + b[1]) / 2 - t.y, nl = Math.hypot(nx, nz) || 1;
        const sh = j * (0.72 + 0.28 * Math.max(0, (nx / nl) * 0.35 + (nz / nl) * 0.85));
        s.pos.push(a[0], base, a[1], b[0], base, b[1], t.x, top, t.y);
        for (let k = 0; k < 3; k++) { s.nor.push(nx / nl * 0.8, 0.6, nz / nl * 0.8); s.wall.push(0); s.col.push(leaf.r * sh, leaf.g * sh, leaf.b * sh); }
      }
      // the trunk: two crossed slivers
      const tw = Math.max(1, t.r * 0.12), tr = 0.35, tg = 0.26, tb = 0.18;
      s.pos.push(t.x - tw, g, t.y, t.x + tw, g, t.y, t.x, base + 1, t.y, t.x, g, t.y - tw, t.x, g, t.y + tw, t.x, base + 1, t.y);
      for (let k = 0; k < 6; k++) { s.nor.push(0, 0.3, 1); s.wall.push(0); s.col.push(tr, tg, tb); }
    }
  }

  // a far deck: per segment whose midpoint lies in this cell, a top at deck height, a
  // fascia each side, in the deck's own colours. No mitre; at this distance a hinge is a pixel
  private decks(kx: number, kz: number, s: Sink) {
    const inCell = (x: number, z: number) => Math.floor(x / CHUNK) === kx && Math.floor(z / CHUNK) === kz;
    const top = [0.23, 0.24, 0.26], side = [0.62, 0.62, 0.64], T = 7;
    const pierC = [0.66, 0.66, 0.67];
    for (const d of this.decksOf!()) {
      const p = d.pts, hw = d.w / 2 + 2;
      // the piers, as four-sided columns from their footing to the soffit
      for (const q of d.piers ?? []) {
        if (!inCell(q.x, q.z)) continue;
        const r = Math.max(5, hw * 0.16);
        const C: [number, number][] = [[q.x - r, q.z - r], [q.x + r, q.z - r], [q.x + r, q.z + r], [q.x - r, q.z + r]];
        for (let i = 0; i < 4; i++) {
          const a = C[i], b2 = C[(i + 1) % 4];
          const ex = b2[0] - a[0], ez = b2[1] - a[1], el = Math.hypot(ex, ez) || 1;
          const nx = ez / el, nz = -ex / el;
          const sh = 0.8 + 0.2 * Math.max(0, nx * 0.35 + nz * 0.85);
          s.pos.push(a[0], q.footY, a[1], b2[0], q.footY, b2[1], b2[0], q.topY, b2[1], a[0], q.footY, a[1], b2[0], q.topY, b2[1], a[0], q.topY, a[1]);
          for (let k = 0; k < 6; k++) { s.nor.push(nx, 0, nz); s.wall.push(0); s.col.push(pierC[0] * sh, pierC[1] * sh, pierC[2] * sh); }
        }
      }
      for (let i = 0; i + 3 < p.length; i += 2) {
        const x0 = p[i], z0 = p[i + 1], x1 = p[i + 2], z1 = p[i + 3];
        if (!inCell((x0 + x1) / 2, (z0 + z1) / 2)) continue;
        const ex = x1 - x0, ez = z1 - z0, el = Math.hypot(ex, ez) || 1;
        const nx = -ez / el * hw, nz = ex / el * hw;
        const y0 = d.yAt(x0, z0), y1 = d.yAt(x1, z1);
        // top
        s.pos.push(x0 - nx, y0, z0 - nz, x1 - nx, y1, z1 - nz, x1 + nx, y1, z1 + nz, x0 - nx, y0, z0 - nz, x1 + nx, y1, z1 + nz, x0 + nx, y0, z0 + nz);
        for (let k = 0; k < 6; k++) { s.nor.push(0, 1, 0); s.wall.push(0); s.col.push(top[0], top[1], top[2]); }
        // the paint: a centre line and the two edge lines, a hair above the top, so the
        // lanes run on where the detailed deck hands over to this one
        const stripe = (off: number, half: number, r: number, g: number, b: number) => {
          const ux = nx / hw, uz = nz / hw;   // unit across
          const ax = x0 + ux * off, az = z0 + uz * off, bx = x1 + ux * off, bz = z1 + uz * off;
          const wx = ux * half, wz = uz * half;
          s.pos.push(ax - wx, y0 + 0.3, az - wz, bx - wx, y1 + 0.3, bz - wz, bx + wx, y1 + 0.3, bz + wz, ax - wx, y0 + 0.3, az - wz, bx + wx, y1 + 0.3, bz + wz, ax + wx, y0 + 0.3, az + wz);
          for (let k = 0; k < 6; k++) { s.nor.push(0, 1, 0); s.wall.push(0); s.col.push(r, g, b); }
        };
        stripe(0, 0.8, 0.79, 0.64, 0.24);
        stripe(hw - 4, 0.6, 0.9, 0.9, 0.88);
        stripe(-(hw - 4), 0.6, 0.9, 0.9, 0.88);
        // fascias
        for (const sg of [1, -1]) {
          const ax = x0 + nx * sg, az = z0 + nz * sg, bx = x1 + nx * sg, bz = z1 + nz * sg;
          s.pos.push(ax, y0 - T, az, bx, y1 - T, bz, bx, y1, bz, ax, y0 - T, az, bx, y1, bz, ax, y0, az);
          for (let k = 0; k < 6; k++) { s.nor.push(nx / hw * sg, 0, nz / hw * sg); s.wall.push(0); s.col.push(side[0], side[1], side[2]); }
        }
      }
    }
  }

  // What the detailed build multiplies a wall or roof hex by. A far stand-in carries no
  // texture, and the wall hexes are PALE — the brick grain is what makes a brick block
  // red — so a downtown block went to the horizon as a blank grey crate and turned dark
  // red the moment its chunk streamed in. Multiplying by the texture's own mean keeps
  // the two the same colour, and the LOD swap stops being a colour change.
  private tint(kind: 'brick' | 'clap' | 'shingle' | 'plain'): THREE.Color {
    let c = this.tints.get(kind);
    if (!c) {
      c = kind === 'brick' ? texMean(brickTex())
        : kind === 'clap' ? texMean(clapboardTex())
        : kind === 'shingle' ? texMean(shingleTex())
        : new THREE.Color(1, 1, 1);
      this.tints.set(kind, c);
    }
    return c;
  }
  private tints = new Map<string, THREE.Color>();

  private box(idx: number, s: Sink) {
    const b = this.world.buildings[idx];
    const n = b.p.length / 2;
    let cx = 0, cz = 0;
    for (let i = 0; i < n; i++) { cx += b.p[i * 2]; cz += b.p[i * 2 + 1]; }
    cx /= n; cz /= n;
    const { eave } = buildingDims(b, ringAreaM2(b.p));
    const g = this.terrain.heightAt(cx, cz) + (b.my ?? 0);
    const top = g + eave + 2;
    const isBrick = b.k === 'commercial' || b.k === 'civic';
    const wallT = this.tint(isBrick ? 'brick' : b.k === 'industrial' || b.k === 'shed' ? 'plain' : 'clap');
    tmp.set(wallHexFor(b, idx));
    const wr = tmp.r * wallT.r, wg = tmp.g * wallT.g, wb = tmp.b * wallT.b;
    // a flat roof is drawn untextured up close; a pitched one is shingle
    const pitchedRoof = b.k === 'house' || b.k === 'shed' || b.k === 'church';
    const roofT = this.tint(pitchedRoof ? 'shingle' : 'plain');
    tmp.set(pick(isBrick ? STYLE.building.roofsCommercial : STYLE.building.roofs, idx));
    const rr = tmp.r * roofT.r, rg = tmp.g * roofT.g, rb = tmp.b * roofT.b;
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
      for (let k = 0; k < 6; k++) { s.nor.push(nx, 0, nz); s.wall.push(1); s.col.push(r, gg, bb); }
    }
    let tris: number[][];
    try { tris = THREE.ShapeUtils.triangulateShape(v, []); } catch { tris = []; }
    for (const [i0, i1, i2] of tris) {
      s.pos.push(v[i0].x, top, v[i0].y, v[i1].x, top, v[i1].y, v[i2].x, top, v[i2].y);
      for (let k = 0; k < 3; k++) { s.nor.push(0, 1, 0); s.wall.push(0); s.col.push(rr, rg, rb); }
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
            for (let k = 0; k < 3; k++) { s.nor.push(nx, 0.7, nz); s.wall.push(0); s.col.push(rr * shade, rg * shade, rb * shade); }
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
        s.nor.push(0, 1, 0); s.wall.push(0); s.col.push(leaf.r * j, leaf.g * j, leaf.b * j);
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
        for (let k = 0; k < 6; k++) { s.nor.push(nx, 0, nz); s.wall.push(0); s.col.push(leaf.r * sh, leaf.g * sh, leaf.b * sh); }
      }
    };
    sides(t.ring, 0);
    let base = t.ring.length;
    for (const h of t.holes) { sides(h, base); base += h.length; }
  }
}
