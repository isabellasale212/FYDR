/* Gym programmes get dates, and the dates live on the assignment —
 * docs/decisions/programme-dates.md (Isabella, 15 Sept 2026), migration 0132.
 *
 * Pinned: the shape at the table (starts_on nullable with no default, ends_on
 * gone, every row on record left unmapped); the two SQL functions and the
 * TypeScript helper that mirrors them — asserted EQUAL on the arithmetic, so
 * the profile header and the database can never disagree by a day; the
 * builder's start date at assignment and per-row "Set start date"; the
 * athlete's programme screen saying a block finished and when; no reader
 * selecting the dropped column; and no "due today" or "missed" anywhere —
 * each is its own piece of work, not this decision's. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { assignmentEndsOn, assignmentFinished, assignmentWeekNow, programmeLengthWeeks } from '@/lib/programmeDates';
import { COUNTS, expectCount } from './lib/coverage.mjs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');
const sql = (s: string): string => s.replace(/^\s*--.*$/gm, '');

const mig = sql(read('supabase/migrations/0132_programme_assignment_dates.sql'));

console.log('the shape at the table');
{
  assert(/alter column starts_on drop not null,\s*alter column starts_on drop default;/.test(mig), 'starts_on is nullable with no default — a date is chosen, never invented');
  assert(/update public\.programme_assignments set starts_on = null;/.test(mig), 'every row on record is left unmapped');
  assert(/drop column ends_on;/.test(mig), 'ends_on is dropped: the end falls out of the start and the length');
  assert(/create or replace function public\.programme_length_weeks\(p_programme_id uuid\)/.test(mig) && /sum\(b\.duration_weeks\)/.test(mig), 'programme_length_weeks: the sum of the blocks');
  assert(/create or replace function public\.programme_assignment_ends_on\(p_starts_on date, p_programme_id uuid\)/.test(mig) && /\* 7\) - 1/.test(mig), 'programme_assignment_ends_on: start + weeks·7 − 1');
  assert(/assignment_starts_on\s+date,\s*assignment_ends_on\s+date,\s*scheduled_on\s+date/.test(mig), 'resolve_my_programme_sessions carries the start, the end and each session\'s date');
  assert(/when pa\.starts_on is null then null/.test(mig), 'null throughout for an unmapped assignment');
}

console.log('\nthe TypeScript helper mirrors the database, day for day');
{
  // 860's own case: Monday 5 Jan 2026, a 2 + 2 week programme.
  assert(programmeLengthWeeks([{ duration_weeks: 2 }, { duration_weeks: 2 }], 8) === 4, 'the length is the sum of the blocks (the programme\'s own figure only without blocks)');
  assert(programmeLengthWeeks([], 8) === 8 && programmeLengthWeeks([], null) === null, 'and the fallback when there are none');
  assert(assignmentEndsOn('2026-01-05', 4) === '2026-02-01', 'start + 4·7 − 1 = Sunday 1 Feb, the database\'s answer for the same inputs');
  assert(assignmentEndsOn(null, 4) === null && assignmentEndsOn('2026-01-05', null) === null, 'unmapped, or an unknown length: no end');
  assert(assignmentWeekNow('2026-01-05', '2026-01-12', 4) === 2 && assignmentWeekNow('2026-01-05', '2026-01-04', 4) === 1 && assignmentWeekNow('2026-01-05', '2026-03-01', 4) === 4, 'week now: counted from the start, floored at 1, clamped to the length');
  assert(assignmentWeekNow(null, '2026-01-12', 4) === null, 'and null when unmapped — the screens say "no start date set"');
  assert(assignmentFinished('2026-01-05', '2026-02-02', 4) && !assignmentFinished('2026-01-05', '2026-02-01', 4) && !assignmentFinished(null, '2026-02-02', 4), 'finished the day after the last day; never for an unmapped assignment');
}

console.log('\nthe S&C chooses the date, and sets it later on an unmapped one');
{
  const q = strip(read('src/lib/queries/programmes.ts'));
  assert(/startsOn: string;\s*\},\s*\): Promise<\{ error: string \| null \}> \{\s*if \(!\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(input\.startsOn\)\)/.test(q), 'assignProgramme requires a start date');
  assert(/starts_on: input\.startsOn,/.test(q), 'and writes it');
  assert(/export async function setAssignmentStartDate\(/.test(q) && /update\(\{ starts_on: startsOn \}\)/.test(q), 'setAssignmentStartDate writes one through mustAffect');
  assert(/select\('id, athlete_id, group_id, starts_on, athletes\(first_name, last_name\), groups\(name\)'\)/.test(q), 'the Assigned card reads each row\'s id and start');
  const b = strip(read('src/components/ProgrammeBuilder/ProgrammeBuilder.tsx'));
  assert(/id="assign-starts-on"/.test(b) && /startsOn: assignStartsOn,/.test(b) && /useState\(today\)/.test(b), 'the assign form has a Starts on date, defaulting to today');
  assert(/Week 1, day 1 is this day\./.test(b), 'and says what the date means');
  assert(/'Set start date' : 'Change date'/.test(b) && /setAssignmentStartDate\(/.test(b), 'each row offers Set start date (unmapped) or Change date');
  assert(/\? 'no start date'/.test(b) && /' · finished'/.test(b), 'a row reads "no start date" or its dates, "· finished" once over');
}

console.log('\nthe athlete\'s screen: the block finished, and when');
{
  const p = strip(read('src/app/(athlete)/programme/page.tsx'));
  assert(/s\.assignment_ends_on !== null && s\.assignment_ends_on < today/.test(p), 'a session is over when its assignment\'s last day is before today');
  assert(/data-finished-block/.test(p) && /finished on \{formatDate\(b\.assignment_ends_on, timezone\)\}/.test(p), 'a finished block is named with the day it finished');
  assert(/Nothing new has been assigned yet\./.test(p), 'and says so when nothing else is live');
  assert(/`Starts \$\{formatDate\(startsOn, timezone\)\}` : `From \$\{formatDate\(startsOn, timezone\)\}`/.test(p), 'the live block shows its dates (Starts … before the start)');
  assert(!/due today|missed/i.test(p), 'nothing here says a session is due or was missed');
}

console.log('\nno reader selects the dropped column');
{
  const files: string[] = [];
  const walk = (d: string): void => { for (const e of readdirSync(d)) { const p = join(d, e); if (statSync(p).isDirectory()) walk(p); else if (/\.(ts|tsx)$/.test(e)) files.push(p); } };
  walk('src');
  expectCount('source files walked', files, COUNTS.srcTs);
  const offenders = files.filter((f) => !f.endsWith('database.ts') && /from\('programme_assignments'\)[\s\S]{0,400}?select\('[^']*ends_on/.test(read(f)));
  assert(offenders.length === 0, `no programme_assignments read selects ends_on (${offenders.join(', ') || 'none'})`);
  const rows = files.filter((f) => /programme_assignments/.test(read(f)) && /ends_on: string \| null;/.test(read(f)) && !/assignmentEndsOn\(/.test(read(f)) && !f.endsWith('database.ts'));
  assert(rows.length === 0, `every ends_on a reader exposes is derived by assignmentEndsOn (${rows.join(', ') || 'none'})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
