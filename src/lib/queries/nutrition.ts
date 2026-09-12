import type { NutritionCheckinInput } from '@/lib/validation/nutrition';
import { humanizeDbError } from '@/lib/writeErrors';
import type { Db } from './groups';

/* screens/nutrition-checkin.md, screen 45. One question, three answers, once a
 * week. CLAUDE.md rule 8 is explicit that this is the one nutrition entry
 * point that exists: no daily logging, no macros. No protein-target
 * snapshot is taken (nutrition_targets, referenced only by a plain uuid
 * column with no foreign key, is Phase 2 and does not exist in this schema
 * yet) — every check-in is asked and stored the same way this build treats
 * "an athlete with no target", which the spec itself says is a normal,
 * usable case, not a degraded one. */

export type NutritionAnswer = 'yes' | 'roughly' | 'no';

/** The live answer for a week, as every reader sees it. */
export type CurrentCheckin = {
  id: string;
  week_start: string;
  answer: NutritionAnswer;
  note: string | null;
  submitted_at: string | null;
};

/** The athlete's own read: the live answer plus the one correction behind it.
 *  ATH-ADULT-08 C1 (2026-09-12): when the live row is itself a revision,
 *  `prior` is the answer it replaced — the original the athlete first gave —
 *  and no further correction is offered (migration 0107 refuses it as
 *  entry_already_corrected). Null for an uncorrected check-in. The staff
 *  bulk read (fetchCheckinsForAthletes) returns CurrentCheckin instead: the
 *  chase list wants the current answer and does not read the chain. */
export type NutritionCheckin = CurrentCheckin & {
  prior: { answer: NutritionAnswer; submitted_at: string | null } | null;
};

const COLUMNS = 'id, week_start, answer, note, submitted_at, revision_of';

/** The superseded originals behind corrected check-ins, read from the BASE
 *  table by id — the one place that read is right, for the reason
 *  entryRevisions.ts gives: the superseded row is the product here.
 *  `nutrition_checkins_athlete_select` (0012) scopes it to the athlete's own
 *  rows with no superseded_by predicate, so the athlete reads their own
 *  original and physically nobody else's. Returns a map keyed by the prior
 *  row's id. */
async function fetchPriorAnswers(
  db: Db,
  ids: string[],
): Promise<Map<string, { answer: NutritionAnswer; submitted_at: string | null }>> {
  const out = new Map<string, { answer: NutritionAnswer; submitted_at: string | null }>();
  if (ids.length === 0) return out;
  const { data, error } = await db
    .from('nutrition_checkins')
    .select('id, answer, submitted_at')
    .in('id', ids);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) out.set(row.id, { answer: row.answer, submitted_at: row.submitted_at });
  return out;
}

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
  const priors = await fetchPriorAnswers(db, data.revision_of ? [data.revision_of] : []);
  return {
    id: data.id,
    week_start: data.week_start ?? weekStart,
    answer: data.answer,
    note: data.note,
    submitted_at: data.submitted_at,
    prior: data.revision_of ? (priors.get(data.revision_of) ?? null) : null,
  };
}

/** ROW CEILING: not paged, and provably safe rather than assumed so. `from`/`to`
 *  are now driven by the shared period model on /my-data (up to MAX_WINDOW_DAYS,
 *  730) and myDataExport.ts already passes 2000-01-01..2100-01-01, so this read
 *  is deliberately checked against PostgREST's silent 1000-row cap rather than
 *  left to luck. `nutrition_checkins_one_live_per_week` (migration 0004) makes
 *  nutrition_checkins_current hold AT MOST one row per athlete per week, so 730
 *  days is at most 105 rows and the export's century-wide window is at most
 *  ~5,200 — which does exceed the cap, but only for a club that has been running
 *  since the year 2000. That is the same proof-not-assumption standard
 *  playerProfile.ts applies to fetchWellnessByAthlete: if that unique index is
 *  ever dropped, or the export window is ever really used at that width, this
 *  must page. */
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
  const rows = (data ?? []).filter(
    (d): d is typeof d & { id: string; week_start: string; answer: NutritionAnswer } =>
      d.id !== null && d.week_start !== null && d.answer !== null,
  );
  /* One chained read for every corrected week in the window, so My data can
     mark the week Corrected and show what it was — the board's saved state
     promises exactly that ("My data shows the week marked Corrected, with
     both versions"). */
  const priors = await fetchPriorAnswers(
    db,
    rows.map((d) => d.revision_of).filter((id): id is string => id !== null),
  );
  return rows.map((d) => ({
    id: d.id,
    week_start: d.week_start,
    answer: d.answer,
    note: d.note,
    submitted_at: d.submitted_at,
    prior: d.revision_of ? (priors.get(d.revision_of) ?? null) : null,
  }));
}

/** Staff-side bulk read for /nutrition's "Needs a word" chase list and the selected-
 *  athlete weekly check-in panel. `nutrition_checkins_staff_select` (migration 0012)
 *  grants coach/medical every row in the org, unlike every other function in this
 *  file which is deliberately athlete-scoped self-select — this is the one place that
 *  wider grant is actually used. Real substitute for NUTRITION-SPEC.md's "eating {n}%
 *  of the energy target" chase-list reason and its "target against what was eaten"
 *  card, both of which need a daily intake number that CLAUDE.md rule 8 says will
 *  never exist — the athlete's own weekly yes/roughly/no answer is the real thing
 *  closest to what those two panels were trying to show. */
export async function fetchCheckinsForAthletes(
  db: Db,
  orgId: string,
  athleteIds: readonly string[],
  sinceWeekStart: string,
): Promise<Map<string, CurrentCheckin[]>> {
  if (athleteIds.length === 0) return new Map();
  const { data, error } = await db
    .from('nutrition_checkins_current')
    .select('id, athlete_id, week_start, answer, note, submitted_at')
    .eq('org_id', orgId)
    .in('athlete_id', [...athleteIds])
    .gte('week_start', sinceWeekStart)
    .order('week_start', { ascending: false });
  if (error) throw new Error(error.message);

  const byAthlete = new Map<string, CurrentCheckin[]>();
  for (const row of data ?? []) {
    if (row.id === null || row.athlete_id === null || row.week_start === null || row.answer === null) continue;
    const list = byAthlete.get(row.athlete_id) ?? [];
    list.push({ id: row.id, week_start: row.week_start, answer: row.answer, note: row.note, submitted_at: row.submitted_at });
    byAthlete.set(row.athlete_id, list);
  }
  return byAthlete;
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
    /* 0107: the one correction is spent. The page refuses before the form is
       offered (the spent state), so this is the concurrent-tab case. */
    if (error.message.includes('entry_already_corrected')) {
      return { error: 'You have used your one correction for this check-in. It can’t be changed again.' };
    }
    if (error.message.includes('entry_not_revisable')) {
      return { error: 'This check-in has changed since you opened it. Open it again from My data.' };
    }
    /* Same rule as reviseWellnessEntry: never a raw driver string. */
    return { error: humanizeDbError(error.message, 'athlete') };
  }
  return { error: null };
}
