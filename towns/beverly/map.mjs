// Beverly — map-pipeline curation. Starts near-empty per docs/TOWNS.md;
// landmarks/fixes get added after the first world build (centroids pulled
// from the built world.json, like Salem's were).

export const dropOsm = [];

// Cabot Street is Beverly's State Street — dense mapped shop POIs downtown
// should light the commercial test on their own; hand-draw a core box only
// if the corridor reads dead after the first build.
export const downtownCore = null;

export const storefrontCorridors = [];

// Curated fast-travel landmarks: id, name, sub, x, y, r (world px; r ÷8 ≈ m).
// Coords snapped to built world.json features (building/POI/label centroids,
// or the address layer where OSM lacks the name) and water-checked — every
// point verified dry. Facts from docs/research/beverly.md (photo-verified).
// Mix per the town recipe: ~1/3 kid-life, then history, transport, nature,
// quirky — ordered as a loose downtown→shore→farms→north tour.
const BEVERLY_LM = [
  // downtown & civic
  ['ellis-square', 'Ellis Square', "Downtown's little 1921 crossroads park", 1115, 6043, 340],
  ['cabot-theatre', 'The Cabot', '1920 movie palace of record-setting magic', 636, 5848, 340],
  ['library', 'Beverly Public Library', 'A marble-and-brick book palace, 1913', 2165, 6324, 340],
  ['city-hall', 'Beverly City Hall', "A merchant's 1783 mansion runs the city", 969, 9097, 340],
  ['cabot-house', 'Cabot House', '1781 brick mansion full of town treasures', 39, 10768, 340],
  ['hale-farm', 'Hale Farm', 'The minister who helped END the witch trials', 3771, 7812, 340],
  ['ancient-burial', 'Ancient Burial Ground', '1672 graveyard — Rev. Hale rests here', 1598, 8689, 380],
  ['beverly-common', 'Beverly Common', 'The old town common, now a playground hub', 3500, 7067, 550],
  ['fish-flake-hill', 'Fish Flake Hill', 'Sea captains’ lane that smelled of codfish', 1415, 12863, 400],
  // the working waterfront & bridges
  ['glover-wharf', 'Glover Wharf', "Where America's first navy ship set sail, 1775", -1962, 15058, 450],
  ['essex-bridge', 'Veterans Memorial Bridge', 'The big bridge over to Salem', -4532, 18182, 500],
  ['hall-whitaker', 'Hall-Whitaker Bridge', 'The little drawbridge being rebuilt', -9103, 4254, 400],
  ['beverly-depot', 'Beverly Depot', '1897 depot — trains AND steak', -3713, 9509, 400],
  ['cummings-center', 'Cummings Center', "'The Shoe' — a concrete giant full of windows", -4473, -750, 550],
  ['obear-park', 'Obear Park', 'Riverside playground on the Ryal Side', -13552, 10279, 500],
  // the shore
  ['independence-park', 'Independence Park', 'Swim where the Declaration was read first', 2311, 13681, 450],
  ['dane-beach', 'Dane Street Beach', 'Sandy town beach with summer lifeguards', 6677, 8899, 500],
  ['lynch-park', 'Lynch Park', 'Rose garden, beaches & THE sledding hill', 12578, 10703, 700],
  ['hospital-point', 'Hospital Point Light', "A lighthouse in somebody's front yard", 15968, 10292, 400],
  ['hurd-stadium', 'Hurd Stadium', 'Panthers football under Friday lights', 7065, 1785, 500],
  ['bourque-arena', 'Bourque Arena', "Skate where a Bruins legend's name hangs", 21531, 862, 400],
  ['sally-milligan', 'Sally Milligan Park', 'Woodsy shortcut trails between neighborhoods', 13776, -3377, 550],
  // the Farms & the east
  ['prides-crossing', 'Prides Crossing', 'Tiny green depot that sells fudge', 35794, -1219, 400],
  ['captain-dustys', "Captain Dusty's", 'Beach-day ice cream in the Farms village', 37832, -2671, 300],
  ['farms-village', 'Beverly Farms', "The Farms' own little downtown", 43420, -4220, 450],
  ['west-beach', 'West Beach', "The Farms' mile-long beach", 44645, 887, 800],
  ['misery-islands', 'Misery Islands', 'Shipwreck islands you reach by boat', 53461, 7752, 800],
  ['camp-paradise', 'Camp Paradise', 'Deep woods with the best name in town', 19561, -9787, 800],
  ['long-hill', 'Long Hill', 'Secret hilltop gardens around a brick house', 22137, -26736, 700],
  // north end
  ['balch-house', 'Balch House', "One of America's oldest wooden houses", -2887, -3724, 340],
  ['harry-ball', 'Harry Ball Field', 'Oldest Little League in Massachusetts', 16180, -15026, 450],
  ['petes-park', "Pete's Park", 'Playground honoring Ice Bucket hero Pete Frates', 17519, -18733, 400],
  ['norwood-pond', 'Norwood Pond', 'Fishing pond with 400-year-old stone walls', 6662, -22823, 600],
  ['nicks', "Nick's Famous Roast Beef", 'North Shore roast beef, since 1975', -2729, -21918, 300],
  ['moraine-farm', 'Moraine Farm', 'Olmsted practiced for Biltmore here', -9626, -23657, 700],
  ['wenham-lake', 'Wenham Lake', "The lake that iced Queen Victoria's drinks", -11702, -28643, 700],
  ['airport', 'Beverly Regional Airport', 'Watch the little planes take off!', -23681, -23284, 900],
  // across the harbor
  ['salem-willows', 'Salem Willows', 'Across the harbor: arcade & popcorn land', 6262, 20198, 700],
];
export function landmarks() {
  return BEVERLY_LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];

export const levelFixes = [];

// Names OSM carries on POI nodes but not on the footprints — stamped onto the
// containing building so HEROES/search bind. Anchors = the POI node coords
// (verified inside the footprint at build time: watch for NAME_FIX missed).
export const nameFixes = [
  { x: 969, y: 9097, n: 'Beverly City Hall' },
  { x: 3781, y: 7917, n: 'Hale Farm' },          // POI node is in the yard; anchor = footprint centroid
  { x: 39, y: 10768, n: 'Cabot House' },        // OSM POI says "John Canot House" (sic)
  { x: 15791, y: 10220, n: 'Hospital Point Light' },   // the k:'light' tower footprint (station fully mapped)
  { x: -9737, y: -5681, n: 'Beverly Golf & Tennis Clubhouse' }   // 134 McKay addr → the 58k px² long footprint
];

// Real-world verified distances guard the projection — add pairs once two
// points are independently verified (never computed from the same formula).
export const qaDistances = [];

export const qaElevationSpots = [
  { name: 'Ellis Square (downtown)', lat: 42.5602, lon: -70.8788 },
  { name: 'Lynch Park', lat: 42.5539, lon: -70.8564 },
  { name: 'Beverly Airport', lat: 42.5842, lon: -70.9165 },
  { name: 'Prospect Hill', lat: 42.5588, lon: -70.8683 }
];
