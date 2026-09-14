// 🤫 THE SECRETS — the Mario Kart kind. Not cards you find by walking over them:
// PLACES and TRICKS, found by doing something with your hands, that you go and
// show your friend. Devin: "i always loved in mario kart or some other game how
// there was like easter eggs, like a secret tunnel or something.... how could we
// add those things you always remember?" → "i love it, go for all of them".
//
// The rules every one of these keeps:
//   - found by DOING something physical (a dig, a walk-in, a climb, three barks)
//   - zero hint: not on the sniff glow, not in the DISCOVER count. A hidden tally
//     ("2 of ??") shows only when one is found.
//   - a payoff you can show someone: you come OUT somewhere, or the town reacts.
//   - Newburyport only — every coordinate here is a real place in this town.
//
// The five:
//   🕳 THE TUNNELS   dig on the grate in a back lot off State Street, run the brick
//                    corridor by lantern light, come up through a cellar bulkhead
//                    off Federal Street (the real smugglers' tunnels: Market, State,
//                    Federal — "Chapter 1" is the story one; this one is yours)
//   🚇 THE PIPE      a culvert under the Clipper City Rail Trail's south stretch:
//                    walk into the mouth, and halfway along there is a side
//                    room somebody made theirs — a candle, chalk, a golden bone
//   🏙 THE ROOFS     a fire-escape ladder up the back of the parking garage, a hop
//                    across the alley onto Horton's Yard, and a weathervane you
//                    can spin
//   🌊 THE TIDE POOL the North Jetty at Plum Island Point, and a pool in the rocks
//                    at its tip that is only there when the tide is out — with a
//                    lobster in it who waves
//   💥 THE CANNON    the Custom House cannon's own card says it "is not going to
//                    start now". Bark at it three times. It starts now.
import * as THREE from 'three';
import { WorldIndex } from '../world/index';
import type { Hud } from './hud';
import type { GameAudio } from './audio';
import { brickTex } from '../three/textures';
import { TIDE } from '../three/water';
import { TOWN } from '@town';

export const SECRET_TOTAL = 5;
const KEY = 'nbpt-secrets';

// the sites, world px (Newburyport)
// the tunnel's three ends (seeds — the grate goes on the nearest diggable, dry,
// unblocked spot, found at runtime): a back lot off State Street, a lot off Federal
// Street, and Market Square itself. Three real tunnels, three ways up.
const STATE_LOT = { x: -62, z: 551 };
const FEDERAL_LOT = { x: 2074, z: 3158 };
const MARKET_LOT = { x: 70, z: -60 };
// the network in scene space: ends 0-2 are the grates above (State, Federal, Market);
// end 3 is the collapse whose other side is the story tunnel
const NET_ENDS: { x: number; z: number; squeeze?: boolean }[] = [{ x: 0, z: 0 }, { x: -60, z: -700 }, { x: 300, z: -40 }, { x: -220, z: -520, squeeze: true }];
const NET_ENTRIES = [{ x: 0, z: -22 }, { x: -60, z: -678 }, { x: 300, z: -62 }, { x: -160, z: -520 }];   // the squeeze lands him clear of the collapse, so the button is not already up
// the pipe's mouths: a box culvert running under the rail trail's south stretch, green
// both sides (the first pick, by the harbour, put the mouth in the water)
const CULVERT_A = { x: 120, z: 10771 };
const CULVERT_B = { x: 310, z: 10728 };
// 🪜 the fire escapes: each goes on the wall of the building containing `inside`, on
// the face nearest `toward`. Two of them:
//   - the State Street block: up the alley wall of a 4-storey building (Larosa's is
//     its neighbour, same height, touching), then over the seam and DOWN onto the
//     long 2-storey block that runs 630 px along State Street, to the vane at its
//     far end — THE roof run. Every step of it touches (gap 0): a dog does not
//     leap a 55 px alley, whatever the bounding boxes said.
//   - the parking garage: a lookout over the lot, and nothing within a leap of it
//     (the first cut hoped for Horton's Yard; the alley is 200 px, not 30) — so
//     from up there the only way is the ladder, or off the edge
const LADDERS = [
  { inside: { x: -230, z: 240 }, toward: { x: -300, z: 210 } },
  { inside: { x: -2670, z: -531 }, toward: { x: -2511, z: -275 } },
];
const LADDER_NEAR = LADDERS[0].toward;
const VANE = { x: -268, z: 812 };            // the far end of the long State Street roof (falls back to its centroid)
const VANE_ALT = { x: -229, z: 544 };
const JETTY_S = { x: 34250, z: -5000 };      // the North Jetty runs NE off the Point's beach…
const JETTY_U = { x: 0.62, z: -0.78 };
const JETTY_LEN = 620;
const POOL = { x: JETTY_S.x + JETTY_U.x * (JETTY_LEN - 22), z: JETTY_S.z + JETTY_U.z * (JETTY_LEN - 22) };   // …to a pool at its tip
const CANNON = { x: 1040, z: -1120 };        // eggs2.ts cannonAt
const TIDE_OUT = -0.55;                      // TIDE.value runs ±1.2 px; below this the flats and the pool are bare

export type SecretHost = {
  enterScene: (scene: SecretTunnel, entry: { x: number; z: number }) => void;
  exitScene: (x: number, z: number) => void;
  enterRoof: (x: number, z: number) => void;
  leaveRoof: (x: number, z: number) => void;
  fireCannon: () => void;
  swapToStory: () => void;
  burst: (x: number, y: number, z: number, hex: string, n: number, size: number, life: number, spray: number, up: number) => void;
  say: (text: string) => void;
};

// point-in-ring over a flat [x, z, x, z, …] ring (a building's `p`)
function inRing(x: number, z: number, r: number[]): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
    const xi = r[i], zi = r[i + 1], xj = r[j], zj = r[j + 1];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
function lam(hex: string) { return new THREE.MeshLambertMaterial({ color: hex }); }
function bx(w: number, h: number, d: number, hex: string) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(hex)); }

// ---------- a corridor you can walk: brick (the tunnels) or concrete (the pipe) ----------
// Built from a polyline in its own scene space; Game swaps scenes the way it does
// for the story tunnel, and asks free()/update() the same questions.
export class SecretTunnel {
  scene = new THREE.Scene();
  done = false;
  readonly ends: { x: number; z: number; squeeze?: boolean }[];
  private width: number;
  private paths: { x: number; z: number }[][];
  private lantern: THREE.PointLight;
  private t = 0;
  private armed = false;
  private room: { x: number; z: number; r: number } | null;
  private roomSeen = false;
  private nearEndIdx = -1;
  onExit: (end: number) => void = () => {};
  onRoom: () => void = () => {};
  /** a way out is close (or not): Secrets puts 🪜 CLIMB OUT on the button */
  onNearEnd: (end: number) => void = () => {};

  constructor(kind: 'brick' | 'pipe', paths: { x: number; z: number }[][], width: number, ends: { x: number; z: number; squeeze?: boolean }[], room: { x: number; z: number; r: number } | null = null) {
    this.paths = paths; this.width = width; this.room = room; this.ends = ends;
    const bg = kind === 'brick' ? '#04050a' : '#06080a';
    this.scene.background = new THREE.Color(bg);
    this.scene.fog = new THREE.Fog(bg, 140, 560);
    this.scene.add(new THREE.AmbientLight('#5a6478', kind === 'brick' ? 0.2 : 0.3));
    this.lantern = new THREE.PointLight('#ffd9a0', 240, 460, 1);
    this.scene.add(this.lantern);
    const wallMat = kind === 'brick'
      ? new THREE.MeshLambertMaterial({ map: brickTex(), color: '#8a7a6e', side: THREE.DoubleSide })
      : new THREE.MeshLambertMaterial({ color: '#6f7477', side: THREE.DoubleSide });
    const floorMat = new THREE.MeshLambertMaterial({ color: kind === 'brick' ? '#3b342e' : '#4a4f52' });
    const H = kind === 'brick' ? 44 : 30;
    // walls: a slab each side of every segment, overlapping at the corners
    for (const path of paths) {
      for (let i = 0; i + 1 < path.length; i++) {
        const a = path[i], b = path[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
        const ang = Math.atan2(dx, dz);
        const nx = -dz / len, nz = dx / len;
        for (const sgn of [-1, 1]) {
          const m = new THREE.Mesh(new THREE.BoxGeometry(8, H, len + width), wallMat);
          m.position.set((a.x + b.x) / 2 + nx * sgn * (width / 2 + 4), H / 2, (a.z + b.z) / 2 + nz * sgn * (width / 2 + 4));
          m.rotation.y = ang;
          m.castShadow = true; m.receiveShadow = true;
          this.scene.add(m);
        }
        const f = new THREE.Mesh(new THREE.PlaneGeometry(width + 8, len + width), floorMat);
        f.rotation.x = -Math.PI / 2; f.rotation.z = -ang;
        f.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
        f.receiveShadow = true;
        this.scene.add(f);
      }
      // ⚠️ NO CEILING, on either kind. The chase camera rides above the walls, and a
      // slab up there is a black screen (the pipe shipped one for a frame: 9/13).
    }
    // 🪜 THE WAYS OUT. Devin: "theres no way to get out of the tunnel" — there was, a
    // 14 px spot in the dark. Now each end is CAPPED (the corridor visibly stops), a
    // run of iron rungs goes up the cap, daylight comes down a shaft onto a pale
    // patch of floor, and the button says CLIMB OUT when you are close.
    for (const e of ends) {
      let ux = 0, uz = -1;
      for (const path of paths) {
        const first = path[0], last = path[path.length - 1];
        if (Math.hypot(first.x - e.x, first.z - e.z) < 1) { const n2 = path[1]; ux = first.x - n2.x; uz = first.z - n2.z; }
        else if (Math.hypot(last.x - e.x, last.z - e.z) < 1) { const n2 = path[path.length - 2]; ux = last.x - n2.x; uz = last.z - n2.z; }
        else continue;
        const l = Math.hypot(ux, uz) || 1; ux /= l; uz /= l;
      }
      const ang = Math.atan2(ux, uz);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(width + 16, H + 6, 8), wallMat);
      cap.position.set(e.x + ux * (width / 2 + 2), H / 2, e.z + uz * (width / 2 + 2));
      cap.rotation.y = ang;
      this.scene.add(cap);
      if (e.squeeze) {
        // 🪨 the collapse: a pile of fallen brick against the cap, a dog-sized dark gap at
        // its foot, cold light through it — the far side is the story tunnel's rubble
        for (let i = 0; i < 14; i++) {
          const h = (i * 7919) % 100;
          const r = bx(4 + (h % 4), 3 + (h % 3), 4 + ((h >> 2) % 3), h % 2 ? '#5e4a3e' : '#4a3b31');
          r.position.set(e.x + ux * (width / 2 - 6 - (h % 5)) - uz * ((h % 9) - 4) * 2.2, 1.5 + (h % 4) * 2.2, e.z + uz * (width / 2 - 6 - (h % 5)) + ux * ((h % 9) - 4) * 2.2);
          r.rotation.y = h * 0.3;
          this.scene.add(r);
        }
        const gap = new THREE.Mesh(new THREE.CircleGeometry(4.2, 12), new THREE.MeshBasicMaterial({ color: '#05070a' }));
        gap.position.set(e.x + ux * (width / 2 - 2.4), 4, e.z + uz * (width / 2 - 2.4)); gap.rotation.y = ang + Math.PI; this.scene.add(gap);
        const cold = new THREE.PointLight('#8fb0d8', 60, 120, 1.4); cold.position.set(e.x, 8, e.z); this.scene.add(cold);
        continue;
      }
      for (let y = 5; y < H + 4; y += 5) {
        const rung = bx(6, 0.8, 1.2, '#4a4d52');
        rung.position.set(e.x + ux * (width / 2 - 2.6), y, e.z + uz * (width / 2 - 2.6));
        rung.rotation.y = ang;
        this.scene.add(rung);
      }
      for (const sgn of [-1, 1]) {
        const rail = bx(0.8, H + 2, 0.8, '#3a3d42');
        rail.position.set(e.x + ux * (width / 2 - 2.6) - uz * sgn * 3.4, (H + 2) / 2, e.z + uz * (width / 2 - 2.6) + ux * sgn * 3.4);
        this.scene.add(rail);
      }
      const shaft = new THREE.PointLight('#bcd0e8', 220, 260, 1);
      shaft.position.set(e.x, H + 20, e.z);
      this.scene.add(shaft);
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(9, 15, H + 30, 10, 1, true),
        new THREE.MeshBasicMaterial({ color: '#aebfd6', transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      beam.position.set(e.x, (H + 30) / 2, e.z);
      this.scene.add(beam);
      const patch = new THREE.Mesh(new THREE.CircleGeometry(12, 16), new THREE.MeshBasicMaterial({ color: '#8a96a8', transparent: true, opacity: 0.35 }));
      patch.rotation.x = -Math.PI / 2; patch.position.set(e.x, 0.3, e.z);
      this.scene.add(patch);
    }
    if (room) {
      // 🕯 somebody's room: a square off the pipe with a candle on a crate, chalk on
      // the wall, and the thing they hid — a golden bone
      const rf = new THREE.Mesh(new THREE.PlaneGeometry(room.r * 2 + 8, room.r * 2 + 8), floorMat);
      rf.rotation.x = -Math.PI / 2; rf.position.set(room.x, 0.1, room.z); this.scene.add(rf);
      for (const [sx, sz, w, d] of [[-1, 0, 8, room.r * 2 + 8], [1, 0, 8, room.r * 2 + 8], [0, -1, room.r * 2 + 8, 8]] as const) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
        m.position.set(room.x + sx * (room.r + 4), H / 2, room.z + sz * (room.r + 4));
        this.scene.add(m);
      }
      const crate = bx(8, 6, 8, '#6b4e2e'); crate.position.set(room.x - room.r + 10, 3, room.z - room.r + 10); this.scene.add(crate);
      const candle = bx(1.2, 3.4, 1.2, '#f2e8cf'); candle.position.set(crate.position.x, 7.7, crate.position.z); this.scene.add(candle);
      const flame = new THREE.PointLight('#ffb347', 90, 120, 1.2); flame.position.set(crate.position.x, 10.5, crate.position.z); this.scene.add(flame);
      const chalk = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), new THREE.MeshBasicMaterial({ map: chalkTex(), transparent: true }));
      chalk.position.set(room.x, 16, room.z - room.r - 0.5 + 0.2); this.scene.add(chalk);
      const bone = new THREE.Group();
      const shaft = bx(7, 1.6, 1.6, '#e8c44f'); bone.add(shaft);
      for (const sx of [-3.5, 3.5]) for (const sz of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 6), lam('#e8c44f')); k.position.set(sx, 0, sz * 0.9); bone.add(k); }
      bone.position.set(room.x + 6, 3, room.z + 4); bone.rotation.y = 0.6;
      bone.name = 'bone';
      this.scene.add(bone);
      const glow = new THREE.PointLight('#ffd24a', 40, 60, 1.5); glow.position.set(room.x + 6, 8, room.z + 4); this.scene.add(glow);
    }
  }

  free(x: number, z: number): boolean {
    if (this.room && Math.abs(x - this.room.x) < this.room.r && Math.abs(z - this.room.z) < this.room.r) return true;
    const hw = this.width / 2 - 3;
    for (const path of this.paths) {
      for (let i = 0; i + 1 < path.length; i++) {
        const a = path[i], b = path[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
        const px = a.x + dx * t, pz = a.z + dz * t;
        if ((x - px) ** 2 + (z - pz) ** 2 < hw * hw) return true;
      }
    }
    return false;
  }

  enter() { this.armed = false; this.nearEndIdx = -1; }
  tryInteract(_px: number, _pz: number) { /* nothing to pick up: the corridor IS the thing */ }
  /** the CLIMB OUT button, or E */
  climbOut(end: number) { if (end >= 0) { this.armed = false; this.nearEndIdx = -1; this.onExit(end); } }

  update(dt: number, px: number, pz: number) {
    this.t += dt;
    this.lantern.position.set(px, 40, pz);
    this.lantern.intensity = 230 + Math.sin(this.t * 7) * 14;
    const b = this.scene.getObjectByName('bone');
    if (b) { b.rotation.y += dt * 1.2; b.position.y = 3 + Math.sin(this.t * 3) * 0.6; }
    // the ends: arm once you are well inside; then close to one = the button, on
    // top of one = out
    let nearEnd = -1, atEnd = -1;
    this.ends.forEach((e, i) => { const d = Math.hypot(px - e.x, pz - e.z); if (d < 44) nearEnd = i; if (d < 14) atEnd = i; });
    if (nearEnd !== this.nearEndIdx) { this.nearEndIdx = nearEnd; this.onNearEnd(nearEnd); }
    if (!this.armed) { if (atEnd < 0) this.armed = true; return; }
    if (atEnd >= 0) { this.climbOut(atEnd); return; }
    if (this.room && !this.roomSeen && Math.abs(px - this.room.x) < this.room.r - 4 && Math.abs(pz - this.room.z) < this.room.r - 4) {
      this.roomSeen = true;
      this.onRoom();
    }
  }
}

function chalkTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 176; c.height = 72;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(240,236,226,0.9)'; g.lineWidth = 4; g.lineCap = 'round';
  g.font = 'bold 30px "Comic Sans MS", "Chalkboard SE", cursive';
  g.fillStyle = 'rgba(240,236,226,0.9)';
  g.fillText('CLIPPER', 8, 34); g.fillText('WAS HERE', 8, 66);
  return new THREE.CanvasTexture(c);
}

// ---------- the secrets themselves ----------
export class Secrets {
  found = new Set<string>();
  roofMode = false;
  roofY = 0;
  fallReq = false;     // set when he walked off an edge with nothing to land on: Game drops him
  dropReq = false;     // set when he landed on a lower roof: a thump
  private ladders: { foot: { x: number; z: number }; top: { x: number; z: number }; g: THREE.Group }[] = [];
  private scene: THREE.Scene;
  private index: WorldIndex;
  private hud: Hud;
  private audio: GameAudio;
  private host: SecretHost;
  private tunnels: SecretTunnel | null = null;
  private pipe: SecretTunnel | null = null;
  private grates: THREE.Group[] = [];
  private grateSpots: { x: number; z: number }[] = [];
  private mouths: THREE.Group[] = [];
  private vane: THREE.Group | null = null;
  private vaneAt = { x: VANE.x, z: VANE.z };
  private vaneSpin = 0;
  private pool: THREE.Group | null = null;
  private lobster: THREE.Group | null = null;
  private claw: THREE.Mesh | null = null;
  private barks: number[] = [];
  private cannonT = 0;
  private cannon: THREE.Group | null = null;
  private cannonBase = new THREE.Vector3();
  private roofLost = 0;
  private t = 0;
  private ladderNear = false;

  constructor(scene: THREE.Scene, index: WorldIndex, hud: Hud, audio: GameAudio, host: SecretHost) {
    this.scene = scene; this.index = index; this.hud = hud; this.audio = audio; this.host = host;
    try { this.found = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { this.found = new Set(); }
    if (TOWN.id !== 'nbpt') return;
    this.buildProps();
  }

  get enabled(): boolean { return TOWN.id === 'nbpt'; }

  /** the cannon group, once eggs2 has built it — Secrets animates the recoil */
  setCannon(g: THREE.Group | null) { this.cannon = g; if (g) this.cannonBase.copy(g.position); }

  private buildProps() {
    const gy = (x: number, z: number) => this.index.heightAtPx(x, z);
    // 🕳 two iron grates, flush in the ground. Unremarkable on purpose: a storm grate
    // in a yard is a thing nobody looks at twice, which is the whole point.
    for (const seed of [STATE_LOT, FEDERAL_LOT, MARKET_LOT]) {
      const p = this.findSpot(seed);
      this.grateSpots.push(p);
      const g = new THREE.Group();
      const frame = bx(14, 1.2, 10, '#3a3a3c'); g.add(frame);
      for (let i = -2; i <= 2; i++) { const bar = bx(0.9, 1.6, 8.6, '#2b2b2e'); bar.position.set(i * 2.6, 0.3, 0); g.add(bar); }
      g.position.set(p.x, gy(p.x, p.z) + 0.6, p.z);
      this.scene.add(g); this.grates.push(g);
    }
    // 🚇 the culvert mouths: a concrete headwall with a dark round hole in it
    for (const [p, q] of [[CULVERT_A, CULVERT_B], [CULVERT_B, CULVERT_A]] as const) {
      const g = new THREE.Group();
      const ang = Math.atan2(q.x - p.x, q.z - p.z);
      const wall = bx(26, 20, 4, '#8b8f8c'); wall.position.y = 8; g.add(wall);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(7, 16), new THREE.MeshBasicMaterial({ color: '#07090c' }));
      hole.position.set(0, 8, 2.2); g.add(hole);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(7.4, 1, 6, 16), lam('#6f7477')); lip.position.set(0, 8, 2.4); g.add(lip);
      g.position.set(p.x, gy(p.x, p.z) - 2, p.z);
      g.rotation.y = ang + Math.PI;   // faces away from the other mouth, i.e. out of the bank
      this.scene.add(g); this.mouths.push(g);
    }
    // 🪜 the fire escapes: two rails and rungs, FLUSH ON A WALL FACE, from the ground
    // to a hoop over the parapet. ⚠️ Placed from the building's own polygon (the wall
    // edge nearest `toward`), not a hand-typed point: the first cut stood one on a
    // polygon corner in mid-air (Devin: "the ladder behind parking garage isnt connected").
    for (const L of LADDERS) {
      const gb = this.index.world.buildings.find((b) => inRing(L.inside.x, L.inside.z, b.p));
      if (!gb) continue;
      let cx = 0, cz = 0; const n = gb.p.length / 2;
      for (let i = 0; i < gb.p.length; i += 2) { cx += gb.p[i] / n; cz += gb.p[i + 1] / n; }
      let bd = 1e12, mx = L.inside.x, mz = L.inside.z, nx = 0, nz = 1;
      for (let i = 0; i < gb.p.length; i += 2) {
        const ax = gb.p[i], az = gb.p[i + 1], bx2 = gb.p[(i + 2) % gb.p.length], bz = gb.p[(i + 3) % gb.p.length];
        const ex = bx2 - ax, ez = bz - az, l2 = ex * ex + ez * ez;
        if (l2 < 30 * 30) continue;   // a jog, not a wall
        const t = Math.max(0.2, Math.min(0.8, ((L.toward.x - ax) * ex + (L.toward.z - az) * ez) / l2));
        const px = ax + ex * t, pz = az + ez * t, d = (px - L.toward.x) ** 2 + (pz - L.toward.z) ** 2;
        if (d < bd) {
          bd = d; mx = px; mz = pz;
          const l = Math.sqrt(l2); nx = -ez / l; nz = ex / l;
          if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }   // outward
        }
      }
      const foot = { x: mx + nx * 7, z: mz + nz * 7 }, top = { x: mx - nx * 10, z: mz - nz * 10 };
      const roof = this.index.buildingTopAt(top.x, top.z);
      const g0 = gy(mx, mz);
      const h = Number.isFinite(roof) ? Math.max(30, roof - g0 + 3) : 60;
      const g = new THREE.Group();
      for (const sx of [-2.2, 2.2]) { const rail = bx(0.9, h, 0.9, '#2f3236'); rail.position.set(sx, h / 2, 0); g.add(rail); }
      for (let y = 4; y < h - 2; y += 5) { const rung = bx(4.4, 0.7, 0.7, '#3d4045'); rung.position.set(0, y, 0); g.add(rung); }
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.4, 6, 12, Math.PI), lam('#2f3236'));
      hoop.position.set(0, h - 1, 0); hoop.rotation.y = Math.PI / 2; g.add(hoop);
      for (const y of [h * 0.3, h * 0.7]) { const br = bx(5.2, 0.6, 1.4, '#2f3236'); br.position.set(0, y, -0.9); g.add(br); }   // bolted on
      g.position.set(mx + nx * 1.4, g0, mz + nz * 1.4);
      g.rotation.y = Math.atan2(nx, nz);
      this.scene.add(g);
      this.ladders.push({ foot, top, g });
    }
    // 🐓 the weathervane on Horton's Yard: post, the four letters, and an arrow with a
    // rooster on it — and it turns when you touch it
    {
      const g = new THREE.Group();
      const post = bx(0.8, 16, 0.8, '#2c2c30'); post.position.y = 8; g.add(post);
      for (const [x, z] of [[6, 0], [-6, 0], [0, 6], [0, -6]] as const) { const t = bx(0.5, 0.5, 0.5, '#2c2c30'); t.position.set(x, 12, z); g.add(t); }
      const cross1 = bx(12, 0.4, 0.4, '#2c2c30'); cross1.position.y = 12; g.add(cross1);
      const cross2 = bx(0.4, 0.4, 12, '#2c2c30'); cross2.position.y = 12; g.add(cross2);
      const spin = new THREE.Group(); spin.position.y = 16; spin.name = 'spin';
      const arrow = bx(14, 0.5, 0.5, '#3a3a3e'); spin.add(arrow);
      const head = new THREE.Mesh(new THREE.ConeGeometry(1.4, 3, 4).rotateZ(-Math.PI / 2), lam('#3a3a3e')); head.position.x = 8; spin.add(head);
      const tail = bx(3, 3, 0.4, '#3a3a3e'); tail.position.x = -6.5; spin.add(tail);
      const body = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), lam('#b8442c')); body.scale.set(1.3, 1, 0.5); body.position.set(0, 2.4, 0); spin.add(body);
      const neck = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), lam('#b8442c')); neck.position.set(2.4, 4.2, 0); spin.add(neck);
      const comb = bx(1.2, 1.4, 0.3, '#d8262b'); comb.position.set(2.4, 5.4, 0); spin.add(comb);
      const plume = bx(2.2, 3.4, 0.3, '#3e6b4a'); plume.position.set(-2.6, 3.6, 0); plume.rotation.z = 0.5; spin.add(plume);
      g.add(spin);
      let top = this.index.buildingTopAt(VANE.x, VANE.z);
      if (!Number.isFinite(top)) { top = this.index.buildingTopAt(VANE_ALT.x, VANE_ALT.z); this.vaneAt = VANE_ALT; }
      g.position.set(this.vaneAt.x, Number.isFinite(top) ? top : gy(this.vaneAt.x, this.vaneAt.z) + 60, this.vaneAt.z);
      this.scene.add(g); this.vane = g;
    }
    // 🌊 the tide pool at the jetty's tip: a ring of rocks, water in the hollow, a
    // lobster on the bottom. The rocks stay; the pool and the lobster are only there
    // when the tide is out — otherwise it is all under the sea
    {
      const g = new THREE.Group();
      const deck = 5.5;
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const r = bx(4 + (i % 3), 3 + (i % 2) * 1.5, 3.5, i % 2 ? '#6e6a63' : '#7f7b73');
        r.position.set(Math.cos(a) * 11, deck + 1, Math.sin(a) * 11); r.rotation.y = a;
        g.add(r);
      }
      const pool = new THREE.Group();
      const water = new THREE.Mesh(new THREE.CircleGeometry(9, 20), new THREE.MeshBasicMaterial({ color: '#4d8f94', transparent: true, opacity: 0.75 }));
      water.rotation.x = -Math.PI / 2; water.position.y = deck + 0.5; pool.add(water);
      const lob = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(2.4, 8, 6), lam('#a8342a')); body.scale.set(1.5, 0.7, 0.9); lob.add(body);
      const tailM = bx(4, 1.2, 2.6, '#8f2c24'); tailM.position.set(-4.2, 0, 0); lob.add(tailM);
      for (const sz of [-1, 1]) { const leg = bx(0.4, 0.4, 3, '#8f2c24'); leg.position.set(-1 + sz, -0.4, sz * 2); lob.add(leg); }
      const clawL = bx(4, 1.4, 2.2, '#a8342a'); clawL.position.set(4, 0.6, -2.2); lob.add(clawL);
      const clawR = bx(4, 1.4, 2.2, '#a8342a'); clawR.position.set(4, 0.6, 2.2); lob.add(clawR);
      for (const sz of [-1, 1]) { const ant = bx(6, 0.25, 0.25, '#5c1e18'); ant.position.set(6, 1.2, sz * 0.8); ant.rotation.y = sz * 0.3; lob.add(ant); }
      lob.position.set(-1, deck + 1.2, 1); lob.rotation.y = -0.6;
      pool.add(lob);
      this.lobster = lob; this.claw = clawR;
      g.add(pool); this.pool = pool;
      g.position.set(POOL.x, 0, POOL.z);
      this.scene.add(g);
    }
  }

  private award(id: string, title: string) {
    if (this.found.has(id)) return;
    this.found.add(id);
    try { localStorage.setItem(KEY, JSON.stringify([...this.found])); } catch { /* private mode */ }
    this.audio.secret();
    setTimeout(() => this.hud.chapterCard('🤫 SECRET FOUND', title, `${this.found.size} of ?? · tell someone`), 300);
  }

  /** the nearest spot to a seed a dog can dig: dry, unblocked, not paved (a spiral out to 100 px) */
  private findSpot(seed: { x: number; z: number }): { x: number; z: number } {
    const ok = (x: number, z: number) => !this.index.isWaterAt(x, z) && !this.index.isBlocked(x, z) && !this.index.isBlocked(x + 8, z) && !this.index.isBlocked(x - 8, z)
      && !this.index.isBlocked(x, z + 8) && !this.index.isBlocked(x, z - 8) && !this.index.onPavedAt(x, z);
    if (ok(seed.x, seed.z)) return { ...seed };
    for (let r = 12; r <= 100; r += 12) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, x = seed.x + Math.cos(a) * r, z = seed.z + Math.sin(a) * r;
        if (ok(x, z)) return { x, z };
      }
    }
    return { ...seed };
  }

  /** the smugglers' network, built on first use: State Street down, a long run with a
   *  dogleg, up at Federal — a branch off the first corner up into MARKET SQUARE — and a
   *  spur off the far corner that ends in a COLLAPSE, the other side of which is the
   *  story tunnel's rubble (Chapter 1's dead end is a door for a dog). Four ends,
   *  three of them grates. Scene space; ~180 m of town compressed to a run you feel. */
  network(): SecretTunnel {
    if (this.tunnels) return this.tunnels;
    this.tunnels = new SecretTunnel('brick', [
      [{ x: 0, z: 0 }, { x: 0, z: -260 }, { x: 120, z: -260 }, { x: 120, z: -520 }, { x: -60, z: -520 }, { x: -60, z: -700 }],
      [{ x: 120, z: -260 }, { x: 300, z: -260 }, { x: 300, z: -40 }],
      [{ x: -60, z: -520 }, { x: -220, z: -520 }],
    ], 40, NET_ENDS);
    this.tunnels.onExit = (end) => {
      if (NET_ENDS[end].squeeze) { this.host.swapToStory(); this.hud.showTalk(null); this.award('tunnels', 'The Smugglers’ Tunnel'); return; }
      const out = this.grateSpots[end] ?? this.grateSpots[0];
      this.host.exitScene(out.x + 9, out.z + 7);   // beside the grate, not out in the street
      this.hud.showTalk(null);
      this.award('tunnels', 'The Smugglers’ Tunnel');
    };
    this.tunnels.onNearEnd = (end) => this.hud.showTalk(end >= 0 ? (NET_ENDS[end].squeeze ? '🐕 SQUEEZE THROUGH' : '🪜 CLIMB OUT') : null, end >= 0 ? () => this.tunnels?.climbOut(end) : undefined);
    return this.tunnels;
  }

  /** where Game drops him when he squeezes in from the story tunnel's rubble */
  networkEntryFromStory(): { sc: SecretTunnel; entry: { x: number; z: number } } { return { sc: this.network(), entry: NET_ENTRIES[3] }; }

  /** 🏙 a jump he should make (from roofFree): where to land, which way, and whether it is a fall */
  jumpReq: { x: number; z: number; y: number; dx: number; dz: number; fall: boolean } | null = null;

  // ---------- the hooks Game calls ----------

  /** a dig finished here: was it on a grate? (returns true when the secret took it) */
  dig(px: number, pz: number): boolean {
    if (!this.enabled) return false;
    const ends = this.grateSpots;
    for (let i = 0; i < ends.length; i++) {
      if (Math.hypot(px - ends[i].x, pz - ends[i].z) > 22) continue;
      this.network();
      this.audio.stoneScrape();
      this.host.enterScene(this.tunnels!, NET_ENTRIES[i]);
      return true;
    }
    return false;
  }

  /** a bark: three at the cannon inside six seconds, and it fires */
  bark(px: number, pz: number) {
    if (!this.enabled || this.cannonT > 0) return;
    if (Math.hypot(px - CANNON.x, pz - CANNON.z) > 95) { this.barks.length = 0; return; }
    const now = this.t;
    this.barks.push(now);
    while (this.barks.length && now - this.barks[0] > 6) this.barks.shift();
    if (this.barks.length < 3) return;
    this.barks.length = 0;
    this.cannonT = 1.2;
    setTimeout(() => {
      this.host.fireCannon();
      this.award('cannon', 'The Cannon Fires');
    }, 350);
  }

  /** the contextual verb, if he is standing at one: the ladder, or the climb down */
  action(px: number, pz: number): { label: string; cb: () => void } | null {
    if (!this.enabled) return null;
    for (const L of this.ladders) {
      if (!this.roofMode) {
        if (Math.hypot(px - L.foot.x, pz - L.foot.z) < 24) return { label: '🪜 CLIMB', cb: () => this.host.enterRoof(L.top.x, L.top.z) };
      } else if (Math.hypot(px - L.top.x, pz - L.top.z) < 26) {
        return { label: '🪜 CLIMB DOWN', cb: () => this.host.leaveRoof(L.foot.x, L.foot.z) };
      }
    }
    return null;
  }

  /** 🏙 FREE-RUNNING. Devin: "climbing only makes sense if he can naturally jump
   *  between buildings" — so the roofs are a parkour course, not a corridor:
   *  - any roof at this height, a step up (≤ 12 px), or ANY drop is walkable
   *  - a gap (an alley, a street) is walkable when there is a roof he can land on
   *    within 64 px ahead — Game gives him the leap
   *  - a taller building's wall is a wall
   *  - an edge with NOTHING beyond it is not a wall either: he goes off it, and
   *    Game drops him to the street (a thump, a shake, no harm — it is a cartoon) */
  roofFree(x: number, z: number, px: number, pz: number): boolean {
    const top = this.index.buildingTopAt(x, z);
    const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    if (Number.isFinite(top)) {
      if (top > this.roofY + 12) return false;           // a taller building's wall
      if (top >= this.roofY - 10) return true;           // this roof, or a step up
      // a lower roof: he does not walk down a storey, he JUMPS down onto it
      if (!this.jumpReq) this.jumpReq = { x: x + ux * 16, z: z + uz * 16, y: top, dx: ux, dz: uz, fall: false };
      return false;
    }
    // a gap: a roof he can land on within 80 px ahead → the jump; nothing → off the edge
    for (let k = 10; k <= 80; k += 7) {
      const lx = x + ux * k, lz = z + uz * k;
      const t2 = this.index.buildingTopAt(lx, lz);
      if (Number.isFinite(t2) && t2 <= this.roofY + 12) {
        if (!this.jumpReq) this.jumpReq = { x: lx + ux * 12, z: lz + uz * 12, y: t2, dx: ux, dz: uz, fall: false };
        return false;
      }
    }
    if (!this.jumpReq) {
      const fx = x + ux * 26, fz = z + uz * 26;
      this.jumpReq = { x: fx, z: fz, y: this.index.heightAtPx(fx, fz), dx: ux, dz: uz, fall: true };
    }
    // ⚠️ every branch above RETURNS FALSE for anything off this roof: the walk stops at
    // the edge and Game makes the jump (or not — it checks the stick is pushed that
    // way, because this predicate is also called on the wall-glance probe points).
    return false;
  }

  onRoof(px: number, pz: number) {
    this.roofMode = true;
    const top = this.index.buildingTopAt(px, pz);
    this.roofY = Number.isFinite(top) ? top : this.index.heightAtPx(px, pz) + 60;
    this.roofLost = 0;
  }
  offRoof() { this.roofMode = false; }

  update(dt: number, px: number, pz: number, inScene: boolean) {
    if (!this.enabled) return;
    this.t += dt;
    if (this.cannonT > 0) this.cannonT -= dt;
    // the recoil, and the smoke
    if (this.cannon) {
      const k = Math.max(0, Math.min(1, (0.85 - this.cannonT) / 0.85));
      const back = this.cannonT > 0 && this.cannonT < 0.85 ? Math.sin(k * Math.PI) * 5 : 0;
      this.cannon.position.copy(this.cannonBase);
      this.cannon.position.x -= Math.cos(this.cannon.rotation.y) * back;
      this.cannon.position.z += Math.sin(this.cannon.rotation.y) * back;
    }
    if (inScene) return;
    // ⚠️ the ground props are placed at boot, BEFORE the terrain heights have loaded,
    // so they were built 80 px underground (rig, 9/13). Re-seat them on the ground
    // every frame — six heightAtPx calls, nothing.
    for (const g of this.grates) g.position.y = this.index.heightAtPx(g.position.x, g.position.z) + 0.6;
    for (const g of this.mouths) g.position.y = this.index.heightAtPx(g.position.x, g.position.z) - 2;
    for (const L of this.ladders) L.g.position.y = this.index.heightAtPx(L.g.position.x, L.g.position.z);
    // 🏙 the roof
    if (this.roofMode) {
      const top = this.index.buildingTopAt(px, pz);
      if (Number.isFinite(top) && top <= this.roofY + 12) {
        if (top < this.roofY - 10) this.dropReq = true;   // landed on a lower roof
        this.roofY = top; this.roofLost = 0;
      } else {
        // over nothing (should not happen now — jumps carry him — but a backstop)
        this.roofLost += dt;
        if (this.roofLost > 0.3) { this.roofLost = 0; this.fallReq = true; }
      }
      if (this.vane) {
        const spin = this.vane.getObjectByName('spin');
        const near = Math.hypot(px - this.vaneAt.x, pz - this.vaneAt.z) < 16;
        if (near && this.vaneSpin < 2) { this.vaneSpin = 9; this.audio.jingle(); this.award('vane', 'The Weathervane'); }
        this.vaneSpin = Math.max(0, this.vaneSpin - dt * 3.2);
        if (spin) spin.rotation.y += dt * (0.4 + this.vaneSpin);
      }
    } else if (this.vane) {
      const spin = this.vane.getObjectByName('spin');
      if (spin) spin.rotation.y += dt * 0.4;
    }
    // 🚇 the pipe: walk into a mouth
    for (let i = 0; i < 2; i++) {
      const m = i === 0 ? CULVERT_A : CULVERT_B;
      if (Math.hypot(px - m.x, pz - m.z) > 11) continue;
      if (!this.pipe) {
        this.pipe = new SecretTunnel('pipe', [[{ x: 0, z: 0 }, { x: 0, z: -230 }]], 26, [{ x: 0, z: 0 }, { x: 0, z: -230 }], { x: 40, z: -115, r: 22 });
        this.pipe.onNearEnd = (end) => this.hud.showTalk(end >= 0 ? '🪜 CLIMB OUT' : null, end >= 0 ? () => this.pipe?.climbOut(end) : undefined);
        this.pipe.onExit = (end) => {
          const out = end === 0 ? CULVERT_A : CULVERT_B;
          const other = end === 0 ? CULVERT_B : CULVERT_A;
          const ang = Math.atan2(out.x - other.x, out.z - other.z);   // step out of the mouth, away from the bank
          this.host.exitScene(out.x + Math.sin(ang) * 16, out.z + Math.cos(ang) * 16);
          this.hud.showTalk(null);
        };
        this.pipe.onRoom = () => this.award('pipe', 'The Room in the Pipe');
      }
      this.audio.stoneScrape();
      this.host.enterScene(this.pipe, i === 0 ? { x: 0, z: -18 } : { x: 0, z: -212 });
      return;
    }
    // 🌊 the tide pool
    if (this.pool) {
      const out = TIDE.value < TIDE_OUT;
      this.pool.visible = out;
      if (out && this.lobster && this.claw) {
        const near = Math.hypot(px - POOL.x, pz - POOL.z) < 20;
        this.claw.rotation.z = near ? Math.sin(this.t * 6) * 0.5 + 0.5 : Math.sin(this.t * 1.3) * 0.08;
        this.lobster.rotation.y = near ? -0.6 + Math.sin(this.t * 0.8) * 0.15 : -0.6;
        if (near) this.award('pool', 'The Tide Pool');
      }
    }
  }

  /** dev: teleport spots for the rig */
  static readonly SPOTS = { state: STATE_LOT, federal: FEDERAL_LOT, pipe: CULVERT_A, market: MARKET_LOT, ladder: LADDERS[0].toward, garage: LADDERS[1].toward, vane: VANE, pool: POOL, cannon: CANNON, jettyStart: JETTY_S };
  get ladderSpots() { return this.ladders.map((L) => L.foot); }
  get vaneSpot() { return this.vaneAt; }
}

/** the jetty polygon for the world (map.mjs adds it; this is the one source of its geometry) */
export function jettyRing(): number[] {
  const nx = -JETTY_U.z, nz = JETTY_U.x, hw = 9;
  const e = { x: JETTY_S.x + JETTY_U.x * JETTY_LEN, z: JETTY_S.z + JETTY_U.z * JETTY_LEN };
  return [JETTY_S.x + nx * hw, JETTY_S.z + nz * hw, e.x + nx * hw, e.z + nz * hw, e.x - nx * hw, e.z - nz * hw, JETTY_S.x - nx * hw, JETTY_S.z - nz * hw].map((v) => Math.round(v));
}
