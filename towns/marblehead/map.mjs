// Marblehead — map-pipeline curation. Everything town-specific that
// tools/build_world.mjs and tools/fetch_terrain.mjs consume lives here.
// The engine logic stays in tools/; this file is pure data + tiny hooks.

export const dropOsm = [];

// Marblehead's retail is a thin ribbon (Washington/State/Pleasant) rather than a
// dense block, so the data-driven commercial test carries it — no hand-drawn
// core box needed.
export const downtownCore = null;

export const storefrontCorridors = [];

// ---------- curated landmarks ----------
// Coords are WORLD PIXELS read straight out of the built world.json — park/beach
// poly centroids, building centroids, and OSM historic points — so each lands
// exactly on the feature (the Salem/Gloucester convention).
//
// Every entry below was additionally point-in-polygon tested against the real
// Marblehead municipal boundary from data/marblehead/raw/boundaries.json: this
// town's bbox reaches well into Salem and Swampscott for framing, and an earlier
// lat/lon-estimated pass put Old Burial Hill ~1.5 km out to sea. Nothing here is
// eyeballed. Two famous houses (the Jeremiah Lee Mansion, the Old Town House)
// are deliberately ABSENT — they aren't named in OSM, so there's no honest
// centroid to point at; add them via manualBuildings or an OSM edit, not a guess.
//
// TWO TRAPS this roster hit, both worth knowing before adding more:
//   1. A crescent-shaped poly's CENTROID can fall outside it. Devereux and
//      Preston Beach both centroided into the open ocean. Beach/shore entries
//      below use a pole-of-inaccessibility style interior point instead, and
//      every landmark is point-in-poly checked against the feature it names.
//   2. OSM spells the sand poly "Devereaux Beach" but the adjacent grass
//      "Devereux Beach" — two different features. This points at the SAND.
//
// Ordered as a loose tour: Old Town → the hills → harbor → the Neck → causeway
// beaches → the woods.
const LM = [
  // ── Old Town ──
  ['crocker-park', 'Crocker Park', 'The harbor overlook the whole town gathers on', 6074, -2009, 480],
  ['abbot-hall', 'Abbot Hall', "The Spirit of '76 hangs upstairs", 3705, -1863, 380],
  ['washington-square', 'Washington Square', 'The little green below Abbot Hall', 3422, -1619, 340],
  ['memorial-park', 'Memorial Park', 'Downtown’s green by the water', 1513, -1536, 360],
  ['st-michaels', "St. Michael's Church", 'Episcopal since 1714 — the bell rang for independence', 4668, -3538, 340],
  ['old-north-church', 'Old North Church', 'The 1635 congregation on Washington Street', 6533, -5785, 340],
  ['gar-museum', 'G.A.R. Museum', 'A Civil War veterans’ hall, kept as they left it', 5499, -4270, 320],
  ['shubies', 'Shubie’s', 'The market everyone in town has a sandwich order at', 2254, 17, 300],
  // ── the hills & the old ground ──
  ['old-burial-hill', 'Old Burial Hill', 'The 1638 graveyard on the hill over town', 7648, -9080, 620],
  ['redds-pond', "Redd's Pond", 'Model sailboats in summer, skates in winter', 6881, -8564, 420],
  ['fountain-park', 'Fountain Park', 'Ballfields under Old Burial Hill', 8381, -9049, 480],
  ['green-street-cemetery', 'Green Street Cemetery', 'A quiet old burying ground in town', 1678, -4835, 360],
  ['waterside-cemetery', 'Waterside Cemetery', 'The big garden cemetery on the water', -5894, -10036, 700],
  // ── harbor ──
  ['fort-sewall', 'Fort Sewall', 'Earthwork fort guarding the harbor mouth since 1644', 11017, -7083, 560],
  ['marblehead-boatyard', 'Marblehead Boatyard', 'Where the harbor’s boats are hauled and painted', 7655, -3453, 340],
  ['gas-house-beach', 'Gas House Beach', 'The little harbor beach kids launch from', 8674, -8330, 400],
  ['grace-oliver-beach', "Grace Oliver's Beach", 'Quiet sand on the Salem side', 7735, -12670, 450],
  ['stramskis-beach', "Stramski's Beach", 'Tide pools and a boat ramp', -5319, -12305, 420],
  // ── the Neck ──
  ['chandler-hovey', 'Chandler-Hovey Park', 'Marblehead Light at the tip of the Neck', 16223, -4369, 620],
  ['castle-rock', 'Castle Rock', 'Climb the ledge for the open Atlantic', 15662, 966, 480],
  ['neck-sanctuary', 'Marblehead Neck Sanctuary', 'Audubon woods and a heron pond on the Neck', 11737, 7154, 750],
  ['garmet-beach', 'Garmet Beach', 'A pocket of sand on the Neck’s ocean side', 15169, 2456, 400],
  // ── the causeway & the south shore ──
  ['riverhead-beach', 'Riverhead Beach', 'The sand beside the causeway out to the Neck', 1930, 7408, 500],
  ['devereux-beach', 'Devereux Beach', 'The town beach under the causeway', 1039, 8504, 560],
  ['goldthwait', 'Goldthwait Reservation', 'Open shore grass along the ocean', -1131, 8970, 620],
  ['seaside-park', 'Seaside Park', 'Ballfields, tennis and the skate park', 976, 5316, 620],
  ['hammond-park', 'Hammond Park', 'A neighbourhood green off West Shore', 3825, 3260, 420],
  ['preston-beach', 'Preston Beach', 'The long sand at the Swampscott line', -14569, 19869, 620],
  // ── woods & ponds ──
  ['steer-swamp', 'Steer Swamp', 'Wild trails and boulders right behind town', 4428, -11731, 800],
  ['wyman-woods', 'Wyman Woods', 'Pines and paths on the west side', -13861, 3480, 750],
  ['ware-pond', 'Ware Pond', 'A still pond in the west-side conservation land', -16166, 15757, 620],
  ['gerry-playground', 'Gerry Playground', 'Swings and a ball field in the north end', -3969, -11720, 450],
];
export function landmarks() {
  return LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];
export const levelFixes = [];

// No independently-known real-world distances curated yet. Add verified pairs
// here once you have two — they guard the projection, so never compute them
// from the same formula they're meant to check.
export const qaDistances = [];

export const qaElevationSpots = [
  { name: 'Abbot Hall (Training Field Hill)', lat: 42.4999, lon: -70.8578 },
  { name: 'Old Burial Hill', lat: 42.5033, lon: -70.8618 },
  { name: 'Crocker Park', lat: 42.5044, lon: -70.8544 },
  { name: 'Marblehead Light (the Neck)', lat: 42.5054, lon: -70.8329 },
  { name: 'Devereux Beach', lat: 42.4903, lon: -70.8452 },
];
