// Newburyport — map-pipeline curation. Everything town-specific that
// tools/build_world.mjs and tools/fetch_terrain.mjs consume lives here:
// curated landmarks, hand-added features, spot fixes, and QA checks.
// The engine logic stays in tools/; this file is pure data + tiny hooks.
//
// Coordinates: lat/lon where research gave lat/lon, world px where geometry
// was authored in-game. Hooks receive ctx = { px, PX_PER_M, world }.

// Stale OSM features that no longer exist on the ground — dropped so the map matches today.
// The old golf-course ponds by the Laurel Rd subdivision (off Ferry Rd, east of I-95): the
// course closed, the water hazards dried up, and housing was built. OSM still carries the
// ponds (ways 279021841 + 920420732 and relation 12474826) and not yet the new homes, so
// the game showed a phantom lake amid the neighborhood. (Player-reported, June 2026.)
export const dropOsm = [279021841, 920420732, 12474826];

// Curated historic-core fallback: the dense 1811 brick downtown — Market Sq /
// State to ~Essex / Pleasant / Inn / Water. OR'd with the data-driven
// commercialDowntown test, because NBPT's mapped shop POIs are too sparse to
// carry the whole brick core on data alone. Deliberately tight: the South End's
// wood colonials begin immediately south of this box (lat 42.8093).
export const downtownCore = { nw: [42.8146, -70.8748], se: [42.8093, -70.8652], minAreaM2: 150 };

// Storefront corridors OSM's retail zones miss: the State Street spine itself
// (Market Square up to High Street, documented in docs/research). Buildings
// fronting the corridor get storefront ground floors.
export const storefrontCorridors = [
  { street: 'State Street', yMinPx: -300, southLat: 42.8078 }
];

// ---------- curated landmarks (verified coords from research) ----------
const LM = [
  ['market-square', 'Market Square', 'Heart of the Clipper City', 42.81135, -70.86976, 60],
  ['custom-house', 'Custom House Maritime Museum', 'Granite landmark, 1835', 42.81197, -70.86824, 50],
  ['city-hall', 'City Hall', 'Newburyport, a city since 1851', 42.81123, -70.87276, 45],
  ['inn-street', 'Inn Street', 'Fountain & playground', 42.81072, -70.87051, 50],
  ['boardwalk', 'Waterfront Boardwalk', 'Market Landing Park', 42.8124, -70.86973, 70],
  ['cushing-house', 'Cushing House', 'Museum of Old Newbury, 1808', 42.80667, -70.87111, 40],
  ['courthouse', 'Superior Courthouse', 'Bulfinch design, 1805', 42.80814, -70.87399, 45],
  ['frog-pond', 'Frog Pond · Bartlet Mall', 'Skating & sledding since forever', 42.80812, -70.87475, 80],
  ['old-hill', 'Old Hill Burying Ground', 'Lord Dexter rests here', 42.80748, -70.87651, 60],
  ['browns-square', 'Brown Square', 'Garrison statue', 42.8118, -70.874, 40],
  ['marchs-hill', "March's Hill", 'Best sledding in town', 42.80133, -70.86646, 80],
  ['oak-hill', 'Oak Hill Cemetery', 'Garden cemetery, 1842', 42.80151, -70.87119, 70],
  ['joppa-park', 'Joppa Park', 'Clam country', 42.80697, -70.85872, 60],
  ['mbta', 'Newburyport Station', 'Trains to Boston', 42.79815, -70.87815, 80],
  ['cashman', 'Cashman Park', 'Boat ramp & ballfields', 42.81651, -70.8781, 90],
  ['gillis', 'Gillis Drawbridge', 'Opens on the hour & half hour', 42.8154, -70.87346, 90],
  ['atkinson', 'Atkinson Common', 'The stone tower', 42.82518, -70.89703, 90],
  ['airport', 'Plum Island Airport', 'Oldest airfield in New England, 1910', 42.79616, -70.84156, 110],
  ['pink-house', 'The Pink House Site', '1925–2025 · never forgotten', 42.79631, -70.83019, 80],
  ['wilkinson', 'Wilkinson Bridge', 'Gateway to Plum Island', 42.79779, -70.82149, 80],
  ['pi-light', 'Plum Island Light', 'Guiding ships since 1788', 42.81523, -70.81894, 90],
  ['pi-point', 'Plum Island Point', 'Where the river meets the sea', 42.8165, -70.818, 110],
  ['joppa-flats', 'Joppa Flats Education Center', 'Mass Audubon', 42.7989, -70.8455, 70],
  ['tannery', 'The Tannery', 'Marketplace in the old mill', 42.8101, -70.866, 70],   // 50 Water St courtyard — old point sat a block east of the mill complex (7/14 audit)
  // the west end & river country (coords from the mapped features themselves)
  ['maudslay', 'Maudslay State Park', 'Gardens of the old Moseley estate', 42.82643, -70.92816, 140],
  ['moseley-woods', 'Moseley Woods', 'Pines over the Merrimack', 42.83284, -70.9093, 80],
  ['deer-island', 'Deer Island', 'The Chain Bridge crossing, 1792', 42.83457, -70.90693, 80],
  ['artichoke', 'Artichoke Reservoir', "The city's drinking water", 42.81049, -70.93092, 120],
  ['turkey-hill', 'Turkey Hill', 'West-end farm country', 42.80949, -70.92344, 100],
  ['common-pasture', 'Common Pasture', 'Cows since 1635', 42.7884, -70.91467, 140],
  ['cherry-hill', 'Cherry Hill Fields', 'Soccer Saturdays', 42.81752, -70.91964, 90],
  ['spl-farm', 'Spencer-Peirce-Little Farm', 'Stone farmhouse, 1690', 42.79506, -70.85203, 80]
];
export function landmarks({ px, PX_PER_M }) {
  return LM.map(([id, name, sub, lat, lon, rM]) => {
    const [x, y] = px(lat, lon);
    return { id, name, sub, x, y, r: Math.round(rM * PX_PER_M) };
  });
}

// ---------- beloved local businesses, placed by their real street addresses ----------
// (from docs/research/modern-newburyport.md; buildings carry assessor-imported
// addr tags, so the match puts each name on the right roof)
export const curatedPois = [
  ["Fowle's", '17', 'State Street', 'cafe'],
  ['Anchor Stone Deck Pizza', '44', 'State Street', 'restaurant'],
  ['The Screening Room', '82', 'State Street', 'cinema'],
  ['Simply Sweet', '12', 'Inn Street', 'shop'],
  ['The Angry Donut', '42', 'Inn Street', 'cafe'],
  ['Harbor Creamery', '39', 'Pleasant Street', 'ice_cream'],
  ["Abraham's Bagels", '11', 'Liberty Street', 'cafe'],
  ['The Grog', '13', 'Middle Street', 'pub'],
  ['Black Cow', '40', 'Merrimac Street', 'restaurant'],
  ['Plum Island Kayak', '92', 'Merrimac Street', 'shop'],
  ['Jabberwocky Bookshop', '50', 'Water Street', 'shop'],
  ['Chococoa Baking Co.', '50', 'Water Street', 'cafe'],
  ["Henry Bear's Park", '50', 'Water Street', 'shop'],
  ["Mad Martha's", '51', 'Northern Boulevard', 'cafe'],
  ['Bob Lobster', '49', 'Plum Island Turnpike', 'restaurant']
];
// last resort: positions interpolated offline against calibrated street
// anchors (27.9 px per house number on State St, Screening Room @82 as anchor)
export const curatedPoisHand = {
  "Fowle's": [-109, 519],
  'Anchor Stone Deck Pizza': [-275, 1262],
  'Simply Sweet': [-308, 429]
};

// ---------- manual buildings: real structures OSM hasn't mapped yet ----------
// Footprints are in world px, street-aligned and curb-clearance-checked against
// the State St / High St geometry. Remove an entry once OSM picks the building
// up, or it'll render twice.
export const manualBuildings = [
  // The Residences on the Ridge — 95 High St, the SE corner of State & High. Built on
  // the long-vacant former State Street Mobil lot: a cream Second Empire (mansard-roof)
  // block + a rear carriage house. Footprints set well back south off the sidewalks into
  // the lot. The look is a hand-modeled hero (HEROES['The Residences on the Ridge']).
  { p: [-1270, 3880, -1174, 3958, -1229, 4026, -1325, 3948], k: 'house', lv: 3, style: 'queen_anne', n: 'The Residences on the Ridge' },
  // the rear carriage house (the 4th home)
  { p: [-1315, 3960, -1259, 4006, -1294, 4049, -1350, 4004], k: 'house', lv: 1.5, n: 'Ridge Carriage House' },
];

// ---------- manual level fixes: real heights the data doesn't carry ----------
// Spot overrides on top of the Overture height overlay: each entry sets the
// building CONTAINING the point. Use for buildings NEWER than Overture's ML
// imagery (which reads the old ground) or where the ML height is just wrong.
// Anchor to verified geometry, never a street-name lookup (addrs merge
// same-named streets across towns).
export const levelFixes = [];

// ---------- nameFixes: bind a name onto a footprint so HEROES can find it ----------
// OSM leaves 201 High Street unnamed — no POI node, no building name — so the
// 🏛 "Dexter's Museum" discovery card was pointing at an anonymous house. Naming
// the footprint is what lets decor.ts render it (see HEROES) and what makes it
// searchable. Anchor is the footprint centroid.
export const nameFixes = [
  { x: -7336, y: 494, n: 'Timothy Dexter House' }
];

// ---------- manual yards: real backyard details OSM doesn't carry ----------
// 13 Fox Run Drive (Devin's house): backyard pool + white picket fence enclosing
// the yard. The house faces Fox Run Dr to the NORTH (-y), so the yard is the +y
// side behind it; the fence runs from the west wing's rear corner around to the
// east wall. k:'picket' renders as the white post-and-rail style (decor.ts) —
// the stockade-tan k:'fence' stays for mapped OSM barriers.
export function manualFeatures({ world }) {
  // ⚠️ IDEMPOTENT. build_world runs this hook AND tools/patch_features.mjs re-runs it
  // in place, repeatedly. Without these filters a second run duplicates the pool and
  // the fence — coplanar copies z-fight, and doubled barriers box the yard in twice.
  //
  // The filters must ALSO catch the legacy copies already baked into world.json by an
  // earlier build, which carry no `s` tag at all — matching only on `s === 'foxrun'`
  // leaves those behind and you end up with two fences. `picket` is manual-only by
  // design (mapped OSM barriers render as stockade-tan `fence`), so all of them go;
  // the pool is matched by position, because the other ~70 pool polys are real OSM.
  const nearYard = (p) => Math.hypot(p[0] - -18759, p[1] - 2932) < 400;
  world.polys = world.polys.filter((p) => p.k !== 'pool' || !nearYard(p.p));
  world.barriers = world.barriers.filter((b) => b.k !== 'picket');
  world.pois = (world.pois || []).filter((p) => p.s !== 'nbpt-manual');

  world.polys.push({ k: 'pool', z: 6.8, s: 'foxrun', p: [-18759, 2932, -18707, 2932, -18695, 2944, -18695, 2972, -18707, 2984, -18759, 2984, -18771, 2972, -18771, 2944] });
  world.barriers.push({ k: 'picket', s: 'foxrun', p: [-18822, 2795, -18822, 3055, -18645, 3055, -18645, 2813, -18660, 2812] });

  // The William Lloyd Garrison statue, Brown Square (1893). OSM does not carry it,
  // so the 🏛 "The Paper Boy" discovery card was standing a kid in front of open
  // grass — the one card in the set about abolition, and the town's most famous
  // person. Added as a POI so decor.ts can hand-build it (see POI_HEROES).
  world.pois.push({ x: -2774, y: -392, k: 'memorial', n: 'William Lloyd Garrison Statue', s: 'nbpt-manual' });
}

// QA: known distances (build_world) + elevation spots (fetch_terrain)
export const qaDistances = [
  { label: 'Market Sq -> MBTA station', from: [42.81135, -70.86976], to: [42.79815, -70.87815], expectKm: 1.62 },
  { label: 'Market Sq -> Plum Island Light', from: [42.81135, -70.86976], to: [42.81523, -70.81894], expectKm: 4.2 }
];
export const qaElevationSpots = [
  { name: 'Market Square', lat: 42.81135, lon: -70.86976 },
  { name: 'High St ridge (Cushing House)', lat: 42.80667, lon: -70.87111 },
  { name: "March's Hill top", lat: 42.80133, lon: -70.86646 },
  { name: 'Plum Island beach', lat: 42.805, lon: -70.805 },
  { name: 'Joppa shore', lat: 42.807, lon: -70.858 }
];
