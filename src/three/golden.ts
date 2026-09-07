import * as THREE from 'three';

// Golden hour on every lit surface: a warm rim where a face turns away from the eye,
// and a warm wash where it faces the low sun. Fragment-side, injected into any Lambert
// or Standard material (the decor buckets, the kit's atlas and paint, the ground stays
// out). uGolden 0..1 is the sky's low-sun band; the direction is the sun's, world space.
const goldenUniforms = { uGolden: { value: 0 }, uGoldenDir: { value: new THREE.Vector3(0, 1, 0) } };
export function setDecorGolden(k: number, dir: THREE.Vector3) { goldenUniforms.uGolden.value = k; goldenUniforms.uGoldenDir.value.copy(dir); }
export function goldenInject(shader: { uniforms: Record<string, unknown>; fragmentShader: string }) {
  shader.uniforms.uGolden = goldenUniforms.uGolden;
  shader.uniforms.uGoldenDir = goldenUniforms.uGoldenDir;
  shader.fragmentShader = shader.fragmentShader
    .replace('#include <common>', '#include <common>\nuniform float uGolden;\nuniform vec3 uGoldenDir;')
    .replace('#include <opaque_fragment>', `
if (uGolden > 0.001) {
  vec3 sd = normalize((viewMatrix * vec4(uGoldenDir, 0.0)).xyz);
  float rimF = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
  float sunF = clamp(dot(normal, sd), 0.0, 1.0);
  outgoingLight += vec3(1.0, 0.62, 0.32) * uGolden * (rimF * 0.5 + sunF * sunF * 0.45) * (0.4 + diffuseColor.rgb);
}
#include <opaque_fragment>`);
}
