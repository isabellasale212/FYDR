import { fetchCurrentAvailability, fetchNotFullyAvailable } from './availability';
import { fetchDashboardAttention, type AttentionRow, type DashboardAttention } from './flags';
import { fetchGroupAthleteIds, type Db } from './groups';
import { fetchNextFixture, fetchWeekSessions, mondayOf, rangeBounds, type WeekSession } from './schedule';
import { fetchTimetableDay } from './timetable';
import { anchorMdOffsetsToWeek, daysBetween, dateInTz, formatTime, mdLabel, zonedTimeToUtcIso } from '../format';

/* DASHBOARD-SPEC.md, the coach's 07:00 screen. Every section here composes
 * real, already-shipped query functions (schedule, availability,
 * compliance, flags, timetable) rather than re-deriving them — this file's
 * job is the aggregation and real-vs-real inference the new spec's layout
 * needs that no single existing function produces on its own.
 *
 * Three real, load-bearing decisions, stated once here:
 *
 *  - "Today" is not literal wall-clock today. This org's seed data has a
 *    real, hard edge: compliance_expectations (the generated per-day
 *    wellness/RPE deadlines every other real number on this screen reads
 *    from) stops being generated after 5 Aug 2026 — nothing exists for 6,
 *    7 or 8 Aug, even though real sessions and even real GPS records do
 *    exist that far. fetchEffectiveToday() below picks the most recent
 *    date on/before real wall-clock today that has a real
 *    compliance_expectations row, exactly the same principle
 *    lib/queries/trainingReport.ts already applies ("default to the most
 *    recent session with real data", not a literal clock read) so this
 *    screen doesn't quietly go blank as real time moves past the point
 *    this seed was populated to. It happens to land on Wed 5 Aug 2026 for
 *    this org today, which is also DASHBOARD-SPEC.md's own stated
 *    chronology target — not a coincidence forced to match, a real
 *    convergence confirmed by querying the database, not assumed from the
 *    spec's prose.
 *  - The real `flags` table has no `session_id` column at all — every flag
 *    in this schema relates to an athlete, a domain, a metric and a date,
 *    never a session. The spec's own organising idea ("a GPS flag from
 *    Tuesday's skills session sits under Tuesday's skills session") is
 *    still honoured, but by a real, stated inference rather than a stored
 *    link: a gps-domain flag is associated with whichever real session
 *    that athlete actually has a gps_records row for on the same date
 *    (gps_records IS session-linked, and a gps flag's date reliably
 *    matches the session that produced the number that tripped it).
 *    wellness/compliance/nutrition/testing flags are never inferred onto
 *    a session — they are not session-shaped facts to begin with (a sleep
 *    hours flag doesn't belong to Tuesday's skills session any more than
 *    Wednesday's) — they always surface in "Not tied to a session",
 *    which is what that card is for.
 *  - "Doubtful" vs "ruled out" for Saturday selection has no structured
 *    field anywhere in this schema (no review-date column, nothing beyond
 *    a free-text `note`). Every `modified` athlete counts as doubtful and
 *    every `unavailable` athlete counts as ruled out, uniformly — not a
 *    per-athlete judgement read out of that note's wording, which would
 *    be exactly the kind of fragile text-sniffing this build avoids
 *    everywhere else. Selectable = available + modified, spec's own rule
 *    ("never the unavailable"), and the real note text still surfaces
 *    verbatim in the Doubtful row's detail line so a coach reads the real
 *    context, this file just doesn't try to parse it.
 */

export async function fetchEffectiveToday(db: Db, orgId: string, wallClockToday: string): Promise<string> {
  const { data } = await db
    .from('compliance_expectations')
    .select('expectation_date')
    .eq('org_id', orgId)
    .lte('expectation_date', wallClockToday)
    .order('expectation_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.expectation_date ?? wallClockToday;
}

// ---------------------------------------------------------------------------
// MD week strip
// ---------------------------------------------------------------------------

export type SessionPip = 'training' | 'gym' | 'rehab' | 'testing' | 'match' | 'recovery' | 'meeting';

export type DayStripCard = {
  date: string;
  dayLabel: string;
  md: string | null;
  summary: string;
  pips: SessionPip[];
  alert: { text: string; sev: 'bad' | 'accent' } | null;
  isToday: boolean;
  isPast: boolean;
};

function dayLabelFor(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${d.getUTCDate()}`;
}

export async function fetchWeekStrip(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  weekStart: string,
  effectiveToday: string,
  timezone: string,
): Promise<DayStripCard[]> {
  const [sessions, flagRows] = await Promise.all([
    fetchWeekSessions(db, orgId, weekStart, groupIds, timezone),
    fetchFlagsByDateRange(db, orgId, groupIds, weekStart, addDays(weekStart, 5)),
  ]);

  const byDate = new Map<string, WeekSession[]>();
  for (const s of sessions) {
    const list = byDate.get(s.entry_date) ?? [];
    list.push(s);
    byDate.set(s.entry_date, list);
  }
  const flagsByDate = new Map<string, typeof flagRows>();
  for (const f of flagRows) {
    const list = flagsByDate.get(f.flag_date) ?? [];
    list.push(f);
    flagsByDate.set(f.flag_date, list);
  }

  // MD labels re-anchored to this week's OWN matchday — stored md_offset can
  // count toward a later week's fixture (see anchorMdOffsetsToWeek).
  const anchoredMd = anchorMdOffsetsToWeek(
    Array.from({ length: 6 }, (_, i) => {
      const date = addDays(weekStart, i);
      const daySessions = byDate.get(date) ?? [];
      return {
        date,
        isMatch: daySessions.some((s) => s.session_type === 'match'),
        storedMdOffset: daySessions.find((s) => s.md_offset !== null)?.md_offset ?? null,
      };
    }),
  );

  const days: DayStripCard[] = [];
  for (let i = 0; i < 6; i++) {
    const date = addDays(weekStart, i);
    const daySessions = (byDate.get(date) ?? []).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const pips = daySessions.map((s) => s.session_type as SessionPip);
    const summary = [...new Set(daySessions.map((s) => s.title))].join(' · ') || 'Nothing scheduled';
    const flagsToday = flagsByDate.get(date) ?? [];
    const md = daySessions.length > 0 ? (anchoredMd.get(date) ?? null) : null;

    let alert: DayStripCard['alert'] = null;
    if (flagsToday.length > 0) {
      alert = { text: `${flagsToday.length} flag${flagsToday.length === 1 ? '' : 's'}`, sev: 'bad' };
    } else if (mdLabel(md) === 'MD-1') {
      alert = { text: 'Last session before Saturday', sev: 'accent' };
    }

    days.push({
      date,
      dayLabel: dayLabelFor(date),
      md: mdLabel(md),
      summary,
      pips,
      alert,
      isToday: date === effectiveToday,
      isPast: date < effectiveToday,
    });
  }
  return days;
}

function addDays(dateIso: string, n: number): string {
  const d = new Date(`${dateIso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

type FlagRow = {
  athlete_id: string;
  domain: string;
  metric: string;
  severity: 'low' | 'medium' | 'high';
  status: string;
  observed_value: number | null;
  expected_value: number | null;
  flag_date: string;
};

async function fetchFlagsByDateRange(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  from: string,
  to: string,
): Promise<FlagRow[]> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);
  let q = db
    .from('flags')
    .select('athlete_id, domain, metric, severity, status, observed_value, expected_value, flag_date')
    .eq('org_id', orgId)
    .gte('flag_date', from)
    .lte('flag_date', to)
    .in('status', ['raised', 'notified', 'acknowledged', 'monitoring']);
  if (scope) q = q.in('athlete_id', scope);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Headline stats
// ---------------------------------------------------------------------------

export type HeadlineStats = {
  needYouCount: number;
  wellnessPct: number | null;
  wellnessSub: string;
  availableCount: number;
  availableTotal: number;
  modifiedCount: number;
  unavailableCount: number;
  openFlags: number;
  /** Of openFlags, still raised/notified — what the tile's sub-label counts
   *  now that "unacknowledged" must mean unacknowledged (audit finding 3). */
  awaitingAckFlags: number;
  /** Severity counts across all open flags, shared with the panel summary. */
  flagsBySeverity: DashboardAttention['bySeverity'];
  /** DashboardFlagsPanel's own real data — the same severity-ranked,
   *  athlete-aggregated rows fetchDashboardAttention already computed for
   *  openFlags below, at its real limit (5) rather than the 1 openFlags
   *  alone needed, so the panel costs nothing this function wasn't already
   *  paying for. */
  attentionRows: AttentionRow[];
  toMatchdayDays: number | null;
  opponent: string | null;
  sessionsLeft: number;
};

export async function fetchHeadlineStats(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  effectiveToday: string,
  /** Real today: flag ages ("open 6 days") are wall-clock facts even when
   *  the rest of the screen is anchored to the latest day with data. */
  wallClockToday: string,
  timezone: string,
): Promise<HeadlineStats> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  const [availRes, wellnessExp, flagsToday, attention, fixture, weekSessions] = await Promise.all([
    fetchCurrentAvailability(db, orgId, scope),
    db
      .from('compliance_expectations')
      .select('athlete_id')
      .eq('org_id', orgId)
      .eq('domain', 'wellness')
      .eq('expectation_date', effectiveToday)
      .then(async (res) => {
        if (res.error) throw new Error(res.error.message);
        const expected = scope ? res.data.filter((r) => scope.includes(r.athlete_id)) : res.data;
        if (expected.length === 0) return { expected: 0, submitted: 0 };
        const ids = expected.map((r) => r.athlete_id);
        const { data: entries, error } = await db
          .from('wellness_entries_current')
          .select('athlete_id')
          .eq('org_id', orgId)
          .eq('entry_date', effectiveToday)
          .in('athlete_id', ids);
        if (error) throw new Error(error.message);
        return { expected: expected.length, submitted: entries.length };
      }),
    fetchFlagsByDateRange(db, orgId, groupIds, effectiveToday, effectiveToday),
    fetchDashboardAttention(db, orgId, wallClockToday, groupIds),
    fetchNextFixture(db, orgId, `${effectiveToday}T00:00:00Z`),
    fetchWeekSessions(db, orgId, mondayOf(effectiveToday), groupIds, timezone),
  ]);

  const available = availRes.filter((a) => a.status === 'available').length;
  const modified = availRes.filter((a) => a.status === 'modified').length;
  const unavailable = availRes.filter((a) => a.status === 'unavailable').length;

  // "Need you" — spec: athletes needing a coach's attention today, across
  // wellness and GPS. Real: an athlete with an open flag dated today.
  // Wellness non-submission is already its own headline cell ("Wellness
  // in") — not folded in here too, or the same gap would be counted twice.
  const flaggedTodayIds = new Set(flagsToday.map((f) => f.athlete_id));

  const toMatchdayDays = fixture ? Math.round((Date.parse(fixture.kickoff_at) - Date.parse(`${effectiveToday}T00:00:00Z`)) / 86_400_000) : null;
  const sessionsLeft = weekSessions.filter((s) => s.entry_date > effectiveToday && s.session_type !== 'match').length;

  return {
    needYouCount: flaggedTodayIds.size,
    wellnessPct: wellnessExp.expected > 0 ? Math.round((100 * wellnessExp.submitted) / wellnessExp.expected) : null,
    // "today" only when the anchored day IS the real day — otherwise the
    // banner has already named the day this number belongs to (audit S2).
    wellnessSub: `${wellnessExp.submitted} of ${wellnessExp.expected}${effectiveToday === wallClockToday ? ' today' : ' that day'}`,
    availableCount: available,
    availableTotal: availRes.length,
    modifiedCount: modified,
    unavailableCount: unavailable,
    openFlags: attention.openTotal,
    awaitingAckFlags: attention.awaitingAck,
    flagsBySeverity: attention.bySeverity,
    attentionRows: attention.rows,
    toMatchdayDays,
    opponent: fixture?.opponent ?? null,
    sessionsLeft,
  };
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type AffectedRow = {
  athleteId: string;
  name: string;
  initials: string;
  kind: string;
  why: string;
  value: string;
  sev: 'bad' | 'warn' | 'plain';
};

export type TimelineEntry = {
  id: string;
  time: string;
  name: string;
  groupLabel: string;
  where: string;
  count: string;
  countLabel: string;
  countState: 'bad' | 'warn' | 'ok';
  tone: SessionPip;
  past: boolean;
  affected: AffectedRow[];
};

function initialsOf(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

export async function fetchTimeline(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  date: string,
  nowIso: string,
  timezone: string,
): Promise<TimelineEntry[]> {
  const [sessions, flagsToday] = await Promise.all([
    fetchTimetableDay(db, orgId, date, groupIds, timezone),
    fetchFlagsByDateRange(db, orgId, groupIds, date, date),
  ]);

  const flagsByAthlete = new Map<string, FlagRow[]>();
  for (const f of flagsToday) {
    const list = flagsByAthlete.get(f.athlete_id) ?? [];
    list.push(f);
    flagsByAthlete.set(f.athlete_id, list);
  }

  // gps-domain flags infer-associate with whichever session that athlete
  // actually has a gps_records row for on this date — see file header.
  const gpsFlagAthletes = flagsToday.filter((f) => f.domain === 'gps').map((f) => f.athlete_id);
  const gpsSessionByAthlete = new Map<string, string>();
  if (gpsFlagAthletes.length > 0) {
    const { data: gpsRows, error } = await db
      .from('gps_records')
      .select('athlete_id, session_id')
      .eq('org_id', orgId)
      .eq('record_date', date)
      .in('athlete_id', gpsFlagAthletes);
    if (error) throw new Error(error.message);
    for (const r of gpsRows ?? []) {
      if (r.session_id) gpsSessionByAthlete.set(r.athlete_id, r.session_id);
    }
  }

  return sessions.map((s) => {
    const affected: AffectedRow[] = [];

    for (const p of s.participants) {
      // Only a gps-domain flag ever attaches to a session, and only the
      // one it's inferred onto — every other domain belongs exclusively
      // to "Not tied to a session" (fetchUntiedFlags), never here too.
      const flagsForAthlete = (flagsByAthlete.get(p.athlete_id) ?? []).filter((f) => f.domain === 'gps' && gpsSessionByAthlete.get(p.athlete_id) === s.id);
      for (const f of flagsForAthlete) {
        affected.push({
          athleteId: p.athlete_id,
          name: `${p.last_name}, ${p.first_name}`,
          initials: initialsOf(p.first_name, p.last_name),
          kind: 'Flagged',
          why: describeFlag(f),
          value: f.observed_value !== null ? String(f.observed_value) : '—',
          sev: 'bad',
        });
      }
      // Restriction-to-session-card linkage (integration audit, Batch 3): this used to
      // fire for any 'modified' athlete on any session, which flags a knee restriction
      // on a swim-recovery session as loudly as on a contact training session. p.conflicts
      // is fetchTimetableDay's own session-type-relevance check (computeConflicts in
      // timetable.ts) — reuse it instead of the broader, imprecise availability_status test.
      if (p.conflicts.length > 0 && !flagsForAthlete.length) {
        affected.push({
          athleteId: p.athlete_id,
          name: `${p.last_name}, ${p.first_name}`,
          initials: initialsOf(p.first_name, p.last_name),
          kind: 'Modified',
          why: p.conflicts.join(', '),
          value: '—',
          sev: 'warn',
        });
      }
    }

    const expectedCount = s.participants.length;
    const flaggedCount = affected.length;
    const countState: TimelineEntry['countState'] = flaggedCount > 0 ? (affected.some((a) => a.sev === 'bad') ? 'bad' : 'warn') : 'ok';

    return {
      id: s.id,
      // The org's wall-clock time, same formatter the timetable uses — the
      // audit (S2, coach finding 6) caught this rendering the raw UTC
      // digits (10:30) while the timetable said 11:30 for the same session.
      time: formatTime(s.starts_at, timezone),
      name: s.title,
      groupLabel: 'Squad',
      where: [s.location, s.duration_min ? `${s.duration_min} min` : null].filter(Boolean).join(' · '),
      count: `${expectedCount - flaggedCount} / ${expectedCount}`,
      countLabel: 'clean',
      countState,
      tone: s.session_type as SessionPip,
      // Real instants, straight comparison: a session is past when its
      // start has passed the real clock, never a re-composed wall time.
      past: Date.parse(s.starts_at) < Date.parse(nowIso),
      affected,
    };
  });
}

function describeFlag(f: Pick<FlagRow, 'metric' | 'observed_value' | 'expected_value'>): string {
  const metric = f.metric.replace(/_/g, ' ');
  if (f.observed_value !== null && f.expected_value !== null) {
    return `${metric}, ${f.observed_value} vs an expected ${f.expected_value}`;
  }
  return metric;
}

// ---------------------------------------------------------------------------
// Ready for Saturday
// ---------------------------------------------------------------------------

export type ReadinessRow = { label: string; detail: string; value: string; tone: 'text' | 'warn' | 'bad' };

export type SaturdayReadiness = {
  opponent: string | null;
  homeAway: string | null;
  daysOut: number | null;
  selectable: number;
  squad: number;
  offset: number;
  read: string;
  rows: ReadinessRow[];
  weekLoad: { pct: number | null; fillPct: number; tickPct: number; tone: string; foot: string } | null;
};

const CIRCUMFERENCE = 251;

export async function fetchSaturdayReadiness(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  effectiveToday: string,
  timezone: string,
): Promise<SaturdayReadiness> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);
  const [fixture, availRows, notFully, weekSessions, flagsThisWeek] = await Promise.all([
    fetchNextFixture(db, orgId, `${effectiveToday}T00:00:00Z`),
    fetchCurrentAvailability(db, orgId, scope),
    fetchNotFullyAvailable(db, orgId, groupIds),
    fetchWeekSessions(db, orgId, mondayOf(effectiveToday), groupIds, timezone),
    fetchFlagsByDateRange(db, orgId, groupIds, mondayOf(effectiveToday), addDays(mondayOf(effectiveToday), 5)),
  ]);

  const squad = availRows.length;
  const modifiedRows = notFully.filter((r) => r.status === 'modified');
  const unavailableRows = notFully.filter((r) => r.status === 'unavailable');
  const selectable = squad - unavailableRows.length;
  const offset = squad > 0 ? Math.round(CIRCUMFERENCE * (1 - selectable / squad)) : CIRCUMFERENCE;

  const daysOut = fixture ? Math.round((Date.parse(fixture.kickoff_at) - Date.parse(`${effectiveToday}T00:00:00Z`)) / 86_400_000) : null;

  const doubtfulNames = modifiedRows.map((r) => r.name).join(', ');
  const read =
    unavailableRows.length === 0 && modifiedRows.length === 0
      ? `You can name the full ${squad} from ${squad}. Nobody carries a restriction this week.`
      : `You can name ${selectable} from ${squad}.${modifiedRows.length > 0 ? ` ${doubtfulNames} ${modifiedRows.length === 1 ? 'is' : 'are'} the selection question${modifiedRows.length === 1 ? '' : 's'}.` : ''}`;

  const selectionFlagAthletes = new Set([...modifiedRows, ...unavailableRows].map((r) => r.athlete_id));
  const flagsAffectingSelection = flagsThisWeek.filter((f) => selectionFlagAthletes.has(f.athlete_id));
  const sessionsLeft = weekSessions.filter((s) => s.entry_date > effectiveToday && s.session_type !== 'match');

  const rows: ReadinessRow[] = [
    { label: 'Fit and available', detail: 'no restriction recorded', value: String(availRows.length - modifiedRows.length - unavailableRows.length), tone: 'text' },
    {
      label: 'Doubtful',
      detail: modifiedRows.length > 0 ? modifiedRows.map((r) => `${r.name}${r.restrictions[0] ? ` · ${r.restrictions[0]}` : ''}`).join('; ') : 'nobody this week',
      value: String(modifiedRows.length),
      tone: 'warn',
    },
    {
      label: 'Ruled out',
      detail: unavailableRows.length > 0 ? unavailableRows.map((r) => r.name).join(', ') : 'nobody this week',
      value: String(unavailableRows.length),
      tone: 'bad',
    },
    {
      label: 'Flags affecting selection',
      detail: flagsAffectingSelection.length > 0 ? [...new Set(flagsAffectingSelection.map((f) => f.metric.replace(/_/g, ' ')))].join(', ') : 'none this week',
      value: String(flagsAffectingSelection.length),
      tone: flagsAffectingSelection.length > 0 ? 'warn' : 'text',
    },
    {
      label: 'Sessions left to run',
      detail: sessionsLeft.map((s) => s.title).join(', ') || 'none — the week is done',
      value: String(sessionsLeft.length),
      tone: 'text',
    },
  ];

  // Week load: real squad-mean total distance so far this week (up to and
  // including effectiveToday) against a real "typical week" reference —
  // the mean of prior weeks, same pattern as trainingReport.ts's Rest of
  // the week comparison, excluding this week from its own reference.
  const weekLoad = await fetchWeekLoad(db, orgId, groupIds, mondayOf(effectiveToday), effectiveToday, timezone);

  return {
    opponent: fixture?.opponent ?? null,
    homeAway: fixture?.home_away ?? null,
    daysOut,
    selectable,
    squad,
    offset,
    read,
    rows,
    weekLoad,
  };
}

/** Bounds and date derivation here used to assume the org's local day
 *  lines up with the UTC calendar day — the same dayBounds() bug
 *  schedule.ts's own header documents, doubled: once in the query bounds
 *  (literal `${date}T00:00:00Z`/`T23:59:59Z`) and again in
 *  `s.starts_at.slice(0, 10)` reading a stored UTC timestamp's UTC date
 *  instead of its local one. Both fixed the same way — `rangeBounds`
 *  (schedule.ts) for the window, `dateInTz` (format.ts) for the
 *  per-session date — rather than reinvented here a third time. */
async function fetchWeekLoad(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  weekStart: string,
  upToDate: string,
  timezone: string,
): Promise<SaturdayReadiness['weekLoad']> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  const weekBounds = rangeBounds(weekStart, upToDate, timezone);
  const { data: thisWeekSessions, error: sessErr } = await db
    .from('sessions')
    .select('id')
    .eq('org_id', orgId)
    .eq('session_type', 'training')
    .gte('starts_at', weekBounds.from)
    .lte('starts_at', weekBounds.to)
    .is('deleted_at', null);
  if (sessErr) throw new Error(sessErr.message);
  const sessionIds = (thisWeekSessions ?? []).map((s) => s.id);
  if (sessionIds.length === 0) return null;

  const recordsQuery = db.from('gps_records').select('session_id, athlete_id, total_distance_m').eq('org_id', orgId).in('session_id', sessionIds);
  const { data: records, error: recErr } = await recordsQuery;
  if (recErr) throw new Error(recErr.message);
  const scoped = scope ? (records ?? []).filter((r) => scope.includes(r.athlete_id)) : (records ?? []);

  const bySession = new Map<string, number[]>();
  for (const r of scoped) {
    if (r.total_distance_m === null) continue;
    const list = bySession.get(r.session_id ?? '') ?? [];
    list.push(r.total_distance_m);
    bySession.set(r.session_id ?? '', list);
  }
  let weekTotal = 0;
  for (const values of bySession.values()) weekTotal += values.reduce((s, v) => s + v, 0) / values.length;
  if (weekTotal === 0) return null;

  // Prior weeks' totals (same weekday cutoff, so a Wednesday-so-far week
  // compares against other weeks' Wednesday-so-far totals, not a full week).
  const { data: priorSessions, error: priorErr } = await db
    .from('sessions')
    .select('id, starts_at')
    .eq('org_id', orgId)
    .eq('session_type', 'training')
    .lt('starts_at', zonedTimeToUtcIso(weekStart, '00:00', timezone))
    .is('deleted_at', null);
  if (priorErr) throw new Error(priorErr.message);

  const cutoffDayIndex = daysBetween(weekStart, upToDate);
  const weeksSeen = new Map<string, string[]>();
  for (const s of priorSessions ?? []) {
    const sDate = dateInTz(new Date(s.starts_at), timezone);
    const wk = mondayOf(sDate);
    const dayIndex = daysBetween(wk, sDate);
    if (dayIndex > cutoffDayIndex) continue;
    const list = weeksSeen.get(wk) ?? [];
    list.push(s.id);
    weeksSeen.set(wk, list);
  }
  const priorWeekIds = [...weeksSeen.values()];
  if (priorWeekIds.length === 0) return { pct: null, fillPct: Math.min(100, (weekTotal / 19_000) * 0.72), tickPct: 72, tone: 'accent', foot: `${Math.round(weekTotal).toLocaleString()} m so far · no prior week on record to compare against` };

  const flatPriorIds = priorWeekIds.flat();
  const { data: priorRecords, error: priorRecErr } = await db.from('gps_records').select('session_id, athlete_id, total_distance_m').eq('org_id', orgId).in('session_id', flatPriorIds);
  if (priorRecErr) throw new Error(priorRecErr.message);
  const scopedPrior = scope ? (priorRecords ?? []).filter((r) => scope.includes(r.athlete_id)) : (priorRecords ?? []);

  const priorTotals = priorWeekIds.map((ids) => {
    const bySess = new Map<string, number[]>();
    for (const r of scopedPrior) {
      if (r.total_distance_m === null || !ids.includes(r.session_id ?? '')) continue;
      const list = bySess.get(r.session_id ?? '') ?? [];
      list.push(r.total_distance_m);
      bySess.set(r.session_id ?? '', list);
    }
    let total = 0;
    for (const values of bySess.values()) total += values.reduce((s, v) => s + v, 0) / values.length;
    return total;
  });
  const typical = priorTotals.reduce((s, v) => s + v, 0) / priorTotals.length;
  const pct = typical > 0 ? Math.round((100 * weekTotal) / typical) : null;
  const tone = pct === null ? 'accent' : pct > 112 ? 'bad' : pct < 88 ? 'accent2' : 'accent';
  const fillPct = Math.min(100, (pct ?? 0) * 0.72);

  return {
    pct,
    fillPct,
    tickPct: 72,
    tone,
    foot: `${Math.round(weekTotal).toLocaleString()} m of a typical ${Math.round(typical).toLocaleString()} m week so far · tick is 100%`,
  };
}

// ---------------------------------------------------------------------------
// Squad state
// ---------------------------------------------------------------------------

// Name plus the reason a coach or medical staff actually recorded, if any —
// this tile used to show bare names (the audit's own S4 finding was about the
// list disappearing under a filter, not about what the names lacked, but the
// same rows already carried reason_category and it went unused). Non-injury
// and injury-linked rows render identically here: this tile is squad state at
// a glance, not the injury detail — see AvailabilityList and the injuries
// report for where body area appears for the injury-linked case.
export type SquadStateEntry = { name: string; reason: string | null };

export type SquadState = {
  total: number;
  available: number;
  modified: number;
  unavailable: number;
  modifiedNames: SquadStateEntry[];
  unavailableNames: SquadStateEntry[];
};

export async function fetchSquadState(db: Db, orgId: string, groupIds: readonly string[]): Promise<SquadState> {
  const rows = await fetchNotFullyAvailable(db, orgId, groupIds);
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);
  const availRows = await fetchCurrentAvailability(db, orgId, scope);
  const toEntry = (r: (typeof rows)[number]): SquadStateEntry => ({
    name: r.name,
    reason: r.reason_category,
  });
  return {
    total: availRows.length,
    available: availRows.filter((a) => a.status === 'available').length,
    modified: rows.filter((r) => r.status === 'modified').length,
    unavailable: rows.filter((r) => r.status === 'unavailable').length,
    modifiedNames: rows.filter((r) => r.status === 'modified').map(toEntry),
    unavailableNames: rows.filter((r) => r.status === 'unavailable').map(toEntry),
  };
}

// ---------------------------------------------------------------------------
// Not tied to a session
// ---------------------------------------------------------------------------

export type UntiedFlag = { athleteId: string; name: string; domain: string; rule: string; value: string; sev: 'bad' | 'warn' };

export async function fetchUntiedFlags(db: Db, orgId: string, groupIds: readonly string[]): Promise<UntiedFlag[]> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);
  let q = db
    .from('flags')
    .select('athlete_id, domain, metric, severity, observed_value, expected_value, athletes(first_name, last_name)')
    .eq('org_id', orgId)
    .neq('domain', 'gps')
    .in('status', ['raised', 'notified', 'acknowledged', 'monitoring'])
    .order('raised_at', { ascending: false });
  if (scope) q = q.in('athlete_id', scope);
  const { data, error } = await q;
  if (error) throw new Error(error.message);

  return (data ?? []).map((f) => ({
    athleteId: f.athlete_id,
    name: f.athletes ? `${f.athletes.last_name}, ${f.athletes.first_name}` : 'Unknown',
    domain: f.domain,
    rule: describeFlag(f),
    value: f.observed_value !== null ? String(f.observed_value) : '—',
    sev: f.severity === 'high' ? 'bad' : 'warn',
  }));
}

// ---------------------------------------------------------------------------
// Outstanding entries
// ---------------------------------------------------------------------------

export type OutstandingTrack = { label: string; valueLeft: number; pct: number; tone: string; foot: string };

export async function fetchOutstandingTracks(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  effectiveToday: string,
): Promise<OutstandingTrack[]> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);
  const yesterday = addDays(effectiveToday, -1);

  async function trackFor(domain: 'wellness' | 'training_rpe', date: string, table: 'wellness_entries_current' | 'training_entries_current') {
    const expQ = db.from('compliance_expectations').select('athlete_id').eq('org_id', orgId).eq('domain', domain).eq('expectation_date', date);
    const { data: expRows, error: expErr } = await expQ;
    if (expErr) throw new Error(expErr.message);
    const expected = scope ? (expRows ?? []).filter((r) => scope.includes(r.athlete_id)) : (expRows ?? []);
    if (expected.length === 0) return { expected: 0, submitted: 0 };
    const ids = expected.map((r) => r.athlete_id);
    const { data: entries, error } = await db.from(table).select('athlete_id').eq('org_id', orgId).eq('entry_date', date).in('athlete_id', ids);
    if (error) throw new Error(error.message);
    return { expected: expected.length, submitted: entries?.length ?? 0 };
  }

  const [wellness, rpe] = await Promise.all([
    trackFor('wellness', effectiveToday, 'wellness_entries_current'),
    trackFor('training_rpe', yesterday, 'training_entries_current'),
  ]);

  // Nutrition is the weekly check-in (CLAUDE.md rule 8) — never daily
  // compliance, and never coloured with the same urgency as the two real
  // deadline tracks above; shown only if a week's real window has closed.
  const nutritionWeekStart = mondayOf(addDays(effectiveToday, -7));
  const { data: nutritionRows, error: nutritionErr } = await db
    .from('nutrition_checkins_current')
    .select('athlete_id')
    .eq('org_id', orgId)
    .eq('week_start', nutritionWeekStart);
  if (nutritionErr) throw new Error(nutritionErr.message);
  const scopedNutrition = scope ? (nutritionRows ?? []).filter((r) => r.athlete_id !== null && scope.includes(r.athlete_id)) : (nutritionRows ?? []);
  const squadSize = scope?.length ?? (await fetchCurrentAvailability(db, orgId, null)).length;

  const tracks: OutstandingTrack[] = [];
  if (wellness.expected > 0) {
    const left = wellness.expected - wellness.submitted;
    const pct = Math.round((100 * wellness.submitted) / wellness.expected);
    tracks.push({ label: 'Wellness, today', valueLeft: left, pct, tone: pct >= 80 ? 'good' : 'accent', foot: `${wellness.submitted} of ${wellness.expected} in · today` });
  }
  if (rpe.expected > 0) {
    const left = rpe.expected - rpe.submitted;
    const pct = Math.round((100 * rpe.submitted) / rpe.expected);
    tracks.push({ label: 'RPE, yesterday', valueLeft: left, pct, tone: pct >= 80 ? 'good' : pct >= 50 ? 'warn' : 'bad', foot: `${rpe.submitted} of ${rpe.expected} in · due last night` });
  }
  if (squadSize > 0) {
    const pct = Math.round((100 * scopedNutrition.length) / squadSize);
    tracks.push({
      label: `Nutrition check-in, week of ${new Date(`${nutritionWeekStart}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
      valueLeft: squadSize - scopedNutrition.length,
      pct,
      tone: 'accent2',
      foot: `${scopedNutrition.length} of ${squadSize} in · weekly, missing it is not non-compliance`,
    });
  }
  return tracks;
}
