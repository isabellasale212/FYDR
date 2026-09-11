-- The GPS tier gate, inside compute_leaderboard rather than on four pages.
--
-- WHAT WAS WRONG. Nine metrics sourced from gps_records are leaderboard_eligible,
-- GPS is a Premium upsell, and until 2026-09-08 the rule lived only in the pages:
-- two staff screens, then two athlete screens once Q-29 was fixed. The function
-- enforced four other rules internally -- eligibility, staff-versus-athlete
-- visibility, opt-outs, under-18 consent -- and never read organisations.tier. A
-- direct call returned GPS rankings for a Basic club, which leaderboards/new had
-- named in its own header since GPS boards landed.
--
-- IT RETURNS EMPTY, IT DOES NOT RAISE, and that is not a stylistic choice.
-- fetchMyBoards (lib/queries/leaderboards.ts:232) ranks EVERY published board in
-- one Promise.all, so an exception on one gated GPS board would reject the whole
-- list and take the club's non-GPS boards down with it. The existing precedent in
-- this function agrees: a non-published board seen by a non-staff caller returns
-- empty too. Only genuine misconfiguration -- an ineligible metric -- raises.
--
-- THE TEST IS ON source_table, NOT ON THE KEY PREFIX, which is what Isabella
-- asked for: a future GPS metric named under some other convention is still
-- caught. Proving that needs a test the prefix cannot also explain, so two
-- assertions below deliberately DISAGREE the key and the source:
--
--   a training.* key re-sourced to gps_records      -> must be BLOCKED
--   a gps.* key re-sourced to training_entries      -> must NOT be blocked
--
-- Either one alone would pass against a prefix check. Together they can only pass
-- against a source_table check.
--
-- THREE ATHLETES, NOT THE FIXTURES' TWO. The function refuses any ranking with
-- fewer than greatest(min_population, 3) people in it, so on the two fixture
-- athletes every board returns nothing and a naive version of this file would
-- pass on both sides of every assertion for entirely the wrong reason. A third
-- athlete is added so the positive controls are real.

begin;
select * from no_plan();

select tests.fixtures();
set local role authenticated;

select ok(tests.rls_is_engaged(),
  'canary: RLS is on, so these reads go through policies rather than around them');

-- --------------------------------------------------------------------- setup
reset role;
select tests.clear_jwt();

do $$
declare o   uuid := tests.uid('orga','org');
        a1  uuid := tests.uid('orga','athlete_1');
        a2  uuid := tests.uid('orga','athlete_2');
        a3  uuid := tests.uid('orga','athlete_3');
        adm uuid := tests.uid('orga','user_admin');
        n   integer;
begin
  update public.organisations set tier = 'core' where id = o;
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'could not set the fixture org to core, changed % rows', n; end if;

  insert into public.athletes (id, org_id, first_name, last_name, date_of_birth)
  values (a3, o, 'Fixture', 'Third', date '1998-03-04');

  -- GPS data for all three, so a GPS board can actually rank.
  insert into public.gps_records (org_id, athlete_id, record_date, total_distance_m)
  values (o, a1, current_date - 2, 6000), (o, a2, current_date - 2, 6500), (o, a3, current_date - 2, 7000);

  -- And training data for all three, so the non-GPS control can rank.
  insert into public.training_entries (org_id, athlete_id, entry_date, rpe, duration_min)
  values (o, a1, current_date - 2, 6, 60), (o, a2, current_date - 2, 7, 70), (o, a3, current_date - 2, 8, 80);

  insert into public.leaderboards
    (id, org_id, name, metric_key, aggregation, population_type, window_type, visibility, created_by)
  values
    (tests.uid('orga','lb_gps'),   o, 'GPS distance',  'gps.total_distance_m',
     'total', 'squad', 'all_time', 'published', adm),
    (tests.uid('orga','lb_train'), o, 'Session load',  'training.total_session_load',
     'total', 'squad', 'all_time', 'published', adm),
    -- An ineligible metric, so the "real misconfiguration still raises" rule can
    -- be re-asserted after the function body is replaced wholesale.
    (tests.uid('orga','lb_wellness'), o, 'Readiness', 'wellness.readiness_score',
     'mean', 'squad', 'all_time', 'published', adm);
end $$;

-- Staff, because staff is the case the page-level gate never covered: both staff
-- screens check the tier BEFORE calling this function, so a direct call was the
-- whole bypass.
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after this switch, so what follows measures something');
select tests.set_jwt(tests.uid('orga','user_admin'));

-- ------------------------------------------------- the leak, and its control
select is(
  (select count(*)::int from compute_leaderboard(tests.uid('orga','lb_gps'))),
  0,
  'a GPS board on a Basic club ranks nobody, called directly, as staff: the bypass is closed'
);

select is(
  (select count(*)::int from compute_leaderboard(tests.uid('orga','lb_train'))),
  3,
  'and a NON-GPS board on the same Basic club still ranks all three: no collateral damage'
);

select lives_ok(
  format('select * from compute_leaderboard(%L)', tests.uid('orga','lb_gps')),
  'the gated board returns empty rather than raising, because fetchMyBoards ranks every board in one Promise.all'
);

-- -------------------------------------------------- the same board, Premium
do $$
begin
  reset role;
  perform tests.clear_jwt();
  update public.organisations set tier = 'performance' where id = tests.uid('orga','org');
end $$;
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after this switch, so what follows measures something');
select tests.set_jwt(tests.uid('orga','user_admin'));

select is(
  (select count(*)::int from compute_leaderboard(tests.uid('orga','lb_gps'))),
  3,
  'the identical GPS board on a Premium club ranks all three: the gate is commercial, not a ban'
);

select is(
  (select count(*)::int from compute_leaderboard(tests.uid('orga','lb_train'))),
  3,
  'and the non-GPS board is unchanged on Premium too'
);

-- ---------------------------------------- source_table, not the key prefix
/* THE TWO ASSERTIONS THIS FILE EXISTS FOR. Each one disagrees the key with the
   source, so neither can be satisfied by a prefix check. Back to Basic first. */
do $$
begin
  reset role;
  perform tests.clear_jwt();
  update public.organisations set tier = 'core' where id = tests.uid('orga','org');
  -- A training-KEYED metric that is really GPS data.
  update public.metric_definitions set source_table = 'gps_records'
   where key = 'training.total_session_load';
end $$;
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after this switch, so what follows measures something');
select tests.set_jwt(tests.uid('orga','user_admin'));

select is(
  (select count(*)::int from compute_leaderboard(tests.uid('orga','lb_train'))),
  0,
  'a metric sourced from gps_records is blocked on Basic even though its key says training: the gate reads source_table'
);

do $$
begin
  reset role;
  perform tests.clear_jwt();
  update public.metric_definitions set source_table = 'training_entries_current'
   where key = 'training.total_session_load';
  -- And the mirror: a gps-KEYED metric that is not GPS data.
  update public.metric_definitions set source_table = 'training_entries_current'
   where key = 'gps.total_distance_m';
end $$;
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after this switch, so what follows measures something');
select tests.set_jwt(tests.uid('orga','user_admin'));

select is(
  (select count(*)::int from compute_leaderboard(tests.uid('orga','lb_gps'))),
  3,
  'and a gps-KEYED metric sourced elsewhere is NOT blocked on Basic: the gate is not reading the prefix'
);

-- --------------------------------------------------- and for an athlete too
do $$
begin
  reset role;
  perform tests.clear_jwt();
  update public.metric_definitions set source_table = 'gps_records'
   where key = 'gps.total_distance_m';
end $$;
set local role authenticated;
select ok(tests.rls_is_engaged(), 'canary: RLS is engaged after this switch, so what follows measures something');
select tests.set_jwt(tests.uid('orga','user_athlete_1'));

select is(
  (select count(*)::int from compute_leaderboard(tests.uid('orga','lb_gps'))),
  0,
  'an athlete on a Basic club ranks nobody on a GPS board either, with the metric restored'
);

select is(
  (select count(*)::int from compute_leaderboard(tests.uid('orga','lb_train'))),
  3,
  'and still sees the non-GPS board they are on'
);

-- --------------------------------------------- the rules that were already there
/* Re-asserted because this migration replaces the whole function body, and a
   replacement that quietly dropped one of the four existing rules would pass
   every assertion above. */
select throws_ok(
  format('select * from compute_leaderboard(%L)', tests.uid('orga','lb_wellness')),
  'P0001',
  null,
  'an ineligible metric still RAISES rather than returning empty: real misconfiguration is not silence'
);

select * from finish();
rollback;
