import type { WorldData, Poly, Road, PathSeg, Label, Building } from './types';
import { STYLE, SEASON, hash32, mulberry32 } from './style';
import { Terrain } from './terrain';
import { isFreezableWater, WATER_Y } from '../three/water';

// a bridge's structural plan, computed once per span and cached (see bridgeProfile):
// the deck-TOP height profile plus the discrete supports that hold the slab up
type BridgeSupport = { x: number; z: number; footY: number; topY: number; ux: number; uz: number };
type BridgeProfile = {
  base: number;
  cum: number[];
  bumps: { t: number; peak: number }[];
  water?: { s: number; e: number };
  supports: { piers: BridgeSupport[]; abut: BridgeSupport[] };
};

// ---------- terrain patterns (grass looks like grass, sand like sand...) ----------

const patternCanvasCtx = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  return c.getContext('2d')!;
})();
const patternCache = new Map<string, CanvasPattern>();

function tint(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

const GRASSY = new Set(['land', 'grass', 'park', 'cemetery', 'pitch', 'reserve', 'wood', 'scrub', 'island', 'wetland', 'airfield']);

// asphalt with aggregate, cracks, and repair patches — per road-class color
export function roadFill(hex: string): CanvasPattern {
  const key = 'road:' + hex;
  const hit = patternCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = hex;
  g.fillRect(0, 0, 128, 128);
  const rng = mulberry32(hash32(hex.charCodeAt(1), hex.charCodeAt(3), 13));
  // repair patches
  for (let i = 0; i < 3; i++) {
    g.fillStyle = tint(hex, rng() < 0.5 ? -0.1 : 0.07);
    g.globalAlpha = 0.5;
    g.fillRect(rng() * 128, rng() * 128, 18 + rng() * 30, 12 + rng() * 22);
    g.globalAlpha = 1;
  }
  // aggregate speckle
  for (let i = 0; i < 420; i++) {
    g.fillStyle = tint(hex, (rng() - 0.45) * 0.22);
    g.fillRect(rng() * 128, rng() * 128, 1.4, 1.4);
  }
  // cracks
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    g.strokeStyle = tint(hex, -0.25);
    g.globalAlpha = 0.5;
    let x = rng() * 128, y = rng() * 128;
    g.beginPath();
    g.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (rng() - 0.5) * 22;
      y += 6 + rng() * 12;
      g.lineTo(x, y);
    }
    g.stroke();
    g.globalAlpha = 1;
  }
  const p = patternCanvasCtx.createPattern(c, 'repeat')!;
  patternCache.set(key, p);
  return p;
}

// granular concrete for sidewalks
function concreteFill(): CanvasPattern {
  const hit = patternCache.get('concrete');
  if (hit) return hit;
  const base = SEASON === 'winter' ? '#e4e8eb' : '#d2d1cb';
  const c = document.createElement('canvas');
  c.width = c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 96, 96);
  const rng = mulberry32(hash32(77, 11, 31));
  for (let i = 0; i < 340; i++) {
    g.fillStyle = tint(base, (rng() - 0.5) * 0.16);
    g.fillRect(rng() * 96, rng() * 96, 1.3, 1.3);
  }
  for (let i = 0; i < 5; i++) {
    g.fillStyle = tint(base, -0.06);
    g.globalAlpha = 0.5;
    g.beginPath();
    g.arc(rng() * 96, rng() * 96, 5 + rng() * 9, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  const p = patternCanvasCtx.createPattern(c, 'repeat')!;
  patternCache.set('concrete', p);
  return p;
}

function terrainFill(kind: string): string | CanvasPattern {
  const base = kind === 'land' ? STYLE.land : (STYLE.poly[kind] || STYLE.land);
  if (kind === 'water' || kind === 'ocean' || kind === 'fountain' || kind === 'stone') return base;
  const hit = patternCache.get(kind);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 192;
  const g = c.getContext('2d')!;
  g.fillStyle = base;
  g.fillRect(0, 0, 192, 192);
  const rng = mulberry32(hash32(kind.charCodeAt(0), kind.length, 97));
  if (GRASSY.has(kind)) {
    // soft mottling so lawns aren't a flat tone
    for (let i = 0; i < 9; i++) {
      g.fillStyle = tint(base, (rng() - 0.5) * 0.14);
      g.globalAlpha = 0.4;
      g.beginPath();
      g.arc(rng() * 192, rng() * 192, 16 + rng() * 34, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
    for (let i = 0; i < 480; i++) {
      g.fillStyle = tint(base, (rng() - 0.5) * 0.24);
      g.fillRect(rng() * 192, rng() * 192, 1.7, 1.7);
    }
    g.lineWidth = 1.1;
    for (let i = 0; i < 170; i++) {
      const x = rng() * 192, y = rng() * 192;
      g.strokeStyle = tint(base, rng() < 0.5 ? -0.18 : 0.16);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng() - 0.5) * 2.2, y - 2.5 - rng() * 2.8);
      g.stroke();
    }
    if (kind === 'pitch') {
      g.fillStyle = 'rgba(255,255,255,0.06)';
      for (let band = 0; band < 192; band += 24) g.fillRect(0, band, 192, 12);
    }
    if (SEASON === 'fall') {
      // fallen leaves drifting across every lawn
      const leaves = ['#c9742e', '#d99a3a', '#b85a2e', '#caa544', '#a8512a'];
      for (let i = 0; i < 130; i++) {
        g.fillStyle = leaves[(i * 7) % leaves.length];
        g.globalAlpha = 0.55 + rng() * 0.35;
        const lx = rng() * 192, ly = rng() * 192;
        g.fillRect(lx, ly, 1.6 + rng() * 1.4, 1.4 + rng() * 1.2);
      }
      g.globalAlpha = 1;
    }
  } else if (kind === 'sand' || kind === 'playground') {
    for (let i = 0; i < 850; i++) {
      g.fillStyle = tint(base, (rng() - 0.5) * 0.2);
      g.fillRect(rng() * 192, rng() * 192, 1.3, 1.3);
    }
    g.lineWidth = 1;
    g.strokeStyle = tint(base, -0.08);
    for (let i = 0; i < 9; i++) {
      const y = rng() * 192;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(48, y + 5, 96, y - 5, 192, y + 2);
      g.stroke();
    }
    // wandering footprint trails
    for (let t = 0; t < 3; t++) {
      let fx = rng() * 192, fy = rng() * 192;
      let ang = rng() * Math.PI * 2;
      g.fillStyle = tint(base, -0.14);
      g.globalAlpha = 0.55;
      for (let s = 0; s < 7; s++) {
        const side = s % 2 === 0 ? 1 : -1;
        g.beginPath();
        g.ellipse(fx + Math.cos(ang + Math.PI / 2) * side * 2.4, fy + Math.sin(ang + Math.PI / 2) * side * 2.4, 1.4, 2.6, ang, 0, Math.PI * 2);
        g.fill();
        fx += Math.cos(ang) * 7;
        fy += Math.sin(ang) * 7;
        ang += (rng() - 0.5) * 0.5;
      }
      g.globalAlpha = 1;
    }
  } else if (kind === 'plaza') {
    g.strokeStyle = tint(base, 0.22);
    g.lineWidth = 1;
    for (let y = 0; y < 192; y += 6) {
      g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(192, y + 0.5); g.stroke();
      const off = (y / 6) % 2 === 0 ? 0 : 7;
      for (let x = off; x < 192 + 14; x += 14) {
        g.beginPath(); g.moveTo(x + 0.5, y); g.lineTo(x + 0.5, y + 6); g.stroke();
      }
    }
    for (let i = 0; i < 110; i++) {
      g.fillStyle = tint(base, (rng() - 0.5) * 0.14);
      g.globalAlpha = 0.5;
      g.fillRect(Math.floor(rng() * 14) * 14, Math.floor(rng() * 32) * 6 + 1, 13, 5);
      g.globalAlpha = 1;
    }
  } else if (kind === 'parking') {
    for (let i = 0; i < 620; i++) {
      g.fillStyle = tint(base, (rng() - 0.5) * 0.13);
      g.fillRect(rng() * 192, rng() * 192, 1.5, 1.5);
    }
    // faded oil stains
    for (let i = 0; i < 6; i++) {
      g.fillStyle = tint(base, -0.12);
      g.globalAlpha = 0.35;
      g.beginPath();
      g.arc(rng() * 192, rng() * 192, 3 + rng() * 6, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
  } else if (kind === 'pier') {
    g.strokeStyle = tint(base, -0.18);
    g.lineWidth = 1;
    for (let y = 0; y < 192; y += 5) {
      g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(192, y + 0.5); g.stroke();
    }
  }
  const p = patternCanvasCtx.createPattern(c, 'repeat')!;
  patternCache.set(kind, p);
  return p;
}

export const CHUNK = 768;        // world px per chunk (96 m at 8 px/m)
const COLL_RES = 8;              // collision cell = 8 px = 1 m
const BUCKET_MARGIN = 320;

const ROAD_RANK: Record<string, number> = {
  service: 0, living_street: 1, residential: 2, unclassified: 2, busway: 3,
  tertiary: 3, secondary: 4, primary: 5, trunk: 6, motorway: 7
};

export interface Bucket {
  polys: number[];
  buildings: number[];
  roads: number[];
  paths: number[];
  rails: number[];
  labels: number[];
  barriers: number[];
  rtrees: number[];
  power: number[];
}

export interface Tree {
  x: number;
  y: number;     // world "south" axis (becomes z in 3D)
  r: number;
  bush: boolean;
}

export interface Driveway {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  car: boolean;
  carT: number;  // car position along the driveway (0..1)
  seed: number;
}

export const FREE = 0, BLOCKED = 1, SLOW = 2;

// fitted oriented box + (for baseball) the home-plate fan geometry
export interface PitchLayout {
  kind: string;
  cx: number; cz: number; ang: number; hl: number; hw: number;
  hx: number; hy: number;            // baseball: home plate corner
  u1x: number; u1y: number;          // foul-line directions (unit)
  u2x: number; u2y: number;
  base: number;                      // basepath length px
}

export interface ShopSign {
  x: number;
  z: number;
  name: string;
  rotY: number;
}

export class WorldIndex {
  world: WorldData;
  terrain: Terrain;
  buckets = new Map<string, Bucket>();
  private collision = new Map<string, Uint8Array>();
  private treeCache = new Map<string, Tree[]>();
  private plantingCache = new Map<string, Tree[]>();
  private signCache = new Map<string, ShopSign[]>();
  private poiBuckets = new Map<string, number[]>();

  heightAtPx(x: number, z: number): number {
    return this.terrain.heightAt(x, z);
  }

  constructor(world: WorldData, terrain: Terrain) {
    this.world = world;
    this.terrain = terrain;
    world.pois.forEach((p, i) => {
      const key = Math.floor(p.x / CHUNK) + ',' + Math.floor(p.y / CHUNK);
      let list = this.poiBuckets.get(key);
      if (!list) {
        list = [];
        this.poiBuckets.set(key, list);
      }
      list.push(i);
    });
    const add = (pts: number[], margin: number, push: (b: Bucket) => void) => {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] < minX) minX = pts[i];
        if (pts[i] > maxX) maxX = pts[i];
        if (pts[i + 1] < minY) minY = pts[i + 1];
        if (pts[i + 1] > maxY) maxY = pts[i + 1];
      }
      const c0x = Math.floor((minX - margin) / CHUNK), c1x = Math.floor((maxX + margin) / CHUNK);
      const c0y = Math.floor((minY - margin) / CHUNK), c1y = Math.floor((maxY + margin) / CHUNK);
      for (let cy = c0y; cy <= c1y; cy++) {
        for (let cx = c0x; cx <= c1x; cx++) {
          const key = cx + ',' + cy;
          let b = this.buckets.get(key);
          if (!b) {
            b = { polys: [], buildings: [], roads: [], paths: [], rails: [], labels: [], barriers: [], rtrees: [], power: [] };
            this.buckets.set(key, b);
          }
          push(b);
        }
      }
    };
    world.polys.forEach((f, i) => add(f.p, BUCKET_MARGIN, (b) => b.polys.push(i)));
    world.buildings.forEach((f, i) => add(f.p, 60, (b) => b.buildings.push(i)));
    world.roads.forEach((f, i) => add(f.p, f.w + 80, (b) => b.roads.push(i)));
    world.paths.forEach((f, i) => add(f.p, f.w + 60, (b) => b.paths.push(i)));
    world.rails.forEach((f, i) => add(f.p, 60, (b) => b.rails.push(i)));
    world.labels.forEach((f, i) => add([f.x, f.y], 360, (b) => b.labels.push(i)));
    (world.barriers || []).forEach((f, i) => add(f.p, 40, (b) => b.barriers.push(i)));
    (world.trees || []).forEach((f, i) => add([f.x, f.y], 40, (b) => b.rtrees.push(i)));
    (world.power || []).forEach((f, i) => add(f.p, 40, (b) => b.power.push(i)));

    // Storefront pre-pass: a building that HOSTS a shop/food POI gets a
    // storefront ground floor (display glass, door, awning, sign band). The
    // offline pipeline only checked standalone POI *nodes*, so businesses tagged
    // directly on the building way (amenity=cafe on The Angry Donut, Oregano's,
    // etc.) were missed and rendered as blank walls. Flag them from the POIs.
    const RETAIL_POI = new Set(['shop', 'restaurant', 'cafe', 'fast_food', 'bar', 'pub',
      'ice_cream', 'bakery', 'supermarket', 'deli', 'confectionery', 'bank']);
    for (const poi of world.pois) {
      if (!RETAIL_POI.has(poi.k)) continue;
      const cell = this.buckets.get(Math.floor(poi.x / CHUNK) + ',' + Math.floor(poi.y / CHUNK));
      if (!cell) continue;
      // pick the most specific host: among buildings that CONTAIN the POI, the
      // one whose centroid is nearest (a small business unit beats a big block
      // that merely overlaps it — The Angry Donut sits inside a larger footprint
      // too); otherwise the nearest building within 30px.
      let host = -1, bestInside = Infinity, near = -1, nearD2 = 30 * 30;
      for (const bi of cell.buildings) {
        const pts = world.buildings[bi].p;
        if (pointInRing(poi.x, poi.y, pts)) {
          const [cx, cy] = centroidOf(pts);
          const d2 = (cx - poi.x) * (cx - poi.x) + (cy - poi.y) * (cy - poi.y);
          if (d2 < bestInside) { bestInside = d2; host = bi; }
        } else {
          const d2 = distToPolylineSq(poi.x, poi.y, pts);
          if (d2 < nearD2) { nearD2 = d2; near = bi; }
        }
      }
      if (host < 0) host = near;
      if (host >= 0) world.buildings[host].sf = 1;
    }
  }

  bucket(key: string): Bucket {
    return this.buckets.get(key) || { polys: [], buildings: [], roads: [], paths: [], rails: [], labels: [], barriers: [], rtrees: [], power: [] };
  }

  // buildings owned by this chunk (centroid inside) — prevents duplicate 3D meshes
  buildingsOwned(key: string): { idx: number; b: Building }[] {
    const [cx, cy] = key.split(',').map(Number);
    const out: { idx: number; b: Building }[] = [];
    for (const bi of this.bucket(key).buildings) {
      const b = this.world.buildings[bi];
      const [mx, my] = centroidOf(b.p);
      if (Math.floor(mx / CHUNK) === cx && Math.floor(my / CHUNK) === cy) out.push({ idx: bi, b });
    }
    return out;
  }

  // deterministic trees owned by this chunk — never on pavement or inside buildings
  treesFor(key: string): Tree[] {
    const cached = this.treeCache.get(key);
    if (cached) return cached;
    const [cx, cy] = key.split(',').map(Number);
    const ox = cx * CHUNK, oy = cy * CHUNK;
    const density: Record<string, number> = { wood: 1.3, scrub: 0.9, park: 0.6, cemetery: 0.55, island: 0.5, reserve: 0.4 };
    const out: Tree[] = [];
    const cell = 96;
    const bucket = this.bucket(key);
    // real surveyed trees first — they own their spots (but even surveyed points
    // drift: never render one in the water or on a ballfield)
    for (const ti of bucket.rtrees) {
      const rt = this.world.trees[ti];
      if (Math.floor(rt.x / CHUNK) !== cx || Math.floor(rt.y / CHUNK) !== cy) continue;
      if (this.isWaterAt(rt.x, rt.y) || this.onClearedGround(rt.x, rt.y, bucket)) continue;
      out.push({ x: rt.x, y: rt.y, r: 9 + (hash32(rt.x, rt.y) % 7), bush: false });
    }
    const realCount = out.length;
    const nearReal = (x: number, y: number) => {
      for (let i = 0; i < realCount; i++) {
        const t = out[i];
        if ((t.x - x) ** 2 + (t.y - y) ** 2 < 26 * 26) return true;
      }
      return false;
    };
    for (const pi of bucket.polys) {
      const poly = this.world.polys[pi];
      const d = density[poly.k];
      if (!d) continue;
      const [bx0, by0, bx1, by1] = bboxOf(poly.p);
      const x0 = Math.max(ox, bx0), x1 = Math.min(ox + CHUNK, bx1);
      const y0 = Math.max(oy, by0), y1 = Math.min(oy + CHUNK, by1);
      if (x1 <= x0 || y1 <= y0) continue;
      const isBush = poly.k === 'scrub';
      for (let gy = Math.floor(y0 / cell); gy * cell < y1; gy++) {
        for (let gx = Math.floor(x0 / cell); gx * cell < x1; gx++) {
          const rng = mulberry32(hash32(pi + 7777, gx, gy));
          const count = rng() < d ? 1 + Math.floor(rng() * 2) + (d > 1 ? 1 : 0) : 0;
          for (let i = 0; i < count; i++) {
            const x = gx * cell + rng() * cell;
            const y = gy * cell + rng() * cell;
            // ownership: tree belongs to the chunk containing it
            if (x < ox || x >= ox + CHUNK || y < oy || y >= oy + CHUNK) continue;
            if (!pointInPoly(x, y, poly)) continue;
            if (this.onPavementOrBuilding(x, y, bucket)) continue;
            if (this.onClearedGround(x, y, bucket)) continue;
            if (this.isWaterAt(x, y)) continue; // wood/marsh polys overlap tidal water
            if (nearReal(x, y)) continue;
            const r = isBush ? 5 + rng() * 4 : 9 + rng() * 7;
            out.push({ x, y, r, bush: isBush });
          }
        }
      }
      if (out.length > 900) break;
    }
    // suburban fill: in real life every gap between houses is trees and shrubs.
    // Fill clear ground NEAR buildings — genuinely open fields stay open because
    // nothing is built around them.
    {
      const fillCell = 42;
      const homes: [number, number][] = [];
      for (const bi of bucket.buildings) {
        homes.push(centroidOf(this.world.buildings[bi].p));
      }
      if (homes.length) {
        for (let gy = Math.floor(oy / fillCell); gy * fillCell < oy + CHUNK && out.length < 1100; gy++) {
          for (let gx = Math.floor(ox / fillCell); gx * fillCell < ox + CHUNK && out.length < 1100; gx++) {
            const rng = mulberry32(hash32(gx, gy, 4242));
            if (rng() > 0.9) continue;
            const x = gx * fillCell + rng() * fillCell;
            const y = gy * fillCell + rng() * fillCell;
            if (x < ox || x >= ox + CHUNK || y < oy || y >= oy + CHUNK) continue;
            let near = false;
            for (const [hx, hy] of homes) {
              if ((hx - x) ** 2 + (hy - y) ** 2 < 210 * 210) { near = true; break; }
            }
            if (!near) continue;
            if (this.onPavementOrBuilding(x, y, bucket)) continue;
            if (this.onClearedGround(x, y, bucket)) continue;
            if (this.isWaterAt(x, y)) continue;
            if (nearReal(x, y)) continue;
            const bush = rng() < 0.42;
            out.push({ x, y, r: bush ? 3.5 + rng() * 3.5 : 8 + rng() * 8, bush });
          }
        }
      }
    }
    this.treeCache.set(key, out);
    return out;
  }

  // street trees along neighborhood roads + yard trees + foundation bushes
  extraPlantingsFor(key: string): Tree[] {
    const cached = this.plantingCache.get(key);
    if (cached) return cached;
    const [ckx, cky] = key.split(',').map(Number);
    const ox = ckx * CHUNK, oy = cky * CHUNK;
    const out: Tree[] = [];
    const bucket = this.bucket(key);
    const seen = new Set<number>();
    for (const ri of bucket.roads) {
      if (seen.has(ri)) continue;
      seen.add(ri);
      const r = this.world.roads[ri];
      if (!['residential', 'unclassified', 'living_street', 'tertiary'].includes(r.c)) continue;
      walkLine(r.p, 88, (x, y, nx, ny) => {
        for (const s of [1, -1]) {
          const px = x - ny * s * (r.w / 2 + 14);
          const py = y + nx * s * (r.w / 2 + 14);
          if (px < ox || px >= ox + CHUNK || py < oy || py >= oy + CHUNK) continue;
          const rng = mulberry32(hash32(Math.round(px), Math.round(py), 55));
          if (rng() > 0.65) continue;
          if (this.onPavementOrBuilding(px, py, bucket)) continue;
          if (this.isWaterAt(px, py) || this.onClearedGround(px, py, bucket)) continue;
          out.push({ x: px, y: py, r: 8 + rng() * 6, bush: false });
        }
      });
    }
    for (const { idx, b } of this.buildingsOwned(key)) {
      if (b.k !== 'house') continue;
      const rng = mulberry32(hash32(idx, 77, 5));
      const pts = b.p;
      const n = pts.length / 2;
      // foundation bushes along the footprint
      const bushes = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < bushes; i++) {
        const e = Math.floor(rng() * n);
        const t = rng();
        const ax = pts[e * 2], ay = pts[e * 2 + 1];
        const bx = pts[((e + 1) % n) * 2], by = pts[((e + 1) % n) * 2 + 1];
        const exx = bx - ax, eyy = by - ay;
        const len = Math.hypot(exx, eyy) || 1;
        const px = ax + exx * t + (eyy / len) * 7;
        const py = ay + eyy * t - (exx / len) * 7;
        if (this.onPavementOrBuilding(px, py, bucket)) continue;
        if (this.isWaterAt(px, py) || this.onClearedGround(px, py, bucket)) continue;
        out.push({ x: px, y: py, r: 3.5 + rng() * 2.5, bush: true });
      }
      // yard canopy: New England yards carry real trees, plus shrubs at the
      // lot edges — 1-3 trees and 2-5 shrubs per house
      const [cx2, cy2] = centroidOf(pts);
      const yardTrees = 1 + Math.floor(rng() * 3);
      for (let i = 0; i < yardTrees; i++) {
        const a = rng() * Math.PI * 2;
        const d = 32 + rng() * 52;
        const px = cx2 + Math.cos(a) * d, py = cy2 + Math.sin(a) * d;
        if (!this.onPavementOrBuilding(px, py, bucket)
          && !this.isWaterAt(px, py) && !this.onClearedGround(px, py, bucket)) {
          out.push({ x: px, y: py, r: 8 + rng() * 7, bush: false });
        }
      }
      const shrubs = 2 + Math.floor(rng() * 4);
      for (let i = 0; i < shrubs; i++) {
        const a = rng() * Math.PI * 2;
        const d = 20 + rng() * 42;
        const px = cx2 + Math.cos(a) * d, py = cy2 + Math.sin(a) * d;
        if (!this.onPavementOrBuilding(px, py, bucket)
          && !this.isWaterAt(px, py) && !this.onClearedGround(px, py, bucket)) {
          out.push({ x: px, y: py, r: 3 + rng() * 3.2, bush: true });
        }
      }
    }
    const capped = out.slice(0, 800);
    this.plantingCache.set(key, capped);
    return capped;
  }

  // street lamps along main streets and the pedestrian mall
  private lampCache = new Map<string, { x: number; y: number }[]>();

  lampsFor(key: string): { x: number; y: number }[] {
    const cached = this.lampCache.get(key);
    if (cached) return cached;
    const [ckx, cky] = key.split(',').map(Number);
    const ox = ckx * CHUNK, oy = cky * CHUNK;
    const out: { x: number; y: number }[] = [];
    const bucket = this.bucket(key);
    const seen = new Set<number>();
    for (const ri of bucket.roads) {
      if (seen.has(ri)) continue;
      seen.add(ri);
      const r = this.world.roads[ri];
      if (!['primary', 'secondary', 'tertiary', 'residential'].includes(r.c)) continue;
      let side = hash32(ri) % 2 === 0 ? 1 : -1;
      walkLine(r.p, 150, (x, y, nx, ny) => {
        side = -side;
        const px = x - ny * side * (r.w / 2 + 9);
        const py = y + nx * side * (r.w / 2 + 9);
        if (px < ox || px >= ox + CHUNK || py < oy || py >= oy + CHUNK) return;
        if (this.onRoadway(px, py, bucket)) return; // intersections: never stand in another street
        for (const bi of bucket.buildings) {
          if (pointInRing(px, py, this.world.buildings[bi].p)) return;
        }
        out.push({ x: px, y: py });
      });
    }
    for (const pi of bucket.paths) {
      const p = this.world.paths[pi];
      if (p.c !== 'ped' && p.c !== 'board') continue; // Inn Street mall + the boardwalk get lamps too
      let side = hash32(pi) % 2 === 0 ? 1 : -1;
      walkLine(p.p, p.c === 'board' ? 170 : 130, (x, y, nx, ny) => {
        side = -side;
        // boardwalk lamps stand ON the deck edge; mall lamps just off the bricks
        const off = p.c === 'board' ? Math.max(2, p.w / 2 - 4) : p.w / 2 + 5;
        const px = x - ny * side * off, py = y + nx * side * off;
        if (px < ox || px >= ox + CHUNK || py < oy || py >= oy + CHUNK) return;
        if (this.onRoadway(px, py, bucket)) return;
        out.push({ x: px, y: py });
      });
    }
    const capped = out.slice(0, 90);
    this.lampCache.set(key, capped);
    return capped;
  }

  // white picket fences along front yards (anchored to the driveway's street end)
  private fenceCache = new Map<string, { x0: number; y0: number; x1: number; y1: number }[]>();

  fencesFor(key: string): { x0: number; y0: number; x1: number; y1: number }[] {
    const cached = this.fenceCache.get(key);
    if (cached) return cached;
    const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const bucket = this.bucket(key);
    for (const dr of this.drivewaysFor(key)) {
      const rng = mulberry32(hash32(dr.seed, 17, 23));
      if (rng() > 0.45) continue;
      // a real mapped barrier nearby wins — skip the synthetic picket fence
      let hasReal = false;
      for (const bi of bucket.barriers) {
        if (distToPolylineSq(dr.x1, dr.y1, this.world.barriers[bi].p) < 70 * 70) { hasReal = true; break; }
      }
      if (hasReal) continue;
      const dx = dr.x1 - dr.x0, dy = dr.y1 - dr.y0;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len;
      const pxn = -uy, pyn = ux; // parallel to the street
      const bx = dr.x1 - ux * 9, by = dr.y1 - uy * 9; // pulled back into the yard
      const reach = 26 + rng() * 18;
      out.push(
        { x0: bx + pxn * 13, y0: by + pyn * 13, x1: bx + pxn * (13 + reach), y1: by + pyn * (13 + reach) },
        { x0: bx - pxn * 13, y0: by - pyn * 13, x1: bx - pxn * (13 + reach), y1: by - pyn * (13 + reach) }
      );
    }
    this.fenceCache.set(key, out);
    return out;
  }

  // real stores mounted on their real buildings (from OSM POI nodes)
  shopSignsFor(key: string): ShopSign[] {
    const cached = this.signCache.get(key);
    if (cached) return cached;
    const SIGN_KINDS = new Set(['shop', 'restaurant', 'cafe', 'fast_food', 'pub', 'bar', 'bank', 'pharmacy',
      'ice_cream', 'theatre', 'cinema', 'gallery', 'hotel', 'guest_house', 'marketplace', 'bicycle_rental',
      'dance', 'dentist', 'doctors', 'veterinary', 'fuel', 'library', 'community_centre']);
    const out: ShopSign[] = [];
    const bucket = this.bucket(key);
    // street-facing test: edge midpoint near a real road
    const roadDist2 = (x: number, y: number) => {
      let best = Infinity;
      for (const ri of bucket.roads) {
        const r = this.world.roads[ri];
        if (r.c === 'service') continue;
        best = Math.min(best, distToPolylineSq(x, y, r.p));
      }
      return best;
    };
    for (const pi of this.poiBuckets.get(key) || []) {
      const poi = this.world.pois[pi];
      if (!SIGN_KINDS.has(poi.k) || !poi.n || poi.n.length > 30) continue;
      // host building: the one CONTAINING the POI (way-POIs sit at centroids of
      // deep blocks), else the nearest within 80px
      let host = -1;
      let hostD2 = 80 * 80;
      for (const bi of bucket.buildings) {
        const pts = this.world.buildings[bi].p;
        if (pointInRing(poi.x, poi.y, pts)) { host = bi; hostD2 = 0; break; }
        const d2 = distToPolylineSq(poi.x, poi.y, pts);
        if (d2 < hostD2) { hostD2 = d2; host = bi; }
      }
      if (host < 0) continue;
      // mount on the building edge closest to the street
      const pts = this.world.buildings[host].p;
      const [hcx, hcy] = centroidOf(pts);
      const n = pts.length / 2;
      let bestEdge: { x: number; y: number; nx: number; ny: number; score: number } | null = null;
      for (let i = 0; i < n; i++) {
        const ax = pts[i * 2], ay = pts[i * 2 + 1];
        const bx = pts[((i + 1) % n) * 2], by = pts[((i + 1) % n) * 2 + 1];
        const ex = bx - ax, ey = by - ay;
        const len = Math.hypot(ex, ey);
        if (len < 16) continue;
        // mount near the point on this edge closest to the POI (keeps multiple
        // businesses in one big building at their own doors)
        let t = len > 1 ? ((poi.x - ax) * ex + (poi.y - ay) * ey) / (len * len) : 0.5;
        t = Math.max(0.15, Math.min(0.85, t));
        const mx = ax + ex * t, my = ay + ey * t;
        let nx = ey / len, ny = -ex / len;
        if ((mx - hcx) * nx + (my - hcy) * ny < 0) { nx = -nx; ny = -ny; } // outward
        const score = roadDist2(mx + nx * 30, my + ny * 30);
        if (!bestEdge || score < bestEdge.score) bestEdge = { x: mx, y: my, nx, ny, score };
      }
      if (!bestEdge || bestEdge.score > 360 * 360) continue;
      out.push({
        x: bestEdge.x + bestEdge.nx * 6,
        z: bestEdge.y + bestEdge.ny * 6,
        name: poi.n,
        // blade sign: face PERPENDICULAR to the facade so it reads down the street
        rotY: Math.atan2(-bestEdge.ny, bestEdge.nx)
      });
    }
    this.signCache.set(key, out);
    return out;
  }

  // ballfields, courts, lots, plazas: kept clear of scattered trees
  private onClearedGround(x: number, y: number, bucket: Bucket): boolean {
    for (const pi of bucket.polys) {
      const poly = this.world.polys[pi];
      if (poly.k !== 'pitch' && poly.k !== 'playground' && poly.k !== 'parking'
        && poly.k !== 'plaza' && poly.k !== 'pool' && poly.k !== 'pier') continue;
      if (pointInPoly(x, y, poly)) return true;
    }
    return false;
  }

  // inside any road's paved surface (small margin past the curb)
  private onRoadway(x: number, y: number, bucket: Bucket): boolean {
    for (const ri of bucket.roads) {
      const r = this.world.roads[ri];
      if (distToPolylineSq(x, y, r.p) < (r.w / 2 + 3) ** 2) return true;
    }
    return false;
  }

  private onPavementOrBuilding(x: number, y: number, bucket: Bucket): boolean {
    for (const ri of bucket.roads) {
      const r = this.world.roads[ri];
      if (distToPolylineSq(x, y, r.p) < (r.w / 2 + 12) ** 2) return true;
    }
    for (const pi of bucket.paths) {
      const p = this.world.paths[pi];
      if (distToPolylineSq(x, y, p.p) < (p.w / 2 + 8) ** 2) return true;
    }
    for (const bi of bucket.buildings) {
      if (pointInRing(x, y, this.world.buildings[bi].p)) return true;
    }
    return false;
  }

  // driveways: house -> nearest neighborhood road; painted on the ground and
  // used by the decor pass to park cars. Cached per owning chunk.
  private drivewayCache = new Map<string, Driveway[]>();

  drivewaysFor(key: string): Driveway[] {
    const cached = this.drivewayCache.get(key);
    if (cached) return cached;
    const out: Driveway[] = [];
    const bucket = this.bucket(key);
    const roads = bucket.roads
      .map((i) => this.world.roads[i])
      .filter((r) => ['residential', 'unclassified', 'living_street', 'tertiary', 'service'].includes(r.c));
    for (const { idx, b } of this.buildingsOwned(key)) {
      if (b.k !== 'house') continue;
      const rng = mulberry32(hash32(idx, 91, 3));
      if (rng() > 0.85) continue;
      const [cx, cy] = centroidOf(b.p);
      let best: { x: number; y: number; d2: number; w: number } | null = null;
      for (const r of roads) {
        const n = nearestOnPolyline(cx, cy, r.p);
        if (!best || n.d2 < best.d2) best = { ...n, w: r.w };
      }
      if (!best || best.d2 > 240 * 240 || best.d2 < 14 * 14) continue;
      const d = Math.sqrt(best.d2);
      const ux = (best.x - cx) / d, uy = (best.y - cy) / d;
      const ex = best.x - ux * (best.w / 2 - 4), ey = best.y - uy * (best.w / 2 - 4);
      out.push({ x0: cx, y0: cy, x1: ex, y1: ey, car: rng() < 0.5, carT: 0.55 + rng() * 0.3, seed: idx });
    }
    this.drivewayCache.set(key, out);
    return out;
  }

  // ---------- ground texture (no buildings/trees — those are 3D now) ----------

  groundCanvas(key: string): HTMLCanvasElement {
    const [cx, cy] = key.split(',').map(Number);
    const ox = cx * CHUNK, oy = cy * CHUNK;
    const w = this.world;
    const bucket = this.bucket(key);

    const canvas = document.createElement('canvas');
    canvas.width = CHUNK;
    canvas.height = CHUNK;
    const ctx = canvas.getContext('2d')!;
    ctx.save();
    ctx.translate(-ox, -oy);

    ctx.fillStyle = terrainFill('land');
    ctx.fillRect(ox, oy, CHUNK, CHUNK);

    const waterPolys: Poly[] = [];
    for (const pi of bucket.polys) {
      const poly = w.polys[pi];
      this.fillPoly(ctx, poly, pi);
      if (poly.k === 'water' || poly.k === 'ocean') waterPolys.push(poly);
    }
    ctx.strokeStyle = STYLE.shoreline;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    for (const poly of waterPolys) {
      tracePoly(ctx, poly);
      ctx.stroke();
    }
    for (const pi of bucket.polys) this.decoratePoly(ctx, w.polys[pi], pi, ox, oy);

    for (const ri of bucket.rails) this.drawRail(ctx, w.rails[ri].p);

    const roads = bucket.roads.map((i) => w.roads[i]).sort((a, b) => (ROAD_RANK[a.c] || 0) - (ROAD_RANK[b.c] || 0));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const r of roads) {
      ctx.strokeStyle = r.b ? STYLE.road.bridgeCasing : STYLE.road.casing;
      ctx.lineWidth = r.w + (r.b ? 8 : 5);
      strokeLine(ctx, r.p);
    }
    for (const r of roads) {
      ctx.strokeStyle = roadFill(STYLE.road[r.c] || STYLE.road.residential);
      ctx.lineWidth = r.w;
      strokeLine(ctx, r.p);
    }
    ctx.setLineDash([16, 26]);
    ctx.strokeStyle = STYLE.road.centerline;
    ctx.lineWidth = 2.5;
    for (const r of roads) {
      if (r.c === 'primary' || r.c === 'secondary' || r.c === 'trunk') strokeLine(ctx, r.p);
    }
    ctx.setLineDash([]);

    // driveways (this chunk + neighbors, so they cross chunk borders seamlessly)
    ctx.lineCap = 'butt';
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const dr of this.drivewaysFor((cx + dx) + ',' + (cy + dy))) {
          ctx.strokeStyle = '#b7b1a2';
          ctx.lineWidth = 19;
          ctx.beginPath();
          ctx.moveTo(dr.x0, dr.y0);
          ctx.lineTo(dr.x1, dr.y1);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(146,140,126,0.5)';
          ctx.lineWidth = 21;
          ctx.beginPath();
          ctx.moveTo(dr.x0, dr.y0);
          ctx.lineTo(dr.x1, dr.y1);
          ctx.stroke();
          ctx.strokeStyle = '#bdb7a8';
          ctx.lineWidth = 17;
          ctx.beginPath();
          ctx.moveTo(dr.x0, dr.y0);
          ctx.lineTo(dr.x1, dr.y1);
          ctx.stroke();
        }
      }
    }
    ctx.lineCap = 'round';

    for (const pi of bucket.paths) this.drawPath(ctx, w.paths[pi]);

    this.drawStreetLabels(ctx, roads, ox, oy);
    for (const li of bucket.labels) {
      const l = w.labels[li];
      if (l.k !== 'bldg') this.drawLabel(ctx, l);
    }

    ctx.restore();
    return canvas;
  }

  private fillPoly(ctx: CanvasRenderingContext2D, poly: Poly, pi = -1) {
    // grass-surface aprons read as worn turf, not asphalt; frozen ponds go to ice
    ctx.fillStyle = (SEASON === 'winter' && poly.k === 'water' && isFreezableWater(poly)) ? '#c8dde8'
      : poly.k === 'apron' && poly.s === 'grass' ? '#abbd84' : terrainFill(poly.k);
    tracePoly(ctx, poly);
    ctx.fill('evenodd');
    if (poly.k === 'plaza') {
      ctx.strokeStyle = STYLE.plazaStroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (poly.k === 'pitch' && pi >= 0) {
      this.paintPitch(ctx, poly, pi);
    } else if (poly.k === 'helipad') {
      // concrete pad, ring, and the H
      const [hx, hy] = centroidOf(poly.p);
      ctx.strokeStyle = 'rgba(248, 250, 244, 0.92)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(hx, hy, 26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(hx - 9, hy - 12); ctx.lineTo(hx - 9, hy + 12);
      ctx.moveTo(hx + 9, hy - 12); ctx.lineTo(hx + 9, hy + 12);
      ctx.moveTo(hx - 9, hy); ctx.lineTo(hx + 9, hy);
      ctx.stroke();
    } else if (poly.k === 'fountain') {
      ctx.strokeStyle = 'rgba(255,255,255,0.95)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
  }

  private decoratePoly(ctx: CanvasRenderingContext2D, poly: Poly, pi: number, ox: number, oy: number) {
    if (poly.k !== 'wetland' && poly.k !== 'sand') return;
    const cell = 56;
    const [bx0, by0, bx1, by1] = bboxOf(poly.p);
    const x0 = Math.max(ox - 28, bx0), x1 = Math.min(ox + CHUNK + 28, bx1);
    const y0 = Math.max(oy - 28, by0), y1 = Math.min(oy + CHUNK + 28, by1);
    if (x1 <= x0 || y1 <= y0) return;
    for (let gy = Math.floor(y0 / cell); gy * cell < y1; gy++) {
      for (let gx = Math.floor(x0 / cell); gx * cell < x1; gx++) {
        const rng = mulberry32(hash32(pi, gx, gy));
        const n = poly.k === 'wetland' ? (rng() < 0.55 ? 1 : 0) : (rng() < 0.5 ? 2 : 1);
        for (let i = 0; i < n; i++) {
          const x = gx * cell + rng() * cell;
          const y = gy * cell + rng() * cell;
          if (!pointInPoly(x, y, poly)) continue;
          if (poly.k === 'wetland') {
            ctx.strokeStyle = STYLE.marshTick;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(x - 6, y); ctx.lineTo(x + 6, y);
            ctx.moveTo(x - 3, y - 3.5); ctx.lineTo(x + 3, y - 3.5);
            ctx.stroke();
          } else {
            ctx.fillStyle = STYLE.sandSpeckle;
            ctx.fillRect(x, y, 2, 2);
          }
        }
      }
    }
  }

  private drawRail(ctx: CanvasRenderingContext2D, pts: number[]) {
    ctx.strokeStyle = STYLE.rail.base;
    ctx.lineWidth = 4;
    strokeLine(ctx, pts);
    ctx.strokeStyle = STYLE.rail.tie;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    walkLine(pts, 22, (x, y, nx, ny) => {
      ctx.moveTo(x - ny * 5, y + nx * 5);
      ctx.lineTo(x + ny * 5, y - nx * 5);
    });
    ctx.stroke();
  }

  private drawPath(ctx: CanvasRenderingContext2D, p: PathSeg) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (p.c === 'runway') {
      ctx.lineCap = 'butt';
      if (p.s === 'grass') {
        // the real 2B2 turf strip: mowed band + white edge dashes
        ctx.strokeStyle = '#9fbd72';
        ctx.lineWidth = p.w;
        strokeLine(ctx, p.p);
        ctx.setLineDash([10, 34]);
        ctx.strokeStyle = 'rgba(248, 250, 244, 0.85)';
        ctx.lineWidth = 2.5;
        for (const s of [1, -1]) {
          ctx.beginPath();
          walkLine(p.p, 11, (x, y, nx, ny) => {
            const off = (p.w / 2 - 4) * s;
            ctx.lineTo(x - ny * off, y + nx * off);
          });
          ctx.stroke();
        }
        ctx.setLineDash([]);
      } else {
        ctx.strokeStyle = '#54565a';
        ctx.lineWidth = p.w;
        strokeLine(ctx, p.p);
        ctx.setLineDash([18, 22]);
        ctx.strokeStyle = 'rgba(246, 244, 234, 0.85)';
        ctx.lineWidth = 2.5;
        strokeLine(ctx, p.p);
        ctx.setLineDash([]);
        // threshold bars at both ends
        const n = p.p.length;
        for (const [ex, ey, ix, iy] of [[p.p[0], p.p[1], p.p[2], p.p[3]], [p.p[n - 2], p.p[n - 1], p.p[n - 4], p.p[n - 3]]] as const) {
          const dx = ix - ex, dy = iy - ey;
          const len = Math.hypot(dx, dy) || 1;
          const ux = dx / len, uy = dy / len;
          ctx.strokeStyle = 'rgba(246, 244, 234, 0.9)';
          ctx.lineWidth = 3.2;
          ctx.beginPath();
          for (const t of [-0.34, -0.17, 0.17, 0.34]) {
            const bx = ex + ux * 10 + -uy * p.w * t, by = ey + uy * 10 + ux * p.w * t;
            ctx.moveTo(bx - ux * 6, by - uy * 6);
            ctx.lineTo(bx + ux * 14, by + uy * 14);
          }
          ctx.stroke();
        }
      }
      ctx.lineCap = 'round';
      return;
    }
    if (p.c === 'taxiway') {
      ctx.strokeStyle = '#63666a';
      ctx.lineWidth = p.w;
      strokeLine(ctx, p.p);
      ctx.strokeStyle = 'rgba(244, 207, 82, 0.85)';
      ctx.lineWidth = 1.6;
      strokeLine(ctx, p.p);
      return;
    }
    if (p.c === 'crossing') {
      // real zebra: bars perpendicular to walking direction, spanning the road
      ctx.strokeStyle = 'rgba(246, 244, 234, 0.92)';
      ctx.lineWidth = 3.6;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      walkLine(p.p, 7.5, (x, y, nx, ny) => {
        ctx.moveTo(x - ny * 21, y + nx * 21);
        ctx.lineTo(x + ny * 21, y - nx * 21);
      });
      ctx.stroke();
      ctx.lineCap = 'round';
      return;
    }
    if (p.c === 'side') {
      // concrete sidewalk: curb edges + granular slab with expansion joints
      ctx.strokeStyle = '#a3a19a';
      ctx.lineWidth = p.w + 3;
      strokeLine(ctx, p.p);
      ctx.strokeStyle = concreteFill();
      ctx.lineWidth = p.w;
      strokeLine(ctx, p.p);
      ctx.strokeStyle = 'rgba(138,136,128,0.75)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      walkLine(p.p, 16, (x, y, nx, ny) => {
        ctx.moveTo(x - ny * (p.w / 2 - 1), y + nx * (p.w / 2 - 1));
        ctx.lineTo(x + ny * (p.w / 2 - 1), y - nx * (p.w / 2 - 1));
      });
      ctx.stroke();
      return;
    }
    if (p.c === 'steps') {
      ctx.strokeStyle = STYLE.path.steps;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      walkLine(p.p, 6, (x, y, nx, ny) => {
        ctx.moveTo(x - ny * (p.w / 2), y + nx * (p.w / 2));
        ctx.lineTo(x + ny * (p.w / 2), y - nx * (p.w / 2));
      });
      ctx.stroke();
      return;
    }
    const casing = p.c === 'cycle' ? STYLE.path.cycleCasing : p.c === 'ped' ? STYLE.path.pedCasing : STYLE.path.footCasing;
    ctx.strokeStyle = casing;
    ctx.lineWidth = p.w + 3;
    strokeLine(ctx, p.p);
    ctx.strokeStyle = STYLE.path[p.c] || STYLE.path.foot;
    ctx.lineWidth = p.w;
    strokeLine(ctx, p.p);
    if (p.c === 'board' || p.c === 'pierline') {
      ctx.strokeStyle = p.c === 'board' ? STYLE.path.boardTick : STYLE.path.pierTick;
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      walkLine(p.p, 9, (x, y, nx, ny) => {
        ctx.moveTo(x - ny * (p.w / 2 - 1), y + nx * (p.w / 2 - 1));
        ctx.lineTo(x + ny * (p.w / 2 - 1), y - nx * (p.w / 2 - 1));
      });
      ctx.stroke();
    }
  }

  private drawStreetLabels(ctx: CanvasRenderingContext2D, roads: Road[], ox: number, oy: number) {
    const done = new Set<string>();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const r of roads) {
      if (!r.n || done.has(r.n)) continue;
      if ((ROAD_RANK[r.c] || 0) < 2) continue;
      const seg = longestSegmentIn(r.p, ox, oy, CHUNK);
      if (!seg || seg.len < 230) continue;
      done.add(r.n);
      let ang = Math.atan2(seg.dy, seg.dx);
      if (ang > Math.PI / 2) ang -= Math.PI;
      if (ang < -Math.PI / 2) ang += Math.PI;
      ctx.save();
      ctx.translate(seg.x, seg.y);
      ctx.rotate(ang);
      ctx.font = '600 14px system-ui, sans-serif';
      const text = r.n.toUpperCase();
      ctx.lineWidth = 4;
      ctx.strokeStyle = STYLE.label.streetHalo;
      ctx.strokeText(text, 0, 0);
      ctx.fillStyle = STYLE.label.street;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
  }

  private drawLabel(ctx: CanvasRenderingContext2D, l: Label) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = l.s ? 17 : 13;
    const italic = l.k === 'water' || l.k === 'area';
    ctx.font = `${italic ? 'italic ' : ''}600 ${size}px ${l.k === 'water' ? 'Georgia, serif' : 'system-ui, sans-serif'}`;
    const halo = l.k === 'water' ? STYLE.label.waterHalo : STYLE.label.areaHalo;
    const fill = l.k === 'water' ? STYLE.label.water : STYLE.label.area;
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = halo;
    ctx.strokeText(l.t, l.x, l.y);
    ctx.fillStyle = fill;
    ctx.fillText(l.t, l.x, l.y);
  }

  // ---------- collision ----------

  cellAt(x: number, y: number): number {
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    const key = cx + ',' + cy;
    let coll = this.collision.get(key);
    if (!coll) {
      coll = this.buildCollision(key);
      this.collision.set(key, coll);
    }
    const n = CHUNK / COLL_RES;
    const lx = Math.min(n - 1, Math.max(0, Math.floor((x - cx * CHUNK) / COLL_RES)));
    const ly = Math.min(n - 1, Math.max(0, Math.floor((y - cy * CHUNK) / COLL_RES)));
    return coll[ly * n + lx];
  }

  isBlocked(x: number, y: number): boolean { return this.cellAt(x, y) === BLOCKED; }
  isSlow(x: number, y: number): boolean { return this.cellAt(x, y) === SLOW; }

  private buildCollision(key: string): Uint8Array {
    const [cx, cy] = key.split(',').map(Number);
    const ox = cx * CHUNK, oy = cy * CHUNK;
    const n = CHUNK / COLL_RES;
    const w = this.world;
    const bucket = this.bucket(key);

    const canvas = document.createElement('canvas');
    canvas.width = n;
    canvas.height = n;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.save();
    ctx.scale(1 / COLL_RES, 1 / COLL_RES);
    ctx.translate(-ox, -oy);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const drawKind = (kinds: string[], color: string) => {
      for (const pi of bucket.polys) {
        const poly = w.polys[pi];
        if (!kinds.includes(poly.k)) continue;
        ctx.fillStyle = color;
        tracePoly(ctx, poly);
        ctx.fill('evenodd');
      }
    };
    // water blocks — except frozen ponds in winter, which you can walk across
    for (const pi of bucket.polys) {
      const poly = w.polys[pi];
      if (poly.k !== 'water' && poly.k !== 'ocean' && poly.k !== 'fountain' && poly.k !== 'pool') continue;
      if (SEASON === 'winter' && poly.k === 'water' && isFreezableWater(poly)) continue;
      ctx.fillStyle = '#ff0000';
      tracePoly(ctx, poly);
      ctx.fill('evenodd');
    }
    drawKind(['island', 'sand', 'pier', 'stone', 'plaza'], '#000000');
    drawKind(['wetland'], '#0000ff');
    // real barriers block (roads/paths drawn after re-open the gaps at gates)
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3.5;
    for (const bi of bucket.barriers) {
      // fences, hedges, AND low stone walls (graveyard/garden walls) are all
      // hop-over-able — every mapped barrier here renders waist-high, so none
      // of them block; buildings are the only hard property-line obstacle
      if (w.barriers[bi].k === 'fence' || w.barriers[bi].k === 'hedge' || w.barriers[bi].k === 'wall') continue;
      strokeLine(ctx, w.barriers[bi].p);
    }
    ctx.strokeStyle = '#000000';
    for (const ri of bucket.roads) {
      const r = w.roads[ri];
      ctx.lineWidth = r.w;
      strokeLine(ctx, r.p);
    }
    for (const pi of bucket.paths) {
      const p = w.paths[pi];
      if (p.c === 'crossing') continue;
      ctx.lineWidth = Math.max(p.w, 20);
      strokeLine(ctx, p.p);
    }
    for (const ri of bucket.rails) {
      ctx.lineWidth = 24;
      strokeLine(ctx, w.rails[ri].p);
    }
    for (const bi of bucket.buildings) {
      ctx.fillStyle = '#ff0000';
      traceRing(ctx, w.buildings[bi].p);
      ctx.fill();
    }
    ctx.restore();

    const data = ctx.getImageData(0, 0, n, n).data;
    const out = new Uint8Array(n * n);
    for (let i = 0; i < n * n; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      if (r > 120 && g < 100) out[i] = BLOCKED;
      else if (b > 120 && r < 100) out[i] = SLOW;
    }
    return out;
  }

  // deck height (bridges=7, docks/boardwalks=4) — keep in sync with decor.ts constants
  private deckCache = new Map<string, { bridges: { p: number[]; w: number }[]; piers: Poly[]; lines: { p: number[]; w: number }[] }>();

  deckHeightAt(x: number, y: number): number {
    const key = Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK);
    let d = this.deckCache.get(key);
    if (!d) {
      const b = this.bucket(key);
      d = { bridges: [], piers: [], lines: [] };
      for (const ri of b.roads) {
        const r = this.world.roads[ri];
        if (r.b) d.bridges.push({ p: r.p, w: r.w });
      }
      for (const pi of b.paths) {
        const p = this.world.paths[pi];
        if (p.c === 'pierline' || p.c === 'board' || (p.b && p.c === 'foot')) {
          d.lines.push({ p: p.p, w: Math.max(p.w, p.c === 'board' ? 22 : 18) });
        }
      }
      for (const pi of b.polys) {
        const poly = this.world.polys[pi];
        if (poly.k === 'pier') d.piers.push(poly);
      }
      this.deckCache.set(key, d);
    }
    for (const r of d.bridges) {
      if (distToPolylineSq(x, y, r.p) <= (r.w / 2 + 5) ** 2) return this.bridgeDeckYAt(r.p, x, y);
    }
    for (const l of d.lines) {
      // decks ride the bank/dunes (keep in sync with decor boardwalk())
      if (distToPolylineSq(x, y, l.p) <= (l.w / 2 + 3) ** 2) {
        return Math.max(4, this.terrain.heightAt(x, y) + 1.2);
      }
    }
    for (const poly of d.piers) {
      if (pointInPoly(x, y, poly)) return 4;
    }
    return 0;
  }

  // ---------- bridge deck profiles ----------
  // Decks span bank to bank at the higher approach (+6) exactly as before, but
  // wherever ANOTHER road or path genuinely passes beneath the span, the deck
  // lifts locally to guarantee head-and-handlebars clearance and ramps back
  // down. Ends stay pinned to the approach grade so every deck remains
  // mountable on foot. Derived purely from map data + terrain — no per-bridge
  // tuning, so it holds for any town we load, not just Newburyport.
  static readonly UNDERPASS_CLEAR = 46;  // kid (33) + bike (7.5) + margin
  static readonly WATER_CLEAR = 38;      // lift over open water so boats pass beneath
  private static readonly BRIDGE_RAMP = 150;
  static readonly DECK_T = 7;            // deck-slab thickness: top rides the profile, bottom sits T below
  private static readonly PIER_SPACING = 140; // columns this far apart along the span
  private static readonly CROSS_WINDOW = 60;   // no pier within this of a crossed road (leave the gap open)
  private bridgeProfiles = new Map<number[], BridgeProfile>();
  private bridgeComputing = new Set<number[]>();   // recursion guard for bridge-over-bridge clearance
  private wayLayer: Map<number[], number> | null = null;

  // effective OSM layer of a way: explicit tag, else 1 for a bridge / 0 for ground
  private effLayer(p: number[]): number {
    if (!this.wayLayer) {
      this.wayLayer = new Map();
      for (const r of this.world.roads) this.wayLayer.set(r.p, r.l != null ? r.l : (r.b ? 1 : 0));
      for (const pa of this.world.paths) this.wayLayer.set(pa.p, pa.l != null ? pa.l : (pa.b ? 1 : 0));
    }
    return this.wayLayer.get(p) ?? 0;
  }

  bridgeProfile(pts: number[]): BridgeProfile {
    let prof = this.bridgeProfiles.get(pts);
    if (prof) return prof;
    const h0 = this.terrain.heightAt(pts[0], pts[1]);
    const h1 = this.terrain.heightAt(pts[pts.length - 2], pts[pts.length - 1]);
    const base = Math.max(h0, h1) + 6;
    // re-entrant (can't happen under a strict layer order; guard against bad data)
    if (this.bridgeComputing.has(pts)) return { base, cum: [0], bumps: [], supports: { piers: [], abut: [] } };
    this.bridgeComputing.add(pts);
    const myLayer = this.effLayer(pts);
    const cum: number[] = [0];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      cum.push(cum[cum.length - 1] + Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]));
    }
    const total = cum[cum.length - 1];
    const bb = bboxOf(pts);
    const bumps: { t: number; peak: number }[] = [];
    // a way crossing mid-span demands clearance only if it passes strictly BELOW
    // this deck (lower OSM layer): a crossed bridge is cleared over its own deck top
    // (stacked ramps), a crossed road/path over the ground. Intersections at either
    // way's ends are junctions, not underpasses.
    const consider = (q: number[], qBridge: boolean, qLayer: number) => {
      if (q === pts || qLayer >= myLayer) return;
      const qb = bboxOf(q);
      if (qb[2] < bb[0] - 4 || qb[0] > bb[2] + 4 || qb[3] < bb[1] - 4 || qb[1] > bb[3] + 4) return;
      for (let i = 0; i + 3 < pts.length; i += 2) {
        const ax = pts[i], ay = pts[i + 1], bx2 = pts[i + 2], by2 = pts[i + 3];
        for (let j = 0; j + 3 < q.length; j += 2) {
          const cx = q[j], cy = q[j + 1], dx2 = q[j + 2], dy2 = q[j + 3];
          const r1x = bx2 - ax, r1y = by2 - ay, r2x = dx2 - cx, r2y = dy2 - cy;
          const den = r1x * r2y - r1y * r2x;
          if (Math.abs(den) < 1e-9) continue;
          const s = ((cx - ax) * r2y - (cy - ay) * r2x) / den;
          const u = ((cx - ax) * r1y - (cy - ay) * r1x) / den;
          if (s < 0 || s > 1 || u < 0 || u > 1) continue;
          const t = cum[i / 2] + s * Math.hypot(r1x, r1y);
          if (t < 26 || t > total - 26) continue;          // bridge's own approaches
          const tu = (j / 2 === 0 && u < 0.04) || (j + 4 >= q.length && u > 0.96);
          if (tu) continue;                                 // ramp meeting the span
          const hx = ax + r1x * s, hy = ay + r1y * s;
          const under = qBridge ? this.bridgeDeckYAt(q, hx, hy) : this.terrain.heightAt(hx, hy);
          const peak = under + WorldIndex.UNDERPASS_CLEAR;
          if (peak > base) bumps.push({ t, peak });
        }
      }
    };
    for (const r of this.world.roads) {
      consider(r.p, !!r.b, r.l != null ? r.l : (r.b ? 1 : 0));
    }
    for (const p of this.world.paths) {
      if (p.c !== 'pierline' && p.c !== 'stoneline') consider(p.p, !!p.b, p.l != null ? p.l : (p.b ? 1 : 0));
    }
    // over open water, lift the span to a FLAT height clear of the surface so boats
    // pass beneath, ramping back down to the banks at the water's edges — a flat span,
    // not the wobbly point-tents this used to be. Find the first/last point over water.
    let ws = Infinity, we = -Infinity;
    for (let d = 16; d <= total - 16; d += 18) {
      let seg = 0;
      while (seg + 1 < cum.length && cum[seg + 1] <= d) seg++;
      const segLen = (cum[seg + 1] - cum[seg]) || 1;
      const f = Math.min(1, (d - cum[seg]) / segLen);
      const wx = pts[seg * 2] + (pts[seg * 2 + 2] - pts[seg * 2]) * f;
      const wy = pts[seg * 2 + 1] + (pts[seg * 2 + 3] - pts[seg * 2 + 1]) * f;
      if (this.isWaterAt(wx, wy)) { if (d < ws) ws = d; if (d > we) we = d; }
    }
    const water = we >= ws ? { s: ws, e: we } : undefined;
    prof = { base, cum, bumps, water, supports: { piers: [], abut: [] } };
    this.bridgeProfiles.set(pts, prof);
    this.bridgeComputing.delete(pts); // cached now; deeper queries hit the cache, not recursion

    // ---- structural supports: piers along the span + abutments at the banks ----
    // deck-top height at arc-length t — same math as bridgeDeckYAt, but keyed on t
    // directly so we don't recurse into bridgeProfile while still building it
    const deckTopAtT = (tt: number): number => {
      let deck = base;
      for (const bump of bumps) {
        deck = Math.max(deck, bump.peak - (Math.abs(tt - bump.t) / WorldIndex.BRIDGE_RAMP) * (bump.peak - base));
      }
      if (water) {
        const R = 120;
        const f = tt <= water.s || tt >= water.e ? 0 : Math.max(0, Math.min(1, (tt - water.s) / R, (water.e - tt) / R));
        deck = Math.max(deck, base + f * WorldIndex.WATER_CLEAR);
      }
      return deck;
    };
    const xzAtT = (tt: number): [number, number, number, number] => {
      let seg = 0;
      while (seg + 1 < cum.length && cum[seg + 1] <= tt) seg++;
      const segLen = (cum[seg + 1] - cum[seg]) || 1;
      const f = Math.max(0, Math.min(1, (tt - cum[seg]) / segLen));
      const ex = pts[seg * 2 + 2] - pts[seg * 2], ez = pts[seg * 2 + 3] - pts[seg * 2 + 1];
      const el = Math.hypot(ex, ez) || 1;
      return [pts[seg * 2] + ex * f, pts[seg * 2 + 1] + ez * f, ex / el, ez / el];
    };
    const T = WorldIndex.DECK_T;
    // piers march the whole span (footing on the water surface or the ground), but
    // never inside a crossing window — that gap stays open so the road passes under.
    // The Gillis navigation channel is skipped at emission (decor), where its geometry lives.
    for (let tt = WorldIndex.PIER_SPACING; tt <= total - WorldIndex.PIER_SPACING; tt += WorldIndex.PIER_SPACING) {
      let inGap = false;
      for (const b of bumps) { if (Math.abs(tt - b.t) < WorldIndex.CROSS_WINDOW) { inGap = true; break; } }
      if (inGap) continue;
      const [x, z, ux, uz] = xzAtT(tt);
      const topY = deckTopAtT(tt) - T;
      const footY = this.isWaterAt(x, z) ? WATER_Y - 8 : this.terrain.heightAt(x, z) - 4;
      if (topY - footY < 10) continue; // deck hugs the grade here — no column to draw
      prof.supports.piers.push({ x, z, footY, topY, ux, uz });
    }
    // abutments seat the deck ends into the banks (close any gap at the lower bank)
    for (const tEnd of [Math.min(20, total / 2), Math.max(total - 20, total / 2)]) {
      const [x, z, ux, uz] = xzAtT(tEnd);
      prof.supports.abut.push({ x, z, footY: this.terrain.heightAt(x, z) - 6, topY: deckTopAtT(tEnd) - T, ux, uz });
    }
    return prof;
  }

  // deck height at a point on (or under) the span: base, plus any clearance
  // bumps tented over the crossings
  bridgeDeckYAt(pts: number[], x: number, y: number): number {
    const prof = this.bridgeProfile(pts);
    if (!prof.bumps.length && !prof.water) return prof.base;
    // arc-length of the closest point on the polyline
    let bestD = Infinity, t = 0;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i], ay = pts[i + 1];
      const ex = pts[i + 2] - ax, ey = pts[i + 3] - ay;
      const len2 = ex * ex + ey * ey;
      let s = len2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / len2 : 0;
      s = Math.max(0, Math.min(1, s));
      const px2 = ax + ex * s, py2 = ay + ey * s;
      const d = (x - px2) ** 2 + (y - py2) ** 2;
      if (d < bestD) { bestD = d; t = prof.cum[i / 2] + Math.sqrt(len2) * s; }
    }
    let deck = prof.base;
    for (const bump of prof.bumps) {
      deck = Math.max(deck, bump.peak - (Math.abs(t - bump.t) / WorldIndex.BRIDGE_RAMP) * (bump.peak - prof.base));
    }
    if (prof.water) {
      const { s, e } = prof.water;
      const R = 120; // ramp from the bank up to the flat span
      const f = t <= s || t >= e ? 0 : Math.max(0, Math.min(1, (t - s) / R, (e - t) / R));
      deck = Math.max(deck, prof.base + f * WorldIndex.WATER_CLEAR);
    }
    return deck;
  }

  // the surface an actor stands on: decks are *ridden* (entered where they
  // meet the grade), never teleported onto from below — so anything passing
  // under a raised span stays on the ground beneath it. With no prior height
  // (static props, spawns), a deck only counts when it hugs the terrain.
  surfaceYAt(x: number, y: number, prevY?: number): number {
    const t = this.heightAtPx(x, y);
    // a sea-level pond freezes to an ice sheet at the waterline; inland ponds are
    // painted on the (already flat) ground, so their terrain height is correct
    if (t < WATER_Y && this.frozenWaterAt(x, y)) return WATER_Y + 0.06;
    const d = this.deckHeightAt(x, y);
    if (d <= 0) return t;
    const from = prevY === undefined ? t : prevY;
    return d <= from + 14 ? Math.max(t, d) : t;
  }

  // ---------- camera occlusion ----------
  // absolute top of the tallest building covering a point (rough eave + roof
  // allowance, mirroring decor's buildingDims) — lets the chase camera test
  // its sight line analytically instead of raycasting merged meshes
  private bldgCamCache = new Map<number, { bb: [number, number, number, number]; h: number }>();

  buildingTopAt(x: number, y: number): number {
    const bucket = this.bucket(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK));
    let top = -Infinity;
    for (const bi of bucket.buildings) {
      let c = this.bldgCamCache.get(bi);
      if (!c) {
        const b = this.world.buildings[bi];
        let area = 0;
        for (let i = 0; i + 3 < b.p.length; i += 2) {
          area += b.p[i] * b.p[i + 3] - b.p[i + 2] * b.p[i + 1];
        }
        const areaM2 = Math.abs(area / 2) / 64;
        let lv = Math.max(1, Math.min(5, b.lv || 1.5));
        let h: number;
        switch (b.k) {
          case 'shed': h = 22; break;
          case 'church': h = 95; break; // steeple country
          case 'commercial':
          case 'civic':
            if (areaM2 > 140) lv = Math.max(lv, 3);
            h = 8 + lv * 23 + 7;
            break;
          case 'industrial': h = 8 + lv * 21 + 7; break;
          default:
            if (areaM2 > 110) lv = Math.max(lv, 2.2);
            h = 12 + lv * 15 + 20; // gable ridge allowance
        }
        c = { bb: bboxOf(b.p), h };
        this.bldgCamCache.set(bi, c);
      }
      if (x < c.bb[0] || x > c.bb[2] || y < c.bb[1] || y > c.bb[3]) continue;
      if (!pointInRing(x, y, this.world.buildings[bi].p)) continue;
      top = Math.max(top, this.heightAtPx(x, y) + c.h);
    }
    return top;
  }

  // ---------- water lookup (boats, boardwalk railings) ----------

  private waterBB: { poly: Poly; bb: [number, number, number, number] }[] | null = null;
  private waterCache = new Map<string, Poly[]>();

  isWaterAt(x: number, y: number): boolean {
    if (!this.waterBB) {
      this.waterBB = [];
      for (const poly of this.world.polys) {
        if (poly.k === 'water' || poly.k === 'ocean') this.waterBB.push({ poly, bb: bboxOf(poly.p) });
      }
    }
    const ckx = Math.floor(x / CHUNK), cky = Math.floor(y / CHUNK);
    const key = ckx + ',' + cky;
    let cand = this.waterCache.get(key);
    if (!cand) {
      const ox = ckx * CHUNK, oy = cky * CHUNK;
      cand = [];
      for (const { poly, bb } of this.waterBB) {
        if (bb[2] < ox || bb[0] > ox + CHUNK || bb[3] < oy || bb[1] > oy + CHUNK) continue;
        cand.push(poly);
      }
      this.waterCache.set(key, cand);
    }
    for (const poly of cand) {
      if (pointInPoly(x, y, poly)) return true;
    }
    return false;
  }

  // frozen ponds you can walk across in winter (rivers, the Merrimack, tidal
  // channels and the ocean stay open — see isFreezableWater)
  frozenWaterAt(x: number, y: number): boolean {
    if (SEASON !== 'winter') return false;
    if (!this.waterBB) {
      this.waterBB = [];
      for (const poly of this.world.polys) {
        if (poly.k === 'water' || poly.k === 'ocean') this.waterBB.push({ poly, bb: bboxOf(poly.p) });
      }
    }
    const ckx = Math.floor(x / CHUNK), cky = Math.floor(y / CHUNK);
    const key = ckx + ',' + cky;
    let cand = this.waterCache.get(key);
    if (!cand) {
      const ox = ckx * CHUNK, oy = cky * CHUNK;
      cand = [];
      for (const { poly, bb } of this.waterBB) {
        if (bb[2] < ox || bb[0] > ox + CHUNK || bb[3] < oy || bb[1] > oy + CHUNK) continue;
        cand.push(poly);
      }
      this.waterCache.set(key, cand);
    }
    for (const poly of cand) {
      if (isFreezableWater(poly) && pointInPoly(x, y, poly)) return true;
    }
    return false;
  }

  // standing on pavement (roads, sidewalks, crossings)? — footstep sounds
  onPavedAt(x: number, y: number): boolean {
    const b = this.bucket(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK));
    for (const ri of b.roads) {
      const r = this.world.roads[ri];
      if (distToPolylineSq(x, y, r.p) < (r.w / 2 + 1) ** 2) return true;
    }
    for (const pi of b.paths) {
      const p = this.world.paths[pi];
      if (p.c !== 'side' && p.c !== 'crossing' && p.c !== 'ped' && p.c !== 'steps' && p.c !== 'cycle') continue;
      if (distToPolylineSq(x, y, p.p) < (p.w / 2 + 1) ** 2) return true;
    }
    return false;
  }

  // a low fence/hedge/stone wall right here — the kid & dog hop it (none block)
  lowBarrierNear(x: number, y: number): boolean {
    const b = this.bucket(Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK));
    for (const bi of b.barriers) {
      const bar = this.world.barriers[bi];
      if (bar.k !== 'fence' && bar.k !== 'hedge' && bar.k !== 'wall') continue;
      if (distToPolylineSq(x, y, bar.p) < 64) return true;   // within ~8px
    }
    return false;
  }

  // ---------- sports fields: shared layout for ground paint + 3D gear ----------

  private pitchCache = new Map<number, PitchLayout | null>();

  pitchLayout(pi: number): PitchLayout | null {
    const hit = this.pitchCache.get(pi);
    if (hit !== undefined) return hit;
    const poly = this.world.polys[pi];
    let kind = poly.s || '';
    if (kind === 'vintage baseball' || kind === 'softball') kind = 'baseball';
    if (kind === 'football') kind = 'american_football';
    const obb = obbOf(poly.p);
    const L: PitchLayout = {
      kind, cx: obb.cx, cz: obb.cz, ang: obb.ang, hl: obb.hl, hw: obb.hw,
      hx: 0, hy: 0, u1x: 0, u1y: 0, u2x: 0, u2y: 0, base: 0
    };
    if (kind === 'baseball') {
      // home plate = the fan's apex: a ~90° corner with the longest adjacent edges
      const p = poly.p, n = p.length / 2;
      let bestScore = -Infinity;
      for (let i = 0; i < n; i++) {
        const x = p[i * 2], y = p[i * 2 + 1];
        const xa = p[((i + n - 1) % n) * 2], ya = p[((i + n - 1) % n) * 2 + 1];
        const xb = p[((i + 1) % n) * 2], yb = p[((i + 1) % n) * 2 + 1];
        const l1 = Math.hypot(xa - x, ya - y), l2 = Math.hypot(xb - x, yb - y);
        if (l1 < 40 || l2 < 40) continue;
        const u1x = (xa - x) / l1, u1y = (ya - y) / l1;
        const u2x = (xb - x) / l2, u2y = (yb - y) / l2;
        const angle = Math.acos(Math.max(-1, Math.min(1, u1x * u2x + u1y * u2y)));
        const dev = Math.abs(angle - Math.PI / 2);
        if (dev > Math.PI * 0.23) continue;
        const score = Math.min(l1, l2) * (1 - dev);
        if (score > bestScore) {
          bestScore = score;
          L.hx = x; L.hy = y;
          L.u1x = u1x; L.u1y = u1y;
          L.u2x = u2x; L.u2y = u2y;
        }
      }
      if (bestScore === -Infinity) {
        this.pitchCache.set(pi, null);
        return null;
      }
      // basepath sized to the fan (Little League ~60 ft up to full 90 ft)
      let bx = L.u1x + L.u2x, by = L.u1y + L.u2y;
      const bl = Math.hypot(bx, by) || 1;
      bx /= bl; by /= bl;
      let reach = 60;
      while (reach < 420 && pointInPoly(L.hx + bx * reach, L.hy + by * reach, poly)) reach += 12;
      L.base = Math.max(70, Math.min(220, (reach - 14) / 1.42));
    }
    this.pitchCache.set(pi, L);
    return L;
  }

  // painted court/field markings — called from fillPoly for k='pitch'
  private paintPitch(ctx: CanvasRenderingContext2D, poly: Poly, pi: number) {
    const L = this.pitchLayout(pi);
    const k = L?.kind || '';
    ctx.save();
    tracePoly(ctx, poly);
    ctx.clip();
    const white = (w: number) => {
      ctx.strokeStyle = 'rgba(248, 250, 244, 0.92)';
      ctx.lineWidth = w;
    };
    const refill = (hex: string) => {
      ctx.fillStyle = hex;
      tracePoly(ctx, poly);
      ctx.fill('evenodd');
    };
    if (k === 'baseball' && L) {
      const bl = Math.hypot(L.u1x + L.u2x, L.u1y + L.u2y) || 1;
      const bx = (L.u1x + L.u2x) / bl, by = (L.u1y + L.u2y) / bl;
      const a1 = Math.atan2(L.u1y, L.u1x), a2 = Math.atan2(L.u2y, L.u2x);
      const ccw = ((a2 - a1 + Math.PI * 2) % (Math.PI * 2)) > Math.PI;
      // dirt infield fan
      ctx.fillStyle = '#cda671';
      ctx.beginPath();
      ctx.moveTo(L.hx, L.hy);
      ctx.arc(L.hx, L.hy, L.base * 1.45, a1, a2, ccw);
      ctx.closePath();
      ctx.fill();
      // pitcher's mound
      ctx.fillStyle = '#bb9159';
      ctx.beginPath();
      ctx.arc(L.hx + bx * L.base * 0.66, L.hy + by * L.base * 0.66, 9, 0, Math.PI * 2);
      ctx.fill();
      // foul lines out to the fence
      white(2.5);
      ctx.beginPath();
      ctx.moveTo(L.hx, L.hy);
      ctx.lineTo(L.hx + L.u1x * 1400, L.hy + L.u1y * 1400);
      ctx.moveTo(L.hx, L.hy);
      ctx.lineTo(L.hx + L.u2x * 1400, L.hy + L.u2y * 1400);
      ctx.stroke();
      // bases + home plate
      ctx.fillStyle = 'rgba(250, 250, 246, 0.95)';
      const bases = [
        [L.hx + L.u1x * L.base, L.hy + L.u1y * L.base],
        [L.hx + bx * L.base * 1.414, L.hy + by * L.base * 1.414],
        [L.hx + L.u2x * L.base, L.hy + L.u2y * L.base],
        [L.hx + bx * 6, L.hy + by * 6]
      ];
      for (const [bxp, byp] of bases) ctx.fillRect(bxp - 2.5, byp - 2.5, 5, 5);
    } else if (k === 'basketball' || k === 'four_square') {
      refill('#8b9194');
      ctx.translate(L!.cx, L!.cz);
      ctx.rotate(L!.ang);
      if (k === 'four_square') {
        const s = Math.min(L!.hl, L!.hw, 26) - 3;
        white(1.6);
        ctx.strokeRect(-s, -s, s * 2, s * 2);
        ctx.beginPath();
        ctx.moveTo(0, -s); ctx.lineTo(0, s);
        ctx.moveTo(-s, 0); ctx.lineTo(s, 0);
        ctx.stroke();
      } else {
        const l2 = Math.min(L!.hl - 6, 112);
        const w2 = Math.min(L!.hw - 6, l2 * 0.56);
        white(2);
        ctx.strokeRect(-l2, -w2, l2 * 2, w2 * 2);
        ctx.beginPath();
        ctx.moveTo(0, -w2); ctx.lineTo(0, w2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(13, w2 * 0.4), 0, Math.PI * 2);
        ctx.stroke();
        const keyW = Math.min(20, w2 * 0.55), keyD = Math.min(46, l2 * 0.55);
        for (const s of [-1, 1]) {
          ctx.strokeRect(s < 0 ? -l2 : l2 - keyD, -keyW, keyD, keyW * 2);
          ctx.beginPath();
          ctx.arc(s * (l2 - keyD), 0, Math.min(12, keyW), 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    } else if (k === 'tennis') {
      refill('#4f8a63');
      ctx.translate(L!.cx, L!.cz);
      ctx.rotate(L!.ang);
      const l2 = Math.min(L!.hl - 5, 95);
      const w2 = Math.min(L!.hw - 5, l2 * 0.463);
      const sIn = Math.max(4, w2 * 0.25);          // singles sideline inset
      const sv = Math.min(51, l2 * 0.54);          // service line distance from net
      white(1.8);
      ctx.strokeRect(-l2, -w2, l2 * 2, w2 * 2);
      ctx.beginPath();
      ctx.moveTo(-l2, -w2 + sIn); ctx.lineTo(l2, -w2 + sIn);
      ctx.moveTo(-l2, w2 - sIn); ctx.lineTo(l2, w2 - sIn);
      ctx.moveTo(-sv, -w2 + sIn); ctx.lineTo(-sv, w2 - sIn);
      ctx.moveTo(sv, -w2 + sIn); ctx.lineTo(sv, w2 - sIn);
      ctx.moveTo(-sv, 0); ctx.lineTo(sv, 0);
      ctx.stroke();
      white(2.6);
      ctx.beginPath();
      ctx.moveTo(0, -w2); ctx.lineTo(0, w2);
      ctx.stroke();
    } else if (k === 'athletics' && L && L.hl > 350 && L.hw > 250) {
      // Only the genuine running oval gets lane markings. OSM over-maps the
      // Bradley Fuller complex as a dozen leisure=track polys (straightaways,
      // jump runways, throwing aprons); painting a stadium oval on each one
      // left stray "track pieces" scattered across the fields. The real oval is
      // the only track-sized, oval-proportioned poly — everything else falls
      // through to plain grass.
      ctx.translate(L.cx, L.cz);
      ctx.rotate(L.ang);
      const band = Math.min(54, L.hw * 0.45);
      const R = Math.max(10, L.hw - band / 2 - 2);
      const S = Math.max(0, L.hl - L.hw);
      const stadium = (r: number) => {
        ctx.beginPath();
        ctx.moveTo(-S, -r);
        ctx.lineTo(S, -r);
        ctx.arc(S, 0, r, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-S, r);
        ctx.arc(-S, 0, r, Math.PI / 2, Math.PI * 1.5);
        ctx.closePath();
      };
      ctx.strokeStyle = '#b5664c';
      ctx.lineWidth = band;
      stadium(R);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(248, 250, 244, 0.8)';
      ctx.lineWidth = 1.2;
      for (let j = 0; j <= 6; j++) {
        stadium(R - band / 2 + (band * j) / 6);
        ctx.stroke();
      }
    } else if (k === 'soccer' || k === 'american_football') {
      ctx.translate(L!.cx, L!.cz);
      ctx.rotate(L!.ang);
      const l2 = L!.hl - 6, w2 = L!.hw - 6;
      white(2);
      ctx.strokeRect(-l2, -w2, l2 * 2, w2 * 2);
      if (k === 'american_football') {
        const ez = Math.min(80, l2 * 0.18);
        ctx.beginPath();
        for (let x = -l2 + ez; x <= l2 - ez + 1; x += 36.6) {
          ctx.moveTo(x, -w2);
          ctx.lineTo(x, w2);
        }
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -w2); ctx.lineTo(0, w2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(24, w2 * 0.5), 0, Math.PI * 2);
        ctx.stroke();
        const gW = Math.min(44, w2 * 0.8), gD = Math.min(18, l2 * 0.2);
        ctx.strokeRect(-l2, -gW / 2, gD, gW);
        ctx.strokeRect(l2 - gD, -gW / 2, gD, gW);
      }
    } else if (k === 'skateboard') {
      refill('#9aa0a3');
    } else {
      white(2);
      tracePoly(ctx, poly);
      ctx.stroke();
    }
    ctx.restore();
  }

  nearestRoadName(x: number, y: number, maxD: number): string | null {
    const w = this.world;
    const seen = new Set<number>();
    let best: string | null = null;
    let bestD = maxD * maxD;
    const cx = Math.floor(x / CHUNK), cy = Math.floor(y / CHUNK);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const b = this.buckets.get((cx + dx) + ',' + (cy + dy));
        if (!b) continue;
        for (const ri of b.roads) {
          if (seen.has(ri)) continue;
          seen.add(ri);
          const r = w.roads[ri];
          if (!r.n || r.c === 'service') continue;
          const d = distToPolylineSq(x, y, r.p);
          if (d < bestD) { bestD = d; best = r.n; }
        }
        for (const pi of b.paths) {
          const p = w.paths[pi];
          if (!p.n || seen.has(10_000_000 + pi)) continue;
          seen.add(10_000_000 + pi);
          const d = distToPolylineSq(x, y, p.p);
          if (d < bestD) { bestD = d; best = p.n; }
        }
      }
    }
    return best;
  }
}

// ---------- geometry helpers ----------

export function tracePoly(ctx: CanvasRenderingContext2D, poly: Poly) {
  ctx.beginPath();
  addRing(ctx, poly.p);
  if (poly.h) for (const h of poly.h) addRing(ctx, h);
}

function addRing(ctx: CanvasRenderingContext2D, pts: number[]) {
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

export function traceRing(ctx: CanvasRenderingContext2D, pts: number[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
}

function strokeLine(ctx: CanvasRenderingContext2D, pts: number[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}

export function walkLine(pts: number[], step: number, cb: (x: number, y: number, nx: number, ny: number) => void) {
  let acc = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) continue;
    const nx = dx / len, ny = dy / len;
    let t = step - acc;
    while (t <= len) {
      cb(x0 + nx * t, y0 + ny * t, nx, ny);
      t += step;
    }
    acc = (acc + len) % step;
  }
}

export function bboxOf(pts: number[]): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < pts.length; i += 2) {
    if (pts[i] < minX) minX = pts[i];
    if (pts[i] > maxX) maxX = pts[i];
    if (pts[i + 1] < minY) minY = pts[i + 1];
    if (pts[i + 1] > maxY) maxY = pts[i + 1];
  }
  return [minX, minY, maxX, maxY];
}

export interface OBB { cx: number; cz: number; ang: number; hl: number; hw: number }

// minimal-area oriented bounding box over the ring's edge directions
export function obbOf(ring: number[]): OBB {
  const n = ring.length / 2;
  let best: OBB | null = null;
  let bestArea = Infinity;
  const angles: number[] = [];
  for (let i = 0; i < n; i++) {
    const x0 = ring[i * 2], z0 = ring[i * 2 + 1];
    const x1 = ring[((i + 1) % n) * 2], z1 = ring[((i + 1) % n) * 2 + 1];
    let a = Math.atan2(z1 - z0, x1 - x0);
    if (a < 0) a += Math.PI;
    if (a >= Math.PI / 2) a -= Math.PI / 2;
    if (!angles.some((q) => Math.abs(q - a) < 0.03)) angles.push(a);
    if (angles.length > 18) break;
  }
  for (const a of angles) {
    const ca = Math.cos(-a), sa = Math.sin(-a);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < n; i++) {
      const x = ring[i * 2] * ca - ring[i * 2 + 1] * sa;
      const z = ring[i * 2] * sa + ring[i * 2 + 1] * ca;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const area = (maxX - minX) * (maxZ - minZ);
    if (area < bestArea) {
      bestArea = area;
      const mx = (minX + maxX) / 2, mz = (minZ + maxZ) / 2;
      const cb = Math.cos(a), sb = Math.sin(a);
      let hl = (maxX - minX) / 2, hw = (maxZ - minZ) / 2, ang = a;
      if (hw > hl) { const t = hl; hl = hw; hw = t; ang = a + Math.PI / 2; }
      best = { cx: mx * cb - mz * sb, cz: mx * sb + mz * cb, ang, hl, hw };
    }
  }
  return best!;
}

export function centroidOf(pts: number[]): [number, number] {
  let x = 0, y = 0;
  const n = pts.length / 2;
  for (let i = 0; i < pts.length; i += 2) { x += pts[i]; y += pts[i + 1]; }
  return [x / n, y / n];
}

function pointInRing(x: number, y: number, pts: number[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function pointInPoly(x: number, y: number, poly: Poly): boolean {
  if (!pointInRing(x, y, poly.p)) return false;
  if (poly.h) for (const h of poly.h) if (pointInRing(x, y, h)) return false;
  return true;
}

function nearestOnPolyline(x: number, y: number, pts: number[]): { x: number; y: number; d2: number } {
  let best = { x: pts[0], y: pts[1], d2: Infinity };
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
    const dx = x1 - x0, dy = y1 - y0;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((x - x0) * dx + (y - y0) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + t * dx, py = y0 + t * dy;
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < best.d2) best = { x: px, y: py, d2: d };
  }
  return best;
}

export function distToPolylineSq(x: number, y: number, pts: number[]): number {
  let best = Infinity;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
    const dx = x1 - x0, dy = y1 - y0;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((x - x0) * dx + (y - y0) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x0 + t * dx, py = y0 + t * dy;
    const d = (x - px) ** 2 + (y - py) ** 2;
    if (d < best) best = d;
  }
  return best;
}

function longestSegmentIn(pts: number[], ox: number, oy: number, size: number): { x: number; y: number; dx: number; dy: number; len: number } | null {
  let best: { x: number; y: number; dx: number; dy: number; len: number } | null = null;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    if (mx < ox + 30 || mx > ox + size - 30 || my < oy + 30 || my > oy + size - 30) continue;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (!best || len > best.len) best = { x: mx, y: my, dx: x1 - x0, dy: y1 - y0, len };
  }
  return best;
}
