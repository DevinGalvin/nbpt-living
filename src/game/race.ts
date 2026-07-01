import * as THREE from 'three';
import { WorldIndex } from '../world/index';
import { Hud } from './hud';
import { GameAudio } from './audio';

// Bike time trials on the real map — the "play tier" that works in every town and
// both modes (story on/off). A course is a start flag + an ordered chain of gates
// along real streets; ride through them against the clock. Best times persist per
// course, and every run records a ghost polyline ([t,x,z] every 200ms) so the
// ghost-racing step ships retroactively for existing bests.
//
// Course 1, "Yankee Homecoming" (the town's real race finishes downtown): start at
// the Plum Island lighthouse and ride HOME — the island, the long turnpike causeway,
// then the gates tighten through Joppa and Water Street for a technical finish into
// Market Square. Open riding first, the difficulty right at the climax.

export type Course = {
  id: string;
  name: string;
  sub: string;
  start: { x: number; z: number };     // start flag + arming spot
  gates: [number, number][];           // ride-through order; the last gate is the finish
};

export const COURSES: Course[] = [
  {
    // course 2 (listed first: it's the shorter intro of the pair) — the western
    // homecoming: from the Maudslay gate down twisty Pine Hill Rd, Ferry Rd and the
    // Spofford descent, then Merrimac Street flat-out along the river into the square.
    id: 'merrimack',
    name: 'The Merrimack Run',
    sub: 'Maudslay gate → Market Square',
    start: { x: -34137, z: -9817 },
    gates: [
      [-32860, -12109], [-31522, -14475], [-29578, -16029], [-26964, -15254], [-24940, -13487],
      [-24914, -16117], [-23575, -17623], [-21252, -16425], [-18904, -15042], [-16534, -13607],
      [-14099, -12046], [-11842, -10340], [-9884, -8320], [-8303, -6194], [-6584, -4026],
      [-5429, -3205], [-4420, -1953], [-3271, -1020], [-1808, -549], [-481, -197],
      [-140, -130],
    ],
  },
  {
    id: 'homecoming',
    name: 'Yankee Homecoming',
    sub: 'Plum Island Light → Market Square',
    start: { x: 33026, z: -4051 },
    // traced from the real road polylines (Northern Blvd → Plum Island Turnpike →
    // Water St): ~2600px apart in the open, ~1400px through the downtown finish
    gates: [
      [35543, -2702], [37089, -599], [38326, 1827], [39272, 4252], [39634, 6942],
      [39646, 9654], [37006, 11184], [34404, 11732], [31739, 12048], [28997, 12645],
      [26362, 12930], [23470, 13235], [20585, 13521], [17573, 12997], [15269, 11498],
      [13109, 9922], [11152, 8172], [9577, 6017], [7582, 4286], [6320, 3275],
      [5145, 2513], [3994, 1571], [2877, 739], [1707, -171], [200, -180],
    ],
  },
];

const GATE_R = 36;                     // ride-through radius (generous for mobile steering)
const ARM_R = 60;                      // stand-this-close-to-the-flag to get the RACE button
const STRAY = 3600;                    // clearly wandered off the course → quiet cancel
const GHOST_STEP = 0.2;                // ghost sample period (s)
const bestKey = (id: string) => `nbpt-race-${id}-best`;
const ghostKey = (id: string) => `nbpt-race-${id}-ghost`;

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
}

export class RaceRunner {
  private state: 'idle' | 'count' | 'run' = 'idle';
  private course: Course | null = null;
  private gate = 0;                    // index of the NEXT gate to ride through
  private clock = 0;                   // race timer (s)
  private countT = 0;                  // countdown remaining (s)
  private lastCount = -1;              // last whole second shown (tick sound dedupe)
  private nearId: string | null = null;
  private rec: number[] = [];          // ghost samples, flat [t(ds), x, z, ...]
  private recAcc = 0;
  private t = 0;                       // ambient anim clock

  private flags = new Map<string, THREE.Group>();
  private gateMark: THREE.Group;
  private gateRing: THREE.Mesh;
  private gatePillar: THREE.Mesh;

  constructor(
    private scene: THREE.Scene,
    private index: WorldIndex,
    private hud: Hud,
    private audio: GameAudio,
    private ride: (on: boolean) => void,   // Game lends/returns the bike
  ) {
    for (const c of COURSES) this.buildFlag(c);
    // the "next gate" marker: a slim gold beacon pillar + a ground ring that pings.
    // depthTest off so it reads through buildings — it's a guide, not scenery.
    this.gateMark = new THREE.Group();
    this.gatePillar = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.6, 130, 10, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, side: THREE.DoubleSide })
    );
    this.gatePillar.position.y = 65;
    this.gateRing = new THREE.Mesh(
      new THREE.RingGeometry(GATE_R * 0.55, GATE_R * 0.72, 28),
      new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.gateRing.rotation.x = -Math.PI / 2;
    this.gateRing.position.y = 1.2;
    this.gateMark.add(this.gatePillar, this.gateRing);
    this.gateMark.visible = false;
    this.gateMark.renderOrder = 5;
    scene.add(this.gateMark);
  }

  // a little start line: checkered flag on a pole + a soft gold ground ring
  private buildFlag(c: Course) {
    const g = new THREE.Group();
    const y = this.index.heightAtPx(c.start.x, c.start.z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 22, 6), new THREE.MeshLambertMaterial({ color: '#e8e4d8' }));
    pole.position.y = 11;
    g.add(pole);
    const dark = new THREE.MeshLambertMaterial({ color: '#22252b', side: THREE.DoubleSide });
    const lite = new THREE.MeshLambertMaterial({ color: '#f3f1e8', side: THREE.DoubleSide });
    for (let r = 0; r < 2; r++) for (let ccol = 0; ccol < 3; ccol++) {
      const sq = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), (r + ccol) % 2 ? dark : lite);
      sq.position.set(1.4 + ccol * 2.6, 19.6 - r * 2.6, 0);
      g.add(sq);
    }
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(9, 11, 24),
      new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.8;
    g.add(ring);
    (g as THREE.Group & { ring?: THREE.Mesh }).ring = ring;
    g.position.set(c.start.x, y, c.start.z);
    this.scene.add(g);
    this.flags.set(c.id, g);
  }

  get active(): boolean { return this.state !== 'idle'; }
  get freeze(): boolean { return this.state === 'count'; }   // Game zeroes speed during the countdown
  get nearActive(): boolean { return this.nearId !== null; }

  bestFor(id: string): number | null {
    const v = parseFloat(localStorage.getItem(bestKey(id)) || '');
    return isFinite(v) && v > 0 ? v : null;
  }

  update(dt: number, px: number, pz: number, suppressed: boolean) {
    this.t += dt;
    // start flags breathe while idle
    for (const g of this.flags.values()) {
      const ring = (g as THREE.Group & { ring?: THREE.Mesh }).ring;
      if (ring && g.visible) (ring.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.25 * (Math.sin(this.t * 2.2) + 1) / 2;
    }

    if (this.state === 'idle') {
      if (this.hud.dialogueOpen || suppressed) {
        if (this.nearId) { this.nearId = null; this.hud.showTalk(null); }
        return;
      }
      let best: Course | null = null;
      let bd = ARM_R;
      for (const c of COURSES) {
        const d = Math.hypot(px - c.start.x, pz - c.start.z);
        if (d < bd) { bd = d; best = c; }
      }
      if ((best && best.id) !== this.nearId) {
        this.nearId = best ? best.id : null;
        this.hud.showTalk(best ? '🚴 RACE' : null, () => { if (best) this.begin(best); });
      }
      return;
    }

    if (this.state === 'count') {
      this.countT -= dt;
      const n = Math.max(0, Math.ceil(this.countT));
      if (n !== this.lastCount) {
        this.lastCount = n;
        if (n > 0) { this.hud.raceCountdown(String(n)); this.audio.plink(); }
        else {
          this.hud.raceCountdown('GO!');
          this.audio.horn();
          this.state = 'run';
          this.clock = 0; this.recAcc = 0; this.rec = [0, Math.round(px), Math.round(pz)];
          this.pointGate();
        }
      }
      return;
    }

    // running
    this.clock += dt;
    this.recAcc += dt;
    if (this.recAcc >= GHOST_STEP) {
      this.recAcc -= GHOST_STEP;
      this.rec.push(Math.round(this.clock * 10), Math.round(px), Math.round(pz));
    }
    const c = this.course!;
    this.hud.setRaceTimer(this.clock, this.bestFor(c.id));
    const [gx, gz] = c.gates[this.gate];
    // the existing waypoint arrow + journey hint follow hud.guide; race runs after
    // quest in the frame, so this per-frame write wins while a race is on
    this.hud.guide = { x: gx, z: gz };
    const d = Math.hypot(px - gx, pz - gz);
    const pulse = 1 + 0.12 * Math.sin(this.t * 4);
    this.gateRing.scale.set(pulse, pulse, 1);
    if (d < GATE_R) {
      this.gate++;
      if (this.gate >= c.gates.length) { this.finish(px, pz); return; }
      this.audio.pop();
      this.pointGate();
    } else if (d > STRAY) {
      this.cancel();   // wandered clean off the course — quiet reset, no scolding
    }
  }

  private pointGate() {
    const c = this.course!;
    const [gx, gz] = c.gates[this.gate];
    this.gateMark.position.set(gx, this.index.heightAtPx(gx, gz), gz);
    this.gateMark.visible = true;
  }

  private begin(c: Course) {
    this.course = c;
    this.gate = 0;
    this.state = 'count';
    this.countT = 5.0;   // a real breath at the line — the picker teleports you in cold
    this.lastCount = -1;
    this.nearId = null;
    this.hud.showTalk(null);
    this.ride(true);                     // the race lends you a bike (explore mode included)
    this.pointGate();
  }

  private finish(px: number, pz: number) {
    const c = this.course!;
    this.rec.push(Math.round(this.clock * 10), Math.round(px), Math.round(pz));
    const prev = this.bestFor(c.id);
    const newBest = prev === null || this.clock < prev;
    if (newBest) {
      try {
        localStorage.setItem(bestKey(c.id), this.clock.toFixed(2));
        localStorage.setItem(ghostKey(c.id), JSON.stringify({ v: 1, t: Math.round(this.clock * 1000), s: this.rec }));
      } catch { /* private mode */ }
    }
    this.audio.jingle();
    this.hud.chapterCard(
      '🏁 ' + c.name.toUpperCase(),
      fmtTime(this.clock),
      newBest ? 'NEW BEST! The town will hear about this.' : 'best ' + fmtTime(prev!) + ' — the clock will be here all day',
    );
    this.reset();
  }

  /** abandon the run (dismount, fast travel, interiors, straying). Safe to call anytime. */
  cancel() {
    if (this.state === 'idle') return;
    this.reset();
  }

  private reset() {
    this.state = 'idle';
    this.course = null;
    this.gateMark.visible = false;
    this.hud.raceCountdown(null);
    this.hud.setRaceTimer(null, null);
    this.hud.guide = null;
    this.ride(false);                    // returns the lent bike (earned riders keep theirs)
  }

  /** dev hook: arm + start a course by id (nbpt.race('homecoming')) */
  startById(id: string): boolean {
    const c = COURSES.find((k) => k.id === id);
    if (!c || this.state !== 'idle') return false;
    this.begin(c);
    return true;
  }
}
