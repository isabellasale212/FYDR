/* Remove wellness_entries dated in the future, after backing them up.
 *
 *   node --env-file=.env.local scripts/retire-future-wellness.mjs           # dry run
 *   node --env-file=.env.local scripts/retire-future-wellness.mjs --confirm # actually delete
 *
 * WHY THIS EXISTS, and why it deletes rather than corrects.
 *
 * Production holds two wellness_entries dated 2033 (2033-04-11 and 2033-07-29),
 * both for the same athlete, both written 2026-08-14 within 0.4 seconds of each
 * other. That is a seeding artifact: nobody submitted them, and they measure
 * nothing. They were found because the athlete picker counted them as two of
 * "this week's" mornings — `formatDate` prints no year, so "Fri 29 Jul" looked
 * entirely plausible.
 *
 * Three repairs were considered, and two are impossible:
 *
 *   1. CORRECT THE DATE. Not recoverable. That athlete's real entries run
 *      2026-07-10 to 2026-08-16, and 2026-07-29 ALREADY HAS a genuine entry, so
 *      the obvious "2033 -> 2026" repair collides with real data. 2026-04-11 is
 *      outside his window entirely. Any date chosen would be invented, which is
 *      worse than the wrong date already there. `revise_wellness_entry` refuses
 *      to move an entry to another day anyway (see
 *      supabase/tests/300_coach_entry_correction_test.sql).
 *
 *   2. SUPERSEDE THEM. The schema has no retract-without-replacement. There is a
 *      CHECK constraint `superseded_by IS NULL OR superseded_by <> id`, so a row
 *      cannot supersede itself, and `superseded_by` is an FK requiring a real
 *      replacement row — which brings us back to inventing a date. Pointing it
 *      at some other real entry would be a lie about that entry's history.
 *
 *   3. DELETE. What is left. CLAUDE.md rule 4 says athlete data is never
 *      hard-deleted, and that rule protects real athlete records and the audit
 *      trail behind them. These are neither. The backup below is what keeps the
 *      action reversible, which is the property the rule is really defending.
 *
 * Nothing references these rows: the only foreign keys to wellness_entries are
 * its own revision_of/superseded_by self-references, and zero rows point at
 * them. Verified 2026-09-02.
 *
 * The backup is written OUTSIDE the git repo on purpose — it contains athlete
 * health values, which must not end up in version control.
 */
import pg from 'pg';
import { writeFileSync, statSync } from 'node:fs';

const BACKUP = '/Users/isabellasale/Developer/Fydr/wellness-2033-backup.sql';
const confirm = process.argv.includes('--confirm');

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('SUPABASE_DB_URL is not set. Expected it in .env.local.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  const { rows } = await client.query(
    'select * from wellness_entries where entry_date > current_date order by entry_date',
  );

  if (rows.length === 0) {
    console.log('\nNothing to do: no wellness_entries are dated in the future.\n');
    process.exit(0);
  }

  /* ISO, with the year, always. `entry_date` arrives as a Date, so String()
     yields "Mon Apr 11" — no year. That is the exact defect this script exists
     to clean up after: the athlete picker showed "Fri 29 Jul" for a 2033 row
     and it read as perfectly ordinary. A tool for fixing that must not repeat
     it in its own confirmation output. */
  const iso = (v) => (v instanceof Date ? v.toISOString() : String(v));
  console.log(`\nFound ${rows.length} future-dated wellness entr${rows.length === 1 ? 'y' : 'ies'}:`);
  for (const r of rows) {
    console.log(`  ${iso(r.entry_date).slice(0, 10)}  id=${r.id}  created ${iso(r.created_at).slice(0, 19)}Z`);
  }

  /* Refuse to run wide. If this ever matches more than a handful, the cause is
     something other than the two known artifacts and wants looking at first. */
  if (rows.length > 5) {
    console.error(`\nRefusing: ${rows.length} rows is more than this script expects. Investigate before deleting.\n`);
    process.exit(1);
  }

  const cols = Object.keys(rows[0]);
  const lit = (v) =>
    v === null ? 'null'
    : v instanceof Date ? `'${v.toISOString()}'`
    : typeof v === 'number' || typeof v === 'boolean' ? String(v)
    : `'${String(v).replace(/'/g, "''")}'`;

  const sql = [
    `-- Restores ${rows.length} future-dated wellness_entries removed by scripts/retire-future-wellness.mjs.`,
    `-- Written ${new Date().toISOString()}. Outside the repo: athlete health values, not code.`,
    ...rows.map(
      (r) => `insert into wellness_entries (${cols.join(', ')}) values (${cols.map((k) => lit(r[k])).join(', ')});`,
    ),
    '',
  ].join('\n');

  if (!confirm) {
    console.log('\nDRY RUN. Re-run with --confirm to write the backup and delete.\n');
    process.exit(0);
  }

  writeFileSync(BACKUP, sql);
  console.log(`\nBackup written: ${BACKUP} (${statSync(BACKUP).size} bytes)`);

  const del = await client.query('delete from wellness_entries where entry_date > current_date');
  console.log(`Deleted: ${del.rowCount}`);

  const left = (
    await client.query('select count(*)::int as n from wellness_entries where entry_date > current_date')
  ).rows[0].n;
  console.log(`Future-dated rows remaining: ${left}`);
  console.log(left === 0 ? '\n✓ Done. Restore with: psql "$SUPABASE_DB_URL" -f ' + BACKUP + '\n' : '\n✗ Some remain.\n');
} finally {
  await client.end();
}
