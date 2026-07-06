# Beverly — build handoff (July 6, 2026)

Beverly, MA is BUILT as the third town (`towns/beverly/`, branch **`beverly`**,
worktree `../nbpt-beverly`) per docs/TOWNS.md. **NOT merged to `source` yet** —
merging auto-deploys it to clippertown.io/beverly/ via CI, so that's Devin's call.

Run it: `npm run dev:beverly` (or the `beverly` entry in .claude/launch.json, port 5219).

## What shipped (all verified in preview unless noted)

- **World**: 29,436 buildings / 21,780 addresses / 6.0MB world.json; bbox
  airport→Beverly Farms→Salem Willows (42.522–42.600 / -70.935–-70.755); ocean
  38.26 km², Misery Islands verified as walkable land; Overture heights
  (5506↑/9687↓); terrain heights.bin 4.38MB (larger frame than NBPT's 1.3MB —
  first load ~10.5MB; service worker makes repeats free, but watch it).
- **38 fast-travel landmarks** (recipe mix, 1/3 kid-life), all snapped to built
  features + water-checked. Salem Willows included as the across-harbor nod.
- **Borders**: 9 municipalities, 84 welcome signs (incl. Marblehead/Essex lore).
- **Racing ladder**: Hannah Dash 1.0mi (Common→Glover Wharf), Shore Run 1.9mi
  (Depot→Lynch Park), Farms Homecoming 3.9mi (Farms→Ellis Sq). Board partitions
  by `raceTown:'beverly'` automatically — nothing to deploy.
- **Pack anchors** (all from built geometry): spawn Ellis Sq; flight = real
  runway 16 threshold [-27000,-29500] hdg 0.69 (SSE over town, the real
  pattern); trainPlatform beside the Depot (train renders ✓); Kellehers Pond
  skaters; Ancient Burial Ground fall mist; Ellis Sq holiday tree.
- **13 heroes live** (specs + photo-verified colors in docs/research/beverly.md):
  config-tier — Balch (firstPeriod), Hale Farm (MUSTARD gambrel), Cabot House,
  City Hall (painted red + flag + flat — no cupola since 1933), Tupper Manor,
  Hospital Point Light (square white tower on the k:'light' footprint);
  bespoke (workflow-authored) — Depot ✓, Library ✓, Cummings Shoe ×4 ✓,
  Cabot Theatre, First Parish ✓, Prides Crossing station, Golf & Tennis
  Clubhouse. (✓ = eyeballed in preview; others compile + follow spec.)
- **New shared tooling**: `OSM_TILES=RxC` tiled Overpass fetch (out geom clips
  to FULL frame so cross-tile ways merge exactly; modest timeout/maxsize asks —
  BIG asks make schedulers defer past the gateways' 504 horizon — that's why
  huge single queries "time out on every mirror"); `nameFixes` in map.mjs
  (stamps POI-only names onto footprints so HEROES bind); placeEmoji rules
  (stadium/theatre/library/🍦/⚾/👞/🥪, farms≠farm, Fish-FLAKE≠lake).

## Gotchas learned

- Preview after `location.reload()`: the tab loses live rAF — screenshots go
  stale. `preview_click` the canvas once to restore, then pump frames.
- make_course: fewer vias = better routes; each via near an off-road POI
  forces a there-and-back detour.
- The Depot's OSM footprint is near-square (restaurant additions merged), not
  the long 1897 rectangle — the builder normalizes its OBB; eyeball any tweak.

## Remaining polish (ranked)

1. **og-image.jpg is still Salem's placeholder** — capture a Beverly hero shot
   (Depot or Lynch Park summer) before any launch. Manifest/branding otherwise done.
2. **Race end-to-end test**: run Hannah Dash, check countdown faces down-course,
   finish card, cloud board tab 'beverly' writes/reads.
3. **Heroes not yet modeled** (all researched in docs/research/beverly.md):
   Odd Fellows Hall (needs a nameFix anchor), Larcom Theatre, GAR Hall, Dane St
   Church, Lynch Park carriage house (LOW color confidence), Briscoe, Beverly
   Farms branch library, First Baptist steeple. **St. Mary Star of the Sea:
   colors UNVERIFIED — the Ropes-class trap; verify photos before modeling.**
4. **Lynch Park sled hill** (`sledLane`/`attractions.sledHill`): the real
   snow-day hill — needs terrain-verified top/dir/run.
5. Visual QA pass on the untouched bespokes (Prides, clubhouse, theatre) +
   Balch/Tupper/Hospital Point; roof-overhang + neighbor-swallow check around
   the Depot's deep canopy.
6. Seasonal harbor moorings eyeball (Glover Wharf, Bass River, Danvers River);
   Cabot St storefront corridor read (looked fine in shots).
7. Kid-UX wave parity (blab labels / read-aloud / 44px closes) — same gap as Salem.
8. First-visit flow on a clean profile (street nudge, promos, welcome banner).
9. Under [[nbpt-educational-pivot]]: Beverly's landmark subs are history-forward
   already; it's the natural first town for history cards ("we ENDED the witch
   hunt" is the anti-Salem hook).

## Deploy (when Devin says go)

Merge `beverly` → `source`, push. CI (`build:all`, already extended with the
beverly step) ships `/beverly/` alongside `/` and `/salem/`. The town switcher
in ALL towns starts showing ⛵ Beverly automatically (registry.ts).
