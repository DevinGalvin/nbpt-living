import * as THREE from 'three';
import type { Terrain } from '../world/terrain';
import type { WorldData } from '../world/types';

// The shoreline, from the heightfield. The terrain grid is uploaded once as a float
// texture, so any shader can ask "how deep is the water here" or "how far above the
// waterline is this sand". The water shader turns that into shallows and a foam line;
// the ground shader into a wet band along every shore. Both cost one texture fetch.

export const SHORE = {
  // R: ground height (world px, negative on the synthetic shelf); G: 1 where the sea is
  uHeights: { value: null as THREE.DataTexture | null },
  // x0, y0, 1/spacing, and the px-per-metre scale of the stored values
  uHeightMeta: { value: new THREE.Vector4(0, 0, 0, 0) },
  uHeightSize: { value: new THREE.Vector2(1, 1) },
  uWaterY: { value: 0 }   // set by buildWater (water.ts owns WATER_Y; importing it here would be circular)
};

/**
 * Which grid nodes lie under mapped water: bit 1 = any water, bit 2 = the sea. The
 * polygons are rasterised once onto a canvas the size of the height grid.
 */
export function waterMask(world: WorldData, terrain: Terrain): Uint8Array | null {
  const g = terrain.grid();
  if (!g) return null;
  const c = document.createElement('canvas');
  c.width = g.w; c.height = g.h;
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  // pixel (i, j) must sample the polygon AT node (i, j): its centre is half a pixel in
  ctx.translate(0.5, 0.5);
  ctx.scale(1 / g.spacing, 1 / g.spacing);
  ctx.translate(-g.x0, -g.y0);
  const trace = (ring: number[]) => { ctx.moveTo(ring[0], ring[1]); for (let i = 2; i < ring.length; i += 2) ctx.lineTo(ring[i], ring[i + 1]); ctx.closePath(); };
  for (const pass of ['water', 'ocean'] as const) {
    ctx.fillStyle = pass === 'ocean' ? '#ff0000' : '#00ff00';
    ctx.beginPath();
    for (const poly of world.polys) {
      if (poly.k !== pass) continue;
      trace(poly.p);
      for (const h of poly.h ?? []) trace(h);
    }
    ctx.fill('evenodd');
  }
  const px = ctx.getImageData(0, 0, g.w, g.h).data;
  const mask = new Uint8Array(g.w * g.h);
  for (let i = 0; i < mask.length; i++) {
    const r = px[i * 4], gg = px[i * 4 + 1];
    mask[i] = (r > 127 || gg > 127 ? 1 : 0) | (r > 127 ? 2 : 0);
  }
  return mask;
}

/**
 * Pin the waterline to the map. The DEM is an 8 m grid, so even a smooth interpolant
 * draws a diagonal coast as scallops. The mapped water polygon knows where the
 * shore really is, so every node within a cell and a half of a sea-level water edge
 * takes its height from its signed distance to that edge: a beach ramp, 2 dm at the
 * line, rising inland and falling under the water. Higher ground within that band
 * keeps up to 0.6 m of its own relief; ponds above sea level are left alone.
 */
export function fitShoreline(world: WorldData, terrain: Terrain, mask: Uint8Array) {
  const g = terrain.grid();
  if (!g) return;
  const { w, h, data, spacing } = g;
  const CELL = 512;
  // every edge of every water ring, bucketed by 512 px cell (with a one-cell margin)
  const edges = new Map<string, number[]>();
  const addRing = (r: number[]) => {
    const n = r.length / 2;
    for (let i = 0; i < n; i++) {
      const ax = r[i * 2], ay = r[i * 2 + 1], bx = r[((i + 1) % n) * 2], by = r[((i + 1) % n) * 2 + 1];
      const cx0 = Math.floor(Math.min(ax, bx) / CELL) - 1, cx1 = Math.floor(Math.max(ax, bx) / CELL) + 1;
      const cy0 = Math.floor(Math.min(ay, by) / CELL) - 1, cy1 = Math.floor(Math.max(ay, by) / CELL) + 1;
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const k = cx + ',' + cy;
        let l = edges.get(k);
        if (!l) { l = []; edges.set(k, l); }
        l.push(ax, ay, bx, by);
      }
    }
  };
  for (const poly of world.polys) {
    if (poly.k !== 'water' && poly.k !== 'ocean') continue;
    addRing(poly.p);
    for (const hole of poly.h ?? []) addRing(hole);
  }
  const distSq = (x: number, y: number) => {
    const l = edges.get(Math.floor(x / CELL) + ',' + Math.floor(y / CELL));
    if (!l) return Infinity;
    let best = Infinity;
    for (let i = 0; i < l.length; i += 4) {
      const ax = l[i], ay = l[i + 1], bx = l[i + 2], by = l[i + 3];
      const dx = bx - ax, dy = by - ay;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
      const ex = ax + dx * t - x, ey = ay + dy * t - y;
      const d = ex * ex + ey * ey;
      if (d < best) best = d;
    }
    return best;
  };
  // A water node is at sea level if it, or any water node within three of it, sits at
  // or under the waterline in the DEM. The DEM and the map disagree by a cell along a
  // dune line (the survey says 4 m where the coastline says sea), and those are exactly
  // the nodes that need pinning; a pond on a hill has no low node anywhere near it.
  const seaLevel = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) if ((mask[i] & 1) && data[i] <= 5) seaLevel[i] = 1;
  const grown = new Uint8Array(seaLevel);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (!(mask[i] & 1) || seaLevel[i]) continue;
    for (let dy = -3; dy <= 3 && !grown[i]; dy++) for (let dx = -3; dx <= 3; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      if (seaLevel[yy * w + xx]) { grown[i] = 1; break; }
    }
  }
  const seaLevelWater = (i: number) => grown[i] === 1;
  const REACH = spacing * 1.5, SLOPE = 0.12;   // dm per px: a 1.2 m rise across a cell — a beach
  const out = new Int16Array(data);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      // only nodes that have sea-level water within two nodes are near a real shore
      let near = false;
      for (let dy = -2; dy <= 2 && !near; dy++) for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        if (seaLevelWater(yy * w + xx)) { near = true; break; }
      }
      if (!near) continue;
      const inWater = (mask[i] & 1) !== 0;
      if (inWater && !seaLevelWater(i)) continue;
      const px = g.x0 + x * spacing, py = g.y0 + y * spacing;
      const d = Math.sqrt(distSq(px, py));
      if (d > REACH) continue;
      const ramp = 2 + (inWater ? -d : d) * SLOPE;
      out[i] = inWater ? Math.max(-80, Math.round(ramp)) : Math.round(ramp + Math.max(0, Math.min(6, data[i] - ramp)));
    }
  }
  data.set(out);
}

let uploaded = false;
export function uploadShoreHeights(terrain: Terrain, mask: Uint8Array | null) {
  if (uploaded) return;
  const g = terrain.grid();
  if (!g) return;
  // stored as decimetres; convert to world px (8 px per metre) so shaders compare to WATER_Y.
  // Half float: filterable everywhere WebGL2 runs, and 0.5 px steps only above 100 m.
  const f = new Uint16Array(g.w * g.h * 2);
  const half = THREE.DataUtils.toHalfFloat;
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const i = y * g.w + x;
      f[i * 2] = half((g.data[i] / 10) * 8);
      // the sea flag, grown by one node so the water right at the beach still reads as sea
      let sea = 0;
      if (mask) {
        for (let dy = -1; dy <= 1 && !sea; dy++) for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= g.w || yy >= g.h) continue;
          if (mask[yy * g.w + xx] & 2) { sea = 1; break; }
        }
      }
      f[i * 2 + 1] = half(sea);
    }
  }
  const tex = new THREE.DataTexture(f, g.w, g.h, THREE.RGFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  SHORE.uHeights.value = tex;
  SHORE.uHeightMeta.value.set(g.x0, g.y0, 1 / g.spacing, 0);
  SHORE.uHeightSize.value.set(g.w, g.h);
  uploaded = true;
}

export const shoreParsGlsl = `
uniform sampler2D uHeights;
uniform vec4 uHeightMeta;
uniform vec2 uHeightSize;
uniform float uWaterY;
// ground height (world px) at a world xz, bilinear over the grid like Terrain.heightAt
float shoreGround(vec2 xz) {
  vec2 g = (xz - uHeightMeta.xy) * uHeightMeta.z;
  vec2 uv = (g + 0.5) / uHeightSize;
  return texture2D(uHeights, uv).r;
}
// 1 where the water is the sea (breakers), 0 on rivers and ponds
float shoreSea(vec2 xz) {
  vec2 g = (xz - uHeightMeta.xy) * uHeightMeta.z;
  vec2 uv = (g + 0.5) / uHeightSize;
  return texture2D(uHeights, uv).g;
}`;

/** onBeforeCompile hook for the ground: a darker, wet band just above the waterline */
export function shoreInjectGround(shader: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }) {
  shader.uniforms.uHeights = SHORE.uHeights;
  shader.uniforms.uHeightMeta = SHORE.uHeightMeta;
  shader.uniforms.uHeightSize = SHORE.uHeightSize;
  shader.uniforms.uWaterY = SHORE.uWaterY;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vShoreW;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvShoreW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', `#include <common>\nvarying vec3 vShoreW;\n${shoreParsGlsl}`)
    .replace('#include <map_fragment>', `#include <map_fragment>
{
  // wet sand and mud: darker from the waterline up to ~0.6 m above it, fading out
  float above = vShoreW.y - uWaterY;
  float wet = 1.0 - smoothstep(0.0, 5.0, above);
  diffuseColor.rgb *= 1.0 - 0.28 * wet;
  // the wrack line: a broken strip of weed and shell where the last high tide stopped
  float band = smoothstep(3.6, 4.8, above) * (1.0 - smoothstep(5.6, 7.2, above));
  vec2 cell = floor(vShoreW.xz * 0.45);
  float n = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
  float wrack = band * step(0.62, n);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.42, 0.40, 0.34), wrack);
}`);
}
