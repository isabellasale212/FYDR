import type { Band } from '@/lib/stats';
import { addDays, todayIso } from '@/lib/format';
import { fetchAthlete, type AthleteProfile } from './squad';
import { fetchAthleteRecentSessions, type RecentSession } from './schedule';
import { fetchWellnessByAthlete, wellnessSeries } from './wellness';
import { fetchMyTestSummary, type MyTestSummary } from './testing';
import { fetchMyProgrammeSessions } from './programmes';
import { fetchFlagsList, type FlagListRow } from './flags';
import { fetchComplianceReport } from './reports';
import type { Db } from './groups';

/* screens/reports.md, report 1 of 5 ("Athlete report"), built now that the
 * two things reports.ts's own header named as blocking it no longer block
 * it: gps_records exists (migration 0023) and now has a real write path
 * (migration 0026), and test_definitions/test_results exist (migration
 * 0024). Both gaps were named explicitly in that header as the reason this
 * report and Squad weekly were left out of that pass — reconsidered here the
 * same way CSV export reconsidered its own earlier cut.
 *
 * Cut down against the spec, every cut real:
 *   - One page, not four with a swipeable pager. ReportPager is reused for
 *     web-native tabs (Summary / Wellness / Load / Gym and testing) rather
 *     than the mobile swipe gesture the spec describes — the same choice
 *     already made for Compliance and Injury & availability.
 *   - No materialised views (mv_squad_daily, mv_acute_chronic_load,
 *     mv_wellness_baselines, mv_programme_adherence) — none exist in this
 *     schema, the same discovery analytics.ts and reports.ts both made.
 *     ACWR and the wellness band are computed live, reusing the exact same
 *     maths analytics.ts already uses (trailing 7/28 day sums, the 21-of-28
 *     suppression guard, the athlete's own rolling mean and SD) so a coach
 *     never sees two different numbers for the same thing on two screens.
 *   - No true "gym adherence %". programme_sessions has no calendar date —
 *     screens/gym-programmes.md's own sequence is a plain integer set at
 *     creation time, not a due-on-this-day schedule — so there is no
 *     "expected" count to divide "completed" by. This report shows the
 *     current programme(s) and a straight count of logged sessions in the
 *     period instead of a fabricated percentage.
 *   - Testing: latest and PB per test the athlete has a result for, reusing
 *     fetchMyTestSummary exactly as the athlete's own My data page does. No
 *     squad percentile (that needs every athlete's results in the same
 *     query, a squad-level report, not this one).
 *   - GPS: period totals only (distance, high-speed distance, sessions with
 *     data) — the Training report is still the place for the per-session
 *     heat map; this is a period rollup, not a duplicate of that board.
 *   - No PDF, no XLSX, no scheduling, no report_schedules/report_runs
 *     machinery — a live page, recomputed on open, CSV export only, same as
 *     every other report this build ships. Every open is an audit_log row,
 *     same rule.
 *
 * Known gap, not introduced here: screens/reports.md §"Roles and access"
 * gives admin "aggregate compliance and usage only... named athlete data is
 * not in an admin's report set", but this report — like Compliance, Injury &
 * availability and the Training report before it — gates on requireStaff()
 * alone and shows an admin the same named-athlete detail a coach sees. Left
 * consistent with the three existing reports rather than fixed here alone,
 * which would leave four reports disagreeing on the same rule instead of
 * one; a single pass across all four is the right fix, not a one-off here.
 */

export type AthleteReportSummary = {
  athlete: AthleteProfile;
  compliancePct: number | null;
  openFlags: FlagListRow[];
  currentProgrammes: { programme_id: string; name: string; type: string }[];
};

export type LoadDay = { date: string; load: number | null };

export type AthleteReportLoad = {
  acute: number | null;
  chronic: number | null;
  acwr: number | null;
  suppressed: boolean;
  daysWithData: number;
  byDay: LoadDay[];
  gps: {
    sessionsWithData: number;
    totalDistanceM: number;
    highSpeedDistanceM: number;
    maxSpeedMs: number | null;
  };
};

export type AthleteReportGymAndTesting = {
  sessionsLogged: number;
  sessionsCompleted: number;
  tests: MyTestSummary[];
};

export type AthleteReport = {
  from: string;
  to: string;
  summary: AthleteReportSummary;
  wellness: Band[];
  sessions: RecentSession[];
  load: AthleteReportLoad;
  gymAndTesting: AthleteReportGymAndTesting;
};

function dateRange(from: string, days: number): string[] {
  return Array.from({ length: days }, (_, i) => addDays(from, i));
}

export async function fetchAthleteReport(
  db: Db,
  orgId: string,
  athleteId: string,
  timezone: string,
  periodDays: number,
): Promise<AthleteReport | null> {
  const today = todayIso(timezone);
  const from = addDays(today, -(periodDays - 1));
  // ACWR's chronic window is always a trailing 28 days regardless of the
  // report period selected, same as analytics.ts — a shorter view period
  // would otherwise silently change what "chronic load" means.
  const acwrFrom = addDays(today, -27);
  const acuteFrom = addDays(today, -6);

  const athlete = await fetchAthlete(db, orgId, athleteId);
  if (!athlete) return null;

  const [
    wellnessEntries,
    sessions,
    loadEntries,
    gpsRecords,
    gymLogs,
    testSummary,
    programmeSessions,
    flags,
    compliance,
  ] = await Promise.all([
    fetchWellnessByAthlete(db, athleteId, { from, to: today }),
    fetchAthleteRecentSessions(db, orgId, athleteId, from, today, 200),
    db
      .from('training_entries_current')
      .select('entry_date, session_load')
      .eq('athlete_id', athleteId)
      .gte('entry_date', acwrFrom)
      .lte('entry_date', today),
    db
      .from('gps_records')
      .select('record_date, total_distance_m, high_speed_distance_m, max_speed_ms')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .gte('record_date', from)
      .lte('record_date', today),
    db
      .from('gym_session_logs')
      .select('status')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .gte('entry_date', from)
      .lte('entry_date', today),
    fetchMyTestSummary(db, athleteId),
    fetchMyProgrammeSessions(db, athleteId),
    fetchFlagsList(db, orgId, []),
    fetchComplianceReport(db, orgId, [], from, today),
  ]);

  if (loadEntries.error) throw new Error(loadEntries.error.message);
  if (gpsRecords.error) throw new Error(gpsRecords.error.message);
  if (gymLogs.error) throw new Error(gymLogs.error.message);

  const dates = dateRange(from, periodDays);
  const wellness = wellnessSeries(wellnessEntries, dates, 'readiness', 14);

  const loadByDate = new Map<string, number>();
  for (const e of loadEntries.data ?? []) {
    if (e.entry_date === null || e.session_load === null) continue;
    loadByDate.set(e.entry_date, (loadByDate.get(e.entry_date) ?? 0) + e.session_load);
  }
  const daysWithData = loadByDate.size;
  const suppressed = daysWithData < 21;
  const chronic = suppressed ? null : [...loadByDate.values()].reduce((s, v) => s + v, 0) / 4;
  const acute = suppressed
    ? null
    : [...loadByDate.entries()].filter(([d]) => d >= acuteFrom).reduce((s, [, v]) => s + v, 0);

  const byDay: LoadDay[] = dates.map((d) => ({ date: d, load: loadByDate.get(d) ?? null }));

  const gpsRows = gpsRecords.data ?? [];
  const gps = {
    sessionsWithData: gpsRows.length,
    totalDistanceM: gpsRows.reduce((s, r) => s + (r.total_distance_m ?? 0), 0),
    highSpeedDistanceM: gpsRows.reduce((s, r) => s + (r.high_speed_distance_m ?? 0), 0),
    maxSpeedMs: gpsRows.reduce<number | null>((max, r) => (r.max_speed_ms !== null && (max === null || r.max_speed_ms > max) ? r.max_speed_ms : max), null),
  };

  const gymRows = gymLogs.data ?? [];

  const programmeByKey = new Map<string, { programme_id: string; name: string; type: string }>();
  for (const s of programmeSessions) {
    programmeByKey.set(s.programme_id, { programme_id: s.programme_id, name: s.programme_name, type: s.programme_type });
  }

  const openFlags = flags.filter((f) => f.athlete_id === athleteId);
  const complianceRow = compliance.byAthlete.find((a) => a.athlete_id === athleteId) ?? null;
  let compliancePct: number | null = null;
  if (complianceRow) {
    let expected = 0;
    let submitted = 0;
    for (const v of Object.values(complianceRow.perDomain)) {
      expected += v.expected;
      submitted += v.submitted;
    }
    compliancePct = expected > 0 ? Math.round((100 * submitted) / expected) : null;
  }

  return {
    from,
    to: today,
    summary: {
      athlete,
      compliancePct,
      openFlags,
      currentProgrammes: [...programmeByKey.values()],
    },
    wellness,
    sessions,
    load: {
      acute,
      chronic,
      acwr: acute !== null && chronic !== null && chronic !== 0 ? acute / chronic : null,
      suppressed,
      daysWithData,
      byDay,
      gps,
    },
    gymAndTesting: {
      sessionsLogged: gymRows.length,
      sessionsCompleted: gymRows.filter((r) => r.status === 'complete').length,
      tests: testSummary,
    },
  };
}
