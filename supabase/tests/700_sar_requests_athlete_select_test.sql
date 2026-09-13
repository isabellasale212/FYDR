-- PATTERN-S8 C10 (2026-09-13): the athlete side of subject access reads
-- the athlete's own requests — and nothing else.
--
-- WHAT 0114 ADDS: sar_requests_athlete_select — an athlete may read a
-- sar_requests row whose athlete_id is their own, in their own org. No
-- insert, no update; sar_clinical_reviews stays closed to them.

begin;
select * from no_plan();

select tests.fixtures();

-- Two requests in orga: one for athlete_1, one for athlete_2, opened by
-- the sport scientist as the app does.
insert into sar_requests (id, org_id, athlete_id, requested_by, requested_at, due_at, status)
values
  (tests.uid('orga', 'sar_a1'), tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), tests.uid('orga', 'user_admin'), now() - interval '3 days', now() + interval '27 days', 'pending_review'),
  (tests.uid('orga', 'sar_a2'), tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'), tests.uid('orga', 'user_admin'), now() - interval '10 days', now() + interval '20 days', 'reviewed');

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on');

-- 1. athlete_1 reads their own request and not their teammate's
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*)::int from sar_requests),
  1, 'the athlete sees one request'
);
select is(
  (select athlete_id from sar_requests),
  tests.uid('orga', 'athlete_1'), 'and it is their own'
);
select is(
  (select status from sar_requests where id = tests.uid('orga', 'sar_a1')),
  'pending_review', 'with its stage'
);

-- 2. read only: no insert, no update
select throws_ok(
  $q$insert into sar_requests (org_id, athlete_id, requested_by, due_at, status)
     values (tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), tests.uid('orga', 'user_athlete_1'), now() + interval '30 days', 'pending_review')$q$,
  '42501', null, 'an athlete cannot open a request themselves'
);
-- A data-modifying statement cannot sit inside a subquery: run the update
-- and read the row back, which the athlete's own select allows.
update sar_requests set status = 'released' where id = tests.uid('orga', 'sar_a1');
select is(
  (select status from sar_requests where id = tests.uid('orga', 'sar_a1')),
  'pending_review', 'an athlete cannot change a request — the update matched nothing'
);

-- 3. the clinical review rows stay closed
select is(
  (select count(*)::int from sar_clinical_reviews),
  0, 'the athlete reads no clinical review decision'
);

-- 4. athlete_2 sees only theirs
select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is(
  (select athlete_id from sar_requests),
  tests.uid('orga', 'athlete_2'), 'the teammate sees only their own'
);

-- 5. the staff read is unchanged: the sport scientist sees both, the coach none
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select count(*)::int from sar_requests), 2, 'the sport scientist still reads every request');
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is((select count(*)::int from sar_requests), 0, 'the coach still reads none');

-- 6. another org's athlete: nothing
select tests.set_jwt(tests.uid('orgb', 'user_athlete_1'));
select is((select count(*)::int from sar_requests), 0, 'an athlete in another club sees nothing');

select * from finish();
rollback;
