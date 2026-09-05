import * as THREE from 'three';
import type { PropLib, PropModel } from './assets';

// Per-chunk prop placement: decor records "a sedan here, facing that way" while it
// builds a chunk, and build() turns each model's list into ONE InstancedMesh. A
// parking lot of 110 cars is one draw call (plus its shadow), the same as before,
// but with real cars.
//
// Angles follow decor's convention: `ang` is the direction the prop's length points,
// measured in the xz plane from +x toward +z. A baked model's length runs along its
// +z (cars, hydrants) or +x (benches); rotate accordingly.

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const _c = new THREE.Color();
const STRIDE = 6;

export class ChunkProps {
  private items = new Map<PropModel, number[]>();   // model -> [x, y, z, ang, scale, tint, …]
  private count = 0;

  /** `tint` (a CSS hex) colours the model's paint panels; ignored by props without any */
  add(model: PropModel | undefined, x: number, y: number, z: number, ang: number, scale = 1, tint = '#ffffff') {
    if (!model) return;
    let list = this.items.get(model);
    if (!list) { list = []; this.items.set(model, list); }
    list.push(x, y, z, ang, scale, _c.set(tint).getHex());
    this.count++;
  }

  get size() { return this.count; }

  build(): THREE.Group | null {
    if (!this.count) return null;
    const group = new THREE.Group();
    for (const [model, list] of this.items) {
      const n = list.length / STRIDE;
      const mesh = new THREE.InstancedMesh(model.geo, model.material, n);
      // body panels are a second instanced mesh of the same transforms, coloured per instance
      const paint = model.geoPaint ? new THREE.InstancedMesh(model.geoPaint, model.material, n) : null;
      for (let i = 0; i < n; i++) {
        const o = i * STRIDE;
        const x = list[o], y = list[o + 1], z = list[o + 2], ang = list[o + 3], sc = list[o + 4];
        const rotY = model.axis === 'x' ? -ang : Math.PI / 2 - ang;
        _q.setFromAxisAngle(UP, rotY);
        _p.set(x, y, z);
        _s.set(sc, sc, sc);
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(i, _m);
        if (paint) { paint.setMatrixAt(i, _m); paint.setColorAt(i, _c.setHex(list[o + 5])); }
      }
      for (const im of paint ? [mesh, paint] : [mesh]) {
        im.instanceMatrix.needsUpdate = true;
        if (im.instanceColor) im.instanceColor.needsUpdate = true;
        im.castShadow = true;
        im.receiveShadow = true;
        im.frustumCulled = true;
        im.computeBoundingSphere();
        group.add(im);
      }
    }
    return group;
  }

  /** free a built group's per-instance buffers (geometry and materials are shared, never disposed here) */
  static dispose(group: THREE.Group) {
    for (const c of group.children) (c as THREE.InstancedMesh).dispose();
  }
}

export type { PropLib };
