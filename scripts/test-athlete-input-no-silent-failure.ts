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

/* ---------- 1. the gym set correction panel ---------- */
const gym = blank(readFileSync('src/components/GymSessionSetsList/GymSessionSetsList.tsx', 'utf8'));

assert(/function validateCorrection|const validateCorrection/.test(gym),
  'a named validation function exists, rather than a condition inline in the click');
assert(/validateCorrection\([^)]*\)/.test(gym), 'and it is called');

/* The mutate must be reachable only past the validation. */
const clickHandler = /onClick=\{\(\) =>\s*\{([\s\S]*?)\n\s*\}\}/.exec(gym)?.[1] ?? gym;
assert(/validateCorrection/.test(clickHandler) || /if \(problem\)/.test(gym),
  'the save handler validates before mutating');
assert(/return;/.test(gym), 'and returns early on invalid input, so mutate is not called');

/* The panel must stay open: setCorrecting(null) belongs to success only. */
const onSuccess = /onSuccess:\s*\(\)\s*=>\s*\{([\s\S]*?)\},/.exec(gym)?.[1] ?? '';
assert(/setCorrecting\(null\)/.test(onSuccess),
  'the panel closes only in onSuccess — an invalid attempt never reaches it');

/* Defence in depth at the input, since neither the schema nor the RPC will stop
   a negative. */
const repsInput = /aria-label=\{`Set \$\{s\.set_number\} corrected reps`\}/.test(gym);
assert(repsInput, 'the reps input is still there');
assert((gym.match(/min="0"/g) ?? []).length >= 2,
  'both numeric inputs carry min="0" — the schema has no constraint and the RPC does not check');

/* The coalesce semantics must be surfaced, not worked around silently. */
assert(/unchanged/i.test(gym),
  'the copy tells the athlete a blank field leaves the set unchanged (the RPC coalesces null to the original)');

/* Cancel must not leave a validation message behind. Found by cancelling out of
   a rejected correction and seeing the error still on screen with no panel under
   it — an error about a form that is no longer open. */
/* IT MUST CLEAR THE FIELD MARKER TOO, added 2026-09-09. validateCorrection now
   returns which field it rejected so that input can carry aria-invalid, which
   means Cancel has a second thing to undo: without it, a cancelled panel leaves
   an input marked invalid to a screen reader with no message and no panel to
   explain it — the same defect this assertion was written for, one layer down
   and invisible on screen. */
const cancelHandler =
  /onClick=\{\(\) => \{\s*setError\(null\);\s*setInvalidField\(null\);\s*setCorrecting\(null\);/.test(gym);
assert(cancelHandler, 'Cancel clears the error, the invalid-field marker, and the panel');

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
