/* ACWR — the one place the acute:chronic workload ratio is defined.
 *
 * Before this module existed the same maths lived in four copies
 * (analytics.ts, athleteReport.ts, playerProfile.ts, and squadWeeklyReport.ts
 * consuming analytics'), each with its own hardcoded band and its own
 * suppression copy — and the app told four contradictory ACWR stories at
 * once (audit finding S1: a flag fired at 1.24 against a thresholds screen
 * saying 1.3, profiles said "flags above 1.50", reports drew a 0.8–1.5 band,
 * and analytics said nobody was computable). Every surface that computes,
 * bands, or explains ACWR must go through this module so those numbers can
 * never drift apart again.
 *
 * Three distinct numbers, kept deliberately distinct:
 *
 *  - THE COMPUTATION: acute = trailing 7-day sum of session_load, chronic =
 *    trailing 28-day sum normalised to a weekly figure (÷ 4). Source:
 *    training_entries_current, summed per entry_date.
 *  - THE GUARD: suppressed below 21 of the 28 chronic days having any entry
 *    at all (screens/analytics.md's own rule). A suppressed athlete has NO
 *    ratio — not an estimated one, not a hidden one. Any future flag engine
 *    must compute through computeAcwr(); a value this module nulls out is a
 *    value nothing downstream is allowed to fire on or display.
 *  - THE BAND vs THE FLAG RULE: 0.8–1.5 is the commonly-cited descriptive
 *    "sweet spot" band, a display convention (the analytics page's caveat —
 *    the audit's exemplary copy — says exactly this). It is NOT the flag
 *    threshold. The flag threshold is whatever the org's active `load.acwr`
 *    row in `thresholds` says (seeded: above 1.30, severity high, with the
 *    athlete's own 28-day average recorded on each flag as context — see
 *    docs/screens/thresholds.md's evaluation SQL: an `above` rule is an
 *    absolute cutoff regardless of baseline_type). Surfaces quoting "flags
 *    above X" must read X from that threshold row, never hardcode it.
 */

export const ACWR_ACUTE_WINDOW_DAYS = 7;
export const ACWR_CHRONIC_WINDOW_DAYS = 28;

/** The data-sufficiency guard: fewer than this many of the trailing 28 days
 *  with a training entry means no ratio is computed anywhere. */
export const ACWR_MIN_DAYS_WITH_DATA = 21;

/** The descriptive sweet-spot band — a display convention, not the flag
 *  rule. The org's real flag rule lives in the `thresholds` table. */
export const ACWR_BAND_LOW = 0.8;
export const ACWR_BAND_HIGH = 1.5;

/** "0.8–1.5", with the same en-dash everywhere it is printed. */
export const ACWR_BAND_TEXT = `${ACWR_BAND_LOW}–${ACWR_BAND_HIGH}`;

export type AcwrComputation = {
  acute: number | null;
  chronic: number | null;
  acwr: number | null;
  suppressed: boolean;
  daysWithData: number;
};

/** The computation, from per-day summed loads. `loadByDate` must already be
 *  restricted to the trailing 28-day window ending on the reference day;
 *  `acuteFrom` is the first date of the trailing 7-day window (inclusive). */
export function computeAcwr(loadByDate: ReadonlyMap<string, number>, acuteFrom: string): AcwrComputation {
  const daysWithData = loadByDate.size;
  const suppressed = daysWithData < ACWR_MIN_DAYS_WITH_DATA;
  if (suppressed) {
    return { acute: null, chronic: null, acwr: null, suppressed, daysWithData };
  }
  const chronic = [...loadByDate.values()].reduce((s, v) => s + v, 0) / 4;
  const acute = [...loadByDate.entries()].filter(([d]) => d >= acuteFrom).reduce((s, [, v]) => s + v, 0);
  return {
    acute,
    chronic,
    acwr: chronic !== 0 ? acute / chronic : null,
    suppressed,
    daysWithData,
  };
}

/** Convenience: per-day load map from raw entry rows (a view types every
 *  column nullable, so nulls are skipped here once, not at every call site). */
export function loadByDateFrom(
  entries: readonly { entry_date: string | null; session_load: number | null }[],
): Map<string, number> {
  const loadByDate = new Map<string, number>();
  for (const e of entries) {
    if (e.entry_date === null || e.session_load === null) continue;
    loadByDate.set(e.entry_date, (loadByDate.get(e.entry_date) ?? 0) + e.session_load);
  }
  return loadByDate;
}

export function acwrWithinBand(acwr: number): boolean {
  return acwr >= ACWR_BAND_LOW && acwr <= ACWR_BAND_HIGH;
}

/** Pill tone for a computed ratio, shared by the squad weekly page and its
 *  PDF so a number is never green on one and amber on the other. The inner
 *  0.9–1.3 comfort zone is a rendering nuance of the same band, not a
 *  second band. */
export function acwrBandTone(acwr: number | null): 'good' | 'warn' | 'bad' | 'neutral' {
  if (acwr === null) return 'neutral';
  if (!acwrWithinBand(acwr)) return 'bad';
  if (acwr < 0.9 || acwr > 1.3) return 'warn';
  return 'good';
}

/** The one short insufficiency status, identical on every surface that has
 *  room for a phrase (profile dial, report tiles): what is missing and how
 *  far along it is. */
export function acwrSuppressedLabel(daysWithData: number): string {
  return `Building baseline · ${daysWithData} of ${ACWR_MIN_DAYS_WITH_DATA} days`;
}

/** The one long insufficiency explanation, identical on every surface that
 *  has room for a sentence (analytics empty state, report captions). */
export function acwrInsufficiencyNote(daysWithData?: number): string {
  const base = `Needs ${ACWR_MIN_DAYS_WITH_DATA} of ${ACWR_CHRONIC_WINDOW_DAYS} trailing days`;
  return daysWithData === undefined ? `${base}.` : `${base}; ${daysWithData} on record.`;
}

/** Squad-level headline for the ratio: never "0 outside the band" when the
 *  real story is that nobody was computable (audit S1 / blocker B4's
 *  false-reassurance). */
export function acwrSquadHeadline(outsideBand: number, computable: number, suppressed: number): string {
  if (computable === 0) {
    return `0 computable · ${suppressed} suppressed`;
  }
  return `${outsideBand} of ${computable} computable outside ${ACWR_BAND_TEXT} · ${suppressed} suppressed`;
}
