# Clipper Town — Handoff

A cozy, all-ages Zelda-like set on the **exact map of Newburyport, MA**. Three.js +
TypeScript + Vite. Live at **https://clippertown.io**.

> ## 🚀 LIVE & stable at clippertown.io — launched June 16, 2026 to r/Newburyport
> (the "I found my house!" hook landed). A LOT has shipped since launch — see §5. Every
> build stamps its commit at `window.__build`.
>
> **🎯 LEVEL 2 — DECIDED & BUILDING (gated).** "The Light That Walks": a cozy lighthouse
> mystery, fall→winter→Christmas. The arc is now **land→sea→sky** (L1 land/summer = shipped;
> L2 sea/winter; L3 sky/spring). **Flight moved to Level 3** (its spring / post-game home —
> finally a reason for the dev-gated plane). L2 kid spine: a spooky light off **Joppa Flats**
> (earn **binoculars**) → **kayak** to the river mouth (the lighthouse *walked* — real NBPT
> history) → the channel shifted + a storm's coming → **"Bring the light home"**: the big
> stormy night with **NO peril and NO player-rescues** (Devin cut that — it breaks the
> kind-by-default pillar) — you relight the lighthouse, sweep the beam to *find* the boats,
> and the town lights up in answer → Christmas morning. **Built + verified so far: Ch 6
> beat 1** (the Joppa birdwatcher + binoculars + the mystery-light reveal). **GATED exactly
> like flight:** `?l2=1` latches `localStorage nbpt-l2`; all Level 2 sits behind the
> `quest.l2` flag, so the public game still ends at the Custom House (verified gate-off).
> **Don't un-gate until we publish.** Next = beat 2 (the kayak). See the `nbpt-level2` memory.
>
> Also live but **private/dev-gated**: a **scenic flight** from Plum Island Airport
> (`clippertown.io/?fly=1` to enable on a device) — see §5 + the `nbpt-flight-prototype` memory.

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
  first-visit welcome card + one-time "press R to run" toast, and **✈️ scenic flight**
  (`enterPlane`/`startFlight`/`stepFlight`, a `flying` branch in `frame()` + `updateCamera`,
  the ground **skirt** for the horizon, the worn-backpack toggle; dev-gated via `?fly`).
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
  Debug: `nbpt.time(0–1)`, `nbpt.weather(1|0|null)`.
- `src/game/interiors.ts` — hand-built **Interior** scenes (scene-swap, follow-light,
  gold marker, exit by walking south): **NewsroomScene** (the Daily News — Chapter 3
  plays inside), **DenScene** (Ch4), **StarRoomScene** (Ch5). The tunnel (Ch1/2) is its
  own `tunnel.ts`. Interactables route back through `getQuest().interact(tag)`; the
  scene's `interactable()` keys off the quest's `s2`/`s3`/`s4` step getters.
- `src/three/actors.ts` — the Kid + Clipper (the dog) meshes/animation.
- `src/three/textures.ts` — procedural material textures.
- `src/game/quest.ts` — **QuestRunner**: NPCs, the objective beacon, dialogue, the
  chapter spine + persistence (note the legacy keys: `nbpt-ch0-step` = player-facing
  **Chapter 1 "Overdue"**, `nbpt-ch2-step` = Chapter 3 "Daily News", etc.), the library
  door, the boat ride, the `'news'` ENTER door at the Daily News, and the `s2`/`s3`/`s4`
  getters + `interact(tag)` the interior scenes call back into.
- `src/game/hud.ts` — DOM HUD: objective pill, dialogue, TALK button, travel modal,
  the **journey panel** (🧭 compass toggles it with a slide/fade; holds the carried
  ITEMS — `setChips` just tracks the list, no HUD tray anymore — plus chapters as
  colored dots + a "found N of M" town-history list), first-visit **welcome card**,
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

**June 17, 2026 (all deployed):**
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

- **🎯 DECIDE "Level 2" (the next main chapter).** Open design call — see the banner at the
  top. Leading idea: **"The Long Night"** nor'easter (present-day, no re-render, uses every
  system; the Ridge = the real high ground). Dexter's statues = a good *side-quest*, not a
  main level. Bring Devin options or build the storm.
- **✈️ Flight — make it real.** Currently a working but **private prototype** (dev-gated
  `?fly`). Next: the **1910 first-flight Echo** at the airfield (earns the plane); a proper
  **story/post-game gate** (GAME_CONCEPT frames it as a post-game/Spring capstone); polish
  (Clipper as co-pilot; land back at the runway instead of wherever you are; tune
  speed/alt/camera; if it's heavy on phones, trim the flight streaming radius — the skirt
  covers the void). See the `nbpt-flight-prototype` memory.
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
2. First message suggestion: *"Read HANDOFF.md, confirm the deploy workflow, then …"*
   (or just give it the next task — it will pick up the project memory automatically).
3. Make changes here → verify with `npm run dev` / the `nbpt` hooks → **`git push origin source`** (CI auto-deploys in ~1–2 min; confirm via `window.__build`). `npm run deploy` is just a Mac fallback.
4. Ignore the old cloud "Clipper Town" / "Clipper City" sessions — this folder supersedes them.
