/* ATH-ADULT-09 C6 and ATH-ADULT-10 C3 (2026-09-12): the session summary.
 * Unit tests for lib/gymSummary.ts, then source guards on the read, the
 * page and the logger's two summaries — complete, and finished early.
 */
import { readFileSync } from 'node:fs';
import { sessionVolumeKg, bestSetsByExercise, newBests, setsLine, formatKg, minutesBetween, beats } from '@/lib/gymSummary';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

const S = (exercise_id: string, set_number: number, reps: number | null, load: number | null, is_warmup = false) =>
  ({ exercise_id, set_number, reps_completed: reps, load_kg: load, is_warmup });

console.log('MET-041 session volume');
{
  assert(sessionVolumeKg([S('sq', 1, 8, 100), S('sq', 2, 8, 102.5), S('rdl', 1, 8, 80)]) === 2260, 'Σ load × reps: 800 + 820 + 640 = 2260');
  assert(sessionVolumeKg([S('sq', 1, 8, null), S('nc', 1, 10, 0)]) === 0, 'a set without a load counts nothing; a bodyweight set is 0 × reps');
  assert(sessionVolumeKg([]) === 0, 'no sets, 0');
  assert(formatKg(7290) === '7,290' && formatKg(102.5) === '102.5', 'formatted with a thousands separator, one decimal at most');
}

console.log('\nMET-040 best set');
{
  const best = bestSetsByExercise([S('sq', 1, 8, 100), S('sq', 2, 8, 102.5), S('sq', 3, 6, 102.5), S('sq', 0, 10, 60, true), S('nc', 1, 10, 0), S('rdl', 1, 0, 80)]);
  assert(best.get('sq')?.load_kg === 102.5 && best.get('sq')?.reps === 8, 'the heaviest load; at the same load, the more reps');
  assert(!best.has('nc'), 'a bodyweight (0 kg) set is not a lift');
  assert(!best.has('rdl'), 'a zero-rep set is a failed attempt, not a best');
  assert(beats({ load_kg: 100, reps: 9 }, { load_kg: 100, reps: 8 }) && !beats({ load_kg: 100, reps: 8 }, { load_kg: 100, reps: 8 }), 'beats: more reps at the same load; equal is not a best');
}

console.log('\nnew bests against what was logged before today');
{
  const priors = new Map([
    ['sq', { load_kg: 100, reps: 8, entry_date: '2026-08-21' }],
    ['rdl', { load_kg: 90, reps: 8, entry_date: '2026-08-21' }],
  ]);
  const sets = [S('sq', 1, 8, 102.5), S('rdl', 1, 8, 80), S('split', 1, 10, 24)];
  const nb = newBests(['sq', 'rdl', 'split'], sets, priors);
  assert(nb.length === 1 && nb[0]?.exercise_id === 'sq' && nb[0]?.best.load_kg === 102.5 && nb[0]?.prior.entry_date === '2026-08-21', 'Back squat 102.5 × 8 beats 100 × 8 on 21 Aug; the RDL did not; the split squat has nothing to beat');
  assert(newBests(['sq'], [S('sq', 1, 8, 100)], priors).length === 0, 'equalling the prior is not a best');
  assert(newBests(['sq', 'sq'], sets, priors).length === 1, 'an exercise appearing twice in the order is counted once');
}

console.log('\nthe sets line');
{
  assert(setsLine([S('sq', 1, 8, 102.5), S('sq', 2, 8, 102.5), S('sq', 3, 8, 102.5)]) === '102.5 kg × 8, 8, 8', '"102.5 kg × 8, 8, 8"');
  assert(setsLine([S('nc', 2, 10, 0), S('nc', 1, 10, null)]) === '× 10, 10', 'bodyweight: "× 10, 10", in set order');
  assert(setsLine([S('sq', 1, 8, 100), S('sq', 2, 8, 102.5)]) === '100 kg × 8 · 102.5 kg × 8', 'mixed loads, each set named');
  assert(setsLine([]) === 'Not logged', 'nothing logged reads "Not logged" — never a dash, never a zero');
  assert(minutesBetween('2026-09-12T10:00:00Z', '2026-09-12T10:52:20Z') === 52 && minutesBetween('2026-09-12T10:00:00Z', null) === null, '52 min; null without a completion');
}

console.log('\nthe read');
{
  const q = strip(read('src/lib/queries/programmes.ts'));
  assert(/export async function fetchPersonalBestsBefore\(/.test(q), 'fetchPersonalBestsBefore exists');
  assert(/\.lt\('entry_date', beforeDate\)/.test(q) && /\.eq\('status', 'complete'\)/.test(q), 'over complete sessions strictly before the date');
  assert(/\.eq\('is_warmup', false\)[\s\S]{0,80}\.gt\('load_kg', 0\)[\s\S]{0,40}\.gt\('reps_completed', 0\)/.test(q), 'working sets only — the same definition as the coach\'s band');
  assert(/beats\(candidate, prev\)/.test(q), 'the best is decided by the one rule in lib/gymSummary.ts');
}

console.log('\nthe page and the logger');
{
  const page = strip(read('src/app/(athlete)/gym/[sessionId]/page.tsx'));
  assert(/status === 'complete'\s*\?\s*fetchPersonalBestsBefore\(/.test(page) || /status === 'complete'[\s\S]{0,200}fetchPersonalBestsBefore\(/.test(page), 'the page reads prior bests only for a complete session');
  assert(/priorBests=\{/.test(page) && /completedAt=\{/.test(page), 'and passes them, with the completion time, to the logger');
  const l = strip(read('src/components/GymSessionLogger/GymSessionLogger.tsx'));
  assert(/Session complete · \{doneCount\} of \{totalSets\} sets/.test(l) && /Every prescribed set is logged and saved\./.test(l), 'complete: "Session complete · 12 of 12 sets" and the one sentence');
  assert(/Total volume/.test(l) && /Weight × reps across \{doneCount\} sets/.test(l) && /Sets done/.test(l), 'total volume first with its derivation, then sets done');
  assert(/Best you have logged/.test(l) && /Best before today \{formatKg\(nb\.prior\.load_kg\)\} kg × \{nb\.prior\.reps\} · \{formatDate\(nb\.prior\.entry_date, timezone\)\}/.test(l), '"Best before today 100 kg × 8 · 21 Aug" — checkable, not a compliment');
  assert(/Finished early · \{doneCount\} of \{totalSets\} sets/.test(l) && /are recorded as not logged, not as zero\./.test(l), 'early: a different title, and "not logged, not as zero"');
  assert(/gym-sum-early/.test(l) && !/gym-sum-totals[\s\S]{0,400}finishedEarly \?/.test(l.slice(l.indexOf('finishedEarly ? ('), l.indexOf('finishedEarly ? (') + 3000)), 'the early summary has no totals block');
  assert(/setsLine\(/.test(l) && /Not logged/.test(read('src/lib/gymSummary.ts')), 'rows read from setsLine, so an unlogged exercise reads "Not logged"');
  assert(/gym-sum-pill-short/.test(l), 'a short exercise carries the dashed pill');
  assert(/Correct a set/.test(l) && /setShowSets\(true\)/.test(l), '"Correct a set" reveals the logged sets beneath the summary');
  assert(/Back to today/.test(l) && /href="\/today"/.test(l), '"Back to today" is the primary way out');
  assert(!/This session is done\./.test(l), 'the old one-line "This session is done." is gone');
  const css = strip(read('src/styles/base.css'));
  assert(/\.gym-sum-num\s*\{[^}]*font-size:\s*var\(--fs-48\)/.test(css), 'the two totals at --fs-48');
  assert(/\.gym-sum-early\s*\{[^}]*border:\s*1px dashed var\(--border-strong\)/.test(css), 'the early card is dashed, like Finish early itself');
  assert(/\.gym-sum-pill-short\s*\{[^}]*dashed/.test(css), 'and the short pill');
  assert(!/border-inline-start:\s*3px/.test(css.slice(css.indexOf('.gym-sum'), css.indexOf('.gym-sum') + 3000)), 'no 3px bar (declined 2026-09-12)');
}

console.log('\nthe registry and the spec');
{
  const m = read('docs/metrics.md');
  assert(/## MET-040\. Best logged set/.test(m) && /## MET-041\. Session volume/.test(m), 'MET-040 and MET-041 are registered');
  const spec = read('docs/athlete/screens/05-gym-session.md');
  assert(/Session complete/.test(spec) && /Finished early/.test(spec) && /MET-040/.test(spec), '05-gym-session.md describes both summaries');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
