import { fetchGroupAthleteIds, type Db } from './groups';
import { fetchAllPaged } from './paged';

/* The Training load report — the seventh report (the catalogue addendum,
 * 13 September 2026), every club. Built with the training report split.
 *
 * THE DEFINITION, which is the whole query: "Session load is RPE multiplied by
 * session minutes, summed over the period. Only sessions an athlete was
 * expected at are counted, and a session with no rating is not counted as
 * zero." (lib/reportCatalogue.ts TRAINING_LOAD_DEFINITION.)
 *
 *   - "expected at": a compliance_expectations row, domain training_rpe, for
 *     that athlete and that session, inside the window, not waived. The same
 *     rows the compliance report counts, so the two reports agree about who
 *     was asked. An ad hoc rating with no session, or a rating for a session
 *     the athlete was not expected at, is real data (My data shows it; ACWR
 *     sums it) but it is not this report's.
 *   - "RPE multiplied by session minutes": training_entries.session_load, the
 *     column MET-007 is written to, read through training_entries_current so
 *     a coach's correction is what is summed (lib/queries/athleteReport.ts
 *     reads the same view for the same reason).
 *   - "not counted as zero": an athlete whose expected sessions carry no
 *     rating has total_load null and the row says "No ratings"; a rating of
 *     0 (rest, CR-10 since 0117) is a real load of 0 and IS counted.
 *
 * The RPE club setting (0118) is the page's business, not this module's: the
 * page shows the off state and never calls this when the club does not
 * collect RPE (docs/decisions/absence-rule.md). */

export type TrainingLoadAthleteRow = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  /** Sessions the athlete was expected at in the window, not waived. */
  expected: number;
  /** Of those, the ones with a rating. */
  rated: number;
  /** Σ session_load over the rated expected sessions; null when none is
   *  rated — never 0 for "no ratings". */
  total_load: number | null;
  /** total_load / rated; null when none is rated. */
  mean_load: number | null;
  /** The single heaviest rated session in the window. */
  peak_load: number | null;
};

export type TrainingLoadReport = {
  rows: TrainingLoadAthleteRow[];
  athleteCount: number;
  /** Squad totals, summed over the rows. */
  expected: number;
  rated: number;
  totalLoad: number | null;
  fromDate: string;
  toDate: string;
};

type ExpectationRow = { athlete_id: string; session_id: string | null; is_required: boolean; waived_reason: string | null };
/* The view's columns are nullable in the generated types (a view has no NOT
   NULL); the base table's are not. Guarded below. */
type EntryRow = { athlete_id: string | null; session_id: string | null; session_load: number | null; rpe: number | null };

const key = (athleteId: string, sessionId: string) => `${athleteId}|${sessionId}`;

/** Highest load first — the athlete carrying the most sits at the top, then
 *  the ones with nothing rated (nothing to rank them by) last, by name. */
export function sortTrainingLoadRows(rows: TrainingLoadAthleteRow[]): TrainingLoadAthleteRow[] {
  return [...rows].sort((a, b) => {
    if (a.total_load === null && b.total_load === null) return a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name);
    if (a.total_load === null) return 1;
    if (b.total_load === null) return -1;
    return b.total_load - a.total_load || a.last_name.localeCompare(b.last_name);
  });
}

export async function fetchTrainingLoadReport(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  fromDate: string,
  toDate: string,
): Promise<TrainingLoadReport> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let athleteQuery = db
    .from('athletes')
    .select('id, first_name, last_name')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .neq('status', 'left_club')
    .eq('in_data', true) /* 0120: out of every data denominator — declined, withdrawn, undecided, guardian outstanding */;
  if (scope) athleteQuery = athleteQuery.in('id', scope);
  const { data: athletes, error: athleteErr } = await athleteQuery.order('last_name').order('first_name');
  if (athleteErr) throw new Error(athleteErr.message);
  const athleteIds = (athletes ?? []).map((a) => a.id);

  if (athleteIds.length === 0) {
    return { rows: [], athleteCount: 0, expected: 0, rated: 0, totalLoad: null, fromDate, toDate };
  }

  /* PAGED, both of them — athletes × sessions over a season is past
   * PostgREST's 1000-row ceiling (see reports.ts's compliance query for the
   * arithmetic), and a truncated read here is a silently smaller load. The
   * order ends in id so a tie cannot be broken differently between pages. */
  const [expectations, entries] = await Promise.all([
    fetchAllPaged<ExpectationRow>((pageFrom, pageTo) =>
      db
        .from('compliance_expectations')
        .select('athlete_id, session_id, is_required, waived_reason')
        .eq('org_id', orgId)
        .eq('domain', 'training_rpe')
        .in('athlete_id', athleteIds)
        .gte('expectation_date', fromDate)
        .lte('expectation_date', toDate)
        .order('expectation_date')
        .order('id')
        .range(pageFrom, pageTo),
    ),
    fetchAllPaged<EntryRow>((pageFrom, pageTo) =>
      db
        .from('training_entries_current')
        .select('athlete_id, session_id, session_load, rpe')
        .eq('org_id', orgId)
        .in('athlete_id', athleteIds)
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date')
        .order('id')
        .range(pageFrom, pageTo),
    ),
  ]);

  /* The expected set: one (athlete, session) per required expectation. A
   * waived one is "was not asked", the compliance report's own distinction,
   * and is not expected here either. */
  const expected = new Set<string>();
  for (const e of expectations) {
    if (e.session_id === null) continue;
    if (!e.is_required || e.waived_reason !== null) continue;
    expected.add(key(e.athlete_id, e.session_id));
  }

  /* One rating per (athlete, session) — training_entries_one_live_per_session
   * guarantees it on the base table, and the current view keeps the latest
   * revision only. Guarded anyway: a duplicate would double a load. */
  const loadByKey = new Map<string, number>();
  for (const t of entries) {
    if (t.session_id === null || t.athlete_id === null) continue;
    const k = key(t.athlete_id, t.session_id);
    if (!expected.has(k)) continue;
    if (t.session_load === null) continue;
    if (!loadByKey.has(k)) loadByKey.set(k, Number(t.session_load));
  }

  const rows: TrainingLoadAthleteRow[] = (athletes ?? []).map((a) => {
    const prefix = `${a.id}|`;
    let exp = 0;
    let rated = 0;
    let total = 0;
    let peak: number | null = null;
    for (const k of expected) {
      if (!k.startsWith(prefix)) continue;
      exp += 1;
      const load = loadByKey.get(k);
      if (load === undefined) continue;
      rated += 1;
      total += load;
      peak = peak === null ? load : Math.max(peak, load);
    }
    return {
      athlete_id: a.id,
      first_name: a.first_name,
      last_name: a.last_name,
      expected: exp,
      rated,
      total_load: rated > 0 ? total : null,
      mean_load: rated > 0 ? total / rated : null,
      peak_load: peak,
    };
  });

  const sorted = sortTrainingLoadRows(rows);
  const squadExpected = rows.reduce((s, r) => s + r.expected, 0);
  const squadRated = rows.reduce((s, r) => s + r.rated, 0);
  const squadLoad = squadRated > 0 ? rows.reduce((s, r) => s + (r.total_load ?? 0), 0) : null;

  return { rows: sorted, athleteCount: rows.length, expected: squadExpected, rated: squadRated, totalLoad: squadLoad, fromDate, toDate };
}
