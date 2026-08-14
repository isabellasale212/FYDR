import type { AppRole, ComplianceDomain, Json } from '@/lib/types/database';
import { fetchGroupAthleteIds, type Db } from './groups';
import { fetchNotFullyAvailable, type NotFullyAvailableRow } from './availability';

/* screens/reports.md, cut down hard, then entirely un-cut as the schema
 * caught up. Five report types are specified; this file builds the first two
 * — Compliance and Injury & availability — because every table they read
 * already existed and was already populated by other screens this build
 * shipped. The other three (Athlete report, Squad weekly, Testing) were cut
 * for the same reason at first — all three needed gps_records and/or
 * test_definitions/test_results, neither of which existed yet — and are now
 * built too, in athleteReport.ts, squadWeeklyReport.ts and
 * testingReport.ts, once both arrived (migrations 0023 through 0026). All
 * five of the spec's report types are real as of this pass.
 *
 * CSV export exists (one export/route.ts per report, under this build's
 * reports pages) — no PDF and no XLSX, and no scheduled delivery, no
 * report_schedules table, no report_runs
 * status/expiry machinery. A report here is a live, in-app page, recomputed on
 * open — the same "answers the same question every time" promise the spec
 * asks for, just without the PDF/XLSX formats or the schedule it can
 * currently only describe as a "formatted, shareable, scheduled document".
 * Every report open, and every export, writes an
 * audit_log row, because "a report is a data disclosure that leaves the
 * system" is a real rule this pass keeps in full.
 *
 * No materialised views (mv_compliance_rates, mv_daily_athlete_summary, and so
 * on, referenced throughout the spec's own SQL) exist in this schema — nothing
 * in this build has created them, the same discovery analytics.ts made earlier
 * this session. Both reports below compute live from the base tables instead,
 * the same choice analytics.ts made, not a materialised-view shortcut.
 *
 * "Days lost" and "availability %" on the injury report are computed from
 * injuries.onset_date/actual_return overlapping the period, not from a
 * day-by-day reconstruction of the availability event log. That is a real
 * simplification: the event log is the more precise source (an injury can span
 * a status change mid-recovery) and a fuller pass would replay it day by day.
 * This pass reads the injury's own span, which is right in the overwhelming
 * majority of cases and wrong only where availability changed for a reason
 * unrelated to the injury bookending it. */

export type ComplianceDomainSummary = {
  domain: ComplianceDomain;
  expected: number;
  submitted: number;
  waived: number;
  pct: number | null;
};

export type ComplianceAthleteRow = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  perDomain: Record<string, { expected: number; submitted: number }>;
  lastSubmission: string | null;
  /** Expectations excluded from perDomain because they were waived (medical/
   *  coach reason, e.g. injured all week) — tracked separately so a fully
   *  waived athlete (expected: 0 everywhere) is never indistinguishable from
   *  a genuinely 100%-compliant one, and never buried at the bottom of a
   *  "worst first" chase list below athletes who are actually missing
   *  entries (audit analysis findings 14/19). */
  waivedCount: number;
};

/** One row per calendar day per domain, squad-wide — a rollup, not the full
 *  athlete-by-day grid screens/reports.md's own mock shows. A per-athlete grid
 *  is athletes × days cells; this pass renders the smaller, still genuinely
 *  useful squad-level version and documents the fuller grid as cut. */
export type ComplianceDayCell = { date: string; domain: ComplianceDomain; expected: number; submitted: number; waived: number };

export type ComplianceReport = {
  summary: ComplianceDomainSummary[];
  byAthlete: ComplianceAthleteRow[];
  byDay: ComplianceDayCell[];
  athleteCount: number;
  fromDate: string;
  toDate: string;
};

const REPORT_DOMAINS: ComplianceDomain[] = ['wellness', 'training_rpe', 'gym'];

/** The most recent day this org has a real compliance_expectations row for,
 *  in scope. Used to default the report's window sensibly instead of a
 *  rolling "last N days ending real today" that lands on empty real-clock
 *  days when the seed data's own "today" lags behind it — the report
 *  read "0 of 0" across the board with no way to tell that from an
 *  org with nobody training (audit analysis finding 14). Null only for an
 *  org with no compliance history at all. */
export async function fetchLatestComplianceExpectationDate(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
): Promise<string | null> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);
  let query = db.from('compliance_expectations').select('expectation_date').eq('org_id', orgId);
  if (scope) query = query.in('athlete_id', scope);
  const { data, error } = await query.order('expectation_date', { ascending: false }).limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.expectation_date ?? null;
}

export async function fetchComplianceReport(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  fromDate: string,
  toDate: string,
): Promise<ComplianceReport> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let athleteQuery = db
    .from('athletes')
    .select('id, first_name, last_name')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .neq('status', 'left_club');
  if (scope) athleteQuery = athleteQuery.in('id', scope);

  const { data: athletes, error: athleteErr } = await athleteQuery.order('last_name');
  if (athleteErr) throw new Error(athleteErr.message);
  const athleteIds = (athletes ?? []).map((a) => a.id);

  if (athleteIds.length === 0) {
    return { summary: [], byAthlete: [], byDay: [], athleteCount: 0, fromDate, toDate };
  }

  const { data: expectations, error: expErr } = await db
    .from('compliance_expectations')
    .select('athlete_id, expectation_date, domain, is_required, waived_reason')
    .eq('org_id', orgId)
    .in('athlete_id', athleteIds)
    .gte('expectation_date', fromDate)
    .lte('expectation_date', toDate)
    .neq('domain', 'nutrition');
  if (expErr) throw new Error(expErr.message);

  // NOT filtered to is_required here. That used to happen — const required =
  // expectations.filter(e => e.is_required) — and it was a real, pre-existing
  // bug: in this schema is_required is false if and only if waived_reason is
  // set (verified live: zero rows disagree), so that filter silently dropped
  // every waived expectation before the loop below ever got to look at it.
  // The loop's own `waived` branch already does the right thing with a waived
  // row (excluded from expected/submitted, counted separately) — it just
  // never ran. Concretely: the compliance summary's "N waived" text, the
  // by-day "waived" counts, and every waived athlete's badge below were all
  // silently always zero regardless of real data (audit analysis finding 19
  // — "hides the waiver distinction it brags about" was literal). Iterating
  // every expectation and trusting the loop's own waived check is the fix.
  const required = expectations ?? [];

  const [wellness, training, gym] = await Promise.all([
    db
      .from('wellness_entries_current')
      .select('athlete_id, entry_date')
      .in('athlete_id', athleteIds)
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate),
    db
      .from('training_entries_current')
      .select('athlete_id, entry_date')
      .in('athlete_id', athleteIds)
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate),
    db
      .from('gym_session_logs')
      .select('athlete_id, entry_date')
      .in('athlete_id', athleteIds)
      .gte('entry_date', fromDate)
      .lte('entry_date', toDate)
      .eq('status', 'complete'),
  ]);
  if (wellness.error) throw new Error(wellness.error.message);
  if (training.error) throw new Error(training.error.message);
  if (gym.error) throw new Error(gym.error.message);

  const submittedKey = (athleteId: string | null, date: string | null) => `${athleteId}:${date}`;
  // wellness_entries_current / training_entries_current type every column as
  // nullable (a view-typing quirk noted elsewhere in this build, e.g.
  // analytics.ts) even though a real row is never missing one — submittedKey
  // accepts the nullable shape directly rather than asserting it away.
  const submittedByDomain: Record<ComplianceDomain, Set<string>> = {
    wellness: new Set((wellness.data ?? []).map((r) => submittedKey(r.athlete_id, r.entry_date))),
    training_rpe: new Set((training.data ?? []).map((r) => submittedKey(r.athlete_id, r.entry_date))),
    gym: new Set((gym.data ?? []).map((r) => submittedKey(r.athlete_id, r.entry_date))),
    nutrition: new Set(),
  };

  const summaryByDomain = new Map<ComplianceDomain, { expected: number; submitted: number; waived: number }>();
  for (const d of REPORT_DOMAINS) summaryByDomain.set(d, { expected: 0, submitted: 0, waived: 0 });

  const perAthlete = new Map<string, ComplianceAthleteRow>();
  for (const a of athletes ?? []) {
    perAthlete.set(a.id, { athlete_id: a.id, first_name: a.first_name, last_name: a.last_name, perDomain: {}, lastSubmission: null, waivedCount: 0 });
  }

  const dayByKey = new Map<string, ComplianceDayCell>();

  for (const exp of required) {
    const domain = exp.domain;
    if (domain === 'nutrition') continue;
    const bucket = summaryByDomain.get(domain);
    if (!bucket) continue;

    const waived = exp.waived_reason !== null;
    const submitted = submittedByDomain[domain].has(submittedKey(exp.athlete_id, exp.expectation_date));

    if (waived) {
      bucket.waived += 1;
    } else {
      bucket.expected += 1;
      if (submitted) bucket.submitted += 1;
    }

    const athleteRow = perAthlete.get(exp.athlete_id);
    if (athleteRow) {
      if (waived) {
        athleteRow.waivedCount += 1;
      } else {
        const cur = athleteRow.perDomain[domain] ?? { expected: 0, submitted: 0 };
        cur.expected += 1;
        if (submitted) cur.submitted += 1;
        athleteRow.perDomain[domain] = cur;
      }
      if (submitted && (!athleteRow.lastSubmission || exp.expectation_date > athleteRow.lastSubmission)) {
        athleteRow.lastSubmission = exp.expectation_date;
      }
    }

    const dayKey = `${exp.expectation_date}:${domain}`;
    const dayCell = dayByKey.get(dayKey) ?? { date: exp.expectation_date, domain, expected: 0, submitted: 0, waived: 0 };
    if (waived) dayCell.waived += 1;
    else {
      dayCell.expected += 1;
      if (submitted) dayCell.submitted += 1;
    }
    dayByKey.set(dayKey, dayCell);
  }

  const summary: ComplianceDomainSummary[] = REPORT_DOMAINS.map((domain) => {
    const b = summaryByDomain.get(domain)!;
    return { domain, expected: b.expected, submitted: b.submitted, waived: b.waived, pct: b.expected > 0 ? Math.round((100 * b.submitted) / b.expected) : null };
  });

  // "Worst first" for the athletes who can actually be chased: real
  // low-compliance rows always outrank a fully waived one, which used to
  // read as a perfect 100% (totalPct's own zero-expected fallback) and sort
  // to the very bottom next to genuinely compliant athletes — audit finding
  // 19's "injured non-submitters sort below 100% athletes with no waiver
  // marker". A fully waived row (nothing left to chase) sorts after every
  // row that still has a real percentage, worst-waived-first among ties.
  const byAthlete = [...perAthlete.values()].sort((a, b) => {
    const chaseableA = totalExpected(a) > 0;
    const chaseableB = totalExpected(b) > 0;
    if (chaseableA !== chaseableB) return chaseableA ? -1 : 1;
    if (!chaseableA) return b.waivedCount - a.waivedCount;
    return totalPct(a) - totalPct(b);
  });

  const byDay = [...dayByKey.values()].sort((a, b) => a.date.localeCompare(b.date) || a.domain.localeCompare(b.domain));

  return { summary, byAthlete, byDay, athleteCount: athleteIds.length, fromDate, toDate };
}

function totalExpected(row: ComplianceAthleteRow): number {
  let expected = 0;
  for (const v of Object.values(row.perDomain)) expected += v.expected;
  return expected;
}

function totalPct(row: ComplianceAthleteRow): number {
  let expected = 0;
  let submitted = 0;
  for (const v of Object.values(row.perDomain)) {
    expected += v.expected;
    submitted += v.submitted;
  }
  return expected > 0 ? (100 * submitted) / expected : 100;
}

/** The athlete-row percentage the page renders — null when there's nothing
 *  left to chase (either no expectations at all, or every one was waived),
 *  distinguished from each other by waivedCount so the UI never shows a
 *  fully waived athlete as a bare, ambiguous "—". */
export function complianceAthletePct(row: ComplianceAthleteRow): number | null {
  return totalExpected(row) > 0 ? Math.round(totalPct(row)) : null;
}

/* ---------------------------------------------------------------------------
 * Injury and availability report
 * ------------------------------------------------------------------------- */

export type InjuryReportSummary = {
  newInjuries: number;
  daysLost: number;
  availabilityPct: number | null;
  athleteCount: number;
};

export type InjuryBurdenWeek = { weekStart: string; daysLost: number };

export type ClinicalBreakdown = { bodyArea: string; count: number };

export type InjuryAvailabilityReport = {
  current: NotFullyAvailableRow[];
  summary: InjuryReportSummary;
  burden: InjuryBurdenWeek[];
  clinical: { byBodyAreaOfNewInjuries: ClinicalBreakdown[] } | null;
};

function daysOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): number {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (endMs < startMs) return 0;
  return Math.round((endMs - startMs) / 86_400_000) + 1;
}

function mondayOfIso(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function fetchInjuryAvailabilityReport(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  fromDate: string,
  toDate: string,
  isMedical: boolean,
): Promise<InjuryAvailabilityReport> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  const [current, athletesRes] = await Promise.all([
    fetchNotFullyAvailable(db, orgId, groupIds),
    (async () => {
      let q = db.from('athletes').select('id').eq('org_id', orgId).is('deleted_at', null).neq('status', 'left_club');
      if (scope) q = q.in('id', scope);
      return q;
    })(),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  const athleteIds = (athletesRes.data ?? []).map((a) => a.id);

  let injuriesQuery = db
    .from('injuries')
    .select('id, athlete_id, body_area, onset_date, actual_return, status')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .lte('onset_date', toDate);
  if (athleteIds.length > 0) injuriesQuery = injuriesQuery.in('athlete_id', athleteIds);

  const { data: injuries, error: injErr } = await injuriesQuery;
  if (injErr) throw new Error(injErr.message);

  // An injury with no actual_return yet is still open — "as of today" for
  // this report's purposes. Every real caller already passes the org's own
  // local today as `toDate` (todayIso(timezone)), so that's reused here
  // rather than re-deriving a second, server-UTC-clock "today" of our own
  // (`new Date().toISOString().slice(0, 10)`, which reads the wrong day for
  // part of every day the org is ahead of UTC — same bug class as
  // schedule.ts's own dayBounds()/rangeBounds()).
  const relevant = (injuries ?? []).filter((i) => {
    const end = i.actual_return ?? toDate;
    return end >= fromDate;
  });

  const newInjuries = relevant.filter((i) => i.onset_date >= fromDate && i.onset_date <= toDate).length;

  let daysLost = 0;
  const weekTotals = new Map<string, number>();
  for (const i of relevant) {
    const end = i.actual_return ?? toDate;
    const overlap = daysOverlap(i.onset_date, end, fromDate, toDate);
    daysLost += overlap;

    // Attribute overlap days to weeks within the period, one day at a time —
    // the population here is small (a club's injury list over a report
    // period), so a per-day loop is simpler than a set-based week split and
    // costs nothing measurable at this scale.
    let cursor = i.onset_date > fromDate ? i.onset_date : fromDate;
    const cursorEnd = end < toDate ? end : toDate;
    while (cursor <= cursorEnd) {
      const week = mondayOfIso(cursor);
      weekTotals.set(week, (weekTotals.get(week) ?? 0) + 1);
      const next = new Date(`${cursor}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      cursor = next.toISOString().slice(0, 10);
    }
  }

  const periodDays = daysOverlap(fromDate, toDate, fromDate, toDate);
  const athleteDays = athleteIds.length * periodDays;
  const availabilityPct = athleteDays > 0 ? Math.round((100 * (athleteDays - daysLost)) / athleteDays) : null;

  const burden = [...weekTotals.entries()]
    .map(([weekStart, days]) => ({ weekStart, daysLost: days }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  let clinical: InjuryAvailabilityReport['clinical'] = null;
  if (isMedical) {
    const counts = new Map<string, number>();
    for (const i of relevant) {
      if (i.onset_date < fromDate || i.onset_date > toDate) continue;
      counts.set(i.body_area, (counts.get(i.body_area) ?? 0) + 1);
    }
    clinical = {
      byBodyAreaOfNewInjuries: [...counts.entries()]
        .map(([bodyArea, count]) => ({ bodyArea, count }))
        .sort((a, b) => b.count - a.count),
    };
  }

  return {
    current,
    summary: { newInjuries, daysLost, availabilityPct, athleteCount: athleteIds.length },
    burden,
    clinical,
  };
}

/** screens/reports.md: "Every report run writes to audit_log... a report is a
 *  data disclosure that leaves the system." No report_runs table in this pass
 *  (see this file's header), so the audit event is the whole of what tracks a
 *  view — no file, no schedule, no run id, just the fact that someone opened
 *  a named report over a stated scope and when. */
export async function recordReportView(
  db: Db,
  orgId: string,
  userId: string,
  actorRole: AppRole,
  reportType: string,
  metadata: Json,
  action: 'view' | 'export' = 'view',
): Promise<void> {
  await db.from('audit_log').insert({
    org_id: orgId,
    actor_id: userId,
    actor_role: actorRole,
    action: `report.${reportType}.${action}`,
    entity_type: 'report',
    entity_id: null,
    metadata,
  });
}
