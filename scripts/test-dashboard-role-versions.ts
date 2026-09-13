/* STAFF-SS-01 C2 — the role versions of the dashboard (2026-09-13). The
 * board's frame 7: the S&C reads four summary cards and no week strip, the
 * nutritionist two; the sport scientist, coach and medic read the full
 * dashboard. docs/access-matrix.md §4.2 outranks the board for the
 * nutritionist: nothing derived from availability is drawn for them.
 *
 * The rule is pure (lib/dashboardVersion.ts) and exercised with roles here;
 * the queries and the page are read from source, since the repo has no
 * React test renderer. */
import { readFileSync } from 'node:fs';
import {
  attentionDomains,
  dashboardTiles,
  dashboardVersion,
  LOAD_FLAG_DOMAINS,
  showsAvailability,
  showsWeekStrip,
} from '@/lib/dashboardVersion';
import { NUTRITIONIST_FLAG_DOMAIN } from '@/lib/access';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the version follows the role, and roles add up');
{
  assert(dashboardVersion(['sport_scientist']) === 'full' && dashboardVersion(['coach']) === 'full' && dashboardVersion(['medic']) === 'full', 'sport scientist, coach and medic read the full dashboard');
  assert(dashboardVersion(['strength_conditioning']) === 'sc', 'an S&C alone reads the S&C version');
  assert(dashboardVersion(['nutritionist']) === 'nutritionist', 'a nutritionist alone reads the nutritionist version');
  assert(dashboardVersion(['strength_conditioning', 'coach']) === 'full', 'an S&C who is also a coach reads the full dashboard — permissions add up');
  assert(dashboardVersion(['nutritionist', 'strength_conditioning']) === 'sc', 'a nutritionist who is also S&C reads the wider of the two');
  assert(dashboardVersion([]) === 'full', 'no role at all falls to the widest read — the page gate, not this rule, decides who is here');
}

console.log('\n2. what each version draws');
{
  assert(JSON.stringify(dashboardTiles('full')) === JSON.stringify(['needYou', 'wellness', 'available', 'openFlags', 'toMatchday']), 'full: the five tiles, unchanged');
  assert(JSON.stringify(dashboardTiles('sc')) === JSON.stringify(['needYou', 'gymToday', 'weighIns', 'available']), 'S&C: attention, Gym today, Weigh-ins, Availability — four across');
  assert(JSON.stringify(dashboardTiles('nutritionist')) === JSON.stringify(['needYou', 'weighIns']), 'nutritionist: attention and Weigh-ins — two');
  assert(showsWeekStrip('full') && !showsWeekStrip('sc') && !showsWeekStrip('nutritionist'), 'the week strip gives way for the S&C and the nutritionist');
  assert(showsAvailability('full') && showsAvailability('sc') && !showsAvailability('nutritionist'), 'availability-derived regions are withheld from the nutritionist (access-matrix §4.2)');
  assert(!dashboardTiles('nutritionist').includes('available'), 'so no Available tile for them either');
}

console.log('\n3. the attention domains — "load and weigh-ins only" for the S&C, their own domain for the nutritionist');
{
  assert(attentionDomains('full') === 'all', 'the full dashboard counts every domain');
  assert(attentionDomains('sc') === LOAD_FLAG_DOMAINS && JSON.stringify(LOAD_FLAG_DOMAINS) === JSON.stringify(['gps', 'training', 'gym', 'testing']), 'the S&C counts GPS, session RPE, gym and testing flags');
  assert(!LOAD_FLAG_DOMAINS.includes('wellness') && !LOAD_FLAG_DOMAINS.includes('compliance'), 'and not wellness or compliance');
  const n = attentionDomains('nutritionist');
  assert(n !== 'all' && n.length === 1 && n[0] === NUTRITIONIST_FLAG_DOMAIN, 'the nutritionist counts the nutrition domain — the same word the flag-edit policy uses');
}

console.log('\n4. the queries take the domains, and the two new tiles have real reads');
{
  const flags = strip(read('src/lib/queries/flags.ts'));
  assert(/export async function fetchDashboardAttention\([\s\S]*?domains: 'all' \| readonly FlagDomain\[\] = 'all'/.test(flags), 'fetchDashboardAttention filters by domain');
  assert(/if \(domains !== 'all'\) q = q\.in\('domain', \[\.\.\.domains\]\);/.test(flags), 'in the query, not after the page cap');
  assert(/export async function fetchOpenFlagAthleteCount\([\s\S]*?domains: 'all' \| readonly FlagDomain\[\] = 'all'/.test(flags), 'and the Flags badge counts the same athletes as the attention card');
  const dash = strip(read('src/lib/queries/dashboard.ts'));
  assert(/attentionDomains: 'all' \| readonly FlagDomain\[\]/.test(dash) && /fetchDashboardAttention\(db, orgId, wallClockToday, groupIds, 5, attentionDomains\)/.test(dash), 'fetchHeadlineStats passes them to the attention read');
  assert(/flagsToday\.filter\(\(f\) => attentionDomains === 'all' \|\| attentionDomains\.includes\(f\.domain as FlagDomain\)\)/.test(dash), 'and "Need you" counts the same domains');
  assert(/export async function fetchGymToday\(/.test(dash) && /\.from\('gym_session_logs_current'\)/.test(dash) && /session_type === 'gym'/.test(dash), 'Gym today: today\'s scheduled gym session and the athletes who have logged today');
  assert(/export async function fetchWeighInsToday\(/.test(dash) && /\.from\('body_composition'\)[\s\S]{0,200}\.eq\('measured_on', effectiveToday\)/.test(dash), 'Weigh-ins: body_composition rows measured today, over the squad in scope');
}

console.log('\n5. the page resolves the version from the claims and hands it down');
{
  const page = strip(read('src/app/(staff)/dashboard/page.tsx'));
  assert(/const version = dashboardVersion\(claims\.roles\);/.test(page), 'the version comes from the server-side claims, never the client');
  assert(/attentionDomains\(version\)/.test(page), 'the attention domains follow it');
  assert(/version === 'sc' \? fetchGymToday\(/.test(page) && /version !== 'full' \? fetchWeighInsToday\(/.test(page), 'the two new reads run only for the versions that draw them');
  assert(/\{showsWeekStrip\(version\) \? \(/.test(page), 'the week strip gives way');
  assert(/\{showsAvailability\(version\) \? \(/.test(page), 'the readiness card is withheld from the nutritionist');
  const layout = strip(read('src/app/(staff)/layout.tsx'));
  assert(/fetchOpenFlagAthleteCount\(db, orgId, groupIds, attentionDomains\(dashboardVersion\(claims\.roles\)\)\)/.test(layout), 'the Flags badge in the shell counts the version\'s domains');
  const tiles = strip(read('src/components/DashboardHeadlineStats/DashboardHeadlineStats.tsx'));
  assert(/tiles: readonly DashboardTile\[\]/.test(tiles) && /tiles\.includes\('gymToday'\)/.test(tiles) && /tiles\.includes\('weighIns'\)/.test(tiles), 'the tiles component draws the version\'s list');
  assert(/Gym today/.test(tiles) && /Weigh-ins/.test(tiles) && /not submitted\$\{isAnchoredToPast \? ' that day' : ' this morning'\}/.test(tiles), 'with the board\'s words ("6 not submitted this morning")');
  assert(/No gym session today/.test(tiles), 'and says when there is no gym session, rather than 0 of 0');
}

console.log('\n6. the spec');
{
  const spec = read('docs/screens/01-dashboard.md');
  assert(/S&C/.test(spec) && /Weigh-ins/.test(spec) && /Gym today/.test(spec) && /nutritionist/.test(spec), '01-dashboard.md describes the role versions');
  const matrix = read('docs/access-matrix.md');
  assert(/On the Dashboard this is built/.test(matrix) && /lib\/dashboardVersion\.ts/.test(matrix), 'access-matrix §4.2 records that the dashboard now enforces it');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
