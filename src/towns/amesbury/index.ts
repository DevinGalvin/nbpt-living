// Amesbury — the carriage town. The Powow drops 90 feet through the Lower
// Millyard to the Merrimack, which is why the mills are where they are and why
// the town spent the 19th century building the country's carriages (and then
// car bodies). Whittier wrote here for 56 years. Across the river is
// Newburyport, the flagship town. World-only sandbox (no story spine).
//
// Anchors are world-px read out of the BUILT world.json and point-in-polygon
// checked against the real municipal boundary — see towns/amesbury/map.mjs.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import cfg from '../../../towns/amesbury/town.json';

export const TOWN: TownPack = {
  id: 'amesbury',
  name: 'Amesbury',
  title: 'Amesbury',
  tag: 'Carriage Town',
  emoji: '🛞',
  path: '/amesbury/',

  story: false,   // world-only sandbox — ?story force-enables the (NBPT) spine for dev

  spawn: cfg.spawn as SpawnAnchor,   // Market Square — the five-street crossroads at the top of the Millyard

  // ✈️ scenic flight off the open fields at Woodsom Farm. NO invented history:
  // the one runway in frame is Meadowbrook Airport, which the boundary check
  // puts in Merrimac, not Amesbury — so the copy sells the view instead of
  // claiming an airfield the town doesn't have.
  flight: {
    runwayStart: { x: -17623, z: -5197 },     // Woodsom Farm's open fields
    runwayHdg: 1.5708,                        // depart east, down the Powow valley toward downtown
    airport: { x: -17623, z: -5197, r: 1500 },
    liftoffMsg: '✈️ Lifting off from Woodsom Farm — climb out over the Powow',
    promoBody: 'Scenic flights are open to everyone. Walk out into the fields at Woodsom Farm and tap ✈️ FLY to soar over Lake Gardner, the Millyard, and the Merrimack all the way to the Chain Bridge. You can’t crash, promise.',
    promoCta: 'Take me to Woodsom Farm',
  },

  beachX: Infinity,      // Lake Gardner's beach is mapped sand — no recolor zone
  sledLane: null,
  trainPlatform: null,   // the Newburyport branch stops one town south — Amesbury has no rail at all (rails=0 in the build)
  holidayTree: { x: -36, z: 3 },      // Market Square

  attractions: {
    frogPond: { x: -4801, z: -1731 },   // Lake Gardner — the town beach, and the ice when it comes
    sledHill: { top: { x: -17623, z: -5197 }, dir: { x: 0.85, z: 0.53 }, run: 850 },   // Woodsom Farm's hill
    graveyard: { x: 6199, z: 4543 },    // Mount Prospect Cemetery — fall mist
  },

  fall: {
    fogRange: [1000, 2400],
    hemiSky: '#f4e4c6',
    hemiGround: '#8a7a52',
    hemiIntensity: 0.5,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: -36, z: 3 },   // Market Square

  courses: COURSES,
  raceTown: 'amesbury',
  devCourse: 'millyard',
  racePromo: {
    course: 'millyard',
    body: 'Real races on real streets! Climb out of the Millyard, run the ridge past Lake Gardner, and drop back down to Market Square. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // AMESBURY palette: carriage-shop brown + the usual warm gold accent
  theme: {
    panel: 'linear-gradient(177deg, rgba(72,46,28,0.985), rgba(54,34,20,0.985) 58%, rgba(30,18,10,0.985))',
    maroon: '48, 30, 18',
    maroonLt: '72, 46, 28',
    goldRgb: '224, 162, 58',
    gold: '#e0a23a',
    goldMid: '#eeb44a',
    goldBright: '#f8d488',
  },
  borderLore: {
    'Amesbury': 'the carriage town · settled 1654',
    'Newburyport': 'the Clipper City · across the Chain Bridge',
    'Salisbury': 'beach and marsh · incorporated 1640',
    'Merrimac': 'split from Amesbury in 1876',
    'West Newbury': 'incorporated 1819',
    'Newton': 'New Hampshire · incorporated 1749',
    'South Hampton': 'New Hampshire · incorporated 1742',
    'Seabrook': 'New Hampshire · incorporated 1768',
  },
  searchPlaceholder: 'Go anywhere… try “Friend Street” or “Lake Gardner”',
  fallSeasonLine: 'the mills go quiet and the Powow valley turns',
  streetNudge: '📍 This is the real map of Amesbury.<br><b>Tap to find your street →</b>',
};
