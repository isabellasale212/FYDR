/* PostgREST answers every request with at most `db-max-rows` rows — this
 * project sets it explicitly (`max_rows = 1000` in supabase/config.toml). A
 * request that hits the ceiling does NOT error: it returns exactly 1000 rows
 * and looks like a complete answer. Every silent-truncation bug in this
 * codebase has been that, so any query whose result set is unbounded by
 * construction pages through it instead of hoping.
 *
 * Lifted verbatim out of lib/queries/analytics.ts, which wrote it first for
 * the 730-day analytics builder and is now one of FIFTEEN caller modules
 * across lib/queries (grep `fetchAllPaged`). Shared rather than copied, so a
 * fix to the paging rule (the `< PAGE` stop condition, the page cap) lands in
 * all of them at once — and, for the same reason, a change to that rule now
 * has fifteen modules' worth of blast radius, not two.
 *
 * PAGE is 1000 because that is PostgREST's own conventional default ceiling
 * and this project's configured value; a short page just costs one more round
 * trip, never a wrong answer.
 *
 * THE CALLER MUST SUPPLY A TOTAL ORDER. `.range()` re-runs the query per page,
 * so if the ORDER BY has ties the database is free to break them differently
 * on each call and a row can be returned twice or skipped entirely across a
 * page boundary. Order by the sort key the reader wants AND a unique tiebreak
 * (`id`), always. */
export const PAGE = 1000;

export type PagedResponse<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

export async function fetchAllPaged<T>(build: (from: number, to: number) => PagedResponse<T>): Promise<T[]> {
  const out: T[] = [];
  // 200 pages is 200k rows, far past anything a caller in this app can ask
  // for — a stop, not an expected exit.
  for (let page = 0; page <= 200; page += 1) {
    const { data, error } = await build(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
