-- 232_training_athlete_participant_check_test.sql
--
-- Integration-audit Part B (schedule/RPE pairing) — the RLS half. See
-- 0046_training_athlete_participant_check.sql's own header for the full account: an
-- athlete's self_report insert into training_entries used to check only org_id +
-- athlete_id = self + source = 'self_report', never session_id, so any athlete could
-- submit an RPE entry against ANY session id in their org, not only one they were
-- actually scheduled into. This file proves the fix directly at the RLS layer (a raw
-- insert, not through the app — that half is training.ts's fetchSessionForRpe, which has
-- no SQL of its own to test here), and proves it did not close the door 0004 opened on
-- purpose: a self_report entry with session_id = null (ad hoc work) still succeeds.
--
-- Which spec sections this implements
--   01-roles-and-permissions.md §2 (an athlete's write access is to their own scheduled
--     sessions, not the whole org's session id space)
--   04-data-model.md §17.15 (training_entries write rules)

begin;
select * from no_plan();

select tests.fixtures();

-- Extra fixture data this file needs: a second session athlete_1 is genuinely scheduled
-- into by NAME (not by group, so that branch of the policy is proven independently of the
-- shared fixture's group-based session), and a third session nobody is scheduled into at
-- all — the exact shape of the bug. Seeded in the same elevated, RLS-bypassing context
-- tests.fixtures() itself runs in, before the role switch hands control to RLS for every
-- assertion that follows.
do $$
declare
  o          uuid := tests.uid('orga', 'org');
  sea        uuid := tests.uid('orga', 'season');
  a1         uuid := tests.uid('orga', 'athlete_1');
  ucoa       uuid := tests.uid('orga', 'user_coach');
  ses_named  uuid := tests.uid('orga', 'session_named');
  ses_orphan uuid := tests.uid('orga', 'session_orphan');
begin
  insert into sessions (id, org_id, season_id, session_type, title, starts_at,
                        duration_min, status, created_by)
    values
      (ses_named,  o, sea, 'gym',      'Individual gym slot', now() - interval '2 hours',
       45, 'completed', ucoa),
      (ses_orphan, o, sea, 'training', 'Nobody named yet',    now() - interval '1 day',
       60, 'completed', ucoa);

  -- athlete_1 named directly, not through a group.
  insert into session_participants (org_id, session_id, athlete_id) values (o, ses_named, a1);
  -- ses_orphan gets no session_participants row at all, on purpose.
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));


-- ===========================================================================
-- 1. The bug: rating a session nobody named you (or your group) into fails
-- ===========================================================================

select throws_ok(
  format($q$insert into training_entries (org_id, athlete_id, session_id, entry_date, rpe,
                                          duration_min, source, created_by)
            values (%L, %L, %L, current_date, 6.0, 60, 'self_report', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'),
         tests.uid('orga', 'session_orphan'), tests.uid('orga', 'user_athlete_1')),
  '42501', null,
  'an athlete cannot submit an RPE entry for a session they were never scheduled '
  'into — the exact gap the audit found'
);


-- ===========================================================================
-- 2. Positive controls: both real ways to be "scheduled into a session" still work
-- ===========================================================================

-- Via group participation (session `ses`, group `grp`, from the shared fixture).
select lives_ok(
  format($q$insert into training_entries (org_id, athlete_id, session_id, entry_date, rpe,
                                          duration_min, source, created_by)
            values (%L, %L, %L, current_date, 7.0, 75, 'self_report', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'),
         tests.uid('orga', 'session'), tests.uid('orga', 'user_athlete_1')),
  'an athlete CAN rate a session their group is named in — the group_id branch'
);

-- Via a direct, individual session_participants row (ses_named, seeded above).
select lives_ok(
  format($q$insert into training_entries (org_id, athlete_id, session_id, entry_date, rpe,
                                          duration_min, source, created_by)
            values (%L, %L, %L, current_date, 5.0, 45, 'self_report', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'),
         tests.uid('orga', 'session_named'), tests.uid('orga', 'user_athlete_1')),
  'an athlete CAN rate a session they are named into individually — the athlete_id branch'
);


-- ===========================================================================
-- 3. session_id = null (ad hoc work, 0004) is not collateral damage
-- ===========================================================================

select lives_ok(
  format($q$insert into training_entries (org_id, athlete_id, session_id, entry_date, rpe,
                                          duration_min, source, created_by)
            values (%L, %L, null, current_date, 4.0, 30, 'self_report', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_1'),
         tests.uid('orga', 'user_athlete_1')),
  'an ad hoc entry with no session_id at all still succeeds — 0004''s documented '
  'nullable session_id is not closed off by this policy'
);


-- ===========================================================================
-- 4. A second athlete in the SAME org, not named into that session either,
--    is refused the same way — proves this is a per-athlete resolution, not
--    a per-org one (i.e. not accidentally "any org member named anyone in").
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));

select throws_ok(
  format($q$insert into training_entries (org_id, athlete_id, session_id, entry_date, rpe,
                                          duration_min, source, created_by)
            values (%L, %L, %L, current_date, 6.0, 45, 'self_report', %L)$q$,
         tests.uid('orga', 'org'), tests.uid('orga', 'athlete_2'),
         tests.uid('orga', 'session_named'), tests.uid('orga', 'user_athlete_2')),
  '42501', null,
  'athlete_2 cannot rate the session athlete_1 was individually named into'
);


select * from finish();
rollback;
