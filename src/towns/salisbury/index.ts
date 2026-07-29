// Salisbury — four miles of barrier beach, a boardwalk full of arcades, and the
// marsh and river behind it. The town is really two places: Beach Center at the
// ocean end, and the Route 1 square inland. Newburyport sits across the mouth of
// the Merrimack. World-only sandbox (no story spine).
//
// Anchors are world-px read out of the BUILT world.json and point-in-polygon
// checked against the real municipal boundary — see towns/salisbury/map.mjs.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import { HISTORY } from './history';
import cfg from '../../../towns/salisbury/town.json';

export const TOWN: TownPack = {
  id: 'salisbury',
  name: 'Salisbury',
  title: 'Salisbury',
  tag: 'Where the Merrimack Meets the Sea',
  emoji: '🎡',
  path: '/salisbury/',

  story: false,   // world-only sandbox — ?story force-enables the (NBPT) spine for dev

  history: HISTORY,   // 🏛 13 discovery markers — see ./history.ts. Independent of `story`.

  spawn: cfg.spawn as SpawnAnchor,   // Salisbury Beach Center — the boardwalk is the whole point

  // ✈️ scenic flight straight off the beach. No invented airfield: Salisbury has
  // none, so the copy sells the run up four miles of sand to the state line and
  // back out over the river mouth.
  flight: {
    runwayStart: { x: 30490, z: 13192 },      // the open sand south of Beach Center
    runwayHdg: 0,                             // depart north, straight up the beach
    airport: { x: 30490, z: 13192, r: 1600 },
    liftoffMsg: '✈️ Lifting off the sand — climb out over the breakers',
    promoBody: 'Scenic flights are open to everyone. Walk out onto Salisbury Beach and tap ✈️ FLY to soar four miles of sand to the state line, then turn back over the river mouth and the marsh. You can’t crash, promise.',
    promoCta: 'Take me to the beach',
  },

  beachX: Infinity,      // the whole barrier beach is mapped sand — no recolor zone
  sledLane: null,
  trainPlatform: null,   // no rail in Salisbury (rails=0 in the build) — the old line is a rail trail
  holidayTree: { x: -948, z: 1850 },      // Salisbury Town Common

  attractions: {
    frogPond: null,                        // no pond that freezes hard enough to be the town's rink
    sledHill: null,                        // Salisbury is barrier beach and marsh — there is no hill
    graveyard: { x: 2604, z: 1433 },       // Old Colonial Burial Ground — fall mist
  },

  fall: {
    fogRange: [1100, 2600],
    hemiSky: '#e8ecf2',
    hemiGround: '#7c8490',
    hemiIntensity: 0.55,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: -948, z: 1850 },   // Salisbury Town Common

  courses: COURSES,
  raceTown: 'salisbury',
  devCourse: 'boardwalk',
  racePromo: {
    course: 'boardwalk',
    body: 'Real races on real streets! Sprint the boardwalk, run the beach road up the barrier, or take the long way round the marsh. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // SALISBURY palette: deep Atlantic blue + a boardwalk-bulb gold
  theme: {
    panel: 'linear-gradient(177deg, rgba(22,62,88,0.985), rgba(14,44,64,0.985) 58%, rgba(7,24,35,0.985))',
    maroon: '16, 48, 70',
    maroonLt: '26, 72, 100',
    goldRgb: '232, 177, 58',
    gold: '#e8b13a',
    goldMid: '#f2c352',
    goldBright: '#fbdd92',
  },
  borderLore: {
    'Salisbury': 'beach and marsh · incorporated 1640',
    'Newburyport': 'the Clipper City · across the river mouth',
    'Amesbury': 'the carriage town · split off in 1666',
    'Newbury': 'incorporated 1635',
    'Seabrook': 'New Hampshire · incorporated 1768',
    'Hampton': 'New Hampshire · settled 1638',
    'Hampton Falls': 'New Hampshire · incorporated 1726',
    'South Hampton': 'New Hampshire · incorporated 1742',
  },
  searchPlaceholder: 'Go anywhere… try “Beach Road” or “Broadway”',
  fallSeasonLine: 'the arcades shutter and the marsh goes gold',
  streetNudge: '📍 This is the real map of Salisbury.<br><b>Tap to find your street →</b>',
};
