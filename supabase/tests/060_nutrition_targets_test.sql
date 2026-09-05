-- 060_nutrition_targets_test.sql
--
-- migration 0019's own header explains why this feature exists and what it
-- deliberately does not. This file tests: the write split (coach full, medical
-- personal-only-and-only-with-an-open-injury, athlete and admin nothing), the two
-- unique indexes, and resolve_nutrition_targets' precedence and its own role
-- guard — including the admin gap closed by migration 0020, found while writing
-- this file, before it shipped.
--
-- Which rules this implements
--   Coach: full write, any scope.
--   Medical: insert/update only a personal target, only for an athlete with an
--     open injury. tests.fixtures()' athlete_1 has one (status 'rehab'), athlete_2
--     does not — both are exercised here.
--   Athlete: no write, no direct read of the table; only their own resolved
--     target, through the function, never a squadmate's even if asked for by id.
--   Admin: no write, no direct read, and — the part 0020 exists for — no read
--     through the function either, for any athlete_id.
--   One live organisation default per day. One live row per athlete-or-group
--     scope per day.
--   Precedence: personal beats group beats squad default, each day-specific
--     beats each scope's own "any day" row.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. Writes: coach full, medical personal-and-open-injury-only
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into nutrition_targets (org_id, org_default, protein_g, effective_from, created_by)
            values (%L, true, 160, current_date, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'an athlete cannot set any nutrition target'
);

/* The negative control that used to sit here asserted that an admin was
   refused. 0063 renames that role to sport_scientist, which docs/access-matrix.md
   §1 gives everything, so the refusal became a permission. It has not been
   deleted: it moved to the end of this file, as a positive control, because
   asserting it HERE would leave a row behind and every count below is written
   against the state this file builds in order. */

/* G-33 row 2, decided 2026-09-05: nutrition targets are specialist territory,
   as the original spec had them, and not a casualty of the four-role bug. The
   coach and the medic both become read-only; the nutritionist writes.
   docs/access-matrix.md §3.3, "Nutrition targets | VECD | V | V | V | VECD".

   Every write in this section used to be a coach's or a medic's. Both refusals
   below are new, and the medic's parallel write path was dropped outright in
   0070 rather than repointed, because a role that is V does not need one. */

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into nutrition_targets (org_id, org_default, protein_g, effective_from, created_by)
            values (%L, true, 160, current_date, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_coach')),
  '42501', null,
  'a coach can no longer set a nutrition target'
);

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select lives_ok(
  format($q$insert into nutrition_targets
              (id, org_id, org_default, protein_g, carbs_g, effective_from, created_by)
            values (%L, %L, true, 160, 400, current_date - 10, %L)$q$,
         tests.uid('orga','tgt_squad'), tests.uid('orga','org'), tests.uid('orga','user_nutritionist')),
  'a nutritionist sets a squad-default target'
);
select lives_ok(
  format($q$insert into nutrition_targets
              (id, org_id, group_id, protein_g, carbs_g, effective_from, created_by)
            values (%L, %L, %L, 190, 440, current_date - 10, %L)$q$,
         tests.uid('orga','tgt_group'), tests.uid('orga','org'), tests.uid('orga','group'),
         tests.uid('orga','user_nutritionist')),
  'and a group target'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into nutrition_targets (org_id, org_default, protein_g, effective_from, created_by)
            values (%L, true, 160, current_date, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_medical')),
  '42501', null,
  'medical cannot set a squad-default target'
);
select throws_ok(
  format($q$insert into nutrition_targets (org_id, group_id, protein_g, effective_from, created_by)
            values (%L, %L, 190, current_date, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','group'), tests.uid('orga','user_medical')),
  '42501', null,
  'nor a group target'
);
/* This one used to be a lives_ok, and it is the medic's whole former lane: a
   personal target for an athlete with an open injury. It is now refused like
   the rest. Read access is untouched, which the section below checks. */
select throws_ok(
  format($q$insert into nutrition_targets (org_id, athlete_id, protein_g, effective_from, created_by)
            values (%L, %L, 200, current_date, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_medical')),
  '42501', null,
  'nor a personal target for an injured athlete, which used to be theirs alone'
);

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select lives_ok(
  format($q$insert into nutrition_targets
              (id, org_id, athlete_id, protein_g, energy_kcal, reason, effective_from, created_by)
            values (%L, %L, %L, 200, 3200, 'Return to play', current_date - 5, %L)$q$,
         tests.uid('orga','tgt_personal'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_nutritionist')),
  'the nutritionist sets the personal target instead'
);


-- ===========================================================================
-- 2. The two unique indexes
-- ===========================================================================

-- Stay as the nutritionist: only that role can write these rows at all now, and
-- a 42501 would fire first and mask the 23505 this section is actually testing.
select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));

select throws_ok(
  format($q$insert into nutrition_targets (org_id, org_default, protein_g, effective_from, created_by)
            values (%L, true, 999, current_date - 3, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_nutritionist')),
  '23505', null,
  'a second live squad default for the same day (any day, both null md_offset) is refused'
);

select throws_ok(
  format($q$insert into nutrition_targets (org_id, group_id, protein_g, effective_from, created_by)
            values (%L, %L, 999, current_date - 3, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','group'), tests.uid('orga','user_nutritionist')),
  '23505', null,
  'a second live target for the same group and day is refused the same way'
);


-- ===========================================================================
-- 3. Reads: coach and medical see every target, athlete and admin see none
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from nutrition_targets where org_id = tests.uid('orga','org')),
  3::bigint,
  'a coach reads all three targets set so far'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is(
  (select count(*) from nutrition_targets where org_id = tests.uid('orga','org')),
  3::bigint,
  'medical reads all three too — targets are not clinical'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from nutrition_targets where org_id = tests.uid('orga','org')),
  0::bigint,
  'an athlete reads zero rows of the table directly, even their own — the function is the only path in'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select cmp_ok(
  (select count(*) from nutrition_targets where org_id = tests.uid('orga','org')),
  '>', 0::bigint,
  'a sport scientist reads the targets too'
);


-- ===========================================================================
-- 4. resolve_nutrition_targets: precedence, self-only for an athlete, nothing for admin
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select source_scope from resolve_nutrition_targets(
     array[tests.uid('orga','athlete_1')]::uuid[], current_date, current_date)),
  'personal',
  'athlete_1 resolves to their own personal target — it beats the group and squad-default rows that also apply'
);

select is(
  (select array_agg(athlete_id) from resolve_nutrition_targets(
     array[tests.uid('orga','athlete_1'), tests.uid('orga','athlete_2')]::uuid[],
     current_date, current_date)),
  array[tests.uid('orga','athlete_1')],
  'athlete_1 asking for athlete_2''s target too gets back only their own row — the function narrows the id list itself, not just the join'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is(
  (select source_scope from resolve_nutrition_targets(
     array[tests.uid('orga','athlete_2')]::uuid[], current_date, current_date)),
  'group',
  'athlete_2 has no personal target, so the Forwards group target wins over the squad default'
);

-- REVERSED DELIBERATELY, and this is the one place the role migration changes a
-- security answer rather than just its vocabulary.
--
-- 0020_nutrition_targets_resolve_admin_gap.sql exists to make this return zero:
-- an admin was a club secretary, and a club secretary has no business reading an
-- athlete's nutrition target. That was correct for the four-role model.
--
-- 0063 renames admin to sport_scientist, and a sport scientist is a performance
-- professional who sees everything. The fixture user did not change; the meaning
-- of the value they hold did. So the boundary 0020 defended no longer exists,
-- because the role it defended against was removed rather than renamed into
-- something equivalent. Asserted the other way round here so the reversal is
-- visible in the suite instead of silently deleted.
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(
  (select count(*) from resolve_nutrition_targets(
     array[tests.uid('orga','athlete_1')]::uuid[], current_date, current_date)),
  1::bigint,
  'a sport scientist asking the function directly for athlete_1''s target gets the real answer'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select source_scope from resolve_nutrition_targets(
     array[tests.uid('orga','athlete_2')]::uuid[], current_date, current_date)),
  'group',
  'a coach asking on athlete_2''s behalf gets the real answer, unrestricted by the athlete narrowing'
);

-- The moved control. The sport scientist keeps the write: 3.3 gives that role
-- VECD, and G-33 narrowed the coach and the medic, not this one. Scoped to
-- athlete_2, whose lack of a personal target the resolution tests depend on, so
-- it runs last.
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into nutrition_targets (org_id, athlete_id, protein_g, effective_from, created_by)
            values (%L, %L, 165, current_date, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','user_admin')),
  'a sport scientist CAN set a nutrition target'
);

select * from finish();
rollback;
