// Shared shapes + catalog for the two HUD systems the QuestRunner feeds:
//  • the Backpack (🎒) — what you carry / keep / collect
//  • the Missions log (🧭) — grouped, scalable quest cards with sub-step checklists
// QuestRunner.apply() builds arrays of these; the Hud renders them. One source of
// truth so adding a future mission or item is a data change, not new UI.

// ---------- Backpack ----------

// carry   = transient quest items you're holding right now (handed off later)
// treasure = keepsakes/tools you earn and keep forever
// collection = a countable set (x of N) — e.g. the four map corners
export type BagKind = 'carry' | 'treasure' | 'collection';

export interface BagItem {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  kind: BagKind;
  count?: number;   // collection: owned so far
  total?: number;   // collection: full set size
  opens?: string;   // collection: a hook the bag panel can fire (e.g. 'history-album')
}

// ---------- Missions ----------

export type MissionGroup = 'story' | 'jobs' | 'collections';
export type MissionState = 'locked' | 'active' | 'done';

export interface SubStep {
  label: string;
  done: boolean;
  count?: number;   // optional progress, rendered inline as "count/total" (e.g. 3/8)
  total?: number;
}

export interface Mission {
  id: string;
  group: MissionGroup;
  title: string;
  kicker?: string;        // small label over the title — "Chapter 3" / "Town Job"
  state: MissionState;
  steps: SubStep[];       // the expandable checklist
  reward?: string;        // shown as a small "Reward · 🚲 Bike" line
  count?: number;         // mission-level progress (collections), e.g. 1 of 4
  total?: number;
  active?: boolean;       // the one mission that currently owns the objective beacon
  replay?: number;        // chapter index (0-4) for the ↻ replay-cascade control
  opens?: string;         // collections: 'history-album' etc.
}

// ---------- the item catalog (names + descriptions live here, once) ----------

export const ITEMS: Record<string, Omit<BagItem, 'count' | 'total'>> = {
  book:    { id: 'book',    emoji: '\u{1F4D5}', kind: 'carry',
             name: 'Overdue library book', desc: 'Three weeks late — Gram wants it back.' },
  donuts:  { id: 'donuts',  emoji: '\u{1F369}', kind: 'carry',
             name: 'A dozen angry donuts', desc: 'Gram’s order from the Angry Donut.' },
  papers:  { id: 'papers',  emoji: '\u{1F4F0}', kind: 'carry',
             name: 'The Daily News', desc: 'Papers to deliver on your route.' },
  card:    { id: 'card',    emoji: '\u{1FAAA}', kind: 'treasure',
             name: 'Your library card', desc: 'Your very own, finally.' },
  lantern: { id: 'lantern', emoji: '\u{1FA94}', kind: 'treasure',
             name: 'The smugglers’ lantern', desc: 'Found in the tunnel under downtown.' },
  bike:    { id: 'bike',    emoji: '\u{1F6B2}', kind: 'treasure',
             name: 'Your bicycle', desc: 'Press B to hop on and ride.' },
  // the map corners are ONE collection (x of 4), not four copies of a chip
  mapcorners: { id: 'mapcorners', emoji: '\u{1F9E9}', kind: 'collection',
             name: 'Smugglers’ map', desc: 'Torn corners of an old hand-drawn map.' }
};

// reverse lookup for the pre-spine STEP_CHIPS emoji arrays (book/donuts/card only)
export const EMOJI_TO_ID: Record<string, string> = {
  '\u{1F4D5}': 'book',
  '\u{1F369}': 'donuts',
  '\u{1FAAA}': 'card'
};
