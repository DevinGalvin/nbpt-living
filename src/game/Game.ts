import * as THREE from 'three';
import type { WorldData } from '../world/types';
import { WorldIndex, CHUNK } from '../world/index';
import { Terrain } from '../world/terrain';
import { buildChunkDecor } from '../three/decor';
import { detailTex } from '../three/textures';
import { buildWater, WATER_Y } from '../three/water';
import { Sky } from '../three/sky';
import { Kid, Dog, Bike, buildKayak } from '../three/actors';
import { Life } from './life';
import { GillisBridge } from '../three/gillis';
import { Hud } from './hud';
import { QuestRunner, BOAT_ARRIVE } from './quest';
import { TunnelScene, TUNNEL_ENTRY } from './tunnel';
import { DenScene, StarRoomScene, NewsroomScene, Interior } from './interiors';
import { HistoryRunner, SITES } from './history';
import { RaceRunner, COURSES, refreshBoards, getRaceName, setRaceName, hasRaceName, getBoard, courseMiles, courseEstSeconds, ghostEnabled, setGhostEnabled } from './race';
import { EggRunner } from './eggs';
import { GameAudio } from './audio';
import { STYLE, SEASON } from '../world/style';
import { TOWN } from '@town';

// World-only sandbox: towns without an authored story spine run bare — no
// quest / history / eggs / interiors chrome. `?story` force-enables the spine
// for development in any town.
const BARE = !TOWN.story && !new URLSearchParams(location.search).has('story');

const JOG = 200;     // world px/s (8 px = 1 m) — fast, gamey
const SPRINT = 380;
const BOAT_DOOR = { x: -224, z: -1183 }; // the waterline den door — rowing near it beaches you
const TOWER_LOOK = { x: 2412, z: 255 };  // 🔦 the Level 2 finale: where you stand at the Rear Range Light to sweep the beam (just south, facing the harbor)

// ✈️ scenic flight — per-town (Plum Island Airport / Winter Island / …); the
// boarding spot, heading, and FLY-zone live in the town pack. Cozy + can't
// crash — the point is seeing the town from the air.
const RUNWAY_START = TOWN.flight.runwayStart;
const RUNWAY_HDG = TOWN.flight.runwayHdg;
const AIRPORT = TOWN.flight.airport;
const CRUISE_ALT = 540;                       // hold ~a few hundred ft over the ground
const CRUISE_SPEED = 860;                     // forward px/s — quicker than the bike, still gentle

// micro-detail grain multiplied over every ground chunk (keeps surfaces textured up close)
let _detail: THREE.CanvasTexture | null = null;
const DETAIL_REPEATS = (CHUNK / 48).toFixed(1);
function detailInject(shader: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }) {
  if (!_detail) _detail = detailTex();
  shader.uniforms.uDetail = { value: _detail };
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec2 vDetailUv;')
    .replace('#include <uv_vertex>', `#include <uv_vertex>\nvDetailUv = uv * ${DETAIL_REPEATS};`);
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform sampler2D uDetail;\nvarying vec2 vDetailUv;')
    .replace('#include <map_fragment>', '#include <map_fragment>\n{ vec3 dg = texture2D(uDetail, vDetailUv).rgb; diffuseColor.rgb *= mix(vec3(1.0), dg * 2.0, 0.55); }');
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

interface ChunkEntry {
  ground: THREE.Mesh | null;        // null for decor-only chunks (mobile flight) — impostor is the ground
  decor: THREE.Mesh | null;
  tex: THREE.CanvasTexture | null;  // null when there's no ground mesh
  signs: THREE.Mesh[];
  decorOnly: boolean;               // built without ground/signs (cheap, churn-safe) for phone flight
}

// real store signs: small canvas-texture boards mounted on the building edge
function makeSignMesh(name: string): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.fillStyle = 'rgba(26, 32, 40, 0.92)';
  g.beginPath();
  g.roundRect(2, 2, 252, 60, 9);
  g.fill();
  g.strokeStyle = '#d8b94a';
  g.lineWidth = 2.5;
  g.stroke();
  g.fillStyle = '#f6f3e8';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 30;
  do {
    g.font = `600 ${size}px Georgia, serif`;
    size -= 2;
  } while (g.measureText(name).width > 236 && size > 12);
  g.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(36, 9),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
  );
  return mesh;
}

export class Game {
  private world: WorldData;
  private terrain: Terrain;
  private index: WorldIndex;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private kid = new Kid();
  private dog = new Dog();
  private bike = new Bike();
  private riding = false;
  private hud = new Hud();
  private audio = new GameAudio();
  private nearWater = false;

  private px = 0;
  private pz = 40;
  private camZoom = 0.82;    // 0.55 (close) .. 2.4 (far)
  private life: Life | null = null;
  private gillis: GillisBridge | null = null;
  private quest: QuestRunner | null = null;
  private sky!: Sky;
  private tunnel: TunnelScene | null = null;
  private history: HistoryRunner | null = null;
  private race: RaceRunner | null = null;
  private eggs: EggRunner | null = null;
  private golden = false;
  private inTunnel = false;
  private preTunnel = { x: 0, z: 0 };
  // hand-built interiors (newsroom, den, star room) reuse the tunnel's scene-swap plumbing
  private den: DenScene | null = null;
  private star: StarRoomScene | null = null;
  private news: NewsroomScene | null = null;
  private interior: Interior | null = null; // active newsroom/den/star, if any
  private preInterior = { x: 0, z: 0 };
  // Chapter 4 boat ride: an overground locomotion mode out to the den door
  private boating = false;
  private beached = false;
  private rideBoat: THREE.Group | null = null;
  private boatAz = 0;
  private boatReturn = { x: 0, z: 0 };
  // 🛶 the free-roam kayak (Level 2): launch anywhere at the water's edge, paddle the
  // harbor/marsh confined to water, hop out on any shore. An earned, player-driven
  // cousin of the Ch4 boat ride (same water-confined movement + on-water pose).
  private kayaking = false;
  private kayak: THREE.Group | null = null;
  private kayakAz = 0;
  // 🔦 Level 2 finale: the lighthouse beam-sweep. The player stands locked at the
  // Rear Range Light and rotates the beam (left/right) across the dark harbor; the
  // chase cam looks out along it (reusing the cineLook cutaway path).
  private sweeping = false;
  private beamAz = Math.PI;          // beam compass direction (π = due north, out over the water)
  private stormOn = false;           // the nor'easter ambiance is engaged (idempotent)
  private nightHeld = false;          // Level 2 walking-light mystery: the sky is held at winter dusk
  // ✈️ scenic flight (Plum Island Airport): a free overground flight mode
  private flying = false;
  private ridePlane: THREE.Group | null = null;
  private ridePlaneProp: THREE.Object3D | null = null;
  private flyY = 0;            // plane altitude (world Y)
  private planeAz = 0;         // heading (yaw)
  private planeRoll = 0;       // visual bank into turns, eased
  private planePitch = 0;      // visual pitch, eased
  private flySpeed = 0;        // forward speed, ramps up for takeoff
  private flyPhase: 'roll' | 'climb' | 'cruise' = 'roll';
  private flyAct: string | null = null;   // edge state for the Game-owned action button (FLY/LAND/KAYAK/HOP OUT)
  private skirt: THREE.Mesh | null = null;        // ✈️ ground skirt — fills the far void off the map's edge
  private impostor: THREE.Mesh | null = null;     // world-fixed low-res map under the chunks (anti-pop-in)
  private flightEnabled = true;   // ✈️ scenic flight is now PUBLIC — open to everyone (was dev-gated behind ?fly)
  private keys = new Set<string>();
  private chunks = new Map<string, ChunkEntry>();
  private pending: string[] = [];
  private lastTime = 0;
  // perf: weak/software GPU detected at startup; dynamic-resolution sampler state
  private lowGPU = false;
  // touch/phone-class device: iOS Safari (and mobile browsers generally) impose a hard
  // per-tab memory cap and will silently reload — then crash — the page if it's exceeded.
  // Flight streams a far bigger chunk set than walking, so we shrink that set on these devices.
  private mobile = false;
  private dynScale = 0; // current dynamic pixel ratio (0 = not yet initialised)
  private fpsAccum = 0; // seconds accumulated in the current FPS sample window
  private fpsFrames = 0; // frames counted in the current FPS sample window
  private pollAcc = 0;
  private sprinting = false;
  private debugVec: { x: number; y: number; until: number } | null = null;
  private waterUpdate: ((t: number) => void) | null = null;
  private kidY = 0;
  private hopT = 0; private wasNearFence = false;       // kid hops low fences
  private dogHopT = 0; private dogWasNearFence = false; // so does Clipper
  private dogY = 0;
  private fov = 55;
  private camAz = Math.PI;          // camera azimuth (behind-the-back chase)
  private aimX = 0; private aimZ = 0; // smoothed heading — kids hold a line, turns round off
  private camClamp = 1;             // occlusion pull-in (1 = full distance)
  private chaseCam = true;          // C toggles chase <-> north-up map view
  private cineLook: { x: number; z: number } | null = null;  // scripted "look out to sea" cutaway (the birdwatcher reveal)
  private autoRun = false;          // R toggles always-run
  private runTipShown = localStorage.getItem('nbpt-run-tip') === '1'; // one-time "press R to run" nudge
  private walkAccum = 0;
  private places: { label: string; sub: string; x: number; y: number }[] = [];
  private sun!: THREE.DirectionalLight;
  private hemi!: THREE.HemisphereLight;
  // street lamps: a small pool of warm lights + ground-glow discs that follow the
  // nearest lamps and fade in at night (lighting every mapped lamp would be too many)
  private lampLights: THREE.PointLight[] = [];
  private lampGlows: THREE.Mesh[] = [];
  private lampGlowMat!: THREE.MeshBasicMaterial;
  private lampSpots: { x: number; z: number; gy: number }[] = [];

  constructor(world: WorldData, terrain: Terrain) {
    this.world = world;
    this.terrain = terrain;
    this.index = new WorldIndex(world, terrain);

    // weak/integrated GPUs can't afford MSAA; skip it there. The dynamic-resolution
    // loop (see updateDynamicResolution) handles everything in between at runtime.
    this.lowGPU = Game.detectLowGPU();
    try {
      this.mobile = (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches)
        || (navigator.maxTouchPoints || 0) > 0;
    } catch { this.mobile = false; }
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowGPU });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight, false); // false: let CSS size the canvas (full-bleed)
    this.renderer.setClearColor(STYLE.sky);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game')!.appendChild(this.renderer.domElement);

    const fogRange: [number, number] = SEASON === 'fall' ? TOWN.fall.fogRange : SEASON === 'winter' ? [1250, 2900] : [1500, 3200];
    this.scene.fog = new THREE.Fog(STYLE.sky, fogRange[0], fogRange[1]);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 10, 6000);

    this.hemi = SEASON === 'winter' ? new THREE.HemisphereLight('#dde9f8', '#a8b2bc', 0.55)
      : SEASON === 'fall' ? new THREE.HemisphereLight(TOWN.fall.hemiSky, TOWN.fall.hemiGround, TOWN.fall.hemiIntensity)
      : new THREE.HemisphereLight('#e3f2fd', '#90a06c', 0.5);
    this.sun = new THREE.DirectionalLight(SEASON === 'winter' ? '#ffe0b0' : SEASON === 'fall' ? '#ffd9a0' : '#fff2d8', SEASON === 'summer' ? 1.5 : 1.4);
    this.sun.castShadow = true;
    // 1024² is a quarter of the shadow texels — a big win on weak GPUs
    const shadowRes = this.lowGPU ? 1024 : 2048;
    this.sun.shadow.mapSize.set(shadowRes, shadowRes);
    this.sun.shadow.camera.left = -1500;
    this.sun.shadow.camera.right = 1500;
    this.sun.shadow.camera.top = 1500;
    this.sun.shadow.camera.bottom = -1500;
    this.sun.shadow.camera.near = 100;
    this.sun.shadow.camera.far = 4000;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 3;
    this.sun.shadow.camera.updateProjectionMatrix();
    this.scene.add(this.hemi, this.sun, this.sun.target, this.kid.root, this.dog.root);
    // day–night cycle + weather; winter precipitation falls as snow
    // Halloween towns open at spooky dusk in fall (per-town knob)
    this.sky = new Sky(this.scene, { startTod: SEASON === 'fall' && TOWN.fall.duskStart ? 0.78 : 0.34, period: 420, snow: SEASON === 'winter' });

    // street-lamp lighting pool: a soft warm glow disc on the ground + a real
    // PointLight, both reassigned to the nearest lamps and lit only at night
    const gtex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 128;
      const gx = c.getContext('2d')!;
      const grd = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
      grd.addColorStop(0, 'rgba(255, 222, 158, 0.95)');
      grd.addColorStop(0.4, 'rgba(255, 201, 120, 0.45)');
      grd.addColorStop(1, 'rgba(255, 190, 110, 0)');
      gx.fillStyle = grd; gx.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();
    this.lampGlowMat = new THREE.MeshBasicMaterial({
      map: gtex, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, opacity: 0, fog: false
    });
    for (let i = 0; i < 16; i++) {
      const disc = new THREE.Mesh(new THREE.PlaneGeometry(135, 135), this.lampGlowMat);
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(0, -1000, 0);
      disc.renderOrder = 3;
      disc.visible = false;
      this.lampGlows.push(disc);
      this.scene.add(disc);
      const L = new THREE.PointLight('#ffd49a', 0, 170, 2);
      L.position.set(0, -1000, 0);
      this.lampLights.push(L);
      this.scene.add(L);
    }
    this.kid.root.traverse((o) => { o.castShadow = true; });
    this.dog.root.traverse((o) => { o.castShadow = true; });

    const water = buildWater(world);
    this.scene.add(water.mesh);
    if (water.ice) this.scene.add(water.ice);
    this.waterUpdate = water.update;

    this.life = new Life(this.scene, this.index);
    if (!BARE) this.gillis = new GillisBridge(this.scene, this.index, world);

    // spawn downtown (per-town) — or, after a season turned the town, exactly where
    // you stood (a one-shot resume point so the re-skin reload doesn't teleport you)
    let sx = TOWN.spawn.x, sz = TOWN.spawn.z;
    try {
      const r = JSON.parse(localStorage.getItem('nbpt-resume-pos') || 'null');
      if (r && typeof r.x === 'number' && typeof r.z === 'number') { sx = r.x; sz = r.z; }   // keep it: the poll keeps it current, so any refresh resumes here; a story reset clears it
    } catch { /* ignore */ }
    const spawn = this.findFree(sx, sz);
    this.px = spawn.x;
    this.pz = spawn.y;
    this.kid.setPos(this.px, this.pz);
    this.dog.root.position.set(this.px - 22, 0, this.pz + 16);
    this.ensureRect(true);
    this.impostor = this.buildImpostor();   // low-res whole-map LOD under the chunks (kills the yellow pop-in)
    this.updateCamera(0, true);

    this.hud.initTravel(
      world.landmarks.map((l) => ({ id: l.id, name: l.name, sub: l.sub })),
      (id) => this.hud.fadeThrough(() => this.travelTo(id))
    );
    // the missions log (🧭 / J) + the backpack (🎒 / I) — both share the history
    // markers (for the Town-stories collection + its album)
    const histMarkers = SITES.map((s) => ({ id: s.id, title: s.title, year: s.year, body: s.body, stamp: s.stamp }));
    this.hud.initMissions(histMarkers);
    this.hud.initBag(histMarkers);
    // searchable places: landmarks, businesses, named areas/buildings, streets
    for (const lm of world.landmarks) this.places.push({ label: lm.name, sub: lm.sub, x: lm.x, y: lm.y });
    for (const p of world.pois) this.places.push({ label: p.n, sub: p.k.replace(/_/g, ' '), x: p.x, y: p.y });
    for (const l of world.labels) this.places.push({ label: l.t, sub: l.k === 'water' ? 'water' : l.k === 'bldg' ? 'building' : 'place', x: l.x, y: l.y });
    {
      const longest = new Map<string, number>();
      world.roads.forEach((r, i) => {
        if (!r.n) return;
        const prev = longest.get(r.n);
        if (prev === undefined || world.roads[prev].p.length < r.p.length) longest.set(r.n, i);
      });
      for (const [name, ri] of longest) {
        const p = world.roads[ri].p;
        const mid = Math.floor(p.length / 4) * 2;
        this.places.push({ label: name, sub: 'street', x: p[mid], y: p[mid + 1] });
      }
      const seen = new Set<string>();
      this.places = this.places.filter((p) => {
        const k = p.label.toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }
    this.hud.initSearch(
      (q) => this.searchPlaces(q),
      (r) => this.hud.fadeThrough(() => {
        this.travelToXY(r.x, r.y);
        // magic words credit their secret once you arrive
        const egg = (r as { egg?: string }).egg;
        if (egg) this.eggs?.creditSearch(egg);
      })
    );
    this.hud.initSound(this.audio.enabled, () => this.audio.toggle());
    this.hud.initRun(() => {
      this.autoRun = !this.autoRun;
      return this.autoRun;
    });
    this.hud.initBike(() => {
      this.toggleBike();
      return this.riding;
    });
    this.hud.showBike(true);   // bikes are baseline gameplay now — no story gate (the Ch3 beat still hands one over narratively)
    this.bike.root.visible = false;
    this.scene.add(this.bike.root);
    this.hud.initMinimap(world);
    if (BARE) {
      // world-only sandbox: no quest / history / eggs. Hide the story-only chrome
      // (compass, missions, the Story settings row) — racing + vehicles stay live.
      this.hud.setBare(true);
      this.hud.initSettings(false, () => false);
    } else {
      this.quest = new QuestRunner(this.scene, this.index, this.hud, this.audio, () => this.enterTunnel(), () => {
        localStorage.setItem('nbpt-bike', '1');
        this.bikeEarned();
      }, () => this.boatRide(), () => this.enterStar(), () => this.enterNews(), () => this.enterDen(),
        (x: number, z: number) => this.lookOutToSea(x, z), () => this.endLookOut(), () => this.enterKayak(),
        (x: number, z: number) => this.landAtShore(x, z),
        () => this.beginStorm(), () => this.enterSweep(), () => this.endSweep());
      // ⚙️ Story-mode toggle: explore vs play. The quest is the source of truth, so the
      // switch mirrors whatever it actually applies.
      this.hud.initSettings(this.quest.story, (next) => { this.quest!.setStory(next); return this.quest!.story; });
      this.history = new HistoryRunner(this.scene, this.index, this.hud, this.audio);
    }
    this.hud.initGhost(ghostEnabled(), () => setGhostEnabled(!ghostEnabled()));
    // fade to a course's start line and begin — the picker path AND the results
    // card's RACE AGAIN both ride this
    const startRace = (id: string) => {
      const c = COURSES.find((k) => k.id === id);
      if (!c || !this.race) return;
      this.hud.fadeThrough(() => { this.travelToXY(c.start.x, c.start.z); this.race!.startById(id); });
    };
    this.race = new RaceRunner(this.scene, this.index, this.hud, this.audio, (on) => this.lendBike(on),
      // at the start line, spin the chase cam to face down-course — the first thing a
      // dropped-in racer sees is the way to go
      (dx, dz) => { this.camAz = Math.atan2(-dx, dz); this.updateCamera(0, true); },
      startRace);
    // 🏁 front door: pick a course anywhere in town → fade to its start line → countdown.
    // (The in-world start flag still works for players who ride up to it.)
    this.hud.initRaces(
      () => COURSES.map((c) => ({ id: c.id, name: c.name, sub: c.sub, miles: courseMiles(c), est: courseEstSeconds(c), best: this.race!.bestFor(c.id), leader: getBoard(c.id)[0] || null })),
      startRace,
      // naming yourself from the picker also banks any held unnamed runs
      { get: getRaceName, set: (raw) => { const r = setRaceName(raw); if (r.ok) this.race?.flushPending(); return r; }, has: hasRaceName },
      () => this.race?.quit(),
      (id) => this.race?.showBoard(id),
      // opening the 🏁 picker freshens every course's town board from the cloud
      (onFresh) => refreshBoards(COURSES.map((c) => c.id), onFresh),
    );
    if (!BARE) this.eggs = new EggRunner(
      this.scene, this.index, this.hud, this.audio,
      () => ({ x: this.dog.root.position.x, z: this.dog.root.position.z }),
      () => this.goldenHoodie()
    );

    // tap (or click) Clipper to pet him — replaces the old always-on PET button
    this.hud.onTap = (sx, sy) => this.tryPetTap(sx, sy);

    if (SEASON === 'winter') {
      // the big town tree (snow now falls from the Sky weather system)
      if (TOWN.holidayTree) this.scene.add(this.buildHolidayTree(TOWN.holidayTree.x, TOWN.holidayTree.z));
    } else if (SEASON === 'fall') {
      // a Halloween patch downtown — scarecrow, pumpkins, hay bales
      this.scene.add(this.buildHalloweenDisplay(TOWN.halloweenDisplay.x, TOWN.halloweenDisplay.z));
    }

    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return; // typing an address, not playing
      this.keys.add(e.code);
      if (e.code === 'KeyC') this.chaseCam = !this.chaseCam;
      if (e.code === 'KeyL' && this.flying) this.land();
      if (e.code === 'KeyE' && !this.hud.dialogueOpen) {
        if (this.inTunnel) this.tunnel?.tryInteract(this.px, this.pz);
        else if (this.interior) this.interior.tryInteract(this.px, this.pz);
        else if (!this.race?.active) {   // mid-race E must never open a movement-freezing dialogue
          this.quest?.tryInteract(this.px, this.pz);
          this.history?.tryInteract(this.px, this.pz);
          this.eggs?.tryInteract(this.px, this.pz);
        }
      }
      if (e.code === 'KeyM') this.hud.toggleTravel();
      if (e.code === 'KeyR') {
        this.autoRun = !this.autoRun;
        this.hud.setRunState(this.autoRun);
      }
      if (e.code === 'KeyB') this.toggleBike();
      const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].indexOf(e.code);
      if (n >= 0) {
        const travel = ['market-square', 'boardwalk', 'frog-pond', 'marchs-hill', 'mbta', 'gillis', 'airport', 'pink-house', 'pi-light'];
        this.hud.fadeThrough(() => this.travelTo(travel[n]));
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('wheel', (e) => {
      // don't zoom the world when scrolling inside an open HUD panel — let the panel
      // scroll natively (panels are pointer-events:none when closed, so this only
      // matches while one is actually open)
      if ((e.target as HTMLElement)?.closest?.('.journey-panel, .bag-panel, .travel-panel, .album-panel')) return;
      this.camZoom = Math.min(2.4, Math.max(0.55, this.camZoom * (1 + Math.sign(e.deltaY) * 0.09)));
    }, { passive: true });
    // Re-fit the drawing buffer to the canvas's real displayed size. Using the
    // canvas client size (CSS-driven, full-bleed) instead of innerHeight dodges the
    // iOS standalone bug where innerHeight is wrong until the viewport settles.
    const onResize = () => {
      const c = this.renderer.domElement;
      const w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
    window.visualViewport?.addEventListener('resize', onResize);
    // home-screen launches report the viewport late — re-fit after it settles
    onResize();
    setTimeout(onResize, 200);
    setTimeout(onResize, 700);

    // debug/demo hooks
    (window as unknown as Record<string, unknown>).nbpt = {
      travel: (id: string) => this.travelTo(id),
      go: (x: number, y: number) => this.travelToXY(x, y),
      find: (q: string) => this.searchPlaces(q),
      pos: () => ({ x: this.px, y: this.pz }),
      zoom: (z: number) => { this.camZoom = Math.min(2.4, Math.max(0.55, z)); },
      walk: (x: number, y: number, ms: number) => { this.debugVec = { x, y, until: performance.now() + ms }; },
      season: (sn: string) => { location.search = '?season=' + sn; },   // dev override (works anytime)
      time: (t: number) => this.sky.setTod(t),            // 0=midnight 0.25=dawn 0.5=noon 0.75=dusk
      weather: (w: number | null) => this.sky.forceWeather(w), // 1=shower 0=clear null=auto
      fly: () => this.enterPlane(),                       // ✈️ board the plane at Plum Island Airport
      land: () => this.land(),
      // quick health probe — mobile flag, live chunk count, flight state, JS heap if exposed
      diag: () => ({
        mobile: this.mobile, flying: this.flying, chunks: this.chunks.size,
        heapMB: Math.round((((performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize) || 0) / 1048576),
      }),
      _quest: this.quest,
      // dev: teleport to a course start + begin it (nbpt.race() = the homecoming run)
      race: (id = TOWN.devCourse) => {
        const c = COURSES.find((k) => k.id === id);
        if (!c || !this.race) return 'unknown course: ' + id;
        this.travelToXY(c.start.x, c.start.z);
        return this.race.startById(id) ? 'racing ' + c.name : 'could not start';
      },
      landmarks: world.landmarks.map((l) => l.id),
      _game: this,
      _THREE: THREE
    };

    this.renderer.setAnimationLoop((t) => this.frame(t));
    document.getElementById('loading')?.style.setProperty('opacity', '0');
    setTimeout(() => document.getElementById('loading')?.remove(), 700);

    // newcomers land straight in the 3-D town — let that "suddenly in Newburyport"
    // shock land first, then offer the explore-vs-story choice (most of our users are
    // mobile and many just want to wander), and finally a light nudge to find their own
    // street. No gate — dismissing the pick just keeps the clean explore default.
    const fresh = localStorage.getItem('nbpt-welcomed') !== '1';
    if (BARE) {
      // no story to pick a mode for — keep only the street nudge
      if (fresh) setTimeout(() => this.hud.showStreetNudge(() => localStorage.setItem('nbpt-welcomed', '1')), 1500);
    } else if (fresh) {
      setTimeout(() => this.hud.showModePick((story) => {
        this.quest?.setStory(story);
        this.hud.refreshSettings(this.quest?.story ?? false);
        // one tip at a time: street nudge first (7s), then — for explorers — the
        // gear hint takes its turn (hintStoryToggle also self-defers if anything
        // from the nudge is still on screen)
        setTimeout(() => this.hud.showStreetNudge(() => localStorage.setItem('nbpt-welcomed', '1')), 600);
        if (!story) setTimeout(() => this.hud.hintStoryToggle(), 8600);
      }), 1500);
    } else {
      // "what's new" promos wait for the SECOND visit: a first session already carries
      // the mode pick + street nudge + gear hint, and the promo was landing right on a
      // newcomer's first TALK tap. Returning players get it once things settle.
      setTimeout(() => this.tryRacePromo(), 3500);
    }
  }

  // "what's new" cards, one per visit so nobody gets promo-stacked: racing headlines
  // (the gameplay-first era), flight takes the next visit. Each waits until nothing
  // else is on screen — never lands on top of a dialogue, modal, or cutaway.
  private promoBusy(): boolean {
    return this.inside || this.flying || this.onWater || this.hud.dialogueOpen || (this.race?.active ?? false)
      || !!document.querySelector('#hud .chapter.show, #hud .levelpromo.show, #hud .streettip.show, #hud .modepick.show, #hud .travel-panel.open, #hud .journey-panel.show, #hud .bag-panel.show, #hud .hcard.open, #hud .board-panel.show');
  }
  private tryRacePromo() {
    if (localStorage.getItem('nbpt-promo-race') === '1') { this.tryFlightPromo(); return; }
    if (this.promoBusy()) { setTimeout(() => this.tryRacePromo(), 2500); return; }
    const featured = COURSES.find((c) => c.id === TOWN.racePromo.course);
    this.hud.featurePromo({
      key: 'nbpt-promo-race', badge: 'NEW', icon: '🏁', title: 'Race the Town',
      body: TOWN.racePromo.body,
      cta: 'Take me to the start line',
      onCta: () => {
        if (!featured || !this.race) return;
        this.hud.fadeThrough(() => { this.travelToXY(featured.start.x, featured.start.z); this.race!.startById(TOWN.racePromo.course); });
      },
    });
  }
  private tryFlightPromo() {
    if (localStorage.getItem('nbpt-promo-flight') === '1') return;
    if (this.promoBusy()) { setTimeout(() => this.tryFlightPromo(), 2500); return; }
    this.hud.featurePromo({
      key: 'nbpt-promo-flight', badge: 'NEW', icon: '✈️', title: 'Take Flight',
      body: TOWN.flight.promoBody,
      cta: TOWN.flight.promoCta, onCta: () => this.travelToXY(AIRPORT.x, AIRPORT.z)
    });
  }

  // ---------- chunk streaming ----------

  private ensureRect(sync = false) {
    const z = this.camZoom;
    const fx = Math.sin(this.camAz), fz = Math.cos(this.camAz);
    // cover around the player and ahead along the camera's forward direction. Flight
    // sees far + moves fast, so load a big ring + a long forward corridor — the town is
    // rendered before you reach it instead of popping in at the nose.
    // PHONES IN FLIGHT: stream DECOR-ONLY chunks (3D buildings/scenery, shared materials, no
    // per-chunk textures) over the whole-map impostor — so you see the town's 3D shape from the
    // air without the 768² ground-texture churn that OOM-crashes the tab. Use a tighter ring than
    // desktop (decor is cheap, but it still churns at cruise) — the impostor fills everything else.
    //
    // WALKING: each "center" below loads the whole mx±rad SQUARE (not a disk). Two squares offset
    // *diagonally* along the camera-forward vector don't fully overlap — they leave an uncovered
    // wedge in the off-diagonal direction that widens with zoom, so zoomed-out you'd get a blurry
    // impostor patch sitting right beside you. One forward-biased square is gap-free by construction;
    // reach/ahead are clamped so a max zoom-out can't balloon the live chunk set (and OOM phones).
    const decorOnly = this.mobile && this.flying;
    const reach = Math.max(1000, Math.min(2400, 1280 * z));   // half-extent of the loaded square
    const ahead = Math.max(500, Math.min(1200, 1000 * z));    // bias it toward where you're looking
    const centers: [number, number, number][] = this.flying
      ? (this.mobile
          ? [
              [this.px, this.pz, 1500],
              [this.px + fx * 2200, this.pz + fz * 2200, 1150],
            ]
          : [
              [this.px, this.pz, 1950],
              [this.px + fx * 2200, this.pz + fz * 2200, 1650],
              [this.px + fx * 4300, this.pz + fz * 4300, 1250],
            ])
      : [
          [this.px + fx * ahead, this.pz + fz * ahead, reach]
        ];
    for (const [mx, mz, rad] of centers) {
      const x0 = Math.floor((mx - rad) / CHUNK), x1 = Math.floor((mx + rad) / CHUNK);
      const z0 = Math.floor((mz - rad) / CHUNK), z1 = Math.floor((mz + rad) / CHUNK);
      for (let cy = z0; cy <= z1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const key = cx + ',' + cy;
          if (!this.chunks.has(key) && !this.pending.includes(key)) {
            if (sync) this.buildChunk(key, decorOnly);
            else this.pending.push(key);
          }
        }
      }
    }
    if (this.pending.length) {
      const pcx = this.px / CHUNK, pcy = this.pz / CHUNK;
      this.pending.sort((a, b) => {
        const [ax, ay] = a.split(',').map(Number);
        const [bx, by] = b.split(',').map(Number);
        return ((ax - pcx) ** 2 + (ay - pcy) ** 2) - ((bx - pcx) ** 2 + (by - pcy) ** 2);
      });
      // build the flight corridor briskly; decor-only chunks (phone flight) are cheap, so the
      // ground texture churn that forced a gentle budget is gone
      let budget = this.flying ? 4 : 2;
      while (budget-- > 0 && this.pending.length) this.buildChunk(this.pending.shift()!, decorOnly);
    }
    // evict farthest. Desktop flight keeps a big working set (no streaming-in "render" show);
    // walking holds 110; phone flight holds 90 cheap decor-only chunks (no ground textures).
    const cap = this.flying ? (this.mobile ? 90 : 200) : 110;
    while (this.chunks.size > cap) {
      let worstKey = '', worstD = -1;
      for (const key of this.chunks.keys()) {
        const [cx, cy] = key.split(',').map(Number);
        const d = ((cx + 0.5) * CHUNK - this.px) ** 2 + ((cy + 0.5) * CHUNK - this.pz) ** 2;
        if (d > worstD) { worstD = d; worstKey = key; }
      }
      this.disposeChunk(worstKey);
    }
  }

  // Build a chunk. `decorOnly` (mobile flight) skips the expensive per-chunk ground texture +
  // mesh and the canvas-textured signs — only the 3D building/scenery decor (shared materials,
  // no per-chunk textures) is added, riding over the whole-map impostor. That keeps the town's
  // 3D shape visible from the air without the 768² CanvasTexture churn that OOM-crashes phones.
  private buildChunk(key: string, decorOnly = false) {
    if (this.chunks.has(key)) return;
    const [cx, cy] = key.split(',').map(Number);
    const cxw = (cx + 0.5) * CHUNK, cyw = (cy + 0.5) * CHUNK;

    let ground: THREE.Mesh | null = null;
    let tex: THREE.CanvasTexture | null = null;
    if (!decorOnly) {
      const canvas = this.index.groundCanvas(key);
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
      // terrain-displaced ground with analytic normals (seamless across chunks)
      const geo = new THREE.PlaneGeometry(CHUNK, CHUNK, 24, 24);
      geo.rotateX(-Math.PI / 2);
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      const normAttr = geo.attributes.normal as THREE.BufferAttribute;
      const n = { x: 0, y: 1, z: 0 };
      for (let i = 0; i < posAttr.count; i++) {
        const wx = cxw + posAttr.getX(i);
        const wz = cyw + posAttr.getZ(i);
        posAttr.setY(i, this.terrain.heightAt(wx, wz));
        this.terrain.normalAt(wx, wz, n);
        normAttr.setXYZ(i, n.x, n.y, n.z);
      }
      const groundMat = new THREE.MeshLambertMaterial({ map: tex });
      groundMat.onBeforeCompile = detailInject;
      ground = new THREE.Mesh(geo, groundMat);
      ground.position.set(cxw, 0, cyw);
      ground.receiveShadow = true;
      this.scene.add(ground);
    }

    const decor = buildChunkDecor(this.world, this.index, key);
    if (decor) this.scene.add(decor);

    const signs: THREE.Mesh[] = [];
    if (!decorOnly) {
      for (const s of this.index.shopSignsFor(key)) {
        const mesh = makeSignMesh(s.name);
        mesh.position.set(s.x, this.terrain.heightAt(s.x, s.z) + 22.5, s.z);
        mesh.rotation.y = s.rotY;
        this.scene.add(mesh);
        signs.push(mesh);
      }
    }

    this.chunks.set(key, { ground, decor, tex, signs, decorOnly });
  }

  private disposeChunk(key: string) {
    const e = this.chunks.get(key);
    if (!e) return;
    if (e.ground) {
      this.scene.remove(e.ground);
      e.ground.geometry.dispose();
      (e.ground.material as THREE.Material).dispose();
    }
    if (e.tex) e.tex.dispose();
    if (e.decor) {
      this.scene.remove(e.decor);
      e.decor.geometry.dispose();
    }
    for (const s of e.signs) {
      this.scene.remove(s);
      s.geometry.dispose();
      const m = s.material as THREE.MeshBasicMaterial;
      m.map?.dispose();
      m.dispose();
    }
    this.chunks.delete(key);
  }

  // dispose every loaded chunk. Used on the phone flight transitions so each side rebuilds in the
  // right mode: takeoff sheds the ground-textured walking chunks (free the memory); landing sheds
  // the decor-only flight chunks so the full-detail ground (not the low-res impostor) returns.
  private clearChunks() {
    for (const key of [...this.chunks.keys()]) this.disposeChunk(key);
    this.pending.length = 0;
  }

  // ---------- movement ----------

  toggleBike() {
    if (this.inside || this.onWater) return;   // bikes are everyone's — only indoors/water say no
    this.riding = !this.riding;
    this.bike.root.visible = this.riding;
    this.hud.setBikeState(this.riding);
    this.audio.bell();
    // NOTE: hopping off mid-race is legal — locals cut through alleys on foot. Only the
    // ✕ on the race clock, fast travel, or the finish line end a run.
  }

  /** Take the bike off, unconditionally. The tunnel/interior entries flip their
   *  indoor flag before dismounting, so the guarded toggleBike() above would
   *  no-op there — this path always works (and skips the bell). */
  private dismount() {
    if (!this.riding) return;
    this.riding = false;
    this.bike.root.visible = false;
    this.hud.setBikeState(false);
    // races survive this on purpose: kayak hops, foot shortcuts and the ✈️ cheat are
    // all legal mid-race — only the ✕ on the race clock or fast travel end a run early
  }

  /** Races auto-mount you at the start line; the finish leaves you in the saddle
   *  (bikes are baseline now, so there's nothing to hand back). */
  private lendBike(on: boolean) {
    if (!on) return;
    if (this.riding || this.inside || this.onWater) return;
    this.riding = true;
    this.bike.root.visible = true;
    this.hud.setBikeState(true);
    this.audio.bell();
  }

  /** Tap-to-pet: a tap/click near Clipper on screen pets him (hearts + the secret).
   *  Replaces the always-on PET button — the dog's screen position is hit-tested. */
  private tryPetTap(sx: number, sy: number) {
    if (!this.eggs || this.hud.dialogueOpen) return;
    const p = this.dog.root.position.clone();
    p.y += 6;                       // aim at the dog's body, not his feet
    p.project(this.camera);
    if (p.z > 1) return;            // dog is behind the camera
    const dx = (p.x * 0.5 + 0.5) * window.innerWidth;
    const dy = (-p.y * 0.5 + 0.5) * window.innerHeight;
    if (Math.hypot(sx - dx, sy - dy) < 75) this.eggs.petDog();
  }

  // surfaces the button the moment the bike is earned
  bikeEarned() {
    this.hud.showBike(true);
  }

  // ---------- 🛶 the free-roam kayak (Level 2) ----------

  // launch from the shore: drop the kid into the nearest open water just offshore
  enterKayak() {
    if (this.kayaking || this.inside || this.boating || this.flying) return;
    let lx = this.px, lz = this.pz, found = false;
    for (let r = 18; r < 240 && !found; r += 12) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const x = this.px + Math.cos(a) * r, y = this.pz + Math.sin(a) * r;
        if (this.index.isOpenWaterAt(x, y)) { lx = x; lz = y; found = true; break; }
      }
    }
    if (!found) {                       // no open water nearby — SAY so; a tap that does nothing reads as broken
      this.hud.announce('🛶 No open water here', 'get closer to the river or the sea, then try again');
      return;
    }
    this.dismount();
    this.kayaking = true;
    this.hud.kayaking = true;           // the quest yields its action button (HOP OUT owns it)
    if (!this.kayak) { this.kayak = buildKayak(); this.scene.add(this.kayak); }
    this.kayak.visible = true;
    this.kayakAz = this.camAz;
    this.px = lx; this.pz = lz;
    this.kidY = WATER_Y;
    this.kid.setPos(this.px, this.pz);
    this.audio.gull();
    this.quest?.refresh();
    this.updateCamera(0.016, true);
  }

  // hop out onto the nearest dry, unblocked shore (findFree already avoids water)
  exitKayak() {
    if (!this.kayaking) return;
    const spot = this.findFree(this.px, this.pz);
    this.kayaking = false;
    this.hud.kayaking = false;
    if (this.kayak) this.kayak.visible = false;
    this.px = spot.x; this.pz = spot.y;
    this.kidY = Math.max(this.terrain.heightAt(this.px, this.pz), this.index.deckHeightAt(this.px, this.pz));
    this.kid.setPos(this.px, this.pz);
    this.dog.root.position.set(this.px - 20, this.kidY, this.pz + 12);
    this.quest?.refresh();
    this.updateCamera(0.016, true);
  }

  // Scripted return ashore (Level 2): used when a chapter ends out in the kayak (e.g. the
  // Ch2 walking-light reveal at the far light), so the player isn't stranded 7000px out
  // with their next objective back at the slip. Hop out and set the kid down on the nearest
  // dry shore to (x,z) — the Joppa slip — ready to walk to the lobsterman.
  landAtShore(x: number, z: number) {
    const spot = this.findFree(x, z);
    this.kayaking = false;
    this.hud.kayaking = false;
    if (this.kayak) this.kayak.visible = false;
    this.px = spot.x; this.pz = spot.y;
    this.kidY = Math.max(this.terrain.heightAt(this.px, this.pz), this.index.deckHeightAt(this.px, this.pz));
    this.kid.setPos(this.px, this.pz);
    this.dog.root.position.set(this.px - 20, this.kidY, this.pz + 12);
    this.ensureRect(true);              // the slip is far from the light — stream its chunks now
    this.quest?.refresh();
    this.updateCamera(0.016, true);
  }

  // ---------- 🔦 the Level 2 finale: the storm + the beam-sweep ----------

  // the nor'easter rolls in: hold the sky at a deep stormy dusk and force heavy
  // snow. Idempotent — the lobsterman's send-off calls it, and apply() re-asserts
  // it on a reload mid-finale (the Sky state itself isn't persisted).
  beginStorm() {
    if (this.stormOn) return;
    this.stormOn = true;
    this.sky.duskIn(0.985);        // deep night (deeper than the Ch1 reveal's 0.955)
    this.sky.forceWeather(1);      // a full winter blow
  }

  // the storm passes — ease back to a calm, bright Christmas morning and let the
  // natural weather (gentle winter showers) resume.
  private calmStorm() {
    if (!this.stormOn) return;
    this.stormOn = false;
    this.nightHeld = false;        // the long night is over; release the mystery's dusk-hold too
    this.sky.duskOut(0.22);        // ease all the way to a bright winter Christmas morning (not back to whenever the storm hit)
    this.sky.forceWeather(null);   // release to auto (light winter snow)
  }

  // Level 2 "walking light" mystery (after the Ch1 reveal, through Ch3): hold the sky at a
  // deep winter twilight so the ghost light is paddled at dusk, as the premise promises —
  // not in broad daylight. The frame loop polls quest.l2Night to engage/release this; the
  // storm (Ch4) takes the sky over from here, and the finale calms it to morning.
  private holdNight() {
    if (this.nightHeld || this.stormOn) return;
    this.nightHeld = true;
    this.sky.duskIn(0.9);          // blue-hour twilight — moody but navigable; the gold beacon + lamps pop
  }
  private releaseNight() {
    if (!this.nightHeld) return;
    this.nightHeld = false;
    if (!this.stormOn) this.sky.duskOut();   // back to the natural cycle (the storm, if up, keeps its own sky)
  }

  // climb the Rear Range Light and take the beam: lock the player at the tower,
  // point the beam north over the harbor, and look out along it. The chase cam +
  // movement freeze are reused from the look-out-to-sea cutaway (cineLook).
  enterSweep() {
    if (this.sweeping || this.inside || this.flying) return;
    if (this.kayaking) this.exitKayak();
    this.beamAz = Math.PI;                 // due north, out over the dark water
    // stand just south of the tower, facing the harbor, so the beam rakes away from you
    this.px = TOWER_LOOK.x; this.pz = TOWER_LOOK.z;
    this.kidY = Math.max(this.terrain.heightAt(this.px, this.pz), this.index.deckHeightAt(this.px, this.pz));
    this.kid.setPos(this.px, this.pz);
    this.kid.root.rotation.y = Math.PI;    // face north
    this.dog.root.position.set(this.px + 16, this.kidY, this.pz + 6);
    this.sweeping = true;
    this.hud.sweeping = true;              // the quest yields its action button + reads beamAz
    this.hud.beamAz = this.beamAz;
    this.cineLook = { x: this.px + Math.sin(this.beamAz) * 4000, z: this.pz + Math.cos(this.beamAz) * 4000 };
    this.ensureRect(true);                 // stream the harbor chunks out ahead of the beam
    this.quest?.refresh();
    this.updateCamera(0.016, true);
  }

  // the fleet's home: drop the beam-sweep (the quest plays the town-answer), but
  // leave the light lit — it stays burning over the calm harbor.
  endSweep() {
    if (!this.sweeping) return;
    this.sweeping = false;
    this.hud.sweeping = false;
    this.cineLook = null;
    this.calmStorm();
    this.quest?.refresh();
    this.updateCamera(0.016, true);
  }

  // is there dry, unblocked land within a short hop? (gates the HOP OUT button)
  private landNear(): boolean {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const x = this.px + Math.cos(a) * 70, y = this.pz + Math.sin(a) * 70;
      if (!this.index.isWaterAt(x, y) && !this.index.isBlocked(x, y)) return true;
    }
    return false;
  }

  // true whenever the player is in any hand-built interior (tunnel/den/star)
  private get inside(): boolean {
    return this.inTunnel || this.interior !== null;
  }

  // on the water in either mode (the Ch4 ride or the free-roam kayak) — shared
  // rendering: water height, the seated rowing pose, Clipper in the bow, no fence-hop
  private get onWater(): boolean { return this.boating || this.kayaking; }
  private get kayakEarned(): boolean { return true; }   // kayaks are baseline gameplay now (L2 still gifts one narratively)

  // ---------- the tunnels (Chapter 1) ----------

  enterTunnel() {
    this.hud.fadeThrough(() => {
      if (!this.tunnel) this.tunnel = new TunnelScene(this.hud, this.audio, () => this.exitTunnel());
      this.preTunnel = { x: this.px, z: this.pz };
      this.inTunnel = true;
      this.tunnel.scene.add(this.kid.root, this.dog.root);
      this.px = TUNNEL_ENTRY.x;
      this.pz = TUNNEL_ENTRY.z;
      this.kid.setPos(this.px, this.pz);
      this.kidY = 0;
      this.dogY = 0;
      this.dog.root.position.set(this.px + 14, 0, this.pz - 8);
      this.camAz = Math.PI; // face down the corridor
      this.dismount();
      this.audio.setUnderground(true);
      this.audio.stoneScrape();
      this.hud.setVignette(true);
      this.tunnel.enter();
      this.updateCamera(0.016, true);
    });
  }

  exitTunnel() {
    this.hud.fadeThrough(() => {
      this.inTunnel = false;
      this.scene.add(this.kid.root, this.dog.root);
      this.px = this.preTunnel.x;
      this.pz = this.preTunnel.z;
      this.kid.setPos(this.px, this.pz);
      const g = this.terrain.heightAt(this.px, this.pz);
      this.kidY = g;
      this.dogY = g;
      this.dog.root.position.set(this.px - 20, g, this.pz + 12);
      this.audio.setUnderground(false);
      this.audio.stoneScrape();
      this.hud.setVignette(false);
      this.quest?.refresh();
      this.updateCamera(0.016, true);
      if (this.tunnel?.done && !localStorage.getItem('nbpt-ch1-carded')) {
        localStorage.setItem('nbpt-ch1-carded', '1');
        this.audio.jingle();
        setTimeout(() => this.hud.chapterCard('CHAPTER 2 COMPLETE', 'The Door Under Downtown', 'the lantern is yours · the map is torn'), 500);
      }
    });
  }

  // ---------- Chapter 4: the boat ride out to the Wharf Rats' den ----------

  boatRide() {
    // The first trip out is the authored discovery: a manual row + the BOAT_ARRIVE
    // narration. Once the den's been found, going back to ring its bell shouldn't replay
    // either — slip straight down (enterDen does its own fade), no re-row, no repeat.
    if (this.quest?.denDiscovered) {
      this.boatReturn = { x: this.px, z: this.pz };  // land back on this bank when done
      this.enterDen();
    } else {
      this.hud.fadeThrough(() => this.startBoat());
    }
  }

  private startBoat() {
    this.boating = true;
    this.hud.boating = true;       // quest.apply() hides the docked rowboat prop
    this.boatAz = -1.81;
    this.boatReturn = { x: this.px, z: this.pz }; // land you back here when the den is done
    if (!this.rideBoat) this.rideBoat = this.buildRideBoat();
    this.rideBoat.visible = true;
    this.px = 3481;
    this.pz = -221;
    this.kid.setPos(this.px, this.pz);
    this.kidY = WATER_Y;
    if (this.riding) this.toggleBike();
    this.audio.gull();
    this.quest?.refresh();
  }

  // beached at the door: B3b narration, then drop into the den interior
  private endBoat() {
    this.beached = true;
    this.audio.gull();
    this.hud.showDialogue(BOAT_ARRIVE, () => {
      this.beached = false;
      this.boating = false;
      this.hud.boating = false;
      if (this.rideBoat) this.rideBoat.visible = false;
      this.quest?.beachDen();   // first trip starts Chapter 4 (ch3 0 -> 1)
      this.enterDen();
    });
  }

  private buildRideBoat(): THREE.Group {
    const R = new THREE.Group();
    const b = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: hex }));
      m.position.set(x, y, z);
      m.castShadow = true;
      R.add(m);
    };
    b(18, 3, 46, 0, 2, 0, '#6e4520');
    b(1.8, 5, 44, -9, 5, 0, '#7a5230');
    b(1.8, 5, 44, 9, 5, 0, '#7a5230');
    b(18, 5, 2.5, 0, 5, -22.5, '#7a5230');
    b(13, 4, 6, 0, 5.5, 21, '#7a5230');
    b(7, 3.5, 5, 0, 6.5, 25.5, '#6e4520');
    b(15, 1.4, 4.5, 0, 5.8, 3, '#a8895e');
    b(15, 1.4, 4.5, 0, 5.8, -12, '#a8895e');
    const oarL = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 26), new THREE.MeshLambertMaterial({ color: '#8a6b46' }));
    oarL.position.set(-11, 6, 2); oarL.rotation.y = 0.5; oarL.rotation.z = 0.35; R.add(oarL);
    const oarR = oarL.clone();
    oarR.position.set(11, 6, 2); oarR.rotation.y = -0.5; oarR.rotation.z = -0.35; R.add(oarR);
    this.scene.add(R);
    return R;
  }

  // ✈️ the scenic-flight plane: a friendly high-wing taildragger (yellow Cub), built
  // from boxes like the rowboat. Faces +z (forward). The prop spins in the frame loop.
  private buildRidePlane(): THREE.Group {
    const R = new THREE.Group();
    const YEL = '#f2c14e', YEL2 = '#e0ad3c', DARK = '#33343a', GLASS = '#2b3a4a', TIRE = '#222226';
    const b = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: hex }));
      m.position.set(x, y, z); m.castShadow = true; R.add(m); return m;
    };
    b(7, 7.5, 30, 0, 9, 0, YEL);                 // fuselage
    b(6, 6, 6, 0, 9, 16.5, YEL2);                // engine cowl (front)
    b(6.6, 4.2, 7, 0, 12.2, 2.5, GLASS);         // cockpit windscreen
    b(46, 1.5, 9, 0, 15.4, 1, YEL);              // high wing
    b(1.3, 1.3, 8, -7, 12.4, 1, YEL2);           // wing struts
    b(1.3, 1.3, 8, 7, 12.4, 1, YEL2);
    b(1.5, 9, 7, 0, 14.5, -14.5, YEL2);          // vertical tail fin
    b(17, 1.2, 6, 0, 10.5, -14.5, YEL);          // horizontal stabilizer
    b(1.4, 5, 1.4, -6, 5, 6, DARK); b(1.4, 5, 1.4, 6, 5, 6, DARK);  // main gear legs
    const tire = (x: number) => { const t = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 1.8, 12).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: TIRE })); t.position.set(x, 2.6, 6); t.castShadow = true; R.add(t); };
    tire(-6); tire(6);
    b(1.4, 1.4, 1.4, 0, 3.5, -13.5, DARK);       // tail-wheel leg
    const tw = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.2, 10).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: TIRE })); tw.position.set(0, 2.2, -13.8); R.add(tw);
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.1, 12, 10), new THREE.MeshLambertMaterial({ color: '#eec39a' })); head.position.set(0, 13.4, 2); R.add(head);
    b(4.5, 4, 4, 0, 10.6, 2, '#b03a32');         // pilot torso (crimson, like the kid)
    const prop = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(1.2, 18, 0.7), new THREE.MeshLambertMaterial({ color: '#3a3a3e' }));
    const blade2 = blade.clone(); blade2.rotation.z = Math.PI / 2;
    prop.add(blade, blade2); prop.position.set(0, 9, 20);
    R.add(prop);
    this.ridePlaneProp = prop;
    this.scene.add(R);
    return R;
  }

  // ---- enter / exit the scenic flight ----
  enterPlane() {
    if (this.flying) return;
    this.hud.fadeThrough(() => this.startFlight());
  }
  private startFlight() {
    this.flying = true;
    this.hud.flying = true;
    if (this.riding) this.dismount();   // unconditional stow — lent race bikes too (toggleBike would skip them)
    if (!this.ridePlane) this.ridePlane = this.buildRidePlane();
    this.ridePlane.visible = true;
    if (!this.skirt) this.skirt = this.buildSkirt();
    this.skirt.visible = true;
    this.px = RUNWAY_START.x; this.pz = RUNWAY_START.z;
    this.planeAz = RUNWAY_HDG; this.camAz = RUNWAY_HDG;
    this.flyY = this.terrain.heightAt(this.px, this.pz) + 3;   // wheels on the tarmac
    this.kidY = this.flyY;
    this.flySpeed = 0; this.flyPhase = 'roll';
    this.planeRoll = 0; this.planePitch = 0;
    this.kid.root.visible = false; this.dog.root.visible = false;   // the plane is the avatar
    this.kid.setPos(this.px, this.pz);
    // phones: shed the ground-textured walking chunks so flight starts clean (decor-only + impostor)
    if (this.mobile) this.clearChunks();
    this.updateCamera(0, true);   // snap behind the plane, down the runway
    this.hud.setObjective(TOWN.flight.liftoffMsg);
    this.hud.showTalk('🛬 LAND', () => this.land());   // ready from the first second, always
    this.flyAct = 'land';
    this.audio.gull();
    this.quest?.refresh();
  }
  land() {
    if (!this.flying) return;
    this.hud.fadeThrough(() => {
      this.flying = false;
      this.hud.flying = false;
      if (this.ridePlane) this.ridePlane.visible = false;
      if (this.skirt) this.skirt.visible = false;
      this.kid.root.visible = true; this.dog.root.visible = true;
      this.kidY = this.terrain.heightAt(this.px, this.pz);   // set down where you are
      this.flySpeed = 0;
      // phones: drop the decor-only flight chunks so full-detail ground streams back in (async,
      // so landing never freezes; the impostor shows the map until the chunks arrive)
      if (this.mobile) {
        this.clearChunks();
      } else {
        // desktop: flight evicted the ground you're setting down on (the working set rode the
        // corridor ahead of the plane). Rebuild the ring around the landing spot NOW — like the
        // kayak/lighthouse/travel transitions do — so you land on real streets, not the low-res
        // impostor. Phones stay async on purpose: a sync rebuild of 768px ground textures here
        // is exactly the churn that OOM-crashes the tab.
        this.ensureRect(true);
      }
      this.updateCamera(0, true);
      this.quest?.refresh();
      // landing mid-race puts you back in the saddle — the run never stopped. SAY so:
      // a kid who flew off to sightsee has long forgotten the clock is running
      if (this.race?.active) {
        this.lendBike(true);
        this.hud.announce('🏁 Still racing!', 'the clock never stopped — ride for the finish');
      }
    });
  }

  // ✈️ a big plane far below everything, only seen off the map's edge (the impostor covers
  // the map itself). A muted haze tone — never the old bright land slab — so the rare off-map
  // peek fades into the fog instead of clumping yellow. Rides under the player; renders behind
  // the impostor + chunks.
  private buildSkirt(): THREE.Mesh {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(80000, 80000).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#b9c4b4' })
    );
    m.renderOrder = -3;
    this.scene.add(m);
    return m;
  }

  // a world-fixed, terrain-displaced "impostor" of the whole map, textured with a low-res
  // ground render (index.overviewCanvas). It sits a hair below the detailed chunks, so anywhere
  // streaming hasn't reached — the far distance in flight, or right after a fast-travel — shows
  // the real map (roads, water, greens, the season's colours) instead of a flat slab that
  // "clumps into yellow." Built once at load; a season reload rebuilds it in the new palette.
  private buildImpostor(): THREE.Mesh {
    const b = this.world.meta.bounds;
    const ex = b.maxX - b.minX, ey = b.maxY - b.minY;
    const cx = (b.minX + b.maxX) / 2, cz = (b.minY + b.maxY) / 2;
    const tex = new THREE.CanvasTexture(this.index.overviewCanvas(this.lowGPU || this.mobile ? 1280 : 2048));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    tex.flipY = false;
    // Tessellate fine enough to HUG the terrain (heights live on a 64px grid). The old
    // 256-seg mesh spanned ~150px between verts — coarser than the terrain grid — so its flat
    // chords overshot real hills and poked up THROUGH the detailed snow as grey blotches. Keep
    // each impostor span near the grid pitch so it can't overshoot.
    const segN = this.lowGPU || this.mobile ? 288 : 512;
    const segX = segN, segZ = Math.max(8, Math.round(segN * ey / ex));
    const geo = new THREE.PlaneGeometry(ex, ey, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const uv = geo.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const wx = cx + pos.getX(i), wz = cz + pos.getZ(i);
      pos.setY(i, this.terrain.heightAt(wx, wz) - 18);    // sit clearly UNDER the detailed chunks
      uv.setXY(i, (wx - b.minX) / ex, (wz - b.minY) / ey);
    }
    geo.computeVertexNormals();
    // Bias the impostor BACK in the depth buffer so the detailed ground always wins wherever both
    // exist — kills the z-fight bleed-through at distance (the 18px sink handles the geometry; this
    // handles depth-buffer precision once you're far from the camera).
    const mat = new THREE.MeshLambertMaterial({ map: tex });
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = 1.5;
    mat.polygonOffsetUnits = 4;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(cx, 0, cz);
    m.renderOrder = -1;
    m.frustumCulled = false;
    this.scene.add(m);
    return m;
  }

  // ✈️ flight step: forward at cruise, steer to turn, pitch to climb/descend. Returns
  // the new world (x,z); altitude + bank land on fields. Uncrashable (soft ground floor).
  private stepFlight(dt: number, ix: number, iz: number): { nx: number; nz: number } {
    const steer = ix;        // -1..1 left/right
    const pitch = -iz;       // push up on the stick (iz<0) => climb
    const groundY = this.terrain.heightAt(this.px, this.pz);
    if (this.flyPhase === 'roll') {
      this.flySpeed += 430 * dt;                         // accelerate down the runway
      if (this.flySpeed > 560) this.flyPhase = 'climb';  // rotate / lift off
    } else {
      this.flySpeed += (CRUISE_SPEED - this.flySpeed) * Math.min(1, dt * 0.8);
    }
    const turnK = this.flyPhase === 'roll' ? 0.15 : 1.0; // barely steer on the ground
    if (this.flySpeed > 40) this.planeAz += steer * turnK * dt;
    if (this.flyPhase === 'climb') {
      this.flyY += 240 * dt;
      if (this.flyY > groundY + CRUISE_ALT) this.flyPhase = 'cruise';
    } else if (this.flyPhase === 'cruise') {
      const target = groundY + CRUISE_ALT + pitch * 280; // pitch nudges the hold altitude
      this.flyY += (target - this.flyY) * Math.min(1, dt * 1.1);
    }
    this.flyY = Math.max(groundY + 16, this.flyY);       // soft floor — never crash
    this.planeRoll += (-steer * 0.5 - this.planeRoll) * Math.min(1, dt * 4);
    const pitchTarget = this.flyPhase === 'climb' ? 0.2 : -pitch * 0.14;
    this.planePitch += (pitchTarget - this.planePitch) * Math.min(1, dt * 3);
    let d = this.planeAz - this.camAz;                   // camera eases behind the heading
    while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
    this.camAz += d * Math.min(1, dt * 2.2);
    return {
      nx: this.px + Math.sin(this.planeAz) * this.flySpeed * dt,
      nz: this.pz + Math.cos(this.planeAz) * this.flySpeed * dt,
    };
  }

  // ---------- Chapter 4/5 interiors (den, star room) — reuse the tunnel swap ----------

  private enterInterior(scene: Interior, vignette: boolean) {
    this.preInterior = { x: this.px, z: this.pz };
    this.interior = scene;
    scene.nearTag = null;
    this.hud.showTalk(null);
    scene.scene.add(this.kid.root, this.dog.root);
    this.px = 0;
    this.pz = -8;
    this.kid.setPos(this.px, this.pz);
    this.kidY = 0;
    this.dogY = 0;
    this.dog.root.position.set(this.px + 12, 0, this.pz - 6);
    this.camAz = Math.PI;
    this.dismount();
    this.hud.setVignette(vignette);
    this.updateCamera(0.016, true);
  }

  private exitInterior(returnTo: { x: number; z: number }) {
    this.interior = null;
    this.hud.showTalk(null);
    this.scene.add(this.kid.root, this.dog.root);
    this.px = returnTo.x;
    this.pz = returnTo.z;
    this.kid.setPos(this.px, this.pz);
    const g = this.terrain.heightAt(this.px, this.pz);
    this.kidY = g;
    this.dogY = g;
    this.dog.root.position.set(this.px - 16, g, this.pz + 8);
    this.hud.setVignette(false);
    this.quest?.refresh();
    this.updateCamera(0.016, true);
  }

  enterDen() {
    this.hud.fadeThrough(() => {
      if (!this.den) this.den = new DenScene(this.hud, this.audio, () => this.exitDen(), () => this.quest);
      this.audio.setUnderground(true);
      this.audio.stoneScrape();
      this.enterInterior(this.den, true);
    });
  }

  private exitDen() {
    this.hud.fadeThrough(() => {
      if (!this.interior) return;
      this.audio.setUnderground(false);
      this.audio.stoneScrape();
      this.exitInterior(this.boatReturn); // land back on the bank, never on the water
    });
  }

  enterStar() {
    this.hud.fadeThrough(() => {
      if (!this.star) this.star = new StarRoomScene(this.hud, this.audio, () => this.exitStar(), () => this.quest);
      this.audio.setUnderground(true);
      this.audio.stoneScrape();
      this.enterInterior(this.star, true);
    });
  }

  private exitStar() {
    this.hud.fadeThrough(() => {
      if (!this.interior) return;
      this.audio.setUnderground(false);
      this.audio.stoneScrape();
      this.exitInterior(this.preInterior);
    });
  }

  // ---------- the Daily News newsroom (Chapter 3) — above ground, no vignette ----------

  enterNews() {
    this.hud.fadeThrough(() => {
      if (!this.news) this.news = new NewsroomScene(this.hud, this.audio, () => this.exitNews(), () => this.quest);
      this.audio.stoneScrape();        // the office door
      this.enterInterior(this.news, false);
    });
  }

  private exitNews() {
    this.hud.fadeThrough(() => {
      if (!this.interior) return;
      this.audio.stoneScrape();
      this.exitInterior(this.preInterior);
    });
  }

  // Market Square's Christmas tree: tiered conifer, spiral lights, gold star
  private buildHolidayTree(x: number, z: number): THREE.Group {
    const g = new THREE.Group();
    const gy = this.index.heightAtPx(x, z);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(4, 5, 16, 8), new THREE.MeshLambertMaterial({ color: '#5e4630' }));
    trunk.position.y = 8;
    g.add(trunk);
    const greens = ['#2c5a3c', '#336847', '#28523a', '#377450', '#2c5a3c'];
    const tiers: [number, number, number][] = [[46, 40, 8], [38, 36, 34], [30, 32, 58], [21, 27, 80], [12, 22, 98]];
    for (let i = 0; i < tiers.length; i++) {
      const [r, h, y] = tiers[i];
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), new THREE.MeshLambertMaterial({ color: greens[i] }));
      cone.position.y = y + h / 2;
      cone.castShadow = true;
      g.add(cone);
    }
    const N = 230;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const bulbs = [[1, 0.32, 0.25], [1, 0.83, 0.3], [0.34, 0.82, 0.38], [0.38, 0.62, 1], [1, 0.95, 0.82]];
    for (let i = 0; i < N; i++) {
      const tt = i / N;
      const ang = tt * Math.PI * 12.5;
      const r = (1 - tt) * 44 + 4;
      pos[i * 3] = Math.cos(ang) * r;
      pos[i * 3 + 1] = 12 + tt * 98;
      pos[i * 3 + 2] = Math.sin(ang) * r;
      const c = bulbs[i % bulbs.length];
      col[i * 3] = c[0]; col[i * 3 + 1] = c[1]; col[i * 3 + 2] = c[2];
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.add(new THREE.Points(lg, new THREE.PointsMaterial({ vertexColors: true, size: 6, depthWrite: false })));
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(6.5), new THREE.MeshBasicMaterial({ color: '#ffd86a' }));
    star.position.y = 116;
    g.add(star);
    // presents around the base
    const wraps = ['#c0392b', '#2e6e46', '#2c5d9e', '#d4a92e', '#8a4a8c', '#c0392b'];
    const gifts: [number, number, number][] = [[20, 5, 7], [-17, 10, 6], [10, -19, 8], [-13, -15, 5.5], [26, -9, 6.5], [-3, 22, 7]];
    for (let i = 0; i < gifts.length; i++) {
      const [gx, gz, sz] = gifts[i];
      const gift = new THREE.Mesh(new THREE.BoxGeometry(sz * 2, sz * 1.5, sz * 2), new THREE.MeshLambertMaterial({ color: wraps[i] }));
      gift.position.set(gx, sz * 0.75, gz);
      gift.castShadow = true;
      g.add(gift);
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(sz * 2.06, sz * 0.4, sz * 0.66), new THREE.MeshLambertMaterial({ color: '#f6f0dc' }));
      ribbon.position.set(gx, sz * 1.45, gz);
      g.add(ribbon);
    }
    g.position.set(x, gy, z);
    return g;
  }

  // Market Square's fall Halloween patch — a scarecrow, a pumpkin patch (some
  // carved + glowing), cornstalk bundles and hay bales. The autumn counterpart
  // to the winter tree, in the same spot.
  private buildHalloweenDisplay(x: number, z: number): THREE.Group {
    const g = new THREE.Group();
    const gy = this.index.heightAtPx(x, z);
    const lam = (hex: string) => new THREE.MeshLambertMaterial({ color: hex });
    const glow = (hex: string) => new THREE.MeshBasicMaterial({ color: hex });   // always-lit carved faces

    // a pumpkin: squat orange sphere + stem; carved ones get a glowing face on +z
    const pumpkin = (px: number, pz: number, r: number, carved: boolean, faceA: number) => {
      const p = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), lam('#d9772a'));
      body.scale.set(1.16, 0.82, 1.16); body.position.y = r * 0.82; body.castShadow = true;
      p.add(body);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.1, r * 0.15, r * 0.5, 6), lam('#5e4a28'));
      stem.position.y = r * 1.45; p.add(stem);
      if (carved) {
        for (const sx of [-1, 1]) {   // triangular eyes
          const e = new THREE.Mesh(new THREE.ConeGeometry(r * 0.2, r * 0.3, 3), glow('#ffb43a'));
          e.position.set(sx * r * 0.42, r * 0.98, r * 0.92); e.rotation.x = Math.PI / 2; p.add(e);
        }
        const nose = new THREE.Mesh(new THREE.ConeGeometry(r * 0.15, r * 0.24, 3), glow('#ffb43a'));
        nose.position.set(0, r * 0.82, r * 1.0); nose.rotation.x = Math.PI / 2; p.add(nose);
        const mouth = new THREE.Mesh(new THREE.BoxGeometry(r * 0.95, r * 0.24, r * 0.12), glow('#ffb43a'));
        mouth.position.set(0, r * 0.6, r * 1.0); p.add(mouth);
      }
      p.position.set(px, 0, pz); p.rotation.y = faceA;
      return p;
    };

    // hay bales (a couple to perch the pumpkins on)
    for (const [bx, bz, ang] of [[-24, 17, 0.2], [22, 15, -0.3], [25, -17, 0.5]] as const) {
      const bale = new THREE.Mesh(new THREE.BoxGeometry(17, 9, 10), lam('#cdb56a'));
      bale.position.set(bx, 4.5, bz); bale.rotation.y = ang; bale.castShadow = true; g.add(bale);
      const tie = new THREE.Mesh(new THREE.BoxGeometry(17.2, 9.2, 1.4), lam('#a88f4e'));
      tie.position.set(bx, 4.5, bz + 3); tie.rotation.y = ang; g.add(tie);
    }

    // the scarecrow on its cross-post
    const sc = new THREE.Group();
    const put = (geo: THREE.BufferGeometry, hex: string, px: number, py: number, pz: number, shadow = false) => {
      const m = new THREE.Mesh(geo, lam(hex)); m.position.set(px, py, pz); m.castShadow = shadow; sc.add(m); return m;
    };
    put(new THREE.CylinderGeometry(1.3, 1.7, 46, 6), '#6e5236', 0, 23, 0);   // post
    put(new THREE.BoxGeometry(42, 2.4, 2.4), '#6e5236', 0, 31, 0);            // cross-arm
    put(new THREE.CylinderGeometry(7, 8.5, 19, 8), '#9a3f3a', 0, 29, 0, true); // stuffed plaid body
    for (const [tx, ty] of [[-20, 31], [20, 31], [0, 19]] as const) {          // straw tufts at wrists + waist
      const straw = put(new THREE.ConeGeometry(2.2, 7, 5), '#d6bd6a', tx, ty, 0); straw.rotation.x = Math.PI;
    }
    put(new THREE.SphereGeometry(6, 10, 8), '#c9a86a', 0, 42, 0, true);        // burlap head
    for (const sx of [-1, 1]) put(new THREE.BoxGeometry(1.6, 1.6, 0.6), '#2a2622', sx * 2.1, 43, 5.4);  // button eyes
    put(new THREE.CylinderGeometry(9.5, 9.5, 1.4, 10), '#5e4a30', 0, 46.5, 0);  // hat brim
    put(new THREE.ConeGeometry(6.2, 10, 10), '#4a3a26', 0, 52, 0);              // hat crown
    sc.rotation.y = 0.3; g.add(sc);

    // the pumpkin patch (carved jack-o'-lanterns face out toward the square) —
    // haunted towns (Salem) go bigger: more, larger pumpkins
    const patch: [number, number, number, boolean, number][] = TOWN.halloween === 'haunted' ? [
      [16, 9, 9, true, 0.4], [27, -7, 7, false, 0], [7, -15, 8.5, true, -0.6],
      [-13, 11, 10, true, 0.1], [-25, -5, 7.5, false, 0], [3, 20, 6.5, true, 0.2],
      [-7, -21, 8, true, 0.3], [14, 20, 7, true, 1.2], [-19, 17, 6.5, false, -0.4],
      [21, 8, 6.5, true, -0.9], [-3, -8, 13, true, 0.0], [11, -23, 6.5, false, 0.5],
      [-28, 7, 7, true, 1.5], [30, 3, 6, true, -0.3], [-15, -16, 7.5, true, 0.8],
    ] : [
      [16, 9, 5.5, true, 0.4], [24, -7, 4, false, 0], [7, -15, 5, true, -0.6],
      [-13, 11, 6, true, 0.1], [-22, -5, 4.5, false, 0], [3, 18, 3.6, false, 0],
      [-7, -19, 4.6, true, 0.3], [13, 18, 4, true, 1.2],
    ];
    for (const [px, pz, r, carved, fa] of patch) g.add(pumpkin(px, pz, r, carved, fa));

    // cornstalk bundles at the edges
    for (const [cx, cz] of [[-27, -15], [27, 13], [-3, 24]] as const) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const stalk = new THREE.Mesh(new THREE.ConeGeometry(1.1, 36, 4), lam(i % 2 ? '#c2a85a' : '#b8a050'));
        stalk.position.set(cx + Math.cos(a) * 2.6, 18, cz + Math.sin(a) * 2.6);
        stalk.rotation.z = Math.cos(a) * 0.12; stalk.rotation.x = Math.sin(a) * 0.1;
        g.add(stalk);
      }
    }

    // Frankenstein & Dracula flank the patch — the Halloween Capital's welcoming committee.
    if (TOWN.halloween === 'haunted') {
      {
        const fr = new THREE.Group();
        const fm = (geo: THREE.BufferGeometry, hex: string, px: number, py: number, pz: number, e = false) => {
          const m = new THREE.Mesh(geo, e ? glow(hex) : lam(hex)); m.position.set(px, py, pz); m.castShadow = !e; fr.add(m);
        };
        fm(new THREE.BoxGeometry(5, 14, 5), '#1b1916', -4, 7, 0); fm(new THREE.BoxGeometry(5, 14, 5), '#1b1916', 4, 7, 0);  // legs
        fm(new THREE.BoxGeometry(15, 18, 9), '#2b2823', 0, 22, 0);                                                          // coat/torso
        for (const s of [-1, 1]) { fm(new THREE.BoxGeometry(4.5, 16, 5), '#2b2823', s * 9.5, 22, 0); fm(new THREE.BoxGeometry(4.5, 5, 8), '#6f8f3f', s * 9.5, 16, 7); } // arms reaching out
        fm(new THREE.BoxGeometry(11, 12, 10), '#6f8f3f', 0, 37, 0);                                                         // flat-top green head
        fm(new THREE.BoxGeometry(11.4, 2.6, 10.4), '#15120e', 0, 43.2, 0);                                                  // flat black hair
        for (const s of [-1, 1]) fm(new THREE.BoxGeometry(3, 1.8, 1.8), '#b7b7ad', s * 6.6, 33, 0);                         // neck bolts
        for (const s of [-1, 1]) fm(new THREE.BoxGeometry(2, 2, 1), '#ffd23c', s * 2.6, 38, 5.1, true);                     // glowing eyes
        fr.position.set(-46, 0, 2); fr.rotation.y = 0.3; g.add(fr);
      }
      {
        const dr = new THREE.Group();
        const dm = (geo: THREE.BufferGeometry, hex: string, px: number, py: number, pz: number, e = false) => {
          const m = new THREE.Mesh(geo, e ? glow(hex) : lam(hex)); m.position.set(px, py, pz); m.castShadow = !e; dr.add(m);
        };
        dm(new THREE.BoxGeometry(16, 24, 3), '#100e15', 0, 23, -3.6);                                                       // cape behind
        dm(new THREE.BoxGeometry(5, 14, 5), '#100e15', -4, 7, 0); dm(new THREE.BoxGeometry(5, 14, 5), '#100e15', 4, 7, 0);  // legs
        dm(new THREE.BoxGeometry(12, 18, 7), '#100e15', 0, 22, 0);                                                          // suit
        dm(new THREE.BoxGeometry(2.6, 12, 2), '#7a1420', 0, 22, 3.6);                                                       // red sash
        for (const s of [-1, 1]) dm(new THREE.BoxGeometry(3, 13, 1.6), '#100e15', s * 5.6, 33, -2.2);                       // high collar
        dm(new THREE.BoxGeometry(8, 11, 7), '#e7ddc8', 0, 37, 0);                                                          // pale head
        dm(new THREE.BoxGeometry(8.4, 2.6, 7.4), '#15120f', 0, 42.5, 0);                                                    // slicked hair
        for (const s of [-1, 1]) dm(new THREE.BoxGeometry(1.8, 1.8, 1), '#ff3b2e', s * 2.2, 38, 3.6, true);                 // red glowing eyes
        dr.position.set(46, 0, 2); dr.rotation.y = -0.3; g.add(dr);
      }
    }

    g.position.set(x, gy, z);
    return g;
  }

  // Probe once at startup for a clearly weak GPU: a software renderer (browser
  // fallback) or genuinely low core/memory counts. Intentionally strict so we
  // don't degrade capable mid-range machines — those are covered by the runtime
  // dynamic-resolution loop instead.
  private static detectLowGPU(): boolean {
    try {
      const c = document.createElement('canvas');
      const gl = (c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null;
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)).toLowerCase() : '';
      if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(renderer)) return true;
      const cores = navigator.hardwareConcurrency || 8;
      const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
      return cores <= 2 || (cores <= 4 && mem <= 4);
    } catch {
      return false;
    }
  }

  // Dynamic resolution: sample FPS once a second and scale the drawing-buffer
  // resolution to keep weak GPUs smooth. Steps down (to as low as 0.5x) below
  // 45 FPS and eases back toward the device cap above 57. Hysteresis plus the
  // asymmetric step sizes prevent oscillation; full-speed machines never move.
  private updateDynamicResolution(dt: number) {
    const cap = Math.min(devicePixelRatio || 1, 2);
    if (this.dynScale === 0) this.dynScale = cap;
    this.fpsAccum += dt;
    this.fpsFrames++;
    if (this.fpsAccum < 1) return;
    const fps = this.fpsFrames / this.fpsAccum;
    this.fpsAccum = 0;
    this.fpsFrames = 0;
    const floor = Math.max(0.5, cap * 0.5);
    if (fps < 45 && this.dynScale > floor) {
      this.dynScale = Math.max(floor, this.dynScale - 0.25);
    } else if (fps > 57 && this.dynScale < cap) {
      this.dynScale = Math.min(cap, this.dynScale + 0.1);
    }
    if (Math.abs(this.renderer.getPixelRatio() - this.dynScale) > 1e-3) {
      this.renderer.setPixelRatio(this.dynScale);
    }
  }

  private frame(t: number) {
    const dt = Math.min(0.05, (t - this.lastTime) / 1000 || 0.016);
    this.lastTime = t;
    this.updateDynamicResolution(dt);
    this.hud.setIndoors(this.inside);   // walk-only spaces hide the run + bike buttons

    const k = this.keys;
    // screen-space input ...
    let ix = (k.has('KeyA') || k.has('ArrowLeft') ? -1 : 0) + (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0);
    let iz = (k.has('KeyW') || k.has('ArrowUp') ? -1 : 0) + (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (this.hud.joyActive && (this.hud.joyX || this.hud.joyY)) {
      // a small deadzone so resting/jittery fingers don't nudge the heading (the
      // joystick already deadzones; keep this tiny so slow, precise moves still register)
      const jm = Math.hypot(this.hud.joyX, this.hud.joyY);
      if (jm > 0.08) { ix = this.hud.joyX; iz = this.hud.joyY; }
      else { ix = 0; iz = 0; }
    }

    // ✈️ flight is its own movement path (forward at cruise + steer, no ground
    // collision); the on-foot / boat block below is skipped while flying.
    let nx = this.px, nz = this.pz;
    if (this.flying) {
      ({ nx, nz } = this.stepFlight(dt, ix, iz));
    } else if (this.sweeping) {
      // 🔦 the finale beam-sweep: left/right rotates the beam across the harbor (the
      // player is pinned at the tower). The chase cam tracks the beam via cineLook.
      if (!this.hud.dialogueOpen) this.beamAz += ix * 1.5 * dt;
      const SPAN = 0.95;                              // clamp to the northern harbor arc
      this.beamAz = Math.max(Math.PI - SPAN, Math.min(Math.PI + SPAN, this.beamAz));
      this.hud.beamAz = this.beamAz;
      this.cineLook = { x: this.px + Math.sin(this.beamAz) * 4000, z: this.pz + Math.cos(this.beamAz) * 4000 };
      // nx/nz stay put — no walking while you work the light
    } else {
    // ...mapped through the camera azimuth (W = away from camera)
    const fwdX = Math.sin(this.camAz), fwdZ = Math.cos(this.camAz);
    const rightX = -Math.cos(this.camAz), rightZ = Math.sin(this.camAz);
    let vx = fwdX * -iz + rightX * ix;
    let vz = fwdZ * -iz + rightZ * ix;
    if (this.debugVec) {
      if (performance.now() > this.debugVec.until) this.debugVec = null;
      else { vx = this.debugVec.x; vz = this.debugVec.y; }
    }
    if (this.hud.dialogueOpen || this.cineLook) { vx = 0; vz = 0; }   // freeze during dialogue + the look-out-to-sea cutaway
    const mag = Math.hypot(vx, vz);
    if (mag > 1) { vx /= mag; vz /= mag; }
    // ease the heading toward the input so small wobbles don't twitch the path — a kid
    // can hold a straight line, and turns round off instead of snapping. Full input
    // still reaches full speed; mid-turn the shorter vector just eases the pace down.
    // The bike steers lazier than on foot (it was the worst offender).
    const turnK = this.riding ? 3.6 : 6.5;
    const ke = Math.min(1, dt * turnK);
    this.aimX += (vx - this.aimX) * ke;
    this.aimZ += (vz - this.aimZ) * ke;
    if (mag < 0.01) { this.aimX = 0; this.aimZ = 0; }  // crisp stop on release — no floaty glide
    vx = this.aimX; vz = this.aimZ;

    this.sprinting = this.autoRun || k.has('ShiftLeft') || k.has('ShiftRight') || this.hud.sprintTouch;
    // indoors (tunnels + hand-built interiors) is walk-only: no run, no sprint,
    // no bike — the rooms are small and a kid mashing run shouldn't rocket around
    // them. Force a walk regardless of the run toggle or any stray riding state.
    if (this.inside) this.sprinting = false;
    let speed = this.inside ? JOG : this.riding ? 530 : this.kayaking ? 600 : this.sprinting ? SPRINT : JOG;
    if (this.race?.freeze) speed = 0;   // held at the start line through the countdown
    if (this.index.isSlow(this.px, this.pz)) speed *= 0.5;
    // mobile: ease the on-foot top speed when steering with the joystick so narrow
    // streets are controllable. Kids kept overshooting into houses in the neighborhoods,
    // so this is dialed back further (was 0.72). The joystick still gives proportional
    // speed below this; desktop (WASD) and the run button keep the full, gamey pace.
    if (this.hud.joyActive && !this.sprinting && !this.riding && !this.kayaking) speed *= 0.55;

    const half = 5;   // a slightly slimmer footprint so narrow streets stay passable
    const free = this.kayaking
      // the free-roam kayak rides mapped water OR any open sea (submerged ground below
      // sea level) — so the edge of the water polygons never reads as an invisible wall
      // out on the harbor/sea. Only land + above-water sandbars (terrain ≥ sea level) stop
      // you; you leave the water via the HOP OUT button.
      ? (x: number, y: number) => this.index.isWaterAt(x, y) || this.terrain.heightAt(x, y) < WATER_Y
      : this.boating
      // keep the boat on the water — never onto land — with slack at the launch and
      // the den door it beaches at (so the route in/out is never blocked)
      ? (x: number, y: number) =>
          this.index.isWaterAt(x, y)
          || Math.hypot(x - 3481, y + 221) < 90
          || Math.hypot(x - BOAT_DOOR.x, y - BOAT_DOOR.z) < 150
      : this.inTunnel
      ? (x: number, y: number) => this.tunnel!.free(x, y)
      : this.interior
      ? (x: number, y: number) => this.interior!.free(x, y)
      : (x: number, y: number) =>
        !this.index.isBlocked(x - half, y) && !this.index.isBlocked(x + half, y) && !this.index.isBlocked(x, y)
        && !(this.life && this.life.obstacleAt(x, y))
        // on foot you can't walk out onto open water — only dry land, a real deck
        // (bridge/pier/boardwalk, where deckHeightAt rises above the waterline), or a
        // frozen pond (winter ice you can walk clear across)
        && (!this.index.isWaterAt(x, y) || this.index.deckHeightAt(x, y) > WATER_Y || this.index.frozenWaterAt(x, y));
    // sub-step the move and slide along walls so tight streets glide instead of
    // snagging. When a move is wedged on both axes, try to slip free (round the
    // corner / glance off a one-sided jut) rather than stopping dead — keyboard
    // players kept getting pinned on the corners of houses with no way out.
    const moveX = vx * speed * dt, moveZ = vz * speed * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(moveX, moveZ) / 4));
    const stepX = moveX / steps, stepZ = moveZ / steps;
    nx = this.px; nz = this.pz;
    const slip = 3;   // how far to nudge sideways to clear a corner each sub-step
    for (let s = 0; s < steps; s++) {
      const okX = stepX !== 0 && free(nx + stepX, nz);
      const okZ = stepZ !== 0 && free(nx, nz + stepZ);
      if (okX) nx += stepX;
      if (okZ) nz += stepZ;
      if (!okX && !okZ && (stepX !== 0 || stepZ !== 0)) {
        if (stepX !== 0 && stepZ !== 0 && free(nx + stepX, nz + stepZ)) {
          nx += stepX; nz += stepZ;                       // round a convex corner / doorway
        } else if (stepX === 0 && stepZ !== 0) {          // walking N/S, jut on one side
          if (free(nx + slip, nz + stepZ)) { nx += slip; nz += stepZ; }
          else if (free(nx - slip, nz + stepZ)) { nx -= slip; nz += stepZ; }
        } else if (stepZ === 0 && stepX !== 0) {          // walking E/W, jut on one side
          if (free(nx + stepX, nz + slip)) { nx += stepX; nz += slip; }
          else if (free(nx + stepX, nz - slip)) { nx += stepX; nz -= slip; }
        }
      }
    }
    // safety net: nothing should ever trap you fully — a wall, the bounds clamp, a
    // teleport, OR a car/pedestrian that drove onto you (life obstacles). The old
    // version only checked walls with tiny nudges, so a car (radius ~20) could pin
    // you with no escape. Now: push out to the nearest open ground, ringing outward
    // far enough to clear a car.
    if (!this.inside && !this.onWater && !this.sweeping) {   // not while kayaking either — the collision
      // grid reads "blocked" out past the built chunks, which would shove the kayak back
      // from open sea (the invisible wall); on the water the isWaterAt free() is enough
      // (and never while pinned at the tower for the beam-sweep)
      const stuck = (x: number, z: number) =>
        this.index.isBlocked(x, z)
        || (this.index.isWaterAt(x, z) && this.index.deckHeightAt(x, z) <= WATER_Y && !this.index.frozenWaterAt(x, z))   // adrift on open water → back to shore (frozen ice is fine)
        || !!(this.life && this.life.obstacleAt(x, z));
      if (stuck(nx, nz)) {
        let freed = false;
        for (const r of [10, 18, 26, 34, 44] as const) {
          for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2;
            const tx = nx + Math.cos(ang) * r, tz = nz + Math.sin(ang) * r;
            if (!stuck(tx, tz)) { nx = tx; nz = tz; freed = true; break; }
          }
          if (freed) break;
        }
        // adrift on open water (or boxed in beyond the ring) — march to the nearest dry shore
        if (!freed) { const s = this.findFree(nx, nz); nx = s.x; nz = s.y; }
      }
    }
    }   // end of the on-foot / boat movement (skipped while flying)

    if (!this.inside) {
      const b = this.world.meta.bounds;
      nx = Math.min(b.maxX - 12, Math.max(b.minX + 12, nx));
      nz = Math.min(b.maxY - 12, Math.max(b.minY + 12, nz));
    }

    const realVx = (nx - this.px) / dt, realVz = (nz - this.pz) / dt;
    this.px = nx;
    this.pz = nz;
    this.kid.setPos(this.px, this.pz);
    this.kid.update(dt, realVx, realVz, this.sprinting, this.riding, this.onWater);
    this.kid.setBackpack(this.hud.hasBackpack());   // worn pack appears once the 🎒 is earned

    // ride the real terrain, bridge decks, and docks (the tunnel floor is flat).
    // Decks are entered where they meet the grade — passing beneath a raised
    // overpass keeps you on the ground under it, head safely below the span.
    const terrainY = this.inside ? 0 : this.onWater ? WATER_Y : this.terrain.heightAt(this.px, this.pz);
    const surfY = this.inside ? 0 : this.onWater ? WATER_Y : this.index.surfaceYAt(this.px, this.pz, this.kidY);
    this.kidY += (surfY - this.kidY) * Math.min(1, dt * 12);
    if (this.flying) this.kidY = this.flyY;   // ✈️ altitude overrides the terrain-follow
    // hop low fences/hedges (they no longer block) — a quick arc as you cross one
    const nearFence = !this.inside && !this.onWater && this.index.lowBarrierNear(this.px, this.pz);
    if (Math.hypot(realVx, realVz) > 4 && nearFence && !this.wasNearFence && this.hopT <= 0) this.hopT = 0.5;
    this.wasNearFence = nearFence;
    if (this.hopT > 0) this.hopT = Math.max(0, this.hopT - dt);
    const hop = this.hopT > 0 ? Math.sin((1 - this.hopT / 0.5) * Math.PI) * 8 : 0;
    this.kid.root.position.y = this.kidY + hop + (this.riding ? 2 : 0);
    if (this.riding) {
      this.bike.root.position.set(this.px, this.kidY, this.pz);
      this.bike.update(dt, Math.hypot(realVx, realVz), this.kid.facing);
    }
    // boat ride: the hull steers toward your heading and rides the water; nearing
    // the door beaches you into the den
    if (this.boating && this.rideBoat) {
      if (Math.hypot(realVx, realVz) > 1) this.boatAz = Math.atan2(realVx, realVz);
      this.rideBoat.position.set(this.px, this.kidY + 0.6, this.pz);
      this.rideBoat.rotation.y = this.boatAz;
      if (!this.beached && Math.hypot(this.px - BOAT_DOOR.x, this.pz - BOAT_DOOR.z) < 120) this.endBoat();
    }
    // 🛶 the free-roam kayak: hull steers toward your heading and rides the water
    if (this.kayaking && this.kayak) {
      if (Math.hypot(realVx, realVz) > 1) this.kayakAz = Math.atan2(realVx, realVz);
      this.kayak.position.set(this.px, this.kidY + 0.4, this.pz);
      this.kayak.rotation.y = this.kayakAz;
    }
    // ✈️ scenic flight: the plane rides at altitude, banks into turns, prop spins
    if (this.flying && this.ridePlane) {
      this.ridePlane.position.set(this.px, this.flyY, this.pz);
      this.ridePlane.rotation.set(this.planePitch, this.planeAz, this.planeRoll, 'YXZ');
      if (this.ridePlaneProp) this.ridePlaneProp.rotation.z += dt * 38;
      if (this.skirt) this.skirt.position.set(this.px, this.terrain.heightAt(this.px, this.pz) - 120, this.pz);
    }

    const still = Math.hypot(realVx, realVz) < 1;
    if (this.flying) {
      // Clipper waits at the airport during the flight (hidden); rejoined on landing
    } else if (this.onWater) {
      // Clipper rides up in the bow, facing the water ahead (the hull's heading).
      // The kayak is slimmer + lower than the rowboat, so he sits a touch closer/lower.
      const waterAz = this.boating ? this.boatAz : this.kayakAz;
      const bowD = this.boating ? 17 : 13, bowY = this.boating ? 7.4 : 5.6;
      this.dog.root.position.set(this.px + Math.sin(waterAz) * bowD, this.kidY + bowY, this.pz + Math.cos(waterAz) * bowD);
      this.dog.faceTo(waterAz);
    } else {
      // dog heels behind-left of the kid's heading — unless the quest has
      // somewhere Clipper needs to be (the grate beat)
      const hAngle = Math.atan2(realVx, realVz);
      const back = still ? 26 : 34;
      const qd = this.quest ? this.quest.dogTarget : null;
      const tx = qd ? qd.x : this.px - Math.sin(hAngle) * back - Math.cos(hAngle) * 16;
      const tz = qd ? qd.z : this.pz - Math.cos(hAngle) * back + Math.sin(hAngle) * 16;
      this.dog.update(dt, tx, tz);
      const dogGround = this.inside ? 0
        : this.index.surfaceYAt(this.dog.root.position.x, this.dog.root.position.z, this.dogY);
      this.dogY += (dogGround - this.dogY) * Math.min(1, dt * 12);
      const dn = !this.inside && this.index.lowBarrierNear(this.dog.root.position.x, this.dog.root.position.z);
      if (dn && !this.dogWasNearFence && this.dogHopT <= 0) this.dogHopT = 0.5;
      this.dogWasNearFence = dn;
      if (this.dogHopT > 0) this.dogHopT = Math.max(0, this.dogHopT - dt);
      this.dog.root.position.y = this.dogY + (this.dogHopT > 0 ? Math.sin((1 - this.dogHopT / 0.5) * Math.PI) * 7 : 0);
    }

    // sprint FOV kick
    const wantFov = this.sprinting && !still ? 63 : 55;
    if (Math.abs(wantFov - this.fov) > 0.05) {
      this.fov += (wantFov - this.fov) * Math.min(1, dt * 5);
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    // chase camera eases in behind the kid's heading (north-up mode locks to π)
    const movingNow = Math.hypot(realVx, realVz) > 1;
    // a few seconds into your first walk (and not already running), nudge that R runs
    if (!this.runTipShown && movingNow && !this.sprinting && !this.inside && !this.boating
        && !this.riding && !this.hud.dialogueOpen) {
      this.walkAccum += dt;
      if (this.walkAccum > 3) {
        this.runTipShown = true;
        localStorage.setItem('nbpt-run-tip', '1');
        this.hud.showRunTip();
      }
    }
    if (this.flying) {
      // stepFlight already eases the camera behind the plane's heading
    } else if (this.cineLook) {
      // swing the chase cam to look out at the mystery light (the birdwatcher reveal)
      this.camAz = lerpAngle(this.camAz, Math.atan2(this.cineLook.x - this.px, this.cineLook.z - this.pz), Math.min(1, dt * 2.4));
    } else if (this.chaseCam) {
      if (movingNow) this.camAz = lerpAngle(this.camAz, Math.atan2(realVx, realVz), Math.min(1, dt * 2.2));
    } else {
      this.camAz = lerpAngle(this.camAz, Math.PI, Math.min(1, dt * 3));
    }
    this.hud.setCompass(Math.PI - this.camAz);
    this.hud.pos = { x: this.px, y: this.pz }; // journey panel's direction hint

    // Level 2: hold the walking-light mystery at winter dusk (reload-safe — polled every
    // frame from the quest's own step state), so the ghost light is never paddled at noon
    if (this.quest?.l2Night) this.holdNight(); else this.releaseNight();
    // day–night cycle drives the sun, sky dome, and weather; the shadow
    // window rides with the player
    const sky = this.sky.update(dt, this.px, this.pz, t, this.camera.position);
    const sunD = 950;
    this.sun.position.set(this.px + sky.sunDir.x * sunD, sky.sunDir.y * sunD + 80, this.pz + sky.sunDir.z * sunD);
    this.sun.target.position.set(this.px, 0, this.pz);
    this.sun.color.copy(sky.sunColor);
    this.sun.intensity = sky.sunIntensity;
    this.hemi.color.copy(sky.hemiSky);
    this.hemi.groundColor.copy(sky.hemiGround);
    this.hemi.intensity = sky.hemiIntensity;
    (this.scene.fog as THREE.Fog).color.copy(sky.fog);
    this.renderer.setClearColor(sky.fog);

    // street lamps cast warm light at night (a pool following the nearest lamps)
    const lampOn = this.inside ? 0 : sky.night;
    this.lampGlowMat.opacity = 0.9 * lampOn;
    for (let i = 0; i < this.lampLights.length; i++) {
      const s = this.lampSpots[i];
      const on = !!s && lampOn > 0.01;
      const disc = this.lampGlows[i], L = this.lampLights[i];
      disc.visible = on;
      if (on) {
        disc.position.set(s.x, s.gy + 0.6, s.z);
        L.position.set(s.x, s.gy + 25, s.z);
        L.intensity = 165 * lampOn;
      } else {
        L.intensity = 0;
      }
    }

    if (this.waterUpdate && !this.inside) this.waterUpdate(t);
    if (this.life && !this.inside) this.life.update(dt, this.px, this.pz, t, Math.sin(this.camAz), Math.cos(this.camAz), sky.night);
    if (this.gillis && !this.inside) this.gillis.update(dt);
    if (this.inTunnel) this.tunnel!.update(dt, this.px, this.pz);
    else if (this.interior) this.interior.update(dt, this.px, this.pz);
    else {
      // a live run (or countdown) mutes the story entirely — no TALK, no auto-beats
      if (this.quest) this.quest.update(dt, this.px, this.pz, this.race?.active ?? false);
      // the race runs after quest (its per-frame hud.guide write wins while racing)
      // but before history/eggs, which both yield to an armed start line or a live run
      if (this.race) this.race.update(dt, this.px, this.pz, (this.quest?.nearActive ?? false) || this.flying);
      const raceBusy = this.race ? (this.race.active || this.race.nearActive) : false;
      if (this.history) this.history.update(dt, this.px, this.pz, (this.quest?.nearActive ?? false) || this.flying || raceBusy);
      // eggs speak last: quest beats, then race flags, then history markers, then secrets
      if (this.eggs) this.eggs.update(dt, this.px, this.pz, this.flying || (this.quest?.nearActive ?? false) || raceBusy || (this.history ? this.history.nearActive : false));
    }
    this.audio.update(dt, movingNow && !this.riding, this.sprinting, () =>
      this.inside ? 'hard'
        : surfY > terrainY + 0.5 ? 'wood'
        : this.index.onPavedAt(this.px, this.pz) ? 'hard' : 'soft');
    if (!this.inside) this.ensureRect();
    this.updateCamera(dt);
    this.updateWaypoint();

    // finish Level 1 → the one-time "Seasons Unlocked" reward: it turns the summer town
    // to winter for the Level 2 Christmas arc and unlocks the season picker. Fires once
    // you're calm in the overworld (not inside/on water, not mid-dialogue, not still
    // reading the CHAPTER 5 COMPLETE card), so it lands as you step back out into town.
    if (!this.inside && !this.onWater && !this.seasonTurning && !this.hud.dialogueOpen
        && !document.querySelector('#hud .chapter.show')
        && (parseInt(localStorage.getItem('nbpt-ch4-step') || '0', 10) || 0) >= 4
        && localStorage.getItem('nbpt-seasons-rewarded') !== '1') {
      this.unlockSeasons();
    }

    // polls
    this.pollAcc += dt;
    if (this.pollAcc > 0.45) {
      this.pollAcc = 0;
      // Game-owned contextual action button, priority: LAND > HOP OUT > FLY > KAYAK.
      // The quest owns TALK/LOOK; on water it yields (hud.kayaking → QuestRunner), and
      // KAYAK defers to any quest button so you can still talk to shore NPCs at Joppa.
      let act: { label: string; cb: () => void } | null = null;
      if (this.flying) act = { label: '🛬 LAND', cb: () => this.land() };
      else if (this.kayaking) { if (this.landNear()) act = { label: '🛶 HOP OUT', cb: () => this.exitKayak() }; }
      else if (!this.inside && !this.boating && !this.sweeping) {
        if (this.flightEnabled && Math.hypot(this.px - AIRPORT.x, this.pz - AIRPORT.z) < AIRPORT.r) act = { label: '✈️ FLY', cb: () => this.enterPlane() };
        else if (this.kayakEarned && this.nearWater && !this.quest?.nearActive && !this.race?.nearActive && !this.hud.dialogueOpen) act = { label: '🛶 KAYAK', cb: () => this.enterKayak() };
      }
      const actKey = act ? act.label : null;
      if (actKey !== this.flyAct) {
        this.flyAct = actKey;
        // Handing the button back (act → null) must NOT wipe a button the story or a
        // race flag armed this same frame. The "kayak ate the rowboat" bug: walking to
        // Ch4's rowboat crosses the near-water band, 🛶 KAYAK arms, and the moment the
        // quest arms 🛶 ROW the kayak's exit transition cleared it — the quest only
        // re-offers on change, so the button stayed invisible. (kayakEarned is always
        // true since vehicles went baseline, so every shore quest point hits this.)
        if (act || !(this.quest?.nearActive || this.race?.nearActive)) {
          this.hud.showTalk(act ? act.label : null, act ? act.cb : undefined);
        }
      }
      this.hud.setStreet(this.inTunnel ? 'the tunnels' : this.interior ? this.interior.name : this.index.nearestRoadName(this.px, this.pz, 170));
      if (!this.inside) {
        // tunnel coords overlap downtown's — minimap dot, gull logic, and
        // landmark banners would all lie underground
        this.hud.setMiniPos(this.px, this.pz);
        // remember where you are so a refresh (or a crash) resumes here, not at the start
        if (!this.onWater) localStorage.setItem('nbpt-resume-pos', JSON.stringify({ x: Math.round(this.px), z: Math.round(this.pz) }));
        this.updateLampSpots();
        // only the river/ocean offers the kayak — not inland ponds (you walk those
        // when they freeze); isOpenWaterAt excludes the small freezable bodies
        this.nearWater = this.index.isOpenWaterAt(this.px, this.pz - 230)
          || this.index.isOpenWaterAt(this.px + 230, this.pz) || this.index.isOpenWaterAt(this.px - 230, this.pz)
          || this.index.isOpenWaterAt(this.px, this.pz + 230);
        this.audio.setNearWater(this.nearWater);
        for (const lm of this.world.landmarks) {
          const d = (lm.x - this.px) ** 2 + (lm.y - this.pz) ** 2;
          if (d < lm.r * lm.r) {
            this.hud.maybeShowLandmark(lm);
            break;
          }
        }
      }
    }

    this.renderer.render(this.inTunnel ? this.tunnel!.scene : this.interior ? this.interior.scene : this.scene, this.camera);
  }

  // gather the nearest street lamps to the player so the small light pool can
  // follow them; skipped entirely in daylight
  private updateLampSpots() {
    if (this.sky.state.night < 0.02) { this.lampSpots = []; return; }
    const cx = Math.floor(this.px / CHUNK), cz = Math.floor(this.pz / CHUNK);
    const found: { x: number; y: number; d: number }[] = [];
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        for (const lp of this.index.lampsFor((cx + dx) + ',' + (cz + dz))) {
          const d = (lp.x - this.px) ** 2 + (lp.y - this.pz) ** 2;
          if (d < 620 * 620) found.push({ x: lp.x, y: lp.y, d });
        }
      }
    }
    found.sort((a, b) => a.d - b.d);
    this.lampSpots = found.slice(0, this.lampLights.length)
      .map((f) => ({ x: f.x, z: f.y, gy: this.index.surfaceYAt(f.x, f.y) }));
  }

  private updateCamera(dt: number, snap = false) {
    // ✈️ flight: a wide chase cam high + behind the plane, looking ahead and down over
    // the town. No building-occlusion clamp (you're in the air); fog opened for the vista.
    if (this.flying) {
      const fx = Math.sin(this.camAz), fz = Math.cos(this.camAz);
      const tx = this.px - fx * 250, ty = this.flyY + 155, tz = this.pz - fz * 250;
      if (snap) this.camera.position.set(tx, ty, tz);
      else {
        const f = 1 - Math.exp(-4 * dt);
        this.camera.position.x += (tx - this.camera.position.x) * f;
        this.camera.position.y += (ty - this.camera.position.y) * f;
        this.camera.position.z += (tz - this.camera.position.z) * f;
      }
      this.camera.lookAt(this.px + fx * 360, this.flyY - 60, this.pz + fz * 360);
      const ffog = this.scene.fog as THREE.Fog;
      ffog.near = 1100; ffog.far = 5400;
      return;
    }
    // interiors (tunnel/den/star) use a steep, close dungeon camera so the room
    // walls between the camera and the kid never occlude
    const z = this.inside ? 0.52 : this.camZoom;
    const dist = this.inside ? 150 : 470 * z;
    const high = this.inside ? 330 : 340 * z;
    const fx = Math.sin(this.camAz), fz = Math.cos(this.camAz);
    let tx = this.px - fx * dist;
    let ty = high + this.kidY;
    let tz = this.pz - fz * dist;
    if (!this.inside) {
      // camera collision: sample the sight line from the kid's head out to the
      // desired spot; the first wall that would swallow the view pulls the
      // camera in just short of it — down to over-the-shoulder against a wall.
      // Two consecutive blocked samples required, so corner grazes don't twitch.
      const lx = this.px, ly = this.kidY + 26, lz = this.pz;
      let want = 1, run = 0, firstS = 0;
      for (let s = 0.08; s <= 1.001; s += 0.045) {
        const top = this.index.buildingTopAt(lx + (tx - lx) * s, lz + (tz - lz) * s);
        if (top > ly + (ty - ly) * s) {
          if (run === 0) firstS = s;
          if (++run >= 2) {
            want = Math.max(0.06, firstS - 0.05);
            break;
          }
        } else run = 0;
      }
      this.camClamp += (want - this.camClamp) * (snap ? 1 : Math.min(1, dt * (want < this.camClamp ? 12 : 2.2)));
      tx = lx + (tx - lx) * this.camClamp;
      ty = ly + (ty - ly) * this.camClamp;
      tz = lz + (tz - lz) * this.camClamp;
    }
    if (snap) {
      this.camera.position.set(tx, ty, tz);
    } else {
      const f = 1 - Math.exp(-7 * dt);
      this.camera.position.x += (tx - this.camera.position.x) * f;
      this.camera.position.y += (ty - this.camera.position.y) * f;
      this.camera.position.z += (tz - this.camera.position.z) * f;
    }
    // pulled-in cameras aim at the kid, not past them — keeps them in frame
    if (this.cineLook) {
      // the reveal: aim out past the kid at the light on the water, lifted to the horizon
      this.camera.lookAt(this.cineLook.x, WATER_Y + 50, this.cineLook.z);
    } else {
      const ahead = this.inside ? 60 : 190 * z * this.camClamp;
      this.camera.lookAt(this.px + fx * ahead, this.kidY + 20, this.pz + fz * ahead);
    }
    if (!this.inside) {
      const fog = this.scene.fog as THREE.Fog;
      // open the far plane + fog out over the water while kayaking or during the
      // look-out-to-sea cutaway, so the far light (and its beacon) render past the
      // normal 6000 cull; restored to the zoom-based values back on land.
      const seaView = this.kayaking || !!this.cineLook;
      const wantFar = seaView ? 11000 : 6000;
      if (this.camera.far !== wantFar) { this.camera.far = wantFar; this.camera.updateProjectionMatrix(); }
      if (seaView) { fog.near = 3200; fog.far = 9500; }
      else { fog.near = 1300 * z; fog.far = 2900 * z + 700; }
    }
  }

  // the live "season turns" beat: stash where you stand, show the card, then fade
  // and reload the town re-dressed for the new season (you respawn on the spot)
  private seasonTurning = false;
  // Level 1 complete → the "Seasons Unlocked" reward. Flag it (fires once), set the winter
  // pick, save a resume point, show the celebratory card, then fade-reload into winter.
  private unlockSeasons() {
    this.seasonTurning = true;
    localStorage.setItem('nbpt-seasons-rewarded', '1');   // unlocks the picker + the winter default
    localStorage.setItem('nbpt-season', 'winter');         // Level 2 plays in winter
    localStorage.setItem('nbpt-l2', '1');                  // finishing Level 1 unlocks Level 2 (no ?l2 needed)
    localStorage.setItem('nbpt-resume-pos', JSON.stringify({ x: Math.round(this.px), z: Math.round(this.pz) }));
    // the animated Level 2 promo owns the moment; its Begin button (or a fallback timer)
    // fades through and reloads into the winter Level 2
    this.hud.levelTwoPromo(() => this.hud.fadeThrough(() => location.reload()));
  }

  // off-screen objective pointer: project the beacon to the screen; if it's
  // off-screen, show a gold arrow clamped to the screen edge (pointing the way)
  // plus the distance. On-screen → hide it (the pillar of light is the cue).
  private _wp = new THREE.Vector3();
  private _wpV = new THREE.Vector3();
  private updateWaypoint() {
    const guide = this.hud.guide;
    if (!guide || this.inside || this.boating || this.sweeping || this.hud.dialogueOpen) {
      this.hud.setWaypoint(null);
      this.hud.setObjectiveArrow(null);
      return;
    }
    this.camera.updateMatrixWorld();
    const inv = this.camera.matrixWorldInverse;
    const baseY = this.index.heightAtPx(guide.x, guide.z);
    // direction to the beacon's landing spot in screen space — drives the always-on
    // objective-pill arrow (steering), whether the beam is on- or off-screen
    const w = this._wp.set(guide.x, baseY + 60, guide.z);
    const behind = this._wpV.copy(w).applyMatrix4(inv).z >= 0;
    const wndc = w.project(this.camera);
    let nx = wndc.x, ny = wndc.y;
    if (behind) { nx = -nx; ny = -ny; }
    this.hud.setObjectiveArrow(Math.atan2(-ny, nx));   // same convention as the edge arrow
    // the beam is tall — it counts as "on screen" if ANY point up its body is visible
    for (const h of [15, 230, 440]) {
      const p = this._wp.set(guide.x, baseY + h, guide.z);
      const front = this._wpV.copy(p).applyMatrix4(inv).z < 0;
      const ndc = p.project(this.camera);
      if (front && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1) { this.hud.setWaypoint(null); return; }
    }
    // off-screen: aim the edge arrow with the beam's lower body (the landing spot)
    const m = Math.max(Math.abs(nx), Math.abs(ny)) || 1;
    const ex = nx / m, ey = ny / m;
    const sx = innerWidth / 2 + ex * (innerWidth / 2 - 40);
    const sy = innerHeight / 2 - ey * (innerHeight / 2 - 52);   // NDC up → screen up
    this.hud.setWaypoint({ x: sx, y: sy, angle: Math.atan2(-ey, ex) });   // arrow points toward the goal
  }

  // ---------- travel & search ----------

  travelTo(id: string) {
    const lm = this.world.landmarks.find((l) => l.id === id);
    if (lm) this.travelToXY(lm.x, lm.y);
  }

  travelToXY(x: number, y: number) {
    // most callers wrap this in fadeThrough (which also closes transient UI), but some
    // teleport directly (promo CTAs, the nbpt.* debug hooks) — a dialogue must never
    // ride along across town, so close here too (idempotent)
    this.hud.closeTransient();
    this.race?.cancel('fast travel skips the ride — tap 🏁 to race again');
    const spot = this.findFree(x, y);
    this.px = spot.x;
    this.pz = spot.y;
    this.kidY = Math.max(this.terrain.heightAt(this.px, this.pz), this.index.deckHeightAt(this.px, this.pz));
    this.dogY = this.kidY;
    this.kid.setPos(this.px, this.pz);
    this.kid.root.position.y = this.kidY;
    this.dog.root.position.set(this.px - 22, this.kidY, this.pz + 16);
    this.ensureRect(true);
    this.updateCamera(0, true);
  }

  // the birdwatcher reveal: swing the chase cam out to the mystery light on the water
  // (movement freezes via cineLook), then endLookOut() returns to the normal chase.
  lookOutToSea(x: number, z: number) { this.cineLook = { x, z }; this.sky.duskIn(); }
  endLookOut() { this.cineLook = null; this.sky.duskOut(); }

  // address bar: "241 high" finds 241 High Street; otherwise names of
  // businesses, parks, buildings, streets, and water — all from the map data
  private searchPlaces(q: string): { label: string; sub: string; x: number; y: number }[] {
    q = q.trim().toLowerCase();
    if (q.length < 2) return [];
    // old magic words outrank geography
    const magic = this.eggs?.searchEntries(q) || [];
    if (magic.length) return magic;
    const out: { label: string; sub: string; x: number; y: number; score: number }[] = [];
    const m = q.match(/^(\d+[a-z]?)\s+(.+)$/);
    if (m && m[2].length >= 2) {
      for (const st of this.world.addrs || []) {
        const sl = st.s.toLowerCase();
        if (!sl.includes(m[2])) continue;
        let best: [string, number, number] | null = null;
        let bestGap = Infinity;
        const want = parseInt(m[1], 10);
        for (const entry of st.a) {
          if (entry[0].toLowerCase() === m[1]) { best = entry; bestGap = 0; break; }
          const gap = Math.abs((parseInt(entry[0], 10) || 1e9) - want);
          if (gap < bestGap) { bestGap = gap; best = entry; }
        }
        if (!best) continue;
        out.push({
          label: (bestGap === 0 ? m[1] : best[0]) + ' ' + st.s,
          sub: bestGap === 0 ? 'address' : 'closest mapped address',
          x: best[1], y: best[2],
          score: (bestGap === 0 ? 60 : 40) + (sl.startsWith(m[2]) ? 10 : 0)
        });
      }
    }
    for (const p of this.places) {
      const l = p.label.toLowerCase();
      let score = 0;
      if (l === q) score = 50;
      else if (l.startsWith(q)) score = 30;
      else if (l.includes(' ' + q) || l.includes(q)) score = l.includes(' ' + q) ? 20 : 10;
      if (!score) continue;
      out.push({ ...p, score: score - l.length * 0.05 });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 8).map(({ label, sub, x, y }) => ({ label, sub, x, y }));
  }

  // the Konami payoff: the crimson hoodie goes gold (and back)
  private goldenHoodie() {
    this.golden = !this.golden;
    const swap: Record<string, string> = this.golden
      ? { b03a32: 'd4a92e', '922f29': 'b08c24', a23730: 'c89a28' }
      : { d4a92e: 'b03a32', b08c24: '922f29', c89a28: 'a23730' };
    this.kid.root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const m = mesh.material as THREE.MeshLambertMaterial;
      if (!m || !m.color) return;
      const to = swap[m.color.getHexString()];
      if (to) m.color.set('#' + to);
    });
  }

  private findFree(x: number, y: number): { x: number; y: number } {
    // require a little clearance so the player never lands wedged inside a wall
    // pocket — fast-travel to the Custom House used to drop them stuck in a wall
    const clear = (px: number, py: number) =>
      !this.index.isWaterAt(px, py) &&   // never land a fast-travel in the water (Joppa Flats dropped you in the river)
      !this.index.isBlocked(px, py) &&
      !this.index.isBlocked(px + 16, py) && !this.index.isBlocked(px - 16, py) &&
      !this.index.isBlocked(px, py + 16) && !this.index.isBlocked(px, py - 16);
    if (clear(x, y)) return { x, y };
    for (let r = 8; r < 900; r += 8) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const nx = x + Math.cos(a) * r, ny = y + Math.sin(a) * r;
        if (clear(nx, ny)) return { x: nx, y: ny };
      }
    }
    // still nothing within reach — the target sits out in open water (e.g. the tidal
    // flats: the "Joppa Flat" POI is ~7000px from any shore). March back toward
    // downtown and land at the first dry, unblocked shore we cross.
    const tx = TOWN.spawn.x, ty = TOWN.spawn.z;     // downtown spawn — guaranteed land
    const dist = Math.hypot(tx - x, ty - y) || 1;
    const ux = (tx - x) / dist, uy = (ty - y) / dist;
    for (let d = 900; d <= dist; d += 24) {
      if (clear(x + ux * d, y + uy * d)) return { x: x + ux * d, y: y + uy * d };
    }
    return { x: tx, y: ty };                         // last resort: downtown itself
  }
}
