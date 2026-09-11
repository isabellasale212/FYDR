/* §0ah — a session cannot be created without a duration. Decided by Isabella
 * 2026-09-11 ("make duration required at creation"), built 2026-09-12.
 *
 * WHY. Since lib/rpeDue.ts (ATH-ADULT-02) a rating is due at
 * starts_at + (duration_min ?? 0) + 30 min, so a session with no duration is
 * due thirty minutes after kick-off — the athlete's Today says "Rate …" while
 * they are still on the pitch, and the RPE screen accepts it. NewSessionForm
 * is noValidate, the field had no `required`, and createSession inserted
 * whatever it was given.
 *
 * THE TWO BOUNDARIES, both pinned: the form refuses to submit without a
 * duration in its own declared range (5 to 240), focusing the field as it
 * does for a missing name; createSession refuses a null or non-positive
 * duration BEFORE any I/O, so a caller that bypasses the form is refused
 * too — exercised here for real against a database stub that would throw on
 * contact. The column stays nullable (existing rows, the template path — see
 * docs/overnight-questions-2026-09-12.md); the guard is at the boundary.
 */
import { readFileSync } from 'node:fs';
import { createSession } from '@/lib/queries/schedule';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('createSession refuses a missing duration before touching the database');
{
  /* A stub whose every method throws: if createSession reaches it, the
     refusal came too late (after a season lookup, or not at all). */
  const untouchable = new Proxy({}, { get: (_t, prop) => { throw new Error(`database touched via ${String(prop)}`); } }) as unknown as Parameters<typeof createSession>[0];
  const base = { title: 'Unit skills', sessionType: 'training', startsAt: '2026-09-14T09:00:00.000Z', location: null, mdOffset: null, groupIds: [] };
  const attempt = async (durationMin: unknown): Promise<string> => {
    try {
      const r = await createSession(untouchable, 'org', 'user', { ...base, durationMin: durationMin as number });
      return r.error ?? 'created';
    } catch (e) { return `threw: ${(e as Error).message}`; }
  };
  const nullResult = await attempt(null);
  assert(/duration/i.test(nullResult) && !/threw/.test(nullResult), `null → refused with a message, no I/O ("${nullResult}")`);
  assert(/duration/i.test(await attempt(undefined)) && !/threw/.test(await attempt(undefined)), 'undefined → refused');
  assert(/duration/i.test(await attempt(0)) && !/threw/.test(await attempt(0)), '0 → refused: a zero-length session is due the moment it starts');
  assert(/duration/i.test(await attempt(-30)), 'negative → refused');
  assert(/duration/i.test(await attempt(Number.NaN)), 'NaN → refused');
  assert(/duration/i.test(await attempt(12.5)), 'a fraction of a minute → refused (the column is an integer)');
  const sixty = await attempt(60);
  assert(/threw: database touched/.test(sixty), '60 → passes the check and reaches the database (the stub throws, which is the proof)');
}

console.log('\nthe form cannot submit without one');
{
  const form = strip(read('src/components/NewSessionForm/NewSessionForm.tsx'));
  const input = /<input\b[^>]*id="s-duration"[\s\S]*?\/>/.exec(form)?.[0] ?? '';
  assert(input !== '' && /\brequired\b/.test(input), 'the duration input carries `required`');
  assert(/min=\{5\}/.test(input) && /max=\{240\}/.test(input), 'and still declares 5 to 240');
  const onSubmit = /function onSubmit\(event[\s\S]*?\n  \}/.exec(form)?.[0] ?? '';
  assert(/durationRef\.current/.test(onSubmit) && /Set a duration between 5 and 240 minutes\./.test(onSubmit), 'onSubmit refuses an empty or out-of-range duration and focuses the field, as it does for a missing name');
  assert(/Number\.isInteger\(minutes\)/.test(onSubmit) && /minutes < 5 \|\| minutes > 240/.test(onSubmit), 'the refusal is the field\'s own range, whole minutes');
  assert(!/durationMin: duration \? Number\(duration\) : null/.test(form), 'the mutation no longer sends null when the field is cleared');
  assert(/durationMin: Number\(duration\)/.test(form), 'it sends the number');
  assert(/const durationRef = useRef<HTMLInputElement>\(null\)/.test(form) && /ref=\{durationRef\}/.test(input), 'the field is reachable for focus');
}

console.log('\nthe edit form is the same boundary');
{
  const form = strip(read('src/components/SessionEditForm/SessionEditForm.tsx'));
  const input = /<input\b[^>]*id="e-duration"[\s\S]*?\/>/.exec(form)?.[0] ?? '';
  assert(/\brequired\b/.test(input), 'the edit form\'s duration input carries `required`');
  assert(/Set a duration between 5 and 240 minutes\./.test(form) && /durationMin: Number\(duration\)/.test(form) && !/Number\(duration\) : null/.test(form), 'and its onSubmit refuses an empty or out-of-range duration — an edit cannot recreate the null');
  const schedule = strip(read('src/lib/queries/schedule.ts'));
  const update = /export async function updateSession\([\s\S]*?\n\}/.exec(schedule)?.[0] ?? '';
  assert(/if \(!Number\.isInteger\(input\.durationMin\) \|\| input\.durationMin <= 0\)/.test(update), 'updateSession refuses a non-positive duration too');
}

console.log('\nthe types and the spec agree');
{
  const schedule = strip(read('src/lib/queries/schedule.ts'));
  const typeBlock = /export type NewSessionInput = \{[\s\S]*?\n\};/.exec(schedule)?.[0] ?? '';
  assert(/durationMin: number;/.test(typeBlock) && !/durationMin: number \| null/.test(typeBlock), 'NewSessionInput.durationMin is a number, not number | null');
  const spec = read('docs/screens/09-new-session.md');
  assert(/\*\*Length\*\*, in minutes, 5 to 240, required/.test(spec), '09-new-session.md says the length is required');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
