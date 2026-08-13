/* backfill-compliance-expectations.mjs
 *
 * One-off backfill for the gap migration 0044 closes: compliance_expectations had no
 * generator at all until that migration, so it was frozen at whatever the seed's last
 * bulk insert covered (5 August 2026 on this project) while the real world moved on.
 * This calls the same generate_compliance_expectations(org, date) function the new
 * nightly cron job calls, once per active organisation per day in [--from, --to]
 * inclusive. Idempotent by construction (0044's own anti-join), so it is safe to run
 * more than once and safe to overlap with dates that already have rows — it only ever
 * fills the actual gap.
 *
 * Run: set -a && source .env.local && set +a && \
 *   node scripts/backfill-compliance-expectations.mjs --from 2026-08-06 --to 2026-08-13
 */

import pg from 'pg';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []),
);

if (!args.from || !args.to) {
  console.error('Usage: node scripts/backfill-compliance-expectations.mjs --from YYYY-MM-DD --to YYYY-MM-DD');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL });
await client.connect();

const orgsRes = await client.query(
  `select id, name, timezone from public.organisations where deleted_at is null order by name`,
);

let totalInserted = 0;
for (const org of orgsRes.rows) {
  let orgInserted = 0;
  // Cast to text in SQL, not left to the JS driver: node-postgres parses a bare `date`
  // column as a local-midnight JS Date, and .toISOString() then renders it in UTC, which
  // silently shifts the calendar day backward by one on any machine running east of UTC
  // (BST included) — caught live while building this script, the same trap 0044's own
  // header describes hitting during development. Casting to ::text in SQL sidesteps the
  // driver's date parsing entirely.
  const dates = await client.query(
    `select (generate_series($1::date, $2::date, interval '1 day')::date)::text as d`,
    [args.from, args.to],
  );
  for (const { d: dateText } of dates.rows) {
    const { rows } = await client.query(
      `select public.generate_compliance_expectations($1::uuid, $2::date) as n`,
      [org.id, dateText],
    );
    const n = rows[0].n;
    orgInserted += n;
    if (n > 0) {
      console.log(`  ${org.name} ${dateText}: +${n}`);
    }
  }
  console.log(`${org.name} (${org.id}): ${orgInserted} rows inserted across ${args.from}..${args.to}`);
  totalInserted += orgInserted;
}

console.log(`\nTotal inserted: ${totalInserted}`);
await client.end();
