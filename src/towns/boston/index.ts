// Boston — the whole city, and the biggest world in the set by a wide margin:
// 25.8 x 19.1 km, 233,279 buildings, from Readville in the south to the
// Charlestown line, and out past the built-up shore to Boston Light on Little
// Brewster Island. The frame necessarily takes in Cambridge, Somerville,
// Brookline, Quincy and Newton — no rectangle containing Boston does otherwise —
// and that is a feature: you can cross the Longfellow to MIT and see Harvard
// from the river. Neighbours are NODS, not a second roster (the
// Rockport-in-Gloucester rule); the fast-travel list is Boston's own.
// World-only sandbox (no story spine).
//
// Anchors below are world-px read out of the BUILT world.json and boundary- and
// dry-land-checked — see towns/boston/map.mjs and BOSTON-HANDOFF.md.
import type { TownPack, SpawnAnchor } from '../types';
import { COURSES } from './courses';
import cfg from '../../../towns/boston/town.json';

export const TOWN: TownPack = {
  id: 'boston',
  name: 'Boston',
  title: 'Boston',
  tag: 'The Hub',
  emoji: '🦆',
  path: '/boston/',

  story: false,   // world-only sandbox — ?story force-enables the (NBPT) spine for dev

  spawn: cfg.spawn as SpawnAnchor,   // Faneuil Hall — Boston's market square, the place a local takes a visitor first

  // ✈️ Boston is the first town in the set with a REAL major airport in frame,
  // runways and all. No invented airfield and no waterfront-apron compromise:
  // you take off from Logan on Runway 27, westbound, with the whole skyline dead
  // ahead. (256.6° true is 270° magnetic at Boston's declination — the maths
  // confirms this is genuinely 27 and not an approximation.)
  flight: {
    runwayStart: { x: 49234, z: -3386 },      // the real 09/27 east threshold
    runwayHdg: 4.478,                          // WSW down the runway, straight at downtown
    airport: { x: 34800, z: -8176, r: 6000 },  // Logan, which is enormous
    liftoffMsg: '✈️ Wheels up off Logan — the whole skyline dead ahead',
    promoBody: 'Scenic flights are open to everyone. You take off from the real Logan Airport, westbound down Runway 27, and climb out straight over the harbor with the whole skyline in front of you — then follow the Charles, or head out over the islands to Boston Light. You can’t crash, promise.',
    promoCta: 'Take me to Logan',
  },

  beachX: Infinity,      // Boston's beaches are harbor beaches, not a barrier-beach line
  // Downtown Boston is granite, limestone, brownstone and buff brick as much as
  // it is red brick — often within one block. 0.45 of the masonry stock builds
  // in stone, which is what stops the Financial District, Back Bay and the South
  // End all reading as the same red street.
  masonryMix: 0.45,
  sledLane: null,
  trainPlatform: null,   // the T here is subway and elevated, not a platform set piece
  holidayTree: { x: -2403, z: 1207 },        // Boston Common — the tree has stood there since 1941

  attractions: {
    frogPond: { x: -2874, z: 397 },           // the real Frog Pond: wading in summer, skating all winter
    sledHill: null,                            // no single sledding hill the city agrees on
    graveyard: { x: 512, z: -836 },            // Granary Burying Ground — Revere, Sam Adams, Hancock
  },

  fall: {
    fogRange: [900, 2600],
    hemiSky: '#e8ebf0',
    hemiGround: '#7c8490',
    hemiIntensity: 0.55,
    duskStart: false,
  },
  halloween: 'classic',
  halloweenDisplay: { x: -2403, z: 1207 },   // Boston Common

  courses: COURSES,
  raceTown: 'boston',
  devCourse: 'freedom',
  racePromo: {
    course: 'freedom',
    body: 'Real races on real streets! Run the Freedom Trail flat out from the Common to Faneuil Hall, take the Marathon’s last two miles into Copley — right on Hereford, left on Boylston — or go the long way round Olmsted’s Emerald Necklace. Beat the clock, top the town leaderboard, and race the leader’s ghost. Any route counts — shortcuts welcome.',
  },

  // BOSTON palette: Common-green + State House gold
  theme: {
    panel: 'linear-gradient(177deg, rgba(47,60,52,0.985), rgba(34,45,38,0.985) 58%, rgba(15,22,17,0.985))',
    maroon: '40, 54, 45',
    maroonLt: '60, 80, 66',
    goldRgb: '200, 164, 74',
    gold: '#c8a44a',
    goldMid: '#dcbc68',
    goldBright: '#f2dda6',
  },
  // Boston's own neighbourhoods announce themselves first — the runtime takes the
  // first ring containing the player, and fetch_boundaries emits boundary=place
  // before the administrative relations, so "the North End" beats "Boston".
  borderLore: {
    'North End': "Boston's oldest neighbourhood · settled in the 1630s",
    'Beacon Hill': 'gas lamps and brick · the State House on top',
    'Back Bay': 'built on filled-in water, street by street, in alphabetical order',
    'South Boston': 'Southie · the beaches and the fort',
    'East Boston': 'Eastie · five islands joined into one',
    'Charlestown': 'settled 1629 · older than Boston itself',
    'Dorchester': "Boston's biggest neighbourhood · settled 1630",
    'Roxbury': 'the heart of the city, and the hill Washington fortified',
    'Jamaica Plain': 'JP · the Emerald Necklace runs through it',
    'West End': 'the neighbourhood that got knocked down',
    'Downtown': 'the crooked streets are the old cow paths',
    'Chinatown': 'the last Chinatown in New England',
    'Fenway-Kenmore': 'the ballpark and the Citgo sign',
    'South End': 'the biggest Victorian rowhouse district in America',
    'Seaport': 'all of this was water',
    'Brighton': 'once the cattle market for all of Boston',
    'Allston': 'student country',
    'Hyde Park': 'the last neighbourhood to join Boston, in 1912',
    'West Roxbury': 'a separate town until 1874',
    'Roslindale': 'trains and triple-deckers',
    'Mattapan': 'the trolley still runs here',
    'Mission Hill': 'up the hill behind the Fenway',
    'Harbor Islands': 'thirty-four islands, and America’s first lighthouse',
    Cambridge: 'across the river · Harvard and MIT',
    Somerville: 'seven hills, packed in tight',
    Brookline: 'the town Boston grew all the way around, and never swallowed',
    Newton: 'thirteen villages pretending to be one city',
    Watertown: 'up the Charles, where the river stops being tidal',
    Chelsea: 'small, steep and hard-working',
    Everett: 'where the tankers and the casino share a shoreline',
    Revere: "America's first public beach, three miles of it",
    Winthrop: 'a town on a sandbar, with the airport for a neighbour',
    Quincy: 'the City of Presidents, and the granite Boston is built from',
    Milton: 'Blue Hills at its back, the Neponset at its feet',
    Dedham: 'older than most of Boston, and quietly proud of it',
    Needham: 'out past the Charles, where the city finally gives up',
    Medford: 'settled 1630',
    Arlington: 'the Menotomy of the ride to Concord',
    Belmont: 'orchards, once',
  },
  searchPlaceholder: 'Go anywhere… try “Hanover Street” or “Fenway Park”',
  fallSeasonLine: 'the Common goes gold and the Charles turns steel',
  streetNudge: '📍 This is the real map of Boston.<br><b>Tap to find your street →</b>',
};
