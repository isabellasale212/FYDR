/* Never attempt a send to an address that cannot receive mail.
 *
 * WHY THIS EXISTS. Production carries 46 seed accounts on ashcomberfc.example
 * and marlowvale.example. `.example` is reserved by RFC 2606 and never resolves,
 * so any send to one is a guaranteed hard bounce, and hard bounces are what
 * destroys a sending domain's reputation before it has any history to protect.
 *
 * RENAMING THEM WOULD NOT HAVE HELPED, which is how this guard came to exist
 * instead: every placeholder TLD is equally non-resolving, so `.invalid` bounces
 * exactly as `.example` does, and `public.users.email` is NOT NULL with a unique
 * index so the rows cannot be cleared either. The fix had to be "do not attempt
 * the send", not "change the address".
 *
 * THE EXPOSURE IS HUMAN, NOT SYSTEMIC, and that shapes what this covers. Nothing
 * in the app enumerates users to mail them — there is no digest, no reminder, no
 * scheduled sender. A bounce needs somebody to type a reserved address into the
 * add-a-user form. So this guards the one place a send can originate, and it
 * guards it as a WRAPPER around whichever provider is configured, not inside
 * ResendProvider, so a second provider added later cannot bypass it.
 *
 * WHAT IT MUST NOT DO is block a real address. The invite test that follows this
 * change sends to a real mailbox, and over-blocking would fail closed in the one
 * direction that looks like success — nothing sent, no bounce, no email either.
 * Every negative case below is a real domain shape.
 */
import { readFileSync } from 'node:fs';
import { unsendableReason, getEmailProvider, GuardedProvider } from '@/lib/email/provider';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const strip = (src: string): string =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

console.log('the reserved domains that can never receive mail');
{
  for (const addr of [
    'a.selby@ashcomberfc.example',      // a real production seed row
    'j.barnes@marlowvale.example',      // and the other club's
    'x@thing.invalid',
    'x@thing.test',
    'x@localhost',
    'x@box.localhost',
    'x@printer.local',
    'x@svc.internal',
    'x@example.com',                    // RFC 2606 second-level, no MX
    'x@example.net',
    'x@example.org',
  ]) {
    assert(unsendableReason(addr) !== null, `refused: ${addr}`);
  }
  assert(
    unsendableReason('A.SELBY@ASHCOMBERFC.EXAMPLE') !== null,
    'and case makes no difference, because addresses arrive however they were typed',
  );
  assert(
    unsendableReason('x@mail.ashcomberfc.example') !== null,
    'a subdomain of a reserved TLD is still reserved',
  );
}

console.log('\nand the real ones it must never touch');
{
  for (const addr of [
    'isabellasale212@gmail.com',        // THE invite test's recipient
    'onboarding@resend.dev',            // the configured from-address
    'coach@ashcomberfc.co.uk',
    'a@b.io',
    'first.last+tag@sub.domain.org.uk',
  ]) {
    assert(unsendableReason(addr) === null, `allowed: ${addr}`);
  }
  /* THE LABEL-BOUNDARY CASES. A naive `endsWith('.example')` or an unanchored
     `includes` gets each of these wrong, and getting them wrong means silently
     never emailing a real club. */
  assert(unsendableReason('x@notexample.com') === null,
    'notexample.com is a real domain and must not match "example.com"');
  assert(unsendableReason('x@example.company') === null,
    'example.company is a real TLD and must not match the reserved ".example"');
  assert(unsendableReason('x@testing.co.uk') === null,
    'testing.co.uk must not match the reserved ".test"');
  assert(unsendableReason('x@mylocal.com') === null,
    'mylocal.com must not match ".local"');
}

console.log('\nmalformed input is refused rather than sent');
{
  for (const addr of ['', '   ', 'no-at-sign', 'a@', '@b.com', 'a@@b.com']) {
    assert(unsendableReason(addr) !== null, `refused: ${JSON.stringify(addr)}`);
  }
}

console.log('\nthe guard wraps the provider, so it cannot be bypassed by adding another');
{
  /* A LIST, NOT A BOOLEAN. tsc narrows a boolean initialised to `false` and
     never reassigned in the same flow — the assignment lives inside the spy's
     async method, which it does not treat as reached — so `contacted === true`
     came back as "types 'false' and 'true' have no overlap". An array's length
     is not narrowed, and recording WHAT was sent to is a better spy anyway. */
  const sentTo: string[] = [];
  const inner = {
    name: 'spy',
    async send(m: { to: string }) { sentTo.push(m.to); return { delivered: true, error: null }; },
  };
  const guarded = new GuardedProvider(inner);

  const blocked = await guarded.send({
    to: 'a.selby@ashcomberfc.example', subject: 's', text: 't', html: '<p>t</p>',
  });
  assert(blocked.delivered === false, 'a reserved address is not delivered');
  assert(sentTo.length === 0, 'and the provider underneath is never contacted — no request, so no bounce');
  assert(
    typeof blocked.error === 'string' && /ashcomberfc\.example|reserved|cannot receive/i.test(blocked.error ?? ''),
    `the refusal says why (saw ${JSON.stringify(blocked.error)})`,
  );

  /* POSITIVE CONTROL. Without it the two assertions above pass just as well for
     a guard that refuses everything, which is the failure that looks like
     success — nothing sent and nothing bounced. */
  const ok = await guarded.send({
    to: 'isabellasale212@gmail.com', subject: 's', text: 't', html: '<p>t</p>',
  });
  assert(sentTo.length === 1, 'a real address DOES reach the provider underneath');
  assert(sentTo[0] === 'isabellasale212@gmail.com', 'and reaches it unaltered');
  assert(ok.delivered === true, 'and is reported as delivered');
  assert(guarded.name === 'spy', 'the wrapper reports the real provider name, so audit rows stay truthful');
}

console.log('\ngetEmailProvider returns a guarded provider, whichever one it picked');
{
  const src = strip(readFileSync('src/lib/email/provider.ts', 'utf8'));
  const returns = [...src.matchAll(/return\s+([^;]+);/g)].map((m) => m[1] ?? '');
  const providerReturns = returns.filter((r) => /Provider/.test(r));
  assert(providerReturns.length > 0, 'getEmailProvider returns a provider');
  assert(
    providerReturns.every((r) => /GuardedProvider/.test(r)),
    `every provider it can return is wrapped (saw ${JSON.stringify(providerReturns)})`,
  );
  assert(getEmailProvider() !== null, 'and it still constructs without throwing when unconfigured');
}

console.log('\nthe audit note no longer claims the wrong reason');
{
  /* send.ts hardcoded "No email provider configured (RESEND_API_KEY/...)" as the
     note on EVERY undelivered row. With this guard that becomes a lie: the
     provider is configured and the address is the problem. An audit trail that
     misattributes a cause is worse than one that says nothing. */
  const send = strip(readFileSync('src/lib/email/send.ts', 'utf8'));
  assert(
    !/note: result\.delivered \? null : 'No email provider configured/.test(send),
    'the note is no longer hardcoded to the no-provider explanation',
  );
  assert(
    /result\.error/.test(send.slice(send.indexOf('note:'), send.indexOf('note:') + 300)),
    'and uses the real error when there is one',
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
