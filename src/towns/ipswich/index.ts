// Ipswich — "The Birthplace of American Independence" (the 1687 tax revolt
// against Governor Andros), home of the famous Ipswich clam, and keeper of
// more surviving First Period houses than anywhere in America. World-only
// sandbox (no story spine), classic New England atmosphere, its own ladder.
//
// ⚠️ Gameplay anchors below marked VERIFY are estimated from lat/lon and must
// be confirmed on the built world.json (on land, right feature) before ship.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import { HISTORY } from './history';
import cfg from '../../../towns/ipswich/town.json';

export const TOWN: TownPack = {
  id: 'ipswich',
  name: 'Ipswich',
  title: 'Ipswich',
  tag: 'Birthplace of Independence',
  emoji: '🦪',
  path: '/ipswich/',

  story: false,   // world-only sandbox — ?story force-enables the (NBPT) spine for dev

  history: HISTORY,   // 🏛 22 discovery markers — see ./history.ts. Independent of `story`.

  spawn: cfg.spawn as SpawnAnchor,   // downtown heart landmark (see town.json)

  // ✈️ scenic flight from MOULTON'S FARM on Essex Road — where the Burgess
  // Company's Model D biplane made its first test flight on Nov 27, 1910, and
  // passenger flights followed (the same Burgess line that flew Plum Island).
  // Board in the old flying field and lift off east over the great marsh.
  flight: {
    runwayStart: { x: 21300, z: 16800 },      // the 1910 Burgess flying field — in the grass off Northgate Rd
    runwayHdg: 1.571,                          // depart due east — over the marsh toward Crane Beach
    airport: { x: 21240, z: 16950, r: 1500 },
    liftoffMsg: '✈️ Lifting off from Moulton’s Farm — first flown here in 1910',
    promoBody: 'Scenic flights are open to everyone. Head to the 1910 Burgess Flying Field on Essex Road — where Ipswich first took to the air — and tap ✈️ FLY to soar over the marsh, Crane Beach, and Castle Hill. You can’t crash, promise.',
    promoCta: 'Take me to the flying field',
  },

  beachX: Infinity,      // Crane Beach and the Neck beaches are mapped sand — no recolor zone
  sledLane: null,        // the Grand Allée is a mapped meadow — already tree-free
  trainPlatform: { x: 85, z: 2586 },      // Ipswich MBTA station (Newburyport/Rockport line, 1839)
  holidayTree: { x: 2380, z: -1030 },     // Five Corners — the WESTERN island (between the two tertiary N Main strands, NOT the wedge east of them); resident-pinpointed spot

  attractions: {
    frogPond: { x: 28497, z: -22102 },    // Clark Pond, Great Neck — dammed 1897, THE skating pond
    sledHill: { top: { x: 41400, z: -7900 }, dir: { x: 0.39, z: -0.92 }, run: 900 },   // the Grand Allée's first roll toward the sea (terrain-verified: drops ~10m, then the next hill rises)
    graveyard: { x: -688, z: -5403 },     // Old North Burying Ground (1634) — fall mist
  },

  // classic bright New England fall (Ipswich is a beach-and-river town, not a Halloween town)
  fall: {
    fogRange: [1050, 2500],
    hemiSky: '#f2e6cc',
    hemiGround: '#8a8058',
    hemiIntensity: 0.5,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: 3000, z: -1700 },   // Meeting House Green's south edge, facing downtown

  courses: COURSES,
  raceTown: 'ipswich',
  devCourse: 'homecoming',
  racePromo: {
    course: 'choate',
    body: 'Real races on real streets! Three courses run through Ipswich — dash over the 1764 Choate Bridge to the Town Wharf, run High Street to the Clam Box, or ride home from Castle Hill down Argilla Road. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // IPSWICH palette: deep estuary slate-blue chrome + warm marsh-gold accent
  theme: {
    panel: 'linear-gradient(177deg, rgba(29,60,82,0.985), rgba(21,48,66,0.985) 58%, rgba(13,30,42,0.985))',
    maroon: '18, 42, 58',
    maroonLt: '30, 58, 78',
    goldRgb: '224, 178, 58',
    gold: '#e0b23a',
    goldMid: '#eec24a',
    goldBright: '#f8dc88',
  },
  borderLore: {
    'Ipswich': 'birthplace of American independence · est. 1634',
    'Essex': 'shipbuilding town · inc. 1819',
    'Rowley': 'incorporated 1639',
    'Hamilton': 'incorporated 1793',
    'Topsfield': 'incorporated 1650',
    'Boxford': 'incorporated 1685',
    'Wenham': 'incorporated 1643',
    'Gloucester': "America's oldest seaport · est. 1623",
    'Newbury': 'settled 1635',
  },
  searchPlaceholder: 'Go anywhere… try “High Street” or “Crane Beach”',
  fallSeasonLine: 'the leaves turn gold along the Ipswich River',
  streetNudge: '📍 This is the real map of Ipswich.<br><b>Tap to find your street →</b>',
};
