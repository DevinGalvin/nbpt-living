import type { Site } from '../../game/history';

// Boston's discovery markers — 38 true stories at the real spots.
//
// The largest set, for the largest map. Three deliberate decisions about balance:
//
//   1. Indigenous cards lead, and Deer Island is in them. In the winter of 1675–76 the
//      colony interned hundreds of Christian Massachusett and Nipmuc people on that
//      island with almost no food or shelter, and roughly half of them died. It is a
//      short walk from the Freedom Trail and almost nobody is told about it. Dossier:
//      docs/research/indigenous-salem.md for the sachem lineage; the Deer Island facts
//      are sourced separately (NPS, Mass Humanities, MA Commission on Indian Affairs).
//   2. The Freedom Trail cards do NOT get a clean run. Faneuil Hall is "the cradle of
//      liberty" AND was paid for by a man who traded enslaved people; both cards exist,
//      next to each other, because leaving either one out is the dishonest version.
//   3. Black Boston is a section, not a footnote — the African Meeting House, the 54th,
//      Garrison, and 1974. Those last two are handled plainly and without heroics.
//
// ⚠️ Apostrophes must be the curly ’ — a straight ' terminates the single-quoted body.
//
// ⚠️ PLACEMENT: run `node tools/check_markers.mjs boston` after touching any coordinate.
export const HISTORY: Site[] = [
  // ── Shawmut ───────────────────────────────────────────────────────────────
  {
    id: 'shawmut', x: -6296, z: -6631, icon: '🌊', title: 'Shawmut', year: 'the name before Boston',
    body: 'Boston was a hilly little peninsula hanging off the mainland by a neck so thin the sea nearly met in the middle, and its name was Shawmut. Fresh springs, good fishing, high ground to see from. The English took it in 1630 for the water. Everything since — the filling in, the flattening of the hills, the millions of people — has happened on top of a name most Bostonians have never heard.',
    stamp: '★ THE NAME CAME FIRST'
  },
  {
    id: 'the-emptying-bos', x: 49772, z: 26750, icon: '🕯', title: 'The Land Was Not Empty', year: '1616–1633',
    body: 'The settlers who founded Boston wrote about how conveniently empty the land was. Sickness carried from earlier European ships had swept this coast twice within about fifteen years and killed a devastating share of the people who lived on it. The colony was founded in a graveyard it did not dig. This is the most important sentence in New England history and it is the one most often skipped.',
    stamp: '★ NOT EMPTY — EMPTIED'
  },
  {
    id: 'massachusett-land', x: -20860, z: 47788, icon: '👑', title: 'Whose Land This Was', year: 'before 1630',
    body: 'The Massachusett people held this harbor and the country around it, led by the sachem Nanepashemet and, after he died in 1619, by his widow — whom English records name only by a title, never by her own name. The whole state is named after these people. Massachusetts means, roughly, "at the great hill." It is their word. It is on every letter anyone here has ever posted.',
    stamp: '★ THE STATE HAS THEIR NAME'
  },
  {
    id: 'praying-towns', x: -37883, z: 33214, icon: '🙏', title: 'The Praying Towns', year: 'from 1651',
    body: 'The colony set up villages where Indigenous people who converted to Christianity were expected to live — English clothes, English houses, English rules. They were called praying towns. Thousands of people made that bargain, some out of belief and some because it looked like the safest thing available. It is worth remembering what they were promised, because of what happened next.',
  },
  {
    id: 'deer-island', x: 67498, z: 1991, icon: '❄️', title: 'The Winter on Deer Island', year: '1675–1676',
    body: 'When war broke out in 1675, the colony decided that even the Christian Indigenous people who had done everything asked of them could not be trusted. In October it ordered them removed. By December more than five hundred were confined on this island, with almost no food and almost no shelter, for a New England winter. About half of them died. The survivors were let go in May. They had not done anything.',
    stamp: '★ ABOUT HALF DIED'
  },
  {
    id: 'still-here-bos', x: -15699, z: 56822, icon: '🔥', title: 'Still Here', year: 'right now',
    body: 'The Massachusett did not vanish, and the tribe keeps and tells its own history today — which is a different and better thing than a history written about them. If a book tells you these people are gone, the book is wrong, and you should go and find what they publish about themselves instead. The state is still named after them. So is the harbor you are looking at.',
    stamp: '★ PRESENT TENSE'
  },

  // ── The colony ────────────────────────────────────────────────────────────
  {
    id: 'boston-common', x: -2403, z: 1207, icon: '🌳', title: 'The Oldest Park in America', year: '1634',
    body: 'Bought by the town in 1634 as a place to graze cows and drill soldiers, and never built on since. That makes this the oldest public park in the United States — older than the country by a hundred and forty-two years. Cows were still legally grazing here in the 1800s. Every protest, every riot, every celebration and every ordinary afternoon in this city has happened on this grass.',
    stamp: '★ OLDER THAN THE COUNTRY'
  },
  {
    id: 'mary-dyer', x: -2403, z: 1620, icon: '🕊', title: 'Hanged for Coming Back', year: '1660',
    body: 'Mary Dyer was a Quaker at a time when Massachusetts had made that illegal. She was banished, and came back. Banished again, and came back again — because she thought a law that banned her beliefs should be broken in public. They hanged her on this Common in 1660. There is a statue of her outside the State House now, put up by the same state that killed her.',
    stamp: '★ SHE KEPT COMING BACK'
  },
  {
    id: 'anne-hutchinson', x: -1116, z: -1849, icon: '🗣', title: 'The Woman Who Argued Back', year: '1638',
    body: 'Anne Hutchinson held meetings in her own house to discuss the week’s sermons, and disagreed with the ministers — publicly, and better than they did. She was put on trial, and outargued the whole court for two days before they banished her anyway. Her real crime was being a woman who would not stop talking. There is a statue of her here too. It took three hundred years.',
  },
  {
    id: 'boston-latin', x: -14766, z: 15308, icon: '📚', title: 'The Oldest School in America', year: '1635',
    body: 'Boston Latin School opened in 1635, which makes it the oldest public school still running in the United States — a year older than Harvard, and it has outlived the colony, the empire and several centuries of educational fashion. Five signers of the Declaration of Independence went here. Benjamin Franklin went here and did not finish, which every student since has enjoyed pointing out.',
    stamp: '★ FRANKLIN DROPPED OUT'
  },
  {
    id: 'massacre', x: 3369, z: -2022, icon: '❄️', title: 'Five Men on a Cold Night', year: 'March 5, 1770',
    body: 'A crowd threw snowballs and worse at British soldiers outside this building; the soldiers fired; five men died. It was a street fight that got out of hand, and it was immediately turned into propaganda by both sides. The first man killed was Crispus Attucks, a sailor of African and Native ancestry who had escaped slavery twenty years earlier. He is often called the first man to die for American independence.',
    stamp: '★ ATTUCKS DIED FIRST'
  },
  {
    id: 'granary', x: 512, z: -836, icon: '🪦', title: 'Who Is Actually In Here', year: 'since 1660',
    body: 'Three signers of the Declaration, the five men killed in the Massacre, Paul Revere, and Benjamin Franklin’s parents — though not Franklin, who is in Philadelphia. It is a very small patch of ground for that much history. Also worth knowing: the gravestones were rearranged into tidy rows later, so most of the stones are not standing over the person they name.',
    stamp: '★ THE STONES WERE MOVED'
  },
  {
    id: 'old-south', x: 2661, z: -417, icon: '🗣', title: 'The Meeting That Ended in the Harbor', year: 'December 16, 1773',
    body: 'Five thousand people packed into this meetinghouse — more than could possibly fit — to argue about a shipment of tea. When word came back that the governor would not let the ships leave, Samuel Adams said the meeting could do nothing more to save the country. That was the signal. People walked out of this building and down to the water.',
  },
  {
    id: 'tea-party', x: 7384, z: -584, icon: '🫖', title: 'Three Hundred and Forty Chests', year: 'December 16, 1773',
    body: 'They boarded three ships, roughly disguised, and spent three hours methodically breaking open chests of tea and tipping them into the harbor. Three hundred and forty of them. They damaged almost nothing else and swept the decks afterwards — the point was the tea, not a riot. It was so much tea that it piled up in the shallows and had to be beaten down with oars.',
    stamp: '★ THEY SWEPT UP AFTER'
  },
  {
    id: 'old-north', x: 5372, z: -8791, icon: '🕯', title: 'Two Lanterns', year: 'April 18, 1775',
    body: 'One if by land, two if by sea. Two lanterns were hung in this steeple for about a minute — long enough to be seen across the water and not long enough to get the men holding them arrested. It was a backup plan in case the riders were stopped. That is what the most famous signal in American history actually was: a spare copy of a message, in case the first one failed.',
    stamp: '★ IT WAS THE BACKUP PLAN'
  },
  {
    id: 'paul-revere-house', x: 5854, z: -6524, icon: '🏚', title: 'The Oldest House Downtown', year: 'about 1680',
    body: 'This small dark wooden house is the oldest building left in downtown Boston, and Paul Revere owned it when he made his ride. Everything around it has been knocked down and rebuilt many times over. It survived by being unfashionable and cheap — at one point it was a cigar factory and a greengrocer. Buildings usually survive by accident, not by being loved.',
  },
  {
    id: 'faneuil-hall', x: 4124, z: -3125, icon: '🦗', title: 'The Cradle of Liberty', year: '1743',
    body: 'A market downstairs, a meeting hall upstairs, and in that hall people argued their way toward a revolution — and kept using it afterwards for two hundred and fifty years of arguing about everything else. There is a giant golden grasshopper on the roof as a weathervane, for no reason anybody can fully explain, and it has been up there since 1742.',
    stamp: '★ CHECK THE GRASSHOPPER'
  },
  {
    id: 'faneuil-slavery', x: 4940, z: -3514, icon: '⛓', title: 'Who Paid For It', year: '1743',
    body: 'The hall was a gift to the town from Peter Faneuil, a rich merchant — and a large part of what made him rich was trading enslaved people. Both things are true at once: a building where liberty was argued about, paid for with the profits of taking it away. Boston has argued for years about whether to change the name. The useful thing is not the name. It is knowing.',
    stamp: '★ BOTH THINGS ARE TRUE'
  },
  {
    id: 'copps-hill', x: 4273, z: -9725, icon: '⚓', title: 'The Burying Ground With Bullet Marks', year: '1659',
    body: 'British soldiers used this hilltop to fire on Charlestown during the Battle of Bunker Hill, and used the gravestones for target practice while they waited — you can still find the chips. Also buried here: thousands of Black Bostonians from the nearby neighbourhood known as New Guinea, most in graves that were never marked at all.',
  },

  // ── Black Boston ──────────────────────────────────────────────────────────
  {
    id: 'african-meeting', x: -1964, z: -3056, icon: '⛪', title: 'The Oldest Black Church Building', year: '1806',
    body: 'Built in 1806 by Boston’s Black community, largely with their own hands and their own money, this is the oldest Black church building still standing in the United States. It was never only a church: it was a school, a meeting hall, and the room where the anti-slavery movement in this city organised. Frederick Douglass spoke here. They called it the African Meeting House.',
    stamp: '★ THE OLDEST STILL STANDING'
  },
  {
    id: 'shaw-54th', x: -952, z: -1416, icon: '🥁', title: 'The 54th Massachusetts', year: '1863',
    body: 'The 54th was one of the first Black regiments in the Union army, and it marched down this street to war in 1863 past enormous crowds. Its men were offered less pay than white soldiers and refused to take any at all until it was equal — for eighteen months. The bronze relief here shows them walking, and it is one of the great pieces of American sculpture. Look at the faces. They are individuals.',
    stamp: '★ THEY REFUSED THE PAY'
  },
  {
    id: 'garrison', x: -11314, z: 11514, icon: '📰', title: 'I Will Be Heard', year: '1831',
    body: 'William Lloyd Garrison started an anti-slavery newspaper in Boston in 1831 and announced that he would not be moderate, would not excuse anything, and would not shut up: "I am in earnest — I will not equivocate — I will not retreat a single inch — and I will be heard." A mob dragged him through these streets with a rope in 1835. He kept printing for thirty-five years, until slavery was over.',
    stamp: '★ HE WAS HEARD'
  },
  {
    id: 'busing', x: 8112, z: 25027, icon: '🚌', title: 'The Buses', year: '1974',
    body: 'Boston’s schools were deeply segregated, and in 1974 a judge ordered children bused across the city to fix it. What followed was ugly — crowds, thrown rocks, police escorts, children going to school afraid. This is recent enough that people who lived it are still here, and they do not agree about it. It belongs on this list precisely because it is uncomfortable and it is ours.',
  },

  // ── The city that rebuilt itself ──────────────────────────────────────────
  {
    id: 'back-bay-filled', x: -20409, z: 12658, icon: '🚂', title: 'This Was All Water', year: '1857–1890s',
    body: 'Every straight street and handsome brownstone in the Back Bay is standing on fill. It was a tidal bay — smelly, shallow and a public health problem — and for about forty years, trainloads of gravel arrived every forty-five minutes, day and night, to bury it. Boston did not find this land. It made it. The buildings sit on wooden pilings that must stay wet or they rot.',
    stamp: '★ THE CITY BUILT THE GROUND'
  },
  {
    id: 'first-subway', x: -10299, z: 7776, icon: '🚇', title: 'The First Subway in America', year: '1897',
    body: 'Downtown Boston in the 1890s was so jammed with streetcars that people got out and walked faster. The answer was to put the tracks underground — the first subway in the United States, opened in 1897, decades before most cities tried it. People were genuinely nervous about going under the street. Fifty million passengers used it in the first year anyway.',
    stamp: '★ FIRST IN THE COUNTRY'
  },
  {
    id: 'molasses', x: 5294, z: -10694, icon: '🍯', title: 'The Wave of Molasses', year: 'January 15, 1919',
    body: 'A steel tank on this waterfront, holding two and a third million gallons of molasses, split open. The wave was reportedly over twenty feet high and moved faster than a person can run. It knocked buildings off their foundations and killed twenty-one people. It sounds like a joke until you read that number. The company had ignored the tank leaking for years, and lost the court case.',
    stamp: '★ 21 PEOPLE DIED'
  },
  {
    id: 'great-fire-1872', x: 4513, z: 224, icon: '🔥', title: 'The Fire That Took Downtown', year: 'November 1872',
    body: 'It began in a basement and burned for around twelve hours, and by the end most of Boston’s business district — hundreds of buildings — was gone. One reason it spread so fast: a horse flu epidemic had left the fire department short of horses to pull the engines. The city rebuilt in stone and brick, and rewrote its building rules. Much of downtown looks the way it does because of those two days.',
  },
  {
    id: 'ether-dome', x: -4564, z: -6577, icon: '💤', title: 'The Day Surgery Stopped Hurting', year: 'October 16, 1846',
    body: 'Before this date, surgery meant being held down and awake. In an operating theatre in this hospital, a dentist gave a patient ether, and a surgeon removed a tumour from his neck while he felt nothing. The surgeon turned to the room and said, "Gentlemen, this is no humbug." Within months it had spread across the world. Very few single afternoons have reduced human pain that much.',
    stamp: '★ NO HUMBUG'
  },
  {
    id: 'telephone', x: -9276, z: 6304, icon: '☎️', title: 'Come Here, I Want to See You', year: 'March 10, 1876',
    body: 'Alexander Graham Bell was working in Boston on a machine to send the human voice down a wire, and on the 10th of March 1876 the first clear sentence went through it: he called for his assistant in the next room. The first words ever spoken on a telephone were a man asking a colleague to come and have a look. Every phone call since has been a version of that.',
  },
  {
    id: 'bpl', x: -10556, z: 6044, icon: '📖', title: 'Free to All', year: '1848',
    body: 'It says FREE TO ALL over the door, and in 1848 that was a radical thing to carve into stone: the first large free public library in America, paid for by the city, open to anybody who walked in. No fee, no membership, no letter of introduction. Every public library in the country is descended from the argument that got this one built.',
    stamp: '★ IT IS ON THE DOOR'
  },
  {
    id: 'emerald-necklace', x: -33972, z: 25112, icon: '💚', title: 'A Necklace Made of Parks', year: '1878–1896',
    body: 'Frederick Law Olmsted designed a chain of parks looping through Boston, connected by green parkways so you could walk for miles without leaving them. Half of it was engineering in disguise: the marshy bits are a flood-control system with grass on top. It is the only Olmsted park system in America still essentially intact, and it is a hundred and forty years old.',
  },
  {
    id: 'swan-boats', x: -5090, z: 1987, icon: '🦢', title: 'Pedalled Since 1877', year: '1877',
    body: 'The swan boats have been going round this pond since 1877, run by the same family the entire time, and they work exactly as they did then: somebody sits inside the swan and pedals. No engine. Ever. It is one of the oldest continuously operating attractions in the country and it is powered entirely by a person’s legs.',
    stamp: '★ STILL NO ENGINE'
  },
  {
    id: 'marathon', x: -9207, z: 5741, icon: '🏃', title: 'The Finish Line', year: 'since 1897',
    body: 'The oldest annual marathon in the world finishes on this street. In 1967 Kathrine Switzer entered when women were not allowed, and a race official ran onto the course and tried to physically drag her off it; her friends shoved him away and she finished. Women were not officially allowed for another five years. The photographs of that moment did most of the arguing.',
    stamp: '★ SHE FINISHED'
  },
  {
    id: 'long-wharf', x: 7085, z: -4088, icon: '⚓', title: 'The Wharf That Was a Street', year: '1710s',
    body: 'Long Wharf ran a third of a mile straight out into the harbor, and it was built so that the biggest ships could tie up and unload directly into the warehouses along it — no small boats, no waiting for the tide. It was essentially a street built out over the water. Everything arriving in colonial Boston, including the soldiers, came ashore right about here.',
  },
  {
    id: 'chinatown', x: -3137, z: 11459, icon: '🏮', title: 'The Neighbourhood That Stayed', year: 'since the 1870s',
    body: 'Boston’s Chinatown is one of the largest in the country and one of the oldest, and it has survived being cut in half by a highway, squeezed by downtown, and repeatedly written off. Neighbourhoods like this are usually described as if they simply appeared. They did not — they were held on to, by people, against pressure, for a hundred and fifty years.',
  },
  {
    id: 'castle-island', x: 33806, z: 16545, icon: '🏰', title: 'Fortified for Three Centuries', year: 'since 1634',
    body: 'There has been a fort on this spot since 1634, rebuilt over and over through every war this country has had — and it is not even an island any more, because the water between it and the shore was filled in. It is a park now where people walk their dogs around the walls. Three hundred and ninety years of defending the harbor, and it ends up as a very good place for a walk.',
  },
  {
    id: 'arboretum', x: -40323, z: 51591, icon: '🌳', title: 'A Museum Made of Trees', year: '1872',
    body: 'This is not a park with nice trees in it. It is a scientific collection of trees, arranged by family, planted as a living museum and studied for over a hundred and fifty years — many of them grown from seed collected on the other side of the world. It is run by Harvard and owned by the city on a thousand-year lease. Somebody planned for the year 2872.',
    stamp: '★ A 1,000-YEAR LEASE'
  },
  {
    id: 'the-hills', x: -1185, z: -2200, icon: '⛰', title: 'Boston Had Three Hills', year: 'the 1800s',
    body: 'The peninsula used to have three big hills, which is why one neighbourhood is still called Tremont. Two of them are gone — carted away by the shovel-load and used to fill in the water elsewhere. Boston literally moved its own hills into its own harbor to make more Boston. The one you are standing on is what is left, and it used to be considerably taller.',
    stamp: '★ THEY MOVED THE HILLS'
  },
];
