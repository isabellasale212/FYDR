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
];

/** Deliberately left alone, with the reason. Asserted to still NOT use the
 *  helper, so "finishing the sweep" fails loudly instead of silently breaking
 *  a site where zero rows is a legitimate outcome. */
const NOT_CONVERTED: [string, string, string][] = [
  ['src/lib/queries/injuries.ts', 'setAvailability',
   'closes any open availability row first; an athlete with none matches nothing'],
  ['src/lib/queries/userManagement.ts', 'linkAthleteToUser',
   'filters .is(user_id, null); zero rows means already linked, not refused'],
];

console.log('\n-- writes routed through mustAffect --');
for (const [batch, file, fn] of CONVERTED) {
  const b = body(file, fn);
  assert(b.length > 0, `${fn}() exists`);
  assert(/mustAffect/.test(b), `[${batch}] ${fn}() reports a refusal rather than a silent success`);
}

console.log('\n-- writes deliberately NOT converted, and still not --');
for (const [file, fn, why] of NOT_CONVERTED) {
  const b = body(file, fn);
  assert(b.length > 0 && !/mustAffect/.test(b), `${fn}() stays as it is: ${why}`);
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
