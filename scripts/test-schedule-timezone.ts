/* Regression test for the integration-audit Batch 2 finding: schedule.ts's
 * dayBounds()/rangeBounds() used to build session-query date bounds as
 * literal UTC-day boundaries (`${date}T00:00:00Z`..`${date}T23:59:59.999Z`),
 * which is only correct for UTC+0 with no DST. Europe/London is UTC+1 (BST)
 * for roughly half the year, so any session starting 23:00-00:00 UTC
 * (00:00-01:00 local) was attributed to the wrong calendar day everywhere
 * fetchDaySessions / fetchAthleteDaySessions / fetchAthleteRecentSessions /
 * fetchWeekMdLabels / fetchWeekSessions / fetchWeekSessionsDetailed /
 * fetchNormalWeek / fetchWeekFixtures ran — both coach and athlete surfaces,
 * identically, since all of them called the same broken primitive.
 *
 * No test runner (vitest/jest) exists anywhere in this repo — the only
 * testing convention here is the pgTAP suite under supabase/tests, which is
 * SQL/RLS-shaped and has no way to exercise plain TS date-arithmetic logic.
 * This follows scripts/seed-auth.ts's own precedent instead: a plain
 * top-level-await TS script run with `node --experimental-strip-types`, no
 * new dependency. It needs one extra thing seed-auth.ts didn't: schedule.ts
 * is written against the `@/*` tsconfig path alias and extensionless
 * relative imports, which `tsc`/Next.js resolve for free but the bare Node
 * loader does not — scripts/lib/ts-alias-hooks.mjs is a minimal runtime
 * mirror of exactly that one mapping, for this script only.
 *
 * Run:
 *   npm run test:schedule-timezone
 * or directly:
 *   node --experimental-strip-types --import ./scripts/lib/register-ts-aliases.mjs scripts/test-schedule-timezone.ts
 */

import { dayBounds, rangeBounds } from '../src/lib/queries/schedule';

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

console.log('\n── dayBounds/rangeBounds, Europe/London BST (UTC+1) ──');

// 15 Jul 2026 is inside British Summer Time (BST, UTC+1). Local midnight
// 2026-07-15 00:00 is 2026-07-14 23:00 UTC, and the window's upper edge is
// 2026-07-16 00:00 local minus 1ms, i.e. 2026-07-15 22:59:59.999 UTC — not
// the literal UTC-day bounds the old code produced.
{
  const bounds = dayBounds('2026-07-15', 'Europe/London');
  assertEqual(bounds.from, '2026-07-14T23:00:00.000Z', "BST day's lower bound is the previous UTC day at 23:00, not 00:00");
  assertEqual(bounds.to, '2026-07-15T22:59:59.999Z', "BST day's upper bound is 22:59:59.999 UTC, not 23:59:59.999");
}

console.log('\n── The audit\'s exact trigger case: a 23:30 UTC session ──');

// A session starting at 2026-07-14T23:30:00Z is 2026-07-15 00:30 local
// (BST, UTC+1) — the audit's named 23:00-00:00 UTC / 00:00-01:00 local
// window. Its correct LOCAL calendar day is 15 Jul, not 14 Jul.
{
  const lateSession = '2026-07-14T23:30:00.000Z';
  const correctLocalDay = '2026-07-15';
  const wrongUtcDay = '2026-07-14';

  const correctBounds = dayBounds(correctLocalDay, 'Europe/London');
  const inCorrectDay = lateSession >= correctBounds.from && lateSession <= correctBounds.to;
  assertTrue(inCorrectDay, '23:30 UTC session falls inside its correct LOCAL calendar day\'s bounds (15 Jul)');

  const wrongBounds = dayBounds(wrongUtcDay, 'Europe/London');
  const inWrongDay = lateSession >= wrongBounds.from && lateSession <= wrongBounds.to;
  assertTrue(!inWrongDay, '23:30 UTC session is correctly EXCLUDED from the previous day\'s bounds (14 Jul) — this is the case the old literal-UTC dayBounds() got wrong');

  // Demonstrate the bug this replaces: the OLD formula (kept inline, not
  // imported — it no longer exists in schedule.ts) would have put this
  // session on 14 Jul instead of the correct 15 Jul.
  const oldBuggyBoundsFor14Jul = { from: `${wrongUtcDay}T00:00:00Z`, to: `${wrongUtcDay}T23:59:59.999Z` };
  const oldBugIncludedItOnWrongDay = lateSession >= oldBuggyBoundsFor14Jul.from && lateSession <= oldBuggyBoundsFor14Jul.to;
  assertTrue(oldBugIncludedItOnWrongDay, '(sanity check on the bug itself) the old literal-UTC bounds WOULD have mis-attributed this session to 14 Jul — confirms the fix changed real behaviour, not just internals');
}

console.log('\n── GMT (UTC+0) day: no regression when the offset is zero ──');

// 15 Jan 2026 is outside BST — Europe/London is plain UTC (GMT). The new
// timezone-aware bounds must agree with the old literal-UTC ones here,
// since there is no offset to correct for.
{
  const bounds = dayBounds('2026-01-15', 'Europe/London');
  assertEqual(bounds.from, '2026-01-15T00:00:00.000Z', 'GMT day lower bound unchanged from the literal-UTC form');
  assertEqual(bounds.to, '2026-01-15T23:59:59.999Z', 'GMT day upper bound unchanged from the literal-UTC form');
}

console.log('\n── A real (non-Europe/London) IANA zone: proves timezone is a genuine parameter ──');

// America/New_York is EDT (UTC-4) in July 2026. If dayBounds() ever
// regressed back to a hardcoded Europe/London default, this would be the
// assertion that catches it.
{
  const bounds = dayBounds('2026-07-15', 'America/New_York');
  assertEqual(bounds.from, '2026-07-15T04:00:00.000Z', 'EDT (UTC-4) day lower bound is local midnight, i.e. 04:00 UTC');
  assertEqual(bounds.to, '2026-07-16T03:59:59.999Z', 'EDT (UTC-4) day upper bound is the next local midnight minus 1ms, i.e. 03:59:59.999 UTC the following day');
}

console.log('\n── rangeBounds: the week-window case (fetchWeekSessions et al) ──');

// A Monday-to-Sunday week starting 13 Jul 2026 (BST), used the same way
// fetchWeekSessions/fetchWeekSessionsDetailed/fetchWeekFixtures/fetchNormalWeek
// call it: rangeBounds(weekStart, weekStart + 6 days, timezone).
{
  const bounds = rangeBounds('2026-07-13', '2026-07-19', 'Europe/London');
  assertEqual(bounds.from, '2026-07-12T23:00:00.000Z', 'week lower bound is Monday 00:00 local (BST), i.e. Sunday 23:00 UTC');
  assertEqual(bounds.to, '2026-07-19T22:59:59.999Z', 'week upper bound is the following Monday 00:00 local minus 1ms');

  // A Sunday-night session just before the week rolls over, the same
  // trigger window as the single-day case above, must still land inside
  // this week's bounds rather than spilling into the next UTC calendar day.
  const sundayLateSession = '2026-07-19T22:45:00.000Z'; // 23:45 BST, still Sunday 19 Jul locally
  const inWeek = sundayLateSession >= bounds.from && sundayLateSession <= bounds.to;
  assertTrue(inWeek, 'a Sunday 23:45 BST session (22:45 UTC) is still inside the week it locally belongs to');
}

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
