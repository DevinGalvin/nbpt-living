# Gloucester — build handoff (July 13, 2026)

**State: BUILT on branch `gloucester` — NOT merged. Merging to `source` = live
deploy at clippertown.io/gloucester/ (Devin's call).** Fifth town, built the
same evening Ipswich shipped, via the docs/TOWNS.md checklist. Dev server:
`npm run dev:gloucester` (launch.json `gloucester`, port 5279).

## What's in

- **World**: all of Cape Ann — 18,215 buildings (9,518 with Overture ML
  heights), 4.5MB world.json, 5.36MB heights.bin, 14 welcome signs
  (Rockport/Essex/Manchester + inner lines). Rockport village, Bearskin Neck,
  Motif No. 1, Halibut Point, and the Thacher twins ride IN-FRAME as nods
  (the Essex-village nod lives in Ipswich's frame next door — the two maps
  meet at the town line).
- **THE COASTLINE FIX** (engine, `tools/build_world.mjs`): Cape Ann exposed
  two ocean-sweep defects — a degenerate 2-pt coastline fragment spawned a
  phantom full-frame ocean that drowned Magnolia + Hammond Castle, and
  Norman's Woe's ring misses closing by 127px (7px over tolerance). The sweep
  now closes near-loops, drops degenerate stubs (warnings for both), and picks
  rotation from OSM's water-on-the-RIGHT invariant instead of the old
  origin-stays-dry check — which is BLIND when downtown sits on a closed
  island loop (Cape Ann is an island; the Cut makes it one). Regression:
  NBPT + Ipswich oceans rebuild byte-identical.
- **41 landmarks** (research: `docs/research/gloucester-landmarks.md`, all
  cited): spawn = **Man at the Wheel** on Stacy Blvd; the greasy pole is a
  real mapped pier; Dogtown + Whale's Jaw + a Babson-boulder pin; kid-life
  from Good Harbor to Holy Cow; Rockport nods. All 41 water-probed dry.
- **Races**: Boulevard Dash 0.9mi (St. Peter's Sq → over the Cut → Stage
  Fort), Good Harbor Run 2.1mi (City Hall → the footbridge), **Rockport
  Homecoming 5.0mi** (Bearskin Neck → Man at the Wheel) — the longest epic
  in any town. Countdown/gates/clock/state verified live.
- **✈️ Flight from Ten Pound Island** — verified history: the first
  successful US Coast Guard air station (1925, "Base 7", one borrowed Vought
  seaplane, canvas hangar, the first-ever aircraft rum-runner chase). Its
  1935 replacement is CG Air Station Salem = the game's Salem flight site;
  the CG Aviation Monument on the Boulevard (modeled) ties the story to the
  spawn.
- **Heroes** (dossier: `docs/research/gloucester.md`, photo-verified;
  UNVERIFIED = deliberately not modeled): Hammond Castle, Our Lady of Good
  Voyage (twin royal-blue onion domes + schooner Madonna), City Hall
  (clock tower, oxidized-BROWN dome — not verdigris), Motif No. 1 (the '78
  replica, weathered barn red + buoy wall), the Paint Factory (red WOOD, not
  brick), Beauport, Sargent House, Cape Ann Museum. Parametric `lightTower`
  drives all five lights — Eastern Point (red cap), Ten Pound (keeper's
  house correctly ABSENT), Annisquam, both Thacher twins (unpainted granite,
  verdigris tops) from one shared OSM name. New **POI_HEROES** tier =
  name-keyed monument builders for point features: Man at the Wheel,
  Fishermen's Wives, Tablet Rock, CG Aviation Monument.
- **Assets**: unique og-image (golden-hour Boulevard, 1200×630), manifest,
  harbor-teal theme; all guards green (spawn, assets, tsc).
- Emoji rules gained 🐋/🏭/🎨/aviation-✈️/fish-pier-⚓ (regression-checked;
  Salem Willows' "pier" kept 🌳 via the tight `fish pier` regex).

## Ranked polish list (post-merge)

1. **Race full-ride e2e + board round-trip** — start/gates/clock verified;
   ride one course to the finish card on a real device (the headless
   waypoint driver wedged on the Pavilion Beach seawall — it cuts corners
   off-road; humans following chevrons won't. Not a course defect.)
2. **City Hall close-up check** — nameFix landed and the clock tower builds;
   confirm the hero fired on the right footprint (a shuttered generic sits
   just south of it) and the dome/pavilions read from Dale Ave.
3. **Hammond Castle dressing** — massing/tower/windows in; add the sea-side
   Gothic arcade, crenellation, and lighten the slate caps a touch.
4. **Greasy pole rig** — the pier deck exists in-world; add the horizontal
   pole + red flag set piece (Fiesta config from the dossier).
5. **Man at the Wheel scale** — reads correct-but-modest; consider 1.3×.
6. **Bearskin Neck palette pass** — paint the lane's shacks from the
   verified recipe (barn red + gray shingle + white trim + Pewter Shop blues).
7. **GHS white deco tower, Shalin Liu facade, Old Sloop clock** —
   photo-verified specs sitting in the dossier, unbuilt.
8. **Dogtown Babson boulder hunt** — 15 carved boulders w/ cross-confirmed
   coords in the landmark doc = a ready-made educational treasure hunt.
9. **Ghost lettering decals** — Paint Factory "MANUFACTORY / ESTABLISHED
   1863" + Cape Ann Museum's "Storms Rage" mural wall (canvas-decal tech).
10. **Wind turbines** — the two white turbines above Blackburn (in OSM,
    photo-confirmed); kids will spot them from the flight.

## Session gotchas (new ones — Ipswich's still apply)

- **`rotBox`/`box` take HALF-extents.** Sizing them as full extents renders
  2× overlays — the first Hammond pass wore a giant black slab (its stucco
  court, doubled). The monuments got lucky; the castle didn't.
- **OSM name traps** (all handled, verbatim keys in decor.ts): `Our Lady of
  Good Voyages Church` (extra s), `Fishermens' Monument` (odd apostrophe),
  `Cape Ann Light (Twin Lights)` on BOTH towers (a feature: one HEROES entry
  lights both), City Hall/Cape Ann Museum/Beauport/Motif/Paint Factory named
  only on POI nodes or not at all → `nameFixes` in map.mjs.
- **Landmark coords from Wikipedia can be the PARISH, not the BUILDING** —
  OLGV's wiki coord sat 500px from the OSM footprint; always cross-check
  against the named-features dump before pinning.
