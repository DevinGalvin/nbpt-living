// Synthetic checks for tools/lib/facade_geom.mjs: a wall in front of a camera lands
// where it should in the photo, a drawn quad rectifies to its own colours, and the
// packer fits what it says. Run: node tools/test_facade_geom.mjs
import assert from 'node:assert/strict';
import { wallFor, project, facing, alongRight, rectify, pack } from './lib/facade_geom.mjs';

// 1. the wall nearest the door, outward normal toward the door
{
  const ring = [0, 0, 80, 0, 80, 40, 0, 40];           // a 10 m × 5 m box, world px
  const w = wallFor(ring, 40, -10);                    // the door is 10 px north (y down) of the top edge
  assert.equal(w.mx, 40); assert.equal(w.mz, 0); assert.equal(w.len, 80);
  assert.ok(w.nz < -0.99, 'normal points out toward the door');
}
// 2. a camera 15 m south of a 10 m wall, looking north: corners symmetric, bottom below the horizon
{
  const cam = { east: 0, north: -15, up: 1.6, heading: 0, focal: 0.8, k1: 0, k2: 0, w: 2048, h: 1536 };
  const bl = project(cam, { east: -5, north: 0, up: 0 }), br = project(cam, { east: 5, north: 0, up: 0 });
  const tl = project(cam, { east: -5, north: 0, up: 3.75 }), tr = project(cam, { east: 5, north: 0, up: 3.75 });
  assert.ok(Math.abs((bl.u + br.u) / 2 - 1024) < 1e-6, 'centred');
  assert.ok(bl.v > 768 && tl.v < 768, 'ground below the horizon, the top above it');
  assert.ok(Math.abs(bl.v - br.v) < 1e-6 && Math.abs(tl.u - bl.u) < 1e-6, 'a rectangle head-on');
  const expectedHalf = 0.8 * 2048 * (5 / 15);
  assert.ok(Math.abs(br.u - 1024 - expectedHalf) < 1e-6, 'focal scale');
  assert.equal(project(cam, { east: 0, north: -30, up: 0 }), null, 'behind the camera is dropped');
  // a camera looking the wrong way is not facing the wall
  // the wall faces south (outward normal nz +1 = world south); the camera south of it looking north sees its face
  const wall = { nx: 0, nz: 1 };
  assert.ok(facing(cam, wall) > 0.99, 'head-on');
  const camBack = { ...cam, heading: 180 };
  assert.ok(facing(camBack, wall) < -0.99, 'looking away');
  const right = alongRight(wall);
  assert.ok(right.east > 0.99, 'facing north, the viewer\'s right is east');
}
// 3. rectify: a red quad drawn in perspective comes out red across the whole tile
{
  const W = 400, H = 300; const data = new Uint8Array(W * H * 4);
  const quad = [{ x: 120, y: 60 }, { x: 290, y: 80 }, { x: 300, y: 240 }, { x: 100, y: 220 }];
  const inside = (x, y) => { let c = false; for (let i = 0, j = 3; i < 4; j = i++) { const a = quad[i], b = quad[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; const r = inside(x + 0.5, y + 0.5); data[i] = r ? 220 : 20; data[i + 1] = 30; data[i + 2] = r ? 40 : 200; data[i + 3] = 255; }
  const tile = rectify({ width: W, height: H, data }, quad, 64, 32);
  let red = 0; for (let i = 0; i < 64 * 32; i++) if (tile.data[i * 4] > 150) red++;
  assert.ok(red / (64 * 32) > 0.93, 'the tile is the quad: ' + (red / (64 * 32)).toFixed(3));
}
// 4. packing
{
  const p = pack(Array.from({ length: 9 }, () => ({ width: 512, height: 256 })));
  assert.equal(p.size, 2048); assert.equal(p.at.length, 9); assert.deepEqual(p.at[4], { u: 0, v: 256 });
}
console.log('facade geometry: 4 checks passed');
