import * as THREE from 'three';
import { WorldIndex } from '../world/index';
import type { WorldData } from '../world/types';

// The Gillis (Route 1) drawbridge over the Merrimack: green steel gantry towers
// on stone piers, and two bascule leaves that raise on a schedule so big boats can
// pass — the way the real one opens on the hour. Built as one animated landmark
// (not chunk-baked, since the leaves move); the generic deck is carved open at the
// channel (see decor.ts GILLIS_SKIP) so the lift exposes a real gap.

export const GILLIS_PT = { x: -2421, z: -3599 };
// The real span centre + heading + the half-extents of the gap the generic deck
// must leave for the custom span. Filled in by the GillisBridge constructor; decor.ts
// carves an oriented RECTANGLE (not a circle, which left holes at the corners).
export const gillisCenter = { x: GILLIS_PT.x, z: GILLIS_PT.z, ux: 1, uz: 0, halfLen: 78, halfW: 50 };

const GREEN = '#2f5d46', GREEN_D = '#23492f', STONE = '#9c968b', STONE_D = '#857f74';
const ASPH = '#3a3d42', RAIL = '#bdb8ab', LINE = '#c9a23e';

function box(w: number, h: number, d: number, hex: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: hex }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class GillisBridge {
  readonly root = new THREE.Group();
  private leafA = new THREE.Group();   // pivots at the +X tower, reaches to centre
  private leafB = new THREE.Group();   // pivots at the -X tower, reaches to centre
  private t = 0;
  private open = 0;                    // 0 closed … 1 fully raised

  constructor(scene: THREE.Scene, index: WorldIndex, world: WorldData) {
    // nearest bridge-road segment to the Gillis point → channel centre + heading
    let best: number[] | null = null, bi = 0, bd = Infinity, cx = GILLIS_PT.x, cz = GILLIS_PT.z;
    for (const r of world.roads) {
      if (!r.b) continue;
      for (let i = 0; i + 3 < r.p.length; i += 2) {
        const ax = r.p[i], az = r.p[i + 1], ex = r.p[i + 2] - ax, ez = r.p[i + 3] - az;
        const l2 = ex * ex + ez * ez || 1;
        let s = ((GILLIS_PT.x - ax) * ex + (GILLIS_PT.z - az) * ez) / l2;
        s = Math.max(0, Math.min(1, s));
        const px = ax + ex * s, pz = az + ez * s, d = (px - GILLIS_PT.x) ** 2 + (pz - GILLIS_PT.z) ** 2;
        if (d < bd) { bd = d; best = r.p; bi = i; cx = px; cz = pz; }
      }
    }
    const pts = best || [GILLIS_PT.x - 100, GILLIS_PT.z, GILLIS_PT.x + 100, GILLIS_PT.z];
    let ux = pts[bi + 2] - pts[bi], uz = pts[bi + 3] - pts[bi + 1];
    const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    const deckY = index.bridgeDeckYAt(pts, cx, cz);

    gillisCenter.x = cx; gillisCenter.z = cz;      // so decor.ts carves the gap here
    gillisCenter.ux = ux; gillisCenter.uz = uz;    // (oriented to the road heading)
    this.root.position.set(cx, 0, cz);
    this.root.rotation.y = Math.atan2(-uz, ux);   // local +X = road heading, +Z = across

    const HW = 52;        // half deck width
    const GAP = 80;       // tower offset from centre = each leaf's length
    const TOWER_H = 50;   // gantry height above the deck

    // ---- stone piers + green gantry towers at ±GAP ----
    for (const sgn of [-1, 1]) {
      const along = sgn * GAP;
      const pier = box(36, deckY + 6, 122, STONE);
      pier.position.set(along, (deckY + 6) / 2, 0);
      this.root.add(pier);
      const cap = box(44, 6, 130, STONE_D);
      cap.position.set(along, deckY + 1, 0);
      this.root.add(cap);
      // a green gantry portal: two posts at the deck edges + a top beam
      for (const side of [-1, 1]) {
        const post = box(10, TOWER_H, 12, GREEN);
        post.position.set(along, deckY + TOWER_H / 2, side * HW);
        this.root.add(post);
      }
      const beam = box(14, 9, HW * 2 + 12, GREEN);
      beam.position.set(along, deckY + TOWER_H, 0);
      this.root.add(beam);
      const beam2 = box(10, 6, HW * 2 + 12, GREEN_D);
      beam2.position.set(along, deckY + TOWER_H * 0.62, 0);
      this.root.add(beam2);
    }
    // operator's house on the +X tower
    const house = box(20, 18, 26, GREEN);
    house.position.set(GAP, deckY + TOWER_H + 9, HW - 6);
    this.root.add(house);
    const roof = box(24, 4, 30, GREEN_D);
    roof.position.set(GAP, deckY + TOWER_H + 18, HW - 6);
    this.root.add(roof);

    // ---- the two bascule leaves (asphalt deck + green trusses) ----
    // leafA: hinge at +GAP, body reaches in -X toward centre; leafB mirrors it.
    const buildLeaf = (group: THREE.Group, hingeAlong: number, dirToCentre: number) => {
      group.position.set(hingeAlong, deckY, 0);
      this.root.add(group);
      const mid = dirToCentre * GAP / 2;     // body centre, group-local
      // road deck + green steel underside (the green shows when the leaf is up)
      const deck = box(GAP, 3, HW * 2, ASPH);
      deck.position.set(mid, -1.5, 0);
      group.add(deck);
      const under = box(GAP - 4, 6, HW * 2 - 8, GREEN);
      under.position.set(mid, -5, 0);
      group.add(under);
      // dashed-ish centre line
      const cl = box(GAP * 0.86, 0.6, 3, LINE);
      cl.position.set(mid, 0.2, 0);
      group.add(cl);
      // green side trusses + a top chord + diagonals
      for (const side of [-1, 1]) {
        const girder = box(GAP, 7, 4, GREEN);
        girder.position.set(mid, 3, side * HW);
        group.add(girder);
        const chord = box(GAP, 4, 4, GREEN_D);
        chord.position.set(mid, 11, side * HW);
        group.add(chord);
        for (let k = 0; k <= 4; k++) {
          const post = box(2.5, 9, 2.5, GREEN);    // truss verticals along the leaf
          post.position.set(dirToCentre * (k / 4) * GAP, 7, side * HW);
          group.add(post);
        }
      }
    };
    buildLeaf(this.leafA, GAP, -1);   // right leaf, body toward centre (-X)
    buildLeaf(this.leafB, -GAP, 1);   // left leaf, body toward centre (+X)

    scene.add(this.root);
  }

  // open ~18s out of every ~80s, easing up/down over ~4s (the bridge tender's run)
  update(dt: number) {
    this.t += dt;
    const cycle = this.t % 80;
    const target = cycle > 30 && cycle < 48 ? 1 : 0;
    this.open += (target - this.open) * Math.min(1, dt / 3.5);
    const ang = this.open * 1.28;                 // ~73°
    this.leafA.rotation.z = -ang;                 // right leaf lifts its centre end
    this.leafB.rotation.z = ang;                  // left leaf lifts its centre end
  }
}
