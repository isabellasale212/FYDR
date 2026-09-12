/* PATTERN-S6 — system states, the A and B items (2026-09-12). The record is
 * docs/overnight-records-2026-09-12.md.
 *
 *   A1 a send that worked changes the count in place, once — "3 entries sent
 *      at 12:04. Nothing is waiting." in the same status region; absent on
 *      the next load; never a toast
 *   A2 no toast on Today after an entry form — the list changing is the answer
 *   A3 the failure sentence is ATH-ADULT-03's: "That did not send — …"
 *   B1 the waiting line as a good-tone card (--wash-good / --border-good)
 *   B2 the conflict notice in the bad tone (--wash-bad / --border-bad)
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('A1 / B1 / B2 / B3 — the flusher');
{
  const f = strip(read('src/components/OutboxFlusher/OutboxFlusher.tsx'));
  assert(/const \[sentAt, setSentAt\] = useState<\{ count: number; at: string \} \| null>\(null\);/.test(f), 'the sent state: how many and when');
  assert(/if \(sent > 0\) \{\s*setSentAt\(\{\s*count: sent,\s*at: /.test(f), 'set only by a flush that sent something — keyed to the state, so a second online event with nothing to send shows nothing');
  assert(/sent at\{' '\}\s*<span className="num">\{sentAt\.at\}<\/span>\. Nothing is waiting\./.test(f), '"3 entries sent at 12:04. Nothing is waiting."');
  assert(/className="banner outbox-sent"/.test(f), 'as a plain --surf card, not a tone (B3)');
  assert(/className="banner outbox-waiting"/.test(f) && /saved on this phone and will send when\s*you have signal/.test(f), 'the waiting line keeps its sentence, on the good-tone card (B1)');
  assert(!/borderColor: 'var\(--warn\)'/.test(f) && /className="banner outbox-conflict"/.test(f) && /g g-bad/.test(f), 'the conflict notice is bad-toned, not warn (B2)');
  const rendered = f.slice(f.indexOf('return (\n    <>'));
  const statusRegions = rendered.match(/role="status"/g) ?? [];
  assert(statusRegions.length === 2 && /\) : sentAt \? \(/.test(rendered), 'one status region rendered at a time — the waiting line or the sent line, never both');
  assert(!/<Toast/.test(f), 'no toast anywhere in it');
  const css = strip(read('src/styles/base.css'));
  assert(/\.outbox-waiting\s*\{[^}]*background:\s*var\(--wash-good\)[^}]*border-color:\s*var\(--border-good\)/.test(css), '.outbox-waiting: --wash-good on --border-good');
  assert(/\.outbox-conflict\s*\{[^}]*background:\s*var\(--wash-bad\)[^}]*border-color:\s*var\(--border-bad\)/.test(css), '.outbox-conflict: --wash-bad on --border-bad');
  assert(/\.outbox-sent\s*\{[^}]*background:\s*var\(--surf\)/.test(css), '.outbox-sent: --surf');
  assert(!/\.outbox-(waiting|sent|conflict)\s*\{[^}]*(transition|animation)/.test(css), 'nothing animates');
}

console.log('\nA2 — no toast on Today');
{
  const today = strip(read('src/app/(athlete)/today/page.tsx'));
  assert(!/<Toast/.test(today) && !/toastMessageFor/.test(today), 'Today renders no Toast and has no toast copy');
  for (const [file, re] of [
    ['src/components/CheckInForm/CheckInForm.tsx', /router\.push\('\/today\?submitted=1'\)/],
    ['src/components/RpeForm/RpeForm.tsx', /\/today\?submitted=rpe/],
    ['src/components/NutritionCheckinForm/NutritionCheckinForm.tsx', /\/today\?submitted=nutrition/],
  ] as const) {
    assert(re.test(strip(read(file))), `${file.split('/').pop()} still returns to Today (the protected queue-then-Today behaviour)`);
  }
}

console.log('\nA3 — the failure sentence');
{
  const w = read('src/lib/writeErrors.ts');
  assert(/connectionAthlete:\s*'That did not send — check your signal and try again\. Your answer is still here\.'/.test(w), '"That did not send — check your signal and try again. Your answer is still here."');
  assert(!/Couldn’t save — check your signal/.test(w), 'the old sentence is gone');
}

console.log('\nthe record and the sheet');
{
  const rec = read('docs/overnight-records-2026-09-12.md');
  assert(/## PATTERN-S6 — System states/.test(rec) && /### Step 1, answered from the code/.test(rec), 'the S6 record answers Step 1');
  const sheet = read('docs/design-decisions-outstanding.md');
  assert(/\| PATTERN-S6 \| C10 \|/.test(sheet) && /\| PATTERN-S6 \| D3 \|/.test(sheet), 'C1–C10 and D1–D3 are on the sheet');
  const spec = read('docs/athlete/screens/01-today.md');
  assert(/Nothing is waiting/.test(spec), '01-today.md describes the sent line');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
