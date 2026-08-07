import type { NutritionCheckinInput } from '@/lib/validation/nutrition';
import type { Db } from './groups';

/* screens/nutrition-checkin.md, screen 45. One question, three answers, once a
 * week. CLAUDE.md rule 8 is explicit that this is the one nutrition entry
 * point that exists: no daily logging, no macros. No protein-target
 * snapshot is taken (nutrition_targets, referenced only by a plain uuid
 * column with no foreign key, is Phase 2 and does not exist in this schema
 * yet) — every check-in is asked and stored the same way this build treats
 * "an athlete with no target", which the spec itself says is a normal,
 * usable case, not a degraded one. */

export type NutritionCheckin = {
  id: string;
  week_start: string;
  answer: 'yes' | 'roughly' | 'no';
  note: string | null;
  submitted_at: string | null;
};

const COLUMNS = 'id, week_start, answer, note, submitted_at';

export async function fetchCheckinForWeek(
  db: Db,
  athleteId: string,
  weekStart: string,
): Promise<NutritionCheckin | null> {
  const { data, error } = await db
    .from('nutrition_checkins_current')
    .select(COLUMNS)
    .eq('athlete_id', athleteId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.id === null || data.answer === null) return null;
  return {
    id: data.id,
    week_start: data.week_start ?? weekStart,
    answer: data.answer,
    note: data.note,
    submitted_at: data.submitted_at,
  };
}

export async function fetchRecentCheckins(
  db: Db,
  athleteId: string,
  from: string,
  to: string,
): Promise<NutritionCheckin[]> {
  const { data, error } = await db
    .from('nutrition_checkins_current')
    .select(COLUMNS)
    .eq('athlete_id', athleteId)
    .gte('week_start', from)
    .lte('week_start', to)
    .order('week_start', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? [])
    .filter((d): d is typeof d & { id: string; week_start: string; answer: 'yes' | 'roughly' | 'no' } =>
      d.id !== null && d.week_start !== null && d.answer !== null,
    )
    .map((d) => ({ id: d.id, week_start: d.week_start, answer: d.answer, note: d.note, submitted_at: d.submitted_at }));
}

export async function submitCheckin(
  db: Db,
  input: NutritionCheckinInput,
  identity: { orgId: string; athleteId: string; userId: string },
): Promise<void> {
  const { error } = await db.from('nutrition_checkins').insert({
    id: input.id,
    org_id: identity.orgId,
    athlete_id: identity.athleteId,
    week_start: input.week_start,
    iso_year: input.iso_year,
    iso_week: input.iso_week,
    answer: input.answer,
    note: input.note ? input.note : null,
    source: 'self_report',
    created_by: identity.userId,
  });
  if (error) throw new Error(error.message);
}

/** The sanctioned correction path, same shape as reviseWellnessEntry and
 *  reviseTrainingEntry — see wellness.ts's comment for the full reasoning,
 *  which applies unchanged. Athlete-only: there is no staff write path to
 *  this table at all (04-data-model.md §17.15), so unlike the other two
 *  revise functions, this one has no coach/medical branch to worry about. */
export async function reviseCheckin(
  db: Db,
  originalId: string,
  answer: 'yes' | 'roughly' | 'no',
  note: string,
): Promise<{ error: string | null }> {
  const { error } = await db.rpc('revise_nutrition_checkin', {
    p_original_id: originalId,
    p_new_id: crypto.randomUUID(),
    p_answer: answer,
    p_note: note,
  });
  if (error) {
    if (error.message.includes('entry_not_revisable')) {
      return {
        error: 'This week has already been corrected once, or the window has closed.',
      };
    }
    return { error: error.message };
  }
  return { error: null };
}
