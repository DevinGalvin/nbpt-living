// Gloucester — map-pipeline curation. Starts near-empty per docs/TOWNS.md;
// landmarks/fixes get added after the first world build (centroids pulled
// from the built world.json, like the other towns' were).
//
// Frame notes (bbox in town.json): ALL of Cape Ann — downtown + the working
// harbor, Eastern Point, Magnolia + Hammond Castle, Wingaersheek + the
// Annisquam River (the tidal cut that makes Cape Ann an island), Dogtown's
// boulders, Good Harbor, plus Rockport village (Bearskin Neck, Motif #1),
// Halibut Point, and the Thacher Island twin lights as in-frame nods.
// Essex village stays in Ipswich's frame next door.

export const dropOsm = [];

// Main Street is Gloucester's downtown; the mapped shop POIs should light the
// commercial test on their own — hand-draw a core box only if the corridor
// reads dead after the first build.
export const downtownCore = null;

export const storefrontCorridors = [];

// Curated fast-travel landmarks: id, name, sub, x, y, r (world px; r ÷8 ≈ m).
// Coords converted from OSM/Nominatim-pinned lat/lon via the town projection
// (see docs/research/gloucester-landmarks.md — facts + sources per spot; the
// Babson Boulder coords in there are cross-confirmed by two datasets). Mix per
// the town recipe: ~1/3 kid-life, then history, transport, nature, quirky,
// Rockport nods — ordered as a loose harbor→downtown→cape tour. Every point
// water-probed in preview (rocky coast + the Annisquam cut).
const GLOUCESTER_LM = [
  // the Boulevard & the harbor
  ['man-at-the-wheel', 'Man at the Wheel', 'The 1925 bronze statue for lost fishermen', -5487, 4319, 400],
  ['fishermens-wives', 'Fishermen’s Wives Memorial', 'Statue of the families who watched and waited', -8408, 5065, 340],
  ['cg-monument', 'Coast Guard Aviation Monument', 'Where Coast Guard aviation was born', -4234, 4310, 300],
  ['blynman-cut', 'Blynman Bridge', 'Drawbridge up! Boats honking here since 1643', -8664, 5021, 340],
  ['pavilion-beach', 'Pavilion Beach', 'Fiesta beach — seine boats race off the sand', -2884, 4909, 450],
  ['greasy-pole', 'The Greasy Pole', 'Inch down the greased pole over the harbor', -3328, 5785, 300],
  ['st-peters-square', 'St. Peter’s Square', 'Fiesta central — St. Peter watches the fleet', -2146, 3599, 340],
  ['maritime', 'Maritime Gloucester', 'Touch tanks on the working waterfront', 2035, 3448, 340],
  ['seven-seas', 'Seven Seas Wharf', 'Whale boats leave here for Stellwagen Bank', -578, 3004, 340],
  ['fish-pier', 'State Fish Pier', 'Where the big boats land the big catch', 6518, 613, 400],
  // downtown & civic
  ['city-hall', 'Gloucester City Hall', 'The 1870 tower over Fishtown', -466, 809, 340],
  ['cape-ann-museum', 'Cape Ann Museum', 'Fitz Henry Lane’s harbor paintings live here', 249, 871, 340],
  ['library', 'Sawyer Free Library', 'The city’s book haven since 1830', -807, 1146, 340],
  ['holy-cow', 'Holy Cow Ice Cream', 'Award-winning scoops two blocks off Main St', -866, -1209, 300],
  ['burnhams-field', 'Burnham’s Field', 'Downtown’s ballfield, courts + playground', 203, -1964, 450],
  ['good-voyage', 'Our Lady of Good Voyage', 'The fishermen’s church — Mary holds a boat', 3150, -1690, 340],
  ['mbta', 'Gloucester Station', 'Trains to Boston since 1847', -3387, -1369, 400],
  ['newell-stadium', 'Newell Stadium', 'Fishermen football — Turkey Day since 1964', -8060, 2959, 450],
  ['piatt-andrew', 'A. Piatt Andrew Bridge', 'Route 128’s great arch over the Annisquam', -4929, -7598, 450],
  // Stage Fort & the west shore
  ['stage-fort', 'Stage Fort Park', 'Cannons over the harbor — Gloucester began here', -10469, 8176, 550],
  ['ravenswood', 'Ravenswood Park', 'Deep woods trails and a hermit’s story', -24444, 13464, 700],
  ['hammond-castle', 'Hammond Castle', 'A real castle built by a mad-genius inventor', -20387, 26660, 450],
  // East Gloucester & the outer harbor
  ['rocky-neck', 'Rocky Neck', 'One of America’s oldest painting villages', 2744, 8309, 450],
  ['paint-factory', 'The Paint Factory', 'The red harbor landmark that beat the barnacles', 2292, 6699, 340],
  ['beauport', 'Beauport', 'A designer’s 40-room house of secret corners', 1359, 21319, 340],
  ['niles-pond', 'Niles Pond', 'Skate — or ice-sail — when the black ice comes', 4301, 20509, 450],
  ['eastern-point', 'Eastern Point Light', 'Walk the half-mile breakwater to the light', -1628, 30891, 450],
  ['ten-pound', 'Ten Pound Island', 'Lighthouse isle where Coast Guard seaplanes flew', -2330, 11668, 400],
  // beaches & the back shore
  ['good-harbor', 'Good Harbor Beach', 'Walk the sandbar to Salt Island at low tide', 20066, -4035, 800],
  ['dairy-maid', 'Long Beach Dairy Maid', 'Soft-serve ice cream lines in July', 24523, -9322, 300],
  ['wingaersheek', 'Wingaersheek Beach', 'Low tide opens a half-mile sandbar to explore', -15556, -31237, 800],
  // Dogtown & the cape
  ['dogtown-square', 'Dogtown Square', 'Ghost town in the woods — find the carved rocks', 5461, -22448, 550],
  ['whales-jaw', 'Whale’s Jaw', 'Giant split rock like a breaching whale', 9465, -33797, 400],
  ['plum-cove', 'Plum Cove Beach', 'Lanesville’s pocket beach, calm as a bathtub', -834, -52281, 450],
  ['annisquam-light', 'Annisquam Lighthouse', 'White lighthouse over Wingaersheek’s sandbars', -12793, -41679, 400],
  ['halibut-point', 'Halibut Point State Park', 'Granite quarry pool — see Maine on clear days', 19134, -65994, 600],
  // Rockport nods & the twins
  ['rockport-mbta', 'Rockport Station', 'End of the line since 1861', 23256, -36418, 400],
  ['front-beach', 'Front Beach', 'Rockport’s downtown swimming beach', 26754, -39138, 450],
  ['bearskin-neck', 'Bearskin Neck', 'Shop-lined lane to the harbor’s rocky tip', 29964, -39697, 400],
  ['motif-1', 'Motif No. 1', 'The most-painted fishing shack in America', 30981, -39280, 300],
  ['thacher', 'Thacher Island Twin Lights', 'America’s only working twin lighthouses', 57302, -20706, 700],
];
export function landmarks() {
  return GLOUCESTER_LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];

export function manualFeatures({ world }) {}

export const levelFixes = [];

// Names OSM carries on POI nodes but not on the footprints — stamped onto the
// containing building so HEROES/search bind. Anchors = the POI node coords
// (verified inside the footprint at build time: watch for NAME_FIX missed).
export const nameFixes = [
  { x: -465, y: 812, n: 'Gloucester City Hall' },     // townhall POI node; building way unnamed
  { x: 249, y: 875, n: 'Cape Ann Museum' },           // museum POI node → the Davis House footprint
  { x: 1278, y: 21164, n: 'Beauport' },               // OSM POI ("Beauport Museum") sits in the garden; anchor = the 40-vertex house cluster
  { x: 30930, y: -39330, n: 'Motif No. 1' },          // attraction node on Bradley Wharf; shack way unnamed
  { x: 2280, y: 6628, n: 'The Paint Factory' },       // Tarr & Wonson manufactory — unnamed in OSM entirely
];

// Real-world verified distances guard the projection — add pairs once two
// points are independently verified (never computed from the same formula).
export const qaDistances = [];

export const qaElevationSpots = [
  { name: 'Main Street (downtown)', lat: 42.615, lon: -70.662 },
  { name: 'Hammond Castle', lat: 42.5919, lon: -70.6919 },
  { name: 'Dogtown Common', lat: 42.639, lon: -70.649 },
  { name: 'Bearskin Neck (Rockport)', lat: 42.6592, lon: -70.6147 },
  { name: 'Eastern Point Light', lat: 42.5801, lon: -70.6642 }
];
