/* §0aa — a gym set queued offline is no longer silently discarded when its
 * slot was filled by a different value. Decided by Isabella 2026-09-12:
 * "Build resolveGymSetConflict as you recommended: the same targeted lookup
 * the other three domains do, so a genuinely different value becomes a
 * visible conflict instead of being dropped."
 *
 *   1. the decision, pure (lib/gymSetConflict.ts): own id live → delivered;
 *      another id with the SAME numbers → delivered (the athlete's numbers
 *      are there, whichever row carries them); another id with DIFFERENT
 *      numbers → conflict; nothing live → conflict (never guessed away)
 *   2. the flusher: the gym branch looks the slot up on a duplicate-key
 *      error, marks a conflict with the live values, and no longer dequeues
 *      blind; the conflict is surfaced on Today with both values and two
 *      ways out — keep what is showing, or use the queued numbers as a
 *      correction of the live set (the athlete's own correction path)
 *   3. the outbox: gym items carry conflictAt + the live values; a flagged
 *      item is skipped by the next flush and counted as a conflict, not
 *      as pending
 */
import { readFileSync } from 'node:fs';
import { classifyGymSetConflict, describeGymSet } from '@/lib/gymSetConflict';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

const queued = { id: 'q1', gym_session_log_id: 'log', programme_exercise_id: 'pe', exercise_id: 'ex', set_number: 3, reps_completed: 8, load_kg: 102.5, rpe: null };

console.log('1. the decision');
{
  assert(classifyGymSetConflict(queued, { id: 'q1', reps_completed: 8, load_kg: 102.5, rpe: null }) === 'delivered', 'own id live: delivered (a replay of a write that landed)');
  assert(classifyGymSetConflict(queued, { id: 'other', reps_completed: 8, load_kg: 102.5, rpe: null }) === 'delivered', 'another id, the same numbers: delivered — nothing of the athlete\'s is lost');
  assert(classifyGymSetConflict(queued, { id: 'other', reps_completed: 8, load_kg: 100, rpe: null }) === 'conflict', 'another id, a different load: conflict');
  assert(classifyGymSetConflict(queued, { id: 'other', reps_completed: 6, load_kg: 102.5, rpe: null }) === 'conflict', 'a different rep count: conflict');
  assert(classifyGymSetConflict(queued, { id: 'other', reps_completed: 8, load_kg: 102.5, rpe: 7 }) === 'conflict', 'a different RPE (null against 7): conflict');
  assert(classifyGymSetConflict({ ...queued, load_kg: null }, { id: 'other', reps_completed: 8, load_kg: null, rpe: null }) === 'delivered', 'null against null is equal');
  assert(classifyGymSetConflict(queued, null) === 'conflict', 'nothing live for the slot: conflict, not a guess that it landed');
  assert(describeGymSet({ reps_completed: 8, load_kg: 102.5, rpe: null }) === '8 reps at 102.5 kg', 'described in words');
  assert(describeGymSet({ reps_completed: 8, load_kg: null, rpe: null }) === '8 reps, load not logged', 'with the My data wording for an absent load');
  assert(describeGymSet({ reps_completed: null, load_kg: null, rpe: null }) === 'nothing logged', 'and for nothing');
}

console.log('\n2. the flusher (the gym loop is lib/gymOutboxFlush.ts since ATH-ADULT-09 C4, shared with the logger)');
{
  const f = strip(read('src/components/OutboxFlusher/OutboxFlusher.tsx'));
  const g = strip(read('src/lib/gymOutboxFlush.ts'));
  assert(/export async function resolveGymSetConflict\(/.test(g), 'resolveGymSetConflict exists');
  assert(/fetchGymSetForSlot\(/.test(g), 'and looks the slot up in gym_set_logs_current');
  assert(/classifyGymSetConflict\(/.test(g), 'and decides with the pure function');
  const gymLoop = g.slice(g.indexOf('for (const item of items)'), g.indexOf('const queued = '));
  assert(/isDuplicateKeyError\(err\)[\s\S]*resolveGymSetConflict\(db, athleteId, item\)/.test(gymLoop), 'the gym branch resolves on a duplicate-key error');
  assert(/markGymSetConflict\(item\.input\.id, live \? \{ \.\.\.live, \.\.\.naming \} : null\)/.test(g), 'and the resolver marks a real conflict with the live values and the set\'s name and day');
  assert(!/isDuplicateKeyError\(err\)\)\s*\{\s*dequeueGymSetLog/.test(gymLoop), 'and no longer dequeues blind');
  assert(/pendingGymSetLogs\(\)\.filter\(\s*\(item\) => !item\.conflictAt/.test(g) && /pendingGymSetLogs\(\)\.filter\(\(item\) => !item\.conflictAt\)/.test(f), 'a flagged gym item is skipped by the next flush');
  assert(/await flushGymSets\(db, orgId, athleteId\)/.test(f), "and Today's flusher runs that loop");
  assert(/domain: 'gym' as const/.test(f), 'gym conflicts are in the snapshot');
  assert(/gym\.filter\(\(item\) => !item\.conflictAt\)\.length/.test(f), 'and not counted as pending');
  assert(/if \(domain === 'gym'\) dequeueGymSetLog\(id\)/.test(f), 'discard works for gym');
  assert(/Use my numbers/.test(f) && /reviseGymSetLog\(/.test(f), '"Use my numbers" corrects the live set with the queued values');
  assert(/from another tab or device/.test(f), 'the sentence the other three use');
  assert(!/GymSessionLogger is a different UI, not covered here/.test(read('src/components/OutboxFlusher/OutboxFlusher.tsx')), 'the out-of-scope note is gone');
}

console.log('\n3. the outbox and the lookup');
{
  const o = strip(read('src/lib/outbox.ts'));
  assert(/export function markGymSetConflict\(/.test(o), 'markGymSetConflict exists');
  assert(/export type PendingGymSetLog = \{[^}]*conflictAt\?: string;/.test(o), 'PendingGymSetLog carries conflictAt');
  assert(/conflictLive\?: /.test(o), 'and the live values it collided with, for the banner');
  const p = strip(read('src/lib/queries/programmes.ts'));
  assert(/export async function fetchGymSetForSlot\(/.test(p) && /from\('gym_set_logs_current'\)/.test(p.slice(p.indexOf('export async function fetchGymSetForSlot'))), 'fetchGymSetForSlot reads the _current view');
  assert(/\.eq\('set_number', input\.set_number\)/.test(p), 'by set number');
  assert(/programme_exercise_id/.test(p.slice(p.indexOf('export async function fetchGymSetForSlot'), p.indexOf('export async function fetchGymSetForSlot') + 1500)), 'and the exercise the slot index keys on');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
