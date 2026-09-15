/* PATTERN-S6 C1 (2026-09-13): the "Waiting to send" queue screen. Oldest
 * first; each row is what the athlete did, its own denominator, and the local
 * time it was saved; the header carries "4 entries · 5 writes"; no per-item
 * retry; "Nothing is waiting" with the last send time. Pure rows exercised
 * with values; the route, the link under Today's count and the persisted
 * last-send are regex reads of source with comments stripped. */
import { readFileSync } from 'node:fs';
import { queueHeader, queueRows, waitingEmptyLine } from '@/lib/outboxQueue';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const TZ = 'Europe/London';
const NOW = '2026-09-13T13:20:00.000Z';

const wellness = { input: { id: 'w1', entry_date: '2026-09-13', sleep_hours: 7.5, sleep_quality: 4, fatigue: 3, soreness: 2, stress: 2, mood: 4, resting_hr: 52, body_mass_kg: null }, queuedAt: '2026-09-13T06:42:00.000Z' };
const training = { input: { id: 't1', session_id: 's1', entry_date: '2026-09-12', rpe: 7, duration_min: 75 }, queuedAt: '2026-09-12T19:05:00.000Z' };
const nutrition = { input: { id: 'n1', week_start: '2026-09-07', iso_year: 2026, iso_week: 37, answer: 'roughly' }, queuedAt: '2026-09-13T07:10:00.000Z' };
const gymA = { input: { id: 'g1', gym_session_log_id: 'log1', programme_exercise_id: 'pe1', exercise_id: 'e1', set_number: 1, reps_completed: 8, load_kg: 100, rpe: null }, queuedAt: '2026-09-13T10:01:00.000Z', session: { name: 'Upper B', total_sets: 12, entry_date: '2026-09-13' } };
const gymB = { input: { id: 'g2', gym_session_log_id: 'log1', programme_exercise_id: 'pe1', exercise_id: 'e1', set_number: 2, reps_completed: 8, load_kg: 100, rpe: null }, queuedAt: '2026-09-13T10:04:00.000Z', session: { name: 'Upper B', total_sets: 12, entry_date: '2026-09-13' } };

console.log('1. the rows');
{
  const rows = queueRows({ wellness: [wellness as never], training: [training as never], nutrition: [nutrition as never], gym: [gymA as never, gymB as never] }, TZ, NOW);
  assert(rows.map((r) => r.what).join(' | ') === 'Session rating · Sat 12 Sept | Morning check-in · Sun 13 Sept | Weekly nutrition check-in · week of Mon 7 Sept | Gym · Upper B · Sun 13 Sept', 'oldest first, each named as what the athlete did');
  assert(rows[0]!.denominator === 'rated 7 of 10 · 75 min', 'a rating: the score out of ten and the minutes');
  assert(rows[1]!.denominator === 'seven answers of seven', 'a check-in: its answers over its answers (six, plus the optional ones given)');
  assert(rows[2]!.denominator === 'one answer of one', 'the weekly question: one of one');
  assert(rows[3]!.denominator === '2 sets of 12 logged' && rows[3]!.writes === 2, 'a gym session: one entry for its queued sets, the sets over the session\'s total');
  assert(rows[0]!.savedLabel === 'Sat 12 Sept 20:05' && rows[1]!.savedLabel === '07:42', 'saved today reads the local time; an older one carries its date');
  assert(rows.every((r) => !('retry' in r)), 'no per-item retry');
  const withoutContext = queueRows({ wellness: [], training: [], nutrition: [], gym: [{ ...gymA, session: undefined } as never] }, TZ, NOW);
  assert(withoutContext[0]!.what === 'Gym session' && withoutContext[0]!.denominator === '1 set logged', 'a gym set queued before the context existed: named plainly, counted without a total');
  const conflicted = queueRows({ wellness: [{ ...wellness, conflictAt: NOW } as never], training: [], nutrition: [], gym: [] }, TZ, NOW);
  assert(conflicted.length === 0, 'a flagged conflict is not waiting — it is on Today\'s notice, with Discard');
}

console.log('\n2. the header and the empty');
{
  const rows = queueRows({ wellness: [wellness as never], training: [training as never], nutrition: [nutrition as never], gym: [gymA as never, gymB as never] }, TZ, NOW);
  assert(queueHeader(rows) === '4 entries · 5 writes', '"4 entries · 5 writes" — a gym entry holds several sets');
  assert(queueHeader(rows.slice(0, 1)) === '1 entry · 1 write', 'singular');
  assert(waitingEmptyLine(null, TZ, NOW) === 'Nothing is waiting. Nothing has been sent from this phone yet.', 'empty, never sent');
  assert(waitingEmptyLine({ count: 3, at: '2026-09-13T11:04:00.000Z' }, TZ, NOW) === 'Nothing is waiting. Last sent at 12:04 today — 3 entries.', 'empty, with the last send time and count');
  assert(waitingEmptyLine({ count: 1, at: '2026-09-11T11:04:00.000Z' }, TZ, NOW) === 'Nothing is waiting. Last sent Fri 11 Sept 12:04 — 1 entry.', 'an older send carries its date');
}

console.log('\n3. the route, the link, the persisted send');
{
  const page = strip(read('src/app/(athlete)/today/waiting/page.tsx'));
  assert(/requireAthlete\(/.test(page) && /<WaitingQueue orgId=\{orgId\} athleteId=\{athleteId\} userId=\{claims\.userId\} timezone=\{timezone\} \/>/.test(page), 'the route is the athlete\'s and hands the client the timezone and the identity Send now flushes as');
  const comp = strip(read('src/components/WaitingQueue/WaitingQueue.tsx'));
  assert(/^'use client';/.test(comp.trimStart()) && /queueRows\(/.test(comp) && /queueHeader\(/.test(comp) && /waitingEmptyLine\(/.test(comp), 'the client component reads the queues through the pure module');
  assert(/window\.addEventListener\('online', refresh\)/.test(comp) && /window\.addEventListener\('storage', refresh\)/.test(comp), 'it re-reads when the phone comes back online or the queue changes');
  /* Decision batch 14 September 2026, #2: "Send now" is added, on this
     screen only, never per item. One button for the whole queue, running the
     same flush Today runs (lib/outboxFlush.ts); still no per-item retry. */
  assert(/data-send-now/.test(comp) && /flushOutbox\(createClient\(\), \{ orgId, athleteId, userId \}\)/.test(comp), 'one Send now for the whole queue, running the flush Today runs');
  assert((comp.match(/<button/g) ?? []).length === 1 && !/Retry|Try again/.test(comp), 'and no per-item retry — the one button is the whole queue\'s');
  assert(/Still no signal/.test(comp) && /still waiting/.test(comp), 'the outcome is said: what went, what is still waiting, or still no signal');
  assert(!/Send now/.test(strip(read('src/components/OutboxFlusher/OutboxFlusher.tsx'))) && !/Send now/.test(strip(read('src/components/GymSessionLogger/GymSessionLogger.tsx'))), 'the S6 wording stays everywhere else: no Send now on Today or in the logger');
  assert(!/transition|animation/.test(comp), 'nothing animates');
  const flusher = strip(read('src/components/OutboxFlusher/OutboxFlusher.tsx'));
  assert(/href="\/today\/waiting"[^>]*>\s*See what is waiting/.test(flusher), '"See what is waiting" under Today\'s count, the only route to the queue');
  const flushLib = strip(read('src/lib/outboxFlush.ts'));
  assert(/recordLastSent\(\{ count: sent, at: new Date\(\)\.toISOString\(\) \}\)/.test(flushLib) && /flushOutbox\(createClient\(\), \{ orgId, athleteId, userId \}\)/.test(flusher), 'a flush that sent records when and how many, for the empty screen — in the one flush both screens run');
  assert(/new Set\(gym\.filter\(\(item\) => !item\.conflictAt\)\.map\(\(item\) => item\.input\.gym_session_log_id\)\)\.size/.test(flusher), 'Today counts entries the way the queue does — a gym session is one entry');
  const outbox = strip(read('src/lib/outbox.ts'));
  assert(/export function recordLastSent\(/.test(outbox) && /export function lastSent\(/.test(outbox) && /fydr-outbox-last-sent/.test(outbox), 'the last send lives beside the queues');
  assert(/export function enqueueGymSetLog\(input: GymSetLogInput, session\?: PendingGymSetLog\['session'\]\)/.test(outbox), 'a gym set is queued with its session\'s name, total sets and date, so the queue can name it offline');
  const logger = strip(read('src/components/GymSessionLogger/GymSessionLogger.tsx'));
  assert(/enqueueGymSetLog\(input, \{ name: sessionName, total_sets: totalSets, entry_date: entryDate \}\)/.test(logger), 'the logger passes them');
  assert(/waiting-to-send/.test(read('docs/20-route-map.md')) && /See what is waiting/.test(read('docs/athlete/screens/01-today.md')), 'the route map and Today\'s spec carry it');
  assert(/Nothing is waiting/.test(read('docs/athlete/screens/19-waiting-to-send.md')), 'the screen has its own spec file');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
