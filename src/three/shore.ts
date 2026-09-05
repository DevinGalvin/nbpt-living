import * as THREE from 'three';
import type { Terrain } from '../world/terrain';

// The shoreline, from the heightfield. The terrain grid is uploaded once as a float
// texture, so any shader can ask "how deep is the water here" or "how far above the
// waterline is this sand". The water shader turns that into shallows and a foam line;
// the ground shader into a wet band along every shore. Both cost one texture fetch.

export const SHORE = {
  uHeights: { value: null as THREE.DataTexture | null },
  // x0, y0, 1/spacing, and the px-per-metre scale of the stored values
  uHeightMeta: { value: new THREE.Vector4(0, 0, 0, 0) },
  uHeightSize: { value: new THREE.Vector2(1, 1) },
  uWaterY: { value: 0 }   // set by buildWater (water.ts owns WATER_Y; importing it here would be circular)
};

let uploaded = false;
export function uploadShoreHeights(terrain: Terrain) {
  if (uploaded) return;
  const g = terrain.grid();
  if (!g) return;
  // stored as decimetres; convert to world px (8 px per metre) so shaders compare to WATER_Y
  const f = new Float32Array(g.w * g.h);
  for (let i = 0; i < f.length; i++) f[i] = Math.max(0, g.data[i] / 10) * 8;
  const tex = new THREE.DataTexture(f, g.w, g.h, THREE.RedFormat, THREE.FloatType);
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
}`);
}
