import * as THREE from 'three';
import { WorldIndex } from '../world/index';
import { GameAudio } from './audio';
import { WATER_Y, TIDE } from '../three/water';
import { SEASON } from '../world/style';
import { TOWN } from '@town';

// The second drawer of secrets: the small live things a kid who stops to look gets to
// see. Same rules as the frogs — nothing announces them, every one sits at a real
// place, and each has a card. Ambient behaviour runs whether or not you find the card.

export type Card = { t: string; s: string; b: string };
export type Spot = { id: string; x: number; z: number; label: string; r?: number };

export const MORE_CARDS: Record<string, Card> = {
  plovers: {
    t: 'Piping Plovers', s: 'Plum Island · the tide line',
    b: 'Little sand-coloured birds that run instead of fly, right along the edge of the water, and never quite let you catch up. The beach ropes off their nests every summer, and the whole island waits for the chicks. You just met the reason.'
  },
  seal: {
    t: 'A Harbor Seal', s: 'the Merrimack · off the boardwalk',
    b: 'A round grey head, two big eyes, a long look at you, and gone. The seals follow the fish up the river in the cold months and sometimes haul out on the sandbars at Joppa. Nobody in town is ever not excited to see one.'
  },
  cannon: {
    t: 'The Custom House Cannon', s: 'the wharf · 1835',
    b: 'An iron cannon on a wooden carriage, pointed at the river the way it has been since the Custom House watched every ship come up it. It has not been fired in anyone\'s lifetime and it is not going to start now. Kids climb on it. That is what it is for.'
  },
  diggers: {
    t: 'Clam Diggers', s: 'Joppa Flats · low tide',
    b: 'When the tide goes out at Joppa the flats come up, and so do the diggers: rakes, buckets, boots, bent double for the two hours the mud is out. Newburyport clams have gone to Boston tables since before the Custom House. The tide comes back twice a day. So do they.'
  },
  shopcat: {
    t: 'The Shop Cat', s: 'State Street · in the window',
    b: 'Every proper State Street shop has one. This one has been in that window since before you were born, watching dogs go by, and has opinions about all of them. It has decided you are acceptable.'
  },
  firefly: {
    t: 'A Firefly on the Nose', s: 'a summer lawn · after dark',
    b: 'You held still long enough, which is the whole trick. It blinked at you twice, decided you were a good place to sit, and went on its way. Fireflies are getting rarer everywhere. Not here, not tonight.'
  },
  turtles: {
    t: 'The Turtles of the Frog Pond', s: 'Bartlet Mall · the log',
    b: 'Painted turtles, sunning in a row on the log, and gone the instant a dog comes near. They will be back on it before you reach the path. They have been doing this since the Mall was a mill pond and the frogs still let them.'
  },
  tracks: {
    t: 'Tracks in the Snow', s: 'Atkinson Common · winter',
    b: 'Two hooves, close together, one print after another across a yard and into the Common, and at the end of the line: a deer, standing very still, hoping you are not looking. You are. She is fine with it, as long as you do not bark.'
  },
  buoy: {
    t: 'The Bell Answers', s: 'the Coast Guard station · 1791',
    b: 'You rang the station bell, and out in the channel the bell buoy answered, the way it has for every boat that came home in the fog since the Coast Guard was born on this river. Ring it again. It always answers.'
  },
  chalk: {
    t: 'Chalk on the Bricks', s: 'Inn Street · this morning',
    b: 'Somebody with a bucket of chalk got here before you. A hopscotch, a sun, a house with too many windows, and a dog that looks a lot like you. The rain will take it tonight, and tomorrow there will be a new one.'
  },
  balloon: {
    t: 'The Maudslay Balloon', s: 'one morning in ten',
    b: 'So far off and so slow you took a minute to notice it: a hot-air balloon over the Maudslay fields, riding the morning air down the river valley. They launch from the farms upriver on still mornings. This is one of the still mornings.'
  },
  ducklings: {
    t: 'Ducklings', s: 'the Frog Pond · spring',
    b: 'One mother, five ducklings, a line across the pond and up onto the grass and back down again, in that exact order, all day. Do not get between them. The mother has views on that. The frogs are not consulted.'
  }
};

type Host = {
  showCard(c: Card, isNew: boolean): void;
  found(id: string): boolean;
  hearts(x: number, y: number, z: number): void;
  dogPos(): { x: number; z: number };
};

const lam = (hex: string) => new THREE.MeshLambertMaterial({ color: hex });
const box = (w: number, h: number, d: number, hex: string) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(hex)); m.castShadow = true; return m; };
const dayOfYear = () => { const d = new Date(); return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 864e5); };

export class MoreEggs {
  private t = 0;
  private fx: ((dt: number) => boolean)[] = [];
  private dyn: Spot[] = [];

  private plovers: { g: THREE.Group; hx: number; hz: number; run: number; dir: number }[] = [];
  private shoreDir = 1;
  private seal: THREE.Group | null = null;
  private sealAt = { x: 0, z: 0 };
  private sealUp = 0;
  private sealCool = 30;
  private cannon: THREE.Group | null = null;
  private cannonAt = { x: 1040, z: -1120, dx: 1, dz: 0 };
  private diggers: { g: THREE.Group; ph: number }[] = [];
  private cat: THREE.Group | null = null;
  private catHead: THREE.Group | null = null;
  private catAt = { x: 0, z: 0 };
  private flyCool = 0;
  private flyBusy = false;
  private turtles: THREE.Mesh[] = [];
  private turtleLog = { x: 0, z: 0 };
  private turtlesIn = false;
  private deerAt = { x: 0, z: 0 };
  private bellAt = { x: 0, z: 0 };
  private chalkAt = { x: -491, z: 560 };
  private balloon: THREE.Group | null = null;
  private balloonDay = false;
  private ducks: { g: THREE.Group; lag: number }[] = [];
  private duckT = 0;
  private duckAt = { x: 0, z: 0 };

  constructor(private scene: THREE.Scene, private index: WorldIndex, private audio: GameAudio, private host: Host) {
    const lm = (id: string) => index.world.landmarks.find((l) => l.id === id);
    const gy = (x: number, z: number) => index.heightAtPx(x, z);
    const shore = (x: number, z: number, dx: number, dz: number, max = 900): [number, number] | null => {
      for (let d = 0; d < max; d += 8) if (index.isWaterAt(x + dx * d, z + dz * d)) return [x + dx * d, z + dz * d];
      return null;
    };

    // 1. piping plovers on the Plum Island tide line (not in winter)
    const pi = lm('pi-point');
    if (pi && SEASON !== 'winter') {
      // the nearest water in any direction is the tide line; the flock stands a few
      // metres up the sand from it
      let edge: [number, number] | null = null, ed = 1e9, edx = 1, edz = 0;
      for (let a = 0; a < 8; a++) {
        const dx = Math.cos(a * Math.PI / 4), dz = Math.sin(a * Math.PI / 4);
        const e = shore(pi.x, pi.y, dx, dz, 1200);
        if (e) { const d = Math.hypot(e[0] - pi.x, e[1] - pi.y); if (d < ed) { ed = d; edge = e; edx = dx; edz = dz; } }
      }
      if (edge) {
        const [ex, ez] = edge;
        const flockX = ex - edx * 34, flockZ = ez - edz * 34;
        this.shoreDir = Math.abs(edx) > Math.abs(edz) ? 1 : 0;   // 1: the shore runs along z, 0: along x
        for (let i = 0; i < 5; i++) {
          const g = new THREE.Group();
          const body = box(2.6, 1.5, 1.3, '#d9d1bd'); body.position.y = 2.2; g.add(body);
          const head = box(1.1, 1.0, 1.0, '#e6e0d0'); head.position.set(1.5, 3.0, 0); g.add(head);
          const band = box(0.5, 0.5, 1.2, '#2b2b2b'); band.position.set(0.6, 2.4, 0); g.add(band);
          const legL = box(0.25, 1.6, 0.25, '#e0a64a'); legL.position.set(-0.4, 0.8, 0.35); g.add(legL);
          const legR = box(0.25, 1.6, 0.25, '#e0a64a'); legR.position.set(-0.4, 0.8, -0.35); g.add(legR);
          const hx = flockX + (Math.random() - 0.5) * 30, hz = flockZ + (Math.random() - 0.5) * 60;
          g.position.set(hx, gy(hx, hz), hz);
          g.rotation.y = Math.random() * 6.28;
          scene.add(g);
          this.plovers.push({ g, hx, hz, run: 0, dir: 1 });
        }
        this.dyn.push({ id: 'plovers', x: flockX, z: flockZ, label: '🐦 WATCH THE BIRDS', r: 110 });
      }
    }

    // 2. a harbor seal off the boardwalk
    const bw = lm('boardwalk');
    if (bw) {
      const edge = shore(bw.x, bw.y, 0, -1) ?? shore(bw.x, bw.y, 0, 1);
      if (edge) {
        const [ex, ez] = edge;
        const dz = ez < bw.y ? -1 : 1;
        this.sealAt = { x: ex + 40, z: ez + dz * 170 };
        const g = new THREE.Group();
        const head = new THREE.Mesh(new THREE.SphereGeometry(3.2, 10, 8), lam('#5a5f63')); head.position.y = 2.2; g.add(head);
        const snout = box(2.2, 1.6, 2.0, '#6d7377'); snout.position.set(2.6, 1.6, 0); g.add(snout);
        for (const s of [-1, 1]) { const eye = box(0.5, 0.5, 0.5, '#111'); eye.position.set(1.8, 3.2, s * 1.3); g.add(eye); }
        g.position.set(this.sealAt.x, WATER_Y - 9, this.sealAt.z);
        scene.add(g);
        this.seal = g;
      }
    }

    // 3. the noon gun on the Custom House wharf, pointed at the water
    {
      const cx = this.cannonAt.x, cz = this.cannonAt.z;
      let bd = 1e9;
      for (let a = 0; a < 8; a++) {
        const dx = Math.cos(a * Math.PI / 4), dz = Math.sin(a * Math.PI / 4);
        const e = shore(cx, cz, dx, dz, 600);
        if (e) { const d = Math.hypot(e[0] - cx, e[1] - cz); if (d < bd) { bd = d; this.cannonAt.dx = dx; this.cannonAt.dz = dz; } }
      }
      const g = new THREE.Group();
      const carriage = box(7, 3, 4, '#5a3d28'); carriage.position.y = 1.5; g.add(carriage);
      for (const s of [-1, 1]) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.8, 12).rotateX(Math.PI / 2), lam('#3b2a1c')); wheel.position.set(0, 2.2, s * 2.4); g.add(wheel); }
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 11, 12).rotateZ(-Math.PI / 2), lam('#2c2f33')); barrel.position.set(2.5, 4.2, 0); barrel.rotation.z = 0.18; g.add(barrel);
      g.position.set(cx, gy(cx, cz), cz);
      g.rotation.y = Math.atan2(-this.cannonAt.dz, this.cannonAt.dx);
      scene.add(g);
      this.cannon = g;
      this.dyn.push({ id: 'cannon', x: cx, z: cz, label: '🧱 CLIMB ON', r: 60 });
    }

    // 3b. clam diggers on the Joppa flats: standing on mud that the low tide uncovers
    const jf = lm('joppa-flats');
    if (jf && SEASON !== 'winter') {
      let placed = 0;
      for (let tries = 0; tries < 1200 && placed < 4; tries++) {
        const a = Math.random() * 6.28, d = 60 + Math.random() * 700;
        const x = jf.x + Math.cos(a) * d, z = jf.y + Math.sin(a) * d;
        if (!index.isWaterAt(x, z)) continue;
        const h = index.heightAtPx(x, z);
        if (h < WATER_Y - 1.15 || h > WATER_Y - 0.2) continue;   // under water at high tide, out at low
        const g = new THREE.Group();
        const boots = box(2.2, 6, 2.2, '#2f3a2a'); boots.position.y = 3; g.add(boots);
        const body = box(4.4, 6, 3, ['#c9a33a', '#8a4a3a', '#3a5a8a'][placed % 3]); body.position.y = 9; g.add(body);
        const head = box(2.6, 2.6, 2.6, '#d6b08c'); head.position.y = 13.5; g.add(head);
        const rake = box(0.5, 12, 0.5, '#8a6a3a'); rake.position.set(3.2, 5.5, 0); rake.rotation.z = 0.5; g.add(rake);
        const bucket = box(3, 3, 3, '#e6e2d8'); bucket.position.set(-4, 1.5, 2); g.add(bucket);
        g.position.set(x, h, z);
        g.rotation.y = Math.random() * 6.28;
        g.visible = false;
        scene.add(g);
        this.diggers.push({ g, ph: Math.random() * 6 });
        placed++;
      }
      void placed;   // the diggers' spot is offered only while the flats are out (see spots())
    }

    // 4. the shop cat in a State Street window (the wall nearest the Fowle's sign)
    {
      const sx = -109, sz = 545;
      let best: { x: number; z: number; nx: number; nz: number } | null = null, bd = 1e9;
      for (const b of index.world.buildings) {
        const p = b.p;
        let nearAny = false;
        for (let i = 0; i < p.length; i += 2) if (Math.abs(p[i] - sx) < 160 && Math.abs(p[i + 1] - sz) < 160) { nearAny = true; break; }
        if (!nearAny) continue;
        for (let i = 0; i + 1 < p.length; i += 2) {
          const j = (i + 2) % p.length;
          const ax = p[i], az = p[i + 1], bx2 = p[j], bz2 = p[j + 1];
          const vx = bx2 - ax, vz = bz2 - az, l2 = vx * vx + vz * vz || 1;
          const tt = Math.max(0.2, Math.min(0.8, ((sx - ax) * vx + (sz - az) * vz) / l2));
          const qx = ax + vx * tt, qz = az + vz * tt, d = (qx - sx) ** 2 + (qz - sz) ** 2;
          if (d < bd) { bd = d; const l = Math.sqrt(l2); best = { x: qx, z: qz, nx: (sx - qx), nz: (sz - qz) }; const nl = Math.hypot(best.nx, best.nz) || 1; best.nx /= nl; best.nz /= nl; void l; }
        }
      }
      if (best && bd < 120 * 120) {
        const g = new THREE.Group();
        const body = box(3.2, 2.6, 2.0, '#1f1f22'); body.position.y = 1.3; g.add(body);
        const headG = new THREE.Group();
        const head = box(2.0, 1.8, 1.8, '#1f1f22'); headG.add(head);
        for (const s of [-1, 1]) { const ear = box(0.6, 0.7, 0.4, '#1f1f22'); ear.position.set(0.3, 1.2, s * 0.6); headG.add(ear); const eye = box(0.3, 0.3, 0.3, '#d8e24a'); eye.position.set(1.02, 0.25, s * 0.45); headG.add(eye); }
        headG.position.set(1.4, 3.2, 0); g.add(headG);
        const tail = box(0.5, 0.5, 2.6, '#1f1f22'); tail.position.set(-1.6, 0.9, 1.4); g.add(tail);
        this.catAt = { x: best.x + best.nx * 1.4, z: best.z + best.nz * 1.4 };
        g.position.set(this.catAt.x, gy(this.catAt.x, this.catAt.z) + 8.6, this.catAt.z);
        g.rotation.y = Math.atan2(best.nx, best.nz) - Math.PI / 2;
        scene.add(g);
        this.cat = g; this.catHead = headG;
        this.dyn.push({ id: 'shopcat', x: this.catAt.x, z: this.catAt.z, label: '🐈 PSST', r: 60 });
      }
    }

    // 6. turtles on a log at the Frog Pond's east bank
    const fp = TOWN.attractions?.frogPond;
    if (fp && SEASON !== 'winter') {
      const from = { x: -3060, z: 2740 };
      const e = shore(from.x, from.z, (fp.x - from.x) / Math.hypot(fp.x - from.x, fp.z - from.z), (fp.z - from.z) / Math.hypot(fp.x - from.x, fp.z - from.z), 400);
      if (e) {
        const dx = (fp.x - from.x), dz = (fp.z - from.z), l = Math.hypot(dx, dz) || 1;
        this.turtleLog = { x: e[0] + dx / l * 7, z: e[1] + dz / l * 7 };
        const log = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 22, 8).rotateZ(Math.PI / 2), lam('#5b452e'));
        log.position.set(this.turtleLog.x, WATER_Y + 0.6, this.turtleLog.z);
        log.rotation.y = Math.atan2(-dz, dx) + Math.PI / 2;
        scene.add(log);
        for (let i = 0; i < 3; i++) {
          const tu = box(3.0, 1.2, 2.2, '#3f5a2e');
          const off = (i - 1) * 6.5;
          const ax = Math.cos(log.rotation.y), az = -Math.sin(log.rotation.y);
          tu.position.set(this.turtleLog.x + ax * off, WATER_Y + 2.6, this.turtleLog.z + az * off);
          tu.rotation.y = log.rotation.y + (Math.random() - 0.5) * 0.6;
          scene.add(tu);
          this.turtles.push(tu);
        }
        this.dyn.push({ id: 'turtles', x: this.turtleLog.x, z: this.turtleLog.z, label: '🐢 SHH', r: 80 });
      }
    }

    // 7. tracks in the snow at Atkinson Common, and the deer at the end of them
    const at = lm('atkinson');
    if (at && SEASON === 'winter') {
      const sx = at.x + 160, sz = at.y + 240, ex = at.x - 140, ez = at.y - 120;
      const printMat = new THREE.MeshLambertMaterial({ color: '#8a94a0' });
      const printGeo = new THREE.CircleGeometry(1.1, 6).rotateX(-Math.PI / 2);
      for (let i = 0; i < 44; i++) {
        const k = i / 44;
        const bend = Math.sin(k * Math.PI) * 60;
        const x = sx + (ex - sx) * k + bend, z = sz + (ez - sz) * k - bend * 0.4;
        const side = (i % 2 ? 1 : -1) * 1.6;
        const m = new THREE.Mesh(printGeo, printMat);
        m.position.set(x + side, gy(x, z) + 0.35, z);
        scene.add(m);
      }
      const deer = new THREE.Group();
      const body = box(11, 6, 4.5, '#8c6a4a'); body.position.y = 9; deer.add(body);
      const neck = box(3, 6, 3, '#8c6a4a'); neck.position.set(5.5, 13, 0); neck.rotation.z = -0.5; deer.add(neck);
      const head = box(4.5, 2.6, 2.6, '#8c6a4a'); head.position.set(8, 15.5, 0); deer.add(head);
      for (const [lx, lz] of [[-4, -1.5], [-4, 1.5], [4, -1.5], [4, 1.5]] as const) { const leg = box(1.2, 6.5, 1.2, '#7a5b3f'); leg.position.set(lx, 3.2, lz); deer.add(leg); }
      const tail = box(1, 2, 1, '#f2eee6'); tail.position.set(-6, 9.5, 0); deer.add(tail);
      deer.position.set(ex, gy(ex, ez), ez);
      deer.rotation.y = Math.atan2(sz - ez, sx - ex) + Math.PI;
      scene.add(deer);
      this.deerAt = { x: ex, z: ez };
      this.dyn.push({ id: 'tracks', x: ex, z: ez, label: '🦌 FOLLOW THE TRACKS', r: 90 });
    }

    // 8. the station bell at the Coast Guard station
    {
      const st = index.world.buildings.find((b) => b.n === 'U.S. Coast Guard Station');
      if (st) {
        let cx = 0, cz = 0; const n = st.p.length / 2;
        for (let k = 0; k < n; k++) { cx += st.p[k * 2]; cz += st.p[k * 2 + 1]; }
        cx /= n; cz /= n;
        let placed = false;
        for (let d = 40; d < 160 && !placed; d += 12) {
          for (let a = 0; a < 8 && !placed; a++) {
            const x = cx + Math.cos(a * Math.PI / 4) * d, z = cz + Math.sin(a * Math.PI / 4) * d;
            if (!index.isBlocked(x, z) && !index.isWaterAt(x, z)) { this.bellAt = { x, z }; placed = true; }
          }
        }
        if (placed) {
          const g = new THREE.Group();
          const post = box(1.2, 22, 1.2, '#e8e4da'); post.position.y = 11; g.add(post);
          const arm = box(6, 0.8, 0.8, '#e8e4da'); arm.position.set(2.5, 21.5, 0); g.add(arm);
          const bell = new THREE.Mesh(new THREE.ConeGeometry(2.4, 3.6, 12), lam('#b08a3c')); bell.position.set(5, 18.8, 0); g.add(bell);
          const rope = box(0.3, 9, 0.3, '#c9b58f'); rope.position.set(5, 12.5, 0); g.add(rope);
          g.position.set(this.bellAt.x, gy(this.bellAt.x, this.bellAt.z), this.bellAt.z);
          scene.add(g);
          this.dyn.push({ id: 'buoy', x: this.bellAt.x, z: this.bellAt.z, label: '🔔 PULL THE ROPE', r: 56 });
        }
      }
    }

    // 9. chalk on the Inn Street bricks, a new drawing every day
    {
      const c = document.createElement('canvas'); c.width = c.height = 256;
      const g2 = c.getContext('2d')!;
      const kind = dayOfYear() % 4;
      const chalk = ['#f4f1ea', '#f7c8d0', '#c8e2f7', '#f7e9a8'];
      g2.lineWidth = 6; g2.lineCap = 'round'; g2.strokeStyle = chalk[dayOfYear() % chalk.length];
      g2.globalAlpha = 0.85;
      if (kind === 0) {
        // hopscotch
        for (let i = 0; i < 6; i++) { const y = 230 - i * 36; if (i % 3 === 2) { g2.strokeRect(58, y - 30, 64, 30); g2.strokeRect(134, y - 30, 64, 30); } else g2.strokeRect(96, y - 30, 64, 30); }
        g2.font = 'bold 22px sans-serif'; g2.fillStyle = g2.strokeStyle; for (let i = 0; i < 6; i++) g2.fillText(String(i + 1), 120, 224 - i * 36);
      } else if (kind === 1) {
        // a sun
        g2.beginPath(); g2.arc(128, 128, 40, 0, 6.28); g2.stroke();
        for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; g2.beginPath(); g2.moveTo(128 + Math.cos(a) * 52, 128 + Math.sin(a) * 52); g2.lineTo(128 + Math.cos(a) * 80, 128 + Math.sin(a) * 80); g2.stroke(); }
      } else if (kind === 2) {
        // a house with too many windows
        g2.strokeRect(60, 110, 136, 100); g2.beginPath(); g2.moveTo(50, 112); g2.lineTo(128, 50); g2.lineTo(206, 112); g2.stroke();
        for (let r = 0; r < 2; r++) for (let q = 0; q < 4; q++) g2.strokeRect(72 + q * 30, 122 + r * 40, 18, 22);
      } else {
        // a dog that looks a lot like you
        g2.beginPath(); g2.ellipse(120, 150, 52, 30, 0, 0, 6.28); g2.stroke();
        g2.beginPath(); g2.arc(178, 118, 22, 0, 6.28); g2.stroke();
        for (const lx of [84, 108, 132, 156]) { g2.beginPath(); g2.moveTo(lx, 176); g2.lineTo(lx, 210); g2.stroke(); }
        g2.beginPath(); g2.moveTo(68, 140); g2.lineTo(40, 110); g2.stroke();
      }
      const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(44, 44).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false }));
      let px = this.chalkAt.x, pz = this.chalkAt.z;
      for (let tries = 0; tries < 12 && index.isBlocked(px, pz); tries++) { px += 14; }
      this.chalkAt = { x: px, z: pz };
      plane.position.set(px, gy(px, pz) + 0.35, pz);
      plane.rotation.y = (dayOfYear() % 7) * 0.4;
      plane.renderOrder = 2;
      scene.add(plane);
      this.dyn.push({ id: 'chalk', x: px, z: pz, label: '🖍 LOOK DOWN', r: 50 });
    }

    // 10. the Maudslay balloon, one morning in ten (?balloon=1 to force)
    const md = lm('maudslay');
    if (md) {
      const q = new URLSearchParams(location.search);
      this.balloonDay = q.get('balloon') === '1' || dayOfYear() % 10 === 3;
      if (this.balloonDay) {
        const g = new THREE.Group();
        const env = new THREE.Mesh(new THREE.SphereGeometry(40, 16, 12), lam('#c8403a'));
        env.scale.y = 1.15; env.position.y = 60; g.add(env);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(41, 41, 14, 16, 1, true), new THREE.MeshLambertMaterial({ color: '#f2e9c9', side: THREE.DoubleSide })); band.position.y = 60; g.add(band);
        const basket = box(9, 7, 9, '#7a5a34'); basket.position.y = 6; g.add(basket);
        for (const s of [-1, 1]) for (const s2 of [-1, 1]) { const line = box(0.4, 26, 0.4, '#d8d0b8'); line.position.set(s * 4, 22, s2 * 4); g.add(line); }
        g.position.set(md.x, gy(md.x, md.y) + 400, md.y);
        g.visible = false;
        scene.add(g);
        this.balloon = g;
        this.balloon.userData.base = { x: md.x, z: md.y };
      }
    }

    // 13. ducklings on the Frog Pond in spring
    if (fp && SEASON === 'spring') {
      const mk = (w: number, hex: string) => {
        const g = new THREE.Group();
        const body = box(w * 2.4, w * 1.3, w * 1.5, hex); body.position.y = w * 0.9; g.add(body);
        const head = box(w * 0.9, w * 0.9, w * 0.9, hex); head.position.set(w * 1.3, w * 1.8, 0); g.add(head);
        const bill = box(w * 0.6, w * 0.3, w * 0.5, '#e0a63a'); bill.position.set(w * 1.9, w * 1.7, 0); g.add(bill);
        scene.add(g);
        return g;
      };
      this.ducks.push({ g: mk(1.9, '#6b5136'), lag: 0 });
      for (let i = 0; i < 5; i++) this.ducks.push({ g: mk(0.9, '#f0d55a'), lag: 9 + i * 7 });
    }
  }

  private duckPath(t: number): { x: number; z: number } {
    // an ellipse across the pond that runs up onto the east bank
    const fp = TOWN.attractions!.frogPond!;
    const cx = fp.x + 60, cz = fp.z - 20;
    return { x: cx + Math.cos(t) * 150, z: cz + Math.sin(t) * 105 };
  }

  spots(): Spot[] {
    const out = this.dyn.slice();
    if (this.seal && this.sealUp > 0) out.push({ id: 'seal', x: this.sealAt.x, z: this.sealAt.z, label: '🦭 LOOK AT THE RIVER', r: 520 });
    if (this.balloon && this.balloon.visible) out.push({ id: 'balloon', x: this.balloon.position.x, z: this.balloon.position.z, label: '🎈 LOOK UP', r: 1800 });
    if (this.ducks.length) out.push({ id: 'ducklings', x: this.duckAt.x, z: this.duckAt.z, label: '🐥 FOLLOW THE DUCKLINGS', r: 90 });
    if (this.diggers.length && TIDE.value < -0.8) out.push({ id: 'diggers', x: this.diggers[0].g.position.x, z: this.diggers[0].g.position.z, label: '🪣 WATCH THEM DIG', r: 110 });
    return out;
  }

  /** returns true when the tag was one of ours */
  interact(tag: string): boolean {
    const card = MORE_CARDS[tag];
    if (!card) return false;
    switch (tag) {
      case 'cannon': this.host.hearts(this.cannonAt.x, this.index.heightAtPx(this.cannonAt.x, this.cannonAt.z) + 10, this.cannonAt.z); this.host.showCard(card, this.host.found(tag)); return true;
      case 'buoy':
        this.audio.bell();
        setTimeout(() => this.audio.toll(1), 2200);
        setTimeout(() => this.host.showCard(card, this.host.found(tag)), 3200);
        return true;
      case 'turtles': this.spookTurtles(); this.host.showCard(card, this.host.found(tag)); return true;
      case 'plovers': this.scatterPlovers(); this.host.showCard(card, this.host.found(tag)); return true;
      case 'shopcat': this.audio.pop(); this.host.showCard(card, this.host.found(tag)); return true;
      default: this.host.showCard(card, this.host.found(tag)); return true;
    }
  }

  private spookTurtles() {
    if (this.turtlesIn || !this.turtles.length) return;
    this.turtlesIn = true;
    this.audio.plink();
    for (const tu of this.turtles) {
      const y0 = tu.position.y; let k = 0;
      this.fx.push((dt) => { k += dt / 0.6; tu.position.y = y0 - Math.min(1, k) * 6; return k < 1; });
    }
    setTimeout(() => {
      for (const tu of this.turtles) tu.position.y = WATER_Y + 2.6;
      this.turtlesIn = false;
    }, 25000);
  }

  private scatterPlovers() {
    for (const p of this.plovers) { p.run = 1.6 + Math.random() * 0.8; }
  }

  update(dt: number, px: number, pz: number, night: number, tod: number, stillT: number) {
    this.t += dt;
    for (let i = this.fx.length - 1; i >= 0; i--) if (!this.fx[i](dt)) this.fx.splice(i, 1);

    // plovers: peck, and run along the tide line when the dog comes close
    if (this.plovers.length) {
      const near = this.plovers.some((p) => (p.g.position.x - px) ** 2 + (p.g.position.z - pz) ** 2 < 70 * 70);
      for (const p of this.plovers) {
        const along = this.shoreDir === 1 ? 'z' : 'x';
        if (near && p.run <= 0) { p.run = 1.4 + Math.random() * 0.8; p.dir = (p.g.position[along] - (along === 'z' ? pz : px)) >= 0 ? 1 : -1; }
        if (p.run > 0) {
          p.run -= dt;
          p.g.position[along] += p.dir * 62 * dt;
          p.g.rotation.y = along === 'z' ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
          p.g.position.y = this.index.heightAtPx(p.g.position.x, p.g.position.z) + Math.abs(Math.sin(this.t * 30)) * 0.3;
          // never into the water, never off the beach: drift home sideways
          if (this.index.isWaterAt(p.g.position.x, p.g.position.z)) { p.g.position.x += (p.hx - p.g.position.x) * 0.2; p.g.position.z += (p.hz - p.g.position.z) * 0.2; }
          if (Math.abs(p.g.position[along] - (along === 'z' ? p.hz : p.hx)) > 260) p.dir = -p.dir;
        } else {
          p.g.rotation.y += Math.sin(this.t * 0.7 + p.hx) * dt * 0.4;
          p.g.position.y = this.index.heightAtPx(p.g.position.x, p.g.position.z) - Math.max(0, Math.sin(this.t * 2.2 + p.hz)) * 0.6;   // a peck
        }
      }
    }

    // the seal surfaces now and then when someone is on the boardwalk
    if (this.seal) {
      if (this.sealUp > 0) {
        this.sealUp -= dt;
        const k = Math.min(1, (7 - this.sealUp) * 1.5), fade = Math.min(1, this.sealUp * 1.5);
        this.seal.position.y = WATER_Y + TIDE.value - 9 + 10.5 * Math.min(k, fade) + Math.sin(this.t * 1.3) * 0.4;
        this.seal.rotation.y = Math.atan2(px - this.sealAt.x, pz - this.sealAt.z) - Math.PI / 2;
        if (this.sealUp <= 0) { this.seal.position.y = WATER_Y - 9; this.sealCool = 40 + Math.random() * 50; }
      } else {
        this.sealCool -= dt;
        if (this.sealCool <= 0 && (px - this.sealAt.x) ** 2 + (pz - this.sealAt.z) ** 2 < 600 * 600) {
          this.sealUp = 7;
          this.sealAt.x += (Math.random() - 0.5) * 80;
          this.seal.position.x = this.sealAt.x;
        }
      }
    }

    // the clam diggers come out with the flats
    if (this.diggers.length) {
      const out = TIDE.value < -0.8;
      for (const d of this.diggers) {
        d.g.visible = out;
        if (out) { d.g.rotation.x = 0.55 + Math.max(0, Math.sin(this.t * 1.1 + d.ph)) * 0.35; }
      }
    }

    // the shop cat watches the dog go by
    if (this.cat && this.catHead) {
      const dx = px - this.catAt.x, dz = pz - this.catAt.z;
      const near = dx * dx + dz * dz < 140 * 140;
      const want = near ? Math.atan2(dx, dz) - this.cat.rotation.y - Math.PI / 2 : 0;
      let w = want; while (w > Math.PI) w -= 2 * Math.PI; while (w < -Math.PI) w += 2 * Math.PI;
      w = Math.max(-1.1, Math.min(1.1, w));
      this.catHead.rotation.y += (w - this.catHead.rotation.y) * Math.min(1, dt * 3);
      const tail = this.cat.children[this.cat.children.length - 1]; tail.rotation.y = Math.sin(this.t * 1.6) * 0.5;
    }

    // a firefly lands on the nose of a dog that holds still on a summer lawn after dark
    if ((SEASON === 'summer' || SEASON === 'spring') && night > 0.6) {
      this.flyCool -= dt;
      if (!this.flyBusy && this.flyCool <= 0 && stillT > 6 && !this.index.isBlocked(px, pz) && !this.index.isWaterAt(px, pz)) {
        this.flyBusy = true;
        this.flyCool = 150;
        const m = new THREE.SpriteMaterial({ color: '#d8ff6a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 });
        const s = new THREE.Sprite(m); s.scale.set(2.4, 2.4, 1);
        const a = Math.random() * 6.28; const from = { x: px + Math.cos(a) * 70, z: pz + Math.sin(a) * 70 };
        let age = 0;
        this.fx.push((dt2) => {
          age += dt2;
          const d = this.host.dogPos();
          const gy = this.index.heightAtPx(d.x, d.z);
          const nose = { x: d.x, y: gy + 11, z: d.z };
          if (age < 4) {
            const k = age / 4;
            s.position.set(from.x + (nose.x - from.x) * k + Math.sin(age * 5) * 6 * (1 - k), gy + 6 + Math.sin(age * 3) * 5 * (1 - k) + 5 * k, from.z + (nose.z - from.z) * k + Math.cos(age * 4) * 6 * (1 - k));
            m.opacity = 0.4 + 0.6 * Math.abs(Math.sin(age * 4));
            if (age < dt2 * 1.5) this.scene.add(s);
            return true;
          }
          if (age < 7) { s.position.set(nose.x, nose.y, nose.z); m.opacity = 0.5 + 0.5 * Math.abs(Math.sin(age * 3)); if (age - dt2 < 4) { this.host.hearts(nose.x, nose.y + 6, nose.z); this.host.showCard(MORE_CARDS.firefly, this.host.found('firefly')); } return true; }
          if (age < 10) { const k = (age - 7) / 3; s.position.set(nose.x + k * 40, nose.y + k * 30, nose.z + k * 20); m.opacity = 1 - k; return true; }
          this.scene.remove(s); m.dispose(); this.flyBusy = false; return false;
        });
      }
    }

    // turtles slide in when a dog comes near the log
    if (this.turtles.length && !this.turtlesIn && (px - this.turtleLog.x) ** 2 + (pz - this.turtleLog.z) ** 2 < 75 * 75) this.spookTurtles();

    // the balloon rides the morning air down the valley
    if (this.balloon) {
      const up = tod > 0.27 && tod < 0.47;
      this.balloon.visible = up;
      if (up) {
        const b = this.balloon.userData.base as { x: number; z: number };
        const k = (tod - 0.27) / 0.2;
        const x = b.x - 1600 + k * 3200, z = b.z + Math.sin(k * 3) * 300;
        this.balloon.position.set(x, this.index.heightAtPx(x, z) + 380 + Math.sin(this.t * 0.3) * 8, z);
      }
    }

    // the ducklings, in a line
    if (this.ducks.length) {
      this.duckT += dt * 0.12;
      for (const d of this.ducks) {
        const p = this.duckPath(this.duckT - d.lag * 0.012);
        const ahead = this.duckPath(this.duckT - d.lag * 0.012 + 0.02);
        const water = this.index.isWaterAt(p.x, p.z);
        d.g.position.set(p.x, water ? WATER_Y + 0.4 : this.index.heightAtPx(p.x, p.z) + Math.abs(Math.sin(this.t * 9 + d.lag)) * 0.5, p.z);
        d.g.rotation.y = Math.atan2(ahead.x - p.x, ahead.z - p.z) - Math.PI / 2;
      }
      this.duckAt = { x: this.ducks[0].g.position.x, z: this.ducks[0].g.position.z };
    }
  }
}
