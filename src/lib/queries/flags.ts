import type { AvailabilityStatus, FlagSeverity } from '@/lib/types/database';
import { daysBetween, formatNumber } from '@/lib/format';
import { fetchCurrentAvailability } from './availability';
import { fetchGroupAthleteIds, type Db } from './groups';

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
      'id, athlete_id, domain, metric, observed_value, expected_value, flag_date, severity, status, raised_at, acknowledged_at, acknowledged_by, threshold_id',
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
 *  thing that lets the athlete themselves ever see this row (carve-out 2). */
export async function acknowledgeFlag(
  db: Db,
  flagId: string,
  orgId: string,
  userId: string,
): Promise<void> {
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
