// Salem — map-pipeline curation (ported from the salem-experiment fork's
// tools/salem_landmarks.mjs + build_world edits when the towns reunified).

export const dropOsm = [];

// Salem's brick downtown reads fine from the data-driven commercial test alone
// (denser mapped shop POIs than Newburyport) — no hand-drawn core box needed.
export const downtownCore = null;

export const storefrontCorridors = [];

// Curated fast-travel landmarks. These power three things at once (all
// data-driven, no engine changes): the 🗺 Fast-Travel grid, name search in the
// address bar, and ambient "you've reached X" banners within `r`.
//
// Coords are WORLD PIXELS, pulled straight from the built world.json — building
// centroids for the named landmarks, named-area poly centroids for the greens —
// so each point lands exactly on the feature (verified on-land, 0–300px off
// target). `r` is the banner radius in px (÷8 ≈ metres): tight for single
// buildings, wide for open parks. Ordered as a loose
// downtown→trials→waterfront→outer tour.
const SALEM_LM = [
  // id, name, sub, x, y, r
  ['lappin-park', 'Lappin Park', 'Downtown crossroads & the Bewitched statue', 2667, -5588, 360],
  ['witch-house', 'The Witch House', 'The only house left from the 1692 trials', 727, -5802, 360],
  ['witch-museum', 'Salem Witch Museum', 'The 1692 story, told in life-size scenes', 5786, -7749, 420],
  ['charter-burying', 'Charter Street Burying Point', "Salem's oldest graveyard, 1637", 5105, -4940, 380],
  ['gallows-hill', 'Gallows Hill', 'The fateful hill of 1692', -7618, -716, 700],
  ['pem', 'Peabody Essex Museum', 'Art treasures — and a whole house from China inside', 5055, -5725, 340],
  ['salem-common', 'Salem Common', 'The town green, a militia field since 1714', 6961, -7818, 650],
  ['ropes-mansion', 'Ropes Mansion', 'Grand house & garden — yes, the Hocus Pocus one', 147, -5512, 340],
  ['custom-house', 'Custom House', "Hawthorne's granite Custom House on the wharf, 1819", 8389, -5888, 480],
  ['seven-gables', 'The House of the Seven Gables', "Hawthorne's gabled mansion by the sea, 1668", 10596, -6054, 460],
  ['pickering-wharf', 'Pickering Wharf', 'Waterfront shops, boats & chowder', 8000, -4743, 480],
  ['derby-light', 'Derby Wharf Light', "The little lighthouse at the wharf's end, 1871", 10782, -1405, 520],
  ['winter-island', 'Winter Island', 'Harbor park & Fort Pickering Light', 19996, -10509, 750],
  ['salem-willows', 'Salem Willows', 'Seaside park — arcades, pier & popcorn', 19347, -18016, 800],
  // ── top-up 7/6 (14 → 30): kid-life, transport & nature to match NBPT's mix ──
  // downtown & civic
  ['old-town-hall', 'Old Town Hall', "Salem's oldest civic hall, 1816 — on Derby Square", 3518, -5229, 340],
  ['essex-mall', 'Essex Street Mall', 'Brick walking street — shops, buskers & witches', 4093, -5952, 380],
  ['riley-plaza', 'Riley Plaza', 'Leafy downtown green & war memorial', 2733, -4050, 360],
  ['salem-library', 'Salem Public Library', 'Books, story hours & a grand reading room', -2084, -4728, 340],
  ['chestnut-street', 'Chestnut Street', "The McIntire District's street of captains' mansions", -2417, -3366, 420],
  ['howard-cemetery', 'Howard Street Cemetery', '1801 graveyard — where Giles Corey was pressed', 4792, -8468, 360],
  // transport kids know
  ['salem-depot', 'Salem Depot', 'The busy train station — commuter rail to Boston', 2288, -8826, 420],
  ['salem-ferry', 'Salem Ferry', 'Fast ferry across the harbor to Boston', 12798, -6082, 420],
  ['kernwood-bridge', 'Kernwood Drawbridge', 'The swing bridge across to Beverly', 1576, -26416, 450],
  // treats & waterfront
  ['pepper-candy', 'Ye Olde Pepper Companie', "America's oldest candy shop, since 1806", 9950, -6649, 300],
  // kid-life parks, beaches & woods
  ['mack-park', 'Mack Park', 'Sledding hill & a little farm in North Salem', -5885, -7686, 550],
  ['palmer-cove', 'Palmer Cove Park', 'Playground & ballfields by the cove', 6893, 762, 450],
  ['collins-cove', 'Collins Cove', 'Beach & harbor walk out toward the Neck', 8876, -13436, 550],
  ['forest-river', 'Forest River Park', 'Pool, beach & the 1630 Pioneer Village', 10555, 7891, 650],
  ['fort-lee', 'Fort Lee', 'A Revolutionary earthwork fort above the harbor', 16734, -14530, 500],
  ['salem-woods', 'Salem Woods', "Trails & disc golf in Salem's big forest", -6978, 17754, 800],
];
export function landmarks() {
  return SALEM_LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];

// Sofi at Salem Station — 4 storeys. Overture's ML height (5.2 m) reads the old
// ground; the building is newer than the imagery. Anchored point-in-building
// (never a street-name lookup — "Grove Street" also exists in Peabody 14k px away).
export const levelFixes = [
  { x: 204, y: -8408, lv: 4 }
];

// No known-true drive/walk distances curated for Salem yet — add real-world
// verified pairs here (they guard the projection, so don't compute them from
// the same formula they check).
export const qaDistances = [];

export const qaElevationSpots = [
  { name: 'Salem Common', lat: 42.5206, lon: -70.8918 },
  { name: 'Downtown (Essex St)', lat: 42.5215, lon: -70.8967 },
  { name: 'Gallows Hill', lat: 42.521, lon: -70.908 },
  { name: 'Salem Willows', lat: 42.527, lon: -70.872 },
  { name: 'Winter Island', lat: 42.5265, lon: -70.866 }
];
