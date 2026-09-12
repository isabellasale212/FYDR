/* §0u (first bullet) — the gym prescription line no longer substitutes an
 * explanatory sentence into the load slot ("3 × 8 @ No 1RM test linked to
 * this exercise yet."). The fix the entry states: omit the "@ {load}" clause
 * when there is no load value; the reason still sits in the weight row.
 */
import { readFileSync } from 'node:fs';
import { loadValue, loadLabel, schemeLine } from '@/lib/gymPrescription';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const base = { sets: 3, reps_min: 8, reps_max: null, rest_seconds: 90, category: 'squat', load_basis: 'percent_1rm' as const, load_value: 80, resolved_load_kg: null, one_rm_linked: false, one_rm_test_date: null };
const TZ = 'Europe/London';

console.log('the scheme line');
{
  assert(schemeLine(base, TZ) === '3 × 8 · 90s rest', 'no 1RM linked: the line is "3 × 8 · 90s rest" — no "@", no sentence');
  assert(loadValue(base, TZ) === null && loadLabel(base, TZ) === 'No 1RM test linked to this exercise yet.', 'the reason is still there for the weight row');
  assert(schemeLine({ ...base, one_rm_linked: true }, TZ) === '3 × 8 · 90s rest' && loadLabel({ ...base, one_rm_linked: true }, TZ) === 'No one rep max on file. Log the load you lift.', 'linked but no result: same shape, the other sentence');
  assert(schemeLine({ ...base, resolved_load_kg: 100, one_rm_linked: true, one_rm_test_date: '2026-08-21' }, TZ) === '3 × 8 @ 100 kg (80% of your 1RM, tested Fri 21 Aug) · 90s rest', 'a resolved 1RM load is on the line');
  assert(schemeLine({ ...base, load_basis: 'absolute', load_value: 60 }, TZ) === '3 × 8 @ 60 kg · 90s rest', 'an absolute load is on the line');
  assert(schemeLine({ ...base, load_basis: 'absolute', load_value: null }, TZ) === '3 × 8 · 90s rest' && loadLabel({ ...base, load_basis: 'absolute', load_value: null }, TZ) === 'Load not set', 'an unset absolute load: no clause; "Load not set" in the weight row');
  assert(schemeLine({ ...base, load_basis: 'none', rest_seconds: null }, TZ) === '3 × 8', 'bodyweight, no rest: just the scheme');
  assert(schemeLine({ ...base, load_basis: 'rpe', load_value: 7, reps_max: 10 }, TZ) === '3 × 8–10 @ Target RPE 7 · 90s rest', 'an RPE target is a value');
  assert(schemeLine({ ...base, load_basis: 'percent_bw', load_value: 50 }, TZ) === '3 × 8 @ 50% bodyweight · 90s rest', 'a bodyweight percentage is a value');
}

console.log('\nthe logger reads it');
{
  const src = readFileSync('src/components/GymSessionLogger/GymSessionLogger.tsx', 'utf8');
  assert(/\{schemeLine\(ex, timezone\)\}/.test(src), 'the head renders schemeLine');
  assert(!/\{schemeLabel\(ex\)\} @ \{loadLabel\(ex, timezone\)\}/.test(src), 'and no longer "@ {loadLabel}"');
  assert(/import \{[^}]*loadLabel[^}]*\} from '@\/lib\/gymPrescription'/.test(src), 'the weight row still reads loadLabel from the shared module');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
