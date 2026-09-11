/* §0ai — the create-session form refuses an empty session: a type and at
 * least one group are required (duration is §0ah's). Decided by Isabella
 * 2026-09-11 for the overnight queue, built 2026-09-12.
 *
 * WHY. NewSessionForm validated name, date and time only. A session with no
 * group has no expected attendees, and the dashboard's "Sessions left to
 * run" and compliance both key on them; the form's own caption even said
 * "Nobody selected means nobody is named in it yet" and let it through.
 * The type could never actually be empty — the chips are single-select from
 * a 'training' default — so the type rule is enforced at the boundary, where
 * a caller that bypasses the form could still send anything.
 *
 * Two boundaries, as for the duration: the form refuses and focuses the
 * group chips; createSession refuses an unknown type or an empty group list
 * before any I/O.
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

console.log('createSession refuses an empty session before touching the database');
{
  const untouchable = new Proxy({}, { get: (_t, prop) => { throw new Error(`database touched via ${String(prop)}`); } }) as unknown as Parameters<typeof createSession>[0];
  const base = { title: 'Unit skills', startsAt: '2026-09-14T09:00:00.000Z', durationMin: 60, location: null, mdOffset: null };
  const attempt = async (input: Record<string, unknown>): Promise<string> => {
    try {
      const r = await createSession(untouchable, 'org', 'user', { ...base, sessionType: 'training', groupIds: ['g1'], ...input } as never);
      return r.error ?? 'created';
    } catch (e) { return `threw: ${(e as Error).message}`; }
  };
  const noGroups = await attempt({ groupIds: [] });
  assert(/group/i.test(noGroups) && !/threw/.test(noGroups), `no groups → refused with a message, no I/O ("${noGroups}")`);
  const badType = await attempt({ sessionType: 'yoga' });
  assert(/type/i.test(badType) && !/threw/.test(badType), `an unknown type → refused ("${badType}")`);
  const emptyType = await attempt({ sessionType: '' });
  assert(/type/i.test(emptyType) && !/threw/.test(emptyType), 'an empty type → refused');
  const ok = await attempt({});
  assert(/threw: database touched/.test(ok), 'a typed session with a group passes the checks and reaches the database (the stub throws, which is the proof)');
  const order = await attempt({ durationMin: 0, groupIds: [] });
  assert(/duration|group/i.test(order) && !/threw/.test(order), 'the checks sit together before any I/O whichever fails first');
}

console.log('\nthe form cannot submit without a group');
{
  const form = strip(read('src/components/NewSessionForm/NewSessionForm.tsx'));
  const onSubmit = /function onSubmit\(event[\s\S]*?\n  \}/.exec(form)?.[0] ?? '';
  assert(/selectedGroups\.size === 0/.test(onSubmit) && /Choose at least one group\./.test(onSubmit), 'onSubmit refuses with "Choose at least one group."');
  assert(/groupsRef\.current/.test(onSubmit), 'and moves focus to the group chips, as a missing name moves it to the name');
  assert(/const groupsRef = useRef<HTMLFieldSetElement>\(null\)/.test(form) && /ref=\{groupsRef\}/.test(form) && /tabIndex=\{-1\}/.test(form), 'the fieldset is focusable for that');
  assert(!/Nobody selected means nobody is named in it yet/.test(form), 'the caption no longer says an empty selection is allowed');
  assert(/At least one group is needed/.test(form), 'it says one is needed');
  assert(/useState<\(typeof SESSION_TYPES\)\[number\]>\('training'\)/.test(form), 'the type still starts on training and the single-select chips cannot clear it');
}

console.log('\nthe spec says so');
{
  const spec = read('docs/screens/09-new-session.md');
  assert(/at least one group/i.test(spec) && /refuses/.test(spec), '09-new-session.md: groups are required and the form refuses without one');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
