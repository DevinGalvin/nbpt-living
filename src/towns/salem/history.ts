import type { Site } from '../../game/history';

// Salem's discovery markers — 34 true stories, each a bronze plaque at the real spot.
//
// The first six are the Indigenous history of Naumkeag, and they lead the list because
// Salem's story does not begin with Roger Conant in 1626. Sourced with citations and
// open questions in docs/research/indigenous-salem.md.
//
// ⚠️ Salem is the one town where the famous story is mostly MYTH, so several cards exist
// to correct it, gently and without spoiling the fun: nobody was burned, it did not
// happen on top of Gallows Hill, and the accusations did not even start in this town.
// Every correction here is sourced. Do not soften them back into the legend.
//
// ⚠️ PLACEMENT: run `node tools/check_markers.mjs salem` after touching any coordinate.
export const HISTORY: Site[] = [
  // ── Naumkeag ──────────────────────────────────────────────────────────────
  {
    id: 'naumkeag', x: 8865, z: -5374, icon: '🐟', title: 'Naumkeag', year: 'the name before Salem',
    body: 'This place had a name long before it had this one. It was Naumkeag, and most people who study the language say it means “the fishing place.” The English kept using it for years before they swapped it for Salem, which comes from an old word for peace. Two names for one harbor. Only one of them was chosen by the people who found it first.',
    stamp: '★ THE FISHING PLACE'
  },
  {
    id: 'squaw-sachem', x: 7190, z: -7976, icon: '👑', title: 'The Leader Whose Name Was Not Written Down', year: 'after 1619',
    body: 'The Pawtucket people here were led by a sachem — a leader — named Nanepashemet. When he died in 1619, his wife took over and governed this whole territory, from the Charles River to the Merrimack. She ruled for years. And the English never bothered to write down her actual name. They just called her a title. We know exactly what the men were called. Think about that one.',
    stamp: '★ SHE LED ANYWAY'
  },
  {
    id: 'great-dying', x: 1992, z: -10014, icon: '🕯', title: 'The Land Was Not Empty', year: '1618 and 1633',
    body: 'When English ships arrived, they wrote that the land looked empty and ready to be taken. It was not empty. It had been emptied. Sickness the ships had brought years earlier swept through in 1618, and again in 1633, and it killed more people than anyone counted. The cleared fields the settlers were so pleased to find were somebody’s cornfields. The people who planted them had been alive within living memory.',
    stamp: '★ NOT EMPTY — EMPTIED'
  },
  {
    id: 'wenepoykin', x: 6275, z: -7215, icon: '🪶', title: 'The Boy Who Came Home', year: '1616–1684',
    body: 'Wenepoykin became sachem of Naumkeag when he was still a child, because the sickness took nearly everyone older. The English called him Sagamore George. He grew up, and when war came he fought them — and lost, and was captured, and was sold across the ocean to Barbados as a slave. He was there eight years. And then, somehow, he came back. He made it home to Massachusetts in 1684, an old man, and died here. He was the last sachem of his people.',
    stamp: '★ EIGHT YEARS, AND HOME'
  },
  {
    id: 'fishing-place', x: 8446, z: -12867, icon: '🌊', title: 'Why Name a Place for Fish', year: 'for centuries',
    body: 'Because the fish were the whole reason. Every spring they came up these rivers in numbers you would not believe, and the Pawtucket met them with weirs — fences of woven sticks set in the water that let the river through and kept the fish in. You did not chase your food. You built the right fence in the right place and the food came to you, on schedule, every year. That is not luck. That is knowing a river.',
  },
  {
    id: 'still-here', x: 2621, z: -1866, icon: '🔥', title: 'Still Here', year: 'right now',
    body: 'Here is the part the old books get wrong by writing everything in the past tense. Massachusett and Pawtucket people did not vanish. Their descendants are alive today, in this state, some of them a short drive from where you are standing. Salem State University reads a land acknowledgement — a statement naming whose land this was and is. Not “used to be.” Is.',
    stamp: '★ PRESENT TENSE'
  },

  // ── The English town ──────────────────────────────────────────────────────
  {
    id: 'conant', x: 5984, z: -7502, icon: '🗿', title: 'The Statue Everyone Gets Wrong', year: '1626',
    body: 'Look at him: long cloak, tall hat, stern face, standing right outside the Witch Museum. Thousands of visitors photograph this statue every year thinking it is a witch. It is Roger Conant, the man who led the first English settlers here in 1626 — sixty-six years before the trials, and nothing at all to do with them. He has been standing here since 1913 being mistaken for the opposite of himself.',
    stamp: '★ NOT A WITCH'
  },
  {
    id: 'salem-village', x: 1599, z: -10715, icon: '🗺', title: 'It Did Not Start Here', year: '1692',
    body: 'Everyone says “the Salem witch trials,” and everyone pictures this town. But the accusations began in Salem Village — the farming settlement inland, which is not part of Salem at all today. It is a whole separate town now, called Danvers. The trials and the hangings happened here in Salem Town. The fear started somewhere else and travelled. Places get famous for things that began down the road.',
    stamp: '★ IT BEGAN IN DANVERS'
  },
  {
    id: 'witch-house', x: 847, z: -5802, icon: '🏚', title: 'The Only House That Was There', year: '1692',
    body: 'Salem is full of witch shops and witch signs and witch museums, and almost none of it was here in 1692. This dark house was. It belonged to Jonathan Corwin, one of the judges, and people accused of witchcraft were questioned inside it. Out of every building in this entire town, this is the only one still standing with a real connection to the trials. Everything else came later.',
    stamp: '★ THE ONLY ONE LEFT'
  },
  {
    id: 'nineteen', x: -4586, z: -3999, icon: '⚖️', title: 'Nobody Was Burned', year: '1692',
    body: 'You have probably heard that the Salem witches were burned. They were not. Not one. Nineteen people were hanged, one man was crushed under stones, and at least five more died in jail waiting. Twenty-five people, and not a single fire. The burning is something the movies added later. The real story is bad enough without it, and the people it happened to deserve to have it told right.',
    stamp: '★ NINETEEN HANGED'
  },
  {
    id: 'proctors-ledge', x: -4389, z: -4177, icon: '🌳', title: 'Found Again in 2016', year: '1692 · 2016',
    body: 'For three hundred years nobody knew exactly where the hangings happened. Then a team of historians and a geologist spent six years on it — reading eyewitness accounts, digging through trial papers, scanning the ground itself — and in 2016 they proved it was this ledge. A memorial went up here, a curved granite wall with the names on it, around one oak tree. Three centuries late, but they got it right.',
    stamp: '★ NINETEEN NAMES'
  },
  {
    id: 'gallows-hill', x: -8383, z: -837, icon: '⛰', title: 'The Hill With the Wrong Name', year: 'for 300 years',
    body: 'This is Gallows Hill. It has the grim name, it is on all the maps, and for three hundred years everybody assumed the hangings happened right up here at the top. They did not. They happened lower down, on a ledge at the bottom of this same hill, and it took until 2016 to prove it. A name can be famous, and old, and on every map, and still be pointing at the wrong spot.',
  },
  {
    id: 'giles-corey', x: 4901, z: -8279, icon: '🪨', title: 'More Weight', year: 'September 1692',
    body: 'Giles Corey was eighty years old and he refused to say a word at his own trial — not guilty, not innocent, nothing. So they laid him under a board and piled stones on it to make him speak. Two days. He would not do it. The story goes that all he ever said was “more weight.” He died without giving them what they wanted, and because he never entered a plea, his farm stayed with his family.',
    stamp: '★ HE NEVER SPOKE'
  },
  {
    id: 'witch-memorial', x: 5118, z: -4799, icon: '🪑', title: 'Twenty Stone Benches', year: '1992',
    body: 'Three hundred years after the trials, Salem built a memorial beside this old burying ground: a low stone wall with a bench for each person killed, and each bench carved with a name and how they died. Some of their protests are carved into the stones at the entrance, cut off mid-sentence — because that is what happened to them. It is a quiet corner in a loud town. That is on purpose.',
  },
  {
    id: 'elizabeth-johnson', x: 3638, z: -5229, icon: '✏️', title: 'The Class That Cleared Her Name', year: '2022',
    body: 'Elizabeth Johnson Jr. was convicted in 1692 and somehow never got un-convicted. Everyone else was cleared eventually. She was just forgotten — for three hundred and twenty-nine years. Then a class of eighth graders in North Andover heard about her, decided that was not okay, and spent three years writing to lawmakers until the state of Massachusetts finally cleared her name in 2022. Kids did that. Actual kids, not much older than you.',
    stamp: '★ 329 YEARS LATE'
  },
  {
    id: 'apology', x: 553, z: -5922, icon: '🙏', title: 'Saying Sorry Out Loud', year: '1697',
    body: 'Five years after the trials, Massachusetts admitted it had been terribly wrong and set aside a whole day for the colony to fast and think about it. One of the judges, Samuel Sewall, stood up in his own church while his apology was read aloud in front of everyone he knew. He was the only judge who did. Saying sorry that loudly, in public, is a hard thing. It was also the least anyone owed.',
  },
  {
    id: 'leslies-retreat', x: -2457, z: -6841, icon: '🥁', title: 'The Battle Where Nobody Fired', year: 'February 1775',
    body: 'Two months before Lexington, British soldiers marched into Salem to seize cannons. The townspeople got to the bridge first and hauled up the drawbridge, and both sides stood there shouting across the gap. A minister argued. A crowd gathered. Nobody wanted to be the one to start a war. Eventually the British turned around and marched back out. The first stand against them happened right here, and not one shot was fired.',
    stamp: '★ NOT ONE SHOT'
  },

  // ── The great harbor ──────────────────────────────────────────────────────
  {
    id: 'derby-wharf', x: 9956, z: -2628, icon: '⚓', title: 'The Longest Wharf', year: '1762',
    body: 'This finger of stone and earth runs half a mile into the harbor, and for a while it was the busiest half mile in America. Ships tied up here loaded with pepper, silk, coffee and porcelain from the other side of the world. Elias Hasket Derby, whose family built it, is often called the first millionaire in the United States. He got there by sending ships further than anyone else dared.',
    stamp: '★ HALF A MILE OF DOCK'
  },
  {
    id: 'china-trade', x: 8674, z: -4066, icon: '🧭', title: 'To the Farthest Port', year: '1786',
    body: 'Salem’s official seal has a Latin motto that means “to the farthest port of the rich East.” That was not bragging — it was a job description. In 1786 Derby’s ship the Grand Turk sailed all the way to China, and for a while afterward there were places in Asia where traders knew the name Salem and thought it must be an enormous country. It was a town of a few thousand people with very good sailors.',
    stamp: '★ THE FARTHEST PORT'
  },
  {
    id: 'friendship', x: 8915, z: -4579, icon: '⛵', title: 'The Ship Built Twice', year: '1797 · 2000',
    body: 'The first Friendship sailed out of Salem in 1797 and made fifteen voyages to places like Sumatra, China and Russia before the British captured her in a war. She was gone for two hundred years. Then Salem built her again — a full-size sailing ship, from the old plans — and tied her up right here where the original loaded. You are looking at a ship that came back from the eighteenth century.',
  },
  {
    id: 'custom-house', x: 8509, z: -5940, icon: '🏛', title: 'The Job That Made a Novel', year: '1846',
    body: 'Every ship coming in had to pay a tax, and this is the building where it got counted. Nathaniel Hawthorne worked upstairs, bored out of his mind, and then lost the job when the politics changed. Being fired turned out to be the best thing that ever happened to him: with nothing else to do, he sat down and wrote The Scarlet Letter. It made him famous. He put this building in the first chapter.',
    stamp: '★ FIRED, THEN FAMOUS'
  },
  {
    id: 'seven-gables', x: 10716, z: -6054, icon: '🏠', title: 'Count the Peaks', year: '1668',
    body: 'A gable is the pointed triangle of roof you see at the end of a house. This one has seven of them, which is a lot, because it kept getting added onto for three hundred years. Hawthorne’s cousin lived here and he visited constantly, and eventually he wrote a whole book named after the roof. There is a staircase hidden inside a chimney. Go on — try to count the gables from out here.',
    stamp: '★ SEVEN OF THEM'
  },
  {
    id: 'bowditch', x: 854, z: -6005, icon: '⭐', title: 'The Sailor Who Taught Himself', year: '1802',
    body: 'Nathaniel Bowditch was pulled out of school at ten and put to work. So he taught himself — maths, Latin, astronomy, whatever he could get his hands on — and then went to sea and found more than eight thousand mistakes in the navigation book every ship was using. So he wrote a better one. Sailors still carry it, two hundred years later. He also taught his whole crew to navigate, which nobody did.',
    stamp: '★ 8,000 MISTAKES FIXED'
  },
  {
    id: 'derby-light', x: 10671, z: -1359, icon: '🔦', title: 'The Little Light at the End', year: '1871',
    body: 'Out at the very tip of the long wharf sits a small square lighthouse, barely taller than a house. It is not dramatic. It did not need to be — it was not warning ships off a cliff, just showing them the way into their own harbor after dark. Walk the whole wharf out to it and you are walking the exact path a returning sailor watched grow closer for the last mile of a two-year voyage.',
  },
  {
    id: 'winter-island', x: 19891, z: -11049, icon: '🏰', title: 'The Fort That Watched the Harbor', year: '1643',
    body: 'Somebody has been keeping an eye on this harbor mouth from this spot since 1643. First an earth-and-timber fort, then a stone one, rebuilt over and over through war after war. Later the Coast Guard flew seaplanes off this same point. It is a park now, with people fishing where the guns were. Every single version of it was here for the same reason: this is where you can see anyone coming.',
  },

  // ── The people the postcards skip ─────────────────────────────────────────
  {
    id: 'remond', x: 625, z: -4115, icon: '📣', title: 'The Family in the Ballroom', year: '1800s',
    body: 'John Remond came to Salem from the Caribbean as a boy and became the man who ran the food and the events at this elegant hall — the fanciest room in town. His children grew up in it and became famous for something else entirely: speaking against slavery, all over America and across the ocean in Britain. Charles and Sarah Remond were two of the strongest anti-slavery voices in the country, and they came from here.',
    stamp: '★ THEY SPOKE ANYWAY'
  },
  {
    id: 'charlotte-forten', x: 5451, z: -4305, icon: '📚', title: 'The First Black Teacher', year: '1856',
    body: 'Charlotte Forten came to Salem to go to school because her home city would not let a Black girl into a good one. She did brilliantly, trained as a teacher, and in 1856 Salem hired her — the first Black teacher in this town’s public schools, standing in front of a room of white children at a time when most of the country said that was impossible. She kept a diary the whole time. We can still read it.',
    stamp: '★ SHE WENT FIRST'
  },
  {
    id: 'mcintire', x: 267, z: -5512, icon: '🪚', title: 'The Carpenter Who Became an Architect', year: '1757–1811',
    body: 'Samuel McIntire was a woodcarver’s son who never went to architecture school, because there was not one. He just got extremely good — first at carving, then at whole houses — and the sea captains getting rich off the China trade all wanted him. Walk the streets around here and look up at the doorways and the fences. Half the beautiful bits in this neighbourhood came out of one man’s hands.',
  },
  {
    id: 'pem', x: 5159, z: -5665, icon: '🗿', title: 'The Sailors’ Collection', year: '1799',
    body: 'In 1799 a group of Salem sea captains made a club with one strange rule: to join, you had to have sailed around the Cape of Good Hope or Cape Horn. And each of them had to bring back something from wherever they had been. Those souvenirs piled up into a museum — and it never once closed. It has been open longer than any other museum in the United States. It started as a pile of things sailors thought were cool.',
    stamp: '★ OPEN SINCE 1799'
  },
  {
    id: 'pioneer-village', x: 10028, z: 7936, icon: '🛖', title: 'The First Place Like This', year: '1930',
    body: 'In 1930 Salem built a copy of its own 1630 self — dugouts, thatched cottages, a blacksmith — for the town’s three-hundredth birthday. It was the first living history village in America, meaning the first place where instead of reading about the past behind glass, you could walk into it. Every open-air museum you have ever visited is descended from this one. It was supposed to be temporary.',
    stamp: '★ THE FIRST OF ITS KIND'
  },
  {
    id: 'great-fire', x: -4586, z: -7998, icon: '🔥', title: 'The Day Half the Town Burned', year: 'June 25, 1914',
    body: 'It started at twenty-five to two in the afternoon in a leather factory on Boston Street, and the wind took it. By the time it stopped, more than thirteen hundred buildings were gone and eighteen thousand people had nowhere to sleep. Soldiers came in to help. Salem rebuilt — and wrote new rules about what buildings had to be made of, so that it could never happen the same way twice.',
    stamp: '★ 1,376 BUILDINGS'
  },
  {
    id: 'parker-brothers', x: 3931, z: -6932, icon: '🎲', title: 'The Teenager Who Made Games', year: '1883',
    body: 'George Parker was sixteen and invented a board game. His brothers thought he should sell it, so he did, and then he made more, and the company he built right here in Salem went on to publish some of the most famous games in the world — including one about buying up properties that you have almost certainly argued with your family about. It began with a Salem teenager who thought his game was good enough.',
    stamp: '★ HE WAS SIXTEEN'
  },
  {
    id: 'willows', x: 18082, z: -16961, icon: '🎡', title: 'Trees Planted for Sick Children', year: '1858',
    body: 'The willow trees this park is named for were planted in 1858 to make shade for children recovering at a hospital nearby. The trees grew. The hospital did not last. And people kept coming out to the point for the shade and the sea air until somebody put in a carousel, and then popcorn, and then an arcade — and a quiet place to be ill turned into the loudest, happiest corner of Salem. It started with shade.',
  },
  {
    id: 'salem-common', x: 6961, z: -7818, icon: '🌳', title: 'The Field That Trained Everyone', year: '1714',
    body: 'This green square was not always pretty. It was the training field — muddy, loud, full of men drilling with muskets because every town was required to have soldiers ready. It got tidied into a park with a fence and paths later on, once the drilling stopped mattering so much. Every militia this town ever sent anywhere formed up on this grass first.',
  },
];
