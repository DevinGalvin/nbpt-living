// Manchester-by-the-Sea — the harbor, the town in between, and Singing Beach,
// whose sand genuinely squeaks underfoot. The literal gap in the coastal chain:
// it borders Beverly on one side and Gloucester on the other, both already
// built. World-only sandbox (no story spine), its own race ladder.
//
// Anchors are world-px read out of the BUILT world.json and point-in-polygon
// checked against the real municipal boundary — see towns/manchester/map.mjs.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import { HISTORY } from './history';
import cfg from '../../../towns/manchester/town.json';

export const TOWN: TownPack = {
  id: 'manchester',
  name: 'Manchester-by-the-Sea',
  title: 'Manchester-by-the-Sea',
  tag: 'Where the Sand Sings',
  emoji: '🏖',
  path: '/manchester/',

  story: false,   // world-only sandbox — ?story force-enables the (NBPT) spine for dev

  history: HISTORY,   // 🏛 15 discovery markers — see ./history.ts. Independent of `story`.

  spawn: cfg.spawn as SpawnAnchor,   // Singing Beach — the town's whole identity (see town.json)

  // ✈️ scenic flight off Singing Beach. No invented history here: Manchester has
  // no airfield and none of the Burgess story that Marblehead and Ipswich can
  // claim, so the copy just sells the view — the harbor, the estates along the
  // shore, and Coolidge Reservation's lawn running down to the sea.
  flight: {
    runwayStart: { x: 5987, z: 5687 },        // Singing Beach sand
    runwayHdg: 1.5708,                        // depart east along the shore, out over the water
    airport: { x: 5987, z: 5687, r: 1400 },
    liftoffMsg: '✈️ Lifting off Singing Beach — climb out over the harbor',
    promoBody: 'Scenic flights are open to everyone. Walk out onto Singing Beach and tap ✈️ FLY to soar over the harbor, the shore estates and Coolidge Reservation. You can’t crash, promise.',
    promoCta: 'Take me to the beach',
  },

  beachX: Infinity,                       // Singing, Black and White Beach are mapped sand — no recolor zone
  // Manchester is shingle-and-white rather than the painted-clapboard palette —
  // a lighter mix than Rockport's, which keeps more white clapboard in the mix.
  shingleZones: [{ x: -1200, z: 3600, r: 8000, p: 0.5 }],   // village + harbor + Singing Beach
  sledLane: null,
  trainPlatform: null,                    // the Rockport line runs through and Manchester HAS a stop — but OSM doesn't name it here, so there's no honest point to place. Add via manualBuildings or an OSM edit.
  holidayTree: { x: -280, z: 3490 },      // Masconomo Park — the green between downtown and the harbor

  attractions: {
    frogPond: { x: 12193, z: -6773 },     // Dexter Pond
    sledHill: null,
    graveyard: { x: -285, z: -5727 },     // Rosedale Cemetery — fall mist
  },

  fall: {
    fogRange: [1050, 2500],
    hemiSky: '#f2e6cc',
    hemiGround: '#8a8058',
    hemiIntensity: 0.5,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: -280, z: 3490 },   // Masconomo Park

  courses: COURSES,
  raceTown: 'manchester',
  devCourse: 'singingbeach',
  racePromo: {
    course: 'singingbeach',
    body: 'Real races on real streets! Run the shore road out to Singing Beach, or the long way round the harbor. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // MANCHESTER palette: deep sea-green chrome + the usual warm gold accent
  theme: {
    panel: 'linear-gradient(177deg, rgba(24,72,64,0.985), rgba(16,54,48,0.985) 58%, rgba(8,30,27,0.985))',
    maroon: '14, 48, 43',
    maroonLt: '26, 70, 62',
    goldRgb: '224, 178, 58',
    gold: '#e0b23a',
    goldMid: '#eec24a',
    goldBright: '#f8dc88',
  },
  borderLore: {
    'Manchester-by-the-Sea': 'the singing sands · incorporated 1645',
    'Beverly': 'the Garden City · settled 1626',
    'Gloucester': "America's oldest seaport · est. 1623",
    'Essex': 'shipbuilding town · inc. 1819',
    'Hamilton': 'incorporated 1793',
    'Wenham': 'incorporated 1643',
  },
  searchPlaceholder: 'Go anywhere… try “Central Street” or “Singing Beach”',
  fallSeasonLine: 'the beach empties and the woods above town turn',
  streetNudge: '📍 This is the real map of Manchester.<br><b>Tap to find your street →</b>',
};
