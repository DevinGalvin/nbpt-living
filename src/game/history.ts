import * as THREE from 'three';
import { WorldIndex } from '../world/index';
import { Hud } from './hud';
import { GameAudio } from './audio';

// Bronze history markers at the real sites, each opening a card written from
// the research dossier — every one a true story (pillar #4, made walkable).
// Read state persists; the travel panel keeps the count.

const READ_KEY = 'nbpt-history-read';

export type Site = { id: string; x: number; z: number; title: string; year: string; body: string; stamp?: string };

export const SITES: Site[] = [
  {
    id: 'great-fire', x: -30, z: -100, title: 'The Great Fire', year: '1811',
    body: 'One night in May 1811, a fire started in a stable near Inn Street. By morning, most of downtown was gone. The town rebuilt it all in brick, all at once — and that is the downtown you are standing in. Look around: the fire is why everything matches.'
  },
  {
    id: 'market-house', x: -331, z: -285, title: 'The Market House', year: '1823',
    body: 'Built as a market house in 1823. Then it spent a hundred years as the fire station. Now it is a theater. One building has heard applause, alarm bells, and arguments about the price of fish.'
  },
  {
    id: 'custom-house', x: 966, z: -448, title: 'The Custom House', year: '1835',
    body: 'Solid granite, designed by the same man who designed the Washington Monument. Ship captains came in here to tell the government what their ships were carrying — and pay the tax. Some of them even told the truth.'
  },
  {
    id: 'uscg', x: 60, z: -900, title: 'Birthplace of the Coast Guard', year: '1791',
    body: 'In 1791, Newburyport built and launched the Massachusetts — the very first ship of the fleet that became the U.S. Coast Guard. The Coast Guard still calls this city its birthplace. The station across the harbor agrees.'
  },
  {
    id: 'frs-steeple', x: -1040, z: 640, title: 'The Steeple', year: '1801',
    body: 'Finished in 1801, and called one of the finest steeples in New England. It has survived gales, lightning, and two hundred years of paint decisions. The clock has told the town the time all along. The town is still late.'
  },
  {
    id: 'tracy-library', x: -845, z: 2306, title: 'The Tracy Mansion', year: '1771',
    body: 'Built in 1771 for Nathaniel Tracy, who got rich sending privateers — legal pirates — after British ships. George Washington slept here in 1789. There was a parade, obviously. Today, anyone with a library card can read in the room he slept in. Bring yours.'
  },
  {
    id: 'bulfinch-court', x: -2740, z: 2920, title: 'The Bulfinch Courthouse', year: '1805',
    body: 'Designed by Charles Bulfinch, who also designed the U.S. Capitol. Judges still hear cases inside — it is one of the oldest working courthouses in America. Down the hill, Frog Pond has been freezing for skaters since before the courthouse was here to watch.'
  },
  {
    id: 'cushing-house', x: -430, z: 4180, title: 'The Cushing House', year: '1808',
    body: 'Three generations of Cushings filled this brick mansion with what sea captains carried home: porcelain, silk, silver, stories. Caleb Cushing left it to become America’s first ambassador to China. The garden out back is still arguing with the New England weather — and still winning.'
  },
  {
    id: 'whitefield', x: 2520, z: 2730, title: 'The Preacher Underneath', year: '1770',
    body: 'George Whitefield was the most famous preacher of his time. He died in Newburyport in 1770, and was buried in a crypt right under this pulpit. His arm spent years in a small wooden box, shown to visitors, before it was returned to the crypt. Every word of this is true.'
  },
  {
    id: 'walking-light', x: 33230, z: -3300, title: 'The Walking Lighthouse', year: '1788',
    body: 'The sandbars at the river mouth will not hold still, so the lighthouse learned to follow them. Keepers dragged it across the dunes on log rollers — more than once. A lighthouse that walks. Plum Island had one first.'
  },
  {
    id: 'range-lights', x: 2412, z: 160, title: 'The Range Lights', year: '1873',
    body: 'Captains lined up this brick tower with the smaller light by the water. Lights stacked: you were safe in the channel. Lights apart: you were about to meet a sandbar. GPS before GPS, since 1873.'
  },
  {
    id: 'dexter-grave', x: -4380, z: 3480, title: 'Lord Timothy Dexter', year: '1747–1806',
    body: 'He sold warming pans to the Caribbean (they made fine ladles) and shipped coal to Newcastle (it arrived during a strike) — and got rich both times. He wrote a book with no punctuation at all; when readers complained, the next edition added a page of commas and periods to "pepper and solt it as you plese." He rests here. Probably pleased.'
  },
  {
    id: 'dexter-house', x: -7332, z: 495, title: 'Dexter’s Museum', year: '1798',
    body: 'Lord Dexter crowned his mansion with more than forty carved wooden statues — presidents, philosophers, himself (twice). A great gale in 1815 scattered them, and the survivors sold for pennies. Keep your eyes open around town. You never know what washed up where.'
  },
  {
    id: 'garrison', x: -2740, z: -360, title: 'The Paper Boy', year: '1805–1879',
    body: 'William Lloyd Garrison delivered newspapers on these streets at thirteen. He grew up to publish The Liberator and spend thirty years demanding the end of slavery in America — and he lived to see it. The statue faces the square where his route began.'
  },
  {
    id: 'powder-house', x: -12138, z: 3520, title: 'The Powder House', year: '1822',
    body: 'The town kept its gunpowder in this little brick drum, far enough from downtown that a bad day at the powder house stayed a bad day at the powder house. The walls are round so there are no corners to catch a spark. Somebody thought hard about this building.'
  },
  {
    id: 'old-jail', x: -4564, z: 2520, title: 'The Old Gaol', year: '1825',
    body: 'Granite, three feet thick, built in 1825 to hold whalers, smugglers, and the occasional pirate while they considered their choices. The view is better from where you are standing. It always was.'
  },
  {
    id: 'first-flight', x: 18420, z: 13560, title: 'First Flight at Plum Island', year: '1910',
    body: 'Seven years after the Wright brothers, a Burgess biplane lifted off this grass — the first flight in this corner of New England, from what is now the region’s oldest airfield. Pilots have been landing on the same field ever since. Some of them on purpose.'
  },
  {
    id: 'chain-bridge', x: -24290, z: -20570, title: 'The Chain Bridge', year: '1810',
    body: 'The first bridge ever built across the Merrimack stood here in 1792. The next one hung from giant iron chains — one of the first suspension bridges in America. The river has knocked a few down since. The name stuck.'
  },
  {
    id: 'tannery-mills', x: 4096, z: 1700, title: 'The Mills', year: '1800s',
    body: 'Newburyport made things: combs, shoes, hats — and silver. For a hundred years, Towle silver ended up on wedding tables all across America. The old mill buildings still work for a living; the farmers market moves in every Sunday.'
  },
  {
    id: 'city-hall', x: -1930, z: 160, title: 'City Hall', year: '1851',
    body: 'Newburyport decided everything at town meetings until 1851, when it became one of the first cities in Massachusetts. This brick hall has held mayors, hearings, and several legendary arguments about parking. Democracy, in its natural habitat.'
  },
  {
    id: 'morse-poltergeist', x: 64, z: 92, title: 'The Market Square Poltergeist', year: '1679',
    body: 'In 1679, the Morse house near this square filled with flying pots, walking chairs, and noises no one could explain. Neighbors cried witchcraft, and Elizabeth Morse barely escaped the gallows. Historians’ best suspect today: her grandson John, a bored teenager with excellent aim. The disturbances stopped when he moved out.'
  },
  {
    id: 'inn-street', x: -470, z: 600, title: 'The Street That Fought Back', year: '1970s',
    body: 'In the 1960s, the plan was to bulldoze this downtown and pave it for parking. Newburyport said no, and fixed up the old brick instead. Other cities came to copy it. The fountain arrived in 1975; the kids arrived immediately.'
  },
  {
    id: 'joppa', x: 7200, z: 3950, title: 'Joppa', year: 'three centuries',
    body: 'The flats off this shore fed the neighborhood for three hundred years — clammers working the tides, selling by the bushel, arguing about greenheads. A little fishing village at the edge of the city, and prouder of these mudflats than downtown will ever understand.'
  },
  {
    id: 'marchs-hill', x: 2130, z: 8960, title: 'March’s Hill', year: 'every winter',
    body: 'The town has sledded this hill for as long as anyone’s grandmother can remember — and in a city this old, that is saying something. First snow, school cancelled, hill full by nine.'
  },
  {
    id: 'oak-hill', x: -900, z: 8800, title: 'Oak Hill', year: '1842',
    body: 'Back in 1842, a cemetery was also a park — families came here on Sundays to stroll and picnic under the trees. Some of the oldest trees in the city still keep the quiet.'
  },
  {
    id: 'spl-farm', x: 11560, z: 14540, title: 'The Stone Manor', year: '1690',
    body: 'The Spencer-Peirce-Little farmhouse went up around 1690 — stone and brick when nearly everything else was wood — and the land around it has been farmed ever since. Three hundred years of harvests, one stubborn, magnificent house.'
  },
  {
    id: 'pink-house', x: 25860, z: 13420, title: 'The Pink House', year: '1925–2025',
    body: 'A house alone in the marsh, painted pink, since 1925. Legend says it was built out of spite; everyone agrees it was loved. Painters painted it, photographers chased its light, and when it came down in 2025 the whole region felt it. Some landmarks are buildings. This one was a feeling.',
    stamp: '★ NEVER FORGOTTEN'
  },
  {
    id: 'maudslay', x: -38180, z: -13350, title: 'Maudslay', year: '1985',
    body: 'The Moseley family estate: carriage roads, formal gardens, and azaleas above the Merrimack. Massachusetts made it a state park in 1985. Bald eagles winter in the tall pines — look up in January, and bring the binoculars.'
  },
  {
    id: 'mooncusser', x: 33868, z: -4520, title: 'The Mooncussers', year: 'no comment',
    body: 'Mooncussers, the story goes, walked these dunes with false lanterns, hoping to lure ships aground for the salvage — and cursed the bright moon for spoiling the trick. No Newburyport mooncusser was ever caught. Make of that what you will.',
    stamp: '★ A LOCAL LEGEND'
  },
  {
    id: 'atkinson', x: -17810, z: -12240, title: 'Atkinson Common', year: '1890s',
    body: 'The North End’s green since the 1890s, kept by a society of neighbors who planted the trees and meant it. The fieldstone tower went up in the 1930s. Climbers report an excellent view and a strong sense of accomplishment.'
  }
];

function plaqueMesh(seed: number): THREE.Group {
  const g = new THREE.Group();
  const post = new THREE.Mesh(new THREE.BoxGeometry(1.3, 15, 1.3), new THREE.MeshLambertMaterial({ color: '#3a3631' }));
  post.position.y = 7.5;
  post.castShadow = true;
  g.add(post);
  const rim = new THREE.Mesh(new THREE.BoxGeometry(9.2, 7, 0.7), new THREE.MeshLambertMaterial({ color: '#52432c' }));
  rim.position.set(0, 13.4, 0.2);
  rim.rotation.x = -0.13;
  g.add(rim);
  const plate = new THREE.Mesh(
    new THREE.BoxGeometry(8.4, 6.2, 0.6),
    new THREE.MeshLambertMaterial({ color: '#9a7e4e', emissive: '#4a3a1c', emissiveIntensity: 0.25 })
  );
  plate.position.set(0, 13.4, 0.62);
  plate.rotation.x = -0.13;
  g.add(plate);
  g.rotation.y = (seed % 7) * 0.5 - 1.5;
  return g;
}

export class HistoryRunner {
  private read: Set<string>;
  private hud: Hud;
  private audio: GameAudio;
  private index: WorldIndex;
  private nearId: string | null = null;
  private glints = new Map<string, THREE.Mesh>();
  private t = 0;

  constructor(scene: THREE.Scene, index: WorldIndex, hud: Hud, audio: GameAudio) {
    this.hud = hud;
    this.audio = audio;
    this.index = index;
    try {
      this.read = new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]'));
    } catch {
      this.read = new Set();
    }
    let seed = 0;
    for (const s of SITES) {
      const m = plaqueMesh(seed++);
      m.position.set(s.x, index.heightAtPx(s.x, s.z), s.z);
      scene.add(m);
      // unread markers carry a small gold glint
      const glint = new THREE.Mesh(
        new THREE.SphereGeometry(1.5, 8, 6),
        new THREE.MeshBasicMaterial({ color: '#ffd24a', transparent: true, opacity: 0.9 })
      );
      glint.position.set(s.x, m.position.y + 22, s.z);
      glint.visible = !this.read.has(s.id);
      scene.add(glint);
      this.glints.set(s.id, glint);
    }
    this.hud.setHistoryCount(this.read.size, SITES.length);
  }

  // whether a marker currently owns the talk button (eggs defer to us)
  get nearActive(): boolean {
    return this.nearId !== null;
  }

  // suppressed = the quest system already owns the talk button
  update(dt: number, px: number, pz: number, suppressed: boolean) {
    this.t += dt;
    for (const [id, glint] of this.glints) {
      if (glint.visible) glint.position.y += Math.sin(this.t * 2.6 + glint.position.x) * dt * 1.4;
      void id;
    }
    if (this.hud.dialogueOpen) {
      if (this.nearId) { this.nearId = null; this.hud.showTalk(null); }
      return;
    }
    if (suppressed) {
      this.nearId = null;   // the quest owns the button — don't clobber its TALK
      return;
    }
    let best: Site | null = null;
    let bd = 54;
    for (const s of SITES) {
      const d = Math.hypot(px - s.x, pz - s.z);
      if (d < bd) { bd = d; best = s; }
    }
    if ((best && best.id) !== this.nearId) {
      this.nearId = best ? best.id : null;
      this.hud.showTalk(best ? '\u{1F4DC} READ' : null, () => this.tryInteract(px, pz));
    }
  }

  tryInteract(px: number, pz: number) {
    if (this.hud.dialogueOpen) return;
    let best: Site | null = null;
    let bd = 60;
    for (const s of SITES) {
      const d = Math.hypot(px - s.x, pz - s.z);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) return;
    this.hud.showTalk(null);
    this.nearId = null;
    this.audio.paper();
    this.hud.historyCard(best.title, best.year + ' · Newburyport', best.body, best.stamp);
    if (!this.read.has(best.id)) {
      this.read.add(best.id);
      localStorage.setItem(READ_KEY, JSON.stringify([...this.read]));
      const glint = this.glints.get(best.id);
      if (glint) glint.visible = false;
      this.audio.jingle();
      this.hud.setHistoryCount(this.read.size, SITES.length);
      if (this.read.size === SITES.length && !localStorage.getItem('nbpt-historian')) {
        localStorage.setItem('nbpt-historian', '1');
        setTimeout(() => this.hud.chapterCard('EVERY MARKER FOUND', 'Town Historian', 'Newburyport remembers — and now, so do you'), 600);
      }
    }
  }
}
