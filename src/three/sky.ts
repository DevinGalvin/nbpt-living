import * as THREE from 'three';

// Day–night cycle + weather for Clipper Town. Owns the visual sky (gradient
// dome, sun & moon discs, stars, rain) and computes a lighting
// palette for the current time-of-day that Game applies to its sun/hemisphere/
// fog. Everything is centered on the player each frame so it follows you across
// the whole map; sky elements opt out of scene fog so they stay crisp.

const C = (h: string) => new THREE.Color(h);

// keyed palette colors
const NIGHT_ZEN = C('#243354'), NIGHT_HOR = C('#4d5f86');
const DAY_ZEN = C('#5aa6e6'), DAY_HOR = C('#d2e7f3');
const DUSK_ZEN = C('#3b3a66'), DUSK_HOR = C('#f0935a');
const DAY_SUN = C('#fff3da'), DUSK_SUN = C('#ff9a4e');
const NIGHT_HEMI_SKY = C('#4e5e8e'), NIGHT_HEMI_GND = C('#3a4150');
const DAY_HEMI_SKY = C('#dceeff'), DAY_HEMI_GND = C('#8a9a6c');
const OVERCAST = C('#aab0b6');

const clamp = (v: number, lo: number, hi: number) => v < lo ? lo : v > hi ? hi : v;

// Sun altitude over the day (tod 0..1 → elevation -1..1), hand-shaped so most of
// the cycle is daytime + lingering golden sunrise/sunset, with only a brief,
// shallow night (the dark is the least-loved part). Replaces a plain sine.
const SUN_T = [0,    0.06, 0.14, 0.24, 0.30, 0.70, 0.76, 0.86, 0.94, 1.0];
const SUN_E = [-0.3, 0.0,  0.2,  0.9,  1.0,  1.0,  0.9,  0.2,  0.0,  -0.3];
function sunAltitude(tod: number): number {
  for (let i = 0; i + 1 < SUN_T.length; i++) {
    if (tod <= SUN_T[i + 1]) {
      const f = (tod - SUN_T[i]) / (SUN_T[i + 1] - SUN_T[i]);
      return SUN_E[i] + (SUN_E[i + 1] - SUN_E[i]) * f;
    }
  }
  return SUN_E[SUN_E.length - 1];
}

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
  night: number;                // 0 (full day) .. 1 (lamps-on dark) — drives street lamps
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
    fog: new THREE.Color(), elev: 1, wet: 0, night: 0
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

    // winter snow only (no rain in other seasons): points falling around the player
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

    scene.add(this.dome, this.sun, this.moon, this.stars, this.rain);
  }

  // jump straight to a time of day (0..1) — used by the debug hook
  setTod(t: number) { this.tod = ((t % 1) + 1) % 1; }
  // force a shower (1) / clear (0) / release back to auto (null)
  forceWeather(w: number | null) { this.forced = w; }

  update(dt: number, px: number, pz: number, t: number): SkyState {
    this.tod = (this.tod + dt / this.period) % 1;

    // ---- weather: only winter precipitates (snow). No rain in the other seasons. ----
    if (!this.snowMode) {
      this.wetTarget = 0;                       // rain removed — spring/summer/fall stay clear
    } else if (this.forced !== null) {
      this.wetTarget = this.forced;
    } else {
      // winter snow comes and goes in showers
      this.wetTimer -= dt;
      if (this.wetTimer <= 0) {
        if (this.wetTarget > 0) { this.wetTarget = 0; this.wetTimer = 100 + Math.random() * 150; }
        else { this.wetTarget = 0.55 + Math.random() * 0.45; this.wetTimer = 45 + Math.random() * 70; }
      }
    }
    this.wet += (this.wetTarget - this.wet) * Math.min(1, dt * 0.35);

    // ---- sun geometry + palette ----
    const elev = sunAltitude(this.tod);                              // -1..1, mostly daytime
    const day = clamp((elev + 0.08) / 0.32, 0, 1);                   // 0 night .. 1 day
    const tw = clamp(1 - Math.abs(elev) / 0.26, 0, 1);               // wide dawn/dusk glow band
    const wet = this.wet;
    const s = this.state;

    const zen = NIGHT_ZEN.clone().lerp(DAY_ZEN, day).lerp(DUSK_ZEN, tw * 0.5);
    const hor = NIGHT_HOR.clone().lerp(DAY_HOR, day).lerp(DUSK_HOR, tw * 0.85);
    s.sunColor.copy(DUSK_SUN).lerp(DAY_SUN, day);
    let sunI = 0.82 + day * 0.78;   // moonlight floor at night (brief night, so a bit brighter)
    let hemiI = 0.8 + day * 0.08;   // moonlit ambient — visible, the dark spell is short now
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
    s.night = clamp(1 - day * 1.2, 0, 1);   // lamps ramp on through dusk, full at night

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
