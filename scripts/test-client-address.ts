/* Audit item 1 of 0b: auth.sessions.ip records Vercel, not the signer.
 *
 * THE SPOOFING CASE IS THE POINT OF THIS FILE. Today's recorded address is
 * uninformative — it is the serverless function that answered. That is bad
 * because it reads as evidence and is not. But a value the VISITOR chooses
 * would be worse than uninformative: it would be evidence pointing wherever an
 * attacker wanted it to point, in the one table anybody looks at after a
 * suspected intrusion. So most of what is asserted below is about refusing to
 * forward things, not about forwarding them.
 *
 * The direction of X-Forwarded-For is the specific trap. Proxies APPEND the
 * peer they received from, so the rightmost entry was written by the nearest
 * proxy and the leftmost is whatever the client claimed on the way in. Taking
 * the first entry — which is the obvious reading of "the client is at the
 * front" — hands the field to the caller.
 *
 * That GoTrue honours the forwarded values at all was established against
 * scratch before any of this was written: a session created with
 * X-Forwarded-For: 203.0.113.45 recorded 203.0.113.45/32 in auth.sessions,
 * with the forwarded User-Agent alongside it.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { clientAddress, clientUserAgent, forwardedIdentityHeaders, isIpLiteral } from '@/lib/clientAddress';

const walkRoutes = (dir: string): string[] =>
  readdirSync(dir).flatMap((e) => {
    const p = join(dir, e);
    return statSync(p).isDirectory() ? walkRoutes(p) : p.endsWith('route.ts') ? [p] : [];
  });

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}
const h = (init: Record<string, string>): Headers => new Headers(init);

console.log('a client cannot choose what gets recorded');
{
  /* The attack: a visitor sends their own X-Forwarded-For. Vercel appends the
     real peer, so the header arrives as "<claim>, <real>". Taking the first
     entry records the claim. */
  assert(
    clientAddress(h({ 'x-forwarded-for': '203.0.113.9, 88.98.10.1' })) === '88.98.10.1',
    'the LAST hop wins, not the first — the first is whatever the caller claimed',
  );
  assert(
    clientAddress(h({ 'x-forwarded-for': 'not-an-ip, 88.98.10.1' })) === '88.98.10.1',
    'and junk in the claimed position changes nothing',
  );
  assert(
    clientAddress(h({ 'x-forwarded-for': '88.98.10.1, still-not-an-ip' })) === null,
    'while junk in the NEAREST position is refused outright rather than falling back to the claim',
  );
  assert(
    clientAddress(h({ 'x-real-ip': '88.98.10.1', 'x-forwarded-for': '203.0.113.9' })) === '88.98.10.1',
    'a platform header outranks x-forwarded-for entirely',
  );
  assert(
    clientAddress(h({ 'x-vercel-forwarded-for': '88.98.10.1', 'x-real-ip': '10.0.0.9' })) === '88.98.10.1',
    'and x-vercel-forwarded-for outranks x-real-ip',
  );
}

console.log('\nnothing trustworthy means nothing forwarded');
{
  assert(clientAddress(h({})) === null, 'no headers at all yields null');
  assert(clientAddress(h({ 'x-forwarded-for': '' })) === null, 'an empty header yields null');
  assert(clientAddress(h({ 'x-forwarded-for': 'unknown' })) === null, "and the literal 'unknown' some proxies send is not an address");
  assert(
    Object.keys(forwardedIdentityHeaders(h({}))).length === 0,
    'so the header set is empty and the caller forwards nothing — which is exactly today’s behaviour, not something worse',
  );
}

console.log('\nwhat counts as an address');
{
  assert(isIpLiteral('88.98.10.1'), 'a normal IPv4');
  assert(isIpLiteral('255.255.255.255'), 'the top of the range');
  assert(!isIpLiteral('256.1.1.1'), 'but not an octet over 255');
  assert(!isIpLiteral('88.98.10'), 'nor three octets');
  assert(!isIpLiteral('088.98.10.1'), 'nor a zero-padded octet, which some parsers read as octal');
  assert(isIpLiteral('2a00:23c6:1234:5600:1:2:3:4'), 'a full IPv6');
  assert(isIpLiteral('::1'), 'and a compressed one');
  assert(!isIpLiteral('example.com'), 'a hostname is not an address');
  assert(!isIpLiteral(''), 'and neither is nothing');
}

console.log('\nthe user agent is forwarded too, because "node" was the other half of it');
{
  assert(clientUserAgent(h({ 'user-agent': 'Mozilla/5.0 (Macintosh)' })) === 'Mozilla/5.0 (Macintosh)', 'passed through');
  assert(clientUserAgent(h({})) === null, 'absent yields null');
  assert(clientUserAgent(h({ 'user-agent': '   ' })) === null, 'and whitespace is absent');
  assert(
    (clientUserAgent(h({ 'user-agent': 'x'.repeat(900) })) ?? '').length === 512,
    'capped, so a hostile 8KB header cannot be written into a session row verbatim',
  );
}

console.log('\nEVERY route that creates a session forwards them, not just the first one');
{
  /* Found by writing the verification script: /auth/sign-in was fixed and
     /auth/confirm was not, so every invite acceptance, password reset and
     magic-link sign-in still recorded the serverless function. An invite
     acceptance is the FIRST session a new club's account ever has.

     Swept rather than listed, so a third session-creating route cannot be
     added without either forwarding or failing this. */
  const routes = walkRoutes('src/app');
  const sessionCreators = routes.filter((p) =>
    /verifyOtp|signInWithPassword|exchangeCodeForSession/.test(readFileSync(p, 'utf8')),
  );
  assert(sessionCreators.length >= 2, `found ${sessionCreators.length} route(s) that create a session`);
  for (const p of sessionCreators) {
    assert(
      /forwardedIdentityHeaders\(request\.headers\)/.test(readFileSync(p, 'utf8')),
      `${p.replace('src/app/', '')} forwards the visitor's identity`,
    );
  }
}

console.log('\nthe header set handed to supabase-js');
{
  const full = forwardedIdentityHeaders(h({ 'x-real-ip': '88.98.10.1', 'user-agent': 'Mozilla/5.0' }));
  assert(full['X-Forwarded-For'] === '88.98.10.1', 'carries the address GoTrue reads');
  assert(full['User-Agent'] === 'Mozilla/5.0', 'and the agent');
  const ipOnly = forwardedIdentityHeaders(h({ 'x-real-ip': '88.98.10.1' }));
  assert(!('User-Agent' in ipOnly), 'omits what it does not know rather than sending an empty string');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
