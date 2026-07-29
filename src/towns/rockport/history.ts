import type { Site } from '../../game/history';

// Rockport's discovery markers — 17 true stories at the real spots.
//
// Indigenous cards lead. Cape Ann is Agawam/Pawtucket country and Gloucester's set
// carries the fuller account (Wanaskwiwam, the middens, Masconomet); Rockport's four are
// shore-specific and deliberately do not over-claim about this end of the cape, where the
// documentary record is thin. Same review caveat as everywhere: not yet read by an
// Indigenous reviewer.
//
// ⚠️ Bearskin Neck's name is LOCAL LEGEND, not documented fact. The card says so.
//
// ⚠️ PLACEMENT: run `node tools/check_markers.mjs rockport` after touching any coordinate.
export const HISTORY: Site[] = [
  {
    id: 'before-sandy-bay', x: -753, z: -2621, icon: '🐚', title: 'Before Anyone Quarried It', year: 'thousands of years',
    body: 'The tip of Cape Ann is granite and sea and not much soil, so nobody built a big village out here — but people came, for thousands of years, because the fishing is superb and the shore is full of shellfish. Indigenous people worked this coast long before a single stone was cut out of it. The rock everyone later got rich on was just the thing you walked over.',
  },
  {
    id: 'the-emptying-rkp', x: 1882, z: 5535, icon: '🕯', title: 'The Land Was Not Empty', year: '1616–1633',
    body: 'English settlers described this coast as strangely quiet and open, and took that as an invitation. It was not. Sickness brought over on earlier ships swept through twice in about fifteen years and killed an enormous share of the people who lived here. The quiet was recent, and it was the worst thing that had ever happened on this shore.',
    stamp: '★ NOT EMPTY — EMPTIED'
  },
  {
    id: 'the-cape-people', x: 11764, z: 18189, icon: '🪶', title: 'The People of the Cape', year: 'before 1623',
    body: 'Cape Ann had its own Indigenous name and its own people, connected to the Agawam of Ipswich and the Pawtucket beyond them. They moved with the seasons — the shore in warm months for fish and clams, inland in winter for shelter and hunting. That is not wandering. That is a plan, worked out over a very long time, for getting the best out of a hard coast.',
  },
  {
    id: 'still-here-rkp', x: 1443, z: -1393, icon: '🔥', title: 'Still Here', year: 'right now',
    body: 'Local histories tend to mention Indigenous people once, in the first chapter, in the past tense, and then never again. That is a storytelling choice, not a fact. Their descendants live in Massachusetts today. A library is exactly the right place to go and find books written by them, now, about themselves.',
    stamp: '★ PRESENT TENSE'
  },

  {
    id: 'thacher-wreck', x: 27797, z: 17416, icon: '🌊', title: 'The Island Named for a Shipwreck', year: '1635',
    body: 'In a terrible storm in 1635 a ship broke apart on the rocks out there. Anthony Thacher and his wife were washed ashore alive on the island. Their four children were not. The colony later gave him the island — as if that were any kind of payment — and it has carried his name ever since. Every place name is somebody’s story. This one is the worst day of a man’s life, printed on a map forever.',
    stamp: '★ NAMED FOR THE WORST DAY'
  },
  {
    id: 'twin-lights', x: 29571, z: 15397, icon: '🔦', title: 'Two Lights, Not One', year: '1771',
    body: 'Almost every lighthouse stands alone. This island has two, side by side, and that was deliberate: from a ship, one light could be any light, but two lights lined up in a row could only be here. It is a code made of buildings. These are the last working twin lights in the United States — everywhere else, the second tower eventually got knocked down.',
    stamp: '★ THE LAST TWINS'
  },
  {
    id: 'sandy-bay', x: 415, z: -640, icon: '✂️', title: 'Leaving Gloucester', year: '1840',
    body: 'This end of the cape was called Sandy Bay and it was the far corner of Gloucester — miles from the town meeting, with its own harbor, its own fishermen and its own opinions. In 1840 it split off and named itself Rockport, which is not exactly poetry but is completely honest: a port, made of rock, shipping rock.',
  },
  {
    id: 'granite', x: -6086, z: -9300, icon: '🪨', title: 'The Town That Was Shipped Away', year: 'the 1800s',
    body: 'Rockport granite is superb stone, and for a century it was cut out of these hills and sent everywhere — bridges, banks, breakwaters, public buildings in cities that have never heard of this town. Think about that: pieces of Rockport are standing up in other places all over the country. The town literally exported itself, block by block.',
    stamp: '★ SHIPPED, BLOCK BY BLOCK'
  },
  {
    id: 'the-quarries', x: -5816, z: -14614, icon: '💧', title: 'The Holes Filled Up', year: 'now',
    body: 'When the granite business ended, the quarries stopped being pumped out — and rain and springs did the rest. Now they are deep green ponds in the woods, straight-sided, startlingly cold, with the drill marks still visible down the walls. They are beautiful and they are genuinely dangerous: no shallow end, no gradual bottom. Just a straight drop where a hillside used to be.',
  },
  {
    id: 'hannah-jumper', x: 2053, z: -2288, icon: '🪓', title: 'Two Hundred Women With Hatchets', year: 'July 8, 1856',
    body: 'Rockport had a drinking problem and the men who ran the town were not going to fix it. So on the 8th of July, 1856, about two hundred women met in this square with hatchets hidden under their shawls. They had already crept round at night marking the buildings with small white crosses. Then they walked in and smashed every barrel they could find. Their leader, Hannah Jumper, was seventy-five years old.',
    stamp: '★ SHE WAS 75'
  },
  {
    id: 'dry-town', x: 466, z: -1575, icon: '🚫', title: 'A Hundred and Forty-Nine Years Dry', year: '1856–2005',
    body: 'The hatchet raid worked, and it kept working for an extraordinarily long time. Rockport voted to stay dry — no alcohol sold anywhere in town — and stayed that way until a referendum in 2005. That is a hundred and forty-nine years. Whatever else you think about it, one afternoon organised by women who were not allowed to vote shaped this town for a century and a half.',
    stamp: '★ 149 YEARS'
  },
  {
    id: 'motif', x: 3249, z: -2939, icon: '🎨', title: 'The Most Painted Building in America', year: 'since the 1880s',
    body: 'It is a red fish shack on a wharf. That is all it is. But artists started coming to Rockport in the 1800s, and this particular shed — red, simple, sitting on the water with boats in front of it — turned out to be the perfect thing to paint. So many students painted it that their teachers started groaning “not that motif again,” and the name stuck. It is called Motif No. 1 because it was a joke.',
    stamp: '★ THE NAME IS A JOKE'
  },
  {
    id: 'motif-blizzard', x: 3316, z: -2656, icon: '❄️', title: 'The Day It Fell In', year: 'February 1978',
    body: 'A colossal blizzard hit this coast in 1978 and the sea took the most painted building in America apart. It was gone. And the town, which could easily have decided that was that, rebuilt it — the same shape, the same red, in the same spot, within months. It is technically a copy. Nobody here cares even slightly, and they are right not to.',
    stamp: '★ THEY BUILT IT AGAIN'
  },
  {
    id: 'bearskin-neck', x: 2954, z: -3390, icon: '🐻', title: 'About That Name', year: 'the story goes',
    body: 'This narrow strip of shops and shacks running out into the harbor is called Bearskin Neck, and the story people tell is that a bear was once caught out here by the tide and skinned on the rocks. Is that true? Nobody can prove it. It is a local legend, repeated for a very long time — which is its own kind of fact, just not the kind you can check.',
  },
  {
    id: 'paper-house', x: -2316, z: -16554, icon: '📰', title: 'A House Made of Newspaper', year: '1922–1924',
    body: 'A man named Elis Stenman decided to build a summer house with walls made of newspaper. Not covered in it — made of it, layer after layer, varnished hard. Then he made the furniture out of newspaper too. Around a hundred thousand papers went into it, and you can still stand inside and read the headlines in the walls. It has been there for a century. It has not blown away.',
    stamp: '★ 100,000 NEWSPAPERS'
  },
  {
    id: 'halibut-point', x: -7257, z: -27568, icon: '⛰', title: 'The Corner of Massachusetts', year: 'now',
    body: 'This is very nearly the northeast corner of the state — a flooded quarry on one side, open Atlantic on the other, and on a clear day you can see all the way up the coast to New Hampshire and Maine. The name has nothing to do with the fish: sailors called it “haul about point,” because it is where you had to swing the boat around. Say that fast enough and it becomes a halibut.',
    stamp: '★ HAUL ABOUT, NOT HALIBUT'
  },
  {
    id: 'straitsmouth', x: 18877, z: -3657, icon: '🏝', title: 'The Little Light Offshore', year: '1835',
    body: 'A small island just off the shore with a small lighthouse on it, guarding the narrow gap between the island and the mainland — which is exactly what “straits mouth” means. It is a nesting ground for seabirds now. Look at the water between here and there and imagine finding that gap at night, in weather, in a wooden boat. That is why there is a light on it.',
  },
];
