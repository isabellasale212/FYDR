/* PATTERN-S3 / STAFF-SS-02-05 C4, approved 2026-09-12: before an
 * availability change lands, the screen lists who will read what — the
 * athlete by name, the coaches by role, medical staff and the sport
 * scientist — on both availability forms, as the step between the button
 * and the write.
 */
import { readFileSync } from 'node:fs';
let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('the audience');
{
  const a = strip(read('src/components/AvailabilityAudience/AvailabilityAudience.tsx'));
  assert(/role="group" aria-labelledby="avail-audience-title"/.test(a), 'a labelled group');
  assert(/<b>\{athleteName\}<\/b>/.test(a), 'the athlete by name');
  assert(/The coaches and the S&amp;C/.test(a) && /Medical staff and the sport scientist/.test(a), 'the coaches by role; medical staff and the sport scientist');
  assert(/Never a diagnosis, a mechanism or a protocol stage\./.test(a), 'the coaches\' row states the boundary');
  assert(/except the clinical notes/.test(a), 'the athlete\'s row states the one withheld thing');
  assert(/Confirm and update/.test(a) && />\s*Back\s*</.test(a), 'confirm and back');
}

console.log('\nboth forms step through it');
{
  for (const [p, linked] of [['src/components/SetAvailabilityForm/SetAvailabilityForm.tsx', 'injuryLinked={injuryId !== null}'], ['src/components/SetAvailabilityFormCoach/SetAvailabilityFormCoach.tsx', 'injuryLinked={false}']] as const) {
    const f = strip(read(p));
    const name = p.split('/').slice(-1)[0];
    assert(/const \[confirming, setConfirming\] = useState\(false\)/.test(f), `${name}: a confirming step`);
    assert(/onClick=\{\(\) => setConfirming\(true\)\}/.test(f), 'the button opens it, not the write');
    assert(/<AvailabilityAudience/.test(f) && f.includes(linked), `renders the audience (${linked})`);
    assert(/onConfirm=\{\(\) => mutation\.mutate\(\)\}/.test(f), 'Confirm is the write');
    assert(/onBack=\{\(\) => setConfirming\(false\)\}/.test(f), 'Back returns to the form');
    assert(/athleteName: string/.test(f), 'and the form knows the athlete\'s name');
  }
  for (const p of ['src/app/(staff)/injuries/[injuryId]/page.tsx', 'src/app/(staff)/squad/[athleteId]/page.tsx']) {
    assert(/athleteName=\{/.test(read(p)), `${p.split('/').slice(-2).join('/')} passes the name`);
  }
}

console.log('\nthe spec');
{
  assert(/who will read what/i.test(read('docs/screens/03-athlete-profile.md')), '03-athlete-profile.md states the step');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
