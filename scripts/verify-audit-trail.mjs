/* Verify, on a LIVE database and without writing to it, that the two 0b audit
 * fixes are actually doing their job.
 *
 *   node --env-file=.env.production.explicit scripts/verify-audit-trail.mjs
 *
 * (swap the env file for .env.local to point it at scratch)
 *
 * WHAT IT ANSWERS, and neither can be answered from the schema alone:
 *
 *  1. auth.sessions.ip records the SIGNER again, not Vercel. Sign-in moved
 *     server-side so Supabase saw the serverless function: the address varied
 *     per invocation and the user agent was `node` on every production login.
 *     One athlete login was investigated as an intrusion because of it.
 *  2. Editing an injury leaves an audit_log row. Until migration 0085 nothing
 *     did — a sweep found 4 write paths reaching audit_log and 105 that did
 *     not, injuries and availability among them.
 *
 * HOW IT AVOIDS WRITING. Everything runs inside `begin; set transaction read
 * only`, so Postgres refuses INSERT/UPDATE/DELETE at the server: the guarantee
 * does not depend on the code below being correct. It also cannot MAKE the
 * injury edit — you do that in the app first, then run this.
 *
 * WHY IT DOES NOT JUST LOOK FOR "A ROW". Both checks are about whether a value
 * is MEANINGFUL, not whether it is present. A session row has always existed
 * and always had an ip; the question is whether that ip is a person's. So the
 * verdicts below are about the shape of the value, and anything ambiguous is
 * reported as INCONCLUSIVE rather than rounded to a pass.
 */
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL is not set. Run with --env-file=.env.production.explicit');
  process.exit(1);
}

/* The signature of the broken state. `node` is the serverless runtime's own
   user agent: before the fix EVERY production login carried it, and exactly one
   session in production's whole history came from a browser. */
const FUNCTION_AGENT = /^node/i;

/* This script's own diagnostic sign-ins, excluded by name. They were created on
   SCRATCH while proving GoTrue honours a forwarded address, they carry
   documentation-range IPs (RFC 5737), and counting them as evidence that a real
   person signed in from a real browser is exactly the self-congratulation this
   file exists to avoid. They do not exist on production. */
const TEST_AGENT = /FydrXffProbe|FydrSsrProbe/i;

const AUDITED_TABLES = ['injuries', 'injury_clinical', 'availability'];

/* Only rows the TRIGGER wrote. audit_log already held rows from before 0085 —
   app-written ones with actions like `injury_clinical.read` and
   `availability.set` — and judging freshness against those would report a pass
   for a trigger that had never fired. The trigger's action is always
   <table>.<insert|update|delete>. */
const TRIGGER_ACTION = '^(injuries|injury_clinical|availability)\\.(insert|update|delete)$';
const FRESH_MINUTES = 120;

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
let failures = 0;
const verdict = (state, label, detail) => {
  if (state === 'FAIL') failures += 1;
  console.log(`  ${state.padEnd(12)} ${label}${detail ? `\n${' '.repeat(15)}${detail}` : ''}`);
};

await client.connect();
console.log(`\nDatabase: ${new URL(url.replace(/^postgres(ql)?:/, 'http:')).host}`);

try {
  await client.query('begin');
  await client.query('set transaction read only');

  const head = await client.query(
    'select version from supabase_migrations.schema_migrations order by version desc limit 1',
  );
  console.log(`Migration head: ${head.rows[0]?.version ?? 'unknown'}\n`);

  /* ---------------------------------------------------------------- 1. sessions */
  console.log('1. auth.sessions — does a sign-in record the person or the function?\n');

  const allSessions = await client.query(`
    select s.created_at, s.ip::text as ip, s.user_agent, u.email
    from auth.sessions s join auth.users u on u.id = s.user_id
    order by s.created_at desc
    limit 12
  `);
  const excluded = allSessions.rows.filter((r) => TEST_AGENT.test(r.user_agent ?? ''));
  const sessions = { rows: allSessions.rows.filter((r) => !TEST_AGENT.test(r.user_agent ?? '')).slice(0, 8) };
  if (excluded.length > 0) {
    console.log(`   (excluding ${excluded.length} diagnostic sign-in(s) this script's own probes created)\n`);
  }

  if (sessions.rows.length === 0) {
    verdict('INCONCLUSIVE', 'no sessions at all — nobody has signed in, so there is nothing to judge');
  } else {
    console.log('   the most recent sign-ins:');
    for (const r of sessions.rows) {
      const kind = FUNCTION_AGENT.test(r.user_agent ?? '') ? 'function' : 'browser';
      console.log(
        `     ${new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' ')}  ` +
          `${String(r.ip).padEnd(20)} ${kind.padEnd(9)} ${String(r.user_agent ?? '—').slice(0, 46)}`,
      );
    }
    console.log('');

    const newest = sessions.rows[0];
    const browserSessions = sessions.rows.filter((r) => !FUNCTION_AGENT.test(r.user_agent ?? ''));

    if (!FUNCTION_AGENT.test(newest.user_agent ?? '')) {
      verdict('PASS', 'the newest sign-in carries a real browser user agent, not `node`',
        `ip ${newest.ip}`);
    } else if (browserSessions.length > 0) {
      verdict('INCONCLUSIVE',
        'the NEWEST session still reads `node`, but a browser session exists further down.',
        'If that newest one is older than the deploy this is expected; sign in again and re-run.');
    } else {
      verdict('FAIL',
        'every recent session still reads `node` — the visitor is not reaching Supabase.',
        'Sign in through fydr.app (not a magic link) and re-run before concluding.');
    }

    const distinctFnIps = new Set(
      sessions.rows.filter((r) => FUNCTION_AGENT.test(r.user_agent ?? '')).map((r) => r.ip),
    );
    if (distinctFnIps.size > 1) {
      console.log(
        `\n   note: ${distinctFnIps.size} distinct addresses among the \`node\` rows — that is the ` +
          'symptom the item described, one platform reading as several origins.',
      );
    }
  }

  /* ------------------------------------------------------------------ 2. audit */
  console.log('\n2. audit_log — does editing an injury leave a trail?\n');

  const triggers = await client.query(`
    select c.relname as table_name
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
    where not t.tgisinternal and t.tgname like '%_audit'
      and c.relname = any($1)
    order by c.relname
  `, [AUDITED_TABLES]);
  const attached = triggers.rows.map((r) => r.table_name);
  const missing = AUDITED_TABLES.filter((t) => !attached.includes(t));
  if (missing.length === 0) verdict('PASS', `the trigger is attached to all three tables (${attached.join(', ')})`);
  else verdict('FAIL', `trigger missing on: ${missing.join(', ')}`, 'migration 0085 has not been applied here');

  const fresh = await client.query(`
    select occurred_at, action, entity_type, actor_id, actor_role::text as actor_role,
           athlete_id, ip_address::text as ip, metadata
    from audit_log
    where entity_type = any($1) and action ~ $2
    order by occurred_at desc
    limit 5
  `, [AUDITED_TABLES, TRIGGER_ACTION]);

  if (fresh.rows.length === 0) {
    verdict('FAIL', 'no TRIGGER-written audit rows for these tables at all',
      'Edit an injury in the app, then re-run. Rows from before 0085 are deliberately not counted here.');
  } else {
    console.log('   the most recent TRIGGER-written clinical/availability writes:');
    for (const r of fresh.rows) {
      console.log(
        `     ${new Date(r.occurred_at).toISOString().slice(0, 16).replace('T', ' ')}  ` +
          `${String(r.action).padEnd(26)} role=${String(r.actor_role ?? '—').padEnd(22)} ip=${r.ip ?? '—'}`,
      );
    }
    console.log('');

    const newest = fresh.rows[0];
    const ageMin = (Date.now() - new Date(newest.occurred_at).getTime()) / 60000;

    if (ageMin > FRESH_MINUTES) {
      verdict('INCONCLUSIVE',
        `the newest audit row is ${Math.round(ageMin / 60)}h old, so it may predate this check.`,
        'Edit an injury now and re-run to prove the trigger fires today.');
    } else {
      verdict('PASS', `an audit row was written ${Math.round(ageMin)} minutes ago — the trigger is firing`);
    }

    /* Attribution is the whole point: the 2026-09-07 incident had a known
       account and no record of WHERE the write came from. */
    verdict(newest.actor_id ? 'PASS' : 'FAIL', 'the newest row names an actor');
    verdict(newest.actor_role ? 'PASS' : 'FAIL', `and a role (${newest.actor_role ?? 'none'})`);
    verdict(newest.athlete_id ? 'PASS' : 'FAIL', 'and the athlete it concerns');

    if (!newest.ip) {
      verdict('INCONCLUSIVE', 'no ip on the newest row.',
        'Expected for a write made by a server route or a job; a write from the app in a browser should carry one.');
    } else {
      verdict('PASS', `and the address it came from (${newest.ip})`);
    }

    /* The disclosure rule: audit_log is sport-scientist readable and clinical
       detail is separately gated, so metadata must name fields, never values. */
    const leaks = await client.query(`
      select count(*)::int as n from audit_log
      where entity_type = 'injury_clinical'
        and (metadata ? 'diagnosis' or metadata ? 'clinical_notes' or metadata ? 'treatment_plan')
    `);
    verdict(leaks.rows[0].n === 0 ? 'PASS' : 'FAIL',
      'no clinical VALUE has been copied into audit_log',
      leaks.rows[0].n === 0 ? undefined : `${leaks.rows[0].n} row(s) carry a clinical field as metadata`);
  }

  await client.query('rollback');
} finally {
  await client.end();
}

console.log(failures === 0
  ? '\nAll checks passed (INCONCLUSIVE results are not failures — read what each one asks for).\n'
  : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
