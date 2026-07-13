# Ipswich — build handoff (July 13, 2026)

Ipswich, MA is BUILT as the fourth town (`towns/ipswich/`, branch **`ipswich`**)
per docs/TOWNS.md. **NOT merged to `source` yet** — merging auto-deploys it to
clippertown.io/ipswich/ via CI (`build:all` already extended and green locally),
so that's Devin's call.

Run it: `npm run dev:ipswich` (or the `ipswich` entry in .claude/launch.json, port 5269).

## What shipped (all verified in preview unless noted)

- **World**: 10,156 buildings / 6,807 addresses / 3.7MB world.json / 5.3MB
  heights.bin; bbox downtown→Crane Beach→Essex village→Rowley Common
  (42.625–42.720 / -70.925–-70.740). Ocean + 14 coast islands assembled clean
  on the FIRST build — no coastline-terminus flood (Great Neck streets probed
  dry). Overture ML heights overlaid on 5,261 buildings.
- **36 fast-travel landmarks** (recipe mix, ~1/3 kid-life), every point
  water-checked programmatically (the marsh frame flagged 4 wet points — all
  moved to dry ground). History-forward subs per the educational pivot.
  Facts + sources: docs/research/ipswich-landmarks.md.
- **Spawn = Five Corners** (the no-stoplight "courtesy intersection", nudged
  onto the Zumi's-corner sidewalk) — a kid takes a visitor here first: cocoa at
  Zumi's, 70m to the Choate Bridge, 2 min to the Riverwalk mural.
- **Racing ladder** (authored via make_course, race run END-TO-END in preview
  incl. finish card, name save, and 👻 ghost recording under `ipswich:` keys):
  - Choate Bridge Dash 0.9mi — South Green → over the 1764 bridge → Town Wharf
  - Clam Box Run 1.9mi — Market St up the High St corridor → the Clam Box
  - Castle Hill Homecoming 4.3mi — Argilla Rd's whole length → Meeting House Green
- **✈️ Flight from the 1910 Burgess Flying Field** (Essex Rd at Northgate) —
  REAL aviation history: the Burgess Model D's first test flight was at
  Moulton's Farm, Nov 27, 1910 (same Burgess line as Plum Island). Verified
  airborne in preview, departs east over the marsh toward Crane Beach.
- **Pack anchors**: trainPlatform at the real MBTA stop (no depot building
  exists in reality — B&M depot demolished 1962, bare platform is CORRECT);
  frogPond = Clark Pond, Great Neck (the 1897-dammed skating pond);
  sledHill = the Grand Allée first roll (terrain-verified: drops ~10m over
  900px, then the next hill rises — run capped at 900); graveyard = Old North
  Burying Ground (1634); holiday tree on Meeting House Green.
- **17 heroes live** (colors PHOTO-VERIFIED, dossier: docs/research/ipswich.md):
  bespoke — **Clam Box** (flared takeout-box walls + splayed lid flaps +
  red/white awnings + roadside sign), **First Church in Ipswich** (the 1971
  modern one — white, amber glass tower strips, spire + gilded rooster; do NOT
  model the burned Gothic), **Ascension** (wood Carpenter Gothic — NOT stone),
  **Russell Orchards barn** (weathered boards + SILVER metal roof + green
  sliding doors — NOT a red barn), **Woodman's** (gray shingle + stacked
  red/white/navy roof signs);
  config-tier — Whipple House (near-black), Waldo-Caldwell (dark chocolate),
  John Kimball (barn-red + jetty), Matthew Perkins (white + big chimney),
  Heard House (cream Federal + green shutters), Town Hall (brick + colossal
  portico + flag), Library (brick + granite trim), Old Town Hall (sage temple
  front, nameFix), Hall-Haskell (barn-red), Hart House (putty gambrel),
  **Great House** (rosy-buff brick, gray-green slate hips, white balustrade +
  cupola — federalHouse on the real cross-plan footprint).
- **Borders**: 6 municipalities (Ipswich/Essex/Rowley/Hamilton/Topsfield/
  Gloucester), 40 welcome signs, borderLore in the pack.
- **og-image**: real in-game 1200×630 shot — kid + Clipper walking up Castle
  Hill to the Great House. check_town_assets green (unique across 4 towns).
- **Engine tweaks that ride along** (all towns): placeEmoji rules for
  🐺 wolves / 🍤 fried clams / 🪨 rockery / 🥧 diner / ✈️ flying field /
  ⚓ wreck / 🏘 cottage colony / 🌳 green (regression-checked against the
  NBPT+Salem+Beverly rosters — e.g. "shipwreck islands" still 🏖, Joppa's
  "Clam country" still a park); `HEIGHTS_TIMEOUT_MIN` env override in
  fetch_heights.mjs (the 15-min duckdb ceiling ETIMEDOUT once on slow S3).

## Gotchas learned (beyond BEVERLY-HANDOFF's — those all held)

- **This preview pane can freeze rAF permanently after navigate()** — clicks
  don't always revive it, and computer screenshots then show a STALE compositor
  frame (two "different" screenshots can be byte-identical lies). The reliable
  loop: pump `g.frame(t)` manually AND capture via `renderer.render() +
  toDataURL` POSTed to a localhost receiver (scratchpad shot-server pattern,
  from the Beverly og-image trick). Trust only those pixels.
- **Manual frame-pumps + wall-clock**: `nbpt.walk(dx,dy,ms)`'s `until` is
  performance.now()-based; pumped sim time runs AHEAD of wall time, so pass
  huge `ms` or walk() expires instantly. A timed-out javascript_tool call
  mid-pump leaves the sim clock in the future — resync with
  `Math.max(g.lastTime, performance.now())`.
- **A giant `nbpt.go()` teleport during a race QUITS the run** (by design:
  "quit, fast travel, or the finish line ends a run"). To exercise the finish
  line, RIDE there: densify the course route (~140px steps), chase waypoints
  with walk(), add a perpendicular jink when wedged (the collision glance can
  box the bike into roadside scenery corners).
- **firstPeriod's nGables carves the WHOLE roof** — nGables:1 = one full-length
  A-frame (looks wrong). Use 2+ for plain side-gable houses.
- **Hero builders: never Math.min-cap the OBB** (my Clam Box rendered
  dollhouse-sized and invisible behind a pine — no console error, chunk builds
  fine, the building is just tiny). Scale features from the real hl/hw.
- Ipswich OSM names historic houses lowercase-with-year: hero keys must match
  exactly, e.g. `the Captain John Whipple House (1677)`.

## Remaining polish (ranked)

1. **Cloud-board round-trip on the DEPLOYED site** — local board write/ghost
   verified; the Apps Script POST needs one finish on clippertown.io/ipswich/
   (board auto-partitions by raceTown; nothing to deploy). Delete my test row
   ("CLAM", Choate Bridge Dash 0:36.1, local-only) if it somehow synced.
2. **Eyeball in-game**: Ascension + the South Green museum cluster (Whipple/
   Heard/Old Town Hall/Hall-Haskell sit within a block), Hart House, Perkins,
   Caldwell (shots were oblique/too close); library's roof reads a bit tall.
3. **Town Wharf moorings** — the river read boat-empty at the wharf (lot is
   full of cars, which carries it); pier-lines exist but check `mooring`
   coverage or seed a few river boats.
4. **Beach-scrub decor guard**: a few dune-scrub tufts render past the Crane
   waterline into the water (engine-level; likely affects Plum Island too).
5. **Wolf Hollow set piece**: not in OSM — the icon is the barn-red roadside
   stockade fence + black wolf sign (spec in the dossier); needs
   manualFeatures fence + a small shed to really land. Landmark point is
   address-interpolated — verify against aerial.
6. **Choate Bridge stone-arch skin**: renders as the standard road bridge
   (crossable ✓); a granite two-arch hero treatment would be a jewel. Specs
   (spans, cutwater, parapet) are in the dossier.
7. **EBSCO Riverwalk mural decal** (2,700 sq ft Alan Pearsall history wall) —
   locals would cheer; needs a small decal mechanism.
8. Alexander Knight House (tiny thatched 1657 reconstruction, museum lawn) —
   manualBuildings + a 20-line builder, high charm-per-polygon.
9. Kid-UX wave parity (blab labels / read-aloud / 44px closes) — same gap as
   Salem + Beverly.
10. Marini Farm stand + Ipswich Ale Brewery colors are UNVERIFIED — don't
    model without photos (the Ropes trap).

## Launch notes

- Tag: "Birthplace of Independence" (the town seal's 1687 Andros-revolt motto);
  locals also say **"Clamtown"** — could A/B the tag someday. Emoji 🦪.
- Theme: estuary slate-blue chrome + marsh gold (distinct from maroon/plum/green).
- Reddit: r/ipswichma exists (small); r/northshore worked for Beverly. Story
  hooks that landed in research: "the toilet king's castle" (Crane), greenheads
  as a badge of honor, the 1687 revolt = "Birthplace of American Independence",
  59 First Period houses (most in America), the Crane Beach greenhead season.

## Deploy (when Devin says go)

Merge `ipswich` → `source`, push. CI (`build:all`, already extended with the
ipswich step) ships `/ipswich/` alongside `/`, `/salem/`, `/beverly/`. The town
switcher in ALL towns starts showing 🦪 Ipswich automatically (registry.ts).
