-- 200_coach_noninjury_availability_test.sql
--
-- ADR-008 / migration 0041 / gameplan 2.6 (audit governance finding 2).
--
-- The claim this file exists to check: a coach can now record a real, non-injury
-- absence — illness, personal, academic, representative, other — without touching
-- the injury or clinical tables at all, and every boundary 030's own section 3
-- already proved (a coach cannot claim reason 'injury', cannot attach an
-- injury_id, cannot touch an injury-linked row, cannot reach injury_clinical)
-- still holds exactly as it did before this migration. This file does not repeat
-- 030's clinical-table assertions; it only adds the new, narrower permission.
--
-- Ordering note: every insert below is written so it never collides with
-- availability_one_open_per_athlete (0005) — the partial unique index that
-- allows only one row per athlete with effective_to null. Sections run in the
-- order they do specifically so that, at the moment each insert fires, the
-- target athlete either has no open row or the row being closed is closed in
-- the same step. Re-ordering sections without checking this will produce a
-- 23505 unique-violation failure that looks like this file is broken, when it
-- is actually the ordering that broke.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;


-- ===========================================================================
-- 1. A coach closes an athlete's ordinary reasonless "available" row, then
-- opens a real non-injury absence — the actual product workflow this
-- migration exists for.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));

-- athlete_2's fixture row: status 'available', no reason, no injury, set by
-- medical. This is what an athlete who has never had an availability event
-- looks like, and it is the common case, not the exception.
select is(
  tests.rows_affected(
    format(
      $q$update availability set effective_to = now()
           where athlete_id = %L and effective_to is null$q$,
      tests.uid('orga', 'athlete_2')
    )
  ),
  1::bigint,
  'a coach CAN close athlete_2''s ordinary, reasonless available row — '
  'availability_coach_update_noninjury (0041) does not require a reason to '
  'already be present, only that there is no injury behind the row'
);

select lives_ok(
  format(
    $q$insert into availability
         (org_id, athlete_id, status, reason_category, note, set_by)
       values (%L, %L, 'unavailable', 'academic', 'Exams, back Monday', %L)$q$,
    tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
    tests.uid('orga', 'user_coach')
  ),
  'and then insert a real, non-injury absence for the same athlete — this is '
  'ADR-008''s entire point'
);

select is(
  (select reason_category::text from availability
    where athlete_id = tests.uid('orga', 'athlete_2') and effective_to is null),
  'academic',
  'reads back with the reason the coach actually chose'
);
select is(
  (select injury_id from availability
    where athlete_id = tests.uid('orga', 'athlete_2') and effective_to is null),
  null,
  'and no injury_id at all — this was never an injury record'
);
select is(
  (select set_by from availability
    where athlete_id = tests.uid('orga', 'athlete_2') and effective_to is null),
  tests.uid('orga', 'user_coach'),
  'attributed to the coach who actually set it'
);


-- ===========================================================================
-- 2. The coach can also close the interval they themselves just opened
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));

select is(
  tests.rows_affected(
    format(
      $q$update availability set effective_to = now()
           where athlete_id = %L and effective_to is null$q$,
      tests.uid('orga', 'athlete_2')
    )
  ),
  1::bigint,
  'a coach CAN close the academic-leave interval they opened in section 1 — '
  'availability_coach_update_noninjury doing the job it exists for'
);

-- athlete_2 now has no open row at all, which the three negative assertions
-- below rely on: each is a refused insert, so none of them ever creates a
-- row, and starting from "no open row" means none of the three can produce
-- a spurious 23505 unique-violation that would be mistaken for the 42501
-- this file is actually checking for.


-- ===========================================================================
-- 3. The three things ADR-008 deliberately still refuses to a coach
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));

-- 3a. reason_category = 'injury' is refused even with no injury_id at all —
-- checked independently of injury_id, per 0041's own header.
select throws_ok(
  format(
    $q$insert into availability (org_id, athlete_id, status, reason_category, set_by)
       values (%L, %L, 'unavailable', 'injury', %L)$q$,
    tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
    tests.uid('orga', 'user_coach')
  ),
  '42501', null,
  'a COACH cannot claim reason_category ''injury'', even without an injury_id'
);

-- 3b. injury_id set is refused even with a non-injury reason_category — a coach
-- cannot launder a link to a real injury behind an administrative-looking
-- reason. injury_id here belongs to athlete_1's fixture injury; the FK only
-- requires the injury to exist, not that it belongs to the athlete named on
-- this row, so this is a clean test of the injury_id check alone.
select throws_ok(
  format(
    $q$insert into availability
         (org_id, athlete_id, status, reason_category, injury_id, set_by)
       values (%L, %L, 'unavailable', 'personal', %L, %L)$q$,
    tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
    tests.uid('orga', 'injury'), tests.uid('orga', 'user_coach')
  ),
  '42501', null,
  'a COACH cannot insert with injury_id set, even alongside a non-injury reason'
);

-- 3c. A blank reason is refused outright. This is also the shape of 030's own
-- "a COACH cannot insert into availability with no reason_category at all"
-- assertion — repeated here against a clean (no open row) athlete rather than
-- athlete_1, so this file does not depend on 030 having run first.
select throws_ok(
  format(
    $q$insert into availability (org_id, athlete_id, status, set_by)
       values (%L, %L, 'available', %L)$q$,
    tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
    tests.uid('orga', 'user_coach')
  ),
  '42501', null,
  'a COACH cannot insert with no reason_category at all'
);


-- ===========================================================================
-- 4. A coach cannot touch athlete_1's medical, injury-linked row — insert or
-- update — no matter what happened to athlete_2 above.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));

-- This insert's own columns (reason_category 'personal', no injury_id) would
-- satisfy availability_coach_insert_noninjury on their own — that is
-- deliberate: the point of this assertion is that a fully valid non-injury
-- row is STILL refused for athlete_1, because athlete_1 already has an open
-- interval and availability_one_open_per_athlete (0005) allows only one. That
-- guard is not new and not RLS; it fires as a unique-constraint violation
-- (23505) rather than a policy refusal (42501), so a coach cannot work around
-- an open medical interval by racing a "valid-looking" insert in ahead of it.
select throws_ok(
  format(
    $q$insert into availability (org_id, athlete_id, status, reason_category, set_by)
       values (%L, %L, 'available', 'personal', %L)$q$,
    tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'),
    tests.uid('orga', 'user_coach')
  ),
  '23505', null,
  'a COACH cannot open a second interval for athlete_1 with a fully valid '
  'non-injury reason either — blocked by the one-open-interval constraint '
  '(0005), since athlete_1 already has an open, injury-linked one'
);

select is(
  tests.rows_affected(
    format(
      $q$update availability set effective_to = now()
           where athlete_id = %L and reason_category = 'injury'$q$,
      tests.uid('orga', 'athlete_1')
    )
  ),
  0::bigint,
  'a coach closing athlete_1''s medical, injury-linked interval changes zero rows'
);
select is((select status::text from availability
            where athlete_id = tests.uid('orga', 'athlete_1') and effective_to is null),
          'modified',
  'and athlete_1 is still modified, untouched by anything in this file'
);


-- ===========================================================================
-- 5. Cross tenant: orgb's coach cannot reach orga through this new policy
-- ===========================================================================

select tests.set_jwt(tests.uid('orgb', 'user_coach'));

select throws_ok(
  format(
    $q$insert into availability
         (org_id, athlete_id, status, reason_category, set_by)
       values (%L, %L, 'unavailable', 'personal', %L)$q$,
    tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
    tests.uid('orgb', 'user_coach')
  ),
  '42501', null,
  'orgb''s coach cannot insert into orga''s availability naming orga''s own '
  'ids, even with a fully valid non-injury reason'
);


-- ===========================================================================
-- 6. Positive control: medical is completely unaffected by any of this
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));

-- effective_to = now() on both inserts, matching 030's own positive-control
-- trick, so neither collides with athlete_1's or athlete_2's current open row.
select lives_ok(
  format(
    $q$insert into availability
         (org_id, athlete_id, status, reason_category, injury_id, set_by, effective_to)
       values (%L, %L, 'unavailable', 'injury', %L, %L, now())$q$,
    tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'),
    tests.uid('orga', 'injury'), tests.uid('orga', 'user_medical')
  ),
  'MEDICAL can still insert an injury-linked row exactly as before — '
  'availability_medical_insert (0012) has no new condition on it'
);
select lives_ok(
  format(
    $q$insert into availability
         (org_id, athlete_id, status, reason_category, set_by, effective_to)
       values (%L, %L, 'unavailable', 'illness', %L, now())$q$,
    tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
    tests.uid('orga', 'user_medical')
  ),
  'and MEDICAL can still insert a non-injury reason too — true before 0041 as '
  'well, since availability_medical_insert never checked reason_category'
);

select * from finish();
rollback;
