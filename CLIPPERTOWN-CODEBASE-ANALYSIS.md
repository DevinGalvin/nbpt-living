# Clippertown: what has been built, and what a fork could reuse

Written from a full read of the source at commit `051ca46` on branch
`claude/clippertown-codebase-analysis-u8s7aq` (repo `DevinGalvin/nbpt-living`).
Everything below is from the actual code unless it is explicitly marked as a
claim I could not verify.

---

## 1. What it is, in one page

Clippertown is a browser game that renders a real Massachusetts town as a
voxel-ish 3D world built from OpenStreetMap data and USGS elevation, and lets you
walk, bike, kayak, and fly around it. The map is not stylized geography: it is the
actual street graph, the actual building footprints, the actual property fences and
backyard pools and surveyed trees, at 8 world pixels per meter. The pitch that
carries it is "find your own house."

Twelve towns ship today from one codebase and one commit:

| Town | Path | Buildings | Roads | Landmarks | world.json | heights.bin |
|---|---|---:|---:|---:|---:|---:|
| Newburyport | `/` | 13,020 | 3,863 | 32 | 4.7 MB | 3.6 MB |
| Salem | `/salem/` | 25,434 | 5,108 | 30 | 4.7 MB | 1.7 MB |
| Beverly | `/beverly/` | 29,436 | 6,363 | 42 | 6.1 MB | 4.4 MB |
| Ipswich | `/ipswich/` | 10,156 | 3,016 | 36 | 3.7 MB | 5.3 MB |
| Gloucester | `/gloucester/` | 18,215 | 3,741 | 41 | 4.5 MB | 5.4 MB |
| Marblehead | `/marblehead/` | 15,768 | 2,979 | 32 | 3.1 MB | 1.6 MB |
| Manchester | `/manchester/` | 5,968 | 1,773 | 23 | 2.0 MB | 3.1 MB |
| Rockport | `/rockport/` | 9,581 | 1,809 | 30 | 2.1 MB | 2.3 MB |
| Amesbury | `/amesbury/` | 12,570 | 3,411 | 44 | 2.9 MB | 3.0 MB |
| Salisbury | `/salisbury/` | 14,719 | 4,077 | 38 | 3.7 MB | 3.1 MB |
| Charlestown | `/charlestown/` | 4,885 | 2,311 | 63 | 1.7 MB | 0.5 MB |
| Boston | `/boston/` | 233,266 | 49,432 | 129 | 47.7 MB | 16.5 MB |

Counts read directly out of each town's built `world.json`. All twelve are
listed in `src/towns/registry.ts` and all twelve are built by `npm run build:all`
in CI on every push.

Scale of the codebase: about 31,000 lines of TypeScript under `src/`, about 3,300
lines of Node build tooling under `tools/`, about 2,400 lines of per-town packs,
and about 2,100 lines of per-town config and map curation. The only runtime
dependency in `package.json` is `three` (^0.166.1). No React, no game engine, no
physics library, no asset pipeline. The HUD is hand-written DOM plus a large
inline CSS string in `src/game/hud.ts`.

---

## 2. How a player actually experiences it

**Boot.** `index.html` is a town-agnostic template. Vite substitutes branding
tokens from `towns/<id>/town.json` at build time (title, theme color, loading
copy, Open Graph card). A loading card shows a percentage computed against the
exact payload byte count baked in at build time, because streamed fetches report
decompressed bytes and `Content-Length` is the gzipped size. `src/main.ts` fetches
`world.json` and `heights.bin` in parallel, constructs `Terrain`, and hands both
to `Game`.

**Drop-in.** You land standing in the town's "heart" landmark: Market Square in
Newburyport, Essex Street Mall in Salem, Dock Square in Rockport, Faneuil Hall in
Boston. This is a contract, not a coordinate (see section 6). If you have played
before, a persisted `nbpt-resume-pos` puts you back where you stood. A collision
helper (`findFree`) snaps the spawn onto walkable ground.

**First-visit nudge.** After 1.5 seconds a toast says some version of "This is the
real map of Newburyport. Tap to find your street." That single line is the
product's whole hook, and it is per-town copy in the pack (`streetNudge`).

**Controls.** WASD or arrows, camera-relative. Shift sprints, R toggles always-run.
C flips between a tilted chase camera and a north-up map view. V (or an on-screen
button) tilts the camera up so you can see a skyline, which was added for Boston.
M opens fast travel. Mouse wheel or pinch zooms. Touch gets a floating joystick;
a second finger sprints. Number keys 1 through 9 quick-travel to favorites.

**The three things to do.**

1. **Explore and look yourself up.** Fast travel (`initTravel`) lists every curated
   landmark. Search (`initSearch`) is fuzzy over landmarks, business POIs, named
   buildings and areas, and every named street, so typing your street name gets
   you there. Arrival is cinematic: `travelToPlace` picks a stand-off distance and
   a look angle by sampling the sight line against real building footprints and
   heights, so you arrive facing the thing rather than nose-to-brick.
2. **Collect the town's history.** Bronze plaques stand at real sites. Walking
   within 54 world pixels offers a READ button; reading opens a card with a
   sourced true story, plays a jingle, and, crucially, **captures a screenshot of
   the frame you were looking at** and stores it as the photo on that card
   (`src/game/shots.ts`). The collection panel shows every marker slot from the
   first second, with a hint derived from the nearest real street name, so a locked
   slot reads as "somewhere on High Street" rather than a blank. Finding all of
   them earns a "Town Historian" card.
3. **Race.** Bike time trials on the real road graph. A course is a start flag, an
   ordered chain of guidance gates, and a route polyline traced along real streets.
   Best times persist, every run records a ghost polyline sampled every 200 ms, and
   times sync to a shared cloud leaderboard partitioned by town.

**Ambient texture.** 22 pedestrians walking the actual sidewalk network, 10 cars
driving road polylines on the correct side, stray dogs, boats whose count varies by
season, gulls, and in fall bats, roaming ghosts, black cats, trick-or-treaters and
a witch circling the graveyard; in winter skaters on the named pond and sledders on
the named hill. Nothing spawns or despawns inside your view. A day and night cycle
runs on roughly a 420-second period with a hand-shaped sun curve; street lamps come
on at night via a pool of 16 point lights that follow the nearest mapped lamps.
Five procedural lo-fi music styles are selectable in settings. All audio is
synthesized WebAudio; there are no audio assets in the repo.

**Vehicles and modes.** Bike (baseline, no gate), free-roam kayak confined to
water with shore hop-out, and a scenic flight that takes off from a real airfield
per town (Plum Island Runway 28 in Newburyport, Logan Runway 27 in Boston) with no
crash state.

**The story spine is off.** This is the single most important product fact in the
codebase and it is easy to miss. `src/game/Game.ts` line 33:

```ts
const STORY = TOWN.story && new URLSearchParams(location.search).has('story');
```

Only Newburyport sets `story: true`, and even Newburyport requires `?story` in the
URL. So the authored chapter spine (two levels, nine chapters, NPCs, dialogue,
interiors, the smugglers' tunnel, the drawbridge, the objective compass, the
backpack, the missions log, and the 24 easter eggs, roughly 4,600 lines) ships in
the bundle but is not reachable by a normal player in any town. The code comment
says this was a deliberate retirement on 7/28 in favor of the history collection,
which is the part that scales across towns.

---

## 3. Game mechanics: what is live, what is dormant

**Live in every town**

- Free movement with sub-stepped wall-slide collision, fence hopping, terrain-riding
- Chase camera with an analytic occlusion pull-in that grazes past buildings
- Fast travel, place search, minimap, compass, street-name pill
- Landmark arrival banners and "Entering <town>" banners with roadside welcome signs
  baked at every point a real road crosses a real municipal boundary
- Bike, kayak, scenic flight
- Racing with ghosts and a cloud leaderboard
- Day/night, weather, four seasons that re-dress the whole world by table swap
- Ambient life, procedural audio, photo mode via discovery capture
- Service-worker offline caching, PWA manifest, mobile joystick and pinch

**Live only where the town supplies content**

- The history collection. It rides `TOWN.history`, not the story flag. **Only two
  of twelve towns have any: Newburyport (36 markers) and Gloucester (23).** The
  other ten towns are pure sandboxes with no collection, no plaques, and no 🏛
  button.
- Race ladders. Eight towns have three courses each; Amesbury, Manchester,
  Rockport and Salisbury ship empty ladders.
- Hero buildings. `HEROES` in `src/three/decor.ts` is a dictionary of about 180
  hand-modeled landmark builders keyed by the building's OSM name. All towns' heroes
  coexist in one dictionary because names are unique; a building with no hero
  renders generically.

**Dormant (in the repo, unreachable without `?story`)**

- Chapters, NPCs, dialogue, objective beacon, missions log, backpack, items
- Three hand-built interiors, the tunnel dungeon, the Gillis drawbridge set piece
- 24 easter eggs including the eight scattered Dexter statues, the sea serpent,
  the Konami code, and `xyzzy` in the travel search. These are gated on `!BARE`,
  which is `TOWN.story`, so they exist only in Newburyport and only in story mode.

---

## 4. Tech stack and architecture

**Stack.** TypeScript (strict), Vite 5, Three.js 0.166, no other runtime deps.
Build is `tsc --noEmit && vite build`. Target ES2020. Deployed as a fully static
site to GitHub Pages behind the custom domain clippertown.io. Analytics is
GoatCounter, loaded from `index.html`.

**Runtime module map.**

```
src/main.ts            boot: fetch world.json + heights.bin, build Terrain, new Game()
src/game/Game.ts       2,844 lines. The engine: scene, chunk streaming and eviction,
                       movement + collision, camera, fast travel, vehicles, flight,
                       interiors swap, lamps, dynamic resolution, debug hooks
src/world/index.ts     2,763 lines. WorldIndex: spatial buckets, the painted ground
                       canvas per chunk, the collision grid, bridge profiles, water
                       and ice queries, shop signs, tree placement, road name lookup
src/world/terrain.ts   heightfield sampling from heights.bin, bilinear + smoothstep
src/world/style.ts     palette, season resolution, seasonal table swap
src/three/decor.ts     9,929 lines. All building and scenery mesh generation, plus
                       the HEROES registry of hand-modeled landmarks
src/three/actors.ts    the kid and the dog, run cycles
src/three/water.ts     one animated water surface for the whole map, winter ice
src/three/sky.ts       day/night dome, sun/moon, stars, rain and snow
src/three/textures.ts  procedural clapboard, brick, shingle, plank textures
src/game/hud.ts        3,345 lines. The entire DOM UI and its CSS
src/game/history.ts    the discovery collection runner
src/game/race.ts       courses, timing, ghosts, name filter, leaderboard sync
src/game/life.ts       pedestrians, cars, boats, gulls, seasonal crowds
src/game/audio.ts      procedural music and ambience
src/game/diag.ts       mobile crash post-mortem via a localStorage sentinel
src/game/saves.ts      per-town storage key naming
src/game/quest.ts      the dormant chapter spine
src/game/eggs.ts       the dormant easter eggs
```

**Rendering approach.** The world is streamed as chunks. Each chunk gets a ground
mesh whose texture is a 768px canvas painted at runtime by `WorldIndex.groundCanvas`
(roads with centerlines, crosswalks, water with shorelines, marsh ticks, rail ties,
boardwalk planks, street names painted on the pavement), displaced onto the real
heightfield with analytic normals. Decor is one merged mesh per chunk with five
textured material groups. A shader injection multiplies a tiled micro-detail grain
over every ground chunk so surfaces stay textured at any camera distance. Real-time
PCF soft shadows follow the player. A low-res whole-map impostor sits under the
chunks to kill pop-in, and flight mode streams a cheaper decor-only chunk set.

**Performance engineering that is clearly hard-won.** Dynamic resolution scaling
driven by an FPS sampler; MSAA disabled on detected weak GPUs; a chunk cache trimmed
on touch devices; an analytic camera occlusion test instead of raycasts against
merged meshes; a crash-detection sentinel written to localStorage and cleared on
`pagehide` specifically because iOS Safari kills memory-heavy tabs silently. Boston
required a `heavyOnMobile` one-time dismissable warning card, deliberately not a
block.

**Data format.** `world.json` is a single JSON document typed in
`src/world/types.ts`: polys (with holes), buildings (footprint, levels, kind,
optional style and min-height), roads, paths, rails, labels, landmarks, POIs,
barriers, surveyed trees, addresses grouped by street, power lines, municipal
boundary rings, and welcome-sign spots. Geometry is flat `[x,y,x,y,...]` arrays in
world pixels. `heights.bin` is a 32-byte header plus Int16 decimeter heights on a
64px grid. The whole `world.json` is parsed at boot; the code comments record that
Boston's 45.6 MB raw / 14.8 MB gzipped parses in 133 ms and retains 97 MB, linear
in building count, so no streaming rewrite was needed.

---

## 5. The content pipeline

```
OpenStreetMap (Overpass)  ->  data/<id>/raw/overpass.json      tools/fetch_osm.mjs
OSM admin boundaries      ->  data/<id>/raw/boundaries.json    tools/fetch_boundaries.mjs
Overture Maps buildings   ->  data/<id>/raw/heights.json       tools/fetch_heights.mjs (needs duckdb CLI)
                                     |
                                     v
                          tools/build_world.mjs  +  towns/<id>/{town.json, map.mjs}
                                     |
                                     v
                          towns/<id>/public/world.json
                                     |
AWS Terrain Tiles (USGS)  ->  towns/<id>/public/heights.bin    tools/fetch_terrain.mjs
```

`build_world.mjs` (1,254 lines) is the heart. It projects lat/lon to a local
equirectangular grid centered on the town origin, classifies OSM features into game
kinds, assembles multipolygon relations (the Merrimack is a 13 km² ring with 22
island holes), derives the ocean from the coastline, overlays real building heights,
applies per-town curation, computes bridge and elevated-span profiles so a building
can never wall off a live street, simplifies nature polygons with Douglas-Peucker at
tiered tolerances, bakes municipal boundaries and welcome signs, runs QA against
known real-world distances, and writes the file.

Support tooling worth knowing about:

- `tools/landmark_candidates.mjs` reads the built world and prints named features
  that are genuinely inside the town's own municipal polygon, with an interior
  point rather than a centroid (because a crescent beach's centroid lands in the
  ocean). This exists because Marblehead's first landmark pass put Old Burial Hill
  1.5 km out to sea.
- `tools/make_course.mjs` does a shortest-path walk over the real road graph
  between waypoints and emits ready-to-paste race gates and route polyline.
- `tools/check_markers.mjs` verifies every history marker stands on reachable
  ground, reading world.json off disk rather than probing the running game (the
  collision grid only exists for streamed chunks and lies about everywhere else).
- `tools/check_town_spawn.mjs` and `tools/check_town_assets.mjs` are build-blocking
  guards, described in the next section.
- `tools/check_filters.mjs` fails the deploy if the kid-safe name filter drifts
  between the client and the two leaderboard backends.
- `tools/patch_*.mjs` apply targeted world.json updates (borders, names, features,
  landmarks) without a full rebuild.
- `tools/make_share_html.mjs` packages a build into one self-contained HTML file
  that runs from a double-click, with the map and heightfield inlined.

**CI.** Three GitHub Actions workflows. `deploy.yml` runs on every push to
`source`: filter check, `npm run build:all`, rsync into a checkout of `main`,
commit and push, and GitHub Pages serves it. `build-world.yml` runs the whole map
pipeline for named towns on a GitHub runner and pushes just the baked artifacts to a
`map-data` branch. `fetch-data.yml` does boundaries only. Both exist because
Overpass is blocked from cloud agent sessions and phones, so this is how a new town
gets baked without a laptop.

---

## 6. How towns are structured: the answer to the main question

**A new town is data-driven, not hardcoded.** The engine genuinely does not know
any town's name. Everything town-specific lives in exactly four files plus a
payload directory:

```
towns/<id>/town.json        identity, geodesy, branding, storage policy, spawn
towns/<id>/map.mjs          map curation: landmarks, spot fixes, hand-added features, QA
towns/<id>/public/          the built payload: world.json, heights.bin, manifest, og-image
src/towns/<id>/index.ts     the TownPack: gameplay anchors, atmosphere, theme, copy
src/towns/<id>/courses.ts   the race ladder
```

Selection is by environment variable. `TOWN=salem vite` makes Vite alias `@town` to
`src/towns/salem`, load `towns/salem/town.json` for branding token substitution,
serve `towns/salem/public/` over the shared `public/`, and emit to `dist-salem`.
Engine code writes `import { TOWN } from '@town'` and reads fields off it.

**`town.json` is the schema.** Roughly 40 fields, all data:

- Identity: `id`, `name`, `worldName`, `title`, `tag`, `emoji`, `path`
- Geodesy: `pxPerMeter` (8), `origin` lat/lon (becomes world 0,0), `bbox`
  (S/W/N/E, the town plus its natural frame), optional `mPerDegLat` / `mPerDegLon`
  pins. If the pins are omitted the loader derives degree lengths from the origin
  latitude with a standard meridian-arc series; you pin them only after a world has
  shipped, so rebuilds stay byte-stable.
- `spawn`: `{ landmark, dx, dz }`
- `branding`: 17 fields covering HTML title, theme colors, description, the whole
  Open Graph and Twitter card, and the loading-screen copy
- Storage: `savePrefix`, `storageSeeds`, `storageSeedIfUnset`

**`TownPack` in `src/towns/types.ts` is the second schema**, and it is well
documented in-file. Required: id/name/title/tag/emoji/path, `story`, `spawn`,
`flight` (boarding point, heading, zone, three lines of copy), `beachX`,
`sledLane`, `trainPlatform`, `holidayTree`, `attractions` (frogPond, sledHill,
graveyard, each nullable), `fall` atmosphere, `halloween` mode, `halloweenDisplay`,
`courses`, `raceTown`, `devCourse`, `racePromo`, `theme` (8 CSS color tokens), and
four strings of copy. Optional: `history`, `shingleZones`, `masonryMix`,
`glassMix`, `bayWindows`, `landmarkTops`, `heavyOnMobile`, `borderLore`.

Every one of those optional fields exists because a specific town broke a default:
`shingleZones` because Rockport's gray fishing village was being painted from
Newburyport's clapboard palette; `masonryMix` and `glassMix` because Boston
rendered entirely in brick red; `bayWindows` because the Boston three-decker bay is
absent from every North Shore town; `landmarkTops` because arriving at the Citgo
Sign framed its host building and cut the sign off. That pattern is the healthiest
thing about the architecture: town-specific behavior became a numeric knob in a
typed schema instead of a branch in the engine.

**Two build-blocking guards enforce the contract.**

`check_town_spawn.mjs` fails the build if any town's `spawn.landmark` is missing,
names a landmark that is not in that town's built `world.json`, or nudges more than
500 px beyond the landmark's own radius. The reason is documented: Beverly once
shipped dropping players a mile out at Lynch Park instead of downtown. The design
rule is that a town's drop point must be a named, celebrated place, so the config
names a landmark rather than a coordinate.

`check_town_assets.mjs` fails the build if two towns have byte-identical og-images,
because Beverly once launched with Salem's photo on its share cards.

**The rules that keep it scalable** (from `docs/TOWNS.md`, and they hold up in the
code): engine changes land once; if you are typing a town's name inside `src/`
outside `src/towns/`, it belongs in the pack; curation is data, never edits to the
generated `world.json`; saves are namespaced per town; `story: false` is a real
shippable product; the leaderboard is already multi-town.

**The residual hardcoding, honestly.** I looked for it specifically. What is left:

1. `src/game/Game.ts` line ~660: the number-key quick-travel list is a literal array
   of Newburyport landmark ids (`market-square`, `boardwalk`, `frog-pond`, ...).
   Keys 1 through 9 do nothing useful in the other eleven towns.
2. `src/game/hud.ts` line ~1386: the mode-picker body text says "This is a living
   model of Newburyport." Only reachable in story mode, so effectively dead.
3. `src/game/hud.ts` line ~2059 and ~2493: two strings referencing Gram's story and
   "Newburyport" in a history card path. Same story-mode caveat.
4. `src/game/eggs.ts`, `quest.ts`, `interiors.ts`, `tunnel.ts`, `gillis.ts`: about
   4,600 lines of Newburyport-specific content with hardcoded coordinates. Cleanly
   gated, never loaded for other towns, but living in `src/game/` rather than
   `src/towns/nbpt/`.
5. `src/game/hud.ts` has a hand-written emoji mapping table with entries tuned for
   specific towns (witch for Salem, whale for Gloucester).
6. `src/three/decor.ts` `HEROES` mixes all towns' hand-modeled buildings in one
   dictionary. Correct by construction (OSM names are unique) but it means the
   Boston hero code ships in the Rockport bundle.

None of this blocks a new town. Items 1 and 6 are the only ones I would fix before
forking.

---

## 7. What it actually takes to add a town today

The documented checklist in `docs/TOWNS.md`, cross-checked against the tooling and
against the handoff notes for the towns that were actually added this way:

1. **Write `towns/<id>/town.json`.** Copy Salem's, set origin, bbox, path,
   savePrefix, branding. About 40 fields, maybe 30 minutes including picking colors.
2. **Write `towns/<id>/map.mjs` with everything empty.** Rockport's is 84 lines and
   is almost all landmark data. You can bake with `landmarks()` returning `[]`.
3. **Bake the map.** Locally `TOWN=<id> npm run map` (Overpass fetch, world build,
   terrain). From a cloud session or phone, trigger the `build-world.yml` workflow
   with the town id and a branch ref, then `git fetch origin map-data` and check out
   the two payload files. Boston needed `OSM_TILES=6x6 OSM_DELAY=5000` and a 12 GB
   Node heap; a normal town is a single query.
4. **Curate landmarks** with `TOWN=<id> node tools/landmark_candidates.mjs`, which
   prints boundary-checked, interior-point coordinates for named real features.
   Paste the winners into `map.mjs`, re-bake (landmarks live in world.json).
5. **Pick the heart** and set `spawn.landmark` in `town.json`. The guard enforces it.
6. **Write `src/towns/<id>/index.ts`.** Copy Rockport's, which is 90 lines. Set
   `story: false`, the flight site, the theme colors, the attraction anchors, the
   copy. Empty `courses` is fine.
7. **Register:** one import line in `src/towns/registry.ts`, and a `TOWN=<id> vite
   build && mv dist-<id> dist/<id>` link in the `build:all` chain in `package.json`.
8. **Assets:** a `manifest.webmanifest` and a unique 1200x630 og-image captured
   in-game (the guard checks it).
9. **Borders:** run `fetch-data.yml` for `boundaries.json`, then
   `TOWN=<id> node tools/patch_borders.mjs`. This produces the entering-town banners
   and roadside welcome signs.
10. **Optional polish, indefinitely:** race courses via `make_course.mjs`, hero
    buildings in `HEROES`, `borderLore` lines, and a history collection.

**Real cost.** The docs say steps 1 through 5 are an afternoon. The handoff notes
back that up with evidence: two towns (Ipswich and Gloucester) went from empty
folder to live in one session, and Marblehead went empty to shipped in one cloud
session. Manchester and Rockport were both authored, baked and shipped in one
session. Those are the strongest data points in the repo, and they are consistent
across five separate handoff write-ups. I did not run the pipeline myself, so I
cannot independently confirm wall-clock time.

**Frictions that remain, ranked by how much they would cost you:**

- **`build:all` is a hand-maintained shell string.** Adding a town means editing a
  single 1,400-character npm script with twelve repeated `build && rm -rf && mv`
  triples. It should be a loop over `towns/`. This is the most obviously mechanical
  thing left.
- **`registry.ts` is a hand-maintained import list.** Twelve static imports plus a
  twelve-element array. Vite supports glob imports; this could be one line.
- **An ordering trap that is documented and real:** `check_town_spawn.mjs` walks
  every folder in `towns/`, so a half-built town folder on `source` fails the build
  for all twelve towns. New towns have to be authored on a feature branch and land
  config plus payload in one commit.
- **Overpass is unreachable from cloud sessions** (403 at the agent proxy), which is
  the entire reason `build-world.yml` exists. Fine, but it means the fast path is
  "trigger CI and wait" rather than "run a script."
- **`fetch_heights.mjs` needs the `duckdb` CLI** to query Overture GeoParquet on S3
  for real building heights. Without it a town's buildings fall back to guessed
  storey counts. Five of twelve towns have no `heights.json` committed.
- **Raw source data is not committed for every town.** `overpass.json` exists for
  six of twelve (Boston's is gitignored at 240 MB); `heights.json` for seven;
  `boundaries.json` for eleven (Beverly has none). A full local re-bake of, say,
  Salem requires re-fetching from Overpass first.
- **The repo carries its payloads.** 391 MB checked out, including 28 MB of terrain
  PNG tiles and every town's built `world.json` and `heights.bin`. Boston alone is
  64 MB of committed binary payload. This will keep growing linearly with towns.

**What is not automated but should be, if towns are the growth engine:** landmark
curation (still a human picking from a candidate list), history markers (entirely
hand-authored from research dossiers with citations), hero buildings, and the
og-image screenshot.

---

## 8. What state is saved

All state is `localStorage`. There is no account system, no server-side player
state, and no cookies. Two mechanisms:

**Per-town namespacing.** All towns share the clippertown.io origin and would
therefore share one localStorage. `vite.config.ts` generates an inline boot script
from `town.json`'s `savePrefix` that shadows `window.localStorage` with a shim
prefixing every key. Three keys are deliberately global and pass through
unprefixed: `nbpt-race-name`, `nbpt-ghost`, `nbpt-board-url`. A kid types their
rider name once and it follows them between towns. Newburyport keeps its historical
unprefixed keys because real players already have populated collections that a
rename would silently wipe.

**What is stored**

| Key | Meaning |
|---|---|
| `nbpt-resume-pos` | last position, so a refresh resumes where you stood |
| `nbpt-history-read` | the set of discovered history markers |
| `nbpt-shot-<id>` | one discovery photo per marker, as a data URL |
| `nbpt-historian` | all markers found |
| `nbpt-eggs-found`, `nbpt-eggs-finale` | easter egg progress |
| `<raceTown>-race-<course>-board` | cached leaderboard rows |
| `<raceTown>-race-<course>-ghost-<name>` | ghost polyline per rider per course |
| `nbpt-race-name`, `nbpt-ghost` | global: rider name, ghost on/off |
| `nbpt-season`, `nbpt-seasons-rewarded` | season pick and its unlock |
| `nbpt-sound`, `nbpt-music`, `nbpt-run-tip`, `nbpt-welcomed`, `nbpt-obj-min` | preferences and one-time toasts |
| `nbpt-bike`, `nbpt-kayak`, `nbpt-l2`, `nbpt-story` | unlocks and mode |
| `nbpt-ch*-step`, `nbpt-ch*-*` | the dormant chapter spine's progress |
| `nbpt-alive`, `nbpt-last-crash` | the mobile crash sentinel and post-mortem |

New towns seed `nbpt-bike`, `nbpt-kayak` and `nbpt-seasons-rewarded` to 1 via
`storageSeeds`, so sandbox towns start with vehicles and the season picker already
unlocked, and seed a default season via `storageSeedIfUnset`.

**The one server-side thing** is the leaderboard. `infra/leaderboard/` ships two
interchangeable backends speaking the same protocol: a Google Apps Script that
writes to a Sheet in your Drive (moderation is deleting a row), and a Cloudflare
Worker over KV. The client posts `{town, course, name, time}` as `text/plain` to
dodge CORS preflights. Names are re-validated server-side with the same kid-safe
filter as the client, and `check_filters.mjs` fails the deploy if the three copies
drift. The live URL is a hardcoded Apps Script `/exec` constant in `race.ts`, with a
`nbpt-board-url` localStorage override for testing.

Photos are worth calling out as a design decision. Discovery photos are stored one
key per marker rather than one JSON blob, so a quota failure costs one photo instead
of the whole album, and writing the 30th photo does not re-serialize the other 29.
That level of care is characteristic of this codebase.

---

## 9. Deploy and operations

- `source` is the editable branch. `main` is generated output that GitHub Pages
  serves. `npm run deploy` refuses to run from any branch but `source`.
- Push to `source` triggers CI, which builds all twelve towns from that one commit
  and rsyncs into `main`. Every town ships from the same commit, so engine fixes
  cannot drift between towns. This was a deliberate fix: Salem originally shipped
  from a hard fork with a committed bundle and every engine change had to be
  hand-ported.
- Each build stamps its commit sha into `window.__build`, and the service worker
  registration URL carries the stamp, so each deploy refreshes the offline cache
  exactly once. A deploy landing mid-session offers a tap-to-reload toast.
- `public/CNAME` must survive, because deploy uses `rsync --delete`.
- Scaling ceiling per the handoff: GitHub Pages' roughly 100 GB/month soft cap
  against a roughly 3.7 MB first load, so somewhere near 28,000 unique visitors a
  month, with Cloudflare Pages as the escape hatch. That math is stated in the docs;
  I did not verify current traffic.

---

## 10. What makes it sticky, honestly

**The genuinely strong part is the first 90 seconds.** "Walk the real map of your
town, find your own house" is a complete emotional payload that needs no tutorial,
no account, no download, and no explanation. It works on a shared link. The search
box that accepts "241 High Street" is the entire onboarding. Every piece of
engineering that looks excessive (real fences, real backyard pools, real surveyed
trees, storefront signs on the correct building edge facing the street, gravestones
in every cemetery, the exact 20-meter High Street ridge) serves that one moment,
because the moment only lands if the map survives scrutiny by someone who has lived
there for forty years.

**The second-strongest part is the discovery collection**, and specifically the
photo. Storing the player's own screenshot of the place they walked to converts a
text card into a personal artifact. Cards are cited true local history, not filler.
That is a real retention mechanic and it is the one the codebase has explicitly
chosen as the scalable spine.

**What I do not think is sticky yet, from the code:**

- **Ten of twelve towns have nothing to do.** No history collection, four of them
  no races. They are beautiful sandboxes with one great moment and no second
  session. The engine is far ahead of the content.
- **The content that would make a town sticky is the least automated part.** A
  history collection is 20 to 36 hand-written, hand-sourced, hand-placed cards per
  town. Newburyport's took a research dossier. That does not scale to 50 towns
  without either a different content model or an AI-assisted authoring pipeline.
- **Nothing is social.** The leaderboard is the only shared surface, and it is a
  name and a time. There is no way to leave anything behind for another player, no
  way to see that anyone else has been there, no sharing of your own house.
- **No retention loop.** No reason to come back tomorrow specifically. Seasons
  change on a manual picker, not a calendar.
- **No analytics beyond page counts.** GoatCounter gives visits. Nothing measures
  whether people find their house, how long they stay, or which towns retain.
  Flagging this because "what makes it sticky" is currently an argument from design
  rather than from data, and you have no instrumentation to settle it.

---

## 11. Reusable versus coupled: the fork analysis

**Reusable as-is, high value, low coupling**

| Asset | Lines | Why it travels |
|---|---:|---|
| The OSM to world pipeline (`tools/`) | ~3,300 | Town-agnostic by construction, parameterized only by `town.json` + `map.mjs`. Handles multipolygons, coastline to ocean, height overlays, bridge clearance, boundary baking, QA. This is the crown jewel and it works for any place OSM covers well. |
| `WorldIndex` (`src/world/index.ts`) | 2,763 | Spatial index, painted ground canvas, collision grid, bridge profiles, water queries. Pure data-driven. |
| `Terrain` + `fetch_terrain.mjs` | ~180 | USGS elevation into a compact binary heightfield, bilinear + smoothstep sampling. Drop-in anywhere. |
| Building and scenery generation (`decor.ts` minus HEROES) | ~8,000 | Footprint-accurate massing, gable splitting at concavities with an honest flat-roof fallback, facade rhythm that scales with the building, storefronts, cemeteries, fences, driveways. All derived from map data. |
| Chunk streaming + camera + movement (`Game.ts` core) | ~1,500 of 2,844 | The parts that are not vehicle or story specific. |
| `Sky`, `water`, `textures`, `actors`, `audio` | ~2,300 | Zero town knowledge. |
| The multi-town build system (vite config, `@town` alias, storage shim, guards) | ~250 | The whole one-codebase-N-places pattern, including the two build-blocking contract guards. |
| `life.ts` ambient crowds | 1,168 | Reads the sidewalk and road networks; three nullable per-town anchors. |
| Racing + leaderboard | ~900 + infra | Already partitioned by town key. The backends are 100 lines each and free to run. |
| Mobile hardening (`diag.ts`, dynamic resolution, chunk trimming) | ~400 | Hard-won and not obvious. Keep it. |

**Coupled to Clippertown specifically**

| Asset | Lines | Coupling |
|---|---:|---|
| `quest.ts` | 2,034 | Newburyport story, hardcoded coordinates, hardcoded dialogue. Dormant. |
| `eggs.ts` | 1,457 | Newburyport lore and coordinates. Dormant. |
| `interiors.ts` + `tunnel.ts` + `gillis.ts` | 1,044 | Newburyport set pieces. Dormant. |
| `HEROES` in decor.ts | ~1,900 of 9,929 | 180 named real buildings across 12 towns. Reusable as a *pattern* (name-keyed custom builders), not as content. |
| `hud.ts` | 3,345 | Reusable in shape, but it is a single file mixing CSS, layout, twelve panels, the story chrome, and Clippertown's visual identity. This is where a fork would spend its refactoring budget. |
| Per-town packs and `map.mjs` files | ~4,000 | Content. Keep the schema, discard the values. |
| Content itself: 59 history markers, 24 courses, the research dossiers | n/a | Massachusetts-specific. The *sourcing bar* documented in `docs/research/` is reusable methodology. |

**Coupled to assumptions rather than to Newburyport.** Worth naming because these
are what would bite a fork aimed at a different kind of place:

- **New England visual language.** `style.ts` and `decor.ts` assume painted
  clapboard walls, dark shingle roofs, brick downtowns, colonial palettes. Boston
  needed three new mix knobs to escape it. A Southwest, Midwest, or European town
  would need a real palette and material system, not three more floats.
- **Town scale.** Constants were tuned for towns of 5,000 to 30,000 buildings.
  Boston (233,000) exposed four separate defaults that were silently destroying the
  city: storey counts clamped to 6 in four places (no skyline at all), camera
  building-top clamped to 5, fast-travel stand-off capped at 320 px against a
  2,186 px Fenway footprint, and storefront spacing narrower than its own display
  glass. The lesson recorded in the handoff is worth quoting in spirit: a default
  that is invisible in every case you have tested is not validated, it is untested.
- **OSM data quality.** Newburyport is exceptionally well mapped (3,501 street
  ways, 7,503 buildings, 1,234 sidewalk ways, assessor-imported address tags,
  surveyed trees, mapped backyard pools). Much of the magic depends on that. A
  poorly mapped town yields a much thinner world, and the codebase's honest policy
  is to refuse to invent (Rockport's train station is `null` because OSM does not
  name it; Marblehead's two most famous houses are absent for the same reason).
- **The whole world parses at boot.** Fine to 233,000 buildings on desktop,
  marginal on phones. A denser or larger target than Boston would force the binary
  format the comments keep deferring.

**If I were forking this, the order of operations I would recommend:**

1. Take `tools/`, `src/world/`, `src/three/` (minus HEROES content), the town
   config system, and the guards. That is a complete "render any real place in 3D
   from open data" engine, and it is roughly 15,000 lines of well-commented,
   working, mobile-hardened code.
2. Delete `quest.ts`, `eggs.ts`, `interiors.ts`, `tunnel.ts`, `gillis.ts`, and the
   `story` flag entirely. Nothing ships them today anyway.
3. Rewrite `hud.ts` against whatever your product actually is. Keep the joystick,
   the pinch handling, the safe-area insets, and the search.
4. Replace `build:all` and `registry.ts` with glob-driven loops before you add town
   number thirteen.
5. Decide up front what the second session is, because the engine already delivers
   a great first one and the repo shows ten towns proving that a great first session
   is not enough.

---

## 12. What I could not verify

- **Anything about the live site or its users.** I read the source only. I did not
  load clippertown.io, so current uptime, actual load times on real devices, real
  frame rates, and whether the twelve towns are all reachable are unconfirmed.
  Performance figures quoted above (60 fps / 16 MB heap desktop; Boston's 133 ms
  parse and 97 MB retained) are the repo's own claims.
- **Any usage, retention, or traffic data.** None exists in the repo. The scaling
  ceiling of roughly 28,000 monthly uniques is arithmetic from the docs, not
  measurement.
- **Whether the map pipeline runs today.** I did not execute `fetch-osm`,
  `build-world`, or `fetch-terrain`. Overpass mirrors, the AWS terrain bucket, and
  the Overture S3 release (`2026-06-17.0`) may all have moved since. `fetch_heights`
  additionally depends on a `duckdb` CLI that is not in `package.json`.
- **Git history before 2026-07-13.** This checkout has 58 commits, the oldest dated
  2026-07-13, so the multi-town reunification, the Salem fork retirement, and the
  earlier development described in the handoffs are documented but not visible in
  the log I can read.
- **Handoff document accuracy.** `HANDOFF.md` (103 KB) is partly stale against the
  code. Two examples I confirmed: it says manual buildings live in
  `MANUAL_BUILDINGS` in `build_world.mjs` and that you should hand-edit
  `world.json`, but the current code reads `manualBuildings` from
  `towns/<id>/map.mjs` and the documented rule is now the opposite; and its
  "Starting a new session" section still directs the reader to finish a Level 2
  finale that has since shipped and then been retired. Treat `docs/TOWNS.md` and the
  source as authoritative, and the handoffs as a dated changelog.
- **The `story: true` retirement date and intent.** The code comment says the spine
  was retired from the shipped game on 7/28 and that the decision should not be
  reversed without a discussion. I have the comment; I do not have the discussion.
- **Legal posture.** Attribution requirements are handled in the HUD (OpenStreetMap
  ODbL, MassGIS, Overture, AWS terrain tiles). Whether depicting real named
  businesses, real named private houses, and real people's property at this
  fidelity raises any issue is outside what I can determine from the code, and it is
  worth a real answer before a fork scales this to hundreds of towns.

---

## Appendix: the fastest orientation path for a new engineer

1. `docs/TOWNS.md` (119 lines) for the architecture contract.
2. `src/towns/types.ts` for the town schema, which is the best-commented file in the repo.
3. `towns/rockport/` plus `src/towns/rockport/` as the reference minimal town.
4. `tools/lib/town.mjs` then `tools/build_world.mjs` for the pipeline.
5. `src/world/types.ts` for the data format.
6. `src/game/Game.ts` constructor (lines 315 to 700) for what the runtime wires together.
7. `src/game/history.ts` (215 lines) for the loop that is currently the product.
