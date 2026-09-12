/* §0ad — compliance counts an RPE as submitted only if it was submitted before
 * the instant the RPE screen stops accepting one: rpeClosesAt, the end of the
 * following club-local day (decided by Isabella 2026-09-12). One rule, read by
 * Today's to-do row, the RPE screen and the compliance report, so the three
 * cannot disagree.
 *
 *   1. rpeSubmittedInTime is rpeClosesAt read the other way round — strictly
 *      before the close counts, the close itself does not, in club time
 *   2. classifyRpeSubmissions: in time counts; late is a miss but still an
 *      entry (for "Last entry"); matched PER SESSION, not per day; a missing
 *      session invents no miss; the ORIGINAL submission's time is what is
 *      judged, never a staff correction's
 *   3. the report reads what the rule needs — originals from training_entries
 *      with submitted_at and session_id, the sessions' own times, the org's
 *      timezone — and every caller passes the timezone
 *   4. the spec says which thing the report measures
 */
import { readFileSync } from 'node:fs';
import { rpeClosesAt, rpeSubmittedInTime } from '@/lib/rpeDue';
import { classifyRpeSubmissions, rpeExpectationKey } from '@/lib/complianceRpe';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const TZ = 'Europe/London';

console.log('1. the rule: submitted strictly before rpeClosesAt, in club time');
{
  const s = { starts_at: '2026-09-10T09:30:00+01:00', duration_min: 80 };
  assert(rpeSubmittedInTime(s, '2026-09-10T11:20:00+01:00', TZ), 'that evening counts');
  assert(rpeSubmittedInTime(s, '2026-09-11T23:59:59+01:00', TZ), 'the last second of the following day counts');
  assert(!rpeSubmittedInTime(s, '2026-09-12T00:00:00+01:00', TZ), 'midnight ending the following day does not — the same instant the screen refuses');
  assert(rpeSubmittedInTime(s, rpeClosesAt(s, TZ) - 1, TZ) && !rpeSubmittedInTime(s, rpeClosesAt(s, TZ), TZ), 'a number of milliseconds works the same as an ISO string, and the boundary is rpeClosesAt itself');
  assert(!rpeSubmittedInTime(s, '2026-09-13T08:00:00+01:00', TZ), 'a rating entered when the coach chased, two days on, is late');
  const late = { starts_at: '2026-09-10T23:00:00+01:00', duration_min: 50 };
  assert(rpeSubmittedInTime(late, '2026-09-11T23:30:00+01:00', TZ), 'a session ending 23:50 has the whole of the next day, as the screen gives it');
  const noDuration = { starts_at: '2026-09-10T18:00:00+01:00', duration_min: null };
  assert(rpeSubmittedInTime(noDuration, '2026-09-11T20:00:00+01:00', TZ) && !rpeSubmittedInTime(noDuration, '2026-09-12T00:00:00+01:00', TZ), 'no duration: ends when it starts, closes the same way');
  const sydney = { starts_at: '2026-09-10T18:00:00+10:00', duration_min: 60 };
  assert(rpeSubmittedInTime(sydney, '2026-09-11T23:59:00+10:00', 'Australia/Sydney') && !rpeSubmittedInTime(sydney, '2026-09-12T00:00:00+10:00', 'Australia/Sydney'), 'in a zone ahead of UTC the boundary is that zone\'s midnight, not London\'s');
}

console.log('\n2. classifying a squad\'s RPE submissions against their expectations');
{
  const sessions = [
    { id: 'am', starts_at: '2026-09-10T09:30:00+01:00', duration_min: 80 },
    { id: 'pm', starts_at: '2026-09-10T16:00:00+01:00', duration_min: 60 },
    { id: 'next', starts_at: '2026-09-11T10:00:00+01:00', duration_min: 60 },
  ];
  const exps = [
    { athlete_id: 'a', expectation_date: '2026-09-10', session_id: 'am' },
    { athlete_id: 'a', expectation_date: '2026-09-10', session_id: 'pm' },
    { athlete_id: 'b', expectation_date: '2026-09-10', session_id: 'am' },
    { athlete_id: 'c', expectation_date: '2026-09-10', session_id: 'am' },
    { athlete_id: 'c', expectation_date: '2026-09-11', session_id: 'next' },
    { athlete_id: 'd', expectation_date: '2026-09-10', session_id: 'gone' },
    { athlete_id: 'e', expectation_date: '2026-09-10', session_id: null },
  ];
  const subs = [
    // a rated the morning session that evening and never the afternoon one
    { athlete_id: 'a', entry_date: '2026-09-10', session_id: 'am', submitted_at: '2026-09-10T20:00:00+01:00' },
    // b rated two days late, when chased
    { athlete_id: 'b', entry_date: '2026-09-10', session_id: 'am', submitted_at: '2026-09-12T09:00:00+01:00' },
    // c rated the 10th in time; the 11th's window is still open at "now" and unrated
    { athlete_id: 'c', entry_date: '2026-09-10', session_id: 'am', submitted_at: '2026-09-11T08:00:00+01:00' },
    // d's session row is gone (deleted after the expectation was generated) — rated the same day
    { athlete_id: 'd', entry_date: '2026-09-10', session_id: 'gone', submitted_at: '2026-09-10T21:00:00+01:00' },
    // e's expectation carries no session — an entry on the day is all that can be asked
    { athlete_id: 'e', entry_date: '2026-09-10', session_id: null, submitted_at: '2026-09-15T21:00:00+01:00' },
  ];
  const { inTime, any } = classifyRpeSubmissions(exps, subs, sessions, TZ);
  const k = (a: string, d: string, s: string | null) => rpeExpectationKey({ athlete_id: a, expectation_date: d, session_id: s });
  assert(inTime.has(k('a', '2026-09-10', 'am')), 'a\'s morning rating counts');
  assert(!inTime.has(k('a', '2026-09-10', 'pm')) && !any.has(k('a', '2026-09-10', 'pm')), 'and does NOT stand in for the afternoon session — matched per session, not per day (the old (athlete, date) key counted both)');
  assert(!inTime.has(k('b', '2026-09-10', 'am')), 'b\'s late rating is a miss');
  assert(any.has(k('b', '2026-09-10', 'am')), 'but it is still an entry, so "Last entry" can name the day');
  assert(inTime.has(k('c', '2026-09-10', 'am')) && !inTime.has(k('c', '2026-09-11', 'next')), 'c: one in time, one unrated');
  assert(inTime.has(k('d', '2026-09-10', 'gone')), 'a session the report cannot find invents no miss — the rating counts');
  assert(inTime.has(k('e', '2026-09-10', null)), 'an expectation with no session falls back to the day: an entry on the day counts');
  assert(inTime.size === 4 && any.size === 5, 'four in time, five entries');
  /* The ORIGINAL's time. A staff correction is a new row with submitted_at =
     now(); if the report read the _current view it would judge the coach's
     correction time, and an on-time rating corrected a week later would turn
     into a miss. The classifier is handed originals; asserted on the read in
     section 3. */
}

console.log('\n3. the report reads what the rule needs');
{
  const reports = strip(read('src/lib/queries/reports.ts'));
  const fn = reports.slice(reports.indexOf('export async function fetchComplianceReport'), reports.indexOf('export async function', reports.indexOf('export async function fetchComplianceReport') + 10));
  assert(/timezone: string,?\s*\)/.test(fn.slice(0, 400)), 'fetchComplianceReport takes the org timezone');
  assert(/\.from\('training_entries'\)/.test(fn) && !/\.from\('training_entries_current'\)/.test(fn), 'RPE submissions come from the base table, not the _current view');
  assert(/\.is\('revision_of', null\)/.test(fn), 'originals only — the athlete\'s own submission time, never a correction\'s');
  assert(/select\('athlete_id, entry_date, session_id, submitted_at'\)/.test(fn), 'with session_id and submitted_at');
  assert(/select\('athlete_id, expectation_date, domain, session_id, is_required, waived_reason'\)/.test(fn), 'the expectations carry their session');
  assert(/fetchRpeSessionWindows\(/.test(fn), 'and the sessions\' own start and duration are read (the shared read, section 5)');
  assert(/classifyRpeSubmissions\(/.test(fn), 'classified by the shared function');
  assert(/import \{[^}]*classifyRpeSubmissions[^}]*\} from '@\/lib\/complianceRpe'/.test(reports), 'imported from lib/complianceRpe');
  const lib = strip(read('src/lib/complianceRpe.ts'));
  assert(/import \{[^}]*rpeSubmittedInTime[^}]*\} from '@\/lib\/rpeDue'/.test(lib), 'which reads the rule from lib/rpeDue — the file Today and the RPE screen read');
  const rpeDue = strip(read('src/lib/rpeDue.ts'));
  assert(/export function rpeSubmittedInTime\([^)]*\)[^{]*\{[^}]*rpeClosesAt\(/.test(rpeDue), 'and rpeSubmittedInTime is defined by rpeClosesAt, not a second date calculation');
  for (const p of [
    'src/app/(staff)/reports/compliance/page.tsx',
    'src/app/(staff)/reports/compliance/pdf/route.tsx',
    'src/app/(staff)/reports/compliance/export/route.ts',
    'src/lib/queries/squadWeeklyReport.ts',
  ]) {
    const src = strip(read(p));
    assert(/fetchComplianceReport\([^)]*timezone\)/.test(src), `${p.split('/').slice(-2).join('/')} passes the timezone`);
  }
}

console.log('\n4. the spec says which thing the report measures');
{
  const spec = read('docs/screens/20-compliance-report.md');
  assert(/end of the following/.test(spec) && /rpeClosesAt/.test(spec), '20-compliance-report.md states the RPE cutoff and names the shared rule');
  assert(/Last entry/.test(spec) && /late/.test(spec), 'and says what "Last entry" does with a late rating');
  const metrics = read('docs/metrics.md');
  assert(/rpeClosesAt/.test(metrics), 'metrics.md MET-012 carries the RPE cutoff');
}

console.log('\n5. the athlete report\'s own compliance figure — the same rule, the same function (Builder Q5, decided 2026-09-12)');
{
  const ar = strip(read('src/lib/queries/athleteReport.ts'));
  const fn = ar.slice(ar.indexOf('async function fetchAthleteCompliancePct'), ar.indexOf('const SESSION_COLUMNS'));
  assert(/timezone: string,?\s*\)/.test(fn.slice(0, 400)), 'fetchAthleteCompliancePct takes the timezone');
  assert(/fetchAthleteCompliancePct\(db, orgId, athleteId, from, today, timezone\)/.test(ar), 'and is passed it');
  assert(/\.from\('training_entries'\)/.test(fn) && !/training_entries_current/.test(fn), 'RPE from the base table');
  assert(/\.is\('revision_of', null\)/.test(fn), 'originals only');
  assert(/select\('athlete_id, entry_date, session_id, submitted_at'\)/.test(fn), 'with session_id and submitted_at');
  assert(/select\('athlete_id, expectation_date, domain, session_id, waived_reason'\)/.test(fn), 'the expectations carry their session');
  assert(/classifyRpeSubmissions\(/.test(fn) && /rpeExpectationKey\(/.test(fn), 'classified and keyed by the shared function');
  assert(/fetchRpeSessionWindows\(/.test(fn), 'the sessions\' windows come from the shared read');
  const reports = strip(read('src/lib/queries/reports.ts'));
  assert(/fetchRpeSessionWindows\(/.test(reports) && !/SESSION_ID_CHUNK/.test(reports), 'which the squad report uses too — one chunked read, not two');
  const windows = strip(read('src/lib/queries/rpeSessionWindows.ts'));
  assert(/export async function fetchRpeSessionWindows/.test(windows) && /\.from\('sessions'\)/.test(windows) && /select\('id, starts_at, duration_min'\)/.test(windows), 'defined once in queries/rpeSessionWindows.ts');
  assert(!/Not yet applied/.test(read('docs/metrics.md')), 'metrics.md no longer says the athlete report is pending');
}

console.log('\n6. the outbox sends when the athlete rated, and the database decides whether to believe the phone (Builder Q6, decided 2026-09-12)');
{
  const mig = read('supabase/migrations/0105_training_submitted_at_clamp.sql');
  assert(/before insert on public\.training_entries/.test(mig), '0105: a BEFORE INSERT trigger on training_entries');
  assert(/new\.submitted_at >= now\(\)/.test(mig), 'a value at or after arrival is replaced — nothing can be post-dated');
  assert(/new\.submitted_at < now\(\) - interval '24 hours'/.test(mig), 'and older than 24 hours before arrival is replaced — a clock set wrong cannot back-date past a day');
  assert(!/before update|after update/.test(mig), 'insert only: a row\'s submitted_at is never rewritten');
  const t = read('supabase/tests/610_training_submitted_at_clamp_test.sql');
  assert(/interval '2 hours'/.test(t) && /interval '24 hours'/.test(t) && /interval '30 hours'/.test(t) && /\+ interval '10 minutes'/.test(t), '610 covers kept (2h, 24h), too old (30h) and a clock set ahead');
  assert(/revise_training_entry/.test(t), 'and a staff correction\'s own time');
  const training = strip(read('src/lib/queries/training.ts'));
  assert(/options: \{ submittedAt\?: string \} = \{\}/.test(training) && /submitted_at: options\.submittedAt/.test(training), 'submitTrainingEntry writes submitted_at only when told when');
  const flusher = strip(read('src/components/OutboxFlusher/OutboxFlusher.tsx'));
  assert(/submitTrainingEntry\([\s\S]{0,200}\{ submittedAt: item\.queuedAt \}/.test(flusher), 'the outbox flush passes the time it queued the rating');
  const rpeForm = strip(read('src/components/RpeForm/RpeForm.tsx'));
  assert(/submitTrainingEntry\(createClient\(\), input, \{ orgId, athleteId, userId \}\)/.test(rpeForm) && !/submittedAt/.test(rpeForm), 'the online screen sends nothing and gets the arrival time');
  assert(!/rpeIsClosed|rpeClosesAt/.test(training) && !/rpeIsClosed/.test(flusher), 'neither refuses a late row: the report judges, the write path does not');
  assert(/queuedAt/.test(read('docs/athlete/screens/03-session-rating.md')) && /24 hours/.test(read('docs/athlete/screens/03-session-rating.md')), '03-session-rating.md §7 states the rule');
  assert(/24 hours/.test(read('docs/04-data-model.md')), '04-data-model.md says what submitted_at is');
  assert(/queued/.test(read('docs/screens/20-compliance-report.md')), '20-compliance-report.md says an offline rating is judged by when it was made');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
