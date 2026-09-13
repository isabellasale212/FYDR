/* PATTERN-S7 C1 (reconciled 2026-09-13): the report catalogue's definition
 * sentences — the sentence that sits above the numbers on the report, in the
 * print view and in the exported file's header.
 *
 * docs/reports-catalogue-source.md is Isabella's catalogue and the source of
 * truth; docs/reports-catalogue.md is the working copy reconciled against it,
 * and this mirrors the working copy verbatim (scripts/test-report-catalogue.ts
 * fails on drift). Null means the report carries no sentence yet:
 *   training — the confirmed sentence describes an RPE-load report, not the
 *              built GPS board; raised on the sheet.
 *   match    — on hold in the source until the "who played, minutes" question
 *              is ruled on. The answer is in the working catalogue.
 * compliance and injuries are the builder's drafts pending confirmation. */

import type { ReportKey } from '@/lib/access';

export const REPORT_DEFINITIONS: Record<ReportKey, string | null> = {
  compliance:
    'Who has submitted what was expected of them, and who has not — how much of the picture the club actually has, over the period and group chosen.',
  injuries:
    'Who is unavailable, why in limited terms, when they are expected back, and where injuries are happening, over the period and group chosen.',
  training: null,
  athlete: 'Everything recorded for {athlete} between {start} and {end}. Sections with no data say so rather than showing zeros.',
  squad: 'The week Monday to Sunday, club local time. Each section states its own denominator.',
  testing:
    'The most recent result for each test inside the period. A test with no result in the window is not shown as zero, and an athlete who has never been assigned a test does not appear for it.',
};

/** The sentence for a report, or null when it has none yet. The athlete
 *  report's is a template (see athleteDefinition). */
export function reportDefinition(key: Exclude<ReportKey, 'athlete'>): string | null {
  return REPORT_DEFINITIONS[key];
}

/** The athlete report's sentence, resolved for one athlete and one period —
 *  "Everything recorded for Dan Okonkwo between Mon 17 Aug and Sun 13 Sept. …" */
export function athleteDefinition(o: { athlete: string; start: string; end: string }): string {
  return REPORT_DEFINITIONS.athlete!.replace('{athlete}', o.athlete).replace('{start}', o.start).replace('{end}', o.end);
}
