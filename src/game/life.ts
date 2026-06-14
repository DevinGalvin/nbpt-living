import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { WorldIndex, CHUNK } from '../world/index';
import { hash32, mulberry32 } from '../world/style';
import { WATER_Y } from '../three/water';

// Ambient life: pedestrians who follow the sidewalk network exactly, cars
// that drive road polylines, and boats cruising the real water. Nothing spawns
// or despawns where the player can see. Nobody passes through anybody.

const PEDS = 22;
const CARS = 10;
const BOATS = 4;
const GULLS = 7;

const SHIRTS = ['#b03a32', '#3e5c84', '#54652c', '#c8a142', '#7c4a68', '#2e6e63', '#8a4a2e', '#5b5e66', '#a8625a', '#46698c'];
const PANTS = ['#3b4d6b', '#54565c', '#6e5a40', '#444a54', '#7a7c84'];
const SKINS = ['#eec39a', '#d9a06e', '#b97f52', '#8e5c38', '#f2d3b0'];
const HAIRS = ['#4a3320', '#23201c', '#8a6232', '#b8b2a4', '#5e3c22', '#d8c690'];
const CAR_COLORS = ['#b5443a', '#3e5c84', '#d8d5cc', '#3a3c40', '#7c8b96', '#5e7e54', '#c8b04a', '#7a4a68'];

const WALK_CLASSES = ['side', 'foot', 'ped', 'board', 'cycle'];
const HOP_CLASSES = ['side', 'foot', 'ped', 'board', 'cycle', 'crossing']; // crossings = legal street crossing

const matCache = new Map<string, THREE.MeshLambertMaterial>();
function mat(hex: string): THREE.MeshLambertMaterial {
  let m = matCache.get(hex);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: hex });
    matCache.set(hex, m);
  }
  return m;
}

function box(w: number, h: number, d: number, hex: string, pivotTop = false): THREE.Mesh {
  const g = new THREE.BoxGeometry(w, h, d);
  if (pivotTop) g.translate(0, -h / 2, 0);
  const m = new THREE.Mesh(g, mat(hex));
  m.castShadow = true;
  return m;
}

// soft shapes for the town extras — same cached materials
function cap(r: number, len: number, hex: string, pivotTop = false): THREE.Mesh {
  const g = new THREE.CapsuleGeometry(r, len, 4, 10);
  if (pivotTop) g.translate(0, -(len / 2 + r), 0);
  const m = new THREE.Mesh(g, mat(hex));
  m.castShadow = true;
  return m;
}

function sph(r: number, hex: string, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), mat(hex));
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}

function rbox(w: number, h: number, d: number, rad: number, hex: string): THREE.Mesh {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, rad), mat(hex));
  m.castShadow = true;
  return m;
}

// wheel: cylinder lying on its side (axis along x)
function cylX(r: number, w: number, hex: string): THREE.Mesh {
  const g = new THREE.CylinderGeometry(r, r, w, 10);
  g.rotateZ(Math.PI / 2);
  const m = new THREE.Mesh(g, mat(hex));
  m.castShadow = true;
  return m;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function polyLen(pts: number[]): number {
  let len = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) len += Math.hypot(pts[i + 2] - pts[i], pts[i + 3] - pts[i + 1]);
  return len;
}

function alongPolyline(pts: number[], t: number): { x: number; z: number; dx: number; dz: number } | null {
  let acc = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i], z0 = pts[i + 1], x1 = pts[i + 2], z1 = pts[i + 3];
    const seg = Math.hypot(x1 - x0, z1 - z0);
    if (seg < 0.001) continue;
    if (acc + seg >= t) {
      const f = (t - acc) / seg;
      return { x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, dx: (x1 - x0) / seg, dz: (z1 - z0) / seg };
    }
    acc += seg;
  }
  return null;
}

class Walker {
  root = new THREE.Group();
  private heading = new THREE.Group();
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  private armL: THREE.Mesh;
  private armR: THREE.Mesh;
  private phase = Math.random() * 6;
  private face = Math.random() * Math.PI * 2;
  pts: number[] = [];
  total = 1;
  t = 0;
  dir = 1;
  speed = 30 + Math.random() * 22;
  sepX = 0;          // persistent side-step so walkers never overlap
  sepZ = 0;

  constructor(seed: number) {
    const rng = mulberry32(seed);
    const shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)];
    const pants = PANTS[Math.floor(rng() * PANTS.length)];
    const skin = SKINS[Math.floor(rng() * SKINS.length)];
    const hair = HAIRS[Math.floor(rng() * HAIRS.length)];
    this.legL = cap(1.7, 7.6, pants, true);
    this.legR = cap(1.7, 7.6, pants, true);
    this.legL.position.set(-2.4, 11, 0);
    this.legR.position.set(2.4, 11, 0);
    const body = cap(3.4, 5.4, shirt);
    body.scale.set(1.3, 1, 0.85);
    body.position.y = 16.5;
    const head = sph(3.7, skin, 1, 0.95, 0.95);
    head.position.y = 26;
    const hairCap = sph(3.85, hair, 1.02, 0.68, 1);
    hairCap.position.y = 27.4;
    this.armL = cap(1.2, 4.8, shirt, true);
    this.armR = cap(1.2, 4.8, shirt, true);
    this.armL.position.set(-5.6, 21.5, 0);
    this.armR.position.set(5.6, 21.5, 0);
    this.heading.scale.setScalar(0.92 + rng() * 0.18);
    this.heading.add(this.legL, this.legR, body, head, hairCap, this.armL, this.armR);
    this.heading.rotation.y = this.face;
    this.root.add(this.heading);
  }

  // returns true when the end of the current path is reached
  advance(dt: number, groundY: number): boolean {
    this.t += this.speed * dt * this.dir;
    const ended = this.t <= 0 || this.t >= this.total;
    const clamped = Math.max(0.5, Math.min(this.total - 0.5, this.t));
    const spot = alongPolyline(this.pts, clamped);
    if (spot) {
      this.root.position.x = spot.x;
      this.root.position.z = spot.z;
      this.face = lerpAngle(this.face, Math.atan2(spot.dx * this.dir, spot.dz * this.dir), Math.min(1, dt * 6));
      this.phase += dt * 8;
      const s = Math.sin(this.phase) * 0.55;
      this.legL.rotation.x = s;
      this.legR.rotation.x = -s;
      this.armL.rotation.x = -s * 0.8;
      this.armR.rotation.x = s * 0.8;
    }
    this.heading.rotation.y = this.face;
    this.root.position.y += (groundY - this.root.position.y) * Math.min(1, dt * 10);
    return ended;
  }
}

class TrafficCar {
  root = new THREE.Group();
  pts: number[] = [];
  roadW = 7;
  t = 0;
  total = 1;
  dir = 1;
  speed = 120;
  cruise = 120;      // speed to return to once the way ahead is clear
  private face = 0;

  constructor(seed: number) {
    const rng = mulberry32(seed);
    const hex = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    const body = rbox(14, 7, 34, 2.2, hex);
    body.position.y = 6.5;
    const cabin = rbox(12, 6.4, 17, 2.4, '#2e3338');
    cabin.position.set(0, 11.8, -2);
    for (const [lx, lz] of [[-7.2, 10.5], [7.2, 10.5], [-7.2, -10.5], [7.2, -10.5]] as const) {
      const wheel = cylX(2.6, 2.4, '#23241f');
      wheel.position.set(lx, 2.6, lz);
      this.root.add(wheel);
    }
    this.root.add(body, cabin);
  }

  step(dt: number, groundY: number): boolean {
    this.t += this.speed * dt * this.dir;
    const ended = this.t <= 2 || this.t >= this.total - 2;
    const clamped = Math.max(2, Math.min(this.total - 2, this.t));
    const spot = alongPolyline(this.pts, clamped);
    if (spot) {
      const off = this.roadW * 0.22 * this.dir;
      this.root.position.x = spot.x - spot.dz * off;
      this.root.position.z = spot.z + spot.dx * off;
      const ang = Math.atan2(spot.dx * this.dir, spot.dz * this.dir);
      this.face = lerpAngle(this.face, ang, Math.min(1, dt * 5));
      this.root.rotation.y = this.face;
      this.root.position.y += (groundY - this.root.position.y) * Math.min(1, dt * 8);
    }
    return ended;
  }
}

class WanderBoat {
  root = new THREE.Group();
  active = false;
  speed = 50;
  checkAcc = 0;
  private heading = 0;
  private targetX = 0;
  private targetZ = 0;
  private bobPhase = Math.random() * 6;

  constructor(seed: number) {
    const rng = mulberry32(seed);
    const hullHex = ['#f4f1e8', '#e9e6db', '#27425c', '#7e3434'][Math.floor(rng() * 4)];
    // smooth hull: a squashed capsule lying along +z (rounded bow and stern)
    const hullGeo = new THREE.CapsuleGeometry(12, 44, 5, 12);
    hullGeo.rotateX(Math.PI / 2);
    hullGeo.scale(1, 0.5, 1);
    const body = new THREE.Mesh(hullGeo, new THREE.MeshLambertMaterial({ color: hullHex }));
    body.castShadow = true;
    body.position.y = 2.6;
    const trim = rbox(18, 2.4, 54, 1, '#b9926a');
    trim.position.y = 9;
    this.root.add(body, trim);
    if (rng() < 0.5) {
      // sloop under power, sails furled
      const mast = cap(1.3, 62, '#ece8dc');
      mast.position.y = 40;
      const boom = rbox(3, 3, 30, 1.2, '#d8d2c2');
      boom.position.set(0, 17, -10);
      this.root.add(mast, boom);
    } else {
      // lobster-boat wheelhouse
      const house = rbox(17, 16, 26, 3, '#f8f6ee');
      house.position.set(0, 17, 8);
      const roof = rbox(19, 2.8, 28, 1.2, '#4a4640');
      roof.position.set(0, 26.5, 8);
      this.root.add(house, roof);
    }
    this.speed = 40 + rng() * 45;
  }

  setTarget(x: number, z: number) {
    this.targetX = x;
    this.targetZ = z;
  }

  // glide toward the target with a gentle bob + roll; true when arrived
  glide(dt: number, t: number): boolean {
    const dx = this.targetX - this.root.position.x;
    const dz = this.targetZ - this.root.position.z;
    this.heading = lerpAngle(this.heading, Math.atan2(dx, dz), Math.min(1, dt * 0.9));
    this.root.rotation.y = this.heading;
    this.root.position.x += Math.sin(this.heading) * this.speed * dt;
    this.root.position.z += Math.cos(this.heading) * this.speed * dt;
    this.root.position.y = WATER_Y + Math.sin(t * 0.0013 + this.bobPhase) * 0.5;
    this.root.rotation.z = Math.sin(t * 0.0009 + this.bobPhase) * 0.04;
    return Math.hypot(dx, dz) < 70;
  }
}

// a seagull wheeling in a lazy circle over the harbor: gliding body, banking
// into the turn, wings rocking in a slow flap
class Gull {
  root = new THREE.Group();
  active = false;
  cx = 0; cz = 0;
  ang = 0;
  radius = 120;
  private spin = 0.5;
  private alt = 150;
  private phase = 0;
  private wingL: THREE.Mesh;
  private wingR: THREE.Mesh;

  constructor(seed: number) {
    const rng = mulberry32(seed);
    const body = sph(2.4, '#f2f2ec', 0.9, 0.75, 2.0);
    const head = sph(1.5, '#f6f6f0'); head.position.set(0, 0.5, 3.0);
    const beak = box(0.7, 0.7, 1.8, '#e0a23a'); beak.position.set(0, 0.3, 4.4);
    this.wingL = box(9, 0.5, 4.0, '#dfe2e3'); this.wingL.position.set(-5, 0.4, 0);
    this.wingR = box(9, 0.5, 4.0, '#dfe2e3'); this.wingR.position.set(5, 0.4, 0);
    this.root.add(body, head, beak, this.wingL, this.wingR);
    this.spin = (rng() < 0.5 ? -1 : 1) * (0.28 + rng() * 0.3);
    this.radius = 80 + rng() * 150;
    this.alt = 95 + rng() * 150;
    this.phase = rng() * 6;
  }

  glide(dt: number, t: number) {
    this.ang += this.spin * dt;
    const x = this.cx + Math.cos(this.ang) * this.radius;
    const z = this.cz + Math.sin(this.ang) * this.radius;
    this.root.position.set(x, this.alt + Math.sin(t * 0.0011 + this.phase) * 9, z);
    this.root.rotation.y = this.ang + (this.spin > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.root.rotation.z = (this.spin > 0 ? 1 : -1) * 0.32; // bank into the turn
    const flap = Math.sin(t * 0.006 + this.phase) * 0.5;
    this.wingL.rotation.z = 0.2 + flap;
    this.wingR.rotation.z = -0.2 - flap;
  }
}

export class Life {
  private index: WorldIndex;
  private peds: Walker[] = [];
  private cars: TrafficCar[] = [];
  private boats: WanderBoat[] = [];
  private gulls: Gull[] = [];

  constructor(scene: THREE.Scene, index: WorldIndex) {
    this.index = index;
    for (let i = 0; i < PEDS; i++) {
      const p = new Walker(i * 977 + 11);
      p.root.position.set(0, 0, 1e7);
      this.peds.push(p);
      scene.add(p.root);
    }
    for (let i = 0; i < CARS; i++) {
      const car = new TrafficCar(i * 569 + 7);
      car.root.position.set(0, 0, 1e7);
      this.cars.push(car);
      scene.add(car.root);
    }
    for (let i = 0; i < BOATS; i++) {
      const b = new WanderBoat(i * 313 + 29);
      b.root.position.set(0, 0, 1e7);
      this.boats.push(b);
      scene.add(b.root);
    }
    for (let i = 0; i < GULLS; i++) {
      const gl = new Gull(i * 197 + 13);
      gl.root.position.set(0, 0, 1e7);
      this.gulls.push(gl);
      scene.add(gl.root);
    }
  }

  // the player can't walk through cars or people (and they step around the player)
  obstacleAt(x: number, z: number): boolean {
    for (const c of this.cars) {
      if (!c.pts.length) continue;
      const dx = x - c.root.position.x, dz = z - c.root.position.z;
      if (dx * dx + dz * dz < 20 * 20) return true;
    }
    for (const p of this.peds) {
      if (!p.pts.length) continue;
      const dx = x - p.root.position.x, dz = z - p.root.position.z;
      if (dx * dx + dz * dz < 7.5 * 7.5) return true;
    }
    return false;
  }

  private clearWater(x: number, z: number, r: number): boolean {
    // inside the mapped water AND deep enough to float (tidal flats rise above the surface)
    return this.index.isWaterAt(x, z)
      && this.index.isWaterAt(x + r, z) && this.index.isWaterAt(x - r, z)
      && this.index.isWaterAt(x, z + r) && this.index.isWaterAt(x, z - r)
      && this.index.heightAtPx(x, z) < WATER_Y - 1.5;
  }

  // a navigable leg: open water the whole way
  private boatTarget(b: WanderBoat, rng: () => number): boolean {
    const x0 = b.root.position.x, z0 = b.root.position.z;
    for (let tries = 0; tries < 10; tries++) {
      const a = b.root.rotation.y + (rng() - 0.5) * (tries < 5 ? 1.7 : Math.PI * 2);
      const d = 350 + rng() * 700;
      let ok = true;
      for (let s = 60; s <= d; s += 60) {
        if (!this.clearWater(x0 + Math.sin(a) * s, z0 + Math.cos(a) * s, 34)) { ok = false; break; }
      }
      if (!ok) continue;
      b.setTarget(x0 + Math.sin(a) * d, z0 + Math.cos(a) * d);
      return true;
    }
    return false;
  }

  // a spawn point is OK if the player can't watch it happen:
  // far enough to be fog-hazed, or outside the camera's forward cone
  private okToSpawn(x: number, z: number, px: number, pz: number, fx: number, fz: number, minD: number, fogD: number): boolean {
    const dx = x - px, dz = z - pz;
    const d = Math.hypot(dx, dz);
    if (d < minD) return false;
    if (d > fogD) return true;
    const dot = (dx / d) * fx + (dz / d) * fz;
    return dot < 0.15; // beside or behind the camera
  }

  private pathSpot(px: number, pz: number, radius: number, rng: () => number): { pts: number[]; total: number; t: number } | null {
    for (let tries = 0; tries < 10; tries++) {
      const cx = Math.floor((px + (rng() - 0.5) * radius * 2) / CHUNK);
      const cz = Math.floor((pz + (rng() - 0.5) * radius * 2) / CHUNK);
      const bucket = this.index.buckets.get(cx + ',' + cz);
      if (!bucket || !bucket.paths.length) continue;
      const p = this.index.world.paths[bucket.paths[Math.floor(rng() * bucket.paths.length)]];
      if (!WALK_CLASSES.includes(p.c)) continue;
      const total = polyLen(p.p);
      if (total < 40) continue;
      return { pts: p.p, total, t: 10 + rng() * (total - 20) };
    }
    return null;
  }

  // hop to a connecting path whose endpoint touches ours (crossings included)
  private hopFrom(x: number, z: number, currentPts: number[], rng: () => number): { pts: number[]; total: number; t: number; dir: number } | null {
    const key = Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK);
    const bucket = this.index.buckets.get(key);
    if (!bucket) return null;
    const candidates: { pts: number[]; total: number; t: number; dir: number }[] = [];
    for (const pi of bucket.paths) {
      const p = this.index.world.paths[pi];
      if (!HOP_CLASSES.includes(p.c) || p.p === currentPts) continue;
      const n = p.p.length;
      const dStart = Math.hypot(p.p[0] - x, p.p[1] - z);
      const dEnd = Math.hypot(p.p[n - 2] - x, p.p[n - 1] - z);
      const total = polyLen(p.p);
      if (total < 24) continue;
      if (dStart < 90) candidates.push({ pts: p.p, total, t: 1, dir: 1 });
      else if (dEnd < 90) candidates.push({ pts: p.p, total, t: total - 1, dir: -1 });
    }
    return candidates.length ? candidates[Math.floor(rng() * candidates.length)] : null;
  }

  private roadSpot(px: number, pz: number, fx: number, fz: number, rng: () => number): { pts: number[]; w: number; total: number; t: number; dir: number } | null {
    for (let tries = 0; tries < 12; tries++) {
      const cx = Math.floor((px + (rng() - 0.5) * 4400) / CHUNK);
      const cz = Math.floor((pz + (rng() - 0.5) * 4400) / CHUNK);
      const bucket = this.index.buckets.get(cx + ',' + cz);
      if (!bucket || !bucket.roads.length) continue;
      const r = this.index.world.roads[bucket.roads[Math.floor(rng() * bucket.roads.length)]];
      if (!['primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'trunk'].includes(r.c)) continue;
      const total = polyLen(r.p);
      if (total < 260) continue;
      const t = 30 + rng() * (total - 60);
      const spot = alongPolyline(r.p, t);
      if (!spot) continue;
      if (!this.okToSpawn(spot.x, spot.z, px, pz, fx, fz, 1100, 2500)) continue;
      return { pts: r.p, w: r.w, total, t, dir: rng() < 0.5 ? 1 : -1 };
    }
    return null;
  }

  update(dt: number, px: number, pz: number, t: number, fx: number, fz: number) {
    const rng = mulberry32(hash32(Math.floor(t), 3, 7));

    for (const p of this.peds) {
      const dx = p.root.position.x - px, dz = p.root.position.z - pz;
      if (dx * dx + dz * dz > 1900 * 1900 || !p.pts.length) {
        for (let tries = 0; tries < 6; tries++) {
          const spot = this.pathSpot(px, pz, 1100, rng);
          if (!spot) continue;
          const at = alongPolyline(spot.pts, spot.t);
          if (!at || !this.okToSpawn(at.x, at.z, px, pz, fx, fz, 650, 1800)) continue;
          p.pts = spot.pts;
          p.total = spot.total;
          p.t = spot.t;
          p.dir = rng() < 0.5 ? 1 : -1;
          p.root.position.set(at.x, this.groundAt(at.x, at.z), at.z);
          break;
        }
        continue;
      }
      const ended = p.advance(dt, this.groundAt(p.root.position.x, p.root.position.z, p.root.position.y));
      if (ended) {
        const hop = this.hopFrom(p.root.position.x, p.root.position.z, p.pts, rng);
        if (hop) {
          p.pts = hop.pts;
          p.total = hop.total;
          p.t = hop.t;
          p.dir = hop.dir;
        } else {
          p.dir = -p.dir;
          p.t = Math.max(1, Math.min(p.total - 1, p.t));
        }
      }
    }

    // nobody overlaps: walkers side-step each other, the player, and cars
    for (let i = 0; i < this.peds.length; i++) {
      const a = this.peds[i];
      if (!a.pts.length) continue;
      const decay = Math.max(0, 1 - dt * 2.2);
      a.sepX *= decay;
      a.sepZ *= decay;
      const ax = a.root.position.x, az = a.root.position.z;
      const push = (dx: number, dz: number, d2: number, reach: number, both?: Walker) => {
        if (d2 >= reach * reach || d2 < 0.01) return;
        const d = Math.sqrt(d2);
        const f = (reach - d) * Math.min(1, dt * 9) * (both ? 0.5 : 1);
        a.sepX += (dx / d) * f;
        a.sepZ += (dz / d) * f;
        if (both) {
          both.sepX -= (dx / d) * f;
          both.sepZ -= (dz / d) * f;
        }
      };
      {
        const dx = ax - px, dz = az - pz;
        push(dx, dz, dx * dx + dz * dz, 14);
      }
      for (let j = i + 1; j < this.peds.length; j++) {
        const b = this.peds[j];
        if (!b.pts.length) continue;
        const dx = ax - b.root.position.x, dz = az - b.root.position.z;
        push(dx, dz, dx * dx + dz * dz, 10, b);
      }
      for (const c of this.cars) {
        if (!c.pts.length) continue;
        const dx = ax - c.root.position.x, dz = az - c.root.position.z;
        push(dx, dz, dx * dx + dz * dz, 24);
      }
      const sl = Math.hypot(a.sepX, a.sepZ);
      if (sl > 7) {
        a.sepX *= 7 / sl;
        a.sepZ *= 7 / sl;
      }
      a.root.position.x += a.sepX;
      a.root.position.z += a.sepZ;
    }

    for (const c of this.cars) {
      const dx = c.root.position.x - px, dz = c.root.position.z - pz;
      if (dx * dx + dz * dz > 2700 * 2700 || !c.pts.length) {
        const road = this.roadSpot(px, pz, fx, fz, rng);
        if (road) {
          c.pts = road.pts;
          c.roadW = road.w;
          c.total = road.total;
          c.t = road.t;
          c.dir = road.dir;
          c.cruise = 115 + rng() * 60;
          c.speed = c.cruise;
          c.step(0.016, this.groundAt(c.root.position.x, c.root.position.z));
          const at = alongPolyline(c.pts, c.t);
          if (at) c.root.position.set(at.x, this.groundAt(at.x, at.z), at.z);
        }
        continue;
      }
      // look down the lane: brake for the kid, for walkers, and for the car ahead
      let want = c.cruise;
      probe: for (const dAhead of [26, 60, 96]) {
        const tt = c.t + c.dir * dAhead;
        if (tt < 2 || tt > c.total - 2) continue;
        const sp = alongPolyline(c.pts, tt);
        if (!sp) continue;
        const off = c.roadW * 0.22 * c.dir;
        const sx = sp.x - sp.dz * off, sz = sp.z + sp.dx * off;
        if ((sx - px) ** 2 + (sz - pz) ** 2 < 24 * 24) { want = 0; break probe; }
        for (const p of this.peds) {
          if (!p.pts.length) continue;
          if ((sx - p.root.position.x) ** 2 + (sz - p.root.position.z) ** 2 < 19 * 19) { want = 0; break probe; }
        }
        for (const o of this.cars) {
          if (o === c || !o.pts.length) continue;
          if (o.pts === c.pts && o.dir !== c.dir) continue; // oncoming lane — they pass
          if ((sx - o.root.position.x) ** 2 + (sz - o.root.position.z) ** 2 < 26 * 26) { want = 0; break probe; }
        }
      }
      c.speed += (want - c.speed) * Math.min(1, dt * (want > c.speed ? 1.5 : 10));
      if (want < 1 && c.speed < 3) c.speed = 0;
      const ended = c.step(dt, this.groundAt(c.root.position.x, c.root.position.z, c.root.position.y));
      if (ended) {
        // turn around at the end of the road — never teleport in view
        c.dir = -c.dir;
        c.t = Math.max(3, Math.min(c.total - 3, c.t));
      }
    }

    // boats cruise the real river, harbor, and basin
    for (const b of this.boats) {
      const dx = b.root.position.x - px, dz = b.root.position.z - pz;
      if (!b.active || dx * dx + dz * dz > 3400 * 3400) {
        b.active = false;
        b.root.position.set(0, 0, 1e7);
        for (let tries = 0; tries < 8; tries++) {
          const a = rng() * Math.PI * 2;
          const d = 900 + rng() * 1500;
          const x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d;
          if (!this.clearWater(x, z, 45)) continue;
          if (!this.okToSpawn(x, z, px, pz, fx, fz, 750, 2600)) continue;
          b.root.position.set(x, WATER_Y, z);
          if (!this.boatTarget(b, rng)) continue;
          b.active = true;
          break;
        }
        if (!b.active) b.root.position.set(0, 0, 1e7);
        continue;
      }
      const arrived = b.glide(dt, t);
      b.checkAcc += dt;
      if (arrived) {
        if (!this.boatTarget(b, rng)) b.active = false;
      } else if (b.checkAcc > 0.6) {
        b.checkAcc = 0;
        const hx = b.root.position.x + Math.sin(b.root.rotation.y) * 90;
        const hz = b.root.position.z + Math.cos(b.root.rotation.y) * 90;
        if (!this.clearWater(hx, hz, 32) && !this.boatTarget(b, rng)) b.active = false;
      }
    }

    // gulls wheel over the harbor & beaches — each circles a point whose loop
    // touches water; recycle when the player wanders away
    for (const gl of this.gulls) {
      const dx = gl.cx - px, dz = gl.cz - pz;
      if (!gl.active || dx * dx + dz * dz > 1700 * 1700) {
        gl.active = false;
        gl.root.position.set(0, 0, 1e7);
        for (let tries = 0; tries < 10; tries++) {
          const a = rng() * Math.PI * 2, d = 300 + rng() * 1000;
          const cx = px + Math.cos(a) * d, cz = pz + Math.sin(a) * d;
          const r = gl.radius;
          if (this.index.isWaterAt(cx, cz) || this.index.isWaterAt(cx + r, cz) || this.index.isWaterAt(cx - r, cz)
            || this.index.isWaterAt(cx, cz + r) || this.index.isWaterAt(cx, cz - r)) {
            gl.cx = cx; gl.cz = cz; gl.ang = rng() * Math.PI * 2; gl.active = true;
            break;
          }
        }
        continue;
      }
      gl.glide(dt, t);
    }
  }

  // spawns snap to the top surface (a ped placed on a bridge belongs ON it);
  // per-frame movement rides decks only where they meet the grade, so nobody
  // walking under an overpass pops up through its deck
  private groundAt(x: number, z: number, prevY?: number): number {
    if (prevY === undefined) return Math.max(this.index.heightAtPx(x, z), this.index.deckHeightAt(x, z));
    return this.index.surfaceYAt(x, z, prevY);
  }
}
