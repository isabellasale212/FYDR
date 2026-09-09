/* A write that fails says so. It must never be retried behind the user's back.
 *
 * THE BUG THIS EXISTS FOR, and it survived three earlier attempts at it because
 * every one of them looked in the wrong layer.
 *
 * A failed mutation showed NOTHING: the submit button sat on a disabled
 * "Creating…" indefinitely, no message, nothing written, no navigation. It was
 * reported as the New fixture form "bouncing to /login", then as a hanging
 * getUser(), then as a missing timeout. All three were wrong. Read off React
 * Query's own mutation state, the correct error was present the entire time:
 *
 *     300ms   failureCount 1  failureReason "Your session has expired, so
 *                             nothing was saved"   isPaused false
 *     1200ms  isPaused TRUE
 *     6000ms  isPaused TRUE    ... indefinitely
 *
 * THE CAUSE is one line in @tanstack/query-core's retryer.js:
 *
 *     const canContinue = () => focusManager.isFocused()
 *       && (config.networkMode === "always" || onlineManager.isOnline())
 *       && config.canRun();
 *
 * A mutation that fails and intends to RETRY calls that first and pauses when
 * it is false. `focusManager.isFocused()` is ANDed in REGARDLESS of networkMode,
 * so a failed write pauses whenever the document is not focused — and onError
 * never runs. Setting networkMode: 'always' was tried and measured to change
 * nothing, which is what pointed at the focus term.
 *
 * WITH retry: 0 THERE IS NO RETRY, SO THERE IS NO PAUSE. Verified on an
 * UNFOCUSED tab — the exact condition that caused it: the error rendered in 2s,
 * announced with role="alert", and the button returned to "Create fixture".
 *
 * AND ZERO IS INDEPENDENTLY CORRECT HERE. These mutations are CREATES with no
 * idempotency key; retrying createFixture's POST risks a second fixture, and a
 * duplicate is worse than an error message. A person choosing to press the
 * button again is a better retry than a silent one.
 */
import { readFileSync } from 'node:fs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};

const providers = readFileSync('src/app/providers.tsx', 'utf8');
/* COMMENTS OFF BEFORE MATCHING. The block below explains the fix by quoting the
   value it replaced — "It was `retry: 2`" — and a naive scan for a positive
   retry read that sentence as code and failed against correct config. The
   fourth time comment prose corrupted a parse in one day; it comes off first
   now, everywhere. Code is checked against `code`, prose against `providers`. */
const code = providers
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/.*$/gm, (m) => m.replace(/[^\n]/g, ' '));
const mutations = /mutations:\s*\{([\s\S]*?)\n\s{10}\},/.exec(code)?.[1] ?? '';

console.log('mutations are never retried behind the user');
{
  assert(mutations.length > 0, 'the mutations default block is present');
  assert(/\bretry:\s*0\b/.test(mutations),
    'retry is 0 — a retry pauses on document focus and hides the failure entirely');
  assert(!/\bretry:\s*[1-9]/.test(mutations),
    'and it is not a positive number');
  assert(/networkMode:\s*'always'/.test(mutations),
    "networkMode is 'always', so a write is attempted rather than paused when the online manager guesses wrong");
}

console.log('\nthe reasoning cannot be deleted without noticing');
{
  /* This is the part that matters most. The value is one token; the reason it
     has that value took hours to find, was wrong three times, and lives in a
     third-party file nobody will re-derive. */
  assert(/focusManager\.isFocused/.test(providers),
    'the comment names focusManager.isFocused(), the actual gate in query-core');
  assert(/isPaused/.test(providers),
    'and the observed isPaused state that proved it');
  assert(/idempotenc/i.test(providers),
    'and why zero is right on its own terms: these are creates with no idempotency key');
}

console.log('\nno component quietly re-enables it');
{
  const files = ['src/components', 'src/app'];
  const { readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const walk = (d: string, out: string[] = []): string[] => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p, out); else if (p.endsWith('.tsx')) out.push(p);
    }
    return out;
  };
  const offenders: string[] = [];
  for (const dir of files) {
    for (const f of walk(dir)) {
      const src = readFileSync(f, 'utf8');
      if (!/useMutation\(/.test(src)) continue;
      for (const m of src.matchAll(/retry:\s*([1-9]\d*|true)/g)) {
        offenders.push(`${f.replace('src/', '')}: retry: ${m[1]}`);
      }
    }
  }
  assert(offenders.length === 0, offenders.length === 0
    ? 'no useMutation call site sets a positive retry'
    : offenders.join(' · '));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
