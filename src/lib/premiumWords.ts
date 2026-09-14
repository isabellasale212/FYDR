/* The words a base page uses where a premium region sits — D-20's second
 * half (docs/decisions/absence-rule.md; decision batch 14 September 2026):
 * a wholly premium DESTINATION disappears, a premium REGION inside an
 * otherwise-base page shows a card and never vanishes silently. One place
 * for the sentences so the report, its PDF and the plan page agree. */

/** The GPS region on the athlete report, as a card. */
export const GPS_REGION_BODY =
  'This athlete\u2019s GPS totals \u2014 sessions with data, total distance, high speed distance \u2014 come from the GPS import, which is part of the Premium plan. Nothing here is zero: the section is withheld on the Basic plan. Settings \u203a Plan lists what Premium contains.';

/** The same fact in one line, where a card would be too much (the Load
 *  card\u2019s stats row). */
export const GPS_REGION_NOTE = 'GPS totals are part of the Premium plan and are not shown on the Basic plan. Settings \u203a Plan lists what Premium contains.';

/** The PDF\u2019s line: the version that leaves the building says the same. */
export const GPS_REGION_PDF = 'GPS totals are part of the Premium plan and are not included on the Basic plan.';
