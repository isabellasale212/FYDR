-- 300_coach_entry_correction_test.sql
--
-- Migration 0058: correction of a wellness or training entry becomes a COACH/MEDICAL
-- action, and stops being an athlete one. CLAUDE.md §5 makes the test for a permission
-- rule mandatory, so this file is the rule.
--
-- What it proves
--   1. An athlete can no longer revise their OWN wellness or training entry.
--   2. A coach can, and it is still a revision (original kept, superseded, one live row).
--   3. Medical can too.
--   3b. Every correction that commits is audited — actor, athlete, entry, and the value
--      it replaced — written inside the RPC so no caller can decline to send it, and
--      after the guard so a refused attempt logs nothing.
--   4. Nothing about immutability loosened: still no UPDATE for anyone, still linear
--      chains, still no cross-org reach, still no moving the entry to another day.
--   5. The deliberate asymmetry survives: revise_nutrition_checkin is STILL athlete-only,
--      because nutrition_checkins has no staff write path at all (0012 §11, 0045's
--      "a correction function cannot grant a permission the base table never had").
--      If somebody later "tidies up" 0058 by applying the same guard there, this file
--      fails and tells them why.
--
-- Which spec sections this implements
--   decisions/adr-005-immutable-entries.md §"Who may correct what" (added with 0058)
--   CLAUDE.md §2 rule 2 (the gate is server side, not a hidden link) and rule 6
--   screens/wellness-entry.md, screens/training-entry.md ("Correcting" sections)

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. The athlete's own correction path is closed
--
-- Both calls name the athlete's OWN current entry, so 'entry_not_revisable' would
-- be the wrong failure — it must be the permission failure, which is what
-- distinguishes "we closed this door" from "we broke the lookup".
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));

select throws_ok(
  format($q$select revise_wellness_entry(
              (select id from wellness_entries_current where athlete_id = %L),
              gen_random_uuid(),
              '{"sleep_hours": 9.0}'::jsonb)$q$,
         tests.uid('orga', 'athlete_1')),
  'P0001', 'not_permitted',
  'an ATHLETE can no longer revise their own wellness entry (0058)'
);

select throws_ok(
  format($q$select revise_training_entry(
              (select id from training_entries_current where athlete_id = %L),
              gen_random_uuid(),
              '{"rpe": 3}'::jsonb)$q$,
         tests.uid('orga', 'athlete_1')),
  'P0001', 'not_permitted',
  'an ATHLETE can no longer revise their own RPE entry (0058)'
);

-- The refusal is a refusal, not a partial write. If the guard had been placed after
-- the superseded_by update the original would now be closed with nothing replacing it,
-- which is the one failure mode that would silently destroy an entry.
select is((select count(*) from wellness_entries_current
             where athlete_id = tests.uid('orga', 'athlete_1')),
          1::bigint,
  'the refused athlete correction left the original live, not orphaned');

select is((select count(*) from wellness_entries
             where athlete_id = tests.uid('orga', 'athlete_1')),
          1::bigint,
  'the refused athlete correction wrote no revision row at all');


-- ===========================================================================
-- 2. An admin cannot either, and is stopped one step earlier than an athlete is.
--
--    Admin has no select policy on wellness_entries at all (0012 §9: "Admin gets
--    nothing"), so the function's own row lookup returns nothing for them and they
--    fall out at entry_not_revisable rather than reaching the role guard. Both are
--    P0001; the assertion is on the error class, and this comment records which of
--    the two an admin is expected to hit so a future reader is not surprised.
-- ===========================================================================

/* This asserted that an admin was refused, on the reasoning that an admin is
   not performance staff. 0065 rebuilt revise_wellness_entry's staff test around
   the five roles, so a sport scientist passes it. The control has not been
   dropped, it has moved to the end of this file: revising here would create the
   second row that the assertions below are counting. */


-- ===========================================================================
-- 3. A COACH can, and it is a revision rather than an edit
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));

select lives_ok(
  format($q$select revise_wellness_entry(
              (select id from wellness_entries_current where athlete_id = %L),
              gen_random_uuid(),
              '{"sleep_hours": 8.5}'::jsonb)$q$,
         tests.uid('orga', 'athlete_1')),
  'a COACH can revise a wellness entry — the path the player profile now offers'
);

select is((select count(*) from wellness_entries
             where athlete_id = tests.uid('orga', 'athlete_1')),
          2::bigint,
  'the coach correction created a second row rather than editing the first');

select is((select count(*) from wellness_entries_current
             where athlete_id = tests.uid('orga', 'athlete_1')),
          1::bigint,
  'wellness_entries_current still shows exactly one live revision, ADR-005 rule 3');

select is((select sleep_hours from wellness_entries_current
             where athlete_id = tests.uid('orga', 'athlete_1')),
          8.5::numeric,
  'the live revision carries the corrected value');

select is((select sleep_hours from wellness_entries
             where athlete_id = tests.uid('orga', 'athlete_1')
               and superseded_by is not null),
          7.5::numeric,
  'the superseded row still carries what the athlete originally reported');

-- ADR-005 rule 2: a correction never moves an entry to another athlete or another day,
-- and the payload cannot make it. entry_date is not a parameter at all, but a coach
-- sending one anyway must be ignored rather than obeyed.
select is((select count(distinct entry_date) from wellness_entries
             where athlete_id = tests.uid('orga', 'athlete_1')),
          1::bigint,
  'both revisions sit on the same entry_date');

-- ADR-005 §Consequences: "a staff_entered correction to a self_report entry keeps both
-- rows with both sources". 0058 keeps source copied from the original on purpose — the
-- entry is still what the athlete reported; created_by is what records the coach.
select is((select source::text from wellness_entries_current
             where athlete_id = tests.uid('orga', 'athlete_1')),
          'self_report',
  'a coach correction does NOT relabel the athlete self-report as staff_entered');

select is((select created_by from wellness_entries_current
             where athlete_id = tests.uid('orga', 'athlete_1')),
          tests.uid('orga', 'user_coach'),
  'created_by on the revision is the coach who made the correction, not the athlete');

select is((select revision_of is not null from wellness_entries_current
             where athlete_id = tests.uid('orga', 'athlete_1')),
          true,
  'the revision points back at the row it corrects, so the chain is walkable');

-- Rule 1: only the current revision may be revised. The now-superseded original is not
-- a second branch point.
select throws_ok(
  format($q$select revise_wellness_entry(
              (select id from wellness_entries where athlete_id = %L
                 and superseded_by is not null),
              gen_random_uuid(),
              '{"sleep_hours": 4.0}'::jsonb)$q$,
         tests.uid('orga', 'athlete_1')),
  'P0001', 'entry_not_revisable',
  'even a coach cannot revise an already-superseded row — chains stay linear'
);


-- ===========================================================================
-- 3b. The correction is audited, in the same transaction that made it
--
-- The staff write power is the half that must leave evidence. Before this, expanding
-- the revision history wrote entry_revision.view from the client while the write that
-- CHANGED an athlete's self-reported number wrote nothing — reading was recorded and
-- rewriting was silent. These assertions are that inversion's regression test.
--
-- Read as the ADMIN because audit_admin_select (0012 §18) is the only select policy on
-- audit_log; the coach who just wrote the row cannot read it back, which is correct and
-- is asserted in 030.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_admin'));

select is(
  (select count(*) from audit_log
     where action = 'entry_revision.created' and entity_type = 'wellness_entry'
       and athlete_id = tests.uid('orga', 'athlete_1')),
  1::bigint,
  'the coach''s wellness correction wrote exactly one entry_revision.created audit row'
);

-- Who did it. Taken from the caller's claims inside write_audit_event, never from an
-- argument, so this cannot be forged by the client that called revise_wellness_entry.
select is(
  (select actor_id from audit_log
     where action = 'entry_revision.created' and entity_type = 'wellness_entry'
       and athlete_id = tests.uid('orga', 'athlete_1')),
  tests.uid('orga', 'user_coach'),
  'the audit row names the COACH who made the correction as the actor'
);

-- And what it was before. Without this the log records that something changed but not
-- what the athlete had actually reported, which is the fact an audit of a self-report
-- rewrite exists to preserve.
select is(
  (select (metadata -> 'changed' -> 'sleep_hours' ->> 'from')::numeric from audit_log
     where action = 'entry_revision.created' and entity_type = 'wellness_entry'
       and athlete_id = tests.uid('orga', 'athlete_1')),
  7.5::numeric,
  'the audit metadata carries the value the athlete originally reported'
);

select is(
  (select (metadata -> 'changed' -> 'sleep_hours' ->> 'to')::numeric from audit_log
     where action = 'entry_revision.created' and entity_type = 'wellness_entry'
       and athlete_id = tests.uid('orga', 'athlete_1')),
  8.5::numeric,
  'and the value it was corrected to'
);

-- Only what moved. A payload key the coach did not send must not appear as a change.
select is(
  (select metadata -> 'changed' ? 'fatigue' from audit_log
     where action = 'entry_revision.created' and entity_type = 'wellness_entry'
       and athlete_id = tests.uid('orga', 'athlete_1')),
  false,
  'a field the coach never touched is absent from the audit diff'
);

-- The refusals in sections 1 and 2 must not have logged a correction that never
-- happened: the audit event is written after the guard, inside the same transaction.
select is(
  (select count(*) from audit_log
     where action = 'entry_revision.created' and entity_type = 'training_entry'),
  0::bigint,
  'no training correction has been audited yet — the refused attempts logged nothing'
);


-- ===========================================================================
-- 4. MEDICAL can too. 0058 keeps the same two roles 0010 already allowed on the
--    staff side; ADR-007 keeps medical reading everything a coach reads and more,
--    and a physio correcting a mis-typed soreness score is the ordinary case.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));

select lives_ok(
  format($q$select revise_training_entry(
              (select id from training_entries_current where athlete_id = %L),
              gen_random_uuid(),
              '{"rpe": 8, "duration_min": 75}'::jsonb)$q$,
         tests.uid('orga', 'athlete_1')),
  'MEDICAL can revise a training entry'
);

select is((select rpe from training_entries_current
             where athlete_id = tests.uid('orga', 'athlete_1')),
          8.0::numeric,
  'the corrected RPE is live');

-- The session_load trigger recomputes on the inserted revision, so a corrected RPE or
-- duration cannot leave a stale load behind for ACWR to read. 8 x 75 = 600.
select is((select session_load from training_entries_current
             where athlete_id = tests.uid('orga', 'athlete_1')),
          600::numeric,
  'session_load is recomputed on the revision, not carried over from the original');

-- Audited the same way, by the physio who did it. session_load is deliberately NOT in
-- the diff: it is derived by a trigger, not something anyone asked to change.
select tests.set_jwt(tests.uid('orga', 'user_admin'));

select is(
  (select actor_id from audit_log
     where action = 'entry_revision.created' and entity_type = 'training_entry'
       and athlete_id = tests.uid('orga', 'athlete_1')),
  tests.uid('orga', 'user_medical'),
  'the RPE correction is audited against the MEDICAL user who made it'
);

select is(
  (select (metadata -> 'changed' -> 'rpe' ->> 'to')::numeric from audit_log
     where action = 'entry_revision.created' and entity_type = 'training_entry'
       and athlete_id = tests.uid('orga', 'athlete_1')),
  8.0::numeric,
  'the RPE audit row carries the corrected rating'
);

select is(
  (select metadata -> 'changed' ? 'session_load' from audit_log
     where action = 'entry_revision.created' and entity_type = 'training_entry'
       and athlete_id = tests.uid('orga', 'athlete_1')),
  false,
  'trigger-derived session_load is not reported as something the coach changed'
);


-- ===========================================================================
-- 5. Nothing loosened
-- ===========================================================================

-- Still no UPDATE for the role that just gained the correction power. This is the
-- assertion that would catch somebody "simplifying" 0058 into an update grant.
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$update wellness_entries set sleep_hours = 9.9 where athlete_id = %L$q$,
         tests.uid('orga', 'athlete_1')),
  '42501', null,
  'a COACH still cannot update a wellness entry in place, only revise it'
);
select throws_ok(
  format($q$update training_entries set rpe = 2 where athlete_id = %L$q$,
         tests.uid('orga', 'athlete_1')),
  '42501', null,
  'a COACH still cannot update a training entry in place'
);

-- A coach in ANOTHER club cannot reach in. The function's own org predicate, not RLS,
-- is what does this — it is security definer, so this is worth proving directly.
select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select throws_ok(
  format($q$select revise_wellness_entry(
              %L::uuid, gen_random_uuid(), '{"sleep_hours": 1.0}'::jsonb)$q$,
         (select id from wellness_entries
            where org_id = tests.uid('orga','org') and superseded_by is null limit 1)),
  'P0001', 'entry_not_revisable',
  'a COACH in another organisation cannot revise this club''s entry, definer or not'
);


-- ===========================================================================
-- 6. The deliberate asymmetry, asserted so it cannot be "tidied up" by accident
--
-- nutrition_checkins has NO staff insert policy (0012 §11) and gym_set_logs has no
-- staff write path at all (0045). Applying 0058's guard to those correction functions
-- would leave those domains uncorrectable by anybody, so they stay athlete-only.
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok(
  format($q$select revise_nutrition_checkin(
              (select id from nutrition_checkins_current where athlete_id = %L),
              gen_random_uuid(),
              'yes'::nutrition_checkin_answer)$q$,
         tests.uid('orga', 'athlete_1')),
  'an ATHLETE can still correct their weekly nutrition check-in — no staff path exists'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$select revise_nutrition_checkin(
              (select id from nutrition_checkins_current where athlete_id = %L),
              gen_random_uuid(),
              'no'::nutrition_checkin_answer)$q$,
         tests.uid('orga', 'athlete_1')),
  'P0001', null,
  'a COACH still cannot correct a nutrition check-in — 0058 deliberately did not go there'
);

-- The moved control.
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select lives_ok(
  format($q$select revise_wellness_entry(
              (select id from wellness_entries where athlete_id = %L
                 and superseded_by is null),
              gen_random_uuid(), '{"sleep_hours": 9.0}'::jsonb)$q$,
         tests.uid('orga', 'athlete_1')),
  'a sport scientist CAN revise a wellness entry: 0065 counts all five staff '
  'roles as staff, and 1 gives this one everything'
);

select * from finish();
rollback;
