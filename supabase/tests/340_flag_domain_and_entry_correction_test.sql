-- Two rules from 2026-09-06 that a role set cannot express.
--
-- 1. The nutritionist may act on a flag only when its domain is 'nutrition'.
--    This is the first rule in the schema where the SAME PERSON is admitted to
--    one row and refused the one beside it, so the test is written to prove
--    exactly that: the pair of assertions on the same nutritionist, against two
--    flags that differ only in domain, is the whole point. Testing only the
--    refusal would also pass if the role could act on nothing at all.
--
-- 2. Correcting a wellness entry or an RPE score is the sport scientist, the
--    coach and the medic. The S&C and the nutritionist are out. RPE lives on
--    training_entries.rpe, which is why the training half is the RPE half.

begin;
select * from no_plan();

select tests.fixtures();

-- Two flags differing ONLY in domain, so nothing but the domain can explain a
-- difference in outcome below. Seeded before the role switch: as `authenticated`
-- this insert is subject to the very policy under test, which would make the
-- fixture depend on the rule it exists to measure.
insert into public.flags (id, org_id, athlete_id, domain, metric, flag_date, severity, status)
values
  (tests.uid('orga','flag_nutrition'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
   'nutrition', 'nutrition.protein_target', current_date, 'medium', 'raised'),
  (tests.uid('orga','flag_wellness2'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
   'wellness', 'wellness.soreness', current_date, 'medium', 'raised');

set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. The nutritionist, both sides of the same rule
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));

select lives_ok(
  format($q$update flags set staff_note = 'protein intake discussed' where id = %L$q$,
         tests.uid('orga','flag_nutrition')),
  'the nutritionist may write to a NUTRITION flag'
);
select is(
  (select staff_note from flags where id = tests.uid('orga','flag_nutrition')),
  'protein intake discussed',
  'and the write actually landed'
);

select lives_ok(
  format($q$update flags set staff_note = 'should not land' where id = %L$q$,
         tests.uid('orga','flag_wellness2')),
  'the statement against a WELLNESS flag is not refused by privilege -- the UPDATE grant exists'
);
select is(
  (select staff_note from flags where id = tests.uid('orga','flag_wellness2')),
  null,
  'but it matched ZERO rows: same person, same table, different domain'
);

-- The escape route: relabel the flag, then edit it. WITH CHECK defaults to
-- USING on an UPDATE policy, so the new row is tested too.
select lives_ok(
  format($q$update flags set domain = 'nutrition' where id = %L$q$,
         tests.uid('orga','flag_wellness2')),
  'nor is relabelling refused by privilege'
);
select is(
  (select domain::text from flags where id = tests.uid('orga','flag_wellness2')),
  'wellness',
  'and it moved nothing either: a wellness flag cannot be relabelled into reach'
);

-- flag_actions carries the same rule through the parent row, or the audit trail
-- could record a dismissal the flags table refused.
select throws_ok(
  format($q$insert into flag_actions (org_id, flag_id, action_type, dismiss_reason, taken_by)
            values (%L, %L, 'dismissed', 'Not a concern', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','flag_wellness2'), tests.uid('orga','user_nutritionist')),
  '42501', null,
  'the nutritionist cannot file an action against a wellness flag'
);
select lives_ok(
  format($q$insert into flag_actions (org_id, flag_id, action_type, dismiss_reason, taken_by)
            values (%L, %L, 'dismissed', 'Not a concern', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','flag_nutrition'), tests.uid('orga','user_nutritionist')),
  'but can against a nutrition one'
);


-- ===========================================================================
-- 2. Every other staff role acts on any domain
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_sc'));
select lives_ok(
  format($q$update flags set staff_note = 'sc note' where id = %L$q$,
         tests.uid('orga','flag_wellness2')),
  'the S&C may write to a wellness flag'
);
select is(
  (select staff_note from flags where id = tests.uid('orga','flag_wellness2')),
  'sc note',
  'and it landed -- the S&C RAISES and acts on flags, which the same decision confirms'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$update flags set staff_note = 'coach note' where id = %L$q$,
         tests.uid('orga','flag_nutrition')),
  'and the coach may write to a nutrition flag -- the rule narrows one role, not the domain'
);


-- ===========================================================================
-- 3. Correcting a wellness entry, and an RPE score
-- ===========================================================================

-- revise_wellness_entry and revise_training_entry raise not_permitted (P0001)
-- rather than 42501: they are SECURITY DEFINER and check the role themselves.
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select throws_ok(
  format($q$select revise_wellness_entry(%L, %L, '{"sleep_hours": 9}'::jsonb)$q$,
         (select id from wellness_entries
           where athlete_id = tests.uid('orga','athlete_1') and superseded_by is null limit 1),
         gen_random_uuid()),
  'P0001', 'not_permitted',
  'the S&C cannot correct a wellness entry -- narrowed 2026-09-06'
);

-- The RPE half, stated separately because "wellness reports or RPE scores" is
-- two tables: training_entries.rpe is where an RPE lives.
select throws_ok(
  format($q$select revise_training_entry(%L, %L, '{"rpe": 3}'::jsonb)$q$,
         (select id from training_entries
           where athlete_id = tests.uid('orga','athlete_1') and superseded_by is null limit 1),
         gen_random_uuid()),
  'P0001', 'not_permitted',
  'nor an RPE score -- training_entries.rpe, the other half of the same decision'
);

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select throws_ok(
  format($q$select revise_wellness_entry(%L, %L, '{"sleep_hours": 9}'::jsonb)$q$,
         (select id from wellness_entries
           where athlete_id = tests.uid('orga','athlete_1') and superseded_by is null limit 1),
         gen_random_uuid()),
  'P0001', 'not_permitted',
  'nor can the nutritionist -- bodyweight and the nutrition plan are its profile writes'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$select revise_wellness_entry(%L, %L, '{"sleep_hours": 9}'::jsonb)$q$,
         (select id from wellness_entries
           where athlete_id = tests.uid('orga','athlete_1') and superseded_by is null limit 1),
         gen_random_uuid()),
  'the coach still can -- the positive control, or the two refusals prove nothing'
);

select * from finish();
rollback;
