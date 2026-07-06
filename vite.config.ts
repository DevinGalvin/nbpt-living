import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'node:child_process';
import { statSync, readFileSync, cpSync, existsSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

// ── Town selection ─────────────────────────────────────────────────
// One codebase, N towns. TOWN=<id> picks which town this build/dev-server is:
// its config (towns/<id>/town.json), its content pack (src/towns/<id>/ via the
// @town alias), and its payload (towns/<id>/public/ overlaid on shared public/).
const TOWN = process.env.TOWN || 'nbpt';
const townDir = resolve(__dirname, 'towns', TOWN);
const cfg = JSON.parse(readFileSync(join(townDir, 'town.json'), 'utf8'));
const B = cfg.branding;

// Stamp the build with its source commit so you can confirm what's actually live
// from the browser console (window.__build) — handy for verifying a deploy landed.
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
  worldBytes = statSync(join(townDir, 'public/world.json')).size;
  heightsBytes = statSync(join(townDir, 'public/heights.bin')).size;
} catch { /* fresh checkout without built world — progress falls back to MB counter */ }

// Cross-town GLOBAL storage keys (see the design contract in src/game/race.ts):
// a kid types their rider name once and it rides between towns; ghost pref and
// the board-url dev override too. Everything else namespaces per town.
const GLOBAL_KEYS = ['nbpt-race-name', 'nbpt-ghost', 'nbpt-board-url'];

// Pre-bundle boot script: publishes the town path (the Fast-Travel switcher
// reads it) and — for towns that share the origin with the root town — shims
// localStorage behind a per-town prefix so saves can never collide across
// towns (resume position, chapter state, season…). Runs before the bundle.
function bootScript(): string {
  const townPath = JSON.stringify(cfg.path);
  if (!cfg.savePrefix) return `<script>window.__townPath = ${townPath};</script>`;
  const seeds = Object.entries(cfg.storageSeeds ?? {})
    .map(([k, v]) => `shim.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('\n        ');
  const seedIf = Object.entries(cfg.storageSeedIfUnset ?? {})
    .map(([k, v]) => `if (!shim.getItem(${JSON.stringify(k)})) shim.setItem(${JSON.stringify(k)}, ${JSON.stringify(v)});`).join('\n        ');
  return `<script>
    // ${cfg.name} shares its origin with the root town, so it would share
    // localStorage too. Namespace all saved state behind the town prefix
    // (GLOBAL keys pass through — rider name & co. ride between towns).
    (function () {
      try {
        window.__townPath = ${townPath};
        var P = ${JSON.stringify(cfg.savePrefix)}, real = window.localStorage;
        var GLOBAL = ${JSON.stringify(GLOBAL_KEYS)};
        var key = function (k) { return GLOBAL.indexOf(k) >= 0 ? k : P + k; };
        var pref = function () { return Object.keys(real).filter(function (k) { return k.indexOf(P) === 0; }); };
        var shim = {
          getItem: function (k) { return real.getItem(key(k)); },
          setItem: function (k, v) { real.setItem(key(k), String(v)); },
          removeItem: function (k) { real.removeItem(key(k)); },
          clear: function () { pref().forEach(function (k) { real.removeItem(k); }); },
          key: function (i) { var k = pref()[i]; return k ? k.slice(P.length) : null; },
          get length() { return pref().length; }
        };
        Object.defineProperty(window, 'localStorage', { configurable: true, get: function () { return shim; } });
        ${seeds}
        ${seedIf}
      } catch (e) { /* fall back to shared storage if the browser won't let us shadow it */ }
    })();
  </script>`;
}

const MIME: Record<string, string> = {
  '.json': 'application/json', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json', '.js': 'text/javascript', '.html': 'text/html'
};

function townPlugin(): Plugin {
  return {
    name: 'town',
    // index.html is a town-agnostic template; brand it from town.json.
    transformIndexHtml(html) {
      const map: Record<string, string> = {
        '%B_HTML_TITLE%': B.htmlTitle, '%B_APPLE_TITLE%': B.appleTitle,
        '%B_THEME_COLOR%': B.themeColor, '%B_BG_TOP%': B.bgTop, '%B_BG_BOTTOM%': B.bgBottom,
        '%B_RULE_COLOR%': B.ruleColor, '%B_DESCRIPTION%': B.description,
        '%B_OG_SITE_NAME%': B.ogSiteName, '%B_OG_DESCRIPTION%': B.ogDescription,
        '%B_OG_URL%': B.ogUrl, '%B_OG_IMAGE%': B.ogImage, '%B_OG_IMAGE_TYPE%': B.ogImageType,
        '%B_OG_IMAGE_ALT%': B.ogImageAlt, '%B_TWITTER_DESCRIPTION%': B.twitterDescription,
        '%B_LOADING_TITLE%': B.loadingTitle, '%B_LOADING_SUB%': B.loadingSub,
        '%TOWN_BOOT%': bootScript()
      };
      return html.replace(/%(?:B_[A-Z_]+|TOWN_BOOT)%/g, (m) => map[m] ?? m);
    },
    // Dev: serve the town's payload (world.json, heights.bin, manifest…) over
    // the shared public/ dir. Registered before Vite's static middleware.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = (req.url || '').split('?')[0];
        const file = join(townDir, 'public', path.replace(/^\/+/, ''));
        if (path !== '/' && existsSync(file) && statSync(file).isFile()) {
          res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
          res.end(readFileSync(file));
          return;
        }
        next();
      });
    },
    // Build: overlay the town's payload onto the emitted site.
    closeBundle() {
      const out = resolve(__dirname, TOWN === 'nbpt' ? 'dist' : `dist-${TOWN}`);
      if (existsSync(join(townDir, 'public'))) cpSync(join(townDir, 'public'), out, { recursive: true });
    }
  };
}

export default defineConfig({
  base: './', // relative asset paths — works at a domain root AND under /<town>/ subpaths
  define: {
    __BUILD__: JSON.stringify(buildId),
    __PAYLOAD_BYTES__: JSON.stringify(worldBytes + heightsBytes)
  },
  resolve: {
    alias: {
      '@town': resolve(__dirname, 'src', 'towns', TOWN)
    }
  },
  plugins: [townPlugin()],
  server: {
    host: true,
    port: 5173
  },
  build: {
    target: 'es2020',
    outDir: TOWN === 'nbpt' ? 'dist' : `dist-${TOWN}`,
    chunkSizeWarningLimit: 2000
  }
});
