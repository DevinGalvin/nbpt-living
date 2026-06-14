# Clipper Town — Handoff

A cozy, all-ages Zelda-like set on the **exact map of Newburyport, MA**. Three.js +
TypeScript + Vite. Live at **https://clippertown.io**.

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
npm run deploy         # build, then push dist/ to main → live in ~30-60s
```

- **Deploy** (`tools/deploy_pages.sh`): runs `npm run share`, clones the Pages repo
  to /tmp, `rsync -a --delete dist/` over it, commits + pushes to `main`. The CDN
  lags ~30-60s; the served bundle hash (`assets/index-XXXX.js`) changing confirms it.
  (To verify a deploy went live: poll `clippertown.io/index.html?cb=$(date +%s)` for
  the new `index-XXXX.js` hash — a background `until` loop works well.)
- **Always** commit source changes to the `source` branch too (keeps it canonical):
  `git add -A && git commit && git push origin source`.
- **In-browser debug hooks** (great for verifying): `window.nbpt` → `go(x,z)`,
  `travel(id)`, `find(q)`, `pos()`, `zoom(z)`, `season('summer'|'fall'|'winter')`,
  `time(0–1)` (0=midnight·.25=dawn·.5=noon·.75=dusk), `weather(1=storm|0=clear|null=auto)`,
  `_game` (internals), `_THREE`.
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
  the interior scene-swap (`enterNews`/`enterDen`/`enterStar`/tunnel), and the
  first-visit welcome card + one-time "press R to run" toast.
- `src/world/index.ts` — **WorldIndex**: spatial buckets, the painted **ground canvas**
  (`fillPoly`/`terrainFill`), the **collision grid** (`buildCollision`, red=blocked),
  `isWaterAt`/`frozenWaterAt`/`isBlocked`/`surfaceYAt`/`lowBarrierNear`, shop signs,
  pitch markings, deck heights.
- `src/world/style.ts` — palette + **`SEASON`** (resolved from `?season=` or
  localStorage `nbpt-season`); a table-swap re-dresses the whole town per season.
- `src/world/terrain.ts` — real elevation (heightAt/normalAt) from `public/heights.bin`.
- `src/three/decor.ts` — all 3D building/scenery generation: walls, roofs, **`facades`**
  (windows/doors), **HEROES** registry (named landmarks → custom builders), **`styledHouse`**
  (renders `b.style` homes — federal brick mansions / georgian / queen-anne turret),
  **`mbtaTrain`** at the station, **`placeBenches`** (edge-lined in parks/plazas),
  beach crabs + woodland critters, **Plum Island** varied colors+materials (mostly
  painted clapboard, some shake), pumpkins, gravestones, **13 Fox Run Drive**.
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
  hand-added data** — notably the **13 Fox Run Drive pool** and the "Heart of Clipper
  Town" Market Square sub-banner (both hand-edited in world.json). The **architecture
  `b.style` tags survive** (build_world now re-extracts `building:architecture`), but
  don't rebuild without re-adding the pool + sub.
- **Mobile Claude Code sessions may not push to git** — work can silently revert/diverge.
  Check `git status` + `git log` (HEAD vs `origin/source`) at the start of every session
  before assuming the code matches the live site (see `nbpt-mobile-git-risk` memory).
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
3. Make changes here → verify with `npm run dev` / the `nbpt` hooks → `npm run deploy`.
4. Ignore the old cloud "Clipper Town" / "Clipper City" sessions — this folder supersedes them.
