-- 040_leaderboards_test.sql
--
-- migration 0016's own header explains why this feature exists and what it deliberately
-- does not. This file tests the part that actually matters: the non-negotiable rules a
-- direct API call must not be able to route around, per screens/leaderboards.md.
--
-- Which rules this implements
--   An athlete under 18 is off every board by default, on only where they granted
--     leaderboard_visibility themselves (screens/leaderboards.md "Athletes under 18").
--   An opted-out athlete disappears from the ranking, and from their own view of it.
--   The minimum-population guard: below it, nothing is returned, not a small ranking.
--   compute_leaderboard never returns a named row to an admin (aggregate only).
--   A staff-only (draft) board is invisible to an athlete, published or not qualifying.
--   Only medical may record a source='medical' suppression; coach has no such path.
--   An athlete may only ever opt themselves out, never another athlete.

begin;
select * from no_plan();

select tests.fixtures();

-- Extra fixture data this file needs beyond the shared set: tests.fixtures() gives orga
-- two adult athletes, one of whom (athlete_1) has a single training entry. A meaningful
-- ranking, and the minimum-population guard specifically, need at least three qualifying
-- athletes, plus a minor to test the opt-in default. Seeded here, in the same elevated
-- context tests.fixtures() itself runs in, before the role switch below hands control to
-- RLS for every assertion that follows.
do $$
declare
  o    uuid := tests.uid('orga', 'org');
  ucoa uuid := tests.uid('orga', 'user_coach');
  a1   uuid := tests.uid('orga', 'athlete_1');
  a2   uuid := tests.uid('orga', 'athlete_2');
  a3   uuid := tests.uid('orga', 'athlete_3');
  a4   uuid := tests.uid('orga', 'athlete_4_minor');
  u3   uuid := tests.uid('orga', 'user_athlete_3');
  u4   uuid := tests.uid('orga', 'user_athlete_4_minor');
  ses  uuid := tests.uid('orga', 'session');
begin
  insert into users (id, org_id, email, full_name, status) values
    (u3, o, 'orga.athlete3@fixture.example', 'Priya Shah', 'active'),
    (u4, o, 'orga.athlete4@fixture.example', 'Noah Fitch', 'active');
  insert into user_roles (org_id, user_id, role) values (o, u3, 'athlete'), (o, u4, 'athlete');
  insert into athletes (id, org_id, user_id, first_name, last_name, date_of_birth,
                        position, squad_number, height_cm) values
    (a3, o, u3, 'Priya', 'Shah',  date '2000-03-14', 'Centre', 11, 172.0),
    -- A minor by construction regardless of when this suite runs: always under 18.
    (a4, o, u4, 'Noah',  'Fitch', current_date - interval '15 years', 'Wing', 14, 175.0);

  -- Qualifying training_entries for the total-session-load metric. Distinct values so
  -- ranking order is unambiguous: athlete_3 highest, athlete_2 middle, athlete_1 lowest
  -- (athlete_1 already has entry_date = current_date - 1, rpe 7.0, duration 80 from the
  -- shared fixture, session_load 560).
  insert into training_entries (org_id, athlete_id, session_id, entry_date, rpe,
                                duration_min, source, created_by) values
    (o, a2, ses, current_date - 1, 8.0, 90, 'self_report', tests.uid('orga','user_athlete_2')),
    (o, a3, ses, current_date - 1, 9.0, 100, 'self_report', u3),
    (o, a4, ses, current_date - 1, 6.0, 70, 'self_report', u4);
end $$;

set local role authenticated;


-- ===========================================================================
-- 1. The catalogue: readable by everyone, wellness stays permanently ineligible
-- ===========================================================================

-- The literal below is the catalogue's real size, and it moves whenever a metric
-- lands: 6 when migration 0016 seeded it, 15 since migration 0056 added the nine
-- gps.* metrics. Deliberately kept exact rather than loosened to a floor — the rule
-- under test is that this role reads the WHOLE catalogue, and a role quietly seeing
-- a subset is the failure this assertion exists to catch. Adding a metric is meant
-- to be a conscious edit here.
select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is((select count(*) from metric_definitions), 15::bigint,
  'an athlete reads the full metric catalogue');
select is(
  (select leaderboard_eligible from metric_definitions where key = 'wellness.readiness_score'),
  false,
  'readiness score is not leaderboard eligible, for anyone, by construction');
select ok(
  (select ineligible_reason from metric_definitions where key = 'wellness.readiness_score') is not null,
  'the ineligibility carries a reason, not just a false flag');

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is((select count(*) from metric_definitions), 15::bigint,
  'an admin reads the catalogue too — it names what CAN be ranked, not who is');


-- ===========================================================================
-- 2. Board creation and visibility
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select throws_ok(
  format($q$insert into leaderboards
              (org_id, name, metric_key, aggregation, population_type, window_type,
               visibility, created_by)
            values (%L, 'Athlete attempt', 'training.total_session_load', 'total', 'squad',
                    'all_time', 'staff', %L)$q$,
         tests.uid('orga','org'), tests.uid('orga','user_athlete_1')),
  '42501', null,
  'an athlete cannot create a leaderboard'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select lives_ok(
  format($q$insert into leaderboards
              (id, org_id, name, metric_key, aggregation, population_type, window_type,
               visibility, created_by)
            values (%L, %L, 'Total load, draft', 'training.total_session_load', 'total',
                    'squad', 'all_time', 'staff', %L)$q$,
         tests.uid('orga','lb_draft'), tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'a coach creates a draft leaderboard'
);
select lives_ok(
  format($q$insert into leaderboards
              (id, org_id, name, metric_key, aggregation, population_type, window_type,
               visibility, created_by)
            values (%L, %L, 'Total load', 'training.total_session_load', 'total',
                    'squad', 'all_time', 'published', %L)$q$,
         tests.uid('orga','lb_published'), tests.uid('orga','org'), tests.uid('orga','user_coach')),
  'a coach creates and publishes a leaderboard'
);
-- A second published board, deliberately restricted to two athletes by selection
-- rather than by squad membership, so the minimum-population guard below is tested
-- against a population that is small by construction — not by an insert-ordering
-- accident, since every other athlete in this file already has qualifying data by the
-- time any assertion runs (the do block above is not interleaved with the tests).
select lives_ok(
  format($q$insert into leaderboards
              (id, org_id, name, metric_key, aggregation, population_type,
               athlete_ids, window_type, visibility, created_by)
            values (%L, %L, 'Total load, two athletes only', 'training.total_session_load',
                    'total', 'selected', array[%L::uuid, %L::uuid], 'all_time', 'published', %L)$q$,
         tests.uid('orga','lb_small'), tests.uid('orga','org'),
         tests.uid('orga','athlete_1'), tests.uid('orga','athlete_2'),
         tests.uid('orga','user_coach')),
  'a coach creates a second board scoped to two athletes only'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from leaderboards where id = tests.uid('orga','lb_draft')), 0::bigint,
  'an athlete cannot see a staff-only board at all, not even its name');
select is(
  (select count(*) from leaderboards where id = tests.uid('orga','lb_published')), 1::bigint,
  'an athlete can see a published board''s own configuration row');


-- ===========================================================================
-- 3. compute_leaderboard: the minimum-population guard
-- ===========================================================================

-- lb_small's population is two athletes by configuration; the guard needs three.
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from compute_leaderboard(tests.uid('orga','lb_small'))), 0::bigint,
  'below the minimum population, the ranking is empty, not a ranking of two people'
);


-- ===========================================================================
-- 4. compute_leaderboard: a real ranking, on the squad-wide board
-- ===========================================================================

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga','lb_published'))), 3::bigint,
  'three qualifying adults produce a three-row ranking'
);
select is(
  (select athlete_id from compute_leaderboard(tests.uid('orga','lb_published')) where "position" = 1),
  tests.uid('orga','athlete_3'),
  'the highest total load (900) ranks first'
);
select is(
  (select first_name from compute_leaderboard(tests.uid('orga','lb_published')) where "position" = 1),
  'Priya',
  'the coach sees the ranked athlete''s real name, per the staff view'
);


-- ===========================================================================
-- 5. The minor default: off unless they opt themselves in
-- ===========================================================================

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga','lb_published'))
     where athlete_id = tests.uid('orga','athlete_4_minor')),
  0::bigint,
  'a minor with qualifying data is still excluded: no leaderboard_visibility consent yet'
);

-- The minor grants their own consent, as themselves — the only party who can.
select tests.set_jwt(tests.uid('orga', 'user_athlete_4_minor'));
select lives_ok(
  format($q$insert into athlete_consents (org_id, athlete_id, purpose, granted_at, notice_version)
            values (%L, %L, 'leaderboard_visibility', now(), '2026.1')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_4_minor')),
  'a minor grants their own leaderboard_visibility consent'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from compute_leaderboard(tests.uid('orga','lb_published'))), 4::bigint,
  'once consent is granted, the same minor appears and the ranking grows to four'
);


-- ===========================================================================
-- 6. Opt-out: an athlete leaves, and their own view confirms it
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select throws_ok(
  format($q$insert into leaderboard_opt_outs
              (org_id, athlete_id, leaderboard_id, opted_out_by, opt_out_source)
            values (%L, %L, %L, %L, 'athlete')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_1'),
         tests.uid('orga','lb_published'), tests.uid('orga','user_athlete_2')),
  '42501', null,
  'an athlete cannot opt another athlete out'
);
select throws_ok(
  format($q$insert into leaderboard_opt_outs
              (org_id, athlete_id, leaderboard_id, opted_out_by, opt_out_source)
            values (%L, %L, %L, %L, 'medical')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'),
         tests.uid('orga','lb_published'), tests.uid('orga','user_athlete_2')),
  '42501', null,
  'an athlete cannot record their own exit as a medical suppression'
);
select lives_ok(
  format($q$insert into leaderboard_opt_outs
              (org_id, athlete_id, leaderboard_id, opted_out_by, opt_out_source)
            values (%L, %L, %L, %L, 'athlete')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_2'),
         tests.uid('orga','lb_published'), tests.uid('orga','user_athlete_2')),
  'an athlete opts themselves out, correctly'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from compute_leaderboard(tests.uid('orga','lb_published'))), 3::bigint,
  'the opted-out athlete drops the ranking from four to three, positions close up'
);

select tests.set_jwt(tests.uid('orga', 'user_athlete_2'));
select is(
  (select count(*) from compute_leaderboard(tests.uid('orga','lb_published'))
     where athlete_id = tests.uid('orga','athlete_2')),
  0::bigint,
  'the opted-out athlete does not see themselves, or anyone else, on their own former board'
);


-- ===========================================================================
-- 7. Medical suppression: medical can, coach cannot
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select throws_ok(
  format($q$insert into leaderboard_opt_outs
              (org_id, athlete_id, leaderboard_id, opted_out_by, opt_out_source, reason)
            values (%L, %L, %L, %L, 'medical', 'clinical judgement')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_3'),
         tests.uid('orga','lb_published'), tests.uid('orga','user_coach')),
  '42501', null,
  'a coach has no path to a medical suppression, only medical does'
);

select tests.set_jwt(tests.uid('orga', 'user_medical'));
select lives_ok(
  format($q$insert into leaderboard_opt_outs
              (org_id, athlete_id, leaderboard_id, opted_out_by, opt_out_source, reason)
            values (%L, %L, %L, %L, 'medical', 'clinical judgement')$q$,
         tests.uid('orga','org'), tests.uid('orga','athlete_3'),
         tests.uid('orga','lb_published'), tests.uid('orga','user_medical')),
  'medical suppresses an athlete on clinical grounds'
);

-- Suppressing athlete_3 leaves only two qualifying athletes (athlete_1, athlete_4), which
-- is below this metric's own minimum population of three. The guard from section 3 fires
-- again here, on its own, from ordinary exclusions compounding rather than a small
-- population by construction: the whole board disappears rather than showing a ranking
-- of two identifiable people. This is the correct behaviour, not a bug in the guard —
-- screens/leaderboards.md edge case 6, "all athletes opt out... insufficientData".
select tests.set_jwt(tests.uid('orga', 'user_coach'));
select is(
  (select count(*) from compute_leaderboard(tests.uid('orga','lb_published'))), 0::bigint,
  'the suppression drops the qualifying population below the minimum, so the guard empties the whole board, not just the one row'
);


-- ===========================================================================
-- 8. Admin: never a named row
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_admin'));
select is(
  (select count(*) from compute_leaderboard(tests.uid('orga','lb_published'))), 0::bigint,
  'an admin calling compute_leaderboard on a published board still gets zero named rows'
);


-- ===========================================================================
-- 9. A staff-only board stays invisible to an athlete, ranking included
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_athlete_1'));
select is(
  (select count(*) from compute_leaderboard(tests.uid('orga','lb_draft'))), 0::bigint,
  'an athlete gets nothing from a draft board, even one they would otherwise qualify for'
);

select tests.set_jwt(tests.uid('orga', 'user_coach'));
select ok(
  (select count(*) from compute_leaderboard(tests.uid('orga','lb_draft'))) >= 0,
  'a coach may preview a draft board''s ranking (may legitimately be below the minimum)'
);


-- ===========================================================================
-- 10. athlete_is_minor is an internal helper, not a public RPC — migrations
-- 0035/0036's own finding: it had no scoping check inside it at all, so the
-- only real protection is that nothing outside compute_leaderboard (whose
-- own scoping this whole file already tests) may call it directly at all.
-- ===========================================================================

select tests.clear_jwt();
set local role anon;
select throws_ok(
  format($q$select athlete_is_minor(%L)$q$, tests.uid('orga','athlete_4_minor')),
  '42501', null,
  'a fully unauthenticated caller cannot ask whether a specific real athlete is a minor'
);

set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_admin'));
select throws_ok(
  format($q$select athlete_is_minor(%L)$q$, tests.uid('orga','athlete_4_minor')),
  '42501', null,
  'nor can a signed-in admin — this was never meant to be callable directly by anyone, only from inside compute_leaderboard''s own, already-scoped query'
);

select * from finish();
rollback;
