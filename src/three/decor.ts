import * as THREE from 'three';
import type { WorldData, Building, Poly } from '../world/types';
import { WorldIndex, CHUNK, centroidOf, walkLine as walkLineD, obbOf, type OBB, distToPolylineSq, floatOutForWinter } from '../world/index';
import { STYLE, SEASON, TREES, pick, hash32, mulberry32 } from '../world/style';
import { clapboardTex, shingleTex, brickTex, plankTex } from './textures';
import { WATER_Y } from './water';
import { gillisCenter } from './gillis';
import { TOWN } from '@town';

// How full the harbor is — docked-boat slot occupancy (percent) per season.
// Devin's law: summer = tons of boats everywhere, fall = fewer, spring = fewer
// still, winter = none (and the floats themselves come out — floatOutForWinter).
const MOOR_FILL = SEASON === 'summer' ? 82 : SEASON === 'fall' ? 30 : SEASON === 'spring' ? 20 : 0;

// Per-chunk merged decor mesh with 5 textured material groups:
// 0 plain · 1 clapboard siding · 2 brick · 3 shingle roofing · 4 deck planks.
// Buildings carry Newburyport detail: siding courses, real brick, gabled shingle
// roofs, white fascia + corner boards, shutters, doors, chimneys, cornices.

export const BRIDGE_DECK_Y = 7;
export const PIER_DECK_Y = 4;
// a cleared sledding lane down the town's sledding hill in winter (keep in sync with
// the life.ts sled-hill constants); trees inside the lane are skipped so the kids
// have an open run and you can actually see them. null = the town has no lane.
const SLED_LANE = TOWN.sledLane;

const TEX_SCALE = 16; // 1 texture repeat = 16 world px = 2 m
const BEACH_X = TOWN.beachX; // east of here = barrier-beach zone (shake cottages, umbrellas); Infinity = none
const SHINGLE_ZONES = TOWN.shingleZones ?? [];   // weathered-shingle village districts (Rockport, Manchester)

const tmp = new THREE.Color();

class Bucket {
  pos: number[] = [];
  norm: number[] = [];
  col: number[] = [];
  uv: number[] = [];

  quadUV(ax: number, ay: number, az: number, bx: number, by: number, bz: number,
         cx: number, cy: number, cz: number, dx: number, dy: number, dz: number,
         nx: number, ny: number, nz: number, r: number, g: number, b: number,
         uA: number, vA: number, uB: number, vB: number, uC: number, vC: number, uD: number, vD: number) {
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz, ax, ay, az, cx, cy, cz, dx, dy, dz);
    for (let i = 0; i < 6; i++) this.norm.push(nx, ny, nz);
    for (let i = 0; i < 6; i++) this.col.push(r, g, b);
    this.uv.push(uA, vA, uB, vB, uC, vC, uA, vA, uC, vC, uD, vD);
  }

  quad(ax: number, ay: number, az: number, bx: number, by: number, bz: number,
       cx: number, cy: number, cz: number, dx: number, dy: number, dz: number,
       nx: number, ny: number, nz: number, r: number, g: number, b: number) {
    this.quadUV(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, nx, ny, nz, r, g, b, 0, 0, 0, 0, 0, 0, 0, 0);
  }

  triUV(ax: number, ay: number, az: number, bx: number, by: number, bz: number,
        cx: number, cy: number, cz: number, nx: number, ny: number, nz: number,
        r: number, g: number, b: number,
        uA: number, vA: number, uB: number, vB: number, uC: number, vC: number) {
    this.pos.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    for (let i = 0; i < 3; i++) this.norm.push(nx, ny, nz);
    for (let i = 0; i < 3; i++) this.col.push(r, g, b);
    this.uv.push(uA, vA, uB, vB, uC, vC);
  }

  box(cx: number, cz: number, hw: number, hd: number, y0: number, y1: number, hex: string, uvScale = 0) {
    tmp.set(hex);
    const r = tmp.r, g = tmp.g, b = tmp.b;
    const u = uvScale ? (hw * 2) / TEX_SCALE : 0, v = uvScale ? (y1 - y0) / TEX_SCALE : 0;
    this.quadUV(cx - hw, y0, cz - hd, cx + hw, y0, cz - hd, cx + hw, y1, cz - hd, cx - hw, y1, cz - hd, 0, 0, -1, r * 0.85, g * 0.85, b * 0.85, 0, 0, u, 0, u, v, 0, v);
    this.quadUV(cx + hw, y0, cz + hd, cx - hw, y0, cz + hd, cx - hw, y1, cz + hd, cx + hw, y1, cz + hd, 0, 0, 1, r, g, b, 0, 0, u, 0, u, v, 0, v);
    this.quadUV(cx - hw, y0, cz + hd, cx - hw, y0, cz - hd, cx - hw, y1, cz - hd, cx - hw, y1, cz + hd, -1, 0, 0, r * 0.9, g * 0.9, b * 0.9, 0, 0, u, 0, u, v, 0, v);
    this.quadUV(cx + hw, y0, cz - hd, cx + hw, y0, cz + hd, cx + hw, y1, cz + hd, cx + hw, y1, cz - hd, 1, 0, 0, r * 0.95, g * 0.95, b * 0.95, 0, 0, u, 0, u, v, 0, v);
    this.quad(cx - hw, y1, cz - hd, cx + hw, y1, cz - hd, cx + hw, y1, cz + hd, cx - hw, y1, cz + hd, 0, 1, 0, r, g, b);
  }
}

const PLAIN = 0, CLAP = 1, BRICK = 2, SHINGLE = 3, PLANK = 4, GLOW = 5;

function ringToVec2(ring: number[]): THREE.Vector2[] {
  const v: THREE.Vector2[] = [];
  for (let i = 0; i < ring.length; i += 2) v.push(new THREE.Vector2(ring[i], -ring[i + 1]));
  let area = 0;
  for (let i = 0; i < v.length; i++) {
    const j = (i + 1) % v.length;
    area += v[i].x * v[j].y - v[j].x * v[i].y;
  }
  if (area < 0) v.reverse();
  return v;
}

function ringAreaM2(ring: number[]): number {
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    a += ring[i] * ring[j + 1] - ring[j] * ring[i + 1];
  }
  return Math.abs(a / 2) / 64; // 8px per m
}

// textured walls along the exact footprint, sun-shaded per face
function walls(bk: Bucket, ring: number[], y0: number, y1: number, hex: string, texScale = TEX_SCALE) {
  const v = ringToVec2(ring);
  tmp.set(hex);
  const r = tmp.r, g = tmp.g, b = tmp.b;
  for (let i = 0; i < v.length; i++) {
    const a = v[i], bb = v[(i + 1) % v.length];
    const ex = bb.x - a.x, ey = bb.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 0.01) continue;
    const nx = ey / len, nz = ex / len;
    const shade = 0.78 + 0.22 * Math.max(0, nx * 0.35 + nz * 0.85);
    const u = texScale ? len / texScale : 0;
    const v0 = texScale ? y0 / texScale : 0, v1 = texScale ? y1 / texScale : 0;
    bk.quadUV(a.x, y0, -a.y, bb.x, y0, -bb.y, bb.x, y1, -bb.y, a.x, y1, -a.y,
      nx, 0, nz, r * shade, g * shade, b * shade, 0, v0, u, v0, u, v1, 0, v1);
  }
}

function flatRoof(bk: Bucket, ring: number[], h: number, hex: string) {
  tmp.set(hex);
  const v = ringToVec2(ring);
  const tris = THREE.ShapeUtils.triangulateShape(v, []);
  for (const [i0, i1, i2] of tris) {
    bk.triUV(v[i0].x, h, -v[i0].y, v[i1].x, h, -v[i1].y, v[i2].x, h, -v[i2].y, 0, 1, 0, tmp.r, tmp.g, tmp.b,
      v[i0].x / 24, v[i0].y / 24, v[i1].x / 24, v[i1].y / 24, v[i2].x / 24, v[i2].y / 24);
  }
}


// gabled shingle roof CLIPPED TO THE REAL FOOTPRINT (small overhang), split at
// the ridge; the walls of the footprint rise to meet it (gable ends included).
// No more roof slabs sailing past notched corners.
// How much of its oriented bounding box a footprint actually fills. OBB roofs
// (gable/hip/mansard) span the whole box — on an L/U-shaped or campus footprint
// that drapes a giant slab across courtyards and lawns (Cape Ann Museum's
// 17-vertex campus wore one over half a block). Below this fill, only a
// ring-hugging flat roof is safe.
const OBB_ROOF_MIN_FILL = 0.62;
function obbFill(ring: number[], obb: OBB): number {
  return (ringAreaM2(ring) * 64) / Math.max(1, 4 * obb.hl * obb.hw);
}

function gableRoof(shin: Bucket, clap: Bucket, ring: number[], obb: OBB, eaveH: number, ridgeH: number, ov: number,
                   roofHex: string, wallHex: string) {
  if (obbFill(ring, obb) < OBB_ROOF_MIN_FILL) { flatRoof(shin, ring, eaveH + 1, roofHex); return; }   // concave footprint — never drape the box
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const W = obb.hw + ov;
  tmp.set(roofHex);
  const rr = tmp.r, rg = tmp.g, rb = tmp.b;
  const slopeLen = Math.hypot(ridgeH, W) || 1;
  const nyS = W / slopeLen, nzS = ridgeH / slopeLen;

  // footprint expanded ~ov for the eave overhang (anisotropic scale in OBB frame)
  const sL = (obb.hl + ov) / Math.max(1, obb.hl);
  const sW = W / Math.max(1, obb.hw);
  const exp: number[] = [];
  for (let i = 0; i < ring.length; i += 2) {
    const dx = ring[i] - obb.cx, dz = ring[i + 1] - obb.cz;
    const l = (dx * ca + dz * sa) * sL, w = (-dx * sa + dz * ca) * sW;
    exp.push(obb.cx + l * ca - w * sa, obb.cz + l * sa + w * ca);
  }

  const yOf = (x: number, z: number) => {
    const w = -(x - obb.cx) * sa + (z - obb.cz) * ca;
    return eaveH + ridgeH * Math.max(0, 1 - Math.abs(w) / W);
  };
  const uvOf = (x: number, z: number): [number, number] => {
    const dx = x - obb.cx, dz = z - obb.cz;
    return [(dx * ca + dz * sa) / TEX_SCALE, (Math.abs(-dx * sa + dz * ca) / W) * slopeLen / TEX_SCALE];
  };

  let drewSomething = false;
  for (const side of [1, -1] as const) {
    // the half of the footprint on this side of the ridge line
    const half = clipRing(exp, obb.cx, obb.cz, -sa, ca, 0, side < 0);
    if (half.length < 6) continue;
    // drop near-duplicate points so triangulation stays happy
    const clean: number[] = [];
    for (let i = 0; i < half.length; i += 2) {
      const n = clean.length;
      if (n >= 2 && Math.abs(half[i] - clean[n - 2]) < 0.05 && Math.abs(half[i + 1] - clean[n - 1]) < 0.05) continue;
      clean.push(half[i], half[i + 1]);
    }
    if (clean.length < 6) continue;
    const v = ringToVec2(clean);
    let tris: number[][];
    try {
      tris = THREE.ShapeUtils.triangulateShape(v, []);
    } catch {
      continue;
    }
    const nx = side * -sa * nzS, nz = side * ca * nzS;
    const shade = side > 0 ? 1 : 0.82;
    for (const [i0, i1, i2] of tris) {
      const p = [v[i0], v[i1], v[i2]].map((q) => [q.x, -q.y] as [number, number]);
      const uv = p.map(([x, z]) => uvOf(x, z));
      shin.triUV(
        p[0][0], yOf(p[0][0], p[0][1]), p[0][1],
        p[1][0], yOf(p[1][0], p[1][1]), p[1][1],
        p[2][0], yOf(p[2][0], p[2][1]), p[2][1],
        nx, nyS, nz, rr * shade, rg * shade, rb * shade,
        uv[0][0], uv[0][1], uv[1][0], uv[1][1], uv[2][0], uv[2][1]
      );
      drewSomething = true;
    }
  }
  // degenerate footprint fallback: plain OBB slopes (never leave a house roofless)
  if (!drewSomething) {
    const L = obb.hl + ov;
    const pt = (lx: number, lz: number, y: number): [number, number, number] =>
      [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
    const uL = (L * 2) / TEX_SCALE, vS = slopeLen / TEX_SCALE;
    const a = pt(-L, W, eaveH), b = pt(L, W, eaveH), c = pt(L, 0, eaveH + ridgeH), d = pt(-L, 0, eaveH + ridgeH);
    shin.quadUV(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], d[0], d[1], d[2],
      -sa * nzS, nyS, ca * nzS, rr, rg, rb, 0, 0, uL, 0, uL, vS, 0, vS);
    const a2 = pt(L, -W, eaveH), b2 = pt(-L, -W, eaveH), c2 = pt(-L, 0, eaveH + ridgeH), d2 = pt(L, 0, eaveH + ridgeH);
    shin.quadUV(a2[0], a2[1], a2[2], b2[0], b2[1], b2[2], c2[0], c2[1], c2[2], d2[0], d2[1], d2[2],
      sa * nzS, nyS, -ca * nzS, rr * 0.82, rg * 0.82, rb * 0.82, 0, 0, uL, 0, uL, vS, 0, vS);
  }
  wallsToRoof(clap, ring, obb, eaveH, ridgeH, ov, wallHex);
}

// walls rise from the eave line to the roof underside along the REAL footprint:
// jogged corners stay sealed under the overhang, and gable-end peaks form
// exactly on the real walls instead of floating at the bounding-box ends
function wallsToRoof(clap: Bucket, ring: number[], obb: OBB, eaveH: number, ridgeH: number,
                     ov: number, wallHex: string) {
  const W = obb.hw + ov;
  const sa = Math.sin(obb.ang), ca = Math.cos(obb.ang);
  const acrossOf = (x: number, z: number) => -(x - obb.cx) * sa + (z - obb.cz) * ca;
  const roofY = (w: number) => eaveH + ridgeH * Math.max(0, 1 - Math.abs(w) / W);
  const v = ringToVec2(ring);
  tmp.set(wallHex);
  const r = tmp.r, g = tmp.g, b = tmp.b;
  for (let i = 0; i < v.length; i++) {
    const a = v[i], bb = v[(i + 1) % v.length];
    const ex = bb.x - a.x, ey = bb.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 0.01) continue;
    const nx = ey / len, nz = ex / len;
    const shade = 0.78 + 0.22 * Math.max(0, nx * 0.35 + nz * 0.85);
    // edge in world space (vec2 y = -worldZ), split where it crosses the ridge
    const p0: [number, number] = [a.x, -a.y];
    const p1: [number, number] = [bb.x, -bb.y];
    const w0 = acrossOf(p0[0], p0[1]);
    const w1 = acrossOf(p1[0], p1[1]);
    const chain: [number, number, number][] = [[p0[0], p0[1], w0]];
    if ((w0 < 0) !== (w1 < 0) && Math.abs(w0 - w1) > 0.001) {
      const t = w0 / (w0 - w1);
      chain.push([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t, 0]);
    }
    chain.push([p1[0], p1[1], w1]);
    let u0 = 0;
    for (let s = 0; s + 1 < chain.length; s++) {
      const [x0, z0, wa] = chain[s];
      const [x1, z1, wb] = chain[s + 1];
      const y0t = roofY(wa), y1t = roofY(wb);
      const u1 = u0 + Math.hypot(x1 - x0, z1 - z0) / TEX_SCALE;
      if (Math.max(y0t, y1t) - eaveH > 0.08) {
        clap.quadUV(
          x0, eaveH, z0, x1, eaveH, z1, x1, y1t, z1, x0, y0t, z0,
          nx, 0, nz, r * shade, g * shade, b * shade,
          u0, eaveH / TEX_SCALE, u1, eaveH / TEX_SCALE, u1, y1t / TEX_SCALE, u0, y0t / TEX_SCALE
        );
      }
      u0 = u1;
    }
  }
}

// clip a ring against the half-plane (along-axis coordinate <= / >= split)
function clipRing(ring: number[], cx: number, cz: number, ax: number, az: number, split: number, keepBelow: boolean): number[] {
  const side = (x: number, z: number) => (x - cx) * ax + (z - cz) * az - split;
  const out: number[] = [];
  const n = ring.length / 2;
  for (let i = 0; i < n; i++) {
    const x0 = ring[i * 2], z0 = ring[i * 2 + 1];
    const x1 = ring[((i + 1) % n) * 2], z1 = ring[((i + 1) % n) * 2 + 1];
    const s0 = side(x0, z0), s1 = side(x1, z1);
    const in0 = keepBelow ? s0 <= 0 : s0 >= 0;
    const in1 = keepBelow ? s1 <= 0 : s1 >= 0;
    if (in0) out.push(x0, z0);
    if (in0 !== in1) {
      const t = s0 / (s0 - s1);
      out.push(x0 + (x1 - x0) * t, z0 + (z1 - z0) * t);
    }
  }
  return out;
}

function ringAreaPx2(ring: number[]): number {
  let a = 0;
  const n = ring.length;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    a += ring[i] * ring[j + 1] - ring[j] * ring[i + 1];
  }
  return Math.abs(a / 2);
}

// real roof massing: rectangular footprints get one gable; L/T-shaped footprints
// split at their concavity into wings, each with its own correctly-oriented gable
function complexGable(shin: Bucket, clap: Bucket, ring: number[], eaveAbs: number,
                      roofHex: string, wallHex: string, depth = 0, split = true) {
  const obb = obbOf(ring);
  const fill = ringAreaPx2(ring) / Math.max(1, 4 * obb.hl * obb.hw);
  const simple = () => {
    // an OBB gable over a sparse ring roofs empty air — and anything in it,
    // including streets (zigzag condo rows did exactly this). Two guards, both
    // by construction: a ratio for small sparse rings, and an absolute cap so
    // a big ring can never roof more than ~a porch worth of land it doesn't
    // own. Either trips → flat roof on the EXACT outline, which cannot
    // overhang anything.
    const overhangM2 = (4 * obb.hl * obb.hw - ringAreaPx2(ring)) / 64;
    if (fill < 0.55 || overhangM2 > 90) {
      flatRoof(shin, ring, eaveAbs, roofHex);
      walls(clap, ring, eaveAbs, eaveAbs + 2.5, wallHex);
      return;
    }
    const ridgeH = Math.max(7, Math.min(22, obb.hw * 0.55));
    gableRoof(shin, clap, ring, obb, eaveAbs, ridgeH, 2.5, roofHex, wallHex);   // tight eave — sits on the foundation
  };
  // Accessory structures (garages/sheds) are single volumes — never split them
  // into two gabled wings (the "my one-car garage looks like two buildings" report).
  if (!split || fill >= 0.72 || depth >= 2 || obb.hw < 6 || ring.length < 10) return simple();

  const ax = Math.cos(obb.ang), az = Math.sin(obb.ang);
  const v = ringToVec2(ring); // CCW in (x, -z)
  const n = v.length;
  let best: { s: number; score: number } | null = null;
  for (let i = 0; i < n; i++) {
    const a = v[(i + n - 1) % n], b = v[i], c = v[(i + 1) % n];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross < 0) {
      const s = (b.x - obb.cx) * ax + (-b.y - obb.cz) * az;
      const score = obb.hl - Math.abs(s);
      if (Math.abs(s) < obb.hl * 0.85 && (!best || score > best.score)) best = { s, score };
    }
  }
  if (!best) return simple();
  const A = clipRing(ring, obb.cx, obb.cz, ax, az, best.s, true);
  const B = clipRing(ring, obb.cx, obb.cz, ax, az, best.s, false);
  const minArea = 28 * 64; // ≈28 m² per wing
  if (A.length < 8 || B.length < 8 || ringAreaPx2(A) < minArea || ringAreaPx2(B) < minArea) return simple();
  complexGable(shin, clap, A, eaveAbs, roofHex, wallHex, depth + 1);
  complexGable(shin, clap, B, eaveAbs, roofHex, wallHex, depth + 1);
}

function hipRoof(shin: Bucket, obb: OBB, eaveH: number, ridgeH: number, ov: number, roofHex: string, pyramid: boolean) {
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const L = obb.hl + ov, W = obb.hw + ov;
  const rL = pyramid ? 0 : Math.max(0, L - W);   // half ridge length; hips inset ~W from each end
  const ridge = eaveH + ridgeH;
  tmp.set(roofHex);
  const rr = tmp.r, rg = tmp.g, rb = tmp.b;
  const pt = (l: number, w: number, y: number): [number, number, number] =>
    [obb.cx + l * ca - w * sa, y, obb.cz + l * sa + w * ca];
  const U = (l: number, w: number): [number, number] => [l / TEX_SCALE, w / TEX_SCALE];
  const A = pt(-L, W, eaveH), B = pt(L, W, eaveH), C = pt(L, -W, eaveH), D = pt(-L, -W, eaveH);
  const RE = pt(rL, 0, ridge), RW = pt(-rL, 0, ridge);
  const norm = (p: number[], q: number[], s: number[]): [number, number, number, number] => {
    let nx = (q[1] - p[1]) * (s[2] - p[2]) - (q[2] - p[2]) * (s[1] - p[1]);
    let ny = (q[2] - p[2]) * (s[0] - p[0]) - (q[0] - p[0]) * (s[2] - p[2]);
    let nz = (q[0] - p[0]) * (s[1] - p[1]) - (q[1] - p[1]) * (s[0] - p[0]);
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; }
    return [nx, ny, nz, 0.8 + 0.2 * Math.max(0, nx * 0.35 + nz * 0.85)];
  };
  const quad = (p: number[], q: number[], s: number[], t: number[], up: number[], uq: number[], us: number[], ut: number[]) => {
    const [nx, ny, nz, sh] = norm(p, q, s);
    shin.quadUV(p[0], p[1], p[2], q[0], q[1], q[2], s[0], s[1], s[2], t[0], t[1], t[2], nx, ny, nz, rr * sh, rg * sh, rb * sh, up[0], up[1], uq[0], uq[1], us[0], us[1], ut[0], ut[1]);
  };
  const tri = (p: number[], q: number[], s: number[], up: number[], uq: number[], us: number[]) => {
    const [nx, ny, nz, sh] = norm(p, q, s);
    shin.triUV(p[0], p[1], p[2], q[0], q[1], q[2], s[0], s[1], s[2], nx, ny, nz, rr * sh, rg * sh, rb * sh, up[0], up[1], uq[0], uq[1], us[0], us[1]);
  };
  if (rL > 0.5) {
    quad(A, B, RE, RW, U(-L, W), U(L, W), U(rL, 0), U(-rL, 0));   // long slope
    quad(C, D, RW, RE, U(L, -W), U(-L, -W), U(-rL, 0), U(rL, 0)); // long slope
    tri(B, C, RE, U(L, W), U(L, -W), U(rL, 0));                   // hip end
    tri(D, A, RW, U(-L, -W), U(-L, W), U(-rL, 0));                // hip end
  } else {
    const AP = pt(0, 0, ridge);
    tri(A, B, AP, U(-L, W), U(L, W), U(0, 0));
    tri(B, C, AP, U(L, W), U(L, -W), U(0, 0));
    tri(C, D, AP, U(L, -W), U(-L, -W), U(0, 0));
    tri(D, A, AP, U(-L, -W), U(-L, W), U(0, 0));
  }
}

// A mansard (Second Empire) roof from the OBB: four steep lower slopes rising to a
// setback, capped near-flat, with dormers punched into the two long faces. Very New
// England — Salem/Newburyport are full of them. Walls already rise to the eave.
function mansardRoof(shin: Bucket, plain: Bucket, obb: OBB, eaveH: number, ov: number, roofHex: string) {
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const L = obb.hl + ov, W = obb.hw + ov;
  const lowerH = Math.max(13, Math.min(26, Math.min(L, W) * 0.85));   // steep lower-slope rise
  const inset = Math.min(L, W) * 0.32;                                // horizontal setback
  const topY = eaveH + lowerH;
  const sL = Math.max(2, L - inset), sW = Math.max(2, W - inset);
  tmp.set(roofHex); const rr = tmp.r, rg = tmp.g, rb = tmp.b;
  const pt = (l: number, w: number, y: number): [number, number, number] =>
    [obb.cx + l * ca - w * sa, y, obb.cz + l * sa + w * ca];
  const uv = (along: number, y: number): [number, number] => [along / TEX_SCALE, y / TEX_SCALE];
  const norm = (p: number[], q: number[], s: number[]): [number, number, number, number] => {
    let nx = (q[1]-p[1])*(s[2]-p[2]) - (q[2]-p[2])*(s[1]-p[1]);
    let ny = (q[2]-p[2])*(s[0]-p[0]) - (q[0]-p[0])*(s[2]-p[2]);
    let nz = (q[0]-p[0])*(s[1]-p[1]) - (q[1]-p[1])*(s[0]-p[0]);
    const nl = Math.hypot(nx, ny, nz) || 1; nx/=nl; ny/=nl; nz/=nl;
    if (ny < 0) { nx=-nx; ny=-ny; nz=-nz; }
    return [nx, ny, nz, 0.8 + 0.2 * Math.max(0, nx*0.35 + nz*0.85)];
  };
  const face = (p: number[], q: number[], s: number[], t: number[], ua: number[], ub: number[], uc: number[], ud: number[]) => {
    const [nx, ny, nz, sh] = norm(p, q, s);
    shin.quadUV(p[0],p[1],p[2], q[0],q[1],q[2], s[0],s[1],s[2], t[0],t[1],t[2], nx,ny,nz, rr*sh,rg*sh,rb*sh, ua[0],ua[1], ub[0],ub[1], uc[0],uc[1], ud[0],ud[1]);
  };
  const A=pt(-L,W,eaveH), B=pt(L,W,eaveH), C=pt(L,-W,eaveH), D=pt(-L,-W,eaveH);
  const a=pt(-sL,sW,topY), b2=pt(sL,sW,topY), c2=pt(sL,-sW,topY), d2=pt(-sL,-sW,topY);
  face(A,B,b2,a,  uv(-L,eaveH),uv(L,eaveH),uv(sL,topY),uv(-sL,topY));   // south steep
  face(C,D,d2,c2, uv(L,eaveH),uv(-L,eaveH),uv(-sL,topY),uv(sL,topY));   // north steep
  face(B,C,c2,b2, uv(W,eaveH),uv(-W,eaveH),uv(-sW,topY),uv(sW,topY));   // east steep
  face(D,A,a,d2,  uv(-W,eaveH),uv(W,eaveH),uv(sW,topY),uv(-sW,topY));   // west steep
  shin.quadUV(a[0],a[1],a[2], b2[0],b2[1],b2[2], c2[0],c2[1],c2[2], d2[0],d2[1],d2[2], 0,1,0, rr*0.88,rg*0.88,rb*0.88,
    -sL/TEX_SCALE,sW/TEX_SCALE, sL/TEX_SCALE,sW/TEX_SCALE, sL/TEX_SCALE,-sW/TEX_SCALE, -sL/TEX_SCALE,-sW/TEX_SCALE);   // near-flat cap
  // dormers in the two long faces
  const nd = Math.max(1, Math.min(3, Math.floor(sL / 18)));
  for (const side of [1, -1]) {
    for (let i = 0; i < nd; i++) {
      const l0 = nd === 1 ? 0 : -sL * 0.58 + (i / (nd - 1)) * sL * 1.16;
      mansardDormer(plain, obb, l0, side, W, eaveH, lowerH);
    }
  }
}

// A bold gabled dormer projecting from a mansard's steep face: cream body + dark window
// + a peaked roof whose triangular gable end reads toward the street. Placed in the OBB
// frame at l0 along the wall, on the side*W face.
function mansardDormer(plain: Bucket, obb: OBB, l0: number, side: number, W: number, eaveH: number, lowerH: number) {
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const dw = 6.5;                          // half width along the wall (~1.6 m)
  const wF = side * (W + 2.5);             // front, proud of the eave
  const wB = side * (W - 6.5);             // back, set into the roof
  const yBase = eaveH + Math.max(4, lowerH * 0.16);            // lifted into the dark roof field for contrast
  const yTop = eaveH + Math.min(lowerH * 0.74, lowerH - 4);
  const ridgeY = Math.min(yTop + 5, eaveH + lowerH - 1);
  const pt = (l: number, w: number, y: number): [number, number, number] =>
    [obb.cx + l * ca - w * sa, y, obb.cz + l * sa + w * ca];
  const bmid = (wB + wF) / 2;
  rotBox(plain, obb.cx + l0 * ca - bmid * sa, obb.cz + l0 * sa + bmid * ca, dw, Math.abs(wF - wB) / 2, yBase, yTop, obb.ang, '#f6f1e7');  // bright body — pops on the dark mansard
  const wWin = wF - side * 0.4;
  rotBox(plain, obb.cx + l0 * ca - wWin * sa, obb.cz + l0 * sa + wWin * ca, dw - 2.2, 0.5, yBase + 2, yTop - 1.5, obb.ang, '#33373c');     // window
  tmp.set('#d7d0c0'); const rr = tmp.r, rg = tmp.g, rb = tmp.b;   // light dormer roof
  const sh = (p: number[], q: number[], s: number[]): [number, number, number, number] => {
    let nx = (q[1]-p[1])*(s[2]-p[2]) - (q[2]-p[2])*(s[1]-p[1]);
    let ny = (q[2]-p[2])*(s[0]-p[0]) - (q[0]-p[0])*(s[2]-p[2]);
    let nz = (q[0]-p[0])*(s[1]-p[1]) - (q[1]-p[1])*(s[0]-p[0]);
    const nl = Math.hypot(nx, ny, nz) || 1; nx/=nl; ny/=nl; nz/=nl;
    return [nx, ny, nz, 0.76 + 0.24 * Math.max(0, Math.abs(nx)*0.35 + ny*0.5 + Math.abs(nz)*0.6)];
  };
  const Lt = pt(l0 - dw, wB, yTop), Lf = pt(l0 - dw, wF, yTop);
  const Rt = pt(l0 + dw, wB, yTop), Rf = pt(l0 + dw, wF, yTop);
  const Kb = pt(l0, wB, ridgeY), Kf = pt(l0, wF, ridgeY);
  const q4 = (a: number[], b: number[], c: number[], d: number[]) => {
    const [nx, ny, nz, s2] = sh(a, b, c);
    plain.quad(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2], d[0],d[1],d[2], nx,ny,nz, rr*s2, rg*s2, rb*s2);
  };
  const t3 = (a: number[], b: number[], c: number[]) => {
    const [nx, ny, nz, s2] = sh(a, b, c);
    plain.triUV(a[0],a[1],a[2], b[0],b[1],b[2], c[0],c[1],c[2], nx,ny,nz, rr*s2, rg*s2, rb*s2, 0,0,0,0,0,0);
  };
  q4(Lt, Lf, Kf, Kb);   // left roof slope
  q4(Rf, Rt, Kb, Kf);   // right roof slope
  t3(Lf, Rf, Kf);       // street-facing gable triangle
}

// roof shape for a simple rectangular house: square-ish → pyramid/hip, medium → hip/gable
// mix, long → gable, with a Second Empire mansard on a minority of sizeable squarish ones.
function pickHouseRoof(obb: OBB, seed: number): 'gable' | 'hip' | 'pyramid' | 'mansard' {
  const ar = obb.hl / Math.max(1, obb.hw);
  const h = hash32(seed, 17, 3) % 100;
  if (ar < 1.7 && obb.hw > 18 && obb.hl > 18 && h < 24) return 'mansard';
  if (ar < 1.3) return h < 62 ? 'pyramid' : 'hip';
  if (ar < 2.1) return h < 48 ? 'hip' : 'gable';
  return 'gable';
}

// windows (+shutters), door, along the exact footprint walls.
// Commercial buildings get a storefront ground floor: display glass, awnings, sign band.
// `g` = ground height at the building, `eaveH` = ABSOLUTE eave height.
function facades(plain: Bucket, ring: number[], eaveH: number, rows: number,
                 seed: number, withDoor: boolean, withShutters: boolean, storefront: boolean, g: number,
                 maxWinOverride?: number, forceDoor?: string, forceShutter?: string) {
  const v = ringToVec2(ring);
  const rng = mulberry32(hash32(seed, 31, 7));
  let longest = -1, longestLen = 0;
  const lens: number[] = [];
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b = v[(i + 1) % v.length];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    lens.push(len);
    if (len > longestLen) { longestLen = len; longest = i; }
  }
  const shutterHex = forceShutter ?? pick(STYLE.building.shutters, seed);
  const awningHex = pick(STYLE.building.awnings, seed);
  // The window budget scales with the building, not a constant: every wall gets
  // glass at a steady rhythm regardless of footprint size, so a school reads
  // like a school anywhere on any map. If a footprint is so huge the estimate
  // passes the safety valve, the rhythm stretches uniformly — walls never go
  // blank because earlier walls spent the budget.
  let spacing = storefront ? 18 : 24;
  const perim = lens.reduce((s2, l) => s2 + l, 0);
  const SAFETY = 1400; // merged into the chunk mesh, so this is a data guard, not a perf cliff
  if (maxWinOverride === undefined && (perim / spacing) * rows > SAFETY) {
    spacing = (perim * rows) / SAFETY;
  }
  const maxWin = maxWinOverride ?? SAFETY;
  // Vertical rhythm: stretch the row pitch so the top row lands just under the
  // eave instead of leaving tall walls blank above a fixed-pitch cluster at the
  // bottom. Never compress below the classic 19 (short buildings keep their
  // look), and cap the stretch so an under-declared row count on a very tall
  // wall doesn't scatter windows absurdly far apart.
  const winY0 = g + 13;
  const pitch = rows > 1 ? Math.min(30, Math.max(19, (eaveH - 7 - winY0) / (rows - 1))) : 19;
  let windows = 0;
  let awningEdges = 0;
  tmp.set(STYLE.building.trim);
  const tr = tmp.r, tg = tmp.g, tb = tmp.b;
  const sh = new THREE.Color(shutterHex);
  for (let i = 0; i < v.length && windows < maxWin; i++) {
    const len = lens[i];
    if (len < 24) continue;
    const a = v[i], b = v[(i + 1) % v.length];
    const ux = (b.x - a.x) / len, uy = (b.y - a.y) / len;
    const nx = uy, nz = ux;
    const cols = Math.floor((len - 10) / spacing);
    if (cols < 1) continue;
    const gap = len / (cols + 1);
    // Doors scale with the wall, not a flat one-per-side: a real entrance roughly
    // every DOOR_PITCH of facade. A house's short front wall still reads as a single
    // centered door (round() keeps it at one until the wall is genuinely long); a long
    // mill / school / wharf wall earns a row of evenly-spread entrances. The street-
    // facing longest wall always gets at least one; other walls need real length first,
    // so back/short walls stay blank. doorCols is the set of columns that become doors.
    const DOOR_PITCH = 120;
    const doorCols = new Set<number>();
    if (withDoor && (i === longest || len >= 280)) {
      const nDoors = Math.min(cols, Math.max(1, Math.round(len / DOOR_PITCH)));
      for (let d = 0; d < nDoors; d++) {
        doorCols.add(Math.min(cols, Math.max(1, Math.round((cols + 1) * (d + 1) / (nDoors + 1)))));
      }
    }
    const edgeGetsAwnings = storefront && awningEdges < 4 && len >= 30;
    if (edgeGetsAwnings) {
      awningEdges++;
      // sign band above the storefront
      const mx = a.x + ux * (len / 2), my = a.y + uy * (len / 2);
      tmp.set(awningHex).multiplyScalar(0.72);
      billboard(plain, mx, my, nx, nz, ux, uy, Math.min(len / 2 - 5, 30), 2.2, g + 22.5, 0.4, tmp.r, tmp.g, tmp.b);
    }
    for (let c = 1; c <= cols && windows < maxWin; c++) {
      const t = gap * c;
      const wx = a.x + ux * t, wy = a.y + uy * t;
      // doors for this wall were chosen up front (count scales with wall length)
      const isDoorSlot = doorCols.has(c);
      for (let r = 0; r < rows; r++) {
        const yC = winY0 + r * pitch;
        if (yC + 6 > eaveH) break;
        if (isDoorSlot && r === 0) continue;
        if (storefront && r === 0) {
          // display glass: wide window, thick trim, awning over it
          billboard(plain, wx, wy, nx, nz, ux, uy, 9.5, 6.4, g + 10.5, 0.5, tr, tg, tb);
          tmp.set('#2e4452');
          billboard(plain, wx, wy, nx, nz, ux, uy, 8.4, 5.4, g + 10.2, 0.9, tmp.r, tmp.g, tmp.b);
          if (edgeGetsAwnings) awning(plain, wx, wy, nx, nz, ux, uy, 10.5, g + 19.5, 4.5, 7, awningHex);
          windows++;
          continue;
        }
        const lit = rng() < 0.08;
        billboard(plain, wx, wy, nx, nz, ux, uy, 4.6, 5.8, yC, 0.5, tr, tg, tb);
        tmp.set(lit ? STYLE.building.glassLit : STYLE.building.glass);
        billboard(plain, wx, wy, nx, nz, ux, uy, 3.4, 4.6, yC, 0.9, tmp.r, tmp.g, tmp.b);
        if (withShutters) {
          billboard(plain, wx - ux * 7.2, wy - uy * 7.2, nx, nz, ux, uy, 1.9, 5.6, yC, 0.7, sh.r, sh.g, sh.b);
          billboard(plain, wx + ux * 7.2, wy + uy * 7.2, nx, nz, ux, uy, 1.9, 5.6, yC, 0.7, sh.r, sh.g, sh.b);
        }
        windows++;
      }
      if (isDoorSlot) {
        billboard(plain, wx, wy, nx, nz, ux, uy, 5.4, 7.5, g + 7.5, 0.5, tr, tg, tb);
        tmp.set(forceDoor || pick(STYLE.building.doors, seed));
        billboard(plain, wx, wy, nx, nz, ux, uy, 4.2, 6.5, g + 6.5, 0.9, tmp.r, tmp.g, tmp.b);
        if (SEASON === 'winter') {
          // a wreath with a red bow on every door — the Newburyport December
          const doorHex = forceDoor || pick(STYLE.building.doors, seed);
          tmp.set('#2e5e38');
          billboard(plain, wx, wy, nx, nz, ux, uy, 1.9, 1.9, g + 10.4, 1.1, tmp.r, tmp.g, tmp.b);
          tmp.set(doorHex);
          billboard(plain, wx, wy, nx, nz, ux, uy, 0.85, 0.85, g + 10.4, 1.3, tmp.r, tmp.g, tmp.b);
          tmp.set('#c0392b');
          billboard(plain, wx, wy, nx, nz, ux, uy, 0.7, 0.7, g + 9.1, 1.4, tmp.r, tmp.g, tmp.b);
        }
        if (storefront && edgeGetsAwnings) awning(plain, wx, wy, nx, nz, ux, uy, 8, g + 19.5, 4.5, 7, awningHex);
      }
    }
  }
}

function billboard(bk: Bucket, x: number, y2: number, nx: number, nz: number,
                   ux: number, uy: number, hw: number, hh: number, yC: number, off: number,
                   r: number, g: number, b: number) {
  // vec2 space has y = -worldZ, so the outward normal there is (nx, -nz)
  const px = x + nx * off, py = y2 - nz * off;
  const ax = px - ux * hw, ay = py - uy * hw;
  const bx = px + ux * hw, by = py + uy * hw;
  bk.quad(ax, yC - hh, -ay, bx, yC - hh, -by, bx, yC + hh, -by, ax, yC + hh, -ay, nx, 0, nz, r, g, b);
}

// storefront awning: sloped canvas top + hanging valance
function awning(bk: Bucket, x: number, y2: number, nx: number, nz: number,
                ux: number, uy: number, hw: number, yTop: number, drop: number, out: number, hex: string) {
  tmp.set(hex);
  const r = tmp.r, g = tmp.g, b = tmp.b;
  const inX = x + nx * 0.8, inY = y2 - nz * 0.8;
  const outX = x + nx * out, outY = y2 - nz * out;
  const ilx = inX - ux * hw, ily = inY - uy * hw;
  const irx = inX + ux * hw, iry = inY + uy * hw;
  const olx = outX - ux * hw, oly = outY - uy * hw;
  const orx = outX + ux * hw, ory = outY + uy * hw;
  const sl = Math.hypot(out, drop) || 1;
  bk.quad(ilx, yTop, -ily, irx, yTop, -iry, orx, yTop - drop, -ory, olx, yTop - drop, -oly,
    nx * (drop / sl), out / sl, nz * (drop / sl), r, g, b);
  bk.quad(olx, yTop - drop, -oly, orx, yTop - drop, -ory, orx, yTop - drop - 2.5, -ory, olx, yTop - drop - 2.5, -oly,
    nx, 0, nz, r * 0.85, g * 0.85, b * 0.85);
}

// flat-on-the-ground rotated quad (towels)
function flatQuad(bk: Bucket, cx: number, cz: number, hl: number, hw: number, y: number, ang: number, hex: string) {
  tmp.set(hex);
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const pt = (lx: number, lz: number): [number, number] => [cx + lx * ca - lz * sa, cz + lx * sa + lz * ca];
  const a = pt(-hl, -hw), b = pt(hl, -hw), c = pt(hl, hw), d = pt(-hl, hw);
  bk.quad(a[0], y, a[1], b[0], y, b[1], c[0], y, c[1], d[0], y, d[1], 0, 1, 0, tmp.r, tmp.g, tmp.b);
}

// rotated box (cars): 4 walls + top
function rotBox(bk: Bucket, cx: number, cz: number, hl: number, hw: number, y0: number, y1: number, ang: number, hex: string) {
  tmp.set(hex);
  const r = tmp.r, g = tmp.g, b = tmp.b;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const pt = (lx: number, lz: number): [number, number] => [cx + lx * ca - lz * sa, cz + lx * sa + lz * ca];
  const corners = [pt(-hl, -hw), pt(hl, -hw), pt(hl, hw), pt(-hl, hw)];
  for (let i = 0; i < 4; i++) {
    const a = corners[i], bb = corners[(i + 1) % 4];
    const ex = bb[0] - a[0], ez = bb[1] - a[1];
    const len = Math.hypot(ex, ez) || 1;
    const nx = ez / len, nz = -ex / len;
    const shade = 0.82 + 0.18 * Math.max(0, nx * 0.35 + nz * 0.85);
    bk.quad(a[0], y0, a[1], bb[0], y0, bb[1], bb[0], y1, bb[1], a[0], y1, a[1], nx, 0, nz, r * shade, g * shade, b * shade);
  }
  bk.quad(corners[0][0], y1, corners[0][1], corners[1][0], y1, corners[1][1], corners[2][0], y1, corners[2][1], corners[3][0], y1, corners[3][1], 0, 1, 0, r, g, b);
}

// rotated box with chamfered corners + beveled top — the "soft" version of
// rotBox for vehicles (octagonal plan, inset rounded-feeling cap)
function chamferBox(bk: Bucket, cx: number, cz: number, hl: number, hw: number,
                    y0: number, y1: number, ang: number, hex: string, ch = 1.2) {
  tmp.set(hex);
  const r = tmp.r, g2 = tmp.g, b = tmp.b;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const cv = Math.min(ch, (y1 - y0) * 0.45);
  const ring = (l: number, w: number): [number, number][] => {
    const c = Math.max(0.03, Math.min(ch, l - 0.05, w - 0.05));
    const pts: [number, number][] = [
      [-l + c, -w], [l - c, -w], [l, -w + c], [l, w - c],
      [l - c, w], [-l + c, w], [-l, w - c], [-l, -w + c]
    ];
    return pts.map(([lx, lz]) => [cx + lx * ca - lz * sa, cz + lx * sa + lz * ca]);
  };
  const outer = ring(hl, hw);
  const inner = ring(Math.max(0.12, hl - cv), Math.max(0.12, hw - cv));
  const yB = y1 - cv;
  for (let i = 0; i < 8; i++) {
    const a = outer[i], bb = outer[(i + 1) % 8];
    const ex = bb[0] - a[0], ez = bb[1] - a[1];
    const len = Math.hypot(ex, ez);
    if (len < 0.01) continue;
    const nx = ez / len, nz = -ex / len;
    const shade = 0.82 + 0.18 * Math.max(0, nx * 0.35 + nz * 0.85);
    bk.quad(a[0], y0, a[1], bb[0], y0, bb[1], bb[0], yB, bb[1], a[0], yB, a[1],
      nx, 0, nz, r * shade, g2 * shade, b * shade);
    const a2 = inner[i], b2 = inner[(i + 1) % 8];
    const bs = 0.9 + 0.1 * Math.max(0, nx * 0.35 + nz * 0.85);
    bk.quad(a[0], yB, a[1], bb[0], yB, bb[1], b2[0], y1, b2[1], a2[0], y1, a2[1],
      nx * 0.55, 0.84, nz * 0.55, r * bs, g2 * bs, b * bs);
  }
  for (let i = 1; i < 7; i++) {
    bk.triUV(inner[0][0], y1, inner[0][1], inner[i][0], y1, inner[i][1], inner[i + 1][0], y1, inner[i + 1][1],
      0, 1, 0, r, g2, b, 0, 0, 0, 0, 0, 0);
  }
}

// lofted boat hull: widest amidships, tapering to a real pointed bow
function hull(bk: Bucket, x: number, z: number, hl: number, hw: number,
              yBot: number, yDeck: number, ang: number, hex: string) {
  tmp.set(hex);
  const r = tmp.r, g2 = tmp.g, b = tmp.b;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const at = (l: number, w: number): [number, number] => [x + l * ca - w * sa, z + l * sa + w * ca];
  const L = [-1, -0.4, 0.25, 0.74, 1].map((t) => t * hl);
  const W = [0.8, 1, 0.93, 0.58, 0.07].map((t) => t * hw);
  const B = [yBot, yBot, yBot, yBot + 0.8, yBot + 2];
  for (let i = 0; i < 4; i++) {
    for (const s of [1, -1] as const) {
      const a0 = at(L[i], s * W[i]), a1 = at(L[i + 1], s * W[i + 1]);
      const ex = a1[0] - a0[0], ez = a1[1] - a0[1];
      const len = Math.hypot(ex, ez);
      if (len < 0.01) continue;
      let nx = ez / len, nz = -ex / len;
      const mx = (a0[0] + a1[0]) / 2 - x, mz = (a0[1] + a1[1]) / 2 - z;
      if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
      const shade = 0.8 + 0.2 * Math.max(0, nx * 0.35 + nz * 0.85);
      bk.quad(a0[0], B[i], a0[1], a1[0], B[i + 1], a1[1], a1[0], yDeck, a1[1], a0[0], yDeck, a0[1],
        nx, 0, nz, r * shade, g2 * shade, b * shade);
    }
    const p0 = at(L[i], W[i]), q0 = at(L[i], -W[i]);
    const p1 = at(L[i + 1], W[i + 1]), q1 = at(L[i + 1], -W[i + 1]);
    bk.quad(q0[0], yDeck, q0[1], p0[0], yDeck, p0[1], p1[0], yDeck, p1[1], q1[0], yDeck, q1[1],
      0, 1, 0, r * 0.96, g2 * 0.96, b * 0.96);
  }
  const t0 = at(L[0], W[0]), t1 = at(L[0], -W[0]);
  bk.quad(t1[0], B[0], t1[1], t0[0], B[0], t0[1], t0[0], yDeck, t0[1], t1[0], yDeck, t1[1],
    -ca, 0, -sa, r * 0.85, g2 * 0.85, b * 0.85);
}

function car(bk: Bucket, x: number, z: number, ang: number, hex: string, g = 0) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  chamferBox(bk, x, z, 17, 7, g + 3, g + 10.2, ang, hex, 1.7);
  chamferBox(bk, x - ca * 3, z - sa * 3, 8.6, 5.8, g + 9.6, g + 15.5, ang, '#2e3338', 2.2);
  for (const [lx, lz] of [[-10.5, -7], [10.5, -7], [-10.5, 7], [10.5, 7]] as const) {
    chamferBox(bk, x + lx * ca - lz * sa, z + lx * sa + lz * ca, 2.5, 1.1, g, g + 4.6, ang, '#23241f', 1);
  }
}

// harbor boat on the water plane: runabouts, lobster boats, furled-sail sloops.
// Scaled up to read like real working boats beside the (tall, stylized) kid.
// A moored boat must float CLEAR (Devin: "boats cant be stacked on top of docks or
// be going through eachother"): bow, stern and center on open water, off every pier
// deck — the ring walk turns corners, where a naive perpendicular offset lays the
// hull diagonally across the dock — and at least a hull apart from its neighbours.
function mooringClear(index: WorldIndex, moored: [number, number][], bx: number, bz: number, ang: number, seed: number): boolean {
  const sc = 0.68 + (hash32(seed, 9, 2) % 100) / 100 * 0.8;   // same size boat() will build
  const r = 16 * sc + 4;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (const [px, pz] of [[bx, bz], [bx + ca * r, bz + sa * r], [bx - ca * r, bz - sa * r]] as [number, number][]) {
    if (!index.isWaterAt(px, pz)) return false;
    if (index.heightAtPx(px, pz) > WATER_Y - 0.5) return false;   // exposed flat — would beach
    if (index.pierAt(px, pz)) return false;                       // lying across a dock
  }
  for (const [mx, mz] of moored) {
    if ((bx - mx) * (bx - mx) + (bz - mz) * (bz - mz) < 44 * 44) return false;
  }
  return true;
}
function boat(bk: Bucket, x: number, z: number, ang: number, seed: number) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  // a real harbor moors every size — dinghies to near-yachts. One seed-driven
  // scale keeps the fleet varied but deterministic (Devin: "boats of different sizes")
  const sc = 0.68 + (hash32(seed, 9, 2) % 100) / 100 * 0.8;
  const vs = 0.82 + sc * 0.25;                      // heights grow slower than length
  const H = (n: number) => WATER_Y + n * vs;
  const hullHex = pick(['#f4f1e8', '#f4f1e8', '#e9e6db', '#27425c', '#7e3434', '#3e5c50'], seed);
  hull(bk, x, z, 32 * sc, 9.5 * sc, WATER_Y - 2.6, H(6.5), ang, hullHex);
  // gunwale rail cap running the length of the deck
  chamferBox(bk, x - ca * 2.5 * sc, z - sa * 2.5 * sc, 19 * sc, 6.4 * sc, H(6.5), H(8), ang, '#b9926a', 2.4 * sc);
  if (hash32(seed, 5, 1) % 100 < 45) {
    // sloop with the sails down — tall mast + boom
    bk.box(x, z, 0.9, 0.9, H(6), H(60), '#ece8dc');
    chamferBox(bk, x - ca * 9 * sc, z - sa * 9 * sc, 13 * sc, 1.3, H(14), H(16.5), ang, '#d8d2c2', 1);
  } else {
    // lobster-boat wheelhouse forward
    chamferBox(bk, x + ca * 7 * sc, z + sa * 7 * sc, 11 * sc, 7 * sc, H(6.5), H(20), ang, '#f8f6ee', 2.6 * sc);
    chamferBox(bk, x + ca * 7 * sc, z + sa * 7 * sc, 12 * sc, 8 * sc, H(19.5), H(21.6), ang, '#4a4640', 3 * sc);
  }
}

// parked single-engine hobby plane (the 2B2 fleet: high-wing trainers and Cubs)
function plane(bk: Bucket, x: number, z: number, ang: number, seed: number, g: number) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const accent = pick(['#c8453a', '#2e5e9e', '#3a6e4f', '#e0b53c', '#e0b53c'], seed);
  chamferBox(bk, x, z, 50, 8, g + 10, g + 22, ang, '#f4f1e8', 4);                       // fuselage
  chamferBox(bk, x + ca * 44, z + sa * 44, 11, 7.4, g + 11, g + 21, ang, accent, 4.4);   // cowl
  chamferBox(bk, x + ca * 14, z + sa * 14, 13, 6.8, g + 22, g + 28, ang, '#2e3338', 4.4); // canopy
  chamferBox(bk, x + ca * 9, z + sa * 9, 9, 77, g + 27, g + 29.5, ang, '#f4f1e8', 2.6);   // high wing (≈19 m span)
  rotBox(bk, x - ca * 45, z - sa * 45, 9, 1.6, g + 20, g + 37, ang, accent);             // fin
  chamferBox(bk, x - ca * 45, z - sa * 45, 6.3, 18, g + 20, g + 22.2, ang, '#f4f1e8', 1.8); // tailplane
  chamferBox(bk, x + ca * 56, z + sa * 56, 1.6, 2.2, g + 14, g + 18.5, ang, '#23241f', 0.9); // spinner
  rotBox(bk, x + ca * 57, z + sa * 57, 0.9, 1.3, g + 6.5, g + 24, ang, '#2e3338');       // prop blade
  for (const [lx, lz] of [[11, -9], [11, 9], [-36, 0]] as const) {
    chamferBox(bk, x + lx * ca - lz * sa, z + lx * sa + lz * ca, 2.3, 1.6, g, g + 10, ang, '#2e3338', 0.7); // gear
  }
}

// slanted plank with side skirts — slides, bridges, A-frame legs, seesaws
function plank(P: Bucket, x0: number, z0: number, y0: number, x1: number, z1: number, y1: number,
               hw: number, hex: string, skirt = 1) {
  const dx = x1 - x0, dz = z1 - z0;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len, nz = dx / len;
  tmp.set(hex);
  const r = tmp.r, g2 = tmp.g, b2 = tmp.b;
  P.quad(x0 - nx * hw, y0, z0 - nz * hw, x0 + nx * hw, y0, z0 + nz * hw,
    x1 + nx * hw, y1, z1 + nz * hw, x1 - nx * hw, y1, z1 - nz * hw,
    0, 1, 0, r, g2, b2);
  for (const s of [1, -1]) {
    P.quad(x0 + nx * hw * s, y0 - skirt, z0 + nz * hw * s, x1 + nx * hw * s, y1 - skirt, z1 + nz * hw * s,
      x1 + nx * hw * s, y1, z1 + nz * hw * s, x0 + nx * hw * s, y0, z0 + nz * hw * s,
      nx * s, 0, nz * s, r * 0.86, g2 * 0.86, b2 * 0.86);
  }
}

// playground kit: a real wooden play structure (two towers, bridge, roof,
// slide, monkey bars, ladder), A-frame swings, seesaw, spring riders
function playgroundKit(buckets: Bucket[], poly: Poly, index: WorldIndex, pi: number) {
  const obb = obbOf(poly.p);
  const rng = mulberry32(hash32(pi, 41, 9));
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const at = (lx: number, lz: number): [number, number] =>
    [obb.cx + lx * ca - lz * sa, obb.cz + lx * sa + lz * ca];
  const fits = (x: number, z: number, r: number) =>
    pointInPolyD(x, z, poly) && pointInPolyD(x + r, z, poly) && pointInPolyD(x - r, z, poly) &&
    pointInPolyD(x, z + r, poly) && pointInPolyD(x, z - r, poly);
  const P = buckets[PLAIN];
  const WOOD = '#9a7148', WOOD_D = '#7a5a3a', RED = '#c0452f', GREEN = '#3e7e52', YELLOW = '#e3b33c', STEEL = '#54585c';

  // the castle: low tower + bridge + high tower with a red roof, slide off the
  // high end, monkey bars off the low end, ladder up the side
  const castle = (x: number, z: number, g: number, ang: number, mini: boolean) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    const pt = (lx: number, lz: number): [number, number] => [x + lx * c - lz * s, z + lx * s + lz * c];
    const post = (lx: number, lz: number, h: number) => {
      const [px, pz] = pt(lx, lz);
      P.box(px, pz, 1.1, 1.1, g, g + h, WOOD_D);
    };
    const hiX = mini ? 0 : 10;
    // high tower
    for (const [lx, lz] of [[hiX - 5, -6], [hiX + 5, -6], [hiX - 5, 6], [hiX + 5, 6]] as const) post(lx, lz, 19);
    const [hx, hz] = pt(hiX, 0);
    rotBox(P, hx, hz, 6, 7, g + 13, g + 14.2, ang, WOOD);
    for (const lz of [-6.4, 6.4]) {
      const [rx, rz] = pt(hiX, lz);
      rotBox(P, rx, rz, 5.5, 0.45, g + 14.2, g + 17.4, ang, WOOD);
    }
    // pyramid roof
    const rs = 7.5;
    tmp.set(RED);
    const rc = [pt(hiX - rs, -rs), pt(hiX + rs, -rs), pt(hiX + rs, rs), pt(hiX - rs, rs)];
    for (let i = 0; i < 4; i++) {
      const a = rc[i], b2 = rc[(i + 1) % 4];
      const mx = (a[0] + b2[0]) / 2 - hx, mz = (a[1] + b2[1]) / 2 - hz;
      const ml = Math.hypot(mx, mz) || 1;
      P.triUV(a[0], g + 19.5, a[1], b2[0], g + 19.5, b2[1], hx, g + 26.5, hz,
        mx / ml * 0.7, 0.7, mz / ml * 0.7, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
    }
    // slide off the high tower
    const [s0x, s0z] = pt(hiX + 6, 0);
    const [s1x, s1z] = pt(hiX + 19, 0);
    plank(P, s0x, s0z, g + 13.4, s1x, s1z, g + 1.2, 2.2, YELLOW, 0.9);
    plank(P, s0x, s0z, g + 15.6, s1x, s1z, g + 3.4, 0.35, '#caa133', 2.1); // rails
    if (!mini) {
      // low tower + bridge
      for (const [lx, lz] of [[-17, -6], [-7, -6], [-17, 6], [-7, 6]] as const) post(lx, lz, 12);
      const [lxc, lzc] = pt(-12, 0);
      rotBox(P, lxc, lzc, 6, 7, g + 8, g + 9.2, ang, WOOD);
      for (const lz of [-6.4, 6.4]) {
        const [rx, rz] = pt(-12, lz);
        rotBox(P, rx, rz, 5.5, 0.45, g + 9.2, g + 12.2, ang, WOOD);
      }
      const [b0x, b0z] = pt(-6.5, 0);
      const [b1x, b1z] = pt(4.5, 0);
      plank(P, b0x, b0z, g + 9.2, b1x, b1z, g + 13, 2.6, WOOD, 1.2);
      // monkey bars off the low tower
      for (const lz of [-2.6, 2.6]) {
        const [m0x, m0z] = pt(-17, lz);
        const [m1x, m1z] = pt(-30, lz);
        plank(P, m0x, m0z, g + 11.4, m1x, m1z, g + 11.4, 0.4, YELLOW, 0.7);
      }
      for (let lx = -19.5; lx >= -28.5; lx -= 3) {
        const [rx, rz] = pt(lx, 0);
        rotBox(P, rx, rz, 0.35, 2.6, g + 10.9, g + 11.4, ang, STEEL);
      }
      post(-30, -2.6, 11.4);
      post(-30, 2.6, 11.4);
      // ladder up the low tower
      const [g0x, g0z] = pt(-12, -7.2);
      const [g1x, g1z] = pt(-12, -10.5);
      plank(P, g1x, g1z, g + 0.5, g0x, g0z, g + 8.8, 2, WOOD_D, 0.7);
    }
  };

  const swings = (x: number, z: number, g: number, ang: number) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    const pt = (lx: number, lz: number): [number, number] => [x + lx * c - lz * s, z + lx * s + lz * c];
    for (const e of [-11, 11]) {
      for (const lean of [-5, 5]) {
        const [fx, fz] = pt(e, lean);
        const [ax, az] = pt(e, 0);
        plank(P, fx, fz, g, ax, az, g + 13, 0.6, GREEN, 0.9);
      }
    }
    const [c0x, c0z] = pt(-11, 0);
    const [c1x, c1z] = pt(11, 0);
    plank(P, c0x, c0z, g + 13.4, c1x, c1z, g + 13.4, 0.5, GREEN, 0.9);
    for (const sx of [-5.5, 0, 5.5]) {
      for (const ch of [-1.7, 1.7]) {
        const [qx, qz] = pt(sx + ch, 0);
        P.box(qx, qz, 0.16, 0.16, g + 5, g + 12.6, '#494c50');
      }
      const [sx2, sz2] = pt(sx, 0);
      rotBox(P, sx2, sz2, 2, 1, g + 4.4, g + 5.1, ang, '#23241f');
    }
  };

  const seesaw = (x: number, z: number, g: number, ang: number) => {
    const c = Math.cos(ang), s = Math.sin(ang);
    rotBox(P, x, z, 1.6, 1.5, g, g + 3, ang, STEEL);
    const [p0x, p0z] = [x - c * 13, z - s * 13];
    const [p1x, p1z] = [x + c * 13, z + s * 13];
    plank(P, p0x, p0z, g + 1.6, p1x, p1z, g + 5.6, 1.5, '#33688e', 0.8);
    P.box(p0x + c * 2.5, p0z + s * 2.5, 0.25, 0.25, g + 2, g + 4.4, STEEL);
    P.box(p1x - c * 2.5, p1z - s * 2.5, 0.25, 0.25, g + 5.2, g + 7.6, STEEL);
  };

  const rider = (x: number, z: number, g: number, ang: number, hex: string) => {
    P.box(x, z, 0.55, 0.55, g, g + 2.6, STEEL);
    rotBox(P, x, z, 3, 1.2, g + 2.6, g + 4.6, ang, hex);
    rotBox(P, x + Math.cos(ang) * 2.8, z + Math.sin(ang) * 2.8, 1, 1.4, g + 4, g + 6.2, ang, hex);
  };

  // layout: castle center, swings one end, seesaw + riders the other
  const big = obb.hl > 42 && obb.hw > 18;
  {
    const [x, z] = at(big ? 0 : 0, 0);
    if (fits(x, z, big ? 17 : 11)) castle(x, z, index.heightAtPx(x, z), obb.ang + (rng() - 0.5) * 0.2, !big);
  }
  if (obb.hl > 30) {
    const [x, z] = at(-obb.hl * 0.62, obb.hw * 0.15);
    if (fits(x, z, 13)) swings(x, z, index.heightAtPx(x, z), obb.ang + (rng() - 0.5) * 0.3);
  }
  if (obb.hl > 36) {
    const [x, z] = at(obb.hl * 0.62, -obb.hw * 0.2);
    if (fits(x, z, 14)) seesaw(x, z, index.heightAtPx(x, z), obb.ang + 0.5 + rng());
  }
  for (let i = 0; i < 2; i++) {
    const [x, z] = at((rng() - 0.5) * obb.hl * 1.1, (rng() < 0.5 ? -1 : 1) * obb.hw * 0.55);
    if (fits(x, z, 5)) rider(x, z, index.heightAtPx(x, z), rng() * Math.PI * 2, i ? RED : '#33688e');
  }
}

// the Newburyport boardwalk: warm plank promenade that rides the bank (and the
// Plum Island dunes), on pilings, railed wherever it meets water or a drop
function boardwalk(buckets: Bucket[], pts: number[], w: number, baseY: number,
                   ox: number, oy: number, index: WorldIndex) {
  const plank = buckets[PLANK], plain = buckets[PLAIN];
  const deck = new THREE.Color('#c08c58');
  const skirtC = new THREE.Color('#6e5436');
  const railC = new THREE.Color('#54442e');
  const hw = w / 2;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], z0 = pts[i + 1], x1 = pts[i + 2], z1 = pts[i + 3];
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if (mx < ox || mx >= ox + CHUNK || mz < oy || mz >= oy + CHUNK) continue;
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const nx = -dz / len, nz = dx / len;
    // deck follows the ground like the real thing — keep in sync with deckHeightAt
    const t0 = index.heightAtPx(x0, z0), t1 = index.heightAtPx(x1, z1);
    const y0d = Math.max(baseY, t0 + 1.2), y1d = Math.max(baseY, t1 + 1.2);
    const bot = Math.min(t0, t1) - 6;
    const u = len / TEX_SCALE, vv = w / TEX_SCALE;
    plank.quadUV(
      x0 + nx * hw, y0d, z0 + nz * hw, x1 + nx * hw, y1d, z1 + nz * hw,
      x1 - nx * hw, y1d, z1 - nz * hw, x0 - nx * hw, y0d, z0 - nz * hw,
      0, 1, 0, deck.r, deck.g, deck.b, 0, 0, u, 0, u, vv, 0, vv
    );
    for (const s of [1, -1]) {
      plank.quad(
        x0 + nx * hw * s, bot, z0 + nz * hw * s, x1 + nx * hw * s, bot, z1 + nz * hw * s,
        x1 + nx * hw * s, y1d, z1 + nz * hw * s, x0 + nx * hw * s, y0d, z0 + nz * hw * s,
        nx * s, 0, nz * s, skirtC.r, skirtC.g, skirtC.b
      );
      const exm = mx + nx * s * (hw + 9), ezm = mz + nz * s * (hw + 9);
      const waterSide = index.isWaterAt(exm, ezm);
      const dropSide = (y0d + y1d) / 2 - index.heightAtPx(exm, ezm) > 4;
      if (!waterSide && !dropSide) continue;
      // pilings carry the deck over the water / down the dune face
      const piles = Math.max(1, Math.round(len / 38));
      for (let k = 0; k <= piles; k++) {
        const t = k / piles;
        plain.box(x0 + dx * t + nx * (hw - 1.2) * s, z0 + dz * t + nz * (hw - 1.2) * s,
          1.5, 1.5, bot, y0d + (y1d - y0d) * t + 0.4, '#5c4730');
      }
      // stained guard rail so nobody walks off into the Merrimack
      const ex = nx * (hw - 0.8) * s, ez = nz * (hw - 0.8) * s;
      for (const [r0, r1] of [[6.2, 7.4], [3, 3.8]] as const) {
        plain.quad(
          x0 + ex, y0d + r0, z0 + ez, x1 + ex, y1d + r0, z1 + ez,
          x1 + ex, y1d + r1, z1 + ez, x0 + ex, y0d + r1, z0 + ez,
          nx * s, 0, nz * s, railC.r, railC.g, railC.b
        );
      }
      const posts = Math.max(1, Math.round(len / 22));
      for (let k = 0; k <= posts; k++) {
        const t = k / posts;
        const yd = y0d + (y1d - y0d) * t;
        plain.box(x0 + dx * t + ex, z0 + dz * t + ez, 0.8, 0.8, yd, yd + 6.6, '#4a3a26');
      }
    }
  }
}

function pointInRingD(x: number, y: number, pts: number[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Rooftop mechanicals — at the game's high chase-cam the roof IS the facade, so flat
// roofs get what real ones have: HVAC units, vents, a stair bulkhead on the big blocks,
// and brick chimney stacks on the old brick buildings. All seeded; every box's footprint
// is tested against the ring (candidates that would hang off the roof are skipped).
// Ring coords: render x = ring x, render z = ring y (the loop's convention throughout).
function roofClutter(buckets: Bucket[], ring: number[], topY: number, seed: number, areaM2: number, brick: boolean) {
  if (areaM2 < 70) return;
  const rng = mulberry32(hash32(seed, 23, 13));
  const obb = obbOf(ring);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  // a candidate spot in OBB space, kept only if a `margin` square around it fits the footprint
  const spot = (margin: number): [number, number] | null => {
    for (let t = 0; t < 6; t++) {
      const l = (rng() * 2 - 1) * Math.max(1, obb.hl - margin);
      const w = (rng() * 2 - 1) * Math.max(1, obb.hw - margin);
      const x = obb.cx + l * ca - w * sa, z = obb.cz + l * sa + w * ca;
      if (pointInRingD(x - margin, z - margin, ring) && pointInRingD(x + margin, z - margin, ring) &&
          pointInRingD(x - margin, z + margin, ring) && pointInRingD(x + margin, z + margin, ring)) return [x, z];
    }
    return null;
  };
  // stair bulkhead on the big blocks
  if (areaM2 > 450) {
    const s = spot(11);
    if (s) buckets[PLAIN].box(s[0], s[1], 9, 6.5, topY, topY + 12, '#9d998f');
  }
  // rooftop HVAC units — more on bigger roofs
  const nH = Math.min(4, 1 + Math.floor(areaM2 / 320));
  for (let i = 0; i < nH; i++) {
    const s = spot(8);
    if (!s) continue;
    const hw2 = 2.6 + rng() * 2.2;
    buckets[PLAIN].box(s[0], s[1], hw2, hw2 * (0.75 + rng() * 0.5), topY, topY + 6 + rng() * 3, rng() < 0.5 ? '#a7abae' : '#8e9296');
  }
  // little vent stacks
  const nV = Math.min(5, Math.floor(areaM2 / 220));
  for (let i = 0; i < nV; i++) {
    const s = spot(4);
    if (s) buckets[PLAIN].box(s[0], s[1], 1.2, 1.2, topY, topY + 4 + rng() * 2, '#6f7275');
  }
  // brick chimney stacks near the party-wall ends of the old brick blocks
  if (brick) {
    const nC = obb.hl > 40 ? 2 : 1;
    for (let i = 0; i < nC; i++) {
      const l = (nC === 1 ? 0 : (i === 0 ? -1 : 1)) * obb.hl * 0.62;
      const w = (rng() * 2 - 1) * obb.hw * 0.4;
      const x = obb.cx + l * ca - w * sa, z = obb.cz + l * sa + w * ca;
      if (pointInRingD(x - 3, z - 3, ring) && pointInRingD(x + 3, z + 3, ring) &&
          pointInRingD(x - 3, z + 3, ring) && pointInRingD(x + 3, z - 3, ring))
        buckets[BRICK].box(x, z, 2.6, 2.6, topY, topY + 8 + rng() * 3, '#7a4b3a', 1);
    }
  }
}

function pointInPolyD(x: number, y: number, poly: Poly): boolean {
  if (!pointInRingD(x, y, poly.p)) return false;
  if (poly.h) for (const h of poly.h) if (pointInRingD(x, y, h)) return false;
  return true;
}

// deterministic cell scatter inside a polygon, owned by this chunk
function scatterInPoly(poly: Poly, seedBase: number, cell: number, p: number,
                       ox: number, oy: number,
                       emit: (x: number, z: number, rng: () => number) => void, cap: number) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < poly.p.length; i += 2) {
    if (poly.p[i] < minX) minX = poly.p[i];
    if (poly.p[i] > maxX) maxX = poly.p[i];
    if (poly.p[i + 1] < minY) minY = poly.p[i + 1];
    if (poly.p[i + 1] > maxY) maxY = poly.p[i + 1];
  }
  const x0 = Math.max(ox, minX), x1 = Math.min(ox + CHUNK, maxX);
  const y0 = Math.max(oy, minY), y1 = Math.min(oy + CHUNK, maxY);
  if (x1 <= x0 || y1 <= y0) return;
  let count = 0;
  for (let gy = Math.floor(y0 / cell); gy * cell < y1; gy++) {
    for (let gx = Math.floor(x0 / cell); gx * cell < x1; gx++) {
      const rng = mulberry32(hash32(seedBase, gx, gy));
      if (rng() >= p) continue;
      const x = gx * cell + rng() * cell;
      const z = gy * cell + rng() * cell;
      if (x < ox || x >= ox + CHUNK || z < oy || z >= oy + CHUNK) continue;
      if (!pointInPolyD(x, z, poly)) continue;
      emit(x, z, rng);
      if (++count >= cap) return;
    }
  }
}

// every mapped cemetery fills with stones: colonial slate tablets in loose
// not-quite-rows facing the grounds' own grain, the odd table tomb, and an
// obelisk for the family that did well. Deterministic per cell, internal
// walks kept clear — works for any cemetery polygon in any town we load.
function gravestones(buckets: Bucket[], poly: Poly, pi: number, world: WorldData, index: WorldIndex,
                     feats: { roads: number[]; paths: number[] }, ox: number, oy: number) {
  const plain = buckets[PLAIN];
  const obb = obbOf(poly.p);
  // internal walks and road shoulders stay stone-free
  const lanes: { p: number[]; r2: number }[] = [];
  for (const ri of feats.roads) {
    const r = world.roads[ri];
    lanes.push({ p: r.p, r2: (r.w / 2 + 6) ** 2 });
  }
  for (const qi of feats.paths) {
    const q = world.paths[qi];
    lanes.push({ p: q.p, r2: (Math.max(q.w, 10) / 2 + 4) ** 2 });
  }
  const clear = (x: number, z: number): boolean => {
    for (const l of lanes) {
      for (let i = 0; i + 3 < l.p.length; i += 2) {
        const ax = l.p[i], az = l.p[i + 1];
        const ex = l.p[i + 2] - ax, ez = l.p[i + 3] - az;
        const len2 = ex * ex + ez * ez;
        let s = len2 > 0 ? ((x - ax) * ex + (z - az) * ez) / len2 : 0;
        s = s < 0 ? 0 : s > 1 ? 1 : s;
        const dx = x - (ax + ex * s), dz = z - (az + ez * s);
        if (dx * dx + dz * dz < l.r2) return false;
      }
    }
    return true;
  };
  const slates = ['#5c626c', '#666c76', '#737880', '#9a9da0', '#8b8f96', '#c6c2b8'];
  scatterInPoly(poly, hash32(pi, 77, 19), 22, 0.74, ox, oy, (x, z, rng) => {
    if (!clear(x, z)) return;
    const g = index.heightAtPx(x, z);
    const ang = obb.ang + (rng() - 0.5) * 0.26 + (rng() < 0.06 ? Math.PI / 2 : 0);
    const hex = slates[Math.floor(rng() * slates.length)];
    const kind = rng();
    if (kind < 0.07) {
      // obelisk on a plinth
      const top = g + 13 + rng() * 7;
      rotBox(plain, x, z, 2.4, 2.4, g - 0.6, g + 2, ang, '#9a9da0');
      rotBox(plain, x, z, 1.3, 1.3, g + 2, top, ang, hex);
      tmp.set(hex);
      cone(plain, x, top, z, 1.7, 2.4, tmp.clone());
    } else if (kind < 0.14) {
      // table tomb: a low slab over a plinth
      rotBox(plain, x, z, 4.2, 2.5, g - 0.4, g + 1.6, ang, hex);
      rotBox(plain, x, z, 3.6, 2.1, g + 1.6, g + 3, ang, '#b3b0a6');
    } else {
      // the workhorse tablet; a narrower cap hints the rounded shoulder
      const hw = 2.1 + rng() * 1.1;
      const h = 5.5 + rng() * 4.5;
      rotBox(plain, x, z, hw, 0.55, g - 0.8, g + h, ang, hex);
      if (rng() < 0.55) rotBox(plain, x, z, hw * 0.66, 0.5, g + h, g + h + 1.2, ang, hex);
    }
  }, 520);
}

// six-sided cone (pines, beach umbrellas)
function cone(bk: Bucket, x: number, yBase: number, z: number, r: number, h: number, color: THREE.Color) {
  const n = 6;
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
    const p0: [number, number] = [x + Math.cos(a0) * r, z + Math.sin(a0) * r];
    const p1: [number, number] = [x + Math.cos(a1) * r, z + Math.sin(a1) * r];
    const mx = (Math.cos(a0) + Math.cos(a1)) / 2, mz = (Math.sin(a0) + Math.sin(a1)) / 2;
    const shade = 0.78 + 0.22 * Math.max(0, mx * 0.35 + mz * 0.85);
    const nl = Math.hypot(mx, 0.6, mz) || 1;
    bk.triUV(p0[0], yBase, p0[1], p1[0], yBase, p1[1], x, yBase + h, z,
      mx / nl, 0.6 / nl, mz / nl, color.r * shade, color.g * shade, color.b * shade, 0, 0, 0, 0, 0, 0);
  }
}

// War Memorial Stadium: the real NHS football field (the mapped american_football
// pitch) gets a reddish track ring, raked home + visitor grandstands with a press
// box, and four light towers — all fitted to the field's own OBB, so it lands
// exactly on the mapped field in any town we load.
function buildStadium(buckets: Bucket[], L: { cx: number; cz: number; ang: number; hl: number; hw: number }, index: WorldIndex) {
  const plain = buckets[PLAIN];
  const ca = Math.cos(L.ang), sa = Math.sin(L.ang);
  const at = (lx: number, lz: number): [number, number] => [L.cx + lx * ca - lz * sa, L.cz + lx * sa + lz * ca];

  // reddish all-weather track just outside the field lines
  const track = '#a24f3c';
  for (const sz of [-1, 1]) {
    const [cx, cz] = at(0, sz * (L.hw + 6));
    const gy = index.heightAtPx(cx, cz);
    rotBox(plain, cx, cz, L.hl, 7, gy + 0.2, gy + 0.7, L.ang, track);
  }
  for (const sx of [-1, 1]) {
    const [cx, cz] = at(sx * (L.hl + 6), 0);
    const gy = index.heightAtPx(cx, cz);
    rotBox(plain, cx, cz, 7, L.hw + 13, gy + 0.2, gy + 0.7, L.ang, track);
  }

  // raked grandstands: a tall home side and a shorter visitor side
  const stand = (side: number, rows: number, halfLen: number) => {
    for (let i = 0; i < rows; i++) {
      const lz = side * (L.hw + 16 + i * 6);
      const [cx, cz] = at(0, lz);
      const gy = index.heightAtPx(cx, cz);
      rotBox(plain, cx, cz, halfLen, 3.5, gy + i * 5, gy + i * 5 + 5, L.ang, i % 2 ? '#c4c7cb' : '#b4b7bb');
    }
    const [bx, bz] = at(0, side * (L.hw + 16 + rows * 6));
    const gyb = index.heightAtPx(bx, bz);
    rotBox(plain, bx, bz, halfLen + 8, 3, gyb, gyb + rows * 5 + 5, L.ang, '#8d9094'); // back wall
  };
  stand(1, 8, L.hl * 0.9);
  stand(-1, 5, L.hl * 0.72);

  // press box on the home stand's roofline
  const [px, pz] = at(0, L.hw + 16 + 8 * 6);
  const gyp = index.heightAtPx(px, pz);
  rotBox(plain, px, pz, L.hl * 0.26, 4.5, gyp + 45, gyp + 58, L.ang, '#5f6367');
  rotBox(plain, px, pz, L.hl * 0.26 - 1, 4.8, gyp + 49, gyp + 55, L.ang, '#2b2f34'); // glass band

  // four light towers, banks of lamps angled over the field
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [tx, tz] = at(sx * (L.hl + 20), sz * (L.hw + 24));
    const gyt = index.heightAtPx(tx, tz);
    plain.box(tx, tz, 1.6, 1.6, gyt, gyt + 60, '#3a3d42');
    rotBox(plain, tx, tz, 11, 3, gyt + 58, gyt + 66, L.ang, '#2e3236');
    for (const o of [-7, -2.5, 2.5, 7]) {
      plain.box(tx + ca * o, tz + sa * o, 1.4, 1.4, gyt + 59, gyt + 64, '#fff4cf');
    }
  }
}

// white corner boards + fascia band — the colonial trim that sells "Newburyport"
function houseTrim(plain: Bucket, ring: number[], eaveH: number, baseY: number) {
  const v = ringToVec2(ring);
  if (v.length > 8) return;
  tmp.set(STYLE.building.trim);
  const r = tmp.r, g = tmp.g, b = tmp.b;
  for (const p of v) {
    plain.box(p.x, -p.y, 1.1, 1.1, baseY, eaveH - 0.5, STYLE.building.trim);
  }
  // fascia: thin white band at the eave, slightly proud of the wall
  for (let i = 0; i < v.length; i++) {
    const a = v[i], bb = v[(i + 1) % v.length];
    const ex = bb.x - a.x, ey = bb.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 0.01) continue;
    const nx = ey / len, nz = ex / len;
    plain.quad(
      a.x + nx * 0.4, eaveH - 2.4, -(a.y - nz * 0.4 * 0), bb.x + nx * 0.4, eaveH - 2.4, -bb.y, bb.x + nx * 0.4, eaveH, -bb.y, a.x + nx * 0.4, eaveH, -a.y,
      nx, 0, nz, r, g, b
    );
  }
}

// an oriented rectangular post (bridge pier / abutment): a box turned to the span
// heading so it doesn't read as an axis-aligned block on diagonal bridges. Builds 4
// walls + a top face (the foot is under ground/water, so no bottom is needed).
// ha = half-depth along the span, hc = half-width across it.
function orientedPost(bk: Bucket, cx: number, cz: number, ux: number, uz: number,
                      ha: number, hc: number, y0: number, y1: number, hex: string) {
  const px = -uz, pz = ux; // across-the-span axis
  const P: [number, number][] = [
    [cx - ux * ha - px * hc, cz - uz * ha - pz * hc],
    [cx + ux * ha - px * hc, cz + uz * ha - pz * hc],
    [cx + ux * ha + px * hc, cz + uz * ha + pz * hc],
    [cx - ux * ha + px * hc, cz - uz * ha + pz * hc],
  ];
  tmp.set(hex); const r = tmp.r, g = tmp.g, b = tmp.b;
  for (let i = 0; i < 4; i++) {
    let [x0, z0] = P[i]; let [x1, z1] = P[(i + 1) % 4];
    const ex = x1 - x0, ez = z1 - z0, el = Math.hypot(ex, ez) || 1;
    let nx = -ez / el, nz = ex / el;                 // wall normal (left of the edge)
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;    // ...flip to face OUTWARD from the centre
    if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; const tX = x0, tZ = z0; x0 = x1; z0 = z1; x1 = tX; z1 = tZ; }
    bk.quad(x0, y0, z0, x1, y0, z1, x1, y1, z1, x0, y1, z0, nx, 0, nz, r * 0.9, g * 0.9, b * 0.9);
  }
  bk.quad(P[0][0], y1, P[0][1], P[1][0], y1, P[1][1], P[2][0], y1, P[2][1], P[3][0], y1, P[3][1], 0, 1, 0, r, g, b);
}

// the oriented rectangle the Gillis bascule occupies — the generic deck and its
// piers both leave this clear so the custom drawbridge fills it
function inGillisRect(x: number, z: number): boolean {
  const dxg = x - gillisCenter.x, dzg = z - gillisCenter.z;
  const along = dxg * gillisCenter.ux + dzg * gillisCenter.uz;
  const across = -dxg * gillisCenter.uz + dzg * gillisCenter.ux;
  return Math.abs(along) < gillisCenter.halfLen && Math.abs(across) < gillisCenter.halfW;
}

// deck height may vary along the span (overpass clearance humps), so the
// ribbon takes a height function and subdivides segments to follow it.
// Road bridges (rails=true) build a CLOSED constant-thickness asphalt slab (top +
// bottom + thin fascia + end caps) held up by discrete piers/abutments emitted by
// the caller — the underside is open between supports so roads & boats pass beneath.
// Bare docks / foot-bridges (rails=false) stay wooden planks on a full side skirt.
function ribbonDeck(buckets: Bucket[], pts0: number[], w: number, topYAt: number | ((x: number, z: number) => number),
                    rails: boolean, ox: number, oy: number, skipGillis = false, trim0 = 0, trim1 = 0, lanes: 'yellow' | 'white' = 'yellow',
                    w0 = w, w1 = w) {   // end widths — a fused deck TAPERS to the real road width where it dies into dry pavement
  const isRoad = rails;
  const surf = isRoad ? buckets[PLAIN] : buckets[PLANK];
  const asphalt = new THREE.Color('#3a3d42');
  const wood = new THREE.Color('#ffffff');
  const line = new THREE.Color('#c9a23e');                       // road center line
  const white = new THREE.Color('#e8e8e2');                      // lane / edge paint
  const skirt = new THREE.Color(isRoad ? '#62656b' : '#8a8d92'); // bridge structure side
  const rail = new THREE.Color(isRoad ? '#b8b3a6' : '#e3e0d6');  // guardrail
  const topC = isRoad ? asphalt : wood;

  // ---- defenses first: dedupe (<1px repeats poison direction math), then trim ----
  const pts: number[] = [pts0[0], pts0[1]];
  for (let i = 2; i + 1 < pts0.length; i += 2) {
    const lx = pts[pts.length - 2], lz = pts[pts.length - 1];
    if (Math.hypot(pts0[i] - lx, pts0[i + 1] - lz) >= 1) pts.push(pts0[i], pts0[i + 1]);
  }
  if (pts.length < 4) return;
  // trim arc-length off an end (a ramp deck pulls back to the edge of the span
  // it merges into, so its cap/rails never slice across the other deck's top)
  const trimEnd = (arr: number[], t: number): number[] => {
    if (t <= 0) return arr;
    let left = t;
    while (arr.length >= 4) {
      const n = arr.length;
      const dx = arr[n - 2] - arr[n - 4], dz = arr[n - 1] - arr[n - 3];
      const seg = Math.hypot(dx, dz);
      if (seg > left) {
        const f = (seg - left) / seg;
        return [...arr.slice(0, n - 2), arr[n - 4] + dx * f, arr[n - 3] + dz * f];
      }
      left -= seg;
      arr = arr.slice(0, n - 2);
    }
    return arr;
  };
  const rev = (arr: number[]): number[] => { const o: number[] = []; for (let i = arr.length - 2; i >= 0; i -= 2) o.push(arr[i], arr[i + 1]); return o; };
  let poly = trimEnd(pts, trim1);
  poly = rev(trimEnd(rev(poly), trim0));
  if (poly.length < 4) return;

  // deterministic per-chain lift (0–0.45px): overlapping decks (dual
  // carriageways, ramp merges) land on different planes instead of z-fighting
  const eps = isRoad ? (Math.abs(Math.round(poly[0] * 7 + poly[1] * 13 + poly.length * 31)) % 10) * 0.05 : 0;
  const yAtF = typeof topYAt === 'number' ? () => topYAt as number : topYAt;
  const yAt = (x: number, z: number) => yAtF(x, z) + eps;
  const hw = w / 2;

  // ---- subdivide the whole polyline into nodes (<=48px), then mitre ----
  const nxA: number[] = [], nzA: number[] = [];
  for (let i = 0; i + 3 < poly.length; i += 2) {
    const sx0 = poly[i], sz0 = poly[i + 1], sx1 = poly[i + 2], sz1 = poly[i + 3];
    const segLen = Math.hypot(sx1 - sx0, sz1 - sz0);
    if (segLen < 0.01) continue;
    if (nxA.length === 0) { nxA.push(sx0); nzA.push(sz0); }
    const pieces = Math.max(1, Math.ceil(segLen / 48));
    for (let pc = 1; pc <= pieces; pc++) {
      nxA.push(sx0 + (sx1 - sx0) * (pc / pieces));
      nzA.push(sz0 + (sz1 - sz0) * (pc / pieces));
    }
  }
  const N = nxA.length;
  if (N < 2) return;
  const Lx = new Float64Array(N), Lz = new Float64Array(N), Rx = new Float64Array(N), Rz = new Float64Array(N);
  const Yn = new Float64Array(N), cum = new Float64Array(N);
  for (let i = 1; i < N; i++) cum[i] = cum[i - 1] + Math.hypot(nxA[i] - nxA[i - 1], nzA[i] - nzA[i - 1]);
  const totalLen = cum[N - 1];
  // per-node halfwidth: full mid-span, easing to the end widths over the last TAPER px
  // (a fused dual-carriageway deck funnels into the painted road instead of squaring
  // off as a wide "wing" over the approach)
  const TAPER = 140;
  const hw0 = Math.min(w0, w) / 2, hw1 = Math.min(w1, w) / 2;
  const hwAt = (d: number) => {
    let h = hw;
    if (hw0 < hw && d < TAPER) h = Math.min(h, hw0 + (hw - hw0) * (d / TAPER));
    if (hw1 < hw && totalLen - d < TAPER) h = Math.min(h, hw1 + (hw - hw1) * ((totalLen - d) / TAPER));
    return h;
  };
  const hwN = new Float64Array(N);
  let plX = 0, plZ = 0;   // previous lateral — the twist guard
  for (let i = 0; i < N; i++) {
    const ip = Math.max(0, i - 1), iq = Math.min(N - 1, i + 1);
    let aX = nxA[i] - nxA[ip], aZ = nzA[i] - nzA[ip];
    let bX = nxA[iq] - nxA[i], bZ = nzA[iq] - nzA[i];
    const al = Math.hypot(aX, aZ) || 1, bl = Math.hypot(bX, bZ) || 1;
    aX /= al; aZ /= al; bX /= bl; bZ /= bl;
    let mX = aX + bX, mZ = aZ + bZ;
    const ml = Math.hypot(mX, mZ);
    if (ml < 1e-6) { mX = aX; mZ = aZ; } else { mX /= ml; mZ /= ml; }
    let lX = -mZ, lZ = mX;                                          // mitre lateral
    if (i > 0 && lX * plX + lZ * plZ < 0) { lX = -lX; lZ = -lZ; }   // never twist (bowtie guard)
    plX = lX; plZ = lZ;
    hwN[i] = hwAt(cum[i]);
    // stay hw off both segments, but 1.4x max — sharper corners pinch instead of spiking
    const scale = hwN[i] / Math.min(1.4, Math.max(0.72, Math.abs(lX * -aZ + lZ * aX)));
    Lx[i] = nxA[i] + lX * scale; Lz[i] = nzA[i] + lZ * scale;
    Rx[i] = nxA[i] - lX * scale; Rz[i] = nzA[i] - lZ * scale;
    Yn[i] = yAt(nxA[i], nzA[i]);
  }

  // a paint stripe across the strip at across-offset o (0=centerline, +->R side)
  const stripe = (i: number, j: number, o: number, lw: number, c: THREE.Color) => {
    const lat = (k: number): [number, number] => {
      const dX = Rx[k] - Lx[k], dZ = Rz[k] - Lz[k], dl = Math.hypot(dX, dZ) || 1;
      return [dX / dl, dZ / dl];
    };
    const [liX, liZ] = lat(i), [ljX, ljZ] = lat(j);
    const ciX = (Lx[i] + Rx[i]) / 2, ciZ = (Lz[i] + Rz[i]) / 2;
    const cjX = (Lx[j] + Rx[j]) / 2, cjZ = (Lz[j] + Rz[j]) / 2;
    surf.quad(
      ciX + liX * (o + lw), Yn[i] + 0.3, ciZ + liZ * (o + lw), cjX + ljX * (o + lw), Yn[j] + 0.3, cjZ + ljZ * (o + lw),
      cjX + ljX * (o - lw), Yn[j] + 0.3, cjZ + ljZ * (o - lw), ciX + liX * (o - lw), Yn[i] + 0.3, ciZ + liZ * (o - lw),
      0, 1, 0, c.r, c.g, c.b
    );
  };

  const T = WorldIndex.DECK_T;
  for (let i = 0; i + 1 < N; i++) {
    const j = i + 1;
    const mx = (nxA[i] + nxA[j]) / 2, mz = (nzA[i] + nzA[j]) / 2;
    if (mx < ox || mx >= ox + CHUNK || mz < oy || mz >= oy + CHUNK) continue;
    // leave a clean rectangular gap at the Gillis channel — the custom drawbridge fills it
    if (skipGillis && inGillisRect(mx, mz)) continue;
    const dx = nxA[j] - nxA[i], dz = nzA[j] - nzA[i];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const ux = dx / len, uz = dz / len;
    const y0 = Yn[i], y1 = Yn[j];
    const u = len / TEX_SCALE, vv = w / TEX_SCALE;
    // deck TOP — one strip quad between the SHARED mitred edges (no overlaps)
    surf.quadUV(
      Lx[i], y0, Lz[i], Lx[j], y1, Lz[j],
      Rx[j], y1, Rz[j], Rx[i], y0, Rz[i],
      0, 1, 0, topC.r, topC.g, topC.b,
      0, 0, u, 0, u, vv, 0, vv
    );
    if (isRoad && w > 12 && hwN[i] >= hw - 0.5 && hwN[j] >= hw - 0.5) {   // no paint on tapered ends
      const dashOn = Math.floor(((cum[i] + cum[j]) / 2) / 26) % 2 === 0;
      if (lanes === 'white') {
        // one-way carriageway (motorway): solid edges + dashed white lane line
        stripe(i, j, hw - 2.4, 0.9, white);
        stripe(i, j, -(hw - 2.4), 0.9, white);
        if (dashOn) stripe(i, j, 0, 0.9, white);
      } else {
        if (dashOn) stripe(i, j, 0, 1.4, line);   // two-way dashed yellow center
        if (w >= 90) {
          // a 4-lane deck (the Essex Bridge): edges + a white lane dash per side
          stripe(i, j, hw - 2.4, 0.9, white);
          stripe(i, j, -(hw - 2.4), 0.9, white);
          if (dashOn) { stripe(i, j, hw / 2, 0.9, white); stripe(i, j, -hw / 2, 0.9, white); }
        }
      }
    }
    // rails/caps stand down near a merge end — the deck tees into another span there
    const nearMerge0 = trim0 > 0 && cum[i] < 30;
    const nearMerge1 = trim1 > 0 && totalLen - cum[j] < 30;
    if (isRoad) {
      const b0 = y0 - T, b1 = y1 - T;
      // bottom face — normal down, wound opposite the top so it shows from below
      surf.quad(
        Rx[i], b0, Rz[i], Rx[j], b1, Rz[j],
        Lx[j], b1, Lz[j], Lx[i], b0, Lz[i],
        0, -1, 0, skirt.r * 0.9, skirt.g * 0.9, skirt.b * 0.9
      );
      for (const sSide of [1, -1] as const) {
        const eX = sSide > 0 ? Lx : Rx, eZ = sSide > 0 ? Lz : Rz;
        const nsx = -uz * sSide, nsz = ux * sSide;
        // fascia — the deck edge (only T tall), not a wall to the ground
        surf.quad(
          eX[i], b0, eZ[i], eX[j], b1, eZ[j],
          eX[j], y1, eZ[j], eX[i], y0, eZ[i],
          nsx, 0, nsz, skirt.r, skirt.g, skirt.b
        );
        if (nearMerge0 || nearMerge1) continue;
        // top rail band + posts — reads as a real guardrail
        surf.quad(
          eX[i], y0 + 3.4, eZ[i], eX[j], y1 + 3.4, eZ[j],
          eX[j], y1 + 4.8, eZ[j], eX[i], y0 + 4.8, eZ[i],
          nsx, 0, nsz, rail.r, rail.g, rail.b
        );
        const posts = Math.max(1, Math.floor(len / 26));
        for (let pi2 = 0; pi2 <= posts; pi2++) {
          const t = pi2 / posts;
          const py = y0 + (y1 - y0) * t;
          const px2 = eX[i] + (eX[j] - eX[i]) * t, pz2 = eZ[i] + (eZ[j] - eZ[i]) * t;
          surf.quad(
            px2 - ux * 0.6, py, pz2 - uz * 0.6, px2 + ux * 0.6, py, pz2 + uz * 0.6,
            px2 + ux * 0.6, py + 3.4, pz2 + uz * 0.6, px2 - ux * 0.6, py + 3.4, pz2 - uz * 0.6,
            nsx, 0, nsz, rail.r * 0.88, rail.g * 0.88, rail.b * 0.88
          );
        }
      }
      // END CAPS close the slab at true ends (merge ends stay open under the
      // other deck). Per-pair chunk cull => each end is reached in ONE chunk.
      if (i === 0 && trim0 <= 0) {
        surf.quad(
          Rx[0], b0, Rz[0], Lx[0], b0, Lz[0],
          Lx[0], y0, Lz[0], Rx[0], y0, Rz[0],
          -ux, 0, -uz, skirt.r, skirt.g, skirt.b
        );
      }
      if (j === N - 1 && trim1 <= 0) {
        surf.quad(
          Lx[j], b1, Lz[j], Rx[j], b1, Rz[j],
          Rx[j], y1, Rz[j], Lx[j], y1, Lz[j],
          ux, 0, uz, skirt.r, skirt.g, skirt.b
        );
      }
    } else {
      // wooden docks / foot-bridges: original full side skirt down to ground/water
      const bottomY = Math.min(y0, y1) > 22 ? 0 : Math.max(0, Math.min(y0, y1) - 14);
      for (const sSide of [1, -1] as const) {
        const eX = sSide > 0 ? Lx : Rx, eZ = sSide > 0 ? Lz : Rz;
        surf.quad(
          eX[i], bottomY, eZ[i], eX[j], bottomY, eZ[j],
          eX[j], y1, eZ[j], eX[i], y0, eZ[i],
          -uz * sSide, 0, ux * sSide, skirt.r, skirt.g, skirt.b
        );
      }
    }
  }
}

function octoCanopy(bk: Bucket, x: number, y: number, z: number, r: number, color: THREE.Color) {
  const top: [number, number, number] = [x, y + r * 1.2, z];
  const bot: [number, number, number] = [x, y - r * 0.85, z];
  const mid: [number, number, number][] = [
    [x + r, y, z], [x, y, z + r], [x - r, y, z], [x, y, z - r]
  ];
  for (let i = 0; i < 4; i++) {
    const a = mid[i], b = mid[(i + 1) % 4];
    const shade = 0.8 + 0.2 * ((i + 1) % 4 < 2 ? 1 : 0.45);
    const n = [(a[0] - x + b[0] - x) / 2, r * 0.5, (a[2] - z + b[2] - z) / 2];
    const nl = Math.hypot(n[0], n[1], n[2]) || 1;
    bk.triUV(top[0], top[1], top[2], a[0], a[1], a[2], b[0], b[1], b[2],
      n[0] / nl, n[1] / nl, n[2] / nl, color.r * shade, color.g * shade, color.b * shade, 0, 0, 0, 0, 0, 0);
    bk.triUV(bot[0], bot[1], bot[2], b[0], b[1], b[2], a[0], a[1], a[2],
      n[0] / nl, -n[1] / nl, n[2] / nl, color.r * shade * 0.78, color.g * shade * 0.78, color.b * shade * 0.78, 0, 0, 0, 0, 0, 0);
  }
}

function lighthouse(plain: Bucket, cx: number, cz: number, g: number) {
  const oct = (r: number) => {
    const ring: number[] = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ring.push(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
    }
    return ring;
  };
  walls(plain, oct(11), g - 4, g + 86, '#f8f5ec', 0);
  walls(plain, oct(8.5), g + 86, g + 100, '#c0392b', 0);
  flatRoof(plain, oct(9.5), g + 100, '#f0ede2');
  flatRoof(plain, oct(5), g + 104, '#c0392b');
}

// ⛽ a gas station forecourt — the data-driven set piece for amenity=fuel POIs:
// white canopy on posts with a red fascia band, pump islands underneath. The
// brand name already rides the shop building as a sign; this makes the lot
// itself READ as a gas station from the air. Long axis squares to the road.
function gasStation(plain: Bucket, cx: number, cz: number, ang: number, g: number) {
  const CANOPY = '#eae8df', FASCIA = '#bf4030', POST = '#c2beb2', CURB = '#b4b0a4', PUMP = '#c8442f', SCREEN = '#2e3136';
  const hl = 48, hw = 30;                        // 12m × 7.5m canopy
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const pt = (lx: number, lz: number): [number, number] => [cx + lx * ca - lz * sa, cz + lx * sa + lz * ca];
  for (const [px, pz] of [pt(-hl + 12, -hw + 9), pt(hl - 12, -hw + 9), pt(-hl + 12, hw - 9), pt(hl - 12, hw - 9)]) {
    plain.box(px, pz, 1.6, 1.6, g, g + 35, POST);
  }
  rotBox(plain, cx, cz, hl, hw, g + 35, g + 40, ang, CANOPY);
  rotBox(plain, cx, cz, hl + 1, hw + 1, g + 31.5, g + 35, ang, FASCIA);
  // soffit — rotBox has no bottom face, and you can see up under a canopy
  const c0 = pt(-hl, -hw), c1 = pt(hl, -hw), c2 = pt(hl, hw), c3 = pt(-hl, hw);
  tmp.set(CANOPY);
  plain.quad(c3[0], g + 35, c3[1], c2[0], g + 35, c2[1], c1[0], g + 35, c1[1], c0[0], g + 35, c0[1], 0, -1, 0, tmp.r * 0.72, tmp.g * 0.72, tmp.b * 0.72);
  // two pump islands along the drive-through axis, one pump each
  for (const s of [-1, 1] as const) {
    const [ix, iz] = pt(s * hl * 0.42, 0);
    rotBox(plain, ix, iz, 11, 4, g, g + 1.8, ang, CURB);
    rotBox(plain, ix, iz, 3.4, 2.2, g + 1.8, g + 13, ang, PUMP);
    rotBox(plain, ix, iz, 3.6, 2.4, g + 9.6, g + 11, ang, SCREEN);
  }
}

// find a clear spot for a road-facing set piece near a business POI. The POI is
// often the shop building's own centroid, so a 2-D probe walks roadside-first
// from the point toward the street AND sideways along the road axis, returning
// the first spot whose hl×hw footprint is clear of buildings and water — or
// null, so callers place NOTHING rather than clip. Long axis squares to the road.
function forecourtSpot(world: WorldData, index: WorldIndex, bucket: ReturnType<WorldIndex['bucket']>,
                       poi: { x: number; y: number }, hl: number, hw: number): { x: number; z: number; ang: number } | null {
  let rx = poi.x, rz = poi.y, ang = 0, bd = Infinity, rw = 0;
  for (const pass of [0, 1]) {   // pass 0: real streets; pass 1: service aisles (fallback)
    for (const ri of bucket.roads) {
      const r = world.roads[ri];
      if ((r.c === 'service') !== (pass === 1)) continue;
      for (let i = 0; i + 3 < r.p.length; i += 2) {
        const ax = r.p[i], az = r.p[i + 1], ex = r.p[i + 2] - ax, ez = r.p[i + 3] - az;
        const l2 = ex * ex + ez * ez || 1;
        let t = ((poi.x - ax) * ex + (poi.y - az) * ez) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = ax + ex * t, pz = az + ez * t, d = (px - poi.x) ** 2 + (pz - poi.y) ** 2;
        if (d < bd) { bd = d; rx = px; rz = pz; ang = Math.atan2(ez, ex); rw = r.w; }
      }
    }
    if (bd < 400 * 400) break;
  }
  const dl = Math.sqrt(bd) || 1, ux = (rx - poi.x) / dl, uz = (rz - poi.y) / dl;
  const stop = Math.max(0, dl - (rw / 2 + hw + 12));   // slide limit: footprint off the roadside
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (let k = 8; k >= 0; k--) {
    const t = stop * (k / 8);
    for (const lat of [0, 60, -60, 116, -116]) {
      const cx = poi.x + ux * t + ca * lat, cz = poi.y + uz * t + sa * lat;
      const clear = [[0, 0], [-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].every(([lx, lz]) => {
        const wx = cx + lx * ca - lz * sa, wz = cz + lx * sa + lz * ca;
        return !index.isBlocked(wx, wz) && !index.isWaterAt(wx, wz);
      });
      if (clear) return { x: cx, z: cz, ang };
    }
  }
  return null;
}

// 🍦 a roadside ice-cream stand: giant soft-serve cone + picnic tables — the
// classic New England summer stop (Captain Dusty's, Harbor Creamery, …).
function iceCreamStand(plain: Bucket, cx: number, cz: number, ang: number, g: number) {
  const CONE = '#c89a5e', CONE_D = '#ac824a', CREAM = '#f4f0e6', CHERRY = '#c23b2e', WOOD = '#8a6844';
  plain.box(cx, cz, 4.5, 4.5, g, g + 3, CONE_D);           // stand ring
  plain.box(cx, cz, 2.2, 2.2, g + 3, g + 8, CONE);         // cone tip (point-down)
  plain.box(cx, cz, 3.6, 3.6, g + 8, g + 14, CONE);        // cone mid
  plain.box(cx, cz, 5.0, 5.0, g + 14, g + 20, CONE_D);     // cone rim
  plain.box(cx, cz, 5.6, 5.6, g + 20, g + 25, CREAM);      // swirl
  plain.box(cx, cz, 4.2, 4.2, g + 25, g + 29, CREAM);
  plain.box(cx, cz, 2.6, 2.6, g + 29, g + 32, CREAM);
  plain.box(cx, cz, 1.3, 1.3, g + 32, g + 34.4, CHERRY);   // cherry on top
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (const s of [-1, 1] as const) {                      // two picnic tables flanking the cone
    const tx = cx + ca * s * 17, tz = cz + sa * s * 17;
    rotBox(plain, tx, tz, 7, 3.2, g + 5.2, g + 7, ang, WOOD);
    for (const w of [-1, 1] as const) rotBox(plain, tx - sa * w * 5.4, tz + ca * w * 5.4, 6.2, 1.5, g + 3, g + 4.2, ang, WOOD);
    for (const e of [-1, 1] as const) rotBox(plain, tx + ca * e * 5.6, tz + sa * e * 5.6, 0.9, 3.0, g, g + 5.2, ang, '#6f5436');
  }
}

// 🚒 a fire engine parked out front of its station — ladder truck in town red
function fireEngine(bk: Bucket, x: number, z: number, ang: number, g: number) {
  const RED = '#bb2d24', DARK = '#2e3338', STEEL = '#d8d5cc';
  const ca = Math.cos(ang), sa = Math.sin(ang);
  chamferBox(bk, x - ca * 4, z - sa * 4, 23, 8.5, g + 3, g + 17, ang, RED, 1.8);      // body
  chamferBox(bk, x + ca * 19, z + sa * 19, 8, 8.2, g + 3, g + 21, ang, RED, 2);       // cab
  rotBox(bk, x + ca * 24.5, z + sa * 24.5, 2.2, 6.8, g + 12, g + 19, ang, DARK);      // windshield
  rotBox(bk, x - ca * 5, z - sa * 5, 19, 2.4, g + 17.5, g + 19.5, ang, STEEL);        // ladder
  rotBox(bk, x + ca * 19, z + sa * 19, 3.2, 3.6, g + 21, g + 22.6, ang, CHERRY_RED);  // beacon
  for (const lx of [-19, -2, 13] as const) for (const lz of [-8.5, 8.5] as const) {
    chamferBox(bk, x + lx * ca - lz * sa, z + lx * sa + lz * ca, 3.2, 1.2, g, g + 6, ang, '#23241f', 1);
  }
}
const CHERRY_RED = '#c23b2e';

// 🚓 a black-and-white cruiser parked at the police station
function policeCruiser(bk: Bucket, x: number, z: number, ang: number, g: number) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  car(bk, x, z, ang, '#22252a', g);
  rotBox(bk, x + ca * 4, z + sa * 4, 6.5, 7.3, g + 4.5, g + 9, ang, '#e8e6df');        // white door band
  rotBox(bk, x - ca * 3, z - sa * 3, 1.6, 4.6, g + 15.5, g + 17.2, ang, CHERRY_RED);   // light bar
  rotBox(bk, x - ca * 3, z - sa * 3, 1.6, 1.7, g + 15.5, g + 17.4, ang, '#3b6fd8');    // blue centre
}

// 🎬 a lit marquee over a theatre/cinema entrance (The Cabot, the Screening Room…):
// white canopy on a deep-red, gold-trimmed fascia jutting from the street facade,
// with a warm glowing soffit — the one storefront that should read at dusk.
function marquee(buckets: Bucket[], world: WorldData, index: WorldIndex,
                 bucket: ReturnType<WorldIndex['bucket']>, poi: { x: number; y: number }) {
  let b: Building | null = null, bd = 150 * 150;
  for (const bi of bucket.buildings) {
    const cand = world.buildings[bi];
    if (pointInRingD(poi.x, poi.y, cand.p)) { b = cand; break; }
    const [ccx, ccz] = centroidOf(cand.p);
    const d = (ccx - poi.x) ** 2 + (ccz - poi.y) ** 2;
    if (d < bd) { bd = d; b = cand; }
  }
  if (!b) return;
  const fs = frontSegment(b, index);
  // anchor to the BUILDING's base (highest footprint corner — how the walls sit),
  // not the sloping terrain at the wall, or the band hangs below the storefront
  let g = -Infinity;
  for (let i = 0; i < b.p.length; i += 2) g = Math.max(g, index.heightAtPx(b.p[i], b.p[i + 1]));
  const ang = Math.atan2(fs.tz, fs.tx);
  // centre 8 out with half-depth 10: the band's back edge buries 2px INTO the
  // facade, so it always reads bolted to the wall
  const mx = fs.x + fs.nx * 8, mz = fs.z + fs.nz * 8;
  rotBox(buckets[PLAIN], mx, mz, 34, 10, g + 26, g + 28.5, ang, '#eae8df');    // canopy top
  rotBox(buckets[PLAIN], mx, mz, 35, 11, g + 21.5, g + 26, ang, '#8c2f2a');    // fascia band
  rotBox(buckets[PLAIN], mx, mz, 35.4, 11.4, g + 25.2, g + 26, ang, '#d8b94a'); // gold trim
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const pt = (lx: number, lz: number): [number, number] => [mx + lx * ca - lz * sa, mz + lx * sa + lz * ca];
  const c0 = pt(-34, -10), c1 = pt(34, -10), c2 = pt(34, 10), c3 = pt(-34, 10);
  tmp.set('#ffd98a');
  buckets[GLOW].quad(c3[0], g + 21.5, c3[1], c2[0], g + 21.5, c2[1], c1[0], g + 21.5, c1[1], c0[0], g + 21.5, c0[1], 0, -1, 0, tmp.r, tmp.g, tmp.b);
}

// A small bronze figure on a granite pedestal — the data-driven archetype for
// tourism=artwork / historic=monument|memorial points (statues, town monuments).
// Reads as "a statue stands here" at exploration scale; it's a silhouette, not the
// specific likeness. Works in any town that maps its monuments.
function landmarkStatue(plain: Bucket, cx: number, cz: number, g: number) {
  // scaled against the 36px kid (a statue must top the player or it reads as a
  // toy — the Man at the Wheel taught us; the kid model is stylized-large)
  const GRANITE = '#9c968b', GRANITE_D = '#857f74', BRONZE = '#4a4334';
  plain.box(cx, cz, 5.0, 5.0, g, g + 16, GRANITE);          // pedestal
  plain.box(cx, cz, 5.7, 5.7, g + 16, g + 18.5, GRANITE_D); // cap lip
  plain.box(cx, cz, 3.6, 3.6, g + 18.5, g + 21, GRANITE);   // figure block
  plain.box(cx, cz, 2.0, 1.6, g + 21, g + 33, BRONZE);      // legs + torso
  plain.box(cx, cz, 3.0, 1.9, g + 33, g + 38.5, BRONZE);    // shoulders
  plain.box(cx, cz, 1.5, 1.5, g + 38.5, g + 43, BRONZE);    // head
}

// A granite obelisk on a stepped base — the archetype for war/civic memorials
// (historic=memorial named "…Memorial/War/Veterans"): tapered shaft + pyramidion.
function landmarkObelisk(plain: Bucket, cx: number, cz: number, g: number) {
  const S = '#a8a299', SD = '#8d877d';
  plain.box(cx, cz, 4.6, 4.6, g, g + 5, SD);         // base step
  plain.box(cx, cz, 3.4, 3.4, g + 5, g + 9, S);      // plinth
  plain.box(cx, cz, 2.3, 2.3, g + 9, g + 31, S);     // shaft
  plain.box(cx, cz, 1.8, 1.8, g + 31, g + 48, SD);   // upper shaft
  plain.box(cx, cz, 1.35, 1.35, g + 48, g + 57, S);
  cone(plain, cx, g + 57, cz, 1.9, 6.5, new THREE.Color('#8d877d'));   // pyramidion
}

// A memorial arch / gateway — two piers + an entablature, opening between them
// (historic=memorial named "…Arch", e.g. Washington Arch). Axis-aligned.
function landmarkArch(plain: Bucket, cx: number, cz: number, g: number) {
  const S = '#cfc7b6', SD = '#b3aa97';
  const span = 7, pierW = 2.5, h = 25;
  for (const s of [-1, 1]) {
    plain.box(cx + s * span, cz, pierW + 0.9, 3.1, g, g + 3, SD);        // pier base
    plain.box(cx + s * span, cz, pierW, 2.5, g + 3, g + h, S);           // pier
  }
  plain.box(cx, cz, span + pierW, 2.9, g + h, g + h + 5, S);             // entablature
  plain.box(cx, cz, span + pierW + 0.7, 3.2, g + h + 5, g + h + 7, SD);  // cornice
}

// A tiered stone fountain — octagonal basin with water + a central two-bowl jet.
// For amenity=fountain points (e.g. East India Square Fountain). Town-square staple.
function landmarkFountain(plain: Bucket, cx: number, cz: number, g: number) {
  const STONE = '#b9b2a3', STONE_D = '#9b9486', WATER = '#5f88a8';
  const oct = (r: number): number[] => { const ring: number[] = []; for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; ring.push(cx + Math.cos(a) * r, cz + Math.sin(a) * r); } return ring; };
  walls(plain, oct(10), g, g + 2.2, STONE_D);          // base foot
  walls(plain, oct(9), g, g + 5.5, STONE);             // basin rim
  flatRoof(plain, oct(8), g + 4.2, WATER);             // water surface
  plain.box(cx, cz, 1.7, 1.7, g + 4, g + 10, STONE);   // central pedestal
  flatRoof(plain, oct(3.4), g + 10, STONE_D);          // lower bowl
  plain.box(cx, cz, 1.0, 1.0, g + 10, g + 15, STONE);  // upper stem
  flatRoof(plain, oct(2.1), g + 15, STONE_D);          // upper bowl
  plain.box(cx, cz, 0.5, 0.5, g + 15, g + 19, STONE_D); // jet
}

// A small coastal redoubt — square stone ramparts with raised corner bastions, an
// earthwork interior, and a flag. For historic=fort points (e.g. Fort Pickering).
function landmarkFort(plain: Bucket, cx: number, cz: number, g: number) {
  const STONE = '#8f8a7e', STONE_D = '#777264', EARTH = '#6e6550';
  const R = 18, H = 10;
  plain.box(cx, cz - R, R + 2.5, 2.6, g, g + H, STONE);   // ramparts (4 walls)
  plain.box(cx, cz + R, R + 2.5, 2.6, g, g + H, STONE);
  plain.box(cx - R, cz, 2.6, R + 2.5, g, g + H, STONE);
  plain.box(cx + R, cz, 2.6, R + 2.5, g, g + H, STONE);
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    plain.box(cx + sx * R, cz + sz * R, 4.2, 4.2, g, g + H + 3.5, STONE_D);   // corner bastions
  plain.box(cx, cz, R - 3, R - 3, g, g + 3.5, EARTH);      // earthwork interior
  plain.box(cx, cz, 0.45, 0.45, g + 3.5, g + 28, STONE_D); // flagpole
  plain.box(cx + 3.2, cz, 3.2, 0.3, g + 22, g + 26.5, '#b03a3a'); // flag
}

// A standalone tower (man_made=tower / building=tower): tall stone shaft + pointed
// spire. Covers bell towers, observation towers, clock towers in any town.
function buildTower(buckets: Bucket[], b: Building, g: number) {
  const obb = obbOf(b.p);
  const w = Math.min(obb.hw, obb.hl);
  const top = g + Math.max(46, Math.min(100, w * 5));
  walls(buckets[PLAIN], b.p, g - 4, top, '#b8b0a2');                                   // tall stone shaft
  flatRoof(buckets[PLAIN], b.p, top, '#938b7e');                                       // cap deck
  hipRoof(buckets[SHINGLE], obb, top, Math.max(12, w * 1.6), 1.5, '#6b5a48', true);    // pointed spire
}

// Water towers / storage tanks / silos — octagonal drums, not clapboard houses (the
// OSM tags are reliable: building=water_tower / man_made=storage_tank|silo, and a
// 20 m tank was rendering as a 6-storey home). Same walls+octRing idiom as the heroes.
function buildTank(buckets: Bucket[], b: Building, g: number) {
  const [cx, cz] = centroidOf(b.p);
  const obb = obbOf(b.p);
  const r = Math.max(8, Math.min(obb.hl, obb.hw) * 0.92);
  const plain = buckets[PLAIN];
  if (b.k === 'wtower') {
    // municipal elevated tank: four legs + riser up to the pale drum
    const legTop = g + 100;
    for (const [sx, sz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]] as [number, number][]) {
      plain.box(cx + sx * r, cz + sz * r, 2, 2, g, legTop + 6, '#87909a');
    }
    plain.box(cx, cz, 3, 3, g, legTop, '#87909a');
    walls(plain, octRing(cx, cz, r), legTop, legTop + 52, '#b9c2c8');
    flatRoof(plain, octRing(cx, cz, r * 0.99), legTop + 52, '#a9b2b8');
    flatRoof(plain, octRing(cx, cz, r * 0.5), legTop + 58, '#9aa4ac');
  } else {
    // ground tank / silo: a squat industrial drum with a stepped cap
    const h = Math.max(40, Math.min(90, r * 2.2));
    walls(plain, octRing(cx, cz, r), g, g + h, '#aab2b6');
    flatRoof(plain, octRing(cx, cz, r * 0.99), g + h, '#8f9599');
    flatRoof(plain, octRing(cx, cz, r * 0.55), g + h + 6, '#848a8e');
  }
}

function buildingDims(b: Building, areaM2: number): { eave: number; lvEff: number } {
  // lv is AUTHORITATIVE: build_world overlays real Overture ML heights onto every
  // untagged building and applies the size-based inference itself for the few with
  // no height data (it knows which buildings went unmatched — the renderer can't
  // tell). The old render-time compensations (area-lift for houses, min-3 for big
  // commercial blocks) fought the real data and flattened downtown to one height.
  const lv = Math.max(1, Math.min(6, b.lv || 1.5));
  switch (b.k) {
    case 'shed': return { eave: 16, lvEff: 1 };
    case 'church': return { eave: 30, lvEff: 2 };
    case 'commercial':
    case 'civic':
      return { eave: 8 + lv * 23, lvEff: lv };
    case 'industrial': return { eave: 8 + lv * 21, lvEff: lv };
    default: return { eave: 12 + lv * 15, lvEff: lv };
  }
}

function wallHexFor(b: Building, seed: number): string {
  const s = STYLE.building;
  switch (b.k) {
    case 'commercial': return pick(s.wallsCommercial, seed);
    case 'civic': return pick(s.wallsCivic, seed);
    case 'church': return pick(s.wallsChurch, seed);
    case 'industrial': return pick(s.wallsIndustrial, seed);
    case 'shed': return pick(s.wallsShed, seed);
    default: return pick(s.wallsHouse, seed);
  }
}

// ---------- hero landmarks: hand-modeled from photos, on their real footprints ----------

type HeroBuilder = (buckets: Bucket[], b: Building, g: number, index: WorldIndex) => void;

function octRing(cx: number, cz: number, r: number): number[] {
  const ring: number[] = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ring.push(cx + Math.cos(a) * r, cz + Math.sin(a) * r);
  }
  return ring;
}

// Newburyport High School (241 High St) — modeled from Devin's photo: stepped
// brick massing (taller center pavilion, lower wings), double white beltlines,
// two-story white columned entrance, and the clock cupola CENTERED on the front.
function buildNHS(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const wingTop = g + 50;
  walls(buckets[BRICK], b.p, g - 8, wingTop, '#fdfcf8');
  const v = ringToVec2(b.p);
  const band = (y0: number, y1: number) => {
    tmp.set(STYLE.building.trim);
    for (let i = 0; i < v.length; i++) {
      const a = v[i], bb = v[(i + 1) % v.length];
      const ex = bb.x - a.x, ey = bb.y - a.y;
      const len = Math.hypot(ex, ey);
      if (len < 0.01) continue;
      const nx = ey / len, nz = ex / len;
      buckets[PLAIN].quad(
        a.x + nx * 0.5, y0, -a.y, bb.x + nx * 0.5, y0, -bb.y,
        bb.x + nx * 0.5, y1, -bb.y, a.x + nx * 0.5, y1, -a.y,
        nx, 0, nz, tmp.r, tmp.g, tmp.b
      );
    }
  };
  band(g + 22, g + 24);          // beltline between floors
  band(wingTop - 3, wingTop);    // cornice
  flatRoof(buckets[PLAIN], b.p, wingTop, '#4c4a47');
  walls(buckets[BRICK], b.p, wingTop, wingTop + 2.5, '#fdfcf8');
  // dense white-trimmed windows on every face
  facades(buckets[PLAIN], b.p, wingTop, 2, 4451, false, false, false, g, 400);

  // FRONT bearing: toward the memorial-garden hedges on the High St lawn —
  // they're real mapped barriers, so the front orients itself from data
  const [hcx, hcz] = centroidOf(b.p);
  let dirX = -0.23, dirZ = -0.97;
  let gardenX = hcx + dirX * 660, gardenZ = hcz + dirZ * 660;
  {
    let hx = 0, hz = 0, cnt = 0;
    for (const bar of index.world.barriers) {
      if (bar.k !== 'hedge') continue;
      let mx = 0, mz = 0;
      const m = bar.p.length / 2;
      for (let i = 0; i < bar.p.length; i += 2) { mx += bar.p[i]; mz += bar.p[i + 1]; }
      mx /= m;
      mz /= m;
      if ((mx - hcx) ** 2 + (mz - hcz) ** 2 < 1100 * 1100) { hx += mx; hz += mz; cnt++; }
    }
    if (cnt) {
      gardenX = hx / cnt;
      gardenZ = hz / cnt;
      const dl = Math.hypot(gardenX - hcx, gardenZ - hcz) || 1;
      dirX = (gardenX - hcx) / dl;
      dirZ = (gardenZ - hcz) / dl;
    }
  }
  // the memorial walkway (a real mapped footpath running between the hedges)
  // dead-ends at the front door — its building-end is THE entrance anchor
  {
    const distPolySq = (x: number, z: number, pts: number[]) => {
      let best = Infinity;
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const x0 = pts[i], z0 = pts[i + 1], x1 = pts[i + 2], z1 = pts[i + 3];
        const dx = x1 - x0, dz = z1 - z0;
        const l2 = dx * dx + dz * dz;
        let t = l2 ? ((x - x0) * dx + (z - z0) * dz) / l2 : 0;
        t = Math.max(0, Math.min(1, t));
        best = Math.min(best, (x - (x0 + t * dx)) ** 2 + (z - (z0 + t * dz)) ** 2);
      }
      return best;
    };
    let walkway: number[] | null = null, wbest = 80 * 80;
    for (const p of index.world.paths) {
      if (p.c !== 'foot') continue;
      const d = distPolySq(gardenX, gardenZ, p.p);
      if (d < wbest) { wbest = d; walkway = p.p; }
    }
    if (walkway) {
      const n2 = walkway.length;
      const dA = (walkway[0] - hcx) ** 2 + (walkway[1] - hcz) ** 2;
      const dB = (walkway[n2 - 2] - hcx) ** 2 + (walkway[n2 - 1] - hcz) ** 2;
      gardenX = dA < dB ? walkway[0] : walkway[n2 - 2];
      gardenZ = dA < dB ? walkway[1] : walkway[n2 - 1];
    }
  }
  // front anchor = that door point PROJECTED onto the lawn-facing facade
  let fpx = hcx, fpz = hcz, bestScore = Infinity, tanX = -dirZ, tanZ = dirX;
  for (let i = 0; i + 1 < b.p.length; i += 2) {
    const x0 = b.p[i], z0 = b.p[i + 1];
    const x1 = b.p[(i + 2) % b.p.length], z1 = b.p[(i + 3) % b.p.length];
    const dx = x1 - x0, dz = z1 - z0;
    const len = Math.hypot(dx, dz);
    if (len < 14) continue;
    let nx = -dz / len, nz = dx / len;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if ((mx - hcx) * nx + (mz - hcz) * nz < 0) { nx = -nx; nz = -nz; }
    if (nx * dirX + nz * dirZ < 0.25) continue; // must face the front lawn (facade bends)
    let t = ((gardenX - x0) * dx + (gardenZ - z0) * dz) / (len * len);
    t = Math.max(0, Math.min(1, t));
    const qx = x0 + t * dx, qz = z0 + t * dz;
    const d = (qx - gardenX) ** 2 + (qz - gardenZ) ** 2;
    if (d < bestScore) {
      bestScore = d;
      fpx = qx;
      fpz = qz;
      tanX = dx / len;
      tanZ = dz / len;
    }
  }
  // outward normal at the front (toward the lawn)
  let fnx = -tanZ, fnz = tanX;
  if ((fpx - hcx) * fnx + (fpz - hcz) * fnz < 0) { fnx = -fnx; fnz = -fnz; }

  // CENTER PAVILION: taller third story aligned to the facade
  const pcx = fpx - fnx * 26, pcz = fpz - fnz * 26;
  const pavTop = g + 78;
  const pav = (hl: number, hw: number): number[] => {
    const ring: number[] = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
      ring.push(pcx + tanX * hl * sx + fnx * hw * sz, pcz + tanZ * hl * sx + fnz * hw * sz);
    }
    return ring;
  };
  walls(buckets[BRICK], pav(64, 30), g - 2, pavTop, '#fdfcf8');
  walls(buckets[PLAIN], pav(64.6, 30.6), pavTop - 3, pavTop, '#faf8f0', 0);
  flatRoof(buckets[PLAIN], pav(64, 30), pavTop, '#46443f');
  facades(buckets[PLAIN], pav(63, 29), pavTop, 3, 977, false, false, false, g, 90);

  // TWO-STORY WHITE ENTRANCE: backdrop slab, four columns, pediment, dark doors
  const ex2 = fpx + fnx * 1.5, ez2 = fpz + fnz * 1.5;
  const slab: number[] = [];
  for (const [sx, sz] of [[-1, 0], [1, 0], [1, 1.2], [-1, 1.2]] as const) {
    slab.push(ex2 + tanX * 20 * sx + fnx * 3 * sz, ez2 + tanZ * 20 * sx + fnz * 3 * sz);
  }
  walls(buckets[PLAIN], slab, g, g + 46, '#f4f1e6', 0);
  flatRoof(buckets[PLAIN], slab, g + 46, '#f4f1e6');
  for (const off of [-13, -4.5, 4.5, 13]) {
    buckets[PLAIN].box(ex2 + tanX * off + fnx * 6.5, ez2 + tanZ * off + fnz * 6.5, 1.5, 1.5, g, g + 40, '#faf8f0');
  }
  buckets[PLAIN].box(ex2 + fnx * 6, ez2 + fnz * 6, 17, 3.4, g + 40, g + 44, '#faf8f0');
  tmp.set('#faf8f0');
  buckets[PLAIN].triUV(
    ex2 - tanX * 17 + fnx * 7, g + 44, ez2 - tanZ * 17 + fnz * 7,
    ex2 + tanX * 17 + fnx * 7, g + 44, ez2 + tanZ * 17 + fnz * 7,
    ex2 + fnx * 7, g + 54, ez2 + fnz * 7,
    fnx, 0.3, fnz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0
  );
  tmp.set('#2e3338');
  buckets[PLAIN].quad(
    ex2 - tanX * 6 + fnx * 3.6, g, ez2 - tanZ * 6 + fnz * 3.6,
    ex2 + tanX * 6 + fnx * 3.6, g, ez2 + tanZ * 6 + fnz * 3.6,
    ex2 + tanX * 6 + fnx * 3.6, g + 15, ez2 + tanZ * 6 + fnz * 3.6,
    ex2 - tanX * 6 + fnx * 3.6, g + 15, ez2 - tanZ * 6 + fnz * 3.6,
    fnx, 0, fnz, tmp.r, tmp.g, tmp.b
  );

  // THE CLOCK CUPOLA — centered on the pavilion, crowning the front facade
  const tX = pcx, tZ = pcz;
  buckets[BRICK].box(tX, tZ, 16, 16, pavTop, g + 102, '#fdfcf8', 1);
  buckets[PLAIN].box(tX, tZ, 12.5, 12.5, g + 102, g + 124, '#f6f3ea');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    buckets[PLAIN].box(tX + dx * 13, tZ + dz * 13, dx ? 0.5 : 4.8, dz ? 0.5 : 4.8, g + 108, g + 119, '#2a2d28');
    buckets[PLAIN].box(tX + dx * 13.4, tZ + dz * 13.4, dx ? 0.3 : 1.1, dz ? 0.3 : 1.1, g + 112.5, g + 115, '#f6f3ea');
  }
  walls(buckets[PLAIN], octRing(tX, tZ, 8.5), g + 124, g + 142, '#f6f3ea', 0);
  tmp.set('#3e4140');
  cone(buckets[PLAIN], tX, g + 142, tZ, 10.5, 13, tmp.clone());
  buckets[PLAIN].box(tX, tZ, 0.5, 0.5, g + 154, g + 164, '#e8e4da');

  // twin flagpoles flanking the front walk (the entrance now sits ON the
  // walkway axis, so an on-axis pole would stand in the path)
  for (const s of [-1, 1] as const) {
    const fX = fpx + fnx * 55 + tanX * 38 * s, fZ = fpz + fnz * 55 + tanZ * 38 * s;
    const fg = index.heightAtPx(fX, fZ);
    buckets[PLAIN].box(fX, fZ, 0.6, 0.6, fg, fg + 44, '#e8e4da');
    buckets[PLAIN].box(fX + 4.5, fZ, 4.2, 0.3, fg + 38, fg + 43, '#b03a32');
  }
}

// ---------- shared hero helpers ----------

// the footprint edge that faces the nearest street: anchor for porticos/steeples
function frontSegment(b: Building, index: WorldIndex): { x: number; z: number; tx: number; tz: number; nx: number; nz: number; len: number } {
  const [cx, cz] = centroidOf(b.p);
  const key = Math.floor(cx / CHUNK) + ',' + Math.floor(cz / CHUNK);
  const roads = index.bucket(key).roads;
  let best = { x: cx, z: cz, tx: 1, tz: 0, nx: 0, nz: 1, len: 0, d: Infinity };
  for (let i = 0; i + 1 < b.p.length; i += 2) {
    const x0 = b.p[i], z0 = b.p[i + 1];
    const x1 = b.p[(i + 2) % b.p.length], z1 = b.p[(i + 3) % b.p.length];
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 24) continue;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    for (const ri of roads) {
      const r = index.world.roads[ri];
      if (r.c === 'service') continue;
      // closeness wins, but long facades beat tiny jogs at similar distance
      const d = Math.sqrt(distToPolylineSq(mx, mz, r.p)) - Math.min(len, 120) * 0.45;
      if (d < best.d) {
        let nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
        if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
        best = { x: mx, z: mz, tx: (x1 - x0) / len, tz: (z1 - z0) / len, nx, nz, len, d };
      }
    }
  }
  return best;
}

// New England steeple at the street end: square tower → (clock stage) →
// arched belfry → spire → vane. grand = the full Wren treatment.
function steeple(buckets: Bucket[], b: Building, g: number, index: WorldIndex, grand: boolean) {
  const f = frontSegment(b, index);
  const inset = grand ? 11 : 8;
  const tx = f.x - f.nx * inset, tz = f.z - f.nz * inset;
  const trim = '#f6f3ea';
  const s1 = grand ? 8.5 : 6.5;
  let y = g + (grand ? 70 : 46);
  walls(buckets[CLAP], [tx - s1, tz - s1, tx + s1, tz - s1, tx + s1, tz + s1, tx - s1, tz + s1], g - 2, y, trim);
  if (grand) {
    // clock stage
    buckets[PLAIN].box(tx, tz, s1 - 0.6, s1 - 0.6, y, y + 15, trim);
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      buckets[PLAIN].box(tx + dx * (s1 - 0.3), tz + dz * (s1 - 0.3), dx ? 0.4 : 3.2, dz ? 0.4 : 3.2, y + 5, y + 12, '#2a2d28');
    }
    y += 15;
  }
  // open belfry with dark arched bays
  const belR = grand ? 6.8 : 5.4;
  walls(buckets[PLAIN], octRing(tx, tz, belR), y, y + (grand ? 17 : 12), trim, 0);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    buckets[PLAIN].box(tx + dx * (belR - 0.5), tz + dz * (belR - 0.5), dx ? 0.4 : 2.3, dz ? 0.4 : 2.3, y + 3, y + (grand ? 13 : 9), '#33352f');
  }
  y += grand ? 17 : 12;
  if (grand) {
    walls(buckets[PLAIN], octRing(tx, tz, 4.8), y, y + 9, trim, 0);
    y += 9;
  }
  tmp.set('#eceadf');
  cone(buckets[PLAIN], tx, y, tz, grand ? 6.8 : 5.6, grand ? 40 : 24, tmp.clone());
  buckets[PLAIN].box(tx, tz, 0.35, 0.35, y + (grand ? 38 : 22), y + (grand ? 50 : 30), '#d8d4c8');
}

// ---------- the landmark heroes ----------

// First Religious Society (1801) — white meetinghouse with THE Newburyport steeple
function buildFRS(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const wallHex = '#f7f4ea';
  walls(buckets[CLAP], b.p, g - 6, g + 34, wallHex);
  complexGable(buckets[SHINGLE], buckets[CLAP], b.p, g + 34, '#4e4a45', wallHex);
  houseTrim(buckets[PLAIN], b.p, g + 34, g - 6);
  facades(buckets[PLAIN], b.p, g + 34, 2, 777, true, false, false, g, 60);
  steeple(buckets, b, g, index, true);
}

// Custom House (1835, Robert Mills) — granite Greek Revival with a columned porch
function buildCustomHouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const granite = '#a3a49e';
  walls(buckets[PLAIN], b.p, g - 6, g + 6, '#8e8f89', 0);   // heavy base course
  walls(buckets[PLAIN], b.p, g + 6, g + 42, granite, 0);
  const obb = obbOf(b.p);
  gableRoof(buckets[SHINGLE], buckets[PLAIN], b.p, obb, g + 42, 7, 3, '#56524d', granite);
  facades(buckets[PLAIN], b.p, g + 42, 2, 4750, false, false, false, g, 50);
  const f = frontSegment(b, index);
  // granite portico: dark recess, four pale columns, entablature + pediment, steps
  tmp.set('#3a3c38');
  buckets[PLAIN].quad(
    f.x - f.tx * 8 + f.nx * 0.6, g, f.z - f.tz * 8 + f.nz * 0.6,
    f.x + f.tx * 8 + f.nx * 0.6, g, f.z + f.tz * 8 + f.nz * 0.6,
    f.x + f.tx * 8 + f.nx * 0.6, g + 22, f.z + f.tz * 8 + f.nz * 0.6,
    f.x - f.tx * 8 + f.nx * 0.6, g + 22, f.z - f.tz * 8 + f.nz * 0.6,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  for (const off of [-6.5, -2.2, 2.2, 6.5]) {
    buckets[PLAIN].box(f.x + f.tx * off + f.nx * 6.5, f.z + f.tz * off + f.nz * 6.5, 1.4, 1.4, g, g + 22, '#d4d5ce');
  }
  rotBox(buckets[PLAIN], f.x + f.nx * 6.5, f.z + f.nz * 6.5, 8.8, 2.6, g + 22, g + 25.5, Math.atan2(f.tz, f.tx), '#c8c9c2');
  tmp.set('#ccCDc6'.toLowerCase());
  buckets[PLAIN].triUV(
    f.x - f.tx * 9.5 + f.nx * 7, g + 25.5, f.z - f.tz * 9.5 + f.nz * 7,
    f.x + f.tx * 9.5 + f.nx * 7, g + 25.5, f.z + f.tz * 9.5 + f.nz * 7,
    f.x + f.nx * 7, g + 31.5, f.z + f.nz * 7,
    f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0
  );
  rotBox(buckets[PLAIN], f.x + f.nx * 4.5, f.z + f.nz * 4.5, 9, 5, g, g + 1.6, Math.atan2(f.tz, f.tx), '#94958f');
  // end chimneys
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  for (const s of [-1, 1]) {
    buckets[BRICK].box(obb.cx + ca * (obb.hl - 8) * s, obb.cz + sa * (obb.hl - 8) * s, 2.6, 2.6, g + 44, g + 56, '#fdfcf8', 1);
  }
}

// Firehouse Center (1823) — brick market house; clock pediment on the front,
// square BRICK hose tower over the rear of the ridge (photo-audited 7/6: the
// white bell cupola never existed — the real rooftop is the fire-station tower)
function buildFirehouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 6, g + 40, '#fdfcf8');
  walls(buckets[PLAIN], b.p, g + 37, g + 40, '#f4f1e6', 0);          // entablature
  const obb = obbOf(b.p);
  gableRoof(buckets[SHINGLE], buckets[PLAIN], b.p, obb, g + 40, 9, 3, '#544f4a', '#f4f1e6');
  facades(buckets[PLAIN], b.p, g + 40, 2, 1448, true, false, true, g, 40);
  const f = frontSegment(b, index);
  const fa = Math.atan2(f.tz, f.tx);
  // central front pediment with the white clock disc in the tympanum
  tmp.set('#f4f1e6');
  buckets[PLAIN].triUV(
    f.x - f.tx * 10 + f.nx * 1.2, g + 40, f.z - f.tz * 10 + f.nz * 1.2,
    f.x + f.tx * 10 + f.nx * 1.2, g + 40, f.z + f.tz * 10 + f.nz * 1.2,
    f.x + f.nx * 1.2, g + 48, f.z + f.nz * 1.2,
    f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0
  );
  rotBox(buckets[PLAIN], f.x + f.nx * 1.4, f.z + f.nz * 1.4, 2.3, 0.4, g + 41, g + 45.6, fa, '#33352f');
  rotBox(buckets[PLAIN], f.x + f.nx * 1.6, f.z + f.nz * 1.6, 1.8, 0.4, g + 41.5, g + 45.1, fa, '#f6f3ea');
  // square brick hose tower toward the rear of the roof: same brick as the
  // walls, a white-trimmed window each face, flat cap with a slight cornice
  const back = Math.max(0, Math.min(obb.hl, obb.hw) * 0.5 - 3);
  const tx2 = obb.cx - f.nx * back, tz2 = obb.cz - f.nz * back;
  const ring = [tx2 - 5, tz2 - 5, tx2 + 5, tz2 - 5, tx2 + 5, tz2 + 5, tx2 - 5, tz2 + 5];
  walls(buckets[BRICK], ring, g + 34, g + 71, '#fdfcf8');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    buckets[PLAIN].box(tx2 + dx * 5, tz2 + dz * 5, dx ? 0.45 : 2.4, dz ? 0.45 : 2.4, g + 57, g + 66, '#f1eee4');
    buckets[PLAIN].box(tx2 + dx * 5.2, tz2 + dz * 5.2, dx ? 0.4 : 1.6, dz ? 0.4 : 1.6, g + 58, g + 65, '#2c3a42');
  }
  walls(buckets[PLAIN], expandRing(ring, 0.8), g + 71, g + 73, '#544f4a', 0);
  flatRoof(buckets[PLAIN], expandRing(ring, 0.8), g + 73, '#544f4a');
}

// City Hall (1851) — brick block, white cornice, central cupola
function buildCityHall(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 6, g + 54, '#fdfcf8');
  const obb = obbOf(b.p);
  // photo-audited 7/6: Italianate — BROWNSTONE trim (not white) and NO cupola
  // (the 1873 tower proposal was never built; one was rendering here for weeks)
  walls(buckets[PLAIN], b.p, g + 50, g + 54, '#6b4a3a', 0); // bracketed brownstone cornice
  gableRoof(buckets[SHINGLE], buckets[PLAIN], b.p, obb, g + 54, 8, 3, '#504c48', '#6b4a3a');
  facades(buckets[PLAIN], b.p, g + 54, 3, 5334, true, false, false, g, 60);
  const f = frontSegment(b, index);
  // shallow front gable trim over the entrance bay (brownstone raking courses)
  tmp.set('#6b4a3a');
  buckets[PLAIN].triUV(
    f.x - f.tx * 12 + f.nx * 1.2, g + 54, f.z - f.tz * 12 + f.nz * 1.2,
    f.x + f.tx * 12 + f.nx * 1.2, g + 54, f.z + f.tz * 12 + f.nz * 1.2,
    f.x + f.nx * 1.2, g + 63, f.z + f.nz * 1.2,
    f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0
  );
}

// Atkinson Common's stone observation tower — round fieldstone, crenellated
function buildStoneTower(buckets: Bucket[], b: Building, g: number) {
  const stone = '#8d8678';
  walls(buckets[PLAIN], b.p, g - 4, g + 6, '#7c766a', 0);
  walls(buckets[PLAIN], b.p, g + 6, g + 74, stone, 0);
  walls(buckets[PLAIN], b.p, g + 70, g + 74, '#817b6e', 0);
  // crenellated parapet: merlons on alternating rim vertices
  for (let i = 0; i < b.p.length; i += 4) {
    buckets[PLAIN].box(b.p[i], b.p[i + 1], 2, 2, g + 74, g + 80, stone);
  }
  // arrow-slit windows up the shaft + a door
  const [cx, cz] = centroidOf(b.p);
  for (const [h0, h1] of [[g + 22, g + 30], [g + 44, g + 52]] as const) {
    for (const a of [0.4, 2.4, 4.4]) {
      buckets[PLAIN].box(cx + Math.cos(a) * 13.4, cz + Math.sin(a) * 13.4, 0.8, 0.8, h0, h1, '#3a382f');
    }
  }
  buckets[PLAIN].box(cx, cz + 13.2, 2.6, 1, g, g + 9, '#4a4034');
}

// March's Hill water tower — photo-audited 7/6: the 1997 tank is WHITE (the
// pale-blue standpipe it replaced was demolished); pedestal-spheroid reshape
// ("golf ball on a tee") is a follow-up — color fixed now.
function buildWaterTower(buckets: Bucket[], b: Building, g: number) {
  walls(buckets[PLAIN], b.p, g - 2, g + 100, '#eef0ee', 0);
  walls(buckets[PLAIN], b.p, g + 92, g + 100, '#d8dad6', 0);
  const [cx, cz] = centroidOf(b.p);
  const obb = obbOf(b.p);
  tmp.set('#e4e6e2');
  cone(buckets[PLAIN], cx, g + 100, cz, obb.hw + 1.5, 9, tmp.clone());
}

// Butler's Toothpick — the skinny red river beacon off Joppa
function buildToothpick(buckets: Bucket[], b: Building, g: number) {
  const [cx, cz] = centroidOf(b.p);
  walls(buckets[PLAIN], octRing(cx, cz, 4.5), g - 4, g + 52, '#b04038', 0);
  tmp.set('#9c3830');
  cone(buckets[PLAIN], cx, g + 52, cz, 5.4, 26, tmp.clone());
}

// frontSegment, but anchored at the centroid's projection onto the front edge
// (edge midpoints drift off the visual center on jogged footprints) + edge length
function heroFront(b: Building, index: WorldIndex, opts?: { minLen?: number; road?: string }):
    { x: number; z: number; tx: number; tz: number; nx: number; nz: number; len: number } {
  const minLen = opts?.minLen ?? 24;
  const [cx, cz] = centroidOf(b.p);
  // campus-scale footprints outrun their centroid chunk: scan the 3×3 block
  const kx = Math.floor(cx / CHUNK), ky = Math.floor(cz / CHUNK);
  const roadSet = new Set<number>();
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    for (const ri of index.bucket((kx + dx) + ',' + (ky + dy)).roads) roadSet.add(ri);
  }
  const roads = [...roadSet];
  const pick = (roadName?: string) => {
    let best = { x: cx, z: cz, tx: 1, tz: 0, nx: 0, nz: 1, len: 30, d: Infinity };
    for (let i = 0; i + 1 < b.p.length; i += 2) {
      const x0 = b.p[i], z0 = b.p[i + 1];
      const x1 = b.p[(i + 2) % b.p.length], z1 = b.p[(i + 3) % b.p.length];
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < minLen) continue;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      for (const ri of roads) {
        const r = index.world.roads[ri];
        if (r.c === 'service') continue;
        if (roadName && r.n !== roadName) continue;
        const d = Math.sqrt(distToPolylineSq(mx, mz, r.p)) - Math.min(len, 120) * 0.45;
        if (d < best.d) {
          let nx = -(z1 - z0) / len, nz = (x1 - x0) / len;
          if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
          let t = ((cx - x0) * (x1 - x0) + (cz - z0) * (z1 - z0)) / (len * len);
          t = Math.max(0.18, Math.min(0.82, t));
          best = { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, tx: (x1 - x0) / len, tz: (z1 - z0) / len, nx, nz, len, d };
        }
      }
    }
    return best;
  };
  // landmarks whose real entrance fronts a known street get first refusal there
  if (opts?.road) {
    const named = pick(opts.road);
    if (named.d < Infinity) return named;
  }
  return pick();
}

// glazed lighthouse lantern: gallery deck, dark lantern room, cap + finial
function lanternTop(plain: Bucket, cx: number, cz: number, y: number, r: number, capHex = '#15181c') {
  flatRoof(plain, octRing(cx, cz, r + 1.6), y, '#23262a');           // gallery deck
  walls(plain, octRing(cx, cz, r + 1.4), y - 1.2, y, '#23262a', 0);
  walls(plain, octRing(cx, cz, r), y, y + 7, '#1d2024', 0);          // lantern glass
  tmp.set(capHex);
  cone(plain, cx, y + 7, cz, r + 1.2, 4.5, tmp.clone());
  plain.box(cx, cz, 0.3, 0.3, y + 11, y + 15, '#15181c');
}

// dark tall windows with white surrounds + an arched cap — banks and courts
function archWindows(plain: Bucket, ring: number[], y0: number, h: number, gapMin: number, capH = 2.2) {
  const v = ringToVec2(ring);
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b2 = v[(i + 1) % v.length];
    const len = Math.hypot(b2.x - a.x, b2.y - a.y);
    if (len < gapMin * 1.6) continue;
    const ux = (b2.x - a.x) / len, uy = (b2.y - a.y) / len;
    const nx = uy, nz = ux;
    const cols = Math.min(9, Math.floor(len / gapMin));
    const gap = len / (cols + 1);
    for (let c = 1; c <= cols; c++) {
      const wx = a.x + ux * gap * c, wy = a.y + uy * gap * c;
      const px = wx + nx * 0.5, py = wy - nz * 0.5;
      tmp.set('#f1eee4');  // surround
      plain.quad(px - ux * 3.4, y0 - 1, -(py - uy * 3.4), px + ux * 3.4, y0 - 1, -(py + uy * 3.4),
        px + ux * 3.4, y0 + h + 1, -(py + uy * 3.4), px - ux * 3.4, y0 + h + 1, -(py - uy * 3.4),
        nx, 0, nz, tmp.r, tmp.g, tmp.b);
      const qx = wx + nx * 0.9, qy = wy - nz * 0.9;
      tmp.set('#2c3a42');  // glass
      plain.quad(qx - ux * 2.4, y0, -(qy - uy * 2.4), qx + ux * 2.4, y0, -(qy + uy * 2.4),
        qx + ux * 2.4, y0 + h, -(qy + uy * 2.4), qx - ux * 2.4, y0 + h, -(qy - uy * 2.4),
        nx, 0, nz, tmp.r, tmp.g, tmp.b);
      if (capH > 0) {
        plain.triUV(qx - ux * 2.4, y0 + h, -(qy - uy * 2.4), qx + ux * 2.4, y0 + h, -(qy + uy * 2.4),
          qx, y0 + h + capH, -qy, nx, 0, nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
      }
    }
  }
}

// Cushing House / Museum of Old Newbury (1808) — three-story square brick
// Federal mansion on High Street, paired end chimneys, white door surround
function buildCushing(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 6, g + 52, '#fdfcf8');
  walls(buckets[PLAIN], b.p, g + 49, g + 52, '#faf8f0', 0);          // cornice
  const obb = obbOf(b.p);
  gableRoof(buckets[SHINGLE], buckets[PLAIN], b.p, obb, g + 52, 6, 3, '#4a4540', '#faf8f0');
  facades(buckets[PLAIN], b.p, g + 52, 3, 1808, false, true, false, g, 40);
  const f = heroFront(b, index, { road: 'High Street' });
  // flat-hooded white entry: two slim columns, entablature, dark green door
  for (const s of [-1, 1]) {
    buckets[PLAIN].box(f.x + f.tx * 4 * s + f.nx * 4.5, f.z + f.tz * 4 * s + f.nz * 4.5, 1, 1, g, g + 14, '#f6f3ea');
  }
  rotBox(buckets[PLAIN], f.x + f.nx * 4.2, f.z + f.nz * 4.2, 6.5, 3, g + 14, g + 17, Math.atan2(f.tz, f.tx), '#f6f3ea');
  tmp.set('#2e4034');
  buckets[PLAIN].quad(
    f.x - f.tx * 3 + f.nx * 0.8, g, f.z - f.tz * 3 + f.nz * 0.8,
    f.x + f.tx * 3 + f.nx * 0.8, g, f.z + f.tz * 3 + f.nz * 0.8,
    f.x + f.tx * 3 + f.nx * 0.8, g + 12, f.z + f.tz * 3 + f.nz * 0.8,
    f.x - f.tx * 3 + f.nx * 0.8, g + 12, f.z - f.tz * 3 + f.nz * 0.8,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  // paired end chimneys, the Federal silhouette
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  for (const s of [-1, 1]) for (const w of [-0.45, 0.45]) {
    buckets[BRICK].box(obb.cx + ca * (obb.hl - 5) * s - sa * obb.hw * w, obb.cz + sa * (obb.hl - 5) * s + ca * obb.hw * w,
      2.4, 2.4, g + 54, g + 68, '#fdfcf8', 1);
  }
}

// Newburyport Public Library (Tracy Mansion, 1771 + modern wing) — State Street
function buildLibrary(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 8, g + 48, '#fdfcf8');
  walls(buckets[PLAIN], b.p, g + 45, g + 48, '#faf8f0', 0);          // cornice
  complexGable(buckets[SHINGLE], buckets[PLAIN], b.p, g + 48, '#4c4843', '#faf8f0');
  facades(buckets[PLAIN], b.p, g + 48, 3, 1771, false, false, false, g, 70);
  const f = heroFront(b, index, { road: 'State Street' });
  // white-columned entry portico with a shallow pediment, granite steps
  for (const s of [-1, 1]) {
    buckets[PLAIN].box(f.x + f.tx * 5 * s + f.nx * 5.5, f.z + f.tz * 5 * s + f.nz * 5.5, 1.2, 1.2, g, g + 16, '#f6f3ea');
  }
  rotBox(buckets[PLAIN], f.x + f.nx * 5, f.z + f.nz * 5, 8, 3.4, g + 16, g + 19, Math.atan2(f.tz, f.tx), '#f6f3ea');
  tmp.set('#f6f3ea');
  buckets[PLAIN].triUV(
    f.x - f.tx * 8.5 + f.nx * 5.5, g + 19, f.z - f.tz * 8.5 + f.nz * 5.5,
    f.x + f.tx * 8.5 + f.nx * 5.5, g + 19, f.z + f.tz * 8.5 + f.nz * 5.5,
    f.x + f.nx * 5.5, g + 25, f.z + f.nz * 5.5,
    f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0
  );
  tmp.set('#33403a');
  buckets[PLAIN].quad(
    f.x - f.tx * 3.4 + f.nx * 0.8, g, f.z - f.tz * 3.4 + f.nz * 0.8,
    f.x + f.tx * 3.4 + f.nx * 0.8, g, f.z + f.tz * 3.4 + f.nz * 0.8,
    f.x + f.tx * 3.4 + f.nx * 0.8, g + 13, f.z + f.tz * 3.4 + f.nz * 0.8,
    f.x - f.tx * 3.4 + f.nx * 0.8, g + 13, f.z - f.tz * 3.4 + f.nz * 0.8,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  rotBox(buckets[PLAIN], f.x + f.nx * 9, f.z + f.nz * 9, 7, 4, g, g + 1.8, Math.atan2(f.tz, f.tx), '#9a9b95');
}

// Essex County Superior Court (1805, Bulfinch) — photo-audited 7/6: the facade
// is a FLAT brick wall with rectangular sashes + a brownstone SUPERIOR COURT
// arch (the white temple front never existed); pediments = brick gable ends
function buildCourthouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 6, g + 46, '#fdfcf8');
  walls(buckets[PLAIN], b.p, g + 43, g + 46, '#faf8f0', 0);          // bracketed cornice
  const obb = obbOf(b.p);
  gableRoof(buckets[SHINGLE], buckets[BRICK], b.p, obb, g + 46, 7, 3, '#4a4641', '#fdfcf8');
  facades(buckets[PLAIN], b.p, g + 46, 3, 1805, false, false, false, g, 60); // 6/6 sashes
  // round clock set in one brick gable-end pediment
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  rotBox(buckets[PLAIN], obb.cx + ca * (obb.hl - 0.4), obb.cz + sa * (obb.hl - 0.4), 1.6, 2.3, g + 46.8, g + 51.2, obb.ang, '#f4f1e6');
  rotBox(buckets[PLAIN], obb.cx + ca * (obb.hl - 0.2), obb.cz + sa * (obb.hl - 0.2), 1.6, 0.8, g + 48.2, g + 49.8, obb.ang, '#2c3034');
  const f = heroFront(b, index, { road: 'High Street' });
  const fang = Math.atan2(f.tz, f.tx);
  // brownstone round-arched entrance: surround, arch head over the door
  tmp.set('#6e5344');
  buckets[PLAIN].quad(
    f.x - f.tx * 5.4 + f.nx * 0.95, g, f.z - f.tz * 5.4 + f.nz * 0.95,
    f.x + f.tx * 5.4 + f.nx * 0.95, g, f.z + f.tz * 5.4 + f.nz * 0.95,
    f.x + f.tx * 5.4 + f.nx * 0.95, g + 14, f.z + f.tz * 5.4 + f.nz * 0.95,
    f.x - f.tx * 5.4 + f.nx * 0.95, g + 14, f.z - f.tz * 5.4 + f.nz * 0.95,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  buckets[PLAIN].triUV(
    f.x - f.tx * 5.4 + f.nx * 0.95, g + 14, f.z - f.tz * 5.4 + f.nz * 0.95,
    f.x + f.tx * 5.4 + f.nx * 0.95, g + 14, f.z + f.tz * 5.4 + f.nz * 0.95,
    f.x + f.nx * 0.95, g + 18.5, f.z + f.nz * 0.95,
    f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0
  );
  // engaged columns + the curved hood lettered SUPERIOR COURT
  for (const s of [-1, 1]) {
    buckets[PLAIN].box(f.x + f.tx * 4.2 * s + f.nx * 1.4, f.z + f.tz * 4.2 * s + f.nz * 1.4, 1.1, 1.1, g, g + 12, '#7a5d4b');
  }
  rotBox(buckets[PLAIN], f.x + f.nx * 2.1, f.z + f.nz * 2.1, 6.2, 1.5, g + 12, g + 14.6, fang, '#7a5d4b');
  // dark green double door under a fanlight
  tmp.set('#2e4a3a');
  buckets[PLAIN].quad(
    f.x - f.tx * 3 + f.nx * 1.3, g, f.z - f.tz * 3 + f.nz * 1.3,
    f.x + f.tx * 3 + f.nx * 1.3, g, f.z + f.tz * 3 + f.nz * 1.3,
    f.x + f.tx * 3 + f.nx * 1.3, g + 10, f.z + f.tz * 3 + f.nz * 1.3,
    f.x - f.tx * 3 + f.nx * 1.3, g + 10, f.z - f.tz * 3 + f.nz * 1.3,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  tmp.set('#2c3a42');
  buckets[PLAIN].quad(
    f.x - f.tx * 2.6 + f.nx * 1.3, g + 10.2, f.z - f.tz * 2.6 + f.nz * 1.3,
    f.x + f.tx * 2.6 + f.nx * 1.3, g + 10.2, f.z + f.tz * 2.6 + f.nz * 1.3,
    f.x + f.tx * 2.6 + f.nx * 1.3, g + 12, f.z + f.tz * 2.6 + f.nz * 1.3,
    f.x - f.tx * 2.6 + f.nx * 1.3, g + 12, f.z - f.tz * 2.6 + f.nz * 1.3,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  // granite stair
  rotBox(buckets[PLAIN], f.x + f.nx * 5, f.z + f.nz * 5, 8, 4.5, g, g + 1.8, fang, '#94958f');
}

// the Powder House (1822) — little round brick magazine hidden off Low Street
function buildPowderHouse(buckets: Bucket[], b: Building, g: number) {
  walls(buckets[BRICK], b.p, g - 4, g + 20, '#fdfcf8');
  const [cx, cz] = centroidOf(b.p);
  const obb = obbOf(b.p);
  tmp.set('#4e4a44');
  cone(buckets[PLAIN], cx, g + 20, cz, obb.hw + 2.5, 15, tmp.clone());
  buckets[PLAIN].box(cx, cz + obb.hw - 0.5, 2.4, 1.2, g, g + 8, '#3a3a38'); // iron door
}

// the Old Jail (1825) — grim granite block on Auburn Street, barred slits
function buildOldJail(buckets: Bucket[], b: Building, g: number) {
  walls(buckets[PLAIN], b.p, g - 6, g + 4, '#7e7f79', 0);
  walls(buckets[PLAIN], b.p, g + 4, g + 46, '#9a9b94', 0);
  const obb = obbOf(b.p);
  gableRoof(buckets[SHINGLE], buckets[PLAIN], b.p, obb, g + 46, 6, 3, '#46433f', '#9a9b94');
  // small barred windows — dark slits with pale granite frames
  const v = ringToVec2(b.p);
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b2 = v[(i + 1) % v.length];
    const len = Math.hypot(b2.x - a.x, b2.y - a.y);
    if (len < 36) continue;
    const ux = (b2.x - a.x) / len, uy = (b2.y - a.y) / len;
    const nx = uy, nz = ux;
    const cols = Math.min(5, Math.floor(len / 26));
    const gap = len / (cols + 1);
    for (let c = 1; c <= cols; c++) {
      for (let r = 0; r < 3; r++) {
        const wx = a.x + ux * gap * c + nx * 0.5, wy = a.y + uy * gap * c - nz * 0.5;
        const y0 = g + 10 + r * 12;
        tmp.set('#b0b1aa');
        buckets[PLAIN].quad(wx - ux * 2, y0 - 0.8, -(wy - uy * 2), wx + ux * 2, y0 - 0.8, -(wy + uy * 2),
          wx + ux * 2, y0 + 5.8, -(wy + uy * 2), wx - ux * 2, y0 + 5.8, -(wy - uy * 2), nx, 0, nz, tmp.r, tmp.g, tmp.b);
        tmp.set('#26282a');
        const qx = wx + nx * 0.4, qy = wy - nz * 0.4;
        buckets[PLAIN].quad(qx - ux * 1.2, y0, -(qy - uy * 1.2), qx + ux * 1.2, y0, -(qy + uy * 1.2),
          qx + ux * 1.2, y0 + 5, -(qy + uy * 1.2), qx - ux * 1.2, y0 + 5, -(qy - uy * 1.2), nx, 0, nz, tmp.r, tmp.g, tmp.b);
      }
    }
  }
  buckets[PLAIN].box(obb.cx, obb.cz, 3, 3, g + 48, g + 58, '#8a8b84'); // chimney
}

// Garrison Inn (1809) — four-story brick Federal block on Brown Square
function buildGarrisonInn(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 6, g + 72, '#fdfcf8');
  walls(buckets[PLAIN], b.p, g + 68, g + 72, '#faf8f0', 0);
  flatRoof(buckets[PLAIN], b.p, g + 72, '#494744');
  facades(buckets[PLAIN], b.p, g + 72, 4, 1809, true, false, false, g, 60);
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  for (const s of [-1, 1]) for (const w of [-0.5, 0.5]) {
    buckets[BRICK].box(obb.cx + ca * (obb.hl - 4) * s - sa * obb.hw * w, obb.cz + sa * (obb.hl - 4) * s + ca * obb.hw * w,
      2.2, 2.2, g + 72, g + 84, '#fdfcf8', 1);
  }
  const f = heroFront(b, index);
  // green entry canopy over the corner door
  rotBox(buckets[PLAIN], f.x + f.nx * 4, f.z + f.nz * 4, 6, 4, g + 15, g + 16.5, Math.atan2(f.tz, f.tx), '#2e4034');
}

// Institution for Savings (1871) — the stately stone bank on State Street
function buildBank(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  // photo-audited 7/6: 93 State St (1871, Rufus Sargent) is BROWNSTONE — warm
  // reddish-brown carved sandstone ("Newburyport's contribution to the
  // brownstone era") — it was rendering as pale grey ashlar
  walls(buckets[PLAIN], b.p, g - 6, g + 5, '#6f4636', 0);              // base course
  walls(buckets[PLAIN], b.p, g + 5, g + 44, '#8a5a45', 0);             // brownstone ashlar
  walls(buckets[PLAIN], b.p, g + 40, g + 44, '#9c6e58', 0);            // deep carved cornice
  complexGable(buckets[SHINGLE], buckets[PLAIN], b.p, g + 44, '#45423e', '#9c6e58');
  archWindows(buckets[PLAIN], b.p, g + 20, 13, 28);
  const f = heroFront(b, index, { road: 'State Street' });
  // pedimented stone entry
  for (const s of [-1, 1]) {
    buckets[PLAIN].box(f.x + f.tx * 4.4 * s + f.nx * 1.6, f.z + f.tz * 4.4 * s + f.nz * 1.6, 1.2, 1.2, g, g + 16, '#9c6e58');
  }
  tmp.set('#9c6e58');
  buckets[PLAIN].triUV(
    f.x - f.tx * 6.4 + f.nx * 2, g + 16, f.z - f.tz * 6.4 + f.nz * 2,
    f.x + f.tx * 6.4 + f.nx * 2, g + 16, f.z + f.tz * 6.4 + f.nz * 2,
    f.x + f.nx * 2, g + 21, f.z + f.nz * 2,
    f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0
  );
  tmp.set('#2c3134');
  buckets[PLAIN].quad(
    f.x - f.tx * 3 + f.nx * 0.8, g, f.z - f.tz * 3 + f.nz * 0.8,
    f.x + f.tx * 3 + f.nx * 0.8, g, f.z + f.tz * 3 + f.nz * 0.8,
    f.x + f.tx * 3 + f.nx * 0.8, g + 13, f.z + f.tz * 3 + f.nz * 0.8,
    f.x - f.tx * 3 + f.nx * 0.8, g + 13, f.z - f.tz * 3 + f.nz * 0.8,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
}

// Rear Range Light (1873) — square brick tower off Water Street, "pyramidal in
// form": a tapering chimney-like shaft (53 ft with the 1901 extension), its
// river-facing side painted white as a daymark, black iron lantern + gallery
// ---------- GLOUCESTER heroes (docs/research/gloucester.md — photo-verified) ----------

// parametric light tower: Cape Ann has five (Eastern Point, Ten Pound, Annisquam,
// and the Thacher twins — both OSM ways carry the same name, so one entry lights both)
function lightTower(buckets: Bucket[], b: Building, g: number,
  o: { h: number; r: number; body: string; cap?: string; taper?: boolean }) {
  const [cx, cz] = centroidOf(b.p);
  const p = buckets[PLAIN];
  if (o.taper !== false) {
    walls(p, octRing(cx, cz, o.r), g - 4, g + o.h * 0.42, o.body, 0);
    walls(p, octRing(cx, cz, o.r * 0.82), g + o.h * 0.42, g + o.h * 0.76, o.body, 0);
    walls(p, octRing(cx, cz, o.r * 0.68), g + o.h * 0.76, g + o.h, o.body, 0);
  } else {
    walls(p, octRing(cx, cz, o.r), g - 4, g + o.h, o.body, 0);
  }
  lanternTop(p, cx, cz, g + o.h, Math.max(2.8, o.r * 0.55), o.cap);
}

// Hammond Castle (1926-29) — mixed-tone granite rubble, cut-stone Gothic openings,
// square tower with a pyramidal slate cap, buff stucco court, drawbridge chains.
function buildHammondCastle(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const p = buckets[PLAIN];
  walls(buckets[BRICK], b.p, g - 10, g + 52, '#8d867b');                 // granite rubble body (brick grain reads as coursing)
  walls(p, expandRing(b.p, 0.4), g + 49, g + 52, '#79736a', 0);          // parapet band
  flatRoof(p, b.p, g + 52, '#5b6066');                                   // slate-dark roof deck
  archWindows(p, b.p, g + 16, 24, 16, 5);                                // tall pointed Gothic windows
  // buff stucco solarium court rises above one half of the bar (rotBox takes HALF-extents)
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  rotBox(p, obb.cx - ca * obb.hl * 0.45, obb.cz - sa * obb.hl * 0.45, obb.hl * 0.38, obb.hw * 0.85, g + 52, g + 66, obb.ang, '#cdbd9f');
  rotBox(p, obb.cx - ca * obb.hl * 0.45, obb.cz - sa * obb.hl * 0.45, obb.hl * 0.4, obb.hw * 0.9, g + 66, g + 69, obb.ang, '#6d727a');
  // the great square tower at the seaward end, pyramidal slate cap + turret
  const tx = obb.cx + ca * obb.hl * 0.62, tz = obb.cz + sa * obb.hl * 0.62;
  rotBox(buckets[BRICK], tx, tz, 18, 18, g - 6, g + 95, obb.ang, '#847d72');
  rotBox(p, tx, tz, 19.5, 19.5, g + 92, g + 95, obb.ang, '#79736a');
  tmp.set('#4e535a');
  cone(p, tx, g + 95, tz, 24, 18, tmp.clone());
  const rx = obb.cx - ca * obb.hl * 0.7, rz = obb.cz - sa * obb.hl * 0.7;
  walls(p, octRing(rx, rz, 6), g, g + 64, '#847d72', 0);                 // round turret
  tmp.set('#4e535a'); cone(p, rx, g + 64, rz, 7, 10, tmp.clone());
  // gatehouse: pointed-arch door, drawbridge deck + iron chains
  const f = heroFront(b, index, {});
  tmp.set('#d9d2c2');
  p.quad(f.x - f.tx * 6 + f.nx * 0.6, g, f.z - f.tz * 6 + f.nz * 0.6, f.x + f.tx * 6 + f.nx * 0.6, g, f.z + f.tz * 6 + f.nz * 0.6,
    f.x + f.tx * 6 + f.nx * 0.6, g + 20, f.z + f.tz * 6 + f.nz * 0.6, f.x - f.tx * 6 + f.nx * 0.6, g + 20, f.z - f.tz * 6 + f.nz * 0.6,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b);                                 // pale cut-stone surround
  tmp.set('#3a3026');
  p.quad(f.x - f.tx * 4 + f.nx * 0.9, g, f.z - f.tz * 4 + f.nz * 0.9, f.x + f.tx * 4 + f.nx * 0.9, g, f.z + f.tz * 4 + f.nz * 0.9,
    f.x + f.tx * 4 + f.nx * 0.9, g + 16, f.z + f.tz * 4 + f.nz * 0.9, f.x - f.tx * 4 + f.nx * 0.9, g + 16, f.z - f.tz * 4 + f.nz * 0.9,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b);                                 // dark wood door
  rotBox(p, f.x + f.nx * 8, f.z + f.nz * 8, 6.5, 5, g - 0.5, g + 1, Math.atan2(f.tz, f.tx), '#4c4034');   // drawbridge deck
  for (const s of [-1, 1]) {                                             // chains angling up the wall
    rotBox(p, f.x + f.tx * 5.5 * s + f.nx * 5, f.z + f.tz * 5.5 * s + f.nz * 5, 0.3, 4.8, g + 8, g + 9, Math.atan2(f.nz, f.nx), '#2c2c30');
  }
}

// Our Lady of Good Voyage (1915) — cream stucco, chocolate trim, twin towers with
// royal-blue onion domes + gold crosses, the schooner-holding Madonna between them.
function buildGoodVoyage(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const p = buckets[PLAIN];
  const obb = obbOf(b.p);
  walls(p, b.p, g - 4, g + 34, '#e9ddc4', 0);                            // cream stucco nave
  walls(p, expandRing(b.p, 0.3), g + 31, g + 34, '#5d4a38', 0);          // chocolate cornice
  gableRoof(buckets[SHINGLE], p, b.p, obb, g + 34, 10, 2, '#b6b3aa', '#5d4a38');   // pale gray shingle
  archWindows(p, b.p, g + 10, 16, 14, 3.5);
  const f = heroFront(b, index, {});
  const ang = Math.atan2(f.tz, f.tx);
  for (const s of [-1, 1]) {                                             // twin square towers
    const txx = f.x + f.tx * 11 * s, tzz = f.z + f.tz * 11 * s;
    rotBox(p, txx, tzz, 8, 8, g - 2, g + 56, ang, '#e9ddc4');
    rotBox(p, txx, tzz, 8.6, 8.6, g + 40, g + 43, ang, '#5d4a38');       // belt course
    rotBox(p, txx, tzz, 7, 7, g + 56, g + 62, ang, '#4c4038');           // open belfry (dark)
    tmp.set('#2b4f9e');                                                  // royal-blue onion dome
    cone(p, txx, g + 62, tzz, 6.4, 4, tmp.clone());
    cone(p, txx, g + 65, tzz, 4.2, 8, tmp.clone());
    p.box(txx, tzz, 0.6, 0.6, g + 73, g + 77, '#c9a227');                // gold cross
    rotBox(p, txx, tzz, 2.4, 0.6, g + 75, g + 75.6, ang, '#c9a227');
  }
  rotBox(p, f.x, f.z, 10, 3, g + 38, g + 46, ang, '#e9ddc4');            // scrolled center gable
  p.box(f.x + f.nx * 1.2, f.z + f.nz * 1.2, 2.6, 2.6, g + 46, g + 58, '#f4f1e8');   // the Madonna (white, holding her schooner)
  p.box(f.x + f.nx * 3.4, f.z + f.nz * 3.4, 3.2, 1, g + 51, g + 52.4, '#f4f1e8');
  for (const s of [-1, 0, 1]) {                                          // three blue doors
    tmp.set('#2b4f9e');
    p.quad(f.x + f.tx * (7 * s - 2.2) + f.nx * 0.8, g, f.z + f.tz * (7 * s - 2.2) + f.nz * 0.8,
      f.x + f.tx * (7 * s + 2.2) + f.nx * 0.8, g, f.z + f.tz * (7 * s + 2.2) + f.nz * 0.8,
      f.x + f.tx * (7 * s + 2.2) + f.nx * 0.8, g + 9, f.z + f.tz * (7 * s + 2.2) + f.nz * 0.8,
      f.x + f.tx * (7 * s - 2.2) + f.nx * 0.8, g + 9, f.z + f.tz * (7 * s - 2.2) + f.nz * 0.8,
      f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b);
  }
}

// Gloucester City Hall (1870, Second Empire) — red brick + cream trim, slate corner
// pavilions, central clock tower with a DULL BROWN oxidized copper dome (not verdigris).
function buildGloucesterCityHall(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const p = buckets[PLAIN];
  const obb = obbOf(b.p);
  walls(p, b.p, g - 6, g + 2, '#8f8b82', 0);                             // granite basement
  walls(buckets[BRICK], b.p, g + 2, g + 46, '#9c4d3c');
  walls(p, expandRing(b.p, 0.3), g + 43, g + 46, '#e8ddc0', 0);          // cream bracketed cornice
  facades(p, b.p, g + 46, 2, 1870, false, true, false, g, 40);
  mansardRoof(buckets[SHINGLE], p, obb, g + 46, 2, '#565b63');
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  for (const sl of [-1, 1]) for (const sw of [-1, 1]) {                  // corner pavilions
    const px2 = obb.cx + ca * obb.hl * 0.82 * sl - sa * obb.hw * 0.82 * sw;
    const pz2 = obb.cz + sa * obb.hl * 0.82 * sl + ca * obb.hw * 0.82 * sw;
    tmp.set('#565b63');
    cone(p, px2, g + 46 + 8, pz2, 7, 9, tmp.clone());
    rotBox(buckets[BRICK], px2, pz2, 10, 10, g + 44, g + 54, obb.ang, '#9c4d3c');
  }
  const f = heroFront(b, index, {});
  const ang = Math.atan2(f.tz, f.tx);
  const txx = f.x - f.nx * 2, tzz = f.z - f.nz * 2;
  rotBox(buckets[BRICK], txx, tzz, 12, 12, g + 46, g + 80, ang, '#9c4d3c');   // tower: brick stages
  rotBox(p, txx, tzz, 10.5, 10.5, g + 80, g + 102, ang, '#e8ddc0');           // cream wood stages
  for (const s of [0, 1, 2, 3]) {                                             // white clock faces
    const fa = ang + s * Math.PI / 2;
    p.box(txx + Math.cos(fa) * 5.6, tzz + Math.sin(fa) * 5.6, 0.4, 3.6, g + 90, g + 97.2, '#f6f3ea');
  }
  rotBox(p, txx, tzz, 11.5, 11.5, g + 102, g + 104, ang, '#e8ddc0');
  tmp.set('#6b4f3a');                                                        // oxidized-brown copper dome — the trap
  cone(p, txx, g + 104, tzz, 8, 12, tmp.clone());
  p.box(txx, tzz, 0.4, 0.4, g + 116, g + 121, '#2c2c30');                    // weathervane
  porticoFront(p, f, g, 14, '#e8ddc0');
}

// Motif No. 1 (1884, rebuilt to an exact replica in 1978) — "the most-painted
// building in America". PHOTO-VERIFIED, docs/research/rockport-manchester.md:
// the silhouette is TWO volumes, not one — a taller gable-FRONT block at the
// harbor end (brick ridge chimney, white gable window, big red double doors)
// and a lower side-gable wing running inland, whose seaward wall carries the
// famous hanging lobster buoys. Vertical board siding in a medium barn red that
// still reads *red* after wallDarken; weathered silver-gray shingle roofs.
const MOTIF_RED = '#c65039';        // reads red in game; #6e2f28 rendered near-black
const MOTIF_ROOF = '#b0b3b2';       // weathered silver-gray wood shingle (cool, not tan — the shingle texture warms it)
function buildMotif(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const p = buckets[PLAIN];
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  // Which end is the harbor? Probe open water off both ends of the long axis —
  // the gable front faces the water on Bradley Wharf, whichever way OSM wound it.
  const probe = (s: number) => {
    let wet = 0;
    for (let d = 30; d <= 150; d += 20) {
      if (index.isWaterAt(obb.cx + ca * (obb.hl + d) * s, obb.cz + sa * (obb.hl + d) * s)) wet++;
    }
    return wet;
  };
  const sea = probe(1) >= probe(-1) ? 1 : -1;      // +1 = the +l end faces open water
  const frontL = obb.hl * 0.34;                     // the tall block takes the seaward third

  // the long low wing (whole footprint) — its ridge sits below the front block's.
  // PLAIN, not CLAP: the real siding is vertical BOARD, and the clapboard texture
  // knocks ~20% off the value, which is half of why the old build read black.
  walls(buckets[PLAIN], b.p, g - 8, g + 20, MOTIF_RED, 0);
  gableRoof(buckets[SHINGLE], buckets[PLAIN], b.p, obb, g + 20, 8, 2.5, MOTIF_ROOF, MOTIF_RED);

  // the taller gable-front block at the harbor end
  const fx = obb.cx + ca * (obb.hl - frontL) * sea, fz = obb.cz + sa * (obb.hl - frontL) * sea;
  const front: OBB = { cx: fx, cz: fz, ang: obb.ang, hl: frontL, hw: obb.hw };
  const fRing = [
    fx + ca * frontL - sa * obb.hw, fz + sa * frontL + ca * obb.hw,
    fx + ca * frontL + sa * obb.hw, fz + sa * frontL - ca * obb.hw,
    fx - ca * frontL + sa * obb.hw, fz - sa * frontL - ca * obb.hw,
    fx - ca * frontL - sa * obb.hw, fz - sa * frontL + ca * obb.hw,
  ];
  walls(buckets[PLAIN], fRing, g - 8, g + 31, MOTIF_RED, 0);
  gableRoof(buckets[SHINGLE], buckets[PLAIN], fRing, front, g + 31, 11, 2.5, MOTIF_ROOF, MOTIF_RED);
  buckets[BRICK].box(fx - ca * frontL * 0.5 * sea, fz - sa * frontL * 0.5 * sea, 2, 2, g + 31, g + 42, '#8a4a3c');

  // the seaward gable face: white multipane window up high, red double doors below
  // (rotBox so the trim lies FLAT on the rotated wall — an axis-aligned box would
  // stick out of a 43°-skewed facade as a lump)
  const gx = fx + ca * (frontL + 0.5) * sea, gz = fz + sa * (frontL + 0.5) * sea;
  rotBox(p, gx, gz, 0.5, 3.4, g + 22, g + 29, obb.ang, '#f2efe6');       // the loft window
  rotBox(p, gx, gz, 0.5, 2.6, g + 23, g + 28, obb.ang, '#3c4a52');       // its dark panes
  rotBox(p, gx, gz, 0.5, 5.4, g - 2, g + 15, obb.ang, '#8e3226');        // the big red cargo doors
  rotBox(p, gx, gz, 0.6, 5.8, g + 15, g + 16.2, obb.ang, '#f2efe6');     // white door head

  // THE BUOY WALL — vertical clusters of lobster buoys on the long seaward face
  // of the wing. Mostly white/cream with orange, red, yellow and a little blue.
  const nx = -sa, nz = ca;
  const side = index.isWaterAt(obb.cx + nx * (obb.hw + 60), obb.cz + nz * (obb.hw + 60)) ? 1 : -1;
  const BUOYS = ['#f4f1e8', '#e8762e', '#f4f1e8', '#b23a2e', '#e8b93a', '#f4f1e8', '#2b4f9e', '#f4f1e8', '#e8762e', '#f4f1e8', '#b23a2e', '#e8b93a', '#f4f1e8', '#e8762e'];
  const N = 22;                                                          // dozens of them, hung small and dense
  for (let i = 0; i < N; i++) {
    const l0 = -obb.hl * 0.92 + (i / (N - 1)) * obb.hl * 1.16;           // stop short of the front block
    const bx = obb.cx + ca * l0 + nx * side * (obb.hw + 0.9);
    const bz = obb.cz + sa * l0 + nz * side * (obb.hw + 0.9);
    const y = g + 2 + (i % 3) * 4.5;
    p.box(bx, bz, 1.15, 1.15, y, y + 3, BUOYS[i % BUOYS.length]);        // the float
    p.box(bx, bz, 0.35, 0.35, y + 3, y + 5.2, '#5a4a38');                // its wooden spindle
  }

  // Bradley Wharf: weathered timber fender piles along the water edge — short
  // stubs standing just proud of the granite, not a picket line of black posts
  for (let i = -3; i <= 3; i++) {
    const l0 = i * obb.hl * 0.3;
    p.box(obb.cx + ca * l0 + nx * side * (obb.hw + 8), obb.cz + sa * l0 + nz * side * (obb.hw + 8),
      1.3, 1.3, g - 16, g - 1, '#8a7358');
  }
}

// ---------- shared New England meetinghouse (Rockport + Manchester) ----------

// The white-clapboard gable-front meetinghouse with a stacked tower is THE North
// Shore silhouette, and the towns differ only in what each stage is: the Old
// Sloop tops out in a ROUND columned lantern under a green copper dome, First
// Parish Manchester in an OCTAGONAL one, Rockport's Universalist in a dark
// Gothic spire. One parametric builder, three photo-verified recipes.
type MeetingOpts = {
  wall?: string; trim?: string; roof?: string;
  clock?: 'black' | 'gold' | null;      // clock stage face color (null = no clock stage)
  balustrade?: boolean;                 // open railed stage above the clock
  belfry?: 'round' | 'octagon' | 'square' | null;
  cap: 'dome' | 'spire';
  capHex?: string;                      // green copper dome / dark shingled spire
  towerH?: number;                      // shaft top above ground (px)
};
function meetinghouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex, o: MeetingOpts) {
  const wall = o.wall ?? '#f7f4ea', trim = o.trim ?? '#fdfbf2';
  const p = buckets[PLAIN];
  const obb = obbOf(b.p);
  walls(buckets[CLAP], b.p, g - 6, g + 34, wall);
  complexGable(buckets[SHINGLE], buckets[CLAP], b.p, g + 34, o.roof ?? '#54514c', wall);
  houseTrim(p, b.p, g + 34, g - 6);
  facades(p, b.p, g + 34, 2, Math.round(obb.cx * 7 + obb.cz * 13), true, false, false, g, 60, '#1e2124');
  buckets[BRICK].box(obb.cx - Math.cos(obb.ang) * obb.hl * 0.8, obb.cz - Math.sin(obb.ang) * obb.hl * 0.8,
    2, 2, g + 34, g + 48, '#8a5240');                                    // rear chimney

  // the tower rises from the front gable end, inset into the roof
  const f = frontSegment(b, index);
  const tx = f.x - f.nx * 9, tz = f.z - f.nz * 9;
  const s1 = 6.4;
  // the shaft must clear the ridge with room to spare — these steeples are sea
  // marks, and a tower that only just tops the roof reads as a cupola
  let y = g + (o.towerH ?? 74);
  walls(buckets[CLAP], [tx - s1, tz - s1, tx + s1, tz - s1, tx + s1, tz + s1, tx - s1, tz + s1], g - 2, y, wall);
  p.box(tx, tz, s1 + 0.4, s1 + 0.4, y - 2, y, trim);                     // shaft cornice

  if (o.clock) {                                                          // square clock stage
    p.box(tx, tz, s1 - 0.5, s1 - 0.5, y, y + 15, wall);
    const face = o.clock === 'black' ? '#22242a' : '#c9a340';
    const hand = o.clock === 'black' ? '#e8e2cc' : '#22242a';
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      p.box(tx + dx * (s1 + 0.1), tz + dz * (s1 + 0.1), dx ? 0.4 : 4.2, dz ? 0.4 : 4.2, y + 3.5, y + 12, face);
      p.box(tx + dx * (s1 + 0.5), tz + dz * (s1 + 0.5), dx ? 0.3 : 0.5, dz ? 0.3 : 0.5, y + 7.4, y + 10.6, hand);   // the hands, thin
      p.box(tx + dx * (s1 + 0.5), tz + dz * (s1 + 0.5), dx ? 0.3 : 1.7, dz ? 0.3 : 1.7, y + 7.4, y + 8, hand);
    }
    p.box(tx, tz, s1 + 0.6, s1 + 0.6, y + 15, y + 16.6, trim);           // cornice over the clock
    y += 16.6;
  }
  if (o.balustrade) {                                                     // open railed stage with corner urns
    const r = s1 + 0.2;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      p.box(tx + dx * r, tz + dz * r, dx ? 0.4 : r, dz ? 0.4 : r, y, y + 4.6, trim);
    }
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]] as const) {
      p.box(tx + dx * r, tz + dz * r, 0.9, 0.9, y, y + 7.5, trim);       // urn posts
    }
    y += 4.6;
  }
  if (o.belfry) {                                                         // the open columned lantern
    const belR = 5.6, h = 14;
    const ring = o.belfry === 'square'
      ? [tx - belR, tz - belR, tx + belR, tz - belR, tx + belR, tz + belR, tx - belR, tz + belR]
      : octRing(tx, tz, belR);
    walls(p, ring, y, y + 1.6, trim, 0);                                  // lantern floor
    const n = o.belfry === 'round' ? 8 : o.belfry === 'octagon' ? 8 : 4;
    for (let i = 0; i < n; i++) {                                         // columns + dark open bays between
      const a = (i / n) * Math.PI * 2;
      p.box(tx + Math.cos(a) * belR, tz + Math.sin(a) * belR, 1, 1, y, y + h, trim);
      const am = ((i + 0.5) / n) * Math.PI * 2;
      p.box(tx + Math.cos(am) * (belR - 0.5), tz + Math.sin(am) * (belR - 0.5), 1.9, 1.9, y + 1.6, y + h - 2, '#2e3138');
    }
    walls(p, o.belfry === 'square' ? ring : octRing(tx, tz, belR + 0.9), y + h, y + h + 2, trim, 0);   // lantern cornice
    y += h + 2;
  }
  if (o.cap === 'dome') {                                                 // green copper dome + finial
    tmp.set(o.capHex ?? '#8cc4a8');                                       // bright verdigris — it darkens in shade
    walls(p, octRing(tx, tz, 5.4), y, y + 2.4, o.capHex ?? '#8cc4a8', 0); // the dome's straight collar
    cone(p, tx, y + 2.4, tz, 5.4, 9, tmp.clone());
    p.box(tx, tz, 0.4, 0.4, y + 10, y + 22, '#d8d4c8');
    p.box(tx, tz, 2.2, 0.25, y + 18, y + 21, '#d8d4c8');                  // weathervane arrow
  } else {                                                                // tapered spire
    tmp.set(o.capHex ?? '#eceadf');
    cone(p, tx, y, tz, 5.8, 38, tmp.clone());
    p.box(tx, tz, 0.4, 0.4, y + 36, y + 48, '#d8d4c8');
  }
}

// ---------- Rockport heroes (docs/research/rockport-manchester.md) ----------

// Rockport Public Library (17 School St) — the 1864 Annisquam Cotton Mill block,
// school in 1904, library since 1993: rough gray ASHLAR GRANITE, two storeys over
// a granite base, wide bracketed eaves, tall white multipane windows, a flagpole.
function rockportLibrary(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const granite = '#9b9992', p = buckets[PLAIN];
  const obb = obbOf(b.p);
  // PLAIN, not BRICK: brickTex bakes real red brick INTO the texture, so a gray
  // tint over it comes out muddy red — granite has to be untextured (buildCustomHouse
  // does the same). Only genuinely-red-brick buildings belong in the BRICK bucket.
  walls(p, b.p, g - 6, g + 6, '#84837d', 0);                              // heavier base course
  walls(p, b.p, g + 6, g + 44, granite, 0);
  walls(p, expandRing(b.p, 1.6), g + 41, g + 44, '#e6e2d6', 0);           // the wide overhanging eave
  for (let i = 0; i < b.p.length; i += 2) {                               // eave brackets
    p.box(b.p[i], b.p[i + 1], 1.1, 1.1, g + 36, g + 41, '#e6e2d6');
  }
  gableRoof(buckets[SHINGLE], buckets[PLAIN], b.p, obb, g + 44, 8, 3.5, '#5a5854', granite);
  facades(p, b.p, g + 44, 2, 5171, true, false, false, g, 90, '#5b3a24');
  const f = frontSegment(b, index);
  p.box(f.x + f.nx * 8, f.z + f.nz * 8, 0.5, 0.5, g, g + 34, '#e6e2d6');  // flagpole
  buckets[GLOW].box(f.x + f.nx * 8 + 3, f.z + f.nz * 8, 3, 0.2, g + 27, g + 32, '#b03030', 0);
}

// Rockport Carnegie Library (1907, 18 Jewett St) — locally quarried BI-COLOR
// granite, Greek Revival, terrazzo floor under a dome. A library until 1993,
// a private house since. Verified by description only: block + dome, no finer.
function carnegieLibrary(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const p = buckets[PLAIN], obb = obbOf(b.p);
  walls(p, b.p, g - 5, g + 8, '#8d8a80', 0);                              // the darker granite course
  walls(p, b.p, g + 8, g + 30, '#adaa9d', 0);                             // the lighter one — "bi-color"
  walls(p, expandRing(b.p, 0.8), g + 27, g + 30.5, '#d8d4c6', 0);         // Greek Revival entablature
  flatRoof(p, b.p, g + 30.5, '#6a6862');
  facades(p, b.p, g + 30, 1, 907, true, false, false, g, 40, '#5b3a24');
  tmp.set('#b8b4a6');
  cone(p, obb.cx, g + 30.5, obb.cz, Math.min(obb.hw * 0.7, 11), 9, tmp.clone());   // the low dome
  const f = frontSegment(b, index);                                       // two columns at the door
  for (const s of [-1, 1]) p.box(f.x + f.tx * 3.4 * s + f.nx * 3, f.z + f.tz * 3.4 * s + f.nz * 3, 1.1, 1.1, g, g + 15, '#d8d4c6');
  rotBox(p, f.x + f.nx * 3, f.z + f.nz * 3, 4.6, 3, g + 15, g + 17, Math.atan2(f.tz, f.tx), '#d8d4c6');
}

// Shalin Liu Performance Center (2010) — a 335-seat hall behind a replica of the
// 1860s Second Empire street facade. PHOTO-VERIFIED: cream storefront base under a
// big RED-ORANGE awning, a gray-mauve clapboard middle storey with cream pilasters
// and red-orange French doors on white balconets, then a gray slate MANSARD with
// three arch-hooded dormers. (OSM spells it "Perfomance" — see HEROES.)
function shalinLiu(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const p = buckets[PLAIN], obb = obbOf(b.p);
  const MAUVE = '#8b8189', CREAM = '#f2ece0', DOOR = '#d8492a', SLATE = '#4a5560';
  const f = obbFront(b, index);
  const fa = f.ang;
  walls(buckets[PLAIN], b.p, g - 4, g + 20, CREAM, 0);                    // glassy storefront base
  walls(buckets[CLAP], b.p, g + 20, g + 44, MAUVE);                       // the mauve middle storey
  facades(p, b.p, g + 20, 1, 2010, false, false, true, g, 40);
  // pilasters at the corners of the front + between bays
  for (const t of [-1, -0.34, 0.34, 1]) {
    p.box(f.x + f.tx * Math.min(f.half, 30) * 0.92 * t + f.nx * 0.5, f.z + f.tz * Math.min(f.half, 30) * 0.92 * t + f.nz * 0.5, 1.4, 1.4, g + 19, g + 45, CREAM);
  }
  // the three French doors + white balconets on the middle storey
  for (const t of [-0.62, 0, 0.62]) {
    const bx = f.x + f.tx * Math.min(f.half, 30) * 0.6 * (t / 0.62) + f.nx * 0.5, bz = f.z + f.tz * Math.min(f.half, 30) * 0.6 * (t / 0.62) + f.nz * 0.5;
    rotBox(p, bx, bz, 2.1, 0.4, g + 24, g + 40, fa, DOOR);
    rotBox(p, bx + f.nx * 1.1, bz + f.nz * 1.1, 2.6, 0.6, g + 24, g + 27, fa, CREAM);
  }
  // THE AWNING — red-orange, full width, right under the middle storey
  rotBox(p, f.x + f.nx * 2.2, f.z + f.nz * 2.2, Math.min(f.half, 30) * 0.96, 2.4, g + 17.5, g + 20, fa, DOOR);
  // the slate mansard, with three arch-hooded dormers on the front slope
  mansardRoof(buckets[SHINGLE], p, obb, g + 45, 2, SLATE);
  walls(p, expandRing(b.p, 0.7), g + 44, g + 45.6, CREAM, 0);             // bracketed cornice
  for (const t of [-0.62, 0, 0.62]) {
    const dx = f.x + f.tx * Math.min(f.half, 30) * 0.6 * (t / 0.62) + f.nx * 0.5, dz = f.z + f.tz * Math.min(f.half, 30) * 0.6 * (t / 0.62) + f.nz * 0.5;
    rotBox(p, dx, dz, 2.9, 1.2, g + 47, g + 60, fa, CREAM);               // dormer surround
    rotBox(p, dx + f.nx * 0.5, dz + f.nz * 0.5, 2.1, 0.5, g + 48, g + 58, fa, DOOR);   // its red door
    tmp.set(CREAM);
    cone(p, dx, g + 60, dz, 3.1, 2.6, tmp.clone());                       // the arched hood
  }
}

// ---------- Manchester-by-the-Sea heroes (docs/research/rockport-manchester.md) ----------

// A front derived from the building's OWN oriented box rather than from whichever
// wall segment happens to face a road. heroFront/frontSegment fall back to the
// CENTROID when no long road-facing segment is found — which buries a portico or
// a pediment inside the building. This picks the OBB face whose outward normal
// best matches the road-facing normal, so a temple front always lands on a real
// facade, at that facade's real half-width.
function obbFront(b: Building, index: WorldIndex):
    { x: number; z: number; tx: number; tz: number; nx: number; nz: number; half: number; ang: number } {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const fs = frontSegment(b, index);
  // the four OBB faces: ±length ends (half = hw) and ±width sides (half = hl)
  const faces = [
    { nx: ca, nz: sa, ex: obb.hl, half: obb.hw, tx: -sa, tz: ca },
    { nx: -ca, nz: -sa, ex: obb.hl, half: obb.hw, tx: sa, tz: -ca },
    { nx: -sa, nz: ca, ex: obb.hw, half: obb.hl, tx: ca, tz: sa },
    { nx: sa, nz: -ca, ex: obb.hw, half: obb.hl, tx: -ca, tz: -sa },
  ];
  let best = faces[0], bestDot = -Infinity;
  for (const f of faces) {
    const d = f.nx * fs.nx + f.nz * fs.nz;
    if (d > bestDot) { bestDot = d; best = f; }
  }
  // Anchor on the REAL road-facing wall when one was found (fs.len > 0) — on an
  // L-shaped footprint the OBB face can float in the notch, which would hang the
  // portico in mid-air. Keep the OBB's axes so the trim stays square to the box.
  const onWall = fs.len > 0;
  const proj = onWall ? (fs.x - obb.cx) * best.tx + (fs.z - obb.cz) * best.tz : 0;
  return {
    x: obb.cx + best.nx * best.ex + best.tx * proj,
    z: obb.cz + best.nz * best.ex + best.tz * proj,
    tx: best.tx, tz: best.tz, nx: best.nx, nz: best.nz,
    half: onWall ? Math.min(best.half, fs.len / 2) : best.half,
    ang: Math.atan2(best.tz, best.tx),
  };
}

// Manchester-by-the-Sea Town Hall (1868) — PHOTO-VERIFIED Greek Revival temple
// front: WHITEWASHED BRICK (cream-white with the red brick ghosting through),
// four massive square brick piers under a big pediment with a semicircular
// fanlight, dark GREEN double doors, granite steps.
function manchesterTownHall(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const p = buckets[PLAIN], obb = obbOf(b.p);
  const LIME = '#f0e9dc', TRIM = '#f7f2e6', GREEN = '#1f3a2e';
  const eaveH = g + 44;
  walls(p, b.p, g - 4, eaveH, LIME, 0);                                   // whitewashed brick — PLAIN, or brickTex's baked red shows straight through
  walls(p, expandRing(b.p, 0.5), eaveH - 2, eaveH + 0.4, TRIM, 0);        // entablature
  gableRoof(buckets[SHINGLE], p, b.p, obb, eaveH, 12, 3.5, '#6f6c66', LIME);
  facades(p, b.p, eaveH, 2, 1868, false, false, false, g, 60);
  const f = obbFront(b, index), fa = f.ang, W = Math.min(f.half, 26);
  // the four colossal piers, standing proud of the wall under the pediment
  for (const t of [-1, -0.34, 0.34, 1]) {
    const px = f.x + f.tx * W * 0.82 * t + f.nx * 5, pz = f.z + f.tz * W * 0.82 * t + f.nz * 5;
    p.box(px, pz, 2.4, 2.4, g, eaveH - 2, LIME);
  }
  rotBox(p, f.x + f.nx * 5, f.z + f.nz * 5, W * 0.95, 2.8, eaveH - 2, eaveH + 1.6, fa, TRIM);   // architrave
  // the front pediment + its semicircular fanlight
  tmp.set(TRIM);
  p.triUV(f.x - f.tx * W + f.nx * 5.2, eaveH + 1.6, f.z - f.tz * W + f.nz * 5.2,
    f.x + f.tx * W + f.nx * 5.2, eaveH + 1.6, f.z + f.tz * W + f.nz * 5.2,
    f.x + f.nx * 5.2, eaveH + 17, f.z + f.nz * 5.2, f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
  for (let i = 0; i < 5; i++) {                                           // fanlight in the tympanum
    const a = Math.PI * (i + 0.5) / 5;
    p.box(f.x + f.tx * Math.cos(a) * 4 + f.nx * 5.6, f.z + f.tz * Math.cos(a) * 4 + f.nz * 5.6,
      1, 1, eaveH + 4, eaveH + 4 + Math.sin(a) * 4.5, '#3c4a52');
  }
  rotBox(p, f.x + f.nx * 0.5, f.z + f.nz * 0.5, 3.4, 0.5, g, g + 16, fa, GREEN);        // green double doors
  rotBox(p, f.x + f.nx * 3.4, f.z + f.nz * 3.4, 5.2, 3.2, g - 2, g + 0.8, fa, '#a8a49a');   // granite steps
}

// ---------- Amesbury + Salisbury heroes (docs/research/amesbury-salisbury.md) ----------

// A flat round-arched opening lying ON a facade plane: a rectangular shaft with
// a TRUE semicircular head drawn as a triangle fan. Stepping little boxes around
// the curve (the first attempt) reads as a staircase at play distance — the
// whole point of a Romanesque front is the clean half-circle.
// (cx,cz) is the springing-line centre; (tx,tz) runs along the wall, (nx,nz) is
// the outward normal, hw is the half-width = the arch radius.
function roundArch(p: Bucket, cx: number, cz: number, tx: number, tz: number,
                   nx: number, nz: number, hw: number, y0: number, yTop: number, hex: string) {
  tmp.set(hex);
  const r = tmp.r, gg = tmp.g, bb = tmp.b;
  p.quad(cx - tx * hw, y0, cz - tz * hw, cx + tx * hw, y0, cz + tz * hw,
    cx + tx * hw, yTop, cz + tz * hw, cx - tx * hw, yTop, cz - tz * hw, nx, 0, nz, r, gg, bb);
  const N = 12;
  for (let i = 0; i < N; i++) {
    const a0 = Math.PI * i / N, a1 = Math.PI * (i + 1) / N;
    p.triUV(cx, yTop, cz,
      cx + tx * Math.cos(a0) * hw, yTop + Math.sin(a0) * hw, cz + tz * Math.cos(a0) * hw,
      cx + tx * Math.cos(a1) * hw, yTop + Math.sin(a1) * hw, cz + tz * Math.cos(a1) * hw,
      nx, 0, nz, r, gg, bb, 0, 0, 0, 0, 0, 0);
  }
}

// Amesbury Town Hall — PHOTO-VERIFIED. OSM says "Amesbury City Hall" (the town
// became a city in 1996) but the building's own sign says TOWN HALL. Deep
// red-orange brick, flat roof behind a corbelled parapet, and a front of THREE
// GREAT ARCHES: two enormous round-arched windows flanking an arched entry, with
// the black-and-gold sign board over the door.
function amesburyTownHall(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const p = buckets[PLAIN];
  const BRICK_HEX = '#fdfaf6';      // near-white TINT — brickTex already carries the red
  const STONE = '#d9d4c6', SASH = '#f4f1e8';
  const eaveH = g + 46;
  walls(buckets[BRICK], b.p, g - 4, eaveH, BRICK_HEX);
  walls(buckets[BRICK], expandRing(b.p, 0.6), eaveH - 4, eaveH, BRICK_HEX, 1);   // corbelled parapet course
  walls(p, expandRing(b.p, 0.9), eaveH, eaveH + 1.4, STONE, 0);
  flatRoof(p, b.p, eaveH + 1.4, '#4c4a47');
  facades(p, b.p, eaveH, 2, 1890, false, false, false, g, 70);
  const f = obbFront(b, index), fa = f.ang, W = Math.min(f.half, 30);
  // THE THREE GREAT ARCHES across the front: two big windows flanking the entry
  for (const [t, half, y0, y1, fill] of [[-1, 0.30, 14, 32, SASH], [1, 0.30, 14, 32, SASH], [0, 0.21, 0, 24, '#2b2f36']] as const) {
    const ax = f.x + f.tx * W * 0.62 * t, az = f.z + f.tz * W * 0.62 * t;
    const hw = W * half;
    // pale stone surround, then the glass/door recessed a hair further out
    roundArch(p, ax + f.nx * 0.5, az + f.nz * 0.5, f.tx, f.tz, f.nx, f.nz, hw + 1.4, g + y0, g + y1, STONE);
    roundArch(p, ax + f.nx * 0.9, az + f.nz * 0.9, f.tx, f.tz, f.nx, f.nz, hw, g + y0 + 1, g + y1, fill);
  }
  // the black-and-gold AMESBURY TOWN HALL sign board over the entry arch
  rotBox(p, f.x + f.nx * 1.2, f.z + f.nz * 1.2, 0.6, W * 0.26, g + 27, g + 33, fa, '#1c1d20');
  rotBox(p, f.x + f.nx * 1.6, f.z + f.nz * 1.6, 0.5, W * 0.20, g + 29, g + 31.4, fa, '#c8a24a');   // gold lettering band
  rotBox(p, f.x + f.nx * 3, f.z + f.nz * 3, 4.4, 2.6, g - 2, g + 1, fa, '#a8a49a');    // granite steps
  const obb = obbOf(b.p);                                              // one end chimney
  buckets[BRICK].box(obb.cx - Math.cos(obb.ang) * obb.hl * 0.82, obb.cz - Math.sin(obb.ang) * obb.hl * 0.82,
    2.2, 2.2, eaveH, eaveH + 12, BRICK_HEX, 1);
}

// Josiah Bartlett Museum (1870) — PHOTO-VERIFIED Italianate: pale cream
// clapboard, a low hipped roof on WIDE bracketed eaves, RED window casings and a
// red water table, and a round-arched paired window over a bracketed porch.
// The paired eave brackets are the tell — without them it is a hip-roofed box.
function bartlettMuseum(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const p = buckets[PLAIN], obb = obbOf(b.p);
  const CREAM = '#ded6bc', RED = '#8e2f28', TRIM = '#f2ece0';
  const eaveH = g + 40;
  clad(buckets[CLAP], b.p, g - 2, eaveH, CREAM);
  walls(p, expandRing(b.p, 0.5), g + 0.5, g + 4, RED, 0);                // the red water table
  walls(p, expandRing(b.p, 1.8), eaveH - 1.5, eaveH + 1.2, TRIM, 0);     // the deep overhanging eave
  walls(p, expandRing(b.p, 0.8), eaveH - 3.4, eaveH - 1.5, RED, 0);      // red cornice band under it
  // paired scroll brackets under the eave, all the way round
  const v = ringToVec2(b.p);
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b2 = v[(i + 1) % v.length];
    const ex = b2.x - a.x, ey = b2.y - a.y, len = Math.hypot(ex, ey);
    for (let d = 6; d < len - 4; d += 13) {
      for (const off of [-1.4, 1.4]) {
        const t = (d + off) / len;
        p.box(a.x + ex * t, a.y + ey * t, 1, 1, eaveH - 6, eaveH - 1.4, TRIM);
      }
    }
  }
  hipRoof(buckets[SHINGLE], obb, eaveH + 1.2, 7, 2, '#4e4b46', false);
  facades(p, b.p, eaveH, 2, 1870, true, false, false, g, 60, '#5b3a24', RED);
  const f = obbFront(b, index), fa = f.ang;
  // the arched paired window over a bracketed entry porch
  rotBox(p, f.x + f.nx * 0.5, f.z + f.nz * 0.5, 0.5, 3.4, g + 24, g + 36, fa, RED);
  rotBox(p, f.x + f.nx * 0.8, f.z + f.nz * 0.8, 0.5, 2.6, g + 25, g + 35, fa, '#38414a');
  for (const s of [-1, 1]) p.box(f.x + f.tx * 3.4 * s + f.nx * 4, f.z + f.tz * 3.4 * s + f.nz * 4, 1.1, 1.1, g, g + 17, TRIM);
  rotBox(p, f.x + f.nx * 4, f.z + f.nz * 4, 4.6, 3.2, g + 17, g + 19.4, fa, TRIM);
  buckets[BRICK].box(obb.cx, obb.cz, 2, 2, eaveH + 6, eaveH + 16, '#8a4a3c');
}

// The Whittier Home (86 Friend St, a National Historic Landmark) — PHOTO-VERIFIED:
// white clapboard, DARK GREEN shutters everywhere, two front gable dormers plus a
// shed dormer, two red-brick chimneys, and a small columned entry porch under a
// black WHITTIER HOME sign board.
function whittierHome(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const p = buckets[PLAIN], obb = obbOf(b.p);
  const WHITE = '#f7f4ea', GREEN = '#22402c', ROOF = '#6a6660';
  const eaveH = g + 40;
  clad(buckets[CLAP], b.p, g - 2, eaveH, WHITE);
  gableRoof(buckets[SHINGLE], buckets[CLAP], b.p, obb, eaveH, 13, 2.5, ROOF, WHITE);
  houseTrim(p, b.p, eaveH, g - 2);
  facades(p, b.p, eaveH, 2, 1836, true, true, false, g, 60, GREEN, GREEN);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const f = obbFront(b, index), fa = f.ang;
  // two gable dormers on the front slope
  for (const s of [-1, 1]) {
    const dx = f.x + f.tx * Math.min(f.half, 22) * 0.5 * s - f.nx * 5;
    const dz = f.z + f.tz * Math.min(f.half, 22) * 0.5 * s - f.nz * 5;
    rotBox(p, dx, dz, 3.4, 3, eaveH - 1, eaveH + 9, fa, WHITE);
    rotBox(p, dx + f.nx * 2.4, dz + f.nz * 2.4, 0.4, 1.6, eaveH + 1, eaveH + 7.5, fa, '#38414a');
    tmp.set(ROOF);
    cone(p, dx, eaveH + 9, dz, 3.9, 3.4, tmp.clone());
  }
  for (const s of [-1, 1]) buckets[BRICK].box(obb.cx + ca * obb.hl * 0.66 * s, obb.cz + sa * obb.hl * 0.66 * s, 2.1, 2.1, eaveH + 4, eaveH + 17, '#8a4a3c', 1);
  // the entry porch + its black sign board
  for (const s of [-1, 1]) p.box(f.x + f.tx * 3.2 * s + f.nx * 3.6, f.z + f.tz * 3.2 * s + f.nz * 3.6, 0.9, 0.9, g, g + 15, WHITE);
  rotBox(p, f.x + f.nx * 3.6, f.z + f.nz * 3.6, 4.4, 3, g + 15, g + 17, fa, WHITE);
  rotBox(p, f.x + f.nx * 0.6, f.z + f.nz * 0.6, 0.5, 3, g + 17.4, g + 21, fa, '#1c1d20');
}

// Lowell's Boat Shop (1793) — PHOTO-VERIFIED from across the Merrimack: a barn-RED
// clapboard cluster right at the waterline, a taller block plus a lower wing, and
// DENSE regular rows of white-trimmed windows (the shop floors are lit from both
// sides, so it carries far more glass than a house).
function lowellsBoatShop(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const p = buckets[PLAIN], obb = obbOf(b.p);
  const RED = '#a8402f', TRIM = '#f2efe6';
  const eaveH = g + 40;
  clad(buckets[CLAP], b.p, g - 12, eaveH, RED);                          // walls run down to the water
  gableRoof(buckets[SHINGLE], buckets[CLAP], b.p, obb, eaveH, 11, 2, '#6e6a63', RED);
  walls(p, expandRing(b.p, 0.4), eaveH - 1.4, eaveH + 0.4, TRIM, 0);
  facades(p, b.p, eaveH, 3, 1793, true, false, false, g, 400, '#5b3a24');   // dense glass — 3 rows, big budget
  // timber ways and pilings down into the river on the water side
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang), nx = -sa, nz = ca;
  const side = index.isWaterAt(obb.cx + nx * (obb.hw + 70), obb.cz + nz * (obb.hw + 70)) ? 1 : -1;
  for (let i = -2; i <= 2; i++) {
    const l0 = i * obb.hl * 0.36;
    p.box(obb.cx + ca * l0 + nx * side * (obb.hw + 9), obb.cz + sa * l0 + nz * side * (obb.hw + 9), 1.3, 1.3, g - 18, g + 2, '#6b5a48');
  }
}

// The Powder House — PHOTO-VERIFIED (HABS, 1935). NOT a brick igloo: a round
// whitewashed parged masonry cylinder with a domed top, alone on the hill.
function amesburyPowderHouse(buckets: Bucket[], b: Building, g: number) {
  const p = buckets[PLAIN];
  const [cx, cz] = centroidOf(b.p);
  const PALE = '#ddd8cb';
  const r = Math.max(6, Math.min(11, Math.sqrt(ringAreaPx2(b.p) / Math.PI)));
  walls(p, octRing(cx, cz, r), g - 3, g + 22, PALE, 0);
  tmp.set(PALE);
  cone(p, cx, g + 22, cz, r, r * 1.15, tmp.clone());                     // the dome
  p.box(cx, cz, 1.6, 0.4, g + 1, g + 9, '#4a3f33');                      // the little plank door
}

// All Saints Anglican Cathedral (Amesbury) — PHOTO-VERIFIED red-brick Gothic:
// a steep gable front with a big traceried pointed window, three pointed doors,
// and a square brick tower with a stepped parapet. salemChurch already builds
// exactly this silhouette for Salem's granite Gothic churches — the only change
// is the stone, and brickTex's own red is what makes it read as brick.
// (see HEROES: the key is passed through with a near-white tint)

// The Mary Baker Eddy House / Squire Bagley homestead (277 Main St, Amesbury) —
// PHOTO-VERIFIED and genuinely odd for New England: **dusty PINK clapboard** with
// deep maroon-brown trim on every casing and corner board, dark green shutters on
// the front, a gray shingle GAMBREL roof, a red-brick chimney, and a maroon
// picket fence at the street. The pink is the whole point — don't "correct" it.
function maryBakerEddyHouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const p = buckets[PLAIN], obb = obbOf(b.p);
  const PINK = '#d8b3a6', TRIM = '#5c3129', GREEN = '#22402c';
  gambrelHouse(buckets, b, g, index, {
    wall: PINK, material: 'clap', roof: '#8a857c', trim: TRIM,
    storeys: 2, dormers: 0, chimney: 'ridge2', entrance: 'pediment', shutter: GREEN,
  });
  facades(p, b.p, g + 36, 2, 1870, true, true, false, g, 60, TRIM, GREEN);
  // the maroon picket fence along the street side
  const f = obbFront(b, index);
  const n = 14, W = Math.min(f.half, 24);
  for (let i = 0; i <= n; i++) {
    const t = -1 + (2 * i) / n;
    p.box(f.x + f.tx * W * t + f.nx * 11, f.z + f.tz * W * t + f.nz * 11, 0.5, 0.5, g, g + 7, TRIM);
  }
  rotBox(p, f.x + f.nx * 11, f.z + f.nz * 11, W, 0.4, g + 5.6, g + 6.6, f.ang, TRIM);
}

// A classic New England LUNCH CAR diner — the barrel-vaulted stainless box that
// arrived on a truck. Chubby's (72 Main St, Salisbury) is a Jerry O'Mahony car
// built in 1941; the type is photo-verified from Commons' Pat's Diner, Salisbury.
// White porcelain panels, RED trim bands and posts, a silver barrel roof, and a
// white roof sign board lettered in red.
function dinerCar(buckets: Bucket[], b: Building, g: number, index: WorldIndex, name: string) {
  const p = buckets[PLAIN], obb = obbOf(b.p);
  const WHITE = '#f2efe8', RED = '#b8342c', STEEL = '#b9bcc0', GLASS = '#3c4a52';
  const eaveH = g + 20;
  walls(p, b.p, g - 3, g + 6, RED, 0);                                   // red skirt
  walls(p, b.p, g + 6, eaveH, WHITE, 0);                                 // porcelain panels
  walls(p, expandRing(b.p, 0.5), g + 12, g + 16.5, GLASS, 0);            // the window band
  walls(p, expandRing(b.p, 0.7), g + 16.5, g + 18, RED, 0);              // red band over the glass
  walls(p, expandRing(b.p, 0.7), g + 10.5, g + 12, RED, 0);              // red band under it
  // the barrel-vaulted stainless roof
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  for (let i = 0; i < 5; i++) {
    const t = (i + 0.5) / 5, hw = obb.hw * Math.sin(Math.PI * t) * 0.34 + obb.hw * 0.62;
    rotBox(p, obb.cx, obb.cz, obb.hl + 1, hw, eaveH + i * 1.5, eaveH + (i + 1) * 1.5, obb.ang, STEEL);
  }
  // the roof sign board, lettered in red, across the street face
  const f = obbFront(b, index), W = Math.min(f.half, 22);
  rotBox(p, f.x + f.nx * 1.5, f.z + f.nz * 1.5, 0.7, W * 0.85, eaveH + 8, eaveH + 16, f.ang, WHITE);
  rotBox(p, f.x + f.nx * 1.9, f.z + f.nz * 1.9, 0.5, W * 0.66, eaveH + 10.5, eaveH + 13.5, f.ang, RED);
  for (const s of [-1, 1]) p.box(f.x + f.tx * W * 0.8 * s + f.nx * 1.5, f.z + f.tz * W * 0.8 * s + f.nz * 1.5, 0.6, 0.6, eaveH, eaveH + 8, WHITE);
  // red corner posts down the street face
  for (const s of [-1, -0.33, 0.33, 1]) p.box(f.x + f.tx * W * s + f.nx * 0.8, f.z + f.tz * W * s + f.nz * 0.8, 0.8, 0.8, g, eaveH, RED);
}

// Salisbury Town Hall — the 1834 East Parish Meeting House. PHOTO-VERIFIED:
// white clapboard Greek Revival, gable-FRONT, with a round OCULUS in the
// pediment, modillion blocks along the cornices, corner pilasters, black
// shutters, and a small bracketed entry hood lettered TOWN HALL.
function salisburyTownHall(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const p = buckets[PLAIN], obb = obbOf(b.p);
  const WHITE = '#f7f4ea', TRIM = '#fdfbf2', BLACK = '#1f2124';
  const eaveH = g + 44;
  clad(buckets[CLAP], b.p, g - 2, eaveH, WHITE);
  const f = obbFront(b, index), fa = f.ang, W = Math.min(f.half, 26);
  // corner pilasters
  for (const s of [-1, 1]) {
    p.box(f.x + f.tx * W * s + f.nx * 0.6, f.z + f.tz * W * s + f.nz * 0.6, 1.6, 1.6, g - 2, eaveH + 1, TRIM);
  }
  walls(p, expandRing(b.p, 0.7), eaveH - 2, eaveH + 0.6, TRIM, 0);       // cornice
  // modillion blocks under the cornice
  const v = ringToVec2(b.p);
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b2 = v[(i + 1) % v.length];
    const ex = b2.x - a.x, ey = b2.y - a.y, len = Math.hypot(ex, ey);
    for (let d = 5; d < len - 3; d += 7) { const t = d / len; p.box(a.x + ex * t, a.y + ey * t, 0.9, 0.9, eaveH - 5, eaveH - 2, TRIM); }
  }
  gableRoof(buckets[SHINGLE], buckets[CLAP], b.p, obb, eaveH + 0.6, 15, 2, '#5c5954', WHITE);
  facades(p, b.p, eaveH, 2, 1834, false, true, false, g, 60, undefined, BLACK);
  // the pediment across the gable front, with its round oculus
  tmp.set(TRIM);
  p.triUV(f.x - f.tx * W + f.nx * 0.9, eaveH + 0.6, f.z - f.tz * W + f.nz * 0.9,
    f.x + f.tx * W + f.nx * 0.9, eaveH + 0.6, f.z + f.tz * W + f.nz * 0.9,
    f.x + f.nx * 0.9, eaveH + 15, f.z + f.nz * 0.9, f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
  for (let i = 0; i < 8; i++) {                                          // the oculus
    const a = (i / 8) * Math.PI * 2;
    p.box(f.x + f.tx * Math.cos(a) * 3.2 + f.nx * 1.4, f.z + f.tz * Math.cos(a) * 3.2 + f.nz * 1.4,
      1, 1, eaveH + 5.6 + Math.sin(a) * 3.2, eaveH + 6.6 + Math.sin(a) * 3.2, '#38414a');
  }
  // arched fanlight over the door, then the little bracketed TOWN HALL hood
  rotBox(p, f.x + f.nx * 0.6, f.z + f.nz * 0.6, 0.5, 2.6, g + 24, g + 34, fa, TRIM);
  rotBox(p, f.x + f.nx * 0.9, f.z + f.nz * 0.9, 0.4, 2, g + 25, g + 33, fa, '#38414a');
  rotBox(p, f.x + f.nx * 0.5, f.z + f.nz * 0.5, 0.5, 2.6, g, g + 15, fa, BLACK);
  rotBox(p, f.x + f.nx * 2.2, f.z + f.nz * 2.2, 3.6, 2, g + 15, g + 17, fa, TRIM);
  tmp.set(TRIM);
  p.triUV(f.x - f.tx * 3.6 + f.nx * 2.2, eaveH * 0 + g + 17, f.z - f.tz * 3.6 + f.nz * 2.2,
    f.x + f.tx * 3.6 + f.nx * 2.2, g + 17, f.z + f.tz * 3.6 + f.nz * 2.2,
    f.x + f.nx * 2.2, g + 21, f.z + f.nz * 2.2, f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
  rotBox(p, f.x + f.nx * 3.4, f.z + f.nz * 3.4, 4.2, 2.6, g - 2, g + 0.8, fa, '#9c5040');   // brick steps
}

// Manchester-by-the-Sea Public Library (1887) — PHOTO-VERIFIED Richardsonian
// Romanesque: rough variegated BROWNSTONE, steep slate roofs, a square tower with
// an open arched belfry under a lead-gray dome with a green copper finial, a clock
// face on the tower, and a big round-arch entry.
function manchesterLibrary(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const p = buckets[PLAIN], obb = obbOf(b.p);
  // brickTex's own bricks are a warm rust (~166,81,61) — for BROWNSTONE that grain is
  // exactly right, so the tint stays near-white and lets the texture do the color.
  const STONE = '#efe4d2', STONE2 = '#fdf6e8', SLATE = '#5c6068';
  walls(buckets[BRICK], b.p, g - 5, g + 12, STONE);                       // the darker lower courses
  walls(buckets[BRICK], b.p, g + 12, g + 32, STONE2);                     // warmer buff above
  gableRoof(buckets[SHINGLE], buckets[BRICK], b.p, obb, g + 32, 16, 3, SLATE, STONE2);
  facades(p, b.p, g + 32, 2, 1887, false, false, false, g, 60, '#5b3a24');
  const f = obbFront(b, index), fa = f.ang;
  // the big round-arch entry
  rotBox(p, f.x + f.nx * 0.5, f.z + f.nz * 0.5, 4, 0.5, g, g + 16, fa, '#8a5a34');
  tmp.set(STONE2);
  cone(p, f.x + f.nx * 0.5, g + 16, f.z + f.nz * 0.5, 4.4, 4, tmp.clone());
  // the square tower, offset toward one end of the front
  const tx = f.x + f.tx * Math.min(f.half, 22) * 0.62 - f.nx * 4, tz = f.z + f.tz * Math.min(f.half, 22) * 0.62 - f.nz * 4;
  const tR = 6.5, tTop = g + 58;
  walls(buckets[BRICK], [tx - tR, tz - tR, tx + tR, tz - tR, tx + tR, tz + tR, tx - tR, tz + tR], g - 5, tTop, STONE2, 1);
  p.box(tx + f.nx * (tR + 0.2), tz + f.nz * (tR + 0.2), 3.2, 3.2, g + 40, g + 47, '#e4ded0');   // the clock face
  p.box(tx + f.nx * (tR + 0.5), tz + f.nz * (tR + 0.5), 1.3, 1.3, g + 42.5, g + 46, '#33363c');
  // open arched belfry stage
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    p.box(tx + Math.cos(a) * tR, tz + Math.sin(a) * tR, 1.5, 1.5, tTop, tTop + 12, STONE2);
    const am = ((i + 0.5) / 4) * Math.PI * 2;
    p.box(tx + Math.cos(am) * (tR - 0.6), tz + Math.sin(am) * (tR - 0.6), 2.6, 2.6, tTop + 1, tTop + 10, '#2a2d33');
  }
  tmp.set('#7b7f85');                                                     // the lead-gray dome
  cone(p, tx, tTop + 12, tz, tR + 0.8, 9, tmp.clone());
  p.box(tx, tz, 1, 1, tTop + 20, tTop + 26, '#6f9c88');                   // green copper finial
}

// Tarr & Wonson Paint Manufactory — weathered barn-red WOOD (not brick), tall brick
// chimney, granite-and-pile base at the water; the ghost lettering is polish-tier.
function buildPaintFactory(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const p = buckets[PLAIN];
  walls(p, b.p, g - 10, g + 2, '#8f8b82', 0);                            // granite base out of the water
  walls(buckets[CLAP], b.p, g + 2, g + 30, '#8a3b30');                   // weathered red boards
  gableRoof(buckets[SHINGLE], p, b.p, obb, g + 30, 9, 2, '#4c4f54', '#8a3b30');
  facades(p, b.p, g + 30, 2, 1863, false, false, false, g, 30);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  buckets[BRICK].box(obb.cx + ca * obb.hl * 0.4, obb.cz + sa * obb.hl * 0.4, 3, 3, g, g + 58, '#8a4a3c');   // the chimney stack
}

// Beauport (Sleeper-McCann, 1908-34) — olive-brown shingle over fieldstone, a round
// stone tower with conical cap, and a forest of red-brick chimneys on the shore.
function buildBeauport(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const p = buckets[PLAIN];
  walls(p, b.p, g - 8, g + 8, '#8a857c', 0);                             // rubble fieldstone base
  walls(buckets[SHINGLE], b.p, g + 8, g + 30, '#5d5544');                // olive-brown shingle
  gableRoof(buckets[SHINGLE], p, b.p, obb, g + 30, 10, 2, '#6b6355', '#4c463a');
  facades(p, b.p, g + 30, 2, 1908, false, false, false, g, 30);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const tx = obb.cx + ca * obb.hl * 0.6, tz = obb.cz + sa * obb.hl * 0.6;
  walls(p, octRing(tx, tz, 7), g, g + 34, '#8a857c', 0);                 // the round fieldstone tower
  tmp.set('#6b6355'); cone(p, tx, g + 34, tz, 8, 10, tmp.clone());
  for (const s of [-0.5, 0, 0.55]) {                                     // clustered brick chimneys
    buckets[BRICK].box(obb.cx + ca * obb.hl * s, obb.cz + sa * obb.hl * s, 2.6, 2.6, g + 30, g + 46, '#8a4a3c');
  }
}

// tiny shared cream portico for hero fronts
function porticoFront(p: Bucket, f: { x: number; z: number; tx: number; tz: number; nx: number; nz: number }, g: number, h: number, hex: string) {
  for (const s of [-1, 1]) p.box(f.x + f.tx * 4.5 * s + f.nx * 5, f.z + f.tz * 4.5 * s + f.nz * 5, 1.1, 1.1, g, g + h, hex);
  rotBox(p, f.x + f.nx * 4.6, f.z + f.nz * 4.6, 7, 3.4, g + h, g + h + 2.6, Math.atan2(f.tz, f.tx), hex);
}

// ---------- Gloucester monuments (name-keyed POINT heroes — no footprint) ----------

// the Man at the Wheel (1925) — the symbol of the city: an 8-ft sea-green
// fisherman braced at his wheel on a big inscribed granite block, ~14 ft of
// monument all told. Scaled to LOOM over a kid (real memorial ≈ 3× a child;
// the first pass rendered kid-height and a resident-in-chief objected).
function buildManAtWheel(buckets: Bucket[], x: number, z: number, g: number) {
  // scale truth: the KID is 36px tall (stylized-large) — the memorial must
  // clear him twice over. Base ≈ kid height, the fisherman another kid above.
  const p = buckets[PLAIN];
  p.box(x, z, 18, 18, g, g + 1.6, '#9b968c');                            // cobble plaza pad
  p.box(x, z, 13, 13, g + 1.6, g + 4, '#a8a29a');                        // plinth step
  p.box(x, z, 10, 10, g + 4, g + 28, '#b5b0a6');                         // the rough granite block
  p.box(x, z - 10.1, 8.5, 0.3, g + 9, g + 20, '#c9c4ba');                // smooth inscription panel ("THEY THAT GO DOWN…"), boulevard face
  const v = '#5f8a6e';                                                   // verdigris bronze — he gazes SOUTH, out over the harbor
  p.box(x, z, 7.5, 5, g + 28, g + 31, v);                                // sloping deck
  p.box(x - 2.4, z, 2.4, 2.4, g + 31, g + 41.5, v);                      // braced legs, feet wide
  p.box(x + 2.5, z, 2.4, 2.4, g + 31, g + 41, v);
  p.box(x, z, 5, 3.4, g + 41, g + 51.5, v);                              // oilskin torso, leaning in
  p.box(x, z + 0.6, 3, 3, g + 51.5, g + 56, v);                          // head in the sou'wester
  p.box(x, z + 1.8, 3.8, 1.4, g + 55.6, g + 56.6, v);                    // the sou'wester brim
  p.box(x + 4.2, z + 1.8, 4.8, 1.1, g + 44.5, g + 45.8, v);              // arms reaching to the wheel
  p.box(x - 4.2, z + 1.8, 4.8, 1.1, g + 44, g + 45.3, v);
  walls(p, octRing(x, z + 5, 6.6), g + 36.5, g + 38, v, 0);              // the great ship's wheel
  walls(p, octRing(x, z + 5, 3.2), g + 40, g + 41.2, v, 0);              // inner rim
  p.box(x, z + 5, 1, 1, g + 31, g + 40, v);                              // wheel post
  for (let i = 0; i < 10; i++) {                                         // chain-post ring around the plaza
    const a = (i / 10) * Math.PI * 2;
    p.box(x + Math.cos(a) * 22, z + Math.sin(a) * 22, 1.2, 1.2, g, g + 7, '#2c2c30');
  }
}

// the Fishermen's Wives Memorial (2001) — 12 ft total: bronze mother with an
// infant and a walking boy on a rough 20-ton granite boulder
function buildWivesMemorial(buckets: Bucket[], x: number, z: number, g: number) {
  const p = buckets[PLAIN];
  p.box(x, z, 15, 12, g, g + 1.5, '#a8a29a');                            // paver pad
  p.box(x, z, 13, 11, g + 1.5, g + 12, '#a8a29a');                       // the 20-ton boulder
  p.box(x, z + 0.5, 9.5, 8, g + 12, g + 18.5, '#9b968c');                // boulder crown
  const v = '#4f6b5c';
  p.box(x - 1.4, z, 3.6, 3, g + 18.5, g + 34, v);                        // the mother, skirt blown back
  p.box(x - 1.4, z, 2.1, 2.1, g + 34, g + 37.5, v);                      // her head, gazing seaward
  p.box(x - 4.4, z + 1.4, 2.1, 2, g + 29, g + 32, v);                    // the infant cradled on her arm
  p.box(x + 3.2, z + 0.7, 2.3, 2, g + 18.5, g + 28, v);                  // the walking boy
  p.box(x + 3.2, z + 0.7, 1.6, 1.6, g + 28, g + 30.5, v);
}

// Tablet Rock, Stage Fort (1907) — a house-sized granite outcrop bearing the
// giant green bronze founding tablet ("…THE MASSACHUSETTS BAY COLONY…1623")
function buildTabletRock(buckets: Bucket[], x: number, z: number, g: number) {
  const p = buckets[PLAIN];
  p.box(x, z, 26, 20, g, g + 16, '#a89f90');                             // the outcrop
  p.box(x - 2, z - 2, 20, 14, g + 16, g + 30, '#9b9284');                // upper mass
  p.box(x + 7, z + 3, 10, 9, g + 30, g + 38, '#a89f90');                 // summit knob
  tmp.set('#5f8a6e');
  p.quad(x - 11, g + 4, -(z - 20.2), x + 11, g + 4, -(z - 20.2), x + 11, g + 22, -(z - 20.2), x - 11, g + 22, -(z - 20.2),
    0, 0, -1, tmp.r, tmp.g, tmp.b);                                      // the giant 1907 tablet, south face
}

// Coast Guard Aviation Monument — a real-scale granite marker (this one is
// genuinely modest in life) with its green dedication plaque
function buildCGMonument(buckets: Bucket[], x: number, z: number, g: number) {
  const p = buckets[PLAIN];
  p.box(x, z, 7, 4.6, g, g + 2.4, '#9b968c');
  p.box(x, z, 5, 2.8, g + 2.4, g + 17, '#b5b0a6');                       // chest-high on the kid — the real marker IS modest
  tmp.set('#5f8a6e');
  p.quad(x - 3, g + 5, -(z - 1.5), x + 3, g + 5, -(z - 1.5), x + 3, g + 14.5, -(z - 1.5), x - 3, g + 14.5, -(z - 1.5),
    0, 0, -1, tmp.r, tmp.g, tmp.b);
}

// The Doughboy (Amesbury) — PHOTO-VERIFIED: a bronze WWI infantryman mid-stride,
// helmet and pack and rifle, on a pale granite pedestal set against a low granite
// wall carrying two bronze relief panels, with a flagpole beside it.
function buildDoughboy(buckets: Bucket[], x: number, z: number, g: number) {
  const p = buckets[PLAIN];
  const GRAN = '#b6b1a7', BRONZE = '#6b5a3c';
  p.box(x, z, 15, 9, g, g + 1.4, '#a8a49a');                             // paved apron
  p.box(x + 7, z, 9, 2.2, g + 1.4, g + 13, GRAN);                        // the low wall behind him
  for (const s of [-1, 1]) p.box(x + 5 + s * 4.2, z - 2.4, 3, 0.4, g + 4.5, g + 10.5, BRONZE);   // the two relief panels
  p.box(x - 5, z, 4.5, 4.5, g + 1.4, g + 12, GRAN);                      // his pedestal
  p.box(x - 5, z, 3.2, 3.2, g + 12, g + 13.4, '#c6c1b7');               // pedestal cap
  // the striding soldier — one leg forward, pack on his back, rifle across
  p.box(x - 6.2, z + 0.6, 1.5, 1.5, g + 13.4, g + 21, BRONZE);           // trailing leg
  p.box(x - 3.9, z - 0.6, 1.5, 1.5, g + 13.4, g + 20, BRONZE);           // leading leg
  p.box(x - 5, z, 3, 2.2, g + 20, g + 28.5, BRONZE);                     // torso, leaning forward
  p.box(x - 6.6, z, 1.6, 1.6, g + 21, g + 26, BRONZE);                   // the pack
  p.box(x - 5, z, 1.9, 1.9, g + 28.5, g + 31.5, BRONZE);                 // head
  p.box(x - 5, z, 2.9, 2.9, g + 31, g + 32, BRONZE);                     // the flat helmet brim
  p.box(x - 3.4, z, 3.6, 0.7, g + 24, g + 25, BRONZE);                   // rifle across the body
  p.box(x + 1, z + 5, 0.5, 0.5, g + 1.4, g + 34, '#e0dcd2');            // flagpole
  buckets[GLOW].box(x + 4, z + 5, 3, 0.2, g + 27, g + 32, '#b03030', 0);
}

const POI_HEROES: Record<string, (buckets: Bucket[], x: number, z: number, g: number) => void> = {
  "Fishermens' Monument": buildManAtWheel,          // OSM's odd apostrophe — keep it
  "Fishermen's Wives Memorial": buildWivesMemorial,
  'Tablet Rock': buildTabletRock,
  'Coast Guard Aviation Monument': buildCGMonument,
  'Doughboy Statue': buildDoughboy,                 // Amesbury
};

function buildRearRange(buckets: Bucket[], b: Building, g: number) {
  const [cx, cz] = centroidOf(b.p);
  // white daymark on the north (river) face of a tier — ships line up on it
  const daymark = (ring: number[], y0: number, y1: number) => {
    const v = ringToVec2(ring);
    let bi = 0, bn = -Infinity;
    for (let i = 0; i < v.length; i++) {
      const a = v[i], b2 = v[(i + 1) % v.length];
      const nz = (b2.x - a.x) / (Math.hypot(b2.x - a.x, b2.y - a.y) || 1);
      if (nz > bn) { bn = nz; bi = i; }   // max nz = most river-facing
    }
    const a = v[bi], b2 = v[(bi + 1) % v.length];
    const ex = b2.x - a.x, ey = b2.y - a.y, len = Math.hypot(ex, ey) || 1;
    const nx = ey / len, nz = ex / len;
    tmp.set('#f2efe6');
    buckets[PLAIN].quad(a.x + nx * 0.4, y0, -a.y, b2.x + nx * 0.4, y0, -b2.y,
      b2.x + nx * 0.4, y1, -b2.y, a.x + nx * 0.4, y1, -a.y,
      nx, 0, nz, tmp.r, tmp.g, tmp.b);
  };
  // square shaft steps inward twice — the taper; other three sides bare brick
  const tiers: [number, number, number][] = [[0, g - 4, g + 42], [-4, g + 42, g + 78], [-8, g + 78, g + 108]];
  for (let t = 0; t < tiers.length; t++) {
    const [inset, y0, y1] = tiers[t];
    const ring = inset ? expandRing(b.p, inset) : b.p;
    walls(buckets[BRICK], ring, y0, y1, '#fdfcf8');
    daymark(ring, y0, y1);
    if (t < tiers.length - 1) flatRoof(buckets[PLAIN], ring, y1, '#8a5a45'); // step ledge
  }
  walls(buckets[BRICK], expandRing(b.p, -7), g + 108, g + 111, '#fdfcf8');   // corbelled cap
  flatRoof(buckets[PLAIN], expandRing(b.p, -7), g + 111, '#8a5a45');
  lanternTop(buckets[PLAIN], cx, cz, g + 111, 3.6);                          // 8-sided lens room, iron balcony
}

// Front Range Light (1873) — the little white cast-iron tower by the Coast Guard
function buildFrontRange(buckets: Bucket[], b: Building, g: number) {
  const [cx, cz] = centroidOf(b.p);
  walls(buckets[PLAIN], octRing(cx, cz, 4.6), g - 2, g + 24, '#f5f2e8', 0);
  walls(buckets[PLAIN], octRing(cx, cz, 4), g + 24, g + 34, '#f5f2e8', 0);
  lanternTop(buckets[PLAIN], cx, cz, g + 34, 2.8);
}

// Newburyport Harbor Light (1898) — white wooden cone at Plum Island point
function buildPILight(buckets: Bucket[], b: Building, g: number) {
  const [cx, cz] = centroidOf(b.p);
  walls(buckets[PLAIN], octRing(cx, cz, 7.2), g - 4, g + 34, '#f8f5ec', 0);
  walls(buckets[PLAIN], octRing(cx, cz, 6), g + 34, g + 64, '#f8f5ec', 0);
  walls(buckets[PLAIN], octRing(cx, cz, 4.9), g + 64, g + 88, '#f8f5ec', 0);
  lanternTop(buckets[PLAIN], cx, cz, g + 88, 3.6);
}

// Hospital Point Range Front Light (1872) — a square white-painted brick tower
// (45 ft) standing in a keeper's front yard on Bayview Ave, Beverly. The station
// is fully mapped (oil shed, equipment building); the tower gets the hero.
function buildHospitalPoint(buckets: Bucket[], b: Building, g: number) {
  const [cx, cz] = centroidOf(b.p);
  walls(buckets[BRICK], b.p, g - 2, g + 70, '#f6f3ea');                      // square shaft, painted brick
  walls(buckets[PLAIN], octRing(cx, cz, 3.6), g + 70, g + 84, '#f6f3ea', 0); // watch room
  lanternTop(buckets[PLAIN], cx, cz, g + 84, 3.2);                           // black lantern — still an active range light
}

// the Graf Rink (Henry Graf, Jr. Skating Arena) — Low Street's long, low, FLAT-roofed
// hockey arena: red-brick lower walls under a pale translucent fiberglass panel band,
// white metal fascia + white membrane roof, glass curtain-wall entry bay. No barrel roof.
function buildGrafRink(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const eave = g + 40;
  walls(buckets[BRICK], b.p, g - 8, g + 20, '#fdfcf8');                        // red-brick lower walls
  walls(buckets[PLAIN], b.p, g + 20, eave - 3, '#e3e2c9', 0);                  // translucent fiberglass panel band (daylight for the ice sheet)
  const exr = expandRing(b.p, 0.5);
  walls(buckets[PLAIN], exr, g + 19.4, g + 21, '#f2f2ee', 0);                  // white girt where panels meet brick (proud, no z-fight)
  walls(buckets[PLAIN], exr, eave - 3, eave, '#f2f2ee', 0);                    // white metal fascia
  flatRoof(buckets[PLAIN], b.p, eave, '#e6e6e2');                              // white membrane roof — dead flat, per the aerial
  roofClutter(buckets, b.p, eave, 2828, ringAreaM2(b.p), false);               // rink chiller + vents up top

  // central glass curtain-wall entry bay facing the Low Street lot
  const f = heroFront(b, index, { road: 'Low Street' });
  const EW = Math.min(20, f.len * 0.3), P = 7;                                 // bay half-width; how far it steps forward
  const bay = [
    f.x - f.tx * EW - f.nx, f.z - f.tz * EW - f.nz,
    f.x + f.tx * EW - f.nx, f.z + f.tz * EW - f.nz,
    f.x + f.tx * EW + f.nx * P, f.z + f.tz * EW + f.nz * P,
    f.x - f.tx * EW + f.nx * P, f.z - f.tz * EW + f.nz * P
  ];
  walls(buckets[PLAIN], bay, g, g + 28, '#f2f2ee', 0);                         // white-framed vestibule
  flatRoof(buckets[PLAIN], bay, g + 28, '#e6e6e2');
  const GW = EW - 2.5;
  tmp.set('#2e4452');                                                          // the curtain-wall glass
  buckets[PLAIN].quad(
    f.x - f.tx * GW + f.nx * (P + 0.5), g + 2, f.z - f.tz * GW + f.nz * (P + 0.5),
    f.x + f.tx * GW + f.nx * (P + 0.5), g + 2, f.z + f.tz * GW + f.nz * (P + 0.5),
    f.x + f.tx * GW + f.nx * (P + 0.5), g + 25, f.z + f.tz * GW + f.nz * (P + 0.5),
    f.x - f.tx * GW + f.nx * (P + 0.5), g + 25, f.z - f.tz * GW + f.nz * (P + 0.5),
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b);
  tmp.set('#f2f2ee');                                                          // white mullions ride proud of the glass
  for (const t of [-0.68, -0.34, 0.34, 0.68]) {
    const mx = f.x + f.tx * GW * t + f.nx * (P + 0.6), mz = f.z + f.tz * GW * t + f.nz * (P + 0.6);
    buckets[PLAIN].quad(mx - f.tx * 0.45, g + 2, mz - f.tz * 0.45, mx + f.tx * 0.45, g + 2, mz + f.tz * 0.45,
      mx + f.tx * 0.45, g + 25, mz + f.tz * 0.45, mx - f.tx * 0.45, g + 25, mz - f.tz * 0.45,
      f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b);
  }
  tmp.set('#1c2a32');                                                          // double glass doors dead center
  buckets[PLAIN].quad(
    f.x - f.tx * 4.5 + f.nx * (P + 0.7), g, f.z - f.tz * 4.5 + f.nz * (P + 0.7),
    f.x + f.tx * 4.5 + f.nx * (P + 0.7), g, f.z + f.tz * 4.5 + f.nz * (P + 0.7),
    f.x + f.tx * 4.5 + f.nx * (P + 0.7), g + 13, f.z + f.tz * 4.5 + f.nz * (P + 0.7),
    f.x - f.tx * 4.5 + f.nx * (P + 0.7), g + 13, f.z - f.tz * 4.5 + f.nz * (P + 0.7),
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b);
  const ang = Math.atan2(f.tz, f.tx);
  rotBox(buckets[PLAIN], f.x + f.nx * (P + 2.5), f.z + f.nz * (P + 2.5), 8, 3, g + 14.5, g + 15.7, ang, '#f2f2ee');   // flat door canopy
  // the roofline's one break: a slightly raised bay over the entry (the "slight peak")
  rotBox(buckets[PLAIN], f.x - f.nx * 3.5, f.z - f.nz * 3.5, EW + 1.5, 10.5, eave, eave + 4, ang, '#f2f2ee');
}

// U.S. Coast Guard Station Merrimack River (ded. 1973) — photo-audited: modern
// 2-story RED BRICK block, flat dark roof, wide off-white fascia band, and a
// taller square brick tower with a flat cap + antenna masts (no gables, no cone)
function buildCGStation(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 6, g + 32, '#fdfcf8');
  walls(buckets[PLAIN], expandRing(b.p, 0.5), g + 27, g + 32, '#eceadf', 0); // wide fascia/soffit band
  flatRoof(buckets[PLAIN], b.p, g + 32, '#3f4347');
  // two stacked window rows (columns align: spacing is geometric, rng is lit-only)
  facades(buckets[PLAIN], b.p, g + 32, 1, 1973, false, false, false, g - 4, 40);
  facades(buckets[PLAIN], b.p, g + 32, 1, 1974, false, false, false, g + 8, 40);
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  // square red-brick comms tower near one end: flat cap, antennas — no red pyramid
  const tX = obb.cx + ca * (obb.hl * 0.45), tZ = obb.cz + sa * (obb.hl * 0.45);
  const ring: number[] = [];
  for (const [sl, sw] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    ring.push(tX + ca * 7 * sl - sa * 7 * sw, tZ + sa * 7 * sl + ca * 7 * sw);
  }
  walls(buckets[BRICK], ring, g - 2, g + 60, '#fdfcf8');
  walls(buckets[PLAIN], expandRing(ring, 0.4), g + 56, g + 60, '#eceadf', 0);  // concrete cap band
  flatRoof(buckets[PLAIN], ring, g + 60, '#3f4347');
  buckets[PLAIN].box(tX + (ca - sa) * 3.5, tZ + (sa + ca) * 3.5, 0.5, 0.5, g + 60, g + 84, '#8a8f94'); // masts
  buckets[PLAIN].box(tX - (ca - sa) * 3.5, tZ - (sa + ca) * 3.5, 0.4, 0.4, g + 60, g + 76, '#8a8f94');
  buckets[PLAIN].box(tX + (ca - sa) * 3.5, tZ + (sa + ca) * 3.5, 2.4, 0.3, g + 80, g + 81, '#8a8f94'); // crossarm
  const f = heroFront(b, index);
  // glass entry under a white canopy, USCG emblem panel above
  tmp.set('#33424c');
  buckets[PLAIN].quad(
    f.x - f.tx * 5 + f.nx * 1.0, g, f.z - f.tz * 5 + f.nz * 1.0,
    f.x + f.tx * 5 + f.nx * 1.0, g, f.z + f.tz * 5 + f.nz * 1.0,
    f.x + f.tx * 5 + f.nx * 1.0, g + 10, f.z + f.tz * 5 + f.nz * 1.0,
    f.x - f.tx * 5 + f.nx * 1.0, g + 10, f.z - f.tz * 5 + f.nz * 1.0,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  rotBox(buckets[PLAIN], f.x + f.nx * 4.4, f.z + f.nz * 4.4, 8.5, 4.2, g + 12, g + 13.6, Math.atan2(f.tz, f.tx), '#eceadf');
  for (const s of [-1, 1]) {
    buckets[PLAIN].box(f.x + f.tx * 7 * s + f.nx * 7.6, f.z + f.tz * 7 * s + f.nz * 7.6, 0.7, 0.7, g, g + 12.4, '#eceadf');
  }
  tmp.set('#f4f2ea');
  buckets[PLAIN].quad(
    f.x - f.tx * 5 + f.nx * 1.3, g + 17, f.z - f.tz * 5 + f.nz * 1.3,
    f.x + f.tx * 5 + f.nx * 1.3, g + 17, f.z + f.tz * 5 + f.nz * 1.3,
    f.x + f.tx * 5 + f.nx * 1.3, g + 26, f.z + f.tz * 5 + f.nz * 1.3,
    f.x - f.tx * 5 + f.nx * 1.3, g + 26, f.z - f.tz * 5 + f.nz * 1.3,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  // flagpole on the lawn
  const fX = f.x + f.nx * 30, fZ = f.z + f.nz * 30;
  const fg = index.heightAtPx(fX, fZ);
  buckets[PLAIN].box(fX, fZ, 0.6, 0.6, fg, fg + 40, '#e8e4da');
  buckets[PLAIN].box(fX + 4, fZ, 3.8, 0.3, fg + 34, fg + 39, '#b03a32');
}

// Coast Guard boathouse at Plum Island point — white shed, red roof, water bay
function buildCGBoathouse(buckets: Bucket[], b: Building, g: number) {
  walls(buckets[CLAP], b.p, g - 6, g + 22, '#f7f4ec');
  const obb = obbOf(b.p);
  gableRoof(buckets[SHINGLE], buckets[CLAP], b.p, obb, g + 22, 8, 3, '#a83a2e', '#f7f4ec');
  // big dark bay door on the water end
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const eX = obb.cx + ca * (obb.hl - 0.6), eZ = obb.cz + sa * (obb.hl - 0.6);
  tmp.set('#3a4248');
  buckets[PLAIN].quad(
    eX - sa * -7, g, eZ + ca * -7, eX - sa * 7, g, eZ + ca * 7,
    eX - sa * 7, g + 16, eZ + ca * 7, eX - sa * -7, g + 16, eZ + ca * -7,
    ca, 0, sa, tmp.r, tmp.g, tmp.b
  );
}

// Spencer-Peirce-Little Farmhouse (1690) — the stone manor with its brick porch
function buildSPLFarm(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[PLAIN], b.p, g - 6, g + 28, '#9b9486', 0);             // fieldstone
  complexGable(buckets[SHINGLE], buckets[PLAIN], b.p, g + 28, '#4c463e', '#9b9486');
  facades(buckets[PLAIN], b.p, g + 28, 2, 1690, false, false, false, g, 24);
  const f = heroFront(b, index);
  // the two-story brick entrance porch, steep-gabled
  const px = f.x + f.nx * 4, pz = f.z + f.nz * 4;
  const ring: number[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    ring.push(px + f.tx * 5.5 * sx + f.nx * 5 * sz, pz + f.tz * 5.5 * sx + f.nz * 5 * sz);
  }
  walls(buckets[BRICK], ring, g - 2, g + 26, '#fdfcf8');
  tmp.set('#4c463e');
  buckets[SHINGLE].triUV(
    px - f.tx * 6 + f.nx * 9.5, g + 26, pz - f.tz * 6 + f.nz * 9.5,
    px + f.tx * 6 + f.nx * 9.5, g + 26, pz + f.tz * 6 + f.nz * 9.5,
    px + f.nx * 9.5, g + 36, pz + f.nz * 9.5,
    f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0.5, 0, 0.25, 0.45
  );
  tmp.set('#3c342c');
  buckets[PLAIN].quad(
    px - f.tx * 2.4 + f.nx * 9.2, g, pz - f.tz * 2.4 + f.nz * 9.2,
    px + f.tx * 2.4 + f.nx * 9.2, g, pz + f.tz * 2.4 + f.nz * 9.2,
    px + f.tx * 2.4 + f.nx * 9.2, g + 10, pz + f.tz * 2.4 + f.nz * 9.2,
    px - f.tx * 2.4 + f.nx * 9.2, g + 10, pz - f.tz * 2.4 + f.nz * 9.2,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
}

// the white gazebo at Plum Island point
function buildGazebo(buckets: Bucket[], b: Building, g: number) {
  const [cx, cz] = centroidOf(b.p);
  const obb = obbOf(b.p);
  const r = Math.max(10, obb.hw);
  flatRoof(buckets[PLANK], octRing(cx, cz, r), g + 2, '#b89a6e');
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const px = cx + Math.cos(a) * (r - 1), pz = cz + Math.sin(a) * (r - 1);
    buckets[PLAIN].box(px, pz, 0.8, 0.8, g + 2, g + 14, '#93836e');   // photo-audited 7/6: weathered UNPAINTED timber, not white
  }
  walls(buckets[PLAIN], octRing(cx, cz, r - 0.6), g + 5.5, g + 7, '#93836e', 0);  // railing
  tmp.set('#8f7f6a');
  octoCanopy(buckets[PLAIN], cx, g + 16, cz, r + 2, tmp.clone());   // reads as wood slats; open-pergola remodel = follow-up
}

// fire stations — brick, white bay doors, red trim: instantly "fire station"
function buildFireStation(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 6, g + 30, '#fdfcf8');
  walls(buckets[PLAIN], b.p, g + 27, g + 30, '#faf8f0', 0);
  flatRoof(buckets[PLAIN], b.p, g + 30, '#54514c');
  const f = heroFront(b, index, { minLen: 90 });
  // apparatus bays scaled to the facade: white doors, glass rows, red posts
  const pitch = Math.min(26, (f.len - 14) / 3);
  const bayHw = pitch * 0.38;
  for (const off of [-pitch, 0, pitch]) {
    const bx = f.x + f.tx * off, bz = f.z + f.tz * off;
    tmp.set('#eceadf');
    buckets[PLAIN].quad(
      bx - f.tx * bayHw + f.nx * 0.6, g, bz - f.tz * bayHw + f.nz * 0.6,
      bx + f.tx * bayHw + f.nx * 0.6, g, bz + f.tz * bayHw + f.nz * 0.6,
      bx + f.tx * bayHw + f.nx * 0.6, g + 17, bz + f.tz * bayHw + f.nz * 0.6,
      bx - f.tx * bayHw + f.nx * 0.6, g + 17, bz - f.tz * bayHw + f.nz * 0.6,
      f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
    );
    tmp.set('#5a6a74');
    buckets[PLAIN].quad(
      bx - f.tx * bayHw * 0.85 + f.nx * 1, g + 10, bz - f.tz * bayHw * 0.85 + f.nz * 1,
      bx + f.tx * bayHw * 0.85 + f.nx * 1, g + 10, bz + f.tz * bayHw * 0.85 + f.nz * 1,
      bx + f.tx * bayHw * 0.85 + f.nx * 1, g + 13.5, bz + f.tz * bayHw * 0.85 + f.nz * 1,
      bx - f.tx * bayHw * 0.85 + f.nx * 1, g + 13.5, bz - f.tz * bayHw * 0.85 + f.nz * 1,
      f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
    );
  }
  for (const m of [-1.5, -0.5, 0.5, 1.5]) {
    buckets[PLAIN].box(f.x + f.tx * pitch * m + f.nx * 0.9, f.z + f.tz * pitch * m + f.nz * 0.9, 1.1, 1.1, g, g + 18, '#b03a32');
  }
  // red band over the bays
  const bandHw = pitch * 1.55;
  tmp.set('#b03a32');
  buckets[PLAIN].quad(
    f.x - f.tx * bandHw + f.nx * 0.8, g + 18.5, f.z - f.tz * bandHw + f.nz * 0.8,
    f.x + f.tx * bandHw + f.nx * 0.8, g + 18.5, f.z + f.tz * bandHw + f.nz * 0.8,
    f.x + f.tx * bandHw + f.nx * 0.8, g + 22, f.z + f.tz * bandHw + f.nz * 0.8,
    f.x - f.tx * bandHw + f.nx * 0.8, g + 22, f.z - f.tz * bandHw + f.nz * 0.8,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  facades(buckets[PLAIN], b.p, g + 30, 1, 911, false, false, false, g + 12, 16);
}

// Newburyport Police Department — brick civic block with the navy entry band
function buildPolice(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 6, g + 32, '#fdfcf8');
  walls(buckets[PLAIN], b.p, g + 29, g + 32, '#faf8f0', 0);
  flatRoof(buckets[PLAIN], b.p, g + 32, '#54514c');
  facades(buckets[PLAIN], b.p, g + 32, 2, 1011, false, false, false, g, 40);
  const f = heroFront(b, index);
  // glass entry under a navy band
  tmp.set('#2a3f5c');
  buckets[PLAIN].quad(
    f.x - f.tx * 12 + f.nx * 0.8, g + 14, f.z - f.tz * 12 + f.nz * 0.8,
    f.x + f.tx * 12 + f.nx * 0.8, g + 14, f.z + f.tz * 12 + f.nz * 0.8,
    f.x + f.tx * 12 + f.nx * 0.8, g + 18, f.z + f.tz * 12 + f.nz * 0.8,
    f.x - f.tx * 12 + f.nx * 0.8, g + 18, f.z - f.tz * 12 + f.nz * 0.8,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  tmp.set('#3c4a52');
  buckets[PLAIN].quad(
    f.x - f.tx * 8 + f.nx * 0.7, g, f.z - f.tz * 8 + f.nz * 0.7,
    f.x + f.tx * 8 + f.nx * 0.7, g, f.z + f.tz * 8 + f.nz * 0.7,
    f.x + f.tx * 8 + f.nx * 0.7, g + 14, f.z + f.tz * 8 + f.nz * 0.7,
    f.x - f.tx * 8 + f.nx * 0.7, g + 14, f.z - f.tz * 8 + f.nz * 0.7,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
}

// Anna Jaques Hospital — red brick with white beltlines + trim and rows of windows,
// the way the real campus reads, with a glass entry canopy + red-cross pylon by the drive
function buildHospital(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const top = g + 60;
  walls(buckets[BRICK], b.p, g - 14, top, '#f6ece2');           // real brick texture, warm tint
  // white trim: a water table at grade, two beltlines between floors, a cornice
  const v = ringToVec2(b.p);
  const band = (y0: number, y1: number) => {
    tmp.set(STYLE.building.trim);
    for (let i = 0; i < v.length; i++) {
      const a = v[i], bb = v[(i + 1) % v.length];
      const ex = bb.x - a.x, ey = bb.y - a.y, len = Math.hypot(ex, ey);
      if (len < 0.01) continue;
      const nx = ey / len, nz = ex / len;
      buckets[PLAIN].quad(
        a.x + nx * 0.5, y0, -a.y, bb.x + nx * 0.5, y0, -bb.y,
        bb.x + nx * 0.5, y1, -bb.y, a.x + nx * 0.5, y1, -a.y,
        nx, 0, nz, tmp.r, tmp.g, tmp.b
      );
    }
  };
  band(g - 14, g - 9);    // white water table at grade
  band(g + 15, g + 17);   // beltline between floors
  band(g + 37, g + 39);   // beltline between floors
  band(top - 4, top);     // white cornice
  flatRoof(buckets[PLAIN], b.p, top, '#5f6365');
  // tons of white-trimmed windows on every face — a tall, glassy campus (5 rows)
  facades(buckets[PLAIN], b.p, top, 5, 1884, false, false, false, g);
  const f = heroFront(b, index);
  // white entry canopy on posts, sized for the campus scale
  rotBox(buckets[PLAIN], f.x + f.nx * 13, f.z + f.nz * 13, 22, 13, g + 16, g + 19, Math.atan2(f.tz, f.tx), '#f4f1e8');
  for (const s of [-1, 1]) {
    buckets[PLAIN].box(f.x + f.tx * 17 * s + f.nx * 22, f.z + f.tz * 17 * s + f.nz * 22, 1.2, 1.2, g, g + 16, '#e8e4d8');
  }
  tmp.set('#4a565c');
  buckets[PLAIN].quad(
    f.x - f.tx * 16 + f.nx * 0.7, g, f.z - f.tz * 16 + f.nz * 0.7,
    f.x + f.tx * 16 + f.nx * 0.7, g, f.z + f.tz * 16 + f.nz * 0.7,
    f.x + f.tx * 16 + f.nx * 0.7, g + 15, f.z + f.tz * 16 + f.nz * 0.7,
    f.x - f.tx * 16 + f.nx * 0.7, g + 15, f.z - f.tz * 16 + f.nz * 0.7,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  // red-cross pylon by the drive — the universal "hospital here"
  const sX = f.x + f.nx * 48 + f.tx * 38, sZ = f.z + f.nz * 48 + f.tz * 38;
  const sg = index.heightAtPx(sX, sZ);
  buckets[PLAIN].box(sX, sZ, 6, 2, sg, sg + 30, '#f1eee6');
  buckets[PLAIN].box(sX, sZ, 2, 2.3, sg + 13, sg + 27, '#c0392b');
  buckets[PLAIN].box(sX, sZ, 5, 2.3, sg + 17.5, sg + 22.5, '#c0392b');
}

// Brown School (1923) — the big brick schoolhouse on Milk Street
function buildBrownSchool(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 6, g + 46, '#fdfcf8');
  walls(buckets[PLAIN], b.p, g + 43, g + 46, '#faf8f0', 0);
  flatRoof(buckets[PLAIN], b.p, g + 46, '#504d49');
  facades(buckets[PLAIN], b.p, g + 46, 3, 1923, false, false, false, g, 70);
  const f = heroFront(b, index, { road: 'Milk Street' });
  // white entry surround + pediment, like the civic schools of its era
  tmp.set('#f4f1e6');
  buckets[PLAIN].quad(
    f.x - f.tx * 6 + f.nx * 0.8, g, f.z - f.tz * 6 + f.nz * 0.8,
    f.x + f.tx * 6 + f.nx * 0.8, g, f.z + f.tz * 6 + f.nz * 0.8,
    f.x + f.tx * 6 + f.nx * 0.8, g + 18, f.z + f.tz * 6 + f.nz * 0.8,
    f.x - f.tx * 6 + f.nx * 0.8, g + 18, f.z - f.tz * 6 + f.nz * 0.8,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  tmp.set('#3a3f44');
  buckets[PLAIN].quad(
    f.x - f.tx * 4 + f.nx * 1.1, g, f.z - f.tz * 4 + f.nz * 1.1,
    f.x + f.tx * 4 + f.nx * 1.1, g, f.z + f.tz * 4 + f.nz * 1.1,
    f.x + f.tx * 4 + f.nx * 1.1, g + 12, f.z + f.tz * 4 + f.nz * 1.1,
    f.x - f.tx * 4 + f.nx * 1.1, g + 12, f.z - f.tz * 4 + f.nz * 1.1,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  tmp.set('#f4f1e6');
  buckets[PLAIN].triUV(
    f.x - f.tx * 7 + f.nx * 1, g + 18, f.z - f.tz * 7 + f.nz * 1,
    f.x + f.tx * 7 + f.nx * 1, g + 18, f.z + f.tz * 7 + f.nz * 1,
    f.x + f.nx * 1, g + 23, f.z + f.nz * 1,
    f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0
  );
  // small white cupola
  const obb = obbOf(b.p);
  walls(buckets[PLAIN], octRing(obb.cx, obb.cz, 4.5), g + 46, g + 56, '#f6f3ea', 0);
  tmp.set('#3e4140');
  cone(buckets[PLAIN], obb.cx, g + 56, obb.cz, 5.6, 6, tmp.clone());
}

// Lower Green Schoolhouse — Newbury's little white one-room school (1877)
function buildLGSchoolhouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[CLAP], b.p, g - 4, g + 18, '#f7f4ec');
  const obb = obbOf(b.p);
  gableRoof(buckets[SHINGLE], buckets[CLAP], b.p, obb, g + 18, 8, 3, '#4e4a45', '#f7f4ec');
  houseTrim(buckets[PLAIN], b.p, g + 18, g - 4);
  facades(buckets[PLAIN], b.p, g + 18, 1, 1877, true, false, false, g, 10);
  // open bell cupola on the ridge
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const tX = obb.cx + ca * (obb.hl * 0.4), tZ = obb.cz + sa * (obb.hl * 0.4);
  buckets[PLAIN].box(tX, tZ, 2.6, 2.6, g + 24, g + 31, '#f6f3ea');
  buckets[PLAIN].box(tX, tZ, 1.1, 1.1, g + 26, g + 29.5, '#2e2c28');
  tmp.set('#4e4a45');
  cone(buckets[PLAIN], tX, g + 31, tZ, 3.6, 4.5, tmp.clone());
}

// like walls() but with a soft shade floor, so the cream stays light in shadow (a white
// house reads white, not grey, on its shaded road-facing front)
function clad(bk: Bucket, ring: number[], y0: number, y1: number, hex: string) {
  const v = ringToVec2(ring);
  tmp.set(hex);
  const r = tmp.r, g = tmp.g, b = tmp.b;
  for (let i = 0; i < v.length; i++) {
    const a = v[i], bb = v[(i + 1) % v.length];
    const ex = bb.x - a.x, ey = bb.y - a.y, len = Math.hypot(ex, ey) || 1;
    const nx = ey / len, nz = ex / len;
    const shade = 0.86 + 0.14 * Math.max(0, nx * 0.35 + nz * 0.85);
    const u = len / TEX_SCALE, v0 = y0 / TEX_SCALE, v1 = y1 / TEX_SCALE;
    bk.quadUV(a.x, y0, -a.y, bb.x, y0, -bb.y, bb.x, y1, -bb.y, a.x, y1, -a.y,
      nx, 0, nz, r * shade, g * shade, b * shade, 0, v0, u, v0, u, v1, 0, v1);
  }
}

// a steep slate mansard: a frustum from the footprint (eave) up to an inset top ring + cap
function mansard(buckets: Bucket[], ring: number[], eave: number, top: number, run: number, slope: string, cap: string) {
  const v = ringToVec2(ring);
  let cx = 0, cy = 0; for (const p of v) { cx += p.x; cy += p.y; } cx /= v.length; cy /= v.length;
  const iv = v.map((p) => { const dx = cx - p.x, dy = cy - p.y, d = Math.hypot(dx, dy) || 1;
    return new THREE.Vector2(p.x + (dx / d) * run, p.y + (dy / d) * run); });
  tmp.set(slope);
  for (let i = 0; i < v.length; i++) {
    const a = v[i], bb = v[(i + 1) % v.length], a2 = iv[i], b2 = iv[(i + 1) % v.length];
    const ex = bb.x - a.x, ey = bb.y - a.y, len = Math.hypot(ex, ey) || 1;
    const nx = ey / len, nz = ex / len;
    const sh = 0.66 + 0.34 * Math.max(0, nx * 0.35 + nz * 0.85);
    buckets[SHINGLE].quad(a.x, eave, -a.y, bb.x, eave, -bb.y, b2.x, top, -b2.y, a2.x, top, -a2.y,
      nx * 0.5, 0.72, nz * 0.5, tmp.r * sh, tmp.g * sh, tmp.b * sh);
  }
  const iw: number[] = []; for (const p of iv) iw.push(p.x, -p.y);
  flatRoof(buckets[SHINGLE], iw, top, cap);
}

// a triangular pediment/gable face at (cx,cz), half-base hw, base y0 → apex y1, facing (nx,nz)
function gableEnd(bk: Bucket, cx: number, cz: number, hw: number, y0: number, y1: number, ang: number, nx: number, nz: number, hex: string) {
  tmp.set(hex);
  const tx = Math.cos(ang), tz = Math.sin(ang);
  bk.triUV(cx - tx * hw, y0, -(cz - tz * hw), cx + tx * hw, y0, -(cz + tz * hw), cx, y1, -cz,
    nx, 0, nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
}

// The Residences on the Ridge (95 High St) — a cream Second Empire: two clapboard storeys
// on a granite base, a steep slate mansard with pedimented dormers, a two-storey canted
// bay, and a railed columned porch facing High St. Keyed by b.n in HEROES.
function buildResidencesRidge(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const CREAM = '#f9f5ec', TRIM = '#fefdf9', SLATE = '#3d414a', SLATE2 = '#494e57',
        STONE = '#8b857a', GLASS = '#2b3a44';
  const ring = b.p;
  const base = g + 6, eave = g + 42, top = eave + 23;
  walls(buckets[PLAIN], ring, g - 12, base, STONE, 0);           // granite base
  clad(buckets[CLAP], ring, base, eave, CREAM);                  // cream clapboard
  walls(buckets[PLAIN], ring, eave - 2.5, eave + 0.6, TRIM, 0);  // cornice
  facades(buckets[PLAIN], ring, eave, 2, 1888, false, true, false, base, 33);
  mansard(buckets, ring, eave, top, 7, SLATE, SLATE2);

  const f = heroFront(b, index, { road: 'High Street' });
  const ang = Math.atan2(f.tz, f.tx);

  // two-storey canted bay window, off to one side of the entry
  const bcx = f.x + f.tx * 22, bcz = f.z + f.tz * 22, bw = 6.5, proj = 7;
  const bay: number[] = [];
  const BP = (tt: number, no: number) => bay.push(bcx + f.tx * tt + f.nx * no, bcz + f.tz * tt + f.nz * no);
  BP(-bw, 0); BP(-bw * 0.5, proj); BP(bw * 0.5, proj); BP(bw, 0);
  clad(buckets[CLAP], bay, base, eave - 1, CREAM);
  rotBox(buckets[PLAIN], bcx + f.nx * (proj + 0.3), bcz + f.nz * (proj + 0.3), bw * 0.5, 0.5, base + 7, eave - 5, ang, GLASS);
  flatRoof(buckets[SHINGLE], bay, eave - 1, SLATE);

  // three pedimented dormers across the mansard front
  for (const s of [-1, 0, 1]) {
    const ox = f.x + f.tx * s * 21 + f.nx * 1.5, oz = f.z + f.tz * s * 21 + f.nz * 1.5;
    rotBox(buckets[CLAP], ox, oz, 5, 4.5, eave + 3, eave + 14, ang, TRIM);
    rotBox(buckets[PLAIN], ox + f.nx * 1.4, oz + f.nz * 1.4, 2.6, 0.5, eave + 5, eave + 12, ang, GLASS);
    rotBox(buckets[SHINGLE], ox, oz, 5.4, 4.8, eave + 14, eave + 15, ang, SLATE);
    gableEnd(buckets[PLAIN], ox + f.nx * 1.6, oz + f.nz * 1.6, 5, eave + 14, eave + 18, ang, f.nx, f.nz, TRIM);
  }

  // railed, columned front porch with a slate roof
  const pw = Math.min(f.len * 0.4, 26), pout = 12;
  for (const s of [-1, -0.34, 0.34, 1]) {
    rotBox(buckets[PLAIN], f.x + f.tx * s * pw + f.nx * pout, f.z + f.tz * s * pw + f.nz * pout, 1.1, 1.1, base, base + 16, ang, TRIM);  // posts
  }
  rotBox(buckets[PLAIN], f.x + f.nx * (pout - 2.5), f.z + f.nz * (pout - 2.5), pw + 1.5, 1.1, base + 9, base + 10, ang, TRIM);            // railing
  rotBox(buckets[SHINGLE], f.x + f.nx * (pout - 2), f.z + f.nz * (pout - 2), pw + 2.5, 7.5, base + 16, base + 17, ang, SLATE);            // roof
  rotBox(buckets[PLAIN], f.x + f.nx * (pout + 5.2), f.z + f.nz * (pout + 5.2), pw + 2.5, 0.8, base + 15, base + 17, ang, TRIM);           // fascia
}

// the rear carriage house — same cream-and-slate language, scaled down, one dormer
function buildRidgeCarriage(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const CREAM = '#f9f5ec', TRIM = '#fefdf9', SLATE = '#3d414a', SLATE2 = '#494e57', STONE = '#8b857a', GLASS = '#2b3a44';
  const ring = b.p;
  const base = g + 4, eave = g + 26, top = eave + 14;
  walls(buckets[PLAIN], ring, g - 10, base, STONE, 0);
  clad(buckets[CLAP], ring, base, eave, CREAM);
  walls(buckets[PLAIN], ring, eave - 2, eave + 0.5, TRIM, 0);
  facades(buckets[PLAIN], ring, eave, 1, 1892, false, true, false, base, 28);
  mansard(buckets, ring, eave, top, 5, SLATE, SLATE2);
  const f = heroFront(b, index);
  const ang = Math.atan2(f.tz, f.tx);
  const ox = f.x + f.nx * 1.5, oz = f.z + f.nz * 1.5;
  rotBox(buckets[CLAP], ox, oz, 4, 4, eave + 2, eave + 9, ang, TRIM);
  rotBox(buckets[PLAIN], ox + f.nx * 1.2, oz + f.nz * 1.2, 2, 0.5, eave + 3.5, eave + 7.5, ang, GLASS);
  rotBox(buckets[SHINGLE], ox, oz, 4.4, 4.4, eave + 9, eave + 10, ang, SLATE);
  gableEnd(buckets[PLAIN], ox + f.nx * 1.6, oz + f.nz * 1.6, 4, eave + 9, eave + 12, ang, f.nx, f.nz, TRIM);
}

// ---------- Salem First-Period houses (17th c.): dark weathered wood, steep street-facing
// cross-gables tiling the facade, a massive central chimney, jettied floor lines, and small-pane
// leaded casements. Parameterized so one builder serves the Witch House, the House of the Seven
// Gables (many varied gables), Hathaway, and Narbonne. ----------
type FirstPeriodOpts = { wall: string; shingle: string; jetty?: string; nGables?: number; vary?: boolean; chimney?: 'central' | 'big' | 'none'; eave?: number };
function firstPeriod(buckets: Bucket[], b: Building, g: number, index: WorldIndex, o: FirstPeriodOpts) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  tmp.set(o.wall); const dr = tmp.r, dg = tmp.g, db = tmp.b;
  tmp.set(o.shingle); const sr = tmp.r, sg = tmp.g, sb = tmp.b;
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1;     // +lz world dir = (-sa, ca)
  const FW = front * (W + 1.4), BW = -front * (W + 1.4);
  const eaveH = g + (o.eave ?? 26);
  clad(buckets[CLAP], b.p, g - 2, eaveH, o.wall);
  walls(buckets[PLAIN], b.p, g + 11, g + 12.4, o.jetty ?? '#25272a', 0);
  walls(buckets[PLAIN], b.p, eaveH - 1.3, eaveH, o.jetty ?? '#25272a', 0);
  if (o.chimney !== 'none') { const cc = pt(0, 0, 0), cw = o.chimney === 'big' ? 5 : 3.7; buckets[BRICK].box(cc[0], cc[2], cw, cw - 0.5, eaveH + 6, eaveH + (o.chimney === 'big' ? 42 : 32), '#6f4636', 1); }
  const n = o.nGables ?? 3, gw = L / n;
  const ridges: [number, number][] = [];   // [center, ridgeY] for window placement
  for (let i = 0; i < n; i++) {
    const c = -L + gw * (2 * i + 1);
    const rise = o.vary ? 22 + ((i * 53 + 13) % 5) * 4.5 + (i % 2 ? 5 : 0) : Math.max(26, gw * 1.25);
    const ridgeY = eaveH + rise; ridges.push([c, ridgeY]);
    const aF = pt(c, FW, ridgeY), aB = pt(c, BW, ridgeY);
    const fL = pt(c - gw * 1.02, FW, eaveH), fR = pt(c + gw * 1.02, FW, eaveH), bL = pt(c - gw * 1.02, BW, eaveH), bR = pt(c + gw * 1.02, BW, eaveH);
    buckets[CLAP].triUV(fL[0], fL[1], fL[2], fR[0], fR[1], fR[2], aF[0], aF[1], aF[2], -sa * front, 0, ca * front, dr, dg, db, 0, 0, 0, 0, 0, 0);
    buckets[CLAP].triUV(bR[0], bR[1], bR[2], bL[0], bL[1], bL[2], aB[0], aB[1], aB[2], sa * front, 0, -ca * front, dr, dg, db, 0, 0, 0, 0, 0, 0);
    buckets[SHINGLE].quad(fL[0], fL[1], fL[2], bL[0], bL[1], bL[2], aB[0], aB[1], aB[2], aF[0], aF[1], aF[2], -ca, 0.5, -sa, sr, sg, sb);
    buckets[SHINGLE].quad(aF[0], aF[1], aF[2], aB[0], aB[1], aB[2], bR[0], bR[1], bR[2], fR[0], fR[1], fR[2], ca, 0.5, sa, sr * 0.9, sg * 0.9, sb * 0.9);
  }
  const win = (lx: number, y: number, hw: number, hh: number, side = front) => {
    const c0 = pt(lx, side * W, y), nx = -sa * side, nz = ca * side, ax = ca, az = sa, pr = 0.4;
    const C = (sx: number, sy: number): [number, number, number] => [c0[0] + ax * hw * sx + nx * pr, c0[1] + hh * sy, c0[2] + az * hw * sx + nz * pr];
    const a = C(-1, -1), bb = C(1, -1), cc = C(1, 1), dd = C(-1, 1);
    tmp.set('#a4b5bb'); buckets[PLAIN].quad(a[0], a[1], a[2], bb[0], bb[1], bb[2], cc[0], cc[1], cc[2], dd[0], dd[1], dd[2], nx, 0, nz, tmp.r, tmp.g, tmp.b);
    tmp.set('#565f64'); const v0 = C(0, -1), v1 = C(0, 1), h0 = C(-1, 0), h1 = C(1, 0), tw = 0.16;
    buckets[PLAIN].quad(v0[0] - ax * tw, v0[1], v0[2] - az * tw, v0[0] + ax * tw, v0[1], v0[2] + az * tw, v1[0] + ax * tw, v1[1], v1[2] + az * tw, v1[0] - ax * tw, v1[1], v1[2] - az * tw, nx, 0, nz, tmp.r, tmp.g, tmp.b);
    buckets[PLAIN].quad(h0[0], h0[1] - 0.16, h0[2], h1[0], h1[1] - 0.16, h1[2], h1[0], h1[1] + 0.16, h1[2], h0[0], h0[1] + 0.16, h0[2], nx, 0, nz, tmp.r, tmp.g, tmp.b);
  };
  // windows on BOTH long faces — front-only left the harbor/back side a windowless
  // black blob (exactly Devin's Seven Gables complaint, and Hathaway had it too)
  for (const side of [front, -front]) {
    for (const [c, ridgeY] of ridges) win(c, eaveH + (ridgeY - eaveH) * 0.42, 2.4, 3, side);   // a window up each gable
    const cols = Math.max(4, n * 2);
    for (let i = 0; i < cols; i++) { const lx = -L + (2 * L) * (i + 0.5) / cols; win(lx, g + 16, 2.6, 3.5, side); win(lx, g + 5.5, 2.6, 3.5, side); }   // rows of casements
  }
  // festive eave lights like the neighbours (heroes skip the generic decor pass)
  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eaveH - 1.5, HALLOWEEN_BULBS);
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eaveH - 1.5);
}
function witchHouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  firstPeriod(buckets, b, g, index, { wall: '#363a3e', shingle: '#2c2e32', nGables: 3, chimney: 'central' });   // charcoal, 3 gables
}
function sevenGables(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  // The real mansion's plan is a rambling 14-vertex zigzag, so the firstPeriod OBB
  // treatment buried it under a floating roof-mountain: mega-gables over the concave
  // notches, yard pines poking through them, and windows on ONE face only — from
  // Turner St it read as a windowless black blob (Devin's words). Build on the TRUE
  // footprint instead: real walls, a shingle cap on the real polygon, a gable rising
  // from EVERY long wall (spiky from every angle, like the house itself), shared
  // facades() windows all around (the e48f320 lesson), and the massive chimney.
  const WALL = '#3d342c', SHINGLE_HEX = '#2f2a24', JETTY = '#221d18';
  const ring = b.p;
  const eaveH = g + 26;
  clad(buckets[CLAP], ring, g - 2, eaveH, WALL);
  walls(buckets[PLAIN], expandRing(ring, 0.4), g + 11, g + 12.4, JETTY, 0);
  walls(buckets[PLAIN], expandRing(ring, 0.4), eaveH - 1.3, eaveH, JETTY, 0);
  facades(buckets[PLAIN], ring, eaveH, 1, hash32(Math.round(ring[0]), Math.round(ring[1])), true, false, false, g);
  flatRoof(buckets[SHINGLE], expandRing(ring, 1.5), eaveH + 0.5, SHINGLE_HEX);
  tmp.set(WALL); const wr = tmp.r, wg = tmp.g, wb = tmp.b;
  tmp.set(SHINGLE_HEX); const sr2 = tmp.r, sg2 = tmp.g, sb2 = tmp.b;
  // ring winding decides which side is "inward" for normals + ridge points
  let area = 0;
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length;
    area += ring[i] * ring[j + 1] - ring[j] * ring[i + 1];
  }
  const inw = area > 0 ? 1 : -1;
  const nv = ring.length / 2;
  let gi = 0, longest = 0, chX = 0, chZ = 0;
  for (let i = 0; i < nv; i++) {
    const ax = ring[i * 2], az = ring[i * 2 + 1];
    const bx = ring[((i + 1) % nv) * 2], bz = ring[((i + 1) % nv) * 2 + 1];
    const dx = bx - ax, dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 1) continue;
    const ux = dx / len, uz = dz / len;
    const nx = -uz * inw, nz = ux * inw;         // inward normal
    if (len > longest) { longest = len; chX = (ax + bx) / 2 + nx * 14; chZ = (az + bz) / 2 + nz * 14; }
    if (len < 55) continue;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    const hw = Math.min(len * 0.42, 32);
    const depth = Math.min(hw * 0.9, 22);
    const rise = 15 + ((gi * 53 + 13) % 5) * 3.2 + (gi % 2 ? 3 : 0);   // varied, like the real cluster
    gi++;
    const ridgeY = eaveH + rise;
    const fx = mx - nx * 0.5, fz = mz - nz * 0.5;  // face sits a hair proud of the wall plane
    const aX = fx - ux * hw, aZ = fz - uz * hw;
    const bX = fx + ux * hw, bZ = fz + uz * hw;
    const rX = mx + nx * depth, rZ = mz + nz * depth;
    // clapboard face triangle + a small diamond-pane window up the gable
    buckets[CLAP].triUV(aX, eaveH, aZ, bX, eaveH, bZ, fx, ridgeY, fz, -nx, 0, -nz, wr, wg, wb, 0, 0, 0, 0, 0, 0);
    tmp.set('#ded8c8');
    buckets[PLAIN].quad(
      fx - ux * 3 - nx * 1.1, eaveH + rise * 0.28, fz - uz * 3 - nz * 1.1, fx + ux * 3 - nx * 1.1, eaveH + rise * 0.28, fz + uz * 3 - nz * 1.1,
      fx + ux * 3 - nx * 1.1, eaveH + rise * 0.28 + 4.6, fz + uz * 3 - nz * 1.1, fx - ux * 3 - nx * 1.1, eaveH + rise * 0.28 + 4.6, fz - uz * 3 - nz * 1.1,
      -nx, 0, -nz, tmp.r, tmp.g, tmp.b);
    tmp.set('#8fa3ab');
    buckets[PLAIN].quad(
      fx - ux * 2.2 - nx * 1.4, eaveH + rise * 0.28 + 0.6, fz - uz * 2.2 - nz * 1.4, fx + ux * 2.2 - nx * 1.4, eaveH + rise * 0.28 + 0.6, fz + uz * 2.2 - nz * 1.4,
      fx + ux * 2.2 - nx * 1.4, eaveH + rise * 0.28 + 4, fz + uz * 2.2 - nz * 1.4, fx - ux * 2.2 - nx * 1.4, eaveH + rise * 0.28 + 4, fz - uz * 2.2 - nz * 1.4,
      -nx, 0, -nz, tmp.r, tmp.g, tmp.b);
    // two shingle slopes back to the inward ridge point
    buckets[SHINGLE].triUV(aX, eaveH, aZ, fx, ridgeY, fz, rX, ridgeY, rZ, -ux * 0.7, 0.7, -uz * 0.7, sr2, sg2, sb2, 0, 0, 0, 0, 0, 0);
    buckets[SHINGLE].triUV(bX, eaveH, bZ, rX, ridgeY, rZ, fx, ridgeY, fz, ux * 0.7, 0.7, uz * 0.7, sr2 * 0.9, sg2 * 0.9, sb2 * 0.9, 0, 0, 0, 0, 0, 0);
  }
  // the famous massive chimney, seated inside the longest wing (never floating)
  buckets[BRICK].box(chX, chZ, 5, 4.5, eaveH - 2, eaveH + 40, '#6f4636', 1);
  // festive eave lights like the neighbours (heroes skip the generic decor pass)
  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eaveH - 1.5, HALLOWEEN_BULBS);
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eaveH - 1.5);
}
function hathawayHouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  firstPeriod(buckets, b, g, index, { wall: '#3a342b', shingle: '#2a2620', nGables: 2, chimney: 'central', eave: 24 });   // dark weathered brown
}
function narbonneHouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  firstPeriod(buckets, b, g, index, { wall: '#99a08b', shingle: '#a9a294', jetty: '#8f9682', nGables: 1, chimney: 'central', eave: 22 });   // LIGHT sage grey-green + pale weathered shingle (photo-audited 7/6 — it was rendering dark brown; NPS photos show a light house)
}

// Salem Custom House (1819) — red Federal brick, low slate hip, a central pedimented portico, and
// the signature gilded eagle on a white octagonal cupola. (Where Hawthorne worked; the Scarlet Letter.)
function customHouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1, FW = front * (W + 0.6);
  const eaveH = g + 45;
  const exr = expandRing(b.p, 0.5);
  walls(buckets[BRICK], b.p, g - 4, eaveH, '#9c4d3c');                 // red Federal brick
  walls(buckets[PLAIN], exr, g + 23, g + 24.4, '#efe9dc', 0);          // white belt course (proud, between floors)
  walls(buckets[PLAIN], exr, eaveH - 2, eaveH, '#efe9dc', 0);          // white cornice
  flatRoof(buckets[SHINGLE], b.p, eaveH + 1.5, '#4a4e54');             // low slate hip
  facades(buckets[PLAIN], b.p, eaveH, 2, Math.round(obb.cx * 7 + obb.cz * 3), true, false, false, g);   // framed windows + a door
  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eaveH - 1.5, HALLOWEEN_BULBS);
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eaveH - 1.5);
  tmp.set('#efe9dc'); const tr = tmp.r, tg = tmp.g, tb = tmp.b;
  const pL = pt(-L * 0.26, FW, eaveH), pR = pt(L * 0.26, FW, eaveH), pPk = pt(0, FW, eaveH + 7);
  buckets[PLAIN].triUV(pL[0], pL[1], pL[2], pR[0], pR[1], pR[2], pPk[0], pPk[1], pPk[2], -sa * front, 0, ca * front, tr, tg, tb, 0, 0, 0, 0, 0, 0);  // central pediment
  for (const lx of [-L * 0.24, -L * 0.08, L * 0.08, L * 0.24]) { const c = pt(lx, FW + front * 1.5, 0); buckets[PLAIN].box(c[0], c[2], 0.9, 0.9, g, eaveH, '#efe9dc'); }  // portico columns
  const cc = pt(0, 0, 0), base = eaveH + 2;
  buckets[PLAIN].box(cc[0], cc[2], 3, 3, base, base + 4, '#f6f1e6');                        // cupola base (slim)
  walls(buckets[PLAIN], octRing(cc[0], cc[2], 2.5), base + 4, base + 11, '#f8f4ea', 0);     // octagonal lantern
  tmp.set('#cdd2cf'); cone(buckets[PLAIN], cc[0], base + 11, cc[2], 2.7, 3.5, tmp.clone()); // dome
  const ey = base + 15, gx = -sa * front, gz = ca * front;                                  // gilded eagle on top — the signature
  tmp.set('#eab73c');
  octoCanopy(buckets[GLOW], cc[0], ey + 1.5, cc[2], 2.4, tmp.clone());                      // body
  octoCanopy(buckets[GLOW], cc[0] + gx * 2.6, ey + 3, cc[2] + gz * 2.6, 1.3, tmp.clone());  // head, forward
  for (const s of [-1, 1]) octoCanopy(buckets[GLOW], cc[0] + ca * s * 4.6, ey + 3.4, cc[2] + sa * s * 4.6, 1.9, tmp.clone());  // spread wings
}

// Salem Witch Museum — the old East Church (Minard Lafever, 1844): a brownstone Gothic
// Revival church turned museum. Battlemented (crenellated) parapet with pale-stone caps,
// two octagonal corner towers flanking the street front (four-stage originally, cut down
// in the 1920s — squat today), a great central pointed-arch window over a pointed entrance,
// corner buttresses, and tall stained-glass lancets down the nave. The "haunted castle"
// silhouette tourists know — windows GLOW so it reads as a lit church after dark. The front
// (towers + entrance + great window) auto-orients to the street via frontSegment.
function witchMuseum(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  // the NAVE runs along the long axis; the gable end (towers + great window + entrance)
  // is the short end, auto-pointed at the street by frontSegment — like the real church.
  const fs = frontSegment(b, index);
  const longL = obb.hl >= obb.hw;
  const NAVE = longL ? obb.hl : obb.hw;              // half-length of the nave (front↔back)
  const ACR = longL ? obb.hw : obb.hl;              // half-width of the gable front (towers spread here)
  const ndx = longL ? ca : -sa, ndz = longL ? sa : ca;             // +nave (depth) world dir
  const anx = longL ? -sa : ca, anz = longL ? ca : sa;            // +across world dir
  const fsign = (fs.nx * ndx + fs.nz * ndz) >= 0 ? 1 : -1;        // which gable end faces the street
  const dnx = ndx * fsign, dnz = ndz * fsign;                     // outward front normal
  const P = (ac: number, dp: number, y: number): [number, number, number] => longL ? pt(dp, ac, y) : pt(ac, dp, y);
  const ridgeAng = longL ? obb.ang + Math.PI / 2 : obb.ang;       // box angle aligned across the nave

  const STONE = '#5d4034', TRIM = '#a89070', ROOF = '#2f2c31';    // brownstone + pale-stone trim + slate
  const G_BIG = '#b5662f', G_NAVE = '#4a3a63', DOOR = '#241d16';  // amber great window, violet nave glass
  const eaveH = g + 46, ridgeY = eaveH + Math.min(ACR * 0.7, 36); // tall church walls + a real pitched roof
  walls(buckets[BRICK], b.p, g - 4, eaveH, STONE);
  walls(buckets[PLAIN], expandRing(b.p, 0.5), eaveH - 3, eaveH - 1.4, TRIM, 0);   // pale stringcourse below the parapet (proud, no z-fight)

  // ── pitched gable roof, ridge along the nave; slopes to the two long sides ──
  tmp.set(ROOF); const rr = tmp.r, rg = tmp.g, rb = tmp.b;
  for (const s of [1, -1] as const) {
    const e0 = P(s * (ACR + 1), -NAVE - 1, eaveH - 1), e1 = P(s * (ACR + 1), NAVE + 1, eaveH - 1);
    const r0 = P(0, -NAVE - 1, ridgeY), r1 = P(0, NAVE + 1, ridgeY);
    buckets[PLAIN].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], anx * s * 0.5, 0.85, anz * s * 0.5, rr, rg, rb);
  }
  tmp.set(STONE); const sr = tmp.r, sg = tmp.g, sb = tmp.b;       // gable-end triangles, front & back
  for (const sd of [1, -1] as const) {
    const a = P(-ACR, sd * NAVE, eaveH), b2 = P(ACR, sd * NAVE, eaveH), pk = P(0, sd * NAVE, ridgeY);
    buckets[BRICK].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ndx * sd, 0, ndz * sd, sr, sg, sb, 0, 0, 0, 0, 0, 0);
  }

  // ── battlemented parapet: pale-capped merlons around the eave + the tower tops ──
  const merlonLine = (p0: [number, number, number], p1: [number, number, number], y0: number, h: number) => {
    const dx = p1[0] - p0[0], dz = p1[2] - p0[2], len = Math.hypot(dx, dz); if (len < 3) return;
    const ux = dx / len, uz = dz / len;
    for (let d = 2; d < len - 1; d += 6) {
      const x = p0[0] + ux * d, z = p0[2] + uz * d;
      buckets[BRICK].box(x, z, 1.8, 1.8, y0, y0 + h, STONE, 0);
      buckets[PLAIN].box(x, z, 2.0, 2.0, y0 + h, y0 + h + 1, TRIM, 0);
    }
  };
  const merlonRing = (ring: number[], y0: number, h: number) => {
    for (let i = 0; i < ring.length; i += 2) merlonLine([ring[i], 0, ring[i + 1]], [ring[(i + 2) % ring.length], 0, ring[(i + 3) % ring.length]], y0, h);
  };
  merlonRing(b.p, eaveH, 5);

  // ── pointed-arch window / door helper: pale stone surround + (glowing) glass, both proud ──
  const win = (ac: number, dp: number, nx: number, nz: number, tx: number, tz: number, hw: number, y0: number, ySh: number, yAp: number, hex: string, glow: boolean) => {
    const base = P(ac, dp, 0), cx = base[0], cz = base[2];
    const Q = (sw: number, y: number, pr: number): [number, number, number] => [cx + tx * sw + nx * pr, y, cz + tz * sw + nz * pr];
    tmp.set(TRIM); const Tr = tmp.r, Tg = tmp.g, Tb = tmp.b; const ow = hw + 1.2;                 // surround
    let a = Q(-ow, y0 - 1.3, 0.3), bb = Q(ow, y0 - 1.3, 0.3), cc = Q(ow, ySh + 1, 0.3), dd = Q(-ow, ySh + 1, 0.3), ap = Q(0, yAp + 1.7, 0.3);
    buckets[PLAIN].quad(a[0], a[1], a[2], bb[0], bb[1], bb[2], cc[0], cc[1], cc[2], dd[0], dd[1], dd[2], nx, 0, nz, Tr, Tg, Tb);
    buckets[PLAIN].triUV(dd[0], dd[1], dd[2], cc[0], cc[1], cc[2], ap[0], ap[1], ap[2], nx, 0, nz, Tr, Tg, Tb, 0, 0, 0, 0, 0, 0);
    tmp.set(hex); const Gr = tmp.r, Gg = tmp.g, Gb = tmp.b; const bk = glow ? buckets[GLOW] : buckets[PLAIN];   // glass / door
    a = Q(-hw, y0, 0.55); bb = Q(hw, y0, 0.55); cc = Q(hw, ySh, 0.55); dd = Q(-hw, ySh, 0.55); ap = Q(0, yAp, 0.55);
    bk.quad(a[0], a[1], a[2], bb[0], bb[1], bb[2], cc[0], cc[1], cc[2], dd[0], dd[1], dd[2], nx, 0, nz, Gr, Gg, Gb);
    bk.triUV(dd[0], dd[1], dd[2], cc[0], cc[1], cc[2], ap[0], ap[1], ap[2], nx, 0, nz, Gr, Gg, Gb, 0, 0, 0, 0, 0, 0);
  };

  // tall stained-glass lancets down both long nave walls (glow at night), a few on the back
  for (const s of [-1, 1] as const) for (let i = 0; i < 5; i++) win(s * ACR, -NAVE * 0.62 + NAVE * 1.12 * (i / 4), anx * s, anz * s, ndx, ndz, 2.6, g + 13, eaveH - 6, eaveH - 1, G_NAVE, true);
  for (const ac of [-ACR * 0.46, 0, ACR * 0.46]) win(ac, -fsign * NAVE, -dnx, -dnz, anx, anz, 2.5, g + 13, eaveH - 8, eaveH - 3, G_NAVE, true);

  // ── front gable: raised central bay framing the great window, pointed entrance below ──
  const bayH = ACR * 0.4;
  const bc = [P(-bayH, fsign * NAVE, eaveH - 2), P(bayH, fsign * NAVE, eaveH - 2), P(bayH, fsign * NAVE, ridgeY + 3), P(-bayH, fsign * NAVE, ridgeY + 3)];
  buckets[BRICK].quad(bc[0][0], bc[0][1], bc[0][2], bc[1][0], bc[1][1], bc[1][2], bc[2][0], bc[2][1], bc[2][2], bc[3][0], bc[3][1], bc[3][2], dnx, 0, dnz, sr, sg, sb);
  merlonLine(P(-bayH, fsign * NAVE, 0), P(bayH, fsign * NAVE, 0), ridgeY + 3, 5);
  win(0, fsign * NAVE, dnx, dnz, anx, anz, Math.max(9, Math.min(14, ACR * 0.2)), g + 18, eaveH + 4, ridgeY + 4, G_BIG, true);    // great window
  for (const s of [-1, 1] as const) win(s * ACR * 0.56, fsign * NAVE, dnx, dnz, anx, anz, 2.4, g + 13, g + 30, g + 35, G_NAVE, true);  // flanking lancets
  win(0, fsign * NAVE, dnx, dnz, anx, anz, 3.8, g, g + 15, g + 21, DOOR, false);                 // pointed entrance

  // ── two octagonal corner towers flanking the front, battlemented + pinnacle (cut down, but proud) ──
  const trad = Math.max(9, Math.min(16, Math.min(ACR, NAVE) * 0.16)), tTop = ridgeY + 4;
  for (const s of [-1, 1] as const) {
    const tc = P(s * ACR * 0.84, fsign * NAVE * 0.9, 0), ring = octRing(tc[0], tc[2], trad);
    walls(buckets[BRICK], ring, g - 4, tTop, STONE, 0);
    flatRoof(buckets[SHINGLE], ring, tTop + 0.3, ROOF);
    merlonRing(ring, tTop, 5);
    buckets[BRICK].box(tc[0], tc[2], 2, 2, tTop, tTop + 11, STONE, 0);                            // central pinnacle
    buckets[PLAIN].box(tc[0], tc[2], 2.4, 2.4, tTop + 11, tTop + 12.4, TRIM, 0);
    win(s * ACR * 0.84, fsign * (NAVE * 0.9 + trad * 0.95), dnx, dnz, anx, anz, 1.7, eaveH - 14, eaveH - 2, eaveH + 3, G_NAVE, true);  // lancet up each tower face
  }

  // ── buttresses between the nave windows + at the back corners, with pale weathering caps ──
  const buttress = (ac: number, dp: number, nx: number, nz: number) => {
    const c = P(ac, dp, 0), ox = c[0] + nx * 1.2, oz = c[2] + nz * 1.2;
    rotBox(buckets[BRICK], ox, oz, 2.2, 2.6, g - 4, eaveH + 2, ridgeAng, STONE);
    rotBox(buckets[PLAIN], ox, oz, 2.5, 2.9, eaveH + 2, eaveH + 3.2, ridgeAng, TRIM);
    buckets[BRICK].box(ox, oz, 1.4, 1.4, eaveH + 3.2, eaveH + 7, STONE, 0);
  };
  for (const s of [-1, 1] as const) for (const f of [-0.76, -0.34, 0.06, 0.46]) buttress(s * ACR, NAVE * f, anx * s, anz * s);
  for (const s of [-1, 1] as const) buttress(s * ACR * 0.96, -fsign * NAVE, -dnx, -dnz);

  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eaveH - 1.5, HALLOWEEN_BULBS);          // festive eave lights like the neighbours
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eaveH - 1.5);
}

// ---------- Georgian & Federal landmark mansions ----------
// A parameterized GAMBREL-roofed builder for the Salem mansions that share that barn-roof
// silhouette: Derby House (brick), Crowninshield-Bentley (mustard clapboard), and the Ropes
// Mansion (dove-grey clapboard). Built in OBB-local pt-space like firstPeriod/customHouse
// (z passed straight through). All decor materials are DoubleSide so winding is free — the
// quad normals are for sun shading only. The ridge runs parallel to the street facade.
type GambrelOpts = {
  wall: string; material: 'brick' | 'clap'; roof: string; trim: string;
  storeys?: number; dormers?: number; chimney?: 'ends4' | 'ridge2';
  entrance?: 'pediment' | 'ionic'; shutter?: string; quoins?: boolean;
};
// a footprint ring nudged outward from its centroid, so trim/cornice/stringcourse bands sit
// slightly PROUD of the wall instead of coplanar with it — kills the z-fighting flicker.
function expandRing(ring: number[], out: number): number[] {
  let cx = 0, cz = 0; const n = ring.length / 2;
  for (let i = 0; i < ring.length; i += 2) { cx += ring[i]; cz += ring[i + 1]; }
  cx /= n; cz /= n;
  const e: number[] = [];
  for (let i = 0; i < ring.length; i += 2) { const dx = ring[i] - cx, dz = ring[i + 1] - cz, d = Math.hypot(dx, dz) || 1; e.push(ring[i] + dx / d * out, ring[i + 1] + dz / d * out); }
  return e;
}
function gambrelHouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex, o: GambrelOpts) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const fs = frontSegment(b, index);
  const pW = fs.nx * (-sa) + fs.nz * ca, pL = fs.nx * ca + fs.nz * sa;   // street normal · each OBB axis
  const ridgeL = Math.abs(pW) >= Math.abs(pL);          // ridge ∥ facade: slopes face the street axis
  const A = ridgeL ? obb.hl : obb.hw, B = ridgeL ? obb.hw : obb.hl;
  const fsign = (ridgeL ? pW : pL) >= 0 ? 1 : -1;       // which front↔back side faces the street
  const P = (al: number, ac: number, y: number): [number, number, number] => ridgeL ? pt(al, ac, y) : pt(ac, al, y);
  const axx = ridgeL ? -sa : ca, axz = ridgeL ? ca : sa;          // world dir of +across (front)
  const dAng = ridgeL ? obb.ang : obb.ang + Math.PI / 2;          // box angle aligned to the ridge
  const storeys = o.storeys ?? 2.5, eaveH = g + (storeys >= 2.5 ? 44 : 36);
  const ov = 1.6, Ar = A + ov, Br = B + ov, kn = 0.64, r1 = B * 0.38, r2 = B * 0.14, yK = eaveH + r1, yR = yK + r2;
  const WALLBK = o.material === 'brick' ? BRICK : CLAP;
  tmp.set(o.trim); const tcr = tmp.r, tcg = tmp.g, tcb = tmp.b;

  if (o.material === 'brick') walls(buckets[BRICK], b.p, g - 4, eaveH, o.wall);
  else clad(buckets[CLAP], b.p, g - 2, eaveH, o.wall);
  walls(buckets[PLAIN], expandRing(b.p, 0.5), eaveH - 1.3, eaveH + 0.4, o.trim, 0);   // eave cornice band (proud, no z-fight)
  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eaveH - 1.5, HALLOWEEN_BULBS);   // festive eave lights like the neighbours (glow at night)
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eaveH - 1.5);

  tmp.set(o.roof); const rr = tmp.r, rg = tmp.g, rb = tmp.b;                       // gambrel: steep lower + shallow upper, outward normals
  for (const s of [1, -1] as const) {
    const e0 = P(-Ar, s * Br, eaveH), e1 = P(Ar, s * Br, eaveH), k0 = P(-Ar, s * kn * Br, yK), k1 = P(Ar, s * kn * Br, yK), u0 = P(-Ar, 0, yR), u1 = P(Ar, 0, yR);
    const loA = s * r1, loY = Br * (1 - kn), loN = Math.hypot(loA, loY), upA = s * r2, upY = kn * Br, upN = Math.hypot(upA, upY);
    const shLo = 0.82 + 0.18 * (loY / loN), shUp = 0.82 + 0.18 * (upY / upN);   // PLAIN bucket (untextured) so the slate colour reads true; bake a little slope shade
    buckets[PLAIN].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], k1[0], k1[1], k1[2], k0[0], k0[1], k0[2], axx * loA / loN, loY / loN, axz * loA / loN, rr * shLo, rg * shLo, rb * shLo);
    buckets[PLAIN].quad(k0[0], k0[1], k0[2], k1[0], k1[1], k1[2], u1[0], u1[1], u1[2], u0[0], u0[1], u0[2], axx * upA / upN, upY / upN, axz * upA / upN, rr * shUp, rg * shUp, rb * shUp);
  }
  tmp.set(o.wall); const wr = tmp.r, wg = tmp.g, wb = tmp.b;                       // gambrel-profile gable-end walls at ±A
  for (const sx of [1, -1] as const) {
    const nx = (ridgeL ? ca : -sa) * sx, nz = (ridgeL ? sa : ca) * sx;
    const p = [P(sx * A, B, eaveH), P(sx * A, kn * B, yK), P(sx * A, 0, yR), P(sx * A, -kn * B, yK), P(sx * A, -B, eaveH)];
    for (const [i, j] of [[1, 2], [2, 3], [3, 4]] as const)
      buckets[WALLBK].triUV(p[0][0], p[0][1], p[0][2], p[i][0], p[i][1], p[i][2], p[j][0], p[j][1], p[j][2], nx, 0, nz, wr, wg, wb, 0, 0, 0, 0, 0, 0);
  }

  const chim = (al: number, ac: number, top: number) => { const c = P(al, ac, 0); buckets[BRICK].box(c[0], c[2], 1.9, 1.9, eaveH + 3, top, '#7a4a39', 1); };
  if (o.chimney === 'ends4') { for (const sx of [1, -1] as const) for (const sz of [1, -1] as const) chim(sx * A * 0.82, sz * B * 0.4, yR + 4); }
  else for (const sx of [1, -1] as const) chim(sx * A * 0.34, 0, yR + 7);

  const nDorm = o.dormers ?? 3;                                                    // pedimented dormers seated on the front lower slope
  const dt = 0.32;                                                                 // fraction up the lower slope
  for (let i = 0; i < nDorm; i++) {
    const al = nDorm === 1 ? 0 : -A * 0.62 + (A * 1.24) * (i / (nDorm - 1));
    const baseY = eaveH + r1 * dt, ac = fsign * Br * (1 - dt * (1 - kn)), topY = baseY + 8, c = P(al, ac, 0), gc = P(al, ac + fsign * 2.4, 0);
    rotBox(buckets[WALLBK], c[0], c[2], 3, 2.4, baseY, topY, dAng, o.trim);
    rotBox(buckets[PLAIN], gc[0], gc[2], 1.6, 0.35, baseY + 1.4, topY - 1, dAng, '#26333c');
    const pl = P(al - 3.2, ac + fsign * 0.2, topY), pr = P(al + 3.2, ac + fsign * 0.2, topY), pk = P(al, ac + fsign * 0.2, topY + 4);
    buckets[WALLBK].triUV(pl[0], pl[1], pl[2], pr[0], pr[1], pr[2], pk[0], pk[1], pk[2], axx * fsign, 0, axz * fsign, tcr, tcg, tcb, 0, 0, 0, 0, 0, 0);
    rotBox(buckets[PLAIN], c[0], c[2], 3.5, 3, topY, topY + 1, dAng, o.roof);
  }

  // windows + doors via the shared facade renderer: framed glass, lit-at-night panes, real doors
  facades(buckets[PLAIN], b.p, eaveH, 2, Math.round(obb.cx * 13 + obb.cz * 7), true, !!o.shutter, false, g);

  const ac0 = fsign * B;                                                           // grand entrance frame (the door itself is drawn by facades)
  if (o.entrance === 'ionic') {
    for (const sx of [-1, 1]) { const cc = P(sx * 3.4, ac0 + fsign * 3.6, 0); buckets[PLAIN].box(cc[0], cc[2], 0.7, 0.7, g, g + 12, o.trim, 0); }
    const rc = P(0, ac0 + fsign * 3.4, 0); rotBox(buckets[PLAIN], rc[0], rc[2], 4.6, 4, g + 12, g + 13.6, dAng, o.trim);
  } else {
    for (const sx of [-1, 1]) { const pc = P(sx * 2.9, ac0 + fsign * 0.4, 0); rotBox(buckets[PLAIN], pc[0], pc[2], 0.5, 0.5, g, g + 10.5, dAng, o.trim); }
    const pl = P(-3.4, ac0 + fsign * 0.5, g + 10.5), pr = P(3.4, ac0 + fsign * 0.5, g + 10.5), pk = P(0, ac0 + fsign * 0.5, g + 14);
    buckets[PLAIN].triUV(pl[0], pl[1], pl[2], pr[0], pr[1], pr[2], pk[0], pk[1], pk[2], axx * fsign, 0, axz * fsign, tcr, tcg, tcb, 0, 0, 0, 0, 0, 0);
  }

  if (o.quoins) for (const sx of [1, -1] as const) for (const sz of [1, -1] as const) {
    const c = P(sx * (A - 0.5), sz * (B - 0.5), 0);
    for (let y = g + 1; y < eaveH - 2; y += 3.4) buckets[PLAIN].box(c[0], c[2], 1.1, 1.1, y, y + 1.9, o.trim, 0);
  }
}
function ropesMansion(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  gambrelHouse(buckets, b, g, index, { wall: '#e4e2da', material: 'clap', roof: '#b6bbc3', trim: '#fbfaf7', storeys: 2.5, dormers: 3, chimney: 'ridge2', entrance: 'ionic', quoins: true, shutter: '#23262a' });   // white Georgian w/ black shutters + light slate roof — the Hocus Pocus house (sources: stark-white facade, NOT grey/red)
}
function derbyHouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  gambrelHouse(buckets, b, g, index, { wall: '#9c4d3c', material: 'brick', roof: '#aeb3bb', trim: '#efe9dc', storeys: 2.5, dormers: 3, chimney: 'ends4', entrance: 'pediment' });   // 1762 red brick, 4 end-wall chimneys
}
function crowninshieldBentley(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  gambrelHouse(buckets, b, g, index, { wall: '#c69a3f', material: 'clap', roof: '#b3a892', trim: '#f3efe3', storeys: 2.5, dormers: 3, chimney: 'ridge2', entrance: 'pediment' });   // mustard-gold clapboard, weathered-shingle roof
}

// Gardner-Pingree House (McIntire, 1804) — three-storey red Federal brick banded by white marble
// stringcourses, a low hip rimmed by a white roof balustrade, and the signature semicircular domed
// Corinthian entrance portico. Shortened third-floor windows, black shutters.
function gardnerPingree(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1, FW = front * (W + 0.5);
  const WHITE = '#efe9dc', eaveH = g + 64;
  const exr = expandRing(b.p, 0.5);                                     // proud bands so the marble trim doesn't z-fight the brick
  walls(buckets[BRICK], b.p, g - 4, eaveH, '#9c4d3c');                  // red Flemish-bond brick
  walls(buckets[PLAIN], exr, g + 1, g + 2.4, WHITE, 0);                 // marble water table
  for (const y of [g + 22, g + 43]) walls(buckets[PLAIN], exr, y, y + 1.6, WHITE, 0);   // marble stringcourses between the 3 floors
  walls(buckets[PLAIN], exr, eaveH - 2.2, eaveH, WHITE, 0);             // cornice band
  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eaveH - 1.5, HALLOWEEN_BULBS);   // festive eave lights (glow at night)
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eaveH - 1.5);
  flatRoof(buckets[SHINGLE], b.p, eaveH + 1, '#4a4e54');                // low hip, reads flat
  for (let i = 0; i < b.p.length; i += 2) {                             // white roof balustrade: posts + rail
    const ax = b.p[i], az = b.p[i + 1], bx = b.p[(i + 2) % b.p.length], bz = b.p[(i + 3) % b.p.length];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz); if (len < 2) continue;
    for (let d = 1.5; d < len; d += 3) buckets[PLAIN].box(ax + (dx / len) * d, az + (dz / len) * d, 0.5, 0.5, eaveH + 1, eaveH + 5, WHITE, 0);
    rotBox(buckets[PLAIN], (ax + bx) / 2, (az + bz) / 2, len / 2, 0.5, eaveH + 5, eaveH + 5.8, Math.atan2(dz, dx), WHITE);
  }
  for (const sx of [1, -1] as const) { const c = pt(sx * L * 0.4, 0, 0); buckets[BRICK].box(c[0], c[2], 1.8, 1.8, eaveH, eaveH + 6, '#7a4a39', 1); }   // 2 low interior chimneys
  // 3 floors of framed glass + a door, via the shared facade renderer (black shutters, lit-at-night)
  facades(buckets[PLAIN], b.p, eaveH, 3, Math.round(obb.cx * 9 + obb.cz * 5), true, true, false, g);
  for (const t of [-0.95, -0.32, 0.32, 0.95]) { const c = pt(t * 5, FW + front * 4.5 * (1 - t * t * 0.5), 0); buckets[PLAIN].box(c[0], c[2], 0.7, 0.7, g, g + 13, WHITE, 0); }   // curved colonnade (frames the facade door)
  const dc = pt(0, FW + front * 3, 0); tmp.set('#dcd6c8'); cone(buckets[PLAIN], dc[0], g + 13, dc[2], 5.4, 3, tmp.clone());   // shallow dome
}

// Yin Yu Tang (荫余堂) — the Qing-dynasty Huizhou house at the PEM. Tall plain whitewashed walls,
// a low dark inward-pitching tile roof barely seen from outside, and the signature stepped
// "horse-head" firewalls (马头墙) rising over the gable ends, each step capped in dark tile.
function yinYuTang(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const WHITE = '#e9e6dc', GREY = '#cbc7bc', TILE = '#333436';
  const eaveH = g + 34;
  walls(buckets[PLAIN], b.p, g - 3, eaveH, WHITE, 0);                   // tall plain lime-plaster walls
  walls(buckets[PLAIN], b.p, g - 3, g + 6, GREY, 0);                    // grimier weathered base
  flatRoof(buckets[SHINGLE], b.p, eaveH + 2, TILE);                     // low dark inward-pitch tile roof
  const seg = [[0, 0.34, 25], [0.34, 0.67, 17], [0.67, 1, 9]] as const; // stepped horse-head gable on each end
  for (const sx of [1, -1] as const) for (const sz of [1, -1] as const) for (const [z0, z1, h] of seg) {
    const mid = sz * W * (z0 + z1) / 2, half = W * (z1 - z0) / 2, c = pt(sx * L, mid, 0);
    rotBox(buckets[PLAIN], c[0], c[2], 0.7, half, eaveH, eaveH + h, obb.ang, WHITE);
    rotBox(buckets[SHINGLE], c[0], c[2], 1.2, half + 0.5, eaveH + h, eaveH + h + 1.3, obb.ang, TILE);   // dark tile cap
  }
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1, dh = pt(0, front * (W + 0.3), 0);   // recessed door + carved hood (门罩)
  rotBox(buckets[PLAIN], dh[0], dh[2], 2.4, 0.3, g, g + 11, obb.ang, '#3b342c');
  rotBox(buckets[BRICK], dh[0], dh[2], 3.4, 0.5, g + 11, g + 12.4, obb.ang, '#6b6258');
  const hc = pt(0, front * (W + 1.2), 0); rotBox(buckets[SHINGLE], hc[0], hc[2], 3.8, 1.4, g + 12.4, g + 13.4, obb.ang, TILE);
}

// ---------- Federal mansions & blocks (low hip / gable, c. 1800–1925) ----------
// Shallow Federal hip roof in the PLAIN bucket (so the slate colour reads true), four trapezoid
// slopes from the eave rectangle up to a small top deck.
function lowHip(buckets: Bucket[], pt: (lx: number, lz: number, y: number) => [number, number, number], L: number, W: number, eaveH: number, ov: number, rise: number, roofHex: string) {
  const Lr = L + ov, Wr = W + ov, tL = L * 0.4, tW = W * 0.4, topY = eaveH + rise;
  tmp.set(roofHex); const r = tmp.r, gg = tmp.g, bb = tmp.b;
  const E = [pt(-Lr, -Wr, eaveH), pt(Lr, -Wr, eaveH), pt(Lr, Wr, eaveH), pt(-Lr, Wr, eaveH)];
  const T = [pt(-tL, -tW, topY), pt(tL, -tW, topY), pt(tL, tW, topY), pt(-tL, tW, topY)];
  const sh = [0.9, 1.0, 0.86, 0.96];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, s = sh[i]; buckets[PLAIN].quad(E[i][0], E[i][1], E[i][2], E[j][0], E[j][1], E[j][2], T[j][0], T[j][1], T[j][2], T[i][0], T[i][1], T[i][2], 0, 0.7, 0, r * s, gg * s, bb * s); }
  buckets[PLAIN].quad(T[0][0], T[0][1], T[0][2], T[1][0], T[1][1], T[1][2], T[2][0], T[2][1], T[2][2], T[3][0], T[3][1], T[3][2], 0, 1, 0, r, gg, bb);
}
// a railing around the footprint at height y — plain Federal balustrade, or a denser "fret" lattice
function roofRail(buckets: Bucket[], ring: number[], y: number, h: number, col: string, fret: boolean) {
  for (let i = 0; i < ring.length; i += 2) {
    const aX = ring[i], aZ = ring[i + 1], bX = ring[(i + 2) % ring.length], bZ = ring[(i + 3) % ring.length];
    const dx = bX - aX, dz = bZ - aZ, len = Math.hypot(dx, dz); if (len < 2) continue;
    const ang = Math.atan2(dz, dx);
    for (let d = 1; d < len; d += fret ? 1.7 : 3) buckets[PLAIN].box(aX + dx / len * d, aZ + dz / len * d, 0.45, 0.45, y, y + h, col, 0);
    rotBox(buckets[PLAIN], (aX + bX) / 2, (aZ + bZ) / 2, len / 2, 0.45, y + h, y + h + 0.8, ang, col);
    if (fret) rotBox(buckets[PLAIN], (aX + bX) / 2, (aZ + bZ) / 2, len / 2, 0.4, y + h * 0.5, y + h * 0.5 + 0.5, ang, col);
  }
}
type FederalOpts = {
  wall: string; material: 'brick' | 'clap'; trim: string; roof: string;
  storeys?: number; roofKind?: 'hip' | 'gable' | 'flat'; balustrade?: 'plain' | 'fret';
  stringcourses?: boolean; chimney?: 'ends2' | 'interior4' | 'none'; bays?: number;
  entrance?: 'pediment' | 'fan' | 'portico' | 'colossal' | 'canopy'; palladian?: 'single' | 'row';
  cupola?: boolean; flag?: boolean; shutter?: string; door?: string;
};
function federalHouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex, o: FederalOpts) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1, FW = front * (W + 0.4);
  const nx = -sa * front, nz = ca * front;
  const storeys = o.storeys ?? 2.5, floors = Math.max(2, Math.round(storeys)), eaveH = g + floors * 19 + 7;   // size walls to the 19px window rhythm
  const WALLBK = o.material === 'brick' ? BRICK : CLAP;
  tmp.set(o.trim); const tr = tmp.r, tg = tmp.g, tb = tmp.b;

  if (o.material === 'brick') walls(buckets[BRICK], b.p, g - 4, eaveH, o.wall);
  else clad(buckets[CLAP], b.p, g - 2, eaveH, o.wall);
  const exr = expandRing(b.p, 0.5);                                                         // proud trim bands (no z-fight)
  walls(buckets[PLAIN], exr, g + 0.5, g + 1.8, o.trim, 0);                                  // water table
  if (o.stringcourses) { const per = (eaveH - g) / floors; for (let i = 1; i < floors; i++) walls(buckets[PLAIN], exr, g + per * i, g + per * i + 1.2, o.trim, 0); }
  walls(buckets[PLAIN], exr, eaveH - 1.6, eaveH + 0.3, o.trim, 0);                          // cornice
  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eaveH - 1.5, HALLOWEEN_BULBS);   // festive eave lights (glow at night, like the neighbours)
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eaveH - 1.5);

  // concave/campus footprints force flat: an OBB gable or hip here would drape
  // a slab over the courtyard (see obbFill above — the Cape Ann Museum lesson)
  const okObbRoof = (ringAreaM2(b.p) * 64) / Math.max(1, 4 * L * W) >= OBB_ROOF_MIN_FILL;
  const ov = 1.3, rk = okObbRoof ? (o.roofKind ?? 'hip') : 'flat', hipRise = storeys >= 3 ? 12 : 9;
  let roofTopY = eaveH + 2;
  if (rk === 'flat') flatRoof(buckets[PLAIN], b.p, eaveH + 1.5, o.roof);
  else if (rk === 'gable') {
    const ridgeY = eaveH + Math.min(W * 0.7, 22), Lr = L + ov, Wr = W + ov; roofTopY = ridgeY;
    tmp.set(o.roof); const r = tmp.r, gg = tmp.g, bb = tmp.b;
    for (const s of [1, -1] as const) { const e0 = pt(-Lr, s * Wr, eaveH), e1 = pt(Lr, s * Wr, eaveH), r0 = pt(-Lr, 0, ridgeY), r1 = pt(Lr, 0, ridgeY); buckets[PLAIN].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], -sa * s * 0.5, 0.85, ca * s * 0.5, r * 0.93, gg * 0.93, bb * 0.93); }
    tmp.set(o.wall); const wr = tmp.r, wg = tmp.g, wb = tmp.b;
    for (const sx of [1, -1] as const) { const a = pt(sx * L, W, eaveH), b2 = pt(sx * L, -W, eaveH), pk = pt(sx * L, 0, ridgeY); buckets[WALLBK].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ca * sx, 0, sa * sx, wr, wg, wb, 0, 0, 0, 0, 0, 0); }
  } else { lowHip(buckets, pt, L, W, eaveH, ov, hipRise, o.roof); roofTopY = eaveH + hipRise; }

  if (o.balustrade) roofRail(buckets, b.p, eaveH + (rk === 'flat' ? 1.6 : 0.3), 4.2, o.trim, o.balustrade === 'fret');

  const chim = (lx: number, lz: number) => { const c = pt(lx, lz, 0); buckets[BRICK].box(c[0], c[2], 1.8, 1.8, eaveH, roofTopY + 9, '#7a4a39', 1); };
  if (o.chimney === 'ends2') for (const s of [1, -1] as const) chim(s * L * 0.82, 0);
  else if (o.chimney === 'interior4') for (const sx of [1, -1] as const) for (const sz of [1, -1] as const) chim(sx * L * 0.5, sz * W * 0.38);

  // windows + doors via the shared facade renderer (framed glass, lit-at-night panes, real doors)
  // o.shutter is the REAL shutter color from the photo — pass it through rather than
  // letting the generic palette pick (Heard House green, Trask black, RAA&M red)
  facades(buckets[PLAIN], b.p, eaveH, floors, Math.round(obb.cx * 11 + obb.cz * 3), true, !!o.shutter, false, g, undefined, o.door, o.shutter);

  // grand entrance frame on the front (the door itself is drawn by facades)
  const ent = o.entrance ?? 'fan';
  if (ent === 'colossal') {                                       // Andrew Safford — 4 giant columns ground→roof
    const ph = eaveH - 2;
    for (const t of [-1, -0.34, 0.34, 1]) { const c = pt(t * L * 0.34, FW + front * 2.6, 0); buckets[PLAIN].box(c[0], c[2], 1.2, 1.2, g, ph, o.trim, 0); }
    const ec = pt(0, FW + front * 2.6, 0); rotBox(buckets[PLAIN], ec[0], ec[2], L * 0.4, 2.6, ph, ph + 3.6, obb.ang, o.trim);
    const pl = pt(-L * 0.38, FW + front * 2.8, ph + 3.6), pr = pt(L * 0.38, FW + front * 2.8, ph + 3.6), pk = pt(0, FW + front * 2.8, ph + 9);
    buckets[PLAIN].triUV(pl[0], pl[1], pl[2], pr[0], pr[1], pr[2], pk[0], pk[1], pk[2], nx, 0, nz, tr, tg, tb, 0, 0, 0, 0, 0, 0);
  } else if (ent === 'portico') {
    for (const s of [-1, 1]) { const c = pt(s * 3.2, FW + front * 3.2, 0); buckets[PLAIN].box(c[0], c[2], 0.8, 0.8, g, g + 12, o.trim, 0); }
    const rc = pt(0, FW + front * 3, 0); rotBox(buckets[PLAIN], rc[0], rc[2], 4.4, 3.4, g + 12, g + 13.6, obb.ang, o.trim);
    const pl = pt(-4.6, FW + front * 3.2, g + 13.6), pr = pt(4.6, FW + front * 3.2, g + 13.6), pk = pt(0, FW + front * 3.2, g + 17);
    buckets[PLAIN].triUV(pl[0], pl[1], pl[2], pr[0], pr[1], pr[2], pk[0], pk[1], pk[2], nx, 0, nz, tr, tg, tb, 0, 0, 0, 0, 0, 0);
  } else if (ent === 'canopy') {
    const rc = pt(0, FW + front * 2.4, 0); rotBox(buckets[PLAIN], rc[0], rc[2], 4, 2.6, g + 10, g + 11.4, obb.ang, '#2c3550');   // awning
  } else if (ent === 'pediment') {
    for (const s of [-1, 1]) { const c = pt(s * 2.9, FW + front * 0.4, 0); rotBox(buckets[PLAIN], c[0], c[2], 0.5, 0.5, g, g + 10.5, obb.ang, o.trim); }
    const pl = pt(-3.4, FW + front * 0.5, g + 10.5), pr = pt(3.4, FW + front * 0.5, g + 10.5), pk = pt(0, FW + front * 0.5, g + 14);
    buckets[PLAIN].triUV(pl[0], pl[1], pl[2], pr[0], pr[1], pr[2], pk[0], pk[1], pk[2], nx, 0, nz, tr, tg, tb, 0, 0, 0, 0, 0, 0);
  } else {                                                        // 'fan' — pilasters + semicircular fanlight
    for (const s of [-1, 1]) { const c = pt(s * 2.7, FW + front * 0.4, 0); rotBox(buckets[PLAIN], c[0], c[2], 0.4, 0.4, g, g + 10.5, obb.ang, o.trim); }
    tmp.set('#d7d2c4'); const fr = tmp.r, fg = tmp.g, fb = tmp.b; const R = 2.5, ctr = pt(0, FW + front * 0.4, g + 10.6);
    for (let i = 0; i < 6; i++) { const a0 = Math.PI * i / 6, a1 = Math.PI * (i + 1) / 6, p0 = pt(Math.cos(a0) * R, FW + front * 0.4, g + 10.6 + Math.sin(a0) * R), p1 = pt(Math.cos(a1) * R, FW + front * 0.4, g + 10.6 + Math.sin(a1) * R); buckets[PLAIN].triUV(ctr[0], ctr[1], ctr[2], p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], nx, 0, nz, fr, fg, fb, 0, 0, 0, 0, 0, 0); }
  }

  if (o.cupola) { const cc = pt(0, 0, 0), base = roofTopY + 1; buckets[PLAIN].box(cc[0], cc[2], 3, 3, base, base + 3, o.trim, 0); walls(buckets[PLAIN], octRing(cc[0], cc[2], 2.4), base + 3, base + 9, o.trim, 0); tmp.set('#cdd2cf'); cone(buckets[PLAIN], cc[0], base + 9, cc[2], 2.6, 3, tmp.clone()); }
  if (o.flag) { const fc = pt(L * 0.5, 0, 0); buckets[PLAIN].box(fc[0], fc[2], 0.4, 0.4, roofTopY, roofTopY + 16, '#d8d2c4', 0); buckets[GLOW].box(fc[0] + 3, fc[2], 3, 0.2, roofTopY + 11, roofTopY + 15, '#b03030', 0); }
}

// Gothic Revival GRANITE churches (First Church, St. Peter's): a grey-stone gable nave with tall
// pointed lancet windows and a square crenellated front-centre tower (NO spire) — a little castle.
function salemChurch(buckets: Bucket[], b: Building, g: number, index: WorldIndex, o: { stone: string; quatrefoil?: boolean }) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1;
  const eaveH = g + 30;
  walls(buckets[BRICK], b.p, g - 3, eaveH, o.stone);                                    // granite ashlar
  const ridgeY = eaveH + Math.min(W * 0.85, 19), Lr = L + 1, Wr = W + 1;
  tmp.set('#34343a'); const rr = tmp.r, rg = tmp.g, rb = tmp.b;                          // dark slate roof
  for (const s of [1, -1] as const) { const e0 = pt(-Lr, s * Wr, eaveH), e1 = pt(Lr, s * Wr, eaveH), r0 = pt(-Lr, 0, ridgeY), r1 = pt(Lr, 0, ridgeY); buckets[PLAIN].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], -sa * s * 0.5, 0.85, ca * s * 0.5, rr, rg, rb); }
  tmp.set(o.stone); const sr = tmp.r, sg = tmp.g, sb = tmp.b;
  for (const sx of [1, -1] as const) { const a = pt(sx * L, W, eaveH), b2 = pt(sx * L, -W, eaveH), pk = pt(sx * L, 0, ridgeY); buckets[BRICK].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ca * sx, 0, sa * sx, sr, sg, sb, 0, 0, 0, 0, 0, 0); }
  // tall pointed lancet windows down the long sides (GLOW stained glass)
  tmp.set('#3c4a6e'); const wr = tmp.r, wg = tmp.g, wb = tmp.b;
  const lancet = (lx: number, sLz: number) => {
    const lzf = sLz * (W + 0.2), nx = -sa * sLz, nz = ca * sLz, C = (sx: number, y: number): [number, number, number] => pt(lx + sx * 1.3, lzf, y);
    const a = C(-1, g + 8), bb = C(1, g + 8), cc = C(1, g + 22), dd = C(-1, g + 22), apex = pt(lx, lzf, g + 26);
    buckets[GLOW].quad(a[0], a[1], a[2], bb[0], bb[1], bb[2], cc[0], cc[1], cc[2], dd[0], dd[1], dd[2], nx, 0, nz, wr, wg, wb);
    buckets[GLOW].triUV(dd[0], dd[1], dd[2], cc[0], cc[1], cc[2], apex[0], apex[1], apex[2], nx, 0, nz, wr, wg, wb, 0, 0, 0, 0, 0, 0);
  };
  for (const s of [1, -1] as const) for (let i = 0; i < 4; i++) lancet(-L * 0.6 + L * 1.2 * (i / 3), s);
  // square crenellated front-centre tower
  const tw = Math.min(L * 0.4, 12), ring: number[] = [], TP = (lx: number, lz: number) => { const p = pt(lx, lz, 0); ring.push(p[0], p[2]); };
  TP(-tw, front * (W - tw * 0.3)); TP(tw, front * (W - tw * 0.3)); TP(tw, front * (W + tw * 1.6)); TP(-tw, front * (W + tw * 1.6));
  const towerH = ridgeY + 13;
  walls(buckets[BRICK], ring, g - 3, towerH, o.stone, 0);
  flatRoof(buckets[SHINGLE], ring, towerH + 0.4, '#2b2b30');
  for (let i = 0; i < ring.length; i += 2) {                                            // crenellations + corner pinnacles
    const aX = ring[i], aZ = ring[i + 1], bX = ring[(i + 2) % ring.length], bZ = ring[(i + 3) % ring.length], dx = bX - aX, dz = bZ - aZ, len = Math.hypot(dx, dz); if (len < 2) continue;
    for (let d = 1.6; d < len - 1; d += 4) buckets[BRICK].box(aX + dx / len * d, aZ + dz / len * d, 1.2, 1.2, towerH, towerH + 3.5, o.stone, 0);
    buckets[BRICK].box(aX, aZ, 1.5, 1.5, towerH, towerH + 5.5, o.stone, 0);
  }
  // tower front: a Tudor-arch door + a tall lancet (or quatrefoil) window above
  const tf = front * (W + tw * 1.6), nx = -sa * front, nz = ca * front;
  const door = pt(0, tf, 0); rotBox(buckets[PLAIN], door[0], door[2], 2.2, 0.3, g, g + 11, obb.ang, '#2c2620');
  if (o.quatrefoil) { tmp.set('#3c4a6e'); const q = pt(0, tf, g + 22); for (const [dx, dy] of [[0, 1.6], [0, -1.6], [1.6, 0], [-1.6, 0]] as const) { const c = pt(dx, tf, g + 22 + dy); octoCanopy(buckets[GLOW], c[0], c[1], c[2], 1.3, tmp.clone()); } }
  else { tmp.set('#3c4a6e'); const wr2 = tmp.r, wg2 = tmp.g, wb2 = tmp.b, C = (sx: number, y: number): [number, number, number] => pt(sx * 1.5, tf, y); const a = C(-1, g + 15), bb = C(1, g + 15), cc = C(1, g + 27), dd = C(-1, g + 27), apex = pt(0, tf, g + 32); buckets[GLOW].quad(a[0], a[1], a[2], bb[0], bb[1], bb[2], cc[0], cc[1], cc[2], dd[0], dd[1], dd[2], nx, 0, nz, wr2, wg2, wb2); buckets[GLOW].triUV(dd[0], dd[1], dd[2], cc[0], cc[1], cc[2], apex[0], apex[1], apex[2], nx, 0, nz, wr2, wg2, wb2, 0, 0, 0, 0, 0, 0); }
}

// Pedrick Store House — a long, low, bare-wood maritime warehouse: steep side-gable, big plank
// cargo doors, a gable hoist beam, a few small windows.
function warehouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex, o: { wall: string; roof: string }) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1;
  const eaveH = g + 22;
  clad(buckets[CLAP], b.p, g - 2, eaveH, o.wall);
  const ridgeY = eaveH + Math.min(W * 1.05, 24), Lr = L + 1.4, Wr = W + 1.4;
  tmp.set(o.roof); const rr = tmp.r, rg = tmp.g, rb = tmp.b;
  for (const s of [1, -1] as const) { const e0 = pt(-Lr, s * Wr, eaveH), e1 = pt(Lr, s * Wr, eaveH), r0 = pt(-Lr, 0, ridgeY), r1 = pt(Lr, 0, ridgeY); buckets[PLAIN].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], -sa * s * 0.5, 0.85, ca * s * 0.5, rr, rg, rb); }
  tmp.set(o.wall); const wr = tmp.r, wg = tmp.g, wb = tmp.b;
  for (const sx of [1, -1] as const) { const a = pt(sx * L, W, eaveH), b2 = pt(sx * L, -W, eaveH), pk = pt(sx * L, 0, ridgeY); buckets[CLAP].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ca * sx, 0, sa * sx, wr, wg, wb, 0, 0, 0, 0, 0, 0); }
  const fz = front * (W + 0.2);
  for (const lx of [-L * 0.4, L * 0.4]) { const d = pt(lx, fz, 0); rotBox(buckets[PLAIN], d[0], d[2], 3, 0.3, g, g + 13, obb.ang, '#4a3f30'); }   // cargo doors
  const up = pt(0, fz, 0); rotBox(buckets[PLAIN], up[0], up[2], 2.4, 0.3, g + 15, eaveH - 1, obb.ang, '#4a3f30');                                  // upper loading door
  const hb = pt(0, front * (W + 4), ridgeY - 3); buckets[PLAIN].box(hb[0], hb[2], 0.5, 3.5, ridgeY - 3.5, ridgeY - 2.5, '#34291e', 0);            // hoist beam
}

// Friendship of Salem — the replica 1797 East Indiaman at Derby Wharf: black hull + cream sheer
// stripe, three masts (main tallest), crossed yards (furled), a long bowsprit. The big surprise.
// Defaults are Salem's Friendship (171 ft, 128 ft mainmast). USS Constitution is
// a different order of ship — 204 ft with a 220 ft mainmast, which is within a
// foot of the Bunker Hill Monument's 221 ft — so her rig is passed in rather
// than baked, and Friendship's numbers stay exactly as they were.
// stripeY = the sheer stripe's band relative to the deck. Friendship's default is
// a thin 2.5 px accent; Constitution's white gunport stripe is the single thing
// that makes her recognisable at a distance, so hers is passed in much wider.
type ShipOpts = { mastMul?: number; yardMul?: number; hull?: string; stripe?: string; stripeY?: [number, number] };
function tallShip(buckets: Bucket[], b: Building, g: number, index: WorldIndex, o: ShipOpts = {}) {
  const obb = obbOf(b.p);
  // obbOf does NOT guarantee hl is the long axis — the Charlestown Navy Yard's
  // 405 m Rope Walk comes back with its length in hw — so pick the long axis and
  // turn the working angle with it, or the ship is built broadside-on.
  const long = obb.hl >= obb.hw;
  const ang = long ? obb.ang : obb.ang + Math.PI / 2;
  const L = long ? obb.hl : obb.hw, beam = long ? obb.hw : obb.hl;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const W = Math.min(beam, L * 0.22);
  const MM = o.mastMul ?? 1, YM = o.yardMul ?? 1;
  const HULL = o.hull ?? '#2a2a30', CREAM = o.stripe ?? '#cdb985', DECK = '#6b5a42', SPAR = '#4a3d2e';
  const wl = g, deck = g + 24;                                                                         // tall freeboard so it reads as a hull
  rotBox(buckets[PLAIN], obb.cx, obb.cz, L * 0.82, W, wl, deck, ang, HULL);                            // hull
  for (const s of [1, -1] as const) { const a = pt(L * 0.82, s * W, wl), b2 = pt(L * 0.82, s * W, deck), t1 = pt(L * 1.04, 0, deck), t0 = pt(L * 1.04, 0, wl + 2); buckets[PLAIN].quad(a[0], a[1], a[2], b2[0], b2[1], b2[2], t1[0], t1[1], t1[2], t0[0], t0[1], t0[2], ca * s, 0.2, sa * s, 0.17, 0.17, 0.19); }   // bow wedge
  const [sy0, sy1] = o.stripeY ?? [-5, -2.5];
  rotBox(buckets[PLAIN], obb.cx, obb.cz, L * 0.83, W + 0.4, deck + sy0, deck + sy1, ang, CREAM);       // sheer stripe along the gunports
  rotBox(buckets[PLAIN], obb.cx, obb.cz, L * 0.8, W - 0.6, deck, deck + 0.8, ang, DECK);               // deck
  const masts: [number, number][] = [[L * 0.46, L * 0.46 * MM], [-L * 0.04, L * 0.56 * MM], [-L * 0.5, L * 0.36 * MM]]; // fore / main / mizzen (main tallest)
  for (const [mlx, mh] of masts) {
    const m = pt(mlx, 0, 0); buckets[PLAIN].box(m[0], m[2], 1.1, 1.1, deck, deck + mh, SPAR, 0);
    for (let k = 0; k < 3; k++) { const yh = deck + mh * (0.45 + 0.18 * k), yl = W * (1.5 - 0.32 * k) * YM; rotBox(buckets[PLAIN], m[0], m[2], 0.5, yl, yh, yh + 0.9, ang, SPAR); }
  }
  const bsp = pt(L + L * 0.28, 0, 0); rotBox(buckets[PLAIN], bsp[0], bsp[2], L * 0.3, 0.6, deck + 5, deck + 7.5, ang, SPAR);                        // bowsprit
}

// tiny utilitarian outbuildings: a one-room brick gable box (the Scale House by the Custom House).
function brickShed(buckets: Bucket[], b: Building, g: number, index: WorldIndex, o: { wall: string; roof: string }) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw, eaveH = g + 11;
  walls(buckets[BRICK], b.p, g - 2, eaveH, o.wall);
  const ridgeY = eaveH + Math.min(W * 0.9, 8), Lr = L + 0.8, Wr = W + 0.8;
  tmp.set(o.roof); const rr = tmp.r, rg = tmp.g, rb = tmp.b;
  for (const s of [1, -1] as const) { const e0 = pt(-Lr, s * Wr, eaveH), e1 = pt(Lr, s * Wr, eaveH), r0 = pt(-Lr, 0, ridgeY), r1 = pt(Lr, 0, ridgeY); buckets[PLAIN].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], -sa * s * 0.5, 0.85, ca * s * 0.5, rr, rg, rb); }
  tmp.set(o.wall); const wr = tmp.r, wg = tmp.g, wb = tmp.b;
  for (const sx of [1, -1] as const) { const a = pt(sx * L, W, eaveH), b2 = pt(sx * L, -W, eaveH), pk = pt(sx * L, 0, ridgeY); buckets[BRICK].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ca * sx, 0, sa * sx, wr, wg, wb, 0, 0, 0, 0, 0, 0); }
}

// ---------- Beverly bespoke heroes (specs: docs/research/beverly.md) ----------

// Beverly Depot (1897, Bradford Lee Gilbert) — Richardsonian Romanesque: buff/cream brick
// over a rough red-brown sandstone base (~lower third), one tall waiting-room storey, and
// a broad red shingle hip whose VERY deep eaves ring the whole building as platform
// canopies carried on dark curved brackets. One hip dormer; today a steakhouse + live MBTA stop.
function beverlyDepot(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const BUFF = '#ddd0ad', STONE = '#7c4a37', STONE2 = '#6a3d2c', TRIM = '#b0512e',
        RED = '#a53a28', BRKT = '#42302a', GLASS = '#2b3a44';
  let obb = obbOf(b.p);
  if (obb.hw > obb.hl) obb = { cx: obb.cx, cz: obb.cz, ang: obb.ang + Math.PI / 2, hl: obb.hw, hw: obb.hl };   // ridge along the true long axis
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const eave = g + 30, base = g + 10;                                            // one generous storey; stone base = lower third

  // rock-faced sandstone base, proud of the brick, two rusticated courses
  walls(buckets[PLAIN], expandRing(b.p, 0.7), g - 4, base, STONE, 0);
  walls(buckets[PLAIN], expandRing(b.p, 0.9), g + 2.6, g + 3.4, STONE2, 0);
  walls(buckets[PLAIN], expandRing(b.p, 0.9), g + 6.2, g + 7, STONE2, 0);

  // buff brick above; red-orange stone-cap + lintel courses carry the trim colour
  walls(buckets[BRICK], b.p, base, eave, BUFF);
  walls(buckets[PLAIN], expandRing(b.p, 0.5), base, base + 1.3, TRIM, 0);
  walls(buckets[PLAIN], expandRing(b.p, 0.5), g + 19.4, g + 20.6, TRIM, 0);
  facades(buckets[PLAIN], b.p, eave, 1, 1897, true, false, false, g);

  // broad hip, VERY deep eaves = the all-round platform canopy (ov 16 ≈ 2 m — intentional)
  const OV = 16, rise = Math.max(18, Math.min(W * 0.95, 28));
  rotBox(buckets[PLAIN], obb.cx, obb.cz, L + OV - 0.2, W + OV - 0.2, eave - 1.2, eave + 0.3, obb.ang, '#8a4230');   // soffit slab + fascia lip
  hipRoof(buckets[SHINGLE], obb, eave, rise, OV, RED, false);

  // rows of dark eave brackets carrying the canopy (the curved braces, as radial posts)
  for (const s of [1, -1] as const) {
    for (let lx = -L + 7; lx <= L - 7; lx += 13) { const c = pt(lx, s * (W + 0.3 + OV * 0.42), 0); rotBox(buckets[PLAIN], c[0], c[2], 0.7, OV * 0.42, eave - 6, eave - 1.1, obb.ang, BRKT); }
    for (let lz = -W + 7; lz <= W - 7; lz += 13) { const c = pt(s * (L + 0.3 + OV * 0.42), lz, 0); rotBox(buckets[PLAIN], c[0], c[2], OV * 0.42, 0.7, eave - 6, eave - 1.1, obb.ang, BRKT); }
  }

  // one hip dormer on the street-facing slope
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1;
  const dLz = front * (W * 0.72), surf = eave + rise * (1 - Math.abs(dLz) / (W + OV));
  const dTop = Math.min(surf + 8, eave + rise - 4.5);                            // never pokes the ridge
  const dc = pt(0, dLz, 0);
  rotBox(buckets[PLAIN], dc[0], dc[2], 6, 4.5, surf - 3, dTop, obb.ang, BUFF);
  const dw = pt(0, dLz + front * 4.7, 0);
  rotBox(buckets[PLAIN], dw[0], dw[2], 3, 0.35, surf + 1.5, dTop - 1.6, obb.ang, GLASS);
  hipRoof(buckets[SHINGLE], { cx: dc[0], cz: dc[2], ang: obb.ang, hl: 6, hw: 4.5 }, dTop, 3.5, 0.9, RED, false);

  // buff-brick chimney breaking the roofline
  const ch = pt(L * 0.3, 0, 0);
  buckets[BRICK].box(ch[0], ch[2], 2.1, 2.1, eave, eave + rise + 8, '#cbbd96', 1);

  // warm steakhouse sign glowing under the canopy by the door
  const fang = Math.atan2(fs.tz, fs.tx);
  rotBox(buckets[GLOW], fs.x + fs.nx * 0.9, fs.z + fs.nz * 0.9, 6.5, 0.3, g + 21.5, g + 24, fang, '#ffca7a');

  // festive eave lights like the neighbours (heroes skip the generic decor pass)
  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eave - 2.5, HALLOWEEN_BULBS);
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eave - 2.5);
}

// Beverly Public Library (1913, Cass Gilbert) — Beaux-Arts jewel on Essex St:
// red Flemish-bond brick on a white-marble raised basement, giant marble
// pilasters between the two tall window storeys, carved author-name frieze
// panels under a deep entablature, a marble balustraded parapet hiding the
// flat roof, and a deep round-arched marble centre entry up granite steps.
function beverlyLibrary(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const MARBLE = '#efeadb', BASE = '#e2dccc', PANEL = '#e4dfd0', DARK = '#2e2a26';
  const eave = g + 52;                                                   // 2 tall storeys over the raised basement
  const [cx, cz] = centroidOf(b.p);
  walls(buckets[PLAIN], b.p, g - 6, g + 11, BASE, 0);                    // raised marble basement
  walls(buckets[PLAIN], expandRing(b.p, 0.7), g + 9.8, g + 11.6, MARBLE, 0);      // proud water table
  walls(buckets[BRICK], b.p, g + 11, eave, '#fbf2e4');                   // Flemish-bond red brick body
  walls(buckets[PLAIN], expandRing(b.p, 0.8), eave - 5, eave + 0.3, MARBLE, 0);   // deep marble entablature
  walls(buckets[PLAIN], expandRing(b.p, 1.4), eave + 0.2, eave + 1.4, MARBLE, 0); // projecting cornice
  flatRoof(buckets[PLAIN], b.p, eave + 1.6, '#6b6e67');                  // flat membrane hidden by the parapet
  walls(buckets[PLAIN], expandRing(b.p, 0.4), eave + 1.2, eave + 2.4, MARBLE, 0); // parapet plinth
  roofRail(buckets, expandRing(b.p, 0.4), eave + 2.4, 3.2, MARBLE, false);        // marble balustrade
  facades(buckets[PLAIN], b.p, eave, 2, 1913, false, false, false, g);   // two tall storeys of framed glass

  const f = heroFront(b, index, { road: 'Essex Street' });
  const ang = Math.atan2(f.tz, f.tx);

  // giant marble pilasters — mirror facades' 24px window rhythm so the shafts
  // land BETWEEN the glass; plinth + capital at each, author panels in the frieze
  for (let i = 0; i + 1 < b.p.length; i += 2) {
    const x0 = b.p[i], z0 = b.p[i + 1], x1 = b.p[(i + 2) % b.p.length], z1 = b.p[(i + 3) % b.p.length];
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    if (len < 24) continue;
    const ux = dx / len, uz = dz / len;
    let nx = uz, nz = -ux;
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
    if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }     // outward, away from centroid
    const eAng = Math.atan2(dz, dx);
    const cols = Math.floor((len - 10) / 24), gap = len / (cols + 1);
    for (let c = 0; c <= cols; c++) {
      const d = gap * (c + 0.5), px = x0 + ux * d, pz = z0 + uz * d;
      if (Math.hypot(px - f.x, pz - f.z) < 14) continue;                 // the entry frontispiece owns this bay
      rotBox(buckets[PLAIN], px + nx * 0.55, pz + nz * 0.55, 1.7, 1.15, g + 11.6, g + 13.4, eAng, MARBLE);  // plinth
      rotBox(buckets[PLAIN], px + nx * 0.55, pz + nz * 0.55, 1.2, 1.0, g + 13.4, eave - 6.6, eAng, MARBLE); // shaft
      rotBox(buckets[PLAIN], px + nx * 0.55, pz + nz * 0.55, 1.7, 1.15, eave - 6.6, eave - 5, eAng, MARBLE); // capital
    }
    for (let c = 1; c <= cols; c++) {                                    // carved author-name panels (skip the lettering)
      const d = gap * c, px = x0 + ux * d, pz = z0 + uz * d;
      if (Math.hypot(px - f.x, pz - f.z) < 14) continue;
      rotBox(buckets[PLAIN], px + nx * 1.0, pz + nz * 1.0, Math.min(gap * 0.35, 6), 0.25, eave - 4, eave - 1, eAng, PANEL);
    }
  }

  // deep round-arched recessed centre entry: marble frontispiece + keystone,
  // shadowed recess with warm glazed doors, short granite flight up from the walk
  rotBox(buckets[PLAIN], f.x + f.nx * 0.9, f.z + f.nz * 0.9, 10, 1.1, g - 2, g + 36, ang, MARBLE);
  rotBox(buckets[PLAIN], f.x + f.nx * 1.3, f.z + f.nz * 1.3, 1.2, 1.15, g + 26, g + 31.5, ang, MARBLE);   // keystone
  const fan = (R: number, off: number, hex: string) => {                 // semicircle on the facade plane
    tmp.set(hex);
    const ox = f.x + f.nx * off, oz = f.z + f.nz * off;
    for (let s = 0; s < 7; s++) {
      const a0 = Math.PI * s / 7, a1 = Math.PI * (s + 1) / 7;
      buckets[PLAIN].triUV(ox, g + 20, oz,
        ox + f.tx * Math.cos(a0) * R, g + 20 + Math.sin(a0) * R, oz + f.tz * Math.cos(a0) * R,
        ox + f.tx * Math.cos(a1) * R, g + 20 + Math.sin(a1) * R, oz + f.tz * Math.cos(a1) * R,
        f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
    }
  };
  fan(7.8, 2.1, MARBLE);                                                 // archivolt ring…
  fan(6.2, 2.35, DARK);                                                  // …around the shadowed recess
  const rq = (bk: Bucket, hw: number, off: number, y0: number, y1: number, hex: string) => {
    tmp.set(hex);
    bk.quad(f.x - f.tx * hw + f.nx * off, y0, f.z - f.tz * hw + f.nz * off,
      f.x + f.tx * hw + f.nx * off, y0, f.z + f.tz * hw + f.nz * off,
      f.x + f.tx * hw + f.nx * off, y1, f.z + f.tz * hw + f.nz * off,
      f.x - f.tx * hw + f.nx * off, y1, f.z - f.tz * hw + f.nz * off,
      f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b);
  };
  rq(buckets[PLAIN], 6.2, 2.35, g + 4, g + 20, DARK);                    // recess shadow
  rq(buckets[GLOW], 2.8, 2.6, g + 4, g + 13, '#9c7c46');                 // glazed doors, lit from within
  for (const s of [-1, 1]) buckets[GLOW].box(f.x + f.tx * s * 8.2 + f.nx * 2.4, f.z + f.tz * s * 8.2 + f.nz * 2.4, 0.6, 0.6, g + 13, g + 14.6, '#ffe2a8', 0);   // entry lanterns
  rotBox(buckets[PLAIN], f.x + f.nx * 3.2, f.z + f.nz * 3.2, 8.5, 1.4, g - 2, g + 4, ang, '#b9b5a8');     // granite stoop
  rotBox(buckets[PLAIN], f.x + f.nx * 5.2, f.z + f.nz * 5.2, 9.3, 1.2, g - 2, g + 2.7, ang, '#b9b5a8');
  rotBox(buckets[PLAIN], f.x + f.nx * 7.0, f.z + f.nz * 7.0, 10.1, 1.0, g - 2, g + 1.4, ang, '#b9b5a8');

  // festive eave lights like the neighbours (heroes skip the generic decor pass)
  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eave - 1.5, HALLOWEEN_BULBS);
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eave - 1.5);
}

// United Shoe Machinery Plant / Cummings Center — "The Shoe" (1902-06, Ernest Ransome),
// the world's first great reinforced-concrete daylight factory. Long parallel wings of pale
// buff EXPOSED-CONCRETE grid: full-height piers + shallow floor spandrels, the bays between
// almost entirely glass ("thousands of windows" — dark glazed by day, dimly lit at night via
// GLOW). Flat membrane roof behind a concrete parapet; 100 Cummings keeps the powerhouse's
// tall round concrete smokestack. One builder serves all four HEROES keys via opts.
function cummingsShoe(buckets: Bucket[], b: Building, g: number, index: WorldIndex, o: { storeys: number; stack?: boolean }) {
  const CONC = '#cfc9ba', PLINTH = '#b3aea1', CAP = '#dcd7c9', GLASS = '#31414b', ROOF = '#95979a';
  const ring = b.p;
  const floors = Math.max(1, Math.round(o.storeys));
  const eaveH = g + floors * 19;                       // 19px storey rhythm — height from storeys, never the footprint
  // stacked bands (no coplanar overlap → no z-fight): spandrel then glass, storey by storey
  walls(buckets[PLAIN], ring, g - 4, g, PLINTH, 0);                                        // foundation
  for (let f = 0; f < floors; f++) {
    walls(buckets[PLAIN], ring, g + f * 19, g + f * 19 + 5.5, CONC, 0);                    // shallow spandrel — Ransome kept them thin to max daylight
    walls(buckets[GLOW], ring, g + f * 19 + 5.5, g + (f + 1) * 19, GLASS, 0);              // the glass bay, wall-to-wall
  }
  walls(buckets[PLAIN], ring, eaveH, eaveH + 3, CONC, 0);                                  // parapet
  walls(buckets[PLAIN], ring, eaveH + 3, eaveH + 4.2, CAP, 0);                             // pale coping
  flatRoof(buckets[PLAIN], ring, eaveH + 1.6, ROOF);                                       // membrane behind the parapet

  // full-height concrete piers every structural bay (real Ransome bays ≈ 20 ft), proud of the
  // glass; the bay stretches on 100 Cummings' 2.3 km comb perimeter so the pier count stays sane
  let perim = 0, li = 0, ll = 0;
  for (let i = 0; i < ring.length; i += 2) {
    const l = Math.hypot(ring[(i + 2) % ring.length] - ring[i], ring[(i + 3) % ring.length] - ring[i + 1]);
    perim += l; if (l > ll) { ll = l; li = i; }
  }
  const bay = Math.max(30, perim / 520);
  for (let i = 0; i < ring.length; i += 2) {
    const aX = ring[i], aZ = ring[i + 1], bX = ring[(i + 2) % ring.length], bZ = ring[(i + 3) % ring.length];
    const dx = bX - aX, dz = bZ - aZ, len = Math.hypot(dx, dz);
    if (len < 10) continue;                            // tiny jogs keep their glass, skip piers
    const ang = Math.atan2(dz, dx), nP = Math.max(1, Math.round(len / bay));
    for (let k = 0; k < nP; k++) {                     // k=0 sits on the vertex → corners read as solid concrete
      const d = (len * k) / nP;
      rotBox(buckets[PLAIN], aX + dx / len * d, aZ + dz / len * d, 1.0, 1.3, g - 4, eaveH + 3, ang, CONC);
    }
  }

  // interior probe — the comb-shaped 100 building's centroid can sit near a courtyard, so
  // rooftop gear anchors off the longest wing wall, each spot verified inside the footprint
  const inside = (x: number, z: number): boolean => {
    let inPoly = false;
    for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
      const xi = ring[i], zi = ring[i + 1], xj = ring[j], zj = ring[j + 1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inPoly = !inPoly;
    }
    return inPoly;
  };
  const eAx = ring[li], eAz = ring[li + 1], eBx = ring[(li + 2) % ring.length], eBz = ring[(li + 3) % ring.length];
  const ex = eBx - eAx, ez = eBz - eAz, el = Math.hypot(ex, ez) || 1;
  let inx = -ez / el, inz = ex / el;                   // inward normal — sign settled by the probe
  if (!inside(eAx + ex * 0.5 + inx * 15, eAz + ez * 0.5 + inz * 15)) { inx = -inx; inz = -inz; }
  const eang = Math.atan2(ez, ex);
  // rooftop air handlers + vents along the wing (heroes skip the generic roofClutter pass)
  for (const [t, hl2, hw2, h2] of [[0.38, 7, 4.5, 6], [0.5, 2.4, 2.4, 4], [0.62, 5, 3.5, 5]] as const) {
    const mx = eAx + ex * t + inx * 13, mz = eAz + ez * t + inz * 13;
    if (inside(mx, mz)) rotBox(buckets[PLAIN], mx, mz, hl2, hw2, eaveH + 1.6, eaveH + 1.6 + h2, eang, '#b8b3a6');
  }

  // street entry: concrete surround, warm-lit lobby doors, flat concrete hood
  const fs = frontSegment(b, index);
  const fang = Math.atan2(fs.tz, fs.tx);
  rotBox(buckets[PLAIN], fs.x + fs.nx * 1.2, fs.z + fs.nz * 1.2, 5.8, 1.2, g - 1, g + 15, fang, CONC);
  rotBox(buckets[GLOW], fs.x + fs.nx * 1.6, fs.z + fs.nz * 1.6, 3.4, 0.5, g, g + 11.5, fang, '#6b5836');
  rotBox(buckets[PLAIN], fs.x + fs.nx * 1.7, fs.z + fs.nz * 1.7, 6.6, 1.9, g + 15, g + 16.6, fang, CAP);

  // the powerhouse's tall round concrete stack — tapered octagon, soot-dark crown, ~25 m up
  if (o.stack) {
    let sx = eAx + ex * 0.82 + inx * 20, sz = eAz + ez * 0.82 + inz * 20;   // toward the wing's end, powerhouse-style
    if (!inside(sx, sz)) { sx = eAx + ex * 0.5 + inx * 20; sz = eAz + ez * 0.5 + inz * 20; }
    walls(buckets[PLAIN], octRing(sx, sz, 7), g - 4, eaveH + 40, CONC, 0);
    walls(buckets[PLAIN], octRing(sx, sz, 5.8), eaveH + 40, eaveH + 88, CONC, 0);
    walls(buckets[PLAIN], octRing(sx, sz, 4.9), eaveH + 88, eaveH + 122, '#c4beb0', 0);
    walls(buckets[PLAIN], octRing(sx, sz, 5.2), eaveH + 114, eaveH + 124, '#6e6a64', 0);   // soot band
    flatRoof(buckets[PLAIN], octRing(sx, sz, 5.2), eaveH + 123, '#3a3835');                // closes the flue from flight view
  }
}

// The Cabot (1920) — Cabot Street's movie palace: a flat red-brown brick front block with
// stone stringcourses + cornice, storefronts flanking a glowing lobby entrance, the white
// marquee canopy out over the sidewalk (warm bulb-lit soffit + changeable letter board),
// the skeletal steel rooftop CABOT sign relit in 2020, and the taller blank-brick stage
// house rising over the auditorium's rear half.
function cabotTheatre(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const BRICKH = '#84463a', STONE = '#d9cfb9', WHITE = '#f4f1e8', STEEL = '#33302c',
        BULB = '#ffd98a', LETTER = '#ffe4a6', ROOF = '#565049', LOBBY = '#e3c78f';
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  // the facade can sit on either OBB axis (the auditorium runs back from the street) —
  // pick whichever axis frontSegment's street normal agrees with
  const fs = frontSegment(b, index);
  const dLx = fs.nx * ca + fs.nz * sa, dLz = -fs.nx * sa + fs.nz * ca;
  const alongL = Math.abs(dLx) >= Math.abs(dLz);
  const fSign = (alongL ? dLx : dLz) >= 0 ? 1 : -1;
  const halfFace = alongL ? obb.hw : obb.hl, halfDeep = alongL ? obb.hl : obb.hw;
  // facade frame: u runs across the front face, d = depth behind it (negative = over the sidewalk)
  const P = (u: number, d: number, y: number): [number, number, number] =>
    alongL ? pt(fSign * (halfDeep - d), u, y) : pt(u, fSign * (halfDeep - d), y);
  const fAng = alongL ? obb.ang + Math.PI / 2 : obb.ang;   // rotBox axis = along the facade

  const eave = g + 52;                                                                  // 2½ tall commercial storeys
  walls(buckets[BRICK], b.p, g - 4, eave, BRICKH);                                      // flat red-brown brick throughout
  walls(buckets[PLAIN], expandRing(b.p, 0.4), eave - 2.6, eave + 0.8, STONE, 0);        // stone cornice / parapet cap
  flatRoof(buckets[PLAIN], b.p, eave + 1.2, ROOF);
  // storefront glass flanking the entrance + a row of uppers; long side walls earn exit doors
  facades(buckets[PLAIN], b.p, eave, 2, Math.round(obb.cx * 11 + obb.cz * 3), true, false, true, g);

  // lighter stone/terracotta accent bands across the street facade (clear of the window rows)
  for (const [y, h] of [[g + 27, 1.5], [g + 33.5, 1.5]] as const) {
    const c = P(0, -0.4, 0);
    rotBox(buckets[PLAIN], c[0], c[2], halfFace * 0.98, 0.55, y, y + h, fAng, STONE);
  }

  // white marquee canopy out over the sidewalk — the real one projects well past the wall
  const mw = Math.min(halfFace * 0.55, 13), proj = 9;
  const mc = P(0, 0.2 - proj / 2, 0);
  rotBox(buckets[PLAIN], mc[0], mc[2], mw, proj / 2 + 0.3, g + 18, g + 21, fAng, WHITE);            // thin white fascia slab
  rotBox(buckets[GLOW], mc[0], mc[2], mw - 0.7, proj / 2 - 0.4, g + 17.4, g + 18.05, fAng, BULB);   // warm bulb-lit soffit
  const lb = P(0, -(proj + 0.35), 0);
  rotBox(buckets[GLOW], lb[0], lb[2], mw * 0.88, 0.3, g + 18.5, g + 20.5, fAng, LETTER);            // changeable letter board

  // glowing lobby doors under the marquee, white surround, lit poster cases flanking
  const ds = P(0, -0.5, 0), dl = P(0, -0.8, 0);
  rotBox(buckets[PLAIN], ds[0], ds[2], 6.8, 0.55, g, g + 12, fAng, WHITE);
  rotBox(buckets[GLOW], dl[0], dl[2], 5.8, 0.55, g + 1, g + 11, fAng, LOBBY);
  const pcU = Math.min(halfFace - 3, mw + 3.2);
  for (const s of [-1, 1] as const) {
    const pc = P(s * pcU, -0.7, 0);
    rotBox(buckets[GLOW], pc[0], pc[2], 2.1, 0.3, g + 4, g + 10, fAng, '#e9dcc0');                  // lobby cards
  }

  // stage house: plain brick fly tower over the auditorium's rear half, half again taller
  const sRing: number[] = [];
  const SP = (u: number, d: number) => { const p = P(u, d, 0); sRing.push(p[0], p[2]); };
  const si = 1.2;                                                                       // inset so the front-block brick reads in front
  SP(-halfFace + si, halfDeep); SP(halfFace - si, halfDeep);
  SP(halfFace - si, 2 * halfDeep - si); SP(-halfFace + si, 2 * halfDeep - si);
  const stageTop = g + 78;                                                              // ~1.5× the facade height
  walls(buckets[BRICK], sRing, eave - 8, stageTop, BRICKH);
  walls(buckets[PLAIN], expandRing(sRing, 0.3), stageTop - 2, stageTop + 0.6, STONE, 0);
  flatRoof(buckets[PLAIN], sRing, stageTop + 1, ROOF);
  const vc = P(0, halfDeep * 1.5, 0);
  buckets[PLAIN].box(vc[0], vc[2], 2.6, 2, stageTop + 1, stageTop + 4, '#6b675f', 0);   // rooftop vent

  // skeletal rooftop sign: open steel posts + rails carrying five warm blocks (C·A·B·O·T at night)
  const sw = Math.min(halfFace * 0.72, 17), sd = Math.min(5, halfDeep * 0.3);
  const s0 = eave + 1.2, s1 = s0 + 16;
  for (const t of [-1, -0.5, 0, 0.5, 1] as const) {
    const lp = P(t * sw, sd, 0);
    buckets[PLAIN].box(lp[0], lp[2], 0.45, 0.45, s0, s1, STEEL, 0);
  }
  const rc = P(0, sd, 0);
  rotBox(buckets[PLAIN], rc[0], rc[2], sw + 0.4, 0.35, s0 + 4.2, s0 + 4.9, fAng, STEEL);
  rotBox(buckets[PLAIN], rc[0], rc[2], sw + 0.4, 0.35, s1 - 0.7, s1, fAng, STEEL);
  for (let i = 0; i < 5; i++) {
    const u = -sw * 0.82 + sw * 1.64 * (i / 4);
    const c = P(u, sd - 0.75, 0);
    rotBox(buckets[GLOW], c[0], c[2], sw * 0.13, 0.35, s0 + 6, s1 - 2, fAng, LETTER);
  }

  // festive eave lights like the neighbours (heroes skip the generic decor pass)
  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eave - 1.5, HALLOWEEN_BULBS);
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eave - 1.5);
}

// First Parish Church Beverly (1770 meetinghouse, 1835 Greek Revival remodel) — pale
// YELLOW clapboard with white trim (photo-verified; not white, not granite): a gable-front
// temple with four square white piers on the facade, a square white clock tower at the
// front of the ridge, and an octagonal OPEN belfry under a dark domed cap.
function firstParishBeverly(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const YELLOW = '#f0e2ab', WHITE = '#fbfaf3', ROOF = '#85888c', DARK = '#33363b';
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const fs = frontSegment(b, index);
  // temple form: the GABLE END faces Cabot St — pick the street end of the long axis
  // (facade normal when the front is a short end, midpoint fallback when it isn't)
  const dn = fs.nx * ca + fs.nz * sa;
  const fx = (Math.abs(dn) > 0.3 ? dn : (fs.x - obb.cx) * ca + (fs.z - obb.cz) * sa) >= 0 ? 1 : -1;
  const eave = g + 40;                                                         // one tall meetinghouse storey

  // pale yellow clapboard body, white water table + cornice
  clad(buckets[CLAP], b.p, g - 4, eave, YELLOW);
  const exr = expandRing(b.p, 0.5);
  walls(buckets[PLAIN], exr, g + 0.3, g + 1.8, WHITE, 0);
  walls(buckets[PLAIN], exr, eave - 2, eave + 0.4, WHITE, 0);
  // tall arched side windows ≈ two stacked sash tiers (gallery level inside)
  facades(buckets[PLAIN], b.p, eave, 2, Math.round(obb.cx * 11 + obb.cz * 3), false, false, false, g);
  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eave - 1.5, HALLOWEEN_BULBS);
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eave - 1.5);

  // weathered gray shingle nave gable, ridge down the long axis; yellow tympanum ends
  const ridgeY = eave + Math.min(W * 0.72, 20), Lr = L + 1.2, Wr = W + 1.2;
  tmp.set(ROOF); const rr = tmp.r, rg = tmp.g, rb2 = tmp.b;
  for (const s of [1, -1] as const) {
    const e0 = pt(-Lr, s * Wr, eave), e1 = pt(Lr, s * Wr, eave), r0 = pt(-Lr, 0, ridgeY), r1 = pt(Lr, 0, ridgeY);
    const sh = s > 0 ? 0.97 : 0.88;
    buckets[SHINGLE].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], -sa * s * 0.5, 0.85, ca * s * 0.5, rr * sh, rg * sh, rb2 * sh);
  }
  tmp.set(YELLOW); const yr = tmp.r, yg = tmp.g, yb = tmp.b;
  for (const sx of [1, -1] as const) {
    const a = pt(sx * L, W, eave), b2 = pt(sx * L, -W, eave), pk = pt(sx * L, 0, ridgeY);
    buckets[CLAP].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ca * sx, 0, sa * sx, yr, yg, yb, 0, 0, 0, 0, 0, 0);
  }

  // Greek Revival front: four square white corner piers/pilasters + entablature band
  for (const t of [-0.92, -0.31, 0.31, 0.92]) {
    const c = pt(fx * (L + 0.4), t * W, 0);
    rotBox(buckets[PLAIN], c[0], c[2], 1.1, 2.2, g - 2, eave + 0.3, obb.ang, WHITE);
  }
  const ec = pt(fx * (L + 0.6), 0, 0);
  rotBox(buckets[PLAIN], ec[0], ec[2], 1.0, W + 1.0, eave - 0.4, eave + 1.6, obb.ang, WHITE);
  // central double door in a white surround under the pediment
  const ds = pt(fx * (L + 0.2), 0, 0);
  rotBox(buckets[PLAIN], ds[0], ds[2], 0.5, 4.6, g, g + 12.5, obb.ang, WHITE);
  const dd = pt(fx * (L + 0.7), 0, 0);
  rotBox(buckets[PLAIN], dd[0], dd[2], 0.3, 3.4, g, g + 11, obb.ang, '#3a3a34');

  // square white clock tower rising from the front of the ridge (face just behind the pediment)
  const tw = Math.min(W * 0.42, 20), cxL = fx * (L - tw - 1.2);
  const tRing: number[] = [];
  const TP = (lx: number, lz: number) => { const p = pt(lx, lz, 0); tRing.push(p[0], p[2]); };
  TP(cxL - tw, -tw); TP(cxL + tw, -tw); TP(cxL + tw, tw); TP(cxL - tw, tw);
  const stageT = g + 72;
  clad(buckets[CLAP], tRing, g + 34, stageT, WHITE);                           // starts inside the roof — no seam
  walls(buckets[PLAIN], expandRing(tRing, 0.4), stageT - 1.6, stageT + 0.3, WHITE, 0);
  flatRoof(buckets[PLAIN], tRing, stageT + 0.3, WHITE);                        // belfry deck

  // a clock face on each side: white disc (backlit at night) in a dark bezel ring
  const faces: [number, number, number, number][] = [
    [cxL + tw, 0, ca, sa], [cxL - tw, 0, -ca, -sa],
    [cxL, tw, -sa, ca], [cxL, -tw, sa, -ca]
  ];
  for (const [flx, flz, nx2, nz2] of faces) {
    const c = pt(flx, flz, g + 64);
    const tx2 = nz2, tz2 = -nx2;                                               // t×up = n → fan faces out
    const disc = (r: number, off: number, hex: string, bk: Bucket) => {
      tmp.set(hex); const cr = tmp.r, cg = tmp.g, cb = tmp.b;
      const dx = c[0] + nx2 * off, dy = c[1], dz = c[2] + nz2 * off;
      for (let k = 0; k < 8; k++) {
        const a0 = (k / 8) * Math.PI * 2, a1 = ((k + 1) / 8) * Math.PI * 2;
        bk.triUV(dx, dy, dz,
          dx + tx2 * Math.cos(a0) * r, dy + Math.sin(a0) * r, dz + tz2 * Math.cos(a0) * r,
          dx + tx2 * Math.cos(a1) * r, dy + Math.sin(a1) * r, dz + tz2 * Math.cos(a1) * r,
          nx2, 0, nz2, cr, cg, cb, 0, 0, 0, 0, 0, 0);
      }
    };
    disc(3.1, 0.3, '#2f3237', buckets[PLAIN]);
    disc(2.35, 0.55, '#efe9d8', buckets[GLOW]);
  }

  // octagonal OPEN belfry: 8 white posts, the bell showing between, dark domed cap
  const tc = pt(cxL, 0, 0), tcx = tc[0], tcz = tc[2];
  const rb = tw * 0.7, belT = g + 84;
  for (let k = 0; k < 8; k++) {
    const a = obb.ang + (k / 8) * Math.PI * 2;
    buckets[PLAIN].box(tcx + Math.cos(a) * rb, tcz + Math.sin(a) * rb, 0.8, 0.8, stageT, belT, WHITE);
  }
  buckets[PLAIN].box(tcx, tcz, 2, 2, stageT + 3, stageT + 7, '#6f5a2e');       // the bronze bell
  walls(buckets[PLAIN], octRing(tcx, tcz, rb + 1.4), belT, belT + 2.2, DARK, 0);
  walls(buckets[PLAIN], octRing(tcx, tcz, rb * 0.72), belT + 2.2, belT + 4, DARK, 0);
  tmp.set(DARK);
  cone(buckets[PLAIN], tcx, belT + 4, tcz, rb * 0.75, 4.8, tmp.clone());       // dome ≈ g+93
  buckets[PLAIN].box(tcx, tcz, 0.35, 0.35, belT + 7, belT + 11.5, '#d8d3c2');  // finial → ≈ g+95
}

// Prides Crossing Station (c.1880) — the tiny Stick-style B&M depot on the tracks off Hale St,
// now the Prides Crossing Confections candy shop. Photo-true: dark forest-green boards, grey/
// silver trim, RED doors + red window sash, a grey shingle gable roof with DEEP bracketed
// eaves, stick-truss work in each gable end, and the little red PRIDES sign board.
function pridesStation(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const GREEN = '#2e4d3b', TRIM = '#b6bcbe', RED = '#b03028', ROOF = '#8a8f94', GLASS = '#2b3a44';
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1;                 // trackside long face
  const eaveH = g + 24, ridgeY = eaveH + Math.min(14, W * 0.9);             // one tall storey, ridge ≈ g+38

  clad(buckets[CLAP], b.p, g - 4, eaveH, GREEN);                            // dark forest-green boards
  walls(buckets[PLAIN], expandRing(b.p, 0.35), g + 0.3, g + 2, TRIM, 0);    // grey water table

  // grey shingle gable roof — DEEP Stick-style eaves (~0.5 m past the walls, carried on brackets)
  const ov = 4, ovEnd = 3, Lr = L + ovEnd, Wr = W + ov;
  tmp.set(ROOF); const rr = tmp.r, rg = tmp.g, rb = tmp.b;
  for (const s of [1, -1] as const) {
    const e0 = pt(-Lr, s * Wr, eaveH), e1 = pt(Lr, s * Wr, eaveH), r0 = pt(-Lr, 0, ridgeY), r1 = pt(Lr, 0, ridgeY);
    const sh = s > 0 ? 1 : 0.92;
    buckets[SHINGLE].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], -sa * s * 0.5, 0.85, ca * s * 0.5, rr * sh, rg * sh, rb * sh);
  }
  rotBox(buckets[PLAIN], obb.cx, obb.cz, Lr, 0.8, ridgeY - 0.5, ridgeY + 0.4, obb.ang, '#75797e');   // ridge cap
  tmp.set(GREEN); const wr = tmp.r, wg = tmp.g, wb = tmp.b;
  for (const sx of [1, -1] as const) {                                      // green gable-end triangles
    const a = pt(sx * L, W, eaveH), b2 = pt(sx * L, -W, eaveH), pk = pt(sx * L, 0, ridgeY);
    buckets[CLAP].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ca * sx, 0, sa * sx, wr, wg, wb, 0, 0, 0, 0, 0, 0);
  }

  // grey soffit boards fill the overhang's underside, bracket arms marching below the eave
  for (const s of [1, -1] as const) {
    const sf = pt(0, s * (W + ov / 2 - 0.7), 0);
    rotBox(buckets[PLAIN], sf[0], sf[2], Lr - 0.4, ov / 2 + 0.9, eaveH - 1.2, eaveH - 0.2, obb.ang, TRIM);
    const nB = Math.max(3, Math.round(L / 5));
    for (let i = 0; i < nB; i++) {
      const lxb = -L + 2 + (2 * L - 4) * i / (nB - 1);
      if (s === front && Math.abs(lxb) < 8) continue;                       // keep the sign clear
      const bc = pt(lxb, s * (W + ov / 2 - 0.8), 0);
      rotBox(buckets[PLAIN], bc[0], bc[2], 0.5, ov / 2 + 0.6, eaveH - 3.4, eaveH - 1.1, obb.ang, TRIM);
    }
  }

  // decorative stick-truss work in each gable: a grey king post + two rising diagonals
  tmp.set(TRIM); const tr2 = tmp.r, tg2 = tmp.g, tb2 = tmp.b;
  const stick = (sx: 1 | -1, lz0: number, y0: number, lz1: number, y1: number) => {
    const off = sx * (L + 0.4);                                             // proud of the gable boards
    const dlz = lz1 - lz0, dy = y1 - y0, dl = Math.hypot(dlz, dy) || 1;
    const pz = (-dy / dl) * 0.55, py = (dlz / dl) * 0.55;
    const A = pt(off, lz0 + pz, y0 + py), B = pt(off, lz0 - pz, y0 - py), C = pt(off, lz1 - pz, y1 - py), D = pt(off, lz1 + pz, y1 + py);
    buckets[PLAIN].quad(A[0], A[1], A[2], B[0], B[1], B[2], C[0], C[1], C[2], D[0], D[1], D[2], ca * sx, 0, sa * sx, tr2, tg2, tb2);
  };
  for (const sx of [1, -1] as const) {
    stick(sx, 0, eaveH + 0.8, 0, ridgeY - 0.8);                             // king post
    stick(sx, -W * 0.78, eaveH + 1, -1.4, ridgeY - 2.4);                    // diagonals
    stick(sx, W * 0.78, eaveH + 1, 1.4, ridgeY - 2.4);
  }

  // red-sash windows down both long faces — glass floats just proud of the red frame slab
  tmp.set(GLASS); const glr = tmp.r, glg = tmp.g, glb = tmp.b;
  const winRed = (lx: number, side: number) => {
    const c = pt(lx, side * (W + 0.1), 0);
    rotBox(buckets[PLAIN], c[0], c[2], 2.8, 0.45, g + 8, g + 17.5, obb.ang, RED);
    const o2 = side * (W + 0.62), nx2 = -sa * side, nz2 = ca * side;
    const Cg = (sx2: number, y: number): [number, number, number] => pt(lx + sx2 * 2.1, o2, y);
    const a = Cg(-1, g + 9), b2 = Cg(1, g + 9), c2 = Cg(1, g + 16.7), d2 = Cg(-1, g + 16.7);
    buckets[PLAIN].quad(a[0], a[1], a[2], b2[0], b2[1], b2[2], c2[0], c2[1], c2[2], d2[0], d2[1], d2[2], nx2, 0, nz2, glr, glg, glb);
    const mr = pt(lx, side * (W + 0.35), 0);
    rotBox(buckets[PLAIN], mr[0], mr[2], 2.1, 0.4, g + 12.5, g + 13.1, obb.ang, RED);   // meeting rail
  };
  const nW = Math.max(2, Math.round(L / 10));
  for (const side of [front, -front]) for (let i = 0; i < nW; i++) {
    const lx = -L + (2 * L) * (i + 0.5) / nW;
    if (side === front && Math.abs(lx) < 4.8) continue;                     // the door bay
    winRed(lx, side);
  }

  // red door in a grey casing, centre of the trackside face, one low granite step
  const dc = pt(0, front * (W + 0.12), 0);
  rotBox(buckets[PLAIN], dc[0], dc[2], 3.6, 0.4, g, g + 12.5, obb.ang, TRIM);
  const dd = pt(0, front * (W + 0.3), 0);
  rotBox(buckets[PLAIN], dd[0], dd[2], 2.7, 0.4, g, g + 11.5, obb.ang, RED);
  const st = pt(0, front * (W + 1.5), 0);
  rotBox(buckets[PLAIN], st[0], st[2], 3.2, 1.3, g - 2, g + 1, obb.ang, '#9aa0a4');

  // the little red PRIDES sign board under the eave, lettering band picked out in cream
  const sc = pt(0, front * (W + 0.5), 0);
  rotBox(buckets[PLAIN], sc[0], sc[2], 6.5, 0.3, eaveH - 5.6, eaveH - 2.3, obb.ang, RED);
  const sl = pt(0, front * (W + 0.82), 0);
  rotBox(buckets[PLAIN], sl[0], sl[2], 5.2, 0.12, eaveH - 4.7, eaveH - 3.2, obb.ang, '#ece7d8');

  // little brick stove chimney on the ridge
  const cc = pt(-L * 0.3, 0, 0);
  buckets[BRICK].box(cc[0], cc[2], 1.6, 1.6, ridgeY - 4, ridgeY + 7, '#7a4a39', 1);

  // festive eave lights like the neighbours (heroes skip the generic decor pass)
  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eaveH - 1.5, HALLOWEEN_BULBS);
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eaveH - 1.5);
}

// Beverly Golf & Tennis clubhouse (1910) — the Tudor Revival country club United Shoe
// built for its workers: cream stucco on a fieldstone base, dark brown trim, a dark
// roofed veranda wrapping the long front and both ends, and a gray-brown shingle roof
// with a parade of steep gabled dormers marching down each long slope. Brick chimneys.
function golfClubhouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const STUCCO = '#efe7d3', TRIM = '#4a3729', STONE = '#8b8177', ROOF = '#6e655a', GLASS = '#2b3a44', PORCH = '#4d3b2b';
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1;        // veranda faces the street/course side
  const eave = g + 42;                                             // 2.5 storeys — the half lives up in the dormers

  walls(buckets[BRICK], b.p, g - 4, g + 6, STONE);                 // fieldstone/cobble foundation (coursing tex, grayed to stone)
  walls(buckets[PLAIN], b.p, g + 6, eave, STUCCO, 0);              // cream stucco upper walls
  const exr = expandRing(b.p, 0.4);
  walls(buckets[PLAIN], exr, g + 25, g + 26.2, TRIM, 0);           // dark brown second-floor band
  walls(buckets[PLAIN], exr, eave - 1.5, eave + 0.3, TRIM, 0);     // dark eave fascia
  facades(buckets[PLAIN], b.p, eave, 2, Math.round(obb.cx * 11 + obb.cz * 3), true, false, false, g);
  if (SEASON === 'fall') stringLights(buckets[GLOW], b.p, eave - 1.5, HALLOWEEN_BULBS);
  else if (SEASON === 'winter') stringLights(buckets[GLOW], b.p, eave - 1.5);

  // long gray-brown shingle gable down the true long axis
  const rise = Math.min(W * 0.85, 30), ridgeY = eave + rise, ov = 1.4, Lr = L + ov, Wr = W + ov;
  tmp.set(ROOF); const rr = tmp.r, rg = tmp.g, rb = tmp.b;
  for (const s of [1, -1] as const) {
    const e0 = pt(-Lr, s * Wr, eave), e1 = pt(Lr, s * Wr, eave), r0 = pt(-Lr, 0, ridgeY), r1 = pt(Lr, 0, ridgeY);
    const sh = s === front ? 1 : 0.9;
    buckets[SHINGLE].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], -sa * s * 0.5, 0.85, ca * s * 0.5, rr * sh, rg * sh, rb * sh);
  }
  // stucco gable ends with dark half-timber studs up the peak — the Tudor tell
  tmp.set(STUCCO); const ur = tmp.r, ug = tmp.g, ub = tmp.b;
  for (const sx of [1, -1] as const) {
    const a = pt(sx * L, W, eave), b2 = pt(sx * L, -W, eave), pk = pt(sx * L, 0, ridgeY);
    buckets[PLAIN].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ca * sx, 0, sa * sx, ur, ug, ub, 0, 0, 0, 0, 0, 0);
    for (const t of [-0.6, -0.3, 0, 0.3, 0.6]) {
      const c = pt(sx * L, t * W, 0);
      rotBox(buckets[PLAIN], c[0], c[2], 0.55, 0.7, eave + 0.3, eave + Math.max(2, rise * (1 - Math.abs(t)) - 1), obb.ang, TRIM);
    }
  }
  for (const sx of [1, -1] as const) { const c = pt(sx * L * 0.5, 0, 0); buckets[BRICK].box(c[0], c[2], 2.2, 2.2, ridgeY - 10, ridgeY + 10, '#7a4a39', 1); }   // brick chimneys punch the ridge

  // the dormer parade — 5-7 steep little gables marching down BOTH long slopes
  const n = Math.max(5, Math.min(7, Math.round(L / 30)));
  const zf = W * 0.68, zb = W * 0.24, dw = 3.4;
  const y0 = eave + rise * (1 - zf / Wr) - 2, y1 = y0 + 9, y2 = y0 + 15;    // buried base → cheeks → steep gablet ridge (stays under the main ridge)
  for (const s of [1, -1] as const) for (let i = 0; i < n; i++) {
    const c = -L + (2 * L) * (i + 0.5) / n;
    const nx = -sa * s, nz = ca * s;
    const bc = pt(c, s * (zf + zb) / 2, 0);
    rotBox(buckets[PLAIN], bc[0], bc[2], dw, (zf - zb) / 2, y0, y1, obb.ang, STUCCO);   // stucco body, back buried in the slope
    const fL = pt(c - s * dw, s * zf, y1), fR = pt(c + s * dw, s * zf, y1), aF = pt(c, s * zf, y2), aB = pt(c, s * zb, y2), aF2 = pt(c, s * (zf + 0.7), y2);
    buckets[PLAIN].triUV(fL[0], fL[1], fL[2], fR[0], fR[1], fR[2], aF[0], aF[1], aF[2], nx, 0, nz, ur, ug, ub, 0, 0, 0, 0, 0, 0);   // steep stucco gablet
    for (const sx of [1, -1] as const) {                                    // little shingle planes to a cross ridge
      const e0 = pt(c + sx * (dw + 0.7), s * (zf + 0.7), y1 - 0.4), e1 = pt(c + sx * (dw + 0.7), s * zb, y1 - 0.4);
      const shd = sx > 0 ? 1 : 0.88;
      buckets[SHINGLE].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], aB[0], aB[1], aB[2], aF2[0], aF2[1], aF2[2], ca * sx * 0.55, 0.72, sa * sx * 0.55, rr * shd, rg * shd, rb * shd);
    }
    const wf = pt(c, s * (zf + 0.25), 0), gc = pt(c, s * (zf + 0.5), 0);    // dark-framed casement in each dormer face
    rotBox(buckets[PLAIN], wf[0], wf[2], 2.3, 0.3, y0 + 2.4, y0 + 8.2, obb.ang, TRIM);
    rotBox(buckets[PLAIN], gc[0], gc[2], 1.7, 0.25, y0 + 3, y0 + 7.6, obb.ang, GLASS);
  }

  // dark brown wraparound veranda: plank-brown deck, thin posts, low double rail,
  // shed roof visible edge ≈ g+14 (deep by design — a real roofed porch, not eave creep)
  const porch = (x0: number, z0: number, x1: number, z1: number, ox: number, oz: number, dy: number) => {
    const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, len = Math.hypot(x1 - x0, z1 - z0), half = len / 2;
    const ux = (x1 - x0) / len, uz = (z1 - z0) / len;
    const segAng = obb.ang + Math.atan2(uz, ux);
    const PD = 12;                                                          // veranda depth (~1.5 m)
    const at = (t: number, o: number, y: number): [number, number, number] => pt(mx + ux * t + ox * o, mz + uz * t + oz * o, y);
    const dc = at(0, (PD - 2) / 2, 0);
    rotBox(buckets[PLAIN], dc[0], dc[2], half, (PD + 2) / 2, g - 3, g + 2.2 + dy, segAng, PORCH);   // deck (dy staggers segment tops — no coplanar fight)
    const nP = Math.max(2, Math.round(len / 13));
    for (let i = 0; i <= nP; i++) {
      const pc = at(-half + (len * i) / nP, PD - 1, 0);
      rotBox(buckets[PLAIN], pc[0], pc[2], 0.7, 0.7, g + 2, g + 14, segAng, TRIM);                  // thin posts
    }
    const rl = at(0, PD - 1, 0);
    rotBox(buckets[PLAIN], rl[0], rl[2], half, 0.5, g + 8.6 + dy, g + 9.4 + dy, segAng, TRIM);      // low rail + mid rail
    rotBox(buckets[PLAIN], rl[0], rl[2], half, 0.4, g + 5 + dy, g + 5.6 + dy, segAng, TRIM);
    const i0 = at(-half - 1, -1.5, g + 19.5), i1 = at(half + 1, -1.5, g + 19.5), o1 = at(half + 1, PD + 0.6, g + 14), o0 = at(-half - 1, PD + 0.6, g + 14);
    const wnx = ox * ca - oz * sa, wnz = ox * sa + oz * ca;
    tmp.set('#4a382a');
    buckets[SHINGLE].quad(i0[0], i0[1], i0[2], i1[0], i1[1], i1[2], o1[0], o1[1], o1[2], o0[0], o0[1], o0[2], wnx * 0.5, 0.85, wnz * 0.5, tmp.r, tmp.g, tmp.b);  // shed roof, tucked over the row-1 window heads
    const fc = at(0, PD + 0.4, 0);
    rotBox(buckets[PLAIN], fc[0], fc[2], half + 1, 0.5, g + 13.2, g + 14.4, segAng, TRIM);          // fascia
  };
  porch(-L, front * W, L, front * W, 0, front, 0);                                                  // the long front band
  for (const sx of [1, -1] as const) porch(sx * L, front * W, sx * L, -front * (W - 2), sx, 0, 0.18);   // wraps both ends
}

// ---- Ipswich bespokes (colors photo-verified, docs/research/ipswich.md) ----

// The Clam Box (1935) — the building IS an open fried-clam takeout box: walls
// flare OUTWARD toward the top, four false-front "lid flaps" splay open above
// a hidden flat roof. Gray-blue shingle, red-and-white awnings, red doors.
function clamBox(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1;
  // the rest of the footprint = the low one-storey rear dining wing
  clad(buckets[SHINGLE], b.p, g - 2, g + 10, '#9aa1a6');
  flatRoof(buckets[PLAIN], b.p, g + 10, '#6a6e73');
  // the BOX itself: compact, centred, rising through the wing roof
  const S = Math.min(L, W, 30), topH = g + 24, base = 0.88, flare = 1.06;
  tmp.set('#8f979d'); const wr = tmp.r, wg = tmp.g, wb = tmp.b;   // weathered gray-blue shingle
  tmp.set('#a8b0b6'); const fr = tmp.r, fg = tmp.g, fb = tmp.b;   // flaps catch more sky
  const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
  for (let i = 0; i < 4; i++) {   // four flared trapezoid walls
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    const a0 = pt(ax * S * base, az * S * base, g - 1), b0 = pt(bx * S * base, bz * S * base, g - 1);
    const a1 = pt(ax * S * flare, az * S * flare, topH), b1 = pt(bx * S * flare, bz * S * flare, topH);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, nx = mx * ca - mz * sa, nz = mx * sa + mz * ca;
    buckets[SHINGLE].quad(a0[0], a0[1], a0[2], b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], a1[0], a1[1], a1[2], nx, 0.15, nz, wr, wg, wb);
  }
  const lid: number[] = [];
  for (const [ax, az] of corners) { const p = pt(ax * S * flare, az * S * flare, 0); lid.push(p[0], p[2]); }
  flatRoof(buckets[PLAIN], lid, topH, '#5b5e63');                 // the hidden flat roof
  for (let i = 0; i < 4; i++) {   // four splayed lid flaps
    const [ax, az] = corners[i], [bx, bz] = corners[(i + 1) % 4];
    const a1 = pt(ax * S * flare, az * S * flare, topH), b1 = pt(bx * S * flare, bz * S * flare, topH);
    const a2 = pt(ax * S * flare * 1.14, az * S * flare * 1.14, topH + 7), b2 = pt(bx * S * flare * 1.14, bz * S * flare * 1.14, topH + 7);
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, nx = mx * ca - mz * sa, nz = mx * sa + mz * ca;
    buckets[SHINGLE].quad(a1[0], a1[1], a1[2], b1[0], b1[1], b1[2], b2[0], b2[1], b2[2], a2[0], a2[1], a2[2], nx, 0.4, nz, fr, fg, fb);
  }
  // white sign band + red letter-stripe on the street-facing flap
  const sf = pt(0, front * (S * flare + 1.2), 0);
  rotBox(buckets[PLAIN], sf[0], sf[2], S * 0.8, 0.5, topH + 1.5, topH + 6, obb.ang, '#f4f1ea');
  rotBox(buckets[PLAIN], sf[0], sf[2], S * 0.66, 0.7, topH + 2.9, topH + 4.6, obb.ang, '#b03028');
  // red-and-white striped awnings down both sides of the box
  for (const s of [1, -1] as const) {
    const off = s * (S * 0.95 + 2.2), ax = obb.cx + (-sa) * off, az = obb.cz + ca * off;
    rotBox(buckets[PLAIN], ax, az, S * 0.75, 2.4, g + 11, g + 12, obb.ang, '#b03028');
    rotBox(buckets[PLAIN], ax, az, S * 0.75, 2.5, g + 10.4, g + 11, obb.ang, '#f4f1ea');
  }
  // red doors + little gray entry canopy on the street face
  const df = pt(0, front * (S * base + 0.6), 0);
  rotBox(buckets[PLAIN], df[0], df[2], 3.0, 0.5, g, g + 9, obb.ang, '#a3282e');
  rotBox(buckets[PLAIN], df[0], df[2], 4.2, 2.0, g + 9, g + 9.8, obb.ang, '#7d8187');
  // roadside "Since 1935" sign on a post by the street
  const sp = pt(S * 1.4, front * (S * flare + 8), 0);
  buckets[PLAIN].box(sp[0], sp[2], 0.5, 0.5, g, g + 12, '#4a4d52', 0);
  rotBox(buckets[PLAIN], sp[0], sp[2], 4.4, 0.5, g + 12, g + 18, obb.ang, '#f4f1ea');
  rotBox(buckets[PLAIN], sp[0], sp[2], 3.6, 0.65, g + 13.4, g + 16.4, obb.ang, '#b03028');
}

// First Church in Ipswich (1971) — the SIXTH meetinghouse on the Green (the
// 1846 Gothic burned in 1965): white contemporary sanctuary, square front
// tower with tall amber glass strips + clock, white spire, the gilded rooster.
function ipswichFirstChurch(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1;
  const eaveH = g + 15;
  clad(buckets[CLAP], b.p, g - 2, eaveH, '#f2f0ea');              // white body
  flatRoof(buckets[PLAIN], b.p, eaveH, '#b9b6ad');                // the low parish wings
  // a modest gable over the central sanctuary only (the OBB spans the wings too)
  const ridgeY = eaveH + 9, L2 = L * 0.55, W2 = Math.min(W * 0.75, 15);
  tmp.set('#8a8d92'); const rr = tmp.r, rg = tmp.g, rb = tmp.b;
  for (const s of [1, -1] as const) { const e0 = pt(-L2, s * W2, eaveH), e1 = pt(L2, s * W2, eaveH), r0 = pt(-L2, 0, ridgeY), r1 = pt(L2, 0, ridgeY); buckets[SHINGLE].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], -sa * s * 0.7, 0.7, ca * s * 0.7, rr, rg, rb); }
  tmp.set('#f2f0ea'); const gr = tmp.r, gg = tmp.g, gb = tmp.b;
  for (const sx of [1, -1] as const) { const a = pt(sx * L2, W2, eaveH), b2 = pt(sx * L2, -W2, eaveH), pk = pt(sx * L2, 0, ridgeY); buckets[CLAP].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ca * sx, 0, sa * sx, gr, gg, gb, 0, 0, 0, 0, 0, 0); }
  // pointed amber windows down the sides
  tmp.set('#d8a83c'); const ar = tmp.r, ag = tmp.g, ab = tmp.b;
  for (const s of [1, -1] as const) for (let i = 0; i < 3; i++) {
    const lx = -L * 0.5 + L * (i / 2), lzf = s * (W + 0.2), nx = -sa * s, nz = ca * s;
    const C = (sx: number, y: number): [number, number, number] => pt(lx + sx * 1.2, lzf, y);
    const a = C(-1, g + 6), bb = C(1, g + 6), cc = C(1, g + 12), dd = C(-1, g + 12), apex = pt(lx, lzf, g + 14.5);
    buckets[GLOW].quad(a[0], a[1], a[2], bb[0], bb[1], bb[2], cc[0], cc[1], cc[2], dd[0], dd[1], dd[2], nx, 0, nz, ar, ag, ab);
    buckets[GLOW].triUV(dd[0], dd[1], dd[2], cc[0], cc[1], cc[2], apex[0], apex[1], apex[2], nx, 0, nz, ar, ag, ab, 0, 0, 0, 0, 0, 0);
  }
  // the square front tower
  const tw = Math.min(W * 0.55, 8), ring: number[] = [];
  const TP = (lx: number, lz: number) => { const p = pt(lx, lz, 0); ring.push(p[0], p[2]); };
  TP(-tw, front * (W - tw * 0.2)); TP(tw, front * (W - tw * 0.2)); TP(tw, front * (W + tw * 1.7)); TP(-tw, front * (W + tw * 1.7));
  const towerH = ridgeY + 16;
  clad(buckets[CLAP], ring, g - 2, towerH, '#f2f0ea');
  flatRoof(buckets[PLAIN], ring, towerH + 0.3, '#e9e6dd');
  // tall amber glass strips + clock on the tower's street face
  const tf = front * (W + tw * 1.7 + 0.25), nx = -sa * front, nz = ca * front;
  for (const dx of [-2.2, 0, 2.2]) {
    const q0 = pt(dx - 0.7, tf, g + 4), q1 = pt(dx + 0.7, tf, g + 4), q2 = pt(dx + 0.7, tf, towerH - 8), q3 = pt(dx - 0.7, tf, towerH - 8);
    buckets[GLOW].quad(q0[0], q0[1], q0[2], q1[0], q1[1], q1[2], q2[0], q2[1], q2[2], q3[0], q3[1], q3[2], nx, 0, nz, ar, ag, ab);
  }
  const ck = pt(0, tf, 0);
  rotBox(buckets[PLAIN], ck[0], ck[2], 1.8, 0.2, towerH - 5.5, towerH - 2, obb.ang, '#fbfaf6');   // clock face panel
  // white tapered spire + the gilded rooster
  const apex = pt(0, front * (W + tw * 0.75), towerH + 17);
  tmp.set('#f4f2ec'); const sr2 = tmp.r, sg2 = tmp.g, sb2 = tmp.b;
  for (let i = 0; i < ring.length; i += 2) {
    const aX = ring[i], aZ = ring[i + 1], bX = ring[(i + 2) % ring.length], bZ = ring[(i + 3) % ring.length];
    buckets[PLAIN].triUV(aX, towerH + 0.3, aZ, bX, towerH + 0.3, bZ, apex[0], apex[1], apex[2], 0, 0.9, 0, sr2, sg2, sb2, 0, 0, 0, 0, 0, 0);
  }
  buckets[PLAIN].box(apex[0], apex[2], 0.7, 0.7, towerH + 17, towerH + 19.2, '#d8b23c', 0);   // the ~40 lb gilded rooster
}

// Ascension Memorial Church (Renwick, 1869) — WOOD Carpenter Gothic, not
// stone: olive board-and-batten body, dark brown trim, crimson doors, side
// bell tower with a steep pyramidal cap.
function ascensionIpswich(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1;
  const eaveH = g + 14;
  clad(buckets[CLAP], b.p, g - 2, eaveH, '#7b7767');              // olive/taupe body
  const ridgeY = eaveH + Math.min(W * 0.95, 15), Lr = L + 1, Wr = W + 1;
  tmp.set('#4a423a'); const rr = tmp.r, rg = tmp.g, rb = tmp.b;   // dark brown shingle roof
  for (const s of [1, -1] as const) { const e0 = pt(-Lr, s * Wr, eaveH), e1 = pt(Lr, s * Wr, eaveH), r0 = pt(-Lr, 0, ridgeY), r1 = pt(Lr, 0, ridgeY); buckets[SHINGLE].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], -sa * s * 0.5, 0.85, ca * s * 0.5, rr, rg, rb); }
  tmp.set('#7b7767'); const gr = tmp.r, gg = tmp.g, gb = tmp.b;
  for (const sx of [1, -1] as const) { const a = pt(sx * L, W, eaveH), b2 = pt(sx * L, -W, eaveH), pk = pt(sx * L, 0, ridgeY); buckets[CLAP].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ca * sx, 0, sa * sx, gr, gg, gb, 0, 0, 0, 0, 0, 0); }
  // pointed windows (soft amber glow), crimson double door + rose window on the front gable
  tmp.set('#c08a4a'); const ar = tmp.r, ag = tmp.g, ab = tmp.b;
  for (const s of [1, -1] as const) for (let i = 0; i < 3; i++) {
    const lx = -L * 0.55 + L * 1.1 * (i / 2), lzf = s * (W + 0.2), nx = -sa * s, nz = ca * s;
    const C = (sx: number, y: number): [number, number, number] => pt(lx + sx * 1.1, lzf, y);
    const a = C(-1, g + 5), bb = C(1, g + 5), cc = C(1, g + 11), dd = C(-1, g + 11), apex = pt(lx, lzf, g + 13);
    buckets[GLOW].quad(a[0], a[1], a[2], bb[0], bb[1], bb[2], cc[0], cc[1], cc[2], dd[0], dd[1], dd[2], nx, 0, nz, ar, ag, ab);
    buckets[GLOW].triUV(dd[0], dd[1], dd[2], cc[0], cc[1], cc[2], apex[0], apex[1], apex[2], nx, 0, nz, ar, ag, ab, 0, 0, 0, 0, 0, 0);
  }
  const df = pt(0, front * (W + 0.4), 0), nx = -sa * front, nz = ca * front;
  rotBox(buckets[PLAIN], df[0], df[2], 2.4, 0.45, g, g + 9, obb.ang, '#a3282e');      // crimson doors
  const q0 = pt(-1.6, front * (W + 0.25), ridgeY - 6), q1 = pt(1.6, front * (W + 0.25), ridgeY - 6), q2 = pt(1.6, front * (W + 0.25), ridgeY - 3), q3 = pt(-1.6, front * (W + 0.25), ridgeY - 3);
  buckets[GLOW].quad(q0[0], q0[1], q0[2], q1[0], q1[1], q1[2], q2[0], q2[1], q2[2], q3[0], q3[1], q3[2], nx, 0, nz, ar, ag, ab);   // rose window (abstracted)
  // corner bell tower with pyramidal cap
  const tw = Math.min(W * 0.42, 6), ring: number[] = [];
  const TP = (lx: number, lz: number) => { const p = pt(lx, lz, 0); ring.push(p[0], p[2]); };
  TP(L * 0.6 - tw, front * (W - tw * 0.1)); TP(L * 0.6 + tw, front * (W - tw * 0.1)); TP(L * 0.6 + tw, front * (W + tw * 1.8)); TP(L * 0.6 - tw, front * (W + tw * 1.8));
  const towerH = ridgeY + 10;
  clad(buckets[CLAP], ring, g - 2, towerH, '#7b7767');
  const bo = pt(L * 0.6, front * (W + tw * 1.8 + 0.2), 0);
  rotBox(buckets[PLAIN], bo[0], bo[2], 1.6, 0.2, towerH - 6, towerH - 1.5, obb.ang, '#241f1c');   // open belfry (dark)
  const capApex = pt(L * 0.6, front * (W + tw * 0.85), towerH + 9);
  tmp.set('#4a423a'); const cr = tmp.r, cg = tmp.g, cb = tmp.b;
  for (let i = 0; i < ring.length; i += 2) {
    const aX = ring[i], aZ = ring[i + 1], bX = ring[(i + 2) % ring.length], bZ = ring[(i + 3) % ring.length];
    buckets[SHINGLE].triUV(aX, towerH, aZ, bX, towerH, bZ, capApex[0], capApex[1], capApex[2], 0, 0.9, 0, cr, cg, cb, 0, 0, 0, 0, 0, 0);
  }
}

// A big New England working barn — weathered boards, metal gable roof, big
// sliding doors on both gable ends (Russell Orchards' 1800s store barn).
function boardBarn(buckets: Bucket[], b: Building, g: number, index: WorldIndex, o: { wall: string; roof: string; door: string; trim: string; h?: number }) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw, eaveH = g + (o.h ?? 17);
  clad(buckets[CLAP], b.p, g - 2, eaveH, o.wall);
  const ridgeY = eaveH + Math.min(W * 0.95, 13), Lr = L + 1, Wr = W + 1;
  tmp.set(o.roof); const rr = tmp.r, rg = tmp.g, rb = tmp.b;      // silver standing-seam metal
  for (const s of [1, -1] as const) { const e0 = pt(-Lr, s * Wr, eaveH), e1 = pt(Lr, s * Wr, eaveH), r0 = pt(-Lr, 0, ridgeY), r1 = pt(Lr, 0, ridgeY); buckets[PLAIN].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], -sa * s * 0.5, 0.85, ca * s * 0.5, rr, rg, rb); }
  tmp.set(o.wall); const wr = tmp.r, wg = tmp.g, wb = tmp.b;
  for (const sx of [1, -1] as const) {
    const a = pt(sx * L, W, eaveH), b2 = pt(sx * L, -W, eaveH), pk = pt(sx * L, 0, ridgeY);
    buckets[CLAP].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ca * sx, 0, sa * sx, wr, wg, wb, 0, 0, 0, 0, 0, 0);
    // dark green sliding door + white transom strip on each gable end
    const d = pt(sx * (L + 0.35), 0, 0);
    rotBox(buckets[PLAIN], d[0], d[2], 0.5, Math.min(W * 0.45, 5.5), g, g + 10, obb.ang, o.door);
    rotBox(buckets[PLAIN], d[0], d[2], 0.4, Math.min(W * 0.5, 6), g + 10.2, g + 11.4, obb.ang, o.trim);
  }
}

// Woodman's of Essex (1914) — the fried clam's birthplace: gray shingle box,
// white sidewalk canopy, stacked red/white/navy roof signs, the flag.
function woodmansEssex(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const L = obb.hl, W = obb.hw;
  const fs = frontSegment(b, index);
  const front = (fs.nx * (-sa) + fs.nz * ca) >= 0 ? 1 : -1;
  const eaveH = g + 19;
  clad(buckets[SHINGLE], b.p, g - 2, eaveH, '#97999b');           // gray shingle + gray boards
  const ridgeY = eaveH + Math.min(W * 0.7, 9), Lr = L + 0.8, Wr = W + 0.8;
  tmp.set('#3f4145'); const rr = tmp.r, rg = tmp.g, rb = tmp.b;
  for (const s of [1, -1] as const) { const e0 = pt(-Lr, s * Wr, eaveH), e1 = pt(Lr, s * Wr, eaveH), r0 = pt(-Lr, 0, ridgeY), r1 = pt(Lr, 0, ridgeY); buckets[PLAIN].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], -sa * s * 0.5, 0.85, ca * s * 0.5, rr, rg, rb); }
  tmp.set('#97999b'); const wr = tmp.r, wg = tmp.g, wb = tmp.b;
  for (const sx of [1, -1] as const) { const a = pt(sx * L, W, eaveH), b2 = pt(sx * L, -W, eaveH), pk = pt(sx * L, 0, ridgeY); buckets[SHINGLE].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ca * sx, 0, sa * sx, wr, wg, wb, 0, 0, 0, 0, 0, 0); }
  // white flat canopy along the sidewalk face, on slim posts
  const cf = front * (W + 3.2), cx = obb.cx + (-sa) * cf, cz = obb.cz + ca * cf;
  rotBox(buckets[PLAIN], cx, cz, L * 0.9, 3.4, g + 10.6, g + 11.4, obb.ang, '#f4f1ea');
  for (const dx of [-L * 0.7, 0, L * 0.7]) { const p = pt(dx, front * (W + 5.8), 0); buckets[PLAIN].box(p[0], p[2], 0.4, 0.4, g, g + 10.6, '#f4f1ea', 0); }
  // stacked roof sign panels above the ridge: WOODMAN'S / FRIED CLAMS / IN THE ROUGH
  const sf = pt(0, front * W * 0.35, 0);
  rotBox(buckets[PLAIN], sf[0], sf[2], L * 0.6, 0.6, ridgeY + 0.5, ridgeY + 3.6, obb.ang, '#b03028');
  rotBox(buckets[PLAIN], sf[0], sf[2], L * 0.52, 0.7, ridgeY + 3.6, ridgeY + 6.2, obb.ang, '#f4f1ea');
  rotBox(buckets[PLAIN], sf[0], sf[2], L * 0.44, 0.8, ridgeY + 6.2, ridgeY + 8.4, obb.ang, '#26324e');
  // the flag
  const fp = pt(-L * 0.78, front * W * 0.35, 0);
  buckets[PLAIN].box(fp[0], fp[2], 0.3, 0.3, ridgeY, ridgeY + 11, '#e8e5da', 0);
  rotBox(buckets[PLAIN], fp[0] + ca * 2.2, fp[2] + sa * 2.2, 2.2, 0.15, ridgeY + 8.5, ridgeY + 10.5, obb.ang, '#b03028');
}

// ── Charlestown ──────────────────────────────────────────────────────────────

// One band of a tapering shaft: ring `loRing` at y0 rising to `hiRing` at y1, so
// the result is a true frustum. Stacking prisms instead leaves a visible lip at
// every course, which on a monument reads as a factory chimney.
// Follows walls()' conventions exactly (winding via ringToVec2, world z = -v.y,
// ashlar UVs), so the two can be mixed on one structure.
function taperBand(bk: Bucket, loRing: number[], hiRing: number[], y0: number, y1: number, hex: string, texScale = TEX_SCALE) {
  const lo = ringToVec2(loRing), hi = ringToVec2(hiRing);
  tmp.set(hex);
  const r = tmp.r, gg = tmp.g, bb = tmp.b;
  for (let i = 0; i < lo.length; i++) {
    const j = (i + 1) % lo.length;
    const a = lo[i], b2 = lo[j], c = hi[j], d = hi[i];
    const ex = b2.x - a.x, ey = b2.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 0.01) continue;
    const nx = ey / len, nz = ex / len;
    const shade = 0.78 + 0.22 * Math.max(0, nx * 0.35 + nz * 0.85);
    const u = texScale ? len / texScale : 0;
    const v0 = texScale ? y0 / texScale : 0, v1 = texScale ? y1 / texScale : 0;
    bk.quadUV(a.x, y0, -a.y, b2.x, y0, -b2.y, c.x, y1, -c.y, d.x, y1, -d.y,
      nx, 0, nz, r * shade, gg * shade, bb * shade, 0, v0, u, v0, u, v1, 0, v1);
  }
}

// Bunker Hill Monument (cornerstone 1825, dedicated 1843) — the Quincy granite
// obelisk on Breed's Hill, where the battle was actually fought; the hill named
// Bunker is the next one north, and OSM's natural=peak "Bunker Hill" node sits
// up there, 550 m away.
//
// Real proportions, and they matter because this is the silhouette of the whole
// town: 221 ft tall, 30 ft square at the base, tapering to 15 ft 4 in where the
// short pyramidal cap begins. At 8 px = 1 m that is 539 px — nearly five times
// the tallest structure previously in the set (Newburyport's rear range light,
// ~111 px), so nothing here is scaled off a storey count.
// OSM traces the footprint as an 8.90 m square (29.2 ft) and tags it
// building=yes + historic=monument, which classifies it as a 1.5-storey HOUSE
// without this hero.
const MONU_H = 221 * 0.3048 * 8;          // 221 ft → world px
const MONU_CAP = 14 * 0.3048 * 8;         // the pyramidion
const MONU_TOP = 15.33 / 30;              // shaft taper: 15 ft 4 in over 30 ft
function bunkerHillMonument(buckets: Bucket[], b: Building, g: number) {
  const [cx, cz] = centroidOf(b.p);
  const scaled = (s: number) => {
    const r: number[] = [];
    for (let i = 0; i < b.p.length; i += 2) r.push(cx + (b.p[i] - cx) * s, cz + (b.p[i + 1] - cz) * s);
    return r;
  };
  const GRANITE = '#b8b3a8';                // sunlit Quincy granite — light warm grey, NOT charcoal
  // PLAIN, not BRICK: brickTex() bakes RED brick into the texture and the vertex
  // colour multiplies it, so any grey handed to the BRICK bucket comes out a dark
  // reddish brown. The monument is smooth-dressed granite with fine joints
  // anyway — flat faces with walls()' per-face sun shading is what it looks like.
  const stone = buckets[PLAIN];
  const plinthY = g + 16, shaftTop = g + MONU_H - MONU_CAP;

  // stepped granite plinth — the obelisk does not spring straight from the grass
  walls(stone, scaled(1.17), g - 8, g + 8, GRANITE, 0);
  flatRoof(buckets[PLAIN], scaled(1.17), g + 8, '#8e8a82');
  walls(stone, scaled(1.07), g + 8, plinthY, GRANITE, 0);
  flatRoof(buckets[PLAIN], scaled(1.07), plinthY, '#8e8a82');

  // the shaft: one frustum, base ring → 51% ring
  taperBand(stone, b.p, scaled(MONU_TOP), plinthY, shaftTop, GRANITE, 0);
  // the cap: a short pyramid, left with a hair of a top face so the ring never degenerates
  taperBand(stone, scaled(MONU_TOP), scaled(MONU_TOP * 0.07), shaftTop, g + MONU_H, GRANITE, 0);
  flatRoof(buckets[PLAIN], scaled(MONU_TOP * 0.07), g + MONU_H, '#8e8a82');

  // observation chamber: one small window per face, just under the cap — the
  // room at the top of the 294 steps, where the two cannon stand
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const sTop = MONU_TOP;                                   // shaft scale at the chamber
  const wy0 = shaftTop - 46, wy1 = shaftTop - 30;
  tmp.set('#31343a');
  const wr = tmp.r, wg = tmp.g, wb = tmp.b;
  for (const [al, aw] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const hl = obb.hl * sTop, hw = obb.hw * sTop;
    // face centre, pushed 0.7 px proud so it never z-fights the shaft
    const fl = al * (hl + 0.7), fw = aw * (hw + 0.7);
    // in-face tangent runs along whichever axis the face does not face
    const tl = aw !== 0 ? 5.5 : 0, tw = al !== 0 ? 5.5 : 0;
    const P = (l: number, w: number, y: number): [number, number, number] =>
      [obb.cx + l * ca - w * sa, y, obb.cz + l * sa + w * ca];
    const p0 = P(fl - tl, fw - tw, wy0), p1 = P(fl + tl, fw + tw, wy0);
    const p2 = P(fl + tl, fw + tw, wy1), p3 = P(fl - tl, fw - tw, wy1);
    const nx = al * ca - aw * sa, nz = al * sa + aw * ca;
    buckets[GLOW].quad(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2],
      nx, 0, nz, wr, wg, wb);
  }

  // the doorway, on the face looking toward the Lodge (south, +z)
  {
    const faces = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
    let bestL = 1, bestW = 0, bestZ = -Infinity;
    for (const [al, aw] of faces) {
      const nz = al * sa + aw * ca;
      if (nz > bestZ) { bestZ = nz; bestL = al; bestW = aw; }
    }
    const hl = obb.hl * 1.07, hw = obb.hw * 1.07;
    const fl = bestL * (hl + 0.6), fw = bestW * (hw + 0.6);
    const dx = obb.cx + fl * ca - fw * sa, dz = obb.cz + fl * sa + fw * ca;
    // tangent along the face
    const tx = bestW !== 0 ? ca : -sa, tz = bestW !== 0 ? sa : ca;
    const nx = bestL * ca - bestW * sa, nz = bestL * sa + bestW * ca;
    roundArch(buckets[PLAIN], dx, dz, tx, tz, nx, nz, 5, g - 2, g + 11, '#2b2723');
  }
}

// A long low masonry shed with a shallow gable and regular window bays — the
// Charlestown Navy Yard's working buildings. Written long-axis-aware because the
// Rope Walk is 405 m by 23 m and obbOf hands back its length in `hw`; every
// existing shed builder (warehouse, brickShed, federalHouse) assumes hl is the
// long side and would lay it across the yard instead of along it.
type ShedOpts = {
  wall: string; roof: string; material?: 'granite' | 'brick';
  eave?: number; ridge?: number; bay?: number; rows?: number;
};
function yardShed(buckets: Bucket[], b: Building, g: number, o: ShedOpts) {
  const obb = obbOf(b.p);
  const long = obb.hl >= obb.hw;
  const ang = long ? obb.ang : obb.ang + Math.PI / 2;
  const L = long ? obb.hl : obb.hw, W = long ? obb.hw : obb.hl;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const pt = (lx: number, lz: number, y: number): [number, number, number] => [obb.cx + lx * ca - lz * sa, y, obb.cz + lx * sa + lz * ca];
  const eaveH = g + (o.eave ?? 40), ridgeY = eaveH + (o.ridge ?? Math.min(W * 0.5, 22));
  // granite is smooth ashlar → PLAIN (the BRICK bucket's texture is baked RED and
  // multiplies, so grey handed to it comes out reddish-brown)
  if (o.material === 'brick') walls(buckets[BRICK], b.p, g - 4, eaveH, o.wall);
  else walls(buckets[PLAIN], b.p, g - 4, eaveH, o.wall, 0);
  // shallow gable along the long axis
  tmp.set(o.roof); const rr = tmp.r, rg = tmp.g, rb = tmp.b;
  const Lr = L + 1.2, Wr = W + 1.2;
  for (const s of [1, -1] as const) {
    const e0 = pt(-Lr, s * Wr, eaveH), e1 = pt(Lr, s * Wr, eaveH), r0 = pt(-Lr, 0, ridgeY), r1 = pt(Lr, 0, ridgeY);
    buckets[PLAIN].quad(e0[0], e0[1], e0[2], e1[0], e1[1], e1[2], r1[0], r1[1], r1[2], r0[0], r0[1], r0[2], -sa * s * 0.5, 0.85, ca * s * 0.5, rr, rg, rb);
  }
  // gable ends
  tmp.set(o.wall); const wr = tmp.r, wg = tmp.g, wb = tmp.b;
  for (const sx of [1, -1] as const) {
    const a = pt(sx * L, W, eaveH), b2 = pt(sx * L, -W, eaveH), pk = pt(sx * L, 0, ridgeY);
    buckets[PLAIN].triUV(a[0], a[1], a[2], b2[0], b2[1], b2[2], pk[0], pk[1], pk[2], ca * sx, 0, sa * sx, wr, wg, wb, 0, 0, 0, 0, 0, 0);
  }
  // window bays marching the whole length, both long faces
  const bay = o.bay ?? 34, rows = o.rows ?? 1;
  tmp.set('#2f3238'); const gr = tmp.r, gg2 = tmp.g, gb = tmp.b;
  const wallH = eaveH - g;
  for (let lx = -L + bay * 0.8; lx <= L - bay * 0.8; lx += bay) {
    for (let r = 0; r < rows; r++) {
      const y0 = g + wallH * (0.22 + r / rows * 0.62), y1 = y0 + Math.min(13, wallH * 0.3);
      for (const s of [1, -1] as const) {
        const p0 = pt(lx - 4.5, s * (W + 0.7), y0), p1 = pt(lx + 4.5, s * (W + 0.7), y0);
        const p2 = pt(lx + 4.5, s * (W + 0.7), y1), p3 = pt(lx - 4.5, s * (W + 0.7), y1);
        buckets[GLOW].quad(p0[0], p0[1], p0[2], p1[0], p1[1], p1[2], p2[0], p2[1], p2[2], p3[0], p3[1], p3[2],
          -sa * s, 0, ca * s, gr, gg2, gb);
      }
    }
  }
}

// Muster House (1852) — the Navy Yard's brick OCTAGON, where the yard's workmen
// mustered for the day. OSM traces it with eight vertices, so the footprint is
// already the octagon; the shallow pyramidal roof is a taperBand up to a small
// ring, capped with the little lantern.
function musterHouse(buckets: Bucket[], b: Building, g: number) {
  const [cx, cz] = centroidOf(b.p);
  const scaled = (s: number) => {
    const r: number[] = [];
    for (let i = 0; i < b.p.length; i += 2) r.push(cx + (b.p[i] - cx) * s, cz + (b.p[i + 1] - cz) * s);
    return r;
  };
  const BRICKC = '#a05a44', TRIM = '#efe9dc';
  const eaveH = g + 40;
  walls(buckets[BRICK], b.p, g - 4, eaveH, BRICKC);
  walls(buckets[PLAIN], expandRing(b.p, 1.4), eaveH - 2.4, eaveH + 1.2, TRIM, 0);   // bracketed Italianate cornice
  taperBand(buckets[PLAIN], expandRing(b.p, 1.4), scaled(0.26), eaveH + 1.2, eaveH + 20, '#6c7078', 0);
  flatRoof(buckets[PLAIN], scaled(0.26), eaveH + 20, '#6c7078');
  walls(buckets[PLAIN], scaled(0.22), eaveH + 20, eaveH + 30, TRIM, 0);             // lantern
  taperBand(buckets[PLAIN], scaled(0.24), scaled(0.03), eaveH + 30, eaveH + 38, '#6c7078', 0);
  // two rows of tall windows, one per octagon face
  tmp.set('#2f3238');
  const wr = tmp.r, wg = tmp.g, wb = tmp.b;
  // walls()' convention: vertex (v.x, y, -v.y), face normal (ey/len, 0, ex/len)
  // from the VEC2 edge delta, and tangent (ex/len, -ey/len). Mirror it exactly so
  // the window sits flat on the face it belongs to.
  const v = ringToVec2(b.p);
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b2 = v[(i + 1) % v.length];
    const ex = b2.x - a.x, ey = b2.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 8) continue;
    const nx = ey / len, nz = ex / len;             // outward, in world x/z
    const tx = ex / len, tz = -ey / len;            // along the face, in world x/z
    const mx = (a.x + b2.x) / 2 + nx * 0.6;
    const mz = -(a.y + b2.y) / 2 + nz * 0.6;
    const hw2 = Math.min(5, len * 0.22);
    for (const [y0, y1] of [[g + 9, g + 21], [g + 25, g + 35]] as const) {
      buckets[GLOW].quad(mx - tx * hw2, y0, mz - tz * hw2, mx + tx * hw2, y0, mz + tz * hw2,
        mx + tx * hw2, y1, mz + tz * hw2, mx - tx * hw2, y1, mz - tz * hw2,
        nx, 0, nz, wr, wg, wb);
    }
  }
}

const HEROES: Record<string, HeroBuilder> = {
  // Both towns' heroes coexist here — entries are keyed by unique OSM building
  // names, so only the loaded town's world.json ever matches its own set.
  'The Witch House': witchHouse,
  'The House of the Seven Gables': sevenGables,
  'Hathaway House': hathawayHouse,
  'Narbonne House': narbonneHouse,
  'Custom House': customHouse,
  'Salem Witch Museum': witchMuseum,
  'Ropes Mansion': ropesMansion,
  'Derby House': derbyHouse,
  'Gardner-Pingree House': gardnerPingree,
  'Crowninshield-Bentley House': crowninshieldBentley,
  'Yin Yu Tang': yinYuTang,
  'Hamilton Hall': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#9c4d3c', material: 'brick', trim: '#ece6d8', roof: '#7f848c', storeys: 3, roofKind: 'gable', stringcourses: true, palladian: 'row', entrance: 'portico', chimney: 'interior4' }),
  'Andrew Safford House': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#9c4d3c', material: 'brick', trim: '#ece6d8', roof: '#7f848c', storeys: 3, roofKind: 'hip', balustrade: 'plain', entrance: 'colossal', palladian: 'single', shutter: '#23262a', chimney: 'interior4' }),
  'Philips House': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#9a9c96', material: 'clap', trim: '#fbfaf6', roof: '#9aa0a8', storeys: 3, roofKind: 'hip', entrance: 'portico', palladian: 'single', shutter: '#23262a', chimney: 'interior4' }),   // photo-audited 7/6: GREY clapboard (was cream), black shutters — the grey/white contrast is the signature. (Real spelling is "Phillips"; key matches OSM.)
  'Hawkes House': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#c7a98e', material: 'clap', trim: '#fbfaf6', roof: '#9aa0a8', storeys: 3, roofKind: 'hip', balustrade: 'plain', entrance: 'fan', shutter: '#23262a', chimney: 'interior4' }),   // photo-audited 7/6: pale tan/buff (was mustard gold), black shutters
  'Nathaniel Bowditch House': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#96a3b8', material: 'clap', trim: '#fbfaf6', roof: '#9aa0a8', storeys: 3, roofKind: 'hip', balustrade: 'fret', entrance: 'fan', shutter: '#23262a', chimney: 'interior4' }),   // photo-audited 7/6: light slate-blue (was greige), black shutters
  'Salem Athenæum': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#9c4d3c', material: 'brick', trim: '#ece6d8', roof: '#7f848c', storeys: 2, roofKind: 'hip', entrance: 'portico', palladian: 'single', stringcourses: true, chimney: 'ends2' }),
  'Lyceum Hall': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#9e5340', material: 'brick', trim: '#d8d0c0', roof: '#7f848c', storeys: 2, roofKind: 'gable', entrance: 'fan' }),
  'Hawthorne Hotel': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#97493a', material: 'brick', trim: '#e6e0d2', roof: '#3a3a3d', storeys: 6, roofKind: 'flat', entrance: 'canopy', flag: true, bays: 7 }),
  'First Church in Salem': (bk, b, g, i) => salemChurch(bk, b, g, i, { stone: '#7e7f83' }),
  "St. Peter's Episcopal Church": (bk, b, g, i) => salemChurch(bk, b, g, i, { stone: '#9a9b9d', quatrefoil: true }),
  'Pedrick Store House': (bk, b, g, i) => warehouse(bk, b, g, i, { wall: '#3d332a', roof: '#8a7e6c' }),   // photo-audited 7/6: near-black boards under LIGHTER weathered-cedar roof (was inverted)
  'Friendship of Salem': tallShip,
  // — Charlestown —
  'Bunker Hill Monument': bunkerHillMonument,
  // Old Ironsides, afloat at Pier 1 since 1897. 204 ft on deck with a 220 ft
  // mainmast, so her rig is ~3.5× Friendship's relative to hull length; black
  // hull with the white stripe along the gunports she wears today.
  'USS Constitution': (bk, b, g, i) => tallShip(bk, b, g, i, { mastMul: 3.5, yardMul: 1.55, hull: '#22222a', stripe: '#eae6da', stripeY: [-17, -7] }),
  // The Rope Walk (Alexander Parris, 1834–37) — a quarter mile of GRANITE, 1,360
  // ft by 45 ft, the only surviving naval ropewalk in the country. Two storeys of
  // ashlar under a shallow slate gable, windows the whole way down both sides.
  'Rope Walk': (bk, b, g) => yardShed(bk, b, g, { wall: '#b0aca2', roof: '#5e646c', eave: 46, ridge: 16, bay: 38, rows: 2 }),
  'Timber Shed': (bk, b, g) => yardShed(bk, b, g, { wall: '#a8543f', roof: '#6b7079', material: 'brick', eave: 42, bay: 40 }),
  'Hemp House': (bk, b, g) => yardShed(bk, b, g, { wall: '#a8543f', roof: '#6b7079', material: 'brick', eave: 46, bay: 36, rows: 2 }),
  'Muster House': musterHouse,
  // The 1805 Commandant's House on the hill above the yard — the grandest thing
  // in it: three storeys of brick, hipped roof, wide verandah toward the harbor.
  "Commandant's House": (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#9e5340', material: 'brick', trim: '#f2ede1', roof: '#7f848c', storeys: 3, roofKind: 'hip', balustrade: 'plain', entrance: 'portico', stringcourses: true, chimney: 'interior4' }),
  'Scale House': (bk, b, g, i) => brickShed(bk, b, g, i, { wall: '#9c4d3c', roof: '#777c85' }),
  // — Beverly (colors photo-verified, docs/research/beverly.md) —
  'John Balch House': (bk, b, g, i) => firstPeriod(bk, b, g, i, { wall: '#43302a', shingle: '#59604f', nGables: 2, chimney: 'central', eave: 22 }),   // dark red-brown clapboard, weathered gray-green roof, twin front cross-gables ("1636", dendro ~1679)
  'Hale Farm': (bk, b, g, i) => gambrelHouse(bk, b, g, i, { wall: '#c89a45', material: 'clap', roof: '#8f887a', trim: '#f0ead8', storeys: 2.5, dormers: 2, chimney: 'ridge2', entrance: 'pediment', shutter: '#2f4a30' }),   // mustard/ochre + dark green shutters — NOT brown, NOT white; the 1745 gambrel wing faces Hale St
  'Cabot House': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#9c4d3c', material: 'brick', trim: '#f2ede1', roof: '#8a8f97', storeys: 3, roofKind: 'hip', entrance: 'portico', stringcourses: true, chimney: 'ends2' }),   // 1781 — Beverly's first brick mansion; Beverly Bank founded in it 1802
  'Beverly City Hall': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#a8543f', material: 'brick', trim: '#f4efe4', roof: '#6f7d72', storeys: 3, roofKind: 'flat', entrance: 'portico', chimney: 'none', flag: true }),   // 1783 Andrew Cabot mansion — PAINTED barn-red brick, white Ionic porch; the 1874 mansard+cupola came off in 1933, so: flat
  'Tupper Manor': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#9c4d3c', material: 'brick', trim: '#f0ebdf', roof: '#7f848c', storeys: 3, roofKind: 'hip', balustrade: 'plain', entrance: 'portico', palladian: 'single', stringcourses: true, chimney: 'interior4' }),   // 1901 Georgian Revival (Guy Lowell), Endicott's oceanfront mansion
  'Hospital Point Light': buildHospitalPoint,
  'Beverly Depot': beverlyDepot,
  'Beverly Public Library': beverlyLibrary,
  '100 Cummings Center': (bk, b, g, i) => cummingsShoe(bk, b, g, i, { storeys: 4, stack: true }),
  '200 Cummings Center': (bk, b, g, i) => cummingsShoe(bk, b, g, i, { storeys: 2 }),
  '500 Cummings Center': (bk, b, g, i) => cummingsShoe(bk, b, g, i, { storeys: 6 }),
  '600 Cummings Center': (bk, b, g, i) => cummingsShoe(bk, b, g, i, { storeys: 2 }),
  'Cabot Theatre': cabotTheatre,
  'First Parish Church': firstParishBeverly,
  'Prides Crossing Confections': pridesStation,
  'Beverly Golf & Tennis Clubhouse': golfClubhouse,
  // — Ipswich (colors photo-verified, docs/research/ipswich.md) —
  'the Captain John Whipple House (1677)': (bk, b, g, i) => firstPeriod(bk, b, g, i, { wall: '#2b2825', shingle: '#6e675c', nGables: 2, chimney: 'central', eave: 26 }),   // near-BLACK clapboard, weathered gray-brown roof — National Historic Landmark
  'the John and Sarah Dillingham Caldwell house (1660)': (bk, b, g, i) => firstPeriod(bk, b, g, i, { wall: '#3d2b1f', shingle: '#8a857a', nGables: 2, chimney: 'central' }),   // dark chocolate clapboard, gray shingle roof
  'the John Kimball house (1680)': (bk, b, g, i) => firstPeriod(bk, b, g, i, { wall: '#7e3a2a', shingle: '#5c5c60', jetty: '#7e3a2a', nGables: 2, chimney: 'central' }),   // barn-red incl. casings; 12-inch jetty overhang
  'the Captain Matthew Perkins house (1701)': (bk, b, g, i) => firstPeriod(bk, b, g, i, { wall: '#d9d6cc', shingle: '#7d8271', nGables: 2, chimney: 'big' }),   // white/off-white, green-gray wood-shingle roof, elaborate pilastered chimney
  'Heard House': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#e9e2cf', material: 'clap', trim: '#f7f3e8', roof: '#8b9097', storeys: 3, roofKind: 'hip', entrance: 'portico', shutter: '#2f4a30', chimney: 'interior4' }),   // 1795 China-trade Federal: cream clapboard, DARK GREEN shutters — the Ipswich Museum
  'Ipswich Town Hall': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#9c4d3c', material: 'brick', trim: '#f2ede1', roof: '#5a5c60', storeys: 3, roofKind: 'flat', entrance: 'colossal', flag: true, stringcourses: true, chimney: 'none' }),   // 1936 PWA school-turned-town-hall: red brick + monumental white portico
  'Ipswich Public Library': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#9a4b38', material: 'brick', trim: '#d9d5c9', roof: '#55575c', storeys: 2, roofKind: 'gable', entrance: 'portico', chimney: 'none' }),   // 1869: red brick with pale granite quoins, pedimented front
  'Old Town Hall': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#9aa38b', material: 'clap', trim: '#6f7a68', roof: '#7f838a', storeys: 2, roofKind: 'gable', entrance: 'pediment', shutter: '#23262a', chimney: 'none' }),   // 1833 Greek Revival temple front — pale sage green, columns removed 1876, no cupola today
  'Hall-Haskell House': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#8e3b2e', material: 'clap', trim: '#efe9dc', roof: '#b3ac9c', storeys: 2, roofKind: 'gable', entrance: 'pediment', chimney: 'ends2' }),   // 1820 barn-red visitor center on S Main
  'the Hart House (1678)': (bk, b, g, i) => gambrelHouse(bk, b, g, i, { wall: '#c9b998', material: 'clap', roof: '#4e463c', trim: '#f0ead9', storeys: 2.5, dormers: 2, chimney: 'ridge2', entrance: 'pediment' }),   // light TAN/putty (NOT dark brown — the trap), gambrel block of the restaurant cluster
  'Great House': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#c09578', material: 'brick', trim: '#e5decd', roof: '#7d8a80', storeys: 3, roofKind: 'hip', balustrade: 'plain', cupola: true, entrance: 'portico', stringcourses: true, chimney: 'interior4' }),   // Castle Hill, 1928: rosy-buff Holland brick (NOT deep red), stone trim, gray-green slate, white balustrade + cupola
  'First Church in Ipswich': ipswichFirstChurch,
  'Ascension Memorial Church': ascensionIpswich,
  'Clam Box': clamBox,
  "Woodman's": woodmansEssex,
  'Russell Orchards': (bk, b, g, i) => boardBarn(bk, b, g, i, { wall: '#a8845c', roof: '#c4c7cb', door: '#2f4a30', trim: '#f4f1ea', h: 18 }),   // honey-amber weathered boards, SILVER metal roof, dark green sliding doors — NOT a red barn
  'Newburyport High School': buildNHS,
  'The Residences on the Ridge': buildResidencesRidge,
  'Ridge Carriage House': buildRidgeCarriage,
  'First Religious Society': buildFRS,
  'Custom House Maritime Museum': buildCustomHouse,
  'Firehouse Center For The Arts': buildFirehouse,
  'Newburyport City Hall': buildCityHall,
  'Atkinson Stone Tower': buildStoneTower,
  "March's Hill Water Tower": buildWaterTower,
  "Butler's Toothpick": buildToothpick,
  'Museum of Old Newbury': buildCushing,
  'Newburyport Public Library': buildLibrary,
  'Essex County Superior Court of Newburyport': buildCourthouse,
  'Powder House': buildPowderHouse,
  'Old Jail': buildOldJail,
  'Garrison Inn Boutique Hotel': buildGarrisonInn,
  'Institution For Savings': buildBank,
  'Institution for Savings': buildBank,
  // — Gloucester (docs/research/gloucester.md; OSM-name quirks kept verbatim) —
  'Hammond Castle Museum': (bk, b, g, i) => buildHammondCastle(bk, b, g, i),
  'Our Lady of Good Voyages Church': (bk, b, g, i) => buildGoodVoyage(bk, b, g, i),   // OSM's extra "s"
  'Gloucester City Hall': (bk, b, g, i) => buildGloucesterCityHall(bk, b, g, i),
  'Motif No. 1': (bk, b, g, i) => buildMotif(bk, b, g, i),
  'The Paint Factory': (bk, b, g, i) => buildPaintFactory(bk, b, g, i),
  'Beauport': (bk, b, g, i) => buildBeauport(bk, b, g, i),
  'Sargent House Museum': (bk, b, g, i) => gambrelHouse(bk, b, g, i, { wall: '#c1913f', material: 'clap', roof: '#7d766a', trim: '#f6f3ea', storeys: 2.5, dormers: 3, chimney: 'ridge2', entrance: 'pediment' }),   // ochre Georgian, two tall chimneys, weathered gambrel
  'Cape Ann Museum': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#8f9b8a', material: 'clap', trim: '#f6f3ea', roof: '#4a4e54', storeys: 3, roofKind: 'hip', entrance: 'fan', chimney: 'ends2' }),   // the sage-green Davis House
  'Eastern Point Light': (bk, b, g) => lightTower(bk, b, g, { h: 66, r: 7, body: '#f6f3ea', cap: '#a83226' }),        // white brick cone, RED cap
  'Ten Pound Island Light': (bk, b, g) => lightTower(bk, b, g, { h: 74, r: 6.4, body: '#f6f3ea' }),                   // white cast iron, black lantern; keeper's house is GONE
  'Annisquam Harbor Light': (bk, b, g) => lightTower(bk, b, g, { h: 86, r: 6.8, body: '#f6f3ea', taper: false }),     // white cylinder
  'Cape Ann Light (Twin Lights)': (bk, b, g) => lightTower(bk, b, g, { h: 230, r: 10, body: '#9a938a', cap: '#6fa08c' }),   // BOTH Thacher twins: unpainted granite, verdigris tops
  // — Rockport, in Gloucester's frame (docs/research/rockport-manchester.md) —
  'First United Church of Christ Congregational': (bk, b, g, i) => meetinghouse(bk, b, g, i, { clock: 'black', balustrade: true, belfry: 'round', cap: 'dome', capHex: '#6f9c88' }),   // "the Old Sloop", 1804: white, BLACK clock faces, round lantern under a green copper dome
  'First Universalist Church': (bk, b, g, i) => meetinghouse(bk, b, g, i, { clock: null, balustrade: false, belfry: 'square', cap: 'spire', capHex: '#3b4a44', towerH: 64 }),   // white Gothic Revival: pointed louvered belfry, dark green-trimmed spire
  'Rockport Art Association': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#f7f4ea', material: 'clap', trim: '#fdfbf2', roof: '#6b6660', storeys: 2.5, roofKind: 'gable', entrance: 'pediment', chimney: 'ends2', shutter: '#b0342c', door: '#b0342c' }),   // the 1787 Old Tavern: white clapboard, RED shutters + RED door
  'Rockport Public Library': rockportLibrary,
  'Rockport Carnegie Library': carnegieLibrary,
  'Shalin Liu Perfomance Center': shalinLiu,     // OSM's typo — keep verbatim or the hero never binds
  'Straitsmouth Island Light': (bk, b, g) => lightTower(bk, b, g, { h: 44, r: 6, body: '#f6f3ea' }),   // short white tower, black lantern
  // — Manchester-by-the-Sea, in Beverly's frame —
  'Manchester-by-the-Sea Town Hall': manchesterTownHall,
  'Manchester-By-The-Sea Public Library': manchesterLibrary,
  'First Parish Church (Manchester)': (bk, b, g, i) => meetinghouse(bk, b, g, i, { clock: 'gold', balustrade: true, belfry: 'octagon', cap: 'dome', capHex: '#6f9c88' }),   // 1809: white, GOLD clock face, octagonal columned belfry, green copper dome
  'Trask House Museum': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#f7f4ea', material: 'clap', trim: '#fdfbf2', roof: '#5e5a55', storeys: 2, roofKind: 'hip', balustrade: 'fret', entrance: 'fan', chimney: 'interior4', shutter: '#1b1c1e', door: '#1b1c1e' }),   // 1823 Federal: white, BLACK shutters, white roof balustrade
  // — Amesbury (docs/research/amesbury-salisbury.md) —
  'Amesbury City Hall': amesburyTownHall,          // OSM's name; the building's own sign says TOWN HALL
  'Bartlett Museum': bartlettMuseum,
  'Whittier Home': whittierHome,
  "Lowell's Boat Shop": lowellsBoatShop,
  'The Powder House': (bk, b, g) => amesburyPowderHouse(bk, b, g),
  'All Saints Anglican Cathedral': (bk, b, g, i) => salemChurch(bk, b, g, i, { stone: '#fdfaf6' }),   // red-brick Gothic: brickTex's own red + a crenellated tower is exactly this church
  'Old Amesbury Town Hall': (bk, b, g, i) => federalHouse(bk, b, g, i, { wall: '#f2ece0', material: 'clap', trim: '#fdfbf2', roof: '#5c5954', storeys: 2, roofKind: 'gable', entrance: 'pediment', chimney: 'ends2' }),   // massing + palette only — facade UNVERIFIED
  'Mary Baker Eddy House': maryBakerEddyHouse,
  // — Salisbury —
  'Salisbury Town Hall': salisburyTownHall,
  "Chubby's Diner": (bk, b, g, i) => dinerCar(bk, b, g, i, "Chubby's"),   // a real 1941 Jerry O'Mahony lunch car at 72 Main St
  'Rear Range Light': buildRearRange,
  'Front Range Light': buildFrontRange,
  'Newburyport Harbor (Plum Island) Light': buildPILight,
  'The Graf Rink': buildGrafRink,
  'U.S. Coast Guard Station': buildCGStation,
  'Coast Guard Boathouse': buildCGBoathouse,
  'Spencer-Peirce-Little Farmhouse': buildSPLFarm,
  'Plum Island Point Gazebo': buildGazebo,
  'Newburyport Fire Department': buildFireStation,
  'Newbury Fire Department': buildFireStation,
  'Newburyport Police Department': buildPolice,
  'Anna Jaques Hospital': buildHospital,
  'Brown School': buildBrownSchool,
  'Lower Green Schoolhouse': buildLGSchoolhouse
};


// ---------- seasonal dressing ----------

const BULBS = ['#ff4a38', '#ffd24a', '#4cc857', '#4d9aff', '#fff4d4'];
const HALLOWEEN_BULBS = ['#ff7518', '#ff9e2c', '#8a3fc0', '#a865d8'];   // pumpkin orange + purple

// alternating colored bulbs strung along the eave line (GLOW bucket = unlit)
function stringLights(bk: Bucket, ring: number[], y: number, palette: string[] = BULBS) {
  const v = ringToVec2(ring);
  let bi = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i], b2 = v[(i + 1) % v.length];
    const ex = b2.x - a.x, ey = b2.y - a.y;
    const len = Math.hypot(ex, ey);
    if (len < 14) continue;
    const ux = ex / len, uy = ey / len;
    const nx = ey / len, nz = ex / len;
    const n = Math.floor(len / 7);
    for (let k = 1; k < n; k++) {
      const wx = a.x + ux * (k * 7) + nx * 0.9;
      const wz = -(a.y + uy * (k * 7)) + nz * 0.9;
      tmp.set(palette[bi++ % palette.length]);
      bk.quad(
        wx - ux * 1.05, y - 1.05, wz + uy * 1.05, wx + ux * 1.05, y - 1.05, wz - uy * 1.05,
        wx + ux * 1.05, y + 1.05, wz - uy * 1.05, wx - ux * 1.05, y + 1.05, wz + uy * 1.05,
        nx, 0, nz, tmp.r, tmp.g, tmp.b
      );
    }
  }
}

// a cobweb tucked into a building's eave corner (Halloween, fall): pale thread
// spokes + two rings, in the GLOW bucket so the strands catch the light
function cobweb(bk: Bucket, vx: number, vz: number, ux: number, uz: number, wx: number, wz: number, y: number) {
  const R = 11;
  tmp.set('#dde0d8');
  const r = tmp.r, gg = tmp.g, b = tmp.b;
  const thread = (x0: number, z0: number, x1: number, z1: number, hw: number) => {
    let dx = x1 - x0, dz = z1 - z0; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const px = -dz * hw, pz = dx * hw;
    bk.quad(x0 + px, y, z0 + pz, x1 + px, y, z1 + pz, x1 - px, y, z1 - pz, x0 - px, y, z0 - pz, 0, 1, 0, r, gg, b);
  };
  const pts: [number, number][] = [];
  for (let k = 0; k <= 4; k++) {            // sample directions across the corner arc (u → w)
    const f = k / 4;
    let dx = ux + (wx - ux) * f, dz = uz + (wz - uz) * f; const L = Math.hypot(dx, dz) || 1;
    pts.push([vx + (dx / L) * R, vz + (dz / L) * R]);
  }
  for (const [ex, ez] of pts) thread(vx, vz, ex, ez, 0.45);          // radial spokes
  for (const rr of [0.45, 0.82]) {                                   // two concentric rings
    for (let k = 0; k < 4; k++) {
      const a = pts[k], c = pts[k + 1];
      thread(vx + (a[0] - vx) * rr, vz + (a[1] - vz) * rr, vx + (c[0] - vx) * rr, vz + (c[1] - vz) * rr, 0.34);
    }
  }
}

// a friendly draped-sheet ghost hovering in a front yard (Halloween, fall)
function ghost(buckets: Bucket[], f: { x: number; z: number; tx: number; tz: number; nx: number; nz: number }, g: number, seed: number) {
  const rng = mulberry32(hash32(seed, 67, 5));
  const off = (rng() < 0.5 ? -1 : 1) * (8 + rng() * 6);
  const px = f.x + f.tx * off + f.nx * (8 + rng() * 4);
  const pz = f.z + f.tz * off + f.nz * (8 + rng() * 4);
  const b = g + 2.5 + rng() * 2.5;                 // hovering off the ground
  const sheet = '#f1f1e8';
  tmp.set(sheet);
  octoCanopy(buckets[PLAIN], px, b + 12, pz, 4.4, tmp.clone());     // rounded head
  octoCanopy(buckets[PLAIN], px, b + 7, pz, 5.2, tmp.clone());      // draped body
  for (const sd of [-1, 0, 1]) {                                    // wavy hem
    octoCanopy(buckets[PLAIN], px + f.tx * sd * 3.6, b + 2.6, pz + f.tz * sd * 3.6, 2.5, tmp.clone());
  }
  tmp.set('#2a2622');                                               // two dark eyes facing the street
  for (const sd of [-1, 1]) {
    octoCanopy(buckets[PLAIN], px + f.tx * sd * 1.7 + f.nx * 3.7, b + 12, pz + f.tz * sd * 1.7 + f.nz * 3.7, 0.95, tmp.clone());
  }
}

// a round, squat, lightly-ribbed pumpkin body — replaces octoCanopy's pointy 4-sided diamond
// (which read as little pinecones) with a proper bulging sphere, flat-capped at top/bottom so
// the stem sits cleanly. Centered on (x,y,z); rests on the ground when y ≈ g + r*0.7.
function pumpkinBody(bk: Bucket, x: number, y: number, z: number, r: number, col: THREE.Color) {
  const N = 8, SQ = 0.82;                                  // 8 facets, a touch wider than tall
  const bands = [-0.86, -0.5, 0, 0.5, 0.86];               // latitudes (sin θ) — bulge in the middle
  const ring = (s: number): [number, number, number][] => {
    const rr = r * Math.sqrt(Math.max(0.0001, 1 - s * s)), yy = y + r * SQ * s;
    const p: [number, number, number][] = [];
    for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, rib = 1 - 0.08 * (i % 2); p.push([x + Math.cos(a) * rr * rib, yy, z + Math.sin(a) * rr * rib]); }
    return p;
  };
  const R = bands.map(ring);
  for (let b = 0; b < R.length - 1; b++) for (let i = 0; i < N; i++) {
    const j = (i + 1) % N, lo = R[b], hi = R[b + 1];
    const nx = (lo[i][0] + lo[j][0]) / 2 - x, nz = (lo[i][2] + lo[j][2]) / 2 - z, nl = Math.hypot(nx, nz) || 1;
    const sh = 0.8 + 0.2 * (i % 2 ? 1 : 0.55);
    bk.quad(lo[i][0], lo[i][1], lo[i][2], lo[j][0], lo[j][1], lo[j][2], hi[j][0], hi[j][1], hi[j][2], hi[i][0], hi[i][1], hi[i][2], nx / nl, 0.3, nz / nl, col.r * sh, col.g * sh, col.b * sh);
  }
  const hi = R[R.length - 1], lo = R[0], topY = y + r * SQ * 0.86, botY = y - r * SQ * 0.86;   // flat caps (no spike)
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    bk.triUV(x, topY, z, hi[i][0], hi[i][1], hi[i][2], hi[j][0], hi[j][1], hi[j][2], 0, 1, 0, col.r * 0.96, col.g * 0.96, col.b * 0.96, 0, 0, 0, 0, 0, 0);
    bk.triUV(x, botY, z, lo[j][0], lo[j][1], lo[j][2], lo[i][0], lo[i][1], lo[i][2], 0, -1, 0, col.r * 0.66, col.g * 0.66, col.b * 0.66, 0, 0, 0, 0, 0, 0);
  }
}

// pumpkins by the front door — some carved and glowing — plus pots of mums. Classic
// towns keep the original 4–7 patch density; haunted towns (the Halloween Capital)
// set out a tidy, well-spaced row of bigger, mostly-carved pumpkins.
function pumpkins(buckets: Bucket[], f: { x: number; z: number; tx: number; tz: number; nx: number; nz: number }, g: number, seed: number) {
  const rng = mulberry32(hash32(seed, 91, 7));
  const haunted = TOWN.halloween === 'haunted';
  const n = haunted ? 3 + (hash32(seed, 3, 11) % 3)   // 3–5: a tidy stoop cluster, not a pile
    : 4 + (hash32(seed, 3, 11) % 4);                  // 4–7: a real New England patch
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * (haunted ? 8.5 : 4.6) + (rng() - 0.5) * (haunted ? 2.4 : 2.2);   // spread across the front
    const px = f.x + f.tx * off + f.nx * ((haunted ? 8 : 5.2) + (rng() - 0.5) * (haunted ? 3 : 2.4));
    const pz = f.z + f.tz * off + f.nz * ((haunted ? 8 : 5.2) + (rng() - 0.5) * (haunted ? 3 : 2.4));
    const r = haunted ? 5 + rng() * 2.5 : 3.8 + rng() * 2.6;
    tmp.set(haunted ? (rng() < 0.82 ? '#f0801e' : '#df6a16')   // haunted: bright pumpkin orange only
      : (rng() < 0.85 ? '#d97a28' : '#e8e2cf'));
    pumpkinBody(buckets[PLAIN], px, g + r * 0.7, pz, r, tmp.clone());
    buckets[PLAIN].box(px, pz, r * 0.08, r * 0.08, g + r * 1.32, g + r * 1.32 + r * 0.3, '#6b5a2e');   // stubby green stem
    if (rng() < (haunted ? 0.82 : 0.55)) {
      // jack-o'-lantern: glowing triangular eyes + nose + a grin on the street-facing side,
      // all scaled to the pumpkin so a big one gets a big face.
      const cxf = px + f.nx * (r * 0.86), czf = pz + f.nz * (r * 0.86), ty = g + r * 0.74;
      tmp.set('#ffb43a');
      const tri = (ox: number, oy: number, hw: number, hh: number) => buckets[GLOW].triUV(
        cxf + f.tx * (ox - hw), ty + oy, czf + f.tz * (ox - hw),
        cxf + f.tx * (ox + hw), ty + oy, czf + f.tz * (ox + hw),
        cxf + f.tx * ox, ty + oy + hh, czf + f.tz * ox,
        f.nx, 0.1, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
      tri(-r * 0.34, r * 0.1, r * 0.16, r * 0.22);   // left eye ▲
      tri(r * 0.34, r * 0.1, r * 0.16, r * 0.22);    // right eye ▲
      tri(0, -r * 0.04, r * 0.09, r * 0.16);         // nose ▲
      buckets[GLOW].quad(                            // wide toothy grin
        cxf - f.tx * r * 0.42, ty - r * 0.42, czf - f.tz * r * 0.42,
        cxf + f.tx * r * 0.42, ty - r * 0.42, czf + f.tz * r * 0.42,
        cxf + f.tx * r * 0.32, ty - r * 0.24, czf + f.tz * r * 0.32,
        cxf - f.tx * r * 0.32, ty - r * 0.24, czf - f.tz * r * 0.32,
        f.nx, 0.1, f.nz, tmp.r, tmp.g, tmp.b);
    }
  }
  // pots of mums on the steps
  const mums = ['#c9742e', '#d4b23c', '#9c5bb8', '#c44d3a'];
  const m = hash32(seed, 77, 3) % 3;
  for (let i = 0; i < m; i++) {
    const off = (i === 0 ? -9.5 : 10.5) + (rng() - 0.5) * 2;
    const mx = f.x + f.tx * off + f.nx * 4.6, mz = f.z + f.tz * off + f.nz * 4.6;
    buckets[PLAIN].box(mx, mz, 1, 1, g, g + 1.4, '#7a4f38');
    tmp.set(mums[hash32(seed, i, 31) % mums.length]);
    octoCanopy(buckets[PLAIN], mx, g + 2.7, mz, 1.7, tmp.clone());
  }
}

// ---------- Halloween monsters (Salem's extreme fall): blocky, friendly-spooky figures —
// Frankenstein & Dracula loom in the yards, witches soar on brooms overhead. Glowing eyes. ----------
type Front = { x: number; z: number; tx: number; tz: number; nx: number; nz: number };

// Frankenstein's monster: flat-top green head, neck bolts, stiff arms reaching at the street.
function franken(buckets: Bucket[], f: Front, g: number, seed: number) {
  const rng = mulberry32(hash32(seed, 71, 9));
  const off = (rng() < 0.5 ? -1 : 1) * (9 + rng() * 7);
  const x = f.x + f.tx * off + f.nx * (9 + rng() * 5);
  const z = f.z + f.tz * off + f.nz * (9 + rng() * 5);
  const skin = '#6f8f3f', coat = '#2b2823';
  for (const s of [-1, 1]) buckets[PLAIN].box(x + f.tx * s * 2.4, z + f.tz * s * 2.4, 1.8, 1.8, g, g + 9, '#1b1916');   // legs
  buckets[PLAIN].box(x, z, 4.6, 3, g + 8, g + 20, coat);                                                                // torso
  for (const s of [-1, 1]) {                                                                                            // stiff arms reaching the street
    const ax = x + f.tx * s * 5.4, az = z + f.tz * s * 5.4;
    buckets[PLAIN].box(ax, az, 1.7, 1.7, g + 12, g + 19, coat);
    buckets[PLAIN].box(ax + f.nx * 4.5, az + f.nz * 4.5, 1.7, 1.7, g + 12, g + 13.6, skin);
  }
  buckets[PLAIN].box(x, z, 3.5, 3.1, g + 20, g + 28, skin);                                                             // flat-top green head
  buckets[PLAIN].box(x, z, 3.6, 3.2, g + 27.4, g + 29, '#15120e');                                                      // flat black hair
  for (const s of [-1, 1]) buckets[PLAIN].box(x + f.tx * s * 4.1, z + f.tz * s * 4.1, 0.85, 0.85, g + 21, g + 23.5, '#b7b7ad'); // neck bolts
  tmp.set('#ffd23c');
  for (const s of [-1, 1]) octoCanopy(buckets[GLOW], x + f.tx * s * 1.4 + f.nx * 3.1, g + 24, z + f.tz * s * 1.4 + f.nz * 3.1, 0.7, tmp.clone()); // glowing eyes
}

// Dracula: black suit + high-collared cape flaring behind, pale face, red eyes.
function dracula(buckets: Bucket[], f: Front, g: number, seed: number) {
  const rng = mulberry32(hash32(seed, 83, 11));
  const off = (rng() < 0.5 ? -1 : 1) * (9 + rng() * 7);
  const x = f.x + f.tx * off + f.nx * (9 + rng() * 5);
  const z = f.z + f.tz * off + f.nz * (9 + rng() * 5);
  const ang = Math.atan2(f.nz, f.nx);
  const blk = '#100e15', pale = '#e7ddc8';
  rotBox(buckets[PLAIN], x - f.nx * 2.6, z - f.nz * 2.6, 1, 6.4, g + 1, g + 22, ang, blk);                  // cape panel behind
  for (const s of [-1, 1]) buckets[PLAIN].box(x + f.tx * s * 2.2, z + f.tz * s * 2.2, 1.7, 1.7, g, g + 9, blk); // legs
  buckets[PLAIN].box(x, z, 4, 2.6, g + 8, g + 19, blk);                                                       // suit torso
  buckets[PLAIN].box(x + f.nx * 0.6, z + f.nz * 0.6, 0.9, 1, g + 12, g + 18, '#7a1420');                       // red sash down the front
  for (const s of [-1, 1]) rotBox(buckets[PLAIN], x + f.tx * s * 2.4 - f.nx * 1.4, z + f.tz * s * 2.4 - f.nz * 1.4, 0.6, 2.6, g + 18, g + 27, ang, blk); // high collar
  buckets[PLAIN].box(x, z, 2.7, 2.4, g + 19, g + 25, pale);                                                   // pale head
  buckets[PLAIN].box(x, z, 2.8, 2.5, g + 24.6, g + 26, '#15120f');                                            // slicked black hair
  tmp.set('#ff3b2e');
  for (const s of [-1, 1]) octoCanopy(buckets[GLOW], x + f.tx * s * 1.1 + f.nx * 2.5, g + 22.4, z + f.tz * s * 1.1 + f.nz * 2.5, 0.6, tmp.clone()); // red glowing eyes
}

// a witch soaring on a broomstick, high over the rooftops (Salem fall).
function witch(buckets: Bucket[], f: Front, g: number, seed: number) {
  const rng = mulberry32(hash32(seed, 97, 13));
  const a = rng() * Math.PI * 2;                 // flight heading
  const ca = Math.cos(a), sa = Math.sin(a);
  const px2 = Math.cos(a + Math.PI / 2), pz2 = Math.sin(a + Math.PI / 2);
  const x = f.x + (rng() - 0.5) * 34;
  const z = f.z + (rng() - 0.5) * 34;
  const y = g + 46 + rng() * 36;                 // soaring overhead
  const blk = '#16121d', skin = '#7aa84a';
  rotBox(buckets[PLAIN], x, z, 9, 0.55, y - 0.6, y + 0.6, a, '#7a4a1e');         // broom handle along the heading
  tmp.set('#c8a24a'); cone(buckets[PLAIN], x - ca * 9.5, y - 2, z - sa * 9.5, 1.8, 4.5, tmp.clone()); // straw bristles
  tmp.set(blk); cone(buckets[PLAIN], x, y - 2, z, 5, 7, tmp.clone());            // robe, flaring at the hem
  tmp.set(blk); octoCanopy(buckets[PLAIN], x, y + 4.5, z, 3.6, tmp.clone());     // hunched body
  tmp.set(skin); octoCanopy(buckets[PLAIN], x + ca * 1.2, y + 9, z + sa * 1.2, 2.4, tmp.clone()); // green head, leaning forward
  buckets[PLAIN].box(x + ca * 1.2, z + sa * 1.2, 4.2, 4.2, y + 10.3, y + 11, blk); // hat brim
  tmp.set(blk); cone(buckets[PLAIN], x + ca * 1.2, y + 11, z + sa * 1.2, 3, 9.5, tmp.clone()); // pointed hat
  tmp.set('#b9ff4a');
  for (const s of [-1, 1]) octoCanopy(buckets[GLOW], x + ca * 3 + px2 * s * 1.1, y + 9, z + sa * 3 + pz2 * s * 1.1, 0.5, tmp.clone()); // glowing eyes
}

// front-yard snowman, dressed for the season
function snowman(buckets: Bucket[], f: { x: number; z: number; tx: number; tz: number; nx: number; nz: number }, g: number, seed: number) {
  const rng = mulberry32(hash32(seed, 55, 13));
  const tOff = (10 + rng() * 9) * (rng() < 0.5 ? 1 : -1);
  const nOff = 9 + rng() * 8;
  const sx = f.x + f.tx * tOff + f.nx * nOff;
  const sz = f.z + f.tz * tOff + f.nz * nOff;
  tmp.set('#f4f6f8');
  octoCanopy(buckets[PLAIN], sx, g + 3.6, sz, 4.1, tmp.clone());
  octoCanopy(buckets[PLAIN], sx, g + 9.4, sz, 3.1, tmp.clone());
  octoCanopy(buckets[PLAIN], sx, g + 14.2, sz, 2.3, tmp.clone());
  // coal eyes + carrot, facing the street
  buckets[PLAIN].box(sx + f.nx * 2 - f.tx * 0.9, sz + f.nz * 2 - f.tz * 0.9, 0.35, 0.35, g + 14.7, g + 15.3, '#23241f');
  buckets[PLAIN].box(sx + f.nx * 2 + f.tx * 0.9, sz + f.nz * 2 + f.tz * 0.9, 0.35, 0.35, g + 14.7, g + 15.3, '#23241f');
  buckets[PLAIN].box(sx + f.nx * 2.5, sz + f.nz * 2.5, 0.4, 0.4, g + 13.6, g + 14.3, '#e07a28');
  // top hat + stick arms
  buckets[PLAIN].box(sx, sz, 2.3, 2.3, g + 16, g + 16.6, '#1d1f22');
  buckets[PLAIN].box(sx, sz, 1.5, 1.5, g + 16.6, g + 19.6, '#1d1f22');
  buckets[PLAIN].box(sx - f.tx * 4.6, sz - f.tz * 4.6, 2.6, 0.3, g + 9.8, g + 10.4, '#5e4630');
  buckets[PLAIN].box(sx + f.tx * 4.6, sz + f.tz * 4.6, 2.6, 0.3, g + 9.8, g + 10.4, '#5e4630');
}

// ---------- beach life (summer): umbrella camps, towels, beachgoers on the swimming
// beaches people travel to. Scaled against the 36px kid — a parasol you can stand
// under, a towel you could lie on — not real meters. ----------
const SKIN_TONES = ['#f0c8a0', '#e8b48c', '#d09a6a', '#a06a42', '#6f4527'];
const SWIMWEAR = ['#e0523f', '#3f7fc4', '#e8b53c', '#52a06b', '#c84a6b', '#7a52c4', '#ff8c42', '#2a9d8f'];
const TOWEL_HUES = ['#e06a5a', '#4a90c2', '#ecd06f', '#6cb087', '#d889a8', '#f2f2ee'];
const UMB_HUES = ['#d8543f', '#3f7fc4', '#e0b53c', '#52a06b', '#c84a6b'];
const HAIR_HUES = ['#2a2320', '#4a3520', '#7a5a30', '#c8a86a', '#8a8a8a'];

// a blocky beachgoer facing `ang`: standing, sitting, or lying flat (sunbathing)
function beachgoer(bk: Bucket, x: number, z: number, g: number, ang: number, rng: () => number,
                   pose: 'stand' | 'sit' | 'lie', kid = false) {
  const s = kid ? 0.66 : 1;
  const skin = pick(SKIN_TONES, Math.round(x * 3 + z));
  const suit = pick(SWIMWEAR, Math.round(x + z * 7));
  const hair = pick(HAIR_HUES, Math.round(x * 7 + z * 3));
  const onePiece = rng() < 0.45;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  if (pose === 'lie') {
    // sunbathing along ang: body flat, head at the +ang end, feet at the other
    rotBox(bk, x, z, 6.5 * s, 2.1 * s, g + 0.4, g + 2.6 * s, ang, onePiece ? suit : skin);
    rotBox(bk, x - ca * 2.5 * s, z - sa * 2.5 * s, 2.6 * s, 2.2 * s, g + 0.4, g + 2.8 * s, ang, suit);
    rotBox(bk, x + ca * 8.4 * s, z + sa * 8.4 * s, 1.9 * s, 1.9 * s, g + 0.4, g + 3 * s, ang, skin);   // head
    rotBox(bk, x - ca * 8.2 * s, z - sa * 8.2 * s, 1.4 * s, 1.6 * s, g + 0.4, g + 1.8 * s, ang, skin); // feet
    return;
  }
  if (pose === 'sit') {
    rotBox(bk, x + ca * 3 * s, z + sa * 3 * s, 2.8 * s, 1.5 * s, g + 0.3, g + 2 * s, ang, skin);       // legs out front
    rotBox(bk, x, z, 2.3 * s, 1.9 * s, g, g + 7.5 * s, ang, onePiece ? suit : skin);
    if (!onePiece) rotBox(bk, x, z, 2.4 * s, 2 * s, g, g + 3 * s, ang, suit);
    bk.box(x, z, 1.7 * s, 1.7 * s, g + 7.5 * s, g + 11.6 * s, skin);
    bk.box(x, z, 1.8 * s, 1.8 * s, g + 10.9 * s, g + 12.2 * s, hair);
    return;
  }
  // standing — legs, suit, chest, side arms, head; the odd sun hat
  for (const sd of [-1, 1]) bk.box(x - sa * sd * 1.3 * s, z + ca * sd * 1.3 * s, 0.9 * s, 0.9 * s, g, g + 10 * s, skin);
  rotBox(bk, x, z, 2.7 * s, 1.9 * s, g + 9.5 * s, g + 13.5 * s, ang, suit);
  rotBox(bk, x, z, 2.6 * s, 1.8 * s, g + 13.5 * s, g + 20 * s, ang, onePiece ? suit : skin);
  for (const sd of [-1, 1]) bk.box(x - sa * sd * 3.4 * s, z + ca * sd * 3.4 * s, 0.75 * s, 0.75 * s, g + 12 * s, g + 19.5 * s, skin);
  bk.box(x, z, 1.8 * s, 1.8 * s, g + 20 * s, g + 25.2 * s, skin);
  bk.box(x, z, 1.9 * s, 1.9 * s, g + 24.4 * s, g + 26 * s, hair);
  if (!kid && rng() < 0.3) {
    bk.box(x, z, 3.2 * s, 3.2 * s, g + 25.4 * s, g + 26.2 * s, '#e8d9a8');   // sun-hat brim
    bk.box(x, z, 1.9 * s, 1.9 * s, g + 26.2 * s, g + 27.6 * s, '#e8d9a8');
  }
}

// a little dog along for the beach day
function beachDog(bk: Bucket, x: number, z: number, g: number, ang: number) {
  const c = pick(['#c89058', '#6b4a2f', '#2e2a26', '#e8e2d4'], Math.round(x + z * 3));
  const ca = Math.cos(ang), sa = Math.sin(ang);
  rotBox(bk, x, z, 3, 1.4, g + 1.8, g + 4.6, ang, c);                                            // body
  rotBox(bk, x + ca * 3.6, z + sa * 3.6, 1.3, 1.2, g + 3.4, g + 6.2, ang, c);                    // head
  for (const s of [-1, 1]) {
    rotBox(bk, x + ca * 2 - sa * s * 1.1, z + sa * 2 + ca * s * 1.1, 0.45, 0.45, g, g + 2, ang, c);
    rotBox(bk, x - ca * 2 - sa * s * 1.1, z - sa * 2 + ca * s * 1.1, 0.45, 0.45, g, g + 2, ang, c);
  }
  rotBox(bk, x - ca * 3.5, z - sa * 3.5, 0.9, 0.3, g + 4.4, g + 6, ang, c);                      // tail up
}

// a kid-built sandcastle: packed base, drip towers, a square keep
function sandcastle(bk: Bucket, x: number, z: number, g: number, rng: () => number) {
  const wet = '#d9c48e';
  rotBox(bk, x, z, 3.4, 3.4, g, g + 1.6, rng() * Math.PI, wet);
  tmp.set(wet);
  cone(bk, x - 1.6, g + 1.6, z - 1.4, 1.5, 3.4, tmp.clone());
  cone(bk, x + 1.7, g + 1.6, z + 1.5, 1.2, 2.6, tmp.clone());
  bk.box(x + 1.4, z - 1.6, 0.8, 0.8, g + 1.6, g + 3.4, wet);
}

// one family's camp: parasol, towels with sunbathers, someone standing watch,
// the odd sandcastle / beach ball / cooler. `wet` keeps offset pieces (a towel
// flung 2m from the pole) from landing past the tide line.
function beachCamp(bk: Bucket, x: number, z: number, g: number, rng: () => number,
                   wet: (x: number, z: number) => boolean) {
  const hasUmb = rng() < 0.78;
  if (hasUmb) {
    bk.box(x, z, 0.5, 0.5, g, g + 25, '#ece8dc');
    tmp.set(pick(UMB_HUES, Math.round(x + z)));
    cone(bk, x, g + 23.5, z, 13, 9.5, tmp.clone());
  }
  const towels = 1 + Math.floor(rng() * 2);
  for (let i = 0; i < towels; i++) {
    const ta = rng() * Math.PI * 2;
    const td = hasUmb ? 9 + rng() * 8 : rng() * 6;
    const tx = x + Math.cos(ta) * td, tz = z + Math.sin(ta) * td;
    const tang = rng() * Math.PI * 2;
    const w = rng();                       // drawn before the wet-skip so camps stay put
    if (wet(tx, tz)) continue;
    flatQuad(bk, tx, tz, 14, 6, g + 0.45, tang, pick(TOWEL_HUES, Math.round(tx * 3 + tz)));
    if (w < 0.45) beachgoer(bk, tx, tz, g, tang, rng, 'lie');
    else if (w < 0.75) beachgoer(bk, tx, tz, g, tang + Math.PI / 2, rng, 'sit');
  }
  if (rng() < 0.55) {
    const px2 = x + (rng() - 0.5) * 22, pz2 = z + (rng() - 0.5) * 22;
    if (!wet(px2, pz2)) beachgoer(bk, px2, pz2, g, rng() * Math.PI * 2, rng, 'stand', rng() < 0.4);
  }
  if (rng() < 0.3) {
    const sx = x + (rng() - 0.5) * 26, sz = z + (rng() - 0.5) * 26;
    if (!wet(sx, sz)) sandcastle(bk, sx, sz, g, rng);
  }
  if (rng() < 0.3) {
    tmp.set(pick(['#e0523f', '#3f7fc4', '#e8b53c', '#f2f2ee'], Math.round(x * 5 + z)));
    octoCanopy(bk, x + (rng() - 0.5) * 20, g + 1.6, z + (rng() - 0.5) * 20, 1.8, tmp.clone());   // beach ball
  }
  if (rng() < 0.35) {
    const cx2 = x + (rng() - 0.5) * 14, cz2 = z + (rng() - 0.5) * 14;
    const cang = rng() * Math.PI;
    rotBox(bk, cx2, cz2, 2.4, 1.6, g, g + 2.6, cang, pick(['#d8543f', '#3f7fc4', '#4a4f55'], Math.round(cx2)));
    rotBox(bk, cx2, cz2, 2.5, 1.7, g + 2.6, g + 3.2, cang, '#f0f0ec');                            // cooler lid
  }
}

// ---------- the Greasy Pole (Gloucester, St. Peter's Fiesta) ----------
// The real platform is mapped in OSM ~110 m off Pavilion Beach; the walkable
// gangway/pole strips live in world data (towns/gloucester/map.mjs — geometry
// constants dual-maintained with manualFeatures there). This draws everything:
// gangway on pilings, the flag-dressed platform, and the greased pole with the
// red fiesta flag at the tip.
function buildGreasyPole(buckets: Bucket[], poly: Poly) {
  const bk = buckets[PLAIN], pk = buckets[PLANK];
  const [cx, cz] = centroidOf(poly.p);
  const v = { x: 0.4565, y: -0.8896 };   // platform → beach (inland, unit)
  const t = { x: 0.8896, y: 0.4565 };    // shore tangent (unit)
  const at = (a: number, b: number) => ({ x: cx + v.x * a + t.x * b, y: cz + v.y * a + t.y * b });
  const angV = Math.atan2(v.y, v.x);
  const deck = PIER_DECK_Y + 1.5;        // walk height (deckHeightAt piers = 5.5)
  // platform: plank box on the mapped footprint + corner piles carrying the rails
  walls(pk, poly.p, 0, deck, '#9a7a4e', 0);
  flatRoofPlank(pk, poly.p, deck);
  for (const sa of [-1, 1]) for (const sb of [-1, 1]) {
    const p = at(sa * 16, sb * 16);
    bk.box(p.x, p.y, 1.1, 1.1, -3, deck + 4.5, '#5e4a30');
  }
  // side rails + Italian tricolore bunting (fiesta dress) on the two shore-tangent sides
  for (const sb of [-1, 1]) {
    const m = at(0, sb * 16);
    rotBox(bk, m.x, m.y, 15, 0.45, deck + 3.4, deck + 4.3, angV, '#5e4a30');
    const flags = ['#009246', '#f4f5f0', '#ce2b37'];
    for (let i = 0; i < 3; i++) {
      const f = at((i - 1) * 9, sb * 16.4);
      rotBox(bk, f.x, f.y, 3.4, 0.18, deck + 0.6, deck + 3.4, angV, flags[i]);
    }
  }
  // gangway: long plank run shore → platform, pilings every ~80 px, low curbs
  const g0 = 12, g1 = 1005;
  const gc = at((g0 + g1) / 2, 0);
  rotBox(bk, gc.x, gc.y, (g1 - g0) / 2, 5.5, deck - 0.9, deck, angV, '#a2825a');
  for (const sb of [-1, 1]) rotBox(bk, gc.x + t.x * sb * 5, gc.y + t.y * sb * 5, (g1 - g0) / 2, 0.5, deck, deck + 0.8, angV, '#7a5f3c');
  for (let a = g0 + 30; a < g1; a += 80) {
    for (const sb of [-1, 1]) {
      const p = at(a, sb * 4.2);
      bk.box(p.x, p.y, 0.9, 0.9, -2.5, deck - 0.5, '#5e4a30');
    }
  }
  // the pole itself: a greased spar cantilevered seaward off the platform edge,
  // the red fiesta flag nailed at the tip
  const pc = at(-72, 0);
  rotBox(bk, pc.x, pc.y, 46, 1.3, deck - 1.2, deck + 0.4, angV, '#c9a86b');
  const tip = at(-118, 0);
  bk.box(tip.x, tip.y, 0.4, 0.4, deck + 0.4, deck + 9, '#8a6a3c');            // flag staff at the tip
  tmp.set('#ce2b37');
  const f0 = at(-118, 0.4), f1 = at(-118, 8.4);
  bk.quad(f0.x, deck + 8.6, f0.y, f1.x, deck + 8.6, f1.y, f1.x, deck + 4.6, f1.y, f0.x, deck + 4.6, f0.y,
    v.x, 0, v.y, tmp.r, tmp.g, tmp.b);                                        // the red flag — grab it!
}

// a park bench: slatted wood seat + back on cast-iron end frames. `ang` is the
// bench's long axis; the backrest sits on the +perp(ang) side and the sitter
// faces the opposite way.
function bench(bk: Bucket, x: number, z: number, ang: number, g: number) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const wood = '#7a5230', iron = '#3a3d40';
  for (const o of [-7, 7]) rotBox(bk, x + ca * o, z + sa * o, 0.9, 4.2, g, g + 4.2, ang, iron); // end frames
  rotBox(bk, x, z, 9.5, 4.4, g + 4.2, g + 5.1, ang, wood);                                       // seat
  rotBox(bk, x - sa * 3.3, z + ca * 3.3, 9.5, 0.8, g + 5.1, g + 10.8, ang, wood);                // backrest
}

// Place benches like a city planner: line them along the park/plaza edges, set
// back from the boundary, squared up parallel to each edge with the back to the
// outside and the seat facing the open space. Never in the street, never
// scattered through the middle. One per short edge, two along a long one.
function placeBenches(P: Bucket, poly: Poly, index: WorldIndex,
                      roads: { p: number[]; w: number }[], ox: number, oy: number, maxB: number) {
  const pts = poly.p;
  const [cx, cz] = centroidOf(pts);
  const n = pts.length / 2;
  const SETBACK = 16, ENDMARGIN = 38;
  let placed = 0;
  const onRoad = (x: number, z: number) => {
    for (const r of roads) if (distToPolylineSq(x, z, r.p) < (r.w / 2 + 14) ** 2) return true;
    return false;
  };
  for (let i = 0; i < n && placed < maxB; i++) {
    const ax = pts[i * 2], az = pts[i * 2 + 1];
    const bx = pts[((i + 1) % n) * 2], bz = pts[((i + 1) % n) * 2 + 1];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz);
    if (len < ENDMARGIN * 2 + 24) continue;            // edge too short to seat a bench
    const ux = dx / len, uz = dz / len;
    const midx = (ax + bx) / 2, midz = (az + bz) / 2;
    let nx = -uz, nz = ux;                              // inward normal (toward centroid)
    if (nx * (cx - midx) + nz * (cz - midz) < 0) { nx = -nx; nz = -nz; }
    let ang = Math.atan2(uz, ux);                       // long axis parallel to the edge
    if ((-uz) * nx + ux * nz > 0) ang += Math.PI;       // flip so the back faces outward
    const slots = len > 300 ? [0.34, 0.66] : [0.5];     // one bench, or two on a long edge
    for (const f of slots) {
      if (placed >= maxB) break;
      const t = len * f;
      const px = ax + ux * t + nx * SETBACK, pz = az + uz * t + nz * SETBACK;
      if (px < ox || px >= ox + CHUNK || pz < oy || pz >= oy + CHUNK) continue;  // this chunk owns it
      if (!pointInPolyD(px, pz, poly)) continue;        // stay inside the grounds
      if (onRoad(px, pz)) continue;                     // never in the street
      bench(P, px, pz, ang, index.heightAtPx(px, pz));
      placed++;
    }
  }
}

// a little beach crab: domed shell + two front claws, kept tiny
function crab(bk: Bucket, x: number, z: number, ang: number, g: number) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  octoCanopy(bk, x, g + 0.9, z, 1.9, new THREE.Color('#c2502f'));
  for (const s of [-1, 1]) {
    const clx = x + ca * 1.9 - sa * 1.5 * s, clz = z + sa * 1.9 + ca * 1.5 * s;
    bk.box(clx, clz, 0.7, 0.7, g + 0.1, g + 1.1, '#d8623a');
  }
}

// sparse woodland critter: a squirrel (bushy tail) or a rabbit (tall ears)
function critter(bk: Bucket, x: number, z: number, ang: number, g: number, squirrel: boolean) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const hex = squirrel ? '#8a5a32' : '#9a9188';
  const fur = new THREE.Color(hex);
  octoCanopy(bk, x, g + 2.6, z, 2.7, fur);                                              // body
  octoCanopy(bk, x + ca * 2.9, g + 3.9, z + sa * 2.9, 1.7, fur.clone().multiplyScalar(1.05)); // head
  if (squirrel) {
    octoCanopy(bk, x - ca * 3.3, g + 4.9, z - sa * 3.3, 2.3, fur.clone().multiplyScalar(0.9)); // bushy tail
  } else {
    for (const s of [-0.85, 0.85]) bk.box(x + ca * 2.1 - sa * s, z + sa * 2.1 + ca * s, 0.5, 0.5, g + 4.6, g + 8.2, hex); // tall ears
  }
}

// one MBTA commuter-rail car: stainless coach, or the purple locomotive
function railCar(bk: Bucket, cx: number, cz: number, ang: number, g: number, loco: boolean) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  for (const o of [-30, 30]) rotBox(bk, cx + ca * o, cz + sa * o, 9, 6.5, g, g + 4.5, ang, '#26282b'); // trucks
  chamferBox(bk, cx, cz, 42, 11, g + 4.5, g + 25, ang, loco ? '#73277f' : '#c7ccd1', 3.2);             // carbody
  chamferBox(bk, cx, cz, 41.5, 11.4, g + 12, g + 14.6, ang, loco ? '#d7d2c6' : '#73277f', 1.2);        // accent stripe
  if (loco) {
    chamferBox(bk, cx + ca * 27, cz + sa * 27, 10, 10.4, g + 17, g + 24, ang, '#16212c', 1.4);         // windscreen
    chamferBox(bk, cx - ca * 6, cz - sa * 6, 30, 9.4, g + 25, g + 28, ang, '#5a1f63', 2.6);            // roof radiator
  } else {
    chamferBox(bk, cx, cz, 37, 11.4, g + 15.5, g + 21.5, ang, '#15202b', 1.4);                         // window band
    chamferBox(bk, cx, cz, 42, 9.6, g + 25, g + 27.4, ang, '#9aa0a6', 3);                              // roof
  }
}

// the commuter-rail train standing at the station: loco + a few coaches,
// laid along the rail's true heading
function mbtaTrain(buckets: Bucket[], x: number, z: number, ang: number, index: WorldIndex) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const cars = [true, false, false, false];
  for (let i = 0; i < cars.length; i++) {
    const cx = x - ca * i * 96, cz = z - sa * i * 96;
    railCar(buckets[PLAIN], cx, cz, ang, index.heightAtPx(cx, cz) + 1.2, cars[i]);
  }
}

// homes the OSM data names a real architecture style for (building:architecture)
// get that style instead of the generic gabled house: Newburyport's Federal brick
// mansions, the odd Georgian, a Queen Anne painted lady.
function styledHouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  let gLo = Infinity;
  for (let i = 0; i < b.p.length; i += 2) gLo = Math.min(gLo, index.heightAtPx(b.p[i], b.p[i + 1]));
  const base = gLo - 8;
  const { eave, lvEff } = buildingDims(b, ringAreaM2(b.p));
  const eaveAbs = g + eave;
  const seed = Math.round(Math.abs(obb.cx) * 7 + Math.abs(obb.cz)) | 0;
  const rows = Math.max(2, Math.round(lvEff));
  // paired chimneys at the gable ends
  const endChimneys = (frac: number, hex: string, top: number) => {
    for (const e of [-1, 1]) buckets[BRICK].box(obb.cx + e * obb.hl * frac * ca, obb.cz + e * obb.hl * frac * sa, 2.4, 2.4, eaveAbs + 1, top, hex);
  };

  if (b.style === 'queen_anne') {
    const body = pick(['#7c8b6e', '#b0895a', '#9a6b72', '#6e7e8c'], seed); // a painted lady
    walls(buckets[CLAP], b.p, base, eaveAbs, body);
    complexGable(buckets[SHINGLE], buckets[CLAP], b.p, eaveAbs, '#46403a', body);
    facades(buckets[PLAIN], b.p, eaveAbs, Math.max(2, rows), seed, true, true, false, g, undefined, '#7a2e2e');
    // a corner turret with a conical roof — the Queen Anne signature
    const cx = obb.cx + obb.hl * 0.82 * ca - obb.hw * 0.68 * sa;
    const cz = obb.cz + obb.hl * 0.82 * sa + obb.hw * 0.68 * ca;
    const tr = Math.max(4, Math.min(7, obb.hw * 0.42));
    walls(buckets[CLAP], octRing(cx, cz, tr), base, eaveAbs + 9, body);
    cone(buckets[SHINGLE], cx, eaveAbs + 9, cz, tr * 1.2, tr * 2.6, new THREE.Color('#46403a'));
    endChimneys(0.72, '#8c5240', eaveAbs + 12);
    return;
  }

  const federal = b.style === 'federal';
  const wallHex = federal ? pick(['#9c5d49', '#a86a52', '#8c5440'], seed) : pick(['#e6e0d0', '#dcd6c4', '#ccd2cd'], seed);
  walls(federal ? buckets[BRICK] : buckets[CLAP], b.p, base, eaveAbs, wallHex);
  facades(buckets[PLAIN], b.p, eaveAbs, rows, seed, true, true, false, g, undefined, federal ? '#3a4658' : '#7a3a2e');
  if (federal) {
    // a low flat roof behind a white cornice + parapet, paired end chimneys
    flatRoof(buckets[PLAIN], b.p, eaveAbs + 0.8, '#6b6f74');
    walls(buckets[PLAIN], b.p, eaveAbs, eaveAbs + 4, '#fdfcf8');
    endChimneys(0.82, wallHex, eaveAbs + 9);
  } else {
    // georgian: a formal medium side-gable + paired brick end chimneys
    complexGable(buckets[SHINGLE], buckets[CLAP], b.p, eaveAbs, '#5a5048', wallHex);
    endChimneys(0.8, '#8c5240', eaveAbs + 13);
  }
}

export function buildChunkDecor(world: WorldData, index: WorldIndex, key: string): THREE.Mesh | null {
  const buckets = [new Bucket(), new Bucket(), new Bucket(), new Bucket(), new Bucket(), new Bucket()];
  const [ckx, cky] = key.split(',').map(Number);
  const ox = ckx * CHUNK, oy = cky * CHUNK;

  for (const { idx, b } of index.buildingsOwned(key)) {
    // ground: building sits at the highest footprint corner; walls bury into the slope
    let gHi = -Infinity, gLo = Infinity;
    for (let i = 0; i < b.p.length; i += 2) {
      const h = index.heightAtPx(b.p[i], b.p[i + 1]);
      if (h > gHi) gHi = h;
      if (h < gLo) gLo = h;
    }
    const g = gHi;
    const base = gLo - 8;

    // named heroes win over the generic light treatment (the three real
    // lighthouses are all named and hand-built)
    const hero = b.n && HEROES[b.n];
    if (hero) {
      hero(buckets, b, g, index);
      continue;
    }
    if (b.k === 'light') {
      const [cx, cz] = centroidOf(b.p);
      lighthouse(buckets[PLAIN], cx, cz, g);
      continue;
    }
    if (b.k === 'wtower' || b.k === 'tank') {
      buildTank(buckets, b, g);
      continue;
    }
    if (b.k === 'tower') {
      buildTower(buckets, b, g);
      continue;
    }
    if (b.k === 'gazebo') {
      buildGazebo(buckets, b, g);
      continue;
    }
    // a home the map names an architecture style for — render it in that style
    if (b.style) {
      styledHouse(buckets, b, g, index);
      continue;
    }
    const seed = idx;
    const rng = mulberry32(hash32(seed, 5, 11));
    const areaM2 = ringAreaM2(b.p);
    const { eave, lvEff } = buildingDims(b, areaM2);
    const eaveAbs = g + eave;
    const [bcx, bcz] = centroidOf(b.p);
    const beach = bcx > BEACH_X && (b.k === 'house' || b.k === 'shed');
    // Plum Island is a colorful mix like the rest of town — mostly painted clapboard
    // in the full house palette, with a minority of weathered/stained cedar-shake
    // cottages (it used to be all brown shake)
    const beachShake = beach && hash32(seed, 67, 5) % 100 < 38;
    // weathered-shingle village districts (Rockport, Manchester): the fishing
    // villages inside a flagship town's frame are gray cedar shingle first,
    // painted clapboard second — see TOWN.shingleZones
    const villageShake = !beach && (b.k === 'house' || b.k === 'shed') && SHINGLE_ZONES.some(
      (z) => (bcx - z.x) ** 2 + (bcz - z.z) ** 2 < z.r * z.r && hash32(seed, 71, 13) % 100 < (z.p ?? 0.7) * 100);
    // 13 Fox Run Drive — a navy house with a red door (a hello to its owner)
    const isFoxRun = b.k === 'house' && Math.abs(bcx + 18750) < 9 && Math.abs(bcz - 2774) < 9;
    const wallHex = isFoxRun ? '#2a3a57'
      : beachShake || villageShake ? pick(STYLE.building.wallsShake, seed)
      : beach ? pick(STYLE.building.wallsHouse, seed)
      : wallHexFor(b, seed);
    const isBrick = b.k === 'commercial' || b.k === 'civic';
    const wallBucket = isBrick ? buckets[BRICK]
      : b.k === 'industrial' ? buckets[PLAIN]
      : beachShake || villageShake ? buckets[SHINGLE]   // weathered cedar-shake cottages + shingled villages
      : buckets[CLAP];                       // painted clapboard — most of the island, like town
    walls(wallBucket, b.p, base, eaveAbs, wallHex);

    const obb = obbOf(b.p);
    const fill = ringAreaPx2(b.p) / Math.max(1, 4 * obb.hl * obb.hw);   // 1 = a clean rectangle
    // Real houses don't span a city block. A handful of footprints are big structures (a
    // supermarket, rink, mill) left as untagged building=yes → 'house'; a single pitched
    // roof over their bounding box becomes an enormous slab jutting past the walls. Above
    // a house-plausible size, fall through to the flat branch (which clips to the exact
    // footprint). Churches are exempt — they need this branch for their steeple.
    const pitchable = b.k === 'church' || (areaM2 < 2000 && obb.hw < 200);
    const gabled = (b.k === 'house' || b.k === 'shed' || b.k === 'church') && pitchable;
    if (gabled) {
      const ridgeH = Math.max(7, Math.min(22, obb.hw * 0.55));
      const roofHex = pick(STYLE.building.roofs, seed);
      // simple rectangular houses get hip/pyramid/mansard variety to break the all-gabled
      // monotony; L/T-shaped (and any not-near-rectangular) houses keep the footprint-clipped
      // gable. The OBB hip/mansard cover the bounding box, so on a footprint that doesn't fill
      // it they'd jut past the walls — only use them when the footprint IS the rectangle
      // (fill ≥ 0.9), and with a tight eave (ov 2 ≈ 0.25 m).
      const roofShape = b.k === 'house' && fill >= 0.9 ? pickHouseRoof(obb, seed) : 'gable';
      if (roofShape === 'mansard') mansardRoof(buckets[SHINGLE], buckets[PLAIN], obb, eaveAbs, 2, roofHex);
      else if (roofShape !== 'gable') hipRoof(buckets[SHINGLE], obb, eaveAbs, ridgeH, 2, roofHex, roofShape === 'pyramid');
      else complexGable(buckets[SHINGLE], beachShake || villageShake ? buckets[SHINGLE] : buckets[CLAP], b.p, eaveAbs, roofHex, wallHex, 0, b.k !== 'shed');
      if (b.k === 'house') {
        houseTrim(buckets[PLAIN], b.p, eaveAbs, base);
        if (rng() < 0.7 && obb.hl > 18) {
          const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
          const along = (rng() - 0.5) * obb.hl * 0.8;
          buckets[BRICK].box(obb.cx + along * ca, obb.cz + along * sa, 3.2, 3.2, eaveAbs + ridgeH - 4, eaveAbs + ridgeH + 7, '#fdfcf8', 1);
        }
      }
      if (b.k === 'church') {
        // every church gets a real square-tower steeple at its street end
        steeple(buckets, b, g, index, false);
      }
    } else if ((b.k === 'civic' || (b.k === 'commercial' && areaM2 < 240)) && fill >= 0.74 && areaM2 < 1100) {
      // town halls / libraries / small civic + small standalone shops read better pitched
      // than as flat boxes; big civic (schools) + downtown commercial blocks stay flat below.
      const roofHex2 = pick(STYLE.building.roofs, seed);
      if (b.k === 'civic' && hash32(seed, 31, 7) % 100 < 38) {
        mansardRoof(buckets[SHINGLE], buckets[PLAIN], obb, eaveAbs, 4, roofHex2);
      } else {
        const ridgeC = Math.max(8, Math.min(20, obb.hw * 0.4));
        hipRoof(buckets[SHINGLE], obb, eaveAbs, ridgeC, 4, roofHex2, obb.hl / Math.max(1, obb.hw) < 1.3);
      }
    } else {
      flatRoof(buckets[PLAIN], b.p, eaveAbs, pick(STYLE.building.roofsCommercial, seed));
      walls(wallBucket, b.p, eaveAbs, eaveAbs + 3.5, wallHex);
      if (isBrick) {
        // white Federal cornice below the parapet
        tmp.set(STYLE.building.trim);
        const v = ringToVec2(b.p);
        for (let i = 0; i < v.length; i++) {
          const a = v[i], bb = v[(i + 1) % v.length];
          const ex = bb.x - a.x, ey = bb.y - a.y;
          const len = Math.hypot(ex, ey);
          if (len < 0.01) continue;
          const nx = ey / len, nz = ex / len;
          buckets[PLAIN].quad(
            a.x + nx * 0.5, eaveAbs - 3, -a.y, bb.x + nx * 0.5, eaveAbs - 3, -bb.y,
            bb.x + nx * 0.5, eaveAbs, -bb.y, a.x + nx * 0.5, eaveAbs, -a.y,
            nx, 0, nz, tmp.r, tmp.g, tmp.b
          );
        }
      }
      if (b.k !== 'shed') roofClutter(buckets, b.p, eaveAbs, seed, areaM2, isBrick);
    }

    if (b.k !== 'shed') {
      const storefront = b.k === 'commercial' || !!b.sf;
      // one window row per storey — no cap, so tall blocks get glass all the way up
      const rows = b.k === 'house' ? (lvEff >= 2 ? Math.round(lvEff) : 1) : Math.max(2, Math.round(lvEff));
      facades(buckets[PLAIN], b.p, eaveAbs, rows, seed,
        b.k === 'house' || b.k === 'commercial' || storefront,
        b.k === 'house' && !beachShake && !storefront && rng() < 0.75,
        storefront, g, undefined, isFoxRun ? '#ab3228' : undefined);
    }

    // seasonal dressing: Christmas lights on the eaves, pumpkins by the door
    if (SEASON === 'winter' && b.k !== 'shed') {
      const festive = b.k === 'commercial' || b.k === 'civic' || !!b.sf || hash32(seed, 19, 3) % 100 < 70;
      if (festive) stringLights(buckets[GLOW], b.p, eaveAbs - 1.5);
      if (b.k === 'house' && hash32(seed, 41, 9) % 100 < 8) {
        snowman(buckets, frontSegment(b, index), g, seed);
      }
    } else if (SEASON === 'fall' && b.k !== 'shed') {
      // Halloween dressing, scaled to the town's temperament: 'haunted' towns (Salem,
      // the Halloween Capital of the World) deck nearly EVERYTHING out — lights,
      // pumpkins on every stoop, ghosts, monsters, cobwebs on homes too — while
      // 'classic' towns keep the original tasteful New England October.
      const haunted = TOWN.halloween === 'haunted';
      // Halloween eave lights (orange + purple) on the shops and many homes
      const festive = b.k === 'commercial' || b.k === 'civic' || !!b.sf || hash32(seed, 19, 3) % 100 < (haunted ? 92 : 55);
      if (festive) stringLights(buckets[GLOW], b.p, eaveAbs - 1.5, HALLOWEEN_BULBS);
      const porch = b.k === 'house' ? hash32(seed, 23, 5) % 100 < (haunted ? 100 : 88)
        : (b.k === 'commercial' || !!b.sf) && hash32(seed, 23, 5) % 100 < (haunted ? 90 : 65);
      if (porch) pumpkins(buckets, frontSegment(b, index), g, seed);
      // a friendly ghost haunting some front yards (a good chunk of them when haunted)
      if (b.k === 'house' && hash32(seed, 53, 7) % 100 < (haunted ? 38 : 15)) ghost(buckets, frontSegment(b, index), g, seed);
      if (haunted) {
        // monsters loom in the yards (Frankenstein, Dracula) and witches soar overhead —
        // the Halloween Capital goes all out. Independent rolls, so a yard can stack several.
        if (b.k === 'house' && hash32(seed, 61, 7) % 100 < 16) franken(buckets, frontSegment(b, index), g, seed);
        if (b.k === 'house' && hash32(seed, 73, 7) % 100 < 16) dracula(buckets, frontSegment(b, index), g, seed);
        if (hash32(seed, 89, 7) % 100 < 9) witch(buckets, frontSegment(b, index), g, seed);   // flying — over any building
      }
      // cobwebs in the eave corners of the shops (haunted: on homes too, a few each)
      if (haunted || b.k === 'commercial' || b.sf) {
        const ring = b.p, np = ring.length / 2;
        let webs = 0;
        for (let i = 0; i < np && webs < (haunted ? 3 : 2); i++) {
          if (hash32(seed, i, 29) % 100 > (haunted ? 50 : 32)) continue;
          const vx = ring[i * 2], vz = ring[i * 2 + 1];
          const pi = ((i - 1 + np) % np) * 2, ni = ((i + 1) % np) * 2;
          let ux = ring[pi] - vx, uz = ring[pi + 1] - vz; const lu = Math.hypot(ux, uz) || 1;
          let wx = ring[ni] - vx, wz = ring[ni + 1] - vz; const lw = Math.hypot(wx, wz) || 1;
          if (lu < 14 || lw < 14) continue;                 // skip tiny/noisy edges
          cobweb(buckets[GLOW], vx, vz, ux / lu, uz / lu, wx / lw, wz / lw, eaveAbs - 1.3);
          webs++;
        }
      }
    }
  }

  const bucket = index.bucket(key);
  // one deck per bridge CHAIN (maximal run of compatible ways) — a multi-way
  // bridge used to end each way with caps + rail stubs at every seam; the chain
  // ends only at real junctions or banks (docs/BRIDGE-ROADS-REDESIGN.md)
  for (const ch of index.roadChains().bridge) {
    const pad = ch.w / 2 + 8;
    if (ch.bb[2] < ox - pad || ch.bb[0] > ox + CHUNK + pad || ch.bb[3] < oy - pad || ch.bb[1] > oy + CHUNK + pad) continue;
    // paved deck following the clearance profile — humps over roads it crosses
    // and lifts clear of any water it spans (the Gillis channel is left open for
    // the custom drawbridge). trim0/trim1 pull a ramp deck back to the deck it
    // merges into, so its end never slices across the other span's surface.
    ribbonDeck(buckets, ch.pts, ch.w + 4, (x, z) => index.bridgeDeckYAt(ch.pts, x, z), true, ox, oy, true, ch.trim0, ch.trim1,
      (ch.c === 'motorway' || ch.c === 'motorway_link') ? 'white' : 'yellow', ch.w0 + 4, ch.w1 + 4);
    // hold the slab up: pier WALLS marching the span (turned across the deck, capped
    // under the soffit) + full-width abutments at the banks. One (x,z) each + the
    // chunk cull below ⇒ emitted in exactly one chunk.
    const sup = index.bridgeProfile(ch.pts).supports;
    const hw = (ch.w + 4) / 2;
    for (const p of sup.piers) {
      if (p.x < ox || p.x >= ox + CHUNK || p.z < oy || p.z >= oy + CHUNK) continue;
      if (inGillisRect(p.x, p.z)) continue; // the bascule fills the channel itself
      orientedPost(buckets[PLAIN], p.x, p.z, p.ux, p.uz, 5, hw * 0.62, p.footY, p.topY, '#70737a');       // pier wall
      orientedPost(buckets[PLAIN], p.x, p.z, p.ux, p.uz, 8, hw * 0.66, p.topY - 4, p.topY + 1, '#7c7f85'); // cap beam
    }
    for (const a of sup.abut) {
      if (a.x < ox || a.x >= ox + CHUNK || a.z < oy || a.z >= oy + CHUNK) continue;
      orientedPost(buckets[PLAIN], a.x, a.z, a.ux, a.uz, 15, hw * 0.95, a.footY, a.topY, '#666970');
    }
  }
  for (const pi of bucket.paths) {
    const p = world.paths[pi];
    if (p.c === 'board') {
      // the waterfront boardwalk: stained planks, pilings, water-side railings
      boardwalk(buckets, p.p, Math.max(p.w, 22), PIER_DECK_Y, ox, oy, index);
    } else if (p.c === 'pierline' || (p.b && (p.c === 'foot' || p.c === 'cycle' || p.c === 'track' || p.c === 'ped'))) {
      // foot / cycle / rail-trail bridges + bare docks: wooden planks, low — NOT
      // paved roads (only actual road bridges get asphalt + a centre line + a lift)
      ribbonDeck(buckets, p.p, Math.max(p.w, 16), PIER_DECK_Y, false, ox, oy);
    }
  }

  // downtown curb life: parked cars along the shopping streets
  const shopsHere = index.buildingsOwned(key).filter(({ b }) => b.sf || b.k === 'commercial').length;
  if (shopsHere >= 2) {
    const seenR = new Set<number>();
    for (const ri of bucket.roads) {
      if (seenR.has(ri)) continue;
      seenR.add(ri);
      const r = world.roads[ri];
      if (!['secondary', 'tertiary', 'residential'].includes(r.c)) continue;
      let flip = 1;
      walkLineD(r.p, 95, (x, z, tx, tz) => {
        flip = -flip;
        const h2 = hash32(Math.round(x * 3), Math.round(z * 3), 41);
        if (h2 % 100 > 42) return;
        const px2 = x - tz * flip * (r.w / 2 - 9);
        const pz2 = z + tx * flip * (r.w / 2 - 9);
        if (px2 < ox || px2 >= ox + CHUNK || pz2 < oy || pz2 >= oy + CHUNK) return;
        car(buckets[PLAIN], px2, pz2, Math.atan2(tz, tx), pick(STYLE.building.cars, h2), index.heightAtPx(px2, pz2));
      });
    }
  }

  // street lamps (lantern posts), picket fences, benches
  for (const lamp of index.lampsFor(key)) {
    // lamps stand on boardwalk decks, but never float up onto an overpass
    const g = index.surfaceYAt(lamp.x, lamp.y);
    buckets[PLAIN].box(lamp.x, lamp.y, 1.5, 1.5, g, g + 2, '#2e3330');
    buckets[PLAIN].box(lamp.x, lamp.y, 0.7, 0.7, g + 2, g + 24, '#2e3330');
    buckets[GLOW].box(lamp.x, lamp.y, 2.1, 2.1, g + 24, g + 27.5, '#ffe6b0'); // the bulb (always lit)
    // hanging flower baskets (the State Street look)
    const bh = hash32(Math.round(lamp.x), Math.round(lamp.y), 77);
    if (SEASON === 'winter') {
      // wreath + red bow on every lantern post
      buckets[PLAIN].box(lamp.x, lamp.y, 2.5, 0.55, g + 13.6, g + 18.4, '#2e5e38');
      buckets[PLAIN].box(lamp.x, lamp.y, 1.1, 0.65, g + 12.9, g + 14.8, '#c0392b');
    } else if (SEASON === 'fall') {
      // cornstalks tied to the post, a pumpkin at the base
      tmp.set('#c8a85c');
      cone(buckets[PLAIN], lamp.x + 2.8, g, lamp.y + 0.8, 2.3, 16, tmp.clone());
      tmp.set('#a8853e');
      cone(buckets[PLAIN], lamp.x + 1.1, g, lamp.y - 1.7, 1.7, 13, tmp.clone());
      if (bh % 100 < 60) {
        tmp.set('#d97a28');
        octoCanopy(buckets[PLAIN], lamp.x - 3.1, g + 1.7, lamp.y + 1.3, 2, tmp.clone());
      }
    } else if (bh % 100 < 70) {
      const flowers = ['#d8607a', '#e0a23c', '#c84a6b', '#ece8e0', '#9c6bbf'];
      buckets[PLAIN].box(lamp.x + 3.2, lamp.y, 1.5, 1.5, g + 17.5, g + 19.8, flowers[bh % flowers.length]);
      buckets[PLAIN].box(lamp.x + 3.2, lamp.y, 1.2, 1.2, g + 15.8, g + 17.5, '#4e7e46');
      buckets[PLAIN].box(lamp.x - 3.2, lamp.y, 1.5, 1.5, g + 17.5, g + 19.8, flowers[(bh >> 4) % flowers.length]);
      buckets[PLAIN].box(lamp.x - 3.2, lamp.y, 1.2, 1.2, g + 15.8, g + 17.5, '#4e7e46');
    }
    tmp.set('#23261f');
    const s = 2.8, topY2 = g + 27.5;
    buckets[PLAIN].triUV(lamp.x - s, topY2, lamp.y - s, lamp.x + s, topY2, lamp.y - s, lamp.x, topY2 + 3, lamp.y, 0, 0.7, -0.7, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
    buckets[PLAIN].triUV(lamp.x + s, topY2, lamp.y - s, lamp.x + s, topY2, lamp.y + s, lamp.x, topY2 + 3, lamp.y, 0.7, 0.7, 0, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
    buckets[PLAIN].triUV(lamp.x + s, topY2, lamp.y + s, lamp.x - s, topY2, lamp.y + s, lamp.x, topY2 + 3, lamp.y, 0, 0.7, 0.7, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
    buckets[PLAIN].triUV(lamp.x - s, topY2, lamp.y + s, lamp.x - s, topY2, lamp.y - s, lamp.x, topY2 + 3, lamp.y, -0.7, 0.7, 0, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
  }

  for (const f of index.fencesFor(key)) {
    const dx = f.x1 - f.x0, dz = f.y1 - f.y0;
    const len = Math.hypot(dx, dz);
    if (len < 4) continue;
    const ux = dx / len, uz = dz / len;
    const nx = -uz, nz = ux;
    tmp.set('#f4f1e6');
    const fr = tmp.r, fg = tmp.g, fb = tmp.b;
    const posts = Math.max(1, Math.floor(len / 9.5));
    for (let i2 = 0; i2 <= posts; i2++) {
      const t = i2 / posts;
      const px2 = f.x0 + dx * t, pz2 = f.y0 + dz * t;
      const g = index.heightAtPx(px2, pz2);
      buckets[PLAIN].quad(
        px2 - ux * 0.5, g, pz2 - uz * 0.5, px2 + ux * 0.5, g, pz2 + uz * 0.5,
        px2 + ux * 0.5, g + 7.5, pz2 + uz * 0.5, px2 - ux * 0.5, g + 7.5, pz2 - uz * 0.5,
        nx, 0, nz, fr, fg, fb
      );
    }
    const g0 = index.heightAtPx(f.x0, f.y0), g1 = index.heightAtPx(f.x1, f.y1);
    for (const railY of [3, 5.8]) {
      buckets[PLAIN].quad(
        f.x0, g0 + railY, f.y0, f.x1, g1 + railY, f.y1,
        f.x1, g1 + railY + 1.1, f.y1, f.x0, g0 + railY + 1.1, f.y0,
        nx, 0, nz, fr * 0.94, fg * 0.94, fb * 0.94
      );
    }
  }

  for (const pi of bucket.paths) {
    const p = world.paths[pi];
    if (p.c !== 'board' && p.c !== 'ped') continue;
    let flip = 1;
    walkLineD(p.p, 190, (x, z, nx, nz) => {
      flip = -flip;
      const h2 = hash32(Math.round(x), Math.round(z), 9);
      if (h2 % 100 > 38) return;
      if (x < ox || x >= ox + CHUNK || z < oy || z >= oy + CHUNK) return;
      const onDeck = p.c === 'board';
      const off = onDeck ? 5 : 11;
      const bx = x - nz * flip * off, bz = z + nx * flip * off;
      const gy = onDeck ? index.deckHeightAt(bx, bz) : index.heightAtPx(bx, bz);
      const ang = Math.atan2(nx, nz) + Math.PI / 2;
      rotBox(buckets[PLAIN], bx, bz, 6.5, 2.2, gy + 3.2, gy + 5.4, ang, '#7a5c3c');
      const backX = bx - nz * flip * 2, backZ = bz + nx * flip * 2;
      rotBox(buckets[PLAIN], backX, backZ, 6.5, 0.7, gy + 5.4, gy + 9.4, ang, '#6e522f');
    });
  }
  for (const pi of bucket.polys) {
    const poly = world.polys[pi];
    if (poly.k !== 'pier' && poly.k !== 'pool') continue;
    const [mx, my] = centroidOf(poly.p);
    if (Math.floor(mx / CHUNK) !== ckx || Math.floor(my / CHUNK) !== cky) continue;
    if (poly.k === 'pier') {
      if (poly.s === 'greasy') {
        // the Greasy Pole structure: bespoke visuals, anchored on the NAMED platform
        // poly (the gangway/pole strips are walkable colliders only — see map.mjs)
        if (poly.n) buildGreasyPole(buckets, poly);
        continue;
      }
      if (floatOutForWinter(poly.p)) continue;   // the marina pulls its floats for winter
      // Pier POLYS are the full-width (solid finger) dock surface; OSM often ALSO maps a
      // centerline 'pierline' through them, and that line's deck renders at PIER_DECK_Y too
      // → two coplanar decks z-fight (the "dock flicker"). Lift the poly deck 1.5px so it
      // sits cleanly on top of any overlapping line deck (deckHeightAt matches — see index.ts).
      const py = PIER_DECK_Y + 1.5;
      walls(buckets[PLANK], poly.p, 0, py, '#9a7a4e', 0);
      flatRoofPlank(buckets[PLANK], poly.p, py);
    } else {
      // real backyard pool: pale deck rim + bright water
      let g = -Infinity;
      for (let i = 0; i < poly.p.length; i += 2) g = Math.max(g, index.heightAtPx(poly.p[i], poly.p[i + 1]));
      walls(buckets[PLAIN], poly.p, g - 1.5, g + 1.8, '#e9e5da', 0);
      flatRoof(buckets[PLAIN], poly.p, g + 1.3, '#54bfe4');
    }
  }

  // sports gear on the real mapped pitches: hoops, nets, backstops, goals
  // cemeteries fill with gravestones — scatterInPoly owns chunk membership,
  // so multi-chunk grounds never double-place
  for (const pi of bucket.polys) {
    const poly = world.polys[pi];
    if (poly.k === 'cemetery') gravestones(buckets, poly, pi, world, index, bucket, ox, oy);
  }

  for (const pi of bucket.polys) {
    const poly = world.polys[pi];
    if (poly.k !== 'pitch' && poly.k !== 'playground') continue;
    const [mx, my] = centroidOf(poly.p);
    if (Math.floor(mx / CHUNK) !== ckx || Math.floor(my / CHUNK) !== cky) continue;
    if (poly.k === 'playground') {
      playgroundKit(buckets, poly, index, pi);
      continue;
    }
    const L = index.pitchLayout(pi);
    if (!L) continue;
    const ca = Math.cos(L.ang), sa = Math.sin(L.ang);
    const at = (lx: number, lz: number): [number, number] =>
      [L.cx + lx * ca - lz * sa, L.cz + lx * sa + lz * ca];
    if (L.kind === 'basketball') {
      const l2 = Math.min(L.hl - 6, 112);
      for (const s of [-1, 1]) {
        const [bx, bz] = at(s * (l2 + 4), 0);
        const gb = index.heightAtPx(bx, bz);
        const ux = -s * ca, uz = -s * sa; // toward center court
        buckets[PLAIN].box(bx, bz, 1, 1, gb, gb + 21, '#3c4044');
        const px2 = bx + ux * 2, pz2 = bz + uz * 2;
        const tx = -sa, tz = ca;
        tmp.set('#f2f3f0');
        buckets[PLAIN].quad(
          px2 - tx * 6, gb + 15, pz2 - tz * 6, px2 + tx * 6, gb + 15, pz2 + tz * 6,
          px2 + tx * 6, gb + 23, pz2 + tz * 6, px2 - tx * 6, gb + 23, pz2 - tz * 6,
          ux, 0, uz, tmp.r, tmp.g, tmp.b
        );
        rotBox(buckets[PLAIN], px2 + ux * 2.6, pz2 + uz * 2.6, 2.2, 2.2, gb + 14.4, gb + 15.2, L.ang, '#e07b2a');
      }
    } else if (L.kind === 'tennis') {
      const w2 = Math.min(L.hw - 5, Math.min(L.hl - 5, 95) * 0.463);
      const [n1x, n1z] = at(0, -w2 - 2);
      const [n2x, n2z] = at(0, w2 + 2);
      const gn = index.heightAtPx(L.cx, L.cz);
      buckets[PLAIN].box(n1x, n1z, 0.8, 0.8, gn, gn + 8.5, '#3c4044');
      buckets[PLAIN].box(n2x, n2z, 0.8, 0.8, gn, gn + 8.5, '#3c4044');
      tmp.set('#2e3338');
      buckets[PLAIN].quad(n1x, gn + 2, n1z, n2x, gn + 2, n2z, n2x, gn + 7.4, n2z, n1x, gn + 7.4, n1z, ca, 0, sa, tmp.r, tmp.g, tmp.b);
      tmp.set('#f4f1e6');
      buckets[PLAIN].quad(n1x, gn + 7.4, n1z, n2x, gn + 7.4, n2z, n2x, gn + 8.5, n2z, n1x, gn + 8.5, n1z, ca, 0, sa, tmp.r, tmp.g, tmp.b);
    } else if (L.kind === 'baseball') {
      const bl = Math.hypot(L.u1x + L.u2x, L.u1y + L.u2y) || 1;
      const ux = (L.u1x + L.u2x) / bl, uy = (L.u1y + L.u2y) / bl;
      const gh = index.heightAtPx(L.hx, L.hy);
      const backA = Math.atan2(uy, ux) + Math.PI;
      for (const da of [-0.55, 0, 0.55]) {
        const a = backA + da;
        const px2 = L.hx + Math.cos(a) * 16, pz2 = L.hy + Math.sin(a) * 16;
        rotBox(buckets[PLAIN], px2, pz2, 9, 0.4, gh, gh + 14, a + Math.PI / 2, '#3a5a44');
      }
      // players' benches along both foul lines
      for (const [dx2, dy2] of [[L.u1x, L.u1y], [L.u2x, L.u2y]] as const) {
        const sx = L.hx + dx2 * L.base * 0.55 - ux * 14;
        const sz = L.hy + dy2 * L.base * 0.55 - uy * 14;
        const gs = index.heightAtPx(sx, sz);
        rotBox(buckets[PLAIN], sx, sz, 8, 1.4, gs + 2.6, gs + 4, Math.atan2(dy2, dx2), '#8a6e4e');
      }
    } else if (L.kind === 'soccer' || L.kind === 'american_football') {
      const tall = L.kind === 'american_football';
      for (const s of [-1, 1]) {
        const [gx2, gz2] = at(s * (L.hl - 8), 0);
        const gg = index.heightAtPx(gx2, gz2);
        const tx = -sa, tz = ca;
        for (const t of [-12, 12]) {
          buckets[PLAIN].box(gx2 + tx * t, gz2 + tz * t, 0.7, 0.7, gg, gg + (tall ? 14 : 9), '#f4f3ec');
        }
        rotBox(buckets[PLAIN], gx2, gz2, 12, 0.5, gg + (tall ? 9 : 8.4), gg + (tall ? 9.7 : 9), L.ang + Math.PI / 2, '#f4f3ec');
      }
      // a full-size football field is War Memorial Stadium — dress it
      if (tall && L.hl > 280) buildStadium(buckets, L, index);
    }
  }

  // parked cars filling the real lots. Big lots (Cummings Center, hospitals)
  // have their drive aisles MAPPED as service ways — the naive grid put every
  // row near an aisle and the aisle buffer emptied the whole lot (Devin,
  // Beverly 7/6). Where aisles exist, anchor nose-in stall rows to them like
  // a real lot; the free grid only fills simple lots with no internal aisles.
  for (const pi of bucket.polys) {
    const poly = world.polys[pi];
    if (poly.k !== 'parking') continue;
    const obb = obbOf(poly.p);
    if (obb.hw < 16 || obb.hl < 20) continue;
    let cars = 0;
    const aisles: typeof world.roads = [];
    for (const ri of bucket.roads) {
      const r = world.roads[ri];
      if (r.c !== 'service') continue;
      // SAMPLE along the way — a straight aisle crossing the lot has both
      // endpoints outside and zero vertices inside (Cummings: every grid
      // looked aisle-less to the vertex test and rendered EMPTY)
      let inside = false;
      walkLineD(r.p, 30, (x, z) => { if (!inside && pointInPolyD(x, z, poly)) inside = true; });
      if (inside) aisles.push(r);
    }
    if (aisles.length) {
      for (const r of aisles) {
        walkLineD(r.p, 21, (x, z, tx, tz) => {
          if (cars >= 130) return;
          for (const sSide of [1, -1] as const) {
            const off = r.w / 2 + 11;
            const sx = x - tz * sSide * off, sz = z + tx * sSide * off;
            if (sx < ox || sx >= ox + CHUNK || sz < oy || sz >= oy + CHUNK) continue;
            const h2 = hash32(Math.round(sx * 2), Math.round(sz * 2), 97);
            if (h2 % 100 > 55) continue;
            if (!pointInPolyD(sx, sz, poly)) continue;
            // stalls never guard against buildings/water — a lot polygon that laps a
            // building footprint or the shoreline (Cummings Center wraps a giant
            // building and the Bass River) would otherwise park cars inside them
            if (index.isBlocked(sx, sz) || index.isWaterAt(sx, sz)) continue;
            let clash = false;
            for (const qi of bucket.roads) {
              const rq = world.roads[qi];
              if (rq === r) continue;
              if (distToPolylineSq(sx, sz, rq.p) < (rq.w / 2 + 8) ** 2) { clash = true; break; }
            }
            if (clash) continue;
            const ang = Math.atan2(tx * sSide, -tz * sSide);   // nose-in, away from the aisle
            car(buckets[PLAIN], sx, sz, ang + (((h2 >> 3) % 9) - 4) * 0.015, pick(STYLE.building.cars, h2), index.heightAtPx(sx, sz));
            cars++;
          }
        });
      }
      continue;
    }
    const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
    const noseA = obb.ang + Math.PI / 2;
    const nx2 = Math.cos(noseA), nz2 = Math.sin(noseA);
    // narrow strip-lots (each aisle row mapped as its own poly — Cummings) get
    // a single centered row; the 24px margin gave them ZERO rows and no cars
    const rows: number[] = [];
    if (obb.hw < 26) rows.push(0);
    else for (let w0 = -obb.hw + 24; w0 <= obb.hw - 24; w0 += 78) rows.push(w0);
    for (const w0 of rows) {
      if (cars >= 110) break;
      for (let l0 = -obb.hl + 16; l0 <= obb.hl - 16 && cars < 110; l0 += 22) {
        const x = obb.cx + l0 * ca - w0 * sa;
        const z = obb.cz + l0 * sa + w0 * ca;
        if (x < ox || x >= ox + CHUNK || z < oy || z >= oy + CHUNK) continue;
        const h2 = hash32(Math.round(x * 2), Math.round(z * 2), 97);
        if (h2 % 100 > 47) continue;
        if (!pointInPolyD(x, z, poly)) continue;
        if (!pointInPolyD(x + nx2 * 11, z + nz2 * 11, poly) || !pointInPolyD(x - nx2 * 11, z - nz2 * 11, poly)) continue;
        if (index.isBlocked(x, z) || index.isWaterAt(x, z)) continue;   // never park inside a building or on water
        // stay off the mapped drive aisles
        let onAisle = false;
        for (const ri of bucket.roads) {
          const r = world.roads[ri];
          if (distToPolylineSq(x, z, r.p) < (r.w / 2 + 9) ** 2) { onAisle = true; break; }
        }
        if (onAisle) continue;
        car(buckets[PLAIN], x, z, noseA + (((h2 >> 3) % 9) - 4) * 0.012, pick(STYLE.building.cars, h2), index.heightAtPx(x, z));
        cars++;
      }
    }
  }

  // boats tied up along the docks — EVERY pierline moors now, not just OSM
  // mooring-tagged ones (Beverly's whole marina is untagged pierline floats
  // and sat empty in summer; same fix the pier POLYS got below)
  const moored: [number, number][] = [];
  for (const pi of bucket.paths) {
    const p = world.paths[pi];
    if ((p.c !== 'pierline' && !p.m) || !MOOR_FILL) continue;
    let flip = 1;
    walkLineD(p.p, 116, (x, z, tx, tz) => {
      flip = -flip;
      const h2 = hash32(Math.round(x), Math.round(z), 23);
      if (h2 % 100 >= MOOR_FILL) return;
      const off = Math.max(p.w, 18) / 2 + 22;
      const bx = x - tz * flip * off, bz = z + tx * flip * off;
      if (bx < ox || bx >= ox + CHUNK || bz < oy || bz >= oy + CHUNK) return;
      const ang = Math.atan2(tz, tx);
      if (!mooringClear(index, moored, bx, bz, ang, h2)) return;
      boat(buckets[PLAIN], bx, bz, ang, h2);
      moored.push([bx, bz]);
    });
  }
  for (const pi of bucket.polys) {
    const poly = world.polys[pi];
    // EVERY pier moors boats now, not just OSM mooring-tagged ones — a marina's
    // whole float grid sat empty (Devin: "tons of boats docked at all the docks").
    // The Greasy Pole gangway/platform is a fiesta structure, not a marina — no boats.
    if (poly.k !== 'pier' || poly.s === 'greasy' || !MOOR_FILL || floatOutForWinter(poly.p)) continue;
    const ring = poly.p.concat(poly.p.slice(0, 2));
    let placed = 0;
    walkLineD(ring, 74, (x, z, tx, tz) => {
      if (placed >= 40) return;
      const h2 = hash32(Math.round(x), Math.round(z), 29);
      if (h2 % 100 >= MOOR_FILL) return;
      for (const s of [1, -1]) {
        const bx = x - tz * s * 24, bz = z + tx * s * 24;
        if (bx < ox || bx >= ox + CHUNK || bz < oy || bz >= oy + CHUNK) break;
        const ang = Math.atan2(tz, tx);
        if (!mooringClear(index, moored, bx, bz, ang, h2)) continue;
        boat(buckets[PLAIN], bx, bz, ang, h2);
        moored.push([bx, bz]);
        placed++;
        break;
      }
    });
  }

  // park & plaza benches, beach crabs near the tide line, sparse woodland critters
  const roadLines = bucket.roads.map((ri) => world.roads[ri]);
  for (const pi of bucket.polys) {
    const poly = world.polys[pi];
    if (poly.k === 'park' || poly.k === 'plaza') {
      placeBenches(buckets[PLAIN], poly, index, roadLines, ox, oy, poly.k === 'plaza' ? 4 : 6);
    } else if (poly.k === 'sand') {
      scatterInPoly(poly, hash32(pi, 83, 7), 60, 0.3, ox, oy, (x, z, rng) => {
        const g = index.heightAtPx(x, z);
        if (g > WATER_Y + 14) return;       // only the lower, wetter beach near the tide line
        crab(buckets[PLAIN], x, z, rng() * Math.PI * 2, g);
      }, 6);
    } else if (poly.k === 'wood') {
      scatterInPoly(poly, hash32(pi, 91, 13), 185, 0.3, ox, oy,
        (x, z, rng) => critter(buckets[PLAIN], x, z, rng() * Math.PI * 2, index.heightAtPx(x, z), rng() < 0.5), 3);
    }
  }

  // commuter-rail train parked at the town's station platform set piece
  // (null = the town has no surface platform, e.g. an underground depot)
  if (TOWN.trainPlatform && Math.floor(TOWN.trainPlatform.x / CHUNK) === ckx && Math.floor(TOWN.trainPlatform.z / CHUNK) === cky) {
    const ST_X = TOWN.trainPlatform.x, ST_Z = TOWN.trainPlatform.z;
    let bestD = Infinity, bestAng = 0, bx = ST_X, bz = ST_Z;
    for (const rl of world.rails) {
      const pts = rl.p;
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const ax = pts[i], az = pts[i + 1], ex = pts[i + 2] - ax, ez = pts[i + 3] - az;
        const len2 = ex * ex + ez * ez;
        if (len2 < 1) continue;
        let s = ((ST_X - ax) * ex + (ST_Z - az) * ez) / len2;
        s = s < 0 ? 0 : s > 1 ? 1 : s;
        const qx = ax + ex * s, qz = az + ez * s;
        const d = (qx - ST_X) ** 2 + (qz - ST_Z) ** 2;
        if (d < bestD) { bestD = d; bestAng = Math.atan2(ez, ex); bx = qx; bz = qz; }
      }
    }
    if (bestD < 1e9) mbtaTrain(buckets, bx, bz, bestAng, index);
  }

  // power lines: poles at the surveyed vertices + sagging wires, exactly where
  // OSM maps them (wooden distribution poles, taller gray transmission poles)
  for (const pi of bucket.power) {
    const pl = world.power[pi];
    const tall = pl.c === 'line';
    const poleH = tall ? 80 : 54;
    const pts = pl.p;
    for (let i = 0; i < pts.length; i += 2) {
      const px2 = pts[i], pz2 = pts[i + 1];
      if (px2 < ox || px2 >= ox + CHUNK || pz2 < oy || pz2 >= oy + CHUNK) continue;
      const g = index.heightAtPx(px2, pz2);
      buckets[PLAIN].box(px2, pz2, tall ? 1.4 : 1, tall ? 1.4 : 1, g, g + poleH, tall ? '#84878a' : '#7a5c40');
      const j = i + 3 < pts.length ? i + 2 : i - 2;
      if (j >= 0 && j + 1 < pts.length) {
        const ang = Math.atan2(pts[j + 1] - pz2, pts[j] - px2) + Math.PI / 2;
        rotBox(buckets[PLAIN], px2, pz2, tall ? 9 : 6.5, 0.55, g + poleH - 4.2, g + poleH - 3, ang, tall ? '#6e7174' : '#6a4f36');
      }
    }
    tmp.set('#33363a');
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x0 = pts[i], z0 = pts[i + 1], x1 = pts[i + 2], z1 = pts[i + 3];
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (mx < ox || mx >= ox + CHUNK || mz < oy || mz >= oy + CHUNK) continue;
      const span = Math.hypot(x1 - x0, z1 - z0);
      if (span < 2 || span > 1400) continue;
      const y0w = index.heightAtPx(x0, z0) + poleH - 3.6;
      const y1w = index.heightAtPx(x1, z1) + poleH - 3.6;
      const sag = Math.min(7, span * 0.035);
      const nx = -(z1 - z0) / span, nz = (x1 - x0) / span;
      const offs = tall ? [-7, 0, 7] : [-4.6, 4.6];
      for (const off of offs) {
        const ax = x0 + nx * off, az = z0 + nz * off;
        const bx = x1 + nx * off, bz = z1 + nz * off;
        const cx2 = (ax + bx) / 2, cz2 = (az + bz) / 2;
        const my = (y0w + y1w) / 2 - sag;
        buckets[PLAIN].quad(ax, y0w, az, cx2, my, cz2, cx2, my + 0.5, cz2, ax, y0w + 0.5, az, nx, 0, nz, tmp.r, tmp.g, tmp.b);
        buckets[PLAIN].quad(cx2, my, cz2, bx, y1w, bz, bx, y1w + 0.5, bz, cx2, my + 0.5, cz2, nx, 0, nz, tmp.r, tmp.g, tmp.b);
      }
    }
  }

  // Plum Island Airport: hobby planes tied down on the real aprons, windsocks at
  // their surveyed spots
  for (const pi of bucket.polys) {
    const poly = world.polys[pi];
    if (poly.k !== 'apron') continue;
    const [mx, my] = centroidOf(poly.p);
    if (Math.floor(mx / CHUNK) !== ckx || Math.floor(my / CHUNK) !== cky) continue;
    const obb = obbOf(poly.p);
    const ca2 = Math.cos(obb.ang), sa2 = Math.sin(obb.ang);
    let placed = 0;
    // the planes are much bigger now — space them by the new wingspan so they don't overlap
    for (let l0 = -obb.hl + 89; l0 <= obb.hl - 89 && placed < 3; l0 += 180) {
      const x = obb.cx + l0 * ca2, z = obb.cz + l0 * sa2;
      const h2 = hash32(Math.round(x), Math.round(z), 53);
      if (!pointInPolyD(x, z, poly)) continue;
      plane(buckets[PLAIN], x, z, obb.ang + Math.PI / 2 + ((h2 % 11) - 5) * 0.05, h2, index.heightAtPx(x, z));
      placed++;
    }
  }
  for (const poi of world.pois) {
    if (poi.x < ox || poi.x >= ox + CHUNK || poi.y < oy || poi.y >= oy + CHUNK) continue;
    const ph = POI_HEROES[poi.n || ''];
    if (ph) { ph(buckets, poi.x, poi.y, index.heightAtPx(poi.x, poi.y)); continue; }   // named monuments (Man at the Wheel &c.)
    if (poi.k === 'windsock') {
      const g = index.heightAtPx(poi.x, poi.y);
      const a = ((hash32(Math.round(poi.x), 7) % 100) / 100) * Math.PI * 2;
      buckets[PLAIN].box(poi.x, poi.y, 0.6, 0.6, g, g + 20, '#d8d5cc');
      rotBox(buckets[PLAIN], poi.x + Math.cos(a) * 4, poi.y + Math.sin(a) * 4, 4, 1.4, g + 17, g + 19.4, a, '#e8762e');
      rotBox(buckets[PLAIN], poi.x + Math.cos(a) * 9.5, poi.y + Math.sin(a) * 9.5, 2.2, 0.9, g + 17.6, g + 18.9, a, '#e8762e');
    } else if (poi.k === 'lighthouse') {
      // a lighthouse mapped as a point (not a building footprint) — e.g. Fort Pickering Light
      lighthouse(buckets[PLAIN], poi.x, poi.y, index.heightAtPx(poi.x, poi.y));
    } else if (poi.k === 'statue') {
      landmarkStatue(buckets[PLAIN], poi.x, poi.y, index.heightAtPx(poi.x, poi.y));
    } else if (poi.k === 'obelisk') {
      landmarkObelisk(buckets[PLAIN], poi.x, poi.y, index.heightAtPx(poi.x, poi.y));
    } else if (poi.k === 'arch') {
      landmarkArch(buckets[PLAIN], poi.x, poi.y, index.heightAtPx(poi.x, poi.y));
    } else if (poi.k === 'fountain') {
      landmarkFountain(buckets[PLAIN], poi.x, poi.y, index.heightAtPx(poi.x, poi.y));
    } else if (poi.k === 'fort') {
      landmarkFort(buckets[PLAIN], poi.x, poi.y, index.heightAtPx(poi.x, poi.y));
    } else if (poi.k === 'fuel') {
      // ⛽ canopy + pumps in the forecourt (see forecourtSpot for the placement story)
      const s = forecourtSpot(world, index, bucket, poi, 48, 30);
      if (s) gasStation(buckets[PLAIN], s.x, s.z, s.ang, index.heightAtPx(s.x, s.z));
    } else if (poi.k === 'ice_cream') {
      // 🍦 the giant cone + picnic tables out front
      const s = forecourtSpot(world, index, bucket, poi, 26, 12);
      if (s) iceCreamStand(buckets[PLAIN], s.x, s.z, s.ang, index.heightAtPx(s.x, s.z));
    } else if (poi.k === 'fire_station') {
      // 🚒 the engine parked on the apron
      const s = forecourtSpot(world, index, bucket, poi, 34, 12);
      if (s) fireEngine(buckets[PLAIN], s.x, s.z, s.ang, index.heightAtPx(s.x, s.z));
    } else if (poi.k === 'police') {
      // 🚓 a cruiser out front
      const s = forecourtSpot(world, index, bucket, poi, 22, 10);
      if (s) policeCruiser(buckets[PLAIN], s.x, s.z, s.ang, index.heightAtPx(s.x, s.z));
    } else if (poi.k === 'theatre' || poi.k === 'cinema') {
      // 🎬 marquee over the entrance
      marquee(buckets, world, index, bucket, poi);
    }
  }

  // real property-line barriers: stockade fences, hedges, stone walls
  for (const bi of bucket.barriers) {
    const bar = world.barriers[bi];
    // 'picket' = the white post-and-rail look of the synthetic front-yard fences
    // (fencesFor below), but data-placed — used for hand-mapped yards
    if (bar.k === 'picket') {
      tmp.set('#f4f1e6');
      const fr = tmp.r, fg = tmp.g, fb = tmp.b;
      for (let i = 0; i + 3 < bar.p.length; i += 2) {
        const x0 = bar.p[i], z0 = bar.p[i + 1], x1 = bar.p[i + 2], z1 = bar.p[i + 3];
        const mx2 = (x0 + x1) / 2, mz2 = (z0 + z1) / 2;
        if (mx2 < ox || mx2 >= ox + CHUNK || mz2 < oy || mz2 >= oy + CHUNK) continue;
        const dx = x1 - x0, dz = z1 - z0;
        const len = Math.hypot(dx, dz);
        if (len < 0.5) continue;
        const ux = dx / len, uz = dz / len;
        const nx = -uz, nz = ux;
        const posts = Math.max(1, Math.floor(len / 9.5));
        for (let i2 = 0; i2 <= posts; i2++) {
          const t = i2 / posts;
          const px2 = x0 + dx * t, pz2 = z0 + dz * t;
          const g = index.heightAtPx(px2, pz2);
          buckets[PLAIN].quad(
            px2 - ux * 0.5, g, pz2 - uz * 0.5, px2 + ux * 0.5, g, pz2 + uz * 0.5,
            px2 + ux * 0.5, g + 7.5, pz2 + uz * 0.5, px2 - ux * 0.5, g + 7.5, pz2 - uz * 0.5,
            nx, 0, nz, fr, fg, fb
          );
        }
        const g0 = index.heightAtPx(x0, z0), g1 = index.heightAtPx(x1, z1);
        for (const railY of [3, 5.8]) {
          buckets[PLAIN].quad(
            x0, g0 + railY, z0, x1, g1 + railY, z1,
            x1, g1 + railY + 1.1, z1, x0, g0 + railY + 1.1, z0,
            nx, 0, nz, fr * 0.94, fg * 0.94, fb * 0.94
          );
        }
      }
      continue;
    }
    const style = bar.k === 'hedge'
      ? { hw: 4, h: 9.5, hex: '#4a7a42' }
      : bar.k === 'wall'
        ? { hw: 2.2, h: 4.5, hex: '#a8a59c' }
        : { hw: 0.6, h: 7.5, hex: '#b59a72' };
    tmp.set(style.hex);
    const br = tmp.r, bg = tmp.g, bb2 = tmp.b;
    for (let i = 0; i + 3 < bar.p.length; i += 2) {
      const x0 = bar.p[i], z0 = bar.p[i + 1], x1 = bar.p[i + 2], z1 = bar.p[i + 3];
      const mx2 = (x0 + x1) / 2, mz2 = (z0 + z1) / 2;
      if (mx2 < ox || mx2 >= ox + CHUNK || mz2 < oy || mz2 >= oy + CHUNK) continue;
      const dx = x1 - x0, dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      if (len < 0.5) continue;
      const nx = -dz / len, nz = dx / len;
      const g0 = index.heightAtPx(x0, z0), g1 = index.heightAtPx(x1, z1);
      for (const s of [1, -1]) {
        buckets[PLAIN].quad(
          x0 + nx * style.hw * s, g0, z0 + nz * style.hw * s, x1 + nx * style.hw * s, g1, z1 + nz * style.hw * s,
          x1 + nx * style.hw * s, g1 + style.h, z1 + nz * style.hw * s, x0 + nx * style.hw * s, g0 + style.h, z0 + nz * style.hw * s,
          nx * s, 0, nz * s, br * (s > 0 ? 1 : 0.86), bg * (s > 0 ? 1 : 0.86), bb2 * (s > 0 ? 1 : 0.86)
        );
      }
      buckets[PLAIN].quad(
        x0 + nx * style.hw, g0 + style.h, z0 + nz * style.hw, x1 + nx * style.hw, g1 + style.h, z1 + nz * style.hw,
        x1 - nx * style.hw, g1 + style.h, z1 - nz * style.hw, x0 - nx * style.hw, g0 + style.h, z0 - nz * style.hw,
        0, 1, 0, br * 1.06, bg * 1.06, bb2 * 1.06
      );
    }
  }

  const allPlants = index.treesFor(key).concat(index.extraPlantingsFor(key));
  for (const t of allPlants) {
    // winter: keep the sled lane (if the town has one) clear of trees so the kids have a run
    if (SEASON === 'winter' && SLED_LANE) {
      const cz = Math.max(SLED_LANE.z0, Math.min(SLED_LANE.z1, t.y));
      if (Math.hypot(t.x - SLED_LANE.x, t.y - cz) < SLED_LANE.halfW) continue;
    }
    const g = index.heightAtPx(t.x, t.y);
    const h1 = hash32(Math.round(t.x), Math.round(t.y));
    const variation = 0.84 + (h1 % 100) / 100 * 0.32;
    if (t.reed) {
      // marsh reeds: a tuft of tall thin blades with a pale seed-head tip, so wetlands
      // read as thick, tall reed beds instead of flat green (straw-toned in winter)
      const green = new THREE.Color(SEASON === 'winter' ? '#bcaa78' : '#9aac63').multiplyScalar(variation);
      const blades = 3 + (h1 % 3);
      for (let b = 0; b < blades; b++) {
        const a = (b / blades) * 6.283 + (h1 % 7);
        const off = 0.8 + (b % 2) * 1.4;
        const bx = t.x + Math.cos(a) * off, by = t.y + Math.sin(a) * off;
        const bh = 13 + ((h1 >> b) % 100) / 100 * 10;
        cone(buckets[PLAIN], bx, g, by, 0.7, bh, green);
        tmp.set('#cbb87a');
        cone(buckets[PLAIN], bx, g + bh * 0.78, by, 0.42, bh * 0.28, tmp.clone());
      }
      continue;
    }
    if (t.bush) {
      const c = new THREE.Color(TREES.bush).multiplyScalar(variation);
      octoCanopy(buckets[PLAIN], t.x, g + t.r * 1.1, t.y, t.r * 1.12, c);
      continue;
    }
    const isPine = (h1 >> 8) % 100 < (t.x > BEACH_X ? 55 : 22);
    if (isPine) {
      // white pine: trunk + three stacked cones
      const c = new THREE.Color(TREES.pine).multiplyScalar(variation);
      const w = 1.6;
      const trunkH = 7 + t.r * 0.5;
      walls(buckets[PLAIN], [t.x - w, t.y - w, t.x + w, t.y - w, t.x + w, t.y + w, t.x - w, t.y + w], g, g + trunkH + 4, '#6e5236', 0);
      cone(buckets[PLAIN], t.x, g + trunkH, t.y, t.r * 1.2, t.r * 1.5, c);
      cone(buckets[PLAIN], t.x, g + trunkH + t.r * 0.9, t.y, t.r * 0.9, t.r * 1.25, c.clone().multiplyScalar(1.08));
      cone(buckets[PLAIN], t.x, g + trunkH + t.r * 1.7, t.y, t.r * 0.58, t.r * 1.05, c.clone().multiplyScalar(1.16));
      if (TREES.snowCaps) {
        tmp.set('#eef1f3');
        cone(buckets[PLAIN], t.x, g + trunkH + t.r * 2.25, t.y, t.r * 0.34, t.r * 0.5, tmp.clone());
      }
      if (SEASON === 'winter' && t.x * t.x + t.y * t.y < 1500 * 1500) {
        // downtown pines wrapped in warm white lights
        for (let i = 0; i < 16; i++) {
          const tt = i / 16;
          const ang = tt * Math.PI * 5 + (h1 % 7);
          const rr = (1 - tt * 0.8) * t.r * 1.05;
          buckets[GLOW].box(t.x + Math.cos(ang) * rr, t.y + Math.sin(ang) * rr, 0.55, 0.55,
            g + trunkH + tt * t.r * 2.1, g + trunkH + tt * t.r * 2.1 + 1.1, '#fff0c2');
        }
      }
    } else {
      // deciduous: tapered trunk + clustered canopy
      const hue = (h1 >> 4) % 3; // green / yellow-green / dark green
      const base = TREES.deciduous[hue % TREES.deciduous.length];
      const c = new THREE.Color(base).multiplyScalar(variation);
      const canopyY = g + t.r * 1.6 + 8;
      walls(buckets[PLAIN], [t.x - 2.2, t.y - 2.2, t.x + 2.2, t.y - 2.2, t.x + 2.2, t.y + 2.2, t.x - 2.2, t.y + 2.2], g, g + (t.r * 1.6 + 8) * 0.55, '#6e5236', 0);
      walls(buckets[PLAIN], [t.x - 1.5, t.y - 1.5, t.x + 1.5, t.y - 1.5, t.x + 1.5, t.y + 1.5, t.x - 1.5, t.y + 1.5], g + (t.r * 1.6 + 8) * 0.5, canopyY, '#7a5a3a', 0);
      octoCanopy(buckets[PLAIN], t.x, canopyY, t.y, t.r * 1.12, c);
      const j = ((h1 >> 12) % 100) / 100 - 0.5;
      octoCanopy(buckets[PLAIN], t.x + j * t.r * 0.9, canopyY + t.r * 0.5, t.y - Math.abs(j) * t.r * 0.5, t.r * 0.66, c.clone().multiplyScalar(1.1));
      octoCanopy(buckets[PLAIN], t.x - j * t.r * 0.7, canopyY + t.r * 0.8, t.y + Math.abs(j) * t.r * 0.45, t.r * 0.55, c.clone().multiplyScalar(0.92));
      if (SEASON === 'winter' && t.x * t.x + t.y * t.y < 1500 * 1500) {
        // downtown shade trees get light wraps too
        for (let i = 0; i < 14; i++) {
          const tt = i / 14;
          const ang = tt * Math.PI * 4.4 + (h1 % 7);
          const rr = t.r * (0.45 + 0.5 * tt);
          buckets[GLOW].box(t.x + Math.cos(ang) * rr, t.y + Math.sin(ang) * rr, 0.55, 0.55,
            canopyY - t.r * 0.4 + tt * t.r * 1.3, canopyY - t.r * 0.4 + tt * t.r * 1.3 + 1.1, '#fff0c2');
        }
      }
      if (SEASON === 'fall' && (h1 >> 16) % 100 < 12) {
        // a little ghost hangs from the branches
        const gx = t.x + t.r * 0.7, gz = t.y + t.r * 0.3;
        const gy = canopyY - t.r * 0.65;
        tmp.set('#f2f2ee');
        octoCanopy(buckets[PLAIN], gx, gy, gz, 2.5, tmp.clone());
        buckets[PLAIN].box(gx - 0.85, gz + 2.3, 0.38, 0.14, gy - 0.4, gy + 0.5, '#23241f');
        buckets[PLAIN].box(gx + 0.85, gz + 2.3, 0.38, 0.14, gy - 0.4, gy + 0.5, '#23241f');
      }
    }
  }

  // parked cars on driveways
  for (const dr of index.drivewaysFor(key)) {
    if (!dr.car) continue;
    const x = dr.x0 + (dr.x1 - dr.x0) * dr.carT;
    const z = dr.y0 + (dr.y1 - dr.y0) * dr.carT;
    const gc = index.heightAtPx(x, z);
    const ang = Math.atan2(dr.y1 - dr.y0, dr.x1 - dr.x0);
    car(buckets[PLAIN], x, z, ang, pick(STYLE.building.cars, dr.seed), gc);
  }

  // dune grass on sand + the living beach kit on the destination beaches
  for (const pi of bucket.polys) {
    const poly = world.polys[pi];
    if (poly.k !== 'sand' && poly.k !== 'island') continue;
    const beach = poly.k === 'sand' && index.isBeachPoly(pi);
    // dune grass: thick on wild dunes and back-shore sand, sparse tufts on the
    // groomed swimming beaches — towels want open sand
    scatterInPoly(poly, pi + 313, 80, beach ? 0.14 : 0.5, ox, oy, (x, z, rng) => {
      const gg = index.heightAtPx(x, z);
      const g = new THREE.Color('#b4ae72').multiplyScalar(0.85 + rng() * 0.3);
      const h = 7 + rng() * 5;
      buckets[PLAIN].quad(x - 4, gg, z, x + 4, gg, z, x + 2.5, gg + h, z, x - 2.5, gg + h, z, 0, 0, 1, g.r, g.g, g.b);
      buckets[PLAIN].quad(x, gg, z - 4, x, gg, z + 4, x, gg + h, z + 2.5, x, gg + h, z - 2.5, 1, 0, 0, g.r * 0.9, g.g * 0.9, g.b * 0.9);
    }, 240);
    // a proper beach day is a summer thing: umbrella camps + strollers in summer,
    // bare sand in spring/fall, snow-quiet in winter
    if (poly.k !== 'sand' || SEASON !== 'summer') continue;
    scatterInPoly(poly, pi + 717, beach ? 120 : 170, beach ? 0.62 : 0.22, ox, oy, (x, z, rng) => {
      if (!beach && x < BEACH_X) return;   // NBPT: unnamed barrier sand east of Plum Island's line still gets a thin kit
      if (index.isWaterAt(x, z)) return;   // strand polys dip under the tide line
      beachCamp(buckets[PLAIN], x, z, index.heightAtPx(x, z), rng, (wx, wz) => index.isWaterAt(wx, wz));
    }, beach ? 24 : 12);
    if (beach) {
      // strollers between the camps — a beach people travel to is people walking it
      scatterInPoly(poly, pi + 919, 230, 0.4, ox, oy, (x, z, rng) => {
        if (index.isWaterAt(x, z)) return;
        const g = index.heightAtPx(x, z);
        beachgoer(buckets[PLAIN], x, z, g, rng() * Math.PI * 2, rng, 'stand', rng() < 0.35);
        if (rng() < 0.4) beachDog(buckets[PLAIN], x + 6 + rng() * 5, z + (rng() - 0.5) * 10, g, rng() * Math.PI * 2);
      }, 8);
    }
  }

  let total = 0;
  for (const bk of buckets) total += bk.pos.length;
  if (!total) return null;

  // copy via typed-array set — spreading huge buckets into push() blows the call stack
  const pos = new Float32Array(total);
  const norm = new Float32Array(total);
  const col = new Float32Array(total);
  const uv = new Float32Array((total / 3) * 2);
  const geo = new THREE.BufferGeometry();
  let start = 0, off = 0, uvOff = 0;
  buckets.forEach((bk, mi) => {
    const count = bk.pos.length / 3;
    if (count) geo.addGroup(start, count, mi);
    start += count;
    pos.set(bk.pos, off);
    norm.set(bk.norm, off);
    col.set(bk.col, off);
    uv.set(bk.uv, uvOff);
    off += bk.pos.length;
    uvOff += bk.uv.length;
  });
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(norm, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const mesh = new THREE.Mesh(geo, decorMaterials());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function flatRoofPlank(bk: Bucket, ring: number[], h: number) {
  tmp.set('#ffffff');
  const v = ringToVec2(ring);
  const tris = THREE.ShapeUtils.triangulateShape(v, []);
  for (const [i0, i1, i2] of tris) {
    bk.triUV(v[i0].x, h, -v[i0].y, v[i1].x, h, -v[i1].y, v[i2].x, h, -v[i2].y, 0, 1, 0, tmp.r, tmp.g, tmp.b,
      v[i0].x / TEX_SCALE, v[i0].y / TEX_SCALE, v[i1].x / TEX_SCALE, v[i1].y / TEX_SCALE, v[i2].x / TEX_SCALE, v[i2].y / TEX_SCALE);
  }
}

let _mats: THREE.Material[] | null = null;
function decorMaterials(): THREE.Material[] {
  if (!_mats) {
    const mk = (map: THREE.Texture | null) => {
      const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
      if (map) m.map = map;
      m.shadowSide = THREE.DoubleSide; // open quads must still write shadow depth
      return m;
    };
    // group 5 is unlit: holiday string lights read as glowing bulbs at dusk
    _mats = [mk(null), mk(clapboardTex()), mk(brickTex()), mk(shingleTex()), mk(plankTex()),
             new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })];
  }
  return _mats;
}
