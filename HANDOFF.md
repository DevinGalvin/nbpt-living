# Clipper Town — Handoff

A cozy, all-ages Zelda-like set on the **exact maps of real towns** — Newburyport at
`/`, Salem at `/salem/`, Beverly at `/beverly/`, and Ipswich at `/ipswich/`, one
codebase. Three.js + TypeScript + Vite. Live at **https://clippertown.io**.

> **⚡ FRESHEST STATE (July 13, 2026 — TWO-TOWN DAY): Ipswich AND Gloucester
> both went from empty folder to LIVE in one session. Read ✦ TWO-TOWN DAY
> below first**, then the post-launch polish session, then Beverly Day /
> multi-town notes for background.

## ✦ TWO-TOWN DAY (July 13, 2026) — state + what's in flight

**Gloucester is LIVE at clippertown.io/gloucester/** — fifth town, built and
deployed the same evening Ipswich shipped (merge `4b873d0`, live build
`9edb67c`, verified: live `__build` + clean-profile spawn at the Man at the
Wheel). All of Cape Ann in one frame — Rockport, Motif No. 1, Bearskin Neck,
and the Thacher twins ride along as in-frame nods. Town status, ranked polish
(race full-ride e2e is #1), and the new gotchas (rotBox/box take
HALF-extents; OSM name traps; Wikipedia coords ≠ building footprints) live in
**GLOUCESTER-HANDOFF.md**; research in `docs/research/gloucester.md`
(29-entry photo-verified hero dossier) + `gloucester-landmarks.md` (57
candidates, all cited — incl. 15 cross-confirmed Dogtown Babson boulders, a
ready-made treasure-hunt mechanic).

**Gloucester highlights:** spawn = the Man at the Wheel (modeled, with the
Fishermen's Wives, Tablet Rock + CG Aviation Monument, via a new name-keyed
`POI_HEROES` monument tier in decor.ts); ✈️ flight from **Ten Pound Island —
the first successful US Coast Guard air station (1925, verified)**, whose
1935 successor is the Salem flight site (Ipswich 1910 → Gloucester 1925 →
Salem 1935 = one continuous aviation arc); races Boulevard Dash 0.9mi / Good
Harbor Run 2.1mi / **Rockport Homecoming 5.0mi** (longest epic yet); heroes
incl. Hammond Castle, Our Lady of Good Voyage's twin blue onion domes,
Motif No. 1 ('78 replica), the Paint Factory (red WOOD, not brick), and a
parametric `lightTower` driving all five lighthouses.

**⚙️ ENGINE: the coastline sweep is hardened** (`tools/build_world.mjs`) —
Cape Ann is an ISLAND (the 1643 Cut), which blinded the old "origin stays
dry" rotation check and let two OSM defects (a 2-pt coastline stub + Norman's
Woe's 127px ring gap) drown Magnolia and Hammond Castle. The sweep now closes
near-loops, drops degenerate stubs (both warn), and picks rotation from OSM's
water-on-the-RIGHT invariant. NBPT + Ipswich oceans rebuild byte-identical.

**⚠️ Concurrent-session deploy pattern (used tonight, keep it):** another
session's uncommitted edits sat on paths its own pushed commit touched,
silently blocking a normal merge (the ff-abort hid behind `2>/dev/null`).
Resolution: plumbing merge — `git merge-tree --write-tree A B` →
`git commit-tree` → `git update-ref` → push — merges and ships WITHOUT
touching the working tree. Then `git restore --staged <files>` clears the
stale index. Never sweep another session's dirty files.

### Earlier the same day — IPSWICH

**Ipswich is LIVE at clippertown.io/ipswich/** — fourth town, built end-to-end
in one session on branch `ipswich`, merged to `source` on Devin's greenlight
(merge `1076103`), deploy verified (live `__build`, world.json serving, clean
first visit spawns at Five Corners). Town status, session gotchas (the
stale-screenshot preview trap, race-quit-on-teleport, `nGables` A-frame), and
the ranked polish list live in **IPSWICH-HANDOFF.md**; research in
`docs/research/ipswich.md` (photo-verified hero dossier) + `ipswich-landmarks.md`.

**Also shipped this session (both live):**
- `892d69f` **Accuracy pass** (Devin: "the most important thing in these towns
  is accuracy") — caption corrections (Little Neck's school trust → past tense,
  it sold in 2012), Wolf Hollow's point verified against the assessor address
  layer (3.5m off 114 Essex Rd), all-17-hero visual audit completed.
- `5e8b689` **Town-switcher balanced grid** — four towns broke the flex-wrap
  row (3 + a lone stretched 4th). Now a grid sized from the town count
  (`hud.ts` initTravel): 2-3 on one line, 4 as a 2×2, 5-6 as rows of three.

**Open threads:**
- **Beverly "ghost garage"** (r/northshore comment): a redditor's garage,
  demolished ~6 years ago, still renders — it's still mapped in OSM (snapshot
  age is NOT the cause; Beverly = July 6 data). Reply drafted; offered two
  fixes: they edit OSM (rides the next refetch) or DM the location →
  one-line `dropOsm` in `towns/beverly/map.mjs` + rebuild (the NBPT
  golf-course-lake precedent). Waiting on their answer.
- **Map freshness by town** (world.json `meta.generated`): NBPT Jun 8 ·
  Salem Jun 25 · Beverly Jul 6 · Ipswich Jul 13. Idea parked: a one-line
  "Map data: OpenStreetMap, <month year>" in the ⚙️ card.
- **Launch calendar**: Beverly r/beverlyma post Sat 7/18 (prep in memory);
  Ipswich + Gloucester launches unscheduled (after Beverly; modmail-first
  playbook). NOTE: Reddit residents found Ipswich on day one with NO launch
  post — the ghost-garage comment thread is already doing soft marketing.
- **Next towns** (standing ranking): Marblehead (pairs with Salem's frame),
  then Amesbury+Salisbury (completes the NBPT cluster; Salisbury Beach).
  The playbook: docs/TOWNS.md + the two research agents + this file's town
  handoffs — Ipswich and Gloucester each went folder→live in one session.

> **Prior state (post-launch polish session): everything below shipped to
> `source` and was LIVE at `b88e7fb`. Read ✦ POST-LAUNCH POLISH SESSION next**,
> then the older Beverly Day / multi-town notes for background.

## ✦ POST-LAUNCH POLISH SESSION — state + open items

**Live at `b88e7fb`** (all pushed to `source`; CI `build:all` green). A fast,
screenshot-driven bug-fix + content pass, run alongside the r/northshore launch.
Everything ships engine-wide (all three towns) unless noted.

**Shipped this session (source, in order):**
- `b41f4e7` **Heart-landmark spawns.** The first-visit drop is no longer a raw
  coordinate — it's a *named landmark* declared once in `towns/<id>/town.json`
  as `"spawn": { "landmark": "<id>", "dx", "dz" }`, resolved at runtime against
  `world.landmarks` (see `src/game/Game.ts` spawn block + `src/towns/types.ts`
  `SpawnAnchor`). **Beverly moved Lynch Park → Ellis Square (downtown).** New
  build guard `tools/check_town_spawn.mjs` (in `build:all` + `npm run
  check:towns`) fails if a town's spawn landmark is missing. `docs/TOWNS.md`
  documents it as the repeatable rule.
- `cb7bc34` gitignore `dist-*/` (per-town build dirs).
- `90b4788` **Bridge "origami" fix — dual-carriageway fuse.** OSM maps a divided
  road as parallel ways; one-deck-per-chain stacked them into a fan at
  approaches (the Gillis site). `roadChains()` in `src/world/index.ts` now fuses
  parallel/overlapping same-class bridge chains into one centred deck. This was
  the deferred "dual-carriageway detection" from `docs/BRIDGE-ROADS-REDESIGN.md`.
- `16aa546` **iOS town-hop crash fix.** Town switches are plain navigations;
  Safari kept the departing page (WebGL + textures) in bfcache → two towns
  resident → tab jetsam. `pagehide` now releases the GL context;
  `pageshow(persisted)` reloads. (`src/game/Game.ts`, in the constructor.)
- `5507cd4` **Race clock → top of screen**, clear of landmark banners (`hud.ts`).
- `7cf874d` **Gas stations** — canopy + pumps at every `amenity=fuel` POI.
- `eea2c3e` **Business set pieces** — ice-cream cones, fire engines, police
  cruisers, theatre marquees. Extracted the shared `forecourtSpot()` placement
  helper (roadside-first 2-D probe, places nothing rather than clip). All in
  `src/three/decor.ts`, dispatched in the `world.pois` loop.
- `c0edc7d` **Bridge crossability** — fixed uncrossable holes at wet
  junctions/landings (Beverly↔Salem Bridge St rotary): wet deck ends floor at
  span height instead of the seabed; exact chain-membership recorded during the
  walk (not nearest-guessed); merged deck extends to cover the *union* of its
  members; a member must ride the spine its whole length to fuse (max offset).
- `7600e3c` **Fused-deck taper** — a fused deck tapers to the real road width at
  dry ends (no squared-off "wing" over the approach); union extension only at
  wet ends. Per-end widths `w0/w1` threaded into `ribbonDeck`.
- `b88e7fb` **Collision "infinite shake" — real fix.** The glance-off-walls
  movement (`7359fc1`) ping-ponged between two branches at a wall (off, in, off,
  in) at frame rate. Replaced the whole axis-flip deflection with a
  rotate-the-move-vector glance whose rotation side is *locked per wedge*
  (`wedgeDir`) — can only slide along a wall, never buzz across it; rests if
  truly boxed in. Covers foot/bike/kayak/boat. (`src/game/Game.ts` movement.)
  (`75fe208`, the tsconfig baseUrl removal between these, was another session.)

**Reusable headless verification tooling (used all session, worth keeping):**
Chromium is pre-installed at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`;
`npm i playwright-core --no-save` and drive a town dev server (`TOWN=<id> vite
--port <p>`). Two patterns proved essential:
- **Screenshots / marketing shots:** the `window.nbpt` dev hooks — `go(x,z)`,
  `zoom(z)`, `time(t)` (0.5 noon · 0.7 golden · ~0.93 twilight), `weather(0|1)`.
  Season via `?season=<summer|fall|winter>` in the URL (localStorage season is
  unreliable — Salem forces fall). Winter snow = `weather(1)`; the Frog Pond has
  skaters. Suppress modals with `localStorage <town>-welcomed/-promo-* = 1`.
- **Movement / physics bugs:** headless rAF is throttled to ~2 fps under
  swiftshader, so the render loop *cannot* reproduce 60 fps behavior. Call
  `Game.frame(t)` directly in a loop at fixed 16 ms with `keys` held to step the
  sim deterministically — that's how the shake 2-cycle was finally caught.
- Walk-across bridge tests: `nbpt.walk(dx,dy,ms)` toward waypoints, watch `pos()`.

**Open items, ranked:**
1. **Junction paint still busy** — the splayed crosshatch apron where wide roads
   meet (Gillis/rotary approaches) is cosmetic, deferred. Same family as the
   old #1 "wide-road paint polish" item below.
2. **Divided-highway reads as one broad plate** — the fused deck spans both
   carriageways + the median as a single slab (correct + crossable, but visually
   wide, e.g. Beverly↔Salem Veterans Bridge hits the 412px width clamp).
   Splitting it back into two visible carriageways with a median is a larger job.
3. **NBPT tertiary bridge near the Artichoke** (~world -24600,-21300) has *both*
   ends over water; it now floats safely at span height with caps, but it's a
   map-curation candidate (dropOsm / spot-fix in `towns/nbpt/map.mjs`).
4. **Salem Police Dept** set piece doesn't place (fully hemmed in) — the no-clip
   rule working as intended; curate a spot if you want the cruiser there.
5. Carryovers from Beverly Day (below): shop-sign mirrored text, Cummings NW
   aprons, Salem North St bridge spot-check.

**Launch status (r/northshore):** live as a **Link post → clippertown.io**.
Learned the hard way: image/gallery posts don't click through and hide the URL
in a comment; Link posts tap straight to the app + show the OG preview image +
allow a text body with links. Earlier text/gallery versions were deleted (only
one post ever live). r/newburyport and r/salem already posted. Next: r/beverly,
and the "which town next?" prompt is gathering requests → next-town roadmap.

> **⚡ PRIOR STATE (July 6, 2026, LATE EVENING — a huge day): read
> ✦ BEVERLY DAY below first.** Beverly is LIVE at /beverly/ (town #3), all 54
> Salem+NBPT heroes were photo-audited (14 fixed), bridges/roads got a
> network-graph redesign (after one hard revert lesson), and a playtest wave
> landed: boats at every dock, cars in every lot, scale-free impostor (blurry
> blotches dead), Lynch Park spawn, U-turn snap, arrive-facing fast travel,
> per-town og-image guard. The MULTI-TOWN section + Level-2 banner below
> remain current.

## ✦ BEVERLY DAY (July 6, evening) — state + ranked open items

**Live at `d417f7a`.** Deep refs: `BEVERLY-HANDOFF.md` (town status),
`docs/BRIDGE-ROADS-REDESIGN.md` (the redesign + its failure analysis),
`docs/research/beverly.md` (photo-verified specs), `docs/research/hero-audit-2026-07.md`
(54 verdicts). Everything below ships engine-wide unless noted.

**Open items, ranked:**
1. **Wide-road paint polish** — Devin's last screenshot (biking downtown
   Beverly): the ≥90px two-way paint (white edges + ±w/4 lane dashes + yellow
   center) reads CLUTTERED on curving streets, and some junctions still show
   markings running through (disc radius may be too small where wide roads
   meet). Revisit: maybe only edge lines on curves, dashes on straights; check
   junction-disc coverage on wide-road junctions.
2. **Shop-sign text reads mirrored from behind** (same screenshot, "House of
   Pizza") — welcome signs solved this with a plain back panel
   (makeWelcomeSignMesh); shop signs still DoubleSide. Port the fix.
3. **Cummings NW aprons** — aisles mapped in OSM but NO parking polys (bare
   terrain reads as grass, no cars possible). Curate 2-3 polys in
   towns/beverly/map.mjs manualFeatures sized to the aisle clusters
   (~[-4200,2500], [-3200,2300]) or edit OSM + refetch.
4. **Salem North St bridge spot-check** (the one unchecked redesign site) +
   **one full race end-to-end** in Beverly (board tab 'beverly' write/read).
5. **Salem landmark top-up 14→33** — proposed roster in the
   town-fast-travel-recipe memory; pre-Reddit polish (Salem launch Sat 7/11).
6. **Beverly launch prep** — recommend Sat 7/18 ~10-11am after r/beverlyma
   modmail; og-image is now real (Depot) but link-preview caches hold the old
   Salem image for a while; St. Mary Star of the Sea hero = colors UNVERIFIED
   (the Ropes-trap), don't model without photos; Lynch Park sled-hill geometry.

**Hard-won session gotchas (save an hour each):**
- **Preview screenshots go stale after location.reload()** — the tab loses
  live rAF; `preview_click` the canvas once, then screenshots are fresh.
- **Worktree merge trap**: `git merge beverly` run INSIDE the ../nbpt-beverly
  worktree is a no-op (merging into itself); merge in THIS tree, then push.
- **Overpass 504s on all mirrors = your ASK is too big, not the query** —
  schedulers defer huge [timeout]/[maxsize] requests past the gateway's
  patience. fetch_osm.mjs: OSM_TILES=2x3 + modest asks.
- **Verify at the HARD sites** (ramp merges, junctions, ends), not the easy
  mid-spans — and verify the actual predicate the player exercises (free()),
  not a lower-level function. Both bit us today.
- **"Engine-generic" fixes with absolute constants are still town-calibrated**
  — Beverly's map size broke the impostor's tuned -18 sink. Prefer bounds true
  by construction (the new minHeightOver envelope).

> ## 🚀 LIVE & stable at clippertown.io — launched June 16, 2026 to r/Newburyport
> (the "I found my house!" hook landed). A LOT has shipped since launch — see §5. Every
> build stamps its commit at `window.__build`.
>
> **🎯 LEVEL 2 "The Light That Walks" — COMPLETE (Chapters 1–4 BUILT & verified).** The finale
> (Ch4) landed 2026-06-18. A cozy lighthouse mystery, **summer Level 1 → winter Christmas finale**.
> Arc = land→sea→sky (L1 shipped; L2 sea/winter; L3 sky/spring; flight → L3). **Gated:** `?l2=1`
> latches `localStorage nbpt-l2`; all L2 sits behind `quest.l2`, public still ends at the Custom
> House. **Don't un-gate** (until ready to publish L2).
> - **Ch1 "The False Light"** — Joppa birdwatcher → **binoculars** → cinematic cutaway reveals a mystery light on the dark water.
> - **Ch2 "The Walking Light"** — Gram (now in Joppa) → take grandpa's **kayak** at the slip → paddle out → the light is a drowned granite foundation: it *walked*. (No teleport home: you **keep the kayak and paddle back yourself** — never stranded since the kayak is free-roam.)
> - **Ch3 "The Lamplighter"** *(reworked 2026-06-23 — was "The Mooncusser"; the villain didn't fit)* — you meet a salty **lobsterman in his boat OUT ON THE WATER** as you paddle home (he hails you — auto-triggers near his anchored boat, `LOBSTER`); he explains the ghost light is **old Eben, a keeper and your grandfather's friend**, who's lit the drowned foundation every night for years. The gale keeps blowing his lamps out, so you paddle back out and **relight his scattered lamps** (the same active 4-lamp hunt, inverted from snuffing) → meet Eben at his last lamp (he knew your grandfather, hands you the watch, lets the old light rest) → paddle home → he flags you down again for the storm. **No villain; deep grandpa payoff.**
> - **Ch4 "Bring the Light Home" (FINALE)** — the storm breaks: the lobsterman (met again on the water) sends you to the downtown **Rear Range Light**; climb + **🔦 LIGHT IT**, then **sweep the beam** (signature mechanic — a pinned "turret" mode) across the dark harbor to catch the 4 **lost boats**; all caught → the **Coast Guard** leads the fleet up-river, storm calms to **Christmas morning**, closing line *"the light was never yours to own, only yours to keep lit."* The light stays lit forever after.
> - LIVE/public: the **free-roam KAYAK** (key `nbpt-kayak`) and the **"Seasons Unlocked" reward** (finish L1 → winter, picker unlocks).
> - **✅ GIT STATE (2026-06-18):** the **whole L2 batch is now PUSHED + DEPLOYED** to `origin/source` → clippertown.io (build `a64bf2b`). It includes the **Ch4 finale**, a **UI/UX design-system pass** (public), and the **kayak-on-open-water-only + walk-across-frozen-ponds fixes** (public). **L2 is still GATED behind `?l2`** — the code is live but dormant; the public game still ends at the Custom House. Chapter keys: Ch1=`nbpt-ch5-step`, Ch2=`nbpt-ch6-step`, Ch3=`nbpt-ch7-step`, Ch4=`nbpt-ch8-step`.
> - **➡️ NEXT TASK:** decide **when to un-gate L2** (publish it to everyone) — a full Ch1→4 playtest first is wise. Until then, keep building behind `?l2`.
>
> Now **PUBLIC** (un-gated 2026-06-20): the **scenic flight** from Plum Island Airport — walk
> onto the airfield → **✈️ FLY**. A one-time **"what's new" promo card** (`Hud.featurePromo`,
> key `nbpt-promo-flight`) announces it. See §5 + the `nbpt-flight-prototype` memory.

---

## ✦ MULTI-TOWN ARCHITECTURE (July 6, 2026) — one engine, N towns — ALL LIVE

The Salem hard fork (`salem-experiment` branch + `nbpt-salem` worktree + committed
`public/salem/` bundles) is **retired, deleted, and archived** (history preserved at
`archive/salem-experiment` + `archive/cloud-source`; the repo now carries only
`source`, `main`, and those two archives). One codebase builds every town:

- **Per-town config**: `towns/<id>/town.json` (identity/geodesy/branding/storage) +
  `towns/<id>/map.mjs` (map curation: landmarks, spot fixes, QA) + `towns/<id>/public/`
  (world.json, heights.bin, manifest, og-image).
- **Per-town content pack**: `src/towns/<id>/index.ts` (TownPack: spawn, flight,
  atmosphere, courses, theme, copy, borderLore) selected at build time via the `@town`
  alias (`TOWN=salem vite build`). Salem runs `story: false` (world-only sandbox);
  the NBPT quest line stays inline in quest.ts and is gated off in bare towns.
- **CI builds every town from the same commit** (`npm run build:all` → `dist/` +
  `dist/salem/`; deploy.yml runs it on every push to `source`) — "Both towns:"
  hand-porting and "Salem bundle" commits are gone forever.
- **Saves are namespaced per town** by a boot-time localStorage shim generated in
  vite.config.ts from town.json's `savePrefix` (NBPT = bare legacy keys, Salem =
  `salem:` matching its old live shim, so nobody lost saves). Rider name + ghost
  pref + board-url stay global — the contract is documented in race.ts.
- **Verified equivalence**: regenerating NBPT's world.json through the parameterized
  pipeline is byte-identical to the shipped file; `npm run map` is no longer
  destructive (all hand-curation lives in map.mjs and re-applies on rebuild).
- **Adding a town** is a checklist, not a fork: **docs/TOWNS.md**. Next up (ranked
  July 2026, criteria = community hook / landmark identity / contiguity):
  **Beverly → Gloucester → Marblehead**, then Amesbury+Salisbury, Ipswich, Rockport,
  Essex/Manchester; long-term goal = a contiguous North Shore where town-to-town
  travel is a **geographic handoff** (cross the line → neighbor bundle loads at the
  same lat/lon; every town.json knows its origin, so cross-town coordinate
  conversion is pure math). The border system below is the foundation for that.

### 🪧 Town borders & Welcome signs (shipped July 6)

Crossing a municipal line shows an **"Entering Salisbury · settled 1638" banner**
(hud.announce; lore = `borderLore` in the town pack, keyed by OSM name) and the
world carries classic **white/green roadside "entering TOWN" signs** wherever a
real road crosses a town line — one per direction of travel, facing arriving
traffic, at the bridge ABUTMENTS (never over water), off every road's pavement.

- **Data**: OSM `admin_level=8` relations → `data/<id>/raw/boundaries.json` via
  `tools/fetch_boundaries.mjs`. ⚠️ Cloud sessions **cannot reach Overpass** (proxy
  allowlist) — run the **fetch-data workflow** (Actions tab or API dispatch); it
  fetches for every town and pushes to the `map-data` branch; pull files from there.
- **Bake**: `tools/lib/borders.mjs` (`bakeBorders`) → `world.towns` (municipality
  rings) + `world.signs` (sign spots). Applied by `tools/patch_borders.mjs`
  (in-place, no rebuild — use this; Salem has no local raw OSM/duckdb) and
  automatically by build_world.mjs when boundaries.json exists. Placement rules
  learned the hard way: slide along the road into the destination town until the
  shoulder spot is (a) dry land — water polys + holes, (b) in the right town,
  (c) clear of EVERY road's half-width+8px (painted roads are wider than road.w;
  dual carriageways put a second centerline on the first one's shoulder).
- **Runtime**: Game.ts town watcher (0.9s poll, point-in-ring, silent at spawn,
  skipped in flight) + `makeWelcomeSignMesh` (canvas board like the shop signs;
  posts at the board's outer edges BEHIND the face — flush posts z-fight the
  lettering; plain back panel — DoubleSide shows mirrored text). Signs place in
  buildChunk (skipped in decor-only phone-flight chunks) and dispose with chunks.
- Current bake: NBPT 48 signs (Newbury/Salisbury/Amesbury/West Newbury),
  Salem 65 (Marblehead/Beverly/Peabody/Danvers/Swampscott/Lynn). Fun fact the data
  surfaced: Plum Island Airport is in **Newbury** — flights cross a town line.

### 🏁 Racing fixes (shipped July 6)

- **Picker shows LIVE town boards**: opening the 🏁 picker pulls every course's
  cloud board (GET-only, 60s-throttled per course — `refreshBoards` in race.ts)
  and re-renders when it lands; previously a fresh device said "no time yet"
  forever until you raced. The results board after a finish always synced.
- **Countdown faces down-course**: the orient callback computed
  `atan2(-dx, dz)` which MIRRORS east/west — Salem's Witch Hunt Dash (due west)
  opened facing backwards. Forward is `(sin az, cos az)`; it's `atan2(dx, dz)`,
  and the kid model snaps too (`Kid.face()`). Verified 0.0° on all 6 courses.

### 🧪 Headless verification patterns (they'll save you an hour each)

Playwright + the pre-installed chromium (`/opt/pw-browsers/chromium-1194/...`,
`playwright-core` in the session scratchpad) against a static server on `dist/`:

- **rAF is throttled headless** — dt barely accrues. Pump frames by hand:
  `let t = g.lastTime; for (i<N) g.frame(t += 16.7); g.lastTime = t` (§3 hooks).
  Beware: 90 software-GL frames take >3.4s real time, long enough for the 3.4s
  banner to show AND expire inside the pump — assert on textContent, not `.show`.
- **`nbpt.go()` water-recovers**: teleporting onto water/bridges marches the
  player back toward spawn (findFree). Probe for dry land first via
  `g.index.isWaterAt/isBlocked` before asserting a cross-border teleport.
- **Screenshots hang on backgrounded pages** (no compositor frame): call
  `page.bringToFront()` first. Seed `nbpt-welcomed=1` + promo flags in
  addInitScript or the modepick overlay eats your clicks.

---

## 0. ✅ DONE — Level 2 finale "Bring the Light Home" (Ch4) is built & verified

**Level 2 is now COMPLETE (Ch1–4) and DEPLOYED** (2026-06-18, key `nbpt-ch8-step`, var `ch8`; build
`a64bf2b` live on clippertown.io — still gated behind `?l2`, so the public game is unchanged).
What it does + how it was wired is below; the deep record is in the **`nbpt-level2`** memory. **NEXT** is
a full Ch1→4 playtest, then the call on **un-gating L2** (publishing it to everyone).

**How Ch4 was built (for reference / future tweaks):**
- **New Game mode `sweeping`** (`Game.ts`): the beam-sweep is a pinned "turret" — the player stands locked
  at `TOWER_LOOK (2412,255)` and left/right input rotates `beamAz` (clamped π±0.95). It **reuses `cineLook`**
  for the movement-freeze + look-out-to-sea camera + far-plane open (no bespoke camera). Hooks:
  `beginStorm()` (idempotent: `sky.duskIn(0.985)` + `forceWeather(1)`), `enterSweep()`, `endSweep()`
  (→ `calmStorm()`: `duskOut()` + `forceWeather(null)`). The HUD bus gained `sweeping` + `beamAz`.
- **Quest (`quest.ts`)** mirrors the Ch3 pattern: `ch8` + `setCh8` + `nbpt-ch8-step`; 3 new ctor callbacks
  (`onStorm`/`onSweep`/`onSweepEnd`); finale dialogue consts (`LOBSTER_STORM`/`TOWER_LIGHT`/`BRING_HOME`);
  `buildL2Props()` builds the beam (2 nested additive cones at the `buildRearRange` lantern top, pitched
  down to rake the water), 4 `LOST` boats, + a festive Coast Guard boat; `candidates()`/`apply()`/
  `buildMissions()` (`l2c4`, active===9) gated `ch7>=2 && ch8===N`; `update()` rotates the beam to
  `hud.beamAz`, catches boats within 0.13 rad, tweens the fleet to `FLEET_HOME (1150,-1300)`; `catchBoat()`
  (bitmask `nbpt-ch8-boats`) + `bringLightHome()` + `placeFleetHome()` (reload-safe restore).
- **The beam stays lit after the finale** (ch8≥2) — "yours to keep lit." Reload-safe at every beat.

**(Original build guide — kept for context):** Level 2 was built through Chapter 3; the finale was the last piece.

### Read first — current state
- **Built + verified (gated `?l2`):** Ch1 "The False Light", Ch2 "The Walking Light", Ch3 "The Lamplighter" (a **relight-the-keeper's-lamps** minigame — paddle out, the beacon points to the nearest of 4 dark lamps, paddle up to each to relight it, then meet old Eben the keeper at his last lamp). *(Reworked 2026-06-23 from "The Mooncusser" — same 4-lamp paddle hunt, inverted from snuffing a villain's traps to relighting a grandfatherly keeper's lamps; see §5.)* **The sea chapters no longer teleport you home** — you keep the free-roam kayak and **paddle back yourself**; the **lobsterman is met out on the water** (his anchored boat at `LOBSTER`, auto-trigger in `update()` like the reveal) instead of at the slip, so the paddle home IS the transition. (`Game.landAtShore`/`onReturnAshore` are now unused but left wired.)
- **Chapter keys** (legacy off-by-one): Ch1 = `nbpt-ch5-step` (var `ch5`), Ch2 = `nbpt-ch6-step` (`ch6`), Ch3 = `nbpt-ch7-step` (`ch7`). **The finale = `nbpt-ch8-step` (`ch8`).** Ch3 completes at `setCh7(2)`.
- **⚠️ GIT — the 2 newest L2 commits are HELD LOCAL (not pushed):** the Ch3 snuff redesign + the land-ashore fix. `origin/source` (live) has only the public fixes (lake removal, walking-on-water fix, onboarding nudge, phone-speed cut, the Seasons-Unlocked reward). Devin's plan: **finish Ch4, then push the whole L2 batch.** `git log origin/source..source` shows the held commits; a `backup-before-season-split` branch is a safety net.
- **Test on `npm run dev`, NOT the live site:** the live `?l2=1` still has the OLD Ch3 (dialogue) + the stranding bug — the fixed versions are only local until the L2 push.

### The finale design (DECIDED with Devin — don't re-litigate)
- **Premise:** the keeper's lamps are tended and old Eben has let the old light rest, but the nor'easter's here and the real harbor light is dark — boats are out with nothing true to steer for. You **light the lighthouse and sweep its beam to bring the boats home**; the town answers light-for-light → Christmas morning.
- **PILLAR: NO peril, NO player-rescues.** Stakes = "the best night of the year almost doesn't happen," not survival. Closes on *"the light was never yours to own, only yours to keep lit"* (mirrors L1's "the treasure was the town").
- **The light = the downtown Range Lights** (Devin's call — NOT far-off Plum Island Light at ~25k px east). Hero = the **Rear Range Light** (tall brick tower, world-px ~`(2433, 93)`); partner = the **Front Range Light** ~`(3233, −139)`, both by the **Coast Guard** ~`(3030, 75)` ("birthplace of the Coast Guard"). Tight geography: lighthouse + town payoff + boats are all the downtown harbor.
- **Beats (proposed — confirm with Devin if unsure):** (1) **storm breaks** — the recurring **lobsterman** at the slip sends you to light it; (2) **light the tower** — reach the Rear Range Light, relight the lamp, the beam comes on; (3) **sweep the beam** *(signature mechanic)* — rotate it across the dark harbor; each lost boat the beam catches turns and follows it home up the river; (4) **the town answers** — Market Square tree blazes on, the **Coast Guard boat** leads the fleet up the river, streets warm → Christmas + the closing line.

### Asset map (exact coords/handles, from a thorough read)
- **Lighthouses:** Rear Range `(2433,93)` `buildRearRange` (decor.ts ~1901); Front Range `(3233,−139)` `buildFrontRange` ~1910; Plum Island `(33222,−3371)` `buildPILight` ~1918 (too far). `lanternTop()` = the glazed top. They're `HEROES`-dict overrides keyed off the world.json building name.
- **No rotating beam exists — build one.** Reuse the quest beacon's glow materials (`quest.ts` ~506–545): additive `beamMat`/`glowMat` (`depthTest:false`, `fog:false`) — a long rotating cone on the tower reads cleanly over water + sky. The decoy lamps' `warmGlow()` sprite is also reusable.
- **No lit house-windows exist** — a per-house cascade is a NEW system; for v1 Devin OK'd **tree + Coast Guard boat + the existing night street-lamp glow** (don't over-scope). The **Market Square Christmas tree already builds in winter** (`Game.ts` ~1019, ~`(−100,−48)`).
- **Boats:** `buildRowboat`/`buildKayak` exist (reuse for a festive Coast Guard boat); mooring-dock boats decor.ts ~3021.
- **Storm/season:** L2 is already winter (snow on) via the Seasons-Unlocked reward. `nbpt.weather(1)` / `Sky.forceWeather` for a heavier blow; `Sky.duskIn/duskOut` + `setTod` for night; `Game.cineLook` + `lookOutToSea`/`endLookOut` = the scripted-camera cutaway (used in Ch1).

### How to add Ch4 — mirror Ch3 exactly (all in `src/game/quest.ts` unless noted)
1. `private ch8: number;` + load `nbpt-ch8-step` in the constructor; add `setCh8(s8)`.
2. New dialogue `Line[]` consts — short, kid-followable (see `nbpt-writing-voice`; keep the recurring lobsterman's voice from Ch3).
3. `buildL2Props()` — build the finale props (the tower beam, the Coast Guard boat); toggle their visibility by `ch8` step in `apply()`.
4. `candidates()` — talk/action tags gated `ch6>=3 && ch7>=2 && ch8===N`.
5. `apply()` — objective text + beacon `target` per ch8 step + the prop visibility toggles.
6. `buildMissions()` — push an `l2c4` card; bump the `active` selector (Ch3 = `active===8` → finale `===9`).
7. `runStepDialogue()` — the handlers + `setCh8` calls; `update()` — any auto-trigger (reach-the-tower / beam-sweep tick), like Ch2/Ch3's `<130px` checks. **End each on-water beat with `this.onReturnAshore(SLIP.x, SLIP.z)`** so the player isn't stranded.

### Verify + ship
- `npm run dev`; `window.nbpt` hooks (`go`,`time`,`weather`; pump the throttled rAF with `_game.frame()` — see §3/§7). Drive dialogue via `nbpt._quest.interact('<tag>')` + `_game.hud.advanceDlg()` (synthetic clicks don't advance it). `npx tsc --noEmit`.
- **When L2 is done:** `git push origin source` (the held L2 commits + Ch4 all go live; CI deploys ~1–2 min). **To ship a public hotfix BEFORE then**, reorder so the public commit sits below the held L2 ones, then push only it — see §8.

---

## 1. The one thing to know

**This folder — `/Users/devingalvin/claude_apps/nbpt-living` — is the single source
of truth.** All editing and deploying happens here.

The game briefly forked into a separate "cloud" line (the old Claude Code cloud
sessions that produced the `claude/*` branches and the Clipper Town rebrand). That
line's *editable source no longer exists anywhere* — only its built bundle did. On
**June 13, 2026** this folder was made canonical, rebranded to Clipper Town, and
deployed. **Do not go back to the old cloud / "Clipper City v2/v3" sessions** — they
are dead lines. Everything lives here now.

---

## 2. Where things live

| | |
|---|---|
| **Editable source** | this folder = branch **`source`** on `github.com/DevinGalvin/nbpt-living` |
| **Live site** | https://clippertown.io (and https://devingalvin.github.io/nbpt-living/) |
| **Hosting** | GitHub Pages serves branch **`main`** (built artifacts only — no source) |
| **Custom domain** | `public/CNAME` = `clippertown.io` (must stay — see Gotchas) |
| **Archived history** | `archive/salem-experiment` + `archive/cloud-source` (read-only keepsakes; all other stale branches deleted July 6, 2026) |

---

## 3. Run / verify / deploy

```bash
npm install            # first time
npm run dev            # Newburyport dev server at http://localhost:5173 (HMR)
npm run dev:salem      # Salem dev server (TOWN=salem — any town id works)
npm run build:all      # dist/ = Newburyport (+ ClipperTown.html) + dist/salem/ = Salem
npm run build          # tsc --noEmit && vite build  → dist/
npm run share          # build + inline single-file dist/NBPT-Living.html
npm run deploy         # OPTIONAL now — CI auto-deploys on push to source (see below)
```

- **Shipping is now automatic (CI).** Every push to `source` runs
  `.github/workflows/deploy.yml` → builds (`npm ci` + `npm run share`) → pushes `dist/` to
  `main` → GitHub Pages serves it at clippertown.io in ~1–2 min. **No Mac needed.** The
  normal flow is just: `git add -A && git commit && git push origin source`.
- **📱 From a phone / cloud Claude session, tell it:**
  > *"Commit directly to the `source` branch and push to `origin/source` — don't make a
  > feature branch or open a PR. Pushing to `source` auto-deploys, so that's all you need."*

  (`source` is the repo's default branch and is unprotected, so the push works and triggers
  the deploy — no PR, no GitHub-app merge. CI runs `tsc` *before* publishing, so a change
  that doesn't compile fails the build and never reaches the live site.) **Never edit
  `dist/` or the `main` branch** — they're generated output.
- **Verify it went live:** the build stamps its commit at `window.__build` (open the
  console), or poll the served hash — `curl -s "clippertown.io/index.html?cb=$(date +%s)"`
  for a new `assets/index-XXXX.js`, then
  `curl -s clippertown.io/assets/index-XXXX.js | grep -o '__build="[^"]*"'`.
- **Manual deploy (Mac fallback):** `npm run deploy` (`tools/deploy_pages.sh`) still builds
  + pushes `dist/` to `main` via `gh`, but it's redundant with CI now (and would race a CI
  run if used at the same moment — same result). It refuses to run unless `source` is the
  checked-out branch.
- **In-browser debug hooks** (great for verifying): `window.nbpt` → `go(x,z)`,
  `travel(id)`, `find(q)`, `pos()`, `zoom(z)`, `season('summer'|'fall'|'winter'|'spring')`,
  `time(0–1)` (0=midnight·.25=dawn·.5=noon·.75=dusk), `weather(1=storm|0=clear|null=auto)`,
  `fly()`/`land()` (✈️ flight — now public, works anywhere), `_game`, `_THREE`.
- **Verifying via the `nbpt` hooks** (preview throttles rAF): after `nbpt.time()`/`go()`,
  pump frames by hand — `for(let i=0;i<8;i++) nbpt._game.frame(t+=16.7)` — but continue
  timestamps from `_game.lastTime` and restore it after, or the next real frame gets a
  huge/negative `dt`. Interiors enter via `_game.enterNews()/enterDen()/enterStar()`.

---

## 4. Architecture / key files

- `src/game/Game.ts` — the engine: chunk streaming, player/dog movement (sub-stepped
  + wall-slide collision so tight streets glide, not snag), camera (chase cam),
  fast-travel (`travelTo`/`findFree`), water/ice, fence-hop, the day–night lighting
  (applies `Sky`'s palette to sun/hemi/fog each frame), a **street-lamp light pool**
  (16 warm PointLights + glow discs that follow the nearest lamps, on only at night),
  the interior scene-swap (`enterNews`/`enterDen`/`enterStar`/tunnel), the
  first-visit welcome card + one-time "press R to run" toast, **✈️ scenic flight**
  (`enterPlane`/`startFlight`/`stepFlight`, a `flying` branch in `frame()` + `updateCamera`,
  the ground **skirt** for the horizon, the worn-backpack toggle; **now public** — `flightEnabled`),
  the **🛶 free-roam kayak** (`enterKayak`/`exitKayak`/`buildKayak`, a `kayaking` mode + the
  `onWater` getter; water-confined `free`; the unstick net is land-only), and the Level 2
  **"look out to sea" cinematic** (`cineLook` + `lookOutToSea`/`endLookOut`; movement freeze;
  far-plane/fog opened on water).
- `src/world/index.ts` — **WorldIndex**: spatial buckets, the painted **ground canvas**
  (`fillPoly`/`terrainFill`), the **collision grid** (`buildCollision`, red=blocked),
  `isWaterAt`/`frozenWaterAt`/`isBlocked`/`surfaceYAt`/`lowBarrierNear`, shop signs,
  pitch markings, deck heights.
- `src/world/style.ts` — palette + **`SEASON`** (resolved from `?season=` or
  localStorage `nbpt-season`); a table-swap re-dresses the whole town per season.
  **`seasonsUnlocked()`** (ch4≥3, the finale climax) is the single gate for the post-game
  season picker — both whether it unlocks AND whether a pick applies (replaced the old
  buggy two-threshold `spineComplete`).
- `src/world/terrain.ts` — real elevation (heightAt/normalAt) from `public/heights.bin`.
- `src/three/decor.ts` — all 3D building/scenery generation: walls, roofs, **`facades`**
  (windows/doors), **HEROES** registry (named landmarks → custom builders), **`styledHouse`**
  (renders `b.style` homes — federal brick mansions / georgian / queen-anne turret),
  **`mbtaTrain`** at the station, **`placeBenches`** (edge-lined in parks/plazas),
  beach crabs + woodland critters, **Plum Island** varied colors+materials (mostly
  painted clapboard, some shake), pumpkins, gravestones, **13 Fox Run Drive**, and
  **The Residences on the Ridge** (95 High St) + its carriage house — cream Second Empire
  heroes built from reusable `mansard()` / `clad()` (soft-shade walls) / `gableEnd()`
  helpers. (Plum Island's **runway renders as turf**, in `index.ts` `drawPath`.)
- `src/three/water.ts` — the animated water mesh + `isFreezableWater` + winter ice mesh.
- `src/three/sky.ts` — **`Sky`**: the day–night cycle (gradient dome, sun/moon disc, stars)
  + weather (rain; snow in winter). NO clouds (removed by request). The sun follows a
  hand-shaped curve (`SUN_T`/`SUN_E`) — long midday, lingering golden sunrise/sunset, and
  only a brief, shallow, *brighter* night (lamps come on then). Owns `tod` (0–1, `period`
  ≈420s), returns a per-frame lighting palette + a `night` factor `Game` uses for lamps.
  Debug: `nbpt.time(0–1)`, `nbpt.weather(1|0|null)`. Has a **cinematic dusk** override
  (`duskIn`/`duskOut` — a `cine` field that holds `tod≈0.955` then eases back; sun/moon discs
  hidden while active) used by the Level 2 reveal cutaway.
- `src/game/interiors.ts` — hand-built **Interior** scenes (scene-swap, follow-light,
  gold marker, exit by walking south): **NewsroomScene** (the Daily News — Chapter 3
  plays inside), **DenScene** (Ch4), **StarRoomScene** (Ch5). The tunnel (Ch1/2) is its
  own `tunnel.ts`. Interactables route back through `getQuest().interact(tag)`; the
  scene's `interactable()` keys off the quest's `s2`/`s3`/`s4` step getters.
- `src/three/actors.ts` — the Kid + Clipper (the dog) meshes/animation.
- `src/three/textures.ts` — procedural material textures.
- `src/game/quest.ts` — **QuestRunner**: NPCs, the objective beacon, dialogue, the
  chapter spine + persistence (note the legacy keys: `nbpt-ch0-step` = player-facing
  **Chapter 1 "Overdue"**, `nbpt-ch2-step` = Chapter 3 "Daily News", etc. — the off-by-one
  continues into Level 2: `nbpt-ch5-step` = L2 Ch1 "The False Light", `nbpt-ch6-step` = L2 Ch2
  "The Walking Light"), the library door, the boat ride, the `'news'` ENTER door, and the
  `s2`/`s3`/`s4` getters + `interact(tag)` the interior scenes call back into. **Level 2** lives
  here too (gated by `this.l2`): the Joppa birdwatcher + mystery light + foundation, **Gram's
  Joppa relocation** (`gramSpot()`/`buildL2Props`), the slip dock, and the cinematic-reveal +
  kayak-grant callbacks (`onLookSea`/`onLookEnd`/`onKayak`).
- `src/game/hud.ts` — DOM HUD: objective pill (its icon is a live **steering arrow** pointing
  at the beacon — `setObjectiveArrow`), dialogue, TALK button, travel modal, the **journey
  panel** ("JOURNEY", 🧭 toggles it) — story grouped by **named Level** with chapters renumbered
  within each (mission `level`/`levelName`/`chapter`), a **Story | Collections** tab toggle
  (`journeyTab`), mission cards with ↻ replay, the backpack, first-visit **welcome card**,
  one-time **run-tip** toast, landmark banner, history cards, joystick.
- `src/game/eggs.ts` — the 24 hidden secrets (`xyzzy`, statues, Marco/pet, etc.).
- `src/game/history.ts` — gravestone/landmark "READ" plaques (true stories).
- `src/game/audio.ts` — all-procedural WebAudio (music, footsteps, gulls).
- `src/game/life.ts` — pedestrians, traffic cars, stray dogs, boats (~2× bigger now),
  and **gulls** wheeling over the harbor/beaches.
- `tools/` — the map pipeline (`build_world.mjs` reads OSM → `world.json`), parameterized
  per town via `towns/<id>/{town.json,map.mjs}` — see **docs/TOWNS.md**.
- `towns/<id>/public/world.json` — the whole town (buildings, roads, water, addrs, POIs).
- `docs/GAME_CONCEPT.md` — the chapter spine + design (one-year arc → Christmas finale).

---

## 5. Recent work

**June 23, 2026 — L2 Ch3 story rework: "The Mooncusser" → "The Lamplighter" (branch `claude/level-2-ux-story-audit-k1n82n`):**
- **Why:** the mooncusser (a robber who wrecks ships with false lights, defeated by snuffing his lamps) was the one antagonistic, destruction-themed beat in an experience whose whole thesis is *keeping/restoring/sharing* — L1's "the treasure was the town," L2's "the light was never yours to own, only yours to keep lit." It didn't fit. (Devin: "I don't love the story for level 2, specifically disabling the lights in the last chapter and the villain.")
- **The rework (all in `src/game/quest.ts`):** the "ghost light" is now **old Eben — a lighthouse keeper and your grandfather's friend**, who's rowed out and lit the drowned foundation every night for years, in memory. The gale keeps blowing his lamps out and his hands are too stiff to keep up, so the lobsterman sends you to **relight** them. **Same 4-lamp paddle hunt, inverted from snuffing to relighting** (`litLamps` set was `snuffed`; `lightLamp()` was `snuffDecoy()`; the decoy lamps now build a hidden `flame` subgroup that turns ON when you reach each, instead of being hidden when snuffed). At the last lamp you **meet Eben** (`meetKeeper()` was `catchMooncusser()`) — he knew your grandfather, hands you the watch, and lets the old light rest, sending you to wake the real range light for the finale. **No villain; deep grandpa payoff; sets up the finale's "bring the light home."**
- **Touched:** dialogue consts `LOBSTER_KEEPER`/`KEEPER_MEET` (were `LOBSTER_MOONCUSSER`/`MOONCUSSER_CATCH`); the NPC `npcs.lamplighter` (was `npcs.mooncusser` — warm navy-sweater/white-haired old keeper, not a hooded figure); objective text ("Relight the keeper's lamps — X of N" / "Reach the keeper at his last lamp"); the `l2c3` mission card title "The Lamplighter" + steps; all chapter-cards; relight sound is now `audio.bell()` (a warm catch) not `audio.thump()`. **localStorage keys unchanged** (`nbpt-ch7-step`, `nbpt-ch7-decoys`) so saves migrate cleanly. **`tsc` + `vite build` pass.** L2 is still gated behind `?l2`.
- Real-folklore docs (`docs/research/history.md` "Harry the Mooncusser") and the superseded `docs/MISSIONS.md` design sketch were left untouched.
- **Then a full Level-2 coherence/pacing/mood pass (same day), with fixes:**
  - **Mood — the ghost light is now paddled at dusk, not noon.** The premise ("comes on after dark") clashed with the day–night cycle returning to daylight right after the Ch1 reveal. New `Game.holdNight()`/`releaseNight()` hold the sky at a winter twilight (`sky.duskIn(0.9)`) across the whole walking-light mystery; the frame loop polls `quest.l2Night` (a new getter: `storyOn && l2 && ch5≥1 && ch8<1`) so it's **reload-safe** without new ctor plumbing. The Ch4 storm takes the sky over from there.
  - **Ending — guaranteed Christmas morning.** `calmStorm()` used to `duskOut()` back to *whatever time the storm started* (often afternoon) while the card says "morning." `Sky.duskOut(to?)` gained an optional target; the finale now eases to a fixed bright morning (`0.22`).
  - **Story hole — `KEEPER_MEET` no longer pre-empts Ch4.** It was announcing the harbor light was already dark and sending you to the tower, stepping on the lobsterman's finale beat. Rewritten to foreshadow the storm + hand off the watch ("you've got the hands for it now") and send you *home*; the lobsterman still delivers the "light's out → go light the tower" task.
  - **Weather continuity:** softened Ch3's pre-storm "gale/soaked-through" language to a brewing evening (wind + sea-spray); and the **Ch4 storm now breaks as the lobsterman's dialogue opens**, so the "wind has teeth now" narration matches the sky instead of arriving a beat late.
  - **Verified (static trace):** every L2 step has a valid objective + affordance, no dead-ends; chapter start/end positions are sensible (Joppa → slip → foundation → met-on-water → downtown tower → Christmas morning). One *by-design* pacing note left as-is: the Ch3 "met on the water" structure means a foundation→lobsterman→foundation zigzag (Devin's intentional "the paddle home IS the transition").

**June 20, 2026 — flight un-gated + L2 kayak-home transition (branch `claude/kayaking-scene-layout-nesckg`, not yet on `source`):**
- **✈️ Scenic flight is now PUBLIC** — removed the `?fly`/`nbpt-fly` dev-gate; `flightDev` → `flightEnabled = true`. Everyone gets the FLY prompt on the airfield.
- **✈️ Mobile flight OOM-crash fix (WebKit/iOS — all iOS browsers, incl. Chrome).** iOS reloads/crashes a tab over its per-tab memory cap. The killer wasn't the steady chunk *count* but the **churn**: at cruise you cross chunk boundaries constantly and each 768² ground chunk allocates a CanvasTexture + backing canvas (~5.5 MB) faster than WebKit reclaims the freed ones. Cap-lowering (200→120→60) did NOT fix it on a 6 GB iPhone 14 Pro. **What works:** on phones (`this.mobile` = coarse-pointer/touch) flight streams **decor-only chunks** — `buildChunk(key, decorOnly=true)` skips the per-chunk ground mesh/texture **and** the canvas-textured shop signs, building only the 3D building/scenery decor (shared materials, **no per-chunk textures**) over the **whole-map impostor** (built at startup, world-fixed, provides the ground/roads/water). So you see the town's 3D shape from the air with flat, low memory. `clearChunks()` runs on the flight transitions (`startFlight`/`land`) so takeoff sheds the ground-textured walking chunks and landing rebuilds full ground. Mobile flight ring is tighter + cap 90 (cheap decor). Desktop unchanged. Debug: `nbpt.diag()` → `{mobile, flying, chunks, heapMB}`. (History: first tried impostor-only/flat-map `centers=[]`, stable but "lame — can't see the town"; decor-only restores the buildings.) Next lever if ever needed: lower `groundCanvas` res (`world/index.ts`, 768²).
- **Reusable feature-promo card** (`Hud.featurePromo({key,icon,title,body,badge?,cta?,onCta?})`, DOM `.promo`) — a one-time "what's new" popover for shipped features; shows once per `key` (localStorage). First use: the flight promo (`nbpt-promo-flight`), fired from `Game.tryFlightPromo()` a few seconds after load when nothing else is on screen, with a "Take me to the airfield" CTA → `travelToXY(AIRPORT)`. **Use this for future feature drops.**
- **L2 kayak transition rework** — sea chapters no longer teleport you to the slip; you keep the free-roam kayak and **paddle home**. The **lobsterman moved out onto the water** (his boat at `LOBSTER`); the Ch3 + Ch4 meetings auto-trigger as you paddle near him (`meetLobster()` in `update()`). Also fixed the 🛶 KAYAK button overlapping the dialogue (gated on `dialogueOpen`).

**June 18, 2026 — Ch3 + playtester fixes + season rework:**
- **Ch3 "The Mooncusser" BUILT** (`quest.ts`, key `nbpt-ch7-step`). A salty **lobsterman** at the Joppa slip explains mooncussers kid-clear (replaced an over-Gram'd draft — Devin: "too much gram, want more interesting characters"; see `nbpt-cast-variety`). Beat 2 was first a dialogue-only catch, then **redesigned into a snuff-the-false-lamps minigame** (Devin: "ch3 was pretty boring, just dialogue") — 4 scattered decoy lamps (`DECOYS`), beacon points to the nearest, paddle into each to snuff (`snuffDecoy`, bitmask `nbpt-ch7-decoys`), then catch him at his last light. `warmGlow()` helper extracted; `buildKayak()` moved to `actors.ts` (shared by the ride + the docked kayak).
- **Land-ashore fix** — finishing a sea chapter left you stranded ~7700px out at the light; now `Game.landAtShore()` + the `onReturnAshore` quest callback drop you back at the slip (Ch2 reveal + Ch3 catch both call it).
- **Drowned-foundation visibility fix** — it was built once at `ch5=0` and never re-shown, so a no-reload playthrough saw no foundation at the Ch2 reveal; `apply()` now re-asserts it.
- **Walking-on-water fix** (`Game.ts`, PUBLIC) — on foot you couldn't be stopped from strolling onto the open harbor (the `free` predicate only checked `isBlocked`, not water); now it rejects water unless a deck (`deckHeightAt > WATER_Y`, so bridges/piers/boardwalks still walk). The unstick net marches an adrift player back to shore.
- **Stale golf-course lake removed** (PUBLIC) — a Reddit playtester flagged a phantom lake at the Laurel Rd subdivision (old course, dried up, now housing). Added a `DROP_OSM` exclusion set in `build_world.mjs` (ways 279021841 + 920420732 + relation 12474826) and rebuilt `world.json`.
- **Onboarding** (PUBLIC) — welcome-card gate replaced with a one-time "find your street" toast (instant drop-in preserved). See `nbpt-onboarding`.
- **Season rework** (PUBLIC) — was a silent summer→fall→winter creep; now **all of L1 is summer**, and **finishing L1 fires a "Seasons Unlocked" reward card → winter** for the L2 Christmas arc (`storySeason()→'summer'`; `seasonsUnlocked()` reads `nbpt-seasons-rewarded`; `Game.unlockSeasons()` + `hud.seasonsUnlockedReward()`). See `nbpt-seasons-timeline`.
- **Phone speed** (PUBLIC) — kids reported running too fast into houses; on-foot joystick multiplier 0.72 → **0.55** (`Game.ts` ~1174). See `nbpt-mobile-controls`.
- **Git:** the PUBLIC fixes above were shipped to `origin/source`; the **2 L2 commits (Ch3 snuff redesign + land-ashore) are held LOCAL** (Devin: finish L2 first). Shipping public-without-L2 used a **reorder** (cherry-pick the public commit first, push only it) — see §8.

**June 17, 2026 — LEVEL 2 build (later same day; all deployed, gated behind `?l2`):**
- **Decided Level 2 = "The Light That Walks"** (cozy lighthouse mystery). Whole-game arc is now
  **land→sea→sky** across L1/L2/L3; **flight moved to L3** (spring/post-game). Spine + design in
  the top banner + the `nbpt-level2` memory.
- **`?l2` dev-gate** (mirrors `?fly`): latches `localStorage nbpt-l2`; ALL Level 2 sits behind the
  `quest.l2` flag — the public game is unchanged (still ends at the Custom House). Test gotcha:
  `?l2` re-latches across reloads, so navigate to a clean URL to simulate a public visitor.
- **Ch1 "The False Light"** (`quest.ts`) — Joppa birdwatcher + a clamming-heritage beat → earn
  **binoculars** → a **cinematic reveal**: dialogue splits intro→(cutaway)→reveal, the camera
  swings out over the water (`Game.cineLook` + `lookOutToSea`/`endLookOut`), the sky dips to dusk
  (`Sky.duskIn`/`duskOut` — sun/moon discs hidden so the sun never visibly travels), and a fog-less
  **mystery light** glows far out on the dark water (it shrinks as you approach → resolves into the
  foundation).
- **Ch2 "The Walking Light"** — **Gram relocated to a Joppa home** (post-L1, `gramSpot()`) → take
  grandfather's **kayak** at the **Joppa slip** (visible plank dock + tied kayak) → paddle out to
  the light → reaching it reveals a drowned granite **foundation**: the lighthouse *walked*.
- **The free-roam KAYAK** (`Game.ts`, key `nbpt-kayak`) — an earnable, launch-anywhere water
  vehicle (player-driven cousin of the Ch4 boat ride): `🛶 KAYAK`/`🛶 HOP OUT` buttons, seated
  rowing pose, Clipper in the bow, ~80×16 box hull. Moves on water OR open sea (`free` = `isWaterAt
  || terrain < WATER_Y`); the on-foot **unstick net is excluded on water** (it read open sea past
  the built chunks as "blocked" and walled the kayak in — the "invisible wall" bug). Light pushed
  way out at `LIGHT (12000,-2200)`; camera far-plane + fog open while kayaking/cutaway so it renders.
- **Journey panel reorg** (`hud.ts`, `items.ts`) — story grouped by named **Level** (chapters
  renumber within each), **Story | Collections** tab toggle, objective pill icon is now a live
  steering **arrow** (was a static ◈). Mission model gained `level`/`levelName`/`chapter`.
- **Fixes:** `findFree` avoids water (fast-travel never drops you in the sea — marches to the
  nearest shore); scrolling a HUD modal no longer zooms the world; removed the false **"Joppa =
  JOP-pee" pronunciation** (per Devin — untrue) from the plaque + docs.
- **NEXT: Chapter 3** (who's lighting the ghost → the storm/Christmas finale, cozy & no-rescue).

**June 17, 2026 (earlier same day — all deployed):**
- **✈️ Scenic flight from Plum Island Airport** — a whole new vehicle/mode on the real
  **Runway 10/28**. Walk to the airfield → **✈️ FLY**, take off west over town, bank
  around, **🛬 LAND** (touch buttons; lands you where you are). Cozy + uncrashable. It's
  **PRIVATE / dev-gated**: only devices that opened `clippertown.io/?fly=1` once (latches
  `localStorage nbpt-fly`) ever see it — the public never does. **Don't un-gate.** All in
  `Game.ts`. **White-horizon fix:** a big ground **skirt** plane + bigger flight chunk-
  streaming + a raised chunk cap, so distance reads as hazy land, not white-rendering-in.
  **NEXT:** the **1910 first-flight Echo** at the airfield + the proper story gate (see the
  `nbpt-flight-prototype` memory).
- **🗼 Runway is turf** — Plum Island 10/28 renders as the real mowed grass strip, not
  asphalt (`drawPath`, `index.ts`); taxiways/apron stay paved.
- **🏚️ 95 High St = "The Residences on the Ridge"** — replaced the brown box with a hand-
  modeled **cream Second Empire HERO**: granite base, steep slate **mansard** (reusable
  `mansard()` helper), pedimented **dormers** (`gableEnd`), a canted **bay window**, a
  railed **porch**, plus the matching **carriage house** (its own hero). Set well back off
  the High/State sidewalks. Footprints live in `MANUAL_BUILDINGS` (build_world.mjs) **and**
  world.json (hand-edited — no regen, see Gotchas); the look is in `HEROES` (decor.ts).
  `clad()` = brighter-in-shade walls.
- **🎒 Worn backpack** on the kid once the bag is earned (`hud.hasBackpack()` →
  `Kid.setBackpack`). Also closed the HUD compass↔season gap when the 🎒 button is hidden.
- **Seasons unlock fix** — the picker unlocks AND applies at the finale climax (one gate,
  `seasonsUnlocked()` = ch4≥3; `spineComplete` deleted — it was a one-step-late bug that
  left the picker live but inert). See `nbpt-seasons-timeline`.
- **☀️🌙 Sun/moon no longer punch through buildings** — pinned camera-relative, just inside
  the far plane, so buildings occlude them at every zoom (`sky.ts` + `Game.ts`).
- **Story — the den bell rings ONCE** — the Ch4 soft ring now counts as the first of three;
  the Ch5 keeper reveals it, so you ring only the two harbor bells (Coast Guard + wharf),
  no second row back to the den. Save-safe (counts retroactively when ch4≥3). Also: going
  back to the den no longer replays the whole boat-ride + arrival narration.
- (A parallel session also pushed *"houses: render tall stock / never split a garage"* —
  `decor.ts`. Rebased my work cleanly on top — both live.)

**June 16, 2026 — LAUNCH DAY (all deployed):**
- **Launched to r/Newburyport** — wrote the promo post + scouted a hero-shot tour
  (Market Square / High St / boardwalk / Plum Island Light). Going well.
- **tap-to-pet** — removed the always-on "PET" action button (the dog heels next to you, so
  it showed constantly). Tap/click Clipper directly to pet him (`Game.tryPetTap` hit-tests
  the dog's screen pos → `eggs.petDog()`); the action button is now real interactions only.
- **Cars no longer freeze the player** — the unstick safety-net only checked walls, so a car
  (life obstacle, ~20px radius) could pin you with no escape. Now checks walls OR life
  obstacles and rings outward to push you to open ground.
- **Refresh resumes your position** — saved every poll (overworld only) + restored on load
  (kept, not consumed), so a refresh/crash drops you where you were, not at Market Square.
- **Boat ride** — kid now **sits and rows** (seated pose in `actors.ts`, `Game` passes
  `boating` to `Kid.update`) instead of running in place; **Clipper faces the water**
  (`Dog.faceTo` drives the heading sub-group + clears the stray root spin).
- **Plum Island = sand** (east of `PLUM_X` in `index.ts`: grassy polys + chunk base →
  sand) and **marshes got tall reed beds** (wetland plantings in `treesFor` + reed geometry
  in `decor.ts`).
- **Driveways draw UNDER the roads** now (they were bleeding gray onto the asphalt).
- **Mobile/UX:** season switch keeps your map spot; the bottom hint shows touch controls on
  phones (not WASD); bike button is a high-contrast cream SVG (was a low-contrast blue
  emoji); pet hearts are pink on every platform (drawn as a path, not the ❤ glyph).
- **Analytics reconnected** — GoatCounter, site code **`clipper`** (it was on `main` only
  and got wiped by each deploy; now in `source/index.html` so it survives). **Don't drop
  that `<script>`** — see the `nbpt-analytics` memory.

**June 15, 2026:**
- **Phone-autonomous deploys (CI).** Added `.github/workflows/deploy.yml`: every push to
  `source` builds + publishes to clippertown.io via GitHub Actions (built-in `GITHUB_TOKEN`,
  no `gh`). `npm run deploy` is now just an optional Mac fallback. Verified end-to-end. See §3.
- **Default branch → `source`** (was `main`) so phone/cloud sessions branch off the real
  code, not the built output (which caused the old "dist edits off main" mess). GitHub Pages
  still serves `main` — that's a separate setting, unaffected.
- **Build stamp:** `window.__build` now reports the live source commit (quick deploy check).
- CI actions pinned to `@v6` (Node 24 runtime).

**June 14, 2026 (all deployed):**
- **Day–night reshaped** — long days + lingering golden sunrise/sunset, only a brief,
  shallow, brighter night (dark ≈19% of the cycle, tunable via `SUN_T`/`SUN_E` in
  `sky.ts`). **Clouds removed.** **Street lamps now cast warm light at night** (pooled).
- **The Daily News** rebuilt as a walk-in newsroom (`NewsroomScene`) — enter on Liberty
  St; Chapter 3 (editor → paper route → bike → morgue) now plays **inside**.
- **Architecture styles** on the ~16 DB-tagged historic homes (`b.style`): Federal brick
  mansions, Georgian, a Queen Anne turret (`styledHouse`); `build_world` now extracts
  `building:architecture` so a rebuild keeps them.
- **Plum Island** = varied colors + materials now (was all brown shake).
- **Story fix (Ch 1 "Overdue")** — after the donuts + book you report **back to Gram**,
  then Clipper finds the grate (it used to send you past her to the gate).
- **Mobile movement** — sub-stepped + wall-slide collision so run/bike in narrow streets
  glides instead of snagging on house corners.
- **Tunnel fix** — corridors B↔C had a phantom-wall doorway (couldn't reach the cache
  room/map); opened it. Grate re-entry radius widened.
- **Onboarding/UX** — first-visit **welcome card**; one-time **"press R to run"** toast;
  journey panel simplified, then the carried **items moved into it** (HUD chip tray
  removed) and the 🧭 compass toggles it with a slide/fade animation. Red minimap ping,
  bigger boats, MBTA **train**, park **benches**, **gulls/crabs/critters**, **hop-over
  stone walls**, "Exploring Newburyport, Massachusetts" title.

**June 13:** rebrand to Clipper Town; Fuller Field fix + storefronts; Chapter 0/1 polish +
real library door; fast-travel clearance; fall pumpkins; fence-hopping; frozen walkable
ponds; **13 Fox Run Drive** (navy house, red door, pool).

---

## 6. Known gaps / follow-ups

- **🎯 Level 2 "The Light That Walks" — Chapters 1–3 built; the Ch4 finale is the last piece.**
  **The full build guide is §0** (design + asset map + add-a-chapter pattern). After Ch4: polish the
  whole level, then **push the held L2 batch + decide when to un-gate** (publish L2). Side-content
  ideas for later: Dexter's statues (side-quest); a "Clam Digger of Joppa" minigame (natural Joppa
  side-activity).
- **✈️ Flight — now PUBLIC (un-gated 2026-06-20), still earmarked as Level 3's tool.** Devin
  un-gated it ("it's so cool, don't hide it") with a one-time promo card. It's still a free-roam
  toy for now; **Level 3 = sky/spring** is its eventual story home: the **1910 first-flight Echo** at the
  airfield earns the plane, opening the Wild Port nature layer (plovers/eagles/whales, binocular
  bird-log). Polish: Clipper as co-pilot; land back at the runway; tune speed/alt/camera; trim
  streaming if heavy (the skirt covers the void). See `nbpt-flight-prototype` + `nbpt-level2`.
- **Marketing:** launched on Reddit (r/Newburyport). **Next channel = Facebook** + more subs
  (r/Massachusetts, r/WebGames, etc.) — hold the bigger pushes until the **mobile / FB
  in-app-browser** experience is verified and the build's polished. Reuse locals' phrasing
  ("I found my house!").
- Watch the r/Newburyport launch thread for "missing X / wrong street" reports — fast fixes
  + "added it, check again" replies (locals love that). (Now ~a week old; lower urgency.)
- **Unfinished: the 5th promo screenshot** (snowy Inn Street, winter night). Photos #1–4
  were captured (Market Square summer / High St fall / boardwalk sunset / Plum Island Light
  winter); #5 was paused. Capture tips (in `nbpt-preview-verification`): viewport **≤768px**
  for a full capture (≥1280 paints only ~800px — a preview artifact), the **real** sunset is
  `nbpt.time(0.91–0.94)` (the hook's "0.75=dusk" is wrong vs the `SUN_T`/`SUN_E` curve),
  night ≈0.97–0.03; **reload before each `nbpt.travel`** (a 2nd travel renders stale chunks),
  hide overlays via injected CSS (`#hud .help,#hud .mini{display:none}`).
- **Scaling (back-pocket):** it's a static CDN site, so **concurrency is a non-issue** —
  no server to overload. The only ceiling is GitHub Pages' ~100 GB/mo soft cap ≈ **~28k
  unique visitors/month** (each first load ~3.7 MB: world.json 2.1 + heights.bin 1.3 + JS
  0.3; repeat visits are cached). If it ever surges → move to **Cloudflare Pages** (free,
  *unlimited* bandwidth, same static deploy, just repoint clippertown.io).
- **The Tannery** building (a lost cloud-line feature) is still NOT here — rebuild as a
  `decor.ts` HERO if wanted (needs a reference photo). The **Daily News** newsroom, the
  other lost interior, has now been rebuilt (`NewsroomScene`).
- **House architecture styles** only cover the ~16 homes the OSM data actually tags
  (`building:architecture`, mostly Federal); the other ~10k homes stay generic. The DB
  has no broader style/year data — more variety would have to be procedural (see the
  `nbpt-architecture-styles` memory).
- Open for tuning (the user has iterated on these): day length (`period` in `sky.ts`),
  the night brightness floor (`sunI`/`hemiI` in `sky.ts`), the **ice tint**.
- Flag anything that looks regressed vs. the old live site (old `b48`–`b75` cloud builds).

---

## 7. Gotchas (learned the hard way)

- **Deploy uses `rsync --delete`** — anything not in `dist/` is removed from the live
  site. `public/CNAME` + the favicon live in `public/` so they're emitted to `dist/`.
  If `public/CNAME` ever goes missing, **clippertown.io breaks**.
- **(FIXED July 2026)** `npm run build-world` used to wipe hand-added data. All curation
  (the Fox Run pool, manual buildings, level fixes, landmarks) now lives in
  `towns/<id>/map.mjs` and is re-applied on every rebuild — regenerating world.json is
  safe and byte-stable. (Historical context below.) The
  **`b.style` tags survive** (build_world re-extracts `building:architecture`). **Non-OSM
  buildings** (95 High St / The Residences + its carriage house) live in `MANUAL_BUILDINGS`
  in build_world.mjs AND are hand-added to world.json. **So don't `build-world`** for a
  manual-building or footprint tweak — edit `world.json` directly (targeted find-replace;
  validate with `node -e "require('./public/world.json')"`) and mirror it in
  `MANUAL_BUILDINGS`. CI never runs build-world.
- **Concurrent / mobile sessions touch the same `source` branch.** Work can silently
  diverge, and a parallel session's `git add -A` can sweep YOUR uncommitted files into its
  commit (confirmed — a building once shipped inside a "flight" commit; on 6/17 a "houses"
  commit landed mid-session). So: `git status` + `git fetch` at session start AND right
  before staging; **stage explicit paths (`git add src/...`), never `git add -A`**; if a
  push is rejected, `git fetch` + `git rebase origin/source` (usually clean — disjoint
  files) and push. See `nbpt-mobile-git-risk`.
- **Vite serves stale transforms** after rapid edits — if a change "doesn't take,"
  stop and restart the dev server (don't just reload).
- **Preview tab throttles requestAnimationFrame** during waits; drive verification with
  the `window.nbpt` hooks, not by sleeping.
- **Seasons:** pumpkins show in **fall**, ice/snow/lights in **winter** — switch via the
  season picker in the travel panel (🗺) or `nbpt.season('winter')`.
- **Inland ponds are painted on the ground canvas** at terrain elevation (the water
  *mesh* is sea-level only) — relevant if you touch water/ice rendering.

---

## 8. Starting a new session

1. Open a new Claude Code session **in this folder** (`/Users/devingalvin/claude_apps/nbpt-living`).
2. **The task: finish Level 2 — build the Ch4 finale. START WITH §0** (design + asset map + the add-a-chapter pattern). Suggested first message: *"Read HANDOFF.md §0, then build the Level 2 finale (Ch4 'Bring the Light Home')."* Project memory loads automatically — `nbpt-level2` is the deep reference.
3. **⚠️ Mind the held L2 commits.** At session start: `git fetch && git log origin/source..source` — local `source` is ahead of `origin/source` by 2 unpushed L2 commits (Ch3 snuff + land-ashore). Build Ch4 on top; when L2 is done, `git push origin source` ships the whole batch.
4. **To ship a PUBLIC hotfix before L2 is done** (don't push the held L2): reorder so the public commit is first, push only it —
   `git branch -f backup source && git reset --hard origin/source && git cherry-pick <publicCommit> <heldL2commits…>` (public first), verify `git diff backup source` is empty + `tsc` the deploy state, then `git push origin <publicCommit>:source`. The L2 commits stay local on top. (Done twice on 6/18.)
5. Verify with `npm run dev` + the `nbpt` hooks (§3/§7); `npx tsc --noEmit`. Stage **explicit paths**, never `git add -A` (concurrent sessions — §7).
6. Ignore the old cloud "Clipper Town" / "Clipper City" sessions — this folder supersedes them.
