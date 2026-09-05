/* Credential handling, tested before the change that makes it true.
 *
 * Build handoff step 2, in its own words: "Remove temporary passwords from both
 * single and bulk account creation. Replace with an invite-link flow: the
 * person sets their own password and confirms their address in one step. No
 * password is ever generated, emailed, or shown on screen, on either path."
 *
 * WHY A TEST AND NOT JUST A DIFF. A generated password is not one thing in one
 * place. Today it exists in six: two routes generate it, one email template
 * prints it, two components render it on screen, and the route's own response
 * type carries it. Removing five of six leaves a build that looks finished and
 * still shows a password to somebody. So the assertion is absence, stated once
 * for every surface it could survive on.
 *
 * SOURCE-LEVEL, and the same limit test-role-model.ts states about itself: this
 * proves no code path constructs, returns or renders a password, not that the
 * invite link works end to end. What it catches is the regression that actually
 * happens, which is a reintroduction: somebody adds a "temporary password"
 * fallback because an invite bounced, and it becomes permanent.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let passed = 0;
let failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) {
    passed += 1;
    console.log(`  ok - ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL - ${label}`);
  }
}

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
}

const CREATE = 'src/app/(staff)/settings/users/create/route.ts';
const BULK = 'src/app/(staff)/settings/users/bulk-invite/send/route.ts';
const CONFIRM = 'src/app/auth/confirm/route.ts';
const sources = walk('src');

/** Comments are stripped before every absence check. This file's own subject is
 *  "temporary password", and so is the explanatory comment that will sit where
 *  the generator used to. A test that cannot tell a mention from a use would
 *  forbid explaining itself. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');
}

// ---------------------------------------------------------------------------
console.log('\n-- no password is generated anywhere --');

const generators = sources.filter((f) =>
  /generateTemporaryPassword|randomPassword|generatePassword/.test(code(f)),
);
assert(generators.length === 0, `no password generator survives${generators.length ? ` (${generators.join(', ')})` : ''}`);

for (const f of [CREATE, BULK]) {
  const src = code(f);
  assert(!/\bpassword\s*:/.test(src), `${f.split('/').slice(-2).join('/')} passes no password to Supabase`);
  assert(!/temporaryPassword/.test(src), `${f.split('/').slice(-2).join('/')} neither returns nor names a temporary password`);
}

// ---------------------------------------------------------------------------
console.log('\n-- no password reaches a screen or an inbox --');

const renderers = sources
  .filter((f) => f.endsWith('.tsx'))
  .filter((f) => /temporaryPassword/.test(code(f)));
assert(renderers.length === 0, `no component renders a password${renderers.length ? ` (${renderers.join(', ')})` : ''}`);

const template = code('src/lib/email/templates.ts');
assert(!/temporaryPassword/.test(template), 'the invite email carries no password');
assert(/inviteUrl|actionLink|inviteLink/.test(template), 'the invite email carries a link instead');

// ---------------------------------------------------------------------------
console.log('\n-- both paths issue a real invite link --');

/* This first asked each route to call generateLink itself. Both call the shared
 * issueInvite() instead, which is the better shape and the stronger assertion:
 * "no password is ever generated on either path" is a promise about two code
 * paths, and it is easier to keep when there is one place that creates a
 * sign-in than when there are two that agree today. So the routes are checked
 * for using the helper, and the helper for doing the right thing. */
const INVITE_HELPER = 'src/lib/invite.ts';
for (const f of [CREATE, BULK]) {
  const src = code(f);
  const name = f.split('/').slice(-2).join('/');
  assert(/issueInvite\(/.test(src), `${name} issues its invite through the shared helper`);
  assert(!/auth\.admin\.createUser/.test(src), `${name} no longer creates an auth user itself`);
}

const helper = code(INVITE_HELPER);
assert(/generateLink/.test(helper), 'the helper generates a real link');
assert(/type: 'invite'/.test(helper), "it generates it as type 'invite', which confirms the address too");
assert(!/\bpassword\b/.test(helper), 'and sets no password of its own');
assert(/deleteInvitedUser/.test(helper), 'a failed creation can be rolled back');

// ---------------------------------------------------------------------------
console.log('\n-- the link has somewhere to land --');

/* The reset flow exchanges a PKCE ?code=, and its own header says the exchange
 * "only succeeds in the browser that asked for the email". That is true of a
 * reset the person requested themselves and can never be true of an invite an
 * administrator generated on their behalf, so an invite cannot reuse it. The
 * token_hash form has no such constraint: it is verified server side. */
let confirmSrc = '';
try {
  confirmSrc = code(CONFIRM);
} catch {
  confirmSrc = '';
}
assert(confirmSrc.length > 0, 'a server-side confirm route exists at /auth/confirm');
assert(/verifyOtp/.test(confirmSrc), 'it verifies the token server side rather than exchanging a PKCE code');
assert(/token_hash/.test(confirmSrc), 'it reads a token_hash, the form an admin-generated link can carry');

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
