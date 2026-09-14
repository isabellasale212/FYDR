/* A held check-in the week has closed on — PATTERN-S6 C10, ruled 2026-09-13
 * (batch A20), built 2026-09-14: "a policy refusal marks a held item 'could
 * not be sent, the week has closed', shown once, with Discard." The weekly
 * nutrition check-in's insert policy admits the ISO week just ended and the
 * two before it; a queued check-in older than that is refused by row-level
 * security for ever. It used to stay "waiting" for ever. Now the flusher
 * flags it like a conflict (off the queue count, never retried), Today says
 * what happened once, and Discard is the way out — the §0bc closed-session
 * flag's shape.
 */
import { readFileSync } from 'node:fs';
import { isPolicyRefusal } from '@/lib/gymOutboxFlush';
import { queueRows } from '@/lib/outboxQueue';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

console.log('the refusal is recognised');
assert(isPolicyRefusal(new Error('new row violates row-level security policy for table "nutrition_checkins"')), 'PostgREST\'s own wording for a WITH CHECK refusal');
assert(isPolicyRefusal(Object.assign(new Error('refused'), { code: '42501' })), 'or the SQLSTATE, when a driver carries it');
assert(!isPolicyRefusal(new Error('duplicate key value violates unique constraint')), 'a slot conflict is not a policy refusal');
assert(!isPolicyRefusal(new Error('Failed to fetch')), 'nor is no signal');

console.log('\nthe flusher');
const flusher = strip(readFileSync('src/components/OutboxFlusher/OutboxFlusher.tsx', 'utf8'));
const loop = flusher.slice(flusher.indexOf('for (const item of nutritionItems)'), flusher.indexOf('flushGymSets(db, orgId, athleteId)'));
assert(/isPolicyRefusal\(err\)/.test(loop) && loop.indexOf('isPolicyRefusal(err)') < loop.indexOf('isDuplicateKeyError(err)'), 'a policy refusal on a check-in is caught before the slot-conflict check');
assert(/markNutritionCheckinClosed\(item\.input\.id\);\s*continue;/.test(loop), 'flagged and never retried');
assert(/the week has closed, so the database refused/.test(flusher) && /Discard this one/.test(flusher), 'Today says the week has closed, once, with Discard');
const notice = flusher.slice(flusher.indexOf('c.closedWeek ? ('), flusher.indexOf('One saved entry could not be sent'));
assert((notice.match(/<button/g) ?? []).length === 1 && /Discard this one/.test(notice) && !/Use my numbers/.test(notice), 'the closed-week notice offers the discard and nothing else');

console.log('\nthe outbox');
const outbox = strip(readFileSync('src/lib/outbox.ts', 'utf8'));
assert(/closedWeek\?: true;/.test(outbox) && /export function markNutritionCheckinClosed/.test(outbox), 'the flag lives on the queued item, beside conflictAt');
assert(/conflictAt: item\.conflictAt \?\? new Date\(\)\.toISOString\(\), closedWeek: true/.test(outbox), 'flagging sets conflictAt too, so the item leaves the waiting count');

const rows = queueRows(
  {
    wellness: [],
    training: [],
    nutrition: [
      { input: { id: 'a', week_start: '2026-08-03', iso_year: 2026, iso_week: 32, answer: 'yes', note: null }, queuedAt: '2026-09-14T08:00:00Z', conflictAt: '2026-09-14T08:00:05Z', closedWeek: true },
      { input: { id: 'b', week_start: '2026-09-07', iso_year: 2026, iso_week: 37, answer: 'no', note: null }, queuedAt: '2026-09-14T08:00:00Z' },
    ],
    gym: [],
  },
  'Europe/London',
  '2026-09-14T09:00:00Z',
);
assert(rows.length === 1 && rows[0]!.key === 'nutrition-b', 'the queue screen lists the one still waiting, not the one the week closed on');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
