/* Tests for the policy-replacement guard.
 *
 * A guard is worth exactly what its teeth are worth, and this project has
 * already shipped a test that passed for the wrong reason. So the central case
 * here is not "does the guard run" but "does it catch the actual regression it
 * was built for" — migration 0080 dropping 0022/0070's rehab-authorship rule
 * from programme_assignments_update.
 *
 * The real migration files are used, not fixtures, for the cases about 0080.
 * A fixture would only prove the guard understands a shape I invented.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  analyse,
  parsePolicies,
  refusedByPolicy,
  refusalCoverage,
  stripSql,
  type Policy,
} from './check-policy-replacements';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const read = (dir: string, f: string) => ({ name: f, sql: readFileSync(join(dir, f), 'utf8') });
const MIG = 'supabase/migrations';
const TESTS = 'supabase/tests';

const m0070 = read(MIG, '0070_specialist_writes.sql');
const m0080 = read(MIG, '0080_injury_timeline.sql');
const m0082 = read(MIG, '0082_restore_assignment_authorship.sql');
const t400 = read(TESTS, '400_injury_timeline_test.sql');

console.log('it reads what the old policy refused, from the real 0070');
{
  const pol = parsePolicies(m0070.sql).find(
    (p: Policy) => p.name === 'programme_assignments_update' && p.table === 'programme_assignments',
  );
  assert(!!pol, 'the 0070 definition of programme_assignments_update is parsed');
  assert(pol!.using !== null && pol!.check !== null, 'with both a USING and a WITH CHECK');
  const refused = refusedByPolicy(pol!);
  assert(
    refused.includes('coach') && refused.includes('nutritionist'),
    'and it refuses the coach and the nutritionist — the two roles 0080 silently admitted',
  );
  assert(
    !refused.includes('sport_scientist') && !refused.includes('medic') && !refused.includes('strength_conditioning'),
    'while admitting the sport scientist, the medic and the S&C',
  );
}

console.log('\nit collects EVERY role literal, not the first ARRAY[...]');
{
  /* 0070's WITH CHECK is two OR-ed branches, each with its own ARRAY. Reading
     only the first is a mistake this project has actually made, misreading
     group_memberships as medic-only when it is medic OR (coach/SS AND NOT
     rehab). */
  const pol = parsePolicies(m0070.sql).find((p: Policy) => p.name === 'programme_assignments_update')!;
  const refused = refusedByPolicy(pol);
  assert(
    !refused.includes('medic'),
    'the medic appears only in the SECOND branch of the WITH CHECK and is still seen',
  );
}

console.log('\nTHE CENTRAL CASE: it flags 0080 when the refusal is not asserted');
{
  const { findings, replacements } = analyse({
    migrations: [m0070, m0080],
    tests: [],
    baseline: 79,
  });
  assert(replacements === 1, 'it sees 0080 replacing the policy 0070 defined');
  assert(findings.length === 1, 'and reports it');
  const f = findings[0]!;
  assert(f.table === 'programme_assignments' && f.policy === 'programme_assignments_update',
    'naming the right policy');
  assert(f.replaces === '0070_specialist_writes.sql', 'and the definition it replaced');
  assert(
    f.uncovered.includes('coach') && f.uncovered.includes('nutritionist'),
    'with the coach and the nutritionist unaccounted for — exactly the regression that shipped to scratch',
  );
}

console.log('\nand it goes quiet once the refusals ARE asserted');
{
  const { findings } = analyse({
    migrations: [m0070, m0080],
    tests: [t400],
    baseline: 79,
  });
  assert(
    findings.length === 0,
    'the real 400 test file, which asserts the coach and nutritionist refusals, satisfies it',
  );
}

console.log('\nit recognises a stated widening, and refuses an empty one');
{
  const widened = {
    name: '0099_widen.sql',
    sql:
      'drop policy if exists programme_assignments_update on public.programme_assignments;\n' +
      '-- policy-widening: coach — the coach owns gym assignment from this season\n' +
      '-- policy-widening: nutritionist — nutrition programmes are theirs now\n' +
      'create policy programme_assignments_update on public.programme_assignments\n' +
      "  for update to authenticated using (org_id = auth_org_id());",
  };
  const { findings } = analyse({ migrations: [m0070, widened], tests: [], baseline: 79 });
  assert(findings.length === 0, 'two declarations with reasons cover the two refused roles');

  const bare = { ...widened, sql: widened.sql.replace(/— [^\n]+/g, '— ') };
  const after = analyse({ migrations: [m0070, bare], tests: [], baseline: 79 });
  assert(
    after.findings.length === 1,
    'a marker with no reason after the dash does not count — the sentence is the point',
  );
}

console.log('\nthe baseline is respected, so history is not retrofitted by stealth');
{
  const { findings, replacements } = analyse({
    migrations: [m0070, m0080],
    tests: [],
    baseline: 82,
  });
  assert(replacements === 0 && findings.length === 0, '0080 is below the default baseline and is not flagged');
}

console.log('\ncomments cannot trip it, and cannot satisfy it');
{
  assert(!stripSql('-- drop policy foo on bar').includes('drop policy'), 'line comments are stripped');
  assert(!stripSql('/* create policy x on y */').includes('create policy'), 'block comments are stripped');
  /* 0082's header discusses 0080 dropping a policy at length. If prose counted,
     the guard would read that as a second replacement. */
  const defs = parsePolicies(m0082.sql);
  assert(
    defs.filter((d: Policy) => d.name === 'programme_assignments_update').length === 1,
    "0082's long header about what 0080 dropped is not parsed as extra policies",
  );
}

console.log('\ncoverage is found by actor block, not by proximity');
{
  const cover = refusalCoverage([t400]);
  assert(
    (cover.coach?.programme_assignments?.length ?? 0) > 0,
    'the coach refusal in 400 is attributed to the coach',
  );
  assert(
    (cover.nutritionist?.programme_assignments?.length ?? 0) > 0,
    'and the nutritionist one to the nutritionist',
  );
  assert(
    (cover.sport_scientist?.programme_assignments?.length ?? 0) === 0,
    'while the sport scientist, who is never asserted as refused there, gets no credit',
  );
}

console.log('\nthe whole repository is clean right now');
{
  const files = (d: string) => readdirSync(d).filter((f) => f.endsWith('.sql')).map((f) => read(d, f));
  const { findings } = analyse({ migrations: files(MIG), tests: files(TESTS) });
  assert(findings.length === 0, 'no migration above the baseline replaces a policy unaccounted for');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
