/* PATTERN-S7 C1, the figure card (2026-09-13): the one emphasised figure each
 * report leads with — the count with its denominator BEFORE the percentage
 * ("8 of 380" then "2%"), then the sample (who, over what), then the
 * exclusions in a full sentence; "Nobody is excluded" when nothing is. The
 * sentences are lib/reportFigures.ts's (C2); this shapes them for the card.
 *
 * Pure; exercised by scripts/test-report-figure.ts. */

import { NOT_EXPECTED, availabilityExclusionsLine, exclusionsLine } from '@/lib/reportFigures';

export type ReportFigureCopy = {
  label: string;
  count: string;
  value: string;
  sample: string;
  exclusions: string;
};

/** Compliance: submitted of expected, summed over the domains that expect
 *  anything at all — a domain with nothing configured is not a zero in the
 *  denominator, it is left out and the sample says how many count. */
export function complianceFigure(o: {
  summary: readonly { domain: string; expected: number; submitted: number; waived: number; pct: number | null }[];
  athleteCount: number;
  rangeLabel: string;
  waivedAthletes: number;
  waivedDays: number;
  floored: boolean;
}): ReportFigureCopy {
  const counting = o.summary.filter((s) => s.expected > 0);
  const expected = counting.reduce((n, s) => n + s.expected, 0);
  const submitted = counting.reduce((n, s) => n + s.submitted, 0);
  const pct = expected > 0 ? Math.round((100 * submitted) / expected) : null;
  return {
    label: 'Submitted of expected',
    count: expected > 0 ? `${submitted} of ${expected}` : 'Nothing expected',
    value: pct === null ? NOT_EXPECTED : `${pct}%`,
    sample:
      o.athleteCount === 0
        ? `Nobody in this filter · ${o.rangeLabel.toLowerCase()}`
        : `${o.athleteCount} athlete${o.athleteCount === 1 ? '' : 's'} · ${o.rangeLabel.toLowerCase()} · ${counting.length} of ${o.summary.length} domains expected`,
    exclusions: exclusionsLine({ waivedAthletes: o.waivedAthletes, waivedDays: o.waivedDays, floored: o.floored }),
  };
}

/** Injury and availability: available now of the squad in scope — the
 *  report's headline by the board's own account ("Who is unavailable…"),
 *  the count before the percentage, today's roster as the sample, C2's
 *  availability exclusions as the sentence. Days lost and new injuries stay
 *  in the strip beneath. */
export function availabilityFigure(o: {
  availableNow: number;
  athleteCount: number;
  rangeLabel: string;
  notRecorded: number;
  joinedInPeriod: number;
}): ReportFigureCopy {
  const pct = o.athleteCount > 0 ? Math.round((100 * o.availableNow) / o.athleteCount) : null;
  return {
    label: 'Available now',
    count: o.athleteCount > 0 ? `${o.availableNow} of ${o.athleteCount}` : 'Nobody in this filter',
    value: pct === null ? 'Not measured' : `${pct}%`,
    sample: o.athleteCount > 0 ? `${o.athleteCount} athlete${o.athleteCount === 1 ? '' : 's'} on today's roster · ${o.rangeLabel.toLowerCase()} for the days lost beneath` : `${o.rangeLabel.toLowerCase()}`,
    exclusions: availabilityExclusionsLine({ notRecorded: o.notRecorded, joinedInPeriod: o.joinedInPeriod }),
  };
}

/** The training and match boards: athletes on the board of those in scope —
 *  who has a GPS record for this session. The count before the percentage;
 *  the session as the sample; C2's coverage clause as the exclusions, with
 *  the squad floor when shading is off. */
export function boardFigure(o: {
  onBoard: number;
  inScope: number;
  session: string;
  dateLabel: string;
  noun: 'athletes' | 'played';
  floored: boolean;
}): ReportFigureCopy {
  const missing = Math.max(0, o.inScope - o.onBoard);
  const pct = o.inScope > 0 ? Math.round((100 * o.onBoard) / o.inScope) : null;
  const exclusions =
    o.inScope === 0
      ? 'Nobody in this filter.'
      : missing === 0
        ? 'Every athlete in this filter has a GPS record for this session — nobody is excluded.'
        : `${missing} of ${o.inScope} in this filter ${missing === 1 ? 'has' : 'have'} no GPS record for this session and ${missing === 1 ? 'is' : 'are'} not on the board.`;
  return {
    label: o.noun === 'played' ? 'Played, on the board' : 'On the board',
    count: o.inScope > 0 ? `${o.onBoard} of ${o.inScope}` : 'Nobody in this filter',
    value: pct === null ? 'Not measured' : `${pct}%`,
    sample: `${o.session} · ${o.dateLabel}`,
    exclusions: o.floored ? `${exclusions} Fewer than five have data, so shading is off; the numbers are unchanged.` : exclusions,
  };
}
