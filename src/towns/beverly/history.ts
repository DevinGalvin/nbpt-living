import type { Site } from '../../game/history';

// Beverly's discovery markers — 24 true stories at the real spots.
//
// The first six are Indigenous history. Beverly was part of Salem until 1668, so this is
// Naumkeag ground and the research dossier is docs/research/indigenous-salem.md — with
// one fact that belongs to Beverly and Marblehead specifically: the English towns here
// bought their deeds from the sachem's heirs AFTER he was dead.
//
// ⚠️ Beverly and Marblehead both claim to be the birthplace of the American navy, and
// the argument is real and old. Both towns' card sets say so and neither pretends to win.
//
// ⚠️ PLACEMENT: run `node tools/check_markers.mjs beverly` after touching any coordinate.
export const HISTORY: Site[] = [
  // ── Naumkeag ground ───────────────────────────────────────────────────────
  {
    id: 'naumkeag-shore', x: 14789, z: 9827, icon: '🐟', title: 'Before It Was Beverly', year: 'before 1626',
    body: 'This harbor was part of Naumkeag — the name the Pawtucket people gave this whole stretch of coast, usually translated as “the fishing place.” Beverly was not even a separate town yet; that came much later, and it came out of Salem. Whatever you are standing on had a name, and a use, and people who knew it well, for thousands of years before any of the streets here were drawn.',
    stamp: '★ THE FISHING PLACE'
  },
  {
    id: 'the-weirs', x: 19541, z: 6241, icon: '🌊', title: 'A Fence Made of Sticks', year: 'for centuries',
    body: 'The rivers here filled with fish every spring — so many that you could hear them. The Pawtucket built weirs across the shallows: fences of woven sticks that let the water run through and held the fish behind. It is a beautifully lazy idea and it worked for centuries. You do not chase the food. You put the right fence in the right place and wait for the year to come around.',
  },
  {
    id: 'the-emptying', x: -13831, z: -8471, icon: '🕯', title: 'The Land Was Not Empty', year: '1618 and 1633',
    body: 'English settlers wrote that this coast looked open and unused, as though it had been waiting for them. It had not. Sickness carried over on earlier ships swept through in 1618 and again in 1633 and killed more people than anybody counted. The clear fields the newcomers were so glad to find were somebody’s fields. The people who cleared them had been alive not long before.',
    stamp: '★ NOT EMPTY — EMPTIED'
  },
  {
    id: 'paper-title', x: 1224, z: 9214, icon: '📜', title: 'The Deed Bought Too Late', year: '1686',
    body: 'Here is something strange. English towns had been living on this land for sixty years when they suddenly needed to prove they legally owned it. So in 1686 they went and bought deeds — from the grandchildren of the sachem who had held this territory, who by then were living far away in another town. He himself had died two years earlier. Lynn and Reading paid sixteen pounds. The paperwork came sixty years after the moving in.',
    stamp: '★ SIXTY YEARS LATE'
  },
  {
    id: 'the-last-sachem', x: -2907, z: -2694, icon: '🪶', title: 'The Sachem They Waited Out', year: '1616–1684',
    body: 'The man who held this land was Wenepoykin, sachem of Naumkeag, called Sagamore George by the English. He was a child when sickness killed nearly everyone older than him. He fought the English as a grown man, was captured, and was sold across the ocean to Barbados, where he stayed eight years. He got home in 1684 and died that year. The deeds for these towns were bought from his family afterwards.',
  },
  {
    id: 'still-here-bev', x: 2165, z: 6464, icon: '🔥', title: 'Still Here', year: 'right now',
    body: 'Old books put all of this in the past tense, as if the story ended. It did not. Massachusett and Pawtucket descendants are alive in Massachusetts today — some of them not far from this library, which is a good place to go and read about it from people writing in the present tense about themselves.',
    stamp: '★ PRESENT TENSE'
  },

  // ── A town of its own ─────────────────────────────────────────────────────
  {
    id: 'set-off', x: 1559, z: 8146, icon: '✂️', title: 'The Town That Left', year: '1668',
    body: 'For forty years this was just the far side of Salem, and the far side of Salem was tired of rowing across a river to go to church. So in 1668 it split off and became its own town, and named itself after Beverley in Yorkshire, England. Same shore, same people, brand new town. Salem, for the record, was not thrilled about it.',
    stamp: '★ SPLIT FROM SALEM'
  },
  {
    id: 'hale-farm', x: 3901, z: 7917, icon: '🏚', title: 'The Minister Who Changed His Mind', year: '1692',
    body: 'John Hale was Beverly’s minister, and when the witch accusations started two miles away he believed them. He went to the trials. He helped. Then in November someone accused his own wife. She was never arrested — but standing on the other side of it, even for a moment, undid him. He spent the rest of his life writing a book arguing that the whole thing had been a terrible mistake. This was his house.',
    stamp: '★ HE ADMITTED IT'
  },
  {
    id: 'modest-enquiry', x: 3901, z: 8320, icon: '📖', title: 'A Book He Never Saw Printed', year: '1697 · 1702',
    body: 'The book John Hale wrote is called A Modest Enquiry into the Nature of Witchcraft, which is a very polite title for “we were wrong and here is why.” He finished it in 1697. It was not printed until 1702 — two years after he died. He never got to see anybody read it. Admitting a mistake in public is hard enough. He did it knowing he would not be there for the answer.',
  },
  {
    id: 'hannah', x: -3436, z: 15250, icon: '⛵', title: 'The First Ship', year: 'September 5, 1775',
    body: 'There was no American navy yet — the country barely existed. So George Washington hired a fishing schooner, put guns on her, and sent her out to take supplies off British ships. Her name was the Hannah, she was fitted out at a wharf right here, and she sailed from this harbor on the 5th of September, 1775. The entire United States Navy started as one borrowed fishing boat.',
    stamp: '★ ONE BORROWED BOAT'
  },
  {
    id: 'navy-argument', x: -3400, z: 14900, icon: '🥊', title: 'The Argument With Marblehead', year: 'still going',
    body: 'Beverly says it is the birthplace of the American navy, because the Hannah sailed from this harbor. Marblehead says no, because the Hannah was a Marblehead-owned ship and her crew were Marblehead men. Both of those things are true, which is exactly why the argument has lasted two hundred and fifty years and will not be settled by a sign. Pick a side. Everybody here already has.',
    stamp: '★ NOBODY HAS WON'
  },
  {
    id: 'cotton-mill', x: -3116, z: -12446, icon: '🧵', title: 'The First Cotton Mill in America', year: '1787',
    body: 'Before this, cloth was made at home, slowly, by hand, by somebody in your family. In 1787 a group of Beverly men built a mill here to do it with machines instead — the first cotton mill in the whole country, and the biggest of its day. President Washington came to look at it in 1789. Everything the word “factory” means in America starts, awkwardly and not very profitably, right here.',
    stamp: '★ THE FIRST ONE'
  },
  {
    id: 'larcom', x: 6948, z: 8370, icon: '✒️', title: 'The Mill Girl Who Wrote It Down', year: '1824–1893',
    body: 'Lucy Larcom was born in Beverly, and when her father died the family needed money, so at eleven years old she went to work in the Lowell mills. Eleven. She worked there for ten years — and read, and wrote, the whole time. She became a real poet and a teacher, and then she wrote a book about being a child in this town and a girl in those mills, so that nobody could say afterwards that they had not known.',
    stamp: '★ SHE WAS ELEVEN'
  },
  {
    id: 'fish-flake-hill', x: 1415, z: 12863, icon: '🐠', title: 'Why It Is Called Fish Flake Hill', year: '1700s',
    body: 'A “flake” is not a snowflake here. It is a wooden rack, and this whole hillside was covered in them, and on every one of them lay split codfish drying in the sun and the salt wind. Hundreds of racks. You would have smelled this neighbourhood long before you saw it. The fish went out to the Caribbean and Europe and came back as money. The name stuck long after the smell left.',
    stamp: '★ RACKS OF DRYING COD'
  },
  {
    id: 'the-shoe', x: -8177, z: -4827, icon: '👞', title: 'The Shoe', year: '1903',
    body: 'People here called it simply “the Shoe.” It was a factory that did not make shoes — it made the machines that made shoes, for the whole world, and it was so vast that generations of Beverly families all worked in the same building. It had its own clubhouse and its own baseball field. When somebody in this city says a grandparent worked at the Shoe, this is the place they mean.',
  },
  {
    id: 'taft', x: 12694, z: 9549, icon: '🎩', title: 'When Beverly Was the Capital', year: '1909–1912',
    body: 'Washington D.C. in August is unbearable, so President Taft did what anyone would: he left. For four summers he ran the United States from a rented house on this shore, and reporters and officials had to come up here to find him. This park was that estate. For a few weeks each year the most important address in America had a Beverly postmark.',
    stamp: '★ THE SUMMER WHITE HOUSE'
  },
  {
    id: 'cabot-theatre', x: 682, z: 5959, icon: '🎬', title: 'The Movie Palace', year: '1920',
    body: 'When this opened, a film was a genuinely strange new thing and a theatre was built like a palace to match — big, gilded, far grander than the street outside. It survived being old-fashioned, survived nearly closing, and got restored instead of knocked down. Most towns lost theirs. Beverly still has its.',
  },
  {
    id: 'beverly-depot', x: -3593, z: 9509, icon: '🚂', title: 'The Train Changed Everything', year: '1839',
    body: 'Once the railroad reached here, Beverly stopped being only a fishing and farming town. Workers could live in one place and work in another. Rich Bostonians could reach the shore in an afternoon and started building enormous summer houses along it. A whole coastline of mansions exists because of a timetable. Stations do that: they decide what a town is going to become.',
  },
  {
    id: 'gold-coast', x: 35914, z: -1219, icon: '💰', title: 'The Gold Coast', year: 'the 1800s',
    body: 'Out past the middle of town the shore fills up with enormous estates behind long walls — Prides Crossing, Beverly Farms, West Beach. Boston’s wealthiest families summered here, and the joke that stuck is about the little train stop with two ticket prices: Beverly, and Beverly Farms, for people who could afford the extra. It is a joke about money that the people it is about enjoyed telling.',
  },
  {
    id: 'west-beach', x: 49158, z: -2557, icon: '🏖', title: 'The Far End', year: 'now',
    body: 'This is nearly the end of Beverly — a long curve of sand at the very edge of the city, looking out at the same water the fishing weirs stood in. Much of this coast is private, but the sea is not, and the horizon has not changed in ten thousand years. Whatever else got built here, this view is the oldest thing in town.',
  },
  {
    id: 'dane-street', x: 6528, z: 9069, icon: '🏊', title: 'The Beach Everybody Uses', year: 'now',
    body: 'Not the private one, not the estate one — the one at the end of the street that anybody can walk onto. Generations of Beverly kids learned to swim right here, and are still doing it. A town needs at least one place where it does not matter at all who your family is. This is Beverly’s.',
  },
  {
    id: 'beverly-common', x: 3169, z: 6600, icon: '🌳', title: 'The Training Field', year: '1600s',
    body: 'Every town in the colony was required to keep men trained and armed, and every town needed a flat open field to do the drilling on. That is what this green square was for, long before anyone thought of it as pretty. The grass came later. Underneath the nice park is a parade ground.',
  },
  {
    id: 'obear-park', x: -13255, z: 10400, icon: '🔨', title: 'Where the Ships Were Built', year: '1700s–1800s',
    body: 'Beverly did not only sail ships, it built them. Along this shore men laid keels straight onto the beach and put vessels together in the open air, then slid them into the water sideways. No factory, no roof — just deep water, good timber, and people who had done it before. The quiet shoreline you are looking at was once the noisiest part of town.',
  },
  {
    id: 'independence-park', x: 2138, z: 14000, icon: '🎆', title: 'A Park Named for a Feeling', year: 'now',
    body: 'Plenty of places are named after a person who paid for them. This one is named after an idea — the same one the Hannah sailed out of this harbor for, from a town that had already decided once before that it would rather run its own affairs. Beverly has form on this. It left Salem over it.',
  },
];
