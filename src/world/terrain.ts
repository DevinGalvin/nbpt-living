// Heightfield from public/heights.bin (real USGS-derived elevation).
// Heights stored in decimeters on a uniform grid; sampled bilinearly,
// returned in WORLD PX (8 px = 1 m), y-up.

const PX_PER_M = 8;

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

  // height in world px at world-px coordinates
  heightAt(x: number, z: number): number {
    if (!this.ok) return 0;
    const gx = (x - this.x0) / this.spacing;
    const gz = (z - this.y0) / this.spacing;
    const ix = Math.max(0, Math.min(this.w - 2, Math.floor(gx)));
    const iz = Math.max(0, Math.min(this.h - 2, Math.floor(gz)));
    const fx = Math.max(0, Math.min(1, gx - ix));
    const fz = Math.max(0, Math.min(1, gz - iz));
    const i00 = this.data[iz * this.w + ix];
    const i10 = this.data[iz * this.w + ix + 1];
    const i01 = this.data[(iz + 1) * this.w + ix];
    const i11 = this.data[(iz + 1) * this.w + ix + 1];
    const top = i00 + (i10 - i00) * fx;
    const bot = i01 + (i11 - i01) * fx;
    const meters = (top + (bot - top) * fz) / 10;
    return Math.max(0, meters) * PX_PER_M;
  }

  // conservative LOWER bound of the surface over a world-px box: the min of
  // the raw grid nodes covering it (bilinear extrema live on nodes; the box is
  // snapped OUTWARD one cell by floor/ceil), water-clamped once at the end.
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
    return Math.max(0, m / 10) * PX_PER_M;
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
