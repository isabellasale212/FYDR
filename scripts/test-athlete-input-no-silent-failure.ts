/* Two athlete inputs failed silently. Neither may again.
 *
 * 1. GYM SET CORRECTION. Submitting an empty or negative value closed the panel
 *    exactly as a successful save does, left the data unchanged, and told the
 *    athlete nothing. The cause is in the database function: migration 0045's
 *    revise_gym_set_log reads the payload with
 *      coalesce((p_payload ->> 'load_kg')::numeric, v_original.load_kg)
 *    so NULL means "keep the original". The client sends null for an empty
 *    field — meaning "clear this" to the athlete — and the RPC succeeds having
 *    changed nothing. Success closed the panel. Nothing was wrong except the
 *    athlete's belief that their correction landed.
 *
 *    AND NEGATIVES WERE WORSE THAN SILENT. Neither input carried `min`, and
 *    gym_set_logs has no check constraint on reps_completed or load_kg — while
 *    volume_kg is `generated always as (coalesce(reps_completed,0) *
 *    coalesce(load_kg,0))`. A negative rep count would therefore have been
 *    accepted and produced NEGATIVE TONNAGE in a stored aggregate. So this
 *    validation is not only about telling the athlete; it is the only thing
 *    standing between a typo and a corrupted total.
 *
 * 2. REPORT A PROBLEM. The textarea carried maxLength={1000}, so a longer paste
 *    was truncated by the browser with no warning — and undetectably, because
 *    onChange only ever sees the already-truncated value. The 1000 is real
 *    (problem_reports has `check (char_length(body) <= 1000 ...)`), so the fix
 *    is not to raise it: it is to stop eating text. The limit is now enforced by
 *    refusing to send an over-long report and saying so, leaving every character
 *    the athlete wrote on screen for them to trim.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const blank = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' '))
   .replace(/\{\/\*[\s\S]*?\*\/\}/g, (c) => c.replace(/[^\n]/g, ' '))
   .replace(/\/\/.*$/gm, (c) => c.replace(/[^\n]/g, ' '));

/* ---------- 1. the gym set correction ---------- */
/* Until 2026-09-13 this section pinned GymSessionSetsList's own inline
   correction form: a typed reps/load pair, validated before the mutate, the
   panel closing only on success. ATH-ADULT-13 C2 made the LOGGER's correction
   the one correction component — the history's rows link to it — so the
   same promises are held there: the numbers come from the steppers (no
   free-text field, so nothing can be typed negative or blank; stepValue
   floors at 0), the save is bounded and surfaces the RPC's own refusal as a
   HumanError rather than swallowing it, and the panel closes only on
   success. */
const gym = blank(readFileSync('src/components/GymSessionLogger/GymSessionLogger.tsx', 'utf8'));
const list = blank(readFileSync('src/components/GymSessionSetsList/GymSessionSetsList.tsx', 'utf8'));

assert(!/reviseGymSetLog|useMutation|<input/.test(list),
  'the history list has no correction form of its own — its rows link to the logger (ATH-ADULT-13 C2)');
assert(/correctHref\(s\.id\)/.test(list), 'each row links to the logger\'s correction for that set');

const correctionMutation = /const correctionMutation = useMutation\(\{([\s\S]*?)\n  \}\);/.exec(gym)?.[1] ?? '';
assert(/withWriteTimeout\(/.test(correctionMutation), 'the logger\'s correction is bounded (never "Saving…" for ever)');
assert(/if \(result\.error\) throw new HumanError\(result\.error\);/.test(correctionMutation),
  'and a refusal from revise_gym_set_log is thrown, not swallowed');
const onSuccess = /onSuccess:\s*\(\)\s*=>\s*\{([\s\S]*?)\},/.exec(correctionMutation)?.[1] ?? '';
assert(/closeCorrection\(\)/.test(onSuccess), 'the correction closes only in onSuccess — a refused attempt stays open');
assert(/onError: \(err\) => setError\(toUserMessage\(err, 'athlete'\)\)/.test(correctionMutation),
  'and the refusal is shown in the athlete\'s words');

/* No typed numeric field to go negative or blank: the two numbers are the
   steppers', floored at zero. */
assert(/function stepValue\(/.test(gym) && /Math\.max\(0,/.test(gym), 'the stepper floors at zero — there is no field to type a negative into');

/* ---------- 2. report a problem ---------- */
const rep = blank(readFileSync('src/components/ProblemReportForm/ProblemReportForm.tsx', 'utf8'));

assert(!/maxLength=\{?\s*1000/.test(rep),
  'the textarea no longer carries maxLength — the browser must not eat the overflow');
assert(/BODY_MAX_CHARS/.test(rep), 'the limit is a named constant');
assert(/BODY_MAX_CHARS\s*=\s*1000/.test(rep),
  'and it is 1000, matching problem_reports\' own check constraint');
assert(/body\.length > BODY_MAX_CHARS/.test(rep),
  'the over-limit condition is computed from the real length, not the truncated one');
assert(/disabled=\{[^}]*BODY_MAX_CHARS/.test(rep) || /over\b/.test(rep),
  'Send refuses an over-long report rather than the DB rejecting it');
assert(/over/i.test(rep) && /role="alert"|form-error|warn/.test(rep),
  'and an over-limit message is visible, not just a disabled button');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
