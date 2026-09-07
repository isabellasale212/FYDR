/* Is the login rate limiter actually recording anything?
 *
 *   node --env-file=.env.production.explicit scripts/verify-login-attempts.mjs
 *   node --env-file=.env.local              scripts/verify-login-attempts.mjs
 *
 * WHY THIS CANNOT BE ANSWERED BY LOOKING AT THE TABLE. `login_attempt_record_result`
 * DELETES the row on success, because login_attempts tracks a failure STREAK and
 * clearing it is what stops yesterday's typo locking somebody out today. So an
 * empty table is the expected state of a healthy system, and is also exactly
 * what a limiter that has never run once looks like. A row count cannot tell
 * those apart, and reading one as reassurance is the mistake this file exists to
 * prevent.
 *
 * WHAT DISCRIMINATES: pg_stat_all_tables.n_tup_ins, the number of rows ever
 * INSERTED, which is not decremented by deletes. Nonzero means the limiter has
 * recorded failures at some point even if the table is empty now. Zero, over a
 * window in which sign-ins demonstrably happened, means it never has.
 *
 * THE WINDOW IS PART OF THE ANSWER, so it is printed. Statistics reset when the
 * counters are reset or the database is restored, and a zero over two hours
 * means nothing at all. auth.sessions' own insert count over the same window is
 * the control: it proves sign-ins were being attempted, so a zero beside it is
 * a real finding rather than a quiet period.
 *
 * READ ONLY, enforced by the transaction rather than by intention.
 */
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL is not set. Run with --env-file=.env.production.explicit');
  process.exit(1);
}

const ref = /postgres\.([a-z0-9]{20})|db\.([a-z0-9]{20})\.supabase/.exec(url);
const project = ref ? (ref[1] ?? ref[2]) : 'unknown';
const KNOWN = { stfgzkuvczbpxyevxkak: 'SCRATCH', asbxorjytxsvrzefwzqp: 'PRODUCTION' };

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
const q = async (sql, p = []) => (await client.query(sql, p)).rows;

try {
  await q('begin');
  await q('set transaction read only');

  console.log(`\nlogin_attempts on ${KNOWN[project] ?? project}\n${'='.repeat(48)}`);

  // 1. Does the machinery exist at all?
  const fns = await q(`
    select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('login_attempt_gate', 'login_attempt_record_result')
    order by p.proname`);
  console.log(`\nfunctions present: ${fns.length ? fns.map((r) => r.proname).join(', ') : 'NONE'}`);

  const [tbl] = await q(`select to_regclass('public.login_attempts') is not null as there`);
  console.log(`table present:     ${tbl.there ? 'yes' : 'NO'}`);
  if (!tbl.there) {
    console.log('\nNothing further to check.\n');
    await q('rollback');
    process.exit(1);
  }

  // 2. The row count, and immediately why it proves nothing on its own.
  const [{ n }] = await q('select count(*)::int as n from public.login_attempts');
  console.log(`rows right now:    ${n}   <- proves nothing either way; the row is deleted on success`);

  // 3. The discriminator, with its window and its control.
  const [stats] = await q(`
    select
      (select coalesce(sum(n_tup_ins), 0)::int from pg_stat_all_tables
        where schemaname = 'public' and relname = 'login_attempts')       as attempts_ins,
      (select coalesce(sum(n_tup_del), 0)::int from pg_stat_all_tables
        where schemaname = 'public' and relname = 'login_attempts')       as attempts_del,
      (select coalesce(sum(n_tup_ins), 0)::int from pg_stat_all_tables
        where schemaname = 'auth' and relname = 'sessions')               as sessions_ins,
      (select stats_reset from pg_stat_database where datname = current_database()) as since`);

  const days = stats.since ? ((Date.now() - new Date(stats.since).getTime()) / 86400000).toFixed(1) : '?';
  console.log(`\nstatistics window: ${days} days (since ${stats.since ? new Date(stats.since).toISOString() : 'unknown'})`);
  console.log(`  login_attempts inserted: ${stats.attempts_ins}`);
  console.log(`  login_attempts deleted:  ${stats.attempts_del}`);
  console.log(`  auth.sessions inserted:  ${stats.sessions_ins}   <- the control: sign-ins were happening`);

  console.log('\nverdict');
  if (stats.sessions_ins === 0) {
    console.log('  INCONCLUSIVE. No sessions were created in this window either, so there is');
    console.log('  nothing to compare against — a zero here would mean "nobody signed in".');
  } else if (stats.attempts_ins > 0) {
    console.log('  RECORDING. The limiter has written rows in this window. An empty table now');
    console.log('  means sign-ins are succeeding, which is the designed shape.');
  } else {
    console.log(`  NOT RECORDING. ${stats.sessions_ins} sessions were created in this window and`);
    console.log('  login_attempts took zero inserts. Every one of those sign-ins ran through');
    console.log('  /auth/sign-in, which calls the limiter before and after signInWithPassword.');
    console.log('  Note what this does NOT distinguish: a limiter that is failing open (the');
    console.log('  route catches and continues by design) from one that is never reached.');
    console.log('  The route logs to the function output on that path — read it there.');
  }
  console.log('');

  await q('rollback');
} finally {
  await client.end();
}
