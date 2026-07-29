import type { Site } from '../../game/history';

// Amesbury's discovery markers — 16 true stories at the real spots.
//
// Indigenous cards lead. This is the lower Merrimack, so the dossier is
// docs/research/indigenous-newbury.md (Pawtucket-Pennacook, Western Abenaki), NOT the
// Salem/Naumkeag one. Same review caveat: not yet read by an Indigenous reviewer.
//
// ⚠️ The "Golgotha Boulder Site" is a real named feature in the map data with a strange
// name and no explanation I could verify. Its card says exactly that and invents nothing.
//
// ⚠️ Apostrophes in these strings must be the curly ’ — a straight ' terminates the
// single-quoted body and produces a wall of unrelated tsc errors. (Learned the hard way.)
//
// ⚠️ PLACEMENT: run `node tools/check_markers.mjs amesbury` after touching any coordinate.
export const HISTORY: Site[] = [
  {
    id: 'powow-falls', x: -6699, z: -6322, icon: '🐟', title: 'Why Anybody Stopped Here', year: 'for centuries',
    body: 'The Powow River drops fast here, and falls are the best place in the world to catch fish — because the fish have to come to you, and they have to slow down doing it. The Pawtucket people fished these falls every spring for centuries. Later the English put mills on exactly the same spot, for exactly the same reason: falling water is useful. Two completely different ideas about one drop of river.',
    stamp: '★ THE FALLS CAME FIRST'
  },
  {
    id: 'molodemak-ams', x: 12049, z: 11866, icon: '🌊', title: 'Molodemak', year: 'the river’s first name',
    body: 'The Merrimack was Molodemak long before it was the Merrimack. The Pawtucket fished it with weirs — fences of woven sticks set across the shallows that let the water through and held the fish. Every spring the runs came up in numbers that are genuinely hard to imagine now. The river has not changed. Only the name written on the map did.',
  },
  {
    id: 'the-emptying-ams', x: -10121, z: -274, icon: '🕯', title: 'The Land Was Not Empty', year: 'the 1610s',
    body: 'Settlers moving up this river described good open country with few people in it, and treated that as luck. It was not luck. Sickness carried from earlier European ships had run through the Merrimack valley and killed an enormous share of the people who lived along it. The empty valley the English described had been full within living memory.',
    stamp: '★ NOT EMPTY — EMPTIED'
  },
  {
    id: 'still-here-ams', x: -1685, z: 2450, icon: '🔥', title: 'Still Here', year: 'right now',
    body: 'The Pawtucket and Pennacook peoples of this valley did not disappear — their descendants are alive today, in New England and in Canada, and some of them still speak Abenaki. That matters for a practical reason: it is why scholars have been able to correct old English guesses at what these river names meant. You can only fix a translation if somebody still knows the language.',
    stamp: '★ PRESENT TENSE'
  },

  {
    id: 'amesbury-split', x: -2152, z: 1667, icon: '✂️', title: 'The Town Across the River', year: '1666',
    body: 'Amesbury started as the far side of Salisbury — the bit across the Powow, where getting to the meetinghouse meant a river crossing in whatever the weather was doing. In 1666 the far side got its own town. Almost every old town around here was made this way: not by founding something new, but by somebody deciding the walk to church was too long.',
  },
  {
    id: 'susannah-martin', x: 6199, z: 4543, icon: '⚖️', title: 'The Woman From Here Who Was Hanged', year: 'July 19, 1692',
    body: 'The Salem witch trials were not only about Salem. Susannah Martin lived in Amesbury — a widow, sharp-tongued, poor, and unwilling to pretend otherwise. She was accused, tried, and hanged in July 1692. She had been quarrelling with neighbours over land for years, which turns out to be a much better explanation for what happened to her than anything supernatural.',
    stamp: '★ SHE WAS FROM HERE'
  },
  {
    id: 'josiah-bartlett', x: 1031, z: 11205, icon: '✒️', title: 'The Man Who Signed', year: '1729–1795',
    body: 'Josiah Bartlett was born in Amesbury, became a country doctor, and ended up in Philadelphia in 1776 putting his name on the Declaration of Independence — a document that, if it had gone badly, was a signed confession of treason. He knew that when he signed it. He later ran the state of New Hampshire. Not bad for a boy from a small town on the Powow.',
    stamp: '★ HE SIGNED IT'
  },
  {
    id: 'whittier-home', x: -3278, z: 2051, icon: '🏠', title: 'The Poet on Friend Street', year: '1836–1892',
    body: 'John Greenleaf Whittier lived in this house for over fifty years and wrote most of his famous work in one small downstairs room. He was a Quaker, and enormously popular — the sort of poet whose lines people knew by heart. His long winter poem about a family snowed in together was a genuine bestseller. He never married, and he stayed here, in an ordinary house on an ordinary street.',
  },
  {
    id: 'whittier-abolition', x: -3398, z: 2250, icon: '📣', title: 'The Dangerous Part', year: 'the 1830s',
    body: 'Whittier is remembered as a gentle poet about snow. That is only half of him. He spent decades as an abolitionist — writing, publishing and organising against slavery when doing so was genuinely dangerous. A mob wrecked a press he worked with and he was attacked more than once. He gave up years of his writing career to it on purpose. The snow poems came later.',
    stamp: '★ HE RISKED IT'
  },
  {
    id: 'lowells', x: 10543, z: 13877, icon: '🛶', title: 'The Oldest Boat Shop in America', year: '1793',
    body: 'People have been building boats by hand in this shop since 1793 — which makes it the oldest continuously operating boat shop in the United States. Not a museum about boat building. A shop, with sawdust, where they are still doing it. George Washington was president when the first boat went out of these doors, and they have not stopped since.',
    stamp: '★ SINCE 1793'
  },
  {
    id: 'the-dory', x: 10600, z: 14100, icon: '⛵', title: 'What a Dory Is, and Why', year: 'the 1800s',
    body: 'A dory is a small flat-bottomed rowing boat with high flared sides, and it was invented to solve a specific problem: fishing schooners needed boats they could stack on deck like plates and drop over the side on the Grand Banks. The design was worked out here. Simple, cheap, tough, stackable — and one man in one of them, miles from his ship, in the fog. That was the job.',
  },
  {
    id: 'carriage-town', x: -735, z: 20, icon: '🛞', title: 'Carriage Town', year: 'the 1800s',
    body: 'For most of the nineteenth century Amesbury made carriages — good ones, in quantity, shipped everywhere. A whole town of wheelwrights, painters, upholsterers and blacksmiths, all in one trade. If you wanted a smart carriage in America, there was a decent chance the thing you were sitting in came from this river valley.',
  },
  {
    id: 'carriage-to-car', x: -1413, z: 712, icon: '🚗', title: 'From Carriages to Car Bodies', year: 'the 1900s',
    body: 'Here is what happens to a town that makes carriages when the car arrives: either it dies, or it notices that a car body is a carriage body with a different thing pulling it. Amesbury noticed. The same workshops started building bodies for automobiles, using the same wood-and-metal skills. Eventually that ended too. But it bought the town a whole extra industry out of a disaster.',
    stamp: '★ THEY ADAPTED'
  },
  {
    id: 'the-millyard', x: -800, z: 200, icon: '⚙️', title: 'The Millyard', year: 'the 1800s',
    body: 'The Powow drops more than a hundred feet in a very short distance, which before engines was the single most valuable thing a piece of land could do. Mills stacked up along the drop, each one using the water and passing it down to the next. This little valley was the engine room of the whole town, and the reason there is a town here at all.',
  },
  {
    id: 'training-field', x: 13265, z: 1302, icon: '🌳', title: 'The Training Field', year: 'the 1600s',
    body: 'The name is the history. Every colonial town had to keep men drilled and armed, and needed a flat open field to do it on. Centuries later it is a park with a name nobody thinks about. If you find a Training Field, a Common or a Green in a New England town, you have found the oldest piece of public ground in it.',
  },
  {
    id: 'golgotha', x: 4006, z: 9647, icon: '🪨', title: 'The Boulder With the Odd Name', year: 'unknown',
    body: 'There is a spot in this town marked on the map as Golgotha, which is a name out of the Bible and a very strange thing to call a rock in Massachusetts. Why? Honestly — I could not find a source that explains it, and rather than invent one, here is the truth: it has a heavy old name, somebody chose it deliberately, and the reason is sitting in a local archive waiting for somebody to go and ask.',
    stamp: '★ GO AND FIND OUT'
  },
];
