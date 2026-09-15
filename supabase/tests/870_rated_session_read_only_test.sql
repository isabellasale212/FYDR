-- 870_rated_session_read_only_test.sql
--
-- Migration 0133: a rated session is read-only at the database — the
-- PATTERN-S4 C4 rule (B6, 13 September 2026) and its 15 September extension
-- to the schedule grid, now held below both screens (Isabella, the pre-deploy
-- fixes, #2): "A stale tab can still move a rated session, which is the exact
-- hole the ruling was about … The database is the last line here the same
-- way it is for injury and availability."
--
-- Written BEFORE the migration, per CLAUDE.md §5.
--
-- What this file asserts
--   1. A session with a live rating (a training_entries row, not superseded)
--      refuses a change to starts_at, and to duration_min, with a loud
--      exception — not a filtered row.
--   2. Everything the sentence does not tie to a rating still moves: the
--      title, the location, the type, the matchday offset, cancellation.
--   3. An unrated session moves freely; a session whose only rating was
--      superseded and never re-rated is unrated for this purpose.
--   4. The rule is the table's, not a role's: the sport scientist is refused
--      as the coach is.

begin;
select * from no_plan();

select tests.fixtures();

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged');
select tests.set_jwt(tests.uid('orga','user_admin'));

-- The fixture session is rated by athlete_1 (a live training_entries row).
select is(
  (select count(*)::int from public.training_entries where session_id = tests.uid('orga','session') and superseded_by is null),
  1,
  'the fixture session carries one live rating'
);

-- 1. Date and duration are refused
select throws_ok(
  format($q$update public.sessions set starts_at = starts_at + interval '1 hour' where id = %L$q$, tests.uid('orga','session')),
  'P0001', 'session_rated_read_only',
  'moving a rated session''s start is refused, loudly'
);
select throws_ok(
  format($q$update public.sessions set duration_min = 45 where id = %L$q$, tests.uid('orga','session')),
  'P0001', 'session_rated_read_only',
  'changing its duration is refused'
);
select throws_ok(
  format($q$update public.sessions set starts_at = starts_at + interval '1 day', duration_min = 30 where id = %L$q$, tests.uid('orga','session')),
  'P0001', 'session_rated_read_only',
  'both at once, the same'
);

-- 2. What the rating is not tied to still moves
select lives_ok(
  format($q$update public.sessions set title = 'Renamed', location = 'Top pitch', md_offset = -2 where id = %L$q$, tests.uid('orga','session')),
  'the title, the location and the matchday offset are not the rating''s: they change'
);
select lives_ok(
  format($q$update public.sessions set status = 'cancelled' where id = %L$q$, tests.uid('orga','session')),
  'cancelling stays available — "cancel it and create a new one"'
);
select is(
  (select status::text from public.sessions where id = tests.uid('orga','session')),
  'cancelled',
  'and it landed'
);

-- 4. Not a role thing: the coach is refused the same way
select tests.set_jwt(tests.uid('orga','user_coach'));
select throws_ok(
  format($q$update public.sessions set starts_at = starts_at + interval '1 hour' where id = %L$q$, tests.uid('orga','session')),
  'P0001', 'session_rated_read_only',
  'the coach is refused as the sport scientist was'
);

-- 3. An unrated session moves freely
select tests.set_jwt(tests.uid('orga','user_admin'));
insert into public.sessions (id, org_id, season_id, title, session_type, starts_at, duration_min, status, created_by)
values (tests.uid('orga','ses870'), tests.uid('orga','org'), tests.uid('orga','season'), 'Unrated', 'training', now() + interval '2 days', 60, 'planned', tests.uid('orga','user_admin'));
select lives_ok(
  format($q$update public.sessions set starts_at = starts_at + interval '1 hour', duration_min = 75 where id = %L$q$, tests.uid('orga','ses870')),
  'an unrated session''s date and duration change'
);

-- A rating that was superseded and never replaced is no rating. A row may
-- not supersede itself (0004's check), so the superseding row is a
-- correction filed against the unrated session above.
reset role;
insert into public.training_entries (id, org_id, athlete_id, session_id, entry_date, rpe, duration_min, source, created_by)
values (tests.uid('orga','te870'), tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','ses870'), current_date, 6.0, 60, 'self_report', tests.uid('orga','user_athlete_1'));
update public.training_entries set superseded_by = tests.uid('orga','te870') where session_id = tests.uid('orga','session');
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');
select tests.set_jwt(tests.uid('orga','user_admin'));
select is(
  (select count(*)::int from public.training_entries where session_id = tests.uid('orga','session') and superseded_by is null),
  0,
  'the fixture rating is now superseded with nothing live in its place'
);
select lives_ok(
  format($q$update public.sessions set duration_min = 45 where id = %L$q$, tests.uid('orga','session')),
  'with no live rating the session moves again'
);

select * from finish();
rollback;
