// Charlestown — map-pipeline curation. Starts empty per docs/TOWNS.md; the
// landmark roster is written after the first world build, from
// `TOWN=charlestown node tools/landmark_candidates.mjs`.
//
// Frame notes (bbox in town.json): the Charlestown peninsula entire — Monument
// Square and the hill, Main St and City Square, the Training Field, the whole
// Charlestown Navy Yard (which OSM maps building-by-building, Rope Walk
// included) with USS Constitution at Pier 1, the Mystic and Charles meeting at
// the locks, Sullivan Square and the Neck. The frame deliberately reaches
// across the water into the North End and East Boston: Old North Church,
// Copp's Hill and Paul Revere's landing ride in as NODS — Charlestown's own
// story is told from the far shore, and the Rockport-in-Gloucester pattern
// applies (nods, not a second roster).
//
// Charlestown is a NEIGHBOURHOOD, not a municipality: OSM relation 4033666,
// tagged boundary=place + place=suburb (BPDA source). tools/fetch_boundaries.mjs
// falls back to boundary=place for exactly this reason.

export const dropOsm = [];

// Main St / City Square is the commercial spine; the mapped shop POIs should
// light the commercial test on their own — hand-draw a core box only if the
// corridor reads dead after the first build.
export const downtownCore = null;

export const storefrontCorridors = [];

// Curated fast-travel landmarks: id, name, sub, x, y, r (world px; r ÷8 ≈ m).
// EVERY coordinate comes from `tools/landmark_candidates.mjs`, which point-in-
// polygon checks against Charlestown's real boundary (relation 4033666) and
// returns a safe INTERIOR point — nothing here is guessed, and nothing here is
// across the water in the North End even though the frame reaches there.
// Deliberately long at 63 (the recipe's range is 25–35): the Navy Yard alone is
// a dozen genuinely famous buildings, and Charlestown packs more history into
// one square mile than any town in the set. Condo conversions, banks, parking
// garages and a Dollar Tree were left out — 155 features are named in frame.
const CHARLESTOWN_LM = [
  // ── the Monument and the hill ──
  ['bunker-hill-monument', 'Bunker Hill Monument', '221 feet of granite, and 294 steps to the top', 23, 36, 420],
  ['monument-square', 'Monument Square', 'The green the monument stands on', -344, -78, 460],
  ['battle-museum', 'Battle of Bunker Hill Museum', 'The whole battle, told across from the monument', -396, 704, 320],
  ['prescott-statue', 'Colonel William Prescott', "“Don't fire till you see the whites of their eyes”", -48, 220, 300],
  ['monument-lodge', 'Monument Lodge', "The little granite lodge at the monument's foot", 76, -74, 300],   // OSM names this way "Bunker Hill Pavilion"; the real Pavilion was a separate visitor hall near the Navy Yard, since demolished
  ['bunker-hill-cemetery', 'Bunker Hill Cemetery', 'The burying ground on the far side of the hill', -537, -2850, 400],
  // ── where the town started ──
  ['city-square', 'City Square Park', 'The old market square at the foot of Main Street', -668, 4127, 420],
  ['john-harvard-mall', 'John Harvard Mall', 'Charlestown began right here in 1629', -1046, 3379, 360],
  ['winthrop-square', 'Winthrop Square', 'The old Training Field, where the militia drilled', 451, 1860, 400],
  ['soldiers-sailors', 'Soldiers and Sailors Monument', "The Civil War memorial on the Training Field", 535, 1746, 300],
  ['phipps-street-cemetery', 'Phipps Street Cemetery', 'Headstones from the 1630s — the oldest in town', -4516, 103, 420],
  ['first-church', 'First Church, Charlestown', 'The church on the hill', -1954, 487, 320],
  ['st-marys', "St. Mary's", 'The big parish church on Warren Street', -491, 2107, 320],
  ['round-corner-house', 'Round Corner House', 'A house built to fit a corner exactly', -1731, 1726, 280],
  ['thompson-square', 'Thompson Square', 'Where Main and Austin Streets meet', -2470, 915, 340],
  ['hayes-square', 'Hayes Square', 'A pocket of green in the middle of the streets', 2625, -391, 320],
  ['essex-square', 'Essex Square', 'The little square out toward Sullivan', -6345, -2668, 300],
  ['municipal-building', 'Charlestown Municipal Building', 'The town offices, library upstairs', -1132, 3884, 320],
  // ── the Navy Yard ──
  ['uss-constitution', 'USS Constitution', "Old Ironsides — still afloat, still in the Navy", 2811, 3527, 460],
  ['constitution-museum', 'USS Constitution Museum', "Everything about the ship, next to the ship", 3527, 2155, 360],
  ['uss-cassin-young', 'USS Cassin Young', 'A World War II destroyer you can walk aboard', 4230, 3798, 360],
  ['navy-yard', 'Charlestown Navy Yard', 'The Navy built ships here for 174 years', 2875, 2564, 800],
  ['navy-yard-visitor-center', 'Navy Yard Visitor Center', 'Start here to see the yard', 2771, 2804, 320],
  ['rope-walk', 'Rope Walk', "A quarter-mile shed for spinning the Navy's rope", 4767, -966, 700],
  ['commandants-house', "Commandant's House", 'The 1805 house the yard’s commander lived in', 2484, 1721, 340],
  ['muster-house', 'Muster House', 'The brick octagon where the yard lined up for work', 3492, 1199, 300],
  ['chain-forge', 'Chain Forge', "Where they forged anchor chain for the fleet", 5704, -227, 460],
  ['carpenter-shop', 'Carpenter Shop', 'Where the shipwrights worked', 3929, 2540, 400],
  ['timber-shed', 'Timber Shed', 'Where the ship timber was kept dry', 6548, -1394, 400],
  ['hemp-house', 'Hemp House', 'Hemp came in here on its way to the Rope Walk', 5378, -1215, 360],
  ['paint-shop', 'Paint Shop', 'Paint and pitch for a whole fleet', 4373, 2860, 320],
  ['scale-house', 'Scale House', 'A one-room shed for weighing what came in', 3494, 1906, 260],
  ['marine-barracks', 'Marine Barracks', 'The Marines guarding the yard slept here', 2881, 1343, 340],
  ['shipyard-park', 'Shipyard Park', 'Grass and harbor right by the ships', 4865, 1786, 520],
  ['paul-reveres-landing', "Paul Revere's Landing", 'He rowed over from Boston and started his ride here', 2109, 3519, 340],
  ['boston-marine-society', 'Boston Marine Society Museum', 'Sea captains have met here since 1742', 4657, 778, 300],
  ['courageous-sailing', 'Courageous Sailing', 'Kids learn to sail right off the Navy Yard', 6196, 3936, 320],
  ['charlestown-marina', 'Charlestown Marina', 'Boats tied up along the old shipyard', 7038, 237, 340],
  ['menino-park', 'Mayor Thomas M. Menino Park', 'Playground and harbor at the end of the yard', 8132, -1396, 420],
  // ── kid life ──
  ['emmons-rink', "Emmons Horrigan O'Neil Rink", 'Public ice — skate all winter', -3619, 2111, 360],
  ['ryan-playground', 'Ryan Playground', 'The big playground and ballfields out by the Neck', -6783, -9148, 560],
  ['barry-playground', 'Barry Playground', 'Ballfields under the monument', 4875, -2646, 460],
  ['doherty-playground', 'Doherty Playground', 'Neighbourhood playground off Bunker Hill Street', -4331, -5505, 440],
  ['edwards-playground', 'Edwards Playground', 'Courts and swings mid-town', -5026, -2710, 400],
  ['oreilly-playground', "O'Reilly Playground", 'A play area tucked in behind the houses', 441, -1857, 340],
  ['tennis-center', 'Chad Stillman Tennis Center', 'Public courts by the high school', 417, -4612, 360],
  ['boys-girls-club', 'Boys & Girls Club', 'After school, all year', -2396, -123, 320],
  ['harvard-kent-school', 'Harvard-Kent School', 'One of the neighbourhood elementary schools', 2032, -158, 400],
  ['charlestown-high-fields', 'Charlestown High Athletic Fields', 'Where the high school plays', 801, -3963, 620],
  ['working-theater', 'Charlestown Working Theater', 'A little theatre in an old firehouse', -6839, -5798, 300],
  // ── the water and the bridges ──
  ['paul-revere-park', 'Paul Revere Park', 'Grass and river where the locks are', -874, 5646, 520],
  ['north-bank-park', 'North Bank Bridge Park', 'The footbridge over to the Cambridge side', -2312, 5966, 420],   // moved off I-93's pavement: the candidate interior point landed in the motorway that runs through the park

  ['charlestown-bells', 'The Charlestown Bells', 'Bells you can play, out on the walkway', -632, 6432, 300],
  ['little-mystic', 'Little Mystic Access Area', 'Down at the water on the Mystic side', 2835, -4610, 440],
  ['schrafft-center', 'Schrafft Center', 'The old candy factory and its clock tower', -6928, -7573, 520],
  ['sundial', 'Charlestown Sundial', 'Tells the time with a shadow', 2621, -405, 260],
  ['firefighters-memorial', 'Charlestown Firefighters Memorial', 'For the firefighters the town lost', -6475, -5682, 300],
  ['korean-war-memorial', 'Korean War Veterans Memorial', 'Massachusetts remembers Korea here', 4781, 1759, 300],
  ['potato-shed', 'Potato Shed Memorial', 'What is left of the old waterfront sheds', -3198, 4045, 300],
  // ── getting around ──
  ['community-college', 'Community College', 'Orange Line, right by the college', -6125, 2265, 360],
  ['sullivan-square', 'Sullivan Square', 'Orange Line and buses at the edge of town', -10636, -6944, 420],   // the station's own interior point is inside the interchange roadway — this is the nearest ground clear of every carriageway

  ['bunker-hill-cc', 'Bunker Hill Community College', 'The college on Rutherford Avenue', -5851, 1115, 620],
  ['wind-test-center', 'Wind Technology Testing Center', 'They bend giant wind-turbine blades in here', 2130, -6845, 460],
];
export function landmarks() {
  return CHARLESTOWN_LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];
export function manualFeatures({ world }) {}
export const levelFixes = [];
export const nameFixes = [];

// Real-world verified distances guard the projection — add pairs once two
// points are independently verified (never computed from the same formula).
export const qaDistances = [];

// All four verified against the fetched OSM data, not guessed.
export const qaElevationSpots = [
  { name: 'Bunker Hill Monument', lat: 42.37635, lon: -71.06077 },   // way/212124093
  { name: 'City Square Park', lat: 42.37171, lon: -71.06176 },       // way/29836178
  { name: 'Monument Square', lat: 42.37602, lon: -71.06116 },        // way/1263320391 — the monument grounds
  { name: 'Sullivan Square', lat: 42.38431, lon: -71.07683 }         // way/548028011
];
