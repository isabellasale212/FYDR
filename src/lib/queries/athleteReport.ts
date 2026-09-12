import { ACWR_ACUTE_WINDOW_DAYS, ACWR_CHRONIC_WINDOW_DAYS, computeAcwr, loadByDateFrom } from '@/lib/acwr';
import type { Band } from '@/lib/stats';
import { addDays } from '@/lib/format';
import { inclusiveDays } from '@/lib/period';
import { fetchAthlete, type AthleteProfile } from './squad';
import { rangeBounds, type RecentSession, type Session } from './schedule';
import { fetchWellnessByAthlete, wellnessSeries } from './wellness';
import { fetchMyTestSummary, type MyTestSummary } from './testing';
import { fetchMyProgrammeSessions } from './programmes';
import { fetchFlagsList, type FlagListRow } from './flags';
import { fetchAllPaged } from './paged';
import { classifyRpeSubmissions, rpeExpectationKey } from '@/lib/complianceRpe';
import { fetchRpeSessionWindows } from './rpeSessionWindows';
import { countGymSessions, fetchSessionLogIdsWithLiveSets, type GymLogRow } from '@/lib/gymSessionCounts';
import type { ComplianceDomain } from '@/lib/types/database';
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
 *
 * ---------------------------------------------------------------------------
 * WIDENED FROM `?days=[28, 90]` TO THE FULL PERIOD MODEL
 * ---------------------------------------------------------------------------
 *
 * This report now takes a resolved {from, to} range rather than a day count,
 * because `season` and `all` have no day count to take — their length comes
 * from a database row (lib/period.ts). Three consequences, each handled
 * below at the point it bites:
 *
 *  1. ACWR DOES NOT MOVE. It is pinned to trailing 7:28 whatever the coach
 *     picks, because that is what the ratio IS. See the block inside
 *     fetchAthleteReport.
 *  2. `byDay` USED TO BE WRONG PAST 28 DAYS. The load read was bounded to the
 *     ACWR window while the day list was built over the period, so `?days=90`
 *     already rendered 62 permanently-empty days. Fixed, not merely widened.
 *  3. EVERY READ WHOSE WINDOW CAN GROW NOW PAGES. PostgREST caps unpaginated
 *     reads at 1000 rows and does not error (queries/paged.ts). Two reads were
 *     replaced outright rather than paged in place: the squad-wide compliance
 *     report this used for one athlete's percentage, and the org-wide session
 *     fan-out with its hard 200-row slice. Both replacements are at the foot
 *     of this file with the reasoning.
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

/** The readiness band's BASELINE, in days. Fixed at 14 whatever the period is:
 *  the page prints "against their own 14 day rolling mean and ±1SD band" and
 *  reports/athlete/[athleteId]/period.ts justifies offering `week` on the
 *  premise that "the band is built from data outside the window, so it does not
 *  collapse". Both were false until the LEAD-IN below existed — the same
 *  number, and the same lead-in, playerProfile.ts already uses for this chart
 *  under the name WELLNESS_ROLLING_WINDOW. */
const WELLNESS_ROLLING_WINDOW = 14;

/** The window this report was asked for. Replaces the old `periodDays:
 *  number` argument, which could not express the two open-ended keys — a
 *  season's length and "all on record" come from a database row, not from
 *  arithmetic on a constant, so the caller resolves them (lib/period.ts's
 *  resolveRange) and hands the real dates down. Plain YYYY-MM-DD calendar
 *  dates throughout; every column they touch below is `date`-typed. */
export type AthleteReportRange = { from: string; to: string };

export async function fetchAthleteReport(
  db: Db,
  orgId: string,
  athleteId: string,
  timezone: string,
  range: AthleteReportRange,
): Promise<AthleteReport | null> {
  const { from, to: today } = range;
  const periodDays = inclusiveDays(from, today);

  /* ══════════════════════════════════════════════════════════════════════
   * ACWR IS PINNED TO 7:28 AND THE PERIOD CONTROL DOES NOT REACH IT
   * ══════════════════════════════════════════════════════════════════════
   *
   * ACWR is not a view of load over a window — it is DEFINED as a trailing
   * 7-day acute sum over a trailing 28-day chronic sum (ACWR_ACUTE_WINDOW_DAYS
   * / ACWR_CHRONIC_WINDOW_DAYS, lib/acwr.ts, the one shared definition). There
   * is no season-long or all-time ACWR; widening the window does not widen the
   * ratio. So these two dates are derived from `today` alone and NEVER from
   * `from`, whatever the coach picked.
   *
   * That much was already true. What was NOT true, and is fixed here: the
   * load query itself was bounded to `acwrFrom` while `byDay` was built over
   * the whole period, so at the old `?days=90` this report already drew 62
   * empty days and the CSV exported 62 empty rows — a real, shipped
   * off-by-window bug that the period control would have turned into 702
   * empty days at `all`. The read now spans whichever window is LONGER, and
   * ACWR takes its own 28-day slice out of the result rather than the read
   * being narrowed to it. */
  const acwrFrom = addDays(today, -(ACWR_CHRONIC_WINDOW_DAYS - 1));
  const acuteFrom = addDays(today, -(ACWR_ACUTE_WINDOW_DAYS - 1));
  const loadFrom = from < acwrFrom ? from : acwrFrom;

  /* THE READINESS BAND NEEDS ITS 14 DAYS OF LEAD-IN, and the same reasoning as
   * `loadFrom` above applies: a figure computed over a trailing window has to
   * be READ from a wider window than it is DRAWN over.
   *
   * rollingBand (lib/stats.ts) needs minObservations = 4 before it draws a mean
   * or an SD at all. Reading only [from, today] meant the band was built from at
   * most `periodDays` points, so at `?period=week` an athlete with two years of
   * daily wellness got no band for the first three days and a 4-to-7-day
   * "baseline" for the rest — and a reading well inside their real usual range
   * could plot outside the drawn band. This copies playerProfile.ts:608 and
   * :709-714 (`wellnessFrom` / the `WELLNESS_ROLLING_WINDOW + range.days`
   * build / `band.slice(-range.days)`), which already does it correctly for
   * the same chart on the same data: fetch
   * from `from - 14`, build the series over `14 + periodDays` dates, then drop
   * the lead-in with a `.slice(-periodDays)` so only the days asked for render.
   *
   * `entry_date` is a `date` column, so these are plain calendar dates and
   * addDays is the whole of the arithmetic — no dateInTz (CLAUDE.md rule 5
   * governs instants). */
  const wellnessFrom = addDays(from, -WELLNESS_ROLLING_WINDOW);

  const athlete = await fetchAthlete(db, orgId, athleteId);
  if (!athlete) return null;

  const [
    wellnessEntries,
    loadEntries,
    gpsRows,
    gymRows,
    testSummary,
    programmeSessions,
    flags,
    compliancePct,
  ] = await Promise.all([
    /* NOT paged, and this is the one query on this report where that is a
     * considered answer rather than an oversight. `wellness_entries_current`
     * carries at most one live row per athlete per day — migration 0004's
     * `wellness_entries_one_live_per_day` unique index, which is what makes
     * the view "current" — and this is a SINGLE athlete. MAX_WINDOW_DAYS caps
     * every period at 730, and the band's 14-day lead-in below takes the
     * ceiling on this result to 744 rows against PostgREST's 1000. Still
     * inside it, but the margin is now 256 rows rather than 270: if
     * MAX_WINDOW_DAYS ever rises, or the lead-in grows, this must page. */
    fetchWellnessByAthlete(db, athleteId, { from: wellnessFrom, to: today }),

    /* PAGED. One athlete can log several sessions on one day
     * (`training_entries_one_live_per_session`, not per day), so 730 days is
     * comfortably over 1000 rows for anyone training twice a day. This is
     * also the query whose truncation would be worst: `session_load` is
     * SUMMED into both halves of the ratio, so a short read silently deflates
     * acute and chronic together and prints a plausible ACWR that is wrong.
     * Ordered `entry_date, id` — a unique tail, because two entries on the
     * same date tie and a tie broken differently across pages double-counts
     * or drops a load value. `session_id` and `rpe` come along for the
     * sessions rollup below rather than being fetched a second time. */
    fetchAllPaged((pageFrom, pageTo) =>
      db
        .from('training_entries_current')
        .select('entry_date, session_id, rpe, session_load')
        .eq('org_id', orgId)
        .eq('athlete_id', athleteId)
        .gte('entry_date', loadFrom)
        .lte('entry_date', today)
        .order('entry_date')
        .order('id')
        .range(pageFrom, pageTo),
    ),

    // PAGED: one row per athlete per GPS-tracked session, several a week and
    // unbounded over a season. Every figure below it is a sum.
    fetchAllPaged((pageFrom, pageTo) =>
      db
        .from('gps_records')
        .select('record_date, total_distance_m, high_speed_distance_m, max_speed_ms')
        .eq('org_id', orgId)
        .eq('athlete_id', athleteId)
        .gte('record_date', from)
        .lte('record_date', today)
        .order('record_date')
        .order('id')
        .range(pageFrom, pageTo),
    ),

    // PAGED: one row per gym session logged, and both figures derived from it
    // are counts of the rows themselves — the shape where a silent 1000-row
    // cap reads as "this athlete logged exactly 1000 sessions".
    //
    // AND THE VIEW, NOT THE BASE TABLE — 0045:239's own comment is "Read this,
    // never the base table." Its two siblings in this Promise.all already read
    // wellness_entries_current and training_entries_current; this one was
    // still on gym_session_logs, so a single session corrected through
    // revise_gym_session_log counted twice (the superseded row AND its
    // replacement), and the report and its PDF/CSV claimed two sessions where
    // one happened. Counts of revisable rows must come from the _current view.
    fetchAllPaged<GymLogRow>((pageFrom, pageTo) =>
      db
        .from('gym_session_logs_current')
        .select('id, status')
        .eq('org_id', orgId)
        .eq('athlete_id', athleteId)
        .gte('entry_date', from)
        .lte('entry_date', today)
        .order('entry_date')
        .order('id')
        .range(pageFrom, pageTo),
    ),

    fetchMyTestSummary(db, athleteId),
    fetchMyProgrammeSessions(db, athleteId),
    fetchFlagsList(db, orgId, []),
    fetchAthleteCompliancePct(db, orgId, athleteId, from, today, timezone),
  ]);

  const sessions = await fetchAthleteSessionsInWindow(db, orgId, athleteId, from, today, timezone, loadEntries);

  /* §0u: "logged" is a session with at least one live set, not a row that
   * exists — see lib/gymSessionCounts.ts. `completed` is unchanged. */
  const gymCounts = countGymSessions(
    gymRows,
    await fetchSessionLogIdsWithLiveSets(db, orgId, gymRows.flatMap((r) => (r.id ? [r.id] : []))),
  );

  const dates = dateRange(from, periodDays);
  /* Built over the lead-in AND the period, then sliced back to the period. The
   * band on day 1 of the window is therefore judged against the 14 days before
   * it, exactly as the page's own caption claims, and `wellness` still contains
   * precisely `dates` — the lead-in never renders and never reaches the CSV. */
  const wellness = wellnessSeries(
    wellnessEntries,
    dateRange(wellnessFrom, WELLNESS_ROLLING_WINDOW + periodDays),
    'readiness',
    WELLNESS_ROLLING_WINDOW,
  ).slice(-periodDays);

  // Two maps out of ONE read. The full-period map draws `byDay`; the 28-day
  // slice is what computeAcwr is contractually given ("`loadByDate` must
  // already be restricted to the trailing 28-day window", lib/acwr.ts). They
  // are the same rows filtered differently, so the load a coach reads off the
  // day list and the load inside the ratio can never disagree.
  const loadByDate = loadByDateFrom(loadEntries);
  const acwrLoadByDate = loadByDateFrom(loadEntries.filter((e) => e.entry_date !== null && e.entry_date >= acwrFrom));
  const { acute, chronic, acwr, suppressed, daysWithData } = computeAcwr(acwrLoadByDate, acuteFrom);

  const byDay: LoadDay[] = dates.map((d) => ({ date: d, load: loadByDate.get(d) ?? null }));

  const gps = {
    sessionsWithData: gpsRows.length,
    totalDistanceM: gpsRows.reduce((s, r) => s + (r.total_distance_m ?? 0), 0),
    highSpeedDistanceM: gpsRows.reduce((s, r) => s + (r.high_speed_distance_m ?? 0), 0),
    maxSpeedMs: gpsRows.reduce<number | null>((max, r) => (r.max_speed_ms !== null && (max === null || r.max_speed_ms > max) ? r.max_speed_ms : max), null),
  };

  const programmeByKey = new Map<string, { programme_id: string; name: string; type: string }>();
  for (const s of programmeSessions) {
    programmeByKey.set(s.programme_id, { programme_id: s.programme_id, name: s.programme_name, type: s.programme_type });
  }

  const openFlags = flags.filter((f) => f.athlete_id === athleteId);

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
      acwr,
      suppressed,
      daysWithData,
      byDay,
      gps,
    },
    gymAndTesting: {
      sessionsLogged: gymCounts.logged,
      sessionsCompleted: gymCounts.completed,
      tests: testSummary,
    },
  };
}

/* ---------------------------------------------------------------------------
 * The two reads that had to be rebuilt for a widened window
 * ------------------------------------------------------------------------ */

/** The domains this report counts, matching REPORT_DOMAINS in queries/reports.ts.
 *  `nutrition` is excluded here for the same reason it is excluded there and
 *  the same reason CLAUDE.md rule 8 gives: there is no daily nutrition entry
 *  and no nutrition compliance domain. */
const COMPLIANCE_DOMAINS: readonly ComplianceDomain[] = ['wellness', 'training_rpe', 'gym'];

/**
 * This ONE athlete's compliance percentage over the window.
 *
 * WHY IT IS NOT fetchComplianceReport ANY MORE. It used to be:
 * `fetchComplianceReport(db, orgId, [], from, today)` — the SQUAD-WIDE
 * report, every athlete, every domain, every day — of which this report then
 * used exactly one row (`byAthlete.find(a => a.athlete_id === athleteId)`).
 * Wasteful at 28 days and unusable past it: that function's expectation read
 * is athletes × days × domains, which for a 40-athlete squad is ~120 rows a
 * day and is over PostgREST's silent 1000-row ceiling before the ninth day.
 * Widening this screen to `season` would not have errored — it would have
 * returned a plausible percentage computed from whichever 1000 rows arrived,
 * and for an athlete sorted late in the truncated set, no row at all and a
 * bare "—". Scoping to the one athlete this page is about drops the row count
 * by the size of the squad AND makes the read paged and honest.
 *
 * The arithmetic is deliberately the same as fetchComplianceReport's: a
 * waived expectation is excluded from both numerator and denominator (it is
 * not a missed entry), and `is_required` is NOT filtered on, because in this
 * schema it is false exactly when `waived_reason` is set and filtering on it
 * silently drops every waived row before the waiver check can see it. Null
 * when there is nothing to divide by, which the page renders as "—".
 */
async function fetchAthleteCompliancePct(
  db: Db,
  orgId: string,
  athleteId: string,
  from: string,
  to: string,
  /* §0ad: an RPE counts only if submitted before the end of the following
     club-local day — the same rule, from the same function, as the squad
     compliance report (Builder Q5, 2026-09-12: two figures disagreeing about
     one athlete is worse than either being wrong). */
  timezone: string,
): Promise<number | null> {
  /* All four reads are paged and all four are one-athlete. Over the 730-day
   * cap the expectations read alone is 3 domains × 730 = ~2,190 rows, so this
   * crosses the ceiling on a real season even scoped this narrowly. Every
   * order ends in `id`. `expectation_date` and `entry_date` are `date`
   * columns compared as plain YYYY-MM-DD (rule 5: no dateInTz). */
  const [expectations, wellness, training, gym] = await Promise.all([
    fetchAllPaged((pageFrom, pageTo) =>
      db
        .from('compliance_expectations')
        .select('athlete_id, expectation_date, domain, session_id, waived_reason')
        .eq('org_id', orgId)
        .eq('athlete_id', athleteId)
        .gte('expectation_date', from)
        .lte('expectation_date', to)
        .neq('domain', 'nutrition')
        .order('expectation_date')
        .order('id')
        .range(pageFrom, pageTo),
    ),
    fetchAllPaged((pageFrom, pageTo) =>
      db
        .from('wellness_entries_current')
        .select('entry_date')
        .eq('org_id', orgId)
        .eq('athlete_id', athleteId)
        .gte('entry_date', from)
        .lte('entry_date', to)
        .order('entry_date')
        .order('id')
        .range(pageFrom, pageTo),
    ),
    /* The BASE TABLE, originals only — the athlete's own submission time is
     * what the cutoff judges, and a staff correction is a new row stamped
     * with the correction's moment. Same read, same reason, as
     * fetchComplianceReport's. */
    fetchAllPaged((pageFrom, pageTo) =>
      db
        .from('training_entries')
        .select('athlete_id, entry_date, session_id, submitted_at')
        .eq('org_id', orgId)
        .eq('athlete_id', athleteId)
        .is('revision_of', null)
        .gte('entry_date', from)
        .lte('entry_date', to)
        .order('entry_date')
        .order('id')
        .range(pageFrom, pageTo),
    ),
    // The view, for the same reason as above. This one feeds a Set of dates so
    // duplicate revisions of one session were harmless, but a revision that
    // moved a session OUT of 'complete' still left its superseded 'complete'
    // row matching here — the date stayed marked done.
    fetchAllPaged((pageFrom, pageTo) =>
      db
        .from('gym_session_logs_current')
        .select('entry_date')
        .eq('org_id', orgId)
        .eq('athlete_id', athleteId)
        .eq('status', 'complete')
        .gte('entry_date', from)
        .lte('entry_date', to)
        .order('entry_date')
        .order('id')
        .range(pageFrom, pageTo),
    ),
  ]);

  const rpeExpectations = expectations.filter((e) => e.domain === 'training_rpe');
  const rpe = classifyRpeSubmissions(
    rpeExpectations,
    training,
    await fetchRpeSessionWindows(
      db,
      rpeExpectations.map((e) => e.session_id).filter((id): id is string => id !== null),
    ),
    timezone,
  );

  const submitted: Record<ComplianceDomain, Set<string>> = {
    wellness: new Set(wellness.map((r) => r.entry_date).filter((d): d is string => d !== null)),
    // Keyed by the expectation (athlete and session), in time only —
    // lib/complianceRpe.ts, the squad report's own classifier.
    training_rpe: rpe.inTime,
    gym: new Set(gym.map((r) => r.entry_date).filter((d): d is string => d !== null)),
    nutrition: new Set(),
  };

  let expected = 0;
  let met = 0;
  for (const exp of expectations) {
    if (!COMPLIANCE_DOMAINS.includes(exp.domain)) continue;
    // Waived: excluded from both sides, not counted as a miss. Same branch
    // fetchComplianceReport takes, for the same reason.
    if (exp.waived_reason !== null) continue;
    expected += 1;
    const key = exp.domain === 'training_rpe' ? rpeExpectationKey(exp) : exp.expectation_date;
    if (submitted[exp.domain].has(key)) met += 1;
  }

  return expected > 0 ? Math.round((100 * met) / expected) : null;
}

const SESSION_COLUMNS =
  'id, title, session_type, starts_at, duration_min, location, md_offset, planned_rpe, status, fixture_id, updated_at';

/**
 * The sessions this athlete was scheduled for inside the window.
 *
 * WHY NOT fetchAthleteRecentSessions. That function (queries/schedule.ts) is
 * built for a short trailing view and does two things this report cannot
 * survive at a widened window:
 *
 *  1. It takes a `limit` (this report passed 200) and SLICES after fetching,
 *     so at a year the footer count was capped at 200 regardless of reality —
 *     a wrong number with nothing to notice it by.
 *  2. It fans out org-wide: every session in the window, then
 *     `session_participants.in('session_id', <every one of those ids>)`. Over
 *     a season that is thousands of UUIDs in a query string — past both
 *     PostgREST's 1000-row ceiling and a sane URL length — and it is a hot
 *     path for `/my-data` and the Schedule screen, so it is not changed
 *     underneath them from here.
 *
 * This version inverts the fan-out: resolve THIS athlete's participation
 * first (their own rows plus their groups'), then page the window's sessions
 * and keep the ones that match. No `.in()` over a large id list, no limit,
 * and every read paged.
 *
 * `sessions.starts_at` is `timestamptz` — an INSTANT, not a calendar date —
 * so the window goes through `rangeBounds(from, to, timezone)` (local
 * midnight to local next-midnight-minus-1ms), never `${date}T00:00:00Z`.
 * `training_entries_current.entry_date` beside it is `date`-typed and is
 * compared as a plain string. Both halves of CLAUDE.md rule 5, in one
 * function, on purpose.
 */
async function fetchAthleteSessionsInWindow(
  db: Db,
  orgId: string,
  athleteId: string,
  from: string,
  to: string,
  timezone: string,
  entries: readonly { session_id: string | null; rpe: number | null; session_load: number | null }[],
): Promise<RecentSession[]> {
  const bounds = rangeBounds(from, to, timezone);

  const memberships = await fetchAllPaged((pageFrom, pageTo) =>
    db
      .from('group_memberships')
      .select('group_id')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .is('removed_at', null)
      .order('id')
      .range(pageFrom, pageTo),
  );
  const myGroups = [...new Set(memberships.map((m) => m.group_id))];

  /* Participation rows have no date column of their own, so this is bounded
   * by the athlete's own history rather than by the window — which is fine
   * (one athlete, a few hundred a season) and paged so it stays fine. The
   * `.or()` is built conditionally: PostgREST rejects an empty `in.()` list,
   * so an athlete in no group gets the plain equality filter instead. */
  const participations = await fetchAllPaged((pageFrom, pageTo) => {
    // Built fresh inside the callback, never hoisted: a PostgREST builder is
    // stateful, and reusing one across .range() calls accumulates filters.
    const base = db.from('session_participants').select('session_id').eq('org_id', orgId);
    const scoped =
      myGroups.length > 0
        ? base.or(`athlete_id.eq.${athleteId},group_id.in.(${myGroups.join(',')})`)
        : base.eq('athlete_id', athleteId);
    return scoped.order('session_id').order('id').range(pageFrom, pageTo);
  });
  const mine = new Set(participations.map((p) => p.session_id));
  if (mine.size === 0) return [];

  // Paged org-wide read, filtered to `mine` in memory. Ordered
  // `starts_at, id`: descending would be the reader's order, but a paged
  // read must sort ascending-stable and be reversed after, and the tie-break
  // matters — two sessions can start at the same instant.
  const sessions = await fetchAllPaged<Session>((pageFrom, pageTo) =>
    db
      .from('sessions')
      .select(SESSION_COLUMNS)
      .eq('org_id', orgId)
      .gte('starts_at', bounds.from)
      .lte('starts_at', bounds.to)
      .is('deleted_at', null)
      .order('starts_at')
      .order('id')
      .range(pageFrom, pageTo),
  );

  const attendance = await fetchAllPaged((pageFrom, pageTo) =>
    db
      .from('session_attendance')
      .select('session_id, attendance')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .order('session_id')
      .order('id')
      .range(pageFrom, pageTo),
  );

  const entryBySession = new Map(
    entries.filter((e) => e.session_id !== null).map((e) => [e.session_id as string, e]),
  );
  const attendanceBySession = new Map(attendance.map((a) => [a.session_id, a.attendance]));

  // Most-recent-first, the same convention fetchAthleteRecentSessions uses
  // and the same one the page's footer reads (index 0 is the latest).
  return sessions
    .filter((s) => mine.has(s.id))
    .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    .map((s) => ({
      ...s,
      rpe: entryBySession.get(s.id)?.rpe ?? null,
      session_load: entryBySession.get(s.id)?.session_load ?? null,
      attendance: attendanceBySession.get(s.id) ?? null,
    }));
}

/** The earliest date this athlete has any entry on, for the period control's
 *  "All on record". Athlete-scoped rather than org-scoped
 *  (analytics.ts's fetchEarliestEntryDate reads the whole org): on a
 *  one-athlete report "all on record" means all of THIS athlete's record, and
 *  anchoring it on the club's first-ever entry would open the window years
 *  before a new signing has any data in it.
 *
 *  Both source views are checked because either can be the earlier one — an
 *  athlete who logged wellness for a month before their first RPE entry has
 *  their real start in `wellness_entries_current`. Two `.limit(1)` ordered
 *  reads, not a scan. */
export async function fetchEarliestAthleteEntryDate(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<string | null> {
  const [wellness, training] = await Promise.all([
    db
      .from('wellness_entries_current')
      .select('entry_date')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .not('entry_date', 'is', null)
      .order('entry_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
    db
      .from('training_entries_current')
      .select('entry_date')
      .eq('org_id', orgId)
      .eq('athlete_id', athleteId)
      .not('entry_date', 'is', null)
      .order('entry_date', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (wellness.error) throw new Error(wellness.error.message);
  if (training.error) throw new Error(training.error.message);

  const dates = [wellness.data?.entry_date ?? null, training.data?.entry_date ?? null].filter(
    (d): d is string => d !== null,
  );
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a < b ? a : b));
}
