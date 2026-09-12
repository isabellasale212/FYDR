-- 0108_exercise_weight_step.sql
--
-- ATH-ADULT-09 C3 — approved on the decision sheet 2026-09-12 (Isabella):
-- "the weight stepper's increment comes from the exercise (2.5 / 1.25 / 2 kg;
-- bodyweight = reps only)".
--
-- WHAT WAS TRUE. The athlete's gym logger moved its weight stepper by a
-- constant 2.5 kg for every exercise (GymSessionLogger's WEIGHT_STEP_KG: "one
-- plate a side on a barbell; the brief does not name a step"). A dumbbell row
-- steps by 2, a microloaded bar by 1.25, a plate-loaded machine by 5 — the
-- step is a property of the movement, not of the app.
--
-- THE CHANGE. One column on the movement library: exercises.weight_step_kg,
-- numeric, default 2.5 so every existing exercise steps exactly as it did,
-- checked positive (a zero step would freeze the control; a negative one
-- would invert it). Set by the coach on the library's create form; read by the
-- logger through exercises_org_select alongside resolve_programme_exercises
-- (that function is not changed — the read is a second select by the resolved
-- exercise ids, so a substitute override steps by the substitute's value).
-- Bodyweight movements (load_basis none) have no stepper at all and are
-- untouched. Test: 640_exercise_weight_step_test.sql.

alter table public.exercises
  add column weight_step_kg numeric(5,2) not null default 2.5
    constraint exercises_weight_step_positive check (weight_step_kg > 0 and weight_step_kg <= 25);

comment on column public.exercises.weight_step_kg is
  'The increment the athlete''s weight stepper moves by for this movement, in kg. '
  '2.5 (a plate a side) by default; 2 for most dumbbells, 1.25 for a microloaded bar. '
  'Set on the library''s create form (0108, ATH-ADULT-09 C3).';
