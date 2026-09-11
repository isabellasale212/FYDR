import { NextResponse, after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { forwardedIdentityHeaders } from '@/lib/clientAddress';
import { claimsFromSession, sessionIdFromAccessToken } from '@/lib/supabase/claims';
import { recordSignIn, recordSignInFailure } from '@/lib/signInAudit';
import {
  FAILED_SIGN_IN_MIN_MS,
  failureBody,
  holdUntil,
  isSameOriginSubmit,
  nativeRedirectPath,
  readSignInSubmission,
  SIGN_IN_COPY,
  type LimiterRecord,
  type NativeOutcome,
} from '@/lib/signInSubmission';

/** login-security checklist item 4: /login has no rate limiting.
 *  09-security-and-compliance.md §8.1 / §9.4: exponential backoff after 5 failed
 *  attempts, per email, server-side. Migration 0048_login_attempts.sql builds the table
 *  and the two functions this route calls; its own header has the full design writeup
 *  (the escalation curve, the 30 minute window, and the DoS-against-a-legitimate-user
 *  tradeoff -- a capped 60 minute ceiling and no lock-extension while already locked).
 *
 *  This is the ONLY place supabase.auth.signInWithPassword is called from the server for
 *  the sign-in form -- LoginForm.tsx used to call it directly from the browser, which is
 *  exactly what let an unforgeable, server-side attempt count not exist at all. The
 *  browser now POSTs email+password here instead; this route runs
 *  login_attempt_gate() BEFORE ever touching Supabase Auth (a locked-out attacker's
 *  guesses never reach it at all), then signInWithPassword using the request-scoped
 *  cookie-aware client (so a real success still sets the session cookie exactly the way
 *  the old client-side call did -- LoginForm's router.replace()/router.refresh() after a
 *  successful response is unchanged), then login_attempt_record_result() to record the
 *  outcome.
 *
 *  Judgement call: if login_attempt_gate() itself errors (the rate-limit table/function
 *  unreachable, not a locked-out user), this route logs it and falls through to attempt
 *  a normal sign-in rather than refusing every sign-in app-wide because the newer, less
 *  battle-tested half of the system broke. The same applies if login_attempt_record_result
 *  errors after a real signInWithPassword result: the real result is still returned to the
 *  client either way, just without an updated lockout count that one time. Rate-limiting
 *  infrastructure failing should degrade to "not currently rate limited", not "nobody can
 *  sign in".
 *
 *  That "fail open" promise used to stop at the RPC calls -- createAdminClient() itself
 *  throws synchronously (the supabase-js client constructor, not a caught RPC error) if
 *  SUPABASE_SERVICE_ROLE_KEY is missing from the environment, and an uncaught throw at the
 *  top of this function skipped signInWithPassword entirely. That was a real production
 *  outage once: the key had never been set in Vercel's production env at all, so this
 *  route degraded silently and settings/users/create/route.ts's admin invite flow, which
 *  shares the same client, was broken the same way.
 *
 *  RESOLVED. `vercel env ls production` on 2026-09-07 lists SUPABASE_SERVICE_ROLE_KEY as
 *  a Production secret, added around 2026-09-02, and the rate limiter is genuinely
 *  running: login_attempt_gate and login_attempt_record_result both exist on production
 *  and login_attempts holds live rows. If that table ever looks suspiciously empty, read
 *  record_result before concluding anything -- it DELETES the row on success, because it
 *  tracks a failure streak, so a near-empty table means sign-ins are succeeding.
 *
 *  The guard below stays regardless, and is not dead weight now the key is present: admin
 *  is optional and every admin.* call is guarded, so missing or broken admin access
 *  degrades this route to exactly what LoginForm.tsx called directly before this file
 *  existed -- a plain signInWithPassword with no rate-limit bookkeeping, not a 500. The
 *  key can go missing again; the behaviour when it does should not be a surprise.
 *
 *  Does not touch MFA/OTP. A locked-out check happens before signInWithPassword and a
 *  success/failure record happens after it resolves; whatever a post-password OTP
 *  challenge step needs (a second verify round trip, a partial-session state) is a
 *  separate concern this route does not narrow or assume anything about -- an MFA
 *  challenge is exactly as much "signed in" or not to login_attempt_record_result as it
 *  was to the client-side signInWithPassword call this replaces. */

/** TWO CALLERS, ONE ROUTE — added 2026-09-11. LoginForm's fetch sends JSON and
 *  reads JSON back; that path is byte-for-byte what it was. The form element
 *  itself now also says method="post" action="/auth/sign-in", so a submit the
 *  browser performs on its own — before React has hydrated — arrives here too,
 *  form-encoded, instead of as a GET with the password in the query string
 *  (which is what a bare <form> does, and what happened). A native submit gets
 *  a 303 redirect built from the OUTCOME, never the credentials, and is
 *  accepted only from our own origin, because a form body is what login CSRF
 *  sends. lib/signInSubmission.ts has the reasoning; nothing about the rate
 *  limiter, the audit rows or the auth call differs between the two paths. */
/** ONE ATTEMPT LEFT — added 2026-09-11 (F2). A failure now carries
 *  attemptsRemaining, and the form warns at 1. The condition it was built
 *  under is that a real account's wrong password and an unknown email's any
 *  password stay indistinguishable — same field, same wording, same timing.
 *  lib/signInSubmission.ts says how; the shape of this function is the
 *  timing half: the audit row goes in after(), and every 401 waits out
 *  FAILED_SIGN_IN_MIN_MS from the request's start. */
export type SignInResult =
  | { ok: true }
  | { ok: false; locked: true; lockedUntil: string; secondsRemaining: number; error: string }
  | { ok: false; locked: false; error: string; attemptsRemaining?: number | null };

// No CAPTCHA here, by design and not by oversight -- see this file's header comment and
// migration 0048's own header for the full note. It's a real third-party vendor
// integration decision outside this task's scope; the backoff below is real and
// load-bearing on its own in the meantime.

export async function POST(request: Request): Promise<NextResponse<SignInResult>> {
  const startedAt = Date.now();
  const { email, password, next, native } = await readSignInSubmission(request);

  /* A native submit answers with a navigation; the fetch path answers with the
     JSON it always has. Both are decided from the same outcome. The Location
     is RELATIVE, deliberately: NextResponse.redirect wants an absolute URL
     built from request.url, and in dev that came back as localhost for a
     request made to 127.0.0.1 — a different cookie jar, so the session just
     set would have been left behind. The browser resolves a relative Location
     against the URL it actually posted to, which is the only host that can be
     right. */
  const answer = (outcome: NativeOutcome, json: SignInResult, status: number): NextResponse<SignInResult> =>
    native
      ? (new NextResponse(null, { status: 303, headers: { location: nativeRedirectPath(outcome, next) } }) as NextResponse<SignInResult>)
      : NextResponse.json(json, { status });

  if (native && !isSameOriginSubmit(request.headers)) {
    // Login CSRF: a form body from another site. Refused before anything is
    // checked, so an attacker's guesses do not even reach the rate limiter.
    return NextResponse.json({ ok: false, locked: false, error: 'Sign in from the Fydr sign-in page.' }, { status: 403 });
  }

  if (!email || !password) {
    return answer({ kind: 'missing' }, { ok: false, locked: false, error: SIGN_IN_COPY.missing }, 400);
  }

  // See this file's header: admin access (SUPABASE_SERVICE_ROLE_KEY) is allowed to be
  // absent or broken. createAdminClient() itself throws synchronously when the key is
  // missing, so it's constructed inside the same try/catch as its first real use, not
  // assigned unconditionally above -- an uncaught throw here must never take the whole
  // route down with it.
  let admin: ReturnType<typeof createAdminClient> | null = null;
  let gate: { is_locked: boolean; locked_until: string; seconds_remaining: number } | undefined;
  try {
    admin = createAdminClient();
    const { data: gateRows, error: gateError } = await admin.rpc('login_attempt_gate', { p_email: email });
    if (gateError) throw gateError;
    gate = gateRows?.[0];
  } catch (err) {
    // Fail open -- see this file's header. Logged so a real outage is still visible.
    console.error('login_attempt_gate unavailable, proceeding without rate limiting', err);
    admin = null;
  }

  if (gate?.is_locked) {
    return answer(
      { kind: 'locked', secondsRemaining: gate.seconds_remaining },
      {
        ok: false,
        locked: true,
        lockedUntil: gate.locked_until,
        secondsRemaining: gate.seconds_remaining,
        error: SIGN_IN_COPY.locked,
      },
      429,
    );
  }

  /* The visitor's own address and browser, forwarded so GoTrue records THEM
     rather than this function. Without it auth.sessions.ip is the serverless
     instance that answered and user_agent is `node`, which is what made an
     ordinary athlete login look like an intrusion on 2026-09-07.

     clientAddress() refuses anything the caller could have chosen; when it
     finds nothing trustworthy this is an empty object and the behaviour is
     exactly what it is today. */
  const supabase = await createClient(forwardedIdentityHeaders(request.headers));
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  let record: LimiterRecord | undefined;
  if (admin) {
    try {
      // Resolved for login_attempts.org_id only -- an admin-visibility/support
      // convenience (migration 0048's login_attempts_admin_select policy), never used to
      // change the error message returned below. An unmatched email resolves to null
      // org_id, same as today.
      const { data: userRow } = await admin.from('users').select('id, org_id').eq('email', email).is('deleted_at', null).maybeSingle();

      const { data: recordRows, error: recordError } = await admin.rpc('login_attempt_record_result', {
        p_email: email,
        p_org_id: userRow?.org_id ?? null,
        p_success: !signInError,
      });
      if (recordError) throw recordError;
      record = recordRows?.[0];

      /* THE DURABLE RECORD OF A FAILURE, and the one row on this route that
         cannot be written by the request-scoped client. audit_authenticated_insert
         is `org_id = auth_org_id() and actor_id = auth_user_id()`; a failed
         sign-in has no session, so both are null and the policy refuses it. The
         alternative was a policy admitting anonymous inserts for this action,
         which would have made it the first row in that table an unauthenticated
         caller could write, at whatever rate they can POST. `admin` is already
         here for the rate limiter, so the service role writes it and the policy
         stays exactly as strict as it was.

         Only for accounts that exist: userRow is null for an unmatched email,
         and recordSignInFailure declines the row. See its own header for why
         that is two decisions rather than one.

         WRITTEN AFTER THE RESPONSE, since 2026-09-11. Awaiting it here made a
         real account's failure measurably slower than an unknown email's —
         one insert only the real one paid — which is an existence oracle.
         after() runs it once the response has gone, for exactly the length
         the platform keeps the invocation alive (Vercel: waitUntil). The row
         still lands; recordSignInFailure never throws. */
      if (signInError) {
        const writer = admin;
        const target = { orgId: userRow?.org_id ?? null, userId: userRow?.id ?? null };
        const context = { attemptsRemaining: record?.attempts_remaining ?? null, locked: Boolean(record?.is_locked) };
        after(() => recordSignInFailure(writer, target, request.headers, context));
      }
    } catch (err) {
      console.error('login_attempt_record_result unavailable, real sign-in result unaffected', err);
    }
  }

  if (!signInError) {
    /* THE DURABLE RECORD. auth.sessions holds live sessions only — 372 inserts
       against 362 deletes over 45 days on production — so without this row,
       97% of sign-ins leave no trace and "who signed in, and when" is
       answerable for about a week. recordSignIn never throws: a logging
       failure must not become an authentication outage, the same promise the
       rate limiter above already makes. */
    const claims = claimsFromSession(signInData.session);
    if (claims) {
      await recordSignIn(
        supabase,
        claims,
        request.headers,
        'password',
        sessionIdFromAccessToken(signInData.session?.access_token),
      );
    }
    if (!native) return NextResponse.json({ ok: true });

    /* The fetch path's caller does this check in the browser after the JSON
       comes back (see LoginForm.tsx). A native submit has no caller waiting,
       so the same question is asked here, from the session just issued: an
       account with a verified TOTP factor is aal1 until the challenge is
       passed, and /login/mfa is where that happens. */
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsChallenge = Boolean(aal && aal.nextLevel === 'aal2' && aal.currentLevel !== aal.nextLevel);
    return answer({ kind: needsChallenge ? 'mfa' : 'ok' }, { ok: true }, 200);
  }

  if (record?.is_locked) {
    return answer(
      { kind: 'locked', secondsRemaining: record.seconds_remaining },
      {
        ok: false,
        locked: true,
        lockedUntil: record.locked_until,
        secondsRemaining: record.seconds_remaining,
        error: SIGN_IN_COPY.locked,
      },
      429,
    );
  }

  // Unchanged from before this route existed: a generic message either way, so a wrong
  // password and an unknown email look identical to whoever is typing — and, held to
  // the floor, to whoever is timing. The count is the limiter's, which never knew
  // whether the account existed.
  const body = failureBody(record);
  await holdUntil(startedAt, FAILED_SIGN_IN_MIN_MS);
  return answer({ kind: 'invalid', attemptsRemaining: body.attemptsRemaining }, body, 401);
}
