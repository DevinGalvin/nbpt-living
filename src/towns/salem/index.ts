// Salem — Witch City. World-only sandbox (no story spine yet), fall-forward
// atmosphere, its own race ladder. Values ported verbatim from the retired
// salem-experiment fork when the towns reunified.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import { HISTORY } from './history';
import cfg from '../../../towns/salem/town.json';

export const TOWN: TownPack = {
  id: 'salem',
  name: 'Salem',
  title: 'Salem',
  tag: 'Witch City',
  emoji: '🎃',
  path: '/salem/',

  story: false,   // world-only sandbox — no authored spine (Newburyport is the only town with one)

  history: HISTORY,   // 🏛 34 discovery markers — see ./history.ts. Independent of `story`.

  spawn: cfg.spawn as SpawnAnchor,   // Essex St pedestrian mall, by Lappin Park (heart landmark; see town.json)

  // ✈️ scenic flight from WINTER ISLAND — the real former US Coast Guard Air
  // Station Salem (seaplanes flew from here 1935–1970). Board on the old apron
  // by Fort Pickering and lift off east over the sound.
  flight: {
    runwayStart: { x: 19750, z: -10350 },   // the old seaplane apron, mid-island
    runwayHdg: 1.571,                        // depart due east, out over Salem Sound
    airport: { x: 19950, z: -10450, r: 1400 },
    liftoffMsg: '✈️ Lifting off from Winter Island — steer to bank over town',
    promoBody: 'Scenic flights are open to everyone. Head to Winter Island — the old Coast Guard seaplane station by Fort Pickering — and tap ✈️ FLY to soar over Salem Sound. You can’t crash, promise.',
    promoCta: 'Take me to Winter Island',
  },

  beachX: Infinity,      // no barrier-beach recolor zone (the harbor shores are mapped sand)
  sledLane: null,
  trainPlatform: null,   // Salem Depot is underground — no surface platform set piece
  holidayTree: null,

  attractions: {
    frogPond: null,
    sledHill: null,
    graveyard: { x: 5105, z: -4940 },   // Charter Street Burying Point — mist + the circling witch
  },

  // fall opens at spooky dusk, moodier fog + light — it's Salem in October
  fall: {
    fogRange: [780, 2050],
    hemiSky: '#e6c49a',
    hemiGround: '#5a4a60',
    hemiIntensity: 0.4,
    duskStart: true,
  },
  halloween: 'haunted',
  halloweenDisplay: { x: 3470, z: -5740 },   // dead-center downtown

  courses: COURSES,
  raceTown: 'salem',
  devCourse: 'marblehead',
  racePromo: {
    course: 'witchhunt',
    body: 'Real races on real streets! Three courses run through Salem — dash the downtown grid to the Witch House, run the harbor out to the Willows, or ride home from Marblehead. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // SALEM palette: deep plum chrome + amber accent
  theme: {
    panel: 'linear-gradient(177deg, rgba(60,36,76,0.985), rgba(46,28,60,0.985) 58%, rgba(32,18,44,0.985))',
    maroon: '48, 28, 60',
    maroonLt: '66, 42, 82',
    goldRgb: '224, 162, 58',
    gold: '#e0a23a',
    goldMid: '#eeb24a',
    goldBright: '#f8d488',
  },
  borderLore: {
    'Salem': 'the Witch City · est. 1626',
    'Marblehead': 'settled 1629',
    'Beverly': 'incorporated 1668',
    'Peabody': 'incorporated 1855',
    'Danvers': 'old Salem Village · inc. 1752',
    'Swampscott': 'incorporated 1852',
    'Lynn': 'settled 1629',
  },
  searchPlaceholder: 'Go anywhere… try “Essex Street” or “The Witch House”',
  fallSeasonLine: 'the leaves redden over Salem',
  streetNudge: '📍 This is the real map of Salem.<br><b>Tap to find your street →</b>',
};
