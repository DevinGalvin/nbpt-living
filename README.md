# Clipper Town

A cozy, Zelda-like game set on the **exact map of Newburyport, Massachusetts**. Walk, bike, and kayak real streets and waterways; do quests rooted in the city's true history and present-day life. Built so kids love it **and** anyone from Newburyport has a blast — all-ages, never babyish. Mobile (iOS/Android) + desktop/web.

**Live at [clippertown.io](https://clippertown.io).** Three.js + TypeScript + Vite.

**Multi-town (July 2026):** one engine, N real places — Newburyport at `/`, Salem at `/salem/`, and adding a town is config + data, not a fork. See **[docs/TOWNS.md](docs/TOWNS.md)**.

**Status (June 2026):** live and playable — the chapter spine, seasons (summer→fall→winter) with a full day–night cycle, a kid and his dog **Clipper**, 24 hidden secrets, and the city's named landmarks, downtown through Plum Island.

## Working on the game — read this first

This repo has **two branches with different jobs:**

| Branch | Role |
|---|---|
| **`source`** | the real, editable code — **make all changes here** |
| **`main`** | generated build output that GitHub Pages serves at clippertown.io — **never hand-edit it** |

**Golden rule:** edit on `source`, then ship with `npm run deploy` (it rebuilds and pushes the result to `main`). Editing the built files on `main` directly gets wiped on the next deploy. As a safety net, `npm run deploy` refuses to run unless you're on `source`.

> **Using Claude Code on your phone?** Tell the session to work on the **`source`** branch, not `main`. Full run / deploy / architecture notes + gotchas live in **[HANDOFF.md](HANDOFF.md)**.

## Quick start

```bash
git checkout source           # always work here (main is built output)
npm install
npm run dev                   # http://localhost:5173 (hot reload)
npm run build                 # typecheck + production build → dist/
npm run deploy                # build + publish to clippertown.io (~30-60s)

# Refreshing the map data (rare — regenerates towns/<id>/public/world.json):
npm run map                   # fetch OSM + rebuild world.json + terrain (safe to re-run:
                              # hand-added data lives in towns/<id>/map.mjs and is re-applied)
TOWN=salem npm run map        # same, for any other town — see docs/TOWNS.md
```

**Controls:** WASD/arrows to run (camera-relative), Shift to sprint, **C toggles chase camera ⇄ north-up map view**, **M (or the 🗺 button) opens the fast-travel map** — all 24 landmarks, tap to teleport with a fade — mouse wheel zooms, number keys 1–9 quick-travel favorites. A compass sits top-right. Touch: floating joystick + second finger to sprint. Debug console hooks: `nbpt.travel(id)`, `nbpt.walk(dx,dy,ms)`, `nbpt.zoom(z)`, `nbpt.landmarks`.

The town is alive: 22 pedestrians wander the sidewalks, 5 stray dogs roam, and 10 cars drive the streets right-hand-side (`src/game/life.ts` — everything recycles near the player). Street furniture: lantern street lamps, zebra crosswalks, white picket fences along front yards, benches, and railed boardwalk decks.

**The town keeps secrets** (`src/game/eggs.ts`): 24 hidden easter eggs with **no beacons, no glints, no objectives** — the travel panel only starts counting (`✦ Secrets found`) after the first one. All rooted in true lore at exact spots: the **eight scattered Dexter statues** (the real 1815 gale; recover all eight and they're restored on columns at 201 High Street), the **1817 sea serpent** (stand very still off Plum Island Point), the **Paul Revere bell** at Old South, the **Flying Fish** flyover on the real 14/32 grass strip, Dexter's unpunctuated *Pickle for the Knowing Ones* with its pepper-and-salt punctuation page, the mooncusser's lantern, purple garnet sand, Frog Pond frogs (asleep in winter), the Inn Street fountain coin toss, Fowle's neon, a Richdale slushie, Bossy's drawbridge, the MBTA PA, **MARCO at any of the 68 real backyard pools**, petting Clipper, the Konami code (golden hoodie — 7 compass taps on touch), and `xyzzy` in the travel search (the developers' base camp on Carr Island). Find all 24: fireworks over the harbor + **Town Legend**. Found state persists in `nbpt-eggs-found`; eggs always defer to quest beats and history markers for the talk button.

Ground surfaces carry two texture layers: world-space painted patterns (asphalt aggregate/cracks/patches, granular concrete, mottled turf, footprints on the beach) plus a tiled micro-detail grain multiplied over everything in the shader (`detailInject` in Game.ts) so the ground stays textured at any camera distance.

## How it's built

- `tools/fetch_osm.mjs` — pulls raw OSM for the v1 slice bbox (ways clipped, relations with full geometry) from Overpass mirrors.
- `tools/build_world.mjs` — projects to game space (8 px = 1 m, origin at Market Square), classifies features, assembles multipolygons (the Merrimack is a 13 km² ring with 22 island holes), builds the ocean from the coastline, bakes curated landmarks; QA-checks known distances (Market Sq→MBTA = 1.62 km).
- `src/world/index.ts` — spatial index; paints 768px ground-map chunks to canvas (roads with centerlines, crosswalks, water with shorelines, marsh ticks, rail ties, boardwalk planks, street-name labels painted on the pavement); bakes collision from the same geometry (water blocks, marsh slows, bridges/boardwalks unblock); deterministic tree placement.
- `src/three/decor.ts` — one merged mesh per chunk with **five textured material groups** (`src/three/textures.ts`: procedural clapboard siding, real brick coursing, shingle tabs, deck planks): buildings on their exact footprints with gabled shingle roofs (OBB-fit), clapboard walls, windows with trim **and shutters**, front doors, brick chimneys, white fascia/corner boards, Federal cornices on the brick blocks, churches with steeples, the lighthouse, raised bridge decks with railings, dock platforms, and double-blob trees. Colors follow the real Newburyport palette (white/cream colonials, historic sage/wedgewood/yellow, Essex-green and black shutters).
- **Real-time sun shadows** (PCFSoft, follows the player; `shadowSide=DoubleSide` because walls are open quads — and remember `shadow.camera.updateProjectionMatrix()` after resizing the frustum) + hemisphere/sun light balance (0.5/1.5 — a strong hemisphere drowns shadows).
- **Street-level details:** concrete sidewalks with curbs and expansion joints (OSM `footway=sidewalk` → class `side`), painted gravel **driveways** to the nearest road with **parked cars** in half of them, **storefront ground floors** on commercial blocks (display glass, canvas awnings, sign bands), tree **species** (pines + layered deciduous, never on pavement), and a **Plum Island beach zone** east of x=29000: weathered cedar-shake cottages, dune grass, beach umbrellas and towels.
- Gotcha for future mesh work: triangulated horizontal caps must wind counter-clockwise as seen from above, or DoubleSide flips their normals down and they render lit-from-below (dark olive).
- **Real topography:** `tools/fetch_terrain.mjs` pulls USGS-derived elevation (AWS Terrain Tiles, public) into `towns/<id>/public/heights.bin`; `src/world/terrain.ts` samples it bilinearly. The ground is a displaced grid with analytic normals, buildings bury their walls into slopes, bridges span from the higher bank, and the player/camera ride the heightfield — High Street really is a 20m ridge and March's Hill really drops.
- **Real stores:** OSM POI nodes (Richdale, Oregano's, The Book Rack, Dunkin', Agave…) become canvas-texture signboards mounted on the correct building edge facing the street (`shopSignsFor`).
- **Real micro-data:** 47 actual backyard swimming pools (rendered with deck rims, exactly where they are), 475 real property-line barriers (stockade fences / hedges / stone walls — they also block movement), 448 surveyed driveways, and 1,334 real tree positions that take priority over procedural planting. Synthetic fences/driveways only fill in where nothing is mapped.
- **Real roof massing:** every building extrudes from its exact footprint, and L/T-shaped houses are split at their concavities (`complexGable`) into up to three correctly-oriented gable wings — ells look like ells. When a sparse footprint won't split honestly (zigzag condo rows, big-box stores tagged as houses), the OBB-gable fallback is refused — by ratio (fill < 0.55) or absolute overhang (> 90 m² of phantom roof) — and the building gets a flat roof + parapet on its **exact outline** instead, which by construction can never roof a street. This was the "massive building blocking the road" class of bug: the footprint never covered the road; its bounding-box gable did.
- **Windows scale with the building, not a constant** (`facades` in decor.ts): every wall gets glass at a steady ~3 m rhythm regardless of footprint size — the budget derives from perimeter × rows, and if a footprint is absurdly large the rhythm stretches uniformly instead of leaving later walls blank. Institutional-length walls (≥ 280 px) get their own entrance. Hero buildings may still pass an explicit `maxWinOverride`, but no building *needs* one to be fully dressed — schools render as schools in any town we load.
- **Overpasses guarantee clearance by construction** (`bridgeProfile` in world/index.ts): every bridge deck spans bank-to-bank at the higher approach +6 as before, but wherever another road or path genuinely crosses beneath (segment intersection, excluding junctions at either way's ends), the deck lifts locally to ground + 46 px (kid 33 + bike 7.5 + margin) and ramps back down within 150 px. Ends stay pinned to the approach grade so decks stay mountable. Decks are *ridden*, never teleported onto: `surfaceYAt(x, y, prevY)` only adopts a deck within step range of where you already are, so the kid, Clipper, pedestrians, and cars all pass underneath at ground level (lamps too). Both rules are derived purely from map data + terrain — auditable in one pass (43 bridges, 20 previously-deficient crossings, all now ≥ 46) and valid for any town, not just Newburyport.
- **92 real businesses** signposted (nodes + businesses tagged on building shapes, deduped). OSM covers roughly half of the real storefronts; the completionist path is Overture Places (needs parquet tooling) or hand-curation.
- **Street life details:** street trees along neighborhood roads, foundation bushes and yard trees per house, denser commercial window grids and up-to-three storefront frontages with awnings.
- **Cemeteries are full of gravestones**: every `cemetery` polygon (all 14, Old Hill to St. Mary's) fills with deterministic slate tablets, capped shoulders, table tombs, and the odd obelisk, facing the grounds' own OBB grain with jitter — internal walks and lanes stay stone-free, multi-chunk grounds never double-place (`gravestones` via `scatterInPoly` in decor.ts), and it works for any town's data.
- **Camera collision pass**: the chase camera samples its sight line against building footprints + eave heights (`buildingTopAt`) every frame and glides in just short of the first wall that would swallow the view — down to an over-the-shoulder shot when you stand against a building. Two consecutive blocked samples are required so corner grazes don't twitch the camera, and the look-target eases onto the kid as it pulls in. Analytic (no raycasts against merged meshes), so it costs ~20 grid lookups a frame and works in any town.
- Known quirks queued: unnamed OSM service ways can surface as "Way N" in the street pill.
- `src/three/water.ts` — one animated water surface for the whole map: real water polygons (island holes included) with a rippling noise shader, drifting sun glints, and transparent shallow edges; flows under the bridge decks.
- Ground is textured, not flat: stippled multi-tone turf with grass blades, grainy sand with ripple lines, brick-coursed plazas, asphalt noise (`terrainFill` patterns in `src/world/index.ts`).
- `src/three/actors.ts` — blocky Crossy-Road-style kid (crimson hoodie, real run cycle: lean, arm pump, leg scissor, bounce) and a golden dog that heels, trots in diagonal pairs, and wags when you stop.
- `src/game/Game.ts` — Three.js scene, tilted chase camera with distance fog, chunk streaming/eviction, movement + collision, fast travel; `src/game/hud.ts` — DOM HUD (street pill, landmark banners, joystick).

Verified: 60 fps, 16 MB heap, zero console errors (desktop browser).

## Docs

| Doc | What's in it |
|---|---|
| [docs/GAME_CONCEPT.md](docs/GAME_CONCEPT.md) | The game: pitch, pillars, three gameplay layers, tools/map gates, event calendar, quest bank, v1 slice, open questions |
| [docs/research/history.md](docs/research/history.md) | Deep history dossier: founding, clipper era, Coast Guard birthplace, Great Fire, Lord Timothy Dexter, legends (real tunnels!), 20 quest hooks |
| [docs/research/modern-newburyport.md](docs/research/modern-newburyport.md) | Present-day city (verified 2025–26): downtown, parks, Plum Island, events, kid life, food landmarks, 20 quest hooks |
| [docs/research/map-data.md](docs/research/map-data.md) | Exact geography (streets, districts, 20 anchor coordinates) + the data pipeline: OSM relation 2385554, MassGIS, osmium/GeoJSON, projection, ODbL licensing |
| [docs/research/tech-stack.md](docs/research/tech-stack.md) | Engine comparison → **Phaser 4 + TypeScript + Capacitor 8**; OSM→tilemap rendering approach; performance; kid-game mechanics research; COPPA/Kids Category shipping |

## The exact-map plan (TL;DR)

OpenStreetMap has Newburyport mapped to an exceptional standard (3,501 street ways, 7,503 building footprints, 1,234 sidewalk ways). Pipeline: **Geofabrik Massachusetts extract → osmium clip to the city polygon → Python preprocessor → 1m-grid autotiled chunked tilemap (Tiled-compatible) → Phaser**, with MassGIS public-domain parcels/LiDAR/orthos as supplements and 20 surveyed anchor coordinates as the exactness QA harness.

**Required attribution:** Map data © OpenStreetMap contributors (ODbL) — openstreetmap.org/copyright. Additional data courtesy of MassGIS, Commonwealth of Massachusetts EOTSS.

## Status

Long past a prototype — the game is **live at [clippertown.io](https://clippertown.io)** with the chapter spine, seasons, the day–night cycle, and the whole town. Current state, the deploy workflow, and gotchas are in **[HANDOFF.md](HANDOFF.md)**.
