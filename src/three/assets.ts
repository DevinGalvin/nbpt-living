import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Real 3D props — cars, street furniture — from CC0 packs (Kenney, KayKit; see
// public/models/CREDITS.md), packed at build time into one meshopt-compressed GLB
// (public/models/props.glb, ~480 KB, shared by every town and cached by the service
// worker). Each model is baked here into ONE BufferGeometry in world units (8 px = 1 m,
// base at y = 0, centred on xz, nose along +Z) so a chunk can draw hundreds of them as
// a single InstancedMesh (see props.ts). Untextured materials are baked into vertex
// colour, so the whole kit needs two materials: one vertex-coloured, one atlas-textured.

export interface PropModel {
  name: string;
  geo: THREE.BufferGeometry;      // baked, merged, world units
  /** the body panels, baked white, so each instance can take its own paint colour */
  geoPaint?: THREE.BufferGeometry;
  material: THREE.Material;
  size: THREE.Vector3;            // world px after scaling
  axis: 'x' | 'z';                // which local axis the model's length runs along
  /** original node tree, scaled the same way — for the few props that need moving parts */
  root: THREE.Group;
}

// real-world sizes, world px (8 px = 1 m); `by` picks which extent the target applies to
const TARGET: Record<string, { size: number; by: 'length' | 'height'; axis?: 'x' | 'z' }> = {
  sedan: { size: 36, by: 'length' }, hatchback: { size: 33, by: 'length' }, 'sports-sedan': { size: 36, by: 'length' },
  suv: { size: 38, by: 'length' }, 'suv-luxury': { size: 40, by: 'length' }, van: { size: 42, by: 'length' },
  truck: { size: 44, by: 'length' }, 'delivery-truck': { size: 48, by: 'length' }, 'police-car': { size: 38, by: 'length' },
  taxi: { size: 38, by: 'length' },
  'tree-big': { size: 88, by: 'height' }, 'tree-small': { size: 56, by: 'height' },
  'boat-small': { size: 40, by: 'length' }, 'boat-large': { size: 64, by: 'length' },
  streetlight: { size: 40, by: 'height' }, firehydrant: { size: 7, by: 'height' }, bench: { size: 14, by: 'length', axis: 'x' },
  trash_A: { size: 8, by: 'height' }, trash_B: { size: 8, by: 'height' }, dumpster: { size: 12, by: 'height', axis: 'x' },
  trafficlight_A: { size: 36, by: 'height' }, bush: { size: 10, by: 'height' }
};
export const CAR_NAMES = ['sedan', 'hatchback', 'sports-sedan', 'suv', 'suv-luxury', 'van', 'truck', 'delivery-truck', 'police-car', 'taxi'];
// weighted so a street is mostly sedans and SUVs, with the odd van, pickup and taxi
const CAR_WEIGHTS = [26, 16, 8, 18, 8, 7, 9, 3, 2, 3];

export class PropLib {
  readonly models = new Map<string, PropModel>();
  has(name: string) { return this.models.has(name); }
  get(name: string) { return this.models.get(name); }
  /** a car for a hash: the fleet mix above, deterministic per spot */
  car(hash: number): PropModel | undefined {
    const total = CAR_WEIGHTS.reduce((a, b) => a + b, 0);
    let r = (hash >>> 0) % total;
    for (let i = 0; i < CAR_NAMES.length; i++) {
      r -= CAR_WEIGHTS[i];
      if (r < 0) { const m = this.models.get(CAR_NAMES[i]); if (m) return m; break; }
    }
    return this.models.get('sedan');
  }
}

let vertexMat: THREE.MeshLambertMaterial | null = null;
let atlasMat: THREE.MeshLambertMaterial | null = null;

// props.glb is quantized (KHR_mesh_quantization via meshopt): positions arrive as
// normalised int16. Baking a world-scale transform into that storage would clamp every
// vertex to ±1, so every attribute is widened to float first.
function toFloat(geo: THREE.BufferGeometry) {
  for (const name of Object.keys(geo.attributes)) {
    const a = geo.attributes[name] as THREE.BufferAttribute;
    if (a.array instanceof Float32Array && !a.normalized) continue;
    const out = new Float32Array(a.count * a.itemSize);
    for (let i = 0; i < a.count; i++) {
      out[i * a.itemSize] = a.getX(i);
      if (a.itemSize > 1) out[i * a.itemSize + 1] = a.getY(i);
      if (a.itemSize > 2) out[i * a.itemSize + 2] = a.getZ(i);
      if (a.itemSize > 3) out[i * a.itemSize + 3] = a.getW(i);
    }
    geo.setAttribute(name, new THREE.BufferAttribute(out, a.itemSize));
  }
}

function bakeScene(scene: THREE.Group): PropModel | null {
  scene.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) toFloat(m.geometry); });
  scene.updateMatrixWorld(true);
  const name = scene.name;   // tools/pack_models.mjs names each scene after its model
  const spec = TARGET[name];
  if (!spec) return null;
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());
  const axis = spec.axis ?? 'z';
  const extent = spec.by === 'height' ? size.y : (axis === 'x' ? size.x : size.z);
  const s = spec.size / Math.max(extent, 1e-6);
  // world-bake transform: centre xz, floor at y = 0, scale to real size
  const bake = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-centre.x, -box.min.y, -centre.z));

  const parts: THREE.BufferGeometry[] = [];
  const paintParts: THREE.BufferGeometry[] = [];
  let textured = false;
  let atlas: THREE.Texture | null = null;
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const groups = mesh.geometry.groups.length ? mesh.geometry.groups : [{ start: 0, count: Infinity, materialIndex: 0 }];
    for (const grp of groups) {
      const mat = mats[grp.materialIndex ?? 0] as THREE.MeshStandardMaterial;
      // Kenney names body-panel materials paintRed / paintBlue…; those take a per-instance tint
      const isPaint = /^paint/i.test(mat.name ?? '');
      if (isPaint) mesh.userData.paint = true;
      let g = mesh.geometry.clone();
      if (mesh.geometry.groups.length) {
        // split the primitive group out so its colour can be baked on its own
        const idx = g.index!;
        const sub = idx.array.slice(grp.start, grp.start + grp.count);
        g.setIndex(new THREE.BufferAttribute(sub, 1));
        g.clearGroups();
      }
      g = g.toNonIndexed();
      g.applyMatrix4(mesh.matrixWorld);
      g.applyMatrix4(bake);
      if (!g.attributes.normal) g.computeVertexNormals();
      const n = g.attributes.position.count;
      if (mat.map) {
        textured = true;
        atlas = atlas ?? mat.map;
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
      } else {
        // bake the material colour into vertex colour; paint panels bake WHITE and get
        // their colour from the instance (see props.ts)
        const c = isPaint ? new THREE.Color(1, 1, 1) : (mat.color ?? new THREE.Color(0.8, 0.8, 0.8));
        const col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
        g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      }
      // keep every part on the same attribute set so they merge
      for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv', 'color'].includes(k)) g.deleteAttribute(k);
      (isPaint ? paintParts : parts).push(g);
    }
  });
  if (!parts.length && !paintParts.length) return null;
  const need = textured ? ['position', 'normal', 'uv'] : ['position', 'normal', 'color'];
  for (const g of [...parts, ...paintParts]) {
    for (const k of need) {
      if (g.attributes[k]) continue;
      const n = g.attributes.position.count;
      g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n * (k === 'uv' ? 2 : 3)).fill(k === 'color' ? 1 : 0), k === 'uv' ? 2 : 3));
    }
    for (const k of Object.keys(g.attributes)) if (!need.includes(k)) g.deleteAttribute(k);
  }
  const geo = mergeGeometries(parts.length ? parts : paintParts, false);
  if (!geo) return null;
  geo.computeBoundingSphere();
  let geoPaint: THREE.BufferGeometry | undefined;
  if (parts.length && paintParts.length) {
    geoPaint = mergeGeometries(paintParts, false) ?? undefined;
    geoPaint?.computeBoundingSphere();
  }
  let material: THREE.Material;
  if (textured) {
    if (!atlasMat) {
      atlasMat = new THREE.MeshLambertMaterial({ map: atlas });
    }
    material = atlasMat;
  } else {
    if (!vertexMat) vertexMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    material = vertexMat;
  }
  // the original tree, baked the same way, for props with moving parts (car wheels)
  const root = new THREE.Group();
  root.applyMatrix4(bake);
  root.add(scene);
  root.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return { name, geo, geoPaint, material, size: size.multiplyScalar(s), axis, root };
}

export async function loadProps(url: string): Promise<PropLib> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.loadAsync(url);
  const lib = new PropLib();
  for (const scene of gltf.scenes) {
    const m = bakeScene(scene as THREE.Group);
    if (m) lib.models.set(m.name, m);
  }
  return lib;
}

/** the loaded kit, or null when props.glb failed to load — every consumer falls back to boxes */
export let PROPS: PropLib | null = null;
export function setProps(lib: PropLib | null) { PROPS = lib; }
