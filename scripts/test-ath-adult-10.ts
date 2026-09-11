/* ATH-ADULT-10 — finishing a gym session early, the A item of the gym logger
 * board (2026-09-12): the control is not shaped like logging a set. The
 * record is docs/overnight-records-2026-09-12.md.
 *
 *   A1 while sets are outstanding the finish control is a dashed neutral
 *      outline — no fill, --muted, 44px — not the accent primary; once every
 *      set is logged "Finish session" is the primary as before
 * Not built (C): moving it to the header, the confirmation, the early
 * summary.
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
const logger = strip(read('src/components/GymSessionLogger/GymSessionLogger.tsx'));
const rule = (sel: string): string => {
  const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[}\\n])\\s*${esc}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? '';
};

console.log('A1. finishing early is not shaped like logging a set');
{
  assert(/className=\{doneCount >= totalSets \? 'btn-primary' : 'btn-ghost gym-finish-early'\}/.test(logger), 'the control is the primary only once every set is logged; otherwise the dashed neutral outline');
  const early = rule('.gym-finish-early');
  assert(/border:\s*1px dashed var\(--border-strong\)/.test(early), 'dashed 1px --border-strong');
  assert(/background:\s*none/.test(early) || /background:\s*transparent/.test(early), 'no fill');
  assert(/color:\s*var\(--muted\)/.test(early), '--muted');
  assert(/min-height:\s*44px/.test(early), '44px');
  assert(/Finish session/.test(logger) && /Finish early · /.test(logger), 'both labels are unchanged');
  assert(/completeMutation\.mutate\(\)/.test(logger), 'and it is still the one call that completes a session');
}

console.log('\nthe spec');
{
  assert(/dashed/.test(read('docs/athlete/screens/05-gym-session.md')), '05-gym-session.md describes the dashed finish-early control');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
