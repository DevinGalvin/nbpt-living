// Salisbury — map-pipeline curation. Starts empty per docs/TOWNS.md; the
// landmark roster is written after the first world build, from
// `TOWN=salisbury node tools/landmark_candidates.mjs`.
//
// Frame notes (bbox in town.json): the whole town — Salisbury Beach Center and
// the boardwalk, the four miles of barrier beach up to the Seabrook line, the
// Salisbury Beach State Reservation and the mouth of the Merrimack, the
// marshes and the Blackwater, Salisbury Square on Route 1, Ring's Island and
// Salisbury Point on the river. Plum Island Point and Newburyport's waterfront
// ride in-frame across the river mouth.

export const dropOsm = [];

// Salisbury has no single downtown corridor: the commercial life is split
// between Beach Center's arcade strip and the Route 1 / Route 110 square.
// Hand-draw a core box only if both read dead after the first build.
export const downtownCore = null;

export const storefrontCorridors = [];

// Curated fast-travel landmarks: id, name, sub, x, y, r (world px; r ÷8 ≈ m).
// Every coordinate comes from `tools/landmark_candidates.mjs` (boundary-checked,
// with a safe INTERIOR point) unless noted; the exceptions are street midpoints
// for places OSM maps only as a street, and they are marked. Mix per the town
// recipe: kid-life first, then history, nature — Salisbury's kid-life is the
// beach, so the beach end of town carries the roster.
const SALISBURY_LM = [
  // ── Beach Center: the boardwalk end ──
  ['beach-center', 'Salisbury Beach Center', 'Arcades, fried dough and the boardwalk', 28542, -504, 450],   // Broadway street midpoint — the strip is a street in OSM, not a place
  ['blue-ocean', 'Blue Ocean Music Hall', 'Bands right on the sand', 28758, -1578, 340],
  ['beach-field', 'Beach Field', 'Ballfields a block from the beach', 25212, -1848, 450],
  ['little-league', 'Little League Field', 'Summer games by the beach', 24866, -1031, 380],
  ['railroad-ave-park', 'Railroad Avenue Park', 'Pocket park where the trains used to run', 27749, 1321, 340],
  ['star-of-the-sea', 'Star of the Sea Chapel', 'The little beach chapel up the shore', 27710, -7033, 320],
  // ── the State Reservation and the river mouth ──
  ['reservation', 'Salisbury Beach State Reservation', 'Camp between the dunes and the river', 25812, 15674, 800],
  ['interpretive-center', 'Interpretive Center', 'Find out what lives in the dunes', 29043, 16664, 400],
  ['camp-store', 'Camp Store', 'Ice cream run from the campground', 26046, 15457, 340],
  ['salisbury-beach', 'Salisbury Beach', 'Four miles of sand, all the way to the line', 30490, 13192, 900],
  // ── kid life inland ──
  ['skate-park', 'Salisbury Skate Park', 'Concrete bowl behind the fields', -2565, -14342, 380],
  ['lions-park', 'Lions Park', 'Playground and fields on Elm Street', -2503, -2815, 480],
  ['memorial-field', 'Memorial Field', 'The town ballfield by the common', -1093, -110, 420],
  ['partridge-brook', 'Partridge Brook Park', 'Woods and a brook behind the schools', -2456, -9476, 550],
  // ── the square and the town's story ──
  ['town-common', 'Salisbury Town Common', 'The green the town grew around', -948, 1850, 400],
  ['town-hall', 'Salisbury Town Hall', 'Town business on the common', 590, 71, 320],
  ['library', 'Salisbury Public Library', 'Books beside the common', -861, 1792, 320],
  ['old-burial-ground', 'Old Colonial Burial Ground', 'Headstones from the 1600s', 2604, 1433, 380],
  ['long-hill-cemetery', 'Long Hill Cemetery', 'The big hillside burying ground', 10543, 437, 500],
  ['maplewood-cemetery', 'Maplewood Cemetery', 'The quiet one out toward the river', 861, 14100, 380],
  // ── marsh, islands and the river ──
  ['pettengill', 'Pettengill Reservation', 'Trails through the woods off Route 1', 3631, -1943, 700],
  ['stevens-conservation', 'Stevens Conservation Area', 'Big quiet woods above the river', -8670, 16114, 800],
  ['messenger-marsh', 'Messenger Marsh', 'Salt marsh that floods with the tide', 440, 8152, 600],
  ['salt-marsh', 'Salisbury Salt Marsh', 'The wide marsh behind the beach', 15603, -12821, 800],
  ['sheeps-rock', "Sheep's Rock", 'Ledge in the woods with an old name', 11053, -15116, 600],
  ['ash-swamp', 'Ash Swamp', 'The great swamp in the middle of town', 4640, -9258, 600],
  ['forest-road-woods', 'Forest Road Woodlands', 'Town woods on the Newbury side', 10458, -12319, 600],
  // Carr, Ram, Eagle and Barnes Islands were the first picks here and were CUT:
  // they are real, but every one of them is open water or unreachable marsh in
  // the built world, so a fast-travel would drop the player in the river.
  // ── Route 1 and the state line ──
  ['lenas', "Lena's Seafood", 'Fried clams on the Route 1 strip', -17760, -22535, 320],
  ['chubbys', "Chubby's Diner", 'Breakfast in a genuine diner', -17219, -23823, 300],
  ['welcome-center', 'Massachusetts Welcome Center', 'The first stop in the state, off I-95', -15854, -33520, 450],
];
export function landmarks() {
  return SALISBURY_LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];
export const levelFixes = [];
// Names OSM carries on POI nodes but not on the footprints — stamped onto the
// containing building so HEROES/search bind.
export const nameFixes = [
  { x: 28758, y: -1578, n: 'Blue Ocean Music Hall' },   // theatre POI node on the sand; the way is unnamed
  // Star of the Sea Chapel: NOT nameFixed. Its POI node sits 18-25 m from three
  // unnamed houses and there is no way to tell which one is the chapel without
  // guessing — and a wrong stamp would label a resident's house as a chapel.
  // The landmark still fast-travels; it just gets no hero.
];

// Real-world verified distances guard the projection — add pairs once two
// points are independently verified (never computed from the same formula).
export const qaDistances = [];

export const qaElevationSpots = [
  { name: 'Salisbury Beach Center', lat: 42.8394, lon: -70.8117 },
  { name: 'Salisbury Square', lat: 42.8419, lon: -70.8602 },
  { name: 'Merrimack river mouth', lat: 42.8163, lon: -70.8135 },
  { name: "Ring's Island", lat: 42.8271, lon: -70.8747 }
];
