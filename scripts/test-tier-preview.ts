/* Entitlement test for src/lib/tierPreview.ts.
 *
 * CLAUDE.md §5: "Write the test for a permission rule before the rule. Access
 * control is the one area where tests are mandatory." The Plan card's switch
 * lets an admin render their own session as a Basic club, and the rule that
 * makes that safe rather than a hole is that a preview may only ever resolve
 * DOWNWARD. If an upward preview were ever honoured, a club on Basic could put
 * GPS, the training report and the analytics bar chart on screen by setting a
 * cookie — features they have not bought, gated in four separate server
 * components that all trust requireStaff()'s `tier`.
 *
 * The cookie is written by the browser, so every value below is untrusted
 * input by definition, including the well-formed ones.
 *
 * Follows scripts/test-safe-redirect.ts's own precedent: no test runner exists
 * in this repo, so this is a plain top-level-await TS script.
 *
 * Run:
 *   npm run test:tier-preview
 * or directly:
 *   node --experimental-strip-types --import ./scripts/lib/register-ts-aliases.mjs scripts/test-tier-preview.ts
 */

import { effectiveTier, isPreviewingTier, TIER_PREVIEW_VALUE } from '../src/lib/tierPreview';
import { isPlatformStaff, platformStaffEmails } from '../src/lib/platformStaff';

let failed = 0;
let passed = 0;

function assertEqual(actual: unknown, expected: unknown, description: string) {
  if (actual === expected) {
    passed++;
    console.log(`  ok - ${description}`);
  } else {
    failed++;
    console.error(`  NOT OK - ${description}`);
    console.error(`    expected: ${expected}`);
    console.error(`    actual:   ${actual}`);
  }
}

console.log('\n── no cookie: the club renders at its real plan ──');
assertEqual(effectiveTier('performance', undefined), 'performance', 'a Premium club with no cookie stays Premium');
assertEqual(effectiveTier('core', undefined), 'core', 'a Basic club with no cookie stays Basic');
assertEqual(isPreviewingTier('performance', undefined), false, 'no cookie is not a preview');
assertEqual(isPreviewingTier('core', undefined), false, 'no cookie is not a preview on Basic either');

console.log('\n── the feature working: a Premium club previews Basic ──');
assertEqual(effectiveTier('performance', TIER_PREVIEW_VALUE), 'core', 'a Premium club with the preview cookie renders as Basic');
assertEqual(isPreviewingTier('performance', TIER_PREVIEW_VALUE), true, 'and is reported as previewing, so the banner shows');

console.log('\n── THE RULE: a preview can never resolve upward ──');
assertEqual(effectiveTier('core', 'performance'), 'core', 'a Basic club asking for Premium stays Basic');
assertEqual(isPreviewingTier('core', 'performance'), false, 'and is not reported as previewing — nothing changed');
assertEqual(effectiveTier('core', TIER_PREVIEW_VALUE), 'core', 'a Basic club asking for Basic is a no-op, not a preview');
assertEqual(
  isPreviewingTier('core', TIER_PREVIEW_VALUE),
  false,
  'and must NOT claim to be previewing: the banner would be lying about a state that is simply the truth',
);

console.log('\n── untrusted input: anything unrecognised fails closed to the real plan ──');
for (const junk of ['', ' ', 'PERFORMANCE', 'Core', 'premium', 'true', '1', 'null', 'undefined', '../core', 'core ']) {
  assertEqual(effectiveTier('performance', junk), 'performance', `a Premium club is unaffected by cookie ${JSON.stringify(junk)}`);
  assertEqual(effectiveTier('core', junk), 'core', `a Basic club is unaffected by cookie ${JSON.stringify(junk)}`);
}

console.log('\n── the accepted value is exactly one string, not a prefix or a case-fold ──');
assertEqual(TIER_PREVIEW_VALUE, 'core', 'the only honoured cookie value is "core"');
assertEqual(effectiveTier('performance', 'core'), 'core', 'exact match is honoured');
assertEqual(effectiveTier('performance', 'CORE'), 'performance', 'a case variant is not');

console.log('\n── WHO may preview: Fydr staff only, never a club admin ──');
// The allowlist is passed explicitly rather than through process.env so this
// suite proves the parser, not the machine it happens to run on.
assertEqual(isPlatformStaff('sales@fydr.app', 'sales@fydr.app'), true, 'an allowlisted address may preview');
assertEqual(isPlatformStaff('coach@club.com', 'sales@fydr.app'), false, 'a club address may not, whatever roles it holds');
assertEqual(isPlatformStaff('sales@fydr.app', undefined), false, 'UNSET MEANS NOBODY — the default must not open the door');
assertEqual(isPlatformStaff('sales@fydr.app', ''), false, 'an empty string is unset, not "everyone"');
assertEqual(isPlatformStaff('sales@fydr.app', ' , , '), false, 'a list of nothing is still nobody');
assertEqual(isPlatformStaff(null, 'sales@fydr.app'), false, 'a session with no email is never platform staff');
assertEqual(isPlatformStaff(undefined, 'sales@fydr.app'), false, 'nor is an undefined one');
assertEqual(isPlatformStaff('', 'sales@fydr.app'), false, 'nor is an empty one — "" must never match a junk entry');

console.log('\n── the allowlist parses the way a human would write it ──');
assertEqual(isPlatformStaff('b@fydr.app', 'a@fydr.app,b@fydr.app'), true, 'a second entry is honoured');
assertEqual(isPlatformStaff('b@fydr.app', ' a@fydr.app , b@fydr.app '), true, 'spaces around entries are tolerated');
assertEqual(isPlatformStaff('B@Fydr.App', 'b@fydr.app'), true, 'the session email is matched case-insensitively');
assertEqual(isPlatformStaff('b@fydr.app', 'B@FYDR.APP'), true, 'and so is the configured one');
assertEqual(isPlatformStaff(' b@fydr.app ', 'b@fydr.app'), true, 'a padded session email still matches');
assertEqual(platformStaffEmails('a@x.com, ,B@X.com').length, 2, 'blank entries are dropped, real ones kept');

console.log('\n── near-misses do not match: this is an allowlist, not a search ──');
for (const near of ['sales@fydr.app.evil.com', 'xsales@fydr.app', 'sales@fydr.ap', 'sales@fydr.appp', '@fydr.app', 'fydr.app', '*']) {
  assertEqual(isPlatformStaff(near, 'sales@fydr.app'), false, `${JSON.stringify(near)} is not sales@fydr.app`);
}
assertEqual(isPlatformStaff('anyone@anywhere.com', '*'), false, 'there is no wildcard — "*" allowlists only the literal "*"');

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
