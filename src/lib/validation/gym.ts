import { z } from 'zod';

/* screens/gym-logging.md's own written shape ("What is written"), narrowed to the columns
 * this build's cut-down GymSessionLogger actually collects (no per-set RPE/RIR/side —
 * see that component's own header comment for why). Client-generated id, same reasoning
 * as NutritionCheckinInput/WellnessEntryInput: a retried queued write inserts the same
 * row rather than a second one — migration 0044's gym_set_logs_one_live_per_slot index is
 * the second, independent guard for the case a retry mints a fresh id instead. */

export const GymSetLogInput = z.object({
  id: z.string().uuid(),
  gym_session_log_id: z.string().uuid(),
  programme_exercise_id: z.string().uuid().nullable(),
  exercise_id: z.string().uuid(),
  set_number: z.number().int().min(1).max(100),
  reps_completed: z.number().int().min(0).max(100).nullable(),
  load_kg: z.number().min(0).max(500).nullable(),
  rpe: z.number().min(1).max(10).nullable(),
});

export type GymSetLogInput = z.infer<typeof GymSetLogInput>;
