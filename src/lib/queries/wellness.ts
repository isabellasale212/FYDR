import type { WellnessEntryRow } from '@/lib/types/database';
import type { WellnessEntryInput } from '@/lib/validation/wellness';
import { readiness, rollingBand, type Band, type Point } from '@/lib/stats';
import type { Db } from './groups';

export type WellnessEntry = Pick<
  WellnessEntryRow,
  | 'id'
  | 'athlete_id'
  | 'entry_date'
  | 'sleep_hours'
  | 'sleep_quality'
  | 'fatigue'
  | 'soreness'
  | 'soreness_areas'
  | 'stress'
  | 'mood'
  | 'resting_hr'
  | 'body_mass_kg'
  | 'readiness_score'
  | 'submitted_at'
>;

const COLUMNS =
  'id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, soreness_areas, stress, mood, resting_hr, body_mass_kg, readiness_score, submitted_at';

export async function fetchWellnessByAthlete(
  db: Db,
  athleteId: string,
  range: { from: string; to: string },
): Promise<WellnessEntry[]> {
  const { data, error } = await db
    .from('wellness_entries_current')
    .select(COLUMNS)
    .eq('athlete_id', athleteId)
    .gte('entry_date', range.from)
    .lte('entry_date', range.to)
    .order('entry_date');

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchWellnessForAthletes(
  db: Db,
  athleteIds: string[],
  range: { from: string; to: string },
): Promise<WellnessEntry[]> {
  if (athleteIds.length === 0) return [];

  const { data, error } = await db
    .from('wellness_entries_current')
    .select(COLUMNS)
    .in('athlete_id', athleteIds)
    .gte('entry_date', range.from)
    .lte('entry_date', range.to)
    .order('entry_date');

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchWellnessDay(
  db: Db,
  athleteId: string,
  entryDate: string,
): Promise<WellnessEntry | null> {
  const { data, error } = await db
    .from('wellness_entries_current')
    .select(COLUMNS)
    .eq('athlete_id', athleteId)
    .eq('entry_date', entryDate)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ?? null;
}

/** Insert a self-reported entry.
 *
 *  org_id and athlete_id are written from the caller's own claims and are never
 *  taken from a form. RLS rejects the row otherwise, but sending it correctly
 *  means the rejection is a bug rather than a routine event. Entries are
 *  immutable: a correction is a new row with revision_of set, which is what the
 *  revise_wellness_entry function in migration 0010 exists for. */
export async function submitWellnessEntry(
  db: Db,
  input: WellnessEntryInput,
  identity: { orgId: string; athleteId: string; userId: string },
): Promise<void> {
  const { error } = await db.from('wellness_entries').insert({
    id: input.id,
    org_id: identity.orgId,
    athlete_id: identity.athleteId,
    entry_date: input.entry_date,
    sleep_hours: input.sleep_hours,
    sleep_quality: input.sleep_quality,
    fatigue: input.fatigue,
    soreness: input.soreness,
    soreness_areas:
      input.soreness_areas && input.soreness_areas.length > 0
        ? input.soreness_areas
        : null,
    stress: input.stress,
    mood: input.mood,
    resting_hr: input.resting_hr ?? null,
    body_mass_kg: input.body_mass_kg ?? null,
    comment: input.comment ? input.comment : null,
    source: 'self_report',
    created_by: identity.userId,
  });

  if (error) throw new Error(error.message);
}

export type WellnessCorrectionInput = {
  sleep_hours: number | null;
  sleep_quality: number | null;
  fatigue: number | null;
  soreness: number | null;
  stress: number | null;
  mood: number | null;
};

/** The sanctioned correction path (ADR-005): calls `revise_wellness_entry`,
 *  which closes the original row (`superseded_by`) and inserts a new one
 *  carrying `revision_of`, in one transaction — never an update, per
 *  CLAUDE.md §2 rule 6. `entry_date`, `athlete_id` and `org_id` are not
 *  parameters: the function copies them from the original row server side,
 *  so a correction can never move an entry to another day. `entry_not_
 *  revisable` (the function's own error code, raised when the row named by
 *  `originalId` is not the current revision) is translated into the same
 *  message this screen shows for any other stale-entry case, rather than a
 *  raw Postgres error code reaching the athlete. */
export async function reviseWellnessEntry(
  db: Db,
  originalId: string,
  payload: WellnessCorrectionInput,
): Promise<{ error: string | null }> {
  const { error } = await db.rpc('revise_wellness_entry', {
    p_original_id: originalId,
    p_new_id: crypto.randomUUID(),
    p_payload: payload,
  });

  if (error) {
    if (error.message.includes('entry_not_revisable')) {
      return {
        error:
          'This entry has already been corrected once, or no longer exists. Refresh to see the latest.',
      };
    }
    return { error: error.message };
  }
  return { error: null };
}

/** A dense day-by-day series with the athlete's own rolling mean and band.
 *  A day with no entry is present with a null value, so the chart draws a gap
 *  rather than a zero. */
export function wellnessSeries(
  entries: readonly WellnessEntry[],
  dates: readonly string[],
  metric: 'readiness' | keyof WellnessEntry,
  window = 14,
): Band[] {
  const byDate = new Map(entries.map((e) => [e.entry_date, e]));

  const points: Point[] = dates.map((date) => {
    const entry = byDate.get(date);
    if (!entry) return { date, value: null };

    if (metric === 'readiness') {
      const stored = entry.readiness_score;
      return {
        date,
        value: stored ?? readiness(entry),
      };
    }
    const raw = entry[metric];
    return { date, value: typeof raw === 'number' ? raw : null };
  });

  return rollingBand(points, window);
}
