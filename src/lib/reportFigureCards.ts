/* PATTERN-S7 C1, the figure card (2026-09-13): the one emphasised figure each
 * report leads with — the count with its denominator BEFORE the percentage
 * ("8 of 380" then "2%"), then the sample (who, over what), then the
 * exclusions in a full sentence; "Nobody is excluded" when nothing is. The
 * sentences are lib/reportFigures.ts's (C2); this shapes them for the card.
 *
 * Pure; exercised by scripts/test-report-figure.ts. */

import { complianceCountedLine } from '@/lib/rpeSetting';
import { NOT_EXPECTED, availabilityExclusionsLine, exclusionsLine, rankedCoverageLine } from '@/lib/reportFigures';

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
  /** The RPE club setting (0118). The addendum's rule: the figure states
   *  which entry types it counted, because one club's denominator is not
   *  another's once RPE can be off. Default true for callers that predate it. */
  collectsRpe?: boolean;
}): ReportFigureCopy {
  const counting = o.summary.filter((s) => s.expected > 0);
  const expected = counting.reduce((n, s) => n + s.expected, 0);
  const submitted = counting.reduce((n, s) => n + s.submitted, 0);
  const pct = expected > 0 ? Math.round((100 * submitted) / expected) : null;
  const counted = complianceCountedLine({ collectsRpe: o.collectsRpe ?? true, domains: counting.map((s) => s.domain) });
  return {
    label: 'Submitted of expected',
    count: expected > 0 ? `${submitted} of ${expected}` : 'Nothing expected',
    value: pct === null ? NOT_EXPECTED : `${pct}%`,
    sample:
      o.athleteCount === 0
        ? `Nobody in this filter · ${o.rangeLabel.toLowerCase()}`
        : `${o.athleteCount} athlete${o.athleteCount === 1 ? '' : 's'} · ${o.rangeLabel.toLowerCase()} · ${counting.length} of ${o.summary.length} domains expected`,
    exclusions: `${counted} ${exclusionsLine({ waivedAthletes: o.waivedAthletes, waivedDays: o.waivedDays, floored: o.floored })}`,
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

/** The athlete report: one athlete's compliance — met of expected across the
 *  domains, the count before the percentage, the athlete and the period as
 *  the sample, their waived days as the exclusions. */
export function athleteComplianceFigure(o: { met: number; expected: number; waived: number; firstName: string; rangeLabel: string }): ReportFigureCopy {
  const pct = o.expected > 0 ? Math.round((100 * o.met) / o.expected) : null;
  return {
    label: 'Submitted of expected',
    count: o.expected > 0 ? `${o.met} of ${o.expected}` : o.waived > 0 ? 'Nothing expected' : 'Nothing expected',
    value: pct === null ? NOT_EXPECTED : `${pct}%`,
    sample: `${o.firstName} · ${o.rangeLabel.toLowerCase()} · every domain expected of them`,
    exclusions:
      o.waived > 0
        ? `${o.waived} waived ${o.waived === 1 ? 'day is' : 'days are'} excluded — a waiver is "was not asked", not "did not submit".`
        : 'Nothing is excluded — no day was waived.',
  };
}

/** Squad weekly: the week's wellness compliance — submitted of expected, the
 *  count before the percentage; the squad, the week and the change on last
 *  week as the sample; C2's waiver sentence as the exclusions. */
export function squadComplianceFigure(o: {
  submitted: number;
  expected: number;
  waived: number;
  waivedAthletes: number;
  athleteCount: number;
  weekLabel: string;
  deltaText: string | null;
}): ReportFigureCopy {
  const pct = o.expected > 0 ? Math.round((100 * o.submitted) / o.expected) : null;
  return {
    label: 'Wellness compliance',
    count: o.expected > 0 ? `${o.submitted} of ${o.expected}` : 'Nothing expected',
    value: pct === null ? NOT_EXPECTED : `${pct}%`,
    sample: `${o.athleteCount} athlete${o.athleteCount === 1 ? '' : 's'} · ${o.weekLabel}${o.deltaText ? ` · ${o.deltaText} on last week` : ''}`,
    exclusions: exclusionsLine({ waivedAthletes: o.waivedAthletes, waivedDays: o.waived }),
  };
}

/** The testing report's by-test tab: athletes with a result of those in
 *  scope, for the test chosen, in the window. The count before the
 *  percentage; the test and the period as the sample; C2's ranked-coverage
 *  sentence as the exclusions (who has none and is not ranked, and the squad
 *  floor when it applies). */
export function testCoverageFigure(o: { withResult: number; inScope: number; testName: string; rangeLabel: string; floored: boolean }): ReportFigureCopy {
  const pct = o.inScope > 0 ? Math.round((100 * o.withResult) / o.inScope) : null;
  return {
    label: 'Athletes with a result',
    count: o.inScope > 0 ? `${o.withResult} of ${o.inScope}` : 'Nobody in this filter',
    value: pct === null ? 'Not measured' : `${pct}%`,
    sample: `${o.testName} · ${o.rangeLabel.toLowerCase()}`,
    exclusions: o.inScope > 0 ? rankedCoverageLine({ withResult: o.withResult, inScope: o.inScope, floored: o.floored }) : 'Nobody in this filter.',
  };
}

/** The Training load report (the seventh, 13 September 2026): rated of
 *  expected — the sessions the load is summed over, the count before the
 *  percentage — with the squad's summed load as the value's companion in
 *  the sample, and the unrated sessions as the exclusions, said the way the
 *  definition sentence says it: not counted as zero. A club with no ratings
 *  at all reads "No ratings", never 0. */
export function trainingLoadFigure(o: {
  expected: number;
  rated: number;
  totalLoad: number | null;
  athleteCount: number;
  rangeLabel: string;
  floored: boolean;
}): ReportFigureCopy {
  const unrated = Math.max(0, o.expected - o.rated);
  const pct = o.expected > 0 ? Math.round((100 * o.rated) / o.expected) : null;
  const load = o.totalLoad === null ? 'No ratings' : `${Math.round(o.totalLoad).toLocaleString('en-GB')} AU`;
  const exclusions =
    o.athleteCount === 0
      ? 'Nobody in this filter.'
      : o.expected === 0
        ? 'Nothing is excluded — no session expected a rating in this period.'
        : unrated === 0
          ? 'Nothing is excluded — every expected session was rated.'
          : `${unrated} expected session${unrated === 1 ? '' : 's'} with no rating ${unrated === 1 ? 'is' : 'are'} not counted as zero — ${unrated === 1 ? 'it is' : 'they are'} left out of every sum.`;
  return {
    label: 'Sessions rated of expected',
    count: o.expected > 0 ? `${o.rated} of ${o.expected}` : 'Nothing expected',
    value: pct === null ? NOT_EXPECTED : `${pct}%`,
    sample:
      o.athleteCount === 0
        ? `Nobody in this filter · ${o.rangeLabel.toLowerCase()}`
        : `${o.athleteCount} athlete${o.athleteCount === 1 ? '' : 's'} · ${o.rangeLabel.toLowerCase()} · squad load ${load}`,
    exclusions: o.floored ? `${exclusions} Fewer than five athletes have a rating, so no mean is drawn.` : exclusions,
  };
}
