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

const SWANSEA_LM = [];
export function landmarks() {
  return SWANSEA_LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];

export function manualFeatures({ world }) {}

export const levelFixes = [];
export const nameFixes = [];

export const qaDistances = [];

export const qaElevationSpots = [
  { name: 'Swansea Village (Town Hall)', lat: 41.748, lon: -71.19 },
  { name: 'Ocean Grove (Town Beach)', lat: 41.72, lon: -71.21 },
  { name: 'Luther\'s Corner (Route 6)', lat: 41.755, lon: -71.2 },
  { name: 'Hortonville', lat: 41.79, lon: -71.2 }
];
