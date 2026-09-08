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
const WIDEN = 'supabase/migrations/0086_audit_widen.sql';
const CONFIG = 'supabase/migrations/0088_audit_widen_config.sql';
const ACCESS = 'src/lib/access.ts';
const sql = read(MIGRATION);
const widen = read(WIDEN);
const config = read(CONFIG);

/** Every table the trigger is attached to, across both migrations. */
const AUDITED = [
  ['injuries', MIGRATION], ['injury_clinical', MIGRATION], ['availability', MIGRATION],
  ['athletes', WIDEN], ['athlete_consents', WIDEN], ['body_composition', WIDEN],
  ['test_results', WIDEN], ['programme_assignments', WIDEN], ['team_allocations', WIDEN],
  ['user_roles', WIDEN],
  /* Batch three, 0088: configuration and authoring. No shape change was needed
     and that was checked rather than assumed — all five carry id and org_id, and
     leaderboard_opt_outs carries athlete_id, which the generic function already
     handles. */
  ['thresholds', CONFIG], ['leaderboards', CONFIG], ['leaderboard_opt_outs', CONFIG],
  ['week_templates', CONFIG], ['fixtures', CONFIG],
] as const;

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

console.log('\nthe trigger is attached to every audited table, for all three operations');
{
  for (const [t, file] of AUDITED) {
    const body = read(file);
    const m = new RegExp(`create trigger ${t}_audit\\s+after insert or update or delete on public\\.${t}`).exec(body);
    assert(m !== null, `${t} has an after-insert/update/delete trigger`);
  }
  const perRow = [sql, widen, config]
    .map((f) => (f.match(/for each row execute function public\.audit_row_change\(\)/g) ?? []).length)
    .reduce((a, b) => a + b, 0);
  assert(perRow === AUDITED.length, `all ${AUDITED.length} run per row (saw ${perRow}) — a multi-row update must not collapse into one entry`);
  assert(
    !/before insert or update/i.test(sql + widen + config),
    'and they are AFTER, so a write refused by RLS or a constraint never leaves a row claiming it happened',
  );
}

console.log('\naudit_log is never audited by itself');
{
  /* It is in the unaudited list and must stay there: a trigger on audit_log
     would audit its own writes. Obvious once said, and exactly the kind of thing
     a mechanical sweep of "every remaining table" would pick up. */
  const all = sql + widen + config;
  assert(
    !/create trigger audit_log_audit|on public\.audit_log\s+for each row/i.test(all),
    'no trigger attaches audit_row_change to audit_log',
  );
  assert(
    !AUDITED.some(([t]) => t === 'audit_log'),
    'and it is not in the audited list',
  );
}

console.log('\nthe two row shapes the widening had to learn');
{
  assert(
    /tg_table_name = 'athletes'[\s\S]{0,120}v_row ->> 'id'/.test(widen),
    "athletes: the row IS the athlete, so athlete_id comes from its own id rather than a column it does not have",
  );
  assert(
    /unnest\(array\['user_id', 'role'\]\)/.test(widen),
    'user_roles: an identity allowlist, because audit_log has no column for the user a grant concerns',
  );
  assert(
    !/jsonb_object_agg\(k, v_row -> k\)[\s\S]{0,200}(diagnosis|clinical_notes|treatment_plan|value|body_mass)/.test(widen),
    'and the allowlist is exactly two identity keys — no content column may be added to it without the same argument',
  );
  /* 0086 replaces the function 0085 created, so the clinical rules have to
     survive the rewrite rather than being assumed to. */
  assert(
    /jsonb_build_object\('changed', to_jsonb\(v_changed\)\)/.test(widen),
    'the changed-fields rule survived the function being replaced',
  );
  assert(
    /if v_changed = '\{\}'::text\[\] then return/.test(widen),
    'and so did the no-op-update rule',
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
