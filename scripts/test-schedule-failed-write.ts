/* PATTERN-S6 C6 — a failed write on the schedule undoes itself and says
 * where (2026-09-13). The board: "The block returns to the time the athletes
 * still have, keeps its accent bar, and the attempted position stays as a
 * dashed ghost reading 'Did not save' until the staff member acts. The notice
 * names both times and the count affected. Try again is the one control."
 * In this schedule a write happens at Publish (D1 declined: edits are held),
 * so the failed write is a session whose publish was refused — the change
 * stays held, the grid shows what the athletes have, the ghost shows what was
 * tried. D2 is settled the way the sheet recommended: the existing dashed
 * ghost and the words, no new token.
 *
 * The notice's sentence is pure (lib/scheduleFailedWrite.ts); the workspace,
 * the grid and the CSS are read from source. */
import { readFileSync } from 'node:fs';
import { failedWriteLine } from '@/lib/scheduleFailedWrite';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const css = strip(read('src/styles/base.css'));

console.log('1. the notice names both times and the count affected');
{
  const moved = failedWriteLine({ title: 'Gym A', kind: 'edit', was: { dow: '2026-09-07', start: 7 }, tried: { dow: '2026-09-07', start: 7.25 }, athletes: 30, error: 'This session changed since you opened it.' }, 'Europe/London');
  assert(moved === 'Gym A did not save — This session changed since you opened it. The athletes still have Mon 7 Sept · 07:00; you tried 07:15 · 30 athletes affected.', 'a move on the same day: both times, the day once, the count');
  const dayMove = failedWriteLine({ title: 'Gym A', kind: 'edit', was: { dow: '2026-09-07', start: 7 }, tried: { dow: '2026-09-08', start: 7 }, athletes: 30, error: 'That didn’t save. Try again in a moment.' }, 'Europe/London');
  assert(dayMove === 'Gym A did not save — That didn’t save. Try again in a moment. The athletes still have Mon 7 Sept · 07:00; you tried Tue 8 Sept · 07:00 · 30 athletes affected.', 'a move to another day names both days');
  const added = failedWriteLine({ title: 'Extras', kind: 'add', was: null, tried: { dow: '2026-09-09', start: 18 }, athletes: 14, error: 'No current season is set up for this club.' }, 'Europe/London');
  assert(added === 'Extras did not save — No current season is set up for this club. The athletes have nothing at Wed 9 Sept · 18:00 yet · 14 athletes affected.', 'a new session that did not land');
  const removal = failedWriteLine({ title: 'Team run', kind: 'remove', was: { dow: '2026-09-09', start: 9.5 }, tried: null, athletes: 29, error: 'That didn’t save — you may not have permission for this.' }, 'Europe/London');
  assert(removal === 'Team run did not save — That didn’t save — you may not have permission for this. The athletes still have Wed 9 Sept · 09:30 · 29 athletes affected.', 'a removal that did not land: the athletes still have it');
  assert(/1 athlete affected\.$/.test(failedWriteLine({ title: 'Rehab', kind: 'edit', was: { dow: '2026-09-07', start: 7 }, tried: { dow: '2026-09-07', start: 8 }, athletes: 1, error: 'x' }, 'Europe/London')), 'one athlete: singular');
  assert(/ · staff only\.$/.test(failedWriteLine({ title: 'Meeting', kind: 'edit', was: { dow: '2026-09-07', start: 7 }, tried: { dow: '2026-09-07', start: 8 }, athletes: 0, error: 'x' }, 'Europe/London')), 'nobody expected: staff only, never "0 athletes"');
}

console.log('\n2. the workspace: the change stays held, the grid shows what the athletes have, the ghost what was tried');
{
  const ws = strip(read('src/components/ScheduleGrid/ScheduleWorkspace.tsx'));
  assert(/const \[failed, setFailed\] = useState<Record<string, FailedWrite>>\(\{\}\)/.test(ws), 'failed writes are kept by session id');
  assert(/setFailed\(\{\}\);[\s\S]{0,400}const failures: \{ id: string; title: string; error: string \}\[\] = \[\];/.test(ws), 'cleared as a publish starts; each failure is recorded with its session');
  assert(/failures\.push\(\{ id, title: b\.title, error: res\.error \}\)/.test(ws) && /failures\.push\(\{ id: draft\.id, title: draft\.title \|\| 'New session', error: res\.error \}\)/.test(ws), 'for a removal, an edit and a draft alike');
  assert(/const displaySessions: EffectiveSession\[\] = useMemo\(/.test(ws) && /if \(f && f\.kind === 'edit'\) \{/.test(ws) && /const b = baseById\.get\(s\.id\);/.test(ws) && /dow: b\.dow, start: b\.start, mins: b\.mins/.test(ws), 'for display a failed edit is drawn from its BASE — the time the athletes still have — with its accent bar');
  assert(/const failedGhosts = useMemo\(/.test(ws) && /kind: 'failed'/.test(ws), 'and the attempted position is a ghost of kind failed');
  assert(/onClick=\{\(\) => void handlePublish\(\)\}[\s\S]{0,80}Try again/.test(ws) || /Try again[\s\S]{0,200}onClick=\{\(\) => void handlePublish\(\)\}/.test(ws), 'Try again is the one control, and it is the publish');
  assert(/failedWriteLine\(/.test(ws), 'the notice is the pure sentence');
  const grid = strip(read('src/components/ScheduleGrid/TimeGrid.tsx'));
  assert(/kind\?: 'removed' \| 'failed';/.test(grid), 'a ghost knows which it is');
  assert(/data-removed=\{g\.kind === 'failed' \? undefined : 'true'\}/.test(grid) && /data-failed=\{g\.kind === 'failed' \? 'true' : undefined\}/.test(grid), 'the grid marks the two apart');
  assert(/g\.kind === 'failed' \? 'Did not save' : /.test(grid) && /did not save — the athletes still have it where it was/.test(grid), '"Did not save" on the ghost and in its label');
}

console.log('\n3. the CSS: the same dashed ghost, the words say which (D2: no new token)');
{
  assert(/\.sg-block\[data-failed='true'\]\s*\{[^}]*border(-style)?:[^;]*dashed/.test(css), 'the failed ghost is dashed');
  assert(!/--line-dashed-failed/.test(css), 'no --line-dashed-failed token — the words carry the difference');
  assert(/\.sg-block\[data-failed='true'\] \.sg-block-time\s*\{[^}]*color:\s*var\(--bad-pill-text\)/.test(css) || /\.sg-block\[data-failed='true'\]\s*\{[^}]*--time:\s*var\(--bad-pill-text\)/.test(css), 'its "Did not save" line reads in the bad ink');
}

console.log('\n4. the spec');
{
  const spec = read('docs/screens/07-schedule.md');
  assert(/Did not save/.test(spec) && /Try again/.test(spec), '07-schedule.md describes the failed write');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
