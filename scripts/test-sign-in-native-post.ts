/* A password never travels in a URL, whatever state the sign-in page is in.
 *
 * WHAT WAS SEEN. On 2026-09-11 a sign-in pressed before the page had hydrated
 * arrived as `GET /login?email=…&password=…` — three times, into the dev log
 * and the browser history. LoginForm's <form> had no method and no action, so
 * with React not yet listening the browser did what a bare form does: GET, to
 * its own URL, every field in the query string. Hydration is delayed by a slow
 * connection, a blocked script, a first compile; none of those is rare.
 *
 * WHAT IS PINNED.
 *   1. The form says method="post" and action="/auth/sign-in", so a native
 *      submit carries the fields in the body, to the route the fetch already
 *      uses.
 *   2. The route reads that body, and answers a native submit with a redirect
 *      whose URL is built from the outcome alone — the credentials are not an
 *      input to it, so it cannot carry them.
 *   3. Accepting a form body opens login CSRF, which JSON-only was immune to.
 *      A native submit must therefore name this host in Origin, and that check
 *      runs before signInWithPassword.
 *   4. The other sign-in-surface forms: the reset request is server-rendered
 *      and gets method="post" too; the MFA challenge and the reset confirm
 *      render their <form> only after a mount-time check, so they cannot be
 *      submitted before hydration at all — asserted here so that gate is not
 *      removed without this noticing.
 */
import { readFileSync } from 'node:fs';
import {
  isNativeFormSubmit,
  isSameOriginSubmit,
  nativeRedirectPath,
  readSignInSubmission,
  SIGN_IN_COPY,
  isSignInErrorCode,
} from '@/lib/signInSubmission';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const read = (p: string): string => readFileSync(p, 'utf8');
const h = (init: Record<string, string>): Headers => new Headers(init);
const formBody = (fields: Record<string, string>): string => new URLSearchParams(fields).toString();
const formReq = (fields: Record<string, string>, headers: Record<string, string> = {}): Request =>
  new Request('http://fydr.test/auth/sign-in', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers },
    body: formBody(fields),
  });
const jsonReq = (body: unknown): Request =>
  new Request('http://fydr.test/auth/sign-in', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

console.log('1. the form posts, to the route, so a pre-hydration submit cannot build a GET');
{
  const form = strip(read('src/components/LoginForm/LoginForm.tsx'));
  const tag = /<form\b[^>]*>/.exec(form)?.[0] ?? '';
  assert(/\bmethod="post"/i.test(tag), `LoginForm's <form> says method="post" (${tag.slice(0, 80)})`);
  assert(/\baction="\/auth\/sign-in"/.test(tag), 'and action="/auth/sign-in", the route the fetch path already uses');
  assert(/onSubmit=\{onSubmit\}/.test(tag), 'the hydrated path is unchanged: onSubmit still intercepts');
  assert(/event\.preventDefault\(\)/.test(form), 'and still prevents the native submit once React is listening');
  assert(/name="email"/.test(form) && /name="password"/.test(form), 'both fields are named, so a native submit carries them');
  assert(/type="hidden"\s+name="next"/.test(form), 'and the destination rides along as a hidden field on the native path');
  assert(!/method="get"/i.test(form), 'no form on the page says GET');
}

console.log('\n2. the route reads either body, and the password is never trimmed');
{
  const j = await readSignInSubmission(jsonReq({ email: '  A@B.c ', password: ' p w ' }));
  assert(j.native === false, 'a JSON body is the fetch path');
  assert(j.email === 'A@B.c' && j.password === ' p w ', 'email trimmed, password untouched');
  assert(j.next === null, 'the fetch path carries no next — the client reads it from the page URL as before');

  const f = await readSignInSubmission(formReq({ email: ' a@b.c ', password: ' p w ', next: '/today' }));
  assert(f.native === true, 'a form-encoded body is a native submit');
  assert(f.email === 'a@b.c' && f.password === ' p w ' && f.next === '/today', 'and yields the same fields, plus next');

  const junk = await readSignInSubmission(jsonReq('not json'));
  assert(junk.email === '' && junk.password === '' && !junk.native, 'an unreadable JSON body is an empty submission, not a throw');

  const bare = await readSignInSubmission(new Request('http://fydr.test/auth/sign-in', { method: 'POST', body: 'x' }));
  assert(bare.email === '' && bare.native === false, 'no content type reads as the fetch path and comes back empty');

  assert(isNativeFormSubmit(h({ 'content-type': 'multipart/form-data; boundary=x' })), 'multipart is native too');
  assert(!isNativeFormSubmit(h({ 'content-type': 'application/json; charset=utf-8' })), 'JSON is not');
}

console.log('\n3. a native submit is accepted only from this host — login CSRF');
{
  assert(isSameOriginSubmit(h({ origin: 'https://fydr.app', host: 'fydr.app' })), 'Origin matching Host passes');
  assert(isSameOriginSubmit(h({ origin: 'http://127.0.0.1:3001', host: '127.0.0.1:3001' })), 'with a port, on dev');
  assert(isSameOriginSubmit(h({ origin: 'https://fydr.app', host: 'lambda.internal', 'x-forwarded-host': 'fydr.app' })), 'or matching the platform\'s forwarded host');
  assert(!isSameOriginSubmit(h({ origin: 'https://evil.example', host: 'fydr.app' })), 'another site\'s form is refused');
  assert(!isSameOriginSubmit(h({ host: 'fydr.app' })), 'no Origin at all is refused — a browser form POST always sends one');
  assert(!isSameOriginSubmit(h({ origin: 'null', host: 'fydr.app' })), 'the opaque "null" origin (sandboxed frame, data: URL) is refused');
  assert(!isSameOriginSubmit(h({ origin: 'https://fydr.app.evil.example', host: 'fydr.app' })), 'a host that merely starts with ours is refused');

  const route = strip(read('src/app/auth/sign-in/route.ts'));
  const check = route.indexOf('isSameOriginSubmit(');
  const signIn = route.indexOf('signInWithPassword(');
  assert(check > 0 && signIn > 0 && check < signIn, 'the route runs the origin check before signInWithPassword');
  assert(/readSignInSubmission\(request\)/.test(route), 'and reads the body through readSignInSubmission, the one reader for both shapes');
  assert(/status:\s*403/.test(route), 'a cross-site native submit is a 403');
}

console.log('\n4. where a native submit lands is built from the outcome, never the credentials');
{
  assert(nativeRedirectPath({ kind: 'ok' }, null) === '/', 'success with no next goes to /, and the middleware resolves the shell');
  assert(nativeRedirectPath({ kind: 'ok' }, '/my-data') === '/my-data', 'success honours a relative next');
  assert(nativeRedirectPath({ kind: 'ok' }, 'https://evil.example') === '/', 'and refuses an absolute one — the same guard as the client path');
  assert(nativeRedirectPath({ kind: 'ok' }, '//evil.example') === '/', 'including protocol-relative');
  assert(nativeRedirectPath({ kind: 'mfa' }, '/today') === '/login/mfa?next=%2Ftoday', 'an account with a verified factor is sent to the challenge, next preserved');
  assert(nativeRedirectPath({ kind: 'invalid' }, null) === '/login?e=invalid', 'a wrong password is a code, not the words');
  assert(nativeRedirectPath({ kind: 'missing' }, null) === '/login?e=missing', 'an empty submission likewise');
  assert(nativeRedirectPath({ kind: 'locked', secondsRemaining: 90.7 }, null) === '/login?e=locked&s=90', 'a lockout carries whole seconds so the form can run its countdown');
  assert(nativeRedirectPath({ kind: 'invalid' }, '/my-data') === '/login?e=invalid&next=%2Fmy-data', 'a failure keeps next so the retry still lands where they were going');

  /* The function's inputs are an outcome and a path. Assert the shape anyway,
     for the reader who wonders. */
  const every = [
    nativeRedirectPath({ kind: 'ok' }, '/x'), nativeRedirectPath({ kind: 'mfa' }, '/x'),
    nativeRedirectPath({ kind: 'invalid' }, '/x'), nativeRedirectPath({ kind: 'missing' }, '/x'),
    nativeRedirectPath({ kind: 'locked', secondsRemaining: 5 }, '/x'),
  ];
  assert(every.every((p) => !/email|password|@/.test(p)), 'no redirect path names an email or a password');
  assert(every.every((p) => p.startsWith('/') && !p.startsWith('//')), 'and every one is a same-origin path');

  const route = strip(read('src/app/auth/sign-in/route.ts'));
  assert(/status:\s*303/.test(route) && /location:\s*nativeRedirectPath\(/.test(route),
    'the route answers a native submit with a 303 — POST becomes GET — and a RELATIVE Location, so the host is the one the browser posted to');
  assert(!/NextResponse\.redirect\(/.test(route), 'not NextResponse.redirect, which would build the host from request.url');
  assert(/nativeRedirectPath\(/.test(route), 'and uses nativeRedirectPath for every native destination');
}

console.log('\n5. the form turns the code back into the same words the fetch path shows');
{
  const form = strip(read('src/components/LoginForm/LoginForm.tsx'));
  assert(/isSignInErrorCode\(/.test(form) && /SIGN_IN_COPY\[/.test(form), 'LoginForm reads e through SIGN_IN_COPY');
  assert(isSignInErrorCode('no-roles') && isSignInErrorCode('invalid') && isSignInErrorCode('locked') && isSignInErrorCode('missing'), 'all four codes resolve');
  assert(!isSignInErrorCode('constructor') && !isSignInErrorCode('') && !isSignInErrorCode(null), 'and nothing else does — not even a prototype key');
  const route = strip(read('src/app/auth/sign-in/route.ts'));
  assert(!/'That email and password do not match an account\.'/.test(route) && /SIGN_IN_COPY\.invalid/.test(route),
    'the route no longer carries its own copy of the invalid message');
  assert(/SIGN_IN_COPY\.missing/.test(route) && /SIGN_IN_COPY\.locked/.test(route), 'nor of missing or locked');
  assert(SIGN_IN_COPY.invalid === 'That email and password do not match an account.', 'and the words are the words the app has always used');
  assert(/params\.get\('s'\)/.test(form) && /setLockedUntil|lockedUntil/.test(form), 'a native lockout starts the same live countdown');
}

console.log('\n6. the rest of the sign-in surface');
{
  const reset = strip(read('src/components/ResetRequestForm/ResetRequestForm.tsx'));
  const resetTag = /<form\b[^>]*>/.exec(reset)?.[0] ?? '';
  assert(/\bmethod="post"/i.test(resetTag), 'the reset request form is server-rendered and says method="post", so an email never goes into a URL either');

  /* These two render their <form> only once a mount-time check has run —
     there is no server-rendered form for a browser to submit on its own. */
  const mfa = strip(read('src/components/MfaChallengeForm/MfaChallengeForm.tsx'));
  const mfaGate = mfa.indexOf("if (status === 'loading')");
  const mfaForm = mfa.indexOf('<form');
  assert(/useState<Status>\('loading'\)/.test(mfa) && mfaGate > 0 && mfaGate < mfaForm,
    'the MFA challenge renders nothing submittable until its mount check has run');
  const confirm = strip(read('src/components/ResetConfirmForm/ResetConfirmForm.tsx'));
  const cGate = confirm.indexOf("if (phase === 'checking')");
  const cForm = confirm.indexOf('<form');
  assert(/'checking'/.test(confirm) && cGate > 0 && cGate < cForm,
    'the reset confirm renders nothing submittable until its link check has run');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
