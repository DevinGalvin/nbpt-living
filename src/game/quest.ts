import * as THREE from 'three';
import { WorldIndex } from '../world/index';
import { Hud } from './hud';
import { GameAudio } from './audio';
import { ITEMS, EMOJI_TO_ID, type BagItem, type Mission } from './items';
import { WATER_Y } from '../three/water';
import { buildKayak } from '../three/actors';

// Chapter 1 — "Overdue" (the player-facing first chapter; its save key is the
// legacy "nbpt-ch0-step"). Gram's errand: get donuts + return the overdue book,
// report back to Gram, then Clipper finds the grate behind the Firehouse. The
// QuestRunner owns quest NPCs, the objective beacon, dialogue flow, and persistence.

type Line = { who: string; text: string };

const SAVE_KEY = 'nbpt-ch0-step';

// the story is organized into named LEVELS; chapters renumber within each level.
const L1_NAME = 'The Smugglers’ Map';   // Level 1 — the five shipped chapters
const L2_NAME = 'The Light That Walks'; // Level 2 — the gated lighthouse arc

// world-px anchors (verified against world.json / in-game)
const GRAM = { x: -48, z: 4, face: 0.9 };
const DONUT = { x: -608, z: 756, face: 0.78 };
const LIB = { x: -872, z: 2312, face: 1.57 };  // at the library's State St entrance
const GRATE = { x: -331, z: -552 };

// Chapter 4 "Low Water" + Chapter 5 "The Custom House Star" anchors (world-px)
const BOAT = { x: 3465, z: -178 };     // the rowboat on the bank, past the Coast Guard station
const WDOOR = { x: -224, z: -1183 };   // the waterline door below the seawall (Wharf Rats' den)
const KEEPER = { x: 1087, z: -500 };   // the Custom House keeper
const CELLAR = { x: 986, z: -438 };    // the Custom House cellar — the star room
const BELL_CG = { x: 3030, z: 75 };    // harbor bell by the Coast Guard station
const BELL_WHARF = { x: 40, z: -905 }; // harbor bell at the wharf

// Chapter 6 "The Light That Walks" (Level 2 — gated behind ?l2 / localStorage
// nbpt-l2). A light out past the river mouth that shouldn't be there.
const JOPPA = { x: 7200, z: 3950, face: -2.2 };  // the birdwatcher at Joppa Flats
const LIGHT = { x: 12000, z: -2200 };            // the mystery light, way out on the dark water NE of Joppa
// Chapter 2 "The Walking Light" — Gram's Joppa home, the slip her late husband's kayak
// is tied at, and the old lighthouse foundation out at the light.
const GRAM_HOME = { x: 7450, z: 4250, face: 2.4 };  // Gram lives in Joppa now (post Level 1)
const SLIP = { x: 7950, z: 4430 };                  // the Joppa slip — the kayak is tied here
const LOBSTER = { x: 9570, z: 1780, face: 2.6 };    // the lobsterman's boat, anchored out on the water on the paddle home from the light — you meet him there (Ch3 & Ch4 start)
// Ch3: the keeper's marker-lamps, scattered on the water around the foundation and blown
// dark by the gale — you paddle to each and RELIGHT it. Two on the south approach, two
// past the light to the north.
const DECOYS = [
  { x: 11720, z: -2030 }, { x: 12290, z: -2060 },
  { x: 11760, z: -2420 }, { x: 12300, z: -2380 }
];
// Chapter 4 "Bring the Light Home" (Level 2 finale) — the storm night. The real harbor
// light is dark; you climb the downtown Rear Range Light, relight it, and sweep its beam
// across the water to guide the lost boats home up the river. NO peril, NO rescue.
const TOWER = { x: 2412, z: 93 };          // the Rear Range Light (the HERO brick tower, decor.ts)
// the lost boats out on the dark harbor north of the tower — the beam sweeps across them
const LOST = [
  { x: 1700, z: -1180 }, { x: 2150, z: -1320 }, { x: 2680, z: -1280 }, { x: 3150, z: -1080 }
];
const FLEET_HOME = { x: 1150, z: -1300 };  // up the river to the west — where the fleet (led by the Coast Guard) gathers

const GRAM_TALK: Line[] = [
  { who: 'Gram', text: 'There you are. Two jobs today. Take Clipper, the dog — he’s in charge.' },
  { who: 'Gram', text: 'One: donuts from the Angry Donut, on Inn Street. Tell them they’re for Gram.' },
  { who: 'Gram', text: 'Two: this book goes back to the library. It was due in March.' },
  { who: 'Gram', text: '…of last year. It was your grandfather’s. He never did finish it.' },
  { who: '', text: 'On the worn leather cover, almost rubbed away: an anchor, inside a circle.' },
  { who: 'You', text: 'Gram — what’s this little mark on the cover?' },
  { who: 'Gram', text: 'Never you mind. Somebody scribbled all over the back pages, too. Leave it be.' },
  { who: 'Gram', text: 'Go on. This town isn’t getting any younger, and neither am I.' }
];
const DONUT_TALK: Line[] = [
  { who: 'Donut Maker', text: 'Gram’s order? Brave kid.' },
  { who: 'Donut Maker', text: 'One dozen, extra angry. Careful with the box.' },
  { who: 'Donut Maker', text: 'That old book under your arm — haven’t seen one made like that in years.' },
  { who: '', text: 'He points at the floor by the door. Built right into the old tiles: an anchor in a circle. The same mark.' },
  { who: 'Donut Maker', text: 'That was here before me. Nobody knows who put it there. Watch the gulls out there — they’ve got a system.' }
];
const LIB_TALK: Line[] = [
  { who: 'Librarian', text: 'One book, a year late. We won’t make a fuss.' },
  { who: '', text: 'She turns it over to scan it — and stops. No barcode. No card in the back. No stamp anywhere.' },
  { who: 'Librarian', text: 'This was never ours, dear. Someone made it to LOOK like a library book.' },
  { who: 'Librarian', text: 'And look — somebody wrote a list on the last page. Fair. Federal. Lime. Temple. Right next to that same little anchor.' },
  { who: 'You', text: 'Those are all street names.' },
  { who: 'Librarian', text: 'Your grandfather drew that anchor on everything. He sat in this very room for years — said this old house had a door nobody could open.' },
  { who: 'Librarian', text: 'George Washington even slept here, way back in 1789. Here — a library card, all your own. Bring this one back on time, hm?' }
];
const GRATE_TALK: Line[] = [
  { who: 'You', text: 'Clipper? What’ve you got, bud—' },
  { who: '', text: 'Through the bars: old brick. A round stone doorway. Stairs, going down into the dark.' },
  { who: '', text: 'And right by your feet, half-hidden under the leaves: an anchor in a circle. Again.' },
  { who: 'Passer-by', text: 'Storm drain.' },
  { who: '', text: 'He doesn’t even look up from his coffee.' },
  { who: 'You', text: 'Storm drains don’t have a mark like that.' },
  { who: 'You', text: 'The book. The donut shop. Now here. It’s the same one, Clipper — it’s a door.' }
];
const GRAM_END: Line[] = [
  { who: 'Gram', text: 'Donuts safe, book returned. And you’ve got the look.' },
  { who: 'You', text: 'What look?' },
  { who: 'Gram', text: 'Your grandfather’s look. He always had it right before the harbormaster called.' },
  { who: 'You', text: 'Gram — the librarian says Grandpa drew that anchor everywhere. It’s even on the donut shop floor. What was he up to?' },
  { who: 'Gram', text: '…' },
  { who: 'Gram', text: 'Keep the card, kid. Newburyport is full of doors. He used to say that, too.' }
];
const FLAVOR: Record<string, Line[]> = {
  gram: [{ who: 'Gram', text: 'Doors, kid. Everywhere. He’d know.' }],
  donut: [{ who: 'Donut Maker', text: 'Next batch comes out angrier.' }],
  lib: [{ who: 'Librarian', text: 'Read those back pages all you like now. We open at nine.' }]
};

// Chapter 2 — the paper route (real addresses; the last stop is Garrison's street)
const ROUTE: [string, string][] = [
  ['Fair Street', '7'], ['Fair Street', '21'], ['Orange Street', '9'], ['Lime Street', '29'],
  ['Federal Street', '11'], ['Federal Street', '26'], ['Temple Street', '14'], ['School Street', '5']
];
const ED_INTRO: Line[] = [
  { who: 'Editor', text: 'You’re the kid who found a tunnel. News travels.' },
  { who: 'You', text: 'How did—' },
  { who: 'Editor', text: 'Small city. Big paper.' },
  { who: 'Editor', text: 'My paper kid quit to go work on a lobster boat. Eight houses in the South End need today’s paper.' },
  { who: 'Editor', text: 'Deliver them all, and I’ll let you into the morgue.' },
  { who: 'You', text: 'The… morgue?! Like, bodies?' },
  { who: 'Editor', text: 'Ha! No. It’s just our funny name for the room where we keep every paper we ever printed. Old maps. Older secrets.' },
  { who: 'Editor', text: 'Last house is on School Street. Keep your eyes open.' }
];
const ED_BIKE: Line[] = [
  { who: 'Editor', text: 'Eight for eight, every paper on a porch. You’re hired forever.' },
  { who: 'Editor', text: 'The paper kid gets the bike. Garrison did this route on foot — you get the upgrade.' },
  { who: 'Editor', text: 'Morgue’s open. Watch the dust — it’s older than your grandmother.' }
];
const MORGUE_FIND: Line[] = [
  { who: '', text: 'Boxes of old yellow paper. Maps. And a folder marked WHARF RATS — 1808.' },
  { who: '', text: 'Inside: another corner of the smugglers’ map. It shows a door below State Street, right down at the water.' },
  { who: '', text: 'Next to it, in old ink: “only open at the low water.”' },
  { who: 'You', text: 'Low tide, Clipper. We need a boat.' }
];
const SCHOOL_ST: Line[] = [
  { who: '', text: 'Last house. A little sign by the door: a paper kid grew up here — William Lloyd Garrison.' },
  { who: 'You', text: 'Same route as me.' }
];

const STEP_OBJECTIVE: (string | null)[] = [
  'Find Gram in Market Square',
  'Get the donuts — The Angry Donut, Inn Street',
  'Return Gram’s book — the library, State Street',
  'Bring Gram her donuts — back to Market Square',
  'Clipper’s run off — follow him',
  'See what Clipper found',
  null
];
// 📕 book · 🍩 donuts · 🪪 library card. Donuts are delivered to Gram at step 3.
const STEP_CHIPS: string[][] = [[], ['\u{1F4D5}'], ['\u{1F4D5}', '\u{1F369}'], ['\u{1F369}', '\u{1FAAA}'], ['\u{1FAAA}'], ['\u{1FAAA}'], ['\u{1FAAA}']];

// Chapter 4 — "Low Water": the rowboat to the Wharf Rats' den below State Street
const BOAT_TALK: Line[] = [
  { who: '', text: 'An old rowboat under the dock, oars tucked inside. The tide is out — the mud shines silver in the sun.' },
  { who: 'You', text: '“Only open at the low water.” That’s right now, Clipper.' },
  { who: '', text: 'Clipper jumped in first. Of course he did.' }
];
export const BOAT_ARRIVE: Line[] = [
  { who: '', text: 'The oars creak. The town slides past above the stone wall, then it’s just gulls and quiet.' },
  { who: '', text: 'You pull up onto the mud. Half-buried in seaweed: an iron door, with an anchor in a circle carved deep.' },
  { who: 'You', text: 'Same mark as the tunnel. We found it.' }
];
const SEAWALL_LOOK: Line[] = [
  { who: '', text: 'You lean over the railing. Far below, the stone wall drops straight down to the mud.' },
  { who: 'You', text: 'No ladder. No stairs. Twenty feet of slippery stone.' },
  { who: 'You', text: '“Only open at the low water.” From the river, Clipper — we need that rowboat.' }
];
const DEN_LEDGER: Line[] = [
  { who: '', text: 'Dry brick, up where the tide never reaches. Old crates, stamped 1808. Nobody’s been down here in two hundred years.' },
  { who: '', text: 'On a barrel: a notebook. WHARF RATS, in faded ink. A list of names underneath.' },
  { who: 'You', text: 'Clipper — I know these names. They’re streets. Half the town.' }
];
const DEN_MAP: Line[] = [
  { who: '', text: 'Pinned under glass: the third corner of the map.' },
  { who: '', text: 'It shows the tunnels, the door, and a room under the Custom House — marked with a star.' },
  { who: 'You', text: 'They split the map in four, so no one Rat could steal the rest. One corner left.' }
];
const DEN_BELL: Line[] = [
  { who: '', text: 'In the corner, green with age: a ship’s bell.' },
  { who: '', text: 'You ring it once, soft. Somewhere above, through brick and earth, a gull answers.' },
  { who: 'You', text: 'Found you. All of you.' }
];

// Chapter 5 — "The Custom House Star": first carry the three corners back to Gram
// (she knew all along — your grandfather drew half the map), then the keeper, the
// harbor bells, and the room with no door.
const GRAM_CORNERS: Line[] = [
  { who: 'You', text: 'Gram — three of them. Corners of some old map.' },
  { who: 'Gram', text: 'Huh. I wondered if those were still down there.' },
  { who: 'You', text: 'You KNEW about this?' },
  { who: 'Gram', text: 'Your grandfather drew half that map. Never did find the last piece.' },
  { who: 'Gram', text: 'It’s under the Custom House. Always was.' },
  { who: 'Gram', text: 'Told you — this town is full of doors. I’ll call ahead; Marta’s kept that one longer than you’ve been alive.' }
];
const KEEPER_TALK: Line[] = [
  { who: 'Keeper', text: 'Gram’s grandkid. She called — said you’d come carrying three corners of an old map.' },
  { who: 'Keeper', text: 'There’s a room in here no key opens. No door at all — just a star on the old plans.' },
  { who: 'Keeper', text: 'The Wharf Rats locked it with sound. Ring the harbor’s three bells and the wall swings open.' },
  { who: 'Keeper', text: 'You already rang one, down in their den. Two left — the Coast Guard station, and the old docks.' },
  { who: 'You', text: 'Ring both. Got it.' },
  { who: 'Keeper', text: 'Go on. Then listen for that third bell to answer.' }
];
const BELL_RING: Line[] = [
  { who: '', text: 'You ring it once. The note rolls out over the water. One down.' }
];
const BELL_LAST: Line[] = [
  { who: '', text: 'The third note lands. Deep under the town, something heavy turns over — like a giant lock opening.' },
  { who: 'You', text: 'The Custom House. GO!' }
];
const CORNER_FOUR: Line[] = [
  { who: '', text: 'On the old desk: the fourth corner. The map is whole now — tunnels, door, den, and the star you’re standing on.' },
  { who: 'You', text: 'Every corner. We found all of it.' },
  { who: 'You', text: 'And whatever they hid is right under us. Real treasure this time, Clipper — has to be.' }
];
const CHEST_OPEN: Line[] = [
  { who: '', text: 'The chest is wood, banded in brass — and way too light for gold.' },
  { who: '', text: 'Inside? No gold. Just old papers — a list of things they built. A dock. A school. The library.' },
  { who: 'You', text: 'They didn’t bury the treasure, Clipper. They spent it. On the whole town.' }
];

// Chapter 6 "The Light That Walks" — beat 1: the Joppa Flats birdwatcher hands over
// her spare binoculars, and you spot a light out past the lighthouse that shouldn't
// be there. Earns the binoculars; sends you to Gram. (Level 2 — gated.)
const WATCHER_INTRO: Line[] = [
  { who: 'Birdwatcher', text: 'You’re the kid who found the doors under downtown. Figures you’d turn up out here at the end of the world.' },
  { who: 'You', text: 'Is that what Joppa is?' },
  { who: 'Birdwatcher', text: 'Joppa Flats. Best birding in the state — and the mud’ll take your boot clean off if you sass it.' },
  { who: 'Birdwatcher', text: 'These flats fed the whole town once. Low tide, everyone was out here digging clams by the bucket.' },
  { who: 'You', text: 'People dug dinner out of the mud?' },
  { who: 'Birdwatcher', text: 'Best clams in New England.' },
  { who: 'Birdwatcher', text: 'Anyway — here. My spare binoculars. I count ducks; you count whatever’s keeping you up at night.' },
  { who: 'Birdwatcher', text: 'See the lighthouse, out at the river mouth? Good. Now look a little to the left of it…' }
];
// shown AFTER the camera swings out to the light, so you're seeing it as she names it
const WATCHER_REVEAL: Line[] = [
  { who: '', text: 'There. Low over the dark water — another light. Small. Steady. Right where the map says there’s nothing at all.' },
  { who: 'You', text: 'There’s no lighthouse out there.' },
  { who: 'Birdwatcher', text: '…No. There isn’t.' },
  { who: 'Birdwatcher', text: 'Comes on after dark, gone by morning. A week of it now, and nobody on these flats will say a word.' },
  { who: 'Birdwatcher', text: 'But your grandmother might. She’s watched this town do stranger things than this.' }
];

// Chapter 2 "The Walking Light" — home to Gram (Joppa), then the slip, then paddle out
const GRAM_KAYAK: Line[] = [
  { who: 'You', text: 'Gram — there’s a light out past the lighthouse. Right where the chart says there’s nothing.' },
  { who: 'Gram', text: '…So you’ve seen it too.' },
  { who: 'You', text: 'You KNOW about it?' },
  { who: 'Gram', text: 'Your grandfather chased that light for years.' },
  { who: 'Gram', text: 'Rowed out after it more nights than I could count.' },
  { who: 'Gram', text: 'Never would say what he found. Only that the chart was wrong, and the old-timers weren’t.' },
  { who: 'You', text: 'I want to see it.' },
  { who: 'Gram', text: 'Course you do. His kayak’s still tied at the slip, down the end of the street.' },
  { who: 'Gram', text: 'Been waiting for someone stubborn enough.' },
  { who: 'Gram', text: 'Go on. Keep your eyes on the water, not your feet.' }
];
const SLIP_TAKE: Line[] = [
  { who: '', text: 'At the end of the slip, tied to a worn iron ring: a long red kayak. Faded, but solid — a paddle lying across the deck, ready to go.' },
  { who: 'You', text: 'Grandpa’s kayak.' },
  { who: '', text: 'You untie it. It still rides true.' },
  { who: 'You', text: 'Out to the light, Clipper. Hop in.' }
];
const WALK_REVEAL: Line[] = [
  { who: '', text: 'You paddle out to the light — and find it sitting on the water: not a light at all, but a ring of old granite blocks, half-drowned by the tide.' },
  { who: 'You', text: 'It’s a foundation. Something STOOD here.' },
  { who: '', text: 'Cut into the cornerstone, worn but certain: a little lighthouse — and an arrow, pointing up the beach toward where the lighthouse stands today.' },
  { who: 'You', text: 'It moved. The whole lighthouse moved off this spot.' },
  { who: 'You', text: 'It WALKED, Clipper. The light that walks is real.' },
  { who: 'You', text: 'This “ghost” out here? Just where it used to stand.' },
  { who: 'You', text: 'So who’s been lighting it?' }
];

// Chapter 3 "The Lamplighter" — beat 1: a salty lobsterman, met out on the water as you paddle
// home, explains that the "ghost light" is old Eben — a keeper, your grandfather's friend, who
// rows out and lights the drowned foundation every night. The gale keeps snuffing his lamps and
// his hands are too stiff to keep up, so he sends you out to relight them for him.
const LOBSTER_KEEPER: Line[] = [
  { who: '', text: 'A lobster boat rides the swell on your way in, traps stacked high. A waterman in oilskins, beaded with spray, lifts a hand and waves you over.' },
  { who: 'Lobsterman', text: 'You’re the one paddlin’ your grandfather’s kayak. Figured you’d come askin’ about that light.' },
  { who: 'You', text: 'Who’s lighting it?' },
  { who: 'Lobsterman', text: 'No ghost out there. That’s old Eben — rows out every night and lights a lamp on the drowned foundation. Has for years.' },
  { who: 'Lobsterman', text: 'Since your grandfather stopped, some say. The two of ’em chased that light together, back when.' },
  { who: 'You', text: 'But the lighthouse moved. Why keep lighting an empty spot?' },
  { who: 'Lobsterman', text: 'A man gets used to a star. Trouble is, his hands are too stiff now — the wind keeps blowin’ his lamps out faster’n he can strike ’em.' },
  { who: 'Lobsterman', text: 'And there’s weather coming. Paddle out and light ’em for him, every last one — don’t leave the old fella out there alone.' },
  { who: 'You', text: 'Light every lamp. Come on, Clipper.' }
];
// beat 2: relit every lamp and reached Eben at his last one — he knew your grandfather, hands you
// the watch, and lets the old light rest (no peril, no villain).
const KEEPER_MEET: Line[] = [
  { who: '', text: 'His last lamp — and the man himself, hunched over it on the old foundation, white hair wind-tossed, a wool cap pulled low.' },
  { who: 'Keeper', text: 'You lit every one. Haven’t seen her burn this bright in years.' },
  { who: '', text: 'You lean across and light the last wick. The whole ring of lamps glows warm against the dark water.' },
  { who: 'Keeper', text: 'You’ve got his stroke, you know — your grandfather’s. I’d know that paddle anywhere.' },
  { who: 'You', text: 'You knew him?' },
  { who: 'Keeper', text: 'Kept this light between us, him and me. The harbor moved its real light ashore years back. But a man gets used to a star.' },
  { who: 'Keeper', text: 'She’s had her good night now. Time I let her rest — I’ll see the lamps to bed.' },
  { who: 'Keeper', text: 'There’s a hard blow coming in off the water. Get yourself home, kid — and if this town ever needs its light kept… well. You’ve got the hands for it now.' },
  { who: 'You', text: 'Goodnight, Eben. Come on, Clipper — let’s beat the storm in.' }
];

// Chapter 4 "Bring the Light Home" — beat 1: the storm is here, the harbor light is dark,
// and the lobsterman sends you to wake the old downtown Range Light and sweep its beam.
const LOBSTER_STORM: Line[] = [
  { who: '', text: 'The wind has teeth now. Snow blows sideways off the water, and every boat in the harbor is just a dark shape out in it. The lobster boat looms up out of the murk, the waterman hunched at the wheel.' },
  { who: 'Lobsterman', text: 'There you are — out on the water in this. Bad night for it, kid.' },
  { who: 'You', text: 'The harbor light. It’s gone OUT.' },
  { who: 'Lobsterman', text: 'Storm took it. Half the fleet’s still out, and not one true light to steer by. They’ll pile up on the sandbar in this.' },
  { who: 'You', text: 'Then we light another one.' },
  { who: 'Lobsterman', text: 'Aye — the old Range Light, downtown by the water. Brick tower. Climb her and wake that lamp up.' },
  { who: 'Lobsterman', text: 'Then sweep the beam slow across the water. A boat that catches it will turn and follow it home. Go on — bring the light home.' }
];
// beat 2: at the top of the tower, you relight the cold lamp and the beam swings on.
const TOWER_LIGHT: Line[] = [
  { who: '', text: 'A spiral stair climbs the brick tower to a cold glass lantern room. The big lamp sits dark, waiting.' },
  { who: 'You', text: 'Okay… wick’s dry, glass is clean.' },
  { who: '', text: 'You strike the lamp. It catches — small, then sure — and a long beam swings out across the black harbor.' },
  { who: 'You', text: 'Now we find them, Clipper. Sweep it slow.' }
];
// beat 4: every boat is in the beam and following it home; the town answers light-for-light.
const BRING_HOME: Line[] = [
  { who: '', text: 'One by one the boats turn into the beam and follow it up the river, lanterns blinking on like the light woke them.' },
  { who: '', text: 'A Coast Guard boat swings out to lead them in, strung with lights, and the whole fleet lines up the dark water behind it.' },
  { who: '', text: 'The town answers — light for light. Market Square’s tree blazes on, windows warm, the streetlamps glow gold all the way to the wharf.' },
  { who: 'Lobsterman', text: 'That’s my boat in the line, kid! You brought every last one of us home.' },
  { who: 'You', text: 'It was never really ours, was it — the light. You don’t get to own it. You just keep it lit.' }
];

function cap(r: number, h: number, hex: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, h, 3, 10), new THREE.MeshLambertMaterial({ color: hex }));
  m.castShadow = true;
  return m;
}
function sph(r: number, hex: string, sx = 1, sy = 1, sz = 1): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshLambertMaterial({ color: hex }));
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  return m;
}
function box(w: number, h: number, d: number, hex: string): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: hex }));
  m.castShadow = true;
  return m;
}

// little standing townsperson, same blocky register as the kid
function npcMesh(skin: string, shirt: string, pants: string, hair: string, extra?: 'bun' | 'cap' | 'apron'): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) {
    const leg = cap(2, 5, pants);
    leg.position.set(s * 2.4, 6, 0);
    g.add(leg);
    const arm = cap(1.5, 5.5, shirt);
    arm.position.set(s * 5.7, 15, 0);
    g.add(arm);
  }
  const body = cap(4.4, 7, shirt);
  body.position.y = 15.5;
  g.add(body);
  const head = sph(4.6, skin);
  head.position.y = 25.8;
  g.add(head);
  const hairCap = sph(4.75, hair, 1, 0.62, 1);
  hairCap.position.y = 27.6;
  g.add(hairCap);
  if (extra === 'bun') {
    const bun = sph(1.9, hair);
    bun.position.set(0, 29.6, -2.2);
    g.add(bun);
  }
  if (extra === 'cap') {
    const brim = box(6.4, 0.9, 3.4, hair);
    brim.position.set(0, 27.4, 4.4);
    g.add(brim);
  }
  if (extra === 'apron') {
    const ap = box(7.6, 8.5, 0.9, '#b03a32');
    ap.position.set(0, 14.5, 4.1);
    g.add(ap);
    const tie = box(8.6, 1.1, 0.7, '#8e2f28');
    tie.position.set(0, 19.2, 4);
    g.add(tie);
  }
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(8, 16).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x10141a, transparent: true, opacity: 0.22, depthWrite: false })
  );
  shadow.position.y = 0.25;
  g.add(shadow);
  return g;
}

// the recurring clue — a bronze "anchor in a circle" medallion set into the
// pavement. Chapter 1 plants it at the donut shop, the library, and the grate so
// the PLAYER (not the dog) connects the mark across town to the door under it.
function anchorMedallionTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  const cx = 64, cy = 64;
  g.beginPath();                                  // bronze disc
  g.arc(cx, cy, 60, 0, Math.PI * 2);
  g.fillStyle = '#9c7a40';
  g.fill();
  g.lineWidth = 6;                                // engraved outer ring
  g.strokeStyle = '#5f4922';
  g.beginPath();
  g.arc(cx, cy, 50, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = '#463417';                      // the anchor, engraved dark
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 7;
  g.beginPath(); g.moveTo(cx, 36); g.lineTo(cx, 94); g.stroke();             // shank
  g.beginPath(); g.moveTo(cx - 18, 50); g.lineTo(cx + 18, 50); g.stroke();   // stock
  g.beginPath(); g.arc(cx, 32, 7, 0, Math.PI * 2); g.stroke();               // top ring
  g.beginPath(); g.arc(cx, 70, 28, Math.PI * 0.12, Math.PI * 0.88); g.stroke(); // arms
  g.beginPath(); g.moveTo(cx - 27, 80); g.lineTo(cx - 34, 64); g.stroke();   // fluke tips
  g.beginPath(); g.moveTo(cx + 27, 80); g.lineTo(cx + 34, 64); g.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

function bangSprite(): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d')!;
  g.font = '900 52px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 9;
  g.strokeStyle = 'rgba(20, 26, 34, 0.95)';
  g.strokeText('!', 32, 34);
  g.fillStyle = '#ffd24a';
  g.fillText('!', 32, 34);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  sp.scale.set(13, 13, 1);
  return sp;
}

export class QuestRunner {
  dogTarget: { x: number; z: number } | null = null;

  private step: number;
  private scene: THREE.Scene;
  private index: WorldIndex;
  private hud: Hud;
  private audio: GameAudio;
  private t = 0;

  private npcs: Record<string, THREE.Group> = {};
  private beacon: THREE.Group;
  private beaconRing: THREE.Mesh;
  private beaconBeam: THREE.Mesh;
  private beaconHalo: THREE.Mesh;
  private beaconCore: THREE.Mesh;
  private bang: THREE.Sprite;
  private grate: THREE.Group;
  private grateBars: THREE.Group | null = null;
  private nearTag: string | null = null;
  private onGoDown: () => void;
  private onBike: () => void;
  private onBoat: () => void;   // ROW the boat out to the den (Game drives the ride)
  private onStar: () => void;   // ENTER the Custom House cellar (the star room)
  private onNews: () => void;   // ENTER the Daily News newsroom (Chapter 3)
  private onDen: () => void;    // re-ENTER the den if you stepped out before finishing Ch4
  private onLookSea: (x: number, z: number) => void;   // Level 2: cinematic cutaway to the mystery light
  private onLookEnd: () => void;                        // …and back to the normal chase cam
  private onKayak: () => void;                          // launch the player into the kayak (take it at the slip)
  private onReturnAshore: (x: number, z: number) => void;  // Level 2: end-of-chapter return to shore (no stranding at sea)
  private onStorm: () => void;        // Level 2 finale: bring on the nor'easter (idempotent)
  private onSweep: () => void;        // …climb the Rear Range Light + take the beam (locks the player, lifts the camera)
  private onSweepEnd: () => void;     // …the fleet's home — drop the sweep + calm the storm to Christmas morning
  private ch2: number;
  private ch3: number;
  private ch4: number;
  private ch5: number;          // Level 2 Chapter 1 "The False Light" (legacy key nbpt-ch5-step)
  private ch6: number;          // Level 2 Chapter 2 "The Walking Light" (legacy key nbpt-ch6-step)
  private ch7: number;          // Level 2 Chapter 3 "The Mooncusser" (legacy key nbpt-ch7-step)
  private ch8: number;          // Level 2 Chapter 4 "Bring the Light Home" — the finale (legacy key nbpt-ch8-step)
  private l2: boolean;          // Level 2 gate (?l2 → localStorage nbpt-l2)
  private l2built = false;      // lazily spawn the Joppa props once Level 1 ends
  private mysteryLight: THREE.Group | null = null;   // the light out on the water (Ch1 reveal → Ch2 target)
  private foundation: THREE.Group | null = null;     // the old lighthouse base under the light (Ch2 reveal)
  private decoyLights: THREE.Group[] = [];           // the keeper's scattered marker-lamps you relight (Ch3)
  private litLamps = new Set<number>();              // which of the keeper's lamps you've relit
  private tiedKayak: THREE.Group | null = null;      // the ride kayak parked at the Joppa slip; update() hides it while you're paddling
  private beam: THREE.Group | null = null;           // the Rear Range Light's sweeping beam (Ch4 finale)
  private lostBoats: THREE.Group[] = [];             // the boats out in the storm — the beam guides them home
  private caught = new Set<number>();                // which boats the beam has turned toward home
  private cgBoat: THREE.Group | null = null;         // the festive Coast Guard boat that leads the fleet in (the town-answer)
  private stormStarted = false;                      // the finale storm ambiance is engaged (guards re-triggering onStorm)
  private beamLit = false;                           // the tower lamp is lit (set when you relight it; the beam shows)
  private homing = false;                            // the fleet is tweening up the river to FLEET_HOME
  // explore vs play: when story mode is off, apply() suppresses the objective pill,
  // the gold beacon/“!”, and the journey guide, and update() skips the proactive
  // auto-story triggers — the town stays explorable, the cast still talks on TALK,
  // but nothing pushes you anywhere. Re-enabling resumes exactly where you left off.
  private storyOn = true;
  private bells: Set<string>;
  private rowboat: THREE.Group | null = null;
  private c5built = false;
  private gramSent = false;   // Ch5: shown Gram the three corners → she sends you on (gates the keeper)
  private stops: { x: number; z: number }[] = [];
  private delivered: Set<number>;
  private editorPos = { x: 764, z: 342 };
  private papers: { m: THREE.Mesh; t: number; from: { x: number; z: number }; to: { x: number; z: number } }[] = [];

  constructor(scene: THREE.Scene, index: WorldIndex, hud: Hud, audio: GameAudio, onGoDown: () => void, onBike: () => void,
              onBoat: () => void, onStar: () => void, onNews: () => void, onDen: () => void,
              onLookSea: (x: number, z: number) => void, onLookEnd: () => void, onKayak: () => void,
              onReturnAshore: (x: number, z: number) => void,
              onStorm: () => void, onSweep: () => void, onSweepEnd: () => void) {
    this.scene = scene;
    this.index = index;
    this.hud = hud;
    this.audio = audio;
    this.onGoDown = onGoDown;
    this.onBike = onBike;
    this.onBoat = onBoat;
    this.onStar = onStar;
    this.onNews = onNews;
    this.onDen = onDen;
    this.onLookSea = onLookSea;
    this.onLookEnd = onLookEnd;
    this.onKayak = onKayak;
    this.onReturnAshore = onReturnAshore;
    this.onStorm = onStorm;
    this.onSweep = onSweep;
    this.onSweepEnd = onSweepEnd;
    // explore vs play. A returning player (already welcomed) keeps the story on as
    // before; a brand-new visitor starts in explore mode (no banner, no beacon) and
    // is offered the choice via the first-run mode pick. nbpt-story, once set by the
    // pick or the settings toggle, is authoritative.
    try {
      const s = localStorage.getItem('nbpt-story');
      this.storyOn = s === null ? (localStorage.getItem('nbpt-welcomed') === '1') : s === '1';
    } catch { this.storyOn = true; }
    this.step = Math.min(6, Math.max(0, parseInt(localStorage.getItem(SAVE_KEY) || '0', 10) || 0));
    this.ch2 = Math.min(4, Math.max(0, parseInt(localStorage.getItem('nbpt-ch2-step') || '0', 10) || 0));
    this.ch3 = Math.min(4, Math.max(0, parseInt(localStorage.getItem('nbpt-ch3-step') || '0', 10) || 0));
    this.ch4 = Math.min(4, Math.max(0, parseInt(localStorage.getItem('nbpt-ch4-step') || '0', 10) || 0));
    // Level 2 unlocks when Level 1 is finished: nbpt-seasons-rewarded is the one-time
    // "completed L1" flag (set in Game.unlockSeasons), so any L1-completer — past or
    // future — gets Chapter 6+. ?l2=1 latches nbpt-l2 as a dev override to jump straight
    // to Level 2 without finishing L1. Chapter 6 = the legacy "ch5-step" (off-by-one keys
    // continue: ch0-step = player Ch1 … ch5-step = Ch6).
    try {
      if (new URLSearchParams(location.search).has('l2')) localStorage.setItem('nbpt-l2', '1');
      this.l2 = localStorage.getItem('nbpt-l2') === '1'
        || localStorage.getItem('nbpt-seasons-rewarded') === '1';
    } catch { this.l2 = false; }
    this.ch5 = Math.min(9, Math.max(0, parseInt(localStorage.getItem('nbpt-ch5-step') || '0', 10) || 0));
    this.ch6 = Math.min(9, Math.max(0, parseInt(localStorage.getItem('nbpt-ch6-step') || '0', 10) || 0));
    this.ch7 = Math.min(9, Math.max(0, parseInt(localStorage.getItem('nbpt-ch7-step') || '0', 10) || 0));
    const dmask = parseInt(localStorage.getItem('nbpt-ch7-decoys') || '0', 10) || 0;   // bitmask of relit lamps
    for (let i = 0; i < DECOYS.length; i++) if (dmask & (1 << i)) this.litLamps.add(i);
    this.ch8 = Math.min(9, Math.max(0, parseInt(localStorage.getItem('nbpt-ch8-step') || '0', 10) || 0));
    const bmask = parseInt(localStorage.getItem('nbpt-ch8-boats') || '0', 10) || 0;    // bitmask of boats guided home
    for (let i = 0; i < LOST.length; i++) if (bmask & (1 << i)) this.caught.add(i);
    // once the finale's done, the Rear Range Light is a free on/off switch you flip by walking
    // up to it — its state persists in nbpt-beam-on (default lit for anyone who already finished).
    if (this.ch8 >= 2) this.beamLit = localStorage.getItem('nbpt-beam-on') !== '0';
    // already past the keeper on an old save? treat the Gram beat as done (no backtrack)
    this.gramSent = localStorage.getItem('nbpt-ch5-gram') === '1' || this.ch4 >= 1;
    try {
      this.bells = new Set(JSON.parse(localStorage.getItem('nbpt-ch4-bells') || '[]'));
    } catch {
      this.bells = new Set();
    }
    // the den's bell rang as the final Ch4 beat — it's the first of the three. Count it
    // once Ch4 is done (also migrates old saves that rang it before it counted, so they
    // don't get stuck needing a fourth bell).
    if (this.ch3 >= 4) this.bells.add('den');
    try {
      this.delivered = new Set(JSON.parse(localStorage.getItem('nbpt-ch2-stops') || '[]'));
    } catch {
      this.delivered = new Set();
    }
    // the route runs to real front doors, straight from the assessor data
    for (const [st, num] of ROUTE) {
      const street = index.world.addrs.find((a) => a.s === st);
      const hit = street ? street.a.find((e) => String(e[0]) === num) : null;
      if (hit) this.stops.push({ x: hit[1], z: hit[2] });
    }
    const lib23 = index.world.addrs.find((a) => a.s === 'Liberty Street');
    const ed = lib23 ? lib23.a.find((e) => String(e[0]) === '23') : null;
    // the parcel point sits inside the footprint; the Editor stands out front
    if (ed) this.editorPos = { x: ed[1] + 34, z: ed[2] - 36 };

    // the cast
    const gram = npcMesh('#e8c5a2', '#9a7fae', '#7d7268', '#e9e6df', 'bun');
    const donut = npcMesh('#caa07c', '#f3efe2', '#4e5a66', '#3c332b', 'apron');
    const lib = npcMesh('#e3b794', '#4e7a74', '#5e564c', '#8e6b4a', 'bun');
    this.npcs = { gram, donut, lib };
    this.place(gram, GRAM.x, GRAM.z, GRAM.face);
    this.place(donut, DONUT.x, DONUT.z, DONUT.face);
    this.place(lib, LIB.x, LIB.z, LIB.face);
    scene.add(gram, donut, lib);
    // the Editor now lives INSIDE the Daily News newsroom (NewsroomScene), reached
    // by entering the building on Liberty Street — no outside editor NPC.
    // papers already delivered stay on their porches
    for (const i of this.delivered) {
      const st = this.stops[i];
      if (st) this.scene.add(this.paperMesh(st.x, st.z));
    }

    // the grate behind the Firehouse — Chapter 1's front door
    this.grate = this.buildGrate();
    scene.add(this.grate);

    // the library's State-Street entrance: a real double door where you're sent
    // to return the book (that wall used to show only a window)
    scene.add(this.buildLibraryDoor());

    // the anchor-in-a-circle clue, seeded in the pavement at the three Chapter 1
    // stops — the donut shop floor, the library step, and beside the grate
    const medTex = anchorMedallionTexture();
    this.placeMedallion(medTex, DONUT.x + 18, DONUT.z - 10);
    this.placeMedallion(medTex, LIB.x + 8, LIB.z);
    this.placeMedallion(medTex, GRATE.x, GRATE.z + 15);

    // gold objective beacon: a TALL pillar of light you can spot from across town —
    // a bright inner shaft, a wider soft halo, a sonar-pinging base ring, and the "!"
    this.beacon = new THREE.Group();
    // additive glow for the ground disc + sonar ring (great against the ground)
    const beamMat = (op: number) => new THREE.MeshBasicMaterial({
      color: 0xffd24a, transparent: true, opacity: op,
      side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending
    });
    // the vertical beam draws on top (depthTest off, NORMAL blending) so it reads
    // the SAME on any background — additive used to vanish over the dark water and
    // only "appear" once it crossed into the sky
    const glowMat = (op: number) => new THREE.MeshBasicMaterial({
      color: 0xffd863, transparent: true, opacity: op,
      side: THREE.DoubleSide, depthWrite: false, depthTest: false
    });
    // a soft filled glow disc marks the exact landing spot
    const disc = new THREE.Mesh(new THREE.CircleGeometry(15, 28).rotateX(-Math.PI / 2), beamMat(0.16));
    disc.position.y = 0.5;
    this.beacon.add(disc);
    // base ring — pings outward (animated in update)
    this.beaconRing = new THREE.Mesh(new THREE.RingGeometry(12, 20, 36).rotateX(-Math.PI / 2), beamMat(0.5));
    this.beaconRing.position.y = 0.7;
    this.beacon.add(this.beaconRing);
    // three concentric translucent layers (outer halo → mid shaft → brighter core),
    // all on top so the beam looks consistent over water, sky, and town
    this.beaconHalo = new THREE.Mesh(new THREE.CylinderGeometry(11, 16, 460, 18, 1, true), glowMat(0.1));
    this.beaconHalo.position.y = 235;
    this.beaconHalo.renderOrder = 10;
    this.beacon.add(this.beaconHalo);
    this.beaconBeam = new THREE.Mesh(new THREE.CylinderGeometry(5, 7.5, 460, 18, 1, true), glowMat(0.2));
    this.beaconBeam.position.y = 235; // spans ~5 .. 465
    this.beaconBeam.renderOrder = 11;
    this.beacon.add(this.beaconBeam);
    this.beaconCore = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 5.6, 460, 16, 1, true), glowMat(0.45));
    this.beaconCore.position.y = 235;
    this.beaconCore.renderOrder = 12;
    this.beacon.add(this.beaconCore);
    scene.add(this.beacon);
    this.bang = bangSprite();
    scene.add(this.bang);

    if (this.step === 4 || this.step === 5) this.dogTarget = { x: GRATE.x, z: GRATE.z };
    this.apply();
  }

  private place(g: THREE.Group, x: number, z: number, face: number) {
    g.position.set(x, this.index.heightAtPx(x, z), z);
    g.rotation.y = face;
  }

  // a bronze medallion laid flat into the pavement (shared texture, slight lift so
  // it reads over the ground canvas without z-fighting)
  private placeMedallion(tex: THREE.CanvasTexture, x: number, z: number) {
    const m = new THREE.Mesh(
      new THREE.CircleGeometry(7, 28).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
    );
    m.position.set(x, this.index.heightAtPx(x, z) + 0.35, z);
    m.rotation.y = Math.random() * Math.PI;
    m.renderOrder = 2;
    this.scene.add(m);
  }

  private buildGrate(): THREE.Group {
    const g = new THREE.Group();
    const pit = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 10.5).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0x101418 })
    );
    pit.position.y = 0.32;
    g.add(pit);
    for (const [w, d, x, z] of [[17, 1.6, 0, -6], [17, 1.6, 0, 6], [1.6, 10.5, -7.7, 0], [1.6, 10.5, 7.7, 0]] as const) {
      const rim = box(w, 1.1, d, '#4a4640');
      rim.position.set(x, 0.55, z);
      g.add(rim);
    }
    // the bars swing open as one lid once Chapter 1 is done
    this.grateBars = new THREE.Group();
    for (let i = -2; i <= 2; i++) {
      const bar = box(0.9, 0.7, 10.5, '#5a564e');
      bar.position.set(i * 2.9, 0.62, 0);
      this.grateBars.add(bar);
    }
    g.add(this.grateBars);
    const x = GRATE.x, z = GRATE.z;
    g.position.set(x, this.index.heightAtPx(x, z), z);
    g.rotation.y = 0.42;
    return g;
  }

  // granite double door on the library's State-Street wall — local +x faces the
  // street (the wall here runs N–S, exterior to the east, so rotation.y stays 0)
  private buildLibraryDoor(): THREE.Group {
    const g = new THREE.Group();
    const pale = '#e7e3d8', leafHex = '#33433a';
    for (const dz of [-5.4, 5.4]) {                       // pale stone pilasters
      const p = box(2, 15, 1.8, pale); p.position.set(0.8, 7.5, dz); g.add(p);
    }
    const lintel = box(2.4, 2.2, 13.6, pale); lintel.position.set(0.6, 15.6, 0); g.add(lintel);
    const recess = box(1.2, 14, 9, '#24201c'); recess.position.set(0.1, 7.4, 0); g.add(recess);
    for (const dz of [-2.2, 2.2]) {                       // two dark-green leaves
      const leaf = box(1.1, 12.6, 4.2, leafHex); leaf.position.set(0.7, 6.8, dz); g.add(leaf);
      const handle = box(0.5, 1.3, 0.5, '#c9a84e'); handle.position.set(1.4, 6.6, dz + (dz < 0 ? 1.5 : -1.5)); g.add(handle);
    }
    const step = box(7, 1.4, 12, '#9a9b95'); step.position.set(4.2, 0.6, 0); g.add(step);
    const wx = -886, wz = 2312;
    g.position.set(wx, this.index.heightAtPx(wx + 4, wz), wz);
    return g;
  }

  // the weathered rowboat (boxes), built once and shown on the bank during Ch4
  private ensureRowboat() {
    if (this.rowboat) return;
    const R = new THREE.Group();
    const RB = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string) => {
      const m = box(w, h, d, hex);
      m.position.set(x, y, z);
      R.add(m);
    };
    RB(18, 3, 46, 0, 2.4, 0, '#6e4520');
    RB(1.8, 5, 44, -9, 5.4, 0, '#7a5230');
    RB(1.8, 5, 44, 9, 5.4, 0, '#7a5230');
    RB(18, 5, 2.5, 0, 5.4, -22.5, '#7a5230');
    RB(13, 4, 6, 0, 5.4, 21, '#7a5230');
    RB(7, 3.5, 5, 0, 6.9, 25.5, '#6e4520');
    RB(15, 1.4, 4.5, 0, 6.2, 3, '#a8895e');
    RB(15, 1.4, 4.5, 0, 6.2, -12, '#a8895e');
    this.rowboat = R;
    this.scene.add(R);
  }

  // the Custom House keeper + the two harbor bell-posts (Coast Guard, wharf)
  private buildC5Props() {
    const keeper = npcMesh('#d8c2a2', '#5a4a6e', '#4e4a44', '#8a8378', 'bun');
    this.npcs.keeper = keeper;
    this.place(keeper, KEEPER.x, KEEPER.z, -1.4);
    this.scene.add(keeper);
    const bellPost = (x: number, z: number) => {
      const g = new THREE.Group();
      const post = box(2, 12, 2, '#3a342c');
      post.position.y = 6;
      g.add(post);
      const bar = box(8, 2, 2, '#3a342c');
      bar.position.y = 12.6;
      g.add(bar);
      const bell = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 4.6, 6, 10), new THREE.MeshLambertMaterial({ color: '#5e7a64' }));
      bell.position.y = 9;
      bell.castShadow = true;
      g.add(bell);
      g.position.set(x, this.index.heightAtPx(x, z), z);
      this.scene.add(g);
    };
    bellPost(BELL_CG.x, BELL_CG.z);
    bellPost(BELL_WHARF.x, BELL_WHARF.z);
  }

  // a soft warm additive glow sprite (a lit lantern) — shared by the keeper's lantern
  // and his scattered marker-lamps so every light reads the same
  private warmGlow(scale: number): THREE.Sprite {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const c = cv.getContext('2d')!;
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,236,170,1)');
    g.addColorStop(0.45, 'rgba(255,210,120,0.5)');
    g.addColorStop(1, 'rgba(255,200,110,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, fog: false, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.set(scale, scale, 1);
    return s;
  }

  // Level 2 — the Joppa Flats birdwatcher (Chapter 6 beat 1). Gated behind nbpt-l2,
  // spawned once Level 1 is finished so she's never present during the first arc.
  private buildL2Props() {
    const w = npcMesh('#d9b48f', '#3f5e4a', '#4a4640', '#6a6258', 'cap');
    this.npcs.watcher = w;
    this.place(w, JOPPA.x, JOPPA.z, JOPPA.face);
    this.scene.add(w);
    // Gram has gone home to Joppa after Level 1 — relocate her there for the Ch2 beat
    this.place(this.npcs.gram, GRAM_HOME.x, GRAM_HOME.z, GRAM_HOME.face);
    // the drowned lighthouse foundation directly under the light (the Chapter 2 reveal):
    // a ring of half-sunk granite blocks, shown once the light is found (ch5 >= 1)
    const f = new THREE.Group();
    const FN = 18, FR = 58;             // a big ring of blocks — the lighthouse's drowned base
    for (let i = 0; i < FN; i++) {
      const a = (i / FN) * Math.PI * 2;
      const w = 20 + (i % 3) * 4;       // 20..28 wide — uneven, broken courses
      const h = 22 + (i % 4) * 3;       // 22..31 tall
      const sink = 10 + (i % 5) * 2;    // each block has settled to a different depth
      const blk = box(w, h, 18, i % 2 ? '#8b8884' : '#7e7b76');
      blk.position.set(Math.cos(a) * FR, WATER_Y + h / 2 - sink, Math.sin(a) * FR);
      blk.rotation.y = a + 0.3;
      f.add(blk);
    }
    f.position.set(LIGHT.x, 0, LIGHT.z);
    f.visible = this.ch5 >= 1;
    this.foundation = f;
    this.scene.add(f);
    // the mystery light out on the dark water: a small bright core + an additive glow
    // halo (fog-less, so it reads as a clear distant light). Hidden until the reveal
    // (ch5 >= 1 keeps it on across reloads); later it's the Chapter 2 kayak target.
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(30, 14, 12), new THREE.MeshBasicMaterial({ color: '#fff6e0', fog: false }));
    g.add(core);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g2 = cv.getContext('2d')!;
    const grd = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,244,205,0.95)');
    grd.addColorStop(0.45, 'rgba(255,226,150,0.45)');
    grd.addColorStop(1, 'rgba(255,220,140,0)');
    g2.fillStyle = grd;
    g2.fillRect(0, 0, 64, 64);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, fog: false, depthWrite: false }));
    halo.scale.set(520, 520, 1);
    g.add(halo);
    g.position.set(LIGHT.x, WATER_Y + 7, LIGHT.z);
    g.visible = this.ch5 >= 1 && this.ch7 < 2;   // the keeper's light burns out past the flats until he puts it to bed at the end of Ch3
    this.mysteryLight = g;
    this.scene.add(g);

    // the Joppa slip: a low plank dock out into the water, grandpa's kayak tied at the
    // end (the tied prop hides once you take it in Ch2 and launch the real kayak)
    const dock = new THREE.Group();
    const deck = box(8, 1.4, 64, '#7a5a36');
    deck.position.set(0, 3, 26);
    dock.add(deck);
    for (const dz of [2, 26, 50]) for (const dx of [-3.4, 3.4]) {
      const pile = box(1.8, 16, 1.8, '#5e4628');
      pile.position.set(dx, -3, dz);
      dock.add(pile);
    }
    // the SAME boat you ride, tied alongside the slip and floating at the waterline.
    // update() hides it whenever you're out paddling (so you never see two kayaks) and
    // shows it again when you're back on foot — the dock always has your kayak waiting.
    const tied = buildKayak();
    tied.position.set(10, -1.4, 26);   // floats at the waterline alongside the deck (just below the rail)
    tied.rotation.y = 0.15;
    this.tiedKayak = tied;
    dock.add(tied);
    // anchor at the waterline (~40px NE of the slip shore, which is ~9 high), not the
    // bank itself, so the dock sits on the water instead of burying in the slope
    dock.position.set(7972, WATER_Y, 4408);
    dock.rotation.y = 2.36;            // deck (+z) points NE into the water (the harbor)
    this.scene.add(dock);

    // the lamplighter — old Eben (Chapter 3): a stooped keeper in a wool cap and navy sweater,
    // white-haired, tending his lantern on the drowned foundation. Hidden until you go out to
    // meet him (apply() toggles on ch7===1); placed on the near (south) edge of the ring so you
    // see him on approach.
    const keep = npcMesh('#d8c2a2', '#39506b', '#4a4640', '#dcdad2', 'cap');
    const lantern = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 4.4, 3.2),
      new THREE.MeshBasicMaterial({ color: '#ffd56a', fog: false })
    );
    lantern.position.set(4, 9.5, 3);
    keep.add(lantern);
    // a warm glow on his lantern so his light reads up close (the big mystery glow shrinks to
    // nothing as you arrive; this is what's left — just an old man and a lamp). Shared with the lamps.
    const lglow = this.warmGlow(70);
    lglow.position.set(4, 10, 3);
    keep.add(lglow);
    keep.position.set(LIGHT.x, WATER_Y + 11, LIGHT.z + 50);   // standing on the ring, near side
    keep.rotation.y = Math.PI;          // facing south, toward the kid paddling up
    keep.visible = false;
    this.npcs.lamplighter = keep;
    this.scene.add(keep);

    // the keeper's scattered marker-lamps (Ch3): a buoy-post topped by a lantern, blown dark by
    // the gale. Built once; apply() stands the un-lit posts on the water during ch7===1, update()
    // RELIGHTS each on contact (turns its `flame` subgroup on). The lit state persists.
    this.decoyLights = DECOYS.map((d) => {
      const lamp = new THREE.Group();
      const post = box(1.6, 15, 1.6, '#2c2a26');     // a dark stake out of the water
      post.position.y = 5;
      lamp.add(post);
      // the flame: a lit lantern box + warm halo, hidden until you relight it
      const flame = new THREE.Group();
      const lbox = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 3), new THREE.MeshBasicMaterial({ color: '#ffd56a', fog: false }));
      lbox.position.y = 13;
      flame.add(lbox);
      const gl = this.warmGlow(58);
      gl.position.y = 13;
      flame.add(gl);
      flame.visible = false;
      (lamp as THREE.Group & { flame?: THREE.Group }).flame = flame;
      lamp.add(flame);
      lamp.position.set(d.x, WATER_Y - 1.5, d.z);
      lamp.visible = false;
      this.scene.add(lamp);
      return lamp;
    });

    // the lobsterman (Chapter 3 & 4): a salty waterman in oilskins, met OUT ON THE WATER in his
    // lobster boat as you paddle home from the light — not waiting at the slip. His boat is
    // anchored on the route in (LOBSTER), and the meetings auto-trigger as you draw near (update()).
    // Appears once Ch2 is done (ch6>=3) and stays until the storm sends you ashore for the finale.
    const lboat = new THREE.Group();
    // a stout working hull (longer + beamier than the rowboat), painted lobster-boat colors
    const LB = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string) => {
      const m = box(w, h, d, hex); m.position.set(x, y, z); lboat.add(m);
    };
    LB(26, 4, 64, 0, 2, 0, '#8a3530');           // hull, deep red
    LB(2.4, 7, 60, -13, 6, 0, '#c9c2b2');        // port gunwale
    LB(2.4, 7, 60, 13, 6, 0, '#c9c2b2');         // starboard gunwale
    LB(26, 7, 2.4, 0, 6, -31, '#c9c2b2');        // transom
    LB(20, 16, 16, 0, 11, -18, '#ded7c7');       // wheelhouse cabin, set aft
    LB(16, 7, 2, 0, 16, -10.5, '#3a3e44');       // dark cabin window band
    // traps stacked on the working deck forward of the cabin
    for (const [tx, ty, tz] of [[-6, 4, 12], [6, 4, 14], [0, 9, 13]] as const) {
      const trap = box(9, 5, 7, '#7d6a4a'); trap.position.set(tx, ty, tz); lboat.add(trap);
    }
    // the waterman himself, standing at the rail amidships, facing the kid paddling up
    const lob = npcMesh('#c69a76', '#d6a23a', '#3a3e44', '#574d44', 'cap');
    lob.position.set(0, 4, -2);
    lboat.add(lob);
    lboat.position.set(LOBSTER.x, WATER_Y, LOBSTER.z);
    lboat.rotation.y = LOBSTER.face;
    lboat.visible = false;                        // apply() shows him from Ch3 on
    this.npcs.lobster = lboat;
    this.scene.add(lboat);

    // ---- Chapter 4 finale "Bring the Light Home" props ----
    // The Rear Range Light's beam: a long warm cone at the lantern top that the player
    // rotates across the harbor (update() sets beam.rotation.y from hud.beamAz). Built
    // open-ended + additive + fog-less so it reads as a clean shaft of light over the
    // dark water. Apex at the tower, widening outward along local +Z.
    const beam = new THREE.Group();
    const BL = 3000, PITCH = 0.06;                // length + a gentle downward rake so it sweeps the water
    // two nested open cones (soft halo + brighter core), apex at the lantern, widening
    // out along local +Z and pitched down toward the harbor surface where the boats sit
    for (const [br, op] of [[150, 0.26], [52, 0.5]] as const) {
      const geo = new THREE.ConeGeometry(br, BL, 26, 1, true).rotateX(-Math.PI / 2).translate(0, 0, BL / 2).rotateX(PITCH);
      beam.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
        color: 0xfff1c4, transparent: true, opacity: op, side: THREE.DoubleSide,
        depthWrite: false, fog: false, blending: THREE.AdditiveBlending
      })));
    }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(7, 14, 12), new THREE.MeshBasicMaterial({ color: '#fff6e0', fog: false }));
    beam.add(lamp);
    const lampGlow = this.warmGlow(150);          // a warm halo so the lit lantern reads from afar
    beam.add(lampGlow);
    beam.position.set(TOWER.x, this.index.heightAtPx(TOWER.x, TOWER.z) + 99, TOWER.z);  // the lantern room, atop the brick tower
    beam.visible = false;                         // lit once you climb the tower (ch8 >= 1, after relighting)
    this.beam = beam;
    this.scene.add(beam);

    // the lost boats out on the dark harbor — small, dark, and adrift until the beam
    // catches them; each has a lantern that blinks on when it turns for home.
    this.lostBoats = LOST.map((p) => {
      const b = this.buildLostBoat();
      b.position.set(p.x, WATER_Y, p.z);
      b.rotation.y = Math.random() * Math.PI * 2;
      b.visible = false;
      this.scene.add(b);
      return b;
    });

    // the festive Coast Guard boat that leads the fleet up the river (the town-answer);
    // shown only once every boat is following the light home.
    const cg = this.buildCoastGuardBoat();
    cg.visible = false;
    this.cgBoat = cg;
    this.scene.add(cg);

    // reloaded after the finale's already done? snap the fleet to its moorings up the
    // river so the peaceful tableau is right immediately (no glide in from map-origin).
    if (this.ch8 >= 2) this.placeFleetHome();
  }

  // park the homecoming fleet at its moorings (used to restore the post-finale tableau)
  private placeFleetHome() {
    if (this.cgBoat) this.cgBoat.position.set(FLEET_HOME.x, WATER_Y, FLEET_HOME.z);
    for (let i = 0; i < this.lostBoats.length; i++) {
      const slot = this.fleetSlot(i);
      this.lostBoats[i].position.set(slot.x, WATER_Y, slot.z);
    }
  }

  // a small, weathered boat for the storm-night fleet: a dark hull + a tiny mast lantern
  // (warm glow) that's dim until the beam catches it and it turns for home.
  private buildLostBoat(): THREE.Group {
    const g = new THREE.Group();
    const hull = box(20, 8, 52, '#41464d');
    hull.position.y = 4;
    g.add(hull);
    const cabin = box(14, 10, 17, '#565c63');
    cabin.position.set(0, 12, -6);
    g.add(cabin);
    const mast = box(2, 26, 2, '#2c2f34');
    mast.position.set(0, 20, 9);
    g.add(mast);
    const lantern = this.warmGlow(52);
    lantern.position.set(0, 32, 9);
    lantern.material.opacity = 0.2;               // a faint, struggling light until the beam finds it
    (g as THREE.Group & { lantern?: THREE.Sprite }).lantern = lantern;
    g.add(lantern);
    return g;
  }

  // the Coast Guard boat — a white-and-orange cutter strung with warm festive lights,
  // the lead boat of the homecoming fleet (Newburyport: birthplace of the Coast Guard).
  private buildCoastGuardBoat(): THREE.Group {
    const g = new THREE.Group();
    const hull = box(18, 7, 50, '#f3f1ea');
    hull.position.y = 4;
    g.add(hull);
    const stripe = box(18.4, 3, 12, '#d65a2e');   // the racing stripe
    stripe.position.set(0, 5, 12);
    g.add(stripe);
    const cabin = box(13, 9, 16, '#e9e6dd');
    cabin.position.set(0, 11, -4);
    g.add(cabin);
    const mast = box(1.8, 20, 1.8, '#cfd3d8');
    mast.position.set(0, 22, -6);
    g.add(mast);
    // a little string of warm lights along the rails + mast
    for (const [lx, ly, lz, s] of [[0, 34, -6, 26], [-8, 9, 22, 20], [8, 9, 22, 20], [-8, 9, -18, 20], [8, 9, -18, 20], [0, 20, 6, 22]] as const) {
      const gl = this.warmGlow(s);
      gl.position.set(lx, ly, lz);
      g.add(gl);
    }
    return g;
  }

  // current interactable: tag + spot + verb for the TALK button
  private ch1Done(): boolean {
    return (parseInt(localStorage.getItem('nbpt-ch1-step') || '0', 10) || 0) >= 6;
  }

  private candidates(): { tag: string; x: number; z: number; label: string; r: number }[] {
    const c: { tag: string; x: number; z: number; label: string; r: number }[] = [];
    if (this.step === 0 || this.step === 3) c.push({ tag: 'gram', x: GRAM.x, z: GRAM.z, label: '\u{1F4AC} TALK', r: 90 });
    else if (this.step === 1) c.push({ tag: 'donut', x: DONUT.x, z: DONUT.z, label: '\u{1F4AC} TALK', r: 90 });
    else if (this.step === 2) c.push({ tag: 'lib', x: LIB.x, z: LIB.z, label: '\u{1F4AC} TALK', r: 90 });
    else if (this.step === 5) c.push({ tag: 'grate', x: GRATE.x, z: GRATE.z, label: '\u{1F440} LOOK', r: 90 });
    if (this.step >= 6) {
      c.push({ tag: 'godown', x: GRATE.x, z: GRATE.z, label: '\u2B07 GO DOWN', r: 100 });
      if (this.ch1Done()) {
        if (this.ch2 === 0 || this.ch2 === 2 || this.ch2 === 3) c.push({ tag: 'news', x: this.editorPos.x, z: this.editorPos.z, label: '\u{1F4F0} ENTER', r: 90 });
        else if (this.ch2 === 1) {
          for (let i = 0; i < this.stops.length; i++) {
            if (!this.delivered.has(i)) c.push({ tag: 'stop' + i, x: this.stops[i].x, z: this.stops[i].z, label: '\u{1F4F0} THROW', r: 124 });
          }
        }
        // Chapter 4 "Low Water": the rowboat is the only way to the den —
        // for the three corners, and later to ring the den's own bell
        if (this.ch2 >= 4) {
          if (this.ch3 === 0) {
            c.push({ tag: 'boat', x: BOAT.x, z: BOAT.z, label: '\u{1F6F6} ROW', r: 85 });
          } else if (this.ch3 >= 1 && this.ch3 < 4) {
            // stepped out of the den before finishing — the boat's beached at the
            // door, so let them climb back down instead of being stranded here
            c.push({ tag: 'reden', x: WDOOR.x, z: WDOOR.z, label: '⬇ GO DOWN', r: 95 });
          }
          // Chapter 5 "The Custom House Star": the keeper, the bells, the cellar
          if (this.ch3 >= 4) {
            if (this.ch4 === 0 && !this.gramSent) c.push({ tag: 'gramcorners', x: GRAM.x, z: GRAM.z, label: '\u{1F4AC} TALK', r: 90 });
            else if (this.ch4 === 0) c.push({ tag: 'curator', x: KEEPER.x, z: KEEPER.z, label: '\u{1F4AC} TALK', r: 90 });
            else if (this.ch4 === 1) {
              if (!this.bells.has('cg')) c.push({ tag: 'cgbell', x: BELL_CG.x, z: BELL_CG.z, label: '\u{1F514} RING', r: 110 });
              if (!this.bells.has('wharf')) c.push({ tag: 'whbell', x: BELL_WHARF.x, z: BELL_WHARF.z, label: '\u{1F514} RING', r: 110 });
            } else if (this.ch4 === 2 || this.ch4 === 3) {
              c.push({ tag: 'cellar', x: CELLAR.x, z: CELLAR.z, label: '⭐ ENTER', r: 90 });
            } else if (this.l2 && this.ch5 === 0) {
              // Level 2 Ch1 — the birdwatcher at Joppa Flats (gated)
              c.push({ tag: 'watcher', x: JOPPA.x, z: JOPPA.z, label: '\u{1F4AC} TALK', r: 95 });
            } else if (this.l2 && this.ch5 >= 1 && this.ch6 === 0) {
              c.push({ tag: 'gramkayak', x: GRAM_HOME.x, z: GRAM_HOME.z, label: '\u{1F4AC} TALK', r: 90 });
            } else if (this.l2 && this.ch5 >= 1 && this.ch6 === 1) {
              c.push({ tag: 'slip', x: SLIP.x, z: SLIP.z, label: '\u{1F6F6} TAKE IT', r: 95 });
            } else if (this.l2 && this.ch8 === 1 && !this.hud.sweeping) {
              // …climb the Rear Range Light and wake the lamp (the beam-sweep is auto after)
              c.push({ tag: 'tower', x: TOWER.x, z: TOWER.z, label: '\u{1F526} LIGHT IT', r: 95 });
            } else if (this.l2 && this.ch8 >= 2) {
              // finale's done — the light is yours to switch on or off whenever you walk past it
              c.push({ tag: 'tower', x: TOWER.x, z: TOWER.z, label: this.beamLit ? '\u{1F311} DOUSE THE LIGHT' : '\u{1F526} LIGHT IT', r: 95 });
            }
          }
        }
      }
    }
    return c;
  }

  private nearestCandidate(px: number, pz: number): { tag: string; x: number; z: number; label: string; r: number } | null {
    let best: { tag: string; x: number; z: number; label: string; r: number } | null = null;
    let bd = Infinity;
    for (const c of this.candidates()) {
      const d = Math.hypot(px - c.x, pz - c.z);
      if (d < c.r && d < bd) { bd = d; best = c; }
    }
    return best;
  }

  private setStep(s: number) {
    this.step = s;
    localStorage.setItem(SAVE_KEY, String(s));
    this.apply();
  }

  // sync HUD + markers to the whole spine state (ch0 → tunnel → paper route)
  private apply() {
    const ch1 = parseInt(localStorage.getItem('nbpt-ch1-step') || '0', 10) || 0;
    let target: { x: number; z: number } | null = null;
    let bangY = 48;
    if (this.step >= 6) {
      if (ch1 < 6) {
        this.hud.setObjective('The grate is open\u2026 go down');
        target = { x: GRATE.x, z: GRATE.z };
        bangY = 26;
      } else if (this.ch2 === 0) {
        this.hud.setObjective('Someone at the Daily News wants a word \u2014 Liberty Street');
        target = this.editorPos;
      } else if (this.ch2 === 1) {
        this.hud.setObjective('Deliver the Daily News \u2014 ' + this.delivered.size + '/' + this.stops.length);
        let bd = Infinity;
        for (let i = 0; i < this.stops.length; i++) {
          if (this.delivered.has(i)) continue;
          const d = Math.hypot(this.stops[i].x - GRAM.x, this.stops[i].z - GRAM.z);
          if (d < bd) { bd = d; target = this.stops[i]; }
        }
      } else if (this.ch2 === 2) {
        this.hud.setObjective('Back to the Daily News');
        target = this.editorPos;
      } else if (this.ch2 === 3) {
        this.hud.setObjective('Back inside the Daily News \u2014 search the morgue');
        target = this.editorPos;
      } else if (this.ch3 === 0) {
        this.hud.setObjective(this.hud.boating ? 'Row west along the seawall \u2014 the beam marks the door' : 'Low water \u2014 a rowboat waits on the bank past the Coast Guard station');
        target = this.hud.boating ? WDOOR : BOAT;
      } else if (this.ch3 < 4) {
        this.hud.setObjective('The waterline door \u2014 below the seawall, west of the docks');
        target = WDOOR;
      } else if (this.ch4 === 0 && !this.gramSent) {
        this.hud.setObjective('Show Gram what you found \u2014 Market Square');
        target = { x: GRAM.x, z: GRAM.z };
      } else if (this.ch4 === 0) {
        this.hud.setObjective('The last corner \u2014 the Custom House, Water Street');
        target = KEEPER;
      } else if (this.ch4 === 1) {
        // the den's bell already rang in Ch4 (the keeper reveals it counted as the first)
        // \u2014 only the two harbor-post bells remain; no second trip back out to the den
        this.hud.setObjective('Ring the harbor bells \u2014 ' + this.bells.size + ' of 3');
        target = !this.bells.has('cg') ? BELL_CG : !this.bells.has('wharf') ? BELL_WHARF : KEEPER;
      } else if (this.ch4 === 2 || this.ch4 === 3) {
        this.hud.setObjective('The stone remembers \u2014 beneath the Custom House');
        target = CELLAR;
      } else if (this.l2 && this.ch5 === 0) {
        this.hud.setObjective('Out past the flats \u2014 find the birdwatcher at Joppa');
        target = { x: JOPPA.x, z: JOPPA.z };
      } else if (this.l2 && this.ch6 === 0) {
        this.hud.setObjective('Ask Gram about the light \u2014 her house in Joppa');
        target = { x: GRAM_HOME.x, z: GRAM_HOME.z };
      } else if (this.l2 && this.ch6 === 1) {
        this.hud.setObjective('Your grandfather\u2019s kayak \u2014 the Joppa slip');
        target = { x: SLIP.x, z: SLIP.z };
      } else if (this.l2 && this.ch6 === 2) {
        this.hud.setObjective('Paddle out to the light');
        target = { x: LIGHT.x, z: LIGHT.z };
      } else if (this.l2 && this.ch6 >= 3 && this.ch7 === 0) {
        this.hud.setObjective('Paddle home — the lobsterman’s waving you over');
        target = { x: LOBSTER.x, z: LOBSTER.z };
      } else if (this.l2 && this.ch7 === 1) {
        const left = DECOYS.length - this.litLamps.size;
        this.hud.setObjective(left > 0
          ? `Relight the keeper’s lamps — ${this.litLamps.size} of ${DECOYS.length}`
          : 'Reach the keeper at his last lamp');
        target = { x: LIGHT.x, z: LIGHT.z };   // update() refines the beacon to the next lamp
      } else if (this.l2 && this.ch7 >= 2 && this.ch8 === 0) {
        this.hud.setObjective('Paddle to the lobsterman — the storm’s breaking');
        target = { x: LOBSTER.x, z: LOBSTER.z };
      } else if (this.l2 && this.ch8 === 1) {
        if (this.hud.sweeping) {
          this.hud.setObjective(`Sweep the beam — guide the boats home · ${this.caught.size} of ${LOST.length}`);
          target = null;   // you aim the beam, not walk — the beacon hides during the sweep
        } else {
          this.hud.setObjective('Light the Rear Range Light — the brick tower downtown');
          target = { x: TOWER.x, z: TOWER.z };
        }
      } else {
        this.hud.setObjective(null);   // Level 1 + Level 2 complete
      }
    } else {
      this.hud.setObjective(STEP_OBJECTIVE[this.step]);
      const it = this.nearestNonRouteTarget();
      target = it;
      if (it && (this.step === 4 || this.step === 5)) bangY = 26;
    }
    // feed the two HUD systems from this one sync point: the backpack + missions log
    this.hud.setBag(this.buildBag());
    this.hud.setMissions(this.buildMissions());
    // explore mode strips the story-progress chrome too (compass dial + 🧭 missions + 🎒
    // backpack); story mode restores it. Toggled here so init, the first-run pick, and the
    // settings gear all converge on this one place.
    this.hud.setStoryChrome(this.storyOn);
    // the rowboat waits on the launch bank during Chapter 4 (the one-time den discovery row)
    this.ensureRowboat();
    const showBoat = this.step >= 6 && this.ch2 >= 4 && this.ch3 < 4 && !this.hud.boating;
    this.rowboat!.visible = showBoat;
    if (showBoat) {
      const atLaunch = this.ch3 === 0;   // launch bank vs. parked by the den door
      const rx = atLaunch ? BOAT.x + 9 : -200;
      const rz = atLaunch ? BOAT.z - 26 : -1172;
      this.rowboat!.position.set(rx, this.index.heightAtPx(rx, rz) + 0.5, rz);
      this.rowboat!.rotation.y = atLaunch ? 0.8 : 2.2;
    }
    // once the den is cleared, the Custom House keeper and the two harbor bells appear
    if (this.ch3 >= 4 && !this.c5built) { this.c5built = true; this.buildC5Props(); }
    // Level 2 (gated): the Joppa birdwatcher appears once Level 1 is finished
    if (this.l2 && this.ch4 >= 4 && !this.l2built) { this.l2built = true; this.buildL2Props(); }
    // Ch3: the keeper only stands on the foundation while you're out relighting his lamps
    if (this.npcs.lamplighter) this.npcs.lamplighter.visible = this.l2 && this.ch6 >= 3 && this.ch7 === 1;
    // Ch3: his marker-lamps stand on the water during the hunt; each shows its flame once relit
    // (persisted), and they all go dark when he puts them to bed at the chapter's end (ch7 >= 2)
    for (let i = 0; i < this.decoyLights.length; i++) {
      const lamp = this.decoyLights[i];
      lamp.visible = this.l2 && this.ch6 >= 3 && this.ch7 === 1;
      const flame = (lamp as THREE.Group & { flame?: THREE.Group }).flame;
      if (flame) flame.visible = this.litLamps.has(i);
    }
    // the lobsterman's boat rides the water once Ch2 is done; it's gone by the finale (he heads
    // ashore once the storm sends you to the tower — "that's my boat in the line" at the end)
    if (this.npcs.lobster) this.npcs.lobster.visible = this.l2 && this.ch6 >= 3 && this.ch8 < 1;
    // the drowned foundation is built once, the instant Level 1 ends (ch5 still 0) — so
    // re-assert its visibility here, or it stays hidden all the way to the Ch2 reveal on a
    // no-reload playthrough (its build-time gate never re-runs, and nothing else shows it).
    // The mystery light has its own explicit reveal (the watcher cutaway), so leave it be.
    if (this.foundation) this.foundation.visible = this.ch5 >= 1;
    // Ch4 finale: on a reload after the chapter's done, restore the peaceful tableau —
    // the light stays lit, the fleet stays moored up the river ("yours to keep lit").
    if (this.l2 && this.ch8 >= 2) this.homing = this.beamLit;   // post-finale: the fleet follows the (toggleable) beam
    // the beam burns once you've relit it (and forever after the finale); the lost boats
    // sit out on the storm-water for the whole chapter; the Coast Guard leads once homing.
    if (this.beam) this.beam.visible = this.l2 && this.ch8 >= 1 && this.beamLit;
    for (const b of this.lostBoats) b.visible = this.l2 && this.ch8 >= 1;
    if (this.cgBoat) this.cgBoat.visible = this.l2 && this.homing;
    // re-assert the storm on a reload mid-finale — the Sky's forced weather/dusk isn't saved
    if (this.l2 && this.ch8 === 1 && !this.stormStarted) { this.stormStarted = true; this.onStorm(); }
    // the bars swing aside once the chapter ends
    if (this.grateBars) {
      const open = this.step >= 6;
      this.grateBars.rotation.z = open ? 1.25 : 0;
      this.grateBars.position.set(open ? -8.2 : 0, open ? 4.4 : 0, 0);
    }
    if (target) {
      const gy = this.index.heightAtPx(target.x, target.z);
      this.beacon.visible = true;
      this.beacon.position.set(target.x, gy, target.z);
      this.bang.visible = true;
      this.bang.position.set(target.x, gy + bangY, target.z);
    } else {
      this.beacon.visible = false;
      this.bang.visible = false;
    }
    // the journey panel's direction hint points at the live objective beacon
    this.hud.guide = target;
    // explore mode: the world above stays correct (cast, props, doors), but nothing
    // directs you — no objective banner, no gold beacon/“!”, no journey beam. The
    // 🧭 panel still shows your place in the story if you choose to open it.
    if (!this.storyOn) {
      this.hud.setObjective(null);
      this.beacon.visible = false;
      this.bang.visible = false;
      this.hud.guide = null;
    }
  }

  // how many of the four smugglers'-map corners you've found (one per milestone) —
  // a single counted set, not four copies of one chip
  private cornerCount(): number {
    const ch1 = parseInt(localStorage.getItem('nbpt-ch1-step') || '0', 10) || 0;
    let n = 0;
    if (ch1 >= 4) n++;        // Ch2 tunnel — first corner
    if (this.ch2 >= 4) n++;   // Ch3 morgue — second
    if (this.ch3 >= 3) n++;   // Ch4 den — third
    if (this.ch4 >= 3) n++;   // Ch5 cellar — fourth
    return n;
  }

  // Gram stands in Market Square during Level 1; once Level 2 begins she's home in Joppa
  private gramSpot(): { x: number; z: number } { return (this.l2 && this.ch4 >= 4) ? GRAM_HOME : GRAM; }

  // what's in the backpack right now: transient carry items, kept treasures, and
  // the map-corner collection (the Hud adds the Town-stories collection itself)
  private buildBag(): BagItem[] {
    const out: BagItem[] = [];
    const add = (id: string, extra?: Partial<BagItem>) => out.push({ ...ITEMS[id], ...extra } as BagItem);
    const ch1 = parseInt(localStorage.getItem('nbpt-ch1-step') || '0', 10) || 0;
    if (this.step >= 6) {
      if (this.ch2 === 1 || this.ch2 === 2) add('papers');     // carrying the route's papers
      add('card');                                             // treasures you keep forever
      if (ch1 >= 2) add('lantern');
      if (localStorage.getItem('nbpt-bike') === '1') add('bike');
      if (this.l2 && this.ch5 >= 1) add('binocs');   // Level 2: earned from the birdwatcher
      if (localStorage.getItem('nbpt-kayak') === '1') add('kayak');
      const cc = this.cornerCount();
      if (cc > 0) add('mapcorners', { count: cc, total: 4 });
    } else {
      for (const e of STEP_CHIPS[this.step]) {                 // pre-spine: book/donuts/card
        const id = EMOJI_TO_ID[e];
        if (id) add(id);
      }
    }
    return out;
  }

  // the story spine as mission cards (grouped under "Story"); adding a future side
  // quest = pushing one more object here, no UI changes. The Hud appends collections.
  private buildMissions(): Mission[] {
    const s0 = this.step;
    const ch1 = parseInt(localStorage.getItem('nbpt-ch1-step') || '0', 10) || 0;
    const s2 = this.ch2, s3 = this.ch3, s4 = this.ch4;
    // which chapter currently owns the objective beacon (mirrors apply()'s cascade)
    const active = s0 < 6 ? 1 : ch1 < 6 ? 2 : s2 < 4 ? 3 : s3 < 4 ? 4 : s4 < 4 ? 5
      : (this.l2 && this.ch5 < 1) ? 6 : (this.l2 && this.ch6 < 3) ? 7 : (this.l2 && this.ch7 < 2) ? 8
      : (this.l2 && this.ch8 < 2) ? 9 : 0;
    const missions: Mission[] = [
      { id: 'ch1', group: 'story', level: 1, levelName: L1_NAME, chapter: 1, title: 'Overdue',
        state: s0 >= 6 ? 'done' : 'active', active: active === 1, replay: 0, reward: 'Library card',
        steps: [
          { label: 'Find Gram in Market Square', done: s0 > 0 },
          { label: 'Get the donuts on Inn Street', done: s0 > 1 },
          { label: 'Return Gram’s book to the library', done: s0 > 2 },
          { label: 'Bring Gram her donuts', done: s0 > 3 },
          { label: 'Follow Clipper to what he found', done: s0 >= 6 }
        ] },
      { id: 'ch2', group: 'story', level: 1, levelName: L1_NAME, chapter: 2, title: 'The Door Under Downtown',
        state: ch1 >= 6 ? 'done' : s0 >= 6 ? 'active' : 'locked', active: active === 2, replay: 1, reward: 'Lantern',
        steps: [
          { label: 'Go down through the grate', done: ch1 > 0 },
          { label: 'Light the way and find the smuggler’s mark', done: ch1 >= 2 },
          { label: 'Find the torn map corner', done: ch1 >= 4 }
        ] },
      { id: 'ch3', group: 'story', level: 1, levelName: L1_NAME, chapter: 3, title: 'The Daily News',
        state: s2 >= 4 ? 'done' : ch1 >= 6 ? 'active' : 'locked', active: active === 3, replay: 2, reward: 'Bicycle',
        steps: [
          { label: 'Talk to the Editor on Liberty Street', done: s2 >= 1 },
          { label: 'Deliver the papers', done: s2 >= 2, count: this.delivered.size, total: this.stops.length },
          { label: 'Search the morgue', done: s2 >= 4 }
        ] },
      { id: 'ch4', group: 'story', level: 1, levelName: L1_NAME, chapter: 4, title: 'Low Water',
        state: s3 >= 4 ? 'done' : s2 >= 4 ? 'active' : 'locked', active: active === 4, replay: 3, reward: 'Third map corner',
        steps: [
          { label: 'Row out to the waterline door', done: s3 >= 1 },
          { label: 'Read the Wharf Rats’ ledger', done: s3 >= 2 },
          { label: 'Find the third map corner', done: s3 >= 3 },
          { label: 'Ring the den’s bell', done: s3 >= 4 }
        ] },
      { id: 'ch5', group: 'story', level: 1, levelName: L1_NAME, chapter: 5, title: 'The Custom House Star',
        state: s4 >= 4 ? 'done' : s3 >= 4 ? 'active' : 'locked', active: active === 5, replay: 4,
        steps: [
          { label: 'Bring the three corners back to Gram', done: this.gramSent || s4 >= 1 },
          { label: 'Talk to the Custom House keeper', done: s4 >= 1 },
          { label: 'Ring the three harbor bells (den + two more)', done: s4 >= 2, count: this.bells.size, total: 3 },
          { label: 'Open the room with no door', done: s4 >= 4 }
        ] }
    ];
    // Level 2 (gated): these chapters only appear for opted-in devices (nbpt-l2)
    if (this.l2) {
      missions.push({
        id: 'l2c1', group: 'story', level: 2, levelName: L2_NAME, chapter: 1, title: 'The False Light',
        state: this.ch5 >= 1 ? 'done' : s4 >= 4 ? 'active' : 'locked', active: active === 6, replay: 5,
        reward: 'Binoculars',
        steps: [
          { label: 'Find the birdwatcher at Joppa Flats', done: this.ch5 >= 1 },
          { label: 'Spot the light out past the lighthouse', done: this.ch5 >= 1 }
        ]
      });
      missions.push({
        id: 'l2c2', group: 'story', level: 2, levelName: L2_NAME, chapter: 2, title: 'The Walking Light',
        state: this.ch6 >= 3 ? 'done' : this.ch5 >= 1 ? 'active' : 'locked', active: active === 7, replay: 6,
        reward: 'Grandpa’s kayak',
        steps: [
          { label: 'Ask Gram about the light', done: this.ch6 >= 1 },
          { label: 'Take grandpa’s kayak from the Joppa slip', done: this.ch6 >= 2 },
          { label: 'Paddle out to the light', done: this.ch6 >= 3 }
        ]
      });
      missions.push({
        id: 'l2c3', group: 'story', level: 2, levelName: L2_NAME, chapter: 3, title: 'The Lamplighter',
        state: this.ch7 >= 2 ? 'done' : this.ch6 >= 3 ? 'active' : 'locked', active: active === 8, replay: 7,
        steps: [
          { label: 'Meet the lobsterman on the water as you paddle home', done: this.ch7 >= 1 },
          { label: 'Relight the keeper’s lamps', done: this.ch7 >= 2 || this.litLamps.size >= DECOYS.length, count: this.litLamps.size, total: DECOYS.length },
          { label: 'Reach the keeper at his last lamp', done: this.ch7 >= 2 }
        ]
      });
      missions.push({
        id: 'l2c4', group: 'story', level: 2, levelName: L2_NAME, chapter: 4, title: 'Bring the Light Home',
        state: this.ch8 >= 2 ? 'done' : this.ch7 >= 2 ? 'active' : 'locked', active: active === 9, replay: 8,
        reward: 'A Christmas in Clipper Town',
        steps: [
          { label: 'Meet the lobsterman on the water as the storm breaks', done: this.ch8 >= 1 },
          { label: 'Light the Rear Range Light', done: this.beamLit || this.ch8 >= 2 },
          { label: 'Sweep the beam — guide the boats home', done: this.ch8 >= 2, count: this.caught.size, total: LOST.length }
        ]
      });
    }
    return missions;
  }

  // ch0's own step targets (pre-spine-completion)
  private nearestNonRouteTarget(): { x: number; z: number } | null {
    if (this.step === 0 || this.step === 3) return { x: GRAM.x, z: GRAM.z };
    if (this.step === 1) return { x: DONUT.x, z: DONUT.z };
    if (this.step === 2) return { x: LIB.x, z: LIB.z };
    if (this.step === 4 || this.step === 5) return { x: GRATE.x, z: GRATE.z };
    return null;
  }

  // re-sync after returning from the tunnels
  refresh() {
    this.apply();
  }

  // Level 2 "walking light" mystery window: after the Ch1 reveal (ch5≥1) and before the
  // finale storm takes the sky (ch8<1). Game polls this to hold a winter dusk over the
  // whole ghost-light arc — the premise says the light "comes on after dark."
  get l2Night(): boolean { return this.storyOn && this.l2 && this.ch5 >= 1 && this.ch8 < 1; }

  // explore vs play toggle (driven by the first-run pick + the settings gear). Off
  // hides the directive HUD and stops the proactive story triggers; on resumes the
  // story right where it stands. Persisted so the choice sticks across visits.
  get story(): boolean { return this.storyOn; }
  setStory(on: boolean) {
    // always persist the explicit choice (so picking the current default — e.g. a fresh
    // visitor confirming "just explore" — still latches it and isn't re-derived next visit)
    try { localStorage.setItem('nbpt-story', on ? '1' : '0'); } catch { /* private mode */ }
    if (this.storyOn === on) return;
    this.storyOn = on;
    this.apply();
  }

  // whether the quest currently owns the talk button
  get nearActive(): boolean {
    return this.nearTag !== null;
  }

  update(dt: number, px: number, pz: number) {
    this.t += dt;
    // beacon: a strong, dramatic pulse — the whole pillar throbs bright→dim and
    // breathes wider, while the base ring pings outward like sonar
    const pulse = (Math.sin(this.t * 3.4) + 1) / 2;
    const throb = pulse * pulse;                 // sharper bright peak = more drama
    // Fade the tall beam out as you arrive, so it isn't a bright column standing
    // on top of you and the NPC (the beam draws over everything via depthTest off).
    // It guides you in from a distance, then bows out within interaction range;
    // the ground ring + "!" remain as the precise here-marker.
    const bdist = this.beacon.visible
      ? Math.hypot(px - this.beacon.position.x, pz - this.beacon.position.z)
      : 9999;
    const arrive = Math.min(1, Math.max(0, (bdist - 60) / 150)); // 0 ≤60px … 1 ≥210px
    (this.beaconHalo.material as THREE.MeshBasicMaterial).opacity = (0.05 + 0.2 * throb) * arrive;
    (this.beaconBeam.material as THREE.MeshBasicMaterial).opacity = (0.1 + 0.3 * throb) * arrive;
    (this.beaconCore.material as THREE.MeshBasicMaterial).opacity = (0.28 + 0.46 * throb) * arrive;
    const w = 1 + 0.16 * pulse;                  // breathe wider on the bright beat
    this.beaconHalo.scale.set(w, 1, w);
    this.beaconBeam.scale.set(w, 1, w);
    this.beaconCore.scale.set(w, 1, w);
    const ping = (this.t * 0.85) % 1;
    const rs = 1 + ping * 2.4;
    this.beaconRing.scale.set(rs, 1, rs);
    (this.beaconRing.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - ping);
    if (this.bang.visible) {
      this.bang.position.y += Math.sin(this.t * 3.2) * dt * 4;
    }
    // gentle idle sway on the cast
    for (const k of Object.keys(this.npcs)) {
      const g = this.npcs[k];
      g.rotation.y += Math.sin(this.t * 1.3 + g.position.x) * 0.0006;
    }
    // the mystery light breathes, and SHRINKS as you paddle up to it — the bright glow
    // that drew you out resolves into just the drowned foundation once you arrive
    if (this.mysteryLight && this.mysteryLight.visible) {
      const dpl = Math.hypot(px - LIGHT.x, pz - LIGHT.z);
      const near = Math.max(0.12, Math.min(1, (dpl - 180) / 1600));
      this.mysteryLight.scale.setScalar(near * (0.9 + 0.12 * Math.sin(this.t * 1.8)));
    }
    // the slip's kayak IS the boat you ride — park it at the dock when you're on foot,
    // hide it while you're paddling so the two never show at once
    if (this.tiedKayak) this.tiedKayak.visible = !this.hud.kayaking;

    // explore mode gates the proactive auto-story beats below (each `this.storyOn &&`):
    // nothing fires from proximity, but the cast still offers TALK so a curious explorer
    // can opt into a beat by hand.
    // step 4: following Clipper, you close on the grate he's found
    if (this.storyOn && this.step === 4 && Math.hypot(px - GRATE.x, pz - GRATE.z) < 290) {
      this.audio.bark();
      this.dogTarget = { x: GRATE.x, z: GRATE.z };
      this.setStep(5);
    }

    // Level 2 Ch2: paddling out and reaching the light triggers the walking-lighthouse
    // reveal (auto, since the action button is yielded while kayaking)
    if (this.storyOn && this.l2 && this.ch5 >= 1 && this.ch6 === 2 && this.hud.kayaking
        && !this.hud.dialogueOpen && Math.hypot(px - LIGHT.x, pz - LIGHT.z) < 130) {
      this.revealWalk();
    }
    // Level 2: meet the lobsterman OUT ON THE WATER as you paddle home — his anchored boat
    // sits on the route in, and drawing near it opens Ch3 (the lamplighter) then Ch4 (the storm).
    if (this.storyOn && this.l2 && this.hud.kayaking && !this.hud.dialogueOpen
        && ((this.ch6 >= 3 && this.ch7 === 0) || (this.ch7 >= 2 && this.ch8 === 0))
        && Math.hypot(px - LOBSTER.x, pz - LOBSTER.z) < 170) {
      this.meetLobster();
    }
    // Level 2 Ch3 "The Lamplighter": relight the keeper's scattered marker-lamps. The beacon
    // marks the nearest dark lamp; paddle up to it to light it. Once every lamp is lit, the
    // beacon swings to the foundation and reaching it meets the keeper at his last lamp.
    if (this.storyOn && this.l2 && this.ch6 >= 3 && this.ch7 === 1 && this.hud.kayaking && !this.hud.dialogueOpen) {
      let tgt: { x: number; z: number } | null = null, best = Infinity;
      for (let i = 0; i < DECOYS.length; i++) {
        if (this.litLamps.has(i)) continue;
        const d = Math.hypot(px - DECOYS[i].x, pz - DECOYS[i].z);
        if (d < 60) { this.lightLamp(i); continue; }    // paddled up to it — relight it
        if (d < best) { best = d; tgt = DECOYS[i]; }
      }
      if (!tgt) {                                       // every lamp lit — go meet him
        if (Math.hypot(px - LIGHT.x, pz - LIGHT.z) < 130) { this.meetKeeper(); }
        else tgt = LIGHT;
      }
      if (tgt && this.beacon.visible) {                 // steer the beacon + "!" to the live target
        const gy = this.index.heightAtPx(tgt.x, tgt.z);
        this.beacon.position.set(tgt.x, gy, tgt.z);
        this.bang.position.set(tgt.x, gy + 26, tgt.z);
        this.hud.guide = tgt;
      }
    }

    // Level 2 Ch4 finale "Bring the Light Home": the lit beam tracks your aim; sweeping it
    // across a boat catches it; once all are caught the fleet glides home up the river.
    if (this.beam && this.beam.visible) this.beam.rotation.y = this.hud.beamAz;
    if (this.l2 && this.ch8 >= 1) {
      for (let i = 0; i < this.lostBoats.length; i++) {
        const b = this.lostBoats[i];
        if (!b.visible) continue;
        const lan = (b as THREE.Group & { lantern?: THREE.Sprite }).lantern;
        if (lan) lan.material.opacity = this.caught.has(i) ? 0.85 : 0.18;   // its light steadies once found
        b.position.y = WATER_Y + Math.sin(this.t * 1.6 + i * 1.7) * 1.6;    // bob on the swell
      }
      // the sweep: catch any uncaught boat the beam crosses (angular nearness from the tower)
      if (this.hud.sweeping && !this.hud.dialogueOpen) {
        for (let i = 0; i < LOST.length; i++) {
          if (this.caught.has(i)) continue;
          const bear = Math.atan2(LOST[i].x - TOWER.x, LOST[i].z - TOWER.z);
          const d = Math.atan2(Math.sin(this.hud.beamAz - bear), Math.cos(this.hud.beamAz - bear));
          if (Math.abs(d) < 0.13) this.catchBoat(i);
        }
      }
      // the homecoming: caught boats (and the Coast Guard lead) ease up the river to home
      if (this.homing) {
        const home = (g: THREE.Object3D, hx: number, hz: number, speed: number) => {
          const dx = hx - g.position.x, dz = hz - g.position.z, dist = Math.hypot(dx, dz);
          if (dist > 4) {
            const s = Math.min(dist, speed * dt);
            g.position.x += (dx / dist) * s;
            g.position.z += (dz / dist) * s;
            g.rotation.y = Math.atan2(dx, dz);   // heading into the turn
          }
        };
        if (this.cgBoat) { this.cgBoat.position.y = WATER_Y + Math.sin(this.t * 1.4) * 1.2; home(this.cgBoat, FLEET_HOME.x, FLEET_HOME.z, 440); }
        for (let i = 0; i < this.lostBoats.length; i++) {
          if (!this.caught.has(i)) continue;
          const slot = this.fleetSlot(i);
          home(this.lostBoats[i], slot.x, slot.z, 360);
        }
      }
    }

    // newspapers in flight
    for (let i = this.papers.length - 1; i >= 0; i--) {
      const pp = this.papers[i];
      pp.t += dt / 0.55;
      if (pp.t >= 1) {
        pp.m.position.set(pp.to.x, this.index.heightAtPx(pp.to.x, pp.to.z) + 1.2, pp.to.z);
        this.audio.thump();
        this.papers.splice(i, 1);
        continue;
      }
      const k = pp.t;
      const gy = this.index.heightAtPx(pp.to.x, pp.to.z);
      pp.m.position.set(
        pp.from.x + (pp.to.x - pp.from.x) * k,
        gy + 14 + Math.sin(Math.PI * k) * 16,
        pp.from.z + (pp.to.z - pp.from.z) * k
      );
      pp.m.rotation.x += dt * 9;
    }

    // TALK/LOOK affordance
    if (this.hud.dialogueOpen) {
      if (this.nearTag) { this.nearTag = null; this.hud.showTalk(null); }
      return;
    }
    if (this.hud.flying || this.hud.kayaking || this.hud.sweeping) {   // ✈️/🛶/🔦 Game owns the action button in the air / on the water / at the light
      if (this.nearTag) { this.nearTag = null; this.hud.showTalk(null); }
      return;
    }
    let near: { tag: string; label: string } | null = null;
    const it = this.nearestCandidate(px, pz);
    if (it) near = { tag: it.tag, label: it.label };
    if (!near && this.step >= 6) {
      const flavor: [string, { x: number; z: number }][] = [['gram', this.gramSpot()], ['donut', DONUT], ['lib', LIB]];
      for (const [tag, pos] of flavor) {
        if (Math.hypot(px - pos.x, pz - pos.z) < 50) { near = { tag, label: '\u{1F4AC} TALK' }; break; }
      }
    }
    if ((near && near.tag) !== this.nearTag) {
      this.nearTag = near ? near.tag : null;
      this.hud.showTalk(near ? near.label : null, () => this.tryInteract(px, pz));
    }
  }

  private paperMesh(x: number, z: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 5.2, 7).rotateZ(Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#e8e4d6' }));
    m.position.set(x, this.index.heightAtPx(x, z) + 1.2, z);
    m.castShadow = true;
    return m;
  }

  private throwPaper(i: number, px: number, pz: number) {
    const st = this.stops[i];
    if (!st || this.delivered.has(i)) return;
    this.delivered.add(i);
    localStorage.setItem('nbpt-ch2-stops', JSON.stringify([...this.delivered]));
    const m = this.paperMesh(st.x, st.z);
    this.scene.add(m);
    this.papers.push({ m, t: 0, from: { x: px, z: pz }, to: { x: st.x, z: st.z } });
    if (this.delivered.size >= this.stops.length) {
      setTimeout(() => {
        this.hud.showDialogue(SCHOOL_ST, () => this.setCh2(2));
      }, 700);
    } else {
      this.apply();
    }
  }

  private setCh2(s2: number) {
    this.ch2 = s2;
    localStorage.setItem('nbpt-ch2-step', String(s2));
    this.apply();
  }

  private setCh3(s3: number) {
    this.ch3 = s3;
    localStorage.setItem('nbpt-ch3-step', String(s3));
    this.apply();
  }

  private setCh4(s4: number) {
    this.ch4 = s4;
    localStorage.setItem('nbpt-ch4-step', String(s4));
    this.apply();
  }

  private setCh5(s5: number) {
    this.ch5 = s5;
    localStorage.setItem('nbpt-ch5-step', String(s5));
    this.apply();
  }

  private setCh6(s6: number) {
    this.ch6 = s6;
    localStorage.setItem('nbpt-ch6-step', String(s6));
    this.apply();
  }

  private setCh7(s7: number) {
    this.ch7 = s7;
    localStorage.setItem('nbpt-ch7-step', String(s7));
    this.apply();
  }

  private setCh8(s8: number) {
    this.ch8 = s8;
    localStorage.setItem('nbpt-ch8-step', String(s8));
    this.apply();
  }

  // ring a harbor bell; three rung and the room under the Custom House opens
  private ringBell(which: string) {
    this.bells.add(which);
    localStorage.setItem('nbpt-ch4-bells', JSON.stringify([...this.bells]));
    this.audio.jingle();
    if (this.bells.size >= 3) {
      this.hud.showDialogue(BELL_LAST, () => this.setCh4(2));
    } else {
      this.hud.showDialogue(BELL_RING);
      this.apply();
    }
  }

  tryInteract(px: number, pz: number) {
    if (this.hud.dialogueOpen) return;
    const it = this.nearestCandidate(px, pz);
    if (it) {
      if (it.tag === 'godown') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.onGoDown();
        return;
      }
      if (it.tag === 'news') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.onNews();   // step inside the Daily News; the editor/morgue beats run there
        return;
      }
      if (it.tag === 'reden') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.onDen();   // climb straight back down to the den (the boat's already beached)
        return;
      }
      if (it.tag === 'boat') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.dogTarget = { x: BOAT.x + 6, z: BOAT.z - 16 };
        // row out (BOAT_TALK), then Game takes over the boat ride to the den
        this.hud.showDialogue(BOAT_TALK, () => { this.dogTarget = null; this.onBoat(); });
        return;
      }
      if (it.tag === 'cgbell') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.ringBell('cg');
        return;
      }
      if (it.tag === 'whbell') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.ringBell('wharf');
        return;
      }
      if (it.tag === 'cellar') {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.onStar();
        return;
      }
      if (it.tag.startsWith('stop')) {
        this.hud.showTalk(null);
        this.nearTag = null;
        this.throwPaper(parseInt(it.tag.slice(4), 10), px, pz);
        return;
      }
      this.runStepDialogue(it.tag);
      return;
    }
    if (this.step >= 6) {
      const flavor: [string, { x: number; z: number }][] = [['gram', this.gramSpot()], ['donut', DONUT], ['lib', LIB]];
      for (const [tag, pos] of flavor) {
        if (Math.hypot(px - pos.x, pz - pos.z) < 56) {
          this.hud.showDialogue(FLAVOR[tag]);
          return;
        }
      }
    }
  }

  private runStepDialogue(tag: string) {
    this.hud.showTalk(null);
    this.nearTag = null;
    if (this.step === 0 && tag === 'gram') {
      this.hud.showDialogue(GRAM_TALK, () => {
        // engaging Gram IS choosing the story: an explore-mode kid who taps through her
        // whole briefing just took two jobs — without this they'd get a chapter card and
        // then silence (no pill, no beacon, no 🧭). Flip guidance on so the jobs are
        // followable; the ⚙️ toggle still turns it back off.
        if (!this.storyOn) {
          this.setStory(true);
          this.hud.refreshSettings(true);
        }
        this.hud.chapterCard('CHAPTER 1', 'Overdue', 'Newburyport · first day of summer');
        this.setStep(1);
      });
    } else if (this.step === 1 && tag === 'donut') {
      this.hud.showDialogue(DONUT_TALK, () => this.setStep(2));
    } else if (this.step === 2 && tag === 'lib') {
      this.hud.showDialogue(LIB_TALK, () => this.setStep(3));
    } else if (this.step === 3 && tag === 'gram') {
      // errands done — report back to Gram first; then Clipper bolts off
      this.hud.showDialogue(GRAM_END, () => {
        this.audio.bark();
        this.dogTarget = { x: GRATE.x, z: GRATE.z };   // Clipper runs ahead to the grate
        this.setStep(4);
      });
    } else if (this.step === 5 && tag === 'grate') {
      this.hud.showDialogue(GRATE_TALK, () => {
        this.audio.jingle();
        this.hud.chapterCard('CHAPTER 1 COMPLETE', 'Overdue', 'the card is yours · the door is waiting');
        this.dogTarget = null;
        this.setStep(6);
      });
    } else if (tag === 'editor' && this.ch2 === 0) {
      this.hud.showDialogue(ED_INTRO, () => {
        this.hud.chapterCard('CHAPTER 3', 'The Daily News', 'eight houses \u00b7 one bag \u00b7 mind the history');
        this.setCh2(1);
      });
    } else if (tag === 'editor' && this.ch2 === 2) {
      this.hud.showDialogue(ED_BIKE, () => {
        this.onBike();
        this.audio.bell();
        this.setCh2(3);
      });
    } else if (tag === 'morgue' && this.ch2 === 3) {
      this.hud.showDialogue(MORGUE_FIND, () => {
        this.audio.jingle();
        this.hud.chapterCard('CHAPTER 3 COMPLETE', 'The Daily News', 'the bike is yours \u00b7 two corners of the map');
        this.setCh2(4);
      });
    } else if (tag === 'ledger' && this.ch3 === 1) {
      this.hud.showDialogue(DEN_LEDGER, () => this.setCh3(2));
    } else if (tag === 'wmap' && this.ch3 === 2) {
      this.hud.showDialogue(DEN_MAP, () => { this.audio.jingle(); this.setCh3(3); });
    } else if (tag === 'bell' && this.ch3 === 3) {
      this.hud.showDialogue(DEN_BELL, () => {
        this.audio.jingle();
        this.bells.add('den');   // this soft ring is the first of the three (revealed in Ch5)
        localStorage.setItem('nbpt-ch4-bells', JSON.stringify([...this.bells]));
        this.hud.chapterCard('CHAPTER 4 COMPLETE', 'Low Water', 'three corners found \u00b7 the Custom House keeps the last');
        this.setCh3(4);
      });
    } else if (tag === 'dbell' && this.ch4 === 1) {
      this.ringBell('den');
    } else if (tag === 'gramcorners' && this.ch4 === 0 && !this.gramSent) {
      this.hud.showDialogue(GRAM_CORNERS, () => {
        this.gramSent = true;
        localStorage.setItem('nbpt-ch5-gram', '1');
        this.hud.chapterCard('CHAPTER 5', 'The Custom House Star', 'three corners home · the last lies under the Custom House');
        this.apply();
      });
    } else if (tag === 'curator' && this.ch4 === 0) {
      this.hud.showDialogue(KEEPER_TALK, () => this.setCh4(1));
    } else if (tag === 'corner4' && this.ch4 === 2) {
      this.hud.showDialogue(CORNER_FOUR, () => { this.audio.jingle(); this.setCh4(3); });
    } else if (tag === 'chest' && this.ch4 === 3) {
      this.hud.showDialogue(CHEST_OPEN, () => {
        this.audio.jingle();
        this.hud.chapterCard('CHAPTER 5 COMPLETE', 'The Custom House Star', 'the map is whole \u00b7 the treasure was the town');
        this.setCh4(4);
      });
    } else if (tag === 'watcher' && this.l2 && this.ch5 === 0) {
      this.hud.showDialogue(WATCHER_INTRO, () => {
        // she says "look" → reveal the light + swing the camera out to it; the reveal
        // lines then play over that view, so you SEE what she's describing
        if (this.mysteryLight) this.mysteryLight.visible = true;
        this.beacon.visible = false;   // hide the objective beam/“!” so the reveal view is clean
        this.bang.visible = false;
        this.onLookSea(LIGHT.x, LIGHT.z);
        this.hud.showDialogue(WATCHER_REVEAL, () => {
          this.onLookEnd();
          this.audio.jingle();
          this.hud.chapterCard('LEVEL 2 · CHAPTER 1', 'The False Light', 'a light where no light should be');
          this.setCh5(1);   // binoculars earned; the kayak (Chapter 2) comes next
        });
      });
    } else if (tag === 'gramkayak' && this.l2 && this.ch6 === 0) {
      this.hud.showDialogue(GRAM_KAYAK, () => {
        this.hud.chapterCard('LEVEL 2 · CHAPTER 2', 'The Walking Light', 'grandpa’s kayak waits at the slip');
        this.setCh6(1);
      });
    } else if (tag === 'slip' && this.l2 && this.ch6 === 1) {
      this.hud.showDialogue(SLIP_TAKE, () => {
        localStorage.setItem('nbpt-kayak', '1');   // the kayak is yours — free-roam from here on
        this.audio.jingle();
        // the slip keeps its kayak (a permanent fixture); taking it just unlocks free-roam paddling
        this.setCh6(2);
        this.onKayak();   // "Hop in" — drop straight into the kayak on the water (no standing on land)
      });
    } else if (tag === 'tower' && this.l2 && this.ch8 === 1) {
      // climb the Rear Range Light, relight the lamp, and take the beam
      this.hud.showDialogue(TOWER_LIGHT, () => {
        this.audio.jingle();
        this.beamLit = true;         // the lamp catches — the beam appears at the tower
        this.apply();
        this.onSweep();              // lock at the tower + start sweeping the harbor
      });
    } else if (tag === 'tower' && this.l2 && this.ch8 >= 2) {
      // finale's done — a plain walk-up on/off switch (no cinematic): flip it and remember it
      this.beamLit = !this.beamLit;
      localStorage.setItem('nbpt-beam-on', this.beamLit ? '1' : '0');
      this.homing = this.beamLit;
      this.audio.jingle();
      this.apply();
    }
  }

  // Level 2 Ch2 reveal: you've paddled to the light and it's an old lighthouse foundation
  private revealWalk() {
    // you've reached the light — the objective beacon + "!" bow out so the reveal reads clean
    this.beacon.visible = false;
    this.bang.visible = false;
    this.hud.showDialogue(WALK_REVEAL, () => {
      this.audio.jingle();
      this.hud.chapterCard('LEVEL 2 · CHAPTER 2 COMPLETE', 'The Walking Light', 'the light moved — and now you know it');
      this.setCh6(3);
      // no instant-trip home: you keep the kayak and paddle back yourself — the lobsterman's
      // boat is anchored on the way in, and the meeting auto-triggers as you near it (update()).
    });
  }

  // Level 2: met out on the water as you paddle home from the light. The same waterman opens
  // Chapter 3 (the lamplighter), then Chapter 4 (the storm). update() fires this when the kayak
  // draws near his anchored boat — no land affordance, the meeting IS the trip home.
  private meetLobster() {
    this.beacon.visible = false;
    this.bang.visible = false;
    if (this.ch6 >= 3 && this.ch7 === 0) {
      this.hud.showDialogue(LOBSTER_KEEPER, () => {
        this.hud.chapterCard('LEVEL 2 · CHAPTER 3', 'The Lamplighter', 'an old man keeps a light that walked away');
        this.setCh7(1);
      });
    } else if (this.ch7 >= 2 && this.ch8 === 0) {
      // the finale: break the storm AS he hails you, so the sky matches the "wind has teeth
      // now" narration; the lobsterman then sends you to light the harbor
      this.stormStarted = true;
      this.onStorm();              // the nor'easter rolls in
      this.hud.showDialogue(LOBSTER_STORM, () => {
        this.hud.chapterCard('LEVEL 2 · CHAPTER 4', 'Bring the Light Home', 'the storm is here · the harbor light is dark');
        this.setCh8(1);
      });
    }
  }

  // Level 2 Ch3: paddled up to one of the keeper's dark lamps — relight it, save progress,
  // refresh the count. Its flame turns on (apply() reflects litLamps); the post stays put.
  private lightLamp(i: number) {
    if (this.litLamps.has(i)) return;
    this.litLamps.add(i);
    let mask = 0;
    for (const k of this.litLamps) mask |= (1 << k);
    localStorage.setItem('nbpt-ch7-decoys', String(mask));
    const flame = this.decoyLights[i] && (this.decoyLights[i] as THREE.Group & { flame?: THREE.Group }).flame;
    if (flame) flame.visible = true;
    this.audio.bell();    // the lamp catches — a warm note
    this.apply();         // refresh the "X of N" objective + mission count
  }

  // Level 2 Ch3: you've relit every lamp and reached Eben at his last one — he knew your
  // grandfather, hands you the watch, and lets the old light rest.
  private meetKeeper() {
    this.beacon.visible = false;
    this.bang.visible = false;
    this.hud.showDialogue(KEEPER_MEET, () => {
      this.audio.jingle();
      if (this.npcs.lamplighter) this.npcs.lamplighter.visible = false;   // he sees his lamps to bed
      if (this.mysteryLight) this.mysteryLight.visible = false;           // the old light, put to rest
      this.hud.chapterCard('LEVEL 2 · CHAPTER 3 COMPLETE', 'The Lamplighter', 'the old light rests — but a storm is coming');
      this.setCh7(2);
      // again: no teleport — you paddle home, and the lobsterman flags you down on the way in
      // (auto-triggers in update()) with the storm send-off that opens the finale.
    });
  }

  // Level 2 finale: the beam swept across a boat — it's seen the light, turns toward
  // it, and steadies its lantern. When the last one's caught, the fleet heads home.
  private catchBoat(i: number) {
    if (this.caught.has(i)) return;
    this.caught.add(i);
    let mask = 0;
    for (const k of this.caught) mask |= (1 << k);
    localStorage.setItem('nbpt-ch8-boats', String(mask));
    this.audio.bell();                          // a warm "found you" note
    const b = this.lostBoats[i];
    if (b) b.rotation.y = Math.atan2(TOWER.x - LOST[i].x, TOWER.z - LOST[i].z);   // turn into the beam
    this.apply();                               // refresh the "X of N" count
    if (this.caught.size >= LOST.length) this.bringLightHome();
  }

  // where each homecoming boat moors, fanned out around FLEET_HOME so they don't stack
  private fleetSlot(i: number): { x: number; z: number } {
    const off = [[-72, 36], [78, 28], [-46, -52], [60, -64]][i] || [0, 0];
    return { x: FLEET_HOME.x + off[0], z: FLEET_HOME.z + off[1] };
  }

  // Level 2 finale's close: every boat is following the light. Drop the sweep, calm the
  // storm to Christmas morning, send the Coast Guard out to lead the fleet up the river,
  // and land the closing line. The light stays lit — yours to keep.
  private bringLightHome() {
    this.homing = true;
    if (this.cgBoat) { this.cgBoat.position.set(3150, WATER_Y, -900); this.cgBoat.visible = true; }
    this.onSweepEnd();                          // unlock the player + ease the storm off
    this.hud.showDialogue(BRING_HOME, () => {
      this.audio.jingle();
      this.hud.chapterCard('LEVEL 2 COMPLETE', 'Bring the Light Home', 'the light was never yours to own, only yours to keep lit');
      this.setCh8(2);
    });
  }

  // the den + star-room interiors read live state through these and drive their
  // beats back through the quest's own dialogue logic
  get s2(): number { return this.ch2; }
  get s3(): number { return this.ch3; }
  get s4(): number { return this.ch4; }
  get ringedBells(): Set<string> { return this.bells; }
  interact(tag: string) { this.runStepDialogue(tag); }
  // the boat beaches at the den door — first trip starts Chapter 4's interior
  beachDen() { if (this.ch3 === 0) this.setCh3(1); }
  // the den's been found (rowed to at least once) — later trips back skip the discovery
  // row + the BOAT_ARRIVE narration and just slip you down into it
  get denDiscovered(): boolean { return this.ch3 >= 1; }
}
