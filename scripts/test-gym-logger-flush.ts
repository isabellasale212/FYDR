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
  /* Since 2026-09-14 the whole flush is lib/outboxFlush.ts, which Today and
     the queue screen's Send now both run; it calls flushGymSets for the gym. */
  const f = strip(read('src/lib/outboxFlush.ts'));
  assert(/await flushGymSets\(db, orgId, athleteId\)/.test(f) && !/for \(const item of gymSetItems\)/.test(f), "the shared flush calls it rather than carrying its own gym loop");
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

console.log('\n§0bc (0110): a set refused because the session is complete is flagged, not retried');
{
  const m = strip(read('src/lib/gymOutboxFlush.ts'));
  assert(/export function isClosedLogError\(/.test(m) && /session_log_closed/.test(m), 'isClosedLogError reads the trigger\'s name');
  assert(/if \(isClosedLogError\(err\)\) \{\s*await flagClosedGymSet\(db, item\);\s*continue;/.test(m), 'the retry flags the item and moves on — never retried for ever');
  assert(/export async function flagClosedGymSet\(/.test(m) && /markGymSetClosed\(item\.input\.id, naming\)/.test(m), 'the flag carries the naming so Today can say which set');
  const ob = strip(read('src/lib/outbox.ts'));
  assert(/closedLog\?: \{ exercise_name: string \| null; entry_date: string \| null \};/.test(ob) && /export function markGymSetClosed\(id: string, naming:/.test(ob), 'the outbox marks it with conflictAt and closedLog');
  assert(/conflictAt: item\.conflictAt \?\? new Date\(\)\.toISOString\(\),\s*conflictLive: null,\s*closedLog: item\.closedLog \?\? naming,/.test(ob), 'conflictAt is set (so no retry) and there is no live row');
  const lg = strip(read('src/components/GymSessionLogger/GymSessionLogger.tsx'));
  assert(/if \(isClosedLogError\(err\)\) void flagClosedGymSet\(createClient\(\), \{ input, queuedAt:/.test(lg), 'the logger flags its own refused set too, instead of leaving it "waiting to send"');
  const f = strip(read('src/components/OutboxFlusher/OutboxFlusher.tsx'));
  assert(/closedLog: item\.closedLog !== undefined/.test(f) && /the session was finished before this set was sent, so\s*the database refused \{c\.label\}/.test(f), 'Today says the session was finished before the set was sent');
  const closedBranch = f.slice(f.indexOf('c.gym?.closedLog ? ('), f.indexOf(') : c.gym ? ('));
  assert(/Discard this one/.test(closedBranch) && !/Use my numbers/.test(closedBranch) && !/Keep what is showing/.test(closedBranch), 'with Discard as the only control — no live row to correct');
  assert(/const naming = live \?\? item\.closedLog \?\? null;/.test(f), 'and names the set from the flag, not a network call');
  const w = read('src/lib/writeErrors.ts');
  assert(/session_log_closed/.test(w) && /This session was finished before this set was sent — correct a logged set instead\./.test(w), 'the logger\'s own error says the same');
  assert(/A complete session refuses a new set at the database/.test(read('docs/athlete/screens/05-gym-session.md')), 'the spec §7 records it');
}

console.log('\nthe spec');
{
  const spec = read('docs/athlete/screens/05-gym-session.md');
  assert(/waiting to send/.test(spec) && /online/.test(spec), '05-gym-session.md §7 says the logger retries and shows what is waiting');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
