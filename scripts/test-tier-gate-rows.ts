/* The tier gate at the database (Isabella, decision batch 2026-09-13; migration
 * 0119): keep and hide is enforced at the row for the GPS import's tables, with
 * the subject access read path as a written, tested exception. This pins the
 * migration's shape and the exception's precondition — the SAR pack reads
 * through the service role, which RLS never applies to. The behaviour itself
 * is pgTAP 740. */
import { readFileSync } from 'node:fs';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the migration');
{
  const mig = read('supabase/migrations/0119_tier_gate_at_the_database.sql');
  const sql = mig.replace(/^\s*--.*$/gm, '');
  for (const policy of ['gps_records_staff_select', 'gps_records_staff_insert', 'gps_records_staff_update', 'import_batches_staff_select', 'import_batches_staff_insert', 'import_held_rows_importer_select', 'import_held_rows_importer_insert', 'import_held_rows_importer_update', 'athlete_import_aliases_importer_select', 'athlete_import_aliases_importer_insert']) {
    const i = sql.indexOf(`create policy ${policy}`);
    const body = i >= 0 ? sql.slice(i, sql.indexOf(';', i)) : '';
    assert(i >= 0 && /public\.auth_org_is_premium\(\)/.test(body), `${policy} carries auth_org_is_premium()`);
  }
  assert(!/create policy gps_records_self_select/.test(sql), 'the athlete\'s own read (gps_records_self_select, 0023) is not touched — the written exception');
  assert(!/create or replace function public\.auth_org_is_premium/.test(sql), '0061\'s helper is reused, not re-created');
  assert(/written, tested exception/i.test(mig) && /service role/i.test(mig) && /Article 15/.test(mig), 'the exception is written in the migration');
  const t = read('supabase/tests/740_tier_gate_at_the_database_test.sql');
  assert(/hidden, not an error/.test(t) && /Article 15 is theirs/.test(t) && /service-role path still reads every row/.test(t) && /kept and restored/.test(t), 'and tested: empty not error, the athlete\'s rows, the service role, restore on upgrade');
}

console.log('\n2. the exception\'s precondition');
{
  const sar = strip(read('src/lib/queries/sarPackAssembly.ts'));
  assert(/createAdminClient\(\)/.test(sar) && /admin\.from\('gps_records'\)/.test(sar), 'the SAR pack reads gps_records through the service-role client');
  assert(/Closed at the row, 13 September 2026, migration `0119/.test(read('docs/12-product-tiers.md')), '12-product-tiers.md §8 records it');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
