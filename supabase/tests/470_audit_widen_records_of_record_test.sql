-- Widening the audit triggers, batch five: the records you reach for after
-- something has already gone wrong.
--
-- WHY THESE FIVE TOGETHER. A subject access request, the medic's clinical review
-- of one, the injury timeline, a rehab assignment and the user account list are
-- the documents somebody asks for during a dispute, a data request or an
-- investigation. Until now none of them recorded who touched them. They are also
-- three of the four tables whose grants 0090 has just corrected, which is not a
-- coincidence: the same tables kept turning up as the ones nobody had looked at.
--
-- WHY EVERY TABLE GETS A REAL WRITE rather than an attachment check. 0085's
-- lesson was injury_clinical, whose shape the function had not met: it produced a
-- row with nulls where the answer goes and nothing failed.
--
-- THE NEW CASE IS THE injury_id PATH, USED BY SOMETHING OTHER THAN
-- injury_clinical FOR THE FIRST TIME. audit_row_change() carries a special case
-- written for 0085: a row with no athlete_id of its own but an injury_id gets its
-- athlete resolved through public.injuries, because attribution to a person is
-- the point of the table. injury_timeline_event and sar_clinical_reviews are the
-- second and third users of that path, and both are asserted below. If it only
-- ever worked for injury_clinical, this is where that shows.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;

select ok(tests.rls_is_engaged(),
  'canary: RLS is on, so these writes go through policies rather than around them');

-- --------------------------------------------------------------------- writes
do $$
declare o    uuid := tests.uid('orga','org');
        adm  uuid := tests.uid('orga','user_admin');    -- sport_scientist
        med  uuid := tests.uid('orga','user_medical');  -- medic
        a1   uuid := tests.uid('orga','athlete_1');
        inj  uuid;
        n    integer;
begin
  -- Resolved rather than named, so this keeps working if the fixture set is
  -- renamed. Same reason 450 resolves the season it reuses. Read AS THE MEDIC:
  -- the lookup is itself subject to RLS, and with no JWT set it returns null and
  -- the failure looks like a missing fixture rather than a missing role.
  perform tests.set_jwt(med);
  select id into inj from injuries where org_id = o and athlete_id = a1 limit 1;
  if inj is null then
    raise exception 'the medic can see no injury for athlete_1, so the injury_id path cannot be tested';
  end if;

  -- 1 and 2. The sport scientist raises a subject access request, then suspends
  --          an account. Both are admin acts and both are audited here.
  perform tests.set_jwt(adm);

  insert into sar_requests (id, org_id, athlete_id, requested_by, due_at, status)
  values (tests.uid('orga','sar_aud'), o, a1, adm, now() + interval '30 days', 'pending_review');

  /* GUARDED, because an UPDATE that matches nothing is silent. The first draft
     of this file named the fixture 'user_nutrition' where it is actually
     'user_nutritionist', so the statement changed no row, wrote no audit row,
     and raised nothing. A write that matches no row is not a test. */
  update users set status = 'suspended' where id = tests.uid('orga','user_nutritionist');
  get diagnostics n = row_count;
  if n <> 1 then
    raise exception 'the suspension changed % rows, not 1, so nothing below is testing anything', n;
  end if;

  -- 3, 4 and 5. The medic reviews the request, writes the timeline and assigns
  --             rehab. All three are the medic's alone.
  perform tests.set_jwt(med);

  -- 'withhold' requires a reason, by check constraint. The reason is free text a
  -- medic writes about an athlete's clinical record, which makes it exactly the
  -- kind of thing the metadata allowlist exists to keep out of audit_log.
  insert into sar_clinical_reviews (id, org_id, sar_request_id, injury_id, decision, reason, reviewed_by)
  values (tests.uid('orga','sarrev_aud'), o, tests.uid('orga','sar_aud'), inj,
          'withhold', 'Audit widen withheld reason', med);

  insert into injury_timeline_event (id, org_id, injury_id, created_by, created_by_role, type)
  values (tests.uid('orga','tl_aud'), o, inj, med, 'medic', 'stage_change');

  insert into rehab_assignments (id, org_id, athlete_id, set_by)
  values (tests.uid('orga','rehab_aud'), o, a1, med);
end $$;

-- Only the sport scientist may read audit_log.
select tests.set_jwt(tests.uid('orga','user_admin'));

-- ---------------------------------------------------------------------- reads
/* Scoped to the rows THIS FILE wrote, not to the table names. tests.fixtures()
   inserts users of its own, and those inserts now fire the trigger too, so a
   count by entity_type alone reports five whether or not the users case did
   anything -- which is how the silent no-op update above went unnoticed once. */
select is(
  (select count(distinct entity_type)::int from audit_log where entity_id in (
     tests.uid('orga','sar_aud'), tests.uid('orga','sarrev_aud'),
     tests.uid('orga','tl_aud'), tests.uid('orga','rehab_aud'),
     tests.uid('orga','user_nutritionist'))),
  5,
  'all five tables produced an audit row for the row this file wrote, every one through RLS'
);

/* THE ASSERTIONS THIS FILE EXISTS FOR. The injury_id path was written for
   injury_clinical in 0085 and has had exactly one user ever since. These are its
   second and third. A row that carries no athlete_id of its own still has to
   name the person it concerns, because a timeline entry nobody can attribute to
   an athlete is not much of a record. */
select is(
  (select athlete_id from audit_log where action = 'injury_timeline_event.insert'
     and entity_id = tests.uid('orga','tl_aud')),
  tests.uid('orga','athlete_1'),
  'injury_timeline_event has no athlete_id column, and the audit row names the athlete anyway, through the injury'
);

select is(
  (select athlete_id from audit_log where action = 'sar_clinical_reviews.insert'
     and entity_id = tests.uid('orga','sarrev_aud')),
  tests.uid('orga','athlete_1'),
  'and so does a clinical review of a subject access request, by the same route'
);

select is(
  (select actor_role::text from audit_log where action = 'injury_timeline_event.insert'
     and entity_id = tests.uid('orga','tl_aud')),
  'medic',
  'recorded as the medic, which is who wrote it'
);

-- ------------------------------------------------------- the account change
/* TWO users.update ROWS EXIST FOR THIS ACCOUNT, and that is the trigger working
   rather than a fault. Granting a role bumps users.claims_version, so
   tests.fixtures()'s own role grants write an update row per user before this
   file does anything. Every assertion below therefore names the row it means by
   the column that moved, instead of assuming there is only one. */
select is(
  (select count(*)::int from audit_log
    where action = 'users.update' and entity_id = tests.uid('orga','user_nutritionist')),
  2,
  'the account has two update rows: the claims_version bump from being granted a role, and the suspension'
);

select ok(
  exists (
    select 1 from audit_log
    where action = 'users.update' and entity_id = tests.uid('orga','user_nutritionist')
      and metadata -> 'changed' @> '["claims_version"]'::jsonb
  ),
  'a role grant is visible on the ACCOUNT as well as on user_roles, because it changes what that account can do'
);

select is(
  (select entity_id from audit_log
    where action = 'users.update' and entity_id = tests.uid('orga','user_nutritionist')
      and metadata -> 'changed' @> '["status"]'::jsonb),
  tests.uid('orga','user_nutritionist'),
  'suspending an account is recorded against that account'
);

select is(
  (select actor_id from audit_log
    where action = 'users.update' and entity_id = tests.uid('orga','user_nutritionist')
      and metadata -> 'changed' @> '["status"]'::jsonb),
  tests.uid('orga','user_admin'),
  'attributed to the sport scientist who did it, not to the account it happened to'
);

/* users carries a user_id-shaped id but no user_id COLUMN, so the identity
   allowlist finds nothing to copy. The row is still fully attributable:
   entity_id is the account, actor_id is the person. Asserted so that nobody
   later widens the allowlist to "fix" an emptiness that is not a gap. */
select is(
  (select metadata - 'changed' from audit_log
    where action = 'users.update' and entity_id = tests.uid('orga','user_nutritionist')
      and metadata -> 'changed' @> '["status"]'::jsonb),
  '{}'::jsonb,
  'and carries no identity metadata beyond that, because the entity IS the identity'
);

select is(
  (select athlete_id from audit_log where action = 'sar_requests.insert'
     and entity_id = tests.uid('orga','sar_aud')),
  tests.uid('orga','athlete_1'),
  'sar_requests: the athlete the request is about, from its own column this time'
);

select is(
  (select org_id from audit_log where action = 'rehab_assignments.insert'
     and entity_id = tests.uid('orga','rehab_aud')),
  tests.uid('orga','org'),
  'rehab_assignments: the org is recorded, so the row is readable by that club and no other'
);

-- ---------------------------------------------------------------------------
-- The disclosure rule, re-asserted. These five are the most sensitive tables
-- widened so far, so the allowlist matters most here.
select is(
  (select count(*)::int from (
     select jsonb_object_keys(metadata) as k from audit_log
     where metadata <> '{}'::jsonb
       and action ~ '^(sar_requests|sar_clinical_reviews|injury_timeline_event|rehab_assignments|users)\.(insert|update|delete)$'
   ) keys where k not in ('changed', 'user_id', 'role')),
  0,
  'no row from this batch carries a metadata key outside the allowlist'
);

select ok(
  not exists (
    select 1 from audit_log
    where entity_type = 'sar_clinical_reviews'
      and (metadata::text like '%withhold%' or metadata::text like '%Audit widen withheld reason%')
  ),
  'neither the medic''s decision on a subject access request nor their written reason for it reaches a table the sport scientist reads'
);

select ok(
  not exists (
    select 1 from audit_log
    where entity_type = 'injury_timeline_event' and metadata::text like '%stage_change%'
  ),
  'and neither is the kind of timeline event. That one was written is the record; what it says is not'
);

select * from finish();
rollback;
