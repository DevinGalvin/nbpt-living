// The ASSESSOR OVERLAY — what the town's own records say about each building,
// laid over the OSM footprints after Overture's ML height guess and before the
// hand fixes. Shared by tools/build_world.mjs (the bake) and
// tools/patch_parcels.mjs (in place), so the two can never disagree.
//
// Two things the parcel row settles that nothing else in the pipeline can:
//
//  • STOREYS. `STORIES` + `STYLE` from the assessor's card: "2 / Colonial",
//    "1 / Ranch", "1.75 / Cape Cod". Swansea's first bake had Overture reading
//    two-storey homes at 5 m and 54% of houses came out flat; Devin's first look
//    at the live town was "a lot are 1 story instead of 2". The largest house on
//    a residential lot gets the assessed storeys; the small outbuildings on the
//    same lot (garages, sheds) go to one.
//  • KIND. OSM in a thin-tagged town leaves the strip plaza, the cinema, the
//    police station and the Y as bare building=yes, which the build classifies
//    as 'house' — a 17,000 m² plaza was rendering as a three-storey clapboard
//    home. The DOR use code on the lot (3xx commercial, 4xx industrial, 93x–95x
//    and 97x civic, 96x church) reclassifies big untagged footprints, which is
//    what puts them in the masonry / flat-roof branches with the right storeys.
//
// Explicit OSM tags still win (build_world passes LV_EXPLICIT); the ML height
// only survives on lots the assessor has nothing for (Rhode Island, water lots).

const HOUSE_LIKE = new Set(['house', 'shed']);
const GARAGE_M2 = 80;        // a "house" footprint under this on a lot with a bigger house is the garage
const BIG_M2 = 150;          // a commercial / industrial lot's building above this is the business, not its shed
const CIVIC_M2 = 250;

// MA DOR use codes come 4-digit ("0101", "3220"), sometimes with a suffix letter
// ("332S", "960V"): the class is the three digits after any leading zero.
export function useClass(code) {
  const s = String(code || '').replace(/^0/, '');
  return Number(s.slice(0, 3)) || 0;
}

// assessed storeys → the renderer's lv scale (1 ranch · 1.5 cape · 2 colonial · 2.5 · 3)
export function storeysToLv(st, style, maxLv) {
  const sty = (style || '').toLowerCase();
  let lv;
  if (st <= 1) lv = /raised ranch|at grade|split/.test(sty) ? 1.5 : 1;   // a raised ranch shows its lower floor to the street
  else if (st < 1.5) lv = 1.5;
  else if (st < 1.75) lv = 1.5;
  else if (st < 2.25) lv = 2;
  else if (st <= 2.5) lv = 2.5;
  else lv = 3;
  return Math.min(maxLv, lv);
}

export function overlayParcels(world, parcels, px, PX_PER_M, { explicit = new Set(), maxLv = 6, ringArea, centroid, pointInRing } = {}) {
  const stats = { lots: 0, matched: 0, raised: 0, lowered: 0, garages: 0, commercial: 0, industrial: 0, civic: 0, church: 0 };
  // parcels to px rings, grid-indexed by bbox
  const CELL = 1024;
  const grid = new Map();
  const lots = [];
  for (const p of parcels) {
    const r = [];
    let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
    for (let i = 0; i < p.r.length; i += 2) {
      const [x, y] = px(p.r[i + 1], p.r[i]);
      r.push(x, y);
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    const lot = { r, st: p.st, sty: p.sty, cls: useClass(p.use), bld: [] };
    lots.push(lot);
    for (let cx = Math.floor(minX / CELL); cx <= Math.floor(maxX / CELL); cx++)
      for (let cy = Math.floor(minY / CELL); cy <= Math.floor(maxY / CELL); cy++) {
        const k = `${cx},${cy}`;
        let cell = grid.get(k);
        if (!cell) grid.set(k, (cell = []));
        cell.push(lot);
      }
  }
  stats.lots = lots.length;
  // each building to the lot its centroid is in
  for (const b of world.buildings) {
    if (!HOUSE_LIKE.has(b.k) && b.k !== 'commercial' && b.k !== 'civic' && b.k !== 'industrial' && b.k !== 'church') continue;
    const [bx, by] = centroid(b.p);
    const cell = grid.get(`${Math.floor(bx / CELL)},${Math.floor(by / CELL)}`);
    if (!cell) continue;
    for (const lot of cell) {
      if (pointInRing(bx, by, lot.r)) { lot.bld.push({ b, m2: Math.abs(ringArea(b.p)) / (PX_PER_M * PX_PER_M) }); stats.matched++; break; }
    }
  }
  const setLv = (b, lv) => {
    if (explicit.has(b)) return;
    if (lv > b.lv) stats.raised++; else if (lv < b.lv) stats.lowered++;
    b.lv = lv;
  };
  for (const lot of lots) {
    if (!lot.bld.length) continue;
    const cls = lot.cls;
    lot.bld.sort((a, c) => c.m2 - a.m2);
    const main = lot.bld[0];
    if (cls >= 101 && cls <= 129) {                     // residential: single-family through apartments
      if (lot.st > 0) {
        const houses = lot.bld.filter((x) => x.b.k === 'house');
        if (houses.length) {
          setLv(houses[0].b, storeysToLv(lot.st, lot.sty, maxLv));
          for (const x of houses.slice(1)) if (x.m2 < GARAGE_M2 && x.b.lv > 1 && !explicit.has(x.b)) { x.b.lv = 1; stats.garages++; }
        }
      }
    } else if ((cls >= 300 && cls < 500) || (cls >= 930 && cls < 1000)) {
      // 96x is "religious" on the DOR list, but the assessor's STYLE is the tell:
      // Swansea's YMCA sits on a 960 lot styled "Health Spa" — a steeple on the Y
      // would be worse than the generic box. Church only when the card says so.
      const churchy = cls >= 960 && cls < 970 && /church|chapel|relig|worship|temple|synagog|mosque/i.test(lot.sty);
      const kind = cls < 400 ? 'commercial' : cls < 500 ? 'industrial' : churchy ? 'church' : 'civic';
      const minM2 = kind === 'civic' ? CIVIC_M2 : BIG_M2;
      for (const x of lot.bld) {
        if (x.m2 < minM2) continue;
        const only = kind === 'church' ? x === main : true;   // one church per lot; the rest are the hall and the rectory
        if (only && x.b.k === 'house') { x.b.k = kind; stats[kind]++; }
        // a "Plaza w/Anchor · 1 storey" lot's every big building is one storey — the
        // cinema beside the anchor too, not just the largest footprint
        if (lot.st > 0 && (only || x === main)) setLv(x.b, kind === 'church' ? Math.min(2.5, storeysToLv(lot.st, lot.sty, maxLv)) : storeysToLv(lot.st, lot.sty, maxLv));
      }
    }
  }
  return stats;
}
