import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';

export type FydrServerClient = Awaited<ReturnType<typeof createClient>>;

/** @param forwardedHeaders Headers to send on every request this client makes.
 *
 *  Only the sign-in route passes anything: GoTrue records the address and user
 *  agent of whoever calls it, and since sign-in moved server-side that has been
 *  the Vercel function rather than the visitor — see lib/clientAddress.ts. Every
 *  other caller leaves this empty and is unaffected. */
export async function createClient(forwardedHeaders: Record<string, string> = {}) {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(Object.keys(forwardedHeaders).length > 0 ? { global: { headers: forwardedHeaders } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            /* Called from a Server Component. The middleware refreshes the
               session, so there is nothing to recover from here. */
          }
        },
      },
    },
  );
}
