import type { Site } from '../../game/history';

// Newburyport's discovery markers — the town's 36 true stories, each a bronze plaque
// standing at the real spot. Moved out of game/history.ts on 7/28 so every town owns
// its own set (the engine just renders whatever the pack hands it).
//
// The first six are the Indigenous history: they lead the list because the town's
// story does not begin in 1635. Sourced with citations + open questions in
// docs/research/indigenous-newbury.md.
//
// ⚠️ PLACEMENT: run `node tools/check_markers.mjs nbpt` after touching any coordinate.
// It found five long-shipped plaques buried inside their own buildings (City Hall, the
// steeple, the courthouse, Dexter's house, Whitefield's church) — all nudged just
// outside the wall on 7/28. Do NOT verify by probing the running game: the collision
// grid only exists for streamed chunks and lies about everywhere else.
export const HISTORY: Site[] = [
  // The town's story does not start in 1635, so neither does this list. Sourced from
  // docs/research/indigenous-newbury.md — every claim there has a citation, and the
  // open questions (Quascacunquen's meaning, how much of Great Tom's ending to carry)
  // are flagged in that file. Present tense where the people are present tense.
  {
    id: 'first-people', x: -700, z: -950, icon: '⛏', title: 'Before the Ships', year: '5,000 years ago',
    body: 'In 1977, diggers on this waterfront turned up stone tools five thousand years old. Not five hundred — five thousand. The people who made them were the Pawtucket, and they spoke Abenaki, and this river mouth was their summer. Newburyport is an old town. It was somebody’s town for a very long time before it had that name.',
    stamp: '★ FIVE THOUSAND YEARS'
  },
  {
    id: 'river-name', x: -5600, z: -4400, icon: '🌊', title: 'Molodemak', year: 'the river’s first name',
    body: 'Before it was the Merrimack, this river was Molodemak. The Pawtucket fished it with weirs — fences of woven sticks that let the water through and kept the fish in. Every spring the runs came upriver in numbers that are hard to picture now, and everybody came down to meet them. The river never changed. Only the name on the map did.'
  },
  {
    // NOT 15600,10800 — that lands inside the Joppa Flats Education Center. Verified
    // clear ground on the flats side of it (see the placement check in the handoff).
    id: 'four-seasons', x: 15300, z: 11300, icon: '🍂', title: 'Four Homes in One Year', year: 'every year, for centuries',
    body: 'The Pawtucket did not live in one place. They lived in four, and moved with the food. Spring at the falls in Byfield, for the fish and the eels. Summer right here on the flats, digging clams. Fall back at the fields for the corn, beans and squash. Winter up in the woods to hunt. Four homes a year — and every single move on purpose.',
    stamp: '★ SPRING · SUMMER · FALL · WINTER'
  },
  {
    id: 'quascacunquen', x: 10200, z: 15600, icon: '🌱', title: 'The Name of This Place', year: 'before 1635',
    body: 'The land along the Parker River was called Quascacunquen. For two hundred years English books said that meant “waterfall.” Then people who actually speak Abenaki looked at the word and said: no — it means “just right for gardens.” The people who named this place were telling you what it was good for. And the reason we could fix the mistake is that their language is still spoken today.',
    stamp: '★ STILL SPOKEN'
  },
  {
    // NOT -3600,3100 — that is in Frog Pond. This is the Bartlet Mall green above it,
    // by the courthouse, which is where a story about winning in court belongs anyway.
    id: 'old-will', x: -3450, z: 3560, icon: '⚖️', title: 'Old Will Stood His Ground', year: '1679',
    body: 'A Pawtucket man the English called Old Will kept a farm and a wigwam at Byfield Falls, and a settler wanted him off it. Old Will would not go. In 1679 his family took it to an English court — and their lawyer, Andrew Pittimee, was Native himself. They won. Old Will stayed on his land and died in his own home five years later. Not many stories from those years end this way. This one did.',
    stamp: '★ HE STAYED'
  },
  {
    id: 'way-north', x: -25400, z: -19200, icon: '🧭', title: 'The Way North', year: '1695',
    body: 'When the wars came, a leader named Wonalancet chose not to fight. In 1695 he led the survivors of his people up this river and north into Canada, to a village called Odanak. Their descendants are there today. So when you hear that the Native people of this river “disappeared” — they did not. They went somewhere. They are still somewhere. And some of them can still tell you what these rivers are really named.',
    stamp: '★ THEY ARE STILL HERE'
  },
  {
    id: 'great-fire', x: -30, z: -100, icon: '🔥', title: 'The Great Fire', year: '1811',
    body: 'One night in May 1811, a fire started in a stable near Inn Street. By morning, most of downtown was gone. The town rebuilt it all in brick, all at once — and that is the downtown you are standing in. Look around: the fire is why everything matches.'
  },
  {
    id: 'market-house', x: -331, z: -285, icon: '🎭', title: 'The Market House', year: '1823',
    body: 'Built as a market house in 1823. Then it spent a hundred years as the fire station. Now it is a theater. One building has heard applause, alarm bells, and arguments about the price of fish.'
  },
  {
    id: 'custom-house', x: 966, z: -448, icon: '🏛', title: 'The Custom House', year: '1835',
    body: 'Solid granite, designed by the same man who designed the Washington Monument. Ship captains came in here to tell the government what their ships were carrying — and pay the tax. Some of them even told the truth.'
  },
  {
    id: 'uscg', x: 60, z: -900, icon: '⚓', title: 'Birthplace of the Coast Guard', year: '1791',
    body: 'In 1791, Newburyport built and launched the Massachusetts — the very first ship of the fleet that became the U.S. Coast Guard. The Coast Guard still calls this city its birthplace. The station across the harbor agrees.'
  },
  {
    id: 'frs-steeple', x: -980, z: 744, icon: '⛪', title: 'The Steeple', year: '1801',
    body: 'Finished in 1801, and called one of the finest steeples in New England. It has survived gales, lightning, and two hundred years of paint decisions. The clock has told the town the time all along. The town is still late.'
  },
  {
    id: 'tracy-library', x: -845, z: 2306, icon: '📚', title: 'The Tracy Mansion', year: '1771',
    body: 'Built in 1771 for Nathaniel Tracy, who got rich sending privateers — legal pirates — after British ships. George Washington slept here in 1789. There was a parade, obviously. Today, anyone with a library card can read in the room he slept in. Bring yours.'
  },
  {
    id: 'bulfinch-court', x: -2620, z: 2920, icon: '📜', title: 'The Bulfinch Courthouse', year: '1805',
    body: 'Designed by Charles Bulfinch, who also designed the U.S. Capitol. Judges still hear cases inside — it is one of the oldest working courthouses in America. Down the hill, Frog Pond has been freezing for skaters since before the courthouse was here to watch.'
  },
  {
    id: 'cushing-house', x: -430, z: 4180, icon: '🍵', title: 'The Cushing House', year: '1808',
    body: 'Three generations of Cushings filled this brick mansion with what sea captains carried home: porcelain, silk, silver, stories. Caleb Cushing left it to become America’s first ambassador to China. The garden out back is still arguing with the New England weather — and still winning.'
  },
  {
    id: 'whitefield', x: 2624, z: 2790, icon: '🕯', title: 'The Preacher Underneath', year: '1770',
    body: 'George Whitefield was the most famous preacher in the world in his day. He died in Newburyport in 1770, and he was buried in a crypt — a stone room under the floor — right beneath this pulpit. For years his arm was kept in a small wooden box and shown to visitors, before somebody finally put it back. Every word of this is true.'
  },
  {
    id: 'walking-light', x: 33230, z: -3300, icon: '🗼', title: 'The Walking Lighthouse', year: '1788',
    body: 'The sandbars at the river mouth will not hold still, so the lighthouse learned to follow them. Keepers dragged it across the dunes on log rollers — more than once. A lighthouse that walks. Plum Island had one first.'
  },
  {
    id: 'range-lights', x: 2412, z: 160, icon: '🔭', title: 'The Range Lights', year: '1873',
    body: 'Captains lined up this brick tower with the smaller light by the water. Lights stacked: you were safe in the channel. Lights apart: you were about to meet a sandbar. GPS before GPS, since 1873.'
  },
  {
    id: 'dexter-grave', x: -4380, z: 3480, icon: '🪦', title: 'Lord Timothy Dexter', year: '1747–1806',
    body: 'He sold warming pans to the Caribbean (they made fine ladles) and shipped coal to Newcastle (it arrived during a strike) — and got rich both times. He wrote a book with no punctuation at all; when readers complained, the next edition added a page of commas and periods to "pepper and solt it as you plese." He rests here. Probably pleased.'
  },
  {
    id: 'dexter-house', x: -7212, z: 495, icon: '👑', title: 'Dexter’s Museum', year: '1798',
    body: 'Lord Dexter crowned his mansion with more than forty carved wooden statues — presidents, philosophers, himself (twice). A great gale in 1815 scattered them, and the survivors sold for pennies. Keep your eyes open around town. You never know what washed up where.'
  },
  {
    id: 'garrison', x: -2740, z: -360, icon: '📰', title: 'The Paper Boy', year: '1805–1879',
    body: 'William Lloyd Garrison delivered newspapers on these streets at thirteen. He grew up to publish The Liberator and spend thirty years demanding the end of slavery in America — and he lived to see it. The statue faces the square where his route began.'
  },
  {
    id: 'powder-house', x: -12138, z: 3520, icon: '🧨', title: 'The Powder House', year: '1822',
    body: 'The town kept its gunpowder in this little brick drum, far enough from downtown that a bad day at the powder house stayed a bad day at the powder house. The walls are round so there are no corners to catch a spark. Somebody thought hard about this building.'
  },
  {
    id: 'old-jail', x: -4564, z: 2520, icon: '🔒', title: 'The Old Gaol', year: '1825',
    body: 'Granite, three feet thick, built in 1825 to hold whalers, smugglers, and the occasional pirate while they considered their choices. The view is better from where you are standing. It always was.'
  },
  {
    id: 'first-flight', x: 18420, z: 13560, icon: '✈️', title: 'First Flight at Plum Island', year: '1910',
    body: 'Seven years after the Wright brothers, a Burgess biplane lifted off this grass — the first flight in this corner of New England, from what is now the region’s oldest airfield. Pilots have been landing on the same field ever since. Some of them on purpose.'
  },
  {
    id: 'chain-bridge', x: -24290, z: -20570, icon: '🌉', title: 'The Chain Bridge', year: '1810',
    body: 'The first bridge ever built across the Merrimack stood here in 1792. The next one hung from giant iron chains — one of the first suspension bridges in America. The river has knocked a few down since. The name stuck.'
  },
  {
    id: 'tannery-mills', x: 4096, z: 1700, icon: '🏭', title: 'The Mills', year: '1800s',
    body: 'Newburyport made things: combs, shoes, hats — and silver. For a hundred years, Towle silver ended up on wedding tables all across America. The old mill buildings still work for a living; the farmers market moves in every Sunday.'
  },
  {
    id: 'city-hall', x: -1810, z: 160, icon: '🏢', title: 'City Hall', year: '1851',
    body: 'Newburyport decided everything at town meetings until 1851, when it became one of the first cities in Massachusetts. This brick hall has held mayors, hearings, and several legendary arguments about parking. Democracy, in its natural habitat.'
  },
  {
    // Retitled for eight-year-olds: "poltergeist" and "gallows" are hard words, and
    // "escaped the gallows" asks a kid to know what hanging is before the joke lands.
    // The story is the best one in the set — a haunted house that turned out to be a
    // bored teenager — so it needed plainer words, not less of it. The injustice to
    // Elizabeth stays; it is the reason the story matters.
    id: 'morse-poltergeist', x: 64, z: 92, icon: '👻', title: 'The House That Threw Things', year: '1679',
    body: 'In 1679 the Morse house, right by this square, went strange. Pots flew across rooms. Chairs moved on their own. Something banged in the walls at night. The neighbours decided a witch was doing it, and Elizabeth Morse — the grandmother who lived there — was very nearly put to death for something she had not done. Today most historians think they know who it really was: her grandson John, a bored teenager with very good aim. The house went quiet the year he moved out.'
  },
  {
    id: 'inn-street', x: -470, z: 600, icon: '🧱', title: 'The Street That Fought Back', year: '1970s',
    body: 'In the 1960s, the plan was to bulldoze this downtown and pave it for parking. Newburyport said no, and fixed up the old brick instead. Other cities came to copy it. The fountain arrived in 1975; the kids arrived immediately.'
  },
  {
    id: 'joppa', x: 7200, z: 3950, icon: '🦪', title: 'Joppa', year: 'three centuries',
    body: 'The flats off this shore fed the neighborhood for three hundred years — clammers working the tides, selling by the bushel, arguing about greenheads. A little fishing village at the edge of the city, and prouder of these mudflats than downtown will ever understand.'
  },
  {
    id: 'marchs-hill', x: 2130, z: 8960, icon: '🛷', title: 'March’s Hill', year: 'every winter',
    body: 'The town has sledded this hill for as long as anyone’s grandmother can remember — and in a city this old, that is saying something. First snow, school cancelled, hill full by nine.'
  },
  {
    id: 'oak-hill', x: -900, z: 8800, icon: '🌳', title: 'Oak Hill', year: '1842',
    body: 'Back in 1842, a cemetery was also a park — families came here on Sundays to stroll and picnic under the trees. Some of the oldest trees in the city still keep the quiet.'
  },
  {
    id: 'spl-farm', x: 11560, z: 14540, icon: '🚜', title: 'The Stone Manor', year: '1690',
    body: 'The Spencer-Peirce-Little farmhouse went up around 1690 — stone and brick when nearly everything else was wood — and the land around it has been farmed ever since. Three hundred years of harvests, one stubborn, magnificent house.'
  },
  {
    id: 'pink-house', x: 25860, z: 13420, icon: '🩷', title: 'The Pink House', year: '1925–2025',
    body: 'A house alone in the marsh, painted pink, since 1925. Legend says it was built out of spite; everyone agrees it was loved. Painters painted it, photographers chased its light, and when it came down in 2025 the whole region felt it. Some landmarks are buildings. This one was a feeling.',
    stamp: '★ NEVER FORGOTTEN'
  },
  {
    id: 'maudslay', x: -38180, z: -13350, icon: '🌸', title: 'Maudslay', year: '1985',
    body: 'The Moseley family estate: carriage roads, formal gardens, and azaleas above the Merrimack. Massachusetts made it a state park in 1985. Bald eagles winter in the tall pines — look up in January, and bring the binoculars.'
  },
  {
    id: 'mooncusser', x: 33868, z: -4520, icon: '🌙', title: 'The Mooncussers', year: 'no comment',
    body: 'Mooncussers, the story goes, walked these dunes with false lanterns, hoping to lure ships aground for the salvage — and cursed the bright moon for spoiling the trick. No Newburyport mooncusser was ever caught. Make of that what you will.',
    stamp: '★ A LOCAL LEGEND'
  },
  {
    id: 'atkinson', x: -17810, z: -12240, icon: '🏰', title: 'Atkinson Common', year: '1890s',
    body: 'The North End’s green since the 1890s, kept by a society of neighbors who planted the trees and meant it. The fieldstone tower went up in the 1930s. Climbers report an excellent view and a strong sense of accomplishment.'
  }
];
