/* Children's Code (Isabella, 2026-09-13): under-18 athletes are excluded from
 * ranked boards and streak mechanics, full stop, until the guardian route
 * exists — no self opt-in. Migration 0116 holds it for the published boards;
 * the staff wall holds the same rule and says what it left out. */
import { readFileSync, existsSync } from 'node:fs';
import { excludedMinorsLine, rankedBoardEligible } from '@/lib/rankedBoardEligibility';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the rule: age, and only age');
{
  assert(!rankedBoardEligible({ age: 16 }), 'a 16-year-old is excluded');
  assert(!rankedBoardEligible({ age: 17 }), 'a 17-year-old is excluded');
  assert(!rankedBoardEligible({ age: null }), 'no date of birth counts as a minor — the same as athlete_is_minor');
  assert(rankedBoardEligible({ age: 18 }), 'an 18-year-old is ranked');
  assert(rankedBoardEligible({ age: 34 }), 'an adult is ranked');
  assert(!('consented' in ({ age: 16 } as Record<string, unknown>)) && !/consented/.test(read('src/lib/rankedBoardEligibility.ts')), 'no consent input exists — there is no opt-in path for an under-18');
  assert(excludedMinorsLine(0) === null, 'nothing excluded, nothing said');
  /* REPINNED 16 Sept 2026 (Isabella's evening queue, the text rule, category
     4): the figure, not the sentence — the rule itself is 0116's and
     visibility.md's, no longer restated on the wall. */
  assert(excludedMinorsLine(1) === '1 under-18 athlete not ranked', 'one excluded, as a figure (16 Sept 2026)');
  assert(excludedMinorsLine(2) === '2 under-18 athletes not ranked', 'plural');
}

console.log('\n2. the wall, the database, the athlete app');
{
  const wall = strip(read('src/lib/queries/leaderboardWall.ts'));
  assert(/rankedBoardEligible\(\{ age: ageOn\(a\.date_of_birth, asOf\) \}\)/.test(wall) && !/athlete_consents/.test(wall), 'the wall filters by age alone and reads no consent');
  assert(/const athleteIds = eligibleRows\.map\(\(a\) => a\.id\);/.test(wall) && /eligibleRows\.map\(\(a\) => \{/.test(wall), 'nothing is read or ranked for an excluded athlete — the streak included');
  assert(/excludedMinors: number;/.test(wall) && /return \{ boards, athletes, asOf, excludedMinors \};/.test(wall), 'the count of the excluded travels with the data');
  const comp = strip(read('src/components/LeaderboardWall/LeaderboardWall.tsx'));
  assert(/excludedMinorsLine\(data\.excludedMinors\)/.test(comp) && /className="tiny lbw-excluded"/.test(comp), 'the wall says what it left out');
  const mig = read('supabase/migrations/0116_minors_off_ranked_boards.sql');
  assert(/and not athlete_is_minor\(a\.id\)/.test(mig) && !/athlete_consents c/.test(mig), '0116: the published boards exclude every minor, no consent escape');
  const t200 = read('supabase/tests/200_minor_leaderboard_test.sql');
  assert(/is STILL absent \(0116\)/.test(t200), 'the pgTAP rule test asserts a self-consented minor is absent');
  assert(!existsSync('src/components/LeaderboardConsentToggle/LeaderboardConsentToggle.tsx'), 'the self-consent toggle is gone');
  const lb = strip(read('src/app/(athlete)/me/leaderboards/page.tsx'));
  assert(!/LeaderboardConsentToggle|fetchLeaderboardConsent/.test(lb) && /you are not named on any leaderboard, and nothing/.test(lb), 'Me › Leaderboards states the rule and offers no control to a minor');
  const me = strip(read('src/app/(athlete)/me/page.tsx'));
  assert(/isMinor \? 'Not named'/.test(me) && !/fetchLeaderboardConsent/.test(me), 'Me\'s row reads "Not named" for a minor');
  const q = read('src/lib/queries/leaderboards.ts');
  assert(!/export async function grantLeaderboardVisibility|export async function fetchLeaderboardConsent/.test(q), 'the grant and read of the self opt-in are removed from the query layer');
  assert(/never named|no opt-in|0116/.test(read('docs/screens/38-leaderboards.md')) && /0116|never named/.test(read('docs/athlete/visibility.md')), 'the specs say so');
  for (const f of ['src/app/(staff)/leaderboards/manage/page.tsx', 'src/app/(staff)/leaderboards/[leaderboardId]/page.tsx', 'src/app/(staff)/leaderboards/new/page.tsx']) {
    assert(!/opt in\s+themselves|opt in themselves/.test(strip(read(f))), `${f.split('/').slice(-2).join('/')}: no staff screen still says a minor can opt in`);
  }
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
