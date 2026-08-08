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
    return { error: error.message };
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
    return { error: error.message };
  }
  return { error: null };
}
