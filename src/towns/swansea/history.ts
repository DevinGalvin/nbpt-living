import type { Site } from '../../game/history';

// Swansea's discovery markers — true stories at the real spots.
//
// Indigenous cards lead. This was Pokanoket country — the land of Massasoit and
// Metacom — and the war named for Metacom began in this town, so the cards can be
// specific. The same review caveat as docs/research/indigenous-salem.md applies:
// no Indigenous reader has seen these yet. Sources: docs/research/swansea.md.
//
// ⚠️ PLACEMENT: run `node tools/check_markers.mjs swansea` after touching any coordinate.
export const HISTORY: Site[] = [
  // ── Pokanoket ─────────────────────────────────────────────────────────────
  {
    id: 'sowams', x: -24558, z: 25135, icon: '🌾', title: 'Pokanoket', year: 'the name before Swansea',
    body: 'Before it was Swansea this was Pokanoket, the home country of the Wampanoag leader Massasoit — the same Massasoit who made the treaty with the Pilgrims at Plymouth in 1621. His main village, Sowams, sat just across the river in what is now Rhode Island, and this shore, Touisset, was part of it. When you stand on this point you are standing in the middle of his world, not at the edge of anyone else’s.',
    stamp: '★ THE NAME CAME FIRST'
  },
  {
    id: 'the-trail', x: -38569, z: 9619, icon: '🪶', title: 'A Road Older Than the Road', year: 'before 1620',
    body: 'You are on the Old Warren Road, near the Rhode Island line — and Warren was part of Swansea until 1747. A Wampanoag trail ran through here from Mount Hope up into what is now North Swansea, along the lines of today’s Kickemuit and School House Roads, past a big flat rock the Pokanoket used as a grinding stone for corn. The English did not invent these routes. They walked the ones already worn in, and then paved them.',
  },
  {
    id: 'metacom', x: -12400, z: 35000, icon: '👑', title: 'The King Across the Water', year: '1662–1676',
    body: 'Look south across the bay. The hill on the far shore is Mount Hope, in Bristol, and it was the seat of Metacom — the son of Massasoit, called King Philip by the English. He watched his people’s land shrink deed by deed for fourteen years before the war that carries his name began, in this town, in June 1675. Mount Hope Bay is named for his home. Most people who swim here never learn that.',
    stamp: '★ MOUNT HOPE'
  },
  {
    id: 'still-here-swn', x: 60, z: -1180, icon: '🔥', title: 'Still Here', year: 'right now',
    body: 'The war ended in 1676 and the history books mostly stop there, as if the Wampanoag ended with it. They did not. Wampanoag people live in Massachusetts and Rhode Island right now — at Mashpee, at Aquinnah, and in the Pokanoket community around Mount Hope — and they are writing their own history. The right tense is the present one. The library behind you is a good place to start reading it.',
    stamp: '★ PRESENT TENSE'
  },

  // ── The war began here ────────────────────────────────────────────────────
  {
    id: 'hugh-cole', x: -25306, z: 21211, icon: '🏚', title: 'The First Houses Burned', year: 'June 1675',
    body: 'In the third week of June 1675 Wampanoag warriors began raiding the farms along this shore, east of the Kickemuit River — plundering Job Winslow’s house, then burning others, including the house of Hugh Cole, whose name is still on a road in Warren. Nobody had been killed yet. It was a warning, and a test: the Wampanoag believed the side that shed the first blood would lose the war, so they pushed and waited to see who would shoot.',
  },
  {
    id: 'first-blood', x: -26844, z: 5172, icon: '⚔', title: 'The War Starts', year: 'June 24, 1675',
    body: 'A settler shot and wounded a warrior. On June 24 the Wampanoag answered, and nine English people were killed in Swansea in a single day — some ambushed on the road, two more killed going for help. Those were the first deaths of King Philip’s War, which went on to burn half the towns in New England and kill a bigger share of the people living here than any war in American history. It started in this town.',
    stamp: '★ WHERE IT BEGAN'
  },
  {
    id: 'myles-garrison', x: -63393, z: -21858, icon: '🛡', title: 'The Garrison House', year: 'June 1675',
    body: 'The minister’s house that stood near this spot became a fort. When the raids began, the settlers packed into John Myles’s garrison house, and the soldiers of Plymouth and Massachusetts Bay marched here to meet them — this was the first place two colonies’ troops came together to fight. A stone marker with a bronze plaque stands at the corner today. It is easy to drive past. Don’t.',
    stamp: '★ THE MARKER'
  },
  {
    id: 'abrams-rock', x: 1538, z: -4470, icon: '🪨', title: 'Abram’s Rock', year: 'a legend of 1675',
    body: 'The big puddingstone boulders in Village Park have names — Wildcat Rock, Lion Rock, and this one, Abram’s Rock. The story goes that Abram, a Wampanoag man who had left his people to live among the settlers, hid here from King Philip’s men in a chamber under the rock that is still called Abram’s Bedroom. Caught, he was given a choice: death, or three leaps from the top. He survived two. It is a legend. The rock is real, and you can climb it.',
  },

  // ── The town ──────────────────────────────────────────────────────────────
  {
    id: 'john-myles', x: -52341, z: -20600, icon: '⛪', title: 'A Church Chased Out of Wales', year: '1663',
    body: 'John Myles was a Baptist minister in Wales, and when the king began punishing people who worshipped the wrong way, he took part of his congregation across the ocean. They landed in Rehoboth in 1663 and started the first Baptist church in Massachusetts — a thing that was actually illegal in Boston at the time. Four years later they were given this land, named it for the city they had left, and Swansea was a town.',
    stamp: '★ THE OLDEST BAPTIST CHURCH IN MASSACHUSETTS'
  },
  {
    id: 'the-name', x: -2655, z: -1900, icon: '🦢', title: 'Not About Swans', year: '1667',
    body: 'Everyone assumes the name means a sea full of swans. It does not. Swansea, Wales, where the founders came from, was “Sweyn’s ey” — Sweyn’s island — a Viking trading post named for a Danish king a thousand years ago. Over the centuries the sound wore down into a word that happened to look like swan-sea, and the swans came along for the ride. The bird on everything is a happy accident.',
  },
  {
    id: 'five-villages', x: -22357, z: 2573, icon: '🏘', title: 'A Town of Five Villages', year: 'the 1700s',
    body: 'Swansea never had one downtown. It had five villages, each one named for the family that owned the land around it: the Gardners on the Neck, the Barneys at Barneyville, the Luthers here at Luther’s Corner, the Hales at Hortonville, the Eddys in the village. This corner was the busiest — a stagecoach stop, and for the first half of the 1800s the centre of the whole town. Then the roads moved, and the centre moved with them.',
  },
  {
    id: 'luther-store', x: -22141, z: 2600, icon: '🏪', title: 'The Store That Was Everything', year: '1815',
    body: 'John Brown Luther built this brick store in 1815, and for the next ninety years it was the general store, the post office and the town library all at once — because in a farm town you put everything in the one building people already walk to. The Luthers ran it until 1903. The Historical Society bought it in 1941 and it is a museum now, which is a better fate than most old stores get.',
  },
  {
    id: 'barneyville-ships', x: -66396, z: -14799, icon: '⛵', title: 'The Shipyard on a River', year: '1770s–1860',
    body: 'It is hard to believe looking at the quiet Palmer River today, but ocean-going ships were built here. Jonathan Barney started a shipyard in the 1770s and his son Mason made it famous — about 137 ships, sold around the world, launched down this river into the bay. Then steam engines came, the Civil War came, and in 1860 the yard closed. The village kept the family name and turned to making jewelry.',
    stamp: '★ 137 SHIPS'
  },
  {
    id: 'martin-house', x: -46659, z: -15250, icon: '🌾', title: 'The Farm That Stayed', year: '1728',
    body: 'John Martin built this house in 1728, and his family farmed the land around it for two hundred and six years — the same family, the same fields, the same stone walls. In 1934 the last of them left the whole farm to a preservation society instead of selling it, which is why it is still a farm with two barns and dry-stone walls and not a subdivision. Most of Swansea used to look like this. This is the piece that was kept.',
  },

  // ── The Stevens gifts ─────────────────────────────────────────────────────
  {
    id: 'town-hall', x: -285, z: -820, icon: '🏛', title: 'A Town Hall Like No Other', year: '1891',
    body: 'Most New England town halls are white and square. This one is a pile of rough fieldstone with a huge pointed slate roof, a turret and a clock tower, and people who write about buildings call it one of the strangest and most wonderful town halls in the region. It was a present. Frank Shaw Stevens, the richest man in town, paid for it, and it opened in 1891. Town meeting still happens inside a gift.',
    stamp: '★ A GIFT'
  },
  {
    id: 'library', x: 130, z: -1010, icon: '📚', title: 'The Library in the Old Style', year: '1900',
    body: 'When Frank Stevens died in 1898 his widow Elizabeth kept giving. She hired an English architect, Henry Vaughan, and asked for a library that looked like it belonged in an English country town of the 1500s — granite walls, red sandstone trim, big mullioned windows. It opened in 1900 as a memorial to her husband, and it is still the town library. Kids do their homework in one of the best small buildings in Massachusetts.',
  },
  {
    id: 'christ-church', x: 269, z: -694, icon: '🏰', title: 'The Church With Battlements', year: '1900',
    body: 'Same widow, same architect, same year. Elizabeth Stevens had Henry Vaughan build a church next to the library, and he gave it thick granite walls, tall pointed windows, and a tower with a rounded corner and battlements along the top — so it looks a little like a castle. It is one of the finest Gothic Revival churches in New England, in a town of a few thousand people, because one family decided their village should have beautiful things.',
  },
  {
    id: 'stevens-mansion', x: 1069, z: -600, icon: '🏠', title: 'The Mustard Mansion', year: '1855',
    body: 'This big yellow house was built in 1855 and it was, for a long time, the grandest house in Swansea. Frank Shaw Stevens married into it, made his fortune, and then spent a good chunk of it on the town — the town hall down the street, then, through his widow, the library and the church. Today the mansion is a school for kids who need extra help, which the Stevenses would probably have approved of.',
  },

  // ── The shore ─────────────────────────────────────────────────────────────
  {
    id: 'summer-colony', x: -11033, z: 33400, icon: '🏖', title: 'The Summer People', year: '1896–1930',
    body: 'Around 1900, families from the mill cities started building summer cottages on the Neck — shingled houses with big porches, facing the bay, used for about ten weeks a year. Seven of the originals still stand along Mattapoisett Road, and they started something: Ocean Grove and the whole shore filled up with little summer houses. Over the years people winterized them and stayed. Half of South Swansea began as a vacation.',
  },
  {
    id: 'hurricane-carol', x: -19300, z: 20250, icon: '🌀', title: 'The Day the Bay Came In', year: 'August 31, 1954',
    body: 'Hurricane Carol arrived just after high tide with a wall of water behind it, and Mount Hope Bay rose into the streets. The Somerset shore across the Lee River took some of the worst flooding in the state; the cottages along here were swamped. The 1938 hurricane had done the same thing sixteen years earlier. Every shore town on this bay has a line somebody painted on a wall that says: the water got to here.',
    stamp: '★ THE WATER GOT TO HERE'
  },
  {
    id: 'town-beach', x: -18600, z: 20430, icon: '🌊', title: 'Walk Out Into the Bay', year: 'now',
    body: 'This is the town beach, and its trick is that Mount Hope Bay is shallow here — at low tide you can walk out hundreds of feet with the water still at your knees. The bay is really the drowned mouth of the Taunton River, warmer and calmer than the open ocean, which is why the summer people picked it. There are lifeguards in summer, a bathhouse, and a playground. It is the best free thing in Swansea.',
  },

  // ── Modern Swansea ────────────────────────────────────────────────────────
  {
    id: 'route-6', x: -6256, z: 3258, icon: '🛣', title: 'The Grand Army Highway', year: '1937',
    body: 'Route 6, the wide road of car dealers and drive-throughs, has a grander name: the Grand Army of the Republic Highway. It runs from Provincetown all the way to California, and it was named in 1937 for the Grand Army of the Republic — the organization of soldiers who had fought for the Union in the Civil War, who were dying out by then and wanted to be remembered. Every green sign on it is a war memorial.',
  },
  {
    id: 'swansea-mall', x: -18747, z: -7100, icon: '🛍', title: 'The Mall That Was', year: '1975–2019',
    body: 'For forty-four years this was where the whole South Coast went on a Saturday: ninety stores under one roof, a food court, the place you got your school clothes. The Swansea Mall closed for good on March 31, 2019 — the same thing that happened to malls everywhere once shopping moved online. What is left has been mostly gutted into a strip of stores. Ask a grown-up from here about it and watch their face.',
  },
  {
    id: 'venus', x: 548, z: 4669, icon: '🍲', title: 'The Venus', year: '1959',
    body: 'It started as a duckpin bowling alley in 1959 and grew into a banquet hall the size of an aircraft hangar, where two thousand people could eat at once. Nearly every prom, wedding, retirement dinner and sports banquet within thirty miles happened at the Venus de Milo, and everyone had the minestrone soup, which was famous. A future celebrity chef from Fall River named Emeril cooked here once. It is still open.',
    stamp: '★ THE MINESTRONE'
  },
  {
    id: 'case-cardinals', x: -8345, z: -4546, icon: '🏈', title: 'The Cardinals', year: 'since 1927',
    body: 'Joseph Case High School opened in 1927 and its teams have been the Cardinals ever since — red and white, on this field on Friday nights in the fall. In a town without a downtown, the high school is where Swansea shows up as one place: the whole town in the stands, the band, the little kids running under the bleachers. It has been like that for nearly a hundred years.',
  },
  {
    id: 'brayton-point', x: -1331, z: 33054, icon: '💥', title: 'The Towers That Fell', year: 'April 27, 2019',
    body: 'Across the Lee River on Brayton Point, in Somerset, there used to be two concrete cooling towers five hundred feet tall — the biggest thing on the whole bay, built for the last coal power plant in Massachusetts. The plant closed in 2017, and one Saturday morning in April 2019 the towers were blown up on purpose. They were the tallest cooling towers ever demolished. The whole town came out to watch, and they were gone in ten seconds.',
    stamp: '★ TEN SECONDS'
  },
  {
    id: 'big-mamie', x: 19698, z: 37737, icon: '🚢', title: 'Big Mamie', year: '1942',
    body: 'Under the Braga Bridge in Fall River sits a real battleship: the USS Massachusetts, called Big Mamie, thirty-five thousand tons of steel that fought off Casablanca and in the Pacific in the Second World War. She was brought here in 1965 and has been a museum ever since — you can climb through her. The bridge above her is a mile long and opened in 1966. Both are visible from the Swansea shore on a clear day.',
  },
];
