-- 000_setup_test_helpers.sql
--
-- Installs pgTAP and the `tests` schema the rest of the suite depends on.
--
-- This file is deliberately NOT wrapped in begin/rollback. pg_prove runs each file in its
-- own psql session, so the helpers created here persist and every later file can use them.
-- Every later file DOES wrap itself in begin/rollback, so no test leaves a row behind.
--
-- Which spec sections this implements
--   01-roles-and-permissions.md §6: "an automated test suite must attempt, for every table,
--     to read another organisation's rows as each of the four roles, and assert zero rows
--     returned. This suite runs in CI and blocks merge on failure. It is the only test
--     suite that is mandatory."
--   09-security-and-compliance.md §8.2 and 05-architecture.md §12, the mandatory RLS suite
--   10-roadmap.md §3 exit criteria: "cross-tenant suite green in CI, enumerating tables
--     dynamically"
--   CONTRACT.md, definition of done for Phase 0

-- Installed into `extensions`, not `public`: config.toml's api.extra_search_path is
-- ["public", "extensions"] specifically so extensions live there, and pgTAP's own helper
-- views (tap_funky, pg_all_foreign_keys, ...) inherit whatever default privileges the
-- schema they land in has. Landing them in public handed anon and authenticated grants
-- on objects that have nothing to do with the app schema, which is exactly what
-- 010_rls_coverage_test.sql's "anon holds no privilege on any table in public" exists to
-- catch, so getting this wrong makes the suite fail on itself rather than on the app.
create extension if not exists pgtap with schema extensions;

-- If a previous run installed it into public (true on any project that predates this
-- fix), move it rather than leaving a stale copy behind. IF NOT EXISTS above is a no-op
-- once installed anywhere, so this is the part that actually corrects it.
do $$
begin
  if exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgtap' and n.nspname <> 'extensions'
  ) then
    alter extension pgtap set schema extensions;
  end if;
end $$;

create schema if not exists tests;
grant usage on schema tests to public;


-- ---------------------------------------------------------------------------
-- Deterministic identifiers. Two organisations built from the same recipe with a
-- different prefix, so every fixture id is derivable and nothing has to be hard coded.
-- ---------------------------------------------------------------------------

create or replace function tests.uid(p_prefix text, p_label text)
returns uuid
language sql
immutable
as $$
  select md5(p_prefix || ':' || p_label)::uuid;
$$;


-- ---------------------------------------------------------------------------
-- tests.set_jwt: the helper that puts a fixture user's claims where RLS reads them.
--
-- It builds exactly the claim object auth_hooks.custom_access_token_hook would build for
-- that user, so a test exercises the same shape production does. Nothing here is invented:
-- org_id, roles and athlete_id are read from the fixture tables, which is what the hook
-- does at token issue time.
--
-- security definer, because by the time it is called the session has already switched to
-- the authenticated role and can no longer read users or user_roles freely.
-- set_config with is_local = true, so the claim rolls back with the test's transaction.
--
-- p_aal (added migration 0048, login-security checklist item 3): the top-level `aal`
-- Supabase Auth itself stamps on every token ('aal1' or 'aal2' — see JwtPayload's
-- RequiredClaims in @supabase/auth-js), NOT something auth_hooks.custom_access_token_hook
-- writes, which only ever touches the app_metadata branch above. Defaults to 'aal1', which
-- is exactly what every caller of this function got before this parameter existed (the
-- claim object had no `aal` key at all, and public.auth_is_aal2() treats a missing claim
-- the same as 'aal1') — so every one of the ~30 existing test files that calls
-- tests.set_jwt(uuid) with one argument is unaffected byte-for-byte. Only
-- 240_mfa_aal2_helper_test.sql passes 'aal2' explicitly.
-- ---------------------------------------------------------------------------

-- A true replace, not a second overload: without the drop, `tests.set_jwt(uuid, text
-- default ...)` would coexist alongside the old `tests.set_jwt(uuid)` as a distinct
-- signature rather than superseding it, since Postgres identifies a function by its
-- parameter types, and a trailing default does not collapse two different arities into one
-- function for `create or replace` purposes.
drop function if exists tests.set_jwt(uuid);

create or replace function tests.set_jwt(p_user_id uuid, p_aal text default 'aal1')
returns void
language plpgsql
security definer
set search_path = public, tests
as $$
declare
  v_claims jsonb;
begin
  select jsonb_build_object(
           'sub',  u.id::text,
           'role', 'authenticated',
           'aud',  'authenticated',
           'aal',  p_aal,
           'app_metadata', jsonb_build_object(
             'org_id', u.org_id,
             'roles', coalesce(
               (select jsonb_agg(ur.role::text order by ur.role)
                  from public.user_roles ur where ur.user_id = u.id),
               '[]'::jsonb),
             'athlete_id',
               (select a.id from public.athletes a
                 where a.user_id = u.id and a.deleted_at is null),
             'cv', u.claims_version
           ))
    into v_claims
  from public.users u
  where u.id = p_user_id
    and u.deleted_at is null;

  if v_claims is null then
    raise exception 'tests.set_jwt: no fixture user %', p_user_id;
  end if;

  perform set_config('request.jwt.claims', v_claims::text, true);
end;
$$;

-- Signing out. Used to prove that an anonymous caller reads nothing either.
create or replace function tests.clear_jwt()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', '', true);
end;
$$;


-- ---------------------------------------------------------------------------
-- tests.club_tables: every table in public that holds club data, enumerated DYNAMICALLY
-- from the catalogue rather than from a list somebody has to remember to update.
--
-- 10-roadmap.md §3 requires the suite to enumerate tables dynamically. A hard coded list
-- passes forever after somebody adds a table and forgets the test, which is precisely the
-- failure the exit gate exists to prevent.
--
-- The definition of "club data" is "has an org_id column", which is CONTRACT.md rule 1
-- read backwards: if a table holds club data it has org_id, so if it has org_id it is in
-- the suite. organisations is tested separately because its tenancy column is id.
-- ---------------------------------------------------------------------------

create or replace function tests.club_tables()
returns setof text
language sql
stable
as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  join pg_attribute a on a.attrelid = c.oid
  where n.nspname = 'public'
    and c.relkind = 'r'
    and a.attname = 'org_id'
    and a.attnum > 0
    and not a.attisdropped
  order by 1;
$$;

-- Every table in public, whatever its shape. Used by the RLS coverage assertions.
create or replace function tests.all_public_tables()
returns setof text
language sql
stable
as $$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
  order by 1;
$$;


-- ---------------------------------------------------------------------------
-- tests.count_rows_for_org: run a count against one table, filtered to one organisation.
--
-- Deliberately NOT security definer. It must execute with the caller's privileges so the
-- caller's RLS policies apply, which is the entire point of the suite. If this function
-- were definer it would pass while the product leaked.
-- ---------------------------------------------------------------------------

create or replace function tests.count_rows_for_org(p_table text, p_org uuid)
returns bigint
language plpgsql
stable
as $$
declare
  v_n bigint;
begin
  execute format('select count(*) from public.%I where org_id = $1', p_table)
    into v_n using p_org;
  return v_n;
end;
$$;

-- tests.rows_affected: run a data modifying statement and report how many rows it changed.
--
-- An UPDATE or DELETE that a policy filters out does not raise, it affects zero rows, which
-- is correct PostgreSQL behaviour. Some of the rules in this suite are therefore "changes
-- nothing" rather than "throws", and this is how that is asserted.
--
-- Deliberately NOT security definer, for the same reason as count_rows_for_org.
create or replace function tests.rows_affected(p_sql text)
returns bigint
language plpgsql
as $$
declare
  v_n bigint;
begin
  execute p_sql;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

grant execute on function tests.uid(text, text)              to public;
grant execute on function tests.set_jwt(uuid, text)          to public;
grant execute on function tests.clear_jwt()                  to public;
grant execute on function tests.club_tables()                to public;
grant execute on function tests.all_public_tables()          to public;
grant execute on function tests.count_rows_for_org(text, uuid) to public;
grant execute on function tests.rows_affected(text)          to public;


-- ---------------------------------------------------------------------------
-- tests.build_org: one organisation, one row in every club data table.
--
-- Called twice with different prefixes, so organisation A and organisation B are
-- structurally identical and their rows look alike. That similarity is deliberate: a leak
-- that returned organisation B's wellness entry would look like ordinary data, and a suite
-- built on obviously-different fixtures would not tell you whether the boundary held or
-- whether you simply could not tell the two apart.
--
-- Users created, one per role plus two athletes:
--   coach   holds coach
--   medical holds medical
--   admin   holds admin
--   ath1    holds athlete, linked to athlete 1
--   ath2    holds athlete, linked to athlete 2
-- ---------------------------------------------------------------------------

create or replace function tests.build_org(p_prefix text, p_name text)
returns void
language plpgsql
security definer
set search_path = public, tests
as $$
declare
  o    uuid := tests.uid(p_prefix, 'org');
  ucoa uuid := tests.uid(p_prefix, 'user_coach');
  umed uuid := tests.uid(p_prefix, 'user_medical');
  uadm uuid := tests.uid(p_prefix, 'user_admin');
  /* The two roles the five-role model added. The fixtures covered four roles
     because the enum had four; without these there is no way to write a test
     for D-01, which is the rule that a nutritionist sees no injury or medical
     information anywhere. user_admin keeps its label rather than being renamed
     to user_sport_scientist: the label is only an input to md5(), and renaming
     it would change every id it generates and every row keyed off them. */
  usc  uuid := tests.uid(p_prefix, 'user_sc');
  unut uuid := tests.uid(p_prefix, 'user_nutritionist');
  ua1  uuid := tests.uid(p_prefix, 'user_athlete_1');
  ua2  uuid := tests.uid(p_prefix, 'user_athlete_2');
  a1   uuid := tests.uid(p_prefix, 'athlete_1');
  a2   uuid := tests.uid(p_prefix, 'athlete_2');
  grp  uuid := tests.uid(p_prefix, 'group');
  sea  uuid := tests.uid(p_prefix, 'season');
  fix  uuid := tests.uid(p_prefix, 'fixture');
  ses  uuid := tests.uid(p_prefix, 'session');
  tm   uuid := tests.uid(p_prefix, 'team');
  inj  uuid := tests.uid(p_prefix, 'injury');
  thr  uuid := tests.uid(p_prefix, 'threshold');
  trv  uuid := tests.uid(p_prefix, 'threshold_revision');
  flg  uuid := tests.uid(p_prefix, 'flag_visible');
  flg2 uuid := tests.uid(p_prefix, 'flag_hidden');
  wk   date := date_trunc('week', current_date)::date;
begin
  insert into organisations (id, name, sport, timezone) values (o, p_name, 'rugby_union', 'Europe/London');

  insert into users (id, org_id, email, full_name, status) values
    (ucoa, o, p_prefix || '.coach@fixture.example',    'Fixture Coach',    'active'),
    (umed, o, p_prefix || '.medical@fixture.example',  'Fixture Physio',   'active'),
    (uadm, o, p_prefix || '.admin@fixture.example',    'Fixture Sport Sci','active'),
    (usc,  o, p_prefix || '.sc@fixture.example',       'Fixture S&C',      'active'),
    (unut, o, p_prefix || '.nutrition@fixture.example','Fixture Nutrition','active'),
    (ua1,  o, p_prefix || '.athlete1@fixture.example', 'James Barnes',     'active'),
    (ua2,  o, p_prefix || '.athlete2@fixture.example', 'Max Chapman',      'active');

  insert into user_roles (org_id, user_id, role) values
    (o, ucoa, 'coach'), (o, umed, 'medic'), (o, uadm, 'sport_scientist'),
    (o, usc, 'strength_conditioning'), (o, unut, 'nutritionist'),
    (o, ua1, 'athlete'), (o, ua2, 'athlete');

  insert into athletes (id, org_id, user_id, first_name, last_name, date_of_birth,
                        position, squad_number, height_cm) values
    (a1, o, ua1, 'James', 'Barnes',  date '2002-01-27', 'Hooker', 2, 181.0),
    (a2, o, ua2, 'Max',   'Chapman', date '1999-06-09', 'Lock',   4, 200.0);

  insert into athlete_consents (org_id, athlete_id, purpose, granted_at, notice_version)
    values (o, a1, 'healthkit_sync', now(), '2026.1');

  insert into groups (id, org_id, name, group_type) values (grp, o, 'Forwards', 'positional');
  insert into group_memberships (org_id, group_id, athlete_id) values (o, grp, a1), (o, grp, a2);

  insert into seasons (id, org_id, name, starts_on, ends_on, is_current)
    values (sea, o, '2026/27', date '2026-07-01', date '2027-06-30', true);

  insert into fixtures (id, org_id, season_id, opponent, kickoff_at, home_away)
    values (fix, o, sea, 'Bristol Bears', now() + interval '2 days', 'home');

  insert into sessions (id, org_id, season_id, fixture_id, session_type, title, starts_at,
                        duration_min, md_offset, planned_rpe, status)
    values (ses, o, sea, fix, 'training', 'Team run', now() - interval '1 day', 80, -1, 7.0,
            'completed');

  insert into session_participants (org_id, session_id, group_id) values (o, ses, grp);

  insert into session_attendance (org_id, session_id, athlete_id, attendance, recorded_by)
    values (o, ses, a1, 'full', ucoa);

  insert into week_templates (org_id, name, structure)
    values (o, 'Standard 1-game week', '{"days":[{"md_offset":-1,"sessions":[]}]}'::jsonb);

  insert into teams (id, org_id, name, short_name, rank) values (tm, o, '1st XV', '1XV', 1);
  update athletes set default_team_id = tm where org_id = o;

  -- One published allocation and one draft. The draft is what an athlete must never read.
  insert into team_allocations (org_id, team_id, athlete_id, week_start, status, source,
                                availability_at_allocation, published_at, published_by,
                                created_by)
    values (o, tm, a1, wk, 'published', 'manual', 'available', now(), ucoa, ucoa);
  insert into team_allocations (org_id, team_id, athlete_id, week_start, status, source,
                                availability_at_allocation, created_by)
    values (o, tm, a2, wk, 'draft', 'manual', 'available', ucoa);

  insert into wellness_entries (org_id, athlete_id, entry_date, sleep_hours, sleep_quality,
                                fatigue, soreness, stress, mood, source, created_by) values
    (o, a1, current_date - 1, 7.5, 4, 4, 4, 4, 4, 'self_report', ua1),
    (o, a2, current_date - 1, 6.2, 3, 2, 2, 3, 3, 'self_report', ua2);

  insert into training_entries (org_id, athlete_id, session_id, entry_date, rpe,
                                duration_min, source, created_by)
    values (o, a1, ses, current_date - 1, 7.0, 80, 'self_report', ua1);

  insert into nutrition_checkins (org_id, athlete_id, week_start, iso_year, iso_week,
                                  answer, source, created_by)
    values (o, a1, date_trunc('week', current_date - 7)::date,
            extract(isoyear from current_date - 7)::int,
            extract(week    from current_date - 7)::int,
            'roughly', 'self_report', ua1);

  insert into injuries (id, org_id, athlete_id, body_area, side, onset_date, status,
                        expected_return, occurred_in, reported_by)
    values (inj, o, a1, 'shoulder', 'right', current_date - 9, 'rehab',
            current_date + 5, 'match', umed);

  insert into injury_clinical (injury_id, org_id, diagnosis, mechanism, severity,
                               clinical_notes, treatment_plan, updated_by)
    values (inj, o, 'Grade 2 acromioclavicular joint sprain', 'Direct contact', 'moderate',
            p_prefix || ' CLINICAL NOTE, must never leave the medical role',
            'Progressive loading', umed);

  insert into availability (org_id, athlete_id, status, restrictions, reason_category,
                            injury_id, set_by, note)
    values (o, a1, 'modified', array['no contact'], 'injury', inj, umed,
            'Reviewed daily');
  insert into availability (org_id, athlete_id, status, set_by)
    values (o, a2, 'available', umed);

  insert into thresholds (id, org_id, name, domain, metric, comparison, value,
                          baseline_type, severity, created_by)
    values (thr, o, 'Readiness below personal norm', 'wellness', 'wellness.readiness_score',
            'z_score', -1.5, 'personal_rolling', 'high', ucoa);

  insert into threshold_revisions (id, org_id, threshold_id, after, changed_by)
    values (trv, o, thr, '{"value":-1.5}'::jsonb, ucoa);

  -- One flag an athlete may see, because staff acknowledged it, and one they may not.
  insert into flags (id, org_id, athlete_id, threshold_id, threshold_revision_id, domain,
                     metric, observed_value, expected_value, flag_date, severity, status,
                     acknowledged_at, acknowledged_by, athlete_visible_at)
    values (flg, o, a1, thr, trv, 'wellness', 'wellness.readiness_score', 48.0, 71.4,
            current_date - 1, 'high', 'acknowledged', now(), ucoa, now());
  insert into flags (id, org_id, athlete_id, threshold_id, threshold_revision_id, domain,
                     metric, observed_value, expected_value, flag_date, severity, status)
    values (flg2, o, a1, thr, trv, 'wellness', 'wellness.sleep_hours', 5.2, 7.9,
            current_date, 'medium', 'raised');

  insert into flag_actions (org_id, flag_id, action_type, note, taken_by)
    values (o, flg, 'load_adjusted', 'Dropped from conditioning', ucoa);

  insert into compliance_expectations (org_id, athlete_id, expectation_date, domain)
    values (o, a1, current_date - 1, 'wellness');

  insert into audit_log (org_id, actor_id, actor_role, action, entity_type, entity_id,
                         athlete_id, metadata)
    values (o, umed, 'medic', 'injury_clinical.read', 'injury_clinical', inj, a1,
            '{"reason":"daily review"}'::jsonb);

  insert into notification_preferences (org_id, user_id, notification_id, push_enabled)
    values (o, ua1, 'athlete.wellness.prompt', true);

  insert into push_tokens (org_id, user_id, token, platform, shell)
    values (o, ua1, 'ExponentPushToken[' || p_prefix || ']', 'ios', 'athlete');
end;
$$;

-- Both organisations, built from the same recipe. A is the caller's organisation in every
-- test; B is the one nobody in A may ever see a row of.
create or replace function tests.fixtures()
returns void
language plpgsql
security definer
set search_path = public, tests
as $$
begin
  perform tests.build_org('orga', 'Ashcombe Rugby Club');
  perform tests.build_org('orgb', 'Marlow Vale RUFC');
end;
$$;

grant execute on function tests.build_org(text, text) to public;
grant execute on function tests.fixtures()            to public;


-- pg_prove expects a TAP stream from every file it runs, including this one.
begin;
select plan(1);
select ok(true, 'test helpers installed');
select * from finish();
rollback;
