/* PATTERN-S7 catalogue, squad weekly (2026-09-13): "The week Monday to Sunday,
 * club local time." The report's window was a trailing seven days ending
 * today, true to the sentence only on a Sunday. Now: the calendar week of the
 * anchor day, Monday to Sunday, the current week running Monday to today; the
 * pager moves a week at a time; an old ?to= link resolves to its week. */
import { readFileSync } from 'node:fs';
import { squadWeek } from '@/lib/squadWeek';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the week');
{
  const wed = squadWeek({ anchor: '2026-09-16', today: '2026-09-16' });
  assert(wed.from === '2026-09-14' && wed.to === '2026-09-16' && wed.isCurrent, 'a Wednesday: Monday to today, the current week');
  assert(wed.prev === '2026-09-07' && wed.next === null, 'previous is the Monday before; nothing after the current week');
  const sun = squadWeek({ anchor: '2026-09-13', today: '2026-09-13' });
  assert(sun.from === '2026-09-07' && sun.to === '2026-09-13' && sun.isCurrent, 'a Sunday: the full week Monday to Sunday');
  const past = squadWeek({ anchor: '2026-09-02', today: '2026-09-16' });
  assert(past.from === '2026-08-31' && past.to === '2026-09-06' && !past.isCurrent && past.next === '2026-09-07', 'a past week: Monday to Sunday, with a next');
  const future = squadWeek({ anchor: '2026-10-01', today: '2026-09-16' });
  assert(future.from === '2026-09-14' && future.to === '2026-09-16', 'a future anchor is clamped to the current week');
  const legacy = squadWeek({ anchor: '2026-09-05', today: '2026-09-16' });
  assert(legacy.from === '2026-08-31' && legacy.to === '2026-09-06', 'an old ?to= (a Saturday) resolves to its own Monday-to-Sunday week');
  const monday = squadWeek({ anchor: '2026-09-14', today: '2026-09-14' });
  assert(monday.from === '2026-09-14' && monday.to === '2026-09-14', 'a Monday: the week has one day so far');
}

console.log('\n2. the query and the pages');
{
  const q = strip(read('src/lib/queries/squadWeeklyReport.ts'));
  assert(/week\?: \{ from: string; to: string \},/.test(q) && !/const from = addDays\(today, -6\)/.test(q), 'the query takes the week; the trailing seven days are gone');
  assert(/const resolved = week \?\? \{ from: mondayOf\(realToday\), to: realToday \};/.test(q) && /fetchComplianceReport\(db, orgId, groupIds, from, today, timezone\)/.test(q), 'compliance and every read are bounded by the week\'s own days');
  const page = strip(read('src/app/(staff)/reports/squad/page.tsx'));
  assert(/squadWeek\(\{ anchor, today: realToday \}\)/.test(page) && /params\.week/.test(page) && /params\.to/.test(page), 'the page anchors on ?week= (or an old ?to=)');
  assert(/toQuery\(week\.prev\)/.test(page) && /week\.next === null/.test(page), 'the pager moves a week at a time and stops at the current one');
  const csv = strip(read('src/app/(staff)/reports/squad/export/route.ts'));
  const pdf = strip(read('src/app/(staff)/reports/squad/pdf/route.tsx'));
  assert(/squadWeek\(/.test(csv) && /squadWeek\(/.test(pdf), 'both exports resolve the same week');
  assert(/Monday to Sunday/.test(read('docs/screens/21-squad-weekly-report.md')), 'the spec says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
