import { z } from 'zod';

/* The staff-side correction shapes. Separate from validation/wellness.ts and
 * validation/training.ts on purpose, and the difference is the point.
 *
 * Those two schemas describe a SUBMISSION — an athlete answering every question on a
 * form, once, for a day. `WellnessEntryInput` therefore requires all six values plus an
 * `id` and an `entry_date`, and `TrainingEntryInput` requires a `session_id`. None of
 * that applies to a correction: `revise_wellness_entry` and `revise_training_entry`
 * (migrations 0010 and 0058) mint the new row's id themselves and COPY entry_date,
 * athlete_id, org_id and session_id from the original, precisely so a correction can
 * never move an entry to another day, athlete, club or session (ADR-005 rule 2). Sending
 * those fields would be sending values the database is contractually going to ignore.
 *
 * So a correction payload is exactly the mutable measurements, and every one of them is
 * optional: the RPCs `coalesce` each field against the original, which means "leave this
 * alone" is expressible as absence. A coach fixing one mis-typed sleep value should not
 * have to restate the other five.
 *
 * The bounds below are the same bounds the athlete forms enforce, restated rather than
 * imported, with two deliberate exceptions noted on `sleep_hours` and `rpe`. Both
 * exceptions are the same exception: the athlete's control is coarser than the column,
 * and a correction has to be able to send back a value the column already holds. */

const scale = z.number().int().min(1).max(5);

export const WellnessCorrection = z
  .object({
    /* One decimal place, where the athlete's stepper offers half hours (validation/
     * wellness.ts keeps `multipleOf(0.5)`, correctly — it describes that stepper).
     * `wellness_entries.sleep_hours` is `numeric(3,1)` and real rows carry finer
     * decimals than the stepper can express: the seed rounds to 1dp (seed.sql:437-442)
     * and the flag seed carries 7.900/5.200.
     *
     * Half-hour steps here caused a real, live bug rather than a theoretical one. The
     * correction form prefills from the stored value, so a row holding 7.9 put 7.9 in
     * the box and then failed the very schema that filled it — the same failure
     * CheckInForm's old correction mode hit and rescued by rounding the prefill
     * ("e.g. 7.9 … Caught live", removed with that mode). Rounding is the wrong rescue
     * on a form that diffs every field against the original: 7.9 rounded to 8.0 reads
     * as a change the coach never made, and would write a fabricated sleep value into
     * an immutable revision. Matching the column instead is exact and loses nothing —
     * every half hour is also a tenth of an hour, so nothing the athlete form can
     * produce is excluded. */
    sleep_hours: z.number().min(0).max(14).multipleOf(0.1),
    sleep_quality: scale,
    fatigue: scale,
    soreness: scale,
    stress: scale,
    mood: scale,
  })
  .partial()
  /* An empty correction is not a correction. Without this, "Save" on an untouched form
   * would close the original and insert a byte-identical revision — a chain link that
   * records nothing, on a screen whose entire purpose is to make corrections legible. */
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Nothing was changed.',
  });

export type WellnessCorrection = z.infer<typeof WellnessCorrection>;

export const TrainingCorrection = z
  .object({
    /* Half steps allowed here, where the athlete's own CR10 grid offers whole numbers
     * only (O-411). `training_entries.rpe` is numeric(3,1) and real rows in this
     * database carry halves — staff-entered and GPS-imported ones. A coach correcting a
     * 7.5 must be able to send 7.5 back; forcing the athlete screen's whole-number rule
     * onto the correction path would silently round real data every time somebody fixed
     * an unrelated duration on the same row. */
    rpe: z.number().min(1).max(10).multipleOf(0.5),
    duration_min: z.number().int().min(1).max(600),
  })
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), {
    message: 'Nothing was changed.',
  });

export type TrainingCorrection = z.infer<typeof TrainingCorrection>;
