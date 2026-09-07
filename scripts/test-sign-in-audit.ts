/* A durable record of every successful sign-in.
 *
 * WHY THIS EXISTS. `auth.sessions` holds LIVE sessions and nothing else. On
 * production it took 372 inserts against 362 deletes over 45 days, so roughly
 * 97% of sign-ins have already left no trace, and `auth.audit_log_entries` —
 * which would have been the durable record — has never received a row on
 * either project. "Who signed in, and when" is answerable for about a week and
 * unanswerable before that, which is exactly what could not be answered on
 * 2026-09-07.
 *
 * THE ONE CONSTRAINT THAT SHAPES EVERYTHING BELOW. `audit_log`'s insert policy
 * (0012, audit_authenticated_insert) is
 *
 *     with check (org_id = auth_org_id() and actor_id = auth_user_id())
 *
 * and `org_id = auth_org_id()` is NULL — therefore not true, therefore refused —
 * when org_id is null. The column is nullable, and 0007's own comment says why
 * ("a platform support access or a failed sign in has no organisation yet"),
 * but the POLICY cannot accept the null the column allows. So a row without an
 * org is not a row that writes and reads oddly; it is a row that never lands.
 * The tests below pin that as a refusal in our own code rather than an insert
 * we send and lose, because a swallowed 42501 and a successful write look
 * identical from a fail-open caller.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { signInAuditRow, recordSignIn, recordSignInFailure, signInFailureRow, SIGN_IN_ACTION, SIGN_IN_ENTITY, SIGN_IN_FAILED_ACTION } from '@/lib/signInAudit';
import { claimsFromSession, sessionIdFromAccessToken } from '@/lib/supabase/claims';
import type { FydrClaims } from '@/lib/supabase/claims';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string): void {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
}

const h = (init: Record<string, string>): Headers => new Headers(init);

const claims = (over: Partial<FydrClaims> = {}): FydrClaims => ({
  userId: '11111111-1111-4111-8111-111111111111',
  email: 'r.callaghan@example.test',
  orgId: '22222222-2222-4222-8222-222222222222',
  athleteId: null,
  roles: ['medic'],
  ...over,
});

/** A real JWT shape — three dot-separated parts, base64url middle. The
 *  signature is never checked here and must not be: these tokens come back
 *  from a signInWithPassword the auth server has already answered. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.sig`;
}

console.log('the row says what happened, in the vocabulary the table already uses');
{
  const row = signInAuditRow(claims(), h({ 'x-real-ip': '88.98.10.1', 'user-agent': 'Mozilla/5.0' }), 'password');
  assert(row !== null, 'a complete set of claims produces a row');
  assert(row?.action === 'auth.signed_in', `action is auth.signed_in (saw ${row?.action})`);
  assert(SIGN_IN_ACTION === 'auth.signed_in', 'exported under that name');
  assert(
    /^[a-z_]+\.[a-z_]+$/.test(row?.action ?? ''),
    'and follows the dotted convention the table already uses — availability.set, injury_clinical.read',
  );
  assert(row?.entity_type === 'session' && SIGN_IN_ENTITY === 'session', 'entity_type is session');
  assert(row?.org_id === claims().orgId, 'the org is the one in the claims, which is what the policy compares against');
  assert(row?.actor_id === claims().userId, 'and the actor is the signer, not the server');
}

console.log('\nthe role recorded is the role the audit precedence names');
{
  const dual = signInAuditRow(claims({ roles: ['coach', 'medic'] }), h({}), 'password');
  assert(dual?.actor_role === 'medic', 'medic outranks coach, matching AUDIT_PRECEDENCE and the trigger');

  /* THE MAJORITY CASE, and the one the incident was about. actingRole()'s own
     comment says the athlete fallback "can only be an athlete, and an athlete
     cannot reach any caller of this" — which this file makes false, because
     athletes sign in and this is now a caller. The fallback is load-bearing
     here rather than defensive. */
  const athlete = signInAuditRow(claims({ roles: ['athlete'], athleteId: 'a1' }), h({}), 'password');
  assert(athlete?.actor_role === 'athlete', 'an athlete signing in is recorded as an athlete, not dropped');
  assert(athlete !== null, 'and produces a row at all — most sign-ins are athletes');
}

console.log('\nthe address is the visitor, resolved the way every other caller resolves it');
{
  const platform = signInAuditRow(claims(), h({ 'x-real-ip': '88.98.10.1', 'x-forwarded-for': '1.2.3.4, 88.98.10.1' }), 'password');
  assert(platform?.ip_address === '88.98.10.1', 'prefers the platform header');

  const xff = signInAuditRow(claims(), h({ 'x-forwarded-for': '10.0.0.1, 203.0.113.9' }), 'password');
  assert(xff?.ip_address === '203.0.113.9', 'and otherwise takes the LAST hop — the first is whatever the caller claimed');

  const none = signInAuditRow(claims(), h({}), 'password');
  assert(none?.ip_address === null, 'null rather than a guess when nothing is trustworthy');
  assert(none !== null, 'and an unknown address never costs the row — the sign-in still happened');
}

console.log('\nmetadata records how they got in, which is the question a review asks next');
{
  const pw = signInAuditRow(claims(), h({ 'user-agent': 'Mozilla/5.0' }), 'password');
  assert(pw?.metadata.method === 'password', 'a password sign-in says so');
  assert(pw?.metadata.user_agent === 'Mozilla/5.0', 'and carries the browser, which auth.sessions loses with the session');

  const invite = signInAuditRow(claims(), h({}), 'invite');
  assert(invite?.metadata.method === 'invite', 'an invite acceptance is distinguishable from an ordinary sign-in');

  const huge = signInAuditRow(claims(), h({ 'user-agent': 'x'.repeat(900) }), 'password');
  assert(
    (huge?.metadata.user_agent as string).length === 512,
    'a hostile 8KB agent is capped, not written verbatim into a 16KB-limited jsonb column',
  );
}

console.log('\nTHE REFUSAL: a row the policy would reject is never sent');
{
  /* See this file's header. `org_id = auth_org_id()` is NULL when org_id is
     null, so the insert is refused with a 42501 — and a fail-open caller
     swallows that, making a doomed write indistinguishable from a successful
     one. Refusing here means the log's silence is honest. */
  assert(
    signInAuditRow(claims({ orgId: null }), h({}), 'password') === null,
    'no org in the claims — refused in our code, because audit_authenticated_insert would refuse it anyway',
  );
  assert(
    signInAuditRow(claims({ userId: '' }), h({}), 'password') === null,
    'no actor — the other half of the same policy predicate',
  );
  assert(
    signInAuditRow(claims({ roles: [] }), h({}), 'password') !== null,
    'but no ROLES is still a row: the policy does not read actor_role, and a sign-in with no role is exactly what somebody would want to see',
  );
}

console.log('\nfailing to log must never cost somebody their sign-in');
{
  const rejects = { from: () => ({ insert: async () => { throw new Error('PostgREST unreachable'); } }) };
  const errors = { from: () => ({ insert: async () => ({ error: { message: 'new row violates row-level security policy' } }) }) };

  let threw = false;
  try { await recordSignIn(rejects as never, claims(), h({}), 'password'); } catch { threw = true; }
  assert(!threw, 'a thrown insert is caught — the rate limiter already degrades this way and so does this');

  threw = false;
  try { await recordSignIn(errors as never, claims(), h({}), 'password'); } catch { threw = true; }
  assert(!threw, 'and a returned PostgREST error is not rethrown');

  /* POSITIVE CONTROL. Without this the two assertions above pass just as well
     for a function that never inserts anything at all, which is the failure
     this project has shipped three times. */
  let sent: unknown = null;
  let table: string | null = null;
  const working = {
    from: (t: string) => { table = t; return { insert: async (row: unknown) => { sent = row; return { error: null }; } }; },
  };
  await recordSignIn(working as never, claims(), h({ 'x-real-ip': '9.9.9.9' }), 'password');
  assert(table === 'audit_log', 'and the working case really does write, to audit_log');
  assert((sent as { action: string })?.action === 'auth.signed_in', 'the row it sends is the row above');

  // The refusal must not reach the database either.
  sent = null;
  await recordSignIn(working as never, claims({ orgId: null }), h({}), 'password');
  assert(sent === null, 'a refused row is not sent at all, rather than sent and lost');
}

console.log('\nclaims are read from the session the auth server just issued');
{
  const token = jwt({
    session_id: '33333333-3333-4333-8333-333333333333',
    app_metadata: { org_id: 'org-from-token', roles: ['medic', 'coach'] },
  });
  const session = { access_token: token, user: { id: 'user-1', email: 'a@b.test', app_metadata: {} } };
  const c = claimsFromSession(session as never);
  assert(c?.userId === 'user-1', 'the user id comes from the session user');
  assert(c?.orgId === 'org-from-token', 'the org from the token, which is where the access-token hook writes it');
  assert(c?.roles.join(',') === 'medic,coach', 'and the roles it injected');
  assert(sessionIdFromAccessToken(token) === '33333333-3333-4333-8333-333333333333', 'the session id is recoverable, so the row can be joined to auth.sessions while it still exists');

  const fallback = claimsFromSession({
    access_token: jwt({ app_metadata: {} }),
    user: { id: 'user-2', email: null, app_metadata: { org_id: 'org-from-user', roles: ['athlete'] } },
  } as never);
  assert(fallback?.orgId === 'org-from-user', 'falls back to the user object, the same precedence getClaims uses');
  assert(claimsFromSession(null) === null, 'and no session is no claims rather than a throw');
  assert(sessionIdFromAccessToken('not-a-jwt') === null, 'a malformed token yields null rather than throwing on the sign-in path');
}

console.log('\nA FAILED sign-in is recorded too, and by the service role');
{
  /* WHY THIS ROW NEEDS A DIFFERENT WRITER. audit_authenticated_insert is
     `org_id = auth_org_id() and actor_id = auth_user_id()`, and a failed
     sign-in has no session at all — both are null, so the policy refuses it.
     The route already holds createAdminClient() for the rate limiter, so the
     row is written with the service role, which bypasses RLS. Nothing about
     the policy is loosened: no anonymous caller gains write access to this
     table, which is what the alternative would have cost. */
  const target = { orgId: '22222222-2222-4222-8222-222222222222', userId: '11111111-1111-4111-8111-111111111111' };
  const row = signInFailureRow(target, h({ 'x-real-ip': '88.98.10.1' }), { attemptsRemaining: 4, locked: false });

  assert(row?.action === 'auth.sign_in_failed', `action is auth.sign_in_failed (saw ${row?.action})`);
  assert(SIGN_IN_FAILED_ACTION === 'auth.sign_in_failed', 'exported under that name');
  assert(/^[a-z_]+\.[a-z_]+$/.test(row?.action ?? ''), 'same dotted convention as the success row');
  assert(row?.entity_type === 'sign_in', `entity_type is sign_in, NOT session — no session was created (saw ${row?.entity_type})`);
  assert(row?.entity_id === null, 'and there is no session id to point at');
  assert(row?.ip_address === '88.98.10.1', 'the address is the visitor, resolved the same way');
  assert(row?.metadata.attempts_remaining === 4, 'metadata carries where in the streak this was');
  assert(row?.metadata.locked === false, 'and whether it tripped the lockout');

  /* THE ACTOR IS CLAIMED, NOT PROVEN, and that is the one thing about this row
     that could mislead. actor_id is the account somebody tried to sign in TO;
     nothing establishes that they are that person — the sign-in failed. It is
     recorded anyway because the useful question is "what happened around this
     account", which the audit viewer's actor filter then answers. The action
     name is what says the identity was never established. */
  assert(row?.actor_id === target.userId, 'actor_id is the targeted account');
  assert(row?.actor_role === null, 'actor_role is null — nobody acted, so there is no role they acted in');
}

console.log('\n   ...and only for an account that actually exists');
{
  /* TWO REASONS, and the second is the load-bearing one.

     A row with no org is invisible: lib/queries/auditLog.ts filters every read
     by `.eq('org_id', orgId)`, so an unattributable row could never be seen in
     the app that is supposed to surface it.

     And the email is attacker-controlled. Writing an unmatched address into
     audit_log verbatim would let anybody put arbitrary text into the one table
     whose job is being true, at the rate they can POST. Unknown addresses are
     login_attempts' problem, not this table's. */
  assert(signInFailureRow({ orgId: null, userId: null }, h({}), { attemptsRemaining: 4, locked: false }) === null,
    'an unknown email writes nothing');
  assert(signInFailureRow({ orgId: 'o', userId: null }, h({}), { attemptsRemaining: 4, locked: false }) === null,
    'and so does a half-resolved one');

  const row = signInFailureRow({ orgId: 'o', userId: 'u' }, h({}), { attemptsRemaining: 4, locked: false });
  assert(row !== null && !JSON.stringify(row.metadata).includes('@'),
    'no email string reaches the metadata — actor_id already identifies the account');
}

console.log('\n   ...and failing to record it never costs anything either');
{
  const rejects = { from: () => ({ insert: async () => { throw new Error('down'); } }) };
  let threw = false;
  try {
    await recordSignInFailure(rejects as never, { orgId: 'o', userId: 'u' }, h({}), { attemptsRemaining: 4, locked: false });
  } catch { threw = true; }
  assert(!threw, 'a thrown insert is caught, like every other write on this route');

  // Positive control, for the same reason as the success path's.
  let sent: unknown = null;
  const working = { from: () => ({ insert: async (r: unknown) => { sent = r; return { error: null }; } }) };
  await recordSignInFailure(working as never, { orgId: 'o', userId: 'u' }, h({}), { attemptsRemaining: 0, locked: true });
  assert((sent as { action: string })?.action === 'auth.sign_in_failed', 'and the working case really does write');

  sent = null;
  await recordSignInFailure(working as never, { orgId: null, userId: null }, h({}), { attemptsRemaining: 4, locked: false });
  assert(sent === null, 'while an unattributable failure is not sent at all');
}

console.log('\n   ...wired into the route on the failure path only');
{
  const route = readFileSync('src/app/auth/sign-in/route.ts', 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  assert(/recordSignInFailure\(/.test(route), 'the route calls it');
  assert(/admin/.test(route) && /recordSignInFailure\(\s*admin/.test(route),
    'with the ADMIN client — the anon one would be refused by the insert policy');
  assert(/select\('id, org_id'\)/.test(route),
    "and resolves the account's id alongside its org, which the lookup did not do before");
  /* The success path writes auth.signed_in with the request-scoped client and
     the failure path writes auth.sign_in_failed with the admin one. Confusing
     them would either lose the row or write a success row for a failure. */
  assert(
    route.indexOf('recordSignInFailure(') > route.indexOf('signInError'),
    'on the failure branch, after the sign-in result is known',
  );
}

console.log('\nEVERY site that creates a session records one, or says in writing why not');
{
  /* Swept, not listed. The identity-forwarding fix was shipped for
     /auth/sign-in and missed /auth/confirm entirely, and that is the same
     mistake this sweep exists to make impossible — with the widening that the
     browser creates sessions too, so components are walked as well as routes.
     A site that should not log carries a written exemption; the guard is that
     the reason has to exist and be readable, not that it be approved. */
  const walk = (dir: string, ext: string[]): string[] =>
    readdirSync(dir).flatMap((e) => {
      const p = join(dir, e);
      return statSync(p).isDirectory() ? walk(p, ext) : ext.some((x) => p.endsWith(x)) ? [p] : [];
    });

  const CREATES_SESSION = /verifyOtp\(|signInWithPassword\(|exchangeCodeForSession\(/;
  const files = [...walk('src/app', ['route.ts', '.tsx']), ...walk('src/components', ['.tsx', '.ts'])];
  const creators = files.filter((p) => CREATES_SESSION.test(readFileSync(p, 'utf8')));

  assert(creators.length >= 4, `the sweep found ${creators.length} session-creating sites (expected at least 4, or it is not sweeping)`);

  const EXEMPT = /\/\/\s*sign-in-audit-exempt:\s*\S.{10,}/;
  for (const p of creators) {
    const src = readFileSync(p, 'utf8');
    const logs = /recordSignIn\(|reportSignIn\(/.test(src);
    const exempt = EXEMPT.test(src);
    assert(logs || exempt, `${p.replace('src/', '')} either records a sign-in or carries a reason it does not`);
    assert(!(logs && exempt), `${p.replace('src/', '')} does not claim both`);
  }

  // The exemption marker must actually require a reason, or it is a rubber stamp.
  assert(!EXEMPT.test('// sign-in-audit-exempt:'), 'a bare marker with no reason does not satisfy the guard');
  assert(!EXEMPT.test('// sign-in-audit-exempt: no'), 'and neither does a two-letter one');
  assert(EXEMPT.test('// sign-in-audit-exempt: re-authentication of an already signed-in user'), 'a real reason does');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
