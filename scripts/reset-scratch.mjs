/* Reset the SCRATCH database to seed.sql's state.
 *
 * WHY THIS IS A SCRIPT AND NOT A COMMAND SOMEBODY TYPES. `supabase db reset`
 * needs Docker, which this project does not have. The alternative is a sequence
 * of truncates, and a truncate is one wrong connection string away from being
 * the worst thing anybody does to this project. So the target check comes first,
 * it is structural rather than a comment, and it refuses rather than prompting.
 *
 * THREE ASSERTIONS BEFORE ANY WRITE, and all three must pass:
 *   1. The URL names the scratch project ref.
 *   2. The URL does NOT name the production ref. Belt and braces: a pooler URL
 *      carries the ref in the USERNAME rather than the host, so a single check
 *      written against one shape would quietly pass on the other.
 *   3. The database itself does not look like production. Both hold the same
 *      two club names and the same squad size, so counts prove nothing; the
 *      staff role assignments differ and that is what is tested.
 *
 * WHAT IS PRESERVED. metric_definitions, which is seeded by migrations 0016 and
 * 0056 rather than by seed.sql, and which authenticated holds no write grant on
 * at all. Truncating it would leave leaderboards pointing at a catalogue that no
 * longer has rows, and nothing in seed.sql would put them back.
 *
 * WHAT THIS DOES NOT RESTORE, because seed.sql never covered it: gps_records,
 * leaderboards, programmes, meal_library, nutrition_rules, test_definitions and
 * body_composition. They are empty before this runs and empty after. Said out
 * loud at the end rather than left as a surprise mid-walkthrough.
 *
 *   node scripts/reset-scratch.mjs           # refuses, prints the plan
 *   node scripts/reset-scratch.mjs --confirm # does it
 */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolveDbUrl } from './lib/db-url.mjs';

const SCRATCH_REF = 'stfgzkuvczbpxyevxkak';
const PRODUCTION_REF = 'asbxorjytxsvrzefwzqp';
/* metric_definitions is seeded by migrations 0016 and 0056, not by seed.sql, and
   authenticated holds no write grant on it at all. Truncating it would leave
   leaderboards pointing at an empty catalogue with nothing to restore them.

   audit_log CANNOT be cleared, and that is the design rather than an obstacle:
   0007 puts statement triggers on UPDATE, DELETE and TRUNCATE alike, so the
   table is append-only against every route. The first run of this script hit
   that guard and rolled back, which is exactly what should happen. Dropping the
   triggers to get around it would mean disabling a protection that production
   has, on my own judgement, to tidy a test database — so it is preserved and
   said out loud instead. Rows accumulate across resets; they are the audit trail
   of the testing itself, which is what an audit log is for. */
const PRESERVE = ['metric_definitions'];

/* audit_log cannot simply be preserved, which took two failed runs to establish.
 * 0007 makes it append-only with statement triggers on UPDATE, DELETE and
 * TRUNCATE — and it holds foreign keys to users, athletes and organisations, all
 * of which a reset must clear. So TRUNCATE ... CASCADE reaches it whatever the
 * preserve list says, and it refuses. There is no ordering that avoids this.
 *
 * The guard is therefore lifted for the truncate and put straight back. Three
 * things make that acceptable here and none of them generalise: this is a
 * scratch database whose entire contents are synthetic, the lift is one named
 * trigger rather than the table's protection as a whole, and it is restored in a
 * finally block and then VERIFIED — a reset that left the audit log writable
 * would be a far worse outcome than a reset that failed.
 *
 * What it protects against is the application, or a person, editing audit
 * history. It is not meant to stop the database owner rebuilding a test fixture,
 * which is what this is. On production this script refuses long before it gets
 * here, and the lift is deliberately AFTER all three target assertions.
 *
 * Approved explicitly on 2026-09-06 after the permission classifier blocked it,
 * which was the right call: disabling an audit-log protection is not something
 * to do on an agent's own judgement. */
/* DERIVED, NOT NAMED, since 2026-09-09. This was `audit_log_no_truncate`, one
 * hard-coded name, and 0098 made it three: gym_set_logs and gym_session_logs got
 * their own BEFORE TRUNCATE guards, for the reason 0097 spells out — it audits
 * every row deleted from those tables, and a truncate fires no row triggers, so
 * 263 rows could leave with no record they existed.
 *
 * Reading the list off pg_trigger rather than restating it means the FOURTH such
 * guard is lifted and restored without anybody remembering to edit this file.
 * A hard-coded list that falls out of date here fails in the worst direction:
 * the reset dies half-way through a truncate, or worse, a guard is left
 * disabled.
 *
 * Everything the original note said still applies to each one, and is why this
 * is acceptable at all: this is a scratch database whose contents are entirely
 * synthetic, the lift is named triggers rather than the tables' protection as a
 * whole, and every one is restored in a finally block and then VERIFIED. On
 * production this script refuses long before it reaches here.
 *
 * Extending the lift to the gym guards was approved by Isabella on 2026-09-09,
 * for the same reason the original needed approving: turning off a protection
 * that production has is not a call to make on an agent's own judgement. */
const truncateGuardsQuery = `
  select c.relname as table_name, t.tgname as trigger_name
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not t.tgisinternal
     and (t.tgtype & 32) <> 0            -- TRIGGER_TYPE_TRUNCATE
     and (t.tgtype & 2) <> 0             -- TRIGGER_TYPE_BEFORE
   order by c.relname, t.tgname`;

const confirmed = process.argv.includes('--confirm');

const { url, via, note } = await resolveDbUrl({
  direct: process.env.SCRATCH_DB_URL,
  pooler: process.env.SCRATCH_DB_POOLER_URL,
  label: 'scratch',
});

if (!url.includes(SCRATCH_REF)) {
  console.error(`REFUSING: the connection string does not name the scratch project (${SCRATCH_REF}).`);
  process.exit(1);
}
if (url.includes(PRODUCTION_REF)) {
  console.error('REFUSING: the connection string names the PRODUCTION project.');
  process.exit(1);
}

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false }, statement_timeout: 120000 });
await c.connect();
console.log(`target: scratch, via ${via}${note ? ` (${note})` : ''}`);

/* Assertion 3. Counts cannot tell these two databases apart; role assignments
   can. o.hartnell was seeded on production only. */
const { rows: [id] } = await c.query(`
  select (select count(*)::int from auth.users where email = 'o.hartnell@ashcomberfc.example') hartnell,
         (select count(*)::int from athletes where deleted_at is null) athletes`);
if (id.hartnell > 0) {
  console.error('REFUSING: this database contains o.hartnell, which exists only on production.');
  await c.end();
  process.exit(1);
}
console.log(`identity: o.hartnell absent, ${id.athletes} live athletes — this is scratch\n`);

const { rows: tables } = await c.query(`
  select c.relname t from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' order by c.relname`);
const toClear = tables.map((r) => r.t).filter((t) => !PRESERVE.includes(t));

if (!confirmed) {
  console.log(`PLAN (nothing has been written):`);
  console.log(`  truncate ${toClear.length} public tables, preserving: ${PRESERVE.join(', ')}`);
  console.log(`  delete every row from auth.users`);
  console.log(`  re-run supabase/seed.sql`);
  console.log(`\nRe-run with --confirm to do it.`);
  await c.end();
  process.exit(0);
}

const before = await c.query(`select count(*)::int n from auth.users`);
const { rows: [auditBefore] } = await c.query(`select count(*)::int n from audit_log`);
console.log(`clearing ${toClear.length} tables, ${before.rows[0].n} auth users, ${auditBefore.n} audit rows...`);
const { rows: guards } = await c.query(truncateGuardsQuery);
if (guards.length === 0) {
  console.error('\nSTOP: no BEFORE TRUNCATE guards found at all. Either the query is wrong or');
  console.error('every protection has been dropped — both want looking at before a reset.');
  await c.end();
  process.exit(1);
}
console.log(`  lifting ${guards.length} truncate guard(s) — ${guards.map((g) => g.trigger_name).join(', ')}`);
console.log(`  each is restored in a finally block and verified below`);

try {
  for (const g of guards) {
    await c.query(`alter table public.${g.table_name} disable trigger ${g.trigger_name}`);
  }
  await c.query('begin');
  await c.query(`truncate table ${toClear.map((t) => `public.${t}`).join(', ')} restart identity cascade`);
  await c.query(`delete from auth.users`);
  await c.query('commit');
} finally {
  for (const g of guards) {
    await c.query(`alter table public.${g.table_name} enable trigger ${g.trigger_name}`);
  }
}

/* Verified, not assumed. tgenabled 'O' is origin-enabled, the normal state; 'D'
   would mean the guard is still off, which is the one outcome worse than this
   script failing outright. */
const { rows: restored } = await c.query(`
  select c.relname as table_name, t.tgname as trigger_name, t.tgenabled
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where t.tgname = any($1)`, [guards.map((g) => g.trigger_name)]);
const stillOff = restored.filter((r) => r.tgenabled !== 'O');
if (stillOff.length > 0 || restored.length !== guards.length) {
  console.error(`\nSTOP: ${stillOff.length} of ${guards.length} truncate guard(s) are not enabled.`);
  for (const r of stillOff) console.error(`  ${r.table_name}.${r.trigger_name} is '${r.tgenabled}', not 'O'`);
  if (restored.length !== guards.length) {
    console.error(`  and only ${restored.length} of ${guards.length} were found at all`);
  }
  console.error('  A table that should refuse a truncate currently accepts one.');
  await c.end();
  process.exit(1);
}
console.log(`  all ${guards.length} truncate guard(s) restored and verified enabled`);

console.log('re-running supabase/seed.sql...');
await c.query(readFileSync('supabase/seed.sql', 'utf8'));

const { rows: [after] } = await c.query(`
  select (select count(*)::int from organisations) orgs,
         (select count(*)::int from athletes where deleted_at is null) athletes,
         (select count(*)::int from users) app_users,
         (select count(*)::int from wellness_entries) wellness,
         (select count(*)::int from flags) flags,
         (select count(*)::int from injuries) injuries,
         (select count(*)::int from metric_definitions) metrics`);
console.log('\nseeded:');
for (const [k, v] of Object.entries(after)) console.log(`  ${k.padEnd(12)} ${v}`);
console.log('\nPreserved, not reset:');
console.log(`  metric_definitions (${after.metrics} rows, migration-seeded catalogue)`);
console.log('\nStill empty, because seed.sql does not cover them:');
console.log('  gps_records, leaderboards, programmes, meal_library, nutrition_rules,');
console.log('  test_definitions, body_composition');
console.log('\nNo sign-ins yet — auth.users is empty. Run the auth seeder next.');
await c.end();
process.exit(0);
