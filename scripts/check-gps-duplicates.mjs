/* READ ONLY. Counts duplicate gps_records rows under the key the unique
 * constraint in G-25 would use: (org_id, athlete_id, record_date, session_id).
 * A unique constraint cannot be added over existing duplicates, so this has to
 * be answered before the migration is written, not after. Runs no DDL and no
 * writes of any kind. */
import pg from 'pg';
const url = process.env.SUPABASE_DB_URL;
if (!url) { console.error('SUPABASE_DB_URL is not set.'); process.exit(1); }
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (label, sql) => {
  const r = await c.query(sql);
  console.log(`\n== ${label}`);
  console.table(r.rows);
  return r.rows;
};
await q('total rows', 'select count(*)::int as gps_records from gps_records;');
await q('duplicate groups under (org, athlete, date, session)', `
  select count(*)::int as duplicate_groups,
         coalesce(sum(n - 1), 0)::int as surplus_rows
  from (
    select count(*) as n
    from gps_records
    group by org_id, athlete_id, record_date, session_id
    having count(*) > 1
  ) g;`);
await q('worst offenders', `
  select athlete_id, record_date, session_id, count(*)::int as copies
  from gps_records
  group by org_id, athlete_id, record_date, session_id
  having count(*) > 1
  order by count(*) desc
  limit 10;`);
await q('null session_id rows (the key would treat these as distinct)', `
  select count(*)::int as rows_with_null_session from gps_records where session_id is null;`);
await c.end();
