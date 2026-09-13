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
import { WorldIndex, pointInPoly } from '../world/index';
import type { Hud } from './hud';
import type { GameAudio } from './audio';
import { brickTex } from '../three/textures';
import { TIDE } from '../three/water';
import { TOWN } from '@town';

export const SECRET_TOTAL = 5;
const KEY = 'nbpt-secrets';

// the sites, world px (Newburyport)
const STATE_LOT = { x: -62, z: 551 };        // tunnel end A: near State Street, ~70 m down from Market Square
const FEDERAL_LOT = { x: 2074, z: 3158 };    // tunnel end B: off Federal Street
// the pipe's mouths: a box culvert running under the rail trail's south stretch, green
// both sides (the first pick, by the harbour, put the mouth in the water)
const CULVERT_A = { x: 120, z: 10771 };
const CULVERT_B = { x: 310, z: 10728 };
const LADDER_FOOT = { x: -2511, z: -275 };   // up the back of the Intermodal garage (its SE corner)
const LADDER_TOP = { x: -2528, z: -303 };    // where you land on the roof
const GARAGE_C = { x: -2670, z: -531 };
const VANE = { x: -2247, z: -888 };          // Horton's Yard roof
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
  burst: (x: number, y: number, z: number, hex: string, n: number, size: number, life: number, spray: number, up: number) => void;
  say: (text: string) => void;
};

function lam(hex: string) { return new THREE.MeshLambertMaterial({ color: hex }); }
function bx(w: number, h: number, d: number, hex: string) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(hex)); }

// ---------- a corridor you can walk: brick (the tunnels) or concrete (the pipe) ----------
// Built from a polyline in its own scene space; Game swaps scenes the way it does
// for the story tunnel, and asks free()/update() the same questions.
export class SecretTunnel {
  scene = new THREE.Scene();
  done = false;
  readonly ends: { x: number; z: number }[];
  private width: number;
  private path: { x: number; z: number }[];
  private lantern: THREE.PointLight;
  private t = 0;
  private armed = false;
  private room: { x: number; z: number; r: number } | null;
  private roomSeen = false;
  onExit: (end: number) => void = () => {};
  onRoom: () => void = () => {};

  constructor(kind: 'brick' | 'pipe', path: { x: number; z: number }[], width: number, room: { x: number; z: number; r: number } | null = null) {
    this.path = path; this.width = width; this.room = room;
    this.ends = [path[0], path[path.length - 1]];
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
    for (let i = 0; i + 1 < path.length; i++) {
      const a = path[i], b = path[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z, len = Math.hypot(dx, dz);
      const ang = Math.atan2(dx, dz);
      const nx = -dz / len, nz = dx / len;
      for (const s of [-1, 1]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(8, H, len + width), wallMat);
        m.position.set((a.x + b.x) / 2 + nx * s * (width / 2 + 4), H / 2, (a.z + b.z) / 2 + nz * s * (width / 2 + 4));
        m.rotation.y = ang;
        m.castShadow = true; m.receiveShadow = true;
        this.scene.add(m);
      }
      const f = new THREE.Mesh(new THREE.PlaneGeometry(width + 8, len + width), floorMat);
      f.rotation.x = -Math.PI / 2; f.rotation.z = -ang;
      f.position.set((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
      f.receiveShadow = true;
      this.scene.add(f);
      // ⚠️ NO CEILING, on either kind. The chase camera rides above the walls, and a
      // slab up there is a black screen (the pipe shipped one for a frame: 9/13).
    }
    // daylight at each end: a pale shaft
    for (const e of this.ends) {
      const shaft = new THREE.PointLight('#9fb4cd', 160, 240, 1);
      shaft.position.set(e.x, 60, e.z);
      this.scene.add(shaft);
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
    for (let i = 0; i + 1 < this.path.length; i++) {
      const a = this.path[i], b = this.path[i + 1];
      const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / l2));
      const px = a.x + dx * t, pz = a.z + dz * t;
      if ((x - px) ** 2 + (z - pz) ** 2 < hw * hw) return true;
    }
    return false;
  }

  enter() { this.armed = false; }
  tryInteract(_px: number, _pz: number) { /* nothing to pick up: the corridor IS the thing */ }

  update(dt: number, px: number, pz: number) {
    this.t += dt;
    this.lantern.position.set(px, 40, pz);
    this.lantern.intensity = 230 + Math.sin(this.t * 7) * 14;
    const b = this.scene.getObjectByName('bone');
    if (b) { b.rotation.y += dt * 1.2; b.position.y = 3 + Math.sin(this.t * 3) * 0.6; }
    // the far end: arm once you are well inside, then either end takes you out
    let nearEnd = -1;
    this.ends.forEach((e, i) => { if (Math.hypot(px - e.x, pz - e.z) < 14) nearEnd = i; });
    if (!this.armed) { if (nearEnd < 0) this.armed = true; return; }
    if (nearEnd >= 0) { this.armed = false; this.onExit(nearEnd); return; }
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
  gapHop = false;      // set when roofFree let him over an alley — Game turns it into a hop
  private scene: THREE.Scene;
  private index: WorldIndex;
  private hud: Hud;
  private audio: GameAudio;
  private host: SecretHost;
  private tunnels: SecretTunnel | null = null;
  private pipe: SecretTunnel | null = null;
  private grates: THREE.Group[] = [];
  private mouths: THREE.Group[] = [];
  private ladder: THREE.Group | null = null;
  private vane: THREE.Group | null = null;
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
    for (const p of [STATE_LOT, FEDERAL_LOT]) {
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
    // 🪜 the fire escape: two rails and rungs, from the ground to the garage parapet
    {
      const top = this.index.buildingTopAt(LADDER_TOP.x, LADDER_TOP.z);
      const g0 = gy(LADDER_FOOT.x, LADDER_FOOT.z);
      const h = Number.isFinite(top) ? Math.max(30, top - g0 + 2) : 60;
      const g = new THREE.Group();
      for (const sx of [-2.2, 2.2]) { const rail = bx(0.9, h, 0.9, '#2f3236'); rail.position.set(sx, h / 2, 0); g.add(rail); }
      for (let y = 4; y < h - 2; y += 5) { const rung = bx(4.4, 0.7, 0.7, '#3d4045'); rung.position.set(0, y, 0); g.add(rung); }
      const dir = Math.atan2(LADDER_FOOT.x - GARAGE_C.x, LADDER_FOOT.z - GARAGE_C.z);
      g.position.set(LADDER_FOOT.x, g0, LADDER_FOOT.z);
      g.rotation.y = dir;
      this.scene.add(g); this.ladder = g;
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
      const top = this.index.buildingTopAt(VANE.x, VANE.z);
      g.position.set(VANE.x, Number.isFinite(top) ? top : gy(VANE.x, VANE.z) + 60, VANE.z);
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

  // ---------- the hooks Game calls ----------

  /** a dig finished here: was it on a grate? (returns true when the secret took it) */
  dig(px: number, pz: number): boolean {
    if (!this.enabled) return false;
    const ends = [STATE_LOT, FEDERAL_LOT];
    for (let i = 0; i < 2; i++) {
      if (Math.hypot(px - ends[i].x, pz - ends[i].z) > 22) continue;
      if (!this.tunnels) {
        // the corridor: down, a long run, a dogleg, and up the other end — 5 bends of
        // brick in scene space (~180 m of town compressed to a run you can feel)
        this.tunnels = new SecretTunnel('brick', [
          { x: 0, z: 0 }, { x: 0, z: -260 }, { x: 120, z: -260 }, { x: 120, z: -520 }, { x: -60, z: -520 }, { x: -60, z: -700 },
        ], 40);
        this.tunnels.onExit = (end) => {
          const out = end === 0 ? STATE_LOT : FEDERAL_LOT;
          this.host.exitScene(out.x + 18, out.z + 14);
          this.award('tunnels', 'The Smugglers’ Tunnel');
        };
      }
      this.audio.stoneScrape();
      const entry = i === 0 ? { x: 0, z: -22 } : { x: -60, z: -678 };
      this.host.enterScene(this.tunnels, entry);
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
    if (!this.roofMode) {
      if (Math.hypot(px - LADDER_FOOT.x, pz - LADDER_FOOT.z) < 24) return { label: '🪜 CLIMB', cb: () => this.host.enterRoof(LADDER_TOP.x, LADDER_TOP.z) };
    } else if (Math.hypot(px - LADDER_TOP.x, pz - LADDER_TOP.z) < 26) {
      return { label: '🪜 CLIMB DOWN', cb: () => this.host.leaveRoof(LADDER_FOOT.x + 4, LADDER_FOOT.z + 6) };
    }
    return null;
  }

  /** on the roofs: walkable where there is a roof at about this height — and across
   *  an alley when there is one on the far side (a hop) */
  roofFree(x: number, z: number, px: number, pz: number): boolean {
    const top = this.index.buildingTopAt(x, z);
    if (Number.isFinite(top) && Math.abs(top - this.roofY) < 18) return true;
    const dx = x - px, dz = z - pz, d = Math.hypot(dx, dz) || 1;
    for (let k = 12; k <= 40; k += 7) {
      const t2 = this.index.buildingTopAt(x + (dx / d) * k, z + (dz / d) * k);
      if (Number.isFinite(t2) && Math.abs(t2 - this.roofY) < 18) { this.gapHop = true; return true; }
    }
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
    if (this.ladder) this.ladder.position.y = this.index.heightAtPx(this.ladder.position.x, this.ladder.position.z);
    // 🏙 the roof
    if (this.roofMode) {
      const top = this.index.buildingTopAt(px, pz);
      if (Number.isFinite(top) && Math.abs(top - this.roofY) < 18) { this.roofY = top; this.roofLost = 0; }
      else { this.roofLost += dt; if (this.roofLost > 0.6) { this.roofLost = 0; this.host.leaveRoof(px, pz); } }
      if (this.vane) {
        const spin = this.vane.getObjectByName('spin');
        const near = Math.hypot(px - VANE.x, pz - VANE.z) < 16;
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
        this.pipe = new SecretTunnel('pipe', [{ x: 0, z: 0 }, { x: 0, z: -230 }], 26, { x: 40, z: -115, r: 22 });
        this.pipe.onExit = (end) => {
          const out = end === 0 ? CULVERT_A : CULVERT_B;
          const other = end === 0 ? CULVERT_B : CULVERT_A;
          const ang = Math.atan2(out.x - other.x, out.z - other.z);   // step out of the mouth, away from the bank
          this.host.exitScene(out.x + Math.sin(ang) * 16, out.z + Math.cos(ang) * 16);
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
  static readonly SPOTS = { state: STATE_LOT, federal: FEDERAL_LOT, pipe: CULVERT_A, ladder: LADDER_FOOT, vane: VANE, pool: POOL, cannon: CANNON, jettyStart: JETTY_S };
}

/** the jetty polygon for the world (map.mjs adds it; this is the one source of its geometry) */
export function jettyRing(): number[] {
  const nx = -JETTY_U.z, nz = JETTY_U.x, hw = 9;
  const e = { x: JETTY_S.x + JETTY_U.x * JETTY_LEN, z: JETTY_S.z + JETTY_U.z * JETTY_LEN };
  return [JETTY_S.x + nx * hw, JETTY_S.z + nz * hw, e.x + nx * hw, e.z + nz * hw, e.x - nx * hw, e.z - nz * hw, JETTY_S.x - nx * hw, JETTY_S.z - nz * hw].map((v) => Math.round(v));
}
export { pointInPoly };
