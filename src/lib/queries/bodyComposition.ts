import { humanizeDbError } from '@/lib/writeErrors';
import { fetchAllPaged } from './paged';
import type { Db } from './groups';

/* body_composition (migration 0024). Same shape as test_results: staff
 * (coach/medical) select/insert/update, athlete self-select only — see
 * that migration's own policies. No delete grant exists on this table at
 * all (unlike the soft-deleted athlete-data tables CLAUDE.md rule 4
 * describes), and it has no deleted_at column either, so there is no
 * delete path here and none should be built — a logged weigh-in is
 * permanent once written, editable but not removable, matching the "Edit
 * entries" (not "Delete entries") wording the player profile spec itself
 * uses.
 *
 * This is the write half of what playerProfile.ts already reads: that
 * file's fetchPlayerProfile() keeps its own inline history query (a
 * read specific to the profile page's 120-day window and sparkline
 * shape) rather than importing fetchHistory from here, so this file adds
 * only what was actually missing — insert and update — instead of
 * reshuffling a read path that already works and is already tested. */

export type BodyCompositionEntry = {
  id: string;
  measured_on: string;
  body_mass_kg: number | null;
  body_fat_pct: number | null;
  method: string | null;
};

/** Bulk read for /nutrition: every in-scope athlete's weigh-in history in one query,
 *  rather than one round trip per athlete on a screen that can show 25+ of them at
 *  once. Used for three real things at once: the latest mass (targets, the range bar),
 *  the trailing weekly readings (the mean +/- SD band and the sparkline), and "days
 *  logged this week" (the week's-logging strip and the "Logged {n} of 7" chase-list
 *  reason) — see lib/nutritionRules.ts's header for why those are real substitutes for
 *  the spec's fabricated target range and its undefined "meal logging" respectively. */
/** PAGED SINCE THE WINDOW BECAME SELECTABLE. `sinceIso` used to be a fixed
 *  today-minus-90 computed on /nutrition; it is now whatever the body-mass
 *  trend's PeriodSelector resolves, up to MAX_WINDOW_DAYS (730). A 40-athlete
 *  squad weighing in most days is ~40 rows a day: comfortably inside
 *  PostgREST's 1000-row ceiling over 90 days, and roughly 29,000 rows over
 *  two years. PostgREST does not error at the ceiling — it returns exactly
 *  1000 rows that look like a complete answer — so this pages.
 *
 *  The ORDER BY ends in `id` because that is what makes it a TOTAL order:
 *  `.range()` re-runs the query per page and ties on `measured_on` alone can
 *  be broken differently on each call, silently duplicating or dropping a
 *  weigh-in across a page boundary. Descending is deliberate and load-bearing
 *  downstream, not a preference: buildWorkspaceAthlete (lib/nutritionWorkspace.ts)
 *  documents its `history` input as "newest first, as fetched" and reads
 *  `withMass[0]` as the latest reading. */
export async function fetchBodyCompositionForAthletes(
  db: Db,
  orgId: string,
  athleteIds: readonly string[],
  sinceIso: string,
): Promise<Map<string, BodyCompositionEntry[]>> {
  if (athleteIds.length === 0) return new Map();
  type Row = BodyCompositionEntry & { athlete_id: string };
  const data = await fetchAllPaged<Row>((pageFrom, pageTo) =>
    db
      .from('body_composition')
      .select('id, athlete_id, measured_on, body_mass_kg, body_fat_pct, method')
      .eq('org_id', orgId)
      .in('athlete_id', [...athleteIds])
      .gte('measured_on', sinceIso)
      .order('measured_on', { ascending: false })
      .order('id', { ascending: false })
      .range(pageFrom, pageTo),
  );

  const byAthlete = new Map<string, BodyCompositionEntry[]>();
  for (const row of data) {
    const list = byAthlete.get(row.athlete_id) ?? [];
    list.push({
      id: row.id,
      measured_on: row.measured_on,
      body_mass_kg: row.body_mass_kg,
      body_fat_pct: row.body_fat_pct,
      method: row.method,
    });
    byAthlete.set(row.athlete_id, list);
  }
  return byAthlete;
}

/** The org's earliest weigh-in, for resolveRange's `earliest` argument when a
 *  screen's body-mass trend is set to "All on record". Without it `all` quietly
 *  degrades to MAX_WINDOW_DAYS and the label promises more than it shows. Only
 *  worth the round trip for that one key — resolveRange ignores it otherwise.
 *
 *  `measured_on` is a `date` column, so the value comes back as a plain
 *  YYYY-MM-DD calendar date and is compared as one (CLAUDE.md rule 5 governs
 *  instants; this is not one). */
export async function fetchEarliestBodyCompositionDate(
  db: Db,
  orgId: string,
): Promise<string | null> {
  const { data, error } = await db
    .from('body_composition')
    .select('measured_on')
    .eq('org_id', orgId)
    .order('measured_on', { ascending: true })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0]?.measured_on ?? null;
}

export async function fetchBodyCompositionEntries(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<BodyCompositionEntry[]> {
  const { data, error } = await db
    .from('body_composition')
    .select('id, measured_on, body_mass_kg, body_fat_pct, method')
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .order('measured_on', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export type LogWeighInInput = {
  measuredOn: string;
  bodyMassKg: number;
  bodyFatPct: number | null;
  method: string | null;
};

/** table('body_mass_kg numeric(5,2)') caps at 999.99 — Postgres would reject
 *  a value that doesn't fit rather than silently truncate it, but a plain
 *  sentence here is friendlier than a raw numeric-overflow error string. */
function validate(input: LogWeighInInput): string | null {
  if (!input.measuredOn) return 'Set the date this weigh-in happened.';
  if (!Number.isFinite(input.bodyMassKg) || input.bodyMassKg <= 0) {
    return 'Enter a body mass greater than zero.';
  }
  if (input.bodyMassKg >= 1000) return 'That body mass is out of range.';
  if (input.bodyFatPct !== null && (input.bodyFatPct < 0 || input.bodyFatPct >= 100)) {
    return 'Body fat % must be between 0 and 100.';
  }
  return null;
}

export async function logWeighIn(
  db: Db,
  orgId: string,
  athleteId: string,
  userId: string,
  input: LogWeighInInput,
): Promise<{ error: string | null }> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const { error } = await db.from('body_composition').insert({
    org_id: orgId,
    athlete_id: athleteId,
    measured_on: input.measuredOn,
    body_mass_kg: input.bodyMassKg,
    body_fat_pct: input.bodyFatPct,
    method: input.method,
    recorded_by: userId,
  });

  if (error) {
    if (error.message.toLowerCase().includes('row-level security') || error.message.toLowerCase().includes('policy')) {
      return { error: 'Only coaching or medical staff can log a weigh-in.' };
    }
    /* Raw driver strings never leave this file — audit S5. */
    return { error: humanizeDbError(error.message, 'staff') };
  }
  return { error: null };
}

export type UpdateWeighInInput = {
  id: string;
  measuredOn: string;
  bodyMassKg: number;
  bodyFatPct: number | null;
  method: string | null;
};

/** Direct mutation, not a revision row: body_composition isn't one of the
 *  "immutable once submitted" domains CLAUDE.md rule 6 names (wellness,
 *  gym, nutrition) — this table's own RLS grants UPDATE outright, which is
 *  the schema's own answer to whether a correction edits in place. */
export async function updateWeighIn(
  db: Db,
  orgId: string,
  input: UpdateWeighInInput,
): Promise<{ error: string | null }> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const { error } = await db
    .from('body_composition')
    .update({
      measured_on: input.measuredOn,
      body_mass_kg: input.bodyMassKg,
      body_fat_pct: input.bodyFatPct,
      method: input.method,
    })
    .eq('id', input.id)
    .eq('org_id', orgId);

  if (error) {
    if (error.message.toLowerCase().includes('row-level security') || error.message.toLowerCase().includes('policy')) {
      return { error: 'Only coaching or medical staff can edit a weigh-in.' };
    }
    return { error: humanizeDbError(error.message, 'staff') };
  }
  return { error: null };
}
