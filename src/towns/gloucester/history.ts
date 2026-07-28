import type { Site } from '../../game/history';

// Gloucester's discovery markers — 23 true stories, each a bronze plaque at the real
// spot. Same bar as Newburyport: every card is sourced, nothing invented, and the
// Indigenous history leads because Cape Ann's story does not begin in 1623.
//
// Sourcing: docs/research/gloucester.md and gloucester-landmarks.md (both already
// photo-verified for the hero buildings), plus capeannhistory.org for the Algonquian
// place names and Western Abenaki translations, thacherisland.org / newenglandlighthouses
// for the 1635 wreck and the 1771 twin lights, and the Gloucester HarborWalk markers.
// ⚠️ The Indigenous cards have NOT been reviewed by an Indigenous reader — same open
// item as Newburyport's, see docs/research/indigenous-newbury.md §8.
//
// ⚠️ PLACEMENT: run `node tools/check_markers.mjs gloucester` after touching any
// coordinate. Eight of these first drafts were in the harbor or inside a building.
// Do NOT verify by probing the running game — the collision grid only exists for
// streamed chunks, so it reports garbage for anywhere the player is not standing.
export const HISTORY: Site[] = [
  // ---------- before the English ----------
  {
    id: 'wanaskwiwam', x: -11860, z: -40600, icon: '🌾', title: 'Wanaskwiwam', year: 'before 1623',
    body: 'Cape Ann already had a name. The Algonquian-speaking people here called it Wanaskwiwam — "the end of the marsh" — and their village stood up this way, above the river. The English wrote it down as "Wenesquawam," then stopped using it. The marsh is still here. So is the end of it. Only the name got lost.',
    stamp: '★ THE FIRST NAME'
  },
  {
    id: 'middens', x: -15200, z: -30800, icon: '🐚', title: 'The Shell Piles', year: 'thousands of years',
    body: 'Dig into the dunes along these beaches and you find shells — heaps of them, left by people eating clams here for thousands of years. Archaeologists call them middens. That is a fancy word for the world\'s oldest trash pile, and it is the best evidence we have that somebody stood on this exact sand a very, very long time before you did.',
    stamp: '★ SOMEBODY WAS HERE'
  },
  {
    id: 'masconomet-ca', x: -11200, z: 8800, icon: '🗺', title: 'Masconomet', year: '1634',
    body: 'Masconomet was the sagamore — the leader — of the Agawam people, and the land he spoke for ran all the way from the Merrimack River to the tip of Cape Ann. That includes everywhere you can see from here. In 1638 the English paid him twenty pounds for it. Twenty pounds, for all of this.',
  },

  // ---------- the fishing town ----------
  {
    id: 'stage-fort-1623', x: -10100, z: 7900, icon: '🐟', title: 'The Fish Stages', year: '1623',
    body: 'Fourteen men from England landed right here in 1623 and built wooden platforms called stages — flat decks for splitting and drying cod in the sun. That was the whole plan: catch fish, dry fish, send fish home. The farming went badly and most of them left. But the fish part worked, and it kept working for four hundred years.',
    stamp: '★ WHERE IT STARTED'
  },
  {
    id: 'the-cut', x: -7474, z: 4680, icon: '🛶', title: 'The Cut', year: '1643',
    body: 'In 1643 the town let its minister, Richard Blynman, dig a channel straight through the beach so boats could slip from the harbor to the river without sailing all the way around Cape Ann. People say it was the first canal ever dug in North America. Gloucester has been calling it "the Cut" ever since, because Gloucester does not waste words.',
  },
  {
    id: 'man-at-wheel', x: -5487, z: 4430, icon: '🎣', title: 'The Man at the Wheel', year: '1923',
    body: 'He leans into a wind that never stops, hands locked on the wheel, eyes on water you cannot see. The town put him here for its three hundredth birthday, and the words underneath are old ones: They That Go Down To The Sea In Ships. Behind him are the names. 5,368 Gloucester fishermen are known by name. The real number is closer to ten thousand.',
    stamp: '★ THEY THAT GO DOWN TO THE SEA'
  },
  {
    id: 'wives-memorial', x: -8527, z: 5196, icon: '👩‍👦', title: 'The Ones Who Waited', year: '2001',
    body: 'It took the town seventy-six more years to build this one. A woman on a granite boulder, a baby on her arm, a boy at her side, all three looking out at the same water the Man at the Wheel is steering into. Somebody stood on this shore every time a boat went out. This is the other half of that story, and it took a while for anyone to say so.',
    stamp: '★ THE OTHER HALF'
  },
  {
    id: 'fiesta', x: -2026, z: 3710, icon: '🎉', title: 'Saint Peter\'s Fiesta', year: 'every June',
    body: 'Sicilian and Portuguese families came here to fish, and they brought their saint with them. Every June this square fills up: a statue of Saint Peter carried through the streets, a priest blessing every boat in the harbor by name, and a whole city eating outdoors. Peter was a fisherman before he was a saint. Gloucester has never once forgotten that.',
  },
  {
    id: 'greasy-pole', x: -2921, z: 4889, icon: '🚩', title: 'The Greasy Pole', year: 'every June',
    body: 'A telephone pole sticks out sideways over the water, forty-five feet of it, slathered in grease. A red flag sits on the end. Grown men run at it one after another and fall in, over and over, until somebody finally grabs the flag and the whole beach loses its mind. There is no prize. That is not the point. The point is the flag.',
    stamp: '★ GRAB THE FLAG'
  },
  {
    id: 'paint-factory', x: 1018, z: 7660, icon: '🎨', title: 'The Paint Factory', year: '1863',
    body: 'Barnacles and weed stick to the bottom of a wooden ship and slow it right down — a real problem when you are racing fish home. Two Gloucester men, Tarr and Wonson, patented a copper paint in 1863 that stopped them growing, the first of its kind made in America. Ships all over the world went faster because of a building on this rock.',
  },
  {
    id: 'lane', x: 368, z: 1006, icon: '🖼', title: 'The Man Who Painted the Light', year: '1804–1865',
    body: 'Fitz Henry Lane was born in Gloucester and spent his life painting this harbor — the same water, over and over, in every kind of light there is. He could not walk well, so he was rowed out to sit and look. Look at the harbor around sunset sometime and you will see exactly what he kept chasing. He just got it to hold still.',
  },

  // ---------- lights and wrecks ----------
  {
    id: 'thacher', x: 57302, z: -20590, icon: '⛵', title: 'Thacher\'s Woe', year: '1635',
    body: 'In 1635 a ship called the Watch and Wait broke apart on these rocks in a storm. Twenty-one people drowned. Two survived — Anthony Thacher and his wife Elizabeth — and the colony gave Anthony the island as some kind of apology. He named it Thacher\'s Woe. "Woe" means terrible sorrow. He was not being poetic.',
    stamp: '★ TWO SURVIVED'
  },
  {
    id: 'twin-lights', x: 57302, z: -20900, icon: '🗼', title: 'Ann\'s Eyes', year: '1771',
    body: 'Two towers, lit the same night in December 1771, and people called them Ann\'s Eyes. Most lighthouses mark a harbor — come in here. These marked a danger instead: line the two lights up wrong and you were headed for the ledge. It was the first light station in America built to warn you off a rock rather than wave you in.',
  },
  {
    id: 'eastern-point', x: -1628, z: 30780, icon: '💡', title: 'Eastern Point Light', year: 'the harbor mouth',
    body: 'Every boat coming home to Gloucester passes this light, and every boat leaving passes it going the other way. The long stone breakwater running out from it was built to break the waves before they get into the harbor. If you ever want to know which way the weather is coming from, stand here for one minute. You will know.',
  },
  {
    id: 'annisquam-light', x: -12904, z: -41606, icon: '🔦', title: 'The River Light', year: 'the back way',
    body: 'This light guards the northern mouth of the Annisquam River — the back door into Gloucester, the one the Cut connects to. Small boats have been sneaking through this way for centuries to avoid going all the way around the Cape. It is a shortcut with a lighthouse. That tells you how much of a shortcut it really is.',
  },
  {
    id: 'sea-serpent', x: 2744, z: 8200, icon: '🐉', title: 'The Sea Serpent', year: 'August 1817',
    body: 'In August 1817 people all over this harbor saw something long and dark moving through the water with humps along its back. Not one or two people — dozens, including a ship\'s crew who fired a cannon at it. Scientists came up from Boston to investigate. They never explained it. Two hundred years later, nobody has. Keep an eye on the water.',
    stamp: '★ NEVER EXPLAINED'
  },
  {
    id: 'good-harbor', x: 20066, z: -3920, icon: '🏖', title: 'Good Harbor', year: 'every summer',
    body: 'At low tide a sandbar opens up and you can walk out to Salt Island without getting your knees wet. At high tide the sea takes the path back. Kids have been timing that walk for generations, and every single summer somebody gets it wrong and has to wait on the island for the water to go back down. Check the tide. Really.',
  },

  // ---------- the woods ----------
  {
    id: 'dogtown', x: 5461, z: -22340, icon: '🐕', title: 'Dogtown', year: 'the 1740s',
    body: 'There was a whole village up here once — houses, farms, roads, a mill. Then the fishing got good down at the harbor and everybody moved to the water. The last people left were widows whose husbands had died in the wars, living with their dogs for company. The dogs stayed after the people were gone. That is where the name comes from.',
    stamp: '★ THE VILLAGE THAT LEFT'
  },
  {
    // Set in the DENSEST part of the boulder field (7 carved stones within 900px:
    // Industry, Initiative, Integrity, ideas, ideals, Intelligence, Use Your Head)
    // rather than jammed 48px into "Be On Time/Study" where it started — the point
    // of this card is looking up and seeing several of them at once.
    id: 'babson-boulders', x: 6287, z: -20465, icon: '🪨', title: 'The Talking Rocks', year: 'the 1930s',
    body: 'During the Depression a rich man named Roger Babson hired out-of-work stonecutters to carve words into the boulders all over these woods. HELP MOTHER. NEVER TRY NEVER WIN. GET A JOB. He wanted people wandering out here to bump into some advice. They are still here, still saying it, whether you asked or not.',
    stamp: '★ NEVER TRY NEVER WIN'
  },
  {
    id: 'whales-jaw', x: 9465, z: -33690, icon: '🐋', title: 'Whale\'s Jaw', year: 'a very long time',
    body: 'A glacier dropped this rock here and then split it, and for a long time the two halves together looked exactly like a whale coming up open-mouthed out of the ground. Part of it has since fallen. It looks less like a whale now. But it is still an enormous rock in the middle of the woods, and it still got there by ice.',
  },
  {
    id: 'hammond-castle', x: -20387, z: 26550, icon: '🏰', title: 'The Inventor\'s Castle', year: '1926–1929',
    body: 'John Hays Hammond Jr. held hundreds of patents — he worked out how to steer a boat by radio from shore. Then he built himself an actual medieval castle on the rocks, with a drawbridge and a pipe organ, and filled it with things he liked. The reef out front is Norman\'s Woe, where Longfellow wrecked a ship in a famous poem. He picked that view on purpose.',
    stamp: '★ HE BUILT A CASTLE'
  },

  // ---------- flight ----------
  {
    id: 'cg-aviation', x: -4234, z: 4200, icon: '✈️', title: 'A Canvas Hangar', year: '1925',
    body: 'On the little island out there, in 1925, the Coast Guard parked one borrowed seaplane in an army-surplus canvas tent and gave two men the job of chasing rum-runners from the air. That tent was the first Coast Guard air station that actually worked. Every Coast Guard helicopter that has ever pulled somebody out of the water traces back to it.',
    stamp: '★ IT STARTED IN A TENT'
  },

  // ---------- Rockport, in frame ----------
  {
    id: 'motif-1', x: 30896, z: -39085, icon: '🏚', title: 'Motif Number 1', year: '1884',
    body: 'It is a red fish shack. Artists have painted it so many times that somebody nicknamed it "Motif Number 1," meaning the thing everybody paints first, and the name stuck for good. A blizzard knocked it into the harbor in February 1978. The town rebuilt it that same year, exactly the same, right down to the buoys on the wall.',
    stamp: '★ MOST-PAINTED IN AMERICA'
  },
];
