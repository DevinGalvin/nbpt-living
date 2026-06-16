import * as THREE from 'three';
import type { WorldData, Building, Poly } from '../world/types';
import { WorldIndex, CHUNK, centroidOf, walkLine as walkLineD, obbOf, type OBB, distToPolylineSq } from '../world/index';
import { STYLE, SEASON, TREES, pick, hash32, mulberry32 } from '../world/style';
import { clapboardTex, shingleTex, brickTex, plankTex } from './textures';
import { WATER_Y } from './water';
import { gillisCenter } from './gillis';

// Per-chunk merged decor mesh with 5 textured material groups:
// 0 plain · 1 clapboard siding · 2 brick · 3 shingle roofing · 4 deck planks.
// Buildings carry Newburyport detail: siding courses, real brick, gabled shingle
// roofs, white fascia + corner boards, shutters, doors, chimneys, cornices.

export const BRIDGE_DECK_Y = 7;
export const PIER_DECK_Y = 4;

const TEX_SCALE = 16; // 1 texture repeat = 16 world px = 2 m
const BEACH_X = 29000; // east of here = Plum Island beach zone (shake cottages, umbrellas)

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
function gableRoof(shin: Bucket, clap: Bucket, ring: number[], obb: OBB, eaveH: number, ridgeH: number, ov: number,
                   roofHex: string, wallHex: string) {
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
                      roofHex: string, wallHex: string, depth = 0) {
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
    gableRoof(shin, clap, ring, obb, eaveAbs, ridgeH, 4, roofHex, wallHex);
  };
  if (fill >= 0.72 || depth >= 2 || obb.hw < 6 || ring.length < 10) return simple();

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

// windows (+shutters), door, along the exact footprint walls.
// Commercial buildings get a storefront ground floor: display glass, awnings, sign band.
// `g` = ground height at the building, `eaveH` = ABSOLUTE eave height.
function facades(plain: Bucket, ring: number[], eaveH: number, rows: number,
                 seed: number, withDoor: boolean, withShutters: boolean, storefront: boolean, g: number,
                 maxWinOverride?: number, forceDoor?: string) {
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
  const shutterHex = pick(STYLE.building.shutters, seed);
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
      // the main door sits on the longest wall; institutional-length walls
      // (schools, mills) get their own entrance too
      const isDoorSlot = withDoor && c === Math.ceil(cols / 2) && (i === longest || len >= 280);
      for (let r = 0; r < rows; r++) {
        const yC = g + 13 + r * 19;
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
function boat(bk: Bucket, x: number, z: number, ang: number, seed: number) {
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const hullHex = pick(['#f4f1e8', '#f4f1e8', '#e9e6db', '#27425c', '#7e3434', '#3e5c50'], seed);
  hull(bk, x, z, 32, 9.5, WATER_Y - 2.6, WATER_Y + 6.5, ang, hullHex);
  // gunwale rail cap running the length of the deck
  chamferBox(bk, x - ca * 2.5, z - sa * 2.5, 19, 6.4, WATER_Y + 6.5, WATER_Y + 8, ang, '#b9926a', 2.4);
  if (hash32(seed, 5, 1) % 100 < 45) {
    // sloop with the sails down — tall mast + boom
    bk.box(x, z, 0.9, 0.9, WATER_Y + 6, WATER_Y + 60, '#ece8dc');
    chamferBox(bk, x - ca * 9, z - sa * 9, 13, 1.3, WATER_Y + 14, WATER_Y + 16.5, ang, '#d8d2c2', 1);
  } else {
    // lobster-boat wheelhouse forward
    chamferBox(bk, x + ca * 7, z + sa * 7, 11, 7, WATER_Y + 6.5, WATER_Y + 20, ang, '#f8f6ee', 2.6);
    chamferBox(bk, x + ca * 7, z + sa * 7, 12, 8, WATER_Y + 19.5, WATER_Y + 21.6, ang, '#4a4640', 3);
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
function ribbonDeck(buckets: Bucket[], pts: number[], w: number, topYAt: number | ((x: number, z: number) => number),
                    rails: boolean, ox: number, oy: number, skipGillis = false) {
  const isRoad = rails;
  const surf = isRoad ? buckets[PLAIN] : buckets[PLANK];
  const asphalt = new THREE.Color('#3a3d42');
  const wood = new THREE.Color('#ffffff');
  const line = new THREE.Color('#c9a23e');                       // road center line
  const skirt = new THREE.Color(isRoad ? '#62656b' : '#8a8d92'); // bridge structure side
  const rail = new THREE.Color(isRoad ? '#b8b3a6' : '#e3e0d6');  // guardrail
  const topC = isRoad ? asphalt : wood;
  const yAt = typeof topYAt === 'number' ? () => topYAt : topYAt;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const sx0 = pts[i], sz0 = pts[i + 1], sx1 = pts[i + 2], sz1 = pts[i + 3];
    const segLen = Math.hypot(sx1 - sx0, sz1 - sz0);
    if (segLen < 0.01) continue;
    const pieces = Math.max(1, Math.ceil(segLen / 48));
    for (let pc = 0; pc < pieces; pc++) {
      const x0 = sx0 + (sx1 - sx0) * (pc / pieces), z0 = sz0 + (sz1 - sz0) * (pc / pieces);
      const x1 = sx0 + (sx1 - sx0) * ((pc + 1) / pieces), z1 = sz0 + (sz1 - sz0) * ((pc + 1) / pieces);
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if (mx < ox || mx >= ox + CHUNK || mz < oy || mz >= oy + CHUNK) continue;
      // leave a clean rectangular gap at the Gillis channel — the custom drawbridge fills it
      if (skipGillis && inGillisRect(mx, mz)) continue;
      const dx = x1 - x0, dz = z1 - z0;
      const len = Math.hypot(dx, dz);
      if (len < 0.01) continue;
      const nx = -dz / len, nz = dx / len;
      const hw = w / 2;
      const y0 = yAt(x0, z0), y1 = yAt(x1, z1);
      const u = len / TEX_SCALE, vv = w / TEX_SCALE;
      // deck TOP surface
      surf.quadUV(
        x0 + nx * hw, y0, z0 + nz * hw, x1 + nx * hw, y1, z1 + nz * hw,
        x1 - nx * hw, y1, z1 - nz * hw, x0 - nx * hw, y0, z0 - nz * hw,
        0, 1, 0, topC.r, topC.g, topC.b,
        0, 0, u, 0, u, vv, 0, vv
      );
      if (isRoad && pc % 2 === 0 && w > 12) {
        // dashed yellow center line, laid just over the deck
        const lw = 1.4;
        surf.quad(
          x0 + nx * lw, y0 + 0.3, z0 + nz * lw, x1 + nx * lw, y1 + 0.3, z1 + nz * lw,
          x1 - nx * lw, y1 + 0.3, z1 - nz * lw, x0 - nx * lw, y0 + 0.3, z0 - nz * lw,
          0, 1, 0, line.r, line.g, line.b
        );
      }
      if (isRoad) {
        // CLOSED constant-thickness slab: bottom face at y-T + thin fascia sides + end
        // caps. Discrete piers/abutments (emitted by the caller) hold it up, so the
        // space *between* supports is open — this is the structural fix for both the
        // see-through gaps (open underside) and the buried overpass (full-height wall).
        const T = WorldIndex.DECK_T;
        const b0 = y0 - T, b1 = y1 - T;
        // bottom face — normal down, wound opposite the top so it shows from below
        surf.quad(
          x0 - nx * hw, b0, z0 - nz * hw, x1 - nx * hw, b1, z1 - nz * hw,
          x1 + nx * hw, b1, z1 + nz * hw, x0 + nx * hw, b0, z0 + nz * hw,
          0, -1, 0, skirt.r * 0.9, skirt.g * 0.9, skirt.b * 0.9
        );
        for (const s of [1, -1]) {
          // fascia — the deck edge (only T tall), not a wall to the ground
          surf.quad(
            x0 + nx * hw * s, b0, z0 + nz * hw * s, x1 + nx * hw * s, b1, z1 + nz * hw * s,
            x1 + nx * hw * s, y1, z1 + nz * hw * s, x0 + nx * hw * s, y0, z0 + nz * hw * s,
            nx * s, 0, nz * s, skirt.r, skirt.g, skirt.b
          );
          // top rail band + posts — reads as a real guardrail
          surf.quad(
            x0 + nx * hw * s, y0 + 3.4, z0 + nz * hw * s, x1 + nx * hw * s, y1 + 3.4, z1 + nz * hw * s,
            x1 + nx * hw * s, y1 + 4.8, z1 + nz * hw * s, x0 + nx * hw * s, y0 + 4.8, z0 + nz * hw * s,
            nx * s, 0, nz * s, rail.r, rail.g, rail.b
          );
          const posts = Math.max(1, Math.floor(len / 26));
          for (let pi2 = 0; pi2 <= posts; pi2++) {
            const t = pi2 / posts;
            const py = y0 + (y1 - y0) * t;
            const px2 = x0 + dx * t + nx * hw * s, pz2 = z0 + dz * t + nz * hw * s;
            surf.quad(
              px2 - dx / len * 0.6, py, pz2 - dz / len * 0.6, px2 + dx / len * 0.6, py, pz2 + dz / len * 0.6,
              px2 + dx / len * 0.6, py + 3.4, pz2 + dz / len * 0.6, px2 - dx / len * 0.6, py + 3.4, pz2 - dz / len * 0.6,
              nx * s, 0, nz * s, rail.r * 0.88, rail.g * 0.88, rail.b * 0.88
            );
          }
        }
        // END CAPS — close the hollow slab at the polyline's first/last end. The
        // per-piece chunk cull above means each end is reached in exactly ONE chunk,
        // so the cap is emitted once (no double-draw across chunk seams).
        if (i === 0 && pc === 0) {
          surf.quad(
            x0 - nx * hw, b0, z0 - nz * hw, x0 + nx * hw, b0, z0 + nz * hw,
            x0 + nx * hw, y0, z0 + nz * hw, x0 - nx * hw, y0, z0 - nz * hw,
            -dx / len, 0, -dz / len, skirt.r, skirt.g, skirt.b
          );
        }
        if (i + 4 >= pts.length && pc === pieces - 1) {
          surf.quad(
            x1 + nx * hw, b1, z1 + nz * hw, x1 - nx * hw, b1, z1 - nz * hw,
            x1 - nx * hw, y1, z1 - nz * hw, x1 + nx * hw, y1, z1 + nz * hw,
            dx / len, 0, dz / len, skirt.r, skirt.g, skirt.b
          );
        }
      } else {
        // wooden docks / foot-bridges: original full side skirt down to ground/water
        const bottomY = Math.min(y0, y1) > 22 ? 0 : Math.max(0, Math.min(y0, y1) - 14);
        for (const s of [1, -1]) {
          surf.quad(
            x0 + nx * hw * s, bottomY, z0 + nz * hw * s, x1 + nx * hw * s, bottomY, z1 + nz * hw * s,
            x1 + nx * hw * s, y1, z1 + nz * hw * s, x0 + nx * hw * s, y0, z0 + nz * hw * s,
            nx * s, 0, nz * s, skirt.r, skirt.g, skirt.b
          );
        }
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

function buildingDims(b: Building, areaM2: number): { eave: number; lvEff: number } {
  let lv = Math.max(1, Math.min(5, b.lv || 1.5));
  switch (b.k) {
    case 'shed': return { eave: 16, lvEff: 1 };
    case 'house':
      if (areaM2 > 110) lv = Math.max(lv, 2.2);   // Newburyport colonials are tall
      return { eave: 12 + lv * 15, lvEff: lv };
    case 'church': return { eave: 30, lvEff: 2 };
    case 'commercial':
    case 'civic':
      if (areaM2 > 140) lv = Math.max(lv, 3);     // Federal brick blocks: 3+ stories
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
function frontSegment(b: Building, index: WorldIndex): { x: number; z: number; tx: number; tz: number; nx: number; nz: number } {
  const [cx, cz] = centroidOf(b.p);
  const key = Math.floor(cx / CHUNK) + ',' + Math.floor(cz / CHUNK);
  const roads = index.bucket(key).roads;
  let best = { x: cx, z: cz, tx: 1, tz: 0, nx: 0, nz: 1, d: Infinity };
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
        best = { x: mx, z: mz, tx: (x1 - x0) / len, tz: (z1 - z0) / len, nx, nz, d };
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

// Firehouse Center (1823) — brick market house with the white bell cupola
function buildFirehouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 6, g + 40, '#fdfcf8');
  const obb = obbOf(b.p);
  gableRoof(buckets[SHINGLE], buckets[PLAIN], b.p, obb, g + 40, 9, 3, '#544f4a', '#f4f1e6');
  facades(buckets[PLAIN], b.p, g + 40, 2, 1448, true, false, true, g, 40);
  const cx = obb.cx, cz = obb.cz;
  const top = g + 40 + 9;
  walls(buckets[CLAP], [cx - 6, cz - 6, cx + 6, cz - 6, cx + 6, cz + 6, cx - 6, cz + 6], top - 4, top + 14, '#f6f3ea');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    buckets[PLAIN].box(cx + dx * 5.7, cz + dz * 5.7, dx ? 0.4 : 2.2, dz ? 0.4 : 2.2, top + 3, top + 11, '#33352f');
  }
  tmp.set('#3e4140');
  cone(buckets[PLAIN], cx, top + 14, cz, 7.4, 9, tmp.clone());
  buckets[PLAIN].box(cx, cz, 0.35, 0.35, top + 21, top + 29, '#d8d4c8');
}

// City Hall (1851) — brick block, white cornice, central cupola
function buildCityHall(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 6, g + 54, '#fdfcf8');
  const obb = obbOf(b.p);
  walls(buckets[PLAIN], b.p, g + 50, g + 54, '#faf8f0', 0); // cornice band
  gableRoof(buckets[SHINGLE], buckets[PLAIN], b.p, obb, g + 54, 8, 3, '#504c48', '#f4f1e6');
  facades(buckets[PLAIN], b.p, g + 54, 3, 5334, true, false, false, g, 60);
  const f = frontSegment(b, index);
  // shallow front pediment over the entrance bay
  tmp.set('#faf8f0');
  buckets[PLAIN].triUV(
    f.x - f.tx * 12 + f.nx * 1.2, g + 54, f.z - f.tz * 12 + f.nz * 1.2,
    f.x + f.tx * 12 + f.nx * 1.2, g + 54, f.z + f.tz * 12 + f.nz * 1.2,
    f.x + f.nx * 1.2, g + 63, f.z + f.nz * 1.2,
    f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0
  );
  const top = g + 54 + 8;
  walls(buckets[CLAP], [obb.cx - 5, obb.cz - 5, obb.cx + 5, obb.cz - 5, obb.cx + 5, obb.cz + 5, obb.cx - 5, obb.cz + 5], top - 3, top + 11, '#f6f3ea');
  walls(buckets[PLAIN], octRing(obb.cx, obb.cz, 4), top + 11, top + 18, '#f6f3ea', 0);
  tmp.set('#3e4140');
  cone(buckets[PLAIN], obb.cx, top + 18, obb.cz, 5.2, 7, tmp.clone());
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

// March's Hill standpipe — the pale blue water tower on the ridge
function buildWaterTower(buckets: Bucket[], b: Building, g: number) {
  walls(buckets[PLAIN], b.p, g - 2, g + 100, '#c2cdd2', 0);
  walls(buckets[PLAIN], b.p, g + 92, g + 100, '#9aa6ac', 0);
  const [cx, cz] = centroidOf(b.p);
  const obb = obbOf(b.p);
  tmp.set('#aab4b9');
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
function lanternTop(plain: Bucket, cx: number, cz: number, y: number, r: number) {
  flatRoof(plain, octRing(cx, cz, r + 1.6), y, '#23262a');           // gallery deck
  walls(plain, octRing(cx, cz, r + 1.4), y - 1.2, y, '#23262a', 0);
  walls(plain, octRing(cx, cz, r), y, y + 7, '#1d2024', 0);          // lantern glass
  tmp.set('#15181c');
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

// Essex County Superior Court (1805, Bulfinch) — brick block over Bartlet Mall
// with a white four-pilaster pediment front and arched courtroom windows
function buildCourthouse(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[BRICK], b.p, g - 6, g + 46, '#fdfcf8');
  walls(buckets[PLAIN], b.p, g + 43, g + 46, '#faf8f0', 0);
  const obb = obbOf(b.p);
  gableRoof(buckets[SHINGLE], buckets[PLAIN], b.p, obb, g + 46, 7, 3, '#4a4641', '#faf8f0');
  archWindows(buckets[PLAIN], b.p, g + 24, 12, 26);
  archWindows(buckets[PLAIN], b.p, g + 8, 9, 26, 0);
  const f = heroFront(b, index);
  // white temple front tucked under the eave: pilasters, entablature, pediment
  for (const off of [-12, -4, 4, 12]) {
    buckets[PLAIN].box(f.x + f.tx * off + f.nx * 1.4, f.z + f.tz * off + f.nz * 1.4, 1.3, 1.3, g, g + 32, '#f4f1e6');
  }
  rotBox(buckets[PLAIN], f.x + f.nx * 1.6, f.z + f.nz * 1.6, 15, 1.8, g + 32, g + 35.5, Math.atan2(f.tz, f.tx), '#f4f1e6');
  tmp.set('#f4f1e6');
  buckets[PLAIN].triUV(
    f.x - f.tx * 15.5 + f.nx * 2.4, g + 35.5, f.z - f.tz * 15.5 + f.nz * 2.4,
    f.x + f.tx * 15.5 + f.nx * 2.4, g + 35.5, f.z + f.tz * 15.5 + f.nz * 2.4,
    f.x + f.nx * 2.4, g + 44, f.z + f.nz * 2.4,
    f.nx, 0.3, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0
  );
  // arched white entry + dark door + granite stair
  tmp.set('#f1eee4');
  buckets[PLAIN].quad(
    f.x - f.tx * 4.6 + f.nx * 0.7, g, f.z - f.tz * 4.6 + f.nz * 0.7,
    f.x + f.tx * 4.6 + f.nx * 0.7, g, f.z + f.tz * 4.6 + f.nz * 0.7,
    f.x + f.tx * 4.6 + f.nx * 0.7, g + 15, f.z + f.tz * 4.6 + f.nz * 0.7,
    f.x - f.tx * 4.6 + f.nx * 0.7, g + 15, f.z - f.tz * 4.6 + f.nz * 0.7,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  tmp.set('#2e3338');
  buckets[PLAIN].quad(
    f.x - f.tx * 3.2 + f.nx * 1, g, f.z - f.tz * 3.2 + f.nz * 1,
    f.x + f.tx * 3.2 + f.nx * 1, g, f.z + f.tz * 3.2 + f.nz * 1,
    f.x + f.tx * 3.2 + f.nx * 1, g + 13, f.z + f.tz * 3.2 + f.nz * 1,
    f.x - f.tx * 3.2 + f.nx * 1, g + 13, f.z - f.tz * 3.2 + f.nz * 1,
    f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
  );
  rotBox(buckets[PLAIN], f.x + f.nx * 5, f.z + f.nz * 5, 9, 4.5, g, g + 2, Math.atan2(f.tz, f.tx), '#94958f');
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
  walls(buckets[PLAIN], b.p, g - 6, g + 5, '#a8a399', 0);              // base course
  walls(buckets[PLAIN], b.p, g + 5, g + 44, '#cbc5b6', 0);             // ashlar stone
  walls(buckets[PLAIN], b.p, g + 40, g + 44, '#dad5c8', 0);            // deep cornice
  complexGable(buckets[SHINGLE], buckets[PLAIN], b.p, g + 44, '#45423e', '#dad5c8');
  archWindows(buckets[PLAIN], b.p, g + 20, 13, 28);
  const f = heroFront(b, index, { road: 'State Street' });
  // pedimented stone entry
  for (const s of [-1, 1]) {
    buckets[PLAIN].box(f.x + f.tx * 4.4 * s + f.nx * 1.6, f.z + f.tz * 4.4 * s + f.nz * 1.6, 1.2, 1.2, g, g + 16, '#e3dfd3');
  }
  tmp.set('#e3dfd3');
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

// Rear Range Light (1873) — red-brick conical tower tucked off Water Street
function buildRearRange(buckets: Bucket[], b: Building, g: number) {
  const [cx, cz] = centroidOf(b.p);
  walls(buckets[BRICK], octRing(cx, cz, 6.2), g - 4, g + 40, '#fdfcf8');
  walls(buckets[BRICK], octRing(cx, cz, 5.4), g + 40, g + 74, '#fdfcf8');
  walls(buckets[BRICK], octRing(cx, cz, 4.6), g + 74, g + 102, '#fdfcf8');
  lanternTop(buckets[PLAIN], cx, cz, g + 102, 3.4);
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

// the Graf Rink — Low Street's big barrel-roofed hockey barn
function buildGrafRink(buckets: Bucket[], b: Building, g: number) {
  const eave = g + 26;
  walls(buckets[PLAIN], b.p, g - 8, eave, '#d3c9b6', 0);
  const obb = obbOf(b.p);
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const W = obb.hw + 2, rise = Math.min(26, obb.hw * 0.42), S = 6;
  tmp.set('#8e979c');
  const rr = tmp.r, rg = tmp.g, rb = tmp.b;
  const lat: number[] = [], hgt: number[] = [];
  for (let j = 0; j <= S; j++) {
    const a = Math.PI * (j / S);
    lat.push(Math.cos(a) * W);
    hgt.push(eave + Math.sin(a) * rise);
  }
  const pt = (along: number, l: number): [number, number] => [obb.cx + ca * along - sa * l, obb.cz + sa * along + ca * l];
  for (let j = 0; j < S; j++) {
    const dL = lat[j + 1] - lat[j], dH = hgt[j + 1] - hgt[j];
    const ln = Math.hypot(dL, dH) || 1;
    let nl = dH / ln, ny = -dL / ln;
    if (ny < 0) { ny = -ny; nl = -nl; }
    const nx = -sa * nl, nz = ca * nl;
    const a0 = pt(-obb.hl, lat[j]), a1 = pt(obb.hl, lat[j]);
    const b0 = pt(-obb.hl, lat[j + 1]), b1 = pt(obb.hl, lat[j + 1]);
    const shade = 0.82 + 0.18 * Math.max(0, ny);
    buckets[PLAIN].quad(a0[0], hgt[j], a0[1], a1[0], hgt[j], a1[1], b1[0], hgt[j + 1], b1[1], b0[0], hgt[j + 1], b0[1],
      nx, ny, nz, rr * shade, rg * shade, rb * shade);
  }
  // end caps fill the arch above the eave line
  tmp.set('#c5bba8');
  for (const s of [-1, 1]) {
    const c0 = pt(obb.hl * s, 0);
    for (let j = 0; j < S; j++) {
      const p0 = pt(obb.hl * s, lat[j]), p1 = pt(obb.hl * s, lat[j + 1]);
      if (s > 0) {
        buckets[PLAIN].triUV(c0[0], eave, c0[1], p0[0], hgt[j], p0[1], p1[0], hgt[j + 1], p1[1],
          ca, 0, sa, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
      } else {
        buckets[PLAIN].triUV(c0[0], eave, c0[1], p1[0], hgt[j + 1], p1[1], p0[0], hgt[j], p0[1],
          -ca, 0, -sa, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0);
      }
    }
  }
}

// U.S. Coast Guard Station Merrimack River — white station, red roofs, watchtower
function buildCGStation(buckets: Bucket[], b: Building, g: number, index: WorldIndex) {
  walls(buckets[CLAP], b.p, g - 6, g + 32, '#f7f4ec');
  complexGable(buckets[SHINGLE], buckets[CLAP], b.p, g + 32, '#a83a2e', '#f7f4ec');
  houseTrim(buckets[PLAIN], b.p, g + 32, g - 6);
  facades(buckets[PLAIN], b.p, g + 32, 2, 1790, true, false, false, g, 40);
  const obb = obbOf(b.p);
  // square watchtower with a red pyramid cap
  const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
  const tX = obb.cx + ca * (obb.hl * 0.45), tZ = obb.cz + sa * (obb.hl * 0.45);
  walls(buckets[CLAP], [tX - 5, tZ - 5, tX + 5, tZ - 5, tX + 5, tZ + 5, tX - 5, tZ + 5], g + 30, g + 52, '#f7f4ec');
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    buckets[PLAIN].box(tX + dx * 4.8, tZ + dz * 4.8, dx ? 0.4 : 2.6, dz ? 0.4 : 2.6, g + 44, g + 50, '#2c3a42');
  }
  tmp.set('#a83a2e');
  cone(buckets[PLAIN], tX, g + 52, tZ, 6.4, 7, tmp.clone());
  // flagpole on the lawn
  const f = heroFront(b, index);
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
    buckets[PLAIN].box(px, pz, 0.8, 0.8, g + 2, g + 14, '#f5f2e8');
  }
  walls(buckets[PLAIN], octRing(cx, cz, r - 0.6), g + 5.5, g + 7, '#f5f2e8', 0);  // railing
  tmp.set('#8a9298');
  octoCanopy(buckets[PLAIN], cx, g + 16, cz, r + 2, tmp.clone());
  buckets[PLAIN].box(cx, cz, 0.4, 0.4, g + 18, g + 22, '#f5f2e8');
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

const HEROES: Record<string, HeroBuilder> = {
  'Newburyport High School': buildNHS,
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

// alternating colored bulbs strung along the eave line (GLOW bucket = unlit)
function stringLights(bk: Bucket, ring: number[], y: number) {
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
      tmp.set(BULBS[bi++ % BULBS.length]);
      bk.quad(
        wx - ux * 1.05, y - 1.05, wz + uy * 1.05, wx + ux * 1.05, y - 1.05, wz - uy * 1.05,
        wx + ux * 1.05, y + 1.05, wz - uy * 1.05, wx - ux * 1.05, y + 1.05, wz + uy * 1.05,
        nx, 0, nz, tmp.r, tmp.g, tmp.b
      );
    }
  }
}

// pumpkins by the front door — some carved and glowing — plus pots of mums
function pumpkins(buckets: Bucket[], f: { x: number; z: number; tx: number; tz: number; nx: number; nz: number }, g: number, seed: number) {
  const rng = mulberry32(hash32(seed, 91, 7));
  const n = 4 + (hash32(seed, 3, 11) % 4);   // 4–7 pumpkins: a real New England patch
  for (let i = 0; i < n; i++) {
    const off = (i - (n - 1) / 2) * 4.6 + (rng() - 0.5) * 2.2;   // spread across the front
    const px = f.x + f.tx * off + f.nx * (5.2 + (rng() - 0.5) * 2.4);
    const pz = f.z + f.tz * off + f.nz * (5.2 + (rng() - 0.5) * 2.4);
    const r = 3.8 + rng() * 2.6;   // bigger
    tmp.set(rng() < 0.85 ? '#d97a28' : '#e8e2cf');
    octoCanopy(buckets[PLAIN], px, g + r * 0.85, pz, r, tmp.clone());
    buckets[PLAIN].box(px, pz, 0.4, 0.4, g + r * 1.55, g + r * 1.55 + 1.3, '#5e4a28');
    if (rng() < 0.55) {
      // jack-o'-lantern: glowing face toward the street
      const cxf = px + f.nx * (r * 0.92), czf = pz + f.nz * (r * 0.92);
      const ty = g + r * 0.95;
      tmp.set('#ffc14e');
      for (const sd of [-1, 1]) {
        buckets[GLOW].triUV(
          cxf + f.tx * (sd * 0.9 - 0.42), ty, czf + f.tz * (sd * 0.9 - 0.42),
          cxf + f.tx * (sd * 0.9 + 0.42), ty, czf + f.tz * (sd * 0.9 + 0.42),
          cxf + f.tx * sd * 0.9, ty + 0.8, czf + f.tz * sd * 0.9,
          f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b, 0, 0, 0, 0, 0, 0
        );
      }
      buckets[GLOW].quad(
        cxf - f.tx * 1.25, ty - 1.15, czf - f.tz * 1.25, cxf + f.tx * 1.25, ty - 1.15, czf + f.tz * 1.25,
        cxf + f.tx * 1.25, ty - 0.6, czf + f.tz * 1.25, cxf - f.tx * 1.25, ty - 0.6, czf - f.tz * 1.25,
        f.nx, 0, f.nz, tmp.r, tmp.g, tmp.b
      );
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
  const rows = Math.max(2, Math.min(3, Math.round(lvEff)));
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
    // 13 Fox Run Drive — a navy house with a red door (a hello to its owner)
    const isFoxRun = b.k === 'house' && Math.abs(bcx + 18750) < 9 && Math.abs(bcz - 2774) < 9;
    const wallHex = isFoxRun ? '#2a3a57'
      : beachShake ? pick(STYLE.building.wallsShake, seed)
      : beach ? pick(STYLE.building.wallsHouse, seed)
      : wallHexFor(b, seed);
    const isBrick = b.k === 'commercial' || b.k === 'civic';
    const wallBucket = isBrick ? buckets[BRICK]
      : b.k === 'industrial' ? buckets[PLAIN]
      : beachShake ? buckets[SHINGLE]       // weathered cedar-shake cottages
      : buckets[CLAP];                       // painted clapboard — most of the island, like town
    walls(wallBucket, b.p, base, eaveAbs, wallHex);

    const gabled = b.k === 'house' || b.k === 'shed' || b.k === 'church';
    if (gabled) {
      const obb = obbOf(b.p);
      const ridgeH = Math.max(7, Math.min(22, obb.hw * 0.55));
      const roofHex = pick(STYLE.building.roofs, seed);
      complexGable(buckets[SHINGLE], beachShake ? buckets[SHINGLE] : buckets[CLAP], b.p, eaveAbs, roofHex, wallHex);
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
      if (b.k !== 'shed' && rng() < 0.4) {
        const [cx, cz] = centroidOf(b.p);
        buckets[PLAIN].box(cx + (rng() - 0.5) * 8, cz + (rng() - 0.5) * 8, 3, 4, eaveAbs, eaveAbs + 5, '#8e9296');
      }
    }

    if (b.k !== 'shed') {
      const storefront = b.k === 'commercial' || !!b.sf;
      const rows = b.k === 'house' ? (lvEff >= 2 ? 2 : 1) : Math.max(2, Math.min(4, Math.round(lvEff)));
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
    } else if (SEASON === 'fall') {
      const porch = b.k === 'house' ? hash32(seed, 23, 5) % 100 < 88
        : (b.k === 'commercial' || !!b.sf) && hash32(seed, 23, 5) % 100 < 65;
      if (porch) pumpkins(buckets, frontSegment(b, index), g, seed);
    }
  }

  const bucket = index.bucket(key);
  for (const ri of bucket.roads) {
    const r = world.roads[ri];
    if (!r.b) continue;
    // paved deck following the clearance profile — humps over roads it crosses
    // and lifts clear of any water it spans (the Gillis channel is left open for
    // the custom drawbridge)
    ribbonDeck(buckets, r.p, r.w + 4, (x, z) => index.bridgeDeckYAt(r.p, x, z), true, ox, oy, true);
    // hold the slab up: pier WALLS marching the span (turned across the deck, capped
    // under the soffit) + full-width abutments at the banks. One (x,z) each + the
    // chunk cull below ⇒ emitted in exactly one chunk.
    const sup = index.bridgeProfile(r.p).supports;
    const hw = (r.w + 4) / 2;
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
      walls(buckets[PLANK], poly.p, 0, PIER_DECK_Y, '#9a7a4e', 0);
      flatRoofPlank(buckets[PLANK], poly.p, PIER_DECK_Y);
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

  // parked cars filling the real lots, in rows aligned to each lot
  for (const pi of bucket.polys) {
    const poly = world.polys[pi];
    if (poly.k !== 'parking') continue;
    const obb = obbOf(poly.p);
    if (obb.hw < 16 || obb.hl < 20) continue;
    const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
    const noseA = obb.ang + Math.PI / 2;
    const nx2 = Math.cos(noseA), nz2 = Math.sin(noseA);
    let cars = 0;
    for (let w0 = -obb.hw + 24; w0 <= obb.hw - 24 && cars < 110; w0 += 78) {
      for (let l0 = -obb.hl + 16; l0 <= obb.hl - 16 && cars < 110; l0 += 22) {
        const x = obb.cx + l0 * ca - w0 * sa;
        const z = obb.cz + l0 * sa + w0 * ca;
        if (x < ox || x >= ox + CHUNK || z < oy || z >= oy + CHUNK) continue;
        const h2 = hash32(Math.round(x * 2), Math.round(z * 2), 97);
        if (h2 % 100 > 47) continue;
        if (!pointInPolyD(x, z, poly)) continue;
        if (!pointInPolyD(x + nx2 * 11, z + nz2 * 11, poly) || !pointInPolyD(x - nx2 * 11, z - nz2 * 11, poly)) continue;
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

  // boats tied up along the real mooring docks
  for (const pi of bucket.paths) {
    const p = world.paths[pi];
    if (!p.m) continue;
    let flip = 1;
    walkLineD(p.p, 116, (x, z, tx, tz) => {
      flip = -flip;
      const h2 = hash32(Math.round(x), Math.round(z), 23);
      if (h2 % 100 > 62) return;
      const off = Math.max(p.w, 18) / 2 + 22;
      const bx = x - tz * flip * off, bz = z + tx * flip * off;
      if (bx < ox || bx >= ox + CHUNK || bz < oy || bz >= oy + CHUNK) return;
      if (!index.isWaterAt(bx, bz)) return;
      if (index.heightAtPx(bx, bz) > WATER_Y - 0.5) return; // exposed flat — would beach
      boat(buckets[PLAIN], bx, bz, Math.atan2(tz, tx), h2);
    });
  }
  for (const pi of bucket.polys) {
    const poly = world.polys[pi];
    if (poly.k !== 'pier' || !poly.m) continue;
    const ring = poly.p.concat(poly.p.slice(0, 2));
    let placed = 0;
    walkLineD(ring, 104, (x, z, tx, tz) => {
      if (placed >= 3) return;
      const h2 = hash32(Math.round(x), Math.round(z), 29);
      if (h2 % 100 > 55) return;
      for (const s of [1, -1]) {
        const bx = x - tz * s * 24, bz = z + tx * s * 24;
        if (!index.isWaterAt(bx, bz)) continue;
        if (index.heightAtPx(bx, bz) > WATER_Y - 0.5) continue; // exposed flat — would beach
        if (bx < ox || bx >= ox + CHUNK || bz < oy || bz >= oy + CHUNK) break;
        boat(buckets[PLAIN], bx, bz, Math.atan2(tz, tx), h2);
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

  // MBTA commuter-rail train parked at the Newburyport station platform
  const ST_X = -5450, ST_Z = 11790;
  if (Math.floor(ST_X / CHUNK) === ckx && Math.floor(ST_Z / CHUNK) === cky) {
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
    if (poi.k !== 'windsock') continue;
    if (poi.x < ox || poi.x >= ox + CHUNK || poi.y < oy || poi.y >= oy + CHUNK) continue;
    const g = index.heightAtPx(poi.x, poi.y);
    const a = ((hash32(Math.round(poi.x), 7) % 100) / 100) * Math.PI * 2;
    buckets[PLAIN].box(poi.x, poi.y, 0.6, 0.6, g, g + 20, '#d8d5cc');
    rotBox(buckets[PLAIN], poi.x + Math.cos(a) * 4, poi.y + Math.sin(a) * 4, 4, 1.4, g + 17, g + 19.4, a, '#e8762e');
    rotBox(buckets[PLAIN], poi.x + Math.cos(a) * 9.5, poi.y + Math.sin(a) * 9.5, 2.2, 0.9, g + 17.6, g + 18.9, a, '#e8762e');
  }

  // real property-line barriers: stockade fences, hedges, stone walls
  for (const bi of bucket.barriers) {
    const bar = world.barriers[bi];
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

  // dune grass on sand + beach kit (umbrellas, towels) on the ocean side
  for (const pi of bucket.polys) {
    const poly = world.polys[pi];
    if (poly.k !== 'sand' && poly.k !== 'island') continue;
    scatterInPoly(poly, pi + 313, 80, 0.5, ox, oy, (x, z, rng) => {
      const gg = index.heightAtPx(x, z);
      const g = new THREE.Color('#b4ae72').multiplyScalar(0.85 + rng() * 0.3);
      const h = 7 + rng() * 5;
      buckets[PLAIN].quad(x - 4, gg, z, x + 4, gg, z, x + 2.5, gg + h, z, x - 2.5, gg + h, z, 0, 0, 1, g.r, g.g, g.b);
      buckets[PLAIN].quad(x, gg, z - 4, x, gg, z + 4, x, gg + h, z + 2.5, x, gg + h, z - 2.5, 1, 0, 0, g.r * 0.9, g.g * 0.9, g.b * 0.9);
    }, 240);
    if (poly.k === 'sand') {
      scatterInPoly(poly, pi + 717, 170, 0.22, ox, oy, (x, z, rng) => {
        if (x < BEACH_X) return;
        const gg = index.heightAtPx(x, z);
        const umb = pick(['#d8543f', '#3f7fc4', '#e0b53c', '#52a06b', '#c84a6b'], Math.round(x + z));
        walls(buckets[PLAIN], [x - 0.9, z - 0.9, x + 0.9, z - 0.9, x + 0.9, z + 0.9, x - 0.9, z + 0.9], gg, gg + 15, '#ece8dc', 0);
        tmp.set(umb);
        cone(buckets[PLAIN], x, gg + 14, z, 11.5, 6.5, tmp.clone());
        if (rng() < 0.7) {
          flatQuad(buckets[PLAIN], x + 14 + rng() * 6, z + (rng() - 0.5) * 16, 9.5, 4.5, gg + 0.5, rng() * Math.PI, pick(['#e06a5a', '#4a90c2', '#ecd06f', '#6cb087', '#d889a8'], Math.round(z + x * 3)));
        }
      }, 12);
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
