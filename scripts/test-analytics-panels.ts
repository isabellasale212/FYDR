/* PATTERN-S7 C6 (Isabella, 2026-09-13; built 2026-09-14): analytics as four
 * fixed panels of bars — a wholly premium destination covering every metric,
 * GPS included (docs/decisions/absence-rule.md, 14 September). Pins the rules
 * in lib/analyticsPanels — the grain, how a week bar collapses per measure,
 * the squad band under the floor, the zone drawn only from a fixed club rule,
 * the zero axis in words, the suppression and its one action — the page's
 * shape (no export, one accent, the readout, the stubs, the printed figure),
 * and the gate: the one database door (0125, dispatched on source_table),
 * D-20 at the route (refuse, no upsell page), absent from the sidebar. */
import { readFileSync } from 'node:fs';
import {
  DAY_GRAIN_MAX_DAYS,
  MIN_POINTS,
  PANELS,
  WINDOWS,
  axisTop,
  axisWords,
  bucketValue,
  bucketsFor,
  grainFor,
  grainWords,
  groundWords,
  measureFor,
  measureName,
  squadBand,
  suppression,
  titleFor,
  zoneFor,
  zoneWords,
} from '@/lib/analyticsPanels';
import { METRICS, SOURCE_TABLE } from '@/lib/analyticsBuilder';
import { MIN_ATHLETES_WITH_DATA } from '@/lib/smallSample';
import { PREMIUM_ONLY } from '@/components/Sidebar/rows';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const panel = (k: string) => PANELS.find((p) => p.key === k)!;
const first = (k: string) => panel(k).measures[0]!;

console.log('1. four fixed panels, each naming its measure and its registry entry — GPS included');
{
  assert(PANELS.map((p) => p.key).join() === 'load,wellness,gym,acwr' && PANELS.map((p) => p.title).join(' · ') === 'Training load · Wellness · Gym volume · Acute to chronic', 'Training load, Wellness, Gym volume, Acute to chronic — in that order');
  assert(PANELS.every((p) => p.measures.every((m) => /MET-0\d\d/.test(m.sentence))), 'every measure\'s sentence names its MET- id');
  assert(first('wellness').metric === 'readiness' && panel('wellness').axisTop === 100, 'wellness is MET-002 on 0 to 100 (D1 "out of 5" declined)');
  assert(first('load').measure === 'volume' && first('gym').measure === 'volume' && first('wellness').measure === 'scored' && first('acwr').measure === 'ratio', 'volume, scored, volume, ratio');
  assert(PANELS.map((p) => first(p.key).missingWord).join(' | ') === 'No session logged | Not submitted | No gym session | Not enough days on record', 'a period with nothing has its own words, never a zero');
  const load = panel('load');
  assert(load.param === 'load' && load.measures.map((m) => m.metric).join() === 'load,gps_distance,gps_high_speed_distance,gps_sprint_distance,gps_player_load,gps_accelerations,gps_decelerations', 'the load panel offers session load and the GPS family; SESSION LOAD is the default (15 Sept: the measure most likely to have data on first open — a premium club with no GPS import yet must not meet an empty panel)');
  assert(load.measures.every((m) => m.measure === 'volume'), 'every load measure is a volume: summed per day and per week');
  assert(PANELS.filter((p) => p.key !== 'load').every((p) => p.param === null && p.measures.length === 1), 'the other three panels are fixed to one measure');
  assert(measureFor(load, 'gps_sprint_distance').metric === 'gps_sprint_distance' && measureFor(load, 'nonsense').metric === 'load' && measureFor(panel('wellness'), 'load').metric === 'readiness', 'the URL picks a listed measure; anything else is the default; a fixed panel ignores it');
  assert(titleFor(load, first('load')) === 'Session load' && titleFor(load, measureFor(load, 'gps_distance')) === 'Total distance' && titleFor(panel('wellness'), first('wellness')) === 'Wellness', 'the heading follows the selected measure where the panel offers one — the card says what its number is; a fixed panel keeps its title');
  assert(measureName(measureFor(load, 'gps_player_load')) === 'Player load' && load.measures.every((m) => /^[A-Z][a-z ]+$/.test(measureName(m))), 'the measure\'s name is the sentence\'s first clause');
  for (const m of load.measures) assert(METRICS.some((d) => d.key === m.metric && (d.source === 'gps' || d.key === 'load')), `${m.metric} is in the catalogue`);
  assert(METRICS.filter((d) => d.source === 'gps').every((d) => SOURCE_TABLE[d.source] === 'gps_records'), 'GPS-ness is the source table, never a key prefix');
}

console.log('\n2. the grain: one bar per day up to a fortnight, one per week beyond');
{
  assert(DAY_GRAIN_MAX_DAYS === 14 && grainFor(14) === 'day' && grainFor(15) === 'week' && grainFor(84) === 'week', 'the fortnight is the edge');
  assert(WINDOWS.map((w) => w.days).join() === '14,42,84,182', '14 days · 6 weeks · 12 weeks · 26 weeks');
  const days = bucketsFor('2026-09-01', '2026-09-14', 'day');
  assert(days.length === 14 && days[0]!.start === '2026-09-01' && days[13]!.end === '2026-09-14', 'a fortnight is fourteen day buckets');
  const weeks = bucketsFor('2026-06-23', '2026-09-14', 'week');
  assert(weeks[0]!.start === '2026-06-23' && weeks[0]!.end === '2026-06-28' && weeks[1]!.start === '2026-06-29' && weeks[weeks.length - 1]!.end === '2026-09-14' && weeks.length === 13, 'weeks run Monday to Sunday and are clipped to the window at both ends');
}

console.log('\n3. what a week bar is, per measure');
{
  const values = new Map([['2026-09-07', 100], ['2026-09-09', 300], ['2026-09-11', 200]]);
  const week = { start: '2026-09-07', end: '2026-09-13', label: 'w' };
  assert(bucketValue(values, week, 'volume') === 600, 'a volume measure sums the days');
  assert(bucketValue(values, week, 'scored') === 200, 'a scored measure means the days that have a value');
  assert(bucketValue(values, week, 'ratio') === 200, 'the ratio is the value standing on the last day that has one');
  assert(bucketValue(new Map(), week, 'volume') === null && bucketValue(new Map(), week, 'scored') === null, 'a week with nothing has no bar — null, never zero');
  assert(grainWords(first('load'), 'week') === 'one bar per week, the week summed' && grainWords(first('wellness'), 'week') === 'one bar per week, the week meaned' && /as it stood at the end of the week/.test(grainWords(first('acwr'), 'week')) && grainWords(first('load'), 'day') === 'one bar per day', 'and the definition line says which');
}

console.log('\n4. the ground: the squad band under the one floor, or the club zone');
{
  const week = { start: '2026-09-07', end: '2026-09-13', label: 'w' };
  const four = new Map([1, 2, 3, 4].map((i) => [`a${i}`, new Map([['2026-09-08', i * 100]])]));
  assert(squadBand(four, week, 'volume') === null, `fewer than ${MIN_ATHLETES_WITH_DATA} athletes with data: no band`);
  const five = new Map([...four, ['a5', new Map([['2026-09-08', 500]])]]);
  const band = squadBand(five, week, 'volume')!;
  assert(band !== null && band.n === 5 && Math.round(band.lo) === 159 && Math.round(band.hi) === 441, 'five: mean ± 1 SD across the athletes with a value (300 ± 141)');
  assert(/ground: the squad's mean ± 1 SD per week, n = 28 athletes with data in whole squad/.test(groundWords({ zone: null, nWithData: 28, scope: 'whole squad', grain: 'week' })), 'the ground clause carries n');
  assert(/ground: none — 4 athletes with data in whole squad, fewer than 5/.test(groundWords({ zone: null, nWithData: 4, scope: 'whole squad', grain: 'week' })), 'and says none under the floor');
  const acwr = panel('acwr');
  const rules = [
    { metric: 'load.acwr', comparison: 'above', value: 1.3, name: 'Acute chronic ratio high', updated_at: '2026-09-13T00:00:00Z', applies_to_group_id: null, is_active: true },
    { metric: 'wellness.readiness_score', comparison: 'z_score', value: -1.5, name: 'Readiness below personal norm', updated_at: '2026-09-13T00:00:00Z', applies_to_group_id: null, is_active: true },
  ];
  const zone = zoneFor(acwr, rules)!;
  assert(zone !== null && zone.lo === null && zone.hi === 1.3 && zone.names.join() === 'Acute chronic ratio high', 'a fixed "above" rule is the zone\'s upper edge, named');
  assert(zoneFor(panel('wellness'), rules) === null, 'a z-score rule is not a line on a shared axis: no zone');
  assert(zoneFor(panel('load'), rules) === null && zoneFor(acwr, []) === null, 'no rule, no zone — no default 1.5 line');
  assert(zoneFor(acwr, [{ ...rules[0]!, is_active: false }]) === null && zoneFor(acwr, [{ ...rules[0]!, applies_to_group_id: 'g1' }]) === null, 'inactive and group-scoped rules draw nothing');
  assert(zoneWords(zone, first('acwr'), 'Jane Pemberton', '24 Aug') === '0 to 1.30 · Acute chronic ratio high · set by Jane Pemberton, 24 Aug', 'named and dated: "0 to 1.30 · Acute chronic ratio high · set by Jane Pemberton, 24 Aug"');
  assert(/ground: the club's zone, 0 to 1\.30/.test(groundWords({ zone: '0 to 1.30 · x · set by y, z', nWithData: 28, scope: 'whole squad', grain: 'week' })), 'where a zone is drawn the band is not, and the line says so');
}

console.log('\n5. the axis starts at zero and says so');
{
  const acwrP = panel('acwr');
  assert(axisTop(panel('load'), first('load'), [1711, 2600, null]) === 3000 && axisTop(panel('wellness'), first('wellness'), [73, 84]) === 100 && axisTop(acwrP, first('acwr'), [0.9, 1.3]) === 2, 'a nice ceiling above the data; a bounded scale keeps its top; the ratio never below 2');
  assert(axisWords(first('load'), 3000, 'week') === 'Axis 0 to 3,000 AU · one bar per week · hover or tap a bar for its value', '"Axis 0 to 3,000 AU · one bar per week · hover or tap a bar for its value"');
  const cmp = strip(read('src/components/AnalyticsPanel/AnalyticsPanel.tsx'));
  assert(/fill="var\(--accent\)"/.test(cmp) && !/--cmp-b|--chart-load|--chart-wellness|--chart-gym/.test(cmp), 'one accent: every bar, both series');
  assert(/data-series-label/.test(cmp) && /lastIndex/.test(cmp), 'a comparison names each series at the end of its own bars');
  assert(/strokeDasharray="3 3"/.test(cmp) && /data-stub/.test(cmp) && /strokeWidth=\{2\}/.test(cmp), 'a period with nothing is a 2px dashed stub');
  assert(/stroke="var\(--tick\)"/.test(cmp) && /fill="var\(--track\)"/.test(cmp), 'the band is two dashed --tick edges; the zone a --track fill');
  assert(/onMouseEnter/.test(cmp) && /onMouseLeave/.test(cmp) && /pinned/.test(cmp) && /cur\?\.pinned && cur\.i === i \? null : \{ i, pinned: true \}/.test(cmp), 'hover shows and leaving hides; a tap pins until the next tap');
  assert(!/transition|animate|@keyframes/.test(cmp), 'nothing else moves');
  assert(/className="visually-hidden"/.test(cmp) && /<table/.test(cmp), 'every value is in a visually-hidden table — nothing on hover alone');
}

console.log('\n6. suppression and the page');
{
  assert(MIN_POINTS === 3, 'three bars with a value is the floor');
  const held = suppression({ points: 2, buckets: 13, grain: 'week', days: 84, athleteName: 'Dan Okonkwo', widenHref: '/analytics?w=182', reportHref: '/reports/athlete/x' })!;
  assert(held !== null && held.reason === 'Not drawn: Dan Okonkwo has 2 weeks with a value in the last 84 days, out of 13 — fewer than 3. Nothing here is estimated from less.' && held.action.label === 'Widen the window', 'withheld with its reason and one action');
  assert(suppression({ points: 0, buckets: 26, grain: 'week', days: 182, athleteName: 'Dan Okonkwo', widenHref: null, reportHref: '/reports/athlete/x' })!.action.label === "Open Dan Okonkwo's report", 'at the widest window the action is the athlete\'s report');
  assert(suppression({ points: 3, buckets: 13, grain: 'week', days: 84, athleteName: 'x', widenHref: null, reportHref: 'y' }) === null, 'three draws');
  const page = strip(read('src/app/(staff)/analytics/page.tsx'));
  assert(/data-no-export/.test(page) && /Analytics has no export/.test(page) && !/Export CSV|Export PDF|\/export|\/pdf/.test(page), 'no export of its own');
  assert(/data-definition/.test(page) && /groundWords\(/.test(page) && /grainWords\(/.test(page), 'every panel states what it measures, the window, the grain, the ground and n');
  assert(/data-figure/.test(page) && /full detail in the athlete report/.test(page), 'the latest value is printed with a link to the report');
  assert(/fetchPerAthleteDaily\(db, orgId, metric, range, groupIds, null\)/.test(page), 'one read per panel: the whole scope, A and B and the band from the same maps');
  assert(/ap-suppressed/.test(page) && /btn-ghost/.test(page), 'the withheld card carries its 44px action');
  assert(!/analytics\/build/.test(page), 'no builder link');
  assert(/data-measure=\{m\.metric\}/.test(page) && /label="Measure"/.test(page) && /paramKey=\{panel\.param\}/.test(page), 'the load panel carries its measure control; each panel its own URL key');
  assert(/<h2 className="cmp-card-title" id=\{`p-\$\{panel\.key\}`\}>\s*\{titleFor\(panel, m\)\}/.test(page) && /\{m\.sentence\} · \{windowWords\}/.test(page) && !/\{panel\.title\}\s*<\/h2>/.test(page), 'select changes measure, heading and definition together');
}

console.log('\n7. premium: gone under D-20, and gated at the database (0125)');
{
  const page = strip(read('src/app/(staff)/analytics/page.tsx'));
  assert(/if \(!isPremium\(tier\)\) await refuse\(db, 'analytics_premium', '\/analytics'\);/.test(page), 'a basic club is refused at the URL, logged');
  assert(!/PlanGate/.test(page) && !/Upgrade|upsell/i.test(page), 'no upsell page: discovery lives on the Settings plan page, one place');
  assert(PREMIUM_ONLY.has('staff.analytics'), 'and the sidebar row is absent for a basic club');
  const q = strip(read('src/lib/queries/analytics.ts'));
  const engine = q.slice(q.indexOf('export async function fetchPerAthleteDaily'), q.indexOf('\n}\n', q.indexOf('export async function fetchPerAthleteDaily')));
  assert(/\.rpc\('analytics_daily_rows', \{ p_source_table: SOURCE_TABLE\[metric\.source\]/.test(engine), 'every panel read goes through analytics_daily_rows, dispatched on the source table');
  assert(!/\.from\('(gps_records|training_entries_current|wellness_entries_current|gym_set_logs)'\)/.test(engine), 'and never reads a source table directly');
  const mig = read('supabase/migrations/0125_analytics_tier_gate.sql').replace(/^\s*--.*$/gm, '');
  assert(/if v_org is null or not public\.auth_org_is_premium\(\) then\s*return;/.test(mig), 'the function returns no rows to a club that is not premium — 0119\'s helper, keep and hide, never an error');
  assert(/auth_has_any_role\(array\['sport_scientist'\]/.test(mig), 'and none to anyone but the sport scientist (D-02)');
  assert(/p_source_table = 'gps_records'/.test(mig) && /p_source_table = 'gym_set_logs'/.test(mig) && /raise exception 'analytics_daily_rows: unknown source_table/.test(mig) && !/like 'gps\.%'/.test(mig), 'dispatched on source_table, refusing any other, no key prefix');
  assert(/and a\.in_data/.test(mig) && /gs\.superseded_by is null/.test(mig) && /gs\.is_warmup = false/.test(mig), 'the in_data denominator, live sets only, no warm-ups');
  const t = read('supabase/tests/800_analytics_tier_gate_test.sql');
  assert(/keep and hide/.test(t) && /a coach gets no rows/.test(t) && /the org scope/.test(t) && /downgraded: hidden again/.test(t), 'tested: empty not error, the role, the org scope, restore');
  const css = read('src/styles/base.css');
  assert(/\.ap-suppressed \.btn-ghost \{\s*min-height: var\(--tap-min\);/.test(css), 'and the action is 44px');
  let builderGone = true;
  try { readFileSync('src/app/(staff)/analytics/build/page.tsx'); builderGone = false; } catch { /* removed */ }
  assert(builderGone, '/analytics/build is gone (D2: it stayed until C6 replaced it)');
}

console.log(failed === 0 ? '\nall passed' : `\n${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
