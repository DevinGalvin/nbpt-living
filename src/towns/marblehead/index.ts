// Marblehead — the crooked colonial lanes of Old Town, a harbor packed with
// sailboats, and the Neck out past the light. Claims to be the birthplace of
// the American Navy on the strength of Glover's Marblehead Regiment and the
// schooner Hannah — a claim Beverly's pack cheerfully makes right back (see
// src/towns/beverly/index.ts; let the two subreddits sort it out). World-only
// sandbox (no story spine), its own race ladder.
//
// Gameplay anchors below are world-px read out of the BUILT world.json and
// point-in-polygon checked against the real municipal boundary — not estimated.
// (The first lat/lon-estimated pass missed by up to 1.5 km; see map.mjs.)
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import { HISTORY } from './history';
import cfg from '../../../towns/marblehead/town.json';

export const TOWN: TownPack = {
  id: 'marblehead',
  name: 'Marblehead',
  title: 'Marblehead',
  tag: 'Birthplace of the American Navy',
  emoji: '🧭',
  path: '/marblehead/',

  story: false,   // world-only sandbox — no authored spine (Newburyport is the only town with one)

  history: HISTORY,   // 🏛 20 discovery markers — see ./history.ts. Independent of `story`.

  spawn: cfg.spawn as SpawnAnchor,   // Crocker Park — the harbor overlook in Old Town (see town.json)

  // ✈️ scenic flight from DEVEREUX BEACH. The real hook is local: the Burgess
  // Company built airplanes right here in Marblehead from 1910 — the first
  // licensed aircraft manufacturer in America — and tested its seaplanes off
  // this shore. (Ipswich's flight honours the same Burgess line at Moulton's
  // Farm.) Board on the sand and climb north over the harbor and the Neck.
  flight: {
    runwayStart: { x: 4202, z: 8057 },        // Devereux Beach (real poly centroid)
    runwayHdg: 3.1416,                        // depart due north — up over the causeway, harbor and Old Town
    airport: { x: 4202, z: 8057, r: 1500 },   // the beach + the causeway approach
    liftoffMsg: '✈️ Lifting off Devereux Beach — Burgess flew from this shore in 1910',
    promoBody: 'Scenic flights are open to everyone. Walk out onto Devereux Beach — where the Burgess Company, America’s first licensed aircraft builder, tested its seaplanes in 1910 — and tap ✈️ FLY to soar over the harbor, Old Town and the Neck. You can’t crash, promise.',
    promoCta: 'Take me to the beach',
  },

  beachX: Infinity,                       // Devereux, Riverhead and the Neck beaches are mapped sand — no recolor zone
  sledLane: null,                         // no curated sledding lane yet
  trainPlatform: null,                    // TRUE: Marblehead has no commuter rail — the old branch is the Rail Trail now
  holidayTree: { x: 3422, z: -1619 },     // Washington Square — the green below Abbot Hall

  attractions: {
    frogPond: { x: 6881, z: -8564 },      // Redd's Pond — model sailboats in summer, THE skating pond in winter
    sledHill: null,                       // none curated — Old Burial Hill is the steep one, but it's a graveyard
    graveyard: { x: 7648, z: -9080 },     // Old Burial Hill (1638) — fall mist
  },

  // classic bright New England fall — Marblehead is a harbor town, not a Halloween town
  fall: {
    fogRange: [1050, 2500],
    hemiSky: '#f2e6cc',
    hemiGround: '#8a8058',
    hemiIntensity: 0.5,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: 3422, z: -1619 },   // Washington Square, below Abbot Hall

  courses: COURSES,
  raceTown: 'marblehead',
  devCourse: 'oldtown',
  racePromo: {
    course: 'oldtown',
    body: 'Real races on real streets! Sprint Old Town’s crooked lanes, run the causeway out to the Neck, or ride the shore road home. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // MARBLEHEAD palette: deep harbor navy chrome + the usual warm gold accent
  theme: {
    panel: 'linear-gradient(177deg, rgba(26,52,88,0.985), rgba(18,38,66,0.985) 58%, rgba(10,22,40,0.985))',
    maroon: '16, 34, 60',
    maroonLt: '28, 52, 84',
    goldRgb: '224, 178, 58',
    gold: '#e0b23a',
    goldMid: '#eec24a',
    goldBright: '#f8dc88',
  },
  borderLore: {
    'Marblehead': 'birthplace of the American Navy · settled 1629',
    'Salem': 'the Witch City · settled 1626',
    'Swampscott': 'incorporated 1852',
    'Lynn': 'incorporated 1631',
    'Beverly': 'the Garden City · settled 1626',
  },
  searchPlaceholder: 'Go anywhere… try “Washington Street” or “Fort Sewall”',
  fallSeasonLine: 'the harbor empties of sailboats and the Neck goes gold',
  streetNudge: '📍 This is the real map of Marblehead.<br><b>Tap to find your street →</b>',
};
