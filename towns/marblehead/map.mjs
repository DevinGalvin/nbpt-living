// Marblehead — map-pipeline curation. Everything town-specific that
// tools/build_world.mjs and tools/fetch_terrain.mjs consume lives here.
// The engine logic stays in tools/; this file is pure data + tiny hooks.
//
// ⚠️ FIRST-BUILD SEED. Every landmark below is authored from lat/lon and has
// NOT yet been checked against a built world.json. Marblehead's Old Town is the
// tightest street grid in the set (crooked colonial lanes, 1-2 px between
// buildings), so a coordinate that is "close" can still land on the wrong roof.
// After the first `TOWN=marblehead npm run map`, re-seat each one on the real
// feature centroid from world.json and convert to world px — the way Salem and
// Gloucester did it — then widen the roster (see docs/TOWNS.md step 4).

export const dropOsm = [];

// Marblehead's retail is a thin ribbon (Washington/State/Pleasant) rather than a
// dense block, so let the data-driven commercial test carry it on the first
// pass; add a hand-drawn core box only if the built world reads too sparse.
export const downtownCore = null;

export const storefrontCorridors = [];

// ---------- curated landmarks (SEED — verify against world.json, see above) ----------
// id, name, sub, lat, lon, radius(m)
const LM = [
  ['crocker-park', 'Crocker Park', 'The harbor overlook the whole town gathers on', 42.5044, -70.8544, 70],
  ['abbot-hall', 'Abbot Hall', "The Spirit of '76 hangs upstairs", 42.4999, -70.8578, 55],
  ['old-town-house', 'Old Town House', 'Market Square’s 1727 meeting hall', 42.5024, -70.857, 45],
  ['fort-sewall', 'Fort Sewall', 'Earthwork fort guarding the harbor mouth since 1644', 42.5064, -70.8497, 80],
  ['old-burial-hill', 'Old Burial Hill', 'The 1638 graveyard on the hill over town', 42.5033, -70.8618, 70],
  ['redds-pond', "Redd's Pond", 'Model sailboats in summer, skates in winter', 42.5039, -70.8608, 50],
  ['lee-mansion', 'Jeremiah Lee Mansion', "A merchant's Georgian mansion, 1768", 42.4996, -70.86, 45],
  ['state-street-landing', 'State Street Landing', 'Where the harbor meets Old Town', 42.5041, -70.8503, 55],
  ['marblehead-light', 'Marblehead Light', 'The iron tower at the tip of the Neck, 1896', 42.5054, -70.8329, 80],
  ['riverhead-beach', 'Riverhead Beach', 'The sand beside the causeway out to the Neck', 42.4966, -70.8434, 70],
  ['devereux-beach', 'Devereux Beach', 'The town beach under the causeway', 42.4903, -70.8452, 80],
];
export function landmarks({ px, PX_PER_M }) {
  return LM.map(([id, name, sub, lat, lon, rM]) => {
    const [x, y] = px(lat, lon);
    return { id, name, sub, x, y, r: Math.round(rM * PX_PER_M) };
  });
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];
export const levelFixes = [];

// No independently-known real-world distances curated yet. Add verified pairs
// once two landmarks are confirmed on the built map — they guard the projection,
// so never compute them from the same formula they're meant to check.
export const qaDistances = [];

export const qaElevationSpots = [
  { name: 'Abbot Hall (Training Field Hill)', lat: 42.4999, lon: -70.8578 },
  { name: 'Old Burial Hill', lat: 42.5033, lon: -70.8618 },
  { name: 'Crocker Park', lat: 42.5044, lon: -70.8544 },
  { name: 'Marblehead Light (the Neck)', lat: 42.5054, lon: -70.8329 },
  { name: 'Devereux Beach', lat: 42.4903, lon: -70.8452 },
];
