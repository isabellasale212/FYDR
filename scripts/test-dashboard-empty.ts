/* PATTERN-S6 C8, last screen (2026-09-13): the dashboard's empties in the one
 * grammar — what, why, what would fill it, the nearest on record, "Nothing is
 * missing", one action. Three sentences: the day timeline with nothing on it,
 * a session card with nobody flagged, the flags panel with no open flag.
 *
 * Pure copy is exercised with values; the page and the query are regex reads
 * of source with comments stripped. */
import { readFileSync } from 'node:fs';
import { dayEmptyCopy, flagsAllClearLine, sessionAllClearLine } from '@/lib/dashboardEmpty';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the day with nothing scheduled');
{
  const next = dayEmptyCopy({ dayLabel: 'Tue 15 Sep', nearest: { date: '2026-09-17', label: 'Thu 17 Sep', title: 'Team run', direction: 'next' }, weekStart: '2026-09-14', weekEnd: '2026-09-19', groupsQs: undefined });
  assert(next.title === 'Nothing scheduled for Tue 15 Sep.', 'the title names the day');
  assert(next.body === 'Nothing is missing — no session is published for this day. The next session on record is Thu 17 Sep, Team run. A session appears here the moment it is published on the schedule.', 'why, the nearest on record, and what would fill it');
  assert(next.action?.href === '/dashboard?day=2026-09-17' && next.action.label === 'Show Thu 17 Sep', 'a nearest day inside the week strip: the one action goes to that day here');
  const filtered = dayEmptyCopy({ dayLabel: 'Tue 15 Sep', nearest: { date: '2026-09-17', label: 'Thu 17 Sep', title: 'Team run', direction: 'next' }, weekStart: '2026-09-14', weekEnd: '2026-09-19', groupsQs: 'g1,g2' });
  assert(filtered.action?.href === '/dashboard?day=2026-09-17&groups=g1%2Cg2', 'and keeps the group filter — the filter never empties a day, so there is nothing to clear');
  const far = dayEmptyCopy({ dayLabel: 'Tue 15 Sep', nearest: { date: '2026-10-01', label: 'Thu 1 Oct', title: 'Walkthrough session', direction: 'next' }, weekStart: '2026-09-14', weekEnd: '2026-09-19', groupsQs: undefined });
  assert(far.action?.href === '/schedule?date=2026-10-01' && far.action.label === 'Open the schedule for Thu 1 Oct', 'a nearest day outside the strip: the action opens the schedule on it');
  const prev = dayEmptyCopy({ dayLabel: 'Sat 19 Sep', nearest: { date: '2026-09-15', label: 'Tue 15 Sep', title: 'Gym', direction: 'previous' }, weekStart: '2026-09-14', weekEnd: '2026-09-19', groupsQs: undefined });
  assert(/The most recent session on record was Tue 15 Sep, Gym\./.test(prev.body) && prev.action?.label === 'Show Tue 15 Sep', 'nothing ahead: the most recent one behind, in the past tense');
  const none = dayEmptyCopy({ dayLabel: 'Tue 15 Sep', nearest: null, weekStart: '2026-09-14', weekEnd: '2026-09-19', groupsQs: undefined });
  assert(/No session is on record for the club yet\./.test(none.body) && none.action?.href === '/schedule' && none.action.label === 'Open the schedule', 'nothing on record at all: said so, and where the data enters');
  assert(!/filter/.test(next.body) && !/filter/.test(none.body), 'never "for this filter" — the filter narrows who is expected, not which sessions exist');
}

console.log('\n2. a session card with nobody flagged');
{
  assert(sessionAllClearLine({ expected: 14, past: false, scopeWords: 'the squad' }) === 'No flag against any of the 14 athletes expected. Nothing is missing.', 'planned: the count it is clean over');
  assert(sessionAllClearLine({ expected: 14, past: true, scopeWords: 'the squad' }) === 'No flag was raised against any of the 14 athletes expected. Nothing is missing.', 'passed: past tense');
  assert(sessionAllClearLine({ expected: 1, past: false, scopeWords: 'the squad' }) === 'No flag against the 1 athlete expected. Nothing is missing.', 'one athlete: singular');
  assert(sessionAllClearLine({ expected: 0, past: false, scopeWords: 'the squad' }) === 'No athlete is expected at this session yet. Nothing is missing — nobody has been added to it.', 'nobody expected, no filter: said so');
  assert(sessionAllClearLine({ expected: 0, past: false, scopeWords: 'Forwards' }) === 'Nobody in Forwards is expected at this session. Nothing is missing — the filter is what is empty.', 'nobody expected under a filter: the filter grammar');
}

console.log('\n3. the flags panel with no open flag');
{
  assert(flagsAllClearLine({ inScope: 27, scopeWords: 'the squad' }) === 'No open flag on any of the 27 athletes in the squad — none above a club threshold. Nothing is missing.', 'the count it is clear over, and the threshold it is measured against');
  assert(flagsAllClearLine({ inScope: 1, scopeWords: 'Rehab' }) === 'No open flag on the 1 athlete in Rehab — none above a club threshold. Nothing is missing.', 'singular, with the scope\'s words');
  assert(flagsAllClearLine({ inScope: 0, scopeWords: 'Leadership' }) === 'No athlete in Leadership. Nothing is missing — the filter is what is empty.', 'an empty scope: the filter grammar');
}

console.log('\n4. the page and the query');
{
  const q = strip(read('src/lib/queries/dashboard.ts'));
  assert(/export async function fetchNearestSessionDay\(/.test(q) && /\.gt\('starts_at', bounds\.to\)[\s\S]{0,200}\.order\('starts_at', \{ ascending: true \}\)/.test(q) && /\.lt\('starts_at', bounds\.from\)[\s\S]{0,200}\.order\('starts_at', \{ ascending: false \}\)/.test(q), 'the nearest session day: the next one, else the most recent before');
  assert(/expected: expectedCount,/.test(q) && /expected: number;/.test(q), 'a timeline entry carries the expected count as a number');
  const page = strip(read('src/app/(staff)/dashboard/page.tsx'));
  assert(/timeline\.length === 0 \? await fetchNearestSessionDay\(db, orgId, selectedDay, timezone\) : null/.test(page), 'the nearest-day read runs on the empty path only');
  assert(/dayEmpty = dayEmptyCopy\(\{/.test(page) && /<EmptyState[^>]*title=\{dayEmpty\.title\}/.test(page.replace(/\s+/g, ' ')) && /action=\{dayEmpty\.action\}/.test(page), 'the day empty renders through EmptyState with its one action');
  assert(!/<div className="card">\s*<EmptyState headingLevel=\{3\} title=\{dayEmpty/.test(page), 'bare — .empty draws its own frame, so no .card around it');
  assert(!/Nothing is scheduled for this day, for this filter\./.test(page), 'the old sentence is gone');
  assert(/sessionAllClearLine\(\{ expected: entry\.expected, past: entry\.past, scopeWords \}\)/.test(page), 'the session card all-clear');
  assert(!/Nothing was raised against this session\./.test(page) && !/Nobody flagged and nothing outstanding/.test(page), 'the old two lines are gone');
  assert(/allClearLine=\{flagsAllClearLine\(\{ inScope: scopeSize, scopeWords \}\)\}/.test(page), 'the flags panel is handed its all-clear line');
  const panel = strip(read('src/components/DashboardFlagsPanel/DashboardFlagsPanel.tsx'));
  assert(/allClearLine: string;/.test(panel) && /<span className="dash-flags-summary">\{allClearLine\}<\/span>/.test(panel) && !/No open flags right now/.test(panel), 'and renders it in place of the old sentence');
  assert(/one grammar/.test(read('docs/screens/01-dashboard.md')), 'the spec says so');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
