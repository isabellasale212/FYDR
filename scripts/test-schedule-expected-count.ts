/* PATTERN-S4 C5 — expected attendees are distinct athletes, with the
 * denominator (2026-09-13). The board: "Counts are never printed by adding
 * group sizes. Where the distinct number is unknown the copy names the
 * groups; where stated it carries its denominator, as '0 of 30 athletes are
 * expected'." The workspace already resolves a session's athletes as a Set
 * across its groups (ScheduleWorkspace's `effective`), so the number is
 * always known here; the sentence is pure and the read is small. */
import { readFileSync } from 'node:fs';
import { expectedAthletesLine } from '@/lib/scheduleExpected';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the sentence');
{
  assert(expectedAthletesLine({ expected: 18, squad: 30 }) === '18 of 30 athletes are expected', '"18 of 30 athletes are expected"');
  assert(expectedAthletesLine({ expected: 1, squad: 30 }) === '1 of 30 athletes is expected', 'one athlete: "is"');
  assert(expectedAthletesLine({ expected: 0, squad: 30 }) === 'Nobody is expected — staff only', 'nobody: staff only, the panel\'s own rule');
  assert(expectedAthletesLine({ expected: 30, squad: 30 }) === 'All 30 athletes are expected', 'the whole squad is said as such');
  assert(expectedAthletesLine({ expected: 5, squad: 0 }) === '5 athletes are expected', 'no squad count on record: the number alone, never "of 0"');
}

console.log('\n2. distinct, never a sum: the workspace resolves a Set across the groups');
{
  const ws = strip(read('src/components/ScheduleGrid/ScheduleWorkspace.tsx'));
  assert((ws.match(/\[\.\.\.new Set\([a-zA-Z.]*groupIds\.flatMap\(\(gid\) => groupMembership\[gid\] \?\? \[\]\)\)\]/g) ?? []).length >= 3, 'a draft, an edited session and a duplicate each resolve their athletes as one Set across the selected groups');
  assert(/squadSize=\{squadSize\}/.test(ws), 'and the squad size reaches the panel');
  const page = strip(read('src/app/(staff)/schedule/page.tsx'));
  assert(/fetchSquadSize\(db, orgId\)/.test(page), 'the page reads the denominator once');
  const q = strip(read('src/lib/queries/groups.ts'));
  assert(/export async function fetchSquadSize\(/.test(q) && /\.neq\('status', 'left_club'\)/.test(q) && /\.is\('deleted_at', null\)/.test(q), 'active athletes who have not left the club — the squad list\'s own filter');
}

console.log('\n3. the panel says it beside the groups');
{
  const panel = strip(read('src/components/ScheduleGrid/SelectedSessionPanel.tsx'));
  assert(/squadSize: number;/.test(panel), 'the panel takes the squad size');
  assert(/expectedAthletesLine\(\{ expected: session\.athleteIds\.length, squad: squadSize \}\)/.test(panel), 'and counts the session\'s resolved athletes against it');
  assert(/className="sg-preview-foot"[\s\S]{0,400}expectedAthletesLine/.test(panel), 'on the preview footer, with "Publishes to Backs + Forwards"');
}

console.log('\n4. the spec');
{
  const spec = read('docs/screens/07-schedule.md');
  assert(/athletes are expected/.test(spec) && /distinct/.test(spec), '07-schedule.md says the count is distinct and carries its denominator');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
