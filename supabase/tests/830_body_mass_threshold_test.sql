-- 830_body_mass_threshold_test.sql
--
-- Migration 0128: body mass becomes a flaggable metric (STAFF-SS-01 D7, ruled
-- 2026-09-13, batch B3). Thresholded on CHANGE OVER TIME against the athlete's
-- own rolling mean, never an absolute number — the database refuses the
-- absolute shape. The flag it raises is body mass, so the coach never reads it
-- (access-matrix §3.2: "The coach does not see body mass at all"); the four
-- roles that may log a weigh-in read it, and the athlete reads their own once
-- staff have acknowledged it, like every other flag.
--
-- Written BEFORE the migration, per CLAUDE.md §5 (a permission rule gets its
-- test first).
--
-- What this file asserts
--   1. default_threshold_set(): six rules now, the sixth on body.mass_kg,
--      domain nutrition, a percentage change against the personal baseline,
--      and the coach not among the roles it notifies.
--   2. thresholds: a body-mass rule with an absolute comparison, or an absolute
--      baseline, or the coach in notify_roles, is refused at the table.
--   3. The evaluator: a weigh-in more than 2 per cent below the athlete's own
--      28-day mean fires; 1.25 per cent below does not; a day with no weigh-in
--      is a gap and raises nothing; the day's figure is the staff weigh-in
--      (body_composition) — and ONLY that: since 0131 (body-mass-rule.md §1)
--      the athlete's check-in figure is not a source, so the merge athlete's
--      check-in baseline builds nothing and the check-in-only athlete is never
--      evaluated (0128 had both firing; 850 holds the 0131 cases in full).
--   4. flags RLS: the coach reads none of the body-mass flags and every other
--      staff role reads them; a coach who is also an S&C reads them (roles are
--      unions); the coach cannot acknowledge one; the athlete reads their own
--      only after athlete_visible_at is set.
--   5. preview_threshold_rule on body.mass_kg answers the sport scientist and
--      not the coach.
--
-- Synthetic data is anchored 250 days back, the same anchor 270 uses, so it
-- never collides with tests.build_org()'s own rows. The preview section needs
-- data inside the trailing 28 days and uses a dedicated athlete for it.

begin;
select * from no_plan();

select tests.fixtures();

-- ===========================================================================
-- 1. The default set
-- ===========================================================================

select is(
  (select count(*)::int from public.default_threshold_set()),
  6,
  'default_threshold_set() now returns six starter rules'
);

select is(
  (select count(*)::int from public.default_threshold_set()
    where metric = 'body.mass_kg'
      and domain = 'nutrition'
      and comparison = 'pct_change_below'
      and baseline_type = 'personal_rolling'
      and is_active),
  1,
  'the sixth is body mass: a percentage drop against the personal baseline, in the nutrition domain, live'
);

select ok(
  (select not ('coach'::public.app_role = any(notify_roles))
     from public.default_threshold_set() where metric = 'body.mass_kg'),
  'the body-mass default never notifies the coach'
);

-- ===========================================================================
-- 2. The table refuses the absolute shape and the coach
-- ===========================================================================

select throws_ok(
  format($q$insert into public.thresholds
            (org_id, name, domain, metric, comparison, value, baseline_type, baseline_days,
             consecutive_days, min_baseline_observations, cooldown_days, severity, notify_roles, created_by)
          values (%L, 'Test: absolute body mass', 'nutrition', 'body.mass_kg', 'below', 75,
                  'absolute', null, 1, 0, 7, 'medium', '{nutritionist}', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_coach')),
  '23514', null,
  'a body-mass rule on an absolute number is refused'
);

select throws_ok(
  format($q$insert into public.thresholds
            (org_id, name, domain, metric, comparison, value, baseline_type, baseline_days,
             consecutive_days, min_baseline_observations, cooldown_days, severity, notify_roles, created_by)
          values (%L, 'Test: change but absolute baseline', 'nutrition', 'body.mass_kg', 'pct_change_below', 2,
                  'absolute', null, 1, 0, 7, 'medium', '{nutritionist}', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_coach')),
  '23514', null,
  'a body-mass rule that names a change but no personal baseline is refused'
);

select throws_ok(
  format($q$insert into public.thresholds
            (org_id, name, domain, metric, comparison, value, baseline_type, baseline_days,
             consecutive_days, min_baseline_observations, cooldown_days, severity, notify_roles, created_by)
          values (%L, 'Test: tells the coach', 'nutrition', 'body.mass_kg', 'pct_change_below', 2,
                  'personal_rolling', 28, 1, 4, 7, 'medium', '{coach,nutritionist}', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_coach')),
  '23514', null,
  'a body-mass rule that would notify the coach is refused'
);

-- The rule the rest of this file evaluates: the default's own shape.
insert into public.thresholds
  (id, org_id, name, domain, metric, comparison, value, baseline_type, baseline_days,
   consecutive_days, min_baseline_observations, cooldown_days, severity, notify_roles, created_by)
values
  (tests.uid('orga','thr_body_mass'), tests.uid('orga','org'), 'Test: body mass dropped',
   'nutrition', 'body.mass_kg', 'pct_change_below', 2, 'personal_rolling', 28,
   1, 4, 7, 'medium', '{nutritionist,strength_conditioning}', tests.uid('orga','user_admin'));

select is(
  (select count(*)::int from public.thresholds where id = tests.uid('orga','thr_body_mass')),
  1,
  'the change-over-time shape is accepted'
);

-- ===========================================================================
-- 3. The evaluator
-- ===========================================================================

-- Four athletes, one scenario each (never reused — cooldown is per athlete).
insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status)
values
  (tests.uid('orga','athlete_bm_drop'),   tests.uid('orga','org'), 'Test', 'MassDrop',   date '2000-01-01', 'active'),
  (tests.uid('orga','athlete_bm_near'),   tests.uid('orga','org'), 'Test', 'MassNear',   date '2000-01-01', 'active'),
  (tests.uid('orga','athlete_bm_merge'),  tests.uid('orga','org'), 'Test', 'MassMerge',  date '2000-01-01', 'active'),
  (tests.uid('orga','athlete_bm_checkin'),tests.uid('orga','org'), 'Test', 'MassCheckin',date '2000-01-01', 'active');

-- Weekly staff weigh-ins at 80.0 kg on D-28, D-21, D-14, D-7 (D = current_date - 250):
-- four observations, the default's minimum, mean 80.0.
insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg)
select tests.uid('orga','org'), a, (current_date - 250) - d, 80.0
from unnest(array[tests.uid('orga','athlete_bm_drop'), tests.uid('orga','athlete_bm_near')]) as a,
     unnest(array[28, 21, 14, 7]) as d;

-- D: 78.0 is 2.5 per cent below 80 — a breach. 79.0 is 1.25 per cent below — not.
insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg)
values
  (tests.uid('orga','org'), tests.uid('orga','athlete_bm_drop'), current_date - 250, 78.0),
  (tests.uid('orga','org'), tests.uid('orga','athlete_bm_near'), current_date - 250, 79.0);

-- Merge: ten daily check-ins at 80.0 kg, then on D both a staff weigh-in
-- (78.0) and a check-in (79.5). Under 0128 the check-ins were the baseline and
-- the weigh-in the day's figure; under 0131 the check-ins are nothing, so the
-- one weigh-in has no baseline and nothing fires.
insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, body_mass_kg, source, created_by)
select
  tests.uid('orga','org'), a, gs::date, 7.5, 4, 4, 4, 4, 4, 80.0, 'self_report', tests.uid('orga','user_coach')
from unnest(array[tests.uid('orga','athlete_bm_merge'), tests.uid('orga','athlete_bm_checkin')]) as a,
     generate_series((current_date - 260)::timestamp, (current_date - 251)::timestamp, interval '1 day') as gs;

insert into public.wellness_entries
  (org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness, stress,
   mood, body_mass_kg, source, created_by)
values
  (tests.uid('orga','org'), tests.uid('orga','athlete_bm_merge'), current_date - 250,
   7.5, 4, 4, 4, 4, 4, 79.5, 'self_report', tests.uid('orga','user_coach')),
  (tests.uid('orga','org'), tests.uid('orga','athlete_bm_checkin'), current_date - 250,
   7.5, 4, 4, 4, 4, 4, 78.0, 'self_report', tests.uid('orga','user_coach'));

insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg)
values (tests.uid('orga','org'), tests.uid('orga','athlete_bm_merge'), current_date - 250, 78.0);

-- A gap day: D-1 has no weigh-in for anyone. Evaluating it raises nothing.
select public.evaluate_daily_thresholds_for_org(tests.uid('orga','org'), current_date - 251);
select is(
  (select count(*)::int from public.flags where threshold_id = tests.uid('orga','thr_body_mass')),
  0,
  'a day with no weigh-in is a gap: nothing is raised'
);

select public.evaluate_daily_thresholds_for_org(tests.uid('orga','org'), current_date - 250);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga','thr_body_mass')
      and athlete_id = tests.uid('orga','athlete_bm_drop')
      and flag_date = current_date - 250
      and domain = 'nutrition' and metric = 'body.mass_kg'),
  1,
  'a weigh-in 2.5 per cent below the athlete''s own 28-day mean raises a body-mass flag in the nutrition domain'
);

select is(
  (select (observed_value, expected_value) from public.flags
    where threshold_id = tests.uid('orga','thr_body_mass')
      and athlete_id = tests.uid('orga','athlete_bm_drop')),
  (78.000::numeric(10,3), 80.000::numeric(10,3)),
  'observed is the day''s weigh-in, expected is the athlete''s own mean'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga','thr_body_mass')
      and athlete_id = tests.uid('orga','athlete_bm_near')),
  0,
  '1.25 per cent below does not fire'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga','thr_body_mass')
      and athlete_id = tests.uid('orga','athlete_bm_merge')),
  0,
  '0131 §1: ten check-in figures build no baseline — one weigh-in on its own fires nothing'
);

select is(
  (select count(*)::int from public.flags
    where threshold_id = tests.uid('orga','thr_body_mass')
      and athlete_id = tests.uid('orga','athlete_bm_checkin')),
  0,
  '0131 §1: an athlete who only ever types a figure on the check-in is never evaluated'
);

-- ===========================================================================
-- 4. Who reads a body-mass flag
-- ===========================================================================

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged for the read tests');

select tests.set_jwt(tests.uid('orga','user_coach'));
select is(
  (select count(*)::int from public.flags where metric = 'body.mass_kg'),
  0,
  'the coach reads no body-mass flag'
);
select is(
  (select count(*)::int from public.flags where metric <> 'body.mass_kg'),
  2,
  'and still reads every other flag (the two fixture flags)'
);
update public.flags set status = 'acknowledged', acknowledged_at = now(),
  acknowledged_by = tests.uid('orga','user_coach')
where metric = 'body.mass_kg';
reset role;
select is(
  (select count(*)::int from public.flags where metric = 'body.mass_kg' and status = 'acknowledged'),
  0,
  'the coach cannot acknowledge a body-mass flag (the update touched nothing)'
);
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');

select tests.set_jwt(tests.uid('orga','user_nutritionist'));
select is(
  (select count(*)::int from public.flags where metric = 'body.mass_kg'),
  1,
  'the nutritionist reads the body-mass flag (one since 0131: the two check-in cases no longer fire)'
);

select tests.set_jwt(tests.uid('orga','user_sc'));
select is(
  (select count(*)::int from public.flags where metric = 'body.mass_kg'),
  1,
  'the S&C reads them'
);

select tests.set_jwt(tests.uid('orga','user_admin'));
select is(
  (select count(*)::int from public.flags where metric = 'body.mass_kg'),
  1,
  'the sport scientist reads them'
);

select tests.set_jwt(tests.uid('orga','user_medical'));
select is(
  (select count(*)::int from public.flags where metric = 'body.mass_kg'),
  1,
  'the medic reads them'
);

select tests.set_jwt(tests.uid('orga','user_dual'));
select is(
  (select count(*)::int from public.flags where metric = 'body.mass_kg'),
  1,
  'a coach who is also the S&C reads them: roles are unions'
);

-- The athlete: their own, once staff have acknowledged it. athlete_1 is the
-- fixture athlete with a user; give them a body-mass flag directly, as the
-- fixture does for its own two.
reset role;
insert into public.flags
  (id, org_id, athlete_id, threshold_id, domain, metric, observed_value, expected_value,
   flag_date, severity, status)
values
  (tests.uid('orga','flag_bm_a1'), tests.uid('orga','org'), tests.uid('orga','athlete_1'),
   tests.uid('orga','thr_body_mass'), 'nutrition', 'body.mass_kg', 77.4, 80.1,
   current_date - 250, 'medium', 'raised');

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');
select tests.set_jwt(tests.uid('orga','user_athlete_1'));
select is(
  (select count(*)::int from public.flags where id = tests.uid('orga','flag_bm_a1')),
  0,
  'the athlete does not read their own body-mass flag before staff acknowledge it'
);

reset role;
update public.flags set status = 'acknowledged', acknowledged_at = now(),
  acknowledged_by = tests.uid('orga','user_nutritionist'), athlete_visible_at = now()
where id = tests.uid('orga','flag_bm_a1');

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');
select tests.set_jwt(tests.uid('orga','user_athlete_1'));
select is(
  (select count(*)::int from public.flags where id = tests.uid('orga','flag_bm_a1')),
  1,
  'and reads it once they do'
);

select tests.set_jwt(tests.uid('orga','user_athlete_2'));
select is(
  (select count(*)::int from public.flags where id = tests.uid('orga','flag_bm_a1')),
  0,
  'a teammate never reads it'
);

-- ===========================================================================
-- 5. The preview answers the sport scientist, not the coach
-- ===========================================================================

reset role;
insert into public.athletes (id, org_id, first_name, last_name, date_of_birth, status)
values (tests.uid('orga','athlete_bm_recent'), tests.uid('orga','org'), 'Test', 'MassRecent', date '2000-01-01', 'active');

-- Weekly weigh-ins inside the trailing 28 days: 80.0 on today-27, -20, -13, -6
-- and a 78.0 yesterday. yesterday's baseline window (28 days ending the day
-- before) holds the four 80.0 readings.
insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg)
select tests.uid('orga','org'), tests.uid('orga','athlete_bm_recent'), current_date - d, 80.0
from unnest(array[27, 20, 13, 6]) as d;
insert into public.body_composition (org_id, athlete_id, measured_on, body_mass_kg)
values (tests.uid('orga','org'), tests.uid('orga','athlete_bm_recent'), current_date - 1, 78.0);

set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after the switch');
select tests.set_jwt(tests.uid('orga','user_admin'));
select ok(
  exists (
    select 1 from public.preview_threshold_rule(
      'body.mass_kg', 'pct_change_below', 2, 'personal_rolling', 28, 1, 4, null, 28)
    where athlete_id = tests.uid('orga','athlete_bm_recent') and breach_days >= 1),
  'the sport scientist''s preview names the athlete whose weigh-in dropped'
);

select tests.set_jwt(tests.uid('orga','user_coach'));
select is(
  (select count(*)::int from public.preview_threshold_rule(
      'body.mass_kg', 'pct_change_below', 2, 'personal_rolling', 28, 1, 4, null, 28)),
  0,
  'the coach''s preview of a body-mass rule answers nothing'
);

select ok(
  exists (
    select 1 from public.preview_threshold_rule(
      'wellness.sleep_hours', 'pct_change_below', 20, 'personal_rolling', 28, 1, 0, null, 28)),
  'the coach''s preview of any other rule still answers (the fixture sleep row is inside the window)'
) ;

select * from finish();
rollback;
