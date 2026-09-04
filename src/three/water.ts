import * as THREE from 'three';
import type { WorldData } from '../world/types';
import { SEASON } from '../world/style';

// One animated water surface for the whole map: triangulated real water polygons
// (with island holes) floating just above the painted ground, with a rippling
// noise shader, moving glints, and shallow transparent edges.

const WATER_Y = 1.6;

// Ponds, reservoirs, pools and small unnamed bodies freeze solid in winter — you
// can walk across them. Rivers, the Merrimack, tidal channels and the ocean stay
// open water.
export function isFreezableWater(poly: { k?: string; n?: string; p: number[] }): boolean {
  if (poly.k === 'ocean' || poly.k === 'fountain') return false;
  const n = poly.n || '';
  if (/\b(reservoir|pond|pool|lake)\b/i.test(n)) return true;
  if (/\b(river|creek|brook|gut|ocean|harbor|merrimack|channel|sound|bay|cove)\b/i.test(n)) return false;
  let xn = 1e9, xx = -1e9, yn = 1e9, yx = -1e9;
  for (let i = 0; i < poly.p.length; i += 2) {
    const x = poly.p[i], y = poly.p[i + 1];
    if (x < xn) xn = x; if (x > xx) xx = x; if (y < yn) yn = y; if (y > yx) yx = y;
  }
  return Math.max(xx - xn, yx - yn) < 22000;   // small body = pond; huge = the bay/river
}

function ringToVec2(ring: number[]): THREE.Vector2[] {
  const v: THREE.Vector2[] = [];
  for (let i = 0; i < ring.length; i += 2) v.push(new THREE.Vector2(ring[i], -ring[i + 1]));
  let area = 0;
  for (let i = 0; i < v.length; i++) {
    const j = (i + 1) % v.length;
    area += v[i].x * v[j].y - v[j].x * v[i].y;
  }
  if (area < 0) v.reverse();
  return v;
}

export function buildWater(world: WorldData): { mesh: THREE.Mesh; ice: THREE.Mesh | null; update: (t: number) => void } {
  const pos: number[] = [];
  const col: number[] = [];
  const river = new THREE.Color('#3a8ecb');
  const ocean = new THREE.Color('#2c7cb5');

  const icePos: number[] = [];
  const frozen = SEASON === 'winter';
  for (const poly of world.polys) {
    if (poly.k !== 'water' && poly.k !== 'ocean' && poly.k !== 'fountain') continue;
    const ice = frozen && isFreezableWater(poly);
    const c = poly.k === 'ocean' ? ocean : river;
    try {
      const contour = ringToVec2(poly.p);
      if (contour.length < 3) continue;
      const holes = (poly.h || []).map((h) => {
        const hv = ringToVec2(h);
        hv.reverse(); // holes wind opposite the contour
        return hv;
      }).filter((h) => h.length >= 3);
      const tris = THREE.ShapeUtils.triangulateShape(contour, holes);
      const all = contour.concat(...holes);
      for (const [a, b, cc] of tris) {
        for (const idx of [a, cc, b]) {
          if (ice) {
            icePos.push(all[idx].x, WATER_Y + 0.06, -all[idx].y);
          } else {
            pos.push(all[idx].x, WATER_Y, -all[idx].y);
            col.push(c.r, c.g, c.b);
          }
        }
      }
    } catch {
      // skip degenerate polygons
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    { uTime: { value: 0 } }
  ]);

  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    fog: true,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec3 vWorld;
      varying vec3 vColor;
      #include <fog_pars_vertex>
      void main() {
        vColor = color;
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vWorld;
      varying vec3 vColor;
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec2 p = vWorld.xz * 0.008;
        float n = noise(p + vec2(uTime * 0.045, uTime * 0.034));
        n += 0.5 * noise(p * 2.2 - vec2(uTime * 0.04, uTime * 0.055));
        n /= 1.5;
        vec3 base = vColor * (0.88 + 0.2 * n);
        // soft wave crests
        float crest = smoothstep(0.72, 0.88, n);
        base += crest * vec3(0.05, 0.07, 0.08);
        // fine drifting sun glints
        float g = noise(p * 11.0 + vec2(uTime * 0.14, -uTime * 0.1));
        float glint = smoothstep(0.91, 0.985, g);
        base += glint * vec3(0.38, 0.38, 0.34);
        gl_FragColor = vec4(base, 0.9);
        // same output chain as the built-in materials, so the water grades with the town
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `
  });
  // vertexColors needs the color attribute declared
  mat.vertexColors = true;

  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;

  // frozen ponds: a flat, matte pale-ice sheet sitting just over the water
  let ice: THREE.Mesh | null = null;
  if (icePos.length) {
    const ig = new THREE.BufferGeometry();
    ig.setAttribute('position', new THREE.Float32BufferAttribute(icePos, 3));
    ig.computeVertexNormals();
    ice = new THREE.Mesh(ig, new THREE.MeshBasicMaterial({ color: '#c4dae6', fog: true }));
    ice.frustumCulled = false;
    ice.renderOrder = 3;
  }

  return {
    mesh,
    ice,
    update: (t: number) => { (mat.uniforms.uTime as { value: number }).value = t / 1000; }
  };
}

export { WATER_Y };
