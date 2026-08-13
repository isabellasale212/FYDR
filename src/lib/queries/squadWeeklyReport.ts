import { acwrWithinBand } from '@/lib/acwr';
import { fetchAcwr, fetchWellnessTrend, type AcwrRow, type WellnessTrendRow } from './analytics';
import { fetchComplianceReport, type ComplianceDomainSummary } from './reports';
import { fetchDashboardAttention, type AttentionRow } from './flags';
import { fetchNotFullyAvailable, type NotFullyAvailableRow } from './availability';
import { fetchSquadList } from './squad';
import { fetchGroupAthleteIds, type Db } from './groups';
import { addDays, todayIso } from '@/lib/format';

/* screens/reports.md, report 2 of 5 ("Squad weekly report"), built the same
 * pass as the Athlete report and for the same reason: it reads nothing that
 * didn't already exist once GPS records and testing landed, so the cut
 * reports.ts's header named no longer applies to the gym/testing tile
 * either.
 *
 * Cut down hard against the spec, every cut real:
 *   - One page, five sections stacked, not a five-page pager. The spec's own
 *     pages (Overview, Wellness, Load, Gym and testing, Availability) become
 *     headings on one scroll instead — there's less unique content per
 *     "page" here than the Athlete report has, so a tab per section would be
 *     four extra clicks for very little.
 *   - The week is always the trailing 7 days ending today, not a Monday-
 *     start week pinned to a fixture. "The fixture context is on every page
 *     header" (the spec's own words) needs a session-to-fixture mapping this
 *     report doesn't build; there is no MD-n row and no "planned against
 *     actual" load bar, both of which need that same mapping.
 *   - No week-on-week change on the headline tiles. That needs the same
 *     four numbers computed for the week before this one and diffed — real,
 *     mechanical work, left for a pass that also decides how to handle a
 *     squad whose roster changed between the two weeks.
 *   - No monotony or strain (load's own coefficient-of-variation and
 *     load×monotony figures) — a third and fourth load statistic on top of
 *     ACWR, not built alongside it.
 *   - "Availability changes this week" shows the current board
 *     (fetchNotFullyAvailable) rather than replaying the availability event
 *     log for the week — the same simplification reports.ts's injury report
 *     already documents and makes for the same reason.
 *   - Gym adherence is a session-logged count, not a percentage — see
 *     athleteReport.ts's header for why a true adherence % isn't computable
 *     from this schema (programme_sessions has no calendar date).
 *   - No rehab group allocation section — rehabGroups.ts already has its own
 *     page for exactly this.
 */

export type SquadWeeklyTiles = {
  compliancePct: number | null;
  availablePct: number | null;
  openFlagCount: number;
  /** The honest ACWR headline: how many were computable at all, how many
   *  were suppressed under the 21-day guard, and of the computable, how
   *  many sit outside the display band. "Outside band: 0" over an
   *  all-suppressed table was the audit's false-reassurance case (S1/B4). */
  acwr: { outsideBand: number; computable: number; suppressed: number };
};

export type GymByAthleteRow = {
  athlete_id: string;
  name: string;
  sessionsLogged: number;
  sessionsCompleted: number;
};

export type TestThisWeekRow = {
  athlete_id: string;
  name: string;
  test_name: string;
  unit: string;
  value: number;
  test_date: string;
};

export type SquadWeeklyReport = {
  from: string;
  to: string;
  athleteCount: number;
  tiles: SquadWeeklyTiles;
  attention: AttentionRow[];
  wellness: {
    medianReadiness: number | null;
    outliers: WellnessTrendRow[];
    complianceByDomain: ComplianceDomainSummary[];
  };
  load: AcwrRow[];
  gymByAthlete: GymByAthleteRow[];
  testsThisWeek: TestThisWeekRow[];
  availability: NotFullyAvailableRow[];
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const a = sorted[mid];
  if (a === undefined) return null;
  if (sorted.length % 2 === 1) return a;
  const b = sorted[mid - 1];
  return b === undefined ? a : (a + b) / 2;
}

export async function fetchSquadWeeklyReport(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  timezone: string,
): Promise<SquadWeeklyReport> {
  const today = todayIso(timezone);
  const from = addDays(today, -6);

  const [athletes, acwr, wellness, compliance, attentionResult, availability, scope] = await Promise.all([
    fetchSquadList(db, orgId, groupIds),
    fetchAcwr(db, orgId, timezone, groupIds),
    fetchWellnessTrend(db, orgId, timezone, groupIds),
    fetchComplianceReport(db, orgId, groupIds, from, today),
    fetchDashboardAttention(db, orgId, today, groupIds, 10),
    fetchNotFullyAvailable(db, orgId, groupIds),
    fetchGroupAthleteIds(db, orgId, groupIds),
  ]);

  const athleteIds = athletes.map((a) => a.id);
  const nameById = new Map(athletes.map((a) => [a.id, `${a.first_name} ${a.last_name}`]));

  let gymQuery = db
    .from('gym_session_logs')
    .select('athlete_id, status')
    .eq('org_id', orgId)
    .gte('entry_date', from)
    .lte('entry_date', today);
  if (scope) gymQuery = gymQuery.in('athlete_id', scope);
  const gymLogs = await gymQuery;
  if (gymLogs.error) throw new Error(gymLogs.error.message);

  const gymByAthleteMap = new Map<string, { logged: number; completed: number }>();
  for (const row of gymLogs.data ?? []) {
    const cur = gymByAthleteMap.get(row.athlete_id) ?? { logged: 0, completed: 0 };
    cur.logged += 1;
    if (row.status === 'complete') cur.completed += 1;
    gymByAthleteMap.set(row.athlete_id, cur);
  }
  const gymByAthlete: GymByAthleteRow[] = [...gymByAthleteMap.entries()]
    .map(([athlete_id, v]) => ({
      athlete_id,
      name: nameById.get(athlete_id) ?? 'Unknown',
      sessionsLogged: v.logged,
      sessionsCompleted: v.completed,
    }))
    .sort((a, b) => b.sessionsLogged - a.sessionsLogged);

  let testsQuery = db
    .from('test_results')
    .select('athlete_id, value, test_date, test_definitions(name, unit)')
    .eq('org_id', orgId)
    .gte('test_date', from)
    .lte('test_date', today)
    .is('deleted_at', null)
    .order('test_date', { ascending: false });
  if (scope) testsQuery = testsQuery.in('athlete_id', scope);
  const testsResult = await testsQuery;
  if (testsResult.error) throw new Error(testsResult.error.message);

  const testsThisWeek: TestThisWeekRow[] = (testsResult.data ?? [])
    .filter((t) => t.test_definitions && athleteIds.includes(t.athlete_id))
    .map((t) => ({
      athlete_id: t.athlete_id,
      name: nameById.get(t.athlete_id) ?? 'Unknown',
      test_name: t.test_definitions!.name,
      unit: t.test_definitions!.unit,
      value: t.value,
      test_date: t.test_date,
    }));

  let compliancePct: number | null = null;
  {
    let expected = 0;
    let submitted = 0;
    for (const d of compliance.summary) {
      expected += d.expected;
      submitted += d.submitted;
    }
    compliancePct = expected > 0 ? Math.round((100 * submitted) / expected) : null;
  }

  const availableCount = athletes.filter((a) => a.availability === 'available').length;
  const availablePct = athletes.length > 0 ? Math.round((100 * availableCount) / athletes.length) : null;

  const acwrComputable = acwr.filter((r) => r.acwr !== null);
  const acwrTile = {
    outsideBand: acwrComputable.filter((r) => r.acwr !== null && !acwrWithinBand(r.acwr)).length,
    computable: acwrComputable.length,
    suppressed: acwr.filter((r) => r.suppressed).length,
  };

  const medianReadiness = median(wellness.map((w) => w.readiness).filter((v): v is number => v !== null));
  const outliers = wellness.filter((w) => w.outlier);

  return {
    from,
    to: today,
    athleteCount: athletes.length,
    tiles: {
      compliancePct,
      availablePct,
      openFlagCount: attentionResult.openTotal,
      acwr: acwrTile,
    },
    attention: attentionResult.rows,
    wellness: {
      medianReadiness,
      outliers,
      complianceByDomain: compliance.summary,
    },
    load: acwr,
    gymByAthlete,
    testsThisWeek,
    availability,
  };
}
