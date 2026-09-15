/* PATTERN-S7 C1 (reconciled 2026-09-13, and again against the source's
 * 13 September addendum): the report catalogue's definition sentences — the
 * sentence that sits above the numbers on the report, in the print view and
 * in the exported file's header.
 *
 * docs/reports-catalogue-source.md is Isabella's catalogue and the source of
 * truth; docs/reports-catalogue.md is the working copy reconciled against it,
 * and this mirrors the working copy verbatim (scripts/test-report-catalogue.ts
 * fails on drift). Every sentence here is confirmed; none is a draft.
 *
 * The addendum split the training report in two: the per-session GPS board
 * is the GPS report (premium, `gps`, /reports/gps) and the RPE × minutes
 * Training load report (every club) is the seventh, `trainingLoad`,
 * /reports/training-load, with its own off state for a club that does not
 * collect RPE. The GPS match board (`/reports/gps?mode=match`) stays without a
 * sentence. The MATCH REPORT — the post-match sheet read as a report, the
 * eighth, every club, /reports/match — has its own sentence, confirmed by
 * Isabella in docs/decisions/decision-batch-2026-09-13.md ("The match report,
 * both halves approved"), which supersedes the source's draft; it lives in
 * lib/matchReport.ts and is mirrored here. */

import type { ReportKey } from '@/lib/access';
import { MATCH_DEFINITION } from '@/lib/matchReport';

export const REPORT_DEFINITIONS: Record<ReportKey, string | null> = {
  compliance:
    "The share of expected entries that were submitted, over the period. An entry counts as expected only where the schedule or the club's settings asked for one, so a day nobody was asked about is not counted against anybody.",
  injuries:
    "Every injury open at any point in the period, with each athlete's availability as it stands today. Diagnosis, mechanism and severity appear only in the medic's copy; clinical notes are in no export.",
  gps: 'Per-session GPS totals for each athlete, from the files imported for that session. An athlete with no GPS file for a session shows as no record, never as zero.',
  trainingLoad:
    'Session load is RPE multiplied by session minutes, summed over the period. Only sessions an athlete was expected at are counted, and a session with no rating is not counted as zero.',
  athlete: 'Everything recorded for {athlete} between {start} and {end}. Sections with no data say so rather than showing zeros.',
  squad: 'The week Monday to Sunday, club local time. Each section states its own denominator.',
  testing:
    'The most recent result for each test inside the period. A test with no result in the window is not shown as zero, and an athlete who has never been assigned a test does not appear for it.',
  match: MATCH_DEFINITION,
};

/** The seventh report (the addendum): RPE × minutes, every club. The same
 *  sentence as the `trainingLoad` row above, named for the callers that read
 *  it without a key. */
export const TRAINING_LOAD_DEFINITION = REPORT_DEFINITIONS.trainingLoad!;

/** Its off state, since RPE is a club setting (the addendum, and
 *  docs/decisions/absence-rule.md: setting-driven absence keeps the
 *  destination and names the setting and who can change it). */
export const TRAINING_LOAD_OFF_STATE =
  'This club does not collect session RPE, so there is no load to report. A sport scientist can switch it on in Settings.';

/** The sentence for a report, or null when it has none yet. The athlete
 *  report's is a template (see athleteDefinition). */
export function reportDefinition(key: Exclude<ReportKey, 'athlete' | 'match'>): string | null {
  return REPORT_DEFINITIONS[key];
}

/** The match report's sentence, resolved for one fixture — "Everything
 *  recorded against v Harlequins, Sat 18 Jul: …" (lib/matchReport). */
export { matchDefinition } from '@/lib/matchReport';

/** The athlete report's sentence, resolved for one athlete and one period —
 *  "Everything recorded for Dan Okonkwo between Mon 17 Aug and Sun 13 Sept. …" */
export function athleteDefinition(o: { athlete: string; start: string; end: string }): string {
  return REPORT_DEFINITIONS.athlete!.replace('{athlete}', o.athlete).replace('{start}', o.start).replace('{end}', o.end);
}
