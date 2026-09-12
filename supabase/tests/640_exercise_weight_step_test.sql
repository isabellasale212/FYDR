-- exercises.weight_step_kg — the increment the athlete's weight stepper moves by.
--
-- ATH-ADULT-09 C3, approved on the decision sheet 2026-09-12: "the weight
-- stepper's increment comes from the exercise (2.5 / 1.25 / 2 kg; bodyweight =
-- reps only)". Until migration 0108 the logger moved by a constant 2.5 for
-- every exercise — one plate a side on a barbell, which is wrong for a dumbbell
-- (2) and for a microloaded bar (1.25).
--
-- Proven here: the column exists with 2.5 as its default, so every existing
-- exercise steps exactly as it did; a step of zero or below is refused; the
-- S&C (exercises_staff_update: sport scientist and S&C, 0073) may set it; the
-- athlete reads it through the org select policy the logger's read relies on.

begin;
select * from no_plan();

select tests.fixtures();

select has_column('public', 'exercises', 'weight_step_kg', 'exercises.weight_step_kg exists');
select col_default_is('public', 'exercises', 'weight_step_kg', '2.5', 'and defaults to 2.5 — every existing exercise steps as before');
select col_not_null('public', 'exercises', 'weight_step_kg', 'never null');

do $$
declare
  o uuid := tests.uid('orga', 'org');
begin
  insert into exercises (id, org_id, name, category)
    values (tests.uid('orga','ex_step'), o, 'Dumbbell row', 'pull');
end $$;

select is(
  (select weight_step_kg from exercises where id = tests.uid('orga','ex_step')),
  2.5::numeric, 'a new exercise takes the default'
);

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on');

-- the S&C may set it (the library's write policy — 0073)
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select lives_ok(
  format($q$update exercises set weight_step_kg = 2 where id = %L$q$, tests.uid('orga','ex_step')),
  'the S&C may set the step'
);
select is(
  (select weight_step_kg from exercises where id = tests.uid('orga','ex_step')),
  2::numeric, 'and it is stored'
);

-- but not to nothing
select throws_ok(
  format($q$update exercises set weight_step_kg = 0 where id = %L$q$, tests.uid('orga','ex_step')),
  '23514', null,
  'a step of zero is refused by the check'
);
select throws_ok(
  format($q$update exercises set weight_step_kg = -2.5 where id = %L$q$, tests.uid('orga','ex_step')),
  '23514', null,
  'and so is a negative one'
);

-- the athlete reads it
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select weight_step_kg from exercises where id = tests.uid('orga','ex_step')),
  2::numeric, 'the athlete reads the step through exercises_org_select'
);

select * from finish();
rollback;
