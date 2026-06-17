# Newburyport Geography & Exact-Map Data Pipeline

*Researched 2026-06-11 for NBPT Living. Coordinates are WGS84 decimal degrees. OSM counts pulled live via Overpass on this date.*

---

# PART A — PHYSICAL GEOGRAPHY & STREET NETWORK

## A1. City layout & street grid

**Frame:** Newburyport occupies the elevated south bank of the Merrimack River. Total area **10.71 sq mi (8.35 land / 2.36 water)**, centered at **42°48′45″N 70°52′40″W**. Borders: **Amesbury** N/NW (across the river), **Salisbury** NE (across the river), **Atlantic Ocean** E, **Newbury** S/SE, **West Newbury** W/SW. The river flows roughly WNW→ESE past downtown, so the grid's long axis runs NW–SE.

**Grid structure (verified against OSM geometry):** A dense, ladder-like colonial grid climbs from the waterfront to a low ridge paralleling the river. Three topographic "rails": **Merrimac/Water St** at the waterfront, **High St** at the ridge crest, **Low St** along the inland marsh margin. Between Merrimac/Water and High run intermediate parallels (Middle, Washington, Prospect, Milk Streets), crossed by short perpendicular "rungs" climbing the bank. The National Register **Newburyport Historic District** is roughly bounded by the river, **Marlboro St** (SE), **Ashland St** (NW), and **High St** (SW).

**Arteries — roles and exact endpoints (from OSM):**

| Street | Role | Endpoints (lat,lon) | Extent |
|---|---|---|---|
| **High St (MA 1A; NW stretch w/ MA 113)** | Grand mansion spine on the ridge; Federal estates, Bartlet Mall, March's Hill, Atkinson Common | SE end at Marlboro/Newbury line 42.80145,-70.86304 → NW end at Storey Ave ("Three Roads") 42.82298,-70.89800 | ~3.7 km |
| **State St** | Main commercial street: Market Square uphill across High, continuing SW to the US-1 circle; lower blocks 3-story brick | Market Sq 42.81125,-70.86962 → US-1 circle 42.79927,-70.87532 | ~1.4 km |
| **Pleasant St** | Downtown secondary; City Hall (60 Pleasant) | 42.80984,-70.87032 → 42.81188,-70.87551 | ~0.5 km |
| **Merrimac St** | North End riverfront artery, Market Sq → Spofford St near Chain Bridge | 42.81148,-70.86995 → 42.83141,-70.90652 | ~3.7 km |
| **Water St** | Waterfront SE out of Market Sq through Joppa; becomes Plum Island Turnpike at Ocean Ave/Newbury line | 42.81167,-70.86924 → 42.80019,-70.84973 | ~2.1 km |
| **Low St** | Inland parallel along the marsh edge | Pond St 42.80667,-70.87834 → 42.81991,-70.90948 | ~2.9 km |
| **Storey Ave (MA 113)** | Modern commercial strip; the city's I-95 interchange | I-95 42.81389,-70.93129 → High St 42.82298,-70.89800 | ~2.9 km |
| **Pond St** | Skirts Bartlet Mall, links High to Low | High 42.80747,-70.87219 → Low 42.80667,-70.87834 | ~0.5 km |
| **Green St** | Downtown rung | 42.80836,-70.87387 → 42.81193,-70.87205 | ~0.4 km |
| **Federal St** | South End rung (Old South Church) | High 42.80502,-70.86815 → Water 42.81030,-70.86509 | ~0.6 km |
| **Lime St** | South End/Joppa rung | High 42.80398,-70.86640 → Water 42.80938,-70.86327 | ~0.65 km |
| **Marlboro St** | SE edge of the historic district | High 42.80145,-70.86304 → Water 42.80515,-70.85612 | ~0.7 km |
| **Bromfield St** | South End rung | High 42.80285,-70.86371 → Water 42.80804,-70.86085 | ~0.6 km |
| **Olive St** | North End rung | High 42.81101,-70.88044 → Merrimac 42.81426,-70.87745 | ~0.45 km |
| **Plum Island Turnpike** | Causeway to the island (1806 turnpike); passes airport and Pink House site | Water/Ocean Ave 42.80019,-70.84973 → Wilkinson drawbridge 42.79741,-70.82367 | ~2.2 km |
| **Scotland Rd** | SW rural artery toward Newbury/I-95; crosses Common Pasture | from Low St/Graf Rd area SW | — |
| **Hale St** | E–W connector, Low St corridor → Artichoke/Turkey Hill area | 42.80929,-70.89041 → 42.80167,-70.92305 | ~2.8 km |
| **Parker St** | Southern E–W road; industrial park gateway; meets US 1 near the station | Scotland Rd 42.79431,-70.89082 → 42.79764,-70.86151 | ~2.5 km |
| **US 1 (Newburyport Turnpike)** | N–S spine: Gillis drawbridge → crosses Merrimac & High → traffic circle (State/Parker/US1) → Newbury | bridge 42.8154 → circle ~42.7995,-70.8755 | ~2 km |

## A2. Neighborhoods & districts

- **Downtown:** Market Square + State St + Inn St pedestrian mall + waterfront (Market Landing Park).
- **South End:** between downtown and the Newbury line (High↔Water, Federal/Lime/Marlboro/Bromfield rungs); oldest dense fabric; contains South End HD, Fruit St HD, Joppa HD.
- **Joppa:** the SE waterfront strip along Water St facing **Joppa Flats**; historic fishing/clamming village; Joppa Park at 42.80697,-70.85872. (Earlier "JOP-pee" pronunciation note was wrong per Devin — removed.)
- **North End:** NW of downtown along Merrimac St toward the bridges; more residential.
- **Belleville:** the NW section around upper High St / Storey Ave / Moseley Ave near Atkinson Common (boundary informal).
- **Industrial Park (off Parker St):** "Lord Timothy Dexter Industrial Green" (plaque at Graf Rd & Parker St); streets: Graf Rd, Malcolm Hoyt Dr, Opportunity Way; between the MBTA line and the Common Pasture.
- **Common Pasture:** large historic open meadow land south/southwest of the urban core; the **Little River** threads through it; crossed by Scotland Rd and Hale St; substantial conserved acreage.
- **Plum Island — exact municipal split (measured from OSM boundary relation 2385554):** the Newburyport/Newbury line crosses the island on a NE–SW diagonal at **ocean-beach point 42.81171,-70.80815 → basin-side point 42.81126,-70.80906** (≈ lat 42.8115), i.e., **between roughly 53rd and 57th Streets**. **North** of the line = **Newburyport**: Plum Island Point, Reservation Terrace, the **lighthouse (42.8152)**, upper Northern Blvd (~57th–84th). **South** = **Newbury**: Plum Island Center (Plum Island Blvd at the beach, ~42.8045), Annapolis Way, Fordham Way, Sunset Dr, and the refuge. The **Wilkinson drawbridge, the causeway's eastern end, Plum Island Airport (42.79616,-70.84156), and the Pink House site are all on the Newbury side.** (The whole island is ~11 mi long across 4 towns; only the developed north village is Newburyport/Newbury.)
- **Ring's Island:** across the Merrimack at the north foot of the Gillis Bridge — historic fishing village, part of **Salisbury**.

## A3. Water & green spaces

- **Merrimack River & harbor:** harbor fronts downtown; moorings off Cashman Park and the waterfront; **Joppa Flats** (tidal) east of downtown; jettied river mouth at Plum Island Point (notoriously dangerous bar).
- **Plum Island River & the Basin:** tidal river separates island from mainland (Wilkinson drawbridge); **the Basin** is the sheltered anchorage behind the island's north end — lies wholly within Newburyport and Newbury.
- **Little River:** small stream through the Common Pasture (Parker River watershed).
- **Artichoke River/Reservoirs (west edge):** city water supply chain Indian Hill Reservoir → Upper/Lower Artichoke → treatment plant; the Artichoke meets the Merrimack near Curzon Mill/Chain Bridge.
- **Frog Pond / Bartlet Mall:** 42.80812,-70.87475 — kettle pond + promenade, Superior Courthouse on its rim.
- **Atkinson Common:** 42.82518,-70.89703 (est. 1893–94, "Three Roads").
- **Maudslay State Park:** centroid 42.82695,-70.92626; main parking off Curzon Mill Rd at 42.82148,-70.92627.
- **Moseley Woods:** 42.83092,-70.91050 (Spofford St, near Chain Bridge).
- **Cashman Park:** 42.81651,-70.87810. **Joppa Park:** 42.80697,-70.85872.
- **March's Hill:** 42.80133,-70.86646 (water tower at 42.80110,-70.86861).
- **Burying grounds:** Old Hill 42.80748,-70.87651; St. Mary's 42.82220,-70.90872; Oak Hill 42.80151,-70.87119 (1842 garden cemetery).
- **Common Pasture/Little River trails:** access off Scotland Rd (Wet Meadows) and Hale St/Crow Lane edges (verify trailheads against MassGIS OpenSpace layer in pipeline).

## A4. Bridges & connections

| Crossing | Facts |
|---|---|
| **Gillis Memorial Bridge (US 1)** | 899-ft **drawbridge**, built 1976, Newburyport↔Salisbury. Movable span at **42.81540,-70.87346**. Resumed full draw operations June 2026 after repairs. Summer: opens on signal on the hour/half-hour. |
| **Chain Bridge** | **42.83370,-70.90674**; 225-ft suspension span (current 1910, replica of the 1810 chain bridge — first chain suspension bridge in America). Crosses the south channel to **Deer Island**. A bridge has stood here since 1792/93 — oldest continuously bridged long span site in the US. |
| **Hines Memorial Bridge** | Deer Island↔**Amesbury** over the north channel; pairs with Chain Bridge. |
| **Whittier Bridge (I-95)** | Twin network-arch spans (2013–2017 rebuild) with a shared-use bike/ped path (**Garrison Trail**). |
| **Sgt. Donald A. Wilkinson Bridge** | Plum Island Turnpike over the Plum Island River, **42.79779,-70.82149**; the island's sole vehicle access. |
| **I-95** | Up the city's west side; in-city interchange at MA 113/Storey Ave; Park & Ride at 42.8192,-70.9139. |
| **MBTA** | Newburyport/Rockport Line terminus at **25 Boston Way (42.79815,-70.87815)**; current station opened 1998. |
| **Clipper City Rail Trail** | **3.35-mi loop, completed 2024.** Phase 1 (2010): 1.1 mi, MBTA station → riverfront. Phase 2: the old "City Branch" — waterfront (Harborwalk section) → South End under High St toward Parker St. Plus "Gillis Bridge Connector" cycleways (~42.814–42.817). |
| **Harborwalk** | Riverfront path linking Cashman Park → Market Landing Park → Custom House along the harbor. |

## A5. Anchor coordinates (game registration points)

| # | Landmark | Lat | Lon |
|---|---|---|---|
| 1 | Market Square | 42.81135 | -70.86976 |
| 2 | City Hall, 60 Pleasant St | 42.81123 | -70.87276 |
| 3 | Superior Courthouse (Bartlet Mall) | 42.80814 | -70.87399 |
| 4 | Frog Pond / Bartlet Mall | 42.80812 | -70.87475 |
| 5 | Custom House Maritime Museum, 25 Water St | 42.81197 | -70.86824 |
| 6 | Cushing House, 98 High St | 42.80667 | -70.87111 |
| 7 | Inn Street pedestrian mall | 42.81072 | -70.87051 |
| 8 | Market Landing Park boardwalk | 42.81240 | -70.86973 |
| 9 | MBTA Newburyport station | 42.79815 | -70.87815 |
| 10 | Atkinson Common | 42.82518 | -70.89703 |
| 11 | Maudslay entrance (Curzon Mill Rd) | 42.82148 | -70.92627 |
| 12 | Cashman Park | 42.81651 | -70.87810 |
| 13 | Plum Island Light | 42.81523 | -70.81894 |
| 14 | Parker River NWR island gate (Sunset Dr, Newbury) | 42.79081 | -70.80997 |
| 15 | Pink House site (demolished 2025-03-11) | 42.79631 | -70.83019 |
| 16 | Chain Bridge | 42.83370 | -70.90674 |
| 17 | Gillis Bridge draw span | 42.81540 | -70.87346 |
| 18 | Wilkinson Bridge | 42.79779 | -70.82149 |
| 19 | Old Hill Burying Ground | 42.80748 | -70.87651 |
| 20 | Plum Island Airport (2B2) | 42.79616 | -70.84156 |

**Bounding boxes:**
- Official OSM city-relation bbox (incl. offshore): S **42.7874704**, W **-70.9402949**, N **42.8416465**, E **-70.7353408** (relation 2385554).
- Land-focused incl. Newburyport's Plum Island tip: S 42.787, W -70.941, N 42.842, E -70.803.
- Sanity distances: MBTA station→Market Square ≈ **1.62 km**; High St full run ≈ 3.7 km.

---

# PART B — MAP DATA SOURCES & PIPELINE

## B1. OpenStreetMap coverage & extraction

**Coverage — measured live 2026-06-11 via Overpass (area id 3602385554):**

| Feature class | Count (ways) |
|---|---|
| `highway=*` | **3,501** |
| `building=*` | **7,503** |
| `highway=footway` (sidewalks/paths) | **1,234** |
| `highway=path` | 213 |
| `leisure=*` | 280 |
| `natural=*` | 774 |
| ways with `addr:housenumber` | **5,780** |

**Interpretation:** OSM Newburyport is effectively complete for game purposes. Massachusetts had a statewide MassGIS building-footprint import (2013) plus state road/open space/hydro/boundary/MBTA/bike imports, and Newburyport is actively maintained (sidewalk density is exceptional; ~77% of buildings carry house numbers). Streets, footprints, parks, trails (rail trail, Maudslay, refuge boardwalks), piers, and the rail line are all present.

**Extraction options:**

1. **Overpass API by admin boundary** (tested working). Newburyport = relation **2385554** → Overpass area id **3602385554**:
```
[out:json][timeout:120];
area(id:3602385554)->.a;
(
  way["highway"](area.a);
  way["building"](area.a);
  way["natural"](area.a);
  way["leisure"](area.a);
  way["landuse"](area.a);
  way["waterway"](area.a);
  way["railway"](area.a);
  node["amenity"](area.a);
  node["shop"](area.a);
  node["historic"](area.a);
);
out body geom;
```
Run at https://overpass-turbo.eu (Export → GeoJSON) or `curl --data-urlencode 'data=…' https://overpass-api.de/api/interpreter`. **Caveat:** public endpoints rate-limit and 504 under load — for production builds use the Geofabrik extract, not live Overpass.
2. **Geofabrik extract:** https://download.geofabrik.de/north-america/us/massachusetts.html → `massachusetts-latest.osm.pbf` (**293 MB**, updated daily; ODbL).
3. **Bbox to clip:** `-70.9403,42.7875,-70.7353,42.8417` (full official) or land-focused `-70.941,42.787,-70.803,42.842`. Exact city polygon: `https://polygons.openstreetmap.fr/get_poly.py?id=2385554&params=0`.

## B2. MassGIS open data (native CRS: **EPSG:26986**, NAD83 Mass State Plane Mainland, meters)

| Layer | Details |
|---|---|
| **Building Structures (2-D)** | Statewide footprints (shapefile 349 MB); LiDAR-derived, updated to 2021 imagery (Sept 2022) + ongoing edits. Cross-check/supplement OSM footprints. |
| **L3 Standardized Parcels** | Assessor parcels + database for all 351 municipalities; per-town downloads ("Newburyport"). Lot lines + land use + addresses — gold for placing NPC homes/businesses. |
| **Orthoimagery** | 2023 statewide **15 cm** 4-band GeoTIFFs + tile/WMS service. Perfect for hand-tracing game art. |
| **LiDAR / DEM** | QL1 LiDAR (2021) for eastern MA; legacy 1 m DEM + shaded relief. Use for High St ridge, March's Hill, dunes. |
| **Protected & Recreational OpenSpace** | All conservation/park parcels (Maudslay, Common Pasture, Moseley Woods…). |
| **MassGIS–MassDOT Roads** | Centerlines with functional class, ownership, lanes, traffic — drives road widths/classes in-game. |
| **Data Hub** | https://gis.data.mass.gov (mass.gov pages block scripted fetches; download via the Hub or a browser). |

**Licensing:** MassGIS data are **public domain** — "can be used by anyone for any purpose"; commercial use fine; attribution requested, not required (credit "MassGIS (Bureau of Geographic Information), Commonwealth of Massachusetts, EOTSS").

## B3. Conversion tools & prior art

**Core converters:**
- **Overpass Turbo** — prototype queries, export GeoJSON.
- **osmtogeojson** (npm) / **osm2geojson** (Python) — Overpass JSON → GeoJSON.
- **osmium-tool** — `osmium extract` (clip pbf by poly/bbox), `osmium export` (pbf → GeoJSON). Fastest path.
- **GDAL/ogr2ogr** — reads .osm.pbf natively; reprojection and clipping.
- **osmnx** (Python) — street network as a graph (routing/NPC traffic AI).
- **QGIS + QuickOSM** — visual QA; load MassGIS shapefiles alongside.
- **tilemaker** — pbf → vector tiles (.mbtiles/.pmtiles), Lua-configurable, can merge GeoJSON side-inputs.

**OSM→playable-world prior art (GitHub):**
- **a-b-street/abstreet** — production open-source game (traffic sim) built on OSM; its importer is the best reference implementation.
- **a-b-street/osm2streets** — extracted library: OSM → lane/intersection polygons; JS API renders GeoJSON.
- **reinterpretcat/utymap** — procedural OSM world gen for Unity (archived but instructive).
- **RodZill4/godot-openstreetmap**, **Frataj/3D-OSM-GODOT** — Godot OSM renderers (tile-loading patterns).
- **NIMBY Rails** — whole-planet OSM in a commercial game; lesson: preprocess offline into your own binary format, never parse OSM at runtime.
- **No production-grade OSM→Tiled(.tmx) converter exists** — every successful real-map game wrote a custom importer (~1–2k LOC). Plan for that.

## B4. Projection & game coordinate system

**Recommendation: work in meters.**
1. **EPSG:26986** (NAD83 / Mass Mainland State Plane) — MassGIS-native, zero reprojection for state layers, lowest in-state distortion. *Best choice.*
2. EPSG:26919 / 32619 (UTM 19N) — more universal tooling. NAD83↔WGS84 ≈ 1–2 m — irrelevant at game scale.

**Local equirectangular approximation** at φ = 42.81°N (trivially invertible math):
- 1° latitude = **111,089.0 m**; 1° longitude = **81,791.7 m** (cos 42.81° = 0.7336)
- Origin at Market Square (42.81135, −70.86976): `x_m = (lon + 70.86976) × 81791.7`, `y_m = (lat − 42.81135) × 111089.0`
- Error: ≤0.09% E–W scale drift across the city (<10 m at far edges) — fine for a game.

**Playable-area sizes:**

| Scope | Bbox (S,W → N,E) | Size (N-S × E-W) |
|---|---|---|
| Downtown core (rotary↔river, Mall↔Joppa edge) | 42.8025,-70.8870 → 42.8180,-70.8560 | **1,722 × 2,536 m** |
| Downtown + MBTA + Joppa | 42.7960,-70.8900 → 42.8180,-70.8500 | **2,444 × 3,272 m** |
| Full city land incl. Plum Island tip | 42.787,-70.941 → 42.842,-70.803 | **6,110 × 11,287 m** |
| Plum Island village (Newburyport part) | 42.8113,-70.8210 → 42.8240,-70.8020 | 1,411 × 1,554 m |

At 1 px = 1 m the downtown core is a 2536×1722 texture; at 16-px tiles = 1 m/tile that's a comfortable 2D world.

## B5. Licensing

**OSM (ODbL 1.0):**
- **Attribution mandatory:** "© OpenStreetMap contributors" on a splash screen, in-game view, credits, or menu — legible, with a link to openstreetmap.org/copyright (or license info in a menu).
- **Produced Work vs derivative database:** the rendered/stylized game map is a **Produced Work** → no share-alike on art/code/game. The **extracted/modified geodata** (our Newburyport GeoJSON with edits) is a **Derivative Database** → if publicly used, must be made available on request. Practical compliance: publish the map-build pipeline output (or the generator repo).
- Mixing: public-domain MassGIS can be merged freely; a combined OSM+MassGIS database falls under ODbL — keep MassGIS-only layers separate if you want them unencumbered.

**MassGIS:** public domain; commercial use unrestricted; attribution appreciated.

---

## RECOMMENDED PIPELINE (raw data → game-ready world)

```bash
# 0. Tools
brew install osmium-tool gdal tilemaker        # QGIS optional for visual QA

# 1. Get the data (daily-updated, ODbL)
curl -O https://download.geofabrik.de/north-america/us/massachusetts-latest.osm.pbf

# 2. Clip to Newburyport — exact city polygon (preferred) or bbox
curl -o newburyport.poly "https://polygons.openstreetmap.fr/get_poly.py?id=2385554&params=0"
osmium extract -p newburyport.poly --strategy=smart massachusetts-latest.osm.pbf -o nbpt.osm.pbf

# 3. Thematic layers → GeoJSON (WGS84)
osmium tags-filter nbpt.osm.pbf w/highway              -o roads.osm.pbf
osmium tags-filter nbpt.osm.pbf w/building             -o buildings.osm.pbf
osmium tags-filter nbpt.osm.pbf w/natural w/waterway w/landuse w/leisure -o landcover.osm.pbf
osmium tags-filter nbpt.osm.pbf n/amenity n/shop n/historic n/tourism    -o pois.osm.pbf
for f in roads buildings landcover pois; do osmium export $f.osm.pbf -o $f.geojson; done

# 4. Reproject to meters (one CRS for the whole game; 26986 = MassGIS-native)
for f in roads buildings landcover pois; do
  ogr2ogr -t_srs EPSG:26986 ${f}_sp.geojson $f.geojson
done

# 5. Supplement with MassGIS (public domain) via gis.data.mass.gov:
#    Building Structures 2-D · L3 Parcels (per-town "Newburyport") · LiDAR 1m DEM
#    · 2023 15cm orthos (art reference) · OpenSpace · MassDOT Roads (widths/classes)

# 6. World generation options:
#    A (vector) — load *_sp.geojson directly in-engine; tag-driven styling
#    B (tiles)  — tilemaker nbpt.osm.pbf --output nbpt.pmtiles (streamed)
#    C (lanes)  — a-b-street/osm2streets → lane & intersection polygons
#    For NBPT Living: custom Python preprocessor → autotiled chunked tilemap (see tech-stack.md)

# 7. Coordinate hookup: gameXY = (E - E0, N - N0) meters from a chosen origin
#    (Market Square 42.81135,-70.86976 → project once, subtract).

# 8. EXACTNESS QA — register against Part A anchors; check High St ≈ 3.7 km,
#    station→Market Sq ≈ 1.62 km, town line crosses Plum Island at lat ≈ 42.8115.

# 9. Attribution: "Map data © OpenStreetMap contributors (ODbL), openstreetmap.org/copyright.
#    Additional data courtesy of MassGIS, Commonwealth of Massachusetts EOTSS."
#    + host the derived Newburyport GeoJSON (ODbL share-alike compliance).
```

**Judgment calls:** Geofabrik+osmium beats live Overpass for builds (public Overpass endpoints 504'd repeatedly during research). OSM is master for streets/sidewalks/trails/POIs; MassGIS for parcels, terrain, imagery, footprint cross-checks. EPSG:26986 as working CRS. PMTiles only if streaming needed — at city scale, preprocessed chunks are simpler.

## Sources

[Wikipedia: Newburyport](https://en.wikipedia.org/wiki/Newburyport,_Massachusetts) · [Newburyport Historic District](https://en.wikipedia.org/wiki/Newburyport_Historic_District) · [Plum Island](https://en.wikipedia.org/wiki/Plum_Island_(Massachusetts)) · [Newburyport Harbor Light](https://en.wikipedia.org/wiki/Newburyport_Harbor_Light) · [Chain Bridge](https://en.wikipedia.org/wiki/Chain_Bridge_(Massachusetts)) · [Hines Bridge](https://www.bridgesoftheusa.com/movable-bridges-ma/derek-s-hines-memorial-bridge) · [Newburyport station](https://en.wikipedia.org/wiki/Newburyport_station) · [City: Clipper City Rail Trail](https://www.cityofnewburyport.com/planning-development/clipper-city-rail-trail-harborwalk) · [Coastal Trails Coalition](https://coastaltrails.org/the-trail-network/clipper-city-rail-trail-newburyport/) · [City: Gillis Bridge news](https://www.cityofnewburyport.com/home/news/gillis-bridge-drawbridge-resumes-full-operations-for-marine-traffic) · [MassDOT: Whittier Bridge](https://blog.mass.gov/transportation/massdot-highway/i-95-whittier-bridge-mega-project-moves-forward/) · [Boston Globe: Pink House demolished](https://www.bostonglobe.com/2025/03/11/metro/pink-house-demolished-newbury-plum-island/) · [Kevin Fruh: Newburyport neighborhoods](https://kevinfruh.com/blog/newburyport-neighborhoods-explained-south-end-to-joppa) · [OSM wiki: MassGIS](https://wiki.openstreetmap.org/wiki/MassGIS) · [Geofabrik MA](https://download.geofabrik.de/north-america/us/massachusetts.html) · [MassGIS Building Structures](https://www.mass.gov/info-details/massgis-data-building-structures-2-d) · [MassGIS Parcels](https://www.mass.gov/info-details/massgis-data-property-tax-parcels) · [MassGIS 2023 imagery](https://www.mass.gov/info-details/massgis-data-2023-aerial-imagery) · [MassGIS LiDAR](https://www.mass.gov/info-details/massgis-data-lidar-terrain-data) · [MassGIS OpenSpace](https://www.mass.gov/info-details/massgis-data-protected-and-recreational-openspace) · [MassGIS Data Hub](https://gis.data.mass.gov/) · [OSMF Attribution Guidelines](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines) · [abstreet](https://github.com/a-b-street/abstreet) · [osm2streets](https://github.com/a-b-street/osm2streets) · [tilemaker](https://github.com/systemed/tilemaker) · Live Overpass/OSM API/Nominatim queries 2026-06-11