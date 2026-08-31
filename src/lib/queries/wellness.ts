import type { WellnessEntryRow } from '@/lib/types/database';
import type { WellnessEntryInput } from '@/lib/validation/wellness';
import type { WellnessCorrection } from '@/lib/validation/entryCorrection';
import { humanizeDbError } from '@/lib/writeErrors';
import { readiness, rollingBand, type Band, type Point } from '@/lib/stats';
import { fetchAllPaged } from './paged';
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

/* PAGED. This was a live silent-truncation bug before the positional pages
 * existed, not a precaution taken for them.
 *
 * PostgREST caps an unpaginated read at `max_rows` (1000, supabase/config.toml)
 * and DOES NOT ERROR at the ceiling — it returns exactly 1000 rows that look
 * like a complete answer (queries/paged.ts's header). The single-athlete
 * sibling above, fetchWellnessByAthlete, is provably safe without paging
 * because `wellness_entries_one_live_per_day` (migration 0004) bounds it to one
 * row per day (playerProfile.ts's header states that proof). THIS function
 * multiplies that bound by the number of athletes, and both its callers push
 * past 1000:
 *
 *   the bulk export (queries/exportBuilder.ts) — a whole squad over whatever
 *   window the coach picks. A 40-athlete squad logging most days crosses the
 *   ceiling before the 25th day, and every row past it was silently missing
 *   from the CSV with nothing on screen to say so.
 *
 *   the positional wellness comparison (/squad/[athleteId]/wellness) — a
 *   positional unit over a period that can reach MAX_WINDOW_DAYS (730).
 *
 * `.order('entry_date').order('id')` rather than `entry_date` alone: `.range()`
 * re-runs the query per page, and several athletes share every entry_date, so
 * a non-unique sort key lets the database break ties differently on each page
 * and silently duplicate or drop rows across a boundary. The unique tiebreak is
 * the half that makes paging correct, not decoration. */
export async function fetchWellnessForAthletes(
  db: Db,
  athleteIds: string[],
  range: { from: string; to: string },
): Promise<WellnessEntry[]> {
  if (athleteIds.length === 0) return [];

  return fetchAllPaged<WellnessEntry>((from, to) =>
    db
      .from('wellness_entries_current')
      .select(COLUMNS)
      .in('athlete_id', athleteIds)
      .gte('entry_date', range.from)
      .lte('entry_date', range.to)
      .order('entry_date')
      .order('id')
      .range(from, to),
  );
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

/** The sanctioned correction path (ADR-005): calls `revise_wellness_entry`,
 *  which closes the original row (`superseded_by`) and inserts a new one
 *  carrying `revision_of`, in one transaction — never an update, per
 *  CLAUDE.md §2 rule 6. `entry_date`, `athlete_id` and `org_id` are not
 *  parameters: the function copies them from the original row server side,
 *  so a correction can never move an entry to another day.
 *
 *  **Staff only since migration 0058.** This used to be called from the
 *  athlete's own check-in screen; the club asked for correction to be a
 *  coach action ("the athlete shouldn't be able to edit an entry, only the
 *  coach"), so the RPC now refuses a non-coach/medical caller and the only
 *  call site is the player profile's EntryCorrectionPanel. The error
 *  audience below moved from 'athlete' to 'staff' with it — the fallback
 *  copy differs ("ask your club admin to check your role" vs "tell your
 *  coach"), and telling a coach to tell their coach reads as a bug.
 *
 *  Two named error codes are translated here rather than left to
 *  `humanizeDbError`, because both are ordinary states rather than faults:
 *   - `entry_not_revisable` — the row named by `originalId` is not the
 *     current revision any more (somebody else corrected it first, in
 *     another tab or on another device).
 *   - `not_permitted` — 0058's role guard. Reachable by a coach whose role
 *     was removed between the page render and the save, which is rare but
 *     real, and must not surface as a raw Postgres string (audit S5). */
export async function reviseWellnessEntry(
  db: Db,
  originalId: string,
  payload: WellnessCorrection,
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
    if (error.message.includes('not_permitted')) {
      return {
        error:
          'Only coaching or medical staff can correct an entry. Refresh and sign in again if you believe you hold that role.',
      };
    }
    /* Anything else is humanized here so no caller can leak a raw driver
       string to a screen (audit S5). */
    return { error: humanizeDbError(error.message, 'staff') };
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
