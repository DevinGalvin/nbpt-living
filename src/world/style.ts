// NBPT Living visual style — bright stylized-real palette for the 3D look.
// New England rules: colored clapboard WALLS, dark shingle ROOFS, brick downtown.

// the season dresses the whole town. The STORY is the calendar: it advances with
// the chapter spine (summer → fall → winter). The manual picker is a post-game
// reward — only once the spine is beaten does ?season=/localStorage take over.
export type Season = 'summer' | 'fall' | 'winter' | 'spring';

const seasonNum = (k: string) => parseInt(localStorage.getItem(k) || '0', 10) || 0;
const isSeason = (s: string | null): s is Season => s === 'fall' || s === 'winter' || s === 'spring' || s === 'summer';

// the season the story is currently in, from chapter progress (legacy off-by-one
// keys: ch1-step = Chapter 2 "Door Under Downtown"; ch3-step = Chapter 4 "Low Water")
// All of Level 1 is summer now (one bright season, no mid-story creep). The town turns
// to winter as a REWARD the moment you finish Level 1 — see the "Seasons Unlocked" beat
// in Game.unlockSeasons(), which sets nbpt-seasons-rewarded + a winter pick, then reloads.
export function storySeason(): Season {
  return 'summer';
}
// The season picker (the post-game reward) unlocks — AND a manual pick is honored, AND
// SEASON defaults to winter — the moment the "Seasons Unlocked" reward fires (finishing
// Level 1). ONE gate for everything season-related: the picker UI (hud), whether SEASON
// honors the saved pick (below), and the winter-vs-summer default. They must agree.
export function seasonsUnlocked(): boolean {
  try { return localStorage.getItem('nbpt-seasons-rewarded') === '1'; } catch { return false; }
}

export const SEASON: Season = (() => {
  try {
    const url = new URLSearchParams(location.search).get('season');   // dev/test absolute override
    if (isSeason(url)) return url;
    if (seasonsUnlocked()) {                                          // post-climax: the unlocked picker
      const p = localStorage.getItem('nbpt-season');
      return isSeason(p) ? p : 'winter';                             // default to the finale's winter
    }
    return storySeason();                                            // mid-story: follow progress
  } catch {
    return 'summer';
  }
})();

// tree + shrub palette, consumed by decor (swapped per season below)
export const TREES = {
  pine: '#3e7048',
  deciduous: ['#4ea24c', '#6aa84a', '#3f8a46'],
  bush: '#7cb85e',
  snowCaps: false
};

export const STYLE = {
  sky: '#aedcf2',
  land: '#c2cf96',

  poly: {
    reserve: '#bcc892',
    grass: '#a3cb76',
    park: '#8fc468',
    cemetery: '#8cbd72',
    wood: '#7cb163',
    scrub: '#9cba74',
    wetland: '#b4c388',
    sand: '#eedfa4',
    island: '#d2d093',
    pitch: '#6fc35e',
    playground: '#e5d79e',
    parking: '#aaad9f',
    plaza: '#c08858',
    water: '#4496ce',
    ocean: '#3585bd',
    fountain: '#7cc8e4',
    pool: '#62c4e6',
    garden: '#8fbe68',
    pier: '#a8854f',
    stone: '#a4a59e',
    airfield: '#b3c489',
    apron: '#9b9e98',
    helipad: '#a9adab'
  } as Record<string, string>,

  shoreline: 'rgba(232, 246, 252, 0.8)',
  marshTick: 'rgba(112, 134, 76, 0.9)',
  sandSpeckle: 'rgba(198, 170, 110, 0.9)',
  plazaStroke: 'rgba(150, 102, 66, 0.9)',
  pitchLine: 'rgba(242, 250, 236, 0.9)',

  treeShadow: 'rgba(40, 62, 40, 0.3)',

  road: {
    casing: '#30333a',
    bridgeCasing: '#24262b',
    motorway: '#484c54',
    trunk: '#484c54',
    primary: '#50545c',
    secondary: '#5a5e65',
    tertiary: '#63676d',
    unclassified: '#6e7278',
    residential: '#6e7278',
    living_street: '#777a80',
    busway: '#63676d',
    service: '#82858a',
    centerline: '#f4cf52'
  } as Record<string, string>,

  path: {
    foot: '#dcd0a2',
    footCasing: '#b2a578',
    ped: '#d8b890',
    pedCasing: '#b29270',
    cycle: '#bf6557',
    cycleCasing: '#975146',
    board: '#c69c68',
    boardTick: '#9e784a',
    track: '#a88e62',
    crossing: 'rgba(246, 244, 234, 0.92)',
    steps: '#b2a578',
    pierline: '#a8854f',
    pierTick: '#8a6a3c',
    stoneline: '#a4a59e'
  } as Record<string, string>,

  rail: { base: '#50545a', tie: '#8a8f95' },

  building: {
    wallDarken: 0.78,           // side-shade multiplier baked into wall colors
    // Newburyport house palette: white/cream colonials dominate, with the full
    // historic range — sage, Hancock yellow, wedgewood, plus the deep Federal
    // colors (barn red, navy, olive, mustard, cranberry)
    wallsHouse: ['#f7f3e6', '#f7f3e6', '#f7f3e6', '#f2ecd9', '#efe7cf', '#e9e0c2', '#f0e3ba',
                 '#cdd8cc', '#b9c9bb', '#bfcdd6', '#a9bcc8', '#d9cdb4', '#cbbfa6',
                 '#e3d3c2', '#9aa9b4', '#aab394', '#f4efe0',
                 '#944033', '#5d6f88', '#41526a', '#6e7247', '#c8a142', '#7d8c6c', '#7e3434'],
    // weathered + stained cedar shakes for the Plum Island shake cottages — varied,
    // not just brown (driftwood grays, blue-grays, sage alongside the cedar tones)
    wallsShake: ['#b3a48c', '#a69884', '#998c78', '#bcae96', '#8f8470', '#9aa3a0', '#8b97a0', '#a8ad9e', '#b7b0a2', '#7e8a86'],
    awnings: ['#3f5d3a', '#7a2f2c', '#2c3e5c', '#8a6b3c', '#3c3c3e', '#5d3f63'],
    cars: ['#b5443a', '#3e5c84', '#d8d5cc', '#3a3c40', '#7c8b96', '#5e7e54', '#c8b04a', '#8a4a68'],
    wallsCommercial: ['#fdfcf8', '#faf8f2', '#f8f5ec'], // tint over the real brick texture
    // Untextured masonry for the share of downtown blocks a city builds in
    // something other than brick — Quincy granite, limestone, buff and grey
    // pressed brick, brownstone, painted stucco. Only towns that set
    // TOWN.masonryMix ever see these (Newburyport's downtown really is all brick).
    wallsStone: ['#cfc9ba', '#c2bcae', '#b6b2a6', '#d6d1c2', '#a9a49a',
                 '#b9a894', '#9d8d7d', '#c8bda9', '#a89e94', '#8f8578'],
    wallsCivic: ['#e8d8a8', '#ddca90'],
    wallsChurch: ['#faf7ea', '#f4efe0'],
    wallsIndustrial: ['#aeb4b7', '#a1a7aa'],
    wallsShed: ['#a59a88', '#b0a28c', '#968b7a'],
    // shingle roof colors (charcoal asphalt + weathered cedar)
    roofs: ['#5c5852', '#67625c', '#534f4b', '#6e665d', '#615d59', '#7d7062', '#4a4744', '#776c5c'],
    // flat-roof membranes: real downtown roofs from above are a mix — dark EPDM,
    // greys, gravel tans, a silver coating, pale TPO — not one beige
    roofsCommercial: ['#3f3d3b', '#4c4a47', '#5d5a56', '#6e6a65', '#7e7a73', '#8d8577', '#9fa1a0', '#b3b0a8'],
    doors: ['#8e2f2a', '#1f4f5e', '#22231f', '#39511f', '#6e4520', '#27395c'],
    shutters: ['#2c4326', '#22231f', '#2c4326', '#1f3346'], // Essex green, black, navy
    glass: '#36434d',
    glassLit: '#eac678',
    trim: '#faf8f0',
    chimney: '#8e5240'
  },

  label: {
    street: '#34383c',
    streetHalo: 'rgba(250, 248, 240, 0.92)',
    area: '#48662f',
    areaHalo: 'rgba(246, 248, 234, 0.85)',
    water: '#27628d',
    waterHalo: 'rgba(232, 244, 250, 0.85)'
  }
};

// ---------- seasonal dressing: swap the tables once, the whole town follows ----------
// (ground patterns derive their accents from these bases via tint(), so snow
// stipple and autumn mottle come for free)
if (SEASON === 'fall') {
  STYLE.sky = '#d8cfb6';
  STYLE.land = '#c2b483';
  Object.assign(STYLE.poly, {
    reserve: '#bcae78', grass: '#bcaf6c', park: '#b2a866', cemetery: '#aaa26a',
    wood: '#a2773f', scrub: '#a8945e', wetland: '#bcab74', garden: '#a49a5e',
    pitch: '#8aa858', airfield: '#aea273'
  });
  TREES.deciduous = ['#e07a28', '#efa53a', '#cc4e26', '#ecc14a', '#b8642a', '#d98c30', '#c43d2e'];
  TREES.bush = '#a87f3e';
} else if (SEASON === 'spring') {
  // cherry-blossom town: fresh lawns, pink canopies (ported from the live build)
  STYLE.sky = '#b8e0f4';
  STYLE.land = '#cdd9a0';
  Object.assign(STYLE.poly, {
    grass: '#9cc66a', park: '#94c062', reserve: '#a4c474', garden: '#90ba5c', pitch: '#7cb84e'
  });
  TREES.deciduous = ['#f59ec5', '#fbc6da', '#ef86b5', '#f7b3d0', '#ea7cab', '#a4cf6e'];
  TREES.bush = '#8cbe62';
} else if (SEASON === 'winter') {
  STYLE.sky = '#9db1c9';
  STYLE.land = '#e7ebee';
  Object.assign(STYLE.poly, {
    reserve: '#e3e7ea', grass: '#eaeef1', park: '#e6eaed', cemetery: '#e2e6e9',
    wood: '#dce1e6', scrub: '#dfe3e7', wetland: '#dde2e6', garden: '#e3e7ea',
    pitch: '#e6eaed', sand: '#eae8db', island: '#e2e1d2', playground: '#e7e5d9',
    airfield: '#e1e5e8', parking: '#c6cacc', pool: '#cfdde4', fountain: '#cfdde4'
  });
  STYLE.treeShadow = 'rgba(60, 72, 88, 0.2)';
  // plowed streets between white banks: snowy casings line every road
  STYLE.road.casing = '#dde2e7';
  STYLE.poly.plaza = '#c7a489';            // frosted brick
  Object.assign(STYLE.path, {
    foot: '#e4e7ea', footCasing: '#c2c8ce', ped: '#e0e3e7', pedCasing: '#bfc5cb',
    track: '#d8dce0', steps: '#c2c8ce'
  });
  // roofs carry the snow load; shingle texture tints to drifted white
  STYLE.building.roofs = ['#e6e9ec', '#edf0f2', '#dfe3e8', '#e9ecee', '#e3e7ea'];
  STYLE.building.roofsCommercial = ['#dfe3e6', '#e7eaec', '#dde1e5'];
  TREES.pine = '#39634b';
  TREES.deciduous = ['#e2e6ea', '#d9dee4', '#e7eaed'];  // snow-laden canopies
  TREES.bush = '#dfe4e8';
  TREES.snowCaps = true;
}

// deterministic 32-bit hash for stable per-feature variation
export function hash32(a: number, b = 0, c = 0): number {
  let h = (a | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (b | 0), 0x85ebca6b);
  h = Math.imul(h ^ (c | 0), 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick(list: string[], seed: number): string {
  return list[hash32(seed) % list.length];
}
