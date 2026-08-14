import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

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
 *  top of this function skipped signInWithPassword entirely: a real production outage,
 *  caught live when SUPABASE_SERVICE_ROLE_KEY turned out to have never been set in
 *  Vercel's production env at all (`vercel env ls` lists only the two NEXT_PUBLIC_* keys).
 *  admin is now optional and every admin.* call below is guarded -- missing or broken
 *  admin access degrades this route to exactly what LoginForm.tsx called directly before
 *  this file existed: a plain signInWithPassword with no rate-limit bookkeeping, not a
 *  500. Getting SUPABASE_SERVICE_ROLE_KEY added in Vercel restores real rate limiting
 *  (and, separately, is also required for settings/users/create/route.ts's admin
 *  invite flow, which shares this same client and was silently broken the same way).
 *
 *  Does not touch MFA/OTP. A locked-out check happens before signInWithPassword and a
 *  success/failure record happens after it resolves; whatever a post-password OTP
 *  challenge step needs (a second verify round trip, a partial-session state) is a
 *  separate concern this route does not narrow or assume anything about -- an MFA
 *  challenge is exactly as much "signed in" or not to login_attempt_record_result as it
 *  was to the client-side signInWithPassword call this replaces. */

export type SignInResult =
  | { ok: true }
  | { ok: false; locked: true; lockedUntil: string; secondsRemaining: number; error: string }
  | { ok: false; locked: false; error: string };

// No CAPTCHA here, by design and not by oversight -- see this file's header comment and
// migration 0048's own header for the full note. It's a real third-party vendor
// integration decision outside this task's scope; the backoff below is real and
// load-bearing on its own in the meantime.

export async function POST(request: Request): Promise<NextResponse<SignInResult>> {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ ok: false, locked: false, error: 'Enter your email and password.' }, { status: 400 });
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
    return NextResponse.json(
      {
        ok: false,
        locked: true,
        lockedUntil: gate.locked_until,
        secondsRemaining: gate.seconds_remaining,
        error: 'Too many attempts.',
      },
      { status: 429 },
    );
  }

  const supabase = await createClient();
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

  let record: { is_locked: boolean; locked_until: string; seconds_remaining: number } | undefined;
  if (admin) {
    try {
      // Resolved for login_attempts.org_id only -- an admin-visibility/support
      // convenience (migration 0048's login_attempts_admin_select policy), never used to
      // change the error message returned below. An unmatched email resolves to null
      // org_id, same as today.
      const { data: userRow } = await admin.from('users').select('org_id').eq('email', email).is('deleted_at', null).maybeSingle();

      const { data: recordRows, error: recordError } = await admin.rpc('login_attempt_record_result', {
        p_email: email,
        p_org_id: userRow?.org_id ?? null,
        p_success: !signInError,
      });
      if (recordError) throw recordError;
      record = recordRows?.[0];
    } catch (err) {
      console.error('login_attempt_record_result unavailable, real sign-in result unaffected', err);
    }
  }

  if (!signInError) {
    return NextResponse.json({ ok: true });
  }

  if (record?.is_locked) {
    return NextResponse.json(
      {
        ok: false,
        locked: true,
        lockedUntil: record.locked_until,
        secondsRemaining: record.seconds_remaining,
        error: 'Too many attempts.',
      },
      { status: 429 },
    );
  }

  // Unchanged from before this route existed: a generic message either way, so a wrong
  // password and an unknown email look identical to whoever is typing.
  return NextResponse.json({ ok: false, locked: false, error: 'That email and password do not match an account.' }, { status: 401 });
}
