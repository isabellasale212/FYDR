/* §0at — gym tonnage is derived from the live sets, not stored (decided by
 * Isabella 2026-09-12). The proof is pgTAP 620 on the database; this pins the
 * source side so the derivation cannot be quietly undone or bypassed:
 *
 *   - 0106 redefines gym_session_logs_current with total_volume_kg as a
 *     filtered sum over live gym_set_logs (reps and load both present)
 *   - every reader of a session's tonnage goes through the view, none through
 *     the base table
 *   - the docs say so
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('0106: the view derives');
{
  const m = read('supabase/migrations/0106_gym_tonnage_derived.sql');
  assert(/create view public\.gym_session_logs_current with \(security_invoker = true\)/.test(m), 'gym_session_logs_current is recreated, security_invoker');
  assert(/select sum\(s\.volume_kg\)::numeric\(10,1\)[\s\S]{0,200}where s\.gym_session_log_id = l\.id[\s\S]{0,80}and s\.superseded_by is null[\s\S]{0,80}and s\.reps_completed is not null[\s\S]{0,60}and s\.load_kg is not null[\s\S]{0,40}\) as total_volume_kg/.test(m),
    'total_volume_kg is the sum of live sets with both reps and a load — null when none, never 0');
  assert(!/l\.total_volume_kg/.test(m), 'the base column is not selected');
  assert(/comment on column public\.gym_session_logs\.total_volume_kg is/.test(m) && /DEAD as a source/.test(m), 'and is commented as dead');
  assert(/grant select on public\.gym_session_logs_current to authenticated/.test(m), 'grants restated after the recreate');
  assert(/620_gym_tonnage_derived_test\.sql/.test(readFileSync('supabase/tests/620_gym_tonnage_derived_test.sql', 'utf8')), 'pgTAP 620 exists');
}

console.log('\nevery tonnage reader goes through the view');
{
  for (const p of ['src/lib/queries/programmes.ts', 'src/lib/queries/exportBuilder.ts', 'src/lib/queries/athleteReport.ts', 'src/lib/queries/squadWeeklyReport.ts', 'src/lib/queries/reports.ts', 'src/lib/queries/myDataExport.ts', 'src/app/(athlete)/my-data/page.tsx']) {
    const src = strip(read(p));
    assert(!/from\('gym_session_logs'\)\s*\.select\([^)]*total_volume_kg/.test(src), `${p.split('/').slice(-1)[0]} never reads total_volume_kg from the base table`);
  }
  const prog = strip(read('src/lib/queries/programmes.ts'));
  assert(/from\('gym_session_logs_current'\)\s*\.select\('id, entry_date, status, session_rpe, total_volume_kg, programme_session_id'\)/.test(prog), 'the history rows read it from the view');
  assert(!/total_volume_kg:\s*[^,\n]*\}\)\s*\.eq\('id'/.test(prog), 'and nothing in the app writes the base column on ordinary logging');
}

console.log('\nthe docs');
{
  assert(/derived, not\s*\n?stored/.test(read('docs/04-data-model.md')), '04-data-model.md §17.9 says the tonnage is derived');
  assert(/migration 0106/.test(read('docs/athlete/screens/06-my-data.md')), '06-my-data.md says where the gym row\'s tonnage comes from');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
