/* ATH-ADULT-09 C4 (decision sheet group (c), 2026-09-12): queued sets are
 * retried from the logger itself and on the browser's `online` event, not
 * only by Today's OutboxFlusher — an athlete who loses signal mid-session
 * and gets it back never had to leave the screen to see their sets land.
 * The logger says what is waiting: "6 of 12 sets · 2 waiting to send".
 *
 * The retry is one function, lib/gymOutboxFlush.ts, shared by the flusher
 * and the logger — §0aa's fetch-before-conclude conflict guard travels with
 * it, so a set queued offline whose slot another tab has since filled is
 * still marked, never dropped.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('the one retry');
{
  const m = strip(read('src/lib/gymOutboxFlush.ts'));
  assert(/export async function flushGymSets\(/.test(m), 'flushGymSets is the shared retry');
  assert(/export function queuedGymSets\(sessionLogId: string\): number/.test(m), 'queuedGymSets counts what is waiting for one session');
  assert(/pendingGymSetLogs\(\)\.filter\(\(item\) => !item\.conflictAt/.test(m), 'a flagged conflict is never retried');
  assert(/sessionLogId/.test(m) && /item\.input\.gym_session_log_id === /.test(m), 'the logger can limit the retry to its own session');
  assert(/export async function resolveGymSetConflict\(/.test(m) && /classifyGymSetConflict\(/.test(m) && /markGymSetConflict\(item\.input\.id, live \? \{ \.\.\.live, \.\.\.naming \} : null\)/.test(m), "§0aa's resolver moved with it, unchanged");
  assert(/return \{ sent, queued/.test(m), 'it reports what it sent and what is still waiting');
  const f = strip(read('src/components/OutboxFlusher/OutboxFlusher.tsx'));
  assert(/await flushGymSets\(db, orgId, athleteId\)/.test(f) && !/for \(const item of gymSetItems\)/.test(f), "Today's flusher calls it rather than carrying its own gym loop");
}

console.log('\nthe logger');
{
  const l = strip(read('src/components/GymSessionLogger/GymSessionLogger.tsx'));
  assert(/flushGymSets\(createClient\(\), orgId, athleteId, \{ sessionLogId: gymSessionLogId \}\)/.test(l), 'the logger retries its own queued sets');
  assert(/window\.addEventListener\('online', /.test(l) && /window\.removeEventListener\('online', /.test(l), 'on the online event, and stops listening on leaving');
  assert(/setWaiting\(queuedGymSets\(gymSessionLogId\)\)/.test(l), 'and keeps the waiting count current');
  assert(/waiting > 0 \? \(/.test(l) && /\{waiting\} waiting to send/.test(l), '"· 2 waiting to send" on the progress row');
  assert(/onSettled: /.test(l) || /onError: \(err\) => \{[\s\S]{0,200}setWaiting\(queuedGymSets/.test(l), 'a failed log updates the count too');
  assert(/athleteId: string;/.test(l), 'the logger takes athleteId for the conflict lookup');
  const page = strip(read('src/app/(athlete)/gym/[sessionId]/page.tsx'));
  assert(/athleteId=\{athleteId\}/.test(page), 'the page passes it');
}

console.log('\nthe spec');
{
  const spec = read('docs/athlete/screens/05-gym-session.md');
  assert(/waiting to send/.test(spec) && /online/.test(spec), '05-gym-session.md §7 says the logger retries and shows what is waiting');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
