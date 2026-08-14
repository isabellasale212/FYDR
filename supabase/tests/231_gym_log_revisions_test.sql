-- 231_gym_log_revisions_test.sql
--
-- Integration-audit blocker B3: gym logging gets the same ADR-005 revision mechanism as
-- wellness/training/nutrition. Migration 0045's own header explains the full design,
-- including why gym_set_logs (fully immutable) and gym_session_logs (a lifecycle envelope
-- with exactly two locked-down submitted columns) are not treated identically.
--
-- Which rules this implements
--   CLAUDE.md §2 rule 6, decisions/adr-005-immutable-entries.md
--   screens/gym-logging.md: "The correction writes a revision, not an update", and edge
--     case 20 (total_volume_kg recomputed on a set correction)
--   070_programmes_test.sql's own assertion — re-proved here, not just assumed — that a
--     session's lifecycle columns are still updated in place after this migration

begin;
select * from no_plan();

select tests.fixtures();

-- Fixture setup bypasses RLS deliberately (same technique 070_programmes_test.sql uses):
-- this file is about the revision functions and the tightened RLS around them, not a
-- re-proof of the ordinary insert rules migration 0021 already covers in full.
do $$
declare
  o    uuid := tests.uid('orga', 'org');
  a1   uuid := tests.uid('orga', 'athlete_1');
  a2   uuid := tests.uid('orga', 'athlete_2');
  ua1  uuid := tests.uid('orga', 'user_athlete_1');
  ex   uuid := tests.uid('orga', 'exercise');
begin
  insert into exercises (id, org_id, name, category)
    values (ex, o, 'Back squat', 'squat');

  -- log_1: in_progress, one live set. Used for the set-revision tests and to prove the
  -- lifecycle columns are still plain updates.
  insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source)
    values (tests.uid('orga','log_1'), o, a1, current_date, 'in_progress', 'self_report');
  insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number,
                            reps_completed, load_kg)
    values (tests.uid('orga','set_1'), o, tests.uid('orga','log_1'), ex, 1, 5, 100);

  -- log_2: already complete, with a session_rpe, for the session-level revision tests.
  insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source,
                                started_at, completed_at, session_rpe)
    values (tests.uid('orga','log_2'), o, a1, current_date, 'complete', 'self_report',
            now() - interval '1 hour', now(), 7.0);

  -- log_3: athlete_2's own complete session, used for the cross-athlete refusal checks.
  insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source,
                                started_at, completed_at, session_rpe)
    values (tests.uid('orga','log_3'), o, a2, current_date, 'complete', 'self_report',
            now() - interval '1 hour', now(), 5.0);
end $$;

set local role authenticated;


-- ===========================================================================
-- 1. gym_set_logs has no update grant at all, for anyone — the wellness pattern,
--    applied here for the first time.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$update gym_set_logs set load_kg = 999 where id = %L$q$,
         tests.uid('orga','set_1')),
  '42501', null,
  'an athlete cannot update their own gym set log directly — revise_gym_set_log is the '
  'only write path to a correction'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$update gym_set_logs set load_kg = 999 where id = %L$q$,
         tests.uid('orga','set_1')),
  '42501', null,
  'a coach cannot update a gym set log either — there is no staff write path onto this '
  'table at all'
);

select throws_ok(
  format($q$delete from gym_set_logs where id = %L$q$, tests.uid('orga','set_1')),
  '42501', null,
  'nobody can delete a gym set log'
);


-- ===========================================================================
-- 2. revise_gym_set_log: the sanctioned correction path
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select throws_ok(
  format($q$select revise_gym_set_log(%L, gen_random_uuid(), '{"load_kg": 60}'::jsonb)$q$,
         tests.uid('orga','set_1')),
  'P0001', 'not_permitted',
  'athlete_2 cannot revise athlete_1''s set'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$select revise_gym_set_log(%L, gen_random_uuid(), '{"load_kg": 60}'::jsonb)$q$,
         tests.uid('orga','set_1')),
  'P0001', 'not_permitted',
  'a coach cannot revise a gym set log either — no staff write path exists'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok(
  format($q$select revise_gym_set_log(%L, gen_random_uuid(), '{"load_kg": 60, "rpe": 7.5}'::jsonb)$q$,
         tests.uid('orga','set_1')),
  'athlete_1 revises their own set — logged 100kg, meant 60kg'
);

select is(
  (select count(*) from gym_set_logs where gym_session_log_id = tests.uid('orga','log_1')),
  2::bigint,
  'the correction created a second row rather than editing the first'
);

select is(
  (select count(*) from gym_set_logs_current
    where gym_session_log_id = tests.uid('orga','log_1')),
  1::bigint,
  'gym_set_logs_current shows only the live revision, ADR-005 rule 3'
);

select is(
  (select load_kg from gym_set_logs_current where gym_session_log_id = tests.uid('orga','log_1')),
  60.00::numeric,
  'the live row carries the corrected load'
);

select is(
  (select load_kg from gym_set_logs where id = tests.uid('orga','set_1')),
  100.00::numeric,
  'the original row is retained, untouched, at its original value'
);

select ok(
  (select superseded_by is not null from gym_set_logs where id = tests.uid('orga','set_1')),
  'the original is marked superseded'
);

select ok(
  (select revision_of = tests.uid('orga','set_1')
     from gym_set_logs_current where gym_session_log_id = tests.uid('orga','log_1')),
  'the revision points back at the row it corrects'
);

select is(
  (select reps_completed from gym_set_logs_current
    where gym_session_log_id = tests.uid('orga','log_1')),
  5,
  'a field not present in the payload carries over from the original (reps_completed)'
);

-- Replaying the same correction (the original id is no longer the current revision) fails
-- loudly rather than silently doing nothing or double-applying.
select throws_ok(
  format($q$select revise_gym_set_log(%L, gen_random_uuid(), '{"load_kg": 70}'::jsonb)$q$,
         tests.uid('orga','set_1')),
  'P0001', 'entry_not_revisable',
  'revising the now-superseded original again fails loudly — only the current revision may be revised'
);

-- Edge case 20: total_volume_kg recomputed from live sets only.
select is(
  (select total_volume_kg from gym_session_logs where id = tests.uid('orga','log_1')),
  (select volume_kg from gym_set_logs_current
    where gym_session_log_id = tests.uid('orga','log_1')),
  'total_volume_kg on the parent session was recomputed from the corrected set, not the '
  'superseded one'
);


-- ===========================================================================
-- 3. The one-live-set-per-slot unique index makes a retried write safe
-- ===========================================================================

select throws_ok(
  format($q$insert into gym_set_logs (org_id, gym_session_log_id, exercise_id, set_number,
                                      reps_completed, load_kg)
            values (%L, %L, %L, 1, 5, 999)$q$,
         tests.uid('orga','org'), tests.uid('orga','log_1'), tests.uid('orga','exercise')),
  '23505', null,
  'a second live row for the same session/exercise/set slot is refused — this is what '
  'makes a retried logSet write safe'
);


-- ===========================================================================
-- 4. gym_session_logs: lifecycle columns are still plain, in-place updates
--    (070_programmes_test.sql's own claim, re-proved here after the RLS tightening)
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok(
  format($q$update gym_session_logs set status = 'complete', completed_at = now(),
              session_rpe = 6.5
            where id = %L$q$, tests.uid('orga','log_1')),
  'an athlete can still complete their own in_progress session in one plain update, '
  'setting session_rpe for the first time as part of it'
);

-- An UPDATE a policy filters out affects zero rows rather than raising (correct Postgres
-- behaviour, same reasoning as 030_medical_and_entry_rules_test.sql's own comment on this
-- exact shape of assertion) — athlete_2 owns no matching row, so this is a row-count
-- assertion, not a throws_ok.
select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is(
  tests.rows_affected(
    format($q$update gym_session_logs set status = 'abandoned' where id = %L$q$,
           tests.uid('orga','log_1'))
  ),
  0::bigint,
  'athlete_2 updating athlete_1''s session log changes zero rows'
);
-- Re-checked as the owner: athlete_2 has no select on athlete_1's session at all, so
-- reading it back under athlete_2's own JWT would just prove the select boundary, not
-- the update one.
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select status::text from gym_session_logs where id = tests.uid('orga','log_1')),
  'complete',
  'and the session is still complete, which is what athlete_2 tried to change'
);


-- ===========================================================================
-- 5. session_rpe / comment are locked once complete — the column grant plus the
--    state-checking trigger, both closing the same hole
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$update gym_session_logs set session_rpe = 9.0 where id = %L$q$,
         tests.uid('orga','log_2')),
  'P0001', 'entry_not_revisable',
  'a direct update of session_rpe on an already-complete session is refused — '
  'revise_gym_session_log is the only path once it is submitted'
);

select throws_ok(
  format($q$update gym_session_logs set comment = 'sneaking this in' where id = %L$q$,
         tests.uid('orga','log_2')),
  'P0001', 'entry_not_revisable',
  'same rule for comment'
);

select lives_ok(
  format($q$update gym_session_logs set total_volume_kg = 1234.5 where id = %L$q$,
         tests.uid('orga','log_2')),
  'a lifecycle column (total_volume_kg) on a complete session is still a plain update — '
  'only session_rpe and comment are locked'
);

select throws_ok(
  format($q$update gym_session_logs set revision_of = %L where id = %L$q$,
         tests.uid('orga','log_1'), tests.uid('orga','log_2')),
  '42501', null,
  'an athlete cannot set revision_of directly — the column grant omits it entirely, '
  'RPC only'
);

select throws_ok(
  format($q$update gym_session_logs set superseded_by = gen_random_uuid() where id = %L$q$,
         tests.uid('orga','log_2')),
  '42501', null,
  'and cannot set superseded_by directly either, for the same reason'
);


-- ===========================================================================
-- 6. revise_gym_session_log: only a COMPLETE session, athlete-only, child sets
--    re-pointed so the current session keeps its sets
-- ===========================================================================

-- Build a genuinely in_progress session to prove the status gate.
do $$
begin
  insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source)
    values (tests.uid('orga','log_4'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
            current_date, 'in_progress', 'self_report');
end $$;

select throws_ok(
  format($q$select revise_gym_session_log(%L, gen_random_uuid(), '{"session_rpe": 9.0}'::jsonb)$q$,
         tests.uid('orga','log_4')),
  'P0001', 'entry_not_revisable',
  'an in_progress session has nothing submitted yet to revise'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select throws_ok(
  format($q$select revise_gym_session_log(%L, gen_random_uuid(), '{"session_rpe": 9.0}'::jsonb)$q$,
         tests.uid('orga','log_2')),
  'P0001', 'not_permitted',
  'athlete_2 cannot revise athlete_1''s session'
);

-- Give log_3 (athlete_2's own complete session) a child set, so the re-pointing behaviour
-- is actually exercised, not just asserted about an empty session.
do $$
begin
  insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number,
                            reps_completed, load_kg)
    values (tests.uid('orga','set_3'), tests.uid('orga','org'), tests.uid('orga','log_3'),
            tests.uid('orga','exercise'), 1, 8, 40);
end $$;

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select lives_ok(
  format($q$select revise_gym_session_log(%L, gen_random_uuid(), '{"session_rpe": 8.0, "comment": "felt heavy"}'::jsonb)$q$,
         tests.uid('orga','log_3')),
  'athlete_2 revises the session RPE and adds a comment on their own complete session'
);

select is(
  (select count(*) from gym_session_logs where athlete_id = tests.uid('orga','athlete_2')),
  2::bigint,
  'the correction created a second session row rather than editing the first'
);

select is(
  (select count(*) from gym_session_logs_current
    where athlete_id = tests.uid('orga','athlete_2')),
  1::bigint,
  'gym_session_logs_current shows only the live revision'
);

select is(
  (select session_rpe from gym_session_logs_current
    where athlete_id = tests.uid('orga','athlete_2')),
  8.0::numeric,
  'the live row carries the corrected session RPE'
);

select is(
  (select session_rpe from gym_session_logs where id = tests.uid('orga','log_3')),
  5.0::numeric,
  'the original session row is retained, untouched, at its original RPE'
);

select is(
  (select count(*) from gym_set_logs where gym_session_log_id = tests.uid('orga','log_3')),
  0::bigint,
  'the set that was live under the original session id has been re-pointed away from it'
);

select is(
  (select gym_session_log_id from gym_set_logs where id = tests.uid('orga','set_3')),
  (select id from gym_session_logs_current where athlete_id = tests.uid('orga','athlete_2')),
  'and now belongs to the current (revised) session log — the current session keeps its sets'
);

select is(
  (select count(*) from gym_set_logs
    where gym_session_log_id =
      (select id from gym_session_logs_current where athlete_id = tests.uid('orga','athlete_2'))),
  1::bigint,
  'exactly the one set is attached to the current session, not duplicated'
);

select * from finish();
rollback;
