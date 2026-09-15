/* The RPE package, change one (Isabella, 2026-09-13; migration 0118): RPE is
 * a club setting. When it is off, every dependent surface says so — the
 * absence rule (docs/decisions/absence-rule.md): the destination stays, the
 * words name the setting and who can change it, and nothing is shown as an
 * empty column or a zero. This guard pins the setting, the words and the
 * surfaces that carry them. */
import { readFileSync } from 'node:fs';
import { RPE_OFF_REPORT, RPE_OFF_ATHLETE, RPE_SWITCH_ON, RPE_SWITCH_OFF, RPE_SWITCH_SCOPE, rpeOffLine, complianceCountedLine, isRpeMetric, isRpeAnalyticsMetric } from '@/lib/rpeSetting';
import { TRAINING_LOAD_OFF_STATE } from '@/lib/reportCatalogue';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the setting');
{
  const mig = read('supabase/migrations/0118_org_collects_rpe.sql');
  assert(/alter table public\.organisations\s+add column collects_rpe boolean not null default true/.test(mig), '0118 adds organisations.collects_rpe, default on');
  assert(/create or replace function public\.generate_compliance_expectations/.test(mig) && /where requires_rpe and coalesce\(v_collects_rpe, true\)/.test(mig), 'and stops the RPE expectation for a club with it off');
  assert(/revoke execute on function public\.generate_compliance_expectations\(uuid, date\) from authenticated/.test(mig), 'with 0044\'s revokes repeated');
  assert(/collects_rpe = false/.test(read('supabase/tests/730_org_collects_rpe_test.sql')) && /the coach cannot flip it/.test(read('supabase/tests/730_org_collects_rpe_test.sql')), 'pgTAP 730 covers the default, the off state and who can flip it');
  const session = strip(read('src/lib/session.ts'));
  assert((session.match(/collectsRpe: boolean;/g) ?? []).length === 2, 'StaffContext and AthleteContext both carry collectsRpe');
  /* One read since 16 Sept 2026 (the performance pass): base() reads the
     organisation row — collects_rpe among its columns — in the same round as
     the revocation check, and both contexts take it from there. */
  assert(/select\('name, timezone, tier, collects_rpe'\)/.test(session) && (session.match(/collects_rpe \?\? true/g) ?? []).length === 2, 'read from organisations once, in base(), and carried into both contexts');
  const details = strip(read('src/lib/queries/orgDetails.ts'));
  assert(/export async function setCollectsRpe/.test(details) && /org\.collects_rpe\.changed/.test(details), 'setCollectsRpe writes the audit row');
}

console.log('\n2. the words (the absence rule)');
{
  assert(RPE_OFF_REPORT === TRAINING_LOAD_OFF_STATE, 'the report\'s off state is the addendum\'s confirmed sentence, once');
  const line = rpeOffLine('this board');
  assert(/does not collect session RPE/.test(line) && /Settings › Club/.test(line) && /sport scientist/.test(line), 'every off line names the setting, where it lives and who can change it');
  assert(!/\b0\b/.test(line) && !/\b0\b/.test(RPE_OFF_ATHLETE), 'and never shows a zero');
  assert(/CR-10/.test(RPE_SWITCH_ON) && /Ratings already recorded stay/.test(RPE_SWITCH_OFF), 'the switch says both consequences before it is pressed');
  const counted = complianceCountedLine({ collectsRpe: false, domains: ['wellness', 'training_rpe', 'gym'] });
  assert(/Counted: wellness check-ins, session ratings, gym sessions\./.test(counted) && /Session ratings are not counted/.test(counted), 'the compliance figure says which entry types it counted, and that ratings are not');
  assert(!/not counted/.test(complianceCountedLine({ collectsRpe: true, domains: ['wellness'] })), 'and says nothing of RPE when the club collects it');
  assert(isRpeMetric('training.total_session_load') && !isRpeMetric('training.sessions_attended'), 'session load is the RPE board metric; attendance is not');
  assert(isRpeAnalyticsMetric('acwr') && isRpeAnalyticsMetric('load') && isRpeAnalyticsMetric('rpe') && !isRpeAnalyticsMetric('gps_distance') && !isRpeAnalyticsMetric('gym_volume'), 'ACWR, load and RPE rest on the rating in analytics; distance and volume do not');
}

console.log('\n3. the switch, on Settings › Club');
{
  const page = strip(read('src/app/(staff)/settings/club/page.tsx'));
  assert(/collectsRpe/.test(page) && /<RpeSettingSwitch/.test(page) && /id="rpe"/.test(page), 'the club page carries the Session RPE card');
  assert(/isAdmin \?/.test(page.slice(page.indexOf('id="rpe"'))), 'the switch is the sport scientist\'s; everyone else reads the state');
  const sw = strip(read('src/components/RpeSettingSwitch/RpeSettingSwitch.tsx'));
  assert(/role="switch"/.test(sw) && /aria-checked/.test(sw) && /setCollectsRpe\(/.test(sw), 'a real switch, writing through setCollectsRpe');
  assert(/RPE_SWITCH_ON/.test(sw) && /RPE_SWITCH_OFF/.test(sw), 'both consequence paragraphs are on the card');
  /* Decision batch 14 September 2026, #4: the setting says what it does not
     cover — the gym's per-set RPE and planned RPE stay outside it. */
  assert(/session RPE after training/.test(RPE_SWITCH_ON) && /per-set RPE in the gym logger/.test(RPE_SWITCH_SCOPE) && /not switched off here/.test(RPE_SWITCH_SCOPE), 'the switch names itself "session RPE after training" and says the per-set gym RPE is not it');
  assert(/RPE_SWITCH_SCOPE/.test(sw) && /Session RPE after training/.test(sw), 'the scope sentence and the title are on the card');
  assert(/Session RPE after training/.test(strip(read('src/app/(staff)/settings/club/page.tsx'))) && /per-set RPE in the gym is not this setting/.test(strip(read('src/app/(staff)/settings/club/page.tsx'))), 'the club page says the same in its own caption');
}

console.log('\n4. every dependent surface says so');
{
  const surfaces: [string, RegExp, string][] = [
    ['src/lib/reportFigureCards.ts', /complianceCountedLine\(/, 'the compliance figure'],
    ['src/app/(staff)/reports/compliance/page.tsx', /collectsRpe/, 'the compliance report page'],
    ['src/app/(staff)/reports/compliance/pdf/route.tsx', /collectsRpe/, 'the compliance PDF'],
    ['src/app/(staff)/reports/compliance/export/route.ts', /complianceCountedLine\(/, 'the compliance CSV caption'],
    ['src/lib/queries/reports.ts', /omitRpe \? q\.neq\('domain', 'training_rpe'\) : q/, 'and the report does not count RPE expectations while the club has it off'],
    ['src/lib/queries/dashboard.ts', /off: rpeOffLine\('the RPE track'\)/, 'the dashboard\'s RPE track'],
    ['src/app/(staff)/dashboard/page.tsx', /t\.off/, 'rendered by the dashboard as words, not a bar'],
    ['src/app/(staff)/leaderboards/[leaderboardId]/page.tsx', /isRpeMetric\(board\.metric_key\) && !collectsRpe/, 'the effort board'],
    ['src/app/(staff)/leaderboards/manage/page.tsx', /Ranks nothing while session RPE is off/, 'the board list'],
    ['src/app/(staff)/analytics/page.tsx', /!collectsRpe && isRpeAnalyticsMetric\(metric\.key\)/, 'the analytics panels'],
    ['src/app/(staff)/reports/squad/page.tsx', /rpeOffLine\('the load section'\)/, 'the squad report\'s load section'],
    ['src/app/(staff)/reports/athlete/[athleteId]/page.tsx', /rpeOffLine\('session load'\)/, 'the athlete report\'s load card'],
    ['src/app/(staff)/squad/[athleteId]/page.tsx', /rpeOffLine\('this ratio'\)/, 'the profile\'s ACWR dial'],
    ['src/app/(athlete)/today/page.tsx', /fetchMyOutstanding\(db, athleteId, today, Date\.now\(\), \{ collectsRpe \}\)/, 'Today asks for no rating'],
    ['src/lib/queries/compliance.ts', /opts\.collectsRpe !== false \|\| e\.domain !== 'training_rpe'/, 'because the outstanding list drops the RPE rows'],
    ['src/app/(athlete)/rpe/[sessionId]/page.tsx', /RPE_OFF_ATHLETE/, 'the rating screen'],
    ['src/app/(athlete)/my-data/page.tsx', /RPE_OFF_ATHLETE/, 'and My data\'s sessions tab, in the athlete\'s words'],
  ];
  for (const [file, re, what] of surfaces) assert(re.test(strip(read(file))), `${what} (${file.split('/').slice(-2).join('/')})`);
  const dash = strip(read('src/app/(staff)/dashboard/page.tsx'));
  assert(/t\.off \?/.test(dash) || /t\.off\b/.test(dash), 'the dashboard branch is on the track\'s own off words');
}

console.log('\n5. the specs');
{
  assert(/collects_rpe/.test(read('docs/screens/47-settings.md')) && /Session RPE/.test(read('docs/screens/47-settings.md')), '47-settings.md: the Session RPE card');
  assert(/which entry types it counted/.test(read('docs/screens/20-compliance-report.md')), '20-compliance-report.md: the counted line');
  assert(/collects_rpe|Session RPE is off/.test(read('docs/screens/38-leaderboards.md')), '38-leaderboards.md: the effort board\'s off state');
  assert(/collects_rpe|does not collect session RPE/.test(read('docs/athlete/screens/01-today.md')) && /collects_rpe|does not collect session/.test(read('docs/athlete/screens/03-session-rating.md')), 'the athlete specs: Today and the rating screen');
  assert(/collects_rpe/.test(read('docs/04-data-model.md')), '04-data-model.md: the column');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
