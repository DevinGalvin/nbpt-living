# Clipper Town — Handoff

A cozy, all-ages Zelda-like set on the **exact map of Newburyport, MA**. Three.js +
TypeScript + Vite. Live at **https://clippertown.io**.

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
> - **Ch3 "The Mooncusser"** — you meet a salty **lobsterman in his boat OUT ON THE WATER** as you paddle home (he hails you — auto-triggers near his anchored boat, `LOBSTER`); he explains mooncussers (kid-clear); you paddle back out and **snuff his scattered false lamps** (an active hunt) → catch him → paddle home → he flags you down again for the storm.
> - **Ch4 "Bring the Light Home" (FINALE)** — the storm breaks: the lobsterman (met again on the water) sends you to the downtown **Rear Range Light**; climb + **🔦 LIGHT IT**, then **sweep the beam** (signature mechanic — a pinned "turret" mode) across the dark harbor to catch the 4 **lost boats**; all caught → the **Coast Guard** leads the fleet up-river, storm calms to **Christmas morning**, closing line *"the light was never yours to own, only yours to keep lit."* The light stays lit forever after.
> - LIVE/public: the **free-roam KAYAK** (key `nbpt-kayak`) and the **"Seasons Unlocked" reward** (finish L1 → winter, picker unlocks).
> - **✅ GIT STATE (2026-06-18):** the **whole L2 batch is now PUSHED + DEPLOYED** to `origin/source` → clippertown.io (build `a64bf2b`). It includes the **Ch4 finale**, a **UI/UX design-system pass** (public), and the **kayak-on-open-water-only + walk-across-frozen-ponds fixes** (public). **L2 is still GATED behind `?l2`** — the code is live but dormant; the public game still ends at the Custom House. Chapter keys: Ch1=`nbpt-ch5-step`, Ch2=`nbpt-ch6-step`, Ch3=`nbpt-ch7-step`, Ch4=`nbpt-ch8-step`.
> - **➡️ NEXT TASK:** decide **when to un-gate L2** (publish it to everyone) — a full Ch1→4 playtest first is wise. Until then, keep building behind `?l2`.
>
> Also live but **private/dev-gated**: a **scenic flight** from Plum Island Airport
> (`clippertown.io/?fly=1` to enable on a device) — see §5 + the `nbpt-flight-prototype` memory.

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
- **Built + verified (gated `?l2`):** Ch1 "The False Light", Ch2 "The Walking Light", Ch3 "The Mooncusser" (a **snuff-the-false-lamps** minigame — paddle out, the beacon points to the nearest of 4 decoy lamps, paddle into each to snuff it, then catch the mooncusser at his last light). **The sea chapters no longer teleport you home** — you keep the free-roam kayak and **paddle back yourself**; the **lobsterman is met out on the water** (his anchored boat at `LOBSTER`, auto-trigger in `update()` like the reveal) instead of at the slip, so the paddle home IS the transition. (`Game.landAtShore`/`onReturnAshore` are now unused but left wired.)
- **Chapter keys** (legacy off-by-one): Ch1 = `nbpt-ch5-step` (var `ch5`), Ch2 = `nbpt-ch6-step` (`ch6`), Ch3 = `nbpt-ch7-step` (`ch7`). **The finale = `nbpt-ch8-step` (`ch8`).** Ch3 completes at `setCh7(2)`.
- **⚠️ GIT — the 2 newest L2 commits are HELD LOCAL (not pushed):** the Ch3 snuff redesign + the land-ashore fix. `origin/source` (live) has only the public fixes (lake removal, walking-on-water fix, onboarding nudge, phone-speed cut, the Seasons-Unlocked reward). Devin's plan: **finish Ch4, then push the whole L2 batch.** `git log origin/source..source` shows the held commits; a `backup-before-season-split` branch is a safety net.
- **Test on `npm run dev`, NOT the live site:** the live `?l2=1` still has the OLD Ch3 (dialogue) + the stranding bug — the fixed versions are only local until the L2 push.

### The finale design (DECIDED with Devin — don't re-litigate)
- **Premise:** the mooncusser's caught, but the nor'easter's here and the real harbor light is dark — boats are out with nothing true to steer for. You **light the lighthouse and sweep its beam to bring the boats home**; the town answers light-for-light → Christmas morning.
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
| **Backups/dead branches** | `cloud-source` + `claude/*` = old dist snapshots; ignore them |

---

## 3. Run / verify / deploy

```bash
npm install            # first time
npm run dev            # dev server at http://localhost:5173 (HMR)
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
  `fly()`/`land()` (✈️ flight — only works on a `?fly`-enabled device), `_game`, `_THREE`.
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
  the ground **skirt** for the horizon, the worn-backpack toggle; dev-gated via `?fly`),
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
- `tools/` — the map pipeline (`build_world.mjs` reads OSM → `world.json`; see Gotchas).
- `public/world.json` (5.8 MB) — the whole town (buildings, roads, water, addrs, POIs).
- `docs/GAME_CONCEPT.md` — the chapter spine + design (one-year arc → Christmas finale).

---

## 5. Recent work

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
- **✈️ Flight — make it real (now earmarked as Level 3's tool).** Working but **private prototype**
  (dev-gated `?fly`). **Level 3 = sky/spring** is its home: the **1910 first-flight Echo** at the
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
- **`npm run build-world` regenerates `public/world.json` from OSM** and would **wipe
  hand-added data** — the **13 Fox Run Drive pool** and the "Heart of Clipper Town" Market
  Square sub-banner (both hand-edited in world.json, NOT reproduced by build_world). The
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
