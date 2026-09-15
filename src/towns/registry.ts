// Every town in the set — powers the Fast-Travel town switcher in ALL builds
// (each town's bundle lists its siblings so players can hop between them).
// To ADD A TOWN: create towns/<id>/ + src/towns/<id>/ (see docs/TOWNS.md),
// then add its town.json import here — one line, every build picks it up.
import nbpt from '../../towns/nbpt/town.json';
import salem from '../../towns/salem/town.json';
import beverly from '../../towns/beverly/town.json';
import ipswich from '../../towns/ipswich/town.json';
import gloucester from '../../towns/gloucester/town.json';
import marblehead from '../../towns/marblehead/town.json';
import manchester from '../../towns/manchester/town.json';
import rockport from '../../towns/rockport/town.json';
import amesbury from '../../towns/amesbury/town.json';
import salisbury from '../../towns/salisbury/town.json';
import charlestown from '../../towns/charlestown/town.json';
import boston from '../../towns/boston/town.json';
import swansea from '../../towns/swansea/town.json';

// `hidden`: the town builds and deploys like any other, but stays OFF the
// Fast-Travel roster of every OTHER town — reachable by its URL only. Swansea is
// the first: a South Coast town on Mount Hope Bay, an hour and a half from the
// North Shore set, built for a family there. Its own build still lists the
// roster (a kid who found it can hop north), and marks itself "you're here".
export type TownEntry = { name: string; emoji: string; path: string; tag: string; hidden?: boolean };

const entry = (t: { name: string; emoji: string; path: string; tag: string; hidden?: boolean }): TownEntry =>
  ({ name: t.name, emoji: t.emoji, path: t.path, tag: t.tag, ...(t.hidden ? { hidden: true } : {}) });

// every town, hidden ones included — the train-arrival lookup and the current-town
// test need the full set (a hidden town must still recognise itself)
export const ALL_TOWNS: TownEntry[] = [entry(nbpt), entry(salem), entry(beverly), entry(ipswich), entry(gloucester), entry(marblehead), entry(manchester), entry(rockport), entry(amesbury), entry(salisbury), entry(charlestown), entry(boston), entry(swansea)];

/** the town this bundle IS, by the boot-time path the vite plugin publishes */
export function currentTown(): TownEntry | undefined {
  const here = ((window as unknown as { __townPath?: string }).__townPath || location.pathname).replace(/\/+$/, '');
  return ALL_TOWNS.filter((t) => t.path !== '/').sort((a, b) => b.path.length - a.path.length)
    .find((t) => { const p = t.path.replace(/\/+$/, ''); return here === p || here.startsWith(p + '/'); })
    || ALL_TOWNS.find((t) => t.path === '/');
}

// the roster the Fast-Travel switcher shows: hidden towns stay off it everywhere
// except in their own build, where the current town is always present
export const TOWNS: TownEntry[] = ALL_TOWNS.filter((t) => !t.hidden || t === currentTown());
