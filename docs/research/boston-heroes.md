# Boston heroes — researched build specs

Working notes for `HEROES` in `src/three/decor.ts`. One entry per hand-modeled
building: what it actually looks like, sourced, so the model is built from
research rather than memory. Colors are the thing memory gets wrong — Salem's
Ropes Mansion shipped grey when it is white, and three Salem houses shipped the
wrong color until a photo audit caught them.

**Before adding any of these, run `TOWN=boston node tools/check_hero_names.mjs
"<exact OSM name>"`.** A hero is keyed by OSM name and renders on EVERY footprint
carrying it.

---

## Massachusetts State House — `"Massachusetts State House"`

Charles Bulfinch, completed January 1798; the masterpiece of American Federal
architecture and a National Historic Landmark.

- **Center block: RED BRICK.** Not painted, not grey. It was sandblasted in 1928
  specifically to restore the original red of the Bulfinch centerpiece.
- **The dome is gilded gold**, and it is the single most recognisable roofline in
  Massachusetts. History worth knowing for the sub-copy: originally grey
  shingles, then copper rolled at **Paul Revere's** foundry in Canton, first
  gilded 1874.
- **Topped by a gilded wooden pine cone** — for the lumber trade and for Maine,
  which was still part of the Commonwealth when Bulfinch finished.
- Tall white columns across the front, above an arcaded ground storey.
- Sits at the top of Beacon Hill on the **west edge of Boston Common**, looking
  down over it — the reason it reads from so far away in game.
- The later flanking wings are white marble, visually distinct from the red
  Bulfinch front. Model the red center + gold dome first; the wings are the
  supporting mass.

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Massachusetts_State_House) ·
[NPS](https://www.nps.gov/places/massachusetts-state-house.htm) ·
[SAH Archipedia](https://sah-archipedia.org/buildings/MA-01-BH2)

## Trinity Church, Copley Square — `"Trinity Church"`

H. H. Richardson, 1877. The birthplace and archetype of **Richardsonian
Romanesque** — this is the building that made Richardson's name.

- **Walls: fine-grained tannish-grey granite quarried in Dedham**, laid
  rock-faced (rough) in a random ashlar pattern. NOT smooth, NOT red.
- **Trim: dark red-brown brownstone**, framing every door and window and running
  as **horizontal stripes** across the walls. The polychrome contrast between the
  grey granite and the brown trim IS the style — get that and the building reads.
- **Central tower 211 ft (64 m)**, massive, modeled by Stanford White (then in
  Richardson's office) on the Romanesque tower of the Old Cathedral of Salamanca.
- Plan is a **modified Greek cross** — four arms off the central tower.
- Clay tile roof; heavy round arches throughout.
- A **chevron / zig-zag band** of brownstone and granite below the cornice, over
  a five-arch arcade.
- ⚠️ `brickTex` MULTIPLIES red (documented trap) — use the PLAIN bucket for the
  granite, as Charlestown's monument does, or the walls will come out pink.

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Trinity_Church_(Boston)) ·
[SAH Archipedia](https://sah-archipedia.org/buildings/MA-01-BB37) ·
[Trinity Church](https://trinitychurchboston.org/free-exterior-audio-tour/)

## Faneuil Hall — `"Faneuil Hall"`

Smibert 1742; **Bulfinch expansion 1805-06** is what you see today.

- **Red brick**, four storeys including the attic, divided vertically into bays.
- Arched sash windows; ground-floor entrances. **Pilasters of varying designs**
  separate the bays on every storey — Bulfinch decorated the third storey with
  pilasters and entablatures to match the ones below.
- **Slate GABLE roof** (not hip) with the cupola at the **EAST end** — Bulfinch
  moved it there when he doubled the building's north-south width and rebuilt the
  roof. Getting the cupola off-center to the east is the detail that makes it
  read as Faneuil Hall and not a generic brick hall.
- The cupola's upper part is a **belfry** (bell dates from 1867), domed on top.
- **The grasshopper weathervane**: gilded, atop the belfry dome. Shem Drowne,
  1742, copper under gold plate, 25 lb. It is the ONLY part of the building
  totally unmodified from the 1742 original — worth a line of sub-copy, and worth
  modeling even though it is tiny.
- Bulfinch enclosed the original open ground-floor arcades.

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Faneuil_Hall) ·
[NPS](https://www.nps.gov/bost/learn/historyculture/fh.htm) ·
[SAH Archipedia](https://sah-archipedia.org/buildings/MA-01-GC4)

## Fenway Park — `"Fenway Park"`

⚠️ Only reachable at all because of the `leisure=stadium` fix above — it is a
multipolygon relation with no `building` tag.

- **The Green Monster: 37 ft 2 in (11.33 m)** left-field wall, 310 ft from home
  plate down the line. The tallest wall in MLB. It is the whole point — a Fenway
  model without a correctly-tall left-field wall is not Fenway.
- **Color: Dartmouth Green.** Not painted green until **1947** (before that it
  carried advertisements). The park took its present basic appearance, color and
  layout by Opening Day **1934**.
- **Manual scoreboard set INTO the wall**, in some form since ~1914, still
  updated by hand during the game.
- Wall is wood originally (1912), covered in tin and concrete 1934, hard plastic
  1976 — so render it as a smooth flat plane, not masonry.
- Outer shell is brick along Jersey/Lansdowne; the light towers on the roof are
  part of the silhouette.

Sources: [Green Monster](https://en.wikipedia.org/wiki/Green_Monster) ·
[Fenway Park](https://en.wikipedia.org/wiki/Fenway_Park) ·
[Red Sox facts & figures](https://www.mlb.com/redsox/ballpark/facts-figures)

## Old North Church — `"Old North Church"`

Christ Church, first service 29 Dec 1723; building finished 1726. Boston's
oldest surviving church building, and the one the lanterns hung in.

- **Georgian**, influenced by Christopher Wren's London churches. Rectangular
  nave, **tower to the WEST**, semicircular apse to the EAST — the tower end is
  the one facing you from Salem Street.
- **Brick tower** carrying a **white wooden spire**. Note for the model: for its
  first 17 years (1723-1740) there was NO spire — the brick tower stood bare.
  The white spire is the later, and now definitive, silhouette.
- **191 ft (58 m) tall** overall. That is the number to build to; it should read
  from across the harbor in Charlestown, exactly as it historically did.
- **Belfry with eight change-ringing bells cast in 1744 — the oldest in North
  America.** Good sub-copy.
- Topped by a **golden weathervane by Shem Drowne** — the same hand as Faneuil
  Hall's grasshopper, which is a lovely connection to put in the sub-line.
- Third steeple (1955) is what stands now; the second collapsed.

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Old_North_Church) ·
[Old North](https://oldnorth.com/steeple-bell-chamber/) ·
[NPS](https://www.nps.gov/bost/learn/historyculture/onc.htm)

## Old State House — `"Old State House"`

Completed **1713** — the **oldest surviving public building in Boston**, and the
oldest extant public building of Georgian design in the United States. Replaced
the timber First Town House that burned in 1711.

- **Three storeys, brick**, Georgian.
- **The lion and the unicorn** on the east gable — the single identifying
  feature. Gilded lion (England) and white unicorn (Scotland). If the model has
  those two figures on the gable end it is unmistakable.
- **The balcony** on the east end: the Declaration of Independence was read to
  Boston from it on 18 July 1776, and it still is every year. Model the balcony.
- Tower and cupola rise from the west end, stepping up from the roof.
- Color: the 1909-10 Chandler restoration established the conventional **"red
  and white work"** of Queen Anne / early Georgian — red brick with white trim.
- It now sits marooned in the middle of the Financial District with towers all
  around it, which is the shot worth framing.

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Old_State_House_(Boston)) ·
[Revolutionary Spaces](https://revolutionaryspaces.org/discover/old-state-house/) ·
[SAH Archipedia](https://sah-archipedia.org/buildings/MA-01-GC9)

## Custom House Tower — `"Custom House Tower"`

Two buildings in one, and the model has to show the seam — that IS the building.

- **Base: a cruciform GREEK REVIVAL temple** (Ammi Young, 1837-47) — a
  four-faced Greek Doric temple topped by a Roman dome, with **36 fluted Doric
  columns, each carved from a SINGLE piece of Quincy granite**.
- **Tower: 496 ft (151 m)**, Peabody and Stearns, driven straight down through
  the middle of that temple in 1913-15 on caissons to bedrock. Opened 23 Jan
  1915. **Boston's tallest building from 1915 to 1964**, and among the first
  skyscrapers outside New York.
- So the silhouette is: a squat colonnaded granite temple with a slim granite
  tower erupting from its center. Build it in that order.
- **Clock: 22 ft (6.7 m) across**, one on each of the four faces near the top.
  Hands are gold-leafed California redwood, 101 and 141 lb.
- Stepped/pyramidal crown above the clock stage.
- All granite — ⚠️ use the PLAIN bucket, not `brickTex` (which multiplies red).

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Custom_House_Tower) ·
[SAH Archipedia](https://sah-archipedia.org/buildings/MA-01-WF17)

## The Citgo Sign — Kenmore Square (OSM: `"Citgo Sign"` / `"Citgo"`)

Not a building — a **sign on a roof**, and one of the most-loved objects in the
city. It is the thing you see over the Green Monster on every televised game.

- **60 ft x 60 ft**, held **40 ft above the roof** of **660 Beacon Street** by a
  steel truss; the steel framework is about **90 ft tall** overall.
- Two back-to-back faces. Each: **white background**, a **41 ft equilateral
  triangle** standing a few feet proud of the surface as a shallow pyramid, in
  **three shades of red**, with **blue sans-serif "CITGO" letters 11 ft high**
  below the triangle.
- Raised over Kenmore Square in **1965**; LED since a 2005 restoration; the
  lights go off at midnight.
- Model note: this wants a small dedicated builder (truss + double-sided panel),
  not a building hero — it should sit ON 660 Beacon, and it should glow at night
  like the town's other lit set pieces.

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Boston_Citgo_sign) ·
[Boston Preservation Alliance](https://www.bostonpreservation.org/advocacy-project/citgo-sign)

## Quincy Market — `"Quincy Market"`

Alexander Parris, opened 26 Aug 1826. Right beside Faneuil Hall, so it shares
the spawn view — this one has to be right on day one.

- **Central building: a 535 ft x 50 ft granite rectangle**, laid out west-east.
  Very long and very narrow — that proportion is the whole silhouette.
- **Greek Revival**, with a **domed rotunda in the MIDDLE** and **monumental
  porticos at BOTH ends** (west and east).
- **Granite columns carved in one piece**, and delivered without any
  steam-powered equipment — worth a sub-copy line.
- It is three buildings, not one: the central hall plus the North and South
  Market buildings flanking it. Model the center first.
- Granite again — PLAIN bucket, not `brickTex`.

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Quincy_Market) ·
[SAH Archipedia](https://sah-archipedia.org/buildings/MA-01-GC5)

## Boston Public Library, McKim Building — `"Boston Public Library"`

⚠️ **Name collision risk is high** — the BPL has ~25 branch libraries all over
the city and several may carry a similar name. RUN `check_hero_names.mjs` FIRST
and use `nameFixes` if needed.

Charles Follen McKim, completed 1895. "The first outstanding example of
Renaissance Beaux-Arts academicism in America" (NPS).

- **Renaissance Revival / Beaux-Arts**, modeled on the **Bibliothèque
  Sainte-Geneviève** in Paris.
- **Milford granite** facade, articulated with strong **horizontal** belt
  courses, friezes and cornices.
- **Wider than it is tall** — a long, low, monumental block. Do not build it
  tall.
- **A row of large ARCHED windows across the second storey** is the signature —
  that arcade plus the horizontal banding is the building.
- Sits on a **granite plinth three steps above Copley Square**, on three sides,
  with three more steps up at the Dartmouth Street entrance.
- **Triple-arched entrance** flanked by Bela Pratt's bronze Science and Art
  figures, with wrought-iron lanterns.
- Faces Trinity Church across Copley Square — build them as a pair; the
  contrast between Richardson's rough polychrome pile and McKim's smooth pale
  horizontal block IS Copley Square.

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Boston_Central_Library) ·
[BPL](https://www.bpl.org/art-architecture/) ·
[SAH Archipedia](https://sah-archipedia.org/buildings/MA-01-BB42)

## Boston Light — `"Boston Light"`, Little Brewster Island

The reason the frame's east edge reaches to -70.88. Reachable only by kayak or
by air, which makes finding it a genuine event.

- **First lit 1716 — the FIRST lighthouse built in what is now the United
  States.** Second-oldest working light in the country (after Sandy Hook).
- **89 ft tall**, built of **rough-cut stone**, whitewashed white tower.
- The last lighthouse in America to be **actively staffed by the Coast Guard**,
  even after its 1998 automation; staffing ended with Dr. Sally Snowman's
  retirement in 2023. That is a wonderful sub-copy line for a kid: *"the last
  lighthouse in America to have a keeper."*
- The existing `lighthouse()` builder already handles the generic case and the
  three North Shore lights are named heroes — check whether the generic builder
  at 89 ft on a bare island is good enough before writing a bespoke one.

Sources: [Wikipedia](https://en.wikipedia.org/wiki/Boston_Light) ·
[NPS](https://www.nps.gov/boha/learn/historyculture/boston-light.htm) ·
[USCG](https://www.history.uscg.mil/Browse-by-Topic/Assets/Land/All/Article/1899619/boston-light/)

## Paul Revere House — `"Paul Revere House"`

- **Built c. 1680** — **downtown Boston's OLDEST building**, and one of very few
  17th-century dwellings left in any large American city. 19 North Square.
- **Two storeys with a gabled garret**, over a cellar.
- **Clapboard** cladding, **second-floor OVERHANG (jetty)**, and **casement**
  windows (leaded, small panes — NOT sash). The overhang plus casements is the
  whole First Period signature.
- The North End's **only surviving wooden dwelling** from that era — the rest
  burned. Worth saying in the sub-copy.
- **Reuse `firstPeriod()`** — this is exactly the builder Salem's First Period
  houses use, and the memory notes it already does both-face windows and lights.
  Do not write a new builder.

Sources: [Paul Revere House](https://www.paulreverehouse.org/paul-revere-house/) ·
[Wikipedia](https://en.wikipedia.org/wiki/Paul_Revere_House) ·
[NPS](https://www.nps.gov/bost/learn/historyculture/prh.htm)

## The modern skyline — 200 Clarendon and the Prudential

These two ARE Boston's skyline from every distance, and they are the reason the
city needs a **skyscraper builder** the North Shore towns never did. Both should
read correctly from Charlestown, from the harbor, and from the air.

**200 Clarendon (John Hancock Tower)** — `"200 Clarendon"` / `"John Hancock Tower"`
- **60 storeys, 790 ft (240 m)** — still the **tallest building in New England**.
- Henry N. Cobb of I. M. Pei & Partners, completed **1976**.
- **Signature blue reflective glass**, a minimal glass skin with no expressed
  structure — it is a mirror, and it should reflect the sky/season tint.
- **Plan is a RHOMBOID (parallelogram), not a rectangle**, and it is very thin.
  Getting the slender rhomboid footprint and the mirrored blue is the entire
  building; a grey box at 790 ft would be worse than nothing.
- ⚠️ It was renamed to its address in 2015 when the Hancock lease expired, so
  OSM may carry either name — `check_hero_names.mjs` both.

**Prudential Tower** — `"Prudential Tower"`
- **52 storeys, 749 ft (228 m)**, completed **1964**. Boston's 2nd-tallest.
- Much blockier than the Hancock — a broad rectangular slab with vertical
  banding, sitting on the Prudential Center podium.
- The pair reads as: thin blue mirror + fat pale slab. Silhouette contrast is
  what sells them.

Sources: [John Hancock Tower](https://en.wikipedia.org/wiki/John_Hancock_Tower) ·
[Prudential Tower](https://en.wikipedia.org/wiki/Prudential_Tower) ·
[SAH Archipedia](https://sah-archipedia.org/buildings/MA-01-BB38)

---

## Still to research

Faneuil Hall (grasshopper vane, cupola) · Quincy Market (granite, dome rotunda) ·
Old North Church (white steeple) · Old State House (lion & unicorn) · Paul Revere
House (1680 wood) · Boston Public Library McKim · Fenway Park (Green Monster) ·
Custom House Tower · Park Street Church · Kings Chapel · Old South Meeting Place ·
The Mother Church, Christian Science · Symphony Hall · Museum of Fine Arts ·
Isabella Stewart Gardner · Hancock Tower (blue glass rhomboid) · Prudential ·
the **Citgo Sign** · Fort Independence · Fort Warren · **Boston Light** ·
Bunker Hill Monument + USS Constitution (already built for Charlestown — they are
in Boston's frame too and should just work).
