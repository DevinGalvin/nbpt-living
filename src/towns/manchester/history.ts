import type { Site } from '../../game/history';

// Manchester-by-the-Sea's discovery markers — 15 true stories at the real spots.
//
// Indigenous cards lead. Manchester was part of Salem until 1645, so this is Naumkeag
// ground and the dossier is docs/research/indigenous-salem.md, with the same review
// caveat: no Indigenous reader has seen these yet.
//
// ⚠️ Richard Henry Dana is a NAME TRAP. The Dana who summered here and helped make this
// a resort was the poet and essayist (the elder); his son wrote Two Years Before the
// Mast. The card credits the family and the summer colony and does NOT attribute the
// book, because the sources here do not cleanly support it.
//
// ⚠️ PLACEMENT: run `node tools/check_markers.mjs manchester` after touching any coordinate.
export const HISTORY: Site[] = [
  {
    id: 'before-jeffreys', x: 14972, z: 2104, icon: '🐚', title: 'Before Anyone Named It', year: 'thousands of years',
    body: 'Small coves like this one, tucked between rocky points, were exactly what people wanted long before any English boat arrived. Shelter, shellfish, a place to pull a canoe up. The Massachusett and Pawtucket peoples worked this shore for thousands of years. The town here is not quite four hundred years old. The reasons to be here are far older than that.',
  },
  {
    id: 'the-emptying-man', x: -10030, z: -15925, icon: '🕯', title: 'The Land Was Not Empty', year: '1616–1633',
    body: 'The English who settled this coast wrote that it seemed strangely open. It was — very recently. Sickness carried on earlier ships had swept through and killed an enormous share of the people living here, twice, within about fifteen years. Every "empty" shore on this coast is a place where something terrible happened just before the newcomers arrived to admire the view.',
    stamp: '★ NOT EMPTY — EMPTIED'
  },
  {
    id: 'shell-heaps', x: -15542, z: 9182, icon: '🦪', title: 'The Oldest Rubbish Heaps', year: 'for centuries',
    body: 'Along creeks like this one, archaeologists find middens — great piles of shells left where people ate. They are basically ancient rubbish heaps, and they are treasure, because a rubbish heap tells you exactly what people did over and over for hundreds of years. Not what somebody wrote down about them afterwards. What they actually ate, and when, and where.',
  },
  {
    id: 'naumkeag-edge', x: -6961, z: -7206, icon: '🪶', title: 'The Edge of Naumkeag', year: 'before 1645',
    body: 'This shore sat in the territory the English called Naumkeag, held by the Pawtucket people under Nanepashemet and, after him, his widow and their sons. Their youngest, Wenepoykin, was the last sachem of Naumkeag — a child leader who grew up, fought the English, was sold to Barbados for eight years, and made it home in 1684 to die at home.',
  },
  {
    id: 'still-here-man', x: -1567, z: 1000, icon: '🔥', title: 'Still Here', year: 'right now',
    body: 'Books about this coast tend to put Indigenous people entirely in the past tense, which is simply wrong. Massachusett and Pawtucket descendants live in Massachusetts today. If you look this up, look for things written recently, by them — not only the old town histories, which are useful for dates and terrible at people.',
    stamp: '★ PRESENT TENSE'
  },

  {
    id: 'jeffreys-creek', x: -283, z: 2742, icon: '🪝', title: 'Jeffrey’s Creek', year: '1628',
    body: 'The first English name for this place was Jeffrey’s Creek, after William Jeffery, who settled on it. It was a piece of Salem then — a handful of houses at the head of a good little harbor. In 1645 it split off and became its own town with a new name. The creek is still here. So, for four hundred years, is the reason anyone stopped: it is a safe place to keep a boat.',
  },
  {
    id: 'by-the-sea', x: -2130, z: 1147, icon: '🌊', title: 'Why the Name Is So Long', year: '1989',
    body: 'It is a mouthful, and there is a reason. Summer visitors in the 1800s started tacking “by-the-Sea” on to sound elegant, and it stuck as a nickname. Then in 1989 the town made it official — partly for the charm, mostly so that post, parcels and confused drivers would stop ending up in Manchester, New Hampshire. A whole town renamed itself over a mix-up.',
    stamp: '★ BLAME NEW HAMPSHIRE'
  },
  {
    id: 'singing-beach', x: 5987, z: 5687, icon: '🎵', title: 'The Sand That Squeaks', year: 'always',
    body: 'Walk on this sand when it is dry and it squeaks — a real, clear noise under your feet, like rubbing a balloon. Only a handful of beaches on the whole planet do it. It needs three things at once: grains that are almost perfectly round, all almost exactly the same size, and clean. Rub those against each other and they all slip together instead of separately. That is the sound.',
    stamp: '★ TRY IT WITH DRY SAND'
  },
  {
    id: 'musical-beach', x: 6100, z: 5900, icon: '🎼', title: 'It Used to Be Called Musical', year: 'the 1800s',
    body: 'Before it was Singing Beach it was Musical Beach, which is what the summer people called it when they started coming out here in the middle of the 1800s. Same sand, same squeak, slightly grander name. Sometimes the only thing that changes about a place over two centuries is what people think sounds best on a postcard.',
  },
  {
    id: 'summer-colony', x: 29479, z: -1888, icon: '🎩', title: 'When Boston Moved In for August', year: 'the 1800s',
    body: 'Once the railroad reached this coast, wealthy Boston families started building enormous summer houses along it, and a quiet fishing and farming town became a resort every July. Writers came too, and wrote about it, which brought more people. Much of this shore is still private because of decisions made in that period — and some of the very best of it, like this reservation, was eventually given away to everybody.',
  },
  {
    id: 'ocean-lawn', x: 29600, z: -2100, icon: '🌾', title: 'A Lawn That Runs Into the Sea', year: 'now',
    body: 'A great open field of grass, ending in rocks and then the Atlantic — no fence, no building, nothing to buy. It looks like it has always been public. It has not: this was a private estate, and it is open because a family decided it should be, and gave it away. A view like this staying free is a choice somebody made on purpose.',
  },
  {
    id: 'tucks-point', x: -6864, z: 7323, icon: '⛱', title: 'The Round House on the Point', year: '1890s',
    body: 'Out at the end of this point is an open-sided round pavilion with a roof and no walls, put up so people could sit in the shade, look at the harbor and eat chowder. That is its entire purpose and it has been doing it for well over a century. Towns do not build many things whose only job is to be a pleasant place to sit. This one did.',
  },
  {
    id: 'cemetery-1661', x: 1326, z: -32, icon: '🪦', title: 'The Oldest Ground in Town', year: '1661',
    body: 'People have been buried on this spot since 1661 — sixteen years after Manchester became a town, and thirty-one years before the witch trials. The oldest stones are thin slate, and if you look closely the carvings change over the centuries: grim winged skulls first, then softer faces, then willows and urns. You can watch a town’s mind change just by reading the stones in order.',
    stamp: '★ READ THEM IN ORDER'
  },
  {
    id: 'first-parish-man', x: -1814, z: 932, icon: '⛪', title: 'The Meetinghouse', year: 'since 1645',
    body: 'When a New England town was founded, the first thing it argued about was the meetinghouse — where to put it, who would preach, who paid. It was the church, but it was also the town hall, the courtroom and the noticeboard. Every decision Manchester made for its first two centuries was made in a building on or near this spot, by people standing up and arguing.',
  },
  {
    id: 'crow-island', x: 22319, z: -988, icon: '🏝', title: 'The Island Off the Beach', year: 'now',
    body: 'A low green island sitting just offshore, close enough to look reachable and far enough to be a genuinely bad idea to swim to. Islands like this one are why this coast is full of shipwreck stories: they are lovely in July and lethal in a November gale, and they do not move out of the way. Look at it from here. That is the correct distance.',
  },
];
