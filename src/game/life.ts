import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { WorldIndex, CHUNK, pointInPoly, distToPolylineSq } from '../world/index';
import { hash32, mulberry32, SEASON } from '../world/style';
import { WATER_Y, TIDE } from '../three/water';
import { PROPS } from '../three/assets';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { captureHumanoid, poseWalk, type Humanoid } from '../three/humanoid';
import { TOWN } from '@town';
import type { GameAudio } from './audio';

// Ambient life: pedestrians who follow the sidewalk network exactly, cars
// that drive road polylines, and boats cruising the real water. Nothing spawns
// or despawns where the player can see. Nobody passes through anybody.

const PEDS = 28;
const CARS = 7;
// the cruising fleet follows the season, like the moored one (decor MOOR_FILL):
// summer = a busy harbor, fall thins out, spring fewer still, winter = nobody out
const BOATS = SEASON === 'summer' ? 13 : SEASON === 'fall' ? 5 : SEASON === 'spring' ? 3 : 0;
const GULLS = 7;

const SHIRTS = ['#b03a32', '#3e5c84', '#54652c', '#c8a142', '#7c4a68', '#2e6e63', '#8a4a2e', '#5b5e66', '#a8625a', '#46698c'];
const PANTS = ['#3b4d6b', '#54565c', '#6e5a40', '#444a54', '#7a7c84'];
const SKINS = ['#eec39a', '#d9a06e', '#b97f52', '#8e5c38', '#f2d3b0'];
const HAIRS = ['#4a3320', '#23201c', '#8a6232', '#b8b2a4', '#5e3c22', '#d8c690'];
const CAR_COLORS = ['#b5443a', '#3e5c84', '#d8d5cc', '#3a3c40', '#7c8b96', '#5e7e54', '#c8b04a', '#7a4a68'];

const WALK_CLASSES = ['side', 'foot', 'ped', 'board', 'cycle'];
const ROAD_CLASSES = ['motorway', 'motorway_link', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'trunk'];
const TOWN_ROADS = ['primary', 'secondary', 'tertiary', 'residential', 'unclassified'];   // no highway for the bus and the plow
const MAIL_ROADS = ['tertiary', 'residential', 'unclassified'];   // the mail truck works the side streets
const HOP_CLASSES = ['side', 'foot', 'ped', 'board', 'cycle', 'crossing']; // crossings = legal street crossing

// seasonal attractions — per-town (src/towns/<id>/index.ts); a town without a
// famous skating pond / sledding hill just skips those traditions
const FROG_POND = TOWN.attractions.frogPond;
const SLED = TOWN.attractions.sledHill;
const MARCH_TOP = SLED?.top ?? { x: 0, z: 0 };
const MARCH_DIR = SLED?.dir ?? { x: 0, z: 1 };
const MARCH_RUN = SLED?.run ?? 270;
const SCARVES = ['#b03a32', '#3e5c84', '#54652c', '#c8a142', '#7c4a68', '#a8625a'];
const SKATERS = 5;
const SLEDDERS = 4;
const BATS = 7;          // fall: bats wheeling over the rooftops at dusk
const COSTUMES = ['witch', 'pumpkin', 'vampire', 'devil'];   // fall trick-or-treaters
const ROAM_GHOSTS = 5;   // fall: translucent ghosts drifting the streets at dusk
const CATS = 3;          // fall: black cats slinking the sidewalks
const GRAVEYARD = TOWN.attractions.graveyard;   // graveyard mist + the witch circles here (per-town)

// 🐕 the town's pet dogs, out on their leashes in every season. Every breed
// here is SMALLER than Clipper, and none is a golden — he stays the only
// golden retriever in town.
const PUPS = 4;
const PUP_BREEDS = [
  { fur: '#2a2722', belly: '#3a362e', ear: '#1e1c18', size: 1.25, stretch: 1.0, leg: 1.0 },   // black lab
  { fur: '#b9885a', belly: '#e9e0cc', ear: '#5c4028', size: 1.0, stretch: 1.0, leg: 0.9 },    // beagle
  { fur: '#e6e0d0', belly: '#e6e0d0', ear: '#d6cdb8', size: 0.8, stretch: 0.9, leg: 0.8 },    // little white terrier
  { fur: '#5e3d26', belly: '#7a5638', ear: '#472e1c', size: 0.9, stretch: 1.55, leg: 0.5 },   // dachshund
];

// 🦌 white-tailed deer browsing where deer actually browse: the mapped woods,
// reserves and open greens, shy of the pavement. Small family groups — a doe
// with fawns in the green half of the year, mixed groups (the odd buck still
// carrying antlers) in the cold half.
const DEER_GROUPS = 3;
const DEER_LAND = new Set(['wood', 'reserve', 'scrub', 'park', 'cemetery', 'grass']);
const DEER_COAT = SEASON === 'summer' || SEASON === 'spring' ? '#a3794f' : '#8d7862';   // red summer coat, grey-brown winter

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

function cone(r: number, h: number, hex: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), mat(hex));
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

// the kit's rigged people, in the order the seed picks them
const PEOPLE = ['male', 'skater-male', 'skater-female'];

class Walker {
  root = new THREE.Group();
  private heading = new THREE.Group();
  private legL: THREE.Object3D;
  private legR: THREE.Object3D;
  private armL: THREE.Object3D;
  private armR: THREE.Object3D;
  // skinned kit character: knees, forearms and hips for the procedural gait
  private rig: Humanoid | null = null;
  private phase = Math.random() * 6;
  private face = Math.random() * Math.PI * 2;
  pts: number[] = [];
  total = 1;
  t = 0;
  dir = 1;
  speed = 30 + Math.random() * 22;
  // one gait per person: a stroller, a brisk one, the rest in between; the cadence and
  // the stride follow the speed so nobody sprints in slow motion
  cadence = 8;
  stride = 1;
  pause = 0;         // seconds left standing still (window-shopping, talking)
  pauseFace = 0;
  sepX = 0;          // persistent side-step so walkers never overlap
  sepZ = 0;
  size = 1;          // the body scale — a leashed dog strings its leash to the hand
  lane = 0;          // a fixed side-step from the path (parade columns)

  constructor(seed: number, costume?: string) {
    const rng = mulberry32(seed);
    const gait = rng();
    if (gait < 0.25) { this.speed = 18 + rng() * 9; this.cadence = 6.2; this.stride = 0.82; }
    else if (gait < 0.4) { this.speed = 52 + rng() * 12; this.cadence = 10; this.stride = 1.15; }
    else { this.speed = 30 + rng() * 22; this.cadence = 8; this.stride = 1; }
    let shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)];
    const pants = PANTS[Math.floor(rng() * PANTS.length)];
    let skin = SKINS[Math.floor(rng() * SKINS.length)];
    const hair = HAIRS[Math.floor(rng() * HAIRS.length)];
    // a fall trick-or-treater: the costume recolors the outfit
    if (costume === 'witch') shirt = '#3a2a52';
    else if (costume === 'pumpkin') shirt = '#d9772a';
    else if (costume === 'vampire') { shirt = '#1d1d24'; skin = '#e7e4dc'; }
    else if (costume === 'devil') shirt = '#9a2f2a';
    else if (costume === 'elf') { shirt = '#2e7d3a'; }
    const person = !costume && PROPS ? PROPS.get(PEOPLE[Math.floor(rng() * PEOPLE.length)]) : undefined;
    if (person) {
      // a real person from the kit: clone the skinned mesh and its skeleton, then drive
      // the humanoid bones ourselves (the kit ships no clips). Arms come down from the
      // T-pose; legs and arms swing in advance().
      const c = SkeletonUtils.clone(person.root);
      c.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.frustumCulled = false; } });
      this.rig = captureHumanoid(c);
      if (this.rig) poseWalk(this.rig, 0, 0);
      // the box limbs are unused on a kit person; keep the fields satisfied
      this.legL = this.legR = this.armL = this.armR = new THREE.Object3D();
      this.heading.add(c);
      this.size = 0.92 + rng() * 0.18;
      this.heading.scale.setScalar(this.size);
      this.heading.rotation.y = this.face;
      this.root.add(this.heading);
      return;
    }
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
    this.heading.add(this.legL, this.legR, body, head, hairCap, this.armL, this.armR);
    if (costume) {
      // a candy pail in one hand + the costume topper; trick-or-treaters are kid-sized
      const pail = box(3, 3, 3, costume === 'witch' ? '#34303a' : '#e88a22');
      pail.position.set(6.4, 16.5, 1.6); this.heading.add(pail);
      if (costume === 'witch') {
        const brim = sph(4.6, '#19151f', 1, 0.16, 1); brim.position.y = 30.2;
        const hat = cone(2.7, 8.5, '#19151f'); hat.position.y = 34.5;
        this.heading.add(brim, hat);
      } else if (costume === 'pumpkin') {
        const pk = sph(4.7, '#e0852e', 1.12, 0.94, 1.12); pk.position.y = 26.8;   // pumpkin head
        const stem = box(0.9, 1.8, 0.9, '#4a6a32'); stem.position.y = 31.2;
        this.heading.add(pk, stem);
      } else if (costume === 'vampire') {
        const cape = box(8.5, 14, 1.2, '#141019'); cape.position.set(0, 17, -3.4); this.heading.add(cape);
        const collar = box(7, 2.4, 3, '#141019'); collar.position.set(0, 22.4, -1.2); this.heading.add(collar);
      } else if (costume === 'devil') {
        for (const sx of [-1, 1]) { const horn = cone(0.7, 2.4, '#6e1a16'); horn.position.set(sx * 2.1, 30.4, 0); horn.rotation.z = sx * -0.3; this.heading.add(horn); }
      } else if (costume === 'elf') {
        pail.visible = false;
        const hat = cone(3.6, 7.5, '#c8262a'); hat.position.y = 31.5; this.heading.add(hat);
        const pom = sph(1.2, '#f4f0e8'); pom.position.y = 35.2; this.heading.add(pom);
        const bell = sph(1.1, '#e8c04a'); bell.position.set(6.4, 16.5, 1.6); this.heading.add(bell);   // a sleigh bell in the hand
      }
      this.size = 0.6 + rng() * 0.1;
    } else {
      this.size = 0.92 + rng() * 0.18;
    }
    this.heading.scale.setScalar(this.size);
    this.heading.rotation.y = this.face;
    this.root.add(this.heading);
  }

  get facing(): number { return this.face; }

  // returns true when the end of the current path is reached
  advance(dt: number, groundY: number): boolean {
    if (this.pause > 0) {
      // standing: outside a shop, or talking to whoever stopped beside them; a slow
      // shift of weight so they are not statues
      this.pause -= dt;
      this.phase += dt * 1.4;
      this.face = lerpAngle(this.face, this.pauseFace, Math.min(1, dt * 3));
      if (this.rig) poseWalk(this.rig, Math.sin(this.phase) * 0.35, 0.12);
      this.heading.rotation.y = this.face;
      this.root.position.y += (groundY - this.root.position.y) * Math.min(1, dt * 10);
      return false;
    }
    this.t += this.speed * dt * this.dir;
    const ended = this.t <= 0 || this.t >= this.total;
    const clamped = Math.max(0.5, Math.min(this.total - 0.5, this.t));
    const spot = alongPolyline(this.pts, clamped);
    if (spot) {
      this.root.position.x = spot.x - spot.dz * this.lane;
      this.root.position.z = spot.z + spot.dx * this.lane;
      this.face = lerpAngle(this.face, Math.atan2(spot.dx * this.dir, spot.dz * this.dir), Math.min(1, dt * 6));
      this.phase += dt * this.cadence;
      const s = Math.sin(this.phase) * 0.55 * this.stride;
      if (this.rig) poseWalk(this.rig, this.phase, this.stride);
      else {
        this.legL.rotation.x = s;
        this.legR.rotation.x = -s;
        this.armL.rotation.x = -s * 0.8;
        this.armR.rotation.x = s * 0.8;
      }
    }
    this.heading.rotation.y = this.face;
    this.root.position.y += (groundY - this.root.position.y) * Math.min(1, dt * 10);
    return ended;
  }
}

// Car lights after dark: two warm discs on the nose, two red on the tail, and a soft
// pool of light on the road ahead. Additive, unlit, shared materials whose opacity the
// Life loop sets from the sky's night each frame; by day they are not drawn at all.
function glowTex(r: number, g: number, b: number, stretch = 1): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const gx = c.getContext('2d')!;
  const grd = gx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, `rgba(${r},${g},${b},0.95)`);
  grd.addColorStop(0.35, `rgba(${r},${g},${b},0.4)`);
  grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
  gx.fillStyle = grd;
  gx.setTransform(1, 0, 0, stretch, 0, 32 - 32 * stretch);
  gx.fillRect(0, 0, 64, 64 / stretch + 64);
  return new THREE.CanvasTexture(c);
}
let headMat: THREE.MeshBasicMaterial | null = null, tailMat: THREE.MeshBasicMaterial | null = null, poolMat: THREE.MeshBasicMaterial | null = null;
function carLightMats() {
  if (!headMat) {
    const mk = (tex: THREE.CanvasTexture) => new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false, side: THREE.DoubleSide });
    headMat = mk(glowTex(255, 236, 190));
    tailMat = mk(glowTex(255, 60, 40));
    poolMat = mk(glowTex(255, 226, 170));
  }
  return { headMat: headMat!, tailMat: tailMat!, poolMat: poolMat! };
}
/** night 0..1 → lights on; called once a frame by Life */
export function setCarLightsNight(night: number) {
  if (!headMat) return;
  const on = Math.max(0, Math.min(1, (night - 0.02) * 6));   // on with the first of dusk, like drivers do
  headMat.opacity = 0.95 * on;
  tailMat!.opacity = 0.85 * on;
  poolMat!.opacity = 0.5 * on;
  headMat.visible = tailMat!.visible = poolMat!.visible = on > 0.01;
}

// Wood smoke from the chimneys: in winter all day, on fall evenings. Each of the nearest
// chimneys gets a short column of six soft puffs that rise, drift downwind, swell and
// thin out over four seconds. Sprites with their own materials so each fades on its own.
let puffTex: THREE.CanvasTexture | null = null;
function puffTexture(): THREE.CanvasTexture {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(225,222,218,0.75)');
  grd.addColorStop(0.5, 'rgba(210,208,205,0.3)');
  grd.addColorStop(1, 'rgba(200,200,200,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  puffTex = new THREE.CanvasTexture(c);
  return puffTex;
}
const SMOKE_EMITTERS = 18, PUFFS = 6, PUFF_LIFE = 4.2;
class Smoke {
  private emitters: { x: number; y: number; z: number; puffs: { s: THREE.Sprite; m: THREE.SpriteMaterial; age: number; jx: number; jz: number }[] }[] = [];
  private acc = 1;
  private on = 0;
  constructor(private scene: THREE.Scene) {
    for (let i = 0; i < SMOKE_EMITTERS; i++) {
      const puffs = [];
      for (let k = 0; k < PUFFS; k++) {
        const m = new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false, opacity: 0, fog: true });
        const s = new THREE.Sprite(m);
        s.visible = false;
        scene.add(s);
        puffs.push({ s, m, age: (k / PUFFS) * PUFF_LIFE, jx: 0, jz: 0 });
      }
      this.emitters.push({ x: 0, y: 0, z: 1e7, puffs });
    }
  }
  /** pick the nearest chimneys once a second; animate every frame */
  update(dt: number, px: number, pz: number, night: number, chimneys: () => Iterable<number[]>) {
    const want = SEASON === 'winter' ? 1 : SEASON === 'fall' ? Math.max(0, Math.min(1, (night - 0.25) * 3)) : 0;
    this.on += (want - this.on) * Math.min(1, dt * 1.5);
    if (this.on < 0.02) { for (const e of this.emitters) for (const p of e.puffs) p.s.visible = false; return; }
    this.acc += dt;
    if (this.acc > 1) {
      this.acc = 0;
      const near: { x: number; y: number; z: number; d: number }[] = [];
      for (const list of chimneys()) {
        for (let i = 0; i < list.length; i += 3) {
          const d = (list[i] - px) ** 2 + (list[i + 2] - pz) ** 2;
          if (d < 1100 * 1100) near.push({ x: list[i], y: list[i + 1], z: list[i + 2], d });
        }
      }
      near.sort((a, b) => a.d - b.d);
      // only about half the houses have a fire going; a stable hash decides which
      const lit = near.filter((c) => hash32(Math.round(c.x), Math.round(c.z), 19) % 100 < 55).slice(0, SMOKE_EMITTERS);
      for (let i = 0; i < this.emitters.length; i++) {
        const e = this.emitters[i], c = lit[i];
        if (!c) { e.z = 1e7; for (const p of e.puffs) p.s.visible = false; continue; }
        if (e.x !== c.x || e.z !== c.z) { e.x = c.x; e.y = c.y; e.z = c.z; }
      }
    }
    for (const e of this.emitters) {
      if (e.z > 1e6) continue;
      for (const p of e.puffs) {
        p.age += dt;
        if (p.age >= PUFF_LIFE) { p.age -= PUFF_LIFE; p.jx = (Math.random() - 0.5) * 2; p.jz = (Math.random() - 0.5) * 2; }
        const t = p.age / PUFF_LIFE;
        p.s.visible = true;
        // up, then downwind (the same south-west wind the clouds ride), swelling as it thins
        p.s.position.set(e.x + p.jx * 2 + t * t * 14 + t * 3, e.y + 2 + t * 34, e.z + p.jz * 2 - t * t * 9);
        const sz = 3 + t * 11;
        p.s.scale.set(sz, sz, 1);
        p.m.opacity = this.on * 0.42 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.35);
      }
    }
  }
}

// Traffic signals that cycle. Every signal head decor placed is listed with its
// approach and phase; the twenty nearest get three small additive lamps, red, amber
// and green, and a 26-second cycle lights one of them: ten seconds of green, three of
// amber, red for the other phase's turn. Lit day and night, as signals are.
const SIGNAL_HEADS = 20, SIGNAL_CYCLE = 26;
class Signals {
  private heads: { s: THREE.Mesh[]; x: number; z: number; dx: number; dy: number; phase: number }[] = [];
  private acc = 1;
  constructor(scene: THREE.Scene) {
    // the car-light texture: a hot core with a soft halo, so a lamp reads as a lamp at
    // street distance and as a glow from a block away. A one-sided quad facing the
    // approach, not a sprite: a lamp is dark from behind the head.
    const mk = (r: number, g: number, b: number) => new THREE.MeshBasicMaterial({ map: glowTex(r, g, b), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 1, fog: false, side: THREE.FrontSide });
    const mats = [mk(255, 40, 24), mk(255, 176, 36), mk(60, 255, 100)];
    const geo = new THREE.PlaneGeometry(4.2, 4.2);
    for (let i = 0; i < SIGNAL_HEADS; i++) {
      const s = mats.map((m) => { const sp = new THREE.Mesh(geo, m); sp.visible = false; scene.add(sp); return sp; });
      this.heads.push({ s, x: 0, z: 1e7, dx: 0, dy: 0, phase: 0 });
    }
  }
  update(dt: number, t: number, px: number, pz: number, source: () => Iterable<number[]>) {
    this.acc += dt;
    if (this.acc > 1) {
      this.acc = 0;
      const near: { x: number; y: number; z: number; dx: number; dy: number; phase: number; d: number }[] = [];
      for (const list of source()) {
        for (let i = 0; i + 5 < list.length; i += 6) {
          const d = (list[i] - px) ** 2 + (list[i + 2] - pz) ** 2;
          if (d < 800 * 800) near.push({ x: list[i], y: list[i + 1], z: list[i + 2], dx: list[i + 3], dy: list[i + 4], phase: list[i + 5], d });
        }
      }
      near.sort((a, b) => a.d - b.d);
      for (let i = 0; i < this.heads.length; i++) {
        const h = this.heads[i], c = near[i];
        if (!c) { h.z = 1e7; for (const sp of h.s) sp.visible = false; continue; }
        if (h.x === c.x && h.z === c.z) continue;
        h.x = c.x; h.z = c.z; h.dx = c.dx; h.dy = c.dy; h.phase = c.phase;
        // the lamps sit on the head at the top of the post, on the face the arriving
        // traffic sees: red on top, amber, green
        for (let k = 0; k < 3; k++) {
          const sp = h.s[k];
          sp.position.set(c.x + c.dx * 5.6, c.y + 33.5 - k * 2.7, c.z + c.dy * 5.6);   // clear of the head box, or the depth test hides it
          sp.lookAt(sp.position.x + c.dx * 10, sp.position.y, sp.position.z + c.dy * 10);   // facing the arriving traffic
        }
      }
    }
    const cyc = t % SIGNAL_CYCLE;
    for (const h of this.heads) {
      if (h.z > 1e6) continue;
      const u = h.phase ? (cyc + 13) % SIGNAL_CYCLE : cyc;
      const lit = u < 10 ? 2 : u < 13 ? 1 : 0;
      for (let k = 0; k < 3; k++) h.s[k].visible = k === lit;
    }
  }
  /** a red head ahead of a car at (x, z) heading (vx, vz): the distance to its stop line, or -1 */
  redAhead(x: number, z: number, vx: number, vz: number, t: number): number {
    const cyc = t % SIGNAL_CYCLE;
    for (const h of this.heads) {
      if (h.z > 1e6) continue;
      const dx = h.x - x, dz = h.z - z;
      const ahead = dx * vx + dz * vz;
      if (ahead < -4 || ahead > 90) continue;
      if (Math.abs(dx * vz - dz * vx) > 48) continue;      // not this street
      if (h.dx * vx + h.dy * vz > -0.75) continue;          // the head faces traffic coming the other way
      const u = h.phase ? (cyc + 13) % SIGNAL_CYCLE : cyc;
      if (u >= 13) return ahead;                            // red for this phase
    }
    return -1;
  }
}

// Fireflies on summer and spring nights: forty points of yellow-green light over the
// lawns and parks near the player, each blinking on its own clock and wandering a
// little. Additive sprites on one material; by day, and on pavement, nothing.
const FLIES = 40;
class Fireflies {
  private flies: { s: THREE.Sprite; m: THREE.SpriteMaterial; x: number; z: number; y: number; ph: number; spd: number; alive: boolean }[] = [];
  private on = 0;
  private acc = 0;
  constructor(scene: THREE.Scene) {
    for (let i = 0; i < FLIES; i++) {
      const m = new THREE.SpriteMaterial({ map: puffTexture(), color: '#d8ff6a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false });
      const s = new THREE.Sprite(m);
      s.scale.set(2.2, 2.2, 1);
      s.visible = false;
      scene.add(s);
      this.flies.push({ s, m, x: 0, z: 1e7, y: 0, ph: Math.random() * 20, spd: 0.6 + Math.random() * 0.8, alive: false });
    }
  }
  update(dt: number, t: number, px: number, pz: number, night: number, index: WorldIndex, grounded: (x: number, z: number) => number) {
    const season = SEASON === 'summer' || SEASON === 'spring';
    const want = season ? Math.max(0, Math.min(1, (night - 0.3) * 2.5)) : 0;
    this.on += (want - this.on) * Math.min(1, dt * 1.2);
    if (this.on < 0.02) { for (const f of this.flies) f.s.visible = false; return; }
    // re-seat any fly that drifted out of range, a few a frame, on grass only
    this.acc += dt;
    let budget = 3;
    for (const f of this.flies) {
      const far = (f.x - px) ** 2 + (f.z - pz) ** 2 > 520 * 520;
      if ((far || !f.alive) && budget > 0) {
        budget--;
        const a = Math.random() * Math.PI * 2, d = 80 + Math.random() * 400;
        const x = px + Math.sin(a) * d, z = pz + Math.cos(a) * d;
        if (index.isBlocked(x, z) || index.isWaterAt(x, z) || index.onPavedAt(x, z)) { f.alive = false; f.s.visible = false; continue; }
        f.x = x; f.z = z; f.y = grounded(x, z); f.alive = true;
      }
      if (!f.alive) continue;
      const tt = t * 0.001 * f.spd + f.ph;
      // a slow wander and a blink: bright for a moment, dark for longer
      const blink = Math.max(0, Math.sin(tt * 2.2) - 0.55) / 0.45;
      f.s.position.set(f.x + Math.sin(tt * 0.7) * 6, f.y + 5 + Math.sin(tt * 1.1) * 3, f.z + Math.cos(tt * 0.9) * 6);
      f.s.visible = blink > 0.01;
      f.m.opacity = this.on * blink * 0.9;
    }
  }
}

// 🚌🚒🚓 the town's service fleet — the vehicles a kid actually waits to see.
// Procedural at kit scale (8 px = 1 m). Each one lives in Life.cars so the
// ordinary braking / red-light / no-teleport rules apply to it too.
export type CarRole = 'car' | 'bus' | 'fire' | 'police' | 'plow' | 'ems' | 'mail';
interface Beacon { mat: THREE.MeshBasicMaterial; phase: number; rate: number }
let beaconTex: { red?: THREE.CanvasTexture; blue?: THREE.CanvasTexture; amber?: THREE.CanvasTexture; white?: THREE.CanvasTexture } = {};
function beaconMat(kind: 'red' | 'blue' | 'amber' | 'white'): THREE.MeshBasicMaterial {
  if (!beaconTex[kind]) beaconTex[kind] = kind === 'red' ? glowTex(255, 40, 30) : kind === 'blue' ? glowTex(60, 110, 255) : kind === 'amber' ? glowTex(255, 170, 40) : glowTex(255, 245, 225);
  return new THREE.MeshBasicMaterial({ map: beaconTex[kind], transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false, side: THREE.DoubleSide });
}
/** a flashing lamp: a small coloured lens plus a glow disc that blinks; the lens stays lit-looking so the bar reads by day */
function beacon(group: THREE.Group, list: Beacon[], kind: 'red' | 'blue' | 'amber' | 'white', x: number, y: number, z: number, phase: number, rate = 2.4, glow = 7) {
  const lensHex = kind === 'red' ? '#d8302a' : kind === 'blue' ? '#3a5cff' : kind === 'amber' ? '#f0a62a' : '#f6f2e8';
  const lens = box(2.4, 1.6, 2.4, lensHex);
  lens.castShadow = false;
  lens.position.set(x, y, z);
  const mat = beaconMat(kind);
  const g = new THREE.Mesh(new THREE.PlaneGeometry(glow, glow), mat);
  g.position.set(x, y, z);
  g.renderOrder = 6;
  // a glow that always faces up-and-out: two crossed quads, so it shows from the side and above
  const g2 = g.clone(); g2.rotation.y = Math.PI / 2;
  const g3 = g.clone(); g3.rotation.x = -Math.PI / 2;
  group.add(lens, g, g2, g3);
  list.push({ mat, phase, rate });
}
function buildBus(root: THREE.Group, wheels: THREE.Object3D[], beacons: Beacon[]): THREE.Object3D {
  const yellow = '#e9b52a';
  const body = rbox(20, 19, 70, 1.6, yellow); body.position.set(0, 14.5, -8);       // the long body, from y 5 to 24
  const hood = rbox(18, 10, 16, 1.6, yellow); hood.position.set(0, 10, 34);          // conventional (Type C) nose
  const stripe = box(20.4, 1.2, 70, '#1f1f1f'); stripe.position.set(0, 12.8, -8); stripe.castShadow = false;
  const stripe2 = box(20.4, 1.2, 70, '#1f1f1f'); stripe2.position.set(0, 20.6, -8); stripe2.castShadow = false;
  const glass = box(20.6, 5.4, 60, '#2a3036'); glass.position.set(0, 17.2, -9); glass.castShadow = false;   // the window band
  const wind = box(17, 6, 1, '#2a3036'); wind.position.set(0, 18, 26.6); wind.castShadow = false;             // windshield
  const bumper = box(19, 3, 1.5, '#2b2b2b'); bumper.position.set(0, 5.5, 42.2); bumper.castShadow = false;
  const bumperB = bumper.clone(); bumperB.position.set(0, 5.5, -43.5);
  root.add(body, hood, stripe, stripe2, glass, wind, bumper, bumperB);
  for (const [lx, lz] of [[-9, 26], [9, 26], [-9, -22], [9, -22]] as const) {
    const w = cylX(3.4, 3.2, '#23241f'); w.position.set(lx, 3.4, lz); wheels.push(w); root.add(w);
  }
  // the four red flashers on the roof corners — they blink in pairs when the bus stops
  for (const [x, z, ph] of [[-8, 22, 0], [8, 22, 0.5], [-8, -40, 0.5], [8, -40, 0]] as const) beacon(root, beacons, 'red', x, 25, z, ph, 1.6, 8);
  // the stop arm on the driver's side: an octagon on a hinge that swings out
  const arm = new THREE.Group();
  const post = box(0.6, 0.6, 9, '#3a3a3a'); post.position.set(0, 0, -4.5); post.castShadow = false;
  const sign = new THREE.Mesh(new THREE.CircleGeometry(4.2, 8), mat('#c8261f')); sign.position.set(0, 0, -9.5); sign.rotation.y = Math.PI / 2;
  const rim = new THREE.Mesh(new THREE.RingGeometry(3.6, 4.2, 8), mat('#f4f0e8')); rim.position.set(0.05, 0, -9.5); rim.rotation.y = Math.PI / 2;
  const rim2 = rim.clone(); rim2.position.x = -0.05; rim2.rotation.y = -Math.PI / 2;
  arm.add(post, sign, rim);
  arm.add(rim2);
  arm.position.set(-10.3, 16, 20);   // hinge on the left, just behind the driver's window
  arm.rotation.y = -Math.PI / 2;     // folded flat along the side
  root.add(arm);
  return arm;
}
function buildEngine(root: THREE.Group, wheels: THREE.Object3D[], beacons: Beacon[]): THREE.Group {
  const red = '#b3231d';
  const cab = rbox(20, 20, 24, 1.6, red); cab.position.set(0, 15, 26);
  const bodyBox = rbox(20, 15, 50, 1.4, red); bodyBox.position.set(0, 12.5, -12);
  const panels = box(20.6, 8, 46, '#c9ccd0'); panels.position.set(0, 10, -12); panels.castShadow = false;   // roll-up compartment doors
  const glass = box(20.6, 5.5, 8, '#2a3036'); glass.position.set(0, 19, 30); glass.castShadow = false;
  const wind = box(17, 7, 1, '#2a3036'); wind.position.set(0, 19, 38.3); wind.castShadow = false;
  const bumper = box(21, 3.5, 2, '#d4d6d8'); bumper.position.set(0, 5.5, 39.5); bumper.castShadow = false;
  const grille = box(15, 6, 1, '#8a8e94'); grille.position.set(0, 10, 38.4); grille.castShadow = false;
  // the ladder, aluminium, laid along the top of the body
  const rail1 = box(1, 1, 52, '#d0d3d6'); rail1.position.set(-4, 20.8, -12);
  const rail2 = rail1.clone(); rail2.position.x = 4;
  root.add(cab, bodyBox, panels, glass, wind, bumper, grille, rail1, rail2);
  for (let i = -5; i <= 5; i++) { const r = box(8, 0.7, 0.7, '#d0d3d6'); r.position.set(0, 20.8, -12 + i * 4.6); r.castShadow = false; root.add(r); }
  const hose = box(12, 2.5, 30, '#c9c19c'); hose.position.set(0, 21.5, -20); hose.castShadow = false;
  root.add(hose);
  for (const [lx, lz] of [[-9, 24], [9, 24], [-9, -18], [9, -18]] as const) {
    const w = cylX(3.6, 3.4, '#23241f'); w.position.set(lx, 3.6, lz); wheels.push(w); root.add(w);
  }
  // the light bar across the cab roof: red, white, red, and two more red at the tail
  const bar = box(16, 1.6, 3, '#2a2a2a'); bar.position.set(0, 25.8, 26); bar.castShadow = false; root.add(bar);
  beacon(root, beacons, 'red', -6, 26.6, 26, 0, 3.2, 9);
  beacon(root, beacons, 'white', 0, 26.6, 26, 0.33, 3.2, 8);
  beacon(root, beacons, 'red', 6, 26.6, 26, 0.5, 3.2, 9);
  beacon(root, beacons, 'red', -8, 20.5, -37.5, 0.25, 3.2, 8);
  beacon(root, beacons, 'red', 8, 20.5, -37.5, 0.75, 3.2, 8);
  // 🎅 Santa, up on the hose bed for the parade — hidden the rest of the year
  const santa = new THREE.Group();
  const coat = cap(3.8, 5, '#c8262a'); coat.scale.set(1.25, 1, 0.95); coat.position.y = 7.5;
  const belt = box(9, 1.4, 6.5, '#2a2320'); belt.position.y = 6.2; belt.castShadow = false;
  const head = sph(3.3, '#eec39a', 1, 0.95, 0.95); head.position.y = 14.5;
  const beard = sph(3.4, '#f4f0e8', 1.05, 0.9, 0.9); beard.position.set(0, 13.2, 1.2);
  const hat = cone(3.4, 7, '#c8262a'); hat.position.set(0, 19.5, 0); hat.rotation.z = 0.25;
  const brim = sph(3.7, '#f4f0e8', 1.05, 0.35, 1.05); brim.position.y = 16.6;
  const pom = sph(1.3, '#f4f0e8'); pom.position.set(-1.8, 22.6, 0);
  const armDown = cap(1.3, 4.5, '#c8262a', true); armDown.position.set(-5.4, 11, 0);
  const wave = cap(1.3, 4.5, '#c8262a', true); wave.position.set(5.4, 11.5, 0); wave.rotation.z = -2.6; wave.name = 'wave';
  const mitt = sph(1.5, '#f4f0e8'); mitt.position.set(0, -7, 0); wave.add(mitt);
  santa.add(coat, belt, head, beard, hat, brim, pom, armDown, wave);
  santa.position.set(0, 23, -18);
  santa.rotation.y = Math.PI / 2;   // sat facing the sidewalk
  santa.visible = false;
  root.add(santa);
  return santa;
}
function buildCruiser(root: THREE.Group, wheels: THREE.Object3D[], beacons: Beacon[]) {
  const model = PROPS?.get('police-car');
  let top = 12, len = 38, wid = 14;
  if (model) {
    const body = model.root.clone(true);
    body.traverse((o) => { if ((o as THREE.Mesh).isMesh && /wheel/i.test(o.name)) wheels.push(o); });
    root.add(body);
    top = model.size.y; len = model.size.z; wid = model.size.x;
  } else {
    const body = rbox(14, 7, 36, 2.2, '#f0eee8'); body.position.y = 6.5;
    const cabin = rbox(12, 6.4, 17, 2.4, '#2e3338'); cabin.position.set(0, 11.8, -2);
    const doors = box(14.4, 5, 16, '#1c1f24'); doors.position.set(0, 6.5, 0); doors.castShadow = false;
    root.add(body, cabin, doors);
    for (const [lx, lz] of [[-7.2, 11], [7.2, 11], [-7.2, -11], [7.2, -11]] as const) {
      const w = cylX(2.6, 2.4, '#23241f'); w.position.set(lx, 2.6, lz); wheels.push(w); root.add(w);
    }
    top = 15;
  }
  const bar = box(wid * 0.8, 1.4, 2.6, '#22252a'); bar.position.set(0, top + 0.7, len * 0.02); bar.castShadow = false; root.add(bar);
  beacon(root, beacons, 'blue', -wid * 0.26, top + 1.4, len * 0.02, 0, 4, 8);
  beacon(root, beacons, 'red', wid * 0.26, top + 1.4, len * 0.02, 0.5, 4, 8);
}
function buildPlow(root: THREE.Group, wheels: THREE.Object3D[], beacons: Beacon[]) {
  const orange = '#d9822b';
  const cab = rbox(16, 13, 18, 1.6, orange); cab.position.set(0, 11.5, 14);
  const bed = box(17, 9, 30, orange); bed.position.set(0, 10.5, -12);
  const load = box(15, 3, 26, '#8d8a80'); load.position.set(0, 16, -12); load.castShadow = false;   // the sand/salt heap
  const glass = box(16.4, 4.5, 6, '#2a3036'); glass.position.set(0, 14.5, 16); glass.castShadow = false;
  const wind = box(13, 5, 1, '#2a3036'); wind.position.set(0, 14.5, 23.2); wind.castShadow = false;
  root.add(cab, bed, load, glass, wind);
  // the blade: a wide steel wing hung ahead of the bumper, angled to throw snow to the right
  const blade = box(30, 8, 1.6, '#c9a13a'); blade.position.set(0, 4.6, 31); blade.rotation.y = -0.42;
  const edge = box(30, 1.2, 1.7, '#5e5a52'); edge.position.set(0, 1.0, 31); edge.rotation.y = -0.42; edge.castShadow = false;
  const frame = box(2, 2, 10, '#3a3a3a'); frame.position.set(0, 5, 26); frame.castShadow = false;
  root.add(blade, edge, frame);
  for (const [lx, lz] of [[-7.5, 14], [7.5, 14], [-7.5, -16], [7.5, -16]] as const) {
    const w = cylX(3.4, 3.2, '#23241f'); w.position.set(lx, 3.4, lz); wheels.push(w); root.add(w);
  }
  beacon(root, beacons, 'amber', 0, 18.8, 14, 0, 1.4, 9);
}

function buildAmbulance(root: THREE.Group, wheels: THREE.Object3D[], beacons: Beacon[]) {
  const white = '#f1f0ea';
  const cab = rbox(16, 12, 18, 1.8, white); cab.position.set(0, 10, 24);
  const bodyBox = rbox(19, 17, 36, 1.6, white); bodyBox.position.set(0, 13.5, -4);
  const stripe = box(19.4, 2.4, 36, '#c0322a'); stripe.position.set(0, 9.5, -4); stripe.castShadow = false;   // the red belt line
  const stripeC = box(16.4, 2.4, 18, '#c0322a'); stripeC.position.set(0, 9.5, 24); stripeC.castShadow = false;
  const glass = box(16.4, 4.5, 6, '#2a3036'); glass.position.set(0, 13, 26); glass.castShadow = false;
  const wind = box(13, 5, 1, '#2a3036'); wind.position.set(0, 13, 33.2); wind.castShadow = false;
  const bumper = box(17, 2.5, 1.5, '#6e7276'); bumper.position.set(0, 4.5, 33.5); bumper.castShadow = false;
  const cross = box(0.8, 5, 1.2, '#2a6fd6'); cross.position.set(-9.9, 15, -4); cross.castShadow = false;   // the Star of Life, as a blue cross
  const cross2 = box(0.8, 1.2, 5, '#2a6fd6'); cross2.position.set(-9.9, 15, -4); cross2.castShadow = false;
  const cross3 = cross.clone(); cross3.position.x = 9.9; const cross4 = cross2.clone(); cross4.position.x = 9.9;
  root.add(cab, bodyBox, stripe, stripeC, glass, wind, bumper, cross, cross2, cross3, cross4);
  for (const [lx, lz] of [[-7.5, 22], [7.5, 22], [-7.5, -12], [7.5, -12]] as const) {
    const w = cylX(3, 3, '#23241f'); w.position.set(lx, 3, lz); wheels.push(w); root.add(w);
  }
  // a row of red and white across the front of the box, red at the tail
  for (const [x, k, ph] of [[-7, 'red', 0], [-2.4, 'white', 0.33], [2.4, 'white', 0.66], [7, 'red', 0.5]] as const) beacon(root, beacons, k, x, 22.8, 13.5, ph, 3.2, 8);
  beacon(root, beacons, 'red', -7, 21.5, -22.5, 0.25, 3.2, 8);
  beacon(root, beacons, 'red', 7, 21.5, -22.5, 0.75, 3.2, 8);
}
function buildMailTruck(root: THREE.Group, wheels: THREE.Object3D[], beacons: Beacon[]) {
  const white = '#eeece6';
  const body = rbox(15, 13, 28, 1.6, white); body.position.set(0, 10.5, -4);       // the tall box of a mail truck
  const hood = rbox(13, 6, 10, 1.4, white); hood.position.set(0, 6.5, 14);
  const glass = box(15.4, 4.5, 10, '#2a3036'); glass.position.set(0, 13, 4); glass.castShadow = false;
  const wind = box(12, 5.5, 1, '#2a3036'); wind.position.set(0, 12.5, 10.2); wind.castShadow = false;
  const red = box(15.4, 1.4, 20, '#c8322a'); red.position.set(0, 8.4, -8); red.castShadow = false;       // the red and blue stripes
  const blue = box(15.4, 1.4, 20, '#2d4f9e'); blue.position.set(0, 6.8, -8); blue.castShadow = false;
  const bumper = box(14, 2, 1.2, '#6e7276'); bumper.position.set(0, 3.5, 19.2); bumper.castShadow = false;
  root.add(body, hood, glass, wind, red, blue, bumper);
  for (const [lx, lz] of [[-6.5, 12], [6.5, 12], [-6.5, -12], [6.5, -12]] as const) {
    const w = cylX(2.4, 2.2, '#23241f'); w.position.set(lx, 2.4, lz); wheels.push(w); root.add(w);
  }
  // the hazards, amber, both corners of the tail, blinking together while it is stopped
  beacon(root, beacons, 'amber', -6, 8.5, -18.5, 0, 1.4, 6);
  beacon(root, beacons, 'amber', 6, 8.5, -18.5, 0, 1.4, 6);
}

// 🚧 a grade crossing: where a street crosses the line, a gate on the right-hand
// approach of each side — post, crossbuck, two red lamps that alternate, and the
// striped arm that drops while the train is near. Cars stop at the arm.
interface Crossing {
  x: number; z: number;
  t: number;                 // distance along the rail chain
  gates: THREE.Group[];
  arms: THREE.Object3D[];
  beacons: Beacon[];
  down: number;              // 0 up .. 1 down
  active: boolean;
  bellT: number;
  horned: boolean;
}
function buildGate(w: number): { g: THREE.Group; arm: THREE.Object3D; beacons: Beacon[] } {
  const g = new THREE.Group();
  const beacons: Beacon[] = [];
  const post = box(2.4, 26, 2.4, '#d8d9d4'); post.position.y = 13; g.add(post);
  const base = box(5, 2, 5, '#6e7276'); base.position.y = 1; base.castShadow = false; g.add(base);
  for (const r of [-1, 1]) { const b = box(12, 1.5, 0.8, '#f2f1ea'); b.position.set(0, 23, 1.6); b.rotation.z = r * Math.PI / 4; b.castShadow = false; g.add(b); }
  const lampBox = box(9, 3, 1.6, '#2a2a2a'); lampBox.position.set(0, 17.5, 1.4); lampBox.castShadow = false; g.add(lampBox);
  beacon(g, beacons, 'red', -3, 17.5, 2.4, 0, 1.6, 7);
  beacon(g, beacons, 'red', 3, 17.5, 2.4, 0.5, 1.6, 7);
  // the arm: hinged at the post, reaching past the centre line when it is down
  const L = Math.max(30, w * 0.56);
  const arm = new THREE.Group(); arm.position.set(1.6, 11, 0);
  const bar = box(L, 1.4, 1.0, '#f4f2ea'); bar.position.x = L / 2; bar.castShadow = false; arm.add(bar);
  for (const k of [0.2, 0.45, 0.7, 0.95]) { const st = box(L * 0.1, 1.6, 1.2, '#c8262a'); st.position.x = L * k; st.castShadow = false; arm.add(st); }
  const weight = box(5, 5, 2.2, '#2a2a2a'); weight.position.x = -4; weight.castShadow = false; arm.add(weight);
  g.add(arm);
  return { g, arm, beacons };
}

// 🚆 the commuter train. One purple loco and three silver coaches on the real rail
// line: it stands at the platform, leaves down the line until it is out of sight,
// waits a while off the map, and comes back in, slowing to a stop at the platform.
class Train {
  root = new THREE.Group();
  cars: THREE.Group[] = [];
  /** 'stand' at the platform, 'out' running away, 'away' off the map, 'in' arriving */
  state: 'stand' | 'out' | 'away' | 'in' = 'stand';
  timer = 150;
  head = 0;       // the loco's centre, distance along the line
  speed = 0;
  constructor() {
    for (let i = 0; i < 4; i++) {
      const loco = i === 0;
      const g = new THREE.Group();
      for (const o of [-30, 30]) { const t = box(9, 4.5, 13, '#26282b'); t.position.set(0, 2.25, o); t.castShadow = false; g.add(t); }
      const body = rbox(11, 20.5, 84, 2.2, loco ? '#73277f' : '#c7ccd1'); body.position.y = 14.75; g.add(body);
      const stripe = box(11.4, 2.6, 83, loco ? '#d7d2c6' : '#73277f'); stripe.position.y = 13.3; stripe.castShadow = false; g.add(stripe);
      if (loco) {
        const shield = box(10.4, 7, 10, '#16212c'); shield.position.set(0, 20.5, 27); shield.castShadow = false; g.add(shield);   // the windscreen
        const rad = rbox(9.4, 3, 30, 1.6, '#5a1f63'); rad.position.set(0, 26.5, -6); g.add(rad);                                    // roof radiator
        const lamp = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), carLightMats().headMat); lamp.position.set(0, 22, 42.3); lamp.renderOrder = 5; g.add(lamp);
      } else {
        const win = box(11.4, 6, 74, '#15202b'); win.position.set(0, 18.5, 0); win.castShadow = false; g.add(win);   // the window band
        const roof = rbox(9.6, 2.4, 84, 1.4, '#9aa0a6'); roof.position.y = 26.2; g.add(roof);
      }
      this.cars.push(g);
      this.root.add(g);
    }
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

  private wheels: THREE.Object3D[] = [];
  private wheelR = 2.6;

  readonly role: CarRole;
  private beacons: Beacon[] = [];
  private arm: THREE.Object3D | null = null;
  private armOut = 0;
  /** beacons flashing (the engine on a run, the cruiser on a stop, the plow at work, the bus at a stop) */
  lights = false;
  /** seconds left standing still at a stop (bus) or a pull-over (police) */
  stopT = 0;
  /** seconds until the next stop / the end of the run */
  runT = 0;
  /** off the road entirely, waiting for its hour */
  dormant = false;
  ignoreRed = false;
  /** 0 = in the lane, 1 = pulled over to the kerb (the mail truck at a box) */
  kerb = 0;
  /** Santa on the engine (parade only) */
  rider: THREE.Group | null = null;
  parade = false;

  constructor(seed: number, role: CarRole = 'car') {
    this.role = role;
    const rng = mulberry32(seed);
    if (role !== 'car') {
      if (role === 'bus') this.arm = buildBus(this.root, this.wheels, this.beacons);
      else if (role === 'fire') this.rider = buildEngine(this.root, this.wheels, this.beacons);
      else if (role === 'police') buildCruiser(this.root, this.wheels, this.beacons);
      else if (role === 'ems') buildAmbulance(this.root, this.wheels, this.beacons);
      else if (role === 'mail') buildMailTruck(this.root, this.wheels, this.beacons);
      else buildPlow(this.root, this.wheels, this.beacons);
      this.wheelR = role === 'police' ? 2.6 : role === 'mail' ? 2.4 : role === 'ems' ? 3 : 3.4;
      this.ignoreRed = role === 'fire' || role === 'ems';
      const len = role === 'bus' ? 86 : role === 'fire' ? 80 : role === 'ems' ? 66 : role === 'plow' ? 56 : role === 'mail' ? 40 : 38;
      const wid = role === 'police' ? 14 : role === 'plow' ? 16 : role === 'mail' ? 15 : role === 'ems' ? 18 : 20;
      this.addLights(wid, len, role === 'police' ? 6 : role === 'mail' ? 6 : 8);
      return;
    }
    const model = PROPS?.car(seed * 2654435761);
    if (model) {
      // a real car from the kit: the baked tree keeps its wheel nodes, so they can turn,
      // and its paint panels get one of the town's car colours
      const body = model.root.clone(true);
      const paint = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
      body.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        if (/wheel/i.test(o.name)) this.wheels.push(o);
        if (m.userData.paint) { const mat = (m.material as THREE.MeshStandardMaterial).clone(); mat.color.set(paint); m.material = mat; }
      });
      this.wheelR = Math.max(1.5, model.size.y * 0.22);
      this.root.add(body);
      this.addLights(model.size.x, model.size.z, model.size.y * 0.42);
      return;
    }
    const hex = CAR_COLORS[Math.floor(rng() * CAR_COLORS.length)];
    const body = rbox(14, 7, 34, 2.2, hex);
    body.position.y = 6.5;
    const cabin = rbox(12, 6.4, 17, 2.4, '#2e3338');
    cabin.position.set(0, 11.8, -2);
    for (const [lx, lz] of [[-7.2, 10.5], [7.2, 10.5], [-7.2, -10.5], [7.2, -10.5]] as const) {
      const wheel = cylX(2.6, 2.4, '#23241f');
      wheel.position.set(lx, 2.6, lz);
      this.wheels.push(wheel);
      this.root.add(wheel);
    }
    this.root.add(body, cabin);
    this.addLights(14, 34, 6);
  }

  private addLights(width: number, length: number, y: number) {
    const { headMat, tailMat, poolMat } = carLightMats();
    const disc = new THREE.PlaneGeometry(3.2, 3.2);
    const tail = new THREE.PlaneGeometry(2.2, 2.2);
    for (const sx of [-1, 1]) {
      const h = new THREE.Mesh(disc, headMat);
      h.position.set(sx * width * 0.32, y, length / 2 + 0.3);
      const t = new THREE.Mesh(tail, tailMat);
      t.position.set(sx * width * 0.32, y, -length / 2 - 0.3);
      t.rotation.y = Math.PI;
      h.renderOrder = t.renderOrder = 5;
      this.root.add(h, t);
    }
    // the pool on the road ahead: a flat, forward-stretched glow
    const pool = new THREE.Mesh(new THREE.PlaneGeometry(width * 2.6, length * 1.6), poolMat);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.35, length / 2 + length * 0.7);
    pool.renderOrder = 4;
    this.root.add(pool);
  }

  /** the flashers and the stop arm, once a frame; `t` in seconds */
  dress(t: number, dt: number) {
    if (this.beacons.length) {
      for (const b of this.beacons) {
        // a hard strobe: on for a third of the cycle, off otherwise
        const ph = (t * b.rate + b.phase) % 1;
        const on = this.lights && ph < 0.34;
        b.mat.opacity = on ? 0.9 : 0;
      }
    }
    if (this.rider) {
      this.rider.visible = this.parade;
      if (this.parade) { const w = this.rider.getObjectByName('wave'); if (w) w.rotation.z = -2.6 + Math.sin(t * 5) * 0.35; }
    }
    if (this.arm) {
      const want = this.stopT > 0 ? 1 : 0;
      this.armOut += (want - this.armOut) * Math.min(1, dt * 3);
      this.arm.rotation.y = -Math.PI / 2 + this.armOut * Math.PI / 2;
    }
  }

  step(dt: number, groundY: number): boolean {
    this.t += this.speed * dt * this.dir;
    // wheels turn with the road speed (the kit's wheel nodes pivot on their own axle)
    const spin = (this.speed * dt) / this.wheelR;
    for (const w of this.wheels) w.rotation.x += spin;
    const ended = this.t <= 2 || this.t >= this.total - 2;
    const clamped = Math.max(2, Math.min(this.total - 2, this.t));
    const spot = alongPolyline(this.pts, clamped);
    if (spot) {
      // the lane sits inside the parked cars: on a wide street they take the outer 20 px
      // of each side, on a narrow one they sit half up on the kerb (see decor.ts kerb life)
      const lane = this.roadW * (this.roadW >= 72 ? 0.16 : 0.2);
      const off = (lane + this.kerb * Math.max(0, this.roadW * 0.5 - 16 - lane)) * this.dir;
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

// The wake behind a moving boat: a V of foam and a churned centre line, drawn as one
// flat quad at the stern that fades with the boat's speed. And a light at the masthead
// or on the wheelhouse after dark.
let wakeTex: THREE.CanvasTexture | null = null;
function wakeTexture(): THREE.CanvasTexture {
  if (wakeTex) return wakeTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 128;
  const g = c.getContext('2d')!;
  g.clearRect(0, 0, 64, 128);
  // the two arms of the V, from the stern (top centre) opening toward the bottom
  for (const s of [-1, 1]) {
    const grd = g.createLinearGradient(0, 0, 0, 128);
    grd.addColorStop(0, 'rgba(255,255,255,0.85)');
    grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.strokeStyle = grd; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(32, 4); g.lineTo(32 + s * 28, 124); g.stroke();
  }
  // the churned centre
  const cg = g.createLinearGradient(0, 0, 0, 128);
  cg.addColorStop(0, 'rgba(255,255,255,0.7)'); cg.addColorStop(0.35, 'rgba(255,255,255,0.25)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = cg; g.fillRect(24, 0, 16, 128);
  wakeTex = new THREE.CanvasTexture(c);
  return wakeTex;
}
let boatLightMat: THREE.SpriteMaterial | null = null;

class WanderBoat {
  root = new THREE.Group();
  private wake: THREE.Mesh;
  private wakeMat: THREE.MeshBasicMaterial;
  private light: THREE.Sprite;
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
    this.root.scale.setScalar(0.62 + rng() * 0.72);   // dinghies to near-yachts out on the water too
    // the wake, flat on the water behind the stern
    this.wakeMat = new THREE.MeshBasicMaterial({ map: wakeTexture(), transparent: true, depthWrite: false, opacity: 0, fog: true });
    this.wake = new THREE.Mesh(new THREE.PlaneGeometry(30, 90), this.wakeMat);
    this.wake.rotation.x = -Math.PI / 2;
    this.wake.rotation.z = Math.PI;   // the V opens away from the boat
    this.wake.position.set(0, 0.5, -70);
    this.wake.renderOrder = 3;
    this.root.add(this.wake);
    // the anchor / masthead light
    if (!boatLightMat) boatLightMat = new THREE.SpriteMaterial({ map: puffTexture(), color: '#ffe9b0', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0, fog: false });
    this.light = new THREE.Sprite(boatLightMat);
    this.light.scale.set(7, 7, 1);
    this.light.position.set(0, this.root.children.some((o) => o.position.y === 40) ? 72 : 30, this.root.children.some((o) => o.position.y === 40) ? 0 : 8);
    this.root.add(this.light);
  }
  /** wake by speed, light by night; called each frame by Life */
  dress(night: number) {
    this.wakeMat.opacity = Math.max(0, Math.min(0.75, (this.speed - 12) / 60));
    if (boatLightMat) boatLightMat.opacity = Math.max(0, Math.min(0.9, (night - 0.05) * 3));
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
    this.root.position.y = WATER_Y + TIDE.value + Math.sin(t * 0.0013 + this.bobPhase) * 0.5;
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

// a bat wheeling erratically over the rooftops — fall only, fading in at dusk
class Bat {
  root = new THREE.Group();
  active = false;
  cx = 0; cz = 0;
  ang = 0;
  radius = 90;
  private spin: number;
  private alt: number;
  private phase: number;
  private wingL: THREE.Mesh;
  private wingR: THREE.Mesh;
  private mat: THREE.MeshBasicMaterial;   // own (uncached) material so opacity can fade with night

  constructor(seed: number) {
    const rng = mulberry32(seed);
    this.mat = new THREE.MeshBasicMaterial({ color: '#3c3646', transparent: true, opacity: 0, fog: false });
    const body = new THREE.Mesh(new THREE.SphereGeometry(2.3, 8, 6), this.mat); body.scale.set(0.8, 0.7, 1.3);
    const head = new THREE.Mesh(new THREE.SphereGeometry(1.1, 7, 5), this.mat); head.position.set(0, 0.5, 1.8);
    for (const sx of [-1, 1]) {   // pointy ears
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.4, 4), this.mat);
      ear.position.set(sx * 0.6, 1.5, 1.7); this.root.add(ear);
    }
    // thin membrane wings (flap up/down like the gull's, but darker + faster)
    this.wingL = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 5.5), this.mat); this.wingL.position.set(-5.5, 0.3, 0);
    this.wingR = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 5.5), this.mat); this.wingR.position.set(5.5, 0.3, 0);
    this.root.add(body, head, this.wingL, this.wingR);
    this.spin = (rng() < 0.5 ? -1 : 1) * (0.5 + rng() * 0.6);   // quicker, twitchier circles than a gull
    this.radius = 70 + rng() * 150;
    this.alt = 380 + rng() * 260;                               // high in the sky — silhouetted against the dusk
    this.phase = rng() * 6;
  }

  glide(dt: number, t: number, night: number) {
    this.mat.opacity = Math.max(0, Math.min(0.9, (night - 0.08) * 2.1));    // appear at dusk, gone by day
    this.ang += this.spin * dt;
    const r = this.radius * (1 + 0.16 * Math.sin(this.ang * 2.3 + this.phase));   // erratic, jinking flight
    const x = this.cx + Math.cos(this.ang) * r;
    const z = this.cz + Math.sin(this.ang) * r;
    this.root.position.set(x, this.alt + Math.sin(t * 0.004 + this.phase) * 14, z);
    this.root.rotation.y = this.ang + (this.spin > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.root.rotation.z = (this.spin > 0 ? 1 : -1) * 0.4;
    const flap = Math.sin(t * 0.02 + this.phase) * 0.9;        // fast bat flutter
    this.wingL.rotation.z = 0.3 + flap;
    this.wingR.rotation.z = -0.3 - flap;
  }
}

// a translucent ghost drifting along the streets at dusk — floats + bobs, no legs,
// reuses the pedestrian path network so it roams believably
class RoamGhost {
  root = new THREE.Group();
  private fig = new THREE.Group();
  private bodyMat: THREE.MeshBasicMaterial;
  private eyeMat: THREE.MeshBasicMaterial;
  pts: number[] = [];
  total = 1;
  t = 0;
  dir = 1;
  speed = 16 + Math.random() * 12;
  private face = Math.random() * Math.PI * 2;
  private phase = Math.random() * 6;

  constructor(seed: number) {
    const rng = mulberry32(seed);
    this.bodyMat = new THREE.MeshBasicMaterial({ color: '#f3f5ef', transparent: true, opacity: 0, fog: false });
    this.eyeMat = new THREE.MeshBasicMaterial({ color: '#2a2630', transparent: true, opacity: 0, fog: false });
    const drape = new THREE.Mesh(new THREE.ConeGeometry(7, 24, 10), this.bodyMat); drape.position.y = 12;   // flaring sheet
    const head = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8), this.bodyMat); head.position.y = 22;
    for (const sx of [-1, 0, 1]) {   // wavy hem
      const h = new THREE.Mesh(new THREE.SphereGeometry(3.4, 7, 5), this.bodyMat); h.position.set(sx * 4.6, 2.4, 0); this.fig.add(h);
    }
    for (const sx of [-1, 1]) {      // two dark eyes facing forward
      const e = new THREE.Mesh(new THREE.SphereGeometry(1.4, 6, 5), this.eyeMat); e.position.set(sx * 2.1, 22.5, 5.4); this.fig.add(e);
    }
    this.fig.add(drape, head);
    this.fig.scale.setScalar(0.85 + rng() * 0.3);
    this.root.add(this.fig);
  }

  // follow the current path (like a Walker) but float, bob + fade in at dusk
  advance(dt: number, groundY: number, night: number): boolean {
    const op = Math.max(0, Math.min(0.82, (night - 0.1) * 1.9));
    this.bodyMat.opacity = op; this.eyeMat.opacity = Math.min(0.95, op * 1.3);
    this.t += this.speed * dt * this.dir;
    const ended = this.t <= 0 || this.t >= this.total;
    const spot = alongPolyline(this.pts, Math.max(0.5, Math.min(this.total - 0.5, this.t)));
    if (spot) {
      this.face = lerpAngle(this.face, Math.atan2(spot.dx * this.dir, spot.dz * this.dir), Math.min(1, dt * 4));
      this.phase += dt * 2;
      this.root.position.set(spot.x, groundY + 22 + Math.sin(this.phase) * 3, spot.z);
    }
    this.fig.rotation.y = this.face;
    this.fig.rotation.z = Math.sin(this.phase * 0.7) * 0.07;   // gentle drifting sway
    return ended;
  }
}

// a black cat slinking along the sidewalks (fall) — reuses the pedestrian paths
class Cat {
  root = new THREE.Group();
  private heading = new THREE.Group();
  private legs: THREE.Mesh[] = [];
  private tail: THREE.Mesh;
  pts: number[] = [];
  total = 1;
  t = 0;
  dir = 1;
  speed = 26 + Math.random() * 18;
  private face = Math.random() * Math.PI * 2;
  private phase = Math.random() * 6;

  constructor(seed: number) {
    const rng = mulberry32(seed);
    const fur = rng() < 0.7 ? '#1b181f' : '#2c2a30';   // mostly black, the odd dark-grey
    const body = cap(2, 5.5, fur); body.rotation.x = Math.PI / 2; body.position.set(0, 4.4, 0);
    const head = sph(2.3, fur, 1, 0.95, 0.9); head.position.set(0, 5.4, 4.6);
    for (const sx of [-1, 1]) { const ear = cone(0.9, 1.8, fur); ear.position.set(sx * 1.1, 7.2, 4.7); this.heading.add(ear); }
    this.tail = cap(0.6, 5, fur); this.tail.position.set(0, 6, -4.4); this.tail.rotation.x = -0.7;   // curled up
    for (const [lx, lz] of [[-1.5, 3.2], [1.5, 3.2], [-1.5, -3], [1.5, -3]] as const) {
      const leg = cap(0.65, 3, fur, true); leg.position.set(lx, 4, lz); this.legs.push(leg); this.heading.add(leg);
    }
    this.heading.add(body, head, this.tail);
    this.heading.scale.setScalar(0.9 + rng() * 0.25);
    this.root.add(this.heading);
  }

  advance(dt: number, groundY: number): boolean {
    this.t += this.speed * dt * this.dir;
    const ended = this.t <= 0 || this.t >= this.total;
    const spot = alongPolyline(this.pts, Math.max(0.5, Math.min(this.total - 0.5, this.t)));
    if (spot) {
      this.face = lerpAngle(this.face, Math.atan2(spot.dx * this.dir, spot.dz * this.dir), Math.min(1, dt * 5));
      this.phase += dt * 11;
      const s = Math.sin(this.phase) * 0.5;
      this.legs[0].rotation.x = s; this.legs[3].rotation.x = s;     // diagonal pairs
      this.legs[1].rotation.x = -s; this.legs[2].rotation.x = -s;
      this.tail.rotation.z = Math.sin(this.phase * 0.5) * 0.25;     // tail sway
    }
    this.heading.rotation.y = this.face;
    this.root.position.y += (groundY - this.root.position.y) * Math.min(1, dt * 10);
    return ended;
  }
}

const _up = new THREE.Vector3(0, 1, 0);
const _dir = new THREE.Vector3();

// a pet dog at heel beside its walker, on the end of a real leash. The dog
// chases a point at its person's side; every so often a sniff-stop pins its
// nose to the ground until the slack runs out, then it trots to catch up.
class LeashDog {
  root = new THREE.Group();
  leash: THREE.Mesh;                    // scene-level: re-strung hand → collar every frame
  private heading = new THREE.Group();
  private headGrp = new THREE.Group();  // pitches down for the sniff
  private legs: THREE.Mesh[] = [];
  private tailM: THREE.Mesh;
  private phase = Math.random() * 6;
  private face = Math.random() * Math.PI * 2;
  private sniffT = 0;
  private nextSniff: number;
  private side: number;                 // which side of the walker this dog heels on
  private collarY: number;

  constructor(seed: number) {
    const rng = mulberry32(seed);
    const B = PUP_BREEDS[Math.floor(rng() * PUP_BREEDS.length)];
    const bodyLen = 4.4 * B.stretch, legLen = 3.4 * B.leg;
    const bodyY = 2.6 + legLen;
    const body = cap(2.1, bodyLen, B.fur); body.rotation.x = Math.PI / 2; body.position.set(0, bodyY, 0);
    const belly = cap(1.6, bodyLen * 0.8, B.belly); belly.rotation.x = Math.PI / 2; belly.position.set(0, bodyY - 1, 0.2);
    this.headGrp.position.set(0, bodyY + 1.6, bodyLen / 2 + 1.2);
    const head = sph(2, B.fur, 1, 0.95, 0.95); head.position.set(0, 0.6, 0.4);
    const snout = cap(1, 1.2, B.belly); snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.1, 2.2);
    const nose = sph(0.5, '#26211c'); nose.position.set(0, 0.35, 3.2);
    for (const sx of [-1, 1]) {
      const ear = sph(1.05, B.ear, 0.4, 1.15, 0.8); ear.position.set(sx * 1.7, 1.4, 0.2);
      this.headGrp.add(ear);
    }
    this.headGrp.add(head, snout, nose);
    this.tailM = cap(0.55, 2.2, B.fur, true);
    this.tailM.position.set(0, bodyY + 1.2, -(bodyLen / 2 + 1.2));
    this.tailM.rotation.x = 2.4;        // up and back, mid-wag most of the day
    for (const [lx, lz] of [[-1.4, bodyLen / 2 - 0.4], [1.4, bodyLen / 2 - 0.4], [-1.4, -(bodyLen / 2 - 0.4)], [1.4, -(bodyLen / 2 - 0.4)]]) {
      const leg = cap(0.62, legLen, B.fur, true); leg.position.set(lx, bodyY + 0.6, lz);
      this.legs.push(leg); this.heading.add(leg);
    }
    const collar = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.3, 6, 12), mat(['#8a3a2e', '#3e5c84', '#54652c'][Math.floor(rng() * 3)]));
    collar.rotation.x = Math.PI / 2 - 0.35; collar.position.set(0, bodyY + 1, bodyLen / 2 - 0.3);
    collar.castShadow = true;
    this.heading.add(body, belly, this.headGrp, this.tailM, collar);
    const sc = B.size * (0.92 + rng() * 0.16);
    this.heading.scale.setScalar(sc);
    this.root.add(this.heading);
    this.side = rng() < 0.5 ? -1 : 1;
    this.nextSniff = 2 + rng() * 6;
    this.collarY = (bodyY + 1.3) * sc;
    const lg = new THREE.CylinderGeometry(0.22, 0.22, 1, 5);
    lg.translate(0, 0.5, 0);            // pivot at one end so position+scale strings it
    this.leash = new THREE.Mesh(lg, mat('#4a3a2c'));
  }

  follow(dt: number, w: Walker, gy: number) {
    // heel point: beside the near hand, half a stride back
    const wf = w.facing;
    const fx = Math.sin(wf), fz = Math.cos(wf);
    const rx = fz * this.side, rz = -fx * this.side;
    const tx = w.root.position.x + rx * 7.5 - fx * 4.5;
    const tz = w.root.position.z + rz * 7.5 - fz * 4.5;
    let dx = tx - this.root.position.x, dz = tz - this.root.position.z;
    let dist = Math.hypot(dx, dz);
    if (dist > 260) {   // the walker was recycled offscreen — pop over with them
      this.root.position.set(tx, gy, tz);
      this.face = wf;
      dx = 0; dz = 0; dist = 0;
    }
    this.nextSniff -= dt;
    if (this.sniffT > 0) {
      this.sniffT -= dt;
      if (dist > 24) this.sniffT = 0;               // out of slack — moving on
    } else if (this.nextSniff <= 0 && dist < 14) {
      this.sniffT = 0.9 + (this.phase % 1);         // something smells important
      this.nextSniff = 4 + ((this.phase * 7) % 9);
    }
    const chase = this.sniffT > 0 ? 0 : Math.min(95, Math.max(0, (dist - 2) * 4));
    if (dist > 0.5 && chase > 0) {
      this.root.position.x += (dx / dist) * chase * dt;
      this.root.position.z += (dz / dist) * chase * dt;
      this.face = lerpAngle(this.face, Math.atan2(dx, dz), Math.min(1, dt * 7));
    } else {
      this.face = lerpAngle(this.face, wf, Math.min(1, dt * 3));
    }
    this.phase += dt * (3 + chase * 0.14);
    const s = Math.sin(this.phase) * Math.min(1, chase / 26) * 0.6;
    this.legs[0].rotation.x = s; this.legs[3].rotation.x = s;      // diagonal pairs
    this.legs[1].rotation.x = -s; this.legs[2].rotation.x = -s;
    const sn = this.sniffT > 0 ? 0.8 : 0;
    this.headGrp.rotation.x += (sn - this.headGrp.rotation.x) * Math.min(1, dt * 8);
    this.tailM.rotation.z = Math.sin(this.phase * 1.6) * (0.3 + (sn ? 0.25 : 0));
    this.heading.rotation.y = this.face;
    this.root.position.y += (gy - this.root.position.y) * Math.min(1, dt * 10);
    // re-string the leash from the hand to the collar
    const hs = w.size;
    const hx = w.root.position.x + rx * 5.9 * hs;
    const hy = w.root.position.y + 14.5 * hs;      // the bottom of the swinging arm
    const hz = w.root.position.z + rz * 5.9 * hs;
    const cx = this.root.position.x + Math.sin(this.face) * 2.2;
    const cy = this.root.position.y + this.collarY;
    const cz = this.root.position.z + Math.cos(this.face) * 2.2;
    _dir.set(cx - hx, cy - hy, cz - hz);
    const ll = _dir.length();
    this.leash.position.set(hx, hy, hz);
    this.leash.scale.set(1, Math.max(0.001, ll), 1);
    if (ll > 0.001) this.leash.quaternion.setFromUnitVectors(_up, _dir.multiplyScalar(1 / ll));
  }
}

// a white-tailed deer. The look lives in the big ears and the tail; the life
// lives in the flight response — graze head-down, freeze head-UP as the player
// closes in, then bound away with the white flag raised. (You play a DOG:
// of course they run.) Groups share one mood — see the deer loop in Life.
class Deer {
  root = new THREE.Group();
  face = Math.random() * Math.PI * 2;
  fawn: boolean;
  blocked: (x: number, z: number) => boolean = () => false;   // wired by Life at spawn
  private heading = new THREE.Group();
  private neck = new THREE.Group();     // pitches: down to the grass, up on alert
  private tail = new THREE.Group();     // pitches up to flash the white
  private legs: THREE.Mesh[] = [];
  private phase = Math.random() * 6;
  private headDown = 0;
  private grazeT = 1 + Math.random() * 2;
  private grazing = true;
  private wx = 0; private wz = 0;       // idle amble target inside the clearing

  constructor(seed: number, kind: 'doe' | 'buck' | 'fawn') {
    const rng = mulberry32(seed);
    this.fawn = kind === 'fawn';
    const coat = this.fawn ? '#b08a58' : DEER_COAT;
    const pale = '#e7dfcb';
    const legLen = 9, bodyY = 13;
    const body = cap(3.1, 7.6, coat); body.rotation.x = Math.PI / 2; body.position.set(0, bodyY, -0.4);
    const chest = sph(3.2, coat, 0.95, 1, 0.9); chest.position.set(0, bodyY + 0.4, 3.6);
    const rump = sph(2.9, coat, 1, 0.95, 0.9); rump.position.set(0, bodyY + 0.4, -4.6);
    const rumpPatch = sph(2.2, pale, 0.9, 0.8, 0.5); rumpPatch.position.set(0, bodyY + 0.7, -6.9);
    const belly = cap(2.2, 6, pale); belly.rotation.x = Math.PI / 2; belly.position.set(0, bodyY - 1.4, 0);
    // the neck leaves the chest leaning FORWARD — a deer carries its head ahead
    // of the shoulders, never straight up on a post (straight up reads as a llama).
    // It's also LONG: the graze pitch below has to reach the head down to the grass.
    this.neck.position.set(0, bodyY + 1.4, 4.4);
    const neckM = cap(1.3, 3.6, coat); neckM.position.set(0, 2.2, 2.1); neckM.rotation.x = 0.72;
    // a long wedge of a head, angled down-forward off the neck's top
    const head = sph(1.65, coat, 0.9, 1, 1.4); head.position.set(0, 4.6, 4.6); head.rotation.x = 0.5;
    const snout = cap(0.8, 1.9, coat); snout.rotation.x = Math.PI / 2 - 0.5; snout.position.set(0, 3.9, 6.1);
    const nose = sph(0.48, '#241f1a'); nose.position.set(0, 3.4, 7);
    const chin = sph(0.75, pale, 1, 0.7, 1); chin.position.set(0, 3.3, 5.9);
    this.neck.add(neckM, head, snout, nose, chin);
    for (const sx of [-1, 1]) {
      // the ears are half the deer: big, wide-set, tipped outward
      const ear = sph(1.5, coat, 0.42, 1.25, 0.7); ear.position.set(sx * 2, 6.2, 3.2);
      ear.rotation.z = sx * 0.7;
      const earIn = sph(1, pale, 0.3, 1.1, 0.55); earIn.position.set(sx * 2.1, 6.2, 3.5);
      earIn.rotation.z = sx * 0.7;
      const eye = sph(0.42, '#221d18'); eye.position.set(sx * 1.1, 5.1, 4.6);
      this.neck.add(ear, earIn, eye);
    }
    if (kind === 'buck') {
      const ant = '#b09a78';
      for (const sx of [-1, 1]) {
        // one clean beam sweeping up-and-out with a single tine — a readable rack
        // beats an accurate tangle at this size
        const beam = cap(0.3, 4.2, ant); beam.position.set(sx * 1.5, 7.4, 3); beam.rotation.z = sx * 0.5; beam.rotation.x = 0.2;
        const tine = cap(0.22, 2.2, ant); tine.position.set(sx * 2.5, 8.8, 3.2); tine.rotation.z = sx * 1.1;
        this.neck.add(beam, tine);
      }
    }
    // the tail: coat on the outside, white beneath — the flag is this group
    // pitching up so the white shows to whatever is chasing
    this.tail.position.set(0, bodyY + 1.6, -6.7);
    const tailW = cap(0.7, 1.8, pale, true); tailW.position.z = 0.22;
    const tailD = cap(0.62, 1.7, coat, true); tailD.position.z = -0.22;
    this.tail.add(tailW, tailD);
    this.tail.rotation.x = 0.25;
    for (const [lx, lz] of [[-1.9, 2.8], [1.9, 2.8], [-1.9, -3.6], [1.9, -3.6]]) {
      const leg = cap(0.6, legLen, coat, true); leg.position.set(lx, bodyY + 1, lz);
      this.legs.push(leg); this.heading.add(leg);
    }
    if (this.fawn) {
      for (let i = 0; i < 10; i++) {    // the spots — nothing says fawn faster. ON the
        const sx = rng() < 0.5 ? -1 : 1; // coat surface, not buried inside the body
        const a = rng() * 1.1;           // 0 = straight up the spine, 1.1 = down the flank
        const spot = sph(0.36, pale);
        spot.position.set(sx * Math.sin(a) * 3.1, bodyY + Math.cos(a) * 3.1, (rng() - 0.5) * 6.8);
        this.heading.add(spot);
      }
    }
    this.heading.add(body, chest, rump, rumpPatch, belly, this.neck, this.tail);
    this.heading.scale.setScalar((kind === 'buck' ? 1.25 : kind === 'fawn' ? 0.62 : 1.15) * (0.96 + rng() * 0.08));
    this.root.add(this.heading);
  }

  step(dt: number, mood: 'calm' | 'wary' | 'flee', hx: number, hz: number, px: number, pz: number, gy: number) {
    const x = this.root.position.x, z = this.root.position.z;
    if (mood === 'flee') {
      // bound straight away from the player, veering off anything solid
      const ax = x - px, az = z - pz;
      const d = Math.hypot(ax, az) || 1;
      let want = Math.atan2(ax / d, az / d);
      for (const off of [0, 0.7, -0.7, 1.4, -1.4]) {
        if (!this.blocked(x + Math.sin(want + off) * 34, z + Math.cos(want + off) * 34)) { want += off; break; }
      }
      this.face = lerpAngle(this.face, want, Math.min(1, dt * 6));
      const spd = this.fawn ? 235 : 265;
      this.root.position.x += Math.sin(this.face) * spd * dt;
      this.root.position.z += Math.cos(this.face) * spd * dt;
      this.phase += dt * 6.5;
      const hop = Math.abs(Math.sin(this.phase));
      this.root.position.y = gy + hop * 5.2;                     // the bounding arc
      this.heading.rotation.x = Math.cos(this.phase) * -0.22;    // nose rises into each leap
      const g = Math.sin(this.phase) * 0.9;
      this.legs[0].rotation.x = -0.4 + g; this.legs[1].rotation.x = -0.4 + g * 0.9;
      this.legs[2].rotation.x = 0.5 - g; this.legs[3].rotation.x = 0.5 - g * 0.9;
      this.neck.rotation.x += (-0.15 - this.neck.rotation.x) * Math.min(1, dt * 8);
      this.tail.rotation.x += (-2 - this.tail.rotation.x) * Math.min(1, dt * 8);   // white flag UP
      this.heading.rotation.y = this.face;
      return;
    }
    this.root.position.y += (gy - this.root.position.y) * Math.min(1, dt * 10);
    this.heading.rotation.x *= Math.max(0, 1 - dt * 6);
    this.tail.rotation.x += (0.25 - this.tail.rotation.x) * Math.min(1, dt * 4);
    this.tail.rotation.z = Math.sin(this.phase * 1.3) * 0.22;    // the idle swish
    if (mood === 'wary') {
      // frozen mid-chew: head snaps up, eyes and ears on the player
      this.face = lerpAngle(this.face, Math.atan2(px - x, pz - z), Math.min(1, dt * 5));
      this.headDown += (0 - this.headDown) * Math.min(1, dt * 9);
      for (const l of this.legs) l.rotation.x *= Math.max(0, 1 - dt * 8);
    } else {
      this.grazeT -= dt;
      if (this.grazeT <= 0) {
        this.grazing = !this.grazing;
        if (this.grazing) {
          this.grazeT = 2.2 + Math.random() * 2.6;
        } else {
          this.grazeT = 1.6 + Math.random() * 2;
          // amble to fresh grass — stay near the family, skip anything solid
          for (let tries = 0; tries < 3; tries++) {
            const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 110;
            const nx = hx + Math.cos(a) * r, nz = hz + Math.sin(a) * r;
            if (!this.blocked(nx, nz)) { this.wx = nx; this.wz = nz; break; }
          }
        }
      }
      if (this.grazing) {
        this.headDown += (1 - this.headDown) * Math.min(1, dt * 5);
        for (const l of this.legs) l.rotation.x *= Math.max(0, 1 - dt * 8);
      } else {
        this.headDown += (0.3 - this.headDown) * Math.min(1, dt * 5);
        const dx = this.wx - x, dz = this.wz - z;
        const dd = Math.hypot(dx, dz);
        if (dd > 7) {
          this.face = lerpAngle(this.face, Math.atan2(dx, dz), Math.min(1, dt * 4));
          this.root.position.x += Math.sin(this.face) * 24 * dt;
          this.root.position.z += Math.cos(this.face) * 24 * dt;
          this.phase += dt * 5;
          const s = Math.sin(this.phase) * 0.35;
          this.legs[0].rotation.x = s; this.legs[3].rotation.x = s;
          this.legs[1].rotation.x = -s; this.legs[2].rotation.x = -s;
        }
      }
    }
    // headDown drives the neck: 0 = the built-in forward carriage (head AHEAD of
    // the shoulders — pulling it more upright reads llama, not deer), 1 = muzzle
    // swung right down into the grass
    this.neck.rotation.x += ((this.headDown * 1.9 - 0.12) - this.neck.rotation.x) * Math.min(1, dt * 6);
    this.heading.rotation.y = this.face;
  }
}

// a witch on a broomstick crossing the night sky (fall) — a high silhouette, like the bats
class Witch {
  root = new THREE.Group();
  active = false;
  cx = 0; cz = 0;
  ang = 0;
  radius = 300;
  private spin: number;
  private alt: number;
  private phase: number;
  private mat: THREE.MeshBasicMaterial;

  constructor(seed: number) {
    const rng = mulberry32(seed);
    this.mat = new THREE.MeshBasicMaterial({ color: '#161219', transparent: true, opacity: 0, fog: false });
    const M = (g: THREE.BufferGeometry, x: number, y: number, z: number, rx = 0, rz = 0) => {
      const m = new THREE.Mesh(g, this.mat); m.position.set(x, y, z); m.rotation.x = rx; m.rotation.z = rz; this.root.add(m); return m;
    };
    M(new THREE.CylinderGeometry(0.8, 0.8, 34, 6), 0, 0, 0, Math.PI / 2);          // broomstick (along +z)
    M(new THREE.ConeGeometry(3.4, 8, 6), 0, 0, -19, -Math.PI / 2);                  // bristles at the back
    M(new THREE.CapsuleGeometry(2.6, 5, 4, 8), 0, 5.5, 1);                          // witch body, sitting
    M(new THREE.BoxGeometry(7, 11, 1), 0, 5, -3.5, -0.3);                           // billowing cape
    M(new THREE.SphereGeometry(2.4, 8, 6), 0, 11, 2);                               // head
    M(new THREE.CylinderGeometry(5, 5, 0.8, 8), 0, 13, 2);                          // hat brim
    M(new THREE.ConeGeometry(2.8, 9, 7), 0, 17.5, 1.4);                             // pointy hat
    this.spin = (rng() < 0.5 ? -1 : 1) * (0.18 + rng() * 0.12);
    this.radius = 320 + rng() * 240;
    this.alt = 420 + rng() * 200;
    this.phase = rng() * 6;
  }

  glide(dt: number, t: number, night: number) {
    this.mat.opacity = Math.max(0, Math.min(0.95, (night - 0.2) * 2));   // only truly after dark
    this.ang += this.spin * dt;
    const x = this.cx + Math.cos(this.ang) * this.radius;
    const z = this.cz + Math.sin(this.ang) * this.radius;
    this.root.position.set(x, this.alt + Math.sin(t * 0.0008 + this.phase) * 22, z);
    this.root.rotation.y = this.ang + (this.spin > 0 ? Math.PI / 2 : -Math.PI / 2);
    this.root.rotation.z = (this.spin > 0 ? 1 : -1) * 0.16 + Math.sin(t * 0.0011) * 0.05;   // a wobble on the broom
  }
}

// a soft round mist puff — a flat alpha-faded disc
let _mistTex: THREE.CanvasTexture | null = null;
function mistTexture(): THREE.CanvasTexture {
  if (_mistTex) return _mistTex;
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(228,232,236,0.9)'); g.addColorStop(0.55, 'rgba(216,222,228,0.4)'); g.addColorStop(1, 'rgba(210,218,224,0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  _mistTex = new THREE.CanvasTexture(cv);
  return _mistTex;
}

// low graveyard mist that drifts over the burying ground and fades in after dark.
// Camera-facing sprites (not flat planes — those go edge-on from the chase cam).
class GraveMist {
  root = new THREE.Group();
  private puffs: { s: THREE.Sprite; bx: number; bz: number; ph: number; spd: number }[] = [];

  constructor(cx: number, cz: number, groundY: number) {
    const rng = mulberry32(hash32(Math.round(cx), Math.round(cz), 17));
    for (let i = 0; i < 11; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTexture(), transparent: true, opacity: 0, depthWrite: false, fog: true }));
      const sz = 150 + rng() * 170;
      s.scale.set(sz, sz * 0.5, 1);                         // low, wide puffs
      const bx = cx + (rng() - 0.5) * 620, bz = cz + (rng() - 0.5) * 620;
      s.position.set(bx, groundY + 13 + rng() * 9, bz);
      this.puffs.push({ s, bx, bz, ph: rng() * 6, spd: 0.2 + rng() * 0.3 });
      this.root.add(s);
    }
  }

  update(dt: number, t: number, night: number) {
    const op = Math.max(0, Math.min(0.72, (night - 0.12) * 1.6));
    for (const p of this.puffs) {
      (p.s.material as THREE.SpriteMaterial).opacity = op;
      p.s.position.x = p.bx + Math.sin(t * 0.0002 * p.spd + p.ph) * 40;   // slow drift
      p.s.position.z = p.bz + Math.cos(t * 0.00017 * p.spd + p.ph) * 36;
    }
  }
}

// a figure skating gentle loops on a frozen pond — arms out, leaning into the turn
class Skater {
  root = new THREE.Group();
  private fig = new THREE.Group();
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  private cx: number; private cz: number; private rad: number;
  private ang: number; private spin: number; private spd: number; private ph: number; private wob: number;

  constructor(seed: number, cx: number, cz: number, rad: number) {
    const rng = mulberry32(seed);
    const shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)], pants = PANTS[Math.floor(rng() * PANTS.length)];
    const skin = SKINS[Math.floor(rng() * SKINS.length)], hair = HAIRS[Math.floor(rng() * HAIRS.length)];
    this.legL = cap(1.6, 7, pants, true); this.legR = cap(1.6, 7, pants, true);
    this.legL.position.set(-2.2, 10.5, 0); this.legR.position.set(2.2, 10.5, 0);
    const torso = cap(3.3, 5.2, shirt); torso.scale.set(1.3, 1, 0.85); torso.position.y = 16;
    const head = sph(3.6, skin, 1, 0.95, 0.95); head.position.y = 25.4;
    const hairCap = sph(3.75, hair, 1.02, 0.68, 1); hairCap.position.y = 26.7;
    const scarf = box(7.2, 2.2, 7.2, SCARVES[Math.floor(rng() * SCARVES.length)]); scarf.position.y = 21;
    const armL = cap(1.1, 4.6, shirt, true), armR = cap(1.1, 4.6, shirt, true);
    armL.position.set(-5.4, 21, 0); armR.position.set(5.4, 21, 0);
    armL.rotation.z = 0.7; armR.rotation.z = -0.7;     // arms out for balance
    this.fig.add(this.legL, this.legR, torso, head, hairCap, scarf, armL, armR);
    this.fig.scale.setScalar(0.86 + rng() * 0.2);
    this.root.add(this.fig);
    this.cx = cx; this.cz = cz; this.rad = rad;
    this.ang = rng() * Math.PI * 2; this.spin = rng() < 0.5 ? 1 : -1;
    this.spd = 0.5 + rng() * 0.5; this.ph = rng() * 6; this.wob = rng() * 6;
  }

  glide(dt: number, gy: number) {
    this.ang += this.spin * this.spd * dt;
    const r = this.rad * (1 + 0.13 * Math.sin(this.ang * 1.5 + this.wob));   // not a perfect circle
    const x = this.cx + Math.cos(this.ang) * r, z = this.cz + Math.sin(this.ang) * r;
    this.root.position.set(x, gy + 0.4 + Math.sin(this.ph) * 0.5, z);
    this.fig.rotation.y = Math.atan2(-Math.sin(this.ang) * this.spin, Math.cos(this.ang) * this.spin); // face travel
    this.fig.rotation.z = this.spin * 0.17;                  // lean into the turn
    this.ph += dt * 3.4;
    const s = Math.sin(this.ph) * 0.42;                      // gentle push-glide stride
    this.legL.rotation.x = s; this.legR.rotation.x = -s;
  }
}

// a kid sledding down a hill: slides down seated, then trudges back up on foot
// dragging the sled, and pushes off again
class Sledder {
  root = new THREE.Group();
  private tilt = new THREE.Group();   // yaw + pitch to the slope
  private kid = new THREE.Group();
  private sled: THREE.Mesh;
  private legL: THREE.Mesh;
  private legR: THREE.Mesh;
  private index: WorldIndex;
  private dist: number; private spd = 18; private state: 'down' | 'up' = 'down'; private wait = 0; private ph = 0;
  private arm: THREE.Mesh | null = null;   // raised to wave back when Clipper barks
  wave = 0;

  constructor(seed: number, index: WorldIndex, startDist: number) {
    this.index = index; this.dist = startDist;
    const rng = mulberry32(seed);
    const shirt = SHIRTS[Math.floor(rng() * SHIRTS.length)], pants = PANTS[Math.floor(rng() * PANTS.length)];
    const skin = SKINS[Math.floor(rng() * SKINS.length)], hair = HAIRS[Math.floor(rng() * HAIRS.length)];
    this.sled = rbox(9, 2.2, 17, 1, ['#b03a32', '#7c4a2e', '#3e5c84', '#c8a142'][Math.floor(rng() * 4)]);
    for (const sx of [-1, 1]) { const rn = box(1, 1.6, 18, '#3a3c40'); rn.position.set(sx * 3.4, 0.8, 0); this.tilt.add(rn); }
    this.legL = cap(1.5, 6, pants, true); this.legR = cap(1.5, 6, pants, true);
    this.legL.position.set(-2.1, 9, 0); this.legR.position.set(2.1, 9, 0);
    const torso = cap(2.9, 4.4, shirt); torso.position.y = 13.6;
    const head = sph(3.2, skin, 1, 0.95, 0.95); head.position.y = 19;
    const hairCap = sph(3.35, hair, 1.02, 0.68, 1); hairCap.position.y = 20.1;
    const scarf = box(6, 2, 6, SCARVES[Math.floor(rng() * SCARVES.length)]); scarf.position.y = 15.4;
    this.kid.add(this.legL, this.legR, torso, head, hairCap, scarf);
    this.arm = cap(1.1, 5.2, '#c94a3a', true); this.arm.position.set(3.4, 15.5, 0); this.arm.rotation.x = 0.4; this.arm.visible = false; this.kid.add(this.arm);
    this.kid.scale.setScalar(0.86 + rng() * 0.16);
    this.tilt.add(this.sled, this.kid);
    this.root.add(this.tilt);
    this.pose(true);
  }

  // seated on the sled (sliding) vs standing behind it (trudging back up)
  private pose(seated: boolean) {
    if (seated) {
      this.kid.position.set(0, 3.4, -1); this.kid.rotation.x = -0.18;
      this.legL.rotation.x = this.legR.rotation.x = -1.4;     // legs forward over the sled
      this.sled.position.set(0, 1.4, 1);
    } else {
      this.kid.position.set(0, 0, 7); this.kid.rotation.x = 0; // standing behind, pulling
      this.sled.position.set(0, 1.4, -6);
    }
  }

  update(dt: number) {
    if (this.arm) {
      if (this.wave > 0) { this.wave -= dt; this.arm.visible = true; this.arm.rotation.x = -2.6; this.arm.rotation.z = Math.sin(this.wave * 9) * 0.5; }
      else this.arm.visible = false;
    }
    if (this.state === 'down') {
      this.spd = Math.min(165, this.spd + 95 * dt);            // build speed downhill
      this.dist += this.spd * dt;
      if (this.dist >= MARCH_RUN) { this.dist = MARCH_RUN; this.state = 'up'; this.wait = 0.5 + (this.spd % 1); this.pose(false); }
    } else {
      if (this.wait > 0) { this.wait -= dt; }
      else {
        this.dist -= 42 * dt;                                  // trudge back up
        this.ph += dt * 7;
        const s = Math.sin(this.ph) * 0.5;
        this.legL.rotation.x = s; this.legR.rotation.x = -s;
        if (this.dist <= 0) { this.dist = 0; this.state = 'down'; this.spd = 16; this.pose(true); }
      }
    }
    const f = this.state === 'down' ? 1 : -1;
    const x = MARCH_TOP.x + MARCH_DIR.x * this.dist, z = MARCH_TOP.z + MARCH_DIR.z * this.dist;
    const y = this.index.heightAtPx(x, z);
    this.root.position.set(x, y, z);
    this.tilt.rotation.y = Math.atan2(MARCH_DIR.x * f, MARCH_DIR.z * f);   // face the way you're going
    // pitch the sled/kid to the slope ahead
    const ax = x + MARCH_DIR.x * 16 * f, az = z + MARCH_DIR.z * 16 * f;
    this.tilt.rotation.x = Math.atan2(y - this.index.heightAtPx(ax, az), 16);
  }
}

export class Life {
  private index: WorldIndex;
  private peds: Walker[] = [];
  private smoke: Smoke;
  private fireflies: Fireflies;
  private signals: Signals;
  /** the chimney tops of every loaded chunk (set by Game) */
  chimneySource: () => Iterable<number[]> = () => [];
  /** the sledding kids wave back when Clipper barks */
  waveSledders() { for (const s of this.sledders) s.wave = 2.4; }
  /** the traffic-signal heads of every loaded chunk (set by Game) */
  signalSource: () => Iterable<number[]> = () => [];
  private cars: TrafficCar[] = [];
  private fireHome: { x: number; z: number } | null = null;
  private emsHome: { x: number; z: number } | null = null;
  private emsT = 500; private emsRun = 0;
  private forceMail = false;
  private train: Train | null = null;
  private crossings: Crossing[] = [];
  // 🎅 the Santa parade: the engine down the parade street at a walk, elves behind
  private elves: Walker[] = [];
  private paradeRoad: { pts: number[]; total: number; dir: number; w: number } | null = null;
  private paradeOn = false;
  private forceParade = false;
  private jingleT = 0;
  // 🎸 the summer concert on the waterfront lawn
  private concert: { root: THREE.Group; players: THREE.Object3D[]; arms: THREE.Object3D[]; lights: THREE.MeshBasicMaterial[]; on: boolean; built: boolean } | null = null;
  private forceConcert = false;
  private audio: GameAudio | null = null;
  private rail: number[] = []; private railLen = 0; private stationT = 0; private railOut = 1;
  private fireT = 300;         // seconds until the engine's next run (counts down while it's home)
  private fireRun = 0;         // seconds left on the current run
  private plowT = 0;           // seconds of plowing left after the last snow
  private forceBus = false;
  private forcePlow = false;
  private boats: WanderBoat[] = [];
  private gulls: Gull[] = [];
  private skaters: Skater[] = [];      // winter: figures looping on the frozen Frog Pond
  private sledders: Sledder[] = [];    // winter: kids sledding March's Hill
  private bats: Bat[] = [];            // fall: bats wheeling over the rooftops at dusk
  private ghosts: RoamGhost[] = [];    // fall: translucent ghosts drifting the streets at dusk
  private cats: Cat[] = [];            // fall: black cats slinking the sidewalks
  private witch: Witch | null = null;  // fall: a witch crossing the night sky
  private mist: GraveMist | null = null;   // fall: graveyard mist at Old Hill
  private pups: { d: LeashDog; w: Walker }[] = [];   // pet dogs at heel on their leashes
  private deerG: { members: Deer[]; cx: number; cz: number; mood: 'calm' | 'wary' | 'flee'; active: boolean }[] = [];

  constructor(scene: THREE.Scene, index: WorldIndex, audio?: GameAudio) {
    this.audio = audio ?? null;
    this.index = index;
    this.smoke = new Smoke(scene);
    this.fireflies = new Fireflies(scene);
    this.signals = new Signals(scene);
    for (let i = 0; i < PEDS; i++) {
      // in fall, ~45% of the folks out walking are costumed trick-or-treaters
      const costume = SEASON === 'fall' && hash32(i, 53, 11) % 100 < 45
        ? COSTUMES[hash32(i, 71, 5) % COSTUMES.length] : undefined;
      const p = new Walker(i * 977 + 11, costume);
      p.root.position.set(0, 0, 1e7);
      this.peds.push(p);
      scene.add(p.root);
    }
    // a few of the walkers head out with the dog — leash, sniff-stops and all
    for (let i = 0; i < PUPS; i++) {
      const d = new LeashDog(i * 389 + 5);
      d.root.position.set(0, 0, 1e7);
      this.pups.push({ d, w: this.peds[(i * 5 + 2) % PEDS] });
      scene.add(d.root, d.leash);
    }
    // deer families, parked offscreen until update() finds them a clearing
    for (let i = 0; i < DEER_GROUPS; i++) {
      const rng = mulberry32(i * 811 + 41);
      const fawns = SEASON === 'spring' || SEASON === 'summer';
      const buck = !fawns && rng() < 0.45;
      const members: Deer[] = [new Deer(i * 131 + 7, buck ? 'buck' : 'doe')];
      const extra = 1 + Math.floor(rng() * 2);
      for (let j = 0; j < extra; j++) members.push(new Deer(i * 131 + 17 + j * 29, fawns ? 'fawn' : 'doe'));
      for (const m of members) {
        m.blocked = (x, z) => this.index.isBlocked(x, z) || this.index.isWaterAt(x, z);
        m.root.position.set(0, 0, 1e7);
        scene.add(m.root);
      }
      this.deerG.push({ members, cx: 0, cz: 1e7, mood: 'calm', active: false });
    }
    for (let i = 0; i < CARS; i++) {
      const car = new TrafficCar(i * 569 + 7);
      car.root.position.set(0, 0, 1e7);
      this.cars.push(car);
      scene.add(car.root);
    }
    // the service fleet: one of each, parked off-world until their hour
    for (const role of ['bus', 'fire', 'police', 'plow', 'ems', 'mail'] as CarRole[]) {
      if (role === 'plow' && SEASON !== 'winter') continue;
      if (role === 'bus' && SEASON === 'summer') continue;   // no school in summer
      const v = new TrafficCar(role.length * 977 + 13, role);
      v.dormant = true;
      v.pts = [];
      v.root.position.set(0, 0, 1e7);
      this.cars.push(v);
      scene.add(v.root);
    }
    // the fire engine starts its runs from the real station when the map names one
    const station = index.world.buildings.find((b) => b.n && /fire (department|station)/i.test(b.n) && !/west|newbury fire/i.test(b.n))
      ?? index.world.buildings.find((b) => b.n && /fire (department|station)/i.test(b.n));
    if (station) {
      let sx = 0, sz = 0, n = 0;
      for (let i = 0; i < station.p.length; i += 2) { sx += station.p[i]; sz += station.p[i + 1]; n++; }
      this.fireHome = { x: sx / n, z: sz / n };
    }
    const hospital = index.world.buildings.find((b) => b.n && /hospital/i.test(b.n) && !/heliport/i.test(b.n));
    if (hospital) {
      let sx = 0, sz = 0, n = 0;
      for (let i = 0; i < hospital.p.length; i += 2) { sx += hospital.p[i]; sz += hospital.p[i + 1]; n++; }
      this.emsHome = { x: sx / n, z: sz / n };
    }
    const q = typeof location !== 'undefined' ? new URLSearchParams(location.search) : null;
    this.fireT = q?.get('fire') === '1' ? 0 : 240 + Math.random() * 300;
    this.emsT = q?.get('ems') === '1' ? 0 : 420 + Math.random() * 400;
    this.forceBus = q?.get('bus') === '1';
    this.forcePlow = q?.get('plow') === '1';
    this.forceMail = q?.get('mail') === '1';
    this.forceParade = q?.get('parade') === '1';
    this.forceConcert = q?.get('concert') === '1';
    // the parade route: the named street, walked toward the square
    const pr = TOWN.attractions.parade;
    if (pr && (SEASON === 'winter' || this.forceParade)) {
      let best: { pts: number[]; total: number; dir: number; w: number } | null = null, bd = Infinity;
      for (const rd of index.world.roads) {
        if (rd.n !== pr.street || !TOWN_ROADS.includes(rd.c)) continue;
        const total = polyLen(rd.p);
        if (total < 600) continue;
        const d0 = (rd.p[0] - pr.toward.x) ** 2 + (rd.p[1] - pr.toward.z) ** 2;
        const d1 = (rd.p[rd.p.length - 2] - pr.toward.x) ** 2 + (rd.p[rd.p.length - 1] - pr.toward.z) ** 2;
        const d = Math.min(d0, d1);
        if (d < bd) { bd = d; best = { pts: rd.p, total, dir: d0 < d1 ? -1 : 1, w: rd.w }; }
      }
      if (best && bd < 300 * 300) {
        this.paradeRoad = best;
        for (let i = 0; i < 10; i++) {
          const e = new Walker(i * 97 + 5, 'elf');
          e.root.position.set(0, 0, 1e7);
          e.pts = [];
          this.elves.push(e);
          scene.add(e.root);
        }
      }
    }
    if (TOWN.attractions.concertPark && (SEASON === 'summer' || this.forceConcert)) {
      this.concert = { root: new THREE.Group(), players: [], arms: [], lights: [], on: false, built: false };
      this.concert.root.visible = false;
      scene.add(this.concert.root);
    }
    // the train, on the real line through the town's station
    if (TOWN.trainPlatform) {
      const line = this.railLine(TOWN.trainPlatform.x, TOWN.trainPlatform.z);
      if (line) {
        this.rail = line.pts; this.railLen = line.len; this.stationT = line.at; this.railOut = line.out;
        this.train = new Train();
        this.train.head = this.stationT + this.railOut * 140;
        if (q?.get('train') === 'depart') this.train.timer = 3;
        else if (q?.get('train') === 'arrive') { this.train.state = 'away'; this.train.timer = 1; }
        this.placeTrain();
        scene.add(this.train.root);
        this.buildCrossings(scene);
      }
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
    // winter brings two town traditions: skating on the Frog Pond + sledding March's Hill
    if (SEASON === 'winter' && FROG_POND) {
      const pondGy = index.heightAtPx(FROG_POND.x, FROG_POND.z);
      for (let i = 0; i < SKATERS; i++) {
        // staggered loops (offset centers + radii) so they don't trace one circle
        const a = (i / SKATERS) * Math.PI * 2;
        const cx = FROG_POND.x + Math.cos(a) * 70, cz = FROG_POND.z + Math.sin(a) * 50;
        const s = new Skater(i * 631 + 17, cx, cz, 120 + i * 40);
        s.root.position.set(cx, pondGy, cz);   // park at the pond (not world origin) before the first tick
        this.skaters.push(s);
        scene.add(s.root);
      }
    }
    if (SEASON === 'winter' && SLED) {
      const hillGy = index.heightAtPx(MARCH_TOP.x, MARCH_TOP.z);
      for (let i = 0; i < SLEDDERS; i++) {
        const s = new Sledder(i * 743 + 23, index, (i / SLEDDERS) * MARCH_RUN);  // staggered along the run
        s.root.position.set(MARCH_TOP.x, hillGy, MARCH_TOP.z);   // park at the hill before the first tick
        this.sledders.push(s);
        scene.add(s.root);
      }
    }
    if (SEASON === 'fall') {
      for (let i = 0; i < BATS; i++) {
        const bt = new Bat(i * 421 + 19);
        bt.root.position.set(0, 0, 1e7);   // parked offscreen until update() places it near the player
        this.bats.push(bt);
        scene.add(bt.root);
      }
      for (let i = 0; i < ROAM_GHOSTS; i++) {
        const gh = new RoamGhost(i * 509 + 31);
        gh.root.position.set(0, 0, 1e7);
        this.ghosts.push(gh);
        scene.add(gh.root);
      }
      for (let i = 0; i < CATS; i++) {
        const ct = new Cat(i * 617 + 13);
        ct.root.position.set(0, 0, 1e7);
        this.cats.push(ct);
        scene.add(ct.root);
      }
      if (GRAVEYARD) {
        this.witch = new Witch(7);
        this.witch.cx = GRAVEYARD.x; this.witch.cz = GRAVEYARD.z;   // she circles the old burying ground
        this.witch.root.position.set(0, 0, 1e7);
        scene.add(this.witch.root);
        this.mist = new GraveMist(GRAVEYARD.x, GRAVEYARD.z, index.heightAtPx(GRAVEYARD.x, GRAVEYARD.z));
        scene.add(this.mist.root);
      }
    }
  }

  // 🐕 WOOF — a bark carries: any deer group with a member in earshot bolts
  // straight to flight, skipping the wary freeze. (Wired from Game.bark. The
  // leashed pups are made of sterner stuff and stay at heel.)
  scare(x: number, z: number) {
    for (const g of this.deerG) {
      if (!g.active) continue;
      for (const m of g.members) {
        const dx = m.root.position.x - x, dz = m.root.position.z - z;
        if (dx * dx + dz * dz < 450 * 450) { g.mood = 'flee'; break; }
      }
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
      && this.index.heightAtPx(x, z) < WATER_Y - 1.5
      // …and not on/under a dock — boats steer around the piers instead of through them
      && !this.index.pierAt(x, z)
      && !this.index.pierAt(x + r, z) && !this.index.pierAt(x - r, z)
      && !this.index.pierAt(x, z + r) && !this.index.pierAt(x, z - r);
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
      // downtown draws the crowd: with the player in the core, three spawns in four go to
      // a core sidewalk, so State Street is busy and the side streets thin out
      if (this.index.downtownAt(px, pz)) {
        const m = Math.floor(p.p.length / 4) * 2;
        if (!this.index.downtownAt(p.p[m], p.p[m + 1]) && rng() < 0.75) continue;
      }
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

  /** chain the rail segments through the point nearest (x,z) into one long polyline */
  private railLine(x: number, z: number): { pts: number[]; len: number; at: number; out: number } | null {
    const rails = this.index.world.rails;
    if (!rails.length) return null;
    let best = -1, bestD = Infinity;
    for (let i = 0; i < rails.length; i++) {
      const d = distToPolylineSq(x, z, rails[i].p);
      if (d < bestD) { bestD = d; best = i; }
    }
    if (best < 0 || bestD > 400 * 400) return null;
    const used = new Set<number>([best]);
    let pts = rails[best].p.slice();
    // grow from either end: the unused segment whose end lands on ours, straightest first
    const grow = (atEnd: boolean) => {
      for (let step = 0; step < 40; step++) {
        const ex = atEnd ? pts[pts.length - 2] : pts[0], ez = atEnd ? pts[pts.length - 1] : pts[1];
        const hx = atEnd ? ex - pts[pts.length - 4] : ex - pts[2], hz = atEnd ? ez - pts[pts.length - 3] : ez - pts[3];
        const hl = Math.hypot(hx, hz) || 1;
        let pick = -1, pickRev = false, pickScore = -2;
        for (let i = 0; i < rails.length; i++) {
          if (used.has(i)) continue;
          const p = rails[i].p;
          if (p.length < 4) continue;
          for (const rev of [false, true]) {
            const sx = rev ? p[p.length - 2] : p[0], sz = rev ? p[p.length - 1] : p[1];
            if ((sx - ex) ** 2 + (sz - ez) ** 2 > 40 * 40) continue;
            const nx = rev ? p[p.length - 4] - sx : p[2] - sx, nz = rev ? p[p.length - 3] - sz : p[3] - sz;
            const nl = Math.hypot(nx, nz) || 1;
            const score = (hx * nx + hz * nz) / (hl * nl);
            if (score > pickScore) { pickScore = score; pick = i; pickRev = rev; }
          }
        }
        if (pick < 0 || pickScore < 0.3) break;
        used.add(pick);
        let p = rails[pick].p.slice();
        // orient the piece to run away from the junction; growing at the front it
        // is then turned round so its far end leads into ours
        if (pickRev !== !atEnd) { const r: number[] = []; for (let i = p.length - 2; i >= 0; i -= 2) r.push(p[i], p[i + 1]); p = r; }
        pts = atEnd ? pts.concat(p.slice(2)) : p.slice(0, -2).concat(pts);
      }
    };
    grow(true); grow(false);
    const len = polyLen(pts);
    // the platform's distance along the line
    let at = 0, acc = 0, bd = Infinity;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i], az = pts[i + 1], dx = pts[i + 2] - ax, dz = pts[i + 3] - az;
      const l2 = dx * dx + dz * dz || 1;
      const tt = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const d = (ax + dx * tt - x) ** 2 + (az + dz * tt - z) ** 2;
      if (d < bd) { bd = d; at = acc + Math.sqrt(l2) * tt; }
      acc += Math.sqrt(l2);
    }
    // outbound is the long way: a terminus has the yard on one side and the line on the other
    return { pts, len, at, out: len - at > at ? 1 : -1 };
  }

  /** every street that crosses the line at grade gets its gates */
  private buildCrossings(scene: THREE.Scene) {
    const r = this.rail;
    const seg = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number, dx: number, dz: number): [number, number, number] | null => {
      const d = (bx - ax) * (dz - cz) - (bz - az) * (dx - cx);
      if (Math.abs(d) < 1e-9) return null;
      const t = ((cx - ax) * (dz - cz) - (cz - az) * (dx - cx)) / d;
      const u = ((cx - ax) * (bz - az) - (cz - az) * (bx - ax)) / d;
      if (t < 0 || t > 1 || u < 0 || u > 1) return null;
      return [ax + (bx - ax) * t, az + (bz - az) * t, u];
    };
    let acc = 0;
    const railAcc: number[] = [];
    for (let j = 0; j + 3 < r.length; j += 2) { railAcc.push(acc); acc += Math.hypot(r[j + 2] - r[j], r[j + 3] - r[j + 1]); }
    for (const rd of this.index.world.roads) {
      if (rd.b || rd.l || !TOWN_ROADS.includes(rd.c)) continue;
      for (let i = 0; i + 3 < rd.p.length; i += 2) {
        for (let j = 0; j + 3 < r.length; j += 2) {
          const h = seg(rd.p[i], rd.p[i + 1], rd.p[i + 2], rd.p[i + 3], r[j], r[j + 1], r[j + 2], r[j + 3]);
          if (!h) continue;
          if (this.crossings.some((c) => (c.x - h[0]) ** 2 + (c.z - h[1]) ** 2 < 60 * 60)) continue;
          const dx = rd.p[i + 2] - rd.p[i], dz = rd.p[i + 3] - rd.p[i + 1];
          const dl = Math.hypot(dx, dz) || 1;
          const th = Math.atan2(dx / dl, dz / dl);
          const t = railAcc[j / 2] + Math.hypot(r[j + 2] - r[j], r[j + 3] - r[j + 1]) * h[2];
          const c: Crossing = { x: h[0], z: h[1], t, gates: [], arms: [], beacons: [], down: 0, active: false, bellT: 0, horned: false };
          // one gate per approach, on the right-hand side, 34 px before the rails
          for (const side of [1, -1]) {
            const built = buildGate(rd.w);
            const ang = th + (side > 0 ? 0 : Math.PI);
            const lx = -(rd.w / 2 + 8), lz = -34;
            const gx = h[0] + lx * Math.cos(ang) + lz * Math.sin(ang);
            const gz = h[1] - lx * Math.sin(ang) + lz * Math.cos(ang);
            built.g.position.set(gx, this.groundAt(gx, gz), gz);
            built.g.rotation.y = ang;
            built.arm.rotation.z = Math.PI / 2;
            c.gates.push(built.g); c.arms.push(built.arm); c.beacons.push(...built.beacons);
            scene.add(built.g);
          }
          this.crossings.push(c);
        }
      }
    }
  }

  private updateCrossings(dt: number, t: number, px: number, pz: number) {
    const tr = this.train;
    if (!tr || !this.crossings.length) return;
    const moving = tr.state === 'out' || tr.state === 'in';
    const tail = tr.head - this.railOut * 3 * 96;
    const lo = Math.min(tr.head, tail) - 1100, hi = Math.max(tr.head, tail) + 1100;
    let nearest: Crossing | null = null, nd = Infinity;
    for (const c of this.crossings) {
      c.active = moving && c.t > lo && c.t < hi;
      c.down += ((c.active ? 1 : 0) - c.down) * Math.min(1, dt * 0.9);
      for (const a of c.arms) a.rotation.z = (Math.PI / 2) * (1 - c.down);
      for (const b of c.beacons) b.mat.opacity = c.active && ((t * b.rate + b.phase) % 1) < 0.5 ? 0.9 : 0;
      const d = Math.hypot(c.x - px, c.z - pz);
      if (c.active && d < nd) { nd = d; nearest = c; }
      if (!c.active) c.horned = false;
      else if (!c.horned && Math.abs(c.t - tr.head) < 720) {
        // the horn, two longs' worth, as the engine reaches the whistle post
        c.horned = true;
        const sp = alongPolyline(this.rail, tr.head);
        if (sp) this.audio?.trainHorn(Math.max(0, Math.min(1, 1 - (Math.hypot(sp.x - px, sp.z - pz) - 300) / 2200)));
      }
    }
    if (nearest) {
      nearest.bellT -= dt;
      if (nearest.bellT <= 0) { nearest.bellT = 0.5; this.audio?.crossingBell(Math.max(0, Math.min(1, 1 - (nd - 200) / 1300))); }
    }
  }

  private placeTrain() {
    const tr = this.train!;
    for (let i = 0; i < tr.cars.length; i++) {
      const d = Math.max(2, Math.min(this.railLen - 2, tr.head - this.railOut * i * 96));
      const sp = alongPolyline(this.rail, d);
      if (!sp) continue;
      const g = tr.cars[i];
      g.position.set(sp.x, this.groundAt(sp.x, sp.z) + 1.2, sp.z);
      g.rotation.y = Math.atan2(sp.dx * this.railOut, sp.dz * this.railOut);
    }
  }

  private updateTrain(dt: number, px: number, pz: number, fx: number, fz: number) {
    const tr = this.train;
    if (!tr) return;
    const tailT = tr.head - this.railOut * 3 * 96;
    const standHead = this.stationT + this.railOut * 140;
    if (tr.state === 'stand') {
      tr.timer -= dt;
      if (tr.timer <= 0) {
        tr.state = 'out'; tr.speed = 0;
        const sp = alongPolyline(this.rail, tr.head);
        if (sp) this.audio?.trainHorn(Math.max(0, Math.min(1, 1 - (Math.hypot(sp.x - px, sp.z - pz) - 300) / 2200)));
      }
    } else if (tr.state === 'out') {
      tr.speed = Math.min(230, tr.speed + 28 * dt);
      tr.head += this.railOut * tr.speed * dt;
      // gone: every car past the end of the line, or the whole train out of sight
      const outEnd = this.railOut > 0 ? tailT > this.railLen - 4 : tailT < 4;
      let hidden = true;
      for (const g of tr.cars) if (!this.okToSpawn(g.position.x, g.position.z, px, pz, fx, fz, 1400, 2600)) { hidden = false; break; }
      if (outEnd || (hidden && Math.abs(tr.head - standHead) > 1600)) {
        tr.state = 'away'; tr.timer = 160 + Math.random() * 120;
        tr.root.position.set(0, 0, 1e7);
        return;
      }
    } else if (tr.state === 'away') {
      tr.timer -= dt;
      if (tr.timer <= 0) {
        // come back in from as far out as the line allows, but never where the kid is looking
        const side = this.railOut > 0 ? this.railLen - 4 - standHead : standHead - 4;
        let d = Math.min(side, 2800);
        let ok = false;
        for (let k = 0; k < 6 && !ok; k++) {
          const hd = standHead + this.railOut * d;
          const sp = alongPolyline(this.rail, hd);
          ok = !!sp && this.okToSpawn(sp.x, sp.z, px, pz, fx, fz, 1400, 2600);
          if (!ok) d = Math.min(side, d + 1200);
          if (d >= side && k > 0) break;
        }
        if (!ok) { tr.timer = 20; return; }   // try again in a bit
        tr.head = standHead + this.railOut * d;
        tr.state = 'in'; tr.speed = 230;
        tr.root.position.set(0, 0, 0);
      } else return;
    } else if (tr.state === 'in') {
      const left = (tr.head - standHead) * this.railOut;
      // slow to a stop exactly at the platform: v² = 2·a·s
      const want = Math.min(230, Math.sqrt(Math.max(0, 2 * 26 * left)));
      tr.speed = Math.min(want, tr.speed + 28 * dt);
      if (left <= 1.5 || (tr.speed < 2 && left < 30)) { tr.head = standHead; tr.speed = 0; tr.state = 'stand'; tr.timer = 120 + Math.random() * 90; }
      else tr.head -= this.railOut * Math.min(left, tr.speed * dt);
    }
    this.placeTrain();
  }

  /** 🎅 the parade: on winter afternoons the engine crawls the parade street with Santa up top and the elves behind */
  private updateParade(dt: number, px: number, pz: number, fx: number, fz: number, tod: number) {
    if (!this.paradeRoad) return;
    const engine = this.cars.find((c) => c.role === 'fire');
    if (!engine) return;
    const want = this.forceParade || (SEASON === 'winter' && tod > 0.6 && tod < 0.68);
    if (want && !this.paradeOn) {
      // step off from the far end, only when nobody is looking at it
      const r = this.paradeRoad;
      const t0 = r.dir > 0 ? 220 : r.total - 220;   // room behind the engine for the columns
      const at = alongPolyline(r.pts, t0);
      if (!at || !this.okToSpawn(at.x, at.z, px, pz, fx, fz, 500, 2500)) return;
      this.paradeOn = true;
      engine.dormant = false; engine.parade = true; engine.pts = r.pts; engine.total = r.total; engine.roadW = r.w;
      engine.dir = r.dir; engine.t = t0; engine.cruise = 24; engine.speed = 0; engine.kerb = 0;
      engine.step(0.016, this.groundAt(at.x, at.z));
      engine.root.position.set(at.x, this.groundAt(at.x, at.z), at.z);
      for (let i = 0; i < this.elves.length; i++) {
        const e = this.elves[i];
        e.pts = r.pts; e.total = r.total; e.dir = r.dir;
        e.t = t0 - r.dir * (70 + Math.floor(i / 2) * 22);
        e.lane = (i % 2 ? 9 : -9) * r.dir;
        e.pause = 0; e.speed = 24; e.cadence = 9; e.stride = 0.9;
        const s = alongPolyline(r.pts, Math.max(0.5, Math.min(r.total - 0.5, e.t)));
        if (s) e.root.position.set(s.x, this.groundAt(s.x, s.z), s.z);
      }
      return;
    }
    if (!this.paradeOn) return;
    // the end of the route, or the hour gone by and nobody watching: the parade is over
    const atEnd = this.paradeRoad.dir > 0 ? engine.t >= this.paradeRoad.total - 40 : engine.t <= 40;
    const hidden = this.okToSpawn(engine.root.position.x, engine.root.position.z, px, pz, fx, fz, 900, 2500);
    if (atEnd) { engine.cruise = 0; }
    if ((atEnd || !want) && hidden) {
      this.paradeOn = false; engine.parade = false; engine.dormant = true; engine.pts = []; engine.lights = false;
      engine.root.position.set(0, 0, 1e7);
      for (const e of this.elves) { e.pts = []; e.root.position.set(0, 0, 1e7); }
      return;
    }
    engine.lights = true;
    for (const e of this.elves) {
      if (!e.pts.length) continue;
      // march at the engine's pace, and stand when it stands
      e.speed = engine.speed;
      if (engine.speed < 1) e.pause = 0.05;
      e.advance(dt, this.groundAt(e.root.position.x, e.root.position.z, e.root.position.y));
    }
    this.jingleT -= dt;
    if (this.jingleT <= 0) {
      this.jingleT = 4.5;
      if ((engine.root.position.x - px) ** 2 + (engine.root.position.z - pz) ** 2 < 520 * 520) this.audio?.jingle();
    }
  }

  /** 🎸 the summer concert: a stage on the park lawn, a trio playing, blankets and people on the grass */
  private updateConcert(dt: number, t: number, px: number, pz: number, fx: number, fz: number, tod: number) {
    const c = this.concert;
    if (!c) return;
    const day = Math.floor(Date.now() / 864e5);
    const want = this.forceConcert || (SEASON === 'summer' && tod > 0.76 && tod < 0.9 && day % 2 === 0);
    if (!c.built) {
      if (!want) return;
      const park = this.index.world.polys.find((p) => p.k === 'park' && p.n === TOWN.attractions.concertPark);
      if (!park) { this.concert = null; return; }
      let cx = 0, cz = 0, n = 0;
      for (let i = 0; i < park.p.length; i += 2) { cx += park.p[i]; cz += park.p[i + 1]; n++; }
      cx /= n; cz /= n;
      // face the stage toward the most lawn: the heading whose samples stay on grass
      let bestA = 0, bestScore = -1;
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        let score = 0;
        for (const d of [90, 170, 250, 330]) {
          const x = cx + Math.sin(a) * d, z = cz + Math.cos(a) * d;
          if (pointInPoly(x, z, park) && !this.index.isWaterAt(x, z) && !this.index.isBlocked(x, z)) score++;
        }
        if (score > bestScore) { bestScore = score; bestA = a; }
      }
      const g = this.groundAt(cx, cz);
      c.root.position.set(cx, g, cz);
      c.root.rotation.y = bestA;
      // the stage: a deck, a back wall, two truss towers with lamps, lights along the lip
      const deck = box(110, 9, 52, '#3a3634'); deck.position.set(0, 4.5, -10); c.root.add(deck);
      const back = box(110, 40, 3, '#26292d'); back.position.set(0, 29, -36); c.root.add(back);
      const banner = box(70, 12, 0.6, '#c8262a'); banner.position.set(0, 42, -34.5); banner.castShadow = false; c.root.add(banner);
      for (const sx of [-1, 1]) {
        const tower = box(4, 46, 4, '#55595e'); tower.position.set(sx * 58, 23, 4); c.root.add(tower);
        const lamp = new THREE.MeshBasicMaterial({ color: 0xfff1d0, fog: false });
        const can = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), lamp); can.position.set(sx * 58, 45, 6); c.root.add(can);
        c.lights.push(lamp);
      }
      // string lights along the front edge of the deck
      for (let i = -50; i <= 50; i += 8) {
        const m = new THREE.MeshBasicMaterial({ color: [0xff5a48, 0xffd24a, 0x5ad066, 0x5aa5ff][((i + 50) / 8) % 4], fog: false });
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.9, 6, 5), m); b.position.set(i, 10, 16.5); c.root.add(b);
        c.lights.push(m);
      }
      // the trio: guitar, bass, and a singer at the mic
      for (const [x, z, hex, inst] of [[-26, 2, '#3e5c84', 'guitar'], [0, -6, '#b03a32', 'mic'], [26, 2, '#54652c', 'bass']] as const) {
        const p = new THREE.Group();
        const legs = cap(3.2, 8, '#3b4d6b'); legs.position.y = 8; p.add(legs);
        const body = cap(3.6, 5.6, hex); body.scale.set(1.3, 1, 0.85); body.position.y = 17; p.add(body);
        const head = sph(3.7, SKINS[(x + 30) % SKINS.length], 1, 0.95, 0.95); head.position.y = 26.5; p.add(head);
        const hair = sph(3.85, HAIRS[(z + 10) % HAIRS.length], 1.02, 0.68, 1); hair.position.y = 27.9; p.add(hair);
        const arm = cap(1.2, 4.8, hex, true); arm.position.set(5.8, 22, 2); arm.rotation.x = -1.2; p.add(arm);
        const arm2 = cap(1.2, 4.8, hex, true); arm2.position.set(-5.8, 22, 2); arm2.rotation.x = -0.9; p.add(arm2);
        if (inst === 'mic') { const st = box(0.6, 26, 0.6, '#2a2a2a'); st.position.set(0, 13, 8); p.add(st); const mic = sph(1.2, '#4a4a4a'); mic.position.set(0, 26, 8); p.add(mic); }
        else { const gtr = box(inst === 'bass' ? 5 : 6, 12, 2.2, inst === 'bass' ? '#3a2a1c' : '#b8662a'); gtr.position.set(1, 16, 5); gtr.rotation.z = 0.5; p.add(gtr); const neck = box(1.2, 12, 1, '#2a1c12'); neck.position.set(-5, 21, 5); neck.rotation.z = 0.5; p.add(neck); }
        p.position.set(x, 9, z);
        c.root.add(p); c.players.push(p); c.arms.push(arm);
      }
      // the crowd: blankets on the grass in front, people sat on them
      const rng = mulberry32(4242);
      let placed = 0;
      for (let tries = 0; tries < 80 && placed < 18; tries++) {
        const lx = (rng() - 0.5) * 220, lz = 60 + rng() * 210;
        const wx = cx + Math.sin(bestA) * lz + Math.cos(bestA) * lx, wz = cz + Math.cos(bestA) * lz - Math.sin(bestA) * lx;
        if (!pointInPoly(wx, wz, park) || this.index.isWaterAt(wx, wz) || this.index.isBlocked(wx, wz)) continue;
        const bl = new THREE.Mesh(new THREE.PlaneGeometry(22 + rng() * 10, 16 + rng() * 8), mat(['#b03a32', '#3e5c84', '#c8a142', '#2e6e63', '#7c4a68', '#e0d6c4'][Math.floor(rng() * 6)]));
        bl.rotation.x = -Math.PI / 2; bl.rotation.z = (rng() - 0.5) * 0.6; bl.position.set(lx, this.groundAt(wx, wz) - g + 0.4, lz); bl.receiveShadow = true; c.root.add(bl);
        const people = 1 + Math.floor(rng() * 2.4);
        for (let k = 0; k < people; k++) {
          const s = new THREE.Group();
          const bod = cap(3, 3.6, SHIRTS[Math.floor(rng() * SHIRTS.length)]); bod.scale.set(1.25, 1, 0.9); bod.position.y = 5.5; s.add(bod);
          const hd = sph(3.2, SKINS[Math.floor(rng() * SKINS.length)], 1, 0.95, 0.95); hd.position.y = 12; s.add(hd);
          const hr = sph(3.35, HAIRS[Math.floor(rng() * HAIRS.length)], 1.02, 0.68, 1); hr.position.y = 13.3; s.add(hr);
          s.position.set(lx + (k - (people - 1) / 2) * 8, this.groundAt(wx, wz) - g, lz - 2);
          s.rotation.y = Math.PI + (rng() - 0.5) * 0.5;   // facing the stage
          c.root.add(s);
        }
        placed++;
      }
      c.built = true;
    }
    // on and off only while the lawn is out of sight
    if (want !== c.on) {
      const hidden = this.okToSpawn(c.root.position.x, c.root.position.z, px, pz, fx, fz, 700, 2500);
      if (hidden) { c.on = want; c.root.visible = want; }
    }
    if (!c.on) return;
    // the band plays: strumming arms, the singer sways
    for (let i = 0; i < c.arms.length; i++) c.arms[i].rotation.x = -1.2 + Math.sin(t * (i === 1 ? 2.2 : 7) + i) * (i === 1 ? 0.15 : 0.35);
    for (let i = 0; i < c.players.length; i++) c.players[i].rotation.y = Math.sin(t * 1.3 + i * 2) * 0.12;
  }

  private roadSpot(px: number, pz: number, fx: number, fz: number, rng: () => number, classes: string[] = ROAD_CLASSES, near?: { x: number; z: number; r: number }): { pts: number[]; w: number; total: number; t: number; dir: number; c: string } | null {
    for (let tries = 0; tries < 12; tries++) {
      const ax = near ? near.x : px, az = near ? near.z : pz, span = near ? near.r * 2 : 4400;
      const cx = Math.floor((ax + (rng() - 0.5) * span) / CHUNK);
      const cz = Math.floor((az + (rng() - 0.5) * span) / CHUNK);
      const bucket = this.index.buckets.get(cx + ',' + cz);
      if (!bucket || !bucket.roads.length) continue;
      const r = this.index.world.roads[bucket.roads[Math.floor(rng() * bucket.roads.length)]];
      if (!classes.includes(r.c)) continue;
      const total = polyLen(r.p);
      if (total < 260) continue;
      const t = 30 + rng() * (total - 60);
      const spot = alongPolyline(r.p, t);
      if (!spot) continue;
      if (near && (spot.x - near.x) ** 2 + (spot.z - near.z) ** 2 > near.r * near.r) continue;
      if (!this.okToSpawn(spot.x, spot.z, px, pz, fx, fz, near ? 260 : 1100, 2500)) continue;
      return { pts: r.p, w: r.w, total, t, dir: rng() < 0.5 ? 1 : -1, c: r.c };
    }
    return null;
  }

  update(dt: number, px: number, pz: number, t: number, fx: number, fz: number, night = 0, tod = 0.5, wet = 0) {
    const rng = mulberry32(hash32(Math.floor(t), 3, 7));
    // the service fleet's clocks
    if (SEASON === 'winter') { if (wet > 0.3) this.plowT = 180; else this.plowT = Math.max(0, this.plowT - dt); }
    if (this.fireRun > 0) this.fireRun = Math.max(0, this.fireRun - dt);
    else this.fireT -= dt;
    if (this.emsRun > 0) this.emsRun = Math.max(0, this.emsRun - dt);
    else this.emsT -= dt;
    this.updateTrain(dt, px, pz, fx, fz);
    this.updateCrossings(dt, t / 1000, px, pz);
    this.updateParade(dt, px, pz, fx, fz, tod);
    this.updateConcert(dt, t / 1000, px, pz, fx, fz, tod);
    this.smoke.update(dt, px, pz, night, this.chimneySource);
    this.fireflies.update(dt, t, px, pz, night, this.index, (x, z) => this.groundAt(x, z));
    this.signals.update(dt, t / 1000, px, pz, this.signalSource);   // the clock is in ms; the cycle wants seconds

    // the parade draws a crowd: whoever is on the sidewalk stops and turns to watch it pass
    const paradeEngine = this.paradeOn ? this.cars.find((c) => c.parade) ?? null : null;
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
      // now and then a walker stops: outside a shop downtown, facing the window, or
      // beside someone already standing there, facing them; about once a minute each
      if (p.pause <= 0 && Math.random() < dt * 0.018 && this.index.downtownAt(p.root.position.x, p.root.position.z)) {
        p.pause = 6 + Math.random() * 10;
        let mate: Walker | null = null;
        for (const o of this.peds) {
          if (o === p || o.pause <= 0) continue;
          if ((o.root.position.x - p.root.position.x) ** 2 + (o.root.position.z - p.root.position.z) ** 2 < 30 * 30) { mate = o; break; }
        }
        if (mate) {
          p.pauseFace = Math.atan2(mate.root.position.x - p.root.position.x, mate.root.position.z - p.root.position.z);
          mate.pauseFace = p.pauseFace + Math.PI;
          mate.pause = Math.max(mate.pause, p.pause);
        } else {
          const here = alongPolyline(p.pts, Math.max(0.5, Math.min(p.total - 0.5, p.t)));
          p.pauseFace = here ? Math.atan2(here.dx, here.dz) + (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : p.pauseFace;
        }
      }
      if (paradeEngine) {
        const ex = paradeEngine.root.position.x - p.root.position.x, ez = paradeEngine.root.position.z - p.root.position.z;
        if (ex * ex + ez * ez < 170 * 170) { p.pause = Math.max(p.pause, 0.6); p.pauseFace = Math.atan2(ex, ez); }
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

    // the pet dogs heel beside their walkers — after separation, so the leash
    // strings to where the person actually ended up standing
    for (const { d, w } of this.pups) {
      d.follow(dt, w, this.groundAt(d.root.position.x, d.root.position.z, d.root.position.y));
    }

    // deer families browse the mapped woods and greens. One mood per group:
    // calm → wary (heads up, frozen) as the player closes in → flight (white
    // flags, bounding) if the dog keeps coming. Recycled far away, never in view.
    for (const g of this.deerG) {
      const gdx = g.cx - px, gdz = g.cz - pz;
      if (!g.active || gdx * gdx + gdz * gdz > 2300 * 2300) {
        g.active = false;
        const spot = this.deerSpot(px, pz, fx, fz, rng);
        if (spot) {
          g.cx = spot.x; g.cz = spot.z; g.mood = 'calm'; g.active = true;
          for (const m of g.members) {
            let mx = spot.x, mz = spot.z;
            for (let tries = 0; tries < 5; tries++) {   // fan the family out over the clearing
              const a = rng() * Math.PI * 2, r = 14 + rng() * 42;
              const tx = spot.x + Math.cos(a) * r, tz = spot.z + Math.sin(a) * r;
              if (!this.index.isBlocked(tx, tz) && !this.index.isWaterAt(tx, tz)) { mx = tx; mz = tz; break; }
            }
            m.root.position.set(mx, this.index.heightAtPx(mx, mz), mz);
            m.face = rng() * Math.PI * 2;
          }
        }
        continue;
      }
      let nearSq = Infinity;
      for (const m of g.members) {
        const mdx = m.root.position.x - px, mdz = m.root.position.z - pz;
        nearSq = Math.min(nearSq, mdx * mdx + mdz * mdz);
      }
      if (g.mood !== 'flee' && nearSq < 150 * 150) g.mood = 'flee';
      else if (g.mood === 'calm' && nearSq < 300 * 300) g.mood = 'wary';
      else if (g.mood === 'wary' && nearSq > 380 * 380) g.mood = 'calm';
      else if (g.mood === 'flee' && nearSq > 700 * 700) g.mood = 'wary';   // pulled up, looking back
      for (const m of g.members) {
        m.step(dt, g.mood, g.cx, g.cz, px, pz, this.index.heightAtPx(m.root.position.x, m.root.position.z));
      }
      if (g.mood === 'flee') {   // the anchor runs with them, so recycling measures from where they ended up
        g.cx = g.members[0].root.position.x;
        g.cz = g.members[0].root.position.z;
      }
    }

    for (const c of this.cars) {
      const dx = c.root.position.x - px, dz = c.root.position.z - pz;
      // the service fleet keeps hours: the bus runs the school bell, the engine runs
      // when a call comes, the plow runs after snow, the cruiser is always out
      if (c.role !== 'car') {
        if (c.parade) {
          // on parade: Life.updateParade drives the schedule; only the crawl and the brakes run here
          c.lights = true;
          c.dress(t / 1000, dt);
        } else {
        const onDuty = c.role === 'bus' ? (this.forceBus || (tod > 0.29 && tod < 0.345) || (tod > 0.595 && tod < 0.645))
          : c.role === 'fire' ? this.fireRun > 0
          : c.role === 'ems' ? this.emsRun > 0
          : c.role === 'plow' ? (this.forcePlow || this.plowT > 0)
          : c.role === 'mail' ? (this.forceMail || (tod > 0.38 && tod < 0.7))
          : true;
        if (c.role === 'fire' && this.fireRun <= 0 && this.fireT <= 0) {
          // a call: the run lasts a minute and a half, then it goes home
          this.fireRun = 90;
          this.fireT = 400 + rng() * 300;
        }
        if (c.role === 'ems' && this.emsRun <= 0 && this.emsT <= 0) {
          this.emsRun = 80;
          this.emsT = 500 + rng() * 400;
        }
        if (!onDuty) {
          // off duty: leave the road as soon as nobody is looking, never in view
          if (!c.dormant && (!c.pts.length || this.okToSpawn(c.root.position.x, c.root.position.z, px, pz, fx, fz, 900, 2500))) {
            c.dormant = true; c.pts = []; c.lights = false; c.stopT = 0;
            c.root.position.set(0, 0, 1e7);
          }
          if (c.dormant) continue;
        }
        c.lights = c.role === 'fire' || c.role === 'ems' || c.role === 'plow' || c.stopT > 0;
        c.dress(t / 1000, dt);
        }
      }
      if (!c.parade && (dx * dx + dz * dz > 2700 * 2700 || !c.pts.length)) {
        const home = c.role === 'fire' ? this.fireHome : c.role === 'ems' ? this.emsHome : null;
        const near = home && (home.x - px) ** 2 + (home.z - pz) ** 2 < 2400 * 2400 ? { x: home.x, z: home.z, r: 420 } : undefined;
        const road = this.roadSpot(px, pz, fx, fz, rng, c.role === 'bus' || c.role === 'plow' ? TOWN_ROADS : c.role === 'mail' ? MAIL_ROADS : ROAD_CLASSES, near)
          ?? (near ? this.roadSpot(px, pz, fx, fz, rng) : null);
        if (road) {
          c.dormant = false;
          c.pts = road.pts;
          c.roadW = road.w;
          c.total = road.total;
          c.t = road.t;
          c.dir = road.dir;
          // highways drive like highways: cruise scales with the road class
          c.cruise = road.c === 'motorway' ? 250 + rng() * 50
            : road.c === 'motorway_link' ? 170 + rng() * 30
            : road.c === 'trunk' ? 190 + rng() * 40
            : road.c === 'primary' ? 140 + rng() * 40
            : 115 + rng() * 60;
          if (c.role === 'bus') { c.cruise = 95; c.runT = 20 + rng() * 20; }
          else if (c.role === 'fire') c.cruise = 205;
          else if (c.role === 'ems') c.cruise = 195;
          else if (c.role === 'mail') { c.cruise = 60; c.runT = 8 + rng() * 8; }
          else if (c.role === 'police') { c.cruise = 85; c.runT = 90 + rng() * 70; }
          else if (c.role === 'plow') c.cruise = 70;
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
        for (const xg of this.crossings) {
          if (xg.down > 0.15 && (sx - xg.x) ** 2 + (sz - xg.z) ** 2 < 46 * 46) { want = 0; break probe; }
        }
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
      // a red light: stop at the line, but only when no car is close behind, so the
      // stop never grows into a queue (a queue on State Street was the one thing the
      // town was asked not to have)
      if (want > 0 && !c.ignoreRed) {
        const here = alongPolyline(c.pts, c.t);
        if (here) {
          const vx = here.dx * c.dir, vz = here.dz * c.dir;
          const red = this.signals.redAhead(c.root.position.x, c.root.position.z, vx, vz, t / 1000);
          if (red >= 0 && red < 34) {
            let tail = false;
            for (const o of this.cars) {
              if (o === c || !o.pts.length) continue;
              const bx = o.root.position.x - c.root.position.x, bz = o.root.position.z - c.root.position.z;
              const behind = -(bx * vx + bz * vz);
              if (behind > 0 && behind < 60 && Math.abs(bx * vz - bz * vx) < 20) { tail = true; break; }
            }
            if (!tail) want = 0;
          }
        }
      }
      // the bus's stops and the cruiser's pull-overs: a timed halt, then on again
      if (c.role === 'bus' || c.role === 'police' || c.role === 'mail') {
        // the mail truck and the cruiser pull to the kerb for their stops; the bus stays in the lane
        if (c.role !== 'bus') c.kerb += ((c.stopT > 0 ? 0.7 : 0) - c.kerb) * Math.min(1, dt * 1.2);
        if (c.stopT > 0) { c.stopT -= dt; want = 0; }
        else {
          c.runT -= dt;
          if (c.runT <= 0 && c.t > 40 && c.t < c.total - 40) {
            c.stopT = c.role === 'bus' ? 7 : c.role === 'mail' ? 3 : 18;
            c.runT = c.role === 'bus' ? 22 + rng() * 22 : c.role === 'mail' ? 10 + rng() * 8 : 100 + rng() * 80;
          }
        }
      }
      // a school bus with its arm out stops the street both ways
      if (c.role !== 'fire' && c.role !== 'ems' && c.stopT <= 0) {
        for (const o of this.cars) {
          if (o === c || o.role !== 'bus' || o.stopT <= 0 || o.pts !== c.pts) continue;
          const ahead = (o.t - c.t) * c.dir;
          if (ahead > 0 && ahead < 140) { want = 0; break; }
        }
      }
      c.speed += (want - c.speed) * Math.min(1, dt * (want > c.speed ? 1.5 : 10));
      if (want < 1 && c.speed < 3) c.speed = 0;
      const ended = c.step(dt, this.groundAt(c.root.position.x, c.root.position.z, c.root.position.y));
      setCarLightsNight(night);
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
      b.dress(night);
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

    // winter traditions: skaters loop the Frog Pond, kids sled March's Hill (kept
    // animating at their fixed spots — only 9 actors, so no spawn/despawn churn)
    if (this.skaters.length && FROG_POND) {
      const gy = this.index.heightAtPx(FROG_POND.x, FROG_POND.z);
      for (const s of this.skaters) s.glide(dt, gy);
    }
    for (const s of this.sledders) s.update(dt);
    // fall: bats wheel over the rooftops at dusk, recycling their circle near the player
    for (const bt of this.bats) {
      const dx = bt.cx - px, dz = bt.cz - pz;
      if (!bt.active || dx * dx + dz * dz > 1700 * 1700) {
        const a = rng() * Math.PI * 2, d = 280 + rng() * 900;
        bt.cx = px + Math.cos(a) * d; bt.cz = pz + Math.sin(a) * d;
        bt.ang = rng() * Math.PI * 2; bt.active = true;
      }
      bt.glide(dt, t, night);
    }
    // fall: ghosts drift the sidewalks at dusk — same path network as the pedestrians
    for (const gh of this.ghosts) {
      const dx = gh.root.position.x - px, dz = gh.root.position.z - pz;
      if (gh.root.position.z > 1e6 || dx * dx + dz * dz > 1700 * 1700 || !gh.pts.length) {
        const spot = this.pathSpot(px, pz, 1000, rng);
        if (spot) {
          const at = alongPolyline(spot.pts, spot.t);
          if (at && this.okToSpawn(at.x, at.z, px, pz, fx, fz, 500, 1700)) {
            gh.pts = spot.pts; gh.total = spot.total; gh.t = spot.t; gh.dir = rng() < 0.5 ? 1 : -1;
            gh.root.position.set(at.x, this.groundAt(at.x, at.z), at.z);
          }
        }
        continue;
      }
      const ended = gh.advance(dt, this.groundAt(gh.root.position.x, gh.root.position.z), night);
      if (ended) {
        const hop = this.hopFrom(gh.root.position.x, gh.root.position.z, gh.pts, rng);
        if (hop) { gh.pts = hop.pts; gh.total = hop.total; gh.t = hop.t; gh.dir = hop.dir; }
        else { gh.dir = -gh.dir; gh.t = Math.max(1, Math.min(gh.total - 1, gh.t)); }
      }
    }
    // fall: black cats slink the sidewalks (same path network as the pedestrians)
    for (const ct of this.cats) {
      const dx = ct.root.position.x - px, dz = ct.root.position.z - pz;
      if (ct.root.position.z > 1e6 || dx * dx + dz * dz > 1700 * 1700 || !ct.pts.length) {
        const spot = this.pathSpot(px, pz, 1000, rng);
        if (spot) {
          const at = alongPolyline(spot.pts, spot.t);
          if (at && this.okToSpawn(at.x, at.z, px, pz, fx, fz, 450, 1700)) {
            ct.pts = spot.pts; ct.total = spot.total; ct.t = spot.t; ct.dir = rng() < 0.5 ? 1 : -1;
            ct.root.position.set(at.x, this.groundAt(at.x, at.z), at.z);
          }
        }
        continue;
      }
      const ended = ct.advance(dt, this.groundAt(ct.root.position.x, ct.root.position.z, ct.root.position.y));
      if (ended) {
        const hop = this.hopFrom(ct.root.position.x, ct.root.position.z, ct.pts, rng);
        if (hop) { ct.pts = hop.pts; ct.total = hop.total; ct.t = hop.t; ct.dir = hop.dir; }
        else { ct.dir = -ct.dir; ct.t = Math.max(1, Math.min(ct.total - 1, ct.t)); }
      }
    }
    // fall: the witch circles the old burying ground (after dark); the mist drifts there
    if (this.witch) this.witch.glide(dt, t, night);
    if (this.mist) this.mist.update(dt, t, night);
  }

  // deer country: inside a mapped wood/reserve/green, on open ground, and shy
  // of the pavement — no clearing within ~15 m of a road
  private deerLandAt(x: number, z: number): boolean {
    if (this.index.isWaterAt(x, z) || this.index.isBlocked(x, z)) return false;
    const bucket = this.index.buckets.get(Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK));
    if (!bucket) return false;
    let on = false;
    for (const pi of bucket.polys) {
      const poly = this.index.world.polys[pi];
      if (DEER_LAND.has(poly.k) && pointInPoly(x, z, poly)) { on = true; break; }
    }
    if (!on) return false;
    for (const ri of bucket.roads) {
      if (distToPolylineSq(x, z, this.index.world.roads[ri].p) < 120 * 120) return false;
    }
    return true;
  }

  private deerSpot(px: number, pz: number, fx: number, fz: number, rng: () => number): { x: number; z: number } | null {
    for (let tries = 0; tries < 12; tries++) {
      const a = rng() * Math.PI * 2, d = 560 + rng() * 950;
      const x = px + Math.cos(a) * d, z = pz + Math.sin(a) * d;
      if (!this.okToSpawn(x, z, px, pz, fx, fz, 520, 1800)) continue;
      if (!this.deerLandAt(x, z)) continue;
      return { x, z };
    }
    return null;
  }

  // spawns snap to the top surface (a ped placed on a bridge belongs ON it);
  // per-frame movement rides decks only where they meet the grade, so nobody
  // walking under an overpass pops up through its deck
  private groundAt(x: number, z: number, prevY?: number): number {
    if (prevY === undefined) return Math.max(this.index.heightAtPx(x, z), this.index.deckHeightAt(x, z));
    return this.index.surfaceYAt(x, z, prevY);
  }
}
