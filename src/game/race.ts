import * as THREE from 'three';
import { WorldIndex } from '../world/index';
import { Hud } from './hud';
import { GameAudio } from './audio';
import { TOWN } from '@town';

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

export const COURSES: Course[] = TOWN.courses;

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
const ghostKey = (id: string, name: string) => `${TOWN.raceTown}-race-${id}-ghost-${name}`;

export function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
}

const PX_PER_METER = 8;                // world.json meta.pxPerMeter — the map is honest, so the sign can be too
function routeLenPx(c: Course): number {
  let L = 0;
  for (let i = 2; i < c.route.length; i += 2) L += Math.hypot(c.route[i] - c.route[i - 2], c.route[i + 1] - c.route[i - 1]);
  return L;
}
/** real-world length of a course's suggested route, in miles */
export function courseMiles(c: Course): number {
  return routeLenPx(c) / PX_PER_METER / 1609.34;
}
const EST_BIKE_SPEED = 530;            // Game's bike px/s — the picker's "about how long" line
/** rough ride time at bike speed, in seconds — "3.8 mi" means nothing to a kid; "~4 min" does */
export function courseEstSeconds(c: Course): number {
  return routeLenPx(c) / EST_BIKE_SPEED;
}

// ---------- rider name (kid-safe) ----------
// A display name for best times (and the leaderboard later). All-ages town, so the
// filter is strict and favors false positives: leet-speak is normalized before
// checking; unambiguous filth blocks on substring; short ambiguous words (ass, sex…)
// block only as whole words so ESSEX, CASSIE and PASSED stay legal.
// SHARED with every town on purpose (all towns live on one origin, and the
// per-town storage shim lets these keys through unprefixed): a kid types their
// name once and it rides with them between towns. Ghost pref + board-url too.
const NAME_KEY = 'nbpt-race-name';
const NAME_DEFAULT = 'RIDER';
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '+': 't' };
const BAD_SUB = [
  'fuck', 'fuk', 'fck', 'fuq', 'phuck', 'shit', 'shyt', 'bitch', 'btch', 'cunt', 'cock', 'kock',
  'dick', 'penis', 'vagin', 'pussy', 'pusy', 'boob', 'tits', 'titty', 'porn', 'whore', 'slut',
  'anus', 'jizz', 'milf', 'dildo', 'rape', 'blowjob', 'handjob', 'boner',
  'nigg', 'nigr', 'fag', 'kike', 'wetback', 'retard', 'rtard', 'nazi', 'hitler', 'kkk', 'xxx',
  // compounds that dodge the whole-word tier (which exists so CASSIE/PASSED stay legal)
  'asshat', 'asshole', 'arsehole', 'arse', 'dumbass', 'jackass', 'butthole', 'buttcrack',
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
// 👻 ghost on/off (⚙️ settings): racing a visible rival thrills most kids and stresses
// some — the stressed ones need a real out, not "ignore it". Default ON.
const GHOST_PREF_KEY = 'nbpt-ghost';
export function ghostEnabled(): boolean {
  try { return localStorage.getItem(GHOST_PREF_KEY) !== '0'; } catch { return true; }
}
export function setGhostEnabled(on: boolean): boolean {
  try { localStorage.setItem(GHOST_PREF_KEY, on ? '1' : '0'); } catch { /* private mode */ }
  return on;
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
const boardKey = (id: string) => `${TOWN.raceTown}-race-${id}-board`;
export function getBoard(id: string): BoardRow[] {
  try { const b = JSON.parse(localStorage.getItem(boardKey(id)) || '[]'); return Array.isArray(b) ? b : []; } catch { return []; }
}
// ---------- cloud sync (ships DARK until a backend URL is configured) ----------
// Two interchangeable free backends, same protocol (see infra/leaderboard/README.md):
//   · Google Apps Script (apps-script.gs) — NO new account, uses the Google login
//     you already have; the board lives in a Sheet you can open and moderate
//   · Cloudflare Worker (worker.js) — if you ever want lower latency
// Paste the deployed URL here and every town board goes live worldwide. Empty
// string = local-only boards. To TEST-DRIVE a URL without a rebuild, set
// localStorage 'nbpt-board-url' in the console — it overrides this constant.
const LEADERBOARD_URL: string = 'https://script.google.com/macros/s/AKfycby0vmiIznBVXEE9sRsN6GaaVNhYWGcVvSSOMZn4QiWPZZpM-I-k2Dua-Tvc2AiO1Pxg/exec';
const BOARD_TOWN = TOWN.raceTown;   // the shared board backend partitions by town
function boardUrl(): string {
  let u = LEADERBOARD_URL;
  try { u = localStorage.getItem('nbpt-board-url') || u; } catch { /* private mode */ }
  return u.replace(/\/+$/, '');
}
function syncBoard(id: string) {
  const base = boardUrl();
  if (!base) return;
  const me = hasRaceName() ? getRaceName() : null;
  const mine = me ? getBoard(id).find((r) => r.n === me) : null;
  // pull the town's board and adopt it locally (the cloud is the wider truth); any
  // failure leaves the local board standing — offline play never notices
  const pull = () => fetch(`${base}?town=${BOARD_TOWN}&course=${id}`)
    .then((r) => r.json())
    .then((j) => { if (Array.isArray(j.rows) && j.rows.length) { try { localStorage.setItem(boardKey(id), JSON.stringify(j.rows)); } catch { /* private mode */ } } })
    .catch(() => { /* offline: the local board stands */ });
  if (mine) {
    fetch(base, {
      method: 'POST',
      // text/plain = a CORS "simple request" — no preflight, which Apps Script web
      // apps can't answer. The body is still JSON; both backends parse it the same.
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ town: BOARD_TOWN, course: id, n: mine.n, t: mine.t }),
    }).then(pull, pull);
  } else pull();
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
  private routeCum: number[] = [];     // cumulative route length per vertex — the progress bar's ruler
  private routeLen = 1;
  private popped = -1;                 // last arch the rider actually threaded (feedback pop dedupe)
  private clock = 0;                   // race timer (s)
  private countT = 0;                  // countdown remaining (s)
  private lastCount = -1;              // last whole second shown (tick sound dedupe)
  private nearId: string | null = null;
  private rec: number[] = [];          // ghost samples, flat [t(ds), x, z, ...]
  private recAcc = 0;
  private t = 0;                       // ambient anim clock
  // unconfirmed finishes aren't lost — the session's best run per course is HELD here
  // until somebody puts their name on it (the finish card, the 🏆 board's claim row,
  // or naming yourself in the 🏁 picker all bank it retroactively)
  private pending = new Map<string, { t: number; ghost: string }>();

  private flags = new Map<string, THREE.Group>();
  private gateMark: THREE.Group;           // origin-anchored holder: ring + arch + chevrons (world-positioned children)
  private gateRing: THREE.Mesh;
  private gateArch: THREE.Group;           // a race arch spanning the road at the next gate — visible from blocks away
  private turnArrow: THREE.Group;          // big arrow atop the arch pointing down the EXIT street (the turn, telegraphed)
  private chevrons: THREE.Group[] = [];    // floating arrows tracing the line into and THROUGH the corner —
                                           // each is two passes: solid + a faint through-walls trace (corner houses
                                           // used to swallow the trail exactly at the decision point)
  private archSegs: THREE.Mesh[] = [];     // banner segments + pennants swap to CHECKERED at the finish line
  private archPennants: THREE.Mesh[] = [];
  private matGold!: THREE.MeshBasicMaterial;
  private matMaroon!: THREE.MeshBasicMaterial;
  private matWhite!: THREE.MeshBasicMaterial;
  private matBlack!: THREE.MeshBasicMaterial;
  // 👻 the ghost rider: replays the town leader's best line in real time — beat the
  // rider you can SEE. Loaded at begin() from the leader's recorded polyline.
  private ghostRider: THREE.Group;
  private ghostRun: { pts: number[]; tEnd: number } | null = null;   // flat [t(ds),x,z,...]
  private ghostCur = 0;                    // sample cursor (amortized O(1) playback)

  constructor(
    private scene: THREE.Scene,
    private index: WorldIndex,
    private hud: Hud,
    private audio: GameAudio,
    private ride: (on: boolean) => void,   // Game auto-mounts the bike at the line
    private orient: (dx: number, dz: number) => void,   // Game turns the camera down-course at the start
    private restart: (id: string) => void, // Game fades back to the start line — the results card's RACE AGAIN
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
    const gold = (this.matGold = new THREE.MeshBasicMaterial({ color: '#ffd24a', side: THREE.DoubleSide }));
    const maroon = (this.matMaroon = new THREE.MeshBasicMaterial({ color: '#8e2f3c', side: THREE.DoubleSide }));
    this.matWhite = new THREE.MeshBasicMaterial({ color: '#f4f4f4', side: THREE.DoubleSide });
    this.matBlack = new THREE.MeshBasicMaterial({ color: '#26262b', side: THREE.DoubleSide });
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.set(0, 13, s * 26);
      this.gateArch.add(post);
      const pen = new THREE.BufferGeometry();   // little pennant on each post top, streaming forward
      pen.setAttribute('position', new THREE.Float32BufferAttribute([0, 26, s * 26, 0, 23.4, s * 26, 6.2, 24.7, s * 26], 3));
      pen.computeVertexNormals();
      const pm = new THREE.Mesh(pen, s < 0 ? gold : maroon);
      this.archPennants.push(pm);
      this.gateArch.add(pm);
    }
    const segGeo = new THREE.BoxGeometry(0.8, 4.6, 52 / 6);   // banner = 6 alternating segments across the road
    for (let i = 0; i < 6; i++) {
      const seg = new THREE.Mesh(segGeo, i % 2 ? maroon : gold);
      seg.position.set(0, 22.6, -26 + 52 / 12 + i * (52 / 6));
      this.archSegs.push(seg);
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
    const chevron = new THREE.BufferGeometry();   // bold arrowhead, tip = local +x
    chevron.setAttribute('position', new THREE.Float32BufferAttribute([18, 0, 0, -12, 0, 15, -12, 0, -15], 3));
    chevron.computeVertexNormals();
    for (let i = 0; i < 10; i++) {                // 7 pace the approach, 3 carry the line through the turn
      const grp = new THREE.Group();
      const solid = new THREE.Mesh(chevron, new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      // the through-walls trace: whisper-faint, drawn over everything — the corner
      // house can't swallow the line right when the rider needs it most
      const xray = new THREE.Mesh(chevron, new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.13, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
      xray.renderOrder = 7;
      grp.add(solid, xray);
      this.gateMark.add(grp);
      this.chevrons.push(grp);
    }
    this.gateMark.visible = false;
    this.gateMark.renderOrder = 5;
    scene.add(this.gateMark);

    // 👻 the ghost rider — an actual ghost on a bike: pale, translucent, unmissable.
    // Faces local +x (same convention as the chevrons); playback yaws it per frame.
    this.ghostRider = new THREE.Group();
    const gm = new THREE.MeshBasicMaterial({ color: '#cfeaff', transparent: true, opacity: 0.42, depthWrite: false });
    const wheel = new THREE.CylinderGeometry(3, 3, 0.8, 12);
    for (const wx of [-4.4, 4.4]) {
      const w = new THREE.Mesh(wheel, gm);
      w.rotation.x = Math.PI / 2;               // stand the disc up, rolling along +x
      w.rotation.z = Math.PI / 2;
      w.position.set(wx, 3, 0);
      this.ghostRider.add(w);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9, 1, 1), gm);
    frame.position.y = 5.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 7, 3), gm);
    body.position.set(-0.5, 10, 0);
    body.rotation.z = -0.25;                    // leaning into the ride
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.2, 10, 8), gm);
    head.position.set(0.6, 14.6, 0);
    this.ghostRider.add(frame, body, head);
    this.ghostRider.visible = false;
    this.ghostRider.renderOrder = 6;
    scene.add(this.ghostRider);
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
    // how far along the ride is: your snapped spot on the route, over its whole length —
    // shortcuts and backtracks read honestly because the snap follows YOU, not the gates
    const prog = (this.routeCum[bSeg] + (this.routeCum[bSeg + 1] - this.routeCum[bSeg]) * bT) / this.routeLen;
    let ghostProg: number | null = null;
    // 👻 ghost playback: the leader rides their recorded line against your clock
    if (this.ghostRun) {
      const s = this.ghostRun.pts;
      if (this.clock >= this.ghostRun.tEnd + 1.2) {
        this.ghostRider.visible = false;             // it crossed — gone like a ghost
        ghostProg = 1;                               // …but its flag on the bar stays planted
      } else {
        const tds = this.clock * 10;
        let i = this.ghostCur;
        while (i + 5 < s.length && s[i + 3] <= tds) i += 3;
        this.ghostCur = i;
        const t0 = s[i], x0 = s[i + 1], z0 = s[i + 2];
        const j = Math.min(i + 3, s.length - 3);
        const t1 = s[j], x1 = s[j + 1], z1 = s[j + 2];
        const f = t1 > t0 ? Math.min(1, Math.max(0, (tds - t0) / (t1 - t0))) : 1;
        const ggx = x0 + (x1 - x0) * f, ggz = z0 + (z1 - z0) * f;
        const ggy = Math.max(this.index.heightAtPx(ggx, ggz), this.index.deckHeightAt(ggx, ggz));
        this.ghostRider.position.set(ggx, ggy, ggz);
        if (Math.hypot(x1 - x0, z1 - z0) > 1) this.ghostRider.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
        this.ghostRider.visible = true;
        ghostProg = this.clock >= this.ghostRun.tEnd ? 1 : this.routeFrac(ggx, ggz);
      }
    }
    this.hud.setRaceTimer(this.clock, this.bestFor(c.id), prog, ghostProg);
    const [gx, gz] = c.gates[this.gate];
    // the existing waypoint arrow + journey hint follow hud.guide; race runs after
    // quest in the frame, so this per-frame write wins while a race is on
    this.hud.guide = { x: gx, z: gz };
    // a little tick when you actually thread an arch — pure feedback, no rule attached
    if (this.popped !== this.gate && Math.hypot(px - gx, pz - gz) < GATE_R) { this.popped = this.gate; this.audio.pop(); }
    const pulse = 1 + 0.05 * Math.sin(this.t * 3);      // gentle breath, not a beacon
    this.gateRing.scale.set(pulse, pulse, 1);
    for (let i = 0; i < this.chevrons.length; i++) {    // bold shimmer racing toward the gate
      const wave = (Math.sin(this.t * 5.5 - i * 1.1) + 1) / 2;
      const [solid, xray] = this.chevrons[i].children as THREE.Mesh[];
      (solid.material as THREE.MeshBasicMaterial).opacity = 0.4 + 0.4 * wave;
      // through-walls trace: a whisper on the approach, but LOUD in the corner zone —
      // the turn is exactly where a corner house used to swallow the line
      (xray.material as THREE.MeshBasicMaterial).opacity = i >= 5 ? 0.22 + 0.16 * wave : 0.08 + 0.08 * wave;
    }
  }

  /** fraction 0..1 along the course route nearest a world point (the ghost's bar spot) */
  private routeFrac(px: number, pz: number): number {
    const R = this.course!.route, nseg = R.length / 2 - 1;
    let bs = 0, bt = 0, bd = Infinity;
    for (let i = 0; i < nseg; i++) {
      const ax = R[i * 2], az = R[i * 2 + 1], dx = R[i * 2 + 2] - ax, dz = R[i * 2 + 3] - az;
      const L2 = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
      const qx = ax + dx * t, qz = az + dz * t;
      const d2 = (px - qx) * (px - qx) + (pz - qz) * (pz - qz);
      if (d2 < bd) { bd = d2; bs = i; bt = t; }
    }
    return (this.routeCum[bs] + (this.routeCum[bs + 1] - this.routeCum[bs]) * bt) / this.routeLen;
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
    // the LAST arch is a real FINISH LINE: checkered banner + pennants, bigger, white ring
    const isFinish = g === c.gates.length - 1;
    this.archSegs.forEach((seg, i) => { seg.material = isFinish ? (i % 2 ? this.matBlack : this.matWhite) : (i % 2 ? this.matMaroon : this.matGold); });
    this.archPennants.forEach((p, i) => { p.material = isFinish ? (i ? this.matBlack : this.matWhite) : (i ? this.matMaroon : this.matGold); });
    this.gateArch.scale.setScalar(isFinish ? 1.2 : 1);
    (this.gateRing.material as THREE.MeshBasicMaterial).color.set(isFinish ? '#ffffff' : '#ffd24a');
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
      // FLOATING, not painted: up at handlebar height they clear cars/hedges and
      // don't foreshorten to slivers under the high chase cam
      this.chevrons[i].position.set(cx, ground(cx, cz) + 10, cz);
      this.chevrons[i].rotation.y = Math.atan2(-(arc[k][1] - arc[k - 1][1]), arc[k][0] - arc[k - 1][0]);
      const emph = i >= 5 ? 1.45 : 1;           // the corner zone shouts louder
      this.chevrons[i].scale.set(emph, emph, emph);
    }
    this.gateMark.visible = true;
  }

  private begin(c: Course) {
    this.course = c;
    this.gate = 0;
    this.popped = -1;
    syncBoard(c.id);                         // freshen the town board for next time (dark when local-only)
    // face the rider down-course — dropped in cold, the first thing you see is the way to go
    const rdx = c.route[2] - c.route[0], rdz = c.route[3] - c.route[1];
    const rdl = Math.hypot(rdx, rdz) || 1;
    this.orient(rdx / rdl, rdz / rdl);
    // load the town leader's ghost (if you lead, that's your own best — beat yourself);
    // skipped entirely when the ⚙️ ghost toggle is off — just you and the clock
    this.ghostRun = null;
    this.ghostCur = 0;
    const lead = ghostEnabled() ? getBoard(c.id)[0] : undefined;
    if (lead) {
      try {
        const gj = JSON.parse(localStorage.getItem(ghostKey(c.id, lead.n)) || 'null');
        if (gj && gj.v === 1 && Array.isArray(gj.s) && gj.s.length >= 6) {
          this.ghostRun = { pts: gj.s, tEnd: gj.s[gj.s.length - 3] / 10 };
        }
      } catch { /* corrupt recording = no ghost today */ }
    }
    if (this.ghostRun) {                     // the ghost waits with you at the line
      const s = this.ghostRun.pts;
      const gy = Math.max(this.index.heightAtPx(s[1], s[2]), this.index.deckHeightAt(s[1], s[2]));
      this.ghostRider.position.set(s[1], gy, s[2]);
      this.ghostRider.visible = true;
      // say who the pale blue rider IS — it just appears otherwise, and a kid can't
      // tell a ghost-to-beat from a glitch. Banner rides over the countdown, then fades.
      const yours = hasRaceName() && lead!.n === getRaceName();
      this.hud.announce(
        yours ? '👻 Your ghost rides too' : '👻 ' + lead!.n + '’s ghost rides too',
        yours ? 'the blue rider is your best run — beat it!' : 'the blue rider is the town’s best run — chase it!'
      );
    } else this.ghostRider.visible = false;
    // the progress bar's ruler: cumulative arc length at every route vertex
    this.routeCum = [0];
    for (let i = 2; i < c.route.length; i += 2) {
      this.routeCum.push(this.routeCum[i / 2 - 1] + Math.hypot(c.route[i] - c.route[i - 2], c.route[i + 1] - c.route[i - 1]));
    }
    this.routeLen = this.routeCum[this.routeCum.length - 1] || 1;
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
    const ghost = JSON.stringify({ v: 1, t: Math.round(this.clock * 1000), s: this.rec });
    this.audio.jingle();
    this.hud.celebrate();                                 // 🎉 crossing the line IS the win — every finish gets the party
    // EVERY finish asks "who was riding?" — arcade high-score style. On a shared family
    // device the device can't know who just rode; the name row comes PREFILLED with the
    // last rider (one tap keeps it, typing over it hands the board to the next kid).
    // Nothing posts until the name is confirmed; a dismissed run is HELD for the
    // session (claimable from the 🏆 board), never silently filed under the wrong kid.
    const held = this.pending.get(c.id);
    if (!held || this.clock < held.t) this.pending.set(c.id, { t: this.clock, ghost });
    const t = this.clock;
    this.hud.raceBoard({
      course: c.name, sub: c.sub,
      time: fmtTime(this.clock),
      line: hasRaceName() ? 'who was riding? SAVE keeps the name — or type a new one' : 'type your name to claim your spot on the board!',
      rows: getBoard(c.id), you: null, pendingTime: this.clock,
      prefill: hasRaceName() ? getRaceName() : '',
      onName: (raw) => this.claimRun(c.id, raw, t, ghost),
      onAgain: () => this.restart(c.id),
    });
    this.reset();
  }

  /** confirm a run's rider: persist the name, bank the run (ghost included when it's
   *  that rider's new best) and hand back the fresh board + a placement call */
  private claimRun(id: string, raw: string, t: number, ghost: string): { name: string; rows: BoardRow[]; line: string } | null {
    const r = setRaceName(raw);
    if (!r.ok) return null;
    const prevRow = getBoard(id).find((row) => row.n === r.name);
    const prev = prevRow ? prevRow.t : null;
    const newBest = prev === null || t < prev;
    if (newBest) {
      try { localStorage.setItem(ghostKey(id, r.name), ghost); } catch { /* private mode */ }
    }
    const place = postToBoard(id, r.name, t);
    // this run is claimed — only an OLDER better run stays held for someone else
    const held = this.pending.get(id);
    if (held && held.t >= t) this.pending.delete(id);
    syncBoard(id);
    const board = getBoard(id);
    let line: string;
    if (!newBest) {
      // never just state the miss — a kid reads "your best stands at 1:34" as "you
      // lost". Show the gap and make another go the obvious next move.
      const gap = t - prev!;
      line = gap <= 3
        ? 'SO close — just ' + gap.toFixed(1) + 's off your best!'
        : 'your best is ' + fmtTime(prev!) + ' — the ghost knows the way!';
    }
    else if (board.length > 1 && place === 1) line = '👑 #1 in town — NEW BEST!';
    else if (board.length > 1) line = 'NEW BEST — #' + place + ' in town!';
    else line = 'NEW BEST! The town will hear about this.';
    return { name: r.name, rows: board, line };
  }

  /** open the town board for a course (the picker's 🏆) — claim row included if an
   *  unconfirmed run is still held from earlier in the session */
  showBoard(id: string) {
    const c = COURSES.find((k) => k.id === id);
    if (!c) return;
    syncBoard(id);
    const held = this.pending.get(id);
    this.hud.raceBoard({
      course: c.name, sub: c.sub,
      rows: getBoard(id),
      you: hasRaceName() ? getRaceName() : null,
      pendingTime: held ? held.t : undefined,
      prefill: hasRaceName() ? getRaceName() : '',
      line: held ? (hasRaceName() ? 'a run from earlier is unclaimed — whose was it?' : 'type your name to claim your held run!') : undefined,
      onName: held ? (raw) => this.claimRun(id, raw, held.t, held.ghost) : undefined,
    });
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
      syncBoard(id);
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
    this.ghostRider.visible = false;
    this.ghostRun = null;
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
