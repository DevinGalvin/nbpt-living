// Rockport — the tip of Cape Ann: Bearskin Neck crowded with shops, Motif No. 1
// on the wharf, granite quarries inland and the Twin Lights offshore on Thacher
// Island. Completes Cape Ann alongside Gloucester. World-only sandbox (no story
// spine), its own race ladder.
//
// Anchors are world-px read out of the BUILT world.json and point-in-polygon
// checked against the real municipal boundary — see towns/rockport/map.mjs.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import { HISTORY } from './history';
import cfg from '../../../towns/rockport/town.json';

export const TOWN: TownPack = {
  id: 'rockport',
  name: 'Rockport',
  title: 'Rockport',
  tag: "The Artists' Colony",
  emoji: '🎨',
  path: '/rockport/',

  story: false,   // world-only sandbox — no authored spine (Newburyport is the only town with one)

  history: HISTORY,   // 🏛 17 discovery markers — see ./history.ts. Independent of `story`.

  spawn: cfg.spawn as SpawnAnchor,   // Dock Square — the heart, with Motif No. 1 a minute away (see town.json)

  // ✈️ scenic flight off Cape Hedge Beach, the long open sand on the south
  // shore. No invented aviation history — the copy sells the route: up the
  // shore, over the harbor and Bearskin Neck, and out to the Twin Lights.
  flight: {
    runwayStart: { x: 6666, z: 19508 },       // Cape Hedge Beach sand
    runwayHdg: -3.1416,                       // depart north up the shore toward the harbor
    airport: { x: 6666, z: 19508, r: 1500 },
    liftoffMsg: '✈️ Lifting off Cape Hedge Beach — climb north up the shore',
    promoBody: 'Scenic flights are open to everyone. Walk out onto Cape Hedge Beach and tap ✈️ FLY to soar up the shore over Bearskin Neck, the harbor and out to Thacher Island’s Twin Lights. You can’t crash, promise.',
    promoCta: 'Take me to the beach',
  },

  beachX: Infinity,                       // Front, Old Garden, Cape Hedge and Pebble are mapped sand — no recolor zone
  // Rockport reads weathered gray cedar SHINGLE first, painted clapboard second
  // (Commons harbor + Bearskin Neck photos, docs/research/rockport-manchester.md).
  // Without this the village is painted from Newburyport's clapboard palette and
  // Bearskin Neck comes out a row of pale institutional blocks.
  shingleZones: [
    { x: 2000, z: -3000, r: 4200, p: 0.72 },     // the harbor village: Dock Sq, Bearskin Neck, Front/Back Beach
    { x: -5800, z: -14600, r: 3200, p: 0.6 },   // Pigeon Cove
  ],
  sledLane: null,
  trainPlatform: null,                    // Rockport is the END of the MBTA Rockport line — but OSM doesn't name the station here, so there's no honest point to place. Add via manualBuildings or an OSM edit.
  holidayTree: { x: 2053, z: -2288 },     // Dock Square

  attractions: {
    frogPond: { x: -6913, z: 13839 },     // Cape Pond — the old ice-harvesting pond
    sledHill: null,
    graveyard: { x: 1882, z: 5535 },      // Beech Grove Cemetery — fall mist
  },

  fall: {
    fogRange: [1050, 2500],
    hemiSky: '#f2e6cc',
    hemiGround: '#8a8058',
    hemiIntensity: 0.5,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: 2053, z: -2288 },   // Dock Square

  courses: COURSES,
  raceTown: 'rockport',
  devCourse: 'bearskin',
  racePromo: {
    course: 'bearskin',
    body: 'Real races on real streets! Sprint Dock Square out onto Bearskin Neck, or ride the shore up to Halibut Point. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // ROCKPORT palette: granite-and-brick red chrome + the usual warm gold accent
  theme: {
    panel: 'linear-gradient(177deg, rgba(84,44,48,0.985), rgba(62,32,36,0.985) 58%, rgba(32,17,19,0.985))',
    maroon: '58, 31, 34',
    maroonLt: '84, 46, 50',
    goldRgb: '224, 178, 58',
    gold: '#e0b23a',
    goldMid: '#eec24a',
    goldBright: '#f8dc88',
  },
  borderLore: {
    'Rockport': "the artists' colony · set off from Gloucester 1840",
    'Gloucester': "America's oldest seaport · est. 1623",
  },
  searchPlaceholder: 'Go anywhere… try “Bearskin Neck” or “Halibut Point”',
  fallSeasonLine: 'the galleries quiet down and the quarries go still',
  streetNudge: '📍 This is the real map of Rockport.<br><b>Tap to find your street →</b>',
};
