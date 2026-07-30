// Charlestown — one square mile with the Bunker Hill Monument on top of it and
// the Navy Yard along the bottom. The first town in the set that is a
// NEIGHBOURHOOD rather than a municipality: its boundary is OSM relation
// 4033666 (boundary=place), and the frame reaches across the water to the North
// End, Copp's Hill and Paul Revere's landing as nods, not as a second roster.
// World-only sandbox (no story spine).
//
// Anchors are world-px read out of the BUILT world.json and point-in-polygon
// checked against the real neighbourhood boundary — see towns/charlestown/map.mjs.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import { HISTORY } from './history';
import cfg from '../../../towns/charlestown/town.json';

export const TOWN: TownPack = {
  id: 'charlestown',
  name: 'Charlestown',
  title: 'Charlestown',
  tag: 'The Town',
  emoji: '🗼',
  path: '/charlestown/',

  story: false,   // world-only sandbox — no authored spine (Newburyport is the only town with one)

  history: HISTORY,   // 🏛 20 discovery markers — see ./history.ts. Independent of `story`.

  spawn: cfg.spawn as SpawnAnchor,   // the Bunker Hill Monument — the thing you can see from everywhere

  // ✈️ No invented airfield: Charlestown has none, and never did. The run is the
  // Navy Yard's waterfront apron — you roll east past Old Ironsides and lift off
  // over the harbor, which is honest and also the best view in the set.
  flight: {
    runwayStart: { x: 4865, z: 1786 },        // Shipyard Park, on the yard's harbor edge
    runwayHdg: 1.5708,                        // east, straight down the waterfront
    airport: { x: 4865, z: 1786, r: 1200 },
    liftoffMsg: '✈️ Wheels up past Old Ironsides — climb out over the harbor',
    promoBody: 'Scenic flights are open to everyone. Charlestown has no airfield, so you take off down the Navy Yard waterfront, right past USS Constitution — then climb over the Monument and follow the Mystic. You can’t crash, promise.',
    promoCta: 'Take me to the Navy Yard',
  },

  beachX: Infinity,      // no barrier beach — this is a working harbor
  sledLane: null,
  trainPlatform: null,   // the Orange Line here is elevated/subway, not a platform set piece
  holidayTree: { x: -668, z: 4127 },       // City Square Park

  attractions: {
    frogPond: null,                          // no pond in Charlestown that freezes to a rink
    sledHill: null,                          // the monument hill is steep but it is a national park lawn
    graveyard: { x: -4516, z: 103 },         // Phipps Street Cemetery, headstones from the 1630s
  },

  fall: {
    fogRange: [900, 2400],
    hemiSky: '#e6eaf0',
    hemiGround: '#7a828c',
    hemiIntensity: 0.55,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: -668, z: 4127 },    // City Square Park

  courses: COURSES,
  raceTown: 'charlestown',
  devCourse: 'monument',
  racePromo: {
    course: 'monument',
    body: 'Real races on real streets! Start at Old Ironsides, run out through the Navy Yard gate, then climb Main Street to the Monument — or take the whole peninsula the long way round. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // CHARLESTOWN palette: granite slate-blue + a monument-gold
  theme: {
    panel: 'linear-gradient(177deg, rgba(46,62,80,0.985), rgba(32,45,60,0.985) 58%, rgba(14,22,31,0.985))',
    maroon: '38, 52, 68',
    maroonLt: '58, 78, 98',
    goldRgb: '216, 178, 74',
    gold: '#d8b24a',
    goldMid: '#e8c667',
    goldBright: '#f6e2a4',
  },
  // Charlestown's neighbours are Boston neighbourhoods plus four cities — not
  // the usual town lines. Boston itself is excluded from the boundary set
  // (towns/charlestown/town.json) because you are always inside it.
  borderLore: {
    'Charlestown': 'settled 1629 · older than Boston itself',
    'North End': "Boston's oldest neighbourhood · across the river",
    'West End': 'across the locks',
    'Downtown': 'across the Charles',
    'Government Center/Faneuil Hall': 'the market and the cradle of liberty',
    'East Boston': 'across the harbor',
    'East Cambridge': 'across the Charles',
    'Somerville': 'incorporated 1842 · split off from Charlestown',
    'Cambridge': 'settled 1630',
    'Everett': 'incorporated 1892',
    'Chelsea': 'settled 1624',
    'Medford': 'settled 1630',
  },
  searchPlaceholder: 'Go anywhere… try “Bunker Hill Street” or “Monument Square”',
  fallSeasonLine: 'the monument goes grey and the hill turns gold',
  streetNudge: '📍 This is the real map of Charlestown.<br><b>Tap to find your street →</b>',
};
