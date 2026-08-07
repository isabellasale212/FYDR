import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/lib/types/database';
import { getClaims, homeRoute, isAthlete, isStaff } from './claims';

/** Route prefixes owned by each shell. A path that matches neither is public. */
const STAFF_PREFIXES = [
  '/dashboard',
  '/squad',
  '/schedule',
  '/reports',
  '/nutrition',
  '/programmes',
  '/leaderboards',
  '/analytics',
  '/settings',
] as const;

const ATHLETE_PREFIXES = ['/today', '/check-in'] as const;

function matches(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refresh the session, then resolve the shell from the user's roles.
 *
 * This runs on the server on every request. It is the only access decision the
 * application makes outside the database. A client-side role check hides a row;
 * it never grants one, and it is never what keeps an athlete off /dashboard.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const claims = await getClaims(supabase);
  const { pathname, search } = request.nextUrl;

  const wantsStaff = matches(pathname, STAFF_PREFIXES);
  const wantsAthlete = matches(pathname, ATHLETE_PREFIXES);

  if (!claims) {
    if (!wantsStaff && !wantsAthlete) return response;
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  const home = homeRoute(claims);

  if (pathname === '/login' || pathname === '/') {
    const url = request.nextUrl.clone();
    const [path, query] = home.split('?');
    url.pathname = path ?? '/login';
    url.search = query ? `?${query}` : '';
    if (url.pathname === pathname) return response;
    return NextResponse.redirect(url);
  }

  if (wantsStaff && !isStaff(claims)) {
    const url = request.nextUrl.clone();
    url.pathname = isAthlete(claims) ? '/today' : '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  if (wantsAthlete && !isAthlete(claims)) {
    const url = request.nextUrl.clone();
    url.pathname = isStaff(claims) ? '/dashboard' : '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
