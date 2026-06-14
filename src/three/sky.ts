import * as THREE from 'three';

// Day–night cycle + weather for Clipper Town. Owns the visual sky (gradient
// dome, sun & moon discs, stars, drifting clouds, rain) and computes a lighting
// palette for the current time-of-day that Game applies to its sun/hemisphere/
// fog. Everything is centered on the player each frame so it follows you across
// the whole map; sky elements opt out of scene fog so they stay crisp.

const C = (h: string) => new THREE.Color(h);

// keyed palette colors
const NIGHT_ZEN = C('#2c3c64'), NIGHT_HOR = C('#5a6e96');
const DAY_ZEN = C('#5aa6e6'), DAY_HOR = C('#d2e7f3');
const DUSK_ZEN = C('#3b3a66'), DUSK_HOR = C('#f0935a');
const DAY_SUN = C('#fff3da'), DUSK_SUN = C('#ff9a4e');
const NIGHT_HEMI_SKY = C('#5a6ca0'), NIGHT_HEMI_GND = C('#41495a');
const DAY_HEMI_SKY = C('#dceeff'), DAY_HEMI_GND = C('#8a9a6c');
const OVERCAST = C('#aab0b6');

const clamp = (v: number, lo: number, hi: number) => v < lo ? lo : v > hi ? hi : v;

export interface SkyState {
  sunDir: THREE.Vector3;        // unit vector toward the sun (for the directional light)
  sunColor: THREE.Color;
  sunIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  fog: THREE.Color;
  elev: number;                 // sun elevation, -1 (midnight) .. +1 (noon)
  wet: number;                  // precipitation intensity 0..1
}

export class Sky {
  tod: number;                  // 0..1 (0 = midnight, 0.5 = noon)
  private period: number;       // seconds per full day
  private snowMode: boolean;

  private dome: THREE.Mesh;
  private domeT: Float32Array;  // per-vertex up-factor (0 horizon .. 1 zenith)
  private domeCol: THREE.BufferAttribute;
  private sun: THREE.Mesh;
  private moon: THREE.Mesh;
  private stars: THREE.Points;
  private starMat: THREE.PointsMaterial;
  private clouds = new THREE.Group();
  private cloudData: { g: THREE.Object3D; vx: number; vz: number }[] = [];
  private rain: THREE.Points;
  private rainMat: THREE.PointsMaterial;
  private rainV: Float32Array;

  private wet = 0;
  private wetTarget = 0;
  private wetTimer = 70;
  private forced: number | null = null;

  readonly state: SkyState = {
    sunDir: new THREE.Vector3(0, 1, 0), sunColor: new THREE.Color(), sunIntensity: 1.3,
    hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), hemiIntensity: 0.5,
    fog: new THREE.Color(), elev: 1, wet: 0
  };

  constructor(scene: THREE.Scene, opts: { startTod?: number; period?: number; snow?: boolean }) {
    this.tod = opts.startTod ?? 0.34;
    this.period = opts.period ?? 360;
    this.snowMode = !!opts.snow;

    // gradient dome (huge inverted sphere, recolored per frame by vertex height)
    const domeGeo = new THREE.SphereGeometry(4600, 24, 16);
    const n = domeGeo.attributes.position.count;
    this.domeT = new Float32Array(n);
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const y = domeGeo.attributes.position.getY(i);
      this.domeT[i] = clamp((y / 4600) * 1.25 + 0.12, 0, 1);
    }
    this.domeCol = new THREE.BufferAttribute(cols, 3);
    domeGeo.setAttribute('color', this.domeCol);
    this.dome = new THREE.Mesh(domeGeo, new THREE.MeshBasicMaterial({
      vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false
    }));
    this.dome.renderOrder = -1;

    // sun & moon discs (unlit, unfogged) ride far out in their sky directions
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(115, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#fff2c8', fog: false, transparent: true, depthWrite: false }));
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(78, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#eef1f6', fog: false, transparent: true, depthWrite: false }));
    this.sun.renderOrder = -1; this.moon.renderOrder = -1;

    // stars scattered over the upper dome
    const SN = 1400;
    const sp = new Float32Array(SN * 3);
    for (let i = 0; i < SN; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.random() * 0.92;               // bias toward the dome top
      const r = 4350;
      const y = v * r;
      const rr = Math.sqrt(Math.max(0, r * r - y * y));
      sp[i * 3] = Math.cos(u) * rr;
      sp[i * 3 + 1] = y + 40;
      sp[i * 3 + 2] = Math.sin(u) * rr;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.starMat = new THREE.PointsMaterial({
      color: '#fbfcff', size: 3.4, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false
    });
    this.stars = new THREE.Points(sg, this.starMat);
    this.stars.frustumCulled = false;

    // drifting clouds: clusters of squashed white puffs, lit by sun + hemi so
    // they tint warm at sunset and go dark at night for free
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 3);
      const mat = new THREE.MeshLambertMaterial({ color: '#fbfdff', transparent: true, opacity: 0.92, fog: false, depthWrite: true });
      for (let p = 0; p < puffs; p++) {
        const r = 42 + Math.random() * 52;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
        puff.scale.set(1, 0.45, 1);
        puff.position.set((Math.random() - 0.5) * 150, (Math.random() - 0.5) * 22, (Math.random() - 0.5) * 110);
        g.add(puff);
      }
      g.position.set((Math.random() - 0.5) * 5000, 360 + Math.random() * 320, (Math.random() - 0.5) * 5000);
      this.clouds.add(g);
      this.cloudData.push({ g, vx: (Math.random() - 0.5) * 18, vz: (Math.random() - 0.5) * 18 });
    }

    // rain (or snow in winter): points raining down around the player
    const RN = 1300;
    const rp = new Float32Array(RN * 3);
    this.rainV = new Float32Array(RN);
    for (let i = 0; i < RN; i++) {
      rp[i * 3] = (Math.random() - 0.5) * 2000;
      rp[i * 3 + 1] = Math.random() * 700;
      rp[i * 3 + 2] = (Math.random() - 0.5) * 2000;
      this.rainV[i] = this.snowMode ? 70 + Math.random() * 90 : 600 + Math.random() * 280;
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
    this.rainMat = new THREE.PointsMaterial({
      color: this.snowMode ? '#ffffff' : '#9fb4c4',
      size: this.snowMode ? 4 : 2.4, transparent: true, opacity: 0, depthWrite: false, fog: true
    });
    this.rain = new THREE.Points(rg, this.rainMat);
    this.rain.frustumCulled = false;

    scene.add(this.dome, this.sun, this.moon, this.stars, this.clouds, this.rain);
  }

  // jump straight to a time of day (0..1) — used by the debug hook
  setTod(t: number) { this.tod = ((t % 1) + 1) % 1; }
  // force a shower (1) / clear (0) / release back to auto (null)
  forceWeather(w: number | null) { this.forced = w; }

  update(dt: number, px: number, pz: number, t: number): SkyState {
    this.tod = (this.tod + dt / this.period) % 1;

    // ---- weather state machine: dry spells punctuated by showers ----
    if (this.forced !== null) {
      this.wetTarget = this.forced;
    } else {
      this.wetTimer -= dt;
      if (this.wetTimer <= 0) {
        if (this.wetTarget > 0) { this.wetTarget = 0; this.wetTimer = 100 + Math.random() * 150; }
        else { this.wetTarget = 0.55 + Math.random() * 0.45; this.wetTimer = 45 + Math.random() * 70; }
      }
    }
    this.wet += (this.wetTarget - this.wet) * Math.min(1, dt * 0.35);

    // ---- sun geometry + palette ----
    const elev = Math.sin((this.tod - 0.25) * Math.PI * 2);          // -1..1
    const day = clamp((elev + 0.08) / 0.32, 0, 1);                   // 0 night .. 1 day
    const tw = clamp(1 - Math.abs(elev) / 0.20, 0, 1);               // dawn/dusk band
    const wet = this.wet;
    const s = this.state;

    const zen = NIGHT_ZEN.clone().lerp(DAY_ZEN, day).lerp(DUSK_ZEN, tw * 0.5);
    const hor = NIGHT_HOR.clone().lerp(DAY_HOR, day).lerp(DUSK_HOR, tw * 0.85);
    s.sunColor.copy(DUSK_SUN).lerp(DAY_SUN, day);
    let sunI = 0.9 + day * 0.75;    // strong moonlight floor at night
    let hemiI = 0.85 + day * 0.08;  // near-daylight ambient at night so it's plainly visible
    s.hemiSky.copy(NIGHT_HEMI_SKY).lerp(DAY_HEMI_SKY, day);
    s.hemiGround.copy(NIGHT_HEMI_GND).lerp(DAY_HEMI_GND, day);
    if (wet > 0.01) {
      const grey = OVERCAST.clone().multiplyScalar(0.35 + day * 0.6);
      zen.lerp(grey, wet * 0.72);
      hor.lerp(grey, wet * 0.72);
      sunI *= 1 - wet * 0.6;
      hemiI *= 1 - wet * 0.22;
    }
    s.sunIntensity = sunI;
    s.hemiIntensity = hemiI;
    s.fog.copy(hor);
    s.elev = elev;
    s.wet = wet;

    // sun direction: an east→west arc that's overhead at noon
    const az = (this.tod - 0.5) * Math.PI * 2;
    const horiz = Math.sqrt(Math.max(0.0001, 1 - Math.min(1, elev * elev)));
    // at night the moon rides high overhead so it actually lights surfaces
    // instead of grazing the horizon; by day the sun follows its true arc. Ramp
    // the lift in over the twilight band so shadows don't snap at dusk.
    const nightLift = Math.max(0, Math.min(1, -elev / 0.2));
    const lightY = Math.max(0.06, elev) * (1 - nightLift) + 0.5 * nightLift;
    s.sunDir.set(Math.sin(az) * horiz, lightY, Math.cos(az) * horiz).normalize();

    // ---- recolor the dome (top = zenith, bottom = horizon) ----
    const arr = this.domeCol.array as Float32Array;
    const cz = zen, ch = hor;
    for (let i = 0; i < this.domeT.length; i++) {
      const f = this.domeT[i];
      arr[i * 3] = ch.r + (cz.r - ch.r) * f;
      arr[i * 3 + 1] = ch.g + (cz.g - ch.g) * f;
      arr[i * 3 + 2] = ch.b + (cz.b - ch.b) * f;
    }
    this.domeCol.needsUpdate = true;
    this.dome.position.set(px, 0, pz);
    this.stars.position.set(px, 0, pz);
    this.starMat.opacity = clamp(1 - day * 1.7, 0, 1) * 0.95;
    (this.starMat as THREE.PointsMaterial).visible = this.starMat.opacity > 0.02;

    // ---- sun & moon discs ----
    const trueDir = new THREE.Vector3(Math.sin(az) * horiz, elev, Math.cos(az) * horiz).normalize();
    this.sun.position.set(px + trueDir.x * 3000, trueDir.y * 3000, pz + trueDir.z * 3000);
    (this.sun.material as THREE.MeshBasicMaterial).color.copy(s.sunColor);
    (this.sun.material as THREE.MeshBasicMaterial).opacity = clamp((elev + 0.06) / 0.12, 0, 1);
    this.sun.visible = elev > -0.06;
    // moon opposite the sun
    this.moon.position.set(px - trueDir.x * 3000, -elev * 3000, pz - trueDir.z * 3000);
    (this.moon.material as THREE.MeshBasicMaterial).opacity = clamp((-elev + 0.04) / 0.18, 0, 1) * 0.95;
    this.moon.visible = elev < 0.04;

    // ---- clouds drift + wrap around the player ----
    for (const c of this.cloudData) {
      const g = c.g;
      g.position.x += c.vx * dt;
      g.position.z += c.vz * dt;
      if (g.position.x - px > 2700) g.position.x -= 5400;
      else if (g.position.x - px < -2700) g.position.x += 5400;
      if (g.position.z - pz > 2700) g.position.z -= 5400;
      else if (g.position.z - pz < -2700) g.position.z += 5400;
    }

    // ---- precipitation ----
    this.rainMat.opacity = clamp(wet * 1.15, 0, 1) * (this.snowMode ? 0.85 : 0.6);
    this.rain.visible = this.rainMat.opacity > 0.02;
    if (this.rain.visible) {
      const a = (this.rain.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
      const slant = this.snowMode ? 16 : 40;
      for (let i = 0; i < this.rainV.length; i++) {
        a[i * 3 + 1] -= this.rainV[i] * dt;
        a[i * 3] += (this.snowMode ? Math.sin(t * 0.0011 + i) * slant : slant) * dt;
        if (a[i * 3 + 1] < 0) {
          a[i * 3] = px + (Math.random() - 0.5) * 2000;
          a[i * 3 + 1] = 520 + Math.random() * 200;
          a[i * 3 + 2] = pz + (Math.random() - 0.5) * 2000;
        } else if (Math.abs(a[i * 3] - px) > 1200) {
          a[i * 3] = px + (Math.random() - 0.5) * 2000;
          a[i * 3 + 2] = pz + (Math.random() - 0.5) * 2000;
        }
      }
      (this.rain.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
    }

    return s;
  }
}
