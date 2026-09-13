/* PATTERN-S7 C9 — the period control explains why the narrow choice is
 * usually wrong, and the window walks both ways (2026-09-13). */
import { readFileSync } from 'node:fs';
import { narrowWindowNote, periodNav } from '@/lib/periodNav';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. walking the window');
{
  const n = periodNav({ key: 'week', from: '2026-09-07', to: '2026-09-13', days: 7, realToday: '2026-09-13' });
  assert(n.previous?.to === '2026-09-06' && n.previous.label === 'Previous 7 days', 'previous ends the day before this window starts');
  assert(n.next === null, 'no next past real today');
  const mid = periodNav({ key: 'week', from: '2026-08-31', to: '2026-09-06', days: 7, realToday: '2026-09-13' });
  assert(mid.next?.to === '2026-09-13' && mid.next.label === 'Next 7 days', 'next steps the window forward by its own length');
  const near = periodNav({ key: 'week', from: '2026-09-03', to: '2026-09-09', days: 7, realToday: '2026-09-13' });
  assert(near.next?.to === '2026-09-13', 'the last step lands on today, never past it');
  const month = periodNav({ key: 'month', from: '2026-08-17', to: '2026-09-13', days: 28, realToday: '2026-09-13' });
  assert(month.previous?.label === 'Previous 28 days', 'a month walks by 28');
  const season = periodNav({ key: 'season', from: '2026-07-01', to: '2026-09-13', days: 75, realToday: '2026-09-13' });
  assert(season.previous === null && season.next === null, 'a season is anchored to the calendar, not walked');
}

console.log('\n2. why the narrow choice is usually wrong');
{
  assert(narrowWindowNote(7) === 'Over 7 days one missed morning moves an athlete\'s rate by 14 points — read four weeks for the habit, 7 days for this week.', 'seven days: one miss is 14 points');
  assert(narrowWindowNote(28) === null, 'four weeks needs no warning');
  assert(narrowWindowNote(14) !== null && /7 points/.test(narrowWindowNote(14)!), 'fourteen days: 7 points');
}

console.log('\n3. the compliance report carries both');
{
  const page = strip(read('src/app/(staff)/reports/compliance/page.tsx'));
  assert(/periodNav\(\{ key: period\.key, from: fromDate, to: today, days: period\.range\.days, realToday \}\)/.test(page), 'the nav is computed from the resolved window');
  assert(/className="rhead-period-nav"/.test(page) && /nav\.previous \? \(/.test(page) && /nav\.next \? \(/.test(page), 'previous and next, each only when it exists');
  assert(/complianceQuery\(period\.key, nav\.previous\.to, groupIds\)/.test(page), 'a step keeps the window length and the group scope, moving only the anchor');
  assert(/narrowWindowNote\(period\.range\.days\)/.test(page) && /className="rhead-period-note"/.test(page), 'the narrow-window note under the control');
  assert(/narrow choice/.test(read('docs/screens/20-compliance-report.md')) && /Previous 7\s+days/.test(read('docs/screens/20-compliance-report.md')), 'the spec says so');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
