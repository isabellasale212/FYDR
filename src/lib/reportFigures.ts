/* PATTERN-S7 C2 (2026-09-13): "Every figure with its denominator and an
 * exclusions sentence; missing values as words; worst first." The sentences
 * a report's figure carries, so the six reports say the same things the
 * same way. Pure. */

/** The exclusions sentence under a figure: who was left out of the
 *  denominator and why, or that nobody was. */
export function exclusionsLine(o: { waivedAthletes: number; waivedDays: number; floored?: boolean }): string {
  if (o.floored) return 'Fewer than five athletes have data — the aggregate is not shown; the rows are.';
  if (o.waivedAthletes === 0) return 'Nobody is excluded.';
  const who = o.waivedAthletes === 1 ? '1 athlete is' : `${o.waivedAthletes} athletes are`;
  const days = o.waivedDays === 1 ? '1 waived day' : `${o.waivedDays} waived days`;
  return `${who} excluded on ${days} — a waiver is "was not asked", not "did not submit".`;
}

/** Missing values as words — never a dash standing in for a count. */
export const NOT_EXPECTED = 'Not expected';
export const NONE_WAIVED = 'None';
export const NO_ENTRY_IN_WINDOW = 'No entry in this window';
export const NOT_MEASURED = 'Not measured';
export const NO_POSITION = 'No position set';
export const SITE_NOT_RECORDED = 'Site not recorded';
export const RETURN_NOT_KNOWN = 'Return not known';

/** "24 of 30 submitted · 2 waived" — a count always carries its denominator;
 *  nothing expected is said, not "0 of 0". */
export function submittedLine(o: { submitted: number; expected: number; waived: number }): string {
  if (o.expected === 0 && o.waived === 0) return 'No expectations configured for this domain';
  if (o.expected === 0) return `Nothing expected · ${o.waived} waived`;
  return `${o.submitted} of ${o.expected} submitted${o.waived > 0 ? ` · ${o.waived} waived` : ''}`;
}

/** The injury report's availability figure: what the denominator counts and
 *  who it counts oddly — athletes with no recorded status (counted as
 *  available: the figure is built from injuries, not statuses) and athletes
 *  who joined inside the window (counted for the whole window). Said, not
 *  corrected — the number is MET-013's own. */
export function availabilityExclusionsLine(o: { notRecorded: number; joinedInPeriod: number }): string {
  const parts: string[] = [];
  if (o.notRecorded > 0) {
    parts.push(`${o.notRecorded} athlete${o.notRecorded === 1 ? ' has' : 's have'} no recorded status and ${o.notRecorded === 1 ? 'is' : 'are'} counted as available`);
  }
  if (o.joinedInPeriod > 0) {
    parts.push(`${o.joinedInPeriod} joined part-way through and ${o.joinedInPeriod === 1 ? 'is' : 'are'} counted for the whole window`);
  }
  if (parts.length === 0) return 'Nobody is excluded, and every athlete is counted for the whole window.';
  return `Nobody is excluded. ${parts.join('; ')}.`;
}
