import * as THREE from 'three';
import { WorldIndex } from '../world/index';
import { Hud } from './hud';
import { GameAudio } from './audio';
import { WATER_Y } from '../three/water';
import { SEASON } from '../world/style';

// Easter eggs. No beacons, no glints, no objectives — the entire point is
// that nobody tells you. Every secret sits at a real place with a real story
// behind it: Dexter's statues really scattered in the 1815 gale, the Herald
// really printed sea-serpent reports in 1817, the Revere bell really hangs at
// 29 Federal Street, and all 68 backyard pools really are where they are.
// Found state persists; the travel panel keeps a quiet count once you're in
// on it. Finding everything earns the fireworks.

const FOUND_KEY = 'nbpt-eggs-found';
const FINALE_KEY = 'nbpt-eggs-finale';

type Card = { t: string; s: string; b: string };
type Cand = { tag: string; x: number; z: number; label: string; r: number };

// ---------- the scattered statues (the 1815 gale took all forty) ----------

type Statue = {
  id: string; x: number; z: number; rot: number; tilt: number;
  name: string; coat: string; hat: 'tricorn' | 'bicorne' | 'wig' | 'tall' | 'none';
  card: Card;
};

const STATUES: Statue[] = [
  {
    id: 'st-washington', x: -2806, z: -456, rot: 0.8, tilt: 0.42,
    name: 'General Washington', coat: '#5d6f88', hat: 'tricorn',
    card: {
      t: 'General Washington (Wooden)', s: 'Brown Square · one of Dexter’s forty',
      b: 'The general himself, carved in pine, propped against a wall of Brown Square like he’s waiting for the 1789 parade to come back around. The gale of 1815 blew him off his column at 201 High Street and apparently he didn’t get far.'
    }
  },
  {
    id: 'st-adams', x: -2933, z: 2823, rot: 2.4, tilt: 0.5,
    name: 'John Adams', coat: '#6e7247', hat: 'tricorn',
    card: {
      t: 'John Adams (Wooden)', s: 'Bartlet Mall · one of Dexter’s forty',
      b: 'John Adams, slightly green about the shoulders, supervising Frog Pond from the bank. He does not approve of the frogs. The frogs are unbothered.'
    }
  },
  {
    id: 'st-jefferson', x: 7150, z: 4080, rot: -0.6, tilt: 0.55,
    name: 'Thomas Jefferson', coat: '#7e3434', hat: 'tricorn',
    card: {
      t: 'Thomas Jefferson (Wooden)', s: 'Joppa · one of Dexter’s forty',
      b: 'Thomas Jefferson, up to his knees in the Joppa marsh grass. Two hundred years of low tide, and he still looks dignified. Mostly. The clammers say he can stay out there a while longer.'
    }
  },
  {
    id: 'st-napoleon', x: -5560, z: 11600, rot: 1.7, tilt: 0.38,
    name: 'Napoleon', coat: '#41526a', hat: 'bicorne',
    card: {
      t: 'Napoleon (Wooden)', s: 'Newburyport Station · one of Dexter’s forty',
      b: 'Napoleon, exiled to the very end of the train line. He has been waiting for the next train to Boston since 1815. He has opinions about the schedule.'
    }
  },
  {
    id: 'st-venus', x: 90, z: -985, rot: -2.2, tilt: 0.3,
    name: 'Venus', coat: '#d9cdb4', hat: 'none',
    card: {
      t: 'Venus (Wooden)', s: 'the boardwalk · one of Dexter’s forty',
      b: 'Venus, washed up by the boardwalk, gazing out at the Merrimack like it owes her something. The gulls have shown no respect whatsoever.'
    }
  },
  {
    id: 'st-pitt', x: -17790, z: -12350, rot: 0.3, tilt: 0.6,
    name: 'William Pitt', coat: '#944033', hat: 'wig',
    card: {
      t: 'William Pitt (Wooden)', s: 'Atkinson Common · one of Dexter’s forty',
      b: 'William Pitt, toppled among the North End trees, wig askew. Parliament has not sent help. The neighbors who keep this common planted around him out of politeness.'
    }
  },
  {
    id: 'st-dexter-e', x: 33310, z: -3380, rot: 0.1, tilt: 0.34,
    name: 'Lord Dexter', coat: '#c8a142', hat: 'tall',
    card: {
      t: '“First in the East”', s: 'Plum Island Light · one of Dexter’s forty',
      b: 'Lord Timothy Dexter himself, carved larger than life, inscribed FIRST IN THE EAST. The gale took him at his word and blew him as far east as the land goes. The lighthouse keeps an eye on him.'
    }
  },
  {
    id: 'st-dexter-w', x: -38130, z: -13300, rot: -1.1, tilt: 0.46,
    name: 'Lord Dexter', coat: '#c8a142', hat: 'tall',
    card: {
      t: '“First in the West”', s: 'Maudslay · one of Dexter’s forty',
      b: 'Lord Timothy Dexter again — FIRST IN THE WEST, says the base. There are two of him. Of course there are two of him. “The greatest philosopher in the Western World” was not going to leave the West uncovered.'
    }
  }
];

const GARDEN = { x: -7290, z: 620 }; // the lawn at 201 High Street

// ---------- fixed one-off spots ----------

type Spot = { id: string; x: number; z: number; label: string; r?: number };

const SPOTS: Spot[] = [
  { id: 'bell', x: 2617, z: 2595, label: '🔔 RING' },
  { id: 'frogs', x: -3042, z: 2733, label: '🐸 RIBBIT' },
  { id: 'fountain', x: -540, z: 640, label: '🪙 TOSS A COIN' },
  { id: 'pickle', x: -940, z: 2380, label: '📖 READ' },
  { id: 'mbta', x: -5450, z: 11790, label: '👂 LISTEN' },
  { id: 'lantern', x: 33990, z: -4400, label: '🏮 TOUCH' },
  { id: 'purple', x: 34600, z: -4250, label: '✨ SCOOP' },
  { id: 'biplane', x: 17935, z: 14141, label: '🛩 WATCH THE SKY' },
  { id: 'fowles', x: -109, z: 545, label: '💡 WAKE THE SIGN' },
  { id: 'richdale', x: -460, z: 1385, label: '🥤 SLUSHIE' },
  { id: 'gillis', x: -2421, z: -3599, label: '👀 LOOK' },
  { id: 'camp', x: -11803, z: -15581, label: '🏕 READ THE SIGN' }
];

const CARDS: Record<string, Card> = {
  pet: {
    t: 'Good Boy', s: 'Clipper · always',
    b: 'Scientific consensus: best dog on the Eastern Seaboard. This discovery counts. Pet him as often as required — and it is required.'
  },
  konami: {
    t: 'Thirty Lives', s: 'up, up, down, down…',
    b: 'The old code still works in Newburyport. No extra lives — around here you get something better: the golden hoodie. Enter it again to change back.'
  },
  xyzzy: {
    t: 'The Magic Word', s: 'Carr Island · base camp',
    b: 'A hollow voice says “plugh.”\n\nWelcome to base camp: one tent, one kettle, zero homework. The whole town you’ve been exploring was built from the real one, street by street, from right here. The developers send their regards.'
  },
  serpent: {
    t: 'Something in the Sea', s: 'August 1817',
    b: 'In August 1817, the Newburyport Herald printed the sea-serpent reports with a perfectly straight face. Half the coast swore it was real. You saw what you saw. The gulls saw it too. Ask them.'
  },
  bell: {
    t: 'The Revere Bell', s: 'Old South · 1816',
    b: 'Cast at Paul Revere’s own foundry, hanging in this steeple since 1816. It has rung for weddings, for wars, and for at least one kid who couldn’t resist. (You. Just now.)'
  },
  frogs: {
    t: 'Frog Pond, Population: Yes', s: 'named by 1645',
    b: 'This pond has been Frog Pond since before Newburyport was Newburyport. The town has changed a lot since 1645. The frogs have not. They would like you to know this is THEIR pond, and the ice skaters are guests.'
  },
  'frogs-winter': {
    t: 'Frog Pond, Population: Asleep', s: 'see you in June',
    b: 'The pond is quiet and the frogs are wintering somewhere in the mud, dreaming cold little dreams. They left a note: “ribbit in June.” It still counts.'
  },
  fountain: {
    t: 'The Fountain Accepts', s: 'Inn Street · 1975',
    b: 'When the bulldozers came for this downtown in the 1960s, Newburyport said no — and built this instead. The fountain arrived in 1975; the kids arrived immediately. Your penny joins fifty years of very small wishes, most of which came true-ish.'
  },
  pickle: {
    t: 'A Pickle for the Knowing Ones', s: 'Lord Dexter · 1802',
    b: 'Lord Dexter wrote a whole book — 8,847 words — with no punctuation at all. When readers complained, he added one page full of commas and periods, so they could “pepper and solt it as you plese.”\n\nHere is your page:\n, , , , , , ; ; ; ; : : . . . . . . ! ! ?'
  },
  mbta: {
    t: 'The Train to Boston', s: 'Newburyport Station · since 1840',
    b: '“The next train to Boston will depart… when it departs.” Some things never change. Trains have run from this spot to Boston since 1840 — steam, then diesel, then whatever is currently late.'
  },
  lantern: {
    t: 'The False Lantern', s: 'the dunes · no comment',
    b: 'Half-buried in the dune grass: an old iron lantern, cold for two hundred years. Mooncussers carried false lights on these dunes, trying to trick ships onto the sand — and cursed the bright moon that spoiled it.\n\nIt flickers, exactly once, as you touch it.\n\nNo mooncusser was ever caught. Neither was this lantern.'
  },
  purple: {
    t: 'Purple Sand', s: 'Plum Island',
    b: 'Not paint, and not a trick of the light — it is crushed garnet, a real purple gem, washed out of the dunes by the waves. This beach keeps jewels in its pockets. Now so do you.'
  },
  biplane: {
    t: 'The Flying Fish', s: 'Plum Island Airport · 1910',
    b: 'Seven years after the Wright brothers, Burgess’s biplane hopped off this very grass — the first flights in all of New England, from its oldest airfield. Some afternoons, if you ask the windsock nicely, history does a lap.'
  },
  fowles: {
    t: 'The Neon at Fowle’s', s: '17 State Street',
    b: 'This neon has glowed over State Street since Fowle’s sold newspapers and ice cream sodas. Half the town has said “meet me under the sign.” It buzzes a little when it wakes up. So does everybody.'
  },
  richdale: {
    t: 'Blue Raspberry, Large', s: 'Richdale · State Street',
    b: 'Every Newburyport kid knows the truth: the walk to Richdale for a slushie IS the activity. The flavor is blue raspberry. It is always blue raspberry. Brain freeze in three… two…'
  },
  marco: {
    t: 'Marco.', s: '68 real pools',
    b: 'Every backyard pool in this town is exactly where it really is — all sixty-eight of them. And somewhere across three fences, somebody answered.\n\nSomebody always answers.'
  },
  gillis: {
    t: 'Bossy’s Bridge', s: 'Route 1 · opens on the hour',
    b: 'Named for Andrew “Bossy” Gillis: gas-station owner and six-time mayor. He once punched the mayor, went to jail for it — and then got elected mayor himself. He ran the city from his gas station. The state named a drawbridge after him. He would have loved that.'
  }
};

const TOTAL = STATUES.length + 16; // 8 statues + the one-offs below

// the wider hunt, hinted exactly once — appended to whichever card comes first
const FIRST_HINT = '\n\nThat’s one. Newburyport keeps ' + TOTAL + ' of these — no maps, no arrows, no glowing markers. Pet the dog. Stand very still where the river meets the sea. Try old magic words in the travel search.';

// the sea serpent: watch zone covers Plum Island Point and the wadeable
// flats off it — patience closer to the channel earns a closer look
const SERPENT_ZONE = { x: 34100, z: -4800, r: 1100 };
const SERPENT_A = { x: 33900, z: -5450 };
const SERPENT_B = { x: 35600, z: -5300 };
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

// ---------- small mesh helpers (same blocky register as the rest of town) ----------

function lam(hex: string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color: hex });
}
function box(w: number, h: number, d: number, hex: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(hex));
  m.castShadow = true;
  return m;
}
function cyl(r0: number, r1: number, h: number, hex: string, seg = 10): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), lam(hex));
  m.castShadow = true;
  return m;
}
function sph(r: number, hex: string, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), lam(hex));
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}
function capsule(r: number, len: number, hex: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), lam(hex));
  m.castShadow = true;
  return m;
}

// a carved, weather-faded wooden figure — paint clinging on in places
function statueFigure(s: Statue): THREE.Group {
  const WOOD = '#8a6f4d', WOOD_D = '#73593c';
  const g = new THREE.Group();
  const base = box(7.5, 2.2, 7.5, WOOD_D);
  base.position.y = 1.1;
  g.add(base);
  const robe = cyl(2.6, 4, 9, s.coat, 8);
  robe.position.y = 6.6;
  g.add(robe);
  const chest = capsule(3.1, 4, s.coat);
  chest.position.y = 13;
  g.add(chest);
  for (const side of [-1, 1]) {
    const arm = capsule(1.1, 4.2, WOOD);
    // Venus gets one raised arm; everyone else stands at carved attention
    if (s.hat === 'none' && side === 1) {
      arm.position.set(4.6, 17.5, 0);
      arm.rotation.z = -0.7;
    } else {
      arm.position.set(side * 4.4, 13.5, 0);
      arm.rotation.z = side * 0.18;
    }
    g.add(arm);
  }
  const head = sph(2.9, WOOD);
  head.position.y = 19.6;
  g.add(head);
  if (s.hat === 'tricorn') {
    const brim = cyl(3.6, 3.6, 0.7, WOOD_D, 6);
    brim.position.y = 21.6;
    g.add(brim);
    const crown = sph(2.2, WOOD_D, 1, 0.7, 1);
    crown.position.y = 22.4;
    g.add(crown);
  } else if (s.hat === 'bicorne') {
    const bic = box(7.6, 1.6, 2.4, WOOD_D);
    bic.position.y = 22;
    bic.rotation.y = 0.3;
    g.add(bic);
  } else if (s.hat === 'wig') {
    const wig = sph(3.15, '#d8d2c2', 1.04, 0.8, 1.04);
    wig.position.y = 20.6;
    g.add(wig);
    for (const side of [-1, 1]) {
      const roll = cyl(0.9, 0.9, 3, '#d8d2c2', 6);
      roll.position.set(side * 3, 18.8, 0);
      g.add(roll);
    }
  } else if (s.hat === 'tall') {
    const top = cyl(2.1, 2.3, 4.4, '#2c2c30', 8);
    top.position.y = 23.2;
    g.add(top);
    const brim = cyl(3.4, 3.4, 0.5, '#2c2c30', 8);
    brim.position.y = 21.2;
    g.add(brim);
  } else {
    const hair = sph(3.05, WOOD_D, 1, 0.75, 1);
    hair.position.y = 20.8;
    g.add(hair);
    const bun = sph(1.2, WOOD_D);
    bun.position.set(0, 22.2, -1.6);
    g.add(bun);
  }
  return g;
}

function signBoard(big: string, small: string): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d')!;
  g.fillStyle = '#5a452e';
  g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#d8c9a2';
  g.fillRect(5, 5, 246, 86);
  g.fillStyle = '#3a2e1e';
  g.textAlign = 'center';
  g.font = '700 26px Georgia, serif';
  g.fillText(big, 128, 40);
  g.font = 'italic 600 15px Georgia, serif';
  g.fillText(small, 128, 70);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 11.25),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide })
  );
  return m;
}

function neonTexture(on: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 80;
  const g = c.getContext('2d')!;
  g.fillStyle = '#171c22';
  g.beginPath();
  g.roundRect(2, 2, 252, 76, 10);
  g.fill();
  g.strokeStyle = on ? '#e84a3c' : '#4a3633';
  g.lineWidth = 3;
  g.stroke();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'italic 700 40px Georgia, serif';
  if (on) {
    g.shadowColor = '#7ce8f4';
    g.shadowBlur = 16;
    g.fillStyle = '#bdf6fc';
  } else {
    g.fillStyle = '#3e4a50';
  }
  g.fillText('Fowle’s', 128, 42);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function heartSprite(): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  // draw the heart as a filled path, NOT the ❤ glyph: the glyph renders black on a
  // desktop canvas but a color emoji on mobile, so the color was platform-dependent.
  // A path is the same warm pink everywhere.
  g.fillStyle = '#ff5da2';
  g.beginPath();
  g.moveTo(32, 25);
  g.bezierCurveTo(32, 19, 24, 12, 16, 12);
  g.bezierCurveTo(5, 12, 5, 26, 5, 26);
  g.bezierCurveTo(5, 35, 16, 45, 32, 55);
  g.bezierCurveTo(48, 45, 59, 35, 59, 26);
  g.bezierCurveTo(59, 26, 59, 12, 48, 12);
  g.bezierCurveTo(40, 12, 32, 19, 32, 25);
  g.closePath();
  g.fill();
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
  sp.scale.set(7, 7, 1);
  return sp;
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

// ---------- the runner ----------

type Fx = (dt: number) => boolean; // false = finished, remove

export class EggRunner {
  private scene: THREE.Scene;
  private index: WorldIndex;
  private hud: Hud;
  private audio: GameAudio;
  private dogPos: () => { x: number; z: number };
  private onKonami: () => void;

  private foundSet: Set<string>;
  private t = 0;
  private nearTag: string | null = null;
  private lastP = { x: 0, z: 0 };
  private fx: Fx[] = [];

  private wildStatues = new Map<string, THREE.Group>();
  private gardenSlots = new Map<string, THREE.Group>();
  private pools: { x: number; z: number }[] = [];
  private frogs: THREE.Group[] = [];
  private frogsHome: [number, number][] = [[-3052, 2740], [-3066, 2748]];
  private frogsOut = false;
  private neonMesh: THREE.Mesh | null = null;
  private neonOn = false;
  private lanternGlass: THREE.Mesh | null = null;
  private fountainTop = { x: SPOTS[2].x, y: 0, z: SPOTS[2].z };
  private konamiAt = 0;
  private compassTaps: number[] = [];
  private stillT = 0;
  private serpentBusy = false;
  private serpentCool = 0;
  private planeBusy = false;
  private runway: number[] | null = null;

  constructor(
    scene: THREE.Scene, index: WorldIndex, hud: Hud, audio: GameAudio,
    dogPos: () => { x: number; z: number }, onKonami: () => void
  ) {
    this.scene = scene;
    this.index = index;
    this.hud = hud;
    this.audio = audio;
    this.dogPos = dogPos;
    this.onKonami = onKonami;
    try {
      this.foundSet = new Set(JSON.parse(localStorage.getItem(FOUND_KEY) || '[]'));
    } catch {
      this.foundSet = new Set();
    }

    // real pool centroids — every one of them answers
    for (const p of index.world.polys) {
      if (p.k !== 'pool') continue;
      let sx = 0, sz = 0, n = 0;
      for (let i = 0; i + 1 < p.p.length; i += 2) { sx += p.p[i]; sz += p.p[i + 1]; n++; }
      if (n) this.pools.push({ x: sx / n, z: sz / n });
    }

    // the grass runway at the real airfield, for the Flying Fish
    let bestLen = 0;
    for (const p of index.world.paths) {
      if (p.c !== 'runway') continue;
      const mid = alongPolyline(p.p, polyLen(p.p) / 2);
      if (!mid || Math.hypot(mid.x - 18452, mid.z - 13500) > 2200) continue;
      const len = polyLen(p.p);
      if (len > bestLen) { bestLen = len; this.runway = p.p; }
    }

    this.buildWorldDressing();

    // statues: the unfound wait in the wild; the found already stand at home
    for (const s of STATUES) {
      if (this.foundSet.has(s.id)) this.placeInGarden(s);
      else {
        const fig = statueFigure(s);
        fig.rotation.y = s.rot;
        fig.rotation.z = s.tilt;
        fig.position.set(s.x, index.heightAtPx(s.x, s.z) - 1.2, s.z);
        scene.add(fig);
        this.wildStatues.set(s.id, fig);
      }
    }

    // the codes: keyboard for desks, seven compass taps for thumbs
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.konamiAt = e.code === KONAMI[this.konamiAt] ? this.konamiAt + 1 : (e.code === KONAMI[0] ? 1 : 0);
      if (this.konamiAt >= KONAMI.length) {
        this.konamiAt = 0;
        this.runKonami();
      }
    });
    const compass = document.querySelector('#hud .compass') as HTMLElement | null;
    if (compass) {
      compass.style.pointerEvents = 'auto';
      compass.addEventListener('click', () => {
        const now = performance.now();
        this.compassTaps = this.compassTaps.filter((ts) => now - ts < 4000);
        this.compassTaps.push(now);
        if (this.compassTaps.length >= 7) {
          this.compassTaps = [];
          this.runKonami();
        }
      });
    }

    this.hud.setSecretCount(this.count, TOTAL);
  }

  private get count(): number {
    return this.foundSet.size;
  }

  // ---------- permanent dressing at the egg sites ----------

  private buildWorldDressing() {
    const gy = (x: number, z: number) => this.index.heightAtPx(x, z);

    // Inn Street fountain (the 1975 one, with the kids implied)
    {
      const f = SPOTS[2];
      const g = new THREE.Group();
      const basin = cyl(12, 13, 3.6, '#b3afa4', 12);
      basin.position.y = 1.8;
      g.add(basin);
      const water = new THREE.Mesh(
        new THREE.CircleGeometry(10.6, 14).rotateX(-Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: SEASON === 'winter' ? '#cfdde4' : '#7cc8e4', emissive: '#2a5a72', emissiveIntensity: 0.35 })
      );
      water.position.y = 3.2;
      g.add(water);
      const pillar = cyl(1.8, 2.4, 7, '#a8a49a', 8);
      pillar.position.y = 6.8;
      g.add(pillar);
      const bowl = cyl(4.6, 1.6, 2.2, '#b3afa4', 10);
      bowl.position.y = 10.6;
      g.add(bowl);
      const finial = sph(1.1, '#a8a49a');
      finial.position.y = 12.2;
      g.add(finial);
      g.position.set(f.x, gy(f.x, f.z), f.z);
      this.scene.add(g);
      this.fountainTop = { x: f.x, y: g.position.y + 11.5, z: f.z };
      if (SEASON !== 'winter') this.fountainSpray();
    }

    // frogs + lily pads at the real pond edge (asleep all winter)
    if (SEASON !== 'winter') {
      for (const [lx, lz] of [[-3072, 2754], [-3088, 2768], [-3060, 2775]] as const) {
        const pad = new THREE.Mesh(
          new THREE.CircleGeometry(3.2, 10).rotateX(-Math.PI / 2),
          new THREE.MeshLambertMaterial({ color: '#4a7a34' })
        );
        pad.position.set(lx, gy(lx, lz) + 0.45, lz);
        this.scene.add(pad);
      }
      for (let i = 0; i < 2; i++) {
        const frog = this.buildFrog();
        const [fx, fz] = this.frogsHome[i];
        frog.position.set(fx, gy(fx, fz), fz);
        frog.rotation.y = 2.4 + i;
        this.scene.add(frog);
        this.frogs.push(frog);
      }
    }

    // the mooncusser's lantern, half-buried in the dune grass
    {
      const s = SPOTS[5];
      const g = new THREE.Group();
      const body = box(3.2, 4.4, 3.2, '#6e4a34');
      body.position.y = 1.4;
      body.rotation.z = 0.5;
      g.add(body);
      this.lanternGlass = new THREE.Mesh(
        new THREE.BoxGeometry(2.1, 2.6, 2.1),
        new THREE.MeshLambertMaterial({ color: '#b8a684', emissive: '#ffd9a0', emissiveIntensity: 0 })
      );
      this.lanternGlass.position.set(0.4, 1.7, 0);
      this.lanternGlass.rotation.z = 0.5;
      g.add(this.lanternGlass);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.3, 6, 10), lam('#56423a'));
      ring.position.set(-1.4, 3.6, 0);
      g.add(ring);
      g.position.set(s.x, gy(s.x, s.z) - 0.6, s.z);
      this.scene.add(g);
    }

    // purple garnet streak on the beach
    {
      const s = SPOTS[6];
      const patch = new THREE.Mesh(
        new THREE.CircleGeometry(8, 16).rotateX(-Math.PI / 2),
        new THREE.MeshLambertMaterial({ color: '#8e5a9e', transparent: true, opacity: 0.75 })
      );
      patch.scale.x = 1.9;
      patch.rotation.y = 0.6;
      patch.position.set(s.x, gy(s.x, s.z) + 0.4, s.z);
      this.scene.add(patch);
    }

    // windsock at the grass field
    {
      const s = SPOTS[7];
      const g = new THREE.Group();
      const pole = cyl(0.5, 0.5, 26, '#d8d5cc', 6);
      pole.position.y = 13;
      g.add(pole);
      const sock = cyl(2.2, 0.9, 9, '#e07a28', 8);
      sock.rotation.z = Math.PI / 2 - 0.18;
      sock.position.set(5.4, 24.5, 0);
      g.add(sock);
      g.position.set(s.x, gy(s.x, s.z), s.z);
      this.scene.add(g);
    }

    // Fowle's neon, dark until somebody wakes it
    {
      const s = SPOTS[8];
      this.neonMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 10.6),
        new THREE.MeshBasicMaterial({ map: neonTexture(false), transparent: true, side: THREE.DoubleSide })
      );
      this.neonMesh.position.set(s.x, gy(s.x, s.z) + 33, s.z - 4);
      this.scene.add(this.neonMesh);
    }

    // the pickle of a book, abandoned on the library lawn since 1802 (ish)
    {
      const s = SPOTS[3];
      const g = new THREE.Group();
      const cover = box(6.4, 1.5, 4.8, '#7a3a2e');
      cover.position.y = 0.75;
      cover.rotation.y = 0.5;
      g.add(cover);
      const pages = box(5.8, 0.9, 4.2, '#e6dcc0');
      pages.position.y = 1.55;
      pages.rotation.y = 0.5;
      g.add(pages);
      g.position.set(s.x, gy(s.x, s.z), s.z);
      this.scene.add(g);
    }

    // station PA post
    {
      const s = SPOTS[4];
      const g = new THREE.Group();
      const pole = cyl(0.7, 0.7, 21, '#3a3c40', 6);
      pole.position.y = 10.5;
      g.add(pole);
      const horn = box(3.4, 2.6, 3, '#5b5e66');
      horn.position.set(0, 20, 1.4);
      horn.rotation.x = 0.5;
      g.add(horn);
      g.position.set(s.x, gy(s.x, s.z), s.z);
      this.scene.add(g);
    }

    // base camp on Carr Island — where this game gets made
    {
      const c = SPOTS[11];
      const g = new THREE.Group();
      const gy0 = gy(c.x, c.z);
      // tent
      for (const side of [-1, 1]) {
        const panel = box(0.8, 14, 16, '#c8703e');
        panel.rotation.z = side * 0.82;
        panel.position.set(side * 4.6, 5.4, 0);
        g.add(panel);
      }
      const back = box(9, 9, 0.8, '#a85a30');
      back.position.set(0, 4.2, -7.6);
      g.add(back);
      // fire ring + flame
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const stone = sph(1.3, '#8a8a84', 1, 0.7, 1);
        stone.position.set(16 + Math.cos(a) * 3.4, 0.7, 6 + Math.sin(a) * 3.4);
        g.add(stone);
      }
      const flame = new THREE.Mesh(new THREE.ConeGeometry(1.7, 4.6, 7), new THREE.MeshBasicMaterial({ color: '#ffb24a' }));
      flame.position.set(16, 2.6, 6);
      g.add(flame);
      this.fx.push((dt) => {
        void dt;
        flame.scale.y = 0.85 + Math.sin(this.t * 9) * 0.2;
        flame.scale.x = 0.9 + Math.sin(this.t * 13.7) * 0.12;
        return true; // the campfire never goes out
      });
      // log bench + kettle
      const log = cyl(1.6, 1.6, 12, '#6e5538', 8);
      log.rotation.z = Math.PI / 2;
      log.position.set(16, 1.6, 13);
      g.add(log);
      const kettle = sph(1.5, '#3a3c40', 1, 0.85, 1);
      kettle.position.set(13.4, 1.2, 6.2);
      g.add(kettle);
      // the sign
      const post = box(1.1, 14, 1.1, '#5a452e');
      post.position.set(-12, 7, 8);
      g.add(post);
      const boardMesh = signBoard('BASE CAMP', 'you said the magic word');
      boardMesh.position.set(-12, 12.5, 8.7);
      boardMesh.rotation.y = 0.2;
      g.add(boardMesh);
      // pennant
      const flagPole = cyl(0.4, 0.4, 22, '#d8d5cc', 6);
      flagPole.position.set(0, 11, 9);
      g.add(flagPole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(7, 4), new THREE.MeshBasicMaterial({ color: '#d8b94a', side: THREE.DoubleSide }));
      flag.position.set(3.5, 20, 9);
      g.add(flag);
      g.position.set(c.x, gy0, c.z);
      this.scene.add(g);
    }
  }

  private buildFrog(): THREE.Group {
    const g = new THREE.Group();
    const body = sph(2.1, '#5a8a3c', 1.15, 0.8, 1.25);
    body.position.y = 1.6;
    g.add(body);
    for (const side of [-1, 1]) {
      const eye = sph(0.75, '#e8f0d8');
      eye.position.set(side * 1.05, 3.1, 1.4);
      g.add(eye);
      const pupil = sph(0.34, '#23201c');
      pupil.position.set(side * 1.05, 3.2, 2);
      g.add(pupil);
      const leg = sph(0.95, '#4a7430', 1.4, 0.6, 1);
      leg.position.set(side * 2, 0.8, -0.6);
      g.add(leg);
    }
    return g;
  }

  // ---------- shared FX ----------

  private burst(x: number, y: number, z: number, hex: string, n = 50, withPop = true, size = 3.4, lifeMax = 1.7) {
    const pos = new Float32Array(n * 3);
    const vel: number[] = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const b = Math.random() * Math.PI - Math.PI / 2;
      const sp = 60 + Math.random() * 110;
      vel.push(Math.cos(a) * Math.cos(b) * sp, Math.sin(b) * sp + 30, Math.sin(a) * Math.cos(b) * sp);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: hex, size, transparent: true, opacity: 1, depthWrite: false });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    if (withPop) this.audio.pop();
    let life = 0;
    this.fx.push((dt) => {
      life += dt;
      const a = geo.getAttribute('position') as THREE.BufferAttribute;
      const arr = a.array as Float32Array;
      for (let i = 0; i < n; i++) {
        vel[i * 3 + 1] -= 60 * dt;
        arr[i * 3] += vel[i * 3] * dt;
        arr[i * 3 + 1] += vel[i * 3 + 1] * dt;
        arr[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      a.needsUpdate = true;
      // flash big, then settle and fade
      mat.size = size * (life < 0.18 ? 1.8 : 1);
      mat.opacity = Math.max(0, 1 - life / lifeMax);
      if (life > lifeMax) {
        this.scene.remove(pts);
        geo.dispose();
        mat.dispose();
        return false;
      }
      return true;
    });
  }

  private fountainSpray() {
    const N = 26;
    const pos = new Float32Array(N * 3);
    const seed: number[] = [];
    for (let i = 0; i < N; i++) seed.push(Math.random());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#cfe9f4', size: 1.8, transparent: true, opacity: 0.8, depthWrite: false }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.fx.push((dt) => {
      void dt;
      const a = geo.getAttribute('position') as THREE.BufferAttribute;
      const arr = a.array as Float32Array;
      for (let i = 0; i < N; i++) {
        const k = (this.t * 0.9 + seed[i]) % 1;
        const ang = seed[i] * Math.PI * 2;
        arr[i * 3] = this.fountainTop.x + Math.cos(ang) * k * 6.5;
        arr[i * 3 + 1] = this.fountainTop.y + Math.sin(k * Math.PI) * 7 - k * 1.5;
        arr[i * 3 + 2] = this.fountainTop.z + Math.sin(ang) * k * 6.5;
      }
      a.needsUpdate = true;
      return true; // runs for the whole session, 26 points is free
    });
  }

  private hearts(x: number, y: number, z: number) {
    for (let i = 0; i < 3; i++) {
      const sp = heartSprite();
      sp.position.set(x + (i - 1) * 4, y + i * 1.5, z);
      this.scene.add(sp);
      let life = -i * 0.16;
      this.fx.push((dt) => {
        life += dt;
        if (life < 0) return true;
        sp.position.y += dt * 11;
        sp.material.opacity = Math.max(0, 1 - life / 1.1);
        if (life > 1.1) {
          this.scene.remove(sp);
          sp.material.map?.dispose();
          sp.material.dispose();
          return false;
        }
        return true;
      });
    }
  }

  // ---------- found bookkeeping ----------

  private found(id: string): boolean {
    if (this.foundSet.has(id)) return false;
    this.foundSet.add(id);
    localStorage.setItem(FOUND_KEY, JSON.stringify([...this.foundSet]));
    this.audio.secret();
    this.hud.setSecretCount(this.count, TOTAL);
    if (this.count >= TOTAL && !localStorage.getItem(FINALE_KEY)) {
      localStorage.setItem(FINALE_KEY, '1');
      setTimeout(() => this.finale(), 1800);
    }
    return true;
  }

  // open the card; appends the one-time "there are more" hint on the very first find
  private showCard(c: Card, isNew: boolean) {
    let body = c.b;
    if (isNew && this.count === 1) body += FIRST_HINT;
    this.audio.paper();
    this.hud.historyCard(c.t, c.s, body, '✦ SECRET · ' + this.count + '/' + TOTAL);
  }

  private finale() {
    this.hud.chapterCard('EVERY SECRET FOUND', 'Town Legend', 'Newburyport showed you everything. Almost.');
    const colors = ['#ffd24a', '#e8634a', '#7ce8f4', '#9ae86a', '#d88ae8', '#f6f3e8'];
    const px = this.lastP.x, pz = this.lastP.z;
    const gy = this.index.heightAtPx(px, pz);
    // low and ahead, where the tilted chase camera actually looks
    for (let i = 0; i < 14; i++) {
      setTimeout(() => {
        this.burst(
          px + (Math.random() - 0.5) * 760,
          gy + 150 + Math.random() * 130,
          pz - 480 - Math.random() * 320,
          colors[i % colors.length],
          90, true, 7, 2.3
        );
      }, 400 + i * 750 + Math.random() * 300);
    }
  }

  // ---------- the statues ----------

  private placeInGarden(s: Statue) {
    if (this.gardenSlots.has(s.id)) return;
    const idx = STATUES.findIndex((q) => q.id === s.id);
    const col = idx % 4, row = Math.floor(idx / 4);
    const x = GARDEN.x + (col - 1.5) * 44;
    const z = GARDEN.z + row * 46;
    const g = new THREE.Group();
    const column = cyl(2.7, 3.3, 26, '#f0ece0', 10);
    column.position.y = 13;
    g.add(column);
    const capTop = box(7.5, 1.6, 7.5, '#f0ece0');
    capTop.position.y = 26.8;
    g.add(capTop);
    const fig = statueFigure(s);
    fig.position.y = 27.6;
    g.add(fig);
    g.position.set(x, this.index.heightAtPx(x, z), z);
    g.rotation.y = 0; // proclaiming southward over the garden, as Dexter would insist
    this.scene.add(g);
    this.gardenSlots.set(s.id, g);
  }

  private recoverStatue(s: Statue) {
    const wild = this.wildStatues.get(s.id);
    if (wild) {
      this.scene.remove(wild);
      this.wildStatues.delete(s.id);
    }
    this.found(s.id);
    this.placeInGarden(s);
    const got = STATUES.filter((q) => this.foundSet.has(q.id)).length;
    const card: Card = {
      t: s.card.t, s: s.card.s,
      b: s.card.b + '\n\n' + (got >= STATUES.length
        ? 'That’s all eight. The garden at 201 High Street is whole again.'
        : got + '/8 recovered — they return to the garden at 201 High Street.')
    };
    this.showCard(card, true);
    if (got >= STATUES.length) {
      setTimeout(() => {
        this.audio.jingle();
        this.hud.chapterCard('THE GARDEN RESTORED', 'Dexter’s statues stand again', '201 High Street · the philosopher approves');
      }, 2600);
    }
  }

  // ---------- the set pieces ----------

  private runKonami() {
    this.onKonami();
    const isNew = this.found('konami');
    if (!isNew) this.audio.secret();
    if (isNew) this.showCard(CARDS.konami, true);
  }

  // search-panel magic words; Game prepends these to the results
  searchEntries(q: string): { label: string; sub: string; x: number; y: number; egg: string }[] {
    const s = q.trim().toLowerCase();
    if (s === 'xyzzy' || s === 'plugh') {
      const c = SPOTS[11];
      return [{ label: '???', sub: 'a hollow voice echoes', x: c.x, y: c.z, egg: 'xyzzy' }];
    }
    return [];
  }

  // called by Game when a magic search result is picked (after the teleport)
  creditSearch(egg: string) {
    if (egg !== 'xyzzy') return;
    const isNew = this.found('xyzzy');
    setTimeout(() => this.showCard(CARDS.xyzzy, isNew), 450);
  }

  private runSerpent() {
    this.serpentBusy = true;
    this.serpentCool = this.t + 90;
    const g = new THREE.Group();
    const hide = '#3a8a6a', belly = '#56a880';
    const head = new THREE.Group();
    const skull = sph(9, hide, 1, 0.9, 1.4);
    skull.position.y = 3;
    head.add(skull);
    const snout = sph(4.6, belly, 1, 0.7, 1.4);
    snout.position.set(0, 1, 10.5);
    head.add(snout);
    for (const side of [-1, 1]) {
      const eye = sph(1.5, '#ffd24a');
      eye.position.set(side * 4.4, 6.4, 5.6);
      head.add(eye);
      const horn = cyl(0.6, 1.8, 6.5, hide, 6);
      horn.position.set(side * 3.4, 10, -1.4);
      horn.rotation.z = side * -0.4;
      head.add(horn);
    }
    g.add(head);
    const humps: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const hump = sph(9.6 - i * 1.1, hide, 1, 0.85, 1.3);
      g.add(hump);
      humps.push(hump);
    }
    // white wakes so the silhouette reads against open water from the beach
    const wakes: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const wake = new THREE.Mesh(
        new THREE.CircleGeometry(11 - i, 12).rotateX(-Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: '#dff0f4', transparent: true, opacity: 0.45, depthWrite: false })
      );
      wake.scale.z = 1.6;
      g.add(wake);
      wakes.push(wake);
    }
    this.scene.add(g);
    this.audio.moan();
    const dur = 17;
    let life = 0;
    let moaned = false;
    const ax = SERPENT_A.x, az = SERPENT_A.z;
    const bx = SERPENT_B.x, bz = SERPENT_B.z;
    this.fx.push((dt) => {
      life += dt;
      const k = life / dur;
      if (!moaned && k > 0.55) {
        moaned = true;
        this.audio.moan();
      }
      // surfacing envelope: rise, swim, dive
      const surf = k < 0.16 ? k / 0.16 : k > 0.82 ? Math.max(0, 1 - (k - 0.82) / 0.16) : 1;
      const baseY = WATER_Y - 26 + surf * 26;
      const place = (m: THREE.Object3D, kk: number, i: number) => {
        const cx = ax + (bx - ax) * kk;
        const cz = az + (bz - az) * kk;
        m.position.set(cx, baseY + Math.sin(this.t * 2.1 + i * 1.7) * 2.6 - i * 0.4, cz);
      };
      place(head, k, 0);
      head.lookAt(bx, baseY, bz);
      for (let i = 0; i < humps.length; i++) place(humps[i], Math.max(0, k - (i + 1) * 0.022), i + 1);
      // wakes ride the surface above each segment
      for (let i = 0; i < wakes.length; i++) {
        const kk = Math.max(0, k - i * 0.022);
        wakes[i].position.set(ax + (bx - ax) * kk, WATER_Y + 0.4, az + (bz - az) * kk);
        (wakes[i].material as THREE.MeshBasicMaterial).opacity = 0.5 * surf;
      }
      if (life > dur) {
        this.scene.remove(g);
        this.serpentBusy = false;
        const isNew = this.found('serpent');
        this.showCard(CARDS.serpent, isNew);
        return false;
      }
      return true;
    });
  }

  private runBiplane() {
    if (this.planeBusy) return;
    this.planeBusy = true;
    // the airplane — yellow Burgess "Flying Fish" at true scale: ~14 m of
    // wingspan (112 px), big enough to feel like an aircraft, not a gull
    const plane = new THREE.Group();
    const fuse = new THREE.Mesh(new THREE.CapsuleGeometry(4.4, 38, 4, 10).rotateX(Math.PI / 2), lam('#c8b04a'));
    fuse.castShadow = true;
    plane.add(fuse);
    for (const y of [3, 16]) {
      const wing = box(108, 2.2, 17, '#e6dcc0');
      wing.position.set(0, y, 5);
      plane.add(wing);
    }
    for (const sx of [-38, -14, 14, 38]) {
      for (const sz of [-2, 12]) {
        const strut = box(1.4, 11, 1.4, '#6e5538');
        strut.position.set(sx, 9.5, sz);
        plane.add(strut);
      }
    }
    const tail = box(30, 1.8, 11, '#e6dcc0');
    tail.position.set(0, 5, -29);
    plane.add(tail);
    const fin = box(1.8, 12, 10, '#c8b04a');
    fin.position.set(0, 10, -29);
    plane.add(fin);
    const prop = box(2.2, 26, 1.6, '#3a2e1e');
    prop.position.set(0, 1.5, 28);
    plane.add(prop);
    for (const sx of [-8.5, 8.5]) {
      const wheel = cyl(4.2, 4.2, 2.6, '#23241f', 10);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, -8.5, 7);
      plane.add(wheel);
    }
    this.scene.add(plane);

    // waypoints: ground roll down the real runway, climb out, one lap over
    // the windsock, then off toward the sea
    const sock = SPOTS[7];
    const wp: [number, number, number][] = [];
    const gy = (x: number, z: number) => this.index.heightAtPx(x, z);
    if (this.runway) {
      // roll only the stretch of real runway that passes the windsock, so the
      // liftoff happens right in front of whoever asked for it
      const len = polyLen(this.runway);
      let tSock = len * 0.5, bd = Infinity;
      for (let t = 0; t <= len; t += 60) {
        const p = alongPolyline(this.runway, t);
        if (!p) continue;
        const d = Math.hypot(p.x - sock.x, p.z - sock.z);
        if (d < bd) { bd = d; tSock = t; }
      }
      const t0 = Math.max(0, tSock - 320);
      const t1 = Math.min(len, tSock + 1100);
      const n = Math.max(6, Math.floor((t1 - t0) / 90));
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        const p = alongPolyline(this.runway, t0 + (t1 - t0) * k);
        if (!p) continue;
        const lift = Math.max(0, (k - 0.62) / 0.38);
        wp.push([p.x, gy(p.x, p.z) + 11 + lift * lift * 130, p.z]);
      }
    } else {
      for (let i = 0; i <= 8; i++) {
        const k = i / 8;
        const x = sock.x - 700 + k * 1400;
        wp.push([x, gy(x, sock.z) + 11 + Math.max(0, (k - 0.6) / 0.4) ** 2 * 130, sock.z]);
      }
    }
    const last = wp[wp.length - 1];
    const climbA = Math.atan2(last[0] - wp[0][0], last[2] - wp[0][2]);
    wp.push([last[0] + Math.sin(climbA) * 500, last[1] + 60, last[2] + Math.cos(climbA) * 500]);
    const sockY = gy(sock.x, sock.z);
    // the lap stays low — a barnstormer pass the tilted chase camera can
    // actually see (it crops the sky above ~250 px of altitude)
    for (let i = 0; i <= 13; i++) {
      const a = climbA + Math.PI / 2 + (i / 13) * Math.PI * 2.1;
      wp.push([sock.x + Math.cos(a) * 560, sockY + 185 + Math.sin(i * 0.9) * 22, sock.z + Math.sin(a) * 560]);
    }
    const out = wp[wp.length - 1];
    wp.push([out[0] + 800, out[1] + 170, out[2] - 1200]);
    wp.push([out[0] + 1700, out[1] + 330, out[2] - 2700]);

    const segLen: number[] = [0];
    for (let i = 1; i < wp.length; i++) {
      segLen.push(segLen[i - 1] + Math.hypot(wp[i][0] - wp[i - 1][0], wp[i][1] - wp[i - 1][1], wp[i][2] - wp[i - 1][2]));
    }
    const total = segLen[segLen.length - 1];
    this.audio.putter(Math.min(22, total / 300 + 5));
    let dist = 0;
    let prevHead = climbA;
    this.fx.push((dt) => {
      prop.rotation.z += dt * 38;
      const speed = 150 + Math.min(1, dist / 900) * 160;
      dist += speed * dt;
      if (dist >= total) {
        this.scene.remove(plane);
        this.planeBusy = false;
        const isNew = this.found('biplane');
        this.showCard(CARDS.biplane, isNew);
        return false;
      }
      let i = 1;
      while (i < segLen.length - 1 && segLen[i] < dist) i++;
      const k = (dist - segLen[i - 1]) / Math.max(0.001, segLen[i] - segLen[i - 1]);
      const x = wp[i - 1][0] + (wp[i][0] - wp[i - 1][0]) * k;
      const y = wp[i - 1][1] + (wp[i][1] - wp[i - 1][1]) * k;
      const z = wp[i - 1][2] + (wp[i][2] - wp[i - 1][2]) * k;
      plane.position.set(x, y, z);
      const head = Math.atan2(wp[i][0] - wp[i - 1][0], wp[i][2] - wp[i - 1][2]);
      let dh = head - prevHead;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      prevHead = head;
      plane.rotation.y = head;
      plane.rotation.z = THREE.MathUtils.clamp(plane.rotation.z + (THREE.MathUtils.clamp(-dh * 14, -0.5, 0.5) - plane.rotation.z) * Math.min(1, dt * 3), -0.6, 0.6);
      const climb = (wp[i][1] - wp[i - 1][1]) / Math.max(1, segLen[i] - segLen[i - 1]);
      plane.rotation.x = -climb * 0.8;
      return true;
    });
  }

  private tossCoin(px: number, pz: number) {
    const f = this.fountainTop;
    const coin = cyl(1, 1, 0.34, '#e8c44f', 8);
    coin.position.set(px, this.index.heightAtPx(px, pz) + 14, pz);
    this.scene.add(coin);
    const from = { x: px, y: coin.position.y, z: pz };
    let k = 0;
    this.fx.push((dt) => {
      k += dt / 0.6;
      if (k >= 1) {
        this.scene.remove(coin);
        this.audio.plink();
        if (SEASON !== 'winter') this.burst(f.x, f.y - 8, f.z, '#cfe9f4', 10, false);
        return false;
      }
      coin.position.set(
        from.x + (f.x - from.x) * k,
        from.y + (f.y - 8 - from.y) * k + Math.sin(Math.PI * k) * 13,
        from.z + (f.z - from.z) * k
      );
      coin.rotation.x += dt * 14;
      return true;
    });
  }

  private hopFrogs() {
    if (this.frogsOut || !this.frogs.length) return;
    this.frogsOut = true;
    this.audio.croak(3);
    const pads: [number, number][] = [[-3072, 2754], [-3088, 2768]];
    this.frogs.forEach((frog, i) => {
      const [tx, tz] = pads[i % pads.length];
      const from = { x: frog.position.x, y: frog.position.y, z: frog.position.z };
      const toY = this.index.heightAtPx(tx, tz) + 0.65;
      let k = 0;
      this.fx.push((dt) => {
        k += dt / 0.7;
        if (k >= 1) {
          frog.position.set(tx, toY, tz);
          this.audio.plink();
          return false;
        }
        frog.position.set(
          from.x + (tx - from.x) * k,
          from.y + (toY - from.y) * k + Math.sin(Math.PI * k) * 9,
          from.z + (tz - from.z) * k
        );
        frog.rotation.y = Math.atan2(tx - from.x, tz - from.z);
        return true;
      });
    });
    // they reclaim the bank once you've moved along
    setTimeout(() => {
      this.frogs.forEach((frog, i) => {
        const [hx, hz] = this.frogsHome[i];
        frog.position.set(hx, this.index.heightAtPx(hx, hz), hz);
        frog.rotation.y = 2.4 + i;
      });
      this.frogsOut = false;
    }, 30000);
  }

  private wakeNeon() {
    if (!this.neonMesh) return;
    const mat = this.neonMesh.material as THREE.MeshBasicMaterial;
    if (!this.neonOn) {
      this.neonOn = true;
      this.audio.buzz();
      const onTex = neonTexture(true);
      let life = 0;
      this.fx.push((dt) => {
        life += dt;
        // stutter: off-on-off-on-ON over the first half second
        const on = life > 0.5 || (life % 0.18) > 0.08;
        if (on && mat.map !== onTex) { mat.map = onTex; mat.needsUpdate = true; }
        if (!on && mat.map === onTex) { mat.map = neonTexture(false); mat.needsUpdate = true; }
        return life <= 0.55;
      });
    } else {
      this.audio.buzz();
    }
  }

  private flickerLantern() {
    if (!this.lanternGlass) return;
    const mat = this.lanternGlass.material as THREE.MeshLambertMaterial;
    let life = 0;
    this.fx.push((dt) => {
      life += dt;
      mat.emissiveIntensity = Math.max(0, Math.sin(Math.min(1, life / 1.1) * Math.PI)) * 0.95;
      return life <= 1.15;
    });
  }

  // ---------- per-frame ----------

  private candidates(px: number, pz: number): Cand | null {
    let best: Cand | null = null;
    let bd = Infinity;
    const consider = (tag: string, x: number, z: number, label: string, r: number) => {
      const d = Math.hypot(px - x, pz - z);
      if (d < r && d < bd) { bd = d; best = { tag, x, z, label, r }; }
    };
    for (const s of SPOTS) consider(s.id, s.x, s.z, s.label, s.r ?? 56);
    for (const s of STATUES) {
      if (!this.foundSet.has(s.id)) consider(s.id, s.x, s.z, '🗿 RECOVER', 58);
    }
    for (const p of this.pools) consider('marco', p.x, p.z, '💬 MARCO', 62);
    // Petting Clipper is no longer a context action — it used to hog the action
    // button the whole time (he heels right next to you). Tap the dog to pet him.
    return best;
  }

  /** Pet Clipper: bark, pink hearts, and the one-time secret card. Triggered by
   *  tapping the dog directly (see Game.tryPetTap), not a persistent button. */
  petDog() {
    if (this.hud.dialogueOpen) return;
    this.audio.bark();
    const d = this.dogPos();
    this.hearts(d.x, this.index.heightAtPx(d.x, d.z) + 16, d.z);
    if (this.found('pet')) this.showCard(CARDS.pet, true);
  }

  update(dt: number, px: number, pz: number, suppressed: boolean) {
    this.t += dt;
    for (let i = this.fx.length - 1; i >= 0; i--) {
      if (!this.fx[i](dt)) this.fx.splice(i, 1);
    }

    // the serpent rewards patience at the river mouth
    const moved = Math.hypot(px - this.lastP.x, pz - this.lastP.z) > 1.5;
    this.stillT = moved ? 0 : this.stillT + dt;
    this.lastP = { x: px, z: pz };
    if (!this.serpentBusy && this.t > this.serpentCool && this.stillT > 10
      && Math.hypot(px - SERPENT_ZONE.x, pz - SERPENT_ZONE.z) < SERPENT_ZONE.r) {
      this.runSerpent();
    }

    // idle frog breathing
    for (const frog of this.frogs) {
      frog.scale.y = 1 + Math.sin(this.t * 3.1 + frog.position.x) * 0.06;
    }

    if (this.hud.dialogueOpen) {
      if (this.nearTag) { this.nearTag = null; this.hud.showTalk(null); }
      return;
    }
    if (suppressed) {
      // the quest/history owns the button this frame — drop our claim WITHOUT
      // hiding it, or we'd clobber the TALK they just set (the old bug: PET is
      // up, you reach an NPC, eggs clears the fresh TALK → you had to walk away
      // and back for it to reappear).
      this.nearTag = null;
      return;
    }
    const near = this.candidates(px, pz);
    if ((near && near.tag) !== this.nearTag) {
      this.nearTag = near ? near.tag : null;
      this.hud.showTalk(near ? near.label : null, () => this.tryInteract(this.lastP.x, this.lastP.z));
    }
  }

  tryInteract(px: number, pz: number) {
    if (this.hud.dialogueOpen) return;
    const it = this.candidates(px, pz);
    if (!it) return;
    this.hud.showTalk(null);
    this.nearTag = null;
    const statue = STATUES.find((s) => s.id === it.tag);
    if (statue) {
      this.recoverStatue(statue);
      return;
    }
    switch (it.tag) {
      case 'bell': {
        this.audio.toll(2);
        this.showCard(CARDS.bell, this.found('bell'));
        break;
      }
      case 'frogs': {
        if (SEASON === 'winter') {
          this.showCard(CARDS['frogs-winter'], this.found('frogs'));
        } else {
          this.hopFrogs();
          this.showCard(CARDS.frogs, this.found('frogs'));
        }
        break;
      }
      case 'fountain': {
        this.tossCoin(px, pz);
        const isNew = this.found('fountain');
        if (isNew) setTimeout(() => this.showCard(CARDS.fountain, true), 750);
        break;
      }
      case 'pickle': {
        this.hud.showDialogue([
          { who: 'a small battered book', text: '“To mankind at Large the time is Com at Last the grat day of Regoicing what is that why I will tell you thouse three kings is Rased Rased you say how so…”' },
          { who: '', text: 'You turn the page. You turn another. There is no punctuation. Anywhere. In the entire book.' }
        ], () => this.showCard(CARDS.pickle, this.found('pickle')));
        break;
      }
      case 'mbta': {
        this.audio.pa();
        this.showCard(CARDS.mbta, this.found('mbta'));
        break;
      }
      case 'lantern': {
        this.flickerLantern();
        this.audio.buzz();
        this.showCard(CARDS.lantern, this.found('lantern'));
        break;
      }
      case 'purple': {
        const s = SPOTS[6];
        this.burst(s.x, this.index.heightAtPx(s.x, s.z) + 4, s.z, '#b07ec4', 16, false);
        this.audio.paper();
        this.showCard(CARDS.purple, this.found('purple'));
        break;
      }
      case 'biplane': {
        if (!this.planeBusy) this.runBiplane();
        break;
      }
      case 'fowles': {
        const first = !this.neonOn;
        this.wakeNeon();
        if (first) this.showCard(CARDS.fowles, this.found('fowles'));
        break;
      }
      case 'richdale': {
        this.hud.showDialogue([
          { who: '', text: 'One large blue raspberry. It is extremely blue.' },
          { who: 'You', text: 'Brain freeze in three… two…' }
        ], () => this.showCard(CARDS.richdale, this.found('richdale')));
        break;
      }
      case 'marco': {
        const isNew = !this.foundSet.has('marco');
        this.hud.showDialogue([
          { who: 'You', text: 'MARCO.' },
          { who: '', text: '…somewhere across three fences, faint but certain: “polo.”' }
        ], () => {
          if (isNew) this.showCard(CARDS.marco, this.found('marco'));
        });
        setTimeout(() => this.audio.polo(), 500);
        break;
      }
      case 'gillis': {
        this.audio.horn();
        this.showCard(CARDS.gillis, this.found('gillis'));
        break;
      }
      case 'camp': {
        this.showCard(CARDS.xyzzy, this.found('xyzzy'));
        break;
      }
    }
  }
}
