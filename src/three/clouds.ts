import * as THREE from 'three';
import { mulberry32 } from '../world/style';

// Cloud shadows: one tileable noise texture drifting over the town, multiplied into the
// DIRECT light term of every lit surface (the ground and the whole decor mesh). Ambient
// is untouched, so it reads as clouds crossing the sun, not the world dimming. Cheapest
// "the world is alive" effect there is, and it runs on every tier — one texture fetch.

const CLOUD_TEX_SIZE = 256;
let _tex: THREE.CanvasTexture | null = null;

// 4-octave value noise, wrapped so it tiles
function cloudTex(): THREE.CanvasTexture {
  if (_tex) return _tex;
  const s = CLOUD_TEX_SIZE;
  const rng = mulberry32(4242);
  const grids: Float32Array[] = [];
  // fewer, coarser cells per tile: with the tile at ~2000 px these give cloud shapes of
  // 10–80 m, which is what a cumulus shadow looks like from a chase camera
  const octs = [3, 6, 12, 24];
  for (const n of octs) {
    const g = new Float32Array(n * n);
    for (let i = 0; i < n * n; i++) g[i] = rng();
    grids.push(g);
  }
  const smooth = (t: number) => t * t * (3 - 2 * t);
  const sample = (g: Float32Array, n: number, u: number, v: number) => {
    const x = u * n, y = v * n;
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = smooth(x - x0), fy = smooth(y - y0);
    const at = (i: number, j: number) => g[((j + n) % n) * n + ((i + n) % n)];
    return (at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx) * (1 - fy)
         + (at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx) * fy;
  };
  // summed octaves cluster around the middle; stretch to the full range so the
  // shader's threshold carves distinct cloud shapes instead of a uniform haze
  const vals = new Float32Array(s * s);
  let lo = 1, hi = 0;
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const u = x / s, v = y / s;
      let val = 0, amp = 1, tot = 0;
      for (let o = 0; o < octs.length; o++) {
        val += sample(grids[o], octs[o], u, v) * amp;
        tot += amp;
        amp *= 0.5;
      }
      val /= tot;
      vals[y * s + x] = val;
      if (val < lo) lo = val;
      if (val > hi) hi = val;
    }
  }
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const g2 = c.getContext('2d')!;
  const img = g2.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const b = Math.round(((vals[i] - lo) / (hi - lo || 1)) * 255);
    img.data[i * 4] = b; img.data[i * 4 + 1] = b; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  g2.putImageData(img, 0, 0);
  _tex = new THREE.CanvasTexture(c);
  _tex.wrapS = _tex.wrapT = THREE.RepeatWrapping;
  _tex.colorSpace = THREE.NoColorSpace;
  return _tex;
}

// shared across every patched material, so one update a frame moves every cloud
export const CLOUD = {
  uCloudMap: { value: null as THREE.Texture | null },
  uCloudOff: { value: new THREE.Vector2(0, 0) },
  uCloudScale: { value: 1 / 2000 },   // one tile = 250 m
  uCloudAmt: { value: 0 }
};

// wind from the south-west, a slow drift in world px/s (8 px = 1 m)
const WIND = new THREE.Vector2(7.5, -5.0);

/** call once a frame: `night` and `wet` from the sky state */
export function updateClouds(dt: number, night: number, wet: number, strength: number) {
  if (!CLOUD.uCloudMap.value) CLOUD.uCloudMap.value = cloudTex();
  CLOUD.uCloudOff.value.addScaledVector(WIND, dt);
  // no cloud shadows at night (there is no sun to cross) or under a snowing overcast
  CLOUD.uCloudAmt.value = strength * (1 - night) * (1 - wet);
}

/** onBeforeCompile hook for any MeshLambert/Standard material that should take cloud shadow */
export function cloudInject(shader: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }) {
  shader.uniforms.uCloudMap = CLOUD.uCloudMap;
  shader.uniforms.uCloudOff = CLOUD.uCloudOff;
  shader.uniforms.uCloudScale = CLOUD.uCloudScale;
  shader.uniforms.uCloudAmt = CLOUD.uCloudAmt;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vCloudW;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvCloudW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>
uniform sampler2D uCloudMap;
uniform vec2 uCloudOff;
uniform float uCloudScale;
uniform float uCloudAmt;
varying vec3 vCloudW;`)
    .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
{
  float cl = texture2D(uCloudMap, (vCloudW.xz + uCloudOff) * uCloudScale).r;
  float shade = 1.0 - uCloudAmt * smoothstep(0.52, 0.80, cl);   // ~35% cover, soft edges
  reflectedLight.directDiffuse *= shade;
  reflectedLight.directSpecular *= shade;
}`);
}
