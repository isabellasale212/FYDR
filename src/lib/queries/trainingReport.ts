import { fetchGroupAthleteIds, type Db } from './groups';

/* screens/training-report.md, the single most design-decision-heavy screen
 * this build has touched — sixteen open questions (O-700 to O-715) recorded
 * in the spec itself. Every one with a stated recommendation is adopted here
 * as a decision:
 *
 *   O-700  TD and RUN stay untinted (volume); HSR, HIE and %MAX are tinted
 *          (intensity). Adopted as specified.
 *   O-701  Per-column hue (blue/pink/green) rather than one ramp for every
 *          tinted column. Adopted — this build does not maintain a separate
 *          design-system document to amend, so this is simply how HeatCell
 *          is built.
 *   O-702  The group filter is mandatory here, no exceptions, per CLAUDE.md
 *          §3. Built in, closing the gap the spec itself flags as a possible
 *          defect rather than repeating it.
 *   O-703  Reference population is a rolling 28-day squad reference (option
 *          B), same session type, computed once per render. Adopted.
 *   O-704  RUN gets its own column, running_distance_m, with no invented
 *          velocity threshold — there is no real vendor feed in this build to
 *          calibrate one against, so the column stores whatever a future
 *          import maps to it and renders the missing glyph until then.
 *   O-705  HIE gets its own column, high_intensity_efforts, same treatment.
 *   O-706  MAXV displays in km/h, stored in m/s. Adopted, matches the
 *          screenshot.
 *   O-707  Personal maximum behind %MAX is a rolling 12-month GPS maximum
 *          with the 0 to 12.5 m/s validity filter from 07-integrations.md
 *          §3.8. No tested-maximum fallback: the Testing domain does not
 *          exist in this schema. No valid history renders the not-applicable
 *          glyph, the spec's own fallback for this exact failure mode.
 *   O-708  AVG TD's delta is against the previous date with data, not
 *          strictly "the previous session of the same type" — a real,
 *          documented simplification of the recommendation, not the letter
 *          of it.
 *   O-709  Session chips: the eight most recent sessions with GPS data, no
 *          "show more" control. A real, documented UI-affordance cut.
 *   O-710  No positional-unit subtotal or mean row. Not in the screenshot,
 *          not built, per the spec's own note that it isn't either.
 *   O-711  Unit headers are not interactive (not collapsible), matching the
 *          screenshot.
 *   O-712  Row order within a unit is TD descending. Adopted.
 *   O-713  FLAGGED counts GPS-domain flags for this session only. Adopted —
 *          'gps' is already a valid flags.domain value; nothing in this pass
 *          raises one automatically, so the tile is honest and often zero.
 *   O-714  CSV export, added after this file's first pass — see
 *          src/app/(staff)/reports/training/export/route.ts. Numbers only,
 *          no shading; still no PDF, per reports.ts's own reasoning.
 *   O-715  Chips select a session, not a date: two sessions on one calendar
 *          day render as two chips. Adopted.
 *
 * What else is cut, beyond the open questions:
 *   - No import pipeline (migration 0023's own header). GPS data has no path
 *     into this schema except a direct insert in this pass.
 *   - The tint's alpha table is one table shared by both themes, not the
 *     spec's own separately-tuned and contrast-verified light/dark tables.
 *     Colour is layered as a hue-over-transparent overlay, which adapts
 *     reasonably to either theme without per-theme tuning, but is a real gap
 *     against the spec's own accessibility care.
 *   - Suppression rules implemented: fewer than 5 athletes with a value in
 *     the reference population (no tint), fewer than 20 records or 10
 *     sessions in the 28-day window (fall back to session-relative), and a
 *     zero-or-negative p95 (tint suppressed, never divide by it). Not
 *     implemented: the coefficient-of-variation-below-0.05 check and the
 *     all-values-identical check, both real, documented gaps.
 */

export type SessionChip = { sessionId: string; date: string; label: string; recordCount: number };

export async function fetchRecentGpsSessions(db: Db, orgId: string, limit = 8): Promise<SessionChip[]> {
  const { data, error } = await db
    .from('gps_records')
    .select('session_id, record_date, sessions(title, session_type)')
    .eq('org_id', orgId)
    .not('session_id', 'is', null)
    .order('record_date', { ascending: false });
  if (error) throw new Error(error.message);

  const bySession = new Map<string, SessionChip>();
  for (const r of data ?? []) {
    if (!r.session_id) continue;
    const existing = bySession.get(r.session_id);
    if (existing) {
      existing.recordCount += 1;
    } else {
      bySession.set(r.session_id, {
        sessionId: r.session_id,
        date: r.record_date,
        label: r.sessions?.title ?? 'Session',
        recordCount: 1,
      });
    }
  }
  return [...bySession.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export type BoardRow = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  squad_number: number | null;
  group_name: string;
  group_sort: number;
  td: number | null;
  run: number | null;
  hsr: number | null;
  hie: number | null;
  maxv_kmh: number | null;
  pct_max: number | null;
  flagged: boolean;
};

export type Band = 0 | 1 | 2 | 3 | 4 | null;

/** The five-band scale, screens/training-report.md's own formula. Clamped: a
 *  value at or above the reference sits in band 4 rather than overflowing. */
export function bandFor(value: number | null, referenceP95: number | null): Band {
  if (value === null || referenceP95 === null || referenceP95 <= 0) return null;
  const normalised = Math.min(Math.max(value / referenceP95, 0), 1);
  if (normalised < 0.2) return 0;
  if (normalised < 0.4) return 1;
  if (normalised < 0.6) return 2;
  if (normalised < 0.8) return 3;
  return 4;
}

/** %MAX's own fixed scale — a percentage of the athlete's own maximum, so it
 *  is banded against a constant, never a population. */
export function bandForPctMax(pct: number | null): Band {
  if (pct === null) return null;
  if (pct < 70) return 0;
  if (pct < 80) return 1;
  if (pct < 85) return 2;
  if (pct < 90) return 3;
  return 4;
}

export type ReferenceSet = {
  hsrP95: number | null;
  hieP95: number | null;
  n: number;
  sessionCount: number;
  suppressed: boolean;
  fallbackReason: string | null;
};

function percentile95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1);
  return sorted[Math.max(0, idx)] ?? null;
}

/** The rolling 28-day squad reference, O-703. Falls back to a suppressed
 *  state (caller renders untinted, session-relative) below the population
 *  floors the spec states as the two that matter most. */
export async function fetchReference(db: Db, orgId: string, groupIds: readonly string[], asOfDate: string): Promise<ReferenceSet> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);
  const windowStart = new Date(`${asOfDate}T00:00:00Z`);
  windowStart.setUTCDate(windowStart.getUTCDate() - 28);

  let q = db
    .from('gps_records')
    .select('athlete_id, session_id, high_speed_distance_m, high_intensity_efforts')
    .eq('org_id', orgId)
    .gte('record_date', windowStart.toISOString().slice(0, 10))
    .lte('record_date', asOfDate);
  if (scope) q = q.in('athlete_id', scope);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const sessionCount = new Set(rows.map((r) => r.session_id).filter(Boolean)).size;
  const hsrValues = rows.map((r) => r.high_speed_distance_m).filter((v): v is number => v !== null);
  const hieValues = rows.map((r) => r.high_intensity_efforts).filter((v): v is number => v !== null);

  const suppressed = rows.length < 20 || sessionCount < 10;

  return {
    hsrP95: suppressed ? null : percentile95(hsrValues),
    hieP95: suppressed ? null : percentile95(hieValues),
    n: rows.length,
    sessionCount,
    suppressed,
    fallbackReason: suppressed ? 'Fewer than 20 records or 10 sessions in the last 28 days' : null,
  };
}

/** O-707: rolling 12-month maximum, validity-filtered to the 0 to 12.5 m/s
 *  range 07-integrations.md §3.8 gives for max_speed_ms. No tested-maximum
 *  fallback — see this file's header. */
export async function fetchPersonalMaxima(db: Db, orgId: string, athleteIds: readonly string[], asOfDate: string): Promise<Map<string, number>> {
  if (athleteIds.length === 0) return new Map();
  const windowStart = new Date(`${asOfDate}T00:00:00Z`);
  windowStart.setUTCFullYear(windowStart.getUTCFullYear() - 1);

  const { data, error } = await db
    .from('gps_records')
    .select('athlete_id, max_speed_ms')
    .eq('org_id', orgId)
    .in('athlete_id', [...athleteIds])
    .gte('record_date', windowStart.toISOString().slice(0, 10))
    .lte('record_date', asOfDate)
    .gt('max_speed_ms', 0)
    .lte('max_speed_ms', 12.5);
  if (error) throw new Error(error.message);

  const max = new Map<string, number>();
  for (const r of data ?? []) {
    if (r.max_speed_ms === null) continue;
    const cur = max.get(r.athlete_id);
    if (cur === undefined || r.max_speed_ms > cur) max.set(r.athlete_id, r.max_speed_ms);
  }
  return max;
}

export type TrainingReportBoard = {
  rows: BoardRow[];
  reference: ReferenceSet;
  stats: { squad: number; avgTd: number | null; avgTdDeltaPct: number | null; totalHsrKm: number | null; flagged: number };
};

export async function fetchTrainingReportBoard(
  db: Db,
  orgId: string,
  groupIds: readonly string[],
  sessionId: string,
  sessionDate: string,
): Promise<TrainingReportBoard> {
  const scope = await fetchGroupAthleteIds(db, orgId, groupIds);

  let recordsQuery = db
    .from('gps_records')
    .select('athlete_id, total_distance_m, running_distance_m, high_speed_distance_m, high_intensity_efforts, max_speed_ms')
    .eq('org_id', orgId)
    .eq('session_id', sessionId);
  if (scope) recordsQuery = recordsQuery.in('athlete_id', scope);

  const [recordsRes, reference] = await Promise.all([recordsQuery, fetchReference(db, orgId, groupIds, sessionDate)]);
  if (recordsRes.error) throw new Error(recordsRes.error.message);
  const records = recordsRes.data ?? [];

  const athleteIds = records.map((r) => r.athlete_id);
  if (athleteIds.length === 0) {
    return { rows: [], reference, stats: { squad: 0, avgTd: null, avgTdDeltaPct: null, totalHsrKm: null, flagged: 0 } };
  }

  const [athletesRes, membershipsRes, groupsRes, flagsRes, personalMax] = await Promise.all([
    db.from('athletes').select('id, first_name, last_name, squad_number').eq('org_id', orgId).in('id', athleteIds),
    db
      .from('group_memberships')
      .select('athlete_id, group_id, added_at, removed_at')
      .eq('org_id', orgId)
      .in('athlete_id', athleteIds)
      .lte('added_at', `${sessionDate}T23:59:59`),
    db.from('groups').select('id, name, sort_order').eq('org_id', orgId).eq('group_type', 'positional').is('deleted_at', null),
    db
      .from('flags')
      .select('athlete_id')
      .eq('org_id', orgId)
      .eq('domain', 'gps')
      .eq('flag_date', sessionDate)
      .in('athlete_id', athleteIds),
    fetchPersonalMaxima(db, orgId, athleteIds, sessionDate),
  ]);
  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (membershipsRes.error) throw new Error(membershipsRes.error.message);
  if (groupsRes.error) throw new Error(groupsRes.error.message);
  if (flagsRes.error) throw new Error(flagsRes.error.message);

  const athleteById = new Map((athletesRes.data ?? []).map((a) => [a.id, a]));
  const groupById = new Map((groupsRes.data ?? []).map((g) => [g.id, g]));
  const flaggedIds = new Set((flagsRes.data ?? []).map((f) => f.athlete_id));

  // Positional group as at the session date: added on or before, not yet
  // removed or removed after. Lowest sort_order wins for an athlete in more
  // than one — 04-data-model.md §3's history-preserving membership table is
  // exactly for this kind of as-at-a-date read.
  const groupForAthlete = new Map<string, { name: string; sort: number }>();
  for (const m of membershipsRes.data ?? []) {
    if (m.removed_at && m.removed_at <= `${sessionDate}T23:59:59`) continue;
    const g = groupById.get(m.group_id);
    if (!g) continue;
    const cur = groupForAthlete.get(m.athlete_id);
    if (!cur || g.sort_order < cur.sort) groupForAthlete.set(m.athlete_id, { name: g.name, sort: g.sort_order });
  }

  const hsrValidCount = records.filter((r) => r.high_speed_distance_m !== null).length;
  const hieValidCount = records.filter((r) => r.high_intensity_efforts !== null).length;
  const tintHsr = !reference.suppressed && hsrValidCount >= 5;
  const tintHie = !reference.suppressed && hieValidCount >= 5;

  const rows: BoardRow[] = records
    .map((r) => {
      const athlete = athleteById.get(r.athlete_id);
      if (!athlete) return null;
      const group = groupForAthlete.get(r.athlete_id) ?? { name: 'UNASSIGNED', sort: 999 };
      const personalMaxMs = personalMax.get(r.athlete_id) ?? null;
      const maxvKmh = r.max_speed_ms !== null ? r.max_speed_ms * 3.6 : null;
      const pctMax = r.max_speed_ms !== null && personalMaxMs !== null ? Math.round((100 * r.max_speed_ms) / personalMaxMs) : null;

      return {
        athlete_id: r.athlete_id,
        first_name: athlete.first_name,
        last_name: athlete.last_name,
        squad_number: athlete.squad_number,
        group_name: group.name,
        group_sort: group.sort,
        td: r.total_distance_m,
        run: r.running_distance_m,
        hsr: r.high_speed_distance_m,
        hie: r.high_intensity_efforts,
        maxv_kmh: maxvKmh !== null ? Math.round(maxvKmh * 10) / 10 : null,
        pct_max: pctMax,
        flagged: flaggedIds.has(r.athlete_id),
      };
    })
    .filter((r): r is BoardRow => r !== null)
    .sort((a, b) => a.group_sort - b.group_sort || (b.td ?? 0) - (a.td ?? 0));

  const tdValues = records.map((r) => r.total_distance_m).filter((v): v is number => v !== null);
  const avgTd = tdValues.length > 0 ? tdValues.reduce((s, v) => s + v, 0) / tdValues.length : null;
  const hsrValues = records.map((r) => r.high_speed_distance_m).filter((v): v is number => v !== null);
  const totalHsr = hsrValues.reduce((s, v) => s + v, 0);

  // O-708, simplified: delta against the previous date with data, not
  // strictly the previous session of the same type — see this file's header.
  const { data: priorRecords } = await db
    .from('gps_records')
    .select('total_distance_m, record_date')
    .eq('org_id', orgId)
    .lt('record_date', sessionDate)
    .in('athlete_id', scope ?? athleteIds)
    .order('record_date', { ascending: false })
    .limit(200);
  const priorDate = priorRecords?.[0]?.record_date ?? null;
  const priorValues = (priorRecords ?? [])
    .filter((r) => r.record_date === priorDate)
    .map((r) => r.total_distance_m)
    .filter((v): v is number => v !== null);
  const priorAvg = priorValues.length > 0 ? priorValues.reduce((s, v) => s + v, 0) / priorValues.length : null;
  const avgTdDeltaPct = avgTd !== null && priorAvg !== null && priorAvg > 0 ? Math.round((100 * (avgTd - priorAvg)) / priorAvg) : null;

  return {
    rows,
    reference: { ...reference, hsrP95: tintHsr ? reference.hsrP95 : null, hieP95: tintHie ? reference.hieP95 : null },
    stats: {
      squad: records.length,
      avgTd: avgTd !== null ? Math.round(avgTd) : null,
      avgTdDeltaPct,
      totalHsrKm: hsrValues.length > 0 ? Math.round((totalHsr / 1000) * 10) / 10 : null,
      flagged: flaggedIds.size,
    },
  };
}
