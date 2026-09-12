-- The weekly nutrition check-in can be corrected ONCE by the athlete.
--
-- Decided on the data-architecture approach ("Nutrition can be corrected once by
-- the athlete, creating a revision") and approved for build on the decision
-- sheet 2026-09-12 (ATH-ADULT-08 C1). Until migration 0107 revise_nutrition_checkin
-- enforced no such rule: a revision could itself be revised without limit, so
-- the athlete app could not honestly say "you can correct this once", and the
-- board's spent state had nothing to stand on.
--
-- What is proven here:
--   1. the first correction lives, as before (0010 / 0099);
--   2. a second correction — revising the revision — is refused with its own
--      error name, `entry_already_corrected`, so the app can say why;
--   3. the superseded original still refuses as `entry_not_revisable`, as it did;
--   4. the chain is left intact: one live row, pointing at the original, and
--      exactly one audit event for the one correction that happened.

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare
  o  uuid := tests.uid('orga', 'org');
  a1 uuid := tests.uid('orga', 'athlete_1');
begin
  insert into nutrition_checkins (id, org_id, athlete_id, week_start, iso_year, iso_week,
                                  answer, note, protein_target_g, source)
    values (tests.uid('orga','once_1'), o, a1, date_trunc('week', current_date - 14)::date,
            extract(isoyear from current_date - 14)::int, extract(week from current_date - 14)::int,
            'roughly', null, 150, 'self_report');
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

-- 1. the first correction lives
select lives_ok(
  format($q$select revise_nutrition_checkin(%L, %L, 'no'::nutrition_checkin_answer, null)$q$,
         tests.uid('orga','once_1'), tests.uid('orga','once_2')),
  'the athlete may correct their check-in once'
);
select is(
  (select revision_of from nutrition_checkins where id = tests.uid('orga','once_2')),
  tests.uid('orga','once_1'),
  'the revision points at the original'
);

-- 2. a second correction is refused, by name
select throws_ok(
  format($q$select revise_nutrition_checkin(%L, %L, 'yes'::nutrition_checkin_answer, null)$q$,
         tests.uid('orga','once_2'), tests.uid('orga','once_3')),
  'P0001', 'entry_already_corrected',
  'revising the revision is refused as entry_already_corrected'
);

-- 3. the superseded original refuses as it always did
select throws_ok(
  format($q$select revise_nutrition_checkin(%L, %L, 'yes'::nutrition_checkin_answer, null)$q$,
         tests.uid('orga','once_1'), tests.uid('orga','once_4')),
  'P0001', 'entry_not_revisable',
  'the superseded original is still entry_not_revisable'
);

-- 4. the chain is intact
select is(
  (select count(*)::int from nutrition_checkins_current
    where athlete_id = tests.uid('orga','athlete_1')
      and week_start = date_trunc('week', current_date - 14)::date),
  1, 'one live row for the week'
);
select is(
  (select id from nutrition_checkins_current
    where athlete_id = tests.uid('orga','athlete_1')
      and week_start = date_trunc('week', current_date - 14)::date),
  tests.uid('orga','once_2'),
  'and it is the one correction'
);
select is(
  (select count(*)::int from nutrition_checkins where id in (tests.uid('orga','once_3'), tests.uid('orga','once_4'))),
  0, 'the refused writes inserted nothing'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(
  (select count(*)::int from audit_log
    where action = 'entry_revision.created' and entity_id = tests.uid('orga','once_2')),
  1, 'exactly one audit event, for the one correction that happened'
);
select is(
  (select count(*)::int from audit_log
    where action = 'entry_revision.created'
      and entity_id in (tests.uid('orga','once_3'), tests.uid('orga','once_4'))),
  0, 'and none for the refusals'
);

select * from finish();
rollback;
