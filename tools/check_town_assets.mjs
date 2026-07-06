// Guard: every town must have its OWN identity assets. Beverly launched with
// Salem's og-image (docs/TOWNS.md used to say "copy Salem's") and share cards
// showed the wrong town — this fails the build if two towns share identical
// og-image bytes, so a placeholder copy can never ship again.
// Runs at the front of `npm run build:all` (CI runs that on every deploy).
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

const seen = new Map();
let bad = false;
for (const town of readdirSync('towns')) {
  let buf = null;
  for (const ext of ['jpg', 'png']) {
    try { buf = readFileSync(`towns/${town}/public/og-image.${ext}`); break; } catch { /* try next */ }
  }
  if (!buf) {
    console.error(`✗ towns/${town}/public/og-image.{jpg,png} missing — every town needs its own share image`);
    bad = true;
    continue;
  }
  const h = createHash('md5').update(buf).digest('hex');
  if (seen.has(h)) {
    console.error(`✗ towns/${town}/og-image.jpg is byte-identical to towns/${seen.get(h)}/og-image.jpg — share cards would show the wrong town. Capture a real screenshot of ${town}.`);
    bad = true;
  }
  seen.set(h, town);
}
if (bad) process.exit(1);
console.log(`og-images unique across ${seen.size} town(s) ✓`);
