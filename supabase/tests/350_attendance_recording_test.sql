-- Who may record attendance, and who may only read it (2026-09-06).
--
-- The pair of facts this file exists to keep together: the timetable is open to
-- every staff role, and recording attendance is the sport scientist and the
-- coach. A test that only checked the refusals would also pass if the page had
-- simply been closed to everyone, which is the outcome this decision explicitly
-- rejected -- so every refusing role is also asserted to READ.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. Recording: the sport scientist and the coach
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
/* Upsert, not a bare insert, because that is what recordAttendance does and
   because the fixtures already hold a row for this pair -- a plain insert dies
   on 23505, the unique constraint refusing the ROW, which would say nothing
   about whether the policy admitted the PERSON. */
select lives_ok(
  format($q$insert into session_attendance (org_id, session_id, athlete_id, attendance, recorded_by)
            values (%L, %L, %L, 'full', %L) on conflict (session_id, athlete_id)
            do update set attendance = excluded.attendance$q$,
         tests.uid('orga','org'), tests.uid('orga','session'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_coach')),
  'the coach records attendance'
);

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$insert into session_attendance (org_id, session_id, athlete_id, attendance, recorded_by)
            values (%L, %L, %L, 'full', %L) on conflict (session_id, athlete_id)
            do update set attendance = excluded.attendance$q$,
         tests.uid('orga','org'), tests.uid('orga','session'), tests.uid('orga','athlete_2'),
         tests.uid('orga','user_admin')),
  'and so does the sport scientist'
);


-- ===========================================================================
-- 2. The three that may not -- including the medic, which is the change
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$insert into session_attendance (org_id, session_id, athlete_id, attendance, recorded_by)
            values (%L, %L, %L, 'absent', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','session'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_medical')),
  '42501', null,
  'the MEDIC can no longer record attendance -- narrowed 2026-09-06, this role could before'
);

select tests.set_jwt(tests.uid('orga', 'user_sc'));
select throws_ok(
  format($q$insert into session_attendance (org_id, session_id, athlete_id, attendance, recorded_by)
            values (%L, %L, %L, 'absent', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','session'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_sc')),
  '42501', null,
  'nor the S&C'
);

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select throws_ok(
  format($q$insert into session_attendance (org_id, session_id, athlete_id, attendance, recorded_by)
            values (%L, %L, %L, 'absent', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','session'), tests.uid('orga','athlete_1'),
         tests.uid('orga','user_nutritionist')),
  '42501', null,
  'nor the nutritionist'
);

-- Amending an existing row is the same rule. The app upserts, so both halves are
-- reachable from one control.
select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$update session_attendance set attendance = 'absent' where org_id = %L$q$,
         tests.uid('orga','org')),
  'the medic''s UPDATE is not refused by privilege -- the grant exists, so RLS is what holds'
);
select is(
  (select count(*) from session_attendance
    where org_id = tests.uid('orga','org') and attendance = 'absent'),
  0::bigint,
  'and it moved NOTHING: amending attendance is the same two roles'
);


-- ===========================================================================
-- 3. But every staff role still READS it
--
-- This is the half that makes the decision what it is rather than a closure.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select cmp_ok((select count(*) from session_attendance where org_id = tests.uid('orga','org')),
  '>', 0::bigint, 'the medic reads attendance');
select tests.set_jwt(tests.uid('orga', 'user_sc'));
select cmp_ok((select count(*) from session_attendance where org_id = tests.uid('orga','org')),
  '>', 0::bigint, 'the S&C reads attendance -- the timetable is open to them now');
select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select cmp_ok((select count(*) from session_attendance where org_id = tests.uid('orga','org')),
  '>', 0::bigint, 'and so does the nutritionist');

select * from finish();
rollback;
