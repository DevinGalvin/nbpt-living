import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// The kid and Clipper the dog — soft rounded shapes (capsules, spheres,
// rounded boxes), rigged with two-segment limbs and speed-blended gaits,
// eased starts/stops, banking into turns, and idle life (breathing, blinks,
// sniffs, sits). Units = world px (8 px = 1 m). Models face +z.

function mat(color: string): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ color });
}

// vertical capsule; pivotTop hangs it from its top tip
function cap(r: number, len: number, color: string, pivotTop = false): THREE.Mesh {
  const g = new THREE.CapsuleGeometry(r, len, 5, 12);
  if (pivotTop) g.translate(0, -(len / 2 + r), 0);
  return new THREE.Mesh(g, mat(color));
}

// capsule lying along +z (bodies, snouts)
function capZ(r: number, len: number, color: string): THREE.Mesh {
  const g = new THREE.CapsuleGeometry(r, len, 5, 12);
  g.rotateX(Math.PI / 2);
  return new THREE.Mesh(g, mat(color));
}

function sph(r: number, color: string, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), mat(color));
  m.scale.set(sx, sy, sz);
  return m;
}

function rbox(w: number, h: number, d: number, rad: number, color: string): THREE.Mesh {
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, rad), mat(color));
}

function blobShadow(r: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.CircleGeometry(r, 18),
    new THREE.MeshBasicMaterial({ color: '#1e2a1a', transparent: true, opacity: 0.3, depthWrite: false })
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.6;
  return m;
}

function lerpAngle(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

function ease(cur: number, target: number, dt: number, rate: number): number {
  return cur + (target - cur) * Math.min(1, dt * rate);
}

export class Kid {
  root = new THREE.Group();            // world position
  private heading = new THREE.Group(); // yaw to face motion
  private bank = new THREE.Group();    // roll into turns
  private tilt = new THREE.Group();    // forward lean + bounce
  private bodyGroup = new THREE.Group();
  private headGrp = new THREE.Group();
  private thighL: THREE.Group;
  private thighR: THREE.Group;
  private shinL: THREE.Group;
  private shinR: THREE.Group;
  private upperL: THREE.Group;
  private upperR: THREE.Group;
  private foreL: THREE.Group;
  private foreR: THREE.Group;
  private eyeL: THREE.Mesh;
  private eyeR: THREE.Mesh;

  private t = 0;
  private phase = 0;
  private amp = 0;                 // gait amplitude, eased
  private lean = 0.02;
  private bankZ = 0;
  private faceAngle = Math.PI;     // face camera (south) at start
  private prevFace = Math.PI;
  private blinkAt = 2.5;
  private blinkT = 0;
  private glanceY = 0;
  private glanceTarget = 0;
  private glanceAt = 3;

  constructor() {
    const JEANS = '#3b4d6b', SLEEVE = '#a23730', SKIN = '#eec39a', HAIR = '#4a3320';

    const mkLeg = (sx: number): [THREE.Group, THREE.Group] => {
      const thigh = new THREE.Group();
      thigh.position.set(sx * 3.2, 13, 0);
      const thighMesh = cap(2.3, 3.2, JEANS, true);
      const shin = new THREE.Group();
      shin.position.set(0, -6.8, 0);
      const shinMesh = cap(2, 2.6, JEANS, true);
      const shoe = rbox(4.6, 3, 6.6, 1.2, '#f0ece2');
      shoe.position.set(0, -4.8, 1.1);
      shin.add(shinMesh, shoe);
      thigh.add(thighMesh, shin);
      return [thigh, shin];
    };
    [this.thighL, this.shinL] = mkLeg(-1);
    [this.thighR, this.shinR] = mkLeg(1);

    // crimson hoodie: soft capsule torso, hood bump, kangaroo pocket
    const body = cap(4.6, 5, '#b03a32');
    body.scale.set(1.25, 1, 0.85);
    body.position.y = 19;
    const hood = sph(2.7, '#922f29', 1.5, 0.62, 1);
    hood.position.set(0, 24.6, -3.6);
    const pocket = rbox(6.4, 3.2, 1.4, 0.6, '#922f29');
    pocket.position.set(0, 15.8, 3.6);

    // head on a neck pivot so it can stay level and glance around
    this.headGrp.position.y = 27.5;
    const head = sph(5.1, SKIN, 1, 0.96, 0.95);
    head.position.y = 3;
    const hair = sph(5.25, HAIR, 1.03, 0.72, 1.01);
    hair.position.y = 4.7;
    const bangs = rbox(8.4, 2, 1.6, 0.7, HAIR);
    bangs.position.set(0, 5.4, 4);
    this.eyeL = sph(0.85, '#23201c');
    this.eyeR = sph(0.85, '#23201c');
    this.eyeL.position.set(-2.05, 3.2, 4.4);
    this.eyeR.position.set(2.05, 3.2, 4.4);
    // catchlights — tiny white glints that make the eyes feel alive (blink with them)
    for (const e of [this.eyeL, this.eyeR]) { const g = sph(0.3, '#ffffff'); g.position.set(-0.28, 0.34, 0.58); e.add(g); }
    // a friendly face: soft brows, a button nose, a little smile, rosy cheeks
    const brow = (sx: number) => { const b = rbox(2.2, 0.62, 0.6, 0.26, HAIR); b.position.set(sx * 2.05, 4.55, 4.2); b.rotation.z = sx * 0.1; return b; };
    const knose = sph(0.62, '#e3a878', 1, 0.82, 1); knose.position.set(0, 2.35, 5.0);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.22, 6, 12, Math.PI), mat('#8a4b40'));
    smile.rotation.z = Math.PI; smile.position.set(0, 1.25, 4.55);
    const cheek = (sx: number) => { const c = sph(0.95, '#e89a86', 1, 0.66, 0.45); c.position.set(sx * 3.15, 1.85, 4.05); const m = c.material as THREE.MeshLambertMaterial; m.transparent = true; m.opacity = 0.6; return c; };
    this.headGrp.add(head, hair, bangs, this.eyeL, this.eyeR, brow(-1), brow(1), knose, smile, cheek(-1), cheek(1));

    const mkArm = (sx: number): [THREE.Group, THREE.Group] => {
      const upper = new THREE.Group();
      upper.position.set(sx * 6.4, 24, 0);
      const upperMesh = cap(1.8, 3.3, SLEEVE, true);
      const fore = new THREE.Group();
      fore.position.set(0, -6.8, 0);
      const foreMesh = cap(1.6, 2.8, SLEEVE, true);
      const hand = sph(1.7, SKIN);
      hand.position.set(0, -6.2, 0.2);
      fore.add(foreMesh, hand);
      upper.add(upperMesh, fore);
      return [upper, fore];
    };
    [this.upperL, this.foreL] = mkArm(-1);
    [this.upperR, this.foreR] = mkArm(1);

    this.bodyGroup.add(body, hood, pocket, this.headGrp, this.upperL, this.upperR);
    this.tilt.add(this.thighL, this.thighR, this.bodyGroup);
    this.bank.add(this.tilt);
    this.heading.add(this.bank);
    this.heading.rotation.y = this.faceAngle;
    this.root.add(this.heading, blobShadow(9));
  }

  // vx/vz = velocity in world px/s
  update(dt: number, vx: number, vz: number, sprinting: boolean, riding = false, boating = false) {
    this.t += dt;
    const speed = Math.hypot(vx, vz);
    const moving = speed > 1;
    const s01 = Math.min(1, speed / 380);

    if (moving) {
      this.prevFace = this.faceAngle;
      this.faceAngle = lerpAngle(this.faceAngle, Math.atan2(vx, vz), Math.min(1, dt * 18));
      // stride frequency follows real ground speed — feet stop sliding
      this.phase += dt * (riding ? 3.5 + speed * 0.018 : 7.5 + speed * 0.032);
    } else {
      // ease the legs to a natural standing pose, not a mid-air freeze
      const rest = Math.round(this.phase / Math.PI) * Math.PI;
      this.phase = ease(this.phase, rest, dt, 9);
      this.prevFace = this.faceAngle;
    }
    this.heading.rotation.y = this.faceAngle;

    // amplitude eases in/out so starts and stops flow
    this.amp = ease(this.amp, moving ? 0.62 + s01 * 0.5 : 0, dt, moving ? 7 : 9);
    const a = this.amp;
    const sw = Math.sin(this.phase);

    // legs: thigh swing + knee that folds on the recovery swing
    this.thighL.rotation.x = sw * a * 0.92;
    this.thighR.rotation.x = -sw * a * 0.92;
    this.shinL.rotation.x = Math.max(0, Math.sin(this.phase - 0.7)) * a * 0.95;
    this.shinR.rotation.x = Math.max(0, Math.sin(this.phase + Math.PI - 0.7)) * a * 0.95;

    // arms: counter-swing with a pumping elbow (always slightly bent)
    this.upperL.rotation.x = -sw * a * 0.78;
    this.upperR.rotation.x = sw * a * 0.78;
    const pump = 0.28 + a * 0.22;
    this.foreL.rotation.x = -(pump + Math.max(0, Math.sin(this.phase + Math.PI)) * a * 0.4);
    this.foreR.rotation.x = -(pump + Math.max(0, Math.sin(this.phase)) * a * 0.4);

    // torso counter-sway, smooth two-beat bounce with a touch of squash
    this.bodyGroup.rotation.y = sw * a * 0.07;
    const bounce = (1 - Math.cos(this.phase * 2)) * 0.5;
    this.tilt.position.y = bounce * (1.1 + s01 * 1.9) * a + (moving ? 0 : Math.sin(this.t * 1.7) * 0.4);
    this.bodyGroup.scale.y = 1 - bounce * a * 0.045;
    this.bodyGroup.position.y = moving ? 0 : Math.sin(this.t * 1.7) * 0.25;

    // forward lean scales with speed; bank into turns
    this.lean = ease(this.lean, moving ? 0.06 + s01 * 0.26 + (sprinting ? 0.04 : 0) : 0.02, dt, 6);
    this.tilt.rotation.x = this.lean;
    const angVel = dt > 0 ? lerpAngle(0, this.faceAngle - this.prevFace, 1) / dt : 0;
    this.bankZ = ease(this.bankZ, THREE.MathUtils.clamp(-angVel * 0.05, -0.16, 0.16) * Math.min(1, a), dt, 6);
    this.bank.rotation.z = this.bankZ;

    // head: stays level while leaning, glances around when idle
    if (!moving && this.t > this.glanceAt) {
      this.glanceTarget = (Math.random() - 0.5) * 0.7;
      this.glanceAt = this.t + 2.2 + Math.random() * 3.5;
    }
    if (moving) this.glanceTarget = 0;
    this.glanceY = ease(this.glanceY, this.glanceTarget, dt, 4);
    this.headGrp.rotation.x = -this.lean * 0.55;
    this.headGrp.rotation.y = this.glanceY;

    if (riding) {
      // seated on the bike: a gentle lean (kids ride fairly upright), thighs hanging
      // to the cranks just below the hips and pedalling in circles, hands on the bars
      const pa = this.phase;
      this.tilt.rotation.x = 0.12;
      this.thighL.rotation.x = 0.28 + Math.sin(pa) * 0.4;
      this.thighR.rotation.x = 0.28 + Math.sin(pa + Math.PI) * 0.4;
      this.shinL.rotation.x = 0.55 + Math.max(0, -Math.cos(pa)) * 0.6;
      this.shinR.rotation.x = 0.55 + Math.max(0, -Math.cos(pa + Math.PI)) * 0.6;
      this.upperL.rotation.x = -0.55;
      this.upperR.rotation.x = -0.55;
      this.foreL.rotation.x = -0.28;
      this.foreR.rotation.x = -0.28;
      this.bodyGroup.rotation.y = 0;
      this.tilt.position.y = Math.sin(this.phase * 2) * 0.2;
      this.bodyGroup.scale.y = 1;
      this.headGrp.rotation.x = -0.06;
    }
    if (boating) {
      // seated in the rowboat: legs braced forward, a slow rhythmic pull on the oars
      // (overrides the walk/run stride — the boat moves, the kid doesn't run)
      const row = Math.sin(this.t * 2.0);
      this.tilt.rotation.x = 0.10 + row * 0.14;
      this.thighL.rotation.x = 0.85;
      this.thighR.rotation.x = 0.85;
      this.shinL.rotation.x = 0.15;
      this.shinR.rotation.x = 0.15;
      this.upperL.rotation.x = -0.6 + row * 0.45;
      this.upperR.rotation.x = -0.6 + row * 0.45;
      this.foreL.rotation.x = -0.55;
      this.foreR.rotation.x = -0.55;
      this.bodyGroup.rotation.y = 0;
      this.tilt.position.y = 0;
      this.bodyGroup.scale.y = 1;
      this.headGrp.rotation.x = -0.04;
    }

    // blink
    if (this.blinkT > 0) {
      this.blinkT -= dt;
      if (this.blinkT <= 0) {
        this.eyeL.scale.y = 1;
        this.eyeR.scale.y = 1;
      }
    } else if (this.t > this.blinkAt) {
      this.eyeL.scale.y = 0.12;
      this.eyeR.scale.y = 0.12;
      this.blinkT = 0.12;
      this.blinkAt = this.t + 1.8 + Math.random() * 4;
    }
  }

  setPos(x: number, z: number) {
    this.root.position.x = x;
    this.root.position.z = z; // y managed by Game (bridge decks/docks)
  }

  get facing(): number {
    return this.faceAngle;
  }
}

// the route kid's bike: red frame, spinning wheels, follows under the rider
export class Bike {
  root = new THREE.Group();
  private wheelF: THREE.Mesh;
  private wheelB: THREE.Mesh;

  constructor() {
    const FRAME = '#b03a32', DARK = '#2c2c30', CHROME = '#c9cdd2';
    const frameMat = new THREE.MeshLambertMaterial({ color: FRAME });
    const wheel = (): THREE.Mesh => {
      const w = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.85, 8, 18).rotateY(Math.PI / 2), new THREE.MeshLambertMaterial({ color: DARK }));
      w.castShadow = true;
      return w;
    };
    this.wheelF = wheel();
    this.wheelF.position.set(0, 4.6, 7);
    this.wheelB = wheel();
    this.wheelB.position.set(0, 4.6, -6.5);
    const down = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.5, 14), frameMat);
    down.position.set(0, 9.6, 0.2);
    down.castShadow = true;
    const seatPost = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.5, 1.2), frameMat);
    seatPost.position.set(0, 11.4, -6.4);
    const headPost = new THREE.Mesh(new THREE.BoxGeometry(1.2, 5.5, 1.2), frameMat);
    headPost.position.set(0, 11.8, 7);
    const cranks = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1.6, 8).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: DARK }));
    cranks.position.set(0, 4.8, 0.4);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(3, 1.1, 4.6), new THREE.MeshLambertMaterial({ color: DARK }));
    seat.position.set(0, 13.8, -6.4);
    const bars = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.8, 0.8), new THREE.MeshLambertMaterial({ color: CHROME }));
    bars.position.set(0, 14.6, 7.2);
    const fenderShine = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 4), new THREE.MeshLambertMaterial({ color: CHROME }));
    fenderShine.position.set(0, 8.9, 7);
    this.root.add(this.wheelF, this.wheelB, down, seatPost, headPost, cranks, seat, bars, fenderShine);
  }

  update(dt: number, speed: number, heading: number) {
    this.root.rotation.y = heading;
    this.wheelF.rotation.x -= (speed * dt) / 4.6;
    this.wheelB.rotation.x -= (speed * dt) / 4.6;
  }
}

export class Dog {
  root = new THREE.Group();
  private heading = new THREE.Group();
  private trunk = new THREE.Group();   // pivots at the rear hips (sit, gallop pitch)
  private headGroup = new THREE.Group();
  private earL: THREE.Group;
  private earR: THREE.Group;
  private legs: THREE.Group[] = [];    // LF, RF, LR, RR
  private tail: THREE.Group;
  private tailTip: THREE.Group;

  private t = 0;
  private phase = 0;
  private wagPhase = 0;
  private amp = 0;
  private gallop = 0;
  private sitP = 0;
  private sniffP = 0;
  private idleT = 0;
  private mode: 'stand' | 'sniff' | 'sit' = 'stand';
  private modeUntil = 0;
  private lookY = 0;
  private faceAngle = Math.PI;
  private earFlop = 0;
  private prevBounce = 0;

  constructor(fur = '#cda169') {
    const c = new THREE.Color(fur);
    const darker = '#' + c.clone().multiplyScalar(0.84).getHexString();
    const darkest = '#' + c.clone().multiplyScalar(0.72).getHexString();

    // trunk pivot sits at the rear hips: (0, 8, -6.5) in heading space
    this.trunk.position.set(0, 8, -6.5);
    const body = capZ(4.1, 8.6, fur);
    body.position.set(0, 3, 6.5);
    body.scale.set(1.05, 0.95, 1);
    const chest = sph(4.2, darker, 0.92, 0.95, 0.9);
    chest.position.set(0, 2.2, 11.3);
    const rump = sph(3.9, fur, 0.95, 0.9, 0.9);
    rump.position.set(0, 2.8, 1);

    // head on a neck pivot (looks at the kid, sniffs the ground)
    this.headGroup.position.set(0, 6, 14.5);
    const head = sph(4.15, fur, 0.95, 1, 0.95);
    head.position.set(0, 1.5, 2.5);
    const snout = capZ(1.9, 2.4, darker);
    snout.position.set(0, -0.2, 6.6);
    const nose = sph(0.95, '#2b2420', 1.1, 0.9, 0.9);
    nose.position.set(0, 0.3, 8.8);
    const eyeL = sph(0.72, '#23201c');
    const eyeR = sph(0.72, '#23201c');
    eyeL.position.set(-1.95, 2.7, 5.5);
    eyeR.position.set(1.95, 2.7, 5.5);
    for (const e of [eyeL, eyeR]) { const g = sph(0.24, '#ffffff'); g.position.set(-0.2, 0.28, 0.5); e.add(g); }
    // a happy lolling tongue hanging from the mouth
    const tongue = rbox(1.4, 0.45, 2.3, 0.4, '#e07f88');
    tongue.position.set(0, -1.5, 7.8); tongue.rotation.x = 0.55;
    const mkEar = (sx: number): THREE.Group => {
      const grp = new THREE.Group();
      grp.position.set(sx * 3.3, 5.4, 1.5);
      const flap = sph(1.95, darkest, 0.5, 1.25, 0.78);
      flap.position.y = -1.9;
      grp.add(flap);
      grp.rotation.z = sx * 0.22;
      return grp;
    };
    this.earL = mkEar(-1);
    this.earR = mkEar(1);
    this.headGroup.add(head, snout, nose, eyeL, eyeR, this.earL, this.earR, tongue);

    // tail: two soft segments for a whippy wag
    this.tail = new THREE.Group();
    this.tail.position.set(0, 7, -1.5);
    const tailBase = cap(1.05, 2.4, fur, true);
    this.tailTip = new THREE.Group();
    this.tailTip.position.set(0, -4.2, 0);
    const tipMesh = cap(0.85, 2, darker, true);
    this.tailTip.add(tipMesh);
    this.tail.add(tailBase, this.tailTip);
    this.tail.rotation.x = -2.4;

    // a red collar with a little gold tag — Clipper's got an owner
    const collar = new THREE.Mesh(new THREE.TorusGeometry(3.7, 0.55, 8, 18), mat('#b5402f'));
    collar.position.set(0, 4.0, 12.7); collar.scale.set(1.05, 0.9, 1);
    const tag = sph(0.7, '#e8c44f'); tag.position.set(0, 0.9, 13.1);
    this.trunk.add(body, chest, rump, this.headGroup, this.tail, collar, tag);

    // legs stay under the heading so the trunk can pitch without lifting paws
    const legPos: [number, number][] = [[-3.2, 6.5], [3.2, 6.5], [-3.2, -6.5], [3.2, -6.5]];
    for (const [lx, lz] of legPos) {
      const leg = new THREE.Group();
      leg.position.set(lx, 8, lz);
      const upper = cap(1.35, 2.6, darker, true);
      const paw = rbox(2.8, 2.4, 3.4, 0.9, fur);
      paw.position.set(0, -6.9, 0.4);
      leg.add(upper, paw);
      this.legs.push(leg);
      this.heading.add(leg);
    }

    this.heading.add(this.trunk);
    this.heading.rotation.y = this.faceAngle;
    this.root.add(this.heading, blobShadow(7));
  }

  // follows a target point (behind-left of the kid); no collision — dogs weave
  update(dt: number, targetX: number, targetZ: number) {
    this.t += dt;
    const dx = targetX - this.root.position.x;
    const dz = targetZ - this.root.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 520) {
      this.root.position.x = targetX; // fast-travel catch-up
      this.root.position.z = targetZ;
      return;
    }
    const speed = Math.min(490, dist * 7);
    if (dist > 2 && speed > 18) {
      this.root.position.x += (dx / dist) * speed * dt;
      this.root.position.z += (dz / dist) * speed * dt;
    }
    const moving = speed > 18 && dist > 4;
    const norm = Math.min(1.2, speed / 300);

    if (moving) {
      this.faceAngle = lerpAngle(this.faceAngle, Math.atan2(dx, dz), Math.min(1, dt * 9));
      this.phase += dt * (6.5 + speed * 0.042);
      this.idleT = 0;
      this.mode = 'stand';
    } else {
      const rest = Math.round(this.phase / Math.PI) * Math.PI;
      this.phase = ease(this.phase, rest, dt, 9);
      this.idleT += dt;
      // after a couple of seconds Clipper gets comfortable: sniff or sit
      if (this.mode === 'stand' && this.idleT > 2.2) {
        if (Math.random() < 0.45) {
          this.mode = 'sniff';
          this.modeUntil = this.t + 1.6 + Math.random() * 1.2;
        } else {
          this.mode = 'sit';
        }
      }
      if (this.mode === 'sniff' && this.t > this.modeUntil) {
        this.mode = 'stand';
        this.idleT = Math.random() * 1.4; // linger, maybe sit next
      }
    }
    this.heading.rotation.y = this.faceAngle;

    // gait: trot blends into a rotary gallop as Clipper opens up
    this.amp = ease(this.amp, moving ? 0.66 + norm * 0.5 : 0, dt, moving ? 8 : 9);
    this.gallop = ease(this.gallop, norm > 0.55 ? Math.min(1, (norm - 0.55) / 0.35) : 0, dt, 5);
    const a = this.amp, gw = this.gallop;
    const p = this.phase;
    const trot = [Math.sin(p), -Math.sin(p), -Math.sin(p), Math.sin(p)];
    const gal = [Math.sin(p), Math.sin(p - 0.45), Math.sin(p + 2.4), Math.sin(p + 2.85)];
    for (let i = 0; i < 4; i++) {
      const swing = trot[i] * (1 - gw) + gal[i] * 1.12 * gw;
      this.legs[i].rotation.x = swing * a * (0.78 + gw * 0.25);
    }

    // body: smooth bounce, gallop pitch, sit pose
    this.sitP = ease(this.sitP, this.mode === 'sit' ? 1 : 0, dt, this.mode === 'sit' ? 4.5 : 8);
    this.sniffP = ease(this.sniffP, this.mode === 'sniff' ? 1 : 0, dt, 6);
    const bounce = (1 - Math.cos(p * 2)) * 0.5 * a * (0.7 + norm * 1.5);
    this.trunk.position.y = 8 + bounce - this.sitP * 3.4;
    this.trunk.rotation.x = -Math.sin(p + 0.5) * 0.09 * gw * a - this.sitP * 0.48;
    // rear legs fold under when sitting
    this.legs[2].rotation.x += this.sitP * 1.25;
    this.legs[3].rotation.x += this.sitP * 1.25;

    // ears flop against the bounce
    const earTarget = THREE.MathUtils.clamp((bounce - this.prevBounce) * -2.2 / Math.max(dt, 0.001) * 0.016, -0.45, 0.45);
    this.prevBounce = bounce;
    this.earFlop = ease(this.earFlop, earTarget, dt, 10);
    this.earL.rotation.x = -0.12 + this.earFlop;
    this.earR.rotation.x = -0.12 + this.earFlop;

    // head: bob with the gait when moving; watch the kid / sniff when idle
    if (moving) {
      this.lookY = ease(this.lookY, 0, dt, 6);
      this.headGroup.rotation.x = -0.05 + Math.sin(p * 2 + 0.6) * 0.06 * a;
    } else {
      const want = THREE.MathUtils.clamp(
        lerpAngle(0, Math.atan2(dx, dz) - this.faceAngle, 1), -0.75, 0.75);
      this.lookY = ease(this.lookY, dist > 14 ? want : 0, dt, 4);
      this.headGroup.rotation.x = this.sniffP * 0.85 - this.sitP * 0.1
        + Math.sin(this.t * 1.9) * 0.03; // breathing
    }
    this.headGroup.rotation.y = this.lookY;
    this.headGroup.position.z = 14.5 + this.sniffP * 1.5;

    // tail: streams at a run, wags at rest (hardest at a happy sit)
    const tailPitch = moving ? -1.85 - gw * 0.25 : -2.35 - this.sitP * 0.35;
    this.tail.rotation.x = ease(this.tail.rotation.x, tailPitch, dt, 7);
    this.wagPhase += dt * (moving ? 9 + norm * 5 : 7.5 + this.sitP * 3.5);
    const wagAmp = moving ? 0.22 : 0.42 + this.sitP * 0.18 - this.sniffP * 0.2;
    this.tail.rotation.z = Math.sin(this.wagPhase) * wagAmp;
    this.tailTip.rotation.z = Math.sin(this.wagPhase - 0.55) * wagAmp * 0.8;
  }
}
