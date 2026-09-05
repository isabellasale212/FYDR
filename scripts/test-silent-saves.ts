/* G-34. The six screens that let somebody save a change that never happened.
 *
 * Written before the fix and expected to fail until it lands.
 *
 * WHAT MAKES THIS CLASS POSSIBLE, restated because the test shape follows from
 * it. Postgres raises 42501 when an INSERT violates a WITH CHECK. It does NOT
 * raise when an UPDATE or DELETE fails a USING clause: the row is not matched,
 * the statement succeeds, and zero rows change. supabase-js .update() returns
 * { error: null } with no row count unless asked. So an app that only checks
 * `error` cannot tell "saved" from "silently refused".
 *
 * Two independent assertions per screen, because either alone leaves the bug
 * reachable:
 *
 *   1. The CONTROL is offered only to roles that may actually write. This is
 *      the user-visible fix.
 *   2. The WRITE checks how many rows it changed. This is the one that matters
 *      in a year: role sets move, and the next mismatch should raise instead of
 *      lying. A UI condition that happens to be right today is not a guarantee.
 *
 * SOURCE-LEVEL, same limit test-role-model.ts states about itself. It proves
 * the control names the right set and the write inspects its result; it does
 * not prove RLS agrees. supabase/tests is where that is settled.
 */
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}

/** The write functions behind the six, and the set each screen must gate on. */
const SCREENS: { name: string; page: string; set: string; writes: [string, string[]][] }[] = [
  /* The reachable nutrition write is assignPlan, not expireTarget. The audit
     first named expireTarget and NutritionTargetsList, which is DEAD CODE: no
     page imports that component, so nothing there is reachable. /nutrition
     renders NutritionWorkspace, whose Assign takes an UPDATE branch when a
     target already exists for today (nutritionRules.ts:281) and returns success
     without ever attempting an insert. That branch is the silent one. On any
     other day it inserts, which raises 42501 and is loud. */
  { name: '/nutrition assign a plan', page: 'src/app/(staff)/nutrition/page.tsx', set: 'NUTRITION_EDIT',
    writes: [['src/lib/queries/nutritionRules.ts', ['assignPlan']]] },
  { name: '/injuries/team-allocation', page: 'src/app/(staff)/injuries/team-allocation/page.tsx', set: 'SESSION_EDIT',
    /* setTeamAllocation is deliberately absent. Its update is followed by an
       INSERT, and an INSERT that violates a WITH CHECK RAISES 42501, so the
       whole call already fails loudly for a role that cannot write. A row-count
       check on its withdraw step would also misfire legitimately: zero rows
       there means "this athlete had no previous allocation", which is the
       common case. Only writes that can end in silence are asserted. */
    writes: [['src/lib/queries/teamAllocation.ts', ['publishWeek', 'withdrawAllocation']]] },
  { name: '/settings/thresholds', page: 'src/app/(staff)/settings/thresholds/page.tsx', set: 'THRESHOLD_EDIT',
    writes: [['src/lib/queries/thresholds.ts', ['setThresholdActive', 'archiveThreshold']]] },
  { name: '/schedule session actions', page: 'src/app/(staff)/schedule/[sessionId]/page.tsx', set: 'SESSION_EDIT',
    writes: [['src/lib/queries/schedule.ts', ['cancelSession', 'reinstateSession']]] },
  { name: '/schedule/planner template', page: 'src/app/(staff)/schedule/planner/[templateId]/page.tsx', set: 'SESSION_EDIT',
    writes: [['src/lib/queries/weekTemplates.ts', ['archiveTemplate', 'restoreTemplate']]] },
  { name: '/leaderboards board actions', page: 'src/app/(staff)/leaderboards/[leaderboardId]/page.tsx', set: 'LEADERBOARD_EDIT',
    writes: [['src/lib/queries/leaderboards.ts', ['setBoardVisibility', 'deleteBoard']]] },
];

console.log('\n-- the control is offered only to roles that can write --');
for (const s of SCREENS) {
  let src = '';
  try { src = readFileSync(s.page, 'utf8'); } catch { /* reported below */ }
  assert(src.length > 0 && src.includes(s.set), `${s.name} gates its control on ${s.set}`);
}

console.log('\n-- and the write reports a refusal instead of a silent no-op --');

/** A write "checks" when it asks the database what it changed. `.select()` on
 *  an update returns the affected rows, so an empty array is a refusal that a
 *  caller can act on. `{ count: 'exact' }` does the same job. Asserted per
 *  function body rather than per file, because one checked write in a file says
 *  nothing about its neighbours. */
function body(file: string, fn: string): string {
  const src = readFileSync(file, 'utf8');
  const i = src.indexOf(`export async function ${fn}`);
  if (i < 0) return '';
  const rest = src.slice(i + 1);
  const next = rest.search(/\nexport (async )?function /);
  return next < 0 ? rest : rest.slice(0, next);
}

for (const s of SCREENS) {
  for (const [file, fns] of s.writes) {
    for (const fn of fns) {
      const b = body(file, fn);
      const checks = /\.select\(|count:\s*'exact'/.test(b);
      assert(b.length > 0 && checks, `${fn}() checks how many rows it changed`);
    }
  }
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
