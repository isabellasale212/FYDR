/* The request memo (lib/supabase/requestMemo.ts) does exactly four things,
 * and each is pinned here with a fake fetch so it runs outside a render:
 *
 *   1. a repeated GET or HEAD in one scope is one request;
 *   2. the key is the method, the URL and the answer-shaping headers — a
 *      count HEAD, a single-object Accept and a plain GET to the same URL are
 *      three requests, not one;
 *   3. a write — anything that is not GET or HEAD, so every rpc too — clears
 *      the scope once it returns, so a read that follows it is fresh;
 *   4. a read that failed is not remembered.
 *
 * And that no server component in src/app writes and then reads in one
 * render through the memoised client — audited 16 Sept 2026 on Isabella's
 * question; the clearing in (3) is what makes the first one to do so
 * correct anyway. */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { COUNTS, expectCount } from './lib/coverage.mjs';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};

/* 'server-only' throws outside a server bundle; the module is loaded through
   a copy with that import stripped, the same discipline test-a11y-floor uses
   for page files. */
const src = readFileSync('src/lib/supabase/requestMemo.ts', 'utf8').replace("import 'server-only';", '').replace("import { cache } from 'react';", "const cache = (fn: () => Map<string, Promise<Response>>) => fn;");
const { writeFileSync, mkdtempSync, rmSync } = await import('node:fs');
const { tmpdir } = await import('node:os');
const dir = mkdtempSync(join(tmpdir(), 'fydr-memo-'));
const file = join(dir, 'requestMemo.ts');
writeFileSync(file, src);
const { memoisedFetch } = (await import(file)) as { memoisedFetch: (inner: typeof fetch, getStore?: () => Map<string, Promise<Response>>) => typeof fetch };

console.log('the memo, exercised outside a render with its own store');
{
  const calls: string[] = [];
  let failNext = false;
  const inner = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = (init?.method ?? 'GET').toUpperCase();
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(`${method} ${url}`);
    if (failNext) { failNext = false; throw new Error('network'); }
    return new Response(JSON.stringify({ n: calls.length }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  const map = new Map<string, Promise<Response>>();
  const f = memoisedFetch(inner, () => map);
  const U = 'https://x.supabase.co/rest/v1/athletes?select=id';

  await f(U); await f(U); await f(U);
  assert(calls.length === 1, '1. three identical GETs in one scope are one request');
  const a = await (await f(U)).json();
  assert(a.n === 1, '   and the repeat returns the first response, readable (a clone)');

  await f(U, { headers: { Prefer: 'count=exact' } });
  await f(U, { headers: { Accept: 'application/vnd.pgrst.object+json' } });
  await f(U, { method: 'HEAD' });
  assert(calls.length === 4, '2. a count Prefer, a single-object Accept and a HEAD to the same URL are three more requests');

  await f('https://x.supabase.co/rest/v1/rpc/mark_availability_seen', { method: 'POST' });
  const sizeAfterWrite = map.size;
  await f(U);
  assert(sizeAfterWrite === 0 && calls.length === 6, '3. a POST (an rpc) clears the scope once it returns, and the GET after it is a fresh request');
  await f(U, { method: 'PATCH' }); await f(U);
  assert(calls.length === 8, '   so does a PATCH');

  failNext = true;
  let threw = false;
  try { await f(U + '&fail'); } catch { threw = true; }
  await f(U + '&fail');
  assert(threw && calls.length === 10, '4. a read that failed is not remembered — the retry is a request');
}

console.log('\nno server component writes and then reads in one render');
{
  const walk = (d: string, out: string[] = []): string[] => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = join(d, e.name); if (e.isDirectory()) walk(p, out); else if (/(page|layout)\.tsx$/.test(e.name)) out.push(p); } return out; };
  const offenders: string[] = [];
  for (const f of expectCount('page.tsx and layout.tsx files under src/app', walk('src/app'), COUNTS.appPages + COUNTS.appLayouts)) {
    const s = readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    /* A write in a render is a .insert/.update/.upsert/.delete on a Supabase
       builder, or an rpc whose name is not a read. The reads are named. */
    const READ_RPCS = /premium_history_kept|resolve_nutrition_targets|guardian_request_by_token|analytics_daily_rows|resolve_programme_exercises|resolve_my_programme_sessions|compute_leaderboard/;
    const writes = [...s.matchAll(/\.(insert|update|upsert)\(|\.rpc\('([a-z_]+)'/g)].filter((m) => !(m[2] && READ_RPCS.test(m[2])));
    if (writes.length === 0) continue;
    /* A write followed, later in the same file, by a Supabase read. */
    const lastWrite = Math.max(...writes.map((m) => m.index ?? 0));
    const readAfter = /\.from\('|\.rpc\('/.test(s.slice(lastWrite + 1));
    if (readAfter) offenders.push(`${f.replace('src/', '')} (write, then a read after it)`);
  }
  assert(offenders.length === 0, offenders.length === 0 ? 'every page and layout that writes does so after its last read (audited 16 Sept 2026: me/status, the report audit rows, refuse())' : offenders.join(' · '));
}

rmSync(dir, { recursive: true, force: true });
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
