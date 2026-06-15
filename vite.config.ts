import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';

// Stamp the build with its source commit so you can confirm what's actually live
// from the browser console (window.__build) — handy for verifying a deploy
// landed. Works for both `npm run deploy` and the CI deploy (.github/workflows).
let buildId = 'dev';
try {
  buildId = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
} catch {
  /* no git available (e.g. a tarball build) — leave 'dev' */
}

export default defineConfig({
  base: './', // relative asset paths — works at a domain root AND under /nbpt-living/ on Pages
  define: {
    __BUILD__: JSON.stringify(buildId)
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
