import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  /* ?signed_out=1: the login page clears every form draft on the device
     (DraftsClearedOnSignOut) — decision-batch-2026-09-15-pm.md #2. A route
     cannot reach browser storage, and an expired session must not clear. */
  return NextResponse.redirect(new URL('/login?signed_out=1', request.url), { status: 303 });
}
