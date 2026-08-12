import { z } from 'zod';

/* One schema, one shape. screens/training-entry.md §Data requirements,
 * §Validation rules. Whole-number CR10 only from this screen: the column
 * stays numeric(3,1) so staff-entered and imported values can carry decimals,
 * and so the gym per-set RPE control, which does use half steps, shares the
 * type. Nothing here offers a half step, per O-411. */

export const TrainingEntryInput = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid().nullable(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date'),
  rpe: z.number().int().min(1).max(10),
  duration_min: z.number().int().min(1).max(600),
  comment: z.string().trim().max(500).nullable().optional(),
  revision_of: z.string().uuid().nullable().optional(),
});

export type TrainingEntryInput = z.infer<typeof TrainingEntryInput>;

/** Modified Borg CR10, ascending 1 to 10. The 5×2 grid reads left-to-right,
 * top-to-bottom, so ascending order puts 1 (Very easy) top-left and 10
 * (Maximal) bottom-right — matching the screen's own "Session rating, 1 to
 * 10" heading and the direction of every 1–10 control an athlete has ever
 * used. (The old 10-first order came from the vertical Borg-chart list this
 * screen used to be; kept there it made sense, in a grid it read backwards —
 * a real audit finding.) O-410: the anchor wording wants a sports science
 * review before this ships past a thin slice. */
export const CR10_SCALE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const CR10_ANCHORS: Record<(typeof CR10_SCALE)[number], string | null> = {
  10: 'Maximal',
  9: 'Extremely hard',
  8: 'Very hard',
  7: 'Hard',
  6: null,
  5: 'Somewhat hard',
  4: null,
  3: 'Moderate',
  2: 'Easy',
  1: 'Very easy',
};
