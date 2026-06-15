import * as THREE from 'three';
import type { WorldData } from '../world/types';
import { WorldIndex, CHUNK } from '../world/index';
import { Terrain } from '../world/terrain';
import { buildChunkDecor } from '../three/decor';
import { detailTex } from '../three/textures';
import { buildWater, WATER_Y } from '../three/water';
import { Sky } from '../three/sky';
import { Kid, Dog, Bike } from '../three/actors';
import { Life } from './life';
import { GillisBridge } from '../three/gillis';
import { Hud } from './hud';
import { QuestRunner, BOAT_ARRIVE } from './quest';
import { TunnelScene, TUNNEL_ENTRY } from './tunnel';
import { DenScene, StarRoomScene, NewsroomScene, Interior } from './interiors';
import { HistoryRunner, SITES } from './history';
import { EggRunner } from './eggs';
import { GameAudio } from './audio';
import { STYLE, SEASON, storySeason, spineComplete } from '../world/style';

const JOG = 200;     // world px/s (8 px = 1 m) — fast, gamey
const SPRINT = 380;
const BOAT_DOOR = { x: -224, z: -1183 }; // the waterline den door — rowing near it beaches you

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
  ground: THREE.Mesh;
  decor: THREE.Mesh | null;
  tex: THREE.CanvasTexture;
  signs: THREE.Mesh[];
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
  private keys = new Set<string>();
  private chunks = new Map<string, ChunkEntry>();
  private pending: string[] = [];
  private lastTime = 0;
  // perf: weak/software GPU detected at startup; dynamic-resolution sampler state
  private lowGPU = false;
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
  private camClamp = 1;             // occlusion pull-in (1 = full distance)
  private chaseCam = true;          // C toggles chase <-> north-up map view
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
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowGPU });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight, false); // false: let CSS size the canvas (full-bleed)
    this.renderer.setClearColor(STYLE.sky);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game')!.appendChild(this.renderer.domElement);

    const fogRange: [number, number] = SEASON === 'fall' ? [1050, 2500] : SEASON === 'winter' ? [1250, 2900] : [1500, 3200];
    this.scene.fog = new THREE.Fog(STYLE.sky, fogRange[0], fogRange[1]);
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 10, 6000);

    this.hemi = SEASON === 'winter' ? new THREE.HemisphereLight('#dde9f8', '#a8b2bc', 0.55)
      : SEASON === 'fall' ? new THREE.HemisphereLight('#f2e6cc', '#8a8058', 0.5)
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
    this.sky = new Sky(this.scene, { startTod: 0.34, period: 420, snow: SEASON === 'winter' });

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
    this.gillis = new GillisBridge(this.scene, this.index, world);

    // spawn at Market Square — or, after a season turned the town, exactly where
    // you stood (a one-shot resume point so the re-skin reload doesn't teleport you)
    let sx = 0, sz = 40;
    try {
      const r = JSON.parse(localStorage.getItem('nbpt-resume-pos') || 'null');
      if (r && typeof r.x === 'number' && typeof r.z === 'number') { sx = r.x; sz = r.z; localStorage.removeItem('nbpt-resume-pos'); }
    } catch { /* ignore */ }
    const spawn = this.findFree(sx, sz);
    this.px = spawn.x;
    this.pz = spawn.y;
    this.kid.setPos(this.px, this.pz);
    this.dog.root.position.set(this.px - 22, 0, this.pz + 16);
    this.ensureRect(true);
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
    this.hud.showBike(localStorage.getItem('nbpt-bike') === '1');
    this.bike.root.visible = false;
    this.scene.add(this.bike.root);
    this.hud.initMinimap(world);
    this.quest = new QuestRunner(this.scene, this.index, this.hud, this.audio, () => this.enterTunnel(), () => {
      localStorage.setItem('nbpt-bike', '1');
      this.bikeEarned();
    }, () => this.boatRide(), () => this.enterStar(), () => this.enterNews(), () => this.enterDen());
    this.history = new HistoryRunner(this.scene, this.index, this.hud, this.audio);
    this.eggs = new EggRunner(
      this.scene, this.index, this.hud, this.audio,
      () => ({ x: this.dog.root.position.x, z: this.dog.root.position.z }),
      () => this.goldenHoodie()
    );

    if (SEASON === 'winter') {
      // the big tree in Market Square (snow now falls from the Sky weather system)
      this.scene.add(this.buildHolidayTree(-100, -48));
    }

    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return; // typing an address, not playing
      this.keys.add(e.code);
      if (e.code === 'KeyC') this.chaseCam = !this.chaseCam;
      if (e.code === 'KeyE' && !this.hud.dialogueOpen) {
        if (this.inTunnel) this.tunnel?.tryInteract(this.px, this.pz);
        else if (this.interior) this.interior.tryInteract(this.px, this.pz);
        else {
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
      _quest: this.quest,
      landmarks: world.landmarks.map((l) => l.id),
      _game: this,
      _THREE: THREE
    };

    this.renderer.setAnimationLoop((t) => this.frame(t));
    document.getElementById('loading')?.style.setProperty('opacity', '0');
    setTimeout(() => document.getElementById('loading')?.remove(), 700);

    // newcomers land in a 3-D town with no idea it's a story — greet them once
    if (localStorage.getItem('nbpt-welcomed') !== '1') {
      setTimeout(() => this.hud.showWelcome(() => localStorage.setItem('nbpt-welcomed', '1')), 850);
    }
  }

  // ---------- chunk streaming ----------

  private ensureRect(sync = false) {
    const z = this.camZoom;
    const fx = Math.sin(this.camAz), fz = Math.cos(this.camAz);
    // cover around the player and ahead along the camera's forward direction
    const centers: [number, number, number][] = [
      [this.px, this.pz, 1150 * z],
      [this.px + fx * 1250 * z, this.pz + fz * 1250 * z, 1150 * z]
    ];
    for (const [mx, mz, rad] of centers) {
      const x0 = Math.floor((mx - rad) / CHUNK), x1 = Math.floor((mx + rad) / CHUNK);
      const z0 = Math.floor((mz - rad) / CHUNK), z1 = Math.floor((mz + rad) / CHUNK);
      for (let cy = z0; cy <= z1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const key = cx + ',' + cy;
          if (!this.chunks.has(key) && !this.pending.includes(key)) {
            if (sync) this.buildChunk(key);
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
      let budget = 2;
      while (budget-- > 0 && this.pending.length) this.buildChunk(this.pending.shift()!);
    }
    // evict farthest
    while (this.chunks.size > 110) {
      let worstKey = '', worstD = -1;
      for (const key of this.chunks.keys()) {
        const [cx, cy] = key.split(',').map(Number);
        const d = ((cx + 0.5) * CHUNK - this.px) ** 2 + ((cy + 0.5) * CHUNK - this.pz) ** 2;
        if (d > worstD) { worstD = d; worstKey = key; }
      }
      this.disposeChunk(worstKey);
    }
  }

  private buildChunk(key: string) {
    if (this.chunks.has(key)) return;
    const [cx, cy] = key.split(',').map(Number);
    const canvas = this.index.groundCanvas(key);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    // terrain-displaced ground with analytic normals (seamless across chunks)
    const geo = new THREE.PlaneGeometry(CHUNK, CHUNK, 24, 24);
    geo.rotateX(-Math.PI / 2);
    const posAttr = geo.attributes.position as THREE.BufferAttribute;
    const normAttr = geo.attributes.normal as THREE.BufferAttribute;
    const cxw = (cx + 0.5) * CHUNK, cyw = (cy + 0.5) * CHUNK;
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
    const ground = new THREE.Mesh(geo, groundMat);
    ground.position.set(cxw, 0, cyw);
    ground.receiveShadow = true;
    this.scene.add(ground);

    const decor = buildChunkDecor(this.world, this.index, key);
    if (decor) this.scene.add(decor);

    const signs: THREE.Mesh[] = [];
    for (const s of this.index.shopSignsFor(key)) {
      const mesh = makeSignMesh(s.name);
      mesh.position.set(s.x, this.terrain.heightAt(s.x, s.z) + 22.5, s.z);
      mesh.rotation.y = s.rotY;
      this.scene.add(mesh);
      signs.push(mesh);
    }

    this.chunks.set(key, { ground, decor, tex, signs });
  }

  private disposeChunk(key: string) {
    const e = this.chunks.get(key);
    if (!e) return;
    this.scene.remove(e.ground);
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
    e.ground.geometry.dispose();
    (e.ground.material as THREE.MeshBasicMaterial).dispose();
    e.tex.dispose();
    this.chunks.delete(key);
  }

  // ---------- movement ----------

  toggleBike() {
    if (localStorage.getItem('nbpt-bike') !== '1' || this.inside || this.boating) return;
    this.riding = !this.riding;
    this.bike.root.visible = this.riding;
    this.hud.setBikeState(this.riding);
    this.audio.bell();
  }

  // surfaces the button the moment the bike is earned
  bikeEarned() {
    this.hud.showBike(true);
  }

  // true whenever the player is in any hand-built interior (tunnel/den/star)
  private get inside(): boolean {
    return this.inTunnel || this.interior !== null;
  }

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
      if (this.riding) this.toggleBike();
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
    this.hud.fadeThrough(() => this.startBoat());
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
    if (this.riding) this.toggleBike();
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

    const k = this.keys;
    // screen-space input ...
    let ix = (k.has('KeyA') || k.has('ArrowLeft') ? -1 : 0) + (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0);
    let iz = (k.has('KeyW') || k.has('ArrowUp') ? -1 : 0) + (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    if (this.hud.joyActive && (this.hud.joyX || this.hud.joyY)) {
      ix = this.hud.joyX;
      iz = this.hud.joyY;
    }
    // ...mapped through the camera azimuth (W = away from camera)
    const fwdX = Math.sin(this.camAz), fwdZ = Math.cos(this.camAz);
    const rightX = -Math.cos(this.camAz), rightZ = Math.sin(this.camAz);
    let vx = fwdX * -iz + rightX * ix;
    let vz = fwdZ * -iz + rightZ * ix;
    if (this.debugVec) {
      if (performance.now() > this.debugVec.until) this.debugVec = null;
      else { vx = this.debugVec.x; vz = this.debugVec.y; }
    }
    if (this.hud.dialogueOpen) { vx = 0; vz = 0; }
    const mag = Math.hypot(vx, vz);
    if (mag > 1) { vx /= mag; vz /= mag; }

    this.sprinting = this.autoRun || k.has('ShiftLeft') || k.has('ShiftRight') || this.hud.sprintTouch;
    let speed = this.riding ? 530 : this.sprinting ? SPRINT : JOG;
    if (this.index.isSlow(this.px, this.pz)) speed *= 0.5;

    const half = 5;   // a slightly slimmer footprint so narrow streets stay passable
    const free = this.boating
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
        && !(this.life && this.life.obstacleAt(x, y));
    // sub-step the move and slide along walls so tight streets glide instead of
    // snagging. When a move is wedged on both axes, try to slip free (round the
    // corner / glance off a one-sided jut) rather than stopping dead — keyboard
    // players kept getting pinned on the corners of houses with no way out.
    const moveX = vx * speed * dt, moveZ = vz * speed * dt;
    const steps = Math.max(1, Math.ceil(Math.hypot(moveX, moveZ) / 4));
    const stepX = moveX / steps, stepZ = moveZ / steps;
    let nx = this.px, nz = this.pz;
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
    // safety net: nothing should ever trap you fully inside a wall — if it does
    // (a car, the bounds clamp, a teleport), nudge out to the nearest open ground
    if (!this.inside && !this.boating && this.index.isBlocked(nx, nz)) {
      for (const [dx, dz] of [[6, 0], [-6, 0], [0, 6], [0, -6], [10, 10], [-10, 10], [10, -10], [-10, -10]] as const) {
        if (!this.index.isBlocked(nx + dx, nz + dz)) { nx += dx; nz += dz; break; }
      }
    }

    if (!this.inside) {
      const b = this.world.meta.bounds;
      nx = Math.min(b.maxX - 12, Math.max(b.minX + 12, nx));
      nz = Math.min(b.maxY - 12, Math.max(b.minY + 12, nz));
    }

    const realVx = (nx - this.px) / dt, realVz = (nz - this.pz) / dt;
    this.px = nx;
    this.pz = nz;
    this.kid.setPos(this.px, this.pz);
    this.kid.update(dt, realVx, realVz, this.sprinting, this.riding);

    // ride the real terrain, bridge decks, and docks (the tunnel floor is flat).
    // Decks are entered where they meet the grade — passing beneath a raised
    // overpass keeps you on the ground under it, head safely below the span.
    const terrainY = this.inside ? 0 : this.boating ? WATER_Y : this.terrain.heightAt(this.px, this.pz);
    const surfY = this.inside ? 0 : this.boating ? WATER_Y : this.index.surfaceYAt(this.px, this.pz, this.kidY);
    this.kidY += (surfY - this.kidY) * Math.min(1, dt * 12);
    // hop low fences/hedges (they no longer block) — a quick arc as you cross one
    const nearFence = !this.inside && !this.boating && this.index.lowBarrierNear(this.px, this.pz);
    if (Math.hypot(realVx, realVz) > 4 && nearFence && !this.wasNearFence && this.hopT <= 0) this.hopT = 0.5;
    this.wasNearFence = nearFence;
    if (this.hopT > 0) this.hopT = Math.max(0, this.hopT - dt);
    const hop = this.hopT > 0 ? Math.sin((1 - this.hopT / 0.5) * Math.PI) * 8 : 0;
    this.kid.root.position.y = this.kidY + hop + (this.riding ? 7.5 : 0);
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

    const still = Math.hypot(realVx, realVz) < 1;
    if (this.boating) {
      // Clipper rides up in the bow, facing the heading
      this.dog.root.position.set(this.px + Math.sin(this.boatAz) * 17, this.kidY + 7.4, this.pz + Math.cos(this.boatAz) * 17);
      this.dog.root.rotation.y = this.boatAz;
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
        && !this.riding && !this.hud.dialogueOpen && !document.querySelector('#hud .welcome')) {
      this.walkAccum += dt;
      if (this.walkAccum > 3) {
        this.runTipShown = true;
        localStorage.setItem('nbpt-run-tip', '1');
        this.hud.showRunTip();
      }
    }
    if (this.chaseCam) {
      if (movingNow) this.camAz = lerpAngle(this.camAz, Math.atan2(realVx, realVz), Math.min(1, dt * 2.2));
    } else {
      this.camAz = lerpAngle(this.camAz, Math.PI, Math.min(1, dt * 3));
    }
    this.hud.setCompass(Math.PI - this.camAz);
    this.hud.pos = { x: this.px, y: this.pz }; // journey panel's direction hint

    // day–night cycle drives the sun, sky dome, and weather; the shadow
    // window rides with the player
    const sky = this.sky.update(dt, this.px, this.pz, t);
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
    if (this.life && !this.inside) this.life.update(dt, this.px, this.pz, t, Math.sin(this.camAz), Math.cos(this.camAz));
    if (this.gillis && !this.inside) this.gillis.update(dt);
    if (this.inTunnel) this.tunnel!.update(dt, this.px, this.pz);
    else if (this.interior) this.interior.update(dt, this.px, this.pz);
    else if (this.quest) {
      this.quest.update(dt, this.px, this.pz);
      if (this.history) this.history.update(dt, this.px, this.pz, this.quest.nearActive);
      // eggs speak last: quest beats, then history markers, then secrets
      if (this.eggs) this.eggs.update(dt, this.px, this.pz, this.quest.nearActive || (this.history ? this.history.nearActive : false));
    }
    this.audio.update(dt, movingNow, this.sprinting, () =>
      this.inside ? 'hard'
        : surfY > terrainY + 0.5 ? 'wood'
        : this.index.onPavedAt(this.px, this.pz) ? 'hard' : 'soft');
    if (!this.inside) this.ensureRect();
    this.updateCamera(dt);
    this.updateWaypoint();

    // the story turns the season as you finish chapters — fire once the town's
    // dressing no longer matches your progress and you're calm in the overworld
    // (not mid-dialogue, not still reading a CHAPTER COMPLETE card). Once the spine
    // is beaten the picker takes over, so the story never overrides a manual pick.
    if (!this.inside && !this.boating && !this.seasonTurning && !this.hud.dialogueOpen
        && !spineComplete() && !document.querySelector('#hud .chapter.show') && storySeason() !== SEASON) {
      this.turnSeason();
    }

    // polls
    this.pollAcc += dt;
    if (this.pollAcc > 0.45) {
      this.pollAcc = 0;
      this.hud.setStreet(this.inTunnel ? 'the tunnels' : this.interior ? this.interior.name : this.index.nearestRoadName(this.px, this.pz, 170));
      if (!this.inside) {
        // tunnel coords overlap downtown's — minimap dot, gull logic, and
        // landmark banners would all lie underground
        this.hud.setMiniPos(this.px, this.pz);
        this.updateLampSpots();
        this.nearWater = this.index.isWaterAt(this.px, this.pz - 230)
          || this.index.isWaterAt(this.px + 230, this.pz) || this.index.isWaterAt(this.px - 230, this.pz)
          || this.index.isWaterAt(this.px, this.pz + 230);
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
    const ahead = this.inside ? 60 : 190 * z * this.camClamp;
    this.camera.lookAt(this.px + fx * ahead, this.kidY + 20, this.pz + fz * ahead);
    if (!this.inside) {
      const fog = this.scene.fog as THREE.Fog;
      fog.near = 1300 * z;
      fog.far = 2900 * z + 700;
    }
  }

  // the live "season turns" beat: stash where you stand, show the card, then fade
  // and reload the town re-dressed for the new season (you respawn on the spot)
  private seasonTurning = false;
  private turnSeason() {
    this.seasonTurning = true;
    localStorage.setItem('nbpt-resume-pos', JSON.stringify({ x: Math.round(this.px), z: Math.round(this.pz) }));
    this.hud.seasonCard(storySeason());
    setTimeout(() => this.hud.fadeThrough(() => location.reload()), 1900);
  }

  // off-screen objective pointer: project the beacon to the screen; if it's
  // off-screen, show a gold arrow clamped to the screen edge (pointing the way)
  // plus the distance. On-screen → hide it (the pillar of light is the cue).
  private _wp = new THREE.Vector3();
  private _wpV = new THREE.Vector3();
  private updateWaypoint() {
    const guide = this.hud.guide;
    if (!guide || this.inside || this.boating || this.hud.dialogueOpen) { this.hud.setWaypoint(null); return; }
    this.camera.updateMatrixWorld();
    const inv = this.camera.matrixWorldInverse;
    const baseY = this.index.heightAtPx(guide.x, guide.z);
    // the beam is tall — it counts as "on screen" if ANY point up its body is visible
    for (const h of [15, 230, 440]) {
      const p = this._wp.set(guide.x, baseY + h, guide.z);
      const front = this._wpV.copy(p).applyMatrix4(inv).z < 0;
      const ndc = p.project(this.camera);
      if (front && Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1) { this.hud.setWaypoint(null); return; }
    }
    // off-screen: aim the edge arrow with the beam's lower body (the landing spot)
    const w = this._wp.set(guide.x, baseY + 60, guide.z);
    const behind = this._wpV.copy(w).applyMatrix4(inv).z >= 0;
    const ndc = w.project(this.camera);
    let nx = ndc.x, ny = ndc.y;
    if (behind) { nx = -nx; ny = -ny; }
    // clamp the direction onto the screen-edge square, leaving a margin
    const m = Math.max(Math.abs(nx), Math.abs(ny)) || 1;
    const ex = nx / m, ey = ny / m;
    const sx = innerWidth / 2 + ex * (innerWidth / 2 - 40);
    const sy = innerHeight / 2 - ey * (innerHeight / 2 - 52);   // NDC up → screen up
    const angle = Math.atan2(-ey, ex);                          // arrow points toward the goal
    this.hud.setWaypoint({ x: sx, y: sy, angle });
  }

  // ---------- travel & search ----------

  travelTo(id: string) {
    const lm = this.world.landmarks.find((l) => l.id === id);
    if (lm) this.travelToXY(lm.x, lm.y);
  }

  travelToXY(x: number, y: number) {
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
    return { x, y };
  }
}
