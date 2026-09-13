/* PATTERN-S7 C2 — every figure with its denominator and an exclusions
 * sentence; missing values as words; worst first. One report a commit; the
 * compliance report first (2026-09-13). */
import { readFileSync } from 'node:fs';
import { NONE_WAIVED, NOT_EXPECTED, NO_ENTRY_IN_WINDOW, availabilityExclusionsLine, boardCoverageLine, exclusionsLine, rankedCoverageLine, submittedLine } from '@/lib/reportFigures';

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

console.log('\n3. the injury report — the second');
{
  assert(availabilityExclusionsLine({ notRecorded: 0, joinedInPeriod: 0 }) === 'Nobody is excluded, and every athlete is counted for the whole window.', 'nothing odd: said');
  assert(availabilityExclusionsLine({ notRecorded: 3, joinedInPeriod: 0 }) === 'Nobody is excluded. 3 athletes have no recorded status and are counted as available.', 'the "Not recorded" athletes, in words');
  assert(availabilityExclusionsLine({ notRecorded: 1, joinedInPeriod: 2 }) === 'Nobody is excluded. 1 athlete has no recorded status and is counted as available; 2 joined part-way through and are counted for the whole window.', 'and a mid-period joiner');
  const q = strip(read('src/lib/queries/reports.ts'));
  assert(/notRecorded: number;\s*joinedInPeriod: number;/.test(q) && /const joinedInPeriod = athletes\.filter\(\(a\) => a\.joined_at !== null && a\.joined_at > fromDate\)\.length;/.test(q) && /const notRecorded = athletes\.filter\(\(a\) => !withStatus\.has\(a\.id\)\)\.length;/.test(q), 'the report carries both counts');
  const page = strip(read('src/app/(staff)/reports/injuries/page.tsx'));
  assert(/availabilityExclusionsLine\(\{ notRecorded: report\.summary\.notRecorded, joinedInPeriod: report\.summary\.joinedInPeriod \}\)/.test(page), 'the page says them under the figures');
  assert(/\{report\.summary\.availabilityPct === null \? NOT_MEASURED : report\.summary\.availabilityPct\}/.test(page), 'a missing availability figure is words');
  assert(/\{row\.position \?\? NO_POSITION\}/.test(page) && /\{row\.expected_return \? formatDate\(row\.expected_return, timezone\) : RETURN_NOT_KNOWN\}/.test(page) && /\{a\.bodyArea \? enumLabel\(a\.bodyArea\) : SITE_NOT_RECORDED\}/.test(page), 'position, expected return and site in words');
  assert((page.match(/'—'/g) ?? []).length === 0, 'no dash stands in for a value on this report');
  assert(/joined part-way/.test(read('docs/screens/24-injury-report.md')), 'the spec says so');
}

console.log('\n4. the squad weekly report — the third');
{
  const q = strip(read('src/lib/queries/squadWeeklyReport.ts'));
  assert(/compliance: \{ submitted: number; expected: number; waived: number; waivedAthletes: number \};\s*readinessAthletes: number;/.test(q), 'the tiles carry the compliance counts and how many athletes the median is over');
  assert(/const medianReadiness = belowSquadFloor\(readinessAthletes\) \? null : median\(readinessValues\);/.test(q), 'the median is off below the squad floor (C8)');
  const page = strip(read('src/app/(staff)/reports/squad/page.tsx'));
  assert(/sub: submittedLine\(report\.tiles\.compliance\)/.test(page), 'the compliance tile carries "24 of 30 submitted · 2 waived"');
  assert(/over \$\{report\.tiles\.readinessAthletes\} of \$\{report\.athleteCount\} athletes with an entry/.test(page), 'the readiness tile says how many athletes it is over');
  assert(/sub: `\$\{report\.availability\.length\} not fully available`/.test(page) && /sub: `across \$\{report\.athleteCount\} athletes`/.test(page), 'availability and flags carry their denominators');
  assert(/exclusionsLine\(\{\s*waivedAthletes: report\.tiles\.compliance\.waivedAthletes,/.test(page), 'the exclusions sentence under the four figures');
  assert(!/\bBLANK\b/.test(page), 'no BLANK stands in for a value on this report — "No entries", "Not shown", "No data", "Not expected", "No athletes"');
  assert(/'No entries'/.test(page) && /'Not shown'/.test(page) && /'No data'/.test(page) && /NOT_EXPECTED/.test(page), 'the words');
  assert(/Nobody is excluded/.test(read('docs/screens/21-squad-weekly-report.md')), 'the spec says so');
}

console.log('\n5. the training report — the fourth');
{
  assert(boardCoverageLine({ onBoard: 21, inScope: 30, noun: 'athletes' }) === 'n = 21 athletes · 9 of 30 in this filter have no GPS record for this session and are not on the board', 'the board says who is not on it, with the denominator');
  assert(boardCoverageLine({ onBoard: 30, inScope: 30, noun: 'athletes' }) === 'n = 30 athletes · every athlete in this filter has a GPS record for this session — nobody is excluded', 'and when everyone is');
  assert(boardCoverageLine({ onBoard: 14, inScope: 15, noun: 'played' }) === 'n = 14 played · 1 of 15 in this filter has no GPS record for this session and is not on the board', 'a match: played');
  const page = strip(read('src/app/(staff)/reports/training/page.tsx'));
  assert(/boardCoverageLine\(\{ onBoard: board\.rows\.length, inScope: scopeSize, noun: 'athletes' \}\)/.test(page) && /boardCoverageLine\(\{ onBoard: board\.rows\.length, inScope: scopeSize, noun: 'played' \}\)/.test(page), 'both boards carry it');
  assert(/const scopeSize = scopeIds \? scopeIds\.length : squadSize;/.test(page), 'the denominator is the filter\'s size, or the squad');
  assert((page.match(/'—'/g) ?? []).length === 0, 'no dash on the training page — "No data", "No best yet", "Not set", "Result not entered"');
  const q = strip(read('src/lib/queries/trainingReport.ts'));
  assert((q.match(/'—'/g) ?? []).length === 0 && /const NO_VALUE = 'No data';/.test(q), 'nor in its comparison tables');
  assert(/No GPS record|nobody is excluded/.test(read('docs/screens/23-training-report.md')) || /not on the board/.test(read('docs/screens/23-training-report.md')), 'the spec says so');
}

console.log('\n6. the testing report — the fifth');
{
  assert(rankedCoverageLine({ withResult: 22, inScope: 30, floored: false }) === '22 of 30 athletes have a result for this test in this window; 8 have none and are not ranked.', 'who has a result, who is not ranked');
  assert(rankedCoverageLine({ withResult: 30, inScope: 30, floored: false }) === 'Every one of the 30 athletes in this filter has a result for this test in this window — nobody is excluded.', 'everyone');
  assert(/Fewer than five have data, so the median and quartiles are not shown; the ranking is\.$/.test(rankedCoverageLine({ withResult: 3, inScope: 5, floored: true })), 'and the floor');
  const page = strip(read('src/app/(staff)/reports/testing/page.tsx'));
  assert(/rankedCoverageLine\(\{ withResult: byTest\.rows\.length, inScope: byAthlete\.rows\.length, floored: /.test(page), 'the page says it under the three stats');
  assert(/NO_RESULT : formatNumber\(cell\.value/.test(page), 'a by-athlete cell with no result reads "No result"');
  assert(/byTest\.rows\.length === 0 \? 'No results' : NOT_SHOWN/.test(page), 'the median, Q1 and Q3 read "No results" or "Not shown"');
  assert(!/\bBLANK\b/.test(page), 'no BLANK on the testing page');
  assert(/median: belowSquadFloor\(values\.length\) \? null : quartile/.test(strip(read('src/lib/queries/testingReport.ts'))), 'the longitudinal medians are under the floor too (C8)');
  assert(/not ranked/.test(read('docs/screens/22-testing-report.md')), 'the spec says so');
}

console.log('\n7. the spec');
{
  assert(/Nobody is excluded/.test(read('docs/screens/20-compliance-report.md')), '20-compliance-report.md carries the exclusions sentence');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
