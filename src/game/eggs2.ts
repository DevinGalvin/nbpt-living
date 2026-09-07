import * as THREE from 'three';
import { WorldIndex, CHUNK, pointInPoly } from '../world/index';
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
  bottle: {
    t: 'Message in a Bottle', s: 'the wrack line · Plum Island',
    b: ''   // the week's note goes here (see NOTES)
  },
  fetch: {
    t: 'Fetch!', s: 'Cashman Park · the lawn by the ramp',
    b: 'A tennis ball, thrown as far as an arm can throw it, and a dog who brings it back every single time. This is the whole point of a park. Bring it back and she throws it again.'
  },
  tideclock: {
    t: 'The Tide Clock', s: 'the Coast Guard station',
    b: 'Two highs and two lows a day, about six hours apart, and the clock on the station wall keeps them. When the needle is at the bottom the flats at Joppa are out and the clam diggers are on them; at the top the river is up to the boardwalk. Watch it for a day and you will know the river better than most.'
  },
  chalk: {
    t: 'Chalk on the Bricks', s: 'Inn Street · this morning',
    b: 'Somebody with a bucket of chalk got here before you. A hopscotch, a sun, a house with too many windows, and a dog that looks a lot like you. The rain will take it tonight, and tomorrow there will be a new one.'
  },
  balloon: {
    t: 'The Maudslay Balloon', s: 'one morning in ten',
    b: 'So far off and so slow you took a minute to notice it: a hot-air balloon over the Maudslay fields, riding the morning air down the river valley. They launch from the farms upriver on still mornings. This is one of the still mornings.'
  },
  fireworks: {
    t: 'Yankee Homecoming', s: 'the last week of July · over the river',
    b: 'Every summer since 1958 the town throws itself a week-long party, and it ends with fireworks over the Merrimack, watched from the boardwalk, the lawn, the boats, and every rooftop with a ladder. Tonight is the night. The gulls have gone to bed. Nobody else has.'
  },
  heron: {
    t: 'The Great Blue Heron', s: 'the Little River marsh',
    b: 'Grey, taller than you, standing on one leg in the reeds like it has been there since the marsh was made, and gone the moment you got too close: a slow lift, four wingbeats, and down again farther up the river. It will let you get exactly this near and no nearer. Every time.'
  },
  owl: {
    t: 'A Snowy Owl', s: 'Plum Island · January',
    b: 'You thought it was a fence post. Then the fence post turned its head. Snowy owls come down from the Arctic to Plum Island in the hard winters and sit on the posts along the refuge road all day, and birders drive up from Boston to see one. You did not have to drive.'
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
  burst(x: number, y: number, z: number, hex: string, n: number, pop: boolean, size: number, life: number): void;
};

const lam = (hex: string) => new THREE.MeshLambertMaterial({ color: hex });
// the notes in the bottle, one a week, from kids who live here
const NOTES = [
  'Hi. My name is Ava and I am 8. I live near the Mall. If you find this, go look at the frogs in the pond. They are real. Not the metal ones. Write back. — Ava',
  'To whoever finds this: the best rock for skipping is under the Chain Bridge on the Newburyport side. Do not tell my brother. — Theo, age 9',
  'I am writing this on the beach because my dad said the tide would take it to Portugal. If you are in Portugal, hello. If you are on Plum Island, the tide did not go very far. — Mae',
  'Things I saw today: a seal, a heron, two clam guys, and a dog with a stick bigger than the dog. Good day. — Sam, 7',
  'Dear finder, my grandpa says the fog horn is the river clearing its throat. I believe him. — Lucy',
  'If you are a dog reading this, good dog. If you are a person, there is a really good puddle by the boardwalk after rain. — Noah, age 6 and three quarters',
  'We rode bikes on the rail trail all the way to the marsh and back and my legs are noodles. Worth it. — Iris',
  'My favorite thing about Newburyport is the fireworks over the water in the summer and that everyone says hi. — Ben, 8',
  'I lost a red mitten on High Street in January. If you find it, it is mine. If it is summer now, never mind. — Ruby',
  'Note to the future: the ice cream truck comes down our street around four. Be ready. — Jonah, age 9',
];
const box = (w: number, h: number, d: number, hex: string) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(hex)); m.castShadow = true; return m; };
const dayOfYear = () => { const d = new Date(); return Math.floor((d.getTime() - new Date(d.getFullYear(), 0, 0).getTime()) / 864e5); };

export class MoreEggs {
  private t = 0;
  private fx: ((dt: number) => boolean)[] = [];
  private dyn: Spot[] = [];
  private bottle: THREE.Group | null = null;
  // 🎾 fetch: the thrower on the park lawn, and the ball's whole flight
  private fetch: { g: THREE.Group; arm: THREE.Object3D; ball: THREE.Mesh; x: number; z: number; dx: number; dz: number;
    state: 'idle' | 'wind' | 'fly' | 'ground' | 'carry' | 'rest'; t: number; from: THREE.Vector3; to: THREE.Vector3; throws: number; cool: number; lastDog: { x: number; z: number }; dogDir: { x: number; z: number } } | null = null;

  private plovers: { g: THREE.Group; hx: number; hz: number; run: number; dir: number }[] = [];
  private shoreDir = 1;
  private seal: THREE.Group | null = null;
  private sealAt = { x: 0, z: 0 };
  private sealUp = 0;
  private sealCool = 30;
  private sealFollow = 0;      // seconds the seal has been keeping pace
  private catHop = 0;
  private lastPx = 0; private lastPz = 0; private dogSpeed = 0;
  private cannon: THREE.Group | null = null;
  private cannonAt = { x: 1040, z: -1120, dx: 1, dz: 0 };
  private diggers: { g: THREE.Group; ph: number }[] = [];
  private cat: THREE.Group | null = null;
  private catHead: THREE.Group | null = null;
  private catBaseY = 0;
  private tideNeedle: THREE.Object3D | null = null;
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
  private showAt = { x: 0, z: 0 };
  private showLeft = 0;          // seconds of fireworks left tonight
  private showDone = false;      // one show a night
  private showNext = 0;
  private heron: THREE.Group | null = null;
  private heronWings: THREE.Mesh[] = [];
  private heronAt = { x: 0, z: 0 };
  private heronFly = 0;          // seconds left in the air
  private heronFrom = { x: 0, z: 0 };
  private heronTo = { x: 0, z: 0 };
  private marsh: [number, number][] = [];
  private owl: THREE.Group | null = null;
  private owlHead: THREE.Group | null = null;
  private owlAt = { x: 0, z: 0 };
  private owlGone = 0;
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
        this.cat = g; this.catHead = headG; this.catBaseY = g.position.y;
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
          // 🌊 the tide clock, on a post beside the bell: a dial that keeps the river's real tide
          const tc = new THREE.Group();
          const tpost = box(1.2, 18, 1.2, '#e8e4da'); tpost.position.y = 9; tc.add(tpost);
          const dc = document.createElement('canvas'); dc.width = dc.height = 128;
          const d2 = dc.getContext('2d')!;
          d2.fillStyle = '#f4efe2'; d2.beginPath(); d2.arc(64, 64, 62, 0, Math.PI * 2); d2.fill();
          d2.strokeStyle = '#2a3a5a'; d2.lineWidth = 4; d2.beginPath(); d2.arc(64, 64, 60, 0, Math.PI * 2); d2.stroke();
          d2.fillStyle = '#2a3a5a'; d2.font = '700 15px system-ui, sans-serif'; d2.textAlign = 'center';
          d2.fillText('HIGH', 64, 24); d2.fillText('LOW', 64, 116);
          d2.font = '600 11px system-ui, sans-serif'; d2.fillText('EBB', 104, 68); d2.fillText('FLOOD', 26, 68);
          for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; d2.beginPath(); d2.moveTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); d2.lineTo(64 + Math.cos(a) * 58, 64 + Math.sin(a) * 58); d2.stroke(); }
          d2.font = '700 9px system-ui, sans-serif'; d2.fillText('TIDE', 64, 50);
          const dialTex = new THREE.CanvasTexture(dc); dialTex.colorSpace = THREE.SRGBColorSpace;
          const dial = new THREE.Mesh(new THREE.CircleGeometry(6.5, 24), new THREE.MeshLambertMaterial({ map: dialTex, side: THREE.DoubleSide }));
          dial.position.set(0, 21, 0); tc.add(dial);
          // no back plate: the dial reads from either side of the post, the needle too (a rim instead)
          const rim = new THREE.Mesh(new THREE.TorusGeometry(6.7, 0.5, 6, 24), lam('#2a3a5a')); rim.position.set(0, 21, 0); tc.add(rim);
          const needle = new THREE.Group(); needle.position.set(0, 21, 0);
          const hand = box(0.7, 5.6, 0.9, '#c8262a'); hand.position.y = 2.6; needle.add(hand);
          const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.1, 10), lam('#2a2a2a')); hub.rotation.x = Math.PI / 2; needle.add(hub);
          tc.add(needle);
          this.tideNeedle = needle;
          // beside the bell along the wall, never into it: step sideways to the line from the station's middle
          const ddx = cx - this.bellAt.x, ddz = cz - this.bellAt.z, dl = Math.hypot(ddx, ddz) || 1;
          let tx = this.bellAt.x - ddz / dl * 16, tz = this.bellAt.z + ddx / dl * 16;
          if (index.isBlocked(tx, tz)) { tx = this.bellAt.x + ddz / dl * 16; tz = this.bellAt.z - ddx / dl * 16; }
          tx -= ddx / dl * 7; tz -= ddz / dl * 7;   // and a step out from the wall, so the dial is not in the brick
          tc.position.set(tx, gy(tx, tz), tz);
          tc.rotation.y = Math.atan2(cx - tx, cz - tz) + Math.PI;   // the dial faces away from the station, toward the walk
          scene.add(tc);
          this.dyn.push({ id: 'tideclock', x: tx, z: tz, label: '🌊 READ THE TIDE', r: 50 });
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

    // 9b. a message in a bottle on the wrack line, one day a week (?bottle=1 to force)
    if (dayOfYear() % 7 === 2 || new URLSearchParams(location.search).get('bottle') === '1') {
      // the town's own beach: the swimming beach nearest the centre of the map
      let beach = -1, beachD = Infinity;
      index.world.polys.forEach((p, pi) => {
        if (p.k !== 'sand' || !index.isBeachPoly(pi)) return;
        const d = p.p[0] * p.p[0] + p.p[1] * p.p[1];
        if (d < beachD) { beachD = d; beach = pi; }
      });
      if (beach >= 0) {
        const p = index.world.polys[beach];
        let cx = 0, cz = 0, n = 0;
        for (let i = 0; i < p.p.length; i += 2) { cx += p.p[i]; cz += p.p[i + 1]; n++; }
        cx /= n; cz /= n;
        let bestA = -1, bestD = Infinity;
        for (let k = 0; k < 24; k++) {
          const a = (k / 24) * Math.PI * 2;
          for (let d = 40; d <= 1100; d += 20) if (index.isWaterAt(cx + Math.cos(a) * d, cz + Math.sin(a) * d)) { if (d < bestD) { bestD = d; bestA = a; } break; }
        }
        if (bestA >= 0 && bestD > 60) {
          const bx = cx + Math.cos(bestA) * (bestD - 30) + Math.sin(bestA) * 40, bz = cz + Math.sin(bestA) * (bestD - 30) - Math.cos(bestA) * 40;
          const g = new THREE.Group();
          const glass = new THREE.MeshLambertMaterial({ color: '#b9ddd2', transparent: true, opacity: 0.72 });
          const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 6.2, 10), glass); body.castShadow = true; g.add(body);
          const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 2.6, 10), glass); neck.position.y = 4.3; g.add(neck);
          const cork = box(1.3, 1.5, 1.3, '#b98a55'); cork.position.y = 6; g.add(cork);
          const paper = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 4.6, 8), lam('#f4efe0')); g.add(paper);
          g.rotation.z = Math.PI / 2 - 0.22; g.rotation.y = (dayOfYear() % 5) * 1.1;
          g.position.set(bx, gy(bx, bz) + 1.5, bz);
          scene.add(g);
          this.bottle = g;
          this.dyn.push({ id: 'bottle', x: bx, z: bz, label: '🍾 PICK UP', r: 42 });
        }
      }
    }

    // 9c. fetch on the Cashman Park lawn: a woman with a tennis ball, all year
    {
      const park = index.world.polys.find((p) => p.k === 'park' && p.n === 'Cashman Park');
      if (park) {
        let cx = 0, cz = 0, n = 0;
        for (let i = 0; i < park.p.length; i += 2) { cx += park.p[i]; cz += park.p[i + 1]; n++; }
        cx /= n; cz /= n;
        // stand on the grass (the park's middle can be its parking lot) where the lawn
        // runs longest: the nearest spot to the middle with clear grass out to 200 px
        const grass = (x: number, z: number) => {
          if (index.isBlocked(x, z) || index.isWaterAt(x, z) || index.onPavedAt(x, z)) return false;
          // the roads test misses the parking lots; check the lot polygons in this cell
          for (const pi of index.bucket(Math.floor(x / CHUNK) + ',' + Math.floor(z / CHUNK)).polys) {
            const pp = index.world.polys[pi];
            if ((pp.k === 'parking' || pp.k === 'pitch') && pointInPoly(x, z, pp)) return false;
          }
          return true;
        };
        let bestA = 0, bestScore = -1;
        outer: for (const r of [0, 70, 140, 210, 280, 350]) {
          for (let j = 0; j < 12; j++) {
            const b = (j / 12) * Math.PI * 2;
            const sx0 = cx + Math.sin(b) * r, sz0 = cz + Math.cos(b) * r;
            if (!grass(sx0, sz0)) continue;
            for (let k = 0; k < 16; k++) {
              const a = (k / 16) * Math.PI * 2;
              let score = 0;
              for (const d of [40, 90, 140, 200]) { if (grass(sx0 + Math.sin(a) * d, sz0 + Math.cos(a) * d)) score++; else break; }
              if (score > bestScore) { bestScore = score; bestA = a; }
            }
            if (bestScore >= 4) { cx = sx0; cz = sz0; break outer; }
            bestScore = -1;
          }
        }
        if (bestScore >= 4) {
          const g = new THREE.Group();
          const skin = '#e8c39e', shirt = '#4a7ab8', pants = '#3b4d6b';
          for (const sx of [-2.4, 2.4]) { const leg = box(2.2, 8, 2.2, pants); leg.position.set(sx, 4, 0); g.add(leg); }
          const bodyM = box(7.5, 7, 4.2, shirt); bodyM.position.y = 11.5; g.add(bodyM);
          const head = new THREE.Mesh(new THREE.SphereGeometry(3.6, 10, 8), lam(skin)); head.position.y = 18.8; head.castShadow = true; g.add(head);
          const hair = new THREE.Mesh(new THREE.SphereGeometry(3.8, 10, 8), lam('#5e3c22')); hair.scale.set(1, 0.7, 1); hair.position.y = 20.1; g.add(hair);
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, 1.2, 12), lam('#c8262a')); cap.position.y = 21.4; g.add(cap);
          const armL = box(1.7, 7, 1.7, shirt); armL.position.set(-5.2, 11.5, 0); g.add(armL);
          const arm = new THREE.Group(); arm.position.set(5.2, 15, 0);
          const armR = box(1.7, 7, 1.7, shirt); armR.position.y = -3.5; arm.add(armR);
          g.add(arm);
          const ball = new THREE.Mesh(new THREE.SphereGeometry(1.7, 10, 8), lam('#d7e84a')); ball.castShadow = true;
          ball.position.set(5.2, 7.6, 1.6); g.add(ball);   // in the hand
          g.position.set(cx, gy(cx, cz), cz);
          g.rotation.y = bestA;
          scene.add(g);
          this.fetch = { g, arm, ball, x: cx, z: cz, dx: Math.sin(bestA), dz: Math.cos(bestA), state: 'idle', t: 0, from: new THREE.Vector3(), to: new THREE.Vector3(), throws: 0, cool: 0, lastDog: { x: 0, z: 0 }, dogDir: { x: 0, z: 1 } };
        }
      }
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

    // 14. Yankee Homecoming: fireworks over the river, from the boardwalk (the last week
    // of July on the real calendar, and one night in twelve otherwise; ?fireworks=1 forces)
    if (this.seal) this.showAt = { x: this.sealAt.x, z: this.sealAt.z };

    // 15. the great blue heron in the Little River marsh below the station
    const st2 = lm('mbta');
    if (st2 && SEASON !== 'winter') {
      let best: { p: number[]; d: number } | null = null;
      for (const poly of index.world.polys) {
        if (poly.k !== 'wetland') continue;
        let cx = 0, cz = 0; const n = poly.p.length / 2;
        for (let k = 0; k < n; k++) { cx += poly.p[k * 2]; cz += poly.p[k * 2 + 1]; }
        cx /= n; cz /= n;
        const d = Math.hypot(cx - st2.x, cz - st2.y);
        if (d < 2600 && (!best || d < best.d)) best = { p: poly.p, d };
      }
      if (best) {
        // standing spots: points inside the marsh, not in open water
        const pts = best.p;
        let minx = 1e9, minz = 1e9, maxx = -1e9, maxz = -1e9;
        for (let k = 0; k < pts.length; k += 2) { minx = Math.min(minx, pts[k]); maxx = Math.max(maxx, pts[k]); minz = Math.min(minz, pts[k + 1]); maxz = Math.max(maxz, pts[k + 1]); }
        const inPoly = (x: number, z: number) => { let inside = false; for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) { const xi = pts[i], zi = pts[i + 1], xj = pts[j], zj = pts[j + 1]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside; } return inside; };
        for (let tries = 0; tries < 300 && this.marsh.length < 12; tries++) {
          const x = minx + Math.random() * (maxx - minx), z = minz + Math.random() * (maxz - minz);
          if (inPoly(x, z) && !index.isWaterAt(x, z) && !index.isBlocked(x, z)) this.marsh.push([x, z]);
        }
        if (this.marsh.length) {
          const g = new THREE.Group();
          const body = box(4.2, 3.4, 8, '#8d97a0'); body.position.y = 15; g.add(body);
          const neck = box(1.4, 9, 1.4, '#9aa3ab'); neck.position.set(0, 21, 3.2); neck.rotation.x = -0.35; g.add(neck);
          const head = box(2.2, 2, 3.4, '#9aa3ab'); head.position.set(0, 25.5, 4.6); g.add(head);
          const bill = box(0.6, 0.6, 4, '#d8b04a'); bill.position.set(0, 25.3, 8); g.add(bill);
          const leg = box(0.5, 13, 0.5, '#6b6f5a'); leg.position.set(0.6, 6.5, 0); g.add(leg);
          const leg2 = box(0.5, 6, 0.5, '#6b6f5a'); leg2.position.set(-0.8, 12, -1); leg2.rotation.x = 1.2; g.add(leg2);
          for (const sgn of [-1, 1]) { const w = box(10, 0.4, 5, '#7f8990'); w.position.set(sgn * 5.5, 16.5, -0.5); w.visible = false; g.add(w); this.heronWings.push(w); }
          const [hx, hz] = this.marsh[0];
          this.heronAt = { x: hx, z: hz };
          g.position.set(hx, gy(hx, hz), hz);
          g.rotation.y = Math.random() * 6.28;
          scene.add(g);
          this.heron = g;
        }
      }
    }

    // 16. a snowy owl on a fence post along the refuge road, winter only
    const pl = lm('pi-light');
    if (pl && SEASON === 'winter') {
      let best: { x: number; z: number; d: number } | null = null;
      for (const r of index.world.roads) {
        if (r.c === 'service') continue;
        for (let k = 0; k + 3 < r.p.length; k += 2) {
          const ax = r.p[k], az = r.p[k + 1], bx = r.p[k + 2], bz = r.p[k + 3];
          const vx = bx - ax, vz = bz - az, l2 = vx * vx + vz * vz || 1;
          const tt = Math.max(0, Math.min(1, ((pl.x - ax) * vx + (pl.y - az) * vz) / l2));
          const qx = ax + vx * tt, qz = az + vz * tt, d = Math.hypot(qx - pl.x, qz - pl.y);
          if (d < 900 && (!best || d < best.d)) { const nl = Math.sqrt(l2); best = { x: qx - vz / nl * (r.w / 2 + 14), z: qz + vx / nl * (r.w / 2 + 14), d }; }
        }
      }
      if (best && !index.isWaterAt(best.x, best.z) && !index.isBlocked(best.x, best.z)) {
        this.owlAt = { x: best.x, z: best.z };
        const g = new THREE.Group();
        const post = box(1.4, 12, 1.4, '#6f6353'); post.position.y = 6; g.add(post);
        const body = box(3.2, 4.4, 3.0, '#f1f0ea'); body.position.y = 14.2; g.add(body);
        const headG = new THREE.Group();
        const head = box(3.0, 2.6, 2.8, '#f6f5f0'); headG.add(head);
        for (const sgn of [-1, 1]) { const eye = box(0.6, 0.6, 0.3, '#e8c531'); eye.position.set(sgn * 0.7, 0.3, 1.45); headG.add(eye); }
        headG.position.y = 17.5; g.add(headG);
        g.position.set(best.x, gy(best.x, best.z), best.z);
        scene.add(g);
        this.owl = g; this.owlHead = headG;
        this.dyn.push({ id: 'owl', x: best.x, z: best.z, label: '🦉 LOOK AT THE FENCE POST', r: 130 });
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
    if (this.fetch && this.fetch.state === 'idle' && this.fetch.cool <= 0) out.push({ id: 'fetch', x: this.fetch.x, z: this.fetch.z, label: '🎾 FETCH', r: 110 });
    if (this.seal && this.sealUp > 0) out.push({ id: 'seal', x: this.sealAt.x, z: this.sealAt.z, label: '🦭 LOOK AT THE RIVER', r: 520 });
    if (this.balloon && this.balloon.visible) out.push({ id: 'balloon', x: this.balloon.position.x, z: this.balloon.position.z, label: '🎈 LOOK UP', r: 1800 });
    if (this.ducks.length) out.push({ id: 'ducklings', x: this.duckAt.x, z: this.duckAt.z, label: '🐥 FOLLOW THE DUCKLINGS', r: 90 });
    if (this.showLeft > 0) out.push({ id: 'fireworks', x: this.showAt.x, z: this.showAt.z, label: '🎆 WATCH', r: 1700 });
    if (this.heron && this.heronFly <= 0) out.push({ id: 'heron', x: this.heronAt.x, z: this.heronAt.z, label: '🪶 QUIET NOW', r: 230 });
    if (this.diggers.length && TIDE.value < -0.8) out.push({ id: 'diggers', x: this.diggers[0].g.position.x, z: this.diggers[0].g.position.z, label: '🪣 WATCH THEM DIG', r: 110 });
    return out;
  }

  /** 🐕 a bark: the cat jumps, the seal ducks, the plovers scatter — whoever is in earshot */
  bark(px: number, pz: number) {
    if (this.cat && this.catHop <= 0 && (px - this.catAt.x) ** 2 + (pz - this.catAt.z) ** 2 < 220 * 220) { this.catHop = 0.6; this.audio.pop(); }
    if (this.seal && this.sealUp > 0 && (px - this.sealAt.x) ** 2 + (pz - this.sealAt.z) ** 2 < 500 * 500) this.sealUp = Math.min(this.sealUp, 0.6);
    if (this.plovers.length && (px - this.plovers[0].g.position.x) ** 2 + (pz - this.plovers[0].g.position.z) ** 2 < 300 * 300) this.scatterPlovers();
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
      case 'bottle': {
        const week = Math.floor(dayOfYear() / 7);
        this.host.showCard({ ...card, b: NOTES[week % NOTES.length] }, this.host.found(tag));
        if (this.bottle) { this.host.hearts(this.bottle.position.x, this.bottle.position.y + 6, this.bottle.position.z); this.scene.remove(this.bottle); this.bottle = null; }
        this.dyn = this.dyn.filter((d) => d.id !== 'bottle');
        return true;
      }
      case 'fetch':
        if (this.fetch && this.fetch.state === 'idle') { this.throwBall(); if (!this.host.found(tag)) this.host.showCard(card, true); }
        return true;
      default: this.host.showCard(card, this.host.found(tag)); return true;
    }
  }

  /** 🎾 wind up and throw the ball down the lawn */
  private throwBall() {
    const f = this.fetch;
    if (!f) return;
    f.state = 'wind'; f.t = 0;
    // the landing spot: down the lawn, a little to one side, shortened if the grass runs out
    let dist = 150 + Math.random() * 60;
    const side = (Math.random() - 0.5) * 70;
    const sx = f.dz, sz = -f.dx;
    for (; dist > 60; dist -= 20) {
      const x = f.x + f.dx * dist + sx * side, z = f.z + f.dz * dist + sz * side;
      if (!this.index.isBlocked(x, z) && !this.index.isWaterAt(x, z)) break;
    }
    const tx = f.x + f.dx * dist + sx * side, tz = f.z + f.dz * dist + sz * side;
    f.to.set(tx, this.index.heightAtPx(tx, tz) + 1.7, tz);
    f.from.set(f.x + f.dx * 4, this.index.heightAtPx(f.x, f.z) + 17, f.z + f.dz * 4);
  }

  private updateFetch(dt: number, px: number, pz: number, stillT: number) {
    const f = this.fetch;
    if (!f) return;
    // the dog's heading, from where it was a moment ago
    const mx = px - f.lastDog.x, mz = pz - f.lastDog.z;
    if (mx * mx + mz * mz > 0.5) { const l = Math.hypot(mx, mz); f.dogDir = { x: mx / l, z: mz / l }; }
    f.lastDog = { x: px, z: pz };
    const dDog2 = (px - f.x) ** 2 + (pz - f.z) ** 2;
    if (f.cool > 0) { f.cool -= dt; if (f.cool <= 0) f.throws = 0; }
    const g = this.index.heightAtPx(f.x, f.z);
    if (f.state === 'idle') {
      f.arm.rotation.x = Math.sin(this.t * 1.3) * 0.08;
      f.ball.position.set(5.2, 7.6, 1.6);
      // a dog who walks up and waits gets a throw without asking
      if (f.cool <= 0 && f.throws === 0 && dDog2 < 90 * 90 && stillT > 1.5) this.throwBall();
      return;
    }
    if (f.state === 'rest') {
      // done for now: a wave, then a breather before the next round
      f.arm.rotation.x = -2.6 + Math.sin(this.t * 6) * 0.3;
      if (f.cool <= 0) f.state = 'idle';
      return;
    }
    f.t += dt;
    if (f.state === 'wind') {
      f.arm.rotation.x = -Math.min(1, f.t / 0.45) * 2.4;   // back
      if (f.t >= 0.45) { f.state = 'fly'; f.t = 0; this.audio.pop(); f.ball.position.set(0, 0, 0); f.g.remove(f.ball); this.scene.add(f.ball); }
      return;
    }
    if (f.state === 'fly') {
      const k = Math.min(1, f.t / 1.1);
      f.arm.rotation.x = -2.4 + Math.min(1, f.t / 0.25) * 3.2;   // through
      f.ball.position.lerpVectors(f.from, f.to, k);
      f.ball.position.y += Math.sin(k * Math.PI) * 42;
      if (k >= 1) { f.state = 'ground'; f.t = 0; f.arm.rotation.x = 0; }
      return;
    }
    if (f.state === 'ground') {
      f.arm.rotation.x = Math.sin(this.t * 1.3) * 0.08;
      if ((px - f.ball.position.x) ** 2 + (pz - f.ball.position.z) ** 2 < 20 * 20) { f.state = 'carry'; this.audio.plink(); }
      return;
    }
    if (f.state === 'carry') {
      f.ball.position.set(px + f.dogDir.x * 10, this.index.heightAtPx(px, pz) + 8.5, pz + f.dogDir.z * 10);
      if (dDog2 < 44 * 44) {
        // brought back: hearts, and another throw a moment later (six a visit)
        f.throws++;
        this.host.hearts(f.x, g + 24, f.z);
        this.audio.jingle();
        f.g.add(f.ball); f.ball.position.set(5.2, 7.6, 1.6);
        if (f.throws >= 6) { f.state = 'rest'; f.cool = 150; }
        else { f.state = 'idle'; setTimeout(() => { if (this.fetch && this.fetch.state === 'idle') this.throwBall(); }, 1100); }
      }
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
    this.updateFetch(dt, px, pz, stillT);
    // the tide clock's needle: high at the top, low at the bottom, the river's own phase
    if (this.tideNeedle) this.tideNeedle.rotation.z = -(tod * Math.PI * 4 - Math.PI);
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
    // how fast the dog is going, for the seal's curiosity
    { const mx = px - this.lastPx, mz = pz - this.lastPz; this.dogSpeed = dt > 0 ? Math.hypot(mx, mz) / dt : 0; this.lastPx = px; this.lastPz = pz; }
    if (this.seal) {
      if (this.sealUp > 0) {
        this.sealUp -= dt;
        // a slow walker along the boardwalk is worth following: the seal keeps pace
        // along the shore, and stays up as long as the dog does not run, up to half a minute
        const near = (px - this.sealAt.x) ** 2 + (pz - this.sealAt.z) ** 2 < 360 * 360;
        if (near && this.dogSpeed > 4 && this.dogSpeed < 260 && this.sealFollow < 30) {   // a walk, not a sprint
          const want = px - this.sealAt.x;
          const step = Math.max(-34 * dt, Math.min(34 * dt, want));
          this.sealAt.x += step; this.seal.position.x = this.sealAt.x;
          this.sealFollow += dt;
          if (this.sealUp < 2.5) this.sealUp = 2.5;
        }
        const k = Math.min(1, (7 - Math.min(7, this.sealUp)) * 1.5 + (this.sealFollow > 0 ? 1 : 0)), fade = Math.min(1, this.sealUp * 1.5);
        this.seal.position.y = WATER_Y + TIDE.value - 9 + 10.5 * Math.min(k, fade) + Math.sin(this.t * 1.3) * 0.4;
        this.seal.rotation.y = Math.atan2(px - this.sealAt.x, pz - this.sealAt.z) - Math.PI / 2;
        if (this.sealUp <= 0) { this.seal.position.y = WATER_Y - 9; this.sealCool = 40 + Math.random() * 50; this.sealFollow = 0; }
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
        if (out) { d.g.rotation.x = 0.28 + Math.max(0, Math.sin(this.t * 1.1 + d.ph)) * 0.22; }   // bent to the rake, straightening to empty it
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
      // the hop: straight up and back down, ears back
      if (this.catHop > 0) { this.catHop -= dt; const k = Math.max(0, this.catHop / 0.6); this.cat.position.y = this.catBaseY + Math.sin(k * Math.PI) * 9; }
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

    // Yankee Homecoming: the show starts after full dark, once a night, when someone is
    // near enough to the river to see it
    if (this.seal) {
      const day = dayOfYear();
      const q = new URLSearchParams(location.search);
      const showNight = q.get('fireworks') === '1' || (day >= 206 && day <= 212) || day % 12 === 5;
      if (night < 0.5) this.showDone = false;
      if (showNight && !this.showDone && this.showLeft <= 0 && night > 0.85 && (px - this.showAt.x) ** 2 + (pz - this.showAt.z) ** 2 < 1500 * 1500) {
        this.showLeft = 95; this.showDone = true; this.showNext = 0;
      }
      if (this.showLeft > 0) {
        this.showLeft -= dt; this.showNext -= dt;
        if (this.showNext <= 0) {
          this.showNext = this.showLeft < 12 ? 0.5 : 1.6 + Math.random() * 1.6;   // the finale comes fast
          const colors = ['#ffd24a', '#e8634a', '#7ce8f4', '#9ae86a', '#d88ae8', '#f6f3e8', '#ff9a3c'];
          const x = this.showAt.x + (Math.random() - 0.5) * 600, z = this.showAt.z + (Math.random() - 0.5) * 300;
          this.host.burst(x, WATER_Y + 220 + Math.random() * 160, z, colors[Math.floor(Math.random() * colors.length)], 90, true, 7, 2.4);
        }
      }
    }

    // the heron: a lift, a slow loop, and down again farther up the marsh
    if (this.heron) {
      if (this.heronFly > 0) {
        this.heronFly -= dt;
        const k = 1 - this.heronFly / 12;
        const x = this.heronFrom.x + (this.heronTo.x - this.heronFrom.x) * k, z = this.heronFrom.z + (this.heronTo.z - this.heronFrom.z) * k;
        const gyy = this.index.heightAtPx(x, z);
        this.heron.position.set(x, gyy + Math.sin(k * Math.PI) * 70, z);
        this.heron.rotation.y = Math.atan2(this.heronTo.x - this.heronFrom.x, this.heronTo.z - this.heronFrom.z);
        const flap = Math.sin(this.t * 4.5) * 0.7;
        this.heronWings[0].rotation.z = 0.2 + flap; this.heronWings[1].rotation.z = -0.2 - flap;
        if (this.heronFly <= 0) { this.heronAt = { ...this.heronTo }; this.heron.position.y = gyy; for (const w of this.heronWings) w.visible = false; }
      } else {
        this.heron.position.y = this.index.heightAtPx(this.heronAt.x, this.heronAt.z) + Math.sin(this.t * 0.6) * 0.15;
        if ((px - this.heronAt.x) ** 2 + (pz - this.heronAt.z) ** 2 < 200 * 200 && this.marsh.length > 1) {
          let to = this.marsh[Math.floor(Math.random() * this.marsh.length)];
          for (let tries = 0; tries < 6 && Math.hypot(to[0] - this.heronAt.x, to[1] - this.heronAt.z) < 180; tries++) to = this.marsh[Math.floor(Math.random() * this.marsh.length)];
          this.heronFrom = { ...this.heronAt }; this.heronTo = { x: to[0], z: to[1] }; this.heronFly = 12;
          for (const w of this.heronWings) w.visible = true;
          this.audio.gull();
        }
      }
    }

    // the owl: a head that turns, and a bird that leaves if you press it
    if (this.owl && this.owlHead) {
      const dx = px - this.owlAt.x, dz = pz - this.owlAt.z, d2 = dx * dx + dz * dz;
      if (this.owlGone > 0) {
        this.owlGone -= dt;
        const k = Math.min(1, (60 - this.owlGone) / 6);
        this.owl.children[1].visible = this.owl.children[2].visible = k < 1;   // body and head leave; the post stays
        if (k < 1) { this.owl.children[1].position.y = 14.2 + k * 120; this.owl.children[2].position.y = 17.5 + k * 120; this.owl.children[1].position.x = this.owl.children[2].position.x = k * 260; }
        if (this.owlGone <= 0) { this.owl.children[1].position.set(0, 14.2, 0); this.owl.children[2].position.set(0, 17.5, 0); this.owl.children[1].visible = this.owl.children[2].visible = true; }
      } else {
        const want = d2 < 160 * 160 ? Math.atan2(dx, dz) - this.owl.rotation.y : 0;
        let w = want; while (w > Math.PI) w -= 2 * Math.PI; while (w < -Math.PI) w += 2 * Math.PI;
        w = Math.max(-2.4, Math.min(2.4, w));   // an owl can nearly look behind itself
        this.owlHead.rotation.y += (w - this.owlHead.rotation.y) * Math.min(1, dt * 2.5);
        if (d2 < 45 * 45) this.owlGone = 60;
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
