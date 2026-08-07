import { readiness, rollingBand, zScore, type Band } from '@/lib/stats';
import { addDays, todayIso } from '@/lib/format';
import { fetchGroupAthleteIds, type Db } from './groups';

/* Analytics. screens/analytics.md, screen 27, cut down to two of the five shipped
 * presets — ACWR and wellness trend — and to fixed pages rather than a `saved_views`
 * builder. Neither `saved_views` nor either preset's materialised view
 * (`mv_acute_chronic_load`, `mv_wellness_baselines`) exist in this schema, so both
 * presets are computed live from the base tables instead, the same choice already
 * made for the leaderboard ranking. The other three presets are real, documented
 * cuts: Compliance needs compliance_expectations rows, and nothing in this build
 * generates them yet (the same gap noted in schedule.ts's cancelSession comment).
 * Load-by-MD-n and the nutrition trend are both real screens on their own and are
 * left for a pass with room for them, not folded in half-built here. No custom
 * builder, no correlation, no saved/shared views, no tier gate: this is the staff-
 * only presets library, full stop. */

export type AcwrRow = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  acute: number | null;
  chronic: number | null;
  acwr: number | null;
  suppressed: boolean;
  days_with_data: number;
};

/** Acute:chronic workload ratio. Acute is the trailing 7-day sum of session_load,
 *  chronic is the trailing 28-day sum normalised to a weekly figure (divided by 4)
 *  so the two are on the same footing. screens/analytics.md's own guard: suppressed
 *  below 21 of the 28 chronic days having any record at all, not estimated from
 *  what exists. */
export async function fetchAcwr(
  db: Db,
  orgId: string,
  timezone: string,
  groupIds: readonly string[],
): Promise<AcwrRow[]> {
  const today = todayIso(timezone);
  const from = addDays(today, -27);
  const acuteFrom = addDays(today, -6);

  const [athletesRes, scope, entriesRes] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'left_club'),
    fetchGroupAthleteIds(db, orgId, groupIds),
    db
      .from('training_entries_current')
      .select('athlete_id, entry_date, session_load')
      .eq('org_id', orgId)
      .gte('entry_date', from)
      .lte('entry_date', today),
  ]);

  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (entriesRes.error) throw new Error(entriesRes.error.message);

  const inScope = scope ? new Set(scope) : null;
  const athletes = (athletesRes.data ?? []).filter((a) => !inScope || inScope.has(a.id));

  const byAthlete = new Map<string, { date: string; load: number }[]>();
  for (const e of entriesRes.data ?? []) {
    // training_entries_current is a view: every column types nullable even
    // though these three are not null in practice for a real row.
    if (e.session_load === null || e.athlete_id === null || e.entry_date === null) continue;
    const list = byAthlete.get(e.athlete_id) ?? [];
    list.push({ date: e.entry_date, load: e.session_load });
    byAthlete.set(e.athlete_id, list);
  }

  return athletes
    .map((a) => {
      const rows = byAthlete.get(a.id) ?? [];
      const daysWithData = new Set(rows.map((r) => r.date)).size;
      const suppressed = daysWithData < 21;

      const chronic = rows.reduce((sum, r) => sum + r.load, 0) / 4;
      const acute = rows
        .filter((r) => r.date >= acuteFrom)
        .reduce((sum, r) => sum + r.load, 0);

      return {
        athlete_id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        acute: suppressed ? null : acute,
        chronic: suppressed ? null : chronic,
        acwr: suppressed || chronic === 0 ? null : acute / chronic,
        suppressed,
        days_with_data: daysWithData,
      };
    })
    .sort((a, b) => (b.acwr ?? -Infinity) - (a.acwr ?? -Infinity));
}

export type WellnessTrendRow = {
  athlete_id: string;
  first_name: string;
  last_name: string;
  readiness: number | null;
  band: Band | null;
  z: number | null;
  outlier: boolean;
  observations: number;
};

/** Each athlete's most recent readiness against their own rolling mean, per
 *  screens/analytics.md preset 2 — "the question is never what did he score, it is
 *  whether this is normal for him" (lib/stats.ts's own header, which this reuses
 *  directly rather than re-deriving). z-score suppressed below 10 prior
 *  observations, the spec's own guard; the raw value still shows. */
export async function fetchWellnessTrend(
  db: Db,
  orgId: string,
  timezone: string,
  groupIds: readonly string[],
): Promise<WellnessTrendRow[]> {
  const today = todayIso(timezone);
  const from = addDays(today, -55); // extra runway so a 28-day band has room to fill

  const [athletesRes, scope, entriesRes] = await Promise.all([
    db
      .from('athletes')
      .select('id, first_name, last_name')
      .eq('org_id', orgId)
      .is('deleted_at', null)
      .neq('status', 'left_club'),
    fetchGroupAthleteIds(db, orgId, groupIds),
    db
      .from('wellness_entries_current')
      .select('athlete_id, entry_date, sleep_quality, fatigue, soreness, stress, mood')
      .eq('org_id', orgId)
      .gte('entry_date', from)
      .lte('entry_date', today)
      .order('entry_date'),
  ]);

  if (athletesRes.error) throw new Error(athletesRes.error.message);
  if (entriesRes.error) throw new Error(entriesRes.error.message);

  const inScope = scope ? new Set(scope) : null;
  const athletes = (athletesRes.data ?? []).filter((a) => !inScope || inScope.has(a.id));

  const byAthlete = new Map<string, NonNullable<typeof entriesRes.data>>();
  for (const e of entriesRes.data ?? []) {
    // wellness_entries_current is a view: every column types nullable even
    // though athlete_id and entry_date are not null in practice for a real row.
    if (e.athlete_id === null || e.entry_date === null) continue;
    const list = byAthlete.get(e.athlete_id) ?? [];
    list.push(e);
    byAthlete.set(e.athlete_id, list);
  }

  return athletes
    .map((a) => {
      const entries = byAthlete.get(a.id) ?? [];
      const points = entries.map((e) => ({
        date: e.entry_date as string,
        value: readiness(e),
      }));
      const bands = rollingBand(points, 28, 10);
      const latest = bands.length > 0 ? bands[bands.length - 1] : null;
      const z = latest ? zScore(latest) : null;

      return {
        athlete_id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        readiness: latest?.value ?? null,
        band: latest ?? null,
        z,
        outlier: z !== null && z <= -1.5,
        observations: points.filter((p) => p.value !== null).length,
      };
    })
    .sort((a, b) => (a.z ?? Infinity) - (b.z ?? Infinity));
}
