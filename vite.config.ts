import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { statSync } from 'node:fs';

// Stamp the build with its source commit so you can confirm what's actually live
// from the browser console (window.__build) — handy for verifying a deploy
// landed. Works for both `npm run deploy` and the CI deploy (.github/workflows).
let buildId = 'dev';
try {
  buildId = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  /* no git available (e.g. a tarball build) — leave 'dev' */
}

// Exact payload sizes for the loading-screen progress % (fetch streams report
// DECOMPRESSED bytes, so response Content-Length — the gzipped size — can't be used).
let worldBytes = 0, heightsBytes = 0;
try {
  worldBytes = statSync(new URL('./public/world.json', import.meta.url)).size;
  heightsBytes = statSync(new URL('./public/heights.bin', import.meta.url)).size;
} catch { /* fresh checkout without built world — progress falls back to MB counter */ }

export default defineConfig({
  base: './', // relative asset paths — works at a domain root AND under /nbpt-living/ on Pages
  define: {
    __BUILD__: JSON.stringify(buildId),
    __PAYLOAD_BYTES__: JSON.stringify(worldBytes + heightsBytes)
  },
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000
  }
});
