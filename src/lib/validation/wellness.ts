import { z } from 'zod';

/* One schema, one shape, imported by the form, by the mutation and by any
 * server code that revalidates. screens/wellness-entry.md §Validation schema.
 *
 * Every 1 to 5 scale runs 5 = best, including soreness where 5 = no soreness.
 * CONTRACT.md rule 6. Nothing in this file inverts a scale and nothing
 * downstream may either. */

const scale = z.number().int().min(1).max(5);

/* ORDER IS DISPLAY ORDER, AND IT IS SHARED. Reordered 2026-09-08 to match the
   redesign reference: Sleep quality, Soreness, Fatigue, Mood, Stress.
   Previously sleep_quality, fatigue, soreness, stress, mood.

   EntryCorrectionPanel — the coach's correction form — maps this same constant,
   so its order moved with it. Deliberate rather than collateral: a coach
   correcting an entry should see the fields in the order the player answered
   them, and a second list for the athlete sheet is how the two would drift
   apart. Nothing else depends on the order — the unanswered count filters
   rather than indexes, and the database has a column per scale rather than an
   array — and no test pinned it before test-wellness-sheet-redesign. */
export const WELLNESS_SCALES = [
  'sleep_quality',
  'soreness',
  'fatigue',
  'mood',
  'stress',
] as const;

export type WellnessScale = (typeof WELLNESS_SCALES)[number];

/* THE TWO OPTIONAL NUMBERS' RANGES, NAMED ONCE. The schema below reads them,
   the check-in form's inline check reads them, and the helper text under each
   field is composed from them — so "Usually 25 to 120 bpm" cannot say one thing
   while the validator refuses another. The ATH-ADULT-03 board wrote its own
   ranges (30–120, 35–180) from nothing; Isabella's decision (2026-09-11) was
   that the copy states the validator's numbers, not the other way round. A
   range change is a data rule and belongs here, not in a string. */
export const RESTING_HR_RANGE = { min: 25, max: 120, unit: 'bpm', label: 'Resting heart rate' } as const;
export const BODY_MASS_RANGE = { min: 30, max: 200, unit: 'kg', label: 'Body mass' } as const;

export const WellnessEntryInput = z.object({
  id: z.string().uuid(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date'),
  sleep_hours: z.number().min(0).max(14).multipleOf(0.5),
  sleep_quality: scale,
  fatigue: scale,
  soreness: scale,
  soreness_areas: z.array(z.string().max(40)).max(12).nullable().optional(),
  stress: scale,
  mood: scale,
  resting_hr: z.number().int().min(RESTING_HR_RANGE.min).max(RESTING_HR_RANGE.max).nullable().optional(),
  body_mass_kg: z.number().min(BODY_MASS_RANGE.min).max(BODY_MASS_RANGE.max).multipleOf(0.1).nullable().optional(),
  comment: z.string().trim().max(500).nullable().optional(),
  revision_of: z.string().uuid().nullable().optional(),
});

export type WellnessEntryInput = z.infer<typeof WellnessEntryInput>;

type OptionalNumber = 'resting_hr' | 'body_mass_kg';
const RANGES = { resting_hr: RESTING_HR_RANGE, body_mass_kg: BODY_MASS_RANGE } as const;

/** The helper text under each optional field: "Usually 25 to 120 bpm". */
export function fieldHelp(field: OptionalNumber): string {
  const r = RANGES[field];
  return `Usually ${r.min} to ${r.max} ${r.unit}`;
}

/** The inline check the check-in form runs as the athlete types (C-e). Returns
 *  the sentence to show, or null when the field is empty or the value would
 *  pass the schema. It asks THE SCHEMA — the same field validator that runs at
 *  submit — so the inline check can never accept what the submit refuses; a
 *  live button that then fails with a generic message is the exact hole this
 *  closes. Empty is not a problem: both fields are optional. */
export function fieldProblem(field: OptionalNumber, raw: string): string | null {
  if (raw.trim() === '') return null;
  const ok = WellnessEntryInput.shape[field].safeParse(Number(raw)).success;
  if (ok) return null;
  const r = RANGES[field];
  return `Check this. ${r.label} is usually between ${r.min} and ${r.max} ${r.unit}.`;
}

/** The end labels. Both ends are always shown, because "5 = no soreness" is
 *  counter-intuitive and an unlabelled scale is a guess. */
export const SCALE_COPY: Record<
  WellnessScale,
  { label: string; low: string; high: string; words: readonly string[] }
> = {
  sleep_quality: {
    label: 'Sleep quality',
    low: 'Very poor',
    high: 'Very good',
    words: ['Very poor', 'Poor', 'All right', 'Good', 'Very good'],
  },
  fatigue: {
    label: 'Fatigue',
    low: 'Exhausted',
    high: 'Very fresh',
    words: ['Exhausted', 'Tired', 'All right', 'Fresh', 'Very fresh'],
  },
  soreness: {
    label: 'Soreness',
    low: 'Very sore',
    high: 'No soreness',
    words: ['Very sore', 'Sore', 'A bit sore', 'Almost none', 'No soreness'],
  },
  stress: {
    label: 'Stress',
    low: 'Very stressed',
    high: 'Very relaxed',
    words: ['Very stressed', 'Stressed', 'All right', 'Relaxed', 'Very relaxed'],
  },
  mood: {
    label: 'Mood',
    low: 'Very low',
    high: 'Very good',
    words: ['Very low', 'Low', 'All right', 'Good', 'Very good'],
  },
};
