# Bridges & road markings — redesign brief (July 6, 2026)

## What happened

The 7/6 "bridges + highways engine pass" (98c0e6b) made the hard cases WORSE
and shipped live; Devin caught it (Gillis approach origami, marking spaghetti
on arterials). Reverted same day (a7b595b) keeping only the verified-safe
parts: under-deck collision, motorway traffic, per-way deck Y-epsilon.

## Why it failed — the real root cause

Both failures share one mistake: **treating each OSM way as an independent
renderable.** Bridges and lane markings are properties of the road NETWORK,
not of individual ways.

1. **Mitred deck strips** were correct for one clean polyline but had no
   defense against real map data: duplicate points, direction reversals, and
   the sharp angles where ramp ways meet a span. At those spots the averaged
   normal flips or the mitre extends into a spike → twisted bowtie quads.
   And every way still got its own strip, so merges = overlapping decks.
2. **Per-way markings** (edge lines + lane dashes per way) ignore that a
   street is many short ways sharing endpoints, plus links/turn lanes. At
   every junction, each way's full marking set crosses the others at angles.
   Real roads STOP their markings at junctions.
3. **Verification failure**: I checked the easy mid-span and one highway
   straightaway, not the known-hard sites. The mess was where ways MEET.

## The design that solves it (not patches it)

**A. Build a road-graph pass** (at world build or index load): nodes = shared
way endpoints. Classify: junction (degree ≥3), continuation (degree 2),
terminus. Derive **chains**: maximal degree-2 runs of same-class ways merged
into one logical polyline. (Optional later: detect dual-carriageway pairs.)

**B. Junction-aware markings** — two independent, individually-shippable parts:
   1. Paint markings per CHAIN (one continuous stroke, no seam overlaps).
   2. After all markings, repaint plain-asphalt discs over every junction
      node (r ≈ the widest meeting way). Kills spaghetti even before chains.

**C. Decks per chain, not per way**: one strip per bridge chain — ends only at
true junctions or banks. A ramp deck merging into a span ends AT the junction
node (the epsilon covers the residual seam under the main deck).

**D. Mitre with defenses** (the strip math itself was fine mid-span):
   - dedupe consecutive points closer than ~1px before anything else
   - if turn angle > ~40°: BEVEL (two edge points) instead of extended mitre
   - clamp mitre scale at ~1.4× (2.5× was a spike license)
   - if lateral flips vs the previous node (dot < 0), flip its sign — this is
     the twist/bowtie guard

**E. Approach blend**: over the last ~60px of a chain, ramp deck Y into the
painted road grade and drop fascia/rails/caps, so the slab dies into the
pavement instead of ending in a stub.

**F. Only then** re-apply highway paint (edges + lane dashes) on top of B —
it becomes safe once markings are chain-based and junction-clipped.

## Verification protocol (non-negotiable this time)

Fixed before/after gallery at the HARD sites, three zooms each, BEFORE any
push — and Devin sees it first:
- Gillis approach + bascule channel (NBPT) — the origami site
- the "Tournament Wharf" arterial from Devin's screenshot 2
- Rte 128 interchange (Beverly) + Essex Bridge dual carriageway
- one Salem bridge + one rail overpass
Plus: walk the full Gillis span on foot; drive-under at an underpass.

## Status

- Revert live (a7b595b). Collision + traffic speeds + eps kept.
- **IMPLEMENTED on branch `beverly` (7/6 evening)**: roadChains() (chains +
  junctions + merge-end resolution) in WorldIndex; chain-based decks with
  defended mitre (dedupe, 1.4x clamp, twist guard) + trim at merge ends +
  merge ends inherit the joined deck's height (re-entrancy-guarded); flush
  +2.5 approach endpoints; junction discs over markings; highway paint
  (edges + lane dashes, motorway white / wide-4-lane mixed).
- Gallery verified in dev: Gillis approach fan (no origami), Route 1 paint +
  junctions (no spaghetti), Essex Bridge chain (continuous, 4-lane paint).
  Remaining before deploy: 128 interchange spot-check, one Salem bridge,
  on-foot span walk. NOT pushed to source — Devin's call.
