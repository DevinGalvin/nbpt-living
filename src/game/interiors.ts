import * as THREE from 'three';
import { Hud } from './hud';
import { GameAudio } from './audio';

// Chapter 4/5 hand-built interior scenes — the Wharf Rats' den (reached by boat
// at low tide) and the star room beneath the Custom House. Same register as the
// tunnel: the Game swaps scenes, the kid + Clipper walk by a follow-light, and a
// floating gold marker points at the live interactable. All beats route back
// through the quest's own dialogue logic via getQuest().interact(tag).

// what the interiors need from the quest (kept structural to avoid a circular import)
export interface QuestLike {
  s2: number;   // Chapter 3 "The Daily News" step (this.ch2)
  s3: number;
  s4: number;
  ringedBells: Set<string>;
  interact(tag: string): void;
}

type Spot = { tag: string; x: number; z: number; label: string };
const EXIT_Z = 2; // walking south of this climbs back out to the world

function box(w: number, h: number, d: number, x: number, y: number, z: number, hex: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: hex }));
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function cyl(rt: number, rb: number, h: number, seg: number, x: number, y: number, z: number, hex: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), new THREE.MeshLambertMaterial({ color: hex }));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}
function floor(w: number, d: number, z: number, hex: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: hex }));
  m.position.set(0, 0, z);
  m.receiveShadow = true;
  return m;
}

export abstract class Interior {
  scene = new THREE.Scene();
  abstract readonly name: string;
  protected abstract readonly bounds: [number, number, number, number][];

  protected hud: Hud;
  protected audio: GameAudio;
  protected getQuest: () => QuestLike | null;
  protected onExit: () => void;
  protected light: THREE.PointLight;
  protected marker: THREE.Mesh;
  protected t = 0;
  nearTag: string | null = null;

  constructor(hud: Hud, audio: GameAudio, onExit: () => void, getQuest: () => QuestLike | null) {
    this.hud = hud;
    this.audio = audio;
    this.onExit = onExit;
    this.getQuest = getQuest;
    this.build();
    // a warm follow-light keeps the room readable around the kid
    this.light = new THREE.PointLight('#ffe6c0', 360, 1000);
    this.scene.add(this.light);
    this.marker = new THREE.Mesh(
      new THREE.CapsuleGeometry(2.6, 10, 4, 8),
      new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.85, depthWrite: false })
    );
    this.marker.visible = false;
    this.scene.add(this.marker);
  }

  protected abstract build(): void;
  protected abstract interactable(): Spot | null;

  free(x: number, z: number): boolean {
    for (const [n, i, s, o] of this.bounds) {
      if (x > n + 6 && x < s - 6 && z > i + 6 && z < o - 6) return true;
    }
    return false;
  }

  update(dt: number, px: number, pz: number) {
    this.t += dt;
    this.light.position.set(px, 52, pz);
    const it = this.interactable();
    this.marker.visible = !!it;
    if (it) {
      this.marker.position.set(it.x, 24 + Math.sin(this.t * 2.4) * 1.6, it.z);
      (this.marker.material as THREE.MeshBasicMaterial).opacity = 0.55 + 0.35 * Math.sin(this.t * 3.4);
    }
    if (this.hud.dialogueOpen) {
      if (this.nearTag) { this.nearTag = null; this.hud.showTalk(null); }
      return;
    }
    if (pz > EXIT_Z) {
      this.hud.showTalk(null);
      this.nearTag = null;
      this.onExit();
      return;
    }
    const near = it && Math.hypot(px - it.x, pz - it.z) < 44 ? it : null;
    if ((near && near.tag) !== this.nearTag) {
      this.nearTag = near ? near.tag : null;
      this.hud.showTalk(near ? near.label : null, () => this.tryInteract(px, pz));
    }
  }

  tryInteract(px: number, pz: number) {
    if (this.hud.dialogueOpen) return;
    const it = this.interactable();
    if (!it || Math.hypot(px - it.x, pz - it.z) > 46) return;
    this.hud.showTalk(null);
    this.nearTag = null;
    this.getQuest()?.interact(it.tag);
  }
}

// ---------- the Wharf Rats' den, below the seawall on State Street ----------

const DEN_LEDGER_AT = { x: -20, z: -118 };
const DEN_MAP_AT = { x: 35, z: -138 };
const DEN_BELL_AT = { x: 62, z: -40 };

export class DenScene extends Interior {
  readonly name = 'the Wharf Rats’ den';
  protected readonly bounds: [number, number, number, number][] = [[-85, -170, 85, 14]];

  protected build() {
    this.scene.background = new THREE.Color('#0c1118');
    this.scene.fog = new THREE.Fog('#0c1118', 360, 900);
    this.scene.add(new THREE.AmbientLight('#9a9080', 1.0));
    const blue = new THREE.PointLight('#7cc8e4', 90, 360);
    blue.position.set(-66, 16, -90);
    this.scene.add(blue);
    this.scene.add(floor(190, 200, -78, '#56524a'));
    // walls
    for (const [w, h, d, x, y, z] of [
      [80, 44, 8, -49, 22, 18], [80, 44, 8, 49, 22, 18],
      [8, 44, 200, 89, 22, -78], [8, 44, 200, -89, 22, -78], [186, 44, 8, 0, 22, -174]
    ] as const) this.scene.add(box(w, h, d, x, y, z, '#8a7a6e'));
    // a flooded channel where the boat came in
    const water = new THREE.Mesh(new THREE.PlaneGeometry(26, 150).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#1d4458' }));
    water.position.set(-72, 1.4, -85);
    this.scene.add(water);
    this.scene.add(box(10, 4, 26, -72, 2.5, -60, '#6e4520'));
    this.scene.add(box(7, 2, 20, -72, 4.6, -60, '#8a6b46'));
    // crates of two-hundred-year-old nothing
    for (const [x, z, s] of [[40, -80, 12], [54, -92, 9], [30, -95, 8], [-30, -150, 11], [-10, -155, 8], [60, -150, 10], [18, -70, 7]] as const)
      this.scene.add(box(s, s, s, x, s / 2, z, '#7a5c3a'));
    for (const [x, z] of [[-40, -70], [-30, -78], [70, -110]] as const)
      this.scene.add(cyl(5, 5, 11, 9, x, 5.5, z, '#5e4a30'));
    // the ledger on a barrel-top
    this.scene.add(cyl(5.5, 5.5, 12, 9, DEN_LEDGER_AT.x, 6, DEN_LEDGER_AT.z - 6, '#5e4a30'));
    this.scene.add(box(16, 1.4, 10, DEN_LEDGER_AT.x, 13, DEN_LEDGER_AT.z - 6, '#6e5638'));
    this.scene.add(box(7, 1.2, 9, DEN_LEDGER_AT.x, 14.3, DEN_LEDGER_AT.z - 6, '#d8cdb0'));
    // the third map corner under a dram glass
    this.scene.add(box(9, 9, 9, DEN_MAP_AT.x, 4.5, DEN_MAP_AT.z - 4, '#7a5c3a'));
    this.scene.add(box(6, 0.8, 7, DEN_MAP_AT.x, 9.4, DEN_MAP_AT.z - 4, '#e2d6b4'));
    // the ship's bell, green with age
    this.scene.add(box(2, 10, 2, DEN_BELL_AT.x, 4, DEN_BELL_AT.z - 4, '#3a342c'));
    this.scene.add(box(10, 2, 2, DEN_BELL_AT.x, 14.6, DEN_BELL_AT.z - 4, '#3a342c'));
    this.scene.add(cyl(4.2, 5.8, 8, 10, DEN_BELL_AT.x, 9, DEN_BELL_AT.z - 4, '#5e7a64'));
  }

  protected interactable(): Spot | null {
    const q = this.getQuest();
    if (!q) return null;
    if (q.s3 === 1) return { tag: 'ledger', x: DEN_LEDGER_AT.x, z: DEN_LEDGER_AT.z, label: '\u{1F4D6} READ' };
    if (q.s3 === 2) return { tag: 'wmap', x: DEN_MAP_AT.x, z: DEN_MAP_AT.z, label: '\u{1F9E9} TAKE' };
    if (q.s3 === 3) return { tag: 'bell', x: DEN_BELL_AT.x, z: DEN_BELL_AT.z, label: '\u{1F514} RING' };
    if (q.s4 === 1 && !q.ringedBells.has('den')) return { tag: 'dbell', x: DEN_BELL_AT.x, z: DEN_BELL_AT.z, label: '\u{1F514} RING' };
    return null;
  }
}

// ---------- the star room, granite below the granite of the Custom House ----------

const STAR_CORNER_AT = { x: 35, z: -100 };
const STAR_CHEST_AT = { x: -38, z: -104 };

export class StarRoomScene extends Interior {
  readonly name = 'beneath the Custom House';
  protected readonly bounds: [number, number, number, number][] = [[-75, -140, 75, 14]];

  protected build() {
    this.scene.background = new THREE.Color('#13141c');
    this.scene.add(new THREE.AmbientLight('#a89e88', 0.95));
    this.scene.add(floor(170, 170, -63, '#8f8c84'));
    for (const [w, h, d, x, y, z] of [
      [70, 40, 8, -42, 20, 18], [70, 40, 8, 42, 20, 18],
      [8, 40, 170, 79, 20, -63], [8, 40, 170, -79, 20, -63], [166, 40, 8, 0, 20, -144]
    ] as const) this.scene.add(box(w, h, d, x, y, z, '#a8a59c'));
    // the star inlaid in the floor — granite disc + eight brass points
    this.scene.add(cyl(27, 27, 1, 18, 0, 0.7, -70, '#6e6a60'));
    for (let k = 0; k < 4; k++) {
      const bar = box(46, 0.8, 6.5, 0, 1.5, -70, '#caa84a');
      bar.rotation.y = (k * Math.PI) / 4;
      this.scene.add(bar);
    }
    // the pedestal holding the fourth corner
    this.scene.add(box(20, 2, 10, STAR_CORNER_AT.x, 11, STAR_CORNER_AT.z - 4, '#6e5638'));
    this.scene.add(box(2.5, 10, 2.5, STAR_CORNER_AT.x - 7, 5, STAR_CORNER_AT.z - 4, '#5e4a30'));
    this.scene.add(box(2.5, 10, 2.5, STAR_CORNER_AT.x + 7, 5, STAR_CORNER_AT.z - 4, '#5e4a30'));
    this.scene.add(box(6, 0.6, 7, STAR_CORNER_AT.x, 12.3, STAR_CORNER_AT.z - 4, '#e2d6b4'));
    // the cedar chest, banded in brass
    this.scene.add(box(16, 9, 10, STAR_CHEST_AT.x, 4.5, STAR_CHEST_AT.z - 4, '#7a5230'));
    this.scene.add(box(16.6, 2, 10.6, STAR_CHEST_AT.x, 10, STAR_CHEST_AT.z - 4, '#8a6240'));
    this.scene.add(box(1.6, 11, 10.4, STAR_CHEST_AT.x - 5, 5.5, STAR_CHEST_AT.z - 4, '#b89040'));
    this.scene.add(box(1.6, 11, 10.4, STAR_CHEST_AT.x + 5, 5.5, STAR_CHEST_AT.z - 4, '#b89040'));
    for (const [x, z] of [[-70, -50], [-70, -90], [70, -50], [70, -90]] as const)
      this.scene.add(box(8, 22, 26, x, 11, z, '#56504a'));
  }

  protected interactable(): Spot | null {
    const q = this.getQuest();
    if (!q) return null;
    if (q.s4 === 2) return { tag: 'corner4', x: STAR_CORNER_AT.x, z: STAR_CORNER_AT.z, label: '\u{1F9E9} TAKE' };
    if (q.s4 === 3) return { tag: 'chest', x: STAR_CHEST_AT.x, z: STAR_CHEST_AT.z, label: '⭐ OPEN' };
    return null;
  }
}

// ---------- the Daily News newsroom, on Liberty Street (Chapter 3) ----------

const NEWS_EDITOR_AT = { x: 8, z: -120 };
const NEWS_MORGUE_AT = { x: -56, z: -92 };

export class NewsroomScene extends Interior {
  readonly name = 'the Daily News';
  protected readonly bounds: [number, number, number, number][] = [[-82, -156, 82, 14]];

  protected build() {
    this.scene.background = new THREE.Color('#262b34');
    this.scene.fog = new THREE.Fog('#262b34', 320, 820);
    this.scene.add(new THREE.AmbientLight('#e8dcbd', 1.3));             // bright, warm office light
    const win = new THREE.PointLight('#fff4dc', 175, 640);             // daylight pouring in the front window
    win.position.set(-52, 34, 8);
    this.scene.add(win);
    const lamp = new THREE.PointLight('#bfe6c0', 55, 210);              // the editor's green desk lamp
    lamp.position.set(NEWS_EDITOR_AT.x + 14, 20, NEWS_EDITOR_AT.z);
    this.scene.add(lamp);
    for (const cz of [-34, -112]) {                                    // two overhead office lights
      const c = new THREE.PointLight('#fff4dc', 105, 460);
      c.position.set(0, 46, cz);
      this.scene.add(c);
    }

    this.scene.add(floor(184, 184, -70, '#9c8159'));                   // warm plank floor
    for (const [w, h, d, x, y, z] of [
      [82, 48, 8, -41, 24, 18], [82, 48, 8, 41, 24, 18],               // front wall (door gap in the middle)
      [8, 48, 184, 82, 24, -70], [8, 48, 184, -82, 24, -70],           // sides
      [172, 48, 8, 0, 24, -156]                                        // back
    ] as const) this.scene.add(box(w, h, d, x, y, z, '#b6ad97'));      // lighter plaster walls

    // bright front window beside the door + a "DAILY NEWS" masthead on the back wall
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(34, 24), new THREE.MeshBasicMaterial({ color: '#dceaf2' }));
    glass.position.set(-52, 24, 13.4);
    this.scene.add(glass);
    this.scene.add(box(64, 13, 1.5, 0, 35, -151, '#2a2d33'));
    this.scene.add(box(58, 7, 2, 0, 35, -150.4, '#d8cdb0'));

    // the editor's desk + a seated editor behind it (back of the room)
    const ex = NEWS_EDITOR_AT.x, ez = NEWS_EDITOR_AT.z;
    this.scene.add(box(34, 11, 15, ex, 5.5, ez, '#6e5236'));            // desk body
    this.scene.add(box(36, 1.6, 16, ex, 11.5, ez, '#7a5c3a'));          // desk top
    this.scene.add(box(9, 1, 11, ex - 9, 12.6, ez, '#ece6d6'));         // stacked papers
    this.scene.add(box(7, 4.5, 7, ex + 8, 14, ez, '#3a3d42'));          // typewriter
    this.scene.add(box(1.4, 7, 1.4, ex + 15, 15, ez, '#6e5638'));       // lamp stem
    this.scene.add(box(5.4, 1.8, 3.4, ex + 15, 18.6, ez, '#3a7a4a'));   // green lamp shade
    const fz = ez - 11;
    this.scene.add(box(11, 13, 8, ex, 10, fz, '#5a6678'));             // editor torso
    this.scene.add(box(2.8, 9, 2.8, ex - 7, 10, fz + 2, '#5a6678'));    // arms to the desk
    this.scene.add(box(2.8, 9, 2.8, ex + 7, 10, fz + 2, '#5a6678'));
    this.scene.add(box(7.4, 6.4, 6.6, ex, 19.5, fz, '#d8b08c'));        // head
    this.scene.add(box(8.4, 2.6, 7.4, ex, 23, fz, '#3c3c40'));          // newsboy cap

    // the printing press (right side) — a dark machine with a paper roll + fresh sheets
    this.scene.add(box(30, 30, 26, 56, 15, -104, '#3a3d42'));
    this.scene.add(box(33, 6, 28, 56, 31, -104, '#4a4d52'));
    this.scene.add(cyl(7, 7, 24, 12, 56, 18, -86, '#5a5040'));          // paper roll
    this.scene.add(box(22, 2, 12, 49, 9, -82, '#e8e2d2'));              // sheets sliding out

    // the morgue / archives (left) — a bank of filing cabinets
    for (let i = 0; i < 3; i++) {
      const cx = NEWS_MORGUE_AT.x - 18 + i * 18;
      this.scene.add(box(15, 30, 13, cx, 15, NEWS_MORGUE_AT.z - 7, '#5e4a30'));
      for (let d = 0; d < 4; d++) this.scene.add(box(12, 1, 1.2, cx, 6 + d * 7, NEWS_MORGUE_AT.z - 0.6, '#cdbf94')); // drawer handles
    }
    // a second bank of cabinets along the back-left wall
    for (const cz of [-126, -144]) {
      this.scene.add(box(14, 30, 14, -71, 15, cz, '#5e4a30'));
      for (let d = 0; d < 4; d++) this.scene.add(box(1.2, 1, 11, -63.4, 6 + d * 7, cz, '#cdbf94'));
    }

    // reporter desks down both sides — typewriter, paper stack, chair
    const reporterDesk = (dx: number, dz: number) => {
      this.scene.add(box(24, 10, 13, dx, 5, dz, '#6e5236'));            // desk
      this.scene.add(box(26, 1.4, 14, dx, 10.7, dz, '#7a5c3a'));        // top
      this.scene.add(box(6, 4.5, 6, dx + 6, 13, dz, '#3a3d42'));        // typewriter
      this.scene.add(box(8, 1, 9, dx - 6, 11.6, dz, '#ece6d6'));        // paper stack
      this.scene.add(box(9, 8.5, 9, dx, 4.5, dz + 13, '#5a4632'));      // chair seat
      this.scene.add(box(9, 8, 1.6, dx, 12, dz + 17.5, '#5a4632'));     // chair back
    };
    reporterDesk(-46, -46); reporterDesk(46, -42); reporterDesk(-50, -72);

    // scattered newspapers — bundles on the floor + loose sheets everywhere
    for (const [x, z, s] of [[40, -60, 8], [31, -50, 7], [-22, -56, 8], [-34, -50, 6], [64, -62, 7], [16, -118, 7], [-60, -118, 6]] as const)
      this.scene.add(box(s * 1.4, s, s, x, s / 2, z, '#d8d2c2'));
    for (const [x, z] of [[-16, -30], [24, -34], [-52, -102], [52, -120], [12, -66], [-30, -116], [70, -90], [-8, -96]] as const)
      this.scene.add(box(7, 0.4, 9, x, 0.4, z, '#e8e2d2'));            // loose sheets on the floor
  }

  protected interactable(): Spot | null {
    const q = this.getQuest();
    if (!q) return null;
    if (q.s2 === 0 || q.s2 === 2) return { tag: 'editor', x: NEWS_EDITOR_AT.x, z: NEWS_EDITOR_AT.z + 6, label: '\u{1F4AC} TALK' };
    if (q.s2 === 3) return { tag: 'morgue', x: NEWS_MORGUE_AT.x, z: NEWS_MORGUE_AT.z + 8, label: '\u{1F5C4} SEARCH' };
    return null;
  }
}
