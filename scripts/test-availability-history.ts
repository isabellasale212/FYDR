/* PATTERN-S3 C7 (decision sheet group (c), 2026-09-12): availability history
 * for one athlete — one row per change, newest first: the time, the status
 * word, the restriction line as it read then, what changed, who. Never
 * edited, never removed: the availability table is already a ledger (every
 * change closes the open interval and inserts a row), so the history is the
 * rows themselves — no trigger, no view, no migration. Unit tests on
 * lib/availabilityHistory.ts, then the read, the page and the CSV.
 */
import { readFileSync } from 'node:fs';
import { buildHistory, whatChanged, type AvailabilityLedgerRow } from '@/lib/availabilityHistory';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

const R = (id: string, at: string, status: AvailabilityLedgerRow['status'], restrictions: string[] | null, extra: Partial<AvailabilityLedgerRow> = {}): AvailabilityLedgerRow => ({
  id, status, restrictions, reason_category: null, injury_id: null, effective_from: at, effective_to: `${at}x`, set_by: 'u1', note: null, ...extra,
});

console.log('what changed');
{
  assert(whatChanged(null, R('a', '2026-07-06', 'available', null)) === 'Added to the record · Available', 'the first row: added to the record');
  assert(whatChanged(null, R('a', '2026-07-15', 'unavailable', null, { reason_category: 'representative' })) === 'Unavailable · Absence recorded · representative', 'a first row that is an absence says so');
  assert(whatChanged(R('a', '2026-07-15', 'available', null), R('b', '2026-07-26', 'unavailable', ['no_training'], { injury_id: 'i1', reason_category: 'injury' })) === 'Available → Unavailable · Restrictions now No training · Injury-linked', 'status, restrictions and the injury link, in that order');
  assert(whatChanged(R('a', '2026-08-30', 'unavailable', ['no_training'], { injury_id: 'i1' }), R('b', '2026-09-04', 'modified', ['no_contact', 'no_running_above_70'], { injury_id: 'i1' })) === 'Unavailable → Modified · Restrictions now No contact · No running above 70', 'a stage change is not named — the restriction line is what a coach acts on');
  assert(whatChanged(R('a', '2026-09-04', 'modified', ['no_contact', 'protocol_stage_3'], { injury_id: 'i1' }), R('b', '2026-09-11', 'modified', ['no_contact', 'protocol_stage_4'], { injury_id: 'i1' })) === 'Re-recorded, nothing changed', 'a protocol-only change reads as nothing changed to a non-clinical reader — the clinical terms are filtered before the comparison');
  assert(whatChanged(R('a', '2026-09-11', 'modified', ['no_contact']), R('b', '2026-09-12', 'modified', ['no_contact'])) === 'Re-recorded, nothing changed', 'an identical write is a fact, not an error');
  assert(whatChanged(R('a', '2026-09-11', 'modified', ['no_contact'], { injury_id: 'i1' }), R('b', '2026-09-12', 'available', null)) === 'Modified → Available · Restrictions cleared · No longer injury-linked', 'clearing');
  assert(whatChanged(R('a', '2026-08-13', 'unavailable', null, { reason_category: 'representative' }), R('b', '2026-08-31', 'available', null, { reason_category: 'personal' })) === 'Unavailable → Available', "a coach's Available write carries a reason (the policy requires one) — it is not an absence, and is not called one");
}

console.log('\nthe history');
{
  const rows = [
    R('c', '2026-07-26', 'unavailable', ['no_training'], { injury_id: 'i1', reason_category: 'injury', set_by: 'medic' }),
    R('a', '2026-07-06', 'available', null, { set_by: 'ss' }),
    R('b', '2026-07-15', 'unavailable', null, { reason_category: 'representative', set_by: 'coach' }),
    R('d', '2026-09-11', 'modified', ['no_contact', 'no_collision_drills'], { injury_id: 'i1', reason_category: 'injury', set_by: 'medic', effective_to: null }),
  ];
  const names = new Map([['medic', 'Ruth Callaghan'], ['coach', 'Kate Doyle'], ['ss', 'Jane Pemberton']]);
  const h = buildHistory(rows, names);
  assert(h.map((r) => r.id).join('') === 'dcba', 'newest first, whatever order the rows arrived in');
  assert(h[0]?.current === true && h[1]?.current === false, 'the open interval is marked current');
  assert(h[0]?.restrictionLine === 'No contact · No collision drills' && h[3]?.restrictionLine === 'None', 'the restriction line as it read then; "None" when there was none');
  assert(h[0]?.setBy === 'Ruth Callaghan' && h[2]?.setBy === 'Kate Doyle', 'who set it, by name');
  assert(h[3]?.changed === 'Added to the record · Available' && h[2]?.changed === 'Available → Unavailable · Absence · representative', 'what changed, row by row');
}

console.log('\nthe read, the page and the CSV');
{
  const q = strip(read('src/lib/queries/availability.ts'));
  assert(/export async function fetchAvailabilityLedger\(/.test(q) && /order\('effective_from', \{ ascending: true \}\)/.test(q), 'fetchAvailabilityLedger reads every row for the athlete, oldest first, no window');
  const page = strip(read('src/app/(staff)/squad/[athleteId]/availability/page.tsx'));
  assert(/<h1>Availability history<\/h1>/.test(page) && /buildHistory\(/.test(page), 'the page /squad/[athleteId]/availability');
  assert(/Every change since (they joined|the record began)/.test(page) || /one row per change/i.test(page), 'and says what a row is');
  assert(/<th scope="col">When<\/th>/.test(page) && /<th scope="col">Status<\/th>/.test(page) && /<th scope="col">Restrictions<\/th>/.test(page) && /<th scope="col">What changed<\/th>/.test(page) && /<th scope="col">Set by<\/th>/.test(page), 'the five columns');
  assert(!/pill-good|pill-warn|pill-bad/.test(page.slice(page.indexOf('<tbody>'))), 'the status column carries no tone — a history is a list of facts, not alarms');
  assert(/Export CSV/.test(page) && /availability\/export/.test(page), 'Export CSV');
  const route = strip(read('src/app/(staff)/squad/[athleteId]/availability/export/route.ts'));
  assert(/csvResponse\(/.test(route) && /buildHistory\(/.test(route) && /recordReportView\(/.test(route), 'the CSV route is the same rows, and the export is recorded');
  const profile = strip(read('src/app/(staff)/squad/[athleteId]/page.tsx'));
  assert(/href=\{`\/squad\/\$\{athlete\.id\}\/availability`\}/.test(profile), 'the profile links to it');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
