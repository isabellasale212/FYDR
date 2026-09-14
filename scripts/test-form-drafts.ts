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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
