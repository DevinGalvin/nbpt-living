import type { Site } from '../../game/history';

// Salisbury's discovery markers — 13 true stories at the real spots.
//
// Indigenous cards lead. Lower Merrimack, so the dossier is
// docs/research/indigenous-newbury.md (Pawtucket-Pennacook, Western Abenaki). Same
// review caveat: not yet read by an Indigenous reviewer.
//
// ⚠️ Apostrophes must be the curly ’ — a straight ' terminates the single-quoted body.
//
// ⚠️ PLACEMENT: run `node tools/check_markers.mjs salisbury` after touching any coordinate.
export const HISTORY: Site[] = [
  {
    id: 'the-river-mouth', x: -2792, z: 23732, icon: '🌊', title: 'Where the River Ends', year: 'always',
    body: 'This is the mouth of the Merrimack — called Molodemak long before it was called anything else — and river mouths are the richest places on a coast. Fresh water meets salt, fish gather to make the crossing, birds follow the fish, and people follow both. The Pawtucket knew this spot extremely well. Everything that has ever happened here happened because of this one geographic fact.',
    stamp: '★ FRESH MEETS SALT'
  },
  {
    id: 'the-emptying-sal', x: 440, z: 8152, icon: '🕯', title: 'The Land Was Not Empty', year: 'the 1610s',
    body: 'The English who settled this shore in 1638 found open country and few people, and read it as an invitation. It was not. Sickness brought on earlier European ships had swept the Merrimack valley and killed a devastating share of the people living along it. The room the settlers found had been made, very recently, by something nobody had chosen.',
    stamp: '★ NOT EMPTY — EMPTIED'
  },
  {
    id: 'the-salt-marsh', x: 15603, z: -12821, icon: '🌾', title: 'Grass Worth Money', year: 'for centuries',
    body: 'This enormous salt marsh looks like nothing. It is not nothing. Indigenous people harvested it for food and materials, and English farmers later fought in court over who could cut which patch — because salt hay fed animals through the winter and there was only so much of it. Some of the earliest arguments in this town were about grass. Good grass was worth arguing over.',
  },
  {
    id: 'still-here-sal', x: -757, z: 1960, icon: '🔥', title: 'Still Here', year: 'right now',
    body: 'It is easy to read an old town history and come away thinking the Indigenous people of this valley are a chapter that ended. They are not. Pawtucket and Pennacook descendants are alive today in New England and Canada, and Abenaki is still spoken. That last part is not a curiosity — it is why old mistranslations of local place names can still be corrected.',
    stamp: '★ PRESENT TENSE'
  },

  {
    id: 'colchester', x: 710, z: 71, icon: '📜', title: 'It Was Called Colchester First', year: '1638–1640',
    body: 'When the English settled here in 1638 they named it Colchester, after a town in England. Two years later they changed their minds and called it Salisbury, after a different town in England. Almost every place name around here is somebody being homesick and picking a name off a map of somewhere else. The town got two goes at it.',
  },
  {
    id: 'amesbury-left', x: -2503, z: -2815, icon: '✂️', title: 'When Amesbury Left', year: '1666',
    body: 'Salisbury used to be bigger. The part on the far side of the Powow River got tired of crossing water to reach the meetinghouse, and in 1666 it split off and became Amesbury. This happened all over New England, and the reason was almost never a grand principle. It was the walk. Before cars, the distance to church decided where the town lines went.',
  },
  {
    id: 'shipbuilding', x: -7177, z: 7511, icon: '🔨', title: 'Ships Off the Riverbank', year: 'the 1700s–1800s',
    body: 'Along this shore, men built ships out in the open — no shed, no roof, just a frame of timber growing on the mud until it was finished and slid sideways into the river. The Merrimack towns turned out an astonishing number of vessels this way. What you are looking at now is quiet riverbank. It used to be the loudest thing for miles.',
  },
  {
    id: 'salt-hay-farming', x: 24286, z: -6863, icon: '🐄', title: 'Farming Without Planting', year: 'the 1600s–1800s',
    body: 'Salt hay is the grass that grows in a marsh on its own, and for two hundred years farmers here cut it every year without ever having sown a seed. They worked out how to do it on soft ground — special wide-shoed horses, staddles to stack the hay on so it stayed above the tide. It is farming a landscape rather than a field, and it lasted centuries.',
  },
  {
    id: 'salisbury-beach', x: 30490, z: 13192, icon: '🎡', title: 'Four Miles of Beach', year: 'now',
    body: 'A long straight run of Atlantic sand, which is a different animal from the rocky coves further south. No coves, no islands, no shelter — just beach, dunes and open ocean. It is why this end of the coast became a place people came to for fun rather than for fish. There was nothing to hide behind, and nothing you needed to.',
  },
  {
    id: 'the-amusements', x: 28321, z: 13283, icon: '🍦', title: 'The Loudest Corner of the Coast', year: 'since the 1800s',
    body: 'Once trains and then cars could reach the beach, somebody put up a carousel, and then somebody put up more. A century of arcades, fried dough, rides and noise followed. Beach amusement parks are one of the few kinds of place built for absolutely no reason except enjoying yourself, which is exactly why generations of people remember them so fiercely.',
  },
  {
    id: 'the-dunes', x: 25212, z: -1848, icon: '🏖', title: 'The Dunes Are Alive', year: 'always',
    body: 'The sandy hills behind the beach are not scenery — they are the defence. Dunes absorb storms; without them the sea comes straight through. They are held together entirely by beach grass, whose roots run astonishingly deep, and they fall apart when people walk over them enough. That is the whole reason for the boardwalks and the “keep off” signs. It is not fussiness. It is engineering.',
    stamp: '★ WALK ON THE BOARDWALK'
  },
  {
    id: 'the-jetties', x: 30017, z: 16480, icon: '🪨', title: 'The Arms in the Water', year: 'the 1880s',
    body: 'Two long walls of granite run out into the sea where the river meets it. They are there because a river mouth naturally silts up and shifts, and ships kept running aground. The jetties force the current to scour its own channel deep. It is a very simple, very heavy idea: make the river dig its own doorway, using nothing but rocks and time.',
  },
  {
    id: 'the-hurricane-coast', x: 10543, z: 437, icon: '🌀', title: 'The Storms That Rearrange It', year: 'again and again',
    body: 'An open beach facing the North Atlantic gets hit, and hard — great winter storms and the occasional hurricane have flattened cottages, moved the dunes and rewritten the shoreline here more than once. People rebuild every time. The coast is not a fixed thing that storms damage; it is a thing that storms are constantly making, and we happen to have put houses on it.',
  },
];
