/* PATTERN-S7 C1 (2026-09-13): the report catalogue's definition sentences,
 * one per report — the sentence that sits above the numbers on the report,
 * in the print view and in the exported file's header. It says what the
 * report measures, over what, and who is counted.
 *
 * docs/reports-catalogue.md is canonical; this mirrors its **Definition**
 * lines verbatim and scripts/test-report-catalogue.ts fails on drift. The
 * "Fydr report catalogue" the S7 prompt cites is not in the repository; when
 * it lands the doc is reconciled to it and this follows. */

import type { ReportKey } from '@/lib/access';

export const REPORT_DEFINITIONS: Record<ReportKey, string> = {
  compliance:
    'Who has submitted what was expected of them, and who has not — how much of the picture the club actually has, over the period and group chosen.',
  injuries:
    'Who is unavailable, why in limited terms, when they are expected back, and where injuries are happening, over the period and group chosen.',
  training:
    'How hard each session was for each athlete, judged against a typical session of the same kind for that athlete, from the GPS file for the session chosen.',
  athlete: 'Everything about one athlete over the period chosen, on one page, in a form that can be printed or handed over.',
  squad: "The squad's week on one page: who has trained how much, how that compares with their own normal, and who is carrying something.",
  testing: "Test results across the group chosen: where each athlete sits on one test, and what the group's middle looks like over time.",
};

export function reportDefinition(key: ReportKey): string {
  return REPORT_DEFINITIONS[key];
}
