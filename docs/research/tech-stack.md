# Tech Stack & Game Design Research

*Researched 2026-06-11 for NBPT Living: 2D top-down kids' Zelda-like on the exact map of Newburyport, shipping mobile (iOS/Android) + desktop/web. Engine/store facts verified June 2026.*

## 1. ENGINE CHOICE

| Engine | Status (June 2026) | Web export | iOS/Android | Cost | Risk notes |
|---|---|---|---|---|---|
| **Phaser 4** | v4.0 "Caladan" shipped April 2026; v4.1 current; new WebGL renderer, keeps v3 API | Native — web IS the platform | Via **Capacitor 8** (official Phaser tutorial; Vampire Survivors mobile shipped this way) | Free, MIT | v4 renderer is young (v3.90 fallback exists); no built-in scene editor |
| **Godot 4.6.x** | 4.6.3 stable | WebGL2/wasm fine on desktop browsers; **iOS Safari/mobile-web is the weak leg** (crash/reload reports through 4.4/4.5) | First-class native | Free, MIT | Web-on-mobile risky; TileMap needs manual chunking |
| **Unity 6.x** | Runtime fee cancelled (Sept 2024); Personal free to $200k revenue | Mobile-browser support new; WebGPU experimental | Excellent | Free < $200k | Heavyweight for pixel 2D; Kids-category privacy diligence; org churn |
| **Defold** | Active, free | Excellent, tiny builds (~1MB engine) | First-class | Free | Lua; small community; fixed tilemap bounds awkward for generated worlds |
| **Kaplay / Excalibur** | Active | Native | Wrap yourself | Free | Too small a bus factor for a multi-year project |

### Recommendation: **Phaser 4 (TypeScript) + Capacitor 8** — runner-up Godot 4.6

- **The web build is the dev/demo loop AND a shipping target.** Phaser's web build is the product — instant playtest links for local kids/parents. Godot's web export on iOS Safari is still demonstrably unstable, which kills "send a link to a parent's iPhone."
- **The world comes from a data pipeline, not hand-painting** — Godot/Unity's scene-editor advantage is mostly neutralized; Tiled covers hand-edited patches.
- **Tilemap perf solved in-engine:** Phaser 4's `TilemapGPULayer` renders a layer as a single quad — "up to 4096×4096 tiles with no performance penalty." The downtown core fits in ONE layer per depth.
- One TypeScript codebase → browser (desktop+mobile), iOS + Android via Capacitor (real store apps), desktop via web or Tauri/Electron for Steam later.
- Free/MIT; 13+ years of history; Phaser Studio behind it. Mitigation for v4 freshness: pin versions; v3.90 fallback.
- **Pick Godot instead only if** an integrated editor is non-negotiable — and then drop mobile-web.

## 2. RENDERING A REAL CITY WITH CHARM

### Prior art
- **NIMBY Rails** — whole-planet OSM; ingests `.osm.pbf` → custom binary vector DB offline. Lesson: never parse OSM at runtime.
- **A/B Street** — open-source top-down sim of real streets from OSM; readable importer.
- **Infection Free Zone, 911 Operator, City Bus Manager** — commercial games generating playable cities from OSM.
- **Mapbox Unity SDK — dormant; avoid.** **osm2world** — 3D, wrong output.
- **No production OSM→Tiled converter exists** — successful real-map games write a custom importer (~1–2k LOC). Plan for it.

### Approach comparison
- **(a) Rasterize to tile grid:** OSM centerlines → buffered lines on a 1m grid → bitmask **autotiling** (47-blob) for roads/sidewalks/water/sand; building footprints → filled tile blocks with procedural facades. Looks like Zelda, trivial collision, perf solved. Diagonals get slightly staircase-y (acceptable; the downtown grid helps).
- **(b) Stylized vector polygons:** preserves exact geometry but reads as "map app," not "game world"; collision/depth/charm all harder.
- **(c) Hybrid — RECOMMENDED:** tile-rasterize ALL ground (streets/water/vegetation — the street **network topology** is what makes a local say "that's my street"); buildings two-tier: generic procedural row-house/storefront tile-kits stamped into real footprints (correct size/orientation/position) + **~30 hand-crafted multi-tile landmark sprites** at exact footprints. **"Exactly my street" = correct street graph + correct landmark anchors** — nobody recognizes their house by its roof tiles; they recognize the corner it sits on.

### Concrete pipeline (integration point)
1. **Extract:** Geofabrik MA / Overpass → clip to Newburyport polygon.
2. **Offline Python preprocessor** (pyrosm/osmnx + shapely + numpy): project to meters, snap to 1m grid; classify highways → buffer to width; polygons for water/marsh/sand/grass; building footprints w/ levels tags; POIs → object layer.
3. **Emit:** chunked tile arrays (Uint16 per layer) in **Tiled-compatible chunk format** (.tmj) so maps open in Tiled for hand-editing; a hand-authored **"patch layer" wins over generated tiles** (landmark detailing, hiding collectibles).
4. Re-running the generator preserves patches (patch layer keyed by world coords).

**ODbL:** rendered map = Produced Work (game licensed however we like) + visible "© OpenStreetMap contributors" attribution; the converted tile database = derivative database → make available on request (publishing the generator repo satisfies this).

## 3. WORLD SIZE & PERFORMANCE

- Scale at 1 tile = 1m: downtown core 3000×3000 = 9M cells; full 11km strip ≈ 44M (mostly water/marsh — compresses with chunking + per-chunk default tile).
- **Chunking:** 256×256-tile chunks (Uint16Array = 131KB/layer/chunk); 3×3 chunk window resident (~3.5MB for 3 layers) — trivial. `TilemapGPULayer` can even hold a whole 3000×3000 district (4096² ceiling) for v1, add streaming later.
- **Collision:** do NOT make per-tile physics bodies — pipeline-time greedy-merged AABBs per chunk, or pure grid lookup. (#1 mobile tilemap perf trap.)
- **Objects/NPCs:** spatial hash; update only within ~1.5 screens; pool sprites.
- **Memory (mobile WebView):** target < 300MB; textures dominate — cap atlases at 2048², 2–4 atlases. Download < 200MB.
- **Districts:** ~7 logical districts (Downtown/Waterfront, South End/Joppa, North End, Ridge, West Woods, Common Pasture/Station, Plum Island + refuge). **Seamless chunk-streaming, no loading screens** — the Plum Island Turnpike causeway and bridges are natural 1-road corridors for invisible prefetch.
- If Godot instead: manual chunked TileMapLayers via `set_cell` around the camera (known perf issue with giant TileMaps, no built-in chunking).

## 4. KID-FRIENDLY MECHANICS (reference teardowns)

- **Sneaky Sasquatch** (closest analog): town map of zones; **jobs as minigames** earn coins; coins buy **disguises** (role access) and **vehicles** (traversal); golf/fishing/ski minigames; zone access gated by purchases/permits/story. Sessions 5–20 min. THE template for "town as playground."
- **Alba: A Wildlife Adventure** (second-closest): island; phone-camera **photo-ID of 62 species** as core verb; litter cleanup, repairs, rescues; world visibly heals; zero fail states. Maps 1:1 onto Parker River refuge + downtown.
- **A Short Hike:** collectible-gated traversal (golden feathers = our bike/kayak/tools); one-exchange NPC quests; "summit goal, everything optional."
- **Lil Gator Game:** befriend-kids quests; **cardboard-cutout monsters you whack — non-violent combat solved**; kid-logic writing.
- **Haven Park:** build/repair campsites as progression beacons; caution: quest variety.
- **Mineko's Night Market:** weekly rhythm → Saturday market event. Steal the weekly heartbeat; never add stamina grind.

### Ranked v1 mechanics (value ÷ build cost, ages 6–12)
1. **Free-roam + landmark "passport"** — stamp for each of ~30 real landmarks. Cheapest mechanic, maximally leverages the real map.
2. **NPC dialogue + fetch/delivery quests** — one- and two-step only; icon-led quest log (pre-readers).
3. **Collectibles** — ~60 hidden sand dollars/clams placed street-by-street.
4. **Tool-gated traversal (the Zelda spine):** bike (speed/rail trail), **kayak** (cross the basin/marsh creeks — the map IS the gate), binoculars (bird spotting), metal detector (beach digs), fishing rod (docks). Each tool opens real geography.
5. **Bird/wildlife spotting log** (Alba-lite) — Parker River NWR is nationally famous birding; v1 = binocular spot-&-log, 20 species.
6. **Non-violent hazards:** greenhead flies in the July marsh (dodge/swat), seagulls stealing fried clams (chase), rising tide on sandbars (gentle timer). Lil-Gator rule: nothing dies, worst case you're plopped back on the path.
7. **Day/night + NPC schedules in v1; seasons v2** (greenheads in summer, Frog Pond skating in winter, festival weeks).
8. **Save system:** silent autosave on every quest step/zone change/background; instant resume; multiple profiles (siblings); sessions complete-able in 5–15 min.
9. *(v2)* Jobs-as-minigames (ice-cream scooping, lobster hauling); craft/market loop (Sunday farmers market).

## 5. CONTROLS

- **Mobile:** **floating virtual joystick** (spawns at first touch, handedness-free) + ONE context-sensitive action button; **tap-to-interact** on NPCs/signs. Tap-to-move as a settings toggle (accessibility), not default — joystick gives the continuous "steering my guy" feel and tap-to-move fights kayak/bike steering.
- **Desktop/web:** WASD + arrows simultaneously, Space/E interact, full Gamepad API. Auto-camera with look-ahead; no camera control anywhere.
- Hit targets ≥ 44pt; no holds/double-taps for core verbs.

## 6. ART PIPELINE

- **16px tiles, rendered at 3× integer scale** (48 screen px → ~25 tiles across a phone). 16 over 32: 2× more world visible (a city wants vistas), ~4× cheaper per tile to produce, and the best modern-town packs are 16px.
- **Prototype (CC0):** **Kenney RPG Urban Pack** (480+ modern-town 16px tiles, roads, vehicles, buildings + 6 animated characters); Kenney Tiny Town/Roguelike packs. CC0 = shippable.
- **Production:** **LimeZu "Modern Exteriors/Interiors"** 16×16 mega-sets (~$10–20, commercial OK) + custom Aseprite work.
- **Aseprite workflow:** one locked 32–48 color palette across all sets (re-palette purchased art to unify); 47-blob autotile terrains (road, sidewalk, sand, water, marsh) consumed by the pipeline's bitmask pass; CLI export in build script.
- **Buildings:** ~3 modular facade families (Federal brick rowhouse, clapboard colonial, modern storefront) stamped into real footprints + **~30 hand-crafted landmark sprites** (Custom House, Old South & Unitarian steeples, City Hall, Firehouse, Gillis drawbridge, Plum Island Light, Hellcat boardwalk…). Budget: a landmark ≈ 6×8 tiles ≈ a day each → front-load the iconic 10.

## 7. KIDS-CATEGORY SHIPPING

- **COPPA (amended rule fully in force since April 2026):** geolocation/biometrics = personal info; consent rules tightened. **Cleanest posture: collect literally nothing** — no accounts, no analytics SDKs, no ads, local-only saves, no chat. Then COPPA is nearly free.
- **Apple Kids Category (Guideline 1.3):** no third-party ads; no analytics that send PII/IDFA; **parental gate** before external links/purchases; age bands 5-/6–8/9–11. Capacitor-bundled local HTML5 is fine (assets ship in the binary).
- **Google Play Families:** declare child audience; ads only via certified SDKs (moot — none); accurate Data Safety form.
- **2026 state age-verification laws** (TX SB 2420 effective June 2026; UT etc.): app stores age-verify; developers adopt age-range APIs and rate honestly — minimal impact on a no-account game; monitor.
- **Monetization that survives all of the above:** paid-up-front, or free demo + single "unlock full town" IAP behind a parental gate. **No ads, ever** (also a selling point parents search for).
- **PWA vs stores:** web build = dev/demo/playtest loop (itch.io or own domain; school Chromebooks). v1 *distribution* for kids = the app stores (Kids Category/Families browsing, offline car-ride play). Desktop: free web build as marketing; Steam later if demand.

## RECOMMENDED STACK (summary)

- **Engine:** Phaser 4.x (pin 4.1) + Vite. **Language:** TypeScript.
- **Platforms:** Web (dev + demo) → iOS & Android via Capacitor 8 → desktop = web now, Tauri/Steam later.
- **Map pipeline:** offline Python preprocessor (Geofabrik .pbf → pyrosm/shapely → 1m grid in EPSG:26986 → 47-blob autotile bitmask → Tiled-compatible chunked .tmj + POI object layer) → hand-edit patch layer in Tiled → Phaser loads Tiled JSON; 256² chunk streaming; merged-AABB collision baked at pipeline time. "© OpenStreetMap contributors" attribution; publish generator repo for ODbL hygiene.
- **Art:** 16px @ 3× integer scale, unified palette; Kenney CC0 → LimeZu + custom landmarks (iconic 10 first).
- **v1 mechanics:** passport stamps → fetch/delivery quests → collectibles → tool-gated traversal (bike, kayak, binoculars, metal detector, fishing rod) → bird log → seagull/greenhead/tide hazards → day cycle + NPC schedules → silent autosave w/ profiles.
- **Monetization/privacy:** paid or demo+gated IAP; zero data collection.

## REFERENCE GAMES

1. **Sneaky Sasquatch** — steal the town-as-playground economy: jobs → money → vehicles/permits that gate map zones.
2. **Alba: A Wildlife Adventure** — steal the spotting log + cleanup/repair quests that visibly heal the world.
3. **A Short Hike** — steal collectible-gated traversal and one-exchange quests sized for 10-minute sessions.
4. **Lil Gator Game** — steal cardboard-cutout "combat" and kid-logic quest writing.
5. **Mineko's Night Market** — steal the weekly-event heartbeat (Sunday farmers market); skip stamina grind.

## Key sources

[Phaser 4 release](https://gamefromscratch.com/phaser-4-released/) · [Phaser + Capacitor tutorial](https://phaser.io/tutorials/bring-your-phaser-game-to-ios-and-android-with-capacitor) · [Capacitor games guide](https://capacitorjs.com/docs/guides/games) · [Godot 4.6](https://godotengine.org/releases/4.6/) · [Godot web export docs](https://docs.godotengine.org/en/4.6/tutorials/export/exporting_for_web.html) · [Godot iOS-web issues #107390](https://github.com/godotengine/godot/issues/107390) / [#88321](https://github.com/godotengine/godot/issues/88321) · [Unity runtime fee cancellation](https://unity.com/blog/unity-is-canceling-the-runtime-fee) · [Defold](https://defold.com/) · [NIMBY Rails devblog](https://carloscarrasco.com/nimby-rails-august-2023/) · [OSM Games wiki](https://wiki.openstreetmap.org/wiki/Games) · [Mapbox Unity SDK status](https://github.com/mapbox/mapbox-unity-sdk/issues/1912) · [OSMF Licence/Legal FAQ](https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ) · [Godot tilemap perf #72458](https://github.com/godotengine/godot/issues/72458) · [Sneaky Sasquatch](https://en.wikipedia.org/wiki/Sneaky_Sasquatch) · [Alba review](https://indie-hive.com/alba-a-wildlife-adventure/) · [Lil Gator Game](https://entertainium.co/2023/02/19/lil-gator-game/) · [Mineko's Night Market reviews](https://www.pcgamer.com/minekos-night-market-review/) · [Kenney RPG Urban Pack](https://www.kenney.nl/assets/rpg-urban-pack) · [LimeZu Modern Exteriors](https://limezu.itch.io/modernexteriors) · [FTC COPPA final rule](https://www.ftc.gov/news-events/news/press-releases/2025/01/ftc-finalizes-changes-childrens-privacy-rule-limiting-companies-ability-monetize-kids-data) · [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/) · [Play Families policy](https://support.google.com/googleplay/android-developer/answer/9893335) · [Apple age-range API news](https://developer.apple.com/news/?id=2ezb6jhj) · [MDN mobile touch controls](https://developer.mozilla.org/en-US/docs/Games/Techniques/Control_mechanisms/Mobile_touch)