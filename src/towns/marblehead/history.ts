import type { Site } from '../../game/history';

// Marblehead's discovery markers — 20 true stories at the real spots.
//
// Indigenous cards first. Marblehead is Naumkeag ground, so the dossier is
// docs/research/indigenous-salem.md; the fact specific to this town is that its English
// deed, like Salem's and Lynn's, was bought from the sachem's heirs AFTER he had died.
//
// ⚠️ Beverly and Marblehead both claim the birthplace of the American navy. Beverly's set
// carries this argument too, from the other side, and neither town's cards declare a
// winner — because the historical claim genuinely splits (Beverly's harbor, Marblehead's
// ship and crew).
//
// ⚠️ Every coordinate here came out of landmark_candidates against the built world.json.
// The Jeremiah Lee Mansion — Marblehead's grandest building — is NOT named in OSM, and a
// hand-projected lat/lon disagreed with the data by ~400m, so its card was dropped rather
// than placed on a guess. Add it via manualFeatures + patch_features if you want it back.
export const HISTORY: Site[] = [
  // ── Naumkeag ground ───────────────────────────────────────────────────────
  {
    id: 'before-fishermen', x: 674, z: 8368, icon: '🐚', title: 'Before the Fishermen', year: 'before 1629',
    body: 'This whole coast was Naumkeag, and the Massachusett and Pawtucket people who lived along it had been coming to shores like this one for thousands of years — for clams, for fish, for the shell heaps that archaeologists still find. Marblehead did not begin when the English stepped off a boat. It began a very long time before that, with people who already knew which beach was good for what.',
  },
  {
    id: 'rocky-ground', x: 15724, z: 1068, icon: '🪨', title: 'You Cannot Farm a Rock', year: 'for centuries',
    body: 'Look at what this place is made of. Marblehead is a lump of stone sticking into the sea, and you cannot plant corn in stone. So Indigenous people did not build a permanent village out here — they came for what the rock is actually good for: fish, shellfish, and a view of the whole ocean. The English, who arrived wanting fish, made exactly the same calculation.',
  },
  {
    id: 'the-emptying-mhd', x: -3772, z: -10298, icon: '🕯', title: 'The Land Was Not Empty', year: '1618 and 1633',
    body: 'Settlers wrote that this coast seemed strangely open, as if waiting for them. It was not waiting. Sickness carried on earlier ships tore through in 1618 and again in 1633 and killed more people than anyone counted. Nobody left the coast willingly. The quiet the English described was very recent, and it was the loudest thing that had ever happened here.',
    stamp: '★ NOT EMPTY — EMPTIED'
  },
  {
    id: 'deed-after-death', x: 4874, z: -1327, icon: '📜', title: 'Bought From the Grandchildren', year: '1680s',
    body: 'The English had been living here for decades when they suddenly needed a piece of paper proving they owned it. So they went and bought one — from the grandchildren of Wenepoykin, the sachem who had held this land, who had died a couple of years earlier and whose family were by then living in another town entirely. Marblehead, Salem and Lynn all did this. The receipt came last.',
    stamp: '★ THE RECEIPT CAME LAST'
  },
  {
    id: 'wenepoykin-mhd', x: 11337, z: 7020, icon: '🪶', title: 'Sagamore George', year: '1616–1684',
    body: 'Wenepoykin became sachem as a child because sickness had taken nearly everyone older. He fought the English when war came, was captured, and was shipped across the ocean to Barbados and held there eight years. He made it back to Massachusetts in 1684, old and worn out, and died the same year. He was the last sachem of the Naumkeag people, and the deeds to these towns were bought once he was gone.',
  },
  {
    id: 'still-here-mhd', x: -3399, z: 3720, icon: '🔥', title: 'Still Here', year: 'right now',
    body: 'History books like the past tense. It is the wrong tense. Massachusett and Pawtucket people did not disappear — their descendants live in Massachusetts today, and a good library like this one will have books by them, about themselves, written now. Ask for those instead of the ones written about them a century ago.',
    stamp: '★ PRESENT TENSE'
  },

  // ── A town of fishermen ───────────────────────────────────────────────────
  {
    id: 'from-cornwall', x: 7410, z: -3385, icon: '⚓', title: 'A Town of Nothing But Fishermen', year: '1629',
    body: 'Most towns around here were settled by farmers looking for land. Marblehead was settled by fishermen from Cornwall and the Channel Islands, who wanted rock, deep water and a short row to the fish. They kept their own way of speaking for generations and everyone else thought they were odd. Marbleheaders rather enjoyed that. Some of them still do.',
    stamp: '★ FISH, NOT FARMS'
  },
  {
    id: 'split-1649', x: 6533, z: -5785, icon: '✂️', title: 'Leaving Salem', year: '1649',
    body: 'Marblehead started as a piece of Salem, and like Beverly it eventually got tired of that and left — in 1649, nineteen years earlier than Beverly did. It is a small peninsula with a big opinion of itself, and it has been running its own affairs ever since. The town meeting here is not a formality. Come and watch one.',
  },
  {
    id: 'fort-sewall', x: 10876, z: -7025, icon: '🏰', title: 'The Fort That Saved Old Ironsides', year: '1644 · 1814',
    body: 'Somebody has been guarding this headland since 1644. Its best day came in 1814: the USS Constitution, chased by two British warships, ran for this harbor with the enemy right behind her. The guns up here opened up, the British thought better of it, and the most famous ship in the country got away. A fort that mostly waited around for two hundred years had one perfect afternoon.',
    stamp: '★ ONE PERFECT AFTERNOON'
  },
  {
    id: 'glover-regiment', x: 6183, z: -2096, icon: '🚣', title: 'The Regiment That Could Row', year: '1775',
    body: 'When the war started, Marblehead raised a regiment — and unlike everyone else’s, this one was full of sailors. They could handle boats in the dark, in a current, in weather. That turned out to matter more than anything else they could have been good at. And they were mixed: Black men, Native men and white men, side by side, because out on the fishing grounds nobody had ever cared who pulled which rope.',
    stamp: '★ THEY COULD ROW'
  },
  {
    id: 'brooklyn', x: 1367, z: -1465, icon: '🌫', title: 'The Night They Saved the Army', year: 'August 1776',
    body: 'Washington’s whole army was trapped on Long Island with the British in front and a river behind. Losing it would have ended the war in one night. So the Marblehead men rowed. All night, back and forth across the East River in the dark and the fog, until nine thousand soldiers were across and the British woke up to an empty camp. If you only remember one thing these fishermen did, it should probably be this one.',
    stamp: '★ NINE THOUSAND MEN'
  },
  {
    id: 'the-crossing', x: 6019, z: -2083, icon: '❄️', title: 'Christmas on the Delaware', year: 'December 25, 1776',
    body: 'You have seen the painting: Washington standing up in the boat, ice in the river. Somebody had to be rowing that boat, and it was these men. On Christmas night they moved two thousand four hundred soldiers, plus the horses and the cannon, across a freezing river in a snowstorm, and did not lose one. The famous part is the standing up. The hard part was the oars.',
    stamp: '★ 2,400 ACROSS'
  },
  {
    id: 'navy-argument-mhd', x: 5619, z: -4270, icon: '🥊', title: 'The Argument With Beverly', year: 'still going',
    body: 'Beverly has a sign saying it is the birthplace of the American navy, because the schooner Hannah sailed from its harbor in 1775. Marblehead says hang on — the Hannah was a Marblehead ship, and Marblehead men sailed her. Both of those are true, which is why this argument is two hundred and fifty years old and still not finished. Two towns, four miles apart, one boat, no ending.',
    stamp: '★ NOBODY HAS WON'
  },
  {
    id: 'spirit-of-76', x: 3824, z: -1847, icon: '🥁', title: 'The Painting Everybody Knows', year: '1880',
    body: 'Three figures marching out of the smoke — an old man and a boy with drums, and a fifer between them. You have seen it on posters, in books, in adverts. It was painted for America’s hundredth birthday, and then a general whose own son had posed as the drummer boy bought it and gave it to this town. The original of one of the most copied pictures in America hangs upstairs in here.',
    stamp: '★ THE ORIGINAL IS HERE'
  },
  {
    id: 'the-gale', x: 7609, z: -8799, icon: '🌊', title: 'The Gale', year: 'September 19, 1846',
    body: 'A storm caught the Marblehead fishing fleet on the Grand Banks off Newfoundland. Ten vessels went down. Sixty-five men and boys did not come home, and forty-three of them were fathers — which left forty-three widows and a hundred and fifty-five children in a town this size, in one night. Almost every family here lost somebody. The town never entirely got over it, and it should not have.',
    stamp: '★ 65 DID NOT COME HOME'
  },
  {
    id: 'lost-at-sea', x: 7609, z: -8950, icon: '🗿', title: 'Visible Fifteen Miles Out', year: '1848',
    body: 'Two years after the gale, the town put up a white marble monument on the very highest point of this hill. That was deliberate. It stands where it can be seen from ten or fifteen miles out at sea — so that men coming home from the fishing grounds would see the memorial to the ones who did not, before they saw anything else of Marblehead. It is still the first thing you spot from the water.',
  },
  {
    id: 'marblehead-light', x: 15998, z: -4377, icon: '🗼', title: 'The Skeleton Light', year: '1896',
    body: 'This is not a nice round white lighthouse. It is a bare iron tower that looks like scaffolding somebody forgot to take down — and there is a reason. The old lighthouse here got hidden behind the enormous summer houses going up around it, so they simply built a new light on stilts, tall enough to see over the rich people’s roofs. Ugly, honest, and it worked.',
    stamp: '★ BUILT TO SEE OVER MANSIONS'
  },
  {
    id: 'the-lights-point', x: 16153, z: -4144, icon: '🌅', title: 'The End of the Neck', year: 'now',
    body: 'Stand at this point and you are as far out into the sea as Marblehead goes. On one side is the harbor full of masts; on the other, open ocean all the way to Europe. Every ship in every one of these stories — the Hannah, the fishing fleet, the boats that went to the Grand Banks and did not come back — passed the rock you are standing on, twice, if they were lucky.',
  },
  {
    id: 'race-week', x: 6002, z: -2248, icon: '⛵', title: 'A Harbor Full of Masts', year: 'since 1889',
    body: 'The fishing fleet is gone, and the harbor did not empty — it filled up with sails instead. Marblehead became one of the great yachting towns in the world, and every summer boats come from everywhere to race here. It is the same water, the same wind, and largely the same skills. The town just stopped needing the fish.',
  },
  {
    id: 'pattison-landing', x: -5033, z: -12505, icon: '🚤', title: 'A Landing Named for Somebody', year: 'now',
    body: 'Small towns name their landings, their rocks and their corners after people, and then quietly forget to explain why. That is a shame, and it is also fixable: local historical societies exist exactly so somebody can walk in and ask. Every name on a map in this town was a decision, made by people, for a reason. Someone still knows this one.',
  },
];
