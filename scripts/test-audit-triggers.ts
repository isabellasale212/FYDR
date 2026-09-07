/* The audit trigger's role precedence, and the TypeScript it has to agree with.
 *
 * WHY THIS FILE IS SEPARATE FROM THE pgTAP ONE. 430_audit_triggers_test.sql
 * proves the trigger fires, attributes correctly and never copies a clinical
 * value — everything that needs a live database. This proves the one thing SQL
 * cannot check about itself: that audit_acting_role()'s ordering is the same
 * ordering lib/access.ts uses when the APPLICATION writes an audit row.
 *
 * They are two lists in two languages because a trigger cannot call into the
 * app, and audit_log.actor_role takes a single value while roles are additive —
 * so somebody who is a coach and a medic is recorded under one of them, and the
 * two writers must not disagree about which. If they drifted, the same person
 * doing the same thing would be a medic when the trigger logged it and a coach
 * when a route did, in the one table whose job is being true.
 */
import { readFileSync } from 'node:fs';
import { actingRole } from '@/lib/access';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const read = (p: string): string => readFileSync(p, 'utf8');

const MIGRATION = 'supabase/migrations/0085_audit_clinical_writes.sql';
const ACCESS = 'src/lib/access.ts';
const sql = read(MIGRATION);

console.log('the two role orderings are the same ordering');
{
  const sqlList = (/unnest\(array\[\s*([^\]]+)\]::public\.app_role\[\]/.exec(sql) ?? [])[1] ?? '';
  const sqlRoles = [...sqlList.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  const tsBlock = (/const AUDIT_PRECEDENCE = \[([^\]]+)\]/.exec(read(ACCESS)) ?? [])[1] ?? '';
  const tsRoles = [...tsBlock.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

  assert(sqlRoles.length === 5, `the trigger names five roles (saw ${sqlRoles.length})`);
  assert(tsRoles.length === 5, `and so does AUDIT_PRECEDENCE (saw ${tsRoles.length})`);
  assert(
    sqlRoles.join(',') === tsRoles.join(','),
    `in the same order — SQL [${sqlRoles.join(', ')}] vs TS [${tsRoles.join(', ')}]`,
  );
  assert(sqlRoles[0] === 'medic', 'medic first: a clinical write that medical access could authorise is recorded as medical');
  assert(
    actingRole(['coach', 'medic']) === 'medic',
    'and the TypeScript agrees at runtime, not just in its source',
  );
  assert(actingRole(['strength_conditioning', 'coach']) === 'coach', 'coach outranks strength_conditioning, which the pgTAP file asserts through user_dual');
}

console.log('\nthe trigger is attached to the three tables, for all three operations');
{
  for (const t of ['injuries', 'injury_clinical', 'availability']) {
    const m = new RegExp(`create trigger ${t}_audit\\s+after insert or update or delete on public\\.${t}`).exec(sql);
    assert(m !== null, `${t} has an after-insert/update/delete trigger`);
  }
  assert(
    (sql.match(/for each row execute function public\.audit_row_change\(\)/g) ?? []).length === 3,
    'all three run per row — a multi-row update must not collapse into one entry',
  );
  assert(
    !/before insert or update/i.test(sql),
    'and they are AFTER, so a write refused by RLS or a constraint never leaves a row claiming it happened',
  );
}

console.log('\nthe address is read the same way the application reads it');
{
  assert(/request\.headers/.test(sql), "the caller's address comes from PostgREST's request.headers");
  assert(
    /split_part\(v_xff, ',', array_length\(string_to_array\(v_xff, ','\), 1\)\)/.test(sql),
    'taking the LAST hop, matching lib/clientAddress.ts — the first entry is whatever the caller claimed',
  );
  assert(/x-real-ip/.test(sql), 'preferring the platform header, as the TypeScript does');
  assert(
    (sql.match(/exception when others then\s+return null/g) ?? []).length >= 2,
    'and every failure path returns null: an audit trigger that can throw is one that can block a clinical write',
  );
}

console.log('\nclinical values never reach a table the sport scientist can read');
{
  assert(
    /jsonb_build_object\('changed', to_jsonb\(v_changed\)\)/.test(sql),
    'metadata carries the changed FIELD NAMES',
  );
  assert(
    !/to_jsonb\(new\)\s*\)?\s*(?:as metadata|,\s*public\.audit_client_ip)/.test(sql),
    'and never the row itself — audit_log is sport-scientist readable, medical detail is separately gated',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
