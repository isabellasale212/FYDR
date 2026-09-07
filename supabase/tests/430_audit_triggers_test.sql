-- Audit item 2 of 0b: clinical writes leave a trail, written by the database.
--
-- THE FACT BEING FIXED. A sweep on 2026-09-07 found 4 write paths that reach
-- audit_log and 105 that do not, createInjury / updateInjuryFields /
-- upsertClinical / setAvailability among them. On production that day an
-- injury and an availability row were created and audit_log held no user
-- actions at all.
--
-- WHY THE ASSERTIONS ARE SHAPED THIS WAY. The trigger is only worth anything if
-- it fires for writes the APPLICATION did not choose to log, so every case
-- below writes the row the way the app does — as an authenticated role, through
-- RLS — and then looks for the audit row. Nothing here calls an audit function
-- directly; that would test that the function exists, not that it is attached.
--
-- Two negatives carry as much weight as the positives: metadata must never
-- contain a clinical VALUE (audit_log is readable by the sport scientist, and
-- medical detail is separately gated), and a write that changes nothing must
-- not manufacture an event.
--
-- WRITTEN AS THE MEDIC, READ AS THE SPORT SCIENTIST, and that split is not
-- ceremony. audit_log's only select policy is sport_scientist, so the first
-- version of this file asserted as the medic who did the writing and found
-- zero rows for everything — the trigger was working and the reader could not
-- see it. Reading as the role that actually reads this table proves the trail
-- is legible to the person who would be asked for it.

begin;
select * from no_plan();

select tests.fixtures();

-- The fixtures are built as superuser; everything after this line is subject to
-- RLS, which is what makes the canary below mean anything.
set local role authenticated;

select ok(tests.rls_is_engaged(),
  'canary: RLS is on, so these writes go through policies rather than around them');

-- --------------------------------------------------------------------- writes
do $$
declare o uuid := tests.uid('orga','org');
        a1 uuid := tests.uid('orga','athlete_1');
        a2 uuid := tests.uid('orga','athlete_2');
        med uuid := tests.uid('orga','user_medical');
begin
  perform tests.set_jwt(med);

  insert into injuries (id, org_id, athlete_id, body_area, status, onset_date, reported_by)
  values (tests.uid('orga','inj_audit'), o, a1, 'hamstring', 'open', current_date, med);

  update injuries set status = 'rehab' where id = tests.uid('orga','inj_audit');
  -- Again, changing nothing: must not produce a second row.
  update injuries set status = 'rehab' where id = tests.uid('orga','inj_audit');

  insert into injury_clinical (injury_id, org_id, diagnosis, clinical_notes, updated_by)
  values (tests.uid('orga','inj_audit'), o,
          'Grade 2 biceps femoris', 'Palpable defect at the musculotendinous junction', med);

  update injury_clinical set diagnosis = 'Grade 3 biceps femoris'
  where injury_id = tests.uid('orga','inj_audit');

  -- availability_one_open_per_athlete allows a single open row per athlete, so
  -- a real availability change closes the standing row and opens a new one.
  -- Both halves are writes and both should be audited.
  -- now(), not current_date: effective_from DEFAULTS to now(), so it carries a
  -- time of day, and availability_check requires effective_to >= effective_from.
  -- current_date is midnight, which is before it.
  update availability set effective_to = now()
  where athlete_id = a1 and effective_to is null;

  insert into availability (id, org_id, athlete_id, status, effective_from, set_by)
  values (tests.uid('orga','avail_audit'), o, a1, 'unavailable', current_date, med);

  -- The dual-role fixture: coach AND strength_conditioning.
  perform tests.set_jwt(tests.uid('orga','user_dual'));
  update availability set effective_to = now()
  where athlete_id = a2 and effective_to is null;

  -- reason_category is required and must not be 'injury': the coach policy
  -- (availability_coach_insert_noninjury) deliberately withholds injury-reason
  -- availability from coaching staff, which is CLAUDE.md rule 3 at the database.
  insert into availability (id, org_id, athlete_id, status, reason_category, effective_from, set_by)
  values (tests.uid('orga','avail_dual'), o, a2, 'modified', 'personal', current_date,
          tests.uid('orga','user_dual'));
end $$;

-- The sport scientist is the only role audit_log's select policy admits.
select tests.set_jwt(tests.uid('orga','user_admin'));

-- --------------------------------------------------------------------- reads
select is(
  (select count(*)::int from audit_log
    where entity_id = tests.uid('orga','inj_audit') and action = 'injuries.insert'),
  1,
  'creating an injury writes exactly one audit row, without the app asking'
);

select is(
  (select actor_id from audit_log
    where entity_id = tests.uid('orga','inj_audit') and action = 'injuries.insert'),
  tests.uid('orga','user_medical'),
  'attributed to the medic who wrote it, from the JWT rather than a parameter'
);

select is(
  (select actor_role::text from audit_log
    where entity_id = tests.uid('orga','inj_audit') and action = 'injuries.insert'),
  'medic',
  'and to the role, medic first exactly as lib/access.ts actingRole() orders it'
);

select is(
  (select athlete_id from audit_log
    where entity_id = tests.uid('orga','inj_audit') and action = 'injuries.insert'),
  tests.uid('orga','athlete_1'),
  'the athlete is on the row — this is the attribution the table exists for'
);

select is(
  (select count(*)::int from audit_log
    where entity_id = tests.uid('orga','inj_audit') and action = 'injuries.update'),
  1,
  'a status change is one audit row, and the identical second update adds none'
);

select is(
  (select metadata -> 'changed' from audit_log
    where entity_id = tests.uid('orga','inj_audit') and action = 'injuries.update'),
  '["status"]'::jsonb,
  'recording WHICH field changed, and only that one — updated_at is not an event'
);

-- injury_clinical has no `id` and no `athlete_id`; a trigger written against
-- one row shape would have recorded nulls for the medic-only table.
-- Scoped to this injury because tests.fixtures() writes its own clinical row,
-- and the trigger audits that too — which is the mechanism working.
select is(
  (select entity_id from audit_log
    where action = 'injury_clinical.insert' and entity_id = tests.uid('orga','inj_audit')),
  tests.uid('orga','inj_audit'),
  'injury_clinical is identified by its injury_id, because it has no id of its own'
);

select is(
  (select athlete_id from audit_log
    where action = 'injury_clinical.insert' and entity_id = tests.uid('orga','inj_audit')),
  tests.uid('orga','athlete_1'),
  'and the athlete is resolved through the injury, since the row does not carry one'
);

select is(
  (select metadata -> 'changed' from audit_log
    where action = 'injury_clinical.update' and entity_id = tests.uid('orga','inj_audit')),
  '["diagnosis"]'::jsonb,
  'a clinical change records the FIELD NAME'
);

select ok(
  not exists (
    select 1 from audit_log
    where metadata::text ilike '%biceps femoris%'
       or metadata::text ilike '%musculotendinous%'
  ),
  'and never the clinical VALUE — audit_log is sport-scientist readable, medical detail is not'
);

select is(
  (select count(*)::int from audit_log where entity_id = tests.uid('orga','avail_audit')),
  1,
  'an availability change is audited too — the second write that went unrecorded on 2026-09-07'
);

select ok(
  (select count(*)::int from audit_log
    where entity_type = 'availability' and action = 'availability.update') >= 1,
  'and closing the standing row is audited as well, not just opening the new one'
);

select is(
  (select org_id from audit_log where entity_id = tests.uid('orga','avail_audit')),
  tests.uid('orga','org'),
  'the row carries the writer''s own org, not null, or no sport scientist could read it'
);

select is(
  (select count(distinct org_id)::int from audit_log
    where entity_id in (tests.uid('orga','inj_audit'), tests.uid('orga','avail_audit'))),
  1,
  'and every audit row for these writes lands in exactly one organisation'
);

-- Role precedence, through the fixture who genuinely holds two roles.
-- AUDIT_PRECEDENCE puts coach ahead of strength_conditioning, and a write
-- recorded under the wrong one is a false entry in the table whose job is truth.
select is(
  (select actor_role::text from audit_log where entity_id = tests.uid('orga','avail_dual')),
  'coach',
  'somebody holding coach and strength_conditioning is recorded as coach, matching AUDIT_PRECEDENCE'
);

select * from finish();
rollback;
