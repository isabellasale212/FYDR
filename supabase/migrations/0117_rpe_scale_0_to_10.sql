-- 0117_rpe_scale_0_to_10.sql
--
-- The RPE package, change three (Isabella, 2026-09-13, decision batch entry
-- "RPE stays"): the session rating scale becomes 0 to 10, matching CR-10.
-- Zero is a real rating meaning rest.
--
-- What this does
--   training_entries.rpe: the check constraint 0004 set, `rpe between 1 and
--   10`, is replaced by `rpe between 0 and 10`. The column stays numeric(3,1)
--   (staff corrections carry half steps, the athlete's control whole ones).
--   The load trigger (0010) needs no change: 0 × minutes = 0, a real load of
--   nothing, present, not null.
--
-- The rows already written
--   Every training_entries row before this migration was written on the
--   1-to-10 scale (776 rows on scratch, all between 1.0 and 10.0; all
--   production data is synthetic). There is NO back-conversion: a 1 written
--   before today stays a 1, because the scales share every step but the new
--   one — CR-10's 0 was simply not offered. Anyone reading history across the
--   boundary should know that no 0 exists before 2026-09-13 because none
--   could be entered, not because nobody rested.
--
-- Not changed here, and said
--   sessions.planned_rpe stays 1–10 (a coach's planned intensity; a planned
--   0 is not a session). gym_set_logs.rpe (per-set effort, half steps) stays
--   1–10 in its validator: it is not the session scale. gym_session_logs.
--   session_rpe carries no constraint; whether the gym session's own rating
--   follows to 0–10 is a question on the sheet, recommended yes.

alter table public.training_entries drop constraint training_entries_rpe_check;
alter table public.training_entries add constraint training_entries_rpe_check check (rpe between 0 and 10);

comment on column public.training_entries.rpe is
  'Session rating of perceived exertion, CR-10, 0 to 10 since migration 0117 (2026-09-13; 0 = rest). Rows written before 0117 were entered on a 1-to-10 control, so no 0 exists before that date — none could be entered. numeric(3,1): the athlete''s control offers whole steps, a staff correction may carry a half step.';
