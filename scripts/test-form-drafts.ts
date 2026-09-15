/* A part-filled form survives — PATTERN-S6 C3, ruled 2026-09-13 (batch B9),
 * built 2026-09-14: the three athlete entry forms hold their answers on the
 * phone per form instance (lib/formDraft.ts, the gym logger's own mechanism),
 * restore them on the way back in after a session expiry, and clear them when
 * sent. Pins the shape rather than the storage: a key per instance (never one
 * key for "the wellness form"), restore in an effect, clear on submit, and the
 * hook's one ordering rule — the mirror never runs before the restore.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const hook = strip(readFileSync('src/lib/formDraft.ts', 'utf8'));
console.log('the hook');
assert(/'fydr-draft-'/.test(hook), 'one prefix, so a draft is recognisable in storage');
assert(/const \[ready, setReady\] = useState\(false\)/.test(hook) && /if \(key === null \|\| !ready\) return;/.test(hook), 'the mirror waits for the restore (ready flips in the same batch as the restored answers)');
assert(/try \{[\s\S]*localStorage\.getItem[\s\S]*\} catch/.test(hook) && /try \{[\s\S]*localStorage\.setItem[\s\S]*\} catch/.test(hook), 'every storage access is guarded — a private window throws');
assert(/hasContent\(value\) \? value : null/.test(hook), 'an emptied form removes its draft rather than holding an empty one');

const forms: { file: string; keyPattern: RegExp; label: string }[] = [
  { file: 'src/components/CheckInForm/CheckInForm.tsx', keyPattern: /`check-in-\$\{athleteId\}-\$\{entryDate\}`/, label: 'the wellness check-in, per athlete and day' },
  { file: 'src/components/RpeForm/RpeForm.tsx', keyPattern: /`rating-\$\{athleteId\}-\$\{sessionId\}`/, label: 'the session rating, per athlete and session' },
  { file: 'src/components/NutritionCheckinForm/NutritionCheckinForm.tsx', keyPattern: /`nutrition-check-in-\$\{athleteId\}-\$\{weekStart\}`/, label: 'the weekly nutrition check-in, per athlete and week' },
];
for (const f of forms) {
  console.log(`\n${f.label}`);
  const src = strip(readFileSync(f.file, 'utf8'));
  assert(/useFormDraft\(/.test(src), 'holds a draft');
  assert(f.keyPattern.test(src), 'keyed per instance, never per form');
  const clearAt = src.indexOf('clearDraft(');
  const mutateAt = src.indexOf('submitMutation.mutate(parsed.data)');
  assert(clearAt > -1 && mutateAt > -1 && clearAt < mutateAt, 'cleared when sent, before the send is queued');
}
const nutrition = strip(readFileSync('src/components/NutritionCheckinForm/NutritionCheckinForm.tsx', 'utf8'));
assert(/correction \? null : `nutrition-check-in-/.test(nutrition), 'a correction starts from the sent entry, not from a draft');

const gym = strip(readFileSync('src/components/GymSessionLogger/GymSessionLogger.tsx', 'utf8'));
assert(/fydr-gym-draft-\$\{gymSessionLogId\}/.test(gym), 'the gym logger keeps its own per-log draft, the mechanism the ruling names');

/* EVERY FORM, AND WHEN A DRAFT DIES — decision-batch-2026-09-15-pm.md #2
   (Isabella, 15 Sept 2026): the staff forms hold a draft too; every draft
   is cleared on sign-out; a staff draft is cleared at the end of the
   working day whether or not anybody signs out; the sign-in button does
   not read "Sign in and send". */
console.log('\nthe staff forms hold a draft, dated with the club\'s day');
const staffForms: { file: string; keyPattern: RegExp; label: string }[] = [
  { file: 'src/components/NewInjuryForm/NewInjuryForm.tsx', keyPattern: /`new-injury-\$\{initialAthleteId \?\? 'any'\}`/, label: 'the injury form' },
  { file: 'src/components/NewSessionForm/NewSessionForm.tsx', keyPattern: /`new-session-\$\{defaultDate\}`/, label: 'a new session' },
  { file: 'src/components/ThresholdEditorForm/ThresholdEditorForm.tsx', keyPattern: /'new-threshold'/, label: 'a new threshold' },
];
for (const f of staffForms) {
  console.log(`  ${f.label}`);
  const src = strip(readFileSync(f.file, 'utf8'));
  assert(/useFormDraft\(/.test(src), 'holds a draft');
  assert(f.keyPattern.test(src), 'keyed per instance');
  assert(/\{ day: (today|todayIso\(timezone\)) \}/.test(src), 'dated with the club\'s day, so it is swept after it');
  assert(/clearDraft\(draftKey\);\s*router\.push\(/.test(src), 'cleared when sent, before the navigation');
}
assert(/today=\{todayIso\(timezone\)\}/.test(strip(readFileSync('src/app/(staff)/settings/thresholds/new/page.tsx', 'utf8'))), 'the thresholds page hands the form the club\'s day');

console.log('\nwhen a draft dies');
assert(/export function clearAllDrafts\(\)/.test(hook) && /GYM_PREFIX = 'fydr-gym-draft-'/.test(hook), 'clearAllDrafts sweeps every draft, the gym logger\'s included');
assert(/export function clearStaleDrafts\(today: string\)/.test(hook) && /parsed\.day !== today/.test(hook), 'clearStaleDrafts removes every dated draft from another day');
assert(/if \(parsed\.day !== day\) \{\s*window\.localStorage\.removeItem\(PREFIX \+ key\);\s*return null;/.test(hook), 'a dated draft read on another day is removed, not restored');
const signOut = strip(readFileSync('src/app/auth/sign-out/route.ts', 'utf8'));
assert(/\/login\?signed_out=1/.test(signOut), 'the sign-out route sends the browser to /login?signed_out=1');
const login = strip(readFileSync('src/app/login/page.tsx', 'utf8'));
assert(/sp\.signed_out === '1'/.test(login) && /\{signedOut \? <DraftsClearedOnSignOut \/> : null\}/.test(login), 'and the login page clears every draft only then — never on an expired session\'s ?next=');
assert(/clearAllDrafts\(\)/.test(strip(readFileSync('src/components/DraftsClearedOnSignOut/DraftsClearedOnSignOut.tsx', 'utf8'))), 'DraftsClearedOnSignOut calls clearAllDrafts');
const housekeeping = strip(readFileSync('src/components/DraftHousekeeping/DraftHousekeeping.tsx', 'utf8'));
assert(/clearStaleDrafts\(today\)/.test(housekeeping) && /setTimeout\(\(\) => clearStaleDrafts\('__ended__'\)/.test(housekeeping), 'DraftHousekeeping sweeps on load and at the club\'s midnight');
const staffLayout = strip(readFileSync('src/app/(staff)/layout.tsx', 'utf8'));
assert(/<DraftHousekeeping today=\{today\} msToMidnight=\{msToMidnight\} \/>/.test(staffLayout) && /zonedTimeToUtcIso\(addDays\(today, 1\), '00:00', timezone\)/.test(staffLayout), 'mounted by the staff layout with the club\'s day and its next midnight, computed server-side in the club\'s zone');
assert(!/Sign in and send/.test(readFileSync('src/app/login/page.tsx', 'utf8')) && !/Sign in and send/.test(readFileSync('src/components/LoginForm/LoginForm.tsx', 'utf8')), 'the sign-in button does not read "Sign in and send" — the draft is restored, not sent');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
