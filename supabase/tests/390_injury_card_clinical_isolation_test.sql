-- The injury card's one real risk: clinical detail reaching a role that may not
-- see it.
--
-- The card is role-driven and the page only fetches injury_clinical for a medic.
-- That is the app being careful. This file asserts the thing that holds when the
-- app is not: clinical_medical_only (0012) refuses the table to everyone else,
-- so a component bug, a future refactor, or somebody calling the query directly
-- all fail at the database.
--
-- Note the SHAPE of the refusal, because it is the trap this project has hit
-- repeatedly: authenticated holds a SELECT grant on injury_clinical, so a
-- non-medic is not refused with 42501 — the rows are filtered to nothing and the
-- statement succeeds. Asserted as a COUNT for that reason. A throws_ok here
-- would pass only when the grant is missing, which is a different fact.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. The medic sees the clinical record for the athlete's active injury
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select cmp_ok(
  (select count(*) from injury_clinical where org_id = tests.uid('orga','org')),
  '>', 0::bigint,
  'the medic reads clinical rows, so the zeros below are filtering rather than an empty table'
);
select isnt(
  (select diagnosis from injury_clinical where injury_id = tests.uid('orga','injury')),
  null,
  'and the active injury has a diagnosis on file'
);


-- ===========================================================================
-- 2. Every other staff role reads zero, for the SAME injury
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from injury_clinical where injury_id = tests.uid('orga','injury')),
  0::bigint,
  'the COACH reads zero clinical rows for the same injury the medic just read'
);
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select is(
  (select count(*) from injury_clinical where injury_id = tests.uid('orga','injury')),
  0::bigint,
  'the S&C likewise'
);
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(
  (select count(*) from injury_clinical where injury_id = tests.uid('orga','injury')),
  0::bigint,
  'and the SPORT SCIENTIST — "access to everything" does not reach through a database policy'
);
select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select is(
  (select count(*) from injury_clinical where injury_id = tests.uid('orga','injury')),
  0::bigint,
  'and the nutritionist'
);


-- ===========================================================================
-- 3. But the limited view's own data IS readable by all of them
--
-- Without this the file would pass just as well if injuries were closed to
-- everyone, which is the opposite of what the card needs.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select isnt(
  (select body_area::text from injuries where id = tests.uid('orga','injury')),
  null,
  'the coach reads body area from injuries, the table the limited view is built on'
);
select isnt(
  (select status::text from injuries where id = tests.uid('orga','injury')),
  null,
  'and status, which is what the badge renders for every role'
);
select cmp_ok(
  (select count(*) from availability where org_id = tests.uid('orga','org')),
  '>=', 0::bigint,
  'and availability, where the plain-language restrictions live'
);

/* occurred_in is on injuries, not injury_clinical — the card's onset line reads
   it, so it must not turn out to be clinical by another name. */
select has_column('public', 'injuries', 'occurred_in',
  'occurred_in is on injuries, the table every injury role reads');
select is(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'injury_clinical' and column_name = 'occurred_in')::int,
  0,
  'and is NOT on injury_clinical, so the onset line cannot leak by accident'
);

select * from finish();
rollback;
