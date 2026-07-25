// Manchester-by-the-Sea — map-pipeline curation. Everything town-specific that
// tools/build_world.mjs and tools/fetch_terrain.mjs consume lives here.
// The engine logic stays in tools/; this file is pure data + tiny hooks.

export const dropOsm = [];
export const downtownCore = null;
export const storefrontCorridors = [];

// ---------- curated landmarks ----------
// Every coordinate came out of `TOWN=manchester node tools/landmark_candidates.mjs`
// against the BUILT world.json: point-in-polygon checked against Manchester's
// own municipal boundary (this bbox reaches into Beverly, Essex and Gloucester),
// and polys use a pole-of-inaccessibility interior point, not a centroid —
// a crescent beach's centroid can land in the sea. Nothing here is eyeballed.
//
// Tour order: the beach and the harbor → downtown → the shore estates →
// the conservation land inland.
const LM = [
  // ── the beach & the harbor ──
  ['singing-beach', 'Singing Beach', 'The sand really does squeak under your feet', 5987, 5687, 620],
  ['masconomo-park', 'Masconomo Park', 'The green between downtown and the harbor', -280, 3490, 480],
  ['tucks-point', "Tuck's Point", 'The rotunda, the pier and the harbor view', -6864, 7323, 520],
  ['manchester-yacht-club', 'Manchester Yacht Club', 'The boats moored off the point', -6383, 8279, 320],
  ['chowderhouse', 'The Chowderhouse', 'Chowder at the water’s edge', -6315, 7315, 300],
  ['captain-dustys', "Captain Dusty's", 'The ice cream line in summer', -87, 2691, 280],
  // ── downtown ──
  ['town-hall', 'Town Hall', 'The 1868 town hall in the middle of everything', -2170, 1001, 340],
  ['trask-house', 'Trask House Museum', 'The historical society’s 1823 house', -1368, 593, 300],
  ['manchester-library', 'Manchester Public Library', 'Reading room a block off Central Street', -1533, 899, 300],
  ['crosbys', "Crosby's", 'The market everyone stops at', -477, 1748, 300],
  ['crowell-chapel', 'Crowell Chapel', 'The little stone chapel', -381, -5514, 300],
  ['rosedale-cemetery', 'Rosedale Cemetery', 'The old burying ground above town', -285, -5727, 480],
  // ── the shore ──
  ['coolidge-reservation', 'Coolidge Reservation', 'The Ocean Lawn — a great green step down to the sea', 29479, -1888, 800],
  ['black-beach', 'Black Beach', 'Dark sand on the eastern shore', 24404, -2812, 480],
  ['white-beach', 'White Beach', 'Its pale twin, just around the point', 21891, -580, 420],
  ['sweeney-park', 'Sweeney Park', 'Ballfields on the way to the beach', 7741, -2393, 620],
  ['eaglehead', 'Eaglehead', 'Wooded headland over the water', 8604, -1507, 700],
  // ── inland conservation land ──
  ['great-hill', 'Great Hill', 'The climb with the view back over town', -16448, -4660, 700],
  ['owls-nest', 'Owls Nest Preserve', 'Quiet woodland on the Beverly line', -15781, -2029, 650],
  ['moses-hill', 'Moses Hill', 'Trails up the wooded ridge', -7477, -8907, 650],
  ['cranberry-pond', 'Cranberry Pond', 'A bog pond deep in the woods', 14629, -19709, 750],
  ['dexter-pond', 'Dexter Pond', 'Still water in the conservation land', 12656, -7314, 650],
  ['essex-county-club', 'Essex County Club', 'The 1893 links north of downtown', 7182, -9061, 800],
];
export function landmarks() {
  return LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];
export const levelFixes = [];

// OSM names almost nothing in Manchester on the building WAYS — the town hall,
// library, church and museum are all POI nodes only, so without these the four
// photo-verified heroes never bind and the village centre is anonymous boxes.
// Anchors verified against their footprints (tools/patch_names.mjs).
export const nameFixes = [
  { x: -2170, y: 1001, n: 'Manchester-by-the-Sea Town Hall' },
  { x: -1533, y: 899, n: 'Manchester-By-The-Sea Public Library' },   // OSM's Title Case — HEROES keys on it verbatim
  // the church POI sits in the yard, 103 px outside the footprint — anchor is
  // the Central St building centroid instead. Kept distinct from Beverly's own
  // "First Parish Church" hero, which shares the engine's name-keyed table.
  { x: -1930, y: 901, n: 'First Parish Church (Manchester)' },
  { x: -1368, y: 593, n: 'Trask House Museum' },
];

export const qaDistances = [];

export const qaElevationSpots = [
  { name: 'Singing Beach', lat: 42.5730, lon: -70.7600 },
  { name: 'Masconomo Park', lat: 42.5760, lon: -70.7670 },
  { name: 'Great Hill', lat: 42.5810, lon: -70.7930 },
];
