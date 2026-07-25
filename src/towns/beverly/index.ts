// Beverly — Garden City, birthplace of America's Navy (the schooner Hannah,
// 1775 — Marblehead disputes it; we grin and claim it). World-only sandbox
// (no story spine), classic New England atmosphere, its own race ladder.
//
// ⚠️ Gameplay anchors below marked VERIFY are estimated from lat/lon and must
// be confirmed on the built world.json (on land, right feature) before ship.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import cfg from '../../../towns/beverly/town.json';

export const TOWN: TownPack = {
  id: 'beverly',
  name: 'Beverly',
  title: 'Beverly',
  tag: 'Garden City',
  emoji: '⛵',
  path: '/beverly/',

  story: false,   // world-only sandbox — ?story force-enables the (NBPT) spine for dev

  spawn: cfg.spawn as SpawnAnchor,   // Ellis Square, downtown by The Cabot — the town's heart (see town.json)

  // ✈️ scenic flight from BEVERLY REGIONAL AIRPORT — a real working airfield
  // (est. 1928, Navy-paved in WWII). Board runway 16 and depart SSE over town,
  // exactly the real pattern. Endpoints read from the built runway way ("16/34").
  flight: {
    runwayStart: { x: -27000, z: -29500 },   // runway 16 threshold (NW end)
    runwayHdg: 0.69,                          // atan2(dx,dz) down the centerline → SSE
    airport: { x: -23700, z: -23800, r: 1600 },
    liftoffMsg: '✈️ Lifting off from Beverly Regional — steer to bank over town',
    promoBody: 'Scenic flights are open to everyone. Head to Beverly Regional Airport — a real airfield since 1928 — and tap ✈️ FLY to soar over the Garden City and the harbor. You can’t crash, promise.',
    promoCta: 'Take me to the airport',
  },

  beachX: Infinity,      // Beverly's beaches are mapped sand — no recolor zone
  // Manchester-by-the-Sea's village + shore: shingle-and-white, not the painted
  // clapboard palette (docs/research/rockport-manchester.md). Lighter mix than
  // Rockport — Manchester keeps more white clapboard.
  shingleZones: [{ x: 72000, z: -13000, r: 7000, p: 0.5 }],
  sledLane: null,        // Lynch Park's hill is the real one — needs terrain-verified geometry (handoff)
  trainPlatform: { x: -3580, z: 9509 },   // the Newburyport/Rockport line beside Beverly Depot
  holidayTree: { x: 1115, z: 6043 },      // Ellis Square, downtown's little crossroads park

  attractions: {
    frogPond: { x: 8890, z: -6487 },      // Kellehers Pond — THE pond-hockey pond
    sledHill: null,                        // Lynch Park hill — set with terrain-verified run (handoff)
    graveyard: { x: 1598, z: 8689 },       // Ancient Burial Ground (1672) — fall mist
  },

  // classic bright New England fall (Beverly is not a Halloween town)
  fall: {
    fogRange: [1050, 2500],
    hemiSky: '#f2e6cc',
    hemiGround: '#8a8058',
    hemiIntensity: 0.5,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: 900, z: 5900 },   // downtown Cabot St by Ellis Square

  courses: COURSES,
  raceTown: 'beverly',
  devCourse: 'homecoming',
  racePromo: {
    course: 'hannah',
    body: 'Real races on real streets! Three courses run through Beverly — dash Cabot Street to the wharf where the Hannah sailed, run the shore to Lynch Park, or ride home from Beverly Farms. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // BEVERLY palette: deep garden-green chrome + warm gold accent
  theme: {
    panel: 'linear-gradient(177deg, rgba(30,58,40,0.985), rgba(22,46,32,0.985) 58%, rgba(14,32,21,0.985))',
    maroon: '20, 44, 30',
    maroonLt: '34, 62, 44',
    goldRgb: '224, 178, 58',
    gold: '#e0b23a',
    goldMid: '#eec24a',
    goldBright: '#f8dc88',
  },
  borderLore: {
    'Beverly': "birthplace of America's Navy · inc. 1668",
    'Salem': 'the Witch City · est. 1626',
    'Danvers': 'old Salem Village · inc. 1752',
    'Wenham': 'incorporated 1643',
    'Manchester-by-the-Sea': 'incorporated 1645',
    'Hamilton': 'incorporated 1793',
    'Peabody': 'incorporated 1855',
    'Marblehead': 'settled 1629',
    'Essex': 'shipbuilding town · inc. 1819',
  },
  searchPlaceholder: 'Go anywhere… try “Cabot Street” or “Lynch Park”',
  fallSeasonLine: 'the leaves turn gold over the Garden City',
  streetNudge: '📍 This is the real map of Beverly.<br><b>Tap to find your street →</b>',
};
