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
 * level down, keyed on the request's method, URL and the headers PostgREST
 * shapes its answer by (Accept, Prefer, Range).
 *
 * WHAT IT DOES. Inside a render, a GET or HEAD to a URL that has already been
 * requested in the same render returns the same response (cloned, since a
 * body reads once). Nothing is stored beyond the render: React's cache() is
 * the scope, so a different request, a different user, a different second
 * gets a fresh Map. Outside a React render — a route handler, a server
 * action, a script — cache() has no scope (probed 16 Sept 2026: two calls
 * return two Maps) and every request is fresh.
 *
 * A WRITE CLEARS THE MEMO. Isabella's question before this shipped: writes
 * are not memoised, but does a write invalidate what the memo holds? It
 * does now, wholesale: any request that is not a GET or HEAD — POST, PATCH,
 * DELETE, and every rpc, which PostgREST calls with POST — empties the
 * render's memo once it has returned, so a read that follows a write in the
 * same render goes to the database. Wholesale rather than per table because
 * a write's effect is not confined to its URL: triggers, views
 * (`*_current`), rpcs and RLS all cross tables. Cleared after the write
 * returns, not before: a read issued while the write is in flight is a race
 * against the database whatever this file does, and clearing early would
 * only throw away the dedupe of the reads a report starts alongside its
 * audit row. Audited the same day: no server component in the product
 * writes and then reads the same data in one render — the audit row a
 * report writes (recordReportView) is never read back, the status page's
 * read receipt rpc follows its reads, refuse() logs and redirects — so the
 * clearing is there so that the first one to do so is correct without
 * knowing this file exists. scripts/test-request-memo.ts pins all of it.
 *
 * WHY THIS IS SAFE UNDER RLS. The key is the URL and the client is the
 * user's own; a repeat of the same read by the same user in the same render
 * is the same rows. */
const store = cache(() => new Map<string, Promise<Response>>());

export type MemoStore = () => Map<string, Promise<Response>>;

export function memoKey(input: RequestInfo | URL, init?: RequestInit): { method: string; key: string } {
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const h = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  return { method, key: `${method} ${url} ${h.get('accept') ?? ''} ${h.get('prefer') ?? ''} ${h.get('range') ?? ''} ${h.get('range-unit') ?? ''}` };
}

/** `getStore` is the per-request Map; the default is React's cache(). A test
 *  passes its own so the memo can be exercised outside a render. */
export function memoisedFetch(inner: typeof fetch, getStore: MemoStore = store): typeof fetch {
  return async (input, init) => {
    let map: Map<string, Promise<Response>>;
    try { map = getStore(); } catch { return inner(input, init); }
    const { method, key } = memoKey(input, init);
    if (method !== 'GET' && method !== 'HEAD') {
      try { return await inner(input, init); } finally { map.clear(); }
    }
    const hit = map.get(key);
    if (hit) return (await hit).clone();
    const p = inner(input, init);
    map.set(key, p);
    let res: Response;
    try { res = await p; } catch (e) { map.delete(key); throw e; }
    return res.clone();
  };
}
