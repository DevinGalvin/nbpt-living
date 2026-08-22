import { TOWN } from '@town';
import { townKey } from './saves';
import { SITES } from './history';
import { nameIsClean } from './race';

// QuestVille — the classroom layer behind the 🍎 CLASS button (wireframes + plan:
// docs/QUESTVILLE-PLAN.md). One button, three states, decided by what this device
// holds: nothing → an inert School sheet with a key box behind "I'm a teacher";
// a teacher key → that class's dashboard; an admin key → the admin room; a kid on
// a class link → their week's list. No accounts anywhere — a key or a first name
// is the whole sign-in.
//
// ⚠️ MOCK BACKEND. Everything here runs against local demo data (a baked-in
// "Ms. Demo's class" + admin-created classes kept in localStorage) so the whole
// gate is demoable offline. The classroom worker (infra/classroom, not built yet)
// replaces the functions in the MOCK section 1:1; nothing outside that section
// should need to change. Until then the demo keys are the only keys:
//   teacher DEMO-TEACH · admin DEMO-ADMIN
//
// ⚠️ NO BACKTICKS in the css template literal — same trap as hud.ts.

type WeekId = 'map' | 'town' | 'then' | 'free';
type ClassDef = { code: string; name: string; roster: string[]; week: WeekId; tkey: string };

// ---------- storage (all per-town, see saves.ts) ----------
const K = {
  student: townKey('class-student'),   // JSON {code, name} — the kid identity on this device
  tkey: townKey('class-tkey'),         // teacher key pasted on this device
  akey: townKey('class-akey'),         // admin key pasted on this device
  reg: townKey('class-registry'),      // admin-created classes (mock: local only)
};

// ---------- the three parts (preview lists ride EXISTING markers) ----------
// "How the Town Works" gets its real civics set later; until then each part
// borrows the closest existing discoveries so progress is REAL in the demo —
// a kid finding City Hall genuinely ticks the class list.
const WEEKS: Record<Exclude<WeekId, 'free'>, { em: string; name: string; sub: string; sites: string[] }> = {
  map: {
    em: '🧭', name: 'Find Your Way', sub: 'Directions, the river and the coast',
    sites: ['river-name', 'four-seasons', 'walking-light', 'range-lights', 'chain-bridge', 'first-flight', 'marchs-hill', 'joppa'],
  },
  town: {
    em: '🏛', name: 'How the Town Works', sub: 'City Hall, the library, the courthouse — who does what',
    sites: ['city-hall', 'tracy-library', 'bulfinch-court', 'custom-house', 'uscg', 'old-jail', 'market-house', 'frs-steeple', 'powder-house'],
  },
  then: {
    em: '⚓', name: 'Newburyport Then', sub: 'The city’s story, the 1700s on',
    sites: ['great-fire', 'morse-poltergeist', 'dexter-house', 'garrison', 'whitefield', 'cushing-house', 'spl-farm', 'pink-house', 'inn-street'],
  },
};

const siteTitle = (id: string) => SITES.find((s) => s.id === id)?.title || id;

// the kid's real found set — the same store the collection album reads
function foundSet(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(townKey('history-read')) || '[]')); }
  catch { return new Set(); }
}

// ================= MOCK — the classroom worker replaces this section =================

const DEMO_CLASS: ClassDef = {
  code: 'DEMO-1', name: 'Ms. Demo’s class', week: 'town', tkey: 'DEMO-TEACH',
  roster: ['Aiden', 'Bea', 'Charlie', 'Delia', 'Elias', 'Frankie', 'Gus', 'Hana', 'Leo', 'Maya', 'Noor', 'Ollie'],
};
const DEMO_ADMIN_KEY = 'DEMO-ADMIN';

function loadReg(): ClassDef[] {
  try { return JSON.parse(localStorage.getItem(K.reg) || '[]'); } catch { return []; }
}
function saveReg(reg: ClassDef[]) { localStorage.setItem(K.reg, JSON.stringify(reg)); }
function allClasses(): ClassDef[] { return [DEMO_CLASS, ...loadReg()]; }
function findClass(code: string): ClassDef | null {
  return allClasses().find((c) => c.code.toUpperCase() === code.toUpperCase()) || null;
}
function classByTeacherKey(key: string): ClassDef | null {
  return allClasses().find((c) => c.tkey === key.trim()) || null;
}
function isAdminKey(key: string): boolean { return key.trim() === DEMO_ADMIN_KEY; }

function setWeek(code: string, week: WeekId) {
  if (code === DEMO_CLASS.code) { DEMO_CLASS.week = week; return; }   // demo: session-only
  const reg = loadReg();
  const c = reg.find((r) => r.code === code);
  if (c) { c.week = week; saveReg(reg); }
}
function updateRoster(code: string, roster: string[]) {
  const reg = loadReg();
  const c = reg.find((r) => r.code === code);
  if (c) { c.roster = roster; saveReg(reg); }
}
function deleteClass(code: string) { saveReg(loadReg().filter((c) => c.code !== code)); }

const ANIMALS = ['OTTER', 'HERON', 'SEAL', 'PLOVER', 'GULL', 'FOX', 'CRAB', 'TERN'];
function mintClass(name: string, roster: string[]): ClassDef {
  const taken = new Set(allClasses().map((c) => c.code));
  let code = '';
  do {
    code = ANIMALS[Math.floor(Math.random() * ANIMALS.length)] + '-' + (10 + Math.floor(Math.random() * 89));
  } while (taken.has(code));
  const tkey = 'tk_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
  const def: ClassDef = { code, name, roster, week: 'map', tkey };
  saveReg([...loadReg(), def]);
  return def;
}

// mock Live-view numbers: deterministic per kid so the grid holds still between
// opens — except the kid signed in on THIS device, whose count is their real one
function mockFound(c: ClassDef, kid: string, sites: string[]): Set<string> {
  const me = student();
  if (me && me.code === c.code && me.name === kid) {
    const real = foundSet();
    return new Set(sites.filter((s) => real.has(s)));
  }
  let h = 0;
  for (const ch of kid + c.code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const n = h % (sites.length + 1);
  return new Set(sites.slice(0, n));
}

// ================= end MOCK =================

function student(): { code: string; name: string } | null {
  try {
    const s = JSON.parse(localStorage.getItem(K.student) || 'null');
    return s && findClass(s.code) && findClass(s.code)!.roster.includes(s.name) ? s : null;
  } catch { return null; }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const classLink = (code: string) => location.origin + location.pathname + '?class=' + code;

// ⚠️ NO BACKTICKS below (see hud.ts, three times in one session)
const css = `
#hud .school-veil {
  position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center;
  padding: 14px; background: rgba(12, 17, 24, 0.5); opacity: 0; pointer-events: none; transition: opacity 0.22s ease;
}
#hud .school-veil.show { opacity: 1; pointer-events: auto; }
#hud .sc-card {
  position: relative; width: min(400px, 94vw); max-height: 88vh; overflow-y: auto;
  background: var(--panel); border: 1px solid rgba(var(--gold-rgb),0.55); border-bottom: 3px solid var(--gold);
  border-radius: 16px; padding: 20px; box-shadow: var(--shadow-card); color: var(--ink);
}
#hud .sc-card.wide { width: min(880px, 96vw); }
#hud .sc-x { position: absolute; top: 10px; right: 10px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; pointer-events: auto; }
#hud .sc-kick { font-size: 11px; letter-spacing: 1.4px; color: var(--gold); font-weight: 700; margin-bottom: 6px; }
#hud .sc-title { font-family: Georgia, serif; font-size: 21px; margin: 0 30px 10px 0; }
#hud .sc-body { font-size: 13.5px; line-height: 1.5; color: var(--ink); }
#hud .sc-note { font-size: 11.5px; line-height: 1.45; color: var(--ink-dim); margin-top: 8px; }
#hud .sc-hr { border-top: 1px solid rgba(var(--ink-rgb),0.14); margin: 13px 0; }
#hud .sc-btn {
  margin-top: 12px; padding: 12px 14px; border-radius: 12px; text-align: center; font-weight: 800; font-size: 14px;
  background: linear-gradient(160deg, rgba(var(--gold-rgb),0.32), rgba(var(--gold-rgb),0.14));
  border: 1px solid rgba(var(--gold-rgb),0.6); color: var(--ink); cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .sc-btn:hover { border-color: var(--gold); }
#hud .sc-btn:active { transform: scale(0.97); }
#hud .sc-btn.quiet { background: none; border: 1px dashed rgba(var(--gold-rgb),0.5); font-weight: 700; }
#hud .sc-input, #hud .sc-area {
  width: 100%; box-sizing: border-box; margin-top: 8px; padding: 11px 12px; border-radius: 10px; font-size: 14px;
  background: rgba(0,0,0,0.28); border: 1.5px solid rgba(var(--ink-rgb),0.3); color: var(--ink); outline: none;
}
#hud .sc-input:focus, #hud .sc-area:focus { border-color: var(--gold); box-shadow: 0 0 0 3px rgba(var(--gold-rgb),0.2); }
#hud .sc-area { min-height: 110px; resize: vertical; font-family: inherit; line-height: 1.6; }
#hud .sc-err { font-size: 12px; color: #e8a89a; margin-top: 7px; min-height: 1em; }
#hud .sc-tiny { font-size: 11px; color: var(--ink-dim); cursor: pointer; user-select: none; -webkit-user-select: none; }
#hud .sc-tiny:hover { color: var(--gold); }
#hud .sc-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 14px; }
/* dashboard */
#hud .sc-tabs { display: flex; gap: 4px; margin: 10px 0 0; border-bottom: 1px solid rgba(var(--gold-rgb),0.35); }
#hud .sc-tab { padding: 8px 14px; border-radius: 9px 9px 0 0; font-size: 13px; font-weight: 700; color: var(--ink-dim); cursor: pointer; user-select: none; -webkit-user-select: none; }
#hud .sc-tab.on { color: var(--ink); background: rgba(var(--gold-rgb),0.18); }
#hud .sc-pane { padding-top: 13px; }
#hud .sc-grid { overflow-x: auto; }
#hud .sc-grid table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
#hud .sc-grid th { font-size: 10px; color: var(--ink-dim); font-weight: 700; text-align: center; padding: 4px 6px; white-space: nowrap; }
#hud .sc-grid th:first-child, #hud .sc-grid td:first-child { text-align: left; font-weight: 700; }
#hud .sc-grid td { border: 1px solid rgba(var(--ink-rgb),0.12); text-align: center; padding: 6px; min-width: 42px; }
#hud .sc-grid tr.flag td { background: rgba(var(--gold-rgb),0.14); }
#hud .sc-grid td.tot { font-weight: 800; white-space: nowrap; }
#hud .sc-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px; }
#hud .sc-wcard { border: 1px solid rgba(var(--ink-rgb),0.25); border-radius: 12px; padding: 12px; cursor: pointer; user-select: none; -webkit-user-select: none; }
#hud .sc-wcard:hover { border-color: var(--gold); }
#hud .sc-wcard.on { border-color: var(--gold); background: rgba(var(--gold-rgb),0.16); }
#hud .sc-wname { font-size: 14.5px; font-weight: 800; }
#hud .sc-wsub { font-size: 11.5px; color: var(--ink-dim); margin-top: 3px; line-height: 1.4; }
#hud .sc-wtag { font-size: 10px; font-weight: 800; color: var(--gold-bright); margin-top: 6px; letter-spacing: 0.5px; }
#hud .sc-chips { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 8px; }
#hud .sc-chip { display: flex; align-items: center; gap: 6px; border: 1px solid rgba(var(--ink-rgb),0.3); border-radius: 999px; padding: 5px 10px; font-size: 12.5px; font-weight: 700; }
#hud .sc-chip span { cursor: pointer; color: var(--ink-dim); }
#hud .sc-chip span:hover { color: #e8a89a; }
#hud .sc-mono { font-family: ui-monospace, Menlo, monospace; font-size: 12px; word-break: break-all; }
#hud .sc-copy { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
#hud .sc-copy .sc-input { margin-top: 0; flex: 1; }
#hud .sc-copy .sc-btn { margin-top: 0; padding: 10px 12px; flex: none; font-size: 12px; }
#hud .sc-danger { color: #e8a89a; border-color: rgba(232,168,154,0.5); }
/* class list rows (admin room) */
#hud .sc-crow { display: flex; align-items: center; gap: 10px; border: 1px solid rgba(var(--ink-rgb),0.2); border-radius: 12px; padding: 10px 12px; margin-top: 8px; }
#hud .sc-crow b { font-size: 14px; }
#hud .sc-crow .sc-mono { color: var(--ink-dim); }
#hud .sc-crow .sc-acts { margin-left: auto; display: flex; gap: 6px; }
#hud .sc-mini { border: 1px solid rgba(var(--gold-rgb),0.5); border-radius: 8px; padding: 5px 9px; font-size: 11px; font-weight: 700; cursor: pointer; user-select: none; -webkit-user-select: none; }
#hud .sc-mini:hover { background: rgba(var(--gold-rgb),0.18); }
/* the name grid */
#hud .sc-names { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 9px; margin-top: 12px; }
#hud .sc-name {
  padding: 13px 8px; border-radius: 12px; text-align: center; font-size: 15px; font-weight: 800;
  border: 1.5px solid rgba(var(--ink-rgb),0.3); cursor: pointer; user-select: none; -webkit-user-select: none;
}
#hud .sc-name:hover { border-color: var(--gold); background: rgba(var(--gold-rgb),0.14); }
/* the kid week panel */
#hud .sc-prog { height: 12px; border-radius: 6px; background: rgba(0,0,0,0.35); border: 1px solid rgba(var(--ink-rgb),0.25); overflow: hidden; margin: 10px 0 4px; }
#hud .sc-prog i { display: block; height: 100%; background: var(--gold); transition: width 0.5s ease; }
#hud .sc-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 3px 18px; margin-top: 10px; }
#hud .sc-li { display: flex; align-items: center; gap: 9px; font-size: 13.5px; padding: 5px 0; }
#hud .sc-box { width: 20px; height: 20px; border-radius: 6px; border: 1.5px solid rgba(var(--ink-rgb),0.4); flex: none; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; }
#hud .sc-box.done { border-color: var(--gold); background: rgba(var(--gold-rgb),0.25); color: var(--gold-bright); }
`;

export function initSchool() {
  // pilot towns only — everywhere else the game is exactly what it was
  if (TOWN.id !== 'nbpt') return;
  const hud = document.getElementById('hud');
  if (!hud) return;

  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const veil = document.createElement('div');
  veil.className = 'school-veil';
  hud.appendChild(veil);
  hud.classList.add('has-class');

  const close = () => veil.classList.remove('show');
  veil.addEventListener('pointerdown', (e) => { if (e.target === veil) close(); });
  window.addEventListener('keydown', (e) => { if (e.code === 'Escape') close(); });

  // one card, many faces — each render swaps the card's innerHTML and wires it
  function card(inner: string, wide = false): HTMLElement {
    veil.innerHTML = '<div class="sc-card' + (wide ? ' wide' : '') + '">' +
      '<div class="modal-x sc-x">✕</div>' + inner + '</div>';
    veil.classList.add('show');
    const c = veil.firstElementChild as HTMLElement;
    (c.querySelector('.sc-x') as HTMLElement).addEventListener('click', close);
    // typing in any school input must not steer the dog
    c.querySelectorAll('input, textarea').forEach((el) =>
      el.addEventListener('keydown', (e) => e.stopPropagation()));
    return c;
  }
  const on = (root: HTMLElement, sel: string, fn: (el: HTMLElement) => void) => {
    const el = root.querySelector(sel) as HTMLElement | null;
    if (el) el.addEventListener('click', () => fn(el));
  };
  const copyBtn = (root: HTMLElement, sel: string, text: () => string) => {
    on(root, sel, (el) => {
      try { navigator.clipboard.writeText(text()); el.textContent = 'copied ✓'; setTimeout(() => { el.textContent = 'copy'; }, 1400); }
      catch { el.textContent = text(); }
    });
  };

  // ---------- state A: the School sheet (inert for kids) ----------
  function sheet(err?: string) {
    const c = card(
      '<div class="sc-kick">🍎 CLASS</div>' +
      '<div class="sc-title">School</div>' +
      '<div class="sc-body">Playing with your class? Open the link your teacher shared and tap your name — that’s the whole thing.</div>' +
      (err ? '<div class="sc-err">' + esc(err) + '</div>' : '') +
      '<div class="sc-hr"></div>' +
      '<div class="sc-note">Teachers: your key opens your class. Admins — same door.</div>' +
      '<div class="sc-btn" data-act="teach">I’m a teacher →</div>'
    );
    on(c, '[data-act="teach"]', () => keybox());
  }

  // ---------- state A2: the key box (one box, two kinds of key) ----------
  function keybox() {
    const c = card(
      '<div class="sc-kick">🍎 FOR TEACHERS</div>' +
      '<div class="sc-title">Teacher sign-in</div>' +
      '<div class="sc-body">Paste your key. It was handed to you by a QuestVille admin when your class was made — no account, no password, no email.</div>' +
      '<input class="sc-input" placeholder="paste your key…" spellcheck="false">' +
      '<div class="sc-err"></div>' +
      '<div class="sc-btn" data-act="open">Open my class</div>' +
      '<div class="sc-note">Keys come from the admins. Lost yours? An admin can show it to you again. An admin key works in the same box — it opens the admin room.</div>' +
      '<div class="sc-foot"><div class="sc-tiny" data-act="back">‹ back</div></div>'
    );
    const inp = c.querySelector('.sc-input') as HTMLInputElement;
    const err = c.querySelector('.sc-err') as HTMLElement;
    const submit = () => {
      const key = inp.value.trim();
      if (isAdminKey(key)) { localStorage.setItem(K.akey, key); admin(); return; }
      const cl = classByTeacherKey(key);
      if (cl) { localStorage.setItem(K.tkey, key); dash(cl, 'live'); return; }
      err.textContent = key ? 'that key doesn’t open anything — check with an admin' : '';
    };
    on(c, '[data-act="open"]', submit);
    inp.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') submit(); });
    on(c, '[data-act="back"]', () => sheet());
    inp.focus();
  }

  // ---------- state B: the teacher dashboard (Live · Week · Quiz · Class) ----------
  function dash(cl: ClassDef, tab: 'live' | 'week' | 'quiz' | 'class') {
    const wk = cl.week === 'free' ? null : WEEKS[cl.week];
    const tabs = (['live', 'week', 'quiz', 'class'] as const).map((t) =>
      '<div class="sc-tab' + (t === tab ? ' on' : '') + '" data-tab="' + t + '">' + t[0].toUpperCase() + t.slice(1) + '</div>').join('');
    let pane = '';
    if (tab === 'live') {
      if (!wk) pane = '<div class="sc-body">Free roam this week — no list, nothing to track. Pick a part under Week when the unit starts.</div>';
      else {
        const shown = wk.sites.slice(0, 5);
        const rows = cl.roster
          .map((kid) => ({ kid, found: mockFound(cl, kid, wk.sites) }))
          .sort((a, b) => a.found.size - b.found.size)
          .map(({ kid, found }) =>
            '<tr' + (found.size === 0 ? ' class="flag"' : '') + '><td>' + esc(kid) + '</td>' +
            shown.map((s) => '<td>' + (found.has(s) ? '✓' : '') + '</td>').join('') +
            (wk.sites.length > shown.length ? '<td>·</td>' : '') +
            '<td class="tot">' + found.size + ' / ' + wk.sites.length + (found.size === 0 ? ' ⚑' : '') + '</td></tr>')
          .join('');
        pane =
          '<div class="sc-body">This week: <b>' + wk.name + '</b> · ' + wk.sites.length + ' places</div>' +
          '<div class="sc-grid" style="margin-top:9px;"><table><tr><th>NAME</th>' +
          shown.map((s) => '<th>' + esc(siteTitle(s)) + '</th>').join('') +
          (wk.sites.length > shown.length ? '<th>…+' + (wk.sites.length - shown.length) + '</th>' : '') +
          '<th>FOUND</th></tr>' + rows + '</table></div>' +
          '<div class="sc-note">⚑ nothing found floats to the top — that’s who needs a nudge. Demo numbers for now; the live view goes real with the classroom backend.</div>';
      }
    } else if (tab === 'week') {
      const cards = (Object.keys(WEEKS) as (keyof typeof WEEKS)[]).map((id) => {
        const w = WEEKS[id];
        return '<div class="sc-wcard' + (cl.week === id ? ' on' : '') + '" data-week="' + id + '">' +
          '<div class="sc-wname">' + w.em + ' ' + w.name + '</div><div class="sc-wsub">' + w.sub + ' · ' + w.sites.length + ' places</div>' +
          (cl.week === id ? '<div class="sc-wtag">THIS WEEK ✓</div>' : '') + '</div>';
      }).join('') +
        '<div class="sc-wcard' + (cl.week === 'free' ? ' on' : '') + '" data-week="free">' +
        '<div class="sc-wname">🐾 Free roam</div><div class="sc-wsub">No list — everything open. Good for the last session.</div>' +
        (cl.week === 'free' ? '<div class="sc-wtag">THIS WEEK ✓</div>' : '') + '</div>';
      pane = '<div class="sc-body">Pick what this week’s find-list shows. The town itself is never fenced — kids can always wander.</div>' +
        '<div class="sc-cards" style="margin-top:10px;">' + cards + '</div>';
    } else if (tab === 'quiz') {
      pane =
        '<div class="sc-body">Same short quiz, twice: once before the unit, once after. Five minutes each — you choose when.</div>' +
        '<div class="sc-btn quiet" style="text-align:left;">Start-of-unit quiz — <b>arrives with the classroom backend</b></div>' +
        '<div class="sc-btn quiet" style="text-align:left;">End-of-unit quiz — locked until you open it</div>' +
        '<div class="sc-note">Results land here side by side, per kid, once both quizzes exist. That table is the “shows what they learned” from the teacher one-pager.</div>';
    } else {
      const editable = cl.code !== DEMO_CLASS.code;
      pane =
        '<div class="sc-body"><b>Class list · ' + cl.roster.length + '</b></div>' +
        '<div class="sc-chips">' + cl.roster.map((n) =>
          '<div class="sc-chip">' + esc(n) + (editable ? '<span data-rm="' + esc(n) + '">✕</span>' : '') + '</div>').join('') + '</div>' +
        (editable ? '<div class="sc-copy"><input class="sc-input" data-add placeholder="add a first name…" maxlength="12"><div class="sc-btn" data-act="add">add</div></div><div class="sc-err"></div>' :
          '<div class="sc-note">This is the demo class — its list is baked in.</div>') +
        '<div class="sc-hr"></div>' +
        '<div class="sc-body"><b>Share</b></div>' +
        '<div class="sc-copy"><input class="sc-input sc-mono" readonly value="' + esc(classLink(cl.code)) + '"><div class="sc-btn" data-act="copy">copy</div></div>' +
        '<div class="sc-note">Or the code, if typing is easier: <b>' + esc(cl.code) + '</b></div>' +
        '<div class="sc-hr"></div>' +
        '<div class="sc-note">Need the class deleted, a key reissued, or a second class? Those are admin moves — ask a QuestVille admin. Deleting removes every name and answer, permanently.</div>';
    }
    const c = card(
      '<div class="sc-kick">🍎 ' + esc(cl.name).toUpperCase() + '</div>' +
      '<div class="sc-tabs">' + tabs + '</div><div class="sc-pane">' + pane + '</div>' +
      '<div class="sc-foot"><div class="sc-tiny" data-act="out">sign out of this class on this device</div></div>',
      true);
    c.querySelectorAll('.sc-tab').forEach((t) => t.addEventListener('click', () =>
      dash(findClass(cl.code) || cl, (t as HTMLElement).dataset.tab as 'live')));
    c.querySelectorAll('[data-week]').forEach((w) => w.addEventListener('click', () => {
      setWeek(cl.code, (w as HTMLElement).dataset.week as WeekId);
      dash(findClass(cl.code) || cl, 'week');
    }));
    c.querySelectorAll('[data-rm]').forEach((x) => x.addEventListener('click', () => {
      updateRoster(cl.code, cl.roster.filter((n) => n !== (x as HTMLElement).dataset.rm));
      dash(findClass(cl.code) || cl, 'class');
    }));
    on(c, '[data-act="add"]', () => {
      const inp = c.querySelector('[data-add]') as HTMLInputElement;
      const err = c.querySelector('.sc-err') as HTMLElement;
      const name = inp.value.trim();
      if (!name) return;
      if (!nameIsClean(name)) { err.textContent = 'that name isn’t allowed — try another!'; return; }
      updateRoster(cl.code, [...cl.roster, name]);
      dash(findClass(cl.code) || cl, 'class');
    });
    copyBtn(c, '[data-act="copy"]', () => classLink(cl.code));
    on(c, '[data-act="out"]', () => { localStorage.removeItem(K.tkey); sheet(); });
  }

  // ---------- the admin room (admin key) ----------
  function admin(made?: ClassDef) {
    const rows = allClasses().map((cl) =>
      '<div class="sc-crow"><b>' + esc(cl.name) + '</b><span class="sc-mono">' + esc(cl.code) + '</span>' +
      '<div class="sc-acts"><div class="sc-mini" data-open="' + esc(cl.code) + '">dashboard</div>' +
      '<div class="sc-mini" data-key="' + esc(cl.code) + '">key</div>' +
      (cl.code !== DEMO_CLASS.code ? '<div class="sc-mini sc-danger" data-del="' + esc(cl.code) + '">delete</div>' : '') +
      '</div></div>').join('');
    const handoff = made ?
      '<div class="sc-hr"></div><div class="sc-body"><b>Ready — hand these to the teacher</b></div>' +
      '<div class="sc-copy"><input class="sc-input sc-mono" readonly value="' + esc(classLink(made.code)) + '"><div class="sc-btn" data-act="cplink">copy</div></div>' +
      '<div class="sc-note">Class code: <b>' + esc(made.code) + '</b> · Teacher key (their sign-in — give it to them): </div>' +
      '<div class="sc-copy"><input class="sc-input sc-mono" readonly value="' + esc(made.tkey) + '"><div class="sc-btn" data-act="cpkey">copy</div></div>' : '';
    const c = card(
      '<div class="sc-kick">🔑 ADMIN ROOM</div>' +
      '<div class="sc-title">Classes at this school</div>' +
      rows + handoff +
      '<div class="sc-hr"></div>' +
      '<div class="sc-body"><b>+ Create a class</b></div>' +
      '<input class="sc-input" data-cname placeholder="class name — what students see (Ms. Rivera’s class)" maxlength="40">' +
      '<textarea class="sc-area" data-croster placeholder="class list — one first name per line"></textarea>' +
      '<div class="sc-err"></div>' +
      '<div class="sc-btn" data-act="create">Create class</div>' +
      '<div class="sc-note">First names only — the game’s kid-safe name filter runs on every line, and the list is everything we ever know about a student. (Demo mode: classes live on this device until the classroom backend lands.)</div>' +
      '<div class="sc-foot"><div class="sc-tiny" data-act="out">sign out of the admin room on this device</div></div>',
      true);
    c.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
      const cl = findClass((b as HTMLElement).dataset.open!);
      if (cl) dash(cl, 'live');
    }));
    c.querySelectorAll('[data-key]').forEach((b) => b.addEventListener('click', () => {
      const cl = findClass((b as HTMLElement).dataset.key!);
      if (cl) { (b as HTMLElement).textContent = cl.tkey; (b as HTMLElement).classList.remove('sc-mini'); (b as HTMLElement).classList.add('sc-mono'); }
    }));
    c.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      // same arm-then-confirm as the race clock's quit: a stray tap deletes nothing
      const el = b as HTMLElement;
      if (el.dataset.armed) { deleteClass(el.dataset.del!); admin(); }
      else { el.dataset.armed = '1'; el.textContent = 'DELETE — every name and answer, forever?'; setTimeout(() => { delete el.dataset.armed; el.textContent = 'delete'; }, 6000); }
    }));
    on(c, '[data-act="create"]', () => {
      const name = (c.querySelector('[data-cname]') as HTMLInputElement).value.trim();
      const lines = (c.querySelector('[data-croster]') as HTMLTextAreaElement).value
        .split('\n').map((l) => l.trim()).filter(Boolean);
      const err = c.querySelector('.sc-err') as HTMLElement;
      if (!name) { err.textContent = 'give the class a name'; return; }
      if (!lines.length) { err.textContent = 'paste at least one first name'; return; }
      if (lines.length > 35) { err.textContent = 'that’s more than 35 names — split the group'; return; }
      const bad = lines.find((l) => l.length > 12 || !nameIsClean(l));
      if (bad) { err.textContent = '“' + bad + '” isn’t allowed — first names only, 12 letters max'; return; }
      admin(mintClass(name, lines));
    });
    copyBtn(c, '[data-act="cplink"]', () => classLink(made!.code));
    copyBtn(c, '[data-act="cpkey"]', () => made!.tkey);
    on(c, '[data-act="out"]', () => { localStorage.removeItem(K.akey); sheet(); });
  }

  // ---------- state C: the class-link boot + the kid's week ----------
  function names(cl: ClassDef) {
    const c = card(
      '<div class="sc-kick">🍎 ' + esc(cl.name).toUpperCase() + '</div>' +
      '<div class="sc-title">Tap your name to play</div>' +
      '<div class="sc-names">' + cl.roster.map((n) => '<div class="sc-name" data-n="' + esc(n) + '">' + esc(n) + '</div>').join('') + '</div>' +
      '<div class="sc-note" style="text-align:center;">No passwords. Ever. Wrong class? Ask your teacher for the right link.</div>',
      true);
    c.querySelectorAll('.sc-name').forEach((b) => b.addEventListener('click', () => confirmName(cl, (b as HTMLElement).dataset.n!)));
  }
  function confirmName(cl: ClassDef, name: string) {
    const c = card(
      '<div class="sc-kick">🍎 ' + esc(cl.name).toUpperCase() + '</div>' +
      '<div class="sc-title">You’re <b>' + esc(name) + '</b> — right?</div>' +
      '<div class="sc-btn" data-act="yes">Yes, that’s me!</div>' +
      '<div class="sc-btn quiet" data-act="no">No, go back</div>'
    );
    on(c, '[data-act="yes"]', () => {
      localStorage.setItem(K.student, JSON.stringify({ code: cl.code, name }));
      // eat the ?class= so a reload doesn't re-run the join
      const url = new URL(location.href);
      url.searchParams.delete('class');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      week();
    });
    on(c, '[data-act="no"]', () => names(cl));
  }
  function week() {
    const me = student();
    if (!me) { sheet(); return; }
    const cl = findClass(me.code)!;
    const wk = cl.week === 'free' ? null : WEEKS[cl.week];
    let body: string;
    if (!wk) {
      body = '<div class="sc-body">Free roam this week — the whole town is yours. Go find something.</div>';
    } else {
      const real = foundSet();
      const got = wk.sites.filter((s) => real.has(s));
      body =
        '<div class="sc-body">This week: <b>' + wk.em + ' ' + wk.name + '</b></div>' +
        '<div class="sc-prog"><i style="width:' + Math.round((got.length / wk.sites.length) * 100) + '%"></i></div>' +
        '<div class="sc-body"><b>' + got.length + ' of ' + wk.sites.length + '</b> found</div>' +
        '<div class="sc-list">' + wk.sites.map((s) =>
          '<div class="sc-li"><div class="sc-box' + (real.has(s) ? ' done' : '') + '">' + (real.has(s) ? '✓' : '') + '</div>' + esc(siteTitle(s)) + '</div>').join('') + '</div>';
    }
    const c = card(
      '<div class="sc-kick">🍎 ' + esc(cl.name).toUpperCase() + '</div>' + body +
      '<div class="sc-foot"><div class="sc-tiny" data-act="switch">You are <b>' + esc(me.name) + '</b> · not you?</div>' +
      '<div class="sc-tiny" data-act="teach">Teachers ▸</div></div>',
      true);
    on(c, '[data-act="switch"]', () => names(cl));
    on(c, '[data-act="teach"]', () => keybox());
  }

  // ---------- the 🍎 button: one door, three states ----------
  (hud.querySelector('.class-btn') as HTMLElement).addEventListener('click', () => {
    const akey = localStorage.getItem(K.akey) || '';
    if (akey && isAdminKey(akey)) { admin(); return; }
    const tkey = localStorage.getItem(K.tkey) || '';
    const tcl = tkey ? classByTeacherKey(tkey) : null;
    if (tcl) { dash(tcl, 'live'); return; }
    if (student()) { week(); return; }
    sheet();
  });

  // a class link boots straight to the name grid (unknown code: the sheet says so)
  const joinCode = new URLSearchParams(location.search).get('class');
  if (joinCode) {
    const cl = findClass(joinCode);
    if (cl) names(cl);
    else sheet('that class link doesn’t work — ask your teacher for a new one');
  }
}
