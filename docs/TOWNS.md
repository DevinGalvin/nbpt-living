# Towns — one engine, N real places

Clipper Town is a single codebase that builds a separate game per real town.
Everything town-specific lives in exactly two places:

| | What lives there | Consumed by |
|---|---|---|
| `towns/<id>/` | `town.json` (identity, geodesy, branding, storage policy) · `map.mjs` (map curation: landmarks, spot fixes, hand-added features, QA) · `public/` (the built payload: `world.json`, `heights.bin`, manifest, og-image) | the map pipeline (`tools/`), vite, and the runtime via the registry |
| `src/towns/<id>/` | `index.ts` (the `TownPack`: gameplay anchors, atmosphere, courses, theme, copy) · `courses.ts` (race ladder) | the engine, via the `@town` alias |

The engine (`src/`, `tools/`) never hardcodes a town. A build is selected with
the `TOWN` env var (default `nbpt`):

```bash
npm run dev                 # Newburyport dev server
npm run dev:salem           # Salem dev server (TOWN=salem vite)
npm run build:all           # dist/ = Newburyport + dist/salem/ = Salem
TOWN=salem npm run map      # (re)fetch + rebuild Salem's world.json
```

CI (`.github/workflows/deploy.yml`) runs `build:all` on every push to `source`,
so **every town ships from the same commit** — engine fixes can't drift between
towns, and there are no per-town branches, worktrees, or committed bundles.

## Adding a town (the checklist)

Say the next town is Portsmouth (`id: pmth`).

1. **Config** — `towns/pmth/town.json`: copy Salem's, set `origin` (downtown
   center — becomes world-px 0,0), `bbox` (S/W/N/E, the town plus its natural
   frame), name/branding/path (`/pmth/`), `savePrefix` (`"pmth:"`). Leave
   `mPerDegLat/Lon` out at first — the loader derives them from the origin
   latitude; pin them only once a world.json has shipped (they keep rebuilds
   byte-stable). Set `spawn` once you've curated the heart landmark (step 4).
2. **Curation** — `towns/pmth/map.mjs`: start with everything empty (Salem's is
   nearly empty). You can ship with zero curation; add landmarks after the
   world builds (grab centroids from world.json, or lat/lon like Newburyport's).
3. **Map data** — `TOWN=pmth npm run map` (Overpass fetch → world build →
   terrain), plus `TOWN=pmth node tools/fetch_heights.mjs` for real building
   heights (needs the `duckdb` CLI). Outputs land in `towns/pmth/public/`.
   Watch the QA lines; add `qaDistances` (real, independently-known distances)
   once you have two verified points.
4. **The drop point (the town's HEART)** — where a first-time player lands must
   be the *most memorable part of town* — where a local kid would take a visitor
   first (Newburyport → Market Square, Salem → Essex St Mall, Beverly → Ellis
   Square by The Cabot), **not** the geometric centre and **not** a beloved-but-
   outlying destination (Beverly first shipped dropping people a mile out at
   Lynch Park — fixed). To keep this repeatable and enforced, the drop is a
   **named landmark**, never a raw coordinate:
   1. Curate that landmark in `towns/pmth/map.mjs` like any other (it gets a
      `name` + `sub` the player already sees).
   2. In `towns/pmth/town.json`, set
      `"spawn": { "landmark": "<that-id>", "dx": 0, "dz": 0 }`. `dx/dz` are an
      optional world-px nudge from the landmark's centre onto walkable ground
      (+z = south); leave them 0 and let the engine's `findFree` snap to land,
      or fine-tune once you've seen it in-game.
   3. `node tools/check_town_spawn.mjs` (runs in `build:all` / CI, or via
      `npm run check:towns`) **fails the build** if `spawn.landmark` is missing
      or names a landmark that isn't in the town's `world.json`, or if the nudge
      flings the drop far outside it — so no town can ship an anonymous or
      broken drop point.

   The pack (`src/towns/pmth/index.ts`, copy Salem's — `story: false` = a
   world-only sandbox is a complete, shippable game) reads `spawn` straight from
   `town.json`; also set a flight site, theme colors, copy. Empty `courses` is
   fine to start; author races later with `TOWN=pmth node tools/make_course.mjs`.
5. **Register** — one line in `src/towns/registry.ts` (adds it to every town's
   Fast-Travel switcher) and a `build:pmth`-style step in `build:all`
   (package.json) so CI ships it under `/pmth/`.
6. **Assets** — `towns/pmth/public/`: manifest (copy Salem's and re-word,
   incl. theme colors) + a UNIQUE og-image (1200×630) — capture a real
   in-game screenshot of THIS town (Beverly once launched with Salem's photo
   on its share cards; `tools/check_town_assets.mjs` fails the build if two
   towns share an og-image). Favicons/icons are shared from `public/` unless
   the town wants its own.
6b. **Borders** — run the **fetch-data** workflow (Actions tab; cloud sessions
   can't reach Overpass) to get `data/pmth/raw/boundaries.json` from the
   `map-data` branch, then `TOWN=pmth node tools/patch_borders.mjs`. That's the
   whole "Entering …" banner + roadside Welcome-sign system; add `borderLore`
   lines to the pack for the banner subtitles.
7. **Landmark heroes (optional polish)** — hand-modeled buildings go in
   `src/three/decor.ts`'s `HEROES` dict, keyed by the building's OSM `name`.
   All towns' heroes coexist (names are unique); a building without a hero
   renders generically, so this is pure incremental polish.

Steps 1–5 are an afternoon; the map pipeline is fully automatic. Everything
after that is content polish, at whatever depth the town deserves.

## The rules that keep this scalable

- **Engine changes land once.** If you're typing a town's name into `src/`
  (outside `src/towns/`), stop — it belongs in the pack, `town.json`, or
  `map.mjs`.
- **The drop point is a named heart, not a coordinate.** A town's `spawn` names
  one of its curated landmarks (`town.json` → `spawn.landmark`), so every player
  lands at a real, celebrated, *named* place — the most memorable part of town —
  and `tools/check_town_spawn.mjs` fails the build if that ever breaks.
- **Curation is data, not output edits.** `npm run map` must always be safe to
  re-run: hand-added features (the Fox Run pool, level fixes, manual buildings)
  live in `map.mjs` and are re-applied by every rebuild. Never hand-edit
  `world.json`.
- **Saves are namespaced per town.** All towns share the clippertown.io origin;
  a boot-time localStorage shim (generated by vite.config.ts from
  `savePrefix`) prefixes every key. Three keys are deliberately global —
  rider name, ghost pref, board-url (see the contract in src/game/race.ts).
- **`story: false` is a real product.** The Newburyport quest line stays
  Newburyport's; new towns launch as world-only sandboxes (explore + vehicles +
  racing + seasons) and can grow a story later. `?story` in the URL force-wires
  the spine for development.
- **The leaderboard is already multi-town.** One backend, partitioned by the
  pack's `raceTown` — nothing to deploy for a new town.

## History

Salem originally shipped from a hard fork (`salem-experiment` branch + an
`nbpt-salem` worktree) whose built bundle was committed under `public/salem/`.
Every engine change had to be hand-ported ("Both towns:" commits) and manually
re-bundled. The fork was reunified into this architecture in July 2026; the
branch is retired — do not develop on it.
