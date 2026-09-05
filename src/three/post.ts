import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { SEASON } from '../world/style';

// Desktop post stack. Phones never construct this (see gfx.ts): every pass here is a
// full-screen cost that a 2× DPR phone cannot afford, and the game must read the same
// without it — the passes add depth and glow, they never carry information.
//
//   render  → HDR scene (half-float, 4× MSAA so we lose nothing to the composer)
//   GTAO    → screen-space ambient occlusion: corners, under eaves, between cars
//   bloom   → lamps, lit windows and sun glints on the water bleed a little
//   grade   → a per-season lift/gain/saturation and a soft vignette
//   output  → tone mapping + sRGB (the renderer's own settings, applied here instead)

const GRADE: Record<string, { gain: [number, number, number]; sat: number }> = {
  spring: { gain: [1.00, 1.02, 0.98], sat: 1.05 },
  summer: { gain: [1.03, 1.00, 0.95], sat: 1.08 },
  fall:   { gain: [1.05, 0.98, 0.90], sat: 1.10 },
  winter: { gain: [0.97, 1.00, 1.05], sat: 0.94 }
};

const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uSat: { value: 1 },
    uVignette: { value: 0.22 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec3 uGain;
    uniform float uSat;
    uniform float uVignette;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 rgb = c.rgb * uGain;
      float l = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
      rgb = mix(vec3(l), rgb, uSat);
      vec2 d = (vUv - 0.5) * vec2(1.0, 0.85);
      rgb *= 1.0 - uVignette * smoothstep(0.35, 0.95, length(d));
      gl_FragColor = vec4(rgb, c.a);
    }`
};

export class Post {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private gtao: GTAOPass;
  private bloom: UnrealBloomPass;
  private grade: ShaderPass;

  constructor(private renderer: THREE.WebGLRenderer, scene: THREE.Scene, private camera: THREE.PerspectiveCamera,
              w: number, h: number, ratio: number, opts: { ao: boolean; bloom: boolean }) {
    const target = new THREE.WebGLRenderTarget(w * ratio, h * ratio, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, target);
    this.composer.setPixelRatio(ratio);
    this.composer.setSize(w, h);

    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    // world units are px at 8 px/m: a 1.6 m radius, 0.75 m thickness
    this.gtao = new GTAOPass(scene, camera, w * ratio, h * ratio);
    this.gtao.output = GTAOPass.OUTPUT.Default;
    this.gtao.blendIntensity = 0.85;
    this.gtao.updateGtaoMaterial({ radius: 13, distanceExponent: 1, thickness: 6, scale: 1, samples: 12, distanceFallOff: 1, screenSpaceRadius: false });
    this.gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 4, radiusExponent: 1, rings: 2, samples: 16 });
    this.gtao.enabled = opts.ao;
    this.composer.addPass(this.gtao);

    // threshold above 1.0: only what is genuinely over-bright blooms (lit windows, sun
    // glints, the sun disc), never a lamp pool or a white wall in full sun
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w * ratio, h * ratio), 0.22, 0.3, 1.02);
    this.bloom.enabled = opts.bloom;
    this.composer.addPass(this.bloom);

    this.grade = new ShaderPass(GradeShader);
    const gr = GRADE[SEASON] ?? GRADE.summer;
    (this.grade.uniforms.uGain.value as THREE.Vector3).set(gr.gain[0], gr.gain[1], gr.gain[2]);
    this.grade.uniforms.uSat.value = gr.sat;
    this.composer.addPass(this.grade);

    this.composer.addPass(new OutputPass());
  }

  /** the tunnel and interiors render their own scene through the same stack */
  setScene(scene: THREE.Scene) {
    if (this.renderPass.scene !== scene) { this.renderPass.scene = scene; this.gtao.scene = scene; }
  }

  setSize(w: number, h: number) { this.composer.setSize(w, h); }
  setPixelRatio(r: number) { this.composer.setPixelRatio(r); }

  render() { this.composer.render(); }

  dispose() { this.composer.dispose(); this.gtao.dispose(); this.bloom.dispose(); }
}
