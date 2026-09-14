import 'server-only';
import { cache } from 'react';

/* One read per render: a request-scoped memo for the Supabase clients.
 *
 * MEASURED, 16 Sept 2026 (docs/perf-measurements-2026-09-16.md): a staff
 * route's time is round trips, and a large share of them are byte-identical
 * repeats inside one render — /reports/squad read `athletes` fourteen times,
 * /schedule repeated 29 of its 48 queries, every route ran the shell's
 * `users` and `organisations` reads twice because the layout and the page
 * each ask. Next memoises plain GET fetches per render; the Supabase client's
 * requests were not being caught by it, so this does the same thing one
 * level down, keyed on the request's method and URL.
 *
 * WHAT IT DOES. Inside a render, a GET or HEAD to a URL that has already been
 * requested in the same render returns the same response (cloned, since a
 * body reads once). Nothing is stored beyond the render: React's cache() is
 * the scope, so a different request, a different user, a different second
 * gets a fresh Map. Writes — POST, PATCH, DELETE, and every rpc (PostgREST
 * calls those with POST) — are never memoised. Outside a React render (a
 * route handler, a script) cache() has no scope and every call is fresh.
 *
 * WHY THIS IS SAFE UNDER RLS. The key is the URL and the client is the
 * user's own; a repeat of the same read by the same user in the same render
 * is the same rows. A read that must see a write made earlier in the same
 * render is a POST followed by a GET, and only the GET is memoised — but the
 * GET comes after the write, so its first request is the one that runs. The
 * one pattern this would mis-serve — read, write, read the same URL again in
 * one render — does not occur in a server component, which renders once. */
const store = cache(() => new Map<string, Promise<Response>>());

export function memoisedFetch(inner: typeof fetch): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') return inner(input, init);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    let map: Map<string, Promise<Response>>;
    try { map = store(); } catch { return inner(input, init); }
    /* The same URL can be asked two ways — a count HEAD, a single-object
       Accept, a Range — and PostgREST answers each differently, so those
       headers are part of the key. */
    const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    const key = `${method} ${url} ${h.get('accept') ?? ''} ${h.get('prefer') ?? ''} ${h.get('range') ?? ''} ${h.get('range-unit') ?? ''}`;
    const hit = map.get(key);
    if (hit) return (await hit).clone();
    const p = inner(input, init);
    map.set(key, p);
    const res = await p;
    return res.clone();
  };
}
