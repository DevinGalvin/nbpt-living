// Gloucester — America's Oldest Seaport (est. 1623), home of the Man at the
// Wheel, Hammond Castle, Dogtown's carved boulders, and a working fishing
// fleet four hundred years deep. The frame is ALL of Cape Ann, so Rockport's
// Bearskin Neck and the Thacher Island twin lights ride along as in-frame
// nods. World-only sandbox (no story spine), its own race ladder.
//
// ⚠️ Gameplay anchors below marked VERIFY are estimated from lat/lon and must
// be confirmed on the built world.json (on land, right feature) before ship.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import cfg from '../../../towns/gloucester/town.json';

export const TOWN: TownPack = {
  id: 'gloucester',
  name: 'Gloucester',
  title: 'Gloucester',
  tag: 'America’s Oldest Seaport',
  emoji: '🎣',
  path: '/gloucester/',

  story: false,   // world-only sandbox — ?story force-enables the (NBPT) spine for dev

  spawn: cfg.spawn as SpawnAnchor,   // downtown heart landmark (see town.json) — research pass settles the exact spot

  // ✈️ scenic flight — candidate site: TEN POUND ISLAND, the first US Coast
  // Guard air station (seaplanes, 1925). VERIFY the history + coords with the
  // research pass before ship; coords below are lat/lon-estimated placeholders.
  flight: {
    runwayStart: { x: 0, z: 4000 },           // VERIFY: Ten Pound Island, Gloucester Harbor
    runwayHdg: 3.1416,                         // VERIFY: depart south, out over the harbor mouth
    airport: { x: 0, z: 4000, r: 1400 },       // VERIFY
    liftoffMsg: '✈️ Lifting off from Ten Pound Island — steer to bank over the harbor',
    promoBody: 'Scenic flights are open to everyone. Head to Ten Pound Island — the old Coast Guard seaplane station in the middle of the harbor — and tap ✈️ FLY to soar over the fleet, the Boulevard, and Cape Ann. You can’t crash, promise.',
    promoCta: 'Take me to Ten Pound Island',
  },

  beachX: Infinity,      // Good Harbor / Wingaersheek are mapped sand — no recolor zone
  sledLane: null,        // set once the real sledding hill is terrain-verified (research)
  trainPlatform: null,   // VERIFY: Gloucester + West Gloucester commuter-rail stops after the world builds
  holidayTree: null,     // VERIFY: downtown — set with a built centroid

  attractions: {
    frogPond: null,      // VERIFY: the skating pond (research + terrain check)
    sledHill: null,      // set with terrain-verified top/dir/run
    graveyard: null,     // VERIFY: a colonial burying ground centroid — fall mist
  },

  // classic bright New England fall (Gloucester is a harbor town, not a Halloween town)
  fall: {
    fogRange: [1050, 2500],
    hemiSky: '#f2e6cc',
    hemiGround: '#8a8058',
    hemiIntensity: 0.5,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: 0, z: 0 },   // VERIFY: downtown by Main Street

  courses: COURSES,
  raceTown: 'gloucester',
  devCourse: 'homecoming',
  racePromo: {
    course: 'homecoming',
    body: 'Real races on real streets! Three courses run through Gloucester — beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // GLOUCESTER palette: deep harbor-teal chrome + warm gold accent
  theme: {
    panel: 'linear-gradient(177deg, rgba(26,74,82,0.985), rgba(19,60,67,0.985) 58%, rgba(11,38,43,0.985))',
    maroon: '16, 50, 56',
    maroonLt: '28, 68, 75',
    goldRgb: '224, 178, 58',
    gold: '#e0b23a',
    goldMid: '#eec24a',
    goldBright: '#f8dc88',
  },
  borderLore: {
    'Gloucester': "America's oldest seaport · est. 1623",
    'Rockport': 'incorporated 1840',
    'Essex': 'shipbuilding town · inc. 1819',
    'Manchester-by-the-Sea': 'incorporated 1645',
    'Ipswich': 'birthplace of American independence · est. 1634',
  },
  searchPlaceholder: 'Go anywhere… try “Main Street” or “Good Harbor Beach”',
  fallSeasonLine: 'the leaves turn gold over the harbor',
  streetNudge: '📍 This is the real map of Gloucester.<br><b>Tap to find your street →</b>',
};
