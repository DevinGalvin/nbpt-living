// Town borders — shared by build_world.mjs (full rebuilds) and
// patch_borders.mjs (in-place world.json update). From the raw OSM municipal
// boundaries (data/<town>/raw/boundaries.json) this bakes two things into the
// world:
//   world.towns — each municipality's rings, for the runtime "which town am I
//                 in" check behind the "Entering …" banner
//   world.signs — roadside "Welcome to …" sign spots: everywhere a real road
//                 crosses a town line, one sign per direction of travel, facing
//                 the arriving player — like the real signs on every town line
//
// Map data © OpenStreetMap contributors (ODbL).

// roads that get a town-line sign (no motorways — nobody bikes I-95 — no service alleys)
const SIGN_ROADS = new Set([
  'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street',
  'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'
]);
const SIGN_GAP = 500;     // px — min spacing between signs on the same town line
const MAX_SIGNS = 120;    // hard cap per world (sanity)

// ---------- small geometry helpers (px space, flat [x,y,...] rings) ----------

function pointInRing(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 2; i < pts.length; j = i, i += 2) {
    const xi = pts[i], yi = pts[i + 1], xj = pts[j], yj = pts[j + 1];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

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
      const qx = pts[i * 2] - ax, qy = pts[i * 2 + 1] - ay;
      const t = Math.max(0, Math.min(1, (qx * dx + qy * dy) / len2));
      const ex = qx - t * dx, ey = qy - t * dy;
      const d = ex * ex + ey * ey;
      if (d > worstD) { worstD = d; worst = i; }
    }
    if (worst >= 0) { keep[worst] = 1; stack.push([a, worst], [worst, b]); }
  }
  const out = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out.length >= 6 ? out : pts;
}

// stitch open way-chains into closed rings (same approach as build_world's coastline)
function stitchChains(chains, joinTol = 120) {
  const open = chains.map((c) => c.slice()).filter((c) => c.length >= 4);
  const rings = [];
  const closed = (c) => {
    const dx = c[0] - c[c.length - 2], dy = c[1] - c[c.length - 1];
    return dx * dx + dy * dy <= joinTol * joinTol;
  };
  for (let i = open.length - 1; i >= 0; i--) {
    if (closed(open[i]) && open[i].length >= 8) rings.push(open.splice(i, 1)[0]);
  }
  let guard = 2000;
  while (open.length && guard-- > 0) {
    const a = open.pop();
    if (closed(a) && a.length >= 8) { rings.push(a); continue; }
    const ax = a[a.length - 2], ay = a[a.length - 1];
    let best = -1, bestD = joinTol * joinTol, bestRev = false;
    for (let i = 0; i < open.length; i++) {
      const b = open[i];
      const d1 = (b[0] - ax) ** 2 + (b[1] - ay) ** 2;
      const d2 = (b[b.length - 2] - ax) ** 2 + (b[b.length - 1] - ay) ** 2;
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
    } else if (a.length >= 8) {
      rings.push(a); // force-close leftovers (borders clipped by data extent)
    }
  }
  return rings;
}

// segment×segment intersection; returns t along (a1→a2) or null
function segX(a1x, a1y, a2x, a2y, b1x, b1y, b2x, b2y) {
  const dax = a2x - a1x, day = a2y - a1y, dbx = b2x - b1x, dby = b2y - b1y;
  const den = dax * dby - day * dbx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((b1x - a1x) * dby - (b1y - a1y) * dbx) / den;
  const u = ((b1x - a1x) * day - (b1y - a1y) * dax) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? t : null;
}

// ---------- the bake ----------

/** boundariesJson = raw Overpass response; px = lat/lon → world-px projector */
export function bakeBorders(world, boundariesJson, px) {
  // 1. municipalities: project + stitch + simplify each relation's outer rings
  const towns = [];
  for (const rel of boundariesJson.elements || []) {
    if (rel.type !== 'relation' || !rel.tags?.name) continue;
    const chains = [];
    for (const m of rel.members || []) {
      if (m.type !== 'way' || (m.role && m.role !== 'outer') || !m.geometry) continue;
      const run = [];
      for (const g of m.geometry) {
        if (!g) continue;
        const [x, y] = px(g.lat, g.lon);
        run.push(x, y);
      }
      if (run.length >= 4) chains.push(run);
    }
    const rings = stitchChains(chains).map((r) => simplifyDP(r, 6)).filter((r) => r.length >= 8);
    if (rings.length) towns.push({ n: rel.tags.name, p: rings });
  }

  const townAt = (x, y) => {
    for (const t of towns) for (const ring of t.p) if (pointInRing(x, y, ring)) return t.n;
    return null;
  };

  // 2. sign spots: road segments crossing any town-line ring segment
  const classRank = (c) => ['trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential'].indexOf(c.replace('_link', '')) + 1 || 9;
  const raw = [];
  for (const t of towns) {
    for (const ring of t.p) {
      // ring bbox for cheap pruning
      let rx0 = Infinity, ry0 = Infinity, rx1 = -Infinity, ry1 = -Infinity;
      for (let i = 0; i < ring.length; i += 2) {
        if (ring[i] < rx0) rx0 = ring[i]; if (ring[i] > rx1) rx1 = ring[i];
        if (ring[i + 1] < ry0) ry0 = ring[i + 1]; if (ring[i + 1] > ry1) ry1 = ring[i + 1];
      }
      for (const road of world.roads) {
        if (!SIGN_ROADS.has(road.c)) continue;
        const P = road.p;
        for (let i = 0; i + 3 < P.length; i += 2) {
          const x1 = P[i], y1 = P[i + 1], x2 = P[i + 2], y2 = P[i + 3];
          if (Math.max(x1, x2) < rx0 || Math.min(x1, x2) > rx1 || Math.max(y1, y2) < ry0 || Math.min(y1, y2) > ry1) continue;
          for (let j = 0; j + 3 < ring.length + 2; j += 2) {
            const k = (j + 2) % ring.length;
            const hit = segX(x1, y1, x2, y2, ring[j], ring[j + 1], ring[k], ring[k + 1]);
            if (hit === null) continue;
            const cx = x1 + (x2 - x1) * hit, cy = y1 + (y2 - y1) * hit;
            const dl = Math.hypot(x2 - x1, y2 - y1) || 1;
            const dx = (x2 - x1) / dl, dy = (y2 - y1) / dl;
            // one sign per direction of travel, naming the town you're entering
            for (const s of [1, -1]) {
              const into = townAt(cx + dx * s * 40, cy + dy * s * 40);
              if (!into) continue;
              // right-hand side of travel, past the curb; face oncoming traffic
              const rxs = -dy * s, rys = dx * s;
              raw.push({
                x: Math.round(cx + dx * s * 26 + rxs * (road.w / 2 + 10)),
                y: Math.round(cy + dy * s * 26 + rys * (road.w / 2 + 10)),
                a: +Math.atan2(-dx * s, -dy * s).toFixed(3),
                n: into,
                rank: classRank(road.c),
                b: road.b ? 1 : 0
              });
            }
          }
        }
      }
    }
  }

  // 3. dedupe: keep the most major crossing within SIGN_GAP of each same-town sign
  raw.sort((a, b) => a.rank - b.rank);
  const signs = [];
  for (const s of raw) {
    if (signs.some((k) => k.n === s.n && (k.x - s.x) ** 2 + (k.y - s.y) ** 2 < SIGN_GAP * SIGN_GAP)) continue;
    signs.push(s);
    if (signs.length >= MAX_SIGNS) break;
  }
  for (const s of signs) { delete s.rank; delete s.b; }

  return { towns, signs };
}
