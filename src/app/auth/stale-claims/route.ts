import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { claimsStale, getClaims } from '@/lib/supabase/claims';

/**
 * Where `base()` sends a session whose authority is out of date.
 *
 * WHY A ROUTE AND NOT A REDIRECT TO /login. The stale cookie is still a valid
 * session as far as the auth server is concerned, so /login would bounce it
 * straight back to /today and the guard would bounce it here again — a redirect
 * loop. A route handler is the only place in this app that can both read the
 * session and write cookies, which is what signing out requires. Server
 * components cannot set cookies at all.
 *
 * WHY GET, WHEN /auth/sign-out IS DELIBERATELY POST-ONLY. `redirect()` in a
 * server component issues a GET, so this has to answer one. Sign-out stays
 * POST-only because a GET sign-out is CSRF-able from any <img> tag — and this
 * route closes that same gap a different way: it RE-CHECKS staleness itself and
 * only signs out if the session really is out of date. A stray or forged GET on
 * a healthy session is therefore a no-op that lands the user back on their own
 * screen, not a forced sign-out.
 *
 * The re-check is a second read of the same row `base()` just read. That is
 * deliberate duplication: this route is reachable directly, so it cannot assume
 * a guard vouched for it.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const claims = await getClaims(supabase);

  if (claims) {
    const { data: live } = await supabase
      .from('users')
      .select('claims_version')
      .eq('id', claims.userId)
      .maybeSingle();

    /* No row means deleted, soft-deleted, or hidden by RLS — sign out, the same
       fail-closed reading base() takes. */
    if (!live || claimsStale(claims.claimsVersion, live.claims_version)) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL('/login?e=stale-claims', request.url), { status: 303 });
    }
  }

  /* Healthy session, or none at all: nothing to revoke. Send a signed-in user
     back to the shell rather than to a sign-in form they do not need. */
  return NextResponse.redirect(new URL(claims ? '/' : '/login', request.url), { status: 303 });
}
