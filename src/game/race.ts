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
  gates: [number, number][];           // guidance waypoints; the last one is the finish line
  route: number[];                     // the REAL road polyline start→finish (simplified), flat [x,z,...] —
                                       // chevrons follow this around bends instead of cutting chords through blocks
};

export const COURSES: Course[] = [
  {
    // course 3 (listed first: the sprint of the set) — a scramble through the South
    // End's narrow neighborhood grid: down Bromfield, a hard right up Purchase, a
    // hairpin left down Charles, then the Joppa shore road home. Under half a minute
    // flat-out, but every leg ends in a real corner — winning it is all brakes and line.
    id: 'southend',
    name: 'South End Scramble',
    sub: 'Bromfield top → Joppa Park',
    start: { x: 3961, z: 7552 },
    gates: [
      [5128, 4673],    // Bromfield × Purchase — hard right onto the diagonal
      [3818, 3920],    // Purchase × Charles — hairpin left
      [4675, 2117],    // Charles bottom — left onto the Water St shore
      [5831, 2938],    // the Joppa shore curve
      [7287, 4021],    // finish at Joppa Park
    ],
    route: [3961, 7552, 4800, 5140, 5035, 4627, 5108, 4629, 3818, 3918, 4675, 2117, 5123, 2499, 6320, 3275, 7287, 4021],
  },
  {
    // course 2 — the western homecoming: from the Maudslay gate down twisty Pine Hill
    // Rd, Ferry Rd and the Spofford descent, then Merrimac Street flat-out along the
    // river into the square. The middle of the ladder: sprint → this → the epic.
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
    route: [-34137, -9817, -31031, -15295, -30724, -15668, -30421, -15878, -29660, -16026, -28993, -15979, -26731, -15157, -25529, -14338, -25198, -13929, -24940, -13487, -24947, -15510, -24874, -16396, -24233, -17898, -23827, -17769, -20721, -16135, -15722, -13112, -12495, -10967, -10041, -8538, -8759, -6848, -7115, -4516, -6419, -3904, -5605, -3420, -4924, -2452, -4039, -1590, -3381, -1080, -2607, -741, -1808, -549, -1019, -489, -421, -171, -123, -120],
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
    route: [33026, -4051, 33318, -3799, 33445, -3541, 35596, -2679, 35995, -2391, 36971, -828, 37557, 236, 38973, 3235, 39130, 3689, 39568, 5478, 39659, 7678, 39569, 8868, 39788, 11053, 39748, 11172, 39623, 11276, 37006, 11184, 34589, 11707, 32542, 11865, 28526, 12720, 19337, 13638, 18672, 13635, 17573, 12997, 13800, 10528, 12095, 9054, 11096, 8115, 10720, 7630, 10552, 7015, 10205, 6515, 8449, 5137, 6927, 3717, 5123, 2499, 3961, 1547, 3289, 1134, 2166, -7, 1007, -342, 641, -369, 343, -285],
  },
];

const GATE_R = 36;                     // "passed the arch" radius (feedback pop only — gates are guidance)
const FINISH_R = 64;                   // the finish line is the ONLY thing you must actually cross
const ARM_R = 60;                      // stand-this-close-to-the-flag to get the RACE button
const GHOST_STEP = 0.2;                // ghost sample period (s)
// squared distance from a point to a segment — route-snapping for the guidance arch
function segD2(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const L2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
  const qx = ax + dx * t, qz = az + dz * t;
  return (px - qx) * (px - qx) + (pz - qz) * (pz - qz);
}
// times live on the town board (one entry per rider name — see getBoard below), so a
// shared family iPad gives every kid their OWN "you" and their own ghost to race
const ghostKey = (id: string, name: string) => `nbpt-race-${id}-ghost-${name}`;

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
}

// ---------- rider name (kid-safe) ----------
// A display name for best times (and the leaderboard later). All-ages town, so the
// filter is strict and favors false positives: leet-speak is normalized before
// checking; unambiguous filth blocks on substring; short ambiguous words (ass, sex…)
// block only as whole words so ESSEX, CASSIE and PASSED stay legal.
const NAME_KEY = 'nbpt-race-name';
const NAME_DEFAULT = 'RIDER';
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '+': 't' };
const BAD_SUB = [
  'fuck', 'fuk', 'fck', 'fuq', 'phuck', 'shit', 'shyt', 'bitch', 'btch', 'cunt', 'cock', 'kock',
  'dick', 'penis', 'vagin', 'pussy', 'pusy', 'boob', 'tits', 'titty', 'porn', 'whore', 'slut',
  'anus', 'jizz', 'milf', 'dildo', 'rape', 'blowjob', 'handjob', 'boner',
  'nigg', 'nigr', 'fag', 'kike', 'wetback', 'retard', 'rtard', 'nazi', 'hitler', 'kkk', 'xxx',
];
const BAD_WORD = ['ass', 'sex', 'cum', 'tit', 'hoe', 'anal', 'spic', 'meth'];
function nameIsClean(raw: string): boolean {
  let s = raw.toLowerCase().replace(/[0134578@$!+]/g, (c) => LEET[c] || c);
  s = s.replace(/[^a-z ]/g, '');
  const stripped = s.replace(/ /g, '');
  const collapsed = stripped.replace(/(.)\1+/g, '$1');            // fuuuck → fuck
  for (const w of BAD_SUB) if (stripped.includes(w) || collapsed.includes(w)) return false;
  for (const w of BAD_WORD) if (new RegExp(`\\b${w}\\b`).test(s)) return false;
  return true;
}
export function getRaceName(): string {
  try { return localStorage.getItem(NAME_KEY) || NAME_DEFAULT; } catch { return NAME_DEFAULT; }
}
/** has the player actually entered a name? (scores only persist once they have —
 *  a time on the board with nobody's name on it means nothing) */
export function hasRaceName(): boolean {
  try { return !!(localStorage.getItem(NAME_KEY) || '').trim(); } catch { return false; }
}
// ---------- the town leaderboard (local, per course) ----------
// One row per rider name — each racer's personal best on this device (a shared family
// iPad becomes a real household board). The cloud per-town board syncs on top later;
// this shape (name+time, kid-safe names enforced at entry) is upload-ready as-is.
export type BoardRow = { n: string; t: number };
const boardKey = (id: string) => `nbpt-race-${id}-board`;
export function getBoard(id: string): BoardRow[] {
  try { const b = JSON.parse(localStorage.getItem(boardKey(id)) || '[]'); return Array.isArray(b) ? b : []; } catch { return []; }
}
/** record a named run (keeps each name's best); returns the rider's 1-based placement */
export function postToBoard(id: string, name: string, t: number): number {
  const b = getBoard(id);
  const i = b.findIndex((r) => r.n === name);
  if (i >= 0) { if (t < b[i].t) b[i].t = +t.toFixed(2); } else b.push({ n: name, t: +t.toFixed(2) });
  b.sort((x, y) => x.t - y.t);
  if (b.length > 10) b.length = 10;
  try { localStorage.setItem(boardKey(id), JSON.stringify(b)); } catch { /* private mode */ }
  return Math.max(1, b.findIndex((r) => r.n === name) + 1);
}

/** sanitize + persist; returns what was saved, or ok:false (name unchanged) if blocked */
export function setRaceName(raw: string): { ok: boolean; name: string } {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9 ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
  if (!clean) return { ok: false, name: getRaceName() };
  if (!nameIsClean(clean)) return { ok: false, name: getRaceName() };
  try { localStorage.setItem(NAME_KEY, clean); } catch { /* private mode */ }
  return { ok: true, name: clean };
}

export class RaceRunner {
  private state: 'idle' | 'count' | 'run' = 'idle';
  private course: Course | null = null;
  private gate = 0;                    // GUIDANCE index: which suggested waypoint the arch sits at
  private gateSeg: number[] = [];      // each gate projected onto the course route: segment index…
  private gateT: number[] = [];        // …+ param along it (monotonic) — computed once at begin()
  private popped = -1;                 // last arch the rider actually threaded (feedback pop dedupe)
  private clock = 0;                   // race timer (s)
  private countT = 0;                  // countdown remaining (s)
  private lastCount = -1;              // last whole second shown (tick sound dedupe)
  private nearId: string | null = null;
  private rec: number[] = [];          // ghost samples, flat [t(ds), x, z, ...]
  private recAcc = 0;
  private t = 0;                       // ambient anim clock
  // unnamed finishes aren't lost — the session's best run per course is HELD here,
  // and setting a name (finish-card box or the 🏁 picker) saves it retroactively
  private pending = new Map<string, { t: number; ghost: string }>();

  private flags = new Map<string, THREE.Group>();
  private gateMark: THREE.Group;           // origin-anchored holder: ring + arch + chevrons (world-positioned children)
  private gateRing: THREE.Mesh;
  private gateArch: THREE.Group;           // a race arch spanning the road at the next gate — visible from blocks away
  private turnArrow: THREE.Group;          // big arrow atop the arch pointing down the EXIT street (the turn, telegraphed)
  private chevrons: THREE.Mesh[] = [];     // bold arrows on the pavement leading into and THROUGH the corner

  constructor(
    private scene: THREE.Scene,
    private index: WorldIndex,
    private hud: Hud,
    private audio: GameAudio,
    private ride: (on: boolean) => void,   // Game lends/returns the bike
  ) {
    for (const c of COURSES) this.buildFlag(c);
    // The "next gate" guide — OBVIOUS but diegetic (Devin: chevrons-only was too subtle,
    // the sky-pillar too much): a full RACE ARCH spans the road at the gate — two tall
    // posts + a gold/maroon banner you can spot from blocks away, yawed square to the
    // approach — plus a trail of bold pavement chevrons whose shimmer runs toward it.
    // The holder group stays at the origin; children are world-positioned per gate.
    this.gateMark = new THREE.Group();
    this.gateRing = new THREE.Mesh(
      new THREE.RingGeometry(GATE_R * 0.5, GATE_R * 0.62, 28),
      new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    );
    this.gateRing.rotation.x = -Math.PI / 2;
    this.gateMark.add(this.gateRing);
    // the arch: posts at local ±26 (flanking the road), banner spanning them up top.
    // MeshBasic = full-bright, so it reads at night without any beam.
    this.gateArch = new THREE.Group();
    const postGeo = new THREE.CylinderGeometry(0.9, 0.9, 26, 8);
    const postMat = new THREE.MeshBasicMaterial({ color: '#f3f1e8' });
    const gold = new THREE.MeshBasicMaterial({ color: '#ffd24a', side: THREE.DoubleSide });
    const maroon = new THREE.MeshBasicMaterial({ color: '#8e2f3c', side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(0, 13, s * 26);
      this.gateArch.add(post);
      const pen = new THREE.BufferGeometry();   // little pennant on each post top, streaming forward
      pen.setAttribute('position', new THREE.Float32BufferAttribute([0, 26, s * 26, 0, 23.4, s * 26, 6.2, 24.7, s * 26], 3));
      pen.computeVertexNormals();
      this.gateArch.add(new THREE.Mesh(pen, s < 0 ? gold : maroon));
    }
    const segGeo = new THREE.BoxGeometry(0.8, 4.6, 52 / 6);   // banner = 6 alternating segments across the road
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Mesh(segGeo, i % 2 ? maroon : gold);
      seg.position.set(0, 22.6, -26 + 52 / 12 + i * (52 / 6));
      this.gateArch.add(seg);
    }
    // the TURN ARROW rides on top of the banner, pointing down the EXIT street —
    // "which way after the arch" answered from a block away. Flat, big, full-bright.
    this.turnArrow = new THREE.Group();
    const taShaft = new THREE.Mesh(new THREE.BoxGeometry(13, 0.8, 4.6), gold);
    taShaft.position.set(-4.5, 0, 0);
    const taHead = new THREE.BufferGeometry();
    taHead.setAttribute('position', new THREE.Float32BufferAttribute([12, 0, 0, 2, 0, 7.5, 2, 0, -7.5], 3));
    taHead.computeVertexNormals();
    this.turnArrow.add(taShaft, new THREE.Mesh(taHead, gold));
    this.turnArrow.position.y = 27.5;
    this.gateArch.add(this.turnArrow);
    this.gateMark.add(this.gateArch);
    const chevron = new THREE.BufferGeometry();   // bold arrowhead on the road, tip = local +x
    chevron.setAttribute('position', new THREE.Float32BufferAttribute([16, 0, 0, -11, 0, 13, -11, 0, -13], 3));
    chevron.computeVertexNormals();
    for (let i = 0; i < 10; i++) {                // 7 pace the approach, 3 carry the line through the turn
      const ch = new THREE.Mesh(chevron, new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      this.gateMark.add(ch);
      this.chevrons.push(ch);
    }
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

  /** the CURRENT rider's best on this course — their row on the town board */
  bestFor(id: string): number | null {
    if (!hasRaceName()) return null;
    const row = getBoard(id).find((r) => r.n === getRaceName());
    return row ? row.t : null;
  }

  // There is NO off-course rule: the gates define the course, but HOW you get between
  // them is the rider's business — shortcuts, back alleys, kayak hops and the ✈️ cheat
  // (gates score on 2D distance, so overflying counts) are all legal. Only an explicit
  // quit, fast travel, or the finish line ends a run — never silently.
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
    // THE ONLY RULE: cross the finish line. Everything else is route freedom — users
    // find the fastest way; the arches are suggestions, not requirements (Devin: "we
    // just want general direction").
    const [fx, fz] = c.gates[c.gates.length - 1];
    if (Math.hypot(px - fx, pz - fz) < FINISH_R) { this.finish(px, pz); return; }
    // Guidance: snap to the REAL road polyline nearest the RIDER, then aim the arch at
    // the end of whichever leg that spot falls in — deep in a shortcut the arch sits
    // wherever the route runs closest to you, never stranded at a skipped waypoint.
    // Backtracking only re-aims with a clear margin (1.5x) so legs don't flap.
    const R = c.route, nseg = R.length / 2 - 1;
    let bSeg = 0, bd = Infinity;
    for (let i = 0; i < nseg; i++) {
      const d2 = segD2(px, pz, R[i * 2], R[i * 2 + 1], R[i * 2 + 2], R[i * 2 + 3]);
      if (d2 < bd) { bd = d2; bSeg = i; }
    }
    const bax = R[bSeg * 2], baz = R[bSeg * 2 + 1], bdx = R[bSeg * 2 + 2] - bax, bdz = R[bSeg * 2 + 3] - baz;
    const bL2 = bdx * bdx + bdz * bdz || 1;
    const bT = Math.max(0, Math.min(1, ((px - bax) * bdx + (pz - baz) * bdz) / bL2));
    let want = c.gates.length - 1;
    for (let g2 = 0; g2 < c.gates.length; g2++) {
      if (this.gateSeg[g2] > bSeg || (this.gateSeg[g2] === bSeg && this.gateT[g2] >= bT)) { want = g2; break; }
    }
    if (want !== this.gate) {
      if (want > this.gate) { this.gate = want; this.pointGate(); }
      else {
        let cur = Infinity;
        const s0 = this.gate > 0 ? this.gateSeg[this.gate - 1] : 0, s1 = this.gateSeg[this.gate];
        for (let i = s0; i <= s1 && i < nseg; i++) cur = Math.min(cur, segD2(px, pz, R[i * 2], R[i * 2 + 1], R[i * 2 + 2], R[i * 2 + 3]));
        if (bd * 1.5 < cur) { this.gate = want; this.pointGate(); }
      }
    }
    const [gx, gz] = c.gates[this.gate];
    // the existing waypoint arrow + journey hint follow hud.guide; race runs after
    // quest in the frame, so this per-frame write wins while a race is on
    this.hud.guide = { x: gx, z: gz };
    // a little tick when you actually thread an arch — pure feedback, no rule attached
    if (this.popped !== this.gate && Math.hypot(px - gx, pz - gz) < GATE_R) { this.popped = this.gate; this.audio.pop(); }
    const pulse = 1 + 0.05 * Math.sin(this.t * 3);      // gentle breath, not a beacon
    this.gateRing.scale.set(pulse, pulse, 1);
    for (let i = 0; i < this.chevrons.length; i++) {    // bold shimmer racing toward the gate
      (this.chevrons[i].material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.4 * (Math.sin(this.t * 5.5 - i * 1.1) + 1) / 2;
    }
  }

  private pointGate() {
    const c = this.course!;
    const R = c.route;
    const g = this.gate;
    const [gx, gz] = c.gates[g];
    const nseg = R.length / 2 - 1;
    const ground = (x: number, z: number) => Math.max(this.index.heightAtPx(x, z), this.index.deckHeightAt(x, z));
    const at = (s: number, t: number): [number, number] =>
      [R[s * 2] + (R[s * 2 + 2] - R[s * 2]) * t, R[s * 2 + 1] + (R[s * 2 + 3] - R[s * 2 + 1]) * t];
    // this leg's arc from the REAL road, EXTENDED ~450px past the gate into the next
    // street — the confusing moment is the corner itself, so the painted line flows
    // THROUGH the turn instead of stopping at it
    const s0 = g > 0 ? this.gateSeg[g - 1] : 0, t0 = g > 0 ? this.gateT[g - 1] : 0;
    const s1 = this.gateSeg[g], t1 = this.gateT[g];
    const arc: [number, number][] = [at(s0, t0)];
    for (let i = s0 + 1; i <= s1; i++) arc.push([R[i * 2], R[i * 2 + 1]]);
    arc.push(at(s1, t1));
    const gateIdx = arc.length - 1;                     // where the gate sits in the arc
    if (g < c.gates.length - 1) {                       // walk the exit (never past the finish)
      let left = 450;
      let s = s1, t = t1;
      while (left > 0 && s < nseg) {
        const ex = R[s * 2 + 2], ez = R[s * 2 + 3];
        const [cxx, czz] = at(s, t);
        const d = Math.hypot(ex - cxx, ez - czz);
        if (d >= left) { const f = t + (1 - t) * (left / (d || 1)); arc.push(at(s, Math.min(1, f))); break; }
        arc.push([ex, ez]); left -= d; s++; t = 0;
      }
    }
    const lens = [0];
    for (let i = 1; i < arc.length; i++) lens.push(lens[i - 1] + Math.hypot(arc[i][0] - arc[i - 1][0], arc[i][1] - arc[i - 1][1]));
    const LGate = lens[gateIdx] || 1, LEnd = lens[lens.length - 1];
    // arch squared to the road's incoming direction; the big TURN ARROW on top points
    // down the exit street. Both directions are measured over ~70px of arc (adjacent
    // vertices can sit ~2px apart where a gate lands on a route vertex — degenerate).
    const atLen = (want: number): [number, number] => {
      const wl = Math.max(0, Math.min(LEnd, want));
      let k = 1;
      while (k < lens.length - 1 && lens[k] < wl) k++;
      const f = (wl - lens[k - 1]) / ((lens[k] - lens[k - 1]) || 1);
      return [arc[k - 1][0] + (arc[k][0] - arc[k - 1][0]) * f, arc[k - 1][1] + (arc[k][1] - arc[k - 1][1]) * f];
    };
    const [ibx, ibz] = atLen(LGate - 70);
    const inYaw = Math.atan2(-(arc[gateIdx][1] - ibz), arc[gateIdx][0] - ibx);
    this.gateRing.position.set(gx, ground(gx, gz) + 1.2, gz);
    this.gateArch.position.set(gx, ground(gx, gz), gz);
    this.gateArch.rotation.y = inYaw;
    if (LEnd > LGate + 20) {
      const [obx, obz] = atLen(LGate + 70);
      const outYaw = Math.atan2(-(obz - arc[gateIdx][1]), obx - arc[gateIdx][0]);
      let d = outYaw - inYaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));         // shortest wrap, no 350° spins
      this.turnArrow.visible = true;
      this.turnArrow.rotation.y = d;
    } else {
      this.turnArrow.visible = false;                   // the finish: nowhere onward to point
    }
    // 7 chevrons pace the approach, 3 carry the line around the corner into the exit
    const marks: number[] = [];
    for (let i = 0; i < 7; i++) marks.push(LGate * (0.14 + i * 0.135));
    for (const e of [110, 260, 430]) marks.push(Math.min(LEnd, LGate + e));
    for (let i = 0; i < this.chevrons.length; i++) {
      const wantL = marks[i];
      let k = 1;
      while (k < lens.length - 1 && lens[k] < wantL) k++;
      const f = (wantL - lens[k - 1]) / ((lens[k] - lens[k - 1]) || 1);
      const cx = arc[k - 1][0] + (arc[k][0] - arc[k - 1][0]) * f;
      const cz = arc[k - 1][1] + (arc[k][1] - arc[k - 1][1]) * f;
      this.chevrons[i].position.set(cx, ground(cx, cz) + 0.9, cz);
      this.chevrons[i].rotation.y = Math.atan2(-(arc[k][1] - arc[k - 1][1]), arc[k][0] - arc[k - 1][0]);
    }
    this.gateMark.visible = true;
  }

  private begin(c: Course) {
    this.course = c;
    this.gate = 0;
    this.popped = -1;
    // project every gate onto the route polyline (segment + param, kept monotonic) —
    // the guidance legs and chevron arcs are cut from the REAL road at these marks
    this.gateSeg = []; this.gateT = [];
    const R = c.route, nseg = R.length / 2 - 1;
    let mSeg = 0, mT = 0;
    for (const [gx, gz] of c.gates) {
      let bs = mSeg, bt = 0, bd = Infinity;
      for (let i = mSeg; i < nseg; i++) {
        const ax = R[i * 2], az = R[i * 2 + 1], dx = R[i * 2 + 2] - ax, dz = R[i * 2 + 3] - az;
        const L2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((gx - ax) * dx + (gz - az) * dz) / L2));
        const qx = ax + dx * t, qz = az + dz * t;
        const d2 = (gx - qx) * (gx - qx) + (gz - qz) * (gz - qz);
        if (d2 < bd) { bd = d2; bs = i; bt = t; }
      }
      if (bs === mSeg && bt < mT) bt = mT;
      this.gateSeg.push(bs); this.gateT.push(bt);
      mSeg = bs; mT = bt;
    }
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
    const named = hasRaceName();                          // no name, no board — but the run is held, not lost
    const prev = this.bestFor(c.id);                      // this rider's row on the town board
    const newBest = named && (prev === null || this.clock < prev);
    const ghost = JSON.stringify({ v: 1, t: Math.round(this.clock * 1000), s: this.rec });
    if (newBest) {
      try { localStorage.setItem(ghostKey(c.id, getRaceName()), ghost); } catch { /* private mode */ }
    }
    this.audio.jingle();
    if (!named) {
      // hold the session's best unnamed run; the finish card carries the name box —
      // the moment they just earned a time is the moment they'll want to keep it
      const held = this.pending.get(c.id);
      if (!held || this.clock < held.t) this.pending.set(c.id, { t: this.clock, ghost });
      this.hud.chapterCard(
        '🏁 ' + c.name.toUpperCase(),
        fmtTime(this.clock),
        'type your name to save this time!',
        { save: (raw) => { const r = setRaceName(raw); if (!r.ok) return null; this.flushPending(); return r.name; } },
      );
    } else {
      // the run goes on the town board; the card calls your placement
      const place = postToBoard(c.id, getRaceName(), this.clock);
      const board = getBoard(c.id);
      let line: string;
      if (!newBest) line = 'best ' + fmtTime(prev!) + ' — the clock will be here all day';
      else if (board.length > 1 && place === 1) line = '👑 #1 in town — NEW BEST for ' + getRaceName() + '!';
      else if (board.length > 1) line = 'NEW BEST for ' + getRaceName() + ' — #' + place + ' in town!';
      else line = 'NEW BEST for ' + getRaceName() + '! The town will hear about this.';
      this.hud.chapterCard('🏁 ' + c.name.toUpperCase(), fmtTime(this.clock), line);
    }
    this.reset();
  }

  /** once a name exists, bank any held unnamed runs (better-than-their-row only) */
  flushPending() {
    if (!hasRaceName() || !this.pending.size) return;
    const name = getRaceName();
    for (const [id, run] of this.pending) {
      const row = getBoard(id).find((r) => r.n === name);
      if (!row || run.t < row.t) {
        try { localStorage.setItem(ghostKey(id, name), run.ghost); } catch { /* private mode */ }
      }
      postToBoard(id, name, run.t);            // held runs make the town board too
    }
    this.pending.clear();
  }

  /** end the run without finishing. NEVER silent: pass `why` so the rider learns the
   *  race is over (the old quiet stray-cancel let players ride to the finish of a race
   *  that had already ended — worst feeling in the game). Safe to call anytime. */
  cancel(why?: string) {
    if (this.state === 'idle') return;
    if (why) this.hud.announce('🏁 Race ended', why);
    this.reset();
  }

  /** the rider taps out (the ✕ on the race clock) */
  quit() {
    if (this.state === 'idle') return;
    this.hud.announce('🏁 Race ended', 'the flags will be waiting when you want another go');
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
