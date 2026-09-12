-- 610_training_submitted_at_clamp_test.sql
--
-- §0ad, Builder Q6, decided by Isabella 2026-09-12: the outbox sends the time a
-- rating was queued on the phone, and the database uses it as submitted_at
-- "when it is earlier than the arrival time AND within 24 hours of it;
-- otherwise use the arrival time". Migration 0105 puts that rule in a BEFORE
-- INSERT trigger on training_entries, so a client can only ever move its own
-- submission EARLIER, by at most a day — an athlete rating pitch-side with no
-- signal is not marked missing, and a device clock is not trusted further
-- than that. Every case runs as the athlete under RLS, the path the outbox
-- takes:
--
--   1. no submitted_at sent          → the arrival time (the default, unchanged)
--   2. queued two hours ago          → kept
--   3. queued exactly 24 hours ago   → kept (the boundary is inclusive)
--   4. queued 30 hours ago           → the arrival time (too old to trust)
--   5. queued "in the future"        → the arrival time (a clock set ahead)
--   6. a staff correction's row      → the correction's own now(), untouched
--
-- In a transaction now() is fixed, so "arrival" is the same instant for every
-- insert here and the comparisons are exact.

begin;
select * from no_plan();

select tests.fixtures();

-- Five sessions athlete_1 is named into, one per case (one live entry per
-- athlete per session per day).
do $$
declare
  o    uuid := tests.uid('orga', 'org');
  sea  uuid := tests.uid('orga', 'season');
  a1   uuid := tests.uid('orga', 'athlete_1');
  ucoa uuid := tests.uid('orga', 'user_coach');
  k    text;
begin
  foreach k in array array['clamp_1', 'clamp_2', 'clamp_3', 'clamp_4', 'clamp_5'] loop
    insert into sessions (id, org_id, season_id, session_type, title, starts_at, duration_min, status, created_by)
    values (tests.uid('orga', k), o, sea, 'training', k, now() - interval '3 hours', 60, 'completed', ucoa);
    insert into session_participants (org_id, session_id, athlete_id) values (o, tests.uid('orga', k), a1);
  end loop;
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged for the assertions below');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

-- 1. Nothing sent: the default stands.
insert into training_entries (id, org_id, athlete_id, session_id, entry_date, rpe, duration_min, source, created_by)
values (tests.uid('orga', 'entry_1'), tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), tests.uid('orga', 'clamp_1'), current_date, 6.0, 60, 'self_report', tests.uid('orga', 'user_athlete_1'));
select is((select submitted_at from training_entries where id = tests.uid('orga', 'entry_1')), now(),
  '1. with nothing sent, submitted_at is the arrival time');

-- 2. Queued two hours ago: kept.
insert into training_entries (id, org_id, athlete_id, session_id, entry_date, rpe, duration_min, source, created_by, submitted_at)
values (tests.uid('orga', 'entry_2'), tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), tests.uid('orga', 'clamp_2'), current_date, 6.0, 60, 'self_report', tests.uid('orga', 'user_athlete_1'), now() - interval '2 hours');
select is((select submitted_at from training_entries where id = tests.uid('orga', 'entry_2')), now() - interval '2 hours',
  '2. a rating queued two hours before it arrived keeps the queue time');

-- 3. Exactly 24 hours: the boundary is inclusive.
insert into training_entries (id, org_id, athlete_id, session_id, entry_date, rpe, duration_min, source, created_by, submitted_at)
values (tests.uid('orga', 'entry_3'), tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), tests.uid('orga', 'clamp_3'), current_date, 6.0, 60, 'self_report', tests.uid('orga', 'user_athlete_1'), now() - interval '24 hours');
select is((select submitted_at from training_entries where id = tests.uid('orga', 'entry_3')), now() - interval '24 hours',
  '3. exactly 24 hours earlier is still within the day, and kept');

-- 4. Thirty hours: a clock set wrong, or a queue too old to trust.
insert into training_entries (id, org_id, athlete_id, session_id, entry_date, rpe, duration_min, source, created_by, submitted_at)
values (tests.uid('orga', 'entry_4'), tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), tests.uid('orga', 'clamp_4'), current_date, 6.0, 60, 'self_report', tests.uid('orga', 'user_athlete_1'), now() - interval '30 hours');
select is((select submitted_at from training_entries where id = tests.uid('orga', 'entry_4')), now(),
  '4. thirty hours earlier is not trusted: the arrival time is used');

-- 5. A clock set ahead: the future is never earlier.
insert into training_entries (id, org_id, athlete_id, session_id, entry_date, rpe, duration_min, source, created_by, submitted_at)
values (tests.uid('orga', 'entry_5'), tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'), tests.uid('orga', 'clamp_5'), current_date, 6.0, 60, 'self_report', tests.uid('orga', 'user_athlete_1'), now() + interval '10 minutes');
select is((select submitted_at from training_entries where id = tests.uid('orga', 'entry_5')), now(),
  '5. a time from a clock set ahead is replaced by the arrival time');

-- 6. A staff correction inserts its own now(): the same instant, so untouched.
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$select revise_training_entry(%L, %L, '{"rpe": 7}'::jsonb)$q$, tests.uid('orga', 'entry_2'), tests.uid('orga', 'entry_2_rev')),
  '6. a staff correction still inserts'
);
select is(
  (select submitted_at from training_entries where revision_of = tests.uid('orga', 'entry_2')),
  now(),
  'and its revision carries the correction''s own time, not the original''s queue time'
);
select is(
  (select submitted_at from training_entries where id = tests.uid('orga', 'entry_2')),
  now() - interval '2 hours',
  'while the original keeps the athlete''s — the row the compliance cutoff judges'
);

select * from finish();
rollback;
