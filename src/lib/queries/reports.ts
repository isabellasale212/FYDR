import type { AppRole, ComplianceDomain, Json } from '@/lib/types/database';
import { fetchGroupAthleteIds, type Db } from './groups';
import { fetchAllPaged } from './paged';
import {
  classifyRpeSubmissions,
  rpeExpectationKey,
  type RpeSessionWindow,
  type RpeSubmission,
} from '@/lib/complianceRpe';
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

/** The narrow shapes fetchComplianceReport reads. Declared rather than
 *  inferred because fetchAllPaged is generic over its row type — same reason
 *  analytics.ts declares AcwrEntryRow. `id` is not selected: it is only needed
 *  as the paging tiebreak in the ORDER BY, and PostgREST will order by a column
 *  the projection does not return. */
type ComplianceExpectationRow = {
  athlete_id: string;
  expectation_date: string;
  domain: ComplianceDomain;
  session_id: string | null;
  is_required: boolean;
  waived_reason: string | null;
};

/** Every column nullable because a `_current` view types them that way
 *  regardless of the base table's constraints (the same view-typing quirk
 *  analytics.ts documents). gym_session_logs is a base table and is narrower
 *  than this, but the three are consumed identically and one shape keeps the
 *  three paged reads symmetrical. */
type SubmissionRow = { athlete_id: string | null; entry_date: string | null };

/** How many session ids go in one `in` — the same 200 gymSessionCounts uses,
 *  well inside what a URL holds. */
const SESSION_ID_CHUNK = 200;

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

/** The other end of the same lookup: the FIRST day this org has a compliance
 *  expectation for, which is what `?period=all` resolves its window against.
 *
 *  Org-wide, not group-scoped, on purpose — an org-wide earliest date is never
 *  later than a group-scoped one, so the window it produces can only be wider,
 *  and over-showing is visible where under-showing is silent. Same "never
 *  narrower" rule periodFromLegacyDays applies in lib/period.ts.
 *
 *  Null for an org with no compliance history at all; resolveRange then
 *  degrades `all` to the MAX_WINDOW_DAYS floor rather than inventing a start
 *  date. Called only when the resolved key IS `all`. */
export async function fetchEarliestComplianceExpectationDate(db: Db, orgId: string): Promise<string | null> {
  const { data, error } = await db
    .from('compliance_expectations')
    .select('expectation_date')
    .eq('org_id', orgId)
    .order('expectation_date', { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.expectation_date ?? null;
}

export async function fetchComplianceReport(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  fromDate: string,
  toDate: string,
  /* The org's timezone: an RPE counts only if submitted before the end of the
     following club-local day (§0ad; lib/rpeDue.ts), and "following day" is a
     club-time fact. */
  timezone: string,
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

  /* PAGED, AND THE ONE MOST EXPOSED OF THE FOUR.
   *
   * This window used to be a fixed 7, 14 or 28 days from a hard-coded
   * allow-list; it is now a PeriodSelector offering week, month, season, year
   * and all. The row count is athletes × days × domains — a 40-athlete squad
   * with three domains is 120 rows a day, which is over PostgREST's silent
   * 1000-row ceiling (max_rows, supabase/config.toml) before the NINTH day and
   * is ~44,000 rows over a season. PostgREST does not error at the ceiling: it
   * returns exactly 1000 rows that look like a complete answer, and every
   * denominator on this report would quietly shrink to whatever fitted.
   *
   * The order ends in `id` because `.range()` re-runs the query per page and a
   * tie broken differently between pages duplicates or drops a row — which,
   * for counters that are summed, is a wrong percentage with nothing to notice
   * it by. */
  const expectations = await fetchAllPaged<ComplianceExpectationRow>((pageFrom, pageTo) =>
    db
      .from('compliance_expectations')
      .select('athlete_id, expectation_date, domain, session_id, is_required, waived_reason')
      .eq('org_id', orgId)
      .in('athlete_id', athleteIds)
      // expectation_date is a `date` column: fromDate/toDate are compared as
      // plain YYYY-MM-DD strings, never pushed through dateInTz (rule 5).
      .gte('expectation_date', fromDate)
      .lte('expectation_date', toDate)
      .neq('domain', 'nutrition')
      .order('expectation_date')
      .order('id')
      .range(pageFrom, pageTo),
  );

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
  const required = expectations;

  /* The three submission reads scale with the window exactly as the
   * expectations read does — one row per athlete per day each — so all three
   * page too. They are the numerator: truncating them without truncating the
   * denominator does not just lose rows, it invents non-compliance. */
  const [wellness, training, gym] = await Promise.all([
    fetchAllPaged<SubmissionRow>((pageFrom, pageTo) =>
      db
        .from('wellness_entries_current')
        .select('athlete_id, entry_date')
        .in('athlete_id', athleteIds)
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date')
        .order('id')
        .range(pageFrom, pageTo),
    ),
    /* THE BASE TABLE, ORIGINALS ONLY — not the _current view the other two
     * read, and for a reason the other two do not have. §0ad (decided
     * 2026-09-12): an RPE counts only if it was submitted before the end of
     * the following club-local day, so the row's submitted_at is now judged.
     * A staff correction (revise_training_entry) inserts a NEW row with
     * submitted_at = now() and the _current view shows that one — reading it
     * would turn an on-time rating corrected a week later into a miss. The
     * original row (revision_of null) is never deleted and carries the
     * athlete's own submission time; that is the row that answers "was it
     * rated in time". Whether the chain was later corrected is a different
     * question, and not compliance's. */
    fetchAllPaged<RpeSubmission>((pageFrom, pageTo) =>
      db
        .from('training_entries')
        .select('athlete_id, entry_date, session_id, submitted_at')
        .in('athlete_id', athleteIds)
        .is('revision_of', null)
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .order('entry_date')
        .order('id')
        .range(pageFrom, pageTo),
    ),
    // The _current view, per 0045:239 — a session corrected through
    // revise_gym_session_log leaves its superseded row behind on the base
    // table, and compliance counts must not see both.
    fetchAllPaged<SubmissionRow>((pageFrom, pageTo) =>
      db
        .from('gym_session_logs_current')
        .select('athlete_id, entry_date')
        .in('athlete_id', athleteIds)
        .gte('entry_date', fromDate)
        .lte('entry_date', toDate)
        .eq('status', 'complete')
        .order('entry_date')
        .order('id')
        .range(pageFrom, pageTo),
    ),
  ]);

  /* The sessions the RPE expectations name, for their windows. Every
   * training_rpe expectation carries a session (0044 generates them from the
   * day's sessions); read in chunks because a season's worth of ids is too
   * many for one `in`. Soft-deleted sessions are read too: a session removed
   * after its expectation was generated still had a window. */
  const rpeSessionIds = Array.from(
    new Set(required.filter((e) => e.domain === 'training_rpe' && e.session_id).map((e) => e.session_id as string)),
  );
  const sessionWindows: RpeSessionWindow[] = [];
  for (let i = 0; i < rpeSessionIds.length; i += SESSION_ID_CHUNK) {
    const chunk = rpeSessionIds.slice(i, i + SESSION_ID_CHUNK);
    const { data, error } = await db.from('sessions').select('id, starts_at, duration_min').in('id', chunk);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) sessionWindows.push(row);
  }
  const rpe = classifyRpeSubmissions(
    required.filter((e) => e.domain === 'training_rpe'),
    training,
    sessionWindows,
    timezone,
  );

  const submittedKey = (athleteId: string | null, date: string | null) => `${athleteId}:${date}`;
  // wellness_entries_current / gym_session_logs_current type every column as
  // nullable (a view-typing quirk noted elsewhere in this build, e.g.
  // analytics.ts) even though a real row is never missing one — submittedKey
  // accepts the nullable shape directly rather than asserting it away.
  // training_rpe is keyed by the SESSION and judged against its window
  // (lib/complianceRpe.ts); its key is the expectation's own.
  const submittedByDomain: Record<ComplianceDomain, Set<string>> = {
    wellness: new Set(wellness.map((r) => submittedKey(r.athlete_id, r.entry_date))),
    training_rpe: rpe.inTime,
    gym: new Set(gym.map((r) => submittedKey(r.athlete_id, r.entry_date))),
    nutrition: new Set(),
  };
  const keyFor = (exp: ComplianceExpectationRow): string =>
    exp.domain === 'training_rpe' ? rpeExpectationKey(exp) : submittedKey(exp.athlete_id, exp.expectation_date);

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
    const submitted = submittedByDomain[domain].has(keyFor(exp));
    /* "Last entry" is when the athlete last entered anything, in time or not:
       a rating made late is a miss for the count and still an entry for the
       column — "3 weeks ago" beside a rating they made yesterday would be
       false. */
    const entered = domain === 'training_rpe' ? rpe.any.has(keyFor(exp)) : submitted;

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
      if (entered && (!athleteRow.lastSubmission || exp.expectation_date > athleteRow.lastSubmission)) {
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

export type InjuryBurdenWeek = {
  weekStart: string;
  daysLost: number;
  /** True only when all seven of the week's days fall inside the period. A
   *  part week is short BY CONSTRUCTION, not because the squad got healthier,
   *  and the mean-per-week figure excludes it for the same reason. */
  fullWeek: boolean;
  /** How many of the week's days the period actually covers, so a short row
   *  can say why rather than looking like an improvement. */
  daysInPeriod: number;
};

/** Days lost grouped by where they went. Split by INJURY SITE, not by cause:
 *  `injuries` records a body area, and cause (injury vs illness vs academic)
 *  lives on availability rows over a different population. Naming this
 *  "by site" rather than "by cause" keeps the label true to the column it is
 *  actually counting. */
export type InjuryDaysBySite = { bodyArea: string; days: number };

/** Where the squad is thin if it happens again. */
export type InjuryDaysByUnit = { unit: string; days: number };

/** Who the days belong to — the athletes carrying the burden, worst first. */
export type InjuryDaysByAthlete = { athlete_id: string; name: string; bodyArea: string | null; days: number };

export type ClinicalBreakdown = { bodyArea: string; count: number };

export type InjuryAvailabilityReport = {
  current: NotFullyAvailableRow[];
  summary: InjuryReportSummary;
  burden: InjuryBurdenWeek[];
  bySite: InjuryDaysBySite[];
  byUnit: InjuryDaysByUnit[];
  byAthlete: InjuryDaysByAthlete[];
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

/** Six days on from a Monday, in the same UTC-noon-free arithmetic
 *  mondayOfIso uses — these are plain calendar strings, never instants. */
function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The earliest onset date this org has an injury for, for the period
 *  control's "All on record". One row, ordered — not a scan.
 *
 *  Deliberately the INJURY table's own earliest date, not
 *  analytics.ts's fetchEarliestEntryDate (which reads the training or
 *  wellness view): "all on record" on THIS report means every injury the
 *  club has recorded, and anchoring it on a wellness entry would start the
 *  window somewhere unrelated to what the report counts.
 *
 *  `onset_date` is a `date` column, so it is compared and returned as a
 *  plain YYYY-MM-DD string — CLAUDE.md rule 5's other half: nothing here
 *  goes near dateInTz. */
export async function fetchEarliestInjuryOnset(db: Db, orgId: string): Promise<string | null> {
  const { data, error } = await db
    .from('injuries')
    .select('onset_date')
    .eq('org_id', orgId)
    .is('deleted_at', null)
    .order('onset_date', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.onset_date ?? null;
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

  /* `current` is deliberately NOT date-bounded and must never become so.
   * fetchNotFullyAvailable answers "who cannot train RIGHT NOW", from the
   * live availability row and the open-injury list, with no window at all —
   * which is why widening this screen's period control cannot make an
   * unavailable athlete disappear from the Current tab. An athlete whose
   * injury started before `fromDate` is still unavailable today and still
   * appears; only the PERIOD SUMMARY and BURDEN figures below are windowed,
   * and both say so in their own captions. (The PDF's Current section
   * carries the same sentence for the same reason.) */
  const [current, athletes] = await Promise.all([
    fetchNotFullyAvailable(db, orgId, groupIds),
    /* Paged: one row per live athlete in the org, bounded only by the club's
     * own size, and this list is the denominator of availability % — a short
     * read would silently understate athlete-days and overstate
     * availability. Ordered by `id` alone because nothing here wants any
     * other order and `id` is the unique key .range() needs (paged.ts). */
    fetchAllPaged((from, to) => {
      // `position` and the name join the select purely so days lost can be
      // grouped by unit and attributed to a named athlete below — both are
      // already coach-visible squad fields, not medical ones.
      let q = db
        .from('athletes')
        .select('id, first_name, last_name, position')
        .eq('org_id', orgId)
        .is('deleted_at', null)
        .neq('status', 'left_club');
      if (scope) q = q.in('id', scope);
      return q.order('id').range(from, to);
    }),
  ]);
  const athleteIds = athletes.map((a) => a.id);

  /* PAGED, and it was over the ceiling before the period control ever
   * widened: this read has no lower date bound by construction (an injury
   * that started two seasons ago and is still open is still relevant), so it
   * accumulates with the club's whole injury history and a 1000-row
   * PostgREST cap would have silently dropped the OLDEST-onset injuries —
   * exactly the long-running ones that dominate athlete-days lost.
   *
   * The `.or()` is the same predicate the `relevant` filter below applies in
   * JS, pushed into the database so the window actually bounds the read:
   * an injury is relevant when its end (actual_return, or "still open") is
   * on or after fromDate, and a null actual_return always qualifies because
   * its notional end is toDate, which is never before fromDate. It narrows
   * the fetch without changing the answer; the JS filter stays as the single
   * statement of the rule.
   *
   * Total order ends in `id`: `onset_date` alone ties constantly (a squad
   * session that injures two players writes two rows with the same date),
   * and a tie broken differently on two pages double-counts or drops an
   * injury — which for a SUMMED figure like days lost is a wrong number with
   * no error and no short page to notice. */
  const injuries = await fetchAllPaged((from, to) => {
    let q = db
      .from('injuries')
      .select('id, athlete_id, body_area, onset_date, actual_return, status')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .lte('onset_date', toDate)
      .or(`actual_return.is.null,actual_return.gte.${fromDate}`);
    if (athleteIds.length > 0) q = q.in('athlete_id', athleteIds);
    return q.order('onset_date').order('id').range(from, to);
  });

  // An injury with no actual_return yet is still open — "as of today" for
  // this report's purposes. Every real caller already passes the org's own
  // local today as `toDate` (todayIso(timezone)), so that's reused here
  // rather than re-deriving a second, server-UTC-clock "today" of our own
  // (`new Date().toISOString().slice(0, 10)`, which reads the wrong day for
  // part of every day the org is ahead of UTC — same bug class as
  // schedule.ts's own dayBounds()/rangeBounds()).
  const relevant = injuries.filter((i) => {
    const end = i.actual_return ?? toDate;
    return end >= fromDate;
  });

  const newInjuries = relevant.filter((i) => i.onset_date >= fromDate && i.onset_date <= toDate).length;

  // Nothing in the schema stops one athlete having two concurrent open
  // injuries (no unique/exclusion constraint on injuries), so summing
  // daysOverlap() per injury row double-counted every day both injuries
  // were open for the same athlete — found live: two concurrent injuries
  // over a 10-day window could push daysLost above athleteDays for a
  // single-athlete scope, and availabilityPct negative. seenAthleteDays
  // dedupes to "was this athlete unavailable on this real calendar day",
  // counted once no matter how many injuries overlap it — the per-day loop
  // was already here for the week-burden split, so this reuses it rather
  // than keeping a separate, ungated daysOverlap() sum alongside it.
  let daysLost = 0;
  const weekTotals = new Map<string, number>();
  const seenAthleteDays = new Set<string>();
  /* Three breakdowns off the SAME deduped day, so they can never disagree
     with daysLost or with each other. Attributing them in a second pass over
     `relevant` would reintroduce exactly the concurrent-injury double count
     seenAthleteDays exists to prevent. */
  const siteTotals = new Map<string, number>();
  const unitTotals = new Map<string, number>();
  const athleteTotals = new Map<string, { days: number; bodyArea: string | null }>();
  const byId = new Map(athletes.map((a) => [a.id, a]));
  for (const i of relevant) {
    const end = i.actual_return ?? toDate;

    // Attribute overlap days to weeks within the period, one day at a time —
    // the population here is small (a club's injury list over a report
    // period), so a per-day loop is simpler than a set-based week split and
    // costs nothing measurable at this scale.
    let cursor = i.onset_date > fromDate ? i.onset_date : fromDate;
    const cursorEnd = end < toDate ? end : toDate;
    while (cursor <= cursorEnd) {
      const athleteDayKey = `${i.athlete_id}:${cursor}`;
      if (!seenAthleteDays.has(athleteDayKey)) {
        seenAthleteDays.add(athleteDayKey);
        daysLost += 1;
        const week = mondayOfIso(cursor);
        weekTotals.set(week, (weekTotals.get(week) ?? 0) + 1);

        const site = i.body_area ?? 'unrecorded';
        siteTotals.set(site, (siteTotals.get(site) ?? 0) + 1);
        const unit = byId.get(i.athlete_id)?.position ?? 'No position set';
        unitTotals.set(unit, (unitTotals.get(unit) ?? 0) + 1);
        const cur = athleteTotals.get(i.athlete_id) ?? { days: 0, bodyArea: i.body_area };
        cur.days += 1;
        athleteTotals.set(i.athlete_id, cur);
      }
      const next = new Date(`${cursor}T00:00:00Z`);
      next.setUTCDate(next.getUTCDate() + 1);
      cursor = next.toISOString().slice(0, 10);
    }
  }

  const periodDays = daysOverlap(fromDate, toDate, fromDate, toDate);
  const athleteDays = athleteIds.length * periodDays;
  const availabilityPct = athleteDays > 0 ? Math.round((100 * (athleteDays - daysLost)) / athleteDays) : null;

  /* A week is whole only when all seven of its days sit inside the period.
     The last row of a 28-day window usually is not, and a short bar there is
     the window's shape rather than a recovering squad — so the fact travels
     with the row instead of being inferred by whoever draws it. */
  const burden = [...weekTotals.entries()]
    .map(([weekStart, days]) => {
      const weekEnd = addDaysIso(weekStart, 6);
      const coveredFrom = weekStart > fromDate ? weekStart : fromDate;
      const coveredTo = weekEnd < toDate ? weekEnd : toDate;
      const daysInPeriod = daysOverlap(coveredFrom, coveredTo, coveredFrom, coveredTo);
      return { weekStart, daysLost: days, fullWeek: daysInPeriod === 7, daysInPeriod };
    })
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  const bySite = [...siteTotals.entries()]
    .map(([bodyArea, days]) => ({ bodyArea, days }))
    .sort((a, b) => b.days - a.days);
  const byUnit = [...unitTotals.entries()]
    .map(([unit, days]) => ({ unit, days }))
    .sort((a, b) => b.days - a.days);
  const byAthlete = [...athleteTotals.entries()]
    .map(([athlete_id, v]) => {
      const a = byId.get(athlete_id);
      return {
        athlete_id,
        name: a ? `${a.first_name} ${a.last_name}` : 'Unknown athlete',
        bodyArea: v.bodyArea,
        days: v.days,
      };
    })
    .sort((a, b) => b.days - a.days);

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
    bySite,
    byUnit,
    byAthlete,
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
  /* Nullable since 2026-09-08, matching both audit_log.actor_role and
     actingRole()'s own return type. An athlete acts in no staff role, so the
     column takes a null rather than the invented 'athlete' the TypeScript used
     to supply — see lib/access.ts. Every caller here is a staff route and will
     pass a real role; the type says null because the column allows it and
     because narrowing it again is how the two implementations drifted apart. */
  actorRole: AppRole | null,
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
