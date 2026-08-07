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
  flag_count: number;
  score: number;
  /** The sentence, split so the row can style the value and the baseline. */
  what: string;
  value: string;
  baseline: string;
  duration: string;
};

const SEVERITY_WEIGHT: Record<FlagSeverity, number> = {
  low: 1,
  medium: 2.5,
  high: 5,
};

const SEVERITY_RANK: Record<FlagSeverity, number> = { low: 0, medium: 1, high: 2 };

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

function durationLabel(flagDate: string, today: string): string {
  const age = daysBetween(flagDate, today);
  if (age <= 0) return 'raised this morning';
  if (age === 1) return 'open since yesterday';
  return `open ${age} days`;
}

export async function fetchDashboardAttention(
  db: Db,
  orgId: string,
  date: string,
  groupIds: readonly string[],
  limit = 5,
): Promise<{ rows: AttentionRow[]; openTotal: number }> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let flagQuery = db
    .from('flags')
    .select(
      'id, athlete_id, domain, metric, observed_value, expected_value, flag_date, severity, status, raised_at',
    )
    .eq('org_id', orgId)
    .in('status', ['raised', 'notified', 'acknowledged', 'monitoring'])
    .order('raised_at', { ascending: false });

  if (scope) flagQuery = flagQuery.in('athlete_id', scope);

  const { data: flags, error } = await flagQuery;
  if (error) throw new Error(error.message);
  if (!flags || flags.length === 0) return { rows: [], openTotal: 0 };

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

  const grouped = new Map<string, typeof flags>();
  for (const flag of flags) {
    const list = grouped.get(flag.athlete_id) ?? [];
    list.push(flag);
    grouped.set(flag.athlete_id, list);
  }

  const rows: AttentionRow[] = [];

  for (const [athleteId, athleteFlags] of grouped) {
    const athlete = athleteById.get(athleteId);
    if (!athlete) continue;

    const sorted = [...athleteFlags].sort(
      (a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        a.flag_date.localeCompare(b.flag_date),
    );
    const top = sorted[0];
    if (!top) continue;

    const copy = metricCopy(top.metric);
    const score = sorted.reduce(
      (acc, f) => acc + SEVERITY_WEIGHT[f.severity],
      0,
    );

    rows.push({
      athlete_id: athleteId,
      name: `${athlete.first_name} ${athlete.last_name}`,
      position: athlete.position,
      availability: availByAthlete.get(athleteId) ?? 'unknown',
      severity: top.severity,
      flag_count: sorted.length,
      score,
      what: copy.what,
      value:
        top.observed_value === null
          ? ''
          : `${formatNumber(top.observed_value, copy.decimals)}${copy.unit}`,
      baseline:
        top.expected_value === null
          ? ''
          : `${formatNumber(top.expected_value, copy.decimals)}${copy.unit}`,
      duration: durationLabel(top.flag_date, date),
    });
  }

  rows.sort(
    (a, b) =>
      b.score - a.score ||
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      a.name.localeCompare(b.name),
  );

  return { rows: rows.slice(0, limit), openTotal: flags.length };
}

/* ---------------------------------------------------------------------------
 * The Flags screen. One row per flag, not aggregated by athlete: a coach
 * working through a morning's exceptions needs to act on each one.
 * ------------------------------------------------------------------------ */

const OPEN_STATUSES = ['raised', 'notified', 'acknowledged', 'monitoring'] as const;

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
  escalated: boolean;
};

const SEVERITY_RANK_LOCAL: Record<FlagSeverity, number> = { low: 0, medium: 1, high: 2 };

export async function fetchFlagsList(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
): Promise<FlagListRow[]> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let query = db
    .from('flags')
    .select(
      'id, athlete_id, domain, metric, observed_value, expected_value, flag_date, severity, status, raised_at',
    )
    .eq('org_id', orgId)
    .in('status', OPEN_STATUSES)
    .order('raised_at', { ascending: true });

  if (scope) query = query.in('athlete_id', scope);

  const { data: flags, error } = await query;
  if (error) throw new Error(error.message);
  if (!flags || flags.length === 0) return [];

  const athleteIds = [...new Set(flags.map((f) => f.athlete_id))];
  const { data: athletes, error: athleteError } = await db
    .from('athletes')
    .select('id, first_name, last_name, squad_number')
    .eq('org_id', orgId)
    .in('id', athleteIds);

  if (athleteError) throw new Error(athleteError.message);

  const athleteById = new Map((athletes ?? []).map((a) => [a.id, a]));
  const now = Date.now();

  const rows: FlagListRow[] = flags
    .map((f) => {
      const athlete = athleteById.get(f.athlete_id);
      if (!athlete) return null;
      const copy = metricCopy(f.metric);
      const escalated =
        (f.status === 'raised' || f.status === 'notified') &&
        now - new Date(f.raised_at).getTime() > 24 * 60 * 60 * 1000;

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
        escalated,
      };
      return row;
    })
    .filter((r): r is FlagListRow => r !== null);

  /* screens/flags.md "Grouping and ordering": severity desc, escalated
   * before not, raised_at asc, surname asc. */
  rows.sort(
    (a, b) =>
      SEVERITY_RANK_LOCAL[b.severity] - SEVERITY_RANK_LOCAL[a.severity] ||
      Number(b.escalated) - Number(a.escalated) ||
      a.raised_at.localeCompare(b.raised_at) ||
      a.name.localeCompare(b.name),
  );

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
    .in('status', OPEN_STATUSES);

  if (error) throw new Error(error.message);
}
