// World builder — converts data/<town>/raw/overpass.json (raw OSM) into
// towns/<town>/public/world.json (game world). Town-agnostic: all curation
// (landmarks, spot fixes, hand-added features, QA) comes from the per-town
// config — towns/<town>/{town.json,map.mjs} via tools/lib/town.mjs.
// Run: npm run build-world  (or TOWN=salem npm run build-world)
//
// Coordinate system: local equirectangular centered on the town's origin,
// y grows south (screen space), units = world pixels at PX_PER_M px per meter.
// Map data © OpenStreetMap contributors (ODbL).

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadTown } from './lib/town.mjs';
import { bakeBorders } from './lib/borders.mjs';

const T = await loadTown();
const { PX_PER_M, ORIGIN, M_PER_DEG_LAT, BBOX, px } = T;

// Stale OSM features that no longer exist on the ground — dropped so the map
// matches today (per-town; see towns/<id>/map.mjs for the why of each id).
const DROP_OSM = new Set(T.map.dropOsm ?? []);

// Buildings whose lv came from an explicit OSM building:levels tag — the height
// overlay (Overture) must not override mapped truth.
const LV_EXPLICIT = new Set();

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

const raw = JSON.parse(await readFile(new URL('overpass.json', T.rawDir), 'utf8'));

const world = {
  meta: {
    name: T.cfg.worldName,
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
  // tanks aren't houses: a 20 m water tower was rendering as a 6-storey clapboard home
  if (t.man_made === 'water_tower' || b === 'water_tower') return 'wtower';
  if (t.man_made === 'storage_tank' || t.man_made === 'silo' || b === 'storage_tank' || b === 'silo') return 'tank';
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

// Data-driven downtown/commercial core (replaces the old hand-drawn box): a building
// reads as masonry/brick if it sits in a retail/commercial landuse zone, or is ringed
// by a dense cluster of shop/amenity POIs (the commercial district). 99% of footprints
// are untagged `building=yes`, so material has to come from spatial context, not tags.
const NEAR_R2 = (62 * PX_PER_M) ** 2;   // count retail POIs within ~62 m of the centroid
function commercialDowntown(ring) {
  const [cx, cy] = centroid(ring);
  for (const z of retailZones) if (pointInRing(cx, cy, z)) return true;
  let near = 0;
  for (const [px2, py2] of retailPts) {
    const dx = px2 - cx, dy = py2 - cy;
    if (dx * dx + dy * dy <= NEAR_R2 && ++near >= 5) return true;
  }
  return false;
}

// Curated historic-core fallback (per-town, optional): a hand-drawn box OR'd with
// commercialDowntown above, for downtowns whose mapped shop POIs are too sparse to
// carry the brick core on data alone (Newburyport's 1811 core). Towns with denser
// POI coverage set downtownCore = null and rely on the data-driven test.
const CORE = T.map.downtownCore
  ? { nw: px(...T.map.downtownCore.nw), se: px(...T.map.downtownCore.se), minAreaM2: T.map.downtownCore.minAreaM2 ?? 150 }
  : null;
function inDowntownCore(ring) {
  if (!CORE) return false;
  const [cx, cy] = centroid(ring);
  return cx >= CORE.nw[0] && cx <= CORE.se[0] && cy >= CORE.nw[1] && cy <= CORE.se[1];
}

// ---------- ways ----------

for (const el of raw.elements) {
  if (el.type !== 'way' || !el.tags) continue;
  if (DROP_OSM.has(el.id)) continue;   // stale, gone on the ground (see DROP_OSM)
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
    // Untagged 'building=yes' blocks in a commercial district render as brick commercial
    // (downtown is almost all brick) unless they're something more specific. Data-driven
    // (retail landuse zone / dense shop-POI cluster) OR the town's curated historic-core
    // box: a downtown with sparser mapped shop POIs than the box covers gets the box as
    // a backstop while the data method adds districts the box misses.
    if (k === 'house' && ((areaM2 >= 90 && commercialDowntown(ring)) || (CORE && areaM2 >= CORE.minAreaM2 && inDowntownCore(ring)))) k = 'commercial';
    // real storefront evidence (retail land-use zone or in-building shop POI):
    // ground floor becomes a storefront, wall material stays whatever it is
    let sf = 0;
    if ((k === 'house' || k === 'commercial' || k === 'civic') && areaM2 >= 60 && hasStorefrontEvidence(ring)) sf = 1;
    const lvTag = parseFloat(t['building:levels']);
    const lv = Math.min(6, lvTag || (k === 'house' ? 1.5 : k === 'shed' ? 1 : 2));
    const b = { p: ring, k, lv };
    if (lvTag) LV_EXPLICIT.add(b);
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
  if (DROP_OSM.has(el.id)) continue;   // stale, gone on the ground (see DROP_OSM)
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
      const lvTag = parseFloat(t['building:levels']);
      const b = { p: r, k, lv: Math.min(6, lvTag || 2) };
      if (lvTag) LV_EXPLICIT.add(b);
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

// ---------- ocean from coastline (general boundary sweep — works for any town) ----------
// OSM convention: every `natural=coastline` way is directed with LAND on its LEFT (water
// on the right). We rebuild the sea as polygons by stitching coastline into chains, then
// tracing closed water loops: follow each coast chain, and where it meets the map edge run
// along the bbox perimeter to the next chain's start. Closed coast loops are islands, punched
// out as holes. This handles a simple monotonic coast (Newburyport: Plum Island barrier +
// Merrimack mouth) and harbors / multiple landmasses (a peninsula town like Salem) alike — no
// hardcoded land references, no latitude-sort assumption. Orientation is chosen so downtown
// (ORIGIN, px 0,0) stays on land, so it self-corrects for whatever coastline winding a town uses.
{
  const [BW, BN] = px(BBOX.n, BBOX.w);   // bbox px corners: west/north = (minX, minY)
  const [BE, BS] = px(BBOX.s, BBOX.e);   //                  east/south = (maxX, maxY); y grows south
  const PCORN = [[BW, BN], [BE, BN], [BE, BS], [BW, BS]]; // perimeter corners at param t = 0,1,2,3

  // stitch coast ways into maximal chains: repeatedly merge any two whose endpoints touch
  // (either end, either direction) until none remain. Order-independent (unlike a greedy
  // one-end stitch), so a coastline split mid-map by runsOf — e.g. the Merrimack's tidal
  // reach, where natural=coastline ends upriver — rejoins into one edge-to-edge chain
  // instead of leaving a dangling mid-map endpoint that snaps to a bbox edge and floods.
  const stitchCoast = (segs, joinTol = 120) => {
    const chains = segs.map((c) => c.slice());
    const near = (a, b) => { const dx = a[0] - b[0], dy = a[1] - b[1]; return dx * dx + dy * dy <= joinTol * joinTol; };
    const ends = (c) => [[c[0], c[1]], [c[c.length - 2], c[c.length - 1]]];
    const rev = (c) => { const r = []; for (let k = c.length - 2; k >= 0; k -= 2) r.push(c[k], c[k + 1]); return r; };
    let merged = true;
    while (merged) {
      merged = false;
      outer:
      for (let i = 0; i < chains.length; i++) {
        for (let j = i + 1; j < chains.length; j++) {
          const a = chains[i], b = chains[j], [as, ae] = ends(a), [bs, be] = ends(b);
          let nc = null;
          if (near(ae, bs)) nc = a.concat(b.slice(2));
          else if (near(ae, be)) nc = a.concat(rev(b).slice(2));
          else if (near(as, bs)) nc = rev(a).concat(b.slice(2));
          else if (near(as, be)) nc = b.concat(a.slice(2));
          if (nc) { chains.splice(j, 1); chains.splice(i, 1, nc); merged = true; break outer; }
        }
      }
    }
    const islands = [], opens = [];
    for (const c of chains) {
      const dx = c[0] - c[c.length - 2], dy = c[1] - c[c.length - 1];
      const gap2 = dx * dx + dy * dy;
      if (c.length >= 8 && gap2 <= joinTol * joinTol) { islands.push(c); continue; }
      // near-loop rescue: a long chain that ALMOST closes is a ring with a small
      // survey gap, not an open coast — close it. (Gloucester: Norman's Woe's ring
      // misses itself by 127px, 7px over joinTol; left open, its mid-map endpoints
      // snap to the bbox edge and the sweep drowns Magnolia.)
      if (c.length >= 8 && gap2 <= (3 * joinTol) * (3 * joinTol)) { islands.push(c); console.warn(`coast: closing near-loop (${c.length / 2} pts, ${Math.round(Math.sqrt(gap2))}px gap)`); continue; }
      // degenerate stubs can never close and would snap mid-map endpoints onto the
      // bbox edge, spawning a phantom full-frame sea ring (Gloucester: a 2-pt
      // fragment in Ipswich Bay flooded everything that isn't a closed island).
      if (c.length < 6) { console.warn(`coast: dropping degenerate ${c.length / 2}-pt open fragment at (${Math.round(c[0])},${Math.round(c[1])})`); continue; }
      opens.push(c);
    }
    return { islands, opens };
  };

  // snap a near-edge point onto the bbox boundary; perimeter param t in [0,4):
  // top NW→NE [0,1), right NE→SE [1,2), bottom SE→SW [2,3), left SW→NW [3,4)
  const snapEdge = ([x, y]) => {
    const dW = Math.abs(x - BW), dE = Math.abs(x - BE), dN = Math.abs(y - BN), dS = Math.abs(y - BS), m = Math.min(dW, dE, dN, dS);
    return m === dW ? [BW, y] : m === dE ? [BE, y] : m === dN ? [x, BN] : [x, BS];
  };
  const perimT = ([x, y]) => {
    const dW = Math.abs(x - BW), dE = Math.abs(x - BE), dN = Math.abs(y - BN), dS = Math.abs(y - BS), m = Math.min(dW, dE, dN, dS);
    if (m === dN) return (x - BW) / (BE - BW);
    if (m === dE) return 1 + (y - BN) / (BS - BN);
    if (m === dS) return 2 + (BE - x) / (BE - BW);
    return 3 + (BS - y) / (BS - BN);
  };
  const fwdT = (from, to, dir) => { const d = dir > 0 ? to - from : from - to; return ((d % 4) + 4) % 4; };
  const cornersBetween = (t0, t1, dir) => {
    const out = []; let t = t0;
    for (let g = 0; g < 8; g++) {
      let nc = dir > 0 ? Math.floor(t + 1e-9) + 1 : Math.ceil(t - 1e-9) - 1; nc = ((nc % 4) + 4) % 4;
      if (fwdT(t, t1, dir) <= fwdT(t, nc, dir) + 1e-9) break;
      out.push(PCORN[nc]); t = nc;
    }
    return out;
  };
  // trace closed water rings: chain → perimeter arc → next chain → … (dir picks the rotation)
  const assembleWater = (opensIn, dir) => {
    const segs = opensIn.map((c) => {
      const cc = c.slice(), s = snapEdge([cc[0], cc[1]]), e = snapEdge([cc[cc.length - 2], cc[cc.length - 1]]);
      cc[0] = s[0]; cc[1] = s[1]; cc[cc.length - 2] = e[0]; cc[cc.length - 1] = e[1];
      return cc;
    });
    const used = new Array(segs.length).fill(false), rings = [];
    for (let st = 0; st < segs.length; st++) {
      if (used[st]) continue;
      const ring = []; let ci = st, ok = false, g = 0;
      while (g++ < segs.length + 3) {
        used[ci] = true;
        const c = segs[ci];
        for (let i = 0; i < c.length; i += 2) ring.push(c[i], c[i + 1]);
        const tEnd = perimT([c[c.length - 2], c[c.length - 1]]);
        let best = -1, bd = Infinity;
        for (let j = 0; j < segs.length; j++) {
          if (used[j] && j !== st) continue;
          let d = fwdT(tEnd, perimT([segs[j][0], segs[j][1]]), dir); if (d < 1e-9) d += 4;
          if (d < bd) { bd = d; best = j; }
        }
        if (best < 0) break;
        for (const cr of cornersBetween(tEnd, perimT([segs[best][0], segs[best][1]]), dir)) ring.push(cr[0], cr[1]);
        if (best === st) { ok = true; break; }
        ci = best;
      }
      if (ok && ring.length >= 8) rings.push(ring);
    }
    return rings;
  };

  const { islands: coastIslands, opens: coastOpens } = stitchCoast(coastChains);

  // closed coast loops render as land discs (as before) — and become holes in the sea below
  for (const ring of coastIslands) {
    const areaM2 = Math.abs(ringArea(ring)) / (PX_PER_M * PX_PER_M);
    if (areaM2 >= 300) { world.polys.push({ k: 'island', p: simplify(ring), z: 8 }); bump('island'); }
  }

  // assemble sea polygons. Rotation is disambiguated with OSM's own invariant —
  // coastline ways run with land on the LEFT, water on the RIGHT — by probing just
  // right-of-travel at three points along the longest open chain: those probes must
  // land inside the sea. (The old check — "downtown must stay outside the ring" —
  // breaks when downtown itself sits on a closed coast loop: Gloucester's Cape Ann
  // is an island, so the origin is inside the true sea ring's OUTER boundary and
  // only the island hole keeps it dry; the check then flips to the wrong rotation.)
  const waterRightProbes = (chain, dist = 60) => {
    const out = [];
    for (const f of [0.25, 0.5, 0.75]) {
      const i = Math.min(chain.length - 4, Math.max(0, 2 * Math.floor((chain.length / 2) * f)));
      const x0 = chain[i], y0 = chain[i + 1], x1 = chain[i + 2], y1 = chain[i + 3];
      const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
      // px y grows SOUTH, so right-of-travel (geographic) = (-dy, dx)/L
      out.push([(x0 + x1) / 2 - (dy / L) * dist, (y0 + y1) / 2 + (dx / L) * dist]);
    }
    return out;
  };
  const seaScore = (rings, probes) => probes.filter((p) => rings.some((r) => pointInRing(p[0], p[1], r))).length;
  let seaRings = assembleWater(coastOpens, 1);
  if (coastOpens.length) {
    const probes = waterRightProbes(coastOpens.reduce((a, b) => (a.length >= b.length ? a : b)));
    const alt = assembleWater(coastOpens, -1);
    if (seaScore(alt, probes) > seaScore(seaRings, probes)) seaRings = alt;
  } else if (seaRings.some((r) => pointInRing(0, 0, r))) seaRings = assembleWater(coastOpens, -1);

  let oceanOK = false;
  for (const ring of seaRings) {
    const areaM2 = Math.abs(ringArea(ring)) / (PX_PER_M * PX_PER_M);
    if (areaM2 < 5000) continue; // drop slivers
    const poly = { k: 'ocean', p: simplify(ring), z: 7 };
    const holes = coastIslands.filter((h) => { const [hx, hy] = centroid(h); return pointInRing(hx, hy, ring); }).map((h) => simplify(h));
    if (holes.length) poly.h = holes;
    world.polys.push(poly);
    console.log(`ocean: ${(areaM2 / 1e6).toFixed(2)} km²${holes.length ? ` (${holes.length} island hole${holes.length > 1 ? 's' : ''})` : ''}`);
    oceanOK = true;
  }
  if (!oceanOK) console.warn('WARNING: ocean polygon could not be built');
  stats['ocean-built'] = seaRings.length;
  stats['coast-islands'] = coastIslands.length;
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

// ---------- curated landmarks (per-town: towns/<id>/map.mjs) ----------
// They power the 🗺 Fast-Travel grid, address-bar name search, and the ambient
// "you've reached X" proximity banners — all data-driven, no engine changes.

for (const lm of T.map.landmarks?.({ px, PX_PER_M }) ?? []) world.landmarks.push(lm);

// ---------- storefront corridors (per-town) ----------
// Commercial spines OSM's retail zones miss (documented in docs/research):
// buildings fronting a configured corridor get storefront ground floors.
for (const cor of T.map.storefrontCorridors ?? []) {
  const Y_MIN = cor.yMinPx;
  const Y_LIMIT = (ORIGIN.lat - cor.southLat) * M_PER_DEG_LAT * PX_PER_M;
  const corridors = world.roads.filter((r) => r.n === cor.street);
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
    if (cy < Y_MIN || cy > Y_LIMIT) continue;
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
  stats['corridor-storefronts'] = (stats['corridor-storefronts'] || 0) + added;
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
// (per-town, from docs/research; buildings carry assessor-imported addr tags,
// so the match puts each name on the right roof)
{
  const CURATED = T.map.curatedPois ?? [];
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
      // last resort: per-town hand-calibrated positions (towns/<id>/map.mjs)
      spot = (T.map.curatedPoisHand ?? {})[name];
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

// ---------- height overlay: real building heights (Overture Maps) ----------
// OSM building:levels coverage is thin (a few hundred tags per town), so untagged
// buildings default to guesses (house 1.5 / other 2). tools/fetch_heights.mjs saves
// the Overture buildings theme for the bbox — ML-measured height (m, to the ROOF
// TOP: a pitched house carries ~2.5-3 m of roof in the number) + sparse num_floors —
// to data/raw/heights.json. Each untagged building takes the feature whose centroid
// falls inside its footprint (nearest to the building centroid when several do):
// num_floors verbatim when present, else height through New England-stock ridge
// thresholds (ranch ~4.5, cape ~6, colonial ~9, three-decker ~12, then ~3.1 m/storey
// + parapet for flat downtown blocks). Guards, calibrated on knowns (Market Basket,
// Graf Rink, Witch City Mall, State St blocks — see the 7/2 session):
//   • big single-volume boxes (area>2000 m², h<11 m): supermarkets/rinks/warehouses
//     have tall ceilings, not floors → lv 1 (1.5 under 4000 m²)
//   • area>5000 m² caps at 2 — no accidental mega-towers on mall-scale footprints
//   • church caps 2.5 (a tall nave is one volume; steeples render separately),
//     shed caps 1.5; only ordinary kinds — specials (light, tower…) keep their lv
// Explicit OSM levels (LV_EXPLICIT), MANUAL_BUILDINGS and LEVEL_FIXES all beat the
// overlay. Missing heights.json = warn and keep the guesses (build still works).
const HEIGHT_KINDS = new Set(['house', 'commercial', 'civic', 'industrial', 'church', 'shed']);
try {
  const hj = JSON.parse(await readFile(new URL('heights.json', T.rawDir), 'utf8'));
  const CELL = 512; // px grid over the height points; building bboxes stay well under a few cells
  const hgrid = new Map();
  for (const [lon, lat, h, nf] of hj.features) {
    const [x, y] = px(lat, lon);
    const key = `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
    let cell = hgrid.get(key);
    if (!cell) hgrid.set(key, (cell = []));
    cell.push([x, y, h, nf]);
  }
  let raised = 0, lowered = 0;
  for (const b of world.buildings) {
    if (LV_EXPLICIT.has(b) || !HEIGHT_KINDS.has(b.k)) continue;
    const p = b.p;
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (let i = 0; i < p.length; i += 2) {
      if (p[i] < minX) minX = p[i];
      if (p[i] > maxX) maxX = p[i];
      if (p[i + 1] < minY) minY = p[i + 1];
      if (p[i + 1] > maxY) maxY = p[i + 1];
    }
    const [bx, by] = centroid(p);
    let best = null, bestD = Infinity;
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++) {
      for (let cy = Math.floor(minY / CELL); cy <= Math.floor(maxY / CELL); cy++) {
        for (const f of hgrid.get(`${cx},${cy}`) || []) {
          if (f[0] < minX || f[0] > maxX || f[1] < minY || f[1] > maxY) continue;
          const d = (f[0] - bx) ** 2 + (f[1] - by) ** 2;
          if (d < bestD && pointInRing(f[0], f[1], p)) { best = f; bestD = d; }
        }
      }
    }
    const areaM2 = Math.abs(ringArea(p)) / (PX_PER_M * PX_PER_M);
    if (!best || (best[2] == null && !best[3])) {
      // Overture gap: apply the size-based inference the renderer used to do at
      // render time (buildingDims trusts lv verbatim now), so unmatched
      // buildings keep their old look. Houses at the untagged 1.5 default lift
      // by footprint; big untagged commercial/civic blocks stay 3-storey.
      if (b.k === 'house' && b.lv === 1.5) b.lv = areaM2 < 55 ? 1.8 : areaM2 < 100 ? 2.3 : areaM2 < 175 ? 2.7 : 3;
      else if ((b.k === 'commercial' || b.k === 'civic') && areaM2 > 140 && b.lv < 3) b.lv = 3;
      continue;
    }
    const [, , h, nf] = best;
    let lv;
    if (nf) lv = nf;
    else if (areaM2 > 2000 && h < 11) lv = areaM2 > 4000 ? 1 : 1.5;
    else if (h < 9.8) lv = h < 5.2 ? 1 : h < 7.2 ? 1.5 : 2; // pitched-home regime: ridge thresholds
    else lv = (h - 1) / 3.2; // taller stock: ~3.2 m/storey + parapet, half-floor rounded below
    if (areaM2 > 5000) lv = Math.min(lv, 2);
    if (b.k === 'church') lv = Math.min(lv, 2.5);
    if (b.k === 'shed') lv = Math.min(lv, 1.5);
    lv = Math.min(6, Math.max(1, Math.round(lv * 2) / 2));
    if (lv > b.lv) raised++;
    else if (lv < b.lv) lowered++;
    b.lv = lv;
  }
  stats['height-overlay'] = raised + lowered;
  console.log(`Height overlay (Overture ${hj.release}): ${raised} raised, ${lowered} lowered of ${world.buildings.length} buildings`);
} catch (e) {
  console.warn('Height overlay SKIPPED (run `node tools/fetch_heights.mjs` first):', e.message);
}

// ---------- manual infill: real buildings newer than the OSM snapshot ----------
// Hand-placed structures that exist on the ground but aren't yet in the OSM
// extract (per-town, towns/<id>/map.mjs). Footprints are in world px,
// street-aligned and curb-clearance-checked against the real street geometry.
// Remove an entry once OSM picks the building up, or it'll render twice.
for (const b of T.map.manualBuildings ?? []) world.buildings.push(b);

// ---------- manual level fixes: real heights the data doesn't carry ----------
// Spot overrides on top of the Overture height overlay above: each entry sets the
// building CONTAINING the point. Use for buildings NEWER than Overture's ML imagery
// (which reads the old ground) or where the ML height is just wrong. Runs after the
// overlay and manualBuildings, so a fix always wins. Anchor to verified geometry,
// never a street-name lookup (addrs merge same-named streets across towns).
for (const f of T.map.levelFixes ?? []) {
  const hit = world.buildings.find((b) => pointInRing(f.x, f.y, b.p));
  if (hit) hit.lv = f.lv;
  else console.warn('LEVEL_FIX missed:', f);
}

// ---------- manual name fixes: names OSM puts on nodes, not footprints ----------
// HEROES and search bind to the BUILDING's name; when OSM names only a POI node
// (Beverly City Hall, Hale Farm), stamp the name onto the containing footprint.
// Same anchoring rule as levelFixes: a point inside the building, never a
// street-name lookup.
for (const f of T.map.nameFixes ?? []) {
  const hit = world.buildings.find((b) => pointInRing(f.x, f.y, b.p));
  if (hit) hit.n = f.n;
  else console.warn('NAME_FIX missed:', f);
}

// ---------- manual features: real details OSM doesn't carry ----------
// A free-form per-town hook (backyard pools, hand-mapped picket fences, …) —
// it may push onto any world collection. Survives `npm run map` re-runs by
// construction: curation lives in towns/<id>/map.mjs, not in the output.
T.map.manualFeatures?.({ world, px, PX_PER_M });

// ---------- shrink nature polygons (download size) ----------
// polys are ~54% of world.json: OSM nature rings (river/marsh/woods/parks) carry
// sub-meter vertex spacing that's invisible at game scale (the radial `simplify`
// above only drops points closer than 3 px). Douglas-Peucker at 4 px (~0.5 m)
// roughly halves them with no visible change. Buildings/roads/paths/barriers are
// untouched — their geometry is gameplay (collision, curbs) and already small.
function simplifyDP(pts, eps) {
  const n = pts.length / 2;
  if (n <= 8) return pts;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  const eps2 = eps * eps;
  while (stack.length) {
    const [a, b] = stack.pop();
    const ax = pts[a * 2], ay = pts[a * 2 + 1];
    const dx = pts[b * 2] - ax, dy = pts[b * 2 + 1] - ay;
    const len2 = dx * dx + dy * dy || 1;
    let worst = -1, worstD = eps2;
    for (let i = a + 1; i < b; i++) {
      const px = pts[i * 2] - ax, py = pts[i * 2 + 1] - ay;
      const t = Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
      const ex = px - t * dx, ey = py - t * dy;
      const d = ex * ex + ey * ey;
      if (d > worstD) { worstD = d; worst = i; }
    }
    if (worst >= 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out.length >= 6 ? out : pts;
}
{
  // tiered tolerance: the huge nature polys (the river, marshes, big woods) carry
  // most of the vertex mass and read identically at 1 m tolerance; smaller polys
  // (pools, pitches, plazas) stay at 0.5 m.
  let before = 0, after = 0;
  for (const poly of world.polys) {
    const eps = Math.abs(ringArea(poly.p)) > 2_000_000 ? 8 : 4;
    before += poly.p.length / 2;
    poly.p = simplifyDP(poly.p, eps);
    after += poly.p.length / 2;
    if (poly.h) poly.h = poly.h.map((hole) => simplifyDP(hole, eps));
  }
  stats['poly-verts'] = `${before}>${after}`;
  console.log(`Poly simplify (DP 4/8px tiered): ${before} -> ${after} vertices`);
}

// ---------- town borders: municipal boundaries + welcome-sign spots ----------
// (data/<town>/raw/boundaries.json — tools/fetch_boundaries.mjs, usually via the
// fetch-data CI workflow; patch_borders.mjs applies the same bake without a rebuild)
try {
  const bj = JSON.parse(await readFile(new URL('boundaries.json', T.rawDir), 'utf8'));
  const baked = bakeBorders(world, bj, px);
  world.towns = baked.towns;
  world.signs = baked.signs;
  stats['welcome-signs'] = baked.signs.length;
} catch (e) {
  console.warn('Town borders SKIPPED (no boundaries.json — run the fetch-data workflow):', e.message);
}

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

// QA: known real-world distances (per-town) guard the projection
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]) / PX_PER_M;
console.log('=== QA ===');
for (const q of T.map.qaDistances ?? []) {
  console.log(`${q.label}: ${(dist(px(...q.from), px(...q.to)) / 1000).toFixed(2)} km (expect ~${q.expectKm})`);
}
console.log('Bounds px:', world.meta.bounds, `(~${((maxX - minX) / PX_PER_M / 1000).toFixed(1)} x ${((maxY - minY) / PX_PER_M / 1000).toFixed(1)} km)`);
console.log('Stats:', stats);
console.log(`polys=${world.polys.length} buildings=${world.buildings.length} roads=${world.roads.length} paths=${world.paths.length} rails=${world.rails.length} labels=${world.labels.length} pois=${world.pois.length}`);

await mkdir(T.publicDir, { recursive: true });
const json = JSON.stringify(world);
await writeFile(new URL('world.json', T.publicDir), json);
console.log(`Wrote towns/${T.id}/public/world.json — ${(json.length / 1e6).toFixed(1)} MB`);
