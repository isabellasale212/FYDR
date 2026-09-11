/* §0u — "Sessions logged" counts a gym session only once it has at least one
 * live set. Decided by Isabella 2026-09-10, built 2026-09-12.
 *
 * WHY. startOrGetSessionLog writes the gym_session_logs row the moment the
 * screen opens (§0g, on purpose), and two staff reports counted every such
 * row: a session opened and abandoned — or opened by a reviewer — was
 * credited as logged. Compliance, the export and the programme tile already
 * filtered on status = 'complete'.
 *
 * THE RULE: logged = has one or more live sets (gym_set_logs_current);
 * completed = status 'complete', unchanged. Page-load creation is untouched.
 * The guard the decision asked for: a log with zero sets is absent from both
 * counts; one with a single set appears in logged and not in completed.
 */
import { readFileSync } from 'node:fs';
import { countGymSessions, fetchSessionLogIdsWithLiveSets } from '@/lib/gymSessionCounts';

let passed = 0, failed = 0;
const assert = (cond: boolean, label: string): void => {
  if (cond) { passed += 1; console.log(`  ok   - ${label}`); }
  else { failed += 1; console.log(`  FAIL - ${label}`); }
};
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const read = (p: string): string => readFileSync(p, 'utf8');

console.log('the count');
{
  const opened = { id: 'opened', status: 'in_progress' };
  const oneSet = { id: 'one-set', status: 'in_progress' };
  const done = { id: 'done', status: 'complete' };
  const live = new Set(['one-set', 'done']);
  assert(JSON.stringify(countGymSessions([opened], live)) === '{"logged":0,"completed":0}', 'a session log with zero sets is absent from both counts — opening the screen is not logging');
  assert(JSON.stringify(countGymSessions([oneSet], live)) === '{"logged":1,"completed":0}', 'one with a single live set appears in logged and not in completed');
  assert(JSON.stringify(countGymSessions([done], live)) === '{"logged":1,"completed":1}', 'a completed session with sets is in both');
  assert(JSON.stringify(countGymSessions([opened, oneSet, done], live)) === '{"logged":2,"completed":1}', 'and together they add up — logged is the superset');
  assert(JSON.stringify(countGymSessions([{ id: null, status: 'complete' }], live)) === '{"logged":0,"completed":1}', 'a view row with a null id (the generated types allow it) cannot be matched to sets and is not logged');
  assert(JSON.stringify(countGymSessions([], live)) === '{"logged":0,"completed":0}', 'no rows, no counts');
}

console.log('\nthe live-set lookup');
{
  /* A db stub that records the query and answers with a page of set rows. */
  const calls: { table: string; ids: string[]; range: [number, number] }[] = [];
  const stub = {
    from: (table: string) => {
      const q = { ids: [] as string[] };
      const chain = {
        select: () => chain, eq: () => chain, order: () => chain,
        in: (_col: string, ids: string[]) => { q.ids = ids; return chain; },
        range: async (from: number, to: number) => {
          calls.push({ table, ids: q.ids, range: [from, to] });
          /* Answer: every id ending in 's' has one set; one page only. */
          return { data: q.ids.filter((id) => id.endsWith('s')).map((id) => ({ gym_session_log_id: id })), error: null };
        },
      };
      return chain;
    },
  };
  const ids = Array.from({ length: 450 }, (_, i) => `log-${i}${i % 3 === 0 ? 's' : ''}`);
  const result = await fetchSessionLogIdsWithLiveSets(stub as never, 'org', ids);
  assert(calls.every((c) => c.table === 'gym_set_logs_current'), 'reads gym_set_logs_current — live sets only, never the base table');
  assert(calls.length === 3 && calls[0]!.ids.length === 200 && calls[2]!.ids.length === 50, '450 ids go in three chunks of at most 200, so the URL stays sane');
  assert(result.size === ids.filter((id) => id.endsWith('s')).length && result.has('log-0s') && !result.has('log-1'), 'and the union of the answers is exactly the ids with a set');
  const none = await fetchSessionLogIdsWithLiveSets(stub as never, 'org', []);
  assert(none.size === 0 && calls.length === 3, 'no ids → no query');
}

console.log('\nboth reports read the shared count');
{
  const athlete = strip(read('src/lib/queries/athleteReport.ts'));
  const squad = strip(read('src/lib/queries/squadWeeklyReport.ts'));
  for (const [name, src] of [['athleteReport.ts', athlete], ['squadWeeklyReport.ts', squad]] as const) {
    assert(/from '@\/lib\/gymSessionCounts'/.test(src) && /countGymSessions\(/.test(src) && /fetchSessionLogIdsWithLiveSets\(/.test(src), `${name} counts through lib/gymSessionCounts`);
    assert(/\.from\('gym_session_logs_current'\)/.test(src) && /\.select\('id, (athlete_id, )?status'\)/.test(src), `${name} selects the log id so sets can be matched`);
  }
  assert(!/sessionsLogged: gymRows\.length/.test(athlete), 'athleteReport no longer counts rows as logged');
  assert(!/cur\.logged \+= 1/.test(squad), 'squadWeeklyReport no longer counts rows as logged');
  assert(/export async function startOrGetSessionLog/.test(read('src/lib/queries/programmes.ts')), 'page-load creation (startOrGetSessionLog) still exists — the fix is in what is counted, not when the row appears');
}

console.log('\nthe specs say what the number means');
{
  for (const p of ['docs/screens/19-athlete-report.md', 'docs/screens/21-squad-weekly-report.md']) {
    assert(/at least one live set/.test(read(p)), `${p} defines "Sessions logged" as sessions with at least one live set`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
