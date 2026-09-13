/* PATTERN-S7 C1, the figure card (2026-09-13): the one emphasised figure each
 * report leads with — the count with its denominator BEFORE the percentage
 * ("8 of 380" then "2%"), then the sample (who, over what), then the
 * exclusions in a full sentence; "Nobody is excluded" when nothing is. The
 * sentences are lib/reportFigures.ts's (C2); this shapes them for the card.
 *
 * Pure; exercised by scripts/test-report-figure.ts. */

import { NOT_EXPECTED, exclusionsLine } from '@/lib/reportFigures';

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
