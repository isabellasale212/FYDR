import { z } from 'zod';

/* One schema, one shape. screens/training-entry.md §Data requirements,
 * §Validation rules. Whole-number CR10 only from this screen: the column
 * stays numeric(3,1) so staff-entered and imported values can carry decimals,
 * and so the gym per-set RPE control, which does use half steps, shares the
 * type. Nothing here offers a half step, per O-411.
 *
 * THE SCALE IS 0 TO 10 (Isabella, 2026-09-13; migration 0117): CR-10 proper,
 * where 0 is a real rating meaning rest. Rows before 0117 were written on a
 * 1-to-10 control, so no 0 exists before that date — none could be entered.
 * Zero is falsy: nothing here or downstream may test an RPE for truthiness;
 * missing is null (the sweep in the overnight record, "RPE zero"). */

export const TrainingEntryInput = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid().nullable(),
  entry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected an ISO date'),
  rpe: z.number().int().min(0).max(10),
  duration_min: z.number().int().min(1).max(600),
  comment: z.string().trim().max(500).nullable().optional(),
  revision_of: z.string().uuid().nullable().optional(),
});

export type TrainingEntryInput = z.infer<typeof TrainingEntryInput>;

/** Borg CR-10, ascending 0 to 10 (0117). Ascending order puts 0 (Rest)
 * first and 10 (Maximal) last — matching the screen's own "Session rating, 0
 * to 10" heading and the direction of every such control an athlete has ever
 * used. (The old 10-first order came from the vertical Borg-chart list this
 * screen used to be; kept there it made sense, in a grid it read backwards —
 * a real audit finding.) O-410: the anchor wording wants a sports science
 * review before this ships past a thin slice. */
export const CR10_SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

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
  0: 'Rest',
};
