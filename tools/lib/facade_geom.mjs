// Geometry for the automatic storefront fetch: which wall a business is on, where
// that wall's corners land in a street-level photo taken by a known camera, and the
// homography that pulls the wall flat. Pure functions, unit-tested by
// tools/test_facade_geom.mjs, no network.

/** the building edge nearest (x,z) with its outward normal; world px, y down */
export function wallFor(ring, x, z) {
  let cx = 0, cz = 0, n = ring.length / 2;
  for (let i = 0; i < ring.length; i += 2) { cx += ring[i]; cz += ring[i + 1]; }
  cx /= n; cz /= n;
  let best = null, bd = Infinity;
  for (let i = 0; i + 1 < ring.length; i += 2) {
    const x0 = ring[i], z0 = ring[i + 1], x1 = ring[(i + 2) % ring.length], z1 = ring[(i + 3) % ring.length];
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz);
    if (len < 12) continue;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (z - z0) * dz) / (len * len)));
    const d = (x0 + dx * t - x) ** 2 + (z0 + dz * t - z) ** 2;
    if (d < bd) {
      bd = d;
      let nx = -dz / len, nz = dx / len;
      const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      if ((mx - cx) * nx + (mz - cz) * nz < 0) { nx = -nx; nz = -nz; }
      best = { x0, z0, x1, z1, mx, mz, tx: dx / len, tz: dz / len, nx, nz, len, dist: Math.sqrt(d) };
    }
  }
  return best;
}

/**
 * Project a world point into a Mapillary perspective image.
 * cam: { east, north, up } metres (camera at origin of the local frame), heading deg clockwise from north,
 *      focal (normalised by max(w,h)), k1, k2, w, h.  Pitch and roll assumed 0 (a phone or dash cam held level).
 * p: { east, north, up } metres. Returns { u, v, depth } in pixels, or null behind the camera.
 */
export function project(cam, p) {
  const th = (cam.heading * Math.PI) / 180;
  const fx = Math.sin(th), fy = Math.cos(th);           // forward (east, north)
  const rx = Math.cos(th), ry = -Math.sin(th);          // right
  const dx = p.east - cam.east, dy = p.north - cam.north, dz = p.up - cam.up;
  const depth = dx * fx + dy * fy;
  if (depth < 0.3) return null;
  const xn = (dx * rx + dy * ry) / depth, yn = dz / depth;
  const r2 = xn * xn + yn * yn;
  const dist = 1 + (cam.k1 || 0) * r2 + (cam.k2 || 0) * r2 * r2;
  const F = cam.focal * Math.max(cam.w, cam.h);
  return { u: cam.w / 2 + F * xn * dist, v: cam.h / 2 - F * yn * dist, depth };
}

/** how squarely a camera looks at a wall's face: 1 head-on, 0 edge-on, negative = looking at its back */
export function facing(cam, wall) {
  const th = (cam.heading * Math.PI) / 180;
  // the wall's outward normal in (east, north): world z is south, so north = -nz;
  // head-on means the camera's forward is that normal reversed
  return -(Math.sin(th) * wall.nx + Math.cos(th) * -wall.nz);
}
/** the direction along a wall that a viewer on the street sees as their right: (east, north) */
export function alongRight(wall) { return { east: wall.nz, north: wall.nx }; }

/** homography from the unit square to a quad (tl, tr, br, bl); returns (u,v) -> [x,y] */
export function homography(q) {
  const [p0, p1, p2, p3] = q;
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  const den = dx1 * dy2 - dx2 * dy1;
  const g = (dx3 * dy2 - dx2 * dy3) / den, h = (dx1 * dy3 - dx3 * dy1) / den;
  const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x, c = p0.x;
  const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y, f = p0.y;
  return (u, v) => { const w = g * u + h * v + 1; return [(a * u + b * v + c) / w, (d * u + e * v + f) / w]; };
}

/** pull the quad flat: src RGBA {width,height,data} -> RGBA tile of tw×th, bilinear */
export function rectify(src, quad, tw, th) {
  const H = homography(quad);
  const out = new Uint8Array(tw * th * 4);
  const s = (xx, yy, ch) => { xx = Math.max(0, Math.min(src.width - 1, xx)); yy = Math.max(0, Math.min(src.height - 1, yy)); return src.data[(yy * src.width + xx) * 4 + ch]; };
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const [px, py] = H((x + 0.5) / tw, (y + 0.5) / th);
    const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0;
    const i = (y * tw + x) * 4;
    for (let ch = 0; ch < 3; ch++) out[i + ch] = s(x0, y0, ch) * (1 - fx) * (1 - fy) + s(x0 + 1, y0, ch) * fx * (1 - fy) + s(x0, y0 + 1, ch) * (1 - fx) * fy + s(x0 + 1, y0 + 1, ch) * fx * fy;
    out[i + 3] = 255;
  }
  return { width: tw, height: th, data: out };
}

/** shelf-pack tiles ({width,height}) into the smallest power-of-two square; returns { size, at: [{u,v}] } */
export function pack(tiles) {
  for (let size = 512; size <= 8192; size *= 2) {
    let x = 0, y = 0, rowH = 0, ok = true; const at = [];
    for (const t of tiles) { if (x + t.width > size) { x = 0; y += rowH; rowH = 0; } if (y + t.height > size) { ok = false; break; } at.push({ u: x, v: y }); x += t.width; rowH = Math.max(rowH, t.height); }
    if (ok) return { size, at };
  }
  throw new Error('too many tiles for one atlas');
}
