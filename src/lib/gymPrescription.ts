/* The prescription line and the weight row's note, from one place — §0u
 * (2026-09-12). The logger's exercise head used to render
 * `{sets × reps} @ {loadLabel}`, and loadLabel returns a SENTENCE when there
 * is no load ("No 1RM test linked to this exercise yet."), so an athlete read
 * "3 × 8 @ No 1RM test linked to this exercise yet." — an instruction that
 * became an apology at the "@". The value and the reason are two different
 * things: the line carries a value or nothing, the weight row carries the
 * reason.
 */

import { formatDate } from '@/lib/format';

export type PrescriptionFields = {
  sets: number;
  reps_min: number | null;
  reps_max: number | null;
  rest_seconds: number | null;
  category: string;
  load_basis: 'none' | 'absolute' | 'percent_bw' | 'percent_1rm' | 'rpe';
  load_value: number | null;
  resolved_load_kg: number | null;
  one_rm_linked: boolean;
  one_rm_test_date: string | null;
};

/** The prescribed load as a value, or null when there is none to state. */
export function loadValue(ex: PrescriptionFields, timezone: string): string | null {
  if (ex.load_basis === 'none') return null;
  if (ex.load_basis === 'absolute') {
    if (ex.load_value === null) return null;
    const bare = ex.category === 'plyo' || ex.category === 'conditioning' || ex.category === 'mobility';
    return bare ? String(ex.load_value) : `${ex.load_value} kg`;
  }
  if (ex.load_basis === 'percent_bw') return ex.load_value !== null ? `${ex.load_value}% bodyweight` : null;
  if (ex.load_basis === 'rpe') return ex.load_value !== null ? `Target RPE ${ex.load_value}` : null;
  // percent_1rm, resolved (migration 0043) against the athlete's own latest
  // 1RM test result — a real number, never estimated (O-389 stays open on
  // purpose).
  if (ex.resolved_load_kg !== null) {
    return `${ex.resolved_load_kg} kg (${ex.load_value}% of your 1RM${ex.one_rm_test_date ? `, tested ${formatDate(ex.one_rm_test_date, timezone)}` : ''})`;
  }
  return null;
}

/** The weight row's note: the value when there is one, else why there is
 *  none — in one of the distinct honest shapes. Missing means missing: the
 *  exercise has no 1RM test linked at all, or it does and this athlete has
 *  no result on file yet (screens/gym-logging.md's own copy, verbatim). */
export function loadLabel(ex: PrescriptionFields, timezone: string): string {
  const value = loadValue(ex, timezone);
  if (value !== null) return value;
  if (ex.load_basis === 'none') return 'No prescribed load';
  if (ex.load_basis === 'absolute') return 'Load not set';
  if (ex.load_basis === 'percent_bw') return 'Not set';
  if (ex.load_basis === 'rpe') return 'Target RPE not set';
  if (!ex.one_rm_linked) return 'No 1RM test linked to this exercise yet.';
  return 'No one rep max on file. Log the load you lift.';
}

export function schemeLabel(ex: Pick<PrescriptionFields, 'sets' | 'reps_min' | 'reps_max'>): string {
  const reps =
    ex.reps_max !== null && ex.reps_max !== ex.reps_min ? `${ex.reps_min}–${ex.reps_max}` : `${ex.reps_min ?? '?'}`;
  return `${ex.sets} × ${reps}`;
}

/** The exercise head's line: the scheme, the load only when it is a value,
 *  the rest when there is one. */
export function schemeLine(ex: PrescriptionFields, timezone: string): string {
  const value = loadValue(ex, timezone);
  return `${schemeLabel(ex)}${value ? ` @ ${value}` : ''}${ex.rest_seconds ? ` · ${ex.rest_seconds}s rest` : ''}`;
}
