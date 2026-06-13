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
npm run share          # build + inline single-file dist/ClipperTown.html
npm run deploy         # build, then push dist/ to main → live in ~30-60s
```

- **Deploy** (`tools/deploy_pages.sh`): runs `npm run share`, clones the Pages repo
  to /tmp, `rsync -a --delete dist/` over it, commits + pushes to `main`. The CDN
  lags ~30-60s; the served bundle hash (`assets/index-XXXX.js`) changing confirms it.
- **Always** commit source changes to the `source` branch too (keeps it canonical):
  `git add -A && git commit && git push origin source`.
- **In-browser debug hooks** (great for verifying): `window.nbpt` → `go(x,z)`,
  `travel(id)`, `find(q)`, `pos()`, `zoom(z)`, `season('summer'|'fall'|'winter')`,
  `_game` (internals), `_THREE`.

---

## 4. Architecture / key files

- `src/game/Game.ts` — the engine: chunk streaming, player/dog movement + height,
  camera (chase cam), fast-travel (`travelTo`/`findFree`), water/ice setup, fence-hop.
- `src/world/index.ts` — **WorldIndex**: spatial buckets, the painted **ground canvas**
  (`fillPoly`/`terrainFill`), the **collision grid** (`buildCollision`, red=blocked),
  `isWaterAt`/`frozenWaterAt`/`isBlocked`/`surfaceYAt`/`lowBarrierNear`, shop signs,
  pitch markings, deck heights.
- `src/world/style.ts` — palette + **`SEASON`** (resolved from `?season=` or
  localStorage `nbpt-season`); a table-swap re-dresses the whole town per season.
- `src/world/terrain.ts` — real elevation (heightAt/normalAt) from `public/heights.bin`.
- `src/three/decor.ts` — all 3D building/scenery generation: walls, roofs, **`facades`**
  (windows/doors), **HEROES** registry (named landmarks → custom builders), pumpkins,
  stadium, gravestones, the **13 Fox Run Drive** special-case (navy + red door).
- `src/three/water.ts` — the animated water mesh + `isFreezableWater` + winter ice mesh.
- `src/three/actors.ts` — the Kid + Clipper (the dog) meshes/animation.
- `src/three/textures.ts` — procedural material textures.
- `src/game/quest.ts` — **QuestRunner**: NPCs, the objective beacon, dialogue, the
  chapter spine + persistence (localStorage `nbpt-ch0-step` etc.), the library door.
- `src/game/hud.ts` — DOM HUD: objective pill, dialogue, TALK button, travel + journey
  modals (with ✕ close), landmark banner, history cards, joystick.
- `src/game/eggs.ts` — the 24 hidden secrets (`xyzzy`, statues, Marco/pet, etc.).
- `src/game/history.ts` — gravestone/landmark "READ" plaques (true stories).
- `src/game/audio.ts` — all-procedural WebAudio (music, footsteps, gulls).
- `src/game/life.ts` — pedestrians, traffic cars, stray dogs, boats.
- `tools/` — the map pipeline (see Gotchas before running).
- `public/world.json` (5.8 MB) — the whole town (buildings, roads, water, addrs, POIs).
- `docs/GAME_CONCEPT.md` — the chapter spine + design (one-year arc → Christmas finale).

---

## 5. Recent work (this session, June 13 2026)

Deployed in order: rebrand to Clipper Town; Fuller Field stray-track fix + storefronts
for shop/food buildings (incl. Angry Donut); Chapter 0 polish (TALK button no longer
clobbered, Pet button contextual, Clipper named, donut/library NPC placement, real
library double door); then an 8-item batch — fast-travel clearance (Custom House no
longer wedges you in a wall), fall pumpkins (more + bigger), fence-hopping (kid + dog
hop low fences/hedges; walls still block), mobile modal close buttons + objective
auto-hide, **13 Fox Run Drive** (navy house, red door, backyard pool), and **frozen
walkable ponds in winter** (rivers/ocean stay open).

---

## 6. Known gaps / follow-ups

- **The Tannery** building was a cloud-line feature whose source was lost; it is NOT
  in this folder. Rebuild it as a `decor.ts` HERO if wanted (needs a reference photo).
- There may be other small cloud-line polish (the old `b48`–`b75` builds) not present
  here — flag anything that looks regressed vs. the old live site.
- Open for tuning: the **ice tint** (could be bluer/glossier) and the **fence-hop arc**.
- The **Angry Donut / library** Chapter-0 dialogue here is this folder's "dialogue
  pass" — if a specific wording was wanted, confirm against the script in `quest.ts`.

---

## 7. Gotchas (learned the hard way)

- **Deploy uses `rsync --delete`** — anything not in `dist/` is removed from the live
  site. `public/CNAME` + the favicon live in `public/` so they're emitted to `dist/`.
  If `public/CNAME` ever goes missing, **clippertown.io breaks**.
- **`npm run build-world` regenerates `public/world.json` from OSM** and would **wipe
  hand-added data** — notably the **13 Fox Run Drive pool** (added directly to
  world.json). Don't rebuild the world without re-adding hand edits.
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
