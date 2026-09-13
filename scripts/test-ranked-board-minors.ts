/* Children's Code default 1 (Isabella, 2026-09-13): under-18 athletes are
 * excluded from ranked boards and streak mechanics by default; a recorded
 * consent lifts it. The database held this for the published boards
 * (0016); the staff wall now holds it too, and says what it left out. */
import { readFileSync } from 'node:fs';
import { excludedMinorsLine, rankedBoardEligible } from '@/lib/rankedBoardEligibility';

let failed = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ok - ${msg}`);
  else { failed++; console.log(`  FAIL - ${msg}`); }
}
const read = (p: string) => readFileSync(p, 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. the rule');
{
  assert(!rankedBoardEligible({ age: 16, consented: false }), 'a 16-year-old without consent is excluded');
  assert(rankedBoardEligible({ age: 16, consented: true }), 'with a recorded consent, ranked');
  assert(!rankedBoardEligible({ age: null, consented: false }), 'no date of birth counts as a minor — the same as athlete_is_minor');
  assert(rankedBoardEligible({ age: 18, consented: false }), 'an 18-year-old is ranked by default');
  assert(rankedBoardEligible({ age: 34, consented: false }), 'an adult is ranked by default');
  assert(excludedMinorsLine(0) === null, 'nothing excluded, nothing said');
  assert(excludedMinorsLine(1) === '1 under-18 athlete is not ranked. An athlete under 18 appears on a ranked board only with a recorded consent; silence means absent.', 'one excluded, said in a sentence');
  assert(/^2 under-18 athletes are not ranked\./.test(excludedMinorsLine(2)!), 'plural');
}

console.log('\n2. the wall, and the database rule it now matches');
{
  const wall = strip(read('src/lib/queries/leaderboardWall.ts'));
  assert(/rankedBoardEligible\(\{ age: ageOn\(a\.date_of_birth, asOf\), consented: consented\.has\(a\.id\) \}\)/.test(wall), 'the wall filters its population by the rule');
  assert(/from\('athlete_consents'\)\.select\('athlete_id'\)[^;]*'leaderboard_visibility'[^;]*\.not\('granted_at', 'is', null\)\.is\('withdrawn_at', null\)/.test(wall), 'reading a LIVE consent: granted, not withdrawn');
  assert(/const athleteIds = eligibleRows\.map\(\(a\) => a\.id\);/.test(wall) && /eligibleRows\.map\(\(a\) => \{/.test(wall), 'nothing is read or ranked for an excluded athlete — the streak included');
  assert(/excludedMinors: number;/.test(wall) && /return \{ boards, athletes, asOf, excludedMinors \};/.test(wall), 'the count of the excluded travels with the data');
  const comp = strip(read('src/components/LeaderboardWall/LeaderboardWall.tsx'));
  assert(/excludedMinorsLine\(data\.excludedMinors\)/.test(comp) && /className="tiny lbw-excluded"/.test(comp), 'the wall says what it left out');
  assert(!/every athlete included/.test(comp) && /every eligible athlete included/.test(comp), '"every athlete included" no longer stands');
  const mig = read('supabase/migrations/0094_leaderboard_tier_gate_in_function.sql');
  assert(/not athlete_is_minor\(a\.id\)/.test(mig) && /c\.purpose = 'leaderboard_visibility'/.test(mig), 'the published boards\' rule at the database, unchanged');
  assert(/under-18|under 18/i.test(read('docs/screens/38-leaderboards.md')) && /wall/i.test(read('docs/screens/38-leaderboards.md')), 'the spec says the wall holds the rule');
}

console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`);
if (failed > 0) process.exit(1);
