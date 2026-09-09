-- Corrections, deletes and free text on the other three immutable entries.
--
-- WHAT THIS FILE HAD TO BE REWRITTEN AROUND, because the first version tested a
-- premise that was wrong. pg_trigger shows no audit triggers on these three
-- tables, and I read that as "corrections are not audited". They are — just not
-- by a trigger: revise_wellness_entry and revise_training_entry have written an
-- `entry_revision.created` event in-transaction since 0058. Only
-- revise_nutrition_checkin never got the call. The first 0099 therefore added a
-- correction trigger to all three and would have written TWO audit rows for
-- every wellness and training correction. No assertion here caught that; what
-- caught it was a subquery returning two rows where the test expected one.
--
-- So the three things this file proves are the three that were actually
-- missing: that a check-in correction is now recorded like the other two and
-- exactly once; that a delete from below the app keeps what it destroyed on all
-- three; and that no free text an athlete wrote reaches audit_log through
-- anything 0099 added.
--
-- WRITTEN PARTLY AS SUPERUSER, for the reason 520 gives: a delete cannot be
-- performed as `authenticated` — that is one of the assertions — so the audited
-- deletes run with the role reset, which is how a real one would happen.

begin;
select * from no_plan();

select tests.fixtures();

do $$
declare
  o  uuid := tests.uid('orga', 'org');
  a1 uuid := tests.uid('orga', 'athlete_1');
begin
  insert into wellness_entries (id, org_id, athlete_id, entry_date, sleep_hours,
                                sleep_quality, fatigue, soreness, soreness_areas,
                                stress, mood, resting_hr, body_mass_kg, comment, source)
    values (tests.uid('orga','well_1'), o, a1, current_date, 6.5,
            3, 2, 2, array['hamstring_left'], 4, 3, 52, 88.4,
            'Slept badly, left hamstring tight all morning', 'self_report');

  insert into training_entries (id, org_id, athlete_id, entry_date, rpe, duration_min,
                                comment, source)
    values (tests.uid('orga','train_1'), o, a1, current_date, 7.0, 65,
            'Pulled up after the shuttles', 'self_report');

  insert into nutrition_checkins (id, org_id, athlete_id, week_start, iso_year, iso_week,
                                  answer, note, protein_target_g, source)
    values (tests.uid('orga','nutr_1'), o, a1, date_trunc('week', current_date)::date,
            extract(isoyear from current_date)::int, extract(week from current_date)::int,
            'roughly', 'Missed breakfast most days', 150, 'self_report');
end $$;

-- --------------------------- 0. the derived-value triggers run BEFORE INSERT
/* Pinned because 0099's delete audit reads them off the stored row and an
   earlier note in this session had both of these down as AFTER INSERT. */
select ok(
  (select readiness_score is not null from wellness_entries where id = tests.uid('orga','well_1')),
  'canary: readiness_score is computed on insert, so a delete audit can capture it'
);
select ok(
  (select session_load is not null from training_entries where id = tests.uid('orga','train_1')),
  'canary: and session_load, for the same reason'
);

-- ------------------------------------------------- 1. corrections are recorded
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is on, so the refusals below measure something');

/* Wellness and training revisions are staff-only (0058 narrowed 0010's athlete
   branch away); a check-in revision is athlete-only and has no staff write path
   at all. So the corrections below are made by the people who can actually make
   them, not by one convenient role. */
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$select revise_wellness_entry(%L, %L, '{"sleep_hours": 8.0, "fatigue": 4}'::jsonb)$q$,
         tests.uid('orga','well_1'), tests.uid('orga','well_2')),
  'a coach may correct a wellness entry'
);
select lives_ok(
  format($q$select revise_training_entry(%L, %L, '{"rpe": 8.5}'::jsonb)$q$,
         tests.uid('orga','train_1'), tests.uid('orga','train_2')),
  'and a training entry'
);
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select lives_ok(
  format($q$select revise_nutrition_checkin(%L, %L, 'yes'::nutrition_checkin_answer, 'Fixed it, breakfast every day now')$q$,
         tests.uid('orga','nutr_1'), tests.uid('orga','nutr_2')),
  'and the athlete themselves may correct their check-in'
);

set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));   -- only they may read audit_log

/* EXACTLY ONE ROW EACH. This is the assertion the first version of 0099 would
   have failed: it added a trigger on top of the RPC's existing event, so a
   wellness correction wrote two rows and a check-in correction wrote one. */
select is(
  (select count(*)::int from audit_log where action = 'entry_revision.created'),
  3, 'three corrections write three audit rows — one each, not one per mechanism'
);
select is(
  (select count(distinct entity_type)::int from audit_log where action = 'entry_revision.created'),
  3, 'one per entry type, so no table is quietly writing two'
);
select is(
  (select count(*)::int from audit_log
    where action like 'wellness_entries.%' or action like 'training_entries.%'
       or action like 'nutrition_checkins.%'),
  0, 'and 0099 adds no second correction action name — corrections keep the name they had'
);

-- ------------------- 2. the check-in correction that was recorded nowhere
/* revise_nutrition_checkin was written alongside the other two and never got
   the audit call. Before 0099 a check-in could go from "no" to "yes" with
   nothing recorded but the revision chain, which says a correction happened and
   not what it changed. */
select is(
  (select entity_id from audit_log where entity_type = 'nutrition_checkin'),
  tests.uid('orga','nutr_2'),
  'a check-in correction is now recorded, filed against the new revision'
);
select is(
  (select metadata ->> 'superseded' from audit_log where entity_type = 'nutrition_checkin'),
  tests.uid('orga','nutr_1')::text,
  'naming the row it replaced, the same key the other two domains use'
);
select is(
  (select metadata ->> 'domain' from audit_log where entity_type = 'nutrition_checkin'),
  'nutrition', 'under the same domain key, so one query reads all three'
);
select is(
  (select athlete_id from audit_log where entity_type = 'nutrition_checkin'),
  tests.uid('orga','athlete_1'), 'and names the athlete'
);
select is(
  (select actor_id from audit_log where entity_type = 'nutrition_checkin'),
  tests.uid('orga','user_athlete_1'),
  'with the athlete as actor — there is no staff write path to this table at all'
);
select is(
  (select metadata -> 'changed' -> 'answer' ->> 'from' from audit_log where entity_type = 'nutrition_checkin'),
  'roughly', 'the answer it was'
);
select is(
  (select metadata -> 'changed' -> 'answer' ->> 'to' from audit_log where entity_type = 'nutrition_checkin'),
  'yes', 'and the answer it became — three fixed words, not free text'
);

-- ----------------------------------------- 3. what the note does NOT carry
/* 0096's rule, applied to the field this migration adds: a note is an athlete
   writing about their own body and audit_log is sport_scientist-readable. */
select ok(
  (select metadata -> 'changed' ? 'note' from audit_log where entity_type = 'nutrition_checkin'),
  'a rewritten note IS named, so a reader knows the text changed and who changed it'
);
select is(
  (select metadata -> 'changed' -> 'note' ->> 'from_length' from audit_log where entity_type = 'nutrition_checkin'),
  '26', 'with how long it was'
);
select is(
  (select metadata -> 'changed' -> 'note' ->> 'to_length' from audit_log where entity_type = 'nutrition_checkin'),
  '33', 'and how long it became'
);
select ok(
  (select not (metadata -> 'changed' -> 'note' ? 'from')
      and not (metadata -> 'changed' -> 'note' ? 'to')
     from audit_log where entity_type = 'nutrition_checkin'),
  'but neither the old text nor the new one'
);

/* THE DIVERGENCE THIS MIGRATION DELIBERATELY DID NOT RESOLVE, asserted so it is
   visible rather than discovered. The wellness and training events have carried
   both texts in full since 0058. Narrowing them would remove evidence that
   exists today, which is a decision to take on its own terms. Whichever way it
   goes, it changes this assertion — which is the point of writing it down. */
select ok(
  (select count(*)::int from audit_log
    where action = 'entry_revision.created' and metadata -> 'changed' ? 'comment') = 0,
  'no comment was changed here, so nothing in this run exercises the wellness/training text path'
);

-- ---------------------------------------------- 4. no app role may delete
set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$delete from wellness_entries where id = %L$q$, tests.uid('orga','well_2')),
  '42501', null,
  'an athlete cannot delete their own wellness entry — there is no delete grant to authenticated'
);
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format($q$delete from training_entries where id = %L$q$, tests.uid('orga','train_2')),
  '42501', null,
  'and neither can the sport scientist — deletion is not an application operation'
);
select throws_ok(
  format($q$delete from nutrition_checkins where id = %L$q$, tests.uid('orga','nutr_2')),
  '42501', null,
  'nor on a check-in, which has a deleted_at column precisely so it never needs this'
);

-- ------------------------------- 5. a delete from below the app is recorded
reset role;
/* reset role does NOT clear request.jwt.claims — transaction-local config, not a
   role attribute. 520 recorded a superuser delete against the sport scientist
   before this line existed. */
select set_config('request.jwt.claims', '', true);
delete from wellness_entries where id = tests.uid('orga','well_2');
delete from training_entries where id = tests.uid('orga','train_2');
delete from nutrition_checkins where id = tests.uid('orga','nutr_2');

set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));

select is(
  (select count(*)::int from audit_log
    where action in ('wellness_entries.delete','training_entries.delete','nutrition_checkins.delete')),
  3, 'each removed row leaves exactly one delete row behind'
);
select ok(
  (select bool_and(actor_id is null) from audit_log where action like '%_entries.delete' or action = 'nutrition_checkins.delete'),
  'with a null actor, because a connection below the app has no person to name'
);
select is(
  (select count(*)::int from audit_log
    where action in ('wellness_entries.delete','training_entries.delete','nutrition_checkins.delete')
      and athlete_id = tests.uid('orga','athlete_1')),
  3, 'and all three still name the athlete whose record was destroyed'
);

/* THE VALUES, which for a delete are the entire point: a correction leaves the
   old value reachable through the revision chain, a delete destroys it. */
select is(
  (select metadata -> 'removed' ->> 'sleep_hours' from audit_log where action = 'wellness_entries.delete'),
  '8.0', 'the sleep that was destroyed is kept'
);
select is(
  (select metadata -> 'removed' ->> 'readiness_score' from audit_log where action = 'wellness_entries.delete'),
  '64.00', 'and the derived readiness a coach would have acted on'
);
select is(
  (select metadata -> 'removed' ->> 'resting_hr' from audit_log where action = 'wellness_entries.delete'),
  '52', 'and the resting heart rate'
);
select is(
  (select metadata -> 'removed' -> 'soreness_areas' from audit_log where action = 'wellness_entries.delete'),
  '["hamstring_left"]'::jsonb,
  'body area IS kept: it is already staff-visible by decision, unlike diagnosis'
);
select is(
  (select metadata -> 'removed' ->> 'session_load' from audit_log where action = 'training_entries.delete'),
  '552.5', 'the training load that was destroyed is kept — 65 x 8.5, so a total can be reconciled'
);
select is(
  (select metadata -> 'removed' ->> 'answer' from audit_log where action = 'nutrition_checkins.delete'),
  'yes', 'and the check-in answer'
);
select is(
  (select metadata -> 'removed' ->> 'revision_of' from audit_log where action = 'wellness_entries.delete'),
  tests.uid('orga','well_1')::text,
  'a deleted revision names its parent, so a hole in a chain is identifiable'
);

-- ------------------------------- 6. and none of it carries what they wrote
select ok(
  (select (metadata -> 'removed' ->> 'comment_present')::boolean
     from audit_log where action = 'wellness_entries.delete'),
  'the row records that a comment existed'
);
select is(
  (select metadata -> 'removed' ->> 'comment_length' from audit_log where action = 'wellness_entries.delete'),
  '45', 'and how much was lost'
);
select ok(
  (select (metadata -> 'removed' ->> 'note_present')::boolean
     from audit_log where action = 'nutrition_checkins.delete'),
  'a check-in note is the same field under another name, and is treated the same'
);
select is(
  (select metadata -> 'removed' ->> 'note_length' from audit_log where action = 'nutrition_checkins.delete'),
  '33', 'with the length of the note that was destroyed'
);
/* The plant that made this file worth keeping: with the value filter removed
   from the live function, an earlier version of this suite passed 38/38.
   Every string below is one somebody actually typed in this transaction. */
select ok(
  not exists (
    select 1 from audit_log
    where metadata::text like '%hamstring tight%'
       or metadata::text like '%shuttles%'
       or metadata::text like '%Missed breakfast%'
       or metadata::text like '%breakfast every day%'),
  'no audit row in this transaction contains a word any of them actually typed'
);

-- ------------------------------------------------------------- no key drift
select is(
  (select count(*)::int from (
     select jsonb_object_keys(metadata) as k from audit_log
     where action in ('wellness_entries.delete','training_entries.delete','nutrition_checkins.delete')
   ) keys where k <> 'removed'),
  0, 'no delete row carries a metadata key outside the one 0099 defines'
);
/* And no via_cascade, unlike gym: every foreign key into these three is ON
   DELETE NO ACTION, so there is no cascade to attribute. A flag that is always
   false is worse than no flag. */
select ok(
  not exists (
    select 1 from audit_log
    where action in ('wellness_entries.delete','training_entries.delete','nutrition_checkins.delete')
      and metadata ? 'via_cascade'),
  'and no via_cascade flag, because no cascade reaches these tables'
);

select * from finish();
rollback;
