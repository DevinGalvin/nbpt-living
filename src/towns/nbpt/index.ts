// Newburyport — the flagship town pack. Values here were extracted verbatim
// from the engine when the towns reunified; NBPT behavior is unchanged.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import { HISTORY } from './history';
import cfg from '../../../towns/nbpt/town.json';

export const TOWN: TownPack = {
  id: 'nbpt',
  name: 'Newburyport',
  title: 'Clipper Town',
  tag: 'Clipper City',
  emoji: '⚓',
  path: '/',

  story: true,
  history: HISTORY,                  // 🏛 36 discovery markers — see ./history.ts

  spawn: cfg.spawn as SpawnAnchor,   // Market Square (heart landmark; see town.json)

  // ✈️ scenic flight from Plum Island Airport (real Runway 10/28). Board at the
  // east threshold, roll + take off west (28) out over downtown + the harbor.
  flight: {
    runwayStart: { x: 21560, z: 14114 },  // east threshold (depart 28 / westbound)
    runwayHdg: -1.517,                    // runway 10/28 axis, heading ≈ due west
    // the whole-airfield zone the FLY prompt covers — centered on the runway, big
    // enough to reach both ends (±~2200) AND the airport landmark you arrive at
    // (~1250 N of center), so walking anywhere on the field offers the flight.
    airport: { x: 19468, z: 14228, r: 2300 },
    liftoffMsg: '✈️ Lifting off Runway 28 — steer to bank over town',
    promoBody: 'Scenic flights are open to everyone. Walk onto the grass at Plum Island Airport and tap ✈️ FLY to soar over Clipper Town — you can’t crash, promise.',
    promoCta: 'Take me to the airfield',
  },

  beachX: 29000,   // east of this = Plum Island's barrier beach
  sledLane: { x: 2534, z0: 8380, z1: 8650, halfW: 62 },   // March's Hill sledding lane
  trainPlatform: { x: -5450, z: 11790 },                   // MBTA Newburyport station
  holidayTree: { x: -100, z: -48 },                        // Market Square

  attractions: {
    frogPond: { x: -3273, z: 2964 },   // skaters loop on the frozen pond (Bartlet Mall)
    sledHill: { top: { x: 2534, z: 8380 }, dir: { x: 0, z: 1 }, run: 270 },   // March's Hill, due south to the flat
    graveyard: { x: -4418, z: 3470 },  // Old Hill Burying Ground
  },

  fall: {
    fogRange: [1050, 2500],
    hemiSky: '#f2e6cc',
    hemiGround: '#8a8058',
    hemiIntensity: 0.5,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: -100, z: -48 },   // Market Square

  courses: COURSES,
  raceTown: 'nbpt',
  devCourse: 'homecoming',
  racePromo: {
    course: 'southend',
    body: 'Real races on real streets! Three courses run through Clipper Town — sprint the South End, ride the river road home, or fly in from the lighthouse. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  theme: {
    panel: 'linear-gradient(177deg, rgba(58,29,37,0.985), rgba(42,20,25,0.985) 58%, rgba(30,14,20,0.985))',
    maroon: '46, 22, 28',
    maroonLt: '60, 30, 38',
    goldRgb: '216, 185, 74',
    gold: '#d8b94a',
    goldMid: '#e8c44f',
    goldBright: '#f6dd8a',
  },
  borderLore: {
    'Newburyport': 'the Clipper City · est. 1764',
    'Newbury': 'settled 1635',
    'Salisbury': 'settled 1638',
    'Amesbury': 'settled 1654',
    'West Newbury': 'incorporated 1819',
  },
  searchPlaceholder: 'Go anywhere… try “241 High Street” or “The Grog”',
  fallSeasonLine: 'the leaves redden over Clipper Town',
  streetNudge: '📍 This is the real map of Newburyport.<br><b>Tap to find your street →</b>',
};
