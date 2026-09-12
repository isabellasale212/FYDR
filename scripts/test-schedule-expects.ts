/* §0aj (first bullet) — the schedule panel's "What the athlete sees" no
 * longer says "RPE due by 19:45" for every training session. The entry's
 * fix: compute it from rpeDueAt (lib/rpeDue.ts, the rule Today and the RPE
 * screen read) for training and match sessions; the other types' strings
 * stay. "Due from": a rating is first accepted thirty minutes after the
 * session ends, and stays open until the end of the following day.
 */
import { readFileSync } from 'node:fs';
import { expectsLabel, EXPECTS } from '@/lib/scheduleGeometry';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const TZ = 'Europe/London';

console.log('the label, from the session\'s own time');
{
  assert(expectsLabel({ type: 'training', dow: '2026-09-14', start: 9, mins: 60 }, TZ) === 'RPE due from 10:30', 'a 09:00–10:00 training session: "RPE due from 10:30"');
  assert(expectsLabel({ type: 'training', dow: '2026-09-14', start: 18.5, mins: 75 }, TZ) === 'RPE due from 20:15', '18:30 + 75 min + 30: 20:15');
  assert(expectsLabel({ type: 'match', dow: '2026-09-12', start: 14, mins: 80 }, TZ) === 'RPE due from 15:50', 'a match: the same rule (after full time)');
  assert(expectsLabel({ type: 'training', dow: '2026-09-14', start: 23.5, mins: 60 }, TZ) === 'RPE due from 01:00', 'past midnight reads as the next day\'s clock, in club time');
  assert(expectsLabel({ type: 'gym', dow: '2026-09-14', start: 9, mins: 60 }, TZ) === 'Sets to log', 'gym: unchanged');
  assert(expectsLabel({ type: 'testing', dow: '2026-09-14', start: 9, mins: 60 }, TZ) === 'Staff entered', 'testing: unchanged');
  assert(expectsLabel({ type: 'recovery', dow: '2026-09-14', start: 9, mins: 60 }, TZ) === '—', 'recovery: unchanged');
  assert(!/19:45/.test(JSON.stringify(EXPECTS)), 'no fixed clock time is left in the map');
}

console.log('\nthe panel reads it');
{
  const src = readFileSync('src/components/ScheduleGrid/SelectedSessionPanel.tsx', 'utf8');
  assert(!/EXPECTS\[session\.type\]/.test(src), 'the panel no longer reads the static map');
  assert((src.match(/expectsLabel\(session, timezone\)/g) ?? []).length === 2, 'both the facts row and the preview read expectsLabel');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
