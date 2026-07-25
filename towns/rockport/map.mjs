// rockport — map-pipeline curation. Everything town-specific that
// tools/build_world.mjs and tools/fetch_terrain.mjs consume lives here.
// The engine logic stays in tools/; this file is pure data + tiny hooks.
//
// FIRST BAKE: landmarks deliberately EMPTY. Marblehead's roster was authored
// from remembered lat/lon and the bake proved it wrong by up to 1.5 km, so the
// order here is bake-then-curate: build the world, read real feature centroids
// out of world.json, point-in-poly check them, and only then write the roster.
export const dropOsm = [];
export const downtownCore = null;
export const storefrontCorridors = [];

export function landmarks() {
  return [];
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];
export const levelFixes = [];
export const qaDistances = [];
export const qaElevationSpots = [];
