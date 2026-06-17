// NBPT Living — world builder.
// Converts data/raw/overpass.json (raw OSM) into public/world.json (game world).
//
// Coordinate system: local equirectangular centered on Market Square,
// y grows south (screen space), units = world pixels at PX_PER_M px per meter.
// Map data © OpenStreetMap contributors (ODbL).

import { readFile, writeFile, mkdir } from 'node:fs/promises';

const PX_PER_M = 8;
const ORIGIN = { lat: 42.81135, lon: -70.86976 }; // Market Square
const M_PER_DEG_LAT = 111089.0;
const M_PER_DEG_LON = 81791.7; // at 42.81°N
const BBOX = { s: 42.763, w: -70.955, n: 42.84, e: -70.795 }; // all of Newburyport

const px = (lat, lon) => [
  Math.round((lon - ORIGIN.lon) * M_PER_DEG_LON * PX_PER_M),
  Math.round((ORIGIN.lat - lat) * M_PER_DEG_LAT * PX_PER_M)
];

// ---------- geometry helpers (in px space) ----------

function ringArea(pts) {
  // signed shoelace area; pts = flat [x,y,...]
  let a = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length;
    a += pts[i] * pts[j + 1] - pts[j] * pts[i + 1];
  }
  return a / 2;
}

function centroid(pts) {
  let x = 0, y = 0;
  const n = pts.length / 2;
  for (let i = 0; i < pts.length; i += 2) { x += pts[i]; y += pts[i + 1]; }
  return [Math.round(x / n), Math.round(y / n)];
}

function pointInRing(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// drop consecutive points closer than minD px
function simplify(pts, minD = 3) {
  if (pts.length <= 4) return pts;
  const out = [pts[0], pts[1]];
  for (let i = 2; i < pts.length; i += 2) {
    const dx = pts[i] - out[out.length - 2];
    const dy = pts[i + 1] - out[out.length - 1];
    if (dx * dx + dy * dy >= minD * minD) out.push(pts[i], pts[i + 1]);
  }
  return out.length >= 4 ? out : pts.slice(0, 4);
}

// Overpass clipped geometry can contain nulls — split into runs of valid points.
function runsOf(geometry) {
  const runs = [];
  let cur = [];
  for (const g of geometry || []) {
    if (g && Number.isFinite(g.lat) && Number.isFinite(g.lon)) {
      const [x, y] = px(g.lat, g.lon);
      cur.push(x, y);
    } else if (cur.length) {
      runs.push(cur);
      cur = [];
    }
  }
  if (cur.length) runs.push(cur);
  return runs.filter((r) => r.length >= 4);
}

function asRing(geometry) {
  // best-effort single ring from a (possibly clipped) closed way
  const pts = [];
  for (const g of geometry || []) {
    if (g && Number.isFinite(g.lat) && Number.isFinite(g.lon)) {
      const [x, y] = px(g.lat, g.lon);
      pts.push(x, y);
    }
  }
  if (pts.length < 6) return null;
  // drop duplicate closing point
  if (pts[0] === pts[pts.length - 2] && pts[1] === pts[pts.length - 1]) pts.length -= 2;
  return pts.length >= 6 ? simplify(pts) : null;
}

// Stitch open chains (flat px arrays) into rings; force-close leftovers.
function stitchChains(chains, { forceClose = true, joinTol = 60 } = {}) {
  const open = chains.map((c) => c.slice()).filter((c) => c.length >= 4);
  const rings = [];
  const closed = (c) => {
    const dx = c[0] - c[c.length - 2], dy = c[1] - c[c.length - 1];
    return dx * dx + dy * dy <= joinTol * joinTol;
  };
  // peel off already-closed chains
  for (let i = open.length - 1; i >= 0; i--) {
    if (closed(open[i]) && open[i].length >= 8) rings.push(open.splice(i, 1)[0]);
  }
  let guard = 1000;
  while (open.length && guard-- > 0) {
    const a = open.pop();
    if (closed(a) && a.length >= 8) { rings.push(a); continue; }
    const ax = a[a.length - 2], ay = a[a.length - 1];
    let best = -1, bestD = joinTol * joinTol, bestRev = false;
    for (let i = 0; i < open.length; i++) {
      const b = open[i];
      const d1 = (b[0] - ax) ** 2 + (b[1] - ay) ** 2; // a.end -> b.start
      const d2 = (b[b.length - 2] - ax) ** 2 + (b[b.length - 1] - ay) ** 2; // a.end -> b.end (reverse b)
      if (d1 < bestD) { bestD = d1; best = i; bestRev = false; }
      if (d2 < bestD) { bestD = d2; best = i; bestRev = true; }
    }
    if (best >= 0) {
      let b = open.splice(best, 1)[0];
      if (bestRev) {
        const r = [];
        for (let i = b.length - 2; i >= 0; i -= 2) r.push(b[i], b[i + 1]);
        b = r;
      }
      open.push(a.concat(b));
    } else if (forceClose && a.length >= 8) {
      rings.push(a); // implicit straight-line closure
    }
  }
  return { rings, leftovers: open };
}

// ---------- load ----------

const raw = JSON.parse(await readFile(new URL('../data/raw/overpass.json', import.meta.url), 'utf8'));

const world = {
  meta: {
    name: 'Newburyport, MA',
    pxPerMeter: PX_PER_M,
    origin: ORIGIN,
    bbox: BBOX,
    generated: raw.osm3s?.timestamp_osm_base || null,
    attribution: 'Map data © OpenStreetMap contributors (ODbL) — openstreetmap.org/copyright'
  },
  polys: [],     // {k, p:[ring], h?:[holes], n?:name}
  buildings: [], // {p, k, lv, n?}
  roads: [],     // {p, c, w(px), n?, b?}
  paths: [],     // {p, c, w(px), n?, b?}
  rails: [],     // {p}
  labels: [],    // {x, y, t, k, s}
  landmarks: [], // {id, name, sub, x, y, r}
  pois: [],      // {x, y, k, n}
  barriers: [],  // {p, k: fence|hedge|wall} — real mapped property-line barriers
  trees: [],     // {x, y} — real surveyed tree positions
  addrs: [],     // {s: street, a: [[housenumber, x, y], ...]} — every mapped address
  power: []      // {p, c: line|minor} — mapped power lines (vertices = poles)
};

const ROAD_W_M = {
  motorway: 16, motorway_link: 8, trunk: 14, trunk_link: 8,
  primary: 12, primary_link: 8, secondary: 10, secondary_link: 7,
  tertiary: 9, tertiary_link: 7, unclassified: 7, residential: 7,
  living_street: 6, service: 4, busway: 7
};
const PATH_KIND = { footway: 'foot', path: 'foot', steps: 'steps', cycleway: 'cycle', bridleway: 'foot', track: 'track', pedestrian: 'ped' };
const SKIP_HW = new Set(['proposed', 'construction', 'corridor', 'elevator', 'raceway', 'bus_guideway', 'escape', 'platform', 'rest_area', 'services', 'bus_stop', 'emergency_bay']);

function buildingKind(t) {
  const b = t.building;
  if (b === 'church' || b === 'chapel' || b === 'cathedral' || t.amenity === 'place_of_worship') return 'church';
  const lighty = ((t.name || '') + (t.alt_name || '')).toLowerCase().includes('light');
  if (t.man_made === 'lighthouse' || b === 'lighthouse' || (b === 'tower' && lighty)) return 'light';
  if (['school', 'civic', 'public', 'government', 'hospital', 'university', 'fire_station', 'train_station'].includes(b)
    || ['townhall', 'courthouse', 'library', 'fire_station', 'police', 'school', 'hospital', 'theatre', 'community_centre'].includes(t.amenity)) return 'civic';
  if (['commercial', 'retail', 'office', 'supermarket', 'hotel'].includes(b) || t.shop || t.tourism === 'hotel') return 'commercial';
  if (['industrial', 'warehouse', 'boathouse', 'hangar'].includes(b)) return 'industrial';
  if (['shed', 'garage', 'garages', 'carport', 'hut', 'roof', 'service'].includes(b)) return 'shed';
  return 'house';
}

function polyKind(t) {
  if (t.place === 'square' || (t.highway === 'pedestrian' && (t.area === 'yes' || t.type === 'multipolygon')) || t.amenity === 'marketplace') return 'plaza';
  if (t.leisure === 'swimming_pool') return 'pool';
  if (t.leisure === 'garden') return 'garden';
  if (t.amenity === 'fountain') return 'fountain';
  if (t.amenity === 'parking') return 'parking';
  if (t.natural === 'water' || t.waterway === 'riverbank') return 'water';
  if (t.natural === 'wetland') return 'wetland';
  if (t.natural === 'beach' || t.natural === 'sand' || t.natural === 'shoal') return 'sand';
  if (t.natural === 'wood' || t.landuse === 'forest') return 'wood';
  if (t.natural === 'scrub') return 'scrub';
  if (t.natural === 'grassland' || ['grass', 'meadow', 'village_green', 'recreation_ground', 'orchard', 'farmland'].includes(t.landuse)) return 'grass';
  if (t.landuse === 'cemetery') return 'cemetery';
  if (['park', 'garden', 'dog_park', 'golf_course'].includes(t.leisure)) return 'park';
  if (t.leisure === 'nature_reserve') return 'reserve';
  if (t.leisure === 'pitch' || t.leisure === 'track') return 'pitch';
  if (t.leisure === 'playground') return 'playground';
  if (t.man_made === 'pier') return 'pier';
  if (t.man_made === 'breakwater' || t.man_made === 'groyne') return 'stone';
  if (t.aeroway === 'apron') return 'apron';
  if (t.aeroway === 'helipad') return 'helipad';
  if (t.aeroway === 'aerodrome') return 'airfield';
  return null;
}

const Z_ORDER = { reserve: 0, airfield: 0.8, grass: 1, park: 2, garden: 2.5, cemetery: 2, wood: 3, scrub: 3, wetland: 4, sand: 5, pitch: 6, playground: 6, parking: 6, plaza: 6, apron: 6, helipad: 6.5, pool: 6.8, water: 7, fountain: 8, stone: 9, pier: 9 };

const coastChains = [];
const stats = {};
const bump = (k) => (stats[k] = (stats[k] || 0) + 1);

// ---------- storefront evidence pre-pass ----------
// A building has a storefront if it sits in a mapped retail/commercial zone or
// contains a shop/food POI — real land-use data, not a guess.
const retailZones = [];
const retailPts = [];
{
  const RETAIL_NODE_AMENITY = ['restaurant', 'cafe', 'fast_food', 'pub', 'bar', 'bank', 'pharmacy',
    'ice_cream', 'theatre', 'cinema', 'marketplace'];
  for (const el of raw.elements) {
    const t = el.tags || {};
    if (el.type === 'way' && /^(retail|commercial)$/.test(t.landuse || '')) {
      const ring = asRing(el.geometry);
      if (ring) retailZones.push(ring);
    } else if (el.type === 'node' && (t.shop || RETAIL_NODE_AMENITY.includes(t.amenity))) {
      retailPts.push(px(el.lat, el.lon));
    }
  }
  stats['retail-zones'] = retailZones.length;
  stats['retail-pts'] = retailPts.length;
}

function hasStorefrontEvidence(ring) {
  const [cx, cy] = centroid(ring);
  for (const z of retailZones) {
    if (pointInRing(cx, cy, z)) return true;
  }
  for (const [px2, py2] of retailPts) {
    if (pointInRing(px2, py2, ring)) return true;
  }
  return false;
}

// Downtown commercial core (the 1811 brick blocks): Market Sq / State to ~Essex St /
// Pleasant / Inn / Water. Deliberately tight — the South End's wood colonials begin
// immediately south of this box (lat 42.8093).
const CORE_NW = px(42.8146, -70.8748);
const CORE_SE = px(42.8093, -70.8652);
function inDowntownCore(ring) {
  const [cx, cy] = centroid(ring);
  return cx >= CORE_NW[0] && cx <= CORE_SE[0] && cy >= CORE_NW[1] && cy <= CORE_SE[1];
}

// ---------- ways ----------

for (const el of raw.elements) {
  if (el.type !== 'way' || !el.tags) continue;
  const t = el.tags;

  if (t.natural === 'coastline') {
    for (const run of runsOf(el.geometry)) coastChains.push(run);
    bump('coastline');
    continue;
  }

  if (t.barrier && /^(fence|hedge|wall|retaining_wall)$/.test(t.barrier)) {
    const k = t.barrier === 'hedge' ? 'hedge' : t.barrier === 'fence' ? 'fence' : 'wall';
    for (const run of runsOf(el.geometry)) world.barriers.push({ p: simplify(run), k });
    bump('barrier:' + k);
    continue;
  }

  if (t.natural === 'tree_row') {
    // expand the row into individual trees every ~10 m
    for (const run of runsOf(el.geometry)) {
      let acc = 0;
      for (let i = 0; i + 3 < run.length; i += 2) {
        const dx = run[i + 2] - run[i], dy = run[i + 3] - run[i + 1];
        const len = Math.hypot(dx, dy);
        if (len < 0.01) continue;
        let t2 = 80 - acc;
        while (t2 <= len) {
          world.trees.push({ x: Math.round(run[i] + (dx / len) * t2), y: Math.round(run[i + 1] + (dy / len) * t2) });
          t2 += 80;
        }
        acc = (acc + len) % 80;
      }
    }
    bump('tree-row');
    continue;
  }

  if (t.building && t.building !== 'no') {
    const ring = asRing(el.geometry);
    if (!ring) continue;
    const areaM2 = Math.abs(ringArea(ring)) / (PX_PER_M * PX_PER_M);
    if (areaM2 < 6) continue;
    let k = buildingKind(t);
    if (k === 'house' && areaM2 < 40) k = 'shed';
    // Downtown core: untagged 'building=yes' blocks are the 1811 brick rebuild —
    // render them as brick commercial unless they're something more specific.
    if (k === 'house' && areaM2 >= 150 && inDowntownCore(ring)) k = 'commercial';
    // real storefront evidence (retail land-use zone or in-building shop POI):
    // ground floor becomes a storefront, wall material stays whatever it is
    let sf = 0;
    if ((k === 'house' || k === 'commercial' || k === 'civic') && areaM2 >= 60 && hasStorefrontEvidence(ring)) sf = 1;
    const lv = Math.min(6, parseFloat(t['building:levels']) || (k === 'house' ? 1.5 : k === 'shed' ? 1 : 2));
    const b = { p: ring, k, lv };
    if (sf) b.sf = 1;
    if (t.name) b.n = t.name;
    // a mapped architecture style → render the home in that style (the rest stay generic)
    const arch = (t['building:architecture'] || '').toLowerCase();
    const style = arch.includes('queen') ? 'queen_anne' : arch.startsWith('georg') ? 'georgian' : arch.startsWith('fed') ? 'federal' : null;
    if (style) b.style = style;
    world.buildings.push(b);
    if (t.name && (areaM2 > 650 || k === 'civic' || k === 'church')) {
      const [cx, cy] = centroid(ring);
      world.labels.push({ x: cx, y: cy, t: t.name, k: 'bldg', s: areaM2 > 2500 ? 1 : 0 });
    }
    // businesses tagged directly on the building shape become POIs too
    const RETAIL_AMENITY = ['restaurant', 'cafe', 'fast_food', 'pub', 'bar', 'bank', 'pharmacy',
      'ice_cream', 'theatre', 'cinema', 'dentist', 'doctors', 'veterinary', 'marketplace', 'fuel', 'library'];
    if (t.name && (t.shop || RETAIL_AMENITY.includes(t.amenity) || t.tourism === 'hotel' || t.tourism === 'guest_house' || t.craft || t.office)) {
      const [cx, cy] = centroid(ring);
      world.pois.push({ x: cx, y: cy, k: t.shop ? 'shop' : (t.amenity || t.tourism || 'shop'), n: t.name });
      bump('way-poi');
    }
    bump('building');
    continue;
  }

  if (t.highway && !SKIP_HW.has(t.highway)) {
    // pedestrian plaza areas fall through to polys below
    if (!(t.highway === 'pedestrian' && t.area === 'yes')) {
      const isRoad = t.highway in ROAD_W_M;
      const kind = PATH_KIND[t.highway];
      if (isRoad || kind) {
        for (const run of runsOf(el.geometry)) {
          const seg = { p: simplify(run) };
          if (t.bridge && t.bridge !== 'no') seg.b = 1;
          // OSM layer: which way is on top where they cross (bridge-over-bridge ramps)
          const lyr = parseInt(t.layer, 10);
          if (Number.isFinite(lyr) && lyr !== 0) seg.l = lyr;
          if (t.name) seg.n = t.name;
          if (isRoad) {
            let w = ROAD_W_M[t.highway];
            if (t.highway === 'service' && (t.service === 'driveway' || t.service === 'parking_aisle')) w = 3;
            seg.c = t.highway.replace('_link', '');
            seg.w = Math.round(w * PX_PER_M);
            world.roads.push(seg);
          } else {
            let c = kind;
            if (t.footway === 'crossing' || t.cycleway === 'crossing') c = 'crossing';
            else if ((t.surface === 'wood' || t.bridge === 'boardwalk') && (c === 'foot' || c === 'ped')) c = 'board';
            else if (t.footway === 'sidewalk' && c === 'foot') c = 'side';
            seg.c = c;
            seg.w = Math.round((c === 'ped' ? 5 : c === 'cycle' ? 3.5 : c === 'track' ? 3 : c === 'board' ? 3 : c === 'side' ? 2.2 : 2) * PX_PER_M);
            world.paths.push(seg);
          }
          bump(isRoad ? 'road' : 'path');
        }
        continue;
      }
    }
  }

  if (t.railway === 'rail') {
    for (const run of runsOf(el.geometry)) world.rails.push({ p: simplify(run) });
    bump('rail');
    continue;
  }

  if (t.power === 'line' || t.power === 'minor_line') {
    // utility lines: way vertices are the actual pole/tower positions
    for (const run of runsOf(el.geometry)) {
      world.power.push({ p: simplify(run, 2), c: t.power === 'line' ? 'line' : 'minor' });
    }
    bump('power:' + t.power);
    continue;
  }

  if ((t.aeroway === 'runway' || t.aeroway === 'taxiway') && t.abandoned !== 'yes') {
    // Plum Island Airport: real runway/taxiway centerlines with mapped widths
    for (const run of runsOf(el.geometry)) {
      const seg = { p: simplify(run), c: t.aeroway, w: Math.round((parseFloat(t.width) || (t.aeroway === 'runway' ? 18 : 6)) * PX_PER_M) };
      if (t.surface) seg.s = t.surface;
      if (t.ref) seg.n = t.ref;
      world.paths.push(seg);
    }
    bump('aeroway:' + t.aeroway);
    continue;
  }

  const pk = polyKind(t);
  if (pk) {
    // piers/breakwaters drawn as lines when open
    const g = el.geometry || [];
    const isClosed = g.length > 2 && g[0] && g[g.length - 1] && g[0].lat === g[g.length - 1].lat && g[0].lon === g[g.length - 1].lon;
    if ((pk === 'pier' || pk === 'stone') && !isClosed) {
      for (const run of runsOf(el.geometry)) {
        const seg = { p: simplify(run), c: pk === 'pier' ? 'pierline' : 'stoneline', w: Math.round((pk === 'pier' ? 3 : 4) * PX_PER_M) };
        if (t.mooring && t.mooring !== 'no') seg.m = 1; // boats tie up along this dock
        world.paths.push(seg);
      }
      bump('pier-line');
      continue;
    }
    const ring = asRing(el.geometry);
    if (!ring) continue;
    const areaM2 = Math.abs(ringArea(ring)) / (PX_PER_M * PX_PER_M);
    if (areaM2 < 12) continue;
    if (pk === 'reserve' && areaM2 > 2_000_000) { bump('reserve-skipped'); continue; } // boundary, not land cover
    const poly = { k: pk, p: ring, z: Z_ORDER[pk] ?? 1 };
    if (t.name) poly.n = t.name;
    if (pk === 'pitch') {
      // a track ring IS the running track; its sport tag describes the field it
      // encloses (mapped separately) — "Bradley Fuller Field Track" is tagged
      // sport=american_football but named Track
      if (t.leisure === 'track' || /\btrack\b/i.test(t.name || '')) poly.s = 'athletics';
      else if (t.sport) poly.s = String(t.sport).split(';')[0].trim().toLowerCase();
    }
    if (pk === 'pier' && t.mooring && t.mooring !== 'no') poly.m = 1;
    if (pk === 'apron' && t.surface) poly.s = t.surface;
    world.polys.push(poly);
    if (t.name && ['park', 'cemetery', 'water', 'wood', 'reserve', 'plaza', 'pitch', 'playground', 'wetland', 'sand'].includes(pk) && areaM2 > 800) {
      const [cx, cy] = centroid(ring);
      world.labels.push({ x: cx, y: cy, t: t.name, k: pk === 'water' ? 'water' : 'area', s: areaM2 > 40000 ? 1 : 0 });
    }
    bump('poly:' + pk);
  }
}

// ---------- relations (multipolygons) ----------

for (const el of raw.elements) {
  if (el.type !== 'relation' || !el.tags) continue;
  const t = el.tags;
  const pk = t.building && t.building !== 'no' ? '_building' : polyKind(t);
  if (!pk) continue;
  const outers = [], inners = [];
  for (const m of el.members || []) {
    if (m.type !== 'way' || !m.geometry) continue;
    const target = m.role === 'inner' ? inners : outers;
    for (const run of runsOf(m.geometry)) target.push(run);
  }
  // Relations are fetched with full (unclipped) geometry, so member endpoints
  // match exactly — a small tolerance assembles rings correctly.
  const { rings: outerRings } = stitchChains(outers, { joinTol: 60 });
  const { rings: innerRings } = stitchChains(inners, { forceClose: false, joinTol: 60 });
  for (const ring of outerRings) {
    const r = simplify(ring);
    const areaM2 = Math.abs(ringArea(r)) / (PX_PER_M * PX_PER_M);
    if (areaM2 < 12) continue;
    if (pk === '_building') {
      const k = buildingKind(t);
      const b = { p: r, k, lv: Math.min(6, parseFloat(t['building:levels']) || 2) };
      if (t.name) b.n = t.name;
      world.buildings.push(b);
      bump('building-rel');
    } else {
      // attach holes that fall inside this ring
      const holes = innerRings.filter((h) => pointInRing(h[0], h[1], r)).map((h) => simplify(h));
      const poly = { k: pk, p: r, z: Z_ORDER[pk] ?? 1 };
      if (holes.length) poly.h = holes;
      if (t.name) poly.n = t.name;
      if (pk === 'pitch') {
        if (t.leisure === 'track' || /\btrack\b/i.test(t.name || '')) poly.s = 'athletics';
        else if (t.sport) poly.s = String(t.sport).split(';')[0].trim().toLowerCase();
      }
      world.polys.push(poly);
      bump('rel:' + pk);
      if (t.name && areaM2 > 5000) {
        const [cx, cy] = centroid(r);
        world.labels.push({ x: cx, y: cy, t: t.name, k: pk === 'water' ? 'water' : 'area', s: 1 });
      }
    }
  }
}

// ---------- ocean from coastline ----------

const [WPX_W, WPX_N] = px(BBOX.n, BBOX.w);
const [WPX_E, WPX_S] = px(BBOX.s, BBOX.e);
const corners = {
  nw: [WPX_W, WPX_N], ne: [WPX_E, WPX_N], se: [WPX_E, WPX_S], sw: [WPX_W, WPX_S]
};
const LAND_REFS = [px(42.81135, -70.86976), px(42.81523, -70.81894), px(42.79616, -70.84156)]; // Market Sq, lighthouse, airport

function edgeOf(x, y) {
  const dW = Math.abs(x - WPX_W), dE = Math.abs(x - WPX_E), dN = Math.abs(y - WPX_N), dS = Math.abs(y - WPX_S);
  const m = Math.min(dW, dE, dN, dS);
  return m === dE ? 'e' : m === dN ? 'n' : m === dS ? 's' : 'w';
}

// walk the bbox perimeter from edge A to edge B in a given rotation, collecting corners
function perimeter(fromX, fromY, toX, toY, cw) {
  const orderCW = ['n', 'e', 's', 'w'];
  const cornerCW = { n: corners.ne, e: corners.se, s: corners.sw, w: corners.nw }; // corner at end of edge going CW
  const cornerCCW = { n: corners.nw, w: corners.sw, s: corners.se, e: corners.ne };
  let edge = edgeOf(fromX, fromY);
  const target = edgeOf(toX, toY);
  const pts = [];
  let guard = 8;
  while (guard-- > 0) {
    if (edge === target) break;
    if (cw) { pts.push(cornerCW[edge]); edge = orderCW[(orderCW.indexOf(edge) + 1) % 4]; }
    else { pts.push(cornerCCW[edge]); edge = orderCW[(orderCW.indexOf(edge) + 3) % 4]; }
  }
  return pts;
}

{
  // Coastline ways weave in/out of the bbox east edge, so clipping fragments them.
  // This coast progresses monotonically south -> north (island shore, river mouth,
  // Salisbury shore), so order fragments by latitude instead of nearest-endpoint
  // stitching. Straight bridges between fragments land in open ocean — invisible.
  const islandRings = [];
  const openRuns = [];
  for (const run of coastChains) {
    const dx = run[0] - run[run.length - 2], dy = run[1] - run[run.length - 1];
    if (run.length >= 8 && dx * dx + dy * dy < 40 * 40) islandRings.push(run);
    else openRuns.push(run);
  }

  for (const ring of islandRings) {
    const areaM2 = Math.abs(ringArea(ring)) / (PX_PER_M * PX_PER_M);
    if (areaM2 >= 300) {
      world.polys.push({ k: 'island', p: simplify(ring), z: 8 });
      bump('island');
    }
  }

  // normalize each run to start at its southern end (px y grows southward)
  const dirRuns = openRuns.map((r) => {
    if (r[1] < r[r.length - 1]) {
      const rev = [];
      for (let i = r.length - 2; i >= 0; i -= 2) rev.push(r[i], r[i + 1]);
      return rev;
    }
    return r.slice();
  });
  dirRuns.sort((a, b) => b[1] - a[1]); // southernmost start first
  const chain = dirRuns.flat();

  let oceanOK = false;
  if (chain.length >= 8) {
    const sx = chain[0], sy = chain[1], ex = chain[chain.length - 2], ey = chain[chain.length - 1];
    for (const cw of [true, false]) {
      const closure = perimeter(ex, ey, sx, sy, cw).flat();
      const ring = chain.concat(closure);
      const bad = LAND_REFS.some(([lx, ly]) => pointInRing(lx, ly, ring));
      const areaM2 = Math.abs(ringArea(ring)) / (PX_PER_M * PX_PER_M);
      if (!bad && areaM2 > 100_000) {
        world.polys.push({ k: 'ocean', p: ring, z: 7 });
        console.log(`ocean: ${(areaM2 / 1e6).toFixed(2)} km² (closure ${cw ? 'cw' : 'ccw'})`);
        oceanOK = true;
        break;
      }
    }
  }
  if (!oceanOK) console.warn('WARNING: ocean polygon could not be built');
  stats['ocean-built'] = oceanOK ? 1 : 0;
  stats['coast-islands'] = islandRings.length;
}

// ---------- real surveyed trees ----------

for (const el of raw.elements) {
  if (el.type === 'node' && el.tags && el.tags.natural === 'tree') {
    const [x, y] = px(el.lat, el.lon);
    world.trees.push({ x, y });
  }
}

// ---------- POI nodes ----------

for (const el of raw.elements) {
  if (el.type !== 'node' || !el.tags) continue;
  const t = el.tags;
  if (t.aeroway === 'windsock') {
    // real windsock positions at the airfield — rendered in 3D
    const [x, y] = px(el.lat, el.lon);
    world.pois.push({ x, y, k: 'windsock', n: '' });
    bump('windsock');
    continue;
  }
  if (!t.name) continue;
  const k = t.historic ? 'historic' : t.tourism ? t.tourism : t.amenity ? t.amenity : t.shop ? 'shop' : t.leisure ? t.leisure : t.man_made === 'lighthouse' ? 'lighthouse' : null;
  if (!k) continue;
  const [x, y] = px(el.lat, el.lon);
  world.pois.push({ x, y, k, n: t.name });
}

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
  ['tannery', 'The Tannery', 'Marketplace in the old mill', 42.8095, -70.8635, 70],
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
for (const [id, name, sub, lat, lon, rM] of LM) {
  const [x, y] = px(lat, lon);
  world.landmarks.push({ id, name, sub, x, y, r: Math.round(rM * PX_PER_M) });
}

// ---------- storefront corridors ----------
// OSM's retail zones miss the State Street spine itself; the commercial stretch
// (Market Square up to High Street) is documented in docs/research. Buildings
// fronting the corridor get storefront ground floors.
{
  const Y_LIMIT = (42.81135 - 42.8078) * M_PER_DEG_LAT * PX_PER_M; // High St crossing
  const corridors = world.roads.filter((r) => r.n === 'State Street');
  const distSq = (x, y, pts) => {
    let best = Infinity;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x0 = pts[i], y0 = pts[i + 1], x1 = pts[i + 2], y1 = pts[i + 3];
      const dx = x1 - x0, dy = y1 - y0;
      const l2 = dx * dx + dy * dy;
      let t = l2 ? ((x - x0) * dx + (y - y0) * dy) / l2 : 0;
      t = Math.max(0, Math.min(1, t));
      best = Math.min(best, (x - (x0 + t * dx)) ** 2 + (y - (y0 + t * dy)) ** 2);
    }
    return best;
  };
  let added = 0;
  for (const b of world.buildings) {
    if (b.sf || !['house', 'commercial', 'civic'].includes(b.k)) continue;
    const [, cy] = centroid(b.p);
    if (cy < -300 || cy > Y_LIMIT) continue;
    // facade test: any footprint vertex close to the street centerline
    let fronts = false;
    for (const r of corridors) {
      for (let i = 0; i < b.p.length && !fronts; i += 2) {
        if (distSq(b.p[i], b.p[i + 1], r.p) < 95 * 95) fronts = true;
      }
      if (fronts) break;
    }
    if (fronts) {
      b.sf = 1;
      added++;
    }
  }
  stats['corridor-storefronts'] = added;
}

// ---------- every mapped address (assessor-imported addr tags) ----------
// powers the in-game address bar AND the curated-business placement below
const addrMap = new Map();
{
  for (const el of raw.elements) {
    if (!el.tags || !el.tags['addr:housenumber'] || !el.tags['addr:street']) continue;
    let cx, cy;
    if (el.type === 'way') {
      const g = (el.geometry || []).filter(Boolean);
      if (g.length < 3) continue;
      let lat = 0, lon = 0;
      for (const p of g) { lat += p.lat; lon += p.lon; }
      [cx, cy] = px(lat / g.length, lon / g.length);
    } else if (el.type === 'node') {
      [cx, cy] = px(el.lat, el.lon);
    } else continue;
    for (const num of String(el.tags['addr:housenumber']).split(';')) {
      addrMap.set(num.trim() + '|' + el.tags['addr:street'], [cx, cy]);
    }
  }
  const byStreet = new Map();
  for (const [k2, v2] of addrMap) {
    const [num, street] = k2.split('|');
    if (!byStreet.has(street)) byStreet.set(street, []);
    byStreet.get(street).push([num, Math.round(v2[0]), Math.round(v2[1])]);
  }
  for (const [s, a] of [...byStreet.entries()].sort((x, y) => x[0].localeCompare(y[0]))) {
    a.sort((x, y) => (parseInt(x[0], 10) || 0) - (parseInt(y[0], 10) || 0));
    world.addrs.push({ s, a });
  }
  stats['addresses'] = addrMap.size;
}

// ---------- beloved local businesses, placed by their real street addresses ----------
// (from docs/research/modern-newburyport.md; buildings carry assessor-imported
// addr tags, so the match puts each name on the right roof)
{
  const CURATED = [
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
  // anchors per street for address interpolation
  const anchorsByStreet = new Map();
  for (const [k2, v2] of addrMap) {
    const [n2, s2] = k2.split('|');
    const num2 = parseInt(n2, 10);
    if (!Number.isFinite(num2)) continue;
    if (!anchorsByStreet.has(s2)) anchorsByStreet.set(s2, []);
    anchorsByStreet.get(s2).push({ num: num2, x: v2[0], y: v2[1] });
  }
  let placed = 0;
  for (const [name, num, street, kind] of CURATED) {
    let spot = addrMap.get(num + '|' + street);
    if (!spot) {
      // address interpolation between bracketing numbers, preferring same parity (street side)
      const target = parseInt(num, 10);
      const all = anchorsByStreet.get(street) || [];
      for (const pool of [all.filter((a) => a.num % 2 === target % 2), all]) {
        if (!pool.length) continue;
        const lower = pool.filter((a) => a.num <= target).sort((a, b) => b.num - a.num)[0];
        const upper = pool.filter((a) => a.num >= target).sort((a, b) => a.num - b.num)[0];
        if (lower && upper && upper.num !== lower.num) {
          const f = (target - lower.num) / (upper.num - lower.num);
          spot = [lower.x + (upper.x - lower.x) * f, lower.y + (upper.y - lower.y) * f];
        } else if (lower || upper) {
          const a = lower || upper;
          if (Math.abs(a.num - target) <= 14) spot = [a.x, a.y];
        }
        if (spot) break;
      }
    }
    if (!spot) {
      // last resort: positions interpolated offline against calibrated street
      // anchors (27.9 px per house number on State St, Screening Room @82 as anchor)
      const HAND = {
        "Fowle's": [-109, 519],
        'Anchor Stone Deck Pizza': [-275, 1262],
        'Simply Sweet': [-308, 429]
      };
      spot = HAND[name];
    }
    if (!spot) continue;
    world.pois.push({ x: Math.round(spot[0]), y: Math.round(spot[1]), k: kind, n: name });
    placed++;
  }
  stats['curated-placed'] = placed + '/' + CURATED.length;
}

// ---------- dedupe POIs (same business as node + building way) ----------

{
  const kept = [];
  for (const p of world.pois) {
    const dup = p.n && kept.find((q) => q.n.toLowerCase() === p.n.toLowerCase() && (q.x - p.x) ** 2 + (q.y - p.y) ** 2 < 200 * 200);
    if (!dup) kept.push(p);
  }
  stats['pois-deduped'] = world.pois.length - kept.length;
  world.pois = kept;
}

// ---------- manual infill: real buildings newer than the OSM snapshot ----------
// Hand-placed structures that exist on the ground but aren't yet in the OSM
// extract (data/raw/overpass.json). Footprints are in world px, street-aligned
// and curb-clearance-checked against the State St / High St geometry.
// Remove an entry once OSM picks the building up, or it'll render twice.
const MANUAL_BUILDINGS = [
  // The Residences on the Ridge — 95 High St, the SE corner of State & High. Built on
  // the long-vacant former State Street Mobil lot: a cream Second Empire (mansard-roof)
  // block + a rear carriage house. Footprints set back ~55px south off the sidewalk into
  // the lot. The look is a hand-modeled hero (HEROES['The Residences on the Ridge']).
  { p: [-1276, 3802, -1180, 3880, -1235, 3948, -1331, 3870], k: 'house', lv: 3, style: 'queen_anne', n: 'The Residences on the Ridge' },
  // the rear carriage house (the 4th home)
  { p: [-1321, 3882, -1265, 3928, -1300, 3971, -1356, 3926], k: 'house', lv: 1.5 },
];
for (const b of MANUAL_BUILDINGS) world.buildings.push(b);

// ---------- sort, QA, write ----------

world.polys.sort((a, b) => (a.z - b.z) || (Math.abs(ringArea(b.p)) - Math.abs(ringArea(a.p))));

const allPts = [];
for (const b of world.buildings) allPts.push(b.p);
for (const r of world.roads) allPts.push(r.p);
let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
for (const pts of allPts) {
  for (let i = 0; i < pts.length; i += 2) {
    if (pts[i] < minX) minX = pts[i];
    if (pts[i] > maxX) maxX = pts[i];
    if (pts[i + 1] < minY) minY = pts[i + 1];
    if (pts[i + 1] > maxY) maxY = pts[i + 1];
  }
}
world.meta.bounds = { minX, minY, maxX, maxY };

// QA: known distances
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) / PX_PER_M;
const mkt = px(42.81135, -70.86976), sta = px(42.79815, -70.87815), light = px(42.81523, -70.81894);
console.log('=== QA ===');
console.log(`Market Sq -> MBTA station: ${(dist(mkt, sta) / 1000).toFixed(2)} km (expect ~1.62)`);
console.log(`Market Sq -> Plum Island Light: ${(dist(mkt, light) / 1000).toFixed(2)} km (expect ~4.2)`);
console.log('Bounds px:', world.meta.bounds, `(~${((maxX - minX) / PX_PER_M / 1000).toFixed(1)} x ${((maxY - minY) / PX_PER_M / 1000).toFixed(1)} km)`);
console.log('Stats:', stats);
console.log(`polys=${world.polys.length} buildings=${world.buildings.length} roads=${world.roads.length} paths=${world.paths.length} rails=${world.rails.length} labels=${world.labels.length} pois=${world.pois.length}`);

await mkdir(new URL('../public/', import.meta.url), { recursive: true });
const json = JSON.stringify(world);
await writeFile(new URL('../public/world.json', import.meta.url), json);
console.log(`Wrote public/world.json — ${(json.length / 1e6).toFixed(1)} MB`);
