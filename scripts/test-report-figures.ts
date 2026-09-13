/* PATTERN-S7 C2 — every figure with its denominator and an exclusions
 * sentence; missing values as words; worst first. One report a commit; the
 * compliance report first (2026-09-13). */
import { readFileSync } from 'node:fs';
import { NONE_WAIVED, NOT_EXPECTED, NO_ENTRY_IN_WINDOW, exclusionsLine, submittedLine } from '@/lib/reportFigures';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the sentences');
{
  assert(exclusionsLine({ waivedAthletes: 0, waivedDays: 0 }) === 'Nobody is excluded.', '"Nobody is excluded."');
  assert(exclusionsLine({ waivedAthletes: 2, waivedDays: 5 }) === '2 athletes are excluded on 5 waived days — a waiver is "was not asked", not "did not submit".', 'who, on how many days, and what a waiver means');
  assert(exclusionsLine({ waivedAthletes: 1, waivedDays: 1 }) === '1 athlete is excluded on 1 waived day — a waiver is "was not asked", not "did not submit".', 'singular');
  assert(/Fewer than five athletes/.test(exclusionsLine({ waivedAthletes: 0, waivedDays: 0, floored: true })), 'the squad floor is an exclusion too (C8)');
  assert(submittedLine({ submitted: 24, expected: 30, waived: 2 }) === '24 of 30 submitted · 2 waived', 'the count with its denominator');
  assert(submittedLine({ submitted: 0, expected: 0, waived: 0 }) === 'No expectations configured for this domain', 'nothing expected, ever');
  assert(submittedLine({ submitted: 0, expected: 0, waived: 3 }) === 'Nothing expected · 3 waived', 'nothing expected because it was all waived');
  assert(NOT_EXPECTED === 'Not expected' && NONE_WAIVED === 'None' && NO_ENTRY_IN_WINDOW === 'No entry in this window', 'the words for a missing value');
}

console.log('\n2. the compliance report — the first of the six');
{
  const page = strip(read('src/app/(staff)/reports/compliance/page.tsx'));
  assert(/exclusionsLine\(\{ waivedAthletes, waivedDays, floored: belowSquadFloor\(measured\.length\) \}\)/.test(page), 'the by-athlete figures carry the exclusions sentence');
  assert(/submittedLine\(\{ submitted: s\.submitted, expected: s\.expected, waived: s\.waived \}\)/.test(page), 'the summary counts come from the one rule');
  assert(/\{s\.pct === null \? NOT_EXPECTED : `\$\{s\.pct\}%`\}/.test(page), 'a summary figure with nothing expected reads "Not expected", not a dash');
  assert(/\{expected === 0 \? NOT_EXPECTED : `\$\{submitted\} of \$\{expected\}`\}/.test(page), 'a row with nothing expected too');
  assert(/\{row\.waivedCount === 0 \? NONE_WAIVED : row\.waivedCount\}/.test(page), 'no waived days is "None"');
  assert(/\{row\.lastSubmission \? formatDate\(row\.lastSubmission, timezone\) : NO_ENTRY_IN_WINDOW\}/.test(page), 'no last entry is said');
  assert(/\{pct === null \? \(row\.waivedCount > 0 \? 'Waived' : NOT_EXPECTED\) : `\$\{pct\}%`\}/.test(page), 'a row\'s missing percentage is words');
  assert(/count: pct === null \? NOT_EXPECTED : /.test(page), 'and a day cell with nothing expected');
  assert(/Sorted worst first/.test(page), 'worst first, said');
  const dashes = (page.match(/'—'/g) ?? []).length;
  assert(dashes === 0, `no dash stands in for a count on this report (${dashes} left)`);
}

console.log('\n3. the spec');
{
  assert(/Nobody is excluded/.test(read('docs/screens/20-compliance-report.md')), '20-compliance-report.md carries the exclusions sentence');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
