/* The injury <-> S&C programme link.
 *
 * WHAT THIS FILE IS FOR, and what it deliberately does not do. The feature's two
 * real guarantees live in the database and are asserted there, as the roles
 * themselves, in supabase/tests/400_injury_timeline_test.sql:
 *
 *   - the S&C writes to the timeline and reads nothing back;
 *   - an injury-linked assignment goes live only for a medic.
 *
 * This file asserts the layer above: that no screen ASKS for the timeline on
 * behalf of somebody who may not have it, that the proposal path is wired to the
 * role it belongs to, and that the append-only rule is not quietly undone by an
 * edit control somebody adds later. A policy is the guarantee; a page that
 * renders an empty medical panel to an S&C is still a bug worth failing on.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
/* Comments are stripped before every NEGATIVE assertion below. Two earlier
   tests in this project failed because prose explaining a rule matched the
   regex looking for a violation of it. */
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '');

const queries = readFileSync('src/lib/queries/injuryTimeline.ts', 'utf8');
const queriesCode = strip(queries);
const timeline = readFileSync('src/components/InjuryTimeline/InjuryTimeline.tsx', 'utf8');
const timelineCode = strip(timeline);
const injuryPage = readFileSync('src/app/(staff)/injuries/[injuryId]/page.tsx', 'utf8');
const injuryPageCode = strip(injuryPage);
const builder = readFileSync('src/components/ProgrammeBuilder/ProgrammeBuilder.tsx', 'utf8');
const builderCode = strip(builder);
const progPage = readFileSync('src/app/(staff)/programmes/[programmeId]/page.tsx', 'utf8');
const progPageCode = strip(progPage);
const programmes = readFileSync('src/lib/queries/programmes.ts', 'utf8');
const programmesCode = strip(programmes);
const mig80 = readFileSync('supabase/migrations/0080_injury_timeline.sql', 'utf8');
const mig80Code = strip(mig80.replace(/^--.*$/gm, ''));

console.log('the timeline is fetched only for a medic');
assert(
  /const timeline = isMedical \? await fetchInjuryTimeline\(/.test(injuryPageCode),
  'the injury record page guards fetchInjuryTimeline on isMedical, the same shape as the clinical fetch',
);
assert(
  [...injuryPageCode.matchAll(/fetchInjuryTimeline\(/g)].length === 1,
  'and calls it exactly once, so there is no second unguarded path',
);
assert(
  /isMedical = hasAnyRole\(claims\.roles, CLINICAL_ONLY\)/.test(injuryPageCode),
  'isMedical resolves from CLINICAL_ONLY in lib/access.ts, not a hand-written role check',
);

console.log('\nthe timeline component is never rendered outside that branch');
{
  const medicBranch = injuryPageCode.indexOf('{isMedical ? (');
  const elseAt = injuryPageCode.indexOf(') : (', medicBranch);
  const uses = [...injuryPageCode.matchAll(/<InjuryTimeline/g)].map((m) => m.index ?? -1);
  assert(medicBranch > -1 && elseAt > medicBranch, 'the page branches on isMedical');
  assert(
    uses.length === 1 && uses[0]! > medicBranch && uses[0]! < elseAt,
    'and <InjuryTimeline> appears once, inside the medic half',
  );
}
{
  /* The whole app, not just this page: any other route rendering the component
     would bypass the guard above. */
  const rendered = [...timeline.matchAll(/export function InjuryTimeline/g)].length;
  assert(rendered === 1, 'InjuryTimeline is exported from exactly one place');
}

console.log('\nthe non-medic branch shows standing, never content');
{
  const elseAt = injuryPageCode.indexOf(') : (');
  const nonMedic = injuryPageCode.slice(elseAt);
  for (const forbidden of ['fetchInjuryTimeline', 'InjuryTimeline', 'eventSentence', 'created_by_role']) {
    assert(!nonMedic.includes(forbidden), `the non-medic branch never mentions ${forbidden}`);
  }
  assert(
    /Awaiting medical sign-off/.test(nonMedic),
    'but it does say where the S&C’s own proposal stands, which they can read from programme_assignments anyway',
  );
}

console.log('\nnothing on the timeline can be edited or removed');
for (const forbidden of ['.update(', '.delete(', '.upsert(']) {
  assert(
    !queriesCode.includes(`from('injury_timeline_event')${forbidden}`) &&
      !new RegExp(`injury_timeline_event'\\)\\s*\\n?\\s*${forbidden.replace(/[.()]/g, '\\$&')}`).test(queriesCode),
    `the query layer never calls ${forbidden} on injury_timeline_event`,
  );
}
assert(
  !/create policy[^;]*injury_timeline_event[^;]*for (update|delete)/i.test(mig80Code),
  'migration 0080 creates no UPDATE or DELETE policy on the table',
);
assert(
  /grant select, insert on public\.injury_timeline_event to authenticated/.test(mig80Code),
  'and grants SELECT and INSERT only — the absence of the grant is what makes it append-only',
);

console.log('\nthe event write does not ask for a row it may not read');
{
  const fn = queriesCode.slice(queriesCode.indexOf('export async function recordInjuryEvent'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  /* Deliberately the OPPOSITE of the rule test-write-coverage enforces
     everywhere else. RETURNING is a read, the S&C may not read this table, and
     chaining .select() here makes a successful insert report itself as a
     refusal. Found by running it as the S&C; asserted in
     supabase/tests/400 as well, from both sides. */
  assert(!/\.select\(/.test(body), 'recordInjuryEvent does not chain .select()');
  assert(!/mustAffect/.test(body), 'and does not go through mustAffect, whose whole job is to add one');
  assert(
    /row-level security\|policy/.test(body),
    'it classifies the 42501 itself instead — an INSERT does raise on WITH CHECK, which is what makes that sufficient',
  );
}

console.log('\nthe read policy is the medic alone');
{
  const sel = mig80Code.slice(mig80Code.indexOf('injury_timeline_medic_select'));
  const firstArray = sel.slice(0, sel.indexOf(';'));
  assert(
    /ARRAY\['medic'::app_role\]/.test(firstArray),
    'injury_timeline_medic_select names medic and nothing else',
  );
  for (const role of ['coach', 'sport_scientist', 'nutritionist', 'strength_conditioning']) {
    assert(!firstArray.includes(role), `the SELECT policy does not admit ${role}`);
  }
}

console.log('\nthe proposal path belongs to the S&C, and not to a medic');
assert(
  /hasAnyRole\(claims\.roles, INJURY_PROGRAMME_PROPOSER\) && !isMedical/.test(progPageCode),
  'the programme page proposes only for an S&C who is not also the medic, resolved from lib/access.ts',
);
assert(
  /proposesAgainstInjury \? fetchOpenInjuryIdsByAthlete\(db, orgId\) : Promise\.resolve\(\{\}\)/.test(progPageCode),
  'and only looks up open injuries for that viewer — everyone else gets an empty map and the old behaviour',
);
assert(
  /openInjuryByAthlete: Record<string, string>/.test(builder),
  'the builder receives the injuries as DATA, not a predicate function — a function prop on a Client Component typechecks and throws at runtime',
);
assert(
  /assignScope === 'athlete' \? \(openInjuryByAthlete\[assignAthleteId\] \?\? null\) : null/.test(builderCode),
  'a group assignment is never a proposal',
);

console.log('\nproposing is announced before the write, not after it');
{
  const noteAt = builderCode.indexOf('goes to the medic as a');
  const buttonAt = builderCode.indexOf('assignMutation.mutate()');
  assert(noteAt > -1 && buttonAt > noteAt, 'the explanation renders above the Assign button');
  assert(/'Propose'/.test(builderCode), 'and the button itself reads Propose in that case');
}

console.log('\nthe assignment write reports a refusal instead of a silent success');
{
  const fn = programmesCode.slice(programmesCode.indexOf('export async function assignProgramme'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert(/\.select\('id'\)/.test(body), 'assignProgramme selects the inserted row back');
  assert(/const created = data\?\.\[0\];/.test(body) && /if \(!created\)/.test(body),
    'and treats no row as a refusal — G-36, an insert that changes nothing must not read as saved');
  assert(
    /status: 'proposed' as const, injury_id: proposeAgainst/.test(body),
    'a proposal is written as proposed AND linked to the injury, never one without the other',
  );
}

console.log('\nrequest-changes needs a reason, in both layers');
assert(
  /if \(reason === ''\) return \{ error:/.test(queriesCode),
  'requestProposalChanges refuses an empty reason at the query layer',
);
assert(
  /if \(!text\) \{\s*setError\(/.test(timelineCode),
  'and the component refuses one too, so the medic finds out while typing',
);
/* 0124 (PATTERN-S3 C6, 2026-09-14) replaced the 2026-09-06 shape. The reason
   still becomes the medic's own note event and the sign-off still writes the
   programme_signed_off event, but both happen inside decide_proposal(), the
   one SECURITY DEFINER write the proposals list uses too — so the assertions
   below pin the function call, and the migration pins the events. The
   assignment no longer "stays proposed": it moves to 'returned' with the
   reason on the row, where the S&C reads it. */
assert(
  /rpc\('decide_proposal', \{ p_assignment_id: assignmentId, p_decision: 'return', p_reason: reason \}\)/.test(queriesCode),
  'the reason goes to decide_proposal, which writes the note event and the returned state together (0124)',
);
{
  const start = queriesCode.indexOf('export async function requestProposalChanges');
  const next = queriesCode.indexOf('\nexport ', start + 1);
  const fn = queriesCode.slice(start, next === -1 ? undefined : next);
  assert(start !== -1 && fn.length > 0, 'requestProposalChanges is found, so the assertion below is measuring something');
  assert(!fn.includes("from('programme_assignments')") && !fn.includes('recordInjuryEvent'), 'and touches neither the assignment nor the timeline directly — one function, one truth');
}

console.log('\nsign-off goes through the same function');
{
  const fn = queriesCode.slice(queriesCode.indexOf('export async function signOffProposal'));
  const body = fn.slice(0, fn.indexOf('\n}\n'));
  assert(/rpc\('decide_proposal', \{ p_assignment_id: assignmentId, p_decision: 'approve', p_reason: '' \}\)/.test(body), 'approve is decide_proposal too: active, decided_by/at and the programme_signed_off event in one transaction');
  assert(!/from\('programme_assignments'\)/.test(body) && !/mustAffect\(/.test(body), 'no client-side UPDATE to fall short of');
  const mig = readFileSync('supabase/migrations/0124_proposal_states.sql', 'utf8');
  assert(/'programme_signed_off'/.test(mig) && /'note'/.test(mig) && /changes_requested/.test(mig), 'the migration writes the same two timeline events the client used to');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
