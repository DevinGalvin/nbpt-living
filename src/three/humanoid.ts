import * as THREE from 'three';

// A procedural gait for the kit's rigged people (a standard humanoid skeleton: Hips,
// Spine, Left/RightUpLeg, Left/RightLeg, Left/RightArm, Left/RightForeArm, hands and
// feet). The models ship in a T-pose with no animation clips, so the walk is authored
// here as rotations about each bone's LOCAL X (the axis that swings a limb in its
// vertical plane) on top of the rest orientation.
//
// Bone rolls differ between characters and between the two sides, so the SIGN of each
// rotation is measured at capture time rather than assumed: rotate the bone a little
// each way, see where the hand or foot ends up in the character's own frame, keep the
// direction that lowers the hand / swings the foot forward / bends the knee back.

export interface Humanoid {
  hips: THREE.Object3D;
  hipsY: number;
  spine: THREE.Object3D;
  upLegL: THREE.Object3D; upLegR: THREE.Object3D;
  legL: THREE.Object3D; legR: THREE.Object3D;
  armL: THREE.Object3D; armR: THREE.Object3D;
  foreL: THREE.Object3D; foreR: THREE.Object3D;
  rest: Map<THREE.Object3D, THREE.Quaternion>;
  /** per-limb rotation axis (bone-local) and sign, measured at capture */
  rot: Record<'armDownL' | 'armDownR' | 'armFwdL' | 'armFwdR' | 'legFwdL' | 'legFwdR' | 'kneeL' | 'kneeR', { axis: THREE.Vector3; sign: number }>;
}

const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _inv = new THREE.Matrix4();
const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const ARM_DOWN = 1.32;   // radians from the T-pose to hanging

export function captureHumanoid(root: THREE.Object3D): Humanoid | null {
  // the packed kit de-duplicates bone names across characters as Hips_1, Hips_2…;
  // within one character's subtree the prefix is unique
  const b = (n: string) => {
    const re = new RegExp('^' + n + '(_\\d+)?$');
    let found: THREE.Object3D | undefined;
    root.traverse((o) => { if (!found && re.test(o.name)) found = o; });
    return found;
  };
  const hips = b('Hips'), spine = b('Spine');
  const upLegL = b('LeftUpLeg'), upLegR = b('RightUpLeg'), legL = b('LeftLeg'), legR = b('RightLeg');
  const armL = b('LeftArm'), armR = b('RightArm'), foreL = b('LeftForeArm'), foreR = b('RightForeArm');
  const handL = b('LeftHand'), handR = b('RightHand'), footL = b('LeftFoot'), footR = b('RightFoot');
  if (!hips || !spine || !upLegL || !upLegR || !legL || !legR || !armL || !armR || !foreL || !foreR || !handL || !handR || !footL || !footR) return null;
  const rest = new Map<THREE.Object3D, THREE.Quaternion>();
  for (const o of [hips, spine, upLegL, upLegR, legL, legR, armL, armR, foreL, foreR]) rest.set(o, o.quaternion.clone());

  // where an end effector lands, in the character's own frame, after a trial rotation
  root.updateMatrixWorld(true);
  _inv.copy(root.matrixWorld).invert();
  const probe = (bone: THREE.Object3D, axis: THREE.Vector3, angle: number, end: THREE.Object3D, pre?: THREE.Quaternion) => {
    bone.quaternion.copy(rest.get(bone)!);
    if (pre) bone.quaternion.multiply(pre);
    bone.quaternion.multiply(_q.setFromAxisAngle(axis, angle));
    root.updateMatrixWorld(true);
    const v = end.getWorldPosition(_p).applyMatrix4(_inv).clone();
    bone.quaternion.copy(rest.get(bone)!);
    return v;
  };
  // the local axis whose rotation moves the end effector most along `key`, and the
  // sign that moves it the way we want (down for hands, forward for feet, back for knees)
  const measure = (bone: THREE.Object3D, end: THREE.Object3D, key: 'x' | 'y' | 'z', wantLess: boolean, pre?: THREE.Quaternion) => {
    let best = X, bestD = -1, sign = 1;
    for (const ax of [X, Y, Z]) {
      const a = probe(bone, ax, 0.6, end, pre)[key], c = probe(bone, ax, -0.6, end, pre)[key];
      const d = Math.abs(a - c);
      if (d > bestD) { bestD = d; best = ax; sign = (a < c) === wantLess ? 1 : -1; }
    }
    return { axis: best, sign };
  };
  const armDownL = measure(armL, handL, 'y', true);
  const armDownR = measure(armR, handR, 'y', true);
  const legFwdL = measure(upLegL, footL, 'z', false);
  const legFwdR = measure(upLegR, footR, 'z', false);
  const kneeL = measure(legL, footL, 'z', true);
  const kneeR = measure(legR, footR, 'z', true);
  // once the arm hangs, which axis swings the hand forward
  const hangL = new THREE.Quaternion().setFromAxisAngle(armDownL.axis, armDownL.sign * ARM_DOWN);
  const hangR = new THREE.Quaternion().setFromAxisAngle(armDownR.axis, armDownR.sign * ARM_DOWN);
  const armFwdL = measure(armL, handL, 'z', false, hangL);
  const armFwdR = measure(armR, handR, 'z', false, hangR);
  root.updateMatrixWorld(true);

  return { hips, hipsY: hips.position.y, spine, upLegL, upLegR, legL, legR, armL, armR, foreL, foreR, rest,
    rot: { armDownL, armDownR, armFwdL, armFwdR, legFwdL, legFwdR, kneeL, kneeR } };
}

function set(h: Humanoid, bone: THREE.Object3D, ax: THREE.Vector3, angle: number, ax2?: THREE.Vector3, angle2 = 0) {
  bone.quaternion.copy(h.rest.get(bone)!).multiply(_q.setFromAxisAngle(ax, angle));
  if (ax2) bone.quaternion.multiply(_q.setFromAxisAngle(ax2, angle2));
}

/**
 * Pose the skeleton for a walk at `phase` (radians, one stride = 2π) with `stride`
 * in 0..1 scaling the swing (0 = standing, arms hanging).
 */
export function poseWalk(h: Humanoid, phase: number, stride = 1) {
  const s = Math.sin(phase);
  const r = h.rot;
  const swing = 0.5 * stride;
  set(h, h.upLegL, r.legFwdL.axis, r.legFwdL.sign * s * swing);
  set(h, h.upLegR, r.legFwdR.axis, -r.legFwdR.sign * s * swing);
  // the knee bends as the leg swings through, straight at heel strike
  const kl = Math.max(0, -Math.sin(phase - 0.5)) * 0.8 * stride;
  const kr = Math.max(0, Math.sin(phase - 0.5)) * 0.8 * stride;
  set(h, h.legL, r.kneeL.axis, r.kneeL.sign * kl);
  set(h, h.legR, r.kneeR.axis, r.kneeR.sign * kr);
  // arms hang, then counter-swing the legs
  const a = 0.42 * stride;
  set(h, h.armL, r.armDownL.axis, r.armDownL.sign * ARM_DOWN, r.armFwdL.axis, -r.armFwdL.sign * s * a);
  set(h, h.armR, r.armDownR.axis, r.armDownR.sign * ARM_DOWN, r.armFwdR.axis, r.armFwdR.sign * s * a);
  set(h, h.foreL, r.armDownL.axis, r.armDownL.sign * 0.25);
  set(h, h.foreR, r.armDownR.axis, r.armDownR.sign * 0.25);
  // hips bob twice a stride; a touch of shoulder counter-rotation
  h.hips.position.y = h.hipsY + Math.abs(Math.cos(phase)) * 0.22 * stride;
  set(h, h.spine, Z, -s * 0.05 * stride);
}
