import { z } from 'zod';

/* migration 0040's own schema, mirrored client-side: the athlete's own words,
 * an optional category, bounded at 1000 characters. Same client-generated-id
 * shape as NutritionCheckinInput so a duplicate queued write is idempotent
 * rather than a second row — see NutritionCheckinForm's own comment for why
 * that pattern exists in this app. */

export const PROBLEM_REPORT_CATEGORIES = ['injury_or_pain', 'wellbeing', 'other'] as const;

export const ProblemReportInput = z.object({
  id: z.string().uuid(),
  category: z.enum(PROBLEM_REPORT_CATEGORIES).nullable().optional(),
  body: z
    .string()
    .trim()
    .min(1, 'Tell us what’s going on.')
    .max(1000, 'Keep it under 1,000 characters — medical will follow up.'),
});

export type ProblemReportInput = z.infer<typeof ProblemReportInput>;
