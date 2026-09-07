/* Deleting a weigh-in, and the two-week default on the edit list.
 *
 * A REVERSAL, recorded so nobody re-argues it from the old comment.
 * bodyComposition.ts used to state that a logged weigh-in is permanent —
 * "there is no delete path here and none should be built" — on the grounds that
 * body_composition has no DELETE grant, no deleted_at, and the profile spec says
 * "Edit entries" rather than "Delete entries". Isabella reversed that on
 * 2026-09-07 with a narrower rule than the one that was refused: a weigh-in can
 * be removed only on the day it was LOGGED. History older than that stays
 * permanent, which is the property the original decision was protecting.
 *
 * SAME DAY MEANS created_at, NOT measured_on, and in the ORG'S timezone.
 * created_at, because this is a mistake-correction window — "I typed that wrong
 * a minute ago" — and keying on measured_on would let somebody delete a
 * backdated entry they created weeks earlier, which is the history deletion the
 * original decision forbade. The org's timezone, because at 00:30 BST a UTC date
 * cast still reads yesterday, and the club would see a delete button vanish half
 * an hour before midnight.
 *
 * A DELETE REFUSED BY A USING CLAUSE RAISES NOTHING. It matches no row and
 * reports success, so the query layer goes through mustAffect and the UI hides
 * the control rather than relying on the write to complain. Both halves, the
 * same rule this project has applied since G-34/G-36.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');
const read = (p: string) => readFileSync(p, 'utf8');

const mig = read('supabase/migrations/0084_body_composition_same_day_delete.sql');
/* The header explains at length why measured_on is NOT the gate, so the negative
   assertion below has to look at the SQL rather than the prose about it. */
const migSql = mig.replace(/^--.*$/gm, '');
const q = read('src/lib/queries/bodyComposition.ts');
const qCode = strip(q);
const panel = read('src/components/BodyWeightPanel/BodyWeightPanel.tsx');
const pCode = strip(panel);

console.log('the database allows a delete only on the day it was logged');
assert(/for delete/i.test(mig), '0084 creates a DELETE policy');
assert(/grant delete on public\.body_composition to authenticated/i.test(mig), 'and the grant it needs');
assert(
  /created_at at time zone auth_org_timezone\(\)/.test(mig),
  'the window is keyed on created_at — when it was LOGGED, not the date measured',
);
assert(
  /now\(\) at time zone auth_org_timezone\(\)/.test(mig),
  "and compared against the org's own today, not the server's UTC clock",
);
assert(!/measured_on/.test(migSql), 'measured_on is not what gates it');
for (const role of ['sport_scientist', 'medic', 'strength_conditioning', 'nutritionist']) {
  assert(mig.includes(role), `${role} may delete, the same four who may log and edit`);
}
assert(!/'coach'/.test(mig), 'the coach cannot — they cannot log a weigh-in either');

console.log('\nthe query layer reports a refusal rather than a silent success');
{
  const fn = qCode.slice(qCode.indexOf('export async function deleteWeighIn'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert(body.length > 0, 'deleteWeighIn exists');
  assert(/mustAffect\(/.test(body), 'it goes through mustAffect');
  assert(/\.select\(/.test(body), 'with a select, so PostgREST returns the affected rows');
  assert(
    /refusal:/.test(body),
    'and a stated refusal — a DELETE that matches no row raises nothing and would otherwise read as done',
  );
}
assert(
  /created_at/.test(qCode) && /select\('id, created_at, measured_on/.test(qCode),
  'entries carry created_at, so the screen can tell which are still removable',
);

console.log('\nthe control is offered only where it will work');
assert(/loggedToday/.test(pCode), 'the row computes whether it was logged today');
assert(
  /loggedToday \?/.test(pCode) || /loggedToday &&/.test(pCode),
  'and the Delete control renders only then',
);
assert(
  /dateInTz\(|timezone/.test(pCode.slice(pCode.indexOf('loggedToday') - 300, pCode.indexOf('loggedToday') + 300)),
  "using the org's timezone, matching the policy",
);
assert(/deleteWeighIn/.test(pCode), 'it calls the delete');

console.log('\nthe edit list opens on the last two weeks');
assert(/RECENT_DAYS = 14/.test(pCode), 'the window is 14 days, named rather than inline');
assert(
  /measured_on >=|>= cutoff|cutoff/.test(pCode),
  'entries are filtered by the date measured, which is what the row shows',
);
assert(/showAll/.test(pCode), 'there is an expanded state');
assert(/View all/.test(panel), 'and a View all control');
{
  /* The control must say what it will reveal, and must not appear when it would
     reveal nothing. */
  assert(
    /entries\.length > .*\.length|hiddenCount|older/.test(pCode),
    'it only shows when there are older entries to show',
  );
}
assert(
  !/\.slice\(0, 14\)/.test(pCode),
  'the window is a date range, not the newest fourteen ROWS — a fortnightly club would see six months',
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
