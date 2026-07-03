// The kid-safe rider-name filter lives in FOUR files: each town's race.ts and both
// leaderboard backends. A silent drift means a bad name passes exactly one of them —
// invisible until it's on a kids' board. This diffs the BAD_SUB / BAD_WORD lists
// against the main race.ts and fails loudly on any mismatch. Runs in CI before every
// deploy; the Salem worktree copy is checked when present (local runs), skipped in CI
// (its source lives on the salem-experiment branch, outside this checkout).
//
// Run: node tools/check_filters.mjs

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const FILES = [
  { path: new URL('../src/game/race.ts', import.meta.url), name: 'nbpt race.ts', ref: true },
  { path: new URL('../infra/leaderboard/worker.js', import.meta.url), name: 'worker.js' },
  { path: new URL('../infra/leaderboard/apps-script.gs', import.meta.url), name: 'apps-script.gs' },
  { path: new URL('../../nbpt-salem/src/game/race.ts', import.meta.url), name: 'salem race.ts', optional: true },
];

function listOf(src, constName, file) {
  const m = src.match(new RegExp(`${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]`));
  if (!m) throw new Error(`${file}: ${constName} not found`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort();
}

let ref = null;
let failed = false;
for (const f of FILES) {
  const fsPath = f.path.pathname;
  if (!existsSync(fsPath)) {
    if (f.optional) { console.log(`— ${f.name}: not in this checkout, skipped`); continue; }
    throw new Error(`missing: ${fsPath}`);
  }
  const src = await readFile(fsPath, 'utf8');
  const lists = { BAD_SUB: listOf(src, 'BAD_SUB', f.name), BAD_WORD: listOf(src, 'BAD_WORD', f.name) };
  if (f.ref) { ref = lists; console.log(`✓ ${f.name}: reference (${lists.BAD_SUB.length} subs, ${lists.BAD_WORD.length} words)`); continue; }
  for (const k of ['BAD_SUB', 'BAD_WORD']) {
    const a = new Set(ref[k]), b = new Set(lists[k]);
    const missing = ref[k].filter((w) => !b.has(w));
    const extra = lists[k].filter((w) => !a.has(w));
    if (missing.length || extra.length) {
      failed = true;
      console.error(`✗ ${f.name} ${k} drifted — missing: [${missing}] extra: [${extra}]`);
    }
  }
  if (!failed) console.log(`✓ ${f.name}: in sync`);
}
if (failed) { console.error('FILTER LISTS OUT OF SYNC — fix before deploying'); process.exit(1); }
console.log('all filter lists in sync');
