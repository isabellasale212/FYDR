import { humanizeDbError } from '@/lib/writeErrors';
import { fetchAllPaged } from './paged';
import type { Db } from './groups';
import { mustAffect } from '@/lib/write';

/* body_composition (migration 0024). Same shape as test_results: staff
 * (coach/medical) select/insert/update, athlete self-select only — see
 * that migration's own policies.
 *
 * DELETING, reversed 2026-09-07. This file used to say a weigh-in was permanent
 * once written and that no delete path should be built — no DELETE grant, no
 * deleted_at, and the profile spec says "Edit entries". That is no longer the
 * rule, but the thing it protected still is: migration 0084 allows a delete only
 * on the day the row was LOGGED (created_at, in the org's timezone), so a typo
 * can be taken back within the day and nothing older can be removed at all.
 * There is still no deleted_at — a same-day delete is a real one.
 *
 * This is the write half of what playerProfile.ts already reads: that
 * file's fetchPlayerProfile() keeps its own inline history query (a
 * read specific to the profile page's 120-day window and sparkline
 * shape) rather than importing fetchHistory from here, so this file adds
 * only what was actually missing — insert and update — instead of
 * reshuffling a read path that already works and is already tested. */

export type BodyCompositionEntry = {
  id: string;
  /** When the row was LOGGED, not the date it describes. The same-day delete
   *  window is keyed on this, so the screen needs it to decide whether to offer
   *  the control at all. */
  created_at: string;
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
 *  the spec's target range and its undefined "meal logging" respectively.
 *
 *  On the first of those: the mean +/- SD band was built as a substitute when no
 *  target-range column existed. Migration 0060 added one — body_mass_target_ranges,
 *  its OWN staff-only table, never a column here. That placement is deliberate and
 *  this file is the reason it matters: body_composition carries
 *  body_composition_self_select, so the athlete reads their own rows, and RLS is
 *  row-level. A target bound added to this table would be readable by the athlete it
 *  is about, and sarPackAssembly.ts select(*)s this table into their subject access
 *  pack besides. Do not add target columns here. */
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
      .select('id, athlete_id, created_at, measured_on, body_mass_kg, body_fat_pct, method')
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
      created_at: row.created_at,
      measured_on: row.measured_on,
      body_mass_kg: row.body_mass_kg,
      body_fat_pct: row.body_fat_pct,
      method: row.method,
    });
    byAthlete.set(row.athlete_id, list);
  }
  return byAthlete;
}

/** Each athlete's most recent body mass as at a date, for use as a DIVISOR only.
 *
 *  Built for the relative-strength rows on /squad/[athleteId]/gym (load ÷ body
 *  mass), and shaped so it cannot be used for anything else: it returns one
 *  number per athlete and no measured_on, no body fat, no lean mass, no history
 *  and no row id. A caller cannot draw a body-mass comparison out of it, and if
 *  one ever wants to it should say so out loud by calling
 *  fetchBodyCompositionForAthletes instead.
 *
 *  THAT NARROWNESS IS THE POINT, and it is the same line migration 0016 and
 *  queries/positionalContext.ts already draw. Body composition is barred from
 *  every ranking in this product for disordered-eating reasons
 *  (metric_definitions seeds `wellness.body_mass_kg` ineligible by name). A
 *  strength-to-mass RATIO is a strength metric — it is what distinguishes a prop
 *  from a wing and it is the figure an S&C coach reads first — but the divisor is
 *  still body mass, so the caller must publish the ratio and never the mass, in
 *  aggregate and never by name. This function gives it exactly enough to do that
 *  and nothing more.
 *
 *  STALENESS IS AN ANSWER, NOT A DEFAULT. `since` is a floor, not an optimisation:
 *  a two-year-old weigh-in behind a lift logged last week produces a ratio that
 *  looks precise and is wrong. An athlete with nothing inside the window is absent
 *  from the map, which the caller renders as "no ratio", never as a stale one.
 *
 *  `measured_on` is a `date` column, so both bounds are compared as plain
 *  YYYY-MM-DD (CLAUDE.md rule 5 governs instants; a calendar date is not one).
 *  PAGED, with the order ending in `id`: a squad weighing in weekly over a 180-day
 *  floor is well inside PostgREST's 1000-row ceiling, but the ceiling does not
 *  error when it is hit and the window is caller-supplied. Descending on
 *  `measured_on` then `id` means the FIRST row seen per athlete is the latest one,
 *  and the `id` tiebreak makes that deterministic when a club records two weigh-ins
 *  on one day. */
export async function fetchLatestBodyMassForAthletes(
  db: Db,
  orgId: string,
  athleteIds: readonly string[],
  window: { since: string; asOf: string },
): Promise<Map<string, number>> {
  if (athleteIds.length === 0) return new Map();
  type Row = { athlete_id: string; measured_on: string; body_mass_kg: number | null };
  const data = await fetchAllPaged<Row>((pageFrom, pageTo) =>
    db
      .from('body_composition')
      .select('athlete_id, measured_on, body_mass_kg')
      .eq('org_id', orgId)
      .in('athlete_id', [...athleteIds])
      .not('body_mass_kg', 'is', null)
      .gte('measured_on', window.since)
      .lte('measured_on', window.asOf)
      .order('measured_on', { ascending: false })
      .order('id', { ascending: false })
      .range(pageFrom, pageTo),
  );

  const latest = new Map<string, number>();
  for (const row of data) {
    if (row.body_mass_kg === null || row.body_mass_kg <= 0) continue;
    if (latest.has(row.athlete_id)) continue;
    latest.set(row.athlete_id, row.body_mass_kg);
  }
  return latest;
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
    .select('id, created_at, measured_on, body_mass_kg, body_fat_pct, method')
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
      return { error: 'Not saved: logging a weigh-in belongs to the sport scientist, the medic, the S&C and the nutritionist.' };
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

  /* G-36, and the SECOND function found sniffing an error message for 'row
     level security' to detect a refusal. Like updateProgrammeStatus, that branch
     could never run: an UPDATE that RLS filters does not raise, so there was no
     message to match. The sentence it wanted to show is now the refusal, reached
     the way that actually works. */
  return mustAffect(
    db
      .from('body_composition')
      .update({
        measured_on: input.measuredOn,
        body_mass_kg: input.bodyMassKg,
        body_fat_pct: input.bodyFatPct,
        method: input.method,
      })
      .eq('id', input.id)
      .eq('org_id', orgId)
      .select('id'),
    {
      /* This sentence used to say "Only coaching or medical staff can edit a
         weigh-in", which 0073 makes exactly backwards: those are now the two
         roles that cannot. */
      refusal: 'Not saved: logging a weigh-in belongs to the sport scientist, the medic, the S&C and the nutritionist.',
      onError: (m) => humanizeDbError(m, 'staff'),
    },
  );
}

/** Remove a weigh-in. Only ever succeeds on the day it was logged.
 *
 *  THROUGH mustAffect, because the refusal is silent. 0084 gates the delete in a
 *  USING clause, so a row outside the window is simply not matched: the
 *  statement succeeds, nothing is removed, and supabase-js returns no error. A
 *  caller checking only `error` would tell somebody yesterday's entry was
 *  deleted when it is still there. The .select() is what makes the affected
 *  rows visible; an empty array is the refusal.
 *
 *  The screen also hides the control on rows it cannot remove, so this message
 *  is the second layer rather than the first — the same two-layer shape used for
 *  every other gated write here. */
export async function deleteWeighIn(
  db: Db,
  orgId: string,
  id: string,
): Promise<{ error: string | null }> {
  return mustAffect(
    db.from('body_composition').delete().eq('org_id', orgId).eq('id', id).select('id'),
    {
      refusal:
        'Not deleted: a weigh-in can only be removed on the day it was logged. Edit it instead.',
      onError: (message) => humanizeDbError(message, 'staff'),
    },
  );
}
