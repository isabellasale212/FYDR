/* §0al, second half — the schedule is audited. Decided by Isabella 2026-09-11,
 * built 2026-09-12 with migration 0104.
 *
 * The behaviour is pinned by supabase/tests/600_session_audit_test.sql, which
 * runs every event against the real schema on scratch (create, update with
 * from/to, no row for an updated_at-only touch, soft delete, participant add
 * and remove, a cascaded hard delete, the truncate guard). That suite needs a
 * database; this file pins from source that the migration exists, has the
 * 0097/0099 shape, and that the data-model document names the events.
 */
import { readFileSync, existsSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('migration 0104');
{
  const mig = 'supabase/migrations/0104_audit_sessions.sql';
  assert(existsSync(mig), 'exists');
  const sql = read(mig).replace(/--.*$/gm, '');
  assert(/create trigger sessions_audit\s+after insert or update or delete on public\.sessions\s+for each row execute function public\.audit_session_change\(\)/.test(sql), 'sessions: one AFTER row trigger for insert, update and delete');
  assert(/create trigger session_participants_audit\s+after insert or delete on public\.session_participants\s+for each row execute function public\.audit_session_participant_change\(\)/.test(sql), 'session_participants: AFTER insert and delete');
  assert(/create trigger sessions_no_truncate\s+before truncate/.test(sql) && /create trigger session_participants_no_truncate\s+before truncate/.test(sql), 'both refuse TRUNCATE, as 0099\'s tables do');
  assert((sql.match(/security definer/g) ?? []).length === 2, 'the two audit functions run as definer (audit_log\'s own policy would refuse the row)');
  assert(/public\.auth_user_id\(\)/.test(sql) && /public\.audit_acting_role\(\)/.test(sql) && /public\.audit_client_ip\(\)/.test(sql), 'actor, role and address come from the same helpers as 0097/0099');
  for (const action of ["'sessions.create'", "'sessions.update'", "'sessions.delete'", "'session_participants.add'", "'session_participants.remove'"]) {
    assert(sql.includes(action), `names ${action}`);
  }
  assert(/if v_changed = '\{\}'::jsonb then\s+return new;/.test(sql), 'an update that changed nothing audited writes no row');
  assert(/'soft', true/.test(sql) && /'soft', false/.test(sql), 'soft and hard deletes share the event name and differ by a flag');
  assert(/v_cascade := not exists \(/.test(sql), 'a cascaded participant removal is detected by the parent being gone (0097\'s test, not pg_trigger_depth)');
  assert(/'notes_present'/.test(sql) && /'notes_length'/.test(sql) && !/'notes',\s+p_row -> 'notes'/.test(sql), 'notes as presence and length only; title and location in full');
  assert(/revoke execute on function public\.audit_session_change\(\) from public, anon, authenticated/.test(sql), 'the trigger functions are not callable directly');
}

console.log('\nthe test and the document');
{
  const test = read('supabase/tests/600_session_audit_test.sql');
  assert(/sessions\.create/.test(test) && /via_cascade/.test(test) && /updated_at-only touch wrote nothing/.test(test), '600_session_audit_test.sql covers the events and the no-op case');
  const dm = read('docs/04-data-model.md');
  assert(/0104_audit_sessions\.sql/.test(dm) && /`sessions\.create`/.test(dm) && /`session_participants\.remove`/.test(dm), '04-data-model.md §13 lists the schedule events among the mandatory audit events');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
