/* PATTERN-S4 (schedule and week grid) — the A items built 2026-09-12 under
 * the standing rule. The board's headline (sessions live on create, no
 * publish) is D1 on the decision sheet; nothing here depends on it.
 */
import { readFileSync } from 'node:fs';
let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const ws = strip(read('src/components/ScheduleGrid/ScheduleWorkspace.tsx'));
const grid = strip(read('src/components/ScheduleGrid/TimeGrid.tsx'));
const panel = strip(read('src/components/ScheduleGrid/SelectedSessionPanel.tsx'));
const stats = strip(read('src/components/ScheduleGrid/WeekStatsPanel.tsx'));
const css = strip(read('src/styles/base.css'));

console.log('A1. the current view is a tab and says it is current');
assert(/<span className="sg-viewtab" role="tab" aria-selected="true" aria-current="page">/.test(ws), 'aria-current="page" on the selected tab');

console.log('\nA2. the legend carries all seven types');
assert(/\['training', 'gym', 'rehab', 'testing', 'match', 'recovery', 'meeting'\]/.test(grid), 'Meeting is in the legend');

console.log('\nA3. session minutes, not contact minutes');
assert(/session minutes · staff sessions excluded/.test(grid) && !/athlete contact minutes/.test(grid), 'the grid footer');
assert(/Session minutes per group/.test(stats) && !/Contact time per group/.test(stats), 'the per-group card');
assert(/Sessions and session minutes, not load/.test(stats) && !/contact minutes, not load/.test(stats), 'the comparison sub');
assert(/Session time is within 40 minutes/.test(stats) && !/Contact time is within/.test(stats), 'the normal-week line');

console.log('\nA5. the missing-group refusal states the consequence');
const form = strip(read('src/components/NewSessionForm/NewSessionForm.tsx'));
assert(/Choose at least one group\. Without a group, nobody is expected at this session, so it will not appear on any athlete’s Today\./.test(form.replace(/'/g, '’')) || /Choose at least one group\. Without a group, nobody is expected at this session, so it will not appear on any athlete(’|\\')s Today\./.test(form), 'the sentence');

console.log('\nA6. the primary says what it will make');
assert(/addLabel\(session\)/.test(panel) && /Add session · \$\{/.test(panel), '"Add session · Thu 10, 16:00, 60 min"');
assert(!/>\s*Add to \{weekday\}\s*</.test(panel), '"Add to {weekday}" is gone');

console.log('\nA7. read-only names its editor in a well');
assert(/<span className="sg-readonly-well">Read only\. The schedule is authored by the sport scientist and the coach\.<\/span>/.test(ws), 'the sentence, in the well');
assert(/\.sg-readonly-well\s*\{[^}]*border:\s*1px solid var\(--border\)[^}]*background:\s*var\(--surf2\)/.test(css), 'a --surf2 well in --border');

console.log('\nA8. a removed block carries a Removed pill');
assert(/<span className="pill pill-neutral sg-block-removed-pill">Removed<\/span>/.test(grid), 'the pill on the ghost');
assert(/\.sg-block-removed-pill\s*\{[^}]*text-decoration:\s*none/.test(css), 'exempt from the strike');

console.log('\nthe spec');
assert(/session minutes/.test(read('docs/screens/07-schedule.md')) && /Removed/.test(read('docs/screens/07-schedule.md')), '07-schedule.md records the words');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
