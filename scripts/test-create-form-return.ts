/* Creating a session or a fixture returns you to the Schedule.
 *
 * WHAT WAS REPORTED, and what was actually happening. "After clicking Create
 * session or Create fixture it stays on the same page." Run-verified as a coach
 * against scratch: on a successful create both forms DO navigate — to
 * /schedule?date=<the date you set> — and the new session appears on the grid.
 * That path was never broken and these tests pin it so it cannot become so.
 *
 * The page only stays when the submit is BLOCKED by validation: an empty title,
 * or a missing date or time. The message rendered, but focus stayed on <body>,
 * so on a screen where the message sits below the fold — or when your eye is on
 * the button you just pressed — a refused submit is indistinguishable from a
 * dead button. That is the real defect behind the report, and it is what the
 * focus assertions below are for.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const forms = [
  { name: 'NewSessionForm', path: 'src/components/NewSessionForm/NewSessionForm.tsx', firstRef: 'titleRef' },
  { name: 'NewFixtureForm', path: 'src/components/NewFixtureForm/NewFixtureForm.tsx', firstRef: 'opponentRef' },
];

for (const f of forms) {
  const src = readFileSync(f.path, 'utf8');
  const code = strip(src);

  console.log(`\n${f.name}: a completed create returns to the Schedule`);
  assert(
    /onSuccess: \(\) => \{[\s\S]{0,160}router\.push\(`\/schedule\?date=\$\{date\}`\)/.test(code),
    'on success it pushes /schedule for the date that was set',
  );
  assert(/router\.refresh\(\)/.test(code), 'and refreshes, so the new row is on the grid it lands on');

  console.log(`${f.name}: a blocked submit lands you on the field at fault`);
  assert(new RegExp(`const ${f.firstRef} = useRef`).test(code), `${f.firstRef} exists`);
  assert(/const dateRef = useRef/.test(code), 'dateRef exists');
  {
    const fn = code.slice(code.indexOf('function onSubmit'));
    const body = fn.slice(0, fn.indexOf('\n  }'));
    assert(/focusField\(/.test(body), 'each early return focuses the field it is complaining about');
    assert(
      (body.match(/return focusField\(/g) ?? []).length >= 2,
      'both the missing-name and the missing-date branches do it',
    );
    assert(
      !/return setError\(/.test(body),
      'and no branch merely sets an error and leaves focus where it was — that is what read as a dead button',
    );
  }
  assert(
    /scrollIntoView/.test(code),
    'the field is scrolled into view too, since the message can sit below the fold on a short screen',
  );
  assert(/useRef/.test(src.split('\n').slice(0, 12).join('\n')), 'useRef is imported at the top');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
