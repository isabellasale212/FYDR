/* Screen 63's four outcomes, and the one that is not an error.
 *
 * The transfer case -- an athlete whose email already belongs to a Fydr account
 * -- was decided on 2026-09-06 as a fresh record with no link. The risk it
 * carries is not a data risk, it is a comprehension one: told only that no
 * account was created, a person reasonably assumes something broke and tries
 * again, and trying again produces a SECOND athlete record rather than an
 * account. So what this file mostly asserts is that the screen explains itself.
 *
 * Source-level, and it says so. That the outcomes are produced correctly is
 * Run-verified against a real database; what is checked here is that each one is
 * distinguishable and that the transfer copy says the four things it has to. */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}

const route = readFileSync('src/app/(staff)/squad/new/create/route.ts', 'utf8');
const form = readFileSync('src/components/AddAthleteForm/AddAthleteForm.tsx', 'utf8');
const invite = readFileSync('src/lib/invite.ts', 'utf8');

console.log('the four outcomes are distinguishable');
for (const outcome of ['created', 'invited', 'squad_record_only', 'invite_failed']) {
  assert(route.includes(`'${outcome}'`), `the route names '${outcome}'`);
}

console.log('\nthe transfer case is decided by a typed reason, not by matching an error message');
assert(/reason: 'already_registered'/.test(invite), 'issueInvite returns a typed already_registered reason');
assert(/invited\.reason === 'already_registered'/.test(route), 'and the route branches on it');
assert(
  !/already been registered|already exists/.test(route),
  'the route does not re-match the wording of an error message, which would break when the sentence improves',
);

console.log('\nthe transfer outcome is not reported as an error');
assert(/squadRecordOnly/.test(form), 'the form holds it in its own state');
assert(
  !/setError\([^)]*squad_record_only/.test(form),
  'and never routes it through setError',
);
/* Whitespace normalised before any prose assertion. JSX text wraps across source
   lines, so a sentence that reads as one line on screen is several in the file,
   and a regex written with single spaces silently fails to find copy that is
   present. That failure mode is worse than a missing test: it invites somebody
   to "fix" the copy that was already correct. */
const panelRaw = form.slice(form.indexOf('if (squadRecordOnly)'), form.indexOf('if (invite ||'));
const panel = panelRaw.replace(/\s+/g, ' ');
assert(panelRaw.length > 0, 'the transfer panel exists');
assert(!/role="alert"/.test(panelRaw), 'it is not announced as an alert: nothing went wrong');
assert(!/form-error/.test(panelRaw), 'and it does not use the error styling');

/* The four things it must say. Each is a question the person will otherwise ask,
   and the third is the one that stops a duplicate record being created. */
console.log('\nthe copy answers what happened, why, what it means, and what to do');
assert(/is on your squad/.test(panel), 'WHAT HAPPENED: the athlete exists');
assert(/already belongs to a Fydr account/.test(panel), 'WHY: the address is already on Fydr');
assert(/belongs to one squad record/.test(panel), 'THE RULE: one account, one squad record');
assert(/different email address/.test(panel), 'WHAT TO DO: invite with another address');
assert(/not a failure/.test(panel), 'and it says plainly that this is not a failure');
assert(
  /nothing from their previous club comes across/.test(panel),
  'it also says the record starts empty, which is the thing a club would otherwise assume wrongly',
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
