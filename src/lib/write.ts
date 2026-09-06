/** Writes that report a refusal instead of a silent success.
 *
 *  G-36. Four separate findings in one day came from the same two facts:
 *
 *  1. Postgres raises 42501 when an INSERT violates a WITH CHECK. It does NOT
 *     raise when an UPDATE or DELETE fails a USING clause. The row is simply not
 *     matched, the statement succeeds, and zero rows change.
 *  2. supabase-js `.update()` and `.delete()` return `{ error: null }` with no
 *     row count unless you ask for one.
 *
 *  So a caller that checks only `error` cannot tell "saved" from "silently
 *  refused", and every screen built on that pattern reports success while
 *  changing nothing. That is G-34's six screens, G-35's GPS re-import, and the
 *  two halves of the nutrition assign path.
 *
 *  The fix is not more diligence at 84 call sites. It is one place that has to be
 *  right, which is the same principle as lib/access.ts holding the role sets: a
 *  rule kept in one file is kept, and a rule repeated in eighty-four is a rule
 *  that will drift.
 *
 *  HOW TO USE IT. Chain `.select('id')` onto the write and hand the whole
 *  builder over. PostgREST then returns the affected rows, and an empty array is
 *  a refusal the caller can say out loud:
 *
 *      return mustAffect(
 *        db.from('injuries').update({ status }).eq('id', id).select('id'),
 *        { refusal: 'Not saved: closing an injury belongs to the medic.' },
 *      );
 *
 *  WHEN NOT TO USE IT. Zero rows is only unambiguous when the write addresses a
 *  row that was just on screen. For a bulk update over a range, nothing changing
 *  can equally mean there was nothing to change, and asserting a refusal there
 *  produces a confident, wrong message. teamAllocation.publishWeek is the worked
 *  example: it asks a second question in that branch rather than guessing.
 *
 *  THE OTHER HALF OF THE PROBLEM, which this cannot fix. A screen that offers a
 *  control to a role the policy excludes is still wrong even when the refusal is
 *  reported honestly. That is why G-34 was fixed in two independent halves, and
 *  why the control's own condition resolves from lib/access.ts. This file makes
 *  the failure visible; it does not make the offer correct. */

type WriteOutcome = { data: unknown[] | null; error: { message: string } | null };

export type WriteResult = { error: string | null };

export type MustAffectOptions = {
  /** Shown when the write matched no row. Say who the action belongs to, not
   *  "permission denied": the person reading it wants to know who to ask. */
  refusal: string;
  /** Maps a real database error into something a person should read. Most
   *  callers pass humanizeDbError; without it the driver's own message is
   *  returned, which is the existing behaviour of every site being converted. */
  onError?: (message: string) => string;
};

/** Run a write that has `.select()` chained, and turn "no rows changed" into a
 *  stated refusal rather than a silent success. */
export async function mustAffect(
  run: PromiseLike<WriteOutcome>,
  opts: MustAffectOptions,
): Promise<WriteResult> {
  const { data, error } = await run;
  if (error) return { error: opts.onError ? opts.onError(error.message) : error.message };
  if (!data || data.length === 0) return { error: opts.refusal };
  return { error: null };
}

/** The same rule for call sites that throw rather than return an error, which
 *  is the older convention in this codebase (thresholds.ts, programmes.ts). Kept
 *  so converting one does not force a signature change on its callers, which
 *  would turn a safety fix into a refactor and make it harder to approve. */
export async function mustAffectOrThrow(
  run: PromiseLike<WriteOutcome>,
  refusal: string,
): Promise<void> {
  const { data, error } = await run;
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) throw new Error(refusal);
}
