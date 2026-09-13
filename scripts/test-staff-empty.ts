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
  const squad = staffEmptyCopy({ domain: 'testing', firstName: 'the squad', periodKey: 'month', rangeLabel: 'Last 28 days', latest: '2026-07-24', latestLabel: 'Fri 24 Jul', seasonStart: '2026-07-01', today: '2026-09-13' });
  assert(/^The squad's last test result was Fri 24 Jul, 51 days ago\./.test(squad.body), 'a sentence about the squad starts with a capital');
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
  assert(/action\?: \{ href: string; label: string; clearsGroupFilter\?: boolean \} \| null;/.test(es) && /className="btn-ghost empty-action"/.test(es), 'EmptyState takes the one action');
  /* Review 2026-09-13: §0ak — ?groups= overrides one page load and the cookie
     is the shared filter, so a "Show the whole squad" link to a bare URL falls
     back to the cookie and does nothing for a coach who chose the group by
     chip. The action must clear the cookie the way the chip row does. */
  assert(/action\.clearsGroupFilter\s*\?\s*\(\s*<ClearGroupFilterAction href=\{action\.href\} label=\{action\.label\} \/>/.test(es), 'a filter-clearing action is the client component, not a Link');
  const cga = strip(read('src/components/EmptyState/ClearGroupFilterAction.tsx'));
  assert(/^'use client';/.test(cga.trimStart()) && /writeGroupFilterCookie\(\[\]\);[\s\S]{0,300}if \(current === href\) router\.refresh\(\);\s*else router\.push\(href\);/.test(cga) && /className="btn-ghost empty-action"/.test(cga), 'it writes the empty cookie (the one place, lib/groupFilterCookie) and then navigates');
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
  const page = strip(read('src/app/(staff)/reports/gps/page.tsx'));
  assert(/trainingFilterEmpty = filterEmptyCopy\(\{\s*what: 'GPS record',\s*inScope: scopeSize,/.test(page) && /matchFilterEmpty = filterEmptyCopy\(\{\s*what: 'match GPS record',/.test(page), 'both boards\' filter empties come from the rule, with the filter\'s own size');
  assert(/action=\{groupIds\.length > 0 \? \{ href: `\/reports\/gps\$\{q\(\{ mode: 'training', session: sessionParam \}\)\}`, label: trainingFilterEmpty\.action!\.label, clearsGroupFilter: true \} : null\}/.test(page), 'the action clears the group filter and keeps the session — only when a filter is on'); // repointed 2026-09-13: clearsGroupFilter
  assert(/no GPS file has been imported yet\. A session appears here once its GPS file is imported from Settings › Imports\./.test(page), 'nothing on record says where the data enters — the "no import pipeline yet" claim is gone');
  assert(!/No athletes in this filter/.test(page) && !/no import pipeline/.test(page), 'the old lines are gone');
  assert(/the filter is what is empty/.test(read('docs/screens/23-gps-report.md')), 'the spec says so');
}

console.log('\n5. the squad weekly report (2026-09-13)');
{
  const page = strip(read('src/app/(staff)/reports/squad/page.tsx'));
  assert(/No open flag on any of the \$\{report\.athleteCount\} athlete/.test(page) && /Nothing is missing\./.test(page), 'the all-clear says what was checked, over whom, and that nothing is missing');
  assert(/const scopeWords = groupIds\.length === 0 \? 'the squad' : scopeLabelRaw;/.test(page), '"the squad" for no filter, the chip\'s own name otherwise');
  assert(/loadFilterEmpty = filterEmptyCopy\(\{\s*what: 'athlete with GPS load',/.test(page) && /is still building the \$\{ACWR_CHRONIC_WINDOW_DAYS\}-day baseline\. Nothing is missing\./.test(page), 'the load table\'s two empties: the filter grammar, and the baseline said with its number');
  assert(!/'No athlete in this filter\.'/.test(page) && !/'No ratio computable yet\.'/.test(page), 'the old lines are gone');
  assert(/Nothing is missing/.test(read('docs/screens/21-squad-weekly-report.md')), 'the spec says so');
}

console.log('\n6. the testing report (2026-09-13)');
{
  const q = strip(read('src/lib/queries/testingReport.ts'));
  assert(/export async function fetchLatestTestResultDate\(/.test(q) && /\.from\('test_results'\)[\s\S]{0,200}\.order\('test_date', \{ ascending: false \}\)/.test(q), 'the most recent result on record for a test, any period, in scope');
  const page = strip(read('src/app/(staff)/reports/testing/page.tsx'));
  assert(/fetchLatestTestResultDate\(db, orgId, groupIds, selectedTestId\)/.test(page) && /staffEmptyCopy\(\{\s*domain: 'testing',\s*firstName: scopeWords,/.test(page), 'the by-test empty names it, in the grammar');
  // Repointed 2026-09-13: the href is computed once above the JSX (byTestEmptyHref), not inline.
  assert(/title=\{byTestEmpty!\.title\}/.test(page) && /byTestEmpty\.action\.period\}\$\{selectedTestId[^\n]*&groups=/.test(page), 'with the one action that widens the period and keeps the test and the filter');
  assert(/athletesFilterEmpty = filterEmptyCopy\(\{ what: 'athlete', inScope: 0, scopeLabel: scopeWords, why: 'is on the roster' \}\)/.test(page), 'a filter with no athletes: the filter grammar');
  /* Review note 2026-09-13: fetchLatestTestResultDate returns null both when
     nothing has ever been recorded and when the filter matches no athletes;
     the by-test tab must tell the two apart, in the filter grammar. */
  assert(/scopeIsEmpty = groupIds\.length > 0 && byAthlete\.rows\.length === 0/.test(page), 'the by-test tab knows an empty scope from nothing on record');
  assert(/byTestEmpty = !selectedDefinition\s*\?\s*null\s*:\s*scopeIsEmpty\s*\?\s*filterEmptyCopy\(\{ what: 'test result', inScope: 0, scopeLabel: scopeWords, why: 'is on the roster' \}\)/.test(page), 'an empty scope gets the filter sentence, not "never recorded"');
  assert(/byTestEmptyHref = !byTestEmpty\?\.action\s*\?\s*null\s*:\s*scopeIsEmpty\s*\?\s*`\/reports\/testing\?period=\$\{period\.key\}\$\{selectedTestId \? `&test=\$\{selectedTestId\}` : ''\}`/.test(page), 'its action clears the filter and keeps the period and the test');
  assert(/action=\{byTestEmptyHref \? \{ href: byTestEmptyHref, label: byTestEmpty!\.action!\.label, clearsGroupFilter: scopeIsEmpty \} : null\}/.test(page), 'and the EmptyState renders it');
  const rawPage = read('src/app/(staff)/reports/testing/page.tsx');
  assert(/on populated loads too/.test(rawPage), 'the comment says the read runs on every load');
  assert(/selectedTestId derives from\s+selectedDefinition/.test(rawPage), 'the non-null assertions say why they are sound');
  assert(/label: athletesFilterEmpty\.action!\.label, clearsGroupFilter: true/.test(page) && /clearsGroupFilter: scopeIsEmpty/.test(page), 'both filter empties on this report clear the cookie');
  const training = strip(read('src/app/(staff)/reports/gps/page.tsx'));
  assert(/label: matchFilterEmpty\.action!\.label, clearsGroupFilter: true/.test(training) && /label: trainingFilterEmpty\.action!\.label, clearsGroupFilter: true/.test(training), 'and so do the training report\'s two');
  assert(/clears the filter — the cookie/.test(read('docs/screens/23-gps-report.md')) && /clears the filter — the cookie/.test(read('docs/screens/22-testing-report.md')), 'both specs say the action clears the shared filter');
  assert(/No test defined for the club yet\./.test(page) && /Nothing is missing — no test has been defined/.test(page), 'no test defined: nothing is missing, where the data enters');
  assert(!/No result recorded for this test in/.test(page) && !/No athletes in the current scope/.test(page), 'the old lines are gone');
  assert(/one grammar/.test(read('docs/screens/22-testing-report.md')), 'the spec says so');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
