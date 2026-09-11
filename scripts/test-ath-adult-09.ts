/* ATH-ADULT-09 — the gym logger, the A items of the "Gym logger pattern"
 * board (2026-09-12). The board is a set-by-set rebuild; what is built here
 * is what moves onto its rules without changing what the screen does. The
 * record is docs/overnight-records-2026-09-12.md.
 *
 *   A3 structure from spacing: no border on the exercise card
 *   A4 the header never scrolls away
 * Not built: the one-accent chip states and the neutral deviation line —
 * composable, but they reverse the 2026-09-08 colour decisions that
 * 05-gym-session.md §13 records and test-gym-logger-redesign.ts pins (D4);
 * the 48px numbers and 56/52px targets (new tokens, B); the rebuild,
 * offline flush, Wake Lock, haptics, the summaries (C); "Not logged"
 * wording (D1: 12-13 owns My data's rows).
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const css = strip(read('src/styles/base.css'));
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

console.log('what is deliberately unchanged (D4 — the 2026-09-08 colour decisions stand until reversed)');
{
  assert(/--gym-rgb/.test(rule('.gym-set-key[data-logged]')), 'logged keys are still gym-tinted');
  assert(/--warn-pill-text/.test(rule('.gym-weight-label .n[data-warn]')), 'the "recommended" sub-line is still amber');
  assert(/background:\s*var\(--gym\)/.test(rule('.gym-progress-fill')), 'the progress fill is still gold');
}

console.log('\nA3/A4. spacing, and a pinned header');
{
  const card = rule('.gym-ex-card');
  assert(/border:\s*none/.test(card) && /background:\s*var\(--surf\)/.test(card), 'the exercise card is a white surface with no border');
  assert(/border-radius:\s*var\(--r-toggle\)/.test(card), 'on the athlete card radius');
  const head = rule('.gym-head');
  assert(/position:\s*sticky/.test(head) && /top:\s*0/.test(head) && /background:\s*var\(--phone-bg\)/.test(head) && /z-index/.test(head), 'the header is sticky on the shell ground');
  assert(/border-bottom:\s*1px solid var\(--hair\)/.test(head), 'and keeps its hairline — one of the two the board allows');
}

console.log('\nthe spec');
{
  const spec = read('docs/athlete/screens/05-gym-session.md');
  assert(/no border/i.test(spec) && /pinned|stays at the top|never scrolls away/i.test(spec), '05-gym-session.md describes the borderless card and the pinned header');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
