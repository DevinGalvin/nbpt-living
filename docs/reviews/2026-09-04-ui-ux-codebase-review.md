# UI · UX · Codebase review — 4 Sep 2026

Reviewed at `6e3987a` on `source`. Typecheck clean. 31,481 lines of TypeScript across
the engine, twelve town packs, the HUD, and the tooling. Screens measured on a
390×844 phone viewport with touch emulation, plus landscape and desktop, in headless
Chromium.

Severity: **P0** can lose data or break play · **P1** hurts players today · **P2** quality, maintainability.

## Fix these first

1. **P0 · Delete or fix `tools/deploy_pages.sh`.** It clones without `-b main`, the repo's
   default branch is `source`, and it rsyncs with `--delete` then pushes. One run from a
   Mac replaces the source branch with built output. CI already deploys. (`tools/deploy_pages.sh:21-31`)
2. **P0 · Guard every `localStorage` call and wrap `frame()`.** Storage-blocked browsers
   throw on access; two unguarded reads run every frame, and one throw inside the
   animation loop ends it for good. (`Game.ts:726, 2478-2479, 2612, 351`; `quest.ts` has 43 accesses, 1 guarded)
3. **P0 · Lock down the leaderboard.** Any curl can post a 5-second time to the top of every
   board and create new sheet tabs. Whitelist town and course ids, add a per-course
   plausibility floor, rate limit. (`infra/leaderboard/worker.js:19, 69-88`; `apps-script.gs:61-67, 98-134`)
4. **P1 · Clear held keys on window blur.** Alt-tab with W held leaves the dog walking into
   a wall. The bark latch has the same shape. (`Game.ts:629-657, 616-617, 1073-1086`)
5. **P1 · Fix the service worker handoff.** The new worker deletes the cache the old one
   just filled, so every deploy downloads the town twice and the game is not
   offline-bootable until the following visit. The update toast fires on a tab already
   running the new build. (`public/sw.js:15-20`; `src/main.ts:22-33`)
6. **P1 · Remove unlit point lights from the scene.** Sixteen `PointLight`s at intensity 0
   all day; every fragment pays for all sixteen. (`Game.ts:439-451`)
7. **P1 · Use the per-town history key in the bag and restart list.** `hud.ts` reads the
   literal `nbpt-history-read`; `history.ts` writes `townKey('history-read')`.
   (`hud.ts:2523, 2810`; `history.ts:13`)
8. **P1 · Replace `build:all` with a loop over `towns/*/town.json`.** (`package.json:19`)

## 1 · What a kid sees

- **P1 · The objective's ◂ reads as Back.** It is a waypoint pointer, but a left chevron in a
  pill at the top of the screen is the universal back control (UX rule 2). (`hud.ts:1712`)
- **P1 · One feature, three names.** Button says QUESTS, panel says JOURNEY, tab says Story. (`hud.ts:1675, 2505, 2508`)
- **P1 · Dialogue card covers SKATE and RUN.** The stack is not hidden during dialogue; only TALK is lifted. (`hud.ts:919-920, 369, 953`)
- **P1 · Four popups in the first ten seconds.** Mode pick, street nudge, gear hint, heavy-mobile
  notice, race promo, each retrying every 2.5s. (`Game.ts:735-759, 821-824`)
- **P1 · Landscape phone does not fit the left column.** SETTINGS lands at 378px on a 375px
  viewport; no landscape media query exists. (`hud.ts:127, 193, 226, 788, 955, 973`)
- **P1 · Scroll-start opens album tiles.** `pointerdown` inside a scrolling card. (`hud.ts:3475, 3401, 1805`)
- **P1 · Fades and scrims stop at the safe-area edge.** Overlays are `inset:0` of the inset `#hud`. (`hud.ts:63-65, 3778`)
- **P1 · Double joystick dead zone** (10% in HUD, 8% again in Game, ~17% net). (`hud.ts:1935-1942`; `Game.ts:2034`)
- **P1 · Sprint on touch is a hidden two-finger hold** with no hint; bark/sniff/dig share one
  button by press length and dig cancels silently. (`hud.ts:1871-1900`; `Game.ts:1073-1086, 2551-2573`)
- **P1 · Keys that change the world with no hint.** C, V, and 1-9; the digit targets are
  Newburyport ids, so other towns fade to black and return. (`Game.ts:632-633, 651-655`)
- **P1 · Silent failures.** Skate indoors/on water, bark while flying, failed leaderboard
  post. Copy the kayak's "No open water" line. (`Game.ts:1037, 1074, 1236`; `race.ts:175-181`)
- **P2 · The compass rotates the letter, not a needle.** Facing south, N renders as Z. (`hud.ts:1996`)
- **P2 · Permanent "0" badge on DISCOVER.** Show the pip only above zero. (`hud.ts:1730, 3427`)
- **P2 · Search placeholder clips mid-quote** on 390px; four-line tile names break the grid rhythm. (`towns/nbpt/index.ts:80`)
- **P2 · Replay/reset controls miss rules 4 and 6.** 20px pills, consequence only in `title=`. (`hud.ts:1079-1081, 2634, 2692, 1159-1163, 2274`)
- **P2 · Text under 12px everywhere.** Labels 8px, attribution 8.5px, season names and album
  years 9.5px; locked chapter titles at ~2:1 contrast. (`hud.ts:100-107, 95, 87, 643, 878-879, 1069, 1076`)
- **P2 · Light across text on the level card.** 5.5s infinite beam over the LEVEL 2 title. (`hud.ts:1191-1197, 1235`)
- **P2 · No ARIA, no focus management, Escape only sometimes.** (`hud.ts:2464, 2561, 2720, 2992`)

Keep: the two-slab first choice, ‹ Towns above the town name, dialogue type size, the
single-pass tile stagger, the trophy shine on the border.

## 2 · Ship-stoppers in the engine

- **P1 · Contradictory `pagehide` assumptions on iOS.** Game kills the GL context; diag says
  iOS fires it on every app switch. Reload on `pageshow` when `isContextLost()`. (`Game.ts:389-394`; `diag.ts:209-214`)
- **P1 · Audio dies after first backgrounding;** stale bars pile up on resume. (`audio.ts:121-127, 907-910`)
- **P1 · Preferences are accidentally per-town** (sound, welcomed, run-tip, promos). Move to
  `GLOBAL_KEYS`; add a save version. (`vite.config.ts:35`; `audio.ts:132`; `Game.ts:742-747, 832, 845`)
- **P1 · Resume position saved mid-flight.** (`Game.ts:2612, 3175`)
- **P1 · Fast travel builds up to 49 chunks synchronously.** Build a 3×3 core under the fade. (`Game.ts:3039-3057, 3106`)
- **P2 · Per-frame work:** `ensureRect` re-sorts with `split(',')` in the comparator; a
  `querySelector` and two storage reads per frame; `Life.update` retries pathing every frame
  when nothing can spawn; compass and race timer write the DOM without diffing.
  (`Game.ts:886-935, 2476-2481`; `life.ts:1229-1266`; `hud.ts:1996, 2168-2196`)
- **P2 · Shadows and MSAA not gated on mobile.** (`Game.ts:372, 375-407`)
- **P2 · Casts that disable the checker:** `(player as Dog).setDigging?.()`. (`Game.ts:1090-1091`; `race.ts:371, 396`)

## 3 · The HUD file

- **P1 · Newburyport hardcoded** in the welcome card and album stamp; identity colours
  hardcoded in JS-built panels. (`hud.ts:1742, 2884, 2504-2505, 2854-2856, 3507`)
- **P1 · Two chapter-key lists that disagree.** Restart misses five Level 2 keys. (`hud.ts:2523, 2672`)
- **P2 · Dead CSS and duplicate blocks:** `.chint`, `.collect-empty`, `.sp-item`, `.nb-chip`,
  `.travel-towns`, `.chapter.reward`, radius tokens; four copies of the action-button rule;
  nine modal backdrops. (`hud.ts:863-869, 1452, 1490, 610, 1167-1172, 51, 343-425`)
- **P2 · `esc()` applied in four places, skipped in eight.** (`hud.ts:18, 2881, 2339, 2398, 2609-2655, 2836, 2539`)
- **P2 · Listeners never removed; inits not idempotent.** (`hud.ts:2992, 2309-2466`)

## 4 · Towns and story

- **P1 · quest.ts and eggs.ts read nothing from the town pack.** `story: true` means "run
  Newburyport's story here". Needs a `StoryPack`. (`quest.ts:23-60, 112-115, 142-173`; `eggs.ts:30-187`; `school.ts:223`; `Game.ts:58-59, 2856-2865`)
- **P1 · Four towns advertise races that do not exist** (amesbury, manchester, rockport,
  salisbury). Masked by `RACES_UI`. (`src/towns/amesbury/index.ts:64-67`)
- **P1 · Nothing validates pack data against the world.** Course gates, quest addresses,
  `landmarkTops`, town.json vs index.ts parity (Gloucester's tag has drifted).
  `check_markers` runs nowhere. (`tools/check_markers.mjs:52`; `quest.ts:187-191, 1660`)
- **P2 · Pack boilerplate:** identical fall blocks, promo bodies, street nudge HTML across
  twelve packs; border-lore dates disagree between packs. Wants `definePack()` and a shared
  `municipalities.ts`.
- **P2 · Quest state machine:** chapter order hand-encoded three times; eggs addressed by
  array index; eleven `Math.hypot < R` checks. (`quest.ts:1060-1113, 1132-1296, 1344-1346`; `eggs.ts:417-708`)
- **P2 · Reading level** sits at grade 5-8 in places; Indigenous cards carry the heaviest
  words and lead every list; British spellings in Boston/Charlestown; the library book is
  "three weeks late" in the bag and "due in March of last year" in dialogue.

## 5 · Rendering and perf

- **P1 · The box family is wound backwards and DoubleSide hides it.** Verified by hand:
  `Bucket.box` top face cross product points down against a declared up normal; front and
  back faces flipped too; `walls()`/`flatRoof()` are consistent. Three negates back-face
  normals under DoubleSide, so every box top gets ground colour and no sun: cars, chimneys,
  lamps, benches, gravestones, boats, every tree canopy. Fix the winding, then go
  FrontSide and keep `shadowSide` double. (`decor.ts:81-90, 766-829, 1537-1549, 1889-1905, 6788-6797, 10017`)
- **P1 · Chunk builds are count-budgeted, not time-budgeted.** (`Game.ts:908-909`)
- **P1 · Candidates × features loops per chunk** (parking, trees, gravestones, `frontSegment`
  up to six times per building). A per-chunk occupancy grid replaces most.
  (`decor.ts:9527-9565, 1494-1507, 2606-2630, 9181-9202`; `index.ts:461-512`)
- **P1 · WorldIndex caches never evicted.** Add `index.evictChunk(key)`. (`index.ts:322-327, 600, 648, 811, 1383, 2180, 2238`)
- **P2 · Camera and renderer disagree on building height;** deck heights hardcoded twice.
  (`decor.ts:2177-2206, 20-21`; `index.ts:2150-2166, 1428-1433`)
- **P2 · Kid is 45 meshes with 45 `MeshStandardMaterial`s** and 864-tri spheres for
  sub-pixel eyes; carries a dead copy of Dog's API. (`actors.ts:12-14, 179-184, 245-281`)
- **P2 · 44-byte non-indexed vertices;** ~50MB GPU memory to reclaim. (`decor.ts:9976-9996`)
- **P2 · Duplicates:** OBB lambda 34×, sun-shade 12×, colour preamble 229×, five shoelace
  copies, eight nearest-on-polyline copies, three point-in-polygon copies, two identical
  picket fence emitters. `quadUV` takes 26 positional numbers.
- **P2 · Stringly-typed feature kinds and unit soup** (`/ 64`, `M = 8`, `FT` in three places; `pxPerMeter` never read).

## 6 · Build, deploy, repo

- **P1 · No CI on pull requests;** no lint, no tests; Node 20 is past end of life. (`.github/workflows/deploy.yml:8-9, 54`)
- **P1 · `build:all` one-liner** with `rm -rf && mv` per town; share build emits an 11MB HTML
  into the Pages branch each deploy. (`package.json:19`; `vite.config.ts:114, 138`; `tools/make_share_html.mjs:43`)
- **P2 · 151MB of regenerable data committed** (`data/*/raw/overpass.json`, `data/terrain/`). (`.gitignore:9-14`)
- **P2 · Ten root handoff files, several contradictory;** README still describes Phaser 4 and
  a Python tilemap pipeline. (`README.md:20, 31, 82, 86`; `BEVERLY-HANDOFF.md:3-5`; `HANDOFF.md:15-17`)
- **P2 · Shell injection in dispatch inputs;** floating action majors, no Dependabot. (`build-world.yml:52, 64, 73`; `fetch-data.yml:40, 52`)

Solid: the storage shim is correct for today's code; the filter sync check; twelve towns from
one commit; every pack typechecks when aliased.

## 7 · Where the code should live

**hud.ts → src/game/hud/**: `util.ts`, `tokens.css.ts`, `chrome.ts` (collapse the left column to
flex), `joystick.ts`, `panels/modal.ts` (one open/close with role, focus, Escape, one scrim),
`panels/{travel,settings,collection,discoveryCard,journey,bag,race}.ts`, `dialogue.ts`,
`toasts.ts`, `cinematics.ts`, `minimap.ts`, `fx.ts`, and a ~300-line `hud.ts` façade that
keeps the ~80-method public surface Game.ts uses.

**Game.ts → src/game/**: `storage.ts`, `input/Input.ts`, `world/Streamer.ts`,
`player/Locomotion.ts` (one mover per mode), `player/DogVerbs.ts`, `camera/ChaseCam.ts`,
`scenes/SceneStack.ts`, `travel/FastTravel.ts`, `onboarding/Promos.ts`, `debug/hooks.ts`, and a
~300-line orchestrator owning `frame()` order. Nine copies of "place the player" and eight
copies of `Math.max(terrain.heightAt, index.deckHeightAt)` collapse into `placePlayer()` and
`index.surfaceYAt`.

**decor.ts → src/three/geom/ + src/three/decor/**: `geom/{bucket,geom,prims}.ts`,
`decor/{walls,roofs,facades,buildings,vehicles,bridges,vegetation,furniture,scatter,seasonal}.ts`,
`decor/heroes/<town>.ts` + `kit.ts`, and `decor/index.ts` running `buildChunkDecor` as passes
over a shared `ChunkCtx` with one `inChunk(x, z)`.

Order: pure helpers first, then one panel or module at a time. Every step is cut-and-paste
behind a façade with no behaviour change.
