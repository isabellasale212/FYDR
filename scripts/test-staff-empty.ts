/* PATTERN-S6 C8 — staff empty states in the one grammar (2026-09-13), one
 * screen a commit. The copy is pure and exercised with rows; the first
 * screen — the athlete report's wellness card — is read from source. */
import { readFileSync } from 'node:fs';
import { clubEmptyCopy, filterEmptyCopy, staffEmptyCopy } from '@/lib/staffEmpty';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the grammar');
{
  const outside = staffEmptyCopy({ domain: 'wellness', firstName: 'Dan', periodKey: 'month', rangeLabel: 'Last 28 days', latest: '2026-08-16', latestLabel: 'Sun 16 Aug', seasonStart: '2026-07-01', today: '2026-09-13' });
  assert(outside.title === 'Nothing in the last 28 days.', 'what is empty, with its window');
  assert(outside.body === "Dan's last morning check-in was Sun 16 Aug, 28 days ago. It is still on record, just before the period chosen. A morning check-in appears here the day it is submitted.", 'the most recent on record, that it is still there, and what would fill it');
  assert(outside.action?.period === 'season' && outside.action.label === 'Show this season', 'one action: widen to the smallest period that holds it');
  const older = staffEmptyCopy({ domain: 'gym', firstName: 'Dan', periodKey: 'season', rangeLabel: 'This season · 2026/27', latest: '2026-05-02', latestLabel: 'Sat 2 May', seasonStart: '2026-07-01', today: '2026-09-13' });
  assert(older.action?.period === 'all' && older.action.label === 'Show all on record', 'before the season: all on record');
  const none = staffEmptyCopy({ domain: 'testing', firstName: 'Kai', periodKey: 'month', rangeLabel: 'Last 28 days', latest: null, latestLabel: null, seasonStart: null, today: '2026-09-13' });
  assert(none.title === 'No test result on record for Kai.' && /^Nothing is missing — none has been recorded yet\./.test(none.body) && none.action === null, 'nothing on record: "Nothing is missing", no action, never "never"');
  const all = staffEmptyCopy({ domain: 'wellness', firstName: 'Dan', periodKey: 'all', rangeLabel: 'All on record', latest: '2026-08-16', latestLabel: 'Sun 16 Aug', seasonStart: null, today: '2026-09-13' });
  assert(all.action === null, 'at "all" there is no wider period to offer');
}

console.log('\n2. the first screen: the athlete report\'s wellness card');
{
  const page = strip(read('src/app/(staff)/reports/athlete/[athleteId]/page.tsx'));
  assert(/fetchMyLatestRecord\(db, athleteId, 'wellness'\)/.test(page), 'the page reads the athlete\'s most recent check-in, any period');
  assert(/staffEmptyCopy\(\{\s*domain: 'wellness',\s*firstName: athlete\.first_name,/.test(page), 'and writes the empty state in the grammar');
  assert(/<EmptyState[^>]*title=\{wellnessEmpty\.title\}[^>]*body=\{wellnessEmpty\.body\}/.test(page.replace(/\s+/g, ' ')), 'title and body from the copy');
  assert(/action=\{\s*wellnessEmpty\.action\s*\?\s*\{ href: `\/reports\/athlete\/\$\{athleteId\}\?period=\$\{wellnessEmpty\.action\.period\}`, label: wellnessEmpty\.action\.label \}\s*:\s*null\s*\}/.test(page.replace(/\s+/g, ' ')), 'the one action widens the report\'s own period');
  assert(!/title="No wellness entries in this period"/.test(page), 'the old "No wellness entries in this period" is gone');
  const es = strip(read('src/components/EmptyState/EmptyState.tsx'));
  assert(/action\?: \{ href: string; label: string \} \| null;/.test(es) && /className="btn-ghost empty-action"/.test(es), 'EmptyState takes the one action');
  assert(/one grammar/.test(read('docs/screens/19-athlete-report.md')), 'the spec says so');
}

console.log('\n3. the athlete report\'s other cards (2026-09-13)');
{
  const page = strip(read('src/app/(staff)/reports/athlete/[athleteId]/page.tsx'));
  assert(/fetchMyLatestRecord\(db, athleteId, 'gps'\)/.test(page) && /domain: 'gps',/.test(page), 'the GPS card reads the most recent GPS record on file');
  assert(/title=\{gpsEmpty\.title\}/.test(page) && /gpsEmpty\.action\.period/.test(page), 'and its empty state carries the widen action');
  assert(!/No GPS data for this athlete in this period\./.test(page), 'the old GPS line is gone');
  assert(/periodKey: 'all',\s*rangeLabel: 'All on record',\s*latest: null,/.test(page) && (page.match(/title=\{testsEmpty\.title\}/g) ?? []).length === 2, 'the two Testing empties are the all-time "nothing on record" state — no action, "Nothing is missing"');
  assert(!/No test result recorded for this athlete\./.test(page), 'the old tests line is gone');
  const q = strip(read('src/lib/queries/myLatestRecord.ts'));
  assert(/domain === 'gps'/.test(q) && /\.from\('gps_records'\)/.test(q), 'the latest-record read knows GPS');
}

console.log('\n4. the training report (2026-09-13)');
{
  const f = filterEmptyCopy({ what: 'GPS record', inScope: 5, scopeLabel: 'Academy', why: 'has a GPS record for this session' });
  assert(f.title === 'No GPS record for Academy.' && f.body === 'None of the 5 athletes in Academy has a GPS record for this session. Nothing is missing — the filter is what is empty.' && f.action?.label === 'Show the whole squad', 'a filter that leaves nothing: the denominator, the why, the one action that widens the filter');
  const c = clubEmptyCopy({ what: 'GPS record', fills: 'x' });
  assert(c.title === 'No GPS record on record for the club.' && c.action === null, 'nothing on record for the club: no action');
  const page = strip(read('src/app/(staff)/reports/training/page.tsx'));
  assert(/trainingFilterEmpty = filterEmptyCopy\(\{\s*what: 'GPS record',\s*inScope: scopeSize,/.test(page) && /matchFilterEmpty = filterEmptyCopy\(\{\s*what: 'match GPS record',/.test(page), 'both boards\' filter empties come from the rule, with the filter\'s own size');
  assert(/action=\{groupIds\.length > 0 \? \{ href: `\/reports\/training\$\{q\(\{ mode: 'training', session: sessionParam \}\)\}`, label: trainingFilterEmpty\.action!\.label \} : null\}/.test(page), 'the action clears the group filter and keeps the session — only when a filter is on');
  assert(/no GPS file has been imported yet\. A session appears here once its GPS file is imported from Settings › Imports\./.test(page), 'nothing on record says where the data enters — the "no import pipeline yet" claim is gone');
  assert(!/No athletes in this filter/.test(page) && !/no import pipeline/.test(page), 'the old lines are gone');
  assert(/the filter is what is empty/.test(read('docs/screens/23-training-report.md')), 'the spec says so');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
