import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getClaims } from '@/lib/supabase/claims';
import { recordSignIn } from '@/lib/signInAudit';

/** Records a sign-in that was established in the browser rather than here.
 *
 *  WHO CALLS THIS, AND WHY IT HAS TO EXIST. Two flows create a session on the
 *  server and can log it inline — /auth/sign-in (password) and /auth/confirm
 *  (invite and magic-link token_hash). The password RESET does not: it is PKCE,
 *  the code is exchanged in the browser by `ResetConfirmForm`, and often by the
 *  SDK's own URL detection before our code runs at all. That flow reaches the
 *  app without passing through any route that could have written a row — and it
 *  is the flow that matters most, because completing a reset from a stolen
 *  mailbox is the account-takeover path.
 *
 *  WHY NOT LET THE BROWSER WRITE THE ROW ITSELF. It could: it holds a valid
 *  session and satisfies audit_authenticated_insert. But a page cannot know its
 *  own public address, so every reset would be the one sign-in in the table
 *  with a null IP. Here, `x-forwarded-for` is on the request and
 *  `clientAddress()` resolves it the same way every other caller does.
 *
 *  `getClaims` and not `claimsFromSession`: the session arrives as a cookie the
 *  visitor supplied, so it gets the full `getUser()` round trip to the auth
 *  server. That is the whole difference between this route and the two that
 *  hold a session an auth call just returned.
 *
 *  NOT AUTHORISATION-SENSITIVE, and worth saying why rather than leaving it to
 *  be worked out: a caller can only ever write a row naming THEMSELVES, because
 *  org and actor come from their own verified claims and the RLS policy pins
 *  both. The worst available abuse is signing in and logging that you signed
 *  in, repeatedly. There is no forgeable field. */
export async function POST(request: Request): Promise<NextResponse> {
  const body = await request.json().catch(() => null);
  const raw = typeof body?.method === 'string' ? body.method : '';
  /* An allow-list, not the caller's string. metadata.method is read by people
     reviewing a log; letting a caller write arbitrary text into it is how a log
     stops being evidence. Anything unrecognised is recorded as what it is. */
  const method = raw === 'recovery' ? 'recovery' : 'unknown';

  const supabase = await createClient();
  const claims = await getClaims(supabase);

  if (!claims) {
    // No session, nothing to record. Not an error worth a status the caller
    // would have to handle — it fires and forgets.
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  await recordSignIn(supabase, claims, request.headers, method);
  return NextResponse.json({ ok: true });
}
