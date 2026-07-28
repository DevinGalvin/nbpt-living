// Boston — map-pipeline curation. Starts empty per docs/TOWNS.md; the landmark
// roster is written after the first world build, from
// `TOWN=boston node tools/landmark_candidates.mjs`.
//
// Boston is the first town in the set that Overpass cannot serve: raw OSM for
// the city runs 150-250 MB and a 2x2 tiling of *Salisbury* already drew a 429.
// Its raw data comes from a Geofabrik `massachusetts-latest.osm.pbf` clipped
// with osmium — see tools/fetch_osm_pbf.mjs, which writes the SAME
// data/boston/raw/overpass.json contract that tools/fetch_osm.mjs does, so
// build_world.mjs cannot tell the two roads apart.
//
// Frame notes (bbox in town.json), chosen from MEASURED counts, not drawn by eye:
// the rectangle holding all of Boston — Readville and Hyde Park in the south up
// to the Charlestown/Chelsea line, West Roxbury out to the Dedham line — counts
// 216,640 buildings, NOT the 119,414 that docs/research/boston-sizing.md measured
// against Boston's admin boundary alone. The gap is real and unavoidable: any
// rectangle containing Boston also contains Cambridge, Somerville, Brookline,
// Quincy, Newton, Milton, Chelsea, Everett and Revere. That is the same bargain
// every town in the set already makes (Charlestown's frame reaches into the North
// End; Gloucester's takes all of Cape Ann), and it is a feature — you can cross
// the Longfellow to MIT and see Harvard from the river.
//
// The east edge runs to -70.88 rather than stopping at the built-up shore, to
// take in the outer harbor: Georges Island and Fort Warren, Long and Spectacle
// and Thompson, and Little Brewster with BOSTON LIGHT on it — America's oldest
// light station (1716), inside Boston's city limits, and unreachable except by
// kayak or by air. It costs almost no buildings; it is all ocean.

export const dropOsm = [];

// Boston is the first town in the set with a SKYLINE, so it is the first that
// needs the storey ceiling raised. The pipeline's default of 6 is the North
// Shore's tallest plausible building; here it flattened 2,827 buildings onto one
// mid-rise plain, including every downtown tower and the two that carry an
// honest building:levels tag — 200 Clarendon at 60 and the Prudential at 52.
// 60 is the real number: 200 Clarendon is the tallest building in New England
// and nothing in frame goes past it.
export const maxLevels = 60;

export const downtownCore = null;

export const storefrontCorridors = [];

// Curated fast-travel landmarks: id, name, sub, x, y, r (world px; r / 8 = m).
// EVERY coordinate comes from `TOWN=boston node tools/landmark_candidates.mjs
// --all`, which point-in-polygon checks against Boston's real municipal boundary
// and returns a safe INTERIOR point that is also on DRY LAND. Nothing here is
// guessed. Cambridge, Brookline and Somerville are in frame but deliberately NOT
// in this roster — the Rockport-in-Gloucester rule: neighbours are nods, not a
// second town's list.
//
// Long at ~120 (the recipe's range is 25-35) because Boston is a city, and
// because a roster of only famous things would miss the point: the six
// neighbourhood skating rinks, the ten playgrounds and the harbor beaches are
// here for the same reason Newburyport's are.
const BOSTON_LM = [
  // ── the Freedom Trail, downtown ──
  ['faneuil-hall', 'Faneuil Hall', 'The Cradle of Liberty — and a grasshopper on the roof', 4064, -3229, 340],
  ['quincy-market', 'Quincy Market', 'A quarter-mile of food under a granite dome', 5010, -3393, 400],
  ['old-state-house', 'Old State House', 'The lion and the unicorn, over the oldest public building in Boston', 3258, -2068, 300],
  ['boston-massacre-site', 'Boston Massacre Site', 'A ring of cobblestones marks where it happened', 3447, -2116, 280],
  ['old-south-meeting-place', 'Old South Meeting House', 'Where the Tea Party was decided', 2630, -533, 300],
  ['kings-chapel', "King's Chapel", 'Granite church with a tower that never got its steeple', 1515, -1467, 300],
  ['kings-chapel-burying-ground', "King's Chapel Burying Ground", "Boston's oldest graveyard, from 1630", 1691, -1665, 340],
  ['granary-burying-ground', 'Granary Burying Ground', 'Paul Revere, Sam Adams and John Hancock are all here', 512, -836, 400],
  ['park-street-church', 'Park Street Church', 'The white steeple at the corner of the Common', 251, -386, 300],
  ['first-public-school-site', 'Boston Latin School Site', "America's first public school stood here in 1635", 1577, -1434, 280],
  ['old-city-hall', 'Old City Hall', 'City Hall for a hundred years, with a donkey out front', 1996, -1467, 340],
  ['boston-city-hall', 'Boston City Hall', 'The upside-down concrete castle everyone argues about', 2932, -3504, 460],
  ['rose-kennedy-greenway', 'Rose Kennedy Greenway', 'A mile of parks where an elevated highway used to be', 7384, -584, 560],
  ['boston-opera-house', 'Boston Opera House', 'Gold and red velvet in the Theater District', -200, 1931, 340],
  ['orpheum-theatre', 'Orpheum Theatre', 'One of the oldest theatres in America, still going', 996, 156, 340],
  ['custom-house-tower', 'Custom House Tower', 'A Greek temple with a 496-foot clock tower shoved through it', 5822, -2350, 360],
  ['custom-house-observation', 'Custom House Observation Deck', 'Step out at the 26th floor and see the whole harbor', 5866, -2317, 280],
  ['boston-public-market', 'Boston Public Market', 'Everything sold here is grown or made in New England', 3203, -5086, 300],

  // ── Beacon Hill ──
  ['massachusetts-state-house', 'Massachusetts State House', 'Red brick under a real gold dome, on top of the hill', -1012, -1909, 460],
  ['acorn-street', 'Acorn Street', 'The most photographed cobblestones in America', -4511, -1006, 280],
  ['louisburg-square', 'Louisburg Square', 'Private gardens and gas lamps', -4247, -1774, 340],
  ['nichols-house-museum', 'Nichols House Museum', 'A Beacon Hill house left exactly as it was', -2369, -1875, 280],
  ['african-meeting-house', 'African Meeting House', 'The oldest Black church building still standing in America', -2024, -3160, 300],
  ['black-heritage-trail', 'Boston African American National Historic Site', 'The Black Heritage Trail starts here', -5434, -1350, 300],
  ['shaw-memorial', 'Shaw and 54th Regiment Memorial', 'The Black regiment that marched down Beacon Street', -726, -960, 300],

  // ── the Common and the Public Garden ──
  ['boston-common', 'Boston Common', "America's oldest park — cows grazed here in 1634", -2403, 1207, 700],
  ['boston-public-garden', 'Boston Public Garden', "The first public botanical garden in America", -5090, 1987, 620],
  ['swan-boats', 'Swan Boats', 'Pedal-powered swans since 1877', -4782, 2100, 300],
  ['frog-pond', 'Frog Pond', 'Wading in summer, ice skating all winter', -2874, 397, 320],
  ['parkman-bandstand', 'Parkman Bandstand', 'Concerts in the middle of the Common', -2045, 1830, 280],

  // ── the North End ──
  ['old-north-church', 'Old North Church', 'One if by land, two if by sea — 191 feet of steeple', 5253, -8807, 320],
  ['paul-revere-house', 'Paul Revere House', "Downtown Boston's oldest building, from about 1680", 5734, -6524, 300],
  ['paul-revere-mall', 'Paul Revere Mall', 'The brick courtyard with Revere on his horse', 5694, -8431, 340],
  ['copps-hill-burying-ground', "Copp's Hill Burying Ground", 'Headstones from the 1600s, looking over the harbor', 4273, -9725, 400],
  ['all-saints-way', 'All Saints Way', 'A tiny alley covered wall to wall in saints', 6524, -8834, 280],
  ['skinny-house', 'Skinny House', 'Ten feet wide, built out of spite', 4088, -9343, 280],
  ['pierce-hichborn-house', 'Pierce/Hichborn House', "Paul Revere's cousin lived next door", 5689, -6337, 280],
  ['north-end-parks', 'North End Parks', 'Fountains and lawns where the highway was', 4429, -5226, 300],

  // ── the waterfront and the Seaport ──
  ['new-england-aquarium', 'New England Aquarium', 'A four-storey ocean tank, and the penguins', 8611, -2462, 380],
  ['christopher-columbus-park', 'Christopher Columbus Waterfront Park', 'The trellis, the roses and the harbor', 7085, -4088, 420],
  ['rowes-wharf', 'Rowes Wharf', 'The great arch you sail under', 8006, -20, 420],
  ['boston-tea-party-ships', 'Boston Tea Party Ships & Museum', 'Throw the tea overboard yourself', 7313, 3733, 300],
  ['institute-contemporary-art', 'Institute of Contemporary Art', 'The building that hangs out over the water', 12811, 3141, 340],
  ['boston-childrens-museum', "Boston Children's Museum", 'Three floors of climbing, and the giant milk bottle outside', 8399, 3975, 360],
  ['boston-fish-pier', 'Boston Fish Pier', 'The oldest working fish pier in America', 15852, 5099, 420],
  ['lawn-on-d', 'The Lawn on D', 'Glowing swings you can actually swing on', 11415, 10610, 400],
  ['seaport-common', 'Seaport Common', 'The green in the middle of the newest neighbourhood', 11482, 3858, 340],
  ['harborwalk-lookout', 'Harborwalk Lookout', 'Out over the water on the Harborwalk', 12302, 1534, 280],
  ['menino-convention-center', 'Boston Convention & Exhibition Center', 'Big enough to park a plane in', 11345, 8658, 560],

  // ── Back Bay and Copley Square ──
  ['trinity-church', 'Trinity Church', 'Rough grey granite and a 211-foot tower', -8626, 5690, 360],
  ['boston-public-library', 'Boston Public Library', 'The first big free library in America — walk into the courtyard', -10334, 6214, 440],
  ['old-south-church', 'Old South Church', 'The striped stone tower on Copley Square', -10321, 5522, 340],
  ['copley-square', 'Copley Square', 'Where the Marathon finishes', -9207, 5741, 440],
  ['prudential-tower', 'Prudential Tower', '52 storeys, and you can go up', -13252, 8201, 360],
  ['skywalk-observatory', 'Skywalk Observatory', 'The whole city, 50 floors up', -13335, 8043, 280],
  ['commonwealth-ave-mall', 'Commonwealth Avenue Mall', 'A tree-lined promenade straight through Back Bay', -7384, 2820, 620],
  ['christian-science-plaza', 'Christian Science Plaza', 'A 670-foot reflecting pool and a giant dome', -14872, 11281, 460],
  ['the-mapparium', 'The Mapparium', 'Walk through the inside of a stained-glass globe', -15671, 9947, 280],
  ['symphony-hall', 'Symphony Hall', 'Widely called the best-sounding concert hall in the world', -15342, 12049, 360],
  ['charles-river-esplanade', 'Charles River Esplanade', 'Three miles of riverbank to run, bike and sail from', -6296, -6631, 800],
  ['hatch-shell', 'Hatch Memorial Shell', 'Free concerts on the river, and fireworks on the Fourth', -7433, -825, 320],
  ['gibson-house', 'Gibson House Museum', 'A Back Bay townhouse frozen in 1860', -7722, 1476, 280],
  ['good-will-hunting-bench', 'Good Will Hunting Bench', 'The bench from the movie, facing the lagoon', -5465, 1779, 280],
  ['boston-duck-tours', 'Boston Duck Tours', 'A truck that drives into the river on purpose', -12631, 9286, 300],

  // ── the Fenway ──
  ['fenway-park', 'Fenway Park', 'The oldest ballpark in baseball, and the Green Monster', -22918, 8698, 460],
  ['citgo-sign', 'Citgo Sign', '60 feet square, over Kenmore Square since 1965', -22318, 6326, 300],
  ['museum-of-fine-arts', 'Museum of Fine Arts', 'Half a million works of art', -20825, 15119, 460],
  ['gardner-museum', 'Isabella Stewart Gardner Museum', 'A Venetian palace with a courtyard in the middle', -24134, 16176, 360],
  ['back-bay-fens', 'Back Bay Fens', "Olmsted's marsh, and the Victory Gardens", -20409, 12658, 620],
  ['kelleher-rose-garden', 'James P. Kelleher Rose Garden', 'A walled garden of roses in the Fens', -21411, 12851, 340],
  ['massart-art-museum', 'MassArt Art Museum', 'Free contemporary art at the art college', -23747, 17359, 280],

  // ── South Boston ──
  ['castle-island', 'Castle Island', 'A fort, a beach and a walk all the way around', 33760, 16434, 620],
  ['fort-independence', 'Fort Independence', 'Granite walls guarding the harbor since 1801', 33857, 16146, 420],
  ['pleasure-bay', 'Pleasure Bay', 'A saltwater lagoon you can swim across', 26429, 20981, 440],
  ['marine-park', 'Marine Park', 'The causeway loop out to the island', 25407, 16550, 560],
  ['dorchester-heights', 'Dorchester Heights', 'Washington put cannon here and the British left', 10955, 20906, 320],

  // ── East Boston ──
  ['piers-park', 'Piers Park', 'The best view of the skyline there is', 16057, -8075, 560],
  ['constitution-beach', 'Constitution Beach', 'Sand, ballfields and planes overhead', 33240, -23297, 560],
  ['lopresti-park', 'LoPresti Park', 'Harbor-side green with the city right across', 12518, -12378, 300],
  ['belle-isle-meadow', 'Belle Isle Meadow', "Boston's last salt marsh", 46512, -30573, 440],

  // ── Charlestown, across the water ──
  ['bunker-hill-monument', 'Bunker Hill Monument', '221 feet of granite, and 294 steps to the top', 1078, -17737, 420],
  ['uss-constitution', 'USS Constitution', 'Old Ironsides — still afloat, still in the Navy', 3867, -14246, 380],
  ['uss-cassin-young', 'USS Cassin Young', 'A World War II destroyer you can walk aboard', 5286, -13974, 340],
  ['charlestown-navy-yard', 'Charlestown Navy Yard', 'The Navy built ships here for 174 years', 3931, -15209, 620],

  // ── Dorchester ──
  ['jfk-library', 'John F. Kennedy Presidential Library', 'White concrete and a glass sail on the water', 18849, 35865, 400],
  ['commonwealth-museum', 'Commonwealth Museum', "Massachusetts' own charter and constitution", 18421, 37662, 300],
  ['savin-hill-beach', 'Savin Hill and Malibu Beach', 'Two little harbor beaches side by side', 10077, 43086, 560],
  ['ronan-park', 'Ronan Park', 'A hilltop park with a long view', 120, 46592, 560],

  // ── Roxbury ──
  ['shirley-eustis-house', 'Shirley-Eustis House', 'A royal governor built this in 1747', -6181, 29218, 300],
  ['roxbury-heritage', 'Roxbury Heritage State Park', 'The hill the Continental Army fortified', -18304, 22868, 420],
  ['dudley-town-common', 'Dudley Town Common', 'The green at the heart of Nubian Square', -8687, 26431, 340],

  // ── Jamaica Plain and the Emerald Necklace ──
  ['jamaica-pond', 'Jamaica Pond', 'Sixty feet deep, and you can rent a sailboat', -37883, 33214, 700],
  ['jamaica-pond-bandstand', 'Jamaica Pond Bandstand', 'Concerts by the water', -36312, 36023, 280],
  ['arnold-arboretum', 'Arnold Arboretum', "Harvard's tree museum — 281 acres you can climb in", -40323, 51591, 800],
  ['franklin-park', 'Franklin Park', "The biggest park in Boston, and Olmsted's favourite", -20860, 47788, 800],
  ['franklin-park-zoo', 'Franklin Park Zoo', 'Gorillas, lions and a rainforest under glass', -20705, 40016, 560],
  ['sam-adams-brewery', 'Samuel Adams Brewery', 'Where the beer with Sam Adams on the label is made', -26913, 37233, 300],
  ['forest-hills-preserve', 'Forest Hills Preserve', 'Woods at the edge of the Arboretum', -30482, 50232, 420],

  // ── Roslindale, West Roxbury, Hyde Park, Mattapan ──
  ['stony-brook-reservation', 'Stony Brook Reservation', '475 acres of woods inside the city', -50618, 84878, 800],
  ['millennium-park', 'Millennium Park', 'A hill built on a landfill, with the best kite flying in Boston', -78007, 65665, 800],
  ['george-wright-golf', 'George Wright Golf Course', 'A Donald Ross course the city owns', -47167, 80196, 800],
  ['mount-hope-cemetery', 'Mount Hope Cemetery', 'A garden cemetery with hills and ponds', -29411, 65476, 700],

  // ── Brighton and Allston ──
  ['chestnut-hill-reservoir', 'Chestnut Hill Reservoir', 'A mile and a half around the water', -62633, 19097, 700],
  ['bu-bridge-view', 'View from the BU Bridge', 'The one spot where a boat can sail under a train under a car', -31747, 3542, 300],

  // ── the harbor islands ──
  ['spectacle-island', 'Spectacle Island', 'A rubbish dump turned into the highest hill in the harbor', 49772, 26750, 800],
  ['thompson-island', 'Thompson Island', 'Salt marsh, drumlin and a school out in the harbor', 33294, 41142, 560],
  ['deer-island', 'Deer Island', 'The egg-shaped digesters, and five miles of harbor path', 67498, 1991, 800],
  ['deer-island-light', 'Deer Island Light', 'The spark-plug light at the harbor mouth', 71105, 14726, 300],
  ['boston-light', 'Boston Light', "America's first lighthouse, 1716 — reach it by kayak or by air", 113552, 25313, 360],

  // ── skating rinks: one for nearly every neighbourhood ──
  ['steriti-rink', 'Steriti Memorial Rink', 'Public ice in the North End', 3447, -10733, 340],
  ['porrazzo-rink', 'Porrazzo Skating Rink', 'Public ice in East Boston', 33397, -23175, 340],
  ['murphy-rink', 'Francis L. Murphy Skating Rink', 'Public ice in South Boston', 25390, 17403, 340],
  ['devine-rink', 'Robert M. Devine Skating Rink', 'Public ice in Dorchester', 11473, 60351, 340],
  ['reilly-rink', 'Reilly Memorial Rink', 'Public ice in Brighton', -59349, 17800, 340],
  ['bajko-rink', 'Bajko Memorial Rink', 'Public ice in Hyde Park', -49615, 95036, 340],

  // ── playgrounds ──
  ['martins-park', "Martin's Park", 'A playground built so every kid can play in it', 8599, 3164, 380],
  ['walsh-playground', 'Walsh Playground', 'Ballfields and swings in Hyde Park', -5546, 70683, 440],
  ['connolly-playground', 'Connolly Playground', 'The big playground in Roxbury', -22267, 30066, 440],
  ['joyce-playground', 'Joyce Playground', 'Courts and climbers in Brighton', -58736, 9863, 400],
  ['martin-playground', 'Martin Playground', 'Swings and fields in Dorchester', 6193, 68573, 400],
  ['winthrop-playground', 'Winthrop Playground', 'A neighbourhood play area in Roxbury', -8964, 34652, 340],
  ['defilippo-playground', 'Defilippo Playground', "The North End's own playground", 3540, -9235, 340],
  ['paris-st-playground', 'Paris Street Playground', 'Play area and pool in East Boston', 16698, -14015, 340],
  ['buckley-playground', 'Buckley Playground', 'Play area in South Boston', 8754, 15158, 340],
  ['stoneman-playground', 'Stoneman Playground', 'A small green in the South End', -16180, 3387, 340],

  // ── odds and ends worth finding ──
  ['sports-museum', 'The Sports Museum', 'Inside TD Garden, up on the balconies', 509, -8678, 300],
  ['west-end-museum', 'The West End Museum', 'The neighbourhood that got knocked down', -899, -6999, 280],
  ['boston-fire-museum', 'Boston Fire Museum', 'Old engines in an old firehouse', 9005, 4927, 280],
  ['wang-ymca', 'Wang YMCA of Chinatown', 'Pool, gym and after-school in Chinatown', -1594, 6856, 300],
];
export function landmarks() {
  return BOSTON_LM.map(([id, name, sub, x, y, r]) => ({ id, name, sub, x, y, r }));
}

export const curatedPois = [];
export const curatedPoisHand = {};
export const manualBuildings = [];
export function manualFeatures({ world }) {
  // ── Clear the inside of Fenway Park ──────────────────────────────────────
  // OSM maps the STANDS as their own `building=yes` way inside the stadium
  // relation — a 19,532 m² block, 58% of the park's own area — plus four small
  // ways for the front office and a couple of kiosks. The stadium is a hero that
  // builds the whole park (bowl, Monster, diamond), so those extra footprints
  // render as ordinary buildings INSIDE it: standing on the outfield grass you
  // were looking at a three-storey brick block with punched windows and
  // storefronts where the first-base grandstand should be.
  //
  // General rule rather than five hand-picked ids: anything whose centroid falls
  // inside a stadium footprint is part of that stadium, and the hero owns it.
  const pip = (x, y, p) => {
    let c = false;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      const xi = p[i], yi = p[i + 1], xj = p[j], yj = p[j + 1];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const centroid = (p) => {
    let x = 0, y = 0; const n = p.length / 2;
    for (let i = 0; i < n; i++) { x += p[i * 2]; y += p[i * 2 + 1]; }
    return [x / n, y / n];
  };
  const arenas = world.buildings.filter((b) => b.n === 'Fenway Park' || b.n === 'Harvard Stadium');
  if (!arenas.length) { console.warn('FENWAY CLEAR: no stadium footprint found'); return; }
  const before = world.buildings.length;
  world.buildings = world.buildings.filter((b) => {
    if (arenas.includes(b)) return true;
    const [cx, cy] = centroid(b.p);
    return !arenas.some((a) => pip(cx, cy, a.p));
  });
  console.log(`Stadium interiors cleared: ${before - world.buildings.length} buildings removed`);
}
// 660 Beacon Street is nine storeys; Overture's ML pass read it as six. It has
// to be right, because the Citgo Sign sits on its roof and the whole point of
// the sign is where it stands over Kenmore Square.
export const levelFixes = [
  { x: -22284, y: 6330, lv: 9 },   // 660 Beacon St — the Citgo Sign's host building
];

// Names OSM carries on POI nodes but not on footprints — stamped onto the
// containing building so HEROES/search bind. Anchors verified inside the ring at
// build time (watch for NAME_FIX missed).
export const nameFixes = [
  // The Citgo Sign is an `attraction` NODE in OSM (x -22318, y 6326) with no
  // footprint of its own, and its host building is unnamed — so neither the
  // hero mechanism nor search could reach it, and the landmark rendered as an
  // empty square. Stamping the host's real address binds HEROES['660 Beacon
  // Street'], which builds the block AND the sign on its roof.
  { x: -22284, y: 6330, n: '660 Beacon Street' },
];

// Real-world verified distances guard the projection — add pairs once two
// points are independently verified (never computed from the same formula).
export const qaDistances = [];

export const qaElevationSpots = [];
