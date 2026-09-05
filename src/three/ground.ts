import { cloudTex } from './clouds';

// Ground surfaces beyond the painted map. The chunk canvas is one flat tone per lawn,
// and from the chase camera a whole neighbourhood reads as a single green. Real turf
// varies at the scale of a yard: a dry patch here, a lush one there, a worn tread near
// the road. This hook adds that variation in the shader from the same tileable noise
// the cloud shadows use, keyed on hue so only grass takes it. Sand and asphalt get
// their own touches: a long-wave ripple in the sand, and a fine tar sheen darkening on
// the roads. One extra texture fetch; runs on every tier.

const GROUND_UNIFORMS = { uLawnMap: { value: null as ReturnType<typeof cloudTex> | null } };

export function groundInject(shader: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }) {
  if (!GROUND_UNIFORMS.uLawnMap.value) GROUND_UNIFORMS.uLawnMap.value = cloudTex();
  shader.uniforms.uLawnMap = GROUND_UNIFORMS.uLawnMap;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vGroundW;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvGroundW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform sampler2D uLawnMap;\nvarying vec3 vGroundW;')
    .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 c = diffuseColor.rgb;
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  // grass: green leads; sand: warm, bright, low saturation; asphalt: dark and grey
  float grass = smoothstep(0.02, 0.07, c.g - max(c.r, c.b));
  float sand = smoothstep(0.55, 0.75, mx) * smoothstep(0.08, 0.20, c.r - c.b) * (1.0 - grass);
  float tar = (1.0 - smoothstep(0.30, 0.45, mx)) * (1.0 - smoothstep(0.03, 0.08, mx - mn));
  // yard-scale patchiness (~40–120 m) plus a finer mottle (~8 m), both from the cloud fbm
  float big = texture2D(uLawnMap, vGroundW.xz * (1.0 / 900.0)).r;
  float fine = texture2D(uLawnMap, vGroundW.xz * (1.0 / 140.0) + 0.37).r;
  float v = big * 0.65 + fine * 0.35;
  // dry straw at one end, lush and a touch darker at the other
  vec3 dry = c * vec3(1.14, 1.04, 0.66), lush = c * vec3(0.82, 0.95, 0.78);
  vec3 lawn = mix(dry, lush, smoothstep(0.30, 0.72, v));
  c = mix(c, lawn, grass * 0.7);
  // sand: damp hollows and dry crests at dune scale, so the beach is not one flat cream
  c = mix(c, c * (0.90 + 0.16 * v), sand * 0.8);
  // asphalt: patchy tar tone, the older lifts a shade lighter
  c = mix(c, c * (0.92 + 0.16 * big), tar * 0.7);
  diffuseColor.rgb = c;
}`);
}
