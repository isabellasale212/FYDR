-- 290_gps_leaderboard_metrics_test.sql
--
-- The nine GPS metrics migration 0056 makes leaderboard-eligible, and the proof that
-- making them eligible did not open a hole in the two gates that were already there.
--
-- Written before migration 0056, per CLAUDE.md §5: "write the test for a permission
-- rule before the rule". The rules under test here are not new ones — they are
-- migration 0016's own population clause (minor consent, opt-out, org scoping) — but
-- 0016 resolved raw values from exactly two `training.*` keys, so every one of those
-- gates has only ever been exercised against a training-domain board. A metric
-- dispatcher that reaches a new table is exactly where a gate gets accidentally
-- bypassed, so each one is re-asserted here against a GPS board specifically.
--
-- What this file covers, and why each part is here:
--
--   §1 The catalogue itself. Nine gps.* rows, eligible, domain 'gps'. Plus the
--      regression guard that matters most: the wellness and body-composition
--      prohibition (0016's own documented safety decision) is still intact. Adding
--      metrics to this catalogue is the single change most likely to erode it.
--   §2 Column resolution, one assertion per metric. Each of the nine keys must read
--      the column it names and no other — a transposed pair in a nine-way CASE is
--      silent, produces plausible numbers, and would ship a board that ranks the
--      wrong thing. Every athlete on these boards has a distinct value in every
--      column precisely so a mix-up cannot pass.
--   §3 The aggregation methods on a GPS metric: best, total, mean, latest, and the
--      record_count that min_records is compared against.
--   §4 Cross-tenant isolation. orgb's athlete carries by far the largest value in
--      every column; orga's board must neither rank them nor be reachable at all by
--      orgb's coach.
--   §5 The minor-consent gate, on a GPS board. Both minors out-perform everyone.
--   §6 The opt-out gate, on a GPS board.
--   §7 The non-staff caller's own view of a GPS board.
--
-- 200_minor_leaderboard_test.sql remains the dedicated, exhaustive statement of the
-- minor rule (boundary days, unknown DOB, withdrawal) against a training board. This
-- file does not restate it; it asserts the rule survived the dispatcher change.

begin;
select * from no_plan();

select tests.fixtures();

-- ---------------------------------------------------------------------------
-- The cast. Eight athletes in orga on top of the two build_org already makes, and
-- one heavily-loaded athlete in orgb.
--
-- Every athlete carries a value in all nine GPS columns, and no two athletes share
-- one, so §2's per-metric assertions can only pass if each key reads its own column.
-- a1 (James Barnes, from build_org) is the intended winner among those who may rank;
-- the two athletes who must NOT rank — the unconsented minor and the opted-out
-- adult — are given the two highest values on the board, so their exclusion is
-- visible in the answer rather than indistinguishable from having no data.
-- ---------------------------------------------------------------------------
do $$
declare
  o    uuid := tests.uid('orga', 'org');
  ucoa uuid := tests.uid('orga', 'user_coach');

  a1   uuid := tests.uid('orga', 'athlete_1');
  a2   uuid := tests.uid('orga', 'athlete_2');
  a_c  uuid := tests.uid('orga', 'gps_athlete_c');
  a_d  uuid := tests.uid('orga', 'gps_athlete_d');
  a_e  uuid := tests.uid('orga', 'gps_athlete_e');
  a_mn uuid := tests.uid('orga', 'gps_minor_none');
  a_mg uuid := tests.uid('orga', 'gps_minor_granted');
  a_oo uuid := tests.uid('orga', 'gps_optout');

  u_c  uuid := tests.uid('orga', 'gps_user_c');
  u_d  uuid := tests.uid('orga', 'gps_user_d');
  u_e  uuid := tests.uid('orga', 'gps_user_e');
  u_mn uuid := tests.uid('orga', 'gps_user_minor_none');
  u_mg uuid := tests.uid('orga', 'gps_user_minor_granted');
  u_oo uuid := tests.uid('orga', 'gps_user_optout');

  ob   uuid := tests.uid('orgb', 'org');
  b1   uuid := tests.uid('orgb', 'athlete_1');

  d1   date := current_date - 1;
  d2   date := current_date - 2;

  k    text;
begin
  insert into users (id, org_id, email, full_name, status) values
    (u_c,  o, 'orga.gps.c@fixture.example',        'Gps Charlie', 'active'),
    (u_d,  o, 'orga.gps.d@fixture.example',        'Gps Delta',   'active'),
    (u_e,  o, 'orga.gps.e@fixture.example',        'Gps Echo',    'active'),
    (u_mn, o, 'orga.gps.minor.none@fixture.example',    'Gps MinorNone',    'active'),
    (u_mg, o, 'orga.gps.minor.granted@fixture.example', 'Gps MinorGranted', 'active'),
    (u_oo, o, 'orga.gps.optout@fixture.example',        'Gps OptedOut',     'active');

  insert into user_roles (org_id, user_id, role)
  select o, u, 'athlete' from unnest(array[u_c, u_d, u_e, u_mn, u_mg, u_oo]) as u;

  -- Ages by construction against the run date, never a fixed year — same discipline
  -- as 200_minor_leaderboard_test.sql.
  insert into athletes (id, org_id, user_id, first_name, last_name, date_of_birth,
                        position, squad_number, height_cm) values
    (a_c,  o, u_c,  'Gps', 'Charlie',      date '2000-03-11', 'Flanker',    51, 188.0),
    (a_d,  o, u_d,  'Gps', 'Delta',        date '1996-11-02', 'Wing',       52, 179.0),
    (a_e,  o, u_e,  'Gps', 'Echo',         date '1994-07-19', 'Full-back',  53, 183.0),
    (a_mn, o, u_mn, 'Gps', 'MinorNone',
       (current_date - interval '15 years')::date,                'Centre',     54, 174.0),
    (a_mg, o, u_mg, 'Gps', 'MinorGranted',
       (current_date - interval '16 years')::date,                'Scrum-half', 55, 172.0),
    (a_oo, o, u_oo, 'Gps', 'OptedOut',     date '1997-02-28', 'Lock',       56, 197.0);

  -- Only the consented minor may rank. The other holds no leaderboard_visibility row.
  insert into athlete_consents (org_id, athlete_id, purpose, granted_at, notice_version)
    values (o, a_mg, 'leaderboard_visibility', now() - interval '20 days', '2026.1');

  -- A global opt-out (leaderboard_id null = every board), so this athlete is absent
  -- from all nine boards below rather than just one.
  insert into leaderboard_opt_outs (org_id, athlete_id, leaderboard_id, opted_out_by,
                                    opt_out_source)
    values (o, a_oo, null, u_oo, 'athlete');

  -- The GPS rows. Columns in order:
  --   total_distance_m, running_distance_m, high_speed_distance_m, sprint_distance_m,
  --   high_intensity_efforts, max_speed_ms, accelerations, decelerations, player_load
  --
  -- a1 has two rows on two dates; everyone else has one. That asymmetry is what §3's
  -- total / mean / latest / record_count assertions are computed from, and the later
  -- row (d1) carries the larger value in every column so 'best' and 'latest' agree on
  -- which row wins for a1 while still being distinguishable from 'total' and 'mean'.
  insert into gps_records (org_id, athlete_id, record_date,
                           total_distance_m, running_distance_m, high_speed_distance_m,
                           sprint_distance_m, high_intensity_efforts, max_speed_ms,
                           accelerations, decelerations, player_load) values
    (o, a1,   d2, 6000, 3000, 800, 200, 60, 8.50, 40, 35, 400),
    (o, a1,   d1, 8000, 3600, 900, 260, 72, 9.25, 48, 44, 470),
    (o, a2,   d1, 5000, 2500, 600, 150, 50, 8.10, 30, 28, 380),
    (o, a_c,  d1, 7000, 3200, 700, 180, 55, 8.60, 35, 32, 420),
    (o, a_d,  d1, 4000, 2000, 500, 120, 40, 7.80, 25, 22, 340),
    (o, a_e,  d1, 3000, 1500, 400, 100, 35, 7.50, 20, 18, 300),
    (o, a_mg, d1, 5500, 2700, 650, 160, 52, 8.30, 32, 30, 390),
    -- The two who must not appear, carrying the two best cards in the deck.
    (o, a_mn, d1, 9999, 4500, 1200, 400, 99, 10.20, 60, 55, 600),
    (o, a_oo, d1, 9500, 4400, 1100, 380, 95, 10.10, 58, 53, 590),
    -- The other tenant, larger again on every column.
    (ob, b1,  d1, 99999, 9999, 5000, 2000, 300, 12.00, 200, 200, 999);

  -- One 'best' board per metric, so each key is exercised on its own. Named after the
  -- key so the assertions below read as "the board for this metric".
  foreach k in array array[
    'gps.total_distance_m', 'gps.running_distance_m', 'gps.high_speed_distance_m',
    'gps.sprint_distance_m', 'gps.high_intensity_efforts', 'gps.max_speed_ms',
    'gps.accelerations', 'gps.decelerations', 'gps.player_load']
  loop
    insert into leaderboards (id, org_id, name, metric_key, aggregation, population_type,
                              window_type, visibility, min_records, created_by)
      values (tests.uid('orga', 'lb_best_' || k), o, 'Best ' || k, k, 'best', 'squad',
              'all_time', 'published', 1, ucoa);
  end loop;

  -- The three aggregation-method boards, all on the same metric so the only variable
  -- is the method.
  insert into leaderboards (id, org_id, name, metric_key, aggregation, population_type,
                            window_type, visibility, min_records, created_by) values
    (tests.uid('orga', 'lb_total_distance_total'), o, 'Distance total',
       'gps.total_distance_m', 'total', 'squad', 'all_time', 'published', 1, ucoa),
    (tests.uid('orga', 'lb_total_distance_mean'), o, 'Distance mean',
       'gps.total_distance_m', 'mean', 'squad', 'all_time', 'published', 1, ucoa),
    (tests.uid('orga', 'lb_max_speed_latest'), o, 'Max speed latest',
       'gps.max_speed_ms', 'latest', 'squad', 'all_time', 'published', 1, ucoa);

  -- A 7-day board, to prove the window clause reaches gps_records.record_date at all:
  -- a1's older row (d2) is inside 7 days, so this is checked below with a window that
  -- genuinely excludes it instead.
  insert into leaderboards (id, org_id, name, metric_key, aggregation, population_type,
                            window_type, window_days, visibility, min_records, created_by)
    values (tests.uid('orga', 'lb_distance_1day'), o, 'Distance last 1 day',
            'gps.total_distance_m', 'total', 'squad', 'days', 1, 'published', 1, ucoa);
end $$;

set local role authenticated;
select ok(tests.rls_is_engaged(),
  'canary: this session is subject to RLS, so the assertions below measure something');
select tests.set_jwt(tests.uid('orga', 'user_coach'));


-- ===========================================================================
-- 1. The catalogue
-- ===========================================================================

select is(
  (select count(*) from metric_definitions
    where key like 'gps.%' and leaderboard_eligible and domain = 'gps'),
  9::bigint,
  'nine gps.* metrics are in the catalogue, eligible, in the gps domain');

select is(
  (select count(*) from metric_definitions
    where key like 'gps.%' and source_table <> 'gps_records'),
  0::bigint,
  'every gps.* metric names gps_records as its source table');

select is(
  (select count(*) from metric_definitions
    where key like 'gps.%' and (ineligible_reason is not null or min_population < 3)),
  0::bigint,
  'no gps.* metric carries an ineligible_reason, and none weakens min_population '
  'below the catalogue floor of 3');

-- The regression guard that matters most. Adding metrics is exactly the change that
-- could erode migration 0016''s documented wellness/body-composition prohibition.
select is(
  (select count(*) from metric_definitions
    where domain = 'wellness' and leaderboard_eligible),
  0::bigint,
  'not one wellness or body-composition metric became rankable: 0016''s prohibition '
  'is intact');

select ok(
  (select bool_and(ineligible_reason is not null) from metric_definitions
    where not leaderboard_eligible),
  'every ineligible metric still states its reason, so the builder can show it');


-- ===========================================================================
-- 2. Column resolution: each key reads the column it names, and no other.
--
-- Every value below is a1''s d1 row, which is the maximum among the six athletes who
-- may rank. A transposed pair anywhere in the dispatcher fails here.
-- ===========================================================================

select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_best_gps.total_distance_m'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  8000::numeric,
  'gps.total_distance_m resolves total_distance_m');

select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_best_gps.running_distance_m'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  3600::numeric,
  'gps.running_distance_m resolves running_distance_m');

select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_best_gps.high_speed_distance_m'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  900::numeric,
  'gps.high_speed_distance_m resolves high_speed_distance_m');

select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_best_gps.sprint_distance_m'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  260::numeric,
  'gps.sprint_distance_m resolves sprint_distance_m');

select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_best_gps.high_intensity_efforts'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  72::numeric,
  'gps.high_intensity_efforts resolves high_intensity_efforts');

select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_best_gps.max_speed_ms'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  9.25::numeric,
  'gps.max_speed_ms resolves max_speed_ms, decimals intact');

select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_best_gps.accelerations'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  48::numeric,
  'gps.accelerations resolves accelerations');

select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_best_gps.decelerations'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  44::numeric,
  'gps.decelerations resolves decelerations, not accelerations');

select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_best_gps.player_load'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  470::numeric,
  'gps.player_load resolves player_load');

-- The whole board, not just one row: six athletes rank on every one of the nine
-- metrics, so no metric is quietly returning fewer rows than the others.
select is(
  (select count(distinct athlete_id) from compute_leaderboard(
     tests.uid('orga', 'lb_best_gps.player_load'))),
  6::bigint,
  'six athletes rank on a GPS board: the two fixture adults, three added adults and '
  'the consented minor');


-- ===========================================================================
-- 3. Aggregation methods on a GPS metric
-- ===========================================================================

select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_total_distance_total'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  14000::numeric,
  'total sums a1''s two rows: 6000 + 8000');

select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_total_distance_mean'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  7000::numeric,
  'mean averages a1''s two rows: (6000 + 8000) / 2');

select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_max_speed_latest'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  9.25::numeric,
  'latest takes the most recent record_date''s value, not the largest');

select is(
  (select record_count from compute_leaderboard(tests.uid('orga', 'lb_total_distance_total'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  2,
  'record_count counts a1''s two GPS rows — the number min_records is compared against');

select is(
  (select record_count from compute_leaderboard(tests.uid('orga', 'lb_total_distance_total'))
    where athlete_id = tests.uid('orga', 'athlete_2')),
  1,
  'and one for the athlete with a single row');

select is(
  (select "position" from compute_leaderboard(tests.uid('orga', 'lb_total_distance_total'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  1,
  'a1 ranks first on total distance: higher_is_better orders a GPS metric descending');

-- The window clause really reaches gps_records.record_date: a 1-day board (v_from =
-- current_date - 1) contains a1''s d1 row only, so their total drops from 14000.
select is(
  (select value from compute_leaderboard(tests.uid('orga', 'lb_distance_1day'))
    where athlete_id = tests.uid('orga', 'athlete_1')),
  8000::numeric,
  'a 1-day window excludes a1''s older row: the window is applied to record_date');


-- ===========================================================================
-- 4. Cross-tenant isolation (CLAUDE.md rule 1)
-- ===========================================================================

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_best_gps.total_distance_m'))
    where athlete_id in (tests.uid('orgb', 'athlete_1'), tests.uid('orgb', 'athlete_2'))),
  0::bigint,
  'no orgb athlete appears on an orga GPS board');

select is(
  (select max(value) from compute_leaderboard(tests.uid('orga', 'lb_best_gps.total_distance_m'))),
  8000::numeric,
  'the top value on orga''s board is orga''s own 8000, not orgb''s 99999: no GPS row '
  'crosses the tenancy boundary into another org''s ranking');

select tests.set_jwt(tests.uid('orgb', 'user_coach'));
select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_best_gps.total_distance_m'))),
  0::bigint,
  'orgb''s coach gets nothing at all from orga''s board id: the board lookup itself '
  'is org-scoped');


-- ===========================================================================
-- 5. The minor-consent gate, on a GPS board
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_best_gps.total_distance_m'))
    where athlete_id = tests.uid('orga', 'gps_minor_none')),
  0::bigint,
  'a minor with no leaderboard_visibility consent is absent from a GPS board, despite '
  'holding the highest distance of anyone');

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_best_gps.max_speed_ms'))
    where athlete_id = tests.uid('orga', 'gps_minor_none')),
  0::bigint,
  'and absent from a second GPS metric too: the gate is on the population, not on one '
  'metric''s dispatcher branch');

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_best_gps.total_distance_m'))
    where athlete_id = tests.uid('orga', 'gps_minor_granted')),
  1::bigint,
  'the minor who granted leaderboard_visibility does appear on a GPS board');


-- ===========================================================================
-- 6. The opt-out gate, on a GPS board
-- ===========================================================================

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_best_gps.total_distance_m'))
    where athlete_id = tests.uid('orga', 'gps_optout')),
  0::bigint,
  'an athlete with a global opt-out is absent from a GPS board, despite the second '
  'highest distance of anyone');

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_best_gps.accelerations'))
    where athlete_id = tests.uid('orga', 'gps_optout')),
  0::bigint,
  'and from every other GPS board: leaderboard_id null still means every board');


-- ===========================================================================
-- 7. The non-staff caller's own view of a GPS board
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select ok(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_best_gps.total_distance_m'))) = 6
  and exists (select 1 from compute_leaderboard(tests.uid('orga', 'lb_best_gps.total_distance_m'))
               where athlete_id = tests.uid('orga', 'athlete_1')),
  'a ranked athlete calling a published GPS board themselves gets the full six-row '
  'ranking, their own row on it — their RLS on gps_records, which shows them only '
  'their own records, does not shrink the board');

select tests.set_jwt(tests.uid('orga', 'gps_user_minor_none'));
select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_best_gps.total_distance_m'))),
  0::bigint,
  'the excluded minor calling the GPS board themselves gets zero rows: the own-row '
  'gate keeps a board they are not on out of their client entirely');

select tests.set_jwt(tests.uid('orga', 'gps_user_optout'));
select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_best_gps.total_distance_m'))),
  0::bigint,
  'and the opted-out athlete sees nothing of the board they left');

-- This fixture user held 'admin' and now holds 'sport_scientist' (0063). The
-- reasoning in the old assertion was that admin had no athlete_id, so the
-- own-row gate could never pass. That half is still true. The other half, that
-- admin was not staff, is not: a sport scientist is staff and sees the whole
-- board, so the own-row gate is never the thing deciding their answer.
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select cmp_ok(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_best_gps.total_distance_m'))),
  '>', 0::bigint,
  'a sport scientist reads the named GPS ranking in full: staff, so the own-row '
  'gate never applies to them');

select * from finish();
rollback;
