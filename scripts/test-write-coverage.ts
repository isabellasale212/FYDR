/* G-36. Which writes have been routed through the shared helper, batch by batch.
 *
 * The list grows as batches land. It is written as an explicit inventory rather
 * than a rule like "every write must use mustAffect", because that rule is FALSE
 * and asserting it would push somebody into converting the sites where a
 * row-count check produces a confident wrong answer.
 *
 * Three shapes, and only the first is safe to convert:
 *
 *   by id     one row the caller was just looking at. Zero rows can only mean
 *             the policy refused. Convert.
 *   bulk      a range, a list, or a filter like .is('user_id', null). Zero rows
 *             usually means there was nothing to do. Each needs its own
 *             judgement written down, never a blanket rule.
 *   upsert    the insert branch raises on refusal, so it is already loud.
 *
 * NOT_CONVERTED below is the useful half of this file: it records the sites
 * deliberately left alone and why, so the next person does not "finish the job"
 * and break them.
 */
import { readFileSync } from 'node:fs';

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}

function body(file: string, fn: string): string {
  const src = readFileSync(file, 'utf8');
  const i = src.indexOf(`export async function ${fn}`);
  if (i < 0) return '';
  const rest = src.slice(i + 1);
  const next = rest.search(/\nexport (async )?function /);
  return next < 0 ? rest : rest.slice(0, next);
}

/** Batch, file, function. */
const CONVERTED: [string, string, string][] = [
  ['medical', 'src/lib/queries/injuries.ts', 'updateInjuryFields'],
  ['medical', 'src/lib/queries/sarPack.ts', 'markRequestReviewed'],
  ['medical', 'src/lib/queries/sarPack.ts', 'releaseSarRequest'],
  ['medical', 'src/lib/queries/problemReports.ts', 'acknowledgeProblemReport'],
  ['medical', 'src/lib/queries/problemReports.ts', 'closeProblemReport'],
  // Batch 1: identity and club records. Highest remaining consequence, because
  // these are who somebody is, what they may do, and what the club is called.
  ['identity', 'src/lib/queries/profile.ts', 'updateMyContactDetails'],
  ['identity', 'src/lib/queries/profile.ts', 'updateMyPreferredName'],
  ['identity', 'src/lib/queries/orgDetails.ts', 'updateOrgDetails'],
  ['identity', 'src/lib/queries/orgLogo.ts', 'uploadOrgLogo'],
  ['identity', 'src/lib/queries/orgLogo.ts', 'removeOrgLogo'],
  ['identity', 'src/lib/queries/avatar.ts', 'uploadMyAvatar'],
  ['identity', 'src/lib/queries/avatar.ts', 'removeMyAvatar'],
  ['identity', 'src/lib/queries/squad.ts', 'updateAthleteBio'],
  ['identity', 'src/lib/queries/userManagement.ts', 'setUserStatus'],
  ['identity', 'src/lib/queries/userManagement.ts', 'setUserRoles'],
  // Batch 2: performance writes.
  ['performance', 'src/lib/queries/groups.ts', 'archiveGroup'],
  ['performance', 'src/lib/queries/groups.ts', 'restoreGroup'],
  ['performance', 'src/lib/queries/programmes.ts', 'updateProgrammeStatus'],
  ['performance', 'src/lib/queries/programmes.ts', 'expireOverride'],
  ['performance', 'src/lib/queries/schedule.ts', 'updateFixture'],
  ['performance', 'src/lib/queries/schedule.ts', 'setFixtureStatus'],
  ['performance', 'src/lib/queries/testing.ts', 'deleteResult'],
  ['performance', 'src/lib/queries/weekTemplates.ts', 'updateTemplate'],
  // Batch 3: nutrition, gym and body composition.
  ['nutrition/gym', 'src/lib/queries/bodyComposition.ts', 'updateWeighIn'],
  ['nutrition/gym', 'src/lib/queries/bodyMassTargetRange.ts', 'retractTargetRange'],
  ['nutrition/gym', 'src/lib/queries/mealLibrary.ts', 'deleteLibraryMeal'],
  ['nutrition/gym', 'src/lib/queries/programmes.ts', 'completeSessionLog'],
];

/** Deliberately left alone, with the reason. Asserted to still NOT use the
 *  helper, so "finishing the sweep" fails loudly instead of silently breaking
 *  a site where zero rows is a legitimate outcome. */
/** Converted, but with the check written inline rather than through the helper,
 *  and for a reason worth keeping: these carry a business-rule branch that
 *  mustAffect cannot express, because it receives a message and not a code. */
/* The three flag writes moved out of NOT_CONVERTED on 2026-09-06, and the reason
   is worth keeping: NEITHER of the original judgments was wrong when it was made.

   dismissFlag was filed ALREADY LOUD because it inserted a flag_action first and
   that insert raised on refusal. True — until 0075 made the refusal depend on the
   flag's own domain, at which point "insert the audit row first" stopped being a
   safety net and became a way to record a dismissal that never happened. The
   order is now reversed and the flag write is checked.

   acknowledgeFlag was filed NOTHING TO DO because .in(status, raised|notified)
   makes zero rows the ordinary outcome for an already-handled flag. Also true —
   and also no longer the only meaning, since the same zero now covers "this role
   may not act on this domain". Two meanings, so the call has to say which.

   The lesson is about the shape of these judgments rather than about flags: every
   NOT_CONVERTED entry below is conditional on the policies as they stand, and a
   policy change can turn a correct "nothing to do" into a silent refusal without
   touching the call site at all. */
const CONVERTED_INLINE: [string, string, string][] = [
  ['src/lib/queries/groups.ts', 'updateGroup',
   'keeps its own 23505 branch: a duplicate group name refuses the ROW, not the PERSON'],
];

/* Batch 4. The twelve bulk writes, each read and given its own verdict rather
 * than one rule applied to all of them to move faster. Three answers came out,
 * and the split is the useful part:
 *
 *   ALREADY LOUD   the update is followed by an INSERT, and an insert that
 *                  violates a WITH CHECK raises 42501. The whole call fails
 *                  visibly, so a row-count check on the update adds nothing.
 *   NOTHING TO DO  the filter itself makes zero rows the normal case: .is(x,
 *                  null) matches only rows in a state that often does not
 *                  exist. Asserting a refusal here would invent one.
 *   AMBIGUOUS      zero rows has two plausible meanings and the code cannot
 *                  tell them apart. Listed in docs/spec-gaps.md rather than
 *                  guessed at.
 */
const NOT_CONVERTED: [string, string, string][] = [
  // ALREADY LOUD: an insert follows and raises on refusal.
  ['src/lib/queries/injuries.ts', 'setAvailability',
   'ALREADY LOUD: closes the open row, then inserts; the insert raises'],
  ['src/lib/queries/teamAllocation.ts', 'setTeamAllocation',
   'ALREADY LOUD: withdraws a prior allocation that often does not exist, then inserts'],
  ['src/lib/queries/rehabGroups.ts', 'allocateToRehabGroup',
   'ALREADY LOUD: removes from other rehab groups, then inserts'],
  ['src/lib/queries/bodyMassTargetRange.ts', 'setTargetRange',
   'ALREADY LOUD: closes the open range, then inserts'],

  // NOTHING TO DO: the filter makes zero rows the ordinary outcome.
  ['src/lib/queries/groups.ts', 'removeGroupMember',
   'NOTHING TO DO: .is(removed_at, null) matches only a current member'],
  ['src/lib/queries/leaderboards.ts', 'optBackIn',
   'NOTHING TO DO: .is(ended_at, null) matches only a live opt-out'],
  ['src/lib/queries/healthkit.ts', 'withdrawHealthkitSync',
   'NOTHING TO DO: withdrawing a consent never granted matches nothing, correctly'],
  ['src/lib/queries/leaderboards.ts', 'withdrawLeaderboardVisibility',
   'NOTHING TO DO: same shape as the healthkit withdrawal'],

  /* RESOLVED 2026-09-06, and still correctly absent from mustAffect. The
     ambiguity was real: .is(user_id, null) means zero rows is EITHER already
     linked OR refused. mustAffect cannot express that, because it has exactly
     two outcomes and this site has three. It asks a second question in the empty
     branch instead and names which of the three happened, which is why it stays
     here rather than moving to the converted list. */
  ['src/lib/queries/userManagement.ts', 'linkAthleteToUser',
   'THREE OUTCOMES: asks a second question in the empty branch instead, see test:link-athlete'],
];

/* Converted 2026-09-06 alongside the flag-domain rule. Listed rather than merely
   removed from the list above, so the file records that they were reconsidered
   rather than quietly dropped. */
const CONVERTED_LATER: [string, string, string][] = [
  ['src/lib/queries/flags.ts', 'acknowledgeFlag',
   'zero rows now means already-acknowledged OR domain-refused; says which'],
  ['src/lib/queries/flags.ts', 'addFlagNote',
   'a note silently not saved is the worst of the three, since nothing else changes on screen'],
  ['src/lib/queries/flags.ts', 'dismissFlag',
   'flag write moved BEFORE the flag_actions insert, so a refusal cannot leave a false audit row'],
];

console.log('\n-- writes routed through mustAffect --');
for (const [batch, file, fn] of CONVERTED) {
  const b = body(file, fn);
  assert(b.length > 0, `${fn}() exists`);
  assert(/mustAffect/.test(b), `[${batch}] ${fn}() reports a refusal rather than a silent success`);
}

console.log('\n-- converted with an inline check, for a stated reason --');
for (const [file, fn, why] of CONVERTED_INLINE) {
  const b = body(file, fn);
  assert(/data\.length === 0|!data/.test(b), `${fn}() checks its own row count: ${why}`);
}

console.log('\n-- reconsidered later, once a policy change changed the answer --');
for (const [file, fn, why] of CONVERTED_LATER) {
  const b = body(file, fn);
  assert(/mustAffect/.test(b), `${fn}() now checks its row count: ${why}`);
}

console.log('\n-- writes deliberately NOT converted, and still not --');
for (const [file, fn, why] of NOT_CONVERTED) {
  const b = body(file, fn);
  assert(b.length > 0 && !/mustAffect/.test(b), `${fn}() stays as it is: ${why}`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
