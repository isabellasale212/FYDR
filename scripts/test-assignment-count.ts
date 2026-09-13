/* PATTERN-S5 C4 — an assignment's headline is the distinct athlete count,
 * with its arithmetic (2026-09-13). Pure rule with rows; the page and the
 * builder read from source. */
import { readFileSync } from 'node:fs';
import { assignmentArithmetic } from '@/lib/assignmentCount';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const read = (p: string): string => readFileSync(p, 'utf8');
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('1. distinct, never a sum');
{
  const backs = { name: 'Backs', memberIds: ['a', 'b', 'c'] };
  const forwards = { name: 'Forwards', memberIds: ['c', 'd'] };
  const r = assignmentArithmetic({ groups: [backs, forwards], namedIds: ['d', 'e'], squad: 30 });
  assert(r.distinct === 5, 'a, b, c, d, e — five, though the groups sum to 5 and two names were added');
  assert(r.headline === '5 of 30 athletes', '"5 of 30 athletes"');
  assert(r.arithmetic === '5 in Backs and Forwards + 2 named − 2 counted twice', '"5 in Backs and Forwards + 2 named − 2 counted twice"');
  const one = assignmentArithmetic({ groups: [backs], namedIds: [], squad: 30 });
  assert(one.headline === '3 of 30 athletes' && one.arithmetic === null, 'one group and no names: the headline says it all');
  const twoGroups = assignmentArithmetic({ groups: [backs, forwards], namedIds: [], squad: 30 });
  assert(twoGroups.arithmetic === '5 in Backs and Forwards − 1 counted twice', 'two groups sharing an athlete');
  const namedOnly = assignmentArithmetic({ groups: [], namedIds: ['a', 'b'], squad: 30 });
  assert(namedOnly.headline === '2 of 30 athletes' && namedOnly.arithmetic === null, 'named only');
  const none = assignmentArithmetic({ groups: [], namedIds: [], squad: 30 });
  assert(none.headline === 'Nobody assigned yet' && none.distinct === 0, 'nobody');
  const noSquad = assignmentArithmetic({ groups: [backs], namedIds: ['z'], squad: 0 });
  assert(noSquad.headline === '4 athletes' && noSquad.arithmetic === '3 in Backs + 1 named', 'no squad count on record: the number alone');
}

console.log('\n2. the page and the builder');
{
  const page = strip(read('src/app/(staff)/programmes/[programmeId]/page.tsx'));
  assert(/fetchGroupMembership\(db, orgId\)/.test(page) && /fetchSquadSize\(db, orgId\)/.test(page), 'the page reads the memberships and the squad size');
  assert(/assignmentArithmetic\(\{/.test(page) && /memberIds: groupMembership\[/.test(page), 'and computes the arithmetic from the active assignments');
  const b = strip(read('src/components/ProgrammeBuilder/ProgrammeBuilder.tsx'));
  assert(/assignment: AssignmentArithmetic;/.test(b), 'the builder takes it');
  assert(/className="pb-assign-headline num">\{assignment\.headline\}/.test(b) && /assignment\.arithmetic \? \(/.test(b), 'the card\'s headline is the distinct count, the arithmetic beneath it');
  assert(!/Assigned <span className="tiny num">\{assignees\.length\}<\/span>/.test(b), 'the row count is no longer the headline');
}

console.log('\n3. the spec');
{
  assert(/distinct/.test(read('docs/screens/34-programme-builder.md')) && /counted twice/.test(read('docs/screens/34-programme-builder.md')), '34-programme-builder.md says the headline is distinct athletes with the arithmetic');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
