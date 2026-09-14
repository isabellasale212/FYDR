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

/** A GPS flag a downgraded club still sees: raised while the club was on
 *  Premium, the rule behind it dormant now (0119 returns it no rows). The
 *  domain word carries the note (decision batch, 14 September 2026); the
 *  "your history is kept" sentence belongs on the plan page, not here. */
export const GPS_FLAG_PLAN_NOTE = 'GPS \u00b7 Premium rule, dormant on the Basic plan';

/** The domain word for a flag, on this club's plan. */
export function flagDomainWord(domainWord: string, domain: string, premium: boolean): string {
  return domain === 'gps' && !premium ? GPS_FLAG_PLAN_NOTE : domainWord;
}

/** What the Premium plan contains — the inventory (the premium contents
 *  report, 14 September 2026; docs/12-product-tiers.md §3). One list, read by
 *  the plan page and the club card's compare columns, so they cannot drift.
 *  Everything not here is in both plans. */
export const PREMIUM_INVENTORY: readonly { label: string; sentence: string }[] = [
  { label: 'GPS import', sentence: 'Vendor CSV and XLSX files, matched to athletes and sessions, with held rows and aliases. The hook everything below rests on.' },
  { label: 'GPS report', sentence: 'Every GPS measure per athlete per session, with the squad band, exports and print.' },
  { label: 'GPS on the athlete report', sentence: 'The athlete report\u2019s GPS section: sessions with data, total distance, high speed distance.' },
  { label: 'GPS leaderboards', sentence: 'Boards ranked on a GPS measure. Boards on every other measure are in both plans.' },
  { label: 'GPS flags and thresholds', sentence: 'Rules on a GPS measure, and the flags they raise.' },
  { label: 'Analytics', sentence: 'The four panels \u2014 training load with session load or any GPS measure, wellness, gym volume, acute to chronic \u2014 one athlete against the squad, or two side by side. The whole destination.' },
  { label: 'Named support', sentence: 'A named contact and a response commitment. Basic has best-effort support, stated plainly.' },
];

/** The price is not decided. A placeholder, drawn as one, never a number. */
export const PRICE_PLACEHOLDER = 'Price \u2014 not yet decided. It is set before the plan is sold; nothing here is a quote.';
