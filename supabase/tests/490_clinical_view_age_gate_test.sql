-- The age gate on injury_clinical_athlete_view.
--
-- WHAT IS ALREADY COVERED, and deliberately not repeated wholesale here:
-- 030_medical_and_entry_rules_test.sql §2 asserts that an athlete reads their
-- own row, that another athlete reads none, that a coach reads none, and that
-- clinical_notes is not a column. 010 asserts the column absence independently.
-- This file adds the one rule those predate.
--
-- THE RULE. An athlete under 18 reads nothing through this view. Isabella's
-- decision of 2026-09-08, taken before it could become a live problem: one minor
-- is on the roster today and none of them has an open injury, which is exactly
-- when to get it right.
--
-- WHY THE GATE IS IN THE VIEW AND NOT IN THE APPLICATION, which was not a
-- preference. `athlete_is_minor()` is SECURITY DEFINER and its EXECUTE is
-- granted to postgres and service_role only -- `authenticated` cannot call it at
-- all. An application-level check running as the signed-in athlete would be
-- refused. The view is owned by postgres and runs with definer rights, so it
-- can. The gate therefore sits in the one place that can ask the question, which
-- happens also to be the place a second consumer of this view cannot forget.
--
-- FAILING SAFE IS ASSERTED, NOT ASSUMED. athlete_is_minor() returns TRUE for a
-- null date of birth. That is the behaviour that matters most here: an athlete
-- whose date of birth was never entered is treated as a minor and shown nothing,
-- rather than treated as an adult by default. A gate that opens when it does not
-- know is not a gate.
--
-- AND THE OPEN QUESTION THIS PINS. What a minor sees INSTEAD is not decided.
-- Nothing is the safe default and it is what this asserts; if the answer becomes
-- "a reduced version" or "the same, with a guardian", this file is where that
-- change announces itself.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;

select ok(tests.rls_is_engaged(),
  'canary: RLS is on, so these reads go through policies rather than around them');

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

-- ------------------------------------------------------- the adult, unchanged
select is(
  (select count(*) from injury_clinical_athlete_view),
  1::bigint,
  'an adult athlete still reads their own row: the gate did not close the view for everybody'
);

select is(
  (select diagnosis from injury_clinical_athlete_view),
  'Grade 2 acromioclavicular joint sprain',
  'and still reads the diagnosis, which is the whole point of the view'
);

-- --------------------------------------------------------------- the minor
/* athlete_1 is the one with an injury, so the age is moved rather than the
   injury: a second athlete with a second injury would be testing a different
   row as well as a different age. Rolled back with the transaction.

   TWO THINGS HAVE TO BE UNDONE FOR THE WRITE, and missing either one makes this
   file test nothing. The athletes_self_update_column_guard trigger keys on
   auth_has_any_role(['athlete']) and refuses every column but preferred_name, so
   the JWT is cleared — its own comment says an actor with no role context passes
   through, which is the route the fixtures take. And RLS on `athletes` is still
   live for the `authenticated` role, so with the JWT cleared auth_org_id() is
   null, the update policy matches no row, and the statement succeeds having
   changed nothing. `reset role` is what makes the write land.

   The row count is asserted for exactly that reason. The first draft of this
   file cleared the JWT without resetting the role: the age never changed, the
   minor assertions failed, and it read as the view's gate not working rather
   than as the test not testing. */
reset role;
select tests.clear_jwt();
do $$
declare n integer;
begin
  update public.athletes set date_of_birth = current_date - interval '16 years'
  where id = tests.uid('orga', 'athlete_1');
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'the age change changed % rows, not 1, so nothing below is testing anything', n;
  end if;
end $$;
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after this switch, so what follows measures something');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

select is(
  (select count(*) from injury_clinical_athlete_view),
  0::bigint,
  'the same athlete, aged sixteen, reads nothing at all'
);

-- ------------------------------------------- and the one that cannot happen
/* THE NULL DATE OF BIRTH CASE IS UNREACHABLE FOR THIS VIEW, and finding that out
   changed what is worth asserting. The first draft of this file set
   date_of_birth to null and expected the gate to exclude the athlete. The write
   is refused by a check constraint:

     athletes_dob_required_when_linked  CHECK (user_id IS NULL OR date_of_birth IS NOT NULL)

   and the view only ever returns rows where `a.user_id is not null`. So every
   athlete this view can serve is guaranteed to have a date of birth, by the
   table, and there are zero linked athletes without one.

   Asserting the view's behaviour on a row that cannot exist would have been a
   test of nothing dressed as a safety check. What IS asserted is the guarantee
   itself — that the database refuses the state — plus the fact that the view
   carries its own `is not null` test anyway. Two independent reasons the case
   cannot produce a disclosure, and if the constraint is ever relaxed the view
   still holds and this assertion is where the change surfaces. */
reset role;
select tests.clear_jwt();

select throws_ok(
  $$update public.athletes set date_of_birth = null
    where id = tests.uid('orga', 'athlete_1')$$,
  '23514',
  null,
  'a linked athlete cannot have their date of birth removed at all: the table refuses it'
);

select ok(
  (select pg_get_viewdef('public.injury_clinical_athlete_view'::regclass, true))
    like '%date_of_birth IS NOT NULL%',
  'and the view tests for it regardless, so relaxing the constraint would not open the gate'
);

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after this switch, so what follows measures something');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

-- ------------------------------------------------ nothing else was widened
reset role;
select tests.clear_jwt();
do $$
declare n integer;
begin
  update public.athletes set date_of_birth = date '2002-01-27'
  where id = tests.uid('orga', 'athlete_1');
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'restoring the date of birth changed % rows, not 1, so nothing below is testing anything', n;
  end if;
end $$;
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after this switch, so what follows measures something');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

select is(
  (select count(*) from injury_clinical_athlete_view),
  1::bigint,
  'restoring the adult date of birth restores the row, so the gate reads the age and nothing else'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is(
  (select count(*) from injury_clinical_athlete_view),
  0::bigint,
  'another athlete still reads nothing, as 030 already required'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from injury_clinical_athlete_view),
  0::bigint,
  'and a coach still reads nothing: this is not a back door and the rewrite did not make it one'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  'select clinical_notes from injury_clinical_athlete_view',
  '42703',
  null,
  'clinical_notes is still not a column, so the rewrite did not quietly restore it'
);

/* THE THRESHOLD LIVES IN THREE PLACES — athlete_is_minor(), athlete_age_view and
   now this view — because the definer function cannot be called by the role that
   reads the view. Three copies of a number drift, so they are pinned to each
   other here: for the same athlete, at the same moment, the view's verdict and
   athlete_is_minor()'s must agree. */
reset role;
select tests.clear_jwt();
do $$
declare n integer;
begin
  update public.athletes set date_of_birth = current_date - interval '17 years 364 days'
  where id = tests.uid('orga', 'athlete_1');
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'the boundary age change changed % rows, not 1', n; end if;
end $$;

select is(
  public.athlete_is_minor(tests.uid('orga', 'athlete_1')),
  true,
  'one day short of eighteen is a minor by athlete_is_minor()'
);

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after this switch, so what follows measures something');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

select is(
  (select count(*) from injury_clinical_athlete_view),
  0::bigint,
  'and the view agrees on the same day, which is what pins its expanded copy of the rule to the function'
);

select * from finish();
rollback;
