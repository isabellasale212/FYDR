/* Correcting a weigh-in — the edit window, the delete, and the two-week
 * default on the edit list.
 *
 * TWO REVERSALS, recorded so nobody re-argues either from an old comment.
 * bodyComposition.ts once said a logged weigh-in was permanent. Isabella
 * reversed that on 2026-09-07 (migration 0084: a same-day HARD delete, keyed
 * on created_at in the org's zone, refused silently by a USING clause). On
 * 2026-09-15 (docs/decisions/body-mass-rule.md §2–§3, migration 0131) the
 * rule became what this file now pins:
 *   - one weigh-in per athlete per day, at the table;
 *   - EDIT on the day it was TAKEN (measured_on) and not after — the table
 *     RAISES, so the refusal is loud and the screen shows older rows
 *     read-only rather than a Save that would be refused;
 *   - DELETE through delete_weigh_in(): a SOFT delete (deleted_at,
 *     deleted_by — CLAUDE.md rule 4, athlete data is never hard-deleted;
 *     0084's grant is revoked), audited by name; the sport scientist at any
 *     time, the medic, S&C and nutritionist on the day they logged it
 *     (0084's created_at window, kept for them); the function raises on a
 *     refusal, so there is no silent no-op left to guard against.
 * The UI still hides the control where it would be refused — both halves,
 * the same rule this project has applied since G-34/G-36.
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

const mig = read('supabase/migrations/0131_body_mass_rules.sql');
const migSql = mig.replace(/^--.*$/gm, '');
const q = read('src/lib/queries/bodyComposition.ts');
const qCode = strip(q);
const panel = read('src/components/BodyWeightPanel/BodyWeightPanel.tsx');
const pCode = strip(panel);

console.log('the database: one per day, a loud edit window, a soft audited delete');
assert(/create unique index body_composition_one_per_day[\s\S]*?\(athlete_id, measured_on\)[\s\S]*?where deleted_at is null/.test(migSql), '0131: one live weigh-in per athlete per day, at the table');
assert(/raise exception 'weigh_in_edit_window_closed'/.test(migSql) && /old\.measured_on <> \(now\(\) at time zone coalesce\(v_tz, 'UTC'\)\)::date/.test(migSql), 'the edit window is the day it was TAKEN, in the org\'s zone, and it raises');
assert(/create or replace function public\.delete_weigh_in\(p_id uuid\)/.test(migSql) && /security definer/.test(migSql.slice(migSql.indexOf('delete_weigh_in(p_id uuid)'), migSql.indexOf('delete_weigh_in(p_id uuid)') + 400)), 'delete_weigh_in() exists, security definer');
assert(/set deleted_at = now\(\), deleted_by = public\.auth_user_id\(\)/.test(migSql), 'and it is a SOFT delete');
assert(/'body_composition\.delete'/.test(migSql) && /write_audit_event\(/.test(migSql), 'audited by name');
assert(/revoke delete on public\.body_composition from authenticated/.test(migSql) && /drop policy if exists body_composition_same_day_delete/.test(migSql), '0084\'s hard delete is gone: grant revoked, policy dropped');
assert(/\(v_row\.created_at at time zone v_tz\)::date = v_today/.test(migSql), 'the same-day window for the other roles is keyed on created_at — when it was LOGGED');
assert(/auth_has_any_role\(array\['sport_scientist'\]::app_role\[\]\)/.test(migSql), 'the sport scientist is the any-time role');
for (const role of ['medic', 'strength_conditioning', 'nutritionist']) {
  assert(migSql.includes(role), `${role} may delete what they logged today`);
}
assert(!/'coach'/.test(migSql.slice(migSql.indexOf('delete_weigh_in(p_id uuid)'), migSql.indexOf('grant execute on function public.delete_weigh_in'))), 'the coach cannot — they cannot log a weigh-in either');
assert(/raise exception 'weigh_in_delete_not_permitted'/.test(migSql), 'a refusal raises — no silent no-op');

console.log('\nthe query layer goes through the function and says what it says');
{
  const fn = qCode.slice(qCode.indexOf('export async function deleteWeighIn'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert(body.length > 0, 'deleteWeighIn exists');
  assert(/rpc\('delete_weigh_in', \{ p_id: id \}\)/.test(body), 'it calls delete_weigh_in()');
  assert(/weigh_in_delete_not_permitted/.test(body) && /weigh_in_not_found/.test(body), 'and turns both refusals into sentences');
  assert(!/\.delete\(\)/.test(qCode), 'nothing in the query layer issues a DELETE on the table any more');
  const upd = qCode.slice(qCode.indexOf('export async function updateWeighIn'));
  assert(/weigh_in_edit_window_closed/.test(upd.slice(0, upd.indexOf('\n}'))), 'updateWeighIn turns the closed window into its sentence');
  assert(/body_composition_one_per_day|23505/.test(qCode.slice(qCode.indexOf('export async function logWeighIn'))), 'logWeighIn says one-per-day in words');
  assert(/\.is\('deleted_at', null\)/.test(qCode), 'reads filter deleted rows explicitly');
}
assert(
  /created_at/.test(qCode) && /select\('id, created_at, measured_on/.test(qCode),
  'entries carry created_at, so the screen can tell which are still removable',
);

console.log('\nthe controls are offered only where they will work');
assert(/loggedToday/.test(pCode), 'the row computes whether it was logged today');
assert(/const editable = entry\.measured_on === todayIso\(timezone\);/.test(pCode), 'and whether it was TAKEN today — the edit window');
assert(/const deletable = canDeleteAnyTime \|\| loggedToday;/.test(pCode), 'delete: the sport scientist any time, the others only what they logged today');
assert(/if \(!editable\) \{[\s\S]*?data-weigh-in-read-only/.test(pCode), 'an older row renders read-only, with no Save');
assert((pCode.match(/deletable \?/g) ?? []).length === 2, 'the Delete control renders only where it will land, on both row shapes');
assert(
  /dateInTz\(|timezone/.test(pCode.slice(pCode.indexOf('loggedToday') - 300, pCode.indexOf('loggedToday') + 300)),
  "using the org's timezone, matching the function",
);
assert(/deleteWeighIn/.test(pCode), 'it calls the delete');
assert(/canDeleteAnyTime=\{hasAnyRole\(claims\.roles, WEIGH_IN_DELETE_ANY_TIME\)\}/.test(strip(read('src/app/(staff)/squad/[athleteId]/page.tsx'))), 'the page resolves the any-time role from the session');

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
