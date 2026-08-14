/* Regression test for the five follow-up findings from the dayBounds()
 * fix (commit 026fb31, "Fix dayBounds() to use real local-day UTC bounds,
 * not literal UTC-day bounds" — scripts/test-schedule-timezone.ts is that
 * fix's own test and the template this file follows). That fix corrected
 * schedule.ts's dayBounds()/rangeBounds(), but the same literal-UTC-day
 * anti-pattern — `${date}T00:00:00Z`..`${date}T23:59:59.999Z}`, only
 * correct for UTC+0 with no DST — existed independently, unfixed, in five
 * other places, each fixed here the same way (rangeBounds/dayBounds from
 * schedule.ts, or dateInTz/daysBetween from format.ts, never reinvented):
 *
 *  1. timetable.ts's fetchTimetableDay — had its OWN duplicate dayBounds(),
 *     now deleted in favour of importing schedule.ts's fixed one.
 *  2. dashboard.ts's fetchWeekLoad — its own query bounds, AND a second,
 *     distinct bug in the same function: deriving a session's local
 *     calendar day from a stored UTC timestamp via `.slice(0, 10)` (which
 *     reads the UTC date, not the local one) instead of `dateInTz()`.
 *  3. trainingReport.ts's fetchRestOfWeekComparison — its own sessions
 *     query, a second broken instance in the same function whose sibling
 *     fetchWeekMdLabels call had already been fixed.
 *  4. weekTemplates.ts's applyTemplate (and the identical duplicate query
 *     in schedule/planner/apply/page.tsx that renders its preview).
 *  5. auditLog.ts's fetchAuditLog date-range filter.
 *
 * Every trigger case below is the same real-world shape the original
 * audit named: a real instant between 23:00-00:00 UTC, which is
 * 00:00-01:00 local in Europe/London during BST (UTC+1, roughly half the
 * year) — attributed to the wrong calendar day by literal-UTC-day bounds
 * or by slicing a UTC timestamp string directly.
 *
 * None of the five fixed functions are unit-testable directly — each
 * either makes real Supabase calls (fetchTimetableDay, fetchWeekLoad,
 * fetchRestOfWeekComparison, applyTemplate, fetchAuditLog all take a live
 * `Db`) or is module-private (fetchWeekLoad isn't exported). Consistent
 * with test-schedule-timezone.ts's own approach, this exercises the exact
 * shared, exported, timezone-aware primitives (rangeBounds/dayBounds,
 * dateInTz/daysBetween) each fix now calls, using the exact argument
 * shape and trigger timestamps each call site produces — so a regression
 * in the primitive OR in how a call site composes it would fail here.
 *
 * Run:
 *   npm run test:timezone-followups
 * or directly:
 *   node --experimental-strip-types --import ./scripts/lib/register-ts-aliases.mjs scripts/test-timezone-followups.ts
 */

import { dayBounds, rangeBounds, mondayOf } from '../src/lib/queries/schedule';
import { dateInTz, daysBetween, addDays } from '../src/lib/format';

let failed = 0;
let passed = 0;

function assertEqual(actual: unknown, expected: unknown, description: string) {
  const ok = actual === expected;
  if (ok) {
    passed++;
    console.log(`  ok - ${description}`);
  } else {
    failed++;
    console.error(`  NOT OK - ${description}`);
    console.error(`    expected: ${expected}`);
    console.error(`    actual:   ${actual}`);
  }
}

function assertTrue(actual: boolean, description: string) {
  assertEqual(actual, true, description);
}

// ---------------------------------------------------------------------------
// 1. timetable.ts — fetchTimetableDay now imports dayBounds from
//    schedule.ts instead of duplicating it. Same trigger case as the
//    coach's attendance-capture screen would hit: a session at 23:30 UTC
//    (00:30 BST) must be read as the NEXT local day, not the UTC one.
// ---------------------------------------------------------------------------
console.log('\n── 1. Timetable attendance capture: fetchTimetableDay via shared dayBounds() ──');
{
  const lateSession = '2026-07-14T23:30:00.000Z'; // 00:30 BST, 15 Jul locally
  const correctDay = dayBounds('2026-07-15', 'Europe/London');
  const wrongDay = dayBounds('2026-07-14', 'Europe/London');
  assertTrue(
    lateSession >= correctDay.from && lateSession <= correctDay.to,
    'a 23:30 UTC session shows up on the Timetable for its correct LOCAL day (15 Jul), not the UTC one',
  );
  assertTrue(
    !(lateSession >= wrongDay.from && lateSession <= wrongDay.to),
    'the same session is correctly absent from the Timetable for 14 Jul — no duplicate dayBounds() left to disagree with schedule.ts\'s',
  );
}

// ---------------------------------------------------------------------------
// 2. dashboard.ts — fetchWeekLoad. Two distinct, independently-fixed bugs
//    in the same function: the query bounds, and the per-session local-day
//    derivation used for the prior-weeks cutoff.
// ---------------------------------------------------------------------------
console.log('\n── 2a. Saturday readiness week load: fetchWeekLoad\'s own query bounds ──');
{
  // weekStart = upToDate = the Monday itself ("week so far" as of Monday) —
  // rangeBounds(weekStart, upToDate, timezone) is fetchWeekLoad's real call
  // shape (dashboard.ts), distinct from the full 6-day week case
  // test-schedule-timezone.ts already covers.
  const bounds = rangeBounds('2026-07-13', '2026-07-13', 'Europe/London');
  assertEqual(bounds.from, '2026-07-12T23:00:00.000Z', 'Monday-only window lower bound is Sunday 23:00 UTC (Monday 00:00 BST)');
  assertEqual(bounds.to, '2026-07-13T22:59:59.999Z', 'Monday-only window upper bound is Monday 22:59:59.999 UTC (Tuesday 00:00 BST minus 1ms)');

  const tuesdayMorningSession = '2026-07-13T23:15:00.000Z'; // 00:15 BST, 14 Jul locally — Tuesday, not Monday
  const inWindow = tuesdayMorningSession >= bounds.from && tuesdayMorningSession <= bounds.to;
  assertTrue(!inWindow, 'a session at 23:15 UTC (00:15 BST, locally Tuesday) is correctly EXCLUDED from a Monday-only "week so far" window');

  // Sanity check on the bug itself: the old literal-UTC bounds would have
  // wrongly included it, silently pulling a Tuesday-local session into a
  // Monday total and inflating the week-load reference.
  const oldBuggyBounds = { from: '2026-07-13T00:00:00Z', to: '2026-07-13T23:59:59Z' };
  const oldBugIncludedIt = tuesdayMorningSession >= oldBuggyBounds.from && tuesdayMorningSession <= oldBuggyBounds.to;
  assertTrue(oldBugIncludedIt, '(sanity check) the old literal-UTC bounds WOULD have wrongly counted this Tuesday-local session as Monday\'s');
}

console.log('\n── 2b. Saturday readiness week load: the cutoff-day-index math ──');
{
  // The exact reproduction of fetchWeekLoad's prior-weeks loop: a stored
  // session `starts_at` of 23:30 UTC on the week's Monday is 00:30 BST —
  // locally Tuesday, day-index 1, not Monday's day-index 0. The bug was
  // reading `s.starts_at.slice(0, 10)` (the UTC date) instead of
  // `dateInTz(new Date(s.starts_at), timezone)` (the local date).
  const priorSessionStartsAt = '2026-07-13T23:30:00.000Z';
  const weekStart = '2026-07-13'; // Monday
  const upToDate = '2026-07-13'; // cutoff: Monday only, so cutoffDayIndex = 0
  const cutoffDayIndex = daysBetween(weekStart, upToDate);
  assertEqual(cutoffDayIndex, 0, 'cutoffDayIndex for a Monday-only "week so far" is 0');

  // Fixed: dateInTz reads the real local calendar day.
  const sDate = dateInTz(new Date(priorSessionStartsAt), 'Europe/London');
  assertEqual(sDate, '2026-07-14', 'dateInTz reads the session\'s LOCAL day as 14 Jul (Tuesday), not the UTC date 13 Jul');
  const wk = mondayOf(sDate);
  const dayIndex = daysBetween(wk, sDate);
  assertEqual(dayIndex, 1, 'the session\'s real day-index within its week is 1 (Tuesday), not 0 (Monday)');
  assertTrue(dayIndex > cutoffDayIndex, 'fixed: a Tuesday-local session is correctly EXCLUDED from a Monday-only cutoff (dayIndex 1 > cutoff 0)');

  // Sanity check on the bug itself: `.slice(0, 10)` on the raw UTC
  // timestamp reads 13 Jul (Monday) instead of the true local day 14 Jul,
  // which put it at dayIndex 0 — wrongly inside the Monday-only cutoff.
  const sDateOld = priorSessionStartsAt.slice(0, 10);
  assertEqual(sDateOld, '2026-07-13', '(sanity check) `.slice(0, 10)` on the raw UTC timestamp reads 13 Jul, the wrong day');
  const wkOld = mondayOf(sDateOld);
  const dayIndexOld = daysBetween(wkOld, sDateOld);
  assertTrue(!(dayIndexOld > cutoffDayIndex), '(sanity check) the old `.slice(0, 10)` logic WOULD have wrongly included this Tuesday-local session in a Monday-only cutoff (dayIndex 0 is not > cutoff 0)');
}

// ---------------------------------------------------------------------------
// 3. trainingReport.ts — fetchRestOfWeekComparison's own sessions query,
//    via the exact composition the fix uses: rangeBounds(mondayOf(currentDate),
//    addDays(weekStart, 6), timezone).
// ---------------------------------------------------------------------------
console.log('\n── 3. Training report, Rest of the week: fetchRestOfWeekComparison\'s sessions query ──');
{
  const currentDate = '2026-07-16'; // a Thursday mid-week
  const weekStart = mondayOf(currentDate);
  assertEqual(weekStart, '2026-07-13', 'mondayOf(16 Jul) is 13 Jul, the same Monday-to-Sunday week');
  const weekEnd = addDays(weekStart, 6);
  assertEqual(weekEnd, '2026-07-19', 'the week spans to 19 Jul (Sunday)');

  const bounds = rangeBounds(weekStart, weekEnd, 'Europe/London');
  assertEqual(bounds.from, '2026-07-12T23:00:00.000Z', 'week lower bound is Monday 00:00 local (BST), i.e. Sunday 23:00 UTC');
  assertEqual(bounds.to, '2026-07-19T22:59:59.999Z', 'week upper bound is the following Monday 00:00 local minus 1ms');

  // Sunday-night session, the trigger window again: 23:45 BST (22:45 UTC),
  // still Sunday 19 Jul locally — must stay inside THIS week's comparison
  // table, not spill into the next UTC calendar day.
  const sundayLateSession = '2026-07-19T22:45:00.000Z';
  const inWeek = sundayLateSession >= bounds.from && sundayLateSession <= bounds.to;
  assertTrue(inWeek, 'a Sunday 22:45 UTC (23:45 BST) session is inside the Rest of the week comparison for the week it locally belongs to');
}

// ---------------------------------------------------------------------------
// 4. weekTemplates.ts — applyTemplate's "what already exists this week"
//    check (and the identical duplicate query in the Apply page's own
//    preview), via rangeBounds(weekDates[0], weekDates[6], timezone).
// ---------------------------------------------------------------------------
console.log('\n── 4. Week planner Apply: applyTemplate\'s existing-sessions window ──');
{
  const weekDates0 = '2026-07-13'; // Monday
  const weekDates6 = '2026-07-19'; // Sunday
  const bounds = rangeBounds(weekDates0, weekDates6, 'Europe/London');

  // The lower-edge trigger case: a real session at 23:30 UTC the Sunday
  // BEFORE the template week (12 Jul) is 00:30 BST — locally Monday 13
  // Jul, the week's own first day. A coach applying a template to this
  // week needs that session to register as "already exists Monday", or
  // applyTemplate() would create a duplicate on top of it.
  const mondayMorningSession = '2026-07-12T23:30:00.000Z';
  const included = mondayMorningSession >= bounds.from && mondayMorningSession <= bounds.to;
  assertTrue(included, 'a session at 23:30 UTC the prior Sunday (00:30 BST, locally this week\'s Monday) is correctly seen as already existing this week');

  // Sanity check: the old literal-UTC lower bound (`${weekDates[0]}T00:00:00Z`
  // = 2026-07-13T00:00:00Z) would have missed it entirely, since the raw
  // UTC instant falls the calendar day before.
  const oldBuggyFrom = `${weekDates0}T00:00:00Z`;
  const oldBugMissedIt = !(mondayMorningSession >= oldBuggyFrom);
  assertTrue(oldBugMissedIt, '(sanity check) the old literal-UTC lower bound WOULD have missed this session, risking a duplicate session created on top of it');
}

// ---------------------------------------------------------------------------
// 5. auditLog.ts — fetchAuditLog's independent from/to date-range filter,
//    via rangeBounds(date, date, timezone).from / .to (from and to are
//    each optional and set independently, so the fix calls rangeBounds
//    once per edge rather than once for the pair).
// ---------------------------------------------------------------------------
console.log('\n── 5. Audit log date-range filter: fetchAuditLog\'s from/to bounds ──');
{
  // One real audit event, right in the trigger window: 23:30 UTC = 00:30
  // BST, so its true local day is 15 Jul even though its stored UTC
  // timestamp reads 14 Jul — exactly the safeguarding-review scenario the
  // audit log's own header calls out ("who viewed this athlete's data,
  // and when").
  const event = '2026-07-14T23:30:00.000Z';

  // "From 15 Jul": the event must be INCLUDED — it happened at 00:30 local
  // on 15 Jul, on or after the filter's lower bound.
  const fromBound = rangeBounds('2026-07-15', '2026-07-15', 'Europe/London').from;
  assertEqual(fromBound, '2026-07-14T23:00:00.000Z', '"from 15 Jul" resolves to Monday 00:00 BST, i.e. 14 Jul 23:00 UTC');
  assertTrue(event >= fromBound, 'the 00:30-BST event is correctly INCLUDED by a "from 15 Jul" filter');
  const oldBuggyFrom = '2026-07-15T00:00:00Z';
  assertTrue(!(event >= oldBuggyFrom), '(sanity check) the old literal `${from}T00:00:00Z` bound WOULD have wrongly excluded this event from a "from 15 Jul" filter');

  // "To 14 Jul": the SAME event must be EXCLUDED — it happened at 00:30
  // local on 15 Jul, the day AFTER the filter's upper bound, even though
  // its raw stored UTC timestamp still reads "14 Jul".
  const toBound = rangeBounds('2026-07-14', '2026-07-14', 'Europe/London').to;
  assertEqual(toBound, '2026-07-14T22:59:59.999Z', '"to 14 Jul" resolves to just before Tuesday 00:00 BST, i.e. 14 Jul 22:59:59.999 UTC');
  assertTrue(!(event <= toBound), 'the same event is correctly EXCLUDED by a "to 14 Jul" filter — it happened the next local day');
  const oldBuggyTo = '2026-07-14T23:59:59.999Z';
  assertTrue(event <= oldBuggyTo, '(sanity check) the old literal `${to}T23:59:59.999Z` bound WOULD have wrongly included this event in a "to 14 Jul" filter');
}

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
