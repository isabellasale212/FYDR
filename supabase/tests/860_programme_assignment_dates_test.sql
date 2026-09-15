-- 860_programme_assignment_dates_test.sql
--
-- Migration 0132: gym programmes get dates, and the dates live on the
-- assignment — docs/decisions/programme-dates.md (Isabella, 15 September
-- 2026). Written BEFORE the migration, per CLAUDE.md §5.
--
-- The shape
--   A programme stays a template (weeks and sessions, no dates). An assignment
--   carries a start date, chosen by the S&C when they assign; there is no end
--   date — the end falls out of the start plus the programme's length; week 1
--   day 1 is the start date. Overlap is allowed. When the weeks run out the
--   assignment is over and the programme screen says so. Existing assignments
--   are left unmapped (no start date), never given an invented one.
--
-- What this file asserts
--   1. programme_assignments.starts_on is nullable with no default; ends_on is
--      gone; a fixture assignment written before the migration reads null.
--   2. programme_length_weeks(programme) is the sum of its blocks' weeks
--      (the programme's own duration_weeks when it has no blocks);
--      programme_assignment_ends_on(start, programme) is start + weeks·7 − 1,
--      null for an unmapped assignment.
--   3. resolve_my_programme_sessions carries the assignment's start, its end
--      and each session's scheduled date (week 1 day 1 = the start; block
--      weeks count forward), null throughout for an unmapped assignment.
--   4. Overlap: an athlete with two live assignments reads both.
--   5. resolve_my_assigned_sessions_by_week counts nothing for an unmapped
--      assignment and stops counting after the last week.
--   6. Who sets the date: the S&C (and the sport scientist) update starts_on;
--      the coach cannot.

begin;
select * from no_plan();

select tests.fixtures();

-- ===========================================================================
-- 1. The columns
-- ===========================================================================

select col_is_null('public', 'programme_assignments', 'starts_on', 'starts_on is nullable — an unmapped assignment has none');
select col_hasnt_default('public', 'programme_assignments', 'starts_on', 'and no default: a date is chosen, never invented');
select hasnt_column('public', 'programme_assignments', 'ends_on', 'ends_on is gone: the end falls out of the start and the length');

-- A two-block programme: 2 + 2 weeks; week 1 has two sessions, week 2 three,
-- block 2 week 1 one — 340's shape.
insert into public.programmes (id, org_id, name, programme_type, status, created_by)
values (tests.uid('orga','p860'), tests.uid('orga','org'), 'Dated block', 'gym', 'active', tests.uid('orga','user_sc'));
insert into public.programme_blocks (id, org_id, programme_id, name, sequence, duration_weeks)
values (tests.uid('orga','b860_1'), tests.uid('orga','org'), tests.uid('orga','p860'), 'Accumulation', 1, 2),
       (tests.uid('orga','b860_2'), tests.uid('orga','org'), tests.uid('orga','p860'), 'Intensification', 2, 2);
insert into public.programme_sessions (id, org_id, block_id, name, week_number, day_number, sequence)
values (tests.uid('orga','s860_11'), tests.uid('orga','org'), tests.uid('orga','b860_1'), 'Lower A', 1, 1, 1),
       (tests.uid('orga','s860_13'), tests.uid('orga','org'), tests.uid('orga','b860_1'), 'Upper A', 1, 3, 2),
       (tests.uid('orga','s860_21'), tests.uid('orga','org'), tests.uid('orga','b860_1'), 'Lower B', 2, 1, 3),
       (tests.uid('orga','s860_b2'), tests.uid('orga','org'), tests.uid('orga','b860_2'), 'Peak', 1, 2, 4);

-- ===========================================================================
-- 2. The arithmetic, once, in the database
-- ===========================================================================

select is(public.programme_length_weeks(tests.uid('orga','p860')), 4, 'a 2 + 2 week programme is 4 weeks long');
select is(public.programme_assignment_ends_on(date '2026-01-05', tests.uid('orga','p860')), date '2026-02-01',
  'started Monday 5 Jan, four weeks: the last day is Sunday 1 Feb (start + 4·7 − 1)');
select is(public.programme_assignment_ends_on(null, tests.uid('orga','p860')), null::date, 'an unmapped assignment has no end either');

-- An assignment with a start, one without (left as the migration leaves
-- every existing row), and — §4 — a second live one for the same athlete.
insert into public.programme_assignments (id, org_id, programme_id, athlete_id, starts_on, assigned_by)
values (tests.uid('orga','pa860_dated'), tests.uid('orga','org'), tests.uid('orga','p860'), tests.uid('orga','athlete_1'), date '2026-01-05', tests.uid('orga','user_sc'));
insert into public.programme_assignments (id, org_id, programme_id, athlete_id, assigned_by)
values (tests.uid('orga','pa860_unmapped'), tests.uid('orga','org'), tests.uid('orga','p860'), tests.uid('orga','athlete_2'), tests.uid('orga','user_sc'));

select is(
  (select starts_on from public.programme_assignments where id = tests.uid('orga','pa860_unmapped')),
  null::date,
  'an assignment written without a date has none — nothing invents one'
);

-- ===========================================================================
-- 3. The athlete's sessions carry the dates
-- ===========================================================================

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged');
select tests.set_jwt(tests.uid('orga','user_athlete_1'));

select is(
  (select (assignment_starts_on, assignment_ends_on, scheduled_on)
     from public.resolve_my_programme_sessions(tests.uid('orga','athlete_1'))
    where session_id = tests.uid('orga','s860_11')),
  (date '2026-01-05', date '2026-02-01', date '2026-01-05'),
  'week 1 day 1 is the start date, and the row carries the assignment''s start and end'
);
select is(
  (select scheduled_on from public.resolve_my_programme_sessions(tests.uid('orga','athlete_1')) where session_id = tests.uid('orga','s860_13')),
  date '2026-01-07',
  'week 1 day 3 is two days on'
);
select is(
  (select scheduled_on from public.resolve_my_programme_sessions(tests.uid('orga','athlete_1')) where session_id = tests.uid('orga','s860_21')),
  date '2026-01-12',
  'week 2 day 1 is a week on'
);
select is(
  (select scheduled_on from public.resolve_my_programme_sessions(tests.uid('orga','athlete_1')) where session_id = tests.uid('orga','s860_b2')),
  date '2026-01-20',
  'block 2 week 1 day 2 counts forward through block 1''s two weeks: 19 Jan + 1'
);

select tests.set_jwt(tests.uid('orga','user_athlete_2'));
select is(
  (select count(*)::int from public.resolve_my_programme_sessions(tests.uid('orga','athlete_2'))
    where assignment_starts_on is null and assignment_ends_on is null and scheduled_on is null),
  4,
  'an unmapped assignment: the sessions are there, with no dates on any of them'
);

-- ===========================================================================
-- 4. Overlap is allowed
-- ===========================================================================

reset role;
insert into public.programmes (id, org_id, name, programme_type, status, created_by)
values (tests.uid('orga','p860_rehab'), tests.uid('orga','org'), 'Hamstring rehab', 'rehab', 'active', tests.uid('orga','user_medical'));
insert into public.programme_blocks (id, org_id, programme_id, name, sequence, duration_weeks)
values (tests.uid('orga','b860_r'), tests.uid('orga','org'), tests.uid('orga','p860_rehab'), 'Rehab', 1, 3);
insert into public.programme_sessions (id, org_id, block_id, name, week_number, day_number, sequence)
values (tests.uid('orga','s860_r1'), tests.uid('orga','org'), tests.uid('orga','b860_r'), 'Isometrics', 1, 1, 1);
insert into public.programme_assignments (id, org_id, programme_id, athlete_id, starts_on, assigned_by)
values (tests.uid('orga','pa860_rehab'), tests.uid('orga','org'), tests.uid('orga','p860_rehab'), tests.uid('orga','athlete_1'), date '2026-01-12', tests.uid('orga','user_medical'));

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');
select tests.set_jwt(tests.uid('orga','user_athlete_1'));
select is(
  (select count(distinct programme_id)::int from public.resolve_my_programme_sessions(tests.uid('orga','athlete_1'))
    where programme_id in (tests.uid('orga','p860'), tests.uid('orga','p860_rehab'))),
  2,
  'two live assignments at once, both read — a rehab block beside a lifting block'
);

-- ===========================================================================
-- 5. The by-week denominator: nothing for an unmapped assignment, nothing
--    after the last week
-- ===========================================================================

select is(
  (select coalesce(sum(assigned), 0)::int from public.resolve_my_assigned_sessions_by_week(tests.uid('orga','athlete_1'), date '2026-02-02', date '2026-02-28')),
  0,
  'the week after the block''s last week assigns nothing: the assignment is over'
);
select tests.set_jwt(tests.uid('orga','user_athlete_2'));
select is(
  (select coalesce(sum(assigned), 0)::int from public.resolve_my_assigned_sessions_by_week(tests.uid('orga','athlete_2'), date '2026-01-05', date '2026-03-01')),
  0,
  'an unmapped assignment counts nothing by week — it has no weeks'
);

-- ===========================================================================
-- 6. Who sets the date
-- ===========================================================================

select tests.set_jwt(tests.uid('orga','user_sc'));
select lives_ok(
  format($q$update public.programme_assignments set starts_on = date '2026-03-02' where id = %L$q$, tests.uid('orga','pa860_unmapped')),
  'the S&C sets a start date on an unmapped assignment the next time they touch it'
);
select is(
  (select starts_on from public.programme_assignments where id = tests.uid('orga','pa860_unmapped')),
  date '2026-03-02',
  'and it landed'
);
select tests.set_jwt(tests.uid('orga','user_coach'));
select throws_ok(
  format($q$update public.programme_assignments set starts_on = date '2026-03-09' where id = %L$q$, tests.uid('orga','pa860_unmapped')),
  '42501', null,
  'the coach cannot'
);

select * from finish();
rollback;
