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
- **Racing ladder** (make_course; NOT yet ridden end-to-end — see open items):
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
- **3 heroes** (config-tier, colours from written descriptions — NO photo pass
  yet): **Swansea Town Hall** (1891 rubblestone + brownstone, pyramidal slate
  roof, cupola standing in for the clock tower, flag), **Swansea Free Public
  Library** (1900 granite + red Potsdam sandstone bands, Elizabethan gable),
  **Christ Church** (1900 granite Gothic with a crenellated tower — the
  `salemChurch` builder is exactly this church; keyed `Christ Church Swansea`
  because Boston's world has two plain "Christ Church" footprints). The
  `federalHouse` builder gained `material: 'stone'` (flat PLAIN walls, texScale
  0) for the first two — reusable anywhere.
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

## Remaining polish (ranked)

1. **Ride each race end-to-end** on a real device (finish card, name save,
   ghost under `swansea:` keys) and the cloud-board round-trip on the deployed
   site; hand-tune gates where the arch sits off the kerb.
2. **Photo pass on the three heroes** — Town Hall's real offset tower and
   turret (the cupola is a stand-in), the library's mullioned windows, the
   church's tower proportions. Then First Baptist (1848 Greek Revival chapel,
   21 Baptist St, footprint 379 m² at -52347,-20778) and the Stevens mansion
   (mustard yellow — the 1069,-747 address anchor hits three small footprints;
   identify the right one first).
3. **Wildcat Rock / Abram's Rock set pieces** — the puddingstone monoliths are
   mapped only as a viewpoint node; a boulder hero on the viewpoint would make
   the park's card land.
4. **Somerset Creamery hero** (the corner every kid knows) and the Venus's
   roadside sign.
5. **The Swansea Dam** — placed at the Village Park lake's Main Street end
   from the Holiday-in-the-Village and lighting-project descriptions; confirm
   on the ground (a waterfall set piece would be a jewel).
6. borderLore copy check for the RI neighbours (Barrington / Bristol lines).
7. Kid-UX wave parity (blab labels / read-aloud / 44px closes) — same gap as
   the other sandbox towns.
