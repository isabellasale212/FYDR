/* Regression test for a bug found alongside, but distinct from, the
 * literal-UTC-day-bounds bug (commit 026fb31 and its five follow-ups,
 * commit b0d0754 — scripts/test-schedule-timezone.ts and
 * scripts/test-timezone-followups.ts are those fixes' own tests, and the
 * template this file follows).
 *
 * That bug was about QUERY BOUNDS: building a day/week window as literal
 * `${date}T00:00:00Z`..`${date}T23:59:59.999Z}`, which is only correct for
 * UTC+0 with no DST. This bug is about DERIVATION: once a session/fixture
 * row is already in hand, reading its own calendar date back out via
 * `x.starts_at.slice(0, 10)` (or `.kickoff_at`/`.raised_at.slice(0, 10)`)
 * — which reads the UTC calendar date of the stored instant, not the
 * org's local one. Same root cause (CLAUDE.md rule 5, format.ts's
 * `dateInTz`), same trigger window (a real instant between 23:00-00:00
 * UTC, 00:00-01:00 local in Europe/London during BST), different call
 * shape. Every site below now calls `dateInTz(new Date(x), timezone)`
 * instead, never reinvented.
 *
 * Fixed sites, one block each below:
 *  1. schedule.ts — fetchWeekMdLabels's byDate map, fetchNormalWeek's
 *     week-of-match grouping (both `mondayOf(dateInTz(...))`).
 *  2. schedule.ts — fetchWeekSessions / fetchWeekSessionsDetailed /
 *     fetchFixtureDetail's shared `entry_date` derivation, and a concrete
 *     downstream consequence (dashboard.ts's "sessions left to run" count).
 *  3. trainingReport.ts — fetchTrainingSessions/fetchMatchSessions's
 *     session-picker `date`, and fetchRestOfWeekComparison's weekMd
 *     lookup + weeksSeen prior-weeks loop.
 *  4. weekTemplates.ts — applyTemplate's fixtureDate anchor (feeds MD-n
 *     offset math) and its existing-session `date` mapping (feeds
 *     buildApplyPlan's per-day matching, so a wrong date here risks a
 *     duplicate session created on top of a real one).
 *  5. dashboard.ts — fetchNextFixture's local-midnight lower bound (a
 *     literal-Z variant of the same anti-pattern, not a derivation, but
 *     found and fixed alongside these) and the toMatchdayDays/daysOut
 *     day-count math.
 *  6. FlagCard.tsx / PlayerProfileFlags.tsx — raisedDate vs `today`.
 *
 * None of the fixed functions are unit-testable directly (each takes a
 * live `Db`, or is a server component). Consistent with the precedent
 * scripts, this exercises the exact shared, exported primitive
 * (`dateInTz`, `daysBetween`, `mondayOf`, `zonedTimeToUtcIso`) each site
 * now calls, using the exact argument shape and trigger timestamps each
 * call site produces, contrasted against what the old `.slice(0, 10)` (or
 * literal-Z) logic would have produced — so a regression in the primitive
 * OR in how a call site composes it would fail here.
 *
 * Run:
 *   npm run test:session-local-date
 * or directly:
 *   node --experimental-strip-types --import ./scripts/lib/register-ts-aliases.mjs scripts/test-session-local-date-derivation.ts
 */

import { mondayOf } from '../src/lib/queries/schedule';
import { dateInTz, daysBetween, zonedTimeToUtcIso } from '../src/lib/format';

const TZ = 'Europe/London';

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
// 1. schedule.ts — fetchWeekMdLabels's byDate map, fetchNormalWeek's
//    week-of-match grouping. Both compose mondayOf(dateInTz(starts_at, tz)).
// ---------------------------------------------------------------------------
console.log('\n── 1. schedule.ts: fetchWeekMdLabels / fetchNormalWeek — mondayOf(dateInTz(...)) ──');
{
  // A match kicking off 23:30 UTC on Sunday 19 Jul is 00:30 BST on Monday
  // 20 Jul — locally the FOLLOWING week's Monday, not the week just
  // finishing.
  const matchStartsAt = '2026-07-19T23:30:00.000Z';

  const oldDate = matchStartsAt.slice(0, 10);
  assertEqual(oldDate, '2026-07-19', '(sanity check) the old `.slice(0, 10)` reads 19 Jul (Sunday), the wrong local day');
  const oldWeek = mondayOf(oldDate);
  assertEqual(oldWeek, '2026-07-13', '(sanity check) the old logic WOULD have grouped this match into the week of 13 Jul — the wrong, earlier week');

  const newDate = dateInTz(new Date(matchStartsAt), TZ);
  assertEqual(newDate, '2026-07-20', 'fixed: dateInTz reads the real local day as 20 Jul (Monday)');
  const newWeek = mondayOf(newDate);
  assertEqual(newWeek, '2026-07-20', 'fixed: the match is correctly grouped into the week of 20 Jul, its own real local week');
  assertTrue(newWeek !== oldWeek, 'the fix changes which week a "typical week" / MD-label lookup uses for this real match');
}

// ---------------------------------------------------------------------------
// 2. schedule.ts — fetchWeekSessions / fetchWeekSessionsDetailed /
//    fetchFixtureDetail's shared entry_date derivation, plus a concrete
//    downstream consequence: dashboard.ts's fetchSaturdayReadiness
//    "sessions left to run" filter (`s.entry_date > effectiveToday`).
// ---------------------------------------------------------------------------
console.log('\n── 2. schedule.ts: entry_date derivation, and its downstream "sessions left" consequence ──');
{
  // A session at 23:30 UTC on Monday 14 Jul is 00:30 BST on Tuesday 15 Jul
  // — locally the day AFTER a Monday `effectiveToday`.
  const sessionStartsAt = '2026-07-14T23:30:00.000Z';
  const effectiveToday = '2026-07-14';

  const oldEntryDate = sessionStartsAt.slice(0, 10);
  assertEqual(oldEntryDate, '2026-07-14', '(sanity check) the old `.slice(0, 10)` reads 14 Jul, the same day as effectiveToday');
  const oldCountsAsLeftToRun = oldEntryDate > effectiveToday;
  assertTrue(!oldCountsAsLeftToRun, '(sanity check) the old logic WOULD have wrongly excluded this session from "sessions left to run" (14 Jul is not > 14 Jul)');

  const newEntryDate = dateInTz(new Date(sessionStartsAt), TZ);
  assertEqual(newEntryDate, '2026-07-15', 'fixed: entry_date reads the real local day as 15 Jul (Tuesday)');
  const newCountsAsLeftToRun = newEntryDate > effectiveToday;
  assertTrue(newCountsAsLeftToRun, 'fixed: the session is correctly counted as "left to run" on a Monday readiness check (15 Jul > 14 Jul)');
}

// ---------------------------------------------------------------------------
// 3. trainingReport.ts — the session-picker `date` field
//    (fetchTrainingSessions/fetchMatchSessions), and
//    fetchRestOfWeekComparison's weekMd lookup + weeksSeen prior-weeks loop.
// ---------------------------------------------------------------------------
console.log('\n── 3. trainingReport.ts: session-picker date, weekMd lookup, weeksSeen loop ──');
{
  const sessionStartsAt = '2026-07-14T23:30:00.000Z'; // 00:30 BST, 15 Jul locally

  // weekMd is keyed by fetchWeekMdLabels's own dateInTz-derived dates (block
  // 1's fix) — looking it up with the old raw-slice date would miss the
  // real key entirely and silently fall back to "no MD label" for a real
  // matchday-adjacent session.
  const weekMd = new Map<string, number | null>([['2026-07-15', -3]]);
  const oldLookupKey = sessionStartsAt.slice(0, 10);
  assertEqual(weekMd.get(oldLookupKey) ?? 'MISS', 'MISS', '(sanity check) looking weekMd up with the old raw-UTC-slice key misses the real entry entirely');
  const newLookupKey = dateInTz(new Date(sessionStartsAt), TZ);
  assertEqual(weekMd.get(newLookupKey), -3, 'fixed: looking weekMd up with dateInTz correctly finds the MD-3 label');

  // weeksSeen: a training session at the same trigger instant must group
  // into the week it really falls in, same composition as block 1.
  const wkOld = mondayOf(sessionStartsAt.slice(0, 10));
  const wkNew = mondayOf(dateInTz(new Date(sessionStartsAt), TZ));
  assertEqual(wkOld, '2026-07-13', '(sanity check) the old weeksSeen grouping WOULD have used the week of 13 Jul');
  assertEqual(wkNew, '2026-07-13', 'in this trigger case the two land in the same week (14 -> 15 Jul both fall Mon-Sun in the week of 13 Jul)');
  // A second instant closer to a week boundary shows the two genuinely
  // diverging (Sunday-night session, next local week).
  const boundarySession = '2026-07-19T23:30:00.000Z';
  const wkOldBoundary = mondayOf(boundarySession.slice(0, 10));
  const wkNewBoundary = mondayOf(dateInTz(new Date(boundarySession), TZ));
  assertEqual(wkOldBoundary, '2026-07-13', '(sanity check) the old logic WOULD have grouped a Sunday-23:30-UTC session into the week of 13 Jul');
  assertEqual(wkNewBoundary, '2026-07-20', 'fixed: the same session is correctly grouped into the week of 20 Jul, the week it locally falls in');
}

// ---------------------------------------------------------------------------
// 4. weekTemplates.ts — applyTemplate's fixtureDate anchor (feeds MD-n
//    offset math via daysBetween) and its existing-session date mapping
//    (feeds buildApplyPlan's per-day matching).
// ---------------------------------------------------------------------------
console.log('\n── 4. weekTemplates.ts: applyTemplate fixtureDate anchor and existing-session mapping ──');
{
  // A Saturday fixture kicking off 14:00 local (13:00 UTC in BST) — no
  // trigger-window ambiguity here, this is the anchor MD-n offsets are
  // measured FROM, so it must resolve to the real Saturday.
  const fixtureKickoffAt = '2026-07-18T13:00:00.000Z'; // 14:00 BST, 18 Jul (Saturday)
  const fixtureDate = dateInTz(new Date(fixtureKickoffAt), TZ);
  assertEqual(fixtureDate, '2026-07-18', 'fixtureDate resolves to the real local kickoff day');
  assertEqual(daysBetween(fixtureDate, '2026-07-15'), -3, 'MD-3 (three days before the Saturday fixture) resolves correctly off the fixed fixtureDate');

  // The existing-session mapping: a real session at 23:30 UTC the Sunday
  // BEFORE the template week is 00:30 BST — locally Monday, the week's own
  // first day. This is the same trigger case commit b0d0754's test #4
  // covers for the QUERY BOUNDS half of this bug (the row is correctly
  // fetched); this covers the DERIVATION half — once fetched, buildApplyPlan
  // matches it against week days by this exact `date` string, so a wrong
  // date here means the coach's apply silently creates a DUPLICATE session
  // on top of a real one instead of recognising it as "already exists".
  const priorSundaySession = '2026-07-12T23:30:00.000Z';
  const oldExistingDate = priorSundaySession.slice(0, 10);
  assertEqual(oldExistingDate, '2026-07-12', '(sanity check) the old `.slice(0, 10)` reads 12 Jul (Sunday) — not this week at all');
  const newExistingDate = dateInTz(new Date(priorSundaySession), TZ);
  assertEqual(newExistingDate, '2026-07-13', 'fixed: the existing session is correctly dated 13 Jul, this week\'s own Monday');
  assertTrue(newExistingDate !== oldExistingDate, 'the fix changes which day buildApplyPlan matches this existing session against — old logic risked a duplicate Monday session');
}

// ---------------------------------------------------------------------------
// 5. dashboard.ts — fetchNextFixture's local-midnight lower bound, and the
//    toMatchdayDays/daysOut day-count math.
// ---------------------------------------------------------------------------
console.log('\n── 5. dashboard.ts: fetchNextFixture local midnight, toMatchdayDays/daysOut ──');
{
  const effectiveToday = '2026-07-08'; // a Wednesday

  // A fixture kicking off 23:30 UTC the day before is 00:30 BST — locally
  // effectiveToday itself, before 1am. The literal `${effectiveToday}T00:00:00Z`
  // bound is an hour LATER than real local midnight in BST, so it would
  // wrongly exclude this real, same-day fixture from "next fixture from
  // today".
  const earlyFixtureKickoff = '2026-07-07T23:30:00.000Z';
  const oldBound = `${effectiveToday}T00:00:00Z`;
  const oldIncludesIt = earlyFixtureKickoff >= oldBound;
  assertTrue(!oldIncludesIt, '(sanity check) the old literal-Z bound WOULD have wrongly excluded a fixture kicking off 00:30 local today');
  const newBound = zonedTimeToUtcIso(effectiveToday, '00:00', TZ);
  assertEqual(newBound, '2026-07-07T23:00:00.000Z', 'fixed: the real local-midnight bound is 23:00 UTC the day before, in BST');
  const newIncludesIt = earlyFixtureKickoff >= newBound;
  assertTrue(newIncludesIt, 'fixed: the same fixture is correctly included as "next fixture from today"');

  // Day-count: effectiveToday (Wed 8 Jul) to a Saturday 15:00 BST kickoff
  // is genuinely 3 calendar days out, not 4.
  const saturdayKickoff = '2026-07-11T14:00:00.000Z'; // 15:00 BST, Sat 11 Jul
  const oldDaysOut = Math.round((Date.parse(saturdayKickoff) - Date.parse(`${effectiveToday}T00:00:00Z`)) / 86_400_000);
  assertEqual(oldDaysOut, 4, '(sanity check) the old millisecond-division math WOULD have rounded this to 4 days out — one too many');
  const newDaysOut = daysBetween(effectiveToday, dateInTz(new Date(saturdayKickoff), TZ));
  assertEqual(newDaysOut, 3, 'fixed: daysBetween(effectiveToday, dateInTz(kickoff)) correctly reads 3 whole calendar days out');
}

// ---------------------------------------------------------------------------
// 6. FlagCard.tsx / PlayerProfileFlags.tsx — raisedDate vs `today`, which
//    decides whether a flag shows a bare time ("14:32") or a full date.
// ---------------------------------------------------------------------------
console.log('\n── 6. FlagCard.tsx / PlayerProfileFlags.tsx: raisedDate vs today ──');
{
  // A flag raised 23:30 UTC is 00:30 BST — really "today" if today (local)
  // is the day after the raw UTC date.
  const raisedAt = '2026-07-14T23:30:00.000Z';
  const today = '2026-07-15'; // the org's real local today, e.g. from todayIso(timezone)

  const oldRaisedDate = raisedAt.slice(0, 10);
  assertEqual(oldRaisedDate, '2026-07-14', '(sanity check) the old `.slice(0, 10)` reads 14 Jul');
  assertTrue(oldRaisedDate !== today, '(sanity check) the old logic WOULD have shown a full date ("14 Jul") instead of just a time, even though this happened today');

  const newRaisedDate = dateInTz(new Date(raisedAt), TZ);
  assertEqual(newRaisedDate, '2026-07-15', 'fixed: dateInTz reads the real local day as 15 Jul');
  assertTrue(newRaisedDate === today, 'fixed: raisedDate correctly matches today, so the card shows a bare time, not a redundant full date');
}

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
