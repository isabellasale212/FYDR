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

/** The training and match boards: who is on the board and who is not. A row
 *  exists only for an athlete with a GPS record for the session; the rest of
 *  the scope is not "zero", it is absent — said with its count. */
export function boardCoverageLine(o: { onBoard: number; inScope: number; noun: 'athletes' | 'played' }): string {
  const missing = Math.max(0, o.inScope - o.onBoard);
  const n = `n = ${o.onBoard} ${o.noun}`;
  if (o.inScope === 0) return n;
  if (missing === 0) return `${n} · every athlete in this filter has a GPS record for this session — nobody is excluded`;
  return `${n} · ${missing} of ${o.inScope} in this filter ${missing === 1 ? 'has' : 'have'} no GPS record for this session and ${missing === 1 ? 'is' : 'are'} not on the board`;
}

export const NO_GPS = 'No data';
export const NO_BEST_YET = 'No best yet';
export const NOT_SET = 'Not set';
export const RESULT_NOT_ENTERED = 'Result not entered';

/** The testing report's by-test ranking: who has a result for this test in
 *  the window, over the filter. */
export function rankedCoverageLine(o: { withResult: number; inScope: number; floored: boolean }): string {
  const missing = Math.max(0, o.inScope - o.withResult);
  const base =
    missing === 0
      ? `Every one of the ${o.inScope} athletes in this filter has a result for this test in this window — nobody is excluded.`
      : `${o.withResult} of ${o.inScope} athletes have a result for this test in this window; ${missing} ${missing === 1 ? 'has' : 'have'} none and ${missing === 1 ? 'is' : 'are'} not ranked.`;
  return o.floored ? `${base} Fewer than five have data, so the median and quartiles are not shown; the ranking is.` : base;
}
export const NO_RESULT = 'No result';
export const NOT_SHOWN = 'Not shown';
