/* PATTERN-S5 C1 (2026-09-13, migration 0111): a logged set keeps the
 * prescription it was logged against. The database half is pgTAP
 * (670_gym_set_prescription_snapshot_test.sql); this guards the app half —
 * the write carries the snapshot, every reader reads it from the row, the
 * words for its absence, and the specs. Regex reads of source with comments
 * stripped, plus the pure words function with values. */
import { readFileSync } from 'node:fs';
import { prescribedWords } from '@/lib/gymPrescribedWords';
import { GymSetLogInput } from '@/lib/validation/gym';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the migration and its test');
{
  const m = read('supabase/migrations/0111_gym_set_prescription_snapshot.sql');
  assert(/add column prescribed_reps\s+int,\s*add column prescribed_load_kg numeric\(6,2\),\s*add column prescribed_step_kg numeric\(4,2\);/.test(m), 'three nullable columns on gym_set_logs');
  assert(/check \(prescribed_load_kg is null or prescribed_load_kg >= 0\)/.test(m), 'non-negative, like load_kg (0095)');
  assert(/create or replace view public\.gym_set_logs_current with \(security_invoker = true\) as\s*select \* from public\.gym_set_logs\s*where superseded_by is null;/.test(m), 'the _current view re-expanded to carry them');
  assert(/v_original\.prescribed_reps, v_original\.prescribed_load_kg, v_original\.prescribed_step_kg/.test(m) && !/p_payload ->> 'prescribed/.test(m), 'a correction carries the original\'s snapshot and cannot take one from its payload');
  const t = read('supabase/tests/670_gym_set_prescription_snapshot_test.sql');
  assert(/update programme_exercises set load_value = 110/.test(t) && /still says 100/.test(t), 'the test edits the block and asserts the set is unmoved');
  assert(/permission denied for table gym_set_logs/.test(t), 'and that the athlete cannot rewrite it in place');
}

console.log('\n2. the write');
{
  const parsed = GymSetLogInput.safeParse({ id: '11111111-1111-4111-8111-111111111111', gym_session_log_id: '22222222-2222-4222-8222-222222222222', programme_exercise_id: null, exercise_id: '33333333-3333-4333-8333-333333333333', set_number: 1, reps_completed: 8, load_kg: 100, rpe: null });
  assert(parsed.success && parsed.data.prescribed_reps === null && parsed.data.prescribed_load_kg === null && parsed.data.prescribed_step_kg === null, 'an item queued before 0111 still parses, with no snapshot');
  const full = GymSetLogInput.safeParse({ id: '11111111-1111-4111-8111-111111111111', gym_session_log_id: '22222222-2222-4222-8222-222222222222', programme_exercise_id: null, exercise_id: '33333333-3333-4333-8333-333333333333', set_number: 1, reps_completed: 8, load_kg: 102.5, rpe: null, prescribed_reps: 8, prescribed_load_kg: 100, prescribed_step_kg: 2.5 });
  assert(full.success && full.data.prescribed_load_kg === 100 && full.data.prescribed_step_kg === 2.5, 'and one with a snapshot carries it');
  const neg = GymSetLogInput.safeParse({ id: '11111111-1111-4111-8111-111111111111', gym_session_log_id: '22222222-2222-4222-8222-222222222222', programme_exercise_id: null, exercise_id: '33333333-3333-4333-8333-333333333333', set_number: 1, reps_completed: 8, load_kg: 100, rpe: null, prescribed_load_kg: -1 });
  assert(!neg.success, 'a negative snapshot is refused by the validator too');
  const q = strip(read('src/lib/queries/programmes.ts'));
  assert(/prescribed_reps: input\.prescribed_reps,\s*prescribed_load_kg: input\.prescribed_load_kg,\s*prescribed_step_kg: input\.prescribed_step_kg,/.test(q), 'submitGymSetLog writes the three');
  const logger = strip(read('src/components/GymSessionLogger/GymSessionLogger.tsx'));
  assert(/prescribed_reps: prescribedReps\(ex\),\s*prescribed_load_kg: recommendedFor\(ex\),\s*prescribed_step_kg: ex\.weight_step_kg,/.test(logger), 'the logger snapshots the reference line\'s own numbers and the exercise\'s step at logging');
}

console.log('\n3. the readers');
{
  const q = strip(read('src/lib/queries/programmes.ts'));
  assert(/select\('id, programme_exercise_id, exercise_id, set_number, reps_completed, load_kg, rpe, prescribed_reps, prescribed_load_kg'\)/.test(q), 'fetchLoggedSets reads the snapshot');
  assert(/select\('id, exercise_id, set_number, reps_completed, load_kg, rpe, prescribed_reps, prescribed_load_kg'\)/.test(q) && /prescribed_reps: r\.prescribed_reps,\s*prescribed_load_kg: r\.prescribed_load_kg,/.test(q), 'fetchGymSessionSetDetails reads it from the row — no live join');
  const logger = strip(read('src/components/GymSessionLogger/GymSessionLogger.tsx'));
  assert(/correctingRow && correctingRow\.prescribed_load_kg !== null\s*\?\s*correctingRow\.prescribed_load_kg\s*:\s*recommendedFor\(card\)/.test(logger), 'a correction\'s reference line is the set\'s own snapshot');
  assert(prescribedWords({ prescribed_reps: 8, prescribed_load_kg: 100 }) === '100 kg × 8', 'words: load and reps');
  assert(prescribedWords({ prescribed_reps: 8, prescribed_load_kg: null }) === '8 reps', 'words: reps only (a bodyweight set)');
  assert(prescribedWords({ prescribed_reps: null, prescribed_load_kg: 100 }) === '100 kg', 'words: load only');
  assert(prescribedWords({ prescribed_reps: null, prescribed_load_kg: null }) === 'Not recorded', 'words: none — "Not recorded", never a dash or a zero');
  const list = strip(read('src/components/GymSessionSetsList/GymSessionSetsList.tsx'));
  assert(/<th scope="col" className="r">\s*Prescribed\s*<\/th>/.test(list) && /\{prescribedWords\(s\)\}/.test(list), 'the sets table carries a Prescribed column');
  assert(/Prescribed is what the set was asked for on the day, kept with\s*it — a programme changed since does not change it\./.test(list), 'and says what the column is');
  // The athlete's own CSV (/me/export) carried the two columns until 2026-09-13, when athlete self-export was removed by decision.
  const staff = strip(read('src/app/(staff)/settings/exports/generate/route.ts'));
  assert(/\['prescribed_reps', 'Prescribed reps'\],\s*\['prescribed_load_kg', 'Prescribed load \(kg\)'\],/.test(staff), 'so does the staff gym export');
}

console.log('\n4. the specs');
{
  assert(/prescribed_reps/.test(read('docs/athlete/screens/05-gym-session.md')) && /kept with it/.test(read('docs/athlete/screens/05-gym-session.md')), '05-gym-session.md: what is written');
  assert(/Prescribed/.test(read('docs/athlete/screens/09-one-gym-session-logged.md')) && /Not recorded/.test(read('docs/athlete/screens/09-one-gym-session-logged.md')), '09-one-gym-session-logged.md: the column and its words');
  assert(/prescribed_load_kg/.test(read('docs/04-data-model.md')), '04-data-model.md: the columns');
  assert(/0111/.test(read('docs/metrics.md')), 'metrics.md: MET-030 notes the snapshot');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
