-- Who may author the meal library.
--
-- The policies here have admitted the sport scientist, the coach and the
-- nutritionist since migration 0051. The SCREEN allowed only the coach, so the
-- nutritionist was refused from writing nutrition content — which is their job —
-- and so was the sport scientist. Fixed 2026-09-06; this file is what stops the
-- screen and the policy drifting apart again.
--
-- Note this is deliberately NOT the same set as nutrition targets. A target is a
-- prescription for one athlete (sport scientist, nutritionist). The library is
-- the club's shared list of what food exists, which a coach building a week
-- around a fixture has a real reason to add to. Both sets are asserted here
-- together, because the bug was treating them as one question.

begin;
select * from no_plan();

select tests.fixtures();

-- Seeded before the role switch, so the read assertions in section 2 have
-- something to find: meal_library is empty in the fixtures, and "reads zero
-- rows" would pass for a role that is correctly admitted as well as one that is
-- wrongly refused.
insert into meal_library (org_id, name, time_label)
values (tests.uid('orga','org'), 'Seeded breakfast', 'Breakfast');

set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. The three who author it
--
-- created_by must be the acting user: meal_library_coach_insert's WITH CHECK
-- requires it, the same shape body_composition and test_results use. Supplied
-- here so a refusal below is attributable to the ROLE rather than to a null
-- column, which is a different fact wearing the same SQLSTATE.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select lives_ok(
  format($q$insert into meal_library (org_id, name, time_label, created_by)
            values (%L, 'Overnight oats', 'Breakfast', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_nutritionist')),
  'the NUTRITIONIST authors a meal — the whole point of the fix'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into meal_library (org_id, name, time_label, created_by)
            values (%L, 'Recovery shake', 'Post-training', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_admin')),
  'and the sport scientist, who was also refused by the screen'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into meal_library (org_id, name, time_label, created_by)
            values (%L, 'Pre-match pasta', 'Lunch', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'and the coach, who is the one role the old screen allowed'
);


-- ===========================================================================
-- 2. The two who do not
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into meal_library (org_id, name, time_label, created_by)
            values (%L, 'Not mine', 'Dinner', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_medical')),
  '42501', null,
  'the medic cannot author a meal'
);
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select throws_ok(
  format($q$insert into meal_library (org_id, name, time_label, created_by)
            values (%L, 'Not mine either', 'Dinner', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_sc')),
  '42501', null,
  'nor the S&C'
);

-- But both READ it, which is why the screen shows them the library at all.
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select cmp_ok((select count(*) from meal_library where org_id = tests.uid('orga','org')),
  '>', 0::bigint, 'the medic reads the library for context');
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select cmp_ok((select count(*) from meal_library where org_id = tests.uid('orga','org')),
  '>', 0::bigint, 'and so does the S&C');


-- ===========================================================================
-- 3. The library is not the target: different question, different set
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from pg_policies
    where tablename = 'meal_library' and cmd = 'INSERT' and qual is null
      and with_check like '%coach%')::int,
  1,
  'the coach is in the meal-library write policy'
);
select is(
  (select count(*) from pg_policies
    where tablename = 'nutrition_targets' and cmd = 'INSERT'
      and coalesce(with_check, qual) like '%coach%')::int,
  0,
  'and NOT in the nutrition-target write policy — the two are different rules'
);

select * from finish();
rollback;
