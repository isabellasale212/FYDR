/* PATTERN-S7 C1, the figure card (2026-09-13): one emphasised figure per
 * report — the count with its denominator before the percentage, then the
 * sample, then the exclusions in a full sentence ("Nobody is excluded" when
 * nothing is). The board's card is --blue-100/200 at 48px --font-num; the
 * system's is the wash family (.pp-hero's surface) at --fs-48. One report a
 * commit; §2 grows with each. */
import { readFileSync } from 'node:fs';
import { availabilityFigure, complianceFigure } from '@/lib/reportFigureCards';

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
  assert(f.exclusions === '2 athletes are excluded on 2 waived days — a waiver is "was not asked", not "did not submit".', 'the exclusions in a full sentence');
  const none = complianceFigure({ summary: [{ domain: 'wellness', expected: 10, submitted: 9, waived: 0, pct: 90 }], athleteCount: 5, rangeLabel: 'Last 7 days', waivedAthletes: 0, waivedDays: 0, floored: false });
  assert(none.exclusions === 'Nobody is excluded.' && none.value === '90%' && none.sample === '5 athletes · last 7 days · 1 of 1 domains expected', '"Nobody is excluded" when nothing is');
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

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
