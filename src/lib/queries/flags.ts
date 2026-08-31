import type { AvailabilityStatus, FlagDomain, FlagSeverity } from '@/lib/types/database';
import { daysBetween, formatNumber } from '@/lib/format';
import { fetchCurrentAvailability } from './availability';
import { fetchGroupAthleteIds, type Db } from './groups';
import { fetchAllPaged } from './paged';

/* Flags. Roles and access from screens/flags.md: coach and medical get full
 * view, acknowledge and dismiss; the athlete_visible_at gate (carve-out 2,
 * 01-roles-and-permissions.md §3) means an athlete never sees a flag until a
 * staff member has acknowledged it.
 *
 * Simplified against the full spec for this pass: no recalibration engine (a
 * whole second feature, its own table and an Edge Function replay), no
 * realtime subscription, no bulk actions, no series sparkline (no
 * materialised views exist yet, per README), and no separate "Action" state
 * with a 7-day monitoring window. Acknowledge and Dismiss cover the two
 * transitions the roadmap's own thin-slice line names as the essential ones
 * ("raise, notify, acknowledge, action, resolve" collapses action and
 * resolve into dismiss here). Writes go directly to `flags` and
 * `flag_actions` under RLS rather than through the RPC state machine
 * screens/flags.md specifies, which is more robust but is new migration
 * surface, not a page. Noted, not built.
 */

/* The attention list.
 *
 * screens/dashboard.md specifies this as one RPC over mv_daily_athlete_summary
 * and mv_acute_chronic_load. Neither the function nor the materialised views are
 * in supabase/migrations, so the slice ranks in the application from the tables
 * that do exist: flags, availability, athletes. The ranking and the shape of a
 * row are the ones that document specifies.
 *
 * Capped at five. A list of fifteen is a list of zero. */

export type AttentionRow = {
  athlete_id: string;
  name: string;
  position: string | null;
  availability: AvailabilityStatus | 'unknown';
  severity: FlagSeverity;
  /** The top (most severe/oldest) flag's own domain — DashboardFlagsPanel
   *  doesn't use this to pick a section to scroll to (the profile has one
   *  Flags card, not one per domain; see PlayerProfileFlags.tsx's own
   *  #pp-flags-title), only to label the row honestly with what kind of
   *  flag it is. */
  domain: string;
  flag_count: number;
  /** True when ANY of this athlete's open flags has escalated — the row's
   *  sentence still narrates the top flag, but an escalated athlete must
   *  never be invisible on the dashboard (audit coach finding 4: a real
   *  Escalated flag never appeared in the top 5). */
  escalated: boolean;
  /** The sentence, split so the row can style the value and the baseline. */
  what: string;
  value: string;
  baseline: string;
  duration: string;
};

const SEVERITY_RANK: Record<FlagSeverity, number> = { low: 0, medium: 1, high: 2 };

/* ---------------------------------------------------------------------------
 * The shared vocabulary of flag state. The dashboard tile, the dashboard
 * panel, /flags and the profile Flags card were each counting and ordering
 * flags their own way (audit coach findings 3 and 4: "8 unacknowledged"
 * with 5 acknowledged, profiles saying "0 open" for athletes the dashboard
 * flagged, an escalated athlete missing from the top 5). These four
 * definitions are what every surface now shares:
 *   - OPEN  = raised | notified | acknowledged | monitoring
 *   - AWAITING ACKNOWLEDGEMENT = raised | notified
 *   - ESCALATED = went more than 24h without acknowledgement — and stays
 *     true as history once acknowledged (acknowledged_at − raised_at > 24h),
 *     because acknowledging a flag records that it was seen late, it does
 *     not un-happen the escalation (audit coach finding 21).
 *   - PRIORITY ORDER = severity desc, escalated first, raised_at asc,
 *     name asc (screens/flags.md "Grouping and ordering").
 * ------------------------------------------------------------------------ */

export const OPEN_FLAG_STATUSES = ['raised', 'notified', 'acknowledged', 'monitoring'] as const;

export function isAwaitingAcknowledgement(status: string): boolean {
  return status === 'raised' || status === 'notified';
}

const ESCALATION_MS = 24 * 60 * 60 * 1000;

export function isEscalated(
  flag: { status: string; raised_at: string; acknowledged_at?: string | null },
  nowMs: number,
): boolean {
  const raisedMs = new Date(flag.raised_at).getTime();
  if (isAwaitingAcknowledgement(flag.status)) return nowMs - raisedMs > ESCALATION_MS;
  if (flag.acknowledged_at) return new Date(flag.acknowledged_at).getTime() - raisedMs > ESCALATION_MS;
  return false;
}

/** The one ordering. /flags sorts its rows with this, and the dashboard's
 *  top-5 panel ranks athletes by their first flag under this same order —
 *  never a second, parallel scoring scheme. */
export function compareFlagPriority(
  a: { severity: FlagSeverity; escalated: boolean; raised_at: string; name: string },
  b: { severity: FlagSeverity; escalated: boolean; raised_at: string; name: string },
): number {
  return (
    SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
    Number(b.escalated) - Number(a.escalated) ||
    a.raised_at.localeCompare(b.raised_at) ||
    a.name.localeCompare(b.name)
  );
}

type MetricCopy = { what: string; decimals: number; unit: string };

const METRIC_COPY: Record<string, MetricCopy> = {
  'wellness.readiness_score': { what: 'readiness', decimals: 0, unit: '' },
  'wellness.sleep_hours': { what: 'slept', decimals: 1, unit: ' h' },
  'wellness.soreness': { what: 'soreness', decimals: 0, unit: ' of 5' },
  'load.acwr': { what: 'acute to chronic load', decimals: 2, unit: '' },
  'compliance.wellness_7d': {
    what: 'check-ins submitted',
    decimals: 0,
    unit: ' of 7 days',
  },
};

export function metricCopy(metric: string): MetricCopy {
  return (
    METRIC_COPY[metric] ?? {
      what: metric.split('.').slice(-1).join('').replace(/_/g, ' '),
      decimals: 1,
      unit: '',
    }
  );
}

/** How long a flag has been open, computed against WALL-CLOCK today, never
 *  a data-anchored "effective today" — the audit (S2) caught flags dated
 *  the 6th labelled "raised this morning" on a dashboard whose today was
 *  the 5th. A relative phrase that can't be certain is replaced by the
 *  date itself. */
function durationLabel(flagDate: string, wallClockToday: string): string {
  const age = daysBetween(flagDate, wallClockToday);
  if (age < 0) return `dated ${flagDate}`; // ahead of the clock: never claim recency
  if (age === 0) return 'raised today';
  if (age === 1) return 'open since yesterday';
  return `open ${age} days`;
}

export type DashboardAttention = {
  rows: AttentionRow[];
  /** All open flags in scope (OPEN_FLAG_STATUSES) — the same number /flags
   *  reports as its list length. */
  openTotal: number;
  /** Of those, still raised/notified — the number that actually needs a
   *  coach's click this morning. */
  awaitingAck: number;
  /** Severity breakdown across ALL open flags (not just the top rows), so
   *  the panel's summary line and /flags can never disagree. */
  bySeverity: Record<FlagSeverity, number>;
};

export async function fetchDashboardAttention(
  db: Db,
  orgId: string,
  wallClockToday: string,
  groupIds: readonly string[],
  limit = 5,
): Promise<DashboardAttention> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let flagQuery = db
    .from('flags')
    .select(
      'id, athlete_id, domain, metric, observed_value, expected_value, flag_date, severity, status, raised_at, acknowledged_at',
    )
    .eq('org_id', orgId)
    .in('status', [...OPEN_FLAG_STATUSES])
    .order('raised_at', { ascending: false });

  if (scope) flagQuery = flagQuery.in('athlete_id', scope);

  const { data: flags, error } = await flagQuery;
  if (error) throw new Error(error.message);
  const empty: DashboardAttention = {
    rows: [],
    openTotal: 0,
    awaitingAck: 0,
    bySeverity: { low: 0, medium: 0, high: 0 },
  };
  if (!flags || flags.length === 0) return empty;

  const athleteIds = [...new Set(flags.map((f) => f.athlete_id))];

  const [athletes, availability] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name, position')
      .eq('org_id', orgId)
      .in('id', athleteIds),
    fetchCurrentAvailability(db, orgId, athleteIds),
  ]);

  if (athletes.error) throw new Error(athletes.error.message);

  const athleteById = new Map((athletes.data ?? []).map((a) => [a.id, a]));
  const availByAthlete = new Map(availability.map((a) => [a.athlete_id, a.status]));
  const now = Date.now();

  // Every open flag, in the ONE shared priority order /flags itself uses —
  // then athletes rank by their first appearance in that order, so the
  // panel's top 5 is exactly the top of the /flags list, aggregated.
  const prioritised = flags
    .map((f) => {
      const athlete = athleteById.get(f.athlete_id);
      if (!athlete) return null;
      return {
        ...f,
        name: `${athlete.first_name} ${athlete.last_name}`,
        escalated: isEscalated(f, now),
      };
    })
    .filter((f): f is NonNullable<typeof f> => f !== null)
    .sort(compareFlagPriority);

  const bySeverity: Record<FlagSeverity, number> = { low: 0, medium: 0, high: 0 };
  for (const f of prioritised) bySeverity[f.severity] += 1;
  const awaitingAck = prioritised.filter((f) => isAwaitingAcknowledgement(f.status)).length;

  const flagsByAthlete = new Map<string, typeof prioritised>();
  for (const f of prioritised) {
    const list = flagsByAthlete.get(f.athlete_id) ?? [];
    list.push(f);
    flagsByAthlete.set(f.athlete_id, list);
  }

  const rows: AttentionRow[] = [];
  for (const f of prioritised) {
    if (rows.length >= limit) break;
    if (rows.some((r) => r.athlete_id === f.athlete_id)) continue;
    const athlete = athleteById.get(f.athlete_id);
    if (!athlete) continue;
    const athleteFlags = flagsByAthlete.get(f.athlete_id) ?? [];
    const copy = metricCopy(f.metric);

    rows.push({
      athlete_id: f.athlete_id,
      name: f.name,
      position: athlete.position,
      availability: availByAthlete.get(f.athlete_id) ?? 'unknown',
      severity: f.severity,
      domain: f.domain,
      flag_count: athleteFlags.length,
      escalated: athleteFlags.some((af) => af.escalated),
      what: copy.what,
      value:
        f.observed_value === null
          ? ''
          : `${formatNumber(f.observed_value, copy.decimals)}${copy.unit}`,
      baseline:
        f.expected_value === null
          ? ''
          : `${formatNumber(f.expected_value, copy.decimals)}${copy.unit}`,
      duration: durationLabel(f.flag_date, wallClockToday),
    });
  }

  return { rows, openTotal: prioritised.length, awaitingAck, bySeverity };
}

/* ---------------------------------------------------------------------------
 * The Flags screen. One row per flag, not aggregated by athlete: a coach
 * working through a morning's exceptions needs to act on each one.
 * ------------------------------------------------------------------------ */

export type FlagListRow = {
  id: string;
  athlete_id: string;
  name: string;
  squad_number: number | null;
  domain: string;
  metric: string;
  severity: FlagSeverity;
  status: string;
  what: string;
  observed: string;
  expected: string;
  flag_date: string;
  raised_at: string;
  /** Who saw it and when — the columns have always existed; the UI promised
   *  them ("Acknowledging one records who saw it and when") without ever
   *  showing them (audit coach finding 21). Name is null when the user row
   *  can't be resolved; the timestamp still renders alone. */
  acknowledged_at: string | null;
  acknowledged_by_name: string | null;
  escalated: boolean;
  /** thresholds.id — null when the flag predates thresholds (there is none
   *  seeded that old, but the column itself is nullable) or the threshold
   *  was hard to resolve. Added for the player profile's Flags card, which
   *  needs the real rule sentence (describeThreshold(), thresholds.ts) a
   *  flag was raised under — every other consumer of this row already
   *  ignores fields it doesn't use, so this is additive, not a shape
   *  change anything existing has to react to. */
  threshold_id: string | null;
  /** Whatever's currently in flags.staff_note — the engine's own explanation
   *  (e.g. migration 0053's gap-tolerance detail, "Breached on N of the last
   *  M days, with G day(s) missing") written at raise time, and/or one or
   *  more coach-written notes. As of the standalone "Add note" action
   *  (addFlagNote below) a coach's note is APPENDED on its own line rather
   *  than replacing what is already there, so this can now hold several
   *  lines; render it through staffNoteLines(), never raw. Both kinds share
   *  this one column,
   *  and neither is tagged with which kind it is — shown as a plain,
   *  unattributed "Note:" line rather than claiming an origin the data
   *  doesn't actually record. Was fetched by fetchMyDataFlags (athlete-
   *  facing, post-acknowledgement) but never by this shared query, so
   *  the coach-facing /flags board and the profile Flags card have never
   *  shown it at all — confirmed missing while building the flag engine,
   *  fixed here rather than left silently invisible. */
  staff_note: string | null;
};

export async function fetchFlagsList(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
): Promise<FlagListRow[]> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let query = db
    .from('flags')
    .select(
      'id, athlete_id, domain, metric, observed_value, expected_value, flag_date, severity, status, raised_at, acknowledged_at, acknowledged_by, threshold_id, staff_note',
    )
    .eq('org_id', orgId)
    .in('status', [...OPEN_FLAG_STATUSES])
    .order('raised_at', { ascending: true });

  if (scope) query = query.in('athlete_id', scope);

  const { data: flags, error } = await query;
  if (error) throw new Error(error.message);
  if (!flags || flags.length === 0) return [];

  const athleteIds = [...new Set(flags.map((f) => f.athlete_id))];
  const ackUserIds = [...new Set(flags.map((f) => f.acknowledged_by).filter((v): v is string => v !== null))];

  const [athletesRes, ackUsersRes] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name, squad_number')
      .eq('org_id', orgId)
      .in('id', athleteIds),
    ackUserIds.length > 0
      ? db.from('users').select('id, full_name').eq('org_id', orgId).in('id', ackUserIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null }[], error: null }),
  ]);

  if (athletesRes.error) throw new Error(athletesRes.error.message);
  // A failed name lookup must not sink the whole flags list — the timestamp
  // alone still answers "when was this seen"; the name is best-effort.
  const ackNameById = new Map(
    (ackUsersRes.error ? [] : (ackUsersRes.data ?? [])).map((u) => [u.id, u.full_name]),
  );

  const athleteById = new Map((athletesRes.data ?? []).map((a) => [a.id, a]));
  const now = Date.now();

  const rows: FlagListRow[] = flags
    .map((f) => {
      const athlete = athleteById.get(f.athlete_id);
      if (!athlete) return null;
      const copy = metricCopy(f.metric);

      const row: FlagListRow = {
        id: f.id,
        athlete_id: f.athlete_id,
        name: `${athlete.first_name} ${athlete.last_name}`,
        squad_number: athlete.squad_number,
        domain: f.domain,
        metric: f.metric,
        severity: f.severity,
        status: f.status,
        what: copy.what,
        observed:
          f.observed_value === null
            ? ''
            : `${formatNumber(f.observed_value, copy.decimals)}${copy.unit}`,
        expected:
          f.expected_value === null
            ? ''
            : `${formatNumber(f.expected_value, copy.decimals)}${copy.unit}`,
        flag_date: f.flag_date,
        raised_at: f.raised_at,
        acknowledged_at: f.acknowledged_at,
        acknowledged_by_name: f.acknowledged_by ? (ackNameById.get(f.acknowledged_by) ?? null) : null,
        escalated: isEscalated(f, now),
        threshold_id: f.threshold_id,
        staff_note: f.staff_note,
      };
      return row;
    })
    .filter((r): r is FlagListRow => r !== null);

  /* screens/flags.md "Grouping and ordering": severity desc, escalated
   * before not, raised_at asc, surname asc — via the ONE shared comparator
   * the dashboard panel also ranks by. */
  rows.sort(compareFlagPriority);

  return rows;
}

/** Raised/notified → acknowledged. Sets athlete_visible_at, which is the only
 *  thing that lets the athlete themselves ever see this row (carve-out 2).
 *
 *  `note` is optional (migration 0046, my-data.md's own "with the staff note, if any" —
 *  "if any" is the reason this stays optional rather than a required field or its own
 *  confirm step). screens/flags.md's Acknowledge action is specified as instant and
 *  optimistic with a 5-second Undo; adding a required second step here would break that.
 *  When given, it now goes through addFlagNote() rather than being written inline here.
 *  That is a deliberate change from the original inline `staff_note: trimmedNote`: that
 *  version REPLACED whatever the column held, which silently destroyed the threshold
 *  engine's own explanation (migrations 0052/0053) the moment a coach typed a note.
 *  There is one append implementation now, and both the standalone "Add note" action and
 *  acknowledge-with-a-note share it. Still not a separate flag_actions row — see 0047's
 *  header comment for why.
 *
 *  Cost of routing through addFlagNote: the note path is two round trips instead of one.
 *  The bare-acknowledge path (no note), which is the common case and the one
 *  screens/flags.md specifies as instant and optimistic, is untouched at one write. If
 *  the status update below fails after the note was saved, the note stands and the flag
 *  stays unacknowledged — a visible, recoverable state (the coach can click Acknowledge
 *  again), not a lost note. */
export async function acknowledgeFlag(
  db: Db,
  flagId: string,
  orgId: string,
  userId: string,
  note?: string,
): Promise<void> {
  const trimmedNote = note?.trim();
  if (trimmedNote) await addFlagNote(db, flagId, orgId, trimmedNote);

  const now = new Date().toISOString();
  const { error } = await db
    .from('flags')
    .update({
      status: 'acknowledged',
      acknowledged_at: now,
      acknowledged_by: userId,
      athlete_visible_at: now,
    })
    .eq('id', flagId)
    .eq('org_id', orgId)
    .in('status', ['raised', 'notified']);

  if (error) throw new Error(error.message);
}

/** Add a staff note to a flag WITHOUT touching its status.
 *
 *  The gap this closes: until now the only way to write flags.staff_note was
 *  acknowledgeFlag's optional `note` argument, which is bundled into the
 *  Raised → Acknowledged transition. That made two ordinary things impossible.
 *  A coach could not leave a note on a flag they were not ready to acknowledge
 *  (acknowledgeFlag's own `.in('status', ['raised','notified'])` guard silently
 *  matches zero rows once a flag is acknowledged, so the write was a no-op, not
 *  an error), and could not add a *second* note later — the note field was only
 *  ever offered on the pre-acknowledgement card.
 *
 *  RLS: checked, not assumed. flags_staff_update (migration 0012) is
 *  `using (org_id = auth_org_id() and auth_has_any_role(['coach','medical']))
 *   with check (org_id = auth_org_id())` — no status predicate and no column
 *  list, so coach/medical may update this one column on any flag in their own
 *  org whatever its status. There is no other UPDATE policy on flags for
 *  `authenticated`, so an athlete still cannot write their own staff_note.
 *  Nothing new is needed in the database for this; no migration was added.
 *
 *  APPEND, not overwrite — the judgement call worth recording. staff_note is
 *  dual-use and untagged: the threshold engine (migrations 0052/0053) writes
 *  its own explanation there at raise time ("Breached on N of the last M days,
 *  with G day(s) missing"), and nothing records which kind of text a row holds.
 *  Overwriting would silently destroy the engine's evidence the moment a coach
 *  typed anything, and would also make "add a second note" impossible, which is
 *  the whole point of this function. So a new note is appended on its own line
 *  and every existing line is preserved. The three render sites split on the
 *  newline (staffNoteLines below) and show one quoted line each, so the result
 *  reads as a short thread rather than one run-on paragraph.
 *
 *  Read-modify-write, knowingly. supabase-js cannot express `staff_note =
 *  staff_note || E'\n' || $1` without a new RPC, and adding an RPC (plus its
 *  grants and pgTAP coverage) to append a string is more surface than the
 *  problem deserves. The race is two staff members saving a note on the SAME
 *  flag inside the same few hundred milliseconds, where the loser's line is
 *  dropped; the note is advisory free text, not a ledger, so that trade is
 *  taken deliberately rather than by accident.
 *
 *  Note this does NOT make the note athlete-visible on its own: an athlete only
 *  ever sees a flag once athlete_visible_at is set, which only acknowledgement
 *  does (flags_self_select, 0012). A note added to an unacknowledged flag is
 *  staff-only until someone acknowledges — the FlagCard UI says so rather than
 *  implying the athlete has been told.
 *
 *  WHO READS IT, which the calling UI is now required to state. "Staff-only" is
 *  not "coach-only": flags_staff_select (0012) grants SELECT on flags to coach
 *  AND medical across the whole organisation, so every coach in the club reads
 *  anything written here the moment it is saved. That makes this a shared staff
 *  note and never a medical one. Medical staff may write it (flags_staff_update
 *  covers them, and /flags is open to them), so both note surfaces —
 *  FlagCard.tsx and PlayerProfileFlags.tsx — name the real audience and show a
 *  clinician the CLAUDE.md rule 3 line: diagnosis and treatment detail belong on
 *  the injury record, which coaching staff cannot read, not in a column they
 *  can. That is a UI warning, not a permission: nothing in this function can
 *  enforce it, and pretending otherwise in the copy is what went wrong the first
 *  time.
 *
 *  Real follow-up, recorded rather than half-built: this column is untagged, so
 *  a clinician's note, a coach's note and the engine's own explanation are
 *  indistinguishable once written. If flag notes are ever to carry anything
 *  role-scoped, they need their own table (flag_id, author, body, visible_to)
 *  with policies of their own — not a second free-text column on flags. */
export async function addFlagNote(
  db: Db,
  flagId: string,
  orgId: string,
  note: string,
): Promise<void> {
  const trimmed = note.trim();
  if (!trimmed) throw new Error('A note cannot be empty.');

  const { data: current, error: readError } = await db
    .from('flags')
    .select('staff_note')
    .eq('id', flagId)
    .eq('org_id', orgId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);

  const existing = current?.staff_note?.trim() ?? '';
  const next = existing ? `${existing}\n${trimmed}` : trimmed;

  // No status change, no acknowledged_by, no athlete_visible_at — this write
  // must be able to happen before, after, or entirely without acknowledgement.
  const { error } = await db
    .from('flags')
    .update({ staff_note: next })
    .eq('id', flagId)
    .eq('org_id', orgId);

  if (error) throw new Error(error.message);
}

/** staff_note holds one or more notes separated by newlines (see addFlagNote).
 *  Every surface that renders it uses this so a two-note flag never renders as
 *  one paragraph with a stray line break inside a pair of quotation marks.
 *  Tolerant of the single-line rows that already exist: a note with no newline
 *  comes back as a one-element array. */
export function staffNoteLines(note: string | null | undefined): string[] {
  if (!note) return [];
  return note
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

/* ---------------------------------------------------------------------------
 * The athlete's own visible flags. Integration-audit major finding: acknowledgeFlag
 * above has set athlete_visible_at correctly since 0006/0012, flags_self_select (0012)
 * has always returned the row instantly once it does, and nothing on the athlete side
 * has ever called either. This is the read half.
 *
 * my-data.md line ~241: "flags | 'flags' where athlete_visible_at is not null | Dated
 * markers on the chart with the staff note. Unacknowledged flags are not returned by the
 * query at all." The `.not('athlete_visible_at', 'is', null)` filter below is redundant
 * with flags_self_select's own predicate — RLS already guarantees it for an athlete's
 * session — and is kept anyway so this query reads correctly on its own, the same
 * defense-in-depth reasoning OPEN_FLAG_STATUSES filters are written out for above even
 * though a staff RLS policy also scopes those rows by role.
 * ------------------------------------------------------------------------ */

export type VisibleFlag = {
  id: string;
  domain: FlagDomain;
  metric: string;
  /** The plain-language subject, from the shared METRIC_COPY table — "readiness",
   *  "slept", "check-ins submitted" — never the raw metric key. */
  what: string;
  observed: string;
  expected: string;
  flag_date: string;
  acknowledged_at: string;
  /** First name only — see fetchMyVisibleFlags's own comment on why. */
  acknowledged_by_name: string | null;
  /** Optional (migration 0046). Athlete-facing copy renders "if any" per my-data.md,
   *  never a placeholder like "No note added". */
  staff_note: string | null;
};

export async function fetchMyVisibleFlags(
  db: Db,
  athleteId: string,
  range: { from: string; to: string },
): Promise<VisibleFlag[]> {
  /* PAGED. `range` is no longer a fixed 42 days — /my-data drives it from the
   * shared period model and it can be MAX_WINDOW_DAYS (730). Nothing bounds an
   * athlete to one flag a day: flag_date is per (domain, metric), and
   * 04-data-model.md §10 lists seven domains, so a poor spell can raise several
   * on the same date. Ordered DESCENDING, which is why a truncation here would
   * have been the quiet kind — the athlete would have kept their most recent
   * markers and silently lost the far end of the window. `id` is the unique
   * tiebreak; several flags legitimately share one flag_date. */
  const flags = await fetchAllPaged<{
    id: string;
    domain: FlagDomain;
    metric: string;
    observed_value: number | null;
    expected_value: number | null;
    flag_date: string;
    acknowledged_at: string | null;
    acknowledged_by: string | null;
    staff_note: string | null;
  }>((pageFrom, pageTo) =>
    db
      .from('flags')
      .select(
        'id, domain, metric, observed_value, expected_value, flag_date, acknowledged_at, acknowledged_by, staff_note',
      )
      .eq('athlete_id', athleteId)
      .not('athlete_visible_at', 'is', null)
      .gte('flag_date', range.from)
      .lte('flag_date', range.to)
      .order('flag_date', { ascending: false })
      .order('id')
      .range(pageFrom, pageTo),
  );

  if (flags.length === 0) return [];

  const ackUserIds = [...new Set(flags.map((f) => f.acknowledged_by).filter((v): v is string => v !== null))];

  // users_org_select (0012) is org-wide, not role-gated, so an athlete can already
  // resolve a staff colleague's name the same way fetchFlagsList does on the staff side
  // — first name only here, though: "Seen by Jamie" reads as a colleague telling you
  // something, "Seen by Jamie Ellis" reads like a case file. Task's own instruction:
  // "clearly attributed to staff, not clinical/alarming language".
  const ackUsersRes =
    ackUserIds.length > 0
      ? await db.from('users').select('id, full_name').in('id', ackUserIds)
      : { data: [] as { id: string; full_name: string | null }[], error: null };
  const ackNameById = new Map(
    (ackUsersRes.error ? [] : (ackUsersRes.data ?? [])).map((u) => [u.id, u.full_name?.split(' ')[0] ?? null]),
  );

  return flags.map((f) => {
    const copy = metricCopy(f.metric);
    return {
      id: f.id,
      domain: f.domain,
      metric: f.metric,
      what: copy.what,
      observed:
        f.observed_value === null ? '' : `${formatNumber(f.observed_value, copy.decimals)}${copy.unit}`,
      expected:
        f.expected_value === null ? '' : `${formatNumber(f.expected_value, copy.decimals)}${copy.unit}`,
      flag_date: f.flag_date,
      // athlete_visible_at is only ever set alongside acknowledged_at (acknowledgeFlag
      // above, and the trigger flags.md §"Invariants" describes), so this row cannot
      // exist without one — the fallback is defensive, not an expected path.
      acknowledged_at: f.acknowledged_at ?? f.flag_date,
      acknowledged_by_name: f.acknowledged_by ? (ackNameById.get(f.acknowledged_by) ?? null) : null,
      staff_note: f.staff_note,
    };
  });
}

/** Any open status → dismissed, with a mandatory reason recorded as a
 *  flag_actions row (screens/flags.md validation rules: a dismissal without a
 *  reason is rejected, both client-side here and by a check constraint in
 *  migration 0006: action_type <> 'dismissed' or dismiss_reason is not
 *  null). */
export async function dismissFlag(
  db: Db,
  flagId: string,
  orgId: string,
  userId: string,
  reason: string,
): Promise<void> {
  const { error: actionError } = await db.from('flag_actions').insert({
    org_id: orgId,
    flag_id: flagId,
    action_type: 'dismissed',
    dismiss_reason: reason,
    taken_by: userId,
  });
  if (actionError) throw new Error(actionError.message);

  const { error } = await db
    .from('flags')
    .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
    .eq('id', flagId)
    .eq('org_id', orgId)
    .in('status', [...OPEN_FLAG_STATUSES]);

  if (error) throw new Error(error.message);
}
