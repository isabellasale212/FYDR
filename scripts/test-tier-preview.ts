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

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
