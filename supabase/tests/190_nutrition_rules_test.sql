-- 190_nutrition_rules_test.sql
--
-- migration 0039's own header explains why this table exists and how it differs from
-- nutrition_targets. Its RLS is deliberately copied from nutrition_targets (060's own
-- test), so this file mirrors that one closely, on purpose: the two tables should keep
-- reading like siblings to anyone who has already read one of them.
--
-- Which rules this implements
--   Coach: full write, any scope (athlete, group, org default).
--   Medical: insert/update only a personal rule, only for an athlete with an open
--     injury. athlete_1 has one (tests.fixtures()), athlete_2 does not.
--   Athlete: no write, no direct read.
--   Admin: no write, no direct read.
--   One live organisation default rule. One live rule per athlete-or-group scope.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;


-- ===========================================================================
-- 1. Writes: coach full, medical personal-and-open-injury-only
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into nutrition_rules
              (org_id, org_default, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, effective_from, created_by)
            values (%L, true, 1.9, 6.0, 1.0, 40, current_date, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'an athlete cannot set any nutrition rule'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format($q$insert into nutrition_rules
              (org_id, org_default, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, effective_from, created_by)
            values (%L, true, 1.9, 6.0, 1.0, 40, current_date, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_admin')),
  '42501', null,
  'an admin cannot set any nutrition rule either'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into nutrition_rules
              (id, org_id, org_default, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, effective_from, created_by)
            values (%L, %L, true, 1.9, 6.0, 1.0, 40, current_date - 10, %L)$q$,
         tests.uid('orga','rule_org'), tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'a coach sets an org-default rule'
);
select lives_ok(
  format($q$insert into nutrition_rules
              (id, org_id, group_id, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, effective_from, created_by)
            values (%L, %L, %L, 1.9, 6.0, 1.0, 40, current_date - 10, %L)$q$,
         tests.uid('orga','rule_group'), tests.uid('orga','org'), tests.uid('orga','group'),
         tests.uid('orga','user_coach')),
  'a coach sets a group rule'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into nutrition_rules
              (org_id, org_default, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, effective_from, created_by)
            values (%L, true, 1.9, 6.0, 1.0, 40, current_date, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_medical')),
  '42501', null,
  'medical cannot set an org-default rule — write access is personal only'
);
select throws_ok(
  format($q$insert into nutrition_rules
              (org_id, group_id, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, effective_from, created_by)
            values (%L, %L, 1.9, 6.0, 1.0, 40, current_date, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','group'), tests.uid('orga','user_medical')),
  '42501', null,
  'medical cannot set a group rule either'
);
select throws_ok(
  format($q$insert into nutrition_rules
              (org_id, athlete_id, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, effective_from, created_by)
            values (%L, %L, 2.2, 6.0, 1.0, 40, current_date, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','user_medical')),
  '42501', null,
  'medical cannot set a personal rule for an athlete with no open injury (athlete_2)'
);
select lives_ok(
  format($q$insert into nutrition_rules
              (id, org_id, athlete_id, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, reason, effective_from, created_by)
            values (%L, %L, %L, 2.2, 6.0, 1.0, 40, 'Protein raised while returning from injury', current_date - 5, %L)$q$,
         tests.uid('orga','rule_personal'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_medical')),
  'medical DOES set a personal rule for athlete_1, who has an open injury from the shared fixture'
);


-- ===========================================================================
-- 2. The two unique indexes
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));

select throws_ok(
  format($q$insert into nutrition_rules
              (org_id, org_default, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, effective_from, created_by)
            values (%L, true, 2.0, 6.0, 1.0, 40, current_date - 3, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_coach')),
  '23505', null,
  'a second live org-default rule is refused'
);

select throws_ok(
  format($q$insert into nutrition_rules
              (org_id, group_id, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, effective_from, created_by)
            values (%L, %L, 2.0, 6.0, 1.0, 40, current_date - 3, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','group'), tests.uid('orga','user_coach')),
  '23505', null,
  'a second live rule for the same group is refused the same way'
);


-- ===========================================================================
-- 3. Reads: coach and medical see every rule, athlete and admin see none
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from nutrition_rules where org_id = tests.uid('orga','org')),
  3::bigint,
  'a coach reads all three rules set so far'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select is(
  (select count(*) from nutrition_rules where org_id = tests.uid('orga','org')),
  3::bigint,
  'medical reads all three too — rules are not clinical'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from nutrition_rules where org_id = tests.uid('orga','org')),
  0::bigint,
  'an athlete reads zero rows of the table directly — they only ever see their own resolved absolute target'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(
  (select count(*) from nutrition_rules where org_id = tests.uid('orga','org')),
  0::bigint,
  'an admin reads zero rows too'
);


-- ===========================================================================
-- 4. Cross-tenant: orgb cannot see or write into orga's rules
-- ===========================================================================

select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select is(
  (select count(*) from nutrition_rules where org_id = tests.uid('orga','org')),
  0::bigint,
  'orgb''s coach cannot see orga''s rules at all'
);
select throws_ok(
  format($q$insert into nutrition_rules
              (org_id, group_id, protein_g_per_kg, carb_g_per_kg, fat_g_per_kg, fluid_ml_per_kg, effective_from, created_by)
            values (%L, %L, 1.9, 6.0, 1.0, 40, current_date, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','group'), tests.uid('orgb','user_coach')),
  '42501', null,
  'orgb''s coach cannot write a rule into orga naming orga''s own ids explicitly'
);

select * from finish();
rollback;
