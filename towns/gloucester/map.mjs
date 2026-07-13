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
// Populated after the first world build — coords must be snapped to built
// world.json features and water-checked (rocky coast + the Annisquam).
const GLOUCESTER_LM = [];
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
export const nameFixes = [];

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
