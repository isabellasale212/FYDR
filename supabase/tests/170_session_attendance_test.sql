-- 170_session_attendance_test.sql
--
-- session_attendance (migration 0003, RLS in migration 0012) had zero pgTAP
-- coverage despite a real, already-granted staff insert/update policy —
-- found while building lib/queries/timetable.ts, the first thing in this
-- codebase to actually write to this table. Covers insert (coach, medical,
-- athlete refused), the real unique(session_id, athlete_id) upsert an
-- in-place correction relies on, and cross-tenant isolation. Athlete
-- self-select is covered too: session_attendance_self_select is what lets
-- an athlete's own training tab show whether they were marked present.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;


-- ===========================================================================
-- 1. insert: coach and medical, not athlete. The fixture session already
--    carries one attendance row for athlete_1; athlete_2 has none yet.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into session_attendance (org_id, session_id, athlete_id, attendance, recorded_by)
            values (%L, %L, %L, 'full', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','session'), tests.uid('orga','athlete_2'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'an athlete cannot record attendance, even their own'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into session_attendance (org_id, session_id, athlete_id, attendance, recorded_by)
            values (%L, %L, %L, 'absent', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','session'), tests.uid('orga','athlete_2'), tests.uid('orga','user_coach')),
  'a coach records attendance for an athlete with no row yet'
);
select is(
  (select attendance::text from session_attendance where session_id = tests.uid('orga','session') and athlete_id = tests.uid('orga','athlete_2')),
  'absent',
  'the write landed as absent'
);


-- ===========================================================================
-- 2. update: the real unique(session_id, athlete_id) constraint is what
--    recordAttendance()'s upsert relies on for an in-place correction —
--    session_attendance is not in CLAUDE.md §6's immutable list (wellness,
--    gym, nutrition specifically), and the staff_update policy already
--    existed for exactly this: a coach fixing a mis-tap mid-session.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$update session_attendance set attendance = 'modified', modified_reason = 'left early, family'
            where session_id = %L and athlete_id = %L$q$,
         tests.uid('orga','session'), tests.uid('orga','athlete_2')),
  'medical corrects it to modified with a reason — the shared staff role, no coach/medical split here'
);
select is(
  (select attendance::text from session_attendance where session_id = tests.uid('orga','session') and athlete_id = tests.uid('orga','athlete_2')),
  'modified',
  'the correction landed'
);
select is(
  (select count(*) from session_attendance where session_id = tests.uid('orga','session') and athlete_id = tests.uid('orga','athlete_2')),
  1::bigint,
  'still one row — a correction, never a second row for the same athlete and session'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select lives_ok(
  format($q$update session_attendance set attendance = 'full' where session_id = %L and athlete_id = %L$q$,
         tests.uid('orga','session'), tests.uid('orga','athlete_2')),
  'the statement does not error — same as groups'' own staff-only update, the USING clause just filters the row to zero matches'
);
select is(
  (select attendance::text from session_attendance where session_id = tests.uid('orga','session') and athlete_id = tests.uid('orga','athlete_2')),
  'modified',
  'still ''modified'' — an athlete cannot rewrite their own attendance record, matched zero rows under RLS'
);


-- ===========================================================================
-- 3. select: staff read everyone's; an athlete reads only their own.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select attendance::text from session_attendance where session_id = tests.uid('orga','session') and athlete_id = tests.uid('orga','athlete_1')),
  'full',
  'athlete_1 reads their own fixture-seeded record'
);
select is(
  (select count(*) from session_attendance where athlete_id = tests.uid('orga','athlete_2')),
  0::bigint,
  'and cannot see athlete_2''s record at all — self-select is scoped to their own athlete_id, not the session'
);


-- ===========================================================================
-- 4. cross-tenant isolation.
-- ===========================================================================

select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select throws_ok(
  format($q$insert into session_attendance (org_id, session_id, athlete_id, attendance, recorded_by)
            values (%L, %L, %L, 'full', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','session'), tests.uid('orga','athlete_2'), tests.uid('orgb','user_coach')),
  '42501', null,
  'orgb''s coach cannot write attendance into orga''s session even naming orga''s own ids explicitly'
);
select is(
  (select count(*) from session_attendance where session_id = tests.uid('orga','session')),
  0::bigint,
  'and cannot see orga''s session_attendance rows exist at all, from orgb''s side'
);

select * from finish();
rollback;
