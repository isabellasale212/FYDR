/* A created fixture has to become visible somewhere.
 *
 * THE BUG, reported as "creating a new fixture does nothing, nothing appears
 * afterward". The write was never broken: createFixture inserts the row and the
 * form redirects to /schedule. What was broken is that the schedule surfaced
 * only ONE fixture per week — `weekFixtures[0]`, the earliest — as a single line
 * of eyebrow text. Ashcombe's scratch week already held Bristol Bears on the
 * Tuesday, so a fixture created for the Saturday was written, fetched, sorted
 * second, and then silently dropped on the floor.
 *
 * Reproduced on scratch: two live fixtures in the same week, one displayed.
 *
 * Fixtures still do not render as blocks on the grid — that is a bigger change
 * with its own design question (a fixture is not a session and has no duration),
 * and it is written up as a decision rather than guessed at here. This asserts
 * the narrow thing: every fixture in the week is named, so creating one is never
 * silent again.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const page = readFileSync('src/app/(staff)/schedule/page.tsx', 'utf8');
const code = strip(page);

console.log('every fixture in the week is named, not just the earliest');
assert(!/weekFixtures\[0\]/.test(code), 'nothing indexes weekFixtures[0] any more');
assert(/weekFixtures\s*\.\s*map\(/.test(code), 'the label is built by mapping over them all');
assert(
  /weekFixtures\.length\s*===\s*0/.test(code),
  'and the empty case is handled explicitly rather than by an index returning undefined',
);

console.log('\nthe label still says what it said before, per fixture');
{
  const seg = code.slice(code.indexOf('matchDayLabel'), code.indexOf('const eyebrow'));
  assert(/home_away === 'away' \? 'AT' : 'V'/.test(seg), 'home/away still reads AT or V');
  assert(/opponent/.test(seg), 'the opponent is still named');
  assert(/timezone/.test(seg), "and the kickoff is still formatted in the org's timezone, not UTC");
}

console.log('\nthe fetch was never the problem — guard it so it stays that way');
{
  const q = readFileSync('src/lib/queries/schedule.ts', 'utf8');
  const fn = strip(q).slice(strip(q).indexOf('export async function fetchWeekFixtures'));
  const body = fn.slice(0, fn.indexOf('\n}'));
  assert(/gte\('kickoff_at'/.test(body) && /lte\('kickoff_at'/.test(body), 'it is bounded to the week');
  assert(/is\('deleted_at', null\)/.test(body), 'and excludes deleted fixtures');
  assert(!/limit\(/.test(body), 'and takes no limit — every fixture in the week is fetched');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
