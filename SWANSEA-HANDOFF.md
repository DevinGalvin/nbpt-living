# Swansea — build handoff (September 15, 2026)

Swansea, MA is town **#13** — and the first one **off the map**: it is a South
Coast town on Mount Hope Bay, an hour and a half from the North Shore set, built
for Devin's nieces. It deploys like every other town (`build:all` → `/swansea/`)
but is **hidden from every other town's Fast-Travel roster** (`"hidden": true`
in `towns/swansea/town.json`, honoured by `src/towns/registry.ts`). Reach it at
**clippertown.io/swansea/** only. Its own roster still lists the twelve North
Shore towns and marks Swansea "you're here" (verified in both builds: Swansea's
panel says 13 TOWNS with itself current, Newburyport's says 12 without it).

Run it: `npm run dev:swansea` (or the `swansea` entry in `.claude/launch.json`,
port 5319). Built on branch `claude/keen-cerf-81zipd`; merging to `source`
auto-deploys it.

## What shipped

- **World**: the WHOLE town — 35,878 buildings (Overture ML heights overlaid on
  17,395 of them), 8,298 roads, 10 municipal boundaries, 120 welcome signs,
  6.5 MB world.json + 7.2 MB heights.bin. Frame `s 41.69, w -71.32, n 41.822,
  e -71.145` (~15 × 15 km): the village, Luther's Corner, the Route 6 strip,
  the Cole and Lee Rivers, Gardner's Neck / Ocean Grove / Touisset on the bay,
  Barneyville and the Palmer River, Hortonville — plus Somerset (Brayton Point,
  Somerset Creamery), Fall River's waterfront (Battleship Cove) and Warren /
  Barrington RI as nods. The first bake used a guessed frame and **cut off
  4.5 km of the west side** (Stoney Hill Road was the edge; the municipal ring
  runs to x = -84,086); the fix is now in the checklist below.
- **Baked entirely in CI** (`build-world.yml` — Overpass is 403 from cloud
  sessions). The workflow now installs the duckdb CLI and runs
  `fetch_heights.mjs`, so a CI bake gets real building heights like a laptop
  bake; Overture had retired the pinned 2026-06-17 release, so
  `fetch_heights.mjs` now points at 2026-08-19.
- **36 fast-travel landmarks** (`towns/swansea/map.mjs`), ~1/3 kid-life
  (Town Beach, Memorial Park, Village Park, four schools, two ice creams, the
  Y, the movies, a castle-front fun center, Cedar Cove). **Swansea's OSM is
  thin** — Town Hall, Case High, Christ Church and the Town Beach are all
  unnamed footprints — so coordinates come from the MassGIS address anchors the
  build already carries (`world.addrs`: 81 Main St, 70 School St, 560 Ocean
  Grove Ave …), named footprints, and poly interior points. Every point was
  land/water/town-checked programmatically; nine sit inside their own
  building (fine for a landmark), none on water or major pavement. Six
  `nameFixes` stamp the real names onto those footprints.
- **Spawn = Swansea Town Hall** on Main Street — the village heart (library,
  Christ Church, the Stevens mansion and the Village Park trails all within
  two minutes).
- **27 discovery cards** (`src/towns/swansea/history.ts`), Indigenous cards
  first (Pokanoket / Massasoit / Metacom — the bay is named for his home), then
  the June 1675 start of King Philip's War (the first houses burned, the nine
  dead of June 24, the Myles Garrison marker at Barneyville Rd & Old Providence
  Rd), the founding (John Myles's Welsh Baptists, "Swansea is not about swans"),
  the villages, the Stevens gifts, the summer colony and Hurricane Carol, then
  modern Swansea (Route 6, the mall, the Venus, the Cardinals, the Brayton
  Point implosion, Big Mamie). `check_markers swansea` is clean.
- **Racing ladder** (make_course; every course RIDDEN END-TO-END in headless
  Chromium — finish card, name save, 👻 ghost recorded under the `swansea:`
  keys, "NEW BEST" placement line — see the ride notes below):
  - Village Dash 0.9 mi — Town Hall → Main St → Route 6 → the Venus de Milo
  - Ocean Grove Run 1.7 mi — St Francis → Gardners Neck Rd → Wilbur Ave →
    Ocean Grove Ave → the Town Beach (the Memorial Day parade route, ridden)
  - Martin House Homecoming 4.2 mi — the 1728 farm → Stoney Hill Rd → the
    whole Route 6 strip → the village. (Myles Garrison → Town Hall was tried:
    5.7 mi, and a via at Luther Store snapped to a spur and retraced — the
    Charlestown trap.)
- **✈️ Flight off the Town Beach** (no airfield in town; copy says so): lifts
  south over Mount Hope Bay toward the Braga Bridge and the battleship.
- **The Town Beach is drawn as sand** (`map.mjs` `manualFeatures`): OSM maps
  the coastline but no beach, so the town's one public beach rendered as lawn.
  The strip is traced off the mapped waterline (the bay ring's straight shore
  edge), 175 m centred on the bathhouse address, 17 m deep, idempotent by `s`
  tag. Umbrellas and beach life appeared on it for free.
- **Pack anchors** (`src/towns/swansea/index.ts`): frogPond = the Village Park
  lake (the Swansea Dam is at its Main Street end); sledHill + sledLane =
  Village Park's hill above the soccer field (terrain-verified: 28 m → 11 m over
  100 m, northbound); graveyard = Mount Hope Cemetery; holiday tree + the
  Santa parade on Main Street at the Town Hall (Holiday in the Village);
  no train (no passenger rail). Theme: bay teal + marsh gold. Tag "The Town
  on Mount Hope Bay", emoji 🦢.
- **5 heroes + 2 set pieces** (config-tier, colours from written descriptions —
  NO photo pass yet): **Swansea Town Hall** (1891 rubblestone + brownstone, pyramidal slate
  roof, cupola standing in for the clock tower, flag), **Swansea Free Public
  Library** (1900 granite + red Potsdam sandstone bands, Elizabethan gable),
  **Christ Church** (1900 granite Gothic with a crenellated tower — the
  `salemChurch` builder is exactly this church; keyed `Christ Church Swansea`
  because Boston's world has two plain "Christ Church" footprints). The
  `federalHouse` builder gained `material: 'stone'` (flat PLAIN walls, texScale
  0) for the first two — reusable anywhere. Second pass: the **Birch-Stevens
  Mansion** (1855 Italianate, mustard yellow, low hip + belvedere, the boys'
  home since 1939 — 24 Main St, the one 2-storey block set back south of the
  street) and **First Baptist Church in Swansea** (1848 vernacular Greek
  Revival, white, pedimented front, SQUARE belfry — the `meetinghouse` builder).
  Set pieces: **Wildcat Rock** (POI hero on OSM's lowercase `wildcat rock`
  viewpoint — a two-kids-tall puddingstone outcrop with pebbles in the matrix)
  and **the Swansea Dam** (a manual POI at the Village Park lake's south tip:
  granite wall, white spill sheet, the brook below). And **Village Park is
  woods now**: a `wood` overlay on the park's own ring (map.mjs manualFeatures)
  gives the 194-acre conservation park forest-density trees with the trails
  threading through, instead of the lawn OSM's leisure=park implied.
- **Assets**: manifest, unique og-image (real in-game shot of the Town Beach at
  golden hour, kid + Clipper on the sand, boats on the bay).
- **Research**: `docs/research/swansea.md` — every fact with its source; the
  "unverified / do not model" list is at the bottom.

## Gotchas learned

- **Guess a bbox, get half a town.** Before the first bake, sanity-check the
  frame against the municipal ring: `fetch_boundaries` runs first in
  `build-world.yml`, so compare `world.towns[<town>]`'s extent to
  `meta.bounds` right after the bake, before curating anything.
- **`addrs` merges same-named streets across towns.** "70 School Street"
  resolved into Fall River; Swansea's School Street stops at #61 in the data,
  and Case High is the 7,548 m² civic block just past it. Always check
  `townOf()` on an address hit.
- **A mid-tone hex renders ~2 stops darker than it reads.** The Town Hall at
  `#7b766c` came out chocolate; stone wants the Custom House's `#a3a49e`
  register. Test with `#f4f4f4` first if a wall looks wrong — it isn't the
  bucket.
- **Headless Chromium runs the game fine** (`--use-angle=swiftshader
  --enable-unsafe-swiftshader`, the global playwright at
  `/opt/node22/lib/node_modules/playwright`): `nbpt.go()`, `nbpt.time()`,
  `nbpt.zoom()`, and `nbpt._game.camAz` / `.lookUp` give a repeatable camera.
  `camAz = π` looks north, `0` south, `π/2` east; `lookUp = true` raises the
  horizon. The chase camera still pulls in behind trees — pick a clear lawn.
- **Christ Church has no OSM name or tag**; it is the one footprint on the
  mapped "Church Grounds" lawn (335 m² at 466,-1220), 57 Main St by address
  order between the library (69) and the mansion (24).
- Overpass mirrors were fast today (a 40 MB frame in 6.5 s) — but the
  Overture scan is the slow step (~4 min).

## Heights (post-launch fix, same day)

Devin's first look live: "a lot are 1 story instead of 2." Raw Overture put 69%
of Swansea under the one-storey cutoff (North Shore towns: 35–46%); not release
drift (Amesbury re-fetched byte-identical), the ML just reads this region short
— tagged two-storey homes measure 5.0 m. New town.json knob
`overtureHeightScale` (build_world multiplies ML heights before the ridge
thresholds; floor tags never scaled; default 1 = every other town byte-stable).
Swansea carries **1.3** → houses 23% / 38% / 36% (1 / 1.5 / 2+) from 54% /
19% / 27%. Derivation in docs/research/swansea.md. If a street still reads
low, it is one number and a CI re-bake.

## Ride notes (September 15, headless Chromium against the production bundle)

`scratchpad/ride.mjs` pattern: `nbpt.race(id)`, then chase the course route
(densified to 120 px steps) with `nbpt.walk()`, jink perpendicular when wedged,
poll `nbpt._game.race.state`, fill the finish card's name input, then read the
per-town storage shim for `swansea-race-<id>-ghost-<NAME>`.

- Village Dash — finished 0:24.4 on the clock; card, save, ghost (1.8 KB) ✓
- Ocean Grove Run — finished 0:40.8; card, save, ghost (3.4 KB) ✓
- Martin House Homecoming — finished 1:43.5; card, save, ghost (8.8 KB) ✓ (a 25-minute
  ride at swiftshader frame rates; the clock runs on sim time, so 1:43 is honest)

Two traps: **any edit to `src/` while a ride runs kills it** (Vite's full
reload destroys the page context) — ride against a static `dist-swansea/`
served by `http-server` instead; and **a far start sits in `count` for a
minute** while the chunks around it stream in under swiftshader — that is
streaming, not a stuck countdown.

## Remaining polish (ranked)

1. **Cloud-board round-trip on the DEPLOYED site** — local board write/ghost
   verified for all three courses; the Apps Script POST needs one finish on
   clippertown.io/swansea/ (board auto-partitions by raceTown; nothing to
   deploy). Delete the "NIECE" test rows if they somehow synced.
2. **Photo pass on the five heroes** — the Town Hall's real offset tower and
   turret (the cupola is a stand-in), the library's mullioned windows, the
   church's tower proportions, the mansion's wrap-around porch and bracketed
   eaves, the chapel's pilasters. Cloud sessions cannot fetch photos; this is
   a laptop job.
3. **Abram's Rock itself** — OSM carries only Wildcat Rock; the legend's rock
   has no mapped point and nothing was invented. Pin it (the geocache GC3B192
   has the coordinates) and reuse `buildWildcatRock`.
4. **Somerset Creamery hero and the Venus's roadside sign** — no verified
   visuals found (the Ropes trap: not modelled without them).
5. Hand-tune race gates where an arch sits off the kerb, on a real device.
6. Swansea's OSM is thin: no Town Beach sand, no school/church tags, unnamed
   civic footprints. Fixing OSM upstream (or adding `curatedPois` by address —
   the Ice Cream Barn, the Cole River marina) would deepen every rebuild.

(Kid-UX wave parity, item 7 of the first list, is moot: the blab labels,
read-aloud and 44 px closes live in the shared HUD now and Swansea gets them
like every town.)
