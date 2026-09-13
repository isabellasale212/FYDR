/* PATTERN-S8 C12 (2026-09-13): tables become cards below 900px — audit,
 * retention (the schedule, the nightly reports, the preview), subject
 * access — so nothing scrolls sideways at 375. */
import { readFileSync } from 'node:fs';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the rule');
{
  const css = strip(read('src/styles/base.css'));
  const block = css.slice(css.indexOf('table.tbl.tbl-cards,'), css.indexOf('table.tbl.tbl-cards td.r {') + 80);
  assert(/@media \(max-width: 900px\) \{\s*table\.tbl\.tbl-cards,/.test(css), 'the 900px boundary — the declared one, not a new number');
  assert(/table\.tbl\.tbl-cards tr \{[^}]*display: block/.test(block) && /table\.tbl\.tbl-cards tr \{[^}]*border: 1px solid var\(--border\)/.test(block), 'a row is a bordered card');
  assert(/table\.tbl\.tbl-cards td::before \{[^}]*content: attr\(data-label\)/.test(block) && /display: block/.test(block.slice(block.indexOf('td::before'))), 'each cell carries its column heading as a block label');
  assert(/table\.tbl\.tbl-cards thead \{[^}]*clip: rect\(0 0 0 0\)/.test(block), 'the heading row is hidden, not removed');
  assert(/td:not\(\[data-label\]\)::before,\s*table\.tbl\.tbl-cards td\[data-label=''\]::before \{\s*content: none;/.test(block), 'a cell with no label (an action) carries none');
}

console.log('\n2. the three screens, every cell labelled');
{
  const files: [string, string[]][] = [
    ['src/app/(staff)/settings/audit/page.tsx', ['When', 'Who', 'Action', 'Entity', 'Athlete']],
    ['src/app/(staff)/settings/subject-access/page.tsx', ['Athlete', 'Requested', 'Requested by', 'Due', 'Status']],
    ['src/app/(staff)/settings/retention/page.tsx', ['Category', 'Retention', 'Clock starts', 'Automated here', 'When', 'Import files eligible', 'Injuries eligible']],
    ['src/components/RetentionPanel/RetentionPanel.tsx', ['Category', 'Rows affected', 'Cutoff']],
  ];
  for (const [f, labels] of files) {
    const src = strip(read(f));
    assert(/className="tbl tbl-cards"/.test(src) && !/className="tbl"/.test(src), `${f.split('/').slice(-1)[0]}: every table is a card stack`);
    assert(labels.every((l) => src.includes(`data-label="${l}"`)), `${f.split('/').slice(-1)[0]}: every column's cells carry its heading (${labels.join(', ')})`);
  }
  assert(/table|card/i.test(read('docs/screens/51-audit-log.md')) && /900/.test(read('docs/screens/51-audit-log.md')) && /900/.test(read('docs/screens/52-data-retention.md')) && /900/.test(read('docs/screens/53-subject-access.md')), 'the three specs say so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
