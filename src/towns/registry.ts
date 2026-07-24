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

export type TownEntry = { name: string; emoji: string; path: string; tag: string };

const entry = (t: { name: string; emoji: string; path: string; tag: string }): TownEntry =>
  ({ name: t.name, emoji: t.emoji, path: t.path, tag: t.tag });

export const TOWNS: TownEntry[] = [entry(nbpt), entry(salem), entry(beverly), entry(ipswich), entry(gloucester), entry(marblehead)];
