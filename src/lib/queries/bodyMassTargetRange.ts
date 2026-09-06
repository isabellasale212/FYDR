import { todayIso } from '@/lib/format';
import { humanizeDbError } from '@/lib/writeErrors';
import type { Db } from './groups';
import { mustAffect } from '@/lib/write';

/* body_mass_target_ranges (migration 0060). The body-mass range STAFF want an
 * athlete in — the thing the client asked for and that this schema genuinely
 * did not have until 0060.
 *
 * READ THIS BEFORE USING ANYTHING IN THIS FILE.
 *
 * The client gave four rules, and two of them constrain every caller here:
 *
 *   NEVER VISIBLE TO THE ATHLETE. There is no athlete select policy on the
 *     table at all, so an athlete session reads zero rows from every function
 *     below — RLS, not this file, is the enforcement (CLAUDE.md rule 2). But
 *     do NOT rely on that alone: never render the result of these functions
 *     from anything under src/app/(athlete)/, because a page that fetches it
 *     with the SERVICE-ROLE client, or a future security-definer helper, would
 *     bypass RLS silently. As of this file's writing every caller is under
 *     src/app/(staff)/, and it must stay that way.
 *
 *     The table is deliberately NOT in sarPackAssembly.ts's list either. That
 *     file select(*)s body_composition with the admin client into the
 *     athlete's own subject access pack, which is the third reason (after
 *     athletes_self_select and body_composition_self_select) the range could
 *     not be a column on an existing table. Whether a staff-set target range
 *     is disclosable under a subject access request is a legal question for
 *     the club — see 0060's header. Do not add it here without asking.
 *
 *   NEVER RANKED. Nothing in this file feeds a leaderboard, and there is no
 *     metric_definitions row for it. 320_body_mass_target_ranges_test.sql §6
 *     asserts that structurally; do not undo it from the query layer.
 *
 * DISTINCT FROM computeMassBand, WHICH IS NOT THIS.
 *   lib/nutritionRules.ts's computeMassBand returns the athlete's OWN trailing
 *   weekly mean +/- 1 SD. It was built as an honest substitute for exactly this
 *   feature back when no backing column existed. The two are not
 *   interchangeable and must never be drawn as one band:
 *     computeMassBand -> WHERE THEY HAVE BEEN. Descriptive, self-referential,
 *                        recomputes on every weigh-in, no author.
 *     this file       -> WHERE STAFF WANT THEM. Prescriptive, authored by a
 *                        named person on a date, changes only when staff say so.
 *   Both may appear on one chart, and where they do, the UI must distinguish
 *   them by fill-versus-stroke, by hue, AND in words. See TargetsTable.tsx and
 *   SelectedAthleteCard.tsx.
 *
 * HISTORY. The bounds are immutable in the database (0060's guard trigger). A
 * changed target is a new row and the old one is CLOSED, not edited, so
 * fetchTargetRangeHistory can show a season's worth of what staff were asking
 * for. setTargetRange below does both halves in the right order. */

export type BodyMassTargetRange = {
  id: string;
  athlete_id: string;
  target_low_kg: number;
  target_high_kg: number;
  rationale: string | null;
  set_by: string;
  set_at: string;
  effective_from: string;
  effective_to: string | null;
  deleted_at: string | null;
};

export type BodyMassTargetRangeWithSetter = BodyMassTargetRange & { set_by_name: string | null };

const COLUMNS =
  'id, athlete_id, target_low_kg, target_high_kg, rationale, set_by, set_at, effective_from, effective_to, deleted_at';

/* There is deliberately no fetchOneLiveRange(). The single-athlete caller (the player
 * profile) wants the HISTORY anyway — the form shows previous ranges — and picks the
 * live row out of it with `.find(r => r.effective_to === null)`, which is exactly what
 * the one-live-range unique index guarantees is unambiguous. A second function that
 * returned only the live row would be one more place for "live" to be defined slightly
 * differently. */

/** Every range ever set for this athlete, newest first, closed ones included. This is
 *  the point of the effective-dated shape: "what were we asking of him in pre-season?"
 *  is a question a nutritionist actually asks. Retracted rows are excluded — a
 *  retraction means "this was a mistake", not "this was superseded". */
export async function fetchTargetRangeHistory(
  db: Db,
  orgId: string,
  athleteId: string,
): Promise<BodyMassTargetRangeWithSetter[]> {
  const { data, error } = await db
    .from('body_mass_target_ranges')
    // The FK constraint is named explicitly rather than left to PostgREST's
    // disambiguation, matching sarPack.ts's users embed — this table has one FK to
    // users today, but an unqualified embed becomes ambiguous the day it has two, and
    // that failure shows up at runtime rather than here.
    .select(`${COLUMNS}, users!body_mass_target_ranges_set_by_fkey(full_name)`)
    .eq('org_id', orgId)
    .eq('athlete_id', athleteId)
    .is('deleted_at', null)
    .order('effective_from', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw new Error(error.message);
  // Cast then map, the same order thresholds.ts uses: COLUMNS is a plain string, so
  // postgrest-js cannot infer the row shape from it and the cast is what supplies it.
  type Row = BodyMassTargetRange & { users: { full_name: string | null } | null };
  const rows = (data ?? []) as unknown as Row[];
  return rows.map(({ users, ...rest }) => ({ ...rest, set_by_name: users?.full_name ?? null }));
}

/** Bulk read for the /nutrition workspace: the live range for every athlete on screen
 *  in one query rather than one round trip per row.
 *
 *  Not paged, and that is a proof rather than an assumption: the one-live-range unique
 *  index on (org_id, athlete_id) means this returns AT MOST one row per athlete, and no
 *  organisation in this product has 1000 athletes on one screen. If that index is ever
 *  dropped, this must page — same standing note playerProfile.ts carries about its own
 *  bounded wellness read. */
export async function fetchTargetRangesForAthletes(
  db: Db,
  orgId: string,
  athleteIds: readonly string[],
): Promise<Map<string, BodyMassTargetRange>> {
  if (athleteIds.length === 0) return new Map();
  const { data, error } = await db
    .from('body_mass_target_ranges')
    .select(COLUMNS)
    .eq('org_id', orgId)
    .in('athlete_id', athleteIds)
    .is('deleted_at', null)
    .is('effective_to', null);
  if (error) throw new Error(error.message);
  const out = new Map<string, BodyMassTargetRange>();
  for (const row of (data ?? []) as BodyMassTargetRange[]) out.set(row.athlete_id, row);
  return out;
}

export type SetTargetRangeInput = {
  athleteId: string;
  lowKg: number;
  highKg: number;
  rationale: string | null;
};

/** Mirrors the database's own constraints so a staff member gets a sentence rather than
 *  a constraint name. The database is still the gate — this is the courtesy layer. */
function validate(input: SetTargetRangeInput): string | null {
  if (!Number.isFinite(input.lowKg) || !Number.isFinite(input.highKg)) {
    return 'Enter both a low and a high bound, in kg.';
  }
  if (input.highKg <= input.lowKg) {
    return 'The high bound has to be above the low bound — this is a range, not a single target.';
  }
  if (input.lowKg < 30 || input.highKg > 250) {
    return 'Both bounds have to be between 30 and 250 kg. Check the decimal point.';
  }
  if (input.rationale !== null && input.rationale.length > 500) {
    return 'Keep the note to 500 characters or fewer.';
  }
  return null;
}

/** Set a new target range, superseding whatever was live.
 *
 *  Two statements in a deliberate order: CLOSE the current live row, then INSERT the
 *  new one. The order matters and is not interchangeable — the one-live-range unique
 *  index rejects the insert while an open row still exists, so an insert-first version
 *  of this function would fail on every athlete who already had a target.
 *
 *  Not wrapped in a transaction, because PostgREST gives the browser client no way to
 *  open one. The failure window is therefore real but benign and one-directional: if
 *  the insert fails after the close succeeds, the athlete is left with NO live target
 *  and a readable history, which is the safe direction to fail in — a stale target
 *  silently surviving a "change" would be the dangerous one. The close is reported
 *  rather than swallowed so the caller can say so. */
export async function setTargetRange(
  db: Db,
  orgId: string,
  userId: string,
  timezone: string,
  input: SetTargetRangeInput,
): Promise<{ error: string | null }> {
  const invalid = validate(input);
  if (invalid) return { error: invalid };

  const closed = await db
    .from('body_mass_target_ranges')
    .update({ effective_to: todayIso(timezone) })
    .eq('org_id', orgId)
    .eq('athlete_id', input.athleteId)
    .is('deleted_at', null)
    .is('effective_to', null);
  if (closed.error) return { error: writeMessage(closed.error) };

  const { error } = await db.from('body_mass_target_ranges').insert({
    org_id: orgId,
    athlete_id: input.athleteId,
    target_low_kg: input.lowKg,
    target_high_kg: input.highKg,
    rationale: input.rationale,
    set_by: userId,
    effective_from: todayIso(timezone),
  });
  if (error) return { error: writeMessage(error) };
  return { error: null };
}

/** Retract a range: a soft delete, because CLAUDE.md rule 4 and because 0060 grants no
 *  DELETE to any authenticated role. Use this for "this was a mistake"; use
 *  setTargetRange for "the target has moved", which preserves the old row as history. */
export async function retractTargetRange(
  db: Db,
  orgId: string,
  id: string,
): Promise<{ error: string | null }> {
  return mustAffect(
    db
      .from('body_mass_target_ranges')
      .update({ deleted_at: new Date().toISOString() })
      .eq('org_id', orgId)
      .eq('id', id)
      .select('id'),
    { refusal: 'Not saved: retracting a target range belongs to staff who set them.', onError: (m) => writeMessage({ message: m } as never) },
  );
}

/** Audit S5: a raw driver string never leaves this file. The two cases worth naming
 *  specially are the ones a staff member can actually cause. */
function writeMessage(error: { code?: string; message: string }): string {
  if (error.code === '23505') {
    return 'This athlete already has a live target range. Reload the page and try again.';
  }
  if (error.code === '23514') {
    return 'Those bounds are outside what the range allows — the high bound must be above the low, and both between 30 and 250 kg.';
  }
  const lower = error.message.toLowerCase();
  if (lower.includes('not edited in place')) {
    return 'A target range cannot be edited once set. Set a new one instead — the old one is kept as history.';
  }
  if (lower.includes('row-level security') || lower.includes('policy')) {
    return 'Setting a body-mass target range belongs to the sport scientist and the nutritionist.';
  }
  return humanizeDbError(error.message, 'staff');
}
