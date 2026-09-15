-- 850_body_mass_rules_test.sql
--
-- Migration 0131: the body mass rulings — docs/decisions/body-mass-rule.md
-- (Isabella, 15 September 2026), a follow-up to 0128, which was applied to
-- scratch only. Written BEFORE the migration, per CLAUDE.md §5.
--
-- What this file asserts, section by section of the ruling
--   §1  Only body_composition counts. An athlete who types a figure on every
--       morning check-in and has never been weighed by the club is never
--       evaluated; with both on a day, the weigh-in is the figure (as before);
--       a soft-deleted weigh-in is not a figure.
--   §2  One weigh-in per athlete per day: the table refuses the second; a
--       deleted one does not block re-logging that day.
--   §3  Same-day edit: a weigh-in measured today can be edited, one measured
--       before today cannot (the table raises, not silently). A sport
--       scientist deletes a weigh-in of any age through delete_weigh_in(),
--       which soft-deletes and writes the audit row; the other three logging
--       roles may delete one logged today (0084's window, kept) and no other;
--       nobody hard-deletes.
--   §4  The rule speaks after four weigh-ins spanning at least 21 days: four
--       in one week does not fire, four weekly does (830 keeps that case);
--       the floor is applied at the table to any body.mass_kg rule (the
--       column min_baseline_span_days, and min_baseline_observations 4).
--   §6  The logging roles are the four, not the coach (unchanged from 0073;
--       asserted so it cannot drift).
--   §7  The athlete reads their own weigh-ins, and not a deleted one.
--   §8  flag_actions is gated by the flag: a coach reads no note under a
--       body-mass flag and cannot write one; the nutritionist does both.
--
-- Synthetic data is anchored 230 days back (830 uses 250, 270 uses 200+), so
-- nothing here collides with another file's rows or with the fixture's.

begin;
select * from no_plan();

select tests.fixtures();

-- ===========================================================================
-- §4 first, because the rule the rest evaluates depends on it: the floor at
-- the table.
-- ===========================================================================

select has_column('public', 'thresholds', 'min_baseline_span_days', 'thresholds carries min_baseline_span_days');
select has_column('public', 'body_composition', 'deleted_at', 'body_composition carries deleted_at');
select has_column('public', 'body_composition', 'deleted_by', 'and deleted_by');

-- A body-mass rule inserted below the floor is raised to it, not refused: the
-- floor is the rule's own, and the editor does not carry the column.
insert into public.thresholds
  (id, org_id, name, domain, metric, comparison, value, baseline_type, baseline_days,
   consecutive_days, min_baseline_observations, cooldown_days, severity, notify_roles, created_by)
values
  (tests.uid('orga','thr_bm_850'), tests.uid('orga','org'), 'Test 850: body mass',
   'nutrition', 'body.mass_kg', 'pct_change_below', 2, 'personal_rolling', 28,
   1, 1, 7, 'medium', '{nutritionist,strength_conditioning}', tests.uid('orga','user_admin'));

select is(
  (select (min_baseline_observations, min_baseline_span_days) from public.thresholds where id = tests.uid('orga','thr_bm_850')),
  (4, 21),
  'a body-mass rule below the floor is raised to four observations spanning 21 days'
);

select is(
  (select min_baseline_span_days from public.thresholds where id = tests.uid('orga','threshold')),
  0,
  'a rule on any other metric carries no span floor'
);

-- A club seeded fresh gets the default body-mass rule at the floor (the seed
-- inserts the set as 0128 wrote it; the table applies 0131's floor).
insert into public.organisations (id, name, sport, timezone)
values (tests.uid('org850','org'), 'Test 850 Club', 'rugby_union', 'Europe/London');
select public.seed_default_thresholds(tests.uid('org850','org'));
select is(
  (select (min_baseline_observations, min_baseline_span_days)
     from public.thresholds
    where org_id = tests.uid('org850','org') and metric = 'body.mass_kg' and source = 'default'),
  (4, 21),
  'the default body-mass rule a new club is seeded with carries the floor'
);

-- ===========================================================================
-- §1 The source is the club's scales, and nothing else
-- ===========================================================================

insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status)
values
  (tests.uid('orga','a850_checkin'),  tests.uid('orga','org'), 'Test', 'CheckinOnly', date '2000-01-01', 'active'),
  (tests.uid('orga','a850_cluster'),  tests.uid('orga','org'), 'Test', 'Cluster',     date '2000-01-01', 'active'),
  (tests.uid('orga','a850_weekly'),   tests.uid('orga','org'), 'Test', 'Weekly',      date '2000-01-01', 'active'),
  (tests.uid('orga','a850_deleted'),  tests.uid('orga','org'), 'Test', 'Deleted',     date '2000-01-01', 'active');

-- The check-in-only athlete: 28 daily figures at 80.0, then 78.0 on D. Under
-- 0128 this fired; under 0131 the check-in figure is not a source at all.
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, body_mass_kg, source, created_by)
select
  tests.uid('orga','org'), tests.uid('orga','a850_checkin'), gs::date, 7.5, 4, 4, 4, 4, 4, 80.0, 'self_report', tests.uid('orga','user_coach')
from generate_series((current_date - 258)::timestamp, (current_date - 231)::timestamp, interval '1 day') as gs;
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, body_mass_kg, source, created_by)
values
  (tests.uid('orga','org'), tests.uid('orga','a850_checkin'), current_date - 230,
   7.5, 4, 4, 4, 4, 4, 78.0, 'self_report', tests.uid('orga','user_coach'));

select is(
  public._threshold_metric_raw(tests.uid('orga','a850_checkin'), 'body.mass_kg', current_date - 230),
  null::numeric,
  'a check-in figure is not a body-mass observation'
);

-- The cluster athlete: four weigh-ins Monday to Thursday of one week (80.0),
-- then 78.0 on D. Four observations, a three-day span: the rule waits.
-- created_at is set to the day measured (09:00 club time) throughout this
-- section, so none of these rows counts as "logged today" for §3's window.
insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg, created_at)
select tests.uid('orga','org'), tests.uid('orga','a850_cluster'), (current_date - 230) - d, 80.0, (((current_date - 230) - d)::timestamp + time '09:00') at time zone 'Europe/London'
from unnest(array[10, 9, 8, 7]) as d;
insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg, created_at)
values (tests.uid('orga','org'), tests.uid('orga','a850_cluster'), current_date - 230, 78.0, ((current_date - 230)::timestamp + time '09:00') at time zone 'Europe/London');

-- The weekly athlete: D-28, D-21, D-14, D-7 at 80.0 (a 21-day span), then 78.0.
insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg, created_at)
select tests.uid('orga','org'), tests.uid('orga','a850_weekly'), (current_date - 230) - d, 80.0, (((current_date - 230) - d)::timestamp + time '09:00') at time zone 'Europe/London'
from unnest(array[28, 21, 14, 7]) as d;
insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg, created_at)
values (tests.uid('orga','org'), tests.uid('orga','a850_weekly'), current_date - 230, 78.0, ((current_date - 230)::timestamp + time '09:00') at time zone 'Europe/London');

-- The deleted athlete: the same weekly series, but D-7's weigh-in was a typo
-- (8.0) and is soft-deleted; the baseline must not carry it.
insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg, created_at)
select tests.uid('orga','org'), tests.uid('orga','a850_deleted'), (current_date - 230) - d, 80.0, (((current_date - 230) - d)::timestamp + time '09:00') at time zone 'Europe/London'
from unnest(array[28, 21, 14]) as d;
insert into public.body_composition (id, org_id, athlete_id, measured_on, body_mass_kg, deleted_at, deleted_by, created_at)
values (tests.uid('orga','bc850_typo'), tests.uid('orga','org'), tests.uid('orga','a850_deleted'), current_date - 237, 8.0, now(), tests.uid('orga','user_admin'), ((current_date - 237)::timestamp + time '09:00') at time zone 'Europe/London');
insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg, created_at)
values (tests.uid('orga','org'), tests.uid('orga','a850_deleted'), current_date - 237, 80.0, ((current_date - 237)::timestamp + time '09:05') at time zone 'Europe/London');
insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg, created_at)
values (tests.uid('orga','org'), tests.uid('orga','a850_deleted'), current_date - 230, 78.0, ((current_date - 230)::timestamp + time '09:00') at time zone 'Europe/London');

select is(
  public._threshold_metric_raw(tests.uid('orga','a850_deleted'), 'body.mass_kg', current_date - 237),
  80.0::numeric,
  'a deleted weigh-in is not the day''s figure; the live one is'
);

select public.evaluate_daily_thresholds_for_org(tests.uid('orga','org'), current_date - 230);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga','thr_bm_850') and athlete_id = tests.uid('orga','a850_checkin')),
  0,
  '§1: an athlete with check-in figures and no club weigh-in is never evaluated'
);
select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga','thr_bm_850') and athlete_id = tests.uid('orga','a850_cluster')),
  0,
  '§4: four weigh-ins in one week do not build a baseline — the rule waits'
);
select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga','thr_bm_850') and athlete_id = tests.uid('orga','a850_weekly')),
  1,
  '§4: four weekly weigh-ins spanning 21 days do, and a 2.5 per cent drop fires'
);
select is(
  (select (observed_value, expected_value) from public.flags
    where threshold_id = tests.uid('orga','thr_bm_850') and athlete_id = tests.uid('orga','a850_deleted')),
  (78.000::numeric(10,3), 80.000::numeric(10,3)),
  '§3: the deleted typo is out of the baseline — the mean is 80, not 62'
);

-- ===========================================================================
-- §2 One weigh-in per athlete per day
-- ===========================================================================

select throws_ok(
  format($q$insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg)
          values (%L, %L, current_date - 230, 79.0)$q$,
         tests.uid('orga','org'), tests.uid('orga','a850_weekly')),
  '23505', null,
  'a second weigh-in for an athlete on a day that already has one is refused'
);

-- ===========================================================================
-- §3 and §6, under RLS: who logs, who edits, who deletes, and when
-- ===========================================================================

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged');

-- §6 the coach cannot log a weigh-in
select tests.set_jwt(tests.uid('orga','user_coach'));
select throws_ok(
  format($q$insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg, recorded_by)
          values (%L, %L, current_date, 81.0, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_coach')),
  '42501', null,
  '§6: the coach cannot log a weigh-in'
);

-- The nutritionist logs today's and (backdated) yesterday's for athlete_1.
select tests.set_jwt(tests.uid('orga','user_nutritionist'));
insert into public.body_composition (id, org_id, athlete_id, measured_on, body_mass_kg, recorded_by)
values
  (tests.uid('orga','bc850_today'),     tests.uid('orga','org'), tests.uid('orga','athlete_1'), (now() at time zone auth_org_timezone())::date,     84.0, tests.uid('orga','user_nutritionist')),
  (tests.uid('orga','bc850_yesterday'), tests.uid('orga','org'), tests.uid('orga','athlete_1'), (now() at time zone auth_org_timezone())::date - 1, 84.5, tests.uid('orga','user_nutritionist'));
select is(
  (select count(*)::int from public.body_composition where id in (tests.uid('orga','bc850_today'), tests.uid('orga','bc850_yesterday'))),
  2,
  '§6: the nutritionist logs a weigh-in (today''s, and one backdated to yesterday)'
);

-- §3 same-day edit
update public.body_composition set body_mass_kg = 84.2 where id = tests.uid('orga','bc850_today');
select is(
  (select body_mass_kg from public.body_composition where id = tests.uid('orga','bc850_today')),
  84.2::numeric,
  '§3: a weigh-in measured today can be edited today'
);
select throws_ok(
  format($q$update public.body_composition set body_mass_kg = 85.0 where id = %L$q$, tests.uid('orga','bc850_yesterday')),
  'P0001', 'weigh_in_edit_window_closed',
  '§3: a weigh-in measured before today cannot be edited — and the refusal is loud, not silent'
);

-- §3 nobody hard-deletes
select throws_ok(
  format($q$delete from public.body_composition where id = %L$q$, tests.uid('orga','bc850_today')),
  '42501', null,
  '§3: there is no hard delete on the table any more (0084''s grant is revoked)'
);

-- §3 the nutritionist deletes what they logged today, not the older one
select lives_ok(
  format($q$select public.delete_weigh_in(%L)$q$, tests.uid('orga','bc850_yesterday')),
  '§3: a logging role may delete a weigh-in logged today (0084''s window) even when it is dated yesterday'
);
reset role;
select is(
  (select deleted_at is not null from public.body_composition where id = tests.uid('orga','bc850_yesterday')),
  true,
  'and it is a soft delete: the row stays, marked (read as postgres — the policies hide it)'
);
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');
select tests.set_jwt(tests.uid('orga','user_nutritionist'));

-- An older weigh-in (logged 230 days ago): the nutritionist may not
select throws_ok(
  format($q$select public.delete_weigh_in(%L)$q$,
         (select id from public.body_composition where athlete_id = tests.uid('orga','a850_weekly') and measured_on = current_date - 230)),
  'P0001', 'weigh_in_delete_not_permitted',
  '§3: a logging role may not delete a weigh-in logged on an earlier day'
);

-- The sport scientist may, at any time, and it is audited
select tests.set_jwt(tests.uid('orga','user_admin'));
select lives_ok(
  format($q$select public.delete_weigh_in(%L)$q$,
         (select id from public.body_composition where athlete_id = tests.uid('orga','a850_weekly') and measured_on = current_date - 230)),
  '§3: the sport scientist deletes a weigh-in of any age'
);
reset role;
select is(
  (select count(*)::int from public.body_composition
    where athlete_id = tests.uid('orga','a850_weekly') and measured_on = current_date - 230 and deleted_at is not null
      and deleted_by = tests.uid('orga','user_admin')),
  1,
  'soft-deleted, and it says who'
);
select is(
  (select count(*)::int from public.audit_log
    where action = 'body_composition.delete'
      and athlete_id = tests.uid('orga','a850_weekly')
      and actor_id = tests.uid('orga','user_admin')),
  1,
  'the delete is audited by name, like every other correction'
);
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');
select tests.set_jwt(tests.uid('orga','user_admin'));
select is(
  (select count(*)::int from public.body_composition where athlete_id = tests.uid('orga','a850_weekly') and measured_on = current_date - 230),
  0,
  'a deleted weigh-in is gone from every read (the select policy excludes it)'
);

-- §2 again: the deleted one no longer blocks re-logging that day
select tests.set_jwt(tests.uid('orga','user_nutritionist'));
select lives_ok(
  format($q$insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg, recorded_by)
          values (%L, %L, (now() at time zone auth_org_timezone())::date - 1, 84.4, %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'), tests.uid('orga','user_nutritionist')),
  '§2: once the day''s weigh-in is deleted, a new one for that day is accepted'
);

-- §7 the athlete reads their own, and not the deleted one
select tests.set_jwt(tests.uid('orga','user_athlete_1'));
select is(
  (select count(*)::int from public.body_composition where athlete_id = tests.uid('orga','athlete_1')),
  2,
  '§7: the athlete reads their own two live weigh-ins (today''s, and the re-logged yesterday)'
);
select is(
  (select count(*)::int from public.body_composition where id = tests.uid('orga','bc850_yesterday')),
  0,
  'and not the deleted one'
);
select throws_ok(
  format($q$select public.delete_weigh_in(%L)$q$, tests.uid('orga','bc850_today')),
  'P0001', 'weigh_in_delete_not_permitted',
  'the athlete cannot delete a weigh-in'
);

-- ===========================================================================
-- §8 flag_actions is gated by the flag
-- ===========================================================================

reset role;
-- A note under the weekly athlete's body-mass flag, and one under a fixture
-- wellness flag the coach can open.
insert into public.flag_actions (id, org_id, flag_id, action_type, note, taken_by)
select tests.uid('orga','fa850_bm'), tests.uid('orga','org'), f.id, 'note', 'down to 78 since the Ashcombe game', tests.uid('orga','user_nutritionist')
from public.flags f where f.threshold_id = tests.uid('orga','thr_bm_850') and f.athlete_id = tests.uid('orga','a850_weekly');

-- The flag's id, captured as postgres for the coach's attempt below (a
-- subquery run as the coach would see nothing and insert a null).
select set_config('tests.bm_flag',
  (select f.id::text from public.flags f where f.threshold_id = tests.uid('orga','thr_bm_850') and f.athlete_id = tests.uid('orga','a850_weekly')),
  true);

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');
select tests.set_jwt(tests.uid('orga','user_coach'));
select is(
  (select count(*)::int from public.flag_actions where id = tests.uid('orga','fa850_bm')),
  0,
  '§8: the coach reads no note under a body-mass flag'
);
select is(
  (select count(*)::int from public.flag_actions where flag_id = tests.uid('orga','flag_visible')),
  1,
  'and still reads the note under a flag they can open'
);
-- A coach who somehow holds the flag's id (a link, a guess): the insert is
-- refused by the policy's join, since the flag is not theirs to read.
select throws_ok(
  format($q$insert into public.flag_actions (org_id, flag_id, action_type, note, taken_by)
          values (%L, %L, 'note', 'x', %L)$q$,
         tests.uid('orga','org'),
         current_setting('tests.bm_flag')::uuid,
         tests.uid('orga','user_coach')),
  '42501', null,
  'and cannot write one under it, even holding its id'
);

select tests.set_jwt(tests.uid('orga','user_nutritionist'));
select is(
  (select count(*)::int from public.flag_actions where id = tests.uid('orga','fa850_bm')),
  1,
  'the nutritionist reads the note'
);

select * from finish();
rollback;
