-- supabase/seed.sql
--
-- Development seed. Applied automatically by `supabase db reset` after every migration.
--
-- What this creates
--   Organisation A, "Ashcombe Rugby Club": a realistic 28 player rugby squad matching the
--   names in fydr-mockup.html and fydr-mockup-roles.html, staff for all four roles, four
--   groups, three teams, a season, fixtures, four weeks of sessions, 28 days of wellness
--   entries with enough variation that personal rolling baselines actually compute, RPE
--   entries, weekly nutrition check ins, five injuries with clinical detail, availability
--   for the whole squad, thresholds, nine open flags and a compliance expectation set.
--
--   Organisation B, "Marlow Vale RUFC": a small decoy squad. It exists only so the
--   tenancy tests in supabase/tests have something to fail against, and its data is
--   deliberately made to LOOK like organisation A's, same entry dates, two identical
--   player names, so a leak reads as plausible data rather than as obvious nonsense.
--
-- Rules this file respects
--   CONTRACT.md rule 6: every 1 to 5 scale runs 5 = best, including soreness.
--   CONTRACT.md rule 7: blank where data is missing, never zero. Missing wellness days are
--     absent rows, not rows of nulls and not rows of zeroes.
--   CLAUDE.md rule 8: no daily nutrition logging. The weekly check in is the only thing.
--
-- This file runs as the database owner, so RLS is bypassed. That is correct for a seed and
-- is exactly why the pgTAP suite sets a JWT and switches to the authenticated role instead
-- of trusting anything this file can see.

begin;

-- Deterministic identifiers so a developer can bookmark a URL and a test can reference a
-- known row. The prefix says which organisation an id belongs to at a glance.
--   a...  organisation A        b...  organisation B
--   a71e  athlete               u5e2  user

-- ===========================================================================
-- 1. Organisations
-- ===========================================================================

insert into organisations (id, name, sport, timezone, country_code, tier, settings) values
  ('a0000000-0000-4000-8000-000000000001', 'Ashcombe Rugby Club', 'rugby_union',
   'Europe/London', 'GB', 'performance',
   jsonb_build_object(
     'children', jsonb_build_object('parental_involvement_required', true),
     'exports',  jsonb_build_object('file_retention_days', 7, 'max_export_rows', 5000000),
     'selection', jsonb_build_object('short_turnaround_days', 6)
   )),
  ('b0000000-0000-4000-8000-000000000001', 'Marlow Vale RUFC', 'rugby_union',
   'Europe/London', 'GB', 'core', '{}'::jsonb);


-- ===========================================================================
-- 2. Staff users and roles
--
-- Names taken from fydr-mockup-roles.html, which signs in as three of them.
-- Roles are additive: the S&C lead holds coach, the physio holds medical, and the club
-- secretary holds admin only, which by 01-roles-and-permissions.md §1 means she manages
-- the club and cannot read a single wellness score.
-- ===========================================================================

insert into users (id, org_id, email, full_name, status, claims_version) values
  ('e5e20000-0000-4000-8000-00000000000a', 'a0000000-0000-4000-8000-000000000001',
   'p.ackland@ashcomberfc.example',   'Peter Ackland',   'active', 1),
  ('e5e20000-0000-4000-8000-00000000000b', 'a0000000-0000-4000-8000-000000000001',
   'm.iremonger@ashcomberfc.example', 'Mark Iremonger',  'active', 1),
  ('e5e20000-0000-4000-8000-00000000000c', 'a0000000-0000-4000-8000-000000000001',
   'k.doyle@ashcomberfc.example',     'Kate Doyle',      'active', 1),
  ('e5e20000-0000-4000-8000-00000000000d', 'a0000000-0000-4000-8000-000000000001',
   'r.callaghan@ashcomberfc.example', 'Ruth Callaghan',  'active', 1),
  ('e5e20000-0000-4000-8000-00000000000e', 'a0000000-0000-4000-8000-000000000001',
   'a.whitmore@ashcomberfc.example',  'Anna Whitmore',   'active', 1),
  ('e5e20000-0000-4000-8000-00000000000f', 'a0000000-0000-4000-8000-000000000001',
   'j.pemberton@ashcomberfc.example', 'Jane Pemberton',  'active', 1),
  -- Organisation B staff, one of each role, so the tenancy suite can sign in as all four
  -- on the far side of the boundary as well.
  ('e5e20000-0000-4000-8000-0000000000ba', 'b0000000-0000-4000-8000-000000000001',
   'head.coach@marlowvale.example',   'Duncan Pearce',   'active', 1),
  ('e5e20000-0000-4000-8000-0000000000bb', 'b0000000-0000-4000-8000-000000000001',
   'physio@marlowvale.example',       'Elena Marsden',   'active', 1),
  ('e5e20000-0000-4000-8000-0000000000bc', 'b0000000-0000-4000-8000-000000000001',
   'admin@marlowvale.example',        'Chidi Nkemelu',   'active', 1);

insert into user_roles (org_id, user_id, role) values
  -- Head coach.
  ('a0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-00000000000a', 'coach'),
  -- S&C lead.
  ('a0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-00000000000b', 'coach'),
  -- Nutritionist. There is no nutritionist role: 01-roles-and-permissions.md §1 has four
  -- roles and a nutritionist is a coach for authorisation purposes.
  ('a0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-00000000000c', 'coach'),
  -- Club physiotherapist. The only person who can set availability or read clinical notes.
  ('a0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-00000000000d', 'medical'),
  -- Performance analyst who is also a physio: roles are additive, not exclusive, and this
  -- row exists so a developer can see the union case working.
  ('a0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-00000000000e', 'coach'),
  ('a0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-00000000000e', 'medical'),
  -- Club secretary. Admin only: no wellness, no flags, no medical detail.
  ('a0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-00000000000f', 'admin'),

  ('b0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-0000000000ba', 'coach'),
  ('b0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-0000000000bb', 'medical'),
  ('b0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-0000000000bc', 'admin');


-- ===========================================================================
-- 3. Organisation A squad, 28 players
--
-- Ordered front row, second row, back row, half backs, centres, back three, because that
-- is the order a coach thinks in (fydr-mockup-roles.html, "Who I can pick").
-- Every athlete is linked to a login, so every one needs a date of birth:
-- athletes_dob_required_when_linked, 04-data-model.md §17.16.
-- ===========================================================================

create temporary table _squad (
  n            int,
  first_name   text,
  last_name    text,
  position     text,
  unit         text,
  squad_number int,
  birth_year   int,
  birth_month  int,
  birth_day    int,
  height_cm    numeric(5,1),
  base_mass    numeric(5,2)
) on commit drop;

insert into _squad values
  ( 1, 'Dan',      'Okonkwo',    'Loosehead prop',  'forwards', 1, 1997,  3, 14, 185.0, 118.40),
  ( 2, 'James',    'Barnes',     'Hooker',          'forwards', 2, 2002,  1, 27, 181.0, 105.20),
  ( 3, 'Viliami',  'Tameifuna',  'Tighthead prop',  'forwards', 3, 1996, 11,  4, 187.0, 124.80),
  ( 4, 'Max',      'Chapman',    'Lock',            'forwards', 4, 1999,  6,  9, 200.0, 118.10),
  ( 5, 'Henry',    'Ross',       'Lock',            'forwards', 5, 1998,  9, 22, 198.0, 116.60),
  ( 6, 'Sam',      'Wren',       'Flanker',         'forwards', 6, 2000,  2, 18, 190.0, 106.30),
  ( 7, 'Adam',     'Selby',      'Flanker',         'forwards', 7, 2001,  7,  3, 188.0, 104.90),
  ( 8, 'Louis',    'Fox',        'Number 8',        'forwards', 8, 1997, 12, 11, 194.0, 112.70),
  ( 9, 'Alex',     'Grant',      'Scrum-half',      'backs',    9, 2000,  4, 25,177.0,  84.30),
  (10, 'Matt',     'Reid',       'Fly-half',        'backs',   10, 1999,  8, 30, 181.0,  88.60),
  (11, 'Waisake',  'Naholo',     'Wing',            'backs',   11, 1998,  5, 16, 186.0,  97.40),
  (12, 'Manu',     'Piutau',     'Centre',          'backs',   12, 1996, 10,  8, 184.0,  99.80),
  (13, 'Tom',      'Ward',       'Centre',          'backs',   13, 2001,  1, 12, 186.0,  95.20),
  (14, 'Ollie',    'Delaney',    'Wing',            'backs',   14, 2002,  6,  1, 183.0,  92.10),
  (15, 'Nathan',   'Bennett',    'Full-back',       'backs',   15, 1999,  3,  7, 185.0,  93.50),
  (16, 'Sione',    'Aholelei',   'Loosehead prop',  'forwards',16, 1995,  9, 19, 183.0, 120.60),
  (17, 'Rory',     'Hastings',   'Hooker',          'forwards',17, 2003,  2,  5, 179.0, 103.80),
  (18, 'Tomasi',   'Koloofai',   'Tighthead prop',  'forwards',18, 2000, 11, 23, 186.0, 123.10),
  (19, 'Isikeli',  'Nadolo',     'Lock',            'forwards',19, 2001,  4, 14, 199.0, 115.40),
  (20, 'Ben',      'Sullivan',   'Lock',            'forwards',20, 2004,  8, 26, 196.0, 110.20),
  (21, 'Conor',    'Moroney',    'Flanker',         'forwards',21, 2002, 12,  2, 189.0, 105.70),
  (22, 'Josh',     'Ferris',     'Number 8',        'forwards',22, 2003,  5, 21, 192.0, 109.30),
  (23, 'Ruaridh',  'Kinsella',   'Scrum-half',      'backs',   23, 2004,  7, 15, 175.0,  82.90),
  (24, 'Elliot',   'Wray',       'Fly-half',        'backs',   24, 2005,  3, 29, 180.0,  86.40),
  (25, 'Seb',      'Ellery',     'Centre',          'backs',   25, 2003, 10, 10, 185.0,  94.60),
  (26, 'Rob',      'Baptiste',   'Centre',          'backs',   26, 2002,  2, 24, 187.0,  96.80),
  (27, 'Harry',    'Ainsley',    'Wing',            'backs',   27, 2005,  6, 18, 182.0,  90.70),
  (28, 'George',   'Palmer',     'Full-back',       'backs',   28, 2004,  1,  9, 184.0,  91.30);

-- One login per squad member.
insert into users (id, org_id, email, full_name, status, claims_version)
select ('e5e20000-0000-4000-8000-' || lpad((100 + s.n)::text, 12, '0'))::uuid,
       'a0000000-0000-4000-8000-000000000001',
       lower(left(s.first_name, 1) || '.' || replace(lower(s.last_name), ' ', '')
             || '@ashcomberfc.example'),
       s.first_name || ' ' || s.last_name,
       'active', 1
from _squad s;

insert into athletes (
  id, org_id, user_id, first_name, last_name, preferred_name, date_of_birth,
  position, squad_number, dominant_side, height_cm, status, joined_at,
  consent_given_at, consent_version, dob_asserted_by, dob_asserted_at,
  parental_consent_recorded_at, parental_consent_recorded_by, parental_consent_method
)
select ('a71e0000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
       'a0000000-0000-4000-8000-000000000001',
       ('e5e20000-0000-4000-8000-' || lpad((100 + s.n)::text, 12, '0'))::uuid,
       s.first_name, s.last_name, s.first_name,
       make_date(s.birth_year, s.birth_month, s.birth_day),
       s.position, s.squad_number,
       case when s.n % 5 = 0 then 'left'::dominant_side else 'right'::dominant_side end,
       s.height_cm, 'active', date '2025-07-01',
       timestamptz '2025-07-04 09:12:00+01', '2026.1',
       'e5e20000-0000-4000-8000-00000000000f', timestamptz '2025-07-02 11:00:00+01',
       -- The club requires parental involvement, so the two athletes still under 18 carry
       -- a recorded club process rather than a parent login. 09 §4.7: there is no parent
       -- account in Fydr, ever.
       case when make_date(s.birth_year, s.birth_month, s.birth_day)
                 > current_date - interval '18 years'
            then timestamptz '2025-07-03 17:30:00+01' end,
       case when make_date(s.birth_year, s.birth_month, s.birth_day)
                 > current_date - interval '18 years'
            then 'e5e20000-0000-4000-8000-00000000000f'::uuid end,
       case when make_date(s.birth_year, s.birth_month, s.birth_day)
                 > current_date - interval '18 years'
            then 'club_registration_form'::parental_consent_method
            else 'not_required'::parental_consent_method end
from _squad s;


-- Every squad member holds the athlete role. Without it the access token hook issues a
-- token with an empty roles array and the athlete shell has nothing to render.
insert into user_roles (org_id, user_id, role)
select 'a0000000-0000-4000-8000-000000000001', a.user_id, 'athlete'
from athletes a
where a.org_id = 'a0000000-0000-4000-8000-000000000001'
  and a.user_id is not null;


-- ===========================================================================
-- 4. Groups, memberships and teams
--
-- Forwards, Backs, Academy and Rehab, which are the four in the mockup's group filter.
-- ===========================================================================

insert into groups (id, org_id, name, description, colour, group_type, sort_order) values
  ('9509000a-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Forwards', 'Front row, second row and back row', '#4f7cff', 'positional', 1),
  ('9509000a-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Backs', 'Half backs, centres and back three', '#f0a020', 'positional', 2),
  ('9509000a-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Academy', 'Under 21 development squad', '#8b5cf6', 'age', 3),
  ('9509000a-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'Rehab', 'Currently working with medical', '#e05252', 'rehab', 4);

insert into group_memberships (org_id, group_id, athlete_id, added_at)
select 'a0000000-0000-4000-8000-000000000001',
       case s.unit when 'forwards' then '9509000a-0000-4000-8000-000000000001'::uuid
                                   else '9509000a-0000-4000-8000-000000000002'::uuid end,
       ('a71e0000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
       timestamptz '2025-07-01 09:00:00+01'
from _squad s;

-- Academy: anyone under 21 on the first day of the season.
insert into group_memberships (org_id, group_id, athlete_id, added_at)
select 'a0000000-0000-4000-8000-000000000001',
       '9509000a-0000-4000-8000-000000000003',
       ('a71e0000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid,
       timestamptz '2025-07-01 09:00:00+01'
from _squad s
where make_date(s.birth_year, s.birth_month, s.birth_day) > date '2025-07-01' - interval '21 years';

-- Rehab: the four athletes carrying something. Membership is history preserving, so an
-- athlete leaving the rehab group gets removed_at rather than a deleted row.
insert into group_memberships (org_id, group_id, athlete_id, added_at)
select 'a0000000-0000-4000-8000-000000000001',
       '9509000a-0000-4000-8000-000000000004',
       ('a71e0000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid,
       timestamptz '2026-07-20 08:00:00+01'
from unnest(array[2, 6, 7, 17, 19]) as n;

insert into teams (id, org_id, name, short_name, colour, rank,
                   squad_size_starting, squad_size_bench, status, sort_order) values
  ('7ea70000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   '1st XV', '1XV', '#1b2a4a', 1, 15, 8, 'active', 1),
  ('7ea70000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   '2nd XV', '2XV', '#3d5a8a', 2, 15, 8, 'active', 2),
  ('7ea70000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Academy XV', 'ACD', '#8b5cf6', 3, 15, 6, 'active', 3);

update athletes
   set default_team_id = case
         when squad_number <= 15 then '7ea70000-0000-4000-8000-000000000001'::uuid
         when squad_number <= 23 then '7ea70000-0000-4000-8000-000000000002'::uuid
         else '7ea70000-0000-4000-8000-000000000003'::uuid end
 where org_id = 'a0000000-0000-4000-8000-000000000001';


-- ===========================================================================
-- 5. Season, fixtures and four weeks of sessions
-- ===========================================================================

insert into seasons (id, org_id, name, starts_on, ends_on, is_current) values
  ('5ea50000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   '2026/27', date '2026-07-01', date '2027-06-30', true);

-- Two played fixtures behind us, the next one on Thursday, then the league opens.
insert into fixtures (id, org_id, season_id, opponent, kickoff_at, venue, home_away,
                      competition, importance, status, result, created_by)
values
  ('f1c50000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   '5ea50000-0000-4000-8000-000000000001', 'Exeter Chiefs',
   (current_date - 4)::timestamptz + time '15:00', 'Sandy Park', 'away',
   'Pre-season', 'friendly', 'played', 'L 17-24',
   'e5e20000-0000-4000-8000-00000000000a'),
  ('f1c50000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   '5ea50000-0000-4000-8000-000000000001', 'Bristol Bears',
   (current_date + 2)::timestamptz + time '19:30', 'Ashcombe Park', 'home',
   'Pre-season', 'friendly', 'scheduled', null,
   'e5e20000-0000-4000-8000-00000000000a'),
  ('f1c50000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   '5ea50000-0000-4000-8000-000000000001', 'Northampton Saints',
   (current_date + 16)::timestamptz + time '15:00', 'Ashcombe Park', 'home',
   'Premiership', 'key', 'scheduled', null,
   'e5e20000-0000-4000-8000-00000000000a');

-- A week template, which is what the nightly expectation generator reads.
insert into week_templates (org_id, name, structure, created_by) values
  ('a0000000-0000-4000-8000-000000000001', 'Standard 1-game week',
   '{"days":[
      {"md_offset":-5,"sessions":[{"type":"recovery","title":"Recovery","duration_min":45,"planned_rpe":3}],
       "requires":{"wellness":true,"rpe":true,"nutrition":false}},
      {"md_offset":-4,"sessions":[{"type":"gym","title":"Lower body","duration_min":60,"planned_rpe":8},
                                  {"type":"training","title":"Conditioning","duration_min":90,"planned_rpe":8}],
       "requires":{"wellness":true,"rpe":true,"nutrition":false}},
      {"md_offset":-3,"sessions":[{"type":"training","title":"Unit skills","duration_min":75,"planned_rpe":6}],
       "requires":{"wellness":true,"rpe":true,"nutrition":false}},
      {"md_offset":-2,"sessions":[{"type":"gym","title":"Upper B","duration_min":55,"planned_rpe":7},
                                  {"type":"training","title":"Team run","duration_min":80,"planned_rpe":7}],
       "requires":{"wellness":true,"rpe":true,"nutrition":false}},
      {"md_offset":-1,"sessions":[{"type":"training","title":"Captain''s run","duration_min":45,"planned_rpe":4}],
       "requires":{"wellness":true,"rpe":true,"nutrition":false}},
      {"md_offset":0,"sessions":[{"type":"match","title":"Fixture"}],
       "requires":{"wellness":true,"rpe":true,"nutrition":false}}
    ]}'::jsonb,
   'e5e20000-0000-4000-8000-00000000000a');

-- Four weeks of sessions ending on the day before the Bristol fixture, generated from a
-- day of week rule. md_offset is stored rather than derived, so a postponement later
-- cannot rewrite the MD-n label these sessions were executed under.
insert into sessions (id, org_id, season_id, fixture_id, session_type, title, starts_at,
                      duration_min, location, md_offset, planned_rpe, planned_load,
                      requires_wellness, requires_rpe, status, created_by)
select
  ('5e550000-0000-4000-8000-' || lpad(row_number() over (order by d, k)::text, 12, '0'))::uuid,
  'a0000000-0000-4000-8000-000000000001',
  '5ea50000-0000-4000-8000-000000000001',
  case when d = (current_date + 2) then 'f1c50000-0000-4000-8000-000000000002'::uuid end,
  k.session_type, k.title,
  d::timestamptz + k.start_time, k.duration_min, k.location,
  -- Days are measured against the nearest forthcoming Thursday fixture.
  (d::date - (current_date + 2)),
  k.planned_rpe, k.planned_rpe * k.duration_min,
  true, k.session_type <> 'meeting',
  case when d < current_date then 'completed'::session_status else 'planned'::session_status end,
  'e5e20000-0000-4000-8000-00000000000b'
from generate_series(current_date - 26, current_date + 2, interval '1 day') as g(d)
cross join lateral (
  select * from (values
    ('recovery'::session_type, 'Recovery',      time '10:00', 45, 'Pool',        3.0, 1),
    ('gym'::session_type,      'Lower body',    time '07:00', 60, 'Gym',         8.0, 2),
    ('training'::session_type, 'Conditioning',  time '10:30', 90, 'Main pitch',  8.0, 3),
    ('training'::session_type, 'Unit skills',   time '10:30', 75, 'Main pitch',  6.0, 4),
    ('gym'::session_type,      'Upper B',       time '06:30', 55, 'Gym',         7.0, 5),
    ('training'::session_type, 'Team run',      time '10:30', 80, 'Main pitch',  7.0, 6),
    ('training'::session_type, 'Captain''s run',time '11:00', 45, 'Main pitch',  4.0, 7),
    ('match'::session_type,    'Fixture',       time '19:30', 80, 'Ashcombe Park', 9.0, 8)
  ) as v(session_type, title, start_time, duration_min, location, planned_rpe, k)
  where case extract(isodow from g.d)::int
          when 1 then v.k in (1)          -- Monday: recovery
          when 2 then v.k in (2, 3)       -- Tuesday: gym then conditioning
          when 3 then v.k in (4)          -- Wednesday: unit skills
          when 4 then v.k in (5, 6)       -- Thursday: gym then team run
          when 5 then v.k in (7)          -- Friday: captain's run
          when 6 then v.k in (8)          -- Saturday: fixture
          else false                      -- Sunday: off
        end
) as k;

-- Everyone is assigned to every session through the two positional groups. Group
-- assignment rather than 28 rows per session is how a coach actually builds a week.
insert into session_participants (org_id, session_id, group_id)
select 'a0000000-0000-4000-8000-000000000001', s.id, g.id
from sessions s
cross join (values ('9509000a-0000-4000-8000-000000000001'::uuid),
                   ('9509000a-0000-4000-8000-000000000002'::uuid)) as g(id)
where s.org_id = 'a0000000-0000-4000-8000-000000000001';

-- Attendance for completed sessions in the last week. Modified and absent rows are what
-- make the "attendance this week" panel say something other than "everyone, always".
insert into session_attendance (org_id, session_id, athlete_id, attendance,
                                modified_reason, recorded_by)
select 'a0000000-0000-4000-8000-000000000001', s.id, a.id,
       case
         when a.squad_number in (6, 17) then 'absent'::attendance_status
         when a.squad_number in (2, 7, 19) then 'modified'::attendance_status
         when (abs(hashtextextended(s.id::text || a.id::text, 11)) % 40) = 0
           then 'excused'::attendance_status
         else 'full'::attendance_status
       end,
       case
         when a.squad_number in (2, 7, 19) then 'Medical restriction applied'
         when (abs(hashtextextended(s.id::text || a.id::text, 11)) % 40) = 0
           then 'Agreed absence'
       end,
       'e5e20000-0000-4000-8000-00000000000b'
from sessions s
join athletes a on a.org_id = s.org_id
where s.org_id = 'a0000000-0000-4000-8000-000000000001'
  and s.status = 'completed'
  and s.starts_at >= current_date - 7;

-- Team allocation for the current week. Draft rows exist deliberately: an athlete must
-- never be able to read one, and the test suite checks that.
insert into team_allocations (org_id, team_id, athlete_id, season_id, week_start,
                              fixture_id, status, source, availability_at_allocation,
                              override_reason, published_at, published_by, created_by)
select 'a0000000-0000-4000-8000-000000000001',
       a.default_team_id, a.id, '5ea50000-0000-4000-8000-000000000001',
       date_trunc('week', current_date)::date,
       case when a.default_team_id = '7ea70000-0000-4000-8000-000000000001'::uuid
            then 'f1c50000-0000-4000-8000-000000000002'::uuid end,
       case when a.squad_number <= 23 then 'published'::team_allocation_status
            else 'draft'::team_allocation_status end,
       'default_team',
       case when a.squad_number in (2, 7, 19) then 'modified'::availability_status
            when a.squad_number in (6, 17)    then 'unavailable'::availability_status
            else 'available'::availability_status end,
       case when a.squad_number in (2, 7, 19, 6, 17)
            then 'Named in the wider squad, availability reviewed Thursday' end,
       case when a.squad_number <= 23 then now() - interval '1 day' end,
       case when a.squad_number <= 23
            then 'e5e20000-0000-4000-8000-00000000000a'::uuid end,
       'e5e20000-0000-4000-8000-00000000000a'
from athletes a
where a.org_id = 'a0000000-0000-4000-8000-000000000001';


-- ===========================================================================
-- 6. Twenty eight days of wellness
--
-- Variation comes from three sources so a personal rolling baseline is meaningful:
--   a per athlete offset, so two players have genuinely different norms;
--   a day of week effect, because the day after a match is not the day after a rest day;
--   deterministic noise from a hash of (athlete, date), so a reset reproduces the data.
--
-- Roughly one day in twelve is MISSING rather than blank filled. A gap is a gap.
-- CONTRACT.md rule 7.
-- ===========================================================================

insert into wellness_entries (
  org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness,
  soreness_areas, stress, mood, resting_hr, body_mass_kg, comment,
  source, submitted_at, created_by
)
select
  'a0000000-0000-4000-8000-000000000001',
  a.id,
  d::date,
  -- Sleep hours, personal norm 6.4 to 8.4, plus noise, clamped to the column's range.
  round(least(11.5, greatest(4.0,
    (6.4 + (s.n % 5) * 0.5)
    + ((abs(hashtextextended(a.id::text || d::text, 1)) % 200) - 100) / 100.0
    - case when extract(isodow from d) = 7 then 0.4 else 0 end
  ))::numeric, 1),
  -- The five 1 to 5 sliders. 5 = best on every one of them, soreness included.
  greatest(1, least(5, 3 + ((abs(hashtextextended(a.id::text || d::text, 2)) % 5) - 2)
                        + case when (s.n % 7) = 0 then -1 else 0 end)),
  greatest(1, least(5, 4 + ((abs(hashtextextended(a.id::text || d::text, 3)) % 5) - 3)
                        - case when extract(isodow from d) in (3, 5) then 1 else 0 end)),
  greatest(1, least(5, 4 + ((abs(hashtextextended(a.id::text || d::text, 4)) % 5) - 3)
                        - case when extract(isodow from d) in (7, 1) then 1 else 0 end)),
  case when (abs(hashtextextended(a.id::text || d::text, 5)) % 4) = 0
       then array['hamstring', 'lower_back']
       when (abs(hashtextextended(a.id::text || d::text, 5)) % 7) = 0
       then array['calf'] end,
  greatest(1, least(5, 4 + ((abs(hashtextextended(a.id::text || d::text, 6)) % 3) - 1))),
  greatest(1, least(5, 4 + ((abs(hashtextextended(a.id::text || d::text, 7)) % 3) - 1))),
  48 + (abs(hashtextextended(a.id::text || d::text, 8)) % 14) + (s.n % 4),
  round((s.base_mass
         + ((abs(hashtextextended(a.id::text || d::text, 9)) % 160) - 80) / 100.0)::numeric, 2),
  case when (abs(hashtextextended(a.id::text || d::text, 10)) % 23) = 0
       then 'Slept badly, travelling back late' end,
  'self_report',
  d::timestamptz + time '06:45' + ((abs(hashtextextended(a.id::text || d::text, 12)) % 60)
                                   * interval '1 minute'),
  a.user_id
from athletes a
join _squad s on ('a71e0000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid = a.id
cross join generate_series(current_date - 27, current_date - 1, interval '1 day') as g(d)
where a.org_id = 'a0000000-0000-4000-8000-000000000001'
  -- The gaps. Three named athletes miss more often, which is what the compliance screen
  -- is for, and everyone else misses occasionally.
  and not (
    (abs(hashtextextended(a.id::text || d::text, 13)) % 12) = 0
    or (s.n in (17, 19, 16) and (abs(hashtextextended(a.id::text || d::text, 14)) % 3) = 0)
  );

-- One correction, so a developer can see a revision chain in real data. The original stays
-- and is marked superseded; the current revision views exclude it. ADR-005. Written in the
-- same order the revise_wellness_entry function uses: close the old row, then insert the
-- new one, because only one live row per athlete per day may exist at a time.
do $$
declare
  v_original public.wellness_entries;
  v_new_id   uuid := 'a71e0000-0000-4000-8000-0000000f0001';
begin
  select * into v_original
  from wellness_entries
  where athlete_id = 'a71e0000-0000-4000-8000-000000000009'
    and entry_date = current_date - 3
    and superseded_by is null;

  if v_original.id is null then
    return;   -- Grant happened to miss that day. A gap is a gap, so leave it alone.
  end if;

  update wellness_entries set superseded_by = v_new_id where id = v_original.id;

  insert into wellness_entries (
    id, org_id, athlete_id, entry_date, sleep_hours, sleep_quality, fatigue, soreness,
    stress, mood, resting_hr, body_mass_kg, comment, source, revision_of, created_by
  ) values (
    v_new_id, v_original.org_id, v_original.athlete_id, v_original.entry_date,
    8.1, v_original.sleep_quality, v_original.fatigue, v_original.soreness,
    v_original.stress, v_original.mood, v_original.resting_hr, v_original.body_mass_kg,
    'Corrected: entered 3 hours by mistake, it was 8',
    'self_report', v_original.id, v_original.created_by
  );
end $$;


-- ===========================================================================
-- 7. Session RPE
--
-- One entry per athlete per completed session, less the ones they missed. Collected at
-- least 30 minutes after the session, which is what the submitted_at offset represents.
-- ===========================================================================

insert into training_entries (
  org_id, athlete_id, session_id, entry_date, rpe, duration_min, comment,
  source, submitted_at, created_by
)
select
  'a0000000-0000-4000-8000-000000000001',
  a.id, s.id, s.starts_at::date,
  greatest(1, least(10, round((coalesce(s.planned_rpe, 6)
    + ((abs(hashtextextended(a.id::text || s.id::text, 21)) % 5) - 2) * 0.5)::numeric, 1))),
  greatest(10, coalesce(s.duration_min, 60)
    + ((abs(hashtextextended(a.id::text || s.id::text, 22)) % 5) - 2) * 5),
  case when (abs(hashtextextended(a.id::text || s.id::text, 23)) % 31) = 0
       then 'Legs felt heavy from Tuesday' end,
  'self_report',
  s.starts_at + (coalesce(s.duration_min, 60) + 45) * interval '1 minute',
  a.user_id
from sessions s
join athletes a on a.org_id = s.org_id
where s.org_id = 'a0000000-0000-4000-8000-000000000001'
  and s.status = 'completed'
  and s.session_type in ('training', 'gym', 'match')
  and (abs(hashtextextended(a.id::text || s.id::text, 24)) % 9) <> 0;


-- ===========================================================================
-- 8. Weekly nutrition check in
--
-- One question, once a week, three answers. Coverage is deliberately around 60 per cent,
-- matching the mockup: a missed check in is not non-compliance and is never chased, and
-- "no answer" is drawn blank, never as a zero and never as a "no".
-- ===========================================================================

insert into nutrition_checkins (
  org_id, athlete_id, week_start, iso_year, iso_week, answer, note,
  protein_target_g, source, submitted_at, created_by
)
select
  'a0000000-0000-4000-8000-000000000001',
  a.id,
  w::date,
  extract(isoyear from w)::int,
  extract(week from w)::int,
  (array['yes', 'roughly', 'no'])[
    1 + (abs(hashtextextended(a.id::text || w::text, 31)) % 3)
  ]::nutrition_checkin_answer,
  case when (abs(hashtextextended(a.id::text || w::text, 32)) % 11) = 0
       then 'Away with work for three days' end,
  round((s.base_mass * 2.0)::numeric, 1),
  'self_report',
  (w + interval '7 days')::timestamptz + time '18:20',
  a.user_id
from athletes a
join _squad s on ('a71e0000-0000-4000-8000-' || lpad(s.n::text, 12, '0'))::uuid = a.id
cross join generate_series(
  date_trunc('week', current_date - 14),
  date_trunc('week', current_date - 7),
  interval '1 week'
) as g(w)
where a.org_id = 'a0000000-0000-4000-8000-000000000001'
  and (abs(hashtextextended(a.id::text || w::text, 33)) % 10) < 6;


-- ===========================================================================
-- 9. Injuries, clinical detail and availability
--
-- Five injuries, each carrying an injury_clinical row that NO coach and NO athlete ever
-- sees in full. The Selby record is the interesting one: coaching staff read
-- "return to play protocol, stage 3 of 6" from availability.restrictions and never the
-- word on the clinical row. That is option 1 from 01-roles-and-permissions.md §4, which
-- is the recommendation while O-995 is open.
-- ===========================================================================

insert into injuries (id, org_id, athlete_id, body_area, side, onset_date, status,
                      expected_return, actual_return, occurred_in, reported_by) values
  -- James Barnes, hooker, modified, no contact. Current.
  ('19700000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'a71e0000-0000-4000-8000-000000000002', 'shoulder', 'right', current_date - 9,
   'rehab', current_date + 5, null, 'match', 'e5e20000-0000-4000-8000-00000000000d'),
  -- Barnes again, earlier in the season and closed. Recurrence is the single most
  -- important pattern in soft tissue injury, so it is a second record, never a reopened
  -- one. screens/injury-record.md.
  ('19700000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'a71e0000-0000-4000-8000-000000000002', 'hamstring', 'left', current_date - 118,
   'closed', current_date - 96, current_date - 94, 'training',
   'e5e20000-0000-4000-8000-00000000000d'),
  -- Adam Selby, head injury, in the graduated return to play protocol.
  ('19700000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'a71e0000-0000-4000-8000-000000000007', 'head', null, current_date - 11,
   'return_to_play', current_date + 3, null, 'match',
   'e5e20000-0000-4000-8000-00000000000d'),
  -- Sam Wren, ankle, out.
  ('19700000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'a71e0000-0000-4000-8000-000000000006', 'ankle', 'left', current_date - 21,
   'open', current_date + 24, null, 'match', 'e5e20000-0000-4000-8000-00000000000d'),
  -- Rory Hastings, calf, out.
  ('19700000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   'a71e0000-0000-4000-8000-000000000017', 'calf', 'right', current_date - 6,
   'open', current_date + 15, null, 'training', 'e5e20000-0000-4000-8000-00000000000d'),
  -- Isikeli Nadolo, groin, training through it.
  ('19700000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'a71e0000-0000-4000-8000-000000000019', 'groin', 'left', current_date - 15,
   'rehab', current_date + 2, null, 'gym', 'e5e20000-0000-4000-8000-00000000000d');

insert into injury_clinical (injury_id, org_id, diagnosis, mechanism, severity,
                             tissue_type, imaging, referral, clinical_notes,
                             treatment_plan, updated_by) values
  ('19700000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Grade 2 acromioclavicular joint sprain', 'Direct contact, fell onto point of shoulder in tackle',
   'moderate', 'ligament', 'Radiograph 6 Aug, no fracture', null,
   'Reluctant to load overhead. Has said twice he does not want to miss the Saints game '
   'and I do not think he is reporting pain honestly. Watch this.',
   'Progressive loading, reassess contact readiness at day 14',
   'e5e20000-0000-4000-8000-00000000000d'),
  ('19700000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Grade 1 biceps femoris strain', 'Non contact, decelerating in a shuttle',
   'minor', 'muscle', 'Ultrasound, small intramuscular oedema', null,
   'Second hamstring episode this season. Eccentric strength deficit on the left, 14 per cent.',
   'Nordic progression, return to running at day 8',
   'e5e20000-0000-4000-8000-00000000000d'),
  ('19700000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Concussion', 'Head to hip contact making a tackle, no loss of consciousness',
   'moderate', 'neurological', null, 'Referred to consultant neurologist for baseline review',
   'Symptom free at rest from day 6. Family history of migraine, so symptom reporting is '
   'harder to read than usual. Coaching staff are asking daily and must not be given detail.',
   'World Rugby graduated return to play, stage 3 of 6, one stage per 24 hours if symptom free',
   'e5e20000-0000-4000-8000-00000000000d'),
  ('19700000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'Lateral ligament complex sprain, grade 2', 'Inversion in a ruck',
   'moderate', 'ligament', 'MRI 21 Jul, ATFL partial thickness tear', null,
   'Persistent swelling at day 21, slower than expected. Considering a second opinion.',
   'Boot for 2 weeks, then proprioceptive loading',
   'e5e20000-0000-4000-8000-00000000000d'),
  ('19700000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   'Medial gastrocnemius strain, grade 1', 'Non contact, push off in a scrum machine session',
   'minor', 'muscle', null, null,
   'Third soft tissue episode in eighteen months. Load history worth a conversation with S&C.',
   'Isometric loading to day 7, then graded running',
   'e5e20000-0000-4000-8000-00000000000d'),
  ('19700000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000001',
   'Adductor longus tendinopathy', 'Gradual onset, overload',
   'minor', 'tendon', null, null,
   'Manageable. He is a stoic and will not tell me when it is worse, so I am asking S&C '
   'to watch his change of direction volume rather than relying on his report.',
   'Copenhagen adduction progression, no maximal kicking for 10 days',
   'e5e20000-0000-4000-8000-00000000000d');

-- Availability for the whole squad. Restrictions are coach visible and are the ONLY thing
-- a coach reads about why an athlete is limited.
insert into availability (org_id, athlete_id, status, restrictions, reason_category,
                          injury_id, effective_from, set_by, note)
select 'a0000000-0000-4000-8000-000000000001', a.id,
       'available', null, null, null,
       now() - interval '30 days', 'e5e20000-0000-4000-8000-00000000000d', null
from athletes a
where a.org_id = 'a0000000-0000-4000-8000-000000000001'
  and a.squad_number not in (2, 6, 7, 17, 19);

insert into availability (org_id, athlete_id, status, restrictions, reason_category,
                          injury_id, effective_from, set_by, note) values
  ('a0000000-0000-4000-8000-000000000001', 'a71e0000-0000-4000-8000-000000000002',
   'modified',
   array['no contact', 'no scrummaging', 'running 80% volume', 'gym lower modified'],
   'injury', '19700000-0000-4000-8000-000000000001',
   now() - interval '9 days', 'e5e20000-0000-4000-8000-00000000000d',
   'Reviewed daily. Contact decision Thursday morning.'),
  ('a0000000-0000-4000-8000-000000000001', 'a71e0000-0000-4000-8000-000000000007',
   'modified',
   array['return to play protocol, stage 3 of 6', 'no contact', 'no collision drills'],
   'injury', '19700000-0000-4000-8000-000000000003',
   now() - interval '11 days', 'e5e20000-0000-4000-8000-00000000000d',
   'Stage advances one per 24 hours if symptom free. Reassessed Friday.'),
  ('a0000000-0000-4000-8000-000000000001', 'a71e0000-0000-4000-8000-000000000006',
   'unavailable', array['no weight bearing training'],
   'injury', '19700000-0000-4000-8000-000000000004',
   now() - interval '21 days', 'e5e20000-0000-4000-8000-00000000000d',
   'Date not set. Reassess at day 28.'),
  ('a0000000-0000-4000-8000-000000000001', 'a71e0000-0000-4000-8000-000000000017',
   'unavailable', array['no running'],
   'injury', '19700000-0000-4000-8000-000000000005',
   now() - interval '6 days', 'e5e20000-0000-4000-8000-00000000000d',
   'Expected back for the Saints game.'),
  ('a0000000-0000-4000-8000-000000000001', 'a71e0000-0000-4000-8000-000000000019',
   'modified', array['no maximal kicking', 'change of direction volume capped'],
   'injury', '19700000-0000-4000-8000-000000000006',
   now() - interval '15 days', 'e5e20000-0000-4000-8000-00000000000d',
   'Trains fully otherwise.');


-- ===========================================================================
-- 10. Thresholds and flags
--
-- Defaults are personal rolling, per 04-data-model.md §10: an athlete who consistently
-- sleeps 6.5 hours is not in trouble, an athlete who normally sleeps 8.5 and slept 6.5 is.
-- ===========================================================================

insert into thresholds (id, org_id, name, description, domain, metric, comparison, value,
                        baseline_type, baseline_days, consecutive_days,
                        min_baseline_observations, cooldown_days, severity, notify_roles,
                        source, created_by) values
  ('7472000a-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001',
   'Readiness below personal norm', 'Composite readiness more than 1.5 SD below own 28 day norm',
   'wellness', 'wellness.readiness_score', 'z_score', -1.5,
   'personal_rolling', 28, 2, 10, 3, 'high', '{coach,medical}', 'default',
   'e5e20000-0000-4000-8000-00000000000b'),
  ('7472000a-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000001',
   'Sleep dropped', 'Sleep more than 20 per cent below own 28 day mean, two days running',
   'wellness', 'wellness.sleep_hours', 'pct_change_below', 20,
   'personal_rolling', 28, 2, 10, 3, 'medium', '{coach}', 'default',
   'e5e20000-0000-4000-8000-00000000000b'),
  ('7472000a-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000001',
   'Soreness elevated', 'Soreness at 2 or below for three days running',
   'wellness', 'wellness.soreness', 'below', 2,
   'absolute', null, 3, 0, 2, 'medium', '{coach,medical}', 'custom',
   'e5e20000-0000-4000-8000-00000000000b'),
  ('7472000a-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000001',
   'Acute chronic ratio high', 'Seven to twenty eight day EWMA load ratio above own 1SD band',
   'gps', 'load.acwr', 'above', 1.30,
   'personal_rolling', 28, 1, 14, 3, 'high', '{coach}', 'default',
   'e5e20000-0000-4000-8000-00000000000b'),
  ('7472000a-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000001',
   'Wellness compliance low', 'Fewer than four wellness submissions in the last seven days',
   'compliance', 'compliance.wellness_7d', 'below', 4,
   'absolute', null, 1, 0, 7, 'low', '{coach}', 'custom',
   'e5e20000-0000-4000-8000-00000000000b');

insert into threshold_revisions (org_id, threshold_id, before, after, change_reason,
                                 changed_by)
select t.org_id, t.id, null,
       to_jsonb(t) - 'created_at' - 'updated_at',
       'Created from the club default set at onboarding',
       'e5e20000-0000-4000-8000-00000000000b'
from thresholds t
where t.org_id = 'a0000000-0000-4000-8000-000000000001';

-- Nine open flags, which is the number on the mockup dashboard. The top five are ranked
-- and shown; a list of fifteen is a list of zero.
insert into flags (org_id, athlete_id, threshold_id, threshold_revision_id, domain, metric,
                   observed_value, expected_value, flag_date, severity, status,
                   raised_at, acknowledged_at, acknowledged_by, athlete_visible_at)
select 'a0000000-0000-4000-8000-000000000001',
       ('a71e0000-0000-4000-8000-' || lpad(v.athlete_n::text, 12, '0'))::uuid,
       v.threshold_id, tr.id, v.domain, v.metric,
       v.observed, v.expected, current_date - v.days_ago, v.severity, v.status,
       (current_date - v.days_ago)::timestamptz + time '07:05',
       case when v.status in ('acknowledged', 'actioned', 'monitoring')
            then (current_date - v.days_ago)::timestamptz + time '08:40' end,
       case when v.status in ('acknowledged', 'actioned', 'monitoring')
            then 'e5e20000-0000-4000-8000-00000000000b'::uuid end,
       -- Carve out 2: the athlete sees the flag only once staff have acknowledged it.
       case when v.status in ('acknowledged', 'actioned', 'monitoring')
            then (current_date - v.days_ago)::timestamptz + time '08:40' end
from (values
  ( 4, '7472000a-0000-4000-8000-000000000004'::uuid, 'gps'::flag_domain,      'load.acwr',                 1.620, 1.180, 0, 'high'::flag_severity,   'raised'::flag_status),
  ( 5, '7472000a-0000-4000-8000-000000000004'::uuid, 'gps'::flag_domain,      'load.acwr',                 1.410, 1.150, 0, 'high'::flag_severity,   'raised'::flag_status),
  ( 2, '7472000a-0000-4000-8000-000000000004'::uuid, 'gps'::flag_domain,      'load.acwr',                 1.240, 1.090, 0, 'medium'::flag_severity, 'raised'::flag_status),
  ( 3, '7472000a-0000-4000-8000-000000000004'::uuid, 'gps'::flag_domain,      'load.acwr',                 1.330, 1.120, 0, 'medium'::flag_severity, 'raised'::flag_status),
  (10, '7472000a-0000-4000-8000-000000000001'::uuid, 'wellness'::flag_domain, 'wellness.readiness_score', 48.000, 71.400, 1, 'high'::flag_severity,   'acknowledged'::flag_status),
  (23, '7472000a-0000-4000-8000-000000000002'::uuid, 'wellness'::flag_domain, 'wellness.sleep_hours',      5.200, 7.900, 1, 'medium'::flag_severity, 'acknowledged'::flag_status),
  (13, '7472000a-0000-4000-8000-000000000003'::uuid, 'wellness'::flag_domain, 'wellness.soreness',         2.000, 4.000, 2, 'medium'::flag_severity, 'monitoring'::flag_status),
  (17, '7472000a-0000-4000-8000-000000000005'::uuid, 'compliance'::flag_domain,'compliance.wellness_7d',   2.000, 7.000, 1, 'low'::flag_severity,    'raised'::flag_status),
  (19, '7472000a-0000-4000-8000-000000000005'::uuid, 'compliance'::flag_domain,'compliance.wellness_7d',   3.000, 7.000, 1, 'low'::flag_severity,    'raised'::flag_status)
) as v(athlete_n, threshold_id, domain, metric, observed, expected, days_ago, severity, status)
join lateral (
  select id from threshold_revisions
  where threshold_id = v.threshold_id limit 1
) tr on true;

insert into flag_actions (org_id, flag_id, action_type, note, taken_by)
select 'a0000000-0000-4000-8000-000000000001', f.id, 'load_adjusted',
       'Dropped from the Tuesday conditioning block, gym only',
       'e5e20000-0000-4000-8000-00000000000b'
from flags f
where f.org_id = 'a0000000-0000-4000-8000-000000000001'
  and f.status = 'acknowledged';

insert into flag_actions (org_id, flag_id, action_type, note, taken_by)
select 'a0000000-0000-4000-8000-000000000001', f.id, 'athlete_spoken_to',
       'Spoke to him Wednesday, sleeping badly with a new baby at home',
       'e5e20000-0000-4000-8000-00000000000a'
from flags f
where f.org_id = 'a0000000-0000-4000-8000-000000000001'
  and f.status = 'monitoring';


-- ===========================================================================
-- 11. Compliance expectations
--
-- Generated for the last fourteen days from the schedule. Athletes who were unavailable
-- have the expectation WAIVED with a reason rather than deleted, so absence is not
-- punished as non-compliance. 04-data-model.md §11.
-- ===========================================================================

insert into compliance_expectations (org_id, athlete_id, expectation_date, domain,
                                     session_id, is_required, waived_reason)
select 'a0000000-0000-4000-8000-000000000001', a.id, d::date, 'wellness', null,
       a.squad_number not in (6, 17),
       case when a.squad_number in (6, 17)
            then 'Unavailable through injury, wellness not required' end
from athletes a
cross join generate_series(current_date - 13, current_date - 1, interval '1 day') as g(d)
where a.org_id = 'a0000000-0000-4000-8000-000000000001';

insert into compliance_expectations (org_id, athlete_id, expectation_date, domain,
                                     session_id, is_required, waived_reason)
select 'a0000000-0000-4000-8000-000000000001', a.id, s.starts_at::date, 'training_rpe',
       s.id, a.squad_number not in (6, 17),
       case when a.squad_number in (6, 17)
            then 'Unavailable through injury, did not train' end
from sessions s
join athletes a on a.org_id = s.org_id
where s.org_id = 'a0000000-0000-4000-8000-000000000001'
  and s.status = 'completed'
  and s.starts_at >= current_date - 13
  and s.session_type in ('training', 'gym', 'match');


-- ===========================================================================
-- 12. Consents, notification preferences and audit
-- ===========================================================================

insert into athlete_consents (org_id, athlete_id, purpose, granted_at, withdrawn_at,
                              notice_version)
select 'a0000000-0000-4000-8000-000000000001', a.id, p.purpose,
       case when (a.squad_number + p.k) % 3 <> 0
            then timestamptz '2025-07-04 09:14:00+01' end,
       case when (a.squad_number + p.k) % 7 = 0
            then timestamptz '2026-02-11 20:03:00+00' end,
       '2026.1'
from athletes a
cross join (values ('healthkit_sync'::consent_purpose, 1),
                   ('leaderboard_visibility'::consent_purpose, 2)) as p(purpose, k)
where a.org_id = 'a0000000-0000-4000-8000-000000000001';

insert into notification_preferences (org_id, user_id, notification_id, push_enabled,
                                      email_enabled, quiet_hours_start, quiet_hours_end)
select u.org_id, u.id, n.notification_id,
       case when (abs(hashtextextended(u.id::text || n.notification_id, 41)) % 5) = 0
            then false else true end,
       false, time '21:00', time '07:00'
from users u
cross join (values ('athlete.wellness.prompt'), ('athlete.rpe.prompt'),
                   ('athlete.availability.changed'), ('staff.flag.digest'))
     as n(notification_id)
where u.org_id = 'a0000000-0000-4000-8000-000000000001';

-- Mandatory audit events, 04-data-model.md §13. A read of injury_clinical, a change to
-- availability, and a role grant.
insert into audit_log (org_id, actor_id, actor_role, action, entity_type, entity_id,
                       athlete_id, metadata, occurred_at) values
  ('a0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-00000000000d',
   'medical', 'availability.set', 'availability',
   '19700000-0000-4000-8000-000000000001', 'a71e0000-0000-4000-8000-000000000002',
   '{"from":"available","to":"modified","restrictions":["no contact"]}'::jsonb,
   now() - interval '9 days'),
  ('a0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-00000000000d',
   'medical', 'injury_clinical.read', 'injury_clinical',
   '19700000-0000-4000-8000-000000000003', 'a71e0000-0000-4000-8000-000000000007',
   '{"reason":"daily review"}'::jsonb, now() - interval '2 hours'),
  ('a0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-00000000000f',
   'admin', 'user_roles.granted', 'user_roles', null, null,
   '{"user":"a.whitmore@ashcomberfc.example","role":"medical"}'::jsonb,
   now() - interval '40 days'),
  ('a0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-00000000000a',
   'coach', 'team_allocation.published', 'team_allocations', null, null,
   '{"team":"1st XV","week_start":"current","count":23}'::jsonb,
   now() - interval '1 day');


-- ===========================================================================
-- 13. Organisation B, the decoy
--
-- Small on purpose. It exists so the cross tenant suite has something to fail against, and
-- its rows are shaped to LOOK like organisation A's: two identical player names, the same
-- entry dates, the same threshold names, an injury with clinical notes. A leak that
-- returned this data would look like ordinary data, which is exactly the failure mode the
-- suite is built to catch.
-- ===========================================================================

insert into seasons (id, org_id, name, starts_on, ends_on, is_current) values
  ('5ea50000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-000000000001',
   '2026/27', date '2026-07-01', date '2027-06-30', true);

insert into groups (id, org_id, name, colour, group_type, sort_order) values
  ('9509000b-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Forwards', '#4f7cff', 'positional', 1),
  ('9509000b-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001',
   'Backs', '#f0a020', 'positional', 2);

insert into teams (id, org_id, name, short_name, rank, status) values
  ('7ea70000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-000000000001',
   '1st XV', '1XV', 1, 'active');

insert into users (id, org_id, email, full_name, status)
select ('e5e20000-0000-4000-8000-' || lpad((900 + v.n)::text, 12, '0'))::uuid,
       'b0000000-0000-4000-8000-000000000001',
       lower(left(v.first_name, 1) || '.' || lower(v.last_name) || '@marlowvale.example'),
       v.first_name || ' ' || v.last_name, 'active'
from (values
  (1, 'James',   'Barnes'),      -- deliberately the same name as an Ashcombe player
  (2, 'Max',     'Chapman'),     -- and so is this one
  (3, 'Callum',  'Northcott'),
  (4, 'Ike',     'Doherty'),
  (5, 'Freddie', 'Bray'),
  (6, 'Eoin',    'Whitfield')
) as v(n, first_name, last_name);

insert into athletes (id, org_id, user_id, first_name, last_name, date_of_birth, position,
                      squad_number, height_cm, status, joined_at, default_team_id)
select ('b71e0000-0000-4000-8000-' || lpad(v.n::text, 12, '0'))::uuid,
       'b0000000-0000-4000-8000-000000000001',
       ('e5e20000-0000-4000-8000-' || lpad((900 + v.n)::text, 12, '0'))::uuid,
       v.first_name, v.last_name, make_date(1998 + v.n, 4, 12), v.position, v.n,
       184.0, 'active', date '2025-08-01', '7ea70000-0000-4000-8000-0000000000b1'
from (values
  (1, 'James',   'Barnes',    'Hooker'),
  (2, 'Max',     'Chapman',   'Lock'),
  (3, 'Callum',  'Northcott', 'Flanker'),
  (4, 'Ike',     'Doherty',   'Scrum-half'),
  (5, 'Freddie', 'Bray',      'Wing'),
  (6, 'Eoin',    'Whitfield', 'Full-back')
) as v(n, first_name, last_name, position);

insert into user_roles (org_id, user_id, role)
select 'b0000000-0000-4000-8000-000000000001', a.user_id, 'athlete'
from athletes a
where a.org_id = 'b0000000-0000-4000-8000-000000000001'
  and a.user_id is not null;

insert into group_memberships (org_id, group_id, athlete_id)
select 'b0000000-0000-4000-8000-000000000001',
       case when a.squad_number <= 3 then '9509000b-0000-4000-8000-000000000001'::uuid
                                     else '9509000b-0000-4000-8000-000000000002'::uuid end,
       a.id
from athletes a where a.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into fixtures (id, org_id, season_id, opponent, kickoff_at, home_away, importance,
                      status)
values ('f1c50000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-000000000001',
        '5ea50000-0000-4000-8000-0000000000b1', 'Bristol Bears',
        (current_date + 2)::timestamptz + time '19:30', 'away', 'friendly', 'scheduled');

insert into sessions (id, org_id, season_id, session_type, title, starts_at, duration_min,
                      md_offset, planned_rpe, status)
select ('5e550000-0000-4000-8000-' || lpad((900 + row_number() over (order by d))::text, 12, '0'))::uuid,
       'b0000000-0000-4000-8000-000000000001', '5ea50000-0000-4000-8000-0000000000b1',
       'training', 'Conditioning', d::timestamptz + time '10:30', 90,
       (d::date - (current_date + 2)), 7.0, 'completed'
from generate_series(current_date - 6, current_date - 1, interval '1 day') as g(d);

-- Same dates as organisation A, so a leaked row would not stand out by its date alone.
insert into wellness_entries (org_id, athlete_id, entry_date, sleep_hours, sleep_quality,
                              fatigue, soreness, stress, mood, resting_hr, body_mass_kg,
                              source, submitted_at, created_by)
select 'b0000000-0000-4000-8000-000000000001', a.id, d::date,
       round((7.0 + ((abs(hashtextextended(a.id::text || d::text, 51)) % 100) - 50) / 50.0)::numeric, 1),
       3 + (abs(hashtextextended(a.id::text || d::text, 52)) % 3),
       3 + (abs(hashtextextended(a.id::text || d::text, 53)) % 3),
       3 + (abs(hashtextextended(a.id::text || d::text, 54)) % 3),
       3 + (abs(hashtextextended(a.id::text || d::text, 55)) % 3),
       3 + (abs(hashtextextended(a.id::text || d::text, 56)) % 3),
       52 + (abs(hashtextextended(a.id::text || d::text, 57)) % 10),
       round((104.0 + (abs(hashtextextended(a.id::text || d::text, 58)) % 20))::numeric, 2),
       'self_report', d::timestamptz + time '07:10', a.user_id
from athletes a
cross join generate_series(current_date - 27, current_date - 1, interval '1 day') as g(d)
where a.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into training_entries (org_id, athlete_id, session_id, entry_date, rpe,
                              duration_min, source, submitted_at, created_by)
select 'b0000000-0000-4000-8000-000000000001', a.id, s.id, s.starts_at::date,
       6 + (abs(hashtextextended(a.id::text || s.id::text, 61)) % 3), 90,
       'self_report', s.starts_at + interval '2 hours', a.user_id
from sessions s
join athletes a on a.org_id = s.org_id
where s.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into nutrition_checkins (org_id, athlete_id, week_start, iso_year, iso_week, answer,
                                source, submitted_at, created_by)
select 'b0000000-0000-4000-8000-000000000001', a.id,
       date_trunc('week', current_date - 7)::date,
       extract(isoyear from current_date - 7)::int,
       extract(week from current_date - 7)::int,
       (array['yes','roughly','no'])[1 + (a.squad_number % 3)]::nutrition_checkin_answer,
       'self_report', now() - interval '2 days', a.user_id
from athletes a where a.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into injuries (id, org_id, athlete_id, body_area, side, onset_date, status,
                      expected_return, occurred_in, reported_by) values
  ('19700000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-000000000001',
   'b71e0000-0000-4000-8000-000000000001', 'shoulder', 'right', current_date - 9,
   'rehab', current_date + 5, 'match', 'e5e20000-0000-4000-8000-0000000000bb');

insert into injury_clinical (injury_id, org_id, diagnosis, mechanism, severity,
                             clinical_notes, treatment_plan, updated_by) values
  ('19700000-0000-4000-8000-0000000000b1', 'b0000000-0000-4000-8000-000000000001',
   'Rotator cuff tendinopathy', 'Repetitive overhead loading', 'moderate',
   'MARLOW VALE CLINICAL NOTE. If this string is ever visible to an Ashcombe user the '
   'tenancy boundary has failed and the Phase 0 exit gate has not been met.',
   'Scapular control programme', 'e5e20000-0000-4000-8000-0000000000bb');

insert into availability (org_id, athlete_id, status, restrictions, reason_category,
                          injury_id, set_by, note)
select 'b0000000-0000-4000-8000-000000000001', a.id,
       case when a.squad_number = 1 then 'modified'::availability_status
            else 'available'::availability_status end,
       case when a.squad_number = 1 then array['no contact'] end,
       case when a.squad_number = 1 then 'injury'::availability_reason end,
       case when a.squad_number = 1 then '19700000-0000-4000-8000-0000000000b1'::uuid end,
       'e5e20000-0000-4000-8000-0000000000bb', null
from athletes a where a.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into thresholds (id, org_id, name, domain, metric, comparison, value, baseline_type,
                        severity, created_by) values
  ('7472000b-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001',
   'Readiness below personal norm', 'wellness', 'wellness.readiness_score', 'z_score',
   -1.5, 'personal_rolling', 'high', 'e5e20000-0000-4000-8000-0000000000ba');

insert into flags (org_id, athlete_id, threshold_id, domain, metric, observed_value,
                   expected_value, flag_date, severity, status)
values ('b0000000-0000-4000-8000-000000000001', 'b71e0000-0000-4000-8000-000000000002',
        '7472000b-0000-4000-8000-000000000001', 'wellness', 'wellness.readiness_score',
        44.0, 70.0, current_date - 1, 'high', 'raised');

insert into compliance_expectations (org_id, athlete_id, expectation_date, domain)
select 'b0000000-0000-4000-8000-000000000001', a.id, d::date, 'wellness'
from athletes a
cross join generate_series(current_date - 6, current_date - 1, interval '1 day') as g(d)
where a.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into team_allocations (org_id, team_id, athlete_id, week_start, status, source,
                              availability_at_allocation, published_at, published_by,
                              created_by)
select 'b0000000-0000-4000-8000-000000000001', '7ea70000-0000-4000-8000-0000000000b1',
       a.id, date_trunc('week', current_date)::date, 'published', 'manual', 'available',
       now() - interval '1 day', 'e5e20000-0000-4000-8000-0000000000ba',
       'e5e20000-0000-4000-8000-0000000000ba'
from athletes a where a.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into session_attendance (org_id, session_id, athlete_id, attendance, recorded_by)
select 'b0000000-0000-4000-8000-000000000001', s.id, a.id, 'full',
       'e5e20000-0000-4000-8000-0000000000ba'
from sessions s
join athletes a on a.org_id = s.org_id
where s.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into session_participants (org_id, session_id, group_id)
select 'b0000000-0000-4000-8000-000000000001', s.id, '9509000b-0000-4000-8000-000000000001'
from sessions s where s.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into week_templates (org_id, name, structure) values
  ('b0000000-0000-4000-8000-000000000001', 'Marlow standard week',
   '{"days":[{"md_offset":-1,"sessions":[]}]}'::jsonb);

insert into threshold_revisions (org_id, threshold_id, after, changed_by)
values ('b0000000-0000-4000-8000-000000000001', '7472000b-0000-4000-8000-000000000001',
        '{"value":-1.5}'::jsonb, 'e5e20000-0000-4000-8000-0000000000ba');

insert into flag_actions (org_id, flag_id, action_type, note, taken_by)
select 'b0000000-0000-4000-8000-000000000001', f.id, 'note', 'Watching',
       'e5e20000-0000-4000-8000-0000000000ba'
from flags f where f.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into athlete_consents (org_id, athlete_id, purpose, granted_at, notice_version)
select 'b0000000-0000-4000-8000-000000000001', a.id, 'healthkit_sync', now(), '2026.1'
from athletes a where a.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into notification_preferences (org_id, user_id, notification_id, push_enabled)
select u.org_id, u.id, 'athlete.wellness.prompt', true
from users u where u.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into push_tokens (org_id, user_id, token, platform, shell)
select u.org_id, u.id, 'ExponentPushToken[marlow-' || u.id::text || ']', 'ios', 'athlete'
from users u where u.org_id = 'b0000000-0000-4000-8000-000000000001';

insert into push_tokens (org_id, user_id, token, platform, shell)
select u.org_id, u.id, 'ExponentPushToken[ashcombe-' || u.id::text || ']', 'ios',
       case when u.email like '%ashcomberfc%'
                 and u.id in (select user_id from athletes
                              where org_id = 'a0000000-0000-4000-8000-000000000001'
                                and user_id is not null)
            then 'athlete' else 'staff' end
from users u where u.org_id = 'a0000000-0000-4000-8000-000000000001';

insert into audit_log (org_id, actor_id, actor_role, action, entity_type, athlete_id,
                       metadata)
values ('b0000000-0000-4000-8000-000000000001', 'e5e20000-0000-4000-8000-0000000000bb',
        'medical', 'injury_clinical.read', 'injury_clinical',
        'b71e0000-0000-4000-8000-000000000001', '{"reason":"weekly review"}'::jsonb);

commit;
