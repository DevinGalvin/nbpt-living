# Clipper-coast towns — session handoff (2026-07-02)

Two live towns share `clippertown.io`: **Newburyport** (root — the authored Zelda-like flagship)
and **Salem** (`/salem` — world-only + ~two dozen researched landmark buildings). This session
shipped a lot to both; **everything below is SHIPPED and LIVE**. Deep background lives in memory:
`salem-world-only-prototype.md` (Salem + multi-town), `nbpt-level2.md` (NBPT story/lighthouse),
`nbpt-living-project.md`, `nbpt-ci-deploy.md`.

## Live state

- **`source` HEAD = `f7c61c4`** (heights → renderer-trust → roofscape → loading pass → progress
  loader, all 7/2-7/3), in sync with origin (CI deploys each push).
  Worktree `salem-experiment` HEAD = `95cc25d` (pushed to origin).
- Live: NBPT root + `/salem` both serving the current build (CI rebuilds the NBPT root on every
  push; Salem serves the committed bundle `public/salem/assets/index-*.js`).
- **Repos:**
  - `/Users/devingalvin/claude_apps/nbpt-living` — main repo, branch **`source`** (the live deploy).
    Holds NBPT source (`src/`) **and** the pre-built Salem bundle (`public/salem/`).
  - `/Users/devingalvin/claude_apps/nbpt-salem` — git **worktree**, branch **`salem-experiment`** =
    the **Salem source code**; node_modules symlinked. **All Salem code edits happen here**, then
    build → bundle → commit to `source`.
- Always-dirty + intentional: `.claude/launch.json` (local dev-server config — **never commit**) and
  `SALEM-HANDOFF.md` (this doc, untracked). Stage explicit paths; never `git add -A`.
- ⚠️ NBPT (root) is **no longer "untouched by Salem"** — this session it got its own source changes
  (restart + lighthouse). Salem deploys still only *add* `public/salem/`, so they don't disturb NBPT.

## Shipped 7/2 (newest first)

1. **Boats float clear + Sofi 4 floors** (worktree `60e4c28`, main `a74ff7d`) — `mooringClear()`
   guard (bow/stern/center on water, off every pier, a hull from neighbours; ring-walk corners
   used to lay hulls across docks) + **`LEVEL_FIXES` in build_world** (point→lv overrides;
   Sofi at Salem Station, the ~430 m² footprint at `(204,-8408)` by the MBTA rail terminus,
   1.5→4). ⚠️ THE TRAP: `addrs` merge same-named streets ACROSS TOWNS — a "Grove Street" lookup
   hit PEABODY's Grove St 14k px away. Anchor fixes to verified geometry, never street names.
2. **Seasonal harbor** (worktree `0d4118a`, main `8560def`, BOTH towns) — Devin's law: summer =
   tons of boats (all sizes, `MOOR_FILL` 82% on EVERY pier + 13 cruisers), fall 30%/5, spring
   20%/3, winter 0 **and the floats come out** (`floatOutForWinter`, |area|<26k px²: deck render +
   footing + steering + collision mask together; Salem 42 floats out / 5 stone wharves stay so
   Derby Wharf keeps its lighthouse + the Friendship).
3. **Seven Gables rebuilt on its true footprint** (worktree `f009a3c`, main `4fa2526`) — the OBB
   mega-gable approach buried the rambling 14-vertex plan under a floating black roof-mountain
   (pines poked through, windows on one face). Now: real walls, triangulated cap, a varied gable
   from every wall ≥55px, `facades()` all round. `firstPeriod` heroes (Witch House/Hathaway/
   Narbonne) got BOTH-face windows + string lights. LESSON: OBB hero builders are only safe on
   convex-ish rectangles — check vertex count first.
4. **Fast-travel place emojis + phone footer** (worktree `7c7f661`, main `38107ba`) — 🗺 cards lead
   with a keyword emoji (🧙 witch trio, ⚓ wharves, 🗼 lights…); `placeEmoji` table is
   DUAL-MAINTAINED with NBPT hud.ts. Phones drop the bottom help line (OSM attribution stays,
   whisper-quiet); corner-text contrast fixed (had the dark-on-dark bug).
5. **NBPT-side same day** (see memory `nbpt-racing-system.md` + `nbpt-onboarding.md`): full kids'
   UX audit → P0 dead-ends pass, racing polish (RACE AGAIN, ghost intro/toggle, name-error text,
   ride-time estimates), little-kids pass (button labels, 🔊 read-aloud, 44px closes), **cloud
   leaderboard LIVE** (Google Apps Script, no new account; board = a Sheet in Devin's Drive),
   pool + white picket fence at 13 Fox Run Drive (`MANUAL_YARDS` + new `picket` barrier kind).
   ⚠️ The NBPT kid-UX wave is NOT yet in the Salem build — branch convergence is an open task
   (racing's `TOWN='nbpt'` const must become per-town first).

## Shipped 6/26 (previous session)

1. **Landmark-building render fix** (`797dd59`) — heroes had dark/invisible windows, z-fighting
   flicker, too few doors. Fixed by routing windows/doors through the shared `facades()` renderer;
   trim bands sit proud via new `expandRing()`; festive eave `stringLights()` so heroes glow at
   night like the neighbours. (See **Hero buildings**.)
2. **Town switcher** (`0886e6b`) — "EXPLORE ANOTHER TOWN" chips atop the 🗺 Fast-Travel panel in
   **both** towns; data-driven, scales to more towns. (See **Town switcher**.)
3. **NBPT flagship: cascading restart + lighthouse toggle** (`0ac0881`, live on `clippertown.io`) —
   Journey-panel restart now cascades (restart a chapter → all later chapters reset) via one ordered
   `Hud.CH_KEYS`; clearer "↻ Replay" / "↻ Replay level" pills. The Rear Range Light is now a walk-up
   **on/off toggle** (persisted `nbpt-beam-on`), not lit forever. Details: memory `nbpt-level2.md`.
4. **Salem season control consistency** (`909152b`) — season picker moved OUT of ⚙️ settings back to
   the floating 🍂 HUD toggle (under the gear), matching NBPT. `.sp-season` retired (both towns use
   the floating toggle now).
5. **24 Salem landmark hero buildings** (`e8ec49f` + `d5e29b2` + `02c9afb`) — researched + built. (See
   **Hero buildings**.)
6. **Salem fast-travel list** (`f15068f`) — 14 curated destinations. (See **Fast-travel**.)

(Earlier-in-session, all live: Salem default→fall, the general coastline ocean builder shared by both
towns, extreme-Halloween decor, roof fixes — see memory `salem-world-only-prototype.md`.)

## Hero buildings — how they work (READ before adding one)

Custom landmark buildings render via **`HEROES: Record<string, HeroBuilder>` in
`src/three/decor.ts`**, keyed by **`b.n` (the exact OSM building name)**. The building render loop
calls `HEROES[b.n](buckets, b, g, index)` then `continue`s — fully replacing the generic render
(so a hero also **skips** the generic windows/doors/string-lights pass; the builder must add its own).

**The 24 registered Salem heroes, by builder family:**
- **`firstPeriod`** (dark First-Period wood, steep cross-gables, leaded casements): The Witch House,
  The House of the Seven Gables, Hathaway House, Narbonne House.
- **`gambrelHouse`** (Georgian gambrel; opts material/roof/trim/storeys/dormers/chimney `ends4|ridge2`/
  entrance `pediment|ionic`/quoins/shutter): Ropes Mansion (**white**, not grey), Derby House, Crowninshield-Bentley.
- **`federalHouse`** (Federal `roofKind` hip|gable|flat, balustrade plain|fret, stringcourses, chimney,
  entrance pediment|fan|portico|colossal|canopy, cupola, flag, shutter, storeys 2–6): Hamilton Hall,
  Andrew Safford (colossal columns), Philips House, Hawkes House, Nathaniel Bowditch House, Salem
  Athenæum, Lyceum Hall, Hawthorne Hotel (6-storey + flag).
- **`salemChurch`** (grey granite gable nave, lancet GLOW windows, square crenellated front tower, no
  spire, optional quatrefoil): First Church in Salem, St. Peter's Episcopal Church.
- **Bespoke:** Custom House (`customHouse`), Salem Witch Museum (`witchMuseum`), Gardner-Pingree
  (`gardnerPingree`), Yin Yu Tang (`yinYuTang` — horse-head firewalls), Pedrick Store House
  (`warehouse`), Friendship of Salem (`tallShip`), Scale House (`brickShed`).

**To add/fix a hero — the rules that cost real debug time this session:**
- **Windows + doors: call `facades(buckets[PLAIN], b.p, eaveH, rows, seed, withDoor, withShutters,
  storefront, g)`** — the shared renderer used by every generic building. It draws white-framed glass,
  ~8% lit-at-night gold panes, real doors on the long walls, shutters — all *proud* of the wall.
  **Never hand-roll windows** (the old custom near-black coplanar quads = invisible at dusk + flicker).
  It places rows at `g+13 + r*19` and clips at `eaveH`, so **size walls to that rhythm**:
  `eaveH = g + floors*19 + ~7`.
- **Trim bands (water table / stringcourse / cornice): wrap the ring in `expandRing(b.p, 0.5)`** so they
  sit PROUD, not coplanar with the wall (coplanar = the z-fighting flicker).
- **Night glow: add `stringLights(buckets[GLOW], b.p, eaveH-1.5, HALLOWEEN_BULBS)` (fall) /
  `…)` default BULBS (winter)** to house/civic heroes — otherwise they're dark while every neighbour glows.
- **Solid-colour SLOPED roofs use the `PLAIN` bucket, not `SHINGLE`** — `quad()`/`rotBox()` emit UV(0,0)
  and the shingle texture's (0,0) texel multiplies the colour to near-black. `flatRoof()` is safe (real UVs).
- **Steep gambrel slopes need a LIGHT base colour** (slate ≈ `#b6bbc3`) — the overhead key light grazes a
  steep face to ~0.35×, so a mid-grey reads black.
- **Geometry convention** (matches `gableRoof`'s fallback `pt`): build in OBB-local coords —
  `pt(lx,lz,y) = [obb.cx + lx*ca - lz*sa, y, obb.cz + lx*sa + lz*ca]` (ca/sa from `obb.ang`), pass straight
  to `buckets[*].quad/triUV/box`. Street side: `front = sign(fs.nx*(-sa) + fs.nz*ca)`, `fs = frontSegment(b,index)`.
  `gambrelHouse` auto-picks the ridge axis (`ridgeL`) so the ridge stays parallel to the facade.
  Buckets: `PLAIN=0, CLAP=1, BRICK=2, SHINGLE=3, PLANK=4, GLOW=5` (GLOW is unlit/emissive). DoubleSide
  materials → winding is free, normals only matter for sun-shading.

**Remaining buildings worth doing** (lower priority): the named historic stock is largely covered. What's
left renders generically — modern/tourist (Pirate Museum, hotels), neighbouring **Peabody**, the Salem State
campus, and the minor churches (which keep generic procedural steeples). Open polish: at deep dusk the hero
*walls* are dark (brick in shadow, like the generic houses) — could lift hero walls slightly if wanted.

## Fast-travel landmarks (Salem)

14 curated destinations power the 🗺 panel grid + name search + ambient "you've reached X" banners — all
data-driven from `world.landmarks`. Source of truth = **`tools/salem_landmarks.mjs`** (px coords pulled from
the built `world.json` — building centroids / named-area centroids, NOT lat/lon). Applied to `world.json`
in place by **`node tools/patch_landmarks.mjs`** (no heavy `build-world` needed); `build_world.mjs` also
pushes them when `BARE` so a full rebuild reproduces them. `r` = banner radius px (÷8≈m); the proximity
banner has a 90s/landmark cooldown. To add/edit a travel point: edit the array → `patch_landmarks` →
rebuild the bundle.

## Town switcher (both towns, scales to N)

Data-driven **`TOWNS` list in `hud.ts`** (`{name, emoji, path, tag}`) renders the switcher atop Fast-Travel;
current town highlighted, others `location.href = path` on tap. Current-town detection =
`window.__townPath || location.pathname` — each build self-declares its path (Salem sets
`window.__townPath='/salem/'` in its index.html shim; NBPT falls back to `/`). **To add a town:** add one
`TOWNS` entry in BOTH builds' `hud.ts`, set `window.__townPath` in its index.html, deploy its bundle under
that path.

## Deploy flow

**NBPT (root):** edit `src/` on `source` → commit → push. CI builds the root app + deploys to `clippertown.io`.
Run `npm run build` locally first to be sure (it's the flagship). `dist/` is gitignored.

**Salem (pre-built bundle):**
1. Edit source in the **worktree** (`nbpt-salem`); `npm run build` there.
2. `rsync -a --exclude CNAME nbpt-salem/dist/ nbpt-living/public/salem/`
3. Remove the orphaned old `index-*.js` (`git rm` the one `public/salem/index.html` no longer references).
4. Commit the worktree change to `salem-experiment` (keep source-of-truth in sync) + push.
5. In main repo: `git add public/salem` **(+ `src/...` if NBPT changed too)** → commit → push. CI deploys.
6. ⚠️ Before pushing: `git fetch origin source` + check `git rev-list --left-right --count origin/source...HEAD`;
   ff-merge if behind.

**Confirm a deploy:** CI run green + `git show origin/main:salem/index.html | grep -o 'index-…\.js'` matches
the fresh build, or `curl -s "https://clippertown.io/salem/?cb=$(date +%s)" | grep -o 'index-…\.js'`.
GitHub Pages CDN lags ~10 min; the live URL catches up shortly.

## Verify in preview (the freeze-camera trick)

Two dev servers via `.claude/launch.json`: **`nbpt-living`** (port 5173, NBPT) and **`salem`** (port 5199,
worktree). The chase cam sits ~740 units up, so detail reads tiny. To inspect a building up close: hold a
fixed camera in a re-render loop —
`G.renderer.setAnimationLoop(() => { G.camera.position.set(x,y,z); G.camera.lookAt(tx,ty,tz);
G.camera.updateProjectionMatrix(); G.renderer.render(G.scene,G.camera); })` (a one-shot frozen render gets
cleared by the next paint — keep rendering each frame). World→Three: `x≈worldX, z≈worldY, y=height`. Set
`nbpt.time(0.5)` bright BEFORE; check dusk too (lit windows + GLOW decor only read then). DON'T move the
sun in the held loop — it breaks the shadow frustum (roofs go black); pick a raking `nbpt.time()` instead.
Decor edits need a `location.reload()` (chunk meshes are cached). Hooks: `nbpt.{go,pos,zoom,time,find}`,
`nbpt._game`. More in memory `nbpt-preview-verification.md`.

## ✅ SHIPPED 7/2 (later session): building-heights pipeline (Overture)

Devin: "Sofi at Salem Station is 4 floors, you have it as 2 — is there a better way to be more
accurate with building heights?" DONE — both towns, live (`8f45b41` main / `44dfd95` worktree):

- **Source: Overture Maps buildings theme** (release `2026-06-17.0`, GeoParquet on S3), queried
  per-bbox by the new **`tools/fetch_heights.mjs`** (needs `duckdb` CLI — brew-installed on this
  Mac) → `data/raw/heights.json` (committed; compact `[lon,lat,height_m,num_floors]` rows).
  NBPT 11.2k features, Salem 22.4k — ~99.9% carry ML `height`, `num_floors` is nearly absent
  (12 / 123), so floors derive from height.
- **Overlay in both `build_world.mjs`** (before manual infill / LEVEL_FIXES): untagged buildings
  take the height-feature whose centroid falls inside the footprint (nearest-to-centroid when
  several). ML height reads to the ROOF TOP (a pitched house carries ~2.5-3 m of roof), so the
  mapping is calibrated ridge thresholds, not `h/3.2`: `<5.2→1, <7.2→1.5 (capes), <9.8→2
  (colonials), <12.8→3 (three-deckers), <16→4, <19.5→5, else 6`. **Guards** (each earned by a
  real building): area>2000 m² & h<11 m → 1–1.5 (Market Basket 9 m/11.7k m² stays 1, Graf Rink,
  strip malls); area>5000 m² caps 2 (Witch City Mall's 18.9 m tower part); church caps 2.5
  (naves are one tall volume); shed caps 1.5; only ordinary kinds (specials like `light`/`tower`
  keep their lv — March's Hill Water Tower correctly renders tall as a `house` at 6 though).
  **Precedence: explicit OSM `building:levels` (`LV_EXPLICIT` set) > LEVEL_FIXES >
  MANUAL_BUILDINGS > overlay > old defaults.** Missing heights.json just warns.
- **Verified:** NBPT downtown 3–4 (Post Office 3, Library 3, City Hall 4), Market Basket 1,
  Hawthorne Hotel 6 (explicit tag), Salem three-deckers 3 (795 of them), Witch City Mall guarded.
  Numbers: NBPT 2700 raised / 3958 lowered; Salem 3682 / 10027.
- **Sofi's LEVEL_FIX STAYS** — Overture's ML imagery predates the building (reads 5.2 m). That's
  the pattern: new construction needs a LEVEL_FIX until Overture's imagery catches up. **NBPT's
  build_world now has an (empty) LEVEL_FIXES scaffold too.**
- **Lowering is real:** ~36% of NBPT houses and ~46% of Salem's dropped to lv 1 (ranches,
  garages, small capes — data-backed; a 2-storey neighbour on the same street reads 8+ m, so the
  ML does discriminate). If Devin flags a specific house as too short (his own at 13 Fox Run
  Drive measured 5.0 m → lv 1), add a LEVEL_FIX anchored to geometry.
- **New town recipe:** copy `fetch_heights.mjs`, set its BBOX (the bbox seam is now in 4 tools),
  run it once, build-world picks it up automatically.
- **FOLLOW-UP (same day, main `405a2f4` / worktree `4fb7acb`):** Devin: "downtown all looks the
  same height." The DATA was varied — the RENDERER was flattening it: `buildingDims()` in
  decor.ts had garbage-lv-era compensations (min-3 storeys for commercial >140 m², an area lift
  for houses at the 1.5 default, 5-storey cap). Renderer now trusts `lv` verbatim (cap 6);
  build_world applies the old size inference itself for Overture-gap buildings (it knows which
  matched; the renderer can't) and maps h≥9.8 m continuously to half-floors (`(h-1)/3.2`) so
  10/12/15 m blocks stop collapsing to the same integer. State St corridor now spans lv 1–6
  with half-steps. **LESSON: when a data field becomes authoritative, grep for render-time
  heuristics that used to compensate for it — they silently fight the new data.**

## ✅ SHIPPED 7/2 (same session): roofscape pass (both towns)

Devin: "the angle down in this game makes roofs very relevant and we make them very boring —
is there a way to figure out which houses are which roofing material or style?" **Data answer:
NO** — Overture's roof_shape/material/color cover 2 of 13,319 NBPT buildings (they're OSM-sourced;
OSM was already known-empty). So it's all seeded procedural (main `3e404ef` / worktree `9062086`):

- **NBPT got Salem's 6/24 house-roof variety** (was worktree-only): `hipRoof`/`mansardRoof`/
  `mansardDormer`/`pickHouseRoof` ported + the branch logic — rectangular houses (fill≥0.9) mix
  gable/hip/pyramid/mansard; small civic + standalone shops (<240 m²) pitch; the `pitchable`
  guard sends huge 'house' footprints (Market Basket, rinks) to the flat branch — correct AND
  kills the old mega-gable slabs.
- **Flat roofs, both towns:** `roofsCommercial` palette widened 3 near-identical beiges → 8
  membrane tones (dark EPDM `#3f3d3b` → pale TPO `#b3b0a8`) in style.ts; new **`roofClutter()`**
  in decor.ts (after `pointInRingD`) drops seeded HVAC units, vent stacks, a stair bulkhead
  (area>450 m²), and brick chimney stacks (brick blocks) — every box corner pointInRing-tested,
  candidates that would hang off the roof are skipped.
- Verified both towns in preview (Inn St/Market Sq aerial + Bartlet Mall wide + Salem Washington
  St); winter override (style.ts ~line 204, snow whites) untouched.

## ✅ SHIPPED 7/2 (same session): loading pass (both towns)

Devin: "greatly reduce loading/memory to ensure a great experience always." Profiled first
(main `db5ad74` / worktree `eb0669c`):

- **world.json was 54% nature polys** (sub-meter OSM river/marsh rings) → new Douglas-Peucker
  `simplifyDP` post-pass in both build_worlds (tiered 4 px / 8 px = 0.5/1 m by ring size;
  buildings/roads/paths/barriers untouched — gameplay geometry). NBPT 5.85→4.7 MB raw, wire
  2.19→1.74 MB gz. River edges verified pixel-identical.
- **Service worker** (`public/sw.js` both trees + registration in main.ts): cache-first for
  world.json/heights.bin/hashed JS/icons; navigations network-first with cache fallback →
  offline boots. Cache = `clipper-<build>` keyed by the `sw.js?v=${__BUILD__}` registration
  URL: each deploy refreshes exactly once, activate purges old caches. Verified on the dist
  preview: controlled reload serves world+terrain+bundle at transferSize 0 in 2–15 ms.
  Repeat visits ≈ 0 bytes; first visit ≈ 3.4 MB gz total.
- **Memory needed NOTHING**: Game.ts already LRU-evicts chunks (cap 110 walk / 90 flight)
  with full disposal; measured 800–887k tris / 346–430 calls / 133–167 MB heap downtown.
  Remaining unknown = a real old-phone Salem session (pre-existing).
- **Plus (`f7c61c4`/`95cc25d`): first-visit loading progress** — boot() streams world.json +
  heights.bin and ticks the loading card ("Loading the town · 43%"); exact total baked at
  build time (`__PAYLOAD_BYTES__` in vite.config — stream bytes are DECOMPRESSED, so
  Content-Length can't be the denominator).
- **SW update nuance:** the visit right after a deploy serves the PREVIOUS world.json from
  the old cache while the new SW installs; the next load is fully fresh. One-session-stale
  data ≤ once per deploy — fine for players, but hard-refresh twice when verifying a deploy.

## ✅ SHIPPED 7/3: RACING in Salem (the play-tier convergence begins)

Devin: "start adding the racing to salem." Live (`5ed4c9a` main / `92afbd4` worktree) — the
write-once-runs-anywhere pivot's first real payoff:

- **race.ts ported** with `TOWN='salem'` (cloud tab auto-creates on the shared Apps Script
  board — verified GET `?town=salem` answers), storage keys `salem-race-*`; **rider NAME +
  ghost pref stay on the shared `nbpt-race-name`/`nbpt-ghost` keys ON PURPOSE** (one origin —
  a kid's name follows them between towns). Filter list = 4th copy now (race.ts ×2 towns,
  worker.js, apps-script.gs) — keep in sync.
- **Course ladder** (authored with the NEW **`tools/make_course.mjs`** — Dijkstra over the
  road graph + RDP(35) route + auto-gates at >25° corners / 2600 px pacing; kills the
  hand-stitching orientation bugs; works for any town):
  · **Witch Hunt Dash** 0.7 mi sprint — Salem Common → the Witch House (downtown grid corners)
  · **The Willows Run** 2.0 mi — Witch House → Derby St wharves → Fort Ave → Salem Willows
  · **Marblehead Homecoming** 4.1 mi epic — Marblehead old town (Jersey St start) → coastal
    Humphrey/Loring → Lafayette flat-out → finish at the Custom House under the Friendship
- **hud.ts** gained the full race chrome verbatim from NBPT (🏁 picker, countdown, race
  clock + armed quit, results/leaderboard modal, announce, ghost ⚙️ row) via a new
  `root` getter (Salem's Hud predates NBPT's root field); Salem-bare 🏁 slots at top 170px.
- **Game.ts**: RaceRunner wired **BARE-safe** (the old update loop nested everything under
  `if (this.quest)` — dead in world-only mode; restructured so race/history/eggs run with
  `quest?.nearActive ?? false`), countdown freeze, fast-travel cancel, lendBike, landing
  re-mount announce, Race-the-Town promo (chains to the existing flight promo).
- **Bikes are BASELINE in Salem now** — the old `nbpt-bike` story gate would have hidden the
  bike button forever in world-only Salem (no story to earn it).
- **Verified in preview:** all 3 courses start/arch/finish/results-board; claim row banks a
  name (`salem-race-*` keys + ghost saved); ghost replays on the rematch with its intro
  banner; ⚙️ ghost toggle works; cloud test-isolated via the `nbpt-board-url` override.
- **NOT ported yet** (still open convergence): 🔊 read-aloud + 44px closes (blab labels ARE
  in Salem now, 7/3 fix batch); name-error `.bd-err`/`.rp-err` text IS included.
- **⚠ NEW DRIFT (7/3):** a concurrent session shipped 3 NBPT racing-polish commits
  (`2485eab` rider switching on shared devices, `790d282` story-steps-aside + course progress
  tracker, `b32d2f3` ride-toward-flag + finish celebration — race.ts/hud.ts/Game.ts/quest.ts).
  **None of that is in Salem's race.ts copy yet** — next Salem racing pass should re-sync.
  The filter lists did NOT drift (CI + local check confirm).

## ✅ SHIPPED 7/3 (same session): pre-Reddit fix batch (`95718ba` main / `2b78278` worktree)

- **Salem og-image**: a shared /salem link previewed the NEWBURYPORT hero shot (og:image
  pointed at the root file). Now an in-engine 1200×630 of the Witch House on Essex St at
  `/salem/og-image.jpg`. (Capture trick: WebGL buffer clears between frames — render once
  explicitly, then drawImage + toDataURL in the SAME synchronous eval.)
- **✈️ Winter Island flight**: Salem's promo teleported players to the Hawthorn Pond
  Conservation Area (Marblehead woods) and its copy said "Plum Island Airport … Clipper
  Town". Relocated to Winter Island — the REAL former US Coast Guard Air Station Salem
  (seaplanes 1935-70) — takeoff heads east past Fort Pickering Light; promo + banner re-copied.
- **Tanks aren't houses** (both towns): `building=water_tower|storage_tank|silo` →
  new `wtower`/`tank` kinds + octagonal-drum `buildTank()` in decor. NBPT reclassified 12
  (March's Hill standpipe verified); 2 untagged far-edge lv-6 "houses" remain.
- **SW update toast** (both towns): a deploy landing mid-session shows "✨ Updated — tap to
  reload the town" via a controllerchange listener in main.ts.
- **Filter-drift CI gate**: `tools/check_filters.mjs` diffs the kid-safe lists (race.ts vs
  worker.js vs apps-script.gs, + the Salem copy on local runs); deploy.yml fails on drift.
- **Salem blab labels** under all 6 HUD buttons; season toggle moved to the `.s-em` span
  pattern so the label survives season swaps.
- Push race note: origin was 3 commits ahead mid-batch (concurrent session) — rebase was
  clean (no file overlap), but it proves the re-check-right-before-staging rule again.

## Open / next ideas

- **Salem "auto-soul"** (the strategic sweet spot per `salem-world-only-prototype.md`): cheap LLM-generated
  history cards / light templated quests / auto-placed landmarks, so a new town gets soul without hand-authoring.
- **Town #3** — the switcher + builders are ready; a new town is "an afternoon" per the prototype memory.
- **Mobile memory at 2.5× building density** (Salem) is the untested ceiling.
- NBPT: a full L1→L2 public playtest; L3/spring + the flight capstone (`nbpt-flight-prototype.md`).
- Polish: lift hero walls slightly at deep dusk if the dark-brick look bothers.

## Gotchas / notes

- **`salem-experiment` is based on `eec00fe`.** For future merges, merge a source commit *before* the
  `public/salem` bundle commits, or you pull the built bundle circularly into the worktree.
- `.claude/launch.json`'s `salem` entry (`npm run dev -- …/nbpt-salem --port 5199 --strictPort`) is local-only.
- The 5 + 13 landmark batches were researched via parallel subagents (NPS/HABS/PEM/Wikipedia); the
  **Ropes Mansion is WHITE** (research overturned the old "pale grey" guess — don't trust a prior spec's colour
  over primary sources).
