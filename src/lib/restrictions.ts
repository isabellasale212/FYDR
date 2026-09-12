/* The restriction line never names a protocol — PATTERN-S3 D1, enforced on
 * Isabella's decision 2026-09-12 ("a coach never reads a protocol stage").
 *
 * availability.restrictions is free text. The staff forms only ever write
 * from a fixed list ("no contact", "no collision drills", …), but the seed put
 * "return to play protocol, stage 3 of 6" there under a superseded reading of
 * the old roles document, and the allocation screen, the squad list, the
 * dashboard's Doubtful card and the athlete's own Today all rendered it. A
 * body area plus a stage is a diagnosis in two pieces; the stage is a
 * clinical fact and belongs in the clinical record (the medic's Stage row on
 * PATTERN-S3), nowhere else.
 *
 * So every read of the restriction line passes through here, for every
 * viewer — the line reads "No contact · No collision drills" everywhere
 * outside the clinical record. Applied at the query layer (one place per
 * table read), not per screen, so a new screen cannot forget it.
 */

const CLINICAL_TERMS = /protocol|\bstage\s*\d|diagnos|graduated return/i;

/** The entries a restriction line may carry, in order, with any that name a
 *  protocol, a stage or a diagnosis removed. */
export function restrictionLine(restrictions: readonly string[] | null | undefined): string[] {
  return (restrictions ?? []).filter((r) => !CLINICAL_TERMS.test(r));
}
