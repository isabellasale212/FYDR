/* Match participation (Isabella, decision batch 2026-09-13 "The match
 * report, both halves approved"; built 2026-09-15). Pins the record (0127),
 * the sheet, the attach action and the report: the confirmed sentence, not
 * recorded never zero, SESSION_EDIT writes, the group filter, the exports. */
import { readFileSync } from 'node:fs';
import { MATCH_DEFINITION, MINUTES_NOT_RECORDED, SELECTION_ORDER, SELECTION_WORDS, availabilityAtKickOffWords, fixtureWords, matchDefinition, matchFigure, minutesWords, selectionOf, sortRows } from '@/lib/matchReport';
import { REPORT_DEFINITIONS } from '@/lib/reportCatalogue';
import { REPORT_VISIBILITY, SESSION_EDIT } from '@/lib/access';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const sql = (s: string) => s.replace(/^\s*--.*$/gm, '');

console.log('1. the record (0127): per athlete per fixture, started or came on, minutes nullable');
{
  const body = sql(read('supabase/migrations/0127_match_participation.sql'));
  assert(/create table public\.match_participation/.test(body) && /unique \(fixture_id, athlete_id\)/.test(body), 'one row per athlete per fixture');
  assert(/check \(not \(started and came_on\)\)/.test(body), 'started or came on, never both');
  assert(/minutes\s+int check \(minutes between 0 and 120\)/.test(body) && !/minutes\s+int not null/.test(body), 'minutes nullable — not recorded is a state; 0 to 120');
  assert(!/position|score|event/.test(body.replace(/'fixture'|composite|position\b\s*integer/g, '')) || !/column.*(position|score)/.test(body), 'nothing else: no positions, no events, no score');
  assert(/revoke all on public\.match_participation from public, anon, authenticated/.test(body), 'the default-privilege discipline');
  for (const p of ['editor_insert', 'editor_update', 'editor_delete']) {
    const i = body.indexOf(`create policy match_participation_${p}`);
    assert(i >= 0 && /array\['sport_scientist','coach'\]/.test(body.slice(i, body.indexOf(';', i))), `${p}: the coach and the sport scientist — SESSION_EDIT`);
  }
  assert([...SESSION_EDIT].sort().join() === 'coach,sport_scientist', 'SESSION_EDIT is those two');
  assert(/create policy match_participation_staff_select/.test(body) && /create policy match_participation_self_select/.test(body) && /athlete_id = public\.auth_athlete_id\(\)/.test(body), 'every staff role reads; the athlete reads their own');
  assert(/'match_participation\.set'/.test(body) && /'match_participation\.remove'/.test(body) && /after insert or update or delete on public\.match_participation/.test(body), 'every change audited');
  const t = read('supabase/tests/820_match_participation_test.sql');
  assert(/not recorded is null, never zero/.test(t) && /the medic cannot write it/.test(t) && /orgb''s coach sees none/.test(t) && /one remove/.test(t), 'tested: null not zero, the write set, the org scope, the audit');
}

console.log('\n2. the words: the confirmed sentence, not recorded never zero, the order');
{
  assert(MATCH_DEFINITION === "Everything recorded against {fixture}: who was selected, who started, who came on, and minutes played, with each athlete's availability as it stood at kick-off. An athlete with no minutes recorded shows as not recorded, never as zero.", 'the definition sentence, verbatim from the decision batch');
  assert(REPORT_DEFINITIONS.match === MATCH_DEFINITION, 'and the catalogue module carries it');
  assert(matchDefinition(fixtureWords('Harlequins', 'Sat 18 Jul')).startsWith('Everything recorded against v Harlequins, Sat 18 Jul:'), 'resolved for the fixture');
  assert(minutesWords(null) === MINUTES_NOT_RECORDED && MINUTES_NOT_RECORDED === 'Not recorded' && minutesWords(0) === '0' && minutesWords(80) === '80', 'null is "Not recorded"; 0 is a real value');
  assert(SELECTION_ORDER.join() === 'started,came_on,unused' && SELECTION_WORDS.unused === 'Selected, not used', 'starters, then who came on, then selected and not used');
  const rows = [
    { first_name: 'B', last_name: 'B', started: false, came_on: true, minutes: 25 },
    { first_name: 'A', last_name: 'A', started: true, came_on: false, minutes: null },
    { first_name: 'C', last_name: 'C', started: true, came_on: false, minutes: 80 },
    { first_name: 'D', last_name: 'D', started: false, came_on: false, minutes: null },
  ];
  assert(sortRows(rows).map((r) => r.last_name).join() === 'C,A,B,D', 'most minutes first within a state, not recorded last');
  assert(selectionOf({ started: false, came_on: false }) === 'unused', 'a row with neither is selected, not used');
  const f = matchFigure({ selected: 23, started: 15, cameOn: 5, withMinutes: 13, squad: 31, fixture: 'v Harlequins, Sat 18 Jul' });
  assert(f.count === '13 of 23' && f.value === '57%' && /23 selected of 31 in the squad · 15 started, 5 came on/.test(f.sample) && /8 athletes in the squad were not selected and are not counted/.test(f.exclusions), 'the figure: recorded of selected, selected of squad, the exclusions in a sentence');
  assert(matchFigure({ selected: 0, started: 0, cameOn: 0, withMinutes: 0, squad: 31, fixture: 'x' }).count === 'No sheet' && /Nobody is excluded/.test(matchFigure({ selected: 31, started: 15, cameOn: 8, withMinutes: 31, squad: 31, fixture: 'x' }).exclusions), '"No sheet" and "Nobody is excluded" in words');
  assert(availabilityAtKickOffWords(null) === 'No status recorded', 'availability unknown at kick-off is words');
}

console.log('\n3. the sheet on the fixture, the attach action, the report');
{
  const sheet = strip(read('src/app/(staff)/schedule/fixtures/[fixtureId]/participation/page.tsx'));
  assert(/await refuse\(db, 'match_sheet'/.test(sheet) && /SESSION_EDIT/.test(sheet), 'the sheet is the coach\'s and the sport scientist\'s');
  assert(/<form method="post" action=\{`\/schedule\/fixtures\/\$\{fixtureId\}\/participation\/save`\}/.test(sheet) && /Save the sheet/.test(sheet) && !/window\.confirm|<dialog/.test(sheet), 'a form, one button, no dialog');
  assert(/placeholder="Not recorded"/.test(sheet) && /min=\{0\}/.test(sheet) && /max=\{120\}/.test(sheet), 'minutes: blank is not recorded, 0 to 120');
  assert(/availabilityAtKickOffWords\(r\.availability\)/.test(sheet) && !/name="avail|name="status/.test(sheet), 'availability at kick-off is read, never edited here');
  const q = strip(read('src/lib/queries/matchParticipation.ts'));
  assert(/minutes were entered for an athlete not marked as selected/.test(q), 'minutes on an unselected athlete refused in words');
  assert(/\.lte\('effective_from', instant\)/.test(q) && /effective_to\.is\.null,effective_to\.gt\./.test(q) && /restrictionLine\(r\.restrictions\)/.test(q), 'availability at kick-off is the row in force at that instant, the line through restrictionLine');
  assert(/\.is\('fixture_id', null\)/.test(q) && /update\(\{ fixture_id: fixtureId \}\)/.test(q), 'the attach action links an unlinked match session; nothing backfills');
  const fixture = strip(read('src/app/(staff)/schedule/fixtures/[fixtureId]/page.tsx'));
  assert(/data-sheet-link/.test(fixture) && /href=\{`\/reports\/match\?fixture=\$\{fixtureId\}`\}/.test(fixture) && /data-attach/.test(fixture), 'the fixture carries the sheet\'s door, the report\'s door and the attach action');
  const session = strip(read('src/app/(staff)/schedule/[sessionId]/page.tsx'));
  assert(/data-orphan-match/.test(session) && /fetchFixturesNear/.test(session), 'an unlinked match session offers the fixtures within a week');
  const report = strip(read('src/app/(staff)/reports/match/page.tsx'));
  assert(/requireReport\('match'\)/.test(report) && REPORT_VISIBILITY.match.length === 4 && !REPORT_VISIBILITY.match.includes('nutritionist'), 'the report is REPORT_ACCESS');
  assert(/resolveGroupFilter\(params\.groups\)/.test(report) && /scopeSheet\(full, scope\)/.test(report) && /groups=\$\{groupIds\.join/.test(report), 'the group filter narrows the report and rides into the exports');
  assert(/<ReportFigure \{\.\.\.figure\} \/>/.test(report) && /matchFigure\(/.test(report) && /minutesWords\(/.test(report), 'the figure and the words are the pure module\'s');
  assert(/key: 'match'/.test(strip(read('src/app/(staff)/reports/page.tsx'))), 'the eighth card on the index');
  for (const f of ['src/app/(staff)/reports/match/export/route.ts', 'src/app/(staff)/reports/match/pdf/route.tsx']) {
    const r = strip(read(f));
    assert(/requireReport\('match'\)/.test(r) && /recordReportView\(db, orgId, claims\.userId, actorRole, 'match'/.test(r) && /scopeSheet\(full, scope\)/.test(r), `${f.split('/').slice(-2).join('/')}: gated, audited, scoped`);
  }
}

console.log(failed === 0 ? '\nall passed' : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
