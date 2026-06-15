// Package the built game into ONE self-contained HTML file that runs from a
// double-click (file://) — the JS bundle, the whole Newburyport map, and the
// terrain heightfield are all inlined. Run AFTER `vite build`:
//   npm run share   →  dist/NBPT-Living.html
//
// Map data © OpenStreetMap contributors (ODbL) — attribution stays in the HUD.

import { readFile, writeFile, readdir } from 'node:fs/promises';

const dist = new URL('../dist/', import.meta.url);

const html = await readFile(new URL('index.html', dist), 'utf8');

// find the built module bundle referenced by dist/index.html
const srcMatch = html.match(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/);
if (!srcMatch) throw new Error('no module script found in dist/index.html — run vite build first');
const bundlePath = srcMatch[1].replace(/^\//, '');
let bundle = await readFile(new URL(bundlePath, dist), 'utf8');
// inline-script safety: never let the parser see a real </script>
bundle = bundle.replace(/<\/script/g, '<\\/script');

// the data payloads
const worldText = await readFile(new URL('../public/world.json', import.meta.url), 'utf8');
const heights = await readFile(new URL('../public/heights.bin', import.meta.url));
// JSON → JS string literal, with every '<' escaped so '</script>' can't occur
const worldLiteral = JSON.stringify(worldText).replace(/</g, '\\u003c');
const heightsB64 = heights.toString('base64');

const dataScript =
  `<script>window.__NBPT_WORLD__=JSON.parse(${worldLiteral});` +
  `window.__NBPT_HEIGHTS__="${heightsB64}";</script>`;

let out = html
  // drop the external bundle reference and any preload/icon links
  .replace(srcMatch[0], '')
  .replace(/<link rel="modulepreload"[^>]*>/g, '')
  .replace(/<link rel="icon"[^>]*>/g, '')
  .replace(/<link rel="manifest"[^>]*>/g, '') // no PWA install from a file:// single-file
  // inject data first, then the bundle, right before </body>
  .replace('</body>', `${dataScript}\n<script type="module">${bundle}</script>\n</body>`);

const outUrl = new URL('ClipperTown.html', dist);
await writeFile(outUrl, out);

const size = Buffer.byteLength(out) / 1e6;
console.log(`Wrote dist/NBPT-Living.html — ${size.toFixed(1)} MB (game + full map + terrain, runs offline from a double-click)`);

// sanity: nothing left that needs a server
const leftovers = (await readdir(dist)).filter((f) => f !== 'ClipperTown.html');
console.log('(dist also contains the normal hosted build:', leftovers.join(', ') + ')');
