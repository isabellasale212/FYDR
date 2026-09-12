/* §0u (third bullet), decided 2026-09-10: the weekly nutrition question names
 * the dates instead of saying "this week" about a week that has ended. "Did
 * you hit your protein target most days last week (24 to 30 Aug)?" — and in
 * the correction flow, where the week can be months old, the date range
 * carries the meaning on its own. The default (the last completed week) does
 * not change.
 */
import { readFileSync } from 'node:fs';
import { weekQuestion, shortWeekRange } from '@/lib/nutritionWeekCopy';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const TZ = 'Europe/London';

console.log('the range, short');
{
  assert(shortWeekRange('2026-08-24', TZ) === '24 to 30 Aug', 'same month: "24 to 30 Aug"');
  assert(shortWeekRange('2026-08-31', TZ) === '31 Aug to 6 Sept', 'across a month end: "31 Aug to 6 Sept"');
}

console.log('\nthe question');
{
  assert(weekQuestion('2026-08-24', '2026-08-24', TZ) === 'Did you hit your protein target most days last week (24 to 30 Aug)?',
    'the last completed week: "last week (24 to 30 Aug)"');
  assert(weekQuestion('2026-08-10', '2026-08-24', TZ) === 'Did you hit your protein target most days in the week of 10 to 16 Aug?',
    'an older week (a correction): the dates carry the meaning, no "last week"');
  assert(!/this week/.test(weekQuestion('2026-08-24', '2026-08-24', TZ)), 'never "this week"');
}

console.log('\nthe form');
{
  const src = readFileSync('src/components/NutritionCheckinForm/NutritionCheckinForm.tsx', 'utf8');
  assert(!/most days this week\?/.test(src), 'the form no longer says "this week"');
  assert(/\{weekQuestion\(weekStart, lastCompletedWeek, timezone\)\}/.test(src), 'it renders weekQuestion with the last completed week');
  const page = readFileSync('src/app/(athlete)/nutrition-check-in/page.tsx', 'utf8');
  assert(/lastCompletedWeek=\{lastCompletedWeek\}/.test(page), 'the page passes the last completed week — the default itself is unchanged');
  assert(/const lastCompletedWeek = addDays\(mondayOf\(today\), -7\)/.test(page), 'and still computes it the same way');
  const spec = readFileSync('docs/athlete/screens/04-weekly-nutrition-check-in.md', 'utf8');
  assert(/last week \(24 to 30 Aug\)/.test(spec), 'the spec states the question with the dates');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
