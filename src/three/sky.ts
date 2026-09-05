import * as THREE from 'three';
import { CLOUD } from './clouds';

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

// the sun & moon discs ride this far from the CAMERA (not the player), pinned just
// inside the 6000 far plane. Anchoring to the camera fixes their depth at every zoom, so
// ALL terrain/buildings (necessarily nearer than the far plane) occlude them normally
// instead of the disc punching through the horizon. The old player-relative 3000 let
// anything farther than 3000 show through — and when zoomed out the chase cam sat far
// enough back that the disc landed past the far plane. Radii are sized to this distance
// to keep the discs' on-screen size.
const SKY_DIST = 5600;

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
  // a short cinematic dusk override (the birdwatcher reveal): freeze the day cycle and
  // ease to dusk, then ease back to the real time. 'to' holds dusk; 'from' returns + clears.
  private cine: { mode: 'to' | 'from'; target: number; saved: number } | null = null;
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
    this.sun = new THREE.Mesh(new THREE.SphereGeometry(215, 16, 12),
      new THREE.MeshBasicMaterial({ color: '#fff2c8', fog: false, transparent: true, depthWrite: false }));
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(146, 16, 12),
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

    // The clouds themselves. Their shadows have crossed the ground since pass 3 with
    // nothing in the sky to cast them; this is the layer that does. A flat sheet at
    // cloud height, following the camera, reading the SAME noise the shadows read,
    // displaced along the sun so each cloud sits over its own shadow. Sunlit tops,
    // shaded bellies, a bright rim where the sun comes through the edge.
    this.cloudMat = new THREE.ShaderMaterial({
      uniforms: {
        uCloudMap: CLOUD.uCloudMap, uCloudOff: CLOUD.uCloudOff, uCloudScale: CLOUD.uCloudScale, uCloudVis: CLOUD.uCloudVis,
        uLit: { value: new THREE.Color(1, 1, 1) }, uShade: { value: new THREE.Color(0.7, 0.72, 0.78) },
        uCam: { value: new THREE.Vector3() }, uSunShift: { value: new THREE.Vector2() }, uHaze: { value: new THREE.Color(0.8, 0.85, 0.9) }
      },
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: `
        uniform sampler2D uCloudMap;
        uniform vec2 uCloudOff, uSunShift;
        uniform vec3 uCam;
        uniform float uCloudScale, uCloudVis;
        uniform vec3 uLit, uShade, uHaze;
        varying vec3 vWorld;
        void main() {
          vec3 toC = vWorld - uCam;
          float ang = atan(toC.y, length(toC.xz));
          // overhead: the clouds whose shadows cross the ground, mapped by world position
          vec2 uv = (vWorld.xz - uSunShift + uCloudOff) * uCloudScale;
          float cl = texture2D(uCloudMap, uv).r;
          float fine = texture2D(uCloudMap, uv * 3.1 + 0.37).r;
          float nearA = smoothstep(0.50, 0.62, cl) * smoothstep(0.06, 0.16, ang);
          // toward the horizon: banks of distant cloud, mapped by direction so they sit
          // at infinity and stack up the way a sky does, and dissolve into the haze
          vec3 dir = normalize(toC);
          float az = atan(dir.z, dir.x);
          vec2 fuv = vec2(az * 1.9, 0.32 / (ang + 0.045)) + uCloudOff * uCloudScale * 0.3;
          float fcl = texture2D(uCloudMap, fuv).r;
          float farA = smoothstep(0.44, 0.56, fcl) * (1.0 - smoothstep(0.10, 0.24, ang)) * smoothstep(0.012, 0.045, ang);
          float useFar = step(nearA, farA);
          float v = mix(cl, fcl, useFar);
          // sunlit tops, flat shaded bellies: the fine read decides which part of a cloud this is
          float top = smoothstep(0.50, 0.85, v * 0.55 + fine * 0.45);
          vec3 c = mix(uShade, uLit, top);
          float rim = smoothstep(0.50, 0.56, v) * (1.0 - smoothstep(0.56, 0.66, v));
          c += uLit * rim * 0.22;
          // the horizon haze swallows the lowest banks
          c = mix(uHaze, c, smoothstep(0.015, 0.07, ang));
          float a = max(nearA, farA) * min(1.0, uCloudVis * 2.0);
          if (a < 0.003) discard;
          gl_FragColor = vec4(c, a);
          #include <colorspace_fragment>
        }`
    });
    // A shallow cap, not a flat sheet: the walking camera's far plane sits just past
    // the fog (~3100), so a sheet at cloud height would be clipped below ~15° above
    // the horizon — the only sky a chase camera sees. The cap sags from 1000 at the
    // zenith to the ground at its 2900 rim, so every point stays inside the far plane
    // and the rim is always below the horizon.
    const R = 2900, RINGS = 24, SEGS = 64, CLOUD_H = 1000;
    const cp: number[] = [], ci: number[] = [];
    for (let i = 0; i <= RINGS; i++) {
      const r = R * (i / RINGS);
      const y = CLOUD_H * (1 - (r / R) * (r / R));
      for (let j = 0; j < SEGS; j++) {
        const a = (j / SEGS) * Math.PI * 2;
        cp.push(Math.cos(a) * r, y, Math.sin(a) * r);
      }
    }
    for (let i = 0; i < RINGS; i++) for (let j = 0; j < SEGS; j++) {
      const a = i * SEGS + j, b = i * SEGS + (j + 1) % SEGS, c = a + SEGS, d = b + SEGS;
      ci.push(a, c, b, b, c, d);
    }
    const cg = new THREE.BufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute(cp, 3));
    cg.setIndex(ci);
    this.clouds = new THREE.Mesh(cg, this.cloudMat);
    this.clouds.renderOrder = 0;
    this.clouds.frustumCulled = false;

    scene.add(this.dome, this.sun, this.moon, this.stars, this.rain, this.clouds);
  }

  // jump straight to a time of day (0..1) — used by the debug hook
  setTod(t: number) { this.tod = ((t % 1) + 1) % 1; }
  // cinematic dusk dip — hold the sky at `target` (sunset ≈ 0.92) until duskOut() eases it back
  duskIn(target = 0.955) { this.cine = { mode: 'to', target, saved: this.cine ? this.cine.saved : this.tod }; }
  // ease the held sky back. With no arg it returns to the time we dipped from; pass `to`
  // to ease to a specific time instead (the finale calms to a fixed Christmas morning).
  duskOut(to?: number) { if (this.cine) { if (to !== undefined) this.cine.saved = to; this.cine.mode = 'from'; } }
  // force a shower (1) / clear (0) / release back to auto (null)
  forceWeather(w: number | null) { this.forced = w; }

  private clouds!: THREE.Mesh;
  private cloudMat!: THREE.ShaderMaterial;

  update(dt: number, px: number, pz: number, t: number, camPos: THREE.Vector3): SkyState {
    if (this.cine) {
      // ease toward dusk (held) or back to the saved real time, then resume the cycle
      const goal = this.cine.mode === 'to' ? this.cine.target : this.cine.saved;
      this.tod += (goal - this.tod) * Math.min(1, dt * 1.7);
      if (this.cine.mode === 'from' && Math.abs(goal - this.tod) < 0.004) { this.tod = goal; this.cine = null; }
    } else {
      this.tod = (this.tod + dt / this.period) % 1;
    }

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
    // the cloud layer: lit by the day, greyed by weather, over its own shadow
    {
      const CLOUD_H = 1000;
      this.clouds.position.set(px, 0, pz);
      const u = this.cloudMat.uniforms;
      const lit = u.uLit.value as THREE.Color, shade = u.uShade.value as THREE.Color;
      lit.setRGB(1, 1, 1).lerp(s.sunColor, 0.25 * tw).multiplyScalar(0.35 + 0.65 * day).lerp(zen, wet * 0.5);
      shade.copy(zen).lerp(lit, 0.35).multiplyScalar(0.9);
      (u.uCam.value as THREE.Vector3).copy(camPos);
      (u.uHaze.value as THREE.Color).copy(hor);
      const sy = Math.max(0.25, s.sunDir.y);
      (u.uSunShift.value as THREE.Vector2).set(CLOUD_H * s.sunDir.x / sy, CLOUD_H * s.sunDir.z / sy);
      this.clouds.visible = CLOUD.uCloudVis.value > 0.01 && !!CLOUD.uCloudMap.value;
    }
    this.starMat.opacity = clamp(1 - day * 1.7, 0, 1) * 0.95;
    (this.starMat as THREE.PointsMaterial).visible = this.starMat.opacity > 0.02;

    // ---- sun & moon discs ----
    const trueDir = new THREE.Vector3(Math.sin(az) * horiz, elev, Math.cos(az) * horiz).normalize();
    this.sun.position.set(camPos.x + trueDir.x * SKY_DIST, camPos.y + trueDir.y * SKY_DIST, camPos.z + trueDir.z * SKY_DIST);
    (this.sun.material as THREE.MeshBasicMaterial).color.copy(s.sunColor);
    (this.sun.material as THREE.MeshBasicMaterial).opacity = clamp((elev + 0.06) / 0.12, 0, 1);
    // hide the sun disc during the cinematic dusk (the birdwatcher cutaway) so you never
    // watch it travel down — the sky + lighting still ease to dusk, but no disc moves
    this.sun.visible = elev > -0.06 && !this.cine;
    // moon opposite the sun (its own direction: horizontally opposite, height mirrors
    // the sun's elevation), pinned at the same camera-relative far distance
    const moonDir = new THREE.Vector3(-trueDir.x, -elev, -trueDir.z).normalize();
    this.moon.position.set(camPos.x + moonDir.x * SKY_DIST, camPos.y + moonDir.y * SKY_DIST, camPos.z + moonDir.z * SKY_DIST);
    (this.moon.material as THREE.MeshBasicMaterial).opacity = clamp((-elev + 0.04) / 0.18, 0, 1) * 0.95;
    this.moon.visible = elev < 0.04 && !this.cine;   // …and no moon rising mid-cutaway either

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
