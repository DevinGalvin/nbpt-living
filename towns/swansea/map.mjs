// Swansea — map-pipeline curation. Starts near-empty per docs/TOWNS.md;
// landmarks/fixes get added after the first world build (centroids pulled
// from the built world.json via tools/landmark_candidates.mjs).
//
// Frame notes (bbox in town.json): Swansea Village (Town Hall, the 1900 stone
// library + Christ Church, Village Park / Abram's Rock), Luther's Corner and
// the Route 6 strip, the Cole and Lee Rivers, Gardner's Neck, Ocean Grove and
// the Town Beach on Mount Hope Bay, Touisset, Barneyville (the Myles Garrison
// site where King Philip's War began), Hortonville and Martin House Farm up
// north — plus Brayton Point and the Braga Bridge / Battleship Cove as the
// across-the-water nods.

export const dropOsm = [];

// Swansea has no brick downtown — the village is a stone-and-clapboard green
// and the commerce is the Route 6 strip. Let the data-driven commercial test
// carry it; no hand-drawn core box.
export const downtownCore = null;

export const storefrontCorridors = [];

// Curated fast-travel landmarks: id, name, sub, x, y, r (world px; r ÷8 ≈ m).
// Coords are read off the BUILT world.json — named footprints and POIs where
// OSM carries the name, MassGIS address anchors (`addrs`) where it does not
// (Swansea's OSM is thin: the Town Hall, the high school and the Town Beach
// are all unnamed footprints), poly interior points for parks. Every point
// was land/water/town-checked; see docs/research/swansea.md for the facts.
// Mix per the town recipe: ~1/3 kid-life, then history, transport, nature,
// quirky, neighbour nods — ordered as a loose village→Route 6→shore→west→
// north tour.
const SWANSEA_LM = [
  // the village
  ['town-hall', 'Swansea Town Hall', 'The 1891 stone castle of a town hall — a gift', -289, -972, 320],
  ['library', 'Swansea Free Public Library', 'Granite & red sandstone, 1900 — the Stevens gift', -4, -886, 260],
  ['christ-church', 'Christ Church', 'Granite Gothic with battlements, 1900', 269, -694, 280],
  ['stevens-mansion', 'Stevens Mansion', 'The mustard-yellow 1855 mansion on Main Street', 1069, -747, 280],
  ['case-jr', 'Case Junior High', 'Grades 6–8 on Main Street', -2655, -1707, 350],
  ['swansea-dam', 'Swansea Dam', 'The village lake’s waterfall, lit for the holidays', -3300, -1650, 300],
  ['village-park', 'Village Park', '194 acres of trails, boulders & the Rusty Car', 1538, -4470, 700],
  ['wildcat-rock', 'Wildcat Rock', 'Puddingstone lookout 140 ft up in Village Park', 2690, -8860, 320],
  ['fire-station-1', 'Fire Station 1', 'Frosty & treats here at Holiday in the Village', -1669, -1661, 250],
  ['case-high', 'Joseph Case High School', 'Home of the Cardinals since 1927', -7549, -5425, 450],
  ['memorial-park', 'Swansea Memorial Park', 'The big playground, Little League & the pond', -6847, -2154, 600],
  ['mount-hope-cemetery', 'Mount Hope Cemetery', 'Old stones off Milford Road', -5126, -2110, 450],
  // Route 6 & shopping
  ['venus', 'Venus de Milo', 'Banquet hall since 1959 — famous for its minestrone', 664, 5103, 400],
  ['silver-stone', 'Silver Stone Castle', 'The castle-front fun center on Route 6', -6462, 3333, 350],
  ['swansea-mall', 'Swansea Mall', 'The 1975 mall, closed 2019 — now the Shoppes', -18747, -6596, 700],
  ['regal', 'Regal Swansea', 'The movies, off Swansea Mall Drive', -14971, -4022, 350],
  ['somerset-creamery', 'Somerset Creamery', 'Homemade scoops at the Gardners Neck corner', 2743, 7576, 260],
  // the shore
  ['town-beach', 'Swansea Town Beach', 'Walk out 300 feet at low tide — lifeguards in summer', -18817, 20430, 500],
  ['gardner-elem', 'Gardner School', 'Pre-K to 2, in Ocean Grove', -8551, 20699, 350],
  ['st-francis', 'St Francis of Assisi', 'Where the Memorial Day parade steps off', -4110, 11551, 300],
  ['cedar-cove', 'Cedar Cove Club', 'Beach, tennis & boats on the Neck', -14488, 29794, 350],
  ['the-colony', 'The Colony', 'Seven shingled summer cottages, 1896–1930', -11033, 33588, 400],
  ['neck-point', 'Gardners Neck Point', 'The tip of the Neck — Mount Hope dead ahead', -12400, 35000, 500],
  // Luther's Corner & the west
  ['luther-store', 'Luther Store', '1815 store, post office & library — now the museum', -22141, 2741, 300],
  ['luther-elem', 'Luther School', 'Grades 3–5 off Pearse Road', -21840, 4876, 350],
  ['touisset', 'Touisset', 'Swansea’s quiet west shore on the bay', -24558, 25135, 500],
  ['hoyle-elem', 'Hoyle School', 'Pre-K to 2, up in North Swansea', -34851, -15046, 350],
  ['martin-house', 'Martin House Farm', 'A 1728 farmhouse the same family kept 206 years', -46659, -15421, 400],
  ['first-baptist', 'First Baptist Church', 'Massachusetts’ oldest Baptist church, since 1663', -52341, -20790, 350],
  ['myles-garrison', 'Myles Garrison Site', 'Where King Philip’s War began — June 1675', -63393, -21858, 350],
  ['country-club', 'Swansea Country Club', 'Par-72 public golf on the west side', -55368, -12706, 700],
  // north
  ['ymca', 'Swansea YMCA', 'Pool, gym & summer camp', 11181, -9794, 350],
  ['hailes-hill', 'Hailes Hill', 'Woods & trails on the town’s high ground', 6496, -14669, 700],
  ['simcock-farm', 'Simcock Farm', 'Farm-stand ice cream up north', 17004, -25838, 300],
  // neighbour nods
  ['brayton-point', 'Brayton Point', 'Where the 500-ft cooling towers fell in 2019', -1331, 33054, 700],
  ['battleship-cove', 'Battleship Cove', 'Big Mamie, a sub & the carousel under the Braga', 19578, 37737, 500],
];
export function landmarks() {
  return SWANSEA_LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];

// ---------- manual features: real ground OSM doesn't carry ----------
// 🏖 THE TOWN BEACH, 560 Ocean Grove Ave. OSM maps the coastline here but no
// sand: the town's one public beach rendered as lawn running into the bay. The
// strip below is traced off the mapped waterline itself — the bay ring's long
// straight shore edge from (-19958,20107) to (-17775,20813) — so it can never
// disagree with the water: 175 m of beach centred on the bathhouse address,
// 17 m deep. ⚠️ IDEMPOTENT: build_world runs this AND tools/patch_features.mjs
// re-runs it in place, so the previous copy is dropped by its `s` tag first.
export function manualFeatures({ world }) {
  world.polys = world.polys.filter((p) => p.s !== 'swansea-beach');
  const shoreY = (x) => 20107 + (x + 19958) * ((20813 - 20107) / (19958 - 17775));   // the mapped waterline
  const x0 = -19500, x1 = -18100, dx = -43, dy = -133;                                  // 17 m inland, normal to the shore
  world.polys.push({ k: 'sand', s: 'swansea-beach', p: [
    x0, Math.round(shoreY(x0)) + 6, x1, Math.round(shoreY(x1)) + 6,
    x1 + dx, Math.round(shoreY(x1)) + dy, x0 + dx, Math.round(shoreY(x0)) + dy,
  ] });
}

export const levelFixes = [];

// Names OSM carries only on POI nodes (or not at all) — stamped onto the
// containing footprint so search and HEROES bind. Anchors = footprint centroids
// from the built world.json; each footprint matched to its MassGIS address.
export const nameFixes = [
  { x: -289, y: -972, n: 'Swansea Town Hall' },          // 81 Main St — the POI node sits 40 px off the 405 m² footprint
  { x: -7549, y: -5425, n: 'Joseph Case High School' },   // 70 School St — the 7,548 m² civic block by the fields
  { x: 466, y: -1220, n: 'Christ Church Swansea' },       // 57 Main St (Boston's world has two footprints named plain "Christ Church" — a HEROES key must be unique across towns) — the one footprint on the mapped "Church Grounds" lawn between the library and the mansion
  { x: -2655, y: -1707, n: 'Case Junior High School' },   // 195 Main St — address-exact
  { x: -21844, y: 4887, n: 'Joseph G. Luther School' },   // 100 Pearse Rd — address-exact
  { x: -8553, y: 20703, n: 'Gardner School' },            // 10 Church St — address-exact
  { x: -34784, y: -15165, n: 'Mark G. Hoyle School' },    // 70 Community Ln — address-exact (the footprint is concave; its centroid falls outside it)
];

export const qaDistances = [];

export const qaElevationSpots = [
  { name: 'Swansea Village (Town Hall)', lat: 41.748, lon: -71.19 },
  { name: 'Ocean Grove (Town Beach)', lat: 41.72, lon: -71.21 },
  { name: 'Luther\'s Corner (Route 6)', lat: 41.755, lon: -71.2 },
  { name: 'Hortonville', lat: 41.79, lon: -71.2 }
];
