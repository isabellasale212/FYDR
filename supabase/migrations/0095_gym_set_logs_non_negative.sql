-- Reps and load cannot be negative, because volume_kg is computed from them.
--
-- WHAT THIS CHANGES: two check constraints on gym_set_logs. No column types
-- move, no data is rewritten, nothing else in the table is touched.
--
-- WHY. gym_set_logs.volume_kg is
--
--     generated always as (coalesce(reps_completed,0) * coalesce(load_kg,0)) stored
--
-- so a negative rep count does not merely record a wrong set: it writes NEGATIVE
-- TONNAGE into a stored aggregate, and every total that sums volume_kg is then
-- quietly wrong in a way no screen would flag. Nothing stopped it. The columns
-- are a bare `int` and `numeric(6,2)` with no constraint (0021), the correction
-- RPC (0045) validates nothing, and neither correction input carried an HTML
-- `min` until 2026-09-09. A single mistyped minus sign was one keystroke from a
-- corrupted total.
--
-- Client-side validation was added the same day (GymSessionSetsList's
-- validateCorrection, guarded by scripts/test-athlete-input-no-silent-failure.ts).
-- That is the right place for the MESSAGE — it keeps the panel open and says what
-- is wrong — but it is the wrong place for the GUARANTEE: it protects one form,
-- and gym sets also arrive through the logger and through the correction RPC.
-- This is the guarantee.
--
-- WHY `>= 0` AND NOT `> 0`. Both zeroes are real. A zero-rep set is a failed
-- attempt, which an athlete should be able to record honestly rather than round
-- up. A zero load is a bodyweight movement — usually null, but zero is not wrong.
--
-- WHY NO UPPER BOUND ON REPS. load_kg is already capped by numeric(6,2) at
-- 9999.99. An upper bound on reps would be a judgement about what is plausible
-- rather than what is coherent, and the honest number is not obvious: the highest
-- value in the data is 9, which is no basis for a limit. Left out deliberately.
--
-- WHY rpe AND rir ARE LEFT ALONE. Both would pass cleanly on current data, and
-- `rpe` even has precedent for a 1..10 range (training_entries in 0004,
-- sessions.planned_rpe in 0003). But neither feeds volume_kg, so neither is part
-- of the bug this closes, and widening a migration past its reason is how a
-- migration becomes hard to review. Worth its own change if wanted.
--
-- APPLIED WITHOUT `not valid`, deliberately: all 257 existing rows on scratch
-- were checked first and none violates either constraint, on any of the four
-- numeric columns, so the constraint validates immediately rather than being
-- carried as unenforced.
--
-- TO REVERSE:
--   alter table gym_set_logs
--     drop constraint gym_set_logs_reps_completed_non_negative,
--     drop constraint gym_set_logs_load_kg_non_negative;

alter table gym_set_logs
  add constraint gym_set_logs_reps_completed_non_negative
    check (reps_completed is null or reps_completed >= 0),
  add constraint gym_set_logs_load_kg_non_negative
    check (load_kg is null or load_kg >= 0);

comment on constraint gym_set_logs_reps_completed_non_negative on gym_set_logs is
  'volume_kg is generated from reps_completed * load_kg, so a negative rep count '
  'writes negative tonnage into a stored aggregate. 0095.';
comment on constraint gym_set_logs_load_kg_non_negative on gym_set_logs is
  'volume_kg is generated from reps_completed * load_kg, so a negative load '
  'writes negative tonnage into a stored aggregate. 0095.';
