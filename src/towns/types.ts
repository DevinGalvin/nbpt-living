// The TownPack — everything the shared engine needs to know about a town.
// One pack per town under src/towns/<id>/; the build selects one via the
// `@town` alias (TOWN env → vite.config.ts), so engine code imports
// `import { TOWN } from '@town'` and never hardcodes a town again.
//
// Map geometry/landmarks/POIs come from world.json (built per town by
// tools/build_world.mjs from towns/<id>/{town.json,map.mjs}) — the pack only
// carries what lives in CODE: gameplay anchors, branding, tuning, courses.

import type { Course } from '../game/race';

export type Vec2 = { x: number; z: number };

// Where a town drops you on first visit. It is NOT a raw coordinate — it names
// one of the town's curated landmarks (its "heart": Market Square, Essex St
// Mall, Ellis Square) so every town lands the player at a real, celebrated,
// *named* place, never an anonymous point. `dx/dz` fine-tune from that
// landmark's centre onto walkable ground (world-px; +z = south). Declared once
// in `towns/<id>/town.json` and validated by tools/check_town_spawn.mjs, which
// fails the build if the named landmark doesn't exist. See docs/TOWNS.md.
export type SpawnAnchor = { landmark: string; dx?: number; dz?: number };

export interface TownPack {
  id: string;
  name: string;          // "Newburyport"
  title: string;         // console/brand line, e.g. "Clipper Town"
  tag: string;           // "Clipper City"
  emoji: string;
  path: string;          // site path this town deploys under ('/', '/salem/')

  // false = world-only sandbox: no quest/history/eggs/interiors/drawbridge —
  // the story spine belongs to towns that have authored one. `?story` in the
  // URL force-enables it for development.
  story: boolean;

  spawn: SpawnAnchor;    // first-visit drop point — the town's heart landmark (see SpawnAnchor)

  // ✈️ scenic flight — where you board and how the promo talks about it
  flight: {
    runwayStart: Vec2;
    runwayHdg: number;
    airport: { x: number; z: number; r: number };
    liftoffMsg: string;
    promoBody: string;
    promoCta: string;
  };

  // geography knobs the renderer/collision read (world-px)
  beachX: number;                                                  // east of this = barrier-beach sand zone (Infinity = none)
  // Weathered-cedar-SHINGLE districts: circles where the houses are shingled, not
  // painted clapboard. Neighbor villages inside a flagship town's frame (Rockport
  // inside Gloucester, Manchester inside Beverly) were being painted from the
  // Newburyport painted-clapboard palette, which made them read as rows of pale
  // institutional blocks instead of gray fishing-village shacks. `p` = share of
  // houses shingled, 0..1 (the rest keep the painted palette — real villages mix).
  shingleZones?: { x: number; z: number; r: number; p?: number }[];
  // Share of commercial/civic blocks built of STONE rather than brick, 0..1
  // (STYLE.building.wallsStone). Omit for a town whose downtown really is all
  // one material — Newburyport's is, having been rebuilt in brick after the
  // Great Fire. A city's is not, and rendering Boston's entirely in brick red
  // was the single biggest reason it read as repetitive.
  masonryMix?: number;
  sledLane: { x: number; z0: number; z1: number; halfW: number } | null;   // decor: kept clear of trees for sledding
  trainPlatform: Vec2 | null;                                      // decor: commuter-rail platform set piece
  holidayTree: Vec2 | null;                                        // winter: the town tree (null = none)

  // ambient-life seasonal attractions (null = the town skips that behavior)
  attractions: {
    frogPond: Vec2 | null;                                  // winter skaters loop here
    sledHill: { top: Vec2; dir: Vec2; run: number } | null; // winter sledders
    graveyard: Vec2 | null;                                 // fall graveyard mist + the witch circles here
  };

  // fall atmosphere (Halloween towns run moodier)
  fall: {
    fogRange: [number, number];
    hemiSky: string;
    hemiGround: string;
    hemiIntensity: number;
    duskStart: boolean;    // open the game at spooky dusk in fall
  };
  halloween: 'classic' | 'haunted';   // haunted = heavier decor: cobwebs everywhere, monsters
  halloweenDisplay: Vec2;             // where the fall pumpkin display builds

  // 🏁 racing
  courses: Course[];
  raceTown: string;      // leaderboard partition key + local ghost/board key prefix
  devCourse: string;     // `nbpt.race()` console default
  racePromo: { course: string; body: string };

  // HUD branding
  theme: {
    panel: string;
    maroon: string;      // "r, g, b"
    maroonLt: string;
    goldRgb: string;
    gold: string;
    goldMid: string;
    goldBright: string;
  };
  // one-liners under the "Entering …" town-line banner, keyed by municipality
  // name as mapped in OSM (optional — unlisted neighbors get no subtitle)
  borderLore?: Record<string, string>;

  searchPlaceholder: string;
  fallSeasonLine: string;   // season-card copy for fall
  streetNudge: string;      // first-visit "find your street" toast (HTML)
}
