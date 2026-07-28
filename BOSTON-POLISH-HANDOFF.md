# Boston polish — session handoff (7/27–7/28/2026)

Cold-start doc for the session that follows. `BOSTON-HANDOFF.md` is still the
reference for how Boston was *built*; this is what changed after it shipped, what
is still wrong, and the traps that cost real time.

**Everything below is LIVE.** Six commits, all pushed to `source`, all deployed
green. Verified on clippertown.io/boston/ with `window.__build` = `0a62aa0`.

| commit | what |
|---|---|
| `cc8c4e0` | the 6-storey cap, windowless landmarks, the Citgo sign, facade variety, town switcher |
| `a006eb0` | Trinity's polychromy, King's Chapel, Back Bay bay windows |
| `9f0bc4a` | landmark arrival, LOOK UP, the `buildingTopAt` clamp |
| `2d4450b` | Fenway's seats + stadium-interior clear, terrain smoothstep, button collision |
| `6264e8a` | 157 jets at Logan, glass terminals, `glassMix`, elevated spans, storefront + State House |
| `0a62aa0` | five lo-fi music styles in Settings |

---

## The one thing to take away

**Four separate defaults, invisible in every town that had been tested, were
silently destroying the city.** None of them were bugs in the sense of "wrong
code" — each was a reasonable number chosen when nothing in the data could reach
it:

1. `lv` clamped to **6** in three places in `build_world` and a fourth in the
   renderer. Boston had 2,827 buildings at exactly 6 and no skyline at all.
2. `buildingTopAt` clamped `lv` at **5**, so the chase camera thought a
   sixty-storey tower was five storeys and sat inside the Prudential.
3. `travelToPlace` derived its stand-off from the curated `r` and capped it at
   **320 px**. Fenway's footprint is 2186 × 1466 px.
4. Storefront spacing was **18 px** with display glass **19 px** wide, so every
   shop front touched its neighbour and a long ground floor was one black ribbon.

**A default that is invisible in every case you have tested is not validated, it
is untested.** When a new town is bigger, denser or taller than the set, go
looking for the constants rather than waiting to be shown a screenshot.

---

## What shipped

### The skyline
Per-town `maxLevels` in `map.mjs` (default 6 → every existing town bakes
byte-identical; Boston 60). The `areaM2 > 5000 → lv ≤ 2` guard now applies only
below a measured 24 m and caps at 3. Boston: **1,314 buildings over 8 storeys,
53 over 30**, tallest are the real ones.

`towerBlock` / `curtainWall` above `HIGHRISE_LV = 8` — glazing bands and
mullions emitted **per EDGE, not per window**, plus lobby storey, crown,
mechanical penthouse and a mast past 22 storeys.

### Landmarks
- `gridWindows()` — the hero equivalent of `facades()`. About thirty landmarks
  had **no windows at all** because the shared builders never called `facades()`.
- `mfaBoston`, `venetianPalazzo` (the Gardner), `kingsChapel`, rebuilt
  `trinityChurch`, rebuilt Fenway interior, `airportTerminal`, `citgoSign`.
- `TOWN.landmarkTops` — real px heights a storey count cannot know (spire,
  obelisk, mast, rooftop sign). Eleven entries.

### Arrival
`landmarkMass()` measures the real footprint; `sightlineScore()` is 3-D and
returns a **fraction**, not a boolean; candidates ranked
`open*100 − |dist−ideal|/100` inside a bounded window. **128 of 129 Boston
landmarks arrive with a completely clear view** (the 129th is a reservoir seen
across water, 98%). Newburyport 32/32. Arrival also forces the name banner, sets
zoom, and tilts up for tall targets (52 of 129).

### Camera
👀 **LOOK UP** (button + `V`). The chase cam aims ~26° DOWN; it now tilts ~18° up,
drops toward street level and opens the far plane to 11000. Releases on movement.

### Materials
- `TOWN.masonryMix` (Boston 0.45) — stone as well as brick.
- `TOWN.glassMix` (Boston 0.5) — mid-rise commercial/civic 4 storeys and up gets
  a curtain wall. The band between a brick block and a tower was the gap.
- `TOWN.bayWindows` (Boston 0.55) — the canted Boston bay, **26,250 buildings**.
- Per-kind window shapes, per-building glazing tint and lit fraction, granite
  lintels, belt courses.

### Terrain
Heightfield sampled with **smoothstep-weighted bilinear** instead of plain
bilinear. Plain bilinear is only C0 — the slope jumps at every cell boundary on
a 64 px grid — so the landscape was made of four-sided tents with hard ridges,
and paths draped over it kinked at every cell line. Node values are untouched.

### Logan
157 real-size aircraft on real gate stands, glass terminals, per-terminal apron
polygons. See the traps below.

### Elevated spans
Buildings carry `my` — the height their walls start at — from OSM
`min_height` / `building:min_level` (25) or inferred for a small thin footprint
lying across a road (38). Skipped when rasterising collision, so you walk under.

### Music
Five lo-fi styles in Settings (`porch` / `rain` / `night` / `sunroom` / `fog`),
saved to `nbpt-music`. The style is instance state read fresh each bar, so a pick
takes effect at the next bar. Season still colours whatever is playing.

---

## STILL OPEN — start here

1. **The aircraft are underwhelming at eye level.** Correct in size, number and
   position, and they read from above and along the ramp — but pale grey rather
   than convincingly white, and the fuselage reads flat against the apron. Wants
   another pass on materials and fuselage section. `airliner()` in `decor.ts`.
2. **Nobody has heard the music.** All five schedule without throwing and the
   derived numbers are deliberately spread (bar 3.6–9.5 s, key 98–165 Hz, melody
   density 5–50%), but whether Night Drive's walking bass sits right against its
   pad, or Harbor Fog is too empty, needs ears. Five numbers each to adjust.
3. **Fenway seat colour is green and that was a deliberate call.** Devin asked
   for red seats; two sources (Wikipedia, Fenway Fanatics) describe the lone red
   seat as standing out because it is *"completely surrounded by dark green
   seats"*. Built green with the one red seat modelled larger than life so it can
   be found. **If Devin asks again, make it red — he has been told the finding.**
4. **Boston still shows a lot of brick.** `glassMix` covers 4+ storey
   commercial/civic. Sub-4-storey commercial is still all brick, which is right
   downtown and wrong in the Seaport and Kendall. A district-aware mix would fix
   it.
5. Salem, Beverly and Charlestown have real three-decker fabric and could opt
   into `bayWindows`. Deliberate not-yet, not an oversight.
6. `data/salem/raw` and `data/beverly/raw` are **not in this tree** (built in
   worktrees), so those two towns cannot be rebaked here. Their `world.json` is
   unchanged and will pick up the small `lv` corrections whenever they are
   rebaked.

---

## Traps that cost real time

**Judging the wrong building.** I spent three contact sheets concluding King's
Chapel rendered as a dark office block. It is genuinely tiny and its neighbour is
a tall dark block. **The MAGENTA TEST — tint the hero's own palette `#ff00ff`,
rebuild, shoot — settles it in one pass and should be the FIRST move, not the
last.**

**`cone()` is a 16-gon.** On a square tower it reads as a round hat, which is what
made Trinity a chess rook. Use a four-sided `taperBand` pyramid.

**Keep `TOWER_SKINS` LIGHT.** Two shading passes multiply. Swatch-accurate
mid-greys produce a skyline of silhouettes. And `era: 'brick'` skins are
near-WHITE TINTS — `brickTex` is already red, so a red here multiplies to black.

**A roof one shade off the walls turns a big building into a lump.** The game's
camera is elevated, so on a large footprint the roof is most of what you see.
This is what was actually wrong with the State House extensions — the wall
detail I added first was barely visible.

**Walk a perimeter by ARC LENGTH, not edge by edge.** Logan's terminals are
traced in fine detail (Terminal B has 281 vertices) so nearly every edge is
shorter than a gate: per-edge found 34 stands, arc length found 157.

**A roof over a ring seals what is inside it.** Fenway's grandstand, then the
forts' parade grounds. Use `annulusRoof`.

**A hero does not own footprints inside itself.** OSM maps Fenway's stands as
their own 19,532 m² `building=yes` inside the stadium relation — 58% of the
park's area — so a brick block with storefronts rendered where the first-base
grandstand should be. `manualFeatures` clears anything whose centroid falls
inside a stadium.

**Set the arrival zoom, never `max()` it.** Maxing ratchets forever: one trip to
a ballpark parks the camera inside the building behind you for every landmark
after it.

**Measure the camera lift against the camera's ACTUAL position.** When a wall
clamps the camera in, the horizontal run collapses and a fixed vertical rise
becomes a vertical stare at the sky.

**The distance penalty in arrival scoring has to bite.** At `/500` a marginally
clearer view three times too far away wins — Old South Meeting House was chosen
from 292 m.

---

## The contact-sheet harness

Not in the repo — it is pasted into the console. Recipe:

- index `G.world.buildings` by name; `G.buildChunk(key)` **directly** (the frame
  loop's LRU evicts a distant forced chunk before you can render it)
- `G.renderer.setAnimationLoop(null)` first
- move `G.px/G.pz` and call `G.sky.update()` or the sky dome is elsewhere and you
  shoot against black
- push `scene.fog.near/far` to 200k/400k — **but then the whole-map IMPOSTOR
  becomes visible as a huge pale curved surface that fills a low camera's frame.**
  Hide any mesh whose bounding box is wider than 20000 px.
- **world y maps to three.js +z, not −z** (`ringToVec2` negates and `quad`
  negates again)
- framing constants matter: `dist = size*k + 420` is fine for a landmark and
  useless for a rowhouse — keep an absolute-distance shot function alongside
- draw the grid into a canvas and set it as a full-screen `<img>` overlay, then
  take a normal viewport screenshot; store the harness in `localStorage` so it
  survives the reloads that every source edit forces

**And check through the real game camera before believing the harness.** Several
"the model is broken" readings were the harness's fog/impostor, not the world.

---

## Deploy note

**The service worker serves the previous build on the first load after a
deploy.** `window.__build` read the old SHA twice this session before I cleared
the SW. That is the documented cache-keyed-per-build behaviour, not a failed
deploy — check `git show origin/main:boston/index.html | grep index-` against
what the site serves before concluding anything is wrong.
