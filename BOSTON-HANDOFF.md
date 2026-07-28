# Boston — town #12

Everything about Boston in one place: what was measured, what was decided and
why, what shipped, and what is still open. Read this before touching Boston.

> **Status: IN PROGRESS** (started 7/27/2026). This file is written as it goes,
> so a cold session can pick it up mid-build.

## The headline: the blocker was measured, and it mostly isn't one

`HANDOFF.md` and `docs/research/boston-sizing.md` both said Boston was gated on
a data-streaming rewrite, because the engine parses `world.json` whole at boot.
Before doing that work, it got measured. **The feared numbers do not reproduce.**

A properly-scaled Boston payload (Beverly's `world.json` with every heavy array
scaled 4.06x, to 119,414 buildings) measured on an M-series Mac:

| | the fear | **measured** |
|---|---|---|
| `world.json` raw | 26-34 MB | **23.2 MB** |
| over the wire | not considered | **~8 MB** (Pages already serves `content-encoding: gzip`) |
| `JSON.parse` | "multi-second on a phone" | **65 ms** here → ~200-400 ms on a mid-range phone |
| transient memory | "150-300 MB spike, iOS tab-kill" | **48 MB retained** after forced GC |

Beverly ships 6.07 MB raw / **2.05 MB gzipped** today and its live headers
confirm the gzip. So Boston is a **~4x download increase, not a parse crisis**.
The loading-progress card and service worker already cover exactly that.

Honest caveats, stated so nobody re-derives them: the synthetic replicates
Beverly's data, so its gzip ratio is optimistic — but applying Beverly's *real*
2.96x ratio to 23.2 MB independently lands at ~8 MB, which corroborates. And
V8 is not iOS JSC; 48 MB is far enough from the danger zone that it is very
unlikely to flip, but the real bake is what settles it.

**Decision (Devin, 7/27): build full Boston on today's engine.** No per-tile
streaming, no binary format — yet.

### The binary format is still a good idea, just not a blocker

Buildings are 56% of the payload and their geometry is a flat integer array.
Delta-encoded (first point int32, the rest int16 deltas — measured: **180,957 of
180,957 deltas fit in int16, zero overflow**), Beverly's buildings go
**3.24 MB → 1.08 MB**. That is a real 3x cut that would benefit every town's
load time and kill `JSON.parse` outright. It is worth doing on its own merits.
It is not load-bearing for Boston.

## Overpass CAN serve Boston — the handoff was wrong about this

Both docs said "Overpass cannot serve Boston, even tiled" and prescribed a
Geofabrik PBF clipped with osmium. That was an **untested assumption**,
extrapolated from a 2x2 tiling of Salisbury drawing a 429. A 429 is a *request
rate* limit, which finer tiling plus a longer delay fixes.

Measured: a dense downtown Boston tile (1/64 of the frame) returned **9.3 MB in
2.3 s, HTTP 200**. Boston fetches with the existing tool at `OSM_TILES=8x8`.

Two changes to `tools/fetch_osm.mjs` made that safe, both verified
byte-identical on Charlestown (1x1 **and** 2x2: all 16,111 elements identical,
same key order, zero drift):

1. **The merge streams to disk.** It used to build `JSON.stringify(merged)` as
   one string with every element also live in a `Map`. Boston's 64 tiles merge
   to a few hundred MB — that exhausts the heap. Now only the seen-key `Set` is
   held and each new element is written straight through. Output is unchanged.
2. **`OSM_DELAY`** (default 2000, so every existing town is untouched). Boston
   runs at 6000 — at 2 s it drew a 429 by tile 4.

### `tools/fetch_osm_pbf.mjs` — written, NOT used, NOT verified

The osmium road got built before Overpass was tested. It converts a Geofabrik
`.osm.pbf` to the same `data/<id>/raw/overpass.json` contract, streaming, with
the two load-bearing details documented in its header (way geometry clipped to
the bbox **with nulls**, because `runsOf()` splits on exactly those; relation
member geometry **unclipped**, because rings must assemble exactly).

**It has never been run end to end.** Either verify it against a known town or
delete it — do not trust it as-is. Also note: the Mac's sandbox proxy blocks
large binary downloads (squid 502), and Geofabrik rate-limits parallel range
requests (8 connections earned a 503) — one connection with `-C -` resume is the
polite road, and it was still only doing ~30 KB/s.

## The frame

```
s 42.227   w -71.193   n 42.399   e -70.88        19.1 x 25.8 km
```

Chosen from measured counts, not drawn by eye.

- The rectangle holding all of Boston counts **216,640 buildings** — *not* the
  119,414 that `boston-sizing.md` measured against Boston's admin boundary. The
  gap is real and unavoidable: any rectangle containing Boston also contains
  Cambridge, Somerville, Brookline, Quincy, Newton, Milton, Chelsea, Everett and
  Revere. **Every projection in the sizing doc is therefore ~1.8x low.**
- That is the same bargain every town already makes (Charlestown reaches into
  the North End, Gloucester takes all of Cape Ann), and it is a feature: you can
  cross the Longfellow to MIT and see Harvard from the river.
- The east edge runs past the built-up shore to take in the outer harbor —
  Georges Island and Fort Warren, Long, Spectacle and Thompson, and Little
  Brewster with **Boston Light** on it, America's oldest light station (1716),
  inside the city limits and reachable only by kayak or by air. It costs almost
  no buildings; it is all ocean.

**Revised payload expectation: ~45 MB raw / ~15 MB gzipped `world.json`.** Parse
and heap scale linearly off the measurements above and stay fine; the
**download** is the real cost, and it is the thing to re-measure on the real bake.

**`heights.bin` is NOT a problem, despite looking like one.** The world is
25.8 x 19.1 km, and at the fixed `SPACING = 64` px (8 m) grid that is a
3257 x 2422 Int16 field = **~15 MB raw**, three times Gloucester's 5.11 MB. That
looked like it needed a per-town spacing knob (16 m would cut it to 3.8 MB). It
does not: terrain is smooth, so `heights.bin` **gzips 5.0-5.8x** (measured on
Gloucester and Charlestown), which puts Boston at **~2.7 MB on the wire**. Keep
the 8 m resolution — Beacon Hill and Bunker Hill are worth having. Do not
re-derive this; the knob is not needed.

## What the city exposed in the pipeline (fixed here, benefits every town)

The first fetch came back clean — 236.1 MB, 415,588 elements (39,981 nodes /
370,416 ways / 5,191 relations), no tile gaps (the low-yield tiles are all
open-harbor ones). Auditing it against a list of Boston landmarks turned up
three real pipeline faults, all of which a city is simply the first place to hit.

1. **`build_world`'s POI dedupe was O(n²).** For every POI it scanned every POI
   kept so far, calling `toLowerCase()` twice per comparison. At a town's few
   hundred POIs that is invisible; a city has tens of thousands of *named* POIs
   and it would have run for hours. Now bucketed by lowercased name — the only
   candidates that can match — so it is linear and the rule is unchanged.
   **Verified byte-identical on six towns**, with the dedupe path actually
   firing on four of them.

2. **Stadiums were not buildings.** OSM very often maps a stadium as a bare
   `leisure=stadium` area with no `building` tag: **Fenway Park** is a
   `type=multipolygon` relation tagged `leisure=stadium` + `amenity=music_venue`
   and nothing else. It was therefore fetched by no query and, had it been
   fetched, `polyKind()` would have dropped it and `buildingKind()` would have
   called it a `house`. Boston without Fenway Park is not Boston. Now
   `leisure=stadium`/`building=stadium` is fetched (way + relation) and treated
   as a building, classified `civic`.
   **Side effect, deliberate:** Charlestown's TD Garden (which carries
   `building=stadium`, so it was already present) reclassifies `commercial` →
   `civic` — right for an arena, which has no storefronts. That is **one
   building of 4,885** and nothing else moves; Charlestown's shipped
   `world.json` only changes if it is rebaked.

3. **Light rail was missing.** Only `railway=rail` was fetched, so the Green
   Line — which runs *at grade in the street* down the Commonwealth Ave and
   Beacon St medians and along Huntington, plus the Mattapan streetcar — did not
   exist. Now fetched. ⚠️ The Green Line's **central subway is also tagged
   `railway=light_rail`**, just with `tunnel=yes`; drawing that would lay track
   across the Common and down Tremont at grade. Guarded — the same lesson as the
   buried highways: check the tunnel tag, never trust the class.

4. **A walled place was reduced to a wall.** The `barrier=fence|hedge|wall`
   branch ran BEFORE `polyKind()` and `continue`d unconditionally, so any AREA
   that also carried a barrier tag lost its land cover, its name and its label
   and survived only as a bare outline. That is how **Granary Burying Ground** —
   Paul Revere, Sam Adams, John Hancock and the Boston Massacre dead — vanished
   from Boston entirely: it is tagged `landuse=cemetery` AND `barrier=wall`, and
   the wall won. It now draws the wall *and* falls through to build the place.
   **This was erasing things in four of the six towns with raw data**: Charlestown
   recovers **7 fenced ball fields and courts plus a playground** (Langone Little
   League Field, Puopolo Athletic Field, the Prince Street tennis courts —
   exactly the kid-life features the fast-travel recipe asks for), NBPT recovers
   4 clarifier basins, Gloucester 5 and Salisbury 4. Amesbury and Ipswich are
   byte-identical.

5. **`fetch_boundaries.mjs` sent no HTTP headers at all**, so
   overpass-api.de answered **406 Not Acceptable every single time** and the tool
   has silently been riding its slower fallback endpoints (which rate-limit
   harder) for its whole life. It now sends the same Content-Type / User-Agent /
   Accept as `fetch_osm.mjs`, and the main endpoint answered first try. This is
   not a Boston bug — **every town's border fetch was affected**.

### Naming notes for curation (OSM spellings differ from the real names)

- Old South Meeting House is **"Old South Meeting Place"** in OSM (and "Old
  South Church" in Copley is a *different* building).
- King's Chapel is **"Kings Chapel"**, no apostrophe.
- The **Zakim** bridge and **Make Way for Ducklings** carry no name in the
  fetched data (the Zakim's name lives on a `man_made=bridge` outline we do not
  fetch). This does **not** block them: curated landmarks in `map.mjs` are
  hand-authored `id/name/sub/x/y/r`, so they need no OSM name —
  `landmark_candidates.mjs` only *helps* find them.
- Confirmed present and correctly named: Faneuil Hall, Massachusetts State
  House, Old North Church, Trinity Church, Old State House, Paul Revere House,
  **Boston Light**, Quincy Market, Boston Public Library, Symphony Hall, Museum
  of Fine Arts, Isabella Stewart Gardner Museum, Custom House Tower, Fort
  Independence, Fort Warren, Castle Island, **the Citgo Sign**, Swan Boats,
  Hatch Memorial Shell, Longfellow and Tobin bridges.

### New tool: `tools/check_hero_names.mjs`

Run it before adding ANY hero. `HEROES` is keyed by OSM building name and the
renderer runs the builder on **every** footprint with that name — in a city that
is a live hazard, not a hypothetical. It lists names on more than one footprint,
with each footprint's area, because the tell is usually that one candidate is the
landmark and the other is a garage.

## Design intent (decided before the bake, to be anchored to real coords after)

**Flight — from Logan.** Boston is the first town in the set with a real major
airport in frame, runways and all. No invented airfield, no waterfront-apron
compromise like Charlestown's: you take off from the real Logan. Pick the
runway off the actual `aeroway` geometry once the world is built — 27 (west,
straight at downtown) and 22L (southwest over the harbor) are both spectacular.

**Races — the three that write themselves.** Boston's ladder is unusually easy
because the routes are already famous:
1. **Freedom Trail Dash** (~1 mi) — the Common to Faneuil Hall, past the State
   House, Park Street, the Granary, King's Chapel, Old South, the Old State
   House. The tourist route, run flat out.
2. **Right on Hereford, Left on Boylston** (~2 mi) — the Boston Marathon's last
   miles, Kenmore Square to the Copley finish line. The most famous stretch of
   running road in America, and the turn names are the course name.
3. **The Emerald Necklace** (~5 mi) — Olmsted's park chain, Common and Public
   Garden out along the Comm Ave Mall to the Fens, the Riverway and Jamaica
   Pond. The long one, almost entirely on grass and park path.

**Spawn — the heart.** Faneuil Hall Marketplace, which is Boston's Market
Square / Essex St Mall / Ellis Square: the central civic gathering place a local
would take a visitor to first. (Make Way for Ducklings and the Swan Boats are
the kid-heart, and both become landmarks — but the Public Garden is a
destination, not the crossroads.)

**Heroes.** Researched build specs live in `docs/research/boston-heroes.md` —
**12 written so far**: Massachusetts State House, Trinity Church, Faneuil Hall,
Fenway Park, Old North Church, Old State House, Custom House Tower, Quincy
Market, Boston Public Library, the Citgo Sign, Boston Light, Paul Revere House.
Each carries sources and the colour/material facts memory gets wrong (Trinity is
grey Dedham granite with brown trim, not red; the State House's Bulfinch centre
is red brick, sandblasted in 1928 specifically to prove it). Two notes that save
work: **Paul Revere House should reuse `firstPeriod()`**, and **Bunker Hill
Monument + USS Constitution are already built for Charlestown and sit inside
Boston's frame, so they should render for free.**

**borderLore — draft copy** (Boston has more neighbours in frame than any town in
the set; the banner fires on the more specific `boundary=place` ring first, so
Boston's own neighbourhoods — the North End, Back Bay, Southie — will announce
themselves before any city line does):

- **Cambridge** — "Across the river: Harvard, MIT, and more bookshops than bars."
- **Somerville** — "Seven hills and Davis Square, packed in tight."
- **Brookline** — "The town Boston grew all the way around, and never swallowed."
- **Newton** — "Thirteen villages pretending to be one city."
- **Watertown** — "Up the Charles, where the river stops being tidal."
- **Chelsea** — "Small, steep and hard-working, right across the Mystic."
- **Everett** — "Where the tankers and the casino share a shoreline."
- **Revere** — "America's first public beach, three miles of it."
- **Winthrop** — "A town on a sandbar, with the airport for a neighbour."
- **Quincy** — "The City of Presidents, and the granite Boston is built from."
- **Milton** — "Blue Hills at its back, the Neponset at its feet."
- **Dedham** — "Older than most of Boston, and quietly proud of it."
- **Needham** — "Out past the Charles, where the city finally gives up."

## THE BAKE — what actually came out

`npm run map:boston`, then `TOWN=boston node tools/fetch_heights.mjs`, then a
rebuild to apply the height overlay.

| | |
|---|---|
| buildings | **233,279** |
| roads / paths | 49,432 / 73,207 |
| addresses | 178,346 |
| POIs / labels | 9,182 / 3,970 |
| rails | 1,382 (incl. **288 surface light-rail** — the Green Line) |
| polys | 13,638 |
| welcome signs | 120 |
| ocean | **one polygon, 187.37 km², 51 island holes** — built first try |
| tunnels skipped | **127** (the Big Dig stayed buried) |
| Logan | 12 runways, 148 taxiways, 8 windsocks |
| Overture heights applied | **137,972 buildings** |

### The projection held — the fork call was right

| | projected (synthetic) | **measured (real bake)** |
|---|---|---|
| buildings | 119,414 | 233,279 |
| `world.json` raw | 23.2 MB | **45.6 MB** |
| gzipped | ~8 MB | **14.8 MB** |
| `JSON.parse` | 65 ms | **133 ms** |
| retained heap | 48 MB | **97 MB** |

**Everything scaled linearly with building count. No cliff.** 133 ms of parse and
97 MB of heap is why Boston needed no engine rewrite. `heights.bin` is 15.7 MB
raw / **3.9 MB gzipped**, so a **first visit downloads ~18.7 MB** and repeat
visits are ~0 through the service worker. That download is the real cost of a
city, and it is the number to watch — not the parse.

## What is DONE

- ✅ 233k-building world, terrain, Overture heights, 64 boundary rings
- ✅ **129 curated landmarks**, every coordinate boundary- AND dry-land-checked,
  covering every neighbourhood plus the kid-life tier (6 neighbourhood skating
  rinks, 10 playgrounds, the harbor beaches, Boston Light)
- ✅ spawn = **Faneuil Hall**, `check_town_spawn.mjs` green
- ✅ pack (`src/towns/boston/index.ts`), theme, 38 borderLore lines
- ✅ **3 races** authored on the real road graph: Freedom Trail Dash (1.2 mi),
  Right on Hereford Left on Boylston (2.2 mi), The Emerald Necklace (6.7 mi)
- ✅ flight from **the real Logan, Runway 27**
- ✅ own og-image (Boston Common, real in-game 1200×630), manifest
- ✅ registered: `registry.ts`, `build:all`, `dev:boston`, launch.json :5309
- ✅ **`npm run build:all` passes for all 12 towns**; `tsc --noEmit` clean
- ✅ verified in-browser: loads, spawns at Faneuil Hall, ambient landmark banner
  fires, street names resolve, fast-travel works (landed on **Lansdowne Street**
  behind Fenway's brick wall)

## FENWAY PARK — rebuilt from real dimensions (one defect left, diagnosed)

Devin: *"I need it to look exactly like Fenway… this is crucial."* It is now
built in OBB-LOCAL coordinates from real numbers, because a ballpark is entirely
about where things sit relative to home plate.

**Orientation is derived, not guessed.** Lansdowne Street runs behind the Green
Monster and is NORTH of the park (smaller world z); the +lz local direction is
`(-sa, ca)`, so the north-facing side is `ca < 0 ? +1 : -1`. Home plate goes in
the opposite south-west corner and left field runs up to the Monster.

**Researched, not recalled — Fenway has no red seats.** The seats are *Dartmouth
Green*, the park's colour since 1934. There is exactly **ONE red seat**: section
42, row 37, seat 21, where Ted Williams' 502-foot home run landed on 9 June 1946,
the longest ever hit here. That single seat is modelled, and it is a far better
detail than a stand full of red ones would have been.

Built: the **Green Monster at its real 37 ft 2 in** with the hand-operated
scoreboard set into it, the Monster Seats and rail on top, and the ladder up its
face · a real **90 ft infield diamond** hung off home plate with the mound at
60 ft 6 in · the **glass-fronted press box / club above home plate** with the
sign band and the roofline pennants · the two yellow foul poles · the bleachers ·
five light towers.

### ⚠️ THE ONE REMAINING DEFECT — read before touching it

**The grandstand deck renders GREY instead of green seats.** Do not start from
scratch; here is exactly how far the diagnosis got.

- The field/Monster/dirt/poles/red seat/glass club all render correctly.
- `annulusRoof()` pairs vertex *i* of the outer ring with vertex *i* of the
  inner. An earlier version passed a hand-authored 7-gon as the inner ring, which
  has no correspondence to the footprint and **fanned garbage quads across the
  whole block** — that was the original flat-grey sheet. Fixed by `insetRing()`,
  which pushes the real footprint inward and PRESERVES vertex count. (For a
  ballpark the inset footprint is also the correct field shape, since the OSM
  outline follows the stands, which follow the field.)
- **But the deck is still grey.** A vertex-colour histogram of the deck band
  (y 20-60, within 700 px of the centroid) shows `faf8f0`, `2c4326`, `36434d`…
  and **no `1f5133` (SEATS) and no `9a958c` (CONC) at all**. So the annulus is
  not landing in that band — it is not a shading problem, it is a placement or
  emit problem. Next step: log `field.length` vs `b.p.length` and the actual y
  of the emitted quads inside `annulusRoof`, and check whether `Bucket.quad`'s
  argument order matches what is being passed.

## HERO ACCURACY PASS — the tooling, and four systemic bugs

**Inspect heroes with a CONTACT SHEET, not one screenshot at a time.** Nine
heroes per image made the difference between "verified by name" and actually
looking at them. The recipe, to paste into the console:

- index `G.index.world.buildings` by name; for each hero compute its centroid and
  max extent from `b.p`
- `nbpt.go()` to a standoff point first and **wait ~850 ms so the chunk streams**
  — the mesh does not exist until it does
- **push `scene.fog.near/far` out to 200k/400k**, or anything past ~1500 px is
  white. ⚠️ With fog off the whole-map IMPOSTOR becomes visible as a huge pale
  curved horizon — that is not a dome, do not "fix" it
- park the camera at `dist = size*1.6 + 520`, `h = size*0.6 + 280`, `lookAt` about
  0.46·h, render, and `drawImage` the GL canvas into a tile of a grid canvas
- take a **bearing** per hero: Trinity is unreadable from the north-east because
  200 Clarendon is in the way
- the dataURL is too big to return inline — it lands in a tool-results file, and
  `python3` decodes it from there at zero context cost

### Four bugs the sheets caught, all systemic

1. **`circRing(cx,cz,r,4)` is a DIAMOND, not a square.** It puts vertices at
   0/90/180/270°, so every 4-gon tower was turned 45° to its building, and `r` is
   the half-DIAGONAL, so each was ~41% too wide. It hit **17 call sites** — every
   tower, cupola and spire in Boston. Fixed by `sqRing(cx,cz,halfW,ang)`. Old
   North and Park Street went from unreadable to correct on this one change.
2. **A ballpark had a roof.** `fenwayPark` put a `flatRoof` over the whole
   footprint and then drew the grass underneath it, so the field was sealed in a
   box. A grandstand is an **annulus** — new `annulusRoof()` roofs the seating
   ring and leaves the field open to the sky. Same fix gave `stadiumBowl` an
   `open` flag: Harvard Stadium's horseshoe is open, TD Garden is not.
3. **Tower and dome sizes were capped with absolute constants** that suited a
   small church and nothing else. The Old State House cupola was capped at 7 px
   (1.75 m — invisible), Holy Cross's cathedral towers at 15 px, while Trinity's
   crossing tower was UNCAPPED at 0.72 of the half-extent = 46 m square, and the
   MFA — 206 m across — implied a **128 ft dome** that filled the sky. All now
   proportional with sane caps.
4. **`gableRoof`'s `ridgeH` is a rise above the eave, not an absolute Y**
   (see below) — five heroes were barns.

### Confirmed reading correctly, by eye

Old North Church · Park Street Church · Trinity Church · Cathedral of the Holy
Cross · Custom House Tower · Boston City Hall · Fenway Park · Harvard Stadium ·
Faneuil Hall · Massachusetts State House.

### Still to inspect close up

King's Chapel and the Old State House are hemmed in by tall neighbours and need
a hand-picked bearing; the second-batch museums/arenas have not had a sheet yet.

## HEROES — 44 Boston keys, and ~59 heroes actually render

**Every one of the 44 Boston hero keys resolves to EXACTLY ONE footprint**,
checked programmatically against `world.json` rather than by eye — that is the
name-collision trap closed. And because Charlestown sits inside Boston's frame,
its dozen heroes (Bunker Hill Monument, USS Constitution, the Rope Walk, the
Muster House…) render in Boston **for free**: 59 hero keys match a single Boston
footprint in total.

Second batch added these shared builders, so the roster is types rather than
one-offs: **`townChurch`** (Georgian body + portico + tower + spire),
**`gothicChurch`** (buttresses, lancets, one campanile or twin towers),
**`greekTemple`** (colonnade + pediment, optional rotunda),
**`cityHallBrutalist`**, **`mansardBlock`** (Second Empire),
**`stadiumBowl`**, **`graniteFort`**, **`modernBlock`**.

Second-batch heroes: Park Street Church (217 ft — the tallest building in
America 1810-1828) · Arlington Street · King's Chapel (correctly steeple-LESS —
the money ran out) · St Paul's · Cathedral of the Holy Cross · Old South Church ·
Emmanuel · two more cathedrals · **Boston City Hall** (visually verified: the
inverted ziggurat cantilevers out over its recessed brick base) · Old City Hall ·
Museum of Fine Arts · Gardner · Symphony Hall · Opera House · Orpheum · Omni
Parker · JFK Library · ICA · Aquarium · Children's Museum · Christian Science
Publishing Society + Complex · Federal Reserve · Prudential Center · 75 State St ·
TD Garden · Agganis · **Harvard Stadium** (1903 concrete horseshoe + rim
colonnade) · Fort Independence · Fort Warren · USS Constitution Museum.

Two things the batch turned up:
- **`USS Cassin Young` already had Charlestown's `destroyer` builder** — the very
  warship their handoff records rescuing from being a 5.5-storey house. My
  duplicate key was removed rather than shadowing it.
- ⚠️ **`Schrafft Center` matches TWO footprints in Boston's frame**, so
  Charlestown's hero renders on both. Pre-existing (it is 2x in Charlestown's own
  world too), inherited here, and the one unsafe key in the whole dict.

## Earlier: the first 13

New shared primitives a city needed and the North Shore never did, all in
`src/three/decor.ts`: **`circRing`**, **`domeShell`** (stacked taper bands on a
circular profile — the State House and Quincy Market domes), **`colonnade`**,
**`spireStack`** (named that because `steeple` was already taken by the NBPT
church builder), **`glassTower`**, and **`FT`** (feet → world px) so every real
dimension from the research doc is used directly.

Built and registered: **Massachusetts State House · Faneuil Hall · Quincy Market
· Old North Church · Old State House · Trinity Church · Custom House Tower ·
Fenway Park · Boston Light · Paul Revere House** (reuses `firstPeriod()`) **·
Prudential Tower · 200 Clarendon**.

### Verified

- **Faneuil Hall — visually confirmed**: brick, shallow slate gable, cupola at
  the EAST end with the gilded grasshopper. Built **87 ft** (real ~80 ft).
- **Massachusetts State House — gold dome confirmed** by geometry audit: gold is
  the topmost material (y 521) above marble (479) above the brick core (311).
- **Custom House Tower — 514 ft built vs 496 ft real** (within 4%).
- **Quincy Market — 109 ft** with its rotunda.

### Two traps this pass found, both worth not rediscovering

1. **`gableRoof`'s `ridgeH` is the ridge RISE ABOVE THE EAVE, not an absolute Y.**
   Every existing call site passes 6-9; passing an absolute height built barns
   twice the height of the building. It hit **five** heroes at once.
2. **`frontSegment()` is wrong for a building that fronts on four streets** — it
   picked a back street for the State House and buried the red brick Bulfinch
   front behind the pale extensions. That hero now takes whichever long face
   points south, toward Beacon Street and the Common, which is a documented fact
   about the building rather than a guess.
   Also: OSM renamed the Hancock to **`200 Clarendon`** in 2015 —
   `'John Hancock Tower'` matches **0** footprints and is deliberately not a key.

### Hero polish still open

- the State House's marble extensions are still a large plain mass; the colossal
  columns read weakly at distance
- Faneuil Hall's cupola reads as a drum rather than an open belfry; its pilasters
  are too thin to see
- **not yet looked at in-game**: Trinity, Old North, Old State House, Fenway,
  Boston Light, the two towers (Custom House and Quincy were verified
  dimensionally, not visually). ⚠️ Distant portraits are useless — engine fog
  hides anything past ~1500 px, so heroes must be inspected close up.
- ~30-45 more heroes to reach the 40-60 the accuracy bar implies

## THE SKYLINE PASS — the cap nobody had questioned (7/27, later session)

Devin: *"landmarks have to look incredible, constant facade rendering needs to be
addressed, there's no actual citgo sign, some landmarks don't have windows."*
Chasing those four turned up one bug bigger than all of them.

### `lv` was clamped to 6 — Boston had no skyline at all

Every building in the baked world sat at **`lv ≤ 6`, with 2,827 of them at
exactly 6**: the Prudential, 200 Clarendon, the Custom House Tower, the whole
Financial District, flattened onto one mid-rise plain. Three clamps did it —
`Math.min(6, …)` at `build_world.mjs` lines 384 and 562 (which threw away even a
truthful OSM `building:levels=60`) and again in the height overlay — plus a
**fourth clamp in the renderer**, `buildingDims`' own `Math.min(6, b.lv)`, which
would have silently undone a data fix on its own.

Six was never a considered number. It was the North Shore's tallest plausible
building, and nothing in Newburyport or Gloucester ever reached it, so it read as
a harmless guard for eleven towns. **A default that is invisible in every case
you have tested is not validated, it is untested.**

- The ceiling is now per-town: `maxLevels` in `towns/<id>/map.mjs`, default 6, so
  every existing town bakes byte-identical. Boston sets **60** — 200 Clarendon is
  the tallest building in New England and nothing in frame passes it.
- The `areaM2 > 5000 → lv ≤ 2` guard was also flattening tower footprints. It now
  applies only below a measured **24 m**, and caps at 3 rather than 2. Six towns
  rebaked: **4 to 17 buildings each change**, all in the right direction
  (Charlestown's First Street Garage and the Regatta Riverview, Gloucester's
  Market Basket). Newburyport High measures 19.7 m over 6,467 m² and is three
  storeys, not six — which is why the ceiling under the line is 3.
- Result: **1,314 buildings over 8 storeys, 310 over 15, 53 over 30**, and the
  tallest are the real ones — 200 Clarendon 60, One Dalton 60, Millennium 54,
  Winthrop Center 53, Prudential 52, South Station Tower 51.

### A tower is not a tall house — `towerBlock` / `curtainWall`

`facades()` punches a 4.6 × 5.8 sash with white trim, which is right for a
clapboard three-decker and absurd on forty floors of curtain wall — and it would
have spent its whole 1,400-window budget and left the top third blank. Above
**`HIGHRISE_LV = 8`** a building now takes a different road entirely: a glazing
band per floor and full-height mullions emitted **per EDGE, not per window** (a
60-storey tower costs a few hundred quads), a taller lobby storey, a parapet, a
mechanical penthouse, and above 22 storeys the mast with its aircraft light.
Storey height splits regimes too — ~2.9 m below 8 floors, ~3.75 m above, because
an office floor carries a service plenum.

⚠️ **Keep `TOWER_SKINS` LIGHT.** Two shading passes multiply on a skin. The first
attempt used swatch-accurate mid-greys and produced a skyline of silhouettes.
And the `era: 'brick'` skins are **near-white TINTS** — `brickTex` is already red,
so a red here multiplies red by red and the tower comes out black.

The named towers were the least detailed things in their own skyline, so
`glassTower` (the Pru, 200 Clarendon, the Fed, 75 State) now runs the same
curtain wall in its own researched colours. The Pru gets its 158 ft antenna;
200 Clarendon deliberately gets none, because the unbroken flat top is the point.

### The landmarks with no windows

`greekTemple`, `townChurch`, `mansardBlock`, `modernBlock`, `stadiumBowl`,
`cityHallBrutalist` and `graniteFort` **never called `facades()` at all**, so
about thirty landmarks — Symphony Hall, the MFA, King's Chapel, Old City Hall,
the Opera House, the Gardner, the JFK, the ICA, the Aquarium, TD Garden, both
forts — shipped as blank boxes. They were the plainest things on their own
streets, plainer than the generic buildings around them.

New **`gridWindows()`** is the hero equivalent of `facades()`: it takes the
window's proportions, tint, a round arched head and a sill, because a temple's
tall bay is nothing like a warehouse's sash. Every builder above now uses it.

Three heroes needed more than windows:
- **The MFA** was a 207 × 205 m footprint under one 56 ft box — a flat plate the
  size of a city block. Rebuilt as `mfaBoston`: the granite range, a stepped
  centre pavilion, the rotunda, the Ionic colonnade and the Huntington Avenue
  steps.
- **Fort Independence and Fort Warren** rendered as flat tan plates, and the
  reason was the Fenway mistake again — `flatRoof` over the whole ring **sealed
  the parade ground underneath it**. The terreplein is an `annulusRoof` now, with
  the parade cut down inside it and embrasures through the parapet.
- **The Gardner** was `modernBlock` — an anonymous box for a Venetian palazzo
  built around a glass-roofed courtyard. New `venetianPalazzo` builds the
  courtyard, which is the entire reason the museum exists.

**Roofs matter more than they look like they should.** The game's camera is
elevated, so on a big footprint the roof is most of what you see — and a roof one
shade off the walls makes a building read as a lump. Museum roofs are dark now,
with `skylights()` over the galleries (opt-in: a top-lit gallery has them, a
concert hall does not).

### "Constant facade rendering"

Everything in `facades()` was a constant: one sash, one trim, one glass colour,
one 8% lit chance, on every wall of every building in every town. At a village's
scale that is consistency; across 233,279 buildings it is wallpaper. Now:

- a `FacadeLook` per building **kind** — a civic hall's tall window, a mill's
  wide one, a masonry block's squarer opening under a **granite lintel and sill**,
  a house's 6-over-6;
- **per-building** glazing tint (a seeded HSL jitter) and lit fraction (2–16%),
  instead of one global colour and 8%;
- a **belt course** between the ground floor and the ones above on blocks of
  three storeys or more — one quad per wall, and the line that gives a downtown
  its horizontal grain;
- **`TOWN.masonryMix`**: the share of commercial/civic stock built in stone
  rather than brick. Defaults to 0, so Newburyport — genuinely all brick, rebuilt
  that way after the Great Fire — is untouched. **Boston is 0.45**, because
  downtown is granite, limestone, brownstone and buff brick inside a single
  block, and rendering all of it in one red made the biggest town in the set the
  most monotonous.

The lintel is two extra quads per opening, so it stops after 360 windows on one
building — enough that nobody can resolve one anyway, and it keeps a huge
footprint from tripling its geometry. Measured in the densest downtown chunks:
**18 ms per chunk build, ~28.6k verts per chunk.**

### The Citgo Sign

It was a curated landmark and an OSM `attraction` node from day one and **nothing
was ever built for it** — fast-travelling to the Citgo Sign put you in an empty
Kenmore Square. It fell between the two mechanisms: `HEROES` needs a named
footprint and the sign has none, and its host building is unnamed in OSM.

Fixed with the tools that already existed: a `nameFix` stamps **660 Beacon
Street** onto the host footprint and a `levelFix` sets its true 9 storeys, so
`HEROES['660 Beacon Street']` builds the block **and** the sign on its roof —
60 ft square on a truss 40 ft over the parapet, two back-to-back faces, the 41 ft
trimark in three reds, and CITGO in 11 ft blue letterforms, in the GLOW bucket so
it lights up.

Two traps: pick the panel's angle by where its **face normal** points, not its
along axis — they are 90° apart, and the wrong one renders a 60 ft sign as a
white sliver — and **mirror `u` on the far face**, or the back reads backwards.

### The town switcher, at twelve towns

`initTravel` derived a **fixed** column count from the number of towns (12 → 3),
which is a roster property, not a layout one, and it overrode the stylesheet: on
a phone three 150 px chips ran off the right edge of a 340 px panel and **the
town you were standing in was half off-screen**. It is a fluid `auto-fill` grid
now — the column count follows the panel — and the tile collapses to an emoji
over a name below 560 px, which is what makes three fit. Tags return as soon as
there is room; the current town always says "you're here"; the header carries the
count.

### The three that were left open, and how they closed

**Trinity Church** read as a grey castle keep with four little horns. The code
had the polychromy in it and the screen did not: four thin bands the same tone at
distance, on a body the tower's roof hid completely. Rebuilt with a taller nave,
a heavy brownstone base course and three deep string courses instead of pinstripes,
the 1897 west porch with its triple arch and flanking turrets, a proper LANTERN
stage of paired arches, and — the fix that changed everything — a four-sided
**pyramid** of red tile instead of a `cone()`. ⚠️ `cone()` is a 16-gon: on a square
tower it reads as a round hat, which is what made this a chess rook.

**King's Chapel** was running through `greekTemple`, which at a chapel's
proportions gave a dark five-storey block with a portico stuck on one end. It has
its own builder now: two tiers of round-arched windows, a low hip behind a
parapet, the squat **steeple-less** tower (the money ran out in 1754, and that is
the famous thing about it), and the 1789 wooden Ionic colonnade wrapped around
the tower's base.

⚠️ **A trap worth the retelling: I spent three contact sheets judging the wrong
building.** King's Chapel is genuinely tiny and its neighbour is a tall dark
office block, so "King's Chapel is a dark office block" was a misread of what was
in the middle of the frame. A **magenta test** — tint the hero's own palette
`#ff00ff`, rebuild, shoot — settled it in one pass and should be the first move
next time, not the last.

The **Old State House** was checked from four bearings and is fine: brick, gambrel,
the balcony, the lion and the unicorn, the west cupola. It is simply dwarfed now,
which is exactly what it is in life.

**Bay windows** shipped as `bayWindow()` — the canted bay with a flat front and
two angled cheeks, three lights per floor, oversailing the sidewalk by about a
metre. **26,250 Boston buildings** carry one. Two decisions worth keeping:

- the gate is **three storeys, not roof shape**. A Back Bay rowhouse is flat and a
  Dorchester three-decker is gabled and both carry bays — height and density are
  what separate them from a colonial cape, which never has one. Gating on
  `!gabled` first meant it almost never fired.
- it goes on the **street face only** (`frontSegment`). Anywhere else it would
  push through the party wall of the house next door.
- `TOWN.bayWindows` defaults to **0**, so the North Shore is untouched. Boston is
  0.55. Salem, Beverly and Charlestown have real three-decker fabric and could
  opt in — that is a deliberate not-yet, not an oversight.

## ARRIVAL AND THE CAMERA — "for every landmark I need to know where I am"

Fast-travelling to **Fenway Park** put you on the Lansdowne Street sidewalk with
your nose against the brick, the ballpark entirely invisible behind it. Two
separate faults, and the second one is the general lesson.

**1. The stand-off came from the curated `r`, which is not the size of the
building.** `travelToPlace` used `clamp(r * 0.55, 130, 320)`. Fenway's `r` is 460
and its footprint is **2186 x 1466 px** — so every candidate vantage was inside
the park, and `findFree` marched each one out to the nearest free ground, which
is the sidewalk against the wall. The open-sightline check that should have
caught it probed a fixed 22/42/62 px, and a sidewalk is wider than that.

`landmarkMass()` now MEASURES the thing: the footprint the landmark point sits
in, its bounding radius and its height. Stand-off is `radius * 1.12 + max(230,
height * 1.5)`, capped at 2100.

**2. The sightline test has to be three-dimensional and a SCORE, not a boolean.**
A six-storey block between you and the Custom House Tower does not hide the
Custom House Tower — you see 500 ft of it over the roof. A flat 2-D test rejects
every vantage downtown and drops through to the fallback, which is how a 496 ft
landmark ended up viewed from a doorway. And in a dense downtown the honest
answer for several landmarks is "nowhere is completely clear", so pass/fail picks
arbitrarily. `sightlineScore()` returns the unobstructed FRACTION, tested against
a ray to a point two-thirds up the target, and every candidate is scored:

```
score = open * 100 - |dist - ideal| / 100
```

⚠️ **The distance penalty has to bite.** At `/500` a marginally clearer view three
times too far away wins, and Old South Meeting House got chosen from **292 m** —
technically a view of it, no use to anyone trying to find it. There is also a
hard ceiling on the search window (`d * 1.55`) for exactly that reason.

**Result, measured over all 129 Boston landmarks: 128 arrive with a completely
clear view**, the 129th (Chestnut Hill Reservoir, seen across the water) at 98%.
Median arrival distance 562 px. Newburyport: 32 of 32 clear.

**Two more things arrival now does**, because standing in the right place is only
part of knowing where you are:
- it **says the name** — `maybeShowLandmark(lm, true)`, forcing past the 90 s
  ambient cooldown, since a big landmark's proper vantage is now well outside the
  `lm.r` that the ambient banner fires inside;
- it **frames the thing** — zoom scaled to the mass (⚠️ SET, never `max()`: maxing
  ratchets the zoom up forever, so one trip to a ballpark parks the camera inside
  the building behind you for every landmark after it), and a **partial upward
  tilt** when the target is tall enough that its top would be off-screen. 52 of
  the 129 arrivals tilt.

### `TOWN.landmarkTops` — when the footprint lies about the silhouette

A spire, an obelisk, a mast and a rooftop sign are all invisible to a storey
count, so the Citgo Sign framed its host building and cut the sign off the top of
the screen. Real heights in world px, keyed by landmark id, live in the town pack
(`src/towns/boston/index.ts`) — eleven of them so far, from the Prudential's
907 ft to Boston Light's 98.

## LOOK UP (👀 / V)

The chase camera aims about **26° DOWNWARD**. That is right for following a kid
along a street and hopeless in a city: from a Boston sidewalk you could not see
the top of a single tower. `camLift` eases 0 → 1, drops the camera toward street
level, tilts the aim to about 18° UP, and opens the far plane to 11000 with the
fog to match — a skyline two kilometres off is nothing but cull and haze
otherwise.

- ⚠️ Measure the lift against the camera's **actual** position. When a wall pulls
  the camera in, the horizontal run collapses; a fixed vertical rise then becomes
  a near-vertical stare at the sky. Rising by a **fraction of the run** (0.32)
  keeps the pitch constant however hard the camera is clamped.
- It **releases the moment you walk**. At full tilt the kid is out of frame, which
  is fine for a deliberate "look at THAT" and not fine to be stuck in.

**Also fixed here: `index.buildingTopAt` clamped `lv` at 5**, so the camera
believed a sixty-storey tower was five storeys and happily sat inside the
Prudential. It mirrors `decor.ts`'s `buildingDims` now, two-regime storey height
and all.

### Contact-sheet harness gotchas

For whoever picks this up: call `G.buildChunk()` directly (the frame loop's LRU
evicts a distant forced chunk before you can render it), `setAnimationLoop(null)`
first, move `G.px/G.pz` and call `G.sky.update()` or the sky dome is somewhere
else and you shoot against black, and **world y maps to three.js +z, not −z**
(`ringToVec2` negates and `quad` negates again). The framing constants matter
more than they look: `dist = size*k + 420` is fine for a landmark and useless for
a rowhouse, so keep an absolute-distance shot function alongside the fitted one.

## Still open
- [ ] races not yet run end-to-end in-game (authored + typechecked, not ridden)
- [ ] flight not yet flown from Logan in-game
- [ ] `tools/fetch_osm_pbf.mjs` is UNVERIFIED — verify or delete
- [ ] ⚠️ **`data/boston/raw/overpass.json` (240 MB) is gitignored** — GitHub
      hard-rejects >100 MB. Unlike every other town, Boston's raw is not in the
      repo; `npm run map:boston` regenerates it (~25 min). The built
      `world.json` IS committed, so nothing about the game depends on it.
- [ ] ⚠️ **repo weight**: Boston's committed `world.json` is 46 MB, and every
      future rebake adds another 46 MB blob to git history forever. Worth
      considering Git LFS before Boston is rebaked many times.
