-- The nutritionist reads the censored injury view, and cannot reach a diagnosis.
--
-- This is the assertion that carries D-01's reversal (2026-09-06). The UI half
-- is asserted in scripts/test-report-visibility.ts; this is the half that holds
-- when somebody writes a new page next year and forgets what the old one was
-- careful about.
--
-- The shape of the decision: body area, status, restrictions and expected return
-- are readable, because they live on injuries and availability. The diagnosis is
-- not, because it lives in injury_clinical, which stays medic-only. So the
-- censoring is structural rather than a filter, and the test is written to fail
-- loudly if that ever stops being true.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. What the nutritionist gained: the same rows a coach sees
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select cmp_ok(
  (select count(*) from injuries where org_id = tests.uid('orga','org')),
  '>', 0::bigint,
  'the coach reads injuries at all, so the comparison below is against something'
);

-- Snapshotted while the coach's JWT is still in force, so section 1 compares the
-- nutritionist against something measured rather than against itself.
create temp table coach_view as
  select id, status::text st from injuries where org_id = tests.uid('orga','org');
create temp table coach_avail as
  select id from availability where org_id = tests.uid('orga','org');

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select cmp_ok(
  (select count(*) from injuries where org_id = tests.uid('orga','org')),
  '>', 0::bigint,
  'the nutritionist reads injuries at all -- D-01 reversed 2026-09-06'
);
select is(
  (select count(*) from injuries where org_id = tests.uid('orga','org')),
  (select count(*) from coach_view),
  'and reads exactly the rows the coach sees, no more and no fewer'
);
select is(
  (select count(*) from availability where org_id = tests.uid('orga','org')),
  (select count(*) from coach_avail),
  'availability likewise -- the other half of the same report'
);


-- ===========================================================================
-- 2. What the nutritionist did NOT gain, which is the point
-- ===========================================================================

/* Asserted as a COUNT, not as a 42501, and the difference is the whole reason
   this file exists. authenticated holds a table-level SELECT grant on
   injury_clinical, so a role with no matching policy is not refused -- the rows
   are simply filtered out and the statement succeeds returning nothing. A test
   written as throws_ok here passes only when the grant is missing, which is a
   different fact, and fails while the isolation is working perfectly. This is
   the same asymmetry that produced G-34 through G-37 on the write side; it
   reads the other way round, and it is just as easy to assert wrongly. */
select is(
  (select count(*) from injury_clinical where org_id = tests.uid('orga','org')),
  0::bigint,
  'the nutritionist reads ZERO clinical rows -- the diagnosis is not in the censored view'
);

select is(
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'injury_clinical'
      and qual like '%nutritionist%')::int,
  0,
  'no injury_clinical policy names the nutritionist, so there is no second door to it'
);

-- The write side is untouched. A read grant that quietly became a write grant is
-- the failure this pair is here to catch.
select throws_ok(
  format($q$insert into injuries (org_id, athlete_id, body_area, onset_date, status)
            values (%L, %L, 'hamstring', current_date, 'open')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1')),
  '42501', null,
  'the nutritionist cannot open an injury'
);
-- 'closed' is chosen because the fixtures hold open, rehab, return_to_play and
-- closed, so this genuinely changes most rows if it lands at all.
select lives_ok(
  format($q$update injuries set status = 'closed' where org_id = %L$q$, tests.uid('orga','org')),
  'an update statement is not refused by privilege -- the UPDATE grant exists for staff, so RLS is what has to hold'
);
select is(
  (select count(*) from injuries i join coach_view c on c.id = i.id where i.status::text <> c.st),
  0::bigint,
  'and it moved NOTHING: injuries UPDATE is still the medic alone (D-35)'
);


-- ===========================================================================
-- 3. The roles that were already right stay right
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_sc'));
select cmp_ok(
  (select count(*) from injuries where org_id = tests.uid('orga','org')),
  '>', 0::bigint,
  'the S&C still reads injuries -- unchanged, it was never the broken half'
);
select is(
  (select count(*) from injury_clinical where org_id = tests.uid('orga','org')),
  0::bigint,
  'and still reads zero clinical rows either'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
/* Strictly greater than zero, so the two zeros above are proved to be RLS
   filtering real rows rather than an empty table telling everyone the same
   comfortable nothing. */
select cmp_ok(
  (select count(*) from injury_clinical where org_id = tests.uid('orga','org')),
  '>', 0::bigint,
  'the medic still reads injury_clinical, and there ARE rows there to read -- the one role that may'
);

select * from finish();
rollback;
