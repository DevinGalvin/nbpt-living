import * as THREE from 'three';
import { Hud } from './hud';
import { GameAudio } from './audio';
import { brickTex } from '../three/textures';

// Chapter 1 — the smugglers' tunnel under the Firehouse. A small hand-built
// interior scene: the kid + Clipper move through brick corridors by lantern
// light, find the smuggler's mark, the torn map corner, and the collapse that
// points at Chapter 2. The Game swaps scenes; coordinates stay in world px.

const SAVE_KEY = 'nbpt-ch1-step';
// steps: 0 never entered · 1 inside, no light · 2 lantern (follow tunnel)
// 3 mark seen (search the cache) · 4 map found (find the way on)
// 5 rubble seen (head back up) · 6 done

type Line = { who: string; text: string };

const INTRO: Line[] = [
  { who: 'You', text: 'Okay. Okay okay okay.' },
  { who: '', text: 'Brick walls. Cold air. The street sounds are gone.' },
  { who: 'You', text: 'Clipper — stay close.' }
];
const LANTERN: Line[] = [
  { who: '', text: 'An old iron lantern hangs on a hook.' },
  { who: '', text: 'Someone meant to come back for it.' }
];
const MARK: Line[] = [
  { who: 'You', text: 'A carving in the brick — an anchor inside a circle.' },
  { who: '', text: 'Somebody marked this route. A long, long time ago.' }
];
const MAP: Line[] = [
  { who: '', text: 'On the crate: a torn map corner, drawn by hand. Three tunnels, running under downtown.' },
  { who: '', text: 'Faded ink in the corner: “1808.”' },
  { who: 'You', text: 'Clipper… people were sneaking things under the whole town.' }
];
const RUBBLE: Line[] = [
  { who: '', text: 'The tunnel ahead has collapsed. Brick and earth, floor to ceiling.' },
  { who: '', text: 'The map says it kept going — west. Under State Street.' },
  { who: 'You', text: 'Then we need the rest of that map.' }
];
const OBJECTIVES: (string | null)[] = [
  null,
  'Find a light',
  'Follow the tunnel',
  'Search the smugglers’ cache',
  'Find the way forward',
  'Head back up',
  null
];

// walkable corridors (axis-aligned, world px, y = 0 floor)
const RECTS: [number, number, number, number][] = [
  [-22, -340, 22, 32],      // A: entry + long north-south corridor
  [-310, -340, 22, -262],   // B: east-west corridor
  [-310, -452, -198, -340]  // C: the cache room
];

const ENTRY = { x: 0, z: 14 };          // where the kid lands coming down
const EXIT_Z = 24;                       // walking south of this = climb out
const HOOK = { x: 16, z: -10 };
const MARK_AT = { x: 16, z: -150 };
const MAP_AT = { x: -254, z: -400 };
const RUBBLE_AT = { x: -296, z: -300 };

function markTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(30, 24, 18, 0.85)';
  g.lineWidth = 7;
  g.beginPath();
  g.arc(64, 64, 44, 0, Math.PI * 2);
  g.stroke();
  // the anchor
  g.beginPath();
  g.moveTo(64, 30);
  g.lineTo(64, 88);
  g.moveTo(46, 52);
  g.lineTo(82, 52);
  g.arc(64, 70, 26, Math.PI * 0.15, Math.PI * 0.85);
  g.stroke();
  g.beginPath();
  g.arc(64, 24, 7, 0, Math.PI * 2);
  g.stroke();
  return new THREE.CanvasTexture(c);
}

function webTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.strokeStyle = 'rgba(225, 230, 238, 0.5)';
  g.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const a = (i / 6) * Math.PI / 2;
    g.beginPath();
    g.moveTo(2, 2);
    g.lineTo(2 + Math.cos(a) * 60, 2 + Math.sin(a) * 60);
    g.stroke();
  }
  for (const r of [16, 30, 46]) {
    g.beginPath();
    g.arc(2, 2, r, 0, Math.PI / 2);
    g.stroke();
  }
  return new THREE.CanvasTexture(c);
}

type Mouse = {
  g: THREE.Group; x: number; z: number;
  state: 'idle' | 'flee' | 'hidden';
  tx: number; tz: number; until: number;
};

const MOUSE_SPAWNS: [number, number][] = [[-60, -290], [8, -220], [-240, -372]];
const MOUSE_HOLES: [number, number][] = [[-300, -266], [16, -334], [-206, -446]];

export class TunnelScene {
  scene = new THREE.Scene();
  step: number;

  private hud: Hud;
  private audio: GameAudio;
  private lantern: THREE.PointLight;
  private lanternMesh: THREE.Group;
  private marker: THREE.Mesh;
  private markMesh: THREE.Mesh | null = null;
  private dust: THREE.Points | null = null;
  private held: THREE.Group | null = null;
  private mice: Mouse[] = [];
  private t = 0;
  private nearTag: string | null = null;
  private onExit: () => void;

  constructor(hud: Hud, audio: GameAudio, onExit: () => void) {
    this.hud = hud;
    this.audio = audio;
    this.onExit = onExit;
    this.step = Math.min(6, Math.max(0, parseInt(localStorage.getItem(SAVE_KEY) || '0', 10) || 0));

    this.scene.background = new THREE.Color('#04050a');
    this.scene.fog = new THREE.Fog('#04050a', 160, 620);
    this.scene.add(new THREE.AmbientLight('#5a6478', 0.22));

    // daylight spilling down the entry shaft (physical falloff: decay 1)
    const shaft = new THREE.PointLight('#9fb4cd', 200, 300, 1);
    shaft.position.set(ENTRY.x, 70, ENTRY.z + 6);
    this.scene.add(shaft);
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 16, 90, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: '#aebfd6', transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    );
    beam.position.set(ENTRY.x, 45, ENTRY.z + 6);
    this.scene.add(beam);

    // the kid's lantern (enabled on pickup) — held high so the kid's own
    // shadow doesn't swallow the light
    this.lantern = new THREE.PointLight('#ffd9a0', 0, 520, 1);
    this.lantern.castShadow = true;
    this.lantern.shadow.mapSize.set(512, 512);
    this.scene.add(this.lantern);
    if (this.step >= 2) this.lantern.intensity = 270;

    this.buildGeometry();

    // the lantern on its hook (hidden once taken)
    this.lanternMesh = this.buildLanternMesh();
    this.lanternMesh.position.set(HOOK.x + 3, 22, HOOK.z);
    this.lanternMesh.visible = this.step < 2;
    this.scene.add(this.lanternMesh);

    // soft gold marker over the active objective
    this.marker = new THREE.Mesh(
      new THREE.SphereGeometry(2.6, 10, 8),
      new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.85 })
    );
    this.scene.add(this.marker);

    // the lantern the kid carries once it's off the hook
    this.held = new THREE.Group();
    const hb = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.4, 2.4), new THREE.MeshLambertMaterial({ color: '#2e2a26' }));
    this.held.add(hb);
    const hg = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.1, 1.6), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }));
    this.held.add(hg);
    const hc = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.5, 6), new THREE.MeshLambertMaterial({ color: '#2e2a26' }));
    hc.position.y = 2.4;
    this.held.add(hc);
    this.held.visible = this.step >= 2;
    this.scene.add(this.held);

    // dust motes hanging in the daylight shaft
    const N = 80;
    const dp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      dp[i * 3] = ENTRY.x + (Math.random() - 0.5) * 30;
      dp[i * 3 + 1] = 4 + Math.random() * 84;
      dp[i * 3 + 2] = ENTRY.z + 6 + (Math.random() - 0.5) * 30;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({
      color: '#d8e2ee', size: 1.3, transparent: true, opacity: 0.45,
      depthWrite: false, blending: THREE.AdditiveBlending
    }));
    this.scene.add(this.dust);

    // mice
    for (let i = 0; i < 2; i++) {
      const m = this.buildMouse();
      const [sx, sz] = MOUSE_SPAWNS[i];
      const mouse: Mouse = { g: m, x: sx, z: sz, state: 'idle', tx: sx, tz: sz, until: 0 };
      m.position.set(sx, 0, sz);
      this.scene.add(m);
      this.mice.push(mouse);
    }
  }

  private buildMouse(): THREE.Group {
    const g = new THREE.Group();
    const fur = new THREE.MeshLambertMaterial({ color: '#56524a' });
    const body = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 6), fur);
    body.scale.set(1.15, 0.95, 1.9);
    body.position.y = 1.2;
    g.add(body);
    for (const sx of [-0.7, 0.7]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 5), fur);
      ear.position.set(sx, 2.1, 1.7);
      g.add(ear);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 3.4), new THREE.MeshLambertMaterial({ color: '#48443e' }));
    tail.position.set(0, 0.9, -3.6);
    g.add(tail);
    return g;
  }

  private buildGeometry() {
    const brick = new THREE.MeshLambertMaterial({ map: brickTex(), color: '#8a7a6e', side: THREE.DoubleSide });
    const wall = (cx: number, cz: number, w: number, d: number, h = 44) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), brick);
      m.position.set(cx, h / 2, cz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.scene.add(m);
    };
    // perimeter (A = entry corridor, B = west run, C = cache room)
    wall(26, -154, 8, 380);           // A east
    wall(-26, -115, 8, 302);          // A west, south of the B junction
    wall(0, 38, 60, 8, 14);           // entry curb (the shaft rises behind it)
    wall(-110, -344, 176, 8);         // B north, east of the cache doorway
    wall(-168, -258, 292, 8);         // B south
    wall(-194, -398, 8, 116);         // C east
    wall(-314, -355, 8, 202);         // C west + B west end
    wall(-254, -456, 128, 8);         // C north
    wall(0, -344, 60, 8);             // A north end

    // stone floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 560).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: '#46423c' })
    );
    floor.position.set(-145, 0, -210);
    floor.receiveShadow = true;
    this.scene.add(floor);

    // entry steps up toward the grate
    for (let i = 0; i < 4; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(34, 6 + i * 6, 10), new THREE.MeshLambertMaterial({ color: '#55504a' }));
      step.position.set(0, (6 + i * 6) / 2, 18 + i * 9);
      step.receiveShadow = true;
      this.scene.add(step);
    }

    // the smuggler's mark, carved at lantern height; glows faintly when sought
    this.markMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 15),
      new THREE.MeshLambertMaterial({ map: markTexture(), transparent: true, emissive: '#caa05a', emissiveIntensity: 0 })
    );
    this.markMesh.position.set(21.5, 24, MARK_AT.z);
    this.markMesh.rotation.y = -Math.PI / 2;
    this.scene.add(this.markMesh);

    // damp-tunnel dressing: cobwebs, puddles, moss, dropped bricks, old rope
    const webMat = new THREE.MeshBasicMaterial({ map: webTexture(), transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const webs: [number, number, number, number][] = [[16, 36, -334, -0.8], [16, 35, 26, 2.4], [-304, 34, -446, 0.8]];
    for (const [wx, wy, wz, ry] of webs) {
      const web = new THREE.Mesh(new THREE.PlaneGeometry(13, 13), webMat);
      web.position.set(wx, wy, wz);
      web.rotation.y = ry;
      this.scene.add(web);
    }
    const puddleMat = new THREE.MeshLambertMaterial({ color: '#232c36', emissive: '#2a3542', emissiveIntensity: 0.4 });
    const puddles: [number, number, number][] = [[8, -88, 9], [-12, -202, 6.5], [-120, -298, 10], [-262, -312, 7], [-282, -428, 8.5]];
    for (const [px2, pz2, pr] of puddles) {
      const puddle = new THREE.Mesh(new THREE.CircleGeometry(pr, 14).rotateX(-Math.PI / 2), puddleMat);
      puddle.position.set(px2, 0.22, pz2);
      puddle.scale.x = 1.4;
      this.scene.add(puddle);
    }
    const mossMat = new THREE.MeshLambertMaterial({ color: '#465a3c', transparent: true, opacity: 0.6 });
    const moss: [number, number, number, number][] = [
      [-21.6, -70, Math.PI / 2, 0], [21.6, -120, -Math.PI / 2, 0], [-21.6, -250, Math.PI / 2, 0],
      [-100, -261.6, Math.PI, 0], [-228, -261.6, Math.PI, 0], [-309.6, -396, Math.PI / 2, 0]
    ];
    for (const [mx, mz, ry] of moss) {
      const mp = new THREE.Mesh(new THREE.PlaneGeometry(16, 8), mossMat);
      mp.position.set(mx, 5, mz);
      mp.rotation.y = ry;
      this.scene.add(mp);
    }
    const brickA = new THREE.MeshLambertMaterial({ color: '#6e4a3a' });
    const brickB = new THREE.MeshLambertMaterial({ color: '#5e4034' });
    const debris: [number, number, number][] = [
      [14, -60, 0.4], [-16, -130, 1.2], [10, -240, 2.1], [-40, -300, 0.8], [-150, -270, 1.7],
      [-200, -330, 0.2], [-250, -350, 1.1], [-300, -388, 2.6], [-216, -430, 0.6]
    ];
    for (let i = 0; i < debris.length; i++) {
      const [dx, dz, rot] = debris[i];
      const db = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.2, 1.5), i % 2 ? brickA : brickB);
      db.position.set(dx, 0.6, dz);
      db.rotation.y = rot;
      db.castShadow = true;
      this.scene.add(db);
    }
    const rope = new THREE.Mesh(new THREE.TorusGeometry(3.4, 1.1, 6, 14).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#8a7048' }));
    rope.position.set(-230, 1.1, -352);
    rope.castShadow = true;
    this.scene.add(rope);

    // the cache: crates, barrels, and the map corner
    const wood = new THREE.MeshLambertMaterial({ color: '#6e5538' });
    const woodDark = new THREE.MeshLambertMaterial({ color: '#5a452e' });
    const crates: [number, number, number, number][] = [
      [-254, -400, 16, 0.2], [-238, -416, 13, 0.5], [-272, -420, 14, 0.9],
      [-290, -398, 12, 0.1], [-258, -380, 10, 0.7]
    ];
    for (const [cx, cz, sz, rot] of crates) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(sz, sz, sz), Math.random() < 0.5 ? wood : woodDark);
      crate.position.set(cx, sz / 2, cz);
      crate.rotation.y = rot;
      crate.castShadow = true;
      crate.receiveShadow = true;
      this.scene.add(crate);
    }
    for (const [bx, bz] of [[-222, -358], [-230, -368], [-300, -350]] as const) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(5.5, 5.5, 14, 10), woodDark);
      barrel.position.set(bx, 7, bz);
      barrel.castShadow = true;
      this.scene.add(barrel);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(5.7, 5.7, 1.4, 10), new THREE.MeshLambertMaterial({ color: '#3a322a' }));
      band.position.set(bx, 10, bz);
      this.scene.add(band);
    }
    // the map corner: parchment on the tallest crate
    const parchment = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 7).rotateX(-Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: '#d8c9a2' })
    );
    parchment.position.set(MAP_AT.x, 16.3, MAP_AT.z);
    parchment.rotation.z = 0.3;
    this.scene.add(parchment);

    // the collapse at the west end of B
    const gray = new THREE.MeshLambertMaterial({ color: '#5e5a54' });
    for (let i = 0; i < 14; i++) {
      const r = 5 + Math.random() * 8;
      const rock = new THREE.Mesh(new THREE.BoxGeometry(r, r, r), gray);
      rock.position.set(-296 - Math.random() * 12, r / 2 + Math.random() * 18, -300 + (Math.random() - 0.5) * 70);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      this.scene.add(rock);
    }
  }

  private buildLanternMesh(): THREE.Group {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 5, 3.4), new THREE.MeshLambertMaterial({ color: '#2e2a26' }));
    g.add(body);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3, 2.2), new THREE.MeshBasicMaterial({ color: '#ffd9a0' }));
    g.add(glow);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2, 6), new THREE.MeshLambertMaterial({ color: '#2e2a26' }));
    cap.position.y = 3.4;
    g.add(cap);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(0.8, 6, 0.8), new THREE.MeshLambertMaterial({ color: '#3a342c' }));
    hook.position.set(0, 6, 0);
    g.add(hook);
    return g;
  }

  // axis-separated collision against the corridor rectangles
  free(x: number, z: number): boolean {
    for (const [x0, z0, x1, z1] of RECTS) {
      if (x > x0 + 6 && x < x1 - 6 && z > z0 + 6 && z < z1 - 6) return true;
    }
    return false;
  }

  enter() {
    if (this.step === 0) {
      this.setStep(1);
      setTimeout(() => this.hud.showDialogue(INTRO), 450);
    } else {
      this.apply();
    }
  }

  private interactable(): { tag: string; x: number; z: number; label: string } | null {
    if (this.step === 1) return { tag: 'lantern', x: HOOK.x, z: HOOK.z, label: '\u{1FA94} TAKE' };
    if (this.step === 2) return { tag: 'mark', x: MARK_AT.x, z: MARK_AT.z, label: '\u{1F440} LOOK' };
    if (this.step === 3) return { tag: 'map', x: MAP_AT.x, z: MAP_AT.z, label: '\u{1F9E9} TAKE' };
    if (this.step === 4) return { tag: 'rubble', x: RUBBLE_AT.x, z: RUBBLE_AT.z, label: '\u{1F440} LOOK' };
    return null;
  }

  private setStep(s: number) {
    this.step = s;
    localStorage.setItem(SAVE_KEY, String(s));
    this.apply();
  }

  private apply() {
    this.hud.setObjective(OBJECTIVES[this.step]);
    const chips: string[] = [];
    if (this.step >= 2) chips.push('\u{1FA94}');
    if (this.step >= 4) chips.push('\u{1F9E9}');
    this.hud.setChips(chips);
    const it = this.interactable();
    this.marker.visible = !!it;
    if (it) this.marker.position.set(it.x, it.tag === 'mark' ? 34 : 26, it.z);
  }

  update(dt: number, px: number, pz: number) {
    this.t += dt;
    this.lantern.position.set(px, 48, pz);
    this.lantern.intensity = this.step >= 2 ? 262 + Math.sin(this.t * 7) * 16 : 0;
    if (this.held) {
      this.held.visible = this.step >= 2;
      this.held.position.set(px + 7.2, 12.5 + Math.sin(this.t * 5.2), pz + 2.5);
    }
    if (this.markMesh) {
      const mm = this.markMesh.material as THREE.MeshLambertMaterial;
      mm.emissiveIntensity = this.step === 2 ? 0.32 + 0.24 * Math.sin(this.t * 2.8) : this.step > 2 ? 0.12 : 0;
    }
    if (this.dust) {
      const attr = this.dust.geometry.getAttribute('position') as THREE.BufferAttribute;
      const a = attr.array as Float32Array;
      for (let i = 0; i < a.length / 3; i++) {
        a[i * 3 + 1] += Math.sin(this.t * 0.6 + i) * dt * 1.6 + dt * 1.1;
        a[i * 3] += Math.sin(this.t * 0.4 + i * 2.3) * dt * 0.9;
        if (a[i * 3 + 1] > 90) a[i * 3 + 1] = 4;
      }
      attr.needsUpdate = true;
    }
    this.updateMice(dt, px, pz);
    if (this.marker.visible) {
      const m = this.marker.material as THREE.MeshBasicMaterial;
      m.opacity = 0.55 + 0.35 * Math.sin(this.t * 3.4);
    }

    if (this.hud.dialogueOpen) {
      if (this.nearTag) { this.nearTag = null; this.hud.showTalk(null); }
      return;
    }
    // climbing back out
    if (pz > EXIT_Z) {
      if (this.step >= 5) this.setStep(6);
      this.hud.showTalk(null);
      this.nearTag = null;
      this.onExit();
      return;
    }
    const it = this.interactable();
    const near = it && Math.hypot(px - it.x, pz - it.z) < 42 ? it : null;
    if ((near && near.tag) !== this.nearTag) {
      this.nearTag = near ? near.tag : null;
      this.hud.showTalk(near ? near.label : null, () => this.tryInteract(px, pz));
    }
  }

  tryInteract(px: number, pz: number) {
    if (this.hud.dialogueOpen) return;
    const it = this.interactable();
    if (!it || Math.hypot(px - it.x, pz - it.z) > 48) return;
    this.hud.showTalk(null);
    this.nearTag = null;
    if (it.tag === 'lantern') {
      this.hud.showDialogue(LANTERN, () => {
        this.lanternMesh.visible = false;
        this.audio.jingle();
        this.setStep(2);
      });
    } else if (it.tag === 'mark') {
      this.hud.showDialogue(MARK, () => this.setStep(3));
    } else if (it.tag === 'map') {
      this.hud.showDialogue(MAP, () => {
        this.audio.jingle();
        this.setStep(4);
      });
    } else if (it.tag === 'rubble') {
      this.hud.showDialogue(RUBBLE, () => this.setStep(5));
    }
  }

  private updateMice(dt: number, px: number, pz: number) {
    for (const m of this.mice) {
      if (m.state === 'hidden') {
        if (this.t > m.until) {
          // respawn at the spot farthest from the kid
          let best: [number, number] = MOUSE_SPAWNS[0], bd = -1;
          for (const sp of MOUSE_SPAWNS) {
            const d = Math.hypot(sp[0] - px, sp[1] - pz);
            if (d > bd) { bd = d; best = sp; }
          }
          m.x = best[0];
          m.z = best[1];
          m.state = 'idle';
          m.g.visible = true;
        }
        continue;
      }
      const dKid = Math.hypot(px - m.x, pz - m.z);
      if (m.state === 'idle') {
        if (dKid < 72) {
          // bolt for the nearest hole
          let best: [number, number] = MOUSE_HOLES[0], bd = Infinity;
          for (const h of MOUSE_HOLES) {
            const d = Math.hypot(h[0] - m.x, h[1] - m.z);
            if (d < bd) { bd = d; best = h; }
          }
          m.tx = best[0];
          m.tz = best[1];
          m.state = 'flee';
        } else if (this.t > m.until) {
          m.tx = m.x + (Math.random() - 0.5) * 50;
          m.tz = m.z + (Math.random() - 0.5) * 50;
          m.until = this.t + 1.6 + Math.random() * 2.4;
        }
      }
      const speed = m.state === 'flee' ? 115 : 24;
      const dx = m.tx - m.x, dz = m.tz - m.z;
      const d = Math.hypot(dx, dz);
      if (d > 2) {
        m.x += (dx / d) * speed * dt;
        m.z += (dz / d) * speed * dt;
        m.g.rotation.y = Math.atan2(dx, dz);
        m.g.position.set(m.x, Math.abs(Math.sin(this.t * 16)) * 0.5, m.z);
      } else if (m.state === 'flee') {
        m.state = 'hidden';
        m.g.visible = false;
        m.until = this.t + 13 + Math.random() * 9;
      }
    }
  }

  get done(): boolean {
    return this.step >= 6;
  }
}

export const TUNNEL_ENTRY = ENTRY;
