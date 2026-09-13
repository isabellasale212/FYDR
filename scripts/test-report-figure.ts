/* PATTERN-S7 C1, the figure card (2026-09-13): one emphasised figure per
 * report — the count with its denominator before the percentage, then the
 * sample, then the exclusions in a full sentence ("Nobody is excluded" when
 * nothing is). The board's card is --blue-100/200 at 48px --font-num; the
 * system's is the wash family (.pp-hero's surface) at --fs-48. One report a
 * commit; §2 grows with each. */
import { readFileSync } from 'node:fs';
import { athleteComplianceFigure, availabilityFigure, boardFigure, complianceFigure, squadComplianceFigure, testCoverageFigure } from '@/lib/reportFigureCards';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the component and its rule');
{
  const comp = strip(read('src/components/ReportFigure/ReportFigure.tsx'));
  assert(/className="card rfig"/.test(comp) && /className="rfig-count num"/.test(comp) && /className="rfig-value num"/.test(comp) && /className="rfig-sample"/.test(comp) && /className="rfig-exclusions"/.test(comp), 'label, the count with its denominator, the value, the sample, the exclusions — in that order');
  const order = ['rfig-label', 'rfig-count', 'rfig-value', 'rfig-sample', 'rfig-exclusions'].map((c) => comp.indexOf(c));
  assert(order.every((i, n) => i >= 0 && (n === 0 || i > order[n - 1]!)), 'and that order is the markup order');
  const css = strip(read('src/styles/base.css'));
  assert(/\.rfig\s*\{[^}]*background:\s*var\(--wash-accent\);[^}]*border:\s*1px solid var\(--border-accent-soft\);/.test(css), 'the emphasised surface is the wash family (.pp-hero\'s), not a new colour');
  assert(/\.rfig-value\s*\{[^}]*font-size:\s*var\(--fs-48\);[^}]*font-weight:\s*600;/.test(css), 'the value at --fs-48, semi');
  const rfigBlocks = css.match(/\.rfig[-\w]*\s*\{[^}]*\}/g) ?? [];
  assert(rfigBlocks.length === 6 && rfigBlocks.every((b) => !/#[0-9a-f]{3,6}/i.test(b) && (b.match(/\d+px/g) ?? []).every((px) => px === '1px')), 'tokens only: no raw hex, no raw px beyond the 1px hairline .pp-hero also draws');
  assert(/\.rfig-value \+ \.rfig-sample|\.rfig-exclusions\s*\{[^}]*color:\s*var\(--muted\)/.test(css), 'the exclusions read in --muted');
}

console.log('\n2. compliance: submitted of expected across the domains');
{
  const f = complianceFigure({
    summary: [
      { domain: 'wellness', expected: 206, submitted: 4, waived: 2, pct: 2 },
      { domain: 'training_rpe', expected: 174, submitted: 4, waived: 0, pct: 2 },
      { domain: 'gym', expected: 0, submitted: 0, waived: 0, pct: null },
    ],
    athleteCount: 30,
    rangeLabel: 'Last 28 days',
    waivedAthletes: 2,
    waivedDays: 2,
    floored: false,
  });
  assert(f.label === 'Submitted of expected', 'the label');
  assert(f.count === '8 of 380', 'the count with its denominator, summed over the domains that expect anything');
  assert(f.value === '2%', 'the percentage after it');
  assert(f.sample === '30 athletes · last 28 days · 2 of 3 domains expected', 'the sample: who, over what, and which domains count');
  /* The addendum (13 September 2026): the figure states which entry types it
     counted, before the exclusions sentence — lib/rpeSetting.ts. */
  assert(f.exclusions === 'Counted: wellness check-ins, session ratings. 2 athletes are excluded on 2 waived days — a waiver is "was not asked", not "did not submit".', 'the counted line, then the exclusions in a full sentence');
  const none = complianceFigure({ summary: [{ domain: 'wellness', expected: 10, submitted: 9, waived: 0, pct: 90 }], athleteCount: 5, rangeLabel: 'Last 7 days', waivedAthletes: 0, waivedDays: 0, floored: false });
  assert(none.exclusions === 'Counted: wellness check-ins. Nobody is excluded.' && none.value === '90%' && none.sample === '5 athletes · last 7 days · 1 of 1 domains expected', '"Nobody is excluded" when nothing is');
  const nothing = complianceFigure({ summary: [{ domain: 'wellness', expected: 0, submitted: 0, waived: 0, pct: null }], athleteCount: 5, rangeLabel: 'Last 7 days', waivedAthletes: 0, waivedDays: 0, floored: false });
  assert(nothing.count === 'Nothing expected' && nothing.value === 'Not expected', 'nothing expected anywhere: words, never 0 of 0');
  const nobody = complianceFigure({ summary: [], athleteCount: 0, rangeLabel: 'Last 7 days', waivedAthletes: 0, waivedDays: 0, floored: true });
  assert(nobody.sample === 'Nobody in this filter · last 7 days' && !/0 of 0/.test(JSON.stringify(nobody)), 'an empty filter: "Nobody in this filter", never "0 of 0 domains"');
  const page = strip(read('src/app/(staff)/reports/compliance/page.tsx'));
  assert(/<ReportFigure \{\.\.\.complianceFigure\(\{/.test(page) && page.indexOf('<ReportFigure') < page.indexOf('report.summary.map'), 'the card sits above the per-domain breakdown on the Summary page');
  const pdf = strip(read('src/app/(staff)/reports/compliance/pdf/route.tsx'));
  assert(/<PdfFigure\s[\s\S]{0,40}\{\.\.\.complianceFigure\(/.test(pdf), 'and the PDF carries the same figure');
  assert(/one emphasised figure/i.test(read('docs/screens/20-compliance-report.md')), 'the spec says so');
}

console.log('\n3. injury and availability: available now of the roster');
{
  const f = availabilityFigure({ availableNow: 20, athleteCount: 30, rangeLabel: 'Last 28 days', notRecorded: 3, joinedInPeriod: 1 });
  assert(f.label === 'Available now' && f.count === '20 of 30' && f.value === '67%', 'the count before the percentage');
  assert(f.sample === "30 athletes on today's roster · last 28 days for the days lost beneath", 'the sample says what the roster is and what the period is for');
  assert(/^Nobody is excluded\. 3 /.test(f.exclusions) && /1 joined part-way through/.test(f.exclusions), 'C2\'s availability exclusions, in words');
  const nobody = availabilityFigure({ availableNow: 0, athleteCount: 0, rangeLabel: 'Last 28 days', notRecorded: 0, joinedInPeriod: 0 });
  assert(nobody.count === 'Nobody in this filter' && nobody.value === 'Not measured', 'an empty filter: words, never 0 of 0');
  const page = strip(read('src/app/(staff)/reports/injuries/page.tsx'));
  assert(/<ReportFigure\s[\s\S]{0,40}\{\.\.\.availabilityFigure\(\{/.test(page) && page.indexOf('<ReportFigure') < page.indexOf('className="card cmpl-stats"'), 'the card leads the Current page, above the strip');
  const pdf = strip(read('src/app/(staff)/reports/injuries/pdf/route.tsx'));
  assert(/<PdfFigure\s[\s\S]{0,40}\{\.\.\.availabilityFigure\(/.test(pdf), 'and the PDF leads with it');
  assert(/one emphasised figure/i.test(read('docs/screens/24-injury-report.md')), 'the spec says so');
}

console.log('\n4. training and match: on the board of those in scope');
{
  const f = boardFigure({ onBoard: 21, inScope: 30, session: 'Conditioning', dateLabel: 'Tue 8 Sept', noun: 'athletes', floored: false });
  assert(f.label === 'On the board' && f.count === '21 of 30' && f.value === '70%' && f.sample === 'Conditioning · Tue 8 Sept', 'the count before the percentage, the session as the sample');
  assert(f.exclusions === '9 of 30 in this filter have no GPS record for this session and are not on the board.', 'C2\'s coverage clause as the exclusions');
  const all = boardFigure({ onBoard: 30, inScope: 30, session: 'Conditioning', dateLabel: 'Tue 8 Sept', noun: 'athletes', floored: false });
  assert(all.exclusions === 'Every athlete in this filter has a GPS record for this session — nobody is excluded.', 'nobody excluded, said');
  const floored = boardFigure({ onBoard: 3, inScope: 30, session: 'Conditioning', dateLabel: 'Tue 8 Sept', noun: 'athletes', floored: true });
  assert(/Fewer than five have data, so shading is off; the numbers are unchanged\.$/.test(floored.exclusions), 'the squad floor rides in the exclusions');
  const match = boardFigure({ onBoard: 14, inScope: 15, session: 'v Bath', dateLabel: 'Sat 1 Aug', noun: 'played', floored: false });
  assert(match.label === 'Played, on the board' && match.count === '14 of 15' && /1 of 15 in this filter has no GPS record/.test(match.exclusions), 'the match board: played');
  const nobody = boardFigure({ onBoard: 0, inScope: 0, session: 'x', dateLabel: 'y', noun: 'athletes', floored: false });
  assert(nobody.count === 'Nobody in this filter' && nobody.value === 'Not measured' && nobody.exclusions === 'Nobody in this filter.', 'an empty filter: words');
  const page = strip(read('src/app/(staff)/reports/gps/page.tsx'));
  assert((page.match(/<ReportFigure\s[\s\S]{0,40}\{\.\.\.boardFigure\(\{/g) ?? []).length === 2, 'both boards lead their Board card with it');
  const pdf = strip(read('src/app/(staff)/reports/gps/pdf/route.tsx'));
  assert((pdf.match(/<PdfFigure \{\.\.\.boardFigure\(\{/g) ?? []).length === 2, 'and both PDFs');
  assert(/one emphasised figure/i.test(read('docs/screens/23-gps-report.md')), 'the spec says so');
}

console.log('\n5. the athlete report: met of expected');
{
  const f = athleteComplianceFigure({ met: 24, expected: 30, waived: 2, firstName: 'Dan', rangeLabel: 'Last 28 days' });
  assert(f.label === 'Submitted of expected' && f.count === '24 of 30' && f.value === '80%', 'the count before the percentage');
  assert(f.sample === 'Dan · last 28 days · every domain expected of them', 'the sample: who, over what, across what');
  assert(f.exclusions === '2 waived days are excluded — a waiver is "was not asked", not "did not submit".', 'waived days as the exclusions');
  const none = athleteComplianceFigure({ met: 10, expected: 10, waived: 0, firstName: 'Dan', rangeLabel: 'Last 7 days' });
  assert(none.exclusions === 'Nothing is excluded — no day was waived.' && none.value === '100%', 'nothing excluded, said');
  const nothing = athleteComplianceFigure({ met: 0, expected: 0, waived: 0, firstName: 'Kai', rangeLabel: 'Last 7 days' });
  assert(nothing.count === 'Nothing expected' && nothing.value === 'Not expected', 'nothing expected: words');
  const page = strip(read('src/app/(staff)/reports/athlete/[athleteId]/page.tsx'));
  assert(/<ReportFigure\s[\s\S]{0,40}\{\.\.\.athleteComplianceFigure\(\{/.test(page) && page.indexOf('athleteComplianceFigure({') < page.indexOf('className="ath-summary-grid"'), 'the card leads the Summary page');
  assert(!/ath-stat-label">Compliance/.test(page), 'and the identity row no longer carries the stat — one figure, one place');
  const pdf = strip(read('src/app/(staff)/reports/athlete/[athleteId]/pdf/route.tsx'));
  assert(/<PdfFigure\s[\s\S]{0,40}\{\.\.\.athleteComplianceFigure\(/.test(pdf), 'and the PDF leads with it');
  assert(/one emphasised figure/i.test(read('docs/screens/19-athlete-report.md')), 'the spec says so');
}

console.log('\n6. squad weekly: the week\'s wellness compliance');
{
  const f = squadComplianceFigure({ submitted: 8, expected: 380, waived: 2, waivedAthletes: 2, athleteCount: 30, weekLabel: 'Mon 7 Sept to Sun 13 Sept', deltaText: '▲ 1 pts' });
  assert(f.label === 'Wellness compliance' && f.count === '8 of 380' && f.value === '2%', 'the count before the percentage');
  assert(f.sample === '30 athletes · Mon 7 Sept to Sun 13 Sept · ▲ 1 pts on last week', 'the squad, the week, the change on last week');
  assert(/^2 athletes are excluded on 2 waived days/.test(f.exclusions), 'C2\'s waiver sentence as the exclusions');
  const none = squadComplianceFigure({ submitted: 8, expected: 380, waived: 0, waivedAthletes: 0, athleteCount: 30, weekLabel: 'w', deltaText: null });
  assert(none.exclusions === 'Nobody is excluded.' && none.sample === '30 athletes · w', 'nobody excluded; no delta, no clause');
  const page = strip(read('src/app/(staff)/reports/squad/page.tsx'));
  assert(/<ReportFigure\s[\s\S]{0,40}\{\.\.\.squadComplianceFigure\(\{/.test(page) && /className="sw-kpis sw-kpis-3"/.test(page) && !/label: 'Wellness compliance',\s*value:/.test(page), 'the card leads the page and the tile it replaced is gone — three tiles remain');
  const css = strip(read('src/styles/base.css'));
  assert(/\.sw-kpis-3\s*\{[^}]*repeat\(3, minmax\(0, 1fr\)\)/.test(css), 'three across on desktop, two on a phone as before');
  const pdf = strip(read('src/app/(staff)/reports/squad/pdf/route.tsx'));
  assert(/<PdfFigure\s[\s\S]{0,40}\{\.\.\.squadComplianceFigure\(\{/.test(pdf) && !/label="Compliance, this week"/.test(pdf), 'and the PDF leads with it in place of its compliance tile');
  assert(/one emphasised figure/i.test(read('docs/screens/21-squad-weekly-report.md')), 'the spec says so');
}

console.log('\n7. testing: athletes with a result, for the test chosen');
{
  const f = testCoverageFigure({ withResult: 22, inScope: 30, testName: '40m sprint', rangeLabel: 'This season', floored: false });
  assert(f.label === 'Athletes with a result' && f.count === '22 of 30' && f.value === '73%' && f.sample === '40m sprint · this season', 'the count before the percentage, the test and the period as the sample');
  assert(f.exclusions === '22 of 30 athletes have a result for this test in this window; 8 have none and are not ranked.', 'C2\'s ranked-coverage sentence as the exclusions');
  const floored = testCoverageFigure({ withResult: 3, inScope: 5, testName: 'CMJ', rangeLabel: 'Last 28 days', floored: true });
  assert(/the median and quartiles are not shown; the ranking is\.$/.test(floored.exclusions), 'the squad floor rides in it');
  const nobody = testCoverageFigure({ withResult: 0, inScope: 0, testName: 'CMJ', rangeLabel: 'Last 28 days', floored: false });
  assert(nobody.count === 'Nobody in this filter' && nobody.value === 'Not measured' && nobody.exclusions === 'Nobody in this filter.', 'an empty filter: words');
  const page = strip(read('src/app/(staff)/reports/testing/page.tsx'));
  assert(/<ReportFigure\s[\s\S]{0,40}\{\.\.\.testCoverageFigure\(\{/.test(page) && page.indexOf('testCoverageFigure({') < page.indexOf('className="grid3"'), 'the card leads the by-test tab, above the three stats');
  const pdf = strip(read('src/app/(staff)/reports/testing/pdf/route.tsx'));
  assert(/<PdfFigure\s[\s\S]{0,40}\{\.\.\.testCoverageFigure\(\{/.test(pdf), 'and the PDF\'s ranked section leads with it');
  assert(/one emphasised figure/i.test(read('docs/screens/22-testing-report.md')), 'the spec says so');
  assert(/all seven reports lead with one/i.test(read('docs/reports-catalogue.md')), 'the working catalogue notes the figure card is on all seven');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
