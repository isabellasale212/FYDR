/* The sessions an RPE expectation names, with what the cutoff rule needs of
 * them — start and duration. One read for the squad compliance report and the
 * athlete report's own figure (§0ad; Builder Q5, decided 2026-09-12: two
 * figures disagreeing about one athlete is worse than either being wrong).
 *
 * Chunked because a season's worth of ids is too many for one `in`, at the
 * same 200 gymSessionCounts uses. Soft-deleted sessions are read too: a
 * session removed after its expectation was generated still had a window.
 */

import type { RpeSessionWindow } from '@/lib/complianceRpe';
import type { Db } from './groups';

const CHUNK = 200;

export async function fetchRpeSessionWindows(db: Db, sessionIds: readonly string[]): Promise<RpeSessionWindow[]> {
  const ids = Array.from(new Set(sessionIds));
  const out: RpeSessionWindow[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await db.from('sessions').select('id, starts_at, duration_min').in('id', ids.slice(i, i + CHUNK));
    if (error) throw new Error(error.message);
    for (const row of data ?? []) out.push(row);
  }
  return out;
}
