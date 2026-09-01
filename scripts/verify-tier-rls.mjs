/* Verifies migration 0061 (tier in RLS) against whatever SUPABASE_DB_URL points at.
 *
 * SAFE AGAINST PRODUCTION, and written that way on purpose. It is READ-ONLY plus
 * pure-function calls. It writes no rows, creates nothing, and drops nothing.
 *
 * Do NOT reach for `npm run test:tenancy` to check this on a live database.
 * supabase/tests/000_setup_test_helpers.sql creates a `tests` schema and ends with
 * `grant execute on function tests.build_org(text, text) to public`, which on production
 * would leave any authenticated user able to create organisations. That suite is for a
 * local stack only. This script is the production-safe subset.
 *
 *   node --env-file=.env.local scripts/verify-tier-rls.mjs
 */
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL is not set.');
  process.exit(1);
}

let passed = 0;
let failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed += 1;
  else failed += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${label}${ok ? '' : `  (got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)})`}`);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  console.log('\n── the migration is recorded ──');
  const applied = await client.query(
    `select 1 from supabase_migrations.schema_migrations where version = '0061'`,
  );
  check('0061 is in schema_migrations', applied.rowCount, 1);

  console.log('\n── both functions exist ──');
  const fns = await client.query(
    `select p.proname, p.provolatile, p.prosecdef
       from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname in ('auth_org_is_premium', 'consent_write_allowed')
      order by p.proname`,
  );
  check('two functions created', fns.rows.map((r) => r.proname),
        ['auth_org_is_premium', 'consent_write_allowed']);
  // length checks included deliberately: `every()` on an empty array is true, so
  // without them these two pass when NO function exists at all — a green tick for
  // the exact state they are meant to catch.
  check('both are STABLE',
        fns.rows.length === 2 && fns.rows.every((r) => r.provolatile === 's'), true);
  check('both are SECURITY DEFINER',
        fns.rows.length === 2 && fns.rows.every((r) => r.prosecdef === true), true);

  console.log('\n── the four WRITE policies carry the tier predicate ──');
  const pol = await client.query(
    `select policyname, cmd, coalesce(with_check, '') as wc, coalesce(qual, '') as using_
       from pg_policies where tablename = 'athlete_consents' order by policyname`,
  );
  const writes = pol.rows.filter((r) => r.cmd === 'INSERT' || r.cmd === 'UPDATE');
  check('four write policies present', writes.length, 4);
  check('every write policy checks tier',
        writes.every((r) => r.wc.includes('consent_write_allowed')), true);

  console.log('\n── withdrawal is not blocked: the predicate is in WITH CHECK, never USING ──');
  check('no USING clause mentions the tier predicate',
        pol.rows.every((r) => !r.using_.includes('consent_write_allowed')), true);

  console.log('\n── reading a consent was never the paid part ──');
  const selects = pol.rows.filter((r) => r.cmd === 'SELECT');
  check('two select policies, untouched', selects.length, 2);
  check('no select policy checks tier',
        selects.every((r) => !r.wc.includes('consent_write_allowed')
                          && !r.using_.includes('consent_write_allowed')), true);

  console.log('\n── the predicate itself (pure calls, no rows written) ──');
  if (fns.rows.length < 2) {
    // Report rather than throw: running this BEFORE the migration is a normal
    // thing to do, and a stack trace is a worse answer than "not applied yet".
    console.log('  skip - both functions must exist first; migration 0061 is not applied.');
    failed += 5;
  } else {
  // No JWT is set on this connection, so auth_org_is_premium() resolves to false —
  // which is also the fail-closed assertion.
  const q = async (sql) => (await client.query(sql)).rows[0].v;
  check('no claims resolves to Basic, never Premium',
        await q('select auth_org_is_premium() as v'), false);
  check('another purpose is always allowed',
        await q(`select consent_write_allowed('leaderboard_visibility', now(), null) as v`), true);
  check('a row that grants nothing is allowed',
        await q(`select consent_write_allowed('healthkit_sync', null, null) as v`), true);
  check('A WITHDRAWN ROW IS ALLOWED — this is the withdrawal path',
        await q(`select consent_write_allowed('healthkit_sync', now(), now()) as v`), true);
  check('an ACTIVE grant on Basic is the only thing refused',
        await q(`select consent_write_allowed('healthkit_sync', now(), null) as v`), false);

  }

  console.log('\n── existing consents were not touched by the migration ──');
  const rows = await client.query(
    `select count(*)::int as n from athlete_consents where purpose = 'healthkit_sync'`,
  );
  console.log(`  note - ${rows.rows[0].n} healthkit_sync consent row(s) still present (a downgrade must not erase what was agreed)`);
} finally {
  await client.end();
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
