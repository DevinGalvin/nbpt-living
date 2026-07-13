// Ipswich — map-pipeline curation. Starts near-empty per docs/TOWNS.md;
// landmarks/fixes get added after the first world build (centroids pulled
// from the built world.json, like Salem's and Beverly's were).
//
// Frame notes (bbox in town.json): downtown + the Ipswich River, Crane Beach
// & Castle Neck, Castle Hill, Great/Little Neck, Sandy Point (the Plum Island
// tip is Ipswich!), the Linebrook west side, Appleton Farms, eastern
// Willowdale — plus Essex village (Woodman's) and Rowley Common as the
// neighbor nods.

export const dropOsm = [];

// Market/Central is Ipswich's downtown; the mapped shop POIs should light the
// commercial test on their own — hand-draw a core box only if the corridor
// reads dead after the first build.
export const downtownCore = null;

export const storefrontCorridors = [];

// Curated fast-travel landmarks: id, name, sub, x, y, r (world px; r ÷8 ≈ m).
// Coords snapped to built world.json features / OSM-pinned points (see
// docs/research/ipswich-landmarks.md — facts + sources per spot). Mix per the
// town recipe: ~1/3 kid-life, then history, transport, nature, quirky,
// neighbor nods — ordered as a loose downtown→neck→beach→farms→west tour.
// This frame is marsh + estuary heavy: every point water-checked in preview.
const IPSWICH_LM = [
  // downtown & civic
  ['five-corners', 'Five Corners', "Downtown's famous take-your-turn crossroads", 2295, -933, 340],
  ['meetinghouse-green', 'Meeting House Green', "Here Ipswich defied the King's tax — 1687", 2999, -1875, 400],
  ['choate-bridge', 'Choate Bridge', 'Oldest 2-arch stone bridge in America, 1764', 2620, -750, 300],
  ['riverwalk', 'Ipswich Riverwalk', '400 years of Ipswich painted on the mill', 1820, 1100, 400],
  ['library', 'Ipswich Public Library', 'The town book castle on North Main', 3390, -1377, 340],
  ['town-hall', 'Ipswich Town Hall', 'Where town meeting still runs the show', 5515, -560, 340],
  ['zumis', "Zumi's Espresso", 'Cocoa and ice cream, half the town inside', 1652, -258, 300],
  ['ipswich-museum', 'Ipswich Museum', 'Sea-captain treasures in the old Heard House', 3305, 1529, 340],
  ['whipple-house', 'Whipple House', 'Built 1677 — Ipswich keeps 59 houses this old', 3193, 2106, 340],
  ['south-green', 'South Green', 'Quiet colonial green south of the river', 3403, 3102, 450],
  ['old-north', 'Old North Burying Ground', 'Gravestones since 1634 — spot the winged skulls', -688, -5403, 400],
  ['mbta', 'Ipswich Station', 'Trains to Boston since 1839', 85, 2586, 400],
  ['town-wharf', 'Town Wharf', 'Clam boats out, crab lines down', 8793, -4461, 400],
  // kid-life
  ['bialek-park', 'Bialek Park', 'Little League diamonds + the big playground', -4524, -5066, 450],
  ['jack-welch', 'Jack Welch Stadium', 'Tigers football under the Friday lights', -8236, -7758, 450],
  ['clam-box', 'The Clam Box', 'The 1935 stand shaped like its takeout box', -16920, -14930, 300],
  ['white-farms', 'White Farms Ice Cream', 'Roadside homemade scoops for 50+ years', -26379, -23710, 300],
  // the Necks & the Sound
  ['pavilion-beach', 'Pavilion Beach', 'Free town beach between the two Necks', 32045, -17934, 500],
  ['little-neck', 'Little Neck', 'Cottage colony run by a 350-year school trust', 32425, -14717, 450],
  ['clark-pond', 'Clark Pond', 'Where Great Neck kids skate — dammed in 1897', 28497, -21202, 450],
  ['sandy-point', 'Sandy Point', "Plum Island's wild tip — yes, it's Ipswich!", 41021, -22359, 700],
  // Castle Hill & Crane Beach
  ['castle-hill', 'Castle Hill', "The plumbing king's 59-room castle", 40556, -5652, 500],
  ['grand-allee', 'Grand Allée', 'THE sledding hill — a half-mile lawn to the sea', 41854, -8736, 550],
  ['ada-damon', 'Ada K. Damon Wreck', 'Bones of a 1909 shipwreck at low tide', 38084, -10833, 500],
  ['crane-beach', 'Crane Beach', '4 miles of white sand — mind the greenheads!', 48851, -4710, 900],
  // farms, woods & quirky
  ['russell-orchards', 'Russell Orchards', 'Cider donuts, hayrides, barnyard goats', 26924, 12459, 400],
  ['wolf-hollow', 'Wolf Hollow', 'Real gray wolves — hear the howl on weekends', 17003, 20333, 400],
  ['burgess-field', '1910 Burgess Flying Field', 'Where Ipswich first took to the air', 21180, 17152, 500],
  ['appleton-farms', 'Appleton Farms', 'Farming since 1638 — among America’s oldest', -9678, 27781, 700],
  ['marini-farm', 'Marini Farm', 'Get lost in the 7-acre corn maze', -33081, -6541, 400],
  ['willowdale', 'Willowdale State Forest', 'Pine woods and fire roads to get lost in', -50000, 5172, 700],
  ['rockery', 'The Rockery', 'A climbable boulder maze built 100 years ago', -52201, 38125, 550],
  // neighbor nods
  ['woodmans', "Woodman's of Essex", 'Where the fried clam was invented — 1916', 43461, 43039, 340],
  ['essex-shipbuilding', 'Essex Shipbuilding Museum', 'The town that launched 4,000 wooden ships', 39966, 41484, 400],
  ['rowley-common', 'Rowley Town Common', "Rowley's green since 1639", -26648, -30784, 450],
  ['agawam-diner', 'Agawam Diner', 'Pie heaven in a shiny 1954 diner car', -44956, -22910, 300],
];
export function landmarks() {
  return IPSWICH_LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];

export function manualFeatures({ world }) {}

export const levelFixes = [];

// Names OSM carries on POI nodes but not on the footprints — stamped onto the
// containing building so HEROES/search bind. Anchors = footprint centroids
// pulled from the built world.json (watch for NAME_FIX missed).
export const nameFixes = [
  { x: 26954, y: 12516, n: 'Russell Orchards' },   // the big 1800s store barn (POI node is in the yard)
  { x: 2832, y: 693, n: 'Old Town Hall' },         // 30 S Main — 1833 temple front, unnamed way in OSM
];

// Real-world verified distances guard the projection — add pairs once two
// points are independently verified (never computed from the same formula).
export const qaDistances = [];

export const qaElevationSpots = [
  { name: 'Market Street (downtown)', lat: 42.6793, lon: -70.8412 },
  { name: 'Castle Hill (Great House)', lat: 42.688, lon: -70.766 },
  { name: 'Town Hill (High Street)', lat: 42.6828, lon: -70.8438 },
  { name: 'Great Neck', lat: 42.6946, lon: -70.7823 }
];
