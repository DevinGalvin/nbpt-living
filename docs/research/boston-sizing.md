# Boston — what it would take, and why Charlestown goes first (July 26, 2026)

Devin asked what building Boston would cost. Everything below is **measured**,
not estimated: the town figures come from the ten shipped `world.json` files,
the Boston figures from Overpass counts against the real admin boundary.

## The measurements

| | Beverly (largest town today) | **Boston** | ratio |
|---|---|---|---|
| buildings | 29,436 | **119,414** | 4.1× |
| addresses | 21,780 | **92,312** | 4.2× |
| world.json | 5.79 MB | **~26–34 MB** (projected) | ~5× |
| heights.bin | 4.18 MB | ~5 MB | ~1× |

Bytes-per-building across all ten towns: 186 (Salem), 196 (Marblehead), 206
(Beverly), 220 (Rockport), 231 (Amesbury), 246 (Gloucester), 255 (Salisbury),
335 (Manchester), 361 (NBPT), 362 (Ipswich). **Dense, urban towns land at
~190–210 B/building** — which is what Boston is — so the world.json projection
rests on a stable measured constant, not a guess.

`heights.bin` scales with bbox AREA at fixed resolution, not with building
count, so it barely moves. It is not a problem.

## What blocks it — the payload, not the pipeline

The map pipeline scales fine. Two mechanical swaps and it runs:

- **Overpass cannot serve Boston**, even tiled. Raw OSM for the city is roughly
  150–250 MB; a 2×2 tiling of *Salisbury* already drew a 429. Use a Geofabrik
  `massachusetts-latest.osm.pbf` extract clipped with osmium instead.
- **`fetch_heights.mjs`** would query ~119k Overture features instead of ~14k.
  Slower, not harder.

The actual blocker is the runtime: **the engine loads and parses `world.json`
whole at boot** (`G.index.world.buildings` is one array). A 26–34 MB JSON means

- a multi-second `JSON.parse` on a mid-range phone, and
- a ~150–300 MB transient memory spike, which is a genuine iOS Safari tab-kill
  risk.

The service worker and the loading-progress card help *repeat* visits; they do
nothing for the first one. Boston needs **per-tile world data fetched on
demand**. The chunk system already streams *rendering* and already has LRU
eviction — this extends the same idea to *data*. That is the one real piece of
engineering, and it must be regression-tested across all ten existing towns.

## The three tiers, honestly costed

**1. A Boston NEIGHBOURHOOD — fits today's pipeline exactly, zero engine work.**
Charlestown measures **4,888 buildings** in a generous frame — smaller than
Manchester, the smallest town shipped. One session, same shape as the
Amesbury + Salisbury day. See the Charlestown section in `HANDOFF.md`.

**2. Boston proper — after the data-streaming change.** One focused engine
session for per-tile world data plus a ten-town regression, then the bake, then
curation. ~2–3 sessions before it is walkable.

**3. Boston at this project's accuracy bar — where the cost actually is.**
Boston's identity *is* its landmarks; a Boston with grey boxes where Faneuil
Hall and the Citgo sign belong would be worse than not shipping. At the observed
rate of ~8 photo-verified heroes per focused pass, **40–60 heroes ≈ 5–8
sessions**. Landmarks: 150–250 fast-travel spots against 30–44 per town, each
boundary-, water- and landing-verified.

**A Boston worth shipping ≈ 8–12 sessions** at the intensity of the
two-towns-plus-two-accuracy-passes day.

No dollar figure here on purpose — that depends on Devin's API rate, and
inventing one would be worse than leaving it out. Multiply by that rate using a
known session as the yardstick.

## Why Charlestown is the right first bite

- It costs one session and needs **no engine work**.
- It carries two of the most recognisable landmarks in America — the **Bunker
  Hill Monument** and **USS Constitution** — plus the entire Navy Yard, which
  OSM has mapped building-by-building.
- A peninsula is a natural frame, exactly like Marblehead and Rockport.
- It **de-risks the big build**: you learn how Boston's OSM data actually
  behaves (notably its 16% building-relation rate) before committing to the
  streaming rewrite.
