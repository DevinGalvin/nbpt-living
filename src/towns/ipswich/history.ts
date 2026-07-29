import type { Site } from '../../game/history';

// Ipswich's discovery markers — 22 true stories at the real spots.
//
// Indigenous cards lead. This is Agawam, and unlike the Naumkeag towns Ipswich has a
// named sagamore with a documented deed, so the cards can be specific. Research notes
// live alongside docs/research/indigenous-salem.md — the same review caveat applies and
// no Indigenous reader has seen these yet.
//
// ⚠️ PLACEMENT: run `node tools/check_markers.mjs ipswich` after touching any coordinate.
export const HISTORY: Site[] = [
  // ── Agawam ────────────────────────────────────────────────────────────────
  {
    id: 'agawam', x: 1165, z: 4891, icon: '🌾', title: 'Agawam', year: 'the name before Ipswich',
    body: 'Before it was Ipswich this was Agawam, and the people who lived here were the Agawam, part of the wider Pawtucket world. The name is usually read as something like “fish-curing place” or “low meadow” — either way it is a name about what the land does, which is how these names generally worked. Nobody named a place after themselves. They named it after what you could get there.',
    stamp: '★ THE NAME CAME FIRST'
  },
  {
    id: 'masconomet', x: 15847, z: -12910, icon: '🪶', title: 'Masconomet', year: 'died 1658',
    body: 'The sagamore — the leader — of the Agawam people was called Masconomet, and unlike most Indigenous leaders around here we know a fair amount about him, because he dealt with the English for nearly thirty years and they wrote it down. He met the first Puritan ships. He kept negotiating long after his people had been devastated by sickness. He is buried on a hill in this town that still carries his title.',
  },
  {
    id: 'the-emptying-ips', x: 8883, z: -35553, icon: '🕯', title: 'The Land Was Not Empty', year: '1616–1619',
    body: 'The English arrived to find good cleared fields and hardly anyone farming them, and decided this was providence. It was not. An epidemic had swept this coast a few years earlier and killed a staggering share of the people living on it. The fields were clear because the people who had cleared them were dead. Masconomet negotiated with the English from a position that sickness, not war, had created.',
    stamp: '★ NOT EMPTY — EMPTIED'
  },
  {
    id: 'twenty-pounds', x: -5462, z: 3302, icon: '📜', title: 'Twenty Pounds', year: '1638',
    body: 'In 1638 Masconomet signed over his people’s claim to this land for twenty pounds. Twenty. For an entire town, its rivers, its marsh and its coast. It was legal, it was signed, and it is impossible to look at that number and call it a fair deal — because the two sides were not in remotely the same position, and both of them knew it. The paperwork was real. The bargain was not.',
    stamp: '★ TWENTY POUNDS'
  },
  {
    id: 'the-great-marsh', x: 30199, z: -40931, icon: '🌾', title: 'The Biggest Marsh in New England', year: 'always',
    body: 'This enormous salt marsh is the largest in New England, and it has been feeding people for thousands of years — shellfish, fish, birds, and grass that could be cut for hay. The Agawam knew every creek in it. So did the English, later, who cut salt hay out here for two centuries. It looks like empty grass. It is one of the richest places on this coast, and it always has been.',
  },
  {
    id: 'still-here-ips', x: 3501, z: -1460, icon: '🔥', title: 'Still Here', year: 'right now',
    body: 'Masconomet died in 1658 and the books mostly stop there, as if that were the end of the story. It was not. Indigenous people are alive in Massachusetts right now, including descendants of the peoples who lived along this coast. The right tense is the present one. A library is a good place to go and find writers using it.',
    stamp: '★ PRESENT TENSE'
  },

  // ── The town that said no ─────────────────────────────────────────────────
  {
    id: 'the-tax', x: 3498, z: -2320, icon: '💰', title: 'A Tax Nobody Voted For', year: 'March 1687',
    body: 'A governor named Andros was sent to run New England, and he decided to raise money: twenty pence for every man, and a penny on the pound of whatever you owned. Small amounts. That was not the problem. The problem was that nobody had voted on it — no assembly, no town meeting, no say at all. In Ipswich, that turned out to be the wrong thing to try.',
  },
  {
    id: 'john-wise', x: 4681, z: -128, icon: '✊', title: 'The Minister Who Said No', year: 'August 22, 1687',
    body: 'On the twenty-second of August, 1687, the town met and their minister John Wise stood up and said the tax was illegal, because no assembly of theirs had agreed to it — and that being taxed without a say was not a small thing, it was the whole thing. The town voted to refuse. A small farming town on a marsh decided it would not pay, and said out loud exactly why.',
    stamp: '★ THE TOWN VOTED NO'
  },
  {
    id: 'wise-jailed', x: 2944, z: 746, icon: '⛓', title: 'What It Cost Him', year: '1687',
    body: 'Saying no was not free. Wise and the other leaders were arrested, hauled down to Boston, put on trial, thrown in jail, and fined an amount that hurt. He lost his right to preach for a while. He did not take it back. Eighty-nine years before the Declaration of Independence, a minister from this town went to prison over the principle that later got printed on everything.',
    stamp: '★ HE WENT TO JAIL'
  },
  {
    id: 'birthplace', x: 5335, z: -483, icon: '🦪', title: 'Why the Signs Say Birthplace', year: '1687',
    body: 'Ipswich calls itself the Birthplace of American Independence, and people from elsewhere tend to roll their eyes. But the argument is decent: the exact idea that started the Revolution — that you cannot be taxed by people you did not elect — was argued here, voted on here, and paid for with jail time here, in 1687. Boston got the tea party. Ipswich got there first, and got there quieter.',
    stamp: '★ EIGHTY-NINE YEARS EARLY'
  },

  // ── The town itself ───────────────────────────────────────────────────────
  {
    id: 'first-period', x: 3314, z: 2400, icon: '🏘', title: 'The Oldest Street in America', year: 'the 1600s',
    body: 'Here is a genuinely strange fact about this ordinary-looking town: Ipswich has more houses still standing from the 1600s than anywhere else in the United States. Not a museum row — actual houses, with people living in them, that were built when this was a frontier. Ipswich stayed small and poor for a long stretch, and the reward for that is that nobody ever knocked them down.',
    stamp: '★ MORE THAN ANYWHERE'
  },
  {
    id: 'whipple-house', x: 3314, z: 2091, icon: '🏚', title: 'A House From 1677', year: '1677',
    body: 'This house went up fifteen years before the Salem witch trials. Think about what that means: the people who built it did not know the trials were coming, did not know there would be a Revolution, did not know there would be a United States. They just wanted a solid house. It is still here, and every single thing that has happened in American history happened after it was finished.',
  },
  {
    id: 'choate-bridge', x: 2476, z: -718, icon: '🌉', title: 'The Stone Bridge', year: '1764',
    body: 'Two stone arches over the river, built in 1764 — before the Revolution — and still carrying traffic today. People argued it would fall down, because nobody in the colony had built a stone arch bridge like it before. It did not fall down. It has been standing for more than two hundred and sixty years, which is a very long argument to win.',
    stamp: '★ STILL CARRYING CARS'
  },
  {
    id: 'first-church', x: 3478, z: -2100, icon: '⛪', title: 'The Meetinghouse', year: 'since 1634',
    body: 'A church has stood on this spot since the town began, and the building you see is not the first one — congregations here have rebuilt after fire and time more than once. The meetinghouse mattered for a reason beyond religion: it was where the town met. When Ipswich voted to refuse the governor’s tax in 1687, it did it in the building that stood here.',
  },
  {
    id: 'great-house', x: 40597, z: -5553, icon: '🏰', title: 'The House on the Hill', year: '1928',
    body: 'A plumbing millionaire from Chicago built this enormous English-style house on the best hill in Ipswich, with a half-mile of lawn running down toward the sea. It is not old — it is younger than cars — but it is spectacular, and the family eventually handed the whole thing, the hill, the beach and the marsh, to the public. The view down that lawn is the payoff.',
  },
  {
    id: 'crane-beach', x: 57485, z: -5090, icon: '🏖', title: 'Four Miles of Sand', year: 'now',
    body: 'Four miles of it, backed by dunes that move a little every year, with the Great Marsh behind and open Atlantic in front. Piping plovers nest here, which is why parts get roped off every summer — a bird that lays its eggs in an open scrape on the sand needs the help. It is one of the best beaches in New England and it is public. That was a decision somebody made.',
    stamp: '★ FOUR MILES'
  },
  {
    id: 'steep-hill', x: 38497, z: -11059, icon: '⛰', title: 'The Walk Over the Hill', year: 'now',
    body: 'You have to climb to get to this one, which keeps it quieter than the long beach round the corner. From the top you can see the marsh, the river mouth, the dunes and the sea all at once — the entire geography of Ipswich in a single turn of your head. It is the best short walk in town and most visitors never find it.',
  },
  {
    id: 'clam-box', x: -16800, z: -14930, icon: '🍟', title: 'A Building Shaped Like Its Dinner', year: '1938',
    body: 'It is a restaurant built in the actual shape of a fried clam box — the little cardboard container with flared sides. Somebody in 1938 thought that was a good idea, and they were completely right, because people have been driving out of their way to photograph it ever since. Ipswich clams are famous. This is the only building that looks like the packaging.',
    stamp: '★ IT IS THE BOX'
  },
  {
    id: 'ipswich-clams', x: -11849, z: -12601, icon: '🦪', title: 'Why the Clams Are Famous', year: 'always',
    body: 'Ipswich clams are a genuinely big deal, and the reason is the mud. The Great Marsh and these tidal flats make exactly the conditions a soft-shell clam wants, and clam-digging has been a real job here for centuries — Indigenous people first, then everybody after. Diggers still go out with a rake and a bucket at low tide. It is one of the oldest jobs in Massachusetts.',
  },
  {
    id: 'dow-house', x: 6884, z: -568, icon: '🎨', title: 'The Teacher Behind the Painter', year: '1857–1922',
    body: 'Arthur Wesley Dow grew up in Ipswich, painted its marshes over and over, and then did something bigger: he worked out a new way of teaching art — about shape and space and balance rather than copying things exactly — and taught it to a generation. One of his students was Georgia O’Keeffe. You can see this marsh in what she went on to do.',
  },
  {
    id: 'ipswich-lace', x: 3293, z: 1518, icon: '🧶', title: 'The Lace Town', year: 'the 1700s',
    body: 'Long before factories, hundreds of women and girls in this town made lace by hand, at home, with bobbins and pins — and Ipswich became the lace-making centre of America. It was proper skilled work and it was proper money, earned by people who were not otherwise allowed to earn much. The machines eventually did it faster. For a while, the best in the country came from here.',
  },
  {
    id: 'town-green', x: 3457, z: 2527, icon: '🌳', title: 'The Green', year: 'since 1634',
    body: 'Every New England town has one of these, and they are all older than they look. A green was not decoration — it was where animals grazed, where the militia drilled, and where everybody in town ended up standing whenever something happened. If you want to know where the middle of a town is, do not look for the biggest building. Look for the grass.',
  },
];
