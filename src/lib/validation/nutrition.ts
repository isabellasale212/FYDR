import { z } from 'zod';

/* screens/nutrition-checkin.md's own schema. One question, three answers,
 * client-generated id so a duplicate queued write becomes a revision rather
 * than a second row. */

export const NutritionCheckinInput = z.object({
  id: z.string().uuid(),
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date'),
  iso_year: z.number().int(),
  iso_week: z.number().int(),
  answer: z.enum(['yes', 'roughly', 'no']),
  note: z.string().trim().max(280).nullable().optional(),
  revision_of: z.string().uuid().nullable().optional(),
});

export type NutritionCheckinInput = z.infer<typeof NutritionCheckinInput>;
