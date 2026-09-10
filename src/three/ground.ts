import { cloudTex } from './clouds';

// Ground surfaces beyond the painted map. The chunk canvas is one flat tone per lawn,
// and from the chase camera a whole neighbourhood reads as a single green. Real turf
// varies at the scale of a yard: a dry patch here, a lush one there, a worn tread near
// the road. This hook adds that variation in the shader from the same tileable noise
// the cloud shadows use, keyed on hue so only grass takes it. Sand and asphalt get
// their own touches: a long-wave ripple in the sand, and a fine tar sheen darkening on
// the roads. One extra texture fetch; runs on every tier.

const GROUND_UNIFORMS = {
  uLawnMap: { value: null as ReturnType<typeof cloudTex> | null },
  uWet: { value: 0 },                                    // rain, 0..1, from the sky
  uGTime: { value: 0 },                                  // seconds, for the painted ponds
  uSkyCol: { value: [0.6, 0.66, 0.74] as number[] }      // what a puddle reflects
};
/** rain 0..1, the sky colour the puddles hold, and the clock; called once a frame by Game */
export function setGroundWet(wet: number, r: number, g: number, b: number, t = 0) {
  GROUND_UNIFORMS.uWet.value = wet;
  GROUND_UNIFORMS.uGTime.value = t;
  const c = GROUND_UNIFORMS.uSkyCol.value; c[0] = r; c[1] = g; c[2] = b;
}

export function groundInject(shader: { uniforms: Record<string, unknown>; vertexShader: string; fragmentShader: string }) {
  if (!GROUND_UNIFORMS.uLawnMap.value) GROUND_UNIFORMS.uLawnMap.value = cloudTex();
  shader.uniforms.uLawnMap = GROUND_UNIFORMS.uLawnMap;
  shader.uniforms.uWet = GROUND_UNIFORMS.uWet;
  shader.uniforms.uGTime = GROUND_UNIFORMS.uGTime;
  shader.uniforms.uSkyCol = GROUND_UNIFORMS.uSkyCol;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\nvarying vec3 vGroundW;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvGroundW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform sampler2D uLawnMap;\nuniform float uWet;\nuniform float uGTime;\nuniform vec3 uSkyCol;\nvarying vec3 vGroundW;\nfloat pondWet(vec3 s) { return smoothstep(0.03, 0.10, s.b - max(s.r, s.g)); }')
    .replace('#include <map_fragment>', `#include <map_fragment>
{
  vec3 c = diffuseColor.rgb;
  float mx = max(c.r, max(c.g, c.b)), mn = min(c.r, min(c.g, c.b));
  // grass: green leads; sand: warm, bright, low saturation; asphalt: dark and grey
  float grass = smoothstep(0.02, 0.07, c.g - max(c.r, c.b));
  float sand = smoothstep(0.55, 0.75, mx) * smoothstep(0.08, 0.20, c.r - c.b) * (1.0 - grass);
  float tar = (1.0 - smoothstep(0.30, 0.45, mx)) * (1.0 - smoothstep(0.03, 0.08, mx - mn));
  // yard-scale patchiness (~112 m) plus a finer mottle (~17 m), both from the cloud fbm
  float big = texture2D(uLawnMap, vGroundW.xz * (1.0 / 900.0)).r;
  float fine = texture2D(uLawnMap, vGroundW.xz * (1.0 / 140.0) + 0.37).r;
  float v = big * 0.62 + fine * 0.38;
  // dry straw at one end, lush and a touch darker at the other. Measured across a
  // whole frame the old swing moved green by 4% p5->p95 — under what the eye reads
  // as texture at all, so a park was one flat fill with tree shadows on it.
  vec3 dry = c * vec3(1.22, 1.08, 0.56), lush = c * vec3(0.72, 0.90, 0.72);
  vec3 lawn = mix(dry, lush, smoothstep(0.26, 0.76, v));
  // near-field only: the blade-scale fleck and the mower bands alias into a shimmer
  // once a lawn is small on screen, so both fade out with distance
  float dCam = distance(cameraPosition, vGroundW);
  float nearK = 1.0 - smoothstep(500.0, 1900.0, dCam);
  if (nearK > 0.002) {
    // mowing bands: a cut lawn is the first thing the eye reads as grass. The
    // direction turns slowly across town so no two blocks are mown the same way.
    // quantised so bands stay STRAIGHT within a lawn and change direction at the
    // property line, the way neighbours mow — a continuous angle drew crop circles
    float ang = floor(big * 6.0) * (3.1416 / 6.0);
    float band = sin((vGroundW.x * cos(ang) + vGroundW.z * sin(ang)) * (6.2832 / 46.0));
    // clump scale (~3.5 m): clover, wear, and where the mower missed
    float micro = texture2D(uLawnMap, vGroundW.xz * (1.0 / 28.0) + 0.77).r;
    lawn *= 1.0 + nearK * (band * 0.055 + (micro - 0.5) * 0.20);
  }
  c = mix(c, lawn, grass * 0.9);
  // sand: damp hollows and dry crests at dune scale, so the beach is not one flat cream
  c = mix(c, c * (0.90 + 0.16 * v), sand * 0.8);
  // asphalt: patchy tar tone, the older lifts a shade lighter
  c = mix(c, c * (0.92 + 0.16 * big), tar * 0.7);
  // Painted water. An inland pond sits ABOVE sea level, so the water mesh (which is
  // one plane at WATER_Y) never reaches it — the Frog Pond and every pool in town are
  // the map canvas, and measured out at a 2.8% brightness spread: a flat blue fill.
  // Give them the ripple the mesh water has, keyed on hue so only water takes it.
  float pond = smoothstep(0.06, 0.13, c.b - max(c.r, c.g));
  if (pond > 0.002) {
    // cat's paws: the wind crosses a pond in patches, so the ripple is not everywhere.
    // Scales are deliberately coarse (~30 m and ~9 m): finer than that and the mip
    // chain averages the ripple straight back to a flat fill at any real distance.
    float gust = texture2D(uLawnMap, vGroundW.xz * (1.0 / 900.0) + uGTime * 0.0014).r;
    float rip = 0.35 + 1.3 * smoothstep(0.34, 0.76, gust);
    float w1 = texture2D(uLawnMap, vGroundW.xz * (1.0 / 240.0) + vec2(uGTime * 0.0035, uGTime * 0.0025)).r;
    float w2 = texture2D(uLawnMap, vGroundW.xz * (1.0 / 70.0) + vec2(-uGTime * 0.007, uGTime * 0.005)).r;
    float wv = w1 * 0.60 + w2 * 0.40;
    vec3 pc = c * (0.88 + 0.40 * rip * (wv - 0.5) + 0.06 * rip);
    // and the crests catching the sky, sparse and only where the gust is
    pc += smoothstep(0.62, 0.88, wv) * rip * uSkyCol * 0.22;
    #ifdef USE_MAP
    // The bank, reflected. Four samples of the map a few metres out: where a neighbour
    // is not water we are near the shore, and a pond carries a dark band of whatever
    // stands on it — the single strongest cue that a blue fill is water and not paint.
    const float BR = 20.0 / 768.0;
    float nb = min(min(pondWet(texture2D(map, vMapUv + vec2(BR, 0.0)).rgb),
                       pondWet(texture2D(map, vMapUv - vec2(BR, 0.0)).rgb)),
                   min(pondWet(texture2D(map, vMapUv + vec2(0.0, BR)).rgb),
                       pondWet(texture2D(map, vMapUv - vec2(0.0, BR)).rgb)));
    pc = mix(pc, pc * vec3(0.52, 0.66, 0.58), (1.0 - nb) * 0.55);
    #endif
    c = mix(c, pc, pond);
  }
  // rain: the tar darkens as it wets, and the hollows fill — puddles holding the sky,
  // where the same noise at street scale dips lowest
  if (uWet > 0.001) {
    float hollow = texture2D(uLawnMap, vGroundW.xz * (1.0 / 260.0) + 0.61).r;
    float puddle = smoothstep(0.66, 0.74, hollow + 0.10 * uWet) * tar;
    c *= 1.0 - 0.28 * uWet * tar;
    c = mix(c, uSkyCol * 0.92, puddle * uWet * 0.8);
  }
  diffuseColor.rgb = c;
}`);
}
