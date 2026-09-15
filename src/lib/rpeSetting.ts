/* The RPE club setting (Isabella, 2026-09-13; migration 0118). One place for
 * the words every dependent surface says when it is off — the absence rule
 * (docs/decisions/absence-rule.md): setting-driven absence keeps the
 * destination and carries an off state naming the setting and who can
 * change it. Never an empty column, never a zero. Pure. */

/** The addendum's confirmed off state for the Training load report. */
export const RPE_OFF_REPORT =
  'This club does not collect session RPE, so there is no load to report. A sport scientist can switch it on in Settings.';

/** The same fact, for a surface that is not the report. `what` is the thing
 *  that has nothing to show: "the RPE track", "this board", "the load presets". */
export function rpeOffLine(what: string): string {
  return `This club does not collect session RPE, so ${what} has nothing to show. A sport scientist can switch it on in Settings › Club.`;
}

/** The athlete's own words, on Today and on the rating screen. */
export const RPE_OFF_ATHLETE = 'Your club does not collect session ratings, so there is nothing to rate. Your sessions still count.';

/** The switch's own two consequences, said before it is pressed. */
export const RPE_SWITCH_ON = 'On: athletes are asked for a session RPE after training — one rating of each session they were expected at, on the CR-10 scale (0 rest to 10 maximal); session load, the compliance figure, the training load report, the effort leaderboards and the analytics load presets all rest on it.';
export const RPE_SWITCH_OFF = 'Off: nobody is asked for a session RPE, no rating is expected of anybody, and the training load report, the compliance figure, the dashboard’s RPE track, the effort leaderboards and the analytics load presets each say so instead of showing an empty column or a zero. Ratings already recorded stay.';
/** Decision batch 14 September 2026, #4: the setting's own wording must say
 *  what it does not cover, or a club that switches it off and is still asked
 *  in the gym reports it as a bug. The per-set RPE in the gym logger and a
 *  programme's planned RPE are a lifting cue between an athlete and their
 *  S&C; they feed none of the surfaces above and stay outside this switch. */
export const RPE_SWITCH_SCOPE = 'This is the session RPE after training. The per-set RPE in the gym logger and a programme’s planned RPE are a lifting cue between an athlete and their S&C, feed none of the above, and are not switched off here.';

/** The compliance report's rule (the addendum): say which entry types were
 *  counted, because one club's denominator is not another's. */
export function complianceCountedLine(o: { collectsRpe: boolean; domains: readonly string[] }): string {
  const names = o.domains.map((d) => (d === 'wellness' ? 'wellness check-ins' : d === 'training_rpe' ? 'session ratings' : d === 'gym' ? 'gym sessions' : d === 'nutrition' ? 'nutrition check-ins' : d));
  const counted = names.length > 0 ? `Counted: ${names.join(', ')}.` : 'Nothing was expected in this period.';
  return o.collectsRpe ? counted : `${counted} Session ratings are not counted: this club does not collect session RPE (Settings › Club).`;
}

/** The leaderboard metrics that rest on the athlete's rating: session load
 *  is RPE × minutes (0016's dispatcher). Attendance is not. */
export function isRpeMetric(metricKey: string): boolean {
  return metricKey === 'training.total_session_load';
}

/** The analytics builder's metrics that rest on the rating: session RPE
 *  itself, training load (RPE × minutes) and ACWR (a ratio of loads).
 *  GPS distance, gym volume and every wellness metric do not. */
export function isRpeAnalyticsMetric(metricKey: string): boolean {
  return metricKey === 'rpe' || metricKey === 'load' || metricKey === 'acwr';
}
