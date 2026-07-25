// Amesbury — map-pipeline curation. Starts empty per docs/TOWNS.md; the
// landmark roster is written after the first world build, from
// `TOWN=amesbury node tools/landmark_candidates.mjs`.
//
// Frame notes (bbox in town.json): the whole town — the Lower Millyard and
// Market Square where the Powow drops to the Merrimack, Lake Gardner and the
// Powow River above it, Powow Hill, Woodsom Farm and the Amesbury Sports Park
// out west, Point Shore and Salisbury Point along the river, and the Chain
// Bridge + Deer Island crossing to Newburyport, which rides in-frame as the
// flagship town's northern edge.

export const dropOsm = [];

// Market Street / Main Street is Amesbury's downtown; the mapped shop POIs
// should light the commercial test on their own — hand-draw a core box only if
// the corridor reads dead after the first build.
export const downtownCore = null;

export const storefrontCorridors = [];

// Curated fast-travel landmarks: id, name, sub, x, y, r (world px; r ÷8 ≈ m).
// Every coordinate comes from `tools/landmark_candidates.mjs` (which boundary-
// checks and returns a safe INTERIOR point) unless noted; the exceptions are
// street midpoints for places OSM maps only as a street, and one address-layer
// lookup, both marked below and both re-checked against the built world.
// Mix per the town recipe: kid-life first, then history, transport, nature.
const AMESBURY_LM = [
  // ── downtown: the Millyard and Market Square ──
  ['market-square', 'Market Square', 'The heart of town, where five streets meet', -36, 3, 380],   // Market Square street midpoint — OSM maps it as a street, not a place
  ['lower-millyard', 'Lower Millyard', 'Where the Powow drops through the old mills', -735, 20, 400],
  ['city-hall', 'Amesbury City Hall', 'The town offices above the Millyard', 204, -70, 320],
  ['old-town-hall', 'Old Town Hall', 'The 1855 hall the town outgrew', -2121, 1551, 320],
  ['library', 'Amesbury Public Library', 'Carriage-town books since 1856', -1805, 2377, 320],
  ['stage-two', 'Stage Two Cinema Pub', 'Movies downtown, dinner in your seat', -1077, 1674, 300],
  ['costello-center', 'Costello Transportation Center', 'Catch the bus to Boston from here', 1669, -70, 320],
  ['millyard-park', 'Millyard Park', 'The green in the middle of the mills', -1129, 249, 340],   // nudged 60px off the Powow: the label point sits in the water
  // ── kid life ──
  ['lake-gardner-beach', 'Lake Gardner Beach', 'The town swimming beach, all summer', -4801, -1731, 450],
  ['town-park', 'Amesbury Town Park', 'Ballfields and playground above the lake', -6332, 4347, 480],
  ['woodsom-farm', 'Woodsom Farm', 'Open fields to run — and the sledding hill', -17623, -5197, 800],
  ['cider-hill', 'Cider Hill Farm', 'Pick apples, then eat a cider donut', 2497, -15116, 500],
  ['alliance-park', 'Alliance Park', 'Riverside playground at Salisbury Point', 3696, 14947, 400],
  ['batchelder-park', 'Batchelder Park', 'Neighbourhood ballfield off Route 110', -5303, -7338, 400],
  ['collins-park', 'Collins Avenue Park', 'Tucked-away playground east of downtown', 7812, -642, 380],
  ['training-field', 'Training Field Park', 'Where the militia drilled — now a park', 13265, 1302, 400],
  ['huntington-park', 'Huntington Memorial Park', 'Little green on the way to the river', -2564, 9929, 350],
  ['golf-club', 'Amesbury Golf & Country Club', 'Nine holes since 1921', 12293, -3721, 600],
  // ── history ──
  ['whittier-home', 'Whittier Home', 'The poet who wrote here helped end slavery', -3396, 2053, 320],   // 86 Friend St, from the built address layer (OSM doesn't name the house)
  ['bartlett-museum', 'Bartlett Museum', "The old school full of the town's attic", 938, 11226, 340],
  ['lowells-boat-shop', "Lowell's Boat Shop", 'America’s oldest boat shop — the dory was born here', 10423, 13877, 340],
  ['powder-house', 'The Powder House', 'A whitewashed stone dome that held the gunpowder', 10646, 1724, 300],
  ['golgotha-boulder', 'Golgotha Boulder', 'A giant rock with a grim old name', 3873, 9666, 340],
  ['captains-well', "The Captain's Well", 'The well from Whittier’s poem, still here', -119, 8649, 300],
  ['doughboy', 'The Doughboy', 'The World War I soldier on the green', -137, 8462, 300],
  ['old-corner-cemetery', 'Old Corner Cemetery', 'The oldest headstones in town', 3702, -171, 340],
  ['mount-prospect', 'Mount Prospect Cemetery', 'The hilltop burying ground', 6199, 4543, 420],
  // ── the river ──
  ['boat-launch', 'Amesbury Boat Launch', 'Put a kayak in the Merrimack here', 2816, 16007, 380],
  ['merrimack-landing', 'Merrimack Landing', 'Woods and riverbank on the big river', -13869, 23871, 700],   // Deer Island was the first pick — OSM's river poly floods the whole island, so there is no dry ground to stand on
  // ── woods and water ──
  ['town-forest', 'Amesbury Town Forest', 'Miles of trails in the town woods', -23398, 4121, 800],
  ['powow-conservation', 'Powow River Conservation Area', 'Follow the Powow through the trees', -6699, -6322, 550],
  ['whittier-hill', 'Whittier Hill Reservation', 'Woods on the hill named for the poet', -10121, -274, 500],
  ['battis-farm', 'Battis Farm', 'Old farm fields kept wild', -9547, -11808, 600],
  ['lake-attitash', 'Lake Attitash', 'The big lake on the Merrimac line', -32808, 11857, 800],   // SHORE point (14 m off the water, 27 m from a road) — the poly's interior point is the lake surface
];
export function landmarks() {
  return AMESBURY_LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];
export const levelFixes = [];
// Names OSM carries on POI nodes (or nowhere) but not on the footprints —
// stamped onto the containing building so HEROES/search bind. Anchors verified
// inside the footprint; watch for NAME_FIX missed at build time.
export const nameFixes = [
  { x: -3396, y: 2053, n: 'Whittier Home' },     // 86 Friend St, from the built address layer — OSM names neither the way nor a POI
  { x: 938, y: 11226, n: 'Bartlett Museum' },    // museum POI node; the way is unnamed
];

// Real-world verified distances guard the projection — add pairs once two
// points are independently verified (never computed from the same formula).
export const qaDistances = [];

export const qaElevationSpots = [
  { name: 'Market Square', lat: 42.858, lon: -70.9301 },
  { name: 'Powow Hill', lat: 42.8672, lon: -70.9385 },
  { name: 'Lake Gardner', lat: 42.8632, lon: -70.9401 },
  { name: 'Chain Bridge', lat: 42.8331, lon: -70.9243 }
];
