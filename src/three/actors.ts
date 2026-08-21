import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// The kid and Clipper the dog — soft rounded shapes (capsules, spheres,
// rounded boxes), rigged with two-segment limbs and speed-blended gaits,
// eased starts/stops, banking into turns, and idle life (breathing, blinks,
// sniffs, sits). Units = world px (8 px = 1 m). Models face +z.

// soft PBR skin for the hero actors — a gentle roughness so the rounded forms
// catch a believable terminator + faint highlight from the sun/hemi rig (the flat
// Lambert town reads as facets; this reads as rounded). metalness 0 = no hotspots.
function mat(color: string): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
}

// vertical capsule; pivotTop hangs it from its top tip
function cap(r: number, len: number, color: string, pivotTop = false): THREE.Mesh {
  const g = new THREE.CapsuleGeometry(r, len, 8, 20);
  if (pivotTop) g.translate(0, -(len / 2 + r), 0);
  const m = new THREE.Mesh(g, mat(color));
  m.castShadow = true;
  return m;
}

// capsule lying along +z (bodies, snouts)
function capZ(r: number, len: number, color: string): THREE.Mesh {
  const g = new THREE.CapsuleGeometry(r, len, 8, 20);
  g.rotateX(Math.PI / 2);
  const m = new THREE.Mesh(g, mat(color));
  m.castShadow = true;
  return m;
}

function sph(r: number, color: string, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat(color));
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
  private pack = new THREE.Group();    // worn backpack — hidden until earned (setBackpack)
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

    // Legs. Same hip height and same total kid height as before — the Man at the
    // Wheel and every other monument was scaled against this kid's 36 px, so the
    // OVERALL size is fixed. What changes is the distribution: a knee that actually
    // joins (a filled joint, like the dog's), and a real sneaker instead of one
    // white brick — sole, midsole stripe and a rounded toe.
    const mkLeg = (sx: number): [THREE.Group, THREE.Group] => {
      const thigh = new THREE.Group();
      thigh.position.set(sx * 3.2, 13, 0);
      const thighMesh = cap(2.3, 4.4, JEANS, true);     // longer: reaches past the knee pivot
      const knee = sph(2.05, JEANS, 1, 0.95, 1); knee.position.y = -6.8;
      const shin = new THREE.Group();
      shin.position.set(0, -6.8, 0);
      const shinMesh = cap(1.95, 3.2, JEANS, true);
      const cuffJ = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 1.95, 0.9, 14), mat('#33445e'));
      cuffJ.position.y = -5.2;                          // jean hem over the shoe
      const shoe = new THREE.Group(); shoe.position.set(0, -5.6, 1.0);
      const upperS = rbox(4.2, 2.0, 6.0, 1.0, '#f2efe6');       // canvas upper
      upperS.position.y = 0.55;
      const toeCap = sph(1.9, '#f7f5ee', 1.05, 0.7, 0.9); toeCap.position.set(0, 0.35, 2.5);
      const sole = rbox(4.5, 1.0, 6.4, 0.45, '#d9d4c6');        // rubber sole, proud of the upper
      sole.position.y = -0.7;
      const stripe = rbox(4.35, 0.5, 6.2, 0.24, '#b03a32');     // a red midsole flash
      stripe.position.y = -0.15;
      shoe.add(sole, stripe, upperS, toeCap);
      shin.add(shinMesh, cuffJ, shoe);
      thigh.add(thighMesh, knee, shin);
      return [thigh, shin];
    };
    [this.thighL, this.shinL] = mkLeg(-1);
    [this.thighR, this.shinR] = mkLeg(1);

    // crimson hoodie: a softly tapered torso (fuller chest, trimmer waist) reads more
    // like a body than a barrel; a chest cap fills the shoulders, hood bump at the back,
    // kangaroo pocket up front, and a short skin neck so the head sits ON the shoulders
    const HOOD_DK = '#922f29';
    const body = cap(4.4, 5.4, '#b03a32');
    body.scale.set(1.14, 1.06, 0.82);
    body.position.y = 18.6;
    const chest = sph(4.2, '#b03a32', 1.08, 0.92, 0.82);
    chest.position.set(0, 22.2, 0.2);
    const hood = sph(2.9, HOOD_DK, 1.55, 0.66, 1);
    hood.position.set(0, 24.8, -3.7);
    const pocket = rbox(6.4, 3.2, 1.4, 0.6, HOOD_DK);
    pocket.position.set(0, 15.4, 3.7);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 2.2, 3.3, 16), mat(SKIN));
    neck.position.set(0, 24.9, 0);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 3.05, 1.7, 16), mat(HOOD_DK));
    collar.position.set(0, 24.0, 0);
    // shoulder caps blend the sleeves into the torso (no gap at the arm root) — kept
    // small so the kid stays slight, not buff
    const shoulder = (sx: number) => { const s = sph(1.8, SLEEVE, 0.95, 0.95, 1); s.position.set(sx * 5.0, 23.4, 0); return s; };

    // head on a neck pivot so it can stay level and glance around; eased down from the
    // old chibi ratio (slightly smaller skull + the real neck below) so the kid reads
    // less like a big-headed toy and more like a person
    this.headGrp.position.y = 28.4;
    this.headGrp.scale.setScalar(0.84);            // was 0.92 — a smaller skull on the
    // same neck reads years older and much less chibi. Total height stays ~36 px
    // because the head group also moved up 0.4; the monuments' scale reference holds.
    const head = sph(5.0, SKIN, 1, 1.0, 0.95);
    head.position.y = 3;
    const jaw = sph(3.5, SKIN, 0.94, 0.78, 0.95);  // a chin/jaw so the head isn't a ball
    jaw.position.set(0, 0.5, 0.5);
    // HAIR — the old version was one smooth flattened sphere: a plastic helmet with a
    // hard rim against the skin. Now it's a cap plus a swept fringe, a side part, side
    // tufts over the ears and a nape tuft, so the silhouette breaks up and reads as hair.
    const hair = sph(5.3, HAIR, 1.02, 0.7, 1.02);
    hair.position.y = 5.5;
    // the fringe sits ON the forehead, ABOVE the brows. The first pass put it at
    // y4.5 with a half-height of 1.85 — it spanned straight down across the eyes at
    // y3.05 and buried the whole face in a dark visor.
    const fringe = sph(4.3, HAIR, 1.06, 0.34, 0.62);
    fringe.position.set(0.55, 5.6, 3.1); fringe.rotation.z = -0.16;
    const part = sph(2.0, HAIR, 0.7, 0.4, 0.9);          // the tuft the part throws up
    part.position.set(-2.2, 7.0, 1.4); part.rotation.z = 0.4;
    const sideTuft = (sx: number) => { const s = sph(1.5, HAIR, 0.6, 1.15, 0.95); s.position.set(sx * 4.5, 3.5, 0.6); return s; };
    const nape = sph(3.2, HAIR, 1.0, 0.72, 0.62); nape.position.set(0, 2.4, -3.9);
    const ear = (sx: number) => { const e = sph(0.95, SKIN, 0.45, 1.15, 0.85); e.position.set(sx * 4.75, 2.6, 0.2); return e; };
    // eyes: smaller and set INTO the face under a lid, not glossy beads stuck on it
    this.eyeL = sph(0.66, '#2c2622');
    this.eyeR = sph(0.66, '#2c2622');
    this.eyeL.position.set(-1.95, 3.05, 4.35);
    this.eyeR.position.set(1.95, 3.05, 4.35);
    // catchlights — tiny white glints that make the eyes feel alive (blink with them)
    for (const e of [this.eyeL, this.eyeR]) { const g = sph(0.23, '#ffffff'); g.position.set(-0.24, 0.28, 0.5); e.add(g); }
    const lid = (sx: number) => { const l = sph(0.86, SKIN, 1, 0.5, 0.75); l.position.set(sx * 1.95, 3.62, 4.3); return l; };
    // a friendly face: soft brows, a button nose, a little smile, rosy cheeks
    const brow = (sx: number) => { const b = rbox(1.95, 0.5, 0.55, 0.22, HAIR); b.position.set(sx * 1.95, 4.35, 4.25); b.rotation.z = sx * 0.12; return b; };
    const knose = sph(0.58, '#e3a878', 1, 0.86, 1); knose.position.set(0, 2.3, 4.95);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.2, 6, 12, Math.PI), mat('#8a4b40'));
    smile.rotation.z = Math.PI; smile.position.set(0, 1.2, 4.5);
    const cheek = (sx: number) => { const c = sph(0.9, '#e89a86', 1, 0.62, 0.42); c.position.set(sx * 3.05, 1.8, 4.0); const m = c.material as THREE.MeshStandardMaterial; m.transparent = true; m.opacity = 0.55; return c; };
    this.headGrp.add(head, jaw, hair, fringe, part, sideTuft(-1), sideTuft(1), nape,
      ear(-1), ear(1), this.eyeL, this.eyeR, lid(-1), lid(1),
      brow(-1), brow(1), knose, smile, cheek(-1), cheek(1));

    const mkArm = (sx: number): [THREE.Group, THREE.Group] => {
      const upper = new THREE.Group();
      upper.position.set(sx * 5.5, 24, 0);
      const upperMesh = cap(1.55, 4.4, SLEEVE, true);   // reaches past the elbow pivot
      const elbow = sph(1.42, SLEEVE, 1, 0.95, 1); elbow.position.y = -6.8;
      upper.add(elbow);
      const fore = new THREE.Group();
      fore.position.set(0, -6.8, 0);
      const foreMesh = cap(1.4, 3.4, SLEEVE, true);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.42, 1.0, 14), mat('#8f2f28'));
      cuff.position.set(0, -5.7, 0);
      // a real little hand: rounded palm + a thumb + closed fingers, not a bare ball
      const hand = new THREE.Group();
      hand.position.set(0, -6.5, 0.2);
      const palm = sph(1.25, SKIN, 1, 1.08, 0.82);
      const fingers = rbox(2.1, 1.35, 1.6, 0.65, SKIN); fingers.position.set(0, -1.1, 0.15);
      const thumb = cap(0.48, 0.5, SKIN); thumb.position.set(sx * 0.95, -0.15, 0.45); thumb.rotation.set(-0.3, 0, sx * 0.8);
      hand.add(palm, fingers, thumb);
      fore.add(foreMesh, cuff, hand);
      upper.add(upperMesh, fore);
      return [upper, fore];
    };
    [this.upperL, this.foreL] = mkArm(-1);
    [this.upperR, this.foreR] = mkArm(1);

    // a little backpack — worn once the player earns it (Kid.setBackpack), so the 🎒
    // you carry shows on your back. Amber/gold to echo the gold-ringed bag button and
    // pop against the crimson hoodie; brown straps over the shoulders sell it from the
    // front too. Sits on the torso's back (-z) so it rides + bobs with the body.
    const PACK = '#c2912f', PACK_DK = '#9c6f24', STRAP = '#5f4a2a', BUCKLE = '#e8c44f';
    const packBody = rbox(8.6, 10, 4.2, 1.5, PACK);   packBody.position.set(0, 18.4, -5.2);
    const packLid = rbox(9, 3.6, 4.6, 1.4, PACK_DK);  packLid.position.set(0, 22.2, -5.0);
    const packPocket = rbox(5.6, 4.6, 1.6, 1, PACK_DK); packPocket.position.set(0, 16.6, -7.4);
    const buckle = rbox(2.4, 1.1, 0.8, 0.4, BUCKLE);  buckle.position.set(0, 18.2, -8.3);
    const strap = (sx: number) => { const s = rbox(1.7, 11.5, 1.5, 0.7, STRAP); s.position.set(sx * 2.9, 19.4, 3.6); s.rotation.z = sx * 0.05; return s; };
    const overShoulder = (sx: number) => { const s = rbox(1.7, 1.6, 7.4, 0.7, STRAP); s.position.set(sx * 2.9, 24.6, 0); return s; };
    this.pack.add(packBody, packLid, packPocket, buckle, strap(-1), strap(1), overShoulder(-1), overShoulder(1));
    this.pack.visible = false;

    this.bodyGroup.add(body, chest, neck, collar, hood, pocket, shoulder(-1), shoulder(1), this.pack, this.headGrp, this.upperL, this.upperR);
    this.tilt.add(this.thighL, this.thighR, this.bodyGroup);
    this.bank.add(this.tilt);
    this.heading.add(this.bank);
    this.heading.rotation.y = this.faceAngle;
    this.root.add(this.heading, blobShadow(9));
  }

  // show/hide the worn backpack (earned via the 🎒). Idempotent — Game pushes this
  // every frame from hud.hasBackpack().
  setBackpack(_on: boolean) { /* a dog carries nothing — see constructor */ }

  private barkT = 0;
  private forceSniff = false;
  private collarMesh!: THREE.Mesh;
  private digP = 0;
  private diggingNow = false;
  private swimP = 0;
  private swimmingNow = false;
  private shakeT = 0;
  // 🛹 skating: rideP eases the stance in; pushLeft > 0 means a hind leg is
  // kicking the ground; nextPushAt schedules the next kick while cruising
  private rideP = 0;
  private skating = false;
  private pushLeft = 0;
  private pushPhase = 0;
  private nextPushAt = 0;
  private skateBank = 0;

  /** 🏊 dog-paddle: Game flips this the moment Clipper is in water */
  setSwimming(on: boolean) { this.swimmingNow = on; }

  /** the full-body wet-dog shake, fired as he climbs out */
  shake() { this.shakeT = 0.9; }

  /** the identity-neutral customization: your dog, your collar */
  setCollar(hex: string) { (this.collarMesh.material as THREE.MeshStandardMaterial).color.set(hex); }

  /** front paws flying — Game decides when a held sniff becomes a dig */
  setDigging(on: boolean) { this.diggingNow = on; }

  /** one bark: head thrown up, ears perked — the sound is the caller's job */
  bark() { this.barkT = 0.38; }

  /** hold-to-sniff: nose goes down and STAYS down, walking or not */
  setSniffing(on: boolean) { this.forceSniff = on; }

  /** snap the facing (no lerp) — race starts point the rider down-course */
  face(az: number) {
    this.prevFace = this.faceAngle = az;
    this.heading.rotation.y = az;
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

// the free-roam sea kayak (Level 2): a long red box-built hull with gunwales,
// pointed bow/stern, an open cockpit, and a stowed paddle. Faces +z; the kid sits
// in the cockpit. Shared by the kayak you ride AND the one tied at the Joppa slip,
// so they're always the same boat. The caller adds it to the scene.
// 🛹 Clipper's skateboard. Same contract as Bike (root + update(dt, speed,
// heading)) so Game can hold either. Four wheels spin with ground speed; the
// deck banks into turns, worked out from its own heading change so nothing
// upstream has to know about it. A dog on a skateboard is a real thing kids
// already know (Tillman, Otto) — a hoverboard would have broken the "real town,
// real dog" spell.
export class Skateboard {
  root = new THREE.Group();
  private wheels: THREE.Mesh[] = [];
  private deck = new THREE.Group();
  private prevHeading = 0;
  private bank = 0;

  constructor() {
    const DECK = '#c98a3c', GRIP = '#2b2b2e', TRUCK = '#c9cdd2', WHEEL = '#efe7c8';
    const board = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.1, 26), new THREE.MeshLambertMaterial({ color: DECK }));
    board.position.y = 4.2; board.castShadow = true;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.3, 24), new THREE.MeshLambertMaterial({ color: GRIP }));
    grip.position.y = 4.9;
    // kicked nose and tail
    const kick = (z: number) => {
      const k = new THREE.Mesh(new THREE.BoxGeometry(8.4, 1.1, 4.5), new THREE.MeshLambertMaterial({ color: DECK }));
      k.position.set(0, 4.9, z); k.rotation.x = z > 0 ? -0.42 : 0.42; k.castShadow = true; return k;
    };
    const truck = (z: number) => {
      const t = new THREE.Mesh(new THREE.BoxGeometry(7.8, 1.2, 1.4), new THREE.MeshLambertMaterial({ color: TRUCK }));
      t.position.set(0, 2.8, z); return t;
    };
    const wheel = (x: number, z: number) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 1.6, 12).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: WHEEL }));
      w.position.set(x, 1.9, z); w.castShadow = true; this.wheels.push(w); return w;
    };
    this.deck.add(board, grip, kick(13.5), kick(-13.5), truck(8.5), truck(-8.5),
      wheel(-4.2, 8.5), wheel(4.2, 8.5), wheel(-4.2, -8.5), wheel(4.2, -8.5));
    this.root.add(this.deck);
  }

  update(dt: number, speed: number, heading: number) {
    this.root.rotation.y = heading;
    for (const w of this.wheels) w.rotation.x -= (speed * dt) / 1.9;
    // lean into the turn: how fast the heading is swinging, eased
    const turn = dt > 0 ? lerpAngle(0, heading - this.prevHeading, 1) / dt : 0;
    this.prevHeading = heading;
    this.bank = ease(this.bank, THREE.MathUtils.clamp(-turn * 0.09, -0.32, 0.32) * Math.min(1, speed / 200), dt, 7);
    this.deck.rotation.z = this.bank;
  }
}

export function buildKayak(): THREE.Group {
  const R = new THREE.Group();
  const RED = '#d8533a', RED2 = '#bf4630', DARK = '#2e2f28';
  const b = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: hex }));
    m.position.set(x, y, z);
    m.castShadow = true;
    R.add(m);
  };
  b(16, 4, 56, 0, 2.6, 0, RED);          // hull bottom
  b(2, 6.5, 54, -7.7, 5.4, 0, RED2);     // left gunwale
  b(2, 6.5, 54, 7.7, 5.4, 0, RED2);      // right gunwale
  b(11, 6.5, 10, 0, 5.4, 29, RED);       // bow shoulder
  b(5, 6.5, 10, 0, 5.4, 36, RED2);       // pointed bow tip
  b(11, 6.5, 10, 0, 5.4, -29, RED);      // stern shoulder
  b(5, 6.5, 10, 0, 5.4, -36, RED2);      // pointed stern tip
  b(13, 1.8, 22, 0, 6.8, -3, DARK);      // cockpit coaming (the kid sits here)
  const paddle = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 52), new THREE.MeshLambertMaterial({ color: '#caa46a' }));
  paddle.position.set(0, 9.5, 1);
  paddle.rotation.y = 0.42;
  paddle.rotation.z = 0.26;
  R.add(paddle);
  return R;
}

export class Dog {
  root = new THREE.Group();
  private heading = new THREE.Group();
  private trunk = new THREE.Group();   // pivots at the rear hips (sit, gallop pitch)
  private headGroup = new THREE.Group();
  private earL: THREE.Group;
  private earR: THREE.Group;
  private legs: THREE.Group[] = [];    // upper legs (swing): LF, RF, LR, RR
  private shins: THREE.Group[] = [];   // lower legs (fold at knee/hock)
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

  constructor(fur = '#cda169', scale = 1) {
    const c = new THREE.Color(fur);
    const darker = '#' + c.clone().multiplyScalar(0.84).getHexString();
    const darkest = '#' + c.clone().multiplyScalar(0.72).getHexString();
    // COUNTERSHADING — dark along the back, pale under the chin, chest, belly and
    // legs. Every real dog has it, and it does more for "this is an animal" than any
    // amount of extra geometry: a uniformly-coloured body always reads as a plush toy.
    const lightest = '#' + c.clone().lerp(new THREE.Color('#ffffff'), 0.42).getHexString();
    const backDk = '#' + c.clone().multiplyScalar(0.78).getHexString();

    // trunk pivot sits at the rear hips: (0, 8, -6.5) in heading space
    this.trunk.position.set(0, 8, -6.5);
    const body = capZ(4.1, 8.6, fur);
    body.position.set(0, 3, 6.5);
    body.scale.set(1.08, 0.94, 1);
    const chest = sph(4.2, darker, 0.96, 0.98, 0.92);   // deep brisket
    chest.position.set(0, 1.9, 11.0);
    const rump = sph(3.9, fur, 0.98, 0.95, 0.92);
    rump.position.set(0, 2.9, 1);
    // a scruffy neck rising to the head + muscle over the shoulders and haunches, so
    // the body has anatomy (withers, brisket, thighs) instead of reading as one loaf
    const neck = capZ(2.9, 2.6, fur);
    neck.position.set(0, 4.2, 12.0); neck.rotation.x = -0.5;
    const withers = sph(3.0, fur, 1.0, 0.95, 1.1);
    withers.position.set(0, 4.6, 8.2);
    const haunch = (sx: number) => { const h = sph(2.7, fur, 0.92, 1.0, 1.1); h.position.set(sx * 2.7, 3.2, -2.0); return h; };
    const shoulder = (sx: number) => { const s = sph(2.3, fur, 0.9, 1.0, 1.05); s.position.set(sx * 2.9, 2.6, 9.0); return s; };
    // the countershading itself: a dark saddle down the spine, a pale belly and bib
    const saddle = capZ(3.5, 8.0, backDk);
    saddle.position.set(0, 4.4, 6.5); saddle.scale.set(1.0, 0.5, 1);
    const belly = capZ(3.2, 7.4, lightest);
    belly.position.set(0, 0.9, 6.6); belly.scale.set(0.94, 0.5, 1);
    const bib = sph(2.5, lightest, 0.85, 1.0, 0.7);
    bib.position.set(0, 1.1, 12.2);

    // head on a neck pivot (looks at the kid, sniffs the ground)
    this.headGroup.position.set(0, 6, 14.5);
    const head = sph(4.15, fur, 0.95, 1, 0.95);
    head.position.set(0, 1.5, 2.5);
    const skull = sph(3.1, fur, 1.06, 0.95, 1.0);    // rounder cranium above the eyes
    skull.position.set(0, 3.2, 1.4);
    const muzzleBridge = capZ(1.35, 1.4, fur);        // forehead-to-snout bridge (a real stop)
    muzzleBridge.position.set(0, 1.0, 4.7);
    // muzzle in the SAME fur as the head — the old darker snout drew a hard seam across
    // the face. Countershading does the shaping instead: a pale chin/underjaw below.
    const snout = capZ(1.72, 3.8, fur);
    snout.position.set(0, -0.3, 7.2);
    const underjaw = capZ(1.2, 3.2, lightest);
    underjaw.position.set(0, -1.3, 7.3);
    const nose = sph(0.9, '#2b2420', 1.12, 0.9, 0.85);
    nose.position.set(0, 0.3, 9.8);
    // eyes: smaller, SET INTO the skull rather than stuck on it, under a brow ridge and
    // a lid. Big glossy spheres on the surface were the single most toy-like thing here.
    const eyeL = sph(0.56, '#2a2320');
    const eyeR = sph(0.56, '#2a2320');
    eyeL.position.set(-1.9, 2.6, 5.25);
    eyeR.position.set(1.9, 2.6, 5.25);
    for (const e of [eyeL, eyeR]) { const g = sph(0.19, '#ffffff'); g.position.set(-0.16, 0.24, 0.42); e.add(g); }
    const lid = (sx: number) => { const l = sph(0.72, fur, 1, 0.5, 0.8); l.position.set(sx * 1.9, 3.16, 5.15); return l; };
    const browSpot = (sx: number) => { const b = sph(0.42, lightest, 1.2, 0.5, 0.8); b.position.set(sx * 1.85, 3.6, 4.5); return b; };
    // a happy lolling tongue hanging from the mouth
    const tongue = rbox(1.3, 0.42, 2.2, 0.38, '#e07f88');
    tongue.position.set(0, -1.65, 7.9); tongue.rotation.x = 0.55;
    // ears: proper retriever flaps — big, soft, hung from the side of the skull and
    // falling PAST the jaw. The old ones were thumbnail-sized tabs on top of the head.
    const mkEar = (sx: number): THREE.Group => {
      const grp = new THREE.Group();
      grp.position.set(sx * 3.05, 4.9, 2.2);
      const flap = sph(2.5, darkest, 0.42, 1.5, 0.9);
      flap.position.set(sx * 0.25, -2.7, -0.2);
      const tip = sph(1.5, darkest, 0.42, 1.0, 0.85);
      tip.position.set(sx * 0.4, -5.1, -0.4);
      grp.add(flap, tip);
      grp.rotation.z = sx * 0.2;
      return grp;
    };
    this.earL = mkEar(-1);
    this.earR = mkEar(1);
    this.headGroup.add(head, skull, muzzleBridge, snout, underjaw, nose, eyeL, eyeR,
      lid(-1), lid(1), browSpot(-1), browSpot(1), this.earL, this.earR, tongue);

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
    this.collarMesh = collar;
    const tag = sph(0.7, '#e8c44f'); tag.position.set(0, 0.9, 13.1);
    this.trunk.add(body, chest, rump, neck, withers, saddle, belly, bib,
      haunch(-1), haunch(1), shoulder(-1), shoulder(1), this.headGroup, this.tail, collar, tag);

    // legs stay under the heading so the trunk can pitch without lifting paws. Each leg
    // is two segments: an upper that swings from the shoulder/hip + a lower shank that
    // folds at the knee/hock on the recovery, so the gait articulates instead of swinging
    // stiff pegs. Rear legs are a touch sturdier than the front.
    //
    // THE JOINTS ARE THE WHOLE GAME. The first build hung a capsule from the hip, then
    // parked the shank 1.6 px below where the upper ended — so every leg read as a
    // stack of loose balloons with daylight between them, which is what made the dog
    // look inflatable rather than alive. Now the upper reaches PAST the knee pivot and
    // a joint sphere sits on the pivot itself, so the limb is one continuous taper.
    const legPos: [number, number, boolean][] = [
      [-3.2, 7.0, true], [3.2, 7.0, true],     // front (LF, RF)
      [-3.4, -6.4, false], [3.4, -6.4, false], // rear (LR, RR)
    ];
    for (const [lx, lz, front] of legPos) {
      const leg = new THREE.Group();
      leg.position.set(lx, 8, lz);
      const rU = front ? 1.5 : 1.68;
      // upper: long enough that its bottom tip overshoots the knee pivot at -4.0
      const upper = cap(rU, 3.0, fur, true);
      // shoulder/haunch cap, filling the top of the limb into the body
      const capTop = sph(rU * 1.12, fur, 1, 0.95, 1);
      const knee = sph(front ? 1.35 : 1.5, fur, 1, 1.02, 1);   // sits ON the pivot
      knee.position.y = -4.0;
      const shin = new THREE.Group();
      shin.position.set(0, -4.0, 0);
      const rS = front ? 1.22 : 1.34;
      const shinMesh = cap(rS, 2.4, fur, true);
      const ankle = sph(rS * 1.05, fur); ankle.position.y = -3.5;
      // paw: a rounded pad plus three toes, so it stops being a brick
      const paw = new THREE.Group(); paw.position.set(0, -3.6, 0.55);
      const pad = rbox(2.5, 1.5, 3.0, 0.7, fur);
      for (const tx of [-0.72, 0, 0.72]) { const toe = sph(0.55, fur, 1, 0.8, 1.25); toe.position.set(tx, -0.28, 1.55); paw.add(toe); }
      paw.add(pad);
      shin.add(shinMesh, ankle, paw);
      leg.add(capTop, upper, knee, shin);
      this.legs.push(leg);
      this.shins.push(shin);
      this.heading.add(leg);
    }

    this.heading.add(this.trunk);
    this.heading.rotation.y = this.faceAngle;
    // (no saddle bags: the kid's earned 🎒 has no dog edition — Devin: "we dont
    // need them". setBackpack() stays a no-op so the shared player contract holds.)

    this.root.add(this.heading, blobShadow(7));
    // Clipper as the PLAYER stands a touch taller than he did at heel — presence
    // next to 36 px townsfolk — without touching any gait or collision numbers.
    this.root.scale.setScalar(scale);
  }

  // face a fixed heading without walking (e.g. seated in the boat): drives the same
  // heading group Dog.update turns, and clears any leftover root spin so it doesn't
  // stack on top of the body's facing
  faceTo(angle: number) {
    this.faceAngle = angle;
    this.heading.rotation.y = angle;
    this.root.rotation.y = 0;
  }

  /** snap the facing (no lerp) — same contract as Kid.face */
  face(az: number) { this.faceTo(az); }

  get facing(): number { return this.faceAngle; }

  setPos(x: number, z: number) {
    this.root.position.x = x;
    this.root.position.z = z; // y managed by Game (bridge decks/docks)
  }

  setBackpack(_on: boolean) { /* a dog carries nothing — see constructor */ }

  private barkT = 0;
  private forceSniff = false;
  private collarMesh!: THREE.Mesh;
  private digP = 0;
  private diggingNow = false;
  private swimP = 0;
  private swimmingNow = false;
  private shakeT = 0;
  // 🛹 skating: rideP eases the stance in; pushLeft > 0 means a hind leg is
  // kicking the ground; nextPushAt schedules the next kick while cruising
  private rideP = 0;
  private skating = false;
  private pushLeft = 0;
  private pushPhase = 0;
  private nextPushAt = 0;
  private skateBank = 0;

  /** 🏊 dog-paddle: Game flips this the moment Clipper is in water */
  setSwimming(on: boolean) { this.swimmingNow = on; }

  /** the full-body wet-dog shake, fired as he climbs out */
  shake() { this.shakeT = 0.9; }

  /** the identity-neutral customization: your dog, your collar */
  setCollar(hex: string) { (this.collarMesh.material as THREE.MeshStandardMaterial).color.set(hex); }

  /** front paws flying — Game decides when a held sniff becomes a dig */
  setDigging(on: boolean) { this.diggingNow = on; }

  /** one bark: head thrown up, ears perked — the sound is the caller's job */
  bark() { this.barkT = 0.38; }

  /** hold-to-sniff: nose goes down and STAYS down, walking or not */
  setSniffing(on: boolean) { this.forceSniff = on; }

  /** 🐕 PLAYER MODE — the same contract as Kid.update, so Game can drive either.
   *  Velocity in, gait out; the follower brain in follow() is untouched. Mounted
   *  (bike/kayak) Clipper sits — haunches down, tail going — and the vehicle moves. */
  update(dt: number, vx: number, vz: number, _sprinting: boolean, riding = false, boating = false) {
    this.t += dt;
    const speed = Math.hypot(vx, vz);
    const mounted = riding || boating;
    const moving = speed > 6 && !mounted;
    const norm = Math.min(1.2, speed / 300);
    this.skating = riding;
    if (riding) {
      // 🛹 ON THE BOARD. Front paws stay planted on the deck. A hind leg kicks
      // the ground to get going (~1.1 s of pushes from a standstill), then all
      // four hop on and he coasts — with a fresh kick every few seconds to keep
      // the speed up, the way a real skating dog does. Stopped: one hind paw
      // rests on the ground beside the board.
      const prevFace = this.faceAngle;
      if (speed > 1) this.faceAngle = lerpAngle(this.faceAngle, Math.atan2(vx, vz), Math.min(1, dt * 10));
      const turn = dt > 0 ? lerpAngle(0, this.faceAngle - prevFace, 1) / dt : 0;
      this.skateBank = ease(this.skateBank, THREE.MathUtils.clamp(-turn * 0.1, -0.3, 0.3), dt, 6);
      const rest = Math.round(this.phase / Math.PI) * Math.PI;
      this.phase = ease(this.phase, rest, dt, 9);
      if (speed > 20) {
        if (this.nextPushAt === 0) { this.pushLeft = 1.1; this.nextPushAt = this.t + 1.1 + 2.4; }   // pushing off
        else if (this.t >= this.nextPushAt) { this.pushLeft = 0.55; this.nextPushAt = this.t + 2.4 + Math.random() * 1.4; }
        if (this.pushLeft > 0) { this.pushLeft -= dt; this.pushPhase += dt * 9; }
      } else {
        this.nextPushAt = 0; this.pushLeft = 0;
      }
      this.mode = 'stand';
      this.idleT = 0;
    } else if (mounted) {
      if (speed > 1) this.faceAngle = lerpAngle(this.faceAngle, Math.atan2(vx, vz), Math.min(1, dt * 12));
      const rest = Math.round(this.phase / Math.PI) * Math.PI;
      this.phase = ease(this.phase, rest, dt, 9);
      this.mode = 'sit';
      this.idleT = 0;
      this.nextPushAt = 0;
    } else if (moving) {
      this.faceAngle = lerpAngle(this.faceAngle, Math.atan2(vx, vz), Math.min(1, dt * 12));
      this.phase += dt * (6.5 + speed * 0.042);
      this.idleT = 0;
      this.mode = this.forceSniff && !this.swimmingNow ? 'sniff' : 'stand';
    } else if (this.swimmingNow) {
      this.nextPushAt = 0;
      // treading water: no sit, no sniff, just the paddle ticking over
      const rest = Math.round(this.phase / Math.PI) * Math.PI;
      this.phase = ease(this.phase, rest, dt, 9);
      this.mode = 'stand';
      this.idleT = 0;
    } else if (this.forceSniff) {
      const rest = Math.round(this.phase / Math.PI) * Math.PI;
      this.phase = ease(this.phase, rest, dt, 9);
      this.mode = 'sniff';
      this.modeUntil = this.t + 99;
      this.idleT = 0;
    } else {
      const rest = Math.round(this.phase / Math.PI) * Math.PI;
      this.phase = ease(this.phase, rest, dt, 9);
      this.idleT += dt;
      // stand a moment and Clipper gets comfortable: sniff around, or sit
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
        this.idleT = Math.random() * 1.4;
      }
    }
    this.pose(dt, moving, norm, 0, 0, 0);
  }

  // follows a target point (behind-left of the kid); no collision — dogs weave.
  // Companion brain (legacy ?kid mode) — the PLAYER path is update() above.
  follow(dt: number, targetX: number, targetZ: number) {
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
    this.pose(dt, moving, norm, dx, dz, dist);
  }

  // one body, two brains: everything below is pure pose, shared by the driven
  // player and the heel-following companion. watch* = a point to glance at when
  // idle (the kid, in companion mode); pass zeros to just look around.
  private pose(dt: number, moving: boolean, norm: number, watchDx: number, watchDz: number, watchDist: number) {
    this.heading.rotation.y = this.faceAngle;

    // gait: trot blends into a rotary gallop as Clipper opens up
    this.amp = ease(this.amp, moving ? 0.66 + norm * 0.5 : 0, dt, moving ? 8 : 9);
    this.gallop = ease(this.gallop, norm > 0.55 ? Math.min(1, (norm - 0.55) / 0.35) : 0, dt, 5);
    const a = this.amp, gw = this.gallop;
    const p = this.phase;
    const trot = [Math.sin(p), -Math.sin(p), -Math.sin(p), Math.sin(p)];
    const gal = [Math.sin(p), Math.sin(p - 0.45), Math.sin(p + 2.4), Math.sin(p + 2.85)];
    const trotPh = [p, p + Math.PI, p + Math.PI, p];
    const galPh = [p, p - 0.45, p + 2.4, p + 2.85];
    for (let i = 0; i < 4; i++) {
      const swing = trot[i] * (1 - gw) + gal[i] * 1.12 * gw;
      this.legs[i].rotation.x = swing * a * (0.78 + gw * 0.25);
      // shank folds during the lift/recovery (knee for the front, hock for the rear)
      const ph = trotPh[i] * (1 - gw) + galPh[i] * gw;
      this.shins[i].rotation.x = Math.max(0, Math.sin(ph - 0.7)) * a * (0.72 + gw * 0.6);
    }

    // body: smooth bounce, gallop pitch, sit pose
    this.sitP = ease(this.sitP, this.mode === 'sit' ? 1 : 0, dt, this.mode === 'sit' ? 4.5 : 8);
    this.sniffP = ease(this.sniffP, this.mode === 'sniff' ? 1 : 0, dt, 6);
    const bounce = (1 - Math.cos(p * 2)) * 0.5 * a * (0.7 + norm * 1.5);
    this.trunk.position.y = 8 + bounce - this.sitP * 3.4;
    this.trunk.rotation.x = -Math.sin(p + 0.5) * 0.09 * gw * a - this.sitP * 0.48;
    // rear legs tuck under when sitting: thigh swings forward, hock folds deep so the
    // haunches drop onto the ground; front legs stay propped straight
    this.legs[2].rotation.x += this.sitP * 1.0;
    this.legs[3].rotation.x += this.sitP * 1.0;
    this.shins[2].rotation.x += this.sitP * 1.7;
    this.shins[3].rotation.x += this.sitP * 1.7;

    // 🕳 digging: the front paws alternate in a fast scratch, rump up, nose right
    // down at the hole. Blended over whatever the gait was doing so it eases in.
    this.digP = ease(this.digP, this.diggingNow ? 1 : 0, dt, this.diggingNow ? 7 : 9);
    if (this.digP > 0.01) {
      const dp = this.t * 15;
      const f0 = 0.55 + Math.sin(dp) * 0.7, f1 = 0.55 + Math.sin(dp + Math.PI) * 0.7;
      this.legs[0].rotation.x = this.legs[0].rotation.x * (1 - this.digP) + f0 * this.digP;
      this.legs[1].rotation.x = this.legs[1].rotation.x * (1 - this.digP) + f1 * this.digP;
      this.shins[0].rotation.x = this.shins[0].rotation.x * (1 - this.digP) + Math.max(0, Math.sin(dp - 0.9)) * 0.9 * this.digP;
      this.shins[1].rotation.x = this.shins[1].rotation.x * (1 - this.digP) + Math.max(0, Math.sin(dp + Math.PI - 0.9)) * 0.9 * this.digP;
      this.trunk.rotation.x += this.digP * 0.26;      // rump up over the work
      this.headGroup.rotation.x += this.digP * 0.35;  // nose in the hole
      this.wagPhase += dt * 6 * this.digP;            // the tail cannot believe its luck
    }

    // 🏊 the dog-paddle: body level and low, all four legs churning in a rolling
    // sequence, head held up out of the water, ears back, tail flat on the surface,
    // the whole dog bobbing on the swell. Game lowers the root so the belly is under.
    this.swimP = ease(this.swimP, this.swimmingNow ? 1 : 0, dt, 6);
    if (this.swimP > 0.01) {
      const sp = this.t * 9.5, w = this.swimP;
      for (let i = 0; i < 4; i++) {
        const paddle = Math.sin(sp + i * 1.6) * 0.55;
        this.legs[i].rotation.x = this.legs[i].rotation.x * (1 - w) + paddle * w;
        this.shins[i].rotation.x = this.shins[i].rotation.x * (1 - w) + (0.7 + Math.max(0, Math.sin(sp + i * 1.6 - 1.2)) * 0.5) * w;
      }
      this.trunk.position.y += Math.sin(this.t * 2.6) * 0.7 * w;   // the swell
      // chest-deep: the FRONT end rides high — nose up, rump down — so the head,
      // the paddling front paws and the tail break the surface while the belly
      // and hind legs stay under. Nothing walks on water.
      this.trunk.rotation.x -= 0.34 * w;                            // nose up, rump down
      this.headGroup.rotation.x -= 0.55 * w;                        // chin well clear
      this.earL.rotation.x += 0.45 * w;                             // ears pinned back
      this.earR.rotation.x += 0.45 * w;
      this.legs[0].rotation.x += 0.5 * w;                            // front paws reach forward, breaking the surface
      this.legs[1].rotation.x += 0.5 * w;
      this.tail.rotation.x = this.tail.rotation.x * (1 - w) + (-2.35) * w;   // tail UP like a flag, clear of the water
    }

    // 🛹 the skate stance. Crouched a touch, front paws planted forward on the
    // deck; hind legs either both on (coasting), one kicking (pushing), or one
    // resting on the ground (stopped). Leans into the bank the board is carving.
    this.rideP = ease(this.rideP, this.skating ? 1 : 0, dt, this.skating ? 7 : 9);
    if (this.rideP > 0.01) {
      const w = this.rideP;
      const pushing = this.pushLeft > 0;
      const kick = pushing ? (Math.sin(this.pushPhase) * 0.5 + 0.5) : 0;      // 0 = forward, 1 = swept back
      const stopped = this.nextPushAt === 0;
      this.trunk.position.y -= 1.4 * w;
      this.trunk.rotation.x -= 0.06 * w;
      this.legs[0].rotation.x = this.legs[0].rotation.x * (1 - w) + 0.28 * w;   // front paws planted, set forward
      this.legs[1].rotation.x = this.legs[1].rotation.x * (1 - w) + 0.28 * w;
      this.shins[0].rotation.x = this.shins[0].rotation.x * (1 - w) + 0.18 * w;
      this.shins[1].rotation.x = this.shins[1].rotation.x * (1 - w) + 0.18 * w;
      // left hind leg is the pusher; right hind stays on the deck
      const pushLeg = pushing ? 0.75 - kick * 1.55 : stopped ? 0.55 : -0.05;
      this.legs[2].rotation.x = this.legs[2].rotation.x * (1 - w) + pushLeg * w;
      this.shins[2].rotation.x = this.shins[2].rotation.x * (1 - w) + (pushing ? 0.25 + kick * 0.35 : stopped ? 0.5 : 0.12) * w;
      this.legs[3].rotation.x = this.legs[3].rotation.x * (1 - w) + (-0.05) * w;
      this.shins[3].rotation.x = this.shins[3].rotation.x * (1 - w) + 0.12 * w;
      this.trunk.position.y += (pushing ? Math.sin(this.pushPhase) * 0.6 : 0) * w;   // the body bobs with each push
      this.heading.rotation.z = this.skateBank * w;                                // lean into the turn
      this.headGroup.rotation.x -= 0.12 * w;                                       // eyes up the street
    }

    // 💦 the wet-dog shake: a whole-body roll that rings out and dies
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const env = Math.sin(Math.min(1, this.shakeT / 0.9) * Math.PI);
      this.heading.rotation.z = Math.sin(this.t * 42) * 0.26 * env;
      this.earL.rotation.z = Math.sin(this.t * 42 + 1) * 0.5 * env;
      this.earR.rotation.z = -Math.sin(this.t * 42 + 1) * 0.5 * env;
    } else if (this.rideP <= 0.01) {
      this.heading.rotation.z = 0;
    }

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
        lerpAngle(0, Math.atan2(watchDx, watchDz) - this.faceAngle, 1), -0.75, 0.75);
      this.lookY = ease(this.lookY, watchDist > 14 ? want : 0, dt, 4);
      this.headGroup.rotation.x = this.sniffP * 0.85 - this.sitP * 0.1
        + Math.sin(this.t * 1.9) * 0.03; // breathing
    }
    if (this.barkT > 0) {
      // the bark: muzzle thrown UP for a beat, ears snapped forward
      this.barkT = Math.max(0, this.barkT - dt);
      const b = Math.sin(Math.min(1, this.barkT / 0.38) * Math.PI);
      this.headGroup.rotation.x -= b * 0.55;
      this.earL.rotation.x -= b * 0.3;
      this.earR.rotation.x -= b * 0.3;
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
