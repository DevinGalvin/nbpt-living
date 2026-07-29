import type { Site } from '../../game/history';

// Charlestown's discovery markers — 20 true stories at the real spots.
//
// Indigenous cards lead. This is Massachusett country at the edge of the territory
// Nanepashemet's family held; the dossier is docs/research/indigenous-salem.md for the
// sachem lineage. Same review caveat: not yet read by an Indigenous reviewer.
//
// ⚠️ TWO MYTHS CORRECTED, both of which I nearly got wrong myself:
//   1. The Battle of Bunker Hill was fought on BREED'S Hill. The monument stands on
//      Breed's. The militia were ordered to fortify Bunker Hill and chose the other one.
//   2. The John Harvard statue is in HARVARD YARD, CAMBRIDGE — not here. Charlestown has
//      the man (he lived and died here in 1638); Cambridge has the bronze. The card says
//      so rather than implying the statue is in this town.
//
// ⚠️ Apostrophes must be the curly ’ — a straight ' terminates the single-quoted body.
//
// ⚠️ PLACEMENT: run `node tools/check_markers.mjs charlestown` after touching any coordinate.
export const HISTORY: Site[] = [
  {
    id: 'mishawum', x: -668, z: 4127, icon: '🌊', title: 'Mishawum', year: 'the name before Charlestown',
    body: 'Before any of this, the peninsula between two rivers was called Mishawum. It is a superb piece of ground if you travel by water: a neck of land with a river on either side and a harbor in front, which means you can get anywhere. The English chose it for exactly that reason in 1629, which is the same reason it had already been valuable for a very long time.',
    stamp: '★ THE NAME CAME FIRST'
  },
  {
    id: 'the-emptying-chs', x: -4331, z: -5505, icon: '🕯', title: 'The Land Was Not Empty', year: '1616–1633',
    body: 'The English wrote that this peninsula was open and available. Sickness carried from earlier European ships had swept these rivers twice in about fifteen years and killed a devastating share of the people living along them. That is what made the ground "available." It is the single most important fact about how New England got settled, and it is the one most often left out.',
    stamp: '★ NOT EMPTY — EMPTIED'
  },
  {
    id: 'squaw-sachem-chs', x: -5851, z: 1115, icon: '👑', title: 'The Leader on Both Rivers', year: 'after 1619',
    body: 'The Massachusett sachem Nanepashemet held territory that ran from the Charles all the way to the Merrimack — including this peninsula. When he died in 1619 his widow governed it, and English colonists dealt with her for years. They recorded her only by a title, never her actual name. She led a very large piece of what is now Massachusetts and we do not know what she called herself.',
    stamp: '★ SHE LED ANYWAY'
  },
  {
    id: 'still-here-chs', x: -6783, z: -9148, icon: '🔥', title: 'Still Here', year: 'right now',
    body: 'Massachusett people are not a closed chapter. Their descendants live in this state today, and the tribe maintains its own account of this history — which is a different thing from a history written about them. If you go looking, look for what they publish about themselves, in the present tense, rather than only what a town history said a hundred years ago.',
    stamp: '★ PRESENT TENSE'
  },

  {
    id: 'before-boston', x: -1046, z: 3379, icon: '🥇', title: 'Older Than Boston', year: '1629',
    body: 'Here is a fact that annoys people across the river: Charlestown was settled first. English colonists set up here in 1629, and Boston came a year later — in fact the Boston settlers started here and moved across after deciding the water was better over there. Charlestown has spent four hundred years being the older sibling that nobody mentions.',
    stamp: '★ CHARLESTOWN CAME FIRST'
  },
  {
    id: 'john-harvard', x: -1046, z: 3500, icon: '📚', title: 'The Man Who Left His Books', year: '1638',
    body: 'John Harvard was a young minister in Charlestown who died of illness after barely a year here. He left half his money and his entire library — about four hundred books — to a struggling new college across the river. They named it after him. He never taught there. And the famous statue of him is in Cambridge, not here, and is nicknamed the Statue of Three Lies, because almost everything carved on it is wrong.',
    stamp: '★ THE STATUE IS IN CAMBRIDGE'
  },
  {
    id: 'breeds-hill', x: -344, z: -78, icon: '⛰', title: 'The Battle Is on the Wrong Hill', year: 'June 17, 1775',
    body: 'This monument marks the Battle of Bunker Hill. You are standing on Breed’s Hill. The battle everyone has heard of was fought right here, on this hill, under the wrong name — and it has been called by the wrong name for two hundred and fifty years. Nobody is going to fix it now. But you know, and most visitors leaning on this fence do not.',
    stamp: '★ YOU ARE ON BREED’S'
  },
  {
    id: 'the-order', x: -537, z: -2850, icon: '🗺', title: 'They Were Told the Other One', year: 'the night before',
    body: 'The militia were ordered to dig in on Bunker Hill — the bigger hill, further back, easier to defend. They came up in the dark and built their wall on Breed’s Hill instead: smaller, more exposed, and much closer to the British in Boston. Nobody is entirely sure whether that was a mistake or a decision. Either way, a thousand men spent one night digging in the wrong place and changed the war.',
  },
  {
    id: 'the-burning', x: 2101, z: -324, icon: '🔥', title: 'They Burned the Whole Town', year: 'June 17, 1775',
    body: 'During the battle, colonial marksmen were shooting from the houses below, so the British set the town on fire to drive them out. Charlestown — hundreds of buildings, nearly every house — burned to the ground in an afternoon. Most people had already fled. They came back to nothing. Everything you can see around you was built after that day, because there was nothing left to build on top of.',
    stamp: '★ THE TOWN WAS GONE'
  },
  {
    id: 'the-monument', x: -344, z: 100, icon: '🗼', title: 'Two Hundred and Ninety-Four Steps', year: '1843',
    body: 'A granite obelisk two hundred and twenty-one feet high, with a staircase inside and no lift, ever. It took years to build and the money kept running out — at one point a huge fair run by women raised what was needed to finish it. If you climb it, you climb the same steps everyone has since 1843, and at the top you can see exactly why both armies wanted this hill.',
    stamp: '★ CLIMB IT'
  },
  {
    id: 'joseph-warren', x: -200, z: -300, icon: '🎖', title: 'The Man Who Did Not Have To Be There', year: 'June 17, 1775',
    body: 'Joseph Warren was a doctor, and one of the most important leaders in Massachusetts — he had just been made a general. He turned up at this hill and refused to take command, and fought as an ordinary soldier in the line instead. He was killed here. He was thirty-four. He is the reason a great many places in this state are called Warren.',
  },
  {
    id: 'navy-yard', x: 2875, z: 2564, icon: '⚓', title: 'One of the First Six', year: '1800',
    body: 'When the United States was brand new it decided it needed places to build and repair warships, and set up six navy yards. This was one of them. For a hundred and seventy years this waterfront built, fixed and fitted out ships — through every war the country had. Then it closed. The cranes and the dry dock and the granite are all still here, which is why you can walk around inside the history.',
  },
  {
    id: 'constitution', x: 2038, z: 4420, icon: '⛵', title: 'Old Ironsides', year: 'launched 1797',
    body: 'She is the oldest commissioned warship in the world that is still afloat, and she still has a crew. Her nickname came from a battle where British cannonballs bounced off her hull — made of live oak so dense the sailors said it was iron. She still goes out into the harbor and turns around, so that she weathers evenly on both sides. A ship from 1797, still going for a spin.',
    stamp: '★ STILL COMMISSIONED'
  },
  {
    id: 'cassin-young', x: 4865, z: 1786, icon: '🚢', title: 'The Ship That Was Hit Twice', year: '1943',
    body: 'The grey destroyer at the pier is a Second World War ship, and unlike the wooden one she has seen the modern kind of war: she was struck by aircraft twice off Okinawa and came home both times. She is named after a captain who won the Medal of Honor at Pearl Harbor. She sits a few hundred feet from a ship launched in 1797, which is a very strange and very good place to stand.',
  },
  {
    id: 'the-ropewalk', x: 4319, z: 3405, icon: '🪢', title: 'A Quarter-Mile Building', year: '1838–1970',
    body: 'Rope for a sailing ship has to be made in one continuous length, so the building you make it in has to be as long as the rope. This one is a quarter of a mile of granite — a building shaped entirely by the thing made inside it. It turned out most of the rope the United States Navy used from 1838 until 1970. One building, one job, one hundred and thirty-two years.',
    stamp: '★ A QUARTER MILE LONG'
  },
  {
    id: 'winthrop-square', x: 451, z: 1860, icon: '🌳', title: 'The Training Field', year: 'the 1600s',
    body: 'This square was the town training field, where Charlestown men drilled with muskets because every colonial town was required to keep soldiers ready. The men who dug in on Breed’s Hill in 1775 had practised on this grass. It is a quiet park now with benches, and it is one of the oldest continuously public pieces of ground in the country.',
  },
  {
    id: 'annexed', x: -874, z: 5646, icon: '🤝', title: 'The Year It Stopped Being a City', year: '1874',
    body: 'Charlestown was its own city, with its own mayor and its own everything, until 1874 — when it voted, narrowly and not very enthusiastically, to be absorbed into Boston. It got a bigger water supply and lost its name on the map. People here still say “Charlestown” rather than “Boston” when asked where they are from, a hundred and fifty years later. That tells you how the vote felt.',
    stamp: '★ STILL SAYS CHARLESTOWN'
  },
  {
    id: 'schrafft', x: -6703, z: -7443, icon: '🍬', title: 'The Candy Clock', year: '1928',
    body: 'The enormous brick building with the clock tower was a sweet factory — one of the largest in the world when it opened, turning out chocolates and boiled sweets by the ton. Generations of people here worked in it, and the whole neighbourhood could smell it. The candy is long gone; the clock is still up there, still telling the time to a town that used to set its shifts by it.',
  },
  {
    id: 'the-bridges', x: -1980, z: 5944, icon: '🌉', title: 'A Peninsula Needs Bridges', year: 'since 1786',
    body: 'Charlestown is almost an island — rivers on two sides and a harbor in front — so for most of its life the only way in was by boat. The first bridge across to Boston opened in 1786 and was, at the time, one of the longest in the world. Everything about how this place has grown comes down to one question that gets asked over and over: where do we put the next crossing?',
  },
  {
    id: 'the-townies', x: 4875, z: -2646, icon: '🏘', title: 'Townies', year: 'now',
    body: 'People born and raised in this square mile call themselves Townies, and they mean it as a fact and a compliment. Charlestown has been a landing place for a long time — Irish families in particular arrived here in enormous numbers — and it stayed tightly packed and tightly connected. Being from a neighbourhood is a real thing here, not a postcode. Ask somebody how long their family has been in it.',
  },
];
