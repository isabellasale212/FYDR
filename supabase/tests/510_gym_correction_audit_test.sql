-- A gym correction leaves a trail, and the trail says what the value used to be.
--
-- THE FACT BEING FIXED. On 2026-09-09 a live set on production read -3 reps and
-- -300.00 kg of volume, and audit_log could not say who wrote it: the table held
-- zero rows mentioning gym, ever, while recording every sign-in and every
-- availability change in the same ten minutes. gym_set_logs is the table in this
-- codebase built specifically around keeping a revision history, and it was the
-- one nobody could ask a question of.
--
-- WHAT THIS FILE PROVES THAT READING 0096 CANNOT. That the trigger is ATTACHED,
-- that it fires for a write the application did not choose to log, that the row
-- it writes is legible to the person who would be asked for it, and — the part a
-- migration cannot assert about itself — that the WHEN clause keeps ordinary set
-- logging out. Nothing here calls the audit function directly; that would prove
-- the function exists rather than that anything invokes it.
--
-- WRITTEN AS THE ATHLETE, READ AS THE SPORT SCIENTIST, for 430's reason:
-- audit_log's only select policy is sport_scientist, so asserting as the writer
-- finds zero rows for everything and calls a working trigger broken.

begin;
select * from no_plan();

select tests.fixtures();

-- Fixture setup bypasses RLS deliberately, the same way 231 does: this file is
-- about the audit trigger, not a re-proof of migration 0021's insert rules.
do $$
declare
  o  uuid := tests.uid('orga', 'org');
  a1 uuid := tests.uid('orga', 'athlete_1');
  ex uuid := tests.uid('orga', 'exercise');
begin
  insert into exercises (id, org_id, name, category) values (ex, o, 'Back squat', 'squat');

  insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source)
    values (tests.uid('orga','log_1'), o, a1, current_date, 'in_progress', 'self_report');
  insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number,
                            reps_completed, load_kg)
    values (tests.uid('orga','set_1'), o, tests.uid('orga','log_1'), ex, 1, 5, 100);

  -- Complete, with both submitted fields filled, for the session-level revision.
  insert into gym_session_logs (id, org_id, athlete_id, entry_date, status, source,
                                started_at, completed_at, session_rpe, comment)
    values (tests.uid('orga','log_2'), o, a1, current_date, 'complete', 'self_report',
            now() - interval '1 hour', now(), 7.0, 'Right hamstring felt tight all session');
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: RLS is on, so these writes go through policies rather than around them');

-- --------------------------------------------------------------------- writes
do $$
declare
  o   uuid := tests.uid('orga','org');
  ua1 uuid := tests.uid('orga','user_athlete_1');
begin
  perform tests.set_jwt(ua1);

  -- 1. An ORDINARY set, logged the way the gym logger logs one. The trigger's
  --    WHEN clause must keep this out: five sets in a session is five gym rows
  --    and no audit rows.
  insert into gym_set_logs (id, org_id, gym_session_log_id, exercise_id, set_number,
                            reps_completed, load_kg)
  values (tests.uid('orga','set_plain'), o, tests.uid('orga','log_1'),
          tests.uid('orga','exercise'), 2, 8, 60);

  -- 2. A REAL correction: logged 100kg, meant 60kg, and an RPE that was never
  --    filled in at all. Two fields move, one of them from null.
  perform revise_gym_set_log(tests.uid('orga','set_1'), tests.uid('orga','set_rev1'),
                             '{"load_kg": 60, "rpe": 7.5}'::jsonb);

  -- 3. A correction that changes NOTHING — the panel opened and saved. Production
  --    holds exactly this row, thirty-three seconds before the -3, and it is the
  --    clearest evidence the panel was being exercised rather than used.
  perform revise_gym_set_log(tests.uid('orga','set_rev1'), tests.uid('orga','set_rev2'),
                             '{}'::jsonb);

  -- 4. A session-level correction. session_rpe is a number and carries its value;
  --    comment is the athlete writing about their own body and must not.
  perform revise_gym_session_log(tests.uid('orga','log_2'), tests.uid('orga','log_2rev'),
    '{"session_rpe": 9, "comment": "Hamstring pull, stopped early, see the physio"}'::jsonb);
end $$;

-- Only the sport scientist may read audit_log.
select tests.set_jwt(tests.uid('orga','user_admin'));

-- ---------------------------------------------------------------------- reads
select is(
  (select count(*)::int from audit_log where entity_id = tests.uid('orga','set_plain')),
  0,
  'logging an ordinary set writes no audit row — the WHEN clause, not a filter somebody has to remember'
);

select is(
  (select count(*)::int from audit_log where entity_id = tests.uid('orga','set_rev1')),
  1,
  'a correction writes exactly ONE row, not one for the supersede and one for the insert'
);

select is(
  (select action from audit_log where entity_id = tests.uid('orga','set_rev1')),
  'gym_set_logs.correction',
  'under the table.event name the rest of the log already uses'
);

/* THE SHAPE THIS FILE EXISTS FOR. gym_set_logs has no athlete_id column at all —
   the athlete lives on the parent session — so a function written against the
   generic shape would have recorded null in the one field that says who the
   record is about. That is the exact failure 0085's header warned about for
   injury_clinical, and it fails silently. */
select is(
  (select athlete_id from audit_log where entity_id = tests.uid('orga','set_rev1')),
  tests.uid('orga','athlete_1'),
  'gym_set_logs carries no athlete_id, and the audit row names the athlete anyway, through the parent session'
);

select is(
  (select actor_id from audit_log where entity_id = tests.uid('orga','set_rev1')),
  tests.uid('orga','user_athlete_1'),
  'the actor is the person who corrected it'
);

select ok(
  (select actor_role is null from audit_log where entity_id = tests.uid('orga','set_rev1')),
  'and their staff role is null, because an athlete holds none — the same rule 450 pins for a self-written opt out'
);

select is(
  (select metadata ->> 'revision_of' from audit_log where entity_id = tests.uid('orga','set_rev1')),
  tests.uid('orga','set_1')::text,
  'the row it corrects is named, so the chain can be walked from the log'
);

-- ------------------------------------------------- the values, which are the point
select is(
  (select metadata -> 'changed' from audit_log where entity_id = tests.uid('orga','set_rev1')),
  '["load_kg", "rpe"]'::jsonb,
  'the fields that moved, and only those'
);

select is(
  (select metadata -> 'old' ->> 'load_kg' from audit_log where entity_id = tests.uid('orga','set_rev1')),
  '100.00',
  'the value that was there'
);

select is(
  (select metadata -> 'new' ->> 'load_kg' from audit_log where entity_id = tests.uid('orga','set_rev1')),
  '60.00',
  'and the value that replaced it — the whole question that could not be answered on 2026-09-09'
);

select ok(
  (select metadata -> 'old' -> 'rpe' = 'null'::jsonb
     from audit_log where entity_id = tests.uid('orga','set_rev1')),
  'a field that was empty before is recorded as empty, not omitted — "it had no RPE" and "we did not look" are different answers'
);

select ok(
  (select not (metadata -> 'old' ? 'reps_completed')
     from audit_log where entity_id = tests.uid('orga','set_rev1')),
  'a field that did not move carries no value at all, so the row stays about what changed'
);

-- ----------------------------------------------------- the correction that changed nothing
select is(
  (select count(*)::int from audit_log where entity_id = tests.uid('orga','set_rev2')),
  1,
  'a revision that changes nothing is still recorded — a new row exists that did not before, which is not the same as a no-op update'
);

select is(
  (select metadata -> 'changed' from audit_log where entity_id = tests.uid('orga','set_rev2')),
  '[]'::jsonb,
  'and it says plainly that nothing moved'
);

-- ------------------------------------------------------------ the session-level correction
select is(
  (select action from audit_log where entity_id = tests.uid('orga','log_2rev')),
  'gym_session_logs.correction',
  'a session summary correction is audited too, by the same function'
);

select is(
  (select athlete_id from audit_log where entity_id = tests.uid('orga','log_2rev')),
  tests.uid('orga','athlete_1'),
  'and this shape has its athlete on the row itself, which the function must not confuse with the other one'
);

select is(
  (select metadata -> 'old' ->> 'session_rpe' from audit_log where entity_id = tests.uid('orga','log_2rev')),
  '7.0',
  'session_rpe is a number, so it carries its value'
);

select is(
  (select metadata -> 'new' ->> 'session_rpe' from audit_log where entity_id = tests.uid('orga','log_2rev')),
  '9.0',
  'both halves of it — numeric(3,1), so the stored 9.0 is what the log must say, not the 9 that was typed'
);

/* THE NEGATIVE THAT CARRIES AS MUCH WEIGHT AS THE POSITIVES. A session comment is
   an athlete writing in their own words about their own body. That it changed is
   the record; what it says is not, and audit_log is sport-scientist readable. */
select ok(
  (select metadata -> 'changed' @> '["comment"]'::jsonb
     from audit_log where entity_id = tests.uid('orga','log_2rev')),
  'a changed comment is recorded as changed'
);

select ok(
  not exists (
    select 1 from audit_log
    where metadata::text like '%hamstring%'
       or metadata::text like '%Hamstring%'
       or metadata::text like '%physio%'
  ),
  'and neither the old comment nor the new one reaches metadata, in any row this file wrote'
);

select ok(
  (select not (metadata -> 'old' ? 'comment') and not (metadata -> 'new' ? 'comment')
     from audit_log where entity_id = tests.uid('orga','log_2rev')),
  'the free-text field is named in changed and absent from both value objects'
);

-- ------------------------------------------------------------------- no key drift
select is(
  (select count(*)::int from (
     select jsonb_object_keys(metadata) as k from audit_log
     where action in ('gym_set_logs.correction', 'gym_session_logs.correction')
   ) keys where k not in ('revision_of', 'changed', 'old', 'new')),
  0,
  'no gym correction row carries a metadata key outside the four this migration defines'
);

select * from finish();
rollback;
