/* ATH-ADULT-12 C6 (decision sheet group (c), 2026-09-12): the empty period on
 * My data says when the last entry was and offers "Show this season" (the
 * period never widens on its own); a brand-new athlete gets "Nothing on
 * record yet." with no action. Written to PATTERN-S6's grammar. Unit tests on
 * lib/myDataEmpty.ts, then the read and the page.
 */
import { readFileSync } from 'node:fs';
import { emptyPeriodCopy, emptyTitle, daysAgo, agoLabel, widenTo } from '@/lib/myDataEmpty';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('the title, from the control\'s own label');
{
  assert(emptyTitle('Last 28 days') === 'Nothing in the last 28 days.', '"Nothing in the last 28 days."');
  assert(emptyTitle('Last 7 days') === 'Nothing in the last 7 days.', '"Nothing in the last 7 days."');
  assert(emptyTitle('This season') === 'Nothing this season.', '"Nothing this season."');
  assert(emptyTitle('Last 365 days') === 'Nothing in the last 365 days.', '"Nothing in the last 365 days."');
}

console.log('\ndays ago');
{
  assert(daysAgo('2026-08-13', '2026-09-11') === 29 && agoLabel(29) === '29 days ago', 'Thu 13 Aug on Fri 11 Sept is 29 days ago');
  assert(agoLabel(0) === 'today' && agoLabel(1) === 'yesterday', 'today / yesterday');
}

console.log('\nthe one action widens to the smallest period that holds the entry');
{
  assert(widenTo('month', '2026-08-13', '2026-07-01')?.period === 'season' && widenTo('month', '2026-08-13', '2026-07-01')?.label === 'Show this season', 'last 28 days, an entry this season → Show this season');
  assert(widenTo('month', '2026-05-13', '2026-07-01')?.period === 'all', 'an entry before the season start → Show all on record');
  assert(widenTo('season', '2026-05-13', '2026-07-01')?.period === 'all', 'already on the season → all on record');
  assert(widenTo('month', '2026-08-13', null)?.period === 'all', 'no season at the club → all on record');
  assert(widenTo('all', '2026-08-13', '2026-07-01') === null, 'nothing wider than all');
}

console.log('\nthe copy');
{
  const older = emptyPeriodCopy({ domain: 'gym', periodKey: 'month', rangeLabel: 'Last 28 days', latest: '2026-08-13', latestLabel: 'Thu 13 Aug', seasonStart: '2026-07-01', today: '2026-09-11' });
  assert(older.title === 'Nothing in the last 28 days.', 'older data: the period is named');
  assert(older.body === 'Your last gym session was Thu 13 Aug, 29 days ago. It is still on record, just before the period you have chosen. Gym sessions appear here once you finish one.', 'when the last one was, that it is still there, and what fills it');
  assert(older.action?.label === 'Show this season', 'and the one action');
  const fresh = emptyPeriodCopy({ domain: 'wellness', periodKey: 'month', rangeLabel: 'Last 28 days', latest: null, latestLabel: null, seasonStart: '2026-07-01', today: '2026-09-11' });
  assert(fresh.title === 'Nothing on record yet.' && fresh.action === null && /appear here once you start submitting/.test(fresh.body), 'brand-new: "Nothing on record yet.", no action, what would fill it');
  const week = emptyPeriodCopy({ domain: 'nutrition', periodKey: 'week', rangeLabel: 'Last 7 days', latest: '2026-08-31', latestLabel: 'Mon 31 Aug', seasonStart: '2026-07-01', today: '2026-09-12' });
  assert(/was for the week of Mon 31 Aug\./.test(week.body), 'a weekly check-in is named by its week');
  const all = emptyPeriodCopy({ domain: 'gym', periodKey: 'all', rangeLabel: 'All on record', latest: null, latestLabel: null, seasonStart: null, today: '2026-09-11' });
  assert(all.title === 'Nothing on record yet.' && all.action === null, 'on All on record with nothing, the never state');
}

console.log('\nthe read and the page');
{
  const q = strip(read('src/lib/queries/myLatestRecord.ts'));
  assert(/export async function fetchMyLatestRecord\(/.test(q) && /order\('entry_date', \{ ascending: false \}\)/.test(q) && /order\('week_start', \{ ascending: false \}\)/.test(q), 'fetchMyLatestRecord reads the latest date per domain, unbounded by the period');
  const page = strip(read('src/app/(athlete)/my-data/page.tsx'));
  for (const d of ['wellness', 'gym', 'training', 'nutrition']) {
    assert(new RegExp(`<EmptyPeriod db=\\{db\\} athleteId=\\{athleteId\\} domain="${d}" tab="${d}"`).test(page), `the ${d} tab's empty state is the grammar's`);
  }
  assert(/<EmptyPeriod /.test(page) && /period=\$\{copy\.action\.period\}|PERIOD_PARAM\}=\$\{copy\.action\.period\}/.test(page), 'the action is a Link that changes the period — never automatic');
  assert(!/title="Nothing logged yet"/.test(page) && !/title="Nothing in this window"/.test(page) && !/title="Nothing answered yet"/.test(page), 'the four old titles are gone');
  const css = strip(read('src/styles/base.css'));
  assert(/\.empty-period-action\s*\{[^}]*min-height:\s*44px/.test(css), 'the action is a 44px full-width secondary');
}

console.log('\nthe spec');
{
  const spec = read('docs/athlete/screens/06-my-data.md');
  assert(/Nothing on record yet/.test(spec) && /Show this season/.test(spec), '06-my-data.md describes both states');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
