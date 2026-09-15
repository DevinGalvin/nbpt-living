// Swansea — the town on Mount Hope Bay. Founded in 1667 by a Welsh Baptist
// minister and his congregation, named for the city they left; the place where
// King Philip's War began in June 1675; a village of stone gifts (the 1891 Town
// Hall, the 1900 library and Christ Church), a Route 6 strip, and a shore of
// summer cottages that turned into year-round homes. World-only sandbox (no
// story spine), classic New England atmosphere, its own ladder.
//
// Swansea is HIDDEN from the other towns' Fast-Travel roster (town.json
// `hidden`): it is a South Coast town built for one family, reachable at
// clippertown.io/swansea/ only. Everything else about it is a full town.
//
// Anchors are world-px read out of the BUILT world.json — address anchors
// (MassGIS-imported addr tags), named footprints, poly interior points — and
// water/land-checked. See towns/swansea/map.mjs + docs/research/swansea.md.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import { HISTORY } from './history';
import cfg from '../../../towns/swansea/town.json';

export const TOWN: TownPack = {
  id: 'swansea',
  name: 'Swansea',
  title: 'Swansea',
  tag: 'The Town on Mount Hope Bay',
  emoji: '🦢',
  path: '/swansea/',

  story: false,   // world-only sandbox — no authored spine (Newburyport is the only town with one)

  history: HISTORY,   // 🏛 discovery markers — see ./history.ts. Independent of `story`.

  spawn: cfg.spawn as SpawnAnchor,   // Town Hall on Main Street — the village heart (see town.json)

  // ✈️ scenic flight straight off the Town Beach at Ocean Grove. Swansea has no
  // airfield and the copy says so: board on the sand, climb out over Mount Hope
  // Bay toward the Braga Bridge and the battleship, then back up the Cole River.
  flight: {
    runwayStart: { x: -18817, z: 20430 },   // the sand at 560 Ocean Grove Ave (map.mjs manualFeatures) — waterline at z≈20500, bay beyond
    runwayHdg: 3.1416,                      // depart due south, out over the bay
    airport: { x: -18817, z: 20300, r: 1400 },
    liftoffMsg: '✈️ Lifting off the Town Beach — out over Mount Hope Bay',
    promoBody: 'Scenic flights are open to everyone. Walk onto the sand at the Town Beach in Ocean Grove and tap ✈️ FLY to soar over Mount Hope Bay — the Braga Bridge, the battleship at Fall River, then home up the Cole River. You can’t crash, promise.',
    promoCta: 'Take me to the Town Beach',
  },

  beachX: Infinity,      // the bay shore is short and unmapped as sand — no recolor zone
  // Route 6 is a strip of beige and grey boxes — split-face block, stucco, metal
  // panel — not a brick downtown: most commercial/civic stock goes to the stone
  // palette (the mall and the big boxes are heroes in their own liveries)
  masonryMix: 0.7,
  sledLane: { x: 520, z0: -5216, z1: -4416, halfW: 62 },   // Village Park's hill above the soccer field (terrain-verified: 28 m → 11 m over 100 m, northbound)
  trainPlatform: null,   // no passenger rail in Swansea — the rails in frame are Fall River's freight spur
  holidayTree: { x: -285, z: -967 },     // the Town Hall lawn on Main Street — Holiday in the Village lights it here

  attractions: {
    frogPond: { x: -2159, z: -3932 },    // the Village Park lake — the dam and waterfall are at its Main Street end
    sledHill: { top: { x: 520, z: -4416 }, dir: { x: 0, z: -1 }, run: 700 },   // Village Park, down toward the lake (terrain-verified)
    graveyard: { x: -5042, z: -2151 },   // Mount Hope Cemetery, off Milford Road — fall mist
    parade: { street: 'Main Street', toward: { x: -285, z: -967 } },   // Holiday in the Village: Santa comes down Main Street to the Town Hall
  },

  // classic bright New England fall (a bay-and-farm town, not a Halloween town)
  fall: {
    fogRange: [1050, 2500],
    hemiSky: '#f2e6cc',
    hemiGround: '#8a8058',
    hemiIntensity: 0.5,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: -120, z: -1120 },   // the lawn between Town Hall and the library

  courses: COURSES,
  raceTown: 'swansea',
  devCourse: 'homecoming',
  racePromo: {
    course: 'village',
    body: 'Real races on real streets! Three courses run through Swansea — dash from the Town Hall to the Venus de Milo, run Gardners Neck Road to the Town Beach, or ride home from Luther’s Corner to the village. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // SWANSEA palette: Mount Hope Bay teal chrome + a marsh-gold accent (the
  // library's granite-and-sandstone warmth)
  theme: {
    panel: 'linear-gradient(177deg, rgba(28,65,78,0.985), rgba(20,48,58,0.985) 58%, rgba(12,30,38,0.985))',
    maroon: '18, 44, 54',
    maroonLt: '28, 62, 74',
    goldRgb: '230, 179, 72',
    gold: '#e6b348',
    goldMid: '#f0c45a',
    goldBright: '#f9dd94',
  },
  borderLore: {
    'Swansea': 'the town on Mount Hope Bay · est. 1667',
    'Somerset': 'split off from Swansea in 1790',
    'Rehoboth': 'incorporated 1645',
    'Dighton': 'incorporated 1712',
    'Fall River': 'the Spindle City · a city since 1854',
    'Warren': 'Rhode Island · incorporated 1747',
    'Bristol': 'Rhode Island · King Philip’s Mount Hope · est. 1681',
    'Barrington': 'Rhode Island · Massasoit’s Sowams · inc. 1717',
    'Seekonk': 'incorporated 1812',
    'East Providence': 'Rhode Island · incorporated 1862',
  },
  searchPlaceholder: 'Go anywhere… try “Main Street” or “Ocean Grove”',
  fallSeasonLine: 'the leaves turn gold along the Cole River',
  streetNudge: '📍 This is the real map of Swansea.<br><b>Tap to find your street →</b>',
};
