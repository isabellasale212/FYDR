-- 200_minor_leaderboard_test.sql
--
-- The under-18 leaderboard protection, demonstrated end to end on its own — audit
-- finding S6 ("minors' opt-in must be real, not a client toggle") and gameplan 2.1.
--
-- The enforcement under test is migration 0016's compute_leaderboard population
-- clause: `not athlete_is_minor(a.id) or exists (consent … leaderboard_visibility
-- … granted_at is not null and withdrawn_at is null)`. 040_leaderboards_test.sql §5
-- already proves the basic default (minor off, on after self-granted consent) inside
-- its larger board lifecycle; this file is the dedicated, self-contained statement of
-- the rule, and covers the states 040 does not:
--
--   A minor with no leaderboard_visibility consent never appears, however good
--     their qualifying results are.
--   An adult appears by default, with no consent row at all.
--   A minor WITH granted consent appears.
--   A minor whose consent was granted and then WITHDRAWN disappears again:
--     withdrawal has immediate effect, Article 7(3).
--   An adult with a withdrawn consent row still appears — adults are default-in;
--     their exit is the opt-out, not this consent. The withdrawn row an adult may
--     carry (seed.sql §12 creates some) must not accidentally hide them.
--   The 18th-birthday boundary, both sides: exactly 18 today is an adult and
--     appears by default; 18-minus-one-day is a minor and does not.
--   Unknown age fails SAFE: an unlinked athlete with no date_of_birth on file is
--     treated as a minor (athlete_is_minor returns true for null DOB) and excluded.
--   An excluded minor calling compute_leaderboard themselves gets zero rows: the
--     final own-row gate means they do not see a board they are not on.

begin;
select * from no_plan();

select tests.fixtures();

-- Fixture extension, in the same elevated context tests.fixtures() runs in. One
-- published squad board, and a cast covering every age/consent state above. Every
-- athlete gets one qualifying training entry on the shared completed session, so the
-- ONLY thing separating who ranks from who does not is age and consent.
do $$
declare
  o    uuid := tests.uid('orga', 'org');
  ucoa uuid := tests.uid('orga', 'user_coach');
  ses  uuid := tests.uid('orga', 'session');

  a_minor_none      uuid := tests.uid('orga', 'athlete_minor_none');
  a_minor_granted   uuid := tests.uid('orga', 'athlete_minor_granted');
  a_minor_withdrawn uuid := tests.uid('orga', 'athlete_minor_withdrawn');
  a_adult_plain     uuid := tests.uid('orga', 'athlete_adult_plain');
  a_adult_withdrawn uuid := tests.uid('orga', 'athlete_adult_withdrawn');
  a_18_today        uuid := tests.uid('orga', 'athlete_18_today');
  a_17_364          uuid := tests.uid('orga', 'athlete_17_364');
  a_nodob           uuid := tests.uid('orga', 'athlete_nodob');

  u_minor_none      uuid := tests.uid('orga', 'user_minor_none');
  u_minor_granted   uuid := tests.uid('orga', 'user_minor_granted');
  u_minor_withdrawn uuid := tests.uid('orga', 'user_minor_withdrawn');
  u_adult_plain     uuid := tests.uid('orga', 'user_adult_plain');
  u_adult_withdrawn uuid := tests.uid('orga', 'user_adult_withdrawn');
  u_18_today        uuid := tests.uid('orga', 'user_18_today');
  u_17_364          uuid := tests.uid('orga', 'user_17_364');
begin
  insert into users (id, org_id, email, full_name, status) values
    (u_minor_none,      o, 'orga.minor.none@fixture.example',      'Minor NoConsent', 'active'),
    (u_minor_granted,   o, 'orga.minor.granted@fixture.example',   'Minor Granted',   'active'),
    (u_minor_withdrawn, o, 'orga.minor.withdrawn@fixture.example', 'Minor Withdrawn', 'active'),
    (u_adult_plain,     o, 'orga.adult.plain@fixture.example',     'Adult Plain',     'active'),
    (u_adult_withdrawn, o, 'orga.adult.withdrawn@fixture.example', 'Adult Withdrawn', 'active'),
    (u_18_today,        o, 'orga.adult.18today@fixture.example',   'Adult EighteenToday', 'active'),
    (u_17_364,          o, 'orga.minor.almost18@fixture.example',  'Minor AlmostEighteen', 'active');

  insert into user_roles (org_id, user_id, role)
  select o, u, 'athlete' from unnest(array[
    u_minor_none, u_minor_granted, u_minor_withdrawn, u_adult_plain,
    u_adult_withdrawn, u_18_today, u_17_364]) as u;

  -- Ages by construction against the suite's own run date, never a fixed year:
  -- the two boundary athletes sit exactly on either side of the 18th birthday.
  insert into athletes (id, org_id, user_id, first_name, last_name, date_of_birth,
                        position, squad_number, height_cm) values
    (a_minor_none,      o, u_minor_none,      'Minor', 'NoConsent',
       (current_date - interval '15 years')::date,               'Wing',      41, 178.0),
    (a_minor_granted,   o, u_minor_granted,   'Minor', 'Granted',
       (current_date - interval '16 years' - interval '100 days')::date, 'Centre', 42, 180.0),
    (a_minor_withdrawn, o, u_minor_withdrawn, 'Minor', 'Withdrawn',
       (current_date - interval '16 years' - interval '200 days')::date, 'Fly-half', 43, 176.0),
    (a_adult_plain,     o, u_adult_plain,     'Adult', 'Plain',
       date '1998-05-20',                                        'Lock',      44, 198.0),
    (a_adult_withdrawn, o, u_adult_withdrawn, 'Adult', 'Withdrawn',
       date '1997-09-02',                                        'Flanker',   45, 190.0),
    (a_18_today,        o, u_18_today,        'Adult', 'EighteenToday',
       (current_date - interval '18 years')::date,               'Scrum-half', 46, 175.0),
    (a_17_364,          o, u_17_364,          'Minor', 'AlmostEighteen',
       (current_date - interval '18 years' + interval '1 day')::date, 'Hooker', 47, 182.0);

  -- The unlinked athlete with no date of birth on file. Legal under
  -- athletes_dob_required_when_linked precisely because there is no login; the club
  -- simply has not recorded a DOB, so nothing proves this athlete is an adult.
  insert into athletes (id, org_id, first_name, last_name, position, squad_number)
    values (a_nodob, o, 'Unknown', 'Age', 'Number 8', 48);

  -- The consent states. minor_granted: granted, live. minor_withdrawn and
  -- adult_withdrawn: granted once, since withdrawn. Nobody else has a row at all.
  insert into athlete_consents (org_id, athlete_id, purpose, granted_at, withdrawn_at,
                                notice_version) values
    (o, a_minor_granted,   'leaderboard_visibility', now() - interval '30 days', null, '2026.1'),
    (o, a_minor_withdrawn, 'leaderboard_visibility', now() - interval '30 days',
       now() - interval '2 days', '2026.1'),
    (o, a_adult_withdrawn, 'leaderboard_visibility', now() - interval '90 days',
       now() - interval '10 days', '2026.1');

  -- One qualifying entry each on the shared completed session — including the three
  -- who must NOT rank, which is the point: exclusion is by age and consent, never by
  -- missing data. The no-login athlete's entry is staff recorded, as it would be.
  insert into training_entries (org_id, athlete_id, session_id, entry_date, rpe,
                                duration_min, source, created_by) values
    (o, a_minor_none,      ses, current_date - 1, 9.5, 100, 'self_report',   u_minor_none),
    (o, a_minor_granted,   ses, current_date - 1, 8.0,  90, 'self_report',   u_minor_granted),
    (o, a_minor_withdrawn, ses, current_date - 1, 7.5,  85, 'self_report',   u_minor_withdrawn),
    (o, a_adult_plain,     ses, current_date - 1, 7.0,  80, 'self_report',   u_adult_plain),
    (o, a_adult_withdrawn, ses, current_date - 1, 6.5,  75, 'self_report',   u_adult_withdrawn),
    (o, a_18_today,        ses, current_date - 1, 6.0,  70, 'self_report',   u_18_today),
    (o, a_17_364,          ses, current_date - 1, 5.5,  65, 'self_report',   u_17_364),
    (o, a_nodob,           ses, current_date - 1, 5.0,  60, 'staff_entered', ucoa);

  -- The published squad-wide board every assertion below reads. Same shape as the
  -- live "Total session load" board: all_time window, min_records 1.
  insert into leaderboards (id, org_id, name, metric_key, aggregation, population_type,
                            window_type, visibility, created_by)
    values (tests.uid('orga', 'lb_minor_demo'), o, 'Minor protection demo',
            'training.total_session_load', 'total', 'squad', 'all_time', 'published', ucoa);
end $$;

set local role authenticated;
select tests.set_jwt(tests.uid('orga', 'user_coach'));

-- ===========================================================================
-- 1. Who ranks. Fixture athlete_1 (adult, entry from tests.build_org) plus the
-- four eligible newcomers = five. Every exclusion below therefore happened with
-- the population guard comfortably satisfied — nothing is hidden by smallness.
-- ===========================================================================

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_minor_demo'))),
  5::bigint,
  'five athletes rank: the fixture adult, both boundary-or-older adults, the '
  'withdrawn-consent adult, and the one consented minor');

-- ===========================================================================
-- 2. The rule itself, athlete by athlete
-- ===========================================================================

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_minor_demo'))
    where athlete_id = tests.uid('orga', 'athlete_minor_none')),
  0::bigint,
  'a minor with no leaderboard_visibility consent never appears, even with the '
  'highest qualifying load on the board');

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_minor_demo'))
    where athlete_id = tests.uid('orga', 'athlete_adult_plain')),
  1::bigint,
  'an adult appears by default, with no consent row anywhere');

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_minor_demo'))
    where athlete_id = tests.uid('orga', 'athlete_minor_granted')),
  1::bigint,
  'a minor with granted leaderboard_visibility consent appears');

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_minor_demo'))
    where athlete_id = tests.uid('orga', 'athlete_minor_withdrawn')),
  0::bigint,
  'a minor who granted and then withdrew consent disappears again: withdrawal is '
  'immediate, Article 7(3)');

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_minor_demo'))
    where athlete_id = tests.uid('orga', 'athlete_adult_withdrawn')),
  1::bigint,
  'an adult with a withdrawn consent row still appears: adults are default-in and '
  'leave via opt-out, so a stale consent row cannot hide one');

-- ===========================================================================
-- 3. The 18th-birthday boundary, both sides of one day
-- ===========================================================================

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_minor_demo'))
    where athlete_id = tests.uid('orga', 'athlete_18_today')),
  1::bigint,
  'an athlete who turns exactly 18 today is an adult and appears by default');

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_minor_demo'))
    where athlete_id = tests.uid('orga', 'athlete_17_364')),
  0::bigint,
  'one day short of 18 is still a minor and still excluded without consent');

-- ===========================================================================
-- 4. Unknown age fails safe
-- ===========================================================================

select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_minor_demo'))
    where athlete_id = tests.uid('orga', 'athlete_nodob')),
  0::bigint,
  'an athlete with no date of birth on file is treated as a minor and excluded: '
  'unknown age fails safe, never open');

-- ===========================================================================
-- 5. The excluded minor's own view: not on the board means not shown the board
-- ===========================================================================

select tests.set_jwt(tests.uid('orga', 'user_minor_none'));
select is(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_minor_demo'))),
  0::bigint,
  'the unconsented minor calling compute_leaderboard themselves gets zero rows: '
  'the own-row gate keeps a board they are not on entirely out of their client');

select tests.set_jwt(tests.uid('orga', 'user_minor_granted'));
select ok(
  (select count(*) from compute_leaderboard(tests.uid('orga', 'lb_minor_demo'))) = 5
  and exists (select 1 from compute_leaderboard(tests.uid('orga', 'lb_minor_demo'))
               where athlete_id = tests.uid('orga', 'athlete_minor_granted')),
  'the consented minor sees the full five-row ranking, themselves on it — and the '
  'unconsented minor is not in what they see either');

select * from finish();
rollback;
