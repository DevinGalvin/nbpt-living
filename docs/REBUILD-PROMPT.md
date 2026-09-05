# Clipper Town — one-shot rebuild prompt

*Written 2026-09-05 from a full audit of this repo (50 commits, ~31k lines of TypeScript, twelve towns, live at clippertown.io). Everything below the line is the prompt. Paste it whole into the other model. Fill in the two bracketed choices at the top first.*

---

You are building **Clipper Town**: a cozy, all-ages open-world game set on the **exact real map of Newburyport, Massachusetts**. A kid from Newburyport should be able to walk to their own house. A 35-year-old who grew up on Lime Street should screenshot it for the group chat. Nobody dies, nothing fails, there are no timers that punish.

A previous build of this game exists. **You are not porting it.** It was built with Three.js, procedural box geometry, a DOM HUD, and one 10,000-line file. Those were the choices of a particular tool under particular constraints, not the design. Pick whatever engine, renderer, art direction, and architecture will produce the best game you can ship in one pass. If a better technique exists, use it. What must survive is the **map, the content, the tone, and the UX rules** in this document.

Two choices are yours to settle before you start; defaults are given.

- **[PROTAGONIST]** Default: **you play as Clipper, a golden retriever.** Verbs: walk, run, bark, sniff, dig, swim, skateboard, zoomies. Gram's grandkid is a companion who talks for you. Alternative: play as the kid with Clipper heeling. Pick one and keep every line of dialogue consistent with it.
- **[SCOPE]** Default: **ship the vertical slice below in full**, with the rest designed and stubbed cleanly. Alternative: full content. A thin version of everything is worse than a finished slice.

## 1. Non-negotiables

1. **The map is real.** Streets, building footprints, water, parks, cemeteries, piers, the rail line, sidewalks, real tree positions, real backyard pools, real property fences. Source: OpenStreetMap. Origin is Market Square. Exactness is checked, not assumed (see §3).
2. **Attribution:** "Map data © OpenStreetMap contributors (ODbL)" visible in-game. Elevation from AWS Terrain Tiles (public). Credit both.
3. **Kind by default.** No death, no fail state, no lose condition. Enemies are seagulls, greenheads, and the tide.
4. **All-ages, never babyish.** Sneaky Sasquatch / A Short Hike / Pixar register. Deadpan Yankee humor written up, not down. Third graders on phones are the floor audience; lifelong locals are the ceiling.
5. **Everything weird is true.** Every story beat, plaque, and secret is anchored to documented history or real present-day life. If it isn't true, cut it.
6. **Zero data collection.** No accounts, no analytics that identify anyone, no ads ever. Saves are local and silent.
7. **Phone first, desktop fully supported.** Touch joystick plus on-screen verbs; keyboard plus mouse on desktop. 60 fps on a mid-range phone.
8. **Freelance is guaranteed.** The story is opt-in pace. "Just running around Newburyport" is a first-class way to play. Ask once at start: *Just explore* or *Follow the story*, switchable in settings.

## 2. The player and the town

- **Home:** the player spawns at **Market Square**, the town's heart, facing the harbor. Never a geometric center, never an anonymous point.
- **Movement:** walk, run/sprint, and a fast mode (skateboard for the dog, bike for the kid) that opens the mainland. Water: swim (dog) or kayak. Sub-stepped collision that **slides along walls** so tight streets glide instead of snag. A stuck player is always ejected to the nearest free ground.
- **Camera:** third-person chase, tilted so you see the block ahead and the harbor beyond, with distance fog. The camera must never end up inside a building; pull in along the sight line when a wall would swallow the view. A north-up map view toggle and a mouse-wheel/pinch zoom.
- **Fast travel:** a map panel listing every landmark (§3.4) with a search box that accepts landmark names, business names, and **street addresses** ("241 High Street" lands you at the real house). Teleport under a fade.
- **HUD, always on:** the current street name in a pill at the bottom center (from the road you're standing on), a small minimap with a "you are here" ping, a compass with a needle (not a rotating letter).
- **The town is alive:** pedestrians on real sidewalks (~20), cars driving right-hand-side on real roads (~10), boats in the harbor in summer, gulls wheeling over water, leashed dogs, deer in the woods that bolt when you bark. Everything recycles near the player; nothing spawns or despawns in view.
- **Time:** a full day-night cycle of about seven real minutes with a long midday, lingering golden hour, and a brief bright night when street lamps and windows come on. The **Gillis drawbridge opens on the hour and half hour** of real clock time, stops traffic, and passes boats.
- **Seasons:** summer (default), fall (foliage, pumpkins on real porches, fog, trick-or-treaters at dusk), winter (snow, frozen Frog Pond with skaters, sledders on March's Hill, the tree lit in Market Square, boats gone), spring. A season is a re-dressing of the whole town, chosen in settings once unlocked by the story.
- **Sound:** procedural or authored, your call, but it must exist: gulls only near water, songbirds in trees, halyards and the foghorn at the harbor, footsteps that change on brick/asphalt/sand/boardwalk, a lo-fi music bed with a few moods, and short cues for discovery, chapter complete, bell, bark. Mute in settings. Audio must survive backgrounding on iOS.

## 3. The map: data, projection, and exactness

### 3.1 Frame
- **Origin (0,0) = Market Square:** lat 42.81135, lon −70.86976.
- **Bounding box:** S 42.763, W −70.955, N 42.840, E −70.795 (the city plus Plum Island, the Merrimack, and the West Newbury frame). About 13 km east-west by 8.5 km north-south.
- **Projection:** local equirectangular is enough at this scale. Meters per degree at the origin: lat 111,089, lon 81,791.7. Choose any world unit; the reference used 8 units per meter. World +x = east, world +z (or +y in 2D) = south.

### 3.2 Fetch
Pull raw OSM from Overpass (tile the bbox into a few queries and dedupe by element id if a single query times out; mirrors rate-limit by request rate, not size). Tags to fetch, all with full geometry:

```
highway=*                                   roads, sidewalks, footways, steps, crossings
railway=rail|light_rail
building=*                                  plus building:levels, min_level, architecture
natural=water|wetland|beach|sand|coastline|wood|scrub|grassland|shoal|tree_row
natural=tree (nodes)                        real surveyed trees, take priority over planted ones
leisure=swimming_pool                       real backyard pools
barrier=fence|hedge|wall|retaining_wall     real property lines, they also block movement
landuse=grass|forest|meadow|cemetery|recreation_ground|village_green|orchard|farmland|retail|commercial
leisure=park|pitch|playground|garden|track|golf_course|nature_reserve|dog_park|stadium
man_made=pier|breakwater|groyne             plus mooring tags
aeroway=*                                   Plum Island Airport runway 10/28 (turf) and taxiways
power=line|minor_line                       vertices are poles
place=square, amenity=parking|fountain|marketplace
addr:housenumber + addr:street (nodes and ways)   the address index that makes "find my house" work
shop/amenity/tourism POI nodes              storefront signs
admin boundaries for Newburyport, Newbury, Salisbury, Amesbury, West Newbury   "Entering …" banner and welcome signs
```

Water is a multipolygon problem: the Merrimack is a ~13 km² ring with ~22 island holes. Assemble relations correctly. Build the ocean from the coastline. Drop these three OSM ways, which are phantom golf-course ponds: 279021841, 920420732, 12474826.

### 3.3 Expect roughly
About 13,000 buildings (10,750 houses, 2,000 sheds, 170 commercial, 19 civic, 9 churches, 3 lighthouses), 3,860 road segments, 2,430 paths, 3,500 land/water polygons (1,045 water, 645 wood, 487 wetland, 14 cemeteries, 69 pools), 1,370 barriers, 2,685 surveyed trees, 655 named streets with addresses, 48 town-line crossings. If your counts are wildly off, your fetch or clip is wrong.

### 3.4 Curated landmarks (id · name · subtitle · lat · lon · radius m)
These are the fast-travel destinations and the banner names. Use them verbatim.

```
market-square  · Market Square · Heart of the Clipper City · 42.81135 · -70.86976 · 60
custom-house   · Custom House Maritime Museum · Granite landmark, 1835 · 42.81197 · -70.86824 · 50
city-hall      · City Hall · Newburyport, a city since 1851 · 42.81123 · -70.87276 · 45
inn-street     · Inn Street · Fountain & playground · 42.81072 · -70.87051 · 50
boardwalk      · Waterfront Boardwalk · Market Landing Park · 42.8124 · -70.86973 · 70
cushing-house  · Cushing House · Museum of Old Newbury, 1808 · 42.80667 · -70.87111 · 40
courthouse     · Superior Courthouse · Bulfinch design, 1805 · 42.80814 · -70.87399 · 45
frog-pond      · Frog Pond · Bartlet Mall · Skating & sledding since forever · 42.80812 · -70.87475 · 80
old-hill       · Old Hill Burying Ground · Lord Dexter rests here · 42.80748 · -70.87651 · 60
browns-square  · Brown Square · Garrison statue · 42.8118 · -70.874 · 40
marchs-hill    · March's Hill · Best sledding in town · 42.80133 · -70.86646 · 80
oak-hill       · Oak Hill Cemetery · Garden cemetery, 1842 · 42.80151 · -70.87119 · 70
joppa-park     · Joppa Park · Clam country · 42.80697 · -70.85872 · 60
mbta           · Newburyport Station · Trains to Boston · 42.79815 · -70.87815 · 80
cashman        · Cashman Park · Boat ramp & ballfields · 42.81651 · -70.8781 · 90
gillis         · Gillis Drawbridge · Opens on the hour & half hour · 42.8154 · -70.87346 · 90
atkinson       · Atkinson Common · The stone tower · 42.82518 · -70.89703 · 90
airport        · Plum Island Airport · Oldest airfield in New England, 1910 · 42.79616 · -70.84156 · 110
pink-house     · The Pink House Site · 1925–2025 · never forgotten · 42.79631 · -70.83019 · 80
wilkinson      · Wilkinson Bridge · Gateway to Plum Island · 42.79779 · -70.82149 · 80
pi-light       · Plum Island Light · Guiding ships since 1788 · 42.81523 · -70.81894 · 90
pi-point       · Plum Island Point · Where the river meets the sea · 42.8165 · -70.818 · 110
joppa-flats    · Joppa Flats Education Center · Mass Audubon · 42.7989 · -70.8455 · 70
tannery        · The Tannery · Marketplace in the old mill · 42.8101 · -70.866 · 70
maudslay       · Maudslay State Park · Gardens of the old Moseley estate · 42.82643 · -70.92816 · 140
moseley-woods  · Moseley Woods · Pines over the Merrimack · 42.83284 · -70.9093 · 80
deer-island    · Deer Island · The Chain Bridge crossing, 1792 · 42.83457 · -70.90693 · 80
artichoke      · Artichoke Reservoir · The city's drinking water · 42.81049 · -70.93092 · 120
turkey-hill    · Turkey Hill · West-end farm country · 42.80949 · -70.92344 · 100
common-pasture · Common Pasture · Cows since 1635 · 42.7884 · -70.91467 · 140
cherry-hill    · Cherry Hill Fields · Soccer Saturdays · 42.81752 · -70.91964 · 90
spl-farm       · Spencer-Peirce-Little Farm · Stone farmhouse, 1690 · 42.79506 · -70.85203 · 80
```

Real businesses to sign by street address (OSM has about half the storefronts; add these): Fowle's 17 State St · Anchor Stone Deck Pizza 44 State St · The Screening Room 82 State St · Simply Sweet 12 Inn St · The Angry Donut 42 Inn St · Harbor Creamery 39 Pleasant St · Abraham's Bagels 11 Liberty St · The Grog 13 Middle St · Black Cow 40 Merrimac St · Plum Island Kayak 92 Merrimac St · Jabberwocky Bookshop, Chococoa Baking Co., Henry Bear's Park at 50 Water St · Mad Martha's 51 Northern Blvd · Bob Lobster 49 Plum Island Tpke. The William Lloyd Garrison statue stands in Brown Square. The Timothy Dexter House is 201 High Street.

### 3.5 Terrain
Pull elevation (AWS Terrain Tiles, "terrarium" PNG, zoom 14–15) into a heightfield for the bbox. High Street really is a 20 m ridge and March's Hill really drops. Ground, buildings, and the player ride the heightfield; bridges span from the higher bank; **every bridge deck must clear whatever crosses beneath it**, derived from the data, and decks are walked onto from their ends, never teleported onto.

### 3.6 Exactness QA (fail the build if these miss)
- Market Square to Newburyport Station: **1.62 km**.
- Market Square to Plum Island Light: **4.2 km**.
- Elevation spot checks: Market Square (near sea level), Cushing House on the High Street ridge, March's Hill top, Plum Island beach, Joppa shore.
- Every curated landmark and every history marker (§5.2) must sit on **walkable ground**, not inside its own building. Check it with the collision data, not by eye.

## 4. Rendering intent (the what, not the how)

You choose the look. These are the things a local must recognize:

- **The 1811 brick downtown.** After the Great Fire the core (roughly lat 42.8146/lon −70.8748 to 42.8093/−70.8652) was rebuilt in brick all at once. Render commercial and civic buildings in that core as brick with Federal cornices and storefront ground floors (glass, awnings, sign bands). Everything else is painted clapboard: white and cream colonials, historic sage, wedgewood, yellow, Essex-green and black shutters. East of Plum Island Turnpike's end the houses are weathered cedar shingle beach cottages with dune grass.
- **Roofs from footprints.** Extrude every building from its exact footprint. Gable L- and T-shaped houses by splitting at concavities. A bounding-box gable that would roof a street is a bug; fall back to a flat roof on the exact outline.
- **Named hero buildings** that deserve custom treatment: the Custom House (granite, 1835), Old South Presbyterian (Whitefield's crypt, the Revere bell), First Religious Society steeple, City Hall, the Bulfinch Superior Courthouse, the Cushing House, Timothy Dexter's house at 201 High with statues on columns, the Powder House, the Old Jail, the Garrison Inn, Newburyport High School, Brown School, Plum Island Light, the Front and Rear Range Lights, the Plum Island Point gazebo, the Gillis drawbridge, the Chain Bridge, the MBTA station with a train, the Tannery mill, the Firehouse (Market House, 1823). The USRC *Massachusetts* is moored at the waterfront.
- **Ground that reads at every distance:** street names painted on the pavement, crosswalks, centerlines, brick plazas at Market Square and Inn Street, boardwalk planks, marsh ticks, sand with ripple lines, textured turf.
- **Street furniture:** lantern lamps, benches at park and plaza edges, picket fences on front yards, driveways to the nearest road with parked cars, foundation bushes, pines and layered deciduous trees never on pavement, gravestones filling all 14 cemeteries facing the grounds' grain.
- **Water:** one animated surface for river, harbor, marsh creeks and ocean with sun glints and shallow edges; small ponds freeze in winter, the river never does.
- **Chunked streaming** with eviction, an impostor for the far field, dynamic resolution scaling on phones, and a memory budget you actually measure.

## 5. Content

### 5.1 The story spine (the "Zelda part")
Two levels, nine chapters, one gold objective beacon at a time with an off-screen arrow, a Journey panel of chapter cards with checkable steps and replay, a Backpack. A **beat** is one step advanced by reaching a spot or pressing the contextual action button (💬 TALK / 📜 READ / 🔔 RING / 👀 LOOK), which plays a short `who: text` dialogue and autosaves. Talk radius about 11 m.

**Level 1 — The Smugglers' Map** (summer, downtown, the real sealed smugglers' tunnels)
1. **Overdue** — Find Gram in Market Square → Get the donuts on Inn Street (The Angry Donut) → Return Gram's book to the library (the 1771 Tracy Mansion) → Bring Gram her donuts → Follow Clipper to what he found (the grate behind the Firehouse). Reward: *Library card*.
2. **The Door Under Downtown** — Go down through the grate → Light the way and find the smuggler's mark → Find the torn map corner. A contained brick tunnel interior: dark, lantern cone, a cache, rubble. Reward: *Lantern*.
3. **The Daily News** — Talk to the Editor on Liberty Street → Deliver the papers to 8 real addresses → Search the morgue (newsroom interior). Reward: *Bicycle / Skateboard*.
4. **Low Water** — Row out to the waterline door below the seawall → Read the Wharf Rats' ledger → Find the third map corner → Ring the den's bell. Reward: *Third map corner*.
5. **The Custom House Star** — Bring the three corners back to Gram → Talk to the Custom House keeper → Ring the three harbor bells → Open the room with no door (cellar beneath the Custom House). Finishing Level 1 unlocks seasons and drops the town into winter.

**Level 2 — The Light That Walks** (winter dusk, Joppa Flats and Plum Island)
1. **The False Light** — Find the birdwatcher at Joppa Flats → Spot the light out past the lighthouse. Reward: *Binoculars*.
2. **The Walking Light** — Ask Gram about the light (she has moved to Joppa) → Take grandpa's kayak from the Joppa slip → Paddle out to the light. Reward: *Grandpa's kayak*.
3. **The Lamplighter** — Meet the lobsterman on the water → Relight the keeper's four lamps → Reach the keeper at his last lamp.
4. **Bring the Light Home** — Meet the lobsterman as the storm breaks → Light the Rear Range Light → Sweep the beam and guide four boats home. Reward: *A Christmas in Clipper Town* (the tree lighting in Market Square, Santa arriving by Coast Guard boat, a real tradition).

**Cast and voice.** Gram (dry, brisk, loves you), the Donut Maker, the Librarian, the Editor, the Custom House Keeper, the Birdwatcher, the Lobsterman, the Keeper. Sample of the register:

> Gram: "There you are. Two jobs today. Take Clipper, the dog — he's in charge."
> Gram: "Two: this book goes back to the library. It was due in March."
> Gram: "…of last year. It was your grandfather's. He never did finish it."
> Donut Maker: "Gram's order? Brave kid. One dozen, extra angry. Careful with the box."

Short lines. Real words. Jokes kept. Spooky welcome, never gory.

**Designed, not yet built** (stub the hooks): a Halloween chapter with the 1679 Morse poltergeist at Market Square, the Great Fire bucket brigade as a playable "Echo" on the night of May 31, 1811, Young Garrison's paper route ending at his Brown Square statue, the walking lighthouse on log rollers, Plover Patrol, the Sunday farmers market at the Tannery.

### 5.2 Discovery markers (36 true stories)
Bronze plaques at real spots with a glint until read. Within ~7 m a 📜 READ button appears; reading captures the current frame as the card's photo and opens a card: title, year, body, optional stamp. A collection panel shows every slot from the start, locked ones with icon, year, and a nearest-street hint. All 36 read → **Town Historian**.

The first six are Indigenous history and lead the list on purpose: Before the Ships (5,000 years ago) · Molodemak (the river's first name) · Four Homes in One Year · The Name of This Place (Quascacunquen means "just right for gardens," not "waterfall") · Old Will Stood His Ground (1679) · The Way North (1695). Then: The Great Fire (1811) · The Market House (1823) · The Custom House · Birthplace of the Coast Guard (1791) · The Steeple · The Tracy Mansion · The Bulfinch Courthouse · The Cushing House · The Preacher Underneath (Whitefield's crypt) · The Walking Lighthouse · The Range Lights · Lord Timothy Dexter · Dexter's Museum · The Paper Boy (Garrison) · The Powder House · The Old Gaol · First Flight at Plum Island (1910) · The Chain Bridge (1792) · The Mills · City Hall · The House That Threw Things (1679 poltergeist) · The Street That Fought Back · Joppa · March's Hill · Oak Hill · The Stone Manor · The Pink House · Maudslay · The Mooncussers · Atkinson Common.

Card register, verbatim from the reference:

> **The Great Fire · 1811** — One night in May 1811, a fire started in a stable near Inn Street. By morning, most of downtown was gone. The town rebuilt it all in brick, all at once — and that is the downtown you are standing in. Look around: the fire is why everything matches.

Three to six sentences, grade 4–6 reading level, present tense where the people are present tense, every claim citable.

### 5.3 Secrets (24, no beacons, no hints, no objectives)
The counter only appears after the first find. Eight of Lord Dexter's wooden statues scattered by the real 1815 gale (Washington, Adams, Jefferson, Napoleon, Venus, Pitt, and Dexter's own "First in the East" and "First in the West"); recover all eight and they're restored on columns at 201 High Street. Plus: pet Clipper · the Konami code (golden hoodie) · `xyzzy` typed in the travel search (the developers' base camp on Carr Island) · stand very still off Plum Island Point for the 1817 sea serpent · ring the Paul Revere bell at Old South · frogs at Frog Pond (asleep in winter) · toss a coin in the Inn Street fountain · read Dexter's unpunctuated *A Pickle for the Knowing Ones* · listen to the PA at the MBTA station · touch the mooncusser's false lantern on the dunes · scoop purple garnet sand · watch the sky for the 1910 Flying Fish over the runway · wake Fowle's neon · a blue-raspberry slushie at Richdale · shout MARCO at any of the real backyard pools · look at Bossy Gillis's drawbridge. All 24 → fireworks over the harbor and **Town Legend**.

### 5.4 Races (opt-in mastery)
Time trials on real streets: **South End Scramble** (Bromfield top → Joppa Park), **The Merrimack Run** (Maudslay gate → Market Square), **Yankee Homecoming** (Plum Island Light → Market Square). Only rule: cross the finish. Gates are guidance, shortcuts are legal. No medals; a per-name local best, a ghost of the best run, a strictly kid-safe name filter. The picker shows real distance and an estimated time.

### 5.5 Vertical slice (must be complete and polished in this pass)
The whole town rendered and walkable · spawn, movement, fast travel, address search · street pill, minimap, compass · living town (peds, cars, boats, gulls) · day-night · drawbridge clock · summer and one other season · **Level 1 Chapter 1 "Overdue" end to end with the grate reveal** · at least 12 of the 36 discovery markers with the full card and collection UI · at least 6 secrets including the statues mechanic · one race · settings (story mode, sound, season) · autosave and resume · PWA offline after first load. Everything else in §5 is data-driven so it can be added without touching engine code.

## 6. UX rules (grammar, not taste)

Every one of these was learned from a shipped panel a kid read wrong.

1. **Position encodes hierarchy.** A control that leaves a level sits above the thing it leaves.
2. **Direction encodes destination.** Back and out are left. Forward and in are right. Up a level is up. A waypoint pointer at the top of the screen must not look like a back chevron.
3. **A control needs a word.** Every icon button carries a small always-on label. `title=` does not exist on touch and is not a label.
4. **Hit area ≥ 44×44 even when the control looks small.** Especially the ✕, "Maybe later," and any reset.
5. **Clickable looks clickable.** Pointer cursor plus a visible edge. Bare text with a handler is a secret.
6. **Destructive actions arm, then confirm, in our own words.** Never `confirm()`.
7. **A feature the platform does badly is worse than none.** Do not ship read-aloud on `speechSynthesis`.
8. **Motion arrives, then stops.** Transform and opacity only. Staggered entrances capped at ~14 steps. Nothing loops behind text you are meant to read. Respect `prefers-reduced-motion` including delays.
9. **Not every colour is a theme colour.** Two identity tokens (the reference used maroon and gold); everything else is neutral ink and chrome.
10. **"On your first X" coaching is invisible to anyone who already has an X.** Coach on the action, not the count.

Also: one name per feature (the reference had QUESTS, JOURNEY, and Story for the same panel). No text under 12 px. Landscape phones must fit. Modals get a role, focus management, and Escape. Nothing silently fails; if you can't skate indoors, say so in one line.

## 7. Beat the reference build

Things the previous build got wrong that you must not repeat:

- Four popups in the first ten seconds (mode pick, street nudge, gear hint, race promo). One choice, then the town. Coaching appears when the action is first relevant.
- Hidden controls: sprint was a two-finger hold with no hint; bark, sniff and dig shared one button by press length.
- The camera and the collision disagreed about building heights because they were computed twice.
- Fast travel built 49 chunks synchronously under the fade. Build a small core, then stream.
- The story was hard-coded to the engine; chapters, markers and secrets were not data. Make them data from day one.
- A single 10k-line render file and a 4k-line HUD file. Modules by responsibility.
- Unguarded `localStorage` reads inside the frame loop killed the game in storage-blocked browsers. Guard storage, wrap the loop.
- Held keys were never cleared on window blur.
- No CI, no lint, no tests. Ship `typecheck`, `lint`, a data-QA script (§3.6), and a headless smoke test that boots the game and walks 30 m.

## 8. Deliverable

- One repository. `npm install && npm run dev` runs it; `npm run map` fetches OSM and terrain and rebuilds the world data; `npm run build` produces a static site deployable to GitHub Pages under a domain root.
- A `README.md` that a new engineer can follow, and a `docs/DATA.md` describing the world format so a second town is config plus data, not a fork.
- Debug hooks on `window` for teleport, time of day, season, and position.
- Before you finish: run the QA script, run the smoke test on a 390×844 touch viewport and a 1440×900 desktop, and report frame time, heap, and chunk count at Market Square, Plum Island Point, and Maudslay. Report honestly; a number you didn't measure is not a number.

Build the data pipeline first, the walkable town second, the HUD third, then Chapter 1, then markers and secrets. At each step, stand at Market Square and ask whether someone from Newburyport would recognize where they are.
