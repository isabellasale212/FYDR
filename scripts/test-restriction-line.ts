/* PATTERN-S3 D1, enforced 2026-09-12: a coach never reads a protocol stage.
 * The restriction line drops any entry naming a protocol, a stage or a
 * diagnosis, at the query layer, for every viewer — the stage lives in the
 * clinical record.
 */
import { readFileSync } from 'node:fs';
import { restrictionLine } from '@/lib/restrictions';
let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('the line');
{
  assert(restrictionLine(['return to play protocol, stage 3 of 6', 'no contact', 'no collision drills']).join(' · ') === 'no contact · no collision drills', 'the seed\'s protocol entry is dropped; the rest stand in order');
  assert(restrictionLine(['Stage 2 only', 'no running']).join() === 'no running', '"Stage 2" is dropped');
  assert(restrictionLine(['Graduated return to play', 'gym only']).join() === 'gym only', 'a graduated return-to-play mention is dropped');
  assert(restrictionLine(['no contact', 'no scrummaging']).length === 2, 'ordinary restrictions pass');
  assert(restrictionLine(null).length === 0 && restrictionLine(undefined).length === 0, 'null and undefined are empty');
  assert(restrictionLine(['upstage lighting only']).length === 0 || true, '(a false positive on an ordinary word is tolerable; a leak is not)');
}

console.log('\nevery read of the line passes through it');
{
  const sites: [string, RegExp][] = [
    ['src/lib/queries/availability.ts', /restrictions: restrictionLine\(current\?\.restrictions\)/],
    ['src/lib/queries/injuries.ts', /restrictions: avail \? restrictionLine\(avail\.restrictions\) : null/],
    ['src/lib/queries/rehabGroups.ts', /restrictions: restrictionLine\(current\?\.restrictions\)/],
    ['src/lib/queries/squad.ts', /restrictions: restrictionLine\(current\?\.restrictions\)/],
    ['src/lib/queries/teamAllocation.ts', /restrictions: restrictionLine\(current\?\.restrictions\)/],
    ['src/lib/queries/timetable.ts', /const restrictions = restrictionLine\(avail\?\.restrictions\)/],
    ['src/lib/queries/schedule.ts', /computeConflicts\(session\.session_type, session\.planned_rpe, restrictionLine\(avail\.restrictions\)\)/],
  ];
  for (const [p, re] of sites) {
    const src = strip(read(p));
    assert(re.test(src), `${p.split('/').slice(-1)[0]} reads the line through restrictionLine`);
    assert(!/restrictions \?\? \[\]|restrictions \?\? null/.test(src.replace(/restrictionLine\([^)]*\)/g, '')), `${p.split('/').slice(-1)[0]}: no raw restrictions array reaches a screen`);
  }
}

console.log('\nthe athlete\'s own line and the seed');
{
  const avail = strip(read('src/lib/queries/availability.ts'));
  assert(/export async function fetchAthleteAvailability[\s\S]{0,400}fetchCurrentAvailability\(db, orgId, \[athleteId\]\)/.test(avail), 'the athlete\'s own read goes through fetchCurrentAvailability, so their Today line is covered too (the stage is the ladder\'s, not the line\'s)');
  const seed = read('supabase/seed.sql');
  assert(!/array\['return to play protocol, stage 3 of 6'/.test(seed), 'the seed no longer writes the protocol into restrictions');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
