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
import { existsSync, readFileSync } from 'node:fs';
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
const AUTHORING = 'supabase/migrations/0089_audit_widen_authoring.sql';
const RECORDS = 'supabase/migrations/0091_audit_widen_records_of_record.sql';
const GYM = 'supabase/migrations/0096_audit_gym_corrections.sql';
const GYMDEL = 'supabase/migrations/0097_audit_gym_deletes.sql';
const NOTRUNC = 'supabase/migrations/0098_gym_logs_no_truncate.sql';
const ENTRIES = 'supabase/migrations/0099_audit_athlete_entries.sql';
const ACCESS = 'src/lib/access.ts';
const sql = read(MIGRATION);
const widen = read(WIDEN);
const config = read(CONFIG);
const authoring = read(AUTHORING);
const records = read(RECORDS);
const gym = read(GYM);
const gymDelRaw = read(GYMDEL);
const noTruncRaw = read(NOTRUNC);
const noTrunc = noTruncRaw.replace(/^--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
/* Comments stripped before ANY match, five times over now: a prose comment
   quoting the very thing an assertion greps for has produced a false pass in
   check-contrast, check-scale-tokens, this file, test-mutation-retry and a
   keyframe count. This migration's header quotes `via_cascade` and
   `ON DELETE NO ACTION` in exactly that way. */
const entries = read(ENTRIES).replace(/^--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');
const resetScratch = read('scripts/reset-scratch.mjs');
/* COMMENTS OFF FOR THE CODE ASSERTIONS. 0097's header explains that
   pg_trigger_depth() was tried and measured wrong — so a scan for that name hit
   the sentence saying it was rejected and failed against correct code. Prose is
   asserted against gymDelRaw, code against gymDel. */
const gymDel = gymDelRaw.replace(/^--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ' ');

/** Every migration that attaches a trigger. Concatenated, not listed by hand at
    each call site, so adding batch five means editing one line rather than four. */
/* 0096 is in this list for the NEGATIVE sweeps below — "no trigger runs
    audit_row_change on audit_log", "nothing is BEFORE" — and contributes zero to
    the per-row count, because it attaches a different function. That is the
    point of it, and the count assertion is what proves it did not quietly widen
    the generic one. */
const ALL = [sql, widen, config, authoring, records, gym, gymDel, noTrunc, entries];
const allSql = ALL.join('\n');

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
  /* Batch four, 0089: the programme authoring chain, taken whole. A half audited
     chain reads worse than an unaudited one — somebody seeing that a block was
     added but not that the session inside it was rewritten draws a confident
     wrong conclusion from a record that looks complete. */
  ['exercises', AUTHORING], ['programmes', AUTHORING], ['programme_blocks', AUTHORING],
  ['programme_sessions', AUTHORING], ['programme_exercises', AUTHORING],
  ['exercise_overrides', AUTHORING],
  /* Batch five, 0091: the records somebody asks for during a dispute, a data
     request or an investigation. Three of the five are tables whose grants 0090
     corrected, which is not a coincidence — they kept turning up as the ones
     nobody had looked at. */
  ['sar_requests', RECORDS], ['sar_clinical_reviews', RECORDS],
  ['injury_timeline_event', RECORDS], ['rehab_assignments', RECORDS], ['users', RECORDS],
  /* Typed as plain strings rather than left as a literal union. The two guards
     below ask whether a name is ABSENT from this list, and against a literal
     union tsc calls that comparison unintentional and refuses to compile — it is
     right that the check cannot fail today, and wrong about why that matters.
     The check exists for the edit that adds the name. */
] as ReadonlyArray<readonly [string, string]>;

/** Deliberately NOT audited, pending a decision, and this list is a guard rather
    than a note: each writes a row per athlete per session or per membership
    change, so a row-per-row audit is a volume question somebody has to answer
    before a later batch sweeps them up mechanically. `group_memberships` alone
    took 17,692 inserts over the statistics window against 47 live rows. */
const DEFERRED_ON_VOLUME: readonly string[] = [
  'session_participants', 'session_attendance', 'group_memberships',
];

/** Excluded for SHAPE rather than volume, which is a different argument and so a
    different list. `organisations` has no org_id column at all — it IS the org —
    and `metric_definitions` has neither an id nor an org_id. The generic
    function would write rows with a null org_id, and audit_log's select policy
    is `org_id = auth_org_id()`, which no null satisfies: recorded, and readable
    by nobody. Auditing organisations needs the special case `athletes` already
    has, where the row's own id becomes the org. That is a function change, and
    it belongs in its own migration with its own test. */
const DEFERRED_ON_SHAPE: readonly string[] = ['organisations', 'metric_definitions'];

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

  /* THE CASE THE TWO IMPLEMENTATIONS USED TO DISAGREE ABOUT, fixed 2026-09-08.
     SQL's audit_acting_role() walks the five staff roles and returns NULL when
     none matches. TypeScript's actingRole() used to fall back to `roles[0] ??
     'athlete'`, so the same athlete opting themselves out of a leaderboard was
     recorded with a null role by the trigger (pinned by test 450) and as
     'athlete' by the application. actor_role names WHICH STAFF ROLE somebody
     acted in; an athlete holds none. */
  assert(actingRole(['athlete']) === null, 'an athlete acts in no staff role, so the TypeScript returns null');
  assert(actingRole([]) === null, 'and so does no role at all, rather than inventing one');
  assert(
    /returns null when none matches|return null;/i.test(sql) || /coalesce\([^)]*\)\s*;/.test(sql),
    'and the SQL says the same, which is what 450 asserts against real rows',
  );
  assert(
    actingRole(['athlete', 'nutritionist']) === 'nutritionist',
    'somebody who is both still records the staff role — the fallback went, the precedence did not',
  );
}

console.log('\nthe trigger is attached to every audited table, for all three operations');
{
  for (const [t, file] of AUDITED) {
    const body = read(file);
    const m = new RegExp(`create trigger ${t}_audit\\s+after insert or update or delete on public\\.${t}`).exec(body);
    assert(m !== null, `${t} has an after-insert/update/delete trigger`);
  }
  const perRow = ALL
    .map((f) => (f.match(/for each row execute function public\.audit_row_change\(\)/g) ?? []).length)
    .reduce((a, b) => a + b, 0);
  assert(perRow === AUDITED.length, `all ${AUDITED.length} run per row (saw ${perRow}) — a multi-row update must not collapse into one entry`);
  assert(
    !/before insert or update/i.test(allSql),
    'and they are AFTER, so a write refused by RLS or a constraint never leaves a row claiming it happened',
  );
}

console.log('\naudit_log is never audited by itself');
{
  /* It is in the unaudited list and must stay there: a trigger on audit_log
     would audit its own writes. Obvious once said, and exactly the kind of thing
     a mechanical sweep of "every remaining table" would pick up. */
  assert(
    !/create trigger audit_log_audit|on public\.audit_log\s+for each row/i.test(allSql),
    'no trigger attaches audit_row_change to audit_log',
  );
  assert(
    !AUDITED.some(([t]) => t === 'audit_log'),
    'and it is not in the audited list',
  );
}

console.log('\nthe high-volume tables stay out until somebody decides');
{
  for (const t of DEFERRED_ON_VOLUME) {
    assert(
      !new RegExp(`create trigger ${t}_audit`).test(allSql),
      `${t} has no audit trigger — a row per athlete per session is a decision, not a sweep`,
    );
    assert(
      !AUDITED.some(([a]) => a === t),
      `and ${t} is not in the audited list either`,
    );
  }
}

console.log('\nthe org-less tables stay out until the function can carry them');
{
  for (const t of DEFERRED_ON_SHAPE) {
    assert(
      !new RegExp(`create trigger ${t}_audit`).test(allSql),
      `${t} has no audit trigger — with no org_id the row would be readable by nobody`,
    );
    assert(!AUDITED.some(([a]) => a === t), `and ${t} is not in the audited list either`);
  }
  assert(
    /ORGANISATIONS IS DELIBERATELY NOT HERE/.test(records),
    'and 0091 says so in writing, with the reason',
  );
}

console.log('\nthe one shape in batch four that is not like the others');
{
  /* exercises.org_id is nullable and every other table in the chain requires an
     org. A global exercise therefore produces an audit row with a null org_id,
     and audit_log's select policy is org_id = auth_org_id(), which no null
     satisfies: written, and readable by nobody. Test 460 pins the behaviour in
     both directions; this pins the fact that the migration SAYS SO, because the
     next person to widen a batch needs to know the check is worth making. */
  assert(
    /exercises\.org_id`? IS NULLABLE/.test(authoring),
    '0089 records that exercises.org_id is nullable',
  );
  assert(
    /auth_org_id\(\)`?, which no null satisfies/.test(authoring),
    'and spells out the consequence: the audit row has no org-scoped reader',
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

console.log('\ngym corrections are audited, and by a separate function on purpose');
{
  /* WHY THIS SECTION IS SEPARATE FROM EVERYTHING ABOVE. On 2026-09-09 a live set
     on production read -3 reps and -300.00 kg of volume, and audit_log could not
     say who wrote it: zero rows mentioning gym, ever, in a table that had
     recorded every sign-in and every availability change in the same ten
     minutes. 0096 closes that, and it does so WITHOUT touching
     audit_row_change(), because a correction is a different kind of event from a
     row changing and needs a different answer — see the assertions below, each
     of which is a place the two functions deliberately disagree. */
  for (const t of ['gym_set_logs', 'gym_session_logs']) {
    assert(
      new RegExp(`create trigger ${t}_correction_audit\\s+after insert on public\\.${t}`).test(gym),
      `${t} has an after-insert correction trigger`,
    );
    assert(
      new RegExp(`for each row when \\(new\\.revision_of is not null\\)[\\s\\S]{0,80}public\\.audit_gym_correction\\(\\)`).test(gym),
      `and it only fires on a revision — an athlete logging five sets writes no audit rows`,
    );
  }
  assert(
    (gym.match(/after insert on public\./g) ?? []).length === 2
      && !/after insert or update|after update|after delete/.test(gym),
    'insert only: the supersede half of a revision is the same event, and recording it twice makes a reader count two',
  );

  assert(
    !/create or replace function public\.audit_row_change/.test(gym),
    "0096 does not redefine audit_row_change — 0085's field-names-never-values rule for the clinical tables is untouched",
  );
  assert(
    ![sql, widen, config, authoring, records].some((f) => /audit_gym_correction/.test(f)),
    'and nothing before it referenced the new function, so this is additive',
  );
  assert(
    /tg_table_name \|\| '\.correction'/.test(gym),
    "the action reads <table>.correction, the same table.event shape the rest of the log uses",
  );

  /* THE DISCLOSURE RULE, INVERTED FOR THIS TABLE AND ONLY THIS TABLE. Reps and
     load are performance numbers every audit_log reader already sees on the
     training report, so recording them discloses nothing new — and "-3 replaced
     8" is the entire fact somebody needs. A changed-fields list alone would have
     left the production question exactly as unanswerable as no row at all. */
  const valued = (/v_valued  := array\[([^\]]+)\]/.exec(gym) ?? [])[1] ?? '';
  const setContent = (/v_content := array\['reps_completed'([^\]]+)\]/.exec(gym) ?? [])[1] ?? '';
  assert(
    /v_valued  := v_content;/.test(gym),
    'every correctable field on a gym SET carries its value: they are all numbers or flags',
  );
  assert(
    ['reps_completed', 'load_kg', 'rpe', 'rir', 'side', 'is_warmup']
      .every((f) => new RegExp(`'${f}'`).test(`'reps_completed'${setContent}`)),
    'and the set content list is exactly the six correctable columns',
  );
  assert(
    /v_content := array\['session_rpe', 'comment'\]/.test(gym),
    'a session correction watches both submitted fields, session_rpe and comment',
  );
  assert(
    valued.includes("'session_rpe'") && !valued.includes("'comment'"),
    'but only the number carries its value — a comment is an athlete writing about their own body, and audit_log is sport-scientist readable',
  );

  /* audit_row_change() returns early on a no-op UPDATE, because a write that
     changed nothing is not an event. A revision that changed nothing IS one: a
     row exists that did not exist before. Production holds exactly that row,
     8 reps corrected to 8 reps, thirty-three seconds before the -3, and it is
     the clearest single sign the panel was being exercised rather than used. */
  assert(
    !/if v_changed = '\{\}'::text\[\] then return/.test(gym),
    'a revision that changes nothing is still recorded, unlike a no-op update — the two are not the same event',
  );

  assert(
    /gym_set_logs has no athlete_id|the athlete lives on its parent/.test(gym),
    'the migration records that gym_set_logs has no athlete_id of its own, which is the shape that fails silently',
  );
  assert(
    /A DELETE\. gym_set_logs grants delete to nobody/.test(gym),
    'and names what it still does not cover, rather than leaving it to be discovered',
  );
  assert(
    !AUDITED.some(([t]) => t === 'gym_set_logs' || t === 'gym_session_logs'),
    'neither gym table runs the generic function, so nothing above changed meaning',
  );
}

console.log('\ngym deletes are audited too, and a cascade says so');
{
  /* 0096 named this and left it: "A DELETE ... Auditing service-role deletes is
     a real question and a separate one." 0097 is that question. Measured on both
     databases first: authenticated holds INSERT and SELECT only, service_role
     holds DELETE and TRUNCATE, and nothing recorded either — so a set log could
     only be removed from below the app, and that left no trace. The same shape
     as the 2026-09-07 incident 0085's header records. */
  for (const t of ['gym_set_logs', 'gym_session_logs']) {
    assert(
      new RegExp(`create trigger ${t}_delete_audit\\s+after delete on public\\.${t}`).test(gymDel),
      `${t} has an after-delete trigger`,
    );
  }
  assert(
    (gymDel.match(/for each row execute function public\.audit_gym_delete\(\)/g) ?? []).length === 2,
    'both run per row, so a cascade of twenty sets is twenty records rather than one',
  );
  assert(
    /tg_table_name \|\| '\.delete'/.test(gymDel),
    "the action reads <table>.delete — the same name the -3 repair wrote by hand, so the log reads as one thing",
  );

  /* THE SIGNAL, and the reason it is not the obvious one. pg_trigger_depth() was
     tried first and measured WRONG against a real cascade on scratch: it reads 1
     for the cascaded children, so every child looked like a direct delete. */
  assert(
    !/pg_trigger_depth/.test(gymDel),
    'via_cascade is NOT taken from pg_trigger_depth(), which measured 1 for a real cascade',
  );
  assert(
    /v_parent_found/.test(gymDel) && /v_cascade := not coalesce\(v_parent_found/.test(gymDel),
    'it is taken from the parent already being gone, which is what "came through the cascade" means',
  );
  assert(
    /the athlete\s*(?:--)?\s*cannot be resolved from the child/.test(gymDelRaw),
    'and the migration records the cost: a cascaded child carries no athlete, because the row naming them went first',
  );

  /* The one value not kept, carried over from 0096's rule. */
  assert(
    /'comment_present'/.test(gymDel) && /'comment_length'/.test(gymDel),
    'a deleted session comment is recorded as present and measured, never quoted',
  );
  assert(
    !/'comment',\s*v_old ->> 'comment'/.test(gymDel),
    "and its text never reaches metadata — audit_log is sport-scientist readable",
  );

  /* Named rather than left to be discovered. */
  assert(
    /TRUNCATE\. service_role holds it/.test(gymDelRaw),
    '0097 says plainly that TRUNCATE still bypasses all of this',
  );
  assert(
    /none of them generalise/.test(gymDelRaw),
    'and why blocking it is a decision rather than a side effect: reset-scratch.mjs would need to lift two more guards',
  );
}

console.log('\nand a truncate cannot walk past the delete audit');
{
  /* 0097 records every row deleted from the gym logs. A TRUNCATE fires no row
     triggers, so without 0098 it would empty both tables past all of it — and
     service_role holds TRUNCATE on each. 0007 already took this decision for
     audit_log: refuse it, do not try to audit it. */
  for (const t of ['gym_set_logs', 'gym_session_logs']) {
    assert(
      new RegExp(`create trigger ${t}_no_truncate\\s+before truncate on public\\.${t}`).test(noTrunc),
      `${t} refuses TRUNCATE`,
    );
  }
  assert(
    (noTrunc.match(/for each statement execute function public\.gym_log_no_truncate\(\)/g) ?? []).length === 2,
    'both are STATEMENT-level — a FOR EACH ROW trigger is exactly what a truncate walks past',
  );
  assert(
    /errcode = 'insufficient_privilege'/.test(noTrunc),
    "and raise with insufficient_privilege, so it reads as a refusal rather than a bug",
  );

  /* THE COUPLING THIS PINS, which is the reason the guard exists rather than a
     comment. reset-scratch.mjs truncates every public table in one statement
     and must lift these to do it. It used to name ONE trigger; a hard-coded
     list that falls out of date fails in the worst direction — the reset dies
     mid-truncate, or a guard is left disabled. It now reads the list from
     pg_trigger, so a fourth guard needs no edit there. */
  assert(
    !/const AUDIT_TRUNCATE_TRIGGER/.test(resetScratch),
    'reset-scratch.mjs no longer hard-codes a single guard name',
  );
  assert(
    /tgtype & 32/.test(resetScratch) && /tgtype & 2/.test(resetScratch),
    'it derives every BEFORE TRUNCATE guard from pg_trigger instead',
  );
  assert(
    /disable trigger \$\{g\.trigger_name\}/.test(resetScratch)
      && /enable trigger \$\{g\.trigger_name\}/.test(resetScratch),
    'lifts and restores each one by name',
  );
  /* ASSERT THE LOGIC, NOT THE VARIABLE NAME. A first version checked only that
     `stillOff` and process.exit(1) appeared, and passed against a planted
     `const stillOff = []` — a verification that can never fail, which is worse
     than none because it reads as protection. The condition below is the part
     that does the verifying. */
  assert(
    /tgenabled !== 'O'/.test(resetScratch),
    "it verifies restoration by comparing tgenabled to 'O', origin-enabled",
  );
  assert(
    /restored\.length !== guards\.length/.test(resetScratch),
    'and that every guard it lifted was found again, not just the ones that came back',
  );
  assert(
    /stillOff\.length > 0[\s\S]{0,700}process\.exit\(1\)/.test(resetScratch),
    'and exits non-zero while any guard is still disabled',
  );
  assert(
    /no BEFORE TRUNCATE guards found at all/.test(resetScratch),
    'and stops if the derived list is empty, rather than truncating with nothing to restore',
  );
}

console.log('\nthe other three immutable entries: the gaps that were actually there (0099)');
{
  /* WHAT THE FIRST VERSION OF 0099 GOT WRONG, asserted here so it cannot come
     back. pg_trigger shows no audit triggers on wellness_entries,
     training_entries or nutrition_checkins, and I read that as "corrections are
     not audited". They are — not by a trigger: revise_wellness_entry and
     revise_training_entry have written `entry_revision.created` in-transaction
     since 0058. Only revise_nutrition_checkin never got the call. The first
     0099 added correction triggers to all three and would have written TWO
     audit rows for every wellness and training correction. */
  const THREE = ['wellness_entries', 'training_entries', 'nutrition_checkins'];

  assert(
    !/create trigger \w+_correction_audit/.test(entries)
      && !/audit_entry_correction\(\)\s*;?\s*$/m.test(entries.replace(/drop function[^;]+;/g, '')),
    'no correction TRIGGER on any of the three: corrections already go through the revise_* RPCs',
  );
  for (const t of THREE) {
    assert(
      new RegExp(`drop trigger if exists ${t}_correction_audit on public\\.${t}`).test(entries),
      `and the one the first version created on ${t} is dropped explicitly, so a database that ran it converges`,
    );
  }
  assert(
    /drop function if exists public\.audit_entry_correction\(\)/.test(entries),
    'along with the function behind them, rather than left defined and unreferenced',
  );

  /* THE GAP THAT WAS REAL ON THE CORRECTION SIDE, and only on one table. */
  assert(
    /create or replace function public\.revise_nutrition_checkin/.test(entries),
    'revise_nutrition_checkin is redefined — it is the one revise_* that never wrote an audit event',
  );
  assert(
    /'entry_revision\.created'/.test(entries) && /'domain',\s+'nutrition'/.test(entries),
    "and it writes the SAME event under the same domain key, not a second vocabulary for one table",
  );
  assert(
    /'nutrition_checkin'/.test(entries),
    'with its own entity_type, so the three domains stay distinguishable in one query',
  );
  /* The permission rule must survive being copied forward. A redefinition that
     silently widened who may revise a check-in would be a far worse bug than the
     missing audit row it exists to add. */
  assert(
    /if v_original\.athlete_id is distinct from v_athlete then\s*raise exception 'not_permitted'/.test(entries),
    'and the athlete-only rule is carried forward unchanged — no staff write path appears',
  );
  assert(
    /superseded_by is null/.test(entries) && /deleted_at is null/.test(entries),
    'as are the linear-chain and soft-delete guards on the row it revises',
  );

  /* THE PRIVACY RULE 0096 SET, applied to the field this migration adds. */
  assert(
    /'from_length'/.test(entries) && /'to_length'/.test(entries)
      && !/'from', to_jsonb\(v_original\) -> 'note'/.test(entries),
    'a rewritten note is recorded by length, never by text — audit_log is sport_scientist-readable',
  );
  assert(
    /'answer', jsonb_build_object\('from'/.test(entries),
    'while the answer carries its value: three fixed words, not free text',
  );
  /* The divergence this migration deliberately did NOT resolve, pinned so a
     future change to it is a decision rather than a drift. */
  assert(
    /KNOWN INCONSISTENCY, DELIBERATELY NOT RESOLVED HERE/.test(read(ENTRIES))
      && /have shipped since 0058|has shipped since 0058|since 0058/.test(read(ENTRIES)),
    'and the migration records that entry_revision.created still carries comment text, rather than copying or silently narrowing it',
  );

  /* THE TWO GAPS THAT WERE REAL ON ALL THREE TABLES. */
  for (const t of THREE) {
    assert(
      new RegExp(`create trigger ${t}_delete_audit\\s+after delete on public\\.${t}`).test(entries),
      `${t} has an after-delete trigger — nothing recorded a delete on it before`,
    );
    assert(
      new RegExp(`create trigger ${t}_no_truncate\\s+before truncate on public\\.${t}`).test(entries),
      `and ${t} refuses a truncate`,
    );
  }
  assert(
    (entries.match(/for each row execute function public\.audit_entry_delete\(\)/g) ?? []).length === 3,
    'all three delete audits run per row',
  );
  assert(
    (entries.match(/for each statement execute function public\.athlete_entry_no_truncate\(\)/g) ?? []).length === 3,
    'and all three truncate guards are STATEMENT-level, which is what a truncate would otherwise walk past',
  );
  assert(
    /errcode = 'insufficient_privilege'/.test(entries),
    'refusing with insufficient_privilege, so it reads as a refusal rather than a bug',
  );

  /* NO via_cascade HERE, and that is measured rather than omitted. Every FK into
     all three is ON DELETE NO ACTION — including training_entries -> sessions,
     where deleting a session holding entries is REFUSED rather than cascading.
     gym needed the flag only because gym_set_logs.gym_session_log_id cascades. */
  assert(
    !/via_cascade/.test(entries),
    'no via_cascade flag, because no cascade reaches these three',
  );
  assert(
    /v_free \|\| '_present'/.test(entries) && /v_free \|\| '_length'/.test(entries),
    'a delete records that free text existed and how much was lost, never the text',
  );
  assert(
    /'soreness_areas'/.test(entries),
    'soreness_areas IS recorded: body area is already staff-visible by decision, unlike diagnosis',
  );
  assert(
    !/create or replace function public\.audit_row_change/.test(entries)
      && !/create or replace function public\.audit_gym_/.test(entries),
    '0099 redefines neither audit_row_change nor the gym functions — every rule they carry is untouched',
  );
  assert(
    !THREE.some((t) => AUDITED.some(([a]) => a === t)),
    'and none of the three runs the generic function, so nothing above changed meaning',
  );

  /* The pgTAP suites exist AND are named here, because a test file that exists
     is not a test that runs. */
  for (const f of ['supabase/tests/540_entry_audit_test.sql', 'supabase/tests/550_entry_truncate_guard_test.sql']) {
    assert(existsSync(f), `${f} exists`);
  }
  assert(
    /six BEFORE TRUNCATE guards exist in public/.test(read('supabase/tests/530_gym_truncate_guard_test.sql')),
    "530's catalogue count was raised from three to six, so a dropped guard still fails something",
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
