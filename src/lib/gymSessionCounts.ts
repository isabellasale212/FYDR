import type { Db } from './queries/groups';
import { fetchAllPaged } from './queries/paged';

/* "SESSIONS LOGGED" MEANS SESSIONS WITH AT LEAST ONE LIVE SET — §0u, decided by
 * Isabella 2026-09-10, built 2026-09-12.
 *
 * What was wrong. startOrGetSessionLog writes a gym_session_logs row the
 * moment the screen opens (§0g, deliberately: the row is the outbox's anchor).
 * Two staff reports counted every such row as a session logged — the athlete
 * report and the squad weekly report — so opening a session and walking away
 * credited it, and a review that opened Conor Moroney's session inflated his
 * count by one in both. Compliance, the CSV export and the programme
 * adherence tile were already filtering on status = 'complete'.
 *
 * The rule. A session is logged when it has one or more LIVE sets
 * (gym_set_logs_current: superseded_by is null — a set that was corrected
 * still counts once, through its current revision, and
 * revise_gym_session_log re-points live sets to the replacement log row so
 * the join holds across a session correction). `completed` keeps its
 * existing status = 'complete' meaning. Page-load creation is untouched: the
 * fix is in what the reports count, not in when the row appears.
 *
 * One function counts, so the two reports cannot drift; one fetch finds the
 * live sets, chunked and paged so a squad × a season never crosses
 * PostgREST's 1000-row ceiling silently.
 */

export type GymSessionCount = { logged: number; completed: number };

export type GymLogRow = { id: string | null; status: string | null };

/** Which of `sessionLogIds` have at least one live set. Empty input → empty
 *  set, no query. */
export async function fetchSessionLogIdsWithLiveSets(
  db: Db,
  orgId: string,
  sessionLogIds: readonly string[],
): Promise<Set<string>> {
  const withSets = new Set<string>();
  const CHUNK = 200;
  for (let i = 0; i < sessionLogIds.length; i += CHUNK) {
    const chunk = sessionLogIds.slice(i, i + CHUNK);
    const rows = await fetchAllPaged<{ gym_session_log_id: string | null }>((pageFrom, pageTo) =>
      db
        .from('gym_set_logs_current')
        .select('gym_session_log_id')
        .eq('org_id', orgId)
        .in('gym_session_log_id', chunk)
        .order('id')
        .range(pageFrom, pageTo),
    );
    for (const r of rows) if (r.gym_session_log_id) withSets.add(r.gym_session_log_id);
  }
  return withSets;
}

/** The two figures for one athlete's rows. `logged` is the rows with a live
 *  set; `completed` is the rows whose status is 'complete'. */
export function countGymSessions(logs: readonly GymLogRow[], logIdsWithLiveSets: ReadonlySet<string>): GymSessionCount {
  let logged = 0, completed = 0;
  for (const row of logs) {
    if (row.id && logIdsWithLiveSets.has(row.id)) logged += 1;
    if (row.status === 'complete') completed += 1;
  }
  return { logged, completed };
}
