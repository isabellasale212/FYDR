/* Verify programme_assignments_update on a LIVE database, without writing to it.
 *
 *   set -a && source .env.local && set +a && node scripts/verify-assignment-authorship.mjs
 *
 * WHY THIS EXISTS RATHER THAN THE pgTAP SUITE. supabase/tests/400 asserts these
 * same rules properly, but every file in that suite calls tests.fixtures(),
 * which INSERTS fixture organisations, athletes and injuries. Pointing it at a
 * database holding real club data is the one thing the project rules say never
 * to do, and "it rolls back afterwards" is not a good enough answer for live
 * data. So this asks the same questions a different way: it never writes at all.
 *
 * HOW IT AVOIDS WRITING, twice over.
 *
 *  1. Everything runs inside `begin; set transaction read only;`. Postgres then
 *     refuses INSERT, UPDATE and DELETE at the server, so a bug in this file
 *     cannot modify anything -- the guarantee does not depend on the code below
 *     being correct.
 *  2. It never attempts the UPDATE in the first place. RLS decides by evaluating
 *     the policy's WITH CHECK expression against the candidate row, so this
 *     evaluates that same expression directly, as a SELECT.
 *
 * WHY IT READS THE PREDICATE OUT OF THE DATABASE. The expression is fetched with
 * pg_get_expr() from pg_policy and evaluated verbatim. It is deliberately NOT
 * retyped here: a copy in this file would prove that my copy behaves correctly,
 * which is not the question. The question is what is deployed.
 *
 * WHOSE ROLES. auth_roles() and auth_org_id() read the JWT claim
 * app_metadata.roles / app_metadata.org_id (migrations 0010, 0065) -- never a
 * table. So a role is simulated by setting request.jwt.claims for the
 * transaction, which is session state, not data, and no real account is touched
 * or needed. The org and the assignment row ARE real, read from the database, so
 * the predicate is evaluated against a row that actually exists.
 *
 * The injury-linked cases substitute a synthetic injury_id into the row context
 * through a subquery aliased as programme_assignments. Nothing is inserted; the
 * predicate only ever tests `injury_id is not null`.
 */
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL is not set. Run from the repo root with:');
  console.error('  set -a && source .env.local && set +a && node scripts/verify-assignment-authorship.mjs');
  process.exit(1);
}

const ROLES = {
  coach: ['coach'],
  nutritionist: ['nutritionist'],
  medic: ['medic'],
  strength_conditioning: ['strength_conditioning'],
  sport_scientist: ['sport_scientist'],
};

const SYNTHETIC_INJURY = '00000000-0000-4000-8000-0000000000ff';

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
console.log(`\nDatabase: ${new URL(url).host}`);

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures += 1;
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} - ${label}  (predicate = ${actual}, expected ${expected})`);
};

try {
  await client.query('begin');
  await client.query('set transaction read only');

  // ---- 1. migration head -------------------------------------------------
  const head = await client.query(
    'select version from supabase_migrations.schema_migrations order by version desc limit 5',
  );
  const versions = head.rows.map((r) => r.version);
  console.log(`\nMigration head: ${versions[0]}`);
  console.log(`Last five     : ${versions.slice().reverse().join(', ')}`);
  const has82 = versions.includes('0082');

  // ---- 2. the deployed policy -------------------------------------------
  const pol = await client.query(`
    select pg_get_expr(p.polqual, p.polrelid)      as using_expr,
           pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    where c.relname = 'programme_assignments' and p.polname = 'programme_assignments_update'
  `);
  if (pol.rowCount === 0) {
    console.log('\nNo programme_assignments_update policy found. Nothing to verify.');
    process.exit(1);
  }
  const checkExpr = pol.rows[0].check_expr;
  console.log('\nDeployed WITH CHECK:');
  console.log(`  ${checkExpr.replace(/\s+/g, ' ').slice(0, 400)}${checkExpr.length > 400 ? ' …' : ''}`);

  const mentionsInjury = /injury_id/.test(checkExpr);
  const mentionsAuthorship = /programme_type/.test(checkExpr);
  console.log(`\n  names injury_id (0080/0082 sign-off rule) : ${mentionsInjury}`);
  console.log(`  names programme_type (0022/0070 authorship): ${mentionsAuthorship}`);
  if (!has82 || !mentionsInjury || !mentionsAuthorship) {
    console.log(
      '\n  This database does not yet carry 0082. The four checks below describe\n' +
        '  the rule that migration installs, so they are expected to fail here.',
    );
  }

  // ---- 3. a real gym assignment to evaluate against ----------------------
  const row = await client.query(`
    select a.id, a.org_id, a.programme_id, p.programme_type
    from programme_assignments a
    join programmes p on p.id = a.programme_id
    where p.programme_type <> 'rehab' and a.injury_id is null
    order by a.created_at
    limit 1
  `);
  if (row.rowCount === 0) {
    console.log('\nNo non-rehab assignment exists to evaluate against. Cannot verify.');
    process.exit(1);
  }
  const { id, org_id: orgId, programme_type: ptype } = row.rows[0];
  console.log(`\nEvaluated against a real ${ptype} assignment (id ${String(id).slice(0, 8)}…) in org ${String(orgId).slice(0, 8)}…`);

  const asRole = async (roles, { injuryLinked }) => {
    await client.query('select set_config($1, $2, true)', [
      'request.jwt.claims',
      JSON.stringify({
        sub: '00000000-0000-4000-8000-00000000000a',
        app_metadata: { org_id: orgId, roles },
      }),
    ]);
    const source = injuryLinked
      ? `(select org_id, programme_id, '${SYNTHETIC_INJURY}'::uuid as injury_id,
                 'active'::assignment_status as status
          from programme_assignments where id = $1) programme_assignments`
      : `(select org_id, programme_id, injury_id, status
          from programme_assignments where id = $1) programme_assignments`;
    const res = await client.query(`select (${checkExpr}) as allowed from ${source}`, [id]);
    return res.rows[0].allowed;
  };

  console.log('\nThe four assertions, evaluated as each role:\n');
  check('the COACH cannot update an ordinary gym assignment',
    await asRole(ROLES.coach, { injuryLinked: false }), false);
  check('the NUTRITIONIST cannot either',
    await asRole(ROLES.nutritionist, { injuryLinked: false }), false);
  check('the MEDIC cannot touch an ORDINARY gym assignment — the sign-off exception is scoped',
    await asRole(ROLES.medic, { injuryLinked: false }), false);
  check('the MEDIC can sign off an INJURY-LINKED one',
    await asRole(ROLES.medic, { injuryLinked: true }), true);

  console.log('\nPositive controls, so the falses above are the rule and not a dead predicate:\n');
  check('the S&C CAN update an ordinary gym assignment, exactly as before 0080',
    await asRole(ROLES.strength_conditioning, { injuryLinked: false }), true);
  check('the S&C CANNOT make an injury-linked one live — that is the sign-off gate',
    await asRole(ROLES.strength_conditioning, { injuryLinked: true }), false);
  check('the SPORT SCIENTIST keeps their ordinary authorship',
    await asRole(ROLES.sport_scientist, { injuryLinked: false }), true);

  await client.query('rollback');
  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`);
  console.log('Nothing was written: the transaction was read only and no write was attempted.\n');
  process.exit(failures === 0 ? 0 : 1);
} catch (err) {
  await client.query('rollback').catch(() => {});
  console.error('\nERROR:', err.message);
  process.exit(1);
} finally {
  await client.end();
}
