# NBPT Living — Game Concept (v0.1)

*Synthesized 2026-06-11 from the research dossiers in `docs/research/`. Everything here is a proposal for discussion.*

## Elevator pitch

A cozy top-down adventure set on the **exact map of Newburyport, Massachusetts**. You're a kid with a bike, a kayak, and a whole summer. Run errands for neighbors on real streets, earn sand dollars doing odd jobs, protect plover nests on Plum Island — and unravel the city's *genuinely real* mysteries: the sealed smugglers' tunnels under downtown, Lord Dexter's 40 missing statues, and the lighthouse that walks.

**Sneaky Sasquatch meets Alba: A Wildlife Adventure — on a map accurate enough that a Newburyport kid can walk to their own house.**

**Audience: everyone from Newburyport, age 8 or 48.** A nine-year-old can finish it; a lifelong townie should smile the whole way through. Kid-friendly, never kiddish — the Sneaky Sasquatch / A Short Hike / Pixar standard, where "for kids" is a floor, not a ceiling.

## Design pillars

1. **The map is real.** Every street, block, trail, pond, and bridge matches Newburyport — exact street network from OpenStreetMap, real building footprints, ~30 hand-crafted landmark sprites. Exactness lives in the street graph and the landmarks; charm lives in the pixel art.
2. **Kind by default.** No dying, no failing, no punishing timers. The "enemies" are seagulls after your fried clams, greenhead flies in July, and the incoming tide. (Cozy ≠ childish — A Short Hike and Sneaky Sasquatch are adult-beloved with zero fail states.)
3. **The town is the toybox.** Jobs, festivals, collectibles, and tools that open new geography. Progression = *more of Newburyport*.
4. **The weirdest stuff is the true stuff.** Quests grow out of documented history and real current life, lightly fictionalized. A "based on a true story" stamp on quest cards rewards curiosity.
5. **Two layers in everything.** Every joke, quest, and sign is written twice: once for the kid, once for the local. Kids chase the seagull; adults clock that the parking-enforcement NPC is the real villain of downtown. The writing never talks down, never explains the joke, never says "awesome sauce."

## The player

A Newburyport kid (customizable look), age ~10, with a dog companion option. Home base: your bedroom in a real house on a real block (player picks a neighborhood at start — South End, North End, Joppa, Belleville…). Sessions are 5–15 minutes; silent autosave; per-person profiles.

Playing *as* a kid doesn't make it a kids' game — Link is a kid; Earthbound's Ness is a kid. A kid protagonist is simply the best excuse to roam a small city on a bike asking everyone questions. The audience knob is tone, art, and depth — not the hero's age.

## Three gameplay layers

### 1. Everyday Port — the base loop (Sneaky Sasquatch DNA)
Deliveries and errands for NPC neighbors, jobs-as-minigames (scooping ice cream, hauling donuts on Inn Street, bagging penny candy, clamming at low tide), shops to spend sand dollars in, NPCs with daily schedules, and a real event calendar (below).

### 2. Port Mysteries — the quest spine (the Zelda part)
Chaptered story arcs anchored in true history. The **real sealed smugglers' tunnels under Market/State/Federal Streets are the game's dungeon network** — entrance found in a downtown cellar, expanding chapter by chapter. At marked landmarks the kid can slip into **"Echoes"** — short playable history episodes at the exact spot where they happened (the 1811 bucket brigade, launching the revenue cutter *Massachusetts*, the 1910 first flight at the airfield).

### 3. Wild Port — the nature layer (Alba DNA)
Binocular spotting log (eagles in winter at Maudslay, plovers in spring, whales offshore), Plover Patrol stewardship quests, fishing at the docks and surf, kayak exploration of the marsh creeks, beach cleanups that visibly heal the dunes.

## The Spine: one year in Newburyport (DECIDED 2026-06-12, seasons added same day)

**Structure: Zelda, not Mario.** The city stays a fully open overworld (the Everyday Port / Wild Port loops never lock), but the story is a **chaptered spine**: each chapter hooks in the open world, earns a **tool** that opens new geography, and climaxes in an authored set-piece — a **tunnel section** (our dungeons) or an **Echo** (playable history). Echoes are the "Mario levels": contained, authored, replayable with medals. Each chapter is also a shippable release with a cliffhanger.

**The chapters are one full year** (Devin, 2026-06-12: "sprinkle of all seasons… last level at Christmas"). The world's season advances with the spine — leaves turn, snow falls, porches decorate — so the calendar itself escalates toward the finale.

| Ch | Season | Title | Beat | Tool / set-piece |
|---|---|---|---|---|
| 0 | First day of summer | **Overdue** ✅ shipped | Gram's errand; Clipper finds the grate behind the Firehouse | Library card · the hook |
| 1 | High summer | The Door Under Downtown | First tunnel under the Firehouse; a smuggler's mark + torn map corner | **Lantern** · starter dungeon |
| 2 | Late summer — **Yankee Homecoming** | The Paper Route | Young-Garrison job arc during parade week | **Bike** — the mainland opens |
| 3 | September | The Low-Tide Door | A tunnel mouth only reachable from the water at low tide | **Kayak** + tide clock |
| 4 | **HALLOWEEN** | The Ghost Map | Fog night: jack-o-lanterns on the real porches, trick-or-treat on High Street, the 1679 **Morse poltergeist Echo** at Market Square (true story — the "ghost" was her grandson all along), mooncusser lanterns on the dunes | **Costume box** (NPCs react; the Sneaky-Sasquatch disguise verb) |
| 5 | Late fall | The Night of May 31, 1811 | The three real tunnels connect under Market Square — and the map leads into the **Great Fire Echo**: bucket brigade across the real downtown, no combat. The gut-punch. | Big dungeon + the fire |
| 6 | **CHRISTMAS** | Clipper City Christmas | Snow over everything, the big tree in Market Square, real houses and storefronts lit, **Santa arrives by Coast Guard boat** (real tradition). The final tunnel run under a snowed-in downtown resolves the mystery — and you surface *into the tree lighting*. | **The climax — every tool, then the lights** |

**Why Christmas is the finale (and the Fire is Ch 5):** the fire is the event that *made* the brick downtown; Christmas is the night the town is most itself — Newburyport does the season like a Hallmark set, and the game ends warm instead of on a catastrophe. The epilogue lands the arc in one image: **the town that burned down learned to light itself back up.** Kid layer: Christmas. Local layer: standing in Market Square at the tree lighting, understanding why every building around you is brick.

**Seasons beyond the spine:** after the finale (or anytime in freelance), a season-select lets you revisit the town in any dressing — and long-term, default free-roam can mirror the **real calendar** (play in December, it's snowing in game; the drawbridge already keeps real time). Spring belongs to the post-game: plovers return April 1, the Wild Port layer blooms.

**Freelance is guaranteed:** the spine is opt-in pace, not a gate. You can ignore Gram forever and just *live in the town* — jobs, collectibles, festivals, sledding. The objective pill collapses to a dot with a tap for exactly this. "Just running around Newburyport" is a first-class way to play, not a failure to progress.

## Tools & map gates (traversal progression)

| Tool | Earned by | Opens |
|---|---|---|
| Sneakers | start | Downtown core on foot |
| **Bike** | first job arc | The whole mainland at speed; rail-trail time trials |
| **Kayak** | harbor questline | The Basin, marsh creeks, the back side of Plum Island |
| **Binoculars** | Joppa Flats intro quest | Bird log; reading distant clues |
| **Metal detector** | beach mystery | Buried digs on Plum Island & Joppa Flats |
| **Fishing rod** | Surfland-style bait shop | Dock + surf fishing minigame |
| **Lantern & tunnel map** | Port Mysteries ch. 2 | The smugglers' tunnels under downtown |
| **Library card** | Newburyport Public Library | Unlocks "Echo" history episodes (the library IS the 1771 Tracy Mansion — Washington slept there) |
| **Sled** | first snowfall | March's Hill runs |

## The living calendar (mirrors the real one)

- **Summer:** Gillis drawbridge opens **on the hour and half-hour** — a real, city-wide clock mechanic that stops traffic and parades boats through. **Yankee Homecoming** week: parade down High Street, waterfront concerts, Kids Talent Show, fireworks finale. **Greenhead weeks** (late July): the marsh becomes a dodge-zone; wear light colors, pray for wind — exactly like real life.
- **Spring:** Plover nesting closes refuge beaches April 1 (Plover Patrol quests); Theater in the Open's giant puppets at Maudslay; Literary Festival; Spring Fest.
- **Fall:** Fall Harvest Festival; PlumFest porches; Clippers vs. Amesbury Thanksgiving football (5th-oldest rivalry in Massachusetts, since 1891).
- **Winter:** **Santa arrives by Coast Guard boat** → Market Square tree lighting; Frog Pond skating; March's Hill sledding; February **Eagle Festival** (Maudslay's real winter eagle roost).
- **Every Sunday:** farmers market at the Tannery — the weekly heartbeat (sell what you foraged/fished/crafted).

## Quest bank (samples — all anchored to real places & true stories)

**History-driven (Port Mysteries):**
1. **The Smugglers' Tunnels** — explore the real sealed brick tunnels under downtown (dungeon network).
2. **Lord Dexter's Missing Statues** — the 1815 gale scattered his 40 wooden statues; find them city-wide (the big collectible set) and restore the lawn at 201 High St.
3. **A Pickle for the Knowing Ones** — punctuation rescue minigame ("pepper and solt it as you plese").
4. **The Great Fire Bucket Brigade** — Echo episode, May 31, 1811: save the Wolfe Tavern sign, then rebuild downtown in brick.
5. **Launch the Massachusetts** — build the first revenue cutter; birthplace-of-the-Coast-Guard pride, anchored at the Custom House.
6. **Keeper of the Walking Lighthouse** — drag Plum Island Light on log rollers to chase the shifting channel; keep it lit through the 1839 storm.
7. **The Preacher's Stolen Arm** — return Whitefield's arm (in its little wooden box — true!) to the crypt under Old South's pulpit.
8. **The Market Square Poltergeist (1679)** — clear Grandma Morse, catch the real prankster (her grandson — historians agree!).
9. **Young Garrison's Paper Route** — deliver the Herald as 13-year-old apprentice William Lloyd Garrison; ends at his real Brown Square statue.
10. **The Mystery of Watt's Cellar** — dig for the lost 1630s fish cellar archaeologists never found near the Firehouse.
11. **First Flight of the Flying Fish** — 1910 hop-physics minigame at New England's oldest airfield.
12. **Race the Dreadnought / Bossy Gillis's Campaign / Silver Rush of 1874 / Benedict Arnold's Secret Fleet / Harry the Mooncusser** — chapter quests from the history dossier.

**Modern-life (Everyday Port / Wild Port):**
13. **Drawbridge Clock** — time deliveries around the hour/half-hour bridge openings.
14. **Plover Patrol** — rope nests, redirect beach walkers, escort chicks to the waterline.
15. **Seagull vs. Fried Clams** — boardwalk snack-defense chase.
16. **Inn Street Fountain** — pop-jet splash-dodging at the real 1975 fountain; playground hub.
17. **Whale Watch Wednesday** — spotting trip to Jeffreys Ledge aboard a Captain's-Lady-style boat.
18. **The Pink House Memory** — a gentle mystery: collect old photos of the beloved pink house in the marsh (demolished March 2025, memorial sign real as of April 2026) and help the town remember it. *(Handle with care — it's beloved and recent.)*
19. **Rail Trail Courier** — bike deliveries around the real 3.35-mile loop, past the real public art.
20. **Hellcat Bird Bingo / Clam Digger of Joppa / Sled Champion of March's Hill / Eagle Festival / Kayak with Seals** — seasonal Wild Port quests.

**Collectible systems:** Dexter's 40 statues · landmark passport stamps (~30) · NBPT stickers (shop reward currency) · clipper-ship trading cards · purple garnet sand vials · bird log (20 species v1) · silver spoons (Towle heritage).

## Tone: kid-friendly, never kiddish

The explicit direction: kids should love it, **and it should be fun for anyone from Newburyport.** How that shows up:

- **Dry Yankee humor, written up not down.** NPC voices drawn from real town archetypes: the harbormaster who's seen everything, the clammer with greenhead conspiracy theories, the South End vs. North End needling, the guy at the boat ramp who will not be rushed. Deadpan over zany.
- **Local deep cuts as a reward layer.** Joppa pronounced "JOP-pee." The rotary. Drawbridge-schedule grumbling. NBPT 01950 stickers. Thanksgiving vs. Amesbury trash talk (5th-oldest rivalry in the state). A "famous wrestler from West Newbury" who keeps getting spotted at the waterfront restaurant. None of it explained — locals just *get it*.
- **Grown-up Easter eggs.** A moody fog-rolled side quest that nods to Lovecraft modeling Innsmouth on 1920s Newburyport. Bossy Gillis-style political satire at City Hall. Dexter's unpunctuated book played straight. The "Once Known" graves at Old Hill handled with quiet respect.
- **Optional mastery for older players.** Story path is gentle; depth is opt-in: rail-trail and March's Hill time trials with medals, 100% hunts (all 40 statues, full bird log, every passport stamp), rare fish, trickier late-game tunnel puzzles, a photo mode built for "look, that's our street" screenshots.
- **Art & sound stay handsome, not babyish.** Detailed 16px pixel art (Stardew register, not preschool), New England light — fog banks, golden hour over the marsh, winter blue — and a real soundscape: gulls, halyards clinking, the foghorn, the drawbridge bell. UI is clean and small, not chunky toddler buttons.
- **The litmus test for every piece of content:** would a 35-year-old who grew up on Lime Street screenshot this and send it to the group chat? If not, sharpen it.

## The map (the #1 requirement)

- **Source of truth:** OpenStreetMap (city relation 2385554 — measured: 3,501 street ways, 7,503 building footprints, 1,234 sidewalk ways, ~77% of buildings with house numbers) + MassGIS public-domain parcels/footprints/LiDAR/15cm orthos.
- **Pipeline:** Geofabrik extract → osmium clip to the exact city polygon → Python preprocessor → 1m grid in EPSG:26986 → autotiled chunked tilemap (Tiled-compatible) + POI object layer → hand-edit patch layer → Phaser. Full detail in `docs/research/map-data.md` and `tech-stack.md`.
- **Exactness QA:** register against 20 anchor coordinates (Market Square, Plum Island Light, Chain Bridge…); verify High St ≈ 3.7 km, station→Market Square ≈ 1.62 km.
- **Scale:** 1 tile = 1 m, 16px art at 3× zoom. Downtown core ≈ 2,536 × 1,722 m. Full city ≈ 6.1 × 11.3 km with seamless chunk streaming (bridges/causeway = natural prefetch corridors).
- **Attribution (non-negotiable):** "Map data © OpenStreetMap contributors" + MassGIS credit in splash/credits.

## v1 scope — ship the spine chapter by chapter

Each chapter is a release. **Ch 0 "Overdue"** (in build, June 2026): dialogue + quest tracker + interact systems, Gram/donut/librarian NPCs, the grate beat — all on the existing 3D city. **Ch 1** adds the first tunnel interior (one contained scene: dark, lantern cone, brick) and the lantern. **Ch 2** adds the bike + the job framework. The open-world toybox (jobs, collectibles, passport stamps, Dexter statues, seagulls, drawbridge clock) grows alongside, never gated behind the spine.

## Tech (updated after the June 2026 prototype — see `docs/research/tech-stack.md` for the original research)

**Three.js + TypeScript + Vite**, wrapped with **Capacitor 8** for iOS/Android; web build for dev/demo/desktop. Rendering pivoted from 2D pixel tiles to a **tilted-camera 3D "model village"** (Devin's call: faster character, see more of the city, Subway-Surfers energy): the 2D painted map becomes the ground texture (street names painted on the pavement), real building footprints extrude into vertex-colored 3D blocks, trees are chunky low-poly, characters are blocky Crossy-Road-style (kid + dog). Chunk streaming with distance fog; collision baked from map geometry. **Zero data collection** as a policy (keeps COPPA trivially satisfied for the kids in the audience and is a selling point for parents); paid or demo+single-IAP, no ads ever.

**Store positioning:** list as a general-audience game (Apple 4+ / ESRB E), *not* in Apple's opt-in Kids Category — that category's browsing surface skews preschool and would ghetto-ize the game. The all-ages listing matches the "fun for anyone from Newburyport" goal while staying fully kid-safe in content and privacy.

## Decided

- **Audience (Devin, 2026-06-11):** kids should love it, but it must be fun for anyone from Newburyport — not overly kiddish. All-ages, local-first; see the Tone section. Store listing follows (general audience, not Kids Category).
- **Structure (Devin, 2026-06-12):** chaptered spine over an open city — "levels that lead to a huge climax, like an actual Mario or Zelda." Zelda model chosen (open overworld + tool-gated chapters + authored set-pieces). See "The Spine."
- **Seasons + finale (Devin, 2026-06-12):** the chapters span one real year; **Christmas is the finale** (tree in Market Square, lit houses, snow — "like a Hallmark movie"), **Halloween gets a featured chapter** (Devin's favorite; Newburyport does it exceptionally well), the Great Fire Echo moves to Ch 5. Free-roam ("freelance town") is explicitly guaranteed and never gated.
- **First mission (Devin, 2026-06-12):** Chapter 0 "Overdue" — Gram's errand (donuts + overdue book → library card), ends with Clipper finding the grate behind the Firehouse.

## Open questions (for Devin)

1. **Protagonist:** human kid (relatable, customizable) vs. animal mascot (e.g., a harbor seal pup or a Clipper-kid)? Current lean: human kid + dog (a kid hero keeps it charming without making it childish — see The Player).
2. **Real business names:** public landmarks (lighthouse, Custom House, parks, schools) are safe to depict. Private storefronts (Richdale, The Angry Donut, Jabberwocky…) need either permission (small-town owners often love it — also a marketing channel) or affectionate near-names ("The Grumpy Donut," "Jibberwocky Books"). Decide the policy early — it shapes NPC/quest writing.
3. **Title:** "NBPT Living" (working title) vs. alternatives ("Clipper City," "NBPT: Clipper City Adventures").
4. **Tone of recent/sensitive content:** Pink House (demolished 2025) and Underground Railroad content are both handled respectfully in the proposal — confirm comfort level.
5. **v1 slice:** agree/adjust "Market Square to the Lighthouse."
