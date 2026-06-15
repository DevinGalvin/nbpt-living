import * as THREE from 'three';
import { WorldIndex } from '../world/index';
import { Hud } from './hud';
import { GameAudio } from './audio';
import { ITEMS, EMOJI_TO_ID, type BagItem, type Mission } from './items';

// Chapter 1 — "Overdue" (the player-facing first chapter; its save key is the
// legacy "nbpt-ch0-step"). Gram's errand: get donuts + return the overdue book,
// report back to Gram, then Clipper finds the grate behind the Firehouse. The
// QuestRunner owns quest NPCs, the objective beacon, dialogue flow, and persistence.

type Line = { who: string; text: string };

const SAVE_KEY = 'nbpt-ch0-step';

// world-px anchors (verified against world.json / in-game)
const GRAM = { x: -48, z: 4, face: 0.9 };
const DONUT = { x: -608, z: 756, face: 0.78 };
const LIB = { x: -872, z: 2312, face: 1.57 };  // at the library's State St entrance
const GRATE = { x: -331, z: -552 };

// Chapter 4 "Low Water" + Chapter 5 "The Custom House Star" anchors (world-px)
const BOAT = { x: 3465, z: -178 };     // the rowboat on the bank, past the Coast Guard station
const WDOOR = { x: -224, z: -1183 };   // the waterline door below the seawall (Wharf Rats' den)
const KEEPER = { x: 1087, z: -500 };   // the Custom House keeper
const CELLAR = { x: 986, z: -438 };    // the Custom House cellar — the star room
const BELL_CG = { x: 3030, z: 75 };    // harbor bell by the Coast Guard station
const BELL_WHARF = { x: 40, z: -905 }; // harbor bell at the wharf

const GRAM_TALK: Line[] = [
  { who: 'Gram', text: 'There you are. Two jobs today. Take Clipper, the dog — he’s in charge.' },
  { who: 'Gram', text: 'One: donuts from the Angry Donut, on Inn Street. Tell them they’re for Gram.' },
  { who: 'Gram', text: 'Two: this book goes back to the library. It was due in March.' },
  { who: 'Gram', text: '…of last year.' },
  { who: 'You', text: 'Gram!' },
  { who: 'Gram', text: 'Go on. This town isn’t getting any younger, and neither am I.' }
];
const DONUT_TALK: Line[] = [
  { who: 'Donut Maker', text: 'Gram’s order? Brave kid.' },
  { who: 'Donut Maker', text: 'One dozen, extra angry. Careful with the box.' },
  { who: 'Donut Maker', text: 'And watch the gulls out there. They have a system.' }
];
const LIB_TALK: Line[] = [
  { who: 'Librarian', text: 'One library book, one year late. We won’t make a scene.' },
  { who: 'Librarian', text: 'You know, George Washington slept in this building. 1789.' },
  { who: 'Librarian', text: 'He returned things on time.' },
  { who: 'Librarian', text: 'Here — a library card of your own. Use it better than your grandmother does.' }
];
const GRATE_TALK: Line[] = [
  { who: 'You', text: 'Clipper? What’ve you got, bud—' },
  { who: '', text: 'Through the bars: old brick. An archway. Stairs, going down into the dark.' },
  { who: 'Passer-by', text: 'Storm drain.' },
  { who: '', text: 'He doesn’t look up from his coffee.' },
  { who: 'You', text: '…That is not a storm drain.' }
];
const GRAM_END: Line[] = [
  { who: 'Gram', text: 'Donuts safe, book returned. And you’ve got the look.' },
  { who: 'You', text: 'What look?' },
  { who: 'Gram', text: 'Your grandfather’s look. He always had it right before the harbormaster called.' },
  { who: 'Gram', text: 'Keep the card, kid. Newburyport is full of doors.' }
];
const FLAVOR: Record<string, Line[]> = {
  gram: [{ who: 'Gram', text: 'Doors, kid. Everywhere.' }],
  donut: [{ who: 'Donut Maker', text: 'Next batch comes out angrier.' }],
  lib: [{ who: 'Librarian', text: 'We open at nine. Washington was never late.' }]
};

// Chapter 2 — the paper route (real addresses; the last stop is Garrison's street)
const ROUTE: [string, string][] = [
  ['Fair Street', '7'], ['Fair Street', '21'], ['Orange Street', '9'], ['Lime Street', '29'],
  ['Federal Street', '11'], ['Federal Street', '26'], ['Temple Street', '14'], ['School Street', '5']
];
const ED_INTRO: Line[] = [
  { who: 'Editor', text: 'You’re the kid who found a tunnel. News travels.' },
  { who: 'You', text: 'How did—' },
  { who: 'Editor', text: 'Small city. Big paper.' },
  { who: 'Editor', text: 'My paper boy quit to crew a lobster boat. Eight houses in the South End need today’s paper.' },
  { who: 'Editor', text: 'Deliver them all, and I’ll unlock the morgue for you.' },
  { who: 'You', text: 'The… morgue?' },
  { who: 'Editor', text: 'It’s where a newspaper keeps everything it ever printed. Old maps. Older rumors.' },
  { who: 'Editor', text: 'Last house is on School Street. Mind the history.' }
];
const ED_BIKE: Line[] = [
  { who: 'Editor', text: 'Eight for eight, every paper on a porch. You’re hired forever.' },
  { who: 'Editor', text: 'The paper boy gets the bike. Garrison did this route on foot — you get the upgrade.' },
  { who: 'Editor', text: 'Morgue’s open. Mind the dust — it’s older than your grandmother.' }
];
const MORGUE_FIND: Line[] = [
  { who: '', text: 'Boxes of old yellow paper. Maps. And a folder marked WHARF RATS — 1808.' },
  { who: '', text: 'Inside: another corner of the smugglers’ map. It shows a door below State Street, right at the water.' },
  { who: '', text: 'Beside it, in old ink: “passable only at the low water.”' },
  { who: 'You', text: 'Low tide, Clipper. We need a boat.' }
];
const SCHOOL_ST: Line[] = [
  { who: '', text: 'Last house. A small plaque by the door: a paper boy grew up here — William Lloyd Garrison.' },
  { who: 'You', text: 'Same route.' }
];

const STEP_OBJECTIVE: (string | null)[] = [
  'Find Gram in Market Square',
  'Get the donuts — The Angry Donut, Inn Street',
  'Return Gram’s book — the library, State Street',
  'Bring Gram her donuts — back to Market Square',
  'Clipper’s run off — follow him',
  'See what Clipper found',
  null
];
// 📕 book · 🍩 donuts · 🪪 library card. Donuts are delivered to Gram at step 3.
const STEP_CHIPS: string[][] = [[], ['\u{1F4D5}'], ['\u{1F4D5}', '\u{1F369}'], ['\u{1F369}', '\u{1FAAA}'], ['\u{1FAAA}'], ['\u{1FAAA}'], ['\u{1FAAA}']];

// Chapter 4 — "Low Water": the rowboat to the Wharf Rats' den below State Street
const BOAT_TALK: Line[] = [
  { who: '', text: 'A weathered rowboat under the wharf, oars shipped. The tide is out — the flats shine like pewter.' },
  { who: 'You', text: '“Passable only at the low water.” That’s now, Clipper.' },
  { who: '', text: 'Clipper jumped in first. Of course he did.' }
];
export const BOAT_ARRIVE: Line[] = [
  { who: '', text: 'Oars creak. The town slides by above the seawall — chimneys, then gulls, then quiet.' },
  { who: '', text: 'You beach the boat on the flats. Half-sunk in weed and barnacle: an iron door. An anchor in a circle, carved deep.' },
  { who: 'You', text: 'Same mark as the tunnel. We found it.' }
];
const SEAWALL_LOOK: Line[] = [
  { who: '', text: 'You lean over the rail. Far below, half-lost in weed and shadow, the seawall drops sheer to the flats.' },
  { who: 'You', text: 'No ladder. No stairs. Twenty feet of slick stone.' },
  { who: 'You', text: '“Passable only at the low water.” From the river, Clipper — we need that rowboat.' }
];
const DEN_LEDGER: Line[] = [
  { who: '', text: 'Dry brick, above the tideline. Crates stamped 1808 — two hundred years of nobody.' },
  { who: '', text: 'On a barrel-top: a ledger. WHARF RATS, in faded ink. A list of names below.' },
  { who: 'You', text: 'Clipper — I know these names. They’re street names. They’re half the town.' }
];
const DEN_MAP: Line[] = [
  { who: '', text: 'Pinned under a dram glass: the third corner of the map.' },
  { who: '', text: 'The tunnels. The door. And a room beneath the Custom House, marked with a star.' },
  { who: 'You', text: 'One corner left.' }
];
const DEN_BELL: Line[] = [
  { who: '', text: 'In the corner, green with age: a ship’s bell.' },
  { who: '', text: 'You ring it once, soft. Somewhere above, through brick and earth, a gull answers.' },
  { who: 'You', text: 'Found you. All of you.' }
];

// Chapter 5 — "The Custom House Star": ring the harbor home, open the room with no door
const KEEPER_TALK: Line[] = [
  { who: 'Keeper', text: 'Gram’s grandkid. She called ahead — said you’d come carrying three corners of something old.' },
  { who: 'Keeper', text: 'This building has a room no key opens. Granite below the granite. A star on the 1835 plans — and no door anywhere.' },
  { who: 'Keeper', text: 'The story the keepers hand down: the Wharf Rats sealed it to sound. Ring the harbor home and the stone remembers.' },
  { who: 'You', text: 'Bells. The den has one. Clipper — I think I know the others.' }
];
const BELL_RING: Line[] = [
  { who: '', text: 'You ring it once. The note rolls out over the water and hangs there, waiting for its sisters.' }
];
const BELL_LAST: Line[] = [
  { who: '', text: 'The third note lands. Far under the town, something turns over — slow and heavy, like a lock the size of a room.' },
  { who: 'You', text: 'The Custom House. GO!' }
];
const CORNER_FOUR: Line[] = [
  { who: '', text: 'On the counting desk: the fourth corner. The map is whole — the tunnels, the door, the den, and the star you are standing on.' },
  { who: 'You', text: 'We found all of it. Every corner.' }
];
const CHEST_OPEN: Line[] = [
  { who: '', text: 'The chest is cedar, banded in brass — and light. Too light for gold.' },
  { who: '', text: 'Inside: papers. Pledges in faded ink — a wharf for the town. A school. A library, signed with names you walk down every day.' },
  { who: 'You', text: 'There’s no treasure… because they spent it. On all of it. Clipper — the treasure was the town.' }
];

function cap(r: number, h: number, hex: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 3, 10), new THREE.MeshLambertMaterial({ color: hex }));
  m.castShadow = true;
  return m;
}
function sph(r: number, hex: string, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshLambertMaterial({ color: hex }));
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}
function box(w: number, h: number, d: number, hex: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: hex }));
  m.castShadow = true;
  return m;
}

// little standing townsperson, same blocky register as the kid
function npcMesh(skin: string, shirt: string, pants: string, hair: string, extra?: 'bun' | 'cap' | 'apron'): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const leg = cap(2, 5, pants);
    leg.position.set(s * 2.4, 6, 0);
    g.add(leg);
    const arm = cap(1.5, 5.5, shirt);
    arm.position.set(s * 5.7, 15, 0);
    g.add(arm);
  }
  const body = cap(4.4, 7, shirt);
  body.position.y = 15.5;
  g.add(body);
  const head = sph(4.6, skin);
  head.position.y = 25.8;
  g.add(head);
  const hairCap = sph(4.75, hair, 1, 0.62, 1);
  hairCap.position.y = 27.6;
  g.add(hairCap);
  if (extra === 'bun') {
    const bun = sph(1.9, hair);
    bun.position.set(0, 29.6, -2.2);
    g.add(bun);
  }
  if (extra === 'cap') {
    const brim = box(6.4, 0.9, 3.4, hair);
    brim.position.set(0, 27.4, 4.4);
    g.add(brim);
  }
  if (extra === 'apron') {
    const ap = box(7.6, 8.5, 0.9, '#b03a32');
    ap.position.set(0, 14.5, 4.1);
    g.add(ap);
    const tie = box(8.6, 1.1, 0.7, '#8e2f28');
    tie.position.set(0, 19.2, 4);
    g.add(tie);
  }
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(8, 16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x10141a, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shadow.position.y = 0.25;
  g.add(shadow);
  return g;
}

function bangSprite(): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = '900 52px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 9;
  g.strokeStyle = 'rgba(20, 26, 34, 0.95)';
  g.strokeText('!', 32, 34);
  g.fillStyle = '#ffd24a';
  g.fillText('!', 32, 34);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(13, 13, 1);
  return sp;
}

export class QuestRunner {
  dogTarget: { x: number; z: number } | null = null;

  private step: number;
  private scene: THREE.Scene;
  private index: WorldIndex;
  private hud: Hud;
  private audio: GameAudio;
  private t = 0;

  private npcs: Record<string, THREE.Group> = {};
  private beacon: THREE.Group;
  private beaconRing: THREE.Mesh;
  private beaconBeam: THREE.Mesh;
  private beaconHalo: THREE.Mesh;
  private beaconCore: THREE.Mesh;
  private bang: THREE.Sprite;
  private grate: THREE.Group;
  private grateBars: THREE.Group | null = null;
  private nearTag: string | null = null;
  private onGoDown: () => void;
  private onBike: () => void;
  private onBoat: () => void;   // ROW the boat out to the den (Game drives the ride)
  private onStar: () => void;   // ENTER the Custom House cellar (the star room)
  private onNews: () => void;   // ENTER the Daily News newsroom (Chapter 3)
  private onDen: () => void;    // re-ENTER the den if you stepped out before finishing Ch4
  private ch2: number;
  private ch3: number;
  private ch4: number;
  private bells: Set<string>;
  private rowboat: THREE.Group | null = null;
  private c5built = false;
  private stops: { x: number; z: number }[] = [];
  private delivered: Set<number>;
  private editorPos = { x: 764, z: 342 };
  private papers: { m: THREE.Mesh; t: number; from: { x: number; z: number }; to: { x: number; z: number } }[] = [];

  constructor(scene: THREE.Scene, index: WorldIndex, hud: Hud, audio: GameAudio, onGoDown: () => void, onBike: () => void,
              onBoat: () => void, onStar: () => void, onNews: () => void, onDen: () => void) {
    this.scene = scene;
    this.index = index;
    this.hud = hud;
    this.audio = audio;
    this.onGoDown = onGoDown;
    this.onBike = onBike;
    this.onBoat = onBoat;
    this.onStar = onStar;
    this.onNews = onNews;
    this.onDen = onDen;
    this.step = Math.min(6, Math.max(0, parseInt(localStorage.getItem(SAVE_KEY) || '0', 10) || 0));
    this.ch2 = Math.min(4, Math.max(0, parseInt(localStorage.getItem('nbpt-ch2-step') || '0', 10) || 0));
    this.ch3 = Math.min(4, Math.max(0, parseInt(localStorage.getItem('nbpt-ch3-step') || '0', 10) || 0));
    this.ch4 = Math.min(4, Math.max(0, parseInt(localStorage.getItem('nbpt-ch4-step') || '0', 10) || 0));
    try {
      this.bells = new Set(JSON.parse(localStorage.getItem('nbpt-ch4-bells') || '[]'));
    } catch {
      this.bells = new Set();
    }
    try {
      this.delivered = new Set(JSON.parse(localStorage.getItem('nbpt-ch2-stops') || '[]'));
    } catch {
      this.delivered = new Set();
    }
    // the route runs to real front doors, straight from the assessor data
    for (const [st, num] of ROUTE) {
      const street = index.world.addrs.find((a) => a.s === st);
      const hit = street ? street.a.find((e) => String(e[0]) === num) : null;
      if (hit) this.stops.push({ x: hit[1], z: hit[2] });
    }
    const lib23 = index.world.addrs.find((a) => a.s === 'Liberty Street');
    const ed = lib23 ? lib23.a.find((e) => String(e[0]) === '23') : null;
    // the parcel point sits inside the footprint; the Editor stands out front
    if (ed) this.editorPos = { x: ed[1] + 34, z: ed[2] - 36 };

    // the cast
    const gram = npcMesh('#e8c5a2', '#9a7fae', '#7d7268', '#e9e6df', 'bun');
    const donut = npcMesh('#caa07c', '#f3efe2', '#4e5a66', '#3c332b', 'apron');
    const lib = npcMesh('#e3b794', '#4e7a74', '#5e564c', '#8e6b4a', 'bun');
    this.npcs = { gram, donut, lib };
    this.place(gram, GRAM.x, GRAM.z, GRAM.face);
    this.place(donut, DONUT.x, DONUT.z, DONUT.face);
    this.place(lib, LIB.x, LIB.z, LIB.face);
    scene.add(gram, donut, lib);
    // the Editor now lives INSIDE the Daily News newsroom (NewsroomScene), reached
    // by entering the building on Liberty Street — no outside editor NPC.
    // papers already delivered stay on their porches
    for (const i of this.delivered) {
      const st = this.stops[i];
      if (st) this.scene.add(this.paperMesh(st.x, st.z));
    }

    // the grate behind the Firehouse — Chapter 1's front door
    this.grate = this.buildGrate();
    scene.add(this.grate);

    // the library's State-Street entrance: a real double door where you're sent
    // to return the book (that wall used to show only a window)
    scene.add(this.buildLibraryDoor());

    // gold objective beacon: a TALL pillar of light you can spot from across town —
    // a bright inner shaft, a wider soft halo, a sonar-pinging base ring, and the "!"
    this.beacon = new THREE.Group();
    // additive glow for the ground disc + sonar ring (great against the ground)
    const beamMat = (op: number) => new THREE.MeshBasicMaterial({
      color: 0xffd24a, transparent: true, opacity: op,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
    });
    // the vertical beam draws on top (depthTest off, NORMAL blending) so it reads
    // the SAME on any background — additive used to vanish over the dark water and
    // only "appear" once it crossed into the sky
    const glowMat = (op: number) => new THREE.MeshBasicMaterial({
      color: 0xffd863, transparent: true, opacity: op,
      side: THREE.DoubleSide, depthWrite: false, depthTest: false
    });
    // a soft filled glow disc marks the exact landing spot
    const disc = new THREE.Mesh(new THREE.CircleGeometry(15, 28).rotateX(-Math.PI / 2), beamMat(0.16));
    disc.position.y = 0.5;
    this.beacon.add(disc);
    // base ring — pings outward (animated in update)
    this.beaconRing = new THREE.Mesh(new THREE.RingGeometry(12, 20, 36).rotateX(-Math.PI / 2), beamMat(0.5));
    this.beaconRing.position.y = 0.7;
    this.beacon.add(this.beaconRing);
    // three concentric translucent layers (outer halo → mid shaft → brighter core),
    // all on top so the beam looks consistent over water, sky, and town
    this.beaconHalo = new THREE.Mesh(new THREE.CylinderGeometry(11, 16, 460, 18, 1, true), glowMat(0.1));
    this.beaconHalo.position.y = 235;
    this.beaconHalo.renderOrder = 10;
    this.beacon.add(this.beaconHalo);
    this.beaconBeam = new THREE.Mesh(new THREE.CylinderGeometry(5, 7.5, 460, 18, 1, true), glowMat(0.2));
    this.beaconBeam.position.y = 235; // spans ~5 .. 465
    this.beaconBeam.renderOrder = 11;
    this.beacon.add(this.beaconBeam);
    this.beaconCore = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.6, 460, 16, 1, true), glowMat(0.45));
    this.beaconCore.position.y = 235;
    this.beaconCore.renderOrder = 12;
    this.beacon.add(this.beaconCore);
    scene.add(this.beacon);
    this.bang = bangSprite();
    scene.add(this.bang);

    if (this.step === 4 || this.step === 5) this.dogTarget = { x: GRATE.x, z: GRATE.z };
    this.apply();
  }

  private place(g: THREE.Group, x: number, z: number, face: number) {
    g.position.set(x, this.index.heightAtPx(x, z), z);
    g.rotation.y = face;
  }

  private buildGrate(): THREE.Group {
    const g = new THREE.Group();
    const pit = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 10.5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x101418 })
    );
    pit.position.y = 0.32;
    g.add(pit);
    for (const [w, d, x, z] of [[17, 1.6, 0, -6], [17, 1.6, 0, 6], [1.6, 10.5, -7.7, 0], [1.6, 10.5, 7.7, 0]] as const) {
      const rim = box(w, 1.1, d, '#4a4640');
      rim.position.set(x, 0.55, z);
      g.add(rim);
    }
    // the bars swing open as one lid once Chapter 1 is done
    this.grateBars = new THREE.Group();
    for (let i = -2; i <= 2; i++) {
      const bar = box(0.9, 0.7, 10.5, '#5a564e');
      bar.position.set(i * 2.9, 0.62, 0);
      this.grateBars.add(bar);
    }
    g.add(this.grateBars);
    const x = GRATE.x, z = GRATE.z;
    g.position.set(x, this.index.heightAtPx(x, z), z);
    g.rotation.y = 0.42;
    return g;
  }

  // granite double door on the library's State-Street wall — local +x faces the
  // street (the wall here runs N–S, exterior to the east, so rotation.y stays 0)
  private buildLibraryDoor(): THREE.Group {
    const g = new THREE.Group();
    const pale = '#e7e3d8', leafHex = '#33433a';
    for (const dz of [-5.4, 5.4]) {                       // pale stone pilasters
      const p = box(2, 15, 1.8, pale); p.position.set(0.8, 7.5, dz); g.add(p);
    }
    const lintel = box(2.4, 2.2, 13.6, pale); lintel.position.set(0.6, 15.6, 0); g.add(lintel);
    const recess = box(1.2, 14, 9, '#24201c'); recess.position.set(0.1, 7.4, 0); g.add(recess);
    for (const dz of [-2.2, 2.2]) {                       // two dark-green leaves
      const leaf = box(1.1, 12.6, 4.2, leafHex); leaf.position.set(0.7, 6.8, dz); g.add(leaf);
      const handle = box(0.5, 1.3, 0.5, '#c9a84e'); handle.position.set(1.4, 6.6, dz + (dz < 0 ? 1.5 : -1.5)); g.add(handle);
    }
    const step = box(7, 1.4, 12, '#9a9b95'); step.position.set(4.2, 0.6, 0); g.add(step);
    const wx = -886, wz = 2312;
    g.position.set(wx, this.index.heightAtPx(wx + 4, wz), wz);
    return g;
  }

  // the weathered rowboat (boxes), built once and shown on the bank during Ch4
  private ensureRowboat() {
    if (this.rowboat) return;
    const R = new THREE.Group();
    const RB = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string) => {
      const m = box(w, h, d, hex);
      m.position.set(x, y, z);
      R.add(m);
    };
    RB(18, 3, 46, 0, 2.4, 0, '#6e4520');
    RB(1.8, 5, 44, -9, 5.4, 0, '#7a5230');
    RB(1.8, 5, 44, 9, 5.4, 0, '#7a5230');
    RB(18, 5, 2.5, 0, 5.4, -22.5, '#7a5230');
    RB(13, 4, 6, 0, 5.4, 21, '#7a5230');
    RB(7, 3.5, 5, 0, 6.9, 25.5, '#6e4520');
    RB(15, 1.4, 4.5, 0, 6.2, 3, '#a8895e');
    RB(15, 1.4, 4.5, 0, 6.2, -12, '#a8895e');
    this.rowboat = R;
    this.scene.add(R);
  }

  // the Custom House keeper + the two harbor bell-posts (Coast Guard, wharf)
  private buildC5Props() {
    const keeper = npcMesh('#d8c2a2', '#5a4a6e', '#4e4a44', '#8a8378', 'bun');
    this.npcs.keeper = keeper;
    this.place(keeper, KEEPER.x, KEEPER.z, -1.4);
    this.scene.add(keeper);
    const bellPost = (x: number, z: number) => {
      const g = new THREE.Group();
      const post = box(2, 12, 2, '#3a342c');
      post.position.y = 6;
      g.add(post);
      const bar = box(8, 2, 2, '#3a342c');
      bar.position.y = 12.6;
      g.add(bar);
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, 6, 10), new THREE.MeshLambertMaterial({ color: '#5e7a64' }));
      bell.position.y = 9;
      bell.castShadow = true;
      g.add(bell);
      g.position.set(x, this.index.heightAtPx(x, z), z);
      this.scene.add(g);
    };
    bellPost(BELL_CG.x, BELL_CG.z);
    bellPost(BELL_WHARF.x, BELL_WHARF.z);
  }

  // current interactable: tag + spot + verb for the TALK button
  private ch1Done(): boolean {
    return (parseInt(localStorage.getItem('nbpt-ch1-step') || '0', 10) || 0) >= 6;
  }

  private candidates(): { tag: string; x: number; z: number; label: string; r: number }[] {
    const c: { tag: string; x: number; z: number; label: string; r: number }[] = [];
    if (this.step === 0 || this.step === 3) c.push({ tag: 'gram', x: GRAM.x, z: GRAM.z, label: '\u{1F4AC} TALK', r: 55 });
    else if (this.step === 1) c.push({ tag: 'donut', x: DONUT.x, z: DONUT.z, label: '\u{1F4AC} TALK', r: 55 });
    else if (this.step === 2) c.push({ tag: 'lib', x: LIB.x, z: LIB.z, label: '\u{1F4AC} TALK', r: 55 });
    else if (this.step === 5) c.push({ tag: 'grate', x: GRATE.x, z: GRATE.z, label: '\u{1F440} LOOK', r: 60 });
    if (this.step >= 6) {
      c.push({ tag: 'godown', x: GRATE.x, z: GRATE.z, label: '\u2B07 GO DOWN', r: 72 });
      if (this.ch1Done()) {
        if (this.ch2 === 0 || this.ch2 === 2 || this.ch2 === 3) c.push({ tag: 'news', x: this.editorPos.x, z: this.editorPos.z, label: '\u{1F4F0} ENTER', r: 55 });
        else if (this.ch2 === 1) {
          for (let i = 0; i < this.stops.length; i++) {
            if (!this.delivered.has(i)) c.push({ tag: 'stop' + i, x: this.stops[i].x, z: this.stops[i].z, label: '\u{1F4F0} THROW', r: 124 });
          }
        }
        // Chapter 4 "Low Water": the rowboat is the only way to the den —
        // for the three corners, and later to ring the den's own bell
        if (this.ch2 >= 4) {
          if (this.ch3 === 0 || (this.ch4 === 1 && !this.bells.has('den'))) {
            c.push({ tag: 'boat', x: BOAT.x, z: BOAT.z, label: '\u{1F6F6} ROW', r: 48 });
          } else if (this.ch3 >= 1 && this.ch3 < 4) {
            // stepped out of the den before finishing — the boat's beached at the
            // door, so let them climb back down instead of being stranded here
            c.push({ tag: 'reden', x: WDOOR.x, z: WDOOR.z, label: '⬇ GO DOWN', r: 64 });
          }
          // Chapter 5 "The Custom House Star": the keeper, the bells, the cellar
          if (this.ch3 >= 4) {
            if (this.ch4 === 0) c.push({ tag: 'curator', x: KEEPER.x, z: KEEPER.z, label: '\u{1F4AC} TALK', r: 60 });
            else if (this.ch4 === 1) {
              if (!this.bells.has('cg')) c.push({ tag: 'cgbell', x: BELL_CG.x, z: BELL_CG.z, label: '\u{1F514} RING', r: 65 });
              if (!this.bells.has('wharf')) c.push({ tag: 'whbell', x: BELL_WHARF.x, z: BELL_WHARF.z, label: '\u{1F514} RING', r: 65 });
            } else if (this.ch4 === 2 || this.ch4 === 3) {
              c.push({ tag: 'cellar', x: CELLAR.x, z: CELLAR.z, label: '⭐ ENTER', r: 60 });
            }
          }
        }
      }
    }
    return c;
  }

  private nearestCandidate(px: number, pz: number): { tag: string; x: number; z: number; label: string; r: number } | null {
    let best: { tag: string; x: number; z: number; label: string; r: number } | null = null;
    let bd = Infinity;
    for (const c of this.candidates()) {
      const d = Math.hypot(px - c.x, pz - c.z);
      if (d < c.r && d < bd) { bd = d; best = c; }
    }
    return best;
  }

  private setStep(s: number) {
    this.step = s;
    localStorage.setItem(SAVE_KEY, String(s));
    this.apply();
  }

  // sync HUD + markers to the whole spine state (ch0 → tunnel → paper route)
  private apply() {
    const ch1 = parseInt(localStorage.getItem('nbpt-ch1-step') || '0', 10) || 0;
    let target: { x: number; z: number } | null = null;
    let bangY = 48;
    if (this.step >= 6) {
      if (ch1 < 6) {
        this.hud.setObjective('The grate is open\u2026 go down');
        target = { x: GRATE.x, z: GRATE.z };
        bangY = 26;
      } else if (this.ch2 === 0) {
        this.hud.setObjective('Someone at the Daily News wants a word \u2014 Liberty Street');
        target = this.editorPos;
      } else if (this.ch2 === 1) {
        this.hud.setObjective('Deliver the Daily News \u2014 ' + this.delivered.size + '/' + this.stops.length);
        let bd = Infinity;
        for (let i = 0; i < this.stops.length; i++) {
          if (this.delivered.has(i)) continue;
          const d = Math.hypot(this.stops[i].x - GRAM.x, this.stops[i].z - GRAM.z);
          if (d < bd) { bd = d; target = this.stops[i]; }
        }
      } else if (this.ch2 === 2) {
        this.hud.setObjective('Back to the Daily News');
        target = this.editorPos;
      } else if (this.ch2 === 3) {
        this.hud.setObjective('Back inside the Daily News \u2014 search the morgue');
        target = this.editorPos;
      } else if (this.ch3 === 0) {
        this.hud.setObjective(this.hud.boating ? 'Row west along the seawall \u2014 the beam marks the door' : 'Low water \u2014 a rowboat waits on the bank past the Coast Guard station');
        target = this.hud.boating ? WDOOR : BOAT;
      } else if (this.ch3 < 4) {
        this.hud.setObjective('The waterline door \u2014 below the seawall, west of the docks');
        target = WDOOR;
      } else if (this.ch4 === 0) {
        this.hud.setObjective('The last corner \u2014 the Custom House, Water Street');
        target = KEEPER;
      } else if (this.ch4 === 1) {
        // the den's bell is the third \u2014 you row back out to it, so once the two
        // harbor-post bells are rung the beam points at the boat, not the door
        const denLast = this.bells.has('cg') && this.bells.has('wharf');
        this.hud.setObjective(denLast
          ? 'The last bell is in the den \u2014 row back out past the Coast Guard station'
          : 'Ring the harbor home \u2014 ' + this.bells.size + ' of 3 bells');
        target = !this.bells.has('cg') ? BELL_CG : !this.bells.has('wharf') ? BELL_WHARF : BOAT;
      } else if (this.ch4 === 2 || this.ch4 === 3) {
        this.hud.setObjective('The stone remembers \u2014 beneath the Custom House');
        target = CELLAR;
      } else {
        this.hud.setObjective(null);
      }
    } else {
      this.hud.setObjective(STEP_OBJECTIVE[this.step]);
      const it = this.nearestNonRouteTarget();
      target = it;
      if (it && (this.step === 4 || this.step === 5)) bangY = 26;
    }
    // feed the two HUD systems from this one sync point: the backpack + missions log
    this.hud.setBag(this.buildBag());
    this.hud.setMissions(this.buildMissions());
    // the rowboat waits on the bank during Chapter 4 — and again for Chapter 5's
    // den bell (you row back out to ring it), parked at the launch bank both times
    this.ensureRowboat();
    const needDenBell = this.ch3 >= 4 && this.ch4 === 1 && !this.bells.has('den');
    const showBoat = this.step >= 6 && this.ch2 >= 4 && (this.ch3 < 4 || needDenBell) && !this.hud.boating;
    this.rowboat!.visible = showBoat;
    if (showBoat) {
      const atLaunch = this.ch3 === 0 || needDenBell;   // launch bank vs. parked by the den door
      const rx = atLaunch ? BOAT.x + 9 : -200;
      const rz = atLaunch ? BOAT.z - 26 : -1172;
      this.rowboat!.position.set(rx, this.index.heightAtPx(rx, rz) + 0.5, rz);
      this.rowboat!.rotation.y = atLaunch ? 0.8 : 2.2;
    }
    // once the den is cleared, the Custom House keeper and the two harbor bells appear
    if (this.ch3 >= 4 && !this.c5built) { this.c5built = true; this.buildC5Props(); }
    // the bars swing aside once the chapter ends
    if (this.grateBars) {
      const open = this.step >= 6;
      this.grateBars.rotation.z = open ? 1.25 : 0;
      this.grateBars.position.set(open ? -8.2 : 0, open ? 4.4 : 0, 0);
    }
    if (target) {
      const gy = this.index.heightAtPx(target.x, target.z);
      this.beacon.visible = true;
      this.beacon.position.set(target.x, gy, target.z);
      this.bang.visible = true;
      this.bang.position.set(target.x, gy + bangY, target.z);
    } else {
      this.beacon.visible = false;
      this.bang.visible = false;
    }
    // the journey panel's direction hint points at the live objective beacon
    this.hud.guide = target;
  }

  // how many of the four smugglers'-map corners you've found (one per milestone) —
  // a single counted set, not four copies of one chip
  private cornerCount(): number {
    const ch1 = parseInt(localStorage.getItem('nbpt-ch1-step') || '0', 10) || 0;
    let n = 0;
    if (ch1 >= 4) n++;        // Ch2 tunnel — first corner
    if (this.ch2 >= 4) n++;   // Ch3 morgue — second
    if (this.ch3 >= 3) n++;   // Ch4 den — third
    if (this.ch4 >= 3) n++;   // Ch5 cellar — fourth
    return n;
  }

  // what's in the backpack right now: transient carry items, kept treasures, and
  // the map-corner collection (the Hud adds the Town-stories collection itself)
  private buildBag(): BagItem[] {
    const out: BagItem[] = [];
    const add = (id: string, extra?: Partial<BagItem>) => out.push({ ...ITEMS[id], ...extra } as BagItem);
    const ch1 = parseInt(localStorage.getItem('nbpt-ch1-step') || '0', 10) || 0;
    if (this.step >= 6) {
      if (this.ch2 === 1 || this.ch2 === 2) add('papers');     // carrying the route's papers
      add('card');                                             // treasures you keep forever
      if (ch1 >= 2) add('lantern');
      if (localStorage.getItem('nbpt-bike') === '1') add('bike');
      const cc = this.cornerCount();
      if (cc > 0) add('mapcorners', { count: cc, total: 4 });
    } else {
      for (const e of STEP_CHIPS[this.step]) {                 // pre-spine: book/donuts/card
        const id = EMOJI_TO_ID[e];
        if (id) add(id);
      }
    }
    return out;
  }

  // the story spine as mission cards (grouped under "Story"); adding a future side
  // quest = pushing one more object here, no UI changes. The Hud appends collections.
  private buildMissions(): Mission[] {
    const s0 = this.step;
    const ch1 = parseInt(localStorage.getItem('nbpt-ch1-step') || '0', 10) || 0;
    const s2 = this.ch2, s3 = this.ch3, s4 = this.ch4;
    // which chapter currently owns the objective beacon (mirrors apply()'s cascade)
    const active = s0 < 6 ? 1 : ch1 < 6 ? 2 : s2 < 4 ? 3 : s3 < 4 ? 4 : s4 < 4 ? 5 : 0;
    return [
      { id: 'ch1', group: 'story', kicker: 'Chapter 1', title: 'Overdue',
        state: s0 >= 6 ? 'done' : 'active', active: active === 1, replay: 0, reward: 'Library card',
        steps: [
          { label: 'Find Gram in Market Square', done: s0 > 0 },
          { label: 'Get the donuts on Inn Street', done: s0 > 1 },
          { label: 'Return Gram’s book to the library', done: s0 > 2 },
          { label: 'Bring Gram her donuts', done: s0 > 3 },
          { label: 'Follow Clipper to what he found', done: s0 >= 6 }
        ] },
      { id: 'ch2', group: 'story', kicker: 'Chapter 2', title: 'The Door Under Downtown',
        state: ch1 >= 6 ? 'done' : s0 >= 6 ? 'active' : 'locked', active: active === 2, replay: 1, reward: 'Lantern',
        steps: [
          { label: 'Go down through the grate', done: ch1 > 0 },
          { label: 'Light the way and find the smuggler’s mark', done: ch1 >= 2 },
          { label: 'Find the torn map corner', done: ch1 >= 4 }
        ] },
      { id: 'ch3', group: 'story', kicker: 'Chapter 3', title: 'The Daily News',
        state: s2 >= 4 ? 'done' : ch1 >= 6 ? 'active' : 'locked', active: active === 3, replay: 2, reward: 'Bicycle',
        steps: [
          { label: 'Talk to the Editor on Liberty Street', done: s2 >= 1 },
          { label: 'Deliver the papers', done: s2 >= 2, count: this.delivered.size, total: this.stops.length },
          { label: 'Search the morgue', done: s2 >= 4 }
        ] },
      { id: 'ch4', group: 'story', kicker: 'Chapter 4', title: 'Low Water',
        state: s3 >= 4 ? 'done' : s2 >= 4 ? 'active' : 'locked', active: active === 4, replay: 3, reward: 'Third map corner',
        steps: [
          { label: 'Row out to the waterline door', done: s3 >= 1 },
          { label: 'Read the Wharf Rats’ ledger', done: s3 >= 2 },
          { label: 'Find the third map corner', done: s3 >= 3 },
          { label: 'Ring the den’s bell', done: s3 >= 4 }
        ] },
      { id: 'ch5', group: 'story', kicker: 'Chapter 5', title: 'The Custom House Star',
        state: s4 >= 4 ? 'done' : s3 >= 4 ? 'active' : 'locked', active: active === 5, replay: 4,
        steps: [
          { label: 'Talk to the Custom House keeper', done: s4 >= 1 },
          { label: 'Ring the harbor home', done: s4 >= 2, count: this.bells.size, total: 3 },
          { label: 'Open the room with no door', done: s4 >= 4 }
        ] }
    ];
  }

  // ch0's own step targets (pre-spine-completion)
  private nearestNonRouteTarget(): { x: number; z: number } | null {
    if (this.step === 0 || this.step === 3) return { x: GRAM.x, z: GRAM.z };
    if (this.step === 1) return { x: DONUT.x, z: DONUT.z };
    if (this.step === 2) return { x: LIB.x, z: LIB.z };
    if (this.step === 4 || this.step === 5) return { x: GRATE.x, z: GRATE.z };
    return null;
  }

  // re-sync after returning from the tunnels
  refresh() {
    this.apply();
  }

  // whether the quest currently owns the talk button
  get nearActive(): boolean {
    return this.nearTag !== null;
  }

  update(dt: number, px: number, pz: number) {
    this.t += dt;
    // beacon: a strong, dramatic pulse — the whole pillar throbs bright→dim and
    // breathes wider, while the base ring pings outward like sonar
    const pulse = (Math.sin(this.t * 3.4) + 1) / 2;
    const throb = pulse * pulse;                 // sharper bright peak = more drama
    // Fade the tall beam out as you arrive, so it isn't a bright column standing
    // on top of you and the NPC (the beam draws over everything via depthTest off).
    // It guides you in from a distance, then bows out within interaction range;
    // the ground ring + "!" remain as the precise here-marker.
    const bdist = this.beacon.visible
      ? Math.hypot(px - this.beacon.position.x, pz - this.beacon.position.z)
      : 9999;
    const arrive = Math.min(1, Math.max(0, (bdist - 60) / 150)); // 0 ≤60px … 1 ≥210px
    (this.beaconHalo.material as THREE.MeshBasicMaterial).opacity = (0.05 + 0.2 * throb) * arrive;
    (this.beaconBeam.material as THREE.MeshBasicMaterial).opacity = (0.1 + 0.3 * throb) * arrive;
    (this.beaconCore.material as THREE.MeshBasicMaterial).opacity = (0.28 + 0.46 * throb) * arrive;
    const w = 1 + 0.16 * pulse;                  // breathe wider on the bright beat
    this.beaconHalo.scale.set(w, 1, w);
    this.beaconBeam.scale.set(w, 1, w);
    this.beaconCore.scale.set(w, 1, w);
    const ping = (this.t * 0.85) % 1;
    const rs = 1 + ping * 2.4;
    this.beaconRing.scale.set(rs, 1, rs);
    (this.beaconRing.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - ping);
    if (this.bang.visible) {
      this.bang.position.y += Math.sin(this.t * 3.2) * dt * 4;
    }
    // gentle idle sway on the cast
    for (const k of Object.keys(this.npcs)) {
      const g = this.npcs[k];
      g.rotation.y += Math.sin(this.t * 1.3 + g.position.x) * 0.0006;
    }

    // step 4: following Clipper, you close on the grate he's found
    if (this.step === 4 && Math.hypot(px - GRATE.x, pz - GRATE.z) < 290) {
      this.audio.bark();
      this.dogTarget = { x: GRATE.x, z: GRATE.z };
      this.setStep(5);
    }

    // newspapers in flight
    for (let i = this.papers.length - 1; i >= 0; i--) {
      const pp = this.papers[i];
      pp.t += dt / 0.55;
      if (pp.t >= 1) {
        pp.m.position.set(pp.to.x, this.index.heightAtPx(pp.to.x, pp.to.z) + 1.2, pp.to.z);
        this.audio.thump();
        this.papers.splice(i, 1);
        continue;
      }
      const k = pp.t;
      const gy = this.index.heightAtPx(pp.to.x, pp.to.z);
      pp.m.position.set(
        pp.from.x + (pp.to.x - pp.from.x) * k,
        gy + 14 + Math.sin(Math.PI * k) * 16,
        pp.from.z + (pp.to.z - pp.from.z) * k
      );
      pp.m.rotation.x += dt * 9;
    }

    // TALK/LOOK affordance
    if (this.hud.dialogueOpen) {
      if (this.nearTag) { this.nearTag = null; this.hud.showTalk(null); }
      return;
    }
    let near: { tag: string; label: string } | null = null;
    const it = this.nearestCandidate(px, pz);
    if (it) near = { tag: it.tag, label: it.label };
    if (!near && this.step >= 6) {
      for (const [tag, pos] of [['gram', GRAM], ['donut', DONUT], ['lib', LIB]] as const) {
        if (Math.hypot(px - pos.x, pz - pos.z) < 50) { near = { tag, label: '\u{1F4AC} TALK' }; break; }
      }
    }
    if ((near && near.tag) !== this.nearTag) {
      this.nearTag = near ? near.tag : null;
      this.hud.showTalk(near ? near.label : null, () => this.tryInteract(px, pz));
    }
  }

  private paperMesh(x: number, z: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 5.2, 7).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#e8e4d6' }));
    m.position.set(x, this.index.heightAtPx(x, z) + 1.2, z);
    m.castShadow = true;
    return m;
  }

  private throwPaper(i: number, px: number, pz: number) {
    const st = this.stops[i];
    if (!st || this.delivered.has(i)) return;
    this.delivered.add(i);
    localStorage.setItem('nbpt-ch2-stops', JSON.stringify([...this.delivered]));
    const m = this.paperMesh(st.x, st.z);
    this.scene.add(m);
    this.papers.push({ m, t: 0, from: { x: px, z: pz }, to: { x: st.x, z: st.z } });
    if (this.delivered.size >= this.stops.length) {
      setTimeout(() => {
        this.hud.showDialogue(SCHOOL_ST, () => this.setCh2(2));
      }, 700);
    } else {
      this.apply();
    }
  }

  private setCh2(s2: number) {
    this.ch2 = s2;
    localStorage.setItem('nbpt-ch2-step', String(s2));
    this.apply();
  }

  private setCh3(s3: number) {
    this.ch3 = s3;
    localStorage.setItem('nbpt-ch3-step', String(s3));
    this.apply();
  }

  private setCh4(s4: number) {
    this.ch4 = s4;
    localStorage.setItem('nbpt-ch4-step', String(s4));
    this.apply();
  }

  // ring a harbor bell; three rung and the room under the Custom House opens
  private ringBell(which: string) {
    this.bells.add(which);
    localStorage.setItem('nbpt-ch4-bells', JSON.stringify([...this.bells]));
    this.audio.jingle();
    if (this.bells.size >= 3) {
      this.hud.showDialogue(BELL_LAST, () => this.setCh4(2));
    } else {
      this.hud.showDialogue(BELL_RING);
      this.apply();
    }
  }

  tryInteract(px: number, pz: number) {
    if (this.hud.dialogueOpen) return;
    const it = this.nearestCandidate(px, pz);
    if (it) {
      if (it.tag === 'godown') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.onGoDown();
        return;
      }
      if (it.tag === 'news') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.onNews();   // step inside the Daily News; the editor/morgue beats run there
        return;
      }
      if (it.tag === 'reden') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.onDen();   // climb straight back down to the den (the boat's already beached)
        return;
      }
      if (it.tag === 'boat') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.dogTarget = { x: BOAT.x + 6, z: BOAT.z - 16 };
        // row out (BOAT_TALK), then Game takes over the boat ride to the den
        this.hud.showDialogue(BOAT_TALK, () => { this.dogTarget = null; this.onBoat(); });
        return;
      }
      if (it.tag === 'cgbell') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.ringBell('cg');
        return;
      }
      if (it.tag === 'whbell') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.ringBell('wharf');
        return;
      }
      if (it.tag === 'cellar') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.onStar();
        return;
      }
      if (it.tag.startsWith('stop')) {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.throwPaper(parseInt(it.tag.slice(4), 10), px, pz);
        return;
      }
      this.runStepDialogue(it.tag);
      return;
    }
    if (this.step >= 6) {
      for (const [tag, pos] of [['gram', GRAM], ['donut', DONUT], ['lib', LIB]] as const) {
        if (Math.hypot(px - pos.x, pz - pos.z) < 56) {
          this.hud.showDialogue(FLAVOR[tag]);
          return;
        }
      }
    }
  }

  private runStepDialogue(tag: string) {
    this.hud.showTalk(null);
    this.nearTag = null;
    if (this.step === 0 && tag === 'gram') {
      this.hud.showDialogue(GRAM_TALK, () => {
        this.hud.chapterCard('CHAPTER 1', 'Overdue', 'Newburyport · first day of summer');
        this.setStep(1);
      });
    } else if (this.step === 1 && tag === 'donut') {
      this.hud.showDialogue(DONUT_TALK, () => this.setStep(2));
    } else if (this.step === 2 && tag === 'lib') {
      this.hud.showDialogue(LIB_TALK, () => this.setStep(3));
    } else if (this.step === 3 && tag === 'gram') {
      // errands done — report back to Gram first; then Clipper bolts off
      this.hud.showDialogue(GRAM_END, () => {
        this.audio.bark();
        this.dogTarget = { x: GRATE.x, z: GRATE.z };   // Clipper runs ahead to the grate
        this.setStep(4);
      });
    } else if (this.step === 5 && tag === 'grate') {
      this.hud.showDialogue(GRATE_TALK, () => {
        this.audio.jingle();
        this.hud.chapterCard('CHAPTER 1 COMPLETE', 'Overdue', 'the card is yours · the door is waiting');
        this.dogTarget = null;
        this.setStep(6);
      });
    } else if (tag === 'editor' && this.ch2 === 0) {
      this.hud.showDialogue(ED_INTRO, () => {
        this.hud.chapterCard('CHAPTER 3', 'The Paper Route', 'eight houses \u00b7 one bag \u00b7 mind the history');
        this.setCh2(1);
      });
    } else if (tag === 'editor' && this.ch2 === 2) {
      this.hud.showDialogue(ED_BIKE, () => {
        this.onBike();
        this.audio.bell();
        this.setCh2(3);
      });
    } else if (tag === 'morgue' && this.ch2 === 3) {
      this.hud.showDialogue(MORGUE_FIND, () => {
        this.audio.jingle();
        this.hud.chapterCard('CHAPTER 3 COMPLETE', 'The Paper Route', 'the bike is yours \u00b7 two corners of the map');
        this.setCh2(4);
      });
    } else if (tag === 'ledger' && this.ch3 === 1) {
      this.hud.showDialogue(DEN_LEDGER, () => this.setCh3(2));
    } else if (tag === 'wmap' && this.ch3 === 2) {
      this.hud.showDialogue(DEN_MAP, () => { this.audio.jingle(); this.setCh3(3); });
    } else if (tag === 'bell' && this.ch3 === 3) {
      this.hud.showDialogue(DEN_BELL, () => {
        this.audio.jingle();
        this.hud.chapterCard('CHAPTER 4 COMPLETE', 'Low Water', 'three corners found \u00b7 the Custom House keeps the last');
        this.setCh3(4);
      });
    } else if (tag === 'dbell' && this.ch4 === 1) {
      this.ringBell('den');
    } else if (tag === 'curator' && this.ch4 === 0) {
      this.hud.showDialogue(KEEPER_TALK, () => this.setCh4(1));
    } else if (tag === 'corner4' && this.ch4 === 2) {
      this.hud.showDialogue(CORNER_FOUR, () => { this.audio.jingle(); this.setCh4(3); });
    } else if (tag === 'chest' && this.ch4 === 3) {
      this.hud.showDialogue(CHEST_OPEN, () => {
        this.audio.jingle();
        this.hud.chapterCard('CHAPTER 5 COMPLETE', 'The Custom House Star', 'the map is whole \u00b7 the treasure was the town');
        this.setCh4(4);
      });
    }
  }

  // the den + star-room interiors read live state through these and drive their
  // beats back through the quest's own dialogue logic
  get s2(): number { return this.ch2; }
  get s3(): number { return this.ch3; }
  get s4(): number { return this.ch4; }
  get ringedBells(): Set<string> { return this.bells; }
  interact(tag: string) { this.runStepDialogue(tag); }
  // the boat beaches at the den door — first trip starts Chapter 4's interior
  beachDen() { if (this.ch3 === 0) this.setCh3(1); }
}
