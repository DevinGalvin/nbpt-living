// Beverly — Garden City, birthplace of America's Navy (the schooner Hannah,
// 1775 — Marblehead disputes it; we grin and claim it). World-only sandbox
// (no story spine), classic New England atmosphere, its own race ladder.
//
// ⚠️ Gameplay anchors below marked VERIFY are estimated from lat/lon and must
// be confirmed on the built world.json (on land, right feature) before ship.
import type { TownPack } from '../types';
import { COURSES } from './courses';

export const TOWN: TownPack = {
  id: 'beverly',
  name: 'Beverly',
  title: 'Beverly',
  tag: 'Garden City',
  emoji: '⛵',
  path: '/beverly/',

  story: false,   // world-only sandbox — ?story force-enables the (NBPT) spine for dev

  spawn: { x: 0, z: 0 },   // VERIFY: Cabot St at City Hall (the town.json origin)

  // ✈️ scenic flight from BEVERLY REGIONAL AIRPORT — a real working airfield
  // (est. 1928). Board by the runway and lift off over the Garden City.
  flight: {
    runwayStart: { x: -23900, z: -23300 },   // VERIFY against the built runway
    runwayHdg: 2.79,                          // depart runway 16, SSE toward town
    airport: { x: -23900, z: -23300, r: 1600 },
    liftoffMsg: '✈️ Lifting off from Beverly Regional — steer to bank over town',
    promoBody: 'Scenic flights are open to everyone. Head to Beverly Regional Airport — a real airfield since 1928 — and tap ✈️ FLY to soar over the Garden City and the harbor. You can’t crash, promise.',
    promoCta: 'Take me to the airport',
  },

  beachX: Infinity,      // Beverly's beaches are mapped sand — no recolor zone
  sledLane: null,        // candidate: the Mack Park hill (add verified in polish)
  trainPlatform: null,   // VERIFY: Beverly Depot has surface platforms — set in polish
  holidayTree: null,     // candidate: Ellis Square — set verified in polish

  attractions: {
    frogPond: null,
    sledHill: null,      // candidate: Mack Park — set verified in polish
    graveyard: null,     // candidate: Central Cemetery — set verified in polish
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
  halloweenDisplay: { x: 0, z: 0 },   // VERIFY: downtown Cabot St — set with spawn

  courses: COURSES,
  raceTown: 'beverly',
  devCourse: 'homecoming',
  racePromo: {
    course: 'homecoming',
    body: 'Real races on real streets! Three courses run through Beverly — dash the Cabot Street grid, run the shore to Lynch Park, or ride home from Beverly Farms. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
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
