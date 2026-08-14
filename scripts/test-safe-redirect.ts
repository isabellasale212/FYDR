/* Regression test for src/lib/safeRedirect.ts's safeNextPath() — the open-
 * redirect guard on /login and /login/mfa's `?next=` param. Before this
 * existed, LoginForm.tsx and MfaChallengeForm.tsx both handed the raw URL
 * value straight to router.replace() after a real, successful sign-in: an
 * attacker could send `/login?next=https://evil.example/fake-login` and
 * have the victim hard-navigated off-site immediately after authenticating
 * for real, on the real domain, with a real cert.
 *
 * Follows scripts/test-schedule-timezone.ts's own precedent: no test
 * runner (vitest/jest) exists in this repo, so this is a plain
 * top-level-await TS script run with `node --experimental-strip-types`.
 *
 * Run:
 *   npm run test:safe-redirect
 * or directly:
 *   node --experimental-strip-types --import ./scripts/lib/register-ts-aliases.mjs scripts/test-safe-redirect.ts
 */

import { safeNextPath } from '../src/lib/safeRedirect';

let failed = 0;
let passed = 0;

function assertEqual(actual: unknown, expected: unknown, description: string) {
  const ok = actual === expected;
  if (ok) {
    passed++;
    console.log(`  ok - ${description}`);
  } else {
    failed++;
    console.error(`  NOT OK - ${description}`);
    console.error(`    expected: ${expected}`);
    console.error(`    actual:   ${actual}`);
  }
}

console.log('\n── safeNextPath: absent/empty input ──');
assertEqual(safeNextPath(null), '/', 'null falls back to /');
assertEqual(safeNextPath(undefined), '/', 'undefined falls back to /');
assertEqual(safeNextPath(''), '/', 'empty string falls back to /');

console.log('\n── safeNextPath: real, ordinary values pass through unchanged ──');
assertEqual(safeNextPath('/dashboard'), '/dashboard', 'a plain relative path passes through');
assertEqual(safeNextPath('/'), '/', 'the root path passes through');
assertEqual(safeNextPath('/squad/roster?groups=1,2'), '/squad/roster?groups=1,2', 'a relative path with a query string passes through');
assertEqual(safeNextPath('/schedule#today'), '/schedule#today', 'a relative path with a fragment passes through');

console.log("\n── safeNextPath: the exact attack this exists to stop ──");
assertEqual(safeNextPath('https://evil.example/fake-login'), '/', 'an absolute URL to another origin is rejected');
assertEqual(safeNextPath('http://evil.example'), '/', 'a plain http:// URL is rejected too, not just https://');
assertEqual(safeNextPath('//evil.example'), '/', 'a protocol-relative URL ("//evil.example", resolves to the current scheme) is rejected');
assertEqual(safeNextPath('/\\evil.example'), '/', 'a leading backslash (some browsers normalise \\ to /, making this behave like //evil.example) is rejected');
assertEqual(safeNextPath('javascript:alert(document.cookie)'), '/', 'a javascript: URI is rejected — it does not start with /, so the ordinary case already catches it');

console.log(`\n${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
