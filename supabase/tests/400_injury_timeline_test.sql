-- The injury <-> S&C programme link: one shared timeline per injury, and an
-- assignment that is not live until the medic says so.
--
-- Two rules carry the whole feature, and each one has a failure mode that looks
-- like success from the application side, which is why they are asserted here
-- rather than trusted to the screens:
--
--   1. The S&C WRITES to the timeline and cannot READ it back. A read refusal on
--      a table the role holds a grant on returns zero rows, it does not raise —
--      so §1 asserts a COUNT, and §2 proves with the medic that the row the S&C
--      just wrote is really there. Without that pairing a zero would equally
--      mean the insert had failed, and the test would pass for the wrong reason.
--
--   2. An injury-linked assignment goes live only for a medic. That IS a raise
--      (a WITH CHECK violation on UPDATE, unlike a USING mismatch, which
--      silently matches no row), so §7 uses throws_ok — and then proves the rule
--      is scoped by activating an assignment with no injury_id as the same S&C
--      in the same session. A rule that refused both would pass a one-sided test
--      while breaking every ordinary programme in the app.

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare
  o        uuid := tests.uid('orga','org');
  ucoa     uuid := tests.uid('orga','user_coach');
  prog_gym uuid := tests.uid('orga','prog_gym');
  a1       uuid := tests.uid('orga','athlete_1');
begin
  insert into programmes (id, org_id, name, programme_type, status, created_by) values
    (prog_gym, o, 'Pre-season strength', 'gym', 'active', ucoa);

  /* The control row for §7: an ordinary assignment with no injury attached.
     Everything the S&C has always been able to do to this one, they must still
     be able to do after the new rule lands. */
  insert into programme_assignments (id, org_id, programme_id, athlete_id, starts_on, status)
    values (tests.uid('orga','assign_plain'), o, prog_gym, a1, current_date, 'proposed');
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');


-- ===========================================================================
-- 1. The S&C writes to the timeline, and cannot read it back
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_sc'));

select lives_ok(
  format($q$insert into injury_timeline_event (org_id, injury_id, created_by, created_by_role, type, payload)
            values (%L, %L, %L, 'strength_conditioning', 'programme_proposed',
                    '{"programme":"Pre-season strength"}'::jsonb)$q$,
         tests.uid('orga','org'), tests.uid('orga','injury'), tests.uid('orga','user_sc')),
  'the S&C can propose: their own event is accepted'
);

select is(
  (select count(*) from injury_timeline_event),
  0::bigint,
  'and reads NOTHING back — including the row they just wrote. Medic-only, decided '
  || '2026-09-06 as a general rule: the note event type is free clinical text, and a '
  || 'readable log would be a second channel around injury_clinical'
);

/* The consequence of those two facts together, which cost a real debugging pass
   to find because it is invisible to reasoning and to typechecking.
  
   RETURNING is a READ. Postgres applies the SELECT policy to it, so the write
   the S&C is allowed to make CANNOT ask for its own row back. The app's standard
   write helper (lib/write.ts, G-36) chains .select() onto every write precisely
   so a silent refusal cannot read as a success — and doing that here turns a
   perfectly good insert into a 42501 the screen reports as "not recorded".
  
   Both halves are asserted so neither can drift: the plain insert must keep
   working, and the RETURNING form must keep failing. If somebody later widens
   the SELECT policy to the S&C, the second assertion fails and points at the
   decision rather than at the symptom. */
select lives_ok(
  format($q$insert into injury_timeline_event (org_id, injury_id, created_by, created_by_role, type)
            values (%L, %L, %L, 'strength_conditioning', 'note')$q$,
         tests.uid('orga','org'), tests.uid('orga','injury'), tests.uid('orga','user_sc')),
  'a plain insert works: writing does not require reading'
);
select throws_ok(
  format($q$insert into injury_timeline_event (org_id, injury_id, created_by, created_by_role, type)
            values (%L, %L, %L, 'strength_conditioning', 'note') returning id$q$,
         tests.uid('orga','org'), tests.uid('orga','injury'), tests.uid('orga','user_sc')),
  '42501', null,
  'but the same insert with RETURNING is refused — so recordInjuryEvent must not '
  || 'chain .select(), and lib/write.ts''s helper cannot be used for this one write'
);


-- ===========================================================================
-- 2. The medic reads it. This is what proves §1's zero was filtering
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));

select cmp_ok(
  (select count(*) from injury_timeline_event), '>', 0::bigint,
  'the medic reads the timeline, so the S&C zero above is filtering rather than a failed insert'
);

select is(
  (select created_by_role::text from injury_timeline_event where type = 'programme_proposed'),
  'strength_conditioning',
  'and the proposal is attributed to the S&C role, snapshotted at write time so it '
  || 'still reads correctly after that person''s roles change or they leave'
);


-- ===========================================================================
-- 3. An event cannot be attributed to somebody else
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_sc'));

select throws_ok(
  format($q$insert into injury_timeline_event (org_id, injury_id, created_by, created_by_role, type)
            values (%L, %L, %L, 'medic', 'note')$q$,
         tests.uid('orga','org'), tests.uid('orga','injury'), tests.uid('orga','user_sc')),
  '42501', null,
  'the S&C cannot label their own event as the medic''s'
);

select throws_ok(
  format($q$insert into injury_timeline_event (org_id, injury_id, created_by, created_by_role, type)
            values (%L, %L, %L, 'strength_conditioning', 'note')$q$,
         tests.uid('orga','org'), tests.uid('orga','injury'), tests.uid('orga','user_medical')),
  '42501', null,
  'nor write an event as though the medic had authored it'
);


-- ===========================================================================
-- 4. The three roles that are not party to this conversation
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into injury_timeline_event (org_id, injury_id, created_by, created_by_role, type)
            values (%L, %L, %L, 'coach', 'note')$q$,
         tests.uid('orga','org'), tests.uid('orga','injury'), tests.uid('orga','user_coach')),
  '42501', null, 'the coach cannot write to an injury timeline'
);
select is((select count(*) from injury_timeline_event), 0::bigint,
  'and cannot read it');

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select is((select count(*) from injury_timeline_event), 0::bigint,
  'the nutritionist reads nothing — D-01, no injury data anywhere, and this is a new table it could have leaked through');

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select count(*) from injury_timeline_event), 0::bigint,
  'the sport scientist reads nothing either: this is the clinical record, not the admin one');


-- ===========================================================================
-- 5. A stage change writes its own event, from the column rather than the caller
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_medical'));

select lives_ok(
  format($q$update injuries set status = 'closed' where id = %L$q$, tests.uid('orga','injury')),
  'the medic closes the injury'
);

select is(
  (select payload from injury_timeline_event where type = 'stage_change'),
  '{"to": "closed", "from": "rehab"}'::jsonb,
  'and the stage change recorded ITSELF, with both ends of the transition — written by a '
  || 'trigger on the column, so it cannot be missed by a write path somebody forgot'
);

select is(
  (select created_by_role::text from injury_timeline_event where type = 'stage_change'),
  'medic',
  'attributed to the medic who made it'
);


-- ===========================================================================
-- 5b. Logging an injury opens its own timeline
-- ===========================================================================

/* 0081, and the reason it is a trigger rather than a line in createInjury: an
   injury created by an import or a fixture tomorrow should still open a
   timeline. The medic logs one here and the first event has to be there without
   anybody writing it. */
select lives_ok(
  format($q$insert into injuries (org_id, athlete_id, body_area, side, onset_date, status, reported_by)
            values (%L, %L, 'calf', 'left', current_date, 'open', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'), tests.uid('orga','user_medical')),
  'the medic logs a second injury'
);
select is(
  (select count(*) from injury_timeline_event e
    join injuries i on i.id = e.injury_id
   where e.type = 'injury_logged' and i.athlete_id = tests.uid('orga','athlete_2')),
  1::bigint,
  'and its timeline opens with injury_logged, written by the column rather than the caller'
);
select is(
  (select e.payload->>'body_area' from injury_timeline_event e
    join injuries i on i.id = e.injury_id
   where e.type = 'injury_logged' and i.athlete_id = tests.uid('orga','athlete_2')),
  'calf',
  'carrying what was logged'
);


-- ===========================================================================
-- 6. Append-only: history cannot be rewritten, by anyone, through any screen
-- ===========================================================================

select throws_ok(
  $q$update injury_timeline_event set payload = '{}'::jsonb$q$,
  '42501', null,
  'not even the medic can edit an event — authenticated holds no UPDATE grant'
);
select throws_ok(
  $q$delete from injury_timeline_event$q$,
  '42501', null,
  'or delete one. No policy and no grant, rather than audit_log''s truncate trigger, '
  || 'which is what made a scratch database unrebuildable'
);


-- ===========================================================================
-- 7. A proposal is not live until the medic says so
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_sc'));

select lives_ok(
  format($q$insert into programme_assignments (id, org_id, programme_id, athlete_id, injury_id, starts_on, status, assigned_by)
            values (%L, %L, %L, %L, %L, current_date, 'proposed', %L)$q$,
         tests.uid('orga','assign_injury'), tests.uid('orga','org'), tests.uid('orga','prog_gym'),
         tests.uid('orga','athlete_1'), tests.uid('orga','injury'), tests.uid('orga','user_sc')),
  'the S&C drafts a block against the injury'
);

select throws_ok(
  format($q$update programme_assignments set status = 'active' where id = %L$q$,
         tests.uid('orga','assign_injury')),
  '42501', null,
  'and CANNOT make it live themselves — this is the sign-off the feature exists for'
);

select lives_ok(
  format($q$update programme_assignments set ends_on = current_date + 28 where id = %L$q$,
         tests.uid('orga','assign_injury')),
  'but can still edit their own draft, which is what "medic requests changes" needs'
);

/* The scope proof. The same role, in the same session, activating an assignment
   with no injury on it. If this failed, the new rule would have quietly broken
   ordinary programme assignment across the whole app. */
select lives_ok(
  format($q$update programme_assignments set status = 'active' where id = %L$q$,
         tests.uid('orga','assign_plain')),
  'an assignment with no injury attached still activates normally for the S&C'
);

/* ---------------------------------------------------------------------------
   THE RULE 0080 REPLACED, asserted here because it was nearly lost.
  
   0080 rewrote this policy's WITH CHECK and dropped 0022/0070's rehab-authorship
   rule on the way past. Nothing failed: the tests written with 0080 all asserted
   the NEW rule, and a policy that is too permissive breaks no assertion that
   only exercises the permitted path. 0082 restores it.
  
   The lesson is the assertion shape, not the incident. When a migration replaces
   a policy, the test has to pin what the OLD one refused as well as what the new
   one allows -- otherwise the only evidence of a regression is a role quietly
   gaining a write.
   --------------------------------------------------------------------------- */

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$update programme_assignments set ends_on = current_date + 7 where id = %L$q$,
         tests.uid('orga','assign_plain')),
  '42501', null,
  'the COACH cannot update an assignment: authorship is the sport scientist and the S&C '
  || 'for gym work, the sport scientist and the medic for rehab (0022, 0070)'
);

select tests.set_jwt(tests.uid('orga', 'user_nutritionist'));
select throws_ok(
  format($q$update programme_assignments set ends_on = current_date + 7 where id = %L$q$,
         tests.uid('orga','assign_plain')),
  '42501', null,
  'and neither can the nutritionist'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select throws_ok(
  format($q$update programme_assignments set ends_on = current_date + 7 where id = %L$q$,
         tests.uid('orga','assign_plain')),
  '42501', null,
  'the medic cannot touch an ORDINARY gym assignment either — the sign-off exception '
  || 'is scoped to rows carrying an injury_id, not a general widening'
);

select lives_ok(
  format($q$update programme_assignments set status = 'active' where id = %L$q$,
         tests.uid('orga','assign_injury')),
  'but the medic signs off the injury-linked one'
);
select is(
  (select status::text from programme_assignments where id = tests.uid('orga','assign_injury')),
  'active',
  'and it is live — asserted on the row, not on the absence of an error, because an '
  || 'UPDATE that matches nothing also reports no error'
);

select * from finish();
rollback;
