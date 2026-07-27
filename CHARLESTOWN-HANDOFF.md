# Charlestown — build handoff (July 26–27, 2026)

Charlestown is town **#11** and is **LIVE** at clippertown.io/charlestown/.
Built, polished and bug-fixed in one session on `source` (no worktree — it never
needed isolation because the engine changes were all regression-checked in place).

Run it: `npm run dev:charlestown` (or the `charlestown` entry in
`.claude/launch.json`, port 5305).

Commits, in order: `9461222` town · `b020053` races + heroes · `f59bf4e` museum
hero · `f485ca9` tunnels + bridge spikes · `a0f2997` interchange passability ·
`3821fbb` deck smoothing + fusion · `c500a75` deck clearance. Handoffs in
between: `2a9849f`, `a1f3ad6`, `9872ce3`.

**Charlestown is the rehearsal for Boston.** It is the first town in the set that
is a *neighbourhood*, the first with a genuinely stacked interchange, the first
with buried highways, and the first with thousands of building multipolygons.
Every engine fix below is one Boston will lean on — see ✦ FULL BOSTON in
`HANDOFF.md`.

## What shipped

- **World**: 4,885 buildings (4,090 ways + **795 relations**), 3,489 addresses,
  **1.7 MB** world.json — small, because the frame is one peninsula. Terrain +
  Overture heights (3,189↑/298↓). 44 welcome signs. Frame
  `s 42.3630, w -71.0800, n 42.3960, e -71.0400` deliberately reaches across the
  water so Old North Church, Copp's Hill and Paul Revere's landing ride in as
  NODS (the Rockport-in-Gloucester pattern).
- **63 fast-travel landmarks** — long on purpose (recipe says 25–35): the Navy
  Yard alone is a dozen famous buildings. Every coordinate boundary-checked
  against relation 4033666; 155 features are named in frame. Banks, condo lofts
  and a Dollar Tree left out.
- **Racing ladder** (all three verified end to end, every start/gate checked to
  be on road, dry and unobstructed): Bunker Hill Climb 1.1 mi (Old Ironsides →
  up Main St → the Monument), Navy Yard Run 2.3 mi (Sullivan Sq → Menino Park),
  Townie Homecoming 3.5 mi (a full lap, the hill last).
- **13 heroes.** Bunker Hill Monument (539 px = 221 ft; 30 ft → 15 ft 4 in taper,
  pyramidion, chamber windows, arched door), USS Constitution (real rig —
  `mastMul 3.5`, her 220 ft mainmast is within a foot of the Monument — plus the
  white gunport stripe), USS Cassin Young (a Fletcher-class destroyer off her real
  115 m × 12 m footprint; she was rendering as a 5.5-storey HOUSE), Rope Walk
  (405 m of granite), Muster House (octagon), Schrafft Center (clock tower + sign
  band), Chain Forge (ridge monitor), Monument Lodge, Battle of Bunker Hill
  Museum (the 1913 Charlestown Branch library — "FREE FOR ALL" is carved on the
  real facade), Commandant's House, Timber Shed, Hemp House, plus POI hero
  **Colonel William Prescott** (sword right hand, left hand out flat holding his
  men's fire — the whole point of the 1881 bronze).
- **Pack anchors**: spawn = the Monument with `dz: 210` so the kid lands on the
  lawn facing it (clean-profile verified); flight off the Navy Yard apron past
  Old Ironsides (Charlestown has no airfield and the copy says so); Phipps Street
  Cemetery fall mist; City Square Park tree + Halloween. `story: false`.

## Engine work this town forced — all regression-checked

1. **`stitchChains` "already closed" was absolute (60 px).** A short open way
   whose two endpoints landed within 7.5 m of each other was peeled off as a
   finished ring — so **52 of 795 rowhouse multipolygons fragmented** into a
   sliver plus a partial ring. Now scale-aware (gap ≤ 15% of the chain's own
   bbox diagonal). *The check that found it, reuse it for Boston:* assemble the
   relations EXACTLY (relation geometry is fetched unclipped, so endpoints match
   by identity) and compare the ring count to `building-rel` in the build stats.
2. **`fetch_boundaries` only knew `admin_level=8`.** Charlestown is a
   neighbourhood (`boundary=place`). Opt in per town via `town.json`:
   `"boundaries": {"includePlaces": true, "exclude": ["Boston"]}`. Places sort
   BEFORE admin relations because the runtime's town test is first-ring-wins.
   Without a boundary, `landmark_candidates.mjs` HARD-FAILS.
3. **`build_world` had NO tunnel handling at all** — 27 buried through-highways
   (I-93, Sumner, Callahan, the Rutherford Ave underpasses) were painted on the
   surface, laying a motorway through City Square and leaving 14 real buildings
   standing in a roadway (→ 1, the MBTA station, which really is in the
   interchange). New `BURIED_HW` set, deliberately NARROW: `tunnel=yes` is also
   how OSM marks the at-grade underpasses carrying the Clipper City Rail Trail,
   Amesbury's Riverwalk and the Salisbury Ghost Trail. A blanket drop tore holes
   in three towns' trails and the byte-regression caught it.
4. **Bridges — four faults, see ✦ BRIDGE MODEL Phase 6/7 and the bridge memory.**
   Merge-end cycles buried a deck 776 px underground (→ 45° spikes); tent and
   water lifts were unbounded and CASCADED; ramp room was measured to airborne
   ends (pancaking stacked ramps into a black mat); "too low to duck under" was a
   hard BLOCK, i.e. an invisible wall. Then crossings were scalloping the deck
   (→ **plateaus**), deck FUSION ballooned a slab to 53 m (`CAP` 150 → 96), and
   the slab was drawn through the houses beside it
   (→ `deckHalfWidthLimit` + the shared `DECK_CLEAR_MIN_W`).

**Regression bar that was held throughout:** nbpt / amesbury / salisbury rebuild
**byte-identical**; gloucester + ipswich were left at their shipped bytes;
NBPT's 38 bridge profiles are unchanged and it *gained* 566 newly-passable points
around its own bridges.

## Traps — every one of these cost real time

- **`brickTex()` bakes RED brick into the texture and vertex colour MULTIPLIES
  it.** Grey handed to the `BRICK` bucket comes out dark reddish-brown; the
  monument first rendered as a chocolate obelisk. For granite use `PLAIN` with
  `texScale 0`.
- **`obbOf` does NOT guarantee `hl` is the long axis.** The Rope Walk (405 m ×
  23 m) returns its length in `hw`; so do Schrafft, Chain Forge and the museum.
  `warehouse` / `brickShed` / `federalHouse` all assume hl is long and lay the
  building sideways. `yardShed`, `tallShip`, `destroyer`, `schrafftCenter`,
  `classicalLibrary` pick the long axis and rotate the working angle with it.
- **A hero keyed by NAME runs on EVERY footprint with that name.** OSM splits the
  Schrafft plant into two named ways, so the clock tower built twice — gate
  once-only features on `ringAreaM2`.
- **Do NOT use OSM's `width` tag to size roads.** On Charlestown residential
  streets its median is **11.0 m against our 7 m default**, because MassGIS tags
  the RIGHT-OF-WAY, not the travelled way. Adopting it makes buildings-in-roads
  worse, not better.
- **Never use OSM `layer` as an absolute elevation.** `layer=1` just means "on
  top" and sits on nearly every bridge in every town (NBPT 26, Amesbury 55).
  Stacking comes from merge ends.
- **Diagnostic trap:** `deckHeightAt` / `bucket()` only see **LOADED chunks**, so
  a grid sweep silently returns 0 far from the player. Two of my sweeps read "no
  problems" for exactly this reason. Position the player and bound the region.
- **`travelToXY` snaps to walkable ground**, so `go()` into water lands you
  elsewhere — check `nbpt.pos()` after moving. To verify a hero, scan the chunk
  mesh for its own hex values rather than hunting camera angles.
- **Editing `decor.ts` does not rebuild already-built chunks** — reload, or move
  far enough to force an LRU rebuild, before judging a hero.
- **`make_course`:** a via sitting on a SPUR makes Dijkstra go in and come
  straight back out. The first epic retraced ~10 route points at Sullivan Square.
  Check the emitted route for repeated vertices before accepting it.
- OSM tags the Monument `building=yes` + `historic=monument`, so it classified as
  a 1.5-storey **house**, and the original recon sweep missed it entirely because
  that sweep looked at historic/park/station. **Search landmark names as
  BUILDINGS too.**
- Overpass mirrors were congested all session: pull the whole frame once with
  `OSM_TILES`, then query `data/<town>/raw/overpass.json` LOCALLY.

## Reusable diagnostics (seconds per town — run before AND after any change)

- buildings whose footprint intrudes on road pavement (all 11 towns sit at
  ~0.6–1.9%; Charlestown was 5.4% before the deck work)
- landmark anchors in water / inside buildings / on major pavement — **already
  run across all eleven, came back clean.** The one flag worth a look is
  **Ipswich's `five-corners`, which sits on primary pavement and is that town's
  SPAWN point.**
- bridge deck grades, buried deck ends, deck widths, blocked-point sampling over
  an interchange, and a straight walk *under* an elevated road

## Still open

1. A launch post (r/Charlestown or r/boston) — Devin's call, nothing posted.
2. Minor heroes: First Church (currently the decent generic `k:'church'`), Round
   Corner House, Carpenter Shop, Paint Shop.
3. `borderLore` copy review — neighbours are Boston neighbourhoods plus four
   cities, so the lines read differently from a town line.
4. One ~29 px hop remains where a low slab gets mounted (the kid model is 33 px
   tall, so a 29 px soffit really is too low to pass under).
5. Monument Square's 54 trees are REAL surveyed OSM positions (19% pine per the
   shared style). The "conifer farm" look is the shared deciduous builder's three
   stacked canopy blobs — **not** a Charlestown bug. Don't fix it per-town.
