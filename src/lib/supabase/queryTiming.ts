import 'server-only';

/* Query timing, opt-in, for measuring where a route's time goes.
 *
 * Off unless FYDR_QUERY_TIMING=1 is in the server's environment, in which
 * case every request the Supabase clients make is timed and written to
 * stderr as one line: `[qt] <ms> <method> <path><query> @<start>`, the
 * start being the process clock so a route's queries can be laid out as a
 * waterfall (which ran in parallel, which waited). The measuring
 * harness (docs/perf-measurements-2026-09-16.md records the first run)
 * reads the server's stderr against its own per-route time windows, so a
 * route's total is split into query time, count, and what is left — the
 * render and serialisation. Nothing is stored, nothing is sent anywhere,
 * and with the flag unset the clients get the platform fetch untouched.
 *
 * Added 16 Sept 2026 for the overnight performance pass ("measure before
 * optimising"); kept because the question "is this route slow because of
 * the database" comes back every time a report grows. */
export function timedFetch(): typeof fetch | undefined {
  if (process.env.FYDR_QUERY_TIMING !== '1') return undefined;
  return async (input, init) => {
    const started = performance.now();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    try {
      return await fetch(input, init);
    } finally {
      const ms = (performance.now() - started).toFixed(1);
      let path = url;
      try { const u = new URL(url); path = u.pathname.replace(/^\/rest\/v1/, '') + (u.search ? u.search.slice(0, 140) : ''); } catch { /* keep the raw url */ }
      process.stderr.write(`[qt] ${ms} ${(init?.method ?? 'GET').toUpperCase()} ${path} @${started.toFixed(0)}\n`);
    }
  };
}
