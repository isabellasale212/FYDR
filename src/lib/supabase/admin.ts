import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

/* The service-role client. SUPABASE_SERVICE_ROLE_KEY bypasses RLS entirely
 * — every caller of this file is responsible for its own authorization
 * check before reaching for it, the same discipline scripts/seed-auth.ts
 * already follows for exactly the one thing an RLS-gated client can never
 * do itself: create a real auth.users row (settings/users/create/route.ts
 * is the only caller so far, and it checks the requesting user is an admin
 * — via requireStaff() plus an explicit role check — before this file's
 * client ever touches the database).
 *
 * 'server-only' at the top is a build-time guard: importing this from a
 * Client Component fails the build rather than shipping the service role
 * key to a browser bundle. */
export function createAdminClient() {
  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
