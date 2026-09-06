import type { WorldData, Poly, Road, PathSeg, Label, Building } from './types';
import { TOWN } from '@town';
import { STYLE, SEASON, hash32, mulberry32 } from './style';

// Floating docks come OUT for a New England winter: the marinas pull their floats,
// only the big stone wharves stay. |area| < ~26k px² ≈ anything smaller than a
// stone wharf. Shared by the deck renderer (decor.ts), footing, boat steering and
// the collision mask — the floats vanish visually AND physically together.
export function floatOutForWinter(ring: number[]): boolean {
  if (SEASON !== 'winter') return false;
  let a = 0;
  for (let i = 0; i < ring.length; i += 2) {
    const j = (i + 2) % ring.length;
    a += ring[i] * ring[j + 1] - ring[j] * ring[i + 1];
  }
  return Math.abs(a / 2) < 26000;
}
import { Terrain } from './terrain';
import { isFreezableWater, WATER_Y } from '../three/water';

// a bridge's structural plan, computed once per span and cached (see bridgeProfile):
// the deck-TOP height profile plus the discrete supports that hold the slab up
type BridgeSupport = { x: number; z: number; footY: number; topY: number; ux: number; uz: number };
type BridgeProfile = {
  g0: number;       // deck height where the span meets the START bank (terrain + 6)
  g1: number;       // deck height where it meets the END bank — deck rides a grade between
  total: number;    // span length (arc), so height can be evaluated at any arc-length t
  cum: number[];
  bumps: { t: number; peak: number }[];
  // crossings merged into flat runs (see the plateau note in bridgeProfile) — the
  // deck holds one height across a cluster instead of tenting over each crossing
  plateaus: { s: number; e: number; peak: number }[];
  water?: { s: number; e: number };
  // does each end actually sit on the GROUND? A merge end lands on another span's
  // deck and is already in the air, so the profile has no reason to ramp down to
  // earth there — which is what lets stacked interchange ramps stay airborne.
  ground0: boolean;
  ground1: boolean;
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
// east of here is Plum Island + the barrier beaches — the grassy upland reads as sand
const PLUM_X = TOWN.beachX;   // east of this = the town's barrier-beach sand zone (Infinity = none)

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

// brick pavers, running bond — Newburyport's downtown sidewalks are all brick
function brickPaveFill(): CanvasPattern {
  if (SEASON === 'winter') return concreteFill();   // under snow they read the same
  const hit = patternCache.get('brickpave');
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 48;
  const g = c.getContext('2d')!;
  g.fillStyle = '#b3a591';   // mortar
  g.fillRect(0, 0, 48, 48);
  const rng = mulberry32(hash32(91, 13, 7));
  const bw = 8, bh = 4;
  let row = 0;
  for (let y = 0; y < 48; y += bh, row++) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -bw; x < 48 + bw; x += bw) {
      const t = (rng() - 0.5) * 0.24;
      g.fillStyle = tint('#93553f', t);
      g.fillRect(x + off + 0.6, y + 0.6, bw - 1.2, bh - 1.2);
    }
  }
  const p = patternCanvasCtx.createPattern(c, 'repeat')!;
  patternCache.set('brickpave', p);
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
  reed?: boolean;   // marsh reed tuft (wetland) — rendered as tall thin blades
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
    const density: Record<string, number> = { wood: 1.3, scrub: 0.9, park: 0.6, cemetery: 0.55, island: 0.5, reserve: 0.4, wetland: 1.2 };
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
      const isReed = poly.k === 'wetland';   // marshes read as thick reed beds, not flat green
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
            const r = isReed ? 2.5 + rng() * 2 : isBush ? 5 + rng() * 4 : 9 + rng() * 7;
            out.push({ x, y, r, bush: isBush, reed: isReed });
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
        // probe the CROWN, not just the trunk — a trunk 7px off a pool edge still
        // hangs its canopy over the water. Fixed 9px probes (not rng-sized) so the
        // rng call order — and every other yard in town — stays put.
        const crownClear = (qx: number, qy: number) =>
          !this.onPavementOrBuilding(qx, qy, bucket) && !this.isWaterAt(qx, qy) && !this.onClearedGround(qx, qy, bucket);
        if (crownClear(px, py) && crownClear(px + 9, py) && crownClear(px - 9, py)
          && crownClear(px, py + 9) && crownClear(px, py - 9)) {
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

  // ballfields, courts, lots, plazas — and mapped sand — kept clear of scattered
  // trees. Sand matters: beaches sit under overlapping wood/reserve polys (dune
  // forests, Trustees reservations) whose tree scatter would otherwise forest the
  // open strand; sand paints above them (Z_ORDER), so the visible ground is sand.
  private onClearedGround(x: number, y: number, bucket: Bucket): boolean {
    for (const pi of bucket.polys) {
      const poly = this.world.polys[pi];
      if (poly.k !== 'pitch' && poly.k !== 'playground' && poly.k !== 'parking'
        && poly.k !== 'plaza' && poly.k !== 'pool' && poly.k !== 'pier' && poly.k !== 'sand') continue;
      if (pointInPoly(x, y, poly)) return true;
    }
    return false;
  }

  // destination beaches — the ones people travel to. A sand poly qualifies if it is
  // named "… Beach", or (when unnamed) a beach-named landmark/label/POI sits on or
  // beside it: OSM often names the beach as a point while the strand itself is an
  // anonymous natural=sand (Good Harbor, Wingaersheek's west half, Pavilion Beach).
  // Named non-beach sand (Sand Knolls, Ipswich Bar, river flats) stays wild.
  private beachSet: Set<number> | null = null;
  isBeachPoly(pi: number): boolean {
    if (!this.beachSet) {
      const set = (this.beachSet = new Set<number>());
      const BEACHY = /\bbeach\b/i;
      const pts: [number, number][] = [];
      for (const lm of this.world.landmarks || []) if (BEACHY.test(lm.name)) pts.push([lm.x, lm.y]);
      for (const lb of this.world.labels || []) if (BEACHY.test(lb.t)) pts.push([lb.x, lb.y]);
      for (const poi of this.world.pois || []) if (BEACHY.test(poi.n)) pts.push([poi.x, poi.y]);
      this.world.polys.forEach((poly, i) => {
        if (poly.k !== 'sand') return;
        if (poly.n) { if (BEACHY.test(poly.n)) set.add(i); return; }
        for (const [px, py] of pts) {
          if (pointInPoly(px, py, poly) || distToPolylineSq(px, py, poly.p) < 300 * 300) { set.add(i); return; }
        }
      });
    }
    return this.beachSet.has(pi);
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
    const nearestRoad = (x: number, y: number) => {
      let best: { x: number; y: number; d2: number; w: number } | null = null;
      for (const r of roads) {
        const n = nearestOnPolyline(x, y, r.p);
        if (!best || n.d2 < best.d2) best = { ...n, w: r.w };
      }
      return best;
    };
    for (const { idx, b } of this.buildingsOwned(key)) {
      if (b.k !== 'house') continue;
      const rng = mulberry32(hash32(idx, 91, 3));
      if (rng() > 0.85) continue;
      const [cx, cy] = centroidOf(b.p);
      const best = nearestRoad(cx, cy);
      if (!best || best.d2 > 240 * 240 || best.d2 < 14 * 14) continue;
      const d = Math.sqrt(best.d2);
      const ux = (best.x - cx) / d, uy = (best.y - cy) / d;
      // A driveway runs BESIDE the house, not through the front door: shift it sideways
      // past the footprint, on the side the roll picks, the other side if that one is
      // built on, and nowhere if both are. The walk to the door is its own line.
      const pxn = -uy, pyn = ux;
      let hw = 0;
      for (let i = 0; i < b.p.length; i += 2) hw = Math.max(hw, Math.abs((b.p[i] - cx) * pxn + (b.p[i + 1] - cy) * pyn));
      const side = rng() < 0.5 ? 1 : -1;
      const car = rng() < 0.5, carT = 0.55 + rng() * 0.3;
      for (const sgn of [side, -side]) {
        const off = hw + 11;
        // start level with the back half of the house so the parked car sits beside it
        const x0 = cx + pxn * sgn * off - ux * 6, y0 = cy + pyn * sgn * off - uy * 6;
        const n = nearestRoad(x0, y0);
        if (!n || n.d2 > 240 * 240 || n.d2 < 14 * 14) continue;
        const dd = Math.sqrt(n.d2);
        const vx = (n.x - x0) / dd, vy = (n.y - y0) / dd;
        const x1 = n.x - vx * (n.w / 2 - 4), y1 = n.y - vy * (n.w / 2 - 4);
        let clear = true;
        for (let t = 0; t <= 1.001 && clear; t += 0.125) {
          if (this.isBlocked(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) clear = false;
        }
        if (!clear) continue;
        out.push({ x0, y0, x1, y1, car, carT, seed: idx });
        break;
      }
    }
    this.drivewayCache.set(key, out);
    return out;
  }

  // The front walk: door to sidewalk. Every house has one and it is the line the eye
  // follows from the street to the door; the driveway is off to the side. From the
  // middle of the door wall (the longest wall, where the decor pass hangs the door)
  // straight to the kerb, only when that wall faces the street.
  private walkCache = new Map<string, { x0: number; y0: number; x1: number; y1: number }[]>();
  walksFor(key: string): { x0: number; y0: number; x1: number; y1: number }[] {
    const cached = this.walkCache.get(key);
    if (cached) return cached;
    const out: { x0: number; y0: number; x1: number; y1: number }[] = [];
    const bucket = this.bucket(key);
    const roads = bucket.roads.map((i) => this.world.roads[i]).filter((r) => r.c !== 'service');
    for (const { b } of this.buildingsOwned(key)) {
      if (b.k !== 'house') continue;
      const [cx, cy] = centroidOf(b.p);
      let li = -1, ll = 0;
      for (let i = 0; i + 1 < b.p.length; i += 2) {
        const j = (i + 2) % b.p.length;
        const l = Math.hypot(b.p[j] - b.p[i], b.p[j + 1] - b.p[i + 1]);
        if (l > ll) { ll = l; li = i; }
      }
      if (li < 0 || ll < 24) continue;
      const j = (li + 2) % b.p.length;
      const mx = (b.p[li] + b.p[j]) / 2, my = (b.p[li + 1] + b.p[j + 1]) / 2;
      let nx = -(b.p[j + 1] - b.p[li + 1]) / ll, ny = (b.p[j] - b.p[li]) / ll;
      if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }
      // the nearest street the door wall FACES (a corner lot's nearest street may be
      // the one along its side)
      let best: { x: number; y: number; d2: number; w: number } | null = null;
      for (const r of roads) {
        const n = nearestOnPolyline(mx, my, r.p);
        const dn = Math.sqrt(n.d2) || 1;
        if (((n.x - mx) * nx + (n.y - my) * ny) / dn < 0.6) continue;
        if (!best || n.d2 < best.d2) best = { ...n, w: r.w };
      }
      if (!best) continue;
      const d = Math.sqrt(best.d2);
      const ux = (best.x - mx) / d, uy = (best.y - my) / d;
      const reach = d - best.w / 2 - 6;
      if (reach < 6 || reach > 150) continue;
      const x0 = mx + nx * 1.5, y0 = my + ny * 1.5;
      const x1 = x0 + ux * reach, y1 = y0 + uy * reach;
      let clear = true;
      for (let t = Math.max(0.3, 8 / reach); t <= 1.001 && clear; t += 0.17) {
        if (this.isBlocked(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) clear = false;
      }
      if (!clear) continue;
      out.push({ x0, y0, x1, y1 });
    }
    this.walkCache.set(key, out);
    return out;
  }

  // ---------- ground texture (no buildings/trees — those are 3D now) ----------

  // A single low-res render of the WHOLE map's ground — land, greens, sand, water and the
  // road network — used as a distant "impostor" beneath the detailed chunks (Game.buildImpostor).
  // Flying or fast-travelling outruns per-chunk streaming; without this, the un-streamed
  // distance reads as one flat slab. Drawn once, in the season's palette (the same STYLE the
  // detailed chunks use), so the LOD seam is only detail, never colour.
  overviewCanvas(longPx = 2048): HTMLCanvasElement {
    const b = this.world.meta.bounds;
    const ex = b.maxX - b.minX, ey = b.maxY - b.minY;
    const s = longPx / Math.max(ex, ey);
    const cv = document.createElement('canvas');
    cv.width = Math.max(2, Math.round(ex * s));
    cv.height = Math.max(2, Math.round(ey * s));
    const ctx = cv.getContext('2d')!;
    const X = (x: number) => (x - b.minX) * s;
    const Y = (y: number) => (y - b.minY) * s;
    const trace = (p: number[], holes?: number[][]) => {
      ctx.beginPath();
      ctx.moveTo(X(p[0]), Y(p[1]));
      for (let i = 2; i < p.length; i += 2) ctx.lineTo(X(p[i]), Y(p[i + 1]));
      ctx.closePath();
      if (holes) for (const h of holes) {
        ctx.moveTo(X(h[0]), Y(h[1]));
        for (let i = 2; i < h.length; i += 2) ctx.lineTo(X(h[i]), Y(h[i + 1]));
        ctx.closePath();
      }
    };
    ctx.fillStyle = STYLE.land;
    ctx.fillRect(0, 0, cv.width, cv.height);
    // land cover (greens, sand, parking…) — everything except water, in poly order
    for (const poly of this.world.polys) {
      if (poly.k === 'water' || poly.k === 'ocean') continue;
      const col = STYLE.poly[poly.k];
      if (!col) continue;
      ctx.fillStyle = col;
      trace(poly.p, poly.h);
      ctx.fill('evenodd');
    }
    // water sits on top of the land
    for (const poly of this.world.polys) {
      if (poly.k !== 'water' && poly.k !== 'ocean') continue;
      ctx.fillStyle = STYLE.poly[poly.k];
      trace(poly.p, poly.h);
      ctx.fill('evenodd');
    }
    // the road network — min widths so even minor streets read at this scale
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    const major: Record<string, boolean> = { motorway: true, trunk: true, primary: true, secondary: true };
    for (const r of this.world.roads) {
      if (r.c === 'service') continue;
      ctx.strokeStyle = STYLE.road[r.c] || STYLE.road.residential;
      ctx.lineWidth = Math.max(major[r.c] ? 1.8 : 1.0, r.w * s);
      ctx.beginPath();
      ctx.moveTo(X(r.p[0]), Y(r.p[1]));
      for (let i = 2; i < r.p.length; i += 2) ctx.lineTo(X(r.p[i]), Y(r.p[i + 1]));
      ctx.stroke();
    }
    return cv;
  }

  // ---- the downtown core (TOWN.downtown): which roads, and whether a point is on it ----
  private downtownRoadCache = new Map<number, boolean>();
  downtownRoad(ri: number): boolean {
    const d = TOWN.downtown;
    if (!d) return false;
    const hit = this.downtownRoadCache.get(ri);
    if (hit !== undefined) return hit;
    const r = this.world.roads[ri];
    let ok = false;
    if (r.n && d.streets.includes(r.n)) {
      for (let i = 0; i < r.p.length; i += 2) {
        if ((r.p[i] - d.x) ** 2 + (r.p[i + 1] - d.z) ** 2 < d.r * d.r) { ok = true; break; }
      }
    }
    this.downtownRoadCache.set(ri, ok);
    return ok;
  }
  /** the pedestrian mall (Inn Street) is downtown too: a ped path named for a listed street */
  downtownPath(p: PathSeg): boolean {
    const d = TOWN.downtown;
    if (!d || p.c !== 'ped' || !p.n) return false;
    const n = p.n;
    if (!d.streets.some((s) => n.startsWith(s))) return false;
    return (p.p[0] - d.x) ** 2 + (p.p[1] - d.z) ** 2 < d.r * d.r;
  }
  /** within the paved apron of a downtown street (kerb to building line) */
  downtownAt(x: number, y: number): boolean {
    const d = TOWN.downtown;
    if (!d || (x - d.x) ** 2 + (y - d.z) ** 2 > d.r * d.r) return false;
    const key = Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK);
    const b = this.bucket(key);
    for (const ri of b.roads) {
      if (!this.downtownRoad(ri)) continue;
      const r = this.world.roads[ri];
      if (distToPolylineSq(x, y, r.p) < (r.w / 2 + 44) ** 2) return true;
    }
    for (const pi of b.paths) {
      const p = this.world.paths[pi];
      if (this.downtownPath(p) && distToPolylineSq(x, y, p.p) < (p.w / 2 + 44) ** 2) return true;
    }
    return false;
  }
  /** unit tangent of the nearest road to a point (for furniture squared to the kerb) */
  kerbTangent(x: number, y: number): { tx: number; ty: number; d: number } | null {
    const key = Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK);
    let best: { tx: number; ty: number; d: number } | null = null;
    const b = this.bucket(key);
    const lines = [...b.roads.map((ri) => this.world.roads[ri].p), ...b.paths.filter((pi) => this.downtownPath(this.world.paths[pi])).map((pi) => this.world.paths[pi].p)];
    for (const p of lines) {
      for (let i = 0; i + 3 < p.length; i += 2) {
        const ax = p[i], ay = p[i + 1], bx = p[i + 2], by = p[i + 3];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / l2));
        const d = Math.hypot(ax + dx * t - x, ay + dy * t - y);
        if (!best || d < best.d) { const l = Math.sqrt(l2); best = { tx: dx / l, ty: dy / l, d }; }
      }
    }
    return best;
  }

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

    ctx.fillStyle = terrainFill(ox + CHUNK / 2 > PLUM_X ? 'sand' : 'land');   // Plum Island base reads as sand, not lawn
    ctx.fillRect(ox, oy, CHUNK, CHUNK);

    const waterPolys: Poly[] = [];
    for (const pi of bucket.polys) {
      const poly = w.polys[pi];
      this.fillPoly(ctx, poly, pi, bucket);
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

    // downtown: brick paving from kerb to building line, under the road (which paints
    // over its own width next). Lawns stop at the core; the shops meet the bricks.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const ri of bucket.roads) {
      if (!this.downtownRoad(ri)) continue;
      const r = w.roads[ri];
      ctx.strokeStyle = '#8f8b84';   // granite kerb line, just outside the road casing
      ctx.lineWidth = r.w + 88;
      strokeLine(ctx, r.p);
      ctx.strokeStyle = brickPaveFill();
      ctx.lineWidth = r.w + 84;
      strokeLine(ctx, r.p);
    }

    // …and around every downtown building, so a shop set back from the kerb stands on
    // bricks too, not on a strip of lawn between the apron and its door
    ctx.lineJoin = 'round';
    for (const bi of bucket.buildings) {
      const b = w.buildings[bi];
      const [bcx, bcy] = centroidOf(b.p);
      if (!this.downtownAt(bcx, bcy)) continue;
      ctx.fillStyle = brickPaveFill();
      ctx.strokeStyle = brickPaveFill();
      ctx.lineWidth = 64;
      ctx.beginPath();
      ctx.moveTo(b.p[0], b.p[1]);
      for (let i = 2; i < b.p.length; i += 2) ctx.lineTo(b.p[i], b.p[i + 1]);
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    }
    // the pedestrian mall: brick from one building line to the other, like Inn Street
    for (const pi of bucket.paths) {
      const p = w.paths[pi];
      if (!this.downtownPath(p)) continue;
      ctx.strokeStyle = brickPaveFill();
      ctx.lineWidth = p.w + 80;
      strokeLine(ctx, p.p);
    }

    for (const ri of bucket.rails) this.drawRail(ctx, w.rails[ri].p);

    const roads = bucket.roads.map((i) => w.roads[i]).sort((a, b) => (ROAD_RANK[a.c] || 0) - (ROAD_RANK[b.c] || 0));
    // Sidewalks wherever there are houses to walk from. OSM maps a sidewalk on a
    // handful of streets; the town has one on nearly every built-up street, a granite
    // kerb and a concrete slab, and their absence is what made a side street read as a
    // country lane. Per segment: a building within reach on either side earns the band.
    // Painted before the driveways, so a drive crosses the walk as an apron.
    {
      const cents: number[] = [];
      const seen = new Set<number>();
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          for (const bi of this.bucket((cx + dx) + ',' + (cy + dy)).buildings) {
            if (seen.has(bi)) continue;
            seen.add(bi);
            const [bx, by] = centroidOf(w.buildings[bi].p);
            cents.push(bx, by);
          }
        }
      }
      const SIDE = new Set(['residential', 'living_street', 'unclassified', 'tertiary', 'secondary', 'primary']);
      const walkW = 13;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const segs: number[] = [];
      for (const ri of bucket.roads) {
        const r = w.roads[ri];
        if (!SIDE.has(r.c) || r.b || r.w < 24 || this.downtownRoad(ri)) continue;
        const reach = (r.w / 2 + 130) ** 2;
        for (let i = 0; i + 3 < r.p.length; i += 2) {
          const ax = r.p[i], ay = r.p[i + 1], bx = r.p[i + 2], by = r.p[i + 3];
          const dxs = bx - ax, dys = by - ay, l2 = dxs * dxs + dys * dys || 1;
          let near = false;
          for (let k = 0; k < cents.length && !near; k += 2) {
            const t = Math.max(0, Math.min(1, ((cents[k] - ax) * dxs + (cents[k + 1] - ay) * dys) / l2));
            const qx = ax + dxs * t - cents[k], qy = ay + dys * t - cents[k + 1];
            if (qx * qx + qy * qy < reach) near = true;
          }
          if (near) segs.push(ax, ay, bx, by, r.w);
        }
      }
      for (const pass of [0, 1]) {
        ctx.strokeStyle = pass === 0 ? '#a3a19a' : concreteFill();
        for (let i = 0; i < segs.length; i += 5) {
          ctx.lineWidth = segs[i + 4] + walkW * 2 + (pass === 0 ? 4 : 0);
          ctx.beginPath();
          ctx.moveTo(segs[i], segs[i + 1]);
          ctx.lineTo(segs[i + 2], segs[i + 3]);
          ctx.stroke();
        }
      }
    }
    // driveways go down FIRST, under the roads (this chunk + neighbors, so they cross
    // chunk borders) — the road casing/fill then paints over the curb overlap, so a
    // driveway meets the street cleanly instead of bleeding onto the asphalt.
    ctx.lineCap = 'butt';
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const dr of this.drivewaysFor((cx + dx) + ',' + (cy + dy))) {
          // half the drives are blacktop, half pale concrete or packed gravel; either
          // way a dark seam along the edge so the drive reads against the lawn
          const paved = hash32(dr.seed, 5, 27) % 100 < 50;
          ctx.strokeStyle = paved ? 'rgba(60,60,58,0.55)' : 'rgba(120,114,100,0.6)';
          ctx.lineWidth = 24;
          ctx.beginPath();
          ctx.moveTo(dr.x0, dr.y0);
          ctx.lineTo(dr.x1, dr.y1);
          ctx.stroke();
          ctx.strokeStyle = paved ? '#5a5b5a' : '#c1bbab';
          ctx.lineWidth = 21;
          ctx.beginPath();
          ctx.moveTo(dr.x0, dr.y0);
          ctx.lineTo(dr.x1, dr.y1);
          ctx.stroke();
        }
      }
    }
    // front walks: a pale flag path from the door to the kerb, under the sidewalk
    // paint like the driveways
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const wk of this.walksFor((cx + dx) + ',' + (cy + dy))) {
          ctx.strokeStyle = 'rgba(110,105,95,0.6)';
          ctx.lineWidth = 10;
          ctx.beginPath(); ctx.moveTo(wk.x0, wk.y0); ctx.lineTo(wk.x1, wk.y1); ctx.stroke();
          ctx.strokeStyle = '#d3cec2';
          ctx.lineWidth = 8;
          ctx.beginPath(); ctx.moveTo(wk.x0, wk.y0); ctx.lineTo(wk.x1, wk.y1); ctx.stroke();
        }
      }
    }
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
    // what traffic does to asphalt: two darker wheel tracks per lane (tyres polish the
    // tar), and a grimy strip along each kerb where the sweeper never quite reaches
    if (SEASON !== 'winter') {
      for (const r of roads) {
        if (r.w < 18 || r.b) continue;
        const lanes = r.w >= 40 ? 4 : 2;
        const laneW = r.w / lanes;
        ctx.strokeStyle = 'rgba(0,0,0,0.085)';
        ctx.lineWidth = Math.max(2.5, laneW * 0.16);
        for (let l = 0; l < lanes; l++) {
          const centre = -r.w / 2 + laneW * (l + 0.5);
          strokeLine(ctx, offsetLine(r.p, centre - laneW * 0.27));
          strokeLine(ctx, offsetLine(r.p, centre + laneW * 0.27));
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.14)';
        ctx.lineWidth = 2.2;
        strokeLine(ctx, offsetLine(r.p, r.w / 2 - 1.4));
        strokeLine(ctx, offsetLine(r.p, -(r.w / 2 - 1.4)));
      }
    }
    ctx.setLineDash([16, 26]);
    ctx.strokeStyle = STYLE.road.centerline;
    ctx.lineWidth = 2.5;
    for (const r of roads) {
      if (r.c === 'primary' || r.c === 'secondary' || r.c === 'trunk') strokeLine(ctx, r.p);
    }
    ctx.setLineDash([]);

    // highways read as highways: solid edge lines on each shoulder + a dashed
    // white lane divider (motorways are one-way carriageways — yellow would be
    // wrong). Mid-block way seams join cleanly (round caps, same offset); real
    // INTERSECTIONS are wiped by the junction discs painted after.
    ctx.strokeStyle = 'rgba(233,233,225,0.85)';
    const wideCurve = this.wideCurveSet();
    for (const r of roads) {
      const hwy = r.c === 'motorway' || r.c === 'motorway_link' || r.c === 'trunk' || r.c === 'trunk_link';
      const wide = r.w >= 90 && (r.c === 'primary' || r.c === 'secondary');
      if ((!hwy && !wide) || r.w < 12) continue;
      ctx.lineWidth = 1.7;
      strokeLine(ctx, offsetLine(r.p, r.w / 2 - 2.2));
      strokeLine(ctx, offsetLine(r.p, -(r.w / 2 - 2.2)));
      if (r.c === 'motorway' && r.w >= 18) {
        ctx.setLineDash([14, 20]);
        ctx.lineWidth = 2;
        strokeLine(ctx, r.p);
        ctx.setLineDash([]);
      } else if (r.w >= 90 && !wideCurve.has(r)) {
        // straight enough for interior lane dashes; on curving wide streets the
        // offset parallels wander off the pavement, so we keep only the edge
        // lines + yellow centerline (Devin: "reads cluttered on curves"). Curvature
        // is measured across same-street joints, not per-way (OSM splits curves).
        ctx.setLineDash([14, 20]);
        ctx.lineWidth = 2;
        strokeLine(ctx, offsetLine(r.p, r.w / 4));
        strokeLine(ctx, offsetLine(r.p, -r.w / 4));
        ctx.setLineDash([]);
      }
    }
    // junction discs: markings never cross an intersection — plain asphalt
    // repainted over every node where a way ends against another road
    for (const jn of this.roadChains().junctions) {
      if (jn.x + jn.r < ox || jn.x - jn.r > ox + CHUNK || jn.y + jn.r < oy || jn.y - jn.r > oy + CHUNK) continue;
      ctx.fillStyle = roadFill(STYLE.road[jn.c] || STYLE.road.residential);
      ctx.beginPath();
      ctx.arc(jn.x, jn.y, jn.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // the rotary island: the arcs are painted like any road; the grass disc inside
    // them, with its granite kerb, is what makes it a rotary and not a tangle
    {
      const arcs = roads.filter((r) => /rotary/i.test(r.n || ''));
      if (arcs.length) {
        let cx = 0, cy = 0, n = 0;
        for (const r of arcs) for (let i = 0; i < r.p.length; i += 2) { cx += r.p[i]; cy += r.p[i + 1]; n++; }
        cx /= n; cy /= n;
        let rad = 0; for (const r of arcs) for (let i = 0; i < r.p.length; i += 2) rad += Math.hypot(r.p[i] - cx, r.p[i + 1] - cy); rad /= n;
        const inner = rad - arcs[0].w / 2 + 1;
        if (inner > 20) {
          ctx.fillStyle = '#8f8b84';
          ctx.beginPath(); ctx.arc(cx, cy, inner + 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = terrainFill('grass');
          ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    for (const pi of bucket.paths) this.drawPath(ctx, w.paths[pi]);

    this.drawStreetLabels(ctx, roads, ox, oy);
    for (const li of bucket.labels) {
      const l = w.labels[li];
      if (l.k !== 'bldg') this.drawLabel(ctx, l);
    }

    ctx.restore();
    return canvas;
  }

  // Painted stalls on every lot, on the same grid the 3D cars park to (see decor.ts):
  // nose-in rows off the mapped drive aisles where a lot has them, a free grid of rows
  // otherwise. Faded white, clipped to the lot.
  private paintParkingBays(ctx: CanvasRenderingContext2D, poly: Poly, bucket: Bucket) {
    const obb = obbOf(poly.p);
    if (obb.hw < 16 || obb.hl < 20) return;
    const w = this.world;
    ctx.save();
    tracePoly(ctx, poly);
    ctx.clip('evenodd');
    ctx.strokeStyle = SEASON === 'winter' ? 'rgba(236,236,228,0.35)' : 'rgba(236,236,228,0.6)';
    ctx.lineWidth = 1.4;
    ctx.lineCap = 'butt';
    ctx.beginPath();
    const aisles: Road[] = [];
    for (const ri of bucket.roads) {
      const r = w.roads[ri];
      if (r.c !== 'service') continue;
      let inside = false;
      walkLine(r.p, 30, (x, y) => { if (!inside && pointInPoly(x, y, poly)) inside = true; });
      if (inside) aisles.push(r);
    }
    if (aisles.length) {
      for (const r of aisles) {
        walkLine(r.p, 21, (x, y, tx, ty) => {
          for (const side of [1, -1]) {
            const o0 = r.w / 2 + 1, o1 = r.w / 2 + 22;
            for (const d of [-10.5, 10.5]) {
              const sx = x + tx * d, sy = y + ty * d;
              ctx.moveTo(sx - ty * side * o0, sy + tx * side * o0);
              ctx.lineTo(sx - ty * side * o1, sy + tx * side * o1);
            }
          }
        });
      }
    } else {
      const ca = Math.cos(obb.ang), sa = Math.sin(obb.ang);
      const rows: number[] = [];
      if (obb.hw < 26) rows.push(0);
      else for (let w0 = -obb.hw + 24; w0 <= obb.hw - 24; w0 += 78) rows.push(w0);
      for (const w0 of rows) {
        for (let l0 = -obb.hl + 16 - 11; l0 <= obb.hl - 16 + 11; l0 += 22) {
          ctx.moveTo(obb.cx + l0 * ca - (w0 - 11) * sa, obb.cz + l0 * sa + (w0 - 11) * ca);
          ctx.lineTo(obb.cx + l0 * ca - (w0 + 11) * sa, obb.cz + l0 * sa + (w0 + 11) * ca);
        }
      }
    }
    ctx.stroke();
    ctx.restore();
  }

  private fillPoly(ctx: CanvasRenderingContext2D, poly: Poly, pi = -1, bucket?: Bucket) {
    // Plum Island + the barrier beaches read as sand, not lawn: east of PLUM_X recolor
    // grassy upland to sand. Marshes (wetland) keep their green so the reeds still read.
    let k = poly.k;
    if (GRASSY.has(k) && k !== 'wetland' && k !== 'pitch') {
      const bb = bboxOf(poly.p);
      if ((bb[0] + bb[2]) / 2 > PLUM_X) k = 'sand';
    }
    // grass-surface aprons read as worn turf, not asphalt; frozen ponds go to ice
    ctx.fillStyle = (SEASON === 'winter' && poly.k === 'water' && isFreezableWater(poly)) ? '#c8dde8'
      : poly.k === 'apron' && poly.s === 'grass' ? '#abbd84' : terrainFill(k);
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
    } else if (poly.k === 'parking' && bucket) {
      this.paintParkingBays(ctx, poly, bucket);
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
      // Plum Island is a turf field — every runway renders as the real mowed grass strip
      // (OSM tags 10/28 as asphalt, wrong on the ground), never paved. Mowed band + edge dashes.
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
      const mid = p.p.length >= 4 ? Math.floor(p.p.length / 4) * 2 : 0;
      if (this.downtownAt(p.p[mid], p.p[mid + 1])) {
        // downtown: brick pavers between granite kerbs
        ctx.strokeStyle = '#8f8b84';
        ctx.lineWidth = p.w + 3;
        strokeLine(ctx, p.p);
        ctx.strokeStyle = brickPaveFill();
        ctx.lineWidth = p.w;
        strokeLine(ctx, p.p);
        return;
      }
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
    // the pedestrian mall downtown (Inn Street) is brick pavers, like its sidewalks
    const pm = p.p.length >= 4 ? Math.floor(p.p.length / 4) * 2 : 0;
    ctx.strokeStyle = p.c === 'ped' && TOWN.downtown && (p.p[pm] - TOWN.downtown.x) ** 2 + (p.p[pm + 1] - TOWN.downtown.z) ** 2 < TOWN.downtown.r ** 2
      ? brickPaveFill() : (STYLE.path[p.c] || STYLE.path.foot);
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
    drawKind(['island', 'sand', 'stone', 'plaza'], '#000000');
    // piers un-block the water they cross — except floats that are out for the
    // winter (the Greasy Pole structure is a fixture: walkable in every season)
    for (const pi of bucket.polys) {
      const poly = w.polys[pi];
      if (poly.k !== 'pier' || (poly.s !== 'greasy' && floatOutForWinter(poly.p))) continue;
      ctx.fillStyle = '#000000';
      tracePoly(ctx, poly);
      ctx.fill('evenodd');
      if (poly.s === 'greasy') {
        // narrow diagonal strips rasterize to a pinched 1-cell corridor at 8px
        // cells — the kid's ±5px side probes wedge on the antialiased edges. Widen
        // the OPEN corridor in the mask only; the deckHeightAt footing check still
        // uses the exact strip, so you can't actually stand off the planks.
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 22;
        tracePoly(ctx, poly);
        ctx.stroke();
      }
    }
    drawKind(['wetland'], '#0000ff');
    // real barriers block (roads/paths drawn after re-open the gaps at gates)
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 3.5;
    for (const bi of bucket.barriers) {
      // fences, hedges, AND low stone walls (graveyard/garden walls) are all
      // hop-over-able — every mapped barrier here renders waist-high, so none
      // of them block; buildings are the only hard property-line obstacle
      if (w.barriers[bi].k === 'fence' || w.barriers[bi].k === 'hedge' || w.barriers[bi].k === 'wall' || w.barriers[bi].k === 'picket') continue;
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
      // An ELEVATED span (skybridge, air-rights, station headhouse) does not
      // block the ground it crosses — that is the whole point of it being up
      // there, and marking it blocked walls off the street underneath.
      if (w.buildings[bi].my !== undefined) continue;
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
      const [ckx, cky] = key.split(',').map(Number);
      const ox = ckx * CHUNK, oy = cky * CHUNK;
      for (const ch of this.roadChains().bridge) {
        const pad = ch.w / 2 + 8;
        if (ch.bb[2] < ox - pad || ch.bb[0] > ox + CHUNK + pad || ch.bb[3] < oy - pad || ch.bb[1] > oy + CHUNK + pad) continue;
        d.bridges.push({ p: ch.pts, w: ch.w });
      }
      for (const pi of b.paths) {
        const p = this.world.paths[pi];
        if (p.c === 'pierline' || p.c === 'board' || (p.b && p.c === 'foot')) {
          d.lines.push({ p: p.p, w: Math.max(p.w, p.c === 'board' ? 22 : 18) });
        }
      }
      for (const pi of b.polys) {
        const poly = this.world.polys[pi];
        // s:'greasy' = the Greasy Pole structure: a fixture, never floats out for winter
        if (poly.k === 'pier' && (poly.s === 'greasy' || !floatOutForWinter(poly.p))) d.piers.push(poly);
      }
      this.deckCache.set(key, d);
    }
    for (const r of d.bridges) {
      const d2 = distToPolylineSq(x, y, r.p);
      if (d2 > (r.w / 2 + 5) ** 2) continue;
      const dy = this.bridgeDeckYAt(r.p, x, y);
      // WIDE decks are pulled back around buildings when drawn (deckHalfWidthLimit,
      // same >150 px test as the renderer) — the walking contract has to match, or
      // you stand on an invisible slab out beside the viaduct where no deck exists.
      // Within DECK_MIN_HW of the centreline the ribbon is never pinched away, so
      // the deck is always there.
      if (r.w >= WorldIndex.DECK_CLEAR_MIN_W && d2 > WorldIndex.DECK_MIN_HW ** 2
        && this.buildingTopAt(x, y) > dy - WorldIndex.DECK_T) continue;
      return dy;
    }
    // pier polys are the solid full-width dock surface and now render 1.5px proud of any
    // overlapping centerline (the dock-flicker fix in decor.ts) — so they take priority for
    // footing, and the player stands on the poly deck top (PIER_DECK_Y 4 + 1.5).
    for (const poly of d.piers) {
      if (pointInPoly(x, y, poly)) return 5.5;
    }
    for (const l of d.lines) {
      // decks ride the bank/dunes (keep in sync with decor boardwalk())
      if (distToPolylineSq(x, y, l.p) <= (l.w / 2 + 3) ** 2) {
        return Math.max(4, this.terrain.heightAt(x, y) + 1.2);
      }
    }
    return 0;
  }

  // ---------- the road graph: chains + junctions ----------
  // Decks and markings are properties of the road NETWORK, not of single OSM
  // ways (docs/BRIDGE-ROADS-REDESIGN.md): a street is many short ways sharing
  // endpoints. A CHAIN merges maximal degree-2 runs of compatible ways (same
  // class/bridge/layer/width) into one logical polyline — decks end at real
  // junctions or banks instead of putting caps and rail stubs at every seam.
  // JUNCTIONS are way-end nodes that touch any other road: markings get an
  // asphalt disc painted over them so stripes never cross an intersection.
  private roadChainsCache: {
    bridge: { pts: number[]; w: number; w0: number; w1: number; c: string; l: number; bb: [number, number, number, number]; trim0: number; trim1: number; other0: number; other1: number }[];
    junctions: { x: number; y: number; r: number; c: string }[];
  } | null = null;

  // Wide two-way streets that bend — measured across same-street continuation
  // joints, not just within one way. OSM splits a curving street into straight
  // chords, so a per-way turn check misses the bend; here the heading change at
  // each joint (to a same-name/class/width neighbour) counts too. On these the
  // interior lane dashes are dropped: the offset parallels wander off the curving
  // pavement and read as clutter (edge lines + centerline still carry the road).
  private wideCurveCache: Set<Road> | null = null;
  private wideCurveSet(): Set<Road> {
    if (this.wideCurveCache) return this.wideCurveCache;
    const roads = this.world.roads;
    const kOf = (x: number, y: number) => x + ',' + y;
    const endsAt = new Map<string, number[]>();
    for (let i = 0; i < roads.length; i++) {
      const p = roads[i].p;
      for (const k of [kOf(p[0], p[1]), kOf(p[p.length - 2], p[p.length - 1])]) {
        let a = endsAt.get(k); if (!a) endsAt.set(k, (a = [])); a.push(i);
      }
    }
    // unit tangent at the given end, pointing INTO the way (toward its interior)
    const inTangent = (p: number[], atStart: boolean): [number, number] => {
      if (atStart) { const dx = p[2] - p[0], dy = p[3] - p[1]; const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; }
      const n = p.length; const dx = p[n - 4] - p[n - 2], dy = p[n - 3] - p[n - 1]; const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l];
    };
    const isWide = (r: Road) => r.w >= 90 && (r.c === 'primary' || r.c === 'secondary');
    const set = new Set<Road>();
    for (let i = 0; i < roads.length; i++) {
      const r = roads[i]; if (!isWide(r)) continue; const p = r.p;
      let bend = maxTurn(p);
      for (const [atStart, node] of [[true, kOf(p[0], p[1])], [false, kOf(p[p.length - 2], p[p.length - 1])]] as [boolean, string][]) {
        for (const j of endsAt.get(node) ?? []) {
          if (j === i) continue;
          const nb = roads[j];
          if (nb.c !== r.c || nb.w !== r.w || (nb.n ?? '') !== (r.n ?? '')) continue;
          const nbAtStart = kOf(nb.p[0], nb.p[1]) === node;
          const t1 = inTangent(p, atStart), t2 = inTangent(nb.p, nbAtStart);
          // continuation neighbours' inward tangents point opposite on a straight
          // street; the street's heading change = π − angle(t1, t2)
          const streetBend = Math.PI - Math.acos(Math.max(-1, Math.min(1, t1[0] * t2[0] + t1[1] * t2[1])));
          if (streetBend > bend) bend = streetBend;
        }
      }
      if (bend >= 0.28) set.add(r);   // ~16°: matches the per-way lane-dash threshold
    }
    return (this.wideCurveCache = set);
  }

  roadChains() {
    if (this.roadChainsCache) return this.roadChainsCache;
    const roads = this.world.roads;
    const kOf = (x: number, y: number) => x + ',' + y;
    // vertex occupancy over ALL road vertices (interior included — T-junctions
    // land on a main road's interior vertex), and end occupancy per node
    const vertexRoads = new Map<string, number[]>();
    for (let i = 0; i < roads.length; i++) {
      const p = roads[i].p;
      for (let j = 0; j + 1 < p.length; j += 2) {
        const k = kOf(p[j], p[j + 1]);
        let a = vertexRoads.get(k);
        if (!a) vertexRoads.set(k, (a = []));
        if (a[a.length - 1] !== i) a.push(i);
      }
    }
    const endsAt = new Map<string, number[]>();   // node -> road indices ENDING there
    for (let i = 0; i < roads.length; i++) {
      const p = roads[i].p;
      for (const k of [kOf(p[0], p[1]), kOf(p[p.length - 2], p[p.length - 1])]) {
        let a = endsAt.get(k);
        if (!a) endsAt.set(k, (a = []));
        a.push(i);
      }
    }
    // junction discs: a way-end that touches any other road (end or interior)
    const junctions: { x: number; y: number; r: number; c: string }[] = [];
    for (const [k, ends] of endsAt) {
      const touching = vertexRoads.get(k) ?? [];
      if (touching.length < 2) continue;
      const [xs, ys] = k.split(',');
      // the two widest touching roads: the disc must cover the crossing to its
      // CORNER (hypot of the two half-widths), not just the widest road's edge —
      // a widest-only disc left marking stubs poking past it near the corners of
      // wide×wide intersections (a 90×90 crossing corners at 64px, not 45px)
      let r1 = 0, r2 = 0, widest = touching[0];
      for (const ri of touching) {
        const hw = roads[ri].w / 2;
        if (hw > r1) { r2 = r1; r1 = hw; widest = ri; }
        else if (hw > r2) { r2 = hw; }
      }
      // a continuation seam (two compatible ways of the SAME street) is not a junction
      if (touching.length === 2 && ends.length === 2) {
        const [a, b] = ends.map((i) => roads[i]);
        if (a.c === b.c && !!a.b === !!b.b && (a.l ?? 0) === (b.l ?? 0) && a.w === b.w) continue;
      }
      junctions.push({ x: +xs, y: +ys, r: Math.hypot(r1, r2) + 3, c: roads[widest].c });
    }
    // chains: walk maximal runs of compatible ways joined end-to-end at
    // degree-2 nodes (no third road passing through)
    const layerOf = (i: number) => roads[i].l != null ? roads[i].l! : (roads[i].b ? 1 : 0);
    const compat = (a: number, b: number) =>
      roads[a].c === roads[b].c && !!roads[a].b === !!roads[b].b && layerOf(a) === layerOf(b) && roads[a].w === roads[b].w;
    const mergeableAt = (k: string, i: number): number => {
      const ends = endsAt.get(k) ?? [];
      const through = vertexRoads.get(k) ?? [];
      if (ends.length !== 2 || through.length !== 2) return -1;
      const other = ends[0] === i ? ends[1] : ends[0];
      return other !== i && compat(i, other) ? other : -1;
    };
    const used = new Set<number>();
    // w0/w1: deck width AT each end — fused decks taper back to the real road width
    // where they die into dry pavement (full width squared off as a visible "wing")
    const bridge: { pts: number[]; w: number; w0: number; w1: number; c: string; l: number; bb: [number, number, number, number]; trim0: number; trim1: number; other0: number; other1: number }[] = [];
    const chainWays = new Map<number[], number[]>();   // chain pts -> exact member way indices (survives fusing)
    for (let i = 0; i < roads.length; i++) {
      if (used.has(i) || !roads[i].b) continue;
      // walk to the chain's start
      let cur = i, prevKey = kOf(roads[i].p[0], roads[i].p[1]);
      const seen = new Set([i]);
      for (;;) {
        const nxt = mergeableAt(prevKey, cur);
        if (nxt < 0 || seen.has(nxt)) break;   // seen-guard: ring roads terminate
        seen.add(nxt); cur = nxt;
        const p = roads[cur].p;
        const k0 = kOf(p[0], p[1]), k1 = kOf(p[p.length - 2], p[p.length - 1]);
        prevKey = prevKey === k0 ? k1 : k0;    // hop to the far end
        prevKey = kOf(...(prevKey.split(',').map(Number) as [number, number]));
      }
      // stitch forward from the start, orienting each way as we go
      const pts: number[] = [];
      let node = prevKey;
      let walk = cur;
      const chainSeen = new Set<number>();
      for (;;) {
        chainSeen.add(walk); used.add(walk);
        let p = roads[walk].p;
        if (kOf(p[0], p[1]) !== node) {   // reverse to flow start→end
          const rp: number[] = [];
          for (let j = p.length - 2; j >= 0; j -= 2) rp.push(p[j], p[j + 1]);
          p = rp;
        }
        const from = pts.length ? 2 : 0;  // skip the shared node on later ways
        for (let j = from; j < p.length; j++) pts.push(p[j]);
        node = kOf(p[p.length - 2], p[p.length - 1]);
        const nxt = mergeableAt(node, walk);
        if (nxt < 0 || chainSeen.has(nxt)) break;
        walk = nxt;
      }
      // merge-end trim: if a chain END touches another BRIDGE way (ramp joins a
      // span), pull this deck back to that deck's edge so caps/rails don't
      // slice across its surface
      const trimAt = (k: string): { t: number; other: number } => {
        let t = 0, other = -1;
        for (const ri of vertexRoads.get(k) ?? []) {
          if (chainSeen.has(ri) || !roads[ri].b) continue;
          if (roads[ri].w / 2 + 4 > t) { t = roads[ri].w / 2 + 4; other = ri; }
        }
        return { t, other };
      };
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (let j = 0; j + 1 < pts.length; j += 2) {
        if (pts[j] < bx0) bx0 = pts[j]; if (pts[j] > bx1) bx1 = pts[j];
        if (pts[j + 1] < by0) by0 = pts[j + 1]; if (pts[j + 1] > by1) by1 = pts[j + 1];
      }
      const m0 = trimAt(kOf(pts[0], pts[1]));
      const m1 = trimAt(kOf(pts[pts.length - 2], pts[pts.length - 1]));
      bridge.push({
        pts, w: roads[i].w, w0: roads[i].w, w1: roads[i].w, c: roads[i].c, l: layerOf(i), bb: [bx0, by0, bx1, by1],
        trim0: m0.t, trim1: m1.t, other0: m0.other, other1: m1.other,
      });
      chainWays.set(pts, [...chainSeen]);
    }
    // ---- fuse overlapping bridge decks: dual carriageways + stacked ramps ----
    // OSM maps a divided highway as two parallel ways, and a ramp split as several
    // piled ways. One-deck-per-chain then stacks those wide slabs at slightly
    // different headings into "origami" at the approach (the Gillis span was the
    // worst offender). Fuse each cluster of parallel, overlapping, same-class /
    // -layer bridge chains into ONE deck — centred, and wide enough to cover them
    // all — so the approach reads as a single clean carriageway.
    type BC = (typeof bridge)[number];
    {
      const len = (pts: number[]) => { let L = 0; for (let j = 0; j + 3 < pts.length; j += 2) L += Math.hypot(pts[j + 2] - pts[j], pts[j + 3] - pts[j + 1]); return L; };
      const bboxHit = (a: BC, b: BC, m: number) => a.bb[0] - m <= b.bb[2] && b.bb[0] - m <= a.bb[2] && a.bb[1] - m <= b.bb[3] && b.bb[1] - m <= a.bb[3];
      // fraction of A's vertices lying within lateral tol of B's centreline
      const overlapFrac = (A: BC, B: BC) => {
        const tol = (A.w + B.w) / 2 * 0.6, t2 = tol * tol;
        let hit = 0, tot = 0;
        for (let j = 0; j + 1 < A.pts.length; j += 2) { tot++; if (distToPolylineSq(A.pts[j], A.pts[j + 1], B.pts) <= t2) hit++; }
        return tot ? hit / tot : 0;
      };
      const parent = bridge.map((_, i) => i);
      const find = (i: number): number => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
      for (let a = 0; a < bridge.length; a++) for (let b = a + 1; b < bridge.length; b++) {
        const A = bridge[a], B = bridge[b];
        if (A.c !== B.c || A.l !== B.l || !bboxHit(A, B, (A.w + B.w) / 2)) continue;
        const short = A.pts.length <= B.pts.length ? A : B, long = short === A ? B : A;
        if (overlapFrac(short, long) >= 0.5) parent[find(a)] = find(b);   // parallel & overlapping ⇒ same deck
      }
      const groups = new Map<number, number[]>();
      for (let i = 0; i < bridge.length; i++) { const r = find(i); let g = groups.get(r); if (!g) groups.set(r, g = []); g.push(i); }
      // nearest point on pts to (x,y), returned as a signed offset along (nX,nZ)
      const nearestSigned = (x: number, y: number, nX: number, nZ: number, pts: number[]) => {
        let bd = Infinity, bx = x, by = y;
        for (let j = 0; j + 3 < pts.length; j += 2) {
          const ax = pts[j], az = pts[j + 1], ex = pts[j + 2] - ax, ez = pts[j + 3] - az;
          const l2 = ex * ex + ez * ez || 1;
          let s = ((x - ax) * ex + (y - az) * ez) / l2; s = s < 0 ? 0 : s > 1 ? 1 : s;
          const px = ax + ex * s, pz = az + ez * s, d = (px - x) ** 2 + (pz - y) ** 2;
          if (d < bd) { bd = d; bx = px; by = pz; }
        }
        return (bx - x) * nX + (by - y) * nZ;
      };
      // px: max lateral gap a way may sit from the spine and still FUSE. This is the
      // ceiling on a fused deck's half-width too (maxHw + CAP below), so it decides
      // how big one slab can get. At 150 a motorway could fuse out to a 428 px —
      // 53 m — plane: fine in Newburyport, whose Gillis dual carriageway only reaches
      // ~83 px, but Charlestown's interchange packs ramps right out to the limit and
      // the deck became a block-sized sheet that swallowed buildings and trees whole.
      // 96 still fuses any real divided carriageway; ramps further out keep their own
      // narrower decks, which is what an interchange should look like anyway.
      const CAP = 96;
      // a fused member LOSES its own deck, so it must ride the spine's covered band
      // for its ENTIRE length — judged by its worst (max) offset, not its median. A
      // rotary arc or link ramp that wanders off partway keeps its own deck instead:
      // overlapping decks are a cosmetic z-epsilon, an uncovered stretch is a HOLE
      // the player can't cross (Bridge St rotary, Beverly↔Salem span).
      const maxOffset = (m: BC, sp: number[]) => {
        let worst = 0;
        for (let j = 0; j + 1 < m.pts.length; j += 2) worst = Math.max(worst, distToPolylineSq(m.pts[j], m.pts[j + 1], sp));
        return Math.sqrt(worst);
      };
      const out: BC[] = [];
      for (const grp of groups.values()) {
        if (grp.length < 2) { out.push(bridge[grp[0]]); continue; }
        const members = grp.map((i) => bridge[i]);
        const spine = members.reduce((p, c) => len(c.pts) >= len(p.pts) ? c : p);
        const sp = spine.pts, n = sp.length / 2;
        // only FUSE ways that ride alongside the spine the whole way — a divergent
        // ramp that peels off is kept as its own deck, so it can't balloon the width
        const fuse = members.filter((m) => m === spine || maxOffset(m, sp) <= CAP);
        for (const m of members) if (m !== spine && !fuse.includes(m)) out.push(m);
        if (fuse.length < 2) { out.push(spine); continue; }
        const fusedWays = fuse.flatMap((m) => chainWays.get(m.pts) ?? []);
        const nx = new Float64Array(n), nz = new Float64Array(n);
        for (let i = 0; i < n; i++) {
          const ip = Math.max(0, i - 1), iq = Math.min(n - 1, i + 1);
          let dx = sp[2 * iq] - sp[2 * ip], dz = sp[2 * iq + 1] - sp[2 * ip + 1];
          const dl = Math.hypot(dx, dz) || 1;
          nx[i] = -dz / dl; nz[i] = dx / dl;
        }
        // cover interval [L,R] each node reaches across the fused ways, then reduce to
        // one scalar shift (centre) + half-width; a way only counts where it actually
        // runs alongside (its nearest point stays within CAP of the spine here)
        const lft = new Float64Array(n), rgt = new Float64Array(n);
        let shift = 0, maxHw = spine.w / 2;
        for (const m of fuse) maxHw = Math.max(maxHw, m.w / 2);
        for (let i = 0; i < n; i++) {
          let L = -spine.w / 2, R = spine.w / 2;
          for (const m of fuse) {
            if (m === spine) continue;
            const s = nearestSigned(sp[2 * i], sp[2 * i + 1], nx[i], nz[i], m.pts), h = m.w / 2;
            if (Math.abs(s) > CAP + h) continue;   // peeled away at this node
            if (s - h < L) L = s - h; if (s + h > R) R = s + h;
          }
          lft[i] = L; rgt[i] = R; shift += (L + R) / 2;
        }
        shift /= n;
        let hw = 0;
        for (let i = 0; i < n; i++) hw = Math.max(hw, rgt[i] - shift, shift - lft[i]);
        hw = Math.min(hw, maxHw + CAP);   // hard clamp — never balloon past a sane divided-road width
        const mp: number[] = [];
        for (let i = 0; i < n; i++) mp.push(sp[2 * i] + nx[i] * shift, sp[2 * i + 1] + nz[i] * shift);
        // the spine rarely reaches as far as every member: a dual carriageway's two
        // ways end at DIFFERENT points, and cutting the deck at the spine's end left
        // a hole of open water at the Beverly↔Salem landing (deck started ~170px off
        // the bank — uncrossable). Extend the merged centreline past each end to the
        // farthest member endpoint, so the fused deck covers the union of its parts.
        {
          const dx0 = mp[0] - mp[2], dz0 = mp[1] - mp[3];
          const l0 = Math.hypot(dx0, dz0) || 1, u0x = dx0 / l0, u0z = dz0 / l0;   // points outward past the start
          const m2 = mp.length;
          const dx1 = mp[m2 - 2] - mp[m2 - 4], dz1 = mp[m2 - 1] - mp[m2 - 3];
          const l1 = Math.hypot(dx1, dz1) || 1, u1x = dx1 / l1, u1z = dz1 / l1;   // outward past the end
          let over0 = 0, over1 = 0;
          for (const m of fuse) {
            if (m === spine) continue;
            for (const [ex, ez] of [[m.pts[0], m.pts[1]], [m.pts[m.pts.length - 2], m.pts[m.pts.length - 1]]]) {
              over0 = Math.max(over0, (ex - mp[0]) * u0x + (ez - mp[1]) * u0z);
              over1 = Math.max(over1, (ex - mp[m2 - 2]) * u1x + (ez - mp[m2 - 1]) * u1z);
            }
          }
          // extend only ends sitting over WATER (reaching for the shore) — a dry end
          // already dies into painted pavement, and extending it just shoves a wide
          // slab tail across the junction (the Gillis connector "wing")
          if (over0 > 4 && this.isWaterAt(mp[0], mp[1])) mp.unshift(mp[0] + u0x * over0, mp[1] + u0z * over0);
          if (over1 > 4 && this.isWaterAt(mp[mp.length - 2], mp[mp.length - 1])) mp.push(mp[mp.length - 2] + u1x * over1, mp[mp.length - 1] + u1z * over1);
        }
        let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
        for (let i = 0; i + 1 < mp.length; i += 2) {
          const px = mp[i], pz = mp[i + 1];
          if (px < bx0) bx0 = px; if (px > bx1) bx1 = px; if (pz < by0) by0 = pz; if (pz > by1) by1 = pz;
        }
        // a DRY end tapers back to the spine's real road width (the painted approach
        // takes over there); a WET end keeps full width — it's a landing over water
        const W = Math.round(hw * 2);
        const w0 = this.isWaterAt(mp[0], mp[1]) ? W : Math.min(W, spine.w);
        const w1 = this.isWaterAt(mp[mp.length - 2], mp[mp.length - 1]) ? W : Math.min(W, spine.w);
        out.push({ pts: mp, w: W, w0, w1, c: spine.c, l: spine.l, bb: [bx0, by0, bx1, by1], trim0: spine.trim0, trim1: spine.trim1, other0: spine.other0, other1: spine.other1 });
        chainWays.set(mp, fusedWays);   // absorbed ways now belong to the merged deck
      }
      bridge.length = 0; for (const b of out) bridge.push(b);
    }
    // register chain polylines so effLayer sees the right layer (clearance
    // bumps die silently otherwise — chains aren't in world.roads)
    this.effLayer(roads[0]?.p ?? []);   // ensure the map exists
    for (const ch of bridge) this.wayLayer!.set(ch.pts, ch.l);
    // a merge end inherits the OTHER deck's height there (a ramp that kept the
    // terrain grade would nose-dive under the span it joins) — resolve the
    // other WAY to its owning CHAIN so bridgeProfile can ask for its deck Y
    // exact membership recorded during the chain walk (and unioned through fusing) —
    // geometric nearest-guessing mis-resolved at junction knots where chains converge,
    // and a wrong owner feeds a wrong deck height into bridgeProfile's merge ends
    const wayChain = new Map<number, number[]>();
    for (const ch of bridge) for (const ri of chainWays.get(ch.pts) ?? []) wayChain.set(ri, ch.pts);
    for (const ch of bridge) {
      const e: { o0?: number[]; o1?: number[] } = {};
      if (ch.other0 >= 0) e.o0 = wayChain.get(ch.other0);
      if (ch.other1 >= 0) e.o1 = wayChain.get(ch.other1);
      if (e.o0 || e.o1) this.chainMergeEnds.set(ch.pts, e);
    }
    this.roadChainsCache = { bridge, junctions };
    return this.roadChainsCache;
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
  // Steepest grade a deck may climb away from its approach height. UNDERPASS_CLEAR
  // over BRIDGE_RAMP is 46/150 ≈ 0.31, so this preserves an ordinary single
  // underpass tent exactly and only bites on lifts that were never rideable.
  private static readonly MAX_DECK_GRADE = 0.32;
  static readonly DECK_T = 7;            // deck-slab thickness: top rides the profile, bottom sits T below
  private static readonly PIER_SPACING = 140; // columns this far apart along the span
  private static readonly CROSS_WINDOW = 60;   // no pier within this of a crossed road (leave the gap open)
  private bridgeProfiles = new Map<number[], BridgeProfile>();
  private chainMergeEnds = new Map<number[], { o0?: number[]; o1?: number[] }>();   // merge end -> the deck it tees into
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
    // re-entrant guard FIRST — merge-end lookups below recurse into neighbor
    // profiles (A tees into B tees into A must bottom out here, not overflow)
    if (this.bridgeComputing.has(pts)) {
      const fb = Math.max(h0, h1) + 2.5;
      return { g0: fb, g1: fb, total: 1, cum: [0], bumps: [], plateaus: [], ground0: true, ground1: true, supports: { piers: [], abut: [] } };
    }
    this.bridgeComputing.add(pts);
    // decks die INTO the pavement (+2.5, just proud of the paint) instead of the
    // old +6 step — the step was the visible stub at every approach and turned
    // short culvert bridges into plateaus (the 7/6 screenshot-2 slab). A MERGE
    // end (ramp teeing into another span) meets THAT deck's height instead.
    const merge = this.chainMergeEnds.get(pts);
    let g0 = merge?.o0 ? this.bridgeDeckYAt(merge.o0, pts[0], pts[1]) : h0 + 2.5;
    let g1 = merge?.o1 ? this.bridgeDeckYAt(merge.o1, pts[pts.length - 2], pts[pts.length - 1]) : h1 + 2.5;
    // A merge-end lookup reads ANOTHER span's deck, and when spans reference each
    // other in a cycle that can come back wild: Charlestown's Tobin Bridge approach
    // — a single 14,000 px chain — resolved its far end to 776 px BELOW ground with
    // the terrain at +54, and the short ramp teeing into it then had to climb out of
    // the earth at 45°, which is the triangular spike players got stuck inside.
    // A merge may RAISE a deck end onto the span it joins; it may never bury it below
    // its own approach, which is exactly the +2.5 default used when there is no merge.
    if (merge?.o0) g0 = Math.max(g0, h0 + 2.5);
    if (merge?.o1) g1 = Math.max(g1, h1 + 2.5);
    // an end OVER WATER has no pavement to die into — the +2.5 fallback would ride
    // the seabed (-80s at the Bridge St rotary) and the deck plunged into the sea,
    // leaving an uncrossable hole mid-junction. Any wet end floats at span height.
    const floor = WATER_Y + WorldIndex.WATER_CLEAR;
    if (g0 < floor && (this.isWaterAt(pts[0], pts[1]) || h0 < WATER_Y)) g0 = floor;
    if (g1 < floor && (this.isWaterAt(pts[pts.length - 2], pts[pts.length - 1]) || h1 < WATER_Y)) g1 = floor;
    const myLayer = this.effLayer(pts);
    const cum: number[] = [0];
    for (let i = 0; i + 3 < pts.length; i += 2) {
      cum.push(cum[cum.length - 1] + Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]));
    }
    const total = cum[cum.length - 1];
    // the deck rides a LINEAR grade from g0 to g1, so each end meets its approach road
    // instead of floating at the higher bank; features lift ABOVE this grade
    const gradeAt = (tt: number) => g0 + (g1 - g0) * Math.max(0, Math.min(1, tt / Math.max(1, total)));
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
          if (peak > gradeAt(t)) bumps.push({ t, peak });
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
    // Crossings get the SAME treatment the water span above already gets: one flat
    // run, not a wobbly point-tent each. A tent per crossing scalloped the deck —
    // Charlestown's interchange chains carry up to 22 crossings with gaps as small
    // as 2 px against a 150 px ramp, so the deck began climbing for the next one
    // before it had come down from the last and rippled 18 times along its length.
    // Real elevated highways hold a constant grade across a whole interchange.
    // Bumps closer than one ramp length merge into a plateau at the cluster's peak.
    const plateaus: { s: number; e: number; peak: number }[] = [];
    for (const b of [...bumps].sort((p, q) => p.t - q.t)) {
      const last = plateaus[plateaus.length - 1];
      if (last && b.t - last.e <= WorldIndex.BRIDGE_RAMP) {
        last.e = b.t;
        last.peak = Math.max(last.peak, b.peak);
      } else {
        plateaus.push({ s: b.t, e: b.t, peak: b.peak });
      }
    }
    prof = { g0, g1, total, cum, bumps, plateaus, water, ground0: !merge?.o0, ground1: !merge?.o1, supports: { piers: [], abut: [] } };
    this.bridgeProfiles.set(pts, prof);
    this.bridgeComputing.delete(pts); // cached now; deeper queries hit the cache, not recursion

    // ---- structural supports: piers along the span + abutments at the banks ----
    // (deck-top height comes from the shared deckHeightAtT, now that prof is cached)
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
      const topY = this.deckHeightAtT(prof, tt) - T;
      const footY = this.isWaterAt(x, z) ? WATER_Y - 8 : this.terrain.heightAt(x, z) - 4;
      if (topY - footY < 10) continue; // deck hugs the grade here — no column to draw
      prof.supports.piers.push({ x, z, footY, topY, ux, uz });
    }
    // abutments seat the deck ends into the banks (close any gap at the lower bank)
    for (const tEnd of [Math.min(20, total / 2), Math.max(total - 20, total / 2)]) {
      const [x, z, ux, uz] = xzAtT(tEnd);
      const topY = this.deckHeightAtT(prof, tEnd) - T;
      const footY = this.terrain.heightAt(x, z) - 6;
      if (topY - footY < 8) continue;   // flush approach — nothing to seat
      prof.supports.abut.push({ x, z, footY, topY, ux, uz });
    }
    return prof;
  }

  // deck-top height at arc-length t: the bank-to-bank grade, lifted only where a
  // feature demands it — a flat span clear of the water, or a clearance tent over a
  // crossed road — each ramping back DOWN to the grade so the ends meet their approaches
  private deckHeightAtT(prof: BridgeProfile, t: number): number {
    const grade = prof.g0 + (prof.g1 - prof.g0) * Math.max(0, Math.min(1, t / Math.max(1, prof.total)));
    let deck = grade;
    // A clearance tent may only rise as fast as a road can climb, and only as far
    // as the span has room to ramp back down to BOTH ends. Without this a short
    // bridge asked to clear a high crossing becomes a triangular spike standing in
    // the roadway — and the deck is a collider, so players walk into it and stick.
    // Charlestown is where this surfaced: its stacked interchange ramps demanded a
    // 172 px (21 m) lift on a 221 px (27 m) span, and clearance STACKING ran away
    // besides — a bridge tenting over an already-tented bridge adds a full
    // UNDERPASS_CLEAR each time, which put a service road 590 px in the air.
    // Newburyport never hit it: its interchange is terrain-separated, so `layer`
    // is inert there and almost nothing tents.
    //
    // Room is measured only to the ends that are actually ON THE GROUND. A merge
    // end lands on another span's deck and is already airborne, so there is nothing
    // to come down to on that side — without this, a stacked ramp got pancaked flat
    // and its soffit sank below duck-under height, turning the interchange into a
    // low black mat you could neither pass under nor climb.
    const room = Math.min(prof.ground0 ? t : Infinity, prof.ground1 ? prof.total - t : Infinity);
    const rampRoom = room === Infinity ? Infinity : room * WorldIndex.MAX_DECK_GRADE;
    for (const pl of prof.plateaus) {
      // inside the run the deck is FLAT at the cluster's peak; outside it ramps
      // down over one BRIDGE_RAMP, exactly like the water span
      const out = t < pl.s ? pl.s - t : t > pl.e ? t - pl.e : 0;
      if (out < WorldIndex.BRIDGE_RAMP) {
        const want = pl.peak - (out / WorldIndex.BRIDGE_RAMP) * (pl.peak - grade);
        deck = Math.max(deck, Math.min(want, grade + rampRoom));
      }
    }
    if (prof.water) {
      const { s, e } = prof.water;
      const flatH = WATER_Y + WorldIndex.WATER_CLEAR; // flat, clear of the surface for boats
      let wy: number;
      if (t <= s) wy = grade + (flatH - grade) * (s > 0 ? Math.min(1, t / s) : 1);             // ramp up from the start bank
      else if (t >= e) wy = grade + (flatH - grade) * (prof.total > e ? Math.min(1, (prof.total - t) / (prof.total - e)) : 1); // down to the end bank
      else wy = flatH;                                                                          // flat across the channel
      // same ramp-room limit as the clearance tents: when the water window runs
      // right up to a bank there is no distance to climb in, and the span reared up
      // at 45°. Long spans (every drawbridge and river crossing in the set) have
      // ramp room to spare, so their profiles are untouched.
      deck = Math.max(deck, Math.min(wy, grade + rampRoom));
    }
    // bank ends are ALWAYS mountable: whatever clearance humps demand mid-span,
    // the last stretch ramps to <= +20 over the approach grade (a crossed way
    // right at a bank may shave the soffit — better than an unclimbable wall)
    const endD = Math.min(t, prof.total - t);
    if (endD < 44) deck = Math.min(deck, (t < prof.total / 2 ? prof.g0 : prof.g1) + 18 + endD);
    return deck;
  }

  // deck height at a world point: project to the nearest arc-length, then evaluate
  bridgeDeckYAt(pts: number[], x: number, y: number): number {
    const prof = this.bridgeProfile(pts);
    let bestD = Infinity, t = 0;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i], ay = pts[i + 1];
      const ex = pts[i + 2] - ax, ey = pts[i + 3] - ay;
      const len2 = ex * ex + ey * ey;
      let s = len2 > 0 ? ((x - ax) * ex + (y - ay) * ey) / len2 : 0;
      s = Math.max(0, Math.min(1, s));
      const px2 = ax + ex * s, py2 = ay + ey * s;
      const d = (x - px2) ** 2 + (y - py2) ** 2;
      if (d < bestD) { bestD = d; t = (prof.cum[i / 2] ?? 0) + Math.sqrt(len2) * s; }
    }
    return this.deckHeightAtT(prof, t);
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
    // 22: a clearance hump near a bank can leave the deck end ~15px proud of
    // the approach (a crossed road needs headroom right up to the abutment) —
    // that step must stay mountable, like stairs
    if (d <= from + 22) return Math.max(t, d);
    // A slab you cannot fit beneath is not a wall — you walk OVER it. Otherwise a
    // low ramp deck reads as an invisible barrier, which is what made Charlestown's
    // interchange impassable: every approach sat just high enough to refuse a step
    // up and just low enough to refuse a duck under.
    if ((d - WorldIndex.DECK_T) - t < WorldIndex.KID_CLEAR) return Math.max(t, d);
    return t;
  }

  // Walking UNDER a span is fine where there's headroom; this blocks the two
  // ways it used to break: wading into the low approach wedge (the kid clipped
  // through the slab) and strolling through solid abutments/pier walls. Only
  // consulted when the player is BELOW the deck — standing ON it never blocks.
  static readonly KID_CLEAR = 34;   // kid height + hat
  underDeckBlockedAt(x: number, y: number, playerY: number): boolean {
    const d = this.deckHeightAt(x, y);
    // "on the deck" includes a mountable step — surfaceYAt climbs decks up to
    // +14, so entry at a flush approach (deck top ~2.5 above the road) must
    // never read as "under". This was blocking walking ONTO bridges at their ends.
    if (d <= 0 || playerY >= d - 22) return false;             // no deck / on or stepping onto it
    const key = Math.floor(x / CHUNK) + ',' + Math.floor(y / CHUNK);
    const dc = this.deckCache.get(key);
    if (!dc) return false;
    // TWO passes: dual carriageways overlap at their edges, so a point can sit
    // on one deck's mountable end AND inside its neighbor's elevated footprint.
    // Being on/stepping onto ANY deck wins — only then do blockers apply.
    const near = dc.bridges.filter((r) => distToPolylineSq(x, y, r.p) <= (r.w / 2 + 5) ** 2);
    for (const r of near) {
      if (playerY >= this.bridgeDeckYAt(r.p, x, y) - 22) return false;   // on a deck (or stepping onto it)
    }
    for (const r of near) {
      const topY = this.bridgeDeckYAt(r.p, x, y);
      const clear = (topY - WorldIndex.DECK_T) - this.heightAtPx(x, y);
      // too low to duck under is no longer a blocker: surfaceYAt now walks the
      // player OVER a slab like that, so stopping them here would be the invisible
      // wall all over again. Solid supports below still block.
      if (clear < WorldIndex.KID_CLEAR) continue;
      // solid supports: abutments + pier walls (same dims decor builds them with)
      const sup = this.bridgeProfile(r.p).supports;
      const hw = (r.w + 4) / 2;
      const inRect = (cx: number, cz: number, ux: number, uz: number, ha: number, hc: number) => {
        const dx = x - cx, dz = y - cz;
        const along = dx * ux + dz * uz, across = -dx * uz + dz * ux;
        return Math.abs(along) < ha + 2 && Math.abs(across) < hc + 2;
      };
      for (const a of sup.abut) if (inRect(a.x, a.z, a.ux, a.uz, 15, hw * 0.95)) return true;
      for (const p of sup.piers) if (inRect(p.x, p.z, p.ux, p.uz, 5, hw * 0.62)) return true;
    }
    return false;
  }

  // ---------- camera occlusion ----------
  // absolute top of the tallest building covering a point (rough eave + roof
  // allowance, mirroring decor's buildingDims) — lets the chase camera test
  // its sight line analytically instead of raycasting merged meshes
  private bldgCamCache = new Map<number, { bb: [number, number, number, number]; h: number }>();

  // Largest half-width at which a deck may be drawn here WITHOUT slicing a building.
  // A viaduct passing over a low shed is fine — the deck clears its roof — but where
  // a building rises through the deck plane the ribbon has to pull in, or the house
  // is rendered chopped off at road height. That is what Charlestown's fused
  // Rutherford Ave deck did: a 40 m slab drawn straight through the houses beside it,
  // leaving roofs poking out of the asphalt.
  // Only consulted for WIDE decks (see the caller) — a normal-width span costs nothing.
  static readonly DECK_MIN_HW = 30;   // px — never pinch a deck below a crossable width
  // Decks at least this wide consult the building clearance. Narrower spans are
  // slimmer than the setback beside them and never slice anything, so they skip the
  // probe. The RENDERER and the footing test must use the SAME number or the player
  // walks on an invisible slab — hence one constant, read by both.
  static readonly DECK_CLEAR_MIN_W = 80;
  deckHalfWidthLimit(x: number, z: number, lX: number, lZ: number, hw: number, deckY: number): number {
    const soffit = deckY - WorldIndex.DECK_T;
    let lim = hw;
    for (const s of [1, -1] as const) {
      for (let d = WorldIndex.DECK_MIN_HW; d <= hw; d += 12) {
        if (this.buildingTopAt(x + lX * s * d, z + lZ * s * d) > soffit) { lim = Math.min(lim, d - 12); break; }
      }
    }
    return Math.max(WorldIndex.DECK_MIN_HW, lim);
  }

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
        // ⚠️ NOT clamped at 5 any more. This is what the chase camera uses to
        // decide whether something is between it and the kid, and it used to
        // believe a sixty-storey tower was five storeys — so the camera happily
        // sat inside the Prudential. It has to mirror decor.ts's buildingDims,
        // including its two-regime storey height above HIGHRISE_LV.
        let lv = Math.max(1, b.lv || 1.5);
        const HIGHRISE = 8;
        const tiered = (per: number) => 8 + Math.min(lv, HIGHRISE) * per + Math.max(0, lv - HIGHRISE) * 30;
        let h: number;
        switch (b.k) {
          case 'shed': h = 22; break;
          case 'church': h = 95; break; // steeple country
          case 'commercial':
          case 'civic':
            if (areaM2 > 140) lv = Math.max(lv, 3);
            h = tiered(23) + 7;
            break;
          case 'industrial': h = tiered(21) + 7; break;
          default:
            if (areaM2 > 110) lv = Math.max(lv, 2.2);
            h = 12 + Math.min(lv, HIGHRISE) * 15 + Math.max(0, lv - HIGHRISE) * 26 + 20; // gable ridge allowance
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

  // open, kayak-able water: the river / harbor / ocean — NOT inland ponds (those are
  // small freezable bodies you walk across in winter, never paddle). Gates the KAYAK
  // affordance + launch so the boat only ever offers on the real waterways.
  isOpenWaterAt(x: number, y: number): boolean {
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
      if (!isFreezableWater(poly) && pointInPoly(x, y, poly)) return true;
    }
    return false;
  }

  // is (x,y) on a pier/dock footprint? ambient boats steer around these so they
  // don't sail straight through the docks.
  private pierBB: { poly: Poly; bb: [number, number, number, number] }[] | null = null;
  private pierCache = new Map<string, Poly[]>();
  pierAt(x: number, y: number): boolean {
    if (!this.pierBB) {
      this.pierBB = [];
      for (const poly of this.world.polys) if (poly.k === 'pier' && (poly.s === 'greasy' || !floatOutForWinter(poly.p))) this.pierBB.push({ poly, bb: bboxOf(poly.p) });
    }
    const ckx = Math.floor(x / CHUNK), cky = Math.floor(y / CHUNK);
    const key = ckx + ',' + cky;
    let cand = this.pierCache.get(key);
    if (!cand) {
      const ox = ckx * CHUNK, oy = cky * CHUNK;
      cand = [];
      for (const { poly, bb } of this.pierBB) {
        if (bb[2] < ox || bb[0] > ox + CHUNK || bb[3] < oy || bb[1] > oy + CHUNK) continue;
        cand.push(poly);
      }
      this.pierCache.set(key, cand);
    }
    for (const poly of cand) if (pointInPoly(x, y, poly)) return true;
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
      if (bar.k !== 'fence' && bar.k !== 'hedge' && bar.k !== 'wall' && bar.k !== 'picket') continue;
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

// the sharpest heading change (radians) between consecutive segments of a
// polyline — wide-road lane dashes are skipped on curvy streets, where the
// interior parallels diverge from the pavement and read as clutter (the edge
// lines + centerline still define the road on a curve).
function maxTurn(pts: number[]): number {
  let m = 0;
  for (let i = 2; i + 3 < pts.length; i += 2) {
    const ax = pts[i] - pts[i - 2], ay = pts[i + 1] - pts[i - 1];
    const bx = pts[i + 2] - pts[i], by = pts[i + 3] - pts[i + 1];
    const al = Math.hypot(ax, ay), bl = Math.hypot(bx, by);
    if (al < 1 || bl < 1) continue;
    const d = Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by) / (al * bl))));
    if (d > m) m = d;
  }
  return m;
}

// a mitred parallel of a polyline, o px to the left (+) / right (-) of travel —
// highway edge lines hug the shoulder. Clamped 1.4x so corners pinch, not spike.
function offsetLine(pts: number[], o: number): number[] {
  const n = pts.length / 2, out: number[] = [];
  for (let i = 0; i < n; i++) {
    const ip = Math.max(0, i - 1), iq = Math.min(n - 1, i + 1);
    let aX = pts[i * 2] - pts[ip * 2], aZ = pts[i * 2 + 1] - pts[ip * 2 + 1];
    let bX = pts[iq * 2] - pts[i * 2], bZ = pts[iq * 2 + 1] - pts[i * 2 + 1];
    const al = Math.hypot(aX, aZ) || 1, bl = Math.hypot(bX, bZ) || 1;
    aX /= al; aZ /= al; bX /= bl; bZ /= bl;
    let mX = aX + bX, mZ = aZ + bZ;
    const ml = Math.hypot(mX, mZ);
    if (ml < 1e-6) { mX = aX; mZ = aZ; } else { mX /= ml; mZ /= ml; }
    const sc = o / Math.min(1.4, Math.max(0.72, Math.abs(mX * aX + mZ * aZ)));
    out.push(pts[i * 2] - mZ * sc, pts[i * 2 + 1] + mX * sc);
  }
  return out;
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

export function pointInPoly(x: number, y: number, poly: Poly): boolean {
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
