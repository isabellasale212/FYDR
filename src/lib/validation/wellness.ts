import { z } from 'zod';

/* One schema, one shape, imported by the form, by the mutation and by any
 * server code that revalidates. screens/wellness-entry.md §Validation schema.
 *
 * Every 1 to 5 scale runs 5 = best, including soreness where 5 = no soreness.
 * CONTRACT.md rule 6. Nothing in this file inverts a scale and nothing
 * downstream may either. */

const scale = z.number().int().min(1).max(5);

export const WELLNESS_SCALES = [
  'sleep_quality',
  'fatigue',
  'soreness',
  'stress',
  'mood',
] as const;

export type WellnessScale = (typeof WELLNESS_SCALES)[number];

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
  resting_hr: z.number().int().min(25).max(120).nullable().optional(),
  body_mass_kg: z.number().min(30).max(200).multipleOf(0.1).nullable().optional(),
  comment: z.string().trim().max(500).nullable().optional(),
  revision_of: z.string().uuid().nullable().optional(),
});

export type WellnessEntryInput = z.infer<typeof WellnessEntryInput>;

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
