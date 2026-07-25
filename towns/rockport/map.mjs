// Rockport — map-pipeline curation. Everything town-specific that
// tools/build_world.mjs and tools/fetch_terrain.mjs consume lives here.
// The engine logic stays in tools/; this file is pure data + tiny hooks.

export const dropOsm = [];
export const downtownCore = null;
export const storefrontCorridors = [];

// ---------- curated landmarks ----------
// Every coordinate below came out of `TOWN=rockport node tools/landmark_candidates.mjs`
// against the BUILT world.json: point-in-polygon checked against Rockport's own
// municipal boundary (the bbox reaches into Gloucester), and polys use a
// pole-of-inaccessibility interior point rather than a centroid, because a
// crescent's centroid can land in the sea. Nothing here is eyeballed.
//
// Bearskin Neck and Dock Square exist in OSM only as STREETS, so those two use
// the real street midpoint — still data, not a guess.
//
// Tour order: the harbor and the Neck → the town → the beaches → Pigeon Cove
// and Halibut Point → the islands.
const LM = [
  // ── the harbor & Bearskin Neck ──
  ['motif-1', 'Motif No. 1', 'The red fish shack — the most painted building in America', 3359, -2894, 380],
  ['bearskin-neck', 'Bearskin Neck', 'The crowded little lane of shops out onto the harbor', 3983, -4415, 420],
  ['dock-square', 'Dock Square', 'Where Main Street meets the Neck', 2053, -2288, 380],
  ['inner-harbor-park', 'Inner Harbor Park', 'Benches right on the working harbor', 3000, -3047, 340],
  ['ellens-harborside', "Ellen's Harborside", 'Breakfast on the harbor since 1954', 2724, -1749, 300],
  ['helmuts-strudel', "Helmut's Strudel", 'Strudel and cider at the end of the Neck', 3489, -3891, 280],
  // ── the town ──
  ['shalin-liu', 'Shalin Liu Performance Center', 'A concert hall whose stage window looks out to sea', 721, -2189, 340],
  ['rockport-art-assoc', 'Rockport Art Association', 'The artists’ colony’s own gallery, founded 1921', -418, -1865, 320],
  ['carnegie-library', 'Rockport Public Library', 'The 1907 Carnegie library', 346, -1575, 300],
  ['rockport-town-hall', 'Rockport Town Hall', 'Town meeting still happens here', 296, -656, 320],
  ['first-congregational', 'First Congregational Church', 'The white steeple over the village', 776, -1658, 320],
  ['millbrook-meadow', 'Millbrook Meadow', 'The brook, the willows and the duck pond', -2003, -2500, 420],
  ['beech-grove', 'Beech Grove Cemetery', 'The old burying ground up the hill', 1882, 5535, 560],
  // ── the beaches ──
  ['front-beach', 'Front Beach', 'The town beach, a minute from Dock Square', -753, -2621, 420],
  ['old-garden-beach', 'Old Garden Beach', 'A pocket of sand below the headlands', 7623, -2111, 380],
  ['the-headlands', 'The Headlands', 'The rocky lookout over the whole harbor', 6016, -2935, 420],
  ['cape-hedge-beach', 'Cape Hedge Beach', 'Long open sand on the south shore', 6666, 19508, 620],
  ['pebble-beach', 'Pebble Beach', 'Round stones that clatter in the surf', 11764, 18189, 520],
  ['manning-park', 'Manning Park', 'Ballfields and the town playground', -5342, -4410, 620],
  ['evans-field', 'Evans Field', 'Rockport’s ball field', -6934, 815, 520],
  // ── Pigeon Cove, the quarries & Halibut Point ──
  ['halibut-point', 'Halibut Point', 'Quarry, granite ledge and the open Atlantic at the tip of Cape Ann', -7257, -27568, 800],
  ['pigeon-hill-park', 'Pigeon Hill Park', 'Woods above Pigeon Cove', -5816, -14614, 560],
  ['babson-museum', 'James A. Babson Museum', 'A 1658 cooperage shop, kept as it was', -12338, 15292, 320],
  ['emerson-inn', 'Emerson Inn', 'The old seaside hotel at Pigeon Cove', -2813, -20959, 340],
  ['briar-swamp', 'Briar Swamp', 'Wild woods and bog in the middle of town', -12798, 10937, 800],
  ['pool-hill', 'Pool Hill Town Forest', 'Quiet trails on the west side', -10494, 1820, 700],
  ['rockport-golf', 'Rockport Golf Club', 'The links on the south side of town', 9839, 5834, 750],
  // ── the islands ──
  ['thacher-island', 'Thacher Island', 'The twin lights offshore — the only working pair in America', 27797, 17416, 800],
  ['cape-ann-light', 'Cape Ann Light', 'One of Thacher Island’s Twin Lights, 1861', 29636, 14972, 400],
  ['straitsmouth-light', 'Straitsmouth Island Light', 'The little light on the island off the Neck', 20924, -5549, 420],
];
export function landmarks() {
  return LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];
export const levelFixes = [];

// Names OSM carries on POI nodes but not on the footprints — stamped onto the
// containing building so HEROES/search bind. Without these two the town's most
// photographed building renders as an anonymous shed. Anchors = the POI node
// coords, each verified inside its footprint (tools/patch_names.mjs).
// The other Rockport heroes (Old Sloop, First Universalist, Art Association,
// Carnegie, Shalin Liu, Straitsmouth) are named on the ways already.
export const nameFixes = [
  { x: 3359, y: -2894, n: 'Motif No. 1' },              // OSM's attraction node says "Motif #1"; the shack's way is unnamed
  { x: 1431, y: -1324, n: 'Rockport Public Library' },  // 17 School St, the 1864 granite mill block (NOT the Carnegie, which IS named)
];

export const qaDistances = [];

export const qaElevationSpots = [
  { name: 'Dock Square', lat: 42.6559, lon: -70.6200 },
  { name: 'Halibut Point', lat: 42.6906, lon: -70.6310 },
  { name: 'Pigeon Cove', lat: 42.6759, lon: -70.6155 },
];
