/* PATTERN-S7 C1, TableShell (2026-09-13): one shell for every report's main
 * table — a heading row with the title, the sort order in words where the
 * table is a ranking (the constitution: "lowest or worst first, never
 * alphabetically, wherever there is someone to chase", and the header says
 * so) and the row count with its denominator; a body that scrolls sideways on
 * a narrow screen rather than the page. Composed from .card and the existing
 * type. */
import { readFileSync } from 'node:fs';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the component');
{
  const c = strip(read('src/components/TableShell/TableShell.tsx'));
  assert(/className=\{`card rtable/.test(c) && /className="rtable-head"/.test(c) && /className="card-title rtable-title"/.test(c) && /className="rtable-sort"/.test(c) && /className="rtable-count num"/.test(c) && /className="rtable-body"/.test(c), 'the card, the heading row, the sort in words, the count, the body');
  assert(/\{sort \? <span className="rtable-sort">\{sort\}<\/span> : null\}/.test(c), 'no sort line for a table that is not a ranking');
  const css = strip(read('src/styles/base.css'));
  assert(/\.rtable-body\s*\{[^}]*overflow-x:\s*auto;/.test(css), 'the body scrolls sideways, not the page');
  const blocks = css.match(/\.rtable[-\w.\s]*\{[^}]*\}/g) ?? [];
  assert(blocks.length >= 5 && blocks.every((b) => !/#[0-9a-f]{3,6}/i.test(b) && !/\d+px/.test(b)), 'tokens only');
}

console.log('\n2. the six reports\' main tables sit in it');
{
  const compliance = strip(read('src/app/(staff)/reports/compliance/page.tsx'));
  assert(/<TableShell\s+title="By athlete"\s+sort="Worst first — the athlete to chase is at the top"\s+count=\{`\$\{report\.byAthlete\.length\} of \$\{report\.athleteCount\} athletes`\}/.test(compliance), 'compliance: worst first, N of M athletes');
  const injuries = strip(read('src/app/(staff)/reports/injuries/page.tsx'));
  assert(/<TableShell\s+title="Not fully available today"\s+sort="Unavailable first, then modified, then no medical entry"/.test(injuries), 'injuries: the query\'s order, said');
  const testing = strip(read('src/app/(staff)/reports/testing/page.tsx'));
  assert(/<TableShell\s+title=\{`\$\{byTest\.definition\.name\} — ranked`\}/.test(testing) && /sort=\{`\$\{byTest\.definition\.higher_is_better \? 'Highest' : 'Lowest'\} first — the best result in this test's own direction`\}/.test(testing), 'testing: best first in the test\'s own direction');
  const athlete = strip(read('src/app/(staff)/reports/athlete/[athleteId]/page.tsx'));
  assert(/<TableShell title="Testing" titleId="tests-title" sort=\{null\}/.test(athlete), 'athlete report: the tests table, no sort line (not a ranking)');
  const squad = strip(read('src/app/(staff)/reports/squad/page.tsx'));
  assert(/<TableShell title="Load" titleId="load-title" sort=\{null\} count=\{`\$\{report\.tiles\.acwr\.computable\} of \$\{report\.athleteCount\} computable`\}/.test(squad), 'squad weekly: the load rows with the computable count');
  const training = strip(read('src/app/(staff)/reports/gps/page.tsx'));
  assert((training.match(/<TableShell title="Board" sort="By unit, then the most distance first" count=\{`\$\{board\.rows\.length\} of \$\{scopeSize\} athletes`\}>/g) ?? []).length === 2, 'training: both boards');
  for (const [f, src] of [['compliance', compliance], ['injuries', injuries], ['testing', testing], ['athlete', athlete], ['squad', squad], ['training', training]] as const) {
    const opens = (src.match(/<TableShell[\s>]/g) ?? []).length;
    const closes = (src.match(/<\/TableShell>/g) ?? []).length;
    assert(opens > 0 && opens === closes, `${f}: every shell closed`);
  }
  assert(/TableShell/.test(read('docs/reports-catalogue.md')), 'the working catalogue says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
