// Heightfield from public/heights.bin (real USGS-derived elevation).
// Heights stored in decimeters on a uniform 64 px (8 m) grid; sampled with a
// Catmull-Rom bicubic, returned in WORLD PX (8 px = 1 m), y-up.
//
// ⚠️ Why not plain bilinear: bilinear is only C0. Its SLOPE jumps at every cell
// boundary, so the ground was a landscape of four-sided tents and a straight
// street kinked at every cell line. Why not smoothstep-bilinear (what this was
// next): it is C1, but it flattens around every node, and where the ground
// crosses the waterline those little plateaus printed as a 64 px sawtooth along
// every diagonal beach. The cubic is C1 without the plateaus. Values AT the grid
// nodes are untouched, so every measured elevation is still exactly where the
// survey put it; only the guesswork between samples changes. The one cost is a
// small overshoot beside a sharp step (a quay wall), which minHeightOver allows for.

const PX_PER_M = 8;

function catmull(p0: number, p1: number, p2: number, p3: number, t: number): number {
  return 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
}

export class Terrain {
  private data: Int16Array = new Int16Array(0);
  private x0 = 0;
  private y0 = 0;
  private spacing = 64;
  private w = 0;
  private h = 0;
  ok = false;

  static async load(url: string): Promise<Terrain> {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Terrain.fromBuffer(await res.arrayBuffer());
    } catch (err) {
      console.warn('terrain unavailable, world will be flat:', err);
      return new Terrain();
    }
  }

  // single-file builds inline heights.bin as base64
  static fromBase64(b64: string): Terrain {
    const bin = atob(b64);
    const buf = new ArrayBuffer(bin.length);
    const u8 = new Uint8Array(buf);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return Terrain.fromBuffer(buf);
  }

  static fromBuffer(buf: ArrayBuffer): Terrain {
    const t = new Terrain();
    try {
      const dv = new DataView(buf);
      if (dv.getInt32(0, true) !== 0x4e425054) throw new Error('bad magic');
      t.spacing = dv.getInt32(4, true);
      t.w = dv.getInt32(8, true);
      t.h = dv.getInt32(12, true);
      t.x0 = dv.getFloat64(16, true);
      t.y0 = dv.getFloat64(24, true);
      t.data = new Int16Array(buf, 32, t.w * t.h);
      t.ok = true;
    } catch (err) {
      console.warn('terrain unavailable, world will be flat:', err);
    }
    return t;
  }

  /**
   * The DEM has no bathymetry: every node under water reads 0, so the bed is a plateau
   * a hand's breadth below the surface and the waterline is pinned to the grid — a
   * diagonal coast came out as a 64 px staircase. This extrapolates the beach slope
   * out under mapped water for a few nodes (a shelf falling ~0.4 m per node), so the
   * waterline crosses cells at a smoothly varying fraction and the shallows have depth.
   * Land nodes are never touched. `mask` bit 1 marks nodes under mapped water.
   */
  addBathymetry(mask: Uint8Array) {
    if (!this.ok || mask.length !== this.w * this.h) return;
    const w = this.w, h = this.h, d = this.data;
    const out = new Int16Array(d);
    const ring = new Uint8Array(w * h);
    const isLand = (i: number) => !(mask[i] & 1) || d[i] > 2;
    const nb = (i: number, f: (j: number) => void) => {
      const x = i % w, y = (i - x) / w;
      if (x > 0) f(i - 1); if (x < w - 1) f(i + 1); if (y > 0) f(i - w); if (y < h - 1) f(i + w);
    };
    let frontier: number[] = [];
    for (let i = 0; i < w * h; i++) {
      if (isLand(i)) continue;
      let sum = 0, n = 0;
      nb(i, (j) => { if (isLand(j)) { sum += Math.max(d[j], 4); n++; } });
      if (!n) continue;
      out[i] = -Math.round((sum / n) * 0.7);
      ring[i] = 1; frontier.push(i);
    }
    for (let k = 2; k <= 5 && frontier.length; k++) {
      const next: number[] = [];
      for (const i of frontier) {
        nb(i, (j) => {
          if (ring[j] || isLand(j)) return;
          let sum = 0, n = 0;
          nb(j, (q) => { if (ring[q] === k - 1) { sum += out[q]; n++; } });
          out[j] = Math.max(-80, Math.round(sum / n) - 6);
          ring[j] = k; next.push(j);
        });
      }
      frontier = next;
    }
    // beyond the shelf the DEM's plateau (0 here, −1 m there) would read as a bed a
    // hand's breadth down; open water is deep, so say so
    for (let i = 0; i < w * h; i++) if (!ring[i] && !isLand(i)) out[i] = -80;
    d.set(out);
  }

  /** the raw grid, for shaders that sample the heightfield (shoreline depth, wet sand) */
  grid(): { data: Int16Array; x0: number; y0: number; spacing: number; w: number; h: number } | null {
    return this.ok ? { data: this.data, x0: this.x0, y0: this.y0, spacing: this.spacing, w: this.w, h: this.h } : null;
  }

  // height in world px at world-px coordinates.
  //
  // Catmull-Rom bicubic over the 4×4 nodes around the point. It is C1 like the
  // smoothstep-bilinear it replaces (no creases), but it does not flatten around each
  // node: smoothstep made every node a tiny plateau, and where the ground crossed the
  // waterline that plateau printed as a 64 px sawtooth along every diagonal beach.
  // The synthetic sea bed (addBathymetry) goes below zero, and so does this.
  heightAt(x: number, z: number): number {
    if (!this.ok) return 0;
    const gx = (x - this.x0) / this.spacing;
    const gz = (z - this.y0) / this.spacing;
    const ix = Math.max(0, Math.min(this.w - 2, Math.floor(gx)));
    const iz = Math.max(0, Math.min(this.h - 2, Math.floor(gz)));
    const rx = Math.max(0, Math.min(1, gx - ix));
    const rz = Math.max(0, Math.min(1, gz - iz));
    const w = this.w, d = this.data;
    const x0 = Math.max(0, ix - 1), x1 = ix, x2 = ix + 1, x3 = Math.min(w - 1, ix + 2);
    const rows: number[] = [0, 0, 0, 0];
    for (let k = 0; k < 4; k++) {
      const zz = Math.max(0, Math.min(this.h - 1, iz - 1 + k)) * w;
      rows[k] = catmull(d[zz + x0], d[zz + x1], d[zz + x2], d[zz + x3], rx);
    }
    const meters = catmull(rows[0], rows[1], rows[2], rows[3], rz) / 10;
    return meters * PX_PER_M;
  }

  // conservative LOWER bound of the surface over a world-px box: the min of
  // the raw grid nodes covering it, less half a metre for the cubic's undershoot
  // (the box is snapped OUTWARD one cell by floor/ceil), water-clamped at the end.
  // Used by the impostor so its chords can never rise above the true ground.
  minHeightOver(x0: number, z0: number, x1: number, z1: number): number {
    if (!this.ok) return 0;
    const ix0 = Math.max(0, Math.min(this.w - 1, Math.floor((x0 - this.x0) / this.spacing)));
    const ix1 = Math.max(0, Math.min(this.w - 1, Math.ceil((x1 - this.x0) / this.spacing)));
    const iz0 = Math.max(0, Math.min(this.h - 1, Math.floor((z0 - this.y0) / this.spacing)));
    const iz1 = Math.max(0, Math.min(this.h - 1, Math.ceil((z1 - this.y0) / this.spacing)));
    let m = Infinity;
    for (let iz = iz0; iz <= iz1; iz++) {
      for (let ix = ix0; ix <= ix1; ix++) m = Math.min(m, this.data[iz * this.w + ix]);
    }
    // the cubic can dip a little below the node minimum beside a sharp step
    return Math.max(0, m / 10 - 0.5) * PX_PER_M;
  }

  // ground normal via central differences (for terrain shading)
  normalAt(x: number, z: number, out: { x: number; y: number; z: number }) {
    const e = this.spacing / 2;
    const hx = this.heightAt(x + e, z) - this.heightAt(x - e, z);
    const hz = this.heightAt(x, z + e) - this.heightAt(x, z - e);
    const nx = -hx / (2 * e), nz = -hz / (2 * e);
    const len = Math.hypot(nx, 1, nz);
    out.x = nx / len;
    out.y = 1 / len;
    out.z = nz / len;
  }
}
