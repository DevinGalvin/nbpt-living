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
  ['ellis-square', 'Ellis Square', "Downtown's little 1921 crossroads park", 1189, 7980, 340],   // Cabot at Church St per Historic Beverly — old point was 240 m up Cabot (7/14 audit)
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
  ['hall-whitaker', 'Hall-Whitaker Bridge', 'The little drawbridge being rebuilt', -5019, 7412, 400],   // the actual Bridge St drawbridge (OSM way 191859873) — old point was 640 m off in Ryal Side (7/14 audit)
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
  ['wenham-lake', 'Wenham Lake', "The lake that iced Queen Victoria's drinks", -9428, -28660, 700],   // west shore waterline — old point sat 195 m inland in the Moraine Farm woods (7/14 audit)
  ['airport', 'Beverly Regional Airport', 'Watch the little planes take off!', -23681, -23284, 900],
  // across the harbor
  ['salem-willows', 'Salem Willows', 'Across the harbor: arcade & popcorn land', 6262, 20198, 700],
  // Manchester-by-the-Sea NODS. The village, harbor and Singing Beach all ride in
  // this frame (bbox east edge is lon −70.755), and it carried nothing at all until
  // the 7/25 accuracy pass put a full 13-spot roster here. Manchester has since
  // become its own town, so this trims back to the same pattern Gloucester uses for
  // Rockport: a few nods at the edge of the map, with the real roster next door.
  // Anyone who travels out here can hop towns from the 🗺 switcher.
  ['man-village', 'Manchester Village', "Beach Street's shops, two blocks from the sand", 72448, -14248, 450],
  ['singing-beach', 'Singing Beach', 'The sand really squeaks when you walk on it', 77674, -8830, 800],
  ['man-harbor', 'Manchester Harbor', 'Moorings, boatyard sheds and the drawbridge', 69741, -12304, 500],
  ['tucks-point', "Tuck's Point", 'A round Victorian pavilion out over the water', 66181, -8640, 450],
];
export function landmarks() {
  return BEVERLY_LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];

// Cummings Center parking. The campus lots have their drive AISLES mapped in OSM
// (service ways) but no amenity=parking POLYGONS, so the fields rendered as bare
// grass with no cars (Devin, Beverly 7/6). These hand-drawn lot polygons let the
// aisle-anchored stall filler drop parked cars. The filler self-guards against
// buildings and water (decor.ts), so a polygon may safely lap the wrapped "100
// Cummings Center" footprint and the Bass River — stalls there are skipped and
// the river still paints over the lot (water z=7 > parking z=6). Coords are world
// px, snapped to the built world.json's service-aisle extents; every lot verified
// in preview (cars land only on the open apron, none in a building/road/river).
export const cummingsParking = [
  // the big lot north of the main building, east of the Bass River, west of
  // McPherson Dr — the clearest bare apron in Devin's screenshot
  { k: 'parking', z: 6, p: [-4400, 820, -3600, 820, -3600, 3340, -4400, 3340] },
];
export function manualFeatures({ world }) {
  for (const p of cummingsParking) world.polys.push({ ...p });
}

export const levelFixes = [];

// Names OSM carries on POI nodes but not on the footprints — stamped onto the
// containing building so HEROES/search bind. Anchors = the POI node coords
// (verified inside the footprint at build time: watch for NAME_FIX missed).
export const nameFixes = [
  { x: 969, y: 9097, n: 'Beverly City Hall' },
  { x: 3781, y: 7917, n: 'Hale Farm' },          // POI node is in the yard; anchor = footprint centroid
  { x: 39, y: 10768, n: 'Cabot House' },        // OSM POI says "John Canot House" (sic)
  { x: 15791, y: 10220, n: 'Hospital Point Light' },   // the k:'light' tower footprint (station fully mapped)
  { x: -9737, y: -5681, n: 'Beverly Golf & Tennis Clubhouse' },   // 134 McKay addr → the 58k px² long footprint
  // Manchester-by-the-Sea: OSM names almost nothing here on the building WAYS —
  // town hall, library, church, museum are all POI nodes only (7/25 pass).
  { x: 70754, y: -14995, n: 'Manchester-by-the-Sea Town Hall' },
  { x: 71392, y: -15097, n: 'Manchester-By-The-Sea Public Library' },   // OSM's Title Case — keep verbatim, HEROES keys on it
  // stamped with the town in the name because Beverly ALREADY has a "First Parish
  // Church" (its own hero) in the same world — a bare name would collide
  { x: 70995, y: -15096, n: 'First Parish Church (Manchester)' },   // POI node sits in the yard 13 m off — anchor = the Central St footprint centroid (reverse-geocode confirmed)
  { x: 71557, y: -15403, n: 'Trask House Museum' }
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
